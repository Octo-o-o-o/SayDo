import { sessionStoragePort } from "../../lib/sessionStoragePort";
// Focus 对话页接线容器:hook → FocusPage + onNavigate/onAction + composerSlot。
// 语音 composer:P0 降级为「在这件事里开口」入口按钮(VoiceContext 无 primary_focus 可读,
// 完整 composer 挂载需 live 锚定检测——见文件尾 TODO)。

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { FocusPage, type FocusPageAction } from "./FocusPage";
import type { PageNavTarget } from "./nav";
import { useFocusPageData } from "../../hooks/redesign/useFocusPageData";
import { pageNavToHash } from "../../hooks/redesign/navMap";
import { navigate } from "../../lib/router";
import { ErrorCard } from "../../components/ui";
import { TaskModal, type TaskModalTarget } from "../../components/TaskModal";
import { apiPost } from "../../lib/api";
import { loadTaskModalTask } from "../../lib/taskModalContext";
import { buildPendingAnchor, writePendingAnchor } from "../../lib/pendingAnchor";
import { confirmCardMatches } from "../../lib/taskModalView";
import { useVoice } from "../../shell/VoiceContext";
import {
  expectationChatDraft,
  pkgChatDraft,
  resolveFocusLocate,
  deliverInterviewPick,
  resolvePkgApprove
} from "./focusEntryActions";

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
  maxWidth: 420,
  boxShadow: "var(--shadow-card-hover)"
};

const entryBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: 44,
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: "var(--active-ink)",
  color: "var(--active-ink-fg)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  cursor: "pointer"
};

const olderBtn: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-xs)",
  padding: "6px 14px",
  fontSize: "var(--text-xs)",
  color: "var(--text-muted)",
  cursor: "pointer"
};

