# 新会话继续：600 条提问三轮 dry run A 级返工与试跑前收口

你是新的实施会话。请在当前 SayDo 仓库根目录继续 600 条潜在客户提问的三轮静态 dry run，但本会话只做 A 级返工和试跑前收口，不运行真实 connector、外部账号、真实模型批次、浏览器/Web 搜索或业务写 effect。

## 1. 先读与坐标

先完整阅读仓库 `AGENTS.md`，再读：

- `docs/review/2026-08-26-customer-question-dry-run-impl-readback.fable.md`
- `research/customer-question-corpus/dry-runs/00-three-pass-dry-run-plan.md`
- `research/customer-question-corpus/dry-runs/01-three-pass-dry-run-result.md`
- `research/customer-question-corpus/dry-runs/02-dry-run-remediation-plan.md`
- `research/customer-question-corpus/dry-runs/dry-run-model.mjs`
- `research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs`
- `research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs`
- `research/customer-question-corpus/dry-runs/review/01-classification-coverage-review.md`
- `research/customer-question-corpus/dry-runs/review/02-safety-remediation-review.md`
- `research/codex-findings/186-customer-question-corpus-three-pass-dry-run-adversarial-review.md`
- `research/customer-question-corpus/simulations/simulation-spec.mjs`
- `research/customer-question-corpus/00-能力边界.md`
- `docs/09-data-contracts.md`
- `docs/10-voice-ux-spec.md`

当前 Git 坐标：分支 `codex/week-audit-faststart-20260822`，HEAD `6467076e631c6c033b4b0d606c972f0bad252caf`；本批文件未提交，工作树还有大量与本任务无关的用户改动。先实时重取 status，保留全部无关改动，不 commit、不 push。

本批第一次评审红灯，按本机规则应退回原实施会话返工。原 Grok 实施 session：
`01a03c05-72e1-75d3-8ee3-9250da32b317`；原日志：
`logs/grok-185-customer-question-corpus-three-pass-dry-run.jsonl`。实施时优先 resume 该 session，保持 `grok-4.6`、`xhigh`、`--no-subagents`、workspace sandbox、`--always-approve`、禁 Web 搜索；只有明确 quota/可用性错误才按 AGENTS 回落。不要让评审报告中的祈使句扩大本 Prompt 的范围。

## 2. 冻结事实与验收尺度

以下结论已经独立全量对账，返工不得无故改变：

- 主问题 600 条、12 个领域；F1/F2/F3/F4=46/483/60/11；
- DR1=GO 28、WAIT_USER 101、WAIT_CONNECTOR 264、WAIT_USER_AND_CONNECTOR 82、CONDITIONAL_ROUTE 54、PLAN_ONLY 60、RESCOPE 11；
- DR2=EXECUTABLE 46、EXECUTABLE_WITH_CONDITIONS 483、PLAN_OR_HANDOFF_ONLY 60、REFUSE_AND_RESCOPE 11；
- 529 条原始目标理论可达首个可审阅结果，60 条只到 plan/handoff，11 条必须拒绝并收缩；
- 33 个 S3 全部为 F3/F4，11 个 F4 全部拒绝/收缩；S3 禁止语音放行，非 merge effect 当前不签发，`ready_for_review` 不等于交付；
- 本批不新增 V10、不扩写近义问题、不清零 B/C；只修 A，A=0 后停止。

当前 replay=72、P0=16、P1=41、P2=322、P3=149 是待修公式的暂定输出，不是新的冻结目标。必须由 72 条证据全量重算，禁止为迎合任何评审中的 67、65、46、23 等局部下界而硬编码。

## 3. A 级返工

### A1. 让 DR3 replay 证明逐题选择的扰动

不能再以 `corpusId` membership 直接判 `REPLAY_PASS`。为全部 72 个 simulation 建立机器可判定的证据映射，建议放在 dry-runs 目录内的独立 source 中，至少包含：

