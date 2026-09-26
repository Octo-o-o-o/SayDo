// ReviewPanel(demo renderReview):验收面按验收标准组织——左标准右证据;
// agent_claim 的 pass 用空心勾+虚线边(与机器验实心绿勾降权区分,handoff §4.3);
// 讲给我听三层;判断可推翻;writing 人工项逐条裁决后才放行通过键;S3 独立按钮区。
// 状态词:执行和检查都跑完了,等你验收;合并后才叫「已交付」。

import { useState } from "react";
import { Check, ChevronRight, Clock, Fingerprint, Flag, X } from "lucide-react";
import { ActionRow, Btn, card, Mono } from "./shared";
import { StatusChip, RiskBadge } from "../StatusChip";
import type { AcceptanceItem, ReviewTaskContext } from "./types";

export type ReviewAction =
  | { type: "select_ac"; index: number }
  | { type: "verdict"; index: number; verdict: "pass" | "fail" }
  | { type: "approve" } | { type: "rework"; comment?: string } | { type: "reject" }
  | { type: "s3_merge" } | { type: "overrule"; decisionIndex: number }
  | { type: "explain"; level: "one_liner" | "walkthrough" | "decisions" }
  | { type: "back_to_focus" };

function AcIcon({ status, source }: { status: AcceptanceItem["status"]; source: AcceptanceItem["source"] }) {
  if (status === "pass" && source === "agent_claim") {
    // 自报降权:空心勾+虚线边(handoff §4.3,与机器验实心绿勾区分)
    return (
      <span
        style={{
          color: "var(--color-success)", opacity: 0.7, border: "1.5px dashed var(--color-success)",
          borderRadius: "50%", width: 18, height: 18, display: "inline-grid", placeItems: "center", flex: "none"
        }}
      >
        <Check size={10} aria-hidden />
      </span>
    );
  }
  if (status === "pass") return <Check size={13} aria-hidden style={{ color: "var(--color-success)", flex: "none" }} />;
  if (status === "fail") return <X size={13} aria-hidden style={{ color: "var(--color-error)", flex: "none" }} />;
  return <Clock size={13} aria-hidden style={{ color: "var(--text-faint)", flex: "none" }} />;
}

const SOURCE_LABEL: Record<AcceptanceItem["source"], string> = { verify: "机器验", agent_claim: "自报", manual: "人工" };

