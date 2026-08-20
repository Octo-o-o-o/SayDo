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
import { useVoice } from "../../shell/VoiceContext";

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

export function FocusPageRoute({ focusId }: { focusId: string }) {
  // L2:当前会话 id 注入数据层——活跃会话段显示「进行中」而非「中断」
  const voice = useVoice();
  const { view, loading, error, reload, loadOlder, hasOlder, onExpandSegment } = useFocusPageData(focusId, voice.sessionId);
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

  const onAction = useCallback(
    (action: FocusPageAction) => {
      switch (action.type) {
        case "task": {
          // 任务卡动作:review 跳验收面;其余开 TaskModal 或 toast 占位
          if (action.action.type === "review") {
            navigate(`/review/${encodeURIComponent(action.taskId)}`);
            return;
          }
          if (action.action.type === "open_focus") {
            navigate(`/focus/${encodeURIComponent(focusId)}`);
            return;
          }
          // TODO(接线后续批):step_ok/step_no/billing/s3_merge/retry/answer/explain 接真实写口
          setModal({ kind: "task", id: action.taskId, title: action.taskId, focusId });
          return;
        }
        case "locate": {
          // 右栏定位:P0 用 hash 锚 + toast,完整滚动闪烁归后续
          const el = document.querySelector(`[data-locate="${action.target.kind}:${action.target.id}"]`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          else setToast(`定位 ${action.target.kind} ${action.target.id}(页面内无对应节点)`);
          return;
        }
        case "pkg":
          // TODO(接线后续批):决策包 select_mode/approve/revise/edit_expectation 接写口
          setToast("决策包动作接线后续批");
          return;
        case "standby":
          setToast("模拟叫醒接线后续批");
          return;
        case "interview_pick":
          setToast("采访选项接线后续批(live 通道)");
          return;
        case "expect":
          setToast("「我期待一个 X」接线后续批");
          return;
        case "expectation_edit":
          setToast("期待直改接线后续批(v0.4)");
          return;
        case "fork":
          // TODO(接线后续批):fork API
          setToast("Fork 接线后续批");
          return;
        default:
          setToast("未识别动作");
      }
    },
    [focusId]
  );

  const openInChat = useCallback(() => {
    // 与旧 FocusDetail 续推锚定同机制:sessionStorage + chat-new
    const title = view?.focus.title;
    try {
      sessionStorage.setItem(
        "saydo.chat.pendingAnchor",
        JSON.stringify({ focusId, title })
      );
    } catch {
      /* ignore quota */
    }
    navigate("/chat-new");
  }, [focusId, view?.focus.title]);

  if (error) return <ErrorCard message="Focus 页加载失败" detail={error} />;
  if (loading || !view) return null;

  const halt = ["closed", "abandoned", "archived"].includes(view.focus.lifecycle);

  return (
    <>
      <FocusPage
        view={view}
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
      {hasOlder ? (
        <div style={{ textAlign: "center", padding: "var(--space-3)" }}>
          <button
            type="button"
            data-timeline-older
            onClick={() => void loadOlder()}
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-xs)",
              padding: "6px 14px",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              cursor: "pointer"
            }}
          >
            加载更早
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
 * TODO 清单(Focus 接线未完成项,禁止静默吞掉——已用 toast 占位):
 * - [ ] 完整 ChatComposer 挂载:需 VoiceContext 暴露 primary_focus 或会话锚定状态
 * - [ ] rail.tasks / lookups.tasks:需 focus→tasks 读口
 * - [ ] 决策包/期待直改/fork/standby 写口
 * - [ ] locate 闪烁高亮
 */
