# AI 供给参考架构终审

> 日期：2026-08-23
> 审查对象：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
> 审查内容 SHA-256：`4fbb74de830b6accb470d4abd87e4c9beec3482e822634e7ad7a981944d5cf71`
> 结论：FAIL

评审前后两次真实核对均匹配期望 SHA-256。全程只读。文档链接与 emoji 门禁均为 exit 0，但不影响下列架构结论。

## A findings

### A-1 运行时 route fence 没有闭合的类型化 producer

- 复现路径：gateway 首测通过 provider A，生成绑定 `ConformanceAttemptSubject` 的 `CandidateRouteFenceReceipt`；激活 fixed binding 后 gateway 改到 provider B。日常请求是新的 runtime attempt，不能合法复用首测 attempt-bound fence；而 `EffectiveRouteReceipt`、fixed `InferenceBinding` 和 `RouteSetCoreReceipt` 都没有 runtime fence。`frozen_sequence` 分支甚至没有 token、generation 或 attestation 字段。请求仍可能先发给 B，响应后才发现费用、地域或主体漂移。
- 现有条款挡不住：数据面要求“复核 route fence”，ActivationManifest 要求外部 fencing token，但没有定义日常 dispatch fence 的生产顺序、subject、single-use 语义或闭包引用。
- 最小修订：新增 `RuntimeRouteFenceReceipt/Lease`，绑定 binding/RouteSet、operation、实际 runtime attempt、bridge config generation、effective-route 集合、hard-stop generation 和 single-use admission token；fixed、route_set、FundingPolicyTemplate、ActivationManifest、PreparedAttemptDescriptor 必须逐项引用，并补首字节前并发换路反例。

### A-2 sandbox 约束没有绑定到真正执行 Agent 的进程树

- 复现路径：用户启动真实、带 challenge 且身份完全可验证的 OpenCode ACP/HTTP 服务，但该进程仍拥有用户 HOME、工作区和任意外连权限。它可直接读取本机敏感文件或联网，在发出任何 tool event/Gate 请求前完成读取或外传。
- 现有条款挡不住：`LocalExecutionPeerReceipt` 只证明“它是谁”，不证明 ambient authority 被撤销；文档明确 `ExecutionAgentDriver` 只是 session/event adapter，而 sandbox 条款主要约束 plugin/driver。`ExecutionSurface`、execution subject和 ActivationManifest 都没有实际 Agent process-tree sandbox attestation。
- 最小修订：新增绑定真实 Agent 进程树的 `ExecutionRuntimeSandboxReceipt`，覆盖 binary artifact、spawn profile digest、mount/file handles、credential-store deny、IPC、进程树和具名 egress；纳入 execution subject、session、ActivationManifest 和每次 dispatch。既存不可重新圈禁的 peer 即使身份强也只能 inventory 或“完全信任本机代码”模式。逃逸 TCK 必须在实际 Agent 进程内执行，而不只测试 driver。

### A-3 ToolInvocation 的 Gate 与 effect-once 状态机仍可跨恢复重复执行

- 复现路径：Agent attempt `a1` 的 tool call `t1` 已完成外部副作用并记录结果，但 Agent 在接收结果前崩溃。恢复后新 attempt `a2` 重新规划同一动作并给出新 tool call ID `t2`。当前 idempotency key 包含 `attemptId/toolCallId`，因此 key 改变，host 会把它当新动作再次执行。
- 现有条款挡不住：`ToolInvocationReceipt` 没有 Gate decision、execution subject、snapshot/hard-stop generation 或可撤销 executor lease；旧 `authorized` 状态在策略撤销后的恢复路径中无法机械证明不可执行。全局又规定 receipt 不可变，但该接口把状态写成可推进字段，没有定义 append-only transition 或 CAS predecessor，两个重复事件仍可并发取得执行权。
- 最小修订：使用 host 分配且跨恢复稳定的 `logicalToolInvocationId`，建立唯一键状态行或不可变 transition chain，状态推进必须 CAS；每次 transition 引用准确 Gate decision、approval、execution subject、hard-stop generation 和 executor lease。上游不能证明 replay lineage 时不得自动恢复执行，只能人工调和。增加“恢复后 attempt/toolCallId 改变”和并发重复事件测试。

### A-4 Execution 费用闭包允许缺 component 或缺 terminal ledger 仍标 settled

