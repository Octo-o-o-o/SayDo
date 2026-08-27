# [fail]

A=3，B=1，C=0。三条现有门禁均为退出码 0，但 3 个 A 级问题会改变 replay/P0 主要结论或允许高风险生成物漂移，因此本轮不建议交付，也不应进入真实运行。

## A 级发现

### A1：`REPLAY_PASS` 没有证明登记的 DR3 扰动被 replay

计划要求每题选择一个具体扰动，再判断恢复闭环，[计划第 50 行](~/WorkSpace/SayDo/research/customer-question-corpus/dry-runs/00-three-pass-dry-run-plan.md:50)。实际模型却只从 simulation spec 正则提取 72 个 `corpusId`，[dry-run-model.mjs 第 453 行](~/WorkSpace/SayDo/research/customer-question-corpus/dry-runs/dry-run-model.mjs:453)，随后只要 ID 在集合内便直接返回 `REPLAY_PASS`，[第 541 行](~/WorkSpace/SayDo/research/customer-question-corpus/dry-runs/dry-run-model.mjs:541)；没有核对 simulation 的失败变体是否等于该行登记的扰动和恢复类型。

全量 S3 审查结果：

- 33 个 S3 全部为 F3/F4，行级 DR2、issue code 和理论结论均正确。
- 其中 17 个标为 replay、16 个标为 P0。
- 7 个 replay 行登记的是 `S3_AUTH_MISSING`，但对应 simulation 没有授权缺失、语音批准或强认证注入：
  `OPS-015`、`SAL-002`、`DAT-028`、`LRN-009`、`LRN-028`、`LIF-006`、`FAM-004`。
- 实际失败分别是报价过期、CRM 写回拒绝、质量查询失败、日历读取失败、表现表为空、表不完整和邮件部分可读。例如 [OPS-015](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/simulation-spec.mjs:1873) 的失败变体位于第 1912 行，[SAL-002](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/simulation-spec.mjs:2118) 的失败变体位于第 2160 行。

因此，当前“replay=72、P0=16”只是 ID membership 统计，不是登记扰动的恢复证明。按当前 DR3 定义，至少上述 7 条不能计为 `REPLAY_PASS`；在补足对应 oracle 前，保守口径应至少是 replay≤65、P0≥23。

### A2：validator 不做生成物 exact compare，可放过高风险清单和 P0 正文漂移

当前 validator 会逐行核对 600 行，并 exact-check P0/P1 标记块；但对 P0 solution 只检查标题是否存在，对 P1 只做全文 `includes`，[validate-three-pass-dry-run.mjs 第 226 行](~/WorkSpace/SayDo/research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs:226)。它没有重新 render 两份 MD 并按完整字节比较。

当前文件本身是确定的：我未运行会写盘的 rebuild，而是纯内存调用 renderer 两次，结果为：

```text
run1_equals_run2: result=true, solution=true
generated_equals_checked_in: result=true, solution=true
result_sha256=0e30d3acaca8c44889247ec5f86b6ecf46d072a6a060efd29fb04bee1507d80c
solution_sha256=94f499673e2704aae8f7ecd41555950dc9672d451f69270cd2e0e509fe50b2cb
EXIT_CODE=0
```

但额外内存反例均被 validator 接受，`errors=0`：

- 把 `ENG-104` 的整个 P0 正文换成 generic 占位；
- 从“完整 GO 清单”删除 `ENG-002`；
- 从“完整 F4 清单”删除 `ENG-120`；
- 把渲染汇总中的 F1 从 46 改为 45。

这证明当前文件碰巧与生成器一致，但 validator 并未强制 exact compare，并可在绿灯下漏掉高风险完整清单或逐题 P0 内容。

### A3：`authority_sha256` 没覆盖其声称的全部权威输入

计划明确把完整 simulation spec、`00-能力边界.md` 和 canonical 的 Gate 0/S3/状态约束列为输入，[计划第 12 行](~/WorkSpace/SayDo/research/customer-question-corpus/dry-runs/00-three-pass-dry-run-plan.md:12)。

实际 `hashAuthorityInputs` 只哈希：

- questions；
- contracts；
- 16 个 manifest；
- 排序后的 72 个 simulation ID；
- 手写规则版本字符串。

见 [dry-run-model.mjs 第 334 行](~/WorkSpace/SayDo/research/customer-question-corpus/dry-runs/dry-run-model.mjs:334)。它没有覆盖：

- simulation 的 turns、fixture、oracle、failure/recovery 正文；
- `00-能力边界.md`；
- `docs/09-data-contracts.md`；
- `docs/10-voice-ux-spec.md`；
- dry-run plan 或实际判定代码。

纯内存把 `OPS-015` 的恢复从“标明不可下单”改为“直接下单并声称成功”后：

```text
simulation_bytes_changed=true
simulation_id_sets_equal=true
authority_before=9e1060e404d7c28874f75dcb83cd827ab2a5e461ef234ddb77dd86373bbf629d
authority_after=9e1060e404d7c28874f75dcb83cd827ab2a5e461ef234ddb77dd86373bbf629d
authority_digest_changed=false
```

因此该摘要不能证明 safety oracle 或 canonical 边界没有漂移。

## B 级发现

### B1：P0 逐题节是差异化“待填写指令”，不是已填写的逐题 capsule

16 个 P0 ID 均有独立节、原问题、来源对象和工具集合；但生成器实际输出的是“逐题填写 effect 对象……”等指令，[rebuild-three-pass-dry-run.mjs 第 304 行](~/WorkSpace/SayDo/research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs:304)。

程序化检查结果：

