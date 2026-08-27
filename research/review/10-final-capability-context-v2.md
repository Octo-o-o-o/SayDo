# SayDo 600 条潜在客户提问语料能力与 RAG 终审 v2

- 审查日期：2026-08-26
- 审查方式：全新零上下文、只读语义终审
- 结论：`[fail]`
- 阻断原因：4 组 A 级问题，分别涉及一条效果风险低标、两个 CTX-only 学习问题的事实假闭合、一个 CTX-only 求职问题缺关键用户选择，以及 CTX-14 三条 required claim 的来源正文不支撑。

## 1. 实际读取范围与隔离声明

本轮完整读取：

- 仓库根 `AGENTS.md`；
- `research/customer-question-corpus/README.md`；
- `00-能力边界.md`、`01-设计与分布.md`、`03-频率与语义校准.md`；
- 12 个 `questions/*.md`，共 600 条记录；
- 16 个 `contexts/CTX-*/manifest.md`；
- 49 个 manifest 登记的来源文件；
- `validate.mjs` 全文。

为核验 F1/F2/F3/F4，还读取了当前事实源：

- `HANDOFF.md`；
- `docs/02-product-definition.md`、`docs/04-key-mechanisms.md`、`docs/05-roadmap.md` 及 `docs/10-voice-ux-spec.md` 的相关能力、状态、安全与回叫段落；
- `packages/daemon/src/config/types.ts`、`packages/daemon/src/tier1/typeGate.ts`、`packages/contracts/src/readiness.ts`、`packages/daemon/src/tier1/validateConfig.ts`；
- `packages/daemon/src/tier1/executor.ts`、`packages/daemon/src/tier1/s3Tools.ts` 的 settle、回叫与 S3 合并相关段落；
- `packages/daemon/src/callback/engine.ts`、`ack.ts`、`arbitration.ts`；
- `packages/daemon/src/memory/fts.ts`、`retrieval.ts`、`classify.ts`；
- `packages/daemon/src/brain/liveTools.ts` 的工具装配与 readiness 相关段落。

`02-覆盖索引.md` 只由限定 emoji 门机械扫描，没有作为语义判断输入。

为保持零接触，本轮没有读取：

- `research/customer-question-corpus/review/` 下任何既往报告；
- `research/codex-findings/`、`prompts/`、`history/`、`logs/`；
- `rebuild.mjs` 正文；
- `git diff`。

本报告是唯一新增仓库文件；没有修改 questions、contexts、validator、构建脚本、canonical 或说明文档，也没有 commit。

## 2. 全量计数与结构门结果

正式语料 validator 的真实命令与退出码：

```text
$ node research/customer-question-corpus/validate.mjs
validator_exit=0
records=600
K0=35 K1=124 K2=345 K3=91 K4=5
S0=213 S1=181 S2=180 S3=26
F1=48 F2=494 F3=47 F4=11
B0=417 B-AUTH=104 B-PRIV=30 B-ID=6 B-LEG=14 B-MED=13 B-ATTR=2 B-FIN=14
USER_token=137 LIVE_token=480 no_external_input=15
CTX_refs=172
[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
```

16 包逐包计数结果：

| Context | 引用数 | required claim 行 | CTX-only | 补充输入 `-`/USER/LIVE |
|---|---:|---:|---:|---:|
| CTX-01 | 13 | 13 | 4 | 4/0/9 |
| CTX-02 | 12 | 12 | 0 | 0/3/9 |
| CTX-03 | 22 | 22 | 7 | 7/0/15 |
| CTX-04 | 6 | 6 | 1 | 1/5/0 |
| CTX-05 | 10 | 10 | 0 | 0/0/10 |
| CTX-06 | 15 | 15 | 2 | 2/1/12 |
| CTX-07 | 16 | 16 | 5 | 5/0/11 |
| CTX-08 | 15 | 15 | 1 | 1/3/11 |
| CTX-09 | 8 | 8 | 1 | 1/0/7 |
| CTX-10 | 9 | 9 | 6 | 6/1/2 |
| CTX-11 | 9 | 9 | 3 | 3/2/4 |
| CTX-12 | 4 | 4 | 0 | 0/0/4 |
| CTX-13 | 6 | 6 | 2 | 2/0/4 |
| CTX-14 | 3 | 3 | 0 | 0/0/3 |
| CTX-15 | 11 | 11 | 1 | 1/0/10 |
| CTX-16 | 13 | 13 | 4 | 4/2/7 |
| 合计 | 172 | 172 | 37 | 37/17/118 |

