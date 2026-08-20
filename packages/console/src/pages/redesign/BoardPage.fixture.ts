// BoardPage page-fixture:三组(多支线/单支线/休眠默认收起),复用组件 fixture;另附空态例。
import type { BoardPageView } from "./BoardPage";
import { boardGroupCollapsed, boardGroupMulti, boardGroupSingle } from "../../components/redesign/BoardLaneGroup.fixture";

export const boardPageFixtures: { name: string; view: BoardPageView }[] = [
  { name: "三组(多支线+单支线+休眠收起)", view: { groups: [boardGroupMulti, boardGroupSingle, boardGroupCollapsed] } },
  { name: "空态(没有活跃的事)", view: { groups: [] } }
];
