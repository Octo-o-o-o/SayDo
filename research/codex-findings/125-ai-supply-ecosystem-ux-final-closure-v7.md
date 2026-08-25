# AI Supply 生态与用户体验终审报告（v7）

## 1. 评审范围与读取完整性

- 唯一评审目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 首次读取前核验：12,330 行，833,246 bytes，SHA-256 `c0d36de218f4a6db475f000d09eb1fe5d26e57ebaab0f9224ce1bc05fb6b2b72`。
- 已完整读取第 1–12,330 行；对分段输出中被截断的区间重新按更小区间读取，直至覆盖连续无缺口。
- 终审落笔前再次核验：12,330 行，833,246 bytes，SHA-256 仍为 `c0d36de218f4a6db475f000d09eb1fe5d26e57ebaab0f9224ce1bc05fb6b2b72`。
- 未读取源码、旧 prompt、旧 review、journal、索引或其他文件；未做网络事实查证。供应商事实判断仅以目标文档自身列出的产品事实、合同和范围承诺为边界。
- 未修改评审目标。

## 2. 计数

| 严重度 | 数量 | 判定口径 |
|---|---:|---|
| A | 2 | 能让 release/reference-grade/GA 产生机器可接受的假阳性，或使其声明的强门无法被证据对象表达 |
| B | 3 | 主流、明确承诺的产品/认证/费用/数据旅程存在不可达、互相矛盾或缺少必要安全与 UX 合同 |
| C | 2 | 不直接形成安全绕过，但会造成实现分叉、错误处方或错误指标结论 |

放行规则要求 A=0 且 B=0；本轮不满足。

## 3. 覆盖矩阵

| 审查面 | 覆盖的具体对象/反例 | 结论 |
|---|---|---|
| 中国大陆官方 API 与订阅 | BigModel/Z.AI、Kimi Open Platform/Coding Plan/Server-ACP、DeepSeek、百炼北京、方舟、混元、千帆、MiniMax 中国、SiliconFlow 中国的 product/realm/key/protocol/funding 分界 | `[fail]` 产品表本身较完整，但不可降级 profile 未把全部规范 minimum 变成不可替换机器输入，见 A-02 |
| 全球官方与三方 API | OpenAI Responses、Anthropic Messages、Gemini API、OpenRouter credits/PKCE/BYOK、OpenCode Zen/Go、MiniMax/SiliconFlow 国际、百炼新加坡、BytePlus | `[fail]` GA 运行证据不能证明逐平台、逐 locale、逐 UX 旅程，见 A-01；unknown-metering 主动流程与总入口互相冲突，见 B-03 |
| CLI、订阅与 Execution | Codex App Server、Claude Code、Kimi Code Server/ACP、OpenCode Server/ACP、Gemini CLI/Antigravity，以及 session/turn/request/tool Gate、rights、funding、sandbox | `[ok]` 未发现独立于本报告其他根因的新 A/B；这些旅程的 GA 可信度仍受 A-01/A-02 阻断 |
| CC Switch、bridge 与 custom Base URL | route pin/failover、LiteLLM/custom gateway、三核心 custom protocol、mTLS、proxy/CA、公开 header 与 secret broker | `[fail]` 任意私有 secret header 无可表达的 auth 分支，见 B-01；mTLS-only minimum 未被 reference profile 冻结，见 A-02 |
| Ollama、oMLX、LM Studio | loopback peer、cold/warm/preload、cloud/LAN 分流、text-only plain dialog、认证可选 | `[fail]` oMLX 的规范 GA minimum 未进入不可降级 profile，见 A-02；认证可选的本地服务与“任何 key 都失败”的 SLO 口径冲突，见 C-02 |
| Docker / Podman | Docker Model Runner disabled/API-off/no-model/cold/loaded/port-conflict；Podman AI Lab ready/api-disabled/no-model/stopped/port-conflict/unsupported-version | `[warn]` 产品级状态与只读处方写得具体；其不可降级 journey 仍依赖 A-02 所述可变 baseline/fixture，而非 profile 中的精确 requirement set |
| AWS / GCP / Azure auth | Bedrock static/role/SSO/API key、Vertex ADC/WIF、Azure key/Entra user/service principal/managed identity | `[fail]` Entra user 与 service principal 被一个 `or` journey 合并，Bedrock API key 未进入不可降级 auth minimum，见 A-02 |
| 自动发现与安全处方 | static、passive loopback、explicit-active、sentinel、预算、公平调度、peer TOCTOU、SSRF、secret egress | `[ok]` 本地探测与网络/credential 边界有具体负例；全功能依赖的 remote witness 不是同等级的一等外部服务合同，见 B-02 |
| provider-first 主动/被动 UX | 首屏推荐、唯一主动作、rights/health/quota/bridge drift、连接与 solution readiness | `[fail]` remote witness 无完整恢复状态，见 B-02；rights 表仍与 typed destination resolver 冲突，见 C-01 |
| 费用与数据边界 | 多 biller/unit、unknown metering、custom/private、enterprise negotiated pricing、processor、proxy interception | `[fail]` provider-first 总入口禁止 unknown 费用首测，但后文又要求两条可达 unknown 分支，见 B-03；witness 控制面数据去向未建模，见 B-02 |
| 双 locale 与 a11y | zh-CN/en-US、en-XA pseudo、ICU、200%、窄屏、键盘、screen reader | `[fail]` 单份 journey report 无法覆盖平台与 locale 的要求集合，且 pseudo locale 被错误放入 GA 用户 locale 类型，见 A-01 |
| GA 逐 product/auth journey | matrix、mandatory baseline、reference profile、typed run/report/gate、detached evidence/binding | `[fail]` A-01 与 A-02 均可产生假阳性，不能作为最终发布门 |

