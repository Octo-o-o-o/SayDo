// A5: stage 0 五项基线 diff + 缺省 0。

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { configSchema } from "../src/config/types.js";
import {
  getFocusStage,
  listFocusToolSpecs,
  focusBrainInstructionDelta,
  shouldEnforceFocusClose,
  shouldPresentFocusCloseChecklist,
  assertFocusWriteAllowed
} from "../src/focus/stage.js";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";

describe("Focus stage flag", () => {
  it("缺省 stage=0", () => {
    const cfg = configSchema.parse({
      models: {
        dialog: "gpt-test",
        thinking: "gpt-test",
        cheap: "gpt-test",
        evaluator: "gpt-test"
      }
    });
    expect(getFocusStage(cfg)).toBe(0);
    expect(cfg.focus.stage).toBe(0);
  });

  it("getFocusStage 无 focus 键时为 0", () => {
    expect(getFocusStage({})).toBe(0);
    expect(getFocusStage({ focus: { stage: 2 } })).toBe(2);
  });

  it("五项基线 diff:stage0 工具/指令/enforce/present 为空或关", () => {
    const stage = 0 as const;
    // 1 tool specs 空
    expect(listFocusToolSpecs(stage)).toEqual([]);
    // 2 instructions 空
    expect(focusBrainInstructionDelta(stage)).toBe("");
    // 3 close enforce 关
    expect(shouldEnforceFocusClose(stage)).toBe(false);
    // 4 checklist present 关
    expect(shouldPresentFocusCloseChecklist(stage)).toBe(false);
    // 5 write gate 拒
    expect(() => assertFocusWriteAllowed(stage)).toThrow(/stage0/);
  });

  it("stage1/2 开启对应能力", () => {
    expect(listFocusToolSpecs(1).length).toBeGreaterThan(0);
    expect(focusBrainInstructionDelta(1).length).toBeGreaterThan(0);
    expect(shouldPresentFocusCloseChecklist(1)).toBe(true);
    expect(shouldEnforceFocusClose(1)).toBe(false);
    expect(shouldEnforceFocusClose(2)).toBe(true);
  });
});

describe("stage0 旧 session 零 Focus 写入", () => {
  let fx: FocusFixture;
  beforeEach(() => {
    fx = openFocusFixture();
  });
  afterEach(() => fx.close());

  it("open 会话路径不写 Focus 表;Focus 表行数=0", () => {
    // fixture 已建 project+session,未触 Focus 服务
    for (const t of [
      "focuses",
      "focus_events",
      "focus_obligations",
      "focus_activations",
      "focus_close_settlements",
      "focus_states"
    ]) {
      const c = (fx.db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;
      expect(c, t).toBe(0);
    }
    const ses = fx.db
      .prepare("SELECT primary_focus_id, focus_anchor_revision FROM sessions WHERE id=?")
      .get(fx.sessionId) as { primary_focus_id: string | null; focus_anchor_revision: number };
    expect(ses.primary_focus_id).toBeNull();
    expect(ses.focus_anchor_revision).toBe(0);
  });
});
