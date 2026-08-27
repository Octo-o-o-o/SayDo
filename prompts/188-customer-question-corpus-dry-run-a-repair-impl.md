# 三轮 dry run A 级返工施工（resume 原实施 session）

你是本批 dry run 的原实施会话。上一轮产物已落盘但独立评审判定 `[fail]`：三路零上下文评审去重后给出 5 个 A 级阻断。本轮**只修 A，A=0 即停**；不新增 V10、不扩写近义问题、不清零 B/C。

本会话**不得**调用真实 connector、外部账号、真实模型批次、浏览器/Web 搜索或业务写 effect。所有产物仍是静态判定。

## 0. 硬边界

允许修改的路径**仅限**：

- `research/customer-question-corpus/dry-runs/**`

**禁止**修改：600 条 `questions/*.md`、`contexts/**`、`contracts/**`、`04-live-source-contracts.md`、`simulations/**`（包括 `simulation-spec.mjs` 与 72 个 simulation 正文）、`docs/**`、任何其他目录。

施工前后主语料源树 SHA-256 必须相同，当前值：

```
0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6
```

不要 `git commit`、不要 `git push`、不要 `git add`。工作树有大量与本任务无关的用户改动，一律保留不动。

全仓禁 emoji 与 pictographic 符号（勾/叉/警告符同禁），文本标记用 `[ok]/[warn]/[fail]`；`→`/`↔` 合法。

## 1. 冻结事实（不得因返工改变）

- 主问题 600 条、12 个领域；F1/F2/F3/F4 = 46/483/60/11；
- DR1：GO 28、WAIT_USER 101、WAIT_CONNECTOR 264、WAIT_USER_AND_CONNECTOR 82、CONDITIONAL_ROUTE 54、PLAN_ONLY 60、RESCOPE 11；
- DR2：EXECUTABLE 46、EXECUTABLE_WITH_CONDITIONS 483、PLAN_OR_HANDOFF_ONLY 60、REFUSE_AND_RESCOPE 11；
- 529 条原始目标理论可达首个可审阅结果，60 条只到 plan/handoff，11 条必须拒绝并收缩；
- 33 个 S3 全部为 F3/F4，11 个 F4 全部拒绝/收缩；S3 禁止语音放行，非 merge effect 当前不签发，`ready_for_review` 不等于交付；
- LIVE 合同 465 条，F1 合同 46 条，simulation corpus ID 72 个，含 CTX 的问题 172 条。

**不是**冻结事实、必须由证据全量重算的：`replay=72、P0=16、P1=41、P2=322、P3=149`。这是待修公式的暂定输出。**严禁**为迎合任何评审里的 67、65、46、23 等局部下界而硬编码或反向凑数；先把规则写对，让数字自己落出来。

## 2. A1：让 DR3 replay 证明逐题选择的扰动

### 2.1 现状缺陷

`dry-run-model.mjs` 的 `judgeDr3()` 只要 `record.inSimulation` 为真就写 `REPLAY_PASS`，从不核对该 simulation 是否真的 replay 了本行 `selectPerturbation()` 选中的那个扰动。

### 2.2 新增证据源

新建 `research/customer-question-corpus/dry-runs/perturbation-evidence.mjs`，为**全部 72 个** simulation 建立机器可判定的扰动证据映射。每条至少含：

- `sim_id`
- `corpus_id`
- `covered_perturbations`：该 simulation 已证明覆盖的扰动 ID 数组（可为空数组，可多于一个）
- `expected_recovery`：每个已覆盖扰动对应的期望恢复类型，必须等于 `PERTURBATIONS[<id>].recovery`
- `evidence_refs`：每个已覆盖扰动对应的可验证锚数组
- `rationale`：一句话说明该判断依据（人可读，不参与判定）

### 2.3 锚语法（必须对 `buildSpecs()` 的真实对象逐条解析，解析不到即 A 级失败）

至少支持：

- `lifecycle:<key>` → `spec.lifecycle` 含该 key
- `turn:<i>:move=<move>` → `spec.turns[i].move === move`
- `turn:<i>:expect~<substr>` → `spec.turns[i].expect` 含子串
- `failure:name~<substr>` / `failure:inject~<substr>` / `failure:recover~<substr>`
- `must:<i>~<substr>` / `mustNot:<i>~<substr>`
- `final_state:<state>` → `spec.finalState === state`
- `pretest:authReady=false` / `pretest:userReady=false` / `pretest:ctx=<CTX-xx>`
- `fixture:<name>:status=<status>` → `spec.fixtures` 中存在该 event 且 status 相符