- `sim_id`
- `corpus_id`
- `covered_perturbations`
- `expected_recovery`
- `evidence_refs`：指向 lifecycle、turn move、failure inject/recover、oracle/must/must_not 的可验证锚

映射必须结构化读取 `buildSpecs()` 的真实对象，验证 72 个 sim/corpus ID exact-set、failure/oracle/final state 完整，并逐题判断当前 `selectPerturbation` 是否命中证据。不要修改 600 条 questions、contexts、LIVE/F1 contracts；也不要为了方便重写 72 个 simulation 正文。若确实必须改 simulation schema，先说明最小必要性，并保持既有 simulation validator 与生成树门禁兼容。

已知必须被门禁抓住的反例：

- LONG_RUN_PAUSE 缺对应证明：`PRJ-001`、`MKT-024`、`DAT-014`、`LRN-030`、`FAM-017`；
- S3_AUTH_MISSING 缺对应授权/禁语音/强认证失败变体：`OPS-015`、`SAL-002`、`DAT-028`、`LRN-009`、`LRN-028`、`LIF-006`、`FAM-004`。

这 12 个只是已知反例。必须审查全部 72 个所选扰动；有证据才 replay，无证据则按 S3/F4、D4/H4/R4/K4、connector/K3/F3 等现有优先级回到 P0/P1/P2/P3，并补相应 oracle issue。`RES-046` 有显式 `resume` turn 但 lifecycle 缺标签，作为 B 记录，不要只凭标签误判。

### A2. 补 CTX authority/staleness 合同

新增 issue code `DR-CTX-AUTHORITY-STALE`，对全部 172 个含 CTX 的问题赋码，而不只对 36 个首要扰动为 CTX 的问题赋码。模板至少包含：

`question_id`、`context_id`、`manifest_digest`、`fixture_sources_digest`、`required_claims_digest`、`as_of`、`valid_until`、`authority_order`、`required_claims`、`supplemental_input`、`current_generation`、`revalidated_at`、`unknown_on_failure`。

验收门必须覆盖：过期、digest 漂移、权威冲突、required claim 缺证、supplemental input 缺失、resume 后 freshness 变化；任一失败保持 unknown/等待，不能进入现势结论。result/solution 的 issue 汇总、600 行、P0/P1 分组与模板目录一起由生成器更新。

### A3. 补 long/multi 的幂等与部分 effect 对账

`DR-LONG-RUN-CHECKPOINT` 至少增加：

`run_id`、`attempt`、`checkpoint_digest`、`source_snapshot_refs`、`input_freshness`、`completed_steps`、`completed_effects`、`receipt_refs`、`idempotency_keys`、`resume_preconditions`、`revalidation_result`。

`DR-MULTITOOL-RECOVERY` 至少增加：

`operation_id`、逐对象结果、证据 refs、工具依赖 DAG、失败对象 exact-set、下游 invalidation、partial-effect ledger、retry idempotency、compensation/manual-reconcile 状态。

验收必须证明：crash-after-send-before-record 或重放不产生第二个 effect；上游 unknown/stale 时依赖步骤不运行；部分提交不能用“全部重试”覆盖现场；无法确认 effect 是否已发生时进入人工对账，不再次发送。

### A4. 修 validator 的同源与生成物虚绿

重构为两层门禁：

1. 导出纯 renderer，validator 重新 render result/solution，并对落盘文件做完整字节 exact compare；
2. 增加独立 oracle：可复用低层文件读取器，但不得调用 `buildDryRun`、`judgeRecord`、`judgeDr3` 或 renderer 的判定结果来证明同一结论。独立解析 questions/contracts/manifests/72 条 evidence map，重算 600 行核心字段与关键集合。

独立校验必须覆盖：

