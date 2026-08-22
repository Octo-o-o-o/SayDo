"""platform 信号降级:Windows 上 add_signal_handler 不可用时不得抛。"""

import asyncio

from saydo_pipeline.platform import install_stop_signal


def test_install_stop_signal_does_not_raise() -> None:
    async def run() -> None:
        stop = asyncio.Event()
        install_stop_signal(asyncio.get_running_loop(), stop)
        assert stop.is_set() is False

    asyncio.run(run())
