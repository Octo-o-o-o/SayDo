// 2.2 验收(B5):FTS 命中带 provenance;freshness 硬过滤(过期/已删不出);rg 现读;MATCH 组装转义。

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { MemoryFts } from "../src/memory/fts.js";
import { Retrieval, buildMatchQuery } from "../src/memory/retrieval.js";
import type { AuditSink } from "../src/obs/audit.js";
import { textDigest } from "@saydo/contracts";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const TS = () => new Date("2026-07-24T00:00:00.000Z");

let db: Db;
let ledger: MemoryLedger;
let fts: MemoryFts;
let retrieval: Retrieval;

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-ret-")), "saydo.db"));
  ledger = new MemoryLedger({ db, audit: nullAudit, now: TS });
  fts = new MemoryFts(db);
  retrieval = new Retrieval(fts, ledger);
});

describe("buildMatchQuery", () => {
  it("每词引号短语 OR 连接;内部引号转义;空词滤除", () => {
    expect(buildMatchQuery(["导出功能", "CSV"])).toBe('"导出功能" OR "CSV"');
    expect(buildMatchQuery([' a"b ', "", "  "])).toBe('"a""b"');
    expect(buildMatchQuery([])).toBe("");
  });
});

describe("B5 知识库检索:provenance + freshness", () => {
  it("FTS 命中带 provenance(source/trust)与相关度分", () => {
    const ev = ledger.add({
      tier: "M1",
      claim: "导出功能的格式定为 CSV",
      source: { kind: "user_utterance", ref: "turn@7" },
      requestedTrust: "user_stated"
    });
    fts.rebuild(ledger.project());
    const hits = retrieval.searchKnowledge(["导出功能"]);
    expect(hits).toHaveLength(1);
    const hit = hits[0] as NonNullable<(typeof hits)[0]>;
    expect(hit.id).toBe(ev.id);
    expect(hit.source).toEqual({ kind: "user_utterance", ref: "turn@7" });
    expect(hit.trust).toBe("user_stated");
    expect(typeof hit.score).toBe("number");
  });

  it("freshness 硬过滤:expiresAt 到期后即使 FTS 残影仍不出结果", () => {
    ledger.add({
      tier: "M1",
      claim: "临时约定下周失效",
      source: { kind: "user_utterance", ref: "turn@8" },
      expiresAt: "2026-07-30T00:00:00.000Z"
    });
    fts.rebuild(ledger.project());
    expect(retrieval.searchKnowledge(["临时约定"], { now: "2026-07-25T00:00:00.000Z" })).toHaveLength(1);
    // 时间推到过期后:FTS 行还在(残影),active 集合已滤 ⇒ 硬过滤兜住
    expect(retrieval.searchKnowledge(["临时约定"], { now: "2026-08-01T00:00:00.000Z" })).toHaveLength(0);
  });

  it("forget_hard 后不出结果(FTS 删除 + 账本覆写双保险)", () => {
    const ev = ledger.add({ tier: "M1", claim: "要被彻底遗忘的偏好", source: { kind: "user_utterance", ref: "turn@9" } });
    fts.rebuild(ledger.project());
    expect(retrieval.searchKnowledge(["彻底遗忘"])).toHaveLength(1);
    ledger.forgetHard({
      targets: [ev.id],
      targetDigests: [textDigest("要被彻底遗忘的偏好")],
      stores: ["fts"],
      tier: "M1",
      execute: {
        fts: (ids) => fts.deleteByIds(ids),
        projection: () => undefined,
        summary: () => undefined,
        backup: () => undefined
      }
    });
    expect(retrieval.searchKnowledge(["彻底遗忘"])).toHaveLength(0);
  });
});

describe("B5 仓库现读(rg)", () => {
  it("命中文件行;无匹配返回空数组(exit 1 非错误)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-repo-"));
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "export.ts"), "export function exportCsv() {}\n// 导出功能入口\n");
    const hits = await retrieval.searchRepo(["导出功能"], dir);
    expect(hits).toHaveLength(1);
    const hit = hits[0] as NonNullable<(typeof hits)[0]>;
    expect(hit.file).toContain("export.ts");
    expect(hit.line).toBe(2);
    expect(hit.text).toContain("导出功能入口");
    expect(await retrieval.searchRepo(["不存在的词组合"], dir)).toEqual([]);
  });

  it("retrieve 双源合流:knowledge 与 repo 同回且来源可区分", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-repo2-"));
    writeFileSync(join(dir, "a.md"), "验收标准写在这里\n");
    ledger.add({ tier: "M1", claim: "验收标准是 Excel 能打开", source: { kind: "user_utterance", ref: "turn@1" } });
    fts.rebuild(ledger.project());
    const r = await retrieval.retrieve(["验收标准"], dir);
    expect(r.knowledge.length).toBeGreaterThan(0);
    expect(r.repo.length).toBeGreaterThan(0);
  });
});
