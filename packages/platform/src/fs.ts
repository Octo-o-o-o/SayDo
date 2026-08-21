import { chmodSync, closeSync, fsyncSync, lstatSync, openSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { hostKind } from "./host.js";
import {
  assertLocalFixedNtfs,
  currentUserSid,
  isReparsePointWin32,
  nativeReady,
  nativeSync,
  ownerSidOf,
  restrictOwnerOnlyWin32
} from "./win32.js";

export interface FsIdentity {
  path: string;
  dev: string;
  ino: string;
}

export class PlatformFsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformFsError";
  }
}

export type RestrictOwnerOnly = (absPath: string, kind: "file" | "dir") => void;

let restrictImpl: RestrictOwnerOnly | null = null;

export function setRestrictOwnerOnlyForTests(next: RestrictOwnerOnly | null): void {
  restrictImpl = next;
}

function ensureWin32Native(): void {
  if (!nativeReady()) nativeSync();
}

export function isReparsePoint(absPath: string): boolean {
  if (hostKind() === "win32") {
    ensureWin32Native();
    return isReparsePointWin32(absPath);
  }
  return lstatSync(absPath).isSymbolicLink();
}

export function assertRealDirectory(absPath: string): string {
  if (!isAbsolute(absPath)) throw new PlatformFsError("path must be absolute");
  const lexical = resolve(absPath);
  let st;
  try {
    st = lstatSync(lexical);
  } catch {
    throw new PlatformFsError("path does not exist");
  }
  if (!st.isDirectory()) throw new PlatformFsError("path is not a directory");
  if (isReparsePoint(lexical)) throw new PlatformFsError("path is a reparse/symlink");
  const real = realpathSync(lexical);
  if (real !== lexical) throw new PlatformFsError("path realpath escaped lexical location");
  if (hostKind() === "win32") assertLocalFixedNtfs(real);
  return real;
}

export function fsIdentity(absPath: string): FsIdentity {
  const path = resolve(absPath);
  const st = statSync(path, { bigint: true });
  return { path, dev: String(st.dev), ino: String(st.ino) };
}

export function assertOwnedByCurrentUser(absPath: string): void {
  if (hostKind() === "win32") {
    ensureWin32Native();
    const owner = ownerSidOf(absPath);
    const me = currentUserSid();
    if (owner === "S-1-5-32-544" || owner === "S-1-5-18") {
      throw new PlatformFsError("Administrators/SYSTEM owner is not usable");
    }
    if (owner !== me) throw new PlatformFsError("owner SID mismatch");
    return;
  }
  const getuid = process.getuid;
  if (typeof getuid !== "function") {
    throw new PlatformFsError("getuid unavailable; owner check cannot be skipped");
  }
  const uid = getuid();
  if (statSync(absPath).uid !== uid) throw new PlatformFsError("owner uid mismatch");
}

function restrictOwnerOnlyProduction(absPath: string, kind: "file" | "dir"): void {
  if (hostKind() === "win32") {
    ensureWin32Native();
    restrictOwnerOnlyWin32(absPath, kind);
    return;
  }
  chmodSync(absPath, kind === "dir" ? 0o700 : 0o600);
}

export function fsyncFile(absPath: string): void {
  // Windows 对只读句柄 fsync 返回 EPERM;必须带写权限。
  const fd = openSync(absPath, hostKind() === "win32" ? "r+" : "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function restrictOwnerOnly(absPath: string, kind: "file" | "dir"): void {
  (restrictImpl ?? restrictOwnerOnlyProduction)(absPath, kind);
}
