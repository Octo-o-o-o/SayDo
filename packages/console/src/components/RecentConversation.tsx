import { useState } from "react";
import { loadRecentTranscript, type RecentTranscriptPayload } from "../lib/recentTranscript";

export function RecentConversation() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RecentTranscriptPayload | null>(null);
  const [error, setError] = useState(false);
  async function readHistory() {
    setOpen(true);
    setLoading(true);
    setError(false);
    try {
      setHistory(await loadRecentTranscript(40));
    } catch {
      setHistory(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section data-recent-conversation className="mb-[var(--space-3)] text-[var(--text-sm)]">
      <button type="button" disabled={loading} aria-expanded={open}
        onClick={() => open ? setOpen(false) : void readHistory()}>
        {open ? "收起最近对话" : "查看最近对话"}
      </button>
      {open ? <div className="mt-[var(--space-2)] space-y-[var(--space-2)]">
        <p className="text-[var(--text-muted)]">最近一次会话的历史转写，可能来自其他项目；仅供回看，不会自动加入当前对话。</p>
        {loading ? <p>正在读取最近对话…</p> : error ? <p role="alert">最近对话读取失败，请收起后重试。</p> :
          history?.turns.length ? history.turns.map((turn, index) => (
            <p key={`${turn.turnId ?? "history"}-${index}`} className="whitespace-pre-wrap">
              <span>{turn.speaker === "user" ? "你" : "SayDo"}：</span>{turn.text}
            </p>
          )) : <p>没有可回看的转写记录。</p>}
      </div> : null}
    </section>
  );
}
