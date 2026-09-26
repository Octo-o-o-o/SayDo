// 09 §10.1 主题锚定语音屏障:daemon 进程内账本与关门点。
// 形状只从 @saydo/contracts 进口;本模块是 hub/HTTP 的唯一协议决策点。

import {
  CAPTURE_REGISTRY_PER_SID,
  FOCUS_ANCHOR_RECORDS_PER_SID,
  HANDOVER_PER_SID,
  PIPELINE_EPOCH_MAX,
  PIPELINE_EPOCH_MIN,
  TURN_RECEIPT_GLOBAL,
  TURN_RECEIPT_PER_SID,
  TURN_RECEIPT_TTL_MS,
  VOICE_QUIESCE_TIMEOUT_MS,
  arraysEqual,
  digestOfText,
  focusAnchorErrSchema,
  focusAnchorLegacyOkSchema,
  focusAnchorOkSchema,
  focusAnchorPayloadDigest,
  focusAnchorRequestBodySchema,
  isClassifiedAsrFinal,
  newId,
  normalizeLaneTitle,
  sameFocusLane,
  type AsrFinalMsg,
  type CaptureRegistryEntry,
  type EmptyRound,
  type FocusAnchorErr,
  type FocusAnchorLegacyOk,
  type FocusAnchorOk,
  type FocusAnchorRecord,
  type FocusAnchorRequestBody,
  type PipelineMsg,
  type RuntimeIdentity,
  type TurnTextMsg,
  type TurnTextResult,
  type UnconfirmedAudioEpoch,
  type VoiceAnchorStatus
} from "@saydo/contracts";
import type { IdentityVia } from "../net/identity.js";

export type BarrierAudit = (action: string, meta: Record<string, unknown>) => void;

export interface VoiceBarrierSink {
  now(): number;
  sendToPeer(peerId: string, msg: PipelineMsg): void;
  sendToLocalSession(sessionId: string, msg: PipelineMsg): void;
  sendToPipeline(msg: PipelineMsg): boolean;
  isPeerOpen(peerId: string): boolean;
  peerVia(peerId: string): IdentityVia | undefined;
  registerSession(peerId: string, sessionId: string): void;
  closeCaptureGate(): void;
  openCaptureGate(): void;
  prewriteLastVoiceModePtt(sessionId: string): void;
  hasPipelinePeer(): boolean;
  currentPipelineIdentity(): RuntimeIdentity | undefined;
  getSourceFocusId(sessionId: string): string | undefined;
  audit: BarrierAudit;
  /** 轮次被封闭后立刻结算对应 speechGen。缺省时由 hub 在分发结束再排空。 */
  onRoundsRetired?: () => void;
}

export type AsrFinalDecision = {
  broadcast: boolean;
  brain: boolean;
  /** 已拥有的语音轮应结算 speechPending;过期/错 epoch 为 false,不得解锁新轮。 */
  settleSpeech: boolean;
  speechGen?: number;
};

export type TurnTextBegin =
  | { kind: "drop" }
  | { kind: "result"; result: TurnTextResult }
  | { kind: "execute"; result: null };

export type HttpAnchorWrite = (input: {
  sessionId: string;
  focusId: string;
  laneTitle?: string;
}) => { already: boolean };

type HandoverItem = Extract<PipelineMsg, { t: "voice.quiesced_transcript" }>;

type HfSegRuntime = {
  hfSegmentId: string;
  recordSeq: number;
  speechEnded: boolean;
};

type HfRoundRuntime = {
  sessionId: string;
  epoch: number;
  hfRoundId: string;
  speechGen: number;
  segments: HfSegRuntime[];
  terminal: boolean;
  /** discarded=显式放弃墓碑;retired=失败/断连/切模式后的隔离,账本仍是 unknown。 */
  tombstone?: "discarded" | "retired";
};

type HfVadIdentity = { hfSegmentId: string; hfRoundId: string; recordSeq: number };

type ReceiptSettled = {
  status: "settled";
  result: TurnTextResult;
  textDigest: string;
  daemonEpoch: string;
  at: number;
};

type ReceiptPending = {
  status: "pending";
  textDigest: string;
  daemonEpoch: string;
  waiters: Array<(result: TurnTextResult) => void>;
};

type ReceiptEntry = ReceiptSettled | ReceiptPending;

function keyOf(sessionId: string, requestId: string): string {
  return `${sessionId}:${requestId}`;
}

function receiptKey(sessionId: string, turnId: string): string {
  return `${sessionId}:${turnId}`;
}

function handoverKey(sessionId: string, requestId: string, turnId: string): string {
  return `${sessionId}:${requestId}:${turnId}`;
}

function rejectStatus(sessionId: string, requestId: string, code: string, retryable: boolean, unknownEpochs?: number[]): VoiceAnchorStatus {
  if (code === "voice_audio_unknown" && unknownEpochs && unknownEpochs.length > 0) {
    return {
      t: "voice.anchor_status",
      sessionId,
      requestId,
      status: "rejected",
      code: "voice_audio_unknown",
      retryable: true,
      unknownEpochs
    };
  }
  return { t: "voice.anchor_status", sessionId, requestId, status: "rejected", code, retryable };
}

function httpErr(code: string, retryable: boolean, message?: string): { status: number; payload: FocusAnchorErr } {
  const payload = focusAnchorErrSchema.parse({
    ok: false,
    code,
    retryable,
    ...(message ? { message } : {})
  });
  const status = code === "invalid_input" ? 400 : 409;
  return { status, payload };
}

export class VoiceBarrier {
  readonly daemonEpoch: string;
  pipelineEpoch = 0;
  captureGateClosed = false;
  gateOwnerSid: string | undefined;
  private readonly usedPeerIds = new Set<string>();
  private readonly records = new Map<string, Map<string, FocusAnchorRecord>>();
  private readonly registry = new Map<string, Map<string, CaptureRegistryEntry>>();
  private readonly ledger: UnconfirmedAudioEpoch[] = [];
  private readonly informedUnknown = new Set<string>();
  private readonly legacyPendingDone = new Map<string, number>();
  private readonly unclassifiedInflight = new Set<string>();
  private readonly handover = new Map<string, HandoverItem>();
  private readonly receipts = new Map<string, ReceiptEntry>();
  private readonly receiptOrder: string[] = [];
  private hfSeq = 0;
  private readonly quiesceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly waitingQuiesce = new Map<string, { sessionId: string; requestId: string; epoch: number; identity?: RuntimeIdentity }>();
  private readonly pendingHandover = new Map<string, HandoverItem[]>();
  private readonly hfHoldAfterFail = new Set<string>();
  private readonly speechGenBySid = new Map<string, number>();
  private readonly captureSpeechGen = new Map<string, number>();
  /** HF 开口时的语音世代;内部所有权,不进合同账本形状。 */
  private readonly hfSpeechGen = new Map<string, number>();
  /** 新协议逻辑轮。键 = sid:epoch:hfRoundId。 */
  private readonly hfRounds = new Map<string, HfRoundRuntime>();
  /** sid:epoch 下一个 recordSeq。只按本键递增,放弃/切模式不回绕、不清其它键。 */
  private readonly nextRecordSeq = new Map<string, number>();
  /** 已消费的 legacy HF final。同一 turn 不得再吃下一条闭合项。 */
  private readonly legacyConsumedTurns = new Set<string>();
  /** 模式实际转发给 pipeline 的最后一档。重复同 sid+mode 不退役。 */
  private forwardedMode: { sessionId: string; mode: "ptt" | "hands_free" } | undefined;
  private readonly retiredSpeech: Array<{ sessionId: string; speechGen: number }> = [];

  constructor(
    private readonly sink: VoiceBarrierSink,
    daemonEpoch = newId("evt")
  ) {
    this.daemonEpoch = daemonEpoch;
  }

  issuePeerId(): string {
    let id = newId("evt");
    while (this.usedPeerIds.has(id)) id = newId("evt");
    this.usedPeerIds.add(id);
    return id;
  }

  setPipelineEpoch(epoch: number): void {
    this.pipelineEpoch = epoch;
  }

