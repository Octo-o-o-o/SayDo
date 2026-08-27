# 三轮 dry run 分类与覆盖独立评审

- 评审日期：2026-08-26
- 评审身份：零上下文、只读独立评审
- 评审结论：`[fail]`
- 分级计数：A=2，B=1，C=0

## 1. 结论先行

当前 `01-three-pass-dry-run-result.md` 的 600 行，在“照抄现有计划与判定公式”的机械层面没有错配：独立解析得到 600 个唯一 ID，对 11 个逐题字段做了 6,600 次比较，错配为 0；F1/F2/F3/F4、GO、P0、P1、DR1/DR2/DR3、priority 和 issue code 的当前汇总也都能从源记录重算出来。

但整体仍判 `[fail]`，原因有两项 A 级阻断：

1. DR3 先为每题选择具体扰动，却只要 ID 出现在任意 simulation 就无条件写成 `REPLAY_PASS`。至少 5 条明确选择了 `LONG_RUN_PAUSE` 的 D4/H4/R4 高风险条目，其 simulation 没有 `pause_resume` 生命周期、暂停/续接轮次或对应失败变体，仍被从 P1 移到 replay。这会改变 replay/P1 主结论与完整清单。
2. validator 不是计划声称的“独立检查”，并且存在可复现的虚绿：它复用生成器的完整判定模型，只读取 simulation 的 72 个 `corpusId` 字符串，不验证 oracle/fixture/failure 内容；也不核对结果文档的人类可见主汇总。内存变异实验把 72 条 `recover` 全部清空，dry-run 可观察到的 ID 投影仍完全相同；把 LIVE 对象数、理论可达数、`REPLAY_PASS` 汇总改成 0，validator 仍返回 errors=0。

因此，当前 600 行“与现有实现一致”不等于“三轮分类及 gate 可信”。DR1、DR2、F3/F4 边界、WAIT/UNPROVEN 语义本身通过；DR3 证明轴和 validator 必须修复后才能收口。

## 2. 范围与约束

本轮逐行检查了：

- `dry-runs/00-three-pass-dry-run-plan.md`
- `dry-runs/01-three-pass-dry-run-result.md`
- `dry-runs/dry-run-model.mjs`
- `dry-runs/rebuild-three-pass-dry-run.mjs`
- `dry-runs/validate-three-pass-dry-run.mjs`
- `questions/*.md`
- `contracts/live/*.json`
- `contracts/f1-capability-contracts.json`
- `simulations/simulation-spec.mjs`

只读辅助门禁还运行了主语料 validator 与 simulation validator。没有调用真实 connector、模型、外部账号或业务执行工具；没有运行会覆盖生成物的 `rebuild-three-pass-dry-run.mjs`。本报告是唯一写入文件，没有修改实现、源语料或既有生成物，也没有 commit/push。

## 3. 独立重算方法

独立 Node here-doc 没有 import `dry-run-model.mjs`，而是：

1. 按 12 个问题文件逐行解析九字段记录，重新解析 C/D/H/R/K/S/F/B；
2. 逐个读取 12 份 LIVE JSON，以 `locator_provider=USER` 独立判断外部 connector；
3. 读取 F1 active contracts，核对 F1 双向集合；
4. 从 `simulation-spec.mjs` 的 `RAW_SPECS` 独立检查 72 个唯一 simulation/corpus ID、turn、fixture、oracle、failure 和 final state；
5. 直接按计划第 3 节重写 DR1/DR2/DR3、priority、perturbation、issue code 与理论结论公式；
6. 解析结果表的 600 行 11 列，逐位置、逐字段比较；
7. 独立解析 GO、F4、replay、P0、P1 清单并做全等比较；
8. 独立重算源树 SHA-256 与当前 authority 算法的 SHA-256。

### 3.1 独立 600 行重算

实际执行入口形态（here-doc 主体由本会话通过 stdin 传入、没有落盘；报告不重复粘贴整段临时解析器，完整断言项与原始摘要保留如下）：

```bash
node --input-type=module <<'NODE'
// 独立解析器主体：不 import dry-run-model.mjs，直接读取
// questions、LIVE/F1 JSON、RAW_SPECS 与 result，并执行上列 8 组断言。
NODE
rc=$?
echo "exit_code=$rc"
```

原始摘要：

