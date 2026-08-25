// Windows native bindings(koffi,同步加载)。只在 win32 调 kernel32/advapi32。
// 失败 fail-closed:不得回退 taskkill / alive1 / icacls /grant。

import { randomUUID } from "node:crypto";
import { fstatSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { PassThrough, Readable, Writable } from "node:stream";
import { quoteWin32CommandLine } from "./win32Quote.js";
import { createRequire } from "node:module";
import { isAbsolute, parse } from "node:path";
import { hostKind } from "./host.js";

type WinIoFn = {
  (handle: unknown, buf: Buffer, n: number, written: number[], overlapped: unknown): number;
  async: (
    handle: unknown,
    buf: Buffer,
    n: number,
    written: number[],
    overlapped: unknown,
    cb: (err: Error | null, result: number) => void
  ) => void;
};

const require = createRequire(import.meta.url);

const platformNativeErrors = new WeakSet<object>();

export class PlatformNativeError extends Error {
  readonly frozenMessage: string;
  readonly frozenStack: string;
  constructor(message: string) {
    super(message);
    this.name = "PlatformNativeError";
    const stack = typeof this.stack === "string" ? this.stack : message;
    this.frozenMessage = message;
    this.frozenStack = stack;
    Object.defineProperty(this, "message", {
      value: message,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, "stack", {
      value: stack,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, "frozenMessage", {
      value: message,
      writable: false,
      configurable: false,
      enumerable: true
    });
    Object.defineProperty(this, "frozenStack", {
      value: stack,
      writable: false,
      configurable: false,
      enumerable: true
    });
    platformNativeErrors.add(this);
  }
}

export function isPlatformNativeError(err: unknown): err is PlatformNativeError {
  return typeof err === "object" && err !== null && platformNativeErrors.has(err);
}

/** bind catch 的受控收口；不读 unknown 的 message/String。 */
export function captureNativeBindFailure(err: unknown): Error {
  if (isPlatformNativeError(err)) return new PlatformNativeError(err.frozenMessage);
  return new PlatformNativeError("native bind failed");
}

interface KoffiLib {
  func: (sig: string) => (...args: never[]) => unknown;
}

interface KoffiDecode {
  (value: unknown, type: unknown): unknown;
  (value: unknown, type: unknown, len: number): unknown;
  (value: unknown, offset: number, type: unknown): unknown;
  string16: (ptr: unknown) => string;
}

interface Koffi {
  load: (name: string) => KoffiLib;
  struct: (name: string, def: Record<string, string | unknown>) => unknown;
  decode: KoffiDecode;
  address: (ptr: unknown) => bigint | number;
  sizeof: (type: unknown) => number;
  offsetof: (type: unknown, field: string) => number;
  pointer: (name: string, ref: unknown) => unknown;
  opaque: () => unknown;
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
  QueryInformationJobObject: (
    job: unknown,
    cls: number,
    info: Buffer,
    len: number,
    retLen: number[]
  ) => number;
  GetLastError: () => number;
  SetLastError: (code: number) => void;
  GetExitCodeProcess: (h: unknown, code: number[]) => number;
  IsProcessInJob: (proc: unknown, job: unknown, result: number[]) => number;
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
  CreateNamedPipeW: (
    name: string,
    openMode: number,
    pipeMode: number,
    maxInstances: number,
    outBuf: number,
    inBuf: number,
    timeout: number,
    sa: object | null
  ) => unknown;
  ConnectNamedPipe: (handle: unknown, overlapped: unknown) => number;
  ReadFile: WinIoFn;
  WriteFile: WinIoFn;
  Sleep: (ms: number) => void;
  SetHandleInformation: (handle: unknown, mask: number, flags: number) => number;
  GetHandleInformation: (handle: unknown, flags: number[]) => number;
  CreateProcessW: (
    app: string,
    cmd: Buffer,
    procAttr: unknown,
    threadAttr: unknown,
    inherit: number,
    flags: number,
    env: Buffer | null,
    cwd: string | null,
    si: object,
    pi: object
  ) => number;
  ResumeThread: (thread: unknown) => number;
  TerminateProcess: (proc: unknown, code: number) => number;
  GetProcessHandleCount: (proc: unknown, count: number[]) => number;
  InitializeProcThreadAttributeList: (
    list: Buffer | null,
    count: number,
    flags: number,
    size: number[] | bigint[]
  ) => number;
  UpdateProcThreadAttribute: (
    list: Buffer,
    flags: number,
    attr: number | bigint,
    value: Buffer,
    size: number,
    previous: unknown,
    returnSize: unknown
  ) => number;
  DeleteProcThreadAttributeList: (list: Buffer) => void;
  WaitForSingleObject: (handle: unknown, ms: number) => number;
  CreateFileW: (
    path: string,
    access: number,
    share: number,
    sa: object | null,
    disp: number,
    flags: number,
    template: unknown
  ) => unknown;
  LockFileEx: (
    handle: unknown,
    flags: number,
    reserved: number,
    low: number,
    high: number,
    overlapped: object
  ) => number;
  UnlockFileEx: (
    handle: unknown,
    reserved: number,
    low: number,
    high: number,
    overlapped: object
  ) => number;
  CommandLineToArgvW: (cmd: Buffer, argc: number[]) => unknown;
  STARTUPINFOW: unknown;
  STARTUPINFOEXW: unknown;
  PROCESS_INFORMATION: unknown;
  SECURITY_ATTRIBUTES: unknown;
  OVERLAPPED: unknown;
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
const JobObjectBasicAccountingInformation = 1;
const JobObjectBasicProcessIdList = 3;
const JOB_OBJECT_TERMINATE = 0x0008;
const JOB_OBJECT_ASSIGN_PROCESS = 0x0001;
const JOB_OBJECT_QUERY = 0x0004;
const JOB_OBJECT_SET_ATTRIBUTES = 0x0002;
const ERROR_FILE_NOT_FOUND = 2;
const ERROR_NOT_FOUND = 1168;
const ERROR_MORE_DATA = 234;
export const ERROR_ALREADY_EXISTS = 183;
const STILL_ACTIVE = 259;
const CREATE_SUSPENDED = 0x00000004;
const CREATE_UNICODE_ENVIRONMENT = 0x00000400;
const CREATE_NO_WINDOW = 0x08000000;
const STARTF_USESTDHANDLES = 0x00000100;
const HANDLE_FLAG_INHERIT = 0x00000001;
const PIPE_ACCESS_INBOUND = 0x00000001;
const PIPE_ACCESS_OUTBOUND = 0x00000002;
const PIPE_NOWAIT = 0x00000001;
const FILE_FLAG_FIRST_PIPE_INSTANCE = 0x00080000;
const STDIO_PIPE_BUFFER = 65_536;
const GENERATION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const ERROR_PIPE_CONNECTED = 535;
const ERROR_PIPE_LISTENING = 536;
const ERROR_NO_DATA = 232;
const PERMIT_CONNECT_TIMEOUT_MS = 10_000;
const EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
const PROC_THREAD_ATTRIBUTE_HANDLE_LIST = 0x00020002;
const WAIT_OBJECT_0 = 0;
const WAIT_TIMEOUT = 258;
const GENERIC_READ = 0x80000000;
const GENERIC_WRITE = 0x40000000;
const FILE_SHARE_READ = 0x00000001;
const FILE_SHARE_WRITE = 0x00000002;
const OPEN_EXISTING = 3;
const OPEN_ALWAYS = 4;
const FILE_ATTRIBUTE_NORMAL = 0x00000080;
const LOCKFILE_FAIL_IMMEDIATELY = 0x00000001;
const LOCKFILE_EXCLUSIVE_LOCK = 0x00000002;
const INVALID_HANDLE_VALUE = -1n;

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
  if (bindError) {
    throw new PlatformNativeError(
      bindError instanceof PlatformNativeError ? bindError.frozenMessage : "native bind failed"
    );
  }
  try {
    cached = bindNow();
    return cached;
  } catch (err) {
    bindError = captureNativeBindFailure(err);
    throw new PlatformNativeError(
      bindError instanceof PlatformNativeError ? bindError.frozenMessage : "native bind failed"
    );
  }
}

function assertSupportedWin32Arch(): void {
  if (process.arch !== "x64" && process.arch !== "arm64") {
    throw new PlatformNativeError(`unsupported win32 arch:${process.arch}`);
  }
}

export function win32PointerSize(): 8 {
  assertSupportedWin32Arch();
  return 8;
}

function bindNow(): Native {
  assertSupportedWin32Arch();
  const koffi = require("koffi") as Koffi;
  const kernel32 = koffi.load("kernel32.dll");
  const advapi32 = koffi.load("advapi32.dll");
  const shell32 = koffi.load("shell32.dll");
  koffi.struct("FILETIME", {
    dwLowDateTime: "uint32",
    dwHighDateTime: "uint32"
  });
  const TOKEN_USER = koffi.struct("TOKEN_USER", {
    Sid: "void *",
    Attributes: "uint32"
  });
  const SECURITY_ATTRIBUTES = koffi.struct("SECURITY_ATTRIBUTES", {
    nLength: "uint32",
    lpSecurityDescriptor: "void *",
    bInheritHandle: "int32"
  });
  const STARTUPINFOW = koffi.struct("STARTUPINFOW", {
    cb: "uint32",
    lpReserved: "void *",
    lpDesktop: "void *",
    lpTitle: "void *",
    dwX: "uint32",
    dwY: "uint32",
    dwXSize: "uint32",
    dwYSize: "uint32",
    dwXCountChars: "uint32",
    dwYCountChars: "uint32",
    dwFillAttribute: "uint32",
    dwFlags: "uint32",
    wShowWindow: "uint16",
    cbReserved2: "uint16",
    lpReserved2: "void *",
    hStdInput: "void *",
    hStdOutput: "void *",
    hStdError: "void *"
  });
  const PROCESS_INFORMATION = koffi.struct("PROCESS_INFORMATION", {
    hProcess: "void *",
    hThread: "void *",
    dwProcessId: "uint32",
    dwThreadId: "uint32"
  });
  const STARTUPINFOEXW = koffi.struct("STARTUPINFOEXW", {
    StartupInfo: STARTUPINFOW,
    lpAttributeList: "void *"
  });
  const OVERLAPPED = koffi.struct("OVERLAPPED", {
    Internal: "uintptr",
    InternalHigh: "uintptr",
    Offset: "uint32",
    OffsetHigh: "uint32",
    hEvent: "void *"
  });
  return {
    koffi,
    TOKEN_USER,
    STARTUPINFOW,
    STARTUPINFOEXW,
    PROCESS_INFORMATION,
    SECURITY_ATTRIBUTES,
    OVERLAPPED,
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
    QueryInformationJobObject: kernel32.func(
      "int32 __stdcall QueryInformationJobObject(void *, uint32, _Out_ uint8 *, uint32, _Out_ uint32 *)"
    ) as Native["QueryInformationJobObject"],
    GetLastError: kernel32.func("uint32 __stdcall GetLastError()") as () => number,
    SetLastError: kernel32.func("void __stdcall SetLastError(uint32)") as Native["SetLastError"],
    GetExitCodeProcess: kernel32.func(
      "int32 __stdcall GetExitCodeProcess(void *, _Out_ uint32 *)"
    ) as Native["GetExitCodeProcess"],
    IsProcessInJob: kernel32.func(
      "int32 __stdcall IsProcessInJob(void *, void *, _Out_ int32 *)"
    ) as Native["IsProcessInJob"],
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
    ) as Native["GetSecurityDescriptorOwner"],
    CreateNamedPipeW: kernel32.func(
      "void * __stdcall CreateNamedPipeW(str16, uint32, uint32, uint32, uint32, uint32, uint32, _In_ SECURITY_ATTRIBUTES *)"
    ) as Native["CreateNamedPipeW"],
    ConnectNamedPipe: kernel32.func(
      "int32 __stdcall ConnectNamedPipe(void *, void *)"
    ) as Native["ConnectNamedPipe"],
    ReadFile: kernel32.func(
      "int32 __stdcall ReadFile(void *, uint8 *, uint32, _Out_ uint32 *, void *)"
    ) as Native["ReadFile"],
    WriteFile: kernel32.func(
      "int32 __stdcall WriteFile(void *, uint8 *, uint32, _Out_ uint32 *, void *)"
    ) as Native["WriteFile"],
    Sleep: kernel32.func("void __stdcall Sleep(uint32)") as Native["Sleep"],
    SetHandleInformation: kernel32.func(
      "int32 __stdcall SetHandleInformation(void *, uint32, uint32)"
    ) as Native["SetHandleInformation"],
    GetHandleInformation: kernel32.func(
      "int32 __stdcall GetHandleInformation(void *, _Out_ uint32 *)"
    ) as Native["GetHandleInformation"],
    CreateProcessW: kernel32.func(
      "int32 __stdcall CreateProcessW(str16, uint16 *, void *, void *, int32, uint32, void *, str16, _Inout_ STARTUPINFOEXW *, _Out_ PROCESS_INFORMATION *)"
    ) as Native["CreateProcessW"],
    ResumeThread: kernel32.func("uint32 __stdcall ResumeThread(void *)") as Native["ResumeThread"],
    TerminateProcess: kernel32.func("int32 __stdcall TerminateProcess(void *, uint32)") as Native["TerminateProcess"],
    GetProcessHandleCount: kernel32.func(
      "int32 __stdcall GetProcessHandleCount(void *, _Out_ uint32 *)"
    ) as Native["GetProcessHandleCount"],
    InitializeProcThreadAttributeList: kernel32.func(
      "int32 __stdcall InitializeProcThreadAttributeList(void *, uint32, uint32, _Inout_ size_t *)"
    ) as Native["InitializeProcThreadAttributeList"],
    UpdateProcThreadAttribute: kernel32.func(
      "int32 __stdcall UpdateProcThreadAttribute(void *, uint32, uintptr, void *, size_t, void *, void *)"
    ) as Native["UpdateProcThreadAttribute"],
    DeleteProcThreadAttributeList: kernel32.func(
      "void __stdcall DeleteProcThreadAttributeList(void *)"
    ) as Native["DeleteProcThreadAttributeList"],
    WaitForSingleObject: kernel32.func(
      "uint32 __stdcall WaitForSingleObject(void *, uint32)"
    ) as Native["WaitForSingleObject"],
    CreateFileW: kernel32.func(
      "void * __stdcall CreateFileW(str16, uint32, uint32, _In_ SECURITY_ATTRIBUTES *, uint32, uint32, void *)"
    ) as Native["CreateFileW"],
    LockFileEx: kernel32.func(
      "int32 __stdcall LockFileEx(void *, uint32, uint32, uint32, uint32, _Inout_ OVERLAPPED *)"
    ) as Native["LockFileEx"],
    UnlockFileEx: kernel32.func(
      "int32 __stdcall UnlockFileEx(void *, uint32, uint32, uint32, _Inout_ OVERLAPPED *)"
    ) as Native["UnlockFileEx"],
    CommandLineToArgvW: shell32.func(
      "void * __stdcall CommandLineToArgvW(uint16 *, _Out_ int *)"
    ) as Native["CommandLineToArgvW"]
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
  return withCheckedHandle(n, token[0], "OpenProcessToken", () => {
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
  });
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
  return withCheckedHandle(n, h, `process-times:${String(pid)}`, () => {
    const creation = { dwLowDateTime: 0, dwHighDateTime: 0 };
    const exit = { dwLowDateTime: 0, dwHighDateTime: 0 };
    const kernel = { dwLowDateTime: 0, dwHighDateTime: 0 };
    const user = { dwLowDateTime: 0, dwHighDateTime: 0 };
    if (!n.GetProcessTimes(h, creation, exit, kernel, user)) {
      throw new PlatformNativeError(`GetProcessTimes failed:${String(pid)}:err=${String(n.GetLastError())}`);
    }
    return `ft:${String(creation.dwHighDateTime)}:${String(creation.dwLowDateTime)}:${String(pid)}`;
  });
}

export interface Win32Job {
  name: string;
  handle: unknown;
}

function isNullHandle(h: unknown): boolean {
  return h == null || h === 0 || h === 0n;
}

function closeHandleChecked(n: Native, handle: unknown, label: string): void {
  if (isNullHandle(handle)) return;
  if (!n.CloseHandle(handle)) {
    throw new PlatformNativeError(`CloseHandle failed:${label}:err=${String(n.GetLastError())}`);
  }
}

function projectHandleFailure(err: unknown): Error {
  if (isPlatformNativeError(err)) return err;
  return new PlatformNativeError("checked handle failed");
}

/**
 * work 优先于 close；任意 rejection（含 falsy）都失败，不返回未初始化 result。
 * 未知对象投影为内部品牌，不原样抛出。
 */
export function settleCheckedHandleWork<T>(work: () => T, close: () => void): T {
  let workFailed = false;
  let workError: unknown;
  let closeFailed = false;
  let closeError: unknown;
  let hasResult = false;
  let result: T | undefined;
  try {
    result = work();
    hasResult = true;
  } catch (err) {
    workFailed = true;
    workError = err;
  } finally {
    try {
      close();
    } catch (err) {
      closeFailed = true;
      closeError = err;
    }
  }
  if (workFailed) throw projectHandleFailure(workError);
  if (closeFailed) throw projectHandleFailure(closeError);
  if (!hasResult) throw new PlatformNativeError("checked handle work produced no result");
  return result as T;
}

function withCheckedHandle<T>(n: Native, handle: unknown, label: string, fn: () => T): T {
  return settleCheckedHandleWork(fn, () => closeHandleChecked(n, handle, label));
}

export function createNamedJobWin32(name: string): Win32Job {
  const n = nativeSync();
  n.SetLastError(0);
  const handle = n.CreateJobObjectW(null, name);
  if (isNullHandle(handle)) {
    throw new PlatformNativeError(`CreateJobObjectW failed:${name}:err=${String(n.GetLastError())}`);
  }
  const lastError = Number(n.GetLastError());
  if (lastError === ERROR_ALREADY_EXISTS) {
    closeHandleChecked(n, handle, `CreateJobObjectW:${name}`);
    throw new PlatformNativeError(`CreateJobObjectW already exists:${name}`);
  }
  // x64 JOBOBJECT_EXTENDED_LIMIT_INFORMATION = 144;LimitFlags 在 BASIC 偏移 16;KILL_ON_JOB_CLOSE=0x2000。
  const info = Buffer.alloc(144);
  info.writeUInt32LE(JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, 16);
  if (!n.SetInformationJobObject(handle, JobObjectExtendedLimitInformation, info, info.length)) {
    const err = n.GetLastError();
    closeHandleChecked(n, handle, `CreateJobObjectW:${name}`);
    throw new PlatformNativeError(`SetInformationJobObject KILL_ON_JOB_CLOSE failed:${String(err)}`);
  }
  return { name, handle };
}

export function assignPidToJobWin32(job: Win32Job, pid: number): void {
  const n = nativeSync();
  const access = PROCESS_SET_QUOTA | PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION;
  const proc = n.OpenProcess(access, 0, pid);
  if (isNullHandle(proc)) throw new PlatformNativeError(`OpenProcess for job assign failed:${String(pid)}`);
  withCheckedHandle(n, proc, `OpenProcess:${String(pid)}`, () => {
    if (!n.AssignProcessToJobObject(job.handle, proc)) {
      throw new PlatformNativeError(`AssignProcessToJobObject failed:${String(pid)}`);
    }
  });
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
  return withCheckedHandle(n, handle, `OpenJobObjectW:${name}`, () => {
    if (!n.TerminateJobObject(handle, 1)) {
      throw new PlatformNativeError(`TerminateJobObject failed:${name}`);
    }
    return "terminated" as const;
  });
}

export function closeJobHandleWin32(job: Win32Job): void {
  if (isNullHandle(job.handle)) return;
  const handle = job.handle;
  const n = nativeSync();
  if (!n.CloseHandle(handle)) {
    throw new PlatformNativeError(`CloseHandle failed:${job.name}:err=${String(n.GetLastError())}`);
  }
  job.handle = null;
}

export function terminateNamedJobHandleWin32(job: Win32Job): void {
  if (isNullHandle(job.handle)) throw new PlatformNativeError("named job handle closed");
  const n = nativeSync();
  if (!n.TerminateJobObject(job.handle, 1)) {
    throw new PlatformNativeError(`TerminateJobObject failed:${job.name}:err=${String(n.GetLastError())}`);
  }
}

export function namedJobActiveProcessCountByNameWin32(name: string): number | "missing" {
  const n = nativeSync();
  const handle = n.OpenJobObjectW(JOB_OBJECT_QUERY, 0, name);
  if (isNullHandle(handle)) {
    const err = Number(n.GetLastError());
    if (err === ERROR_FILE_NOT_FOUND || err === ERROR_NOT_FOUND) return "missing";
    throw new PlatformNativeError(`OpenJobObjectW query failed:${name}:err=${String(err)}`);
  }
  return withCheckedHandle(n, handle, `OpenJobObjectW query:${name}`, () => {
    const info = Buffer.alloc(48);
    const retLen = [0];
    if (!n.QueryInformationJobObject(handle, JobObjectBasicAccountingInformation, info, info.length, retLen)) {
      throw new PlatformNativeError(`QueryInformationJobObject failed:${name}:err=${String(n.GetLastError())}`);
    }
    return info.readUInt32LE(40);
  });
}

/**
 * QueryInformationJobObject(JobObjectBasicProcessIdList)：pid 是否属于该具名 Job。
 * missing = Job 不存在；false = Job 存在但 pid 不是成员。不得用 ActiveProcesses>0 代替。
 */
export function namedJobContainsPidWin32(name: string, pid: number): boolean | "missing" {
  const n = nativeSync();
  const handle = n.OpenJobObjectW(JOB_OBJECT_QUERY, 0, name);
  if (isNullHandle(handle)) {
    const err = Number(n.GetLastError());
    if (err === ERROR_FILE_NOT_FOUND || err === ERROR_NOT_FOUND) return "missing";
    throw new PlatformNativeError(`OpenJobObjectW membership failed:${name}:err=${String(err)}`);
  }
  return withCheckedHandle(n, handle, `OpenJobObjectW membership:${name}`, () => {
    let size = 8 + 8 * 64;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const info = Buffer.alloc(size);
      const retLen = [0];
      if (n.QueryInformationJobObject(handle, JobObjectBasicProcessIdList, info, info.length, retLen)) {
        const inList = info.readUInt32LE(4);
        const cap = Math.min(inList, Math.floor((info.length - 8) / 8));
        for (let i = 0; i < cap; i += 1) {
          const id = Number(info.readBigUInt64LE(8 + i * 8));
          if (id === pid) return true;
        }
        return false;
      }
      const err = Number(n.GetLastError());
      if (err === ERROR_MORE_DATA) {
        const needed = retLen[0] ?? 0;
        size = Math.max(needed, size * 2);
        continue;
      }
      throw new PlatformNativeError(`QueryInformationJobObject pid list failed:${name}:err=${String(err)}`);
    }
    throw new PlatformNativeError(`QueryInformationJobObject pid list unbounded:${name}`);
  });
}

/** JOBOBJECT_BASIC_ACCOUNTING_INFORMATION.ActiveProcesses。 */
export function namedJobActiveProcessCountWin32(job: Win32Job): number {
  if (isNullHandle(job.handle)) throw new PlatformNativeError("named job handle closed");
  return queryJobActiveFromHandleWin32(job.handle);
}

export function openProcessHandleWin32(pid: number): { handle: unknown } | "missing" {
  const n = nativeSync();
  const handle = n.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
  if (isNullHandle(handle)) {
    const err = Number(n.GetLastError());
    if (err === ERROR_FILE_NOT_FOUND || err === ERROR_NOT_FOUND || err === 87) return "missing";
    throw new PlatformNativeError(`OpenProcess failed:${String(pid)}:err=${String(err)}`);
  }
  return { handle };
}

export function processBirthFromHandleWin32(handle: unknown, pid: number): string | null {
  const n = nativeSync();
  const creation = { dwLowDateTime: 0, dwHighDateTime: 0 };
  const exit = { dwLowDateTime: 0, dwHighDateTime: 0 };
  const kernel = { dwLowDateTime: 0, dwHighDateTime: 0 };
  const user = { dwLowDateTime: 0, dwHighDateTime: 0 };
  if (!n.GetProcessTimes(handle, creation, exit, kernel, user)) {
    throw new PlatformNativeError(`GetProcessTimes failed:${String(pid)}:err=${String(n.GetLastError())}`);
  }
  return `ft:${String(creation.dwHighDateTime)}:${String(creation.dwLowDateTime)}:${String(pid)}`;
}

export function processStillActiveFromHandleWin32(handle: unknown): boolean | "unknown" {
  const n = nativeSync();
  const code = [0];
  if (!n.GetExitCodeProcess(handle, code)) return "unknown";
  return code[0] === STILL_ACTIVE;
}

export function openJobHandleWin32(name: string): { handle: unknown } | "missing" {
  const n = nativeSync();
  const access = JOB_OBJECT_TERMINATE | JOB_OBJECT_QUERY | JOB_OBJECT_ASSIGN_PROCESS | JOB_OBJECT_SET_ATTRIBUTES;
  const handle = n.OpenJobObjectW(access, 0, name);
  if (isNullHandle(handle)) {
    const err = Number(n.GetLastError());
    if (err === ERROR_FILE_NOT_FOUND || err === ERROR_NOT_FOUND) return "missing";
    throw new PlatformNativeError(`OpenJobObjectW failed:${name}:err=${String(err)}`);
  }
  return { handle };
}

export function queryJobActiveFromHandleWin32(handle: unknown): number {
  const n = nativeSync();
  const info = Buffer.alloc(48);
  const retLen = [0];
  if (!n.QueryInformationJobObject(handle, JobObjectBasicAccountingInformation, info, info.length, retLen)) {
    throw new PlatformNativeError(`QueryInformationJobObject failed:${String(n.GetLastError())}`);
  }
  return info.readUInt32LE(40);
}

export function jobContainsPidFromHandleWin32(handle: unknown, pid: number): boolean {
  const n = nativeSync();
  let size = 8 + 8 * 64;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const info = Buffer.alloc(size);
    const retLen = [0];
    if (n.QueryInformationJobObject(handle, JobObjectBasicProcessIdList, info, info.length, retLen)) {
      const inList = info.readUInt32LE(4);
      const cap = Math.min(inList, Math.floor((info.length - 8) / 8));
      for (let i = 0; i < cap; i += 1) {
        const id = Number(info.readBigUInt64LE(8 + i * 8));
        if (id === pid) return true;
      }
      return false;
    }
    const err = Number(n.GetLastError());
    if (err === ERROR_MORE_DATA) {
      const needed = retLen[0] ?? 0;
      size = Math.max(needed, size * 2);
      continue;
    }
    throw new PlatformNativeError(`QueryInformationJobObject pid list failed:err=${String(err)}`);
  }
  throw new PlatformNativeError("QueryInformationJobObject pid list unbounded");
}

export function isProcessInJobFromHandlesWin32(processHandle: unknown, jobHandle: unknown): boolean {
  const n = nativeSync();
  const result = [0];
  if (!n.IsProcessInJob(processHandle, jobHandle, result)) {
    throw new PlatformNativeError(`IsProcessInJob failed:err=${String(n.GetLastError())}`);
  }
  return result[0] !== 0;
}

export function terminateJobFromHandleWin32(handle: unknown): void {
  const n = nativeSync();
  if (!n.TerminateJobObject(handle, 1)) {
    throw new PlatformNativeError(`TerminateJobObject failed:err=${String(n.GetLastError())}`);
  }
}

export function closeRawHandleWin32(handle: unknown, label: string): void {
  const n = nativeSync();
  closeHandleChecked(n, handle, label);
}

export function assignProcessHandleToJobWin32(job: Win32Job, processHandle: unknown): void {
  if (isNullHandle(job.handle) || isNullHandle(processHandle)) {
    throw new PlatformNativeError("assign process handle missing");
  }
  const n = nativeSync();
  if (!n.AssignProcessToJobObject(job.handle, processHandle)) {
    throw new PlatformNativeError(`AssignProcessToJobObject failed:err=${String(n.GetLastError())}`);
  }
}

export function terminateProcessFromHandleWin32(processHandle: unknown): void {
  if (isNullHandle(processHandle)) throw new PlatformNativeError("terminate process handle missing");
  const n = nativeSync();
  if (!n.TerminateProcess(processHandle, 1) && Number(n.GetLastError()) !== 5) {
    throw new PlatformNativeError(`TerminateProcess failed:err=${String(n.GetLastError())}`);
  }
}

export function processHandleCountWin32(processHandle: unknown): number {
  const n = nativeSync();
  const count = [0];
  if (!n.GetProcessHandleCount(processHandle, count)) {
    throw new PlatformNativeError(`GetProcessHandleCount failed:err=${String(n.GetLastError())}`);
  }
  return count[0] ?? 0;
}

/** GetHandleInformation 成功即仍打开。已 CloseHandle 的值应失败。 */
export function isWin32HandleOpen(handle: unknown): boolean {
  const n = nativeSync();
  if (isNullHandle(handle) || isInvalidHandle(n, handle)) return false;
  const flags = [0];
  n.SetLastError(0);
  return n.GetHandleInformation(handle, flags) !== 0;
}

export function isWin32FdClosed(fd: number): boolean {
  if (!Number.isInteger(fd) || fd < 0) return true;
  try {
    fstatSync(fd);
    return false;
  } catch (err) {
    const code = typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: unknown }).code
      : undefined;
    return code === "EBADF";
  }
}

