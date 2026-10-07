// 跨 Chat 卸载仍存活的主题屏障串行协调:prepare → HTTP → rearm。

import { newId, VOICE_QUIESCE_TIMEOUT_MS } from "@saydo/contracts";
import { sessionStoragePort } from "./sessionStoragePort";
import { apiPost } from "./api";
import {
  focusAnchorBody,
  focusAnchorPath,
  mergeLiveDraft,
  writePendingAnchor,
  type PendingAnchorPayload
} from "./pendingAnchor";

export type AnchorStatusEvent = {
  sessionId: string;
  requestId: string;
  status: "prepared" | "rearmed" | "rejected";
  code?: string;
  retryable?: boolean;
  unknownEpochs?: number[];
  emptyRound?: "empty" | "unusable";
};

export type AnchorStatusWait = {
  sessionId: string;
  requestId: string;
  statuses: ReadonlyArray<AnchorStatusEvent["status"]>;
};

export type VoiceAnchorPort = {
  sessionId: string;
  daemonEpoch: string | null;
  connected: boolean;
  micActive: boolean;
  mode: "ptt" | "hands_free";
  stopMic: () => void;
  finalizeRecordingEdit: () => void;
  sendPrepare: (payload: PendingAnchorPayload & { requestId: string; daemonEpoch: string }) => boolean;
  sendRearm: (requestId: string) => boolean;
  waitStatus: (spec: AnchorStatusWait) => Promise<AnchorStatusEvent>;
  cancelWait: (requestId: string) => void;
};

type FlowResult =
  | { status: "ready"; sessionId: string; requestId: string }
  | { status: "failed"; payload: PendingAnchorPayload; reason: string; unknownEpochs?: number[]; code?: string }
  | { status: "stale" };

let tail: Promise<void> = Promise.resolve();

export const STATUS_TIMEOUT_MS = VOICE_QUIESCE_TIMEOUT_MS;

/** 已收到 failed / voice_request_dead / 跨 epoch unknown 后必须换新 ID。 */
export function shouldRenewAnchorRequestId(code?: string): boolean {
  return (
    code === "voice_request_dead" ||
    code === "unknown" ||
    code === "voice_quiesce_timeout" ||
    code === "voice_quiesce_disconnected" ||
    code === "voice_recognition_failed" ||
    code === "voice_quiesce_unsupported" ||
    code === "voice_handover_overflow"
  );
}

export function stripAnchorRequestId(payload: PendingAnchorPayload): PendingAnchorPayload {
  const next = { ...payload };
  delete next.requestId;
  return next;
}

export function retryAnchorPayload(
  pending: PendingAnchorPayload,
  liveDraft: string,
  lastCode?: string
): PendingAnchorPayload {
  const next: PendingAnchorPayload = { ...pending, draft: liveDraft };
  if (shouldRenewAnchorRequestId(lastCode)) delete next.requestId;
  return next;
}

export function ensureAnchorIdentity(
  payload: PendingAnchorPayload,
  daemonEpoch: string,
  opts?: { renew?: boolean }
): PendingAnchorPayload {
  const sameEpoch = payload.daemonEpoch === daemonEpoch;
  const requestId = !opts?.renew && sameEpoch && payload.requestId ? payload.requestId : newId("evt");
  return {
    ...payload,
    requestId,
    daemonEpoch
  };
}

