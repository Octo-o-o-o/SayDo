// DAO + 两阶段写基元:dispatch_bindings / hopper_commands(docs/09 §6.2;G2 的 0.3 半边)。
// 写序:先 INSERT(in-flight)-> 副作用 -> 回填 outcome/state;重启扫 in-flight 行用原 idemKey 重放。
// 真实 drop/CLI 调用属 P0.5-B;本层基元 + 崩溃重放扫描是 P0 关闭 G2 的"基元级证据"。

import type { DispatchBinding, HopperCommand, HopperCommandOp, HopperCommandState } from "@saydo/contracts";
import { dispatchBindingSchema, hopperCommandSchema, HOPPER_COMMAND_TRANSITIONS } from "@saydo/contracts";
import type { Db } from "../db.js";

/** 阶段一:落 binding(dropOutcome 缺省 = NULL = in-flight) */
export function beginDispatchBinding(db: Db, b: Omit<DispatchBinding, "dropOutcome">): void {
  dispatchBindingSchema.parse(b);
  db.prepare(
    `INSERT INTO dispatch_bindings(voice_task_id, dispatch_id, idem_key, package_digest, mode, hopper_json, drop_outcome, created_at)
     VALUES (@voiceTaskId, @dispatchId, @idemKey, @packageDigest, @mode, @hopperJson, NULL, @createdAt)`
  ).run({
    voiceTaskId: b.voiceTaskId,
    dispatchId: b.dispatchId,
    idemKey: b.idempotencyKey,
    packageDigest: b.packageDigest,
    mode: b.mode,
    hopperJson: b.hopper ? JSON.stringify(b.hopper) : null,
    createdAt: b.createdAt
  });
}

/** 阶段二:副作用完成后回填 outcome */
export function completeDispatchBinding(
  db: Db,
  voiceTaskId: string,
  outcome: NonNullable<DispatchBinding["dropOutcome"]>
): void {
  const r = db
    .prepare("UPDATE dispatch_bindings SET drop_outcome = ? WHERE voice_task_id = ? AND drop_outcome IS NULL")
    .run(outcome, voiceTaskId);
  if (r.changes === 0) throw new Error(`no in-flight binding for ${voiceTaskId} (already completed or missing)`);
}

export function getDispatchBinding(db: Db, voiceTaskId: string): DispatchBinding | null {
  const row = db.prepare("SELECT * FROM dispatch_bindings WHERE voice_task_id = ?").get(voiceTaskId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return dispatchBindingSchema.parse({
    voiceTaskId: row["voice_task_id"],
    dispatchId: row["dispatch_id"],
    idempotencyKey: row["idem_key"],
    packageDigest: row["package_digest"],
    mode: row["mode"],
    ...(row["hopper_json"] ? { hopper: JSON.parse(row["hopper_json"] as string) } : {}),
    ...(row["drop_outcome"] ? { dropOutcome: row["drop_outcome"] } : {}),
    createdAt: row["created_at"]
  });
}

/** 崩溃重放扫描:NULL 行 = in-flight,用原 idemKey 重放(09 §6.2) */
export function scanInflightBindings(db: Db): DispatchBinding[] {
  const rows = db.prepare("SELECT voice_task_id FROM dispatch_bindings WHERE drop_outcome IS NULL").all() as {
    voice_task_id: string;
  }[];
  return rows.map((r) => getDispatchBinding(db, r.voice_task_id)).filter((b): b is DispatchBinding => b !== null);
}

/** hopper_commands journal:intent -> sent -> confirmed;失败可 sent 重试(原 idemKey) */
export function beginHopperCommand(
  db: Db,
  c: Omit<HopperCommand, "state" | "updatedAt"> & { createdAt: string }
): void {
  hopperCommandSchema.parse({ ...c, state: "intent", updatedAt: c.createdAt });
  db.prepare(
    `INSERT INTO hopper_commands(id, task_id, op, idem_key, payload_digest, receipt_id, state, created_at, updated_at)
     VALUES (@id, @taskId, @op, @idemKey, @payloadDigest, @receiptId, 'intent', @createdAt, @createdAt)`
  ).run({
    id: c.id,
    taskId: c.taskId,
    op: c.op,
    idemKey: c.idemKey,
    payloadDigest: c.payloadDigest,
    receiptId: c.receiptId ?? null,
    createdAt: c.createdAt
  });
}

export function transitionHopperCommand(db: Db, id: string, to: HopperCommandState, now: string): void {
  const row = db.prepare("SELECT state FROM hopper_commands WHERE id = ?").get(id) as
    | { state: HopperCommandState }
    | undefined;
  if (!row) throw new Error(`hopper command not found: ${id}`);
  if (!HOPPER_COMMAND_TRANSITIONS[row.state].includes(to)) {
    throw new Error(`illegal hopper command transition ${row.state} -> ${to}`);
  }
  db.prepare("UPDATE hopper_commands SET state = ?, updated_at = ? WHERE id = ?").run(to, now, id);
}

/** 崩溃重放扫描:!= confirmed 的行按原 idemKey 重放(09 §6.2) */
export function scanUnconfirmedCommands(db: Db): HopperCommand[] {
  const rows = db.prepare("SELECT * FROM hopper_commands WHERE state != 'confirmed'").all() as Record<string, unknown>[];
  return rows.map((row) =>
    hopperCommandSchema.parse({
      id: row["id"],
      taskId: row["task_id"],
      op: row["op"] as HopperCommandOp,
      idemKey: row["idem_key"],
      payloadDigest: row["payload_digest"],
      ...(row["receipt_id"] ? { receiptId: row["receipt_id"] } : {}),
      state: row["state"],
      createdAt: row["created_at"],
      updatedAt: row["updated_at"]
    })
  );
}

/** Tier1 崩溃重放扫描:非终态 run(reserved/running/step_paused/cancel_requested)待恢复(§12-7 Tier1 子集) */
export function scanInterruptedTier1Runs(db: Db): { id: string; taskId: string; state: string; adapter: string; nativeSessionId: string | null; cwd: string }[] {
  return db
    .prepare(
      `SELECT id, task_id AS taskId, state, adapter, native_session_id AS nativeSessionId, cwd
       FROM tier1_runs WHERE state IN ('reserved','running','step_paused','cancel_requested')`
    )
    .all() as { id: string; taskId: string; state: string; adapter: string; nativeSessionId: string | null; cwd: string }[];
}
