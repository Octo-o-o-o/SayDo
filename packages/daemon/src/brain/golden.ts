// golden 文本注入框架(计划 1.4;10 §6 P0 文本注入级)。
// mock ASR 输出直入 Brain,断言 = 命中 §2 模板要素 + 状态词零违规 + 槽位来自契约字段。
// P0 Phase 1 落 5 条(采访/不置可否/状态词)+ 3 条脱敏反例;完整 ≥20 条随 3.1(真 Pack)/5.3。

import { FORBIDDEN_STATUS_WORDS } from "./instructions.js";

export interface GoldenCase {
  id: string;
  scene: string; // 10 §2 场景编号
  /** 该轮 Brain 应输出的话术(mock;真实模型 golden 在 CI pin 温度 0,此处验模板要素与状态词纪律) */
  utterance: string;
  /** 必须命中的模板要素(全部包含) */
  mustContain: string[];
  /** 禁止出现(除状态词红线外的额外禁词) */
  mustNotContain?: string[];
}

/** 状态词纪律检查(执行状态语境下禁"做完/完成") */
export function checkStatusWords(text: string): { ok: boolean; hit: string[] } {
  const hit = FORBIDDEN_STATUS_WORDS.filter((w) => text.includes(w));
  return { ok: hit.length === 0, hit };
}

export function checkGolden(c: GoldenCase): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const m of c.mustContain) if (!c.utterance.includes(m)) reasons.push(`缺模板要素: ${m}`);
  for (const m of c.mustNotContain ?? []) if (c.utterance.includes(m)) reasons.push(`出现禁词: ${m}`);
  const sw = checkStatusWords(c.utterance);
  if (!sw.ok) reasons.push(`状态词红线违规: ${sw.hit.join(",")}`);
  return { ok: reasons.length === 0, reasons };
}

// P0 Phase 1 golden 5 条(采访 / 不置可否 / 状态词;真 Pack 版随 3.1)
export const PHASE1_GOLDEN: GoldenCase[] = [
  {
    id: "g1",
    scene: "#6 采访提问",
    utterance: "我看报表页已经有分页了,但没有导出。这个导出是给财务对账,还是给用户自己下载?",
    mustContain: ["导出", "?"],
    mustNotContain: ["做完了"]
  },
  {
    id: "g2",
    scene: "#15 用户不置可否 -> 逐步确认",
    utterance: "那我每步问你。",
    mustContain: ["每步问你"],
    mustNotContain: ["一口气跑"]
  },
  {
    id: "g3",
    scene: "#29 ready_for_review 回叫(状态词纪律)",
    utterance: "报表项目的导出功能执行和检查都跑完了,等你验收——改了 5 个文件,测试都过了。现在讲讲,还是你先看屏幕?",
    mustContain: ["执行和检查都跑完了,等你验收"],
    mustNotContain: ["做完了", "完成了"]
  },
  {
    id: "g4",
    scene: "#33 交付(task.done,唯一可说交付)",
    utterance: "合并好了,这件事交付了。",
    mustContain: ["交付了"]
  },
  {
    id: "g5",
    scene: "#11 成本 unknown 分支(数字纪律:不说 0)",
    utterance: "这单的花费我还没有确切数字,跑起来我记账,到 20 元一定停。",
    mustContain: ["还没有确切数字", "20 元"],
    mustNotContain: ["¥0", "0元", "花费 0"] // 防成本报 0(避开"20 元"含"0 元"子串的误判)
  }
];

// M6 话术增补 golden(2026-07-25 外部评审;10 §4-2 承接层 / #42b 深评等待 / §1 变体三档)
export const M6_GOLDEN: GoldenCase[] = [
  {
    id: "m6-1",
    scene: "10 §4-2 采访承接层(提问前 <=半句承接上轮要点)",
    utterance: "好,给财务对账用的——那格式上,Excel 还是 CSV?",
    mustContain: ["好,给财务对账用的", "?"] // 承接要素(复述关键点 <=10 字)在提问前
  },
  {
    id: "m6-2a",
    scene: "#42b 异族深评等待·起",
    utterance: "你说的我都齐了,我评估一下够不够开工——十几秒,别挂。",
    mustContain: ["评估", "别挂"]
  },
  {
    id: "m6-2b",
    scene: "#42b 深评等待·心跳(承诺超 50% 改口)",
    utterance: "比我想的慢一点,还在核。",
    mustContain: ["还在核"]
  },
  {
    id: "m6-2c",
    scene: "#42b 深评等待·插话应答",
    utterance: "嗯,这条我记上,一起评。",
    mustContain: ["记上", "一起评"]
  }
];

