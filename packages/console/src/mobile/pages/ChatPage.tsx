import { useEffect, useMemo, useState } from "react";
import { postFirstRunQuery, type FirstRunQueryResult } from "../../lib/setupApi";
import { useVoice } from "../../shell/VoiceContext";
import { loadRecentTranscript, type RecentTranscriptTurn } from "../data";
import { MobileHeader, MobileNotice } from "../MobileChrome";

export function mobileFirstRunTurn(result: FirstRunQueryResult): { key: string; text: string } | null {
  if (result.state !== "presented" || !result.message) return null;
  return { key: `mobile-onboarding-${result.turnId ?? "first"}`, text: result.message };
}

export function shouldRequestMobileFirstRun(suppressFirstRun: boolean, voiceConnected: boolean): boolean {
  return !suppressFirstRun && voiceConnected;
}

export function shouldRetryMobileFirstRun(result: FirstRunQueryResult, attempt: number): boolean {
  return result.state === "presented" && !result.delivered && attempt < 20;
}

export function isPendingUserBubble(
  text: string,
  pendingUserText: string | null | undefined,
  transcribing?: boolean
): boolean {
  if (transcribing) return true;
  if (!pendingUserText) return false;
  return text.trim() === pendingUserText.trim();
}

/** 进度气泡出现后未收到回复/错误的原位超时(覆盖 daemon 整轮失败后永远转圈)。 */
export const MOBILE_THINKING_TIMEOUT_MS = 90_000;

export const MOBILE_THINKING_TIMEOUT_TEXT =
  "这轮没等到回复。可能是连接断了或模型没跑完,重发一次试试。";

export type MobileThinkingUi = "hidden" | "pending" | "timeout";

/**
 * 思考气泡呈现:超时 sticky——通道稍后清 thinking 也不抹掉错误态;
 * 下一轮 thinking 置位时由调用方重置 timedOut。
 * 迟到回复走 spoken 正常追加,与本态无关。
 */
export function mobileThinkingUi(thinking: boolean, timedOut: boolean): MobileThinkingUi {
  if (timedOut) return "timeout";
  if (thinking) return "pending";
  return "hidden";
}

export type ChatBubble = {
  key: string;
  who: "user" | "ai";
  text: string;
  seq: number;
  pending: boolean;
  history?: boolean;
};

/** 历史 turnId 集合,供 live 流去重,避免刷新回放与乐观/WS 同轮冲突。 */
export function historyTurnIdSet(history: readonly RecentTranscriptTurn[]): Set<string> {
  const ids = new Set<string>();
  for (const turn of history) {
    if (turn.turnId) ids.add(turn.turnId);
  }
  return ids;
}

/** 历史回放 → 气泡(负 seq 置顶;与 live 正 seq 可共存排序)。 */
export function historyToBubbles(history: readonly RecentTranscriptTurn[]): ChatBubble[] {
  const total = history.length;
  return history.map((turn, index) => ({
    key: `h-${turn.turnId ?? index}`,
    who: turn.speaker === "user" ? ("user" as const) : ("ai" as const),
    text: turn.text,
    seq: index - total,
    pending: false,
    history: true
  }));
}

export function mergeChatBubbles(input: {
  history: readonly RecentTranscriptTurn[];
  firstRun: { key: string; text: string } | null;
  transcript: readonly {
    turnId: string;
    text: string;
    seq: number;
    transcribing?: boolean;
  }[];
  spoken: readonly { sentenceId: string; text: string; seq: number; turnId?: string }[];
  pendingUserText?: string | null;
}): ChatBubble[] {
  const known = historyTurnIdSet(input.history);
  const historyBubbles = historyToBubbles(input.history);
  const firstRunBubble: ChatBubble[] =
    input.firstRun && !known.has(input.firstRun.key.replace(/^mobile-onboarding-/, ""))
      ? [
          {
            key: input.firstRun.key,
            who: "ai",
            text: input.firstRun.text,
            seq: -1 - historyBubbles.length,
            pending: false
          }
        ]
      : [];
  // 若历史已含同 turnId 开场白,或 firstRun key 对应 turn 已回放,则不再叠一层
  const firstRunFiltered =
    input.firstRun && historyBubbles.some((b) => b.text === input.firstRun!.text && b.who === "ai")
      ? []
      : firstRunBubble;

  const liveUser = input.transcript
    .filter((turn) => !known.has(turn.turnId))
    .map((turn) => ({
      key: `u-${turn.turnId}`,
      who: "user" as const,
      text: turn.text,
      seq: turn.seq,
      pending: isPendingUserBubble(turn.text, input.pendingUserText, turn.transcribing)
    }));

  const liveAi = input.spoken
    .filter((turn) => !known.has(turn.sentenceId) && !(turn.turnId && known.has(turn.turnId)))
    .map((turn) => ({
      key: `a-${turn.sentenceId}`,
      who: "ai" as const,
      text: turn.text,
      seq: turn.seq,
      pending: false
    }));

  return [...historyBubbles, ...firstRunFiltered, ...liveUser, ...liveAi].sort((a, b) => a.seq - b.seq);
}

