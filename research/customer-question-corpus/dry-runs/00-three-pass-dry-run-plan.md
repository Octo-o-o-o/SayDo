# 600 条提问三轮 dry run 计划

## 1. 目标

对主语料的 600 条提问逐条做三轮互补的静态 dry run，在不调用真实模型、connector、外部账号或业务写工具的前提下，提前回答两件事：

1. 哪些提问在当前 SayDo 能力与已登记前置条件下，理论上能到达首个可审阅结果；
2. 哪些提问在真实执行前仍缺输入、connector、授权、长任务恢复合同或可判定 oracle。

本轮不证明真实工具可用、授权有效、模型输出质量或现实任务已经执行。`PASS` 只表示现有静态合同足以支持对应 dry-run 判断。

## 2. 输入

- `questions/*.md` 的 600 条问题及 C/D/H/R/K/S/F/B 标签；
- `contexts/CTX-*/manifest.md` 的冻结事实、有效期、required claims 与 supplemental input；
- `contracts/live/*.json` 的 465 条 LIVE 逐对象来源合同；
- `contracts/f1-capability-contracts.json` 的 46 条 F1 能力合同；
- `simulations/simulation-spec.mjs` 的 72 个多轮回放、fixture、oracle 与失败变体；
- `00-能力边界.md` 及 canonical 中 Gate 0、S3、`ready_for_review` 的约束。

## 3. 三轮模型

### DR1：冷启动与前置条件

环境只假设：授权 workspace 可读、仓内 CTX 可加载；不假设用户附件已经上传，也不假设外部 connector、登录态或作用域已经配置。

逐题状态：

- `GO`：F1 且不缺 USER、外部 connector，可进入当前缺省 coding/workspace 闭环；
- `WAIT_USER`：必须先得到 USER 材料；
- `WAIT_CONNECTOR`：至少一个 LIVE 对象 locator 由 USER/connector 提供；
- `WAIT_USER_AND_CONNECTOR`：两类前置同时缺；
- `CONDITIONAL_ROUTE`：没有上述缺口，但仍是 F2 条件能力；
- `PLAN_ONLY`：F3，只能做计划、草稿或人工协作版本；
- `RESCOPE`：F4，拒绝越权部分并收缩范围。

本轮的 `WAIT` 不是产品失败；若系统在缺资料时直接声称结果，才是失败。

### DR2：充分前置下的目标可达性

假设题面声明的 USER 输入、LIVE 数据、登录态、最小权限和人工检查点均具备，但不放宽当前产品能力边界：

- F1 → `EXECUTABLE`；
- F2 → `EXECUTABLE_WITH_CONDITIONS`；
- F3 → `PLAN_OR_HANDOFF_ONLY`；
- F4 → `REFUSE_AND_RESCOPE`。

F3/F4 的计划、拒绝或降级如果与边界一致，属于系统正常处理；但原始请求的完整外部效果不可计为可执行。

### DR3：失败注入与恢复闭环

每题按风险优先选择一个静态扰动：S3 授权缺失、F4 用户坚持越权、长任务暂停恢复、K3/K4 单工具部分失败、外部 LIVE 权限不足、USER 输入缺失、CTX 冲突/过期或 verify 失败。

逐题状态：

- `REPLAY_PASS`：属于 72 个 simulation，已有多轮、fixture、oracle 和失败恢复变体；
- `CONTRACT_PARTIAL`：F1 有能力与 verify 合同，但没有完整多轮失败 oracle；
- `UNPROVEN_P0`：未进入 simulation 的 S3/F4；实际执行前必须补安全 capsule；
- `UNPROVEN_P1`：未进入 simulation，且含 D4/H4/R4/K4 长周期或复杂恢复；
- `UNPROVEN_P2`：未进入 simulation，且含外部 connector、K3 或 F3 条件；
- `UNPROVEN_P3`：其余未进入 simulation 的低复杂度静态条目。

`UNPROVEN` 表示“当前语料不足以证明恢复行为”，不等于提问无价值或一定执行失败。

## 4. 最终判断轴

结果文件同时保留两个结论，禁止压成一个模糊分数：

- `目标可达性`：F1/F2 理论上可到首个可审阅结果；F3 只到计划/人工交接；F4 必须拒绝并收缩；
- `真实运行准备度`：是否已有 USER schema、connector preflight、授权/effect capsule、长任务 checkpoint 和失败 oracle。

因此，一个 F4 条目可以“系统处理正常”但“原始目标不可执行”；一个 F2 条目可以“理论可达”但“冷启动必须等待 connector”。

## 5. 产物

- `01-three-pass-dry-run-result.md`：方法、汇总、问题簇、P0/P1 清单以及 600 条逐题三轮结果；
- `02-dry-run-remediation-plan.md`：按标准 issue code 给出前置补充物、模板、验收门和实际执行分批建议；
- `dry-run-model.mjs`：只读解析和判定模型；
- `rebuild-three-pass-dry-run.mjs`：确定性生成两份 MD；
- `validate-three-pass-dry-run.mjs`：独立检查 600 条、三轮字段、issue 覆盖、摘要与生成物一致性。

## 6. A/B 验收

### A 级阻断

- 不是 600 条、ID 重复、字段或源记录错配；
- 任一问题缺 DR1/DR2/DR3 或最终判断；
- 把 F3/F4 写成原始目标可直接执行；
- 把 S3 写成语音可放行，或把 `ready_for_review` 写成已经交付；
- LIVE/F1/CTX 合同集合与主 validator 不一致；
- P0/P1 清单漏项，或 solution 没覆盖 result 使用的 issue code；
- 生成不确定、修改主语料，或宣称调用了本轮未调用的真实工具。

### B 级非阻断

- 个别扰动也可选择另一种合理失败方式；
- P2/P3 的优先级可随真实客户与 connector 证据调整；
- 解决方案中的时间估算只作为后续排批参考，不作为本轮事实。

## 7. 门禁

```bash
node research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs
node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs
node research/customer-question-corpus/validate.mjs
find research/customer-question-corpus/dry-runs -type f -print0 \
  | xargs -0 bash scripts/check-emoji.sh
```

生成前后对主语料源树计算 SHA-256；本轮只允许写 `dry-runs/`、评审、prompt、日志和 process journal。
