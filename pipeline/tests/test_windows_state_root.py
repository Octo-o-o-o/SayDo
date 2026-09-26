"""SC47 Windows 状态根身份闸:注入 native 边界,不是真机 kernel32/advapi32。"""

from __future__ import annotations

import ctypes
from dataclasses import dataclass
from pathlib import Path

import pytest

from saydo_pipeline import __main__ as main_mod
from saydo_pipeline import win32_native
from saydo_pipeline.platform import (
    ADMINISTRATORS_SID,
    DRIVE_FIXED,
    FILE_ATTRIBUTE_REPARSE_POINT,
    INVALID_FILE_ATTRIBUTES,
    SYSTEM_SID,
    assert_windows_state_root,
    saydo_state_root,
    set_windows_native_for_tests,
)
from saydo_pipeline.win32_native import CtypesWindowsNative, sid_to_string, with_checked_handle

OWNER_SID = "S-1-5-21-1-2-3-1001"
OTHER_SID = "S-1-5-21-1-2-3-1002"
DEVICE_FIXED = r"\Device\HarddiskVolume2"
SUBST_DEVICE = r"\??\D:\mapped\state"


@dataclass
class FakeWindowsNative:
    """注入边界。禁止把本对象标成真机。"""

    attrs: int = 0x10
    drive_type: int = DRIVE_FIXED
    dos_device: str | None = DEVICE_FIXED
    filesystem: str = "NTFS"
    user_sid: str = OWNER_SID
    owner: str = OWNER_SID
    root: str = "C:\\"
    fail: str | None = None

    def volume_root(self, abs_path: str) -> str:
        if self.fail == "volume_root":
            raise RuntimeError("no volume root")
        return self.root

    def get_file_attributes(self, abs_path: str) -> int:
        if self.fail == "attrs":
            raise RuntimeError("GetFileAttributesW failed")
        return self.attrs

    def get_drive_type(self, root: str) -> int:
        if self.fail == "drive":
            raise RuntimeError("GetDriveTypeW failed")
        return self.drive_type

    def query_dos_device(self, dos_name: str) -> str | None:
        if self.fail == "dos":
            raise RuntimeError("QueryDosDeviceW failed")
        return self.dos_device

    def get_filesystem_name(self, root: str) -> str:
        if self.fail == "volume_info":
            raise RuntimeError("GetVolumeInformationW failed")
        return self.filesystem

    def current_user_sid(self) -> str:
        if self.fail == "token":
            raise RuntimeError("OpenProcessToken failed")
        return self.user_sid

    def owner_sid(self, abs_path: str) -> str:
        if self.fail == "owner":
            raise RuntimeError("GetNamedSecurityInfoW owner failed:5")
        return self.owner


@pytest.fixture(autouse=True)
def _clear_native() -> None:
    set_windows_native_for_tests(None)
    yield
    set_windows_native_for_tests(None)


