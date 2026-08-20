// 2.4 验收(热词):误听纠正 -> 热词生效(M0 user_stated 写入 -> biasTerms 词表 -> B1 topicTerms 并入使 digest 变化);
// forget 后热词消失;非法输入拒。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import { compileContext } from "../src/memory/compiler.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const TS = () => new Date("2026-07-24T00:00:00.000Z");
const NOW = "2026-07-24T12:00:00.000Z";

let db: Db;
let ledger: MemoryLedger;
let hotwords: HotwordStore;

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-hw-")), "saydo.db"));
  ledger = new MemoryLedger({ db, audit: nullAudit, now: TS });
  hotwords = new HotwordStore(ledger);
});

describe("M0 热词:误听纠正 -> 生效", () => {
  it("纠正写入 M0(user_stated),biasTerms 含 term 与 canonical", () => {
    const ev = hotwords.add("挖模式", "WAL 模式", "turn@12");
    expect(ev.op).toBe("add");
    if (ev.op === "add") expect(ev.trust).toBe("user_stated");

    expect(hotwords.list()).toEqual([{ term: "挖模式", canonical: "WAL 模式" }]);
    const bias = hotwords.biasTerms(["saydo"]);
    expect(bias).toContain("WAL 模式");
    expect(bias).toContain("挖模式");
    expect(bias).toContain("saydo");
    expect(bias).toEqual([...bias].sort()); // 确定性字典序
  });

  it("热词进 topicTerms 使 pack digest 变化(B1 接入:会话累积热词,09 §5)", () => {
    const base = {
      sessionId: "ses_01AAAAAAAAAAAAAAAAAAAAAAAA",
      projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
      facts: [],
      memoryGeneration: 0,
      now: NOW
    };
    const before = compileContext({ ...base, topicTerms: hotwords.biasTerms() });
    hotwords.add("赛读", "SayDo", "turn@3");
    const after = compileContext({ ...base, topicTerms: hotwords.biasTerms() });
    expect(after.topicTerms).toContain("SayDo");
    expect(after.packDigest).not.toBe(before.packDigest);
  });

  it("forget 后热词消失(账本通用路径)", () => {
    const ev = hotwords.add("库搜", "cursor", "turn@5");
    expect(hotwords.list()).toHaveLength(1);
    ledger.invalidate("forget_soft", [ev.id], "用户要求忘掉", "M0");
    expect(hotwords.list()).toHaveLength(0);
    expect(hotwords.biasTerms()).not.toContain("cursor");
  });

  it("非法输入拒:空词/含分隔符", () => {
    expect(() => hotwords.add("", "x", "t@1")).toThrow();
    expect(() => hotwords.add("a->b", "x", "t@1")).toThrow();
    expect(() => hotwords.add("x", " ", "t@1")).toThrow();
  });
});
