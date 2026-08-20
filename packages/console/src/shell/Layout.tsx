// 控制台外壳(11 §3 + 批次② 三面一栏 IA + 义骁 8/8 壳对齐轮:视觉照抄 redesign demo 规范):
// 侧栏 = 品牌标 + 开口聊主 CTA + 今天/全景看板 + 正在持续的事(空间分组可折叠) + 记录 + 旧版(折叠) + 底部署名;
// 顶栏 = 语音会话指示 pill + 通知铃(回叫时间线/免打扰/邮件预览 P1) + 密度 + 主题。
// 数字徽章全站单源 = attention(v4 R5):今天=橙计数;Focus 热点=该 focus 橙+蓝。

import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Database,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  Mail,
  Mic,
  Moon,
  Package,
  Rows3,
  Rows4,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sun,
  Wallet,
  Inbox
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ProjectCard } from "../lib/api";
import { apiGet } from "../lib/api";
import { navigate, switchProjectHash, type Route } from "../lib/router";
import { useVoice } from "./VoiceContext";
import { EmailPreviewModal } from "../components/redesign/Modals";
import { PairingOverlay } from "../components/PairingOverlay";
import { currentPairingToken, fetchPairingInfo, type PairingInfo } from "../lib/pairing";
import { formatAttnTime } from "../components/redesign/AttentionItemCard";
import { StageTag } from "../components/redesign/shared";
import saydoMark from "../assets/saydo-mark.png";

interface AttentionItem {
  id: string;
  color: "orange" | "blue" | "green" | "gray";
  focusId: string | null;
  title: string;
}

interface FocusRow {
  id: string;
  title: string;
  lifecycle: string;
  updatedAt: string;
  openByOwner?: { human: number; agent: number; external: number };
  spaceId?: string | null;
}

interface SpaceRow {
  id: string;
  title: string;
}

interface OutboxRow {
  id: string;
  trigger: string;
  state: string;
  task_title?: string | null;
  notified_at?: string | null;
  created_at?: string | null;
}

/** 回叫 trigger → 用户语(状态词三级纪律:只说收到/等你验收/已交付) */
const TRIGGER_LABEL: Record<string, string> = {
  ready_for_review: "等你验收",
  blocked: "卡住需要你",
  failed: "失败了",
  approval_request: "审批等你拍板",
  step_boundary: "等你确认这一步",
  parked_expired: "停靠到期",
  subscription_stalled: "订阅额度异常"
};

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  disabled,
  badge,
  faint
}: {
  href: string;
  icon?: typeof Inbox;
  label: string;
  active: boolean;
  disabled?: boolean;
  badge?: number;
  faint?: boolean;
}) {
  return (
    <a
      href={disabled ? undefined : `#${href}`}
      aria-disabled={disabled}
      data-nav={href}
      className="flex items-center gap-[10px] rounded-[var(--radius-xs)] px-[10px] py-[7px] no-underline"
      style={{
        color: disabled
          ? "var(--text-faint)"
          : active
            ? "var(--active-ink)"
            : faint
              ? "var(--text-faint)"
              : "var(--text-secondary)",
        background: active ? "var(--selected-wash)" : "transparent",
        fontSize: "var(--text-sm)",
        pointerEvents: disabled ? "none" : undefined,
        fontWeight: active ? 500 : undefined
      }}
    >
      {Icon ? <Icon size={16} aria-hidden style={{ flexShrink: 0 }} /> : null}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {badge !== undefined && badge > 0 ? (
        <span
          data-nav-badge
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1,
            padding: "3px 7px",
            borderRadius: "var(--radius-pill)",
            background: "var(--active-ink)",
            color: "var(--active-ink-fg)",
            flexShrink: 0
          }}
        >
          {badge}
        </span>
      ) : null}
    </a>
  );
}

