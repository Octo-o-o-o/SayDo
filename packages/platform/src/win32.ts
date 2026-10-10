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

/** 注入 stdio overlapped 读/写/关/取消边界。不是真机 kernel32。 */
export type Win32PipeIoNative = {
  ConnectNamedPipe?: (handle: unknown, overlapped: unknown) => number;
  ReadFile: (handle: unknown, buf: Buffer, n: number, written: number[], overlapped: unknown) => number;
  WriteFile: (handle: unknown, buf: Buffer, n: number, written: number[], overlapped: unknown) => number;
  CreateEventW: (sa: unknown, manualReset: number, initialState: number, name: unknown) => unknown;
  CloseHandle: (h: unknown) => number;
  GetLastError: () => number;
  SetLastError: (code: number) => void;
  CancelIoEx: (handle: unknown, overlapped: unknown) => number;
  GetOverlappedResult: (
    handle: unknown,
    overlapped: unknown,
    transferred: number[],
    wait: number
  ) => number;
  WaitForSingleObject: (handle: unknown, ms: number) => number;
};

export type Win32PipeHandleOwner = {
  readonly handle: unknown;
  readonly label: string;
  released(): boolean;
  lastCloseError(): Error | undefined;
  lastFailure(): Error | undefined;
  inFlight(): boolean;
  retainInFlight(token: object): void;
  releaseInFlight(token: object): void;
  noteFailure(err: Error): void;
  close(): void;
};

export type Win32PipeIoResult = { kind: "data"; bytes: number } | { kind: "eof" };

export type Win32PipeIoSession = {
  readonly buffer: Buffer;
  readonly overlapped: unknown;
  readonly event: unknown;
  readonly promise: Promise<Win32PipeIoResult>;
  readonly failure: Promise<Error>;
  requestCancel(): Error | undefined;
};

export type Win32HandleStreamOptions = {
  owner?: Win32PipeHandleOwner;
  cancelWaitMs?: number;
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
  GetSecurityInfo: (handle: unknown, objType: number, info: number, owner: unknown[], group: unknown[], dacl: unknown[], sacl: unknown[], sd: unknown[]) => number;
  GetNamedPipeClientProcessId: (handle: unknown, pid: number[]) => number;
  GetNamedPipeServerProcessId: (handle: unknown, pid: number[]) => number;
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
  GetSecurityDescriptorControl: (
    sd: unknown,
    control: number[],
    revision: number[]
  ) => number;
  GetAclInformation: (
    acl: unknown,
    info: Buffer,
    infoLen: number,
    infoClass: number
  ) => number;
  GetAce: (acl: unknown, index: number, ace: unknown[]) => number;
  EqualSid: (sid1: unknown, sid2: unknown) => number;
  ConvertStringSidToSidW: (sid: string, out: unknown[]) => number;
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
  CreateEventW: (sa: unknown, manualReset: number, initialState: number, name: unknown) => unknown;
  CancelIoEx: (handle: unknown, overlapped: unknown) => number;
  GetOverlappedResult: (
    handle: unknown,
    overlapped: unknown,
    transferred: number[],
    wait: number
  ) => number;
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
export const WIN32_FILE_FLAG_OVERLAPPED = 0x40000000;
const STDIO_CANCEL_WAIT_MS = 250;
export const WIN32_ERROR_HANDLE_EOF = 38;
export const WIN32_ERROR_BROKEN_PIPE = 109;
export const WIN32_ERROR_OPERATION_ABORTED = 995;
export const WIN32_ERROR_IO_INCOMPLETE = 996;
export const WIN32_ERROR_IO_PENDING = 997;
export const WIN32_ERROR_PIPE_NOT_CONNECTED = 233;
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
    // GetSecurityDescriptorControl / GetAclInformation / GetAce / EqualSid /
    // ConvertStringSidToSidW 签名均按 Microsoft Learn 现行原型绑定，不自行改序。
    GetSecurityDescriptorControl: advapi32.func(
      "int32 __stdcall GetSecurityDescriptorControl(void *, _Out_ uint16 *, _Out_ uint32 *)"
    ) as Native["GetSecurityDescriptorControl"],
    GetAclInformation: advapi32.func(
      "int32 __stdcall GetAclInformation(void *, _Out_ uint8 *, uint32, uint32)"
    ) as Native["GetAclInformation"],
    GetAce: advapi32.func("int32 __stdcall GetAce(void *, uint32, _Out_ void **)") as Native["GetAce"],
    EqualSid: advapi32.func("int32 __stdcall EqualSid(void *, void *)") as Native["EqualSid"],
    ConvertStringSidToSidW: advapi32.func(
      "int32 __stdcall ConvertStringSidToSidW(str16, _Out_ void **)"
    ) as Native["ConvertStringSidToSidW"],
    CreateNamedPipeW: kernel32.func(
      "void * __stdcall CreateNamedPipeW(str16, uint32, uint32, uint32, uint32, uint32, uint32, _In_ SECURITY_ATTRIBUTES *)"
    ) as Native["CreateNamedPipeW"],
    ConnectNamedPipe: kernel32.func(
      "int32 __stdcall ConnectNamedPipe(void *, void *)"
    ) as Native["ConnectNamedPipe"],
    GetSecurityInfo: advapi32.func("uint32 __stdcall GetSecurityInfo(void *, uint32, uint32, _Out_ void **, _Out_ void **, _Out_ void **, _Out_ void **, _Out_ void **)") as Native["GetSecurityInfo"],
    GetNamedPipeClientProcessId: kernel32.func("int32 __stdcall GetNamedPipeClientProcessId(void *, _Out_ uint32 *)") as Native["GetNamedPipeClientProcessId"],
    GetNamedPipeServerProcessId: kernel32.func("int32 __stdcall GetNamedPipeServerProcessId(void *, _Out_ uint32 *)") as Native["GetNamedPipeServerProcessId"],
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
    CreateEventW: kernel32.func(
      "void * __stdcall CreateEventW(void *, int32, int32, void *)"
    ) as Native["CreateEventW"],
    CancelIoEx: kernel32.func(
      "int32 __stdcall CancelIoEx(void *, void *)"
    ) as Native["CancelIoEx"],
    GetOverlappedResult: kernel32.func(
      "int32 __stdcall GetOverlappedResult(void *, void *, _Out_ uint32 *, int32)"
    ) as Native["GetOverlappedResult"],
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
  return processUserSid(n, n.GetCurrentProcess());
}

