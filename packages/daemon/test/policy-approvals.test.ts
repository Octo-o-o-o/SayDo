// 3.4 验收:§12-3 相关(收据生命周期/矩阵/单次消费)+ S2 效果升级测试 +
// effectPolicyVersion 变 ⇒ 旧包拒 dispatch(§12-1 子项)+ G5 贯通 join。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  validateDispatch,
  type DecisionPackage,
  type TaskCard
} from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { computeRisk, isRegisteredVerify, EFFECT_POLICY_VERSION } from "../src/policy/engine.js";
import {
  issueDispatchReceipt,
  applyReceiptEvent,
  approvePackageWithReceipt,
  packageRiskLevel
} from "../src/approvals/issue.js";
import { intentChainByTask, intentChainByTurn } from "../src/intent/view.js";
import { insertPackage } from "../src/storage/dao/packages.js";
import { insertTask } from "../src/storage/dao/tasks.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { getApproval } from "../src/storage/dao/approvals.js";
import { computePackageDigest } from "@saydo/contracts";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const TS = () => new Date("2026-07-24T12:00:00.000Z");

let db: Db;

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-pol-")), "saydo.db"));
});

function mkPkg(): DecisionPackage {
  const body = {
    id: "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA",
    revision: 1,
    projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
    outcomePreview: "导出按钮可用",
    inScope: ["导出"],
    outOfScope: [],
    assumptions: [],
    acceptance: ["Excel 能打开"],
    plan: [{ seq: 1, step: "实现", owner: "ai" as const }],
    cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" as const },
    risks: [],
    mode: "step_confirm" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: EFFECT_POLICY_VERSION
  };
  return {
    ...body,
    digest: computePackageDigest(body),
    status: "proposed",
    expiresAt: "2026-07-31T12:00:00.000Z",
    createdAt: "2026-07-24T12:00:00.000Z"
  };
}

describe("E2 风险计算(效果升级,04 §5.1)", () => {
  it("典型缺省 + 升级规则:.env 升 S2;postinstall 标记;deploy preview 升 S3;protected push 升 S3", () => {
    expect(computeRisk({ kind: "read" }).level).toBe("S0");
    expect(computeRisk({ kind: "read", touchesSensitiveData: true }).level).toBe("S2"); // .env 读升 S2
    expect(computeRisk({ kind: "write_worktree" }).level).toBe("S1");
    expect(computeRisk({ kind: "install_dependency" }).level).toBe("S2");
    const post = computeRisk({ kind: "install_dependency", hasPostinstall: true });
    expect(post.level).toBe("S2");
    expect(post.escalations.some((e) => e.includes("postinstall"))).toBe(true);
    expect(computeRisk({ kind: "push_branch", target: "feature/x" }).level).toBe("S2");
    expect(computeRisk({ kind: "push_branch", target: "feature/x", triggersDeployPreview: true }).level).toBe("S3");
    expect(computeRisk({ kind: "push_branch", target: "main" }).level).toBe("S3"); // protected
    for (const kind of ["merge_to_protected", "deploy", "spend_money", "delete_data", "send_external"] as const) {
      expect(computeRisk({ kind }).level).toBe("S3");
    }
  });

  it("verify 白名单:只认登记模板,拼接串拒(04 §5.3)", () => {
    const reg = { packageScripts: ["test", "typecheck"], justfileTasks: ["ci"] };
    expect(isRegisteredVerify("package_script:test", reg)).toBe(true);
    expect(isRegisteredVerify("justfile:ci", reg)).toBe(true);
    expect(isRegisteredVerify("package_script:rm -rf /", reg)).toBe(false);
    expect(isRegisteredVerify("package_script:test:extra", reg)).toBe(false);
    expect(isRegisteredVerify("shell:pnpm test", reg)).toBe(false);
    expect(isRegisteredVerify("justfile:deploy", reg)).toBe(false);
  });
});

