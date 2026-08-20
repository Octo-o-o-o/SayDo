// ProgressAlignCard fixture:期待 vs 现实对账卡(期待数据同时供 ExpectationGroup 复用)。
import type { ExpectationView } from "./types";

export const expectationFixtures: { name: string; expectation: ExpectationView }[] = [
  {
    name: "对齐中",
    expectation: {
      revision: 3,
      direction: "把 14 页控制台收成「三面一栏」,先出提案 demo 给义骁确认",
      acceptance: [
        { text: "三主面均可从侧栏一次点击到达", state: "pass_verify" },
        { text: "状态词零违规", state: "pass_verify" },
        { text: "零 emoji 门禁通过", state: "pass_verify" },
        { text: "义骁过一遍并拍板", state: "untested" }
      ],
      artifacts: { expected: 2, delivered: 1 },
      budget: { spent: 14.5, max: 25, currency: "CNY" }
    }
  },
  {
    name: "1 处偏差(图表周报 at_risk)",
    expectation: {
      revision: 2,
      direction: "每月 1 号自动生成上月运营报表并发到飞书群",
      acceptance: [
        { text: "输出与手工核对一致", state: "pass_verify" },
        { text: "推送文案不含内部路径与密钥", state: "pass_verify" },
        { text: "图表周报(趋势图三张)", state: "at_risk", note: "脚本两次失败:matplotlib 中文字体缺失" },
        { text: "每月 1 号早 8 点前发出", state: "untested" }
      ],
      artifacts: { expected: 3, delivered: 1 },
      budget: { spent: 23.6, max: 60, currency: "CNY" }
    }
  }
];

const expAligned = expectationFixtures[0]!;
const expAtRisk = expectationFixtures[1]!;

export const progressAlignFixtures = [
  { name: "期待 vs 现实(含包步进)", expectation: expAligned.expectation, nextStepText: "下一步在你手里:demo 看一遍,拍板是否应用到 console。", pkgSteps: { done: 3, total: 5 } },
  { name: "仅期待", expectation: expAtRisk.expectation, nextStepText: "「图表周报」这条期待有偏差,建议你看看怎么处理。", pkgSteps: undefined }
];
