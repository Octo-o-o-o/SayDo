# SayDo 评审实施后 SOL 独立复评

## 总判：Conditional Go

可以进入 Phase 0，但须先完成下述 A0 最小回修；不需要等待 SourceResolver、价值实验、完整 docs-lint、feature manifest 或 Demo phase selector 才开工。

owner 已明确保留 v2.3 完整 P0 + P0.5 首发，价值证据不设 stop/go 门；当前 canonical 也明确 Phase 4 起受控 dogfood、Phase 5 才完成 P0、P0.5 收尾才算首发交付（`docs/05-roadmap.md:114-124`；`IMPLEMENTATION-PLAN.md:108-138`）。本复评不建议裁剪这一范围。

截止点应严格分开：

- Phase 0 前：修 authority、P0 状态/DDL、Phase -1 分档、配置合同。
- Phase 3 的 3.2 前：封闭 SourceSnapshot/SourceVerification。
- Phase 4 出口开始 dogfood 前：冻结价值指标口径。
- P0.5 前：修 Hopper 改需求语义、分期和 capability 漂移。
- 工程验收、owner 自用价值、外部泛化、安全校准必须分别陈述；主报告对此区分正确（`research/saydo-post-review-reassessment-sol.md:148-153,870-876`）。

## A 级硬伤（必须修）

### A0-1 · 实施 prompt 正在授权 contract fork

项目纪律规定 `docs/01–10 + adr/` 是唯一 canonical，Demo 也必须服从 canonical（`AGENTS.md:15-20`）；计划正文同样要求先回写设计再改代码（`IMPLEMENTATION-PLAN.md:8-10`）。但交接 prompt 明确规定步骤表与 `docs/09` 冲突时步骤表胜出，只需登记 evidence（`IMPL-PROMPT.md:17-19`）。`docs/05`、`docs/08` 又以横幅把分期权交给计划（`docs/05-roadmap.md:5`；`docs/08-module-design.md:5`）。

推断：实施者可合法选择不一致的一边，后续 schema、话术和测试将继续分叉。

必须在发送 prompt 前改成：

- `docs/09` 管字段、状态、校验和工具签名；
- `docs/10` 管话术；
- `docs/05` 管产品范围与分期；
- ADR 管架构取舍；
- 计划只管实施顺序。
- 发生实质冲突时仅暂停该冲突项，先回写 canonical；不相关步骤继续，不造成全项目停摆。

主报告关于 authority 冲突的诊断采纳，但“不做完整 canonical freeze 就不开工”的扩大解释不采纳。计划本身已允许按 Phase 回写并评审（`IMPLEMENTATION-PLAN.md:163-168`）。

### A0-2 · P0 状态合同仍有不可实现返回值，DDL 也未达到计划声称的约束强度

`reviewTask` 的 reject 返回 `"rejected"`，但 `TaskCard.status` 没有该枚举，状态转换表也没有对应边；现有 Hopper 映射把 rejected 投影成 `failed`（`docs/09-data-contracts.md:226-228,239-261,341,622-624`）。

此外，`docs/09` 将 P0 DDL 标为可照抄，而计划要求 SQLite 用 CHECK/NOT NULL 拒绝非法直写（`docs/09-data-contracts.md:3-5`；`IMPLEMENTATION-PLAN.md:55-58`）。当前实际情况包括：

- `tasks.status` 没有枚举 CHECK（`docs/09-data-contracts.md:387-395`）；
- `decision_packages` 多个 TS 必填字段在 DDL 中可空（`docs/09-data-contracts.md:369-371`）；
- `callback_outbox.trigger/state` 没有 CHECK（`docs/09-data-contracts.md:418-422`）。

推断：直接照抄会让数据库接受类型合同禁止的状态，并使崩溃恢复路径依赖未定义的 DAO 假设。

最小修法：

1. reject 统一落 `failed`，或全链正式增加 `rejected`；前者改动更小。
2. 明确哪些不变量由 DB 强制、哪些只由 Zod/DAO 强制；把 P0 状态、收据、outbox 的安全关键枚举和必填关系机械化。
3. 同步计划 0.3 的验收语义，避免宣称“任意非法行均由 SQLite 拒绝”而实际只校验少数字段。

这是主报告漏掉的 A0。