export function MobileChatPage({
  onDraft,
  suppressFirstRun,
  pendingUserText = null
}: {
  onDraft: (text: string) => void;
  suppressFirstRun: boolean;
  /** 与 useVoiceChannel 乐观 transcript 对账中的用户句：灰显至 pending 清除。 */
  pendingUserText?: string | null;
}) {
  const voice = useVoice();
  const [firstRun, setFirstRun] = useState<{ key: string; text: string } | null>(null);
  const [firstRunError, setFirstRunError] = useState(false);
  const [firstRunAttempt, setFirstRunAttempt] = useState(0);
  const [history, setHistory] = useState<RecentTranscriptTurn[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [thinkingTimedOut, setThinkingTimedOut] = useState(false);

  useEffect(() => {
    if (!voice.thinking) return;
    setThinkingTimedOut(false);
    const timer = window.setTimeout(() => setThinkingTimedOut(true), MOBILE_THINKING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [voice.thinking]);

  const thinkingUi = mobileThinkingUi(voice.thinking, thinkingTimedOut);

  useEffect(() => {
    let active = true;
    void loadRecentTranscript(40).then(
      (payload) => {
        if (!active) return;
        setHistory(payload.turns);
        setHistoryError(false);
      },
      () => {
        if (active) setHistoryError(true);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!shouldRequestMobileFirstRun(suppressFirstRun, voice.connected)) return;
    let active = true;
    let retryTimer: number | undefined;
    void postFirstRunQuery(voice.sessionId).then(
      (result) => {
        if (!active) return;
        setFirstRun(mobileFirstRunTurn(result));
        if (shouldRetryMobileFirstRun(result, firstRunAttempt)) {
          retryTimer = window.setTimeout(() => setFirstRunAttempt((attempt) => attempt + 1), 200);
        } else if (result.state === "presented" && !result.delivered) {
          setFirstRunError(true);
        }
      },
      () => {
        if (active) setFirstRunError(true);
      }
    );
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [firstRunAttempt, voice.connected, voice.sessionId, suppressFirstRun]);

  // 历史回放置顶 + live transcript/spoken/thinking;turnId 去重避免乐观上屏冲突
  const turns = useMemo(
    () =>
      mergeChatBubbles({
        history,
        firstRun,
        transcript: voice.transcript,
        spoken: voice.spoken,
        pendingUserText
      }),
    [firstRun, history, pendingUserText, voice.spoken, voice.transcript]
  );

  return (
    <div data-mobile-page="chat">
      <MobileHeader title="开口聊" crumb="文字与键盘听写 · 多端回复会同显" back="/m" />
      {firstRunError ? <MobileNotice>首跑开场白暂时取不到，不影响继续对话。</MobileNotice> : null}
      {historyError ? <MobileNotice>刚才的对话暂时取不回，新消息不受影响。</MobileNotice> : null}
      <div className="m-chat-stream" data-mobile-transcript>
        {turns.length === 0 ? (
          <section className="m-chat-empty">
            <span>随便说</span>
            <h1>想到哪说到哪，聊成熟了我会问你要不要把这件事立起来。</h1>
            <button type="button" onClick={() => onDraft("帮我盯着这周要办的三件事：")}>
              试试：盯三件事
            </button>
          </section>
        ) : null}
        {turns.map((turn) => (
          <article
            className={[
              "m-bubble",
              `m-bubble-${turn.who}`,
              turn.pending ? "m-bubble-pending" : "",
              turn.history ? "m-bubble-history" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            data-pending={turn.pending ? "true" : undefined}
            data-history={turn.history ? "true" : undefined}
            key={turn.key}
          >
            {turn.text}
          </article>
        ))}
        {thinkingUi === "pending" ? (
          <article className="m-bubble m-bubble-ai m-thinking" data-thinking="pending">
            正在想这件事
          </article>
        ) : null}
        {thinkingUi === "timeout" ? (
          <article className="m-bubble m-bubble-ai m-thinking-error" data-thinking="timeout">
            {MOBILE_THINKING_TIMEOUT_TEXT}
          </article>
        ) : null}
      </div>
    </div>
  );
}
