# 600 条提问三轮 dry run A 级返工报告

> 返工日期：2026-08-27
> 上一轮对账：`docs/review/2026-08-26-customer-question-dry-run-impl-readback.fable.md`（判定 `[fail]`，A=5）
> 本会话入口：`prompts/187-customer-question-corpus-dry-run-a-repair-continuation.md`
> 计划：`research/customer-question-corpus/dry-runs/00-three-pass-dry-run-plan.md`
> 分支：`codex/week-audit-faststart-20260822`；HEAD：`6467076e631c6c033b4b0d606c972f0bad252caf`
> 本任务提交数：0（未 commit、未 push、未 add）
> 本会话未调用真实 connector、外部账号、真实模型批次、浏览器/Web 搜索或业务写 effect

## TL;DR

A1-A5 五项全部落地，本会话真实跑过的门禁全绿；上一轮 5 个 A 级阻断在本轮已有对应实现与可判定门禁。

关键结论变化：DR3 的 `REPLAY_PASS` 不再由「该题属于 72 个 simulation」推出，改为「该 simulation 的结构化锚证明了本行所选的那一个扰动」。按此重算，replay 从 72 降到 27，P0 从 16 升到 23；600 条、F1/F2/F3/F4、DR1/DR2 等冻结事实全部未变。

本报告是实施侧记录，**不是验收通过**。按本机「实施 / 评估双线分离」规则，A=0 的结论必须由另一个零上下文会话独立复核后才成立；readback prompt 见文末。

## 1. 输入与派发

| 项 | 内容 |
|---|---|
| 返工范围 | 上一轮 readback 的 A1-A5，只修 A；不新增 V10、不扩写近义问题、不清零 B/C |
| 施工通道 | Grok Build CLI，`grok-4.6` + `--reasoning-effort xhigh` + `--no-subagents` + `--sandbox workspace` + `--always-approve` + `--disable-web-search` + `--no-memory` |
| 会话 | `-r 01a03c05-72e1-75d3-8ee3-9250da32b317`（原实施 session resume），两轮均 `stopReason=end_turn`，`modelUsage` 实际模型 `grok-4.6-build` |
| 回落 | 未发生。两轮均无 quota / 可用性错误 |

派发 prompt 与日志：

| 文件 | 行数 | 字节 | SHA-256 |
|---|---:|---:|---|
| `prompts/188-customer-question-corpus-dry-run-a-repair-impl.md` | 243 | - | `0e006ee2cf5cc96f7f61c975cea6539dfbae39f00334e8dc507becea678dbc84` |
| `prompts/189-customer-question-corpus-dry-run-a-repair-continuation-fix.md` | 62 | - | `4de83f780895b458659713edaf0edf21945baaa05ffe33e3e1b041458686cce2` |
| `logs/grok-188-customer-question-corpus-dry-run-a-repair.jsonl` | 2249 | 3108747 | `d9dd974a04c53da4bdbd2c251fa5cd86cf3ae1982a70b870247635a168aca3a9` |
| `logs/grok-189-customer-question-corpus-dry-run-a-repair-fix.jsonl` | 1701 | 1341353 | `5c1b326f9a5f12e20b38f6caff04d85d936165410fde5bff91a6720b477ff7d6` |

派发前对未跟踪产物做了 tar 快照（25 MB，会话 scratchpad，SHA-256 `bf198bb87087b991bdd4bb360902e71b62c0a43fe50873f7d41558bad43c4e9a`），防 sandbox 清树；本轮未发生工作树损失。

## 2. 中途发现的 A 级残留与二次派发

第一轮施工全部门禁绿之后，调度方独立核验发现一条**上一轮评审未提、但属同一类**的 A 级问题：

`perturbation-evidence.mjs` 的 `EVIDENCE_MAP` 不是手写声明，而是由 `evaluatePerturbationCoverage()` 推导；而 `independent-oracle.mjs` 当时直接 `import { EVIDENCE_MAP }` 并据其判 `replayProven`。结果是 600 行里最关键的一列在模型侧与 oracle 侧来自同一份推导——判据写错时两侧会一起错、一起绿。这与上一轮被判红的「validator 与生成器共用 `buildDryRun`」是同一类同源虚绿，只是下沉了一层。

