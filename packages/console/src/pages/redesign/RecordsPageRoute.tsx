// 记录页接线容器:hook → RecordsPage;生命周期写口 + DAILY-01 全部接线:
// fork / lane create·unretire / 依赖增设(义务级+任务级)·解除 / redo-from 两步弹窗
// (anchor 选事件 → preview 建议集 → exact set 确认;不自动并建议集,关系变化后旧 preview 作废重取)。

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { RecordsPage } from "./RecordsPage";
import type { PageNavTarget } from "./nav";
import { useRecordsPageData } from "../../hooks/redesign/useRecordsPageData";
import { pageNavToHash } from "../../hooks/redesign/navMap";
import { navigate } from "../../lib/router";
import { ErrorCard } from "../../components/ui";
import { apiPost } from "../../lib/api";
import { buildPendingAnchor, resolveLaneTitle, writePendingAnchor } from "../../lib/pendingAnchor";

import { useVoice } from "../../shell/VoiceContext";
import type { RecordsAction } from "../../components/redesign";
import { Btn } from "../../components/redesign";

const toastStyle: CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 90,
  padding: "10px 16px",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  maxWidth: 420
};

const modalMask: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 95,
  background: "var(--scrim)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 24
};
const modalCard: CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)", padding: "var(--space-4) var(--space-5)",
  width: "min(620px, 96vw)", maxHeight: "86vh", overflowY: "auto",
  boxShadow: "var(--shadow-card-hover)"
};
const selStyle: CSSProperties = {
  background: "var(--surface-control)", border: "1px solid var(--line)",
  borderRadius: "var(--radius-xs)", padding: "6px 8px",
  fontSize: "var(--text-sm)", color: "var(--text-primary)", width: "100%"
};

interface RedoPreview {
  suggested: { id: string; title: string; created_from_event: number }[];
  unknownOrigin: { id: string; title: string }[];
}

interface RedoState {
  laneId: string;
  anchorSeq: number | null;
  preview: RedoPreview | null;
  picked: Set<string>;
  busy: boolean;
}

