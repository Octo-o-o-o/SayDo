// 任务/安排详情弹窗:显示真实视图状态,复用任务详情动作边界;发送失败保留内容。

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { api, apiPost } from "../lib/api";
import { apiErrorMessage } from "../lib/apiError";
import {
  claimTaskContextOwner,
  clearBoundTaskContext,
  createTaskContextLifetime,
  enqueueTaskContextCleanup,
  establishTaskContext,
  loadObligationDetail,
  loadTaskModalTask,
  releaseTaskContextOwner,
  settleTaskContextResult,
  type ObligationDetail,
  type TaskContextOwner
} from "../lib/taskModalContext";
import {
  canSendConfirmationInput,
  canSendTaskContextText,
  confirmCardMatches,
  gateTaskModalSend,
  taskActionsAllowed,
  taskDetailHref,
  taskModalTargetKey,
  type TaskModalContextPhase,
  type TaskModalLoad,
  type TaskModalTask
} from "../lib/taskModalView";
import { useVoice } from "../shell/VoiceContext";
import { StatusChip } from "./StatusChip";
import { useDialogKeyboard } from "./useDialogKeyboard";

export type TaskModalTarget =
  | {
      kind: "obligation";
      id: string;
      title: string;
      needs?: string | null;
      focusId?: string | null;
    }
  | {
      kind: "task";
      id: string;
      title: string;
      projectId?: string;
      focusId?: string | null;
      /** 打开时预填进上下文输入框的意图文本(任务卡动作带入;仍需用户点发送) */
      prefill?: string;
    }
  | {
      kind: "confirmation";
      receiptId: string;
      title: string;
      sessionId?: string;
      focusId?: string | null;
      packageId?: string;
      revision?: number;
      taskId?: string;
      digest?: string;
      confirmKind?: string;
    };

interface Props {
  target: TaskModalTarget;
  onClose: () => void;
  onDone?: () => void;
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--scrim)",
  zIndex: 80,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16
};

const panel: CSSProperties = {
  width: "min(520px, 100%)",
  maxHeight: "85vh",
  overflow: "auto",
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-modal)",
  padding: "var(--space-5)"
};

const btnPrimary: CSSProperties = {
  background: "var(--active-ink)",
  color: "var(--active-ink-fg)",
  border: "none",
  borderRadius: "var(--radius-xs)",
  height: 36,
  padding: "0 14px",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  cursor: "pointer"
};

const btnCommit: CSSProperties = {
  background: "var(--brand-seal)",
  color: "var(--brand-seal-fg)",
  border: "1px solid var(--brand-seal-border)",
  borderRadius: "var(--radius-xs)",
  height: 36,
  padding: "0 14px",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  cursor: "pointer"
};

const btnGhost: CSSProperties = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-xs)",
  height: 36,
  padding: "0 14px",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 40,
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-xs)",
  background: "var(--surface-control)",
  color: "var(--text-primary)",
  padding: "8px 10px",
  fontSize: "var(--text-sm)",
  resize: "vertical" as const
};

function modalType(
  target: TaskModalTarget,
  ob: ObligationDetail | null
): "decision" | "task" | "action" | "confirm" {
  if (target.kind === "confirmation") return "confirm";
  if (target.kind === "task") return "task";
  const needs = ob?.needs ?? target.needs;
  if (needs === "action") return "action";
  return "decision";
}