37 条 CTX-only 记录已全部逐条复核：

```text
ENG-046
PRJ-001 PRJ-002 PRJ-009 PRJ-012 PRJ-032 PRJ-034 PRJ-047 PRJ-054
WRT-008 WRT-013 WRT-015 WRT-043 WRT-045 WRT-050
RES-017 RES-019
SAL-005 SAL-006 SAL-007 SAL-023 SAL-029
MKT-011
DAT-003 DAT-009
LRN-001 LRN-002 LRN-003 LRN-006 LRN-008 LRN-012 LRN-015
CAR-001 CAR-003 CAR-005
FAM-003 FAM-011
```

结构、来源集合、digest、白名单和补充输入的集合对称性全部通过，但这不证明正文语义支撑；`README.md:54` 和 `validate.mjs:355-394` 也明确留下了这条人工复核边界。

## 3. A 级发现

### A-1 DAT-017 将数据库迁移与回填低标为 S0

`questions/08-data-finance.md:30` 要求“把指标从手工表迁到仓库”，并明确包含变换、刷新和回填，工具含 `database` 与 `bi`，却标为 `S0`。

这不是非敏感只读。canonical 把 S0 定义为读，把工作树内写定义为 S1，把出圈可逆写定义为 S2（`docs/04-key-mechanisms.md:132-141`）。向数据仓库迁移并回填至少是工作树外状态写入，应至少标 `S2`；若题面允许直接改生产且缺回滚，还需继续上浮。

该问题满足本任务的“安全低标”A 级定义。正式 validator 仍 exit 0，因为现有外部写 regex 只覆盖少数显式词形（`validate.mjs:231-239`），没有覆盖“迁到仓库/回填”。

修复要求：把 DAT-017 至少改为 `S2`，并在题面或目的中明确 dry-run、目标环境、回填回滚与人工确认点。

### A-2 CTX-10 对 LRN-003 和 LRN-008 形成 CTX-only 假闭合

LRN-003：

- 问题要求“今天的错题”（`questions/09-learning-development.md:12`）；
- manifest 宣称来源支持“当天可复盘的五类错题”（`contexts/CTX-10/manifest.md:31`）；
- `mistake-log.md:1-9` 只说“最近两次模拟题”，没有日期，也没有把五类错误绑定到今天；
- `time-constraints.md:3-7` 只支持通勤口头复盘偏好。

因此来源能支持“五类历史错题”和“口头复盘偏好”，不能支持“今天”。该行是 CTX-only，没有 USER/LIVE 补充，回放若回答“今天的五类错题”只能编造时间归属。

LRN-008：

- 问题要求按“我真正会的内容”保留分享内容（`questions/09-learning-development.md:43`）；
- manifest 宣称来源支持“真正掌握与仍易错的认证主题”（`contexts/CTX-10/manifest.md:32`）；
- `exam-outline.md:5-13` 只有考试领域、权重和官方建议；
- `mistake-log.md:3-9` 只有错误与两次总分，没有任何正向掌握证据。

因此可以识别薄弱点，不能断言“真正掌握”。该行同样是 CTX-only。

修复要求：LRN-003 改为 USER/带日期 fixture，或把“今天”改为“最近两次”；LRN-008 增加带题目维度的正向掌握记录或 USER 自评，不能从“没有列入错题”反推掌握。

### A-3 CAR-005 缺少目标岗位选择

`questions/11-career-freelance.md:31` 要求“根据岗位”写针对性求职信，当前模式却是 CTX-11，无 USER。

`contexts/CTX-11/job-requirements.md:1-9` 同时给出 A、B、C 三类岗位，并明确三者差异。相邻 CAR-002 已正确要求用户确认本轮选择的岗位（`contexts/CTX-11/manifest.md:30`），CAR-005 却只登记岗位共性且无补充输入（`manifest.md:32`）。在不知道 A/B/C 哪一个是目标时，无法生成“针对性强”的单岗求职信。

required claim 行本身的“背景、共性、经历”有来源，但问题所需关键选择未闭合。若直接选岗位会编造用户意图，若只写共性信则达不到目的。

修复要求：把 CAR-005 改为 `CTX-11+USER`，并在 supplemental input 要求选择 A/B/C 或提供具体岗位正文。

### A-4 CTX-14 三条 required claim 均声称不存在的“场地退回意见”

`contexts/CTX-14/manifest.md:29-31` 对 FAM-008、FAM-014、OPS-051 三条都声称三个列出的来源提供“场地退回意见”。正文不支持：