export function FocusPageRoute({ focusId, initialTab }: { focusId: string; initialTab?: string }) {
  // L2:当前会话 id 注入数据层——活跃会话段显示「进行中」而非「中断」
  const voice = useVoice();
  const { view, loading, error, reload, loadOlder, hasOlder, olderError, onExpandSegment } = useFocusPageData(
    focusId,
    voice.sessionId,
    voice.confirmCard,
    voice.spoken,
    voice.interviewAnchor,
    voice.interviewRounds
  );
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<TaskModalTarget | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onNavigate = useCallback((target: PageNavTarget) => {
    navigate(pageNavToHash(target));
  }, []);

  const enterChatWithFocus = useCallback(
    (draft?: string) => {
      if (!writePendingAnchor(
        sessionStoragePort,
        buildPendingAnchor({ focusId, title: view?.focus.title, draft })
      )) { setToast("草稿保存失败，请重试后接上主题"); return; }
      navigate("/chat-new");
    },
    [focusId, view?.focus.title]
  );

  const onAction = useCallback(
    (action: FocusPageAction) => {
      switch (action.type) {
        case "task": {
          const tid = action.taskId;
          const a = action.action;
          const tv = view?.lookups?.tasks?.[tid] ?? view?.rail.tasks.find((t) => t.id === tid);
          const taskFocusId = tv?.focusId ?? focusId;
          // 冲突/解释/重新合并的真实面在任务详情(verify-merge、explain 写口都在那);
          // projectId 先按 /api/tasks/:id 读真值,读不到回落验收页(各自如实报错)
          const openTaskDetail = () => {
            void loadTaskModalTask(tid).then((r) => {
              const pid = r.ok ? r.task.projectId : undefined;
              navigate(
                pid
                  ? `/p/${encodeURIComponent(pid)}/task/${encodeURIComponent(tid)}`
                  : `/review/${encodeURIComponent(tid)}`
              );
            });
          };
          if (a.type === "reload_detail") { reload(); return; }
          if (a.type === "open_detail") { openTaskDetail(); return; }
          if (tv?.detailUnavailable) {
            setToast("任务详情未加载，请先重读详情；不会在缺数据时写入");
            return;
          }
          if (a.type === "review" || a.type === "s3_merge") {
            navigate(`/review/${encodeURIComponent(tid)}`);
            return;
          }
          if (a.type === "merge_conflict" || a.type === "explain") {
            openTaskDetail();
            return;
          }
          if (a.type === "open_focus") {
            navigate(`/focus/${encodeURIComponent(taskFocusId)}`);
            return;
          }
          if (a.type === "retry") {
            if (tv?.viewStatus === "merge_failed") {
              // 「我手改了,重新合并」= verify-merge,操作面在任务详情;不在此调 retry
              openTaskDetail();
              return;
            }
            if (!window.confirm("重派这个任务?会重新过门禁。")) return;
            void apiPost<{ ok: true; attempt: number }>(
              `/api/tasks/${encodeURIComponent(tid)}/retry`,
              {}
            ).then(
              () => {
                setToast("已重派,重新过门禁");
                reload();
              },
              (err: unknown) => setToast(String(err instanceof Error ? err.message : err))
            );
            return;
          }
          if (a.type === "step_ok" || a.type === "billing") {
            const card = voice.confirmCard;
            if (
              card &&
              view?.sessionOwned &&
              confirmCardMatches(card, card.receiptId, {
                kind: "runtime_effect",
                taskId: tid,
                digest: card.digest
              })
            ) {
              setModal({
                kind: "confirmation",
                receiptId: card.receiptId,
                title: card.text,
                sessionId: voice.sessionId,
                focusId,
                taskId: tid,
                digest: card.digest,
                confirmKind: card.kind
              });
              return;
            }
            setToast("当前确认卡对不上这个任务,不能在这里拍板");
            return;
          }
          setModal({
            kind: "task",
            id: tid,
            title: tv?.title ?? tid,
            focusId: taskFocusId,
            prefill:
              a.type === "answer" ? a.text : a.type === "step_no" ? "这步不对:" : undefined
          });
          return;
        }
        case "locate": {
          const resolved = resolveFocusLocate(action.target, view);
          if (resolved.kind === "open_obligation" || resolved.kind === "open_task") {
            setModal(resolved.target);
            return;
          }
          if (resolved.kind === "missing" || resolved.kind === "no_locate") {
            setToast(resolved.message);
            return;
          }
          const el = document.querySelector(resolved.selector);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          else setToast("页面里暂时看不到对应位置,不会随便跳走");
          return;
        }
        case "pkg": {
          const pkg =
            (action.revision !== undefined
              ? view?.lookups?.packages?.[`${action.packageId}@${action.revision}`]
              : undefined) ?? view?.lookups?.packages?.[action.packageId];
          if (action.action === "approve") {
            const decided = resolvePkgApprove({
              packageId: action.packageId,
              revision: action.revision ?? pkg?.revision,
              pkg: pkg ? { id: pkg.id, revision: pkg.revision, outcomePreview: pkg.outcomePreview } : undefined,
              card: voice.confirmCard,
              sessionOwned: Boolean(view?.sessionOwned),
              sessionId: voice.sessionId,
              focusId
            });
            if (decided.kind === "open_confirm") {
              setModal(decided.target);
              return;
            }
            setToast(decided.message);
            return;
          }
          enterChatWithFocus(pkgChatDraft(action.action, pkg?.outcomePreview, action.payload));
          return;
        }
        case "standby":
          setToast("模拟叫醒是排障动作,现役不从页面触发");
          return;
        case "interview_pick": {
          const card = view?.interview;
          void deliverInterviewPick(
            {
              option: action.option,
              question: card?.question,
              sessionOwned: Boolean(view?.sessionOwned),
              sessionId: voice.sessionId,
              pageFocusId: focusId,
              turnId: card?.turnId,
              focusId: card?.focusId,
              anchorRequestId: card?.anchorRequestId,
              anchorGeneration: card?.anchorGeneration,
              committed: voice.interviewAnchor,
              spoken: voice.spoken,
              rounds: voice.interviewRounds
            },
            voice.sendText
          ).then(
            (result) => {
              if (result.kind === "sent") reload();
              else setToast(result.message);
            },
            (err: unknown) => setToast(String(err instanceof Error ? err.message : err))
          );
          return;
        }
        case "expect":
        case "expectation_edit":
          enterChatWithFocus(expectationChatDraft(view?.focus.title ?? "", action, view?.expectations?.[0]));
          return;
        case "dep_add": {
          const req = action.req;
          void apiPost(
            `/api/obligations/${encodeURIComponent(req.obligationId)}/waiting-on`,
            req.kind === "task" ? { taskId: req.taskId, condition: req.condition } : { preId: req.preId }
          ).then(
            () => {
              setToast("依赖已设定");
              reload();
            },
            (err: unknown) => setToast(String(err instanceof Error ? err.message : err))
          );
          return;
        }
        case "dep_undo": {
          if (!window.confirm("解除这条等待依赖?解除不派发、不续跑。")) return;
          void apiPost(`/api/obligations/${encodeURIComponent(action.obligationId)}/waiting-on`, { preId: null }).then(
            () => {
              setToast("已解除依赖");
              reload();
            },
            (err: unknown) => setToast(String(err instanceof Error ? err.message : err))
          );
          return;
        }
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
        default:
          setToast("未识别动作");
      }
    },
    [enterChatWithFocus, focusId, reload, view, voice.confirmCard, voice.interviewAnchor, voice.interviewRounds, voice.sendText, voice.sessionId, voice.spoken]
  );

  const openInChat = useCallback(() => {
    enterChatWithFocus();
  }, [enterChatWithFocus]);

  if (error) return <ErrorCard message="Focus 页加载失败" detail={error} />;
  if (loading || !view) return null;

  const halt = ["closed", "abandoned", "archived"].includes(view.focus.lifecycle);

  return (
    <>
      <FocusPage
        view={view}
        initialTab={initialTab}
        onNavigate={onNavigate}
        onAction={onAction}
        onExpandSegment={onExpandSegment}
        composerSlot={
          halt ? undefined : (
            <button type="button" style={entryBtn} data-focus-composer-entry onClick={openInChat}>
              在这件事里开口
            </button>
          )
        }
      />
      {olderError ? (
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "var(--space-3)" }} data-timeline-older-error>
          <ErrorCard
            message="更早时间线没加载下来"
            detail={olderError}
            action={
              <button type="button" data-timeline-older-retry onClick={() => void loadOlder()} style={olderBtn}>
                重试
              </button>
            }
          />
        </div>
      ) : null}
      {hasOlder ? (
        <div style={{ textAlign: "center", padding: "var(--space-3)" }}>
          <button type="button" data-timeline-older onClick={() => void loadOlder()} style={olderBtn}>
            {olderError ? "重试加载更早" : "加载更早"}
          </button>
        </div>
      ) : null}
      {toast ? (
        <div role="status" data-toast style={toastStyle}>
          {toast}
        </div>
      ) : null}
      {modal ? (
        <TaskModal
          target={modal}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

// 占位:若后续需要 ack 从 Focus 页触发
export async function ackAttention(id: string): Promise<void> {
  await apiPost(`/api/attention/${encodeURIComponent(id)}/ack`, {});
}

/*
 * TODO 清单(Focus 接线未完成项,禁止静默吞掉):
 * - [ ] 完整 ChatComposer 挂载:需 VoiceContext 暴露 primary_focus 或会话锚定状态
 * - [ ] standby 模拟叫醒:排障动作,现役不从页面触发(toast 显式收窄)
 * - [ ] locate 闪烁高亮(仅当 data-locate 节点真实存在)
 * 已接:GET focus tasks + task detail + pending 包灌 lookups/工作面;
 * 批准须同 session/pkg/revision/receipt/digest;采访核对 focus/锚定代次/原 turn 后才 sendText;
 * fork REST、dep_add/dep_undo → 各自写口;pkg 非批准动作 → 锚定草稿,
 * retry → /api/tasks/:id/retry,冲突/解释 → 任务详情,验收/合并 → /review/:tid。
 */
