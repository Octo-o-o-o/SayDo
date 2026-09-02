// 全局设置(#/settings;五槽位模型配置用表格而非五张卡 11 §5.8;密钥永不显示;
// 引擎/预算默认/免打扰/Gate 0 状态展示)。
// First-run:顶部配置向导 + 槽位状态点(probe 派生) + 对话槽「重新配置」。

import { Settings2 } from "lucide-react";
import { useState, type CSSProperties, type FormEvent } from "react";
import { api, type Row } from "../lib/api";
import {
  DISPLAY_TO_PROBE_SLOT,
  MODEL_SLOT_DESCRIPTION,
  postSetupTest,
  postTier1SetupTest,
  saveVoiceSecrets,
  setupErrorMessage,
  slotEffectiveLabel,
  testStatusColor,
  testStatusLabel,
  type ProbeSlot,
  type ProbeSlotState,
  type SetupProbe,
  type SetupTestSlot,
  type SlotHealth,
  type Tier1SelfTestReport
} from "../lib/setupApi";
import { useAsync } from "../lib/useAsync";
import { useSetup } from "../shell/SetupContext";
import { SetupWizard } from "../components/SetupWizard";
import { ErrorCard, PaperCard, Mono, SectionTitle } from "../components/ui";
import {
  VOICE_SETTINGS_COPY,
  detectSystemVoiceCaps,
  isVolcConfigured,
  reportSystemVoiceTest
} from "../voice/systemVoice";

const SLOT_LABEL: Record<string, string> = {
  dialog: "对话",
  thinking: "沉思",
  cheap: "廉价",
  evaluator: "评估",
  dev: "开发"
};

/** 设置状态表中提示去向导切换提供商的槽;开发槽保持只读。 */
const MIXABLE_SLOTS = new Set(["thinking", "evaluator"]);

const voiceInputStyle: CSSProperties = {
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

/**
 * L5(2026-08-09):如实渲染 modelBinding 联合(contracts modelBindingSchema)——
 * 字符串简写 = {provider:"api",model:<串>} 官方端点;provider=*_cli = 已登记并经 self-test 门控的本机 CLI 配置;
 * via = 命名端点(providers.api.<via>);dev 槽为 {agent,model,transport?}。
 * 旧实现的 via="subscription_cli" 词表在真实 schema 中不存在:字符串简写被渲染成「未配置」、
 * CLI 槽被误标 api——本函数按真实形状归一,缺 model 的 CLI 槽如实显示「按 CLI 默认」。
 */
function slotModelView(raw: unknown): { model: string; feed: string } {
  if (raw == null) return { model: "未配置", feed: "—" };
  if (typeof raw === "string") return { model: raw, feed: "api" };
  if (typeof raw !== "object") return { model: "未配置", feed: "—" };
  const o = raw as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = o[k];
    return typeof v === "string" && v !== "" ? v : null;
  };
  const model = str("model");
  const via = str("via");
  const provider = str("provider");
  const agent = str("agent"); // dev 槽({agent,model,transport?})
  if (agent !== null) return { model: model ?? "按执行器默认", feed: `sub · ${agent}` };
  if (provider === "api") return { model: model ?? "未配置", feed: via !== null ? `api · ${via}` : "api" };
  if (provider !== null) {
    const feed = provider.endsWith("_cli") ? `sub · ${provider.slice(0, -"_cli".length)}` : provider;
    return { model: model ?? `按 ${provider} 默认`, feed };
  }
  return { model: model ?? "未配置", feed: "—" };
}

function statusDotColor(state: ProbeSlotState | undefined): string {
  if (state?.effective === "active") return "var(--color-success)";
  if (state?.effective === "fallback_dialog") return "var(--color-warning)";
  const h = state?.status;
  if (h === "configured") return "var(--color-warning)";
  if (h === "key_missing") return "var(--color-warning)";
  if (h === "missing") return "var(--color-error)";
  return "var(--text-faint)";
}

function probeHealthForDisplay(
  slots: Partial<Record<ProbeSlot, ProbeSlotState>> | undefined,
  displaySlot: string
): SlotHealth | undefined {
  const probeKey = DISPLAY_TO_PROBE_SLOT[displaySlot];
  if (!probeKey || !slots) return undefined;
  return slots[probeKey]?.status;
}