function handleAddress(n: Native, handle: unknown): bigint {
  const addr = n.koffi.address(handle);
  return typeof addr === "bigint" ? addr : BigInt(addr);
}

function isInvalidHandle(n: Native, handle: unknown): boolean {
  if (isNullHandle(handle)) return true;
  try {
    return handleAddress(n, handle) === INVALID_HANDLE_VALUE;
  } catch {
    return true;
  }
}

const LOCKFILE_WHOLE_LOW = 0xffffffff;
const LOCKFILE_WHOLE_HIGH = 0xffffffff;

function emptyOverlapped(n: Native): Buffer {
  return Buffer.alloc(n.koffi.sizeof(n.OVERLAPPED));
}

export const WIN32_PROC_THREAD_ATTRIBUTE_HANDLE_LIST = PROC_THREAD_ATTRIBUTE_HANDLE_LIST;

export function win32StartupLayout(): {
  startupinfo: number;
  startupinfoex: number;
  processInformation: number;
  lpAttributeListOffset: number;
  processIdOffset: number;
  pointerSize: 8;
  handleListAttribute: number;
} {
  const n = nativeSync();
  if (typeof n.koffi.offsetof !== "function") {
    throw new PlatformNativeError("koffi.offsetof unavailable");
  }
  return {
    startupinfo: n.koffi.sizeof(n.STARTUPINFOW),
    startupinfoex: n.koffi.sizeof(n.STARTUPINFOEXW),
    processInformation: n.koffi.sizeof(n.PROCESS_INFORMATION),
    lpAttributeListOffset: n.koffi.offsetof(n.STARTUPINFOEXW, "lpAttributeList"),
    processIdOffset: n.koffi.offsetof(n.PROCESS_INFORMATION, "dwProcessId"),
    pointerSize: win32PointerSize(),
    handleListAttribute: WIN32_PROC_THREAD_ATTRIBUTE_HANDLE_LIST
  };
}