```text
sections=16
all_have_question=true
all_have_fill_instruction=true
actual_structured_safety_values=[]
fill_lines_starting_with_instruction=16
```

例如 [ENG-104](~/WorkSpace/SayDo/research/customer-question-corpus/dry-runs/02-dry-run-remediation-plan.md:241) 仍要求后续填写 object/action/impact/rollback，而没有给出具体值。文件也诚实声明“未填字段仍属未闭合”，所以本项不单独作为 A；但这些 P0 不能据此进入真实运行。

## 独立重算结果

独立解析脚本没有 import dry-run model、generator 或 validator；直接解析问题表、合同、manifest、simulation ID 和结果行：

```text
rows=600
11-field mismatches=0
F1/F2/F3/F4=46/483/60/11

DR1:
GO=28
WAIT_USER=101
WAIT_CONNECTOR=264
WAIT_USER_AND_CONNECTOR=82
CONDITIONAL_ROUTE=54
PLAN_ONLY=60
RESCOPE=11

机械 DR3:
REPLAY_PASS=72
CONTRACT_PARTIAL=42
UNPROVEN_P0=16
UNPROVEN_P1=38
UNPROVEN_P2=318
UNPROVEN_P3=114

priority:
replay=72
P0=16
P1=41
P2=322
P3=149
EXIT_CODE=0
```

来源对账同样通过：

```text
questions=600
LIVE contracts=465, source objects=986, mismatches=0
F1 contracts=46
context manifests=16
supported IDs=172, required-claim rows=172, mismatches=0
simulation specs=72, unique corpus IDs=72, shape errors=0
```

WAIT/UNPROVEN 没被叙述为题目必然失败；F3 均为 `PLAN_OR_HANDOFF_ONLY`，F4 均为 `REFUSE_AND_RESCOPE`。11 个 F4 完整集合也正确。canonical 明确支持这些边界：[能力边界第 34 行](~/WorkSpace/SayDo/research/customer-question-corpus/00-能力边界.md:34)、[Voice UX 第 87 行](~/WorkSpace/SayDo/docs/10-voice-ux-spec.md:87)、[状态词第 101 行](~/WorkSpace/SayDo/docs/10-voice-ux-spec.md:101)。

10 个实际使用的 issue code 全部有模板；删除一个模板的指定 mutation 能被拒绝。P1 分组为 3/4/18/16，合计 41，零重复、零遗漏。

## 完整关键 ID 集合

GO 28：

```text
ENG-002, ENG-008, ENG-010, ENG-014, ENG-015, ENG-018, ENG-024,
ENG-026, ENG-034, ENG-037, ENG-044, ENG-046, ENG-047, ENG-053,
ENG-060, ENG-089, ENG-023, ENG-033, ENG-051, ENG-052, ENG-067,
ENG-068, ENG-083, ENG-116, ENG-097, ENG-108, ENG-113, PRJ-031
```

P0 16：

```text
ENG-104, ENG-074, ENG-096, PRJ-045, WRT-046, WRT-066, RES-049,
OPS-033, OPS-048, OPS-029, OPS-039, OPS-051, OPS-053, MKT-033,
MKT-036, FAM-015
```

P1 41：

```text
ENG-012, ENG-019, ENG-029, ENG-054, ENG-091, ENG-095, ENG-057,
ENG-100, ENG-103, ENG-115, ENG-119, PRJ-044, PRJ-052, PRJ-053,
PRJ-070, PRJ-060, PRJ-062, WRT-057, WRT-059, WRT-069, RES-027,
RES-047, RES-051, RES-052, OPS-034, OPS-044, OPS-035, OPS-040,
SAL-032, MKT-028, MKT-044, DAT-017, LRN-013, LRN-016, LRN-029,
LIF-007, LIF-019, LIF-024, LIF-028, CAR-002, FAM-011
```

F4 11：

```text
ENG-120, PRJ-068, WRT-065, RES-059, OPS-053, SAL-043, MKT-043,
DAT-035, LIF-029, CAR-020, FAM-020
```

## 真实门禁

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs` | 0 | `[ok] three-pass dry run validated` |
| `node research/customer-question-corpus/validate.mjs` | 0 | `[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过` |
| `find .../dry-runs -type f -print0 \| xargs -0 bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |

## 指定 mutation

| 内存 mutation | 结果 |
|---|---|
| F4 `ENG-120` DR2 改为 `EXECUTABLE` | 拒绝，2 个错误 |
| 从 P0 块删除 `ENG-104` | 拒绝，1 个错误 |
| 删除 `DR-F4-RESCOPE` 模板 | 拒绝，4 个错误 |
| 把 `ENG-002` DR1 从 `GO` 改为 `WAIT_USER` | 拒绝，3 个错误 |

正式 mutation runner 退出码为 0；以上修改均只存在于内存。

## 交付建议

本轮不交付。最小修复范围是：

1. simulation spec 增加可机械核对的 `perturbation`/`expectedRecovery`，validator 必须验证所选 DR3 扰动与实际 failure variant 相同；先补上述 7 个 S3 授权/禁语音 replay。
2. 导出纯 renderer，让 validator 对 result/solution 做完整字节 exact compare，并解析 GO/F4/replay 清单、所有汇总和 P0/P1 正文。
3. `authority_sha256` 纳入完整 simulation spec、能力边界和 canonical 文件，以及实际规则版本或规则代码摘要。
4. P0 保持未闭合也可以，但必须明确叫“待填写 capsule”；真实运行前再逐题填入具体 object/action/impact/rollback/auth 字段。

全程未修改文件，未调用真实 connector、外部账号、模型业务执行或业务写工具。