import { describe, expect, it } from "vitest";
import {
  SIDEBAR_READ_UNAVAILABLE,
  applySidebarRead,
  emptySidebarLane,
  readSidebarLane,
  sidebarHasReadError,
  sidebarLiveFocuses,
  sidebarShowEmpty,
  sidebarVisibleCount,
  type SidebarLane
} from "./sidebarLoad";

type Item = { id: string };
type FocusItem = { id: string; lifecycle: string };

const orange: Item[] = [{ id: "att-1" }, { id: "att-2" }];
const unread: Item[] = [{ id: "ntf-1" }];
const live: FocusItem[] = [{ id: "foc-1", lifecycle: "active" }];
const archivedOnly: FocusItem[] = [
  { id: "foc-arch", lifecycle: "archived" },
  { id: "foc-done", lifecycle: "closed" }
];
const rooms: Item[] = [{ id: "spc-1" }];

function fail(): Promise<Item[]> {
  return Promise.reject(new Error("read failed"));
}

function failFocus(): Promise<FocusItem[]> {
  return Promise.reject(new Error("read failed"));
}

function ok<T>(value: T): () => Promise<T> {
  return () => Promise.resolve(value);
}

async function consumeLane<T>(prev: SidebarLane<T>, load: () => Promise<T>): Promise<SidebarLane<T>> {
  return applySidebarRead(prev, await readSidebarLane(load));
}

function focusEmpty(lane: SidebarLane<FocusItem[]>): boolean {
  return sidebarShowEmpty(lane, sidebarLiveFocuses(lane.value).length);
}

describe("侧栏生产读取函数(readSidebarLane/applySidebarRead)", () => {
  it("Layout 同款组合:失败-部分成功-恢复-成功空,不把失败写成确定 0", async () => {
    const emptyAtt = emptySidebarLane<Item[]>([]);
    const emptyOb = emptySidebarLane<Item[]>([]);
    const emptyFo = emptySidebarLane<FocusItem[]>([]);
    const emptySp = emptySidebarLane<Item[]>([]);

    const [attention, outbox, focuses, spaces] = await Promise.all([
      consumeLane(emptyAtt, fail),
      consumeLane(emptyOb, fail),
      consumeLane(emptyFo, failFocus),
      consumeLane(emptySp, fail)
    ]);
    expect(attention).toEqual({ value: [], failed: true, settled: false });
    expect(outbox.failed).toBe(true);
    expect(focuses.settled).toBe(false);
    expect(spaces.value).toEqual([]);
    expect(sidebarHasReadError(attention, outbox, focuses, spaces)).toBe(true);
    expect(sidebarVisibleCount(attention, attention.value.length)).toBeUndefined();
    expect(sidebarVisibleCount(outbox, outbox.value.length)).toBeUndefined();
    expect(focusEmpty(focuses)).toBe(false);
    expect(SIDEBAR_READ_UNAVAILABLE).toBe("读取暂不可用");

    const [attPartial, obPartial, foPartial, spPartial] = await Promise.all([
      consumeLane(attention, ok(orange)),
      consumeLane(outbox, fail),
      consumeLane(focuses, ok(live)),
      consumeLane(spaces, ok(rooms))
    ]);
    expect(attPartial).toEqual({ value: orange, failed: false, settled: true });
    expect(obPartial).toEqual({ value: [], failed: true, settled: false });
    expect(foPartial).toEqual({ value: live, failed: false, settled: true });
    expect(spPartial).toEqual({ value: rooms, failed: false, settled: true });
    expect(sidebarHasReadError(attPartial, obPartial, foPartial, spPartial)).toBe(true);
    expect(sidebarVisibleCount(attPartial, 2)).toBe(2);
    expect(sidebarVisibleCount(obPartial, 0)).toBeUndefined();
    expect(focusEmpty(foPartial)).toBe(false);

    const [attRec, obRec, foRec, spRec] = await Promise.all([
      consumeLane(attPartial, ok(orange)),
      consumeLane(obPartial, ok(unread)),
      consumeLane(foPartial, ok(live)),
      consumeLane(spPartial, ok(rooms))
    ]);
    expect(obRec).toEqual({ value: unread, failed: false, settled: true });
    expect(sidebarHasReadError(attRec, obRec, foRec, spRec)).toBe(false);
    expect(sidebarVisibleCount(attRec, 2)).toBe(2);
    expect(sidebarVisibleCount(obRec, 1)).toBe(1);

    const laterFail = await consumeLane(attRec, fail);
    const laterFailOb = await consumeLane(obRec, fail);
    expect(laterFail.value).toEqual(orange);
    expect(laterFailOb.value).toEqual(unread);
    expect(laterFail.failed).toBe(true);
    expect(laterFail.settled).toBe(true);
    expect(sidebarVisibleCount(laterFail, 2)).toBe(2);
    expect(sidebarVisibleCount(laterFailOb, 1)).toBe(1);
    expect(sidebarHasReadError(laterFail, laterFailOb)).toBe(true);

    const [attEmpty, obEmpty, foEmpty, spEmpty] = await Promise.all([
      consumeLane(laterFail, ok([])),
      consumeLane(laterFailOb, ok([])),
      consumeLane(foRec, ok([])),
      consumeLane(spRec, ok([]))
    ]);
    expect(attEmpty).toEqual({ value: [], failed: false, settled: true });
    expect(obEmpty).toEqual({ value: [], failed: false, settled: true });
    expect(foEmpty).toEqual({ value: [], failed: false, settled: true });
    expect(sidebarHasReadError(attEmpty, obEmpty, foEmpty, spEmpty)).toBe(false);
    expect(sidebarVisibleCount(attEmpty, 0)).toBe(0);
    expect(focusEmpty(foEmpty)).toBe(true);
  });

  it("成功且仅 archived/closed 时按 live 筛选显示暂无;失败保留旧数据", async () => {
    const firstFail = await consumeLane(emptySidebarLane<FocusItem[]>([]), failFocus);
    expect(firstFail).toEqual({ value: [], failed: true, settled: false });
    expect(focusEmpty(firstFail)).toBe(false);

    const archivedOk = await consumeLane(firstFail, ok(archivedOnly));
    expect(archivedOk).toEqual({ value: archivedOnly, failed: false, settled: true });
    expect(sidebarLiveFocuses(archivedOk.value)).toEqual([]);
    expect(focusEmpty(archivedOk)).toBe(true);
    expect(sidebarShowEmpty(archivedOk)).toBe(false);

    const liveOk = await consumeLane(archivedOk, ok(live));
    expect(focusEmpty(liveOk)).toBe(false);
    expect(sidebarLiveFocuses(liveOk.value).map((f) => f.id)).toEqual(["foc-1"]);

    const retainFail = await consumeLane(liveOk, failFocus);
    expect(retainFail.value).toEqual(live);
    expect(retainFail.failed).toBe(true);
    expect(retainFail.settled).toBe(true);
    expect(focusEmpty(retainFail)).toBe(false);

    const emptyOk = await consumeLane(retainFail, ok([]));
    expect(emptyOk).toEqual({ value: [], failed: false, settled: true });
    expect(focusEmpty(emptyOk)).toBe(true);
  });

  it("applySidebarRead 成功空会清空,失败不覆盖最近成功", () => {
    const seeded = applySidebarRead(emptySidebarLane<Item[]>(orange), { ok: true, value: orange });
    const retained = applySidebarRead(seeded, { ok: false });
    expect(retained).toEqual({ value: orange, failed: true, settled: true });
    expect(applySidebarRead(retained, { ok: true, value: [] })).toEqual({ value: [], failed: false, settled: true });
  });
});
