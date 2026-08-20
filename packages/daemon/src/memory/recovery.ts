// 记忆域启动恢复例程(Phase 2 评审 A-1;09 §4"重放遇 tombstone 按 target 集重执行清除…可靠重放收敛")。
// 崩溃窗口 = forgetHard 事务提交后、store 清除前:FTS 表 claim 明文残留磁盘;且 memory_fts 无 mem_id 列,
// deleteByIds 依赖进程内存映射(重启后为空、静默失效)——唯一可靠收敛路径 = 全量 rebuild。
// 本例程为记忆域装配的强制入口:重放 tombstone 重执行覆写(幂等)+ FTS 全量重建(从 active 投影,
// 天然清残影)。projection/summary/backup 三个 store 的重执行在其生产接线时并入(P0 FTS 是唯一实体 store)。

import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { listMemoryEvents } from "../storage/dao/memory.js";
import { MemoryLedger, purgeReadinessBindings, redactForgottenTargets } from "./ledger.js";
import { MemoryFts } from "./fts.js";

export interface RecoveredMemory {
  ledger: MemoryLedger;
  fts: MemoryFts;
  /** 重执行覆写的 tombstone 数(观测/审计) */
  tombstonesReplayed: number;
}

export function recoverMemory(
  db: Db,
  audit: AuditSink,
  now?: () => Date,
  /** 可选 store 重执行(3.2 起接 snapshot 清除——makeSnapshotForgetStore;幂等) */
  stores?: { snapshot?: (targetIds: string[], targetDigests?: string[]) => void }
): RecoveredMemory {
  // 1) 重放所有 tombstone,重执行就地覆写(幂等 UPDATE:已覆写的再跑无变化)+ store 清除重执行
  let tombstonesReplayed = 0;
  for (const e of listMemoryEvents(db)) {
    if (e.op !== "forget_hard") continue;
    redactForgottenTargets(db, e.targets);
    purgeReadinessBindings(db, e.targets); // A3-armed(review A-1):绑定行清除随 tombstone 重放收敛
    if (e.stores.includes("snapshot")) stores?.snapshot?.(e.targets, e.targetDigests);
    tombstonesReplayed += 1;
  }
  // 2) FTS 全量重建(从 active 投影;残影行天然消失,mem_id<->rowid 映射同步重建)
  const ledger = new MemoryLedger({ db, audit, ...(now ? { now } : {}) });
  const fts = new MemoryFts(db);
  fts.rebuild(ledger.project());
  audit.record({ actor: "daemon", action: "memory.recovery", meta: { tombstonesReplayed, ftsRows: fts.count() } });
  return { ledger, fts, tombstonesReplayed };
}
