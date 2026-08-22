# W5.4-b 合同前置回写 · 零上下文一致性评审报告

评审对象：工作区未提交的 `docs/07`、`docs/09`、`docs/adr/design/ADR-001`、`docs/adr/ADR-002`、`HANDOFF.md` 增量；对照基准：`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` §5 左栏 P-1…P-5 及 09/07/ADR 全文既有条款。方法：git diff 逐 hunk 对照方案原文，再对 09 全文做矛盾检索（规则 2/3、G4、DDL 铁律、§12 反例、白名单、S2/S3），零 emoji 门禁实跑。

## 一、逐项对照表

### P-1 · 07 五处 supersede

| 检查点 | 判定 | 证据 |
|---|---|---|
| 五处坐标全命中（:118 D8 行 / :180 弃选表 / :204 / :230 / :255） | [ok] | 五个 hunk 起点 115/177/201/227/252，改动行恰为方案点名五行 |
| :118 含 allow/deny 裁决 S1-S3、S2 hook 内同步等、超时落回、canUseTool 等价物、live steer/streaming input 仍 SDK 独有 | [ok] | `docs/07-tech-stack-decisions.md:118` |
| 方案措辞要素「`ask` 在 `-p`=deny」 | [warn] 遗漏 | 07 五处均无此分句；09:1155 已权威承载（"`ask` 在 `-p` 下等同 deny,不可用"），信息未丢失 → C-1 |
| :118 新增「门脚本自返 deny 先于超时」 | [ok] 非擅自新增 | 方案 §3.3/律③改写条款原有语义 |
| :255 状态注「十七项 spike 实证」 | [ok] | 方案 §1.2 即 S1–S17 十七项 |
| 五处之外的 07 残留 | [fail] | `07:26` D8 决策索引行仍写「Claude=Agent SDK(Tier 1,产品缺省)」；`07:122` 仍用旧后端名 `claude_sdk`——与 :118 supersede 后正文直接矛盾（方案清单本身未点这两处）→ B-3 |

### P-2 · ADR-001 addendum

| 检查点 | 判定 | 证据 |
|---|---|---|
| 传输形态 = `claude -p` 子进程（非进程内 SDK）、理由 = 架构复用 + 零依赖、政策原文佐证、「产品缺省 = Claude」与 canUseTool 语义（hook 等价）不变 | [ok] 全要素落齐 | `docs/adr/design/ADR-001-execution-layer.md:17` addendum |
| 原文保留（路径一原句一字未动，addendum 追加） | [ok] supersede 卫生最佳 | 同上 |
| 日期：方案写「附注（2026-08-19）」，实际落 2026-08-21 | [warn] 轻微偏离 | 用实际回写日更诚实（v3.1 定稿于 08-20，写 08-19 反而不准）→ C-2 |

### P-3 · ADR-002 状态更正节 + HANDOFF #4/#6

| 检查点 | 判定 | 证据 |
|---|---|---|
| 更正节三条：BYOA 核验链 + 条件豁免已随 T18 落地（流内无 model 且核验通过才触发；2.1.220 流内有 model ⇒ 实践不触发）；Tier1 `claude_code` 不用豁免恒 false | [ok] | `docs/adr/ADR-002-byoa-observed-model.md:65-71` |
| 附则第 4 条原文摘引准确、附则 1-3 收窄条款未动、原文保留 | [ok] | ADR-002:59-61 原文 vs :67 引文逐字吻合 |
| 「owner 确认日期」 | [fail] 偏离 | 更正节第 3 条与 `HANDOFF.md:44` 均写「owner 确认挂 W5.4-b 批验收」——无确认日期，确认动作后置 → B-1 |
| HANDOFF #6 | [ok] 无需改 | `HANDOFF.md:46` 既有文本已含「BYOA `claude_cli` 条件豁免已随 T18 落地；Tier1 `claude_code` 不使用,恒 `observedModelExempted=false`」，本批 diff 未动该行，P-3 要求在 HEAD 已满足 |
| 更正节引用「09 §11 规则 2」 | [warn] | 锚点已漂移（见 B-2） |

### P-4 · 09 §11 承载段 + config 示例块

