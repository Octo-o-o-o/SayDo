// 输出仲裁(计划 4.4;02 §5/04 §输出仲裁):同时多事件按优先级序播报,不叠音;
// 语音会话进行中新播报排队到收尾;麦克风被会议软件占用 ⇒ 跳过语音降级通知。
// 优先级(02 §5 / 04 回叫优先级序,模式不变量):卡住等人 > 失败 > 待审批 > 完成(进度不打扰)。

import type { OutboxTrigger } from "@saydo/contracts";

export const PRIORITY: Record<OutboxTrigger, number> = {
  blocked: 0, // 卡住等人(最高)
  parked_expired: 0,
  failed: 1,
  subscription_stalled: 1,
  approval_request: 2, // 待审批
  step_boundary: 2,
  ready_for_review: 3 // 完成(最低;进度默认不打扰)
};

export interface PendingCallback {
  entryId: string;
  trigger: OutboxTrigger;
  createdAt: string;
}

export interface ArbitrationContext {
  /** 语音会话进行中(新播报排队到收尾,不插播) */
  voiceBusy: boolean;
  /** 麦克风被会议软件占用(跳过语音,降级通知) */
  micHeldByMeeting: boolean;
}

export type ArbitrationResult =
  | { action: "speak"; entryId: string }
  | { action: "queue"; reason: string }
  | { action: "downgrade_notify"; entryId: string; reason: string };

/**
 * 仲裁:选出当前该播的一条(按优先级 → createdAt)。
 * - 麦占用 ⇒ 最高优先级条目降级通知(不抢麦);
 * - 语音忙 ⇒ 排队(不插播);
 * - 否则播最高优先级。
 */
export function arbitrate(pending: PendingCallback[], ctx: ArbitrationContext): ArbitrationResult {
  if (pending.length === 0) return { action: "queue", reason: "no pending callbacks" };
  const sorted = [...pending].sort((a, b) => {
    const p = PRIORITY[a.trigger] - PRIORITY[b.trigger];
    return p !== 0 ? p : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
  const top = sorted[0] as PendingCallback;
  if (ctx.micHeldByMeeting) {
    return { action: "downgrade_notify", entryId: top.entryId, reason: "mic held by meeting software (skip voice)" };
  }
  if (ctx.voiceBusy) {
    return { action: "queue", reason: "voice session busy (defer to end, no overlap)" };
  }
  return { action: "speak", entryId: top.entryId };
}

/** 重建接通第一句 = 原因(10 回叫纪律;不同 trigger 的原因语) */
export function reconnectFirstLine(trigger: OutboxTrigger, taskTitle: string): string {
  switch (trigger) {
    case "blocked":
    case "parked_expired":
      return `${taskTitle}那边卡住了,需要你确认`;
    case "failed":
      return `${taskTitle}失败了,我先说下情况`;
    case "approval_request":
      return `${taskTitle}有个要你批的动作`;
    case "subscription_stalled":
      return `${taskTitle}的订阅额度到限了,要你定一下`;
    case "step_boundary":
      return `${taskTitle}到了一个确认点`;
    case "ready_for_review":
      return `${taskTitle}执行和检查都跑完了,等你验收`;
  }
}
