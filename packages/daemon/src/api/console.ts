// D1 控制台只读 API(计划 5.1/5.2;08 §6 信息架构;09 §7 投影词表)。
// 全部 GET/JSON、SQLite 直投、G1 身份门内(index.ts 统一校验)。
// 派生态(11 §2.6:TaskView 呈现态 = 持久态 ∪ 派生态,不写回 tasks.status):
//   parked = (blocked|ready_for_review) ∧ parked_deadline 非空。
// one_liner:P0 未持久化到 tasks(摘要器按 evidenceDigest 缓存),卡片回退最近审计一句话。

import {
  OPEN_SET,
  acceptanceExactSetViolations,
  jcsDigest,
  mobileFocusDetailSchema,
  mobileFocusListItemSchema,
  tier1TerminalAuditActionSchema,
  tier1SettleProofSchema,
  writingSettleProofSchema,
  type AcceptanceCheck,
  type Artifact,
  type MobileFocusDetail,
  type MobileFocusListItem,
  type Tier1TerminalAuditAction
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { MemoryLedger } from "../memory/ledger.js";
import type { AuditSink } from "../obs/audit.js";
import { basename } from "node:path";
import {
  ARTIFACT_CONTENT_MAX_BYTES,
  ArtifactCorruptError,
  ArtifactMissingError,
  ArtifactTooLargeError,
  type ArtifactStore
} from "../artifacts/store.js";
import { diffLines } from "../artifacts/diff.js";
import { redactText } from "../voice/redactor.js";

const OPEN_SET_SQL = OPEN_SET.map((s) => `'${s}'`).join(",");

export interface TaskRowView {
  id: string;
  projectId: string;
  title: string;
  route: string;
  status: string; // 持久态
  viewStatus: string; // 呈现态(含派生 parked)
  attempt: number;
  budget: { walltimeActiveMin: number; maxTurns: number; maxCost: number } | null;
  parkedDeadline: string | null;
  updatedAt: string;
}

function deriveViewStatus(status: string, parkedDeadline: string | null): string {
  if (parkedDeadline && (status === "blocked" || status === "ready_for_review")) return "parked";
  return status;
}

interface TaskDbRow {
  id: string;
  project_id: string;
  title: string;
  route: string;
  status: string;
  budget_json: string | null;
  parked_deadline: string | null;
  updated_at: string;
  attempt: number | null;
}

const TASK_SELECT = `
  SELECT t.id, t.project_id, t.title, t.route, t.status, t.budget_json, t.parked_deadline, t.updated_at,
         (SELECT MAX(attempt) FROM tier1_runs r WHERE r.task_id = t.id) AS attempt
  FROM tasks t`;

function toTaskView(r: TaskDbRow): TaskRowView {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    route: r.route,
    status: r.status,
    viewStatus: deriveViewStatus(r.status, r.parked_deadline),
    attempt: r.attempt ?? 0,
    budget: r.budget_json ? (JSON.parse(r.budget_json) as TaskRowView["budget"]) : null,
    parkedDeadline: r.parked_deadline,
    updatedAt: r.updated_at
  };
}

export interface ProjectCard {
  id: string;
  title: string;
  type: string;
  status: string;
  workspace: string | null;
  taskCounts: Record<string, number>;
}

function projectCards(db: Db): ProjectCard[] {
  return (
    db.prepare("SELECT id, title, type, status, workspace_json FROM projects ORDER BY created_at DESC").all() as {
      id: string;
      title: string;
      type: string;
      status: string;
      workspace_json: string;
    }[]
  ).map((p) => {
    const counts = db
      .prepare("SELECT status, COUNT(*) AS c FROM tasks WHERE project_id = ? GROUP BY status")
      .all(p.id) as { status: string; c: number }[];
    const ws = JSON.parse(p.workspace_json) as { path?: string };
    return {
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      workspace: ws.path ?? null,
      taskCounts: Object.fromEntries(counts.map((x) => [x.status, x.c]))
    };
  });
}

/** Dashboard:项目卡 + 「待你处理」聚合(ready_for_review > 审批 > blocked > 回叫未读,11 §3) */
export function getOverview(db: Db): {
  projects: ProjectCard[];
  pending: { readyForReview: TaskRowView[]; approvals: number; blocked: TaskRowView[]; unreadCallbacks: number };
} {
  const ready = (db.prepare(`${TASK_SELECT} WHERE t.status = 'ready_for_review' ORDER BY t.updated_at DESC`).all() as TaskDbRow[]).map(toTaskView);
  const blocked = (db.prepare(`${TASK_SELECT} WHERE t.status = 'blocked' ORDER BY t.updated_at DESC`).all() as TaskDbRow[]).map(toTaskView);
  const approvals = (db.prepare("SELECT COUNT(*) AS c FROM approvals WHERE outcome = 'pending'").get() as { c: number }).c;
  const unread = (
    db.prepare("SELECT COUNT(*) AS c FROM callback_outbox WHERE state IN ('pending','notified')").get() as { c: number }
  ).c;
  return { projects: projectCards(db), pending: { readyForReview: ready, approvals, blocked, unreadCallbacks: unread } };
}