export function tryLockFileExclusiveWin32(path: string): { release(): void } | "busy" {
  const n = nativeSync();
  const handle = n.CreateFileW(
    path,
    GENERIC_READ | GENERIC_WRITE,
    FILE_SHARE_READ | FILE_SHARE_WRITE,
    null,
    OPEN_ALWAYS,
    FILE_ATTRIBUTE_NORMAL,
    null
  );
  if (isInvalidHandle(n, handle)) {
    throw new PlatformNativeError(`CreateFileW lock failed:err=${String(n.GetLastError())}`);
  }
  const overlapped = emptyOverlapped(n);
  if (!n.LockFileEx(
    handle,
    LOCKFILE_EXCLUSIVE_LOCK | LOCKFILE_FAIL_IMMEDIATELY,
    0,
    LOCKFILE_WHOLE_LOW,
    LOCKFILE_WHOLE_HIGH,
    overlapped
  )) {
    const err = Number(n.GetLastError());
    closeHandleChecked(n, handle, "lock-file");
    if (err === 33 || err === 32) return "busy";
    throw new PlatformNativeError(`LockFileEx failed:err=${String(err)}`);
  }
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      try {
        n.UnlockFileEx(handle, 0, LOCKFILE_WHOLE_LOW, LOCKFILE_WHOLE_HIGH, emptyOverlapped(n));
      } catch {
        // 进程退出仍由 OS 释放
      }
      closeHandleChecked(n, handle, "lock-file");
    }
  };
}

