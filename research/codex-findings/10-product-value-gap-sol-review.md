## 总评

**Conditional Go。** 报告抓住了一个有力的产品假设：SayDo 的长期价值不是“语音写代码”，而是降低从模糊意图到可验收交付全过程中的主动注意力；语音是入口，记忆是复利资产，合同、安全与恢复是可信委派的必要底座。这与现有“规格由 AI 生成、认知负担从表达转向判断”的哲学一致（`docs/01-vision-and-problem.md:37-45`）。但当前稿还不能直接作为 owner 决策或实施基线：Value Gate 的样本和通过规则不能支撑其精确结论；单路径 V1 把自己认定的最低恢复能力推迟了；若干 owner 已裁决范围被隐含改写；8 项漂移中有两项已被后续文件更新部分修复，另漏掉了更严重的当前契约缺口。完成下列 A 级最小修订后可交付，不需重写全文。

## A 级硬伤

1. **Value Gate 即使核心假设失败，仍可能被判通过。**

   - **事实**：主问题是减少主动人类分钟与返工（`research/saydo-product-value-and-gap-analysis-sol.md:474-480`），但北极星只统计“被验收任务”（`:531-534`），会排除失败、放弃、超时和未验收任务；通过规则又允许北极星未达标时，用三个次级指标中的两个替代（`:544-549`）。
   - **判断**：这是幸存者偏差和 Goodhart 空间，且与“唯一主问题”自相矛盾。
   - **最小修订**：改成 intent-to-treat 口径，所有预注册 eligible attempts 均进入分母；把“成功率不劣 + 全体任务主动分钟下降”设为共同主门，合同、first-pass、review 只用于诊断，不能替代主门。

2. **样本、周期和阈值互不相容，不能称为可证伪 Gate。**

   - **事实**：内部门只有 10–15 个任务，外部门累计至少 20 个（`:482-498`）；Phase V 只有 5–7 个工作日（`:566-580`），但复用指标从第 2 周起记录（`:541`）。报告一边说小样本“不假装统计显著”（`:525`），一边又用“显著改善”、`+10pp`、false-ready `<5%/<1%` 作为通过口径（`:537-547`）。
   - **判断**：20 个样本即使零 false-ready，在独立 Bernoulli 近似下，真实率的单侧 95% 上界仍约 14%，无法证明 `<5%`，更不能证明 `<1%`；3–5 位用户的多任务也不能当成 20 个独立用户样本。历史红队提出的 readiness corpus 本来就是独立的大样本轨道（`research/codex-findings/01-architecture-redteam.md:811-824`），不能缩成 20 个自然任务。
   - **最小修订**：把 5–7 天改名为探索性 desirability gate，只输出配对差值、计数、区间和失败类型；false-ready、安全故障注入、严重错误检出另设扩样 Gate；复用改为 2–4 周自然任务机会观察。

3. **V1 的最低异步可靠性分期自相矛盾，并漏掉当前更严重的契约硬卡。**

   - **事实**：报告先把 durable state、崩溃对账和回叫去重列为无人值守最低线（`:386-399`），V1 却只留“最小 outbox”（`:597-605`），并把 crash replay、callback 去重和完整 recovery 后移到 V2（`:618-627`）；与此同时，V1 承诺用户可以离开并接收 blocked/ready 回叫（`:424-451`、`:454-465`）。
   - **当前事实**：正式计划已把 Tier 1 journal、崩溃注入、启动对账和 outbox 去重放进 P0（`IMPLEMENTATION-PLAN.md:56`、`:101-105`）。更严重的是，当前 `docs/09` 仍明确列出 presentation、hard-forget、运行中 S2 presentation 三项未封闭（`docs/09-data-contracts.md:624-635`），而 P0 已使用 hard-forget 和最小 S2 barge-in（`IMPLEMENTATION-PLAN.md:80`、`:102`）。
   - **最小修订**：V1 必须保留 durable run mapping、startup reconcile、settle proof、cancel proof、callback active dedupe、package/receipt 绑定和实际存储的数据删除；只把 Hopper 跨域恢复、复杂重放和规模化恢复后移。Cursor CLI 还须按其“仅 shell hook、无 OS sandbox”的真实能力收窄承诺（`docs/03-architecture.md:110-116`）。

