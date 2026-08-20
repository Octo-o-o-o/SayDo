// FocusRail fixture:四组全(安排三类球权/产物四态/涉及项目/记住的事三种信任层)。
import type { ArtifactView, ObligationView, TaskView } from "./types";
import { makeObligation, makeTask, min } from "./fixtureBase";

export const focusRailFixtures = {
  obligations: [
    makeObligation({ id: "ob1", title: "demo 看完,拍板是否应用到 console", owner: "human", status: "open", needs: "decision", blocking: true }),
    makeObligation({ id: "ob2", title: "把 Q2 数据 CSV 放进项目文件夹", owner: "human", status: "open", needs: "action" }),
    makeObligation({ id: "ob3", title: "整理三家竞品的控制台信息架构对比", owner: "agent", status: "in_progress" }),
    makeObligation({ id: "ob4", title: "等飞书群管理员开 webhook", owner: "external", status: "waiting", waitingOn: "飞书群管理员", dueOrTrigger: "webhook 开通,或 8/12 我提醒你换群" }),
    makeObligation({ id: "ob5", title: "排 5 天行程草案", owner: "agent", status: "waiting", waitingOn: "等酒店确认", dueOrTrigger: "酒店定了我就开始排" }),
    makeObligation({ id: "ob6", title: "订发布会场地", owner: "external", status: "deferred", deferReason: "日期定了再订" }),
    makeObligation({ id: "ob7", title: "今天页双列布局行不行", owner: "human", status: "resolved" })
  ] as ObligationView[],
  tasks: [
    makeTask({ id: "rt1", title: "重设计 demo 样式实现", viewStatus: "running", lastEvent: "在写 today 页样式" }),
    makeTask({ id: "rt2", title: "token 层迁移到 console", viewStatus: "queued", attempt: 1, lastEvent: "排队中" }),
    makeTask({ id: "rt3", title: "输入区四态实现", viewStatus: "paused_step_boundary", attempt: 1, lastEvent: "第 3 步跑完" }),
    makeTask({ id: "rt4", title: "契约测试全量跑(交 Hopper)", route: "hopper", viewStatus: "confirmed", adapter: undefined, lastEvent: "已接单·分诊中" })
  ] as TaskView[],
  artifacts: [
    { id: "a1", focusId: "foc_demo", version: 2, kind: "file", role: "deliverable", title: "重设计提案 demo.html", projectTitle: "SayDo-console-build", digest: "sha256:8f2c…a1", producedBy: "样式实现任务", realizedAt: min(12), createdAt: min(12) },
    { id: "a2", focusId: "foc_demo", version: 1, kind: "file", role: "deliverable", title: "重设计提案 demo.html", projectTitle: "SayDo-console-build", digest: "sha256:3b7e…9d", superseded: true, createdAt: min(95) },
    { id: "a3", focusId: "foc_demo", version: 1, kind: "file", role: "expected", title: "竞品控制台 IA 对比.md", projectTitle: "OctoAgent", createdAt: min(30) },
    { id: "a4", focusId: "foc_demo", version: 1, kind: "file", role: "expected", title: "Q2 数据 CSV(输入,缺料)", obRef: "ob2", createdAt: min(300) },
    { id: "a5", focusId: "foc_demo", version: 1, kind: "file", role: "reference", title: "tokens.css(视觉基线)", digest: "sha256:11aa…c3", createdAt: min(2000) }
  ] as ArtifactView[],
  projects: [
    { id: "prj_console", title: "SayDo-console-build", path: "~/WorkSpace/SayDo-console-build" },
    { id: "prj_octo", title: "OctoAgent", path: "~/WorkSpace/OctoAgent" },
    { id: "prj_blog", title: "OctoBlog", path: "~/WorkSpace/OctoBlog" }
  ],
  memories: [
    { id: "m1", tier: "M1", trust: "user_stated" as const, text: "义骁:demo 先给我看,确认了再动 console" },
    { id: "m2", tier: "M1", trust: "user_approved" as const, text: "三面一栏是重设计主线,工程航迹降级为记录" },
    { id: "m3", tier: "M1", trust: "auto_low_impact" as const, text: "报表项目 workspace 在 ~/WorkSpace/report-auto(git repo)" }
  ]
};
