import { describe, expect, it } from "vitest";
import {
  HOLD_FLAG_TTL_MS,
  HoldForConfirmQueue,
  decideAsrFinalIngress
} from "../src/voice/holdForConfirmQueue.js";

describe("daemon holdForConfirm 计数消费", () => {
  it("PTT 空 final 消费 hold,不进 Brain;下一轮直发才进 Brain", () => {
    const q = new HoldForConfirmQueue();
    const ses = "ses_hold_ptt";
    q.record(ses, 1_000);
    expect(q.pendingCount(ses)).toBe(1);
    expect(decideAsrFinalIngress(q, ses, "", 1_100)).toBe("hold");
    expect(q.pendingCount(ses)).toBe(0);
    expect(decideAsrFinalIngress(q, ses, "下一句正常语音", 1_200)).toBe("brain");
  });

  it("免手空轮不发 final:残留 hold 会被下一条 PTT final 吃掉", () => {
    const q = new HoldForConfirmQueue();
    const ses = "ses_hold_hf_empty";
    q.record(ses, 1_000);
    // pipeline 免手 _force_finalize 空合并不 emit,此处无 consume
    expect(q.pendingCount(ses)).toBe(1);
    expect(decideAsrFinalIngress(q, ses, "用户下一轮按住说的内容", 2_000)).toBe("hold");
    expect(q.pendingCount(ses)).toBe(0);
  });

  it("空轮不 record 则下一轮直发进 Brain", () => {
    const q = new HoldForConfirmQueue();
    const ses = "ses_no_empty_hold";
    expect(q.pendingCount(ses)).toBe(0);
    expect(decideAsrFinalIngress(q, ses, "用户下一轮按住说的内容", 2_000)).toBe("brain");
  });

  it("TTL 过期的残留旗不挡下一轮", () => {
    const q = new HoldForConfirmQueue();
    const ses = "ses_hold_ttl";
    q.record(ses, 1_000);
    expect(decideAsrFinalIngress(q, ses, "迟到但仍该进 Brain", 1_000 + HOLD_FLAG_TTL_MS + 1)).toBe("brain");
  });
});
