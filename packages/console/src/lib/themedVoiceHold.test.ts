import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyThemedHoldToCapture,
  bindThemedHoldToCapture,
  canHandsfreeCapture,
  canOpenMic,
  isThemedVoiceHeld,
  nextHandsFreeRoundPhase,
  planThemedHoldCapture,
  resetThemedVoiceHoldForTests,
  routeHandsfreeAsrFinal,
  routeOrphanAsrFinal,
  setThemedVoiceHold
} from "./themedVoiceHold";

afterEach(() => {
  resetThemedVoiceHoldForTests();
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("免手采集门", () => {
  it("无 pending 时免手仍可采集和自动断轮直发", () => {
    expect(canHandsfreeCapture("hands_free", false)).toBe(true);
    expect(routeHandsfreeAsrFinal({ themedHold: false, text: "普通一句" })).toEqual({
      action: "send",
      text: "普通一句"
    });
  });

  it("主题未接上时禁免手采集,自动断轮只留稿", () => {
    expect(canHandsfreeCapture("hands_free", true)).toBe(false);
    expect(canHandsfreeCapture("ptt", true)).toBe(true);
    expect(canOpenMic(true)).toBe(false);
    expect(canOpenMic(false)).toBe(true);
    expect(routeHandsfreeAsrFinal({ themedHold: true, text: "这句话不该进旧主题" })).toEqual({
      action: "hold_as_draft",
      text: "这句话不该进旧主题"
    });
  });

  it("空闲免手升起 hold:停麦、不记 holdForConfirm、不切 PTT", () => {
    expect(
      planThemedHoldCapture({ mode: "hands_free", heldNow: true, handsFreeRound: "idle" })
    ).toEqual({
      stopMic: true,
      sendHoldForConfirm: false,
      allowImmediatePttSwitch: false,
      waitForFinal: false,
      resumeMic: false
    });
    const events: string[] = [];
    let mode: "ptt" | "hands_free" = "hands_free";
    const plan = applyThemedHoldToCapture(true, {
      getMode: () => mode,
      getHandsFreeRound: () => "idle",
      stopMic: () => events.push("stopMic"),
      startMic: () => events.push("startMic"),
      sendHoldForConfirm: () => events.push("holdForConfirm"),
      switchToPtt: () => {
        events.push("switchToPtt");
        mode = "ptt";
      }
    });
    expect(plan.sendHoldForConfirm).toBe(false);
    expect(events).toEqual(["stopMic"]);
    expect(mode).toBe("hands_free");
  });

  it("已启动免手轮升起 hold:停麦、不补 hold/done,不切 PTT", async () => {
    const events: string[] = [];
    let mode: "ptt" | "hands_free" = "hands_free";
    const unbind = bindThemedHoldToCapture(
      {
        getMode: () => mode,
        getHandsFreeRound: () => "open",
        stopMic: () => events.push("stopMic"),
        startMic: () => events.push("startMic"),
        sendHoldForConfirm: () => events.push("holdForConfirm"),
        switchToPtt: () => {
          events.push("switchToPtt");
          mode = "ptt";
        }
      }
    );
    setThemedVoiceHold(true);
    expect(events).toEqual(["stopMic"]);
    expect(events).not.toContain("holdForConfirm");
    expect(events).not.toContain("switchToPtt");

    await delay(20);
    const lateFinal = routeHandsfreeAsrFinal({
      themedHold: isThemedVoiceHeld(),
      text: "停顿后自动断轮"
    });
    expect(lateFinal.action).toBe("hold_as_draft");

    setThemedVoiceHold(false);
    expect(events).not.toContain("holdForConfirm");
    unbind();
  });

  it("PTT 队空迟到 final 在主题 hold 时留稿,无 hold 时仍丢弃", () => {
    expect(
      routeOrphanAsrFinal({ mode: "ptt", themedHold: true, text: "切换前说的半句" })
    ).toEqual({ action: "hold_as_draft", text: "切换前说的半句" });
    expect(routeOrphanAsrFinal({ mode: "ptt", themedHold: false, text: "孤儿" })).toEqual({
      action: "ignore"
    });
    expect(routeOrphanAsrFinal({ mode: "hands_free", themedHold: false, text: "免手直发" })).toEqual({
      action: "send",
      text: "免手直发"
    });
  });

  it("vad start 打开轮次,asr.final 才关闭;切离免手也关闭", () => {
    expect(nextHandsFreeRoundPhase("idle", "vad_start")).toBe("open");
    expect(nextHandsFreeRoundPhase("open", "vad_end")).toBe("open");
    expect(nextHandsFreeRoundPhase("open", "asr_final")).toBe("idle");
    expect(nextHandsFreeRoundPhase("open", "mode_leave_hf")).toBe("idle");
  });

  it("订阅后才升起 hold 也会通知已挂着的采集控制", async () => {
    const stopMic = vi.fn();
    const sendHoldForConfirm = vi.fn();
    const switchToPtt = vi.fn();
    const unbind = bindThemedHoldToCapture({
      getMode: () => "hands_free",
      getHandsFreeRound: () => "open",
      stopMic,
      startMic: vi.fn(),
      sendHoldForConfirm,
      switchToPtt
    });
    await delay(5);
    setThemedVoiceHold(true);
    await delay(5);
    expect(stopMic).toHaveBeenCalled();
    expect(sendHoldForConfirm).not.toHaveBeenCalled();
    expect(switchToPtt).not.toHaveBeenCalled();
    unbind();
  });
});