export function waitProcessHandleWin32(processHandle: unknown, timeoutMs: number): "signaled" | "timeout" | "unknown" {
  const n = nativeSync();
  const rc = n.WaitForSingleObject(processHandle, timeoutMs >>> 0);
  if (rc === WAIT_OBJECT_0) return "signaled";
  if (rc === WAIT_TIMEOUT) return "timeout";
  return "unknown";
}

export function exitCodeFromHandleWin32(processHandle: unknown): number | "live" | "unknown" {
  const n = nativeSync();
  const code = [0];
  if (!n.GetExitCodeProcess(processHandle, code)) return "unknown";
  const value = code[0];
  if (value === undefined) return "unknown";
  if (value === STILL_ACTIVE) return "live";
  if (!Number.isInteger(value)) return "unknown";
  return value;
}

export function parseCommandLineWin32(commandLine: string): string[] {
  const n = nativeSync();
  const argc = [0];
  const argv = n.CommandLineToArgvW(utf16zBuffer(commandLine), argc);
  if (isNullHandle(argv)) {
    throw new PlatformNativeError(`CommandLineToArgvW failed:err=${String(n.GetLastError())}`);
  }
  try {
    const count = argc[0] ?? 0;
    const out: string[] = [];
    const ptrSize = win32PointerSize();
    for (let i = 0; i < count; i += 1) {
      const slot = n.koffi.decode(argv, i * ptrSize, "void *") as unknown;
      if (slot == null) continue;
      out.push(n.koffi.decode.string16(slot));
    }
    return out;
  } finally {
    n.LocalFree(argv);
  }
}

