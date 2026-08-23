// Windows native bindings(koffi,同步加载)。只在 win32 调 kernel32/advapi32。
// 失败 fail-closed:不得回退 taskkill / alive1 / icacls /grant。

import { createRequire } from "node:module";
import { isAbsolute, parse } from "node:path";
import { hostKind } from "./host.js";

const require = createRequire(import.meta.url);

export class PlatformNativeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformNativeError";
  }
}

interface KoffiLib {
  func: (sig: string) => (...args: never[]) => unknown;
}

interface KoffiDecode {
  (value: unknown, type: unknown): unknown;
  string16: (ptr: unknown) => string;
}

interface Koffi {
  load: (name: string) => KoffiLib;
  struct: (name: string, def: Record<string, string>) => unknown;
  decode: KoffiDecode;
}

interface Native {
  koffi: Koffi;
  TOKEN_USER: unknown;
  GetProcessTimes: (h: unknown, c: object, e: object, k: object, u: object) => number;
  OpenProcess: (access: number, inherit: number, pid: number) => unknown;
  CloseHandle: (h: unknown) => number;
  GetFileAttributesW: (path: string) => number;
  GetDriveTypeW: (root: string) => number;
  GetVolumeInformationW: (
    root: string,
    volName: Buffer,
    volNameSize: number,
    serial: Buffer,
    maxComp: Buffer,
    flags: Buffer,
    fsName: Buffer,
    fsNameSize: number
  ) => number;
  QueryDosDeviceW: (name: string, buf: Buffer, size: number) => number;
  CreateJobObjectW: (attr: unknown, name: string) => unknown;
  SetInformationJobObject: (job: unknown, cls: number, info: Buffer, len: number) => number;
  AssignProcessToJobObject: (job: unknown, proc: unknown) => number;
  OpenJobObjectW: (access: number, inherit: number, name: string) => unknown;
  TerminateJobObject: (job: unknown, code: number) => number;
  GetLastError: () => number;
  GetCurrentProcess: () => unknown;
  OpenProcessToken: (proc: unknown, access: number, token: unknown[]) => number;
  GetTokenInformation: (
    token: unknown,
    cls: number,
    buf: Buffer,
    len: number,
    needed: number[]
  ) => number;
  ConvertSidToStringSidW: (sid: unknown, out: unknown[]) => number;
  LocalFree: (h: unknown) => unknown;
  GetNamedSecurityInfoW: (
    path: string,
    objType: number,
    info: number,
    owner: unknown[],
    group: unknown[],
    dacl: unknown[],
    sacl: unknown[],
    sd: unknown[]
  ) => number;
  SetNamedSecurityInfoW: (
    path: string,
    objType: number,
    info: number,
    owner: unknown,
    group: unknown,
    dacl: unknown,
    sacl: unknown
  ) => number;
  ConvertStringSecurityDescriptorToSecurityDescriptorW: (
    sddl: string,
    rev: number,
    sd: unknown[],
    size: number[]
  ) => number;
  ConvertSecurityDescriptorToStringSecurityDescriptorW: (
    sd: unknown,
    rev: number,
    info: number,
    sddl: unknown[],
    size: number[]
  ) => number;
  GetSecurityDescriptorDacl: (
    sd: unknown,
    present: number[],
    dacl: unknown[],
    defaulted: number[]
  ) => number;
  GetSecurityDescriptorOwner: (
    sd: unknown,
    owner: unknown[],
    defaulted: number[]
  ) => number;
}

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const PROCESS_SET_QUOTA = 0x0100;
const PROCESS_TERMINATE = 0x0001;
const TOKEN_QUERY = 0x0008;
const TokenUser = 1;
const INVALID_FILE_ATTRIBUTES = 0xffffffff;
const FILE_ATTRIBUTE_REPARSE_POINT = 0x400;
const DRIVE_FIXED = 3;
const SE_FILE_OBJECT = 1;
const OWNER_SECURITY_INFORMATION = 0x00000001;
const DACL_SECURITY_INFORMATION = 0x00000004;
const PROTECTED_DACL_SECURITY_INFORMATION = 0x80000000;
const SDDL_REVISION_1 = 1;
const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
const JobObjectExtendedLimitInformation = 9;
const JOB_OBJECT_TERMINATE = 0x0008;
const JOB_OBJECT_ASSIGN_PROCESS = 0x0001;
const JOB_OBJECT_QUERY = 0x0004;
const JOB_OBJECT_SET_ATTRIBUTES = 0x0002;
const ERROR_FILE_NOT_FOUND = 2;
const ERROR_NOT_FOUND = 1168;

