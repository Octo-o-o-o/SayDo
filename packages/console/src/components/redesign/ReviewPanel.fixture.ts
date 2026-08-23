// ReviewPanel fixture:coding(机器验+自报空心勾+人工 unknown)/writing(逐条人工裁决)/S3。
import type { ReviewTaskContext } from "./types";
import { makeTask } from "./fixtureBase";

export const reviewCoding: ReviewTaskContext = {
  task: makeTask({ id: "rv1", title: "月度跑批脚本", viewStatus: "ready_for_review", attempt: 2, elapsedMin: 23, spent: { known: true, value: 11.4 }, lastEvent: "verify 三条全过,树已冻结" }),
  packageRefText: "所属:月度运营报表自动化 · 决策包 pkg_01J9… r1",
  acceptance: [
    { criterion: "脚本读 Q2 CSV 生成月度汇总,输出与手工核对一致", status: "pass", source: "verify",
      evidence: { kind: "log", body: "[ok] verify/template: 输出 14 行,与 fixtures/expected.csv 逐行一致\n[ok] verify/run: 退码 0,墙钟 23 分钟\n[ok] 树冻结 treeSha 9c4f…e2" } },
    { criterion: "飞书推送文案不含内部路径与密钥", status: "pass", source: "verify",
      evidence: { kind: "log", body: "[ok] 脱敏扫描 0 命中(token / secret / 绝对路径)" } },
    { criterion: "失败时写清楚原因,不静默退出", status: "pass", source: "agent_claim",
      evidence: { kind: "diff", body: "@@ report/monthly.py @@\n+ try:\n+     df = load_csv(src)\n+ except FileNotFoundError:\n+     fail(\"缺 Q2 数据 CSV,请放进 data/ 后重试\")" } },
    { criterion: "你抽查一行数字对不对", status: "unknown", source: "manual",
      evidence: { kind: "note", body: "这条只能你来。建议抽查 6 月「活跃设备」一行:脚本算的是 12,847。" } }
  ],
  decisions: [
    { what: "汇总口径用「自然月」而不是「账期月」", why: "你说报表是给运营看的,运营按自然月复盘", overridable: true },
    { what: "推送先发到测试群而不是大群", why: "第一次手动跑,先看效果再切", overridable: true }
  ],
  runs: [
    { attempt: 1, result: "settled_failed:CSV 缺列,已补映射" },
    { attempt: 2, result: "settled_review:verify 全过,树已冻结" }
  ],
  explain: {
    one_liner: "跑批脚本按验收标准跑通了,三条机器验全过,就差你抽一行数字。",
    walkthrough: "它先读 data/ 里的 Q2 CSV,按自然月汇总出 14 行,和手工核对表逐行对过;推送文案过了脱敏扫描;失败路径会写清楚原因再退。",
    decisions: "两个判断你都能推翻:汇总口径用自然月;推送先发测试群。"
  }
};

export const reviewWriting: ReviewTaskContext = {
  task: makeTask({ id: "rv2", title: "讲稿正文初稿(writing)", viewStatus: "ready_for_review", riskLevel: "S0", elapsedMin: 31, spent: { known: true, value: 9.8 }, lastEvent: "五个章节全部成稿,人工验收项待你逐条看" }),
  packageRefText: "所属:九月产品发布会讲稿 · 决策包 pkg_01J9… r1",
  acceptance: [
    { criterion: "第一章:开场三分钟内讲清「一句话产品」", status: "unknown", source: "manual", section: "第一章 开场",
      evidence: { kind: "article", body: "各位好。今天我只讲一件事:怎么让 AI 真正把活干完,而不是把活写给你看。\n\n(此处 620 字)" } },
    { criterion: "第二章:两个客户故事,不出现内部代号", status: "unknown", source: "manual", section: "第二章 故事",
      evidence: { kind: "article", body: "第一个客户是一家 30 人的电商公司。他们的运营总监以前每月花两天做报表,现在每月 1 号早上,报表已经在群里等她了。\n\n(此处 890 字)" } },
    { criterion: "第三章:现场演示脚本每步有兜底", status: "unknown", source: "manual", section: "第三章 演示",
      evidence: { kind: "article", body: "现场演示:我现在对它说「把上个月的数据跑一遍给我」。你们注意看三件事:它怎么确认理解、怎么报告进展、怎么把东西交回来等我验收。\n\n(此处 540 字)" } },
    { criterion: "全文 20 分钟语速(约 4800 字)", status: "pass", source: "verify",
      evidence: { kind: "log", body: "[ok] 全文字数 4,762(容差 ±10%)" } }
  ],
  decisions: [
    { what: "砍掉架构图一页,换成 before/after 对比", why: "受众是潜在客户", overridable: true }
  ],
  runs: [{ attempt: 1, result: "settled_review:五章全成稿" }],
  writing: true,
  explain: {
    one_liner: "五章都成稿了,字数达标,前三章要你逐条看。",
    walkthrough: "第一章三分钟讲清一句话产品;第二章两个客户故事;第三章演示脚本带兜底。",
    decisions: "砍了架构图页,换成 before/after 对比——因为受众是潜在客户。"
  }
};

export const reviewS3: ReviewTaskContext = {
  task: makeTask({ id: "rv3", title: "样式实现首版合并", viewStatus: "review_approved_waiting_merge", riskLevel: "S3", elapsedMin: 26, spent: { known: true, value: 8.8 }, lastEvent: "你已验收,等你用本机认证批准合并" }),
  packageRefText: "所属:给 SayDo 重做前端 · 决策包 pkg_01J9… r1",
  acceptance: [
    { criterion: "today 页四色收件箱渲染与 /api/attention 一致", status: "pass", source: "verify",
      evidence: { kind: "log", body: "[ok] 13 条 attention fixture 全色渲染通过\n[ok] 空态「没有需要你的事」不庆祝" } },
    { criterion: "状态词零违规", status: "pass", source: "verify",
      evidence: { kind: "log", body: "[ok] grep 「完成/做完」执行态用法 0 命中" } }
  ],
  decisions: [
    { what: "右栏只做状态呈现,操作留在对话和今天页", why: "防止右栏长成第二看板、两个操作面打架", overridable: true }
  ],
  runs: [{ attempt: 1, result: "settled_review:你已验收(attempt 1)" }],
  s3: true
};
