import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIRST_RUN_OPENING,
  FirstRunCoordinator,
  hasLegacyActivity
} from "../src/api/firstRun.js";
import { openDb } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";

function fixture() {
  const home = mkdtempSync(join(tmpdir(), "saydo-first-run-"));
  return { home, db: openDb(join(home, "saydo.db")) };
}

describe("first-run once 状态机", () => {
  it("eligible:固定开场白只投递一次并持久化 presented", () => {
    const { home, db } = fixture();
    const now = () => new Date("2026-08-11T01:02:03.000Z");
    const turnId = `onboarding-${now().getTime()}`;
    const coordinator = new FirstRunCoordinator(db, home, hasLegacyActivity(db), now);
    const delivered: Array<{ sessionId: string; turnId: string; text: string }> = [];

    const first = coordinator.query("ses_first", (turn) => delivered.push(turn));
    const second = coordinator.query("ses_first", (turn) => delivered.push(turn));

    expect(first).toEqual({
      state: "presented",
      delivered: true,
      message: FIRST_RUN_OPENING,
      turnId
    });
    expect(second).toEqual({
      state: "presented",
      delivered: true,
      message: FIRST_RUN_OPENING,
      turnId
    });
    expect(delivered).toEqual([
      { sessionId: "ses_first", turnId, text: FIRST_RUN_OPENING, alreadyRecorded: false }
    ]);
    const markerPath = join(home, "first-run-onboarding.json");
    expect(JSON.parse(readFileSync(markerPath, "utf8"))).toMatchObject({ state: "presented", sessionId: "ses_first" });
    if (process.platform !== "win32") expect(statSync(markerPath).mode & 0o777).toBe(0o600);
  });

  it("空 HOME 资格先于内部 audit 持久化,setup 重启后仍 eligible", () => {
    const { home, db } = fixture();
    const firstProcess = new FirstRunCoordinator(db, home, hasLegacyActivity(db));
    firstProcess.initializeEligibility();
    createSqliteAuditSink(db).record({ actor: "daemon", action: "config.bootstrap" });
    createSqliteAuditSink(db).record({ actor: "owner", action: "setup.config_staged" });
    expect(hasLegacyActivity(db)).toBe(true);

    const afterRestart = new FirstRunCoordinator(db, home, hasLegacyActivity(db));
    afterRestart.initializeEligibility();
    const delivered: string[] = [];
    expect(afterRestart.query("ses_after_restart", (turn) => delivered.push(turn.text))).toMatchObject({
      state: "presented",
      delivered: true,
      message: FIRST_RUN_OPENING
    });
    expect(delivered).toEqual([FIRST_RUN_OPENING]);
  });

  it("legacy:启动前已有 audit 即永久不投", () => {
    const { home, db } = fixture();
    createSqliteAuditSink(db, () => new Date("2026-08-10T00:00:00.000Z")).record({
      actor: "daemon",
      action: "legacy.activity"
    });
    expect(hasLegacyActivity(db)).toBe(true);
    const coordinator = new FirstRunCoordinator(db, home, true);
    const delivered: string[] = [];

    expect(coordinator.query("ses_legacy", (turn) => delivered.push(turn.text))).toEqual({
      state: "legacy_not_eligible",
      delivered: false
    });
    expect(delivered).toEqual([]);
  });

  it("抢先用户消息:写 skipped_by_user 且以后永不投", () => {
    const { home, db } = fixture();
    const coordinator = new FirstRunCoordinator(db, home, false);
    coordinator.noteUserMessage("ses_user_first");
    const delivered: string[] = [];

    expect(coordinator.query("ses_user_first", (turn) => delivered.push(turn.text))).toEqual({
      state: "skipped_by_user",
      delivered: false
    });
    expect(delivered).toEqual([]);
    expect(JSON.parse(readFileSync(join(home, "first-run-onboarding.json"), "utf8"))).toMatchObject({
      state: "skipped_by_user",
      sessionId: "ses_user_first"
    });
  });

  it("投递抛错时保留 presenting,下一次 query 用同一 turnId 重试并提交", () => {
    const { home, db } = fixture();
    const now = () => new Date("2026-08-11T01:02:03.000Z");
    const coordinator = new FirstRunCoordinator(db, home, false, now);
    const seen: string[] = [];

    expect(() =>
      coordinator.query("ses_retry", (turn) => {
        seen.push(turn.turnId);
        throw new Error("delivery failed");
      })
    ).toThrow("delivery failed");
    expect(JSON.parse(readFileSync(join(home, "first-run-onboarding.json"), "utf8"))).toMatchObject({
      state: "presenting",
      sessionId: "ses_retry",
      turnId: seen[0]
    });

    expect(coordinator.query("ses_retry", (turn) => seen.push(turn.turnId))).toEqual({
      state: "presented",
      delivered: true,
      message: FIRST_RUN_OPENING,
      turnId: seen[0]
    });
    expect(seen).toEqual([seen[0], seen[0]]);
    expect(JSON.parse(readFileSync(join(home, "first-run-onboarding.json"), "utf8"))).toMatchObject({
      state: "presented",
      turnId: seen[0]
    });
  });

  it("移动回复尚未定向送达时保留 presenting,同一 turnId 可重试", () => {
    const { home, db } = fixture();
    const coordinator = new FirstRunCoordinator(db, home, false, () => new Date("2026-08-11T01:02:03.000Z"));
    const seen: Array<{ turnId: string; alreadyRecorded: boolean }> = [];

    const first = coordinator.query("ses_mobile", (turn) => {
      seen.push({ turnId: turn.turnId, alreadyRecorded: turn.alreadyRecorded });
      createSqliteAuditSink(db).record({
        actor: "daemon",
        action: "onboarding.first_run_presented",
        meta: { sessionId: turn.sessionId, turnId: turn.turnId }
      });
      return false;
    });
    expect(first).toMatchObject({ state: "presented", delivered: false, message: FIRST_RUN_OPENING });
    expect(JSON.parse(readFileSync(join(home, "first-run-onboarding.json"), "utf8"))).toMatchObject({
      state: "presenting",
      turnId: first.turnId
    });

    const second = coordinator.query("ses_mobile", (turn) => {
      seen.push({ turnId: turn.turnId, alreadyRecorded: turn.alreadyRecorded });
      return true;
    });
    expect(second).toMatchObject({ state: "presented", delivered: true, turnId: first.turnId });
    expect(seen.map((entry) => entry.turnId)).toEqual([first.turnId, first.turnId]);
    expect(seen.map((entry) => entry.alreadyRecorded)).toEqual([false, true]);
  });
});
