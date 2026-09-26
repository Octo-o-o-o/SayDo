"""离线证据探针:调用生产 HubClient,观察打断后新句是否放行旧合成。"""
import asyncio
import json
from saydo_pipeline.hub_client import HubClient


class Output:
    def __init__(self):
        self.frames = []

    async def send(self, value):
        if isinstance(value, bytes):
            size = value[5]
            self.frames.append(value[6:6 + size].decode())


class DelayedTts:
    def __init__(self):
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.calls = 0

    async def synthesize(self, text):
        self.calls += 1
        if self.calls == 1:
            self.started.set()
            await self.release.wait()
        return b"synthetic-audio"


async def run(with_new_sentence):
    provider = DelayedTts()
    output = Output()
    client = HubClient("ws://unused", tts=provider, asr=None)
    sid = "probe-session"
    try:
        await client._handle(output, {"t": "tts.say", "sessionId": sid,
                                     "sentenceId": "old-sentence", "text": "旧句"})
        await asyncio.wait_for(provider.started.wait(), 1)
        await client._handle(output, {"t": "barge_in", "sessionId": sid})
        if with_new_sentence:
            await client._handle(output, {"t": "tts.say", "sessionId": sid,
                                         "sentenceId": "new-sentence", "text": "新句"})
        provider.release.set()
        await asyncio.wait_for(client._say_workers[sid], 1)
        return {"new_sentence_after_interrupt": with_new_sentence,
                "emitted_sentence_ids": output.frames,
                "old_audio_suppressed": "old-sentence" not in output.frames}
    finally:
        await client._reset_connection_tasks()


async def main():
    rows = [await run(False), await run(True)]
    print(json.dumps({"evidence_type": "offline_production_code_probe", "cases": rows},
                     ensure_ascii=False, indent=2))
    return 0 if all(row["old_audio_suppressed"] for row in rows) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
