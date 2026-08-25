# AI 供给参考架构闭包复审 v3

你是一个全新、零上下文、只读的架构、安全与可构造性评审者。不要编辑仓库，也不要读取或沿用此前评审者的推理。

唯一评审对象：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453`

开始和结束时都核对 SHA；任一不匹配立即停止。必须通读完整文件。可以只读检查仓内 canonical、代码和测试来核实现状断言，但不要把“尚未实施”本身当作方案缺陷。请判断：如果团队严格完整实施本 SHA，合同是否可拓扑排序、不可换挂、可由机器验收，并达到可供其他开源项目借鉴的 reference-grade 质量。

重点尝试构造此前最容易漏掉的反例：

1. OAuth flow authorization、PKCE/device grant、逐 token exchange lease、client/app/distribution/scopes/aud/azp、proxy/mTLS/application auth 是否有 producer 环或 secret 误投。
2. conformance hosted-tool 与 runtime hosted-tool 是否真正分流；conformance、fixed/RouteSet runtime、Execution session/turn/physical request 的 durable cursor 是否只有一个 successor，reservation/sent/commit 是否可原子线性化。
3. `ExecutionSessionAdmissionReceipt` 是否确实先于任何 spawn/connect/session-create byte，并能在尚无 session lease 时合法完成 session-start Gate 与 funding；Activation/ACL/no-secret producer 是否无环。
4. local-device 的所有 auth route 是否在每物理请求证明 current peer、config、loaded artifact/file、model-load generation、route→artifact、device、egress，且 secret read 排在 lease 后。
5. SayDo reference monitor、gateway/provider/remote Agent 的独立 enforcement authority是否有可被 self-attestation 冒充的路径。
6. Agent 真实进程树对 inherited FD/HANDLE、filesystem/mount/sync/temp/log、IPC/shared memory/helper/network 的 data-locality 与直接 syscall TCK 是否完整。
7. Base URL RFC 3986 resolution、extension protocol ID、field-specific extractor、可信时间、health probe、passive probe capability、strict parser、Wire/worker/archive exact budget 是否可实现且无矛盾。
8. TCK build 与 verifier/signing 隔离、evidence raw→projection replay、GA matrix、Phase 0 preflight 与 Phase 0–8 门是否能机械证明目标。

分级：

- A：完整实施后仍可能越权、泄露 secret/数据、产生未授权费用或重复副作用、错误激活/路由，或合同不可构造/循环。
- B：reference-grade 的显著架构缺口、关键性质不可判定、主流路径仍需核心临时分支，或阶段门无法证明目标。
- C：不阻断安全闭包与主路径的局部清晰度/维护性问题。

输出格式：

1. 第一行 `VERDICT: PASS` 或 `VERDICT: FAIL`。存在任何 A/B 必须 FAIL；只有无 A/B 才 PASS。
2. 报告开始/结束 SHA 与实际读取范围。
3. 按 A/B/C 分节；每项给准确位置、最小反例、现有条款为何挡不住、最小修订。
4. 不要为凑数重复当前 SHA 已明确封死的问题；若无某级写“无”。
