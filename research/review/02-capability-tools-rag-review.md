# 02 · 能力、工具与 RAG 独立评审

> 评审日期：2026-08-26  
> 评审身份：零上下文独立评审  
> 范围：`questions/*.md` 全部 600 条、`contexts/CTX-01..16` 全部 16 个 manifest 与 47 份来源、`validate.mjs`，并对照 `HANDOFF.md`、`docs/02-product-definition.md`、`docs/03-architecture.md`、`docs/04-key-mechanisms.md`、`docs/05-roadmap.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md`。  
> 分级：A = 发布/评测阻断；B = 应在本轮修正；C = 可择机改善。

## 1. 结论先行

总判定：`[fail]`。当前语料不能作为“SayDo 当前能力匹配”或“RAG 来源治理”金标发布。

结构层面，当前 `validate.mjs` 返回 `[ok] 600 条提问语料结构门禁通过`；但语义与门禁层面存在四组 A 级问题：

1. `F1` 把“合同已写好”与“当前运行时能执行”混成同一档，和项目类型门禁、外部 connector 现势冲突；
2. 医疗、实时市场与销售上下文中出现“权威源写进 manifest、实际来源包不存在或尚未抓取”的情况；
3. 多个 RAG 包被按关键词复用到没有相应证据的任务，模型即使忠实读取也无法回答题面；
4. `validate.mjs` 可对额外非法记录、重复工具凑 K 档、manifest 遗漏来源产生真实假绿。

在 A 级项修清前，不应把验证器绿灯写成“600 条能力/RAG 语料通过”。

## 2. 全量遍历与复核证据

本轮用程序解析所有匹配记录，并单独遍历 16 个上下文目录；不是抽样审查。

```text
traversed=600
question_files=12
per_file=120,70,70,60,55,45,45,35,30,30,20,20
fit=F1:120,F2:310,F3:106,F4:64
context_manifests=16
context_sources=47
context_usage=CTX-01:13,CTX-02:16,CTX-03:25,CTX-04:14,
              CTX-05:16,CTX-06:24,CTX-07:28,CTX-08:24,
              CTX-09:24,CTX-10:11,CTX-11:10,CTX-12:7,
              CTX-13:12,CTX-14:8,CTX-15:12,CTX-16:33
```

原验证器本轮真实结果：

```text
records=600
probability=H:270,M:210,L:120
C=C1:3,C2:54,C3:187,C4:153,C5:203
D=D0:64,D1:171,D2:147,D3:153,D4:65
R=R1:7,R2:72,R3:198,R4:323
K=K0:3,K1:8,K2:63,K3:184,K4:342
S=S0:85,S1:151,S2:171,S3:193
F=F1:120,F2:310,F3:106,F4:64
[ok] 600 条提问语料结构门禁通过
```

这只能证明当前脚本识别到的 600 行满足其结构规则，不能证明能力、工具、风险和来源语义正确。`README.md:36` 也承认语义仍需独立评审；本报告正是该语义门。

## 3. A 级发现

### A-1 · `F1` 把合同前瞻误写成当前可执行能力

证据链：

- 语料自己的规则把“有代码、自动化证据或已收口合同”都纳入 `F1`（`00-能力边界.md:9`）。仅有合同并不等于运行时已经启用。
- canonical 明确规定产品缺省 `enabled_project_types=["coding"]`，本机才经 owner 开到 `coding+writing`；`research/marketing/general/planning` 仍未开启（`docs/09-data-contracts.md:1145`）。类型不在启用集时，`proposeStart/confirmAndDispatch` 必须以 `project_type_not_enabled` 拒绝（`docs/09-data-contracts.md:1357-1360`）。
- `research/marketing/general` 的执行器合同仍在 R-B/W8，`planning` 完整流程仍属 P3（`docs/plan/IMPLEMENTATION-PLAN-2.md:117-123,154`；`docs/05-roadmap.md:120,126`）。
- 浏览器、PDF、表格、演示、邮件、日历和 SaaS 明确属于有工具、登录态、网络与授权才可做的 `F2`（`00-能力边界.md:24-32`）。
- Claude Code 仍欠真实 hook/live conformance，不能用候选实现外推生产已关门（`HANDOFF.md:60`）。

