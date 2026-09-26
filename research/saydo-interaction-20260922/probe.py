import asyncio, json, struct
from unittest.mock import patch
from saydo_pipeline.hub_client import HubClient
from saydo_pipeline.vad import semantic_eou_complete

class Asr:
    def __init__(self):
        self.started = asyncio.Event()
        self.release = asyncio.Event()
    async def recognize(self, *args, **kwargs):
        self.started.set()
        await self.release.wait()
        return '先不要提交'

class Socket:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.sent = []
        self.closed = asyncio.Event()
        self.delivered = 0
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    async def recv(self): return json.dumps({'t': 'hello.ack'})
    async def send(self, data):
        if isinstance(data, str): self.sent.append(json.loads(data))
    async def wait_closed(self): await self.closed.wait()
    def __aiter__(self): return self
    async def __anext__(self):
        item = await self.queue.get()
        if item is None: raise StopAsyncIteration
        self.delivered += 1
        return item

async def main():
    asr, ws = Asr(), Socket()
    client = HubClient('ws://test.invalid', tts=None, asr=asr)
    client._mode, client._active_sid = 'hands_free', 'synthetic-session'
    for amplitude in [8000]*5 + [0]*45:
        await ws.queue.put(b'\x01'+b'\0'*4+struct.pack('<h', amplitude)*320)
    with patch('saydo_pipeline.hub_client.websockets.connect', return_value=ws):
        task = asyncio.create_task(client._run_once())
        try:
            await asyncio.wait_for(asr.started.wait(), 1)
            await ws.queue.put(json.dumps({'t':'barge_in','sessionId':'synthetic-session'}))
            await ws.queue.put(json.dumps({'t':'voice.mode','sessionId':'new-session','mode':'ptt'}))
            await asyncio.sleep(0.05)
            blocked = 'synthetic-session' not in client._cancelled_sessions and client._mode == 'hands_free' and ws.queue.qsize()==2
            asr.release.set()
            await ws.queue.put(None)
            await asyncio.wait_for(task, 1)
        finally:
            if not task.done(): task.cancel()
            await asyncio.gather(task, return_exceptions=True)
    stages=[m.get('stage') for m in ws.sent if m.get('t')=='latency.stage']
    finals=[m for m in ws.sent if m.get('t')=='asr.final']
    result={
      'scope':'synthetic ASR and socket, real HubClient._run_once; no network',
      'queued_controls_blocked_while_asr_pending':blocked,
      'hands_free_latency_stages':stages,
      'hands_free_missing_vad_end':'vad_end' not in stages,
      'finals_before_queued_mode_change':len(finals),
      'eou_plain_then':semantic_eou_complete('然后'),
      'eou_punctuated_then':semantic_eou_complete('然后。'),
      'real_audio_quality':'not_run'
    }
    assert blocked and 'vad_end' not in stages
    assert result['eou_plain_then'] is False and result['eou_punctuated_then'] is True
    print(json.dumps(result,ensure_ascii=False,indent=2))
asyncio.run(main())

class Tts:
    def __init__(self):
        self.started = asyncio.Event()
        self.release = asyncio.Event()
    async def synthesize(self, text):
        self.started.set()
        await self.release.wait()
        return b'synthetic-audio'

async def tts_probe():
    tts, ws = Tts(), Socket()
    client = HubClient('ws://test.invalid', tts=tts)
    sid = 'synthetic-session'
    try:
        await client._emit_final(ws, sid, '第一轮')
        turn_a = client._last_turn_id[sid]
        await client._handle(ws, {'t':'tts.say','sessionId':sid,'sentenceId':f's-{turn_a}-0','text':'第一轮响应'})
        await asyncio.wait_for(tts.started.wait(), 1)
        await client._emit_final(ws, sid, '第二轮')
        turn_b = client._last_turn_id[sid]
        tts.release.set()
        for _ in range(100):
            if any(m.get('stage') == 'tts_first_byte' for m in ws.sent): break
            await asyncio.sleep(0.001)
        recorded = [m['turnId'] for m in ws.sent if m.get('stage') == 'tts_first_byte']
        assert turn_a != turn_b and recorded == [turn_b]
        print(json.dumps({'slow_tts_a_attributed_to_turn_b':True,'scope':'real worker, synthetic ASR final/TTS/socket; no network'},ensure_ascii=False))
    finally:
        await client._reset_connection_tasks()

asyncio.run(tts_probe())
