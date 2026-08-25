# AI Supply 生态与普通用户 UX 最终闭包复核 v12

## 1. 冻结完整性与审查范围

只读取了指定目标 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`，并按行连续读完全文；未读取其他 prompt、review、history、journal、日志或实现者说明，也未修改目标文档。

| 项目 | 冻结值 | 首次实测 | 收口实测 | 结果 |
|---|---:|---:|---:|---|
| 行数 | 25,018 | 25,018 | 25,018 | `[ok]` |
| bytes | 1,513,595 | 1,513,595 | 1,513,595 | `[ok]` |
| SHA-256 | `7ffadde7837eeab3332431a67437aff2a65595cc1e9cda8c88c69a2e970e8d09` | 同左 | 同左 | `[ok]` |

对 61 行 literal requirement 的独立逐行枚举得到：`inference=55`、`execution=4`、`bridge=1`、`control_plane=1`；category 分布为 `global_official_api=18`、`china_mainland_official_api=10`、`global_gateway_and_subscription=13`、`local_runtime=9`、`execution_subscription_surface=4`、`bridge_and_router=1`、`custom_endpoint=5`、`platform_anchor_control_plane=1`。该计数与文档声明的 61 一致，但集合内容仍存在下述阻断缺口。

## 2. 结论计数

| 等级 | 数量 |
|---|---:|
| A | 5 |
| B | 1 |
| C | 0 |

## 3. Findings

### A1. 61 行唯一真相没有实现文档自己声明的 execution 与 bridge 固定最低集

证据：

- V3 profile 明确规定 matrix、journey、fixture 与 docs 只能从 `REFERENCE_REQUIREMENTS_V3` 生成，且 owner addition 只是追加，不能削弱固定集合（21980-21997）；derivation receipt 把当前集合钉为 61 行（21931-21965）。
- 61 行 literal tuple 中 execution 只有 Codex App Server、Kimi ACP、OpenCode HTTP、OpenCode ACP 四行，bridge 只有 CC Switch 一行（21536-21540）。独立枚举结果为 `cli_stdio=0`、`bridge_and_router=1`。
- 但 GA mandatory baseline 要求 execution 同时包含 Codex App Server、OpenCode ACP 或 HTTP、一个普通 `cli_stdio`，还要求 bridge 同时包含 route-pinned CC Switch 与 LiteLLM/custom gateway（23516-23518）。
- `GaMandatoryBaselineV3` 仅投影当前 requirements 加可选 owner additions，没有独立的 category minimum 或上述两个缺失 slot（22036-22050）；因此 owner 不追加时，缺项仍可满足当前 exact-set gate。

最小用户路径：发布方让现有 61 行全部通过，不追加 owner row，然后发布 GA。普通 CLI stdio 用户以及已有 LiteLLM/custom gateway 的用户看到 GA 支持结论，但 release verifier 从未要求相应 row、journey、wire/effective-route evidence 或支持页条目。

影响：这是固定最低集失败，不是长尾延期。它还会把缺失传播到 matrix、TCK 清单和由 requirements 生成的支持材料。

最小修复：在唯一 literal tuple 中增加至少一个准确的普通 `cli_stdio` requirement，并增加独立于 CC Switch 的具名 bridge requirement；随后把总数、critical compile-time invariants、category minimum、run subjects、TCK 与支持页投影一起重算。若产品决定删除该最低要求，应先改 §9.9 与 designation，而不是依赖可选 owner append。

### A2. `guided_key` 的 fresh/no-account 路径没有创建凭据的 external task，且诚实复制粘贴会超过签名上限

证据：

- `guided_key` graph 的 `no_account` 路径是 `create-account -> activate-billing-if-required -> commit-required-fields -> staged_conformance`；四个账户起点中没有“已有 key / 尚无 key”维度，图中也没有 `providerCredentialCreation` step（20890-20914）。
- recipe 又强制要求 `api_key`，来源为 `manual_secret_broker_entry`（21179-21192）。这只证明可以提交一个值，不会在 fresh account 中产生那个值。
- per-class limit 明明为 `providerCredentialCreation` 预留了 1 次 external task（19881-19883），实际图却没有使用它。
- 事件把 `copy` 与 `paste` 分别建模（19961），reducer 明确逐事件计数（19997），但 guided-key 的 `maximumCopyPasteCount` 是 1（20076-20095）。文档同时要求外部登录、MFA、copy/paste 与 leave-return 全部诚实计入（23013、24238、24244）。

最小用户路径：新 OpenAI、Anthropic、Gemini、Kimi、OpenCode Zen/Go 等 API 用户选择 `no_account`，创建账户并开通 billing 后还没有 API key。下一节点却直接要求保存 key。若用户离开应用去 provider 页面创建 key、复制、返回并粘贴，真实路径至少增加一项 `providerCredentialCreation` external task，并产生 `copy`、`paste` 两个事件；当前图漏掉前者，当前上限又拒绝后者。实现只能让用户卡死、要求预先拥有不存在的 key，或少记真实负担。

影响：大量 L0/fixed guided-key 主流路径不可达或必须伪造 UX 指标，属于 A。

最小修复：把 credential-existence 作为真实起点维度或显式分支；fresh/no-key 分支增加 `providerCredentialCreation` external task、provider page、leave-return 与焦点恢复；将 copy/paste 上限按 reducer 的 occurrence 定义改为至少 2，或把事件模型改成经过证明的单次 transfer 语义并同步所有门禁。

### A3. 本地与容器产品的签名 graph 把多态处方压成三节点直线，并把真实外部启动动作记成零外部任务

证据：

- `JOURNEY_GRAPH_LOCAL_V3` 只有 `local_service_installed`、`local_service_not_running` 两个起点，以及“查看启动方法 -> 被动 peer evidence -> peer challenge”三个节点；查看说明后立即自动前进，`focusReturnRequired=false`，没有在原产品启动/启用/加载服务的 external task（21018-21032）。OpenCode ACP、OpenCode HTTP 与 CC Switch 也复用这个本地图（21034-21042、21343-21364）。
- zero-config 签名上限强制 external task、leave-return、字段均为 0（19874-19879、20052-20073、24236）。
- 固定 Docker Model Runner 与 Podman AI Lab rows 却要求 `disabled/api_off/no_model/cold/warm/port_conflict` 及 `ready/api_disabled/no_model/stopped/port_conflict/unsupported_version` 等产品态（21534-21535）。producer registry 只把这些状态归到通用 recovery/validation 名称（21403-21466），graph 中没有对应的产品态节点或准确处方动作。
- 叙述层明确承认服务启动、enable、pull/load 都由用户在 Docker/Podman 或原产品完成，是 external task；还要求 Docker/Podman stopped journey 先“检查本机容器服务”再“查看启动方法”（22991、23288-23289、23993、24212）。这些动作无法由当前零 external task、单一三节点 graph 表达。

最小用户路径：Docker Model Runner 已安装但组件 disabled，或 Podman AI Lab 为 `api_disabled/no_model/stopped`。graph 从 `local_service_installed` 直接做 passive peer evidence；listener 不存在就失败，没有“检查容器服务”及状态专属处方。即使用户自行打开 Docker/Podman、enable/start/load 后返回，事件日志也不能诚实记录这项 external task 和 leave-return，因为签名 tier 上限是 0。

影响：Docker/Podman 固定最低旅程、停止态 Ollama/oMLX，以及复用本地图的本地 execution/bridge 路径，要么不可达 ready，要么以伪零配置通过。

最小修复：为 local zero-config、managed container、local execution HTTP/stdio、bridge 分开签名 graph；把每个 required runtime state 投影成可达的状态节点和准确处方；对确需在原产品操作的 stopped/disabled/no-model 路径记录 external task、leave-return 与 return-focus，并使用容纳这些真实负担的 tier。运行中且真正 ready 的被动路径可继续保持零动作。

### A4. OpenCode Server HTTP 的可选密码有 producer，却没有任何可执行输入路径

证据：

- `RECIPE_EXECUTION_HTTP_V1` 声明 `server_password` 为 `required:false` 的 secret 字段，并复用 local execution graph（21343-21353）；固定 row 又把 `password_optional` 列为 required runtime state（21538）。
- producer registry 把 `password_optional` 指向 `manual_field/server_password`（21440）。
- 但复用的 local graph 没有 `manual_field` 或 `recipe_field_group` 节点（21018-21042）。
- 静态检查只要求 manual-field producer 引用 recipe 中存在的字段（21814-21822）；required-field 集合显式过滤掉 `required:false`（21868-21872），run receipt 也只要求 required recipe field 有事件（22159-22170）。因此“字段存在但从未展示、从未提交”仍可通过 derivation。
- Phase 5 又明确要求 OpenCode HTTP 的 password/no-password 两条 fixture（23927），说明密码分支不是纯说明性 metadata。

最小用户路径：用户已有在 `127.0.0.1:4096` 运行且启用 Basic password 的 OpenCode Server。SayDo 从 `local_service_installed` 进入 passive peer evidence 和 peer challenge，但 UI 图没有密码输入节点；认证失败后也没有可回到的 typed field step。无密码 fixture 可通过，密码 fixture 无正向路径，而当前 gate 仍可用 producer/布尔证明冒充覆盖。

影响：固定 `opencode.server.http` requirement 的一条明确正向变体不可达，属于 A。

最小修复：给 execution HTTP 单独 graph，在“探测到认证启用”条件分支中加入 `manual_field:server_password`，并让 positive/negative fixture、field event、secret broker commit、peer/auth validation 与 signed limit 绑定；无密码分支应证明零 secret field/event。

### A5. 所有 reference graph 的正向终态都停在 live 之前，GA pass 可仅靠 readiness literal 与布尔值越过真实 completion/activation

证据：

- `ReferenceJourneyGraphV3.terminalState` 唯一值是 `ready_for_live_conformance`（20847-20863）。guided-key、OAuth、enterprise、custom 与 anchor 图的末节点只是 `staged_conformance`，local 图末节点只是 `peer_identity_challenge`（20890-21068）。
- recipe 的完整 active sequence 明明还包括 rights/funding、safe restart、live conformance、capability/readiness projection（21121-21129、21179-21205），但 producer compatibility 只检查 validation 名称是否出现在 recipe 数组，不检查它是否是该账户路径实际访问的 graph step（21814-21850）。
- GA pass payload 随后直接把 `finalConnectionReadiness`、`finalSolutionReadiness`、`finalExecutionReadiness` 或 `finalControlReadiness` 固定成 ready literal，并依赖 `everyFixturePassed/rawEvidenceComplete` 等布尔值（22364-22439）；run/gate payload 没有 typed `ConformanceJourneyCompletionReceipt`、Capability 或 Activation 引用。
- 文档别处已经定义了真正闭合 staged、restart、live 与 ledger 的 `ConformanceJourneyCompletionReceipt`，并要求 Capability 强引用它（11320-11366、11489-11500）；UX 规则也明确禁止 staged success 冒充 `conversation_ready`（23011、23015）。该真实链没有接入 GA journey pass。

最小用户路径：任一 OpenAI key journey 提交字段并只跑 staged；任一本地 journey只完成 peer challenge；任一 Codex/Kimi execution journey只完成 staged。runner 填入 `completed_pass`、ready literal 和几个证明布尔值，就可构造当前 pass/gate 形状，而没有证明 restart、live、rights/funding、capability、Activation 或可启动对话/执行面真的存在。

影响：全部 61 行的“正向 ready 终态”在机器合同上都可被 pre-live graph 和自声明布尔替代，固定 minimum 与 readiness 文案均不可信，属于 A。

最小修复：把 graph 的 positive terminal 改成按 surface 判别的真正 ready terminal，或在 terminal 后增加不可省略的 typed completion phase；`GaJourneyPassPayloadV2` 必须强引用同一 subject/distribution 的 `ConformanceJourneyCompletionReceipt -> Capability/Execution conformance -> Activation -> readiness projection`，并让缺任一 live/activation receipt 的 mutation 无法构造 pass。

### B1. 支持页、picker 与 release note 的“只从 requirements 生成”只有布尔声明，没有进入 release binding 的可核对 artifact

证据：

- profile 声明 matrix、fixture 与 docs 只从 requirements 生成（21980-21997），叙述又承诺支持页、picker、测试矩阵和 release note 只从验证后的 profile/core/evidence/binding 生成（23004-23005）。
- 但 `GaEcosystemReleaseEvidenceSetV3` 与 `ReleaseEcosystemBinding` 只绑定 requirements、runs、probe、registry、conformance 与 distribution digests；没有 support-page/picker/release-note artifact digest、生成器版本、逐 requirement 投影集合或语义 equality receipt（22753-22795）。

最小用户路径：61 行及所有 journey evidence 都未变化，但构建缓存留下旧支持页，漏掉一个 auth/protocol row，或把 inventory 产品显示为已支持。distribution digest 可以把这份旧文件作为普通字节一起签入，却没有 gate 能重算其条目集合并与 requirements/evidence 比较，因此发布仍可通过。

影响：这是显著的可验证性与用户沟通缺口；它会让真实 gate 与对外支持声明漂移，但不单独证明当前页面已误导，定为 B。

最小修复：定义 typed `GeneratedSupportSurfaceReceipt`，逐一绑定 support page、picker metadata、test matrix、release note 的 artifact digest、generator artifact/version、requirements/evidence digest，以及 entry/protocol/auth/realm/maturity 集合；将其放入 `ReleaseEcosystemBinding`，用删行、加 inventory、错 maturity、旧缓存 mutation 证明 gate 非零。

## 4. 覆盖矩阵

| 审查面 | 文档中的实际覆盖 | 机械状态 | 结论 |
|---|---|---|---|
| 中国大陆官方 API 与套餐 | BigModel Chat/Messages、Kimi API/Coding Plan 双协议、DeepSeek、MiniMax、百炼、方舟、混元、千帆、Baidu benefit、SiliconFlow 均有 requirement row（21514-21526） | 10 个 `china_mainland_official_api` rows，另有中国套餐 rows | 品牌/realm 覆盖较完整；guided-key 受 A2、全部 ready 受 A5 阻断 |
| 全球官方 API、企业云与网关订阅 | OpenAI、Anthropic、Gemini API、Vertex、Azure 四 auth、Bedrock 四 auth、OpenRouter、OpenCode Zen/Go、Z.AI、MiniMax、百炼国际、SiliconFlow、BytePlus 均进入 rows（21486-21513） | 18 global-official + 13 gateway/subscription rows | 产品/auth/protocol 拆分明显优于品牌布尔；A2/A5 仍阻断真实旅程 |
| Gemini/Antigravity 与其他消费 CLI | Gemini API 固定；Gemini CLI 企业/Cloud/API-key 与 Antigravity 个人路径被明确拆开，Antigravity 默认 inventory；Claude Code及其他 CLI 按 rights/conformance 降级（23099-23123） | 不在 61 行固定集 | 诚实降级合理；不是品牌遗漏，但普通 `cli_stdio` 固定 minimum 被 A1 漏掉 |
| Codex/Kimi/OpenCode execution | Codex App Server、Kimi ACP、OpenCode HTTP、OpenCode ACP 四行分 surface（21536-21539） | 4 个 execution rows | OAuth 与本地图已分开，但 OpenCode password 受 A4、ready 受 A5；普通 CLI row 缺失见 A1 |
| L0 本地 runtime | Ollama、LM Studio、oMLX 按真实协议拆为 7 行（21527-21533） | fixed，含 Chat/Responses/Messages | 协议覆盖清楚；cold/stopped 与正向 ready 被 A3/A5 阻断 |
| 容器与长尾本地 runtime | Docker Model Runner、Podman AI Lab 为具名 rows；llama.cpp、vLLM、SGLang、LocalAI、Open WebUI、Jan、Xinference、TGI 等进入 detector/registry 分期（23125-23154、23433） | Docker/Podman fixed；其余 L1/L2/inventory | local/cloud/LAN 与端口抢占边界写得清楚；fixed managed graph 受 A3 阻断 |
| Bridge/router | CC Switch Desktop/CLI fork 分离；LiteLLM、One API/New API、Portkey、Vercel AI Gateway 被正确建模为 route control，而非 provider（23156-23165、23447-23455） | 只有 CC Switch 一条 fixed bridge row | 概念正确，但第二具名 bridge minimum 缺失见 A1 |
| Custom Base URL | OpenAI Chat、Responses、Anthropic Messages、mTLS-only、custom secret header 五条独立 recipe（21542-21546）；协议/path/auth/model/proxy/TLS/unknown metering 有专门合同 | 5 个 fixed rows | 字段集合和安全边界完整；最终 ready 仍受 A5 |
| Discovery、安全、费用与数据 | 静态阶段零 CLI/socket，active detector 需用户授权并受 sandbox；不读第三方 secret/helper；loopback 不冒充 local compute；route、rights、billing、data 与费用 ledger 均有 fail-closed 设计（22988-22999、23141-23175） | 有 TCK/receipt 规划 | 未发现额外 A/B；A3 是 graph 与这些叙述不一致，而不是底层原则错误 |
| 普通用户 UX 与恢复 | provider-first、唯一 primary action、取消、旧方案保留、错误处方、焦点恢复、真实外部任务统计均有明确设计（143-162、23279-23312） | typed event/reducer 已建立 | A2/A3 证明两类固定图仍无法兑现该设计 |
| Readiness、i18n 与 a11y | connected/conversation/review/execution/control 分层；`zh-CN/en-US`、`en-XA`、键盘、screen reader、窄屏与 200% 均列为门（23011-23016、23314-23327） | journey pass 与完整 live/Activation 未绑定 | ready 受 A5；对外支持材料的可验证绑定受 B1 |
| 61 truth 到 release | requirement -> run -> journey -> entry -> ecosystem 的 exact-set/attestation 链完整（21931-22774） | 当前 truth 为 61 行 | 链条形式强，但输入集合有 A1，positive terminal有 A5，支持面无 B1 绑定 |

## 5. 遗漏生态清单

### 5.1 固定最低真相中的阻断性遗漏

1. 一个具名普通 `cli_stdio` execution requirement：§9.9 明确要求，当前 61 行中为 0。
2. 独立于 CC Switch 的第二个具名 bridge requirement：应为 LiteLLM 或 owner 选定的 custom gateway；当前 `bridge_and_router` 只有 CC Switch 1 行。

### 5.2 已在文档中诚实分期、但不属于当前 61 行 fixed requirements

- Antigravity、Gemini CLI 企业/Cloud/API-key、Claude Code条件式 surface、Cursor/Grok/Qwen/Copilot/Vibe、Aider/Pi 等 CLI。
- llama.cpp、vLLM、SGLang、LocalAI、Open WebUI、Jan、Xinference、TGI、MLX-LM、Foundry Local 等长尾 runtime。
- CC Switch CLI fork、One API/New API、Portkey、Vercel AI Gateway、企业自建 gateway。

这些项目不是“文档完全遗漏”：它们有 inventory/L1/L2/rights-gated 路径，而且没有被冒充成已验证 fixed 支持。真正与当前 GA mandatory baseline 冲突的是 5.1 的两项。

## 6. 唯一 verdict

`FAIL`

理由：A=5、B=1。至少固定最低集合、guided-key fresh 旅程、本地 managed/stopped 旅程、OpenCode HTTP 密码分支和所有 surface 的正向 ready 终态尚未机械闭合；按本轮规则不能通过。
