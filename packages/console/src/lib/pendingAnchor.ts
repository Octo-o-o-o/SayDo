// Chat 续接锚定:sessionStorage 载荷 + 发送门。
// 带主题内容必须等当前会话 focus-anchor 成功;失败/离线/会话变化保留草稿,不悄悄发给错误主题。

export const PENDING_ANCHOR_KEY = "saydo.chat.pendingAnchor";

export type PendingAnchorPayload = {
  focusId: string;
  title?: string;
  laneTitle?: string;
  /** 可编辑草稿;进入对话后只回填,不自动发送 */
  draft?: string;
  requestId?: string;
  daemonEpoch?: string;
  discardUnknownEpochs?: number[];
};

export type AnchorPhase = "idle" | "pending" | "ready" | "failed";

export function parsePendingAnchor(raw: string | null): PendingAnchorPayload | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<PendingAnchorPayload>;
    if (typeof p.focusId !== "string" || p.focusId.trim() === "") return null;
    const out: PendingAnchorPayload = { focusId: p.focusId };
    if (typeof p.title === "string" && p.title.trim() !== "") out.title = p.title;
    if (typeof p.laneTitle === "string" && p.laneTitle.trim() !== "") out.laneTitle = p.laneTitle;
    if (typeof p.draft === "string") out.draft = p.draft;
    if (typeof p.requestId === "string" && p.requestId.startsWith("evt_")) out.requestId = p.requestId;
    if (typeof p.daemonEpoch === "string" && p.daemonEpoch.startsWith("evt_")) out.daemonEpoch = p.daemonEpoch;
    if (Array.isArray(p.discardUnknownEpochs) && p.discardUnknownEpochs.every((n) => Number.isInteger(n))) {
      out.discardUnknownEpochs = p.discardUnknownEpochs as number[];
    }
    return out;
  } catch {
    return null;
  }
}

export function readPendingAnchor(storage: Pick<Storage, "getItem">): PendingAnchorPayload | null {
  try {
    return parsePendingAnchor(storage.getItem(PENDING_ANCHOR_KEY));
  } catch {
    return null;
  }
}

