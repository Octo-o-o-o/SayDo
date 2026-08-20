// G5 意图账本关联视图(计划 3.4;modules/a A7;Gate 0 G5):
// canonical intent 链 = 逐轮转写(turnRef)<-> 审批收据 <-> 任务卡,"谁说的 -> 签了什么 -> 执行了什么"可追。
// P0 不建独立账本表——关联视图(join 查询)即可(A7"不做");转写正文在 sessions/<id>.jsonl(turnRef 是锚)。

import type { Db } from "../storage/db.js";

export interface IntentLink {
  receiptId: string;
  kind: string;
  decidedVia: string;
  outcome: string;
  turnRef: string | null;
  sessionId: string | null;
  taskId: string | null;
  refDigest: string;
  issuedAt: string;
}

export interface IntentChain {
  links: IntentLink[];
  /** 任务侧(有 taskId 时):包引用与状态 */
  task?: { id: string; status: string; packageDigest: string };
}

const LINK_SELECT = `SELECT a.id AS receiptId, a.kind, a.decided_via AS decidedVia, a.outcome,
  a.turn_ref AS turnRef, a.session_id AS sessionId, a.task_id AS taskId, a.ref_digest AS refDigest,
  a.issued_at AS issuedAt FROM approvals a`;

/** 按任务追链:该任务的全部收据 + 任务包引用(贯通 join,§12 验收"贯通 join 查询") */
export function intentChainByTask(db: Db, taskId: string): IntentChain {
  const links = db.prepare(`${LINK_SELECT} WHERE a.task_id = ? ORDER BY a.issued_at`).all(taskId) as IntentLink[];
  const task = db.prepare("SELECT id, status, package_digest FROM tasks WHERE id = ?").get(taskId) as
    | { id: string; status: string; package_digest: string }
    | undefined;
  return {
    links,
    ...(task ? { task: { id: task.id, status: task.status, packageDigest: task.package_digest } } : {})
  };
}

/** 按转写轮追链:"这句话签了什么"(溯源问答 10 #37 的执行侧对偶) */
export function intentChainByTurn(db: Db, turnRef: string): IntentLink[] {
  return db.prepare(`${LINK_SELECT} WHERE a.turn_ref = ? ORDER BY a.issued_at`).all(turnRef) as IntentLink[];
}

/** 按包 digest 追链:"这个包被谁在哪一轮拍的板" */
export function intentChainByPackageDigest(db: Db, digest: string): IntentLink[] {
  return db
    .prepare(`${LINK_SELECT} WHERE a.ref_digest = ? OR a.parent_package_digest = ? ORDER BY a.issued_at`)
    .all(digest, digest) as IntentLink[];
}