function FocusNavItem({
  focus,
  hotCount,
  active
}: {
  focus: FocusRow;
  hotCount: number;
  active: boolean;
}) {
  const human = focus.openByOwner?.human ?? 0;
  const hot = hotCount > 0;
  // 有 human 未结(或 attention 橙/蓝热点)→ warning;否则按 lifecycle
  const hasHumanOpen = human > 0 || hot;
  let dot = "var(--text-faint)";
  if (focus.lifecycle === "active") {
    dot = hasHumanOpen ? "var(--color-warning)" : "var(--color-success)";
  } else if (focus.lifecycle === "captured") {
    dot = hasHumanOpen ? "var(--color-warning)" : "var(--color-info)";
  } else if (focus.lifecycle === "dormant") {
    dot = "var(--text-faint)";
  }

  return (
    <a
      href={`#/focus/${encodeURIComponent(focus.id)}`}
      data-nav-focus={focus.id}
      className="flex items-center gap-[10px] rounded-[var(--radius-xs)] px-[10px] py-[7px] no-underline"
      style={{
        color: active ? "var(--active-ink)" : "var(--text-secondary)",
        background: active ? "var(--selected-wash)" : "transparent",
        fontSize: "var(--text-sm)",
        fontWeight: active ? 500 : undefined
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "var(--radius-pill)",
          flexShrink: 0,
          background: dot
        }}
      />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {focus.title}
      </span>
      {hotCount > 0 ? (
        <span
          data-focus-hot-badge
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1,
            padding: "3px 7px",
            borderRadius: "var(--radius-pill)",
            background: "var(--color-warning)",
            color: "var(--active-ink-fg)",
            flexShrink: 0
          }}
        >
          {hotCount}
        </span>
      ) : null}
    </a>
  );
}

const secLabel: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--text-muted)",
  margin: "12px 0 4px 10px",
  letterSpacing: "0.4px"
};

function SpaceSection({ title, collapsed, onToggle }: { title: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-space-col={title}
      onClick={onToggle}
      className="flex items-center gap-[4px] border-0 bg-transparent"
      style={{
        fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "12px 0 4px 6px",
        letterSpacing: "0.4px", cursor: "pointer", padding: "2px 4px", borderRadius: "var(--radius-2xs)", textAlign: "left"
      }}
    >
      {collapsed ? <ChevronRight size={11} aria-hidden /> : <ChevronDown size={11} aria-hidden />}
      {title}
    </button>
  );
}