/** 任务看板(按项目;队列/执行中/等验收/已交付分列由前端按 viewStatus 分组) */
export function getProjectTasks(db: Db, projectId: string): TaskRowView[] {
  return (db.prepare(`${TASK_SELECT} WHERE t.project_id = ? ORDER BY t.updated_at DESC`).all(projectId) as TaskDbRow[]).map(toTaskView);
}

/** 任务详情 = 任务 + 决策包(验收标准)+ runs + 该任务审批记录 + 成本(11 §5.5 证据视图数据) */
export function getTaskDetail(db: Db, taskId: string): Record<string, unknown> | null {
  const task = db
    .prepare(
      `SELECT t.id, t.project_id, t.package_id, t.package_rev, t.package_digest, t.title, t.spec_markdown, t.route,
              t.status, t.cancel_reason, t.adapter, t.cwd, t.budget_json, t.parked_deadline, t.created_at, t.updated_at,
              p.type AS project_type
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ?`
    )
    .get(taskId) as Record<string, unknown> | undefined;
  if (!task) return null;
  const pkg = db
    .prepare("SELECT body_json FROM decision_packages WHERE id = ? AND revision = ?")
    .get(task["package_id"], task["package_rev"]) as { body_json: string } | undefined;
  const packageBody = pkg ? (JSON.parse(pkg.body_json) as { acceptance?: unknown }) : null;
  const packageAcceptance = Array.isArray(packageBody?.acceptance)
    ? packageBody.acceptance.flatMap((criterion) => {
        if (typeof criterion === "string" && criterion !== "") return [criterion];
        if (typeof criterion !== "object" || criterion === null) return [];
        const legacy = criterion as { text?: unknown; criterion?: unknown };
        const text = typeof legacy.text === "string" ? legacy.text : legacy.criterion;
        return typeof text === "string" && text !== "" ? [text] : [];
      })
    : [];
  const runs = db
    .prepare(
      `SELECT id, attempt, adapter, state, worktree_path, cwd, tree_sha, decisions_json, settle_proof_json, created_at, updated_at
       FROM tier1_runs WHERE task_id = ? ORDER BY attempt`
    )
    .all(taskId) as Record<string, unknown>[];
  const runEvidence = new Map<
    string,
    { action: Tier1TerminalAuditAction; observedModel?: string; exitEvidence?: string }[]
  >();
  const evidenceRows = db
    .prepare(
      `SELECT action, meta_json FROM audit_log
       WHERE action IN ('tier1.settled_review','tier1.failed','tier1.blocked')
         AND json_valid(meta_json)
         AND json_extract(meta_json, '$.taskId') = ?
       ORDER BY ts, id`
    )
    .all(taskId) as { action: unknown; meta_json: string }[];
  for (const row of evidenceRows) {
    try {
      const action = tier1TerminalAuditActionSchema.parse(row.action);
      const meta = JSON.parse(row.meta_json) as Record<string, unknown>;
      const runId = typeof meta["runId"] === "string" ? meta["runId"] : null;
      if (!runId) continue;
      const evidence: {
        action: Tier1TerminalAuditAction;
        observedModel?: string;
        exitEvidence?: string;
      } = { action };
      if (typeof meta["observedModel"] === "string" && meta["observedModel"] !== "") {
        evidence.observedModel = meta["observedModel"];
      }
      if (typeof meta["exitEvidence"] === "string" && meta["exitEvidence"] !== "") {
        evidence.exitEvidence = meta["exitEvidence"];
      }
      const entries = runEvidence.get(runId) ?? [];
      entries.push(evidence);
      runEvidence.set(runId, entries);
    } catch {
      // 审计坏行不影响任务详情其余证据;该 run 如实显示“未观测”。
    }
  }
  const runsWithEvidence = runs.map((run) => {
    const entries = runEvidence.get(String(run["id"])) ?? [];
    const state = String(run["state"]);
    const evidence = entries.length === 1 ? entries[0] : undefined;
    const stateMatches =
      evidence !== undefined &&
      ((state === "settled_review" && evidence.action === "tier1.settled_review") ||
        (state === "settled_failed" && (evidence.action === "tier1.failed" || evidence.action === "tier1.blocked")));
    const conflict = entries.length > 0 && (!evidence || !stateMatches);
    const validEvidence = stateMatches ? evidence : undefined;
    return {
      ...run,
      observed_model: validEvidence?.observedModel ?? null,
      exit_evidence: validEvidence?.exitEvidence ?? null,
      terminal_audit_action: validEvidence?.action ?? null,
      evidence_conflict: conflict
    };
  });
  // W4 3.2 writing:最新 attempt 的 WritingSettleProof(逐条裁决 UI 用;11 §5.5 settled ≠ 全绿)
  let writingProof: unknown = null;
  let acceptanceChecks: AcceptanceCheck[] = packageAcceptance.map((criterion) => ({
    criterion,
    status: "unknown",
    source: "manual"
  }));
  const latestProofJson = runs.length > 0 ? (runs[runs.length - 1]?.["settle_proof_json"] as string | null) : null;
  if (latestProofJson) {
    try {
      const p = JSON.parse(latestProofJson) as { kind?: string };
      if (p.kind === "writing") {
        const parsed = writingSettleProofSchema.parse(p);
        writingProof = parsed;
        acceptanceChecks = parsed.acceptanceChecks;
        const review = db
          .prepare(
            `SELECT id, actor, meta_json FROM audit_log
             WHERE action='task.review_approve'
               AND json_valid(meta_json)
               AND json_extract(meta_json, '$.taskId')=?
             ORDER BY ts DESC, id DESC LIMIT 1`
          )
          .get(taskId) as { id: string; actor: string; meta_json: string } | undefined;
        const approvalStillEffective = ["review_approved_waiting_merge", "merging", "task_done"].includes(
          String(task["status"])
        );
        if (approvalStillEffective && review?.actor === "owner") {
          const meta = JSON.parse(review.meta_json) as Record<string, unknown>;
          const manualCount = parsed.acceptanceChecks.filter((check) => check.source === "manual").length;
          const exactCoverage = acceptanceExactSetViolations(parsed.acceptanceChecks, packageAcceptance).length === 0;
          if (
            exactCoverage &&
            meta["kind"] === "writing" &&
            meta["evidenceDigest"] === jcsDigest(parsed) &&
            meta["prospectiveTreeSha"] === parsed.treeSha &&
            meta["attempt"] === parsed.attempt &&
            meta["acceptancePassed"] === manualCount
          ) {
            acceptanceChecks = parsed.acceptanceChecks.map((check) =>
              check.source === "manual"
                ? { ...check, status: "pass", evidenceRef: `audit:${review.id}` }
                : check
            );
          }
        }
      } else {
        const parsed = tier1SettleProofSchema.parse(p);
        const exactCoverage = acceptanceExactSetViolations(parsed.acceptanceChecks, packageAcceptance).length === 0;
        // 旧 proof 缺字段或集合漂移时只可信 DecisionPackage 的 criterion，状态全部 unknown。
        if (exactCoverage) acceptanceChecks = parsed.acceptanceChecks;
      }
    } catch {
      writingProof = null;
    }
  }
  // W5a 3.2:decisions 区(11 §5.5 证据视图内)——最新 attempt 的落库决策(与语音 explainResult 同源)
  const latestDecisionsJson = runs.length > 0 ? (runs[runs.length - 1]?.["decisions_json"] as string | null) : null;
  let decisions: unknown[] = [];
  if (latestDecisionsJson) {
    try {
      decisions = JSON.parse(latestDecisionsJson) as unknown[];
    } catch {
      decisions = [];
    }
  }
  const approvals = db
    .prepare(
      `SELECT id, kind, risk, decided_via, auth_strength, outcome, issued_at, decided_at
       FROM approvals WHERE task_id = ? ORDER BY issued_at`
    )
    .all(taskId);
  const costs = db
    .prepare("SELECT kind, amount, currency, known, source, meta_json, ts FROM cost_entries WHERE task_id = ? ORDER BY ts")
    .all(taskId);
  return {
    task: { ...task, viewStatus: deriveViewStatus(String(task["status"]), (task["parked_deadline"] as string | null) ?? null) },
    package: packageBody,
    runs: runsWithEvidence,
    approvals,
    costs,
    decisions,
    acceptanceChecks,
    writingProof // null = 非 writing;否则含 sectionCoverage/acceptanceChecks 供逐条裁决 UI
  };
}