```text
sources questions=600 unique=600 live=465 live_objects=986 f1=46 simulations=72/72/72
simulation_structure errors=0 turns_min=3 turns_max=4 fixtures=80 complete_oracle=72 complete_failure=72
row_field_checks rows_expected=600 rows_actual=600 fields=11 comparisons=6600 mismatches=0
mismatch_by_field id=0 domain=0 fs=0 context=0 dr1=0 dr2=0 perturbation=0 dr3=0 priority=0 issueCodes=0 theoretical=0
row_digest expected=882cdfbd314f9865f8a0016699da4fac9c14771fa4c669f964488c8f9c68a82a actual=882cdfbd314f9865f8a0016699da4fac9c14771fa4c669f964488c8f9c68a82a
F F1=46 F2=483 F3=60 F4=11
DR1 GO=28 WAIT_USER=101 CONDITIONAL_ROUTE=54 WAIT_CONNECTOR=264 WAIT_USER_AND_CONNECTOR=82 PLAN_ONLY=60 RESCOPE=11
DR2 EXECUTABLE=46 EXECUTABLE_WITH_CONDITIONS=483 PLAN_OR_HANDOFF_ONLY=60 REFUSE_AND_RESCOPE=11
DR3 CONTRACT_PARTIAL=42 UNPROVEN_P3=114 UNPROVEN_P2=318 UNPROVEN_P1=38 REPLAY_PASS=72 UNPROVEN_P0=16
priority P3=149 P2=322 P1=41 replay=72 P0=16
issue DR-F1-PARTIAL-ORACLE=42 DR-USER-INPUT=192 DR-F2-CONDITIONAL=483 DR-NO-REPLAY-ORACLE=486 DR-EXTERNAL-CONNECTOR=411 DR-MULTITOOL-RECOVERY=149 DR-LONG-RUN-CHECKPOINT=69 DR-F3-PLAN-ONLY=60 DR-S3-SAFETY-CAPSULE=33 DR-F4-RESCOPE=11
lists GO=28/mismatch0 F4=11/mismatch0 replay=72/mismatch0 P0=16/mismatch0 P1=41/mismatch0
safety F3_exec=0 F4_exec=0
digests source=0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6 meta_source=0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6 authority=9e1060e404d7c28874f75dcb83cd827ab2a5e461ef234ddb77dd86373bbf629d meta_authority=9e1060e404d7c28874f75dcb83cd827ab2a5e461ef234ddb77dd86373bbf629d
omitted_input_hashes simulation_spec=f17a156d482386a8a7e71bed53369af163d993577463d861549b98b3811c178a boundary=e252e40a1e029454220faea0e69aae7e2cf0fbdd6b56aed8d7fa0727a5234c3d dry_run_model=cbb85441aab18bc189b3ba183aa1695aa29f6538aefa993bcc0d09006fa2fc37
exit_code=0
```

这证明当前 600 行与现有公式逐字段一致；它不替代第 4 节对公式和证明关系的语义评审。

### 3.2 既有 dry-run validator

真实命令：

```bash
node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs
rc=$?
echo "exit_code=$rc"
```

原始输出：

```text
[ok] three-pass dry run validated
source_tree_sha256=0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6
authority_sha256=9e1060e404d7c28874f75dcb83cd827ab2a5e461ef234ddb77dd86373bbf629d
result_sha256=0e30d3acaca8c44889247ec5f86b6ecf46d072a6a060efd29fb04bee1507d80c
solution_sha256=94f499673e2704aae8f7ecd41555950dc9672d451f69270cd2e0e509fe50b2cb
rows=600
P0=16
P1=41
issue_codes=DR-EXTERNAL-CONNECTOR,DR-F1-PARTIAL-ORACLE,DR-F2-CONDITIONAL,DR-F3-PLAN-ONLY,DR-F4-RESCOPE,DR-LONG-RUN-CHECKPOINT,DR-MULTITOOL-RECOVERY,DR-NO-REPLAY-ORACLE,DR-S3-SAFETY-CAPSULE,DR-USER-INPUT
exit_code=0
```

该绿灯被 A-2 的变异实验否定为充分门禁，但输出本身真实记录如上。

### 3.3 主语料与 simulation 门禁

真实命令：

```bash
node research/customer-question-corpus/validate.mjs
rc=$?
echo "exit_code=$rc"
```

相关原始摘要：