全量扫描结果：120 条 `F1` 中，49 条不在 ENG/WRT 两个当前执行主型；另有 29 条 `F1` 至少列了 `browser/pdf/spreadsheet/slides/email/calendar` 或典型 SaaS 工具。这里不是说 29 条都必须降档：本地浏览器测试等 coding 场景可保留，但必须逐条证明是当前本地执行路径，不能靠工具名猜。

直接冲突的代表：

- `MKT-001`、`MKT-011`、`MKT-013` 均为 marketing 任务却标 `F1`（`questions/07-marketing-growth.md:7,17,19`）；marketing 执行器尚未开启，应为 `F3`，或把题面收窄成“不进入 SayDo 执行闭环的单次草稿”后标 `F2`。
- `PRJ-008`、`PRJ-054` 标 `F1`，同时依赖日历/表格并落在未启用 planning/general 流程（`questions/02-product-project.md:14,65`）。
- `RES-019`、`LRN-001`、`LRN-013`、`LIF-013`、`CAR-010`、`FAM-010` 标 `F1`，但都依赖外部日历/表格/通知或非当前项目类型（各文件 `:25`、`:7`、`:19`、`:19`、`:21`、`:16`）。
- `WRT-032` 题面只要求本地打包给用户审，工具却含 `email`；若不发送，最小修复是移除 `email` 并重算 K；若确实外发，则应为 `F2`（`questions/03-writing-content.md:38`）。

最小修复：

1. 把 `00-能力边界.md:9` 改成“当前代码路径已启用且有现场/自动化证据”，删除“仅合同已收口即可 F1”。
2. 按当前启用类型重跑 120 条 F1：coding 与 writing 窄版逐条保留；marketing/research/general/planning 的正式闭环先降 `F3`；只做一次性本地草稿且不要求正式执行器者可判 `F2`。
3. 对含 connector 工具的 F1 逐条二选一：删除题面不需要的工具并重算 K，或降 `F2`。
4. 将“本机 effective 开值”与“产品默认能力”分别写入元数据，不能再从 owner 本机 writing 开值外推全部用户。

### A-2 · 三个关键上下文宣称的权威来源实际不存在或不可消费

canonical 要求关键 claim 的支持同时满足完整性、新鲜度、引文匹配和语义支撑；stale 不能直接消费，须新快照重验（`docs/09-data-contracts.md:470-484`）。当前三个包达不到这一最低线：

1. `CTX-05`：manifest 的截止日是 2026-08-01，评审日已是 2026-08-26；法规、价格、竞品事实必须重联网（`contexts/CTX-05/manifest.md:5`）。但 `source-register.md:5-8` 中官方统计仍是“待抓取快照”、监管指南“待逐条核验”、行业白皮书“可能过时”，也没有 URL、标题或正文快照。`RES-016`、`RES-025` 仍标 `F1` 且无 browser；尤其 `RES-025` 题面说“十份材料”，包内只有三份文件，无法完成。
2. `CTX-07`：manifest 把“正式 RFP”放在最高权威（`contexts/CTX-07/manifest.md:4`），实际三份来源是 account brief、一次 discovery call 和安全预问卷，没有 RFP。安全预问卷还明确第 4、5 项只有草案（`security-questions.md:12`）。这会让 28 条引用中的模型误以为存在正式合同级来源。
3. `CTX-13`：医疗包把“医疗机构书面指示”列为最高权威（`contexts/CTX-13/manifest.md:5`），实际没有任何医疗机构原文。`care-notes.md:4-9` 只是家属二手记录，并明确两张用药清单剂量冲突、须专业人员核对。对 `LIF-005`、`FAM-003` 等医疗准备题，不能把这份记录升级成医学权威。

最小修复：

- `CTX-05` 要么补入带捕获日、原始 URL/标题、正文摘要与快照状态的合成官方来源，要么把所有事实设为 `unknown/stale`，相关题必须带 browser 且为 `F2/F3`。
- `CTX-07` 将权威顺序改为具体文件级：`discovery-call.md` 客户原话与 `security-questions.md` 书面要求按 claim 维度最高，`account-brief.md` 仅 CRM 摘要；不要写不存在的 RFP。
- `CTX-13` 要么新增脱敏的机构书面指示，要么明确“本包无一手医疗指示”，所有药物/诊断相关 claim 固定为 unknown，并只允许整理、提问和转交专业人员。

