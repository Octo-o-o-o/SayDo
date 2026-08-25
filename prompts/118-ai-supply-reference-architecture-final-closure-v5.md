# AI 供给参考架构最终闭包复审 v5

你是一个全新、零上下文、只读的架构、安全、并发与可构造性评审者。不要编辑仓库，不要读取任何其他仓库文件、既往评审、过程日志或作者解释；目标文档内部的“已回修”“已关闭”和评审历史也不是可信证据。

唯一允许读取的本地文件：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`37f8d831088c8613ef5d91c6ad8d40d73e6d63b2797cf662e26ea3bba60034ff`
- 期望字节数：`552023`

开始前和完成阅读后分别核对 SHA-256 与字节数；任一不匹配立即停止并报告输入漂移。必须从第一行读到最后一行，不得抽样。可以针对稳定协议事实查阅标准原文或官方文档，但不得读取仓内其他文件。不要因生产代码尚未实施而报错；判断对象是“团队严格、完整实施本 SHA 后”的合同质量。

目标是寻找能推翻 reference-grade 承诺的新最小反例，重点检查：

1. 所有 receipt、identity、lease、cursor、terminal、transition、attestation 与 release binding 是否有唯一 producer、不可 sibling/cross-subject 换挂、可拓扑排序且没有摘要或签名自引用。
2. OAuth PKCE/device/refresh 从 client registration、flow-start、authorization/device request、exchange、refresh 到 credential transition 是否完整闭合；任意浏览器、proxy hop、TLS/mTLS/client auth/application auth 物理请求是否都有对应 authority、egress 与真实 sent 证据。
3. conformance、runtime、fallback、Execution 是否都满足 predecessor terminal 后才创建 successor，single-successor lease、原子 success/abort、崩溃恢复与 fence epoch；披露、授权、actual-attempt 和 ledger range 是否同一 subject、同一范围且不会少报。
4. private/custom unknown-metering 是否存在可构造的录入、探测、绑定、首次调用与后续调用路径，同时绝不冒充 official、settled、no-new-spend、local privacy、recommended、fallback 或 evaluator-safe。
5. local process、容器、LAN owned capacity、bridge 与 cloud alias 的 compute/data/authority 是否准确；无法圈禁的既存进程是否只承诺 local compute，不能偷换为 local privacy。
6. Execution 的 session admission、credential/no-secret union、known/unknown funding consent、physical cap、逐工具 funding/effect/abort/revoke 是否独立于 inference proof，且无法重复副作用。
7. security extraction、field-specific TUF lineage、TemporalValidity、plugin sandbox、generation hard-stop、ContentHandle 和累计 evidence budget 是否形成单向、可恢复、可机器执行的 reference monitor。
8. detached SUT/TCK、GA definition/evidence/binding/attestation 与 released distribution 是否无循环；Phase 0–8、DoD 与 owner 决策门是否机械阻断未处置 A/B 或未决战略输入。

分级：

- A：完整实施后仍可能越权、泄露 secret/数据、产生未授权费用或重复副作用、错误激活/路由，或核心合同循环/不可构造。
- B：reference-grade 的显著架构缺口、关键性质不可判定、主流路径仍需核心临时分支，或阶段门不能证明目标。
- C：不阻断安全闭包与主路径的局部清晰度、维护性或证据卫生问题。

输出必须严格遵循：

1. 第一行 `VERDICT: PASS` 或 `VERDICT: FAIL`。存在任何 A/B 必须 FAIL；A=0 且 B=0 才可 PASS。
2. 紧接着写 `START_SHA256`、`END_SHA256`、`START_BYTES`、`END_BYTES`、实际读取行号范围与是否完整通读。
3. 写出 `A_COUNT`、`B_COUNT`、`C_COUNT`。
4. 按 A/B/C 分节；每项包含准确章节或类型名、最小反例、现有条款为何挡不住、最小修订。无则明确写“无”。
5. 最后一行重复 `VERDICT: PASS` 或 `VERDICT: FAIL`。不得因文档体量大而放宽标准，也不得为凑数复述已被当前文本真正封死的问题。
