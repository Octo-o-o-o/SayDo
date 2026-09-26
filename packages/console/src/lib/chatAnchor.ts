// Chat focus-anchor 实发:共享串行写 + 当前请求所有权。过期请求不 POST、不覆盖新会话/新草稿。

import { apiPost } from "./api";
import {
  claimFocusAnchorOwner,
  enqueueFocusAnchorWrite,
  isCurrentFocusAnchorOwner,
  type FocusAnchorOwner
} from "./focusAnchorCoordinator";
import {
  focusAnchorBody,
  focusAnchorPath,
  mergeLiveDraft,
  shouldApplyAnchorResult,
  type PendingAnchorPayload
} from "./pendingAnchor";

export async function postFocusAnchor(sessionId: string, payload: PendingAnchorPayload): Promise<void> {
  await apiPost(focusAnchorPath(sessionId), focusAnchorBody(payload));
}

export type AnchorAttemptResult =
  | { status: "ready"; sessionId: string }
  | { status: "stale" }
  | { status: "failed"; payload: PendingAnchorPayload; reason: string };

export async function runAnchorAttempt(opts: {
  payload: PendingAnchorPayload;
  sessionId: string;
  requestGen: number;
  liveGen: () => number;
  liveSessionId: () => string;
  liveDraft: () => string;
}): Promise<AnchorAttemptResult> {
  const persist = (): PendingAnchorPayload => mergeLiveDraft(opts.payload, opts.liveDraft());
  if (!opts.sessionId) {
    return { status: "failed", payload: persist(), reason: "还没接到当前对话,草稿还在,可重试" };
  }
  try {
    await postFocusAnchor(opts.sessionId, opts.payload);
    if (opts.requestGen !== opts.liveGen()) return { status: "stale" };
    if (!shouldApplyAnchorResult({
      requestGen: opts.requestGen,
      liveGen: opts.liveGen(),
      requestedSessionId: opts.sessionId,
      liveSessionId: opts.liveSessionId()
    })) {
      return { status: "failed", payload: persist(), reason: "会话已切换,草稿还在,可重试" };
    }
    return { status: "ready", sessionId: opts.sessionId };
  } catch {
    if (opts.requestGen !== opts.liveGen()) return { status: "stale" };
    return { status: "failed", payload: persist(), reason: "续接没接上,草稿还在,可重试" };
  }
}

/** 跨实例续接:先 claim 所有权,再串行 POST;不是当前 owner 则不写服务端、不回写共享草稿。 */
export async function runOwnedAnchorAttempt(opts: {
  owner: FocusAnchorOwner;
  payload: PendingAnchorPayload;
  sessionId: string;
  liveDraft: () => string;
}): Promise<AnchorAttemptResult> {
  const persist = (): PendingAnchorPayload => mergeLiveDraft(opts.payload, opts.liveDraft());
  if (!isCurrentFocusAnchorOwner(opts.owner)) return { status: "stale" };
  if (!opts.sessionId) {
    return { status: "failed", payload: persist(), reason: "还没接到当前对话,草稿还在,可重试" };
  }
  try {
    const queued = await enqueueFocusAnchorWrite(opts.owner, async () => {
      await postFocusAnchor(opts.sessionId, opts.payload);
      return opts.sessionId;
    });
    if (queued.status === "skipped") return { status: "stale" };
    if (!isCurrentFocusAnchorOwner(opts.owner)) return { status: "stale" };
    return { status: "ready", sessionId: queued.value };
  } catch {
    if (!isCurrentFocusAnchorOwner(opts.owner)) return { status: "stale" };
    return { status: "failed", payload: persist(), reason: "续接没接上,草稿还在,可重试" };
  }
}

export { claimFocusAnchorOwner, isCurrentFocusAnchorOwner };
export type { FocusAnchorOwner };
