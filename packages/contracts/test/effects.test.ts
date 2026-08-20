// §12-2 预授权反例(Tier1 校验器子集 = ①-⑤/⑨/⑩;grant 实例类⑥⑦⑧随 P0.5-C)+ renderSpoken 模板。

import { describe, expect, it } from "vitest";
import { renderSpoken, validateDispatch, validateGrants, gate0Closed } from "../src/effects.js";
import { computeGrantDigest } from "../src/digests.js";
import { buildInstallGrant, buildPushGrant, buildPackage } from "./helpers.js";

const GATE0_CLOSED = { enabled: true, bypass: false };
const NOW = "2026-07-24T12:00:00Z"; // 固件包 expiresAt=2026-07-31,NOW 在有效期内

function requestedOf(pkg: ReturnType<typeof buildPackage>, over: Partial<{ revision: number; digest: string; mode: "direct_to_review" | "step_confirm"; route: "tier1" | "hopper" }> = {}) {
  return {
    packageId: pkg.id,
    revision: over.revision ?? pkg.revision,
    digest: over.digest ?? pkg.digest,
    mode: over.mode ?? pkg.mode,
    route: over.route ?? ("tier1" as const)
  };
}

describe("renderSpoken(10 §4.1 照抄模板)", () => {
  it("install_dependency 模板", () => {
    expect(renderSpoken("install_dependency", { packages: ["a", "b"], environment: "worktree" }, "none")).toBe(
      "装 a,b 这2个依赖"
    );
  });
  it("push_branch 模板 + downstream 必念", () => {
    expect(renderSpoken("push_branch", { branchPattern: "saydo/T-1-*", environment: "worktree" }, "ci_preview")).toBe(
      "推到 saydo/T-1-* 分支,会触发预览部署"
    );
    expect(renderSpoken("push_branch", { branchPattern: "saydo/T-1-*", environment: "worktree" }, "none")).toBe(
      "推到 saydo/T-1-* 分支"
    );
  });
  it("必填约束缺失 / effect 不在表内 => 抛错", () => {
    expect(() => renderSpoken("install_dependency", { environment: "worktree" }, "none")).toThrow();
    expect(() => renderSpoken("push_branch", { environment: "worktree" }, "none")).toThrow();
    expect(() => renderSpoken("deploy" as never, { environment: "worktree" }, "none")).toThrow();
  });
});

