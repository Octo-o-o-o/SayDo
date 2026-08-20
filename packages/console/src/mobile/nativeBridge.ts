import type { FocusRow } from "./types";

export const NATIVE_BRIDGE_VERSION = 1 as const;
export const NATIVE_BRIDGE_HANDLER = "saydoNative";

export interface NativeFocus {
  id: string;
  title: string;
  updatedAt: string;
}

export interface NativeReply {
  sessionId: string;
  turnId: string;
  sentenceId: string;
  text: string;
  origin: "assistant_reply" | "system" | "confirmation" | "onboarding";
}

export interface NativeTranscriptRequest {
  requestId: string;
  captureId: string;
  text: string;
  focusId?: string;
  focusTitle?: string;
  action: "send" | "draft";
}

export type NativeTranscriptResult =
  | { status: "queued_to_socket"; requestId: string; captureId: string }
  | { status: "drafted"; requestId: string; captureId: string }
  | {
      status: "rejected";
      requestId: string;
      captureId: string;
      reason: "invalid_request" | "bridge_inactive" | "offline" | "busy" | "draft_conflict" | "focus_mismatch";
    };

interface NativeMessageHandler {
  postMessage(message: unknown): void;
}

export interface NativeBridgeWindow {
  __saydoNativePageNonce?: string;
  webkit?: { messageHandlers?: Record<string, NativeMessageHandler | undefined> };
  SayDoNativeBridge?: {
    version: typeof NATIVE_BRIDGE_VERSION;
    submitNativeTranscript(input: unknown): Promise<NativeTranscriptResult>;
  };
}

export interface NativeBridgeConnection {
  publishFocuses(focuses: NativeFocus[]): void;
  publishStatus(status: "connecting" | "online" | "offline"): void;
  forwardReply(reply: NativeReply): void;
  dispose(): void;
}

function rejectInvalid(input: unknown): NativeTranscriptResult {
  const value = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  return {
    status: "rejected",
    requestId: typeof value["requestId"] === "string" ? value["requestId"] : "",
    captureId: typeof value["captureId"] === "string" ? value["captureId"] : "",
    reason: "invalid_request"
  };
}

export function parseNativeTranscriptRequest(input: unknown): NativeTranscriptRequest | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const allowed = new Set(["requestId", "captureId", "text", "focusId", "focusTitle", "action"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;
  const hasFocusId = typeof value["focusId"] === "string" && value["focusId"].trim() !== "";
  const hasFocusTitle = typeof value["focusTitle"] === "string" && value["focusTitle"].trim() !== "";
  if (
    typeof value["requestId"] !== "string" || value["requestId"].trim() === "" ||
    typeof value["captureId"] !== "string" || value["captureId"].trim() === "" ||
    typeof value["text"] !== "string" || value["text"].trim() === "" ||
    (value["action"] !== "send" && value["action"] !== "draft") ||
    (value["focusId"] !== undefined && typeof value["focusId"] !== "string") ||
    (value["focusTitle"] !== undefined && typeof value["focusTitle"] !== "string") ||
    hasFocusId !== hasFocusTitle
  ) return null;
  return {
    requestId: value["requestId"],
    captureId: value["captureId"],
    text: value["text"],
    action: value["action"],
    ...(typeof value["focusId"] === "string" ? { focusId: value["focusId"] } : {}),
    ...(typeof value["focusTitle"] === "string" ? { focusTitle: value["focusTitle"] } : {})
  };
}

export function sanitizeNativeFocusTitle(title: string): string {
  return Array.from(title.replace(/\]/gu, "").replace(/[\r\n]+/gu, " ").replace(/\s+/gu, " ").trim())
    .slice(0, 64)
    .join("");
}

export function recentNativeFocuses(rows: FocusRow[] | null): NativeFocus[] {
  if (!rows) return [];
  return rows
    .filter((row) => row.lifecycle === "captured" || row.lifecycle === "active" || row.lifecycle === "dormant")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((row) => ({ id: row.id, title: sanitizeNativeFocusTitle(row.title), updatedAt: row.updatedAt }));
}

export function composeNativeTranscript(request: NativeTranscriptRequest, focuses: NativeFocus[]): string | null {
  const text = request.text.trim();
  if (!request.focusId && !request.focusTitle) return text;
  const focus = focuses.find((item) => item.id === request.focusId);
  if (!focus || focus.title !== sanitizeNativeFocusTitle(request.focusTitle ?? "")) return null;
  return `[关于:${focus.title}] ${text}`;
}

export function installNativeBridge(
  target: NativeBridgeWindow,
  sessionId: string,
  submit: (request: NativeTranscriptRequest) => Promise<NativeTranscriptResult> | NativeTranscriptResult
): NativeBridgeConnection | null {
  const handler = target.webkit?.messageHandlers?.[NATIVE_BRIDGE_HANDLER];
  const pageNonce = target.__saydoNativePageNonce;
  if (!handler || typeof pageNonce !== "string" || pageNonce === "") return null;
  let active = true;
  const post = (type: string, payload: Record<string, unknown> = {}) => {
    if (active) handler.postMessage({ version: NATIVE_BRIDGE_VERSION, pageNonce, type, ...payload });
  };
  target.SayDoNativeBridge = {
    version: NATIVE_BRIDGE_VERSION,
    async submitNativeTranscript(input: unknown) {
      if (!active) {
        const invalid = rejectInvalid(input);
        return { ...invalid, reason: "bridge_inactive" };
      }
      const request = parseNativeTranscriptRequest(input);
      return request ? await submit(request) : rejectInvalid(input);
    }
  };
  post("page-ready", { sessionId });
  return {
    publishFocuses: (focuses) => post("focuses", { focuses }),
    publishStatus: (status) => post("status", { status }),
    forwardReply: (reply) => post("reply", { reply }),
    dispose() {
      active = false;
      if (target.SayDoNativeBridge?.version === NATIVE_BRIDGE_VERSION) delete target.SayDoNativeBridge;
    }
  };
}
