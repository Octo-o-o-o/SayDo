// 首启门:挂在 SetupProvider 内、AppContent 外。loading / probe 失败 / 向导 / 应用 / remote-mobile。
// 300ms 内判定完成则一帧 Loading 都不闪;probe 失败不得 fail-open 成已配好。
// remote-mobile:LAN 扫码撞上 probe 白名单拒绝时直挂移动树,不走桌面 Layout / 向导。

import { useEffect, useState, type ReactNode } from "react";
import { SayDoBrandLockup, SetupGate } from "./SetupGate";
import { useSetup } from "../shell/SetupContext";
import { MobileApp } from "../mobile/MobileApp";
import { useMobileRoute } from "../mobile/router";

export const SETUP_LOADING_DELAY_MS = 300;
export const REMOTE_MOBILE_PROBE_CODE = "mobile_lan_route_rejected";

export type SetupBootstrapKind = "pending" | "loading" | "probe-error" | "wizard" | "app" | "remote-mobile";

export function resolveSetupBootstrapState(input: {
  loading: boolean;
  showLoading: boolean;
  probePresent: boolean;
  probeError: string | null;
  probeErrorCode?: string | null;
  dialogReady: boolean;
  peeked: boolean;
}): SetupBootstrapKind {
  if (input.loading) return input.showLoading ? "loading" : "pending";
  if (!input.probePresent && input.probeError) {
    if (input.probeErrorCode === REMOTE_MOBILE_PROBE_CODE) return "remote-mobile";
    return "probe-error";
  }
  if (!input.dialogReady && !input.peeked) return "wizard";
  return "app";
}

function isDevWalkthroughHash(hash: string): boolean {
  return hash.includes("dev-components") || hash.includes("dev-pages");
}

export function SetupLoadingScreen() {
  return (
    <div
      data-setup-bootstrap="loading"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-app)",
        color: "var(--text-primary)",
        padding: 24
      }}
    >
      <div className="saydo-breathing" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <SayDoBrandLockup />
        </div>
        <p style={{ margin: "12px 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          正在看这台机器的资源…
        </p>
      </div>
    </div>
  );
}

export function SetupProbeErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      data-setup-bootstrap="probe-error"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-app)",
        padding: 24
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          padding: 18,
          border: "1px solid var(--color-error)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface, var(--surface-control))"
        }}
      >
        <p style={{ margin: 0, fontSize: "var(--text-lg, 18px)", color: "var(--text-primary)", fontWeight: 600 }}>
          没连上本机服务/读不到配置
        </p>
        <p style={{ margin: "8px 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          现在不能判断这台机器有没有配好,也不会假装已经配好。
        </p>
        <pre
          style={{
            margin: "12px 0 0",
            padding: 10,
            overflow: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            whiteSpace: "pre-wrap"
          }}
        >
          {message}
        </pre>
        <button
          type="button"
          data-action="retry-setup-probe"
          onClick={onRetry}
          style={{
            height: 34,
            marginTop: 14,
            padding: "0 14px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--active-ink-border)",
            background: "var(--active-ink)",
            color: "var(--active-ink-fg)",
            fontSize: "var(--text-sm)",
            cursor: "pointer"
          }}
        >
          重试
        </button>
      </div>
    </div>
  );
}

export function SetupBootstrapBoundary({ children }: { children: ReactNode }) {
  const setup = useSetup();
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!setup.loading) {
      setShowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoading(true), SETUP_LOADING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [setup.loading]);

  const kind = resolveSetupBootstrapState({
    loading: setup.loading,
    showLoading,
    probePresent: setup.probe !== null,
    probeError: setup.probeError,
    probeErrorCode: setup.probeErrorCode,
    dialogReady: setup.dialogReady,
    peeked: setup.peeked
  });

  if (kind === "pending") return <div data-setup-bootstrap="pending" />;
  if (kind === "loading") return <SetupLoadingScreen />;
  if (kind === "remote-mobile") return <RemoteMobileShell />;
  if (kind === "probe-error") {
    return <SetupProbeErrorCard message={setup.probeError ?? ""} onRetry={() => void setup.refreshProbe()} />;
  }
  if (kind === "wizard") {
    if (typeof location !== "undefined" && isDevWalkthroughHash(location.hash)) {
      return <>{children}</>;
    }
    return (
      <div data-setup-bootstrap="wizard">
        <SetupGate />
      </div>
    );
  }
  return <SetupBootstrapAppSlot kind={kind}>{children}</SetupBootstrapAppSlot>;
}

/** LAN remote-mobile:自己取移动路由并直挂 MobileApp,不走 AppContent/视口分树/桌面 Layout。 */
export function RemoteMobileShell() {
  const mobileRoute = useMobileRoute();
  return (
    <div data-setup-bootstrap="remote-mobile" style={{ display: "contents" }}>
      <MobileApp route={mobileRoute} />
    </div>
  );
}

/** 仅判定为 app 时挂载应用壳;向导态与 remote-mobile 不挂 AppContent。 */
export function SetupBootstrapAppSlot({ kind, children }: { kind: SetupBootstrapKind; children: ReactNode }) {
  if (kind !== "app") return null;
  return (
    <div data-setup-bootstrap="app" style={{ display: "contents" }}>
      {children}
    </div>
  );
}
