// P0.5-C 直达验收档验收:grant 匹配/ttl 复验/⑦⑧ 反例/preauthorized 子收据/拦截计数/念清单。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeGrantDigest, renderSpoken, type EffectGrant } from "@saydo/contracts";
import { openDb } from "../src/storage/db.js";
import { InterceptCounter, issuePreauthorizedReceipt, matchGrant, renderGrantChecklist } from "../src/approvals/directMode.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const NOW = "2026-07-25T08:00:00.000Z";
const ISSUED = "2026-07-25T07:00:00.000Z";

function mkGrant(effect: "install_dependency" | "push_branch", over: Partial<EffectGrant["constraints"]> = {}, ttlHours = 24): EffectGrant {
  const constraints = {
    environment: "worktree" as const,
    ...(effect === "install_dependency" ? { packages: ["papaparse"] } : {}),
    ...(effect === "push_branch" ? { branchPattern: "feature/*" } : {}),
    ...over
  };
  const downstreamTriggers = effect === "push_branch" ? ("ci_preview" as const) : ("none" as const);
  const base = {
    effect,
    target: effect === "install_dependency" ? "package.json" : "origin",
    constraints,
    downstreamTriggers,
    spokenForm: renderSpoken(effect, constraints, downstreamTriggers),
    ttlHours
  };
  return { ...base, grantDigest: computeGrantDigest(base as never) } as EffectGrant;
}

describe("grant 运行时匹配(fail-closed)", () => {
  it("正例:包集内 install 命中;branch 命中 pattern", () => {
    const g = [mkGrant("install_dependency"), mkGrant("push_branch")];
    expect(matchGrant(g, { effect: "install_dependency", target: "package.json", packages: ["papaparse"], environment: "worktree" }, ISSUED, NOW).hit).toBe(true);
    expect(matchGrant(g, { effect: "push_branch", target: "origin", branch: "feature/export", environment: "worktree" }, ISSUED, NOW).hit).toBe(true);
  });

  it("反例:包集外/分支不中/environment 不符/无 grant => miss", () => {
    const g = [mkGrant("install_dependency"), mkGrant("push_branch")];
    expect(matchGrant(g, { effect: "install_dependency", target: "p", packages: ["left-pad"], environment: "worktree" }, ISSUED, NOW).hit).toBe(false);
    expect(matchGrant(g, { effect: "push_branch", target: "o", branch: "main", environment: "worktree" }, ISSUED, NOW).hit).toBe(false);
    expect(matchGrant(g, { effect: "install_dependency", target: "p", packages: ["papaparse"], environment: "local" }, ISSUED, NOW).hit).toBe(false);
    expect(matchGrant([], { effect: "install_dependency", target: "p", packages: ["papaparse"], environment: "worktree" }, ISSUED, NOW).hit).toBe(false);
  });

  it("§12-2 ⑦:lifecycle scripts 请求一律 miss(走 S2 单次收据)", () => {
    const g = [mkGrant("install_dependency")];
    const m = matchGrant(g, { effect: "install_dependency", target: "p", packages: ["papaparse"], environment: "worktree", lifecycleScripts: true }, ISSUED, NOW);
    expect(m.hit).toBe(false);
    if (!m.hit) expect(m.reason).toContain("lifecycle scripts");
  });

  it("§12-2 ⑧:ttl 过期 grant 命中拒(执行点复验)", () => {
    const g = [mkGrant("install_dependency", {}, 0.5)]; // 30 分钟 ttl;签发 1 小时前
    const m = matchGrant(g, { effect: "install_dependency", target: "p", packages: ["papaparse"], environment: "worktree" }, ISSUED, NOW);
    expect(m.hit).toBe(false);
    if (!m.hit) expect(m.reason).toContain("过期");
  });
});