/** 项目记忆(M1-M3 活跃投影,走账本投影器——规则②否定不复活等语义单源;M0 用户档案在全局设置页) */
export function getProjectMemory(db: Db, audit: AuditSink, projectId: string): Record<string, unknown>[] {
  const ledger = new MemoryLedger({ db, audit });
  return ledger
    .project()
    .filter((m) => m.tier !== "M0" && m.projectId === projectId)
    .map((m) => ({
      id: m.id,
      tier: m.tier,
      claim: m.claim,
      trust: m.trust,
      source: m.source,
      taint: m.taint ?? [],
      expiresAt: m.expiresAt ?? null
    }));
}

export function getProjectArtifacts(db: Db, projectId: string): Record<string, unknown>[] {
  return db
    .prepare(
      "SELECT id, version, type, path, digest, supersedes_json, tags_json, source, created_at FROM artifacts WHERE project_id = ? ORDER BY created_at DESC"
    )
    .all(projectId) as Record<string, unknown>[];
}

// ---------- W5a 3.6:产物库控制面(modules/b B4 P1:时间线在前端按 id 分组;此处 diff + 子集导出) ----------

/** 相邻(或任意两)版本文本 diff;digest 重校走 ArtifactStore.read(损坏如实报错不静默) */
export function getArtifactDiff(
  db: Db,
  store: ArtifactStore,
  artifactId: string,
  fromVersion: number,
  toVersion: number
): Record<string, unknown> {
  const from = store.read(artifactId, fromVersion);
  const to = store.read(artifactId, toVersion);
  const d = diffLines(from.content, to.content);
  return {
    artifactId,
    from: { version: fromVersion, digest: from.artifact.digest },
    to: { version: toVersion, digest: to.artifact.digest },
    truncated: d.truncated,
    lines: d.lines
  };
}