4. **方案实际要求重裁的不止“双路径首发”。**

   - **事实**：owner 已裁定首发一次交付包含 Tier 1、Hopper、直达验收和 Demo 生成器（`IMPLEMENTATION-PLAN.md:4-7`、`:122-135`；`docs/adr/ADR-001-execution-layer.md:7-18`）。报告承认双路径需重新拍板（主报告 `:660-669`），却在 V1 禁用 Demo（`:607-616`），V3 只恢复 Hopper/直达验收（`:636-646`），没有恢复 Demo。
   - **当前事实**：首次奠基阻塞式是 owner 明确裁决（`docs/04-key-mechanisms.md:22-27`）；当前路线已为“已奠基项目”增加 Quick 兜底，同时明确纯文字/无障碍模式不进 P0（`docs/05-roadmap.md:87-89`）。报告提出全面渐进式 grounding、完整文字侧通道和两页 IA，均是范围变更，而不是普通修错。
   - **最小修订**：在第 12 节 owner 决策表中补入“阻塞式奠基、文字侧通道/无键盘验收、IA、Demo 生成器”四项重裁；把单路径 V1 统一称为“研究/dogfood slice”，不能暗写为新的首发定义。

## B 级应改

1. **“真正价值”方向成立，但应降格为最高优先级假设。** 当前文档支持“不是输入法、不是模型竞争，核心在 context 与协作流程”（`docs/01-vision-and-problem.md:8-10`），但没有用户数据证明报告的购买理由。建议拆清：用户价值是少操心、少返工、易验收；合同、安全和恢复是信任底座；记忆是待验证的留存复利；语音是必要的行为 wedge，但不是单独护城河。将“真正价值”“用户购买的是”改为“核心价值假设”。

2. **把 Hopper 与 Cursor/Claude/Codex 并列为“可替换供给”是架构类别错误。** 模型和 adapter 可以在能力合同内替换；Hopper 当前承载 runner、worktree、事件真相、恢复、预算与闸门，并拥有执行域状态（`docs/03-architecture.md:28-42`）。应改成：“产品身份不依赖某一模型或 adapter；Hopper 是当前批准的重执行控制边界，替换它是架构迁移，不是普通 provider 切换。”

3. **首发 persona 合理，但 wedge 还不够可操作。** 报告选择 AI-native 技术型 owner 是正确的（主报告 `:174-194`）。更强的首轮任务 wedge 应收窄为：熟悉且测试健康的 brownfield repo、边界明确但存在少量真实取舍、具备机械 oracle、无外部副作用、用户当天确实想切走注意力。强制“至少两个未知”（`:489-498`）会富集最利于采访的任务；应登记全部自然任务机会和排除理由，并保留一组中等清晰任务。另需排除 flaky/no-test repo、secret-heavy/受监管仓、跨 repo、外部调研型任务。预计执行 2 小时也需解释为总历时，因为当前单 attempt active fuse 默认 45 分钟（`docs/04-key-mechanisms.md:182-184`）。

4. **Review 缺口被夸大成“计划里主要只有一行”。** 当前 canonical 已明确 review 是异步执行的真实瓶颈且必须进 P0（`docs/05-roadmap.md:81-86`），模块设计也已有任务详情 evidence view（`docs/08-module-design.md:175-187`）。真正缺的是 criterion→evidence 的完整结果合同、严重错误检出实验、比较/返工体验，而不是项目尚未认识到 review。

5. **实验操作仍有明显混杂和 Goodhart。**

   - 真实任务不可重复，应在 eligibility 冻结后按用户内、模糊度分层随机分派，而不是主观“配对”。
   - 基线没有天然的 approved package，应把等价终点定义为“用户发出最终可执行任务的时刻”。
   - Wizard-of-Oz 必须分别统计用户分钟、operator 分钟、机器成本和壁钟时间；否则高水平人工 interviewer/reviewer 会买出漂亮结果。
   - “问题是否改变 package”可被微改动刷分；应由盲评者判断是否实质改变决策或降低关键风险。
   - first-pass acceptance 不能替代正确性；报告提出的植入缺陷应正式进入实验协议（主报告 `:292-305`）。
   - 整体 SayDo 对基线不能识别语音贡献；若要回答语音作用，应追加同一流程内 voice/text intake 的小型消融，而不是从总结果反推。

