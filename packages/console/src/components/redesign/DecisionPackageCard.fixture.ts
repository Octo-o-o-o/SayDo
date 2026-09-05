// DecisionPackageCard fixture:proposed 未选模式(中性)/已选每步问你/已批准。
import type { DecisionPackageView } from "./types";

const BASE: DecisionPackageView = {
  id: "pkg_demo",
  revision: 2,
  status: "proposed",
  outcomePreview: "一个三面一栏的重设计提案 demo:今天收件箱、Focus 对话页(带右栏实体列表)、验收面,单文件 HTML 可直接打开评审",
  inScope: ["今天页四色收件箱(对齐 /api/attention 契约)", "Focus 对话页统一时间线 + 右栏实体列表", "验收面按验收标准组织证据"],
  outOfScope: ["不改 daemon 与 contracts 任何代码", "不做移动端适配(P0 桌面优先)", "不接真实语音管线"],
  acceptance: ["三主面均可从侧栏一次点击到达", "状态词零违规(grep 无「完成/做完」执行态用法)", "零 emoji 门禁脚本通过", "亮暗双主题截图无破版"],
  plan: [
    { seq: 1, step: "搭单文件骨架与 token 层(照抄 11 §2)", owner: "ai" },
    { seq: 2, step: "今天页 + Focus 对话页 + 验收面三视图", owner: "ai" },
    { seq: 3, step: "mock 数据按 09 契约形状填充", owner: "ai" },
    { seq: 4, step: "你过一遍三主面,拍板是否应用到 console", owner: "human" },
    { seq: 5, step: "截图验证 + emoji 门禁 + 落提案说明", owner: "ai" }
  ],
  cost: { expected: 6.5, max: 15, currency: "CNY" },
  risks: ["单文件 demo 与 React 工程结构不同,应用到 console 时需重拆组件", "时间线读模型若后补 server 端,前端拼接逻辑会重写一次"],
  preauthorizedEffects: [
    { effect: "install_dependency", spokenForm: "装 lucide-static、clsx 这2个依赖", ttlHours: 72 },
    { effect: "push_branch", spokenForm: "推到 demo/* 分支,会触发预览部署", ttlHours: 72 }
  ],
  expiresInH: 21,
  recommendedMode: "step_confirm",
  selectedMode: null
};

export const decisionPackageFixtures: { name: string; pkg: DecisionPackageView }[] = [
  { name: "proposed · 未选模式(中性,拍板禁用)", pkg: BASE },
  { name: "proposed · 已选「每步问你」", pkg: { ...BASE, selectedMode: "step_confirm" } },
  { name: "proposed · 旧 direct 值 fail-closed", pkg: { ...BASE, selectedMode: "direct_to_review" } },
  { name: "approved · 已批准", pkg: { ...BASE, status: "approved", selectedMode: "step_confirm" } }
];
