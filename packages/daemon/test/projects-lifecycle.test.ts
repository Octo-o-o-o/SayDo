// 2.4 验收(draft 全流程):开口即建 -> 识别回填(候选记忆挂 draft)-> 转正 / re-anchor 候选并入
// (candidate 写路径 + archived + reanchoredTo 指针);非法转换拒。
// Phase 2 评审回修:B-4 事务包裹 / B-5 expiresAt+taint 透传 / B-6 状态转换落审计。

import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { createProjectDraft, promoteProject, reanchorDraft } from "../src/projects/lifecycle.js";
import { getProject } from "../src/storage/dao/projects.js";
import type { AuditSink } from "../src/obs/audit.js";
import { newId, type Project } from "@saydo/contracts";
import { insertMemoryEvent } from "../src/storage/dao/memory.js";

const TS = () => new Date("2026-07-24T00:00:00.000Z");
const NOW = "2026-07-24T12:00:00.000Z";

let db: Db;
let ledger: MemoryLedger;
let auditActions: { action: string; meta?: Record<string, unknown> }[];
let audit: AuditSink;

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-prj-")), "saydo.db"));
  auditActions = [];
  audit = {
    record: (e) => {
      auditActions.push({ action: e.action, ...(e.meta ? { meta: e.meta } : {}) });
      return { id: "aud_x" };
    }
  };
  ledger = new MemoryLedger({ db, audit, now: TS });
});

describe("draft 全流程:开口即建 -> 转正", () => {
  it("createProjectDraft:pending/draft/系统管理文件夹/step_confirm 出厂 + 落审计", () => {
    const d = createProjectDraft(db, audit, NOW);
    expect(d.status).toBe("draft");
    expect(d.type).toBe("pending");
    expect(d.workspace.managed).toBe(true);
    expect(d.workspace.path).toContain(d.id);
    expect(d.executionModeDefault).toBe("step_confirm");
    expect(getProject(db, d.id)?.id).toBe(d.id);
    expect(auditActions.map((a) => a.action)).toContain("project.create_draft");
  });

  it("promote:draft -> active,title/type 定型 + 落审计;非 draft 拒", () => {
    const d = createProjectDraft(db, audit, NOW);
    const p = promoteProject(db, audit, { projectId: d.id, title: "导出功能", type: "coding" }, NOW);
    expect(p.status).toBe("active");
    expect(p.title).toBe("导出功能");
    expect(p.type).toBe("coding");
    expect(auditActions.map((a) => a.action)).toContain("project.promote");
    // 二次 promote(已 active)拒
    expect(() => promoteProject(db, audit, { projectId: d.id, title: "x", type: "coding" }, NOW)).toThrow(/draft/);
  });

  it("转正即备齐备份必需目录:.saydo/foundation 与 knowledge", () => {
    const d = createProjectDraft(db, audit, NOW);
    const p = promoteProject(db, audit, { projectId: d.id, title: "导出功能", type: "coding" }, NOW);
    // 备份把 active 项目的这两个目录列为必需源(backup/snapshot.ts activeWorkspaceSources),
    // 而 knowledge 原本要等第一次写 M1 笔记才建——缺目录会让**整轮**定时备份直接失败。
    expect(existsSync(join(p.workspace.path, ".saydo", "foundation"))).toBe(true);
    expect(existsSync(join(p.workspace.path, ".saydo", "knowledge"))).toBe(true);
  });
});