export function GlobalSettings() {
  const setup = useSetup();
  const [advancedNotice, setAdvancedNotice] = useState<string | null>(null);
  const [focusDialog, setFocusDialog] = useState(0);
  const [volcAppId, setVolcAppId] = useState("");
  const [volcToken, setVolcToken] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSaved, setVoiceSaved] = useState(false);
  const [voiceTesting, setVoiceTesting] = useState(false);
  const [voiceTest, setVoiceTest] = useState<SetupTestSlot | null>(null);
  const [tier1Testing, setTier1Testing] = useState(false);
  const [tier1Test, setTier1Test] = useState<Tier1SelfTestReport | null>(null);
  const [tier1Error, setTier1Error] = useState<string | null>(null);
  const { data, error } = useAsync(() => api.config(), [setup.probe]);
  const showWizard = setup.wizardOpen || setup.showWizardEntry;

  const onSaveVoice = (event: FormEvent) => {
    event.preventDefault();
    setVoiceError(null);
    setVoiceBusy(true);
    const appId = volcAppId;
    const token = volcToken;
    setVolcAppId("");
    setVolcToken("");
    void saveVoiceSecrets({ appId, accessToken: token })
      .then(() => {
        setVoiceSaved(true);
      })
      .catch((err: unknown) => {
        setVoiceError(setupErrorMessage(err));
      })
      .finally(() => setVoiceBusy(false));
  };

  const onTestVoice = () => {
    setVoiceError(null);
    if (!isVolcConfigured(setup.probe)) {
      setVoiceTest(reportSystemVoiceTest(detectSystemVoiceCaps()));
      return;
    }
    setVoiceTesting(true);
    void postSetupTest({ scope: "voice" })
      .then((results) => {
        setVoiceTest(results.voice ?? { status: "untested", error: "未返回语音结果" });
      })
      .catch((err: unknown) => {
        setVoiceError(setupErrorMessage(err));
      })
      .finally(() => setVoiceTesting(false));
  };

  const onTestTier1 = () => {
    setTier1Error(null);
    setTier1Testing(true);
    void postTier1SetupTest()
      .then(setTier1Test)
      .catch((err: unknown) => setTier1Error(setupErrorMessage(err)))
      .finally(() => setTier1Testing(false));
  };

  if (error) return <ErrorCard message="设置加载失败" detail={error} />;
  if (!data) return null;
  const models = (data["models"] ?? {}) as Record<string, Row>;
  const budget = (data["budget"] ?? {}) as Row;
  const dnd = (data["dnd"] ?? {}) as Row;
  const gate0 = (data["gate0"] ?? {}) as Row;
  const params = (data["params"] ?? {}) as Row;
  const tier1 = data["tier1"] && typeof data["tier1"] === "object" ? (data["tier1"] as Row) : null;
  const probeSlots = setup.probe?.config.slots;

  return (
    <div className="flex flex-col gap-[var(--space-4)]" data-page="settings">
      <SectionTitle>全局设置</SectionTitle>

      {showWizard ? (
        <SetupWizard
          probe={setup.probe}
          onDone={() => {
            setup.setPeeked(false);
            setup.setWizardOpen(false);
            setAdvancedNotice(null);
            void setup.refreshProbe();
          }}
          onProbeRefresh={() => setup.refreshProbe()}
          advancedNotice={advancedNotice}
          openDialogEditorRequest={focusDialog}
          embedded
        />
      ) : (
        <PaperCard data-setup-entry>
          <div className="flex items-center justify-between gap-[12px]">
            <div>
              <SectionTitle>配置向导</SectionTitle>
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                对话模型已就绪。若要更换 API key 或模型,可重新走配置向导。
              </p>
            </div>
            <button
              type="button"
              data-action="open-wizard"
              onClick={() => setup.setWizardOpen(true)}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--line)",
                background: "var(--surface-control)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              重新配置
            </button>
          </div>
        </PaperCard>
      )}

      {setup.probe?.pendingConfig?.status === "validation_failed" && !showWizard ? (
        <ErrorCard message="有一份待生效配置校验失败" detail="打开配置向导重填并保存" />
      ) : null}

      <PaperCard>
        <SectionTitle>五槽位模型</SectionTitle>
        <table style={{ width: "100%", fontSize: "var(--text-sm)", borderCollapse: "collapse" }} data-model-slots>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>
              <th style={{ paddingBottom: 8 }}>槽位</th>
              <th>状态</th>
              <th>模型</th>
              <th>供给</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {Object.keys(SLOT_LABEL).map((slot) => {
              const v = slotModelView(models[slot]);
              const health = probeHealthForDisplay(probeSlots, slot);
              const probeKey = DISPLAY_TO_PROBE_SLOT[slot];
              const effectiveState = probeKey ? probeSlots?.[probeKey] : undefined;
              const isMixable = MIXABLE_SLOTS.has(slot);
              return (
                <tr key={slot} style={{ height: 40, borderTop: "1px solid var(--line)" }} data-slot={slot}>
                  <td>
                    <div>{SLOT_LABEL[slot]}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                      {MODEL_SLOT_DESCRIPTION[slot as keyof typeof MODEL_SLOT_DESCRIPTION]}
                    </div>
                  </td>
                  <td>
                    <span
                      className="inline-flex items-center gap-[6px]"
                      data-slot-health={health ?? "unknown"}
                      data-slot-effective={effectiveState?.effective ?? "unknown"}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: statusDotColor(effectiveState),
                          display: "inline-block"
                        }}
                      />
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        {slotEffectiveLabel(probeKey ?? "dev", effectiveState)}
                      </span>
                    </span>
                  </td>
                  <td>
                    <Mono>{v.model}</Mono>
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-xs)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius-2xs)",
                        padding: "1px 6px",
                        color: "var(--text-muted)"
                      }}
                    >
                      {v.feed}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {slot === "dialog" ? (
                      <button
                        type="button"
                        data-action="reconfigure-dialog"
                        onClick={() => {
                          setFocusDialog((n) => n + 1);
                          setup.setWizardOpen(true);
                        }}
                        style={{
                          height: 28,
                          padding: "0 10px",
                          borderRadius: "var(--radius-2xs)",
                          border: "1px solid var(--line)",
                          background: "transparent",
                          color: "var(--active-ink)",
                          fontSize: "var(--text-xs)",
                          cursor: "pointer"
                        }}
                      >
                        重新配置
                      </button>
                    ) : isMixable ? (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                        在向导里逐槽切换提供商
                      </span>
                    ) : slot === "dev" ? (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                        留空 · 稍后在设置里配
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
          密钥永不在界面显示;前四槽可用 API 按量计费,也可用已接线并通过调用验证的 CLI。对话 CLI 是每轮约 15-25 秒的慢速模式;登录或订阅不等于可调用,费用以服务商为准;开发槽保持只读现状。
        </p>
      </PaperCard>
      <EvaluatorSafetyCard
        acks={setup.probe?.acks ?? null}
        hints={setup.probe?.hints ?? []}
        onRevoke={() => {
          setAdvancedNotice("撤销后,评估器会改走独立 API,需要重新配置");
          setup.setWizardOpen(true);
        }}
      />
      <Tier1ExecutorCard
        config={tier1}
        report={tier1Test}
        testing={tier1Testing}
        error={tier1Error}
        onTest={onTestTier1}
      />
      <PaperCard data-voice-settings>
        <SectionTitle>语音</SectionTitle>
        <p style={{ margin: "0 0 10px", fontSize: "var(--text-sm)", color: "var(--text-muted)" }} data-voice-copy>
          {VOICE_SETTINGS_COPY}
        </p>
        <form onSubmit={onSaveVoice}>
          <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>
            VOLC_APP_ID
          </label>
          <input
            style={voiceInputStyle}
            type="password"
            value={volcAppId}
            onChange={(e) => setVolcAppId(e.target.value)}
            autoComplete="off"
            data-field="volc-app-id"
          />
          <label
            style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "10px 0 4px" }}
          >
            VOLC_ACCESS_TOKEN
          </label>
          <input
            style={{ ...voiceInputStyle, marginBottom: 12 }}
            type="password"
            value={volcToken}
            onChange={(e) => setVolcToken(e.target.value)}
            autoComplete="off"
            data-field="volc-token"
          />
          <button
            type="submit"
            disabled={voiceBusy}
            data-action="save-voice"
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--active-ink-border)",
              background: "var(--active-ink)",
              color: "var(--active-ink-fg)",
              fontSize: "var(--text-sm)",
              cursor: voiceBusy ? "wait" : "pointer"
            }}
          >
            {voiceBusy ? "保存中…" : "保存语音配置"}
          </button>
        </form>
        {voiceSaved ? (
          <p data-voice-saved style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            已写入,重启服务后生效。
          </p>
        ) : null}
        {voiceError ? (
          <p data-voice-error style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--color-error)" }}>
            {voiceError}
          </p>
        ) : null}
        <div className="flex items-center gap-[10px] flex-wrap" style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={voiceTesting}
            data-action="test-voice"
            onClick={onTestVoice}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--line)",
              background: "var(--surface-control)",
              color: "var(--text-primary)",
              fontSize: "var(--text-sm)",
              cursor: voiceTesting ? "wait" : "pointer"
            }}
          >
            {voiceTesting ? "正在测语音…" : "测试语音"}
          </button>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }} data-voice-probe>
            当前 ASR {setup.probe?.voice.asr ?? "unknown"} / TTS {setup.probe?.voice.tts ?? "unknown"}
            {setup.probe?.voice.note ? ` · ${setup.probe.voice.note}` : ""}
          </span>
        </div>
        {voiceTest ? (
          <p data-voice-test-result style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: testStatusColor(voiceTest.status) }}>
            {testStatusLabel(voiceTest.status)}
            {voiceTest.error ? ` · ${voiceTest.error}` : ""}
          </p>
        ) : null}
      </PaperCard>
      <PaperCard>
        <SectionTitle>预算与免打扰</SectionTitle>
        <div className="flex flex-col gap-[6px]" style={{ fontSize: "var(--text-sm)" }}>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>任务默认预算</span>
            <Mono>{String(budget["default_task_max_cost"] ?? "20")} 元</Mono>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>免打扰窗口</span>
            <Mono>{String(dnd["window"] ?? "23:00-08:00")}</Mono>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>会话空闲挂起</span>
            <Mono>{String(params["session_idle_suspend_sec"] ?? 45)} 秒</Mono>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
          预算/免打扰本批只读,不提供写入。
        </p>
      </PaperCard>
      <PaperCard>
        <SectionTitle>Gate 0</SectionTitle>
        <div className="flex items-center gap-[10px]" style={{ fontSize: "var(--text-sm)" }} data-gate0>
          <Settings2 size={16} color="var(--text-muted)" aria-hidden />
          <span>
            {gate0["enabled"] === false ? "已关闭(dispatch 一律拒绝)" : "已启用"}
            {gate0["bypass"] === true ? " · bypass 异常置位(会拒 dispatch)" : ""}
          </span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
          Gate 0 六项(身份/幂等/验收 oracle/密钥隔离/审计/删除传播)状态是显式配置 + 审计事件;代码无 bypass 分支。
        </p>
      </PaperCard>
    </div>
  );
}

