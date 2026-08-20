// redesign 数据映射纯函数单测(mock 无关;不拉网)。
// 覆盖:①timeline 翻页合并无重复 ②expected→expectations ③attention 分组计数 ④transcript available:false→null

import { describe, expect, it } from "vitest";
import {
  countNeedYouByFocus,
  deriveExpectations,
  localizeSegmentTs,
  mapActivationSessions,
  mapTranscriptLines,
  markLiveSegments,
  mergeTimelineAsc,
  mapTimelinePage,
  type AttentionItemRow,
  type DaemonTimelineItem,
  type FocusDetailPayload
} from "./mappers";

describe("mergeTimelineAsc / mapTimelinePage", () => {
  it("翻页合并无重复(同 seq 去重,升序)", () => {
    const page1: DaemonTimelineItem[] = [
      { seq: 10, ts: "t10", kind: "event", eventType: "created", summary: "创建" },
      { seq: 9, ts: "t9", kind: "event", eventType: "obligation_opened", summary: "开义务" },
      {
        seq: 8,
        ts: "t8",
        kind: "session_segment",
        sessionRef: "act_1",
        startTs: "t8",
        endTs: "t8b",
        turnCount: 3,
        transcriptAvailable: true
      }
    ];
    const page2Older: DaemonTimelineItem[] = [
      // 边界重叠 seq=8 应去重
      {
        seq: 8,
        ts: "t8",
        kind: "session_segment",
        sessionRef: "act_1",
        startTs: "t8",
        endTs: "t8b",
        turnCount: 3,
        transcriptAvailable: true
      },
      { seq: 7, ts: "t7", kind: "event", eventType: "revision_settled", summary: "修订" },
      { seq: 6, ts: "t6", kind: "event", eventType: "lifecycle_changed", summary: "生命周期" }
    ];

    const first = mapTimelinePage(page1);
    expect(first.map((i) => i.seq)).toEqual([8, 9, 10]);

    const olderMapped = page2Older.map((i) => {
      if (i.kind === "session_segment") {
        return {
          seq: i.seq,
          ts: i.ts,
          kind: "session_segment" as const,
          sessionRef: i.sessionRef,
          turnCount: i.turnCount,
          startTs: i.startTs,
          endTs: i.endTs,
          transcriptAvailable: i.transcriptAvailable
        };
      }
      return {
        seq: i.seq,
        ts: i.ts,
        kind: "event" as const,
        eventType: i.eventType,
        text: i.summary
      };
    });

    const merged = mergeTimelineAsc(first, olderMapped);
    expect(merged.map((i) => i.seq)).toEqual([6, 7, 8, 9, 10]);
    // 无重复
    expect(new Set(merged.map((i) => i.seq)).size).toBe(merged.length);
    // event.summary → text
    const ev = merged.find((i) => i.seq === 10);
    expect(ev?.kind).toBe("event");
    if (ev?.kind === "event") expect(ev.text).toBe("创建");
  });
});

describe("deriveExpectations", () => {
  it("role:expected artifacts → ExpectationView;无 expected 则 undefined", () => {
    const none = deriveExpectations(
      [
        { id: "a1", kind: "file", role: "deliverable", title: "已交付" },
        { id: "a2", kind: "file", role: "reference", title: "参考" }
      ],
      { revision: 2, direction: "方向" }
    );
    expect(none).toBeUndefined();

    const exp = deriveExpectations(
      [
        { id: "e1", kind: "file", role: "expected", title: "竞品对比.md" },
        { id: "e2", kind: "file", role: "expected", title: "提案 demo.html" },
        { id: "d1", kind: "file", role: "deliverable", title: "提案 demo.html" }
      ],
      { revision: 3, direction: "三面一栏" }
    );
    expect(exp).toHaveLength(1);
    expect(exp![0]!.revision).toBe(3);
    expect(exp![0]!.direction).toBe("三面一栏");
    expect(exp![0]!.acceptance).toEqual([
      { text: "竞品对比.md", state: "untested" },
      { text: "提案 demo.html", state: "untested" }
    ]);
    expect(exp![0]!.artifacts).toEqual({ expected: 2, delivered: 1 });
  });
});

describe("countNeedYouByFocus", () => {
  it("按 focusId 只计橙+蓝", () => {
    const items: AttentionItemRow[] = [
      { id: "1", color: "orange", title: "a", focusId: "f1" },
      { id: "2", color: "blue", title: "b", focusId: "f1" },
      { id: "3", color: "green", title: "c", focusId: "f1" },
      { id: "4", color: "gray", title: "d", focusId: "f1" },
      { id: "5", color: "orange", title: "e", focusId: "f2" },
      { id: "6", color: "blue", title: "f", focusId: null }
    ];
    const m = countNeedYouByFocus(items);
    expect(m.get("f1")).toBe(2);
    expect(m.get("f2")).toBe(1);
    expect(m.has("")).toBe(false);
  });
});