let cached: Native | null = null;
let bindError: Error | null = null;

export function nativeReady(): boolean {
  return cached !== null;
}

export function bindNative(): Promise<Native> {
  return Promise.resolve(nativeSync());
}

export function nativeSync(): Native {
  if (hostKind() !== "win32") throw new PlatformNativeError("win32 native API called on non-Windows");
  if (cached) return cached;
  if (bindError) throw bindError;
  try {
    cached = bindNow();
    return cached;
  } catch (err) {
    bindError = err instanceof Error ? err : new PlatformNativeError(String(err));
    throw bindError;
  }
}

function bindNow(): Native {
  const koffi = require("koffi") as Koffi;
  const kernel32 = koffi.load("kernel32.dll");
  const advapi32 = koffi.load("advapi32.dll");
  koffi.struct("FILETIME", {
    dwLowDateTime: "uint32",
    dwHighDateTime: "uint32"
  });
  const TOKEN_USER = koffi.struct("TOKEN_USER", {
    Sid: "void *",
    Attributes: "uint32"
  });
  return {
    koffi,
    TOKEN_USER,
    GetProcessTimes: kernel32.func(
      "int32 __stdcall GetProcessTimes(void *, _Out_ FILETIME *, _Out_ FILETIME *, _Out_ FILETIME *, _Out_ FILETIME *)"
    ) as Native["GetProcessTimes"],
    OpenProcess: kernel32.func("void * __stdcall OpenProcess(uint32, int32, uint32)") as Native["OpenProcess"],
    CloseHandle: kernel32.func("int32 __stdcall CloseHandle(void *)") as Native["CloseHandle"],
    GetFileAttributesW: kernel32.func("uint32 __stdcall GetFileAttributesW(str16)") as Native["GetFileAttributesW"],
    GetDriveTypeW: kernel32.func("uint32 __stdcall GetDriveTypeW(str16)") as Native["GetDriveTypeW"],
    GetVolumeInformationW: kernel32.func(
      "int32 __stdcall GetVolumeInformationW(str16, _Out_ uint16 *, uint32, _Out_ uint32 *, _Out_ uint32 *, _Out_ uint32 *, _Out_ uint16 *, uint32)"
    ) as Native["GetVolumeInformationW"],
    QueryDosDeviceW: kernel32.func(
      "uint32 __stdcall QueryDosDeviceW(str16, _Out_ uint16 *, uint32)"
    ) as Native["QueryDosDeviceW"],
    CreateJobObjectW: kernel32.func("void * __stdcall CreateJobObjectW(void *, str16)") as Native["CreateJobObjectW"],
    SetInformationJobObject: kernel32.func(
      "int32 __stdcall SetInformationJobObject(void *, uint32, uint8 *, uint32)"
    ) as Native["SetInformationJobObject"],
    AssignProcessToJobObject: kernel32.func(
      "int32 __stdcall AssignProcessToJobObject(void *, void *)"
    ) as Native["AssignProcessToJobObject"],
    OpenJobObjectW: kernel32.func("void * __stdcall OpenJobObjectW(uint32, int32, str16)") as Native["OpenJobObjectW"],
    TerminateJobObject: kernel32.func("int32 __stdcall TerminateJobObject(void *, uint32)") as Native["TerminateJobObject"],
    GetLastError: kernel32.func("uint32 __stdcall GetLastError()") as () => number,
    GetCurrentProcess: kernel32.func("void * __stdcall GetCurrentProcess()") as Native["GetCurrentProcess"],
    OpenProcessToken: advapi32.func(
      "int32 __stdcall OpenProcessToken(void *, uint32, _Out_ void **)"
    ) as Native["OpenProcessToken"],
    GetTokenInformation: advapi32.func(
      "int32 __stdcall GetTokenInformation(void *, uint32, void *, uint32, _Out_ uint32 *)"
    ) as Native["GetTokenInformation"],
    ConvertSidToStringSidW: advapi32.func(
      "int32 __stdcall ConvertSidToStringSidW(void *, _Out_ void **)"
    ) as Native["ConvertSidToStringSidW"],
    LocalFree: kernel32.func("void * __stdcall LocalFree(void *)") as Native["LocalFree"],
    GetNamedSecurityInfoW: advapi32.func(
      "uint32 __stdcall GetNamedSecurityInfoW(str16, int, uint32, _Out_ void **, _Out_ void **, _Out_ void **, _Out_ void **, _Out_ void **)"
    ) as Native["GetNamedSecurityInfoW"],
    SetNamedSecurityInfoW: advapi32.func(
      "uint32 __stdcall SetNamedSecurityInfoW(str16, int, uint32, void *, void *, void *, void *)"
    ) as Native["SetNamedSecurityInfoW"],
    ConvertStringSecurityDescriptorToSecurityDescriptorW: advapi32.func(
      "int32 __stdcall ConvertStringSecurityDescriptorToSecurityDescriptorW(str16, uint32, _Out_ void **, _Out_ uint32 *)"
    ) as Native["ConvertStringSecurityDescriptorToSecurityDescriptorW"],
    ConvertSecurityDescriptorToStringSecurityDescriptorW: advapi32.func(
      "int32 __stdcall ConvertSecurityDescriptorToStringSecurityDescriptorW(void *, uint32, uint32, _Out_ void **, _Out_ uint32 *)"
    ) as Native["ConvertSecurityDescriptorToStringSecurityDescriptorW"],
    GetSecurityDescriptorDacl: advapi32.func(
      "int32 __stdcall GetSecurityDescriptorDacl(void *, _Out_ int32 *, _Out_ void **, _Out_ int32 *)"
    ) as Native["GetSecurityDescriptorDacl"],
    GetSecurityDescriptorOwner: advapi32.func(
      "int32 __stdcall GetSecurityDescriptorOwner(void *, _Out_ void **, _Out_ int32 *)"
    ) as Native["GetSecurityDescriptorOwner"]
  };
}