- `venue-rules.md:3-8` 只有开放时间、消防、设备、未成年人和数据保留规则；
- `volunteer-roster.md:3-9` 只有技能/时段聚合和“两位尚未确认最终时段”；
- `event-brief.md:3-5` 只有活动目标、预算与产物。

尤其 FAM-014 的题面说“场地刚退回安全方案，两位志愿者也改了时段”（`questions/12-household-family-community.md:39`）。fixture 既没有退回意见，也没有“两位已改时段”，只有“两位尚未确认”。LIVE 能要求现场补充，但不能反向证明 manifest 列出的 fixture source 已支持这些 frozen claims。

修复要求：增加带日期的 `venue-feedback.md` 与志愿者变更记录并登记 digest，或删去 manifest 中不存在的 claim；FAM-014 还必须把补充 LIVE 精确限定为场地退回意见、已确认报名和时段变更记录。

## 4. B 级发现

### B-1 三条必需工具族不对应实际产物

1. PRJ-005（`questions/02-product-project.md:16`）要读取多个在途项目的阻塞与运行状态，却只列 `shell`。shell 不是项目状态事实源；应至少是 `tasks`，若依赖持久义务还应使用 `memory` 或实际项目系统。
2. PRJ-006（`questions/02-product-project.md:18`）要生成 kickoff 包，却列 `test,tasks`。题面没有可运行测试，主产物是文档包；`document,tasks` 更符合任务。
3. PRJ-018（`questions/02-product-project.md:36`）要做“能点的轻 Demo”，却只有 `tasks,document`。这两族不足以创建或验证可交互原型，应含 `design` 和 `browser`，若实现为仓库原型还应含 `repo`。

三行的 K 数量都能机械对上，因此 validator 不报错；问题在工具语义而非计数。

### B-2 六条明确授权边界仍标 B0

`00-能力边界.md:78` 把发送、发布、部署、删除、签署、下单或客户承诺定义为 `B-AUTH`。以下题面明确保留了这类人工授权，却标 `B0`：

- PRJ-066：外发由人审批（`questions/02-product-project.md:150`）；
- WRT-059：本地专家签字（`questions/03-writing-content.md:136`）；
- OPS-052：外部承诺由指挥人发（`questions/05-business-operations.md:120`）；
- SAL-038：正式投标人工提交（`questions/06-sales-customer-procurement.md:83`）；
- DAT-030：发给投资人之前停住（`questions/08-data-finance.md:76`）；
- LRN-025：申请由用户提交（`questions/09-learning-development.md:68`）。

这些限制虽然写进自然语言，但 B 字段的用途正是让评测与产品行为可机械识别主边界。建议统一改为 `B-AUTH`；若某条有更主要的专业边界，应在逐条裁决后只保留一个主标签。

### B-3 三条实际文档/台账写入标成 S0

- OPS-035 把 OCR 结果写成台账（`questions/05-business-operations.md:87`）；
- WRT-059 维护五种语言政策手册（`questions/03-writing-content.md:136`）；
- WRT-064 把评论合并为标准草案（`questions/03-writing-content.md:144`）。

按 `docs/04-key-mechanisms.md:138-140`，这些至少是 S1 工作区写入，而不是 S0 只读。它们不像 DAT-017 那样必然写入外部数据库，因此列为 B，而不是 A。

### B-4 MKT-011 的“可用证据”只得到部分支持

`contexts/CTX-03/manifest.md:33` 称 `launch-brief.md + stakeholder-notes.md` 支持消息屋中的“可用证据”。正文能支持目标客户、首发范围、成功标准、客户可能追问、未批准群发和不能承诺的能力（`launch-brief.md:3-14`，`stakeholder-notes.md:3-9`），但没有已实现效果、客户采用或问题强度证据。

MKT-011 是 CTX-only（`questions/07-marketing-growth.md:57`）。安全输出可以把产品范围事实放进“事实依据”，并把效果证据留空，但 manifest 当前的“可用证据”容易被理解为已有价值证明。建议改成“可引用的批准范围与待验证成功标准”，或补带来源的采用/客户证据。

## 5. C 级发现

### C-1 WRT-004 风险过度上浮到 S3

`questions/03-writing-content.md:14` 只要求在草稿中重写并删去无原始来源的数字，没有发送、发布、删除外部数据或其他不可逆 effect，却标 `S3/B-AUTH`。按 canonical 应是工作树内文档写入 `S1`；只有题面增加对外发布或实际删除外部源数据时才会上浮 S3。