export interface OwnedWindowsProcessWin32 {
  pid: number;
  processHandle: unknown;
  threadHandle: unknown;
  /** 父进程侧已不再经 CRT fd；保留字段仅为测试 stub 形状兼容，生产恒为 -1。 */
  stdioFds: { stdin: number; stdout: number; stderr: number; extra: number };
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  extra: Writable;
  resume: () => void;
  terminateFromHandle: () => void;
  disposeStdio: () => void;
  closeProcessHandle: () => void;
  waitForExit: (timeoutMs: number) => "signaled" | "timeout" | "unknown";
  readExitCode: () => number | "live" | "unknown";
}

export type Win32SpawnFault =
  | "create-pipe"
  | "set-handle-information"
  | "init-attr-list"
  | "update-attr"
  | "create-process"
  | "after-create-before-close-child"
  | "wrap-stdio"
  | "resume-thread"
  | "terminate-process"
  | "wait-process"
  | "exit-code"
  | "close-handle";

let spawnFaultForTests: Win32SpawnFault | null = null;

export function setWin32SpawnFaultForTests(next: Win32SpawnFault | null): void {
  spawnFaultForTests = next;
}

function hitSpawnFault(point: Win32SpawnFault): void {
  if (spawnFaultForTests === point) {
    spawnFaultForTests = null;
    throw new PlatformNativeError(`spawn fault:${point}`);
  }
}

function utf16zBuffer(text: string): Buffer {
  return Buffer.from(`${text}\0`, "utf16le");
}

function envBlockWin32(env?: NodeJS.ProcessEnv): Buffer {
  const source = env ?? process.env;
  // CreateProcessW 的环境块合同要求按变量名排序（大小写不敏感的 Unicode 序）。
  // Object.entries 给的是插入序：继承环境尾部追加 SAYDO_PERMIT_PIPE、或调用方传入
  // {Z:..., A:...} 都会产出不合同的块。用 toUpperCase 比较而非 localeCompare——
  // 后者依赖 locale，同一份 env 在不同机器上会排出不同顺序。
  const lines = Object.entries(source)
    .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
    .sort(([a], [b]) => {
      const ua = a.toUpperCase();
      const ub = b.toUpperCase();
      if (ua < ub) return -1;
      if (ua > ub) return 1;
      return a < b ? -1 : a > b ? 1 : 0;
    })
    .map(([key, value]) => `${key}=${value}`);
  return Buffer.from(`${lines.join("\0")}\0\0`, "utf16le");
}

function writeHandle(buf: Buffer, offset: number, handle: unknown, n: Native): void {
  buf.writeBigUInt64LE(handleAddress(n, handle), offset);
}

function ownErrnoCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function securityAttributes(n: Native, inherit: number): {
  nLength: number;
  lpSecurityDescriptor: null;
  bInheritHandle: number;
} {
  return {
    nLength: n.koffi.sizeof(n.SECURITY_ATTRIBUTES),
    lpSecurityDescriptor: null,
    bInheritHandle: inherit
  };
}

function stdioPipeName(generation: string, stream: "stdin" | "stdout" | "stderr"): string {
  return `\\\\.\\pipe\\saydo-stdio-${generation}-${stream}`;
}

/**
 * 父进程 server HANDLE + 可继承 client HANDLE。CreateNamedPipeW 后立即 CreateFileW：
 * 内核完成连接，不经过 net.Server 的 IOCP accept，因此可在同步 spawn 里用。
 * parentWrites=true：stdin（父写子读）；false：stdout/stderr（子写父读）。
 */
function createNamedStdioPair(
  n: Native,
  name: string,
  parentWrites: boolean
): { server: unknown; client: unknown } {
  hitSpawnFault("create-pipe");
  const server = n.CreateNamedPipeW(
    name,
    (parentWrites ? PIPE_ACCESS_OUTBOUND : PIPE_ACCESS_INBOUND) | FILE_FLAG_FIRST_PIPE_INSTANCE,
    0,
    1,
    STDIO_PIPE_BUFFER,
    STDIO_PIPE_BUFFER,
    0,
    securityAttributes(n, 0)
  );
  if (isNullHandle(server) || isInvalidHandle(n, server)) {
    throw new PlatformNativeError(`CreateNamedPipeW stdio failed:err=${String(n.GetLastError())}`);
  }
  const client = n.CreateFileW(
    name,
    parentWrites ? GENERIC_READ : GENERIC_WRITE,
    0,
    securityAttributes(n, 1),
    OPEN_EXISTING,
    FILE_ATTRIBUTE_NORMAL,
    null
  );
  if (isNullHandle(client) || isInvalidHandle(n, client)) {
    const err = n.GetLastError();
    try {
      closeHandleChecked(n, server, "stdio-server");
    } catch {
      // 回滚 server
    }
    throw new PlatformNativeError(`CreateFileW stdio client failed:err=${String(err)}`);
  }
  return { server, client };
}

