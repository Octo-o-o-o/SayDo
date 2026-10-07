// redesign 数据映射纯函数单测(mock 无关;不拉网)。
// 覆盖:①timeline 翻页合并无重复 ②expected→expectations ③attention 分组计数 ④transcript available:false→null

import { describe, expect, it } from "vitest";
import {
  countNeedYouByFocus,
  deriveExpectations,
  localizeSegmentTs,
  mapActivationSessions,
  mapReviewContext,
  mapTranscriptLines,
  markLiveSegments,
  mergeTimelineAsc,
  mapTimelinePage,
  mapDecisionPackageView,
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
    expect(exp![0]!.budget).toEqual({ known: false });
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

describe("mapReviewContext 验收证据", () => {
  const base = {
    task: { id: "tsk_1", title: "验收", status: "ready_for_review", project_type: "coding" },
    package: { acceptance: ["可启动", "人工走查", "缺证据", "重复项"] },
    runs: []
  };

  it("只消费逐条 AcceptanceCheck；任务终态不批量伪造 pass/fail", () => {
    const mapped = mapReviewContext({
      ...base,
      acceptanceChecks: [
        { criterion: "可启动", status: "pass", source: "verify", evidenceRef: "verify:1" },
        { criterion: "人工走查", status: "unknown", source: "manual" },
        { criterion: "缺证据", status: "pass", source: "verify" },
        { criterion: "重复项", status: "pass", source: "verify", evidenceRef: "verify:a" },
        { criterion: "重复项", status: "fail", source: "manual", evidenceRef: "audit:b" }
      ],
      acceptanceEvidence: [{ evidenceRef: "verify:1", ok: true, kind: "log", body: "启动验证通过" }]
    });
    expect(mapped.acceptance.map((item) => ({ criterion: item.criterion, status: item.status, source: item.source }))).toEqual([
      { criterion: "可启动", status: "pass", source: "verify" },
      { criterion: "人工走查", status: "unknown", source: "manual" },
      { criterion: "缺证据", status: "unknown", source: "verify" },
      { criterion: "重复项", status: "unknown", source: "verify" }
    ]);
    expect(mapped.acceptance[0]?.evidence?.body).toBe("启动验证通过");
    expect(mapped.acceptance.slice(1).every((item) => item.evidence === undefined)).toBe(true);
  });

  it("缺 evidenceRef 或未解析到正文时不把 run/tree 元数据冒充 log", () => {
    const treeSha = "a".repeat(40);
    const runId = "run_1";
    const mapped = mapReviewContext({
      task: { id: "tsk_1", title: "验收", status: "ready_for_review", project_type: "coding", project_id: "prj_1" },
      package: { acceptance: ["安装一节出现 pnpm install 示例"] },
      runs: [
        {
          id: runId,
          attempt: 1,
          state: "settled_review",
          tree_sha: treeSha,
          settle_proof_json: JSON.stringify({
            kind: "tier1",
            taskId: "tsk_1",
            runId,
            attempt: 1,
            treeSha,
            tier1VerifyDigest: "sha256:" + "b".repeat(64)
          })
        }
      ],
      acceptanceChecks: [
        { criterion: "安装一节出现 pnpm install 示例", status: "unknown", source: "manual" }
      ]
    });
    expect(mapped.acceptance[0]?.evidence).toBeUndefined();
  });

  it("不同 evidenceRef 必须展示不同原始正文,不得共用 run 元数据", () => {
    const treeSha = "a".repeat(40);
    const mapped = mapReviewContext({
      task: { id: "tsk_1", title: "验收", status: "ready_for_review", project_id: "prj_1" },
      package: { acceptance: ["保留 npm", "增加 pnpm"] },
      runs: [
        {
          id: "run_1",
          attempt: 1,
          state: "settled_review",
          tree_sha: treeSha,
          settle_proof_json: JSON.stringify({ kind: "tier1", taskId: "tsk_1", runId: "run_1", treeSha })
        }
      ],
      acceptanceChecks: [
        { criterion: "保留 npm", status: "unknown", source: "manual", evidenceRef: "verify:aaa" },
        { criterion: "增加 pnpm", status: "unknown", source: "manual", evidenceRef: "verify:bbb" }
      ],
      acceptanceEvidence: [
        { evidenceRef: "verify:aaa", ok: true, kind: "log", body: "[ok] npm install retained\nnpm install\n" },
        { evidenceRef: "verify:bbb", ok: true, kind: "log", body: "[ok] pnpm install present\npnpm install\n" }
      ]
    });
    const a = mapped.acceptance[0]?.evidence?.body ?? "";
    const b = mapped.acceptance[1]?.evidence?.body ?? "";
    expect(a).toContain("npm install retained");
    expect(b).toContain("pnpm install present");
    expect(a).not.toEqual(b);
    expect(a).not.toContain("本轮 run");
    expect(b).not.toContain("treeSha");
  });

  it("缺 proof / 解析失败 / 无关 evidenceRef 不展示伪证据", () => {
    const mapped = mapReviewContext({
      task: { id: "tsk_1", title: "验收", status: "ready_for_review", project_id: "prj_1" },
      package: { acceptance: ["可启动"] },
      runs: [
        {
          id: "run_1",
          attempt: 1,
          state: "settled_review",
          tree_sha: "c".repeat(40)
        }
      ],
      acceptanceChecks: [{ criterion: "可启动", status: "pass", source: "verify", evidenceRef: "verify:" + "e".repeat(64) }],
      acceptanceEvidence: [{ evidenceRef: "verify:" + "e".repeat(64), ok: false, reason: "digest_mismatch" }]
    });
    expect(mapped.acceptance[0]?.status).toBe("unknown");
    expect(mapped.acceptance[0]?.evidence).toBeUndefined();
  });

  it("解析 not_found/cross_run/unauthorized 不得保留 pass;manual unknown 仍待 owner 判断", () => {
    const reasons = ["not_found", "cross_run", "unauthorized"] as const;
    for (const reason of reasons) {
      const ref = `verify:${reason}`;
      const mapped = mapReviewContext({
        task: { id: "tsk_1", title: "验收", status: "ready_for_review", project_id: "prj_1" },
        package: { acceptance: ["机器项", "人工走查"] },
        runs: [],
        acceptanceChecks: [
          { criterion: "机器项", status: "pass", source: "verify", evidenceRef: ref },
          { criterion: "人工走查", status: "unknown", source: "manual", evidenceRef: ref }
        ],
        acceptanceEvidence: [{ evidenceRef: ref, ok: false, reason }]
      });
      expect(mapped.acceptance[0]?.status).toBe("unknown");
      expect(mapped.acceptance[0]?.evidenceBlock).toBe("bound_invalid");
      expect(mapped.acceptance[1]?.status).toBe("unknown");
      expect(mapped.acceptance[1]?.evidenceBlock).toBe("bound_invalid");
      expect(mapped.acceptance[1]?.evidence).toBeUndefined();
    }
  });

  it("无引用的 manual unknown 仍待判断;Executor 形状的有效 verify 引用不挡批准", () => {
    const unbound = mapReviewContext({
      task: { id: "tsk_1", title: "验收", status: "ready_for_review", project_type: "coding" },
      package: { acceptance: ["人工走查"] },
      runs: [],
      acceptanceChecks: [{ criterion: "人工走查", status: "unknown", source: "manual" }]
    });
    expect(unbound.acceptance[0]).toMatchObject({ status: "unknown", source: "manual" });
    expect(unbound.acceptance[0]?.evidenceBlock).toBeUndefined();
    const ref = `verify:sha256:${"a".repeat(64)}`;
    const bound = mapReviewContext({
      task: { id: "tsk_1", title: "验收", status: "ready_for_review", project_id: "prj_1" },
      package: { acceptance: ["人工走查"] },
      runs: [],
      acceptanceChecks: [{ criterion: "人工走查", status: "unknown", source: "manual", evidenceRef: ref }],
      acceptanceEvidence: [{ evidenceRef: ref, ok: true, kind: "log", body: "[ok] npm install retained\n" }]
    });
    expect(bound.acceptance[0]?.status).toBe("unknown");
    expect(bound.acceptance[0]?.evidenceBlock).toBeUndefined();
    expect(bound.acceptance[0]?.evidence?.body).toContain("[ok] npm install retained");
  });

  it("task.attempt 缺省时用最新 run.attempt,供 reviewTask expectedAttempt", () => {
    const mapped = mapReviewContext({
      ...base,
      task: { ...base.task },
      runs: [
        { attempt: 1, state: "failed" },
        { attempt: 2, state: "settled_review" }
      ]
    });
    expect(mapped.task.attempt).toBe(2);
  });

  it("failed 且没有逐条证据时仍全部 unknown，string criterion 不加引号", () => {
    const mapped = mapReviewContext({ ...base, task: { ...base.task, status: "failed" }, acceptanceChecks: [] });
    expect(mapped.acceptance.map((item) => [item.criterion, item.status])).toEqual([
      ["可启动", "unknown"],
      ["人工走查", "unknown"],
      ["缺证据", "unknown"],
      ["重复项", "unknown"]
    ]);
  });
});

describe("mapDecisionPackageView demoRef", () => {
  const base = {
    id: "pkg_1",
    revision: 2,
    status: "proposed",
    outcomePreview: "看小样",
    inScope: [],
    outOfScope: [],
    acceptance: [],
    plan: [],
    cost: { max: 1, currency: "CNY" },
    risks: [],
    projectId: "prj_1"
  };

  it("有效 {artifactId,version} 原样保留", () => {
    const mapped = mapDecisionPackageView({
      ...base,
      demoRef: { artifactId: "art_demo", version: 3 }
    });
    expect(mapped.demoRef).toEqual({ artifactId: "art_demo", version: 3 });
    expect(mapped.projectId).toBe("prj_1");
  });

  it("缺字段或空 artifactId 不保留", () => {
    expect(mapDecisionPackageView({ ...base, demoRef: { artifactId: "", version: 1 } }).demoRef).toBeUndefined();
    expect(mapDecisionPackageView({ ...base, demoRef: { artifactId: "art_x" } }).demoRef).toBeUndefined();
    expect(mapDecisionPackageView({ ...base, demoRef: "art_x" }).demoRef).toBeUndefined();
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