## 4. A 级发现

### A-01 GA journey 证据对象不能证明所声明的平台、locale 与 UX 合同全集

**精确行号**

- L10052–L10064：一个 journey 定义同时携带多个 `requiredPlatformProfileDigests` 和固定三 locale tuple。
- L10088–L10107：mandatory baseline 同样只保存 journey subject template、平台集合与 locale 集合。
- L10225–L10229：一次实际 run 的 subject 只能有一个 `platformProfileDigest` 和一个 `locale`。
- L10331–L10342、L10365–L10375：每份 journey gate/evidence 只容纳一份 report 和一个 `exactRunSubjectDigest`。
- L10377–L10385：entry gate 的期望集合是 journey subject digest，而不是 platform/locale 展开后的 run subject digest 集合。
- L10407–L10417：ecosystem gate 只有一个 `proves...Coverage: true` 断言，没有可供重算的 expected run set 与 actual run set。
- L10058、L10099、L10228 与 L10497：类型把 `en-XA` 当作每条 GA journey 的 locale，正文却明确它只是 CI pseudo locale，GA 用户 locale 只有 `zh-CN/en-US`。
- L10251–L10264 对实际 UX 只记录部分计数；L11452、L11688–L11699 又要求厂商页面任务、手填字段、管理员动作、错误循环和恢复都可机器计数并据此降级。

**具体用户旅程**

以 `global.openai.responses.api-key` 的 `guided_key` 为例，定义要求 macOS、Linux、Windows 与双用户 locale。当前对象图只能挂一份例如 `macOS arm64 + zh-CN` 的 pass report。`GaJourneyReleaseEvidenceV1` 没有 `runs[]`，entry gate 也没有期望的 `(journey, platform, locale)` digest 集合；Linux、Windows 和 `en-US` 没有证据仍可由最外层布尔值宣称覆盖。反方向上，`en-XA` 又被要求跑成完整登录/付费用户旅程，而正文只想把它用于伪本地化布局门。

同一问题也允许 UX 假阳性：一个 `guided_key` fixture 可以省略“开通计费/选择组织/管理员批准”等外部任务，因为 run payload 没有通用 `externalTaskCount`、手填字段分类或管理员等待结果；只保留 `actionEventLogDigest` 不能让 gate 从其当前强类型输入中重算 L11692–L11699 的硬上限。

**为何现有 guard 挡不住**

`expectedFixtureSetDigest` 可以证明某个 runner 声称跑完某组 fixture，但不能替代缺失的 expected run-subject 集合。`provesExact...: true` 是结果字段，不是证明输入；在对象图中没有剩余平台/locale 的 report，verifier 无从做集合等式。相同地，摘要化 action log 没有在合同中定义可重算的事件 schema 和完整派生指标。

**根因级修法**

升级为新的 GA schema：