因此以 `prompts/189-...` 退回同一 session 续修，要求：oracle 自行重写 8 个扰动的结构化判据与词表，只在一处把 `EVIDENCE_MAP` 当作**被比对对象**做双向交叉核验，并新增放宽 / 收紧两个方向的 mutation 证明该交叉核验有牙。续修后核验：

- `grep -n "EVIDENCE_MAP" independent-oracle.mjs` 仅命中第 595-597 行的交叉核验处；
- oracle 的 import 只有 `node:*` 与 `../simulations/simulation-spec.mjs` 的 `buildSpecs`；
- `selectPerturbation` / `judgeDr1` / `judgeDr2` / `judgeDr3` / `assignIssueCodes` 在 oracle 内是**本地重写实现**（第 329-374 行定义），不是从模型 import；
- mutation `evidence-loosen-live-empty`（放宽为接受 `empty`）与 `evidence-tighten-long-lifecycle`（收紧为强制 lifecycle 标签）均被拒。

## 3. 逐 A 项落地

### A1 让 DR3 replay 证明逐题选择的扰动

- **行动**：新建 `dry-runs/perturbation-evidence.mjs`（495 行）。对 `buildSpecs()` 的真实对象做结构化解析，8 个扰动各有登记的 `requiredAnchorKinds` + 词表判据 + `reason`；`evaluatePerturbationCoverage()` 逐 spec × 逐扰动推导覆盖，产出 `sim_id` / `corpus_id` / `covered_perturbations` / `expected_recovery` / `evidence_refs` / `rationale`；所有生成的锚在返回前逐条过 `resolveAnchor()`，解析不到即抛错。
- **判据要点**（文件内成文）：`LIVE_PERMISSION_DENIED` 必须 inject 命中 `permission_denied` 且题面 `hasExternalConnector`，`empty/stale/partial` 不算；`S3_AUTH_MISSING` 必须有授权词表注入 + 禁语音/伪造授权的 mustNot + 挑战/强认证/继续拒绝的 recover，数据类 LIVE 失败不算；`LONG_RUN_PAUSE` 必须有 `resume`/`pause` 轮 + 复述已确认或从失败点续的 must，`lifecycle:pause_resume` 只作旁证；`K34_PARTIAL_TOOL` 需 ≥2 个 fixture event 且 recover 保留未失败部分；其余同理。
- **判定改造**：`judgeDr3()` 首分支由 `inSimulation` 改为 `replayProven`；`DR-NO-REPLAY-ORACLE` / `DR-F1-PARTIAL-ORACLE` 触发条件同步改为「未被证明 replay 本行所选扰动」并改写 trigger 文案；600 行逐题表增加第 12 列 `扰动证据`（`PROVEN` / `NO_EVIDENCE` / `NOT_IN_SIM`）；result 增设 `5.1 NO_EVIDENCE 完整 ID 清单`。
- **已知 12 反例核验**（本会话直接从落盘 result 逐行取第 12 列）：`PRJ-001`、`MKT-024`、`DAT-014`、`LRN-030`、`FAM-017`、`OPS-015`、`SAL-002`、`DAT-028`、`LRN-009`、`LRN-028`、`LIF-006`、`FAM-004` 全部为 `NO_EVIDENCE`。
- **`RES-046` 未误判**：其 lifecycle 仍缺 `pause_resume`（`simulation-spec.mjs` 第 1546 行，属本轮禁改路径），但因有显式 `resume` 轮而判为 `PROVEN`，符合「不得只凭标签误判」。
- **重算结果**：`PROVEN=27`、`NO_EVIDENCE=45`、`NOT_IN_SIM=528`（27+45=72，27+45+528=600）。

调度方独立结构分析与实现的差异只有三处，逐条查明：

