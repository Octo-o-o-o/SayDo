// B2 记忆账本(计划 2.1;modules/b B2):append-only memory_events 真相源 + 派生投影。
// 写路径 candidate->trusted(classify.ts);forget_hard 传播(fts/projection/summary/backup)+ 重放幂等;
// 投影:P0 不落 current_projection 表——启动全量重放入内存(knowledge/*.md 是文件投影,B1/2.2 消费)。
// G6 另一半(删除/同意传播,Gate 0)。

import { newId, type MemoryEvent, type SourceRef, type Tier, type Trust } from "@saydo/contracts";

type AddedMemoryEvent = Extract<MemoryEvent, { op: "add" | "correct" }>;
import type { Db } from "../storage/db.js";
import { insertMemoryEvent, listMemoryEvents } from "../storage/dao/memory.js";
import type { AuditSink } from "../obs/audit.js";
import { classifyTrust, assertWritable } from "./classify.js";
import { assertPersistableStrings, isMemorySecretLiteralError } from "./credentialLiterals.js";

/** 内存投影里的一条 active 记忆(events 重放派生) */
export interface ProjectedMemory {
  id: string;
  tier: Tier;
  projectId?: string | undefined;
  claim: string;
  source: SourceRef;
  trust: Trust;
  taint?: string[] | undefined;
  expiresAt?: string | undefined;
  /** A3-armed(09 §13):就绪候选绑定 key(add 写点透传;correct 形状允许但现无生产写点;covered 判定经 readiness_bindings,不直接以此放行) */
  readinessKey?: string | undefined;
}

export interface AddInput {
  tier: Tier;
  projectId?: string;
  claim: string;
  source: SourceRef;
  requestedTrust?: Trust;
  gitTracked?: boolean;
  /** 到期时间(任意 ISO-8601 时区形态;写入侧归一化为 UTC Z,保证字符串比较语义——评审 B-3) */
  expiresAt?: string;
  /** 被取代的旧事实 id(纠正/更新语义:投影中旧值退场且不复活——评审 B-1) */
  supersedes?: string;
  /** 显式 taint(与 classify 结果取并集;reanchor 并入透传污染源信息——评审 B-5) */
  taint?: string[];
  /** A3-armed:就绪候选绑定 key(四闸校验在 remember 工具层;本层只透传持久化) */
  readinessKey?: string;
}

export interface ForgetHardStores {
  fts: (targetIds: string[]) => void; // 标准 SQL DELETE(09 §4:memory_fts 普通表)
  projection: (targetIds: string[]) => void; // 投影文件段清除
  summary: (targetIds: string[]) => void; // 派生摘要清除
  backup: (targetIds: string[], generation: number) => void; // 登记待过期(不逐条清,备份例外)
  /** 源快照 + 评估记录明文段清除(09 §4.1;makeSnapshotForgetStore;targetDigests 定位 assessments 明文) */
  snapshot?: (targetIds: string[], targetDigests?: string[]) => void;
}

/**
 * A3-armed(09 §13 covered 块;批末 review A-1):hard-forget 联动清 readiness_bindings 行——
 * 绑定是 claim 的派生关系(claim_digest/turn 锚等元数据),claim 除名则绑定不留;幂等 DELETE,
 * forgetHard 事务内与启动恢复例程共用。soft/invalidate 不删行(经现役判定自然失效,审计保留)。
 */
export function purgeReadinessBindings(db: Db, targets: string[]): void {
  if (targets.length === 0) return;
  db.prepare("DELETE FROM readiness_bindings WHERE mem_id IN (" + targets.map(() => "?").join(",") + ")").run(...targets);
}

/**
 * 就地覆写 forget_hard targets 的历史正文(幂等 UPDATE;唯一 append-only 例外)。
 * forgetHard 事务内与启动恢复例程(recovery.ts,评审 A-1)共用:崩溃后重放 tombstone 重执行即收敛。
 */
export function redactForgottenTargets(db: Db, targets: string[]): void {
  if (targets.length === 0) return;
  db.prepare(
    "UPDATE memory_events SET claim = '[forgotten]', source_json = '{\"kind\":\"import\",\"ref\":\"[forgotten]\"}', taint_json = NULL WHERE id IN (" +
      targets.map(() => "?").join(",") +
      ") AND op IN ('add','correct')"
  ).run(...targets);
}

export class MemoryLedger {
  private readonly db: Db;
  private readonly audit: AuditSink;
  private readonly now: () => Date;

