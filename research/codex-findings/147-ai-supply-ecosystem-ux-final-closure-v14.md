# AI 供给生态与 UX 零上下文终审（v14 closure）

## 结论

**FAIL。A=7，B=2，C=0。** 只统计按本文完整施工后仍会错误、不可达或无法机械验收的问题；没有把“当前代码尚未施工”计为缺陷。任一 A/B 非零即不满足终审闭包。

评审输入仅为目标方案、必要的当前代码/canonical 事实和一手官方资料；未读取 `prompts/`、既有 `research/codex-findings/`、`history/` 或旧评审报告，也未修改目标方案、生产代码或 canonical。

## 冻结核对

落盘前在仓库根目录对目标执行独立只读核对：

| 项目 | 要求 | 实测 | 结果 |
|---|---:|---:|---|
| SHA-256 | `fcde60a8700dbfc14566d7183a30bf14d0310aa070d628173e23177dd1bda1ab` | `fcde60a8700dbfc14566d7183a30bf14d0310aa070d628173e23177dd1bda1ab` | `[ok]` |
| 行数 | 30,490 | 30,490 | `[ok]` |
| 字节数 | 1,830,991 | 1,830,991 | `[ok]` |

目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。报告落盘后的第二次冻结核对见文末。

## 八项覆盖

| 覆盖项 | 核对范围 | 结果 |
|---|---|---|
| 1. 产品与 surface | 智谱/Kimi/OpenCode/Codex/Claude/Gemini/Qwen/Cursor/Grok/Copilot；API、订阅、Execution 与 inventory 分界 | `[fail]` A1、A5、A6。Cursor/Grok/Qwen/Copilot/Claude/Gemini 个人路径保持 `rights=unknown` 或 inventory 的保守策略本身无新增缺陷 |
| 2. 全球/中国生态与资金域 | 官方/三方 API、Coding Plan、订阅、网关；中国/国际 realm、key namespace、费用和数据域 | `[fail]` A1、A6、B2。Kimi Platform/Code、智谱普通 API/Coding Plan、TokenHub 广州/新加坡的隔离方向正确 |
| 3. exact wire/auth/realm/funding | Chat、Responses、Messages、Google GenAI、Azure、Vertex、Bedrock、custom Base URL | `[fail]` A1、A2；73 行机器真相没有把绝大多数 exact wire 固定为可验收字面量，可选认证也没有产出选中后的 auth 分支 |
| 4. automatic detection | `static_filesystem`、`passive_loopback_metadata`、`explicit_active`，以及 CLI/本地服务/bridge 检测 | `[ok]` 未发现独立 A/B；零 secret、自动阶段不执行 PATH 程序、loopback 与 LAN 分离的设计可验收。检测后的恢复处方另见 A5 |
| 5. 主动配置 | provider-first、手填 key、OAuth/workload identity、custom endpoint、LM Studio/OpenCode/LiteLLM 条件认证 | `[fail]` A2、A3 |
| 6. 被动提示与恢复 | 单主动作、自动态零主动作、错误处方、CLI/runtime/bridge 恢复 | `[fail]` A4、A5 |
| 7. graph 派生 UX 与账号起点 | graph 终点、字段事件、no-account/signed-out/MFA/admin、费用/数据/rights 提示 | `[fail]` A3、A4、A6、B1 |
| 8. deterministic/live 与 cleanup | 73 行 hermetic 展开、真实账号 set-cover、排他 lease、MFA、预算、失败清理 | `[fail]` A7、B1 |