| 检查点 | 判定 | 证据 |
|---|---|---|
| `[tier1]` 四键 + 缺省（claude_bin/claude_pinned_version/model=opus/claude_max_turns=200，两把尺子注） | [ok] | `docs/09-data-contracts.md:1161`、示例块 :1032-1038 |
| 选择键唯一 `[models.dev].agent`（不新增 `[tier1].agent`）、模型键按 backend 单源 | [ok] 与方案 D2/B-08 一致 | 09:1161、:1028-1029 |
| 项目 override 规则（dev.agent 放开 claude_code、不匹配忽略 + 审计） | [ok] 落文，但见 B-4 | 09:1161 |
| GateWireRequest 判别联合、无 `kind` = command、cursor wire 零改动 | [ok] | 09:1164，与方案 §3.3 z.union 同形 |
| gate-claude.sh / 双脚本 drift guard（两脚本 digest 集合） | [ok] | 09:1163 |
| 律③对 claude_code 单列改写（vendor 超时 ≠ deny；失败路径 deny + exit 2 且自返先于超时） | [ok] | 09:1155 |
| `native_session_confirmed` 列（DDL additive + 增量迁移注） | [ok] | 09:910-912 + :1165；「(additive,实现配增量迁移)」与 HANDOFF §4 铁律「改 DDL_V1 必配迁移」的文档侧表达一致 |
| G4 例外两键 + 凭据恒剔除 + apiKeySource 断言 | [ok] | 09:1166 |
| P-4 无遗漏、无擅自新增 | [ok] | 全部子项可回溯到方案 D2/D7/D8/D12/D13/§3.3/§3.4/§3.7 |

### P-5 · 09 §9 词表 / §11-6 / §13

| 检查点 | 判定 | 证据 |
|---|---|---|
| `cost_entries.kind` 词表新增 `tier1.run` + 详注（source='subscription'、requests=1、num_turns 进 meta、usage_unavailable 与四键 0 并存、cursor 同步补记） | [ok] 完整忠实 | 09:863、:867-870，与方案 D6/§3.8 逐句吻合 |
| `subscription_retry_queue` 的 slot='tier1'/kind='tier1_run'/not_before=resetsAt/replayer=retryTask/只对明确拒绝态/不静默转 api | [ok] | 09:900-902 |
| **四字段在 Tier1 审计 meta 的承载** | [fail] 完全遗漏 | 09 全文 grep `tier1.settled_review|tier1.blocked|tier1.failed|observedModelSource` 零命中新增；方案 §3.4 要求的「四字段进三个 Tier1 审计动作 meta（observedModelSource:"stream"、observedModelExempted:false）」未落任何位置 → A-1 |
| `steerTask` 注「claude_code 接入后 live 仍预留（CLI 单向）」 | [ok] | 09:1336-1337；但旧注未清 → B-6 |
| `DevAgentBinding.claude_code` 加 `transport?: "cli"`、两处「Agent SDK canUseTool 回调」改 hook 等价并保留原文引用 | [ok] | 09:1149、:1155 |

## 二、自洽性重点检查（用户点名六项）

1. **§11 规则 2 与 ADR-002 更正节口径**：语义一致（封闭枚举/核验前提/标记/流内严格），[ok]；但「规则 2」锚点在当前 09 §11 T18b 列表中指向 runtime 登记条款（09:1194），豁免/四字段实为**规则 3**（09:1195）——历史编号漂移（ADR-002 背景节引的"规则 2 字面 = 流内 observedModel 缺失即作废"即今日规则 3 内容），既有引用（ADR-002 附则、HANDOFF #4、09:1249）与本批新增（09:1162、更正节 :67）全部沿用旧锚 → B-2。
2. **文件门「圈外一律 deny 无 S2 通道」vs S2/S3 定义**：[ok] 无矛盾。圈外写按方案 A-01/A-02 裁决映射 S3（`delete_data`），S3 = 绝不放行，与「无 S2 通道」自洽；S2 只留圈内敏感基名，与 S2 = 上浮人批定义一致（09:1164）。
3. **[tier1]/[models.dev] 键归属 vs §11 白名单**：全局侧 [ok]（两段均全局键，不涉项目层白名单）。项目层 [warn]：09:1114-1116 白名单枚举「仅允许 [project]/[git]/[verify]/[setup] 自有域 + budget/dnd/params」**不含 dev 域**，而新增 :1161「项目级 override `dev.agent`」与既有规则 4（09:1196「budget/dev-only 覆盖」）都预设项目层 dev 域合法——枚举与 override 规则不一致（既有滞后，本批显性化而未消解）→ B-4。
4. **G4 例外两键 vs 零凭据注入**：[ok] 无矛盾。G4 原则 =「agent 环境剥离凭据」（05-roadmap:70；08-15 决策文档引 G4 原话「不带任何 key/token」），两键非凭据且 :1166 明写 `ANTHROPIC_*`/`CLAUDE_CODE_OAUTH_TOKEN` 仍恒剔除 + apiKeySource 断言机械化。小瑕疵：G4 在 09 内无定义锚点，属悬空引用 → C-6。
5. **tier1_runs 加列 vs DDL 铁律**：[ok]。两处注释「additive,实现配增量迁移」（09:911、:1165）正确表达 HANDOFF §4 铁律；另 §12-7（09:1243）恢复键仍是三元组 `(adapter, nativeSessionId, cwd)`，未同步 confirmed=1 第四条件 → B-5。
6. **kind 词表新增 vs §12 非法 kind 反例**：[fail]。§9 词表已加 `tier1.run`（09:863），但 §12-4（09:1240）契约测试项仍枚举「kind 前缀词表(llm.*/asr.seconds/tts.chars/hopper.run,非法 kind 反例)」——照 §12 写测试会把 `tier1.run` 判为非法 kind，与 §9 词表直接矛盾 → A-2。（`tier1.run` 不进 :1074 计价单位词表与 `hopper.run` 同例，无问题。）