describe("localizeSegmentTs(L3 会话段时间戳本地化)", () => {
  // 本地时区构造(与生产口径同:new Date(iso) 回解析为本地)
  const localIso = (y: number, mo: number, d: number, h: number, mi: number): string =>
    new Date(y, mo, d, h, mi).toISOString();

  it("当天:start「今天 HH:MM」,end 同日「HH:MM」", () => {
    const n = new Date();
    const start = localIso(n.getFullYear(), n.getMonth(), n.getDate(), 15, 2);
    const end = localIso(n.getFullYear(), n.getMonth(), n.getDate(), 17, 40);
    expect(localizeSegmentTs(start, end)).toEqual({ startTs: "今天 15:02", endTs: "17:40" });
  });

  it("跨天:end 带日期;非当天 start 带日期", () => {
    const start = localIso(2026, 7, 8, 23, 50); // 2026-08-08 23:50 本地
    const end = localIso(2026, 7, 9, 0, 40);
    const got = localizeSegmentTs(start, end);
    expect(got.startTs).toMatch(/^8\/8 23:50|^今天 23:50/); // 恰在 8/8 跑测则为「今天」
    expect(got.endTs).toBe("8/9 00:40"); // 与 start 恒不同天 ⇒ 恒带日期
  });

  it("endTs=null 保持 null;解析失败原样透传", () => {
    expect(localizeSegmentTs("昨天 15:02", null)).toEqual({ startTs: "昨天 15:02", endTs: null });
    expect(localizeSegmentTs("t8", "t8b")).toEqual({ startTs: "t8", endTs: "t8b" });
    const n = new Date();
    const start = localIso(n.getFullYear(), n.getMonth(), n.getDate(), 9, 31);
    expect(localizeSegmentTs(start, null)).toEqual({ startTs: "今天 09:31", endTs: null });
  });
});

describe("mapTranscriptLines", () => {
  it("available:false → null;available:true → 行数组", () => {
    expect(mapTranscriptLines({ available: false, reason: "not_stored" })).toBeNull();
    expect(mapTranscriptLines(null)).toBeNull();
    expect(mapTranscriptLines(undefined)).toBeNull();
    const lines = mapTranscriptLines({
      available: true,
      turns: [
        { turnId: "1", speaker: "user", text: "你好", ts: "t1" },
        { turnId: "2", speaker: "ai", text: "在", ts: "t2" }
      ]
    });
    expect(lines).toEqual(["你: 你好", "AI: 在"]);
  });
});

describe("mapActivationSessions / markLiveSegments(L2 活跃会话段)", () => {
  const events: FocusDetailPayload["events"] = [
    { seq: 1, type: "created", payload: {} },
    { seq: 2, type: "activation_started", payload: { activationId: "fac_1", sessionId: "ses_A" } },
    // payload 缺 sessionId 时走顶层 sessionId 兜底
    { seq: 3, type: "activation_started", payload: { activationId: "fac_2" }, sessionId: "ses_B" },
    { seq: 4, type: "activation_closed", payload: { activationId: "fac_2" } }
  ];

  it("activation_started → activationId→sessionId(payload 优先,顶层兜底)", () => {
    const m = mapActivationSessions(events);
    expect(m.get("fac_1")).toBe("ses_A");
    expect(m.get("fac_2")).toBe("ses_B");
    expect(m.size).toBe(2);
  });

  it("endTs=null 且归属当前会话 ⇒ live=true;已收场/别会话/空集合不动", () => {
    const items = mapTimelinePage([
      { seq: 1, ts: "t1", kind: "session_segment", sessionRef: "fac_1", startTs: "s1", endTs: null, turnCount: 3, transcriptAvailable: true },
      { seq: 2, ts: "t2", kind: "session_segment", sessionRef: "fac_9", startTs: "s2", endTs: null, turnCount: 1, transcriptAvailable: false },
      { seq: 3, ts: "t3", kind: "session_segment", sessionRef: "fac_1", startTs: "s3", endTs: "e3", turnCount: 5, transcriptAvailable: true }
    ]);
    const live = markLiveSegments(items, new Set(["fac_1"]));
    expect(live[0]).toMatchObject({ sessionRef: "fac_1", live: true });
    expect(live[1]).not.toHaveProperty("live"); // 不归属当前会话 ⇒ 仍是「中断」
    expect(live[2]).not.toHaveProperty("live"); // 已收场不标
    // 空集合恒不动(无当前会话时零误判)
    const none = markLiveSegments(items, new Set());
    expect(none.some((i) => i.kind === "session_segment" && i.live === true)).toBe(false);
  });
});
