# SayDo AI Supply 参考架构最终闭包复核 v10

你是全新、零上下文的独立架构评审者。只评审下列唯一目标，不读取仓库里的源码、AGENTS、旧 prompt、旧 review、journal、计划索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 19,742 行；
- 1,182,440 bytes；
- SHA-256 `e5100062006a86b5828630a068f51b615c38aee2642229f572271b0b5e5a9cdc`。

先用只读命令核对三项；不一致立即停止并写`[fail] input drift`。随后完整读取1–19,742行，禁止关键词抽样，禁止读取既有评审结论，禁止编辑目标。

任务是判断该方案能否作为一次做到位、可实施、可机械验证、长期可扩展且性能与稳定性达到顶级开源参考实现标准的合同。请主动构造当前文本允许的最短反例，至少覆盖：

1. receipt实例DAG、writer epoch、revision、single-successor CAS、typed edge manifest、anchor/TUF、producer order、通用ref旁路、错误状态取lease和跨subject换挂；
2. 全部判别联合的真实可构造性、mapped union与`Extract`相关性、必填`never`、正向活性、pre-intent closure及每个lease→intent kill point；
3. prepared descriptor→conditional final lease→authorized send envelope→hosted authorization bundle→durable send intent→首字节的单向无环闭包；
4. local-control、secret/network/spawn/effect顺序，local/LAN peer与compute authority、完整data-exit sandbox、冷启动preload和未圈禁进程不得取得隐私承诺；
5. workload credentialed/metadata排斥、IMDSv2 ordinal cursor；OAuth/API-key start/query/revoke/exchange的独立intent、no-intent终态、family winner、旧key与恢复；
6. remote witness从fresh bootstrap到持续append/read、quorum checkpoint、threshold rotation、equivocation、continuity recovery及运维发布条件；
7. persistent budget逐child escrow/finality cursor、有限调和deadline、悲观终结、100并发、late correction、physical/outstanding守恒和authority breach；
8. runtime inner terminal到fallback outer的穷尽映射，完整四槽solution、alternative/slot/funding/fence/rights/data不得拼接；
9. staged→restart→old process terminated→new artifact/process loaded→live descriptor/result/completion的单向屏障；
10. Execution全局external identity生命周期、start/query/close/block、hard-stop fold、本地transaction、manual result authority、read-only/zero-work与side-effect Gate；
11. response raw inventory→decoding/loss→按field映射的bundled/TUF/upstream authority extraction，unverified提取不得进入权威结果；
12. protocol/capability/discovery/execution conformance semantic subject，GA正向pass/负向fixture、两种anchor起点、组合UX计量、全部L0派生和十类mutation；
13. core detector与plugin pool容量隔离、bounded-service deficit round robin v2的service curve/debt/cohort/最大等待，以及Phase 0门是否真正可执行；
14. control/data plane编译、热路径有界性、迁移/回滚、插件隔离、可观测性、恢复与资源上限是否形成可实现而非自证布尔的闭包。

严重度：A为secret/数据/费用/副作用越权、重复执行、不可恢复、合同不可构造、核心旅程不可达或reference-grade失真；B为常见主路径、扩展性、性能、稳定性、恢复或机械门禁的实质缺口；C为非阻断建议。只有A=0且B=0才能给`PASS`。

每条发现必须有编号、严重度、精确行号、最短反例或不可达路径、现有合同为何挡不住、根因级最小修法；同根因合并。报告必须包含读取完整性和最终SHA、A/B/C计数、覆盖矩阵与唯一verdict。

仅通过`apply_patch`将最终报告写入：

`research/codex-findings/133-ai-supply-reference-architecture-final-closure-v10.md`

写完后只读报告行数、bytes和SHA-256；不得修改其他文件。