describe("preauthorized 子收据(09 §3)", () => {
  const PARENT_DIGEST = "sha256:" + "a".repeat(64);
  function mkDb() {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-p05c-")), "saydo.db"));
    // 前置:project + task(FK)
    db.prepare("INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at) VALUES ('prj_01AAAAAAAAAAAAAAAAAAAAAAAA','x','coding','active','{}','direct_to_review',?,?)").run(NOW, NOW);
    db.prepare(
      "INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, cwd, budget_json, created_at, updated_at) VALUES ('tsk_01AAAAAAAAAAAAAAAAAAAAAAAA','prj_01AAAAAAAAAAAAAAAAAAAAAAAA','t','s','tier1','running','cursor','/tmp','{}',?,?)"
    ).run(NOW, NOW);
    return db;
  }
  function seedParentReceipt(db: ReturnType<typeof openDb>, authStrength: string): void {
    db.prepare(
      `INSERT INTO approvals(id, kind, ref_digest, risk, decided_via, auth_strength, decision, nonce, outcome, issued_at, expires_at, decided_at, consumed_at, turn_ref)
       VALUES ('apr_01PARENTAAAAAAAAAAAAAAAAAA', 'dispatch_package', ?, 'S2', 'voice', ?, 'accept', 'n-parent', 'consumed', ?, ?, ?, ?, 'trn_1')`
    ).run(PARENT_DIGEST, authStrength, ISSUED, NOW, ISSUED, ISSUED);
  }

  it("签发即消费;必绑父包 digest;auth_strength 事务内查父收据继承(不接受传入)", () => {
    const db = mkDb();
    seedParentReceipt(db, "voice_weak");
    const g = mkGrant("install_dependency");
    const id = issuePreauthorizedReceipt(db, nullAudit, { grant: g, parentPackageDigest: PARENT_DIGEST, taskId: "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA", effectText: g.spokenForm }, NOW);
    const row = db.prepare("SELECT kind, decided_via, outcome, parent_package_digest, auth_strength FROM approvals WHERE id=?").get(id) as Record<string, string>;
    expect(row).toMatchObject({ kind: "runtime_effect", decided_via: "preauthorized", outcome: "consumed", auth_strength: "voice_weak" });
    expect(row["parent_package_digest"]).toContain("sha256:");
  });

  it("反例:无已消费父 dispatch 收据 ⇒ 拒签发(fail-closed,防伪造认证强度——Codex 14 #1)", () => {
    const db = mkDb();
    const g = mkGrant("install_dependency");
    expect(() =>
      issuePreauthorizedReceipt(db, nullAudit, { grant: g, parentPackageDigest: PARENT_DIGEST, taskId: "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA", effectText: g.spokenForm }, NOW)
    ).toThrow(/parent dispatch receipt/);
  });
});

describe("拦截计数(04 §5.4:>=2 才叫)+ 念清单(10 #12)", () => {
  it("同一意图第 1 次拦不叫,第 2 次叫;不同意图独立计数;放行后 reset", () => {
    const c = new InterceptCounter();
    const req = { effect: "push_branch", target: "origin", branch: "main", environment: "worktree" as const };
    expect(c.recordIntercept(req).shouldCallback).toBe(false);
    expect(c.recordIntercept(req).shouldCallback).toBe(true);
    const other = { ...req, branch: "release" };
    expect(c.recordIntercept(other).shouldCallback).toBe(false); // 意图键不同
    c.reset(req);
    expect(c.recordIntercept(req).shouldCallback).toBe(false);
  });

  it("念清单:<=3 逐条 spokenForm + 哪件不行单说哪件;>3 转屏;空清单直达", () => {
    const three = [mkGrant("install_dependency"), mkGrant("push_branch")];
    const r = renderGrantChecklist(three);
    expect(r.toScreen).toBe(false);
    expect(r.spoken).toContain("装 papaparse 这1个依赖");
    expect(r.spoken).toContain("哪件不行单说哪件");
    const many = [mkGrant("install_dependency"), mkGrant("push_branch"), mkGrant("install_dependency"), mkGrant("push_branch")];
    expect(renderGrantChecklist(many).toScreen).toBe(true);
    expect(renderGrantChecklist([]).spoken).toContain("没有要出圈的事");
  });
});
