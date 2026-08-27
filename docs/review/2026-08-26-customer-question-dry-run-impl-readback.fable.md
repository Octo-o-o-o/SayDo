# 600 条提问三轮 dry run 实施对账报告

> 对账日期：2026-08-26
> 计划：`research/customer-question-corpus/dry-runs/00-three-pass-dry-run-plan.md`
> 分支：`codex/week-audit-faststart-20260822`
> HEAD / 与 `main` 的 merge-base：`6467076e631c6c033b4b0d606c972f0bad252caf`
> 本任务提交数：0；当前产物均未提交
> 评审范围：只检查本轮 dry-run 产物，不修复、不运行真实 connector 或业务 effect

## TL;DR

判定：`[fail]`，不能直接进入真实试跑。

三轮静态 dry run 的主体已经落盘：600 条逐题表、DR1/DR2、能力边界、结果文件、补充方案、确定性生成器都存在；独立全量对账确认 600 行 11 字段共 6,600 次机械比较为 0 错配，F1/F2/F3/F4 仍是 46/483/60/11，DR1 与 DR2 统计可信。

阻断集中在 DR3：当前只要问题 ID 出现在 72 个 simulation 中就写 `REPLAY_PASS`，没有证明该 simulation 实际覆盖本行选择的扰动；validator 又与生成器复用同一判定模型，且没有完整生成物对账，能在主要汇总或 P0 正文漂移时虚绿。补充方案另缺 CTX authority/staleness 合同，以及长任务和多工具恢复所需的幂等、已发生 effect 与下游失效对账。

三路独立评审的原始计数不能简单相加；去重后本报告收敛为 5 个 A 级阻断主题和 5 个 B 级非阻断项。依照本批“只修 A，A=0 即停止”的尺度，不开启 V10，也不继续扩写 600 条主问题。

## 对账台账

| 计划项 | 状态 | 实际证据与结论 |
|---|---|---|
| 三轮互补 dry-run 计划与静态边界 | `[ok]` | `00-three-pass-dry-run-plan.md` 已定义 DR1/DR2/DR3；result 与 solution 首段均声明未调用真实模型、connector 或业务写工具。 |
| 600 条源记录、LIVE/F1/CTX 合同加载 | `[ok]` | 主语料 validator 本会话退出 0：600 条、465 个 LIVE 合同、986 个对象来源、46 个 F1 合同、172 个 CTX required-claim 条目均自洽。 |
| DR1 冷启动前置分类 | `[ok]` | 独立重算与逐行对账无错配：GO 28、WAIT_USER 101、WAIT_CONNECTOR 264、WAIT_USER_AND_CONNECTOR 82、CONDITIONAL_ROUTE 54、PLAN_ONLY 60、RESCOPE 11。 |
| DR2 充分前置下目标可达性 | `[ok]` | F1/F2/F3/F4 为 46/483/60/11；529 条理论可达、60 条只到计划/人工交接、11 条拒绝并收缩。F3/F4 未被写成原始目标可执行。 |
| DR3 扰动与 replay 证明 | `[fail]` | `dry-run-model.mjs` 只按 simulation corpus ID membership 判 `REPLAY_PASS`，没有核对 failure/oracle 是否覆盖所选 perturbation。已知明确反例至少包括 5 个 LONG_RUN_PAUSE 和 7 个 S3_AUTH_MISSING；完整受影响集合仍须全量重算，不能把 67、65 或其他局部下界当最终目标硬编码。 |
| 600 条逐题结果 MD | `[partial]` | 600 行和当前公式一致，但 replay/P0/P1/P2/P3、DR3 status、issue code 与对应汇总会随正确的 72 条证据映射变化。 |
| dry-run 补充方案 MD | `[partial]` | 现有 10 个 issue code 均有模板，P0 16/P1 41 字面覆盖完整；但 172 个 CTX 条目没有专用 code/合同，long/multi 模板不足以防重放重复 effect 或下游继续消费 unknown。 |
| 确定性生成 | `[ok]` | 外部只读评审在内存连续 render 两次，result/solution 均相等，且与当前落盘文件相等；当前 SHA-256 分别为 `0e30d3acaca8c44889247ec5f86b6ecf46d072a6a060efd29fb04bee1507d80c`、`94f499673e2704aae8f7ecd41555950dc9672d451f69270cd2e0e509fe50b2cb`。 |
| validator 充分性 | `[fail]` | 当前 validator 退出 0，但复用 `buildDryRun`，只校验模型已表达的维度；内存修改主要可见汇总、完整 GO/F4 清单或 P0 正文时仍可 errors=0。 |
| authority 输入封口 | `[fail]` | `authority_sha256` 只覆盖 simulation ID，不覆盖完整 simulation failure/oracle、能力边界、09/10 canonical 和实际规则代码；安全 oracle 漂移时摘要可不变。 |
| S3/F4/状态词红线 | `[ok]` | 33 个 S3 全部走 F3/F4；11 个 F4 全部 `RESCOPE → REFUSE_AND_RESCOPE`；无语音放行、无非 merge effect 签发、无 `ready_for_review` 冒充交付。 |
| 未修改 600 条主语料 | `[ok]` | 本会话 dry-run validator 重算 source tree SHA-256 为 `0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6`；本轮范围只新增 dry-runs、review、prompt、日志与过程记录。 |
| 独立评审 | `[ok]` | 两个零上下文独立评审和一次 `gpt-5.6-sol` 对抗评审均已落盘；评审结论是红灯，不等于实施验收通过。 |

## 质量复审发现

### A 级阻断

#### A1. `REPLAY_PASS` 未与逐题 perturbation 证据绑定

