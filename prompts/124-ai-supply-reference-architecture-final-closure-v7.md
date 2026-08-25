# SayDo AI Supply 参考架构最终闭包复核 v7

你是全新、零上下文的独立架构评审者。只评审下列唯一目标，不读取仓库里的源码、旧 prompt、旧 review、journal、计划索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 12,330 行；
- 833,246 bytes；
- SHA-256 `c0d36de218f4a6db475f000d09eb1fe5d26e57ebaab0f9224ce1bc05fb6b2b72`。

先用只读命令核对上述三项；不一致立即停止并在报告中写 `[fail] input drift`。随后完整读取 1–12,330 行，不能只用关键词抽样，也不能读取既有评审结论。允许针对该目标使用 `sed`、`rg`、`wc`、`shasum`；禁止编辑目标。

任务是对“方案是否足以作为一次做到位、可长期扩展、稳定、高性能、可供顶级开源项目借鉴的实施合同”做对抗性闭包审查。重点构造可实际复现的反例：

1. receipt实例依赖图、commit order、状态专属cursor、lease/terminal revision、writer epoch、monotonic anchor、TUF root-to-target lineage是否仍能形成摘要环、同序互引、非法状态取lease、旧状态复活或通用ref旁路；
2. local-control proposal/disclosure/decision/consumption是否确实在secret/browser/network/spawn/effect之前，且一次性消费与最终action core不可换挂；
3. 标准OAuth、OpenRouter API-key PKCE、workload identity、AWS static profile、声明式signer是否生产者分离、可达、可恢复；refresh after-send/delivery-unknown是否仍可能回ready或复用；
4. conformance staged/live、fixed/RouteSet、intent→descriptor→final lease→send intent顺序、真实prepared/wire request、typed success/report、custom/official unknown metering是否闭合；
5. runtime/fallback、persistent budget、ledger correction、metadata、local preload的ready/in-flight/terminal单后继与zero-work路径是否可线性化，费用hold与迟到usage是否守恒；
6. Execution session start及四分支recovery、session/turn/request/tool-loop、external request policy、commit lease、effect terminal、zero-work、delivery unknown是否覆盖正常和失败终态且不能重放；
7. reference-grade profile、GA core、detached owner decision、强类型journey/report/attestation/gate、distribution scope是否不可自证、不可降级、不可借失败payload或错auth报告；
8. Phase验收、fixture suite、命令、DoD是否逐项覆盖正文合同，是否存在“类型修了但schema/producer/model-based gate未落排产”的缺口；
9. 性能、故障隔离、恢复、供应链、协议/认证/provider/Execution扩展是否仍有改核心、无界资源或不可机械发布的问题。

严重度：

- A：会造成secret/数据/费用/副作用越权、重复执行、状态不可恢复、合同不可构造、核心旅程不可达或reference-grade声明不成立；
- B：会造成主流场景明显配置困难、错误提示/恢复不完整、扩展必须改核心、重要门禁不可机械判定或可维护性显著不足；
- C：不改变正确性和主路径的改进建议。

只有 A=0 且 B=0 才能给 `PASS`。不要因为文档长、术语多或“未来会实现”而放宽。每条发现必须给出：严重度与编号、精确行号、最短反例/不可达路径、为什么现有合同或门禁挡不住、最小根因级修法。相同根因合并，不用数量制造声势。

将最终报告写入：

`research/codex-findings/124-ai-supply-reference-architecture-final-closure-v7.md`

报告必须包含读取完整性与最终SHA、A/B/C计数、逐项发现、覆盖矩阵和单一 verdict。写完后用只读命令报告文件行数、bytes、SHA-256；不得修改其他文件。
