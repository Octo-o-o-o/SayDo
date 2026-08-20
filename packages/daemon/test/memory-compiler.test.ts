// 2.2 验收(B1):同输入同 digest(含输入顺序无关);excluded 记录(third_party/expired/M0 门/预算);
// 预算截断序(critical > ts 新先);candidate 只读标注(渲染);snapshot 落盘幂等。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { verifyPackDigest } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import {
  compileContext,
  estimateTokens,
  renderPackText,
  DEFAULT_BUDGETS,
  type CompileFact,
  type CompileInput
} from "../src/memory/compiler.js";
import { recordContextSnapshotUse, getContextSnapshot, listSnapshotUses } from "../src/storage/dao/snapshots.js";

const NOW = "2026-07-24T12:00:00.000Z";

/** 手造可控时间前缀的 id:"mem_" + 10 字符时间段 + 尾缀(与 ULID 排序假设同构) */
const mid = (ts: string, tail = "AAAAAAAAAAAAAAAA") => `mem_${ts}${tail}`;

const fact = (over: Partial<CompileFact> & { id: string; claim: string }): CompileFact => ({
  tier: "M1",
  trust: "user_stated",
  source: { kind: "user_utterance", ref: "turn@1" },
  ...over
});

const baseInput = (facts: CompileFact[], over?: Partial<CompileInput>): CompileInput => ({
  sessionId: "ses_01AAAAAAAAAAAAAAAAAAAAAAAA",
  projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
  facts,
  topicTerms: ["导出", "CSV"],
  memoryGeneration: 3,
  now: NOW,
  ...over
});

describe("B1 编译器:确定性(规则⑤)", () => {
  const facts = [
    fact({ id: mid("0000000001"), claim: "导出格式用 CSV" }),
    fact({ id: mid("0000000002"), claim: "验收标准是 Excel 能直接打开", trust: "user_approved" }),
    fact({ id: mid("0000000003"), claim: "构建工具是 pnpm", trust: "auto_low_impact", taint: ["repo_file"] })
  ];

  it("同输入同 digest;facts/topicTerms 顺序与重复不影响 digest", () => {
    const a = compileContext(baseInput(facts));
    const b = compileContext(baseInput([...facts].reverse(), { topicTerms: ["CSV", "导出", "CSV", " 导出 "] }));
    expect(a.packDigest).toBe(b.packDigest);
    expect(a.topicTerms).toEqual(["CSV", "导出"]); // 规范化:去空/去重/字典序
    expect(verifyPackDigest(a)).toBeNull();
  });

  it("签名域变化 ⇒ digest 变(memoryGeneration/budgets);元数据 sessionId 不影响", () => {
    const a = compileContext(baseInput(facts));
    const gen = compileContext(baseInput(facts, { memoryGeneration: 4 }));
    const budget = compileContext(baseInput(facts, { budgets: { ...DEFAULT_BUDGETS, M1: 999 } }));
    const session = compileContext(baseInput(facts, { sessionId: "ses_01BBBBBBBBBBBBBBBBBBBBBBBB" }));
    expect(gen.packDigest).not.toBe(a.packDigest);
    expect(budget.packDigest).not.toBe(a.packDigest);
    expect(session.packDigest).toBe(a.packDigest);
  });
});

