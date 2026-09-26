"""Windows 状态根身份的 ctypes 生产边界(工程 ADR-003 对等语义)。

只在 os.name==nt 时加载 kernel32/advapi32。ctypes 是 CPython 标准库,源码
`uv run python -m saydo_pipeline` 与现役部署(launchd/dev.mjs 同入口)都走同一
解释器,不依赖 koffi、pywin32 或未构建的扩展。

本机未加载这些 DLL 时,下列原生调用一律标未验,不得称为真机通过。
"""

from __future__ import annotations

import ctypes
import ntpath
import os
from ctypes import wintypes

# 与 platform.assert_windows_state_root 同一 Microsoft 常量,避免与 platform 循环导入
INVALID_FILE_ATTRIBUTES = 0xFFFFFFFF

# Microsoft Learn / winnt.h / accctrl.h 数值(与 packages/platform 对齐,禁止第三套口径)
TOKEN_QUERY = 0x0008
TOKEN_USER_CLASS = 1  # TOKEN_INFORMATION_CLASS.TokenUser
SE_FILE_OBJECT = 1
OWNER_SECURITY_INFORMATION = 0x00000001
ERROR_INSUFFICIENT_BUFFER = 122
MAX_PATH_CHARS = 261  # MAX_PATH+1 TCHARs;GetVolumeInformationW 官方上限
QUERY_DOS_CHARS = 2048  # 与 TS Buffer(4096 bytes)/2 同宽


class SID_AND_ATTRIBUTES(ctypes.Structure):
    """winnt.h SID_AND_ATTRIBUTES: PSID + DWORD;x64 由 ctypes 补齐对齐填充。"""

    _fields_ = [
        ("Sid", ctypes.c_void_p),
        ("Attributes", wintypes.DWORD),
    ]


class TOKEN_USER(ctypes.Structure):
    """winnt.h TOKEN_USER { SID_AND_ATTRIBUTES User; }。"""

    _fields_ = [("User", SID_AND_ATTRIBUTES)]


def _require_win64() -> None:
    if os.name != "nt":
        raise RuntimeError("Windows native API unavailable")
    if ctypes.sizeof(ctypes.c_void_p) != 8:
        raise RuntimeError("unsupported win32 pointer width")


def _bind_kernel32() -> ctypes.WinDLL:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.GetCurrentProcess.argtypes = []
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    kernel32.GetFileAttributesW.argtypes = [wintypes.LPCWSTR]
    kernel32.GetFileAttributesW.restype = wintypes.DWORD
    kernel32.GetDriveTypeW.argtypes = [wintypes.LPCWSTR]
    kernel32.GetDriveTypeW.restype = wintypes.UINT
    kernel32.QueryDosDeviceW.argtypes = [wintypes.LPCWSTR, wintypes.LPWSTR, wintypes.DWORD]
    kernel32.QueryDosDeviceW.restype = wintypes.DWORD
    kernel32.GetVolumeInformationW.argtypes = [
        wintypes.LPCWSTR,
        wintypes.LPWSTR,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
        ctypes.POINTER(wintypes.DWORD),
        ctypes.POINTER(wintypes.DWORD),
        wintypes.LPWSTR,
        wintypes.DWORD,
    ]
    kernel32.GetVolumeInformationW.restype = wintypes.BOOL
    return kernel32


def _bind_advapi32() -> ctypes.WinDLL:
    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
    advapi32.OpenProcessToken.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.HANDLE),
    ]
    advapi32.OpenProcessToken.restype = wintypes.BOOL
    advapi32.GetTokenInformation.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
    ]
    advapi32.GetTokenInformation.restype = wintypes.BOOL
    advapi32.ConvertSidToStringSidW.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)]
    advapi32.ConvertSidToStringSidW.restype = wintypes.BOOL
    advapi32.GetNamedSecurityInfoW.argtypes = [
        wintypes.LPCWSTR,
        ctypes.c_int,
        wintypes.DWORD,
        ctypes.POINTER(ctypes.c_void_p),
        ctypes.POINTER(ctypes.c_void_p),
        ctypes.POINTER(ctypes.c_void_p),
        ctypes.POINTER(ctypes.c_void_p),
        ctypes.POINTER(ctypes.c_void_p),
    ]
    advapi32.GetNamedSecurityInfoW.restype = wintypes.DWORD
    return advapi32


def sid_to_string(*, convert, local_free, sid: int) -> str:
    """ConvertSidToStringSidW + 必做 LocalFree。失败关闭,不把未释放指针交给调用方。"""
    raw = ctypes.c_void_p()
    if not convert(sid, ctypes.byref(raw)) or not raw.value:
        raise RuntimeError("ConvertSidToStringSidW failed")
    try:
        text = ctypes.wstring_at(raw.value)
        if not text:
            raise RuntimeError("ConvertSidToStringSidW decode failed")
        return text
    finally:
        leftover = local_free(raw)
        raw.value = None
        if leftover:
            raise RuntimeError("LocalFree failed")


