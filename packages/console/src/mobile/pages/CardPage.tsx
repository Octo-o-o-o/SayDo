import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveCard, readCachedCard } from "../cardResolver";
import {
  CONFIRM_REJECT_SUBTEXT,
  CONFIRM_WITHDRAW_SUBTEXT,
  confirmAcceptSubtext
} from "../confirmCopy";
import {
  MobileConfirmOutcomeError,
  sendMobileConfirmDecision,
  type MobileConfirmDecision
} from "../confirmDecision";
import { useMobileFocus } from "../hooks";
import { MobileHeader, MobileNotice } from "../MobileChrome";
import { confirmDestinationHint, confirmSettlementToast } from "../toasts";
import type { AttentionItem, MobileCardRef } from "../types";

export function DurableCountdown({
  expiresAt,
  nowMs,
  onExpired
}: {
  expiresAt: string;
  nowMs?: number;
  onExpired?: () => void;
}) {
  const [now, setNow] = useState(nowMs ?? Date.now());
  useEffect(() => {
    if (nowMs !== undefined) {
      setNow(nowMs);
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [nowMs]);
  const remaining = Math.max(0, Date.parse(expiresAt) - now);
  useEffect(() => {
    if (remaining === 0) onExpired?.();
  }, [onExpired, remaining]);
  return (
    <div className="m-countdown" data-expires-at={expiresAt}>
      <strong>{formatRemaining(remaining)}</strong>
      <span>{remaining > 0 ? "后过期自动搁置" : "已过期，自动搁置"}</span>
    </div>
  );
}

export function MobileCardPage({
  cardRef,
  attention,
  attentionError,
  onSettled
}: {
  cardRef: MobileCardRef;
  attention: AttentionItem[] | null;
  attentionError: string | null;
  onSettled: (message: string) => void;
}) {
  const cached = useMemo(() => readCachedCard(cardRef), [cardRef]);
  const focusResource = useMobileFocus(cached?.focusId ?? null);
  const snapshot = focusResource.data?.obligations.find((item) => item.id === cardRef.entityId);
  const resolution = attention === null
    ? null
    : resolveCard({ ref: cardRef, attention, ...(cached ? { cached } : {}), ...(snapshot ? { snapshot } : {}) });
  const back = cached?.laneId && cached.focusId
    ? `/m/lane/${encodeURIComponent(cached.focusId)}/${encodeURIComponent(cached.laneId)}`
    : cached?.focusId
      ? `/m/focus/${encodeURIComponent(cached.focusId)}`
      : "/m";
  if (attentionError) return <><MobileHeader title="卡片" crumb="收件箱读取失败" back={back} /><MobileNotice tone="error">{attentionError}</MobileNotice></>;
  if (!resolution) return <><MobileHeader title="卡片" crumb="正在核对当前状态" back={back} /><MobileNotice>正在查这张卡是否仍可处理</MobileNotice></>;
  if (resolution.state === "missing") {
    return <CardStatePage title="没有找到这张卡" back={back}>链接可能失效，或这张卡从未在本机账本中出现。</CardStatePage>;
  }
  if (resolution.state === "stale") {
    return <CardStatePage title="这张卡已不在待办里" back={back} showLaneAction={resolution.allowedActions.includes("open_lane")}>可能已在桌面处理，或已过期搁置。不重复执行。</CardStatePage>;
  }
  if (resolution.state === "expired") {
    return <CardStatePage title="这张卡已过期搁置" back={back} showLaneAction={resolution.allowedActions.includes("open_lane")}>到期后不再允许裁决。</CardStatePage>;
  }
  if (resolution.state === "resolved") {
    return <CardStatePage title="这张卡已有终态" back={back} showLaneAction={resolution.allowedActions.includes("open_lane")}>当前账本已给出终态。</CardStatePage>;
  }
  if (cardRef.kind !== "confirmation") {
    return (
      <div data-mobile-page="card">
        <MobileHeader title="账本条目" crumb={resolution.item.focusTitle ?? cardRef.kind} back={back} />
        <article className="m-read-card">
          <span>{cardRef.kind}</span>
          <h1>{resolution.item.title}</h1>
          <p>{resolution.item.needs ? `当前需要：${resolution.item.needs}` : "M1 只读呈现；动作请回泳道或桌面处理。"}</p>
          <a href={`#${back}`}>去泳道看</a>
        </article>
      </div>
    );
  }
  return <MobileConfirmCard item={resolution.item} back={back} onSettled={onSettled} key={resolution.item.id} />;
}

export function MobileConfirmCard({
  item,
  back,
  onSettled
}: {
  item: AttentionItem;
  back: string;
  onSettled?: (message: string) => void;
}) {
  const [working, setWorking] = useState<MobileConfirmDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(() => !item.expiresAt || Date.parse(item.expiresAt) <= Date.now());
  const [runtimeRestricted, setRuntimeRestricted] = useState(false);
  const markExpired = useCallback(() => setUnavailable(true), []);
  const decide = async (decision: MobileConfirmDecision) => {
    if (unavailable || (runtimeRestricted && decision !== "withdraw")) return;
    if (!item.sessionId || !item.refId) {
      setError("这张卡缺少原会话定向信息，不能安全裁决");
      return;
    }
    setWorking(decision);
    setError(null);
    try {
      await sendMobileConfirmDecision({ sessionId: item.sessionId, receiptId: item.refId, decision });
      const destination = confirmDestinationHint({
        focusTitle: item.focusTitle,
        needs: item.needs,
        sourceKind: item.sourceKind
      });
      onSettled?.(confirmSettlementToast(decision, destination));
      location.hash = "/m";
    } catch (caught) {
      if (caught instanceof MobileConfirmOutcomeError) {
        if (caught.keepsWithdrawAvailable) setRuntimeRestricted(true);
        else setUnavailable(true);
      }
      setError(caught instanceof Error ? caught.message : String(caught));
      setWorking(null);
    }
  };
  return (
    <div data-mobile-page="confirm">
      <MobileHeader title="确认卡" crumb={item.focusTitle ?? "等你拍板"} back={back} />
      <article className="m-confirm-card">
        <span className="m-confirm-kicker">等你拍板</span>
        <h1>{item.title}</h1>
        {item.expiresAt ? (
          <DurableCountdown expiresAt={item.expiresAt} onExpired={markExpired} />
        ) : (
          <MobileNotice tone="error">缺少 durable 到期锚，已禁用裁决。</MobileNotice>
        )}
        <div className="m-confirm-actions">
          <button type="button" className="m-confirm-do" disabled={working !== null || unavailable || runtimeRestricted} onClick={() => void decide("accept")}>
            <strong>{working === "accept" ? "记账中" : "做"}</strong>
            <span>{confirmAcceptSubtext(item.title)}</span>
          </button>
          <button type="button" disabled={working !== null || unavailable || runtimeRestricted} onClick={() => void decide("reject")}>
            <strong>{working === "reject" ? "记账中" : "不要"}</strong>
            <span>{CONFIRM_REJECT_SUBTEXT}</span>
          </button>
          <button type="button" className="m-confirm-undo" disabled={working !== null || unavailable} onClick={() => void decide("withdraw")}>
            <strong>{working === "withdraw" ? "撤下中" : "撤销"}</strong>
            <span>{CONFIRM_WITHDRAW_SUBTEXT}</span>
          </button>
        </div>
        <a className="m-say-change" href="#/m/chat">想换方向，去说改</a>
        <p className="m-confirm-principle">过期自动搁置并记账，不会偷偷执行。</p>
        {error ? <MobileNotice tone="error">{error}</MobileNotice> : null}
      </article>
    </div>
  );
}

function CardStatePage({
  title,
  back,
  showLaneAction = false,
  children
}: {
  title: string;
  back: string;
  showLaneAction?: boolean;
  children: string;
}) {
  return (
    <div data-mobile-page="card-state">
      <MobileHeader title="卡片状态" crumb="如实回执" back={back} />
      <article className="m-receipt">
        <span>当前账面</span>
        <h1>{title}</h1>
        <p>{children}</p>
        {showLaneAction ? <a href={`#${back}`}>去泳道看</a> : null}
      </article>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1_000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
