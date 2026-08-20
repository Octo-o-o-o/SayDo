// docs/09 §6.3 outbox 状态机:pending -> notified -> acked -> (resolution-timeout) requeued -> notified(升级)。
// requeued 唯一语义 = acked 后 resolution-timeout 到期;活跃任一态可 resolved(done/superseded/expired)。

import type { OutboxState } from "../types/outbox.js";

const T: Record<OutboxState, OutboxState[]> = {
  pending: ["notified", "resolved"],
  notified: ["acked", "resolved"],
  acked: ["requeued", "resolved"],
  requeued: ["notified", "resolved"], // requeued -> notified 时 escalationLevel+1
  resolved: []
};

export function canTransitionOutbox(from: OutboxState, to: OutboxState): boolean {
  return T[from].includes(to);
}