describe("draft 全流程:re-anchor 候选并入", () => {
  let draft: Project;
  let target: Project;

  beforeEach(() => {
    draft = createProjectDraft(db, audit, NOW);
    const t = createProjectDraft(db, audit, NOW);
    target = promoteProject(db, audit, { projectId: t.id, title: "既有项目", type: "coding" }, NOW);
  });

  it("确认后并入:draft 记忆以 candidate 落 target;draft -> archived + reanchoredTo + 落审计", () => {
    ledger.add({
      tier: "M1",
      projectId: draft.id,
      claim: "导出格式要 CSV",
      source: { kind: "user_utterance", ref: "turn@1" },
      requestedTrust: "user_stated"
    });
    ledger.add({
      tier: "M3",
      projectId: draft.id,
      claim: "可能要支持 Excel 直开",
      source: { kind: "user_utterance", ref: "turn@2" }
    });
    // 无关项目的记忆不并入
    ledger.add({
      tier: "M1",
      projectId: target.id,
      claim: "既有事实",
      source: { kind: "user_utterance", ref: "turn@9" },
      requestedTrust: "user_stated"
    });

    const r = reanchorDraft(db, ledger, audit, { draftId: draft.id, targetId: target.id }, NOW);
    expect(r.merged).toBe(2);
    expect(r.draft.status).toBe("archived");
    expect(r.draft.reanchoredTo).toBe(target.id);

    const targetFacts = ledger.project().filter((m) => m.projectId === target.id);
    const mergedFacts = targetFacts.filter((m) => m.source.kind === "import");
    expect(mergedFacts).toHaveLength(2);
    for (const f of mergedFacts) {
      expect(f.trust).toBe("candidate"); // §4 candidate 写路径,不因 draft 期 user_stated 而升权
      expect(f.source.ref).toBe(`reanchor:${draft.id}`);
    }
    expect(targetFacts.map((f) => f.claim)).toContain("导出格式要 CSV");
    const reanchorAudit = auditActions.find((a) => a.action === "project.reanchor");
    expect(reanchorAudit?.meta?.["merged"]).toBe(2);
  });

  it("B-5:expiresAt 与 taint 随并入透传(临时事实不因换 id 永生)", () => {
    ledger.add({
      tier: "M1",
      projectId: draft.id,
      claim: "临时口径下周失效",
      source: { kind: "web", ref: "https://example.com/a" },
      expiresAt: "2026-07-30T00:00:00.000Z",
      taint: ["web"] // 显式 taint 入口(AddInput.taint,评审 B-5)
    });
    reanchorDraft(db, ledger, audit, { draftId: draft.id, targetId: target.id }, NOW);
    const merged = ledger.project().find((m) => m.projectId === target.id && m.claim === "临时口径下周失效");
    expect(merged).toBeDefined();
    expect(merged?.expiresAt).toBe("2026-07-30T00:00:00.000Z");
    expect(merged?.taint).toContain("web");
    // 到期后:并入的事实同样退场(不永生)
    const after = ledger.project("2026-08-01T00:00:00.000Z").find((m) => m.claim === "临时口径下周失效");
    expect(after).toBeUndefined();
  });

  it("守卫:非 draft 源拒;目标非 active 拒;目标不存在拒;已 archived 拒二次(B-4 事务后重入防线)", () => {
    const another = createProjectDraft(db, audit, NOW);
    expect(() => reanchorDraft(db, ledger, audit, { draftId: target.id, targetId: target.id }, NOW)).toThrow(/draft/);
    expect(() => reanchorDraft(db, ledger, audit, { draftId: draft.id, targetId: another.id }, NOW)).toThrow(/active/);
    expect(() =>
      reanchorDraft(db, ledger, audit, { draftId: draft.id, targetId: "prj_01ZZZZZZZZZZZZZZZZZZZZZZZZ" }, NOW)
    ).toThrow(/not found/);
    reanchorDraft(db, ledger, audit, { draftId: draft.id, targetId: target.id }, NOW);
    expect(() => reanchorDraft(db, ledger, audit, { draftId: draft.id, targetId: target.id }, NOW)).toThrow(/draft/);
  });

  it("两条中一条命中凭据:另一条并入、draft archived、merged=1、审计 skipped", () => {
    const secret = ["ghp", "_", "B".repeat(16)].join("");
    ledger.add({
      tier: "M1",
      projectId: draft.id,
      claim: "导出格式要 CSV",
      source: { kind: "user_utterance", ref: "turn@1" },
      requestedTrust: "user_stated"
    });
    insertMemoryEvent(db, {
      id: newId("mem"),
      ts: NOW,
      op: "add",
      tier: "M1",
      projectId: draft.id,
      claim: `可能要支持 ${secret}`,
      source: { kind: "user_utterance", ref: "turn@2" },
      trust: "user_stated"
    });
    const r = reanchorDraft(db, ledger, audit, { draftId: draft.id, targetId: target.id }, NOW);
    expect(r.merged).toBe(1);
    expect(r.draft.status).toBe("archived");
    const mergedFacts = ledger.project().filter((m) => m.projectId === target.id && m.source.kind === "import");
    expect(mergedFacts).toHaveLength(1);
    expect(mergedFacts[0]?.claim).toBe("导出格式要 CSV");
    expect(JSON.stringify(mergedFacts)).not.toContain(secret);
    const reanchorAudit = auditActions.find((a) => a.action === "project.reanchor");
    expect(reanchorAudit?.meta?.["merged"]).toBe(1);
    expect(reanchorAudit?.meta?.["skipped"]).toBe(1);
  });
});
