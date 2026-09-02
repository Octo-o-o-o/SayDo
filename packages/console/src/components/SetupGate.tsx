// 全局首启门禁:对话槽没配好之前,进哪一页都先弹配置向导(不再只挂在对话页)。
// 逃生口「先随便看看」——点了才放行,之后顶栏常驻一条入口,随时点回来。
// loading / probe 失败由 SetupBootstrapBoundary 在本组件外判定;本组件只处理未配好且未 peek。

import { useEffect, useState } from "react";
import {
  DIALOG_CLI_UNSUPPORTED_MESSAGE,
  getInvalidProjectOverrides,
  isDialogCliUnsupported,
  postClearInvalidProjectOverrides,
  type InvalidProjectOverrideIssue
} from "../lib/setupApi";
import { useSetup } from "../shell/SetupContext";
import saydoMark from "../assets/saydo-mark.png";
import {
  FUSION_SPLIT_CONTENT_MAX_WIDTH,
  FUSION_STACK_CONTENT_MAX_WIDTH,
  fusionLayoutForViewport,
  SetupWizard,
  wizardContentMaxWidth
} from "./SetupWizard";

/** /health identity.sourceRevision 前 7 位;缺字段或过短则不显示 */
export function shortSourceRevision(raw: unknown): string | null {
  const rec = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const identity =
    rec["identity"] !== null && typeof rec["identity"] === "object"
      ? (rec["identity"] as Record<string, unknown>)
      : {};
  const src =
    (typeof identity["sourceRevision"] === "string" ? identity["sourceRevision"] : "") ||
    (typeof rec["runtimeSha"] === "string" ? rec["runtimeSha"] : "") ||
    (typeof rec["sourceRevision"] === "string" ? rec["sourceRevision"] : "");
  const trimmed = src.trim();
  if (trimmed.length < 7) return null;
  return trimmed.slice(0, 7);
}

export const SETUP_WIZARD_CONTENT_MAX_WIDTH = FUSION_STACK_CONTENT_MAX_WIDTH;
export const SETUP_WIZARD_SPLIT_MAX_WIDTH = FUSION_SPLIT_CONTENT_MAX_WIDTH;

export function SayDoBrandLockup({ size = 24 }: { size?: number } = {}) {
  return (
    <div data-setup-brand-lockup style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <img
        src={saydoMark}
        alt=""
        aria-hidden
        data-setup-wizard-seal
        style={{ width: size, height: size, borderRadius: "var(--radius-2xs)", flexShrink: 0, display: "block" }}
      />
      <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          data-brand-cn
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: size === 24 ? 18 : 16,
            color: "var(--text-primary)",
            letterSpacing: "0.2px"
          }}
        >
          说到
        </span>
        <span
          data-brand-en
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: size === 24 ? 18 : 16,
            color: "var(--text-primary)",
            letterSpacing: "0.2px"
          }}
        >
          SayDo
        </span>
      </span>
    </div>
  );
}

export function SetupWizardBrandHeader({ contentMaxWidth = SETUP_WIZARD_CONTENT_MAX_WIDTH }: { contentMaxWidth?: number } = {}) {
  return (
    <header
      data-setup-wizard-header
      style={{
        height: 56,
        width: "100%",
        boxSizing: "border-box",
        background: "var(--bg-app)",
        borderBottom: "1px solid var(--line)",
        flex: "0 0 auto"
      }}
    >
      <div
        data-setup-wizard-header-inner
        style={{
          width: "100%",
          maxWidth: contentMaxWidth,
          height: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px"
        }}
      >
        <SayDoBrandLockup />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>首次配置</span>
      </div>
    </header>
  );
}

export function SetupWizardBrandFooter({ revision }: { revision: string | null }) {
  return (
    <footer
      data-setup-wizard-footer
      style={{
        marginTop: 24,
        paddingTop: 12,
        borderTop: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontSize: "var(--text-sm)",
        color: "var(--text-muted)"
      }}
    >
      <span>本机运行 · 外发范围以当前配置为准</span>
      {revision ? <span data-setup-wizard-revision>版本 {revision}</span> : null}
    </footer>
  );
}