/**
 * 子集导出(选中产物打包下载):JSON bundle(零依赖,不引 zip;内容带 digest 可独立核验)。
 * 项目归属断言:items 里不属于该项目的产物一律拒(不给跨项目枚举面)。
 */
export function exportArtifacts(
  db: Db,
  store: ArtifactStore,
  projectId: string,
  items: { id: string; version: number }[],
  nowIso: string
): Record<string, unknown> {
  if (items.length === 0) throw new Error("导出清单为空");
  if (items.length > 100) throw new Error("单次导出上限 100 项");
  const artifacts = items.map(({ id, version }) => {
    const owner = db.prepare("SELECT project_id FROM artifacts WHERE id=? AND version=?").get(id, version) as
      | { project_id: string }
      | undefined;
    if (!owner) throw new Error(`artifact not found: ${id} v${version}`);
    if (owner.project_id !== projectId) throw new Error(`artifact ${id} 不属于项目 ${projectId}(拒跨项目导出)`);
    const { artifact, content } = store.read(id, version); // digest 重校
    return {
      id: artifact.id,
      version: artifact.version,
      type: artifact.type,
      digest: artifact.digest,
      tags: artifact.tags,
      source: artifact.source,
      createdAt: artifact.createdAt,
      supersedes: artifact.supersedes ?? null,
      content
    };
  });
  return { kind: "saydo-artifact-bundle", exportedAt: nowIso, projectId, count: artifacts.length, artifacts };
}

export class ArtifactAccessError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 413;
  readonly code: string;
  constructor(status: 400 | 403 | 404 | 409 | 413, code: string, message: string) {
    super(message);
    this.name = "ArtifactAccessError";
    this.status = status;
    this.code = code;
  }
}

/**
 * 只读产物内容(S1 Demo 小样 iframe srcdoc)。
 * 归属断言与 exportArtifacts 同级:artifact.projectId 必须等于请求项目且该项目存在。
 * digest 重校失败 ⇒ 409;内容超 1 MB(读前 stat)⇒ 413;文件缺失 ⇒ 404。
 * 响应 path 只回 basename,不泄露本机绝对路径。mobile_lan 不进白名单,由身份门 403。
 */