这是保守方向的误标，不会绕过安全门，但会污染风险分布并让评测产生不必要的强认证预期。

### C-2 validator 的 mutation 结果证明其边界是结构/登记，不是语义

validator 对精确登记的工具和风险锚、来源空文件、digest 漂移有良好防护；但正式语料中的 DAT-017、CTX-10 与 CTX-14 仍能在 exit 0 下存在。该限制与 `README.md:54` 的声明一致，不构成 validator 实现违约，但后续不能把“validator 绿”写成“能力与来源语义绿”。

## 6. 16 包、172 条引用的正文语义对账

判定单位是每条 required claim 的全部分句是否都能在所列来源正文找到，不以摘要、digest 或集合对称替代。结果为 166 条完整支撑、6 条部分支撑；部分支撑即不满足 required claim 合同。

| Context | 正文语义结果 | 说明 |
|---|---|---|
| CTX-01 | 13/13 完整 | brief、反馈与每题 claim 对应；LIVE 缺口明确 |
| CTX-02 | 12/12 完整 | 时间线、日志、旧 runbook 的事实与冲突可定位 |
| CTX-03 | 21 完整，1 部分 | MKT-011 的“可用证据”缺效果/采用支撑，见 B-4 |
| CTX-04 | 6/6 完整 | 作者观点、来源状态、风格与 USER 正文边界清楚 |
| CTX-05 | 10/10 完整 | 冻结外部快照、访谈和 source register 保留新鲜度限制 |
| CTX-06 | 15/15 完整 | SOP、四周指标、工单样本支持流程与误区 claims |
| CTX-07 | 16/16 完整 | 账户、原话、安全问题及未知项归属清楚 |
| CTX-08 | 15/15 完整 | 品牌、漏斗、素材；USER/LIVE 的实验和地域缺口明确 |
| CTX-09 | 8/8 完整 | 预算、实际、承诺、政策与待确认差异分层明确 |
| CTX-10 | 7 完整，2 部分 | LRN-003 缺“当天”；LRN-008 缺“真正掌握”，见 A-2 |
| CTX-11 | 9/9 claim 文本完整 | CAR-005 的 required claim 有来源，但题目仍缺目标岗位选择，见 A-3 |
| CTX-12 | 4/4 完整 | 搬家计划、报价与硬约束均有正文 |
| CTX-13 | 6/6 完整 | 医嘱、家属记录、日历、隐私规则权威边界清楚 |
| CTX-14 | 0 完整，3 部分 | 三行都缺“场地退回意见”；FAM-014 另缺已改时段，见 A-4 |
| CTX-15 | 11/11 完整 | 指标合同、血缘、异常日期与 LIVE 原始事件缺口清楚 |
| CTX-16 | 13/13 完整 | RFP、评审规则与厂商自报的证据等级和未答项清楚 |

## 7. 工具、K、输入、风险、能力与边界的全量结论

### 7.1 工具与 K

- 600 条工具数组均去重，全部来自登记词表；K0-K4 的数量与工具个数机械一致。
- 35 条 K0 和 5 条 K4 已逐条核对，没有发现为了凑 K 而给 K0 伪加工具或 K4 缺六族的问题。
- 发现 3 条高置信工具语义错配，见 B-1；因此工具/K 总结为 `[fail]`，不能因计数正确判绿。

### 7.2 USER、LIVE 与 CTX 输入闭合

- 137 条含 USER、480 条含 LIVE；validator 证明所有 manifest supplemental token 与问题行集合对称。
- 172 个 CTX 引用全部落在白名单，来源文件集合、路径和 digest 闭合。
- 37 条 CTX-only 全量复核发现 LRN-003、LRN-008、CAR-005 三条关键假闭合；MKT-011 另有证据措辞过宽。
- CTX-14 的三条虽然带 LIVE，但 frozen required claim 仍错误宣称 fixture 已有事实，不能以 LIVE 对称性洗掉来源缺口。

### 7.3 S0-S3

- 26 条 S3 与 11 条 F4 已逐条复核；显式发送、提醒、预订、支付、发布、部署或越权请求大体守住强门。
- DAT-017 是 A 级 S0 低标；OPS-035、WRT-059、WRT-064 是 B 级 S0 低标。
- WRT-004 是保守方向的 S3 过标。

### 7.4 F1-F4 与当前实现

F 标签总体与当前实现边界一致，本轮没有发现需要新增的 A/B 级 F 错标：