describe("M7 前缀稳定性(规则⑥⑦ + prefix-diff 验收)", () => {
  it("装配序恒定:稳定段(M0/M1)refs 按 id 字典序;易变段(M2/M3)后置;segment/prefixDigest 标注", () => {
    const facts = [
      fact({ id: mid("0000000003"), claim: "M1 事实丙", tier: "M1" }),
      fact({ id: mid("0000000001"), claim: "M1 事实甲", tier: "M1" }),
      fact({ id: mid("0000000005"), claim: "M0 偏好", tier: "M0" }),
      fact({ id: mid("0000000009"), claim: "M3 会话轮", tier: "M3" })
    ];
    const snap = compileContext(baseInput(facts));
    const m1 = snap.slices.find((s) => s.tier === "M1")!;
    expect(m1.segment).toBe("stable");
    expect(m1.refs).toEqual([mid("0000000001"), mid("0000000003")]); // 字典序,非入选序
    expect(m1.prefixDigest).toBeDefined();
    const m3 = snap.slices.find((s) => s.tier === "M3");
    if (m3) {
      expect(m3.segment).toBe("topical");
      expect(m3.form).toBe("verbatim"); // verbatimM3Ids 未给 => 全 verbatim
      expect(m3.prefixDigest).toBeUndefined(); // 易变段不计前缀
    }
  });

  it("prefix-diff 验收:相邻两次编译,易变字段(topical/M3)变化,稳定段 prefixDigest 不变", () => {
    const stable = [fact({ id: mid("0000000001"), claim: "稳定偏好", tier: "M0" }), fact({ id: mid("0000000002"), claim: "稳定项目事实", tier: "M1" })];
    const a = compileContext(baseInput([...stable, fact({ id: mid("0000000008"), claim: "本轮话题 A", tier: "M3" })], { topicTerms: ["A"] }));
    const b = compileContext(baseInput([...stable, fact({ id: mid("0000000009"), claim: "下轮话题 B", tier: "M3" })], { topicTerms: ["B"] }));
    const prefixA = a.slices.filter((s) => s.segment === "stable").map((s) => s.prefixDigest);
    const prefixB = b.slices.filter((s) => s.segment === "stable").map((s) => s.prefixDigest);
    expect(prefixA).toEqual(prefixB); // 稳定前缀跨轮不变(前缀缓存红利)
    expect(a.packDigest).not.toBe(b.packDigest); // 易变段不同 => 整体 digest 不同(确定性仍成立)
  });

  it("parentPackDigest 入签名:父 pack 不同 ⇒ 子 digest 不同(纯函数性)", () => {
    const facts = [fact({ id: mid("0000000001"), claim: "事实" })];
    const base = compileContext(baseInput(facts));
    const withParent = compileContext(baseInput(facts, { parentPackDigest: "sha256:" + "a".repeat(64) } as never));
    expect(withParent.parentPackDigest).toBe("sha256:" + "a".repeat(64));
    expect(withParent.packDigest).not.toBe(base.packDigest);
  });
});

describe("B1 编译器:excluded 记录(规则①②③)", () => {
  it("third_party 默认排除;expired 记 excluded(freshness);M0 门(trust/taint)", () => {
    const snap = compileContext(
      baseInput([
        fact({ id: mid("0000000001"), claim: "正常事实" }),
        fact({ id: mid("0000000002"), claim: "第三方内容", trust: "third_party" }),
        fact({ id: mid("0000000003"), claim: "过期事实", expiresAt: "2026-07-01T00:00:00.000Z" }),
        fact({ id: mid("0000000004"), claim: "候选想进 M0", tier: "M0", trust: "candidate" }),
        fact({ id: mid("0000000005"), claim: "带 taint 想进 M0", tier: "M0", taint: ["repo_file"] })
      ])
    );
    const reasons = new Map(snap.excluded.map((e) => [e.ref, e.reason]));
    expect(reasons.get(mid("0000000002"))).toBe("third_party");
    expect(reasons.get(mid("0000000003"))).toBe("expired");
    expect(reasons.get(mid("0000000004"))).toBe("m0_gate_trust");
    expect(reasons.get(mid("0000000005"))).toBe("m0_gate_taint");
    const packed = snap.slices.flatMap((s) => s.refs);
    expect(packed).toEqual([mid("0000000001")]);
  });

  it("auto_low_impact 带 taint 可进 M1(taint 只在 M0 是硬门)", () => {
    const snap = compileContext(
      baseInput([fact({ id: mid("0000000001"), claim: "构建工具是 pnpm", trust: "auto_low_impact", taint: ["repo_file"] })])
    );
    expect(snap.slices.find((s) => s.tier === "M1")?.refs).toEqual([mid("0000000001")]);
    expect(snap.excluded).toEqual([]);
  });
});

