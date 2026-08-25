/** 跨进程 home owner boundary：OS 在进程退出时释放的 advisory lock，crash 后不永久遗留。 */

import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { hostKind } from "./host.js";
import { isReparsePoint, restrictOwnerOnly } from "./fs.js";
import { tryLockFileExclusiveWin32 } from "./win32.js";

const require = createRequire(import.meta.url);

export const HOME_OWNER_LOCK_TIMEOUT = "home owner lock timeout";
export const HOME_OWNER_LOCK_FAILED = "home owner lock failed";
export const HOME_OWNER_LOCK_ABORTED = "home owner lock aborted";

const LOCK_EX = 2;
const LOCK_NB = 4;
const LOCK_UN = 8;
const DEFAULT_DEADLINE_MS = 5_000;

const homeLockErrors = new WeakSet<object>();

function lockError(message: string): Error {
  const err = new Error(message);
  homeLockErrors.add(err);
  return err;
}

function isHomeLockError(err: unknown): err is Error {
  return typeof err === "object" && err !== null && homeLockErrors.has(err);
}

function lockMessage(err: unknown): string {
  if (isHomeLockError(err)) return err.message;
  return HOME_OWNER_LOCK_FAILED;
}

export interface HomeOwnerLockOptions {
  signal?: AbortSignal;
  deadlineMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface HeldOsLock {
  release(): void;
}

interface PosixFlock {
  flock: (fd: number, op: number) => number;
}

let posixFlock: PosixFlock | null | undefined;
const inProcessGates = new Map<string, Promise<void>>();
/** 本进程 async 临界区（含等待 OS lock）；sync 不得 Atomics.wait 堵死事件循环。 */
const asyncInProcessOwners = new Set<string>();

function throwLockFailure(code: string): never {
  throw lockError(code);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function loadPosixFlock(): PosixFlock {
  if (posixFlock) return posixFlock;
  const koffi = require("koffi") as {
    load: (name: string | null) => { func: (sig: string) => (...args: never[]) => unknown };
  };
  const libName = hostKind() === "darwin" ? "libc.dylib" : "libc.so.6";
  const lib = koffi.load(libName);
  posixFlock = {
    flock: lib.func("int flock(int fd, int operation)") as PosixFlock["flock"]
  };
  return posixFlock;
}

function lockPathForHome(home: string): string {
  const canonical = resolve(home);
  return join(canonical, "runtime", "owner.lock");
}

function ensureLockFile(path: string): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  // ADR-004 P0「owner-only 机密」：Windows 上 mode 位不构成访问控制，必须去继承 ACL。
  // 另外 runtime 目录若被预置成 junction/symlink，锁文件会落到信任边界外——
  // 控制目标目录的进程即可抢锁或伪造 ownership 记录，故 fail-closed 拒绝。
  if (isReparsePoint(dir)) {
    throwLockFailure("failed");
  }
  restrictOwnerOnly(dir, "dir");
  if (!existsSync(path)) {
    const fd = openSync(path, "a", 0o600);
    closeSync(fd);
  }
  restrictOwnerOnly(path, "file");
}

function syncBackoff(ms: number): void {
  const buf = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(buf, 0, 0, ms);
}

function tryOsLock(path: string): HeldOsLock {
  if (hostKind() === "win32") {
    const held = tryLockFileExclusiveWin32(path);
    if (held === "busy") throwLockFailure("busy");
    return held;
  }
  return tryPosixLock(path);
}

function tryPosixLock(path: string): HeldOsLock {
  const native = loadPosixFlock();
  const fd = openSync(path, "r+", 0o600);
  const rc = native.flock(fd, LOCK_EX | LOCK_NB);
  if (rc !== 0) {
    try {
      closeSync(fd);
    } catch {
      // 未持锁
    }
    throwLockFailure("busy");
  }
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      try {
        native.flock(fd, LOCK_UN);
      } catch {
        // unlock 失败仍关 fd，进程退出也会放锁
      }
      closeSync(fd);
    }
  };
}