```text
"records": 600
"contextManifests": 16
"risk": { "S1": 180, "S0": 134, "S2": 253, "S3": 33 }
"fit": { "F1": 46, "F2": 483, "F3": 60, "F4": 11 }
"contextModes": { "LIVE": 465, "USER": 192, "-": 15 }
"liveSourceContracts": 465
"liveObjectSources": 986
"f1CapabilityContracts": 46
[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
exit_code=0
```

真实命令：

```bash
node research/customer-question-corpus/simulations/validate-simulations.mjs
rc=$?
echo "exit_code=$rc"
```

相关原始摘要：

```text
sessions=72 domains=12 H/M/L=32/25/15
CTX=35 USER=28 LIVE=51 dash=2 S3orF4=17 LIF/FAM=12
lifecycle first_clarify=25 user_supplement=24 rag_conflict=17 live_degrade=40 write_confirm=19 mid_change=8 tool_fail=11 pause_resume=10 overreach=10
tree_sha256=9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
A=0 warn=28
[ok] A-level checks passed
exit_code=0
```

simulation validator 的 28 条 warning 是 payload 丰富度提示，不是本评审新增 finding；关键缺口是它只对生命周期做总量门，没有把每题 dry-run 所选扰动与相同题目的 lifecycle/failure 做映射。

### 3.4 只读确定性复核

由于 rebuild 会覆盖两份生成物，本轮没有运行 rebuild。改为连续两次只读构建相同判定投影并计算 SHA-256。

实际执行入口形态（同样是不落盘的 stdin module）：

```bash
node --input-type=module <<'NODE'
import { buildDryRun } from './research/customer-question-corpus/dry-runs/dry-run-model.mjs';
// 连续构建两次，投影 600 行判定与 summary 后计算 JSON SHA-256。
NODE
rc=$?
echo "exit_code=$rc"
```

原始输出：

```text
projection_sha_run1=f8c9633af1c22a7b4313eaa6c4cb83967f7c3b7cd7e3f25e204dc9a60b4e5089
projection_sha_run2=f8c9633af1c22a7b4313eaa6c4cb83967f7c3b7cd7e3f25e204dc9a60b4e5089
equal=true generated_at=2026-08-26
exit_code=0
```

结论：当前判定投影在同一源状态下确定；但 authority 摘要没有覆盖全部权威输入，见 A-2。因此“执行确定”通过，“输入封口可信”不通过。

## 4. Findings

### A-1 所选 DR3 扰动与 simulation 证明对象脱节，至少 5 条长任务被错误移出 P1

计划先明确“每题按风险优先选择一个静态扰动”，随后把 `REPLAY_PASS` 定义为已有失败恢复变体（`00-three-pass-dry-run-plan.md:50-58`）。模型也确实先按 D4/H4/R4 选择 `LONG_RUN_PAUSE`（`dry-run-model.mjs:494-504`），但 `judgeDr3` 只检查 `inSimulation`，不检查对应 simulation 是否覆盖这个扰动（`dry-run-model.mjs:541-559`）。

以下 5 条是明确反例；它们既没有声明 `pause_resume` lifecycle，turn 也没有暂停/续接动作，failure 处理的是另一类问题：

| ID | 源风险证据 | result 证据 | simulation 证据 | 判定 |
|---|---|---|---|---|
| `PRJ-001` | `questions/02-product-project.md:8` 为 R4 | `01-three-pass-dry-run-result.md:557` 写 `LONG_RUN_PAUSE / REPLAY_PASS / replay` | `simulation-spec.mjs:781` 仅 `first_clarify, rag_conflict`；`:822` failure 是“把反馈当成合同” | 未证明暂停恢复 |
| `MKT-024` | `questions/07-marketing-growth.md:65` 为 H4 | result `:883` 写 `LONG_RUN_PAUSE / REPLAY_PASS / replay` | spec `:2566` 仅 `first_clarify`；`:2602` failure 是“加入获客漏斗 KPI” | 未证明暂停恢复 |
| `DAT-014` | `questions/08-data-finance.md:26` 为 D4/H4/R4 | result `:911` 写 `LONG_RUN_PAUSE / REPLAY_PASS / replay` | spec `:2770` 仅 `live_degrade, tool_fail`；`:2809` failure 是“指标序列缺失” | 未证明 checkpoint/续接 |
| `LRN-030` | `questions/09-learning-development.md:76` 为 R4 | result `:966` 写 `LONG_RUN_PAUSE / REPLAY_PASS / replay` | spec `:3291` 仅 `user_supplement, first_clarify`；`:3327` failure 是“资源目录不可用” | 未证明暂停恢复 |
| `FAM-017` | `questions/12-household-family-community.md:52` 为 D4/H4 | result `:1034` 写 `LONG_RUN_PAUSE / REPLAY_PASS / replay` | spec `:4297` 仅 `live_degrade`；`:4336` failure 是“年度记录权限不足” | 未证明暂停恢复 |