function utf16z(buf: Buffer): string {
  const u16 = new Uint16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
  let end = 0;
  while (end < u16.length && u16[end] !== 0) end += 1;
  return String.fromCharCode(...u16.slice(0, end));
}

function sidToString(n: Native, sid: unknown): string {
  const out: unknown[] = [null];
  if (!n.ConvertSidToStringSidW(sid, out) || out[0] == null) {
    throw new PlatformNativeError("ConvertSidToStringSidW failed");
  }
  try {
    const text = n.koffi.decode.string16(out[0]);
    if (typeof text !== "string") throw new PlatformNativeError("ConvertSidToStringSidW decode failed");
    return text;
  } finally {
    n.LocalFree(out[0]);
  }
}

export function currentUserSid(): string {
  const n = nativeSync();
  const token: unknown[] = [null];
  if (!n.OpenProcessToken(n.GetCurrentProcess(), TOKEN_QUERY, token) || token[0] == null) {
    throw new PlatformNativeError("OpenProcessToken failed");
  }
  try {
    const needed = [0];
    n.GetTokenInformation(token[0], TokenUser, Buffer.alloc(0), 0, needed);
    const size = needed[0] ?? 0;
    if (size <= 0) throw new PlatformNativeError("GetTokenInformation size failed");
    const buf = Buffer.alloc(size);
    const needed2 = [0];
    if (!n.GetTokenInformation(token[0], TokenUser, buf, buf.length, needed2)) {
      throw new PlatformNativeError("GetTokenInformation failed");
    }
    const decoded = n.koffi.decode(buf, n.TOKEN_USER) as { Sid?: unknown };
    if (decoded.Sid == null) throw new PlatformNativeError("TOKEN_USER.Sid missing");
    return sidToString(n, decoded.Sid);
  } finally {
    n.CloseHandle(token[0]);
  }
}

