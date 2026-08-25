VERDICT: FAIL

已核对 SHA-256：

```text
4fbb74de830b6accb470d4abd87e4c9beec3482e822634e7ad7a981944d5cf71
```

与期望值完全一致。审查绑定上述内容摘要。

计数：A = 16，B = 8，C = 0。存在未处置 A 级缺口，不满足 PASS 条件。

## 当前事实与目标分界

当前事实核对无混淆：

- 方案自身仍标为“评审中、禁止开工”，且明确本轮不改生产代码：[方案:3](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3)。
- Kimi、OpenCode 当前确为 inventory only：`WIRED_CLI_PROVIDERS` 不包含二者，[modelbinding.ts:9](packages/contracts/src/types/modelbinding.ts:9)；两者均为 `provider:null`，[cliCapability.ts:180](packages/daemon/src/config/cliCapability.ts:180)。
- `rg -n -i 'zhipu|bigmodel|z\.ai|glm' packages/daemon packages/console packages/contracts` 返回 exit 1、无匹配，智谱尚无现行接入。
- 当前 HTTP 实现固定 `/chat/completions`、Bearer 和 Chat body，[openaiCompat.ts:109](packages/daemon/src/providers/openaiCompat.ts:109)，因此自定义 Base URL 仍只是 OpenAI Chat 子集。
- OpenCode Zen/Go/Server 分拆、BigModel/Z.AI Chat、OpenRouter BYOK、Ollama 冷态、三平台 sandbox 和 SDK/TCK 发布均是目标，不是现状：[方案:1668](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1668)、[方案:1964](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1964)、[方案:2008](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2008)、[方案:2177](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2177)。

