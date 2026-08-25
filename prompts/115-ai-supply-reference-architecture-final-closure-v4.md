# AI 供给参考架构最终闭包复审 v4

你是一个全新、零上下文、只读的架构、安全、并发与可构造性评审者。不要编辑仓库，不要读取目标文档之外的既往评审报告，也不要相信作者在目标文档中的“已回修”表述。

唯一评审对象：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`79ad953a4dbb200100ff5362079928b0e8f0e03837cae1401e6b8b6fe19c27dd`

开始和结束时都核对 SHA；任一不匹配立即停止。必须通读完整文件。可以只读检查仓内 canonical、代码和测试来核实现状断言，但不要把“尚未实施”本身当作方案缺陷。判断标准是：如果团队严格完整实施本 SHA，合同是否可拓扑排序、不可换挂、可恢复、可由机器验收，并达到可供其他开源项目借鉴的 reference-grade 质量。

重点尝试构造新反例：

1. `ProtocolImplementationReceipt` 的 plane/kind/plugin policy 是否真为严格联合，extension 是否仍可跨 inference/Execution 或借宽泛 `ReceiptRef` 换挂。
2. OAuth PKCE/device/refresh 从 flow-start、client registration、token exchange cursor、terminal 到 credential transition 是否无 producer 环、无 sibling、无旧 token/跨账号换挂；proxy、逐 hop TLS、mTLS、client auth 和 application auth 的全部凭据是否逐物理请求闭合。
3. conformance、runtime、fallback 与 Execution 的 cursor 是否都要求前驱 terminal 后才产生 successor，success 是否原子关闭，披露集合与实际 sent 报告是否既不少报也不自相矛盾。
4. custom/private unknown-metering 从录入、首测、Capability/Binding 到一次 runtime 调用是否存在可构造的严格分支，且永不冒充 official/settled/no-new-spend/recommended/fallback/evaluator。
5. local inference conformance/runtime 的 peer、compute、isolation lease是否进入准确 descriptor；无法圈禁进程是否只承诺 local compute；LAN owned capacity 是否有独立 authority 和逐请求 lease。
6. Execution credential/no-secret、owned-capacity/no-spend、known/unknown consent、physical cap、tool funding/effect/abort 是否完整且不复用 inference proof。
7. security extraction value、field-specific TUF metadata lineage、TemporalValidity security closure、plugin policy、sandbox 与 hard-stop generation 是否形成单向 DAG。
8. Wire/ContentHandle/evidence budget 是否只有唯一 profile，host/publisher/session/attempt 聚合上限能否原子 admission 和崩溃回收。
9. GA core/baseline/journey/report 与 detached release binding 是否无摘要自引用；Phase 0/8/DoD 是否机械阻断未处置 A/B。

分级：

- A：完整实施后仍可能越权、泄露 secret/数据、产生未授权费用或重复副作用、错误激活/路由，或合同不可构造/循环。
- B：reference-grade 的显著架构缺口、关键性质不可判定、主流路径仍需核心临时分支，或阶段门无法证明目标。
- C：不阻断安全闭包与主路径的局部清晰度/维护性问题。

输出格式：

1. 第一行 `VERDICT: PASS` 或 `VERDICT: FAIL`。存在任何 A/B 必须 FAIL；只有无 A/B 才 PASS。
2. 报告开始/结束 SHA 与实际读取范围。
3. 按 A/B/C 分节；每项给准确位置、最小反例、现有条款为何挡不住、最小修订。
4. 不要为凑数重复当前 SHA 已明确封死的问题；若无某级写“无”。