export function ReviewPanel({ ctx, onAction, backLabel }: {
  ctx: ReviewTaskContext;
  onAction?: (action: ReviewAction) => void;
  /** 返回条文案(页面传入,如「回到『给 SayDo 重做前端』」);缺省为通用文案 */
  backLabel?: string;
}) {
  const [sel, setSel] = useState(0);
  const [explainLevel, setExplainLevel] = useState<"one_liner" | "walkthrough" | "decisions" | null>(null);
  const ac = ctx.acceptance[sel];
  const verdicts = ctx.manualVerdicts ?? {};
  const effStatus = (a: AcceptanceItem, i: number) => (ctx.writing && a.source === "manual" ? verdicts[i] ?? "unknown" : a.status);
  const allManualJudged = !ctx.writing || ctx.acceptance.every((a, i) => a.source !== "manual" || verdicts[i]);
  const blockedByFail = ctx.acceptance.some((a, i) => effStatus(a, i) === "fail");
  const blockedByEvidence = ctx.acceptance.some((a) => a.evidenceBlock === "bound_invalid");
  const approveBlocked = !allManualJudged || blockedByFail || blockedByEvidence;
  const t = ctx.task;

  const emit = (a: ReviewAction) => {
    if (a.type === "select_ac") setSel(a.index);
    if (a.type === "explain") setExplainLevel(prev => (prev === a.level ? null : a.level));
    onAction?.(a);
  };

  const evidenceBody = () => {
    if (!ac) return null;
    const ev = ac.evidence;
    if (ev) {
      const boxStyle = ev.kind === "diff" || ev.kind === "log"
        ? { fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", lineHeight: 1.7, background: "var(--code-block-bg)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)", overflowX: "auto" as const, whiteSpace: "pre-wrap" as const }
        : { background: "var(--code-block-bg)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "var(--space-4)", fontSize: "var(--text-sm)", lineHeight: 1.9, maxHeight: 320, overflowY: "auto" as const };
      return (
        <div>
          <div
            data-review-evidence
            data-review-tree-sha={ev.treeSha ?? ""}
            data-review-run-id={ev.runId ?? ""}
            style={boxStyle}
          >
            {ev.body}
          </div>
          {ev.href ? (
            <a
              href={ev.href}
              data-review-evidence-link
              style={{ display: "inline-block", marginTop: "var(--space-2)", fontSize: "var(--text-sm)" }}
            >
              {ev.hrefLabel ?? "打开本任务详情"}
            </a>
          ) : null}
        </div>
      );
    }
    if (ac.evidenceBlock === "bound_invalid") {
      return (
        <div data-review-evidence-block="bound_invalid" style={{ ...card, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          这条已经绑了证据,但引用对不上(缺文件、内容被改、跨了别的 run,或无权读)。不能当成待判断后通过。
        </div>
      );
    }
    return (
      <div style={{ ...card, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
        {ctx.writing && ac.source === "manual" ? "这条只能人工判断。读完后在下面给结论。" : "没有绑上证据,诚实标注为 unknown,不显示伪精确。"}
      </div>
    );
  };

  return (
    <div
      data-review-panel={t.id}
      data-review-items-pass={ctx.acceptance.some((a, i) => effStatus(a, i) === "pass") ? "1" : "0"}
      data-review-approve-blocked={approveBlocked ? "1" : "0"}
    >
      <div style={{ marginBottom: "var(--space-3)" }}>
        <Btn icon={ChevronRight} onClick={() => emit({ type: "back_to_focus" })}>{backLabel ?? "回到所属 Focus"}</Btn>
      </div>

      <div style={card}>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>{t.title}</span>
          <StatusChip status={t.viewStatus} />
          <RiskBadge risk={t.riskLevel} />
          <Mono faint>{t.route === "hopper" ? "HP" : "T1"}</Mono>
        </div>
        <div style={{ fontSize: "var(--text-sm)", marginTop: 6 }}>
          {blockedByFail ? (
            "验证没过,这些验收项不能当成通过。"
          ) : blockedByEvidence ? (
            "有验收项绑过证据,但引用已经对不上。先别通过。"
          ) : (
            <>
              执行和检查都跑完了,<strong>等你验收</strong>。下面按验收标准逐条看。
            </>
          )}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <span>{ctx.packageRefText}</span>
          <Mono>已跑 {t.elapsedMin} 分钟 · 已花 {t.spent.known ? `¥${t.spent.value}` : "还没有确切数字"} / 熔断 ¥{t.budget.maxCost}</Mono>
          <Mono>第 {t.attempt} 次尝试</Mono>
        </div>
        {ctx.explain ? (
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>讲给我听:</span>
            {(["one_liner", "walkthrough", "decisions"] as const).map(lv => (
              <Btn key={lv} variant={explainLevel === lv ? "ink-outline" : "default"} onClick={() => emit({ type: "explain", level: lv })}>
                {lv === "one_liner" ? "一句话" : lv === "walkthrough" ? "带我过一遍" : "关键判断"}
              </Btn>
            ))}
          </div>
        ) : null}
        {explainLevel && ctx.explain ? (
          <div style={{ background: "var(--active-ink-wash)", border: "1px solid var(--active-ink-border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginTop: "var(--space-3)", fontSize: "var(--text-sm)" }}>
            {ctx.explain[explainLevel]}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "var(--space-5)", alignItems: "start", marginTop: "var(--space-4)" }}>
        <section>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-3)" }}>
            验收标准{ctx.writing ? <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>(人工项须逐条给结论)</span> : null}
          </div>
          {ctx.acceptance.map((a, i) => {
            const st = effStatus(a, i);
            return (
              <button
                key={i}
                type="button"
                data-acceptance-item
                data-acceptance-status={st}
                data-acceptance-source={a.source}
                data-acceptance-evidence={a.evidenceBlock ?? "open"}
                data-acceptance-criterion={a.criterion}
                onClick={() => emit({ type: "select_ac", index: i })}
                style={{
                  display: "flex", gap: "var(--space-2)", padding: "10px var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${i === sel ? "var(--active-ink)" : "var(--line)"}`,
                  background: i === sel ? "var(--selected-wash)" : "transparent",
                  marginBottom: "var(--space-2)", cursor: "pointer", width: "100%", textAlign: "left",
                  fontSize: "var(--text-sm)", alignItems: "center"
                }}
              >
                <AcIcon status={st} source={a.source} />
                <span style={{ flex: 1 }}>{a.criterion}</span>
                <Mono faint>{SOURCE_LABEL[a.source]}</Mono>
              </button>
            );
          })}
          <div style={{ ...card, marginTop: "var(--space-3)", padding: "var(--space-3) var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-2)" }}>尝试记录</div>
            {ctx.runs.map(r => (
              <div key={r.attempt} style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>
                <Mono>#{r.attempt}</Mono> {r.result}
              </div>
            ))}
          </div>
        </section>

        <section>
          <div style={card}>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
              证据 · {ac?.section ?? `第 ${sel + 1} 条`}
            </div>
            {ac?.source === "agent_claim" ? (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-warning)", marginBottom: "var(--space-2)" }}>
                自报证据:强度低于机器验,空心勾以示降权,你可以推翻。
              </div>
            ) : null}
            {evidenceBody()}
            {ctx.writing && ac?.source === "manual" ? (
              <ActionRow>
                <Btn variant={verdicts[sel] === "pass" ? "primary" : "default"} icon={Check} onClick={() => emit({ type: "verdict", index: sel, verdict: "pass" })}>这条行</Btn>
                <Btn variant={verdicts[sel] === "fail" ? "danger-outline" : "default"} icon={X} onClick={() => emit({ type: "verdict", index: sel, verdict: "fail" })}>这条不行</Btn>
              </ActionRow>
            ) : null}
          </div>

          <div style={{ ...card, marginTop: "var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)" }}>这次执行里的判断(你都可以推翻)</div>
            {ctx.decisions.map((d, i) => (
              <div key={i} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", padding: "10px 0", borderBottom: i < ctx.decisions.length - 1 ? "1px dashed var(--line)" : "none", fontSize: "var(--text-sm)" }}>
                <div style={{ flex: 1 }}>
                  <div>{d.what}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>原因:{d.why}</div>
                </div>
                <Btn onClick={() => emit({ type: "overrule", decisionIndex: i })}>推翻</Btn>
              </div>
            ))}
          </div>

          <div style={{ ...card, marginTop: "var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-3)" }}>你的裁决</div>
            <ActionRow>
              {ctx.s3 ? (
                <>
                  <Btn variant="s3" icon={Fingerprint} disabled={approveBlocked} onClick={() => emit({ type: "s3_merge" })}>用本机认证批准并合并</Btn>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>S3 不可逆 · 只能在这台电脑上完成,语音与远程永不出现此按钮</span>
                </>
              ) : (
                <Btn
                  variant="seal"
                  icon={Flag}
                  disabled={approveBlocked}
                  onClick={() => emit({ type: "approve" })}
                >
                  通过{allManualJudged ? "" : "(先逐条裁决人工项)"}
                </Btn>
              )}
              <Btn onClick={() => emit({ type: "rework" })}>返工,附带意见</Btn>
              <Btn variant="danger-outline" onClick={() => emit({ type: "reject" })}>这轮不行</Btn>
            </ActionRow>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-3)" }}>
              合并永远你拍板 · 「通过」只说验收,不说交付;合并后才叫「已交付」
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
