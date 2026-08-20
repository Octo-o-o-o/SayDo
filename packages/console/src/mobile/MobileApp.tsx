import { useEffect, useMemo, useRef, useState } from "react";
import { useVoice } from "../shell/VoiceContext";
import { useDaemonStatus } from "./dstat";
import { useMobileAttention, useMobileFocus, useMobileFocuses } from "./hooks";
import { MobileNotice, MobileShell } from "./MobileChrome";
import { MobileCardPage } from "./pages/CardPage";
import { MobileChatPage } from "./pages/ChatPage";
import { MobileFocusPage } from "./pages/FocusPage";
import { MobileLanePage } from "./pages/LanePage";
import { MobileThingsPage } from "./pages/ThingsPage";
import { MobileTodayPage } from "./pages/TodayPage";
import type { MobileRoute } from "./router";
import {
  composeNativeTranscript,
  installNativeBridge,
  recentNativeFocuses,
  type NativeBridgeConnection,
  type NativeBridgeWindow,
  type NativeTranscriptRequest,
  type NativeTranscriptResult
} from "./nativeBridge";
import { requestMobileReconnect } from "./reconnect";
import { sendFailedToast, sentToast } from "./toasts";
import "./mobile.css";

export function publishMobileSettlement(
  message: string,
  setToast: (message: string) => void,
  reload: () => Promise<void>
): void {
  setToast(message);
  void reload();
}

export function planNativeTranscriptSubmission(
  request: NativeTranscriptRequest,
  focuses: ReturnType<typeof recentNativeFocuses>,
  draft: string,
  status: "connecting" | "online" | "offline",
  busy: boolean
): { result: NativeTranscriptResult; text?: string } {
  const base = { requestId: request.requestId, captureId: request.captureId };
  const text = composeNativeTranscript(request, focuses);
  if (text === null) return { result: { ...base, status: "rejected", reason: "focus_mismatch" } };
  if (draft.trim() !== "") return { result: { ...base, status: "rejected", reason: "draft_conflict" } };
  if (request.action === "draft") return { result: { ...base, status: "drafted" }, text };
  if (status !== "online") return { result: { ...base, status: "rejected", reason: "offline" } };
  if (busy) return { result: { ...base, status: "rejected", reason: "busy" } };
  return { result: { ...base, status: "queued_to_socket" }, text };
}