function closeHandleQuiet(n: Native, handle: unknown, label: string): void {
  try {
    closeHandleChecked(n, handle, label);
  } catch {
    // 已关或 rollback 中
  }
}

function pipeErrno(code: "EOF" | "EPIPE", message: string): NodeJS.ErrnoException {
  const err = new PlatformNativeError(message) as PlatformNativeError & NodeJS.ErrnoException;
  err.code = code;
  return err;
}

function readHandleAsync(n: Native, handle: unknown, buf: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    const got = [0];
    n.ReadFile.async(handle, buf, buf.length, got, null, (err, ok) => {
      if (err) {
        reject(pipeErrno("EOF", "named pipe read failed"));
        return;
      }
      if (!ok) {
        resolve(0);
        return;
      }
      resolve(got[0] ?? 0);
    });
  });
}

function writeHandleAsync(n: Native, handle: unknown, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const written = [0];
    n.WriteFile.async(handle, data, data.length, written, null, (err, ok) => {
      if (err) {
        reject(pipeErrno("EPIPE", "named pipe write failed"));
        return;
      }
      if (!ok || (written[0] ?? 0) !== data.length) {
        reject(pipeErrno("EPIPE", "named pipe write short"));
        return;
      }
      resolve();
    });
  });
}

function handleReadable(n: Native, handle: unknown, label: string): Readable {
  let closed = false;
  let reading = false;
  const release = (): void => {
    if (closed) return;
    closed = true;
    closeHandleQuiet(n, handle, label);
  };
  const stream = new Readable({
    highWaterMark: STDIO_PIPE_BUFFER,
    read() {
      if (reading || closed) return;
      reading = true;
      const buf = Buffer.alloc(STDIO_PIPE_BUFFER);
      void readHandleAsync(n, handle, buf).then(
        (nread) => {
          reading = false;
          if (closed) return;
          if (nread <= 0) {
            release();
            stream.push(null);
            return;
          }
          stream.push(Buffer.from(buf.subarray(0, nread)));
        },
        (err: unknown) => {
          reading = false;
          if (closed) return;
          release();
          stream.destroy(err instanceof Error ? err : pipeErrno("EOF", "named pipe read failed"));
        }
      );
    },
    destroy(err, cb) {
      release();
      cb(err);
    }
  });
  return stream;
}

function handleWritable(n: Native, handle: unknown, label: string): Writable {
  let closed = false;
  const release = (): void => {
    if (closed) return;
    closed = true;
    closeHandleQuiet(n, handle, label);
  };
  return new Writable({
    highWaterMark: STDIO_PIPE_BUFFER,
    write(chunk, encoding, cb) {
      if (closed) {
        cb(pipeErrno("EPIPE", "named pipe write after close"));
        return;
      }
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string, encoding);
      void writeHandleAsync(n, handle, data).then(
        () => cb(),
        (err: unknown) => {
          release();
          cb(err instanceof Error ? err : pipeErrno("EPIPE", "named pipe write failed"));
        }
      );
    },
    final(cb) {
      release();
      cb();
    },
    destroy(err, cb) {
      release();
      cb(err);
    }
  });
}

/**
 * 最短链路自证：父进程 net.createServer / net.connect 命名管道往返，不经 CreateProcessW，
 * 也不经 CRT fd。证明 Node 原生命名管道在本进程内可读写。
 */
export async function roundtripWin32NamedPipe(payload: string): Promise<string> {
  if (hostKind() !== "win32") throw new PlatformNativeError("roundtripWin32NamedPipe is win32-only");
  const name = stdioPipeName(randomUUID(), "stdout");
  const server = createServer();
  const received = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PlatformNativeError("named pipe roundtrip timeout")), 8_000);
    server.once("connection", (socket) => {
      const chunks: Buffer[] = [];
      socket.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      socket.once("end", () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
      socket.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    server.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.listen(name, () => resolve());
    server.once("error", reject);
  });
  try {
    const client = createConnection(name);
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => resolve());
      client.once("error", reject);
    });
    await new Promise<void>((resolve, reject) => {
      client.write(payload, (err) => {
        if (err) reject(err);
        else {
          client.end();
          resolve();
        }
      });
    });
    return await received;
  } finally {
    server.close();
  }
}

/** @deprecated 双 CRT 隔离后匿名管道 + _open_osfhandle 已废弃；转 roundtripWin32NamedPipe。 */
export async function roundtripWin32AnonymousPipe(payload: string): Promise<string> {
  return roundtripWin32NamedPipe(payload);
}

export function createWin32PermitPipe(generation: string): { name: string; handle: unknown } {
  if (hostKind() !== "win32") throw new PlatformNativeError("createWin32PermitPipe is win32-only");
  if (!GENERATION_RE.test(generation)) {
    throw new PlatformNativeError("permit pipe generation invalid");
  }
  // win32 permit 不走 CRT lpReserved2/fd3：真机 fstat(3) 为 FILE_TYPE_UNKNOWN
  // （CRT 槽位在、底层 handle 无效）。命名管道按名字连接，不依赖句柄继承。
  const name = `\\\\.\\pipe\\saydo-permit-${generation}`;
  const n = nativeSync();
  const handle = n.CreateNamedPipeW(
    name,
    PIPE_ACCESS_OUTBOUND | FILE_FLAG_FIRST_PIPE_INSTANCE,
    PIPE_NOWAIT,
    1,
    16,
    16,
    5_000,
    null
  );
  if (isNullHandle(handle) || isInvalidHandle(n, handle)) {
    throw new PlatformNativeError(`CreateNamedPipeW failed:err=${String(n.GetLastError())}`);
  }
  return { name, handle };
}

export async function grantWin32Permit(handle: unknown, signal?: AbortSignal): Promise<void> {
  if (hostKind() !== "win32") throw new PlatformNativeError("grantWin32Permit is win32-only");
  const n = nativeSync();
  if (isNullHandle(handle) || isInvalidHandle(n, handle)) {
    throw new PlatformNativeError("permit pipe handle invalid");
  }
  const deadline = Date.now() + PERMIT_CONNECT_TIMEOUT_MS;
  const aborted = (): boolean => signal?.aborted === true;
  const pause = (): Promise<void> => new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
  for (;;) {
    if (aborted()) throw new PlatformNativeError("permit aborted");
    n.SetLastError(0);
    if (n.ConnectNamedPipe(handle, null)) break;
    const err = Number(n.GetLastError());
    if (err === ERROR_PIPE_CONNECTED) break;
    if (err !== ERROR_PIPE_LISTENING) {
      throw new PlatformNativeError(`ConnectNamedPipe failed:err=${String(err)}`);
    }
    if (Date.now() >= deadline) {
      throw new PlatformNativeError("ConnectNamedPipe timeout");
    }
    await pause();
  }
  const payload = Buffer.from("1");
  for (;;) {
    if (aborted()) throw new PlatformNativeError("permit aborted");
    const written = [0];
    n.SetLastError(0);
    if (n.WriteFile(handle, payload, payload.length, written, null) && (written[0] ?? 0) === payload.length) {
      return;
    }
    const err = Number(n.GetLastError());
    if (err !== ERROR_NO_DATA) {
      throw new PlatformNativeError(`permit WriteFile failed:err=${String(err)}`);
    }
    if (Date.now() >= deadline) {
      throw new PlatformNativeError("permit WriteFile timeout");
    }
    await pause();
  }
}