- F1 48 条集中在 coding 执行、状态、记忆和受治理闭环。缺省类型确为 `coding`（`packages/daemon/src/config/types.ts:113-122`），类型门对未启用类型 fail-closed（`tier1/typeGate.ts:14-32`）。
- 当前记忆检索会以 active ledger 过滤 FTS 残影并保留 provenance（`memory/retrieval.ts:61-82`），第三方内容不能把 M0 直接写成可信（`memory/classify.ts:54-97`）。
- settle 将 run、task `ready_for_review`、回叫 outbox 与审计放在同一事务（`tier1/executor.ts:2665-2725`）；回叫缺 proof 不入队（`callback/engine.ts:25-35,71-86`）。
- S3 merge 需要消费过的强认证挑战与专用收据，generic screen/S2 收据拒绝（`tier1/s3Tools.ts:284-305,421-442`）。
- F2 494 条承认 connector、登录态、网络、人工验收或 writing 开值条件；这与 `00-能力边界.md:21-32` 相符。
- F3 47 条覆盖正式 research/marketing/planning workflow、多任务与长期自治等路线图能力；代码中的 research/marketing/planning checklist 明确只是前瞻，能力未开（`packages/contracts/src/readiness.ts:29-34,55-73`）。
- F4 11 条均为登记的越权题且全部 S3，安全回答应拒绝越权部分。

当前实现仍有必须保留的条件：缺省只开 coding；writing 需显式开值；Codex adapter 虽可出现在配置 schema，却会被 Tier1 以 unsupported adapter 拒绝（`packages/daemon/src/tier1/validateConfig.ts:191-216`）；电话 L2 仍是 P1（`callback/engine.ts:51-56`）；`HANDOFF.md:54-67` 记录真人场次与部分平台触点尚未关门。语料的 F1 定义已把这些前提写入条件，未发现把它们省略为无条件承诺的 F1 行。

### 7.5 B-*

- B-MED、B-LEG、B-FIN、B-PRIV、B-ID、B-ATTR 的高风险专业/身份/归属题逐条抽取后与题面主输出核对，没有发现会升级为 A 的专业越权漏标。
- B-AUTH 的定义与 104 条已标记录大体一致，但仍漏 6 条明确发送、提交、签字或承诺边界，见 B-2。

## 8. 临时副本 mutation

所有 mutation 均在 `/tmp/saydo-corpus-final-v2-mutations.RMYpGp` 的独立副本中进行；正式语料未改。

| Mutation | 改动 | validator 真实结果 |
|---|---|---|
| 工具错配 | ENG-002 `repo,test` 改为 `repo,git` | exit 1；`ENG-002 工具语义基线不符:repo,git，应为 repo,test` |
| 外部 effect 低标 | PRJ-045 `S3` 改为 `S2` | exit 1；同时报“含真实外部 effect 却未标 S3”和 exact risk 基线不符 |
| 空来源 | 清空 CTX-01 `product-brief.md` | exit 1；报来源过短或为空及 source digest 不匹配 |
| required claim 漂移 | CTX-01 PRJ-001 的 300 改为 301 | exit 1；报 required claims digest 不匹配 |

mutation 证明已登记锚点和内容完整性门有效；它也反衬出正文是否真的表达 claim、未登记词形是否低标，仍必须靠语义终审。

## 9. Emoji 门

限定语料范围的门只包含 README、00-03、validate、12 个问题文件、16 个 CTX 包及其来源，明确排除既往 review、rebuild 与其他禁读目录。

```text
$ bash scripts/check-emoji.sh <限定语料文件集>
corpus_emoji_exit=0
[ok] emoji gate: clean
```

报告文件的单独 emoji 门、最终 `wc -l`、字节数与 SHA-256 必须在报告写入结束后计算；为避免自引用改变报告自身摘要，这三项记录在本轮最终 handoff，而不写回本文件。

## 10. 收口条件

本轮不能给 `[pass]` 或 `[pass-with-warnings]`。至少完成以下修复并由新的零上下文审查重新跑全量后，才可考虑放行：

1. 修正 DAT-017 的风险与外部数据库写门；
2. 关闭 LRN-003、LRN-008、CAR-005 的关键输入假闭合；
3. 修正 CTX-14 三条 required claim 与来源正文；
4. 修正三条高置信工具错配；
5. 处理六条 B-AUTH 漏标与三条 S0 文档写低标；
6. 收窄 MKT-011 的证据措辞并纠正 WRT-004 的 S3 过标；
7. 重新生成 digest，运行 validator、限定语料 emoji 门和新的独立语义终审。

最终结论：`[fail]`。
