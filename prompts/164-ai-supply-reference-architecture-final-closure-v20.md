# AI 供给普适接入 v20 架构终审

你是全新零上下文、只读、对抗性的参考架构审查者。只审查下列冻结目标，不读取任何旧 prompt、旧 finding、过程日志、journal 或其他 agent 的结论，也不修改目标文件：

- 目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 预期 SHA-256：`33afc197085f92355e12272a9c45a49ce4d560715b7b7992759dac8398c83531`
- 预期行数：48,809
- 预期 bytes：3,022,748
- 仓库 HEAD：`174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`

先独立核验身份并完整读取目标，再从根本架构、安全、可构造类型合同、性能和可实施性角度终审。不得把“计划尚未施工”或“固定17/25 fixture尚未成为生产文件”本身计为缺陷；只判断方案是否足以指导一次高质量实施并形成可机械验收的发布闭包。目标文件很长，不得抽样、只读摘要或相信文档自述的通过结论。

必须主动构造反例并检查：

1. v20六字段canonical `ReceiptPointerV20`、wire/hydrated分型、distributive decoder、5个public facade producer、5个root、deep-freeze/JCS、edge manifest、producer DAG和runtime resolver是否同源；bare ref、symbol、structural fill、union body或跨distribution能否旁路；
2. authority source/alias/policy/branch/constituent是否由最终AST准确派生；physical lease、send intent、first byte、before/after-send terminal、完整release tuple、cleanup、reconciliation、restart、expiry与revocation是否逐domain无漏无重；
3. TUF repository/root/ordered role/target path/canonical bytes/digest/trusted time/high-water/distribution，以及Rights、Network、Billing、DataBoundary四组件是否保留可遍历的同一非联合主体，不能被同型实例或联合推断换挂；
4. host-signed request IR、typed content或host handle、occurrence、adaptation、decoder proposal、raw frame、request、attempt、sequence和event commit是否形成真实correlation；恶意adapter/decoder能否伪造权威字段或跨请求重放；
5. physical attempt、retry、delivery unknown、funding与fallback cursor/start/history/advance/final DAG是否存在结果重标、双终态、错前驱、重复消费或跨subject换挂；
6. legacy read/decode envelope是否让valid、schema-invalid和unreadable每个准确输入/index都只能lift或以准确reason quarantine；JSON/SQLite迁移、Execution、plugin、provider账号cleanup、external identity与Codex command-backed auth是否闭合；
7. 81行requirement与81行exact oracle、owner append-only compiler、fresh与migration positive/absence、claim、support artifacts、extension protocol和distribution anchor是否有mandatory producer/consumer路径；
8. 唯一37-suite tuple生成39-row `shell:false` argv BOM，逐行passed/failed/not-run准确前驱、first-failure fold、成功/失败orchestrator和release binding是否防漏项、重排、错前驱、失败晋升和未运行伪通过；
9. remote witness release-time comparison、三平台anchor、3个真实locale加pseudo的972-cell a11y set、baseline genesis/replacement和owner decision是否按准确deployment/distribution闭合；
10. TypeScript基础编译是否掩盖required-`never`、非分布式条件、并集推断、宽ref、结构性自填、悬空producer、错误overload或类型爆炸。实际运行锁定Node 22、唯一前置`--max-old-space-size=2048`和TypeScript 5.9.3 strict编译、Compiler API全量检查及最小正反例；检查完整合同与单fixture分离的5进程性能协议、2.5 GiB/900,000/60秒绝对门、source headroom与签名相对baseline是否诚实，且不能靠伪拆共同加载合同通过。

严重度：A为会导致越权、数据/费用/状态错误、不可构造主路径、发布假阳性或无法实施的阻断缺陷；B为会显著削弱稳定性、扩展性、性能、运维或证据质量的实质缺口；C为非阻断改进。只有A=0且B=0才可给`PASS`。不要为追求finding数量重复报告同一根因；每个finding必须给出可复现反例、准确行号和最小根因修复。

把完整报告写入`research/codex-findings/164-ai-supply-reference-architecture-final-closure-v20.md`。报告必须包含冻结身份、实际方法与命令摘要、逐项反例或证明、A/B/C精确计数和最终`PASS`或`FAIL`。写完后再次核验目标SHA未漂移；只写报告，不修改其他文件。
