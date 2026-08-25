# SayDo AI Supply 参考架构最终闭包复核 v8

你是全新、零上下文的独立架构评审者。只评审下列唯一目标，不读取仓库里的源码、AGENTS、旧 prompt、旧 review、journal、计划索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 14,502 行；
- 945,084 bytes；
- SHA-256 `5ae8c540fe32e67cc6bae3788f22b90126223e3914dce5f236d273d0f2e51d65`。

先用只读命令核对上述三项；不一致立即停止并在报告中写`[fail] input drift`。随后完整读取1–14,502行，不能只用关键词抽样，也不能读取既有评审结论。允许针对该目标使用`sed`、`rg`、`wc`、`shasum`；禁止编辑目标。

任务是对“方案是否足以作为一次做到位、可长期扩展、稳定、高性能、可供顶级开源项目借鉴的实施合同”做对抗性闭包审查。重点构造当前文本允许的最短反例：

1. receipt实例依赖图、commit order、状态专属cursor、lease/terminal revision、writer epoch、monotonic anchor、TUF lineage是否仍能成环、分叉、从错误状态取lease、让旧状态复活或用通用ref旁路；
2. TypeScript判别联合是否真实可构造，是否把多个literal合在一个分支后又用`Extract`产生必填`never`，或靠布尔proof拼接不相容的predecessor/terminal；
3. local-control proposal/disclosure/decision/consumption是否确实先于secret/browser/network/spawn/effect，且一次性消费与最终action不可换挂；
4. 标准OAuth、API-key PKCE family winner/rotation/recovery/old-key retirement、workload metadata exact-empty、AWS static profile与声明式signer是否生产者分离、可达、可恢复；
5. conformance staged/live、fixed/RouteSet、intent→descriptor→conditional lease→hosted authorization bundle→send intent顺序、typed success/report、custom/official unknown metering是否闭合；
6. runtime/fallback、100个同policy child reservation、独立settlement、late correction、metadata、local preload的单后继与zero-work路径是否可线性化且费用守恒；
7. Execution session-start反复recovery、turn delivery-unknown reconciliation、request/tool-loop、read-only result、side-effect finality、zero-work和六类final transition是否都有相容终态且不能重放；
8. strong anchor fresh-boot witness bootstrap是否能在没有持久anchor时合法产生，又不能开放一般网络、secret或付费能力；
9. `ReferenceGradeProfileV2`、GA user/pseudo run笛卡尔积、typed UX metrics、run→journey→entry→ecosystem gate和distribution binding是否不可自证、不可降级、不可借单run/错auth/旧binary；
10. Phase验收、fixture suite、真实命令和DoD是否逐项覆盖正文合同；性能、隔离、恢复、供应链和扩展是否仍有无界资源或必须修改核心的问题。

严重度：

- A：会造成secret/数据/费用/副作用越权、重复执行、状态不可恢复、合同不可构造、核心旅程不可达或reference-grade声明不成立；
- B：会造成主流场景明显配置困难、错误提示/恢复不完整、扩展必须改核心、重要门禁不可机械判定或可维护性显著不足；
- C：不改变正确性和主路径的改进建议。

只有A=0且B=0才能给`PASS`。不要因为文档长、术语多或“未来会实现”而放宽。每条发现必须给出严重度与编号、精确行号、最短反例或不可达路径、为什么现有合同/门禁挡不住、最小根因级修法；相同根因合并。

将最终报告写入：

`research/codex-findings/127-ai-supply-reference-architecture-final-closure-v8.md`

报告必须包含读取完整性与最终SHA、A/B/C计数、逐项发现、覆盖矩阵和单一verdict。写完后只读报告文件行数、bytes、SHA-256；不得修改其他文件。