export function writePendingAnchor(
  storage: Pick<Storage, "setItem">,
  payload: PendingAnchorPayload
): boolean {
  try {
    storage.setItem(PENDING_ANCHOR_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingAnchor(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(PENDING_ANCHOR_KEY);
  } catch {
    /* ignore */
  }
}

export type SentDraftBinding = {
  text: string;
  version: number;
  owner: { sessionId: string; focusId: string; id: number } | null;
  requestId?: string;
  daemonEpoch?: string;
};

export function shouldConsumeSentDraft(opts: {
  binding: SentDraftBinding;
  currentText: string;
  currentVersion: number;
  currentOwner: { sessionId: string; focusId: string; id: number } | null;
  currentRequestId?: string;
  currentEpoch?: string | null;
  isCurrentOwner: (o: { sessionId: string; focusId: string; id: number }) => boolean;
}): boolean {
  if (opts.currentVersion !== opts.binding.version) return false;
  if (opts.currentText !== opts.binding.text) return false;
  if (opts.binding.owner && !opts.isCurrentOwner(opts.binding.owner)) return false;
  if (opts.binding.requestId && opts.currentRequestId && opts.binding.requestId !== opts.currentRequestId) {
    return false;
  }
  if (opts.binding.daemonEpoch && opts.currentEpoch && opts.binding.daemonEpoch !== opts.currentEpoch) {
    return false;
  }
  return true;
}

/** 成功发出后清当前 owner 的 sessionStorage 副本;其它 owner 新稿不动。 */
export function consumeOwnedPendingDraft(
  owner: { sessionId: string; focusId: string; id: number } | null,
  storage: Pick<Storage, "getItem" | "removeItem">,
  isCurrentOwner: (o: { sessionId: string; focusId: string; id: number }) => boolean,
  binding?: { requestId?: string; draft?: string }
): boolean {
  if (!owner || !isCurrentOwner(owner)) return false;
  const stored = readPendingAnchor(storage);
  if (!stored || stored.focusId !== owner.focusId) return false;
  if (binding?.requestId && stored.requestId && stored.requestId !== binding.requestId) return false;
  if (binding?.draft !== undefined && stored.draft !== undefined && stored.draft !== binding.draft) return false;
  clearPendingAnchor(storage);
  return true;
}

export function buildPendingAnchor(input: {
  focusId: string;
  title?: string;
  laneTitle?: string;
  draft?: string;
  requestId?: string;
  daemonEpoch?: string;
  discardUnknownEpochs?: number[];
}): PendingAnchorPayload {
  const out: PendingAnchorPayload = { focusId: input.focusId };
  if (input.title?.trim()) out.title = input.title.trim();
  if (input.laneTitle?.trim()) out.laneTitle = input.laneTitle.trim();
  if (input.draft !== undefined) out.draft = input.draft;
  if (input.requestId) out.requestId = input.requestId;
  if (input.daemonEpoch) out.daemonEpoch = input.daemonEpoch;
  if (input.discardUnknownEpochs && input.discardUnknownEpochs.length > 0) {
    out.discardUnknownEpochs = input.discardUnknownEpochs;
  }
  return out;
}

/** 续接用真实标题;缺标题或标题等于 laneId 时省略,绝不把 laneId 当标题 */
export function resolveLaneTitle(
  lanes: readonly { id: string; title: string }[],
  laneId: string
): string | undefined {
  const title = lanes.find((l) => l.id === laneId)?.title?.trim();
  if (!title || title === laneId) return undefined;
  return title;
}

export function focusAnchorPath(sessionId: string): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}/focus-anchor`;
}

export function focusAnchorBody(
  payload: PendingAnchorPayload
): { focusId: string; laneTitle?: string; requestId?: string } {
  return {
    focusId: payload.focusId,
    ...(payload.laneTitle ? { laneTitle: payload.laneTitle } : {}),
    ...(payload.requestId ? { requestId: payload.requestId } : {})
  };
}

export function canSendThemedContent(
  phase: AnchorPhase,
  sessionId: string,
  anchoredSessionId: string | null
): boolean {
  return phase === "ready" && Boolean(sessionId) && anchoredSessionId === sessionId;
}

export type ChatSendSurface = "text" | "system_voice" | "cloud_ptt" | "handsfree";

export type ChatSendPlan =
  | { action: "send_text"; text: string }
  | { action: "cloud_ptt_send" }
  | { action: "handsfree_done" }
  | { action: "hold_as_draft"; text: string; reason: string }
  | { action: "block"; reason: string };

export function themedSendReason(phase: AnchorPhase): string {
  return phase === "failed" ? "续接还没接上,请先重试" : "还在接上主题,稍后再发";
}

/** 四个发送面共用当前身份,不用闭包里的 session 自比。 */
export function planChatSend(opts: {
  surface: ChatSendSurface;
  pending: PendingAnchorPayload | null;
  phase: AnchorPhase;
  liveSessionId: string;
  anchoredSessionId: string | null;
  text?: string;
}): ChatSendPlan {
  const blocked =
    opts.pending !== null && !canSendThemedContent(opts.phase, opts.liveSessionId, opts.anchoredSessionId);
  const reason = themedSendReason(opts.phase);
  if (opts.surface === "text" || opts.surface === "system_voice") {
    const text = (opts.text ?? "").trim();
    if (text === "") return { action: "block", reason: "" };
    if (blocked) return { action: "hold_as_draft", text, reason };
    return { action: "send_text", text };
  }
  if (opts.surface === "cloud_ptt") {
    if (blocked) return { action: "hold_as_draft", text: opts.text ?? "", reason };
    return { action: "cloud_ptt_send" };
  }
  if (blocked) return { action: "block", reason };
  return { action: "handsfree_done" };
}

export function mergeLiveDraft(payload: PendingAnchorPayload, liveDraft: string): PendingAnchorPayload {
  return { ...payload, draft: liveDraft };
}

export function shouldApplyAnchorResult(opts: {
  requestGen: number;
  liveGen: number;
  requestedSessionId: string;
  liveSessionId: string;
}): boolean {
  return (
    opts.requestGen === opts.liveGen &&
    opts.requestedSessionId !== "" &&
    opts.requestedSessionId === opts.liveSessionId
  );
}

export async function gateChatSend(opts: {
  pending: PendingAnchorPayload | null;
  phase: AnchorPhase;
  sessionId: string;
  anchoredSessionId: string | null;
  text: string;
  sendText: (text: string) => boolean | Promise<boolean>;
}): Promise<{ sent: boolean; keepDraft: boolean; reason?: string }> {
  const t = opts.text.trim();
  if (t === "") return { sent: false, keepDraft: true };
  if (opts.pending && !canSendThemedContent(opts.phase, opts.sessionId, opts.anchoredSessionId)) {
    return {
      sent: false,
      keepDraft: true,
      reason: opts.phase === "failed" ? "续接还没接上,请先重试" : "还在接上主题,稍后再发"
    };
  }
  const ok = await opts.sendText(t);
  if (!ok) return { sent: false, keepDraft: true, reason: "通道未就绪,内容还在输入框" };
  return { sent: true, keepDraft: false };
}

export function anchoredBannerText(payload: PendingAnchorPayload): string {
  const title = payload.title ?? payload.focusId;
  return payload.laneTitle ? `已接上「${title}」 · 工作线:「${payload.laneTitle}」` : `已接上「${title}」`;
}
