# 89 · W5.4-b 前置 canonical 回写评审(w54b-canonical-preface)· Codex 对抗评审报告

> 命令:`codex exec -m gpt-5.6-sol -c model_reasoning_effort=max -s read-only`(prompt = `prompts/89-w54b-canonical-preface-review.md`);2026-08-21;耗时约 55 分钟,exit 0。
> 日志:`logs/89-w54b-canonical-preface-review.log`(3690593 bytes / SHA-256 `7c861eecf8d3f50db7a033e2eceb94c5f002e2365909f2550f6c4b800bb4ccbe`,不入 Git)。
> 本文件 = Codex 报告原文(§A)+ 调度会话 triage(§B,同日)。

## A. Codex 报告原文

## 结论

序列判断：**成立，但这是缺省路径，不是无例外的绝对顺序**。

方案 §5 明确要求 P-1…P-5 在 W5.4-b 开批前回写并经过一致性 subagent、Codex 评审；§6 又保留了 owner 书面批准“实现先行”的例外（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:231-241,272`）。PLAN-2 的标准生命周期也是“前批 evidence/readback + 批次指针门 + 合同门 -> prompt -> owner 停点 -> 实施 -> evidence/readback”（`docs/plan/IMPLEMENTATION-PLAN-2.md:24,130-131,179-181`）。

w54a readback 缺失应上浮 owner，不能由本会话代跑：IMPL-PROMPT-15 要求独立 `/impl-review` 或 owner 书面豁免，否则停批（`docs/plan/IMPL-PROMPT-15-W54B-WIRING.md:9-12,44-48`）。但当前 `HANDOFF.md:21` 与 `HANDOFF.md:22` 同时声称“当前指针为 `w54b-canonical-preface`”和“当前批次指针保持为空”。这违反单仓单批规则，可能让调度读取者误判可开新批，属于 [A] 状态控制错误。

推荐路径：

`w54a readback 或 owner 书面豁免 -> P-1…P-5 回写 -> 一致性评审/Codex -> owner 停点并处理未提交工作区授权 -> IMPL-PROMPT-15 -> W5.4-b 接线 -> evidence/readback -> 清指针`

如果要在 readback 未处理时先做“前置回写”，必须把它写成明确的 owner 例外；否则 `HANDOFF.md:21` 的“不阻塞本前置回写”与 PLAN-2 的通用批门不自洽。

右栏 R-1…R-8 按要求未计入遗漏。

## P-1：直接回写忠实，但全文仍有 [A] 漂移

方案原文要求：`claude -p` + `PreToolUse` hooks、S1-S3 allow/deny、S2 同步、`ask` 在 `-p` 下等同 deny、hook 超时回落 Claude 权限流、hooks 等价于 `canUseTool`，live/streaming 本批不做（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:237`）。

五个指定位置的改动基本逐项对应：

- `docs/07-tech-stack-decisions.md:118` 写明 CLI、hooks、S2 同步、超时回落、“无 canUseTool 回调”仍为真。
- `docs/07-tech-stack-decisions.md:180` 保留旧弃选理由、日期和 supersede 痕迹。
- `docs/07-tech-stack-decisions.md:204,230,255` 均把 Agent SDK 传输改为 CLI hooks，并保留 live/streaming 不实现的范围。

`ask=-deny` 没有在每个 07 行重复，但已在 09 门合同中明确（`docs/09-data-contracts.md:1155`），不是实质遗漏。

问题在于全文仍有未标历史的当前表述：

- `docs/07-tech-stack-decisions.md:26` 仍写“Claude=Agent SDK(Tier 1,产品缺省)”。
- `docs/07-tech-stack-decisions.md:122` 仍把当前后端列为 `claude_sdk / cursor_cli`。
- `docs/07-tech-stack-decisions.md:267` 仍把 D8 映射成“Claude SDK”。

这些不是历史段，也没有 superseded 标记；实施者可能从顶层 D8 摘要继续选择 SDK。P-1 因此是“直改内容忠实、全文回写不完整”，等级 [A]。

实现现状本身并未被误报为已接线：Claude backend 当前确实是 `claude_code` CLI（`packages/daemon/src/tier1/backends/claude.ts:218-232`），但 `readDevAdapter()` 仍默认 cursor（`packages/daemon/src/index.ts:2461-2467`），非 cursor 仍被拒起（`packages/daemon/src/tier1/validateConfig.ts:103-108`）。这符合 W5.4-a 只做纯函数层的边界；只是 07 中“设计缺省”和“当前运行缺省”应再加 staged 标识。

