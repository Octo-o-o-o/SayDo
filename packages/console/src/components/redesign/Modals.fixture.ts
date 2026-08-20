// Modals fixture:审批(S2)/义务/产物/HP+DecisionRequest/tailnet/新 Focus/邮件(P1 提案)。
import { makeObligation, makeTask } from "./fixtureBase";
import { taskCardFixtures } from "./TaskCard.fixture";

export const modalsFixtures = {
  approval: {
    id: "apr_demo",
    title: "推到 demo/* 分支,会触发预览部署",
    riskLevel: "S2" as const,
    decidedVia: "screen" as const,
    focusTitle: "给 SayDo 重做前端",
    taskTitle: "重设计 demo 样式实现",
    effect: "push_branch",
    target: "demo/redesign-2026-08-07",
    downstream: ["ci_preview"],
    expiry: "72 小时"
  },
  obligation: makeObligation({ id: "mo1", title: "发布会日期定在哪天?这决定讲稿倒排节奏", owner: "human", status: "open", needs: "decision", blocking: true }),
  artifact: {
    id: "ma1", focusId: "foc_demo", version: 2, kind: "file" as const, role: "expected" as const,
    title: "竞品控制台 IA 对比.md", projectTitle: "OctoAgent", createdAt: "2026-08-07T10:00:00+08:00"
  },
  hpTask: taskCardFixtures.find(f => f.task.id === "t18")!.task,
  s3Task: makeTask({ id: "ms3", title: "样式实现首版合并", viewStatus: "review_approved_waiting_merge", riskLevel: "S3" }),
  tailnetItems: [
    { id: "tn1", title: "「月度跑批脚本」执行和检查都跑完了,等你验收", focusTitle: "月度运营报表自动化" },
    { id: "tn2", title: "讲稿大纲卡在一步:受众是技术还是商业?", focusTitle: "九月产品发布会讲稿" },
    { id: "tn3", title: "发布会日期定在哪天?", focusTitle: "九月产品发布会讲稿" }
  ],
  emailItems: [
    { id: "em1", title: "「月度跑批脚本」执行和检查都跑完了,等你验收" },
    { id: "em2", title: "讲稿大纲卡在一步:受众是技术还是商业?" },
    { id: "em3", title: "发布会日期定在哪天?这决定讲稿的倒排节奏" },
    { id: "em4", title: "把 Q2 数据 CSV 放进项目文件夹(报表跑批要用)" }
  ],
  spaces: [
    { id: "spa_work", title: "工作" },
    { id: "spa_life", title: "生活" }
  ]
};
