// 记录页接线容器:hook → RecordsPage;生命周期写口(archive/reopen 等)接现有 API。

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { RecordsPage } from "./RecordsPage";
import type { PageNavTarget } from "./nav";
import { useRecordsPageData } from "../../hooks/redesign/useRecordsPageData";
import { pageNavToHash } from "../../hooks/redesign/navMap";
import { navigate } from "../../lib/router";
import { ErrorCard } from "../../components/ui";
import { apiPost } from "../../lib/api";
import { useVoice } from "../../shell/VoiceContext";
import type { RecordsAction } from "../../components/redesign";

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

export function RecordsPageRoute({ focusId }: { focusId: string }) {
  // L2:当前会话 id 注入数据层——活跃会话段显示「进行中」而非「中断」
  const voice = useVoice();
  const { view, loading, error, reload, onExpandSegment } = useRecordsPageData(focusId, voice.sessionId);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onNavigate = useCallback((target: PageNavTarget) => {
    navigate(pageNavToHash(target));
  }, []);

  const onAction = useCallback(
    (action: RecordsAction) => {
      const run = (fn: () => Promise<unknown>, okMsg?: string): void => {
        void fn().then(
          () => {
            if (okMsg) setToast(okMsg);
            reload();
          },
          (err: unknown) => setToast(String(err instanceof Error ? err.message : err))
        );
      };

      switch (action.type) {
        case "archive": {
          const reason = window.prompt("归档理由(必填)");
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
          // TODO:若 daemon 有独立 abandon 口则换;暂与 archive 同形并注明
          run(
            () =>
              apiPost(`/api/focuses/${encodeURIComponent(focusId)}/archive`, {
                reason: `abandon:${reason.trim()}`
              }),
            "已标记放弃(经 archive 口)"
          );
          return;
        }
        case "reopen":
          run(() => apiPost(`/api/focuses/${encodeURIComponent(focusId)}/reopen`, {}), "已重开");
          return;
        case "fork":
          // TODO(接线后续批):fork API
          setToast("Fork 接线后续批");
          return;
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
          if (action.op === "redo") {
            setToast("从锚点重做请用旧版 Focus 详情页的 redo 预览(接线后续批完善)");
            return;
          }
          // continue → 开口聊并锚定
          try {
            sessionStorage.setItem(
              "saydo.chat.pendingAnchor",
              JSON.stringify({ focusId, title: view?.focus.title, laneTitle: action.laneId })
            );
          } catch {
            /* ignore */
          }
          navigate("/chat-new");
          return;
        case "dependency_undo":
          // TODO(接线后续批):解除依赖写口
          setToast("解除依赖接线后续批");
          return;
        case "redo_preview":
          setToast("Redo 预览接线后续批");
          return;
        case "back":
          return;
        default:
          setToast("未识别的记录页动作");
      }
    },
    [focusId, reload, view?.focus.title]
  );

  if (error) return <ErrorCard message="记录页加载失败" detail={error} />;
  if (loading || !view) return null;

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
    </>
  );
}