1. 将 locale 拆为 `requiredUserLocales: ["zh-CN", "en-US"]` 与独立 `requiredPseudoLocaleSuites: ["en-XA"]`。
2. 在 baseline 中物化精确 `requiredRunSubjectDigests`，它必须是明确列举或由规范算法生成的 `(journey subject, platform, user locale)` 笛卡尔积；pseudo/a11y run 使用独立 subject kind。
3. 将 `GaJourneyReleaseEvidenceV1` 改为无漏无重的 `runs[]`，entry/ecosystem gate 对 expected/actual run digest 集合作规范排序后做严格等式。
4. 给 journey definition 与 run payload 增加可重算的 typed UX 上限/实测字段：起始账号状态、外部任务总数与分类、secret/账号/region/Base URL/protocol 等手填字段数、provider 页面步骤、管理员等待、错误循环与恢复次数。摘要只保存原始证据，不能代替派生数值。

### A-02 `ReferenceGradeProfileV1` 没有编码它声称不可降级的产品、认证与 category minimum

**精确行号**

- L10110–L10177：不可降级 profile 的全部 literal minimum。
- L10107 与 L10169：baseline 声明每个 auth path 必须独立且不能是 `or`，但 profile 的 Azure journey 正是 `azure-openai-entra-user-or-service-principal`。
- L388–L405：`entra_user`、`service_principal`、`managed_identity` 是三个可判别 source kind，证明前两者不是同一个实测分支。
- L10982–L10998：规范 baseline 要求 realm/category minimum、oMLX、mTLS-only private gateway 和逐平台/locale journey。
- L10992、L11553、L11994：oMLX 被明确列为 required/DoD 产品；L10113–L10147 的 named entry 列表却没有 `local.omlx`。
- L10997：custom endpoint minimum 包含 mTLS-only private gateway；L10157–L10160 只冻结三个 wire protocol journey。
- L10535、L10885、L11478：Bedrock API key 是独立产品 auth journey；L10122–L10124、L10171–L10175 只冻结 static profile、role profile 与 SSO。
- L11554 明确规定任何 auth `OR`、generic product journey 都应使 gate 非零；L11556、L11995 又规定 minimum 由 `ReferenceGradeProfileV1` 而不是 owner 临时 baseline 决定。

**具体用户旅程**

一个 release 可以保持当前 reference profile digest 不变，只测试 Ollama/LM Studio、不测试 oMLX；只测试 Azure Entra interactive user、不测试 service principal；只测试 Bedrock static/role/SSO、不测试 Bedrock API key；custom 只跑 Bearer 三协议、不跑 mTLS-only。只按已定义的 profile literal 检查时，这些删除不会改变任何 `requiredNamed*` 项。

这会在中国/全球 realm 上产生同类风险：profile 没有 category key、category minimum、entry-to-category 映射或“可替换 slot”的规范约束；具体产品只能留在可由 owner 调整的 baseline 中，和“reference profile 决定最低集合”的声明相冲突。

**为何现有 guard 挡不住**

mandatory baseline 虽然可以列出更多项，但 L10982 明确允许 owner 调整具体产品；它只保存 `referenceGradeProfileDigest`，而 profile 本身没有上述缺失 minimum。owner decision/evidence/binding 能证明“某份 baseline 被批准并测试”，不能证明它没有删掉 profile 从未表达的要求。`downgradeChangesDesignation...: true` 同样没有可比较的完整 requirement set。

**根因级修法**

发布 `ReferenceGradeProfileV2`，直接冻结：

- 精确 required entry subject、required auth journey subject 和 required state/fixture-set digest；
- required category key、minimum、funding tier及 entry/journey-to-category 映射；
- 明确的可替换 slot 与允许替换约束，而不是任意 owner 调整；
- 独立的 Azure Entra user、Azure service principal、Azure managed identity journey；
- oMLX、Bedrock API key、custom mTLS-only，以及最终仍属 reference-grade 声明的 Docker/Podman 状态要求。

verifier 必须从 profile 本身派生 baseline 允许集合；baseline 只能收窄到 profile 明确允许替换的 slot，不能新增一个绕过 profile 的事实来源。

## 5. B 级发现

### B-01 “完全自定义端点”无法表达用户自有的任意 secret header

**精确行号**

- L236–L262：`ApplicationAuth/AuthSource` 的完整联合只有 Bearer、固定 `x_api_key`、Basic、`registry_header`、OAuth、签名/workload 与 mTLS-only；没有 user-defined secret-header 分支。
- L6103–L6159：用户自定义 header 只能是 `public_protocol_constant`，并明确禁止 credential/signature 语义；动态 credential header 必须只来自 broker。
- L8895、L8903：高级表单只允许受限公开参数/header，不能自由定义 credential header。
- L141、L147、L10997、L11997：产品又承诺“完全自定义端点”、header broker 和 custom private gateway 可达。

**具体用户旅程**

