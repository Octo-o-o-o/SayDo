import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recordTier1SubscriptionRun } from "../src/cost/ledger.js";
import { openDb } from "../src/storage/db.js";

describe("tier1.run 成本账本", () => {
  it("同一 run 精确重放只保留一行，不同载荷用同一幂等键时 fail-closed", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-tier1-cost-")), "saydo.db"));
    const input = {
      projectId: "prj_cost",
      taskId: "tsk_cost",
      runId: "run_cost",
      adapter: "cursor",
      model: "fable-5-max",
      usageUnavailable: true
    };
    recordTier1SubscriptionRun(db, input, () => new Date("2026-08-23T00:00:00.000Z"));
    recordTier1SubscriptionRun(db, input, () => new Date("2026-08-23T00:01:00.000Z"));
    expect(
      db.prepare("SELECT id, COUNT(*) AS c FROM cost_entries WHERE kind='tier1.run'").get()
    ).toEqual({ id: "tier1.run:run_cost", c: 1 });

    expect(() =>
      recordTier1SubscriptionRun(db, { ...input, model: "different-model" })
    ).toThrow(/幂等键冲突/u);
    expect((db.prepare("SELECT COUNT(*) AS c FROM cost_entries").get() as { c: number }).c).toBe(1);
  });
});