## 三、supersede 卫生

[ok] 整体良好：07:118 保留原句关键引文「不走 CLI(Claude CLI 无 canUseTool,一手实测)」+ supersede 日期 + 方案出处，「为什么当初弃选（无回调仍为真）/为什么现在改判（hooks 等价承载）」双向可追溯；07:255 原文全保留仅加状态注（最佳）；09:1149/:1155 保留原「Agent SDK canUseTool 回调」引文并声明作废；ADR-001/ADR-002 原文一字未动、追加节引原文。瑕疵：07:180 未保留原行后半句（「开发档必须 Agent SDK;不影响下节 BYOA 槽」）、07:230 原「dogfood 顺延至订阅购入(计划 v2.3①)」痕迹被移除 → C-3。

## 四、术语纪律

- 零 emoji：[ok] `scripts/check-emoji.sh` 实跑 clean；新增文本仅用 `→`/`⇒` 文本箭头与 `[ok]/[warn]/[fail]`。
- 状态词纪律：[ok] 无「完成/做完」违例；「W5.4 接线中」「结项」「已随 T18 落地」用法合规（后者为已合并历史事实）。HANDOFF #4「已随 w54b-canonical-preface 回写校正」在本批未收口前属轻微越前 → C-7。
- 三分术语：[ok] adapter=`claude_code`、transport=`"cli"`、BYOA provider=`claude_cli` 全程无混用；「backend」未新增词表值。既有残留 `claude_sdk`（07:122、09:1338/:1343）非本批引入，见 B-3/B-6。

## 五、发现清单

**A 级（错误合同或矛盾，必修）**

- **A-1** P-5 子项「四字段在 Tier1 审计 meta 的承载」整体遗漏：09 无 `tier1.settled_review`/`tier1.blocked`/`tier1.failed` 审计 meta 携带四字段（`observedModelSource:"stream"`、`observedModelExempted:false`）的任何合同文本。证据：方案 §5 P-5（plan:241）+ §3.4（plan:173）；`docs/09-data-contracts.md` 全文 grep 零命中。W5.4-b 实施时该项无照抄源（`docs/plan/` 不属合同 canonical），开批前置不完整。
- **A-2** §12-4 kind 词表枚举未同步：`docs/09-data-contracts.md:1240`「kind 前缀词表(llm.*/asr.seconds/tts.chars/hopper.run,非法 kind 反例)」与 :863 新词表（已含 `tier1.run`）矛盾——契约测试按 §12-4 会把 `tier1.run` 判非法，测试与记账实现必然打架。
- **A-3** HANDOFF 同文件状态矛盾：`HANDOFF.md:20` 指针行写「当前批次指针:`w54b-canonical-preface`(2026-08-21 开批…)」，紧邻 :21 快照行（自称「当前坐标唯一以本行为准」）写「当前批次指针保持为空」。两行均为本工作区未提交新文本（快照行系评审 88 并行改动），收口前必须对齐，否则下一会话拿错坐标。

**B 级（建议改）**

