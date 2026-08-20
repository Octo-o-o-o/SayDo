// ConfirmCard fixture:kind 真实枚举代表(义务/就绪/派发/效果/锚定)+ 倒计时/已接受/已拒绝/已过期。
import type { ConfirmCardData } from "./types";

export const confirmCardFixtures: { name: string; data: ConfirmCardData }[] = [
  {
    name: "readiness · 就绪复述(倒计时中)",
    data: {
      receiptId: "rc_1",
      kind: "readiness",
      keys: ["重设计提案只做 demo,不动 console 现有代码", "三面一栏是主线,工程航迹降级为记录", "右栏实体列表只做状态呈现,操作留在对话和今天页"],
      secondsLeft: 427,
      resolved: null
    }
  },
  {
    name: "focus_obligation · 义务确认",
    data: {
      receiptId: "rc_2",
      kind: "focus_obligation",
      keys: ["把 Q2 数据 CSV 放进项目文件夹记成你的动作", "跑批脚本等你验收"],
      secondsLeft: null,
      resolved: null
    }
  },
  {
    name: "dispatch · 派发确认",
    data: {
      receiptId: "rc_3",
      kind: "dispatch",
      keys: ["决策包 r2 按「每步问你」开始执行"],
      secondsLeft: 96,
      resolved: null
    }
  },
  {
    name: "runtime_effect · 效果授权(提示 S2 另需审批)",
    data: {
      receiptId: "rc_4",
      kind: "runtime_effect",
      keys: ["推到 demo/* 分支,会触发预览部署"],
      secondsLeft: 54,
      resolved: null
    }
  },
  {
    name: "已接受(你确认过,进 trusted)",
    data: { receiptId: "rc_5", kind: "readiness", keys: ["三条已确认"], secondsLeft: null, resolved: "accepted" }
  },
  {
    name: "已拒绝",
    data: { receiptId: "rc_6", kind: "readiness", keys: ["三条已拒绝"], secondsLeft: null, resolved: "rejected" }
  },
  {
    name: "已过期(超时即丢,不假装已采纳)",
    data: { receiptId: "rc_7", kind: "readiness", keys: ["三条过期"], secondsLeft: null, resolved: "expired" }
  }
];