## P-2：忠实，存在 [B] 可读性问题

方案要求 ADR-001 增加：路径一使用 `claude -p` 子进程而非进程内 SDK，理由是架构复用和零依赖，产品缺省 Claude 与审批语义不变（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:238`）。

回写的 2026-08-21 addendum 完整覆盖这些点（`docs/adr/design/ADR-001-execution-layer.md:17`），也保留了原结论和日期，历史可追溯性没有被破坏。

问题是原句“路径一 · Claude SDK 薄执行器”与新 addendum 在同一长段中并列，未明确写“superseded”。读者若停在旧句，会误以为仍需进程内 SDK。由于后面的 dated addendum 已立即纠正，评为 [B]，不是 [A]。8 月 19 日是方案计划日期，8 月 21 日是实际回写日期，属于 [C] 时间差异。

## P-3：内容忠实，owner 确认记录为 [B]

方案要求仅更正 ADR-002 附则第 4 条，附则第 1-3 条保持原样；BYOA 条件豁免已落地，2.1.220 流内有 model，Tier1 `claude_code` 不使用豁免，并记录 owner 确认日期（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:239`）。

回写符合主要语义：

- 明确声明第 1-3 条不变（`docs/adr/ADR-002-byoa-observed-model.md:65-68`）。
- 写明 BYOA 身份核验和条件豁免现势、2.1.220 流内 model、Tier1 恒 `observedModelExempted=false`（`:69-70`）。
- 原附则明确保留为历史（`:63`），没有抹掉旧结论。
- `HANDOFF.md:44-46` 与 ADR 状态基本同步。

不足是方案要求“owner 确认日期”，当前只写“随 W5.4-b 批验收由 owner 确认”（`ADR-002:71`、`HANDOFF.md:44`），没有确认日期或确认凭据。该表述作为“尚待 owner 确认”的挂接是妥当的，但不能替代 W5.4-b 开工前的 owner 停点；IMPL-PROMPT-15 已把 ADR-002 确认列入开批决策项（`docs/plan/IMPL-PROMPT-15-W54B-WIRING.md:44-48`）。等级 [B]。

现有 BYOA 身份核验函数已存在（`packages/daemon/src/providers/byoa/provider.ts:135-149`），Tier1 严格 observed-model 检查也存在（`packages/daemon/src/tier1/executor.ts:1314-1324`）；W5.4-b 尚未接入的部分不应倒扣 P-3。

## P-4：大部分忠实，但有一个 [A] 恢复合同冲突

方案要求配置四键、唯一选择键 `[models.dev].agent`、项目 override、GateWireRequest 判别联合、双脚本 drift guard、Claude 专属 timeout、`native_session_confirmed` additive DDL、G4 两个显式环境键（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:202-205,217-226,240`）。

回写的主要内容均已出现：

- 配置和 key ownership：`docs/09-data-contracts.md:1027-1038,1160-1162`。
- `DevAgentBinding.claude_code` 的 `transport:"cli"`：`docs/09-data-contracts.md:1148-1155`。
- GateWireRequest union、无 `kind` 的 command、双脚本 drift guard、timeout 语义和 G4：`docs/09-data-contracts.md:1155-1166`。
- DDL 列、默认值和 `CHECK (0,1)`：`docs/09-data-contracts.md:908-912`。

关键问题：

1. **恢复键四元组与旧三元组并存，等级 [A]。**

   新条款要求 `(adapter, native_session_id, cwd, confirmed=1)` 四元组（`docs/09-data-contracts.md:1165`），但当前 §12 仍写 Tier1 按 `(adapter, nativeSessionId, cwd)` 三元组恢复（`:1243`）。当前 executor 也仍按三元组查询（`packages/daemon/src/tier1/executor.ts:2266-2274`）。这不是单纯实现未做，而是 canonical 当前条款互相矛盾，会直接误导 C2 的恢复实现。

2. **DDL additive 声明不够机械，等级 [B]。**

   新列位置、默认值和 CHECK 形状本身合理（`docs/09-data-contracts.md:908-912`），但只写“实现配增量迁移”，没有迁移版本、旧库 fixture 或回归锚。现有铁律要求改 DDL_V1 必须配增量迁移和 v4-era fixture（`packages/daemon/src/storage/ddl.ts:242-254`）；当前 migration 列表只到 v29（`:769-798`）。IMPL-PROMPT-15 虽已要求老库迁移测试（`:38-39`），canonical 仍应把该要求写成不可漏执行的合同。

3. **“file_write 响应三态”表述有歧义，等级 [B]。**

   `docs/09-data-contracts.md:1164` 把 file_write 写成“三态”，但方案 §3.3 的 wire 形状是 file_write 仅返回 allow/deny，`no_decision` 属于 Read 分支（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:155-161`）。当前 `GateWireResponse` 也只有 allow/deny（`packages/daemon/src/tier1/gateServer.ts:11-22`）。这里实际想表达的是“三种决策分支、两种 file_write wire 值”，应改明。