组织内 OpenAI-compatible gateway 使用 `https://ai.corp.example/v1`，认证头为 `X-Auth-Token: <secret>`，且没有 SayDo 签名 registry pack。用户选择“完全自定义”，Base URL 与协议都可填写；Bearer、`x-api-key` 和 Basic 都不匹配。若将 `X-Auth-Token` 当 public custom header，L6124–L6134 的 classifier 必须拒绝；若选择 `registry_header`，又没有可指向用户本地定义 header name 的 receipt/profile 合同。旅程在 secret 注入前死锁。

**为何现有 guard 挡不住**

custom endpoint 的 exact egress consent 能批准“哪个 endpoint 可收到哪个 secret”，但不能表达 header name、重复/碰撞规则和该 header 对应的 broker component。public-header 授权反而必须拒绝这个值，因此安全 guard 正确工作时用户旅程必然不可达。

**根因级修法**

增加严格 `custom_secret_header` auth variant，而不是放宽 `PublicRequestHeader`：header 名单独规范化并经 credential/confusable/保留名策略；secret 只以 broker handle/版本存在；component、recipient、endpoint、RequestProfile、proxy 可见性、ACL、egress、用户 decision、TTL 与 hard-stop generation 全绑定；禁止与 Authorization/Cookie/proxy/hop-by-hop 或另一 credential component 冲突。为至少 `X-Auth-Token`、Azure 风格 `api-key`、header 冲突和 redirect/proxy 泄漏提供正反例。

### B-02 remote transparency witness 是 macOS 全功能的强依赖，却不是一等外部服务、数据边界或可恢复 UX journey

**精确行号**

- L2198–L2236：anchor/witness 只记录 authority、counter 和 digest。
- L2239–L2265：macOS arm64 唯一 qualified persistent backend 是 `remote_transparency_witness`，全功能必须有 qualified backend；否则只允许 boot-scoped anonymous local plain inference。
- L2268–L2286：enrollment receipt 没有 witness endpoint、operator、region、retention/purpose、network/proxy、credential、费用或用户 decision/DataBoundary 引用。
- L10479：无 witness 时 API、登录、工具和 fallback 全部禁用，只给一段说明文字。
- L10493：每个界面状态必须有唯一 machine-readable `primaryAction`。
- L11031、L11555、L11749：三平台 release gate 又把真实 witness/enrollment 当硬要求。

**具体用户旅程**

中国大陆或企业代理后的 macOS 用户，本机 Ollama 可对话，随后想添加 DeepSeek/Kimi/OpenAI API 或登录 Codex。若 witness 服务在该网络不可达，他只能停留在匿名本机 plain dialog；现有状态表没有“配置企业代理/选择可用 witness/重试 enrollment/查看处理方”的 typed state 与主动作。若应用自动联系 witness，则用户在“数据会去哪里”中也看不到该控制面服务将收到的设备、counter、受保护状态摘要及其 operator/region/retention。

**为何现有 guard 挡不住**

Inference/Execution 的 DataBoundary 与 processor receipt 约束的是模型、代理和工具请求；`MonotonicAnchorEnrollmentReceipt` 没有引用这些对象。平台 TCK 只能证明 witness producer 能工作，不能证明用户已知情、网络可达、在中国/全球 realm 有可用部署，或故障后有处方。当前 reference/GA journey 也没有 witness enrollment/recovery subject。

**根因级修法**

把 witness 升为一等 control-plane dependency：固定 service/operator/realm/endpoint/threshold member、发送字段、用途、retention/subprocessor、网络/proxy、认证、费用与撤销策略；首次联系前生成独立 disclosure/decision，状态机覆盖 enrollment、offline、proxy blocked、threshold partial、rotation、continuity lost、retry/recovery。对 macOS/Linux/Windows、`zh-CN/en-US` 和中国/全球可达性建立独立 GA run；若无法提供该合同，则必须提供真正本地的 qualified backend，或明确把全功能平台支持降级而非保留 GA 声明。

### B-03 provider-first 总入口禁止 unknown 费用首测，与后文两条 mandatory unknown-metering 正向链互相排斥

**精确行号**

- L145–L159：默认 provider-first 流程在自检步骤规定，任一费用分量或 overage 无法确定时“禁止创建付费测试授权”。
- L8910、L9541：exact custom/private gateway 明确允许 `externally_metered_unknown_custom` 首测与逐物理请求同意。
- L9542：官方企业云在协议价、credits、成本中心或 hard cap 不可权威读取时，明确允许 `externally_metered_unknown_official` 人工连接。
- L10033、L10156：`externally_metered_unknown` 还是 reference-grade 的 required funding tier。
- L10495–L10496、L11216、L11224–L11225：两条 unknown 分支都要求可达的 conformance、actual report 与 runtime 正向旅程。

