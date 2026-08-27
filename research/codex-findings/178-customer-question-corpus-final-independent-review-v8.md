# SayDo 600 条潜在客户提问语料 v8 最终独立对抗评审

最终裁决：`[fail]`

正式 validator 退出码为 0，但全量语义审计发现 2 个 A 级 RAG 假闭合和 1 个 B 级 validator 缺陷。结构完整、摘要固定和生成结果全等不能证明 LIVE 来源可实际读取或字段语义闭合。

## 1. 隔离与方法

隔离门有效：

- 未读取或搜索任何禁止目录、旧评审、实施过程、mutation 文件、Git 状态/历史/diff 或其他代理输出。
- 未运行 rebuild、mutation，未修改文件，未 commit。
- 读取了 README、00–04、12 个 questions、16 个 manifest、50 个 source、全部 465 个 LIVE contract、46 个 F1 contract，以及 validate/rebuild 和必要 canonical、能力代码。
- 逐条人工核对了 600 条 C/D/H/R/K/S/F/B、172 个 CTX claim、465 个 LIVE contract 和 986 个来源对象。
- 程序化遍历了全部 179,700 对问题；人工复核最高相似候选及跨域同构。
- `04-live-source-contracts.md` 的 465 个 LIVE 行和 46 个 F1 行通过 validator 逐行与 JSON 全等核对；语义判断以 JSON 源合同为准。

## 2. 全量计数

逐域 H/M/L 与设计配额完全一致：

| 领域 | 总数 | H | M | L |
|---|---:|---:|---:|---:|
| ENG | 120 | 54 | 42 | 24 |
| PRJ | 70 | 31 | 25 | 14 |
| WRT | 70 | 32 | 24 | 14 |
| RES | 60 | 27 | 21 | 12 |
| OPS | 55 | 25 | 19 | 11 |
| SAL | 45 | 20 | 16 | 9 |
| MKT | 45 | 20 | 16 | 9 |
| DAT | 35 | 16 | 12 | 7 |
| LRN | 30 | 13 | 11 | 6 |
| LIF | 30 | 13 | 11 | 6 |
| CAR | 20 | 9 | 7 | 4 |
| FAM | 20 | 10 | 6 | 4 |
| 合计 | 600 | 270 | 210 | 120 |

设计基线见 [01-设计与分布.md:80](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:80)。

其他全量统计：

- C：31 / 211 / 255 / 79 / 24
- D：D0 245、D1 294、D2 28、D3 3、D4 30
- H：H0 478、H1 22、H2 27、H3 32、H4 41
- R：R1 23、R2 421、R3 110、R4 46
- K：K0 36、K1 79、K2 336、K3 136、K4 13
- S：S0 134、S1 180、S2 253、S3 33
- F：F1 46、F2 483、F3 60、F4 11
- B：B0 310、B-AUTH 118、B-PRIV 85、B-FIN 37、B-LEG 24、B-ID 7、B-ATTR 8、B-MED 11
- 输入：LIVE 465、USER 192、自包含 15
- CTX：16 个 manifest、50 个 source、172 个 required claim
- LIVE：465 个合同、986 个对象来源
- F1：46 个逐题能力合同

## 3. 发现

### A-RAG-01：LIVE `required_fields` 大规模包含来源对象不可能提供的字段

全量 986 来源对象的保守字段审计发现：

| 明显异物字段组合 | 受影响来源 | 受影响合同 |
|---|---:|---:|
| 非 transcript 含 `speaker_id,utterance,timestamp` | 28 | 15 |
| 非 map 含 `route,duration` | 26 | 13 |
| 非邮件/消息/通话对象含 `email_address,thread_id` | 23 | 12 |
| 非任务/issue 对象含 `item_id,assignee,dependency` | 116 | 69 |
| 四类并集 | 186 | 102 |

这是保守下界，未把可能合理的财务表格等模糊情况计入。

直接证据：

- LIF-007 的 calendar、spreadsheet、finance、official-rule web 四类来源全部被填入说话人转写字段；finance 还带路线字段。[LIF.json:243](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/LIF.json:243)、[LIF.json:254](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/LIF.json:254)、[LIF.json:282](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/LIF.json:282)、[LIF.json:310](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/LIF.json:310)、[LIF.json:338](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/LIF.json:338)。
- RES-003 要比较五个竞品的定位、价格、核心流程、缺口并逐事实保留日期和来源，但唯一 web 对象登记的是金额、财务状态、assignee、dependency；没有竞品实体、定位、流程、缺口或逐事实 provenance 字段。[RES.json:127](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/RES.json:127)。
- WRT-002 的邮件线程被填入 CRM 和任务依赖字段。[WRT.json:6](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/WRT.json:6)。

