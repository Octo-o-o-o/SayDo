// 确认卡按 kind 定文案(桌面 Chat 生产确认卡与移动 CardPage 共用;GAP-02 2.1 + 残项 2.1)。
// memory(SD-2 普通 M0 记忆提议)是信息确认不是授权,超时不自动记(过期即丢),按钮「记 / 不用记」;
// 已登记的其它 kind 沿用「做 / 不要」与倒计时自动执行说明;表外/缺失 kind 回落中性的「确认 / 不」,
// 不把未知动作说成会自动执行(11 §5.6b 移动卡 / 11 确认卡行)。

import { isConfirmKind } from "@saydo/contracts";

export interface ConfirmCardCopy {
  label: string | null;
  accept: string;
  reject: string;
  countdownHint: string;
  idleHint: string;
}

const MEMORY_COPY: ConfirmCardCopy = {
  label: "记忆 · 信息确认 · 不是授权",
  accept: "记",
  reject: "不用记",
  countdownHint: "倒计时结束这条不记(过期即丢);点按钮,或直接开口回答",
  idleHint: "点按钮,或直接开口回答"
};

const ACTION_COPY: ConfirmCardCopy = {
  label: null,
  accept: "做",
  reject: "不要",
  countdownHint: "倒计时结束自动执行;点按钮,或直接说\"好\"/\"不要\"",
  idleHint: "点按钮,或直接说\"好\"/\"不要\""
};

const UNKNOWN_COPY: ConfirmCardCopy = {
  label: "确认",
  accept: "确认",
  reject: "不",
  countdownHint: "倒计时结束按账本规则收口;点按钮,或直接开口回答",
  idleHint: "点按钮,或直接开口回答"
};

/** kind 缺失或不在 CONFIRM_KINDS ⇒ 未知回落;memory ⇒ 记/不用记;其余登记 kind ⇒ 做/不要 */
export function confirmCardCopy(kind: string | null | undefined): ConfirmCardCopy {
  if (kind === "memory") return MEMORY_COPY;
  if (typeof kind === "string" && isConfirmKind(kind)) return ACTION_COPY;
  return UNKNOWN_COPY;
}
