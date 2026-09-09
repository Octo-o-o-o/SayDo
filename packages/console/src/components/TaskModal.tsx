// 任务详情弹窗三型(批 3):拍板 / 在办 / 启动。
// 打开时 POST task-context,关闭 DELETE;完成动作后关弹窗并回调 onDone 刷新看板。

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { api, apiDelete, apiGet, apiPost } from "../lib/api";
import { useVoice } from "../shell/VoiceContext";
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
    }
  | {
      kind: "confirmation";
      receiptId: string;
      title: string;
      sessionId?: string;
      focusId?: string | null;
    };

interface Props {
  target: TaskModalTarget;
  onClose: () => void;
  onDone?: () => void;
}

interface ObligationDetail {
  id: string;
  title: string;
  detail: string | null;
  needs: string | null;
  status: string;
  nextStep: string | null;
  owner: string;
  kind: string;
}

interface TaskDetailRow {
  id: string;
  title: string;
  status: string;
  viewStatus?: string;
  projectId?: string;
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
  // L2(义骁 8/6 实测"弹窗跟背景一样暗"):原 --bg-elevated/--glass-bg 两变量均未定义 ⇒ 面板全透明,
  // 只剩黑遮罩。改用 tokens 真实存在的 --bg-app(不透明)+强玻璃面兜底
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-modal)",
  padding: 20
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

/* 承诺型动作(盖章语义,11 §2.7):确认卡「做」与义务「办结」等终局按钮 */
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
): "decision" | "running" | "action" | "confirm" {
  if (target.kind === "confirmation") return "confirm";
  if (target.kind === "task") return "running";
  const needs = ob?.needs ?? target.needs;
  if (needs === "decision" || needs === "input" || needs === "unknown") return "decision";
  if (needs === "action") return "action";
  return "decision";
}

