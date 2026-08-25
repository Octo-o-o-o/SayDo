import { readOwnErrnoCode } from "@saydo/platform";
import {
  performEmergencyCleanup,
  TIER1_EMERGENCY_CLEANUP_DEADLINE_MS
} from "./independentDeadline.js";

export const DAEMON_INSTANCE_LOCK_FAILED = "daemon instance lock failed";
export const DAEMON_LISTEN_FAILED = "daemon listen failed";
export const TIER1_EXECUTOR_STARTUP_FAILED = "tier1 executor startup failed";
export const DAEMON_FATAL_MESSAGE = "daemon fatal";
export const DAEMON_SHUTDOWN_FAILED = "daemon shutdown failed";
export const TIER1_EMERGENCY_CLEANUP_DEADLINE = "tier1 emergency cleanup deadline exceeded";
export const TIER1_EMERGENCY_CLEANUP_FAILED = "tier1 emergency cleanup failed";
export const BOOT_ACTIVATION_FAILED = "boot activation failed";
export const BOOT_ACTIVATION_ROLLBACK_FAILED = "boot activation rollback failed";
export const DATABASE_CLOSE_FAILED = "database close failed";

/** 只认 own-data `EEXIST`，Proxy/accessor/primitive 一律不是。 */
export function isOwnEexist(err: unknown): boolean {
  return readOwnErrnoCode(err) === "EEXIST";
}

export function projectDaemonLockFailure(_err: unknown): Error {
  return new Error(DAEMON_INSTANCE_LOCK_FAILED);
}

export function listenFatalCode(err: unknown): "port_conflict" | "listen_failed" {
  return readOwnErrnoCode(err) === "EADDRINUSE" ? "port_conflict" : "listen_failed";
}

export function listenFatalMessage(err: unknown): string {
  return readOwnErrnoCode(err) === "EADDRINUSE" ? "port_conflict" : DAEMON_LISTEN_FAILED;
}

function projectUntrustedDaemonText(_err: unknown, fallback: string): string {
  try {
    return fallback;
  } catch {
    return fallback;
  }
}

export function projectTier1StartupFailureText(err: unknown): string {
  return projectUntrustedDaemonText(err, TIER1_EXECUTOR_STARTUP_FAILED);
}

export function projectDaemonFatalMessage(err: unknown): string {
  return projectUntrustedDaemonText(err, DAEMON_FATAL_MESSAGE);
}

export function projectDaemonShutdownFailureText(err: unknown): string {
  return projectUntrustedDaemonText(err, DAEMON_SHUTDOWN_FAILED);
}

export function projectBootActivationFailure(_err: unknown): string {
  return projectUntrustedDaemonText(_err, BOOT_ACTIVATION_FAILED);
}

export function projectBootActivationRollbackFailure(_err: unknown): string {
  return projectUntrustedDaemonText(_err, BOOT_ACTIVATION_ROLLBACK_FAILED);
}

export function projectDatabaseCloseFailure(_err: unknown): string {
  return projectUntrustedDaemonText(_err, DATABASE_CLOSE_FAILED);
}

export function captureStartupFatalProjection(err: unknown): {
  startup: string;
  fatal: string;
  shutdown: string;
} {
  try {
    return {
      startup: projectTier1StartupFailureText(err),
      fatal: projectDaemonFatalMessage(err),
      shutdown: projectDaemonShutdownFailureText(err)
    };
  } catch {
    return {
      startup: TIER1_EXECUTOR_STARTUP_FAILED,
      fatal: DAEMON_FATAL_MESSAGE,
      shutdown: DAEMON_SHUTDOWN_FAILED
    };
  }
}

export interface Tier1StartupFailureSinks {
  closeGate: () => Promise<void>;
  logError: (msg: string, fields?: Record<string, unknown>) => void;
  audit: (action: string, meta: Record<string, string>) => void;
  sendFatal: (code: string, message: string) => Promise<void>;
  exit: (code: number) => void;
}

/** 启动失败后的受控收口：cleanup 任一失败都 fatal；投影/日志/审计自身失败不得泄漏原文或悬挂。 */
export async function settleTier1StartupFailure(
  err: unknown,
  cleanupWork: Promise<unknown>,
  sinks: Tier1StartupFailureSinks,
  deadlineMs = TIER1_EMERGENCY_CLEANUP_DEADLINE_MS
): Promise<"fatal-exit" | "executor-disabled"> {
  const execDone = Promise.resolve(cleanupWork).then(() => undefined);
  const gateClosed = Promise.resolve().then(() => sinks.closeGate());
  void execDone.then(() => undefined, () => undefined);
  void gateClosed.then(() => undefined, () => undefined);
  const cleanup = await performEmergencyCleanup(
    Promise.all([execDone, gateClosed]),
    "tier1-startup-emergency-cleanup",
    deadlineMs
  );
  const reason = projectTier1StartupFailureText(err);
  try {
    sinks.logError("tier1 executor disabled: version pin assertion failed", { error: reason });
  } catch {
    // catch 自身不得再抛。
  }
  try {
    sinks.audit("tier1.executor_disabled", { reason });
  } catch {
    // 审计失败不得阻断 fail-closed。
  }
  if (cleanup.ok !== true) {
    const code = cleanup.deadline ? "tier1_emergency_cleanup_deadline" : "tier1_emergency_cleanup_failed";
    const message = cleanup.deadline ? TIER1_EMERGENCY_CLEANUP_DEADLINE : TIER1_EMERGENCY_CLEANUP_FAILED;
    try {
      sinks.logError("daemon shutdown failed", { code, message });
    } catch {
      // ignore
    }
    try {
      sinks.audit("tier1.executor_disabled", { reason: message });
    } catch {
      // ignore
    }
    try {
      await sinks.sendFatal(code, message);
    } catch {
      // ignore
    }
    sinks.exit(1);
    return "fatal-exit";
  }
  return "executor-disabled";
}
