// 批 3:Focus 详情「进展航迹」页(design-ref v5 ②页 + design-contract §2/§5)。
// 头卡 + 对话小节 + 航迹 grid(主线+lanes x 事件序,>30min 静默折叠) + 行末球权 + 三调整菜单 + gate 排队。

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ListChecks, MoreHorizontal } from "lucide-react";
import { apiGet, apiPost } from "../lib/api";
import { navigate } from "../lib/router";
import { EmptyState, ErrorCard, PaperCard } from "../components/ui";
import { TaskModal, type TaskModalTarget } from "../components/TaskModal";

// 合同 §10 renderer 人话表(航迹文案单源)
const EVENT_LABEL: Record<string, string> = {
  lane_split: "拆出线",
  lane_retired: "收起线",
  redo_from: "从某步重走",
  dependency_set: "排队等前置",
  dependency_woken: "前置落定,开跑",
  dependency_blocked: "前置已终止",
  lifecycle_changed: "生命周期变更",
  focus_forked: "续开新 Focus",
  artifact_linked: "登记产物",
  artifact_realized: "产物交付",
  obligation_opened: "记下一件事",
  obligation_resolved: "办结",
  obligation_status_changed: "状态变更",
  activation_started: "接上",
  activation_closed: "收尾",
  revision_settled: "方向更新",
  created: "立 Focus",
  correction: "更正",
  project_ref_added: "关联仓库",
  project_ref_removed: "解绑仓库",
  packet_frozen: "包冻结",
  packet_confirmed: "包确认",
  binding_authorized: "授权执行",
  binding_ledger_bound: "账本绑定",
  authority_transfer: "权威移交",
  close_settlement: "收场结算"
};

interface FocusDetailPayload {
  focus: {
    id: string;
    title: string;
    lifecycle: string;
    currentRevision: number;
    semanticAuthority: string;
    authorityEpoch: number;
    updatedAt: string;
    direction: string | null;
    openObligationCount: number;
    spaceId: string | null;
  };
  obligations: Array<{
    id: string;
    kind: string;
    title: string;
    owner: string;
    status: string;
    verification: string;
    blocking: boolean;
    nextStep: string | null;
    detail: string | null;
    needs: string | null;
    laneId: string | null;
    waitingOn: string | null;
    waitingOnObligationId: string | null;
    createdFromEvent: number | null;
    actionRef: string | null;
  }>;
  lanes: Array<{
    id: string;
    title: string;
    parentLaneId: string | null;
    createdFromEvent: number;
    retiredAt: string | null;
  }>;
  events: Array<{
    id: string;
    seq: number;
    type: string;
    payload: Record<string, unknown>;
    actorKind: string;
    sessionId: string | null;
    createdAt: string;
  }>;
  repos: Array<{ projectId: string; note: string | null }>;
  artifacts: Array<{ id: string; kind: string; role: string; title: string; ref: unknown }>;
}

interface SessionRow {
  id: string;
  state: string;
  startedAt: string;
  closedAt: string | null;
  summary: string | null;
}

interface AttentionItem {
  id: string;
  color: "orange" | "blue" | "green" | "gray";
  title: string;
  focusId: string | null;
  action: string;
  needs?: string | null;
  laneId?: string | null;
  sourceKind?: "confirmation" | "obligation" | "task";
  refId?: string;
  sessionId?: string;
  projectId?: string;
}

const BALL: Record<string, string> = {
  orange: "var(--color-warning)",
  blue: "var(--active-ink)",
  green: "var(--color-success)",
  gray: "var(--text-faint)"
};

const ACTOR_BAR: Record<string, string> = {
  user: "var(--color-warning)",
  daemon: "var(--color-success)",
  brain_proposal: "var(--color-success)"
};

const SILENCE_MS = 30 * 60 * 1000;

