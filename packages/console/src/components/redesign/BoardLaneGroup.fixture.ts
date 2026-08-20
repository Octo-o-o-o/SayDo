// BoardLaneGroup fixture:多支线组(2 条支线)/单支线组/格子超折叠(一列 6 张)。
import type { BoardLaneGroupData } from "./types";
import { FOCUS_DEMO, makeObligation, makeTask } from "./fixtureBase";

export const boardGroupMulti: BoardLaneGroupData = {
  focus: FOCUS_DEMO,
  lanes: [
    { id: "lan_main", title: "主线" },
    { id: "lan_tokens", title: "token 迁移" }
  ],
  tasksByLane: {
    lan_main: [
      makeTask({ id: "b1", title: "契约测试全量跑(交 Hopper)", route: "hopper", viewStatus: "confirmed", riskLevel: "S2", adapter: undefined, lastEvent: "已接单" }),
      makeTask({ id: "b2", title: "重设计 demo 样式实现", viewStatus: "running" }),
      makeTask({ id: "b3", title: "样式实现首版合并", viewStatus: "review_approved_waiting_merge", riskLevel: "S3" }),
      makeTask({ id: "b4", title: "输入区四态实现", viewStatus: "paused_step_boundary" }),
      makeTask({ id: "b5", title: "长文扩写(计费切换)", viewStatus: "waiting_confirmation", riskLevel: "S2" }),
      makeTask({ id: "b6", title: "旧 demo v1 适配", viewStatus: "superseded" }),
      makeTask({ id: "b7", title: "讲稿配图脚本", viewStatus: "merge_failed" })
    ],
    lan_tokens: [
      makeTask({ id: "b8", title: "token 层迁移到 console", viewStatus: "queued" })
    ]
  },
  obligationsByLane: {
    lan_main: [makeObligation({ id: "bo1", title: "demo 看完,拍板是否应用到 console", owner: "human", status: "open", needs: "decision", blocking: true })],
    lan_tokens: []
  },
  needCount: 4,
  collapsed: false
};

export const boardGroupSingle: BoardLaneGroupData = {
  focus: { ...FOCUS_DEMO, id: "foc_report", title: "月度运营报表自动化", openByOwner: { human: 1, agent: 1, external: 1 } },
  lanes: [{ id: "lan_main", title: "主线" }],
  tasksByLane: {
    lan_main: [
      makeTask({ id: "b9", title: "数据仓库月度同步", route: "hopper", viewStatus: "queued", adapter: undefined, lastEvent: "排队中" }),
      makeTask({ id: "b10", title: "月度跑批脚本", viewStatus: "ready_for_review" }),
      makeTask({ id: "b11", title: "图表生成脚本", viewStatus: "failed", attempt: 2 })
    ]
  },
  obligationsByLane: {
    lan_main: [makeObligation({ id: "bo2", title: "把 Q2 数据 CSV 放进项目文件夹", owner: "human", status: "open", needs: "action" })]
  },
  needCount: 3,
  collapsed: false
};

export const boardGroupCollapsed: BoardLaneGroupData = {
  ...boardGroupSingle,
  focus: { ...boardGroupSingle.focus, id: "foc_trip", title: "国庆家庭旅行计划", lifecycle: "dormant" },
  needCount: 0,
  collapsed: true
};
