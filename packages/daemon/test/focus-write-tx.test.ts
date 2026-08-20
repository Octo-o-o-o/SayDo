// FocusWriteTx: authority/seq/revision/崩溃回滚(A4, IM-22/23)。

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { withFocusWriteTx, FocusWriteError, readFocus } from "../src/focus/writeTx.js";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";

let fx: FocusFixture;

beforeEach(() => {
  fx = openFocusFixture();
});
afterEach(() => {
  fx.close();
});

describe("FocusWriteTx", () => {
  it("createFocus + event seq=1 + currentRevision=0", () => {
    const { focusId } = withFocusWriteTx(fx.db, {}, (ops) => ops.createFocus({ title: "T1" }));
    const f = readFocus(fx.db, focusId)!;
    expect(f.title).toBe("T1");
    expect(f.lifecycle).toBe("captured");
    expect(f.currentRevision).toBe(0);
    const seq = fx.db.prepare("SELECT MAX(seq) AS m FROM focus_events WHERE focus_id=?").get(focusId) as { m: number };
    expect(seq.m).toBe(1);
  });

  it("revision 强制 current+1;跳号/倒序拒(IM-22)", () => {
    const { focusId } = withFocusWriteTx(fx.db, {}, (ops) => ops.createFocus({ title: "T" }));
    expect(() =>
      withFocusWriteTx(fx.db, {}, (ops) =>
        ops.settleRevision(focusId, {
          currentDirection: "d",
          lastReliableState: "s",
          forceRevision: 2
        })
      )
    ).toThrow(FocusWriteError);
    expect(() =>
      withFocusWriteTx(fx.db, {}, (ops) =>
        ops.settleRevision(focusId, {
          currentDirection: "d",
          lastReliableState: "s",
          forceRevision: 0
        })
      )
    ).toThrow(/revision_not_contiguous|revision must be/);

    const { revision } = withFocusWriteTx(fx.db, {}, (ops) =>
      ops.settleRevision(focusId, { currentDirection: "d", lastReliableState: "s" })
    );
    expect(revision).toBe(1);
    expect(readFocus(fx.db, focusId)!.currentRevision).toBe(1);
  });

  it("event seq 强制 MAX+1;跳号拒", () => {
    const { focusId } = withFocusWriteTx(fx.db, {}, (ops) => ops.createFocus({ title: "T" }));
    expect(() =>
      withFocusWriteTx(fx.db, {}, (ops) =>
        ops.appendEvent(focusId, {
          type: "correction",
          payload: { note: "x" },
          actorKind: "daemon",
          forceSeq: 99
        })
      )
    ).toThrow(/seq_not_contiguous/);
  });

  it("authority_mismatch: external_bootstrap focus 拒 saydo writer 外的… wait saydo writer 拒 bootstrap", () => {
    const { focusId } = withFocusWriteTx(
      fx.db,
      { writerAuthority: "external_bootstrap" },
      (ops) => ops.createFocus({ title: "shadow", semanticAuthority: "external_bootstrap" })
    );
    expect(() =>
      withFocusWriteTx(fx.db, { writerAuthority: "saydo" }, (ops) =>
        ops.appendEvent(focusId, { type: "correction", payload: { note: "n" }, actorKind: "daemon" })
      )
    ).toThrow(/authority_mismatch/);
  });

  it("epoch fence:capturedEpoch 不等拒", () => {
    const { focusId } = withFocusWriteTx(fx.db, {}, (ops) =>
      ops.createFocus({ title: "T", authorityEpoch: 3 })
    );
    expect(() =>
      withFocusWriteTx(fx.db, { capturedEpoch: 2 }, (ops) =>
        ops.appendEvent(focusId, { type: "correction", payload: { note: "n" }, actorKind: "daemon" })
      )
    ).toThrow(/epoch_fence/);
  });

  it("崩溃回滚:目标写后事件写前抛错→整体回滚(IM-23)", () => {
    expect(() =>
      withFocusWriteTx(fx.db, { injectCrashAfterTargetWrite: true }, (ops) =>
        ops.createFocus({ title: "crash-me" })
      )
    ).toThrow(/injected_crash/);
    const n = (fx.db.prepare("SELECT COUNT(*) AS c FROM focuses").get() as { c: number }).c;
    expect(n).toBe(0);
    const e = (fx.db.prepare("SELECT COUNT(*) AS c FROM focus_events").get() as { c: number }).c;
    expect(e).toBe(0);
  });

  it("settleRevision 后 currentRevision=latest state", () => {
    const { focusId } = withFocusWriteTx(fx.db, {}, (ops) => ops.createFocus({ title: "T" }));
    withFocusWriteTx(fx.db, {}, (ops) => {
      ops.settleRevision(focusId, { currentDirection: "a", lastReliableState: "b" });
      ops.assertCurrentRevisionConsistent(focusId);
    });
    const latest = fx.db
      .prepare("SELECT MAX(revision) AS m FROM focus_states WHERE focus_id=?")
      .get(focusId) as { m: number };
    expect(latest.m).toBe(1);
    expect(readFocus(fx.db, focusId)!.currentRevision).toBe(1);
  });
});
