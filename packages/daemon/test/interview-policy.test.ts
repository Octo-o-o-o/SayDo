// 3.1 验收(A4):预算耗尽必停;"值得问"词表与选项 2-5 代码层强制;覆盖扫描不重复问;
// Impact x Uncertainty 确定性排序;Quick 直通;golden 采访 3 条(真 Pack)+ Quick 直通 1 条。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Claim } from "@saydo/contracts";
import { openDb } from "../src/storage/db.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { compileContext, renderPackText, type CompileFact } from "../src/memory/compiler.js";
import {
  coverageScan,
  quickPassthrough,
  selectNext,
  validateCandidate,
  type QuestionCandidate
} from "../src/interview/policy.js";
import { checkGolden, type GoldenCase } from "../src/brain/golden.js";
import { PARAM_DEFAULTS } from "../src/config/types.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const TS = () => new Date("2026-07-24T00:00:00.000Z");
const NOW = "2026-07-24T12:00:00.000Z";

const q = (over: Partial<QuestionCandidate> & { id: string }): QuestionCandidate => ({
  text: "问题?",
  targetField: "scope",
  impact: 2,
  uncertainty: 2,
  ...over
});

describe("A4 选题:预算与停止(代码层强制)", () => {
  it("预算耗尽必停(缺省 8;stop 转 summarize_then_assess)", () => {
    const asked = new Set(Array.from({ length: PARAM_DEFAULTS.interview_question_budget }, (_, i) => `q${i}`));
    const d = selectNext([q({ id: "q_new", impact: 3, uncertainty: 3 })], asked, PARAM_DEFAULTS.interview_question_budget);
    expect(d.kind).toBe("stop");
    if (d.kind === "stop") {
      expect(d.reason).toBe("budget_exhausted");
      expect(d.transition).toBe("summarize_then_assess");
    }
  });

  it("无值得问的候选(全部已问)=> stop(no_worthy_question)", () => {
    const d = selectNext([q({ id: "q1" })], new Set(["q1"]), 8);
    expect(d.kind).toBe("stop");
    if (d.kind === "stop") expect(d.reason).toBe("no_worthy_question");
  });

  it("排序:Impact x Uncertainty 降序,critical_unknown 优先,id 终 tie-break(确定性)", () => {
    const d = selectNext(
      [
        q({ id: "q_b", impact: 2, uncertainty: 2 }),
        q({ id: "q_a", impact: 3, uncertainty: 3 }),
        q({ id: "q_c", impact: 3, uncertainty: 3, targetField: "critical_unknown" })
      ],
      new Set(),
      8
    );
    expect(d.kind).toBe("ask");
    if (d.kind === "ask") expect(d.question.id).toBe("q_c"); // 同分时 critical_unknown 先
  });

  it("选项 2-5 强制(04 §2.1):1 个或 6 个拒;recommendedIndex 越界拒;重复选项拒", () => {
    expect(() => validateCandidate(q({ id: "x", options: ["只有一个"] }))).toThrow(/2-5/);
    expect(() => validateCandidate(q({ id: "x", options: ["a", "b", "c", "d", "e", "f"] }))).toThrow(/2-5/);
    expect(() => validateCandidate(q({ id: "x", options: ["a", "b"], recommendedIndex: 2 }))).toThrow(/out of range/);
    expect(() => validateCandidate(q({ id: "x", options: ["a", "a"] }))).toThrow(/distinct/);
    expect(() => validateCandidate(q({ id: "x", options: ["财务对账", "用户自己下载"], recommendedIndex: 0 }))).not.toThrow();
  });
});

describe("A4 覆盖扫描:不重复问已有高置信答案", () => {
  const dims: Claim[] = [
    { text: "requirement:导出格式已确认 CSV", source: { kind: "user_utterance", ref: "t@1" }, confidence: "high", critical: false, state: "verified" },
    { text: "requirement:验收标准还没定", source: { kind: "user_utterance", ref: "t@2" }, confidence: "low", critical: false, state: "unknown" },
    { text: "knowledge:目标仓构建方式冲突", source: { kind: "repo_file", ref: "a@1" }, confidence: "med", critical: false, state: "conflicting" },
    { text: "requirement:删除范围涉及生产数据", source: { kind: "user_utterance", ref: "t@3" }, confidence: "low", critical: true, state: "unknown" }
  ];

  it("verified 不产生候选;unknown/conflicting 产生;critical => critical_unknown 3x3", () => {
    const cands = coverageScan(dims);
    expect(cands).toHaveLength(3);
    expect(cands.map((c) => c.targetField)).toEqual(["acceptance", "execution_path", "critical_unknown"]);
    const crit = cands[2] as QuestionCandidate;
    expect(crit.impact * crit.uncertainty).toBe(9);
    // 选题:critical 缺口最优先
    const d = selectNext(cands, new Set(), 8);
    if (d.kind === "ask") expect(d.question.targetField).toBe("critical_unknown");
  });
});

