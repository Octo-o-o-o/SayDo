// TimelineNote(分隔注)与 SessionSegmentCard(历史会话段卡,P0 时间线形态——handoff §3):
// 历史会话=段卡(第 N 次会话·时间段·轮数),点开由容器懒加载(onExpand prop);
// transcriptAvailable=false 显示占位不伪造(v4 F5);中断缺尾(endTs=null)如实呈现。
// 读取失败(null/抛错)与真空([])分开:失败显式可重试,不把失败缓存为空(11 诚实优先)。
// P0 无逐轮历史成员;活跃会话逐轮走 live 通道,不归此组件。

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Btn, card } from "./shared";

export function TimelineNote({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", color: "var(--text-faint)", fontSize: "var(--text-xs)" }}>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      {text}
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

type SegmentBox = { inflight: boolean; alive: boolean; gen: number };

export function SessionSegmentCard({ turnCount, startTs, endTs, transcriptAvailable, live, sessionRef, onExpand }: {
  turnCount: number;
  startTs: string;
  endTs: string | null;
  transcriptAvailable: boolean;
  /** L2:endTs=null 且为当前活跃会话段时置位——显示「进行中」;非活跃才显示「中断」 */
  live?: boolean;
  /** 段身份:切 sessionRef 时丢掉旧转写,避免把上一段当当前 */
  sessionRef?: string;
  /** 容器懒加载:点开时由接线层拉该 session 转写(组件不 fetch)。null/抛错=失败;[]=真空 */
  onExpand?: () => Promise<string[] | null> | string[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identity, setIdentity] = useState(sessionRef);
  const [box] = useState<SegmentBox>({ inflight: false, alive: true, gen: 0 });

  if (identity !== sessionRef) {
    box.gen += 1;
    box.inflight = false;
    setIdentity(sessionRef);
    setOpen(false);
    setLines(null);
    setFailed(false);
    setLoading(false);
  }

  useEffect(() => {
    box.alive = true;
    return () => {
      box.alive = false;
    };
  }, [box]);

  const load = async (): Promise<void> => {
    if (!transcriptAvailable || !onExpand || box.inflight) return;
    box.inflight = true;
    const gen = box.gen;
    setLoading(true);
    setFailed(false);
    try {
      const got = await onExpand();
      if (!box.alive || gen !== box.gen) return;
      if (got == null) {
        setLines(null);
        setFailed(true);
      } else {
        setLines(got);
        setFailed(false);
      }
    } catch {
      if (!box.alive || gen !== box.gen) return;
      setLines(null);
      setFailed(true);
    } finally {
      if (gen === box.gen) {
        box.inflight = false;
        if (box.alive) setLoading(false);
      }
    }
  };

  const onHeaderClick = (): void => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (transcriptAvailable && onExpand && (lines === null || failed)) {
      void load();
    }
  };

  const onRetry = (): void => {
    if (box.inflight || loading) return;
    setOpen(true);
    void load();
  };

  const headerLabel = open ? "收起" : loading ? "读取中…" : failed ? "再试一次" : "展开转写";

  return (
    <div
      style={{ ...card, padding: "var(--space-3) var(--space-4)" }}
      data-session-segment
      data-session-ref={sessionRef}
      data-transcript-available={transcriptAvailable ? "true" : "false"}
      data-transcript-open={open ? "true" : "false"}
      data-transcript-loading={loading ? "true" : "false"}
      data-transcript-failed={failed ? "true" : "false"}
    >
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <MessageSquare size={13} aria-hidden style={{ color: "var(--text-muted)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-sm)" }}>
            一次会话 · {startTs}{endTs ? ` – ${endTs}` : ""}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: 2 }}>
            {turnCount} 轮 · {endTs ? "已收场" : live ? "进行中" : "中断(无 closed 事件,截至最后事件时间)"}
          </div>
        </div>
        {transcriptAvailable ? (
          <Btn onClick={() => void onHeaderClick()} disabled={loading && !open}>{headerLabel}</Btn>
        ) : null}
      </div>
      {!transcriptAvailable ? (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-2)" }}>
          未存转写,仅事件留痕(store_transcript=false,不伪造内容)
        </div>
      ) : null}
      {open && loading && lines === null && !failed ? (
        <div
          data-transcript-body="loading"
          style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-2)" }}
        >
          读取中…
        </div>
      ) : null}
      {open && failed ? (
        <div
          data-transcript-body="fail"
          style={{
            marginTop: "var(--space-3)",
            background: "var(--code-block-bg)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-3)",
            fontSize: "var(--text-sm)",
            lineHeight: 1.9
          }}
        >
          <div>转写没读到。</div>
          <div style={{ marginTop: "var(--space-2)" }}>
            <Btn onClick={() => void onRetry()} disabled={loading}>再试一次</Btn>
          </div>
        </div>
      ) : null}
      {open && lines !== null ? (
        <div
          data-transcript-body={lines.length === 0 ? "empty" : "lines"}
          style={{
            marginTop: "var(--space-3)",
            background: "var(--code-block-bg)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-3)",
            fontSize: "var(--text-sm)",
            lineHeight: 1.9,
            maxHeight: 320,
            overflowY: "auto"
          }}
        >
          {lines.length === 0 ? "这一段没有留下转写内容。" : lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      ) : null}
    </div>
  );
}