/** 发送成功后若不在 M-Chat 则导航过去（hash 已在则不动）。 */
/** 发送成功后若不在 M-Chat 则应导航；返回规范化 hash（含 #）。 */
export function ensureMobileChatRoute(hash: string = ""): string {
  const path = hash.replace(/^#/, "");
  if (path === "/m/chat" || path.startsWith("/m/chat?")) return `#${path}`;
  return "#/m/chat";
}

export function MobileApp({ route }: { route: MobileRoute }) {
  const voice = useVoice();
  const status = useDaemonStatus(voice.connected);
  const attention = useMobileAttention();
  const focuses = useMobileFocuses();
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  /** 与 useVoiceChannel 乐观 transcript 对账：pending 期间气泡灰显，入账后实心。 */
  const [pendingSend, setPendingSend] = useState<{ text: string; afterSeq: number } | null>(null);
  const [suppressFirstRun, setSuppressFirstRun] = useState(false);
  const [nativeMode, setNativeMode] = useState(false);
  const bridgeRef = useRef<NativeBridgeConnection | null>(null);
  const recentFocuses = useMemo(() => recentNativeFocuses(focuses.data), [focuses.data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3_200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!pendingSend) return;
    const enqueued = voice.transcript.some(
      (turn) => turn.seq > pendingSend.afterSeq && turn.text.trim() === pendingSend.text
    );
    if (!enqueued) {
      if (status === "offline") {
        setPendingSend(null);
        setToast(sendFailedToast("unknown"));
      }
      return;
    }
    // 乐观上屏已入 voice.transcript：清 pending → 气泡由灰转实心
    setPendingSend(null);
  }, [pendingSend, status, voice.transcript]);

  const queueText = (textInput: string): boolean => {
    const text = textInput.trim();
    if (status !== "online" || text === "" || pendingSend) return false;
    const afterSeq = voice.transcript.reduce((max, turn) => Math.max(max, turn.seq), 0);
    try {
      if (!voice.sendText(text)) {
        setToast(sendFailedToast("offline"));
        return false;
      }
      // 消费 useVoiceChannel 乐观回显；立即导航 M-Chat + 人话 toast
      setPendingSend({ text, afterSeq });
      setSuppressFirstRun(true);
      setDraft((current) => (current.trim() === text ? "" : current));
      if (ensureMobileChatRoute(location.hash) !== location.hash) {
        location.hash = "/m/chat";
      }
      setToast(sentToast(text));
      return true;
    } catch {
      setToast(sendFailedToast("unknown"));
      return false;
    }
  };

  const send = () => {
    void queueText(draft);
  };

  const nativeSubmitRef = useRef<(request: NativeTranscriptRequest) => NativeTranscriptResult>(() => ({
    status: "rejected",
    requestId: "",
    captureId: "",
    reason: "bridge_inactive"
  }));
  nativeSubmitRef.current = (request) => {
    const plan = planNativeTranscriptSubmission(request, recentFocuses, draft, status, pendingSend !== null);
    if (plan.result.status === "rejected") {
      const messages: Record<typeof plan.result.reason, string> = {
        invalid_request: "原生转写请求无效，请再试一次。",
        bridge_inactive: "页面桥接已失效，请刷新后重试。",
        focus_mismatch: "选中的事已变化，请重新上滑选择。",
        draft_conflict: "输入框里还有文字，请先发送或清空；原草稿已保留。",
        offline: sendFailedToast("offline"),
        busy: sendFailedToast("busy")
      };
      setToast(messages[plan.result.reason]);
      return plan.result;
    }
    const nativeText = plan.text as string;
    if (plan.result.status === "drafted") {
      setDraft(nativeText);
      location.hash = "/m/chat";
      return plan.result;
    }
    if (!queueText(nativeText)) {
      return { status: "rejected", requestId: request.requestId, captureId: request.captureId, reason: "offline" };
    }
    return plan.result;
  };

  useEffect(() => {
    const connection = installNativeBridge(
      window as unknown as NativeBridgeWindow,
      voice.sessionId,
      (request) => nativeSubmitRef.current(request)
    );
    bridgeRef.current = connection;
    setNativeMode(connection !== null);
    return () => {
      connection?.dispose();
      if (bridgeRef.current === connection) bridgeRef.current = null;
    };
  }, [voice.sessionId]);

  useEffect(() => bridgeRef.current?.publishFocuses(recentFocuses), [recentFocuses]);
  useEffect(() => bridgeRef.current?.publishStatus(status), [status]);
  useEffect(() => {
    const connection = bridgeRef.current;
    if (!connection || voice.nativeReplies.length === 0) return;
    for (const reply of voice.nativeReplies) connection.forwardReply(reply);
    voice.consumeNativeReplies(voice.nativeReplies.length);
  }, [nativeMode, voice.nativeReplies, voice.consumeNativeReplies]);

  return (
    <MobileShell
      status={status}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      draft={draft}
      setDraft={setDraft}
      onSend={send}
      sending={pendingSend !== null}
      nativeMode={nativeMode}
      onReconnect={requestMobileReconnect}
    >
      {toast ? <div className="m-toast" role="status">{toast}</div> : null}
      <MobilePage
        route={route}
        attention={attention.data}
        attentionError={attention.error}
        focuses={focuses.data}
        focusesError={focuses.error}
        onDraft={setDraft}
        suppressFirstRun={suppressFirstRun || voice.transcript.length > 0}
        pendingUserText={pendingSend?.text ?? null}
        onConfirmSettled={(message) => publishMobileSettlement(message, setToast, attention.reload)}
      />
    </MobileShell>
  );
}

function MobilePage({
  route,
  attention,
  attentionError,
  focuses,
  focusesError,
  onDraft,
  suppressFirstRun,
  pendingUserText,
  onConfirmSettled
}: {
  route: MobileRoute;
  attention: ReturnType<typeof useMobileAttention>["data"];
  attentionError: string | null;
  focuses: ReturnType<typeof useMobileFocuses>["data"];
  focusesError: string | null;
  onDraft: (text: string) => void;
  suppressFirstRun: boolean;
  pendingUserText: string | null;
  onConfirmSettled: (message: string) => void;
}) {
  switch (route.page) {
    case "today":
      return <MobileTodayPage items={attention} error={attentionError} />;
    case "things":
      return <MobileThingsPage rows={focuses} error={focusesError} />;
    case "focus":
      return <FocusRoute focusId={route.focusId} />;
    case "lane":
      return <LaneRoute focusId={route.focusId} laneId={route.laneId} />;
    case "card":
      return (
        <MobileCardPage
          cardRef={{ kind: route.kind, entityId: route.id }}
          attention={attention}
          attentionError={attentionError}
          onSettled={onConfirmSettled}
        />
      );
    case "chat":
      return (
        <MobileChatPage
          onDraft={onDraft}
          suppressFirstRun={suppressFirstRun}
          pendingUserText={pendingUserText}
        />
      );
    case "notfound":
      return <MobileNotice>移动页面不存在。<a href="#/m">回今天</a></MobileNotice>;
  }
}

function FocusRoute({ focusId }: { focusId: string }) {
  const resource = useMobileFocus(focusId);
  return <MobileFocusPage data={resource.data} error={resource.error} />;
}

function LaneRoute({ focusId, laneId }: { focusId: string; laneId: string }) {
  const resource = useMobileFocus(focusId);
  return <MobileLanePage data={resource.data} laneId={laneId} error={resource.error} />;
}