function tier1Check(report: Tier1SelfTestReport | null, name: string) {
  return report?.checks.find((check) => check.name === name);
}

function tier1StatusText(report: Tier1SelfTestReport | null): string {
  if (!report) return "未测试";
  if (report.status === "ok") return "检查通过";
  if (report.status === "unsupported") return "当前后端不支持自检";
  return "检查未通过";
}

export function tier1ResetText(value: unknown): string {
  if (typeof value !== "string" || value === "") return "没有已知限流记录";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "限流记录时间不可读";
  return `预计 ${parsed.toLocaleString("zh-CN", { hour12: false })} 重置`;
}

export function Tier1ExecutorCard({
  config,
  report,
  testing,
  error,
  onTest
}: {
  config: Row | null;
  report: Tier1SelfTestReport | null;
  testing: boolean;
  error: string | null;
  onTest: () => void;
}) {
  const adapter = typeof config?.["adapter"] === "string" ? String(config["adapter"]) : "未配置";
  const model = typeof config?.["model"] === "string" && config["model"] !== "" ? String(config["model"]) : "按执行器默认";
  const pinnedVersion =
    typeof config?.["pinnedVersion"] === "string" && config["pinnedVersion"] !== ""
      ? String(config["pinnedVersion"])
      : "未配置";
  const version = tier1Check(report, "version");
  const auth = tier1Check(report, "auth");
  const failed = report?.checks.find((check) => check.status === "fail");
  const loginText = !report ? "未测试" : auth?.status === "ok" ? "已登录" : auth?.status === "fail" ? "未通过" : "不适用";
  const measuredVersion = version?.status === "ok" && version.detail ? version.detail : "未测试";
  return (
    <PaperCard data-tier1-settings>
      <div className="flex items-center justify-between gap-[12px]">
        <div>
          <SectionTitle>开发执行器</SectionTitle>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            这里检查真正执行任务的 Tier1 后端;模型槽位的 CLI 自检不代替本项。
          </p>
        </div>
        <button
          type="button"
          data-action="test-tier1"
          disabled={testing}
          onClick={onTest}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--line)",
            background: "var(--surface-control)",
            color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
            cursor: testing ? "wait" : "pointer",
            whiteSpace: "nowrap"
          }}
        >
          {testing ? "正在检查…" : "检查执行器"}
        </button>
      </div>
      <div className="flex flex-col gap-[6px]" style={{ marginTop: 12, fontSize: "var(--text-sm)" }}>
        <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>后端</span><Mono>{adapter}</Mono></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>模型</span><Mono>{model}</Mono></div>
        <div className="flex justify-between" data-tier1-pinned-version>
          <span style={{ color: "var(--text-muted)" }}>pin 版本</span>
          <Mono>{pinnedVersion}</Mono>
        </div>
        <div className="flex justify-between" data-tier1-version>
          <span style={{ color: "var(--text-muted)" }}>实测版本</span>
          <Mono>{measuredVersion}</Mono>
        </div>
        <div className="flex justify-between" data-tier1-login><span style={{ color: "var(--text-muted)" }}>登录态</span><span>{loginText}</span></div>
        <div className="flex justify-between" data-tier1-self-test><span style={{ color: "var(--text-muted)" }}>自检</span><span>{tier1StatusText(report)}</span></div>
        <div className="flex justify-between" data-tier1-window>
          <span style={{ color: "var(--text-muted)" }}>五小时窗</span>
          <span>{tier1ResetText(config?.["nextRateLimitResetAt"])}</span>
        </div>
      </div>
      {failed?.error ? (
        <p data-tier1-failure style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--color-error)" }}>
          {failed.error}
        </p>
      ) : null}
      {report?.prescription ? (
        <p data-tier1-prescription style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--color-warning)" }}>
          {report.prescription}
        </p>
      ) : null}
      {error ? (
        <p data-tier1-error style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--color-error)" }}>
          {error}
        </p>
      ) : null}
    </PaperCard>
  );
}

