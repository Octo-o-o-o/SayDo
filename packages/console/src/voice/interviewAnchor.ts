// 采访归属绑在已提交的 focus-anchor 上:focusId + requestId 代次 + 原 turn。
// requestId 是 09 已有的锚定意图身份(新意图新 ID)。不新增 WS/HTTP 字段。
// 在途/失败不改已提交代次,也不按到达时刻重标旧 turn。

export interface InterviewAnchorCommit {
  sessionId: string;
  focusId: string;
  requestId: string;
  generation: number;
}

export type InterviewAnchorPhase = "idle" | "pending" | "ready" | "failed";

export interface AnchorOnly {
  phase: InterviewAnchorPhase;
  pendingSessionId: string | null;
  pendingFocusId: string | null;
  pendingRequestId: string | null;
  committed: InterviewAnchorCommit | null;
}

export interface StampedSpoken {
  sentenceId: string;
  text: string;
  seq: number;
  turnId?: string;
  truncated: boolean;
  fullScreenText?: boolean;
  interviewFocusId?: string;
  interviewAnchorRequestId?: string;
  interviewAnchorGeneration?: number;
}

export interface InterviewRoundLease {
  turnId: string;
  focusId: string;
  requestId: string;
  generation: number;
}

export interface InterviewTrack {
  anchor: AnchorOnly;
  spoken: StampedSpoken[];
  rounds: InterviewRoundLease[];
}

export type AnchorOnlyEvent =
  | { type: "begin"; sessionId: string; focusId: string; requestId?: string }
  | { type: "fail"; sessionId: string; focusId?: string; requestId?: string }
  | { type: "abandon"; sessionId: string }
  | { type: "commit"; sessionId: string; focusId: string; requestId: string };

export type InterviewTrackEvent =
  | AnchorOnlyEvent
  | { type: "round_open"; turnId: string }
  | { type: "tts"; sentenceId: string; text: string; seq: number; turnId?: string }
  | { type: "screen_text"; turnId: string; text: string; seq: number };

interface SpokenStamp {
  focusId: string;
  requestId: string;
  generation: number;
}

export function emptyAnchorOnly(): AnchorOnly {
  return {
    phase: "idle",
    pendingSessionId: null,
    pendingFocusId: null,
    pendingRequestId: null,
    committed: null
  };
}

export function emptyInterviewTrack(): InterviewTrack {
  return { anchor: emptyAnchorOnly(), spoken: [], rounds: [] };
}

export function commitInterviewAnchor(
  current: InterviewAnchorCommit | null,
  input: { sessionId: string; focusId: string; requestId: string }
): InterviewAnchorCommit {
  if (
    current &&
    current.sessionId === input.sessionId &&
    current.focusId === input.focusId &&
    current.requestId === input.requestId
  ) {
    return current;
  }
  return {
    sessionId: input.sessionId,
    focusId: input.focusId,
    requestId: input.requestId,
    generation: (current?.generation ?? 0) + 1
  };
}

export function reduceAnchorOnly(state: AnchorOnly, event: AnchorOnlyEvent): AnchorOnly {
  if (event.type === "begin") {
    if (!event.sessionId || !event.focusId) return state;
    return {
      ...state,
      phase: "pending",
      pendingSessionId: event.sessionId,
      pendingFocusId: event.focusId,
      pendingRequestId: event.requestId ?? null
    };
  }
  if (event.type === "fail" || event.type === "abandon") {
    if (state.pendingSessionId && event.sessionId !== state.pendingSessionId) return state;
    if (event.type === "abandon") {
      return {
        ...state,
        phase: state.committed ? "ready" : "idle",
        pendingSessionId: null,
        pendingFocusId: null,
        pendingRequestId: null
      };
    }
    return {
      ...state,
      phase: "failed",
      pendingSessionId: null,
      pendingFocusId: null,
      pendingRequestId: null
    };
  }
  if (!event.sessionId || !event.focusId || !event.requestId) return state;
  return {
    ...state,
    phase: "ready",
    pendingSessionId: null,
    pendingFocusId: null,
    pendingRequestId: null,
    committed: commitInterviewAnchor(state.committed, event)
  };
}

function belongs(sentenceId: string, turnId: string): boolean {
  return sentenceId.includes(turnId);
}

function readStamp(row: StampedSpoken): SpokenStamp | null {
  if (!row.interviewFocusId || !row.interviewAnchorRequestId || typeof row.interviewAnchorGeneration !== "number") {
    return null;
  }
  return {
    focusId: row.interviewFocusId,
    requestId: row.interviewAnchorRequestId,
    generation: row.interviewAnchorGeneration
  };
}