  constructor(deps: { db: Db; audit: AuditSink; now?: () => Date }) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => new Date());
  }

  /** 写一条 add/correct(经写路径分级);trust 由 classify 决定,不信调用方自报(除 user_stated/approved) */
  add(input: AddInput): AddedMemoryEvent {
    // AS-01:凭据闸先于 classify / requestedTrust / supersedes / insert。
    try {
      const persistable = [input.claim, input.source.ref];
      if (typeof input.source.quote === "string") persistable.push(input.source.quote);
      assertPersistableStrings(persistable);
    } catch (err) {
      if (isMemorySecretLiteralError(err)) {
        this.audit.record({
          actor: "daemon",
          action: "memory.secret_literal_rejected",
          meta: {
            tier: input.tier,
            ...(input.projectId ? { projectId: input.projectId } : {}),
            hits: err.hits.map((hit) => ({ kind: hit.kind, spanDigest: hit.spanDigest }))
          }
        });
      }
      throw err;
    }
    const { trust, taint } = classifyTrust({
      tier: input.tier,
      claim: input.claim,
      source: input.source,
      ...(input.requestedTrust ? { requestedTrust: input.requestedTrust } : {}),
      ...(input.gitTracked !== undefined ? { gitTracked: input.gitTracked } : {})
    });
    const mergedTaint = [...new Set([...(taint ?? []), ...(input.taint ?? [])])];
    const event: AddedMemoryEvent = {
      id: newId("mem"),
      ts: this.now().toISOString(),
      op: "add",
      tier: input.tier,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      claim: input.claim,
      source: input.source,
      trust,
      ...(mergedTaint.length > 0 ? { taint: mergedTaint } : {}),
      // B-3:归一化 UTC Z——Ts 契约允许 ±HH:MM 偏移,字典序比较(project/compiler)需统一形态
      ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt).toISOString() } : {}),
      ...(input.supersedes ? { supersedes: input.supersedes } : {}),
      ...(input.readinessKey ? { readinessKey: input.readinessKey } : {})
    };
    assertWritable(event);
    insertMemoryEvent(this.db, event);
    this.audit.record({ actor: "daemon", action: "memory.add", meta: { memId: event.id, tier: input.tier, trust } });
    return event;
  }

  /** invalidate / forget_soft:失效标记(不清除,投影排除) */
  invalidate(op: "invalidate" | "forget_soft", targets: string[], reason: string, tier: Tier, projectId?: string): MemoryEvent {
    const event: MemoryEvent = {
      id: newId("mem"),
      ts: this.now().toISOString(),
      op,
      tier,
      ...(projectId ? { projectId } : {}),
      targets,
      reason
    };
    insertMemoryEvent(this.db, event);
    this.audit.record({ actor: "daemon", action: `memory.${op}`, meta: { targets, reason } });
    return event;
  }

  /**
   * forget_hard(append-only 唯一例外,09 §4):
   * tombstone(target ids/digests + generation)+ 就地覆写历史 claim/source + memoryGeneration +1(同事务)+ 多 store 清除。
   * 备份 store = 登记待过期(不逐条清)。清除操作幂等(重放遇 tombstone 按 target 集重执行)。
   */
  forgetHard(input: {
    targets: string[];
    targetDigests: string[];
    stores: ("fts" | "projection" | "summary" | "backup" | "snapshot")[];
    tier: Tier;
    projectId?: string;
    execute: ForgetHardStores;
  }): { event: MemoryEvent; generation: number } {
    const generation = this.nextGeneration();
    const tx = this.db.transaction(() => {
      // 1. 追加 tombstone(带 generation;不留敏感正文)
      const event: MemoryEvent = {
        id: newId("mem"),
        ts: this.now().toISOString(),
        op: "forget_hard",
        tier: input.tier,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        targets: input.targets,
        targetDigests: input.targetDigests,
        generation,
        stores: input.stores
      };
      insertMemoryEvent(this.db, event);
      // 2. 就地覆写历史相关事件的 claim/source(唯一 append-only 例外;不留敏感正文,
      //    source 覆写为占位 object 而非 NULL——add/correct 回读要求 source 为 object,占位 ref=[forgotten])
      redactForgottenTargets(this.db, input.targets);
      // 2.5 hard-forget 联动清 readiness 绑定行(09 §13;review A-1——元数据不留,重放幂等)
      purgeReadinessBindings(this.db, input.targets);
      // 3. 记 memoryGeneration(持久计数器已由 generation 承载,MAX(generation) 重放推导)
      return event;
    });
    const event = tx();
    // 4. 多 store 清除(事务外执行副作用;重放幂等——清除是"清到目标不存在"的幂等操作)
    this.applyForgetStores(input.stores, input.targets, input.targetDigests, generation, input.execute);
    this.audit.record({
      actor: "daemon",
      action: "memory.forget_hard",
      meta: { targets: input.targets, generation, stores: input.stores }
    });
    return { event, generation };
  }

  /** 幂等清除各 store(重放同样调用收敛;backup=登记待过期) */
  private applyForgetStores(
    stores: ("fts" | "projection" | "summary" | "backup" | "snapshot")[],
    targets: string[],
    targetDigests: string[],
    generation: number,
    exec: ForgetHardStores
  ): void {
    if (stores.includes("fts")) exec.fts(targets);
    if (stores.includes("projection")) exec.projection(targets);
    if (stores.includes("summary")) exec.summary(targets);
    if (stores.includes("backup")) exec.backup(targets, generation); // 登记待过期(§4 备份例外)
    if (stores.includes("snapshot")) {
      // 评审 C:声明清 snapshot 而装配漏接线 ⇒ fail-open 无声——改为抛错(fail-closed)
      if (!exec.snapshot) throw new Error("forget_hard declares snapshot store but executor missing");
      exec.snapshot(targets, targetDigests); // 源快照 + 评估记录明文段(09 §4.1)
    }
  }

  /**
   * 历史上是否记录过同 claim(含已失效/被拒/被 supersede 的;W2 迟到评审 B2:被拒候选
   * 不得因"只查活跃投影"而复活重提名)。forget_hard 覆写为 [forgotten] 后查不到 = 可重新
   * 提名(硬删语义即彻底遗忘,用户再说是新事件)。projectId 限定本项目 ∪ 全局(M0)。
   */
  hasClaimHistory(claim: string, projectId?: string): boolean {
    const row = projectId
      ? this.db
          .prepare(
            "SELECT 1 AS x FROM memory_events WHERE op IN ('add','correct') AND claim = ? AND (project_id = ? OR project_id IS NULL) LIMIT 1"
          )
          .get(claim, projectId)
      : this.db.prepare("SELECT 1 AS x FROM memory_events WHERE op IN ('add','correct') AND claim = ? LIMIT 1").get(claim);
    return row !== undefined;
  }

  /** memoryGeneration = MAX(forget_hard.generation)(持久计数器,重放推导);无 forget_hard 时 0 */
  nextGeneration(): number {
    const row = this.db.prepare("SELECT MAX(generation) AS g FROM memory_events WHERE op='forget_hard'").get() as {
      g: number | null;
    };
    return (row.g ?? 0) + 1;
  }

  currentGeneration(): number {
    const row = this.db.prepare("SELECT MAX(generation) AS g FROM memory_events WHERE op='forget_hard'").get() as {
      g: number | null;
    };
    return row.g ?? 0;
  }

  /**
   * 全量重放派生当前投影(P0 无 current_projection 表;启动/查询时重放)。
   * 规则(09 §4/§5):
   * - add/correct 进 active;correct 覆盖同 id 前值(简化:按 supersedes 链,P0 用 ts 序);
   * - invalidate/forget_soft:targets 从 active 移除(否定不复活);
   * - forget_hard:targets 移除(已就地覆写为 [forgotten],不进 active);
   * - expiresAt 到期(相对 now)不进 active。
   */
  project(now?: string): ProjectedMemory[] {
    const nowTs = now ?? this.now().toISOString();
    const events = listMemoryEvents(this.db);
    const active = new Map<string, ProjectedMemory>();
    const removed = new Set<string>();

    for (const e of events) {
      if (e.op === "add" || e.op === "correct") {
        if (e.claim === "[forgotten]") continue; // 已 hard-forget 覆写
        if (e.supersedes) {
          // B-1:纠正/更新语义——旧值退场且不复活(与否定同构;09 §4 supersedes)
          active.delete(e.supersedes);
          removed.add(e.supersedes);
        }
        active.set(e.id, {
          id: e.id,
          tier: e.tier,
          projectId: e.projectId,
          claim: e.claim,
          source: e.source,
          trust: e.trust,
          taint: e.taint,
          expiresAt: e.expiresAt,
          readinessKey: e.readinessKey
        });
      } else if (e.op === "invalidate" || e.op === "forget_soft" || e.op === "forget_hard") {
        for (const t of e.targets) {
          removed.add(t);
          active.delete(t);
        }
      }
    }

    return [...active.values()].filter((m) => {
      if (removed.has(m.id)) return false;
      if (m.expiresAt && m.expiresAt <= nowTs) return false; // 过期不入 pack(否定不复活)
      return true;
    });
  }
}