| 条目 | 独立预期 | 实现 | 原因 | 处置 |
|---|---|---|---|---|
| `DAT-006` | PROVEN | 首轮 NO_EVIDENCE | inject 与 connector 均命中，仅因 recover 写「不补造」而 `PERM_RECOVER` 只收「不编造」 | 判为词表缺口，续修补齐同义项后转 PROVEN |
| `RES-016` | PROVEN | NO_EVIDENCE | inject 命中「不给日期」，但 recover 是「降权为未注明时效的线索」，不是停在等待用户 | 判据正确，维持 |
| `OPS-046` | PROVEN | NO_EVIDENCE | `SIM-OPS-06` 只有 1 个 fixture event，不满足「≥2 fixture 才构成 partial」 | 判据正确，维持 |

词表补齐只改变了 `DAT-006` 一条（`NO_EVIDENCE/P2` → `PROVEN/replay`），无其他条目状态变化。

### A2 CTX authority/staleness 合同

- 新增 issue code `DR-CTX-AUTHORITY-STALE`，13 个最小字段（`question_id`、`context_id`、`manifest_digest`、`fixture_sources_digest`、`required_claims_digest`、`as_of`、`valid_until`、`authority_order`、`required_claims`、`supplemental_input`、`current_generation`、`revalidated_at`、`unknown_on_failure`）。
- 赋码范围为**全部含 CTX 的问题**，本会话实测落盘 result 中带该 code 的行数为 **172**，与主 validator 的 `requiredClaims: 172` 一致；不再只覆盖 36 个首要扰动为 CTX 的问题。
- solution 新增对应模板小节；validator 逐字段名校验，oracle 独立重算赋码集合并做 exact-set 比对。

### A3 long/multi 幂等与部分 effect 对账

- `DR-LONG-RUN-CHECKPOINT` 最小字段扩到 17 个，新增 `run_id`、`attempt`、`checkpoint_digest`、`source_snapshot_refs`、`input_freshness`、`completed_steps`、`completed_effects`、`receipt_refs`、`idempotency_keys`、`resume_preconditions`、`revalidation_result`。
- `DR-MULTITOOL-RECOVERY` 最小字段扩到 16 个，新增 `operation_id`、`object_results`、`evidence_refs`、`tool_dependency_dag`、`failed_objects`、`downstream_invalidation`、`partial_effect_ledger`、`retry_idempotency`、`compensation_status`、`manual_reconcile_status`。
- 两个 code 的验收门写入：crash-after-send-before-record 或重放不得产生第二个 effect；上游 unknown/stale 时依赖步骤不运行；部分提交不得用全部重试覆盖现场；无法确认 effect 是否已发生时进入人工对账、不再次发送。

### A4 validator 同源与生成物虚绿

- 纯 renderer 抽到 `dry-runs/dry-run-render.mjs`（639 行），rebuild 与 validator 共用同一函数；validator 用 `firstByteDiff()` 对被校验文本做**完整字节 exact compare**，不一致时报第一处差异偏移与两侧片段。
- 独立 oracle `dry-runs/independent-oracle.mjs`（669 行）：自行解析 questions/contracts/manifests，自行实现扰动选择、覆盖判据、DR1/DR2/DR3、优先级、issue code 与全部汇总，比对对象是**落盘 result / solution 正文**；覆盖 source summary、全部汇总、`GO`/`F4`/`replay`/`P0`/`P1` 清单 exact-set、P0 逐题正文整节比对、P1 逐行比对、issue code heading 与最小字段、CTX 172 exact-set、72 条扰动证据对应关系。
- mutation runner `dry-runs/test-dry-run-mutations.mjs`（274 行）：本会话实测 **38 条 mutation 全部被拒**，含 12 列逐列篡改、5 类可见汇总、5 个清单各删一项、P0 正文换 generic、P1 删行、删 issue 模板、CTX 缺码、CTX 模板删 `valid_until`、long 删幂等、multi 删 DAG 与人工对账、simulation failure 与登记 perturbation 不匹配、判据放宽 / 收紧、以及三条 authority 摘要变异。

### A5 authority manifest