  currentEpoch(): number | undefined {
    if (!this.sink.hasPipelinePeer()) return undefined;
    if (this.pipelineEpoch < PIPELINE_EPOCH_MIN || this.pipelineEpoch > PIPELINE_EPOCH_MAX) return undefined;
    return this.pipelineEpoch;
  }

  recordFor(sessionId: string, requestId: string): FocusAnchorRecord | undefined {
    return this.records.get(sessionId)?.get(requestId);
  }

  /** 当前已提交的语音锚。rearmed 优先于 applied。准备中/失败/已消费不算。 */
  appliedAnchor(sessionId: string): { focusId: string; requestId: string } | null {
    let applied: { focusId: string; requestId: string } | null = null;
    for (const rec of this.sidRecords(sessionId).values()) {
      if (rec.state === "rearmed") return { focusId: rec.focusId, requestId: rec.requestId };
      if (rec.state === "applied") applied = { focusId: rec.focusId, requestId: rec.requestId };
    }
    return applied;
  }

  unknownEpochs(sessionId: string): number[] {
    const set = new Set<number>();
    for (const item of this.ledger) {
      if (item.sessionId === sessionId && item.state === "unknown") set.add(item.epoch);
    }
    return [...set].sort((a, b) => a - b);
  }

  registryEntries(sessionId: string): CaptureRegistryEntry[] {
    return [...(this.registry.get(sessionId)?.values() ?? [])];
  }

  ledgerEntries(sessionId: string): UnconfirmedAudioEpoch[] {
    return this.ledger.filter((item) => item.sessionId === sessionId).map((item) => ({ ...item }));
  }

  private sidRecords(sessionId: string): Map<string, FocusAnchorRecord> {
    let map = this.records.get(sessionId);
    if (!map) {
      map = new Map();
      this.records.set(sessionId, map);
    }
    return map;
  }

  private sidRegistry(sessionId: string): Map<string, CaptureRegistryEntry> {
    let map = this.registry.get(sessionId);
    if (!map) {
      map = new Map();
      this.registry.set(sessionId, map);
    }
    return map;
  }

  private liveOwnerSid(sessionId: string): string | undefined {
    for (const rec of this.sidRecords(sessionId).values()) {
      if (this.sink.isPeerOpen(rec.ownerPeerId)) return rec.ownerPeerId;
    }
    return undefined;
  }

  private liveOwnerAny(sessionId: string): FocusAnchorRecord | undefined {
    for (const rec of this.sidRecords(sessionId).values()) {
      if (this.sink.isPeerOpen(rec.ownerPeerId)) return rec;
    }
    return undefined;
  }

  private pendingRegistryCount(sessionId: string, epochs?: number[]): number {
    let n = 0;
    for (const entry of this.sidRegistry(sessionId).values()) {
      if (entry.consumed) continue;
      if (epochs && !epochs.includes(entry.epoch)) continue;
      n += 1;
    }
    return n;
  }

  private hasUnconfirmed(sessionId: string): boolean {
    return this.ledger.some((item) => item.sessionId === sessionId && item.state === "unconfirmed");
  }

  private hasUnclassified(sessionId: string): boolean {
    return (this.legacyPendingDone.get(sessionId) ?? 0) > 0 || this.unclassifiedInflight.has(sessionId);
  }

  private currentEpochNeedsDrain(sessionId: string, discard?: number[]): boolean {
    const epoch = this.currentEpoch();
    if (epoch === undefined) return false;
    if (discard?.includes(epoch)) return true;
    return this.ledger.some(
      (item) =>
        item.sessionId === sessionId &&
        item.epoch === epoch &&
        (item.state === "unconfirmed" || item.state === "unknown")
    );
  }

  private canImmediatePrepared(sessionId: string, discard?: number[]): boolean {
    const unknown = this.unknownEpochs(sessionId);
    const unknownEmpty = unknown.length === 0 || (discard !== undefined && arraysEqual(unknown, discard));
    return (
      unknownEmpty &&
      !this.hasUnconfirmed(sessionId) &&
      this.pendingRegistryCount(sessionId) === 0 &&
      !this.hasUnclassified(sessionId) &&
      !this.currentEpochNeedsDrain(sessionId, discard)
    );
  }

  private sidHasOpenOwner(sessionId: string): boolean {
    return this.liveOwnerSid(sessionId) !== undefined;
  }

  private canDecideDiscard(sessionId: string, peerId: string): boolean {
    const via = this.sink.peerVia(peerId);
    if (via !== undefined && via !== "local") return false;
    const live = this.liveOwnerAny(sessionId);
    if (live) return live.ownerPeerId === peerId;
    return !this.sidHasOpenOwner(sessionId);
  }

  private canTakeOver(sessionId: string, requestId: string, peerId: string): boolean {
    const rec = this.recordFor(sessionId, requestId);
    if (!rec) return false;
    if (rec.state === "consumed" || rec.state === "failed") return false;
    if (this.sink.isPeerOpen(rec.ownerPeerId)) return rec.ownerPeerId === peerId;
    return true;
  }

  private sendStatus(peerId: string, status: VoiceAnchorStatus): void {
    this.sink.sendToPeer(peerId, status);
  }

  private markConsumedPrior(sessionId: string, exceptRequestId: string): void {
    const map = this.sidRecords(sessionId);
    let hadRearmed = false;
    for (const rec of map.values()) {
      if (rec.requestId === exceptRequestId) continue;
      if (rec.state === "preparing") continue;
      if (rec.state === "prepared" || rec.state === "applied" || rec.state === "rearmed") {
        if (rec.state === "rearmed") hadRearmed = true;
        rec.state = "consumed";
      }
    }
    if (hadRearmed && !this.captureGateClosed) {
      this.captureGateClosed = true;
      this.gateOwnerSid = sessionId;
      this.sink.closeCaptureGate();
    }
  }

  private closeGates(sessionId: string): void {
    this.captureGateClosed = true;
    this.gateOwnerSid = sessionId;
    this.sink.closeCaptureGate();
    this.sink.prewriteLastVoiceModePtt(sessionId);
  }

  asrBrainGated(sessionId: string): boolean {
    let failedOpen = false;
    for (const rec of this.sidRecords(sessionId).values()) {
      if (rec.state === "preparing" || rec.state === "prepared" || rec.state === "applied") return true;
      if (rec.state === "failed") failedOpen = true;
      if (rec.state === "rearmed" || rec.state === "consumed") failedOpen = false;
    }
    return failedOpen;
  }

  private applyDiscard(sessionId: string, epochs: number[]): void {
    const epochSet = new Set(epochs);
    for (const item of this.ledger) {
      if (item.sessionId === sessionId && epochSet.has(item.epoch) && item.state === "unknown") {
        item.state = "discarded";
      }
    }
    const reg = this.sidRegistry(sessionId);
    for (const [captureId, entry] of reg) {
      if (!epochSet.has(entry.epoch) || entry.consumed) continue;
      reg.set(captureId, { ...entry, consumed: true, discarded: true });
    }
    this.discardRounds(sessionId, epochSet);
    this.sink.audit("voice.discard_unknown", {
      sessionId,
      epochs,
      ownerPeerId: this.liveOwnerSid(sessionId)
    });
  }

  /** 只封闭本 sid、本 epoch 上已经进入本次 discard 的轮。纯 unconfirmed 新轮不动,seq 计数不回绕。 */
  private discardRounds(sessionId: string, epochs: Set<number>): void {
    for (const round of this.hfRounds.values()) {
      if (round.sessionId !== sessionId || !epochs.has(round.epoch)) continue;
      const rows = round.segments.map((seg) => this.segmentRow(sessionId, round.epoch, seg.hfSegmentId));
      const touchesDiscard = rows.some((row) => row?.state === "unknown" || row?.state === "discarded");
      if (!touchesDiscard) continue;
      if (round.terminal && round.tombstone === "discarded") continue;
      const wasOpen = !round.terminal;
      round.terminal = true;
      round.tombstone = "discarded";
      if (wasOpen) this.queueSpeechSettlement(sessionId, round.speechGen);
    }
  }