导出 `resolveAnchor(spec, anchor)`，无法解析、下标越界或子串不存在时必须报错而不是静默通过。

### 2.4 逐扰动结构化判据（`PERTURBATION_EVIDENCE_RULES`）

不允许"该题在 72 个 simulation 里"这种存在性判据。每个扰动必须登记 `requiredAnchorKinds`（结构必需锚）与文本判据，并在文件内写明理由。判据语义要求如下，具体正则/词表由你实现并在文件内登记：

1. `F4_OVERREACH` → `REFUSE_AND_RESCOPE`：必须有 `turn:*:move=reject`、`final_state:refused_and_rescoped`、一条 `mustNot:*~` 锚，以及一条证明"继续拒绝"的 `failure:recover~` 锚。
2. `S3_AUTH_MISSING` → `REQUIRE_STRONG_AUTH_NO_VOICE`：必须有 `pretest:authReady=false`；必须有一条**授权缺失类注入**锚（`failure:inject~` 或 `turn:*:expect~`，文本命中登记的授权词表，例如强认证 / 口头同意 / 语音批准 / 未授权 / 授权收据 / 重新授权）；必须有一条 `mustNot:*~` 含语音或伪造授权；必须有一条 `failure:recover~` 证明挑战、强认证或继续拒绝。**数据类失败（stale / empty / partial / permission_denied 的 LIVE mock）不构成授权缺失证据。**
3. `LONG_RUN_PAUSE` → `CHECKPOINT_LEASE_RESUME`：必须有至少一条 `turn:<i>:move=resume`（或 `pause`）锚；必须有一条 `must:*~` 证明复述已确认事实或从失败点续；必须有 `failure:recover~`。`lifecycle:pause_resume` 只作旁证，**不得**作为必需条件——`RES-046` 有显式 `resume` turn 但 lifecycle 缺标签，必须判为已覆盖，标签缺失只作 B 记录。
4. `K34_PARTIAL_TOOL` → `PARTIAL_RESULT_AND_RETRY`：必须有 `failure:inject~` 指明失败的工具或对象；必须有 `failure:recover~` 证明**保留了未失败部分的结果并把失败侧标未知**；且该 simulation 必须有 2 个及以上 fixture event（单一 fixture 全灭不构成 partial）。
5. `LIVE_PERMISSION_DENIED` → `FAIL_CLOSED_WAIT_CONNECTOR`：必须有 `failure:inject~permission_denied`；必须有一条 fail-closed 的 `failure:recover~`；且对应 600 条记录的 `hasExternalConnector === true`。**`empty` / `stale` / `partial` 不是权限不足的证据。**
6. `CTX_CONFLICT_OR_STALE` → `PRESERVE_UNKNOWN_CITE_AUTHORITY`：`spec.pretest.ctx` 非空且该 CTX 出现在对应 600 条记录的 `contextTokens` 中；`failure:inject~` 命中冲突或过期语义（conflict / stale / 冲突 / 过期）；`failure:recover~` 证明引用权威顺序或保留未知。
7. `USER_INPUT_MISSING` → `WAIT_USER_SCHEMA`：`pretest:userReady=false`；`failure:inject~` 必须描述**用户材料缺失本身**（例如用户不贴草稿、只说不给日期、无 USER 清单）；`failure:recover~` 必须停在等待用户。**fixture 变 empty 不等于用户输入缺失。**
8. `VERIFY_FAIL` → `KEEP_REVIEW_NOT_DELIVERED`：`failure:inject~` 必须描述**自产草稿或登记结果的核验缺陷**（草稿写错、状态被写成 published、残留已撤回约束等）；`failure:recover~` 必须是纠正并停在可审阅或重试点；`final_state` ∈ `{ready_for_review, evidence_ready, draft_ready}`。

一个 simulation 可以同时覆盖多个扰动；也允许 `covered_perturbations` 为空。判定只看**该行 `selectPerturbation()` 选中的那一个扰动**是否在该 simulation 的 `covered_perturbations` 中。