- **B-1** P-3「owner 确认日期」未落：更正节第 3 条（ADR-002:71）与 `HANDOFF.md:44` 把 owner 确认后置到 W5.4-b 批验收。不代拍板纪律下后置合理，但 P-1…P-5 是开批前置，owner 确认是否须先于 W5.4-b 开批需 owner 显式裁决（当前写法 = 默认接受后置）。
- **B-2** 「09 §11 规则 2」锚点漂移：豁免/四字段条款现为 T18b 列表规则 3（09:1195），规则 2（09:1194）是 runtime 登记。本批新增 09:1162 与 ADR-002:67 沿用旧锚（既有 ADR-002:4-5/:48/:52、HANDOFF:44、09:1249 同病）。建议本批顺手把新增两处改为可靠引用（如「§11 T18b 规则 3」）或做一次全局锚点勘误。
- **B-3** 07 残留矛盾行未纳入 supersede：`docs/07-tech-stack-decisions.md:26`（D8 索引行「Claude=Agent SDK(Tier 1,产品缺省)」）与 :122（后端词 `claude_sdk`）与 :118 已改判正文直接矛盾。方案 P-1 只点五处，属方案清单缺口；建议本批补两处 supersede 注。
- **B-4** 项目层白名单枚举缺 dev 域：09:1114-1116 未列 dev，而 09:1161（新增）与 09:1196（既有「dev-only 覆盖」）都承认项目层 `dev.agent`/dev 覆盖存在。按「白名单外键项目层出现即拒」的 fail-closed 字面，`dev.agent` 应被拒。建议把 dev 域（及允许键集）补进 :1115 枚举。
- **B-5** §12-7 恢复键未同步：09:1243 仍写三元组「Tier 1 按 (adapter, nativeSessionId, cwd) 恢复」，新合同 09:1165 收紧为四元组（+confirmed=1）。建议本批同步或显式登记到 R-3 随批清单（`docs/modules/c-control-bridge.md:20` 同句在 R-4 范围，可一并）。
- **B-6** §13 steerTask 注新旧并存：新注（09:1336-1337）说 claude_code 接入后 live 仍预留；旧注 09:1338「claude_sdk 流中注入=live」与 09:1343「claude_sdk 接入实测后放开」未标被覆盖，旧词 `claude_sdk` 已非词表值，且「接入实测后放开」与实测结论「接入后仍预留」方向相反，易误读。

**C 级（可忽略，记录在案）**

- **C-1** P-1 措辞要素「`ask` 在 `-p`=deny」未落 07 五处（09:1155 已承载，无信息丢失）。
- **C-2** P-2 附注日期 2026-08-21 vs 方案文本「2026-08-19」（实际日期更诚实）。
- **C-3** 07:180/:230 supersede 未保留原行次要半句（核心弃选理由已保留，追溯性足够）。
- **C-4** 09:1155 前向引用「律③」（定义在其后 cursor bullet :1156-1158）；「hook 对文件工具统一裁决」与「file_read 圈内 no_decision」措辞有轻微张力（:1164 承载段已精确）。
- **C-5** 09 config 示例组合 `agent="claude_code"` + `model="claude-sonnet-5"`（注释标为 cursor 键）——照抄该示例时 model 为死配置，注释已说明按 backend 单源，可读性小瑕。
- **C-6** 「G4」在 09 内无定义锚点（定义在 05-roadmap Gate 0 域），09:1166 属悬空引用；07:248「仍按计划 Phase -1 实测确认」表述已过时。
- **C-7** `HANDOFF.md:44`「已随 w54b-canonical-preface 回写校正」在批未收口前轻微越前（工作区已落盘为实）。

## 六、总评

**回修后通过**：P-1/P-2/P-4 忠实完整、supersede 卫生与术语纪律全部达标，但 P-5 缺「四字段 Tier1 审计承载」子项（A-1）、§12-4 kind 词表与 §9 直接矛盾（A-2）、HANDOFF 批次指针与快照行互斥（A-3），三条 A 级修复并由 owner 对 B-1（确认后置口径）表态后，方可作为 W5.4-b 开批前置收口。

现在我要撰写最终报告,按用户要求组织结构:针对P-1到P-5逐项列出忠实度、偏离和遗漏情况,并附上证据坐标(文件名:行号);再列出发现清单,分A/B/C类,每条配证据;最后用一句话做总评。全文用简体中文,不用表情符号,用[ok]/[warn]/[fail]标记状态。
