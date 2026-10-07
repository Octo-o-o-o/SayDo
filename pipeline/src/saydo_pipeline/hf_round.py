"""HF 逻辑轮。识别可以乱序完成;只有 commitHead 上的结果才能进入本轮正文。"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

from .vad import semantic_eou_complete

RECORD_SEQ_MAX = 2_147_483_647
Outcome = Literal["ok", "failed"]


@dataclass(frozen=True)
class SegmentSlot:
    hf_segment_id: str
    hf_round_id: str
    record_seq: int
    speech_gen: int


@dataclass(frozen=True)
class FinalSpec:
    hf_round_id: str
    hf_segment_ids: list[str]
    record_seq_first: int
    record_seq_last: int
    text: str
    outcome: Outcome
    speech_gen: int


@dataclass
class _Result:
    hf_segment_id: str
    text: str
    outcome: Outcome


@dataclass
class _Round:
    hf_round_id: str
    speech_gen: int
    commit_head: int
    segments: list[SegmentSlot] = field(default_factory=list)
    committed: dict[int, _Result] = field(default_factory=dict)
    terminal: bool = False
    dropped: bool = False


class HfRoundMachine:
    """一个 sid 同时最多一个未终态轮。recordSeq 在连接期单调,断线重置。"""

    def __init__(self, new_id: Callable[[], str]) -> None:
        self._new_id = new_id
        self._next: dict[str, int] = {}
        self._rounds: dict[tuple[str, str], _Round] = {}
        self._open: dict[str, str] = {}
        self._speaking: dict[str, SegmentSlot] = {}
        self._results: dict[tuple[str, int], _Result] = {}
        self._retired: dict[str, set[int]] = {}

    def reset_all(self) -> None:
        self._next.clear()
        self._rounds.clear()
        self._open.clear()
        self._speaking.clear()
        self._results.clear()
        self._retired.clear()

    def retire(self, sid: str, generation: int) -> None:
        self._retired.setdefault(sid, set()).add(generation)
        rnd = self._current(sid)
        if rnd is not None and rnd.speech_gen == generation and not rnd.terminal:
            rnd.terminal = True
            rnd.dropped = True
            self._open.pop(sid, None)
            self._release_round(sid, rnd)
        slot = self._speaking.get(sid)
        if slot is not None and slot.speech_gen == generation:
            self._speaking.pop(sid, None)

    def generation_retired(self, sid: str, generation: int) -> bool:
        return generation in self._retired.get(sid, ())

    def has_open_round(self, sid: str) -> bool:
        return self._current(sid) is not None

    def speaking_slot(self, sid: str) -> SegmentSlot | None:
        return self._speaking.get(sid)

    def open_speech(self, sid: str, speech_gen: int) -> SegmentSlot | None:
        if not sid or self.generation_retired(sid, speech_gen) or sid in self._speaking:
            return None
        seq = self._alloc(sid)
        if seq is None:
            return None
        rnd = self._current(sid)
        if rnd is None:
            rid = self._new_id()
            rnd = _Round(hf_round_id=rid, speech_gen=speech_gen, commit_head=seq)
            self._rounds[(sid, rid)] = rnd
            self._open[sid] = rid
        slot = SegmentSlot(self._new_id(), rnd.hf_round_id, seq, speech_gen)
        rnd.segments.append(slot)
        self._speaking[sid] = slot
        return slot

    def close_speech(self, sid: str) -> SegmentSlot | None:
        return self._speaking.pop(sid, None)

    def note_result(
        self,
        sid: str,
        slot: SegmentSlot,
        text: str,
        outcome: Outcome,
        speech_gen: int,
    ) -> FinalSpec | None:
        if self.generation_retired(sid, speech_gen) or slot.speech_gen != speech_gen:
            return None
        rnd = self._rounds.get((sid, slot.hf_round_id))
        if rnd is None or rnd.terminal or rnd.dropped:
            return None
        self._results[(sid, slot.record_seq)] = _Result(slot.hf_segment_id, text, outcome)
        return self.settle(sid, force=False)

    def settle(self, sid: str, *, force: bool) -> FinalSpec | None:
        rnd = self._current(sid)
        if rnd is None or sid in self._speaking or not rnd.segments:
            return None
        if force:
            for seg in rnd.segments:
                key = (sid, seg.record_seq)
                if seg.record_seq not in rnd.committed and key not in self._results:
                    self._results[key] = _Result(seg.hf_segment_id, "", "failed")
        self._commit(sid, rnd)
        if any(seg.record_seq not in rnd.committed for seg in rnd.segments):
            return None
        failed = any(rnd.committed[seg.record_seq].outcome == "failed" for seg in rnd.segments)
        if failed:
            return self._finish(sid, rnd, "", "failed")
        text = "".join(rnd.committed[seg.record_seq].text for seg in rnd.segments).strip()
        if force or semantic_eou_complete(text):
            return self._finish(sid, rnd, text, "ok")
        return None

    def needs_hold(self, sid: str) -> bool:
        rnd = self._current(sid)
        if rnd is None or sid in self._speaking or not rnd.segments:
            return False
        if any(seg.record_seq not in rnd.committed for seg in rnd.segments):
            return False
        if any(rnd.committed[seg.record_seq].outcome == "failed" for seg in rnd.segments):
            return False
        text = "".join(rnd.committed[seg.record_seq].text for seg in rnd.segments).strip()
        return not semantic_eou_complete(text)

    def held_text(self, sid: str) -> str:
        if not self.needs_hold(sid):
            return ""
        rnd = self._current(sid)
        if rnd is None:
            return ""
        return "".join(rnd.committed[seg.record_seq].text for seg in rnd.segments).strip()

    def drop_open(self, sid: str) -> None:
        rnd = self._current(sid)
        if rnd is not None:
            rnd.terminal = True
            rnd.dropped = True
            self._release_round(sid, rnd)
        self._open.pop(sid, None)
        self._speaking.pop(sid, None)

    def _release_round(self, sid: str, rnd: _Round) -> None:
        self._rounds.pop((sid, rnd.hf_round_id), None)
        for segment in rnd.segments:
            self._results.pop((sid, segment.record_seq), None)
        rnd.committed.clear()

    def _alloc(self, sid: str) -> int | None:
        nxt = self._next.get(sid, 1)
        if nxt > RECORD_SEQ_MAX:
            return None
        self._next[sid] = nxt + 1
        return nxt

    def _current(self, sid: str) -> _Round | None:
        rid = self._open.get(sid)
        if rid is None:
            return None
        rnd = self._rounds.get((sid, rid))
        if rnd is None or rnd.terminal:
            return None
        return rnd

    def _commit(self, sid: str, rnd: _Round) -> None:
        while any(seg.record_seq == rnd.commit_head for seg in rnd.segments):
            key = (sid, rnd.commit_head)
            found = self._results.get(key)
            if found is None:
                return
            self._results.pop(key, None)
            rnd.committed[rnd.commit_head] = found
            rnd.commit_head += 1

    def _finish(self, sid: str, rnd: _Round, text: str, outcome: Outcome) -> FinalSpec:
        ordered = sorted(rnd.segments, key=lambda seg: seg.record_seq)
        rnd.terminal = True
        if self._open.get(sid) == rnd.hf_round_id:
            self._open.pop(sid, None)
        self._release_round(sid, rnd)
        return FinalSpec(
            hf_round_id=rnd.hf_round_id,
            hf_segment_ids=[seg.hf_segment_id for seg in ordered],
            record_seq_first=ordered[0].record_seq,
            record_seq_last=ordered[-1].record_seq,
            text="" if outcome == "failed" else text,
            outcome=outcome,
            speech_gen=rnd.speech_gen,
        )