### 2.5 结构完整性校验

`perturbation-evidence.mjs` 必须导出一个校验函数，在加载时验证：

- `EVIDENCE_MAP` 恰好 72 条，`sim_id` 与 `corpus_id` 各自唯一；
- `sim_id` 集合与 `corpus_id` 集合与 `buildSpecs()` 的实际集合 exact-set 相等（不是包含关系）；
- 每个 spec 的 `failure.name` / `failure.inject` / `failure.recover`、`must`、`mustNot`、`finalState` 均非空且 `finalState` 合法；
- 每个已覆盖扰动的 `expected_recovery` 等于 `PERTURBATIONS[<id>].recovery`；
- 每条 `evidence_refs` 锚都能解析成功，且满足该扰动的 `requiredAnchorKinds`；
- 未登记的扰动 ID 直接报错。

### 2.6 必须被抓住的已知反例（红线自测）

以下 12 条的**所选扰动**必须判为无证据，即不得 `REPLAY_PASS`：

- `LONG_RUN_PAUSE` 缺证明：`PRJ-001`、`MKT-024`、`DAT-014`、`LRN-030`、`FAM-017`
- `S3_AUTH_MISSING` 缺授权/禁语音/强认证失败变体：`OPS-015`、`SAL-002`、`DAT-028`、`LRN-009`、`LRN-028`、`LIF-006`、`FAM-004`

这只是已知反例，不是完整受影响集。必须按 2.4 的判据审查**全部 72 个**所选扰动，逐条给出结论。

### 2.7 判定改造

- `loadCorpus()` 增加逐记录字段 `replayProven`（布尔）与 `perturbationEvidence`（该扰动的证据锚，未覆盖时为 null）。
- `judgeDr3()` 的第一分支从 `record.inSimulation` 改为 `record.replayProven`；其余优先级阶梯（S3/F4 → P0；D4/H4/R4/K4 → P1；connector/K3/F3 → P2；其余 P3；F1 走 `CONTRACT_PARTIAL`）保持不变。
- `assignIssueCodes()` 中 `DR-F1-PARTIAL-ORACLE` 与 `DR-NO-REPLAY-ORACLE` 的触发条件从 `!record.inSimulation` 改为 `!record.replayProven`，并同步改写这两个 code 的 `trigger` 文案（不再写"未进入 72 个 simulation"，改为"未被证明 replay 本行所选扰动"）。
- 600 行逐题表**增加一列** `扰动证据`，取值 `PROVEN` / `NO_EVIDENCE` / `NOT_IN_SIM`（`NO_EVIDENCE` 专指在 72 个 simulation 内但所选扰动无证据）。表头、分隔行、validator、独立 oracle 与 mutation 全部同步更新为 12 列。
- result 正文增加一节，说明本轮 replay 判据从 membership 改为逐题扰动证据，并给出 `PROVEN/NO_EVIDENCE/NOT_IN_SIM` 三类计数与 `NO_EVIDENCE` 的完整 ID 清单（全量列出，不抽样）。

## 3. A2：补 CTX authority/staleness 合同

新增 issue code `DR-CTX-AUTHORITY-STALE`，赋给**全部 172 个含 CTX 的问题**（`contextTokens` 中任一 token 以 `CTX-` 开头），而不只是 36 个首要扰动为 `CTX_CONFLICT_OR_STALE` 的问题。

最小字段至少包含：

`question_id`、`context_id`、`manifest_digest`、`fixture_sources_digest`、`required_claims_digest`、`as_of`、`valid_until`、`authority_order`、`required_claims`、`supplemental_input`、`current_generation`、`revalidated_at`、`unknown_on_failure`

验收门必须覆盖：过期、digest 漂移、权威冲突、required claim 缺证、supplemental input 缺失、resume 后 freshness 变化；任一失败保持 unknown 或等待，不得进入现势结论。失败降级：只列待重验项，不把过期事实写成现势。

solution 增加对应的模板小节（字段表 + 逐题必填与通用骨架的分界），result 的 issue code 汇总表、600 行、P0/P1 分组一并由生成器更新。validator 必须校验：该 code 的模板小节存在、每个最小字段名在小节内出现、赋码集合与 172 条 CTX 记录 exact-set 相等。