function processUserSid(n: Native, processHandle: unknown): string {
  const token: unknown[] = [null];
  if (!n.OpenProcessToken(processHandle, TOKEN_QUERY, token) || token[0] == null) {
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

type VolumeNative = Pick<Native, "GetDriveTypeW" | "QueryDosDeviceW" | "GetVolumeInformationW">;
let volumeNativeForTests: VolumeNative | null = null;

/** 只供测试注入卷查询边界;不是真机 kernel32。生产入口不得调用。 */
export function setWin32NativeForTests(next: VolumeNative | null): void {
  volumeNativeForTests = next;
}

export function assertLocalFixedNtfs(absPath: string): void {
  if (!isAbsolute(absPath)) throw new PlatformNativeError("path must be absolute");
  const n = volumeNativeForTests ?? nativeSync();
  const root = volumeRoot(absPath);
  if (n.GetDriveTypeW(root) !== DRIVE_FIXED) {
    throw new PlatformNativeError(`volume is not DRIVE_FIXED:${root}`);
  }
  const dosName = root.replace(/[\\/]$/u, "");
  const deviceBuf = Buffer.alloc(4096);
  const q = n.QueryDosDeviceW(dosName, deviceBuf, Math.floor(deviceBuf.length / 2));
  if (q <= 0) {
    throw new PlatformNativeError(`QueryDosDeviceW failed:${root}`);
  }
  const device = utf16z(deviceBuf);
  if (!device.trim()) {
    throw new PlatformNativeError(`QueryDosDeviceW empty:${root}`);
  }
  if (device.startsWith("\\??\\")) {
    throw new PlatformNativeError(`subst/mapped volume rejected:${root}`);
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

const ADMINISTRATORS_SID = "S-1-5-32-544";
const SYSTEM_SID = "S-1-5-18";
export const ACCESS_ALLOWED_ACE_TYPE = 0x00;
const OBJECT_INHERIT_ACE = 0x01;
const CONTAINER_INHERIT_ACE = 0x02;
export const INHERITED_ACE = 0x10;
export const SE_DACL_PRESENT = 0x0004;
export const SE_DACL_PROTECTED = 0x1000;
const ACL_SIZE_INFORMATION = 2;
const ACE_SID_OFFSET = 8;
const FILE_GENERIC_READ = 0x00120089;
const FILE_GENERIC_WRITE = 0x00120116;
export const FILE_ALL_ACCESS = 0x001f01ff;
export const OWNER_ONLY_FILE_MASK = FILE_GENERIC_READ | FILE_GENERIC_WRITE;
export const OWNER_ONLY_DIR_FLAGS = OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE;
const SID_STRING_RE = /^S-\d+(-\d+)+$/iu;
// Microsoft Learn「SID Strings」里有稳定 well-known SID 的官方两字母别名。
// 域相关别名(DA/DU…)没有机器无关 SID，不能在这里臆造，只能当未知 fail-closed。
const SDDL_SID_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  WD: "S-1-1-0",
  CO: "S-1-3-0",
  CG: "S-1-3-1",
  OW: "S-1-3-4",
  NU: "S-1-5-2",
  IU: "S-1-5-4",
  SU: "S-1-5-6",
  AN: "S-1-5-7",
  ED: "S-1-5-9",
  PS: "S-1-5-10",
  AU: "S-1-5-11",
  RC: "S-1-5-12",
  SY: "S-1-5-18",
  LS: "S-1-5-19",
  NS: "S-1-5-20",
  BA: "S-1-5-32-544",
  BU: "S-1-5-32-545",
  BG: "S-1-5-32-546",
  PU: "S-1-5-32-547",
  AO: "S-1-5-32-548",
  SO: "S-1-5-32-549",
  PO: "S-1-5-32-550",
  BO: "S-1-5-32-551",
  RE: "S-1-5-32-552",
  RU: "S-1-5-32-554",
  RD: "S-1-5-32-555",
  NO: "S-1-5-32-556",
  MU: "S-1-5-32-558",
  LU: "S-1-5-32-559",
  IS: "S-1-5-32-568",
  CY: "S-1-5-32-569",
  ER: "S-1-5-32-573",
  CD: "S-1-5-32-574",
  RA: "S-1-5-32-575",
  ES: "S-1-5-32-576",
  MS: "S-1-5-32-577",
  HA: "S-1-5-32-578",
  AA: "S-1-5-32-579",
  RM: "S-1-5-32-580",
  AC: "S-1-15-2-1",
  LW: "S-1-16-4096",
  ME: "S-1-16-8192",
  MP: "S-1-16-8448",
  HI: "S-1-16-12288",
  SI: "S-1-16-16384"
});

export type Win32AclAceView = {
  aceType: number;
  aceFlags: number;
  mask: number;
  trusteeSid: string;
};

export type Win32AclReadbackView = {
  ownerSid: string;
  control: number;
  aces: Win32AclAceView[];
};

export function canonicalizeWin32SidToken(token: string): string | null {
  const trimmed = token.trim();
  if (SID_STRING_RE.test(trimmed)) return trimmed.toUpperCase();
  const mapped = SDDL_SID_ALIASES[trimmed.toUpperCase()];
  return mapped ?? null;
}

function sidTokensEqual(left: string, right: string): boolean {
  const a = canonicalizeWin32SidToken(left);
  const b = canonicalizeWin32SidToken(right);
  return a != null && b != null && a === b;
}

/**
 * 生产回读校验：Owner 必须是当前 SID；DACL 必须 present+protected；
 * 每个 ACE 的 trustee 与有效权限都必须是仅当前 SID 的 owner-only 授权。
 * Owner 正确 + 任意 allow ACE + 宽组黑名单 ≠ 仅 Owner。
 */
export function verifyRestrictOwnerOnlyReadback(
  currentSid: string,
  kind: "file" | "dir",
  view: Win32AclReadbackView
): void {
  if (!sidTokensEqual(view.ownerSid, currentSid)) {
    throw new PlatformNativeError("ACL readback owner SID mismatch");
  }
  if ((view.control & SE_DACL_PRESENT) === 0) {
    throw new PlatformNativeError("ACL readback DACL missing");
  }
  if ((view.control & SE_DACL_PROTECTED) === 0) {
    throw new PlatformNativeError("ACL readback is not protected");
  }
  if (view.aces.length === 0) {
    throw new PlatformNativeError("ACL readback has no owner allow ACE");
  }
  const expectedMask = kind === "dir" ? FILE_ALL_ACCESS : OWNER_ONLY_FILE_MASK;
  const expectedFlags = kind === "dir" ? OWNER_ONLY_DIR_FLAGS : 0;
  for (const ace of view.aces) {
    const trustee = canonicalizeWin32SidToken(ace.trusteeSid);
    if (trustee == null) {
      throw new PlatformNativeError(`ACL readback unknown trustee:${ace.trusteeSid}`);
    }
    if (ace.aceType !== ACCESS_ALLOWED_ACE_TYPE) {
      throw new PlatformNativeError(`ACL readback ACE type not allow:${String(ace.aceType)}`);
    }
    if ((ace.aceFlags & INHERITED_ACE) !== 0) {
      throw new PlatformNativeError("ACL readback contains inherited ACE");
    }
    if (ace.aceFlags !== expectedFlags) {
      throw new PlatformNativeError(`ACL readback ACE flags mismatch:${String(ace.aceFlags)}`);
    }
    if (ace.mask !== expectedMask) {
      throw new PlatformNativeError(`ACL readback ACE mask mismatch:${String(ace.mask)}`);
    }
    if (trustee !== canonicalizeWin32SidToken(currentSid)) {
      throw new PlatformNativeError(`ACL readback extra trustee:${trustee}`);
    }
  }
}

/** 按顺序校验 ACE 头与 SID 长度；未知布局不得先按 allow 布局读内存。 */
export function decodeWin32AllowedAce(read: (offset: number, type: "uint8" | "uint16" | "uint32") => number): {
  aceType: number;
  aceFlags: number;
  mask: number;
  sidBuf: Buffer;
} {
  const aceType = read(0, "uint8");
  if (aceType !== ACCESS_ALLOWED_ACE_TYPE) {
    throw new PlatformNativeError(`ACL readback ACE type not allow:${String(aceType)}`);
  }
  const aceSize = read(2, "uint16");
  if (!Number.isInteger(aceSize) || aceSize < ACE_SID_OFFSET + 8) {
    throw new PlatformNativeError("ACL ACE size invalid");
  }
  const subCount = read(ACE_SID_OFFSET + 1, "uint8");
  if (!Number.isInteger(subCount) || subCount < 0 || subCount > 15) {
    throw new PlatformNativeError("ACL ACE SID subauthority invalid");
  }
  const sidLen = 8 + subCount * 4;
  if (aceSize < ACE_SID_OFFSET + sidLen) {
    throw new PlatformNativeError("ACL ACE SID truncated");
  }
  const sidBuf = Buffer.alloc(sidLen);
  for (let i = 0; i < sidLen; i += 1) sidBuf[i] = read(ACE_SID_OFFSET + i, "uint8");
  return { aceType, aceFlags: read(1, "uint8"), mask: read(4, "uint32"), sidBuf };
}

function aceTrusteeSidFromAllowedAce(n: Native, sidBuf: Buffer, currentSid: string): string {
  const currentPtr: unknown[] = [null];
  if (n.ConvertStringSidToSidW(currentSid, currentPtr) && currentPtr[0] != null) {
    try {
      if (n.EqualSid(currentPtr[0], sidBuf)) return currentSid;
    } finally {
      n.LocalFree(currentPtr[0]);
    }
  }
  return sidToString(n, sidBuf);
}

function readOwnerOnlyAclViewNative(n: Native, target: string | { handle: unknown }, currentSid: string): Win32AclReadbackView {
  const verifyOwner: unknown[] = [null];
  const verifyGroup: unknown[] = [null];
  const verifyDacl: unknown[] = [null];
  const verifySacl: unknown[] = [null];
  const verifySd: unknown[] = [null];
  const args = [
    SE_FILE_OBJECT,
    DACL_SECURITY_INFORMATION | OWNER_SECURITY_INFORMATION,
    verifyOwner,
    verifyGroup,
    verifyDacl,
    verifySacl,
    verifySd
  ] as const;
  const readRc = typeof target === "string" ? n.GetNamedSecurityInfoW(target, ...args) : n.GetSecurityInfo(target.handle, ...args);
  if (readRc !== 0 || verifySd[0] == null) {
    throw new PlatformNativeError(`ACL readback failed:${String(readRc)}`);
  }
  try {
    if (verifyOwner[0] == null) {
      throw new PlatformNativeError("ACL readback owner SID mismatch");
    }
    const ownerSid = sidToString(n, verifyOwner[0]);
    const control = [0];
    const revision = [0];
    if (!n.GetSecurityDescriptorControl(verifySd[0], control, revision)) {
      throw new PlatformNativeError("GetSecurityDescriptorControl failed");
    }
    if (verifyDacl[0] == null) {
      throw new PlatformNativeError("ACL readback DACL missing");
    }
    const info = Buffer.alloc(12);
    if (!n.GetAclInformation(verifyDacl[0], info, info.length, ACL_SIZE_INFORMATION)) {
      throw new PlatformNativeError(`GetAclInformation failed:${String(n.GetLastError())}`);
    }
    const aceCount = info.readUInt32LE(0);
    const aces: Win32AclAceView[] = [];
    for (let i = 0; i < aceCount; i += 1) {
      const ace: unknown[] = [null];
      if (!n.GetAce(verifyDacl[0], i, ace) || ace[0] == null) {
        throw new PlatformNativeError(`GetAce failed:${String(i)}`);
      }
      const decoded = decodeWin32AllowedAce((offset, type) => n.koffi.decode(ace[0], offset, type) as number);
      aces.push({
        aceType: decoded.aceType,
        aceFlags: decoded.aceFlags,
        mask: decoded.mask,
        trusteeSid: aceTrusteeSidFromAllowedAce(n, decoded.sidBuf, currentSid)
      });
    }
    return { ownerSid, control: control[0] ?? 0, aces };
  } finally {
    n.LocalFree(verifySd[0]);
  }
}

let aclReadbackViewForTests: ((absPath: string, currentSid: string, kind: "file" | "dir") => Win32AclReadbackView) | null =
  null;

export function setWin32AclReadbackForTests(
  next: ((absPath: string, currentSid: string, kind: "file" | "dir") => Win32AclReadbackView) | null
): void {
  aclReadbackViewForTests = next;
}

/** 生产回读入口：native GetAce 或测试注入的同一条 view，再交给 verifyRestrictOwnerOnlyReadback。 */
export function applyWin32OwnerOnlyAclReadback(absPath: string, currentSid: string, kind: "file" | "dir"): void {
  const view = aclReadbackViewForTests
    ? aclReadbackViewForTests(absPath, currentSid, kind)
    : readOwnerOnlyAclViewNative(nativeSync(), absPath, currentSid);
  verifyRestrictOwnerOnlyReadback(currentSid, kind, view);
}

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
  // 回读校验每个 ACE 的 trustee 与有效权限。Owner 字段正确不等于 DACL 仅授当前 SID。
  // 不用 SDDL 文本 includes(sid)：ConvertSidToStringSidW 输出恒为 S-1-...，
  // 5297a29454 的误报来自把 SDDL 两字母别名当成「DACL 没有 owner ACE」。
  applyWin32OwnerOnlyAclReadback(absPath, sid, kind);
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

function closeHandleChecked(n: Pick<Native, "CloseHandle" | "GetLastError">, handle: unknown, label: string): void {
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
    // koffi.address 在 Windows 返回无符号指针；-1 还必须按64位补码比较。
    // 否则失败的 CreateFile 会被误当成当前进程伪句柄继续查询。
    return BigInt.asIntN(64, handleAddress(n, handle)) === INVALID_HANDLE_VALUE;
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
  disposeStdio: () => "disposed" | "pending";
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

/** 父端 named pipe：overlapped，可 CancelIoEx。 */
export function win32StdioServerOpenMode(parentWrites: boolean): number {
  return (
    (parentWrites ? PIPE_ACCESS_OUTBOUND : PIPE_ACCESS_INBOUND) |
    FILE_FLAG_FIRST_PIPE_INSTANCE |
    WIN32_FILE_FLAG_OVERLAPPED
  );
}

/** 子端同步兼容：不带 FILE_FLAG_OVERLAPPED。 */
export function win32StdioClientOpenFlags(): number {
  return FILE_ATTRIBUTE_NORMAL;
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
    win32StdioServerOpenMode(parentWrites),
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
    win32StdioClientOpenFlags(),
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

function pipeErrno(code: "EOF" | "EPIPE" | "EIO", message: string): NodeJS.ErrnoException {
  const err = new PlatformNativeError(message) as PlatformNativeError & NodeJS.ErrnoException;
  err.code = code;
  return err;
}

function win32IoFailure(code: "EPIPE" | "EIO", message: string, win32: number): NodeJS.ErrnoException {
  return pipeErrno(code, `${message}:win32=${String(win32)}`);
}

function projectIoFailure(err: unknown, fallback: "EIO" | "EPIPE", message: string): Error {
  if (isPlatformNativeError(err)) return err;
  return pipeErrno(fallback, message);
}

function isReadEofWin32(err: number): boolean {
  return err === WIN32_ERROR_BROKEN_PIPE || err === WIN32_ERROR_HANDLE_EOF;
}

function isWritePipeGoneWin32(err: number): boolean {
  return err === WIN32_ERROR_BROKEN_PIPE || err === WIN32_ERROR_PIPE_NOT_CONNECTED;
}

/**
 * overlapped ReadFile/WriteFile 在调用线程立即返回；GetLastError 必须同线程紧跟。
 * 不走 koffi func.async（worker 上的 LastError 不能回主线程）。
 * 完成前 OVERLAPPED/buffer/event/handle 保持强引用。
 */
function settleWin32Overlapped(
  ok: number,
  win32: number,
  bytes: number,
  maxBytes: number,
  kind: "read" | "write" | "connect"
): Win32PipeIoResult | { kind: "fail"; error: Error } {
  if (!Number.isInteger(bytes) || bytes < 0) {
    return { kind: "fail", error: pipeErrno("EIO", kind === "read" ? "named pipe read size invalid" : "named pipe write size invalid") };
  }
  if (ok) {
    if (bytes > maxBytes) {
      return {
        kind: "fail",
        error: pipeErrno("EIO", kind === "read" ? "named pipe read overflow" : "named pipe write overflow")
      };
    }
    if (kind === "read") {
      if (bytes <= 0) {
        return { kind: "fail", error: pipeErrno("EIO", "named pipe read empty success") };
      }
      return { kind: "data", bytes };
    }
    if (bytes !== maxBytes) {
      return { kind: "fail", error: pipeErrno("EIO", "named pipe write short") };
    }
    return { kind: "data", bytes };
  }
  if (kind === "read" && isReadEofWin32(win32)) {
    return { kind: "eof" };
  }
  if (kind === "write" && isWritePipeGoneWin32(win32)) {
    return { kind: "fail", error: win32IoFailure("EPIPE", "named pipe write failed", win32) };
  }
  if (win32 === WIN32_ERROR_IO_PENDING || win32 === WIN32_ERROR_IO_INCOMPLETE) {
    return {
      kind: "fail",
      error: win32IoFailure("EIO", kind === "read" ? "named pipe read pending" : "named pipe write pending", win32)
    };
  }
  return {
    kind: "fail",
    error: win32IoFailure("EIO", kind === "read" ? "named pipe read failed" : "named pipe write failed", win32)
  };
}

function makeOverlapped(n: Win32PipeIoNative, event: unknown): unknown {
  const withLayout = n as Win32PipeIoNative & Partial<Pick<Native, "koffi" | "OVERLAPPED">>;
  if (withLayout.koffi && withLayout.OVERLAPPED) {
    const size = withLayout.koffi.sizeof(withLayout.OVERLAPPED);
    const offset = withLayout.koffi.offsetof(withLayout.OVERLAPPED, "hEvent");
    if (size !== 32 || offset !== 24) throw pipeErrno("EIO", "unsupported OVERLAPPED layout");
    const address = BigInt(withLayout.koffi.address(event));
    if (address <= 0n) throw pipeErrno("EIO", "invalid OVERLAPPED event");
    const buf = Buffer.alloc(size);
    buf.writeBigUInt64LE(address, offset);
    return buf;
  }
  return { Internal: 0, InternalHigh: 0, Offset: 0, OffsetHigh: 0, hEvent: event };
}

function pipeApisUnavailable(n: Win32PipeIoNative, kind: "read" | "write" | "connect"): Error | undefined {
  if (kind === "connect" && typeof n.ConnectNamedPipe !== "function") return pipeErrno("EIO", "named pipe connect unavailable");
  if (typeof n.ReadFile !== "function" || typeof n.WriteFile !== "function") {
    return pipeErrno("EIO", kind === "read" ? "named pipe read unavailable" : "named pipe write unavailable");
  }
  if (
    typeof n.CreateEventW !== "function" ||
    typeof n.GetOverlappedResult !== "function" ||
    typeof n.WaitForSingleObject !== "function" ||
    typeof n.SetLastError !== "function" ||
    typeof n.GetLastError !== "function"
  ) {
    return pipeErrno("EIO", kind === "read" ? "named pipe read overlapped unavailable" : "named pipe write overlapped unavailable");
  }
  return undefined;
}

const heldPipeSessions = new Set<object>();

function startWin32HandleIo(
  n: Win32PipeIoNative,
  handle: unknown,
  buf: Buffer,
  kind: "read" | "write" | "connect"
): Win32PipeIoSession {
  let reportFailure!: (error: Error) => void;
  const failure = new Promise<Error>((resolve) => { reportFailure = resolve; });
  const unavailable = pipeApisUnavailable(n, kind);
  const rejected = (error: Error): Win32PipeIoSession => ({
    buffer: buf, overlapped: null, event: null, failure,
    promise: Promise.reject(error), requestCancel: () => error
  });
  if (unavailable) return rejected(unavailable);
  let event: unknown;
  try {
    event = n.CreateEventW(null, 1, 0, null);
  } catch {
    return rejected(pipeErrno("EIO", "CreateEventW failed"));
  }
  if (isNullHandle(event)) return rejected(win32IoFailure("EIO", "CreateEventW failed", n.GetLastError()));
  let overlapped: unknown;
  let layoutError: Error | undefined;
  try { overlapped = makeOverlapped(n, event); }
  catch { layoutError = pipeErrno("EIO", "OVERLAPPED layout failed"); }
  let settled = false;
  let completed = false;
  let cancelRequested = false;
  let lastCancelErr: Error | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const token = { buffer: buf, overlapped, event, handle };
  heldPipeSessions.add(token);
  const later = (work: () => void): void => {
    timer = setTimeout(work, 5);
    // 故障保留所有权,但不能让永不完成的内核请求阻挡宿主退出。
    if (cancelRequested) timer.unref();
  };
  const requestCancel = (): Error | undefined => {
    if (settled || completed) return undefined;
    if (cancelRequested) return lastCancelErr;
    cancelRequested = true;
    timer?.unref();
    try {
      if (!n.CancelIoEx(handle, overlapped)) {
        const error = n.GetLastError();
        if (error !== ERROR_NOT_FOUND) lastCancelErr = win32IoFailure("EIO", "CancelIoEx failed", error);
      }
    } catch { lastCancelErr = pipeErrno("EIO", "CancelIoEx failed"); }
    return lastCancelErr;
  };
  const fault = (error: Error): void => {
    reportFailure(error);
    requestCancel();
  };
  const promise = new Promise<Win32PipeIoResult>((resolve, reject) => {
    const finish = (result: Win32PipeIoResult | { kind: "fail"; error: Error }): void => {
      if (settled) return;
      completed = true;
      try { closeHandleChecked(n, event, "stdio-overlapped-event"); }
      catch (error) {
        reportFailure(projectIoFailure(error, "EIO", "event close failed"));
        // I/O 已终结,但事件关闭仍由本 session 持有;成功前不兑现释放 promise。
        later(() => finish(result));
        timer?.unref();
        return;
      }
      settled = true;
      heldPipeSessions.delete(token);
      if (result.kind === "fail") reject(result.error);
      else resolve(result);
    };
    const afterComplete = (): void => {
      const transferred = [0];
      let ok: number;
      let error: number;
      try {
        ok = n.GetOverlappedResult(handle, overlapped, transferred, 0);
        error = ok ? 0 : n.GetLastError();
      } catch {
        fault(pipeErrno("EIO", "named pipe result query failed"));
        later(afterComplete);
        return;
      }
      if (!ok && (error === WIN32_ERROR_IO_INCOMPLETE || error === WIN32_ERROR_IO_PENDING)) {
        later(poll);
        return;
      }
      // 无效句柄/参数只说明查询失效,不能证明内核已放弃缓冲区。
      if (!ok && (error === 6 || error === 87)) {
        fault(win32IoFailure("EIO", "named pipe completion unproved", error));
        later(afterComplete);
        return;
      }
      finish(settleWin32Overlapped(ok, error, transferred[0] ?? 0, buf.length, kind));
    };
    const poll = (): void => {
      if (settled) return;
      let wait: number;
      try { wait = n.WaitForSingleObject(event, 0); }
      catch {
        fault(pipeErrno("EIO", "named pipe wait failed"));
        afterComplete();
        return;
      }
      if (wait === WAIT_TIMEOUT) { later(poll); return; }
      if (wait !== WAIT_OBJECT_0) fault(pipeErrno("EIO", `named pipe wait failed:wait=${String(wait)}`));
      // WAIT_FAILED 不释放;仍须查询同一 OVERLAPPED 的真实终态。
      afterComplete();
    };
    if (layoutError) { finish({ kind: "fail", error: layoutError }); return; }
    const written = [0];
    let started: number;
    let error: number;
    try {
      started = kind === "connect" ? n.ConnectNamedPipe!(handle, overlapped)
        : kind === "read" ? n.ReadFile(handle, buf, buf.length, written, overlapped)
        : n.WriteFile(handle, buf, buf.length, written, overlapped);
      error = started ? 0 : n.GetLastError();
    } catch {
      fault(pipeErrno("EIO", "named pipe invocation failed; completion unknown"));
      later(afterComplete);
      return;
    }
    // 客户端先于 ConnectNamedPipe 打开时，内核已连接且没有待完成 I/O。
    if (kind === "connect" && !started && error === 535) { finish({ kind: "data", bytes: 0 }); return; }
    if (started) { afterComplete(); return; }
    if (error === WIN32_ERROR_IO_PENDING) { later(poll); return; }
    finish(settleWin32Overlapped(0, error, 0, buf.length, kind));
  });
  return { buffer: buf, overlapped, event, promise, failure, requestCancel };
}

export function startWin32HandleRead(n: Win32PipeIoNative, handle: unknown, buf: Buffer): Win32PipeIoSession {
  return startWin32HandleIo(n, handle, buf, "read");
}

export function startWin32HandleConnect(n: Win32PipeIoNative, handle: unknown): Win32PipeIoSession {
  return startWin32HandleIo(n, handle, Buffer.alloc(0), "connect");
}

// 个人接入专用管道。此层只证明 OS 用户/进程/端点，不授予安装或业务身份。
const PERSONAL_PIPE_MASK = 0x0012019b; // 明确去掉 FILE_CREATE_PIPE_INSTANCE。
const personalPipeName = /^\\\\\.\\pipe\\saydo-personal-context-[0-9a-f-]{36}$/u;
const retainedPersonalPipes = new Set<Win32PersonalPipe>();
export interface Win32PersonalPipeIdentity { pid: number; birth: string }
export interface Win32PersonalPipeObservation {
  name: string;
  owner: string;
  local: Win32PersonalPipeIdentity;
  peer: Win32PersonalPipeIdentity;
}

function verifyPersonalPipeAcl(n: Native, handle: unknown, sid: string): void {
  const view = readOwnerOnlyAclViewNative(n, { handle }, sid);
  if (!sidTokensEqual(view.ownerSid, sid) || (view.control & (SE_DACL_PRESENT | SE_DACL_PROTECTED)) !== (SE_DACL_PRESENT | SE_DACL_PROTECTED) ||
      view.aces.length !== 1 || view.aces.some(ace => ace.aceType !== ACCESS_ALLOWED_ACE_TYPE || ace.aceFlags !== 0 || ace.mask !== PERSONAL_PIPE_MASK || !sidTokensEqual(ace.trusteeSid, sid))) {
    throw new PlatformNativeError("personal pipe ACL rejected");
  }
}

async function boundedPipeWait<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PlatformNativeError("personal pipe timeout; cleanup may be retained")), timeoutMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}

export class Win32PersonalPipe {
  private readonly n = nativeSync();
  private readonly sid = currentUserSid();
  private readonly pending = new Set<Win32PipeIoSession>();
  private peerHandle: unknown;
  private observation: Win32PersonalPipeObservation | undefined;
  private stopping = false;
  private released = false;
  private connecting = false;
  private reading = false;
  private writing = false;
  private closePromise: Promise<void> | undefined;
  constructor(readonly name: string, private readonly handle: unknown, private readonly server: boolean) {
    retainedPersonalPipes.add(this);
  }
  async accept(): Promise<void> {
    if (!this.server || this.connecting || this.stopping) throw new PlatformNativeError("personal pipe accept rejected");
    this.connecting = true;
    try { await this.run(startWin32HandleConnect(this.n, this.handle), 5000); this.capturePeer(); }
    catch (error) { await this.close(); throw error; }
  }
  capturePeer(): void {
    if (this.stopping || this.observation) throw new PlatformNativeError("personal pipe identity rejected");
    verifyPersonalPipeAcl(this.n, this.handle, this.sid);
    const pid = this.peerPid();
    const processHandle = this.n.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
    if (isNullHandle(processHandle)) throw new PlatformNativeError("personal pipe peer process unavailable");
    this.peerHandle = processHandle;
    if (processUserSid(this.n, processHandle) !== this.sid || this.peerPid() !== pid || processStillActiveFromHandleWin32(processHandle) !== true) throw new PlatformNativeError("personal pipe peer owner rejected");
    const birth = processBirthFromHandleWin32(processHandle, pid), localBirth = processBirthFromHandleWin32(this.n.GetCurrentProcess(), process.pid);
    if (!birth || !localBirth) throw new PlatformNativeError("personal pipe process birth unavailable");
    this.observation = { name: this.name, owner: this.sid, local: { pid: process.pid, birth: localBirth }, peer: { pid, birth } };
  }
  assertCurrent(): Win32PersonalPipeObservation {
    if (this.stopping || !this.observation || !this.peerHandle) throw new PlatformNativeError("personal pipe closed or unverified");
    verifyPersonalPipeAcl(this.n, this.handle, this.sid);
    if (this.peerPid() !== this.observation.peer.pid || processStillActiveFromHandleWin32(this.peerHandle) !== true ||
        processBirthFromHandleWin32(this.peerHandle, this.observation.peer.pid) !== this.observation.peer.birth || processUserSid(this.n, this.peerHandle) !== this.sid) throw new PlatformNativeError("personal pipe peer changed");
    return structuredClone(this.observation);
  }
  async readExact(size: number): Promise<Buffer> {
    this.assertCurrent();
    if (this.reading || !Number.isSafeInteger(size) || size <= 0 || size > 65536) throw new PlatformNativeError("personal pipe read bound");
    this.reading = true; const result = Buffer.alloc(size); let offset = 0;
    const deadline = performance.now() + 5000;
    try {
      while (offset < size) {
        this.assertCurrent(); const remaining = deadline - performance.now();
        if (remaining <= 0) throw new PlatformNativeError("personal pipe read timeout");
        const read = await this.run(startWin32HandleRead(this.n, this.handle, result.subarray(offset)), remaining);
        if (read.kind !== "data" || read.bytes <= 0) throw new PlatformNativeError("personal pipe EOF");
        offset += read.bytes;
      }
      this.assertCurrent(); return result;
    } catch (error) { result.fill(0); await this.close(); throw error; }
    finally { this.reading = false; }
  }
  async write(data: Buffer, finalWriter: (commit: () => void) => void): Promise<void> {
    this.assertCurrent();
    if (this.writing || data.length === 0 || data.length > 65536) throw new PlatformNativeError("personal pipe write bound");
    this.writing = true; let active = true, called = false; let completion: Promise<Win32PipeIoResult> | undefined;
    try {
      finalWriter(() => {
        if (!active || called) throw new PlatformNativeError("personal pipe final writer stale");
        this.assertCurrent(); called = true;
        completion = this.run(startWin32HandleWrite(this.n, this.handle, Buffer.from(data)), 5000);
        // finalWriter 可能在写入启动后抛错；挂接处理，退出仍等待内核清理。
        void completion.catch(() => undefined);
      });
      active = false;
      if (!completion || !called) throw new PlatformNativeError("personal pipe final writer not called");
      await completion;
    } catch (error) { active = false; await this.close(); throw error; }
    finally { active = false; this.writing = false; }
  }
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.stopping = true;
    this.closePromise = (async () => {
      const cancellationErrors = [...this.pending].map(session => session.requestCancel()).filter(value => value !== undefined);
      await boundedPipeWait(Promise.allSettled([...this.pending].map(session => session.promise)), 5000);
      if (this.pending.size) throw new PlatformNativeError("personal pipe I/O retained");
      if (!this.released) { closeHandleChecked(this.n, this.handle, "personal-pipe"); this.released = true; }
      if (this.peerHandle) { closeHandleChecked(this.n, this.peerHandle, "personal-peer-process"); this.peerHandle = undefined; }
      retainedPersonalPipes.delete(this);
      if (cancellationErrors.length) throw new PlatformNativeError("personal pipe cancellation failed");
    })();
    return this.closePromise;
  }
  private peerPid(): number {
    const pid = [0];
    if (!(this.server ? this.n.GetNamedPipeClientProcessId(this.handle, pid) : this.n.GetNamedPipeServerProcessId(this.handle, pid)) || !pid[0]) throw new PlatformNativeError("personal pipe peer ID unavailable");
    return pid[0];
  }
  private async run(session: Win32PipeIoSession, timeoutMs: number): Promise<Win32PipeIoResult> {
    this.pending.add(session);
    void session.promise.then(() => this.pending.delete(session), () => this.pending.delete(session));
    try { return await boundedPipeWait(Promise.race([session.promise, session.failure.then(error => { throw error; })]), timeoutMs); }
    catch (error) { session.requestCancel(); throw error; }
  }
}

export function createWin32PersonalPipe(): Win32PersonalPipe {
  if (hostKind() !== "win32") throw new PlatformNativeError("personal pipe Windows only");
  const n = nativeSync(), sid = currentUserSid(), name = `\\\\.\\pipe\\saydo-personal-context-${randomUUID()}`;
  const sd: unknown[] = [null], length = [0];
  if (!n.ConvertStringSecurityDescriptorToSecurityDescriptorW(`O:${sid}D:P(A;;0x0012019b;;;${sid})`, SDDL_REVISION_1, sd, length) || !sd[0]) throw new PlatformNativeError("personal pipe security descriptor failed");
  let handle: unknown;
  try {
    handle = n.CreateNamedPipeW(name, 3 | FILE_FLAG_FIRST_PIPE_INSTANCE | WIN32_FILE_FLAG_OVERLAPPED, 8, 1, 65536, 65536, 0,
      { nLength: n.koffi.sizeof(n.SECURITY_ATTRIBUTES), lpSecurityDescriptor: sd[0], bInheritHandle: 0 });
  } finally { n.LocalFree(sd[0]); }
  if (isNullHandle(handle) || isInvalidHandle(n, handle)) throw new PlatformNativeError(`personal pipe create failed:${String(n.GetLastError())}`);
  try { verifyPersonalPipeAcl(n, handle, sid); return new Win32PersonalPipe(name, handle, true); }
  catch (error) { closeHandleChecked(n, handle, "personal-pipe-rejected"); throw error; }
}

export async function openWin32PersonalPipe(name: string): Promise<Win32PersonalPipe> {
  if (hostKind() !== "win32" || !personalPipeName.test(name)) throw new PlatformNativeError("personal pipe name rejected");
  const n = nativeSync();
  // 不申请 GENERIC_WRITE，防止它隐含的 FILE_CREATE_PIPE_INSTANCE 权限。
  const handle = n.CreateFileW(name, PERSONAL_PIPE_MASK, 0, securityAttributes(n, 0), OPEN_EXISTING, WIN32_FILE_FLAG_OVERLAPPED | 0x00100000, null);
  if (isNullHandle(handle) || isInvalidHandle(n, handle)) throw new PlatformNativeError(`personal pipe open failed:${String(n.GetLastError())}`);
  const pipe = new Win32PersonalPipe(name, handle, false);
  try { pipe.capturePeer(); return pipe; } catch (error) { await pipe.close(); throw error; }
}

export function startWin32HandleWrite(n: Win32PipeIoNative, handle: unknown, data: Buffer): Win32PipeIoSession {
  return startWin32HandleIo(n, handle, data, "write");
}

export function readWin32HandleAsync(n: Win32PipeIoNative, handle: unknown, buf: Buffer): Promise<number> {
  const session = startWin32HandleRead(n, handle, buf);
  return Promise.race([session.promise, session.failure.then((error) => { throw error; })]).then((result) => (result.kind === "eof" ? 0 : result.bytes));
}

export function writeWin32HandleAsync(n: Win32PipeIoNative, handle: unknown, data: Buffer): Promise<void> {
  const session = startWin32HandleWrite(n, handle, data);
  return Promise.race([session.promise, session.failure.then((error) => { throw error; })]).then(() => undefined);
}

export function createWin32PipeHandleOwner(
  n: Pick<Win32PipeIoNative, "CloseHandle" | "GetLastError">,
  handle: unknown,
  label: string
): Win32PipeHandleOwner {
  let released = false;
  let lastCloseError: Error | undefined;
  let lastFailure: Error | undefined;
  const inflight = new Set<object>();
  return {
    handle,
    label,
    released: () => released,
    lastCloseError: () => lastCloseError,
    lastFailure: () => lastFailure,
    noteFailure(err) {
      lastFailure = err;
    },
    inFlight: () => inflight.size > 0,
    retainInFlight(token) {
      inflight.add(token);
    },
    releaseInFlight(token) {
      inflight.delete(token);
    },
    close() {
      if (released) return;
      if (inflight.size > 0) {
        throw new PlatformNativeError(`CloseHandle deferred:${label}:io pending`);
      }
      try {
        closeHandleChecked(n, handle, label);
        released = true;
        lastCloseError = undefined;
      } catch (err) {
        lastCloseError = isPlatformNativeError(err)
          ? err
          : new PlatformNativeError(`CloseHandle failed:${label}`);
        throw lastCloseError;
      }
    }
  };
}

function tryClosePipeOwner(owner: Win32PipeHandleOwner): Error | undefined {
  if (owner.released()) return undefined;
  try {
    owner.close();
    return undefined;
  } catch (err) {
    return isPlatformNativeError(err) ? err : new PlatformNativeError(`CloseHandle failed:${owner.label}`);
  }
}

function combineIoAndClose(ioErr: Error | undefined, closeErr: Error | undefined): Error | undefined {
  if (ioErr && closeErr) {
    return pipeErrno("EIO", `${ioErr.message}; close:${closeErr.message}`);
  }
  return ioErr ?? closeErr;
}

export function getWin32PipeOwner(stream: object): Win32PipeHandleOwner | undefined {
  if (typeof stream !== "object" || stream === null) return undefined;
  const owner = (stream as { win32PipeOwner?: unknown }).win32PipeOwner;
  if (!owner || typeof owner !== "object") return undefined;
  const candidate = owner as Win32PipeHandleOwner;
  if (typeof candidate.released !== "function" || typeof candidate.close !== "function") return undefined;
  return candidate;
}

export function disposeOwnedWin32ParentStdio(input: {
  streams: Array<Readable | Writable | null | undefined>;
  owners: Win32PipeHandleOwner[];
}): "disposed" | "pending" {
  let pending = false;
  let closeErr: Error | undefined;
  for (const stream of input.streams) {
    if (!stream) continue;
    try {
      stream.destroy();
    } catch {
      // 已关
    }
  }
  for (const owner of input.owners) {
    if (owner.released()) continue;
    if (owner.inFlight()) {
      pending = true;
      continue;
    }
    try {
      owner.close();
    } catch (err) {
      closeErr ??= isPlatformNativeError(err) ? err : new PlatformNativeError("stdio close failed");
    }
  }
  if (closeErr) throw closeErr;
  return pending ? "pending" : "disposed";
}

function attachPipeOwner(stream: Readable | Writable, owner: Win32PipeHandleOwner): void {
  Object.defineProperty(stream, "win32PipeOwner", {
    value: owner,
    enumerable: true,
    configurable: false,
    writable: false
  });
}

export function createWin32HandleReadable(
  n: Win32PipeIoNative,
  handle: unknown,
  label: string,
  options?: Win32HandleStreamOptions
): Readable {
  const owner = options?.owner ?? createWin32PipeHandleOwner(n, handle, label);
  const cancelWaitMs = options?.cancelWaitMs ?? STDIO_CANCEL_WAIT_MS;
  let session: Win32PipeIoSession | null = null;
  let destroyCb: ((err: Error | null) => void) | null = null;
  let destroyErr: Error | undefined;
  let cancelTimer: ReturnType<typeof setTimeout> | null = null;

  const clearCancelTimer = (): void => {
    if (cancelTimer) {
      clearTimeout(cancelTimer);
      cancelTimer = null;
    }
  };

  const finishDestroy = (extra?: Error): void => {
    clearCancelTimer();
    const closeErr = tryClosePipeOwner(owner);
    const combined = combineIoAndClose(combineIoAndClose(destroyErr, extra), closeErr);
    const cb = destroyCb;
    destroyCb = null;
    if (cb) {
      cb(combined ?? null);
      return;
    }
    if (combined && !stream.destroyed) stream.destroy(combined);
  };

  const deliverReadChunk = (chunk: Buffer): void => {
    if (stream.destroyed) {
      stream.emit("data", chunk);
      return;
    }
    stream.push(chunk);
  };

  const stream = new Readable({
    highWaterMark: STDIO_PIPE_BUFFER,
    autoDestroy: true,
    read() {
      if (session || owner.released()) return;
      const buf = Buffer.alloc(STDIO_PIPE_BUFFER);
      const started = startWin32HandleRead(n, handle, buf);
      session = started;
      owner.retainInFlight(started);
      void started.failure.then((error) => {
        owner.noteFailure(error);
        if (!stream.destroyed) stream.destroy(error);
        else stream.emit("error", error);
      });
      void started.promise.then(
        (result) => {
          owner.releaseInFlight(started);
          session = null;
          if (destroyCb) {
            if (result.kind === "data") {
              deliverReadChunk(Buffer.from(started.buffer.subarray(0, result.bytes)));
            }
            finishDestroy();
            return;
          }
          if (stream.destroyed) {
            tryClosePipeOwner(owner);
            return;
          }
          if (owner.released()) return;
          if (result.kind === "eof") {
            stream.push(null);
            return;
          }
          stream.push(Buffer.from(started.buffer.subarray(0, result.bytes)));
        },
        (err: unknown) => {
          owner.releaseInFlight(started);
          session = null;
          const ioErr = projectIoFailure(err, "EIO", "named pipe read failed");
          if (destroyCb) {
            finishDestroy(ioErr);
            return;
          }
          if (stream.destroyed) {
            tryClosePipeOwner(owner);
            return;
          }
          stream.destroy(ioErr);
        }
      );
    },
    destroy(err, cb) {
      destroyErr = err ?? undefined;
      destroyCb = cb;
      if (session) {
        const cancelErr = session.requestCancel();
        cancelTimer = setTimeout(() => {
          cancelTimer = null;
          const timeoutErr = pipeErrno("EIO", `named pipe read cancel wait timeout:${label}`);
          const combined = combineIoAndClose(combineIoAndClose(destroyErr, cancelErr), timeoutErr) ?? timeoutErr;
          owner.noteFailure(combined);
          try {
            stream.emit("error", combined);
          } catch {
            // 无监听者：失败留在 owner.lastFailure，不得假闭
          }
        }, cancelWaitMs);
        return;
      }
      finishDestroy();
    }
  });
  attachPipeOwner(stream, owner);
  return stream;
}

export function createWin32HandleWritable(
  n: Win32PipeIoNative,
  handle: unknown,
  label: string,
  options?: Win32HandleStreamOptions
): Writable {
  const owner = options?.owner ?? createWin32PipeHandleOwner(n, handle, label);
  const cancelWaitMs = options?.cancelWaitMs ?? STDIO_CANCEL_WAIT_MS;
  let session: Win32PipeIoSession | null = null;
  let finishCb: ((err?: Error | null) => void) | null = null;
  let destroyCb: ((err: Error | null) => void) | null = null;
  let destroyErr: Error | undefined;
  let cancelTimer: ReturnType<typeof setTimeout> | null = null;

  const clearCancelTimer = (): void => {
    if (cancelTimer) {
      clearTimeout(cancelTimer);
      cancelTimer = null;
    }
  };

  const finishDestroy = (extra?: Error): void => {
    clearCancelTimer();
    const closeErr = tryClosePipeOwner(owner);
    const combined = combineIoAndClose(combineIoAndClose(destroyErr, extra), closeErr);
    const dcb = destroyCb;
    destroyCb = null;
    if (dcb) dcb(combined ?? null);
    if (finishCb) {
      const cb = finishCb;
      finishCb = null;
      cb(combined ?? null);
    }
  };

  const stream = new Writable({
    highWaterMark: STDIO_PIPE_BUFFER,
    autoDestroy: true,
    write(chunk, encoding, cb) {
      if (owner.released()) {
        cb(pipeErrno("EPIPE", "named pipe write after close"));
        return;
      }
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string, encoding);
      const started = startWin32HandleWrite(n, handle, data);
      session = started;
      owner.retainInFlight(started);
      void started.failure.then((error) => {
        owner.noteFailure(error);
        if (!stream.destroyed) stream.destroy(error);
        else stream.emit("error", error);
      });
      void started.promise.then(
        () => {
          owner.releaseInFlight(started);
          session = null;
          cb();
          if (destroyCb || finishCb) {
            finishDestroy();
            return;
          }
          if (stream.destroyed) tryClosePipeOwner(owner);
        },
        (err: unknown) => {
          owner.releaseInFlight(started);
          session = null;
          const ioErr = projectIoFailure(err, "EIO", "named pipe write failed");
          if (destroyCb || finishCb) {
            cb(ioErr);
            finishDestroy(ioErr);
            return;
          }
          const closeErr = tryClosePipeOwner(owner);
          if (stream.destroyed) {
            tryClosePipeOwner(owner);
            return;
          }
          cb(combineIoAndClose(ioErr, closeErr) ?? ioErr);
        }
      );
    },
    final(cb) {
      if (session) {
        finishCb = cb;
        return;
      }
      cb(tryClosePipeOwner(owner) ?? null);
    },
    destroy(err, cb) {
      destroyErr = err ?? undefined;
      destroyCb = cb;
      if (session) {
        const cancelErr = session.requestCancel();
        cancelTimer = setTimeout(() => {
          cancelTimer = null;
          const timeoutErr = pipeErrno("EIO", `named pipe write cancel wait timeout:${label}`);
          const combined = combineIoAndClose(combineIoAndClose(destroyErr, cancelErr), timeoutErr) ?? timeoutErr;
          owner.noteFailure(combined);
          try {
            stream.emit("error", combined);
          } catch {
            // 无监听者：失败留在 owner.lastFailure，不得假闭
          }
        }, cancelWaitMs);
        return;
      }
      finishDestroy();
    }
  });
  attachPipeOwner(stream, owner);
  return stream;
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
    const stdinOwner = createWin32PipeHandleOwner(n, stdin.server, "stdin-server");
    const stdoutOwner = createWin32PipeHandleOwner(n, stdout.server, "stdout-server");
    const stderrOwner = createWin32PipeHandleOwner(n, stderr.server, "stderr-server");
    const stdinStream = createWin32HandleWritable(n, stdin.server, "stdin-server", { owner: stdinOwner });
    transferHandleToStream(resources, stdin.server);
    const stdoutStream = createWin32HandleReadable(n, stdout.server, "stdout-server", { owner: stdoutOwner });
    transferHandleToStream(resources, stdout.server);
    const stderrStream = createWin32HandleReadable(n, stderr.server, "stderr-server", { owner: stderrOwner });
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
    const disposeParentStdio = (): "disposed" | "pending" => {
      if (stdioDisposed) return "disposed";
      const state = disposeOwnedWin32ParentStdio({
        streams: [stdinStream, stdoutStream, stderrStream, extraStream],
        owners: [stdinOwner, stdoutOwner, stderrOwner]
      });
      if (state === "disposed") stdioDisposed = true;
      return state;
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
        if (disposeParentStdio() !== "disposed") {
          throw new PlatformNativeError("process handle retained:stdio pending");
        }
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
