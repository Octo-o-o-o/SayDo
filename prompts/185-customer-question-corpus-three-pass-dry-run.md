# 任务：为 600 条潜在客户提问生成三轮静态 dry run 结果与补充方案

你是实施会话。仓库：`~/WorkSpace/SayDo`。

## 1. 目标与范围

严格按 `research/customer-question-corpus/dry-runs/00-three-pass-dry-run-plan.md` 实施。对主语料 600 条记录逐条做三轮互补静态 dry run，生成：

- `research/customer-question-corpus/dry-runs/01-three-pass-dry-run-result.md`
- `research/customer-question-corpus/dry-runs/02-dry-run-remediation-plan.md`
- `research/customer-question-corpus/dry-runs/dry-run-model.mjs`
- `research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs`
- `research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs`

只允许写 `research/customer-question-corpus/dry-runs/`。不要改 questions、contexts、contracts、simulations、README、docs、history、review、prompt 或其他文件。不要 commit、不要 push。

这轮是静态 dry run，不调用真实模型、connector、外部账号、浏览器、Web 搜索或业务写工具，不生成任何真实外部 effect。不得把静态判定叙述成真实执行结果。

## 2. 权威输入

完整读取并遵守：

- `research/customer-question-corpus/dry-runs/00-three-pass-dry-run-plan.md`
- `research/customer-question-corpus/README.md`
- `research/customer-question-corpus/00-能力边界.md`
- `research/customer-question-corpus/01-设计与分布.md`
- `research/customer-question-corpus/03-频率与语义校准.md`
- `research/customer-question-corpus/questions/*.md`
- `research/customer-question-corpus/contexts/CTX-*/manifest.md`
- `research/customer-question-corpus/contracts/live/*.json`
- `research/customer-question-corpus/contracts/f1-capability-contracts.json`
- `research/customer-question-corpus/simulations/simulation-spec.mjs`
- `research/customer-question-corpus/simulations/01-schema.md`

`questions/*.md`、LIVE/F1 合同和 simulation spec 是判定源，不要手抄另造 600 条。

## 3. 实施形状

### 3.1 模型

`dry-run-model.mjs` 应：

1. 解析 12 个问题文件的恰好 600 条记录；
2. 解析 C/D/H/R/K/S、F/B、工具、上下文模式；
3. 加载 465 条 LIVE 合同、46 条 F1 合同与 72 个 simulation corpus ID；
4. 判断 LIVE 是否含 `locator_provider=USER` 的外部 connector，以及是否只依赖 WORKSPACE；
5. 按计划文档的 DR1、DR2、DR3 规则生成逐题判定；
6. 为每题生成稳定的失败注入类型和期望恢复类型，但不要声称实际注入执行；
7. 给每题登记标准 issue code，所有 code 必须在 solution 中有解决模板；
8. 导出纯函数供 rebuild 与 validator 复用，但 validator 还需独立检查生成 Markdown 的 600 行、三轮字段和摘要，不能只相信模型返回 `ok`。

建议 issue code 至少覆盖：

- `DR-USER-INPUT`
- `DR-EXTERNAL-CONNECTOR`
- `DR-F2-CONDITIONAL`
- `DR-F3-PLAN-ONLY`
- `DR-F4-RESCOPE`
- `DR-S3-SAFETY-CAPSULE`
- `DR-LONG-RUN-CHECKPOINT`
- `DR-MULTITOOL-RECOVERY`
- `DR-NO-REPLAY-ORACLE`
- `DR-F1-PARTIAL-ORACLE`

不要把 “没有完整 replay oracle” 误写成 “题目必然失败”。

### 3.2 Result 文档

`01-three-pass-dry-run-result.md` 至少包含：

- 静态、未调用真实工具的醒目边界；
- 源摘要、生成时间口径（固定为 `2026-08-26`，不要写运行时随机时间）；
- 三轮假设和状态释义；
- 总体汇总与按领域、F、DR1、DR2、DR3、优先级的计数；
- 清楚回答：
  - 原始目标理论可达：F1+F2；
  - 当前只计划/人工交接：F3；
  - 原始目标必须拒绝/收缩：F4；
  - 当前冷启动可直接 GO；
  - 已有完整 simulation replay；
- P0 与 P1 的完整 ID 清单，不得抽样；
- 600 条逐题表，每条恰好一行，至少含：ID、领域、F/S、上下文、DR1、DR2、扰动、DR3、优先级、issue code、理论结论；
- 明确 `ready_for_review` 不等于交付，S3 语音不得放行。

汇总必须程序化计算，不能把以下观测当硬编码真相；实现后应独立核对当前预期基线：

- 600 条；F1/F2/F3/F4 = 46/483/60/11；
- 72 个 simulation；
- DR1 预期为 `GO=28`、`WAIT_USER=101`、`CONDITIONAL_ROUTE=54`、`WAIT_CONNECTOR=264`、`WAIT_USER_AND_CONNECTOR=82`、`PLAN_ONLY=60`、`RESCOPE=11`；
- DR3 优先级预期为 replay 72、P0 16、P1 41、P2 322、P3 149。

若程序化结果不同，先诊断源数据和规则，不要为匹配数字强改。

### 3.3 Solution 文档

`02-dry-run-remediation-plan.md` 至少包含：

- 每个 issue code 的触发条件、标准补充物、最小字段、验收门、失败时安全降级；
- USER 输入包模板；
- connector preflight 模板（locator、scope、freshness、as_of、最小字段、read test；不得放真实 token）；
- F2 条件执行卡；
- F3 plan/handoff 合同；
- F4 拒绝与安全降级 oracle；
- S3 effect capsule（对象、动作、影响、回滚、挑战/强认证、禁止语音批准；非 merge effect 当前仍不签发）；
- D4/H4/R4 checkpoint、租约、暂停恢复、停止条件；
- K3/K4 单工具失败和 partial result 方案；
- replay oracle 最小结构；
- P0 16 条逐题补充建议与 P1 41 条按模式分组的完整覆盖；
- 后续真实运行的分批方案，但不得在本会话执行：优先 simulation replay、再当前 F1、再小批 F2；F3 只验 plan/handoff，F4 只验拒绝，S3 不做真实 effect。

方案要明确哪些是通用模板、哪些必须逐题填写，禁止用一个 generic fallback 冒充 600 条已闭合。

## 4. 确定性与安全

- 生成器只写上述两份生成 MD；先写临时文件，再在完整校验后原子替换，或采用等效 fail-closed 方式；
- 结果排序固定为 12 个问题文件顺序与文件内顺序；
- 计算并记录 dry-run 权威输入摘要；
- 构建前后计算主语料源树（questions、contexts、contracts、04）的摘要，必须相同，否则失败；
- 不读取或输出 token、真实个人信息、完整本机敏感路径；
- 全部文本简体中文，标识符与状态保持英文；零 emoji。

## 5. 验收标准

必须真实运行并记录原始摘要：

```bash
node research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs
node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs
node research/customer-question-corpus/validate.mjs
find research/customer-question-corpus/dry-runs -type f -print0 \
  | xargs -0 bash scripts/check-emoji.sh
```

另做两次连续 rebuild，证明两份生成 MD 的 SHA-256 稳定；验证逐题表恰好 600 行、ID 唯一、P0/P1 ID 全量且 solution 覆盖所有 issue code。

完成后只报告：改动文件、核心统计、门禁退出码、两份 MD 摘要、主语料源树前后摘要、未做事项。不要自称独立评审通过。
