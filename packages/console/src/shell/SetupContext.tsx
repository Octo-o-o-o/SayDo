// First-run setup 状态(App 载入 probe;dialog 非 ok ⇒ 对话页引导 + 设置页向导)。
// 不改 VoiceContext 语音逻辑;仅提供配置就绪态给页面消费。

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  fetchSetupProbe,
  isDialogReadyFromProbe,
  needsSetupWizard,
  type SetupProbe
} from "../lib/setupApi";
import { ApiError } from "../lib/apiError";

export type SetupApi = {
  probe: SetupProbe | null;
  /** probe 请求失败人话;null=无错或尚未结束 */
  probeError: string | null;
  /** daemon 统一错误 code;null=网络层或尚未结束。remote-mobile 只认精确码 */
  probeErrorCode: string | null;
  loading: boolean;
  /** dialog 槽已就绪;probe 失败时为 false,不得 fail-open 成已配好 */
  dialogReady: boolean;
  /** 应展示向导入口 */
  showWizardEntry: boolean;
  /** 设置页向导是否展开(对话页「去设置」可强制打开) */
  wizardOpen: boolean;
  setWizardOpen: (open: boolean) => void;
  refreshProbe: (opts?: { autoOpenWizard?: boolean }) => Promise<SetupProbe | null>;
  /** 用户点过「先随便看看」——全局 gate 让路,顶栏常驻入口顶上 */
  peeked: boolean;
  setPeeked: (v: boolean) => void;
};

/** 逃生口选择持久化:配好之前每次开都拦,除非用户明确说过先看看 */
const PEEK_KEY = "saydo.setup.peeked";

function readPeeked(): boolean {
  try {
    return globalThis.localStorage?.getItem(PEEK_KEY) === "1";
  } catch {
    return false;
  }
}

const SetupCtx = createContext<SetupApi | null>(null);

/** probe 失败时保留 daemon code;remote-mobile 只认精确码,不得靠人话文案猜。 */
export function probeFailureFromCaught(e: unknown): { message: string; code: string | null } {
  return {
    message: e instanceof Error ? e.message : String(e),
    code: e instanceof ApiError ? (e.code ?? null) : null
  };
}

/** 单测注入:晋升完成后把 dialogReady 翻成 true,断言 AppContent 挂载。 */
export function SetupValueProvider({ value, children }: { value: SetupApi; children: ReactNode }) {
  return <SetupCtx.Provider value={value}>{children}</SetupCtx.Provider>;
}

export function SetupProvider({ children }: { children: ReactNode }) {
  const [probe, setProbe] = useState<SetupProbe | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probeErrorCode, setProbeErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [peeked, setPeekedState] = useState<boolean>(readPeeked);
  const probeGen = useRef(0);

  const setPeeked = useCallback((v: boolean) => {
    setPeekedState(v);
    try {
      if (v) globalThis.localStorage?.setItem(PEEK_KEY, "1");
      else globalThis.localStorage?.removeItem(PEEK_KEY);
    } catch {
      // localStorage 不可用(隐私模式)时只保内存态,不报错打断配置
    }
  }, []);

  const refreshProbe = useCallback(async (opts?: { autoOpenWizard?: boolean }): Promise<SetupProbe | null> => {
    const gen = ++probeGen.current;
    try {
      const p = await fetchSetupProbe();
      if (gen !== probeGen.current) return p;
      setProbe(p);
      setProbeError(null);
      setProbeErrorCode(null);
      // 仅首载 autoOpen:dialog 非 ok 时默认展开向导;后续 refresh 不抢用户收起态
      if (opts?.autoOpenWizard && needsSetupWizard(p)) setWizardOpen(true);
      return p;
    } catch (e) {
      if (gen !== probeGen.current) return null;
      // 端点失败:probe 保持 null,由 SetupBootstrapBoundary 进第三态,不得当成已配好
      const failure = probeFailureFromCaught(e);
      setProbe(null);
      setProbeError(failure.message);
      setProbeErrorCode(failure.code);
      return null;
    } finally {
      if (gen === probeGen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProbe({ autoOpenWizard: true });
  }, [refreshProbe]);

  const value = useMemo<SetupApi>(
    () => ({
      probe,
      probeError,
      probeErrorCode,
      loading,
      dialogReady: isDialogReadyFromProbe(probe),
      showWizardEntry: probe !== null && needsSetupWizard(probe),
      wizardOpen,
      setWizardOpen,
      refreshProbe,
      peeked,
      setPeeked
    }),
    [probe, probeError, probeErrorCode, loading, wizardOpen, refreshProbe, peeked, setPeeked]
  );

  return <SetupCtx.Provider value={value}>{children}</SetupCtx.Provider>;
}

export function useSetup(): SetupApi {
  const v = useContext(SetupCtx);
  if (!v) throw new Error("useSetup outside SetupProvider");
  return v;
}