describe("dispatch_package 收据(签发/矩阵/生命周期,09 §3)", () => {
  it("签发 -> accept(保持 pending)-> consume(单次)-> 包 approved;二次消费拒", () => {
    const pkg = mkPkg();
    insertPackage(db, pkg);
    const r = issueDispatchReceipt(
      db,
      nullAudit,
      { pkg, decidedVia: "voice", authStrength: "voice_weak", turnRef: "ses_01TTTTTTTTTTTTTTTTTTTTTTTT" },
      TS
    );
    expect(r.riskLevel).toBe("S1"); // 无 grants = S1
    expect(r.outcome).toBe("pending");

    const accepted = applyReceiptEvent(db, nullAudit, r.id, { kind: "user_accept" }, TS);
    expect(accepted.outcome).toBe("pending");
    expect(accepted.decision).toBe("accept");

    const consumed = applyReceiptEvent(db, nullAudit, r.id, { kind: "consume" }, TS);
    expect(consumed.outcome).toBe("consumed");
    expect(() => applyReceiptEvent(db, nullAudit, r.id, { kind: "consume" }, TS)).toThrow(/terminal/); // 单次消费

    approvePackageWithReceipt(db, nullAudit, pkg, r.id);
    const row = db.prepare("SELECT status FROM decision_packages WHERE id=? AND revision=?").get(pkg.id, 1) as {
      status: string;
    };
    expect(row.status).toBe("approved");
  });

  it("矩阵:voice+S3 拒;consume 未 accept 拒;timeout 按档分叉;未消费收据不能 approve 包", () => {
    const pkg = mkPkg();
    insertPackage(db, pkg);
    // voice 只能 <=S2:构造 S3 收据(手写 riskLevel)被 schema 拒
    expect(() =>
      issueDispatchReceipt(db, nullAudit, { pkg: { ...pkg, preauthorizedEffects: [] }, decidedVia: "voice", authStrength: "screen_authenticated" }, TS)
    ).toThrow(); // voice + screen_authenticated 组合非法

    const r1 = issueDispatchReceipt(db, nullAudit, { pkg, decidedVia: "voice", authStrength: "voice_weak", turnRef: "ses_01AAAAAAAAAAAAAAAAAAAAAAAC" }, TS);
    expect(() => applyReceiptEvent(db, nullAudit, r1.id, { kind: "consume" }, TS)).toThrow(/requires decision=accept/);
    expect(() => approvePackageWithReceipt(db, nullAudit, pkg, r1.id)).toThrow(/consumed/);

    // timeout 分叉:step_confirm -> timeout_parked / direct_to_review -> timeout_rejected
    const parked = applyReceiptEvent(db, nullAudit, r1.id, { kind: "timeout", mode: "step_confirm" }, TS);
    expect(parked.outcome).toBe("timeout_parked");
    const r2 = issueDispatchReceipt(db, nullAudit, { pkg, decidedVia: "screen", authStrength: "screen_authenticated" }, TS);
    const rejected = applyReceiptEvent(db, nullAudit, r2.id, { kind: "timeout", mode: "direct_to_review" }, TS);
    expect(rejected.outcome).toBe("timeout_rejected");
  });

  it("effectPolicyVersion 变 ⇒ 旧包拒 dispatch(§12-1 子项;validateDispatch 集成)", () => {
    const pkg: DecisionPackage = { ...mkPkg(), status: "approved" };
    const requested = { packageId: pkg.id, revision: 1, digest: pkg.digest, mode: "step_confirm" as const, route: "tier1" as const };
    const ok = validateDispatch({
      pkg,
      requested,
      gate0: { enabled: true, bypass: false },
      currentEffectPolicyVersion: EFFECT_POLICY_VERSION,
      now: "2026-07-24T13:00:00.000Z"
    });
    expect(ok.ok).toBe(true);
    const stale = validateDispatch({
      pkg,
      requested,
      gate0: { enabled: true, bypass: false },
      currentEffectPolicyVersion: "e2/9.9.9",
      now: "2026-07-24T13:00:00.000Z"
    });
    expect(stale.ok).toBe(false);
  });
});

describe("G5 意图账本关联视图(贯通 join)", () => {
  it("谁说的(turnRef)-> 签了什么(receipt)-> 执行什么(task)三方可追", () => {
    const pkg = mkPkg();
    insertPackage(db, pkg);
    insertProject(db, {
      id: pkg.projectId,
      title: "测试项目",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: managedProjectPath(pkg.projectId), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: "2026-07-24T12:00:00.000Z",
      updatedAt: "2026-07-24T12:00:00.000Z"
    });
    const task: TaskCard = {
      id: "tsk_01BBBBBBBBBBBBBBBBBBBBBBBB",
      projectId: pkg.projectId,
      packageRef: { packageId: pkg.id, revision: 1, digest: pkg.digest },
      title: "导出",
      specMarkdown: "spec",
      route: "tier1",
      adapter: "cursor",
      status: "confirmed",
      budget: { walltimeActiveMin: 60, maxTurns: 50, maxCost: 20 },
      updatedAt: "2026-07-24T12:00:00.000Z"
    };
    insertTask(db, task, "2026-07-24T12:00:00.000Z");
    const turn = "ses_01AAAAAAAAAAAAAAAAAAAAAAAB";
    const r = issueDispatchReceipt(
      db,
      nullAudit,
      { pkg, decidedVia: "voice", authStrength: "voice_weak", turnRef: turn, taskId: task.id },
      TS
    );
    const chain = intentChainByTask(db, task.id);
    expect(chain.links).toHaveLength(1);
    expect(chain.links[0]?.receiptId).toBe(r.id);
    expect(chain.links[0]?.turnRef).toBe(turn);
    expect(chain.task?.packageDigest).toBe(pkg.digest);
    const byTurn = intentChainByTurn(db, turn);
    expect(byTurn[0]?.taskId).toBe(task.id);
    expect(getApproval(db, r.id)?.turnRef).toBe(turn);
  });
});
