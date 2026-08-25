/** 明确 composition 注入；生产默认无 hook、不读 ambient global / 环境开关。 */

export interface DaemonStartupHooks {
  recoverReject?: unknown;
  recoverHold?: Promise<void>;
  listenHold?: Promise<void>;
  closeDurables?: () => void;
  /** 首次 bind 回调内；生产默认 no-op。 */
  onListening?: () => void;
  /** 紧贴 `tier1Executor.recover()` 调用前；生产默认 no-op。 */
  beforeRecover?: () => void;
  /** 紧贴 `tier1Executor.recover()` 调用前的独立观测点；生产默认 no-op。 */
  onRecoverAttempt?: () => void;
  /** 进入 production `recover()` 内部 await 后；生产默认 no-op。 */
  onRecoverEntered?: () => void;
  /** 早期 signal claim 之后；测试可尝试抢 restart，生产默认 no-op。 */
  afterNoteShutdown?: (api: { claimRestart: () => boolean }) => void;
}

let hooks: DaemonStartupHooks = {};

export function setDaemonStartupHooks(next: DaemonStartupHooks | null): void {
  hooks = next ?? {};
}

export function daemonStartupHooks(): DaemonStartupHooks {
  return hooks;
}
