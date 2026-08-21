"""OS 对等语义(工程 ADR-003):状态根、owner、信号。禁止第三套口径。"""

from __future__ import annotations

import asyncio
import os
import signal
import stat
from pathlib import Path


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
    if os.name == "nt":
        # 详细 NTFS/reparse/SID 由 daemon @saydo/platform 在启动时机械断言;
        # pipeline 只拒绝 symlink 与不可读根,不在 Python 再抄一套 koffi。
        if lexical.stat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:  # type: ignore[attr-defined]
            raise RuntimeError("SAYDO_HOME must not be a reparse point")
    elif hasattr(os, "getuid") and lexical.stat().st_uid != os.getuid():
        raise RuntimeError("SAYDO_HOME owner mismatch")
    elif not hasattr(os, "getuid") and os.name != "nt":
        raise RuntimeError("SAYDO_HOME owner check cannot be skipped")
    return lexical
