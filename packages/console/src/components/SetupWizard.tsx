// first-run 配置向导(融合页)。
// 左栏选供给 / 右栏五用途;切换提供商 popover 复用 SupplyPicker;启动链 staged→自检→重启→live 不变。
// 纪律:key 提交即清本地态;零 emoji;console 不推断家族;CLI 能力如实分化不做统一假象。

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { navigate } from "../lib/router";
import {
  apiDraftFromSecrets,
  listAvailableSupplies,
  listUnreadyClis,
  MIX_SNAPSHOT_ID,
  mixSnapshotLine,
  mixedSlotsOf,
  needsCapabilityReprobe,
  oneKeyFromForm,
  PLAN_SLOT_DESCRIPTION,
  planForAvailableSupply,
  reduceMixAfterEdit,
  reduceMixAfterSelectHouse,
  reduceMixRestore,
  requiredAcksForSupplies,
  decideLeftRailSelect,
  startButtonLabel,
  applySlotHousePreset,
  supplyOneLiner,
  type MixSnapshot,
  unreadyCliAllowsLiveCheck,
  unreadyReasonCopy,
  type AvailableSupply,
  type QuickConfigPlan
} from "../lib/resourcePlans";
import {
  ACKABLE_VIOLATION,
  apiKeyEnvForBaseUrl,
  applyConfirmCliResult,
  cliDefaultModelLabel,
  cliModelEditable,
  cliProbeFailureCopy,
  type CliProbeFailureCopy,
  fetchCliCapabilities,
  fetchHealth,
  isDialogReadyFromProbe,
  postConfirmCliCapability,
  postReprobeCliCapabilities,
  postSetupRestart,
  postSetupTest,
  CLI_LABEL,
  CLI_NAME_TO_PROVIDER,
  namesForFullReprobe,
  saveSlotSupplies,
  SETUP_SLOT_LABEL,
  setupErrorMessage,
  SetupApiError,
  SLOT_POLICY,
  setupTestSlotNote,
  testStatusColor,
  testStatusLabel,
  waitForRestart,
  WIZARD_SLOTS,
  WIZARD_SLOT_LABEL,
  type CliCapability,
  type CliName,
  type ApiKeyName,
  type SetupProbe,
  type SetupTestResult,
  type SlotSupply,
  type TestSlotStatus,
  type WizardSlot
} from "../lib/setupApi";
import {
  closeFusionOverlay,
  FUSION_OVERLAY_NONE,
  isOutsideFusionOverlay,
  overlayHouseSlot,
  overlayModelSlot,
  setModelOverlay,
  type FusionOverlay
} from "../lib/setupOverlay";
import { SETUP_COPY } from "../lib/setupCopy";
import { ModelCombo } from "./ModelCombo";
import { SupplyPicker, supplyBlockReason } from "./SupplyPicker";
import { PaperCard, SectionTitle } from "./ui";

export const SETUP_COMPLETION_ROUTE = "/chat-new";

/** 在 daemon 重启前先写入 hash;即使页面被协调器刷新,导航意图也不会丢。 */
export function preserveSetupCompletionRoute(openChat: boolean, go: (route: string) => void = navigate): void {
  if (openChat) go(SETUP_COMPLETION_ROUTE);
}

/**
 * live self-test 通过后进入开口聊。
 * 新 probe 已武装 → 让 SetupBootstrapBoundary 就地翻到 app;
 * 仍未武装(首载缓存/过期快照) → 整页进入已 preserve 的目标路由,由 SetupProvider 重新判定。
 */
export function enterAppAfterSetup(
  probe: SetupProbe | null,
  reload: () => void = () => {
    location.reload();
  }
): "app" | "reload" {
  if (isDialogReadyFromProbe(probe)) return "app";
  reload();
  return "reload";
}

export function planAcksSatisfied(plan: QuickConfigPlan, acks: QuickConfigPlan["requiredAcks"]): boolean {
  return (
    (!plan.requiredAcks.evaluatorIsolation || acks.evaluatorIsolation) &&
    (!plan.requiredAcks.evaluatorSameFamily || acks.evaluatorSameFamily)
  );
}

export async function activateStagedPlan(input: {
  stage: () => Promise<unknown>;
  test: () => Promise<SetupTestResult>;
  activate: () => Promise<void>;
}): Promise<{ results: SetupTestResult; failedSlots: WizardSlot[] }> {
  await input.stage();
  const results = await input.test();
  const failedSlots = failedSetupSlots(results);
  if (failedSlots.length === 0) await input.activate();
  return { results, failedSlots };
}

export function failedSetupSlots(results: SetupTestResult): WizardSlot[] {
  return WIZARD_SLOTS.filter((slot) => results[slot]?.status !== "ok");
}

/**
 * 「确认并启动」不是一步,是四步:保存 → 自检(配置可用) → 重启 → 自检(生效后确认)。
 * 全 CLI 方案每槽真实跑一轮 15-25 秒,两轮自检合计可达 2-4 分钟——这段时间原本只有
 * 一行"正在自检各槽位…",而确认弹窗在重启前就被关掉了,用户看不出还在跑、也不知道跑到哪
 * (2026-08-12 实测反馈:等到弹窗消失,以为完事了,却没进到可用页面)。
 */
export type SetupPhase =
  | "idle"
  | "staging"
  | "testing_staged"
  | "restarting"
  | "testing_live"
  | "done"
  | "failed";

export type ProgressStepState = "pending" | "active" | "done" | "failed";

export interface SetupProgressStep {
  key: "staging" | "testing_staged" | "restarting" | "testing_live";
  label: string;
  state: ProgressStepState;
}

const PROGRESS_ORDER: SetupProgressStep["key"][] = ["staging", "testing_staged", "restarting", "testing_live"];

const PROGRESS_LABEL: Record<SetupProgressStep["key"], string> = {
  staging: "保存方案",
  testing_staged: "自检 1/2 · 配置能不能用",
  restarting: "重启服务",
  testing_live: "自检 2/2 · 生效后再确认一遍"
};

/** 正在跑自检(两轮任一)——按钮文案与忙态判断共用,免得漏掉新增的那一轮 */
export function isTestingPhase(phase: SetupPhase): boolean {
  return phase === "testing_staged" || phase === "testing_live";
}

/**
 * phase → 四步进度。done 时全部完成;failed 时当前步标失败、其后保持未开始
 * (失败在哪一步是排查的关键信息,不能一律涂成失败)。
 */
export function setupProgressSteps(phase: SetupPhase, failedAt?: SetupProgressStep["key"]): SetupProgressStep[] {
  const currentIndex = PROGRESS_ORDER.indexOf(phase as SetupProgressStep["key"]);
  return PROGRESS_ORDER.map((key, index) => {
    const label = PROGRESS_LABEL[key];
    if (phase === "done") return { key, label, state: "done" as const };
    if (phase === "failed") {
      const failedIndex = failedAt ? PROGRESS_ORDER.indexOf(failedAt) : -1;
      if (failedIndex < 0) return { key, label, state: "pending" as const };
      if (index < failedIndex) return { key, label, state: "done" as const };
      if (index === failedIndex) return { key, label, state: "failed" as const };
      return { key, label, state: "pending" as const };
    }
    if (currentIndex < 0) return { key, label, state: "pending" as const };
    if (index < currentIndex) return { key, label, state: "done" as const };
    if (index === currentIndex) return { key, label, state: "active" as const };
    return { key, label, state: "pending" as const };
  });
}