- 分类评审确认 5 条 LONG_RUN_PAUSE 明确没有暂停/续接证明：`PRJ-001`、`MKT-024`、`DAT-014`、`LRN-030`、`FAM-017`。
- 对抗评审确认 7 条 S3 replay 没有授权缺失、禁语音或强认证失败变体：`OPS-015`、`SAL-002`、`DAT-028`、`LRN-009`、`LRN-028`、`LIF-006`、`FAM-004`。
- 这两组只是已证反例，不是完整受影响集。修复必须为全部 72 个 simulation 建立机器可判定的 `covered_perturbations + expected_recovery + evidence_refs`，再全量重算。

#### A2. validator 可对主要生成物漂移虚绿

- 当前逐行表检查本身有效，但 validator 与生成器共用同一 `buildDryRun`，不能发现共同公式错误。
- 外部评审已复现：删除完整 GO/F4 清单项、把 P0 逐题正文替换成 generic 占位、修改可见 F1/LIVE/replay 汇总，validator 仍可能返回 0 错误。
- 需要纯 renderer 完整字节对账、独立判定 oracle，以及覆盖摘要、清单和 P0/P1 正文的 mutation runner。

#### A3. `authority_sha256` 未覆盖实际权威输入

完整 simulation spec、`00-能力边界.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md` 和实际判定规则未进入摘要。当前摘要不能证明失败恢复和安全红线没有漂移。

#### A4. CTX 冲突/过期没有标准补救合同

172 个 CTX 条目中有 36 个直接选择 `CTX_CONFLICT_OR_STALE`，但 result/solution 没有 CTX issue code。必须覆盖 manifest/source/required-claim digest、`as_of`、`valid_until`、权威顺序、supplemental input、resume 后重验和失败降 unknown。

#### A5. long/multi 恢复模板不能证明幂等和下游冻结

69 个 long、149 个 multi 条目现有字段不足以记录 run/attempt、checkpoint digest、已发生 effect、receipt/idempotency key、部分提交、依赖 DAG、下游 invalidation、补偿或人工对账。恢复可能重复 effect，或让下游继续消费 stale/unknown。

### B 级非阻断

以下项记录但不阻断本轮 A 修复；除非修 A 时自然触及，不为清零 B 继续扩大范围：

1. `RES-046` lifecycle 没有 `pause_resume`，但 turn 中有显式 `resume`，元数据与正文不一致。
2. S3 最小字段表漏 `issuance`，尽管全局规则仍明确非 merge effect 不签发。
3. `OPS-053` 的 F4 D0 拒绝与 connector `read_test` 先后顺序不够明确。
4. `ENG-001`、`ENG-048` 的 F1 workspace 合同与 USER database connector 来源存在边界歧义。
5. P0 16 条目前是差异化“待填写指令”，不是已填 object/action/impact/rollback/auth 的真实 capsule；在真实运行前仍须另补。

## 门禁结果

本会话重新运行了与改动面相称的只读门禁；没有运行会覆盖生成物的 rebuild，也没有跑无生产代码关联的全仓 `just ci`。

| 命令 | exit | 原始结果摘录 | 判定 |
|---|---:|---|---|
| `node --check dry-run-model.mjs` | 0 | 无语法错误 | `[ok]` |
| `node --check rebuild-three-pass-dry-run.mjs` | 0 | 无语法错误 | `[ok]` |
| `node --check validate-three-pass-dry-run.mjs` | 0 | 无语法错误 | `[ok]` |
| `node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs` | 0 | `rows=600 P0=16 P1=41` | `[partial]`，已知语义与 mutation 盲区使其绿灯不充分 |
| `node research/customer-question-corpus/validate.mjs` | 0 | `records=600`；主语料结构、合同与反例门通过 | `[ok]` |
| `node research/customer-question-corpus/simulations/validate-simulations.mjs` | 0 | `sessions=72 A=0 warn=28` | `[ok]`，但该门不校验 dry-run 所选 perturbation 映射 |
| dry-runs emoji gate | 0 | `[ok] emoji gate: clean` | `[ok]` |

三份评审证据：

- `research/customer-question-corpus/dry-runs/review/01-classification-coverage-review.md`：`[fail]`，A=2、B=1、C=0；
- `research/customer-question-corpus/dry-runs/review/02-safety-remediation-review.md`：`[fail]`，A=2、B=3、C=0；
- `research/codex-findings/186-customer-question-corpus-three-pass-dry-run-adversarial-review.md`：`[fail]`，A=3、B=1、C=0。

## 修复清单

1. 对全部 72 个 simulation 建立扰动证据映射并全量重算 DR3；禁止只修已知 12 个反例或硬编码目标计数。
2. 为全部 172 个 CTX 条目增加 `DR-CTX-AUTHORITY-STALE` 与逐题合同、验收门和 mutation。
3. 扩充 long/multi 模板，加入 canonical 幂等、effect ledger、dependency invalidation 与人工对账字段。
4. 导出纯 renderer，增加落盘生成物完整字节对账；另建不复用判定函数的独立 oracle 和生成物 mutation runner。
5. 扩大 authority manifest，覆盖完整 simulation/canonical/边界/规则输入，并对内容变异验证摘要必变。
6. rebuild result/solution，重新跑全部门禁；F/DR1/DR2 必须保持不变，DR3/P0/P1/P2/P3 以全量证据重算为准。
7. 修复会话不得自评为通过；生成新的零上下文 readback prompt 后停止。A=0 前不运行真实 connector、真实模型批次或业务写 effect。

## 收口状态

本轮实施是“主体已落盘、验收红灯”，不是“未实施”，也不是“已可真实试跑”。新会话入口见：
`prompts/187-customer-question-corpus-dry-run-a-repair-continuation.md`。
