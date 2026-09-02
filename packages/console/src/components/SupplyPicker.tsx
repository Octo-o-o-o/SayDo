// 单个模型槽位的供给选择器:CLI 订阅与 API 直连并列,真实可用性以登录态和 self-test 为准。
//
// 模型输入三家统一为 combobox(输入即搜索、即手填),但候选的"完整度"如实分化:
//   cursor-agent ⇒ CLI 列的全集(实测 193 条),complete=true
//   codex/claude ⇒ 无列模型接口,候选=本机记录里真用过的 + 当前配置 + 官方别名,
//                  complete=false;不编造清单充数,可手填由 placeholder 承担
// 纪律:零 emoji;key 提交后由调用方清态,本组件不持久化 key。

import { useState, type CSSProperties } from "react";
import {
  CLI_LABEL,
  CLI_PROVIDER_CONTRACT,
  cliAuthLabel,
  cliAuthNeedsReprobe,
  cliModelRequired,
  cliUsable,
  cliWiredForSupply,
  WIRED_CLI_NAMES,
  reusableApiKeyEnvForBaseUrl,
  type CliCapability,
  type CliName,
  type CliProvider,
  type SlotPolicy,
  type SlotSupply
} from "../lib/setupApi";
import { SETUP_COPY } from "../lib/setupCopy";
import { ModelCombo } from "./ModelCombo";

