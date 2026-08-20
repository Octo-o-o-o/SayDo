// RecordsPanel fixture:支线航迹/依赖链/会话段三态/事件流。
import type { ObligationView } from "./types";
import { FOCUS_DEMO, makeObligation } from "./fixtureBase";

export const recordsFixture = {
  focus: FOCUS_DEMO,
  lanes: [
    { id: "lan_main", title: "主线", eventCount: 5 },
    { id: "lan_tokens", title: "token 迁移", eventCount: 3 }
  ],
  dependencies: [
    makeObligation({ id: "dep1", title: "排 5 天行程草案", owner: "agent", status: "waiting", waitingOn: "等酒店确认" })
  ] as ObligationView[],
  segments: [
    { sessionRef: "ses_12", label: "第 12 次会话 · 昨天 15:02 – 17:40", turnCount: 41, closed: true, transcriptAvailable: true },
    { sessionRef: "ses_11", label: "第 11 次会话 · 周二 10:12 – 11:05", turnCount: 23, closed: true, transcriptAvailable: true },
    { sessionRef: "ses_10", label: "第 10 次会话 · 周一 21:40", turnCount: 9, closed: false, transcriptAvailable: false }
  ],
  events: [
    { seq: 42, type: "artifact_realized", text: "重设计提案 demo.html v2 已沉淀" },
    { seq: 38, type: "revision_settled", text: "r13 → r14(你拍板了三面一栏)" },
    { seq: 31, type: "obligation_opened", text: "「样式实现」派生为任务 tsk_saydo_style" },
    { seq: 27, type: "packet_confirmed", text: "本场开场编译已确认(baseline r13)" },
    { seq: 19, type: "activation_started", text: "第 12 次会话锚定到本 Focus" }
  ]
};