export function TaskModal({ target, onClose, onDone }: Props) {
  const voice = useVoice();
  const targetKey = taskModalTargetKey(target);
  const [nonce, setNonce] = useState<string | null>(null);
  const [nonceSessionId, setNonceSessionId] = useState<string | null>(null);
  const [ob, setOb] = useState<ObligationDetail | null>(null);
  const [task, setTask] = useState<TaskModalTask | null>(null);
  const [load, setLoad] = useState<TaskModalLoad>("loading");
  const [contextPhase, setContextPhase] = useState<TaskModalContextPhase>("idle");
  const [text, setText] = useState(target.kind === "task" ? (target.prefill ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState(targetKey);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const targetKeyRef = useRef(targetKey);
  const sessionIdRef = useRef(voice.sessionId);
  const nonceBindRef = useRef<{ sessionId: string; nonce: string; targetKey: string } | null>(null);
  const contextOwnerRef = useRef<TaskContextOwner | null>(null);
  const contextLifeRef = useRef(createTaskContextLifetime());
  targetKeyRef.current = targetKey;
  sessionIdRef.current = voice.sessionId;
  if (detailFor !== targetKey) {
    setDetailFor(targetKey);
    setLoad("loading");
    setOb(null);
    setTask(null);
    setNonce(null);
    setNonceSessionId(null);
    setContextPhase("idle");
    setErr(null);
    setText(target.kind === "task" ? (target.prefill ?? "") : "");
  }

  useEffect(() => {
    let cancelled = false;
    setLoad("loading");
    setErr(null);
    setOb(null);
    setTask(null);
    const run = async () => {
      if (target.kind === "confirmation") {
        if (!cancelled) setLoad("ready");
        return;
      }
      if (target.kind === "obligation") {
        if (!target.focusId) {
          if (!cancelled) {
            setLoad("missing");
            setErr("缺少这件事,无法核对这条安排");
          }
          return;
        }
        const result = await loadObligationDetail(target.focusId, target.id);
        if (cancelled || targetKeyRef.current !== taskModalTargetKey(target)) return;
        if (!result.ok) {
          setLoad(result.missing ? "missing" : "failed");
          setErr(result.message);
          return;
        }
        setOb(result.obligation);
        setLoad("ready");
        return;
      }
      const result = await loadTaskModalTask(target.id);
      if (cancelled || targetKeyRef.current !== taskModalTargetKey(target)) return;
      if (!result.ok) {
        setLoad(result.missing ? "missing" : "failed");
        setErr(result.message);
        return;
      }
      setTask(result.task);
      setLoad("ready");
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [target, targetKey]);

  const applyContextResult = (
    requestTargetKey: string,
    result: Awaited<ReturnType<typeof settleTaskContextResult>>
  ): void => {
    if (result.status === "stale") return;
    if (result.status === "failed") {
      setContextPhase("failed");
      setErr(result.message);
      return;
    }
    nonceBindRef.current = { sessionId: result.sessionId, nonce: result.nonce, targetKey: requestTargetKey };
    setNonce(result.nonce);
    setNonceSessionId(result.sessionId);
    setContextPhase("ready");
    setErr(null);
  };

  const beginContextAttempt = (requestTargetKey: string, requestSessionId: string): void => {
    if (target.kind === "confirmation") return;
    const refKind = target.kind;
    const refId = target.id;
    const owner = claimTaskContextOwner(requestSessionId, requestTargetKey);
    contextOwnerRef.current = owner;
    const gen = contextLifeRef.current.begin();
    setNonce(null);
    setNonceSessionId(null);
    nonceBindRef.current = null;
    setContextPhase("pending");
    void establishTaskContext({
      sessionId: requestSessionId,
      refKind,
      refId,
      requestTargetKey,
      liveTargetKey: () => targetKeyRef.current,
      liveSessionId: () => sessionIdRef.current,
      owner
    }).then(async (result) => {
      const settled = await settleTaskContextResult(contextLifeRef.current, gen, result);
      applyContextResult(requestTargetKey, settled);
    });
  };

  useEffect(() => {
    if (load !== "ready") return;
    if (target.kind === "confirmation") {
      setContextPhase("ready");
      return;
    }
    const requestTargetKey = targetKey;
    const requestSessionId = voice.sessionId;
    const life = contextLifeRef.current;
    life.reopen();
    beginContextAttempt(requestTargetKey, requestSessionId);
    return () => {
      life.invalidate();
      const bound = nonceBindRef.current;
      nonceBindRef.current = null;
      const owner = contextOwnerRef.current;
      void enqueueTaskContextCleanup(async () => {
        if (bound && bound.targetKey === requestTargetKey && bound.sessionId === requestSessionId) {
          await clearBoundTaskContext(bound.sessionId, bound.nonce);
        }
      });
      if (owner) {
        releaseTaskContextOwner(owner);
        contextOwnerRef.current = null;
      }
    };
  }, [target, targetKey, voice.sessionId, load]);

  const close = async () => {
    contextLifeRef.current.invalidate();
    const bound = nonceBindRef.current;
    nonceBindRef.current = null;
    const owner = contextOwnerRef.current;
    void enqueueTaskContextCleanup(async () => {
      if (bound) await clearBoundTaskContext(bound.sessionId, bound.nonce);
    });
    if (owner) {
      releaseTaskContextOwner(owner);
      contextOwnerRef.current = null;
    }
    onClose();
  };

  useDialogKeyboard(panelRef, { onClose: () => void close() });

  const finish = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await close();
      onDone?.();
    } catch (e) {
      setErr(apiErrorMessage(e));
      setBusy(false);
    }
  };

  const contextReady =
    target.kind === "confirmation"
      ? canSendConfirmationInput({
          card: voice.confirmCard,
          targetReceiptId: target.receiptId,
          targetSessionId: target.sessionId,
          liveSessionId: voice.sessionId
        })
      : canSendTaskContextText({
          nonce,
          text: "x",
          nonceSessionId,
          liveSessionId: voice.sessionId
        });
  const retryContext = (): void => {
    if (target.kind === "confirmation") return;
    setErr(null);
    contextLifeRef.current.reopen();
    beginContextAttempt(targetKey, sessionIdRef.current);
  };
  const sendInContext = async (payload: string): Promise<boolean> => {
    const result = await gateTaskModalSend({
      kind: target.kind,
      text: payload,
      card: voice.confirmCard,
      targetReceiptId: target.kind === "confirmation" ? target.receiptId : undefined,
      targetSessionId: target.kind === "confirmation" ? target.sessionId : undefined,
      liveSessionId: sessionIdRef.current,
      nonce,
      nonceSessionId,
      sendText: voice.sendText
    });
    if (result.reason) setErr(result.reason);
    return result.sent;
  };

  const type = modalType(target, ob);
  const title =
    target.kind === "confirmation"
      ? target.title
      : target.kind === "task"
        ? (task?.title ?? target.title)
        : (ob?.title ?? target.title);
  const actions = task ? taskActionsAllowed(task.viewStatus) : { cancel: false, steer: false };
  const cardMatches =
    target.kind === "confirmation" &&
    confirmCardMatches(voice.confirmCard, target.receiptId, {
      packageId: target.packageId,
      revision: target.revision,
      taskId: target.taskId,
      kind: target.confirmKind,
      digest: target.digest
    });

  let body: ReactNode = null;
  if (load === "loading") {
    body = (
      <p role="status" aria-busy="true" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>
        正在加载…
      </p>
    );
  } else if (load === "missing") {
    body = (
      <p role="status" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>
        {err ?? "找不到这条记录"}
      </p>
    );
  } else if (load === "failed") {
    body = (
      <p role="alert" style={{ fontSize: "var(--text-sm)", color: "var(--color-error)", margin: 0 }}>
        {err ?? "加载失败"}
      </p>
    );
  } else if (type === "confirm" || type === "decision") {
    body = (
      <>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          {type === "confirm"
            ? "待确认"
            : ob?.needs === "decision"
              ? "需要你拍板"
              : ob?.needs === "input"
                ? "需要你补充信息"
                : "需要你配合"}
        </div>
        {ob?.detail ? (
          <p style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-3)", whiteSpace: "pre-wrap" }}>{ob.detail}</p>
        ) : null}
        {type === "confirm" && cardMatches ? (
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <button
              type="button"
              style={btnCommit}
              disabled={busy}
              onClick={() => void finish(async () => voice.sendConfirmClick("accept"))}
            >
              做
            </button>
            <button
              type="button"
              style={btnGhost}
              disabled={busy}
              onClick={() => void finish(async () => voice.sendConfirmClick("reject"))}
            >
              不要
            </button>
          </div>
        ) : null}
        {type === "confirm" && !cardMatches ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
            {voice.confirmCard
              ? "当前确认卡不是这张,请到对话里处理对应卡片"
              : "这张确认卡现在不在对话里,不能在这里操作"}
          </p>
        ) : null}
        <label style={{ fontSize: "var(--text-sm)", display: "block", marginBottom: 6 }}>在这件事里说</label>
        <textarea
          style={inputStyle}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="直接说你的决定或补充…"
          rows={3}
        />
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
          <button
            type="button"
            style={btnPrimary}
            disabled={busy || !text.trim() || !contextReady}
            onClick={() => {
              void sendInContext(text).then((sent) => {
                if (!sent) return;
                void close().then(() => onDone?.());
              });
            }}
          >
            发送
          </button>
          {ob ? (
            <button
              type="button"
              style={btnGhost}
              disabled={busy}
              onClick={() =>
                void finish(async () => {
                  await apiPost(`/api/obligations/${encodeURIComponent(ob.id)}/resolve`, {
                    resolution: "done"
                  });
                })
              }
            >
              办结
            </button>
          ) : null}
        </div>
      </>
    );
  } else if (type === "task") {
    body = (
      <>
        <div
          data-task-modal-status={task?.viewStatus ?? ""}
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}
        >
          {task ? <StatusChip status={task.viewStatus} /> : (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>状态未知</span>
          )}
          {task ? (
            <a
              data-task-detail-link
              href={taskDetailHref(task)}
              style={{ fontSize: "var(--text-sm)", color: "var(--active-ink)" }}
            >
              打开任务详情
            </a>
          ) : null}
        </div>
        {actions.cancel ? (
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <button
              type="button"
              style={btnGhost}
              disabled={busy || !task}
              onClick={() => {
                if (!task) return;
                if (!window.confirm("叫停这个任务?")) return;
                void finish(async () => {
                  await api.cancelTask(task.id);
                });
              }}
            >
              叫停
            </button>
          </div>
        ) : null}
        {actions.steer ? (
          <>
            <label style={{ fontSize: "var(--text-sm)", display: "block", marginBottom: 6 }}>追加指示</label>
            <textarea
              style={inputStyle}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="给正在跑的任务追加说明…"
              rows={3}
            />
            <div style={{ marginTop: "var(--space-3)" }}>
              <button
                type="button"
                style={btnPrimary}
                disabled={
                  busy ||
                  !canSendTaskContextText({
                    nonce,
                    text,
                    nonceSessionId,
                    liveSessionId: voice.sessionId
                  })
                }
                title="steer 经语音通道进对话;任务级 steer API 若未挂 console 写口则走对话"
                onClick={() => {
                  const payload = `对任务「${task?.title ?? target.title}」追加指示:${text.trim()}`;
                  void sendInContext(payload).then((sent) => {
                    if (!sent) return;
                    void close().then(() => onDone?.());
                  });
                }}
              >
                发送指示
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>
            叫停、重试或合并请到任务详情。验收与合并是两步,这里不代做。
          </p>
        )}
      </>
    );
  } else {
    body = (
      <>
        {ob?.detail ? (
          <p style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-2)", whiteSpace: "pre-wrap" }}>{ob.detail}</p>
        ) : null}
        {ob?.nextStep ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
            怎么开始:{ob.nextStep}
          </p>
        ) : (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
            这件事要你亲自启动;做完后点办结。
          </p>
        )}
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button
            type="button"
            style={btnCommit}
            disabled={busy || !ob}
            onClick={() => {
              if (!ob) return;
              void finish(async () => {
                await apiPost(`/api/obligations/${encodeURIComponent(ob.id)}/resolve`, {
                  resolution: "done"
                });
              });
            }}
          >
            我做完了,办结
          </button>
          <button
            type="button"
            style={btnGhost}
            disabled={busy || !ob}
            onClick={() => {
              if (!ob) return;
              void finish(async () => {
                await apiPost(`/api/obligations/${encodeURIComponent(ob.id)}/resolve`, {
                  resolution: "abandoned"
                });
              });
            }}
          >
            不做了
          </button>
        </div>
      </>
    );
  }

  return (
    <div
      style={overlay}
      data-component="task-modal"
      data-task-modal-load={load}
      data-task-modal-context={contextPhase}
      data-task-modal-status={task?.viewStatus ?? ""}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div style={panel} ref={panelRef} tabIndex={-1}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
          <h2 id="task-modal-title" style={{ fontSize: "var(--text-md)", fontWeight: 600, margin: 0, lineHeight: "var(--leading-tight)" }}>{title}</h2>
          <button type="button" style={{ ...btnGhost, height: 28, padding: "0 8px" }} onClick={() => void close()} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        {err && load === "ready" ? (
          <div role="alert" style={{ color: "var(--color-error)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span>{err}</span>
            {contextPhase === "failed" && target.kind !== "confirmation" ? (
              <button type="button" data-task-context-retry style={{ ...btnGhost, height: 28 }} onClick={retryContext}>
                再接一次对话
              </button>
            ) : null}
          </div>
        ) : null}
        <div style={{ marginTop: "var(--space-4)" }}>{body}</div>
      </div>
    </div>
  );
}