### A-3 · RAG 绑定存在成批“有包但无支撑”的语义断链

`01-设计与分布.md:93-98` 声称包用于权威顺序、时间边界、冲突和可回查来源；但 RAG 列目前更像按领域关键词复用，不是按题面所需 claim 绑定。代表性断链如下：

- `CTX-14` 是 120 人社区维修日，却绑定到 500 人大型活动 `OPS-037`（`questions/05-business-operations.md:48` 对 `contexts/CTX-14/manifest.md:3`），还绑定年度报告 `WRT-039`、全国倡议 `MKT-045`、社区灾害准备 `FAM-018`、一年期项目组合 `PRJ-070`。包里没有这些任务的年度、全国、灾害或 500 人证据。
- `CTX-16` 是三家工单/知识库供应商采购，却被用于仓库安装脚本审计 `ENG-072`、内部手册 RAG 架构 `ENG-082`、软件交付审计包 `ENG-116`、公共部门计划 `PRJ-066`、监管披露 `WRT-070`、客服工单自助化 `RES-042/OPS-018`、供应商绩效历史看板 `DAT-023`、客户认证课程 `LRN-022`。RFP 只给采购必须项、三家自报与评审规则（`contexts/CTX-16/rfp-summary.md:3-9`、`vendor-responses.md:3-7`），不含上述事实。
- `CTX-15` 是指标合同/埋点重复异常，却绑定到数据库慢查询 `ENG-012`；包里没有 SQL、执行计划、索引或 schema 变更（`questions/01-software-it.md:18` 对 `contexts/CTX-15/lineage-notes.md:3-11`）。
- `CTX-09` 只有季度汇总、费用政策和差异假设，却绑定发票逐张核验 `OPS-004`、续费工具清单 `OPS-006`、待审批记录 `OPS-020`、脏表清洗 `DAT-001`、活跃席位成本 `DAT-012`、现金流 `DAT-027` 和融资资料室 `DAT-030`；所需明细均不存在。
- `CTX-08` 有品牌规则、聚合漏斗和素材库存，但没有实际页面/帮助文、客户和竞品语料、通知触达明细；因此不能直接支撑 `WRT-012`、`WRT-052`、`RES-034`、`MKT-008`、`MKT-027`、`MKT-033`、`DAT-013`。
- `CTX-04` 没有访谈全文、待审稿或定稿，却绑定“挑原话”`WRT-026`、“审这篇稿”`WRT-031`、“打包定稿”`WRT-032`、整本书 `WRT-057` 和嘉宾机会 `MKT-032`。`source-notes.md:3-7` 甚至明确外部材料尚不可引用。

这类问题不能靠模型“回答时更谨慎”修复；包内根本没有题面输入。它会把 RAG 评测变成“模型是否善于虚构缺失输入”。

最小修复：对所有 297 次 context 引用建立一份机械 `questionId → required claims → supporting file/line → freshness requirement` 对账；任一 required claim 无来源时，只能三选一：移除 RAG、换正确包、补来源。不得用“同一领域”代替语义支撑。

### A-4 · `validate.mjs` 存在可复现的结构假绿

本轮在 `/tmp` 复制件做了三次无污染变异测试，源目录未改：

1. 在问题表追加一条九字段完整但 ID 非法的 `ENG-121X`。表格记录扫描得到 601 行，验证器仍输出 `[ok] 600 条提问语料结构门禁通过`、退出 0。原因是 `validate.mjs:39` 先用合法 ID 正则筛行，所有非法记录被静默忽略。
2. 从 `CTX-03/manifest.md` 删除 `milestones.md` 链接，目录仍有 4 个文件、manifest 只剩 2 个链接，验证器仍退出 0。原因是行 77-78 只看目录文件数，行 119-127 只要求 manifest 至少两个链接，不要求“所有来源文件恰好被 manifest 登记”。
3. 把 `ENG-001` 从 `K1 | repo` 改成 `K2 | repo,repo`，验证器仍退出 0。原因是行 56-68 按数组长度计数，没有校验工具唯一性。