export async function runVoiceAnchorFlow(opts: {
  ownerOk: () => boolean;
  payload: PendingAnchorPayload;
  liveDraft: () => string;
  persist: (payload: PendingAnchorPayload) => unknown;
  port: VoiceAnchorPort;
}): Promise<FlowResult> {
  let settle!: (result: FlowResult) => void;
  const result = new Promise<FlowResult>((resolve) => {
    settle = resolve;
  });
  let current = opts.payload;
  let activeWait: string | undefined;
  tail = tail.catch(() => undefined).then(async () => {
    if (!opts.ownerOk()) {
      settle({ status: "stale" });
      return;
    }
    const persist = (base: PendingAnchorPayload): PendingAnchorPayload => {
      const next = mergeLiveDraft(base, opts.liveDraft());
      if (!opts.ownerOk()) throw new Error("anchor owner changed");
      current = next;
      if (opts.persist(next) === false || !writePendingAnchor(sessionStoragePort, next)) {
        throw new Error("anchor draft persistence failed");
      }
      return next;
    };
    if (!opts.port.connected || !opts.port.daemonEpoch) {
      settle({ status: "failed", payload: persist(opts.payload), reason: "还没接到当前对话,草稿还在,可重试" });
      return;
    }
    const identified = persist(ensureAnchorIdentity(opts.payload, opts.port.daemonEpoch));
    if (!identified.requestId || !identified.daemonEpoch) {
      settle({ status: "failed", payload: identified, reason: "续接没接上,草稿还在,可重试" });
      return;
    }
    const pttLive = opts.port.micActive && opts.port.mode === "ptt";
    opts.port.stopMic();
    if (pttLive) opts.port.finalizeRecordingEdit();
    activeWait = identified.requestId;
    const preparedWait = opts.port.waitStatus({
      sessionId: opts.port.sessionId,
      requestId: identified.requestId,
      statuses: ["prepared", "rejected"]
    });
    void preparedWait.catch(() => undefined);
    if (
      !opts.port.sendPrepare({
        ...identified,
        requestId: identified.requestId,
        daemonEpoch: identified.daemonEpoch
      })
    ) {
      opts.port.cancelWait(identified.requestId);
      settle({ status: "failed", payload: persist(identified), reason: "还没接到当前对话,草稿还在,可重试" });
      return;
    }
    let prepared: AnchorStatusEvent;
    try {
      prepared = await withStatusTimeout(preparedWait, identified.requestId, opts.port);
    } catch {
      if (!opts.ownerOk()) {
        settle({ status: "stale" });
        return;
      }
      settle({ status: "failed", payload: persist(identified), reason: "续接没接上,草稿还在,可重试" });
      return;
    }
    if (!opts.ownerOk()) {
      settle({ status: "stale" });
      return;
    }
    if (prepared.status === "rearmed" && prepared.sessionId === opts.port.sessionId) {
      persist(identified);
      settle({ status: "ready", sessionId: opts.port.sessionId, requestId: identified.requestId });
      return;
    }
    if (prepared.status !== "prepared") {
      const payload = shouldRenewAnchorRequestId(prepared.code)
        ? persist(stripAnchorRequestId(identified))
        : persist(identified);
      settle({
        status: "failed",
        payload,
        reason:
          prepared.code === "voice_audio_unknown"
            ? "上次语音未确认保存,可返回处理,或放弃这段未确认语音后继续"
            : "续接没接上,草稿还在,可重试",
        unknownEpochs: prepared.unknownEpochs,
        code: prepared.code
      });
      return;
    }
    persist(identified);
    try {
      await apiPost(focusAnchorPath(opts.port.sessionId), focusAnchorBody(identified));
    } catch {
      if (!opts.ownerOk()) {
        settle({ status: "stale" });
        return;
      }
      settle({ status: "failed", payload: persist(identified), reason: "续接没接上,草稿还在,可重试" });
      return;
    }
    if (!opts.ownerOk()) {
      settle({ status: "stale" });
      return;
    }
    persist(identified);
    const rearmedWait = opts.port.waitStatus({
      sessionId: opts.port.sessionId,
      requestId: identified.requestId,
      statuses: ["rearmed", "rejected"]
    });
    void rearmedWait.catch(() => undefined);
    if (!opts.port.sendRearm(identified.requestId)) {
      opts.port.cancelWait(identified.requestId);
      settle({ status: "failed", payload: persist(identified), reason: "续接还没放开语音,草稿还在,可重试" });
      return;
    }
    let rearmed: AnchorStatusEvent;
    try {
      rearmed = await withStatusTimeout(rearmedWait, identified.requestId, opts.port);
    } catch {
      if (!opts.ownerOk()) {
        settle({ status: "stale" });
        return;
      }
      settle({ status: "failed", payload: persist(identified), reason: "续接还没放开语音,草稿还在,可重试" });
      return;
    }
    if (!opts.ownerOk()) {
      settle({ status: "stale" });
      return;
    }
    if (rearmed.status !== "rearmed" || rearmed.sessionId !== opts.port.sessionId) {
      settle({ status: "failed", payload: persist(identified), reason: "续接还没放开语音,草稿还在,可重试" });
      return;
    }
    persist(identified);
    settle({ status: "ready", sessionId: opts.port.sessionId, requestId: identified.requestId });
  }).catch(() => {
    // 同步 port 异常、存储 getter 和异步等待异常都结算，不让共享尾链锁死。
    if (activeWait) {
      try { opts.port.cancelWait(activeWait); } catch { /* 仍须结算外部 Promise。 */ }
    }
    let owned = false;
    try { owned = opts.ownerOk(); } catch { /* 无法确认 owner 时不再写。 */ }
    settle(owned
      ? { status: "failed", payload: current, reason: "续接或草稿保存失败,当前稿还在,可重试" }
      : { status: "stale" });
  });
  return result;
}

function withStatusTimeout(
  wait: Promise<AnchorStatusEvent>,
  requestId: string,
  port: Pick<VoiceAnchorPort, "cancelWait">
): Promise<AnchorStatusEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { port.cancelWait(requestId); } catch { /* 取消失败仍按超时结算，不抛出定时器。 */ }
      reject(new Error(`anchor status timeout ${requestId}`));
    }, STATUS_TIMEOUT_MS);
    wait.then(
      (ev) => {
        clearTimeout(timer);
        resolve(ev);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function resetVoiceAnchorFlowForTests(): void {
  tail = Promise.resolve();
}