export function TaskModal({ target, onClose, onDone }: Props) {
  const voice = useVoice();
  const [nonce, setNonce] = useState<string | null>(null);
  const [ob, setOb] = useState<ObligationDetail | null>(null);
  const [task, setTask] = useState<TaskDetailRow | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // 打开:设 task-context + 拉详情
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (target.kind === "obligation") {
          // 从 focus detail 批量不够,用 attention 已有字段 + resolve API 不需全量;
          // 拉 focus 详情代价高:改为 obligation 信息随 target 够用时补 GET focus 搜索
          // 最小:用 POST resolve 前本地态;这里 GET attention 不够 detail —— 走 focus list 不合适
          // 直接用 target 字段 + 可选 focus detail 拉取(若 focusId 有)
          if (target.focusId) {
            const d = await apiGet<{
              obligations: ObligationDetail[];
            }>(`/api/focuses/${encodeURIComponent(target.focusId)}`);
            if (cancelled) return;
            const found = d.obligations.find((o) => o.id === target.id);
            if (found) setOb(found);
            else
              setOb({
                id: target.id,
                title: target.title,
                detail: null,
                needs: target.needs ?? null,
                status: "open",
                nextStep: null,
                owner: "human",
                kind: "action"
              });
          } else {
            setOb({
              id: target.id,
              title: target.title,
              detail: null,
              needs: target.needs ?? null,
              status: "open",
              nextStep: null,
              owner: "human",
              kind: "action"
            });
          }
          const ctx = await apiPost<{ ok: true; nonce: string }>(
            `/api/session/${encodeURIComponent(voice.sessionId)}/task-context`,
            { refKind: "obligation", refId: target.id }
          );
          if (!cancelled) setNonce(ctx.nonce);
        } else if (target.kind === "task") {
          const t = await apiGet<TaskDetailRow | null>(`/api/tasks/${encodeURIComponent(target.id)}`);
          if (!cancelled && t) setTask(t);
          const ctx = await apiPost<{ ok: true; nonce: string }>(
            `/api/session/${encodeURIComponent(voice.sessionId)}/task-context`,
            { refKind: "task", refId: target.id }
          );
          if (!cancelled) setNonce(ctx.nonce);
        }
        // confirmation:不写 task-context(无 ref 实体)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [target, voice.sessionId]);

  const close = async () => {
    if (nonce) {
      try {
        await apiDelete(`/api/session/${encodeURIComponent(voice.sessionId)}/task-context`, { nonce });
      } catch {
        // 关闭不因 clear 失败卡住
      }
    }
    onClose();
  };

  // 11 §9 弹窗键盘合同:Escape 等同「关闭」(同样清 task-context),Tab 环内循环,关闭后焦点回触发控件
  useDialogKeyboard(panelRef, { onClose: () => void close() });

  const finish = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await close();
      onDone?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const type = modalType(target, ob);
  const title =
    target.kind === "confirmation"
      ? target.title
      : target.kind === "task"
        ? (task?.title ?? target.title)
        : (ob?.title ?? target.title);

  let body: ReactNode = null;
  if (type === "confirm" || type === "decision") {
    body = (
      <>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 12 }}>
          {type === "confirm"
            ? "待确认"
            : ob?.needs === "decision"
              ? "需要你拍板"
              : ob?.needs === "input"
                ? "需要你补充信息"
                : "需要你配合"}
        </div>
        {ob?.detail ? (
          <p style={{ fontSize: "var(--text-sm)", marginBottom: 12, whiteSpace: "pre-wrap" }}>{ob.detail}</p>
        ) : null}
        {type === "confirm" && voice.confirmCard ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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
        <label style={{ fontSize: "var(--text-sm)", display: "block", marginBottom: 6 }}>在这件事里说</label>
        <textarea
          style={inputStyle}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="直接说你的决定或补充…"
          rows={3}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            style={btnPrimary}
            disabled={busy || !text.trim()}
            onClick={() =>
              void finish(async () => {
                voice.sendText(text.trim());
              })
            }
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
  } else if (type === "running") {
    body = (
      <>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 8 }}>
          状态:{task?.viewStatus ?? task?.status ?? "进行中"}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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
        <label style={{ fontSize: "var(--text-sm)", display: "block", marginBottom: 6 }}>追加指示</label>
        <textarea
          style={inputStyle}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="给正在跑的任务追加说明…"
          rows={3}
        />
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            style={btnPrimary}
            disabled={busy || !text.trim()}
            title="steer 经语音通道进对话;任务级 steer API 若未挂 console 写口则走对话"
            onClick={() =>
              void finish(async () => {
                // 无独立 steer REST 写口时,走对话让 Brain 调 steerTask
                voice.sendText(`对任务「${task?.title ?? target.title}」追加指示:${text.trim()}`);
              })
            }
          >
            发送指示
          </button>
        </div>
      </>
    );
  } else {
    // action 启动型
    body = (
      <>
        {ob?.detail ? (
          <p style={{ fontSize: "var(--text-sm)", marginBottom: 8, whiteSpace: "pre-wrap" }}>{ob.detail}</p>
        ) : null}
        {ob?.nextStep ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 12 }}>
            怎么开始:{ob.nextStep}
          </p>
        ) : (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 12 }}>
            这件事要你亲自启动;做完后点办结。
          </p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={btnCommit}
            disabled={busy || !ob}
            onClick={() => {
              if (!ob) return;
              // K7:去原生 confirm——与拍板型「办结」一致(零确认+账本可逆),不再弹浏览器对话框
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
    <div style={overlay} data-component="task-modal" role="dialog" aria-modal="true">
      <div style={panel} ref={panelRef} tabIndex={-1}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <h2 style={{ fontSize: "var(--text-md)", fontWeight: 600, margin: 0 }}>{title}</h2>
          <button type="button" style={{ ...btnGhost, height: 28, padding: "0 8px" }} onClick={() => void close()} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        {err ? (
          <div style={{ color: "var(--color-error)", fontSize: "var(--text-sm)", marginTop: 8 }}>{err}</div>
        ) : null}
        <div style={{ marginTop: 16 }}>{body}</div>
      </div>
    </div>
  );
}