静态检查还发现：

- `validate.mjs:122` 对 HTTP 和绝对路径链接直接 `continue`，因此外部链接既计入“至少两个来源”，又不验证可达性或快照；
- 不校验 context 集恰好是 `CTX-01..16`，也不校验 manifest 的权威顺序、时间边界、冲突、允许推断或支撑度；
- 不校验记录所在文件与 ID 前缀相符；
- 不校验 F、C/D/R/K/S、工具与题意之间的语义一致性。

最小修复：

1. 先解析问题表中的所有候选数据行，再验证 ID；任何表格数据行不匹配合法 ID 必须报错，不能先过滤。
2. 工具先做唯一性断言，K 按 distinct family 计数。
3. manifest 改为可机读 schema，要求本地来源集合与目录来源文件 exact-set、每个来源有权威等级/claim scope/capturedAt/validUntil/status。
4. HTTP 来源必须有本地不可变快照与 digest；不能用“跳过检查”换绿灯。
5. 增加 `questionId → context support` 台账门；至少保证 required claim、来源和 freshness 三者齐全。

## 4. B 级发现

### B-1 · `F4` 混淆“用户要求越权”与“用户已经主动守住边界”

64 条 `F4` 逐条检查后，只有下列 11 条题面明确要求系统实施越权自动化，判 F4 没有歧义：

`ENG-120`、`PRJ-068`、`WRT-065`、`RES-059`、`OPS-053`、`SAL-043`、`MKT-043`、`DAT-035`、`LIF-029`、`CAR-020`、`FAM-020`。

其余 53 条多数只要求安全辅助，而且题面已明确把专业判断或正式动作留给人。例如：

- `LIF-005` 只整理症状时间线和问医生的问题，并明确“不判断病因”（`questions/10-personal-life-admin.md:11`）；
- `WRT-055` 只比较政策、起草差异说明，法律结论交法务（`questions/03-writing-content.md:66`）；
- `DAT-031` 只整理税务资料和待问会计的问题，不判断归类或申报（`questions/08-data-finance.md:47`）；
- `FAM-003` 只整理复诊材料，不改用药（`questions/12-household-family-community.md:9`）。

把这些安全请求也标 F4，会导致评测奖励不必要的拒绝，并看不出“安全部分可做但需工具”的 `F2` 与“越权部分必须拒绝”的 `F4` 差异。

最小修复：新增独立的 `boundary`/`professional_review_required` 标志。`F` 只回答当前能力匹配：安全资料整理按工具和周期标 `F2/F3`；只有题面要求诊断、法律结论、投资建议/交易或越权自动动作时标 `F4`。如果坚持所有专业边界题都用 F4，则必须在 `00-能力边界.md` 明文重定义，不能继续称“能力匹配”。

### B-2 · D/F、S/效果和工具/K 的跨字段口径不稳定

结构计数全部满足最低覆盖，但语义上存在明显自相矛盾：

- `ENG-057` 的题面是“给三阶段迁移方案”。若 D 表示方案到可审阅，应是 D1/D2；若 D3 表示真实多周迁移，则与 `F1` 及“跨长时可靠 workflow 不能承诺”（`00-能力边界.md:32,44`）冲突（`questions/01-software-it.md:68`）。
- `CAR-010` 只要求“给十二周计划”却标 D3/F1；同理，若仅产计划应缩 D，若要持续执行则应 F3（`questions/11-career-freelance.md:21`）。
- `ENG-033` 只要求设计 dry-run/确认/恢复输出并明确“别一上来就删”，却按未执行的删除效果标 S3；`ENG-067` 只做插件机制设计审查也标 S3。风险应按本轮允许产生的最高效果，而不是主题未来可能包含的动作。
- `WRT-037` 只做投稿格式检查且“最终投稿由我确认”，工具仍含 `e-sign,email` 并标 S3；若本轮不投稿，应删工具并重算 K/S；若流程含投稿，则必须在题面写清 S3 停点。
- `WRT-032` 的 `email`、`PRJ-054` 的 `spreadsheet` 等工具没有被题面要求，存在为了达到 K 档而扩工具面的嫌疑。