// 5.3 覆盖矩阵 golden(10 §6:文本注入级覆盖 §2 全部 P0 场景,含逆风——
// Gate 0 拒绝/预算不足/merge 失败/撤回/不置可否/熔断;与 PHASE1_GOLDEN/M6_GOLDEN 合计 >=20)
export const COVERAGE_GOLDEN: GoldenCase[] = [
  { id: "c1", scene: "#1 预热完成", utterance: "我把项目最近的改动过了一遍,主要是报表模块加了分页。说吧。", mustContain: ["过了一遍", "说吧"] },
  { id: "c2", scene: "#2 奠基中", utterance: "我在读这个仓库的构建脚本,大概还要一两分钟。你可以先说,我边听边学。", mustContain: ["大概还要", "边听边学"] },
  { id: "c3", scene: "#3 draft 转正", utterance: "底子我摸完了:一个 React 报表系统,带导出和权限。我把它建成项目了,叫报表系统,算 coding 类,不合适你说。", mustContain: ["建成项目", "不合适你说"] },
  { id: "c4", scene: "#4 只说项目名(不作改锚授权)", utterance: "我听到你想接着已有项目。请直接说它的本地路径。", mustContain: ["已有项目", "本地路径"], mustNotContain: ["要不要挂到"] },
  { id: "c5", scene: "#5 续接开场", utterance: "接着上次聊——上次说到导出格式,任务还在等你验收。继续这个,还是有新的事?", mustContain: ["接着上次聊", "还是有新的事"] },
  { id: "c8", scene: "#8 连续误听降级打字", utterance: "这个词我连着几次没听准,你在屏幕上敲一下,我把它记进热词。", mustContain: ["没听准", "记进热词"] },
  { id: "c9", scene: "#9 误听纠正", utterance: "收到,是 papaparse。我把它加进热词了,下次会更准。", mustContain: ["加进热词", "下次会更准"], mustNotContain: ["不会错"] },
  {
    id: "c10",
    scene: "#10 就绪提议(最高频句,定稿)",
    utterance: "我这边评估过了,可以开始了。做完你会得到:报表页多一个导出 CSV 按钮。我打算分 3 步,其中 1 步需要你配合——跑数据库迁移要你点头。预计花费 4 元,封顶 20 元。现在开始的话,我按每步问你来跑。",
    mustContain: ["我这边评估过了,可以开始了", "做完你会得到", "封顶", "每步问你"],
    mustNotContain: ["一口气跑完"]
  },
  { id: "c13", scene: "#13 拒绝单条 grant", utterance: "好,改防火墙那条不批——碰到它的时候我会先问你,其他照旧。", mustContain: ["不批", "先问你", "其他照旧"] },
  { id: "c14a", scene: "#14 模式复述·直达(designed/deferred,非现役主动话术)", utterance: "直达验收档本期不开放,我按每步问你来跑。", mustContain: ["每步问你"], mustNotContain: ["一口气跑到等你验收"] },
  { id: "c14b", scene: "#14 模式复述·逐步", utterance: "好,每步问你——改代码、跑测试不会吵你。", mustContain: ["每步问你", "不会吵你"] },
  {
    id: "c16",
    scene: "#16 Gate 0 未关拒绝开工(逆风)",
    utterance: "这单我现在还不能自动开工——安全门禁有一项没配好:执行器审批门。你在屏幕上处理一下,或者这次我陪你手动走。",
    mustContain: ["不能自动开工", "安全门禁", "屏幕上处理"]
  },
  {
    id: "c17",
    scene: "#17 预算不足(逆风)",
    utterance: "这单封顶要 50 元,这个月预算只剩 12 元。要么缩范围,要么你调预算再来。",
    mustContain: ["封顶", "只剩", "缩范围"]
  },
  { id: "c18", scene: "#18 preflight 失败", utterance: "开工前查了一圈:没插电源,后台跑一半可能断。处理好我再派。", mustContain: ["开工前查了一圈", "处理好我再派"] },
  { id: "c19", scene: "#19 S2 确认(逐步档)", utterance: "报表这边,我需要跑数据库迁移、只动 reports 表,可以吗?", mustContain: ["我需要", "可以吗"] },
  {
    id: "c20",
    scene: "#20 S3 导航·P0 降级版(绝不语音放行)",
    utterance: "这轮我先不做这一步,你之后在屏幕/终端自己操作,或者告诉我换个做法绕开。",
    mustContain: ["先不做这一步", "屏幕/终端自己操作"]
  },
  { id: "c21", scene: "#21 步骤边界确认", utterance: "第 2 步跑完了——改了 3 个文件,测试 12/12。继续第 3 步吗?", mustContain: ["步跑完了", "继续第"], mustNotContain: ["做完了"] },
  { id: "c23", scene: "#23 用户问进度", utterance: "跑了 18 分钟,在第 2 步改导出模块,目前没卡。", mustContain: ["跑了 18 分钟", "目前没卡"] },
  { id: "c24", scene: "#24 改需求·Tier1 steer", utterance: "收到,我把新要求直接塞给它,这轮不作废接着跑。", mustContain: ["这轮不作废"] },
  { id: "c26", scene: "#26 Plan Delta 重授权", utterance: "跑的时候发现要改验证命令,超出你批的范围了。变更我放屏幕上,你批了才继续。", mustContain: ["超出你批的范围", "你批了才继续"] },
  { id: "c27", scene: "#27 切档·升档必重念(designed/deferred)", utterance: "好,盯紧点,之后每步问你。", mustContain: ["每步问你"], mustNotContain: ["一口气跑"] },
  {
    id: "c28",
    scene: "#28 熔断触发(逆风;用户语转译,不念墙钟/回合)",
    utterance: "报表导出到上限了——跟模型来回的次数满了,我先停了,花了 6 元。要继续得你点头。",
    mustContain: ["到上限了", "我先停了", "要继续得你点头"],
    mustNotContain: ["墙钟", "回合数"]
  },
  { id: "c29b", scene: "#29b 返工(这轮不作废)", utterance: "收到——表头要中文。这轮不作废,我让它在原来的基础上改,改完再叫你。", mustContain: ["这轮不作废", "改完再叫你"] },
  {
    id: "c30",
    scene: "#30 blocked 回叫·agent 提问来源(逆风)",
    utterance: "报表导出的 agent 问:目标数据库是 MySQL 还是 PostgreSQL?",
    mustContain: ["agent 问"]
  },
  { id: "c31", scene: "#31 failed 回叫(逆风)", utterance: "报表导出失败了,环境问题,我自动重试过 2 次没成。我建议等你看。", mustContain: ["失败了", "我建议"] },
  { id: "c32", scene: "#32 merge 失败(逆风)", utterance: "合并时跟主分支冲突了,agent 在解;解不动我开 PR 转给你。", mustContain: ["冲突了", "转给你"] },
  { id: "c34", scene: "#34 取消确认(cancel_settled)", utterance: "停了,这轮作废。改过的东西我留在工作区没动,想捡回来说一声。", mustContain: ["停了,这轮作废", "想捡回来说一声"] },
  { id: "c35", scene: "#35 停靠老化取消", utterance: "数据库索引重建停靠三天没等到你,按规矩我取消了,内容转成草稿,想重启随时说。", mustContain: ["停靠三天", "转成草稿"] },
  {
    id: "c38",
    scene: "#38 撤回两阶段(逆风;proof 前不说删掉了)",
    utterance: "刚才那段我先标记不再记、正在删。",
    mustContain: ["先标记不再记", "正在删"],
    mustNotContain: ["删掉了"]
  },
  {
    id: "c40",
    scene: "#40 订阅限流(07 D18:不静默转计费)",
    utterance: "你的 Codex 订阅这个时段的额度用完了——切成按量计费继续,还是等额度重置?",
    mustContain: ["额度用完了", "还是等额度重置"]
  }
];

