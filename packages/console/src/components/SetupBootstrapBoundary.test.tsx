import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { resolveSetupBootstrapState, SetupBootstrapAppSlot, SetupBootstrapBoundary } from "./SetupBootstrapBoundary";
import { SetupValueProvider, type SetupApi } from "../shell/SetupContext";
import type { SetupProbe } from "../lib/setupApi";

vi.mock("../mobile/MobileApp", () => ({
  MobileApp: () => <div data-mock-mobile-app="1" />
}));
vi.mock("../mobile/router", () => ({
  useMobileRoute: () => ({ page: "today" })
}));

function stubSetup(over: Partial<SetupApi> = {}): SetupApi {
  return {
    probe: null,
    probeError: null,
    probeErrorCode: null,
    loading: false,
    dialogReady: false,
    showWizardEntry: true,
    wizardOpen: false,
    setWizardOpen: () => {},
    refreshProbe: async () => null,
    peeked: false,
    setPeeked: () => {},
    ...over
  };
}

function readyProbe(): SetupProbe {
  return {
    config: { present: true, slots: { dialog: { status: "ok", provider: "codex_cli", effective: "active", mode: "oneshot" } } },
    secrets: {},
    acks: { evaluator_isolation: true, evaluator_same_family: true },
    hints: [],
    clis: [],
    voice: { asr: "down", tts: "down" },
    pendingConfig: null,
    pendingEnv: null,
    recovery: { active: false, mode: "normal", violations: [] }
  };
}

describe("晋升完成 → boundary 判定翻转 → AppContent 挂载", () => {
  it("晋升前向导不挂 AppContent;live self-test 后 dialogReady 翻转才挂载", () => {
    const before = resolveSetupBootstrapState({
      loading: false,
      showLoading: false,
      probePresent: true,
      probeError: null,
      dialogReady: false,
      peeked: false
    });
    expect(before).toBe("wizard");
    expect(
      renderToStaticMarkup(
        <SetupBootstrapAppSlot kind={before}>
          <div data-app-content>AppContent</div>
        </SetupBootstrapAppSlot>
      )
    ).not.toContain("data-app-content");

    const after = resolveSetupBootstrapState({
      loading: false,
      showLoading: false,
      probePresent: true,
      probeError: null,
      dialogReady: true,
      peeked: false
    });
    expect(after).toBe("app");
    const mounted = renderToStaticMarkup(
      <SetupBootstrapAppSlot kind={after}>
        <div data-app-content>AppContent</div>
      </SetupBootstrapAppSlot>
    );
    expect(mounted).toContain('data-setup-bootstrap="app"');
    expect(mounted).toContain("data-app-content");
    expect(mounted).toContain("AppContent");
  });

  it("SetupBootstrapBoundary 在 dialogReady 翻转后挂载 children", () => {
    const unready = renderToStaticMarkup(
      <SetupValueProvider value={stubSetup({ probe: readyProbe(), dialogReady: false })}>
        <SetupBootstrapBoundary>
          <div data-app-content>AppContent</div>
        </SetupBootstrapBoundary>
      </SetupValueProvider>
    );
    expect(unready).toContain('data-setup-bootstrap="wizard"');
    expect(unready).not.toContain("data-app-content");

    const ready = renderToStaticMarkup(
      <SetupValueProvider value={stubSetup({ probe: readyProbe(), dialogReady: true, showWizardEntry: false })}>
        <SetupBootstrapBoundary>
          <div data-app-content>AppContent</div>
        </SetupBootstrapBoundary>
      </SetupValueProvider>
    );
    expect(ready).toContain('data-setup-bootstrap="app"');
    expect(ready).toContain("data-app-content");
    expect(ready).toContain("AppContent");
  });

  it("peeked 清掉后仍以 dialogReady 为准,不得靠 peek 混进应用", () => {
    const setPeeked = vi.fn();
    const html = renderToStaticMarkup(
      <SetupValueProvider value={stubSetup({ probe: readyProbe(), dialogReady: true, peeked: false, setPeeked })}>
        <SetupBootstrapBoundary>
          <div data-app-content>AppContent</div>
        </SetupBootstrapBoundary>
      </SetupValueProvider>
    );
    expect(html).toContain("data-app-content");
  });

  it("remote-mobile 直挂移动树,不挂 children/桌面壳", () => {
    const html = renderToStaticMarkup(
      <SetupValueProvider
        value={stubSetup({
          probeError: "访问凭证已失效",
          probeErrorCode: "mobile_lan_route_rejected",
          dialogReady: false,
          peeked: false
        })}
      >
        <SetupBootstrapBoundary>
          <div data-app-content>AppContent</div>
        </SetupBootstrapBoundary>
      </SetupValueProvider>
    );
    expect(html).toContain('data-setup-bootstrap="remote-mobile"');
    expect(html).toContain("data-mock-mobile-app");
    expect(html).not.toContain("data-app-content");
    expect(html).not.toContain('data-setup-bootstrap="wizard"');
    expect(html).not.toContain('data-setup-bootstrap="app"');
  });

  it("token_mismatch 即使已 peek 仍停 probe-error", () => {
    const html = renderToStaticMarkup(
      <SetupValueProvider
        value={stubSetup({
          probeError: "访问凭证已失效",
          probeErrorCode: "token_mismatch",
          peeked: true
        })}
      >
        <SetupBootstrapBoundary>
          <div data-app-content>AppContent</div>
        </SetupBootstrapBoundary>
      </SetupValueProvider>
    );
    expect(html).toContain('data-setup-bootstrap="probe-error"');
    expect(html).not.toContain("data-mock-mobile-app");
    expect(html).not.toContain("data-app-content");
  });
});