全量程序化检查的原始摘要是：

```text
selected_LONG_RUN_PAUSE_in_replay=10 with_pause_resume=4 without_pause_resume=6
PRJ-001 D0/H0/R4 pause=false first_clarify+rag_conflict 把反馈当成合同
RES-046 D1/H0/R4 pause=false tool_fail+user_supplement+live_degrade 环境空结果
OPS-025 D1/H0/R4 pause=true pause_resume+user_supplement+live_degrade 任务板部分可读
OPS-036 D1/H0/R4 pause=true tool_fail+user_supplement+pause_resume 记忆中无 DSR-19
MKT-024 D1/H4/R2 pause=false first_clarify 加入获客漏斗 KPI
DAT-016 D1/H0/R4 pause=true pause_resume+live_degrade+rag_conflict owner 答复过期
DAT-014 D4/H4/R4 pause=false live_degrade+tool_fail 指标序列缺失
LRN-030 D2/H3/R4 pause=false user_supplement+first_clarify 资源目录不可用
LIF-023 D1/H0/R4 pause=true tool_fail+user_supplement+pause_resume+live_degrade 门户拒绝
FAM-017 D4/H4/R3 pause=false live_degrade 年度记录权限不足
exit_code=0
```

`RES-046` 的 lifecycle 元数据也缺 `pause_resume`，但 turn 有显式 `move: resume`，单列为 B-1，不计入上述“明确没有续接 turn”的最小 5 条。

按当前状态词最小修正，这 5 条应从 `REPLAY_PASS/replay` 回到 `UNPROVEN_P1/P1`，并补 `DR-NO-REPLAY-ORACLE`；或者先给 simulation 增加与 `LONG_RUN_PAUSE` 对应的 checkpoint/lease/pause-resume oracle 后再保留 replay。最小影响为：

- replay：72 降为 67；
- P1：41 升为 46；
- `UNPROVEN_P1`：38 升为 43；
- `DR-NO-REPLAY-ORACLE`：486 升为 491；
- P1 完整清单新增上述 5 个 ID。

这直接改变主要准备度结论并漏掉长任务高风险题，定为 A。

### A-2 validator 与 authority 摘要均可虚绿，不能证明 source summary 或 72 个 replay oracle

计划把 validator 描述成“独立检查”（`00-three-pass-dry-run-plan.md:74-80`），实际却 import 并调用生成器同一个 `buildDryRun`（`validate-three-pass-dry-run.mjs:5-20,102-117`），然后拿结果行与同源结果比较（`:164-205`）。系统性分类错误会被生成器和 validator 共同接受；A-1 就是当前实例。

simulation 证明更弱：

- `loadSimulationCorpusIds` 只用正则提取 72 个 `corpusId`（`dry-run-model.mjs:453-460`）；
- `judgeDr3` 看到 ID 在集合里就立即 `REPLAY_PASS`（`:541-544`）；
- `hashAuthorityInputs` 只哈希 simulation ID 列表与手写规则版本字符串，不哈希 `simulation-spec.mjs` 内容、`00-能力边界.md` 或 `dry-run-model.mjs`（`:334-351`）；
- result 却把它展示为“dry-run 权威输入摘要”，并把 72 条称为“已有完整 simulation replay”（`01-three-pass-dry-run-result.md:21-25,91-97`）。

内存变异实验没有写文件。真实命令入口为 `node --input-type=module` here-doc：它把 72 个 `recover: "..."` 全部替换为空字符串，再比较真实文件 SHA 与 dry-run loader 可观察的 corpus-ID 投影。

原始输出：