## 4. A3：补 long/multi 的幂等与部分 effect 对账

`DR-LONG-RUN-CHECKPOINT` 的 `minFields` 至少增加：

`run_id`、`attempt`、`checkpoint_digest`、`source_snapshot_refs`、`input_freshness`、`completed_steps`、`completed_effects`、`receipt_refs`、`idempotency_keys`、`resume_preconditions`、`revalidation_result`

`DR-MULTITOOL-RECOVERY` 的 `minFields` 至少增加：

`operation_id`、逐对象结果、证据 refs、工具依赖 DAG、失败对象 exact-set、下游 invalidation、partial-effect ledger、retry idempotency、compensation/manual-reconcile 状态（字段名用英文标识符，中文只作说明）

两个 code 的 `acceptance` 必须明确证明：

- crash-after-send-before-record 或重放不产生第二个 effect；
- 上游 unknown 或 stale 时依赖步骤不运行；
- 部分提交不能用"全部重试"覆盖现场；
- 无法确认 effect 是否已发生时进入人工对账，不再次发送。

solution 的 `## 9`（D4/H4/R4）与 `## 10`（K3/K4）小节字段表同步扩写；validator 必须逐字段名校验其在对应小节出现。

## 5. A4：修 validator 的同源与生成物虚绿

重构为两层门禁。

### 5.1 第一层：纯 renderer + 落盘字节 exact compare

- 把 `renderResult(model)` / `renderSolution(model)` 从 `rebuild-three-pass-dry-run.mjs` 抽到独立模块（建议 `dry-runs/dry-run-render.mjs`），导出为纯函数。
- validator 重新 render，并与被校验文本做**完整字节 exact compare**（不是包含、不是行数）。standalone 运行时被校验文本来自落盘文件，因此这就是对生成物的字节对账；rebuild 预写入时传入即将写入的文本，语义一致。
- 不一致时报出第一处差异的偏移与两侧片段摘要，便于诊断。

### 5.2 第二层：独立 oracle

新建 `dry-runs/independent-oracle.mjs`。**禁止** import `buildDryRun`、`judgeRecord`、`judgeDr1`、`judgeDr2`、`judgeDr3`、`selectPerturbation`、`assignIssueCodes`、`summarize` 或任何 renderer；也不得读取它们的返回值来证明同一结论。

允许复用的低层读取器：文件系统读取、`simulation-spec.mjs` 的 `buildSpecs()`（作为 spec 数据源）、`perturbation-evidence.mjs` 的 `EVIDENCE_MAP` 与 `resolveAnchor`（作为声明数据与锚解析器）。**判定逻辑必须独立重写**：自己解析 `questions/*.md` 九字段、自己读 LIVE/F1 合同与 CTX manifest、自己实现扰动选择、证据判据、DR1/DR2/DR3、优先级、issue code 与全部汇总。

独立 oracle 的比对对象是**落盘的 result / solution 正文**（自己解析 MD），不是模型对象。必须覆盖：

- source summary（600 / 465 / 986 / 46 / 72 / 172 与源树、权威摘要）；
- F、DR1、DR2、DR3、priority、perturbation、issue、domain、扰动证据 全部汇总；
- `GO` / `F4` / `replay` / `P0` / `P1` 完整清单 exact-set（集合相等且顺序一致）；
- P0 逐题 solution 正文的完整生成物比对（逐字段重算后整节比对，不得只 `includes(id)`）；
- P1 正文逐行比对；
- 所有 issue code heading、最小字段、验收门与安全降级原文；
- CTX 赋码集合 172 条 exact-set；
- 72 条 `perturbation ↔ evidence` 对应关系与三类证据计数。

任一不符退出非 0。

### 5.3 mutation runner

新建 `dry-runs/test-dry-run-mutations.mjs`，形态参照 `simulations/test-simulation-mutations.mjs`（内存变异 + 期望被拒 + 逐条打印 `[ok] mutation <name> rejected`）。至少证明以下内存变异会让门禁退出非 0：

