// BoardPage page-fixture:三组(多支线/单支线/休眠默认收起),复用组件 fixture;另附空态例。
import type { BoardPageView } from "./BoardPage";
import { boardGroupCollapsed, boardGroupMulti, boardGroupSingle } from "../../components/redesign/BoardLaneGroup.fixture";

export const boardPageFixtures: { name: string; view: BoardPageView }[] = [
  { name: "三组(多支线+单支线+休眠收起)", view: { groups: [boardGroupMulti, boardGroupSingle, boardGroupCollapsed] } },
  { name: "空态(没有活跃的事)", view: { groups: [] } },
  {
    name: "某事 detail 拉失败(占位错误 + 重试;任务状态待核实)",
    view: {
      groups: [boardGroupMulti, boardGroupSingle],
      detailErrors: { [boardGroupSingle.focus.id]: "500 服务端错误" },
      approxStatusTaskIds: Object.values(boardGroupSingle.tasksByLane).flat().map((t) => t.id)
    }
  }
];