// P0.5 收尾 golden(路径二/分诊场景)。#12 直达念清单 = designed/deferred,不进正式 active golden。
export const P05_GOLDEN: GoldenCase[] = [
  {
    id: "p05-39",
    scene: "#39 运行中 S2 播报(A8,只播 E2 签名件)",
    utterance: "报表导出这边要装 papaparse 这1个依赖,可以吗?",
    mustContain: ["要", "可以吗"]
  },
  {
    id: "p05-25",
    scene: "#25 改需求·路径二(cancel-new-run)",
    utterance: "改可以——不过正在跑的这一轮会作废,我取消后按新要求重新排。确认改吗?",
    mustContain: ["这一轮会作废", "确认改吗"]
  },
  {
    id: "p05-30h",
    scene: "#30 blocked 回叫·分诊判高风险(Hopper 维)",
    utterance: "这单的内容被判高风险,涉及删数据,我不会自动跑——要么改说法降风险,要么转成逐步盯着做。",
    mustContain: ["判高风险", "不会自动跑"]
  }
];

// W2 场次①(2026-07-26 dogfood 首日)现场反例组:
// B1 缓解:空证据账本被判就绪(rules 层对空 dims 空真放行,凭空产出决策包)——**known-gap**:
//   行为级硬闸(空账本 fail-closed)是 canonical dims 最小构造语义的事(设计库补丁在途,
//   w1-batch §4 诚实边界),实施侧不自定;此处只锁"未问清先不提议"的话术形态。
// B2 缓解:tasks 全空却播出 settle 回叫话术("等你验收")——结果类句式只应由回叫链(C4)
//   驱动;对话 LLM 自发念 = fail(instructions 第 13 条 + 本组反例)。
export const SESSION1_GOLDEN: GoldenCase[] = [
  {
    id: "s1-b1",
    scene: "#42-gap 空证据账本不提议(known-gap:正式闸等 canonical dims 合同)",
    utterance: "这事我还没问清楚目标和验收标准,先不提议开工——先回我两个问题:做完什么样算成,以及不能动哪些东西?",
    mustContain: ["先不提议开工", "?"],
    mustNotContain: ["可以开始了", "等你验收"]
  },
  {
    id: "s1-b2",
    scene: "#43-gap 无任务无回叫时问进展(结果句式只归回叫链)",
    utterance: "现在没有任务在跑。想开工的话,先把要做的事跟我说清楚。",
    mustContain: ["没有任务在跑"],
    mustNotContain: ["等你验收", "交付了", "跑完了"]
  }
];

