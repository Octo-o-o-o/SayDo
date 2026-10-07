// 现役 Tier1 操作仍消费 Hopper steer 能力判定。
import { describe, expect, it } from "vitest";
import { hopperSteerSupport } from "../src/bridge/capabilities.js";

describe("Hopper steer 能力判定", () => {
  it("none/schema_only 不放行；runtime 表示能力支持", () => {
    expect(hopperSteerSupport("none").steerable).toBe(false);
    expect(hopperSteerSupport("none").phrase).toContain("不支持运行中改需求");
    expect(hopperSteerSupport("schema_only").steerable).toBe(false);
    expect(hopperSteerSupport("runtime").steerable).toBe(true);
  });
});
