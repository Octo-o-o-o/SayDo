# SayDo AI Supply 参考架构最终闭包复核 v6

你是全新、零上下文的独立架构评审者。只评审下列唯一目标，不读取仓库里的源码、旧prompt、旧review、journal、计划索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 8,219 行；
- 638,999 bytes；
- SHA-256 `fc4454fc6ac05c545d90b0780a5298a16f0a021c5e972da1f4df3de460da4c0e`。

先用只读命令核对上述三项；不一致立即停止并在报告中写 `[fail] input drift`。随后完整读取 1–8,219 行，不能只用关键词抽样，也不能读取既有评审结论。允许针对该目标使用 `sed`、`rg`、`wc`、`shasum`；禁止编辑目标。

任务是对“方案是否足以作为一次做到位、可长期扩展、稳定、高性能、可供顶级开源项目借鉴的实施合同”做对抗性闭包审查。重点构造可实际复现的反例：

1. receipt 实例依赖图、commit order、cursor revision、writer epoch、monotonic anchor、TUF root-to-target lineage是否仍能形成摘要环、同序互引、旧状态复活或通用ref旁路；
2. local control proposal/disclosure/decision是否确实在secret/browser/network/spawn/effect之前，并能抵御DNS rebinding、CWSH、同UID旁路、callback劫持；
3. 标准OAuth、OpenRouter API-key PKCE、workload identity、AWS static profile、声明式signer是否生产者分离、可达、可恢复且无凭据换挂；
4. conformance staged/live、fixed/RouteSet、真实prepared/wire request、actual report、custom/official unknown metering是否闭合；
5. runtime intent、compute/no-new-spend、persistent budget、sent/terminal/late usage、fallback inner/outer顺序是否可线性化；
6. metadata与passive loopback是否无TOCTOU，并有credential/funding/send/terminal链；
7. Execution session/turn/request/tool-loop、external request policy、commit lease、effect terminal、delivery unknown是否可表达所有正常与失败终态；
8. reference-grade profile、GA core、detached owner decision、强类型journey、distribution scope与report kind是否不可自证、不可降级、不可借报告；
9. Phase验收、fixture suite、命令、DoD是否真的覆盖正文新合同，是否存在“正文修了但实施无门”的落差；
10. 性能、故障隔离、恢复、供应链、可扩展协议/认证插件边界是否有根本性缺口。

严重度：

- A：会造成secret/数据/费用/副作用越权、重复执行、状态不可恢复、合同不可构造、核心旅程不可达或reference-grade声明不成立；
- B：会造成主流场景明显配置困难、错误提示/恢复不完整、扩展必须改核心、重要门禁不可机械判定或可维护性显著不足；
- C：不改变正确性和主路径的改进建议。

只有 A=0 且 B=0 才能给 `PASS`。不要因为文档长、术语多或“未来会实现”而放宽。每条发现必须给出：严重度与编号、精确行号、最短反例/不可达路径、为什么现有合同或门禁挡不住、最小根因级修法。相同根因合并，不用数量制造声势。

将最终报告写入：

`research/codex-findings/121-ai-supply-reference-architecture-final-closure-v6.md`

报告必须包含读取完整性与最终SHA、A/B/C计数、逐项发现、覆盖矩阵和单一 verdict。写完后用只读命令报告文件行数、bytes、SHA-256；不得修改其他文件。