async function acquireOsLock(path: string, options: HomeOwnerLockOptions): Promise<HeldOsLock> {
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const now = options.now ?? (() => performance.now());
  const sleep = options.sleep ?? defaultSleep;
  const started = now();
  ensureLockFile(path);
  for (;;) {
    if (options.signal?.aborted) throwLockFailure(HOME_OWNER_LOCK_ABORTED);
    const t = now();
    if (t < started || t - started >= deadlineMs) throwLockFailure(HOME_OWNER_LOCK_TIMEOUT);
    try {
      return tryOsLock(path);
    } catch (err) {
      const text = lockMessage(err);
      if (text === "busy") {
        await sleep(15);
        continue;
      }
      if (text === HOME_OWNER_LOCK_FAILED || text === HOME_OWNER_LOCK_TIMEOUT || text === HOME_OWNER_LOCK_ABORTED) {
        throw isHomeLockError(err) ? err : lockError(text);
      }
      throwLockFailure(HOME_OWNER_LOCK_FAILED);
    }
  }
}

async function withInProcessGate<T>(
  key: string,
  fn: () => Promise<T>,
  options: HomeOwnerLockOptions
): Promise<T> {
  const prior = inProcessGates.get(key) ?? Promise.resolve();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = prior.then(() => held, () => held);
  inProcessGates.set(key, chain);
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const now = options.now ?? (() => performance.now());
  const started = now();
  let cancelled = false;
  const timedOut = new Promise<never>((_, reject) => {
    const wait = options.sleep ?? defaultSleep;
    const remaining = (): number => deadlineMs - (now() - started);
    const poll = (): void => {
      if (cancelled) return;
      if (remaining() <= 0) {
        reject(lockError(HOME_OWNER_LOCK_TIMEOUT));
        return;
      }
      void wait(Math.min(15, Math.max(1, remaining()))).then(poll, poll);
    };
    poll();
  });
  try {
    await Promise.race([prior.catch(() => undefined), timedOut]);
    if (options.signal?.aborted) throwLockFailure(HOME_OWNER_LOCK_ABORTED);
    if (now() - started >= deadlineMs) throwLockFailure(HOME_OWNER_LOCK_TIMEOUT);
    asyncInProcessOwners.add(key);
    try {
      return await fn();
    } finally {
      asyncInProcessOwners.delete(key);
    }
  } finally {
    cancelled = true;
    release();
    if (inProcessGates.get(key) === chain) inProcessGates.delete(key);
  }
}

export function withHomeOwnerBoundarySync<T>(
  home: string,
  fn: () => T,
  options: Pick<HomeOwnerLockOptions, "deadlineMs" | "now"> = {}
): T {
  const key = resolve(home);
  const path = lockPathForHome(home);
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const now = options.now ?? (() => performance.now());
  const started = now();
  ensureLockFile(path);
  for (;;) {
    const t = now();
    if (t < started || t - started >= deadlineMs) throwLockFailure(HOME_OWNER_LOCK_TIMEOUT);
    if (asyncInProcessOwners.has(key)) throwLockFailure(HOME_OWNER_LOCK_TIMEOUT);
    let held: HeldOsLock;
    try {
      held = tryOsLock(path);
    } catch (err) {
      const text = lockMessage(err);
      if (text === "busy") {
        if (asyncInProcessOwners.has(key)) throwLockFailure(HOME_OWNER_LOCK_TIMEOUT);
        syncBackoff(15);
        continue;
      }
      if (text === HOME_OWNER_LOCK_FAILED || text === HOME_OWNER_LOCK_TIMEOUT || text === HOME_OWNER_LOCK_ABORTED) {
        throw isHomeLockError(err) ? err : lockError(text);
      }
      throwLockFailure(HOME_OWNER_LOCK_FAILED);
    }
    try {
      return fn();
    } finally {
      try {
        held.release();
      } catch {
        // 释放失败不得掩盖临界区结果
      }
    }
  }
}

/**
 * 同一规范化 home 上的跨进程临界区。
 * POSIX: flock；Windows: LockFileEx。进程退出由 OS 释放，不用 stale-delete。
 */
export async function withHomeOwnerBoundary<T>(
  home: string,
  fn: () => Promise<T> | T,
  options: HomeOwnerLockOptions = {}
): Promise<T> {
  const key = resolve(home);
  const path = lockPathForHome(home);
  return withInProcessGate(key, async () => {
    const held = await acquireOsLock(path, options);
    try {
      return await fn();
    } finally {
      try {
        held.release();
      } catch {
        // 释放失败不得掩盖临界区结果；锁仍随进程退出由 OS 回收
      }
    }
  }, options);
}