### A0-3 · Phase -1 的阻塞分档会同时造成“误停”和“漏跑”

计划已写明 Hopper 独立副本/vault 尚未落地，且它是 0.5 手动 PoC 的真实前置（`IMPLEMENTATION-PLAN.md:20`）；同一文件随后却称 D “仅剩 Hopper 批次 A 排期”（`IMPLEMENTATION-PLAN.md:23`），交接 prompt 也只把批次 A 当可挂起项（`IMPL-PROMPT.md:5,23`）。与此同时，0.5 明确不属于 Phase 0 出口条件（`IMPLEMENTATION-PLAN.md:59-61`）。

正确分档应为：

- Phase 0 开工硬门：仓库、基础环境、至少一个 selected adapter、当前 Phase 所需凭据和 fixture。
- 进入 0.5 前：`hopper-dist`、专用 vault、SHA/tag 断言。
- Phase 1 前：音频底板。
- P0.5 前：Hopper 批次 A 或已批准兜底合同。

因此，主报告“真实完成整个 Phase -1 后才进入 Phase 0”的建议过宽；但它指出 prompt 会漏掉 Hopper 物理落地是正确的。

### A0-4 · 配置 parser 开工前仍有两个互斥合同

canonical 示例使用 `[voice] tts = "volc"`，模板使用 `[voice.tts]` 子表（`docs/09-data-contracts.md:501-504`；`templates/saydo.config.example.toml:58-70`）。setup 仍是未定义 shell 语义的自由字符串，也没有 `--ignore-scripts`（`docs/09-data-contracts.md:532-545`），而实际安全要求已经是默认禁止 lifecycle scripts（`IMPLEMENTATION-PLAN.md:101-103`）。

必须在计划 0.4 配置解析前统一为一种结构，并把 setup 改成 argv + cwd；如开放 lifecycle scripts，须另走 S2、冻结 manifest digest 并执行前复验。

主报告对 generic config 和 env 的 Cursor 分期判断成立（`templates/saydo.config.example.toml:39-43`；`templates/saydo.env.example:23-25`），但 dev 模板已经正确选择 Cursor CLI（`templates/saydo.config.dev.example.toml:21-26`），不应笼统写成“两份模板都漂移”。

### A3 · SourceResolver 问题成立，但主报告给出的合同仍不可实施

当前 `SourceRef` 只是 `kind + ref:string + quote?`，没有 snapshot identity、原始 digest、编码、版本、信任等级或保留期限（`docs/09-data-contracts.md:184-188`）。`assessReadiness` 也没有 source verification 输入输出（`docs/09-data-contracts.md:606-607,655`），而 evaluator 产品态要求零工具和读禁闭（`docs/07-tech-stack-decisions.md:198,230-234`）。

主报告提出的 `SourceVerification` 只有 digest 元数据和 `excerptDigest`，没有供 evaluator 判断语义的 excerpt 内容；但随后又要求 evaluator 判断“原文是否支持 claim”（`research/saydo-post-review-reassessment-sol.md:289-331`）。这是合同内部断链。

还缺少：

- canonical locator：路径归一化、symlink/no-follow、repo blob/commit、URL redirect/content-type；
- TOCTOU：hash 与取 excerpt 必须来自同一 fd、Git blob 或不可变 snapshot；
- snapshot retention：只有 digest 无法重放语义判断；
- resolver trust：谁捕获 expectedDigest、resolver 权限和版本如何证明；
- integrity、freshness、source credibility 三者分离；
- prompt-injection 防护：零工具只能限制副作用，不能防恶意原文操纵 readiness 判断；
- `agent_output` 不得作为 critical claim 的唯一支持源；
- evaluator model、prompt digest、snapshot/excerpt 和 verdict 的完整 replay 记录。

最小合同应至少拆成 `SourceSnapshot`、`VerifiedExcerpt`、`ClaimSourceVerification`，并把字节一致性、时效性、是否具备 critical-support 资格分成独立字段。该项必须在 3.2 前完成，但不阻塞 Phase 0。

### AD · 指标诊断正确，替代指标仍只能作为观察性漏斗

现有 canonical 把 eligible dispatch 称为 intent-to-treat，并把审批等待和 review 日历跨度计入主动分钟，确实不成立（`docs/05-roadmap.md:114-121`）。