export function getArtifactContent(
  db: Db,
  store: ArtifactStore,
  artifactId: string,
  version: number,
  projectId: string
): { artifact: Artifact; content: string } {
  if (!projectId) {
    throw new ArtifactAccessError(400, "project_required", "读取产物需要项目归属");
  }
  const owner = db.prepare("SELECT project_id FROM artifacts WHERE id=? AND version=?").get(artifactId, version) as
    | { project_id: string }
    | undefined;
  if (!owner) {
    throw new ArtifactAccessError(404, "artifact_not_found", `artifact not found: ${artifactId} v${version}`);
  }
  const visible = db.prepare("SELECT 1 FROM projects WHERE id=?").get(owner.project_id);
  if (!visible) {
    throw new ArtifactAccessError(404, "artifact_not_found", `artifact not found: ${artifactId} v${version}`);
  }
  if (owner.project_id !== projectId) {
    throw new ArtifactAccessError(403, "artifact_project_mismatch", `artifact ${artifactId} 不属于项目 ${projectId}(拒跨项目读取)`);
  }
  let artifact: Artifact;
  let content: string;
  try {
    ({ artifact, content } = store.read(artifactId, version, { maxBytes: ARTIFACT_CONTENT_MAX_BYTES }));
  } catch (err) {
    if (err instanceof ArtifactCorruptError) {
      throw new ArtifactAccessError(409, "artifact_corrupt", err.message);
    }
    if (err instanceof ArtifactTooLargeError) {
      throw new ArtifactAccessError(413, "artifact_too_large", "产物内容超过 1 MB 上限");
    }
    if (err instanceof ArtifactMissingError) {
      throw new ArtifactAccessError(404, "artifact_not_found", `artifact not found: ${artifactId} v${version}`);
    }
    throw err;
  }
  return { artifact: { ...artifact, path: basename(artifact.path) }, content };
}

/** 审批中心(全项目聚合,每卡必带项目/任务上下文,04 §5.2) */
export function getApprovals(db: Db, projectId?: string): Record<string, unknown>[] {
  const base = `
    SELECT a.id, a.kind, a.risk, a.decided_via, a.auth_strength, a.outcome, a.effect, a.issued_at, a.expires_at, a.decided_at,
           a.task_id, t.title AS task_title, t.project_id, p.title AS project_title
    FROM approvals a
    LEFT JOIN tasks t ON t.id = a.task_id
    LEFT JOIN projects p ON p.id = t.project_id`;
  const rows = projectId
    ? db.prepare(`${base} WHERE t.project_id = ? ORDER BY a.issued_at DESC LIMIT 200`).all(projectId)
    : db.prepare(`${base} ORDER BY a.issued_at DESC LIMIT 200`).all();
  return rows as Record<string, unknown>[];
}

/** 回叫与通知时间线(升级链 daemon 级,天然全局) */
export function getOutbox(db: Db): Record<string, unknown>[] {
  return db
    .prepare(
      `SELECT o.id, o.task_id, o.trigger, o.state, o.resolution, o.escalation, o.notified_at, o.acked_at,
              o.resolved_at, o.snoozed_until, o.created_at, t.title AS task_title, t.project_id
       FROM callback_outbox o LEFT JOIN tasks t ON t.id = o.task_id
       ORDER BY o.created_at DESC LIMIT 200`
    )
    .all() as Record<string, unknown>[];
}

/** 成本账本(按项目分组下钻;unknown 永不显示 0——unknownCount 单列,前端照 11 §2.6"还没有确切数字")。
 *  known 合计**分币种**(Hopper 路径二行是 USD,appendix §3.1;混币种合计=编数)。 */
export function getCosts(db: Db): {
  byProject: { projectId: string | null; projectTitle: string | null; knownByCurrency: Record<string, number>; unknownCount: number }[];
  entries: Record<string, unknown>[];
} {
  const rows = db
    .prepare(
      `SELECT c.project_id AS projectId, p.title AS projectTitle, c.currency AS currency,
              SUM(CASE WHEN c.known = 1 THEN c.amount ELSE 0 END) AS knownTotal,
              SUM(CASE WHEN c.known = 0 THEN 1 ELSE 0 END) AS unknownCount
       FROM cost_entries c LEFT JOIN projects p ON p.id = c.project_id
       GROUP BY c.project_id, c.currency`
    )
    .all() as { projectId: string | null; projectTitle: string | null; currency: string | null; knownTotal: number; unknownCount: number }[];
  const byKey = new Map<string, { projectId: string | null; projectTitle: string | null; knownByCurrency: Record<string, number>; unknownCount: number }>();
  for (const r of rows) {
    const key = r.projectId ?? "(none)";
    const agg = byKey.get(key) ?? { projectId: r.projectId, projectTitle: r.projectTitle, knownByCurrency: {}, unknownCount: 0 };
    if (r.knownTotal > 0 && r.currency) agg.knownByCurrency[r.currency] = (agg.knownByCurrency[r.currency] ?? 0) + r.knownTotal;
    agg.unknownCount += r.unknownCount;
    byKey.set(key, agg);
  }
  const byProject = [...byKey.values()];
  const entries = db
    .prepare(
      "SELECT id, ts, project_id, task_id, session_id, kind, amount, currency, known, source, meta_json FROM cost_entries ORDER BY ts DESC LIMIT 300"
    )
    .all() as Record<string, unknown>[];
  return { byProject, entries };
}