- 复现路径：一个 Agent session 有上游订阅和 overage 两个 charge component。`session_authorization` 只引用第一个 component 的 reservation；`ExecutionAttemptReceipt` 仍可写 `terminal:"settled"` 和一个可选 usage digest。类型中没有 component coverage、物理 request 集合、terminal ledger refs、current-state fold 或与 funding template 的逐项相等约束。崩溃或迟到 usage 后，第二个 component 可漏记或错误释放。
- 现有条款挡不住：“原子预留并结算全部 component”是一句目标，没有 inference 侧已有的 typed coverage、派生算法、anomaly 分支和构造/verify/promote/dispatch 复验；Phase 5 也没有缺项、重复、错 account、迟到 usage 的判定性反例。
- 最小修订：新增 Execution 专用 billing coverage/match/anomaly，或复用同一 deterministic fold；覆盖每个物理模型请求、全部 component、attempt/session reservation、权威 terminal ledger 和 `charge_unknown`。只有精确闭合才能产生 `settled`，并在恢复、续 turn 和再次 dispatch 前重验。

### A-5 TCK 正式报告的签名 subject 未定义，形成可替换或自引用二选一

- 复现路径：复制一份受信通过报告及 Sigstore bundle，把 envelope 的 `environmentDigest` 从 Linux 换成 Windows。若 bundle 只签 core，替换不会失效；若签完整 envelope，则 envelope 又包含 `signatureBundleDigest` 和 `provenanceDigest`，产生 digest/signature 自引用，没有定义可构造顺序。当前接口还没有 prose 声称属于 envelope 的 `exitCode`、seed、runner invocation 和完成状态，崩溃或不完整运行也缺机械拒绝字段。
- 现有条款挡不住：钉住 issuer/repo/workflow/builder 只约束签署者，不说明其签了哪个 canonical payload，也没有证明 provenance 的 subject 正是该次 run payload。
- 最小修订：拆成不含签名引用的 canonical `ConformanceRunPayload`，以及 detached `ConformanceAttestation`；SLSA provenance subject 和 Sigstore bundle 必须共同绑定 payload digest。payload 应包含 exit code、run outcome、已完成测试/fixture 集合、seed、environment class 和 runner invocation digest。增加替换任一 envelope 字段、签错 subject、未完成运行和 bundle/provenance 互换反例。

## B findings

### B-1 自动发现的网络预算自相矛盾

自动 `static` round 被规定为“零网络”，但首次打开和 Discovery Engine 又明确要求自动读取受限 loopback metadata。严格遵守前者时无法发现 Ollama/LM Studio；遵守后者时预算 receipt 必然违反 profile。应拆成 `static_filesystem` 与 `passive_loopback_metadata` 两个明确 mode，并给出端口、method/path、请求数、字节、并发及无 secret 的固定预算。

### B-2 WireBudget 只有字节上限，不能阻止主进程结构复杂度 DoS

一个合法的 2 MiB JSON event 可包含极深嵌套、海量小字段或大量零长度事件；32 MiB request 也可带高复杂度 JSON Schema或 occurrence 集合。bundled decoder 在 daemon 主线程运行，per-plugin CPU/RSS 限制不适用；同步解析阻塞时 deadline timer 也不能运行。应增加 JSON node/depth/property/event/occurrence/schema-ref/regex 复杂度和每次 decoder work-step 上限；主线程处理必须可分片 yield，超过阈值的 bundled decoder 放入可终止 worker，并补恶意嵌套、事件洪泛和 schema complexity 基准。

### B-3 plugin 全局资源上限没有数值或计算规则

每个插件可占 256 MiB，但宿主全局上限没有 max active plugins、global RSS/CPU/process/queue bytes 或与 8 GiB 最低支持机的确定公式。应冻结全局数值、admission 顺序和公平性策略；超过总预算的新插件 fail-closed，不通过杀其他健康 connector 腾空间。

### B-4 receipt 过期与错误时钟没有统一的运行时撤销语义

Rights 被要求在 `expiresAt` 后立即 unknown，但没有定义可信时间源、墙钟回拨处理、最早到期时间如何进入 snapshot/lease，以及长流跨过 expiry 时如何触发 generation 屏障。应定义统一 temporal-validity 合同；检测时钟回拨或时间不可证明时 fail-closed，每个发送/session lease 携带所有安全收据的最早 `notAfter`，到期线性化触发 hard stop，并有重启恢复和跨 expiry 长流测试。

## C findings

### C-1 Phase 0 门禁代码块可掩盖前序失败

Phase 0 的 shell 块没有 `set -e` 或命令链；作为一个块执行时，前面的检查失败、最后 emoji 检查成功，整个块仍可返回 0。应把 Phase 0 门做成受测脚本并启用 fail-fast，或用显式命令链；证据分别记录每项 exit code。

## 结论

存在 5 项未处置 A 级缺口，不能作为参考实现级架构进入实施或正式发布。
