"""platform 信号降级:Windows 上 add_signal_handler 不可用时不得抛。"""

import asyncio
from pathlib import Path

import pytest

from saydo_pipeline.platform import install_stop_signal, saydo_state_root


def test_install_stop_signal_does_not_raise() -> None:
    async def run() -> None:
        stop = asyncio.Event()
        install_stop_signal(asyncio.get_running_loop(), stop)
        assert stop.is_set() is False

    asyncio.run(run())


def test_posix_state_root_owner_match(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    state = tmp_path / "state"
    state.mkdir()
    monkeypatch.setenv("SAYDO_HOME", str(state))
    assert saydo_state_root() == state