def _win_home(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    state = tmp_path / "state"
    state.mkdir()
    # 只替换分支判定,不改全局 os.name:否则 pathlib 会按 win32 把 POSIX 绝对路径判成相对路径。
    monkeypatch.setattr("saydo_pipeline.platform._host_is_windows", lambda: True)
    monkeypatch.setenv("SAYDO_HOME", str(state))
    return state


def test_allowed_windows_root(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    state = _win_home(monkeypatch, tmp_path)
    set_windows_native_for_tests(FakeWindowsNative())
    assert saydo_state_root() == state


@pytest.mark.parametrize(
    ("native", "match"),
    [
        (FakeWindowsNative(owner=OTHER_SID), "owner SID mismatch"),
        (FakeWindowsNative(owner=SYSTEM_SID), "Administrators/SYSTEM"),
        (FakeWindowsNative(owner=ADMINISTRATORS_SID), "Administrators/SYSTEM"),
        (FakeWindowsNative(user_sid=SYSTEM_SID, owner=SYSTEM_SID), "Administrators/SYSTEM"),
        (FakeWindowsNative(drive_type=2), "DRIVE_FIXED"),
        (FakeWindowsNative(drive_type=4), "DRIVE_FIXED"),
        (FakeWindowsNative(filesystem="ReFS"), "not NTFS"),
        (FakeWindowsNative(filesystem="FAT32"), "not NTFS"),
        (FakeWindowsNative(dos_device=SUBST_DEVICE), "subst/mapped"),
        (FakeWindowsNative(dos_device=None), "QueryDosDeviceW"),
        (FakeWindowsNative(dos_device=""), "QueryDosDeviceW"),
        (FakeWindowsNative(dos_device="   "), "QueryDosDeviceW"),
        (FakeWindowsNative(attrs=FILE_ATTRIBUTE_REPARSE_POINT), "reparse"),
        (FakeWindowsNative(attrs=INVALID_FILE_ATTRIBUTES), "GetFileAttributesW"),
        (FakeWindowsNative(fail="attrs"), "GetFileAttributesW"),
        (FakeWindowsNative(fail="drive"), "GetDriveTypeW"),
        (FakeWindowsNative(fail="dos"), "QueryDosDeviceW"),
        (FakeWindowsNative(fail="volume_info"), "GetVolumeInformationW"),
        (FakeWindowsNative(fail="token"), "OpenProcessToken"),
        (FakeWindowsNative(fail="owner"), "GetNamedSecurityInfoW"),
        (FakeWindowsNative(fail="volume_root"), "no volume root"),
    ],
)
def test_windows_root_rejects(native: FakeWindowsNative, match: str) -> None:
    with pytest.raises(RuntimeError, match=match):
        assert_windows_state_root(r"C:\saydo-test\state", native)


def test_query_dos_none_or_empty_is_rejected() -> None:
    """查询失败/空结果必须拒绝。注入边界,不是真机。不得为对齐旧漏洞放行。"""
    for native in (
        FakeWindowsNative(dos_device=None),
        FakeWindowsNative(dos_device=""),
        FakeWindowsNative(dos_device="   "),
    ):
        with pytest.raises(RuntimeError, match="QueryDosDeviceW"):
            assert_windows_state_root(r"C:\saydo-test\state", native)


def test_rejected_root_does_not_read_credentials_or_construct_providers(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    state = _win_home(monkeypatch, tmp_path)
    (state / ".cap-token").write_text("secret-token\n")
    (state / ".env").write_text("DOUBAO_TTS_API_KEY=secret-key\nVOLC_APP_ID=app\nVOLC_ACCESS_TOKEN=tok\n")
    monkeypatch.setenv("DOUBAO_TTS_API_KEY", "from-process")
    monkeypatch.setenv("VOLC_APP_ID", "from-process")
    monkeypatch.setenv("VOLC_ACCESS_TOKEN", "from-process")
    set_windows_native_for_tests(FakeWindowsNative(owner=OTHER_SID))

    reads: list[str] = []
    orig = Path.read_text

    def spy(self: Path, *args: object, **kwargs: object) -> str:
        reads.append(str(self))
        return orig(self, *args, **kwargs)

    constructed: list[str] = []

    class BoomTts:
        def __init__(self, *args: object, **kwargs: object) -> None:
            constructed.append("tts")

    class BoomAsr:
        def __init__(self, *args: object, **kwargs: object) -> None:
            constructed.append("asr")

    monkeypatch.setattr(Path, "read_text", spy)
    monkeypatch.setattr(main_mod, "DoubaoTts", BoomTts)
    monkeypatch.setattr(main_mod, "DoubaoAsr", BoomAsr)

    with pytest.raises(RuntimeError, match="owner SID mismatch"):
        main_mod.prepare_pipeline_io()
    assert constructed == []
    assert not any(name.endswith((".cap-token", ".env")) for name in reads)


def test_allowed_root_reaches_credential_and_provider_construct(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    state = _win_home(monkeypatch, tmp_path)
    (state / ".cap-token").write_text("ok-token\n")
    set_windows_native_for_tests(FakeWindowsNative())
    monkeypatch.setenv("DOUBAO_TTS_API_KEY", "k")
    monkeypatch.setenv("VOLC_APP_ID", "a")
    monkeypatch.setenv("VOLC_ACCESS_TOKEN", "t")

    constructed: list[str] = []

    class RecTts:
        def __init__(self, key: str) -> None:
            constructed.append(f"tts:{key}")

    class RecAsr:
        def __init__(self, app_id: str, access_token: str) -> None:
            constructed.append(f"asr:{app_id}:{access_token}")

    monkeypatch.setattr(main_mod, "DoubaoTts", RecTts)
    monkeypatch.setattr(main_mod, "DoubaoAsr", RecAsr)

    io = main_mod.prepare_pipeline_io()
    assert io.cap == "ok-token"
    assert constructed == ["tts:k", "asr:a:t"]


def test_posix_owner_mismatch_no_regression(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    state = tmp_path / "state"
    state.mkdir()
    monkeypatch.setenv("SAYDO_HOME", str(state))
    uid = state.stat().st_uid
    monkeypatch.setattr("saydo_pipeline.platform.os.getuid", lambda: uid + 1)
    with pytest.raises(RuntimeError, match="owner mismatch"):
        saydo_state_root()


def test_posix_injection_ignored(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    state = tmp_path / "state"
    state.mkdir()
    monkeypatch.setenv("SAYDO_HOME", str(state))
    set_windows_native_for_tests(FakeWindowsNative(owner=OTHER_SID))
    assert saydo_state_root() == state


def test_ctypes_native_refuses_non_windows() -> None:
    with pytest.raises(RuntimeError, match="unavailable"):
        CtypesWindowsNative()


def _write_sid_ptr(out_ref: object, addr: int) -> None:
    ctypes.cast(out_ref, ctypes.POINTER(ctypes.c_void_p)).contents.value = addr


def test_sid_to_string_always_local_free() -> None:
    freed: list[int] = []
    buf = ctypes.create_unicode_buffer("S-1-5-21-9")
    addr = ctypes.addressof(buf)

    def convert_ok(_sid: int, out_ref: object) -> int:
        _write_sid_ptr(out_ref, addr)
        return 1

    def local_free(ptr: object) -> None:
        freed.append(int(getattr(ptr, "value", 0) or 0))

    text = sid_to_string(convert=convert_ok, local_free=local_free, sid=1)
    assert text == "S-1-5-21-9"
    assert freed == [addr]


def test_sid_to_string_local_free_failure_is_closed() -> None:
    buf = ctypes.create_unicode_buffer("S-1-5-18")
    addr = ctypes.addressof(buf)

    def convert_ok(_sid: int, out_ref: object) -> int:
        _write_sid_ptr(out_ref, addr)
        return 1

    def local_free_fail(_ptr: object) -> int:
        return 1

    with pytest.raises(RuntimeError, match="LocalFree failed"):
        sid_to_string(convert=convert_ok, local_free=local_free_fail, sid=1)


def test_token_user_struct_is_pointer_plus_dword_on_64bit_host() -> None:
    # 宿主指针宽度下的 ctypes 布局论证,不是 Windows 加载验证。
    assert ctypes.sizeof(ctypes.c_void_p) == 8
    assert ctypes.sizeof(win32_native.SID_AND_ATTRIBUTES) == 16
    assert ctypes.sizeof(win32_native.TOKEN_USER) == 16


def test_checked_handle_closes_on_success_and_failure() -> None:
    closed: list[int] = []

    def close_ok(handle: int) -> int:
        closed.append(handle)
        return 1

    assert with_checked_handle(close_handle=close_ok, handle=7, work=lambda h: h + 1) == 8
    assert closed == [7]

    closed.clear()
    with pytest.raises(RuntimeError, match="work"):
        with_checked_handle(
            close_handle=close_ok,
            handle=9,
            work=lambda _h: (_ for _ in ()).throw(RuntimeError("work")),
        )
    assert closed == [9]

    with pytest.raises(RuntimeError, match="CloseHandle failed"):
        with_checked_handle(close_handle=lambda _h: 0, handle=3, work=lambda _h: "ok")


def test_checked_handle_closes_on_any_work_exception() -> None:
    closed: list[int] = []

    def close_ok(handle: int) -> int:
        closed.append(handle)
        return 1

    with pytest.raises(ValueError, match="work"):
        with_checked_handle(
            close_handle=close_ok,
            handle=4,
            work=lambda _h: (_ for _ in ()).throw(ValueError("work")),
        )
    assert closed == [4]


def test_checked_handle_preserves_work_error_if_close_fails() -> None:
    closed: list[int] = []

    def close_boom(handle: int) -> int:
        closed.append(handle)
        raise OSError("close")

    with pytest.raises(ValueError, match="orig"):
        with_checked_handle(
            close_handle=close_boom,
            handle=5,
            work=lambda _h: (_ for _ in ()).throw(ValueError("orig")),
        )
    assert closed == [5]