/** 秒 → "1 分 05 秒";长流程里光转圈不给数字,人会以为卡死 */
export function formatElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} 秒`;
  return `${Math.floor(s / 60)} 分 ${String(s % 60).padStart(2, "0")} 秒`;
}

/** 启动按钮忙态:自检只说正在跑,秒数只出现在进度行。 */
export function startBusyLabel(phase: SetupPhase): string {
  if (isTestingPhase(phase)) return "正在真实自检…";
  if (phase === "restarting") return "正在重启服务…";
  return "正在保存方案…";
}

/** 进度行唯一计时;CLI 方案补一句别关页面。 */
export function setupElapsedCopy(elapsedSec: number, slowCliNote: boolean): string {
  const elapsed = `已进行 ${formatElapsed(elapsedSec)}`;
  return slowCliNote ? `${elapsed}。两轮合计约 1-3 分钟,期间别关页面。` : `${elapsed}。`;
}

const OTHER_SLOTS: WizardSlot[] = ["thinking", "cheap", "evaluator"];

export function advancedSuppliesForSave(
  savedDialog: SlotSupply | null,
  supplies: Record<WizardSlot, SlotSupply>
): Partial<Record<WizardSlot, SlotSupply>> {
  const pending: Partial<Record<WizardSlot, SlotSupply>> = {};
  if (savedDialog && savedDialog.kind !== "skip") pending.dialog = savedDialog;
  for (const slot of OTHER_SLOTS) {
    if (supplies[slot].kind !== "skip") pending[slot] = supplies[slot];
  }
  return pending;
}

const btnPrimary: CSSProperties = {
  height: 34,
  padding: "0 14px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--active-ink-border)",
  background: "var(--active-ink)",
  color: "var(--active-ink-fg)",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
};

/* 承诺型动作(盖章语义):启动/确认类终局按钮用品牌朱,常规交互仍黛蓝 */
const btnCommit: CSSProperties = {
  height: 34,
  padding: "0 14px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--brand-seal-border)",
  background: "var(--brand-seal)",
  color: "var(--brand-seal-fg)",
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  cursor: "pointer"
};

const btnGhost: CSSProperties = {
  height: 34,
  padding: "0 14px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: "var(--surface-control)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: "var(--surface-control)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-mono)",
  boxSizing: "border-box"
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  color: "var(--text-muted)",
  marginBottom: 4
};

function field(label: string, children: ReactNode) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

/**
 * CLI 探测失败提示。
 * 连不上 / 凭证失效 / 服务正在启动都**不是** CLI 的问题——此时既不说"CLI 检测失败",
 * 也不顺势推荐 API 直连(本机 CLI 可能好端端登录着),只给能照做的下一步和重检入口。
 */
function CliProbeError({ copy, onRetry }: { copy: CliProbeFailureCopy; onRetry: () => void }) {
  return (
    <div
      data-cli-error
      data-cli-error-suggest-api={copy.suggestApi ? "1" : "0"}
      style={{ margin: "0 0 12px", fontSize: "var(--text-xs)", color: "var(--color-warning)" }}
    >
      <p style={{ margin: 0 }}>
        {copy.suggestApi ? `没能读到本机 CLI 画像:${copy.message}——可以直接用 API 直连配置。` : copy.message}
      </p>
      {copy.hint ? <p style={{ margin: "4px 0 0", color: "var(--text-secondary)" }}>{copy.hint}</p> : null}
      <button
        type="button"
        data-action="retry-cli-probe"
        onClick={onRetry}
        style={{
          height: 28,
          marginTop: 8,
          padding: "0 12px",
          borderRadius: "var(--radius-xs)",
          border: "1px solid var(--line)",
          background: "transparent",
          color: "var(--text-primary)",
          fontSize: "var(--text-xs)",
          cursor: "pointer"
        }}
      >
        重新检测
      </button>
    </div>
  );
}

/**
 * 长流程进度(保存 → 自检 → 重启 → 再自检)。
 * 全 CLI 方案两轮自检合计可达 2-4 分钟,这段时间必须让人看见:走到哪一步、已经花了多久、
 * 为什么这么慢。否则唯一的信号是一行"正在自检各槽位…",看上去和卡死没有区别。
 */
function SetupProgress({
  phase,
  failedAt,
  elapsedSec,
  slowCliNote
}: {
  phase: SetupPhase;
  failedAt?: SetupProgressStep["key"];
  elapsedSec: number;
  slowCliNote: boolean;
}) {
  if (phase === "idle") return null;
  const steps = setupProgressSteps(phase, failedAt);
  const mark: Record<ProgressStepState, string> = { done: "[ok]", active: "[..]", failed: "[fail]", pending: "[ ]" };
  const color: Record<ProgressStepState, string> = {
    done: "var(--color-success)",
    active: "var(--text-primary)",
    failed: "var(--color-error)",
    pending: "var(--text-faint)"
  };
  return (
    <div data-setup-progress={phase} style={{ marginTop: 14 }}>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {steps.map((s) => (
          <li
            key={s.key}
            data-progress-step={s.key}
            data-progress-state={s.state}
            style={{ display: "flex", gap: 8, fontSize: "var(--text-sm)", color: color[s.state] }}
          >
            <span aria-hidden style={{ fontFamily: "var(--font-mono)" }}>
              {mark[s.state]}
            </span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      {phase !== "done" && phase !== "failed" ? (
        <p data-setup-elapsed style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {setupElapsedCopy(elapsedSec, slowCliNote)}
        </p>
      ) : null}
    </div>
  );
}

export function TestTrafficLight({ results }: { results: SetupTestResult }) {
  const keys = Object.keys(results).filter((k) => k !== "voice");
  if (keys.length === 0) {
    return <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>尚无自检结果</p>;
  }
  return (
    <table style={{ width: "100%", fontSize: "var(--text-sm)", borderCollapse: "collapse" }} data-setup-test-results>
      <thead>
        <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>
          <th style={{ paddingBottom: 8 }}>槽位</th>
          <th>状态</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const r = results[k]!;
          const label = SETUP_SLOT_LABEL[k as keyof typeof SETUP_SLOT_LABEL] ?? k;
          const note = setupTestSlotNote(r);
          return (
            <tr key={k} style={{ height: 36, borderTop: "1px solid var(--line)" }}>
              <td>{label}</td>
              <td>
                <span className="inline-flex items-center gap-[6px]">
                  <span
                    aria-hidden
                    data-test-dot={r.status}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: testStatusColor(r.status),
                      display: "inline-block"
                    }}
                  />
                  <span style={{ color: testStatusColor(r.status) }}>{testStatusLabel(r.status)}</span>
                  {r.latencyMs !== undefined ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                      {r.latencyMs}ms
                    </span>
                  ) : null}
                </span>
              </td>
              <td
                style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}
                title={note !== "—" ? note : undefined}
                data-test-detail={note !== "—" ? "1" : undefined}
              >
                {note}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function supplyTitle(supply: AvailableSupply): string {
  return supply.kind === "cli" ? (supply.cli.label ?? CLI_LABEL[supply.cli.name] ?? supply.cli.name) : "API 直连";
}

function mergeCliList(prev: CliCapability[], updated: CliCapability[]): CliCapability[] {
  const map = new Map(prev.map((item) => [item.name, item]));
  for (const item of updated) map.set(item.name, item);
  return [...map.values()];
}

export function canChangeSupply(busy: boolean): boolean {
  return !busy;
}

export const FUSION_SPLIT_MIN_VIEWPORT = 1080;
export const FUSION_SPLIT_CONTENT_MAX_WIDTH = 1080;
export const FUSION_STACK_CONTENT_MAX_WIDTH = 720;

export function fusionLayoutForViewport(widthPx: number, embedded = false): "split" | "stack" {
  if (embedded) return "stack";
  return widthPx >= FUSION_SPLIT_MIN_VIEWPORT ? "split" : "stack";
}

export function wizardContentMaxWidth(layout: "split" | "stack"): number {
  return layout === "split" ? FUSION_SPLIT_CONTENT_MAX_WIDTH : FUSION_STACK_CONTENT_MAX_WIDTH;
}

/** 供给网格列数:≥1100 三列 / 720-1099 两列 / <720 单列 */
export function supplyGridTemplateColumns(widthPx: number): string {
  if (widthPx >= 1100) return "repeat(3, minmax(0, 1fr))";
  if (widthPx >= 720) return "repeat(2, minmax(0, 1fr))";
  return "minmax(0, 1fr)";
}

export function supplyHouseLabel(supply: SlotSupply): string {
  if (supply.kind === "skip") return "跳过";
  if (supply.kind === "api") return "API";
  const name = (Object.entries(CLI_NAME_TO_PROVIDER) as Array<[CliName, string | undefined]>).find(
    ([, provider]) => provider === supply.provider
  )?.[0];
  return name ? (CLI_LABEL[name] ?? supply.provider) : supply.provider;
}

function popoverPolicy(slot: WizardSlot) {
  const base = SLOT_POLICY[slot];
  return { ...base, cliAckRequiredFor: undefined, cliWarning: undefined };
}

export function scrollSetupAnchor(el: HTMLElement | null): void {
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function detectingProgressCopy(_reprobing: boolean, _phase2Done: boolean): string {
  return SETUP_COPY.detecting;
}

const skeletonBar = (width: string, height: number): CSSProperties => ({
  display: "block",
  width,
  height,
  borderRadius: "var(--radius-2xs)",
  background: "var(--surface-ink-wash)"
});

/** 检测中进度行:墨色正文 + CSS 呼吸圆点(非 emoji) */
export function DetectingProgressRow({
  reprobing,
  phase2Done
}: {
  reprobing: boolean;
  phase2Done: boolean;
}) {
  return (
    <p
      data-cli-detecting
      style={{
        margin: "0 0 10px",
        fontSize: "var(--text-base)",
        color: "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        gap: 8
      }}
    >
      <span aria-hidden data-detecting-dot className="setup-detecting-dot" />
      <span>{detectingProgressCopy(reprobing, phase2Done)}</span>
    </p>
  );
}

/** 检测中 3 张骨架卡:预示网格里会铺出供给卡 */
export function SupplySkeletonGrid({ variant = "grid" }: { variant?: "grid" | "rail" } = {}) {
  return (
    <div
      data-supply-skeleton-grid
      data-supply-variant={variant}
      className={variant === "rail" ? "setup-supply-rail" : "setup-supply-grid"}
      role="status"
      aria-busy="true"
      aria-label="正在清点供给"
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          data-supply-skeleton
          className="setup-skeleton-card"
          style={{
            padding: 12,
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)"
          }}
        >
          <span data-supply-skeleton-title style={skeletonBar("42%", 14)} />
          <span data-supply-skeleton-line style={{ ...skeletonBar("78%", 10), marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function SupplyCardGrid({
  items,
  selectedId,
  busy,
  onSelect,
  selectedCardRef,
  variant = "grid"
}: {
  items: Array<{ id: string; title: string; line: string }>;
  selectedId: string | null;
  busy: boolean;
  onSelect: (id: string) => void;
  selectedCardRef?: { current: HTMLElement | null };
  variant?: "grid" | "rail";
}) {
  return (
    <div
      data-available-supplies
      data-supply-variant={variant}
      className={variant === "rail" ? "setup-supply-rail" : "setup-supply-grid"}
      role="radiogroup"
      aria-label="可用供给"
    >
      {items.map((row) => {
        const selected = selectedId === row.id;
        return (
          <div
            key={row.id}
            ref={(node) => {
              if (selected && selectedCardRef) selectedCardRef.current = node;
            }}
            data-supply-row={row.id}
            data-selected={selected ? "1" : undefined}
            style={{
              position: "relative",
              padding: 12,
              border: selected ? "2px solid var(--active-ink)" : "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              background: selected ? "var(--selected-wash)" : "var(--surface-control)",
              scrollMarginTop: 24
            }}
          >
            {selected ? (
              <span
                aria-hidden
                data-supply-seal
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 0,
                  height: 0,
                  borderTop: "12px solid var(--brand-seal)",
                  borderLeft: "12px solid transparent"
                }}
              />
            ) : null}
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!canChangeSupply(busy)}
              onClick={() => onSelect(row.id)}
              data-action={row.id === "api:new" ? "add-api" : `select-${row.id}`}
              style={{
                display: "block",
                width: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: busy ? "not-allowed" : "pointer",
                color: "inherit"
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>{row.title}</span>
              <span style={{ display: "block", marginTop: 4, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {row.line}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function MixSnapshotCard({
  selected,
  line,
  busy,
  onSelect
}: {
  selected: boolean;
  line: string;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      data-mix-snapshot-card
      data-selected={selected ? "1" : undefined}
      style={{
        position: "relative",
        marginBottom: 8,
        padding: 12,
        border: selected ? "2px solid var(--active-ink)" : "1px solid var(--brand-seal-border)",
        borderRadius: "var(--radius-sm)",
        background: selected ? "var(--selected-wash)" : "var(--surface-control)"
      }}
    >
      <span
        aria-hidden
        data-supply-seal
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderTop: "12px solid var(--brand-seal)",
          borderLeft: "12px solid transparent"
        }}
      />
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={!canChangeSupply(busy)}
        onClick={onSelect}
        data-action="select-mix-snapshot"
        style={{
          display: "block",
          width: "100%",
          padding: 0,
          border: "none",
          background: "transparent",
          textAlign: "left",
          cursor: busy ? "not-allowed" : "pointer",
          color: "inherit"
        }}
      >
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{SETUP_COPY.mixTitle}</span>
        <span style={{ display: "block", marginTop: 4, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {line}
        </span>
      </button>
    </div>
  );
}

export function PurposeZones({
  supplies,
  preset,
  clis,
  openModelSlot,
  onOpenModelSlot,
  openHouseSlot,
  onOpenHouseSlot,
  onModelChange,
  onHouseChange,
  disabled,
  reprobing,
  onReprobeCli,
  dialogZoneRef
}: {
  supplies: Record<WizardSlot, SlotSupply>;
  preset: QuickConfigPlan["supplies"];
  clis: CliCapability[];
  openModelSlot: WizardSlot | null;
  onOpenModelSlot: (slot: WizardSlot | null) => void;
  openHouseSlot: WizardSlot | null;
  onOpenHouseSlot: (slot: WizardSlot | null) => void;
  onModelChange: (slot: WizardSlot, model: string) => void;
  onHouseChange: (slot: WizardSlot, next: SlotSupply) => void;
  disabled: boolean;
  reprobing: boolean;
  onReprobeCli: (name: CliName) => void;
  dialogZoneRef?: { current: HTMLElement | null };
}) {
  const mixed = new Set(mixedSlotsOf(supplies, preset));
  return (
    <div data-purpose-zones data-plan-slots>
      {WIZARD_SLOTS.map((slot) => {
        const supply = supplies[slot];
        const selectedCli =
          supply.kind === "cli" ? clis.find((item) => item.provider === supply.provider) : undefined;
        const editableModel =
          supply.kind === "api" || (supply.kind === "cli" && cliModelEditable(supply.provider));
        const transportHint =
          supply.kind === "cli" &&
          selectedCli &&
          !selectedCli.enumerable &&
          !selectedCli.models.some(
            (model) => model.source === "used" || model.source === "configured" || model.source === "alias"
          )
            ? SETUP_COPY.transportHint
            : undefined;
        const latencyHint =
          slot === "dialog"
            ? supply.kind === "cli"
              ? "CLI 慢速 · 每轮约 15-25 秒"
              : supply.kind === "api"
                ? "API 秒回"
                : null
            : null;
        const isMixed = mixed.has(slot);
        return (
          <div
            key={slot}
            ref={
              slot === "dialog" && dialogZoneRef
                ? (node) => {
                    dialogZoneRef.current = node;
                  }
                : undefined
            }
            className="setup-purpose-zone"
            data-purpose-zone={slot}
            data-mixed={isMixed ? "1" : undefined}
            style={{ scrollMarginTop: 24 }}
          >
            <div className="flex items-center justify-between gap-[8px]" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                {WIZARD_SLOT_LABEL[slot]}
                <span style={{ marginLeft: 8, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  {PLAN_SLOT_DESCRIPTION[slot]}
                </span>
              </span>
              <span className="flex items-center gap-[6px]">
                {isMixed ? (
                  <span
                    data-mixed-badge={slot}
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--brand-seal)",
                      border: "1px solid var(--brand-seal-border)",
                      borderRadius: "var(--radius-2xs)",
                      padding: "1px 6px"
                    }}
                  >
                    混搭
                  </span>
                ) : null}
                <button
                  type="button"
                  data-action={`change-house-${slot}`}
                  data-overlay-trigger="house"
                  disabled={disabled}
                  onClick={() => onOpenHouseSlot(openHouseSlot === slot ? null : slot)}
                  style={{
                    height: 26,
                    padding: "0 8px",
                    borderRadius: "var(--radius-2xs)",
                    border: "1px solid var(--line)",
                    background: "var(--surface-control)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-xs)",
                    cursor: disabled ? "not-allowed" : "pointer"
                  }}
                >
                  {SETUP_COPY.switchProvider}
                </button>
              </span>
            </div>
            {latencyHint ? (
              <p data-slot-latency={slot} style={{ margin: "0 0 6px", fontSize: "var(--text-xs)", color: "var(--color-warning)" }}>
                {latencyHint}
              </p>
            ) : null}
            {supply.kind === "skip" ? (
              <p data-slot-skipped={slot} style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                已跳过 · 稍后在设置里配
              </p>
            ) : editableModel ? (
              supply.kind === "cli" ? (
                <ModelCombo
                  slotKey={slot}
                  models={selectedCli?.models ?? []}
                  value={supply.model ?? ""}
                  onChange={(id) => onModelChange(slot, id)}
                  complete={selectedCli?.enumerable === true}
                  open={openModelSlot === slot}
                  onOpenChange={(open) => onOpenModelSlot(open ? slot : null)}
                  disabled={disabled}
                  hint={transportHint}
                />
              ) : (
                <input
                  style={inputStyle}
                  value={supply.model ?? ""}
                  disabled={disabled}
                  onChange={(event) => onModelChange(slot, event.target.value)}
                  data-plan-model={slot}
                  aria-label={`${WIZARD_SLOT_LABEL[slot]}槽模型`}
                />
              )
            ) : (
              <span data-plan-cli-default={slot} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
                {supply.kind === "cli" ? (supply.model ?? cliDefaultModelLabel(supply.provider)) : ""}
              </span>
            )}
            {openHouseSlot === slot ? (
              <div className="setup-house-popover" data-house-picker={slot} data-fusion-overlay="house">
                <SupplyPicker
                  slotKey={slot}
                  clis={clis}
                  value={supply}
                  onChange={(next) => onHouseChange(slot, next)}
                  allowSkip={slot !== "dialog"}
                  policy={popoverPolicy(slot)}
                  disabled={disabled}
                  reprobing={reprobing}
                  onReprobeCli={onReprobeCli}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="setup-purpose-zone" data-purpose-zone="dev">
        <div className="flex justify-between gap-[12px]" style={{ fontSize: "var(--text-xs)" }}>
          <span style={{ color: "var(--text-muted)" }}>开发 · {PLAN_SLOT_DESCRIPTION.dev}</span>
          <span data-dev-slot-copy style={{ fontFamily: "var(--font-mono)" }}>
            留空 · 稍后在设置里配
          </span>
        </div>
      </div>
    </div>
  );
}

export function SetupWizard({
  probe,
  onDone,
  onProbeRefresh,
  advancedNotice,
  openDialogEditorRequest = 0,
  embedded = false,
  layout
}: {
  probe: SetupProbe | null;
  /** 对话槽绿后「开始使用」 */
  onDone: () => void;
  onProbeRefresh: () => Promise<SetupProbe | null>;
  advancedNotice?: string | null;
  /** 存量 dialog=CLI 时由门禁/设置页直接展开对话槽切换提供商 */
  openDialogEditorRequest?: number;
  /** 设置页内嵌:强制上下回落 */
  embedded?: boolean;
  layout?: "split" | "stack";
}) {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? FUSION_STACK_CONTENT_MAX_WIDTH : window.innerWidth
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const fusionLayout = layout ?? fusionLayoutForViewport(viewportWidth, embedded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setRestartHint] = useState(false);

  // CLI 能力(登录态 + 可枚举模型);拉取失败不挡流程,退化成只能配 API
  const [clis, setClis] = useState<CliCapability[]>([]);
  const [cliLoading, setCliLoading] = useState(true);
  // 存错误对象而非字符串:要按失败大类分流文案(连不上 ≠ CLI 坏了),字符串化就没得分了
  const [cliError, setCliError] = useState<unknown>(null);
  /** 手动重检计数(daemon 冷启动十几秒,进门太早会扑空,给个不刷整页的出口) */
  const [cliProbeNonce, setCliProbeNonce] = useState(0);
  const [confirmingName, setConfirmingName] = useState<CliName | null>(null);
  const cliErrorCopy = cliError === null ? null : cliProbeFailureCopy(cliError);
  const [selectedPlan, setSelectedPlan] = useState<QuickConfigPlan | null>(null);
  const [selectedSupplyId, setSelectedSupplyId] = useState<string | null>(null);
  const [slotSupplies, setSlotSupplies] = useState<Record<WizardSlot, SlotSupply> | null>(null);
  const [planAcks, setPlanAcks] = useState({ evaluatorIsolation: false, evaluatorSameFamily: false });
  const [overlay, setOverlay] = useState<FusionOverlay>(FUSION_OVERLAY_NONE);
  const [mixSnapshot, setMixSnapshot] = useState<MixSnapshot | null>(null);
  const [reprobing, setReprobing] = useState(false);
  const [phase2Done, setPhase2Done] = useState(false);
  const [showUnready, setShowUnready] = useState(false);
  const [addingApi, setAddingApi] = useState(false);
  const [draftApiPlan, setDraftApiPlan] = useState<QuickConfigPlan | null>(null);
  const selectedCardRef = useRef<HTMLElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const dialogZoneRef = useRef<HTMLElement | null>(null);
  const reprobingRef = useRef(false);

  const [requiredDialogApi, setRequiredDialogApi] = useState({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: "",
    model: ""
  });
  const [stagedApiKeyName, setStagedApiKeyName] = useState<ApiKeyName | null>(null);

  const [sameFamilyBlocked, setSameFamilyBlocked] = useState(false);

  const [phase, setPhase] = useState<SetupPhase>("idle");
  const [testResults, setTestResults] = useState<SetupTestResult | null>(null);
  /** 长流程起点(ms);用于把"还要多久"变成看得见的已用时间 */
  const [phaseStartedAt, setPhaseStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  /** 失败发生在哪一步(失败位置本身就是排查信息,不能一律涂红) */
  const [failedAt, setFailedAt] = useState<SetupProgressStep["key"] | undefined>(undefined);
  /** 方案里有 CLI 槽才提"每槽 15-25 秒";纯 API 自检是秒级,照抄这句就成了吓唬人 */
  const planUsesCli = slotSupplies
    ? Object.values(slotSupplies).some((supply) => supply.kind === "cli")
    : false;

  useEffect(() => {
    if (overlay.type === "none") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOverlay(closeFusionOverlay());
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-overlay-trigger],[data-fusion-overlay]")) return;
      if (
        !isOutsideFusionOverlay(target, [
          ...Array.from(document.querySelectorAll("[data-fusion-overlay]")),
          ...Array.from(document.querySelectorAll("[data-overlay-trigger]"))
        ])
      ) {
        return;
      }
      setOverlay(closeFusionOverlay());
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [overlay]);

  useEffect(() => {
    if (phaseStartedAt === null) return;
    setElapsedSec(Math.floor((Date.now() - phaseStartedAt) / 1000));
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - phaseStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phaseStartedAt]);

  const pendingInvalid = probe?.pendingConfig?.status === "validation_failed";
  const effectiveSecrets: Record<string, boolean> = {
    ...(probe?.secrets ?? {}),
    ...(stagedApiKeyName ? { [stagedApiKeyName]: true } : {})
  };
  const availableSupplies = listAvailableSupplies({ clis, secrets: effectiveSecrets });
  const unreadyClis = listUnreadyClis(clis);
  const detecting = cliLoading || reprobing;
  const mixedSlotIds = selectedPlan && slotSupplies ? mixedSlotsOf(slotSupplies, selectedPlan.supplies) : [];
  const mixedActive = mixedSlotIds.length > 0;
  const liveRequiredAcks = requiredAcksForSupplies(slotSupplies ?? {});
  // 单家直连方案(如 DeepSeek 一键)四槽同族恒成立,ack 前置(11 §5 owner 2026-08-15);
  // evaluator 槽一旦被用户改成别家,回落 live 计算,不再挂着无谓的 ack。
  const planPresetsSameFamilyAck =
    !mixedSlotIds.includes("evaluator") && (selectedPlan?.requiredAcks.evaluatorSameFamily ?? false);
  const effectiveRequiredAcks = {
    evaluatorIsolation: liveRequiredAcks.evaluatorIsolation,
    evaluatorSameFamily: liveRequiredAcks.evaluatorSameFamily || sameFamilyBlocked || planPresetsSameFamilyAck
  };
  const currentLeftId = addingApi ? "api:new" : selectedSupplyId;
  const openModelSlot = overlayModelSlot(overlay);
  const openHouseSlot = overlayHouseSlot(overlay);
  const viewingMix = selectedSupplyId === MIX_SNAPSHOT_ID;

  const titleForSupplyId = (id: string | null): string => {
    if (!id) return "左栏家";
    if (id === MIX_SNAPSHOT_ID) return mixSnapshot?.baseLabel ?? SETUP_COPY.mixTitle;
    if (id === "api:new") return "添加 API 直连";
    if (id === "api:draft") return "刚填的 API";
    const supply = availableSupplies.find((item) => item.id === id);
    return supply ? supplyTitle(supply) : id;
  };

  const applyMixView = (next: {
    selectedId: string;
    plan: QuickConfigPlan;
    supplies: Record<WizardSlot, SlotSupply>;
    snapshot: MixSnapshot | null;
  }) => {
    setSelectedSupplyId(next.selectedId);
    setSelectedPlan(next.plan);
    setSlotSupplies(next.supplies);
    setMixSnapshot(next.snapshot);
  };

  useEffect(() => {
    if (!advancedNotice || !slotSupplies) return;
    if (slotSupplies.evaluator.kind === "api") return;
    setSlotSupplies((prev) => (prev ? { ...prev, evaluator: apiDraftFromSecrets(effectiveSecrets) } : prev));
    setOverlay({ type: "house", slot: "evaluator" });
  }, [advancedNotice, selectedPlan]);

  const applyPlanToSlots = (plan: QuickConfigPlan, supplyId: string) => {
    setSelectedSupplyId(supplyId);
    setSelectedPlan(plan);
    setSlotSupplies({
      dialog: plan.supplies.dialog,
      thinking: plan.supplies.thinking,
      cheap: plan.supplies.cheap,
      evaluator: plan.supplies.evaluator
    });
    // 前置 same-family ack 的方案默认勾上(11 §5:可见、可取消,不是静默代写);
    // 隔离 ack 性质不同(读禁闭不可证),恒不默认勾选。
    setPlanAcks({ evaluatorIsolation: false, evaluatorSameFamily: plan.requiredAcks.evaluatorSameFamily });
    setSameFamilyBlocked(false);
    setOverlay(closeFusionOverlay());
    setAddingApi(false);
  };

  const onSaveRequiredDialogApi = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const snapshot = requiredDialogApi;
    if (!snapshot.baseURL.trim() || !snapshot.apiKey.trim() || !snapshot.model.trim()) {
      setError("请填完整 baseURL、API key 和模型名。");
      return;
    }
    const plan = oneKeyFromForm(snapshot);
    setRequiredDialogApi((current) => ({ ...current, apiKey: "" }));
    setDraftApiPlan(plan);
    applyPlanToSlots(plan, "api:draft");
    setStagedApiKeyName(apiKeyEnvForBaseUrl(snapshot.baseURL));
  };

  useEffect(() => {
    if (advancedNotice) return;
    if (openDialogEditorRequest > 0) {
      setOverlay({ type: "house", slot: "dialog" });
      queueMicrotask(() => scrollSetupAnchor(dialogZoneRef.current));
    }
  }, [advancedNotice, openDialogEditorRequest]);

  useEffect(() => {
    let alive = true;
    setCliLoading(true);
    setReprobing(false);
    setPhase2Done(false);
    void fetchCliCapabilities()
      .then(async (list) => {
        if (!alive) return;
        setClis(list);
        setCliError(null);
        setCliLoading(false);
        const retryNames = list.filter(needsCapabilityReprobe).map((item) => item.name);
        if (retryNames.length === 0) {
          setPhase2Done(true);
          return;
        }
        reprobingRef.current = true;
        setReprobing(true);
        try {
          const updated = await postReprobeCliCapabilities(retryNames);
          if (!alive) return;
          setClis((prev) => mergeCliList(prev, updated));
        } catch (err: unknown) {
          if (alive) setCliError(err);
        } finally {
          reprobingRef.current = false;
          if (alive) {
            setReprobing(false);
            setPhase2Done(true);
          }
        }
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setCliError(err);
        setCliLoading(false);
        setPhase2Done(true);
      });
    return () => {
      alive = false;
    };
  }, [advancedNotice, cliProbeNonce]);

  const silentRefreshClis = () => {
    setCliProbeNonce((n) => n + 1);
  };

  /** 显式重探:走 POST /reprobe(bypassCache),刷新后主列表/高级卡原位更新。不轮询。 */
  const reprobeNames = (names: CliName[]) => {
    if (names.length === 0 || busy || reprobing || reprobingRef.current) return;
    reprobingRef.current = true;
    setError(null);
    setReprobing(true);
    void postReprobeCliCapabilities(names)
      .then((updated) => {
        setClis((prev) => mergeCliList(prev, updated));
      })
      .catch((err: unknown) => {
        setError(setupErrorMessage(err));
      })
      .finally(() => {
        reprobingRef.current = false;
        setReprobing(false);
      });
  };

  const reprobeOne = (name: CliName) => {
    reprobeNames([name]);
  };

  const reprobeAll = () => {
    reprobeNames(namesForFullReprobe(clis));
  };

  const confirmCli = (name: CliName) => {
    setError(null);
    setConfirmingName(name);
    void postConfirmCliCapability(name)
      .then((result) => {
        setClis((prev) => prev.map((cli) => (cli.name === name ? applyConfirmCliResult(cli, result) : cli)));
        if (!result.confirmed) {
          setError(result.detail ?? "受控一发没有确认登录态");
        }
        silentRefreshClis();
      })
      .catch((err: unknown) => {
        setError(setupErrorMessage(err));
      })
      .finally(() => setConfirmingName(null));
  };

  const restartAndTest = async (openChat: boolean) => {
    setPhase("restarting");
    setFailedAt("restarting");
    setTestResults(null);
    preserveSetupCompletionRoute(openChat);
    const before = await fetchHealth().catch(() => null);
    await postSetupRestart();
    await waitForRestart(before?.pid);
    setPhase("testing_live");
    setFailedAt("testing_live");
    const results = await postSetupTest();
    setTestResults(results);
    const nextProbe = await onProbeRefresh();
    const failedSlots = failedSetupSlots(results);
    setPhase(failedSlots.length === 0 ? "done" : "failed");
    if (failedSlots.length === 0) setRestartHint(false);
    else setError(`重启后 self-test 未全绿:${failedSlots.map((slot) => WIZARD_SLOT_LABEL[slot]).join("、")}。请修正后再试。`);
    if (openChat && failedSlots.length === 0) {
      onDone();
      enterAppAfterSetup(nextProbe);
    }
  };

  const chooseSupply = (supply: AvailableSupply, opts?: { scroll?: boolean }) => {
    if (!canChangeSupply(busy)) return;
    setError(null);
    setTestResults(null);
    applyPlanToSlots(planForAvailableSupply(supply), supply.id);
    if (opts?.scroll !== false) {
      queueMicrotask(() => scrollSetupAnchor(selectedCardRef.current));
    }
  };

  const applySelectId = (id: string, opts?: { scroll?: boolean }) => {
    if (id === "api:new") {
      setAddingApi(true);
      setSelectedSupplyId("api:new");
      setSelectedPlan(null);
      setOverlay(closeFusionOverlay());
      if (opts?.scroll !== false) queueMicrotask(() => scrollSetupAnchor(selectedCardRef.current));
      return;
    }
    const row = visibleSupplies.find((item) => item.id === id);
    if (!row) return;
    if (selectedPlan && slotSupplies && selectedSupplyId && selectedSupplyId !== "api:new") {
      const next = reduceMixAfterSelectHouse(
        {
          selectedId: selectedSupplyId,
          plan: selectedPlan,
          supplies: slotSupplies,
          snapshot: mixSnapshot
        },
        row.id,
        row.plan
      );
      applyMixView(next);
      setPlanAcks({ evaluatorIsolation: false, evaluatorSameFamily: false });
      setSameFamilyBlocked(false);
      setOverlay(closeFusionOverlay());
      setAddingApi(false);
    } else if (row.supply) {
      chooseSupply(row.supply, opts);
      return;
    } else {
      applyPlanToSlots(row.plan, row.id);
    }
    if (opts?.scroll !== false) queueMicrotask(() => scrollSetupAnchor(selectedCardRef.current));
  };

  const trySelectId = (id: string) => {
    const decision = decideLeftRailSelect({
      busy,
      currentId: currentLeftId,
      nextId: id
    });
    if (decision === "noop") return;
    if (decision === "restore") {
      if (!selectedPlan || !slotSupplies || !selectedSupplyId || !mixSnapshot) return;
      applyMixView(
        reduceMixRestore({
          selectedId: selectedSupplyId,
          plan: selectedPlan,
          supplies: slotSupplies,
          snapshot: mixSnapshot
        })
      );
      setOverlay(closeFusionOverlay());
      setAddingApi(false);
      return;
    }
    applySelectId(id);
  };

  const firstSupplyId = availableSupplies[0]?.id;
  useEffect(() => {
    if (busy || selectedSupplyId || !firstSupplyId) return;
    const first = availableSupplies.find((item) => item.id === firstSupplyId);
    if (first) chooseSupply(first, { scroll: false });
  }, [busy, selectedSupplyId, firstSupplyId]);

  useEffect(() => {
    if (busy || selectedSupplyId || detecting) return;
    if (availableSupplies.length === 0 && !draftApiPlan) {
      setAddingApi(true);
      setSelectedSupplyId("api:new");
    }
  }, [busy, selectedSupplyId, detecting, availableSupplies.length, draftApiPlan]);

  const commitEditedSupplies = (nextSupplies: Record<WizardSlot, SlotSupply>) => {
    if (!selectedPlan || !selectedSupplyId || selectedSupplyId === "api:new") {
      setSlotSupplies(nextSupplies);
      return;
    }
    applyMixView(
      reduceMixAfterEdit(
        {
          selectedId: selectedSupplyId,
          plan: selectedPlan,
          supplies: slotSupplies ?? nextSupplies,
          snapshot: mixSnapshot
        },
        nextSupplies,
        titleForSupplyId(selectedSupplyId === MIX_SNAPSHOT_ID ? mixSnapshot?.baseId ?? selectedSupplyId : selectedSupplyId)
      )
    );
  };

  const onPlanModelChange = (slot: WizardSlot, model: string) => {
    if (busy || !slotSupplies) return;
    const supply = slotSupplies[slot];
    if (supply.kind === "skip") return;
    commitEditedSupplies({ ...slotSupplies, [slot]: { ...supply, model } });
  };

  const onHouseChange = (slot: WizardSlot, next: SlotSupply) => {
    if (busy || !slotSupplies) return;
    const withHouse = applySlotHousePreset(slot, next, clis);
    const seeded =
      withHouse.kind === "api" && !withHouse.baseURL.trim() && !withHouse.apiKey.trim() && !withHouse.model.trim()
        ? apiDraftFromSecrets(effectiveSecrets)
        : withHouse;
    commitEditedSupplies({ ...slotSupplies, [slot]: seeded });
    setSameFamilyBlocked(false);
  };

  const switchDialogToApi = () => {
    if (!slotSupplies) return;
    commitEditedSupplies({ ...slotSupplies, dialog: apiDraftFromSecrets(effectiveSecrets) });
    setOverlay({ type: "house", slot: "dialog" });
    setPhase("idle");
    setError(null);
  };

  const applySelectedPlan = () => {
    if (!selectedPlan || !slotSupplies) return;
    if (slotSupplies.dialog.kind === "skip") {
      setError("对话槽必须配置。");
      return;
    }
    if (advancedNotice) {
      const evaluator = slotSupplies.evaluator;
      if (evaluator.kind === "skip") {
        setError("撤销豁免时必须同时重配评估槽,不能跳过。");
        return;
      }
      if (evaluator.kind !== "api") {
        setError("撤销评估器资格豁免需把评估槽换成 API 配置。");
        return;
      }
    }
    for (const slot of WIZARD_SLOTS) {
      const supply = slotSupplies[slot];
      if (supply.kind === "skip") continue;
      const reason = supplyBlockReason(supply, popoverPolicy(slot));
      if (reason) {
        setError(`${WIZARD_SLOT_LABEL[slot]}槽:${reason}`);
        return;
      }
    }
    const ackPlan = { ...selectedPlan, requiredAcks: effectiveRequiredAcks };
    if (!planAcksSatisfied(ackPlan, planAcks)) {
      setError("请分别确认评估器的隔离边界和同族风险。两项都由你显式决定,不会自动代签。");
      return;
    }
    const pending: Partial<Record<WizardSlot, SlotSupply>> = {};
    for (const slot of WIZARD_SLOTS) {
      const supply = slotSupplies[slot];
      if (supply.kind !== "skip") pending[slot] = supply;
    }
    setError(null);
    setBusy(true);
    setPhase("staging");
    setFailedAt("staging");
    setPhaseStartedAt(Date.now());
    queueMicrotask(() => scrollSetupAnchor(progressRef.current));
    void activateStagedPlan({
      stage: () =>
        saveSlotSupplies(
          pending,
          advancedNotice
            ? { evaluatorIsolationAck: false, evaluatorSameFamilyAck: false }
            : {
                evaluatorIsolationAck: planAcks.evaluatorIsolation,
                evaluatorSameFamilyAck: planAcks.evaluatorSameFamily
              }
        ),
      test: async () => {
        setPhase("testing_staged");
        setFailedAt("testing_staged");
        const results = await postSetupTest();
        setTestResults(results);
        return results;
      },
      activate: async () => {
        await restartAndTest(true);
      }
    })
      .then(({ failedSlots }) => {
        if (failedSlots.length > 0) {
          setPhase("failed");
          setError(
            `方案 self-test 未通过(${failedSlots.map((slot) => WIZARD_SLOT_LABEL[slot]).join("、")})。没有启用失败配置。`
          );
        }
      })
      .catch((err: unknown) => {
        if (!advancedNotice && err instanceof SetupApiError && err.hasViolation(ACKABLE_VIOLATION.sameFamily)) {
          setSameFamilyBlocked(true);
          setPhase("idle");
          setFailedAt(undefined);
          setError(null);
          return;
        }
        setPhase("failed");
        setError(setupErrorMessage(err));
      })
      .finally(() => setBusy(false));
  };

  const visibleSupplies: Array<{ id: string; title: string; line: string; plan: QuickConfigPlan; supply?: AvailableSupply }> = [
    ...availableSupplies.map((supply) => ({
      id: supply.id,
      title: supplyTitle(supply),
      line: supplyOneLiner(supply),
      plan: planForAvailableSupply(supply),
      supply
    })),
    ...(draftApiPlan
      ? [{ id: "api:draft", title: "刚填的 API", line: "四个槽都走这个端点 · 有效性以启动自检为准", plan: draftApiPlan }]
      : [])
  ];

  const supplyItems = [
    ...visibleSupplies.map((row) => ({ id: row.id, title: row.title, line: row.line })),
    { id: "api:new", title: "添加 API 直连", line: "填 baseURL + key,四个槽都走它" }
  ];
  const supplyList = detecting ? (
    <SupplySkeletonGrid variant={fusionLayout === "split" ? "rail" : "grid"} />
  ) : (
    <SupplyCardGrid
      variant={fusionLayout === "split" ? "rail" : "grid"}
      items={supplyItems}
      selectedId={addingApi ? "api:new" : selectedSupplyId}
      busy={busy}
      selectedCardRef={selectedCardRef}
      onSelect={trySelectId}
    />
  );
  const unreadyBlock =
    !detecting && unreadyClis.length > 0 ? (
      <div style={{ marginTop: 14 }} data-unready-entry data-unready-count={unreadyClis.length}>
        <button
          type="button"
          data-action="toggle-unready"
          disabled={busy}
          onClick={() => {
            if (busy) return;
            setShowUnready((open) => !open);
          }}
          style={{
            padding: 0,
            border: "none",
            background: "none",
            color: "var(--text-muted)",
            fontSize: "var(--text-xs)",
            cursor: busy ? "not-allowed" : "pointer",
            textDecoration: "underline"
          }}
        >
          另有 {unreadyClis.length} 家未就绪
        </button>
        {showUnready ? (
          <div style={{ marginTop: 8, display: "grid", gap: 8 }} data-unready-list>
            {unreadyClis.map((cli) => (
              <div
                key={cli.name}
                data-unready-cli={cli.name}
                style={{ padding: 10, border: "1px solid var(--line)", borderRadius: "var(--radius-xs)" }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
                  {cli.label ?? CLI_LABEL[cli.name] ?? cli.name}
                </span>
                <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  {unreadyReasonCopy(cli)}
                  {cli.version ? ` · ${cli.version}` : ""}
                </p>
                {unreadyCliAllowsLiveCheck(cli) ? (
                  <div className="flex gap-[8px] flex-wrap" style={{ marginTop: 8 }} data-unready-actions={cli.name}>
                    <button
                      type="button"
                      style={{ ...btnGhost, height: 28, fontSize: "var(--text-xs)" }}
                      data-action={`reprobe-${cli.name}`}
                      disabled={busy || reprobing}
                      onClick={() => reprobeOne(cli.name)}
                    >
                      重试
                    </button>
                    <button
                      type="button"
                      style={{ ...btnGhost, height: 28, fontSize: "var(--text-xs)" }}
                      data-action={`confirm-${cli.name}`}
                      disabled={busy || confirmingName === cli.name}
                      onClick={() => confirmCli(cli.name)}
                    >
                      {confirmingName === cli.name ? "真实测一发中" : "真实测一发(约 15-25 秒,会调用一次该 CLI)"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ) : null;
  const redetectButton = (
    <button
      type="button"
      style={{ ...btnGhost, height: 28, fontSize: "var(--text-xs)", marginTop: 10 }}
      data-action="redetect-all"
      data-reprobe-bypass="1"
      disabled={busy || reprobing}
      onClick={reprobeAll}
    >
      {reprobing ? "正在重新检测…" : "重新检测"}
    </button>
  );
  const mixCard =
    !detecting && mixSnapshot ? (
      <MixSnapshotCard
        selected={viewingMix}
        line={mixSnapshotLine(mixSnapshot)}
        busy={busy}
        onSelect={() => trySelectId(MIX_SNAPSHOT_ID)}
      />
    ) : null;
  const configPanel =
    !detecting && selectedPlan && slotSupplies && selectedSupplyId && selectedSupplyId !== "api:new" ? (
      <div data-inline-confirm data-setup-config-panel>
        {advancedNotice ? (
          <p data-advanced-notice style={{ margin: "0 0 12px", fontSize: "var(--text-sm)", color: "var(--color-warning)" }}>
            {advancedNotice}
          </p>
        ) : null}
        <PurposeZones
          supplies={slotSupplies}
          preset={selectedPlan.supplies}
          clis={clis}
          openModelSlot={openModelSlot}
          onOpenModelSlot={(slot) => setOverlay(slot ? setModelOverlay(true, slot) : closeFusionOverlay())}
          openHouseSlot={openHouseSlot}
          onOpenHouseSlot={(slot) => setOverlay(slot ? { type: "house", slot } : closeFusionOverlay())}
          onModelChange={onPlanModelChange}
          onHouseChange={onHouseChange}
          disabled={busy}
          reprobing={reprobing}
          onReprobeCli={reprobeOne}
          dialogZoneRef={dialogZoneRef}
        />
        <p style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--color-warning)" }}>{selectedPlan.cost}</p>
        {effectiveRequiredAcks.evaluatorIsolation ? (
          <label className="setup-ack-row">
            <input
              type="checkbox"
              checked={planAcks.evaluatorIsolation}
              disabled={busy}
              onChange={(event) => setPlanAcks((current) => ({ ...current, evaluatorIsolation: event.target.checked }))}
              data-plan-ack="evaluator-isolation"
            />
            <span>我知道 CLI 评估器可读取本机工作区,隔离边界弱于独立 API。</span>
          </label>
        ) : null}
        {effectiveRequiredAcks.evaluatorSameFamily ? (
          <label className="setup-ack-row">
            <input
              type="checkbox"
              checked={planAcks.evaluatorSameFamily}
              disabled={busy}
              onChange={(event) =>
                setPlanAcks((current) => ({ ...current, evaluatorSameFamily: event.target.checked }))
              }
              data-plan-ack="evaluator-same-family"
              data-field={sameFamilyBlocked ? "same-family-ack" : undefined}
            />
            <span>
              {sameFamilyBlocked
                ? "我知道评估会不够独立,还是这么配"
                : "我知道评估器和沉思槽同家族时可能一起犯错,仍接受这项风险。"}
            </span>
          </label>
        ) : null}
        {sameFamilyBlocked ? <div data-same-family-gate /> : null}
        <div ref={progressRef} style={{ scrollMarginTop: 24 }}>
          {busy || phase === "failed" || phase === "done" ? (
            <SetupProgress phase={phase} failedAt={failedAt} elapsedSec={elapsedSec} slowCliNote={planUsesCli} />
          ) : null}
        </div>
        {testResults ? <TestTrafficLight results={testResults} /> : null}
        {error ? (
          <p
            data-plan-error
            style={{ margin: "10px 0 0", fontSize: "var(--text-sm)", color: "var(--color-error)", whiteSpace: "pre-line" }}
          >
            {error}
          </p>
        ) : null}
        <div className="flex gap-[8px] flex-wrap" style={{ marginTop: 12 }}>
          <button type="button" style={btnCommit} disabled={busy} onClick={applySelectedPlan} data-action="start-supply">
            {busy ? startBusyLabel(phase) : startButtonLabel(mixedActive)}
          </button>
          {phase === "failed" ? (
            <>
              <button type="button" style={btnGhost} disabled={busy} onClick={applySelectedPlan} data-action="retry-supply">
                重试
              </button>
              <button
                type="button"
                style={btnGhost}
                disabled={busy}
                onClick={switchDialogToApi}
                data-action="switch-dialog-api"
              >
                对话改走 API
              </button>
            </>
          ) : null}
        </div>
      </div>
    ) : null;
  const addApiForm =
    !detecting && (addingApi || selectedSupplyId === "api:new") ? (
      <form
        onSubmit={onSaveRequiredDialogApi}
        data-required-dialog-api
        data-setup-config-panel
        style={{ marginTop: fusionLayout === "stack" ? 12 : 0, padding: 14, border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}
      >
        {field(
          "API baseURL",
          <input
            style={inputStyle}
            value={requiredDialogApi.baseURL}
            disabled={busy}
            onChange={(event) => setRequiredDialogApi((current) => ({ ...current, baseURL: event.target.value }))}
            data-field="required-base-url"
            autoComplete="off"
          />
        )}
        {field(
          "API key",
          <input
            style={inputStyle}
            type="password"
            value={requiredDialogApi.apiKey}
            disabled={busy}
            onChange={(event) => setRequiredDialogApi((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="提交后本地立即清空,永不回显"
            data-field="required-api-key"
            autoComplete="off"
          />
        )}
        {field(
          "模型名",
          <input
            style={inputStyle}
            value={requiredDialogApi.model}
            disabled={busy}
            onChange={(event) => setRequiredDialogApi((current) => ({ ...current, model: event.target.value }))}
            placeholder="deepseek/deepseek-chat"
            data-field="required-model"
            autoComplete="off"
          />
        )}
        <button type="submit" style={btnPrimary} disabled={busy} data-action="save-required-dialog-api">
          用这个 API 配四槽
        </button>
      </form>
    ) : null;

  return (
    <PaperCard className="setup-wizard">
      <div data-setup-wizard data-wizard-view="fusion" data-fusion-layout={fusionLayout}>
      <SectionTitle>选一个能用的供给</SectionTitle>

      {pendingInvalid ? (
        <p
          data-pending-invalid
          style={{
            margin: "0 0 12px",
            padding: "8px 10px",
            fontSize: "var(--text-sm)",
            color: "var(--color-error)",
            border: "1px solid var(--color-error)",
            borderRadius: "var(--radius-xs)"
          }}
        >
          有一份待生效配置校验失败——请按下面表单重填并保存。
        </p>
      ) : null}

      {detecting ? <DetectingProgressRow reprobing={reprobing} phase2Done={phase2Done} /> : null}
      {cliErrorCopy ? <CliProbeError copy={cliErrorCopy} onRetry={() => setCliProbeNonce((n) => n + 1)} /> : null}
      {!detecting && availableSupplies.length === 0 && !draftApiPlan ? (
        <p data-empty-supply style={{ margin: "0 0 10px", fontSize: "var(--text-sm)" }}>
          登录一个本机 CLI,或添加 API 直连
        </p>
      ) : null}
      {fusionLayout === "split" ? (
        <div className="setup-fusion" data-quick-setup>
          <div className="setup-fusion-left" data-fusion-left>
            {mixCard}
            {supplyList}
            {unreadyBlock}
            {!detecting ? redetectButton : null}
          </div>
          <div className="setup-fusion-right" data-fusion-right>
            {configPanel}
            {addApiForm}
          </div>
        </div>
      ) : (
        <div data-quick-setup>
          {mixCard}
          {supplyList}
          {configPanel}
          {addApiForm}
          {unreadyBlock}
          {!detecting && unreadyClis.length > 0 ? redetectButton : null}
        </div>
      )}
      </div>
    </PaperCard>
  );
}

export function summarizeTestResults(results: SetupTestResult): { slot: string; status: TestSlotStatus; error?: string }[] {
  return Object.entries(results)
    .filter(([slot]) => slot !== "voice")
    .map(([slot, r]) => ({
      slot,
      status: r.status,
      ...(r.error ? { error: r.error } : {})
    }));
}
