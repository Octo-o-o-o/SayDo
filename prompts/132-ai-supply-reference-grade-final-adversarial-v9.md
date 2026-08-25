# SayDo AI Supply 参考实现级最终对抗复核 v9

你是零上下文、只读、最严格的最终对抗评审者。唯一允许读取的仓库文件是：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

禁止读取任何源码、AGENTS、旧prompt、旧review、journal、索引或其他文件；禁止根据既有结论续写。允许的仓库命令只有针对唯一目标的`wc -l -c`、`shasum -a 256`、分段`sed -n`和target-only`rg`。不得修改文件、联网或执行方案中的未来门禁。

输入必须精确为：

- 16,355 行；
- 1,025,192 bytes；
- SHA-256 `ae6175a7195411f6878f4317ef4413f354df0763e3be6a80e7c54fc2c0c6980e`。

先核对，再完整读取1–16,355行；结束前重新核对。漂移即停止并输出`[fail] input drift`。

目标不是润色，而是判断该方案能否成为一次到位、可实施、可验证、长期可扩展且性能和稳定性达到顶级开源参考实现标准的合同。主动寻找当前文本允许的最短反例，特别是：不可构造、必填`never`或成环的receipt；错误cursor取lease/terminal；no-authority lease、send/effect intent、descriptor、conditional lease与hosted bundle顺序；首字节/effect/账务线性化；权限/凭据/网络/费用/数据/产品换挂；workload metadata与IMDSv2；OAuth access-only、device pending、refresh/API-key不确定态；fresh witness bootstrap共享预算；persistent budget correction escrow与physical/outstanding守恒；fallback inner→outer穷尽映射；staged→restart→loaded generation→live；Execution local effect、manual committed result、turn unknown和remote closed；conformance semantic subject；GA maturity/readiness/UX exact gate；publisher公平和Phase 0语义门；主流API/CLI/订阅/本地runtime用户是否仍要猜配置。

只报告由当前文本自身支持、可复现且影响正确性或可实施性的发现，不把纯未来实现bug当成计划缺陷。A为安全、费用、数据、副作用、不可恢复、合同不可构造、核心旅程不可达或reference-grade失真；B为常见旅程、扩展性、性能、稳定性、恢复或机械门禁的实质缺口；C为非阻断改进。同根因合并。只有A=0且B=0可写`PASS`。

每条发现必须含编号、严重度、精确行号、最短反例、现有合同为何不能阻断、根因级最小修法。给出A/B/C计数、覆盖矩阵和唯一结论。不得以owner未来决定、实现时再补、文档很长或多轮评审作为通过理由。

最终只输出完整Markdown报告正文，不输出过程说明。