  private segmentRow(sessionId: string, epoch: number, hfSegmentId: string) {
    return this.ledger.find(
      (row) => row.sessionId === sessionId && row.epoch === epoch && row.hfSegmentId === hfSegmentId
    );
  }

  private queueSpeechSettlement(sessionId: string, speechGen: number): void {
    this.retiredSpeech.push({ sessionId, speechGen });
    this.sink.onRoundsRetired?.();
  }

  drainSpeechSettlements(): Array<{ sessionId: string; speechGen: number }> {
    return this.retiredSpeech.splice(0, this.retiredSpeech.length);
  }

  /**
   * 与 pipeline 的 voice.mode 退役对齐:仅 mode 或 sid 变化时,把上一 sid 当前 epoch
   * 仍 unconfirmed 的 HF 标 unknown 并封闭其轮。不删账,不把 unknown 写成 discarded。
   */
  observeForwardedMode(sessionId: string, mode: "ptt" | "hands_free"): void {
    const prev = this.forwardedMode;
    if (prev && prev.sessionId === sessionId && prev.mode === mode) return;
    this.forwardedMode = { sessionId, mode };
    if (!prev?.sessionId) return;
    const epoch = this.currentEpoch();
    if (epoch === undefined) return;
    this.retireInFlightHf(prev.sessionId, epoch);
  }

  private retireInFlightHf(sessionId: string, epoch: number): void {
    for (const item of this.ledger) {
      if (
        item.sessionId === sessionId &&
        item.epoch === epoch &&
        item.kind === "hands_free" &&
        item.state === "unconfirmed"
      ) {
        item.state = "unknown";
      }
    }
    this.tombstoneOpenRounds(sessionId, epoch, "retired");
  }

  private tombstoneOpenRounds(sessionId: string, epoch: number, tombstone: "discarded" | "retired"): void {
    for (const round of this.hfRounds.values()) {
      if (round.sessionId !== sessionId || round.epoch !== epoch || round.terminal) continue;
      round.terminal = true;
      round.tombstone = tombstone;
      this.queueSpeechSettlement(sessionId, round.speechGen);
    }
  }

  private sealFinishedRounds(sessionId: string, epoch: number): void {
    for (const round of this.hfRounds.values()) {
      if (round.sessionId !== sessionId || round.epoch !== epoch || round.terminal) continue;
      const stillOpen = round.segments.some(
        (seg) => this.segmentRow(sessionId, epoch, seg.hfSegmentId)?.state === "unconfirmed"
      );
      if (stillOpen) continue;
      round.terminal = true;
      this.queueSpeechSettlement(sessionId, round.speechGen);
    }
  }