这些合同无法指导 reader 从声明的对象取得声明字段，违反“题面所需字段、逐对象登记、不得模板兜底”的自身合同：[01-设计与分布.md:118](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:118)、[03-频率与语义校准.md:61](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:61)。

影响：工具存在也无法按合同读取对象，属于 A 级 RAG 假闭合。

### A-RAG-02：占位 locator 和“每工具一个来源”被计作已闭合对象注册表

全量只读统计原始输出：

```json
{
  "contracts": 465,
  "sources": 986,
  "userProvider": 752,
  "userProviderWithoutUserInput": 591,
  "currentUserConnectorLocators": 0,
  "asOfVariants": 1,
  "readerProjectionExact": 465,
  "contractsWithDuplicateReaderSource": 0
}
```

含义：

- 752 个 USER-provider 来源全部使用 `connector+...://USER-PROVIDED/...`；没有一个提供实际 connector instance、对象 ID、查询条件或可解析现势 locator。
- 其中 591 个所属题目甚至没有 `USER` 输入模式，缺少明确的“待用户补 locator”交互合同。
- 465 个合同的 reader 集合全部精确等于题目工具列中的 reader 投影。
- 没有任何合同为同一个 reader 登记两个来源对象；这与多网页、多竞品、多实体任务不相称。

具体反例：

- RES-001 要刷新三个国家的市场、生态、竞品和官方规则，却只有一个 `market_evidence_web` 占位 locator 和一组单 URL 字段。[RES.json:6](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/RES.json:6)。
- RES-003 要五个竞品逐事实来源，同样只有一个占位 web locator。[RES.json:127](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/RES.json:127)。
- PRJ-037 涉及 20 家客户，三个来源仍分别只是 CRM/calendar/forms 类型占位符，未登记账户集合、招募批次或表单实例定位。[PRJ.json:1645](~/WorkSpace/SayDo/research/customer-question-corpus/contracts/live/PRJ.json:1645)。

`USER-PROVIDED` 可以表示尚未满足的前置条件，但不能同时被计作当前“具体 locator、对象已闭合”。当前结果把待补条件包装成 986 个已登记来源，因此属于 A 级假闭合。

### B-VAL-01：validator/rebuild 只验证形状，并主动固化工具投影模板

代码证据：

- validator 明确要求 USER locator 匹配 `connector+...://USER-PROVIDED/`，没有检查其能否定位对象：[validate.mjs:1527](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1527)。
- 字段门只检查数量不少于 4 且不重复，不检查字段与 `source_kind`、题面实体或 reader 返回结构是否对应：[validate.mjs:1534](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1534)。
- reader 门只检查静态 `source_kind → reader` 映射和题目工具成员关系：[validate.mjs:1541](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1541)。
- validator 进一步要求合同 reader 集合与题目 reader 工具集合全等，正好固化“每工具生成一个来源”的模式：[validate.mjs:1554](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1554)。
- `reviewedLiveReaderSpotContracts` 虽存有预期 source kind、locator、fields、authority、freshness，但实际循环只检查这些硬编码字符串自身非空以及题目含某工具，从未与当前 LIVE JSON 比较：[validate.mjs:83](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:83)、[validate.mjs:1641](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1641)。
- 固定数量和摘要只锁住现有错误：[validate.mjs:1597](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1597)。
- rebuild 使用同样的非空、字段数量和 reader 成员门后直接渲染：[rebuild.mjs:2436](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2436)。

因此 validator 对当前 A 级反例返回绿色，是明确的 B 级语义门缺陷。

## 4. 其他验收结论

### 600 条标签、频率与覆盖

`[ok]`

- 未发现需要定为 A/B 的 C/D/H/R/K/S/F/B 误标。
- C5 中 H/M/L 为 2/3/19，H4 中 H/M/L 为 10/8/23；重大转型和长期自治整体明显向 L 倾斜。
- 各域逐条检查未发现显著概率逆序。H 档中的 D4 多为常规维护、汇总或提醒，L 档覆盖并购、重组、品牌迁移、跨年转型等罕见前提。
- 直接生活/家庭场景 50 条，职业场景 20 条；工作与生活生产力均有覆盖，未发现娱乐、陪伴聊天或纯消费主题。