describe("§12-2 预授权反例(整包拒签/拒 dispatch)", () => {
  it("反例① route=hopper 且 grants 非空 => 拒 dispatch", () => {
    const pkg = buildPackage({ mode: "direct_to_review" }, [buildInstallGrant()]);
    const r = validateDispatch({
      pkg,
      requested: requestedOf(pkg, { route: "hopper" }),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: NOW
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toContain("route=hopper");
  });

  it("反例② step_confirm 包携带 grants => 拒签", () => {
    const r = validateGrants([buildInstallGrant()], { mode: "step_confirm" });
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toContain("step_confirm");
  });

  it("反例③ effect 枚举外 => 整包拒签", () => {
    const bogus = { ...buildInstallGrant(), effect: "deploy_prod" as never };
    const r = validateGrants([bogus], { mode: "direct_to_review" });
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toContain("whitelist");
  });

  it("反例④ 必填约束缺任一 => 整包拒签(install 缺 packages / push 缺 branchPattern)", () => {
    const g1 = buildInstallGrant();
    const noPkgs = {
      ...g1,
      constraints: { environment: "worktree" as const }
    };
    noPkgs.grantDigest = computeGrantDigest(noPkgs);
    const r1 = validateGrants([noPkgs], { mode: "direct_to_review" });
    expect(r1.ok).toBe(false);
    expect(r1.reasons.join()).toContain("packages");

    const g2 = buildPushGrant();
    const noBranch = { ...g2, constraints: { environment: "worktree" as const } };
    noBranch.grantDigest = computeGrantDigest(noBranch);
    const r2 = validateGrants([noBranch], { mode: "direct_to_review" });
    expect(r2.ok).toBe(false);
    expect(r2.reasons.join()).toContain("branchPattern");
  });

  it("反例④b 整包拒签不静默剔除:一条坏 grant 拖垮整包,好 grant 不放行", () => {
    const good = buildInstallGrant();
    const bad = { ...buildPushGrant(), constraints: { environment: "worktree" as const }, grantDigest: "" };
    const r = validateGrants([good, bad as never], { mode: "direct_to_review" });
    expect(r.ok).toBe(false);
  });

  it("反例⑤ spokenForm != 重渲染 => 拒签(禁改写/扩大)", () => {
    const g = buildInstallGrant();
    const forged = { ...g, spokenForm: g.spokenForm + ",顺便删点东西" };
    forged.grantDigest = computeGrantDigest(forged);
    const r = validateGrants([forged], { mode: "direct_to_review" });
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toContain("spokenForm");
  });

  it("branchPattern 命中保护分支 => 拒签(缺省 main/master;§12-2 ⑥的校验器面)", () => {
    const g = buildPushGrant("main");
    const r = validateGrants([g], { mode: "direct_to_review" });
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toContain("protected");

    const wildcard = buildPushGrant("*");
    const r2 = validateGrants([wildcard], { mode: "direct_to_review" });
    expect(r2.ok).toBe(false);
  });

  it("反例⑨ package revision/digest 漂移 => 拒 dispatch", () => {
    const pkg = buildPackage();
    const r = validateDispatch({
      pkg,
      requested: requestedOf(pkg, { revision: pkg.revision - 0 + 1 }),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: NOW
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toContain("revision drift");

    const r2 = validateDispatch({
      pkg,
      requested: requestedOf(pkg, { digest: "sha256:" + "0".repeat(64) }),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: NOW
    });
    expect(r2.ok).toBe(false);
  });

  it("反例⑩ Gate 0 未关 => 拒 dispatch(enabled=false 或 bypass=true 均拒,无 bypass 分支)", () => {
    const pkg = buildPackage();
    for (const gate0 of [
      { enabled: false, bypass: false },
      { enabled: true, bypass: true },
      { enabled: false, bypass: true }
    ]) {
      const r = validateDispatch({
        pkg,
        requested: requestedOf(pkg),
        gate0,
        currentEffectPolicyVersion: "e2-v1",
        now: NOW
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("gate0_open");
    }
    expect(gate0Closed({ enabled: true, bypass: false })).toBe(true);
  });

  it("effectPolicyVersion 变 => 旧包拒 dispatch(§12-1 子项,需重签)", () => {
    const pkg = buildPackage();
    const r = validateDispatch({
      pkg,
      requested: requestedOf(pkg),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v2",
      now: NOW
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toContain("effectPolicyVersion");
  });

  it("mode 与包签署不符 => 拒(模式随包签署,04 §5.4)", () => {
    const pkg = buildPackage(); // step_confirm(无 grants)
    const r = validateDispatch({
      pkg,
      requested: requestedOf(pkg, { mode: "direct_to_review" }),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: NOW
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toContain("mode mismatch");
  });

  it("正例:合法 direct_to_review 包(含合法 grants)通过", () => {
    const pkg = buildPackage({ mode: "direct_to_review" }, [buildInstallGrant(), buildPushGrant()]);
    const r = validateDispatch({
      pkg,
      requested: requestedOf(pkg),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: NOW
    });
    expect(r).toEqual({ ok: true });
  });

  it("正例:合法 step_confirm 包(零 grants)通过", () => {
    const pkg = buildPackage();
    const r = validateDispatch({
      pkg,
      requested: requestedOf(pkg),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: NOW
    });
    expect(r).toEqual({ ok: true });
  });

  it("过期包拒 dispatch(评审 A2 反例:now 越过 expiresAt)", () => {
    const pkg = buildPackage(); // expiresAt=2026-07-31T00:00:00Z
    const r = validateDispatch({
      pkg,
      requested: requestedOf(pkg),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: "2026-08-01T00:00:00Z"
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toContain("expired");
  });

  it("混合时区形态判定正确(评审 A2:字典序与时间序相反的用例)", () => {
    // expiresAt=+08:00 形态(=2026-07-24T15:00:00Z);now=16:00Z 已过期,但字符串比较会误判未过期
    const pkg = buildPackage({ expiresAt: "2026-07-24T23:00:00+08:00" });
    const r = validateDispatch({
      pkg,
      requested: requestedOf(pkg),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: "2026-07-24T16:00:00Z"
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toContain("expired");

    // 反向:14:00Z 未过期,应通过
    const r2 = validateDispatch({
      pkg,
      requested: requestedOf(pkg),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: "2026-07-24T14:00:00Z"
    });
    expect(r2).toEqual({ ok: true });
  });

  it("不可解析时间戳 fail-closed 拒", () => {
    const pkg = buildPackage();
    const r = validateDispatch({
      pkg,
      requested: requestedOf(pkg),
      gate0: GATE0_CLOSED,
      currentEffectPolicyVersion: "e2-v1",
      now: "not-a-time"
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toContain("fail-closed");
  });
});
