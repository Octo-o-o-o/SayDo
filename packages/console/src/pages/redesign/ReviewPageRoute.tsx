// Review 验收面接线容器:hook → ReviewPage;裁决动作接现有 api.reviewTask 等写口。

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ReviewPage } from "./ReviewPage";
import type { PageNavTarget } from "./nav";
import { useReviewPageData } from "../../hooks/redesign/useReviewPageData";
import { pageNavToHash } from "../../hooks/redesign/navMap";
import { navigate } from "../../lib/router";
import { ErrorCard } from "../../components/ui";
import { api, isRemoteOrigin, webauthnCreate, webauthnGet } from "../../lib/api";
import type { ReviewAction } from "../../components/redesign";

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

export function ReviewPageRoute({ taskId }: { taskId: string }) {
  const { view, loading, error, reload } = useReviewPageData(taskId);
  const [toast, setToast] = useState<string | null>(null);
  const [manualVerdicts, setManualVerdicts] = useState<Record<number, "pass" | "fail">>({});

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onNavigate = useCallback((target: PageNavTarget) => {
    navigate(pageNavToHash(target));
  }, []);

  const onAction = useCallback(
    (action: ReviewAction) => {
      if (!view) return;
      const attempt = view.ctx.task.attempt;
      const run = (fn: () => Promise<unknown>): void => {
        void fn().then(
          () => {
            setToast(null);
            reload();
          },
          (err: unknown) => setToast(String(err instanceof Error ? err.message : err))
        );
      };

      switch (action.type) {
        case "select_ac":
          // 纯 UI 选中,ReviewPanel 内部已处理
          return;
        case "verdict":
          setManualVerdicts((m) => ({ ...m, [action.index]: action.verdict }));
          return;
        case "approve": {
          const acceptanceVerdicts = view.ctx.acceptance
            .map((a, i) => {
              const v = manualVerdicts[i];
              if (a.source === "manual" && v) return { criterion: a.criterion, status: v };
              return null;
            })
            .filter((x): x is { criterion: string; status: "pass" | "fail" } => x != null);
          run(() =>
            api.reviewTask(taskId, {
              verdict: "approve",
              expectedAttempt: attempt,
              acceptanceVerdicts: acceptanceVerdicts.length ? acceptanceVerdicts : undefined
            })
          );
          return;
        }
        case "rework":
          run(() =>
            api.reviewTask(taskId, {
              verdict: "request_changes",
              expectedAttempt: attempt,
              comments: action.comment
            })
          );
          return;
        case "reject":
          run(() => api.reviewTask(taskId, { verdict: "reject", expectedAttempt: attempt }));
          return;
        case "explain":
          run(() => api.explainTask(taskId, action.level));
          return;
        case "s3_merge": {
          if (isRemoteOrigin()) {
            setToast("S3 合并请在受信终端操作");
            return;
          }
          run(async () => {
            const st = await api.s3Status();
            if (!st.registered) {
              const ch = await api.s3Challenge({ action: "register" });
              const att = await webauthnCreate(ch.challenge, ch.rpId);
              await api.s3Register(ch.challengeId, att);
            }
            const ch2 = await api.s3Challenge({ action: "merge", taskId });
            const allow = (await api.s3Status()).credentialId;
            if (!allow) throw new Error("未注册 passkey");
            const assertion = await webauthnGet(ch2.challenge, ch2.rpId, allow);
            const verified = await api.s3Verify(ch2.challengeId, assertion);
            await api.approveMerge(taskId, verified.receiptId);
          });
          return;
        }
        case "overrule":
          // TODO(接线后续批):决策推翻写口
          setToast("推翻判断接线后续批");
          return;
        case "back_to_focus":
          // 由 ReviewPage 映射为 onNavigate,不应到此
          return;
        default:
          setToast("未识别的验收动作");
      }
    },
    [view, taskId, manualVerdicts, reload]
  );

  if (error) return <ErrorCard message="验收面加载失败" detail={error} />;
  if (loading || !view) return null;

  // 把本地 manualVerdicts 灌回 view(不改 hook 内不可变数据)
  const patched: typeof view = {
    ...view,
    ctx: { ...view.ctx, manualVerdicts: { ...view.ctx.manualVerdicts, ...manualVerdicts } }
  };

  return (
    <>
      <ReviewPage view={patched} onNavigate={onNavigate} onAction={onAction} />
      {toast ? (
        <div role="status" data-toast style={toastStyle}>
          {toast}
        </div>
      ) : null}
    </>
  );
}
