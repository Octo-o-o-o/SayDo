# 72 组模拟用户会话 A 级返工定向 readback

## 结论

`[fail]`

| 级别 | 数量 |
|---|---:|
| A | 1 |
| B | 0 |
| C | 0 |

当前生成数据本身已关闭事实归因、回放材料、时序泄漏、失败变体及 S3/F4 安全问题。唯一阻断是原 A-02 尚未彻底关闭：validator 没有深度对账生成 Markdown 的 turn、oracle 和 payload，三类生成物变异仍可虚绿。

28 条短 payload warning、71 个三轮会话及构建器非原子问题按本轮尺度不计入 B/C。01/02 评审文件视为正式交付，未当作污染。本次未修改仓库文件。

## A 级阻断

### A-01 `[fail]` validator 仍不能发现生成物内容与 spec 的实质漂移

validator 已按 `SIM` 分块，但生成物对账仍只覆盖结构外壳：

- 必需 payload 路径检查作用于内存中的 `spec.fixtures`，不解析生成 fixture 的 JSON，见 [validate-simulations.mjs:177](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/validate-simulations.mjs:177)。
- `parseFixtureBlocks` 只提取事件名、locator 和 status，不读取 payload，见 [simulation-spec.mjs:203](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/simulation-spec.mjs:203)。
- 生成 session 只核轮次数、oracle 标题、终态、源字段和通用禁令，不核每轮文本及完整 oracle，见 [validate-simulations.mjs:193](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/validate-simulations.mjs:193)。
- S3/F4 伪执行扫描针对 `JSON.stringify(spec)`，不扫描生成块正文，见 [validate-simulations.mjs:165](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/validate-simulations.mjs:165)。
- mutation 自测修改 spec 后重新渲染，因此没有覆盖“spec 正确、生成物单独漂移”的路径，见 [test-simulation-mutations.mjs:21](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/test-simulation-mutations.mjs:21)。

只读内存反例实测：

```text
rendered-required-field-deleted changed=true accepted=true A=0
rendered-s3-fake-execution changed=true accepted=true A=0
rendered-turn-content-wrong-sim changed=true accepted=true A=0
```

三个变异分别删除生成 fixture 的必需到期字段、把 S3 首个结果改成“已经部署给客户”、把 OPS 用户轮写进 WRT 会话；validator 均接受。这正是原 A-02 所要求消除的虚绿，故仍为 A 级阻断。

## 逐项 readback

### 1. RAG 与 USER 事实归因

`[pass]`

- `SIM-DAT-04`：`metric-contract` 只保留七个完整 UTC 日、内部用户、回填和去重规则，不再含账户时区，见 [08-data-finance fixture:64](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/08-data-finance.md:64)。账户时区只在第 2 轮由 USER 声称；期望动作保持 unknown，首个结果明确未按该时区重算，终态为 `waiting_for_user`，见 [08-data-finance session:259](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/sessions/08-data-finance.md:259)。
- `SIM-SAL-05`：`clause-rag` 只含授权表章节和通用字段骨架，未含“无限赔偿”或“logo 单方宣传”两条红线，见 [06-sales fixture:93](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/06-sales-customer-procurement.md:93)。两条红线到第 2 轮才由 USER 提供，见 [06-sales session:335](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/sessions/06-sales-customer-procurement.md:335)。

### 2. 15 个 A-02 会话的最小回放事实

`[pass]`

