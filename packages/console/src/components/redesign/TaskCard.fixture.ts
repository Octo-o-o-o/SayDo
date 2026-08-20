// TaskCard fixture:16 呈现态全覆盖(tier1)+ Hopper 两种(received/DecisionRequest)。
import type { TaskView } from "./types";
import { makeTask } from "./fixtureBase";

export const taskCardFixtures: { name: string; task: TaskView }[] = [
  { name: "queued · 排队中", task: makeTask({ id: "t01", title: "token 层迁移到 console", viewStatus: "queued", lastEvent: "排在前一个任务后面" }) },
  { name: "confirmed · 收到,准备开工", task: makeTask({ id: "t02", title: "定时调度配置", viewStatus: "confirmed", riskLevel: "S2", elapsedMin: 0, spent: { known: false }, lastEvent: "收到,准备开工" }) },
  { name: "running · 执行中(呼吸点)", task: makeTask({ id: "t03", title: "重设计 demo 样式实现", viewStatus: "running", elapsedMin: 18, spent: { known: false }, lastEvent: "在写 today 页的 attention 列表样式" }) },
  { name: "paused_step_boundary · 等你确认这一步", task: makeTask({ id: "t04", title: "输入区四态实现", viewStatus: "paused_step_boundary", elapsedMin: 15, spent: { known: true, value: 5.5 }, lastEvent: "第 3 步(录音态)跑完,等你确认这一步" }) },
  { name: "blocked · 需要你(行内回答)", task: makeTask({ id: "t05", title: "发布会讲稿大纲 v2", viewStatus: "blocked", riskLevel: "S0", lastEvent: "受众定位两种理解都能走,需要你拍板" }) },
  { name: "waiting_confirmation · 等你拍板(计费切换)", task: makeTask({ id: "t06", title: "长文扩写(计费切换)", viewStatus: "waiting_confirmation", riskLevel: "S2", elapsedMin: 7, spent: { known: false }, lastEvent: "订阅额度用完了,切到 API 计费要你拍板" }) },
  { name: "ready_for_review · 等你验收(全站最高优先级)", task: makeTask({ id: "t07", title: "月度跑批脚本", viewStatus: "ready_for_review", attempt: 2, elapsedMin: 23, spent: { known: true, value: 11.4 }, lastEvent: "verify 三条全过,树已冻结" }) },
  { name: "review_approved_waiting_merge · 已批准·待合并(S3)", task: makeTask({ id: "t08", title: "样式实现首版合并", viewStatus: "review_approved_waiting_merge", riskLevel: "S3", elapsedMin: 26, spent: { known: true, value: 8.8 }, lastEvent: "你已验收,等你 Touch ID 批准合并" }) },
  { name: "merging · 合并中", task: makeTask({ id: "t09", title: "模板目录整理合并", viewStatus: "merging", riskLevel: "S3", elapsedMin: 2, spent: { known: true, value: 1.1 }, lastEvent: "合并进行中" }) },
  { name: "merge_failed · 合并冲突/失败", task: makeTask({ id: "t10", title: "讲稿配图脚本", viewStatus: "merge_failed", elapsedMin: 14, spent: { known: true, value: 4.0 }, lastEvent: "和你手改的同一段冲突了" }) },
  { name: "task_done · 已交付", task: makeTask({ id: "t11", title: "报表模板目录整理", viewStatus: "task_done", elapsedMin: 9, spent: { known: true, value: 3.1 }, lastEvent: "已交付并合并" }) },
  { name: "failed · 失败了(可重派)", task: makeTask({ id: "t12", title: "图表生成脚本", viewStatus: "failed", attempt: 2, elapsedMin: 9, spent: { known: true, value: 3.4 }, lastEvent: "matplotlib 中文字体缺失,退码 1" }) },
  { name: "cancel_requested · 正在停(呼吸点)", task: makeTask({ id: "t13", title: "旧版数据回填", viewStatus: "cancel_requested", elapsedMin: 4, spent: { known: true, value: 0.6 }, lastEvent: "正在停,等执行器收口" }) },
  { name: "cancel_settled · 停了,这轮作废", task: makeTask({ id: "t14", title: "讲稿 v0 大纲", viewStatus: "cancel_settled", elapsedMin: 5, spent: { known: true, value: 0.8 }, lastEvent: "你叫停的,这轮作废" }) },
  { name: "superseded · 已被新版本替代", task: makeTask({ id: "t15", title: "旧 demo v1 适配", viewStatus: "superseded", elapsedMin: 11, spent: { known: true, value: 2.2 }, lastEvent: "被 v2 替代" }) },
  { name: "parked · 停靠等你(带截止)", task: makeTask({ id: "t16", title: "数据口径确认", viewStatus: "parked", riskLevel: "S0", elapsedMin: 6, spent: { known: true, value: 1.2 }, parkedDeadline: "2026-08-12T23:59:00+08:00", lastEvent: "停靠等你:自然月还是账期月" }) },
  { name: "hopper · received(已接单·分诊中)", task: makeTask({ id: "t17", title: "契约测试全量跑(交 Hopper)", route: "hopper", viewStatus: "confirmed", riskLevel: "S2", adapter: undefined, elapsedMin: 0, spent: { known: false }, lastEvent: "Hopper 已接单·分诊中" }) },
  { name: "hopper · blocked(DecisionRequest)", task: makeTask({ id: "t18", title: "飞书推送文案合规检查", route: "hopper", viewStatus: "blocked", riskLevel: "S2", adapter: undefined, elapsedMin: 5, spent: { known: false }, lastEvent: "守门硬命中:推送文案含内部群名,等你裁决", hpDecision: "推送文案里的「营收内参群」改成「运营周报群」可以发吗?" }) }
];
