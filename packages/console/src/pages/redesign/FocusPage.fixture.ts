// FocusPage page-fixture:活跃态(全量时间线+右栏+期待组+采访卡)与停机态(closed)两例。
// 数据复用组件库 fixture(单一数据源),只拼页面级形状;接线契约测试可直接拿它当种子。
import type { FocusPageView } from "./FocusPage";
import { FOCUS_DEMO, makeObligation, min } from "../../components/redesign/fixtureBase";
import { focusRailFixtures } from "../../components/redesign/FocusRail.fixture";
import { expectationFixtures, progressAlignFixtures } from "../../components/redesign/ProgressAlignCard.fixture";
import { decisionPackageFixtures } from "../../components/redesign/DecisionPackageCard.fixture";
import { interviewFixtures } from "../../components/redesign/InterviewCard.fixture";

const railTasks = focusRailFixtures.tasks;
const railObs = focusRailFixtures.obligations;
// 待命卡引用的义务(酒店确认)不在右栏 fixture 里,按 HANDOFF §3 形状补一条
const standbyOb = makeObligation({
  id: "ob_hotel",
  title: "酒店确认海景大床房",
  owner: "external",
  status: "waiting",
  waitingOn: "酒店确认海景大床房",
  dueOrTrigger: "酒店回复,或 8/10 还没消息我提醒你换一家"
});

export const focusPageActive: FocusPageView = {
  focus: FOCUS_DEMO,
  timeline: [
    { seq: 1, ts: min(60 * 26), kind: "note", text: "昨天下午 · 第 12 次会话开始" },
    { seq: 2, ts: min(60 * 26), kind: "session_segment", sessionRef: "ses_12", turnCount: 41, startTs: "昨天 15:02", endTs: "17:40", transcriptAvailable: true },
    { seq: 3, ts: min(60 * 25), kind: "note", text: "今天 · 第 13 次会话(当前)" },
    { seq: 4, ts: min(55), kind: "pkg", packageRef: "pkg_demo" },
    { seq: 5, ts: min(40), kind: "task", taskRef: "rt1" },
    { seq: 6, ts: min(30), kind: "task", taskRef: "rt3" },
    { seq: 7, ts: min(25), kind: "progress", expectationRef: "exp_r3" },
    { seq: 8, ts: min(20), kind: "standby", obligationRef: "ob_hotel" },
    { seq: 9, ts: min(12), kind: "entity", title: "重设计提案 demo.html v2 已沉淀", sub: "产物 · 由样式实现任务产出", artifactRef: "a1" },
    { seq: 10, ts: min(12), kind: "event", eventType: "artifact_realized", text: "重设计提案 demo.html v2 已沉淀" },
    { seq: 11, ts: min(5), kind: "task", taskRef: "tsk_missing" }
  ],
  rail: focusRailFixtures,
  expectations: [expectationFixtures[0]!.expectation],
  lookups: {
    tasks: Object.fromEntries(railTasks.map(t => [t.id, t])),
    packages: { pkg_demo: decisionPackageFixtures[0]!.pkg },
    obligations: { ...Object.fromEntries(railObs.map(o => [o.id, o])), ob_hotel: standbyOb },
    progress: { exp_r3: progressAlignFixtures[0]! }
  },
  interview: interviewFixtures[0]!
};

export const focusPageClosed: FocusPageView = {
  focus: {
    ...FOCUS_DEMO,
    id: "foc_migrate",
    title: "旧仓库迁移",
    lifecycle: "closed",
    currentRevision: 6,
    direction: "voice-coding 双目录并入 SayDo 单仓",
    openByOwner: { human: 0, agent: 0, external: 0 }
  },
  timeline: [
    { seq: 1, ts: min(60 * 90), kind: "note", text: "上周 · 第 3 次会话" },
    { seq: 2, ts: min(60 * 90), kind: "session_segment", sessionRef: "ses_3", turnCount: 18, startTs: "上周三 14:00", endTs: "15:12", transcriptAvailable: true },
    { seq: 3, ts: min(60 * 89), kind: "event", eventType: "focus_closed", text: "迁移验收通过,正常收官" }
  ],
  rail: {
    obligations: [],
    tasks: [],
    artifacts: [
      { id: "a_m1", focusId: "foc_migrate", version: 1, kind: "file", role: "deliverable", title: "迁移验收单.md", projectTitle: "SayDo-console-build", digest: "sha256:77c1…e9", producedBy: "迁移收尾任务", realizedAt: min(60 * 89), createdAt: min(60 * 89) }
    ],
    projects: focusRailFixtures.projects.slice(0, 1),
    memories: []
  },
  expectations: [expectationFixtures[0]!.expectation],
  lookups: {}
};

export const focusPageFixtures: { name: string; view: FocusPageView; halt: boolean }[] = [
  { name: "活跃态(时间线全卡种+期待组+采访卡+缺引用占位)", view: focusPageActive, halt: false },
  { name: "停机态 closed(ComposerHaltBar)", view: focusPageClosed, halt: true }
];
