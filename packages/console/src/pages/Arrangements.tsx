// 安排页(#/arrangements;DAILY-01 R07):跨 Focus 义务清单按 owner 分三组(等你/我在做/等外部)。
// 动作:完成(agent+done 需依据 artifact/task/event 三选一)/推迟(理由必填;日期=记录非调度)。
// 完成依据表单只收三类 evidence 的最小字段;agent 义务 done 无依据时后端 409,前端先拦。

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight } from "lucide-react";
import { apiGet, apiPost } from "../lib/api";
import { EmptyState, ErrorCard, PaperCard, Mono, SectionTitle } from "../components/ui";

interface ObligationRow {
  id: string;
  focusId: string;
  focusTitle: string;
  focusLifecycle: string;
  laneId: string | null;
  kind: string;
  title: string;
  owner: "human" | "agent" | "external" | string;
  status: string;
  needs: string | null;
  blocking: number;
  waitingOn: string | null;
  waitingOnObligationId: string | null;
  preObligationTitle: string | null;
  waitingOnTaskId: string | null;
  preTaskTitle: string | null;
  waitingTaskCondition: string | null;
  deferReason: string | null;
  dueOrTrigger: string | null;
  nextStep: string | null;
  detail: string | null;
  actionRef: string | null;
  updatedAt: string;
}

const GROUP_LABEL: Record<string, string> = {
  human: "等你(人)",
  agent: "我在做(Agent)",
  external: "等外部"
};

const KIND_LABEL: Record<string, string> = {
  answer: "要答", decision: "要拍板", action: "要做", followup: "要跟", check: "要核"
};

const STATUS_LABEL: Record<string, string> = {
  open: "待办", in_progress: "进行中", waiting: "等待", deferred: "搁置",
  blocked: "卡住", resolved: "已收尾", superseded: "已被替代"
};

/** 前置等待文案(义务级 or 任务级) */
function waitingText(o: ObligationRow): string | null {
  if (o.waitingOnTaskId) {
    const cond = o.waitingTaskCondition === "delivered" ? "交付" : "验收通过";
    return `等任务「${o.preTaskTitle ?? o.waitingOnTaskId}」${cond}`;
  }
  if (o.waitingOnObligationId) {
    return `等「${o.preObligationTitle ?? o.waitingOnObligationId}」`;
  }
  return o.waitingOn ?? null;
}

interface ResolveForm {
  resolution: "done" | "abandoned" | "superseded" | "no_longer_applicable";
  evidenceKind: "" | "artifact" | "task" | "event";
  evidenceRef: string;
}

function needEvidence(o: ObligationRow, res: ResolveForm["resolution"]): boolean {
  return o.owner === "agent" && res === "done";
}