- `hashAuthorityInputs()` 覆盖完整字节与相对路径：全部 questions、LIVE/F1 合同、16 个 CTX manifest、`simulations/simulation-spec.mjs` 完整字节、`00-能力边界.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`dry-runs/00-three-pass-dry-run-plan.md`、`perturbation-evidence.mjs`、`dry-run-model.mjs`；排除两份生成物与 validator / oracle / mutation runner 自身，无自引用哈希环。
- 支持字节 overlay 注入，mutation `authority-overlay-hash` / `authority-docs-hash` / `authority-sim-hash` 证明改动 simulation failure/recover、语音安全边界或能力边界时摘要必变。
- 本轮 `authority_sha256` = `2a83fe2355fc7328eb559d1f9fd78217cd920b323a6950725c832a1064e54365`（上一轮为 `9e1060e404d7c28874f75dcb83cd827ab2a5e461ef234ddb77dd86373bbf629d`）。

## 4. 门禁（本会话真实执行，退出码紧跟命令本身取）

| 命令 | EXIT | 结果摘录 |
|---|---:|---|
| `node --check dry-run-model.mjs` | 0 | 无语法错误 |
| `node --check rebuild-three-pass-dry-run.mjs` | 0 | 无语法错误 |
| `node --check validate-three-pass-dry-run.mjs` | 0 | 无语法错误 |
| `node --check perturbation-evidence.mjs` | 0 | 无语法错误 |
| `node --check dry-run-render.mjs` | 0 | 无语法错误 |
| `node --check independent-oracle.mjs` | 0 | 无语法错误 |
| `node --check test-dry-run-mutations.mjs` | 0 | 无语法错误 |
| `node dry-runs/rebuild-three-pass-dry-run.mjs` | 0 | `replay=27 P0=23 P1=46 P2=338 P3=166`；`PROVEN=27 NO_EVIDENCE=45 NOT_IN_SIM=528` |
| `node dry-runs/validate-three-pass-dry-run.mjs` | 0 | `rows=600 P0=23 P1=46`，11 个 issue code |
| `node dry-runs/independent-oracle.mjs` | 0 | `[ok] independent oracle passed`，`rows=600 replay=27` |
| `node dry-runs/test-dry-run-mutations.mjs` | 0 | 38 条 mutation 全部 rejected，`official tree unchanged` |
| `node research/customer-question-corpus/validate.mjs` | 0 | `records: 600`，`requiredClaims: 172`，`liveSourceContracts: 465` |
| `node simulations/validate-simulations.mjs` | 0 | `[ok] A-level checks passed`（4 条 payload warn，非 A） |
| dry-runs emoji 门 | 0 | `[ok] emoji gate: clean` |

自证项：

- **确定性**：连续两次 rebuild 后对整个 `dry-runs/` 生成树取 SHA-256 清单，`cmp` 退出 0（未使用 BSD `diff`）。
- **主语料源树未变**：修改前后均为 `0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6`。
- **改动范围未越界**：`git status --porcelain` 反向过滤后无非预期路径；新增仅 `dry-runs/**`、`prompts/188`、`prompts/189`、两份日志与本报告。

生成物 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `dry-runs/01-three-pass-dry-run-result.md` | `68225899b09f4d37570a121dfd567d1e6b5345c88915cdb5cc5e907970fbec50` |
| `dry-runs/02-dry-run-remediation-plan.md` | `56337afcad4998df97c6603d10840de5d0c5825521c9b2fdf224e35587b5154e` |
| `dry-runs/03-a-repair-implementation-note.md` | `8644beb0c43f54f9274f15be0c9d250ec1c538ed1efb07c0e4a1e6dc1a211247` |
| `dry-runs/dry-run-model.mjs` | `91029355590851ffde122ee574617d16a6aabf7fa34cf6e5c49293c3467c95c7` |
| `dry-runs/dry-run-render.mjs` | `2f33abdaa77d160f972d72a02ea6e295c272474358eefe6bd296801322e3a847` |
| `dry-runs/perturbation-evidence.mjs` | `8a503cbb6441e00da396e1d054e7098383d6b40e3659299b5baf2b2aaec6efe7` |
| `dry-runs/independent-oracle.mjs` | `a63bc17b83a0adcea2235f41e51257b70416d356cb68fe2876df33866d9d6cb2` |
| `dry-runs/test-dry-run-mutations.mjs` | `c89d7ad66f245eb9b3eb3eb1b8bad54b04fa0242046cd6b8646958455b85faec` |
| `dry-runs/validate-three-pass-dry-run.mjs` | `771d5e539a7f1d3fb348983cfa60490bd60167c172621c2fc86f6fad6e2f3c99` |
| `dry-runs/rebuild-three-pass-dry-run.mjs` | `faa1b720e1a0d1cdfdf3051739a889d1b776d2a2cde7b04e017f3f501251112d` |

## 5. 冻结事实核对

| 项 | 冻结值 | 本轮实测 | 判定 |
|---|---|---|---|
| 主问题总数 | 600 | 600 | `[ok]` |
| F1/F2/F3/F4 | 46/483/60/11 | 46/483/60/11 | `[ok]` |
| DR1 | GO 28、WAIT_USER 101、WAIT_CONNECTOR 264、WAIT_USER_AND_CONNECTOR 82、CONDITIONAL_ROUTE 54、PLAN_ONLY 60、RESCOPE 11 | 完全一致 | `[ok]` |
| DR2 | 46/483/60/11 | 由 F 档直接派生，未变 | `[ok]` |
| LIVE 合同 / F1 合同 / simulation | 465 / 46 / 72 | 465 / 46 / 72 | `[ok]` |
| CTX 条目 | 172 | 172 | `[ok]` |
| S3 与 F4 红线 | S3 禁语音放行、非 merge effect 不签发、`ready_for_review` 不等于交付 | validator 禁语正则与 solution 原文均在 | `[ok]` |
| DR3 优先级 | **不是冻结值**，须由证据重算 | replay 27、P0 23、P1 46、P2 338、P3 166 | 已重算 |

replay 由 72 降到 27、P0 由 16 升到 23，是判据改正的直接后果，不是调参结果：P0 新增的 7 条恰是 7 个 `S3_AUTH_MISSING` 无证据的 simulation 题（`OPS-015`、`SAL-002`、`DAT-028`、`LRN-009`、`LRN-028`、`LIF-006`、`FAM-004`）。

## 6. 仍保留的 B 级

| # | 条目 | 状态 |
|---|---|---|
| B1 | `RES-046` lifecycle 缺 `pause_resume`，与其显式 `resume` 轮不一致 | 保留。`simulations/**` 是本轮禁改路径；判据已改为不依赖标签，不影响结论 |
| B2 | S3 最小字段漏 `issuance` | **已修**（修 A3 时自然触及，`ISSUE_CODES` minFields 现含 `issuance`） |
| B3 | `OPS-053` F4 D0 拒绝与 connector `read_test` 先后顺序不明确 | 保留 |
| B4 | `ENG-001`/`ENG-048` F1 workspace 合同与 USER database connector 边界歧义 | 保留 |
| B5 | P0 逐题节仍是差异化「待填写指令」，不是已填 capsule（现为 23 条） | 保留，真实运行前仍须另补 |

另记一条本轮新增的 B：`perturbation-evidence.mjs` 的 8 组词表是判据的软肋，虽已做过一轮同义项一致性审查（只改出 `DAT-006` 一条），但词表本身仍是人工枚举，后续若新增 simulation 需同步复审。

## 7. 未做与边界

- 未调用真实 connector、外部账号、真实模型批次、浏览器 / Web 搜索或业务写 effect；未产生任何真实外部 effect。
- 未 commit、未 push、未 `git add`；工作树中与本任务无关的用户改动全部保留未动。
- 未新增 V10、未扩写近义问题、未清零 B/C、未修改 600 条主语料与 `simulations/**`。
- 未运行全仓 `just ci`（本轮改动不涉及 `packages/` / `pipeline/` 生产代码）。
- **未自评为独立验收通过**。本会话既是调度方又跑了门禁，按「实施 / 评估双线分离」不构成验收。

## 8. 下一步

1. 由 owner 在**另一个零上下文会话**启动独立评审，入口：`prompts/190-customer-question-corpus-dry-run-a-repair-readback.md`。
2. 独立评审判定 A=0 之后，再另开实际试跑会话。建议顺序：先本地 72 个 synthetic replay，再 46 条 F1，最后小批 F2；F3 只验 plan/handoff，F4 只验拒绝，S3 不做真实 effect。
3. 在独立评审 A=0 前，不开始真实 connector 或模型批次。
