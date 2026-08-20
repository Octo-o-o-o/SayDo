// §12-4 崩溃相位注入子进程:add 一条 -> 追加 forget_hard tombstone(相位一)-> 覆写前 SIGKILL。
// 用法:tsx memory-crash-child.ts <db-path>

import { newId, textDigest, type MemoryEvent } from "@saydo/contracts";
import { openDb } from "../../src/storage/db.js";
import { insertMemoryEvent } from "../../src/storage/dao/memory.js";

const dbPath = process.argv[2];
if (!dbPath) throw new Error("usage: memory-crash-child <db>");
const db = openDb(dbPath);
const TS0 = "2026-07-24T00:00:00Z";

const target: MemoryEvent = {
  id: newId("mem"),
  ts: TS0,
  op: "add",
  tier: "M1",
  claim: "将被遗忘的敏感事实",
  source: { kind: "user_edit", ref: "a@1" },
  trust: "auto_low_impact"
};
insertMemoryEvent(db, target);

// 相位一:追加 tombstone(已落盘)
const tombstone: MemoryEvent = {
  id: newId("mem"),
  ts: TS0,
  op: "forget_hard",
  tier: "M1",
  targets: [target.id],
  targetDigests: [textDigest("将被遗忘的敏感事实")],
  generation: 1,
  stores: ["fts", "projection", "summary", "backup"]
};
insertMemoryEvent(db, tombstone);

// 相位二(就地覆写)之前硬杀 —— 模拟崩溃在"tombstone 后/覆写前"
process.kill(process.pid, "SIGKILL");
