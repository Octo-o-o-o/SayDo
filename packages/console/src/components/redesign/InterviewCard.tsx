// InterviewCard(demo interviewHtml):采访式一次一问、选择题优先(2-5 互斥选项)、
// 推荐只占徽章不占预选位;口播选项最多念 3 个;用户也可以直接开口说,不点。

import { useState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { card } from "./shared";

export function InterviewCard({ question, options, recommended, picked, onPick }: {
  question: string;
  options: string[];
  /** 推荐项文本(只渲染徽章,不做预选) */
  recommended?: string;
  picked?: string | null;
  onPick?: (option: string) => void;
}) {
  const [openAnswer, setOpenAnswer] = useState("");
  const submitOpen = (): void => {
    const text = openAnswer.trim();
    if (!text) return;
    onPick?.(text);
  };
  return (
    <div style={card} data-interview-card>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <MessageSquare size={15} aria-hidden />
        <strong>开工前先问清一件事</strong>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>采访式 · 一次一问 · 选择题优先</span>
      </div>
      <div style={{ fontSize: "var(--text-sm)", marginTop: 6 }} data-interview-question>{question}</div>
      {picked ? (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", marginTop: "var(--space-3)", display: "flex", gap: 6, alignItems: "center" }}>
          <Check size={12} aria-hidden /> 你选了「{picked}」,后面我按这个来
        </div>
      ) : (
        <>
          {options.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
              {options.map((o) => (
                <button
                  key={o}
                  type="button"
                  data-interview-option={o}
                  onClick={() => onPick?.(o)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1.5px solid var(--line)",
                    background: "var(--surface-soft)",
                    cursor: onPick ? "pointer" : "default",
                    textAlign: "left",
                    position: "relative",
                    fontSize: "var(--text-sm)"
                  }}
                >
                  {recommended === o ? (
                    <span
                      style={{
                        position: "absolute", top: -9, right: 12, fontSize: 10, padding: "2px 8px",
                        borderRadius: "var(--radius-pill)", background: "var(--surface-raised)",
                        border: "1px solid var(--active-ink-border)", color: "var(--active-ink)"
                      }}
                    >
                      我建议
                    </span>
                  ) : null}
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
              <input
                data-interview-open
                value={openAnswer}
                onChange={(e) => setOpenAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitOpen();
                }}
                placeholder="直接回答,不造选项"
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--line)",
                  background: "var(--surface-soft)",
                  fontSize: "var(--text-sm)"
                }}
              />
              <button
                type="button"
                data-interview-open-send
                onClick={submitOpen}
                disabled={!openAnswer.trim() || !onPick}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--line)",
                  background: "var(--surface-soft)",
                  cursor: onPick && openAnswer.trim() ? "pointer" : "default",
                  fontSize: "var(--text-sm)"
                }}
              >
                回答
              </button>
            </div>
          )}
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: 6 }}>
            {options.length > 0 ? "选项最多念 3 个 · 你也可以直接开口说,不点" : "开放回答 · 同会话发出,不伪造选项"}
          </div>
        </>
      )}
    </div>
  );
}