export function closeWin32Permit(handle: unknown): void {
  if (hostKind() !== "win32") return;
  const n = nativeSync();
  if (isNullHandle(handle) || isInvalidHandle(n, handle)) return;
  try {
    closeHandleChecked(n, handle, "permit-pipe");
  } catch {
    // 已关
  }
}

type SpawnResource =
  | { kind: "handle"; handle: unknown; label: string; owner: "native" | "stream" | "closed" }
  | { kind: "attr"; list: Buffer; owner: "open" | "closed" };

export type Win32SpawnResourceAudit = {
  kind: "handle" | "attr";
  label: string;
  owner: string;
};

let lastSpawnRollbackAudit: Win32SpawnResourceAudit[] = [];

export function lastWin32SpawnRollbackAudit(): Win32SpawnResourceAudit[] {
  return lastSpawnRollbackAudit.slice();
}

function snapshotSpawnResources(resources: SpawnResource[]): Win32SpawnResourceAudit[] {
  return resources.map((item) => ({
    kind: item.kind,
    label: item.kind === "attr" ? "attr-list" : item.label,
    owner: item.owner
  }));
}

function brandRollbackCloseFailure(err: unknown): Error {
  if (isPlatformNativeError(err)) return err;
  const code = ownErrnoCode(err);
  return new PlatformNativeError(code ? `spawn rollback close failed:${code}` : "spawn rollback close failed");
}

function closeSpawnResource(n: Native, resource: SpawnResource): void {
  if (resource.kind === "handle") {
    if (resource.owner !== "native") return;
    try {
      closeHandleChecked(n, resource.handle, resource.label);
      resource.owner = "closed";
    } catch (err) {
      throw brandRollbackCloseFailure(err);
    }
    return;
  }
  if (resource.owner !== "open") return;
  try {
    n.DeleteProcThreadAttributeList(resource.list);
    resource.owner = "closed";
  } catch (err) {
    throw brandRollbackCloseFailure(err);
  }
}

function transferHandleToStream(resources: SpawnResource[], handle: unknown): void {
  const found = resources.find((item) => item.kind === "handle" && item.handle === handle);
  if (found && found.kind === "handle") found.owner = "stream";
}

function rememberHandle(resources: SpawnResource[], handle: unknown, label: string): void {
  resources.push({ kind: "handle", handle, label, owner: "native" });
}

export class SpawnRollbackRetainedError extends PlatformNativeError {
  readonly processHandle: unknown;
  readonly pid: number;
  constructor(message: string, processHandle: unknown, pid: number) {
    super(message);
    this.name = "SpawnRollbackRetainedError";
    this.processHandle = processHandle;
    this.pid = pid;
  }
}

function rollbackSuspendedChild(n: Native, processHandle: unknown | null, resources: SpawnResource[], pid = 0): void {
  let proven = isNullHandle(processHandle);
  if (!isNullHandle(processHandle)) {
    let terminated = false;
    try {
      terminated = n.TerminateProcess(processHandle, 1) !== 0;
    } catch {
      terminated = false;
    }
    let wait: number | "unknown" = "unknown";
    let exit: ReturnType<typeof exitCodeFromHandleWin32> = "unknown";
    try {
      wait = n.WaitForSingleObject(processHandle, 5_000);
    } catch {
      wait = "unknown";
    }
    try {
      exit = exitCodeFromHandleWin32(processHandle);
    } catch {
      exit = "unknown";
    }
    proven = terminated && wait === WAIT_OBJECT_0 && exit !== "live" && exit !== "unknown";
  }
  let closeErr: unknown;
  for (let i = resources.length - 1; i >= 0; i -= 1) {
    const item = resources[i] as SpawnResource;
    if (item.kind === "handle" && item.label === "spawn-process" && !isNullHandle(processHandle)) {
      continue;
    }
    try {
      closeSpawnResource(n, item);
    } catch (err) {
      closeErr ??= brandRollbackCloseFailure(err);
    }
  }
  lastSpawnRollbackAudit = snapshotSpawnResources(resources);
  if (proven) {
    if (!isNullHandle(processHandle)) {
      const found = resources.find((item) => item.kind === "handle" && item.label === "spawn-process");
      if (found && found.kind === "handle") {
        try {
          closeSpawnResource(n, found);
        } catch (err) {
          closeErr ??= brandRollbackCloseFailure(err);
        }
      }
    }
    lastSpawnRollbackAudit = snapshotSpawnResources(resources);
    if (closeErr) throw closeErr;
    return;
  }
  throw new SpawnRollbackRetainedError("spawn rollback did not prove terminal", processHandle, pid);
}

function initAttributeList(n: Native): Buffer {
  hitSpawnFault("init-attr-list");
  const size = [0n] as unknown as number[];
  n.InitializeProcThreadAttributeList(null, 1, 0, size);
  const needed = Number(size[0] ?? 0);
  if (!Number.isInteger(needed) || needed <= 0) {
    throw new PlatformNativeError("InitializeProcThreadAttributeList size failed");
  }
  const list = Buffer.alloc(needed);
  if (!n.InitializeProcThreadAttributeList(list, 1, 0, size)) {
    throw new PlatformNativeError(`InitializeProcThreadAttributeList failed:err=${String(n.GetLastError())}`);
  }
  return list;
}

/**
 * CREATE_SUSPENDED + STARTUPINFOEXW HANDLE_LIST + STARTF_USESTDHANDLES。
 * 不传 CRT lpReserved2：permit 已走命名管道；lpReserved2 会覆盖 fd0-2 且 handle 在子进程无效。
 * 调用方拥有 process handle，必须 closeProcessHandle 恰好一次。
 */
function assertNoEmbeddedNul(label: string, value: string): void {
  if (value.includes("\0")) throw new PlatformNativeError(`${label} contains NUL`);
}