/** 未配好时顶栏常驻入口(用户点过「先看看」之后才出现) */
export function SetupBanner() {
  const setup = useSetup();
  if (setup.loading || setup.dialogReady || !setup.peeked) return null;
  const dialogCliUnsupported = isDialogCliUnsupported(setup.probe);
  return (
    <button
      type="button"
      data-setup-banner
      onClick={() => setup.setPeeked(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "8px 14px",
        border: "none",
        borderBottom: "1px solid var(--color-error)",
        background: "var(--surface-ink-wash)",
        color: "var(--text-primary)",
        fontSize: "var(--text-sm)",
        cursor: "pointer",
        textAlign: "left"
      }}
    >
      <span
        aria-hidden
        style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-error)", flex: "0 0 auto" }}
      />
      <span>
        {dialogCliUnsupported
          ? "对话档的 CLI self-test 尚未通过"
          : "对话模型还没配好,现在还聊不了"}
      </span>
    </button>
  );
}

export function SetupGate() {
  const setup = useSetup();
  const [dialogEditorRequest, setDialogEditorRequest] = useState(0);
  const [clearingOverrides, setClearingOverrides] = useState(false);
  const [clearOverridesError, setClearOverridesError] = useState<string | null>(null);
  const [clearedOverrides, setClearedOverrides] = useState(false);
  const [invalidOverrides, setInvalidOverrides] = useState<InvalidProjectOverrideIssue[]>([]);
  const [overrideClearReceipt, setOverrideClearReceipt] = useState<string | null>(null);
  const dialogCliUnsupported = isDialogCliUnsupported(setup.probe);
  const [sourceRevision, setSourceRevision] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? SETUP_WIZARD_CONTENT_MAX_WIDTH : window.innerWidth
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const fusionLayout = fusionLayoutForViewport(viewportWidth, false);
  const contentMaxWidth = wizardContentMaxWidth(fusionLayout);
  useEffect(() => {
    let alive = true;
    void fetch("/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: unknown) => {
        if (!alive) return;
        const short = shortSourceRevision(body);
        if (short) setSourceRevision(short);
      })
      .catch(() => {
        // 失败不显示不报错
      });
    return () => {
      alive = false;
    };
  }, []);
  const hasInvalidProjectOverrides =
    !clearedOverrides &&
    setup.probe?.recovery.violations.some((violation) => violation.code?.startsWith("project_override_")) === true;
  useEffect(() => {
    if (!hasInvalidProjectOverrides) {
      setInvalidOverrides([]);
      setOverrideClearReceipt(null);
      return;
    }
    let alive = true;
    void getInvalidProjectOverrides()
      .then((listing) => {
        if (alive) {
          setInvalidOverrides(listing.issues);
          setOverrideClearReceipt(listing.receipt);
        }
      })
      .catch((error) => {
        if (alive) setClearOverridesError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      alive = false;
    };
  }, [hasInvalidProjectOverrides]);

  // 加载中 / 已配好 / probe 探测失败 ⇒ 不拦
  if (setup.loading || setup.dialogReady || setup.peeked) return null;

  // 向导态是独立页面,不是叠加弹窗:铺 --bg-app,滚动交还 body。
  // 不带 role=dialog / aria-modal / fixed / overflow——SetupWizard 根组件也不得接管这些样式
  // (GlobalSettings 内嵌同一向导,固定层会把它从设置页里拽出去)。
  return (
    <div
      data-setup-gate
      aria-label="配置向导"
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "var(--bg-app)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch"
      }}
    >
      <SetupWizardBrandHeader contentMaxWidth={contentMaxWidth} />
      <div
        style={{
          width: "100%",
          maxWidth: contentMaxWidth,
          margin: "0 auto",
          padding: "24px 16px 48px",
          boxSizing: "border-box"
        }}
      >
        <h1
          style={{
            margin: "0 0 6px",
            fontSize: "var(--text-2xl, 24px)",
            color: "var(--text-primary)",
            fontWeight: 600
          }}
        >
          {dialogCliUnsupported ? "完成对话 CLI 自检" : "先把对话模型配好"}
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {dialogCliUnsupported
            ? DIALOG_CLI_UNSUPPORTED_MESSAGE
            : "没有对话模型,说到聊不了天,也就立不起要持续关注的事。已接线并通过调用验证的本机 CLI 可以零 key 慢速开聊;登录不等于可调用或免费,费用以服务商为准。API 时延以服务商和网络条件为准,不保证秒回。"}
        </p>

        {hasInvalidProjectOverrides ? (
          <div
            data-invalid-project-overrides-recovery
            style={{ marginBottom: 14, padding: 12, border: "1px solid var(--color-warning)", borderRadius: "var(--radius-sm)" }}
          >
            <p style={{ margin: "0 0 8px", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
              有存量项目模型覆盖不再合法。下面会列出整行删除影响的字段;确认后项目将重新继承全局配置。
            </p>
            {invalidOverrides.length > 0 ? (
              <ul data-invalid-project-overrides-list style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: "var(--text-xs)" }}>
                {invalidOverrides.map((issue) => (
                  <li key={issue.projectId}>
                    {issue.projectId}（将删除整份覆盖: {issue.affectedKeys.join(", ") || "整份覆盖"}）
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              data-action="clear-invalid-project-overrides"
              disabled={clearingOverrides || invalidOverrides.length === 0 || overrideClearReceipt === null}
              onClick={() => {
                if (overrideClearReceipt === null) return;
                setClearingOverrides(true);
                setClearOverridesError(null);
                void postClearInvalidProjectOverrides(
                  overrideClearReceipt,
                  invalidOverrides.map((issue) => issue.projectId)
                )
                  .then(() => {
                    setClearedOverrides(true);
                    setOverrideClearReceipt(null);
                    return setup.refreshProbe();
                  })
                  .catch((error) => setClearOverridesError(error instanceof Error ? error.message : String(error)))
                  .finally(() => setClearingOverrides(false));
              }}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--active-ink-border)",
                background: "var(--active-ink)",
                color: "var(--active-ink-fg)",
                fontSize: "var(--text-sm)",
                cursor: clearingOverrides ? "wait" : "pointer"
              }}
            >
              {clearingOverrides ? "正在删除…" : "删除所列项目的整份覆盖"}
            </button>
            {clearOverridesError ? (
              <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--color-error)" }}>
                {clearOverridesError}
              </p>
            ) : null}
          </div>
        ) : null}

        {clearedOverrides ? (
          <p data-invalid-project-overrides-cleared style={{ margin: "0 0 14px", fontSize: "var(--text-sm)", color: "var(--color-success)" }}>
            失效的项目覆盖已清除。请继续选择方案并重启,项目会继承新的全局配置。
          </p>
        ) : null}

        {dialogCliUnsupported ? (
          <button
            type="button"
            data-action="edit-dialog-slot"
            onClick={() => setDialogEditorRequest((request) => request + 1)}
            style={{
              height: 34,
              marginBottom: 14,
              padding: "0 14px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--active-ink-border)",
              background: "var(--active-ink)",
              color: "var(--active-ink-fg)",
              fontSize: "var(--text-sm)",
              cursor: "pointer"
            }}
          >
            重试自检或改配对话槽
          </button>
        ) : null}

        <SetupWizard
          probe={setup.probe}
          onDone={() => {
            setup.setPeeked(false);
            setup.setWizardOpen(false);
          }}
          onProbeRefresh={() => setup.refreshProbe()}
          openDialogEditorRequest={dialogEditorRequest}
          layout={fusionLayout}
        />

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button
            type="button"
            data-action="peek-anyway"
            onClick={() => setup.setPeeked(true)}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: "var(--text-sm)",
              cursor: "pointer"
            }}
          >
            先随便看看,晚点再配
          </button>
        </div>
        <SetupWizardBrandFooter revision={sourceRevision} />
      </div>
    </div>
  );
}
