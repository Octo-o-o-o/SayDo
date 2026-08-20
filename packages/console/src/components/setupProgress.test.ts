// 「确认并启动」长流程的进度呈现(保存 → 自检 1/2 → 重启 → 自检 2/2)。
//
// 2026-08-12 实测反馈:全 CLI 方案两轮自检合计 2-4 分钟,期间确认卡被提前关掉、页面只剩
// 一行"正在自检各槽位…",用户以为已经结束却进不去可用页面。这里锁住三件事:
// 每一步的可见状态、失败落在哪一步、以及"已进行多久"的人话。

import { describe, expect, it } from "vitest";
import {
  formatElapsed,
  isTestingPhase,
  setupElapsedCopy,
  setupProgressSteps,
  startBusyLabel,
  type SetupPhase
} from "./SetupWizard";

const states = (phase: SetupPhase, failedAt?: Parameters<typeof setupProgressSteps>[1]) =>
  setupProgressSteps(phase, failedAt).map((s) => s.state);

describe("四步进度", () => {
  it("idle 之外的每一步:走过的打勾、当前在跑、后面待办", () => {
    expect(states("staging")).toEqual(["active", "pending", "pending", "pending"]);
    expect(states("testing_staged")).toEqual(["done", "active", "pending", "pending"]);
    expect(states("restarting")).toEqual(["done", "done", "active", "pending"]);
    expect(states("testing_live")).toEqual(["done", "done", "done", "active"]);
  });

  it("重启之后还有一轮自检——这一步存在,才解释得了弹窗关掉后为何还要再等一分钟", () => {
    const steps = setupProgressSteps("testing_live");
    expect(steps.map((s) => s.key)).toEqual(["staging", "testing_staged", "restarting", "testing_live"]);
    expect(steps[1]!.label).toContain("1/2");
    expect(steps[3]!.label).toContain("2/2");
  });

  it("done:四步全绿", () => {
    expect(states("done")).toEqual(["done", "done", "done", "done"]);
  });

  it("failed:只标失败那一步,之前算完成、之后保持未开始(失败位置本身就是排查线索)", () => {
    expect(states("failed", "testing_live")).toEqual(["done", "done", "done", "failed"]);
    expect(states("failed", "staging")).toEqual(["failed", "pending", "pending", "pending"]);
    expect(states("failed", "restarting")).toEqual(["done", "done", "failed", "pending"]);
  });

  it("failed 但不知道失败在哪:不瞎猜,一律未开始", () => {
    expect(states("failed")).toEqual(["pending", "pending", "pending", "pending"]);
  });

  it("idle 不渲染步骤态(组件层直接返回 null)", () => {
    expect(states("idle")).toEqual(["pending", "pending", "pending", "pending"]);
  });
});

describe("忙态判定", () => {
  it("两轮自检都算「正在自检」——只认一轮会让第二轮显示成保存中", () => {
    expect(isTestingPhase("testing_staged")).toBe(true);
    expect(isTestingPhase("testing_live")).toBe(true);
    expect(isTestingPhase("restarting")).toBe(false);
    expect(isTestingPhase("staging")).toBe(false);
    expect(isTestingPhase("done")).toBe(false);
  });
});

describe("已用时间人话", () => {
  it("一分钟以内给秒,超过给分秒", () => {
    expect(formatElapsed(0)).toBe("0 秒");
    expect(formatElapsed(59)).toBe("59 秒");
    expect(formatElapsed(60)).toBe("1 分 00 秒");
    expect(formatElapsed(125)).toBe("2 分 05 秒");
  });

  it("负数与小数不产生怪字符串", () => {
    expect(formatElapsed(-3)).toBe("0 秒");
    expect(formatElapsed(12.7)).toBe("12 秒");
  });

  it("启动按钮自检忙态不带秒;计时只在进度行", () => {
    expect(startBusyLabel("testing_staged")).toBe("正在真实自检…");
    expect(startBusyLabel("testing_live")).toBe("正在真实自检…");
    expect(startBusyLabel("testing_staged")).not.toMatch(/\d/);
    expect(startBusyLabel("restarting")).toBe("正在重启服务…");
    expect(startBusyLabel("staging")).toBe("正在保存方案…");
    expect(setupElapsedCopy(12, false)).toBe("已进行 12 秒。");
    expect(setupElapsedCopy(90, true)).toBe("已进行 1 分 30 秒。两轮合计约 1-3 分钟,期间别关页面。");
    expect(setupElapsedCopy(90, true)).not.toContain("每个槽位");
  });
});
