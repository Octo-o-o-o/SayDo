// FocusStateCard fixture:lifecycle 六态 + 球权文字变体。
import type { FocusView } from "./types";
import { FOCUS_DEMO } from "./fixtureBase";

export const focusStateCardFixtures: { name: string; focus: FocusView }[] = [
  { name: "active · 球权三方都有", focus: FOCUS_DEMO },
  { name: "captured · 刚记下", focus: { ...FOCUS_DEMO, id: "foc_2", title: "爸爸体检报告解读", lifecycle: "captured", currentRevision: 1, direction: "报告到了先解读,圈出需要复查的项", openByOwner: { human: 1, agent: 0, external: 0 } } },
  { name: "dormant · 休眠中", focus: { ...FOCUS_DEMO, id: "foc_3", title: "国庆家庭旅行计划", lifecycle: "dormant", direction: "四大一小,大理 5 天,预算两万内", openByOwner: { human: 0, agent: 0, external: 1 } } },
  { name: "closed · 已收官(绿)", focus: { ...FOCUS_DEMO, id: "foc_4", title: "旧仓库迁移", lifecycle: "closed", direction: "voice-coding 双目录并入 SayDo 单仓", openByOwner: { human: 0, agent: 0, external: 0 } } },
  { name: "abandoned · 已放弃", focus: { ...FOCUS_DEMO, id: "foc_5", title: "每天半小时日语", lifecycle: "abandoned", direction: "本来想通勤时练听力,坚持两周后主动中止", openByOwner: { human: 0, agent: 0, external: 0 } } },
  { name: "没有未结的事", focus: { ...FOCUS_DEMO, id: "foc_6", title: "九月产品发布会讲稿", direction: "20 分钟主题演讲,受众是潜在客户", openByOwner: { human: 0, agent: 0, external: 0 } } }
];