6. **“过度设计”章节判断大体正确，但实施顺序违反了自己的结论。** 可后移的是多 provider 全矩阵、11 路由全面开放、多项目/团队、移动端、多领域、全成本表盘、每任务 Demo 和 readiness 总分 UI。不能后移的是 revision/digest、receipt、独立 oracle、worktree、secret/egress、run mapping、reconcile、settle、callback dedupe、S3 边界及实际数据的删除。模型槽位可以隐藏高级配置，但 evaluator 异族隔离和合同生成角色不能删除（`docs/07-tech-stack-decisions.md:19-27`、`:216-220`）。

7. **数处推断写成了事实或承诺。**

   - “新的产品证据”（主报告 `:662`）实际是分析推断；现有路线早已记录“战略 Conditional Go、先窄闭环”的旧评审结论（`docs/05-roadmap.md:45`），本轮没有新增用户数据。
   - “27–36 工程日”应写成文档估算下限；计划明确 21–27 日不含合同回修、owner 场次和评审开销（`IMPLEMENTATION-PLAN.md:145`）。
   - 3–5 位外部用户主动复用只能降低“单人定制”风险，不能“证明”外部产品成立（主报告 `:727-731`）。
   - 失败分叉表（`:551-560`）中的“含义”应改为“首选解释/下一步区分实验”，避免把相关性写成单因果。

## C 级可选

- “一个用户、一个场景、一个适配器、一个任务”（主报告 `:46-49`）改成“一个任务 archetype、同一时刻一个任务”，避免与 10–15 个实验任务冲突。
- 一行改动和大型重构是边界样本，不是严格意义上的“负对照”（`:498`）。
- “完整阅读 93 个文件”（`:55-66`）建议附可复现清单或弱化为过程说明。
- Decision Card/Review Card 可保留作为 UI 名称，但应明确底层仍分别引用 canonical `DecisionPackage@revision` 与 result/evidence contract，避免再造合同类型。

## 核验表：报告所列 8 项漂移

> 以本次最终读取到的当前文件为准。历史 `Codex 08` 自己声明了固定快照与哈希（`research/codex-findings/08-plan-review.md:7-14`），其旧 No-Go 状态没有被直接冒充当前状态。

| # | 报告所列漂移 | 当前结论 | 当前证据与校正 |
|---:|---|---|---|
| 1 | `TaskCard.route` 无法表达 Cursor CLI | **成立** | 当前类型仍只允许 Claude SDK/Hopper，且 `adapter` 还是可选（`docs/09-data-contracts.md:221-235`）；DDL CHECK 同样只允许两值（`:380-386`），而计划以 Cursor CLI 为 dev 默认（`IMPLEMENTATION-PLAN.md:101`）。A 级排序成立。 |
| 2 | 能力矩阵仍把 Cursor 固定为 Tier 2 | **部分成立** | 当前 `docs/03` 已改为 Cursor CLI hook 支持 Tier 1（`docs/03-architecture.md:106-117`），所以报告对 `docs/03` 的断言已不成立；但 `docs/07` 总表仍写 Cursor SDK Tier 2（`docs/07-tech-stack-decisions.md:23-27`），其正文又正确写 Tier 1（`:111-119`），并残留“无法不用 Claude”（`:216-221`）；`docs/05` 仍把 Cursor 放 P1/Tier 2（`docs/05-roadmap.md:91-94`）。当前宜由 A 降 B。 |
| 3 | ADR 路径一硬编码 Claude SDK | **部分成立** | ADR 确实仍叫“Claude SDK 薄执行器”（`docs/adr/ADR-001-execution-layer.md:16-18`）；但 Claude 仍是产品缺省，Cursor 是 dev 缺省（`IMPLEMENTATION-PLAN.md:52`、`:101`），故不是完全错误，主要是路径名未反映 adapter 抽象。B/C。 |
| 4 | `docs/08`、`docs/10` 表内阶段与顶部横幅冲突 | **成立** | `docs/08` 顶部称 C1/C3/Hopper/Demo 属 P0.5（`docs/08-module-design.md:5`），表内 C1/C3 仍标 P0（`:47-50`）；`docs/10` 顶部明确 #12/#25/#27/#30/#32/#39 属 P0.5（`docs/10-voice-ux-spec.md:5`），表内仍多处写 P0（`:43`、`:61-63`、`:72-74`）。B 级正确。 |
| 5 | `docs/05` 仍写 P0 2–3 周 | **成立** | 当前仍为 2–3 周（`docs/05-roadmap.md:74`），计划唯一口径是 P0 21–27 工程日，另有 P0.5 6–9 日（`IMPLEMENTATION-PLAN.md:122-145`）。但 `docs/05:5` 已明确计划优先，故是 B/C，不是阻断。 |
| 6 | README“实施就绪”过强 | **部分成立** | README 同一行既写“实施就绪”，也明确需 owner 完成 Phase -1 才开工（`README.md:10`），因此不存在报告所称的直接逻辑矛盾；但当前仍有 key、仓库、dogfood 等前置（`IMPLEMENTATION-PLAN.md:15-20`）和 A2/A6/A8 未闭合（`docs/09-data-contracts.md:624-635`），状态措辞确实偏乐观。Value Gate 是新建议，不能作为“当前漂移”证据。 |
| 7 | TTS“定稿”与计划“定档 spike”冲突 | **成立** | seed-tts-2.0 已定档，余项仅调参（`docs/07-tech-stack-decisions.md:71-81`），计划仍写 ASR/TTS 两家跑分后定档（`IMPLEMENTATION-PLAN.md:66`）。属 C 级命名/验收口径错误。 |
| 8 | Demo 分期标记不足 | **部分成立** | 规则要求所有超出 P0 的元素就地标期（`AGENTS.md:17-20`）；当前 Demo 仅有全局提示（`demo/saydo-console-demo.html:281`），marketing 项目（`:294`、`:370`）、直达验收（`:468-476`）和 S3 Touch ID 卡（`:594-607`）均没有对应 P2/P0.5/P1 徽标。报告所称“Hopper 出现在主体”是误报：本次执行 `rg -n 'Hopper' demo/saydo-console-demo.html` 为 0 命中；报告引用的 `demo:122` 在当前文件也已不是 banner。保留 B，但缩小事实陈述。 |

