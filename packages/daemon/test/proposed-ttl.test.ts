// §12-1 A6 proposed TTL 反例集(09 §2 注 ④;W4 3.8 验收锚):
// 缺锚 DDL 拒 / 双活跃拒 / 到期 dispatch 拒 / 无独立写点断言 / 调度器崩溃重启幂等。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { computePackageDigest, newId, type DecisionPackage } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { getPackage, insertPackage, isProposedExpired, sweepExpiredProposed, transitionToProposed } from "../src/storage/dao/packages.js";

let db: Db;
const PRJ = newId("prj");
const T0 = "2026-07-27T12:00:00.000Z";

function mkDraft(over: { id?: string; revision?: number } = {}): DecisionPackage {
  const body = {
    id: over.id ?? newId("pkg"),
    revision: over.revision ?? 1,
    projectId: PRJ,
    outcomePreview: "预览",
    inScope: ["a"],
    outOfScope: [],
    assumptions: [],
    acceptance: ["可验证"],
    plan: [{ seq: 1, step: "做", owner: "ai" as const }],
    cost: { expected: { known: false }, p95: { known: false }, max: 10, currency: "CNY" as const },
    risks: [],
    mode: "step_confirm" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "e2-v1"
  };
  return { ...body, digest: computePackageDigest(body), status: "draft", createdAt: T0 };
}

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-ttl-")), "saydo.db"));
  insertProject(db, {
    id: PRJ,
    title: "ttl",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: T0,
    updatedAt: T0
  });
});

describe("§12-1 A6 proposed TTL", () => {
  it("缺锚 DDL 拒:直插 status='proposed' 无 proposed_at ⇒ CHECK 拒", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO decision_packages(id, revision, digest, project_id, body_json, status, proposed_at, expires_at, created_at)
           VALUES ('pkg_x', 1, 'sha256:${"a".repeat(64)}', ?, '{}', 'proposed', NULL, NULL, ?)`
        )
        .run(PRJ, T0)
    ).toThrow(/CHECK/);
  });

  it("双活跃 proposed 拒(同项目;唯一部分索引)——含直插与 transitionToProposed 两路", () => {
    // 直插两条 proposed(同项目)⇒ 第二条撞唯一索引
    const ins = (id: string): void => {
      db.prepare(
        `INSERT INTO decision_packages(id, revision, digest, project_id, body_json, status, proposed_at, expires_at, created_at)
         VALUES (?, 1, ?, ?, '{}', 'proposed', ?, ?, ?)`
      ).run(id, `sha256:${id.padEnd(64, "0").slice(0, 64)}`, PRJ, T0, "2026-07-28T12:00:00Z", T0);
    };
    ins("pkgaaa");
    expect(() => ins("pkgbbb")).toThrow(/UNIQUE/);
  });

  it("transitionToProposed CAS 关旧:同项目新提议 ⇒ 旧 proposed superseded(至多一活跃)", () => {
    const p1 = mkDraft();
    const p2 = mkDraft();
    insertPackage(db, p1);
    insertPackage(db, p2);
    transitionToProposed(db, { id: p1.id, revision: 1, projectId: PRJ, nowIso: T0, ttlHours: 24 });
    transitionToProposed(db, { id: p2.id, revision: 1, projectId: PRJ, nowIso: T0, ttlHours: 24 });
    expect(getPackage(db, p1.id, 1)?.status).toBe("superseded"); // 旧被关
    expect(getPackage(db, p2.id, 1)?.status).toBe("proposed");
    const active = (db.prepare("SELECT COUNT(*) AS c FROM decision_packages WHERE project_id=? AND status='proposed'").get(PRJ) as { c: number }).c;
    expect(active).toBe(1); // 至多一活跃
  });

  it("到期判定 + dispatch 闸:proposed_at + TTL < now ⇒ isProposedExpired 真(receipt 在期不豁免)", () => {
    const p = mkDraft();
    insertPackage(db, p);
    transitionToProposed(db, { id: p.id, revision: 1, projectId: PRJ, nowIso: T0, ttlHours: 24 });
    expect(isProposedExpired(db, p.id, 1, "2026-07-27T20:00:00Z")).toBe(false); // 窗内
    expect(isProposedExpired(db, p.id, 1, "2026-07-28T13:00:00Z")).toBe(true); // 越 24h
  });

  it("无独立写点断言:packages DAO 无 updatePackageExpiry 方法(proposed_at/expires_at 唯一写点=转移事务)", async () => {
    const mod = (await import("../src/storage/dao/packages.js")) as Record<string, unknown>;
    expect(mod["updatePackageExpiry"]).toBeUndefined();
    expect(typeof mod["transitionToProposed"]).toBe("function");
  });

  it("调度器崩溃重启幂等:sweep 到期 proposed → expired;重扫收敛不重复动", () => {
    const p = mkDraft();
    insertPackage(db, p);
    transitionToProposed(db, { id: p.id, revision: 1, projectId: PRJ, nowIso: T0, ttlHours: 24 });
    const now = "2026-07-28T13:00:00Z";
    const first = sweepExpiredProposed(db, now);
    expect(first).toEqual([`${p.id}@1`]);
    expect(getPackage(db, p.id, 1)?.status).toBe("expired");
    // 重启重扫:已 expired 不再动(幂等收敛)
    const second = sweepExpiredProposed(db, now);
    expect(second).toEqual([]);
  });

  it("expired 包重提 = 新 revision 非复活(旧 revision 保持 expired)", () => {
    const p = mkDraft();
    insertPackage(db, p);
    transitionToProposed(db, { id: p.id, revision: 1, projectId: PRJ, nowIso: T0, ttlHours: 24 });
    sweepExpiredProposed(db, "2026-07-28T13:00:00Z");
    // 新 revision 走草稿→proposed(旧 rev 终态不动)
    const p2 = mkDraft({ id: p.id, revision: 2 });
    insertPackage(db, p2);
    transitionToProposed(db, { id: p.id, revision: 2, projectId: PRJ, nowIso: "2026-07-28T14:00:00Z", ttlHours: 24 });
    expect(getPackage(db, p.id, 1)?.status).toBe("expired"); // 旧 rev 未复活
    expect(getPackage(db, p.id, 2)?.status).toBe("proposed");
  });

  it("draft 无 expiry(A6:移除 now+7d);proposed 转移才写 expires_at", () => {
    const p = mkDraft();
    insertPackage(db, p);
    expect(getPackage(db, p.id, 1)?.expiresAt).toBeUndefined(); // draft 无 expiry
    transitionToProposed(db, { id: p.id, revision: 1, projectId: PRJ, nowIso: T0, ttlHours: 24 });
    expect(getPackage(db, p.id, 1)?.expiresAt).toBeTruthy(); // proposed 转移写入
  });
});
