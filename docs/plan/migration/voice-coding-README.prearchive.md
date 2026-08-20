# SayDo(原名 VoiceLoop)

**一个你能对着说话的高级助手**:你只管把事聊清楚(甚至聊的过程中才想清楚),它先吃透项目上下文,听懂了就主动提议开始,驱动本地 AI agent 把事办成,跑完等你验收时叫你。

> 项目定名 **SayDo**(Say=对话,Do=交付),仓库 `github.com/Octo-o-o-o/SayDo`;正式文档已完成更名 sweep(2026-07-23),"VoiceLoop" 旧称仅存于 `research/`、`history/`、`archive/` 历史档案,同指本项目。

- **设计哲学**:对话优先于指令——指令是有损压缩,对话是逐步展开;不要求用户会下指令;AI 是幕僚长,不是指令翻译器。
- **核心循环**:聊(采访 + 自研)→ 就绪自省 → 决策包(成果预览 + 计划 + Demo)→ 人拍板 → 后台执行 → 回叫("等你验收",合并永远人拍板)→ 验收 → 沉淀。
- **落地形态**:SayDo 语音前脑(手机/桌面沟通面)+ Hopper 执行后端(桌面/服务端执行面);自建仅三块独特能力(语音、记忆奠基、采访决断)+ 一个控制面桥。状态分两行:**执行后端 = 已批准(ADR-001)**;**产品载体/部署组合 = proposed,待 owner 拍板**。
- **状态**:**设计/合同高准备度;工程待 Phase -1 硬前置**(含 `hopper-dist`/vault 物理落地、selected-adapter conformance)。执行层已定([ADR-001](docs/adr/ADR-001-execution-layer.md));**首发 = 完整双路径一次交付**(owner 2026-07-23 裁定:Tier1 先行,Hopper 桥契约落地后接续,详见 [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md));**Hopper 对接全部就绪**(2026-07-24:裁决回填 + X1/X3 拍板 + baseline.2 已交付,切锁 commit `bdd1e548…`,词表/harness 附录在 research/);owner 完成 Phase -1(填 key,含 ≥2 家 ASR)即可开工。产品载体路线仍开放,待拍板事项见 [docs/05](docs/05-roadmap.md) §6。

## 文档地图

**正式文档(`docs/`,按顺序读)**:

