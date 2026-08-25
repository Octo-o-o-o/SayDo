# AI Supply 参考架构最终闭包复核 v12

你是全新、零上下文、只读的参考架构审查者。只读取下列目标文档，不读取本仓其他prompt、review、history、journal、日志或实现者说明，也不沿用此前任何评审结论：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结身份必须先独立验证：25,018行、1,513,595 bytes、SHA-256 `7ffadde7837eeab3332431a67437aff2a65595cc1e9cda8c88c69a2e970e8d09`。不一致就只报告输入漂移并停止。验证一致后必须连续读完整文件，不能抽样、不能只读摘要或第17节。

目标是判断这份方案能否作为顶级开源项目的可施工参考架构，而不是评价文字是否丰富。逐项对抗检查：

1. Connector/Adapter/Protocol/Capability/Policy/Receipt边界、唯一真相源和扩展兼容性。
2. 所有持有socket、secret、credential/signing、process/listener、Gate/effect、cursor、worker、funding/budget hold的lease，是否有穷举、非空inventory、单向producer、唯一CAS后继、before/after-intent终态、expiry/restart recovery；检查非`LeaseReceipt`持权逃逸。
3. descriptor→final lease→credentialized envelope→hosted bundle→send intent→terminal是否无环且每个阶段正例可构造；Gate/effect/network authority是否分离并准确关闭。
4. conformance/runtime/fallback的费用、rights、data、route、model、raw response、usage、retry与delivery-unknown是否无伪造或自动重试洞。
5. `SupplySolutionReceipt`四槽tuple、capability轴、evaluator独立性、unknown-metering manual-only是否在类型和状态机上都无法换挂。
6. Execution的stdio/loopback/remote identity、sandbox、session/turn/tool、side effect、manual reconciliation、close与unknown recovery是否有完整正向和故障路径。
7. discovery三种mode、deterministic core与live run evidence、被动socket和显式动作authority是否互斥、可构造、可恢复。
8. OAuth/API-key/workload identity、custom header/mTLS、cloud IAM、proxy/TLS/credential recipient是否端到端闭合。
9. publisher fairness、预算、parser/content/evidence资源、restart、overload和独立oracle是否定义唯一且可计算。
10. TUF/registry/plugin SDK/release binding/remote witness是否无自引用、降级、回滚、伪签和发布证据替换洞。
11. 61行reference requirements、typed journey、recipe/state producer、phase/TCK/DoD是否可从合同机械投影且没有声明与验收漂移。
12. 性能、稳定性、可观测性、数据保留、回滚和迁移是否足以长期扩展。

主动寻找反例：类型交集变`never`、可选字段绕过、bare `ReceiptRef`替代authority、同一revision双消费、producer反向边、终态不可达、计数/舍入矛盾、Phase/TCK未覆盖正文不变量、正例只能靠布尔自证。不要因文档很长而降低标准。

把报告写入：

`research/codex-findings/139-ai-supply-reference-architecture-final-closure-v12.md`

报告必须含：冻结完整性、A/B/C计数、逐finding的严重度与精确行号/类型名、最小反例、为何现有门禁抓不到、根因级修复、至少14项覆盖矩阵、唯一verdict。A表示安全/费用/数据/不可构造/核心架构或发布阻断；B表示参考实现级质量、稳定性、可验证性或主流能力缺口；C仅是非阻断改进。只有A=0且B=0可`PASS`；否则必须`FAIL`。不得修改目标文档。