function eventSpoken(type: string, payload: Record<string, unknown>): string {
  const base = EVENT_LABEL[type] ?? type;
  if (type === "lane_split") {
    const titles = Array.isArray(payload.titles) ? (payload.titles as string[]).join("、") : "";
    return titles ? `拆出线:${titles}` : base;
  }
  if (type === "lane_retired") {
    return `收起线「${String(payload.title ?? "")}」,结掉 ${Array.isArray(payload.resolvedIds) ? payload.resolvedIds.length : 0} 件`;
  }
  if (type === "redo_from") {
    return `从第 ${String(payload.anchorSeq ?? "?")} 步重走,作废 ${Array.isArray(payload.supersededIds) ? payload.supersededIds.length : 0} 件`;
  }
  if (type === "obligation_opened") return `记下一件事:${String(payload.title ?? "")}`;
  if (type === "obligation_resolved") {
    // J13:payload 无 title 时不裸露 fob_ id,退成通用人话
    return payload.title ? `办结:${String(payload.title)}` : "办结一件事";
  }
  if (type === "dependency_set") {
    return `「${String(payload.depTitle ?? "")}」排队等「${String(payload.preTitle ?? "")}」`;
  }
  if (type === "dependency_woken") {
    return `「${String(payload.preTitle ?? "")}」落定,「${String(payload.depTitle ?? "")}」开跑`;
  }
  if (type === "dependency_blocked") {
    return `前置已终止:「${String(payload.depTitle ?? "")}」搁置`;
  }
  if (type === "lifecycle_changed") {
    // J13:内部态名/reason 不裸露,人话映射
    const lcWord = (v: string): string =>
      ((
        {
          active: "进行中",
          captured: "刚建",
          dormant: "睡眠等外部",
          closed: "已收官",
          archived: "归档",
          abandoned: "已放弃"
        } as Record<string, string>
      )[v] ?? v);
    const reasonWord = (v: string): string =>
      ((
        {
          first_activation: "第一次开工",
          activation: "接续开工",
          reopen: "重新打开",
          pause: "先放一放"
        } as Record<string, string>
      )[v] ?? v);
    const reason = payload.reason ? `(${reasonWord(String(payload.reason))})` : "";
    return `${lcWord(String(payload.from ?? ""))} → ${lcWord(String(payload.to ?? ""))}${reason}`;
  }
  if (type === "artifact_realized" || type === "artifact_linked") {
    return `${base}「${String(payload.title ?? "")}」`;
  }
  if (type === "revision_settled") return `方向 v${String(payload.revision ?? "")}`;
  return base;
}

/** 事件归属哪条线(主线=null):按 payload.laneId / obligation 反查 / 默认主线 */
function eventLaneId(
  ev: FocusDetailPayload["events"][0],
  obsById: Map<string, FocusDetailPayload["obligations"][0]>
): string | null {
  const p = ev.payload;
  if (typeof p.laneId === "string") return p.laneId;
  if (Array.isArray(p.laneIds) && p.laneIds.length === 1) return p.laneIds[0] as string;
  // lane_split 本身显示在主线
  if (ev.type === "lane_split") return null;
  const oid = typeof p.obligationId === "string" ? p.obligationId : null;
  if (oid) {
    const o = obsById.get(oid);
    if (o?.laneId) return o.laneId;
  }
  if (Array.isArray(p.obligationIds)) {
    for (const id of p.obligationIds as string[]) {
      const o = obsById.get(id);
      if (o?.laneId) return o.laneId;
    }
  }
  return null;
}

type Col =
  | { kind: "event"; event: FocusDetailPayload["events"][0] }
  | { kind: "silence"; hours: number; key: string };

function buildColumns(events: FocusDetailPayload["events"]): Col[] {
  if (events.length === 0) return [];
  const cols: Col[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    if (i > 0) {
      const prev = events[i - 1]!;
      const dt = Date.parse(ev.createdAt) - Date.parse(prev.createdAt);
      if (Number.isFinite(dt) && dt > SILENCE_MS) {
        const hours = Math.round(dt / 3600000);
        cols.push({ kind: "silence", hours: Math.max(1, hours), key: `sil-${prev.seq}-${ev.seq}` });
      }
    }
    cols.push({ kind: "event", event: ev });
  }
  return cols;
}

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px",
  borderRadius: "var(--radius-pill)",
  fontSize: "var(--text-xs, 12px)",
  border: "1px solid var(--line)",
  color: "var(--text-secondary)"
};

