# AI 供给专题 · 合同草案

- 建立日期：2026-08-24
- 来源：`../2026-08-23-ai-supply-universal-onboarding-final.fable.md` 原 §4 与 §8 的内嵌 TypeScript 代码块
- 规模：45,696 行（16 个原始代码块，按所属子节归为 10 个文件）

## 这是什么

这是 AI 供给专题的**合同草案**，不是生产代码。它原本以 Markdown 代码块的形式内嵌在主方案里，
占该文档 48,809 行中的 45,696 行（93.6%）。2026-08-24 按
[`../../review/2026-08-24-ai-supply-v20-loop-diagnosis.md`](../../review/2026-08-24-ai-supply-v20-loop-diagnosis.md)
的结论外移到本目录，使它可以被 `tsc` 直接检查，而不是靠人读评审逼近正确。

**当前状态**：机械可编译，设计未收敛。三路零上下文对抗评审连续 20 轮 FAIL，
v20 仍有 11 条 A 级问题未修（见下表）。

## 验证方式

按原文档顺序拼接后编译。本会话实测：

```
node v22.23.1 / TypeScript 5.9.3 / strict + NodeNext / --max-old-space-size=2048
tsc exit=0，零诊断输出
```

单个文件**不能**独立编译——它们之间有类型依赖（例如 `10-ui-state-copy.ts` 引用
`01-core-contracts.ts` 定义的 `ReferenceRequirementKeyV3`）。按文件名数字顺序拼接即为原文档顺序。

## 文件构成

| 文件 | 行数 | 来源子节 |
|---|---|---|
| `01-core-contracts.ts` | 24,283 | §4.2 合同必须拆成连接、绑定、执行器与不可变收据 |
| `02-rights-billing.ts` | 10 | §4.6 Rights 与费用策略 |
| `03-extension-points.ts` | 544 | §4.10.2 最小且封闭的扩展点 |
| `04-inference-ir.ts` | 136 | §4.11 可保真的 Inference IR 与 adaptation-loss gate |
| `05-control-plane.ts` | 32 | §4.12 控制面编译、数据面执行 |
| `06-sdk-compat.ts` | 674 | §4.15 开源贡献者与长期兼容性合同 |
| `07-reference-monitor.ts` | 1,196 | §4.16.1 Reference monitor 与单次消费链 |
| `08-wire-budget.ts` | 12,630 | §4.16.3 Wire、归档与宿主总预算 |
| `09-public-truth.ts` | 3,413 | §4.16.8 单一公共真相 |
| `10-ui-state-copy.ts` | 2,778 | §8.2 状态词与提示模板 |

每个文件顶部保留 `// ===== 来源 =====` 注释，标注原文档行号，可回溯。

规模参照：真实 `packages/contracts` 整包为 5,040 行；`01-core-contracts.ts` 单文件是它的 4.8 倍。

## v20 未解决的 A 级问题

下表把三路终审的 11 条 A 级 finding 映射到文件。映射依据是 finding 引用的类型/常量的
**顶层定义位置**（程序化 grep 得出），不是对 finding 本身的技术复核——本目录的建立者
未复核这些 finding 的成立性，只接受其结论。

| 来源 | 编号 | 问题 | 涉及文件 |
|---|---|---|---|
| 164 架构终审 | A-01 | 类型参数被当成运行时身份权威，union、宽模板和同型实例没有统一失败关闭边界 | `01`、`09` |
| 164 | A-02 | 物理、fallback 与 response event 的终态不由同一持久 transition/CAS 内核裁决 | `09` |
| 164 | A-03 | authority registry 没有从最终 AST 闭合，新租约漏 census 且存在不可构造主路径 | `01` |
| 164 | A-04 | 性能发布合同无法标识 43 个测量主体，也无法跨发行物滚动 baseline | `08` |
| 165 生态体验 | A-01 | Tencent「global」row 混淆中国站与 International 产品域 | 不在本目录，属主方案 §9 生态清单 |
| 166 最终对抗 | A-01 | 泛型判别没有保持 constituent 相关性，非法分支可达且 owner 正向路径不可构造 | `01`、`09` |
| 166 | A-02 | 新增 authority lease 未进入冻结的生命周期 registry，fallback 丢失 kind 与 ordinal | `01` |
| 166 | A-03 | 物理 attempt terminal 接受任意 ledger range，没有同 attempt 的类型或证据边 | `01` |
| 166 | A-04 | 公共 proof graph 不是自描述闭包，manifest 无法表达验收要求 | `10` |
| 166 | A-05 | 性能 release gate 只能证明一个测量对象，无法证明完整 artifact 加 42 个隔离 fixture | `08` |
| 166 | A-06 | host-origin read/decode 证据仍是结构对象，可自填 provenance 和 attempt identity | `07` |

finding 原件在 `../../../research/codex-findings/` 的 164、165、166 三份报告。

## 下沉路径

诊断报告建议这些草案**逐块下沉** `packages/contracts` 真实源码树，由 `tsc` + `vitest` + fixture
锁定，而不是继续在文档形态下做评审轮次。下沉前需要注意：

1. **先签十项 owner 决策**。见 [`../2026-08-24-ai-supply-owner-decisions.md`](../2026-08-24-ai-supply-owner-decisions.md)。
   其中决策 2（Execution Agent 归属）在原 §4 触及 2,154 行——草案目前同时容纳「独立执行面」
   与「并入 Tier 1/Hopper」两种形态，先收敛决策可显著减少下沉体量。
2. **决策 10 需重估**。它为「Markdown 内类型体操」设定的编译预算（2.5 GiB peak RSS、
   900,000 type instantiations、60 秒 wall），在草案下沉为真实包之后不适用，需重新推导。
3. **不要整包搬运**。`01-core-contracts.ts` 单文件 24,283 行，直接落入 `packages/contracts`
   会让真实合同包膨胀近 5 倍，且带入 11 条未修 A 级问题。按 Phase 切分、逐块加测试是唯一可控路径。

## 纪律

- 本目录**不是** `packages/contracts`，不参与构建，不被产品加载，不被任何测试执行。
- 编译通过只证明语法与类型自洽，**不证明产品设计正确**。
- 未经 owner 决策与 PLAN-2 排产，不得据此改动生产代码（主方案 §0 开工纪律仍然有效）。