export function Layout({
  route,
  projects,
  children,
  banner
}: {
  route: Route;
  projects: ProjectCard[];
  children: ReactNode;
  /** 顶栏之上的全局提示条(首启未配模型时用);无则不占位 */
  banner?: ReactNode;
}) {
  const voice = useVoice();
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("saydo.theme") ?? "");
  const [dnd, setDnd] = useState(false);
  const [compact, setCompact] = useState<boolean>(() => localStorage.getItem("saydo.density") === "compact");
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [focuses, setFocuses] = useState<FocusRow[]>([]);
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [spaceCollapsed, setSpaceCollapsed] = useState<Record<string, boolean>>({});
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);

  const openPairing = useCallback(() => {
    setBellOpen(false);
    setEmailOpen(false);
    setPairingOpen(true);
    setPairingInfo(null);
    setPairingError(null);
    void fetchPairingInfo()
      .then((info) => {
        setPairingInfo(info);
      })
      .catch((err: unknown) => {
        setPairingError(err instanceof Error ? err.message : "读取配对信息失败");
      });
  }, []);

  const closePairing = useCallback(() => {
    setPairingOpen(false);
  }, []);

  const loadAttentionOutbox = useCallback(async () => {
    try {
      const [at, ob] = await Promise.all([
        apiGet<{ items: AttentionItem[] }>("/api/attention").catch(() => ({ items: [] as AttentionItem[] })),
        apiGet<OutboxRow[]>("/api/outbox").catch(() => [] as OutboxRow[])
      ]);
      setAttention(at.items ?? []);
      setOutbox(Array.isArray(ob) ? ob : []);
    } catch {
      // 侧栏徽章降级:静默
    }
  }, []);

  const loadFocusSpaces = useCallback(async () => {
    try {
      const [fo, sp] = await Promise.all([
        apiGet<FocusRow[]>("/api/focuses").catch(() => [] as FocusRow[]),
        apiGet<{ spaces: SpaceRow[] }>("/api/spaces").catch(() => ({ spaces: [] as SpaceRow[] }))
      ]);
      setFocuses(fo ?? []);
      setSpaces(sp.spaces ?? []);
    } catch {
      // 侧栏徽章降级:静默
    }
  }, []);

  const loadSide = useCallback(async () => {
    await Promise.all([loadAttentionOutbox(), loadFocusSpaces()]);
  }, [loadAttentionOutbox, loadFocusSpaces]);

  useEffect(() => {
    void loadAttentionOutbox();
    const t = setInterval(() => void loadAttentionOutbox(), 10_000);
    return () => clearInterval(t);
  }, [loadAttentionOutbox]);

  useEffect(() => {
    void loadFocusSpaces();
    const t = setInterval(() => void loadFocusSpaces(), 30_000);
    return () => clearInterval(t);
  }, [loadFocusSpaces]);

  // L4(2026-08-09):同页感知 focus 创建/变更——复用既有 ws 的 focus.entity 事件
  // (记下一件事/办结/方向更新等落账后才发射;entities 新在前,首项 id 变即有新卡),
  // 到达即刷侧栏;outbox/attention 10s 轮询,focus/spaces 仍 30s,不发明新通道
  const latestEntityId = voice.entities[0]?.id ?? null;
  useEffect(() => {
    if (latestEntityId !== null) void loadSide();
  }, [latestEntityId, loadSide]);

  // 路由变化时刷新侧栏(ack / 处置后回栏)
  useEffect(() => {
    void loadSide();
  }, [route.page, route.focusId, loadSide]);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
    if (theme) localStorage.setItem("saydo.theme", theme);
  }, [theme]);
  useEffect(() => {
    if (compact) document.documentElement.setAttribute("data-density", "compact");
    else document.documentElement.removeAttribute("data-density");
    localStorage.setItem("saydo.density", compact ? "compact" : "comfortable");
  }, [compact]);

  // 铃铛 dropdown 外点关闭
  useEffect(() => {
    if (!bellOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [bellOpen]);

  const pid = route.projectId ?? voice.anchorProjectId ?? undefined;
  const current = projects.find((p) => p.id === pid);
  const inProject = (page: string) => route.projectId !== undefined && route.page === page;

  // 徽章单源 = attention:今天=橙计数;Focus 热点=该 focus 橙+蓝
  const orangeCount = useMemo(() => attention.filter((a) => a.color === "orange").length, [attention]);
  const hotByFocus = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attention) {
      if ((a.color === "orange" || a.color === "blue") && a.focusId) {
        m.set(a.focusId, (m.get(a.focusId) ?? 0) + 1);
      }
    }
    return m;
  }, [attention]);

  // 正在持续的事:空间分组(可折叠);无空间归最后平铺
  const liveFocuses = useMemo(
    () =>
      focuses
        .filter((f) => ["active", "captured", "dormant"].includes(f.lifecycle))
        .slice()
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
    [focuses]
  );
  const spaceGroups = useMemo(() => {
    const named = spaces
      .map((sp) => ({ sp, items: liveFocuses.filter((f) => f.spaceId === sp.id) }))
      .filter((g) => g.items.length > 0);
    const unspaced = liveFocuses.filter((f) => !f.spaceId || !spaces.some((s) => s.id === f.spaceId));
    return { named, unspaced };
  }, [spaces, liveFocuses]);
  const unread = useMemo(() => outbox.filter((o) => o.state === "pending" || o.state === "notified").length, [outbox]);
  const voiceAnchored = !!(voice.connected && voice.anchorProjectId);

  const legacyActive =
    route.page === "dashboard" ||
    route.page === "approvals" ||
    route.page === "notify" ||
    route.page === "tasks" ||
    route.page === "task" ||
    route.page === "focuses" ||
    route.page === "legacy-board" ||
    route.page === "legacy-focus";

  return (
    <div className="flex min-h-screen">
      <div className="canvas-atmosphere" />
      {/* 侧栏 */}
      <aside
        className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
        style={{
          // 纸上账本:结构区与画布同为宣纸,靠墨线分隔(与移动菜单抽屉同构),不再浮白玻璃
          width: "var(--w-sidebar)",
          flexShrink: 0,
          background: "var(--bg-app)",
          borderRight: "1px solid var(--line)",
          minHeight: "100vh"
        }}
      >
        {/* 品牌标(demo:蓝底圆角标 + 字标) */}
        <a
          href="#/today"
          className="flex items-center gap-[8px] no-underline"
          style={{ color: "var(--text-primary)", padding: "var(--space-1) var(--space-2) var(--space-2)" }}
        >
          <img
            src={saydoMark}
            alt=""
            aria-hidden
            style={{ width: 22, height: 22, borderRadius: "var(--radius-2xs)", flexShrink: 0, display: "block" }}
          />
          <span
            data-brand-lockup
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              fontWeight: 600,
              fontSize: "var(--text-lg)",
              letterSpacing: "0.2px",
              fontFamily: "var(--font-display)"
            }}
          >
            <span data-brand-cn>说到</span>
            <span data-brand-en>SayDo</span>
          </span>
        </a>

        {/* 开口聊主 CTA(demo:更显的主按钮) */}
        <a
          href="#/chat-new"
          data-side-action="chat-new"
          className="no-underline flex items-center justify-center gap-[6px]"
          style={{
            width: "100%",
            background: "var(--active-ink)",
            color: "var(--active-ink-fg)",
            border: "1px solid var(--active-ink)",
            borderRadius: "var(--radius-xs)",
            padding: "10px 14px",
            fontSize: "var(--text-base)",
            fontWeight: 500
          }}
        >
          <Mic size={16} aria-hidden />
          开口聊
        </a>

        <nav className="flex flex-col gap-[2px]" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <NavItem
            href="/today"
            icon={Inbox}
            label="今天"
            active={route.page === "today"}
            badge={orangeCount}
          />
          <NavItem href="/board" icon={LayoutGrid} label="全景看板" active={route.page === "board"} />

          {/* 正在持续的事 —— 空间分组(可折叠) */}
          <p style={secLabel}>正在持续的事</p>
          {liveFocuses.length === 0 ? (
            <p style={{ margin: "0 0 0 10px", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>暂无</p>
          ) : (
            <>
              {spaceGroups.named.map(({ sp, items }) => (
                <div key={sp.id}>
                  <SpaceSection
                    title={sp.title}
                    collapsed={!!spaceCollapsed[sp.id]}
                    onToggle={() => setSpaceCollapsed((prev) => ({ ...prev, [sp.id]: !prev[sp.id] }))}
                  />
                  {spaceCollapsed[sp.id]
                    ? null
                    : items.map((f) => (
                        <FocusNavItem
                          key={f.id}
                          focus={f}
                          hotCount={hotByFocus.get(f.id) ?? 0}
                          active={route.page === "focus" && route.focusId === f.id}
                        />
                      ))}
                </div>
              ))}
              {spaceGroups.unspaced.map((f) => (
                <FocusNavItem
                  key={f.id}
                  focus={f}
                  hotCount={hotByFocus.get(f.id) ?? 0}
                  active={route.page === "focus" && route.focusId === f.id}
                />
              ))}
            </>
          )}

          {/* 记录 */}
          <p style={secLabel}>记录</p>
          <NavItem
            href={pid ? `/p/${pid}/memory` : "/memory"}
            icon={Database}
            label="记忆库"
            active={inProject("memory")}
            disabled={!pid}
          />
          <NavItem
            href={pid ? `/p/${pid}/artifacts` : "/artifacts"}
            icon={Package}
            label="产物"
            active={inProject("artifacts")}
            disabled={!pid}
          />
          <NavItem href="/cost" icon={Wallet} label="成本" active={route.page === "cost"} />
          <NavItem href="/settings" icon={Settings2} label="设置" active={route.page === "settings"} />

          {/* 旧版折叠组:默认收起,视觉降权 */}
          <button
            type="button"
            data-legacy-toggle
            onClick={() => setLegacyOpen((v) => !v)}
            className="flex items-center gap-[6px] border-0 bg-transparent"
            style={{
              ...secLabel,
              marginTop: 16,
              cursor: "pointer",
              width: "calc(100% - 10px)",
              textAlign: "left",
              color: legacyActive ? "var(--text-muted)" : "var(--text-faint)"
            }}
          >
            {legacyOpen || legacyActive ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
            旧版
          </button>
          {legacyOpen || legacyActive ? (
            <div data-legacy-group className="flex flex-col gap-[2px]">
              <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={route.page === "dashboard"} faint />
              <NavItem href="/approvals" icon={ShieldCheck} label="审批中心" active={route.page === "approvals"} faint />
              <NavItem href="/notify" icon={Bell} label="通知" active={route.page === "notify"} faint />
              <NavItem
                href={pid ? `/p/${pid}/tasks` : "/tasks"}
                icon={ListTodo}
                label="任务"
                active={inProject("tasks") || inProject("task")}
                disabled={!pid}
                faint
              />
              <NavItem
                href="/focuses"
                icon={Crosshair}
                label="Focus 列表(旧)"
                active={route.page === "focuses"}
                faint
              />
              <NavItem
                href="/legacy/board"
                icon={LayoutGrid}
                label="看板(旧)"
                active={route.page === "legacy-board"}
                faint
              />
              {route.focusId ? (
                <NavItem
                  href={`/legacy/focus/${encodeURIComponent(route.focusId)}`}
                  icon={Rows3}
                  label="Focus 详情(旧)"
                  active={route.page === "legacy-focus"}
                  faint
                />
              ) : null}
              {/* 项目切换器沉底旧区,资源入口 */}
              <select
                aria-label="项目切换器"
                data-project-switcher
                value={pid ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) navigate(switchProjectHash(route, id));
                }}
                style={{
                  background: "var(--surface-control)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-xs)",
                  padding: "6px 8px",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-faint)",
                  margin: "6px 4px 0"
                }}
              >
                <option value="">未选择项目</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.status === "draft" ? "(草稿)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </nav>

        {/* 底部署名(demo:单用户 · 本机 daemon)+ 与手机配对 */}
        <div style={{ padding: "var(--space-3) var(--space-2) var(--space-1)", borderTop: "1px solid var(--line)" }}>
          <button
            type="button"
            data-action="pair-phone"
            onClick={openPairing}
            className="flex items-center justify-center gap-[6px] border-0"
            style={{
              width: "100%",
              marginBottom: 8,
              padding: "6px 10px",
              borderRadius: "var(--radius-2xs)",
              border: "1px solid var(--brand-seal-border)",
              background: "var(--seal-wash)",
              color: "var(--brand-seal)",
              fontSize: "var(--text-xs)",
              cursor: "pointer"
            }}
          >
            <Smartphone size={12} aria-hidden />
            与手机配对
          </button>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
            单用户 · 本机 daemon <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.92em" }}>{location.host}</span>
          </div>
        </div>
      </aside>
      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        {/* 顶栏 */}
        <header
          className="flex items-center px-[var(--shell-gutter)]"
          style={{
            // 纸上账本:顶栏同宣纸通底,底线阴影分隔,不做玻璃
            height: "var(--h-titlebar)",
            boxShadow: "var(--shadow-titlebar)",
            background: "var(--bg-app)",
            position: "relative",
            zIndex: 30,
            gap: "var(--space-3)"
          }}
        >
          {/* 语音会话指示 pill(demo 形态:ink-wash 描边胶囊,活跃呼吸点) */}
          <button
            data-voice-indicator
            onClick={() => {
              if (voice.anchorProjectId) navigate(`/p/${voice.anchorProjectId}/chat`);
              else navigate("/chat-new");
            }}
            className="flex items-center gap-[8px] border-0"
            style={{
              cursor: "pointer",
              fontSize: "var(--text-sm)",
              padding: "5px 12px",
              borderRadius: "var(--radius-pill)",
              border: voiceAnchored ? "1px solid var(--active-ink-border)" : "1px solid transparent",
              background: voiceAnchored ? "var(--active-ink-wash)" : "transparent",
              color: voiceAnchored ? "var(--active-ink)" : "var(--text-muted)"
            }}
          >
            <span
              aria-hidden
              className={voiceAnchored ? "saydo-breathing" : undefined}
              style={{
                width: 7, height: 7, borderRadius: "var(--radius-pill)",
                background: voiceAnchored ? "var(--active-ink)" : voice.connected ? "var(--text-muted)" : "var(--text-faint)"
              }}
            />
            {voiceAnchored ? `会话中 · ${current?.title ?? voice.anchorProjectId}` : voice.connected ? "语音就绪" : "开始对话"}
          </button>

          <span style={{ flex: 1 }} />

          {/* 通知铃:回叫时间线 + 免打扰 + 邮件预览(P1 提案) */}
          <div ref={bellRef} style={{ position: "relative" }}>
            <button
              aria-label="通知与免打扰"
              data-bell
              onClick={() => setBellOpen((v) => !v)}
              className="border-0 bg-transparent"
              style={{ color: "var(--text-muted)", cursor: "pointer", position: "relative", padding: 4 }}
            >
              <Bell size={18} aria-hidden />
              {unread > 0 ? (
                <span data-bell-dot style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: "var(--radius-pill)", background: "var(--color-warning)" }} />
              ) : null}
            </button>
            {bellOpen ? (
              <div
                data-bell-dd
                style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, width: 400, maxHeight: 480, overflowY: "auto",
                  zIndex: 50, padding: "var(--space-3)",
                  background: "var(--bg-app)", border: "1px solid var(--line)",
                  borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card-hover)"
                }}
              >
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", padding: "4px 8px 8px" }}>
                  回叫与通知(状态词纪律:只说收到/等你验收/已交付)
                </div>
                {outbox.length === 0 ? (
                  <div style={{ padding: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-faint)" }}>暂时没有通知</div>
                ) : (
                  outbox.slice(0, 20).map((n) => (
                    <div key={n.id} style={{ display: "flex", gap: 10, padding: "var(--space-3)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", opacity: n.state === "resolved" ? 0.55 : 1 }}>
                      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "var(--radius-pill)", flexShrink: 0, marginTop: 8, background: n.state === "pending" || n.state === "notified" ? "var(--color-warning)" : "var(--text-faint)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div>「{n.task_title ?? "任务"}」{TRIGGER_LABEL[n.trigger] ?? n.trigger}</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                          {formatAttnTime(n.notified_at ?? n.created_at ?? "")}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div style={{ height: 1, background: "var(--line)", margin: "var(--space-2) 0" }} />
                <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "var(--space-3)", fontSize: "var(--text-sm)" }}>
                  {dnd ? <BellOff size={14} aria-hidden /> : <Bell size={14} aria-hidden />}
                  <div style={{ flex: 1 }}>
                    <div>免打扰</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>22:00 – 08:00 不语音回叫,只落通知</div>
                  </div>
                  <button
                    type="button"
                    data-dnd-toggle
                    onClick={() => setDnd(!dnd)}
                    style={{
                      padding: "7px 14px", borderRadius: "var(--radius-xs)", cursor: "pointer",
                      border: dnd ? "1px solid var(--active-ink)" : "1px solid var(--line)",
                      background: dnd ? "var(--active-ink)" : "var(--surface-control)",
                      color: dnd ? "var(--active-ink-fg)" : "var(--text-secondary)", fontSize: "var(--text-sm)"
                    }}
                  >
                    {dnd ? "开着,关上" : "打开"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "var(--space-3)", fontSize: "var(--text-sm)" }}>
                  <Mail size={14} aria-hidden />
                  <div style={{ flex: 1 }}>
                    <div>邮件推送 <StageTag>P1</StageTag> <StageTag>提案</StageTag></div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>需要手动处理的事发到你邮箱,回复即可处理低风险事项</div>
                  </div>
                  <button
                    type="button"
                    data-email-preview
                    onClick={() => {
                      setPairingOpen(false);
                      setEmailOpen(true);
                    }}
                    style={{ padding: "7px 14px", borderRadius: "var(--radius-xs)", cursor: "pointer", border: "1px solid var(--line)", background: "var(--surface-control)", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}
                  >
                    预览
                  </button>
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", padding: 8 }}>
                  升级链:语音回叫 → 桌面通知 → 邮件(P1)→ 电话(P1)· 与「今天」页同一账本
                </div>
              </div>
            ) : null}
          </div>

          <button
            aria-label={compact ? "切换到舒适密度" : "切换到紧凑密度"}
            data-density-toggle
            onClick={() => setCompact(!compact)}
            className="border-0 bg-transparent"
            style={{ color: compact ? "var(--active-ink)" : "var(--text-muted)", cursor: "pointer", padding: 4 }}
          >
            {compact ? <Rows4 size={18} aria-hidden /> : <Rows3 size={18} aria-hidden />}
          </button>
          <button
            aria-label="切换主题"
            data-theme-toggle
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="border-0 bg-transparent"
            style={{ color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
          >
            {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-[var(--shell-gutter)] py-[var(--space-5)]">{children}</main>
      </div>

      {emailOpen ? (
        <EmailPreviewModal
          items={attention.filter((a) => a.color === "orange" || a.color === "blue").slice(0, 6).map((a) => ({ id: a.id, title: a.title }))}
          onClose={() => setEmailOpen(false)}
        />
      ) : null}
      {pairingOpen ? (
        <PairingOverlay
          info={pairingInfo}
          token={currentPairingToken()}
          error={pairingError}
          onClose={closePairing}
        />
      ) : null}
    </div>
  );
}