const btnPrimary: CSSProperties = {
  background: "var(--active-ink)",
  color: "var(--active-ink-fg)",
  border: "none",
  borderRadius: "var(--radius-xs)",
  height: 36,
  padding: "0 14px",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  cursor: "pointer"
};

const btnGhost: CSSProperties = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-xs)",
  height: 32,
  padding: "0 12px",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
};

export function FocusDetail({ focusId }: { focusId: string }) {
  const [data, setData] = useState<FocusDetailPayload | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [spaces, setSpaces] = useState<Array<{ id: string; title: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [menuLane, setMenuLane] = useState<string | null>(null);
  const [modal, setModal] = useState<TaskModalTarget | null>(null);
  // 航迹方向(义骁 8/6:窄屏横向滚动费劲)——窄屏默认纵向,可手动切换
  const [trackDir, setTrackDir] = useState<"h" | "v">(() =>
    typeof window !== "undefined" && window.innerWidth < 900 ? "v" : "h"
  );
  // 线菜单 outside-click 关闭(义骁 8/6:菜单点开收不起来)
  useEffect(() => {
    if (!menuLane) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-lane-menu]")) setMenuLane(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuLane]);

  const load = useCallback(async () => {
    const [d, sess, att, sp] = await Promise.all([
      apiGet<FocusDetailPayload>(`/api/focuses/${encodeURIComponent(focusId)}`),
      apiGet<{ sessions: SessionRow[] }>(`/api/focuses/${encodeURIComponent(focusId)}/sessions`).catch(() => ({
        sessions: [] as SessionRow[]
      })),
      apiGet<{ items: AttentionItem[] }>("/api/attention").catch(() => ({ items: [] as AttentionItem[] })),
      apiGet<{ spaces: Array<{ id: string; title: string }> }>("/api/spaces").catch(() => ({
        spaces: [] as Array<{ id: string; title: string }>
      }))
    ]);
    setData(d);
    setSessions(sess.sessions);
    setAttention(att.items.filter((i) => i.focusId === focusId));
    setSpaces(sp.spaces ?? []);
  }, [focusId]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(() => {
        if (cancelled) return;
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const obsById = useMemo(() => {
    const m = new Map<string, FocusDetailPayload["obligations"][0]>();
    for (const o of data?.obligations ?? []) m.set(o.id, o);
    return m;
  }, [data]);

  const columns = useMemo(() => buildColumns(data?.events ?? []), [data]);

  const rows = useMemo(() => {
    if (!data) return [] as Array<{ key: string; title: string; laneId: string | null; retired: boolean }>;
    const main = { key: "main", title: "主线", laneId: null as string | null, retired: false };
    const lanes = data.lanes.map((l) => ({
      key: l.id,
      title: l.title,
      laneId: l.id as string | null,
      retired: l.retiredAt != null
    }));
    return [main, ...lanes];
  }, [data]);

  if (error) return <ErrorCard message="加载 Focus 详情失败" detail={error} />;
  if (!data) return null;

  const expectedArts = data.artifacts.filter((a) => a.role === "expected" || a.role === "deliverable");

  const ballForLane = (laneId: string | null): AttentionItem | null => {
    const mine = attention.filter((i) => (i.laneId ?? null) === laneId);
    // 主线也收无 lane 的 attention
    const pool =
      laneId === null
        ? attention.filter((i) => !i.laneId)
        : mine;
    return pool.find((i) => i.color === "orange") ?? pool.find((i) => i.color === "blue") ?? pool[0] ?? null;
  };

  const waitingGates = (laneId: string | null) =>
    data.obligations.filter(
      (o) =>
        o.status === "waiting" &&
        o.waitingOn &&
        (o.laneId ?? null) === laneId
    );

  const openTrackModal = (it: AttentionItem) => {
    if (it.sourceKind === "task" && it.refId) {
      setModal({ kind: "task", id: it.refId, title: it.title, focusId, projectId: it.projectId });
    } else if (it.sourceKind === "confirmation" && it.refId) {
      setModal({ kind: "confirmation", receiptId: it.refId, title: it.title, sessionId: it.sessionId, focusId });
    } else if (it.refId) {
      setModal({
        kind: "obligation",
        id: it.refId,
        title: it.title,
        needs: it.needs,
        focusId
      });
    }
  };

  const retireLane = async (laneId: string) => {
    if (!window.confirm("收起这条线?未结的事会按「不再需要」作废。")) return;
    await apiPost(`/api/focuses/${encodeURIComponent(focusId)}/lanes/${encodeURIComponent(laneId)}/retire`, {});
    setMenuLane(null);
    await load();
  };

  const redoFrom = async (laneId: string) => {
    const anchorRaw = window.prompt("从第几步重走?(填事件序号 seq)", "0");
    if (anchorRaw == null) return;
    const anchorSeq = Number(anchorRaw);
    if (!Number.isFinite(anchorSeq) || anchorSeq < 0) return;
    // 先 preview 拿建议集
    const prev = await apiPost<{
      ok: true;
      preview?: boolean;
      suggestedIds?: string[];
      unknownOrigin?: Array<{ id: string; title: string }>;
    }>(`/api/focuses/${encodeURIComponent(focusId)}/lanes/${encodeURIComponent(laneId)}/redo-from`, {
      anchorSeq
    });
    const suggested = prev.suggestedIds ?? [];
    const unknown = prev.unknownOrigin ?? [];
    const msg =
      `建议作废 ${suggested.length} 件` +
      (unknown.length ? `;另有 ${unknown.length} 件无起源不自动入集` : "") +
      `。确认按建议集执行?`;
    if (!window.confirm(msg)) return;
    await apiPost(`/api/focuses/${encodeURIComponent(focusId)}/lanes/${encodeURIComponent(laneId)}/redo-from`, {
      anchorSeq,
      supersededIds: suggested
    });
    setMenuLane(null);
    // 整线重来=前端组合:retire 后引导开新对话——这里 redo 后提示
    window.alert("已作废勾选集。若要整线重来,可再「收起线」后开新对话让 AI 重拆。");
    await load();
  };

  return (
    <div data-page="focus-detail" className="flex flex-col gap-[var(--space-4)]">
      <div>
        <a href="#/board" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          返回看板
        </a>
        <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }} data-focus-title>
          {data.focus.title}
        </h1>
      </div>

      {/* 头卡 */}
      <PaperCard>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontWeight: 600 }}>方向</span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {data.focus.direction ?? "尚未写下方向"}
          </span>
          <span style={chip}>方向 v{data.focus.currentRevision}</span>
          <span style={chip}>账上 {data.focus.openObligationCount} 件</span>
          <span style={chip}>
            {({ active: "进行中", captured: "刚建", dormant: "睡眠·等外部", closed: "已收官", archived: "归档", abandoned: "已放弃" } as Record<string, string>)[
              data.focus.lifecycle
            ] ?? data.focus.lifecycle}
          </span>
        </div>
        {/* W1:归档/重开/归空间入口(API 早有,UI 补挂) */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            归空间:
            <select
              value={data.focus.spaceId ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : e.target.value;
                void apiPost(`/api/focuses/${encodeURIComponent(focusId)}/space`, { spaceId: v })
                  .then(() => load())
                  .catch((err2: unknown) => setError(err2 instanceof Error ? err2.message : String(err2)));
              }}
              style={{ marginLeft: 6 }}
            >
              <option value="">暂不归</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          {data.focus.lifecycle === "archived" ? (
            <button
              type="button"
              style={btnGhost}
              onClick={() => {
                void apiPost(`/api/focuses/${encodeURIComponent(focusId)}/reopen`, {})
                  .then(() => load())
                  .catch((err2: unknown) => setError(err2 instanceof Error ? err2.message : String(err2)));
              }}
            >
              重新打开
            </button>
          ) : data.focus.lifecycle === "active" || data.focus.lifecycle === "captured" ? (
            <button
              type="button"
              style={btnGhost}
              onClick={() => {
                const reason = window.prompt("归档理由(会记在案):", "中途放下,回头再说") ?? "";
                if (!reason.trim()) return;
                void apiPost(`/api/focuses/${encodeURIComponent(focusId)}/archive`, { reason: reason.trim() })
                  .then(() => load())
                  .catch((err2: unknown) => setError(err2 instanceof Error ? err2.message : String(err2)));
              }}
            >
              归档
            </button>
          ) : null}
        </div>
        {data.repos.length > 0 ? (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 8 }}>
            关联仓库:{data.repos.map((r) => r.projectId).join(", ")}
          </div>
        ) : null}
        {expectedArts.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {expectedArts.map((a) => (
              <span key={a.id} style={chip} title={a.role}>
                {a.role === "deliverable" ? "[交付]" : "[预期]"} {a.title}
              </span>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            // L6:续推真锚定——pendingAnchor 交 Chat 页消费(POST /api/sessions/:id/focus-anchor)
            sessionStorage.setItem(
              "saydo.chat.pendingAnchor",
              JSON.stringify({ focusId, title: data.focus.title })
            );
            navigate("/chat");
          }}
        >
          开新对话续推
        </button>
      </PaperCard>

      {/* 对话小节 */}
      <PaperCard>
        <h2 style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: 8 }}>对话</h2>
        {sessions.length === 0 ? (
          <EmptyState icon={ListChecks} text="还没有关联这场 Focus 的对话" />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="flex flex-col gap-[6px]">
            {sessions.map((s) => (
              <li key={s.id} style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {s.state} · {new Date(s.startedAt).toLocaleString()}
                {s.closedAt ? ` → ${new Date(s.closedAt).toLocaleString()}` : " (进行中)"}
                {s.summary ? ` · ${s.summary}` : ""}
              </li>
            ))}
          </ul>
        )}
      </PaperCard>

      {/* 航迹 */}
      <PaperCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: "var(--text-md)", fontWeight: 600, margin: 0 }}>进展航迹</h2>
          <button
            type="button"
            style={{ ...btnGhost, height: 28, padding: "0 10px", fontSize: "var(--text-xs)" }}
            onClick={() => setTrackDir(trackDir === "h" ? "v" : "h")}
          >
            {trackDir === "h" ? "切纵向" : "切横向"}
          </button>
        </div>
        {columns.length === 0 ? (
          <EmptyState icon={ListChecks} text="还没有账上事件" />
        ) : trackDir === "v" ? (
          /* 纵向航迹(义骁 8/6 提议:窄屏横滚费劲)——时间从上往下,线为列;窄屏默认此向 */
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${rows.length}, minmax(170px, 1fr))`,
                gap: 6,
                minWidth: rows.length * 170
              }}
            >
              {rows.map((row) => (
                <div
                  key={`vh-${row.key}`}
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    opacity: row.retired ? 0.5 : 1,
                    borderBottom: "1px solid var(--line)",
                    paddingBottom: 6
                  }}
                >
                  {row.title}
                  {row.laneId && !row.retired ? (
                    <div style={{ position: "relative" }} data-lane-menu>
                      <button
                        type="button"
                        aria-label="线菜单"
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, color: "var(--text-secondary)" }}
                        onClick={() => setMenuLane(menuLane === row.laneId ? null : row.laneId)}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {menuLane === row.laneId ? (
                        <div
                          style={{
                            position: "absolute",
                            zIndex: 20,
                            top: 22,
                            left: 0,
                            background: "var(--surface-raised)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius-xs)",
                            padding: 6,
                            minWidth: 140,
                            boxShadow: "var(--shadow-card-hover)"
                          }}
                        >
                          <button type="button" style={{ display: "block", width: "100%", textAlign: "left", ...menuBtn }} onClick={() => void retireLane(row.laneId!)}>
                            收起线
                          </button>
                          <button type="button" style={{ display: "block", width: "100%", textAlign: "left", ...menuBtn }} onClick={() => void redoFrom(row.laneId!)}>
                            从某步重走
                          </button>
                          <button
                            type="button"
                            style={{ display: "block", width: "100%", textAlign: "left", ...menuBtn }}
                            onClick={() => {
                              setMenuLane(null);
                              sessionStorage.setItem(
                                "saydo.chat.pendingAnchor",
                                JSON.stringify({ focusId, title: data.focus.title, laneTitle: row.title })
                              );
                              navigate("/chat");
                            }}
                          >
                            在此线续推
                          </button>
                          <button
                            type="button"
                            style={{ display: "block", width: "100%", textAlign: "left", ...menuBtn }}
                            onClick={() => {
                              setMenuLane(null);
                              if (window.confirm("整线重来:先收起本线,再开新对话让 AI 重拆。现在收起?")) {
                                void retireLane(row.laneId!).then(() => navigate("/chat"));
                              }
                            }}
                          >
                            整线重来
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
              {columns.map((c) =>
                c.kind === "silence" ? (
                  <div
                    key={`v-${c.key}`}
                    style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: 11, fontStyle: "italic", color: "var(--text-faint)" }}
                  >
                    +{c.hours}h 静默
                  </div>
                ) : (
                  rows.map((row) => {
                    const belongs = eventLaneId(c.event, obsById) === row.laneId;
                    const show =
                      belongs ||
                      (row.laneId === null &&
                        (eventLaneId(c.event, obsById) === null ||
                          c.event.type === "lane_split" ||
                          c.event.type === "created" ||
                          c.event.type === "lifecycle_changed" ||
                          c.event.type === "revision_settled"));
                    if (!show) return <div key={`v-${row.key}-${c.event.id}`} />;
                    const bar = ACTOR_BAR[c.event.actorKind] ?? "var(--text-faint)";
                    return (
                      <div
                        key={`v-${row.key}-${c.event.id}`}
                        style={{
                          borderLeft: `3px solid ${bar}`,
                          background: "var(--surface-ink-wash)",
                          borderRadius: "var(--radius-2xs)",
                          padding: "6px 8px",
                          fontSize: 12,
                          lineHeight: 1.35
                        }}
                        title={c.event.type}
                      >
                        <span style={{ color: "var(--text-faint)", marginRight: 4 }}>#{c.event.seq}</span>
                        {eventSpoken(c.event.type, c.event.payload)}
                      </div>
                    );
                  })
                )
              )}
              {rows.map((row) => {
                const ball = ballForLane(row.laneId);
                const gates = waitingGates(row.laneId);
                return (
                  <div key={`vb-${row.key}`} style={{ borderTop: "1px dashed var(--line)", paddingTop: 6 }}>
                    {ball ? (
                      <button
                        type="button"
                        onClick={() => openTrackModal(ball)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: `1px solid ${BALL[ball.color]}`,
                          borderRadius: "var(--radius-xs)",
                          padding: "6px 8px",
                          background: "transparent",
                          cursor: "pointer",
                          fontSize: 12
                        }}
                      >
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "var(--radius-pill)", background: BALL[ball.color], marginRight: 6 }} />
                        {ball.title}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-faint)" }}>—</span>
                    )}
                    {gates.map((g) => (
                      <div
                        key={g.id}
                        style={{ marginTop: 6, border: "1px dashed var(--line)", borderRadius: "var(--radius-xs)", padding: "6px 8px", fontSize: 11, color: "var(--text-secondary)" }}
                      >
                        排队:{g.title} 等:{g.waitingOn}——那边一落定,这边自动开跑
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `120px repeat(${columns.length}, minmax(100px, 1fr)) 140px`,
                gap: 6,
                minWidth: 120 + columns.length * 100 + 140
              }}
            >
              {/* 表头 */}
              <div />
              {columns.map((c) =>
                c.kind === "silence" ? (
                  <div
                    key={c.key}
                    style={{
                      fontSize: 11,
                      fontStyle: "italic",
                      color: "var(--text-faint)",
                      textAlign: "center"
                    }}
                  >
                    +{c.hours}h 静默
                  </div>
                ) : (
                  <div
                    key={c.event.id}
                    style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}
                  >
                    #{c.event.seq}
                  </div>
                )
              )}
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>当前</div>

              {rows.map((row) => {
                const ball = ballForLane(row.laneId);
                const gates = waitingGates(row.laneId);
                return (
                  <div key={row.key} style={{ display: "contents" }}>
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        opacity: row.retired ? 0.5 : 1
                      }}
                    >
                      {row.title}
                      {row.laneId && !row.retired ? (
                        <div style={{ position: "relative" }} data-lane-menu>
                          <button
                            type="button"
                            aria-label="线菜单"
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              padding: 2,
                              color: "var(--text-secondary)"
                            }}
                            onClick={() => setMenuLane(menuLane === row.laneId ? null : row.laneId)}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {menuLane === row.laneId ? (
                            <div
                              style={{
                                position: "absolute",
                                zIndex: 20,
                                top: 22,
                                left: 0,
                                background: "var(--surface-raised)",
                                border: "1px solid var(--line)",
                                borderRadius: "var(--radius-xs)",
                                padding: 6,
                                minWidth: 140,
                                boxShadow: "var(--shadow-card-hover)"
                              }}
                            >
                              <button
                                type="button"
                                style={{ display: "block", width: "100%", textAlign: "left", ...menuBtn }}
                                onClick={() => void retireLane(row.laneId!)}
                              >
                                收起线
                              </button>
                              <button
                                type="button"
                                style={{ display: "block", width: "100%", textAlign: "left", ...menuBtn }}
                                onClick={() => void redoFrom(row.laneId!)}
                              >
                                从某步重走
                              </button>
                              <button
                                type="button"
                                style={{ display: "block", width: "100%", textAlign: "left", ...menuBtn }}
                                onClick={() => {
                                  // L5(义骁 8/6 提议):lane 级续推——新会话内容默认挂本线
                                  setMenuLane(null);
                                  sessionStorage.setItem(
                                    "saydo.chat.pendingAnchor",
                                    JSON.stringify({ focusId, title: data.focus.title, laneTitle: row.title })
                                  );
                                  navigate("/chat");
                                }}
                              >
                                在此线续推
                              </button>
                              <button
                                type="button"
                                style={{ display: "block", width: "100%", textAlign: "left", ...menuBtn }}
                                onClick={() => {
                                  setMenuLane(null);
                                  if (
                                    window.confirm(
                                      "整线重来:先收起本线,再开新对话让 AI 重拆。现在收起?"
                                    )
                                  ) {
                                    void retireLane(row.laneId!).then(() => navigate("/chat"));
                                  }
                                }}
                              >
                                整线重来
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {columns.map((c) => {
                      if (c.kind === "silence") {
                        return <div key={`${row.key}-${c.key}`} />;
                      }
                      const belongs = eventLaneId(c.event, obsById) === row.laneId;
                      // 主线也显示全局/无 lane 事件
                      const show =
                        belongs ||
                        (row.laneId === null &&
                          (eventLaneId(c.event, obsById) === null ||
                            c.event.type === "lane_split" ||
                            c.event.type === "created" ||
                            c.event.type === "lifecycle_changed" ||
                            c.event.type === "revision_settled"));
                      if (!show) return <div key={`${row.key}-${c.event.id}`} />;
                      const bar = ACTOR_BAR[c.event.actorKind] ?? "var(--text-faint)";
                      return (
                        <div
                          key={`${row.key}-${c.event.id}`}
                          style={{
                            borderLeft: `3px solid ${bar}`,
                            background: "var(--surface-ink-wash)",
                            borderRadius: "var(--radius-2xs)",
                            padding: "6px 8px",
                            fontSize: 12,
                            lineHeight: 1.35
                          }}
                          title={c.event.type}
                        >
                          {eventSpoken(c.event.type, c.event.payload)}
                        </div>
                      );
                    })}
                    <div>
                      {ball ? (
                        <button
                          type="button"
                          onClick={() => openTrackModal(ball)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            border: `1px solid ${BALL[ball.color]}`,
                            borderRadius: "var(--radius-xs)",
                            padding: "6px 8px",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: 12
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "var(--radius-pill)",
                              background: BALL[ball.color],
                              marginRight: 6
                            }}
                          />
                          {ball.title}
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>—</span>
                      )}
                      {gates.map((g) => (
                        <div
                          key={g.id}
                          style={{
                            marginTop: 6,
                            border: "1px dashed var(--line)",
                            borderRadius: "var(--radius-xs)",
                            padding: "6px 8px",
                            fontSize: 11,
                            color: "var(--text-secondary)"
                          }}
                        >
                          排队:{g.title} 等:{g.waitingOn}——那边一落定,这边自动开跑
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PaperCard>

      {modal ? (
        <TaskModal target={modal} onClose={() => setModal(null)} onDone={() => void load()} />
      ) : null}
    </div>
  );
}

const menuBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "6px 8px",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  color: "var(--text-primary)"
};