4. **配置示例的 staged/current 边界不清，等级 [B]。**

   09 示例把 `[models.dev].agent` 写成 `claude_code`，但 `[tier1]` 四键仍是注释，且 `claude_pinned_version` 写成 2.1.220（`docs/09-data-contracts.md:1027-1038`）。当前模板仍明确“运行时只认 cursor；Claude Code 执行器接入中”（`templates/saydo.config.example.toml:39-44`），HANDOFF 当前 CLI 版本则记为 2.1.225（`HANDOFF.md:46`）。方案本身允许“产品模板未来切 Claude、代码当前仍 cursor”（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:87`），所以不是键归属错误，但示例应明确标为目标/fixture 配置，避免实现者直接拿 2.1.220 当现机 pin。

S2/S3 方面没有发现实质冲突：04 的 S2/S3 表是按效果计算的典型缺省（`docs/04-key-mechanisms.md:132-141`），方案又对 Claude file_write 明确收窄为圈外/不可解析一律 deny、无 S2 通道（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:217-218`）。这是工具特定的 fail-closed 策略，不是把所有“圈外动作”重新定义成同一风险级别。

另有一处旧当前条款仍写“Tier1 步序 = 同一 SDK session 内暂停、不产生新 run”（`docs/09-data-contracts.md:934`），与方案四元组/new attempt 规则（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:182-184`）不一致；因 step_confirm 被延后，暂评 [B]，但应标为 deferred/history。

## P-5：直接新增大体忠实，但存在两个 [A] 合同冲突

方案要求 `tier1.run`、`slot="tier1"/kind="tier1_run"`、Tier1 审计四字段、steerTask 的 CLI 单向预留，以及 `transport:"cli"`（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:91,173,195-196,241`）。

直接回写已覆盖：

- `tier1.run` 及 subscription 记账形状：`docs/09-data-contracts.md:862-870`。
- retry slot/kind、resetsAt、retryTask 和“不静默转 API”：`docs/09-data-contracts.md:894-906`。
- `transport:"cli"` 与 Claude hooks：`docs/09-data-contracts.md:1148-1156`。
- live 预留注：`docs/09-data-contracts.md:1335-1337`。
- 当前纯函数成本对象也与该形状一致（`packages/daemon/src/tier1/claudeOutcome.ts:84-119`）。

但 canonical 全文有以下问题：

1. **订阅重放规则直接矛盾，等级 [A]。**

   新增 DDL 注写 Tier1 必须用 replayer（`docs/09-data-contracts.md:904-906`），而当前 §11 规则 5 仍写“P0 不做自动排队重放”（`:1230`）。两者都在当前合同段，不是历史附录；W5.4-b C2 明确要求 retryTask/replayer。实施者可能据旧规则省略 Tier1 durable replay，或据新注违反全局计费规则。必须显式写 Tier1 exception，不能靠位置推断。

2. **steerTask 的旧 SDK live 语义仍是当前条款，等级 [A]。**

   新注说 CLI 单向、live 不实现、两后端实际返回 queued/cancel（`docs/09-data-contracts.md:1335-1337`），但紧邻旧文仍写 `claude_sdk` 流注入即 live、接入实测后放开（`:1338,1343-1344`）。§13 本身是当前工具契约（`:1298-1300`），没有历史/future 标记。若按未来 SDK 能力保留，应明确写“future adapter、非 `claude_code`、不属于本批”；按当前文本读取则会误导 W5.4-b 接入 live SDK 分支。当前实现注释也保留同一旧口径（`packages/daemon/src/tier1/operations.ts:60-69`）。