主报告新增 opportunity log 是正确方向，但仍有三个问题：

1. `SayDo verified outcomes / all opportunities` 本质是 adoption × 后续成功漏斗，不是因果意义的 outcome effect（定义见 `research/saydo-post-review-reassessment-sol.md:476-504`）。
2. 手工登记仍有漏记和事后 eligibility 调整风险；P0→P0.5 capability 变化也会改变分母。此处是基于分期变化的推断（分期事实见 `IMPLEMENTATION-PLAN.md:30,125-138`）。
3. “foreground screen interaction”没有 idle cutoff、并行任务归属和缺失值规则，仍不能直接称为主动分钟（`research/saydo-post-review-reassessment-sol.md:518-533`）。

dogfood 前应固定：登记发生在选工具前、`eligibility_rule_version`、当时 capability、纳入/排除原因不可回改、缺失机会计数、主动分钟 sessionization 和基线匹配规则。5–10 个基线任务只能叫描述性参照，不能使用“非劣”表述；主报告对此后半段已有正确限定（`research/saydo-post-review-reassessment-sol.md:535-545`）。

这不阻塞工程和 P0.5，只阻塞价值解释与对外 claim。

### A5 · 主报告漏掉 ADR 内部仍存在的路径二改需求冲突

ADR 新附注说改需求以 `docs/09` 的同卡修订为准（`docs/adr/ADR-001-execution-layer.md:17`），但操作表仍写 cancel + 重新 drop、supersede 关联（`docs/adr/ADR-001-execution-layer.md:47-53`）。当前 `docs/09` 明确区分同卡修订回 `queued` 与显式换卡才 `superseded`（`docs/09-data-contracts.md:258-259`）。

必须在 P0.5-B 前同步；否则 Hopper bridge 会实现错 task identity、dedupe 和历史关联。

## B 级重要优化

1. **分期和 capability 漂移应逐处同步，但先不建 feature manifest。** 漂移事实成立：`docs/05-roadmap.md:74-93`、`docs/07-tech-stack-decisions.md:252-258`、`docs/08-module-design.md:47-54`、`docs/10-voice-ux-spec.md:41-82` 与计划 `IMPLEMENTATION-PLAN.md:30,95,125-138` 不一致。单独 YAML manifest 会形成新的真相源；先用一张 canonical phase/capability 表加引用即可。

2. **outbox 口径仍需收口。** `docs/09` 已正确承认连续崩溃可重复多次（`docs/09-data-contracts.md:314-317`），但 `docs/04`、`docs/08` 仍写“重启只叫一次”（`docs/04-key-mechanisms.md:114`；`docs/08-module-design.md:50`），契约测试也仍有未限定场景的“重复 ≤1”（`docs/09-data-contracts.md:589`）。

3. **`respond` 应删除或拆独立 Question/Answer 收据。** 它存在于 decision 枚举，却没有状态转换；Brain 工具只接受 accept/reject，问题已有独立工具（`docs/09-data-contracts.md:138-166,618-625`）。

4. **Demo 的事实判断成立，解决方案过重。** Demo 宣称所有超 P0 元素就地标期（`demo/saydo-console-demo.html:281`），但直达旅程后续对象、T-0042、Demo artifact/preview 没持续携带 P0.5，Dashboard 的 S3 汇总也没有 P1（`demo/saydo-console-demo.html:352-353,475-526,675,760-794`）。补全静态 badge 和一个“本页展示完整首发预览”横幅即可；phase selector/featureId 不是开工前置。

5. **主报告存在可核实的引用和快照错误。**

   - `docs/08:672` 不存在，`docs/08` 在第 209 行结束；应是 `docs/09:672` 声称同步、而 `docs/08:42` 仍残留 current_projection（`research/saydo-post-review-reassessment-sol.md:733-737`；`docs/08-module-design.md:209`；`docs/09-data-contracts.md:672`）。
   - 报告说“实际已到 R29”，当前 journal 已有 R30（`research/saydo-post-review-reassessment-sol.md:739`；`history/PROCESS-JOURNAL.md:417`）。
   - route/adapter 已修事实正确，但应引用 schema 和 DDL，而不是只引用测试清单（`docs/09-data-contracts.md:225-231,393-395`，而非仅 `:595`）。
   - Appendix B 仍是待填写占位，不是已完成的 triage（`research/saydo-post-review-reassessment-sol.md:1012-1014`）。

