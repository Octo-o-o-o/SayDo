// 0.3 验收:TS <-> DDL round-trip(§12-9 末项)——契约类型经 DAO 写入 SQLite 再读回,zod 全等。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import {
  newId,
  type ApprovalReceipt,
  type Artifact,
  type CallbackOutboxEntry,
  type ContextSnapshot,
  type DecisionPackage,
  type MemoryEvent,
  type Project,
  type Session,
  type TaskCard,
  computePackDigest,
  computePackageDigest
} from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { getProject, getSession, insertProject, insertSession } from "../src/storage/dao/projects.js";
import { getPackage, insertPackage, transitionToProposed, updatePackageStatus } from "../src/storage/dao/packages.js";
import { getApproval, insertApproval } from "../src/storage/dao/approvals.js";
import { getTask, insertTask, insertTier1Run, getTier1Run, nextAttempt, type Tier1RunRow } from "../src/storage/dao/tasks.js";
import { getMemoryEvent, insertMemoryEvent } from "../src/storage/dao/memory.js";
import { getOutboxEntry, insertOutboxEntry } from "../src/storage/dao/outbox.js";
import { getArtifact, insertArtifact, getContextSnapshot, insertContextSnapshot } from "../src/storage/dao/misc.js";
import { managedProjectPath } from "../src/projects/workspace.js";

const TS0 = "2026-07-24T00:00:00Z";

function freshDb(): Db {
  return openDb(join(mkdtempSync(join(tmpdir(), "saydo-db-")), "saydo.db"));
}

function fixtureProject(): Project {
  const id = newId("prj");
  return {
    id,
    title: "测试项目",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(id), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: TS0,
    updatedAt: TS0
  };
}

