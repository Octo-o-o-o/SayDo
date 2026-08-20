// ExpectationGroup / ExpectationDriftCard fixture(OPEN QUESTION 同组件头注:未在交接清单)。
import { expectationFixtures } from "./ProgressAlignCard.fixture";

export const expectationGroupFixtures = expectationFixtures;

export const driftCardFixtures = [
  {
    name: "未处理(三分流)",
    text: "「图表周报(趋势图三张)」这条期待现在有偏差:脚本两次失败(matplotlib 中文字体缺失),按当前方案这期出不来。",
    detail: "",
    resolved: null as "fix" | "adjust" | "watch" | null
  },
  { name: "已纠实施", text: "", detail: "", resolved: "fix" as const },
  { name: "已调期待", text: "", detail: "", resolved: "adjust" as const },
  { name: "已保持观察", text: "", detail: "", resolved: "watch" as const }
];