export function isReparsePointWin32(absPath: string): boolean {
  const attrs = nativeSync().GetFileAttributesW(absPath);
  if (attrs === INVALID_FILE_ATTRIBUTES) {
    throw new PlatformNativeError(`GetFileAttributesW failed:${absPath}`);
  }
  return (attrs & FILE_ATTRIBUTE_REPARSE_POINT) !== 0;
}

function volumeRoot(absPath: string): string {
  const root = parse(absPath).root;
  if (!root) throw new PlatformNativeError(`no volume root:${absPath}`);
  return /[\\/]$/u.test(root) ? root : `${root}\\`;
}

export function assertLocalFixedNtfs(absPath: string): void {
  if (!isAbsolute(absPath)) throw new PlatformNativeError("path must be absolute");
  const n = nativeSync();
  const root = volumeRoot(absPath);
  if (n.GetDriveTypeW(root) !== DRIVE_FIXED) {
    throw new PlatformNativeError(`volume is not DRIVE_FIXED:${root}`);
  }
  const dosName = root.replace(/[\\/]$/u, "");
  const deviceBuf = Buffer.alloc(4096);
  const q = n.QueryDosDeviceW(dosName, deviceBuf, Math.floor(deviceBuf.length / 2));
  if (q > 0) {
    const device = utf16z(deviceBuf);
    if (device.startsWith("\\??\\")) {
      throw new PlatformNativeError(`subst/mapped volume rejected:${root}`);
    }
  }
  const fsName = Buffer.alloc(64);
  const volName = Buffer.alloc(64);
  const serial = Buffer.alloc(4);
  const maxComp = Buffer.alloc(4);
  const flags = Buffer.alloc(4);
  const ok = n.GetVolumeInformationW(
    root,
    volName,
    Math.floor(volName.length / 2),
    serial,
    maxComp,
    flags,
    fsName,
    Math.floor(fsName.length / 2)
  );
  if (!ok) throw new PlatformNativeError(`GetVolumeInformationW failed:${root}`);
  const name = utf16z(fsName);
  if (name.toUpperCase() !== "NTFS") {
    throw new PlatformNativeError(`filesystem is not NTFS:${name || "unknown"}`);
  }
}

export function ownerSidOf(absPath: string): string {
  const n = nativeSync();
  const owner: unknown[] = [null];
  const group: unknown[] = [null];
  const dacl: unknown[] = [null];
  const sacl: unknown[] = [null];
  const sd: unknown[] = [null];
  const rc = n.GetNamedSecurityInfoW(
    absPath,
    SE_FILE_OBJECT,
    OWNER_SECURITY_INFORMATION,
    owner,
    group,
    dacl,
    sacl,
    sd
  );
  if (rc !== 0 || owner[0] == null) {
    throw new PlatformNativeError(`GetNamedSecurityInfoW owner failed:${String(rc)}`);
  }
  try {
    return sidToString(n, owner[0]);
  } finally {
    if (sd[0] != null) n.LocalFree(sd[0]);
  }
}

const FORBIDDEN_TRUSTEES = /(?:WD|BU|AU|WG|BG|BA|S-1-1-0|S-1-5-32-545|S-1-5-11|S-1-5-32-544)/u;
const ADMINISTRATORS_SID = "S-1-5-32-544";
const SYSTEM_SID = "S-1-5-18";

export type Win32OwnerTightenAction = "keep" | "reassign_administrators" | "reject_system" | "reject_foreign";

export function win32OwnerTightenAction(owner: string, current: string): Win32OwnerTightenAction {
  if (owner === SYSTEM_SID || current === SYSTEM_SID) return "reject_system";
  if (current === ADMINISTRATORS_SID) return "reject_foreign";
  if (owner === current) return "keep";
  if (owner === ADMINISTRATORS_SID) return "reassign_administrators";
  return "reject_foreign";
}