1. 任一 600 行字段（逐列各一条：ID、领域、F/S、上下文、DR1、DR2、扰动、DR3、优先级、issue code、理论结论、扰动证据）；
2. source 摘要 / LIVE / F / DR3 / issue / domain 任一可见汇总数字；
3. `GO` / `F4` / `replay` / `P0` / `P1` 清单各删一项；
4. P0 逐题正文换成 generic 占位；
5. P1 正文删一行；
6. 删除任一 issue 模板小节；
7. 任一 CTX 条目缺 `DR-CTX-AUTHORITY-STALE`；
8. CTX 模板删 `valid_until` / authority / digest / revalidation 任一字段；
9. long 模板删幂等或 effect ledger 字段；multi 模板删 DAG/invalidation 或 manual reconcile 字段；
10. simulation 的 `failure.inject` 或 `failure.recover` 被改成与登记 perturbation 不再匹配（证据锚解析失败或判据不满足）；
11. `authority_sha256` 的输入内容变异（见 A5）后摘要必须变化。

每条 mutation 必须**确实被某一层门禁拒绝**；若某条变异当前不会被拒，先补门禁再登记，不许把 mutation 改弱去迁就现状。

## 6. A5：扩大 authority manifest

`hashAuthorityInputs()` 必须覆盖实际权威输入的**完整字节与相对路径**，至少：

- `questions/*.md` 全部；
- `contracts/live/*.json` 与 `contracts/f1-capability-contracts.json`；
- 全部 16 个 `contexts/CTX-*/manifest.md`；
- `simulations/simulation-spec.mjs` 完整字节（或等价的规范化 spec 投影，需在文件内说明等价性）；
- `00-能力边界.md`；
- `docs/09-data-contracts.md`；
- `docs/10-voice-ux-spec.md`；
- `dry-runs/00-three-pass-dry-run-plan.md`；
- `dry-runs/perturbation-evidence.mjs`；
- `dry-runs/dry-run-model.mjs`（实际规则代码）。

**排除**生成物 `01-three-pass-dry-run-result.md`、`02-dry-run-remediation-plan.md` 与 validator / oracle / mutation runner 自身，避免自引用哈希环。

为支持 mutation，`hashAuthorityInputs` 需接受可选的字节覆盖（例如 `overlay: Map<relPath, string|Buffer>`），使 mutation runner 能在内存里替换 `simulation-spec.mjs`、`docs/10-voice-ux-spec.md`、`00-能力边界.md` 的字节并断言摘要必变。

## 7. B 级只记录（不阻断，不为清零 B 循环）

`RES-046` lifecycle 元数据缺 `pause_resume`；S3 最小字段表漏 `issuance`（`ISSUE_CODES` 的 `minFields` 缺，solution 表里已有）；`OPS-053` F4 D0 与 `read_test` 顺序；`ENG-001`/`ENG-048` F1 与 USER connector 边界；P0 仍是待填写 capsule。若修 A 时自然触及可做最小一致性修正，否则只记录。

## 8. 施工后门禁（按顺序跑，逐条记录紧邻退出码）

```
node --check research/customer-question-corpus/dry-runs/dry-run-model.mjs
node --check research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs
node --check research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs
node --check research/customer-question-corpus/dry-runs/perturbation-evidence.mjs
node --check research/customer-question-corpus/dry-runs/dry-run-render.mjs
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

另须自证：

- 连续两次 `rebuild`，`01-` / `02-` 与整个 `dry-runs/` 生成树 SHA-256 完全相同；
- 施工后主语料源树 SHA-256 仍为 `0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6`；
- 判定用的退出码必须紧跟命令本身取，不要用 `cmd | tail` 或 `cmd; echo; echo $?` 拿到的码。

批量编辑后逐项程序化核验每个预期文件真实落盘；长文件用 `wc -l` 和关键字段检索确认真实写入。

## 9. 交付

在 `research/customer-question-corpus/dry-runs/` 下写 `03-a-repair-implementation-note.md`，逐 A 项列：改了什么、落在哪个文件、判定规则原文、真实命令与紧邻退出码、生成物 SHA-256、以及重算后的 replay / P0 / P1 / P2 / P3 与三类扰动证据计数。另附 72 条逐 sim 的覆盖结论表（sim_id、corpus_id、所选扰动、是否覆盖、判据依据）。

诚实要求：不得编造命令输出、SHA 或"已通过"结论；跑不通就写跑不通并给原始报错。你的门禁绿灯**不是**验收通过——本批还要经零上下文独立评审。不要 commit、不要 push。