### CTX、manifest 与 50 个冻结来源

`[ok]`

- 172 个 required claim 均能在登记的 50 个 source 正文中找到实际蕴含。
- 未发现把题面临时日期、会议条件或 USER 提供内容冒充 fixture fact。
- authority、`as_of`、`valid_until`、supplemental USER/LIVE 声明一致；CTX+LIVE 的 manifest supplemental 与合同全等。
- 该结论只适用于冻结合成 fixture，不代表真实外部来源已授权或仍然现势。

### 能力、风险与外部 effect

`[ok]`

- 46 个 F1 合同全部为 `coding`、授权 workspace 范围；条件工具均收窄为 workspace-local。
- 实际代码缺省启用集是 `["coding"]`：[config/types.ts:113](~/WorkSpace/SayDo/packages/daemon/src/config/types.ts:113)；未启用类型在 propose/dispatch 前 fail-closed：[typeGate.ts:14](~/WorkSpace/SayDo/packages/daemon/src/tier1/typeGate.ts:14)。
- 当前派发固定 `route: "tier1"`：[liveTools.ts:452](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:452)，缺省 adapter 为 Cursor：[resolveAdapter.ts:8](~/WorkSpace/SayDo/packages/daemon/src/tier1/resolveAdapter.ts:8)。
- 全部 33 条 S3 均为 F3 或 F4；不存在 S3/F1、S3/F2。全部 11 条 F4 都是 S3。
- 发送、支付、发布、预订、部署等外部 effect 均停在 F3/F4，没有把 connector、登录态或用户首句当成正式 S3 收据。
- 本轮是只读静态审查，没有实跑 F1 agent、真实登录或 S3 真人强认证，因此端到端运行能力未验证。

### 去重与自然度

`[ok]`

- 实际遍历 179,700 对，阈值 0.55 以上候选为 0。
- 最高分仅 0.333333。人工检查前十对后，均存在实质不同的输入、产物、授权或验收，例如 CAR-001 是简历弱点诊断、CAR-005 是求职信；SAL-002 包含确认后发送、SAL-012 是会后稿件更新。
- 平均长度 H 35.16、M 36.84、L 38.50，符合高频更短、长尾约束更多的方向。
- 问号数 H/M/L 为 84/49/22；以“把”开头共 67 条。安全与授权场景中的验收合同口吻较明显，但未形成重复模板或足以定 B 的自然度问题。
- 合成语料的真实客户表达率仍未经访谈或线上请求数据证明。

### rebuild 与晋升边界

`[ok]` 静态边界；运行时回滚未验证。

- rebuild 先在 sibling staging 生成问题、contexts 和 04，再运行 staged validator：[rebuild.mjs:2671](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2671)。
- 晋升按 questions、contexts、04 顺序 rename，捕获异常后逆序恢复并在恢复失败时保留 backup：[rebuild.mjs:2619](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2619)。
- 该过程不是跨三棵树的原子事务；进程强杀或断电不在保证内，文档已诚实披露：[03-频率与语义校准.md:82](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:82)。
- 按评审约束未执行 rebuild、故障注入或 mutation，因此只确认静态控制流，不宣称实际回滚测试通过。

## 5. 命令证据

实际执行：

```sh
node research/customer-question-corpus/validate.mjs
validation_status=$?
printf 'VALIDATE_EXIT_CODE=%s\n' "$validation_status"
exit "$validation_status"
```

关键原始输出：

```text
"records": 600
"questionFiles": 12
"contextManifests": 16
"fixtureSources": 50
"requiredClaims": 172
"liveSourceContracts": 465
"liveObjectSources": 986
"f1CapabilityContracts": 46
"allQuestionPairs": 179700
"nearDuplicatePairsAt055": 0

[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
VALIDATE_EXIT_CODE=0
```

退出码 0 只证明 validator 当前表达的结构和固定基线门通过；B-VAL-01 说明它没有覆盖本轮发现的对象语义。

## 6. 最终裁决

`[fail]`

失败依据：

- A-RAG-01：至少 186/986 个来源对象、102/465 个合同存在明显异物字段束。
- A-RAG-02：大量待补占位 locator 与机械 reader 投影被计作具体、可读取的来源对象。
- B-VAL-01：validator/rebuild 未校验题面实体、对象 locator 和字段语义，且现有 semantic spot baseline 没有与实际合同对账。

在这三项关闭前，不能把 v8 裁决为最终通过。