const inputStyle: CSSProperties = {
  width: "100%",
  height: 34,
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

/** 供给来源卡片(CLI / API / 跳过) */
function SourceCard({
  active,
  disabled,
  title,
  badge,
  desc,
  hint,
  onClick,
  testId,
  pulsing,
  nested
}: {
  active: boolean;
  disabled?: boolean;
  title: string;
  badge?: string;
  desc?: string;
  hint?: string;
  onClick: () => void;
  testId: string;
  /** 探测中的占位卡:呼吸动画(reduced-motion 由 globals.css 全局降级) */
  pulsing?: boolean;
  /** 已包在列容器里:不要再吃 flex-basis,否则主轴变成高度 */
  nested?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={pulsing ? "saydo-breathing" : undefined}
      data-supply-source={testId}
      data-active={active ? "1" : undefined}
      style={{
        ...(nested ? { width: "100%" } : { flex: "1 1 180px", minWidth: 180 }),
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${active ? "var(--active-ink-border)" : "var(--line)"}`,
        background: active ? "var(--active-ink)" : "var(--surface-control)",
        color: active ? "var(--active-ink-fg)" : disabled ? "var(--text-faint)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? "var(--disabled-opacity)" : 1
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>{title}</span>
        {badge ? (
          <span style={{ fontSize: "var(--text-xs)", opacity: 0.85, whiteSpace: "nowrap" }}>{badge}</span>
        ) : null}
      </span>
      {desc ? (
        <span style={{ display: "block", marginTop: 4, fontSize: "var(--text-xs)", opacity: 0.8 }}>{desc}</span>
      ) : null}
      {hint ? (
        <span
          style={{
            display: "block",
            marginTop: 4,
            fontSize: "var(--text-xs)",
            fontFamily: "var(--font-mono)",
            color: active ? "var(--active-ink-fg)" : "var(--color-warning)"
          }}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}



export function SupplyPicker({
  clis,
  value,
  onChange,
  allowSkip,
  slotKey,
  policy,
  loading,
  disabled,
  reprobing,
  onReprobeCli
}: {
  clis: CliCapability[];
  value: SlotSupply;
  onChange: (next: SlotSupply) => void;
  /** dialog 槽必配,不给跳过 */
  allowSkip: boolean;
  /** data 属性用,便于定位是哪个槽 */
  slotKey: string;
  /** 该槽允许的供给(与 daemon 校验规则对齐);缺省=不限 */
  policy?: SlotPolicy;
  /** CLI 探测进行中 ⇒ 渲染占位卡 */
  loading?: boolean;
  /** 启动后 busy 锁:禁止换供给/改模型 */
  disabled?: boolean;
  /** 轻量重探进行中:行内「重新检测」防抖 */
  reprobing?: boolean;
  /** 未登录/登录态未知的卡行内重探;不传则不渲染入口 */
  onReprobeCli?: (name: CliName) => void;
}) {
  const reusableKeyName = value.kind === "api" ? reusableApiKeyEnvForBaseUrl(value.baseURL) : null;
  const storedApiKeyAvailable =
    value.kind === "api" &&
    value.baseURL.trim() !== "" &&
    ((reusableKeyName !== null && value.presentKeyNames?.includes(reusableKeyName) === true) ||
      value.writtenKeyBaseURL?.trim() === value.baseURL.trim());
  type WiredCli = CliCapability & { provider: CliProvider };
  const selectedCli: WiredCli | null =
    value.kind === "cli"
      ? (clis.find((c): c is WiredCli => c.provider === value.provider && c.provider !== null) ?? null)
      : null;
  const cliAllowed = (p: CliCapability): boolean =>
    Boolean(p.provider) && (!policy || policy.allowedCli.includes(p.provider as CliProvider));
  /** 本槽可选的已接线 CLI;仅识别的主流 agent 另列,避免误点 */
  const supplyClis = clis.filter((c): c is WiredCli => cliWiredForSupply(c));
  const inventoryClis = clis.filter((c) => !cliWiredForSupply(c) && c.found);
  const [modelOpen, setModelOpen] = useState(false);

  const pickCli = (c: CliCapability) => {
    if (!c.provider) return;
    // 同家保留已选模型;换家清空,由 onHouseChange → applySlotHousePreset 填新家对应档
    // ack 是对"走 CLI 会慢"的知情确认,与具体哪个 CLI 无关,切换提供商不用重勾
    const keepModel = value.kind === "cli" && value.provider === c.provider ? value.model : undefined;
    const keepAck = value.kind === "cli" ? value.ack : undefined;
    onChange({
      kind: "cli",
      provider: c.provider,
      ...(keepModel ? { model: keepModel } : {}),
      ...(keepAck ? { ack: true } : {})
    });
  };

  /** 改模型时保住 ack(否则勾了又被清掉) */
  const setCliModel = (model: string) => {
    if (!selectedCli?.provider) return;
    const keepAck = value.kind === "cli" ? value.ack : undefined;
    onChange({ kind: "cli", provider: selectedCli.provider, model, ...(keepAck ? { ack: true } : {}) });
  };

  return (
    <div data-supply-picker={slotKey}>
      <div className="flex flex-wrap gap-[8px]" style={{ marginBottom: 12 }}>
        {/* 探测未回来时占位:只占已接线 CLI,避免把仅识别 agent 渲染成"能配" */}
        {loading && supplyClis.length === 0 && policy?.showCliOptions !== false
          ? WIRED_CLI_NAMES.map((name) => (
              <SourceCard
                key={name}
                testId={`cli-loading:${name}`}
                active={false}
                disabled
                pulsing
                title={CLI_LABEL[name] ?? name}
                badge="检测中"
                desc={SETUP_COPY.cliLoading}
                onClick={() => {}}
              />
            ))
          : null}
        {policy?.showCliOptions === false
          ? null
          : supplyClis.map((c) => {
              const allowed = cliAllowed(c);
              const usable = cliUsable(c) && allowed;
              const showInlineReprobe = onReprobeCli != null && cliAuthNeedsReprobe(c.auth.status);
              return (
                <div
                  key={c.name}
                  data-cli-card-wrap={c.name}
                  style={{ flex: "1 1 180px", minWidth: 180, display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <SourceCard
                    testId={`cli:${c.name}`}
                    nested
                    active={value.kind === "cli" && value.provider === c.provider}
                    disabled={disabled || !usable}
                    title={c.label ?? CLI_LABEL[c.name] ?? c.name}
                    badge={allowed ? cliAuthLabel(c.auth.status) : "此槽不可用"}
                    desc={
                      !allowed
                        ? undefined
                        : !c.found
                          ? "本机没装"
                          : c.enumerable && c.models.length > 0
                            ? SETUP_COPY.enumerableCount(c.models.length)
                            : SETUP_COPY.noListNote
                    }
                    hint={
                      !allowed
                        ? policy?.cliBlockedReason
                        : c.auth.status === "not_logged_in"
                          ? c.auth.fixHint
                          : undefined
                    }
                    onClick={() => pickCli(c)}
                  />
                  {showInlineReprobe ? (
                    <button
                      type="button"
                      data-action={`reprobe-${c.name}`}
                      disabled={disabled || reprobing}
                      onClick={() => onReprobeCli(c.name)}
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: "var(--radius-xs)",
                        border: "1px solid var(--line)",
                        background: "var(--surface-control)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-xs)",
                        cursor: disabled || reprobing ? "not-allowed" : "pointer",
                        opacity: disabled || reprobing ? "var(--disabled-opacity)" : 1
                      }}
                    >
                      {reprobing ? "正在重新检测…" : "重新检测"}
                    </button>
                  ) : null}
                </div>
              );
            })}
        <SourceCard
          testId="api"
          active={value.kind === "api"}
          disabled={disabled}
          title="API 直连"
          badge="按量计费"
          desc="填 baseURL + key,用已配置的 OpenAI 兼容对话端点(不表示工具或 Structured Outputs 等价)"
          onClick={() =>
            onChange(
              value.kind === "api" ? value : { kind: "api", baseURL: "", apiKey: "", model: "" }
            )
          }
        />
        {allowSkip ? (
          <SourceCard
            testId="skip"
            active={value.kind === "skip"}
            disabled={disabled}
            title="暂不配"
            desc="以后在设置页随时补;不影响先开聊"
            onClick={() => onChange({ kind: "skip" })}
          />
        ) : null}
      </div>
      {policy?.showCliOptions !== false && inventoryClis.length > 0 ? (
        <p
          data-inventory-clis
          style={{ margin: "-4px 0 12px", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}
        >
          {SETUP_COPY.inventoryOthers(
            inventoryClis.map((c) => c.label ?? CLI_LABEL[c.name] ?? c.name).join("、")
          )}
        </p>
      ) : null}

      {policy?.caveat ? (
        <p
          data-slot-caveat
          style={{ margin: "-4px 0 12px", fontSize: "var(--text-xs)", color: "var(--color-warning)" }}
        >
          {policy.caveat}
        </p>
      ) : null}

      {selectedCli && policy?.cliWarning && cliNeedsAck(selectedCli.provider, policy) ? (
        <div
          data-cli-warning
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--color-warning)",
            background: "var(--surface-ink-wash)"
          }}
        >
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{policy.cliWarning}</p>
          {cliNeedsAck(selectedCli.provider, policy) ? (
            <label className="setup-ack-row" style={{ color: "var(--text-secondary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                data-field="cli-ack"
                checked={value.kind === "cli" ? value.ack === true : false}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...(value as { kind: "cli"; provider: typeof selectedCli.provider; model?: string }), ack: e.target.checked })
                }
                style={{ cursor: disabled ? "not-allowed" : "pointer" }}
              />
              <span>{policy.cliAckLabel ?? "我知道有上面这个代价,还是要用它"}</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {selectedCli ? (
        <div data-supply-detail="cli">
          {selectedCli.auth.detail ? (
            <p style={{ margin: "0 0 8px", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
              {selectedCli.auth.detail.split("\n")[0]?.slice(0, 90)}
            </p>
          ) : null}
          <div style={{ marginTop: 4 }}>
            <label style={labelStyle}>
              {CLI_PROVIDER_CONTRACT[selectedCli.provider].modelRequired
                ? "模型名"
                : `模型名(可留空,用 ${selectedCli.label ?? CLI_LABEL[selectedCli.name] ?? selectedCli.name} 默认模型)`}
            </label>
            <ModelCombo
              slotKey={slotKey}
              models={selectedCli.models}
              value={value.kind === "cli" ? (value.model ?? "") : ""}
              onChange={setCliModel}
              complete={selectedCli.enumerable}
              open={modelOpen}
              onOpenChange={setModelOpen}
              disabled={disabled}
              surface="inset"
              hint={
                selectedCli.enumerable
                  ? undefined
                  : selectedCli.models.some((model) => model.source === "used" || model.source === "configured" || model.source === "alias")
                    ? undefined
                    : SETUP_COPY.transportHint
              }
              {...(selectedCli.models.length === 0
                ? {
                    placeholder: CLI_PROVIDER_CONTRACT[selectedCli.provider].modelRequired
                      ? "直接填模型名"
                      : `留空则用 ${selectedCli.label ?? CLI_LABEL[selectedCli.name] ?? selectedCli.name} 默认模型`
                  }
                : {})}
            />
          </div>
        </div>
      ) : null}

      {value.kind === "api" ? (
        <div data-supply-detail="api">
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>API baseURL</label>
            <input
              style={inputStyle}
              value={value.baseURL}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, baseURL: e.target.value })}
              placeholder="https://openrouter.ai/api/v1"
              data-field="base-url"
              autoComplete="off"
            />
            {value.baseURL.trim() ? (
              <p
                data-derived-via
                style={{
                  margin: "4px 0 0",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-faint)"
                }}
              >
                {SETUP_COPY.apiKeyReuse}
              </p>
            ) : null}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>API key</label>
            <input
              style={inputStyle}
              type="password"
              value={value.apiKey}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
              placeholder="提交后本地立即清空,永不回显"
              data-field="api-key"
              autoComplete="off"
            />
            {storedApiKeyAvailable && !value.apiKey.trim() ? (
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                {SETUP_COPY.storedKeyReuse}
              </p>
            ) : null}
          </div>
          <div>
            <label style={labelStyle}>模型名</label>
            <input
              style={inputStyle}
              value={value.model}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, model: e.target.value })}
              placeholder="deepseek/deepseek-chat"
              data-field="model"
              autoComplete="off"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 这个槽 + 这个 CLI 的组合是否需要知情确认 */
export function cliNeedsAck(provider: CliProvider, policy?: SlotPolicy): boolean {
  return policy?.cliAckRequiredFor?.includes(provider) === true;
}

/** 该槽供给是否已填够(可提交) */
export function supplyReady(s: SlotSupply, policy?: SlotPolicy): boolean {
  if (s.kind === "skip") return true;
  if (s.kind === "cli") {
    if (policy && !policy.allowedCli.includes(s.provider)) return false;
    // 代价大的组合要先勾知情确认(按 provider 判:evaluator 选 claude 就不必打扰)
    if (cliNeedsAck(s.provider, policy) && !s.ack) return false;
    if (!cliModelRequired(s.provider)) return true;
    return !!(s.model && s.model.trim());
  }
  const reusableKeyName = reusableApiKeyEnvForBaseUrl(s.baseURL);
  const storedKeyAvailable =
    s.baseURL.trim() !== "" &&
    ((reusableKeyName !== null && s.presentKeyNames?.includes(reusableKeyName) === true) ||
      s.writtenKeyBaseURL?.trim() === s.baseURL.trim());
  return !!(s.baseURL.trim() && (s.apiKey.trim() || storedKeyAvailable) && s.model.trim());
}

/** 未填够时的人话原因(给按钮旁的提示) */
export function supplyBlockReason(s: SlotSupply, policy?: SlotPolicy): string | null {
  if (supplyReady(s, policy)) return null;
  if (s.kind === "cli") {
    if (policy && !policy.allowedCli.includes(s.provider)) {
      return policy.cliBlockedReason ?? "这个槽位暂不能使用所选 CLI";
    }
    if (cliNeedsAck(s.provider, policy) && !s.ack) return "尚未确认这项代价";
    return "请选一个模型,或手填模型名";
  }
  if (s.kind === "api") {
    if (!s.baseURL.trim()) return "请填 API baseURL";
    const reusableKeyName = reusableApiKeyEnvForBaseUrl(s.baseURL);
    const storedKeyAvailable =
      (reusableKeyName !== null && s.presentKeyNames?.includes(reusableKeyName) === true) ||
      (s.baseURL.trim() !== "" && s.writtenKeyBaseURL?.trim() === s.baseURL.trim());
    if (!s.apiKey.trim() && !storedKeyAvailable) return "请填 API key";
    return "请填模型名";
  }
  return null;
}