**具体用户旅程**

一类是用户自管 LiteLLM/private gateway，价格由组织内部结算且 SayDo 无法取得权威单价；另一类是 Azure/AWS/GCP 企业协议价或成本中心 hard cap 无法读取。按 L158，UI 在首次自检前必须拒绝创建授权；按后续 typed contracts，同一个用户应看到“价格/硬上限未知”的逐请求 disclosure，并能完成 `connected_verified`。实现者无论选哪条规范都会违反另一条。

**为何现有 guard 挡不住**

后文严格联合可以防止 unknown 被伪装成 settled/no-new-spend，却没有改写 §3.2 的上游 UX 决策条件。若 UI 在进入 proposal 构造前就执行 L158，unknown receipt producer 永远不可达；若 UI 忽略 L158，则默认流程违反明确禁令。GA required funding tier 不能修复入口不可达。

**根因级修法**

将 L158 改为判别分支：

- `priced_candidate`：任何 component/overage/worst-case 不确定即拒绝；
- `externally_metered_unknown_custom`：只接受 exact owner/admin private rights，展示无法封顶、请求/输入输出 token/physical cap 和外部计量主体，逐次确认；
- `externally_metered_unknown_official`：只接受官方企业 unknown rights，使用独立措辞与逐次确认。

三条分支从 provider-first view model、proposal/disclosure 到 gate 使用同一 discriminant，并加入“UI 前置条件错误地拒绝两条 unknown 正例”的 mutation fixture。

## 6. C 级发现

### C-01 rights blocked 表格仍把 conditional resolver 写成无条件 `switch_to_official_api`

**精确行号**

- L10720–L10755：typed contract 正确要求先解析精确官方目的地；不存在安全目的地时必须使用 `choose_another_source`。
- L10758–L10771：`rights_unknown` 与 `rights_forbidden` 两行仍无条件把唯一主动作写成 `switch_to_official_api`。
- L165–L175：更早的被动提示表也无条件写“改用官方 API”。

**具体用户旅程与影响**

检测到一个 rights forbidden 的订阅/CLI，但该产品没有同 realm 的官方 API 或当前没有可执行 auth journey。按 typed resolver 应显示“选择其他来源”；按两张产品表则会展示“改用官方 API”，点击后只能进入空页或错误 realm。

**根因级修法**

表格不再写 literal action，统一写 `resolve_rights_blocked_primary_action(receipt)`；为“有安全官方目的地/无目的地/目的地过期或 realm 不匹配”生成两 locale 的 view-model golden。

### C-02 “所有本地 loopback 都零字段”的 SLO 未限定 `auth=none`，与 LM Studio 可选认证及任意-auth 实现范围冲突

**精确行号**

- L11675：不加限定地规定本地 loopback 任何 key/URL 必填都失败。
- L11969：目标文档自己的证据基线写明 LM Studio 认证可选。
- L11295：Phase 4 计划明确支持 loopback transport 的任意 auth。
- L10992：真正的 `local_zero_config` mandatory journey 已经正确限定为 `auth=none`。

**具体用户旅程与影响**

用户为本机 LM Studio 开启认证。产品正确做法是自动识别候选后让用户提供一个 secret，进入 guided/advanced journey；按 L11675，这个合法产品状态却会让 release UX SLO 失败，或诱导实现者隐藏认证字段。

**根因级修法**

把指标改成“`local_zero_config` 且 `auth=none` 的 loopback 服务手填技术字段为 0”；另给 authenticated loopback 定义 `guided_key` 上限，仍要求 URL/protocol 自动填充，并在 GA matrix 中用独立 auth journey 计数。

## 7. 收口条件

下一轮复核前至少需要：

1. GA evidence schema 能精确表达并校验 run subject 全集和完整 UX 指标。
2. 新 reference profile 自身冻结全部不可降级 entry/category/auth/state minimum，不再依赖可调 baseline 补语义。
3. custom secret header、remote witness 和两条 unknown-metering 旅程都有从 provider-first UI 到最终 gate 的可达正例及对应反例。
4. 两处 C 级文案/指标冲突同步改为同一 typed view-model 与 journey contract 的生成结果。

## 8. 唯一结论

**VERDICT: FAIL**