3. **§12 kind 测试词表遗漏 `tier1.run`，等级 [B]。**

   §9 已新增 `tier1.run`，但 §12 成本条目仍只列 `llm.*/asr.seconds/tts.chars/hopper.run`（`docs/09-data-contracts.md:1240`）。`pricing` 单位注也未说明 Tier1 的 amount-null/no-unit 例外（`:1072-1075`）。这会漏掉契约测试覆盖。

4. **Tier1 审计四字段没有按方案显式落到终态 action，等级 [B]。**

   方案要求 `tier1.settled_review/blocked/failed` 的 meta 明确携带四字段（`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:173`）。09 只有泛化的 provider/invocation 规则（`docs/09-data-contracts.md:1195`），本次 P-5 diff 没有把 Tier1 action 名和字段绑定写出来。IMPL-PROMPT-15 C2 虽有实现锚（`:38-39`），但 canonical 仍有遗漏。

5. 新增注引用“§11-6”作为记账口径（`docs/09-data-contracts.md:868`），而当前实际记账规则是 §11 规则 5（`:1230`），规则 6 是 evaluator（`:1231`）。这是 [B] 级交叉引用错误。

## 总评

**No-Go。**

不是因为 W5.4-a 缺少生产接线；证据明确说明 W5.4-a 只做纯函数层，未改 executor、gateServer、config 或 09（`e2e/evidence/w54a-claude-cli.md:3,180-187`），这些实现缺口属于 W5.4-b 预定范围。

No-Go 的依据是当前已有会误导 W5.4-b 的 [A] 级表面：

- `HANDOFF.md:21-22` 批次指针互相矛盾；
- `docs/07-tech-stack-decisions.md:26,122` 仍把 Claude SDK 当当前产品/适配器口径；
- `docs/09-data-contracts.md:1165` 与 `:1243` 的恢复三元组/四元组冲突；
- `docs/09-data-contracts.md:904-906` 与 `:1230` 的 Tier1 重放/禁止重放冲突；
- `docs/09-data-contracts.md:1335-1337` 与 `:1338,1343-1344` 的 live steer 冲突。

修正上述 [A]，并补齐迁移版本与 fixture、kind 测试词表、Tier1 审计字段、owner 确认日期及 staged 配置标记后，结论可转为“修改后 Go”。

## B. 调度会话 triage(2026-08-21,同日)

总裁决:Codex「No-Go / 修正后 Go」**全盘接受**,A 级五条 + B 级全部当轮回修完毕(逐处见下表);一致性 subagent 报告后到,其发现并入同一轮回修(见 §C 或 journal R86)。

