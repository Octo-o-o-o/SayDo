import { isProxy as nodeIsProxy } from "node:util/types";

export function isObjectLike(value: unknown): value is object {
  return value != null && (typeof value === "object" || typeof value === "function");
}

export function isProxyValue(value: unknown): boolean {
  try {
    return nodeIsProxy(value);
  } catch {
    return false;
  }
}

/**
 * trap-free own-data errno。Proxy / revoked / accessor / 继承 code 一律不算。
 * 仅 own-data 字符串 `code` 可被 kill/probe 合同识别。
 */
export function readOwnErrnoCode(err: unknown): string | undefined {
  if (!isObjectLike(err) || isProxyValue(err)) return undefined;
  try {
    const own = Object.getOwnPropertyDescriptor(err, "code");
    if (!own || own.get !== undefined || own.set !== undefined) return undefined;
    return typeof own.value === "string" ? own.value : undefined;
  } catch {
    return undefined;
  }
}

export type KillProbeKind = "gone" | "alive" | "unknown";

/** 存在性探测：own-data ESRCH=gone，own-data EPERM=alive，其余 unknown。 */
export function classifyKillProbe(err: unknown): KillProbeKind {
  const code = readOwnErrnoCode(err);
  if (code === "ESRCH") return "gone";
  if (code === "EPERM") return "alive";
  return "unknown";
}

export function isOwnErrno(err: unknown, expected: string): boolean {
  return readOwnErrnoCode(err) === expected;
}

export function readOwnData(
  obj: object,
  key: PropertyKey
): { ok: true; present: boolean; value: unknown } | { ok: false } {
  if (isProxyValue(obj)) return { ok: false };
  try {
    const own = Object.getOwnPropertyDescriptor(obj, key);
    if (!own) return { ok: true, present: false, value: undefined };
    if (own.get !== undefined || own.set !== undefined) return { ok: false };
    return { ok: true, present: true, value: own.value };
  } catch {
    return { ok: false };
  }
}

export const PROCESS_PROBE_UNKNOWN = "process probe unknown";
export const PROCESS_KILL_UNKNOWN = "process kill unknown";