## C 级可选

- docs-lint 可先只做确定性检查：坏链接、非法旧状态词、已知 stale phrase；不要尝试用 grep 推断全部产品分期。
- runtime capability matrix 真正编码后，可再从代码生成 Demo badge；不必先建文档 manifest。
- phase selector 仅在 Demo 需要同时承担“当前实现”和“全首发预览”时再做。
- 更新 README 的模块数和历史轮次：模块表实际为 25 个而 README 写 22 个（`docs/08-module-design.md:28-61`；`README.md:25`）；README/docs06 仍写 16 轮（`README.md:39`；`docs/06-references.md:97-100`）。

## 对主报告逐项 triage

| 主报告项 | 结论 | 独立复评 |
|---|---|---|
| 多数旧工程硬伤已修 | 部分采纳 | route、outbox、MemoryEvent、返工链、安全门确已明显改善；但 `reviewTask.rejected`、DDL 强度、ADR 改需求冲突仍会直接带歪实施。 |
| owner 方案 B 与四类结论分离 | 采纳 | 没有夹带范围裁剪，工程/自用价值/外部泛化/安全校准区分清楚。 |
| 4.1 SourceResolver | 部分采纳 | 问题和截止点正确；建议合同缺 excerpt、canonicalization、TOCTOU、retention、trust 与 evaluator 注入控制。 |
| 4.2 canonical authority | 部分采纳 | 必须修 prompt；不采纳“全量 freeze/docs-lint 完成前一律停工”。 |
| 4.3 phase/capability 漂移 | 采纳事实、部分采纳方案 | 逐处同步必要；feature manifest 暂属过度设计。 |
| 4.4 opportunity/active minutes/baseline | 部分采纳 | 原指标确实无效；新方案适合作为观察性漏斗，不能称 ITT 或非劣检验。 |
| 4.5 Phase -1/config | 部分采纳 | preflight、TTS/setup 修复正确；不应要求 Hopper 物理项阻塞整个 Phase 0，dev 模板也并未漂移。 |
| 4.6 naming/respond/outbox | 采纳问题、部分采纳修法 | `respond` 和 outbox 必修；工具名无需先建生成器，实施 manifest 保持 camelCase 即可。 |
| 4.7 docs-lint | 部分采纳 | 漂移事实大多成立；docs-lint 降为 C，且报告自身有错误引用。 |
| 4.8 Demo phase selector | 部分采纳 | badge 传播缺失成立；静态修复足够。 |
| F1 “真实完成 Phase -1” | 部分采纳 | 应按消费点分门，而不是把所有前置捆成 Phase 0 总门。 |
| F2 纵向主线与 SourceResolver 在 3.2 前落地 | 采纳 | 与计划依赖相容。 |
| F3 价值证据轨 | 部分采纳 | fixture 隔离、分开主动时间/延迟正确；机会登记和 baseline 还需锁定选择偏差规则。 |
| F4 claim gate | 采纳 | 与 owner“不设 stop/go”一致，也是防工程完成被误写成价值成立的必要边界。 |

## 最小回修清单

1. 发送实施 prompt 前，删除“计划冲突时胜出”，写清 authority map 和“只暂停冲突项”。
2. 修 `reviewTask` reject 落态；删除/定义 `respond`；补 P0 安全关键 DDL CHECK/NOT NULL，或明确 DAO-only 约束。
3. 重写 Phase -1 分档：Phase 0、0.5、Phase 1、P0.5 各自前置分开。
4. 统一 `[voice.tts]`；setup 改 argv/cwd/`--ignore-scripts`；修 generic config/env 的 Cursor 注释。
5. Phase 3.2 前新增不可变 SourceSnapshot、excerpt、resolver trust、TOCTOU、retention、replay 与 evaluator 注入反例。
6. dogfood 第一条数据产生前冻结 opportunity eligibility、capability version、active-minute sessionization 和描述性 baseline 口径。
7. P0.5 前同步 ADR 改需求语义、A7 已决状态、P0/P0.5 capability 表及 Demo 的静态分期徽标。
8. 修主报告错误引用与 R30 快照说明；完成 Appendix B triage 后再把它作为本轮最终 research 输入。