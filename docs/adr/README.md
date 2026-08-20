# ADR 索引与编号规则

本仓保留两套独立编号序列，引用时必须写明“设计”或“工程”，不得只写裸编号。

## 设计决策(`docs/adr/design/`)

| 编号 | 决策 | 状态 |
|---|---|---|
| 设计 ADR-001 | `design/ADR-001-execution-layer.md`:执行层复用 Hopper、锁版本、不等待、双路径 | 已批准 |
| 设计 ADR-003 | 产品载体与部署组合 | 预留，尚未成文 |

设计 ADR-002 不使用，以免与已存在的工程 ADR-002 混读。

## 工程决策(`docs/adr/`)

| 编号 | 决策 | 状态 |
|---|---|---|
| 工程 ADR-001 | `ADR-001-pipecat-interrupt-go.md`:Pipecat 打断语义 spike | 已定 |
| 工程 ADR-002 | `ADR-002-byoa-observed-model.md`:BYOA observedModel 断言 | 已定，豁免休眠 |
| 工程 ADR-101 | `ADR-101-asr-volc.md`:火山 sauc ASR 定档 | 已定 |

新增 ADR 必须先选定序列，再使用该序列的下一个可用编号。跨文档链接应指向完整文件路径。