export function shouldShowEvaluatorSafety(
  acks: SetupProbe["acks"] | null | undefined
): boolean {
  return Boolean(acks?.evaluator_isolation || acks?.evaluator_same_family);
}

export function EvaluatorSafetyCard({
  acks,
  hints,
  onRevoke
}: {
  acks: SetupProbe["acks"] | null;
  hints: SetupProbe["hints"];
  onRevoke: () => void;
}) {
  if (!shouldShowEvaluatorSafety(acks) || !acks) return null;
  const sameFamilyHint = hints.find((hint) => hint.code === "evaluator_same_family_acked")?.message;
  return (
    <PaperCard data-active-acks>
      <SectionTitle>评估器安全确认</SectionTitle>
      <p style={{ margin: "0 0 10px", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
        配置时你确认过两件事:评估器和干活的模型是同一家族(可能一起犯错);CLI 评估器能读到这台电脑上的文件。
      </p>
      <div className="flex flex-col gap-[8px]" style={{ fontSize: "var(--text-sm)" }}>
        <div data-ack="same-family">
          评估器和干活的模型是同一家族(可能一起犯错)
          <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
            {acks.evaluator_same_family ? "已确认" : "未确认"}
          </span>
        </div>
        <div data-ack="isolation">
          CLI 评估器能读到这台电脑上的文件
          <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
            {acks.evaluator_isolation ? "已确认" : "未确认"}
          </span>
        </div>
        <button
          type="button"
          style={{
            alignSelf: "flex-start",
            height: 32,
            padding: "0 12px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--line)",
            background: "var(--surface-control)",
            color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
            cursor: "pointer"
          }}
          onClick={onRevoke}
          data-action="guide-revoke-acks"
          title="撤销后,评估器会改走独立 API,需要重新配置"
        >
          撤销确认
        </button>
        <details data-ack-tech style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          <summary style={{ cursor: "pointer" }}>技术详情</summary>
          <div style={{ marginTop: 8, fontFamily: "var(--font-mono)" }}>
            evaluator_same_family_ack = {String(acks.evaluator_same_family)}
          </div>
          <div style={{ fontFamily: "var(--font-mono)" }}>
            evaluator_isolation_ack = {String(acks.evaluator_isolation)}
          </div>
          {sameFamilyHint ? <p style={{ margin: "6px 0 0" }}>{sameFamilyHint}</p> : null}
        </details>
      </div>
    </PaperCard>
  );
}
