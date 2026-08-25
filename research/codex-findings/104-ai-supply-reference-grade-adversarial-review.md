# 评审结论：FAIL

输入校验通过：

```text
$ shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
7fb98df5defe9f96dcc917067f645e4e7c1cac0148691c0e9f0633a5f964884c
```

与期望值完全一致。全程只读；§17.4 的历史 PASS 未作为证据。

共发现：A 级 10 项、B 级 7 项、C 级 1 项。存在未处置 A 级，因此不能 PASS。

## 当前支持现状核对

方案对当前实现的主要判断基本属实：

- 当前只有 7 个 wired CLI；Kimi、OpenCode 明确是 inventory，不能写入模型槽。[modelbinding.ts:9](packages/contracts/src/types/modelbinding.ts:9)、[cliCapability.ts:180](packages/daemon/src/config/cliCapability.ts:180)、[cliCapability.ts:191](packages/daemon/src/config/cliCapability.ts:191)
- 对 `packages/console packages/daemon packages/contracts` 全量检索，没有智谱、BigModel 或 GLM preset。
- 当前 HTTP adapter 固定 `POST /chat/completions`、Bearer 认证及 Chat 形状；没有 Responses 或 Anthropic Messages IR。[openaiCompat.ts:75](packages/daemon/src/providers/openaiCompat.ts:75)、[openaiCompat.ts:113](packages/daemon/src/providers/openaiCompat.ts:113)、[types.ts:10](packages/daemon/src/providers/types.ts:10)
- 未知自定义端点仍共用 `OPENROUTER_API_KEY` 槽；UI 的“任意兼容 OpenAI 协议”文案超出真实能力。[setupApi.ts:1334](packages/console/src/lib/setupApi.ts:1334)、[SupplyPicker.tsx:272](packages/console/src/components/SupplyPicker.tsx:272)
- Kimi 会员 API 的 OpenAI/Anthropic 双入口是有官方依据的未来路径，[Kimi Membership Guide](https://www.kimi.com/en/help/kimi-code/membership-guide)；OpenCode Server 的 `127.0.0.1:4096` 和 OpenAPI 也是真实官方 surface，[OpenCode Server](https://dev.opencode.ai/docs/server/)。但二者都不是当前 SayDo 已支持能力。

## A 级发现

1. **A — Execution Agent 的付费闭环没有类型化实现**

   定位：[方案:634](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:634)、[方案:903](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:903)、[方案:906](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:906)、[方案:1809](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1809)。

   反例：OpenCode 或 Kimi Execution Agent 持有用户的上游 API/Extra Usage 权限，`session_start` 后内部产生付费模型请求。Execution policy 虽有一个无类型 `billing: ReceiptRef`，但 FundingPolicyTemplate、RuntimeSpendAuthorization、operation closure 和 ledger 全部只按 `InferenceBinding/RouteSet/InferenceOperation` 定义，没有 Execution session/turn/provider request 的预留、结算或 `charge_unknown` 身份。

   挡不住：Phase 5 只要求“有 Billing policy 和提示”；Gate 只能控制工具副作用，不能限制 Agent 内部模型费用。

   最小修订：新增 Execution 专用 funding template、spend decision、attempt/usage/terminal receipt；无法取得逐次 usage 或硬 cap 的 surface 必须标成 `externally_metered_unknown`，禁止进入 no-new-spend、自动推荐和自动 fallback，并要求逐 session 明示授权。

2. **A — hard stop 只阻断新 lease，不能停止已发送请求**

   定位：[方案:927](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:927)、[方案:943](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:943)、[方案:1100](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1100)。

   反例：长流或 Agent session 已写出首字节后，rights/emergency deny/secret revoke 生效。generation 只阻断新 lease，而旧请求明确持有旧 snapshot 到 terminal，仍可继续输出、计费，甚至发起后续工具动作。

   挡不住：首字节前复核只关闭 check-to-send 窗口，不处理首字节后的撤销线性化。

   最小修订：定义 in-flight registry 和撤销屏障；hard stop 必须原子加代、禁止新 lease、取消全部相关 socket/process/session，并在屏障之后禁止输出交付和工具 Gate consume。补齐 revoke 与发送、首事件、工具动作、terminal 各竞态点的测试。

3. **A — 工具副作用没有 exactly-once 身份与恢复协议**

   定位：[方案:1049](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1049)、[方案:1097](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1097)、[方案:1229](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1229)、[方案:1665](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1665)。

   反例：上游重复发送同一 `tool_call.end`，或 host 在文件写入成功后、落 tool result 前崩溃。恢复后同一写入/命令会再次执行。

   挡不住：“逐次过 gate”“重复事件有唯一 terminal”都没有规定稳定 invocation key、冲突重复处理及副作用后的恢复状态；当前 `GateWireRequest` 也没有工具调用身份。

   最小修订：增加持久 `ToolInvocationReceipt`，至少绑定 logical call、attempt、tool call ID、tool/args/resource digest，状态为 `authorized → executing → executed → result_recorded`；同 digest 重放返回首次结果，冲突 digest hard stop。故障注入必须覆盖副作用前后每个落盘点。

4. **A — “仅两次事务”与逐工具持久 Gate 自相矛盾**

   定位：[方案:1094](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1094)、[方案:1097](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1097)、[方案:1102](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1102)。

   反例：Agent 一次 session 连续提出十个、参数事先未知的文件/命令动作。若每项在副作用前持久消费 Gate，就需要十次额外事务；若只做初始 admission 和 terminal 两次事务，则动态路径、参数和批准收据不能在动作前持久化，崩溃后也无法对账。

   挡不住：初始事务不可能包含尚未出现的工具参数；异步 terminal 审计又晚于副作用。

   最小修订：把“两次事务”限定为纯 inference 请求，并明确 Execution 每个工具动作允许一次有界 Gate transaction；为它单列延迟、busy/fail-closed、恢复和吞吐 SLO。

5. **A — loopback Execution Agent 没有可证明的对端身份**

   定位：[方案:743](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:743)、[方案:770](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:770)、[方案:1222](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1222)、[方案:1796](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1796)。

   反例：恶意同 UID 进程先占 `127.0.0.1:4096`，伪造 OpenAPI、health 和事件形状。`agent_http/acp` 只绑定 EndpointIdentity，且 `auth=none` 对 loopback 合法。OpenCode 官方文档也表明 Basic auth 只有配置密码环境变量时才启用，[OpenCode Server](https://dev.opencode.ai/docs/server/)。

   挡不住：端口、协议 signature、OpenAPI 和 loopback 都是可伪造的服务特征，不是进程身份；验证后换进程同样未被 fencing。

   最小修订：增加 `LocalExecutionPeerReceipt`，绑定 socket owner、PID start identity、二进制 artifact/publisher、配置 generation 和 host 挑战 token；每次 dispatch 复核。无法认证的既存 HTTP/ACP 服务只能 inventory，或由 SayDo 启动并注入一次性凭据。

6. **A — Billing/DataBoundary 的独立信任域没有根或授权链**

   定位：[方案:836](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:836)、[方案:837](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:837)、[方案:1011](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1011)、[方案:1694](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1694)。

   反例：catalog signer 被攻破后把计费或数据边界证据链接换成攻击者内容。若 Billing/DataBoundary 直接消费 catalog 权威，会错误降低预留或虚构地域；若不消费，则方案没有给它们任何可验证 producer。

   挡不住：方案声明四个独立签名/审核域，却只定义 `catalog.tuf`、`policy.tuf` 两个根，且 policy targets 明确只含 rights/emergency deny。没有 Billing/DataBoundary 的 delegated role、key、threshold 或本地审核签名协议。

   最小修订：在 policy TUF 下定义非重叠 delegated roles，或建立四个明确根；receipt 必须记录 role、metadata version、threshold 和证据 digest，并增加跨域换挂、旧 metadata 和混合 snapshot 反例。[TUF specification](https://theupdateframework.github.io/specification/latest/)

7. **A — Plugin Host 是可重放的 transport/auth confused deputy**

   定位：[方案:997](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:997)、[方案:1007](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1007)、[方案:1019](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1019)。

   反例：第三方 plugin 对同一个 `EndpointHandle` 调两次 `requestTransport`，跨 attempt 重放，或要求 `requestAuth` 为未获 admission 的 method/path/body 签名；Execution plugin 还可请求配置、auth 或管理类 endpoint。

   挡不住：opaque handle 防止读取 secret，却不限制 host 代插件发送什么、发送几次；接口没有 snapshot、attempt、lease、reservation、method/path/body digest 和 single-use 状态。

   最小修订：插件只能返回纯 `WireRequestPlan`；host 验证后生成一次性 `PreparedAttemptHandle`，将其绑定完整 admission/route/body/auth digest，并由 host 内部执行 auth。TCK 加入重复发送、跨 handle、保留 header、管理路径和授权后改 body 的拒绝测试。

8. **A — Sigstore/SLSA 闭包没有可信发布者和构建者策略**

   定位：[方案:1137](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1137)、[方案:1928](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1928)、[方案:1939](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1939)。

   反例：攻击者 fork 仓库，构建一组内部 digest 完全闭合的恶意二进制、SBOM、provenance、registry 和 TCK report，并取得合法 keyless Sigstore bundle。当前离线 verifier 可验证“它们彼此一致”，却无法判断是不是 SayDo 的受信 workflow。

   挡不住：方案没有固定 certificate identity、OIDC issuer、repo/workflow/ref、builder、source/material policy、Rekor checkpoint 或可信根轮换。Sigstore 官方 keyless 验证要求同时约束 certificate identity 与 issuer；OpenSSF Scorecard 的 Signed-Releases 检查也不负责验证签名真实性。[Sigstore verification](https://docs.sigstore.dev/cosign/verifying/verify/)、[OpenSSF Scorecard check definition](https://github.com/ossf/scorecard/blob/main/docs/checks/internal/checks.yaml)、[SLSA artifact verification](https://slsa.dev/spec/v1.2/verifying-artifacts)

   最小修订：落版本化 verifier policy，固定 issuer、repository、workflow path、tag/ref/environment、builder ID、source/material predicates、Rekor inclusion/checkpoint 和离线 trust root；增加 fork、未授权 workflow、错误 ref 和旧 checkpoint 反例。

9. **A — Phase DAG 存在两个明确反向依赖**

   定位：[方案:1545](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1545)、[方案:1589](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1589)、[方案:1604](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1604)、[方案:1666](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1666)、[方案:1697](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1697)。

   反例一：Phase 0 被定义为 canonical/ADR，但门禁要求真实 billing contract tests；合同代码却到 Phase 1 才“落”。反例二：Phase 2 要求两个 operation-specific policy/费用 attempt 完整通过，Rights/Billing/Spend producer 却到 Phase 3 才实现。

   挡不住：“未来命令可以尚不存在”不解决阶段没有生产这些命令所依赖实现的问题；严格按序施工无法使阶段门变绿。

   最小修订：明确 Phase 0 是否包含 contract schema 和红绿测试；若不包含，将两个 contract test 移至 Phase 1。把最小 policy/billing/admission/ledger 垂直切片前移至 Phase 2，或将相关验收移至 Phase 3，并给出显式产物依赖图。

10. **A — 跨平台性能与 GA 门无法机械判断**

   定位：[方案:1937](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1937)、[方案:2045](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2045)、[方案:2088](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2088)。

   反例：开发者在高配 Apple Silicon 上跑一次 Phase 8 命令并通过；正式支持的 Windows/x64 最低档实际超过 50 ms/256 MiB。报告硬件信息并不能决定哪台机器具有门禁权，所谓“上一 GA 基线”也可以选择不同硬件。

   挡不住：方案要求每个 OS/架构，但没有固定 runner label/image、最低硬件 SKU、功耗模式、预热/异常值规则、重复 seed 或跨平台聚合命令；Phase 8 只有单机命令。

   最小修订：Phase 0 固化支持矩阵和基准机类别；release workflow 必须展开 OS/arch matrix、固定镜像和统计规则，汇总任务缺一即失败。CI smoke、release benchmark、24 小时 soak 分开定义。

## B 级发现

1. **B — AdaptationPlan 只覆盖请求侧，响应侧仍可丢语义**

   定位：[方案:1049](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1049)、[方案:1051](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1051)。

   反例：provider 新增 citation、reasoning signature patch、tool mutation 或 usage correction 事件，profile 选择 `ignore`，最终结果仍被视为成功。现条款只把未知事件存为 opaque evidence，没有 response-side loss receipt。最小修订：增加 `DecodingPlan/ResponseLossReceipt`；未知事件默认失败，只有 core 版本化 allowlist 中经证明纯展示性的事件可忽略。

2. **B — ActiveSupplySnapshot 的 digest 与不可变性不可按草图实现**

   定位：[方案:1075](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1075)、[方案:1100](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1100)。

   反例：TypeScript `ReadonlyMap` 仅限制静态调用，底层 Map 或其中对象仍可通过别名修改；opaque runtime handle 也不能稳定进行 JCS digest。指针没有交换，旧请求仍可能观察到变更。最小修订：拆成可 canonical serialize 的 `SnapshotDescriptor` 与私有 runtime handle table；digest 只覆盖排序后的描述符和 handle identity，构造器深冻结并禁止可变别名。

3. **B — TCK report digest 与 runner SoT 自相矛盾**

   定位：[方案:1130](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1130)、[方案:1970](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1970)、[方案:1982](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1982)、[方案:2109](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2109)。

   反例：CLI 与 library 的 `startedAt/finishedAt/environment` 不同，不可能自然产生相同“report digest”；同时 runtime 和 connector-tck 各自列出 TCK runner。最小修订：把确定性的 `ConformanceResultCore` digest 与带时间、环境、签名的 run envelope 分开；runner 只保留在一个包中。

4. **B — BigModel/Z.AI 普通 API 的协议矩阵缺乏官方依据**

   定位：[方案:1412](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1412)、[方案:1413](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1413)。

   反例：普通 API pack 按表尝试 Responses 或 Messages；官方普通 API HTTP 文档目前给出的程序化入口是 Chat Completions，而 Anthropic endpoint 出现在单独的 Coding Plan/受支持工具产品中。[BigModel 普通 API](https://docs.bigmodel.cn/cn/guide/develop/http/introduction)、[BigModel Coding Plan](https://docs.bigmodel.cn/cn/coding-plan/tool/others)、[Z.AI 普通 API](https://docs.z.ai/guides/develop/http/introduction)、[Z.AI Coding Plan](https://docs.z.ai/devpack/quick-start)

   现有 conformance 会阻止错误激活，因此未升为 A。最小修订：普通 API 首版只列经官方资料确认的 Chat；Coding Plan 另建 product/rights entry；Responses/Messages 必须有精确官方 endpoint、产品和 fixture 后再加入。

5. **B — RouteSet 的“有限”没有数量和复杂度上限**

   定位：[方案:459](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:459)、[方案:785](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:785)、[方案:2034](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2034)。

   反例：bridge 声明数千成员和指数级 `possibleSequences`；它仍是“有限集合”，但 snapshot 编译、digest、费用 fold 和 activation 可耗尽 CPU/RSS。现有 archive limits 只约束 registry 文件，不约束运行时对象图。最小修订：规定 member、sequence、每序列长度、receipt graph 节点/深度和 IR/schema 字节上限；优先使用有界确定性 automaton，测试最大合法值与超限拒绝。

6. **B — Discovery 与 plugin 资源预算没有数值**

   定位：[方案:1112](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1112)、[方案:1201](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1201)、[方案:2042](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2042)。

   反例：plugin 长期占用 1.5 GiB、100% CPU但不崩溃；detector 在 4 秒内打开一万个文件。二者都可能满足现有时间门。最小修订：给出逐平台 CPU、RSS、frame、restart、文件打开数、请求数、总字节和子进程数的硬上限及测试 profile。

7. **B — “两次点击”排除了真正困难的厂商步骤**

   定位：[方案:55](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:55)、[方案:2031](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2031)。

   反例：用户需注册厂商账号、开通计费、选择 region、启用模型、创建并复制一次性 key；SayDo 内仍可统计为两次点击并宣称达到目标。现条款只测 Playwright 内部事件。最小修订：拆分“SayDo 内点击数”和“端到端用户动作/耗时”，为 L0 key、OAuth、cloud IAM、local runtime 分别设置任务成功率和人工可用性测试。

## C 级发现

1. **C — 终审引用指向不存在的 §17.5**

   定位：[方案:2349](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2349)。

   反例：文档要求以 §17.5 新评审为准，但文件结束于 §17.4；本会话执行 `rg -n '^### 17\.5'` 返回 exit code 1、无输出。现有 link checker未必检查纯文本章节引用。最小修订：新增真实 §17.5，或删除该前向引用并指向本轮终审报告。

最终判定：**FAIL**。最先需要关闭的是 Execution 费用闭环、in-flight 撤销、工具 exactly-once、plugin transport 权限、loopback 对端身份、供应链身份策略和 Phase DAG；这些不是实现细节，而是严格照方案施工后仍会留下的安全、付费或机械验收缺口。