export function Arrangements() {
  const [rows, setRows] = useState<ObligationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState<ResolveForm>({ resolution: "done", evidenceKind: "", evidenceRef: "" });

  const load = useCallback(() => {
    apiGet<ObligationRow[]>("/api/obligations")
      .then((d) => setRows(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(load, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const doResolve = (o: ObligationRow) => {
    const body: Record<string, unknown> = { resolution: form.resolution };
    if (form.evidenceKind === "artifact") {
      const [id, ver] = form.evidenceRef.split(":");
      if (!id || !ver) { setToast("产物依据格式:artifactId:版本号"); return; }
      body.evidence = { type: "artifact", id, version: Number(ver) };
    } else if (form.evidenceKind === "task") {
      const [id, att] = form.evidenceRef.split(":");
      if (!id || !att) { setToast("任务依据格式:taskId:attempt"); return; }
      body.evidence = { type: "task", id, attempt: Number(att) };
    } else if (form.evidenceKind === "event") {
      const [fid, seq] = form.evidenceRef.split(":");
      if (!fid || !seq) { setToast("事件依据格式:focusId:seq"); return; }
      body.evidence = { type: "event", focusId: fid, seq: Number(seq) };
    }
    if (needEvidence(o, form.resolution) && !body.evidence) {
      setToast("Agent 义务判「办到了」必须给依据(产物/任务/事件三选一)");
      return;
    }
    void apiPost(`/api/obligations/${encodeURIComponent(o.id)}/resolve`, body).then(
      () => { setToast("已收尾"); setResolving(null); load(); },
      (e: unknown) => setToast(String(e instanceof Error ? e.message : e))
    );
  };

  const doDefer = (o: ObligationRow) => {
    const reason = window.prompt("为什么推迟?(必填)");
    if (reason === null) return;
    if (!reason.trim()) { setToast("推迟要写明理由"); return; }
    const due = window.prompt("什么时候唤起 / 什么条件唤起?(可空,仅记录不调度)") ?? "";
    void apiPost(`/api/obligations/${encodeURIComponent(o.id)}/defer`, {
      reason: reason.trim(),
      ...(due.trim() ? { dueOrTrigger: due.trim() } : {})
    }).then(
      () => { setToast("已搁置"); load(); },
      (e: unknown) => setToast(String(e instanceof Error ? e.message : e))
    );
  };

  if (error) return <ErrorCard message="安排加载失败" detail={error} />;
  if (!rows) return null;

  const open = rows.filter((r) => !["resolved", "superseded"].includes(r.status));
  // 处理记录:已收尾/已被替代的回看(只读,按 updatedAt 倒序)
  const closedRows = rows
    .filter((r) => ["resolved", "superseded"].includes(r.status))
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const groups = (["human", "agent", "external"] as const).map((owner) => ({
    owner,
    items: open.filter((r) => r.owner === owner)
  }));

  return (
    <div className="flex flex-col gap-[var(--space-4)]" data-page="arrangements">
      <SectionTitle>安排</SectionTitle>
      {toast ? (
        <PaperCard><Mono>{toast}</Mono></PaperCard>
      ) : null}
      {groups.map((g) => (
        <PaperCard key={g.owner}>
          <SectionTitle>{GROUP_LABEL[g.owner]}({g.items.length})</SectionTitle>
          {g.items.length === 0 ? (
            <EmptyState icon={CalendarClock} text="这组现在空着" />
          ) : (
            <div className="flex flex-col" data-arr-group={g.owner}>
              {g.items.map((o) => (
                <div key={o.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }} data-arr-row={o.id}>
                  <div className="flex items-center justify-between gap-[12px]" style={{ flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{o.title}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                        <a href={`#/focus/${encodeURIComponent(o.focusId)}`} style={{ color: "inherit" }}>{o.focusTitle}</a>
                        {" · "}{KIND_LABEL[o.kind] ?? o.kind}{" · "}{STATUS_LABEL[o.status] ?? o.status}
                        {o.blocking ? " · 挡路" : ""}
                        {o.deferReason ? ` · 搁置:${o.deferReason}` : ""}
                        {o.dueOrTrigger ? ` · 唤起:${o.dueOrTrigger}` : ""}
                      </div>
                      {waitingText(o) ? (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-info)", marginTop: 2 }} data-arr-waiting>
                          {waitingText(o)}
                        </div>
                      ) : null}
                      {o.nextStep ? (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 2 }}>下一步:{o.nextStep}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-[6px]" style={{ flexShrink: 0 }}>
                      <button
                        type="button"
                        data-arr-resolve={o.id}
                        style={{ fontSize: "var(--text-xs)", padding: "4px 10px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}
                        onClick={() => { setResolving(resolving === o.id ? null : o.id); setForm({ resolution: "done", evidenceKind: "", evidenceRef: "" }); }}
                      >
                        收尾
                      </button>
                      <button
                        type="button"
                        data-arr-defer={o.id}
                        style={{ fontSize: "var(--text-xs)", padding: "4px 10px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}
                        onClick={() => doDefer(o)}
                      >
                        推迟
                      </button>
                    </div>
                  </div>
                  {resolving === o.id ? (
                    <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", background: "var(--surface-soft)" }} data-arr-resolve-form={o.id}>
                      <div className="flex items-center gap-[8px]" style={{ flexWrap: "wrap" }}>
                        <select
                          aria-label="收尾口径"
                          value={form.resolution}
                          onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value as ResolveForm["resolution"] }))}
                          style={{ fontSize: "var(--text-xs)", padding: "4px 6px" }}
                        >
                          <option value="done">办到了</option>
                          <option value="no_longer_applicable">不再适用</option>
                          <option value="abandoned">放弃</option>
                          <option value="superseded">已被替代</option>
                        </select>
                        <select
                          aria-label="依据类型"
                          value={form.evidenceKind}
                          onChange={(e) => setForm((f) => ({ ...f, evidenceKind: e.target.value as ResolveForm["evidenceKind"] }))}
                          style={{ fontSize: "var(--text-xs)", padding: "4px 6px" }}
                        >
                          <option value="">无依据</option>
                          <option value="artifact">产物(art:版本)</option>
                          <option value="task">任务(task:attempt)</option>
                          <option value="event">事件(focus:seq)</option>
                        </select>
                        {form.evidenceKind ? (
                          <input
                            aria-label="依据引用"
                            placeholder={form.evidenceKind === "artifact" ? "artifactId:版本号" : form.evidenceKind === "task" ? "taskId:attempt" : "focusId:seq"}
                            value={form.evidenceRef}
                            onChange={(e) => setForm((f) => ({ ...f, evidenceRef: e.target.value }))}
                            style={{ fontSize: "var(--text-xs)", padding: "4px 8px", border: "1px solid var(--line)", borderRadius: "var(--radius-2xs)", minWidth: 200 }}
                          />
                        ) : null}
                        <button
                          type="button"
                          data-arr-resolve-confirm={o.id}
                          style={{ fontSize: "var(--text-xs)", padding: "4px 12px", borderRadius: "var(--radius-xs)", border: "1px solid var(--active-ink)", background: "var(--active-ink)", color: "var(--active-ink-fg)", cursor: "pointer" }}
                          onClick={() => doResolve(o)}
                        >
                          确认收尾
                        </button>
                      </div>
                      {needEvidence(o, form.resolution) ? (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-warning)", marginTop: 6 }}>
                          Agent 义务判「办到了」必须挂依据——后端也会拦。
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </PaperCard>
      ))}
      {closedRows.length > 0 ? (
        <PaperCard>
          <button
            type="button"
            data-arr-history-toggle
            onClick={() => setShowHistory((v) => !v)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", textAlign: "left", display: "inline-flex", alignItems: "center", gap: 4 }}
            aria-expanded={showHistory}
          >
            {showHistory ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            处理记录({closedRows.length})
          </button>
          {showHistory ? (
            <div className="flex flex-col" data-arr-history>
              {closedRows.map((o) => (
                <div key={o.id} style={{ padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: "var(--text-xs)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{o.title}</span>
                  <span style={{ color: "var(--text-faint)" }}>
                    {" · "}{STATUS_LABEL[o.status] ?? o.status}{" · "}
                    <a href={`#/records/${encodeURIComponent(o.focusId)}`} style={{ color: "inherit" }}>{o.focusTitle}</a>
                    {" · "}{String(o.updatedAt).slice(0, 16)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </PaperCard>
      ) : null}
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
        已收尾/已被替代的义务不在上面的组里出现;想看完整历史去对应事的「记录」页。
      </div>
    </div>
  );
}