| # | 文档 | 回答的问题 |
|---|---|---|
| 01 | [背景与问题](docs/01-vision-and-problem.md) | 为什么做、解决什么、凭什么现在能成 |
| 02 | [产品定义](docs/02-product-definition.md) | 给谁用、什么体验、边界在哪 |
| 03 | [系统架构](docs/03-architecture.md) | 怎么分层、用什么技术、部署形态 |
| 04 | [关键机制](docs/04-key-mechanisms.md) | 记忆、就绪决断、审批安全、回叫、执行可靠性 |
| 05 | [落地与路线](docs/05-roadmap.md) | 复用什么、先做什么、风险与未决事项 |
| 06 | [参考资料](docs/06-references.md) | 全部来源、引用、已核实事实 |
| 07 | [技术选型决策](docs/07-tech-stack-decisions.md) | 17 项选型的候选对比、定稿理由、降级路径、spike 清单 |
| 08 | [分模块设计](docs/08-module-design.md) | 25 个模块的总表/依赖规则/信息架构 + 反向校验回改记录(总览与索引) |
| 08+ | [modules/](docs/modules/) 分域详设 | 五份实施视角详设(a 对话/b 记忆/c 控制面桥/d 呈现/e 横切):每模块职责边界/接口引用/失效恢复/§12 测试归属/计划步骤映射 |
| 09 | [数据契约与状态机](docs/09-data-contracts.md) | canonical schema:决策包/预授权/收据/记忆账本/Context Pack/任务与回叫/DDL/配置(实施照抄) |
| 10 | [语音交互与话术规范](docs/10-voice-ux-spec.md) | 话术表、轮次与打断规则、Brain instructions 骨架、摘要输出规格 |
| 11 | [UI 规范](docs/11-ui-spec.md) | 全端视觉与交互合同:design tokens(Soft Glass 体系)/库选型(Tailwind+shadcn+Lucide)/状态→颜色→图标→文案四联映射/组件规范/**零 emoji 门禁** |
| ADR | [ADR-001 执行层](docs/adr/ADR-001-execution-layer.md) | 已批准:复用 Hopper 现状、锁版本、不等待、双路径 + 进度/操作归属 |

**实施**:[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)(分步计划 v2.5:首发 = P0 阶段 Tier1 全闭环 + P0.5 阶段 Hopper 桥/直达验收/Demo,一次交付;经 2 subagent + Codex 三方评审锁版)· [IMPL-PROMPT.md](IMPL-PROMPT.md)(首发实施交接 prompt,**已完成使命**——首发开发 2026-07-25 完成,SayDo 仓 main @ `ed16d72`)· [IMPL-PROMPT-2-CLOSEOUT.md](IMPL-PROMPT-2-CLOSEOUT.md)(收口与交付验证,**已完成**——rc.1 已打)· [IMPL-PROMPT-3-WIRING.md](IMPL-PROMPT-3-WIRING.md)(接线增量批,**已完成**——场次①解锁)· [IMPL-PROMPT-4-EXECUTOR.md](IMPL-PROMPT-4-EXECUTOR.md)(**当前交接:Tier1 生产执行器批**——完整闭环与场次②③④的唯一剩余前置,3–5 人日;2026-07-25 夜进行中,任务 1–4 已交)· [IMPLEMENTATION-PLAN-2.md](IMPLEMENTATION-PLAN-2.md)(**补充实施方案 v1.2 = 首发后唯一排产源**,owner 2026-07-26"第一期全量清偿"指令;W1–W9 + 合同轮 R-A/B/C;经 4 subagent + Codex 19 评审回修;§7 驾驶规程 = 每批临生成 prompt)· [IMPL-PROMPT-6-W1.md](IMPL-PROMPT-6-W1.md)(W1 收尾批,**已收口并对账通过**)· [IMPL-PROMPT-5-PULLFORWARD.md](IMPL-PROMPT-5-PULLFORWARD.md)(W2 提前批,**已收口并对账通过**;E 阶段顺延 W4)· [IMPL-PROMPT-7-W5A.md](IMPL-PROMPT-7-W5A.md)(**当前交接:W5 前段批**——合同就绪子集 + TTS 音色落地;与设计库 R-A 扩容轮并行,W4 等 R-A)· [templates/](templates/)(`saydo.config.example.toml` 五模型槽位 + `saydo.env.example` API key,owner 填写)· [research/hopper-integration-request.md](research/hopper-integration-request.md)(对接 prompt v4,**已发并获裁决终稿**——Hopper 仓 `docs/plan/2026-07-23-saydo-integration-adjudication.fable.md`)。

**演示**:[demo/saydo-console-demo.html](demo/saydo-console-demo.html)——控制台结构示意(完整跳转路径 + Mock 数据,浏览器直接打开;**v5 2026-07-24:按 [docs/11 UI 规范](docs/11-ui-spec.md) 重刷**——Soft Glass 承 OctoBlog 配色、系统字体零 webfont、零 emoji(内联 Lucide SVG)、状态 chip 四联映射、跟随系统的浅/深主题;编排骨架承 atelier 版:七步 stepper/编号导航/kv 网格/S3 浮标卡)。对照稿:`demo/saydo-console-demo-atelier.html`(墨与纸风格,另一模型产出,保留作参考)。

**支撑材料**:

| 目录 | 内容 |
|---|---|
| `research/` | 调研与评审原始报告(竞品扫描、开源选型、本地项目评估、移动连接、Codex 对抗性审查)——docs/ 结论的证据源 |
| `history/` | 过程档案:16 轮协作日志、v1.14 主方案终版、场景需求基线 |
| `archive/` | 历史归档 + 2026-07-22 重写前全量快照 |
| `assets/` | 品牌视觉探索(Saydo 方向) |

## 快速理解(30 秒版)

1. **问题**:人在下指令时思路越来越窄,且多数人给不出好指令;现有 AI 工具没有项目持久记忆、对话不收敛、执行必须人盯着。
2. **答案**:不要求下指令——你只管聊。AI 先奠基(研究透项目)、边聊边备料,每轮自省"知识 + 需求够不够",够了主动端出【成果预览 + 计划(标注人机分工)+ Demo】问"现在开始吗";确认后 agent 在后台隔离执行(有熔断),等验收/卡住时主动叫你(升级链,手机上是来电式汇报);高危操作永远屏幕强认证,语音批不了。
3. **凭什么现在**:实时对话模型与自主执行 agent 在 2026 年同时成熟;每个单点都有成熟实现(证据在 `research/`),已审样本中尚无按同一治理闭环做全者。
