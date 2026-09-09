// 对话页(#/p/:id/chat;11 §5.6 转写流):用户轮右对齐 ink-wash,AI 轮左对齐 glass;
// partial faint 渐显,final 转 primary;被打断句 faint 删除线(unheard 不进事实的视觉对应)。
// 右栏(>=1280 双栏):「这次聊出来的东西」(批 4 实体卡流)+ 任务卡草稿 + 就绪自省。

import { FileQuestion, Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { EmptyState, PaperCard, SectionTitle } from "../components/ui";
import { useSetup } from "../shell/SetupContext";
import { useVoice } from "../shell/VoiceContext";
import { apiPost } from "../lib/api";
import { navigate } from "../lib/router";
import { postFirstRunQuery, type FirstRunQueryResult, type SetupProbe } from "../lib/setupApi";
import {
  VOICE_SYSTEM_NOTE,
  VOICE_SYSTEM_UNSUPPORTED_MESSAGE,
  cancelSystemTts,
  createSystemAsrSession,
  detectSystemVoiceCaps,
  isVolcConfigured,
  resolveVoiceTransport,
  speakSystemTts,
  type SystemAsrSession,
  type SystemVoiceCaps
} from "../voice/systemVoice";

export { VOICE_SYSTEM_NOTE, VOICE_SYSTEM_UNSUPPORTED_MESSAGE };

export const VOICE_UNCONFIGURED_MESSAGE =
  "语音未配置(可选)——用键盘上的话筒,或直接打字;配好豆包 key 后这里可以开口即说";
export const VOICE_DISABLED_MESSAGE = "文本与控制面可用,语音未启用;你可以继续直接打字";
export const VOICE_DISCONNECTED_MESSAGE = "语音连接未就绪——可以先直接打字;连接恢复后再点击说话";

export function voiceInputUnavailable(
  probe: SetupProbe | null,
  liveHealth: { asr: string } | null = null,
  systemCaps: SystemVoiceCaps = { asr: false, tts: false }
): boolean {
  return resolveVoiceTransport(probe, liveHealth, systemCaps) === "unavailable";
}

export const CHAT_EXAMPLES = [
  "帮我盯着这周要办的三件事:___、___、___",
  "我想给我儿子做个管理玩具的小应用,他玩具太多了",
  "我在调研一个新方向,帮我记住每次聊到的要点",
  "我在等一个重要回复,帮我记着别断了"
] as const;

export function firstRunAssistantTurn(result: FirstRunQueryResult): { key: string; text: string } | null {
  if (result.state !== "presented" || !result.delivered || !result.message) return null;
  return { key: `onboarding-${result.turnId ?? "first"}`, text: result.message };
}

// 生产确认卡 kind 文案单源在 lib/confirmCardCopy(与移动 CardPage 共用;GAP-02 残项 2.1)
import { confirmCardCopy } from "../lib/confirmCardCopy";
export { confirmCardCopy };

export function ChatExampleCards({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="grid gap-[8px] sm:grid-cols-2" data-chat-examples style={{ marginTop: 12 }}>
      {CHAT_EXAMPLES.map((text) => (
        <button
          key={text}
          type="button"
          data-chat-example
          onClick={() => onPick(text)}
          style={{
            padding: "10px 12px",
            textAlign: "left",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-xs)",
            background: "var(--surface-control)",
            color: "var(--text-secondary)",
            fontSize: "var(--text-sm)",
            cursor: "pointer"
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function VoiceStartButton({
  unavailable,
  unavailableMessage = VOICE_UNCONFIGURED_MESSAGE,
  handsFree,
  onClick,
  systemNote
}: {
  unavailable: boolean;
  unavailableMessage?: string;
  handsFree: boolean;
  onClick: () => void;
  systemNote?: string;
}) {
  return (
    <span className="flex items-center gap-[8px]" data-voice-start>
      <button
        type="button"
        data-mic-toggle
        disabled={unavailable}
        onClick={onClick}
        className="flex items-center gap-[8px] border-0"
        style={{
          background: "var(--active-ink)",
          color: "var(--active-ink-fg)",
          borderRadius: "var(--radius-xs)",
          height: 36,
          padding: "0 16px",
          cursor: unavailable ? "not-allowed" : "pointer",
          opacity: unavailable ? "var(--disabled-opacity)" : 1,
          fontSize: "var(--text-sm)"
        }}
        title={
          unavailable
            ? unavailableMessage
            : handsFree
              ? "免手常听中:点这里手动断轮"
              : "点击开始录音;说完选「发送」(直接进对话)或「转文字改一改」;空格按住说、松开即发送"
        }
      >
        <Mic size={16} aria-hidden />
        {handsFree ? "说完了" : "点击说话"}
      </button>
      {systemNote ? (
        <span data-voice-system-note style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {systemNote}
        </span>
      ) : null}
    </span>
  );
}

/** 球权四色 + act(设计 v5 feed 左色条;与 Board/FocusDetail 同口径) */
const ENTITY_COLOR: Record<string, string> = {
  orange: "var(--color-warning)",
  blue: "var(--active-ink)",
  green: "var(--color-success)",
  gray: "var(--text-faint)",
  act: "var(--color-warning)",
  wait: "var(--color-success)",
  start: "var(--active-ink)",
  ext: "var(--text-faint)"
};

function entityBarColor(color: string): string {
  return ENTITY_COLOR[color] ?? ENTITY_COLOR.act!;
}

function formatEntityTime(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? `今天 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** F25:确认卡倒计时进度条(mount 后触发 transition,ms 内 scaleX 1->0,归零=daemon 侧自动执行) */
function CountdownBar({ ms }: { ms: number }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setArmed(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  return (
    <div style={{ height: 3, background: "var(--line)", borderRadius: "var(--radius-2xs)", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          background: "var(--color-warning)",
          transformOrigin: "left",
          transform: armed ? "scaleX(0)" : "scaleX(1)",
          transition: `transform ${ms}ms linear`
        }}
      />
    </div>
  );
}

export function Chat({
  projectId,
  emptyText
}: {
  projectId: string | null;
  /** 批次② chat-new 空态文案;不改语音逻辑 */
  emptyText?: string;
}) {
  const voice = useVoice();
  const setup = useSetup();
  const dialogOneshot = setup.probe?.config.slots.dialog?.mode === "oneshot";
  const systemCaps = detectSystemVoiceCaps();
  const voiceTransport = resolveVoiceTransport(setup.probe, voice.health, systemCaps);
  const systemVoice = voiceTransport === "system";
  const voiceDisconnected = !voice.connected;
  const voiceUnavailable = voiceDisconnected || voiceTransport === "unavailable";
  const voiceUnavailableMessage = voiceDisconnected
    ? VOICE_DISCONNECTED_MESSAGE
    : isVolcConfigured(setup.probe)
      ? setup.probe?.voice.pipelinePeer === false
        ? VOICE_DISABLED_MESSAGE
        : VOICE_UNCONFIGURED_MESSAGE
      : VOICE_SYSTEM_UNSUPPORTED_MESSAGE;
  const systemAsrRef = useRef<SystemAsrSession | null>(null);
  const spokenTtsKeysRef = useRef(new Set<string>());
  // 双动作交互(2026-07-28,11 §5.10 四态):待命 / 录音中 / 转写中(仅 B 档占输入区)/ 待确认
  const [inputState, setInputState] = useState<"idle" | "recording" | "transcribing" | "confirm">("idle");
  // L6/L5:续推锚定条("已接上 X · 工作线:Y");pendingAnchor 由详情页/线菜单写入
  const [anchoredBanner, setAnchoredBanner] = useState<string | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("saydo.chat.pendingAnchor");
    if (!raw) return;
    sessionStorage.removeItem("saydo.chat.pendingAnchor");
    try {
      const p = JSON.parse(raw) as { focusId: string; title?: string; laneTitle?: string };
      if (!p.focusId) return;
      void apiPost(`/api/sessions/${encodeURIComponent(voice.sessionId)}/focus-anchor`, {
        focusId: p.focusId,
        ...(p.laneTitle ? { laneTitle: p.laneTitle } : {})
      })
        .then(() => {
          setAnchoredBanner(`已接上「${p.title ?? p.focusId}」${p.laneTitle ? ` · 工作线:「${p.laneTitle}」` : ""}`);
        })
        .catch(() => {
          setAnchoredBanner("续推锚定没接上,直接开口说也行(说「接着 XX 继续」)");
        });
    } catch {
      // 坏数据直接丢弃
    }
  }, []);
  const [draftText, setDraftText] = useState("");
  const [firstRunTurn, setFirstRunTurn] = useState<{ key: string; text: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void postFirstRunQuery(voice.sessionId)
      .then((result) => {
        if (!alive) return;
        const turn = firstRunAssistantTurn(result);
        if (turn) setFirstRunTurn(turn);
      })
      .catch(() => {
        // 首跑探询失败不挡正常对话;setup/recovery 门禁另行呈现。
      });
    return () => {
      alive = false;
    };
  }, [voice.sessionId]);
  const [recElapsed, setRecElapsed] = useState(0);
  const [transcribeError, setTranscribeError] = useState(false);
  const recTimerRef = useRef<number | null>(null);
  const recStartRef = useRef(0);
  // review B-3:B 档转写覆盖基线——停录时刻的 draftText 快照(残稿视为可覆盖;转写中新打的字不覆盖)
  const draftBaseRef = useRef("");
  // review C-1:空格起录标记(鼠标起录后松空格不误触发送;up 只认本标记)
  const spaceHeldRef = useRef(false);
  // L1(2026-08-09):思考中超 20s 追加计时呈现(reasoning 模型 30-90s 是常态,无反馈会被当卡死);
  // 纯呈现层计时——thinking 由运行时终态清除,通道兜底覆盖 oneshot wall timeout。
  const [thinkingSec, setThinkingSec] = useState(0);
  useEffect(() => {
    if (!voice.thinking) {
      setThinkingSec(0);
      return;
    }
    const start = Date.now();
    setThinkingSec(0);
    const t = window.setInterval(() => setThinkingSec(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [voice.thinking]);

  useEffect(() => {
    if (!systemVoice) {
      cancelSystemTts();
      return;
    }
    const hasSentences = voice.spoken.some((s) => !s.fullScreenText && !s.truncated);
    for (const s of voice.spoken) {
      if (s.truncated) continue;
      if (s.fullScreenText && hasSentences) continue;
      if (spokenTtsKeysRef.current.has(s.sentenceId)) continue;
      spokenTtsKeysRef.current.add(s.sentenceId);
      speakSystemTts(s.text);
    }
  }, [systemVoice, voice.spoken]);

  useEffect(() => {
    return () => {
      systemAsrRef.current?.abort();
      cancelSystemTts();
    };
  }, []);

  const anchorNow = (): void => {
    if (projectId !== null) voice.setAnchorProjectId(projectId);
  };
  const startRecording = (): void => {
    if (voiceUnavailable) return;
    anchorNow();
    setTranscribeError(false);
    setInputState("recording");
    recStartRef.current = Date.now();
    setRecElapsed(0);
    recTimerRef.current = window.setInterval(() => setRecElapsed(Math.floor((Date.now() - recStartRef.current) / 1000)), 250);
    if (systemVoice) {
      cancelSystemTts();
      if (!systemAsrRef.current) systemAsrRef.current = createSystemAsrSession();
      if (!systemAsrRef.current?.start()) {
        stopRecTimer();
        setInputState("idle");
        setTranscribeError(true);
      }
      return;
    }
    voice.pttDown();
  };
  const stopRecTimer = (): void => {
    if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    recTimerRef.current = null;
  };
  /** 动作 A·直接发送(主路径):对话流立刻出语音气泡占位,转写后挂文字 + Brain 开跑 */
  const stopRecordingToSend = (): void => {
    stopRecTimer();
    if (systemVoice) {
      const text = systemAsrRef.current?.stop() ?? "";
      setInputState("idle");
      setDraftText("");
      if (text === "") {
        setTranscribeError(true);
        return;
      }
      voice.sendText(text);
      return;
    }
    voice.endCaptureSend(recElapsed);
    setInputState("idle");
    setDraftText("");
  };
  /** 动作 B·转写编辑:只进输入框,编辑后发送才进对话 */
  const stopRecordingToEdit = (): void => {
    stopRecTimer();
    if (systemVoice) {
      const text = systemAsrRef.current?.stop() ?? "";
      draftBaseRef.current = draftText;
      if (text === "") {
        setTranscribeError(true);
        setInputState(draftText.trim() === "" ? "idle" : "confirm");
        return;
      }
      setDraftText(text);
      setInputState("confirm");
      return;
    }
    draftBaseRef.current = draftText; // B-3 基线快照
    voice.endCaptureEdit(recElapsed);
    setInputState("transcribing");
  };
  /** 取消 = 彻底丢弃(修隐藏 bug:旧实现走直发链会喂 Brain;现走 hold+cancelled,零痕迹) */
  const cancelRecording = (): void => {
    stopRecTimer();
    if (systemVoice) {
      systemAsrRef.current?.abort();
      setInputState("idle");
      setDraftText("");
      return;
    }
    voice.cancelCapture(recElapsed);
    setInputState("idle");
    setDraftText("");
  };
  const confirmSend = (): void => {
    voice.sendText(draftText);
    setInputState("idle");
    setDraftText("");
  };
  // B 档转写结果事件消费(评审 C1:守卫在消费端——用户转写中已打字则不覆盖;error 给显式反馈)
  useEffect(() => {
    const ev = voice.draftEvent;
    if (!ev) return;
    voice.consumeDraftEvent();
    if (inputState !== "transcribing") return; // 迟到事件(已切态)丢弃
    if (ev.kind === "error") {
      setTranscribeError(true);
      setInputState(draftText.trim() === "" ? "idle" : "confirm");
      window.setTimeout(() => setTranscribeError(false), 5000);
      return;
    }
    // B-3:等于基线(未在转写中打新字,含待命残稿)⇒ 转写覆盖;打了新字 ⇒ 不覆盖(C1 守卫)
    if (draftText === draftBaseRef.current || draftText.trim() === "") setDraftText(ev.text);
    setInputState("confirm");
  }, [voice.draftEvent, voice, inputState, draftText]);
  // 空格 hold(键盘长按;仅待命态、非文本框聚焦时)——松开 = 直接发送(A 主路径);Esc = 取消
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (
        e.code === "Space" &&
        inputState === "idle" &&
        !voiceUnavailable &&
        !(e.target as HTMLElement)?.closest?.("input,textarea")
      ) {
        e.preventDefault();
        spaceHeldRef.current = true; // C-1:up 只认空格起录的会话(鼠标起录不受松空格影响)
        startRecording();
      }
      if (e.code === "Escape" && inputState === "recording") {
        e.preventDefault();
        spaceHeldRef.current = false;
        cancelRecording();
      }
    };
    const up = (e: KeyboardEvent): void => {
      if (e.code === "Space" && inputState === "recording" && spaceHeldRef.current) {
        e.preventDefault();
        spaceHeldRef.current = false;
        stopRecordingToSend();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  // 锚定项目(切导航不断会话;要和 B 项目对话需显式开麦——PTT 即显式)。
  // C1:projectId=null = 无锚定新对话(#/chat)——不锚定,开口即建 draft,归属由对话第一句问定
  useEffect(() => {
    if (projectId !== null && voice.anchorProjectId === null) voice.setAnchorProjectId(projectId);
  }, [projectId, voice]);

  // W2 场次① A2:AI 句与用户轮按到达序交错(此前两列表简单拼接,AI 恒叠在用户轮上方);
  // A3:思考中气泡(说完到首句回话之间;02 §3 学习中是一等状态)
  const turns = [
    ...(firstRunTurn
      ? [{
          key: firstRunTurn.key,
          who: "ai" as const,
          text: firstRunTurn.text,
          faint: false,
          strike: false,
          seq: -1,
          voiceBadge: null as string | null,
          transcribing: false,
          failed: false
        }]
      : []),
    ...voice.spoken.map((s) => ({
      key: `ai-${s.sentenceId}`,
      who: "ai" as const,
      text: s.text,
      faint: s.truncated,
      strike: s.truncated,
      seq: s.seq,
      voiceBadge: null as string | null,
      transcribing: false,
      failed: false
    })),
    ...voice.transcript.map((t) => ({
      key: `u-${t.turnId}-${t.final ? "f" : "p"}`,
      who: "user" as const,
      text: t.text,
      faint: !t.final,
      strike: false,
      seq: t.seq,
      // 双动作 A 档:语音轮带时长标签;占位态"转写中…"/失败态"转写失败"
      voiceBadge:
        t.durationSec !== undefined
          ? `语音 ${String(Math.floor(t.durationSec / 60)).padStart(2, "0")}:${String(t.durationSec % 60).padStart(2, "0")}`
          : null,
      transcribing: t.transcribing === true,
      failed: t.failed === true
    }))
  ].sort((a, b) => a.seq - b.seq);

  return (
    <div className="grid grid-cols-1 gap-[var(--space-4)] xl:grid-cols-[1fr_320px]" data-page="chat">
      <PaperCard>
        <div className="flex items-center justify-between">
          <SectionTitle>对话</SectionTitle>
          <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            {voice.connected ? "connected" : "connecting"}
            {voice.health ? ` · asr=${voice.health.asr} tts=${voice.health.tts}` : ""}
          </span>
        </div>
        {dialogOneshot ? (
          <p
            data-dialog-mode="oneshot"
            style={{ margin: "0 0 10px", fontSize: "var(--text-xs)", color: "var(--color-warning)" }}
          >
            CLI 慢速模式·每轮约 15-25 秒·配 API key 后时延以服务商为准
          </p>
        ) : null}
        {/* L13:dialog 槽非 ok → 错误态引导去设置页配置向导(真实存在的门) */}
        {!setup.loading && !setup.dialogReady ? (
          <div
            data-setup-needed
            style={{
              marginBottom: 10,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-error)",
              background: "var(--surface-ink-wash)",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
              对话模型还没配好——去设置页的配置向导,两分钟完成
            </p>
            <button
              type="button"
              data-action="goto-setup"
              onClick={() => {
                setup.setWizardOpen(true);
                navigate("/settings");
              }}
              style={{
                alignSelf: "flex-start",
                height: 32,
                padding: "0 12px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--active-ink-border)",
                background: "var(--active-ink)",
                color: "var(--active-ink-fg)",
                fontSize: "var(--text-sm)",
                cursor: "pointer"
              }}
            >
              去设置页配置
            </button>
          </div>
        ) : null}
        {anchoredBanner ? (
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              background: "var(--active-ink-wash)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-xs)",
              padding: "6px 10px",
              marginBottom: 8
            }}
          >
            {anchoredBanner}
          </div>
        ) : null}
        <div className="flex min-h-[220px] flex-col gap-[var(--space-2)]" data-transcript>
          {turns.length === 0 ? (
            <div>
              <EmptyState
                icon={Mic}
                text={
                  emptyText ??
                  "点下面的按钮说话:说完可以直接发送,也可以先转成文字改一改再发"
                }
              />
              <p style={{ margin: "12px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>试试这样说</p>
              <ChatExampleCards onPick={setDraftText} />
            </div>
          ) : (
            turns.map((t) => (
              <div key={t.key} className="flex" style={{ justifyContent: t.who === "user" ? "flex-end" : "flex-start" }}>
                <span
                  data-voice-turn={t.transcribing ? "transcribing" : t.failed ? "failed" : undefined}
                  style={{
                    maxWidth: "72%",
                    fontSize: "var(--text-base)",
                    lineHeight: "var(--leading-body)",
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: t.who === "user" ? "var(--surface-ink-wash)" : "var(--surface)",
                    border: t.who === "ai" ? "1px solid var(--line)" : "none",
                    color: t.faint || t.transcribing ? "var(--text-faint)" : t.failed ? "var(--color-error)" : "var(--text-primary)",
                    textDecoration: t.strike ? "line-through" : "none"
                  }}
                >
                  {/* 双动作 A 档:语音气泡——已发出语义先行,转写在途/失败/到达三态(11 §5.10) */}
                  {t.voiceBadge ? (
                    <span className="flex items-center gap-[6px]" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: t.text ? 2 : 0 }}>
                      <Mic size={12} aria-hidden />
                      <span style={{ fontFamily: "var(--font-mono)" }}>{t.voiceBadge}</span>
                      {t.transcribing ? <span>· 转写中…</span> : null}
                      {t.failed ? <span>· 没听清(转写失败),请重说</span> : null}
                    </span>
                  ) : null}
                  {t.text}
                </span>
              </div>
            ))
          )}
          {voice.thinking ? (
            <div className="flex" style={{ justifyContent: "flex-start" }} data-thinking>
              <span
                style={{
                  fontSize: "var(--text-base)",
                  lineHeight: "var(--leading-body)",
                  color: "var(--text-faint)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line)"
                }}
              >
                {dialogOneshot ? "CLI 慢速模式处理中…" : "思考中…"}
                {dialogOneshot || thinkingSec > 20 ? (
                  <span data-thinking-elapsed style={{ display: "block", fontSize: "var(--text-xs)", marginTop: 2 }}>
                    {dialogOneshot
                      ? `已等待 ${thinkingSec} 秒,这一轮仍在 CLI 进程中`
                      : `已想了 ${thinkingSec} 秒,reasoning 模型想得久是常态`}
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
        {/* F25(2026-08-04 义骁裁决):确认卡——语音只念提议核心,操作说明与按钮在此;倒计时归零自动执行 */}
        {voice.confirmCard ? (
          <div
            data-confirm-card
            style={{
              marginTop: "var(--space-3)",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-warning)",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            {confirmCardCopy(voice.confirmCard.kind).label ? (
              <span data-confirm-kind-label style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                {confirmCardCopy(voice.confirmCard.kind).label}
              </span>
            ) : null}
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", lineHeight: "var(--leading-body)" }}>
              {voice.confirmCard.text}
            </span>
            {voice.confirmCard.countdownMs !== null ? (
              <>
                <CountdownBar key={voice.confirmCard.receiptId} ms={voice.confirmCard.countdownMs} />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                  {confirmCardCopy(voice.confirmCard.kind).countdownHint}
                </span>
              </>
            ) : (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>{confirmCardCopy(voice.confirmCard.kind).idleHint}</span>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                data-confirm-do
                onClick={() => voice.sendConfirmClick("accept")}
                style={{ height: 32, padding: "0 18px", borderRadius: "var(--radius-xs)", border: "1px solid var(--color-warning)", background: "var(--color-warning)", color: "var(--fg-on-fill)", fontSize: "var(--text-sm)", cursor: "pointer" }}
              >
                {confirmCardCopy(voice.confirmCard.kind).accept}
              </button>
              <button
                type="button"
                data-confirm-reject
                onClick={() => voice.sendConfirmClick("reject")}
                style={{ height: 32, padding: "0 18px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "transparent", color: "var(--text-muted)", fontSize: "var(--text-sm)", cursor: "pointer" }}
              >
                {confirmCardCopy(voice.confirmCard.kind).reject}
              </button>
            </div>
          </div>
        ) : null}
        {/* dogfood 修复(2026-07-28):autoplay 被拒提示——用户手势解锁声音 */}
        {voice.audioBlocked ? (
          <button
            type="button"
            data-audio-unlock
            onClick={voice.retryAudio}
            style={{ marginTop: "var(--space-3)", padding: "8px 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--color-warning)", background: "transparent", color: "var(--color-warning)", fontSize: "var(--text-sm)", cursor: "pointer", textAlign: "left" }}
          >
            浏览器拦截了语音自动播放(刷新后未点过页面)——点这里启用声音
          </button>
        ) : null}
        {/* 双动作输入区(11 §5.10 四态):待命/录音中(结束时选直发或转写编辑)/转写中/待确认 */}
        {transcribeError ? (
          <div
            data-transcribe-error
            style={{ marginTop: "var(--space-3)", padding: "8px 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--color-warning)", color: "var(--color-warning)", fontSize: "var(--text-sm)" }}
          >
            没听清这段语音(转写为空或失败)——重说一次,或直接打字。
          </div>
        ) : null}
        <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]" data-input-region data-input-state={inputState}>
          {inputState === "idle" ? (
            <div className="flex items-center gap-[var(--space-3)]" style={{ flexWrap: "wrap" }}>
              {/* ① 点击 toggle 采集(桌面习惯:点开始、再点停)*/}
              <VoiceStartButton
                unavailable={voiceUnavailable}
                unavailableMessage={voiceUnavailableMessage}
                handsFree={!systemVoice && voice.mode === "hands_free"}
                systemNote={systemVoice && !voiceUnavailable ? VOICE_SYSTEM_NOTE : undefined}
                onClick={() =>
                  !systemVoice && voice.mode === "hands_free"
                    ? (anchorNow(), voice.doneSpeaking())
                    : startRecording()
                }
              />
              {/* 直接打字(文本框;免手/手动皆可)*/}
              <input
                type="text"
                data-text-input
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draftText.trim() !== "") {
                    anchorNow();
                    voice.sendText(draftText);
                    setDraftText("");
                  }
                }}
                placeholder="或直接打字,回车发送"
                style={{ flex: "1 1 200px", height: 36, padding: "0 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "var(--surface-control)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}
              />
              <button
                type="button"
                data-text-send
                disabled={draftText.trim() === ""}
                onClick={() => {
                  anchorNow();
                  voice.sendText(draftText);
                  setDraftText("");
                }}
                style={{ height: 36, padding: "0 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "var(--surface-control)", color: "var(--text-primary)", fontSize: "var(--text-sm)", cursor: draftText.trim() === "" ? "not-allowed" : "pointer", opacity: draftText.trim() === "" ? "var(--disabled-opacity)" : 1 }}
              >
                发送
              </button>
              <button
                type="button"
                data-voice-mode-toggle
                disabled={voiceUnavailable || systemVoice}
                onClick={() => voice.setMode(voice.mode === "ptt" ? "hands_free" : "ptt")}
                style={{ height: 36, padding: "0 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "transparent", color: "var(--text-muted)", fontSize: "var(--text-xs)", cursor: voiceUnavailable || systemVoice ? "not-allowed" : "pointer", opacity: voiceUnavailable || systemVoice ? "var(--disabled-opacity)" : 1 }}
                title={
                  systemVoice
                    ? "系统语音只用点击说话;配好 VOLC 后可切免手"
                    : voice.mode === "ptt"
                      ? "切免手:开口即说,停顿自动断轮"
                      : "切回按住说(PTT 兜底通道)"
                }
              >
                {voice.mode === "ptt" ? "切免手模式" : "切回按住说"}
              </button>
              {/* F25/FOCUS 挂账:前端撤销写口——复用 dialog "撤销"词法(直通操作 undo 栈) */}
              <button
                type="button"
                data-undo
                onClick={() => voice.sendText("撤销")}
                title="撤回上一次直通操作(接上/记事/办结)"
                style={{ height: 36, padding: "0 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "transparent", color: "var(--text-muted)", fontSize: "var(--text-xs)", cursor: "pointer" }}
              >
                撤销
              </button>
            </div>
          ) : inputState === "recording" ? (
            // ② 录音中:电平 + 计时 + 双动作结束(直接发送 / 转文字改一改)+ 取消(11 §5.10 四态)
            <div className="flex items-center gap-[var(--space-3)]" data-recording style={{ flexWrap: "wrap" }}>
              <span className="flex items-center gap-[2px]" data-rec-level aria-label="电平">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      width: 3,
                      height: 8 + Math.round(Math.min(1, voice.mic.level * (1 + i * 0.25)) * 20),
                      background: voice.mic.level > i * 0.18 ? "var(--color-error)" : "var(--line)",
                      borderRadius: "var(--radius-2xs)",
                      transition: "height 80ms"
                    }}
                  />
                ))}
              </span>
              <span data-rec-timer style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                {String(Math.floor(recElapsed / 60)).padStart(2, "0")}:{String(recElapsed % 60).padStart(2, "0")}
              </span>
              <button
                type="button"
                data-rec-send
                onClick={stopRecordingToSend}
                className="flex items-center gap-[6px] border-0"
                style={{ background: "var(--active-ink)", color: "var(--active-ink-fg)", borderRadius: "var(--radius-xs)", height: 36, padding: "0 14px", cursor: "pointer", fontSize: "var(--text-sm)" }}
                title="说完直接发出去(松开空格同义);转写在对话里补上,AI 立刻开工"
              >
                <Square size={14} aria-hidden />
                发送
              </button>
              <button
                type="button"
                data-rec-edit
                onClick={stopRecordingToEdit}
                style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", height: 36, padding: "0 12px", cursor: "pointer", fontSize: "var(--text-sm)" }}
                title="先转成文字改一改,确认后再发(不会直接进对话)"
              >
                转文字改一改
              </button>
              <button
                type="button"
                data-rec-cancel
                onClick={cancelRecording}
                className="flex items-center gap-[6px]"
                style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", height: 36, padding: "0 12px", cursor: "pointer", fontSize: "var(--text-sm)" }}
                title="丢弃这段录音(Esc 同义):不进对话、不打扰 AI"
              >
                <X size={14} aria-hidden />
                取消
              </button>
            </div>
          ) : inputState === "transcribing" ? (
            // ③ 转写中(仅 B 档):显式等待反馈——绝不静默(dogfood 问题①根修);可先打字,后到转写不覆盖
            <div className="flex flex-col gap-[var(--space-2)]" data-transcribing>
              <div className="flex items-center gap-[8px]" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                <Mic size={14} aria-hidden />
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  语音 {String(Math.floor(recElapsed / 60)).padStart(2, "0")}:{String(recElapsed % 60).padStart(2, "0")}
                </span>
                <span data-transcribing-hint className="animate-pulse">· 转写中…(长语音要几秒,好了会填进下面的框)</span>
              </div>
              <textarea
                data-confirm-transcript
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={2}
                placeholder="转写中…也可以直接打字(后到的转写不会覆盖你打的字)"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "var(--surface-control)", color: "var(--text-primary)", fontSize: "var(--text-base)", resize: "vertical" }}
              />
            </div>
          ) : (
            // ④ 待确认(仅 B 档):可编辑转写——发送后才进对话(11 §5.10)
            <div className="flex flex-col gap-[var(--space-2)]" data-confirm>
              <div className="flex items-center gap-[8px]" data-voice-bar style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                <Mic size={14} aria-hidden />
                <span data-voice-bar-dur style={{ fontFamily: "var(--font-mono)" }}>
                  语音 {String(Math.floor(recElapsed / 60)).padStart(2, "0")}:{String(recElapsed % 60).padStart(2, "0")}
                </span>
                <span>· 改好点发送才进对话(这里的内容 AI 还看不到)</span>
              </div>
              <textarea
                data-confirm-transcript
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={2}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "var(--surface-control)", color: "var(--text-primary)", fontSize: "var(--text-base)", resize: "vertical" }}
              />
              <div className="flex items-center gap-[var(--space-3)]">
                <button
                  type="button"
                  data-confirm-send
                  disabled={draftText.trim() === ""}
                  onClick={confirmSend}
                  className="border-0"
                  style={{ background: "var(--active-ink)", color: "var(--active-ink-fg)", borderRadius: "var(--radius-xs)", height: 36, padding: "0 16px", cursor: draftText.trim() === "" ? "not-allowed" : "pointer", opacity: draftText.trim() === "" ? "var(--disabled-opacity)" : 1, fontSize: "var(--text-sm)" }}
                >
                  发送
                </button>
                <button
                  type="button"
                  data-confirm-redo
                  onClick={() => {
                    setDraftText("");
                    startRecording();
                  }}
                  style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", height: 36, padding: "0 12px", cursor: "pointer", fontSize: "var(--text-sm)" }}
                >
                  重录
                </button>
              </div>
            </div>
          )}
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
            {voiceUnavailable
              ? voiceUnavailableMessage
              : voice.mic.error && inputState === "recording"
              ? `麦克风不可用:${voice.mic.error}`
              : inputState === "recording"
                ? `${voice.mode === "hands_free" ? "免手常听中" : "采集中"} · AEC ${voice.mic.aec ? "已生效" : "未生效(外放建议耳机)"}`
                : inputState === "confirm"
                  ? "采完不直发:确认再进对话(免手档会自动发,手动档等你确认)"
                  : voice.mode === "hands_free"
                    ? "免手模式:开口即说,停顿自动断轮"
                    : "点击说话 / 按住空格 / 或直接打字"}
          </span>
        </div>
      </PaperCard>
      {/* 右栏:这次聊出来的东西(批 4)+ 草稿与就绪(保留) */}
      <div className="flex flex-col gap-[var(--space-4)]">
        <div data-entity-feed>
        <PaperCard>
          <SectionTitle>这次聊出来的东西</SectionTitle>
          <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
            每张卡都记在案;纯聊天不长卡
          </p>
          {voice.entities.length === 0 ? (
            <EmptyState
              icon={FileQuestion}
              text="办成事会在这里长出卡片——纯聊天不长,这里不掺水"
            />
          ) : (
            <div className="flex flex-col gap-[10px]" data-entity-list>
              {voice.entities.map((e) => {
                const cardStyle: CSSProperties = {
                  border: "1px solid var(--line)",
                  borderLeftWidth: 3,
                  borderLeftColor: entityBarColor(e.color),
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  background: "var(--surface)",
                  animation: "saydo-feed-in 0.4s ease both"
                };
                return (
                  <div key={e.id} data-entity-item style={cardStyle}>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        fontSize: "var(--text-xs)",
                        color: "var(--text-faint)"
                      }}
                    >
                      <span
                        style={{
                          background: "var(--surface-control)",
                          padding: "0 8px",
                          borderRadius: "var(--radius-xs)",
                          color: "var(--text-muted)"
                        }}
                      >
                        {e.kind}
                      </span>
                      <span>{formatEntityTime(e.at)}</span>
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: 500,
                        marginTop: 4,
                        color: "var(--text-primary)",
                        lineHeight: "var(--leading-body)"
                      }}
                    >
                      {e.title}
                    </div>
                    {e.sub ? (
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                        {e.sub}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </PaperCard>
        </div>
        <PaperCard>
          <SectionTitle>任务卡草稿</SectionTitle>
          <EmptyState icon={FileQuestion} text="采访进行中会在这里长出草稿" />
        </PaperCard>
        <PaperCard>
          <SectionTitle>就绪自省</SectionTitle>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            每轮末评估目标/验收/边界/风险四维;就绪后才会提议开工。
          </p>
        </PaperCard>
      </div>
    </div>
  );
}