最小修复：为 D 增加“到首个可审阅产物”还是“端到端任务周期”的唯一口径；S 增加 `effect_scope=draft/read/execute`；工具只列本轮确需调用的 family，再机械推 K，禁止先定 K 后补工具。

### B-3 · 多数 manifest 没有可判定的新鲜度字段，和设计声明不符

`01-设计与分布.md:93` 声称每个 manifest 明确时间边界。逐包检查后，`CTX-04/06/07/08/09/11/13/16` 没有可判定的捕获截止或有效期；`CTX-10` 只有考试日期，没有大纲版本/捕获日。典型问题：

- `CTX-06` 说“最近四周”，但 W1-W4 没有实际日期；
- `CTX-08` 说“最近 28 天”，但没有结束日；
- `CTX-09` 说第三季度与 7-8 月实际，却没写年份、as-of 或关账批次；
- `CTX-16` 的价格、产品功能与厂商回复没有回复日期/有效期。

最小修复：每个包和每份时变来源至少写 `capturedAt`、`validUntil` 或明确 `immutable_event_window`；超过有效期时必须要求 browser 刷新或把相关 claim 标 stale。日期不能只藏在自然语言标题里。

### B-4 · 权威顺序需要按 claim 维度，而不是单一全序

- `CTX-03` 链接了 `milestones.md`，但权威顺序只排名 launch brief 与 stakeholder notes；里程碑是草案还是批准计划未定义（`contexts/CTX-03/manifest.md:5,11-13`）。
- `CTX-11` 把 accomplishment bank 整体排在 job requirements 之前。候选人事实应以 accomplishment bank 为准，但目标岗位要求只能以 job requirements 为准；单一总序会在岗位匹配题中覆盖错维度（`contexts/CTX-11/manifest.md:4-5`）。
- `CTX-13` 的 care calendar 与 coordination rules 没进入权威顺序，实际却分别是日程与隐私/协作规则的重要来源。

最小修复：manifest 用 `claimScope` 声明来源权威，例如 `candidate_fact`、`target_requirement`、`schedule`、`medical_fact`、`privacy_rule`，同一来源可以在不同 claim scope 有不同等级。

## 5. 16 个上下文包逐包结论

| 包 | 引用数 | 权威/时效 | 支撑结论与代表 ID |
|---|---:|---|---|
| CTX-01 | 13 | [ok] 合同 > 反馈，截止日与“所有字段”冲突清楚 | [ok] 账单导出任务基本可支撑；不得把三访谈外推全客户。 |
| CTX-02 | 16 | [ok] 时间线 > UTC 日志 > 旧 runbook，冲突显式 | [ok] 事故复盘、交接、状态沟通可支撑；代表性日志不可重算总失败数。 |
| CTX-03 | 25 | [warn] 有发布日期，但 milestones 未定权威状态 | 多数发布题可支撑；API v2/真实 usage 等仍需 repo/monitoring，不能只靠本包。 |
| CTX-04 | 14 | [warn] 作者归属顺序正确；外部来源无题名/链接/快照且明确待核验 | [fail] 缺访谈全文和待审稿，不能支撑 WRT-026/031/032/057、MKT-032。 |
| CTX-05 | 16 | [fail] 截止 2026-08-01，官方/监管来源仍待抓取核验 | [fail] RES-025 的“十份材料”和 MKT-012/018/037 的事实输入不足；实时任务必须 browser 刷新。 |
| CTX-06 | 24 | [warn] SOP > 个案清楚；“最近四周”无结束日 | [warn] 运营流程题可支撑；无授权案例/客户级报表，WRT-009/053、MKT-009 不足。 |
| CTX-07 | 28 | [fail] 最高权威“正式 RFP”不存在；安全题两项只有草案 | [fail] 销售发现题大多可用；ENG-061/071、RES-004、OPS-036 缺架构/多访谈/系统清单。 |
| CTX-08 | 24 | [warn] 品牌 > 指标 > 素材合理；28 天窗口无结束日 | [fail] 缺实际页面、文案、客户/竞品语料和触达明细，不能支撑 WRT-012/052、RES-034、MKT-008/027/033、DAT-013。 |
| CTX-09 | 24 | [warn] 预算 > 政策 > 假设合理；无 as-of/关账批次 | [fail] 聚合数不能支撑 OPS-004/006/020/025、DAT-001/012/027/030 的明细任务。 |
| CTX-10 | 11 | [warn] 大纲 > 错题 > 时间合理；缺大纲版本/捕获日 | 学习计划题大多可支撑；没有教材与勘误，WRT-069 不支撑。 |
| CTX-11 | 10 | [warn] 事实不造假纪律好；单一全序跨 claim 失真 | [ok] 简历/面试题总体可支撑；岗位要求与候选事实应分域定权威。 |
| CTX-12 | 7 | [ok] 硬约束 > 计划 > 报价，报价有效期显式 | [ok] 搬家题可支撑；执行时仍须复核报价与保险。 |
| CTX-13 | 12 | [fail] 宣称的一手医疗指示不存在；家属记录有用药冲突 | [fail] 可做照护行政整理；LIF-012、FAM-006 超出包内容，任何医疗事实不得升级。 |
| CTX-14 | 8 | [ok] 场地安全 > 活动 brief > 排班，日期明确 | [fail] 只支撑本次 120 人维修日；OPS-037、PRJ-070、WRT-039、MKT-045、FAM-018 明显错绑。 |
| CTX-15 | 12 | [ok] 指标合同 > 血缘 > 异常假设，截止日明确 | [warn] 指标题可支撑；ENG-012 的 SQL 慢查询完全不在包内。 |
| CTX-16 | 33 | [warn] 评审规则 > RFP > 厂商自报正确；缺回复/价格日期 | [fail] 采购题可支撑；被过度复用到代码供应链、交付审计、监管披露、客服数据、课程等无来源任务。 |

