# SayDo AI Supply 参考架构最终闭包复核 v11

你是全新、零上下文的独立架构评审者。除本prompt外，只评审下列唯一目标，不读取仓库源码、AGENTS、旧prompt、旧review、journal、索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 22,507 行；
- 1,363,124 bytes；
- SHA-256 `3b93808d641a6f2a59a1938ae6526280da1d7746dc8acf4197d030cdc6bf8ed1`。

先用只读命令核对三项；不一致立即停止并写`[fail] input drift`。随后完整读取1–22,507行，禁止关键词抽样，禁止读取既有评审结论，禁止编辑目标。

判断该方案能否成为一次做到位、可实施、可机械验证、长期可扩展且性能与稳定性达到顶级开源参考实现标准的合同。主动构造当前文本允许的最短反例，至少覆盖：

1. receipt实例DAG、edge manifest、writer epoch、revision、single-successor CAS、anchor/TUF、跨subject换挂和正向可达性；
2. 每个具有socket/network/secret/credential/signature/browser/process/listener/effect/hold authority的lease是否有精确inventory，before-intent closure是否逐entry释放且与已有intent严格排斥；
3. descriptor→conditional final lease→hosted authorization bundle→send intent→首字节的单向顺序，hosted unused lease与零字节关闭是否无producer环；
4. workload/OAuth/API-key每个物理step的cursor、intent、terminal、旧credential处置与delivery unknown恢复；
5. persistent budget escrow/correction/finality的唯一后继、有限horizon、late correction和100并发守恒；
6. restart五stage、旧/新process、listener、credential/network清理、safe-retry baseline、query reconciliation及direct/reconciled success互斥；
7. `SupplySolutionReceipt.slots`是否真为唯一四槽真相，template到terminal/advance能否跨slot或跨solution拼接；
8. Execution stdio/loopback/remote identity映射，close与turn同cursor CAS，close before-intent重试活性，turn query与cleanup分离；
9. 模型与tool raw response inventory、decoding/loss、权威/advisory extraction、result/tool occurrence及manual committed result是否能脱离真实send chain伪造；
10. remote witness的production artifact/endpoint/threshold set、24小时逐member运行、双observer、quorum、quantile、fault injection与raw corpus replay是否是实际资格而非自报；
11. publisher公平的twelfths递推、rounding、actual service、reservation、tie-break、service curve、restart restore、第5–8与第9分支是否可由独立evaluator逐state重放；
12. 61行reference requirements、derivation digest/count/unique subject、critical protocol/auth/recipe断言、V1/V2禁用、requirement→journey→entry→ecosystem gate是否只有一份最低真相；
13. discovery conformance的mode/budget/provenance/environment/artifact/config generation与provider scope是否可跨报告拼接；
14. control/data plane编译、热路径有界性、迁移/回滚、插件隔离、可观测性、恢复和Phase/TCK是否与核心合同逐项对应而非只靠布尔自证。

严重度：A为secret/数据/费用/副作用越权、重复执行、不可恢复、合同不可构造、核心旅程不可达或reference-grade失真；B为常见主路径、扩展性、性能、稳定性、恢复或机械门禁的实质缺口；C为非阻断建议。只有A=0且B=0才能给`PASS`。

每条发现必须有编号、严重度、精确行号、最短反例或不可达路径、现有合同为何挡不住、根因级最小修法；同根因合并。报告必须包含读取完整性和最终SHA、A/B/C计数、覆盖矩阵与唯一verdict。

仅通过`apply_patch`将最终报告写入：

`research/codex-findings/136-ai-supply-reference-architecture-final-closure-v11.md`

写完后只读报告行数、bytes和SHA-256；不得修改其他文件。
