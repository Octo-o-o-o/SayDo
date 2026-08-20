// DAO:memory_events(docs/09 §4 判别联合 <-> §9 列映射)。
// 写路径策略(candidate->trusted / auto_low_impact 判定器 / forget_hard 传播)在 B2(2.1);本层只管持久化形状。

import type { MemoryEvent } from "@saydo/contracts";
import { memoryEventSchema } from "@saydo/contracts";
import type { Db } from "../db.js";

export function insertMemoryEvent(db: Db, e: MemoryEvent): void {
  memoryEventSchema.parse(e);
  const base = {
    id: e.id,
    ts: e.ts,
    op: e.op,
    tier: e.tier,
    projectId: e.projectId ?? null,
    claim: null as string | null,
    sourceJson: null as string | null,
    trust: null as string | null,
    taintJson: null as string | null,
    expiresAt: null as string | null,
    supersedes: null as string | null,
    payloadJson: null as string | null,
    generation: null as number | null,
    readinessKey: null as string | null
  };
  switch (e.op) {
    case "add":
    case "correct":
      base.claim = e.claim;
      base.sourceJson = JSON.stringify(e.source);
      base.trust = e.trust;
      base.taintJson = e.taint ? JSON.stringify(e.taint) : null;
      base.expiresAt = e.expiresAt ?? null;
      base.supersedes = e.supersedes ?? null;
      base.readinessKey = e.readinessKey ?? null;
      break;
    case "invalidate":
    case "forget_soft":
      base.payloadJson = JSON.stringify({ targets: e.targets, reason: e.reason });
      break;
    case "forget_hard":
      base.payloadJson = JSON.stringify({ targets: e.targets, targetDigests: e.targetDigests, stores: e.stores });
      base.generation = e.generation;
      break;
    case "consolidate":
      base.payloadJson = JSON.stringify({ mergedFrom: e.mergedFrom, into: e.into });
      break;
  }
  db.prepare(
    `INSERT INTO memory_events(id, ts, op, tier, project_id, claim, source_json, trust, taint_json, expires_at, supersedes, payload_json, generation, readiness_key)
     VALUES (@id, @ts, @op, @tier, @projectId, @claim, @sourceJson, @trust, @taintJson, @expiresAt, @supersedes, @payloadJson, @generation, @readinessKey)`
  ).run(base);
}

export function getMemoryEvent(db: Db, id: string): MemoryEvent | null {
  const row = db.prepare("SELECT * FROM memory_events WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToMemoryEvent(row);
}

export function listMemoryEvents(db: Db, projectId?: string): MemoryEvent[] {
  const rows = (
    projectId
      ? db.prepare("SELECT * FROM memory_events WHERE project_id = ? ORDER BY ts, id").all(projectId)
      : db.prepare("SELECT * FROM memory_events ORDER BY ts, id").all()
  ) as Record<string, unknown>[];
  return rows.map(rowToMemoryEvent);
}

function rowToMemoryEvent(row: Record<string, unknown>): MemoryEvent {
  const op = row["op"] as MemoryEvent["op"];
  const base = {
    id: row["id"],
    ts: row["ts"],
    op,
    tier: row["tier"],
    ...(row["project_id"] ? { projectId: row["project_id"] } : {})
  };
  if (op === "add" || op === "correct") {
    return memoryEventSchema.parse({
      ...base,
      claim: row["claim"],
      source: JSON.parse(row["source_json"] as string),
      trust: row["trust"],
      ...(row["taint_json"] ? { taint: JSON.parse(row["taint_json"] as string) } : {}),
      ...(row["expires_at"] ? { expiresAt: row["expires_at"] } : {}),
      ...(row["supersedes"] ? { supersedes: row["supersedes"] } : {}),
      ...(row["readiness_key"] ? { readinessKey: row["readiness_key"] } : {})
    });
  }
  const payload = JSON.parse((row["payload_json"] as string) ?? "{}") as Record<string, unknown>;
  if (op === "invalidate" || op === "forget_soft") {
    return memoryEventSchema.parse({ ...base, targets: payload["targets"], reason: payload["reason"] });
  }
  if (op === "forget_hard") {
    return memoryEventSchema.parse({
      ...base,
      targets: payload["targets"],
      targetDigests: payload["targetDigests"],
      generation: row["generation"],
      stores: payload["stores"]
    });
  }
  return memoryEventSchema.parse({ ...base, mergedFrom: payload["mergedFrom"], into: payload["into"] });
}