/** 项目设置(projects 行;project.toml 白名单域已在 config 层校验)+ 覆盖(W5a 3.5 受控表) */
export function getProjectSettings(db: Db, projectId: string): Record<string, unknown> | null {
  const row = db
    .prepare(
      "SELECT id, title, type, status, workspace_json, exec_mode_default, reanchored_to, created_at, updated_at FROM projects WHERE id = ?"
    )
    .get(projectId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const ov = db.prepare("SELECT overrides_json, updated_at FROM project_settings WHERE project_id = ?").get(projectId) as
    | { overrides_json: string; updated_at: string }
    | undefined;
  let overrides: unknown = null;
  if (ov) {
    try {
      overrides = JSON.parse(ov.overrides_json);
    } catch {
      overrides = null;
    }
  }
  return { ...row, overrides, overrides_updated_at: ov?.updated_at ?? null };
}

/** C7 Focus 列表(只读):lifecycle / currentRevision / 未结义务数 / space / direction */
export type FocusOpenByOwner = { human: number; agent: number; external: number };

export function getFocusList(db: Db): MobileFocusListItem[] {
  const rows = db
    .prepare(
      `WITH four_state AS (
         SELECT focus_id,
                SUM(CASE WHEN status IN ('resolved','superseded') THEN 0
                         WHEN status = 'blocked' OR owner = 'human' THEN 0
                         WHEN status = 'in_progress' THEN 0 ELSE 1 END) AS queued_count,
                SUM(CASE WHEN status = 'in_progress' AND owner <> 'human' THEN 1 ELSE 0 END) AS running_count,
                SUM(CASE WHEN status NOT IN ('resolved','superseded')
                              AND (status = 'blocked' OR owner = 'human') THEN 1 ELSE 0 END) AS needs_you_count,
                SUM(CASE WHEN status IN ('resolved','superseded') THEN 1 ELSE 0 END) AS settled_count
         FROM focus_obligations
         GROUP BY focus_id
       )
       SELECT f.id, f.title, f.lifecycle, f.current_revision, f.semantic_authority, f.updated_at,
              f.space_id,
              COALESCE(fs.queued_count,0) + COALESCE(fs.running_count,0) + COALESCE(fs.needs_you_count,0) AS open_count,
              COALESCE(fs.queued_count,0) AS queued_count,
              COALESCE(fs.running_count,0) AS running_count,
              COALESCE(fs.needs_you_count,0) AS needs_you_count,
              COALESCE(fs.settled_count,0) AS settled_count,
              (SELECT s.current_direction FROM focus_states s
               WHERE s.focus_id = f.id
               ORDER BY s.revision DESC LIMIT 1) AS direction
       FROM focuses f
       LEFT JOIN four_state fs ON fs.focus_id = f.id
       ORDER BY f.updated_at DESC
       LIMIT 200`
    )
    .all() as Array<{
    id: string;
    title: string;
    lifecycle: string;
    current_revision: number;
    semantic_authority: string;
    updated_at: string;
    open_count: number;
    queued_count: number;
    running_count: number;
    needs_you_count: number;
    settled_count: number;
    space_id: string | null;
    direction: string | null;
  }>;

  const ownerCounts = db
    .prepare(
      `SELECT focus_id, owner, COUNT(*) AS c
       FROM focus_obligations
       WHERE status IN (${OPEN_SET_SQL})
       GROUP BY focus_id, owner`
    )
    .all() as Array<{ focus_id: string; owner: string; c: number }>;
  const byFocusOwner = new Map<string, FocusOpenByOwner>();
  for (const r of ownerCounts) {
    let bucket = byFocusOwner.get(r.focus_id);
    if (!bucket) {
      bucket = { human: 0, agent: 0, external: 0 };
      byFocusOwner.set(r.focus_id, bucket);
    }
    if (r.owner === "human" || r.owner === "agent" || r.owner === "external") {
      bucket[r.owner] = r.c;
    }
  }

  // 与 getFocusDetail.repos 同源:removed_at IS NULL 的活跃 project 引用
  const refRows = db
    .prepare(
      `SELECT focus_id, project_id FROM focus_project_refs
       WHERE removed_at IS NULL
       ORDER BY focus_id, project_id`
    )
    .all() as Array<{ focus_id: string; project_id: string }>;
  const refsByFocus = new Map<string, string[]>();
  for (const r of refRows) {
    const list = refsByFocus.get(r.focus_id);
    if (list) list.push(r.project_id);
    else refsByFocus.set(r.focus_id, [r.project_id]);
  }

  return mobileFocusListItemSchema.array().parse(rows.map((r) => ({
    id: r.id,
    title: r.title,
    lifecycle: r.lifecycle,
    currentRevision: r.current_revision,
    semanticAuthority: r.semantic_authority,
    openObligationCount: r.open_count,
    openByOwner: byFocusOwner.get(r.id) ?? { human: 0, agent: 0, external: 0 },
    fourState: {
      queued: r.queued_count,
      running: r.running_count,
      needsYou: r.needs_you_count,
      settled: r.settled_count
    },
    projectRefs: refsByFocus.get(r.id) ?? [],
    updatedAt: r.updated_at,
    spaceId: r.space_id,
    direction: r.direction
  })));
}

/** C7/批 3 Focus 详情:义务 + 方向 + 航迹所需 events/lanes/repos/artifacts */
export function getFocusDetail(
  db: Db,
  focusId: string
): {
  focus: {
    id: string;
    title: string;
    lifecycle: string;
    currentRevision: number;
    semanticAuthority: string;
    authorityEpoch: number;
    updatedAt: string;
    direction: string | null;
    openObligationCount: number;
    spaceId: string | null;
  };
  obligations: Array<{
    id: string;
    kind: string;
    title: string;
    owner: string;
    status: string;
    verification: string;
    blocking: boolean;
    nextStep: string | null;
    detail: string | null;
    needs: string | null;
    laneId: string | null;
    waitingOn: string | null;
    waitingOnObligationId: string | null;
    createdFromEvent: number | null;
    actionRef: string | null;
  }>;
  lanes: Array<{
    id: string;
    title: string;
    parentLaneId: string | null;
    createdFromEvent: number;
    retiredAt: string | null;
  }>;
  events: Array<{
    id: string;
    seq: number;
    type: string;
    payload: unknown;
    actorKind: string;
    sessionId: string | null;
    createdAt: string;
  }>;
  repos: Array<{ projectId: string; note: string | null }>;
  artifacts: Array<{
    id: string;
    kind: string;
    role: string;
    title: string;
    ref: unknown;
  }>;
} | null {
  const f = db
    .prepare(
      `SELECT id, title, lifecycle, current_revision, semantic_authority, authority_epoch, updated_at, space_id
       FROM focuses WHERE id = ?`
    )
    .get(focusId) as
    | {
        id: string;
        title: string;
        lifecycle: string;
        current_revision: number;
        semantic_authority: string;
        authority_epoch: number;
        updated_at: string;
        space_id: string | null;
      }
    | undefined;
  if (!f) return null;
  const directionRow = db
    .prepare(
      `SELECT current_direction FROM focus_states WHERE focus_id = ? ORDER BY revision DESC LIMIT 1`
    )
    .get(focusId) as { current_direction: string } | undefined;
  const obs = db
    .prepare(
      `SELECT id, kind, title, owner, status, verification, blocking, next_step, detail, needs,
              lane_id, waiting_on, waiting_on_obligation_id, created_from_event, action_ref
       FROM focus_obligations WHERE focus_id = ? ORDER BY created_at, id`
    )
    .all(focusId) as Array<{
    id: string;
    kind: string;
    title: string;
    owner: string;
    status: string;
    verification: string;
    blocking: number;
    next_step: string | null;
    detail: string | null;
    needs: string | null;
    lane_id: string | null;
    waiting_on: string | null;
    waiting_on_obligation_id: string | null;
    created_from_event: number | null;
    action_ref: string | null;
  }>;
  const openCount = obs.filter((o) =>
    ["open", "in_progress", "waiting", "deferred", "blocked"].includes(o.status)
  ).length;
  let lanes: Array<{
    id: string;
    title: string;
    parentLaneId: string | null;
    createdFromEvent: number;
    retiredAt: string | null;
  }> = [];
  try {
    const laneRows = db
      .prepare(
        `SELECT id, title, parent_lane_id, created_from_event, retired_at
         FROM focus_lanes WHERE focus_id = ? ORDER BY created_from_event, id`
      )
      .all(focusId) as Array<{
      id: string;
      title: string;
      parent_lane_id: string | null;
      created_from_event: number;
      retired_at: string | null;
    }>;
    lanes = laneRows.map((r) => ({
      id: r.id,
      title: r.title,
      parentLaneId: r.parent_lane_id,
      createdFromEvent: r.created_from_event,
      retiredAt: r.retired_at
    }));
  } catch {
    lanes = [];
  }
  const eventRows = db
    .prepare(
      `SELECT id, seq, type, payload_json, actor_kind, session_id, created_at
       FROM focus_events WHERE focus_id = ? ORDER BY seq ASC`
    )
    .all(focusId) as Array<{
    id: string;
    seq: number;
    type: string;
    payload_json: string;
    actor_kind: string;
    session_id: string | null;
    created_at: string;
  }>;
  const repos = db
    .prepare(
      `SELECT project_id, note FROM focus_project_refs
       WHERE focus_id = ? AND removed_at IS NULL`
    )
    .all(focusId) as Array<{ project_id: string; note: string | null }>;
  let artifacts: Array<{ id: string; kind: string; role: string; title: string; ref: unknown }> = [];
  try {
    const artRows = db
      .prepare(
        `SELECT id, kind, role, title, ref_json FROM focus_artifacts WHERE focus_id = ? ORDER BY created_at, id`
      )
      .all(focusId) as Array<{
      id: string;
      kind: string;
      role: string;
      title: string;
      ref_json: string;
    }>;
    artifacts = artRows.map((a) => ({
      id: a.id,
      kind: a.kind,
      role: a.role,
      title: a.title,
      ref: JSON.parse(a.ref_json) as unknown
    }));
  } catch {
    artifacts = [];
  }
  return {
    focus: {
      id: f.id,
      title: f.title,
      lifecycle: f.lifecycle,
      currentRevision: f.current_revision,
      semanticAuthority: f.semantic_authority,
      authorityEpoch: f.authority_epoch,
      updatedAt: f.updated_at,
      direction: directionRow?.current_direction ?? null,
      openObligationCount: openCount,
      spaceId: f.space_id
    },
    obligations: obs.map((o) => ({
      id: o.id,
      kind: o.kind,
      title: o.title,
      owner: o.owner,
      status: o.status,
      verification: o.verification,
      blocking: o.blocking === 1,
      nextStep: o.next_step,
      detail: o.detail,
      needs: o.needs,
      laneId: o.lane_id,
      waitingOn: o.waiting_on,
      waitingOnObligationId: o.waiting_on_obligation_id,
      createdFromEvent: o.created_from_event,
      actionRef: o.action_ref
    })),
    lanes,
    events: eventRows.map((e) => ({
      id: e.id,
      seq: e.seq,
      type: e.type,
      payload: (() => {
        try {
          return JSON.parse(e.payload_json) as unknown;
        } catch {
          return {};
        }
      })(),
      actorKind: e.actor_kind,
      sessionId: e.session_id,
      createdAt: e.created_at
    })),
    repos: repos.map((r) => ({ projectId: r.project_id, note: r.note })),
    artifacts
  };
}

/** M1 LAN 只返回移动页面实际消费的 Focus 字段，原始事件/产物/仓路径不出明文边界。 */
export function getMobileFocusDetail(db: Db, focusId: string): MobileFocusDetail | null {
  const detail = getFocusDetail(db, focusId);
  if (!detail) return null;
  return mobileFocusDetailSchema.parse({
    focus: detail.focus,
    obligations: detail.obligations,
    lanes: detail.lanes,
    events: detail.events.map((event) => {
      const source = event.payload && typeof event.payload === "object"
        ? (event.payload as Record<string, unknown>)
        : {};
      const payload: Record<string, unknown> = {};
      if (typeof source["title"] === "string") payload["title"] = redactText(source["title"]);
      if (typeof source["revision"] === "number" || typeof source["revision"] === "string") {
        payload["revision"] = typeof source["revision"] === "string" ? redactText(source["revision"]) : source["revision"];
      }
      return {
        id: event.id,
        seq: event.seq,
        type: event.type,
        payload,
        actorKind: event.actorKind,
        createdAt: event.createdAt
      };
    })
  });
}

/** GET /api/focuses/:id/sessions —— 该 focus 关联会话(primary_focus_id) */
export function getFocusSessions(
  db: Db,
  focusId: string
): {
  sessions: Array<{
    id: string;
    state: string;
    startedAt: string;
    closedAt: string | null;
    summary: string | null;
  }>;
} | null {
  const f = db.prepare("SELECT id FROM focuses WHERE id = ?").get(focusId);
  if (!f) return null;
  const rows = db
    .prepare(
      `SELECT id, state, started_at, ended_at
       FROM sessions WHERE primary_focus_id = ?
       ORDER BY started_at DESC LIMIT 50`
    )
    .all(focusId) as Array<{
    id: string;
    state: string;
    started_at: string;
    ended_at: string | null;
  }>;
  return {
    sessions: rows.map((s) => ({
      id: s.id,
      state: s.state,
      startedAt: s.started_at,
      closedAt: s.ended_at,
      summary: null
    }))
  };
}