export function restrictOwnerOnlyWin32(absPath: string, kind: "file" | "dir"): void {
  const n = nativeSync();
  const sid = currentUserSid();
  const owner = ownerSidOf(absPath);
  const ownerAction = win32OwnerTightenAction(owner, sid);
  if (ownerAction === "reject_system") {
    throw new PlatformNativeError("SYSTEM owner is not an available state root");
  }
  if (ownerAction === "reject_foreign") {
    throw new PlatformNativeError(`owner SID mismatch before ACL tighten:${owner}`);
  }
  // 管理员 token 的默认 owner 可能是内置 Administrators。仍不接受该组作为最终 owner；
  // 在同一次 native 写入中改归当前用户 SID，并收紧为 protected owner-only DACL。
  const sddl = kind === "dir" ? `O:${sid}D:P(A;OICI;FA;;;${sid})` : `O:${sid}D:P(A;;FRFW;;;${sid})`;
  const sd: unknown[] = [null];
  const size = [0];
  if (!n.ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl, SDDL_REVISION_1, sd, size) || sd[0] == null) {
    throw new PlatformNativeError("ConvertStringSecurityDescriptorToSecurityDescriptorW failed");
  }
  try {
    const targetOwner: unknown[] = [null];
    const ownerDefaulted = [0];
    if (!n.GetSecurityDescriptorOwner(sd[0], targetOwner, ownerDefaulted) || targetOwner[0] == null) {
      throw new PlatformNativeError("GetSecurityDescriptorOwner failed");
    }
    const present = [0];
    const dacl: unknown[] = [null];
    const defaulted = [0];
    if (!n.GetSecurityDescriptorDacl(sd[0], present, dacl, defaulted) || !present[0] || dacl[0] == null) {
      throw new PlatformNativeError("GetSecurityDescriptorDacl failed");
    }
    const rc = n.SetNamedSecurityInfoW(
      absPath,
      SE_FILE_OBJECT,
      DACL_SECURITY_INFORMATION |
        PROTECTED_DACL_SECURITY_INFORMATION |
        (ownerAction === "reassign_administrators" ? OWNER_SECURITY_INFORMATION : 0),
      ownerAction === "reassign_administrators" ? targetOwner[0] : null,
      null,
      dacl[0],
      null
    );
    if (rc !== 0) throw new PlatformNativeError(`SetNamedSecurityInfoW failed:${String(rc)}`);
  } finally {
    n.LocalFree(sd[0]);
  }
  const verifyOwner: unknown[] = [null];
  const verifyGroup: unknown[] = [null];
  const verifyDacl: unknown[] = [null];
  const verifySacl: unknown[] = [null];
  const verifySd: unknown[] = [null];
  const readRc = n.GetNamedSecurityInfoW(
    absPath,
    SE_FILE_OBJECT,
    DACL_SECURITY_INFORMATION | OWNER_SECURITY_INFORMATION,
    verifyOwner,
    verifyGroup,
    verifyDacl,
    verifySacl,
    verifySd
  );
  if (readRc !== 0 || verifySd[0] == null) {
    throw new PlatformNativeError(`ACL readback failed:${String(readRc)}`);
  }
  try {
    if (verifyOwner[0] == null || sidToString(n, verifyOwner[0]) !== sid) {
      throw new PlatformNativeError("ACL readback owner SID mismatch");
    }
    const sddlOut: unknown[] = [null];
    const sddlSize = [0];
    if (
      !n.ConvertSecurityDescriptorToStringSecurityDescriptorW(
        verifySd[0],
        SDDL_REVISION_1,
        DACL_SECURITY_INFORMATION | OWNER_SECURITY_INFORMATION,
        sddlOut,
        sddlSize
      ) ||
      sddlOut[0] == null
    ) {
      throw new PlatformNativeError("ACL SDDL readback failed");
    }
    try {
      const text = n.koffi.decode.string16(sddlOut[0]);
      if (typeof text !== "string") throw new PlatformNativeError("ACL SDDL readback decode failed");
      if (!text.includes(sid)) throw new PlatformNativeError("ACL readback missing owner SID");
      if (FORBIDDEN_TRUSTEES.test(text.replaceAll(sid, ""))) {
        throw new PlatformNativeError("ACL readback contains world/users ACE");
      }
      if (!/D:P/u.test(text)) throw new PlatformNativeError("ACL readback is not protected");
    } finally {
      n.LocalFree(sddlOut[0]);
    }
  } finally {
    n.LocalFree(verifySd[0]);
  }
}