| # | Codex 发现 | 级别 | 处置 |
|---|---|---|---|
| 1 | HANDOFF :21-22 批次指针自相矛盾(指针行写 w54b-canonical-preface,快照行写"保持为空") | A | 快照行改为「当前批次指针 = w54b-canonical-preface(以指针行为准,收口后清)」 |
| 2 | 07 :26/:122/:267 残留"Agent SDK / claude_sdk"当前口径,实施者可能从 D8 摘要继续选 SDK | A | 三处同 supersede 口径刷新(D8 摘要行/适配器行/P0 里程碑行),均带 2026-08-21 日期与"接线中"staged 语境 |
| 3 | 09 §12-7 :1243 恢复三元组与新四元组条款矛盾;且四元组未限定 backend(会误伤 cursor 老行) | A | §12-7 分 backend 改写(cursor 沿三元组、claude_code 增 confirmed=1 第四条件、既有 cursor 行为不变);§11 承载段四元组句加「仅约束 claude_code」显式限定 |
| 4 | 09 §11 规则 5「P0 不做自动排队重放」与新 Tier1 replayer 注直接矛盾 | A | 规则 5 就地加范围限定 + Tier1 显式例外(kind='tier1_run' 走 durable 重放;仍订阅额度内、无 api 行、billing-switch 纪律不变) |
| 5 | 09 §13 steerTask 旧注「claude_sdk 流中注入=live / 接入实测后放开」与新预留注矛盾 | A | 旧注两处改写:live 载体限定为「未来 SDK/streaming-input 或 native_api 形态」,claude_code CLI 明确不随其放开 |
| 6 | ADR-001 原句「Claude SDK 薄执行器」未标 superseded | B | 路径一行标题句改「Claude 薄执行器(原题…已改 CLI,见 addendum 2026-08-21)」 |
| 7 | DDL additive 声明不够机械(缺迁移版本/fixture 锚) | B | 列注补「下一可用 schema 版本增量迁移 + v4-era fixture 老库升级回归 + 既有行回填 0」 |
| 8 | file_write「三态」措辞与 wire 二态歧义 | B | 改「决策三分支、wire 响应值二态 allow/deny;no_decision 仅 Read 分支」 |
| 9 | config 示例 staged 边界不清(pinned 2.1.220 会被当现机值;HANDOFF 记 2.1.225) | B | [tier1] 示例段加 staged 注 + pinned 改「claude --version 实测」占位(fixture 基准 2.1.220 另注) |
| 10 | §12-4 kind 测试词表漏 tier1.run;pricing 单位词表无例外注 | B | 两处补齐(tier1.run 断言句 + 无单价无 unit 例外行) |
| 11 | Tier1 审计四字段未绑定到终态 action 名 | B | §11 claude_code 承载段补一句(tier1.settled_review/blocked/failed 的 meta 四字段,additive) |
| 12 | 新注交叉引用「§11-6」应为 §11 规则 5 | B | 已改 |
| 13 | 09 :934 step_confirm「同一 SDK session」旧措辞 | B | 中性化为「agent session(载体 = 各 backend native session)」+ deferred 指引 |
| 14 | ADR-002 owner 确认缺日期(挂 W5.4-b 验收的表述妥当但非替代停点) | B(保持) | 维持「随 W5.4-b 批验收由 owner 确认」挂接;IMPL-PROMPT-15 §3.5 已列为开批决策项 |
| 15 | 序列判断成立(缺省路径,例外须 owner 书面批准);readback 上浮正确;推荐路径 = readback 处置 → 回写 → 评审 → owner 停点(含工作区授权)→ IMPL-PROMPT-15 → 实施 | 确认 | 采纳为执行顺序;readback 处置已列 IMPL-PROMPT-15 §0-3 与 §3.5-1 |

修正后复验:emoji 门禁 clean、`git diff --check` exit 0(记录于 journal R86)。

## C. 一致性 subagent 合并 triage(2026-08-21,报告 `history/reviews/2026-08-21-w54b-preface-consistency.md`)

subagent 评审对象 = Codex 回修**前**的工作区快照,其三条 A 级(四字段审计承载遗漏 / §12-4 kind 词表未同步 / HANDOFF 指针互斥)与 Codex 89 的 #11/#10/#1 同源,已随 B 节回修覆盖;其独有发现处置:

| # | 发现 | 裁决 | 处置 |
|---|---|---|---|
| C-1 | 07 D8 行缺 P-1 四要点之「ask 在 -p = deny」(09 已承载,不构成合同错误) | 采纳 B | D8 行已补该半句 |
| C-2 | 「09 §11 规则 2」锚点漂移:豁免/四字段条款现为 T18b 列表规则 3,历史引用(ADR-002/HANDOFF/09 §12)全部沿旧锚 | 采纳 B | 本批新增两处(09 承载段/ADR-002 更正节)加双锚注;历史引用不改;漂移统一登记台账 §3「canonical 条款锚点」 |
| C-3 | project.toml 白名单不含 dev 域,与 dev.agent override 及规则 4「dev-only 覆盖」表述差被本批显性化 | 采纳 B | 承载段 override 句补承载区分(受控表 vs project.toml 两承载并行不矛盾);登记台账 §3 |
| C-4 | ADR-001 日期 08-19/08-21 差异、[models.dev] 示例 model 键在 claude_code 下为死配置、「统一裁决 vs no_decision」措辞张力等 C 级七条 | 备案 C | 不动;示例死配置已有按 backend 单源注释兜底 |
| C-5 | P-3 owner 确认后置 | 与 Codex #14 同 | 维持「随 W5.4-b 批验收确认」挂接 |

合并终态:两路评审全部 A/B 级处置完毕,复验 emoji 门禁 clean + `git diff --check` exit 0;w54b-canonical-preface 达到「修改后 Go」条件,W5.4-b 合同门关闭待入库。