```text
recover_lines_mutated=72
spec_sha original=f17a156d482386a8a7e71bed53369af163d993577463d861549b98b3811c178a mutated=ecc17befa8eb2fee56a0157d057dfea4cadbb9b3fad50159a746440af0b6ad50 changed=true
id_projection original=72/72/457b5b263fa9e87745239cb9f1e83f6159978c0ca72f002a08c5260d59bc4ee0
id_projection mutated=72/72/457b5b263fa9e87745239cb9f1e83f6159978c0ca72f002a08c5260d59bc4ee0
dry_run_loader_observable_equal=true
exit_code=0
```

结果文档主汇总同样未被 validator 解析。另一项不落盘的内存变异把以下三处改错：LIVE 对象来源 986 改为 0、理论可达 529 改为 0、`REPLAY_PASS` 72 改为 0，再把变异文本直接传给 `collectDryRunIssues`。

原始输出：

```text
mutated_fields=3
validator_errors=0 validator_warns=0
exit_code=0
```

所以 validator 能对“oracle 已清空”和“主要人类可见摘要已错”继续报绿，满足本任务对 A 级“验证器虚绿”的定义。

修复门应至少包含：

1. 结构化加载 `RAW_SPECS/buildSpecs`，逐 simulation 验证 turn、fixture、oracle、failure、final state；
2. 给 simulation 增加可机读 `covered_perturbations`，要求逐题所选 perturbation 命中，不能只看 corpus ID；
3. authority 摘要纳入 `simulation-spec.mjs`、`00-能力边界.md`、实际判定规则文件或规则内容摘要；
4. validator 不复用 `judgeRecord/buildDryRun`，独立从 questions/contracts/spec 重推 600 行；
5. 解析并核对 source summary、DR2/DR3/issue/domain 汇总以及 GO/F4/replay 清单，不只核对逐题表与 P0/P1。

### B-1 `RES-046` 的 lifecycle 元数据与显式 resume turn 不一致

`RES-046` 是 R4（`questions/04-research-decision.md:105`），result 选择 `LONG_RUN_PAUSE` 并标 replay（`01-three-pass-dry-run-result.md:743`）。其 simulation lifecycle 没有 `pause_resume`（`simulation-spec.mjs:1544-1546`），但第三轮明确写了 `move: "resume"`（`:1570-1574`）。

这不等于该题完全没有续接覆盖，所以不与 A-1 的最小 5 条合并；但结构化 lifecycle 与实际 turn 不一致，会让 coverage 汇总和未来 `covered_perturbations` 映射产生假阴性。应补 `pause_resume` lifecycle，并明确 failure 是否验证 checkpoint/lease 恢复，还是只验证依赖空结果。

## 5. 通过项

以下结论经独立全量重算为 `[pass]`：

- 600 个问题 ID 唯一，12 个问题文件与领域对应；
- LIVE 合同 465 条、对象 986 个，题面 `LIVE` 与合同双向一致；
- F1 active contracts 46 条，题面 F1 与合同双向一致；
- 当前 simulation spec 有 72 个唯一 corpus ID，72 个 spec 均有 3 至 4 轮、fixture、oracle、failure 和合法 final state；
- 600 行 11 字段与当前公式全等，行投影 SHA-256 相同；
- F1/F2/F3/F4 为 46/483/60/11；
- DR1 的 GO/WAIT/CONDITIONAL/PLAN/RESCOPE 当前计数及全量 ID 对账无差异；
- GO 28、F4 11、P0 16、当前公式下 P1 41 的列表均与结果文件全等；
- F3 共 60 条全部为 `PLAN_OR_HANDOFF_ONLY / 计划或交接`；F4 共 11 条全部为 `REFUSE_AND_RESCOPE / 拒绝并收缩`，没有写成可执行；
- 33 条 S3 均带 `DR-S3-SAFETY-CAPSULE`，结果明确禁止语音放行；
- `WAIT_*` 被明确说明为前置等待而非失败（plan `:37`，result `:47`）；
- `UNPROVEN_*` 被明确说明为证据不足而非题目失败（plan `:63`，result `:80`）；
- `ready_for_review` 没有被写成完成或交付；
- 当前 source-tree SHA-256 与 result meta 一致；
- 当前判定投影连续两次只读构建的 SHA-256 一致。

## 6. 最终门禁判定

```text
[fail] classification-and-coverage review
A=2
B=1
C=0
```

阻断项是 A-1 与 A-2。修复后必须重新独立重算全部 600 行、重新核对受影响的 replay/P1/issue 清单，并对 validator 做相同的内存变异回归；不能只把冻结基线常量改成新计数。