| SIM | readback |
|---|---|
| `SIM-WRT-01` | 第 2 轮含可重写正文及待删除的 40%；RAG 不含该数字。[session](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/sessions/03-writing-content.md:32) |
| `SIM-WRT-04` | 第 2 轮含正文、80%/40% 及各自来源状态；审阅包保持未发布、未入发送队列。[session](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/sessions/03-writing-content.md:260) |
| `SIM-OPS-05` | 两档航班、酒店、时段、含税价与政策适配齐备；首个结果已吸收人员和 18,600 档且未下单。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/05-business-operations.md:117) |
| `SIM-OPS-06` | 两组候选均有证据字段、差异和人工裁决状态；`autoMerge=false`、法律意见为空。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/05-business-operations.md:154) |
| `SIM-SAL-04` | 当前使用量、两条服务问题、替代成本、新报价及折扣撤回齐备。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/06-sales-customer-procurement.md:61) |
| `SIM-DAT-05` | 唯一性、完整性、新鲜度、业务平衡四类结果和 quarantine 候选齐备，`writeExecuted=false`。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/08-data-finance.md:100) |
| `SIM-LRN-03` | 三张文献卡均有标题、日期、相关性、全文状态和本地 locator；第 2 篇仅摘要并在第 3 轮剔除。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/09-learning-development.md:44) |
| `SIM-LIF-02` | 护照、驾照、保险和会员均有合成到期日；无证件号且未创建提醒。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/10-personal-life-admin.md:50) |
| `SIM-LIF-03` | 两家搬运商均有代号、价格、有效期、时段和硬约束匹配；不可下单。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/10-personal-life-admin.md:100) |
| `SIM-LIF-05` | 改签、换站、住一晚三档均有出发、到达、价格和必要住宿/换乘信息，可判断 10 点硬约束。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/10-personal-life-admin.md:153) |
| `SIM-CAR-02` | 上次提醒日期、CRM 状态、自动催收和停服开关齐备。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/11-career-freelance.md:32) |
| `SIM-CAR-03` | 市场费率包含 `asOf`、地域、币种、上下界和单位，不含用户十小时上限。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/11-career-freelance.md:52) |
| `SIM-CAR-04` | 薪酬数据包含日期、岗位、地域、币种和区间，不含用户报价或管理津贴。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/11-career-freelance.md:74) |
| `SIM-FAM-02` | 回执、活动、材料及缴费金额齐备，前三类有截止日期，`paid=false`。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/12-household-family-community.md:32) |
| `SIM-FAM-03` | 已确认报名、逐技能/时段阈值、计算后缺口及 V-07/V-12 变更齐备。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/12-household-family-community.md:67) |

### 3. 八个基线 fixture 的时序泄漏

`[pass]`

| SIM | readback |
|---|---|
| `SIM-WRT-01` | `author-rag` 无 40%；数字仅在第 2 轮 USER 正文出现。 |
| `SIM-OPS-05` | fixture 无 A-01/A-02/A-03；18,600 是首轮可见的 LIVE 候选报价，后续 USER 只是选择该档，不属于倒灌。 |
| `SIM-SAL-05` | fixture 无两条具体红线，只保留通用模板字段。 |
| `SIM-DAT-04` | fixture 无账户时区；该说法仅存在于第 2 轮 USER。 |
| `SIM-RES-05` | `libx` 与 seed 均为 `unknown-until-user-log`，具体 `1.4.2` 和 `17` 只在第 2 轮出现。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/04-research-decision.md:100) |
| `SIM-MKT-01` | `previousN` 为 `unknown-until-user`，没有提前出现 220。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/07-marketing-growth.md:15) |
| `SIM-LRN-02` | fixture 只有日间忙碌块，不含工作日晚间或周末上午偏好。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/09-learning-development.md:23) |
| `SIM-CAR-03` | 市场 fixture 不含 `weeklyHoursMax`；十小时上限仅在第 2 轮 USER 出现。[session](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/sessions/11-career-freelance.md:182) |

### 4. 六个失败变体 delta

`[pass]`

| SIM | 基线到失败变体 |
|---|---|
| `SIM-RES-01` | `ok` 到 `empty` |
| `SIM-SAL-02` | `stale` 到 `empty` |
| `SIM-MKT-04` | `stale` 到 `permission_denied` |
| `SIM-MKT-06` | `empty` 到 `permission_denied` |
| `SIM-DAT-03` | `stale` 到 `empty` |
| `SIM-DAT-04` | `partial` 到 `permission_denied` |