export function processBirthWin32(pid: number): string | null {
  const n = nativeSync();
  const h = n.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
  if (isNullHandle(h)) return null;
  try {
    const creation = { dwLowDateTime: 0, dwHighDateTime: 0 };
    const exit = { dwLowDateTime: 0, dwHighDateTime: 0 };
    const kernel = { dwLowDateTime: 0, dwHighDateTime: 0 };
    const user = { dwLowDateTime: 0, dwHighDateTime: 0 };
    if (!n.GetProcessTimes(h, creation, exit, kernel, user)) return null;
    return `ft:${String(creation.dwHighDateTime)}:${String(creation.dwLowDateTime)}:${String(pid)}`;
  } finally {
    n.CloseHandle(h);
  }
}

export interface Win32Job {
  name: string;
  handle: unknown;
}

function isNullHandle(h: unknown): boolean {
  return h == null || h === 0 || h === 0n;
}

export function createNamedJobWin32(name: string): Win32Job {
  const n = nativeSync();
  const handle = n.CreateJobObjectW(null, name);
  if (isNullHandle(handle)) {
    throw new PlatformNativeError(`CreateJobObjectW failed:${name}:err=${String(n.GetLastError())}`);
  }
  // x64 JOBOBJECT_EXTENDED_LIMIT_INFORMATION = 144;LimitFlags 在 BASIC 偏移 16;KILL_ON_JOB_CLOSE=0x2000。
  const info = Buffer.alloc(144);
  info.writeUInt32LE(JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, 16);
  if (!n.SetInformationJobObject(handle, JobObjectExtendedLimitInformation, info, info.length)) {
    const err = n.GetLastError();
    n.CloseHandle(handle);
    throw new PlatformNativeError(`SetInformationJobObject KILL_ON_JOB_CLOSE failed:${String(err)}`);
  }
  return { name, handle };
}

export function assignPidToJobWin32(job: Win32Job, pid: number): void {
  const n = nativeSync();
  const access = PROCESS_SET_QUOTA | PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION;
  const proc = n.OpenProcess(access, 0, pid);
  if (isNullHandle(proc)) throw new PlatformNativeError(`OpenProcess for job assign failed:${String(pid)}`);
  try {
    if (!n.AssignProcessToJobObject(job.handle, proc)) {
      throw new PlatformNativeError(`AssignProcessToJobObject failed:${String(pid)}`);
    }
  } finally {
    n.CloseHandle(proc);
  }
}

export function terminateNamedJobWin32(name: string): "terminated" | "missing" {
  const n = nativeSync();
  const access = JOB_OBJECT_TERMINATE | JOB_OBJECT_QUERY | JOB_OBJECT_ASSIGN_PROCESS | JOB_OBJECT_SET_ATTRIBUTES;
  const handle = n.OpenJobObjectW(access, 0, name);
  if (isNullHandle(handle)) {
    const err = Number(n.GetLastError());
    if (err === ERROR_FILE_NOT_FOUND || err === ERROR_NOT_FOUND) return "missing";
    throw new PlatformNativeError(`OpenJobObjectW failed:${name}:err=${String(err)}`);
  }
  try {
    if (!n.TerminateJobObject(handle, 1)) {
      throw new PlatformNativeError(`TerminateJobObject failed:${name}`);
    }
    return "terminated";
  } finally {
    n.CloseHandle(handle);
  }
}

export function closeJobHandleWin32(job: Win32Job): void {
  if (isNullHandle(job.handle)) return;
  const handle = job.handle;
  job.handle = null;
  nativeSync().CloseHandle(handle);
}
