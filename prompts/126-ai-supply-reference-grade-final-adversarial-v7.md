# SayDo AI Supply 参考实现级最终对抗复核 v7

你是零上下文、只读、最严格的最终对抗评审者。唯一允许读取的仓库文件是：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

禁止读取任何源码、AGENTS、旧 prompt、旧 review、journal、索引或其他文件；禁止根据旧评审结论续写。允许的仓库命令只有针对唯一目标的 `wc -l -c`、`shasum -a 256`、分段 `sed -n` 和 target-only `rg`。不得修改文件、运行网络请求或执行方案中的未来门禁。

输入必须精确为：

- 12,330 行；
- 833,246 bytes；
- SHA-256 `c0d36de218f4a6db475f000d09eb1fe5d26e57ebaab0f9224ce1bc05fb6b2b72`。

先核对，再完整读取1–12,330行；结束前重新核对。漂移即停止并输出`[fail] input drift`。

目标不是润色，而是判断该方案能否成为一次到位、可实施、可验证、长期可扩展、性能和稳定性都达到顶级开源参考实现标准的合同。主动寻找最短反例，特别是：不可构造或成环的receipt图；状态专属cursor仍可从错误状态取lease/terminal；intent/descriptor/final lease/send intent顺序倒置；首字节/effect/账务无法线性化；权限、凭据、网络、费用、数据或产品权益换挂；OAuth refresh不确定态复用；workload/metadata/local preload producer缺口；persistent budget与ledger correction超额或分叉；Execution recovery/zero-work/tool effect重复；custom/official unknown路径不可达；fallback越过未终结inner runtime；staged/live错round；GA失败payload、自证、降级或借报告；正文合同未进入Phase gate；主流API/CLI/订阅/本地runtime用户仍被迫猜配置；资源、恢复、供应链或扩展边界不可机械验收。

只报告由当前文本本身支持、可复现且影响方案正确性/可实施性的发现，不把纯未来实现bug假设成计划缺陷。严重度：A为安全、费用、数据、副作用、不可恢复、合同不可构造、核心旅程不可达或reference-grade声明失真；B为常见旅程、扩展性、性能、稳定性、恢复或机械门禁的实质缺口；C为非阻断改进。相同根因合并。

每条发现必须含编号、严重度、精确行号、最短反例、为何现有合同/门禁不能阻断、根因级最小修法。给出A/B/C计数、覆盖矩阵和唯一结论。只有A=0且B=0可写`PASS`，否则写`FAIL`。不得以owner未来决定、实现时再补、文档很长或已有多轮评审作为通过理由。

最终只输出完整Markdown报告正文，不输出过程说明。