export function RecordsPageRoute({ focusId }: { focusId: string }) {
  // L2:当前会话 id 注入数据层——活跃会话段显示「进行中」而非「中断」
  const voice = useVoice();
  const { view, loading, error, reload, onExpandSegment } = useRecordsPageData(focusId, voice.sessionId);
  const [toast, setToast] = useState<string | null>(null);
  const [redo, setRedo] = useState<RedoState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onNavigate = useCallback((target: PageNavTarget) => {
    navigate(pageNavToHash(target));
  }, []);

  const run = useCallback(
    (fn: () => Promise<unknown>, okMsg?: string): void => {
      void fn().then(
        () => {
          if (okMsg) setToast(okMsg);
          reload();
        },
        (err: unknown) => setToast(String(err instanceof Error ? err.message : err))
      );
    },
    [reload]
  );

  /** redo 第一步:拿建议集(anchorSeq 变化后旧 preview 作废重取) */
  const redoFetchPreview = useCallback(
    (laneId: string, anchorSeq: number) => {
      setRedo((prev) => (prev ? { ...prev, laneId, anchorSeq, preview: null, picked: new Set(), busy: true } : prev));
      void apiPost<RedoPreview & { preview?: boolean }>(
        `/api/focuses/${encodeURIComponent(focusId)}/lanes/${encodeURIComponent(laneId)}/redo-from`,
        { anchorSeq }
      ).then(
        (r) =>
          setRedo((prev) =>
            prev && prev.laneId === laneId && prev.anchorSeq === anchorSeq
              ? {
                  ...prev,
                  busy: false,
                  preview: { suggested: r.suggested ?? [], unknownOrigin: r.unknownOrigin ?? [] },
                  // 建议集默认勾选(可逐项取消);unknownOrigin 不预勾——来源不明由人决定
                  picked: new Set((r.suggested ?? []).map((s) => s.id))
                }
              : prev
          ),
        (err: unknown) => {
          setRedo(null);
          setToast(String(err instanceof Error ? err.message : err));
        }
      );
    },
    [focusId]
  );

  const openRedo = useCallback(
    (laneId: string, anchorSeq?: number) => {
      const laneEvents = (view?.events ?? []).filter((e) => e.laneId === laneId);
      const anchor = anchorSeq ?? (laneEvents.length ? Math.min(...laneEvents.map((e) => e.seq)) : 0);
      setRedo({ laneId, anchorSeq: anchor, preview: null, picked: new Set(), busy: false });
      redoFetchPreview(laneId, anchor);
    },
    [view?.events, redoFetchPreview]
  );

  const redoConfirm = useCallback(() => {
    if (!redo || redo.anchorSeq === null || !redo.preview) return;
    const { laneId, anchorSeq, picked } = redo;
    setRedo(null);
    run(
      () =>
        apiPost(`/api/focuses/${encodeURIComponent(focusId)}/lanes/${encodeURIComponent(laneId)}/redo-from`, {
          anchorSeq,
          supersededIds: [...picked]
        }),
      `已从 #${anchorSeq} 重走,${picked.size} 条义务转 superseded`
    );
  }, [redo, focusId, run]);

  const onAction = useCallback(
    (action: RecordsAction) => {
      switch (action.type) {
        case "archive": {
          const reason = window.prompt("归档理由(必填;有在途任务会被拒绝,先停任务再归档)");
          if (!reason?.trim()) {
            setToast("归档需要理由");
            return;
          }
          run(
            () => apiPost(`/api/focuses/${encodeURIComponent(focusId)}/archive`, { reason: reason.trim() }),
            "已归档"
          );
          return;
        }
        case "abandon": {
          const reason = window.prompt("放弃理由(必填)");
          if (!reason?.trim()) {
            setToast("放弃需要理由");
            return;
          }
          run(
            () => apiPost(`/api/focuses/${encodeURIComponent(focusId)}/abandon`, { reason: reason.trim() }),
            "已放弃"
          );
          return;
        }
        case "reopen":
          run(() => apiPost(`/api/focuses/${encodeURIComponent(focusId)}/reopen`, {}), "已重开(不自动续跑)");
          return;
        case "fork": {
          const direction = window.prompt("新分支的方向(可空,回车直接分叉)");
          if (direction === null) return;
          void apiPost<{ id: string; title: string }>(
            `/api/focuses/${encodeURIComponent(focusId)}/fork`,
            direction.trim() ? { direction: direction.trim() } : {}
          ).then(
            (r) => {
              setToast(`已分叉:「${r.title}」`);
              navigate(`/focus/${encodeURIComponent(r.id)}`);
            },
            (err: unknown) => setToast(String(err instanceof Error ? err.message : err))
          );
          return;
        }
        case "lane_create": {
          const title = window.prompt("新支线标题(必填)");
          if (!title?.trim()) return;
          run(
            () => apiPost(`/api/focuses/${encodeURIComponent(focusId)}/lanes`, { title: title.trim() }),
            "已开新支线"
          );
          return;
        }
        case "lane_op":
          if (action.op === "retire") {
            run(
              () =>
                apiPost(
                  `/api/focuses/${encodeURIComponent(focusId)}/lanes/${encodeURIComponent(action.laneId)}/retire`,
                  {}
                ),
              "已收线"
            );
            return;
          }
          if (action.op === "unretire") {
            run(
              () =>
                apiPost(
                  `/api/focuses/${encodeURIComponent(focusId)}/lanes/${encodeURIComponent(action.laneId)}/unretire`,
                  {}
                ),
              "已恢复线(不复活 superseded 义务)"
            );
            return;
          }
          if (action.op === "redo") {
            openRedo(action.laneId, action.anchorSeq);
            return;
          }
          writePendingAnchor(
            sessionStorage,
            buildPendingAnchor({
              focusId,
              title: view?.focus.title,
              laneTitle: resolveLaneTitle(view?.lanes ?? [], action.laneId)
            })
          );
          navigate("/chat-new");
          return;
        case "dependency_undo": {
          const target = view?.obligations.find((o) => o.id === action.obligationId);
          if (!window.confirm(`解除「${target?.title ?? action.obligationId}」的等待依赖?解除不派发、不续跑。`)) return;
          run(
            () => apiPost(`/api/obligations/${encodeURIComponent(action.obligationId)}/waiting-on`, { preId: null }),
            "已解除依赖"
          );
          return;
        }
        case "dependency_add": {
          const req = action.req;
          run(
            () =>
              apiPost(`/api/obligations/${encodeURIComponent(req.obligationId)}/waiting-on`,
                req.kind === "task"
                  ? { taskId: req.taskId, condition: req.condition }
                  : { preId: req.preId }
              ),
            "依赖已设定"
          );
          return;
        }
        case "redo_preview": {
          const first = view?.lanes.find((l) => !l.retired && l.id !== "__main__") ?? view?.lanes.find((l) => l.id !== "__main__");
          if (!first) {
            setToast("这条 Focus 还没有支线账本——先「新建支线」再从锚点重走");
            return;
          }
          openRedo(first.id);
          return;
        }
        case "back":
          return;
        default:
          setToast("未识别的记录页动作");
      }
    },
    [focusId, run, view?.focus.title, view?.obligations, view?.lanes, openRedo]
  );

  if (error) return <ErrorCard message="记录页加载失败" detail={error} />;
  if (loading || !view) return null;

  const redoLaneEvents = redo ? view.events.filter((e) => e.laneId === redo.laneId || (!e.laneId && redo.laneId === "__main__")) : [];

  return (
    <>
      <RecordsPage
        view={view}
        onNavigate={onNavigate}
        onAction={onAction}
        onExpandSegment={onExpandSegment}
      />
      {toast ? (
        <div role="status" data-toast style={toastStyle}>
          {toast}
        </div>
      ) : null}
      {redo ? (
        <div style={modalMask} role="presentation" onClick={() => setRedo(null)} data-redo-modal>
          <div style={modalCard} role="dialog" aria-label="从此步重走" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-3)" }}>
              从此步重走 · {view.lanes.find((l) => l.id === redo.laneId)?.title ?? redo.laneId}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
              锚点之前的事件原样保留(不改历史字节);勾选要重走的义务会转 superseded。redo_from 只作废精确集合,不另起草稿、不恢复文件系统。
              不做 Git 回滚、不恢复文件系统、不继承审批与人决。
            </div>
            <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>
              支线
            </label>
            <select
              style={{ ...selStyle, marginBottom: "var(--space-3)" }}
              value={redo.laneId}
              data-redo-lane
              onChange={(e) => {
                const laneId = e.target.value;
                const evs = view.events.filter((x) => x.laneId === laneId);
                const anchor = evs.length ? Math.min(...evs.map((x) => x.seq)) : 0;
                redoFetchPreview(laneId, anchor);
              }}
            >
              {view.lanes.filter((l) => l.id !== "__main__").map((l) => (
                <option key={l.id} value={l.id}>{l.title}{l.retired ? "(已收)" : ""}</option>
              ))}
            </select>
            <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>
              锚点事件(此前原样保留)
            </label>
            <select
              style={{ ...selStyle, marginBottom: "var(--space-3)" }}
              value={redo.anchorSeq ?? 0}
              data-redo-anchor
              onChange={(e) => redoFetchPreview(redo.laneId, Number(e.target.value))}
            >
              {redoLaneEvents.length ? (
                redoLaneEvents
                  .slice()
                  .sort((a, b) => a.seq - b.seq)
                  .map((e) => (
                    <option key={e.seq} value={e.seq}>#{e.seq} {e.type} — {e.text.slice(0, 40)}</option>
                  ))
              ) : (
                <option value={0}>#0 线头(无更早事件)</option>
              )}
            </select>

            {redo.busy ? (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>正在取建议集…</div>
            ) : redo.preview ? (
              <>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "var(--space-2) 0 4px" }}>
                  锚点后新建的未结义务(建议集,可取消勾选):
                </div>
                {redo.preview.suggested.length === 0 ? (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>锚点后没有新建义务。</div>
                ) : (
                  redo.preview.suggested.map((s) => (
                    <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--text-sm)", padding: "4px 0" }} data-redo-suggested={s.id}>
                      <input
                        type="checkbox"
                        checked={redo.picked.has(s.id)}
                        onChange={() =>
                          setRedo((prev) => {
                            if (!prev) return prev;
                            const next = new Set(prev.picked);
                            if (next.has(s.id)) next.delete(s.id);
                            else next.add(s.id);
                            return { ...prev, picked: next };
                          })
                        }
                      />
                      {s.title}
                    </label>
                  ))
                )}
                {redo.preview.unknownOrigin.length > 0 ? (
                  <>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-warning)", margin: "var(--space-2) 0 4px" }}>
                      来源不明的未结义务(created_from_event 为空,不预勾):
                    </div>
                    {redo.preview.unknownOrigin.map((s) => (
                      <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--text-sm)", padding: "4px 0" }} data-redo-unknown={s.id}>
                        <input
                          type="checkbox"
                          checked={redo.picked.has(s.id)}
                          onChange={() =>
                            setRedo((prev) => {
                              if (!prev) return prev;
                              const next = new Set(prev.picked);
                              if (next.has(s.id)) next.delete(s.id);
                              else next.add(s.id);
                              return { ...prev, picked: next };
                            })
                          }
                        />
                        {s.title}
                      </label>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}

            <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", marginTop: "var(--space-4)" }}>
              <Btn onClick={() => setRedo(null)}>取消</Btn>
              <Btn variant="primary" disabled={!redo.preview || redo.busy} onClick={redoConfirm}>
                确认重走({redo.picked.size} 条转 superseded)
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