function withStamp(row: StampedSpoken, stamp: SpokenStamp | null): StampedSpoken {
  const next: StampedSpoken = { ...row };
  delete next.interviewFocusId;
  delete next.interviewAnchorRequestId;
  delete next.interviewAnchorGeneration;
  if (!stamp) return next;
  next.interviewFocusId = stamp.focusId;
  next.interviewAnchorRequestId = stamp.requestId;
  next.interviewAnchorGeneration = stamp.generation;
  return next;
}

/** 用户轮开始时记下当时已提交的锚。同一 turn 不改租约。没有已提交锚则不租。 */
export function openInterviewRound(
  rounds: readonly InterviewRoundLease[],
  committed: InterviewAnchorCommit | null,
  turnId: string
): InterviewRoundLease[] {
  if (!turnId || !committed) return [...rounds];
  if (rounds.some((row) => row.turnId === turnId)) return [...rounds];
  return [
    ...rounds,
    {
      turnId,
      focusId: committed.focusId,
      requestId: committed.requestId,
      generation: committed.generation
    }
  ];
}

function leaseStamp(rounds: readonly InterviewRoundLease[], turnId: string | undefined): SpokenStamp | null {
  if (!turnId) return null;
  const lease = rounds.find((row) => row.turnId === turnId);
  if (!lease) return null;
  return { focusId: lease.focusId, requestId: lease.requestId, generation: lease.generation };
}

function stampForTurn(
  prior: readonly StampedSpoken[],
  rounds: readonly InterviewRoundLease[],
  turnId: string | undefined
): SpokenStamp | null {
  const priorStamp = prior.map(readStamp).find((stamp) => stamp !== null) ?? null;
  if (priorStamp) return priorStamp;
  return leaseStamp(rounds, turnId);
}

/** WS tts.say / screen_text 的唯一落点。印章只来自该 turn 的轮次租约或已有包,不用到达时的当前锚。 */
export function applySpokenFromWire(
  spoken: readonly StampedSpoken[],
  _committed: InterviewAnchorCommit | null,
  wire:
    | { t: "tts.say"; sentenceId: string; text: string; seq: number; turnId?: string }
    | { t: "screen_text"; turnId: string; text: string; seq: number },
  rounds: readonly InterviewRoundLease[] = []
): StampedSpoken[] {
  if (wire.t === "screen_text") {
    const prior = spoken.filter((sp) => sp.turnId === wire.turnId || belongs(sp.sentenceId, wire.turnId));
    const priorSeq = prior.find((sp) => typeof sp.seq === "number")?.seq;
    const rest = spoken.filter((sp) => sp.turnId !== wire.turnId && !belongs(sp.sentenceId, wire.turnId));
    return [
      ...rest,
      withStamp(
        {
          sentenceId: `screen-${wire.turnId}`,
          text: wire.text,
          seq: priorSeq ?? wire.seq,
          turnId: wire.turnId,
          truncated: false,
          fullScreenText: true
        },
        stampForTurn(prior, rounds, wire.turnId)
      )
    ];
  }
  const turnId = wire.turnId;
  const prior = turnId ? spoken.filter((sp) => sp.turnId === turnId || belongs(sp.sentenceId, turnId)) : [];
  return [
    ...spoken,
    withStamp(
      {
        sentenceId: wire.sentenceId,
        text: wire.text,
        seq: wire.seq,
        truncated: false,
        ...(turnId ? { turnId } : {})
      },
      stampForTurn(prior, rounds, turnId)
    )
  ];
}

export function reduceInterviewAnchor(state: InterviewTrack, event: InterviewTrackEvent): InterviewTrack {
  if (event.type === "round_open") {
    return {
      ...state,
      rounds: openInterviewRound(state.rounds, state.anchor.committed, event.turnId)
    };
  }
  if (event.type === "tts") {
    return {
      anchor: state.anchor,
      rounds: state.rounds,
      spoken: applySpokenFromWire(
        state.spoken,
        state.anchor.committed,
        {
          t: "tts.say",
          sentenceId: event.sentenceId,
          text: event.text,
          seq: event.seq,
          ...(event.turnId ? { turnId: event.turnId } : {})
        },
        state.rounds
      )
    };
  }
  if (event.type === "screen_text") {
    return {
      anchor: state.anchor,
      rounds: state.rounds,
      spoken: applySpokenFromWire(
        state.spoken,
        state.anchor.committed,
        {
          t: "screen_text",
          turnId: event.turnId,
          text: event.text,
          seq: event.seq
        },
        state.rounds
      )
    };
  }
  return { anchor: reduceAnchorOnly(state.anchor, event), spoken: state.spoken, rounds: state.rounds };
}