  handlePrepare(
    msg: Extract<PipelineMsg, { t: "voice.anchor_prepare" }>,
    sourcePeer: string
  ): void {
    const { sessionId, requestId } = msg;
    if (this.sink.peerVia(sourcePeer) === "mobile_lan") return;
    if (msg.daemonEpoch !== this.daemonEpoch) {
      this.sink.registerSession(sourcePeer, sessionId);
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "unknown", false));
      return;
    }
    let digest: string;
    try {
      digest = focusAnchorPayloadDigest({
        focusId: msg.focusId,
        ...(msg.laneTitle ? { laneTitle: msg.laneTitle } : {}),
        ...(msg.discardUnknownEpochs ? { discardUnknownEpochs: msg.discardUnknownEpochs } : {})
      });
    } catch {
      this.sink.registerSession(sourcePeer, sessionId);
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "invalid_input", false));
      return;
    }
    const discard = msg.discardUnknownEpochs;
    const unknown = this.unknownEpochs(sessionId);
    const informedKey = keyOf(sessionId, requestId);
    const existing = this.recordFor(sessionId, requestId);
    if (existing) {
      if (existing.payloadDigest !== digest) {
        this.sink.registerSession(sourcePeer, sessionId);
        this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "idempotency_conflict", false));
        return;
      }
      if (existing.state === "failed") {
        this.sink.registerSession(sourcePeer, sessionId);
        this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_request_dead", false));
        return;
      }
      if (existing.state === "consumed") {
        this.sink.registerSession(sourcePeer, sessionId);
        this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_boundary_consumed", false));
        return;
      }
      const ownerLive = this.sink.isPeerOpen(existing.ownerPeerId);
      if (ownerLive && existing.ownerPeerId !== sourcePeer) {
        this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_peer_mismatch", true));
        return;
      }
      if (!ownerLive) existing.ownerPeerId = sourcePeer;
      this.sink.registerSession(sourcePeer, sessionId);
      this.replayRecordStatus(existing, sourcePeer);
      return;
    }

    if (discard && discard.length > 0 && this.informedUnknown.has(informedKey)) {
      this.sink.registerSession(sourcePeer, sessionId);
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "invalid_input", false));
      return;
    }
    if (discard && discard.length > 0 && unknown.length === 0) {
      this.sink.registerSession(sourcePeer, sessionId);
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "invalid_input", false));
      return;
    }

    if (this.hasUnclassified(sessionId)) {
      this.sink.registerSession(sourcePeer, sessionId);
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_unclassified_inflight", true));
      return;
    }

    const live = this.liveOwnerAny(sessionId);
    if (live && live.ownerPeerId !== sourcePeer && this.sink.isPeerOpen(live.ownerPeerId)) {
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_peer_mismatch", true));
      return;
    }
    if (!this.canDecideDiscard(sessionId, sourcePeer) && discard && discard.length > 0) {
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_peer_mismatch", true));
      return;
    }

    if (this.captureGateClosed && this.gateOwnerSid && this.gateOwnerSid !== sessionId) {
      this.sink.registerSession(sourcePeer, sessionId);
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_capture_conflict", true));
      return;
    }

    for (const rec of this.sidRecords(sessionId).values()) {
      if (rec.state === "preparing" && rec.requestId !== requestId) {
        this.sink.registerSession(sourcePeer, sessionId);
        this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_anchor_busy", true));
        return;
      }
    }

    if (unknown.length > 0 && (discard === undefined || !arraysEqual(unknown, discard))) {
      this.informedUnknown.add(informedKey);
      this.sink.registerSession(sourcePeer, sessionId);
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_audio_unknown", true, unknown));
      return;
    }

    const map = this.sidRecords(sessionId);
    if (map.size >= FOCUS_ANCHOR_RECORDS_PER_SID) {
      this.sink.registerSession(sourcePeer, sessionId);
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_anchor_capacity", false));
      return;
    }

    if (discard && discard.length > 0) this.applyDiscard(sessionId, discard);

    if (!this.canImmediatePrepared(sessionId, discard) && !this.sink.hasPipelinePeer()) {
      for (const item of this.ledger) {
        if (item.sessionId === sessionId && item.state === "unconfirmed") item.state = "unknown";
      }
      const leftover = this.unknownEpochs(sessionId);
      this.informedUnknown.add(informedKey);
      this.sink.registerSession(sourcePeer, sessionId);
      if (leftover.length === 0) {
        this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_unclassified_inflight", true));
      } else {
        this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_audio_unknown", true, leftover));
      }
      return;
    }
    if (!this.canImmediatePrepared(sessionId, discard) && this.currentEpoch() === undefined) {
      this.sink.registerSession(sourcePeer, sessionId);
      this.sendStatus(sourcePeer, rejectStatus(sessionId, requestId, "voice_quiesce_disconnected", true));
      return;
    }

    this.markConsumedPrior(sessionId, requestId);
    this.sink.registerSession(sourcePeer, sessionId);
    this.closeGates(sessionId);

    const laneTitle = normalizeLaneTitle(msg.laneTitle);
    const rec: FocusAnchorRecord = {
      sessionId,
      requestId,
      payloadDigest: digest,
      focusId: msg.focusId,
      ownerPeerId: sourcePeer,
      state: "preparing",
      ...(laneTitle ? { laneTitle } : {}),
      ...(discard ? { discardUnknownEpochs: discard } : {})
    };
    map.set(requestId, rec);
    this.sink.audit("voice.anchor_prepare", {
      sessionId,
      requestId,
      focusId: msg.focusId,
      peerId: sourcePeer,
      daemonEpoch: this.daemonEpoch,
      payloadDigest: digest
    });

    if (this.canImmediatePrepared(sessionId, discard)) {
      this.enterPrepared(rec);
      return;
    }
    const epoch = this.currentEpoch();
    if (epoch === undefined) {
      this.failRecord(rec, "voice_quiesce_disconnected", true);
      return;
    }
    const quiesce: Extract<PipelineMsg, { t: "voice.quiesce" }> = {
      t: "voice.quiesce",
      sessionId,
      requestId,
      epoch,
      ...(discard ? { discardUnknownEpochs: discard } : {})
    };
    const identity = this.sink.currentPipelineIdentity();
    this.waitingQuiesce.set(requestId, {
      sessionId,
      requestId,
      epoch,
      ...(identity ? { identity } : {})
    });
    this.pendingHandover.set(requestId, []);
    const sent = this.sink.sendToPipeline(quiesce);
    if (!sent) {
      this.onPipelineDisconnected();
      return;
    }
    const timer = setTimeout(() => {
      const current = this.recordFor(sessionId, requestId);
      if (current?.state === "preparing") this.failRecord(current, "voice_quiesce_timeout", true);
    }, VOICE_QUIESCE_TIMEOUT_MS);
    timer.unref?.();
    this.quiesceTimers.set(requestId, timer);
  }

  private replayRecordStatus(rec: FocusAnchorRecord, peerId: string): void {
    if (rec.state === "preparing") return;
    if (rec.state === "prepared" || rec.state === "applied") {
      this.sendStatus(peerId, {
        t: "voice.anchor_status",
        sessionId: rec.sessionId,
        requestId: rec.requestId,
        status: "prepared",
        ...(rec.emptyRound ? { emptyRound: rec.emptyRound } : {})
      });
      this.replayHandover(rec.sessionId);
      return;
    }
    if (rec.state === "rearmed") {
      this.sendStatus(peerId, {
        t: "voice.anchor_status",
        sessionId: rec.sessionId,
        requestId: rec.requestId,
        status: "rearmed"
      });
      this.replayHandover(rec.sessionId);
    }
  }

  private enterPrepared(rec: FocusAnchorRecord, emptyRound?: EmptyRound): void {
    rec.state = "prepared";
    if (emptyRound) rec.emptyRound = emptyRound;
    this.flushHandover(rec);
    this.sendStatus(rec.ownerPeerId, {
      t: "voice.anchor_status",
      sessionId: rec.sessionId,
      requestId: rec.requestId,
      status: "prepared",
      ...(emptyRound ? { emptyRound } : {})
    });
  }

  private failRecord(rec: FocusAnchorRecord, code: string, retryable: boolean): void {
    rec.state = "failed";
    rec.failedCode = code;
    this.hfHoldAfterFail.add(rec.sessionId);
    const reg = this.sidRegistry(rec.sessionId);
    for (const [captureId, entry] of reg) {
      if (entry.consumed) continue;
      reg.set(captureId, { ...entry, consumed: true, discarded: true });
    }
    const wait = this.waitingQuiesce.get(rec.requestId);
    if (wait) this.markEpochUnknown(rec.sessionId, wait.epoch);
    this.clearQuiesceWait(rec.requestId);
    this.sendStatus(rec.ownerPeerId, rejectStatus(rec.sessionId, rec.requestId, code, retryable));
  }

  onConsolePeerGone(_peerId: string): void {
    // console 断线不取消 pipeline 排空,也不因页面消失/failed/无活 peer 开门。
    // 同 requestId 新 socket 接管;开门只走 matching rearm 或会话结束清理。
  }

  private clearQuiesceWait(requestId: string): void {
    const timer = this.quiesceTimers.get(requestId);
    if (timer) clearTimeout(timer);
    this.quiesceTimers.delete(requestId);
    this.waitingQuiesce.delete(requestId);
  }

  private markEpochUnknown(sessionId: string, epoch: number): void {
    for (const item of this.ledger) {
      if (item.sessionId === sessionId && item.epoch === epoch && item.state === "unconfirmed") {
        item.state = "unknown";
      }
    }
    this.tombstoneOpenRounds(sessionId, epoch, "retired");
  }

  private confirmEpochRemainder(sessionId: string, epoch: number): void {
    for (const item of this.ledger) {
      if (item.sessionId === sessionId && item.epoch === epoch && item.state === "unconfirmed") {
        item.state = "confirmed";
      }
    }
  }

  handleQuiesced(
    msg: Extract<PipelineMsg, { t: "voice.quiesced" }>,
    identity: RuntimeIdentity | undefined
  ): void {
    const wait = this.waitingQuiesce.get(msg.requestId);
    const rec = this.recordFor(msg.sessionId, msg.requestId);
    if (!wait || !rec || rec.state !== "preparing") return;
    if (wait.sessionId !== msg.sessionId || wait.epoch !== msg.epoch) return;
    const expected = wait.identity;
    if (expected && identity && JSON.stringify(expected) !== JSON.stringify(identity)) return;
    if (!this.sink.hasPipelinePeer()) return;
    if (msg.classified === false) {
      this.failRecord(rec, "voice_recognition_failed", true);
      return;
    }
    const identityLeft = this.ledger.some(
      (item) =>
        item.sessionId === msg.sessionId &&
        item.epoch === msg.epoch &&
        (item.state === "unknown" || (item.hfRoundId !== undefined && item.state === "unconfirmed"))
    );
    if (identityLeft) {
      this.failRecord(rec, "voice_recognition_failed", true);
      return;
    }
    if (this.pendingRegistryCount(msg.sessionId, [msg.epoch]) > 0) {
      this.failRecord(rec, "voice_quiesce_unsupported", true);
      return;
    }
    this.confirmEpochRemainder(msg.sessionId, msg.epoch);
    const pending = this.pendingHandover.get(msg.requestId) ?? [];
    const existing = [...this.handover.values()].filter((item) => item.sessionId === msg.sessionId).length;
    if (existing + pending.length > HANDOVER_PER_SID) {
      this.failRecord(rec, "voice_handover_overflow", true);
      return;
    }
    this.sealFinishedRounds(msg.sessionId, msg.epoch);
    this.clearQuiesceWait(msg.requestId);
    this.enterPrepared(rec, msg.emptyRound);
  }

  onMalformedQuiesced(sessionId: string, requestId: string): void {
    const rec = this.recordFor(sessionId, requestId);
    if (rec?.state === "preparing") this.failRecord(rec, "voice_quiesce_unsupported", true);
  }

  onPipelineDisconnected(): void {
    const pairs: Array<{ sessionId: string; epoch: number }> = [];
    const seen = new Set<string>();
    for (const item of this.ledger) {
      if (item.state !== "unconfirmed") continue;
      const key = `${item.sessionId}\0${item.epoch}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ sessionId: item.sessionId, epoch: item.epoch });
    }
    for (const pair of pairs) this.markEpochUnknown(pair.sessionId, pair.epoch);
    for (const recs of this.records.values()) {
      for (const rec of recs.values()) {
        if (rec.state === "preparing" && this.waitingQuiesce.has(rec.requestId)) {
          this.failRecord(rec, "voice_quiesce_disconnected", true);
        }
      }
    }
  }

  handleRearm(msg: Extract<PipelineMsg, { t: "voice.mode" }>, sourcePeer: string): "opened" | "noop" | false {
    if (!msg.quiesceRequestId) return false;
    const rec = this.recordFor(msg.sessionId, msg.quiesceRequestId);
    if (!rec) return "noop";
    if (rec.state === "consumed") return "noop";
    if (rec.state === "rearmed" && rec.ownerPeerId === sourcePeer) {
      this.sendStatus(sourcePeer, {
        t: "voice.anchor_status",
        sessionId: rec.sessionId,
        requestId: rec.requestId,
        status: "rearmed"
      });
      return "noop";
    }
    const via = this.sink.peerVia(sourcePeer);
    if (via === "mobile_lan") return "noop";
    if (rec.ownerPeerId !== sourcePeer || rec.state !== "applied" || msg.mode !== "ptt") {
      this.sendStatus(sourcePeer, rejectStatus(msg.sessionId, rec.requestId, "voice_peer_mismatch", true));
      return "noop";
    }
    if (!this.sink.isPeerOpen(sourcePeer)) return "noop";
    rec.state = "rearmed";
    this.captureGateClosed = false;
    this.gateOwnerSid = undefined;
    this.sink.openCaptureGate();
    this.sink.prewriteLastVoiceModePtt(msg.sessionId);
    this.sendStatus(sourcePeer, {
      t: "voice.anchor_status",
      sessionId: rec.sessionId,
      requestId: rec.requestId,
      status: "rearmed"
    });
    this.replayHandover(msg.sessionId);
    return "opened";
  }

  ordinaryModeAllowed(): boolean {
    return !this.captureGateClosed;
  }

  noteBargeIn(sessionId: string): number {
    const next = (this.speechGenBySid.get(sessionId) ?? 0) + 1;
    this.speechGenBySid.set(sessionId, next);
    this.attributeCurrentHfRound(sessionId, next);
    return next;
  }

  markInboundAfterRearm(sessionId: string): void {
    this.hfHoldAfterFail.delete(sessionId);
    for (const rec of this.sidRecords(sessionId).values()) {
      if (rec.state === "rearmed") rec.state = "consumed";
    }
  }

  registerDoneSpeaking(
    msg: Extract<PipelineMsg, { t: "turn.done_speaking" }>
  ): { forward: Extract<PipelineMsg, { t: "turn.done_speaking" }> | null; legacyHold: boolean } {
    const hasCap = msg.captureId !== undefined || msg.captureIntent !== undefined;
    if (msg.captureMode === "hands_free") {
      if (hasCap || msg.holdForConfirm === true) return { forward: null, legacyHold: false };
      if (this.asrBrainGated(msg.sessionId)) return { forward: null, legacyHold: false };
      this.closeOpenHfRound(msg.sessionId);
      this.markInboundAfterRearm(msg.sessionId);
      return { forward: { t: "turn.done_speaking", sessionId: msg.sessionId }, legacyHold: false };
    }
    if (hasCap) {
      if (!msg.captureId || !msg.captureIntent) return { forward: null, legacyHold: false };
      const intent = msg.captureIntent;
      const hold = msg.holdForConfirm === true;
      if ((intent === "edit" || intent === "cancel") !== hold) return { forward: null, legacyHold: false };
      if (intent === "send" && hold) return { forward: null, legacyHold: false };
      if (this.asrBrainGated(msg.sessionId) || this.captureGateClosed) {
        return { forward: null, legacyHold: false };
      }
      const epoch = this.currentEpoch();
      if (epoch === undefined) return { forward: null, legacyHold: false };
      const reg = this.sidRegistry(msg.sessionId);
      if (reg.has(msg.captureId)) return { forward: null, legacyHold: false };
      if (reg.size >= CAPTURE_REGISTRY_PER_SID) return { forward: null, legacyHold: false };
      const entry: CaptureRegistryEntry = {
        sessionId: msg.sessionId,
        captureId: msg.captureId,
        epoch,
        intent,
        consumed: false,
        discarded: false
      };
      reg.set(msg.captureId, entry);
      this.captureSpeechGen.set(msg.captureId, this.speechGenBySid.get(msg.sessionId) ?? 0);
      this.addLedger({
        sessionId: msg.sessionId,
        epoch,
        kind: "ptt",
        captureId: msg.captureId,
        state: "unconfirmed"
      });
      this.markInboundAfterRearm(msg.sessionId);
      return { forward: { t: "turn.done_speaking", sessionId: msg.sessionId, captureId: msg.captureId }, legacyHold: false };
    }
    if (this.asrBrainGated(msg.sessionId)) return { forward: null, legacyHold: false };
    this.legacyPendingDone.set(msg.sessionId, (this.legacyPendingDone.get(msg.sessionId) ?? 0) + 1);
    this.markInboundAfterRearm(msg.sessionId);
    return {
      forward: msg.holdForConfirm
        ? { t: "turn.done_speaking", sessionId: msg.sessionId }
        : msg,
      legacyHold: msg.holdForConfirm === true
    };
  }

  noteAcceptedPcm(sessionId: string | undefined): void {
    const sid = sessionId;
    const epoch = this.currentEpoch();
    if (!sid || epoch === undefined) return;
    this.addLedger({ sessionId: sid, epoch, kind: "accepted_pcm", state: "unconfirmed" });
    this.markInboundAfterRearm(sid);
  }

  noteVadSpeech(sessionId: string, phase: "start" | "end", identity?: HfVadIdentity): void {
    const epoch = this.currentEpoch();
    if (epoch === undefined) return;
    if (identity) {
      this.noteHfIdentity(sessionId, epoch, phase, identity);
      return;
    }
    if (phase === "start") {
      this.hfSeq += 1;
      this.hfSpeechGen.set(`${sessionId}:${this.hfSeq}`, this.speechGenBySid.get(sessionId) ?? 0);
      this.addLedger({
        sessionId,
        epoch,
        kind: "hands_free",
        hfSeq: this.hfSeq,
        state: "unconfirmed",
        speechEnded: false
      });
      return;
    }
    const open = this.ledger.find(
      (item) =>
        item.sessionId === sessionId &&
        item.epoch === epoch &&
        item.kind === "hands_free" &&
        item.state === "unconfirmed" &&
        item.speechEnded !== true
    );
    if (open) open.speechEnded = true;
  }

  noteUnclassifiedFinal(sessionId: string): void {
    this.unclassifiedInflight.add(sessionId);
  }

  consumeAsrFinal(msg: AsrFinalMsg): AsrFinalDecision {
    if (!isClassifiedAsrFinal(msg)) {
      const pending = this.legacyPendingDone.get(msg.sessionId) ?? 0;
      if (pending > 0) this.legacyPendingDone.set(msg.sessionId, pending - 1);
      if (pending <= 1) this.unclassifiedInflight.delete(msg.sessionId);
      if (this.asrBrainGated(msg.sessionId) || this.hfHoldAfterFail.has(msg.sessionId)) {
        return { broadcast: true, brain: false, settleSpeech: false };
      }
      return { broadcast: true, brain: msg.text.trim() !== "", settleSpeech: false };
    }
    this.unclassifiedInflight.delete(msg.sessionId);
    const leftover = this.legacyPendingDone.get(msg.sessionId) ?? 0;
    if (leftover > 0) this.legacyPendingDone.set(msg.sessionId, leftover - 1);
    const gated = this.asrBrainGated(msg.sessionId) || this.hfHoldAfterFail.has(msg.sessionId);
    const preparing = [...this.sidRecords(msg.sessionId).values()].find((rec) => rec.state === "preparing");
    if (msg.captureMode === "hands_free") {
      if ("hfRoundId" in msg) {
        return this.consumeIdentityFinal(msg, gated, preparing);
      }
      if (this.hasIdentityInflight(msg.sessionId)) {
        this.unclassifiedInflight.add(msg.sessionId);
        return { broadcast: false, brain: false, settleSpeech: false };
      }
      const turnKey = `${msg.sessionId}\0${msg.turnId}`;
      if (this.legacyConsumedTurns.has(turnKey)) {
        return { broadcast: false, brain: false, settleSpeech: false };
      }
      if (msg.recognitionOutcome === "failed") {
        const failedHf = this.takeOldestClosedLegacyHf(msg.sessionId, "failed");
        if (failedHf.matched) this.legacyConsumedTurns.add(turnKey);
        return {
          broadcast: !preparing,
          brain: false,
          settleSpeech: !gated && failedHf.matched && !preparing,
          ...(failedHf.speechGen !== undefined ? { speechGen: failedHf.speechGen } : {})
        };
      }
      const hf = this.takeOldestClosedLegacyHf(msg.sessionId, "ok");
      if (hf.matched) this.legacyConsumedTurns.add(turnKey);
      const matched = !gated && hf.matched;
      const text = msg.text.trim();
      if (preparing && text && msg.recognitionOutcome === "ok") {
        this.queueHandover(preparing, {
          captureMode: "hands_free",
          turnId: msg.turnId,
          text
        });
        return { broadcast: false, brain: false, settleSpeech: false };
      }
      const brain = matched && !preparing && text !== "" && msg.recognitionOutcome === "ok";
      return {
        broadcast: !preparing,
        brain,
        settleSpeech: matched && !preparing && !brain,
        ...(hf.speechGen !== undefined ? { speechGen: hf.speechGen } : {})
      };
    }
    const cap = msg.captureId;
    const entry = this.sidRegistry(msg.sessionId).get(cap);
    const epoch = this.currentEpoch();
    if (!entry || entry.consumed || entry.epoch !== epoch) {
      return { broadcast: false, brain: false, settleSpeech: false };
    }
    const speechGen = this.captureSpeechGen.get(cap);
    const consumed: CaptureRegistryEntry = { ...entry, consumed: true, discarded: false };
    this.sidRegistry(msg.sessionId).set(cap, consumed);
    const item = this.ledger.find(
      (row) => row.sessionId === msg.sessionId && row.captureId === cap && row.kind === "ptt"
    );
    const owned = speechGen !== undefined ? { settleSpeech: true as const, speechGen } : { settleSpeech: true as const };
    if (msg.recognitionOutcome === "failed") {
      if (item && item.state !== "confirmed" && item.state !== "discarded") item.state = "unknown";
      return { broadcast: !preparing, brain: false, ...owned };
    }
    if (item && item.state === "unconfirmed") item.state = "confirmed";
    if (consumed.intent === "cancel") return { broadcast: false, brain: false, ...owned };
    const text = msg.text.trim();
    if (preparing && text && (consumed.intent === "edit" || consumed.intent === "send")) {
      this.queueHandover(preparing, {
        captureMode: "ptt",
        captureId: cap,
        captureIntent: consumed.intent,
        turnId: msg.turnId,
        text
      });
      return { broadcast: false, brain: false, ...owned };
    }
    const hold = consumed.intent === "edit";
    const brain = !gated && !preparing && !hold && text !== "";
    return { broadcast: !preparing, brain, ...owned };
  }

  private closeOpenHfRound(sessionId: string): void {
    const epoch = this.currentEpoch();
    if (epoch === undefined) return;
    for (const item of this.ledger) {
      if (
        item.sessionId === sessionId &&
        item.epoch === epoch &&
        item.kind === "hands_free" &&
        item.state === "unconfirmed" &&
        item.speechEnded !== true
      ) {
        item.speechEnded = true;
      }
    }
    for (const round of this.hfRounds.values()) {
      if (round.sessionId !== sessionId || round.epoch !== epoch || round.terminal) continue;
      for (const seg of round.segments) {
        if (!seg.speechEnded) seg.speechEnded = true;
        const row = this.segmentRow(sessionId, epoch, seg.hfSegmentId);
        if (row && row.state === "unconfirmed") row.speechEnded = true;
      }
    }
  }

  private attributeCurrentHfRound(sessionId: string, speechGen: number): void {
    const epoch = this.currentEpoch();
    if (epoch === undefined) return;
    const items = this.ledger.filter(
      (item) =>
        item.sessionId === sessionId &&
        item.epoch === epoch &&
        item.kind === "hands_free" &&
        item.state === "unconfirmed"
    );
    const open = items.filter((item) => item.speechEnded !== true);
    const newest = items.slice().sort((a, b) => (b.hfSeq ?? 0) - (a.hfSeq ?? 0)).slice(0, 1);
    const targets = open.length > 0 ? open : newest;
    for (const item of targets) {
      if (item.hfRoundId || item.hfSeq === undefined) continue;
      this.hfSpeechGen.set(`${sessionId}:${item.hfSeq}`, speechGen);
    }
    for (const round of this.hfRounds.values()) {
      if (round.sessionId !== sessionId || round.epoch !== epoch || round.terminal) continue;
      if (round.segments.some((seg) => !seg.speechEnded)) round.speechGen = speechGen;
    }
  }

  private hfRoundKey(sessionId: string, epoch: number, hfRoundId: string): string {
    return `${sessionId}:${epoch}:${hfRoundId}`;
  }

  private hasIdentityInflight(sessionId: string): boolean {
    const epoch = this.currentEpoch();
    if (epoch === undefined) return false;
    return this.ledger.some(
      (item) =>
        item.sessionId === sessionId &&
        item.epoch === epoch &&
        item.hfRoundId !== undefined &&
        item.state === "unconfirmed"
    );
  }

  private noteHfIdentity(sessionId: string, epoch: number, phase: "start" | "end", identity: HfVadIdentity): void {
    const seqKey = `${sessionId}:${epoch}`;
    if (phase === "end") {
      const round = this.hfRounds.get(this.hfRoundKey(sessionId, epoch, identity.hfRoundId));
      const seg = round?.segments.find((item) => item.hfSegmentId === identity.hfSegmentId);
      if (!round || round.terminal || !seg || seg.speechEnded || seg.recordSeq !== identity.recordSeq) return;
      seg.speechEnded = true;
      const row = this.ledger.find(
        (item) => item.sessionId === sessionId && item.epoch === epoch && item.hfSegmentId === identity.hfSegmentId
      );
      if (row && row.hfRoundId === identity.hfRoundId && row.recordSeq === identity.recordSeq) row.speechEnded = true;
      return;
    }
    const expected = this.nextRecordSeq.get(seqKey) ?? 1;
    if (identity.recordSeq !== expected) return;
    const open = [...this.hfRounds.values()].find(
      (round) => round.sessionId === sessionId && round.epoch === epoch && !round.terminal
    );
    if (open && open.hfRoundId !== identity.hfRoundId) return;
    if (open?.segments.some((seg) => seg.hfSegmentId === identity.hfSegmentId)) return;
    const speechGen = open?.speechGen ?? this.speechGenBySid.get(sessionId) ?? 0;
    const round =
      open ??
      ({
        sessionId,
        epoch,
        hfRoundId: identity.hfRoundId,
        speechGen,
        segments: [],
        terminal: false
      } satisfies HfRoundRuntime);
    if (!open) this.hfRounds.set(this.hfRoundKey(sessionId, epoch, identity.hfRoundId), round);
    round.segments.push({ hfSegmentId: identity.hfSegmentId, recordSeq: identity.recordSeq, speechEnded: false });
    this.nextRecordSeq.set(seqKey, expected + 1);
    this.hfSeq += 1;
    this.hfSpeechGen.set(`${sessionId}:${this.hfSeq}`, speechGen);
    this.addLedger({
      sessionId,
      epoch,
      kind: "hands_free",
      hfSeq: this.hfSeq,
      hfSegmentId: identity.hfSegmentId,
      hfRoundId: identity.hfRoundId,
      recordSeq: identity.recordSeq,
      state: "unconfirmed",
      speechEnded: false
    });
  }

  private consumeIdentityFinal(
    msg: Extract<AsrFinalMsg, { captureMode: "hands_free"; hfRoundId: string }>,
    gated: boolean,
    preparing: FocusAnchorRecord | undefined
  ): AsrFinalDecision {
    const epoch = this.currentEpoch();
    const none = { broadcast: false, brain: false, settleSpeech: false } as const;
    if (epoch === undefined || !msg.hfSegmentIds || msg.recordSeqFirst === undefined || msg.recordSeqLast === undefined) {
      return none;
    }
    const round = this.hfRounds.get(this.hfRoundKey(msg.sessionId, epoch, msg.hfRoundId));
    if (!round || round.terminal || round.tombstone) return none;
    const ordered = [...round.segments].sort((a, b) => a.recordSeq - b.recordSeq);
    const ids = ordered.map((seg) => seg.hfSegmentId);
    if (
      ids.length !== msg.hfSegmentIds.length ||
      ids.some((id, index) => id !== msg.hfSegmentIds[index]) ||
      ordered.length === 0 ||
      ordered[0]?.recordSeq !== msg.recordSeqFirst ||
      ordered[ordered.length - 1]?.recordSeq !== msg.recordSeqLast ||
      ordered.some((seg) => !seg.speechEnded)
    ) {
      return none;
    }
    const rows = ordered.map((seg) => this.segmentRow(msg.sessionId, epoch, seg.hfSegmentId));
    if (rows.some((row) => !row || row.hfRoundId !== msg.hfRoundId)) return none;
    if (rows.some((row) => row?.state === "discarded")) {
      round.terminal = true;
      round.tombstone = "discarded";
      return none;
    }
    if (rows.some((row) => row?.state !== "unconfirmed")) {
      round.terminal = true;
      round.tombstone = round.tombstone ?? "retired";
      return none;
    }
    round.terminal = true;
    const failed = msg.recognitionOutcome === "failed";
    for (const item of rows) {
      if (!item || item.state !== "unconfirmed") continue;
      item.state = failed ? "unknown" : "confirmed";
    }
    const text = msg.text.trim();
    const currentGen = this.speechGenBySid.get(msg.sessionId) ?? 0;
    const stale = round.speechGen !== currentGen;
    if (preparing && !failed && text) {
      this.queueHandover(preparing, {
        captureMode: "hands_free",
        turnId: msg.turnId,
        text
      });
      return none;
    }
    const brain = !gated && !preparing && !failed && text !== "" && !stale;
    return {
      broadcast: !preparing,
      brain,
      settleSpeech: !preparing && !brain,
      speechGen: round.speechGen
    };
  }

  private takeOldestClosedLegacyHf(
    sessionId: string,
    outcome: "ok" | "failed"
  ): { matched: boolean; speechGen?: number } {
    const epoch = this.currentEpoch();
    if (epoch === undefined) return { matched: false };
    const closed = this.ledger
      .filter(
        (item) =>
          item.sessionId === sessionId &&
          item.epoch === epoch &&
          item.kind === "hands_free" &&
          item.hfRoundId === undefined &&
          item.state === "unconfirmed" &&
          item.speechEnded === true
      )
      .sort((a, b) => (a.hfSeq ?? 0) - (b.hfSeq ?? 0));
    const oldest = closed[0];
    if (!oldest) return { matched: false };
    oldest.state = outcome === "failed" ? "unknown" : "confirmed";
    const speechGen =
      oldest.hfSeq !== undefined ? this.hfSpeechGen.get(`${sessionId}:${oldest.hfSeq}`) : undefined;
    return speechGen !== undefined ? { matched: true, speechGen } : { matched: true };
  }

  private addLedger(item: UnconfirmedAudioEpoch): void {
    const dup = this.ledger.find(
      (row) =>
        row.sessionId === item.sessionId &&
        row.epoch === item.epoch &&
        row.kind === item.kind &&
        row.captureId === item.captureId &&
        row.hfSeq === item.hfSeq &&
        row.state === "unconfirmed"
    );
    if (!dup) this.ledger.push(item);
  }

  private queueHandover(
    rec: FocusAnchorRecord,
    input: {
      captureMode: "ptt" | "hands_free";
      captureId?: string;
      captureIntent?: "send" | "edit";
      turnId: string;
      text: string;
    }
  ): void {
    const sourceFocusId = this.sink.getSourceFocusId(rec.sessionId);
    const event: HandoverItem = {
      t: "voice.quiesced_transcript",
      sessionId: rec.sessionId,
      requestId: rec.requestId,
      turnId: input.turnId,
      text: input.text,
      captureMode: input.captureMode,
      ...(input.captureId ? { captureId: input.captureId } : {}),
      ...(input.captureIntent ? { captureIntent: input.captureIntent } : {}),
      ...(sourceFocusId ? { sourceFocusId } : {})
    };
    const list = this.pendingHandover.get(rec.requestId) ?? [];
    if (list.some((item) => item.turnId === input.turnId)) return;
    list.push(event);
    this.pendingHandover.set(rec.requestId, list);
  }

  private flushHandover(rec: FocusAnchorRecord): void {
    const list = this.pendingHandover.get(rec.requestId) ?? [];
    this.pendingHandover.delete(rec.requestId);
    for (const item of list) {
      this.handover.set(handoverKey(item.sessionId, item.requestId, item.turnId), item);
      this.sink.sendToLocalSession(item.sessionId, item);
    }
  }

  replayHandover(sessionId: string): void {
    for (const item of this.handover.values()) {
      if (item.sessionId === sessionId) this.sink.sendToLocalSession(sessionId, item);
    }
  }

  ackHandover(msg: Extract<PipelineMsg, { t: "voice.quiesced_transcript_ack" }>, peerId: string): void {
    if (this.sink.peerVia(peerId) === "mobile_lan") return;
    const key = handoverKey(msg.sessionId, msg.requestId, msg.turnId);
    if (this.handover.has(key)) this.handover.delete(key);
  }

  applyHttp(input: {
    sessionId: string;
    body: unknown;
    write: HttpAnchorWrite;
  }): { status: number; payload: FocusAnchorOk | FocusAnchorLegacyOk | FocusAnchorErr } {
    const parsed = focusAnchorRequestBodySchema.safeParse(input.body);
    if (!parsed.success) return httpErr("invalid_input", false, "focusId required");
    const body: FocusAnchorRequestBody = parsed.data;
    const lane = normalizeLaneTitle(body.laneTitle);
    if (!body.requestId) {
      if (!this.legacyHttpAllowed(input.sessionId)) return httpErr("voice_boundary_required", true);
      const sw = input.write({ sessionId: input.sessionId, focusId: body.focusId, ...(lane ? { laneTitle: lane } : {}) });
      return {
        status: 200,
        payload: focusAnchorLegacyOkSchema.parse({
          ok: true,
          sessionId: input.sessionId,
          focusId: body.focusId,
          already: sw.already
        })
      };
    }
    const rec = this.recordFor(input.sessionId, body.requestId);
    if (!rec) return httpErr("voice_boundary_required", true);
    if (rec.state === "preparing") return httpErr("voice_anchor_pending", true);
    if (rec.state === "failed") return httpErr("voice_request_dead", false);
    if (rec.state === "consumed") return httpErr("voice_boundary_consumed", false);
    if (rec.state !== "prepared" && rec.state !== "applied" && rec.state !== "rearmed") {
      return httpErr("voice_boundary_required", true);
    }
    if (
      !sameFocusLane(
        { focusId: rec.focusId, ...(rec.laneTitle ? { laneTitle: rec.laneTitle } : {}) },
        { focusId: body.focusId, ...(lane ? { laneTitle: lane } : {}) }
      )
    ) {
      return httpErr("invalid_input", false, "focus mismatch");
    }
    if (rec.state === "prepared") {
      const sw = input.write({
        sessionId: input.sessionId,
        focusId: rec.focusId,
        ...(rec.laneTitle ? { laneTitle: rec.laneTitle } : {})
      });
      rec.state = "applied";
      return {
        status: 200,
        payload: focusAnchorOkSchema.parse({
          ok: true,
          sessionId: input.sessionId,
          focusId: rec.focusId,
          already: sw.already,
          voiceBoundaryId: rec.requestId,
          voiceBoundaryRequired: true
        })
      };
    }
    return {
      status: 200,
      payload: focusAnchorOkSchema.parse({
        ok: true,
        sessionId: input.sessionId,
        focusId: rec.focusId,
        already: true,
        voiceBoundaryId: rec.requestId,
        voiceBoundaryRequired: true
      })
    };
  }

  legacyHttpAllowed(sessionId: string): boolean {
    if (this.unknownEpochs(sessionId).length > 0) return false;
    if (this.sidHasOpenOwner(sessionId)) return false;
    if (this.ledger.some((item) => item.sessionId === sessionId && item.kind === "accepted_pcm")) return false;
    if (this.sidRegistry(sessionId).size > 0) return false;
    return true;
  }

  beginTurnText(msg: TurnTextMsg, sourcePeer: string): TurnTextBegin {
    const via = this.sink.peerVia(sourcePeer);
    if (via === "mobile_lan") return { kind: "execute", result: null };
    const hasAction = "receiptAction" in msg;
    const hasEpoch = "daemonEpoch" in msg;
    if (hasAction !== hasEpoch) {
      return {
        kind: "result",
        result: {
          t: "turn.text.result",
          sessionId: msg.sessionId,
          turnId: msg.turnId,
          outcome: "rejected",
          code: "invalid_input",
          retryable: false
        }
      };
    }
    this.sink.registerSession(sourcePeer, msg.sessionId);
    if (!hasAction || !hasEpoch) return { kind: "execute", result: null };
    const action = msg.receiptAction;
    const epoch = msg.daemonEpoch;
    if (epoch !== this.daemonEpoch) {
      return {
        kind: "result",
        result: {
          t: "turn.text.result",
          sessionId: msg.sessionId,
          turnId: msg.turnId,
          outcome: "unknown",
          retryable: false
        }
      };
    }
    const digest = digestOfText(msg.text);
    const key = receiptKey(msg.sessionId, msg.turnId);
    const cached = this.receipts.get(key);
    if (cached?.status === "pending") {
      return { kind: "drop" };
    }
    const retryReenter =
      cached?.status === "settled" &&
      action === "retry" &&
      cached.result.outcome === "rejected" &&
      cached.result.retryable === true &&
      cached.textDigest === digest &&
      cached.daemonEpoch === epoch;
    if (cached?.status === "settled" && !retryReenter) {
      return { kind: "result", result: this.replayReceipt(action, cached, digest, epoch, msg) };
    }
    if ((action === "replay" || action === "retry") && !cached) {
      return {
        kind: "result",
        result: {
          t: "turn.text.result",
          sessionId: msg.sessionId,
          turnId: msg.turnId,
          outcome: "unknown",
          retryable: false
        }
      };
    }
    if (retryReenter) this.receipts.delete(key);
    if (this.asrBrainGated(msg.sessionId) && (action === "submit" || action === "retry")) {
      const result: TurnTextResult = {
        t: "turn.text.result",
        sessionId: msg.sessionId,
        turnId: msg.turnId,
        outcome: "rejected",
        code: "voice_anchor_pending",
        retryable: true
      };
      this.storeSettled(key, result, digest, epoch);
      return { kind: "result", result };
    }
    if (!this.ensureReceiptCapacity(msg.sessionId, key)) {
      return {
        kind: "result",
        result: {
          t: "turn.text.result",
          sessionId: msg.sessionId,
          turnId: msg.turnId,
          outcome: "rejected",
          code: "turn_receipt_capacity",
          retryable: true
        }
      };
    }
    this.receipts.set(key, { status: "pending", textDigest: digest, daemonEpoch: epoch, waiters: [] });
    this.receiptOrder.push(key);
    return { kind: "execute", result: null };
  }

  private replayReceipt(
    action: "submit" | "replay" | "retry",
    cached: ReceiptSettled,
    digest: string,
    epoch: string,
    msg: TurnTextMsg
  ): TurnTextResult {
    if (cached.result.outcome === "accepted" && cached.textDigest !== digest) {
      return {
        t: "turn.text.result",
        sessionId: msg.sessionId,
        turnId: msg.turnId,
        outcome: "rejected",
        code: "idempotency_conflict",
        retryable: false
      };
    }
    if (
      action === "retry" &&
      cached.result.outcome === "rejected" &&
      cached.result.retryable === true &&
      cached.textDigest === digest &&
      cached.daemonEpoch === epoch
    ) {
      return cached.result;
    }
    return cached.result;
  }

  completeTurnAccepted(sessionId: string, turnId: string): void {
    const key = receiptKey(sessionId, turnId);
    const pending = this.receipts.get(key);
    this.markInboundAfterRearm(sessionId);
    if (!pending) return;
    if (pending.status === "settled") {
      this.sink.sendToLocalSession(sessionId, pending.result);
      return;
    }
    const result: TurnTextResult = { t: "turn.text.result", sessionId, turnId, outcome: "accepted" };
    this.storeSettled(key, result, pending.textDigest, pending.daemonEpoch);
    for (const w of pending.waiters) w(result);
    this.sink.sendToLocalSession(sessionId, result);
  }

  completeTurnRejected(sessionId: string, turnId: string, code: string, retryable: boolean): void {
    const key = receiptKey(sessionId, turnId);
    const pending = this.receipts.get(key);
    if (!pending) return;
    if (pending.status === "settled") {
      if (pending.result.outcome === "accepted") return;
      this.sink.sendToLocalSession(sessionId, pending.result);
      return;
    }
    const result: TurnTextResult = {
      t: "turn.text.result",
      sessionId,
      turnId,
      outcome: "rejected",
      code,
      retryable
    };
    this.storeSettled(key, result, pending.textDigest, pending.daemonEpoch);
    for (const w of pending.waiters) w(result);
    this.sink.sendToLocalSession(sessionId, result);
  }

  private storeSettled(key: string, result: TurnTextResult, textDigest: string, daemonEpoch: string): void {
    this.receipts.set(key, {
      status: "settled",
      result,
      textDigest,
      daemonEpoch,
      at: this.sink.now()
    });
    this.pruneReceipts();
  }

  private ensureReceiptCapacity(sessionId: string, incomingKey: string): boolean {
    this.pruneReceipts();
    const sidCount = [...this.receipts.keys()].filter((k) => k.startsWith(`${sessionId}:`)).length;
    if (sidCount < TURN_RECEIPT_PER_SID && this.receipts.size < TURN_RECEIPT_GLOBAL) return true;
    for (const key of this.receiptOrder) {
      if (key === incomingKey) continue;
      const entry = this.receipts.get(key);
      if (entry?.status === "settled") {
        this.receipts.delete(key);
        return true;
      }
    }
    return false;
  }

  private pruneReceipts(): void {
    const now = this.sink.now();
    for (const [key, entry] of this.receipts) {
      if (entry.status === "settled" && now - entry.at > TURN_RECEIPT_TTL_MS) this.receipts.delete(key);
    }
    const live = new Set(this.receipts.keys());
    for (let i = this.receiptOrder.length - 1; i >= 0; i--) {
      if (!live.has(this.receiptOrder[i] as string)) this.receiptOrder.splice(i, 1);
    }
  }

  clearSession(sessionId: string): void {
    for (const captureId of this.sidRegistry(sessionId).keys()) this.captureSpeechGen.delete(captureId);
    for (const key of [...this.hfSpeechGen.keys()]) {
      if (key.startsWith(`${sessionId}:`)) this.hfSpeechGen.delete(key);
    }
    this.records.delete(sessionId);
    this.registry.delete(sessionId);
    this.legacyPendingDone.delete(sessionId);
    this.unclassifiedInflight.delete(sessionId);
    this.hfHoldAfterFail.delete(sessionId);
    this.speechGenBySid.delete(sessionId);
    for (const key of [...this.legacyConsumedTurns]) {
      if (key.startsWith(`${sessionId}\0`)) this.legacyConsumedTurns.delete(key);
    }
    for (let i = this.retiredSpeech.length - 1; i >= 0; i--) {
      if (this.retiredSpeech[i]?.sessionId === sessionId) this.retiredSpeech.splice(i, 1);
    }
    for (const key of [...this.hfRounds.keys()]) {
      if (key.startsWith(`${sessionId}:`)) this.hfRounds.delete(key);
    }
    for (const key of [...this.nextRecordSeq.keys()]) {
      if (key.startsWith(`${sessionId}:`)) this.nextRecordSeq.delete(key);
    }
    for (let i = this.ledger.length - 1; i >= 0; i--) {
      if (this.ledger[i]?.sessionId === sessionId) this.ledger.splice(i, 1);
    }
    for (const [key, item] of this.handover) {
      if (item.sessionId === sessionId) this.handover.delete(key);
    }
    for (const key of [...this.receipts.keys()]) {
      if (key.startsWith(`${sessionId}:`)) this.receipts.delete(key);
    }
    for (const recs of [sessionId]) {
      for (const [requestId, wait] of this.waitingQuiesce) {
        if (wait.sessionId === recs) this.clearQuiesceWait(requestId);
      }
    }
    if (this.gateOwnerSid === sessionId) {
      this.captureGateClosed = false;
      this.gateOwnerSid = undefined;
      this.sink.openCaptureGate();
    }
  }

  dispose(): void {
    for (const timer of this.quiesceTimers.values()) clearTimeout(timer);
    this.quiesceTimers.clear();
  }
}
