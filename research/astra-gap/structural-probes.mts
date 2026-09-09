// 只读评估探针：仅使用合成数据与临时数据库，不访问运行中实例或外部服务。
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decompose } from "../../packages/daemon/src/obs/latency.ts";
import { openDb, closeTrackedDatabases } from "../../packages/daemon/src/storage/db.ts";
import { createSqliteAuditSink } from "../../packages/daemon/src/storage/dao/misc.ts";
import { deriveExpectations } from "../../packages/console/src/hooks/redesign/mappers.ts";

const out: Record<string, unknown> = {};
const traces = Array.from({ length: 20 }, (_, i) => ({
  turnId: `synthetic-${i}`,
  vadEndMs: 0,
  asrFinalMs: 100,
  llmFirstTokenMs: 400,
  ttsFirstByteMs: 800,
  playoutStartMs: i < 16 ? 1000 : 10000
}));
const latency = decompose(traces);
assert.equal(latency.totalP90, 10000);
assert.equal(latency.slo.passPublish, true);
out.latency = { n: latency.n, p50: latency.totalP50, p90: latency.totalP90, passPublish: latency.slo.passPublish };

const expected = deriveExpectations([
  { id: "synthetic-artifact", kind: "text", role: "expected", title: "合成目标" }
] as Parameters<typeof deriveExpectations>[0], { revision: 1, direction: "合成方向" });
assert.deepEqual(expected?.[0]?.budget, { spent: 0, max: 0, currency: "CNY" });
out.unknownBudgetProjection = expected?.[0]?.budget;

const dir = mkdtempSync(join(tmpdir(), "saydo-astra-gap-"));
try {
  const dbPath = join(dir, "synthetic.db");
  let db = openDb(dbPath);
  const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as { version: number }[];
  out.schema = { count: versions.length, max: versions.at(-1)?.version };
  db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(9999, "2026-09-05T00:00:00.000Z");
  db.close();
  db = openDb(dbPath);
  out.futureSchema = { opened: true, futureMarker: db.prepare("SELECT version FROM schema_migrations WHERE version=9999").get() };

  const sink = createSqliteAuditSink(db);
  const marker = "synthetic-private-sentence-for-audit-probe";
  const entry = sink.record({ actor: "daemon", action: "dialog.result_phrase_blocked", meta: { text: marker } });
  const saved = db.prepare("SELECT meta_json FROM audit_log WHERE id=?").get(entry.id) as { meta_json: string };
  assert.equal(JSON.parse(saved.meta_json).text, marker);
  out.audit = { rawSentencePersisted: JSON.parse(saved.meta_json).text === marker, syntheticOnly: true };
  db.close();
} finally {
  closeTrackedDatabases();
  rmSync(dir, { recursive: true, force: true });
}
console.log(JSON.stringify(out, null, 2));