export function createSuspendedOwnedProcessWin32(input: {
  file: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  generation?: string;
}): OwnedWindowsProcessWin32 {
  const n = nativeSync();
  win32PointerSize();
  assertNoEmbeddedNul("file", input.file);
  for (const arg of input.args) assertNoEmbeddedNul("argv", arg);
  if (input.cwd) assertNoEmbeddedNul("cwd", input.cwd);
  if (input.env) {
    for (const [key, value] of Object.entries(input.env)) {
      if (typeof key === "string") assertNoEmbeddedNul("env", key);
      if (typeof value === "string") assertNoEmbeddedNul("env", value);
    }
  }
  const generation = input.generation ?? randomUUID();
  if (!GENERATION_RE.test(generation)) {
    throw new PlatformNativeError("stdio pipe generation invalid");
  }
  const resources: SpawnResource[] = [];
  let processHandle: unknown = null;
  let spawnedPid = 0;
  try {
    // 命名管道：子进程经 STARTF_USESTDHANDLES 拿到 client HANDLE（CRT fd 0/1/2）。
    // 父进程保留 server HANDLE，用 koffi 异步 ReadFile/WriteFile 包成 Node 流。
    // 不经 _open_osfhandle：koffi CRT fd 表与 Node/libuv fd 表隔离，flags 怎么调都会 EBADF。
    const stdin = createNamedStdioPair(n, stdioPipeName(generation, "stdin"), true);
    rememberHandle(resources, stdin.server, "stdin-server");
    rememberHandle(resources, stdin.client, "stdin-client");
    const stdout = createNamedStdioPair(n, stdioPipeName(generation, "stdout"), false);
    rememberHandle(resources, stdout.server, "stdout-server");
    rememberHandle(resources, stdout.client, "stdout-client");
    const stderr = createNamedStdioPair(n, stdioPipeName(generation, "stderr"), false);
    rememberHandle(resources, stderr.server, "stderr-server");
    rememberHandle(resources, stderr.client, "stderr-client");
    hitSpawnFault("set-handle-information");
    if (!n.SetHandleInformation(stdin.server, HANDLE_FLAG_INHERIT, 0) ||
      !n.SetHandleInformation(stdout.server, HANDLE_FLAG_INHERIT, 0) ||
      !n.SetHandleInformation(stderr.server, HANDLE_FLAG_INHERIT, 0)
    ) {
      throw new PlatformNativeError(`SetHandleInformation failed:err=${String(n.GetLastError())}`);
    }
    const childHandles = [stdin.client, stdout.client, stderr.client];
    for (const handle of childHandles) {
      if (!n.SetHandleInformation(handle, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT)) {
        throw new PlatformNativeError(`SetHandleInformation inherit failed:err=${String(n.GetLastError())}`);
      }
      const flags = [0];
      if (!n.GetHandleInformation(handle, flags) || ((flags[0] ?? 0) & HANDLE_FLAG_INHERIT) === 0) {
        throw new PlatformNativeError("child stdio handle not inheritable");
      }
    }
    const handleList = Buffer.alloc(win32PointerSize() * childHandles.length);
    for (let i = 0; i < childHandles.length; i += 1) {
      writeHandle(handleList, i * win32PointerSize(), childHandles[i], n);
    }
    const attrList = initAttributeList(n);
    resources.push({ kind: "attr", list: attrList, owner: "open" });
    hitSpawnFault("update-attr");
    if (!n.UpdateProcThreadAttribute(
      attrList,
      0,
      PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
      handleList,
      handleList.length,
      null,
      null
    )) {
      throw new PlatformNativeError(`UpdateProcThreadAttribute failed:err=${String(n.GetLastError())}`);
    }
    const si = {
      StartupInfo: {
        cb: n.koffi.sizeof(n.STARTUPINFOEXW),
        lpReserved: null,
        lpDesktop: null,
        lpTitle: null,
        dwX: 0,
        dwY: 0,
        dwXSize: 0,
        dwYSize: 0,
        dwXCountChars: 0,
        dwYCountChars: 0,
        dwFillAttribute: 0,
        dwFlags: STARTF_USESTDHANDLES,
        wShowWindow: 0,
        cbReserved2: 0,
        lpReserved2: null,
        hStdInput: stdin.client,
        hStdOutput: stdout.client,
        hStdError: stderr.client
      },
      lpAttributeList: attrList
    };
    const pi = {
      hProcess: null as unknown,
      hThread: null as unknown,
      dwProcessId: 0,
      dwThreadId: 0
    };
    const command = utf16zBuffer(quoteWin32CommandLine(input.file, input.args));
    const env = envBlockWin32(input.env);
    hitSpawnFault("create-process");
    if (!n.CreateProcessW(
      input.file,
      command,
      null,
      null,
      1,
      CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT,
      env,
      input.cwd ?? null,
      si,
      pi
    )) {
      throw new PlatformNativeError(`CreateProcessW failed:err=${String(n.GetLastError())}`);
    }
    processHandle = pi.hProcess;
    spawnedPid = pi.dwProcessId;
    rememberHandle(resources, pi.hProcess, "spawn-process");
    rememberHandle(resources, pi.hThread, "spawn-thread");
    if (isNullHandle(pi.hProcess) || isNullHandle(pi.hThread) || !Number.isInteger(pi.dwProcessId) || pi.dwProcessId <= 1) {
      throw new PlatformNativeError("CreateProcessW identity incomplete");
    }
    hitSpawnFault("after-create-before-close-child");
    for (const handle of childHandles) {
      const found = resources.find((item) => item.kind === "handle" && item.handle === handle);
      closeHandleChecked(n, handle, "spawn-child-pipe");
      if (found && found.kind === "handle") found.owner = "closed";
    }
    hitSpawnFault("wrap-stdio");
    const stdinStream = handleWritable(n, stdin.server, "stdin-server");
    transferHandleToStream(resources, stdin.server);
    const stdoutStream = handleReadable(n, stdout.server, "stdout-server");
    transferHandleToStream(resources, stdout.server);
    const stderrStream = handleReadable(n, stderr.server, "stderr-server");
    transferHandleToStream(resources, stderr.server);
    const extraStream = new PassThrough();
    const attr = resources.find((item) => item.kind === "attr");
    if (attr) closeSpawnResource(n, attr);
    const ignoreReadClose = (err: NodeJS.ErrnoException): void => {
      const code = err.code;
      if (code === "EOF" || code === "EPIPE") return;
    };
    stdoutStream.on("error", ignoreReadClose);
    stderrStream.on("error", ignoreReadClose);
    let processClosed = false;
    let threadClosed = false;
    let stdioDisposed = false;
    const threadRes = resources.find((item) => item.kind === "handle" && item.label === "spawn-thread");
    const procRes = resources.find((item) => item.kind === "handle" && item.label === "spawn-process");
    const disposeParentStdio = (): void => {
      if (stdioDisposed) return;
      stdioDisposed = true;
      for (const stream of [stdinStream, stdoutStream, stderrStream, extraStream]) {
        try {
          stream.destroy();
        } catch {
          // 已关
        }
      }
    };
    return {
      pid: pi.dwProcessId,
      processHandle: pi.hProcess,
      threadHandle: pi.hThread,
      stdioFds: { stdin: -1, stdout: -1, stderr: -1, extra: -1 },
      stdin: stdinStream,
      stdout: stdoutStream,
      stderr: stderrStream,
      extra: extraStream,
      disposeStdio: disposeParentStdio,
      resume() {
        try {
          hitSpawnFault("resume-thread");
          if (threadClosed) throw new PlatformNativeError("ResumeThread handle closed");
          const prev = n.ResumeThread(pi.hThread);
          closeHandleChecked(n, pi.hThread, "spawn-thread");
          threadClosed = true;
          if (threadRes && threadRes.kind === "handle") threadRes.owner = "closed";
          if (prev === 0xffffffff) {
            throw new PlatformNativeError(`ResumeThread failed:err=${String(n.GetLastError())}`);
          }
        } catch (err) {
          let rollbackErr: unknown;
          try {
            rollbackSuspendedChild(n, processHandle, resources, spawnedPid);
          } catch (closeErr) {
            rollbackErr = closeErr;
          }
          try {
            disposeParentStdio();
          } catch {
            // 进程已尽量证死
          }
          if (rollbackErr instanceof SpawnRollbackRetainedError) throw rollbackErr;
          throw isPlatformNativeError(err) ? err : new PlatformNativeError("resume failed");
        }
      },
      terminateFromHandle() {
        hitSpawnFault("terminate-process");
        terminateProcessFromHandleWin32(pi.hProcess);
      },
      closeProcessHandle() {
        hitSpawnFault("close-handle");
        if (processClosed) throw new PlatformNativeError("process handle closed twice");
        disposeParentStdio();
        if (!threadClosed) {
          closeHandleChecked(n, pi.hThread, "spawn-thread");
          threadClosed = true;
          if (threadRes && threadRes.kind === "handle") threadRes.owner = "closed";
        }
        closeHandleChecked(n, pi.hProcess, "spawn-process");
        processClosed = true;
        if (procRes && procRes.kind === "handle") procRes.owner = "closed";
      },
      waitForExit(timeoutMs) {
        hitSpawnFault("wait-process");
        return waitProcessHandleWin32(pi.hProcess, timeoutMs);
      },
      readExitCode() {
        hitSpawnFault("exit-code");
        return exitCodeFromHandleWin32(pi.hProcess);
      }
    };
  } catch (err) {
    let rollbackErr: unknown;
    try {
      rollbackSuspendedChild(n, processHandle, resources, spawnedPid);
    } catch (closeErr) {
      rollbackErr = closeErr;
    }
    if (err instanceof SpawnRollbackRetainedError) throw err;
    if (rollbackErr instanceof SpawnRollbackRetainedError) throw rollbackErr;
    const head = isPlatformNativeError(err) ? err : new PlatformNativeError("suspended spawn failed");
    if (rollbackErr == null) throw head;
    const extraText = rollbackErr instanceof Error ? rollbackErr.message : "spawn rollback close failed";
    throw new PlatformNativeError(`${head.message}; rollback:${extraText}`);
  }
}
