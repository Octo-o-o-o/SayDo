"""OS 对等语义(工程 ADR-003):状态根、owner、信号。禁止第三套口径。"""

from __future__ import annotations

import asyncio
import os
import signal
from pathlib import Path
from typing import Protocol

# Microsoft Learn: File Attribute Constants / GetDriveTypeW / Well-known SIDs
INVALID_FILE_ATTRIBUTES = 0xFFFFFFFF
FILE_ATTRIBUTE_REPARSE_POINT = 0x400
DRIVE_FIXED = 3
ADMINISTRATORS_SID = "S-1-5-32-544"
SYSTEM_SID = "S-1-5-18"


class WindowsNative(Protocol):
    """Windows 状态根身份闸的可注入边界。测试注入不是真机 kernel32/advapi32。"""

    def volume_root(self, abs_path: str) -> str: ...
    def get_file_attributes(self, abs_path: str) -> int: ...
    def get_drive_type(self, root: str) -> int: ...
    def query_dos_device(self, dos_name: str) -> str | None: ...
    def get_filesystem_name(self, root: str) -> str: ...
    def current_user_sid(self) -> str: ...
    def owner_sid(self, abs_path: str) -> str: ...


_windows_native_override: WindowsNative | None = None


def set_windows_native_for_tests(native: WindowsNative | None) -> None:
    """只供测试替换 native 边界;生产入口不得调用。"""
    global _windows_native_override
    _windows_native_override = native


def _bound_windows_native() -> WindowsNative:
    if _windows_native_override is not None:
        return _windows_native_override
    from .win32_native import load_production_windows_native

    return load_production_windows_native()


def assert_windows_state_root(abs_path: str, native: WindowsNative | None = None) -> None:
    """Windows 状态根:非 reparse + 本地固定 NTFS + 非 subst + owner SID。失败关闭。

    独立入口必须在读 .cap-token/.env 或构造 ASR/TTS 之前调用;不得注释依赖未发生的 daemon 校验。
    QueryDosDeviceW 失败、None 或空有效结果一律拒绝,不能为对齐旧漏洞放行。
    """
    n = native if native is not None else _bound_windows_native()
    attrs = n.get_file_attributes(abs_path)
    if attrs == INVALID_FILE_ATTRIBUTES:
        raise RuntimeError("SAYDO_HOME GetFileAttributesW failed")
    if attrs & FILE_ATTRIBUTE_REPARSE_POINT:
        raise RuntimeError("SAYDO_HOME must not be a reparse point")
    root = n.volume_root(abs_path)
    if n.get_drive_type(root) != DRIVE_FIXED:
        raise RuntimeError("SAYDO_HOME volume is not DRIVE_FIXED")
    dos_name = root.rstrip("\\/")
    device = n.query_dos_device(dos_name)
    if device is None or not str(device).strip():
        raise RuntimeError("SAYDO_HOME QueryDosDeviceW failed")
    if device.startswith("\\??\\"):
        raise RuntimeError("SAYDO_HOME subst/mapped volume rejected")
    fs_name = n.get_filesystem_name(root)
    if fs_name.upper() != "NTFS":
        raise RuntimeError("SAYDO_HOME filesystem is not NTFS")
    owner = n.owner_sid(abs_path)
    me = n.current_user_sid()
    if owner in (ADMINISTRATORS_SID, SYSTEM_SID):
        raise RuntimeError("SAYDO_HOME Administrators/SYSTEM owner is not usable")
    if owner != me:
        raise RuntimeError("SAYDO_HOME owner SID mismatch")


def _host_is_windows() -> bool:
    return os.name == "nt"


def install_stop_signal(loop: asyncio.AbstractEventLoop, stop: asyncio.Event) -> None:
    """POSIX 用 loop.add_signal_handler;Windows Proactor 降级 signal.signal。"""

    def _request_stop(*_args: object) -> None:
        stop.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except (NotImplementedError, RuntimeError, OSError, ValueError):
            signal.signal(sig, _request_stop)


def saydo_state_root() -> Path:
    configured = os.environ.get("SAYDO_HOME")
    lexical = Path(configured) if configured else Path.home() / ".saydo"
    if not lexical.is_absolute():
        raise RuntimeError("SAYDO_HOME must be an absolute path")
    lexical = Path(os.path.abspath(lexical))
    if not lexical.exists() or lexical.is_symlink() or not lexical.is_dir():
        raise RuntimeError("SAYDO_HOME must be an existing real directory")
    resolved = lexical.resolve(strict=True)
    if resolved != lexical:
        raise RuntimeError("SAYDO_HOME parent path must not contain symlinks")
    if _host_is_windows():
        assert_windows_state_root(str(lexical))
    elif hasattr(os, "getuid"):
        if lexical.stat().st_uid != os.getuid():
            raise RuntimeError("SAYDO_HOME owner mismatch")
    else:
        raise RuntimeError("SAYDO_HOME owner check cannot be skipped")
    return lexical