describe("Quick 直通(05 §4 P0 保证)", () => {
  it("已奠基 + 即刻指令 => 直通;未奠基/疑问句不直通", () => {
    expect(quickPassthrough({ utterance: "就做导出功能,现在", foundationGeneration: 1 })).toBe(true);
    expect(quickPassthrough({ utterance: "直接做,别问了", foundationGeneration: 2 })).toBe(true);
    expect(quickPassthrough({ utterance: "就做导出功能,现在", foundationGeneration: 0 })).toBe(false);
    expect(quickPassthrough({ utterance: "现在就做的话风险大吗?", foundationGeneration: 1 })).toBe(false);
    expect(quickPassthrough({ utterance: "帮我看看报表页", foundationGeneration: 1 })).toBe(false);
  });

  it("B-5(评审):否定上下文不直通(语义反转防线)", () => {
    expect(quickPassthrough({ utterance: "别直接做,先听我说", foundationGeneration: 1 })).toBe(false);
    expect(quickPassthrough({ utterance: "不要马上做", foundationGeneration: 1 })).toBe(false);
    expect(quickPassthrough({ utterance: "先别开干", foundationGeneration: 1 })).toBe(false);
    expect(quickPassthrough({ utterance: "这个先不直接做", foundationGeneration: 1 })).toBe(false);
    expect(quickPassthrough({ utterance: "好,直接做", foundationGeneration: 1 })).toBe(true);
  });

  it("B-6(评审):候选 id 内容派生——dims 变序后 askedIds 去重仍有效", () => {
    const dims: Claim[] = [
      { text: "requirement:验收标准还没定", source: { kind: "user_utterance", ref: "t@1" }, confidence: "low", critical: false, state: "unknown" },
      { text: "knowledge:构建方式冲突", source: { kind: "repo_file", ref: "a@1" }, confidence: "med", critical: false, state: "conflicting" }
    ];
    const first = coverageScan(dims);
    const reordered = coverageScan([...dims].reverse());
    // 同 claim 变序后 id 不变(内容派生)
    const ids1 = new Set(first.map((c) => c.id));
    for (const c of reordered) expect(ids1.has(c.id)).toBe(true);
    // 已问集在变序后仍去重:全部问过 ⇒ no_worthy_question(不重复问)
    const asked = new Set(first.map((c) => c.id));
    const d = selectNext(reordered, asked, 8);
    expect(d.kind).toBe("stop");
    if (d.kind === "stop") expect(d.reason).toBe("no_worthy_question");
  });
});

describe("3.1 golden(真 Context Pack;重跑 1.4 框架)", () => {
  function realPack() {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-g31-")), "saydo.db"));
    const ledger = new MemoryLedger({ db, audit: nullAudit, now: TS });
    ledger.add({
      tier: "M1",
      projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
      claim: "报表页已经有分页,还没有导出",
      source: { kind: "repo_file", ref: "src/report.tsx@abc" },
      gitTracked: true
    });
    ledger.add({
      tier: "M1",
      projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
      claim: "导出格式定为 CSV",
      source: { kind: "user_utterance", ref: "turn@3" },
      requestedTrust: "user_stated"
    });
    const facts: CompileFact[] = ledger.project();
    const snap = compileContext({
      sessionId: "ses_01AAAAAAAAAAAAAAAAAAAAAAAA",
      projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
      facts,
      topicTerms: ["导出", "报表"],
      memoryGeneration: 0,
      now: NOW
    });
    return { snap, text: renderPackText(snap, new Map(facts.map((f) => [f.id, f]))) };
  }

  it("真 Pack 编译成立且承载采访上下文(非桩)", () => {
    const { snap, text } = realPack();
    expect(snap.compilerVersion).toContain("b1/"); // 真编译器,非 b1-stub
    expect(snap.slices.length).toBeGreaterThan(0);
    expect(text).toContain("报表页已经有分页");
  });

  it("golden 采访 3 条(带预研结论问/预算停/选项式)+ Quick 直通 1 条", () => {
    const { text } = realPack();
    const golden: (GoldenCase & { packMustContain?: string[] })[] = [
      {
        id: "g31-1",
        scene: "#6 采访提问(带预研结论,真 Pack 事实)",
        utterance: "我看报表页已经有分页了,但还没有导出。这个导出是给财务对账,还是给用户自己下载?",
        mustContain: ["报表页", "导出", "?"],
        packMustContain: ["报表页已经有分页"]
      },
      {
        id: "g31-2",
        scene: "预算耗尽转摘要(A4 停止策略)",
        utterance: "问得差不多了,以我现在的理解先归纳:导出 CSV、给财务对账、Excel 能直开。我们看够不够开始。",
        mustContain: ["以我现在的理解"],
        mustNotContain: ["做完了"]
      },
      {
        id: "g31-3",
        scene: "选项式提问(2-5 互斥 + 推荐)",
        utterance: "验收口径三选一:第一,Excel 直接打开不乱码;第二,字段和后台一致就行;第三,两个都要。我推荐第三个。",
        mustContain: ["第一", "第二", "第三", "推荐"]
      },
      {
        id: "g31-quick",
        scene: "Quick 直通(已奠基即刻派单,不采访)",
        utterance: "好,底座是现成的,直接建卡开工,过程我盯着。",
        mustContain: ["直接建卡开工"],
        mustNotContain: ["先问", "?"]
      }
    ];
    for (const g of golden) {
      const r = checkGolden(g);
      expect(r.ok, `${g.id}: ${r.reasons.join(";")}`).toBe(true);
      for (const m of g.packMustContain ?? []) expect(text).toContain(m);
    }
  });
});
