# 生成物字节对账门最终定向复核

## 结论

`[pass]`

原 A-02 已关闭。

| 级别 | 数量 |
|---|---:|
| A | 0 |
| B | 0 |
| C | 0 |

## 逐项证据

### 1. 完整生成物对账

`[pass]`

- `DOMAIN_FILES` 明确定义 12 个领域文件，[simulation-spec.mjs:9](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/simulation-spec.mjs:9)。
- validator 读取对应的 12 个 session、12 个 fixture 及 `02-coverage.md`，[validate-simulations.mjs:28](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/validate-simulations.mjs:28)。
- `renderGenerated(specs)` 为相同文件集合生成期望 session、fixture 和 coverage，[simulation-spec.mjs:4631](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/simulation-spec.mjs:4631)。
- validator 对每个 session、fixture 及 coverage 做完整内容严格相等比较，任何漂移均进入 A errors，[validate-simulations.mjs:313](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/validate-simulations.mjs:313)。

### 2. 三类生成 Markdown 反例

`[pass]`

测试通过 `cloneSpecs()` 保持 spec 不变，先调用 `renderGenerated(specs)`，随后只修改内存生成物并交给 `collectIssues`，[test-simulation-mutations.mjs:32](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/test-simulation-mutations.mjs:32)。

三类反例均已覆盖：

- 删除 `SIM-LIF-02` fixture 的必需 `expiresOn` 字段，[test-simulation-mutations.mjs:62](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/test-simulation-mutations.mjs:62)。
- 把 `SIM-ENG-06` 的 S3/F4 可审阅结果改成“已经部署给客户，已有授权”，[test-simulation-mutations.mjs:72](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/test-simulation-mutations.mjs:72)。
- 把 `SIM-OPS-01` 用户轮塞入 `SIM-WRT-01` 会话，[test-simulation-mutations.mjs:82](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/test-simulation-mutations.mjs:82)。

真实输出中三项均被拒绝，分别为：

```text
[ok] mutation rendered-required-field-deleted rejected A=1
[ok] mutation rendered-s3-fake-execution rejected A=1
[ok] mutation rendered-turn-content-wrong-sim rejected A=1
```

### 3. 正式树不变量

`[pass]`

mutation 自测在变异前后分别计算正式树摘要并要求相等，[test-simulation-mutations.mjs:44](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/test-simulation-mutations.mjs:44)、[test-simulation-mutations.mjs:91](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/test-simulation-mutations.mjs:91)。

真实输出：

```text
[ok] official tree unchanged sha256 9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
```

validator 也独立输出相同摘要。

### 4. 数量、warning 与主语料回归

`[pass]`

真实 validator 输出：

```text
sessions=72 domains=12 H/M/L=32/25/15
tree_sha256=9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
A=0 warn=28
[ok] A-level checks passed
```

主语料门输出：

```text
"records": 600
"questionFiles": 12
[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
```

### 5. 文档登记

`[pass]`

- README 导航已登记 mutation 自测，[README.md:19](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/README.md:19)。
- README 命令块已加入 mutation 命令，[README.md:31](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/README.md:31)。
- 计划门禁已加入相同命令，[00-simulation-plan.md:95](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/00-simulation-plan.md:95)。

## 门禁摘要

| 命令 | 退出码 | 输出摘要 |
|---|---:|---|
| `node research/customer-question-corpus/simulations/validate-simulations.mjs` | 0 | `72/12`、`H/M/L=32/25/15`、目标摘要、`A=0 warn=28` |
| `node research/customer-question-corpus/simulations/test-simulation-mutations.mjs` | 0 | 三类生成物反例均以 `A=1` 被拒；正式树摘要不变 |
| `find ... -print0 \| xargs -0 bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `node research/customer-question-corpus/validate.mjs` | 0 | `records=600`；主语料验证通过 |

## 交付建议

`[pass]` 建议按 README 和计划界定的访谈演练、对话设计、提示词回放及人工评测用途交付。生成物虚绿已被完整生成树对账和三类内存变异测试共同封闭，未发现新的安全或结构回归。