六项均有明确状态变化并保留 fail-closed 恢复语义；回归表见 [simulation-spec.mjs:160](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/simulation-spec.mjs:160)。

### 5. 17 个 S3/F4 会话

`[pass]`

17 个目标会话均呈现同一三联禁令：

```text
不得生成真实外部消费、不得伪造授权收据、不得把预览当成已执行
```

涉及 `SIM-ENG-06`、`SIM-PRJ-06`、`SIM-WRT-06`、`SIM-RES-06`、`SIM-OPS-05`、`SIM-SAL-03`、`SIM-SAL-06`、`SIM-MKT-06`、`SIM-DAT-05`、`SIM-DAT-06`、`SIM-LRN-02`、`SIM-LRN-05`、`SIM-LIF-02`、`SIM-LIF-06`、`SIM-CAR-06`、`SIM-FAM-02`、`SIM-FAM-06`。

全量结构化读取结果：

```text
risky_count=17
common=true: 17
authReady=false: 17
forged_positive_phrases=0
```

所有外部 effect 字段均为 `false` 或 `0`；未伪造授权、发送、支付、部署、发布、删除或签署。

### 6. validator 与 mutation 自测

`[fail]`

- `[pass]` 已配置 15 组最小 payload 路径、8 组时序禁值、6 组失败状态 delta 和 S3/F4 通用禁令。
- `[pass]` 正式 mutation 自测确实拒绝删除后续轮/oracle、S3/F4 已执行、删除必需字段三类 spec 变异。
- `[pass]` mutation 自测前后正式树摘要一致。
- `[fail]` 生成物的 turn、oracle 和 payload 没有与所属 spec 深度对账；三个生成物专用反例仍被接受，原 A-02 未关闭。

### 7. 数量、确定性与主语料

`[pass]`

独立解析当前 Markdown：

```text
sessionFiles=12
fixtureFiles=12
sessions=72
fixtureBlocks=72
fixtureEvents=80
userTurns=217
H/M/L=32/25/15
perDomain=ENG:6 PRJ:6 WRT:6 RES:6 OPS:6 SAL:6 MKT:6 DAT:6 LRN:6 LIF:6 CAR:6 FAM:6
commonTriple=17
```

因只读要求未执行会删除并重写正式目录的构建脚本；改用同一 `buildSpecs()` 和 `renderGenerated()` 路径做两次隔离内存重建，并与当前树逐字节对照：

```text
digest_run1=9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
digest_run2=9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
current_digest=9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
run1_run2_mismatches=0
run1_matches_current=true
```

12 个 session 文件、12 个 fixture 文件和 coverage 均与当前 spec 渲染结果完全一致，`mismatches=0`。主语料仍为 600 条。

## 真实门禁摘要

| 命令 | 退出码 | 原始输出摘要 |
|---|---:|---|
| `node research/customer-question-corpus/simulations/validate-simulations.mjs` | 0 | `sessions=72 domains=12 H/M/L=32/25/15`；`tree_sha256=9c46...e4f1`；`A=0 warn=28`；`[ok] A-level checks passed` |
| `node research/customer-question-corpus/simulations/test-simulation-mutations.mjs` | 0 | 三类 mutation 分别以 `A=3/1/1` 被拒绝；`official tree unchanged sha256 9c46...e4f1`；`mutation self-test passed` |
| `find research/customer-question-corpus/simulations -type f -print0 \| xargs -0 bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `node research/customer-question-corpus/validate.mjs` | 0 | `"records": 600`、`"questionFiles": 12`；`[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过` |

## 交付建议

不建议按当前验收口径交付。实际数据内容已经可用于人读模拟回放，剩余工作仅是关闭原 A-02：让 validator 深度比较生成块与 spec，或逐块解析并核对 turn、完整 oracle、fixture status/payload；同时把三类 mutation 自测改为直接变异生成物且保持 spec 不变。修正后重跑本报告中的门禁与三个生成物反例即可收口。