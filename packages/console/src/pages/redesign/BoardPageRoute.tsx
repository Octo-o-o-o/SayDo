// 全景看板接线容器:hook → BoardPage;卡片点击开 TaskModal,组头走 onNavigate→#/focus/:id。

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { BoardPage, type BoardPageAction } from "./BoardPage";
import type { PageNavTarget } from "./nav";
import { useBoardPageData } from "../../hooks/redesign/useBoardPageData";
import { pageNavToHash } from "../../hooks/redesign/navMap";
import { navigate } from "../../lib/router";
import { ErrorCard } from "../../components/ui";
import { TaskModal, type TaskModalTarget } from "../../components/TaskModal";

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

export function BoardPageRoute() {
  const { view, loading, error, reload } = useBoardPageData();
  const [modal, setModal] = useState<TaskModalTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onNavigate = useCallback((target: PageNavTarget) => {
    navigate(pageNavToHash(target));
  }, []);

  const onAction = useCallback((action: BoardPageAction) => {
    if (action.type === "open_task") {
      const t = action.task;
      // ready_for_review → 验收面;其余 TaskModal
      if (t.viewStatus === "ready_for_review") {
        navigate(`/review/${encodeURIComponent(t.id)}`);
        return;
      }
      setModal({
        kind: "task",
        id: t.id,
        title: t.title,
        focusId: t.focusId
      });
      return;
    }
    if (action.type === "open_obligation") {
      const o = action.obligation;
      setModal({
        kind: "obligation",
        id: o.id,
        title: o.title,
        needs: o.needs,
        focusId: o.focusId
      });
      return;
    }
    setToast("未识别的看板动作");
  }, []);

  if (error) return <ErrorCard message="看板加载失败" detail={error} />;
  if (loading || !view) return null;

  return (
    <>
      <BoardPage view={view} onNavigate={onNavigate} onAction={onAction} />
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