// W4 3.3 golden 扩位(10 §6:writing/S3 卡场景;S3 导航 #20 卡片 P1 版 + content_done 完成话术 + writing 回叫)
export const W4_GOLDEN: GoldenCase[] = [
  {
    id: "w4-20p1",
    scene: "#20 S3 导航·P1 卡片版(绝不语音放行;导航到屏幕本机认证)",
    utterance: "这一步是把文章并到发布分支,语音里批不了。确认卡在屏幕上,用本机认证批准。我念一下将发生什么:把这版稿子合进 main。",
    mustContain: ["语音里批不了", "用本机认证批准", "我念一下将发生什么"],
    mustNotContain: ["做完了", "已合并"]
  },
  {
    id: "w4-content-done",
    scene: "#29 content_done 完成回叫(writing 成稿;状态词纪律,回叫链驱动)",
    utterance: "章鱼科普那篇执行和检查都跑完了,等你验收——成稿 2/2 节,2 项验收待你逐条过目。现在过目,还是先看屏幕?",
    mustContain: ["执行和检查都跑完了,等你验收", "成稿", "待你逐条过目"],
    mustNotContain: ["做完了", "完成了", "交付了"]
  },
  {
    id: "w4-writing-callback",
    scene: "#21 writing 逐节停靠回叫(step_confirm;seq 映射大纲节)",
    utterance: "第 1 节引言成稿了——大纲第一节写完了。继续第 2 节吗?",
    mustContain: ["节", "继续第"],
    mustNotContain: ["做完了"]
  },
  {
    id: "w4-content-merge",
    scene: "#33 writing 交付(文章并回主分支,唯一可说交付)",
    utterance: "稿子合进主分支了,这篇交付了。",
    mustContain: ["交付了"]
  }
];

/** M6③ 变体三档·自由池纪律:禁连续两轮同词开头(golden 按档断言) */
export function checkNoRepeatedOpeners(turns: string[]): { ok: boolean; violation?: string } {
  for (let i = 1; i < turns.length; i++) {
    const prev = (turns[i - 1] ?? "").trim().slice(0, 1);
    const cur = (turns[i] ?? "").trim().slice(0, 1);
    if (prev !== "" && prev === cur) {
      return { ok: false, violation: `连续两轮同词开头: "${prev}" (turn ${i - 1}/${i})` };
    }
  }
  return { ok: true };
}