def with_checked_handle(*, close_handle, handle: int, work):
    """OpenProcessToken 实句柄:任意工作异常都先 close,再抛出原始异常。

    清理失败不得吞掉原始工作异常。不关闭 GetCurrentProcess 伪句柄
    (Learn:need not be closed;CloseHandle 无效果)。
    """
    work_error: Exception | None = None
    close_error: Exception | None = None
    result = None
    try:
        result = work(handle)
    except Exception as exc:  # noqa: BLE001 任意工作异常都要 close 并保留原异常
        work_error = exc
    finally:
        try:
            if not close_handle(handle):
                close_error = RuntimeError("CloseHandle failed")
        except Exception as exc:  # noqa: BLE001 清理失败不得吞掉原始工作异常
            close_error = exc
    if work_error is not None:
        raise work_error
    if close_error is not None:
        raise close_error
    return result


class CtypesWindowsNative:
    """生产 Windows ABI。仅 os.name==nt 可构造;本机 darwin 构造必须失败关闭。"""

    def __init__(self) -> None:
        _require_win64()
        try:
            self._kernel32 = _bind_kernel32()
            self._advapi32 = _bind_advapi32()
        except OSError as exc:
            raise RuntimeError("native bind failed") from exc

    def volume_root(self, abs_path: str) -> str:
        drive, _tail = ntpath.splitdrive(abs_path)
        if not drive:
            raise RuntimeError(f"no volume root:{abs_path}")
        return drive if drive.endswith("\\") else f"{drive}\\"

    def get_file_attributes(self, abs_path: str) -> int:
        attrs = int(self._kernel32.GetFileAttributesW(abs_path))
        if attrs == INVALID_FILE_ATTRIBUTES:
            raise RuntimeError("GetFileAttributesW failed")
        return attrs

    def get_drive_type(self, root: str) -> int:
        return int(self._kernel32.GetDriveTypeW(root))

    def query_dos_device(self, dos_name: str) -> str:
        # Learn:device name 不得带尾部反斜杠;成功值为写入的 TCHAR 数,0=失败。
        # 0 / 空有效结果一律拒绝,不能为对齐旧漏洞放行。
        buf = ctypes.create_unicode_buffer(QUERY_DOS_CHARS)
        written = int(self._kernel32.QueryDosDeviceW(dos_name, buf, QUERY_DOS_CHARS))
        if written <= 0:
            raise RuntimeError("QueryDosDeviceW failed")
        device = buf.value
        if not device or not device.strip():
            raise RuntimeError("QueryDosDeviceW empty")
        return device

    def get_filesystem_name(self, root: str) -> str:
        fs_name = ctypes.create_unicode_buffer(MAX_PATH_CHARS)
        vol_name = ctypes.create_unicode_buffer(MAX_PATH_CHARS)
        serial = wintypes.DWORD(0)
        max_comp = wintypes.DWORD(0)
        flags = wintypes.DWORD(0)
        ok = self._kernel32.GetVolumeInformationW(
            root,
            vol_name,
            MAX_PATH_CHARS,
            ctypes.byref(serial),
            ctypes.byref(max_comp),
            ctypes.byref(flags),
            fs_name,
            MAX_PATH_CHARS,
        )
        if not ok:
            raise RuntimeError("GetVolumeInformationW failed")
        return fs_name.value

    def current_user_sid(self) -> str:
        process = self._kernel32.GetCurrentProcess()
        token = wintypes.HANDLE()
        if not self._advapi32.OpenProcessToken(process, TOKEN_QUERY, ctypes.byref(token)) or not token.value:
            raise RuntimeError("OpenProcessToken failed")

        def _read(_handle: int) -> str:
            needed = wintypes.DWORD(0)
            self._advapi32.GetTokenInformation(
                token, TOKEN_USER_CLASS, None, 0, ctypes.byref(needed)
            )
            size = int(needed.value)
            if size <= 0:
                raise RuntimeError("GetTokenInformation size failed")
            buf = ctypes.create_string_buffer(size)
            needed2 = wintypes.DWORD(0)
            if not self._advapi32.GetTokenInformation(
                token, TOKEN_USER_CLASS, buf, size, ctypes.byref(needed2)
            ):
                raise RuntimeError("GetTokenInformation failed")
            user = TOKEN_USER.from_buffer(buf)
            if not user.User.Sid:
                raise RuntimeError("TOKEN_USER.Sid missing")
            return sid_to_string(
                convert=self._advapi32.ConvertSidToStringSidW,
                local_free=self._kernel32.LocalFree,
                sid=int(user.User.Sid),
            )

        return with_checked_handle(
            close_handle=self._kernel32.CloseHandle,
            handle=int(token.value),
            work=_read,
        )

    def owner_sid(self, abs_path: str) -> str:
        owner = ctypes.c_void_p()
        sd = ctypes.c_void_p()
        rc = int(
            self._advapi32.GetNamedSecurityInfoW(
                abs_path,
                SE_FILE_OBJECT,
                OWNER_SECURITY_INFORMATION,
                ctypes.byref(owner),
                None,
                None,
                None,
                ctypes.byref(sd),
            )
        )
        try:
            if rc != 0 or not owner.value:
                raise RuntimeError(f"GetNamedSecurityInfoW owner failed:{rc}")
            return sid_to_string(
                convert=self._advapi32.ConvertSidToStringSidW,
                local_free=self._kernel32.LocalFree,
                sid=int(owner.value),
            )
        finally:
            if sd.value:
                leftover = self._kernel32.LocalFree(sd)
                sd.value = None
                if leftover:
                    raise RuntimeError("LocalFree failed")


def load_production_windows_native() -> CtypesWindowsNative:
    return CtypesWindowsNative()
