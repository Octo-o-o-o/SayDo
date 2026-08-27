# A 级返工续修：独立 oracle 的覆盖判定仍与模型同源

上一轮 A1-A5 主体已落盘，全部门禁绿。调度方独立核验后发现**一个 A 级残留**和**一个 B 级一致性问题**。本轮只修这两条，不扩范围，不动 600 条主语料，不动 `simulations/**`，不 commit、不 push。

允许修改路径仍只限 `research/customer-question-corpus/dry-runs/**`。主语料源树 SHA-256 必须仍为 `0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6`。

## A 级：独立 oracle 没有独立重算扰动覆盖

### 现状

`perturbation-evidence.mjs` 的 `EVIDENCE_MAP` 不是声明数据，而是 `buildEvidenceMap()` 用 `evaluatePerturbationCoverage()` 推导出来的。`independent-oracle.mjs` 第 7 行直接 `import { EVIDENCE_MAP, resolveAnchor }`，第 229 行用 `entry.covered_perturbations.includes(perturbation)` 判 `replayProven`。

结果：600 行里最关键的那一列（扰动证据 / DR3 / 优先级）在模型侧和 oracle 侧来自**同一份推导**。判据函数写错时，两侧会一起错、一起绿。这与上一轮被评审判红的「validator 与生成器共用 `buildDryRun`」是同一类同源虚绿，只是下沉了一层。

推导式 EVIDENCE_MAP 本身没问题，比手写声明更难造假，**保留**。要修的是 oracle 侧的独立性。

### 必须做到

1. `independent-oracle.mjs` **不得**再 import `EVIDENCE_MAP`、`buildEvidenceMap`、`evaluatePerturbationCoverage` 或 `PERTURBATION_EVIDENCE_RULES`。允许继续 import `buildSpecs`（spec 数据源）。`resolveAnchor` 也不得再依赖——oracle 自己解析锚。
2. oracle 内部按 `perturbation-evidence.mjs` 文件里**已写明的判据语义**（每个扰动的 `requiredAnchorKinds` 与 `reason` 文案）**独立重写**一份覆盖判定：自己实现 8 个扰动的结构化判据、自己的词表常量、自己的锚生成与解析。不得 import 对方的正则常量，也不得读取对方源码字符串来复制判据。
3. oracle 用自己的判定结果重算 `replayProven` / `evidenceStatus` / DR3 / 优先级 / issue code / 全部汇总，并与落盘 result 正文比对（现有比对逻辑保留）。
4. 另外**双向交叉核验**：oracle 独立算出的 `(corpus_id, covered_perturbations)` 集合，必须与 `perturbation-evidence.mjs` 导出的 EVIDENCE_MAP **逐题全等**；不等则报出具体差异并退出非 0。为此可以在这一处（且仅在这一处）读取 EVIDENCE_MAP 作为**被比对对象**，但 oracle 自身的 600 行重算不得使用它。
5. 新增 mutation，证明这层交叉核验真的有牙：在内存里把 `evaluatePerturbationCoverage` 的判据**放宽**（例如让 `LIVE_PERMISSION_DENIED` 接受 `empty`，或让 `LONG_RUN_PAUSE` 不要求 resume 轮），独立 oracle 必须报错退出非 0。同样加一条**收紧**方向的 mutation。若当前模块结构无法在内存里注入放宽后的判据，就把判据表做成可注入参数（默认值不变），不要为了跑通 mutation 削弱正式判据。

## B 级：逐扰动词表内部不一致

`PERM_RECOVER` 收了 `不编造`，但没收 `不补造`；因此 `DAT-006`（`SIM-DAT-04`，inject 为 `cohort-run 从 partial 变为 permission_denied`，recover 为「报告无法执行，不补造转化率」）在 inject 与 connector 两项都命中的情况下，仅因 recover 用词差一个字被判无证据。这是词表覆盖缺口，不是有原则的排除。

要求：

1. 逐条审查全部 8 个扰动的词表常量（`AUTH_*`、`LONG_MUST`、`F4_RECOVER`、`PARTIAL_RECOVER`、`PERM_RECOVER`、`CTX_*`、`USER_*`、`VERIFY_*`），找出**语义等价却只收其一**的近义表述，要么补齐，要么在文件内写明为什么该表述不构成该扰动的恢复证据。
2. 词表调整必须写进 `perturbation-evidence.mjs` 的注释与 `03-a-repair-implementation-note.md`，逐条说明理由。
3. **数字由规则决定**：不得为了凑任何目标数（26、23、46、67、65 等）增删词表项。调整后如果 PROVEN 计数变化，如实重算并在 note 里列出**状态发生变化的条目**（ID、原状态、新状态、依据）。如果审查后认为现有词表已无不一致，就写明结论并保持不变。

## 门禁

按顺序跑，逐条记录紧邻退出码（不要用 `cmd | tail` 或 `cmd; echo; echo $?` 取码）：

```
node --check research/customer-question-corpus/dry-runs/perturbation-evidence.mjs
node --check research/customer-question-corpus/dry-runs/independent-oracle.mjs
node --check research/customer-question-corpus/dry-runs/test-dry-run-mutations.mjs
node research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs
node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs
node research/customer-question-corpus/dry-runs/independent-oracle.mjs
node research/customer-question-corpus/dry-runs/test-dry-run-mutations.mjs
node research/customer-question-corpus/validate.mjs
node research/customer-question-corpus/simulations/validate-simulations.mjs
find research/customer-question-corpus/dry-runs -type f -print0 | xargs -0 bash scripts/check-emoji.sh
```

另须自证：连续两次 rebuild 生成树 SHA-256 相同；主语料源树 SHA-256 不变；`grep -n "EVIDENCE_MAP" independent-oracle.mjs` 只在交叉核验那一处出现。

冻结事实不得变：600 条；F1/F2/F3/F4=46/483/60/11；DR1 GO=28 / WAIT_USER=101 / WAIT_CONNECTOR=264 / WAIT_USER_AND_CONNECTOR=82 / CONDITIONAL_ROUTE=54 / PLAN_ONLY=60 / RESCOPE=11；CTX 赋码 172；simulation 72。

12 条已知反例仍必须为 `NO_EVIDENCE`：`PRJ-001`、`MKT-024`、`DAT-014`、`LRN-030`、`FAM-017`、`OPS-015`、`SAL-002`、`DAT-028`、`LRN-009`、`LRN-028`、`LIF-006`、`FAM-004`。

## 交付

更新 `03-a-repair-implementation-note.md`：新增一节记录本轮两条修复的输入、行动、文件、真实命令与紧邻退出码、生成物 SHA-256、以及重算后的 replay/P0/P1/P2/P3 与三类扰动证据计数（若有变化，列出变化条目）。

诚实要求：不得编造命令输出或 SHA；跑不通就写跑不通并给原始报错。你的门禁绿灯不是验收通过。