describe("TS <-> DDL round-trip", () => {
  let db: Db;
  beforeEach(() => {
    db = freshDb();
  });

  it("projects / sessions", () => {
    const p = fixtureProject();
    insertProject(db, p);
    expect(getProject(db, p.id)).toEqual(p);

    const s: Session = {
      id: newId("ses"),
      projectId: p.id,
      projectRevision: 0,
      state: "talking",
      engine: "cascade",
      transcriptPath: "sessions/x.jsonl",
      contextSnapshotDigest: "sha256:" + "b".repeat(64),
      startedAt: TS0
    };
    insertSession(db, s);
    expect(getSession(db, s.id)).toEqual(s);
  });

  it("decision_packages(status 仅列;body 不含 status/digest)+ 状态机推进", () => {
    const body: Omit<DecisionPackage, "digest"> = {
      id: newId("pkg"),
      revision: 1,
      projectId: newId("prj"),
      outcomePreview: "预览",
      inScope: ["a"],
      outOfScope: [],
      assumptions: [],
      acceptance: ["可验证标准"],
      plan: [{ seq: 1, step: "做事", owner: "ai" }],
      cost: { expected: { known: false }, p95: { known: false }, max: 10, currency: "CNY" },
      risks: [],
      mode: "step_confirm",
      preauthorizedEffects: [],
      effectPolicyVersion: "e2-v1",
      status: "draft",
      expiresAt: "2026-07-31T00:00:00Z",
      createdAt: TS0
    };
    const pkg: DecisionPackage = { ...body, digest: computePackageDigest(body) };
    insertPackage(db, pkg);
    expect(getPackage(db, pkg.id, 1)).toEqual(pkg);

    const raw = db.prepare("SELECT body_json FROM decision_packages WHERE id=?").get(pkg.id) as { body_json: string };
    expect(raw.body_json).not.toContain('"status"');

    // A6:转 proposed 走 transitionToProposed(写不可变 proposed_at + expires_at;generic 直设 proposed 会撞 CHECK)
    transitionToProposed(db, { id: pkg.id, revision: 1, projectId: pkg.projectId, nowIso: TS0, ttlHours: 24 });
    expect(getPackage(db, pkg.id, 1)?.status).toBe("proposed");
    const anchored = db.prepare("SELECT proposed_at, expires_at FROM decision_packages WHERE id=?").get(pkg.id) as {
      proposed_at: string | null;
      expires_at: string | null;
    };
    expect(anchored.proposed_at).toBe(TS0); // 不可变锚已写
    expect(anchored.expires_at).toBeTruthy();
    // A6 转换表改造:proposed->expired 现为合法(TTL 到期),不再抛 illegal
    expect(() => updatePackageStatus(db, pkg.id, 1, "expired")).not.toThrow();
    expect(getPackage(db, pkg.id, 1)?.status).toBe("expired");
  });

  it("decision_packages 身份列与正文 id/revision/projectId 分叉时回读 fail-closed", () => {
    const body: Omit<DecisionPackage, "digest"> = {
      id: newId("pkg"),
      revision: 1,
      projectId: newId("prj"),
      outcomePreview: "预览",
      inScope: ["a"],
      outOfScope: [],
      assumptions: [],
      acceptance: ["可验证标准"],
      plan: [{ seq: 1, step: "做事", owner: "ai" }],
      cost: { expected: { known: false }, p95: { known: false }, max: 10, currency: "CNY" },
      risks: [],
      mode: "step_confirm",
      preauthorizedEffects: [],
      effectPolicyVersion: "e2-v1",
      status: "draft",
      createdAt: TS0
    };
    const pkg: DecisionPackage = { ...body, digest: computePackageDigest(body) };
    insertPackage(db, pkg);
    const stored = JSON.parse(
      (db.prepare("SELECT body_json FROM decision_packages WHERE id=?").get(pkg.id) as { body_json: string }).body_json
    ) as Record<string, unknown>;
    db.prepare("UPDATE decision_packages SET body_json=? WHERE id=? AND revision=1").run(
      JSON.stringify({ ...stored, id: newId("pkg") }),
      pkg.id
    );
    expect(() => getPackage(db, pkg.id, 1)).toThrow(/package id identity mismatch/);
    db.prepare("UPDATE decision_packages SET body_json=? WHERE id=? AND revision=1").run(
      JSON.stringify({ ...stored, revision: 2 }),
      pkg.id
    );
    expect(() => getPackage(db, pkg.id, 1)).toThrow(/package revision identity mismatch/);
    db.prepare("UPDATE decision_packages SET body_json=? WHERE id=? AND revision=1").run(JSON.stringify(stored), pkg.id);
    db.prepare("UPDATE decision_packages SET project_id=? WHERE id=? AND revision=1").run(newId("prj"), pkg.id);
    expect(() => getPackage(db, pkg.id, 1)).toThrow(/project identity mismatch/);
  });

  it("approvals(voice+turnRef)", () => {
    const r: ApprovalReceipt = {
      id: newId("apr"),
      kind: "dispatch_package",
      refDigest: "sha256:" + "c".repeat(64),
      taskId: newId("tsk"),
      sessionId: newId("ses"),
      turnRef: newId("ses"),
      riskLevel: "S2",
      principal: "owner",
      decidedVia: "voice",
      authStrength: "voice_weak",
      nonce: "n-" + newId("apr"),
      issuedAt: TS0,
      expiresAt: "2026-07-24T00:01:00Z",
      outcome: "pending"
    };
    insertApproval(db, r);
    expect(getApproval(db, r.id)).toEqual(r);
  });

  it("tasks + tier1_runs + attempt 规则", () => {
    const p = fixtureProject();
    insertProject(db, p);
    const t: TaskCard = {
      id: newId("tsk"),
      projectId: p.id,
      packageRef: { packageId: newId("pkg"), revision: 1, digest: "sha256:" + "d".repeat(64) },
      title: "导出 CSV",
      specMarkdown: "# spec",
      route: "tier1",
      status: "confirmed",
      adapter: "cursor",
      budget: { walltimeActiveMin: 45, maxTurns: 50, maxCost: 20 },
      updatedAt: TS0
    };
    insertTask(db, t, TS0);
    expect(getTask(db, t.id)).toEqual(t);

    const run: Tier1RunRow = {
      id: newId("tsk"),
      taskId: t.id,
      attempt: nextAttempt(db, t.id),
      adapter: "cursor",
      cwd: "/tmp/wt",
      worktreePath: "/tmp/wt",
      state: "reserved",
      createdAt: TS0,
      updatedAt: TS0
    };
    expect(run.attempt).toBe(1);
    insertTier1Run(db, run);
    expect(getTier1Run(db, run.id)).toEqual(run);
    expect(nextAttempt(db, t.id)).toBe(2);
  });

  it("memory_events 三种判别形态", () => {
    const add: MemoryEvent = {
      id: newId("mem"),
      ts: TS0,
      op: "add",
      tier: "M1",
      projectId: newId("prj"),
      claim: "构建用 pnpm",
      source: { kind: "repo_file", ref: "package.json@abc", quote: "packageManager: pnpm" },
      trust: "auto_low_impact",
      taint: ["repo_file"]
    };
    insertMemoryEvent(db, add);
    expect(getMemoryEvent(db, add.id)).toEqual(add);

    const soft: MemoryEvent = {
      id: newId("mem"),
      ts: TS0,
      op: "forget_soft",
      tier: "M1",
      targets: [add.id],
      reason: "过时"
    };
    insertMemoryEvent(db, soft);
    expect(getMemoryEvent(db, soft.id)).toEqual(soft);

    const hard: MemoryEvent = {
      id: newId("mem"),
      ts: TS0,
      op: "forget_hard",
      tier: "M1",
      targets: [add.id],
      targetDigests: ["sha256:" + "e".repeat(64)],
      generation: 2,
      stores: ["fts", "projection", "backup"]
    };
    insertMemoryEvent(db, hard);
    expect(getMemoryEvent(db, hard.id)).toEqual(hard);
  });

  it("callback_outbox", () => {
    const e: CallbackOutboxEntry = {
      id: newId("ntf"),
      taskId: newId("tsk"),
      trigger: "ready_for_review",
      occurrenceKey: "1",
      dedupeKey: "tsk_x:ready_for_review:1:1",
      settleProof: { projectionCursor: "c1", artifactChecks: ["summary"] },
      state: "pending",
      escalationLevel: 0,
      createdAt: TS0,
      updatedAt: TS0
    };
    insertOutboxEntry(db, e);
    expect(getOutboxEntry(db, e.id)).toEqual(e);
  });

  it("artifacts / context_snapshots", () => {
    const a: Artifact = {
      id: newId("art"),
      projectId: newId("prj"),
      version: 1,
      type: "plan",
      path: ".saydo/artifacts/plan.md",
      digest: "sha256:" + "f".repeat(64),
      tags: ["plan"],
      source: "agent_output",
      createdAt: TS0
    };
    insertArtifact(db, a);
    expect(getArtifact(db, a.id, 1)).toEqual(a);

    const body: Omit<ContextSnapshot, "packDigest" | "sessionId" | "projectId"> = {
      compilerVersion: "b1-v1+trigram",
      memoryGeneration: 1,
      repoHead: "abc123",
      topicTerms: ["csv", "导出"],
      budgets: { M0: 200, M1: 1200, M2: 800, M3: 800 },
      slices: [{ tier: "M1" as const, refs: ["mem_1"], tokens: 100, segment: "stable" as const }],
      excluded: [{ ref: "mem_2", reason: "third_party" }]
    };
    const snap: ContextSnapshot = {
      ...body,
      packDigest: computePackDigest(body),
      sessionId: newId("ses"),
      projectId: newId("prj")
    };
    insertContextSnapshot(db, snap, TS0); // = recordContextSnapshotUse(M1 拆表委托)
    const back = getContextSnapshot(db, snap.packDigest);
    expect(back).toEqual(snap);
  });
});