正向抽核中，TokenHub 六行的两站 origin、三协议 path、Chat/Responses Bearer、Messages `x-api-key` 和 `/v1/models` 已在 [腾讯云当前文档](https://cloud.tencent.com/document/product/1823/130079) 中对上；Kimi Platform 与 Kimi Code 双协议/双 key namespace 的拆分也与 [Kimi Code 官方文档](https://www.kimi.com/code/docs/en/) 一致。这些正确点不抵销下列阻断。

## A 级发现

### A1. 73 行机器真相没有冻结绝大多数 provider 的 exact wire，错误 URL 仍可通过类型与发布门

- **准确锚点**：`ReferenceProviderWireProfileV5` 把 `endpointOrigin`、`operationPath`、`modelsPath` 全部定义成宽 `string`（24816–24826）；条件映射只为 TokenHub 六行、BigModel 两行和 Kimi 三行收窄，随后直接回落到宽接口（24869–24963）。73 行由该返回型派生（25600–25614），所谓 exact wire 静态断言也只核对 BigModel/Kimi 的 URL（26140–26166）。因此 OpenAI、Anthropic、Gemini、Vertex、Azure、Bedrock、OpenCode Zen/Go、Ollama、LM Studio、oMLX、bridge 和 custom 等行都没有一个机器可判的官方 URL/path oracle。
- **真实用户反例**：实现者把 `opencode.go.responses` 配成 Zen 的 `/zen/v1/responses`，而不是 Go 的 `/zen/go/v1/responses`；该对象仍满足 `ReferenceProviderWireProfileV5`，73 行 digest/类型门也没有预期字面量可比较。用户的 Go key 会被发往错误资金域，得到误导性 401/计费结果；更糟时，同类错误会把 secret 发往错误 origin。当前 [OpenCode Go 官方目录](https://dev.opencode.ai/docs/go/) 明确把 Go 与 Zen path 分开。
- **根因修复**：让每条 requirement 引用一份 closed、版本化且签名绑定的 exact wire row；HTTP row 至少固定 method、origin/base semantics、operation path、models path、必需公开 header/query/API version、model/deployment 放置规则和 realm。stdio/control row 使用严格 `not_applicable` 判别分支，不能用任意字符串占位。所有 row 的该对象 digest 进入 requirement、endpoint identity、TCK 和 release binding。
- **机械验收**：对 73 行逐行生成官方 golden request，比较最终 URL、method、公开 header/query 和 auth recipient；交换 Zen/Go、OpenAI/Azure、Gemini/Vertex、Chat/Responses/Messages 任意两行时，在 secret broker read 和网络首字节前失败。测试还须证明不存在回落到 `endpointOrigin:string` 的 GA 行。

### A2. LM Studio/OpenCode Server/LiteLLM 的“可选认证”没有解析成选中后的 custody+wire+credential 分支

- **准确锚点**：三类 profile 都把顶层 `wire` 固定为 `none`，仅在 `challenge.acceptedWireSchemes` 列出 Basic/Bearer（24768–24814）；LM Studio 与 LiteLLM 连 `custody` 都未收窄。OpenCode profile 声称 credential 由 upstream application 持有且 SayDo 禁读（24768–24782），但 recipe 又要求 SayDo secret broker 接收 `server_password`（25199–25209），且没有 username 字段。LM Studio 三行使用零字段、无 auth-challenge step 的 `RECIPE_LOCAL_ZERO_V1`（25050–25061、25670–25672）；只有 Chat 行列了 `auth_optional`，Responses/Messages 连该状态都未要求。发布 TCK 只明确要求 OpenCode password 与 LiteLLM secret 的正负分支，遗漏 LM Studio（29679）。全文不存在把 challenge observation、选中 scheme、custody、字段和最终 request auth 绑定为一个判别联合的 resolution receipt。
- **真实用户反例**：LM Studio 用户开启 “Require Authentication” 后，所有 API 请求都必须带 `Authorization: Bearer <token>`，但 SayDo 的零配置图没有输入或保存 token 的步骤；认证关闭时又不得发送旧 token。[LM Studio 官方认证文档](https://lmstudio.ai/docs/developer/core/authentication) 明确这两个互斥分支。OpenCode 用户设置了自定义 `OPENCODE_SERVER_USERNAME` 时，方案只有 password，无法形成正确 Basic 值；[OpenCode Server 文档](https://dev.opencode.ai/docs/server/) 明确 username 默认 `opencode` 且允许覆盖。LiteLLM 配置 master/virtual key 时同样需要 Bearer，而 profile 仍停在 `wire:none`；[LiteLLM 官方文档](https://docs.litellm.ai/) 给出了受认证 proxy 配置。
- **根因修复**：新增 `ResolvedOptionalServerAuthReceipt` 判别联合，强绑定 endpoint/process generation、权威 challenge/negative evidence、选中 scheme、准确 custody、条件字段、credential principal/version 和最终 auth component。OpenCode Basic 分支含 username（默认值也必须成为显式冻结值）+ password；LM Studio/LiteLLM Bearer 分支含独立 broker field。`none` 分支类型上禁止 credential。
- **机械验收**：OpenCode、LM Studio 三协议、LiteLLM 三协议各跑 required/absent 两类 deterministic fixture；LM Studio auth-on 必须恰好出现一个 token 字段并发 Bearer，auth-off 必须零字段零 Authorization；OpenCode 默认与自定义 username 都产生 byte-exact Basic。把 negative evidence、旧 credential version、另一 endpoint 的 resolution 或 `wire:none` 换挂到认证分支时零 secret read、零 packet。

### A3. 五条 custom journey 继承了不存在的 terminal ordinal，必然不可达或只能伪造通过

- **准确锚点**：`JOURNEY_GRAPH_GUIDED_KEY_V3.terminalStepOrdinal` 为 6（24100–24105）。`JOURNEY_GRAPH_CUSTOM_V3` spread 该图后把 `steps` 改成 ordinal 0–4，却没有覆盖 `terminalStepOrdinal`（24325–24337），因此运行时对象仍是 terminal 6。五条 custom requirement 全部复用该图（25688–25692）。release 又要求 `unreachableOrNonterminalPathCount:0`（23235–23246）和所有账户起点到 terminal（26367、26374）。
- **真实用户反例**：用户依次填写 Base URL、协议、模型和凭据，ordinal 4 的 staged validation 成功后，图仍等待不存在的 ordinal 6；界面无法合法进入 activation，或实现者绕开 graph 强行显示 ready，二者都不符合方案。
- **根因修复**：显式设置 `terminalStepOrdinal:4`，并让 graph constructor 从 closed step tuple 派生 terminal，而不是允许 object spread 继承；构造时验证 terminal 存在、唯一、可达且无后继。
- **机械验收**：枚举五条 custom row 的全部起点/分支，唯一路径终止于 4 并完整进入 post-graph chain；把 terminal 改回 6、删除 ordinal 4 或让 terminal 有后继时，deriver 与 release gate 均非零。

### A4. CC Switch 的零字段 control journey 继承了 OpenCode Server 的密码挑战和不存在的字段

- **准确锚点**：`JOURNEY_GRAPH_EXECUTION_HTTP_V3` 明确包含 `observe-server-auth-challenge` 和 `server_password` 手填 step（24287–24297）。`RECIPE_BRIDGE_V1` spread `RECIPE_EXECUTION_HTTP_V1` 后只清空 `fields`，没有替换 journey graph（25211–25215）；`cc-switch.control` 使用该 recipe（25683），同时又被列为固定具名 GA bridge（28825）。
- **真实用户反例**：检测到 CC Switch Desktop route-control 后，图可进入 `password_required` 分支并要求 `server_password`；但 recipe 字段集为空，UI 既无法从 recipe 生成该输入，也不应把 OpenCode Server 的认证语义展示给 CC Switch 用户。此 row 会在真实 UX 中卡死或出现幽灵密码框。
- **根因修复**：为 CC Switch control 建独立 graph，仅包含 peer/control identity、route/failover inventory、pin/CAS 和 validation；不得继承 OpenCode HTTP auth graph。若未来某一 CC Switch 版本真的暴露认证，按产品+版本另建判别 recipe。
- **机械验收**：`cc-switch.control` 的 graph step kinds 中没有 auth challenge/manual field，生成的字段事件严格为 0；把 `JOURNEY_GRAPH_EXECUTION_HTTP_V3` 或 `server_password` step 注入时，graph/recipe 双射门必须失败。

### A5. recovery resolver 只按状态选规则，导致 Codex/Kimi/OpenCode/普通 CLI 走“本地模型安装、启动、加载模型”处方

- **准确锚点**：外部本地 runtime recovery 图固定为 install runtime → start runtime → load/select local model（24243–24258）。`ReferenceRecoveryResolverRuleForStateV5<S>` 只看状态 `S`，将所有 `not_installed/not_running/...` 统一映射到 `local_runtime_managed_or_external`（25428–25492）；scenario 的 `recoveryGraph` 和 `firstRecoveryStepOrdinal` 又只是宽 graph/number 加自证布尔值（25505–25522）。Codex App Server、Kimi Server/ACP、OpenCode ACP 和 generic CLI 都含 `not_installed`（25678–25682）。
- **真实用户反例**：Codex App Server 未安装时，用户被引导依次“安装本地 runtime”“启动本地 runtime”“打开 model manager 加载模型”，而正确处方应是安装/验证 Codex、选择其真实登录来源并完成 App Server handshake；同样错误会落到 Kimi/OpenCode CLI。即便 deriver把第一步自填为 0，后续路径仍必经本地模型步骤。
- **根因修复**：resolver 改为按 `(requirementKey/product+surface, runtimeState)` 的 closed mapping；本地 inference、managed runtime、stdio execution、HTTP execution、bridge 各有专属 recovery graph，first step 是该状态在该图中的字面量映射。产品安装/登录/启动链接必须来自签名 product pack，不能由通用 step label 猜测。
- **机械验收**：表驱动枚举每个 recovery-required `(requirementKey,state)` 的准确 graph 和 first ordinal；断言四个 execution row 的 `not_installed` 路径从不包含 `load-or-select-model`/`open-model-manager`，而 Ollama/LM Studio/oMLX 的 cold/no-model 路径仍命中本地模型动作。任一 N+1 first ordinal 或跨产品 graph 换挂必须失败。

### A6. OpenCode Go 把互斥的 Zen 余额 fallback “关闭”和“开启”同时设成同一 run 的必证正向后置状态

- **准确锚点**：`overage_disabled` 与 `overage_zen_balance_enabled` 都被分类为 `proves_postcondition`（25306–25308、25376–25378）；Go 的 Chat/Responses/Messages 三行同时把二者列入 `requiredRuntimeStates`（25639–25641）。证据集要求对每个 required state 在同一 `exactRunSubjectDigest` 上形成逐键双射（25568–25588）。正文却正确说明它们应是两个 funding component/决策（28726）。
- **真实用户反例**：用户未开启 “Use balance” 时，达到 Go 限额后应阻断；用户开启时，官方行为是改用 Zen balance 继续付费，两种状态不可能同时为当前账户后置真相。[OpenCode Go 官方文档](https://dev.opencode.ai/docs/go/) 明确这是用户可选择开启的 fallback。按当前 row，诚实 runner 无法通过；若为过门伪造两份 evidence，则 “尽量不新增费用” 可能把已开启的付费 overage 误当关闭。
- **根因修复**：将 Go requirement 派生为互斥 funding variant/run subject：`go_limit_only` 与 `go_plus_zen_balance`；每个 variant 只要求自己的当前状态，并绑定独立 FundingDecision、预算/disclosure、hard stop 和 data/price evidence。产品支持三协议不应复制或混合 funding 决策。
- **机械验收**：三协议各有两个互斥 variant fixture；每个 exact run 恰好一个 overage 状态。关闭分支在额度耗尽时零 Zen 扣费且可进入 no-new-spend；开启分支必须有 Zen component、最坏预算和用户授权。将两个状态放入同一 evidence set、跨 principal 复用或把开启分支标 no-new-spend 时失败。

### A7. 真实账号池的 lease/cleanup 合同没有 lifecycle cursor 或 CAS revision，排他性只能靠自证布尔值

- **准确锚点**：asset 是可重放的 `lifecycleState` 字段（22415–22432）；lease 内仍嵌入 `lifecycleState:"available"` 的旧 asset，仅带无界 `exclusiveLeaseOrdinal:number` 和自证 `provesNoOverlapping...:true`（22436–22461）。allocator 虽接收 `currentPoolRevision`，成功 receipt 不保存 expected/resulting revision、writer epoch 或 available→leased commit（22464–22472）。cleanup 更没有 pool revision/CAS/当前 asset cursor，只接收旧 lease 后声明 resulting state（22476–22502）。cycle 只放 beginning/terminal 两个裸 number 和自证汇总（22597–22613）。
- **真实用户反例**：两个 qualification worker 同时读取同一 available asset/revision，或 worker A cleanup 后旧 lease 被重放；类型上两者都能构造 lease/cleanup。更危险的是 A 的迟到 cleanup 可在 worker B 已租用同一账号后把资产重置为 available，造成并发使用同一 provider account、预算串账、MFA/session/credential 互相撤销。
- **根因修复**：引入 durable、per-asset 状态专属 cursor：`available@rev -> lease_in_flight -> leased@rev+1 -> cleanup_in_flight -> available|quarantined|retired@rev+2`，每条边带 writer lease/epoch、expected/resulting pool+asset revision、single-successor CAS 和 last-lease equality。cleanup terminal 必须与 outer live run、lease、预算和 provider evidence逐字段相等。
- **机械验收**：同一 asset+revision 并发两次 lease 恰有一次成功；旧 available receipt、旧 lease cleanup、双 cleanup、迟到 cleanup、跨 run/realm cleanup 全部失败。对 pass/fail/timeout/cancel/crash 每个 kill-point恢复后，恰有一个权威 terminal，且资产只能处于 available/quarantined/retired 之一；随后两个 live cycle 的 revision 必须连续可遍历。

## B 级发现

### B1. live set-cover 忽略账户起点、principal class 与 MFA mode，真实登录/MFA/admin UX 可从未跑过仍获 GA

- **准确锚点**：live coverage unit 只有 product、realm、auth profile/wire、protocol、funding、可选 platform（22515–22524），算法也明确只按这些维度 set-cover（22530–22547、29623）。账号 asset 虽记录 principal class/MFA（22415–22429），coverage plan 没有要求任何 principal/MFA/account-start variant。全量 `no_account/signed_out/MFA` 只在 hermetic deterministic fixture 展开，真实 live run 明确不跑该笛卡尔积（29620–29624）。
- **真实用户反例**：所有 live run 都可选择已登录、`mfaMode:not_required` 的 service/test account；Google/ChatGPT/企业云某次改了 device login、push MFA 或 admin consent 后，模拟 fixture 仍绿，真实普通用户却在首次接入无法返回或永远等管理员审批。
- **根因修复**：不要求全笛卡尔 live 调用，但把会改变真实交互/认证 wire 的最小维度加入 coverage unit：starting account/auth flow class、principal class、MFA mode、admin-consent variant；每产品声明适用集合和可替代关系，纯 locale/anchor 仍留 deterministic。
- **机械验收**：set-cover oracle 对每个声明的 live auth-interaction variant 至少选一 run；用全 `signed_in_ready + not_required` 账号替换包含 device/MFA/admin 的计划时非零。MFA attendance 必须与所选 variant、run 和 asset 相等，不能仅证明“池中有这种资产”。

### B2. §9 的 L0 多协议公开承诺与唯一 73 行/GA minimum 不是双射，支持页可宣称未被 mandatory TCK 证明的协议

- **准确锚点**：L0 定义包含“完整测试矩阵”（28637–28644）。生态表把 MiniMax 中/国际列为 Chat+Messages、DeepSeek 为 Chat+Anthropic、百炼北京/新加坡为 Chat+Responses+Anthropic、Ark 中国为 Chat+Responses、千帆与百度福利包为 OpenAI+Anthropic（28660–28681）。但固定机器真相中这些入口分别只有一条：MiniMax Chat、DeepSeek Chat、百炼 Chat、Ark Responses、千帆 Chat、福利包 Chat（25643–25666）；73 行 derivation 并不会为表中其余协议产生 run/journey/entry/ecosystem evidence。GA minimum 对这些 realm 也只要求 entry，不要求所列每个协议（28815–28820）。
- **真实用户反例**：支持页按 §9 显示“百炼北京支持 Responses/Anthropic”或“DeepSeek 支持 Anthropic”，而 release verifier 只跑了对应 Chat row仍可绿色；用户按公开 L0 能力选择协议后没有 exact recipe/wire/TCK，最终落到错误兼容层或配置页无选项。
- **根因修复**：建立唯一 `PublishedProductProtocolClaim` 投影：每个 L0 `(product,realm,protocol,auth,funding)` cell 必须引用一条 completed requirement/TCK；未进入 73 行或 owner addition 的 cell 必须降为 inventory/L1/未承诺，不得继续显示 L0 协议。若这些确为 GA 承诺，就逐协议新增 closed requirement row 并更新 count/digest/designation。
- **机械验收**：对支持页、picker、release note 与 matrix 做双向集合相等；每个 L0 protocol cell 恰有一个 pass row，且不存在未发布 row 反向泄漏成 UI 能力。删除 DeepSeek Anthropic/百炼 Responses row或只保留品牌 entry时，发布门必须失败。

## 计数与最终判定

| 级别 | 数量 |
|---|---:|
| A | 7 |
| B | 2 |
| C | 0 |

最终判定：**FAIL**。在 A1–A7、B1–B2 全部形成 closed contract、正反例与机械门禁并重新冻结之前，不应把该方案标为终审通过或开始实施。

## 报告落盘后冻结复核

报告首次落盘后再次独立执行 SHA-256、行数和字节数核对，实测仍为：

- SHA-256：`fcde60a8700dbfc14566d7183a30bf14d0310aa070d628173e23177dd1bda1ab`
- 行数：30,490
- 字节数：1,830,991

三项与指定冻结值完全一致，目标在评审与报告落盘期间未漂移。
