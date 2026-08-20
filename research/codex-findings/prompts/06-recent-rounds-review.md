# 任务:review 最近三轮改动(执行模式/信息架构/ADR-001/对接 prompt)

你是严苛的对抗性评审员。VoiceLoop 项目(`/Users/wangyixiao/WorkSpace/voice-coding/`)最近三轮对话产生了一批设计改动,请完整 review,产出中文报告。

## 三轮改动的内容(背景)

1. **R21(Demo 反馈落地)**:owner 看 Demo 后提五点——主入口(新对话/选项目)、Dashboard、执行模式两档(直达验收/逐步确认)、模型用户可配置(对话/思考/开发三处)、侧栏按"全局 vs 项目"重组。经两个 subagent 评审后落入 docs/02(§2 主入口与 draft 项目、§2④ 拍板问句、§4 路径表、§5 三正交档位、§5.1 用户可配置性)、04(§5.4 执行模式两档、§5.1 S2 行、§5.2 超时分叉、§4 拦截≠叫人限定、§6 墙钟停表)、03(控制台行、projects.workspace、confirm_and_dispatch 参数)、05(P0 两档、Gate 0 前置句)、06(术语表)、08(§4 schema 加 mode/preauthorizedEffects、§6 信息架构 v2、§7 R10/R11);Demo 重写为 v2。
2. **R22(执行层评估)**:实查 Hopper/OpenClaw-Kit git 近况,评估"复用 vs 全新开发 vs 等待"。
3. **R23(拍板)**:owner 定"复用现状、锁版本、不等待、双路径"→ 新增 `docs/adr/ADR-001-execution-layer.md`(含进度可见性/操作归属设计)与 `research/hopper-integration-request.md`(给 Hopper 会话的对接需求 prompt,13 项);05 §2/§3、08 §5.1、README 回改。

## 待评审文件(全部)

- `docs/02-product-definition.md`、`docs/03-architecture.md`、`docs/04-key-mechanisms.md`、`docs/05-roadmap.md`、`docs/06-references.md`、`docs/08-module-design.md`
- `docs/adr/ADR-001-execution-layer.md`(新)
- `research/hopper-integration-request.md`(新,重点)
- `demo/voiceloop-console-demo.html`(v2)
- `README.md`

## 对照材料

- 你(Codex)此前的两份报告:`research/codex-findings/05-docs-review.md`(文档集评审——检查本次改动有没有把当时已修的 A 级问题改回去)、`research/codex-findings/02-hopper-integration.md`(Hopper 集成审计,基线 main@c4c29c6——**用它核对对接 prompt 里对 Hopper 现状能力的假设是否准确**)。
- 本机 Hopper 仓库(`/Users/wangyixiao/WorkSpace/Hopper/`,只读):如需核实 drop/events/CLI 现状可直接查证。

## 评审焦点(逐项给结论)

1. **执行模式两档的安全一致性**:04 §5.4 的不变量(S3/blocked/熔断/Plan Delta 与档位无关、预授权属决策包)在 02/03/05/08/Demo 全套里是否无矛盾、无表述漏洞?"直达验收"是否存在被解读为绕过 Gate 0 的文字缝隙?
2. **信息架构重排后的一致性**:全局/项目分区、workspace 改名、M/S 术语、`ready_for_review` 口径在所有文件与 Demo 中是否一致?交叉引用是否指对?
3. **ADR-001 质量**:决策-理由-后果是否自洽?进度可见性/操作归属设计(投影表、七类操作、split-brain 规则)有没有漏洞(如 cancel+重 drop 的中间态、外部决策同步竞态、收据与状态的边界)?
4. **对接 prompt 的技术准确性(最重要)**:13 项需求对 Hopper 现状的假设是否与你 02 号报告一致?有没有缺失的关键项(错误码/并发/频率/文件锁礼仪/task-project 映射/安全)或多余项?"我方承诺"是否可执行?
5. **回归检查**:本次改动是否破坏了 05-docs-review 后已修复的任何 A 级问题(状态词纪律、Hopper schema-only 边界、L→M/S 等)?

## 输出要求

- 写入 `/Users/wangyixiao/WorkSpace/voice-coding/research/codex-findings/06-recent-rounds-review.md`(中文)。
- 结构:① 总评(一段);② 问题清单按 **A 硬伤 / B 应改 / C 建议** 分级,每条给文件+位置+问题+改法;③ 对接 prompt 的逐项核对表(13 项 × 与 Hopper 现状的符合度);④ 回归检查结论。
- 区分【事实】(核对过文件/仓库)与【judgement】。不要修改任何文件,只写报告。