表外漏报中，严重性高于 TTS/README 的有：

- `docs/09` 同时宣称 Tier 1 可照抄，又把 P0 已依赖的 A2/A6/A8 留作未封闭项（`docs/09-data-contracts.md:3-6`、`:624-635`）。
- “至少一次 + dedupe”同时承诺“重复 ≤1 次”没有机制保证；发送成功、状态落盘前连续崩溃可重复多次（`docs/09-data-contracts.md:308-311`）。
- `issueDispatchReceipt` 在工具契约中重复声明（`docs/09-data-contracts.md:583`、`:616-617`）。
- `IMPL-PROMPT` 主循环仍写 Claude SDK，末尾才改称 Cursor CLI 为 dev 默认（`IMPL-PROMPT.md:17-19`、`:47`），会误导新实施会话。

## 建议的最终结论

1. **保留**“对话驱动的可信委派”方向；**修改**为待验证的核心价值假设，而非已成立事实。
2. **保留**语音作为必要的低摩擦行为 wedge；**修改**为语音、屏幕、文字各司其职，P0 范围变化须由 owner 重裁。
3. **保留**可信项目记忆的长期复利判断；V1 至少保留 source-bound 当前事实与人工批准的 M1 决策，自动提炼和 M0/M2/M3 扩张后移。
4. **保留**AI-native 技术 owner；将首轮 wedge 收窄到熟悉、测试健康、可机械验收、无外部副作用的重复 brownfield 任务。
5. **修改** Value Gate 为三层：5–7 日 desirability、最低自动化/安全 spine、2–4 周自然复用；不得用第一层外推完整异步产品成立。
6. **保留**单 Tier 1 作为 dogfood slice；它不能自动改写“完整双路径 + Demo 同次首发”的 owner 裁决。
7. **不得后移** run/recovery/settle/callback dedupe、receipt、worktree、secret/egress、hard-delete 与 S3 边界；只能后移跨域和规模化复杂度。
8. **保留并加强** Decision Card ↔ Review Card 一一对账；review 成为与采访同权重的产品半边。
9. **后移**多 provider 全矩阵、完整 Dashboard、移动端、多领域、全任务 Demo 和 readiness 总分 UI，但保留底层稳定合同与 evaluator 独立性。
10. **开工前先修**当前 route、capability/phase、A2/A6/A8 和 outbox 语义漂移；README/TTS/Demo 文案排在其后。

本次全程只读，未修改任何文件。