import { describe, expect, it } from "vitest";
import {
  MOBILE_ATTENTION_ENDPOINT,
  MOBILE_RECENT_MEMORY_ENDPOINT,
  MOBILE_RECENT_TRANSCRIPT_ENDPOINT,
  mobileMemoryPath,
  parseMobileFocusDetail,
  projectDaemonFocusToMobile
} from "./data";

describe("手机 Focus 消费投影", () => {
  const daemonFocus = {
    focus: {
      id: "foc_01F1XT0RE0F0CVS00000000001",
      title: "整理 D2 观察表素材",
      lifecycle: "active",
      currentRevision: 1,
      semanticAuthority: "saydo",
      authorityEpoch: 0,
      updatedAt: "2026-07-25T02:00:00.000Z",
      direction: "整理素材",
      openObligationCount: 1,
      spaceId: null
    },
    obligations: [
      {
        id: "fob_01F1XT0RE0F0CVS00000000001",
        kind: "action",
        title: "整理观察表行",
        owner: "human",
        status: "open",
        verification: "confirmed",
        blocking: true,
        nextStep: "打开表格核对",
        detail: null,
        needs: null,
        laneId: null,
        waitingOn: null,
        waitingOnObligationId: null,
        waitingOnTaskId: null,
        waitingTaskCondition: null,
        deferReason: null,
        dueOrTrigger: null,
        createdFromEvent: 1,
        actionRef: null
      }
    ],
    lanes: [],
    events: [
      {
        id: "fev_01F1XT0RE0F0CVS00000000001",
        seq: 1,
        type: "created",
        payload: {
          payloadSchemaVersion: 1,
          title: "整理 D2 观察表素材",
          extra: "drop-me",
          laneId: "lan_01F1XT0RE0A000000000000001",
          obligationId: "fob_01F1XT0RE0F0CVS00000000001"
        },
        actorKind: "daemon",
        sessionId: "ses_private_session",
        createdAt: "2026-07-25T02:00:00.000Z"
      }
    ],
    repos: [{ projectId: "prj_01F1XT0RE0A000000000000000", note: "/opt/saydo-fixture/private-note" }],
    artifacts: [{ id: "art_1", kind: "file", role: "reference", title: "表", ref: {} }]
  };

  it("投影丢掉 events 额外字段和 repos/artifacts,再走 contracts 校验", () => {
    const projected = projectDaemonFocusToMobile(daemonFocus) as Record<string, unknown>;
    expect(projected).not.toHaveProperty("repos");
    expect(projected).not.toHaveProperty("artifacts");
    const events = projected["events"] as Array<Record<string, unknown>>;
    expect(events[0]).not.toHaveProperty("sessionId");
    expect(events[0]?.["payload"]).toEqual({
      title: "整理 D2 观察表素材",
      laneId: "lan_01F1XT0RE0A000000000000001",
      obligationId: "fob_01F1XT0RE0F0CVS00000000001"
    });
    const parsed = parseMobileFocusDetail(daemonFocus);
    expect(parsed?.obligations[0]?.title).toBe("整理观察表行");
    expect(parsed?.events[0]?.payload).toEqual({
      title: "整理 D2 观察表素材",
      laneId: "lan_01F1XT0RE0A000000000000001",
      obligationId: "fob_01F1XT0RE0F0CVS00000000001"
    });
  });

  it("依赖事件 depId 投影为 obligationId,并用义务实体补 laneId", () => {
    const raw = {
      ...daemonFocus,
      obligations: [
        {
          ...daemonFocus.obligations[0],
          laneId: "lan_01F1XT0RE0A000000000000001"
        }
      ],
      events: [
        {
          id: "fev_dep",
          seq: 2,
          type: "dependency_task_set",
          payload: {
            depId: "fob_01F1XT0RE0F0CVS00000000001",
            depTitle: "整理观察表行"
          },
          actorKind: "daemon",
          createdAt: "2026-07-25T02:01:00.000Z"
        }
      ]
    };
    const projected = projectDaemonFocusToMobile(raw) as Record<string, unknown>;
    const events = projected["events"] as Array<Record<string, unknown>>;
    expect(events[0]?.["payload"]).toEqual({
      obligationId: "fob_01F1XT0RE0F0CVS00000000001",
      laneId: "lan_01F1XT0RE0A000000000000001"
    });
  });

  it("缺必要字段仍拒绝,不粗暴取消验证", () => {
    expect(() => parseMobileFocusDetail({ focus: { id: "foc_1" }, repos: [] })).toThrow("账本格式对不上");
  });
});

describe("M-Today 与桌面 Today 同源", () => {
  it("两棵组件树都消费 /api/attention", () => {
    expect(MOBILE_ATTENTION_ENDPOINT).toBe("/api/attention");
  });
});

describe("M 记忆与历史回放端点", () => {
  it("菜单记忆库走全局 recent;项目路径与桌面 Memory 仍同源", () => {
    expect(mobileMemoryPath("prj_x")).toBe("/api/projects/prj_x/memory");
    expect(MOBILE_RECENT_TRANSCRIPT_ENDPOINT).toBe("/api/sessions/recent-transcript");
    expect(MOBILE_RECENT_MEMORY_ENDPOINT).toBe("/api/memory/recent");
  });
});
