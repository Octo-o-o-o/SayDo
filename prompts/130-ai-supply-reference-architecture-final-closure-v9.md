# SayDo AI Supply 参考架构最终闭包复核 v9

你是全新、零上下文的独立架构评审者。只评审下列唯一目标，不读取仓库里的源码、AGENTS、旧 prompt、旧 review、journal、计划索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 16,355 行；
- 1,025,192 bytes；
- SHA-256 `ae6175a7195411f6878f4317ef4413f354df0763e3be6a80e7c54fc2c0c6980e`。

先用只读命令核对三项；不一致立即停止并写`[fail] input drift`。随后完整读取1–16,355行，禁止关键词抽样，禁止读取既有评审结论，禁止编辑目标。

任务是判断该方案能否作为一次做到位、可实施、可机械验证、长期可扩展且性能与稳定性达到顶级开源参考实现标准的合同。请主动构造当前文本允许的最短反例，至少覆盖：

1. receipt实例DAG、writer epoch、revision、single-successor CAS、anchor/TUF、producer order、通用ref旁路和错误状态取lease；
2. 全部判别联合的真实可构造性、复合literal与`Extract`、必填`never`、正向活性和跨分支换挂；
3. local-control、secret/network/spawn/effect先后顺序，以及所有发送路径的no-authority lease→send-intent→terminal闭包；
4. workload credentialed与metadata source排斥、IMDSv2首step失败与两step、OAuth初始access-only、device-only pending、refresh/API-key不确定态；
5. fresh witness独立bootstrap root、registration与status query共享预算、query传输失败与耗尽终态；
6. persistent budget finality/correction escrow、100并发、late correction、physical/outstanding不变量和authority breach；
7. runtime inner terminal到fallback outer的穷尽映射，success/unknown/control-stop不得advance或改账；
8. staged success→restart terminal/commit→loaded generation→live intent/lease/result/completion的单向屏障；
9. Execution local committed/not-committed、manual committed record-result、turn unknown reconciliation、remote session closed和zero路径；
10. protocol/capability/discovery/execution conformance core的语义主体、GA maturity/tier/readiness/UX exact gate、publisher公平预算和Phase 0真实语义门。

严重度：A为secret/数据/费用/副作用越权、重复执行、不可恢复、合同不可构造、核心旅程不可达或reference-grade失真；B为常见主路径、扩展性、性能、稳定性、恢复或机械门禁的实质缺口；C为非阻断建议。只有A=0且B=0才能给`PASS`。

每条发现必须有编号、严重度、精确行号、最短反例或不可达路径、现有合同为何挡不住、根因级最小修法；同根因合并。报告必须包含读取完整性和最终SHA、A/B/C计数、覆盖矩阵与唯一verdict。

将最终报告写入：

`research/codex-findings/130-ai-supply-reference-architecture-final-closure-v9.md`

写完后只读报告行数、bytes和SHA-256；不得修改其他文件。