外部事实也支持这些目标必须分开处理：OpenCode [Zen](https://opencode.ai/docs/zen/) 与 [Go](https://opencode.ai/docs/go/) 的资金、限额和端点语义不同；BigModel 与 Z.AI 分别公开普通 Chat endpoint，[BigModel 文档](https://docs.bigmodel.cn/cn/guide/develop/http/introduction)、[Z.AI 文档](https://docs.z.ai/guides/develop/http/introduction)。

## A 级 Findings

### A1 — Execution Agent 的 endpoint 类型无法表达 ACP/Agent HTTP

**位置：** [方案:198](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:198)、[方案:664](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:664)、[方案:810](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:810)。

**可复现反例：** 构造 `ExecutionSurface.kind="acp"` 时，`endpointIdentity.protocol` 不能填写 `acp`；伪填 `openai_chat` 虽能过类型，却让同 host/path 的 inference 和 ACP 身份、缓存池及 hard-stop 键错误重合。

**现有条款挡不住：** `Protocol` 只有五种 inference protocol；`surfaceId` 又未进入 `EndpointIdentity`。

**最小修订：** 拆分 `InferenceEndpointIdentity` 与 `ExecutionEndpointIdentity`；后者绑定版本化 `ExecutionWireProtocol/Profile`。增加同 host/path 上 inference、ACP、agent HTTP 不碰撞的 fixture。

### A2 — Phase 0 被 Phase 1–3 的运行时实现反向依赖

**位置：** [方案:1794](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1794)、[方案:1805](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1805)、[方案:1827](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1827)。

**可复现反例：** 在干净分支只实施 Phase 0 canonical/ADR。现有门禁可以全绿，但 fake provider 激活、运行时 deny、RouteSet verifier 和完整 receipt DAG 尚不存在；若坚持验收，Phase 0 永远不能结束，若勾选则属于伪验收。

**现有条款挡不住：** 方案同时规定 Phase 0 只冻结依赖图、包骨架 Phase 1 才创建，却在 Phase 0 要求后续行为验收。

**最小修订：** Phase 0 只保留文档投影、schema 示例及阶段映射；把运行时正反例分别移到 Phase 1/3，并让每项验收指向真实可执行门禁。

### A3 — provider/product 与 secret egress endpoint 没有独立交叉授权

**位置：** [方案:965](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:965)、[方案:975](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:975)、[方案:988](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:988)、[方案:1151](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1151)。

**可复现反例：** 合法 `catalog.tuf` target 把 OpenAI preset endpoint 改为攻击者 HTTPS 域名，同时保留 OpenAI product/resource 字段。独立 rights policy 仍判 OpenAI allowed，broker 随后为这个自洽的新 endpoint 加入 OpenAI key。

**现有条款挡不住：** TUF、TLS 和 dialer 只能证明 metadata 被授权签发且连接到了声明域；RightsReceipt 只绑定 product/surface，没有证明 endpoint 属于该产品并允许接收该 secret。

**最小修订：** 由独立政策域签发 `EndpointCredentialEgressReceipt`，绑定 endpoint/TLS/RequestProfile、provider/product/resource/region、auth primitive、principal 和 secret version；纳入首字节复核。增加“只改官方 endpoint 时零取 key、零网络字节”的负例。

### A4 — OpenRouter OAuth PKCE 缺少会话、issuer 和账号绑定合同

**位置：** [方案:223](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:223)、[方案:1674](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1674)。

**可复现反例：** 两个并发 localhost OAuth 流发生 callback/code/grantRef 混挂，或未绑定本地登录 session 的 callback 被注入；最终把另一账号返回的 OpenRouter API key 绑定给当前用户。

**现有条款挡不住：** `oauth_pkce` 只有 `grantRef + subject`，没有 issuer、authorization/token endpoint、精确 callback、state/session、S256 challenge/verifier、一次性 code、scope/audience、账号 introspection 或最终 key version。OpenRouter 的流程允许 localhost callback，并在 exchange 后返回 API key，因此这些绑定是实际安全边界，[官方 OAuth 文档](https://openrouter.ai/docs/guides/overview/auth/oauth)。

**最小修订：** 定义 `OAuthGrantReceipt`，完整绑定上述字段、发起用户和 connector；callback/state/code 单次消费，exchange 后核对账号与 key identity，并增加并发 flow、replay、callback hijack 和 issuer mix-up 负例。

### A5 — 无认证本地 inference peer 可被抢占端口冒充

**位置：** [方案:331](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:331)、[方案:895](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:895)、[方案:914](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:914)、[方案:1486](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1486)。

**可复现反例：** 恶意进程先绑定 `127.0.0.1:11434`，模拟 `/api/tags`、模型列表和 local-only metadata。`auth=none` 路径随后把真实 prompt 发给恶意进程。

**现有条款挡不住：** inference 的 `LocalComputeEvidenceReceipt` 只有 digest 字段，方案甚至允许 runtime public metadata 证明 process/artifact；没有像 Execution 路径那样要求 OS 观察的 socket owner、PID-start、binary/publisher 和 challenge。

**最小修订：** 新增 `LocalInferencePeerReceipt`，逐 dispatch 从 OS 绑定 socket owner、PID-start、binary artifact、publisher/config generation 和 challenge；无法强绑定时要求 SayDo 安全启动或只 inventory。

### A6 — 既存 Ollama 进程无法被追溯性施加“OS 零外网”

**位置：** [方案:343](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:343)、[方案:1476](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1476)、[方案:2018](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2018)、[方案:2555](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2555)。

**可复现反例：** 用户自行启动的 Ollama 已安装模型但当前卸载。SayDo 可以限制发 preload 请求的 helper，却不能把已运行 daemon 追溯放进 network namespace、AppContainer 或 App Sandbox；daemon 仍可下载或 cloud-offload。

**现有条款挡不住：** process/fence/artifact digest 只识别对象，不能赋予既存进程新网络限制。Ollama 官方说明本地 API 可以使用云模型，模型也会默认卸载，[Cloud 文档](https://docs.ollama.com/cloud)、[FAQ](https://docs.ollama.com/faq)。

**最小修订：** 区分 managed/unmanaged runtime。只有 SayDo 启动并隔离的 daemon，或上游提供可原子证明 local-only/no-download 的 admission API，才允许一键 preload；否则要求停止后安全重启，或保持 inventory。

### A7 — provider-hosted tool 没有可执行的费用、数据和副作用闭包

**位置：** [方案:599](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:599)、[方案:861](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:861)、[方案:1191](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1191)、[方案:1197](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1197)。

**可复现反例：** 在同一 `chat` request 中把 hosted web search 换成产生独立费用、联网或写 provider-hosted 文件的 code-interpreter。请求仍可命中原 `chat` funding/data receipt。

**现有条款挡不住：** `OperationBillingClosureReceipt` 只按三种粗粒度 inference operation 键控；`ToolInvocationReceipt` 属于 host/Execution tool。方案虽写“已授权”，但没有逐 hosted-tool occurrence 的授权类型、次数、effect class、处理方及费用 component 等式。

**最小修订：** 定义 `HostedToolAuthorizationReceipt`，绑定 occurrence、tool/profile/version、effect/data destination、调用上限、全部 biller component 和 hard-stop generation；不能逐次 Gate 且有副作用的 hosted tool 一律发送前拒绝。

### A8 — 响应侧 semantic-loss 证明未进入激活闭包

**位置：** [方案:618](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:618)、[方案:1119](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1119)、[方案:1222](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1222)、[方案:1071](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1071)。

**可复现反例：** 一个已知 event 同时携带 text 与 reasoning signature；decoder 保留 text、丢 signature，再正常发 terminal。因为 event type 已知，unknown-event fatal 不触发，Capability/Activation 仍可构造。

**现有条款挡不住：** `WireEventDecoder` 直接返回 IR，没有独立 raw occurrence 集合；`ConformanceResultReceipt` 和 `ActivationManifest` 都不引用 `DecodingPlan/ResponseLossReceipt`。

**最小修订：** 对响应 event/field 建立无漏、无重、互斥的 occurrence partition；ConformanceResult、Capability、Activation 和 runtime terminal 必须引用对应 DecodingPlan/LossReceipt。

### A9 — 第三方 decoder 可自报 model、route、usage 等安全权威事实

**位置：** [方案:1111](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1111)、[方案:1156](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1156)、[方案:1197](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1197)、[方案:2388](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2388)。

**可复现反例：** 一个签名插件对固定 TCK fixture 如实解析，对 live 响应则把昂贵模型 B、百万 token、route B 映射成模型 A、少量 usage、route A，并输出内部一致的事件。

**现有条款挡不住：** sandbox 只限制 ambient authority；artifact/raw digest 只证明“这些字节被该插件处理”，不能证明语义真实。固定 fixture TCK 也无法证明不存在条件式造假。

**最小修订：** model、effective route/member、usage/billing、data boundary 和 terminal side-effect 必须由 bundled verifier、受限声明式 extractor 或上游可验证 attestation独立产生；不能独立验证时标 `unknown/charge_unknown`，禁止激活及自动 fallback。

### A10 — Execution funding 的 operation/session 基数与 schema 冲突

**位置：** [方案:700](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:700)、[方案:723](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:723)、[方案:827](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:827)、[方案:873](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:873)。

**可复现反例：** 同一 agent 有 `session_start` 和 `command` 两个 operation，它们的 `executionSubjectDigest` 不同，需要不同 funding template；但 `ExecutionAgentConnection` 只有单一 `fundingTemplate`。另可把 S1 的 `explicitSessionConsent` ref 重放给 S2。

**现有条款挡不住：** 文字要求 per-surface/per-operation/per-session，但 schema 没有 operation→template 集合，也没有绑定 session 的 consent receipt。

**最小修订：** 改为无重复 operation→template 集合；定义绑定 `sessionId`、subject、template、generation、expiry、revocation、wall-time/turn cap 的 consent receipt，并增加跨 operation/session 重放负例。

### A11 — 空 `processingRegions` 可绕过地域硬约束

**位置：** [方案:455](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:455)、[方案:489](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:489)、[方案:1049](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1049)、[方案:1813](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1813)。

**可复现反例：** candidate/runtime 均填写 `processingRegions: []`。常见的 `regions.every(isAllowedCN)` 对空数组为真；它又不是显式 `unknown/global`，可错误满足“中国大陆内处理”。

**现有条款挡不住：** 只要求排序、去重和拒绝 `unknown/global` 冒充，没有规定数组非空或缺失必须规范化成 `unknown`。

**最小修订：** 使用 non-empty tuple；无可靠地区时强制唯一 `{scheme:"unknown"}`，地域谓词先拒绝空集，并加入 vacuous-subset fixture。

### A12 — Sigstore bundle digest 形成签名自引用

**位置：** [方案:1324](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1324)、[方案:1335](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1335)、[方案:1352](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1352)。

**可复现反例：** 若 bundle `S` 签署 envelope `R`，而 `R.signatureBundleDigest=H(S)`，生成 R 需要 S，生成 S 又需要 R。若签名排除该字段，又可换挂 bundle digest。

**现有条款挡不住：** issuer/workflow/builder pinning 不解决被签对象自身的 producer 环。

**最小修订：** 定义不含 bundle digest 的 `ConformanceStatement` 作为 DSSE/Sigstore payload；bundle 为 detached artifact；外层 release manifest 分别绑定 statement 和 bundle digest。

### A13 — TCK 报告未绑定实际发货的 runtime/sandbox host

**位置：** [方案:1311](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1311)、[方案:1324](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1324)、[方案:2058](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2058)、[方案:2201](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2201)。

**可复现反例：** TCK fake host 正确拒绝 `open/connect/exec`，而发布版 runtime 因构建或配置错误启动普通同 UID child；三平台测试仍能产生绿报告。

**现有条款挡不住：** core/envelope 绑定 SDK、TCK、connector、fixture、runner 和 environment，但没有精确绑定被测生产 runtime、sandbox helper/policy 和最终发货二进制。

**最小修订：** 报告加入 `sutRuntimeArtifactDigest`、sandbox helper/policy digest、平台 profile、真实 invocation/exit/raw evidence；TCK 从最终 tarball/binary 黑盒入口启动。换成 unsandboxed host 的 mutation 必须红。

### A14 — 自动 discovery 的“零网络”与 loopback HTTP 探测互相冲突

**位置：** [方案:1124](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1124)、[方案:1283](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1283)、[方案:1410](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1410)、[方案:1474](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1474)。

**可复现反例：** 自动请求已知 loopback `/api/tags` 或 `/v1/models`，违反 `static round` 的“零网络”；严格零网络则不能自动识别正在运行的 Ollama/LM Studio，L0 零配置承诺需要隐藏手工动作。

**现有条款挡不住：** 三处对 `static`、自动 loopback metadata 和 `explicit_active` 的边界定义不一致。

**最小修订：** 增加独立 `automatic_loopback_metadata` profile，冻结精确 endpoint/method/path、请求数、字节和副作用假设；`static` 保持零 packet，生成/preload/子进程仍归 `explicit_active`。

### A15 — hard-stop 缺少正在执行工具的最终 commit fence

**位置：** [方案:861](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:861)、[方案:913](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:913)、[方案:1063](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1063)、[方案:1272](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1272)。

**可复现反例：** 文件工具已进入 `executing` 并完成 temp+fsync；此时 hard-stop 加代，随后旧工具执行 atomic rename。副作用发生在撤销屏障之后。

**现有条款挡不住：** `ToolInvocationReceipt` 不绑定 execution subject、hard-stop generation 或 lease；abort 清单明确提到待执行 gate，却没有“不可逆 commit 前必须 CAS 当前 generation”的合同。

**最小修订：** receipt/idempotency key 绑定 subject、generation、Gate 和 lease；所有正在执行工具登记为 in-flight handle；rename/prepare-commit/外部 commit 紧前做线性化 generation CAS，失败转 `executing_unknown` 并禁止提交。

### A16 — binary digest 检查到 spawn 之间存在 TOCTOU

**位置：** [方案:810](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:810)、[方案:1058](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1058)、[方案:1411](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1411)、[方案:2416](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2416)。

**可复现反例：** SayDo 校验 path/version/digest 后，攻击者在 spawn 前替换同一路径二进制；实际启动的程序不是已验证 artifact。

**现有条款挡不住：** `ExecutionSurface.binaryIdentity` 只有 `pathDigest/version/publisher`，也未要求从已打开、no-follow 的同一对象执行；“digest 变化 hard-stop”依赖事后重新检测。

**最小修订：** 绑定 content digest、file identity 和 publisher；通过 no-follow handle 验证并执行同一对象，平台不支持时复制到 SayDo 控制的不可变 staging 后再启动，并核对 spawned image identity。

## B 级 Findings

### B1 — 首次 API 接入存在 rights-principal/key 输入死锁

**位置：** [方案:988](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:988)、[方案:1593](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1593)、[方案:2118](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2118)。

**反例：** 新 BigModel/Z.AI/Zen 用户没有已存 key；RightsReceipt 要绑定 credential principal，但 rights 未通过时 UI 又禁止展示 secret 输入。

**为什么挡不住：** 没有 product-level eligibility 与 credential-principal rights 两阶段合同。

**最小修订：** 先用 `ProductEligibilityReceipt` 决定能否展示并本地保存 secret，取得 credential 后再生成 principal-bound RightsReceipt。

### B2 — OpenRouter BYOK 未绑定 model/API-key/user 过滤条件

**位置：** [方案:1022](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1022)、[方案:1674](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1674)、[方案:1964](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1964)。

**反例：** 管理员改变 `allowed_models`、`allowed_api_key_hashes` 或 `allowed_user_ids`，导致 Key A 被跳过、转 Key B/shared capacity；计划列出的 key order/account/shared fallback 仍未变。

**为什么挡不住：** “配置 revision”没有定义覆盖哪些过滤器，也没有绑定本次调用的 gateway API key hash、user/member 和 model。OpenRouter BYOK 确实提供这些过滤条件，[官方 BYOK 文档](https://openrouter.ai/docs/guides/overview/auth/byok)。

**最小修订：** route/candidate digest 绑定调用 key hash、workspace/member/user、model、全部过滤器及 null/omission 语义；逐字段 mutation 都必须使 fence 失效。

### B3 — 自动 fallback 未进入不可变 snapshot

**位置：** [方案:1065](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1065)、[方案:1239](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1239)、[方案:1265](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1265)、[方案:1552](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1552)。

**反例：** A timeout 后需要回落 B。调用推荐器重新求解会把 control plane 带入热路径；直接使用 B 又没有当前 invocation 的预编译 closure。

**为什么挡不住：** SnapshotCore 没有有限 fallback graph/receipt，和“只消费 snapshot”要求不闭合。

**最小修订：** 把完整排序、费用和数据均已授权的 `FallbackPlanReceipt` 编译进 snapshot；集合外故障只终止当前请求，异步为下一请求编译。

### B4 — 最大合法 RouteSet 未被性能门强制覆盖

**位置：** [方案:904](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:904)、[方案:911](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:911)、[方案:2300](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2300)、[方案:2313](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2313)。

**反例：** 16 members、64 sequences、1024 nodes、1 MiB JSON 的合法 RouteSet 每次 dispatch 重解 typed refs/fold，在单成员 benchmark 达标而最大图持续超过 10 ms。

**为什么挡不住：** 有界不等于满足 SLO；`BenchmarkWorkload v1` 没有被明确要求包含最大合法 profile。

**最小修订：** snapshot 编译 immutable fold/proof program；release benchmark 强制覆盖最大 RouteSet 和 generation churn。

### B5 — plugin/decoder DoS 缺 host-side 解析复杂度与事件速率预算

**位置：** [方案:1166](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1166)、[方案:1284](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1284)、[方案:1285](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1285)。

**反例：** 插件持续发送每帧小于 1 MiB、但包含大量微小 event 或极深合法 JSON 的 frame；plugin 自身 CPU/RSS 和 queue 均合规，daemon 的 JSON/zod/object allocation 却占满 event loop。

**为什么挡不住：** 当前只限制 bytes、plugin CPU/RSS、queue，没有 depth/nodes、events-per-stream、rate 或 host validation CPU。

**最小修订：** 冻结最大 JSON depth/nodes/fields、累计 event 数与速率、host validation CPU slice，以及 per-plugin/global 聚合预算。

### B6 — 安全 feature flag 关闭未明确撤销在途 session

**位置：** [方案:1063](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1063)、[方案:2406](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2406)、[方案:2410](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2410)。

**反例：** 发现 macOS sandbox 漏洞后关闭 `code_plugin_os_sandbox_macos`，长生命周期 plugin/Agent session 仍按“只停止新调用”继续运行。

**为什么挡不住：** flag 变化没有被明确映射为 hard-stop generation 增加和全量 abort。

**最小修订：** 区分 `drain_disable` 与 `revoke_disable`；sandbox/protocol/security flag 默认走后者，并增加 mid-stream flag-off fixture。

### B7 — “两次 SayDo 点击”仍允许无限外部任务

**位置：** [方案:2296](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2296)、[方案:2311](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2311)、[方案:2193](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2193)。

**反例：** OpenCode Go 流程在 SayDo 内只有两次点击，但中间需要注册、MFA、创建 key、配置 fallback、复制粘贴和多次重试，仍能通过当前 GA 文案。

**为什么挡不住：** 只要求记录外部任务，没有外部任务、离开/返回、手填字段、错误恢复或墙钟上限。

**最小修订：** 为每个 L0 旅程设置这些维度的 GA 硬上限；超限不得使用“一键/零配置”，必须降为 `action_required` 或 beta。

### B8 — 缺失 observed model 的合同互相矛盾

**位置：** [方案:382](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:382)、[方案:535](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:535)、[方案:1906](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1906)、[方案:1912](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1912)。

**反例：** 兼容服务不返回 `model`。类型要求 `observedModel: string`，1906 又要求缺失时 fail-closed；1912 同时要求不能因此一刀切普通兼容服务。

**为什么挡不住：** 没有可判别的“未观察到”证据形态，实施只能伪填 requested model，或拒绝全部此类服务。

**最小修订：** 定义 `ObservedModelEvidence = present | absent`；`absent` 只能生成受限 `unverified` 普通对话能力，禁止 evaluator、自动迁移和静默 fallback。

## C 级 Findings

C = 0。没有单独列出仅属文案风格或“未来尚未完成”的事项。

本轮未修改任何文件。两路独立评审均以零上下文启动并完成；为满足仓库制度额外尝试的独立 `codex exec` 在生成审查内容前因只读环境无法初始化本地状态库而 exit 1，其输出未被当作证据。该失败不影响本次 FAIL：以上任一 A 项都已能由固定 SHA 的方案原文独立复现。