## 6. C 级建议

### C-1 · 区分“预置上下文”与 `rag` 工具调用

当前有些带 CTX 的记录不列 `rag`，也有许多 `rag` 工具记录的 RAG 列为 `-`。这可以解释为“RAG 列是评测预加载，工具列是运行时检索”，但文档没有把两者的计费与 K 口径说死。建议在 `01-设计与分布.md` 增加一句：预加载 CTX 是否计入 K、何时必须列 `rag`、`rag + browser` 分别代表什么，避免下游各自理解。

### C-2 · 给 context 包增加用途白名单

除来源元数据外，每个 manifest 可增加 `supportedTasks`/`unsupportedTasks`。例如 CTX-15 可写“支持指标口径、血缘、埋点异常；不支持 SQL 性能、索引与 schema 迁移”。这会比只靠标题更有效地阻止错绑。

## 7. 总判定与必须修清单

总判定：`[fail]`，A 级 4 组，B 级 4 组，C 级 2 组。结构数量通过，但能力真相、专业边界和 RAG 支撑尚未达到可作金标的标准。

必须修清：

1. [ ] 收紧 F1 定义，以“当前启用且有实现证据”为准，重判 120 条 F1，重点修 marketing/planning/general 与 connector-dependent 条目。
2. [ ] 修复 CTX-05、CTX-07、CTX-13 的虚空权威源；没有一手/新鲜来源时必须明确 unknown/stale。
3. [ ] 对 297 次 RAG 引用做 claim-to-source 全量对账，先修 CTX-14、CTX-16、CTX-09、CTX-08、CTX-04、CTX-15 的代表性错绑。
4. [ ] 修 `validate.mjs` 的非法行静默忽略、工具重复凑 K、manifest 来源集合不闭合与外部链接跳检假绿。
5. [ ] 把安全辅助与越权请求拆开：重判 53 条“已主动守边界”的 F4，或新增独立专业边界标签。
6. [ ] 统一 D 的计时对象、S 的实际 effect scope、工具到 K 的派生规则，修 ENG-057、CAR-010、ENG-033、WRT-037、WRT-032 等跨字段矛盾。
7. [ ] 为全部 16 个 manifest 补可机读的 claimScope、capturedAt/validUntil、冲突和支持范围；重跑结构门、全仓 emoji 门及独立语义复审。

只有以上 1-4 关闭后，才可把语料标为“能力/RAG 主门通过”；5-7 至少应在发布前完成或由 owner 明确接受残余风险。