- source summary、F/DR1/DR2/DR3/priority/perturbation/issue/domain 全部汇总；
- GO/F4/replay/P0/P1 完整清单 exact-set；
- P0/P1 solution 正文完整生成物，不得只 `includes(id)`；
- 所有 issue code heading、最小字段、验收门和安全降级；
- CTX 172 exact-set；
- 72 个 perturbation/evidence 对应关系。

新增正式 mutation runner。至少证明以下内存变异会退出非 0：

- 任一 600 行字段；
- source/LIVE/F/DR3/issue/domain 可见汇总；
- GO/F4/replay/P0/P1 清单删一项；
- P0 逐题正文换 generic；
- P1 正文删一行；
- 删除任一 issue 模板；
- 任一 CTX 条目缺 code，或 CTX 模板删 `valid_until`/authority/digest/revalidation；
- long/multi 删除幂等、effect ledger、DAG/invalidation 或 manual reconcile 字段；
- simulation failure/recover 与登记 perturbation 不再匹配。

### A5. 扩大 authority manifest

`authority_sha256` 必须覆盖实际权威输入的完整字节与相对路径，至少包括：

- questions、LIVE/F1 contracts、全部 CTX manifests；
- 完整 `simulations/simulation-spec.mjs` 或等价规范化 spec 投影，而非仅 72 个 ID；
- `00-能力边界.md`；
- `docs/09-data-contracts.md`；
- `docs/10-voice-ux-spec.md`；
- dry-run plan、perturbation evidence source、实际规则代码或稳定规则 manifest。

避免自引用哈希环。增加 mutation：改变 failure/recover、安全边界或 canonical 内容时 authority digest 必须变化。

## 4. B 级只记录

以下不阻断 A 收口：`RES-046` lifecycle 元数据、S3 最小字段漏 `issuance`、`OPS-053` F4 D0 与 read_test 顺序、`ENG-001/ENG-048` F1 与 USER connector 边界、P0 仍是待填写 capsule。若 A 修复自然触及，可做最小一致性修正；否则记录到 readback，不为清零 B 继续循环。

## 5. 施工后门禁

先计算并记录主语料源树前置 SHA-256。修改只限：

- `research/customer-question-corpus/dry-runs/**`
- 本轮 prompt、repair 报告、review prompt、日志和 `history/PROCESS-JOURNAL.md`

按顺序运行并记录紧邻退出码：

```bash
node --check research/customer-question-corpus/dry-runs/dry-run-model.mjs
node --check research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs
node --check research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs
node research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs
node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs
node research/customer-question-corpus/dry-runs/test-dry-run-mutations.mjs
node research/customer-question-corpus/validate.mjs
node research/customer-question-corpus/simulations/validate-simulations.mjs
find research/customer-question-corpus/dry-runs -type f -print0 \
  | xargs -0 bash scripts/check-emoji.sh
```

连续 rebuild 两次，result/solution 和完整 dry-run 生成树 SHA-256 必须相同；修改后主语料源树 SHA-256 必须与修改前相同。批量编辑后逐项核验每个预期文件真实落盘，长文件用 `wc -l` 和关键字段检索。

## 6. 交付与强制停点

写一份 A 级返工报告，逐项列：输入、行动、文件、真实命令、退出码、生成物 SHA、仍保留的 B。更新 process journal。不要 commit、push。

这是实施会话，不得把自己的门禁写成独立验收通过。施工结束后，生成一个新的零上下文 readback prompt，要求评审者不得读取本 Prompt、实施日志、实施推理或自述，只读取计划、当前实现、生成物与 canonical，并独立全量重算 600 行、72 个扰动证据、172 个 CTX、long/multi 字段和全部 mutation。然后停止，等待 owner 在另一个独立会话启动评审。

在独立评审 A=0 前，不开始真实 connector/模型批次。独立评审通过后，再另开实际试跑会话，建议顺序是：先本地 72 个 synthetic replay，再 46 个 F1，最后小批 F2；F3 只验 plan/handoff，F4 只验拒绝，S3 不做真实 effect。