describe("B1 编译器:预算截断(规则④)", () => {
  it("超预算截断:critical 先保,再按 ts 新先;被裁进 excluded(budget_M1)", () => {
    // 每条 claim 4 个 CJK 字 ≈ 4 token;预算 M1=8 ⇒ 只装得下 2 条
    const oldCritical = fact({ id: mid("0000000001"), claim: "红线不动摇", critical: true });
    const oldPlain = fact({ id: mid("0000000002"), claim: "旧的事实" });
    const newPlain = fact({ id: mid("0000000003"), claim: "新的事实" });
    const snap = compileContext(
      baseInput([oldPlain, newPlain, oldCritical], { budgets: { M0: 200, M1: 9, M2: 800, M3: 800 } })
    );
    const m1 = snap.slices.find((s) => s.tier === "M1");
    expect(m1?.refs).toEqual([oldCritical.id, newPlain.id]); // critical 最先;其后 ts 新先
    expect(snap.excluded).toEqual([{ ref: oldPlain.id, reason: "budget_M1" }]);
  });

  it("B-2:首超即截断——低优先级小事实不得越过被裁的高优先级(装箱反转防线)", () => {
    // M1 预算 10:user_stated 9-token(最新)入选;user_stated 4-token 首超 => 截断;
    // user_approved 1-token 若入选即规则①反转(评审已实证的缺陷形态)
    const bigStated = fact({ id: mid("0000000003"), claim: "九个汉字的既定长事实" }); // 同 trust 内 ts 新先
    const smallStated = fact({ id: mid("0000000002"), claim: "四字事实" });
    const tinyApproved = fact({ id: mid("0000000001"), claim: "好", trust: "user_approved" });
    const snap = compileContext(
      baseInput([tinyApproved, smallStated, bigStated], { budgets: { M0: 200, M1: 10, M2: 800, M3: 800 } })
    );
    const m1 = snap.slices.find((s) => s.tier === "M1");
    expect(m1?.refs).toEqual([bigStated.id]); // 截断点之后(含更低优先级)一个都不进
    const excludedRefs = snap.excluded.map((e) => e.ref);
    expect(excludedRefs).toContain(smallStated.id);
    expect(excludedRefs).toContain(tinyApproved.id);
  });

  it("estimateTokens:CJK 每字 1,ASCII 每 4 字符 1(确定性)", () => {
    expect(estimateTokens("四个汉字")).toBe(4);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("导出 CSV")).toBe(2 + 1); // 2 CJK + " CSV"(4 chars)
  });
});

describe("B1 渲染:candidate 只读标注 + taint 标注", () => {
  it("renderPackText 标注 candidate 与 taint", () => {
    const facts = [
      fact({ id: mid("0000000001"), claim: "既定决定" }),
      fact({ id: mid("0000000002"), claim: "网上看到的做法", trust: "candidate", taint: ["web"] })
    ];
    const snap = compileContext(baseInput(facts));
    const text = renderPackText(snap, new Map(facts.map((f) => [f.id, f])));
    expect(text).toContain("- 既定决定");
    expect(text).toContain("[候选未确认] [taint:web] 网上看到的做法");
  });
});

describe("snapshot 落盘(context_snapshots)", () => {
  let db: Db;
  beforeEach(() => {
    db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-snap-")), "saydo.db"));
  });

  it("M1 拆表:内容幂等 upsert(同 digest 1 行)+ 使用记录如实各记(同毫秒不去重,B6);回读 digest 校验 null", () => {
    const snap = compileContext(baseInput([fact({ id: mid("0000000001"), claim: "导出格式用 CSV" })]));
    recordContextSnapshotUse(db, snap, NOW);
    recordContextSnapshotUse(db, snap, NOW); // 同 session 同 used_at:使用记录各记一行(审计计数如实)
    const contentN = (db.prepare("SELECT COUNT(*) AS c FROM context_snapshots").get() as { c: number }).c;
    expect(contentN).toBe(1); // 内容表幂等
    expect(listSnapshotUses(db, snap.sessionId)).toHaveLength(2);
    // 另一会话用同一 pack(重建 digest 一致场景):内容仍 1 行,使用记录各记
    const snap2 = { ...snap, sessionId: "ses_01BBBBBBBBBBBBBBBBBBBBBBBB" };
    recordContextSnapshotUse(db, snap2, "2026-07-24T13:00:00.000Z", { rebuild: true });
    expect((db.prepare("SELECT COUNT(*) AS c FROM context_snapshots").get() as { c: number }).c).toBe(1);
    expect(listSnapshotUses(db, "ses_01BBBBBBBBBBBBBBBBBBBBBBBB")[0]?.rebuild).toBe(true);
    const back = getContextSnapshot(db, snap.packDigest);
    expect(back).toBeDefined();
    expect(verifyPackDigest(back as NonNullable<typeof back>)).toBeNull();
  });
});
