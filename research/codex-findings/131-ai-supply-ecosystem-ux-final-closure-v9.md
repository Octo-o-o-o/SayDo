# AI 供给生态与 UX 最终闭包复核 v9

## 结论摘要

- 唯一 verdict：`FAIL`
- 发现计数：A=3，B=0，C=0。
- 判定依据：本轮规则要求 A=0 且 B=0 才能通过。当前三个 A 分别允许“阻断即通过”、漏算全功能接入的 witness 前置旅程，以及在 reference-grade GA 中排除已声明为 L0 的主流入口。

## 读取完整性与冻结输入

- 唯一评审目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。
- 评审前只读核对：16,355 行，1,025,192 bytes，SHA-256 `ae6175a7195411f6878f4317ef4413f354df0763e3be6a80e7c54fc2c0c6980e`，与冻结输入完全一致。
- 完整读取：按行号从 1 到 16,355 连续读取，无抽样。工具返回发生截断的区间均重新缩小区间补读，直至行号无缺口。
- 评审结束前只读复核：16,355 行，1,025,192 bytes，SHA-256 仍为 `ae6175a7195411f6878f4317ef4413f354df0763e3be6a80e7c54fc2c0c6980e`。
- 未读取源码、AGENTS、旧 prompt/review、journal、索引或其他文件；未跟随目标内链接；未编辑目标。

## 生态旅程矩阵

| 旅程族 | 目标中的处方与边界 | 本轮判断 |
|---|---|---|
| OpenAI、Anthropic、Gemini、OpenRouter、OpenCode Zen/Go | Chat/Responses/Messages/Google GenAI、key/PKCE、BYOK management authority、订阅与按量资金分离均有明确合同 | `[fail]` 单项合同较完整，但 GA 最终 readiness 可被定义为 `blocked` 后仍报 `completed_pass`；见 A-01 |
| 智谱 BigModel、Z.AI、Kimi API/Code、DeepSeek、百炼、方舟、混元、千帆、MiniMax、SiliconFlow | product/realm/key namespace/协议/权益/费用/数据边界大多拆分，Coding Plan 与普通 API 不互借 | `[fail]` 混元、千帆等已声明 L0 的主流入口可合法设为 `requiredForGa:false`，不阻断 reference-grade；见 A-03 |
| Codex、Claude、Kimi、Gemini/Antigravity、OpenCode、Cursor、Grok、Qwen、Copilot | installed/authenticated/entitled/conformant 分层；订阅 rights unknown/forbidden 时不发 prompt，并给 API 或其他来源处方 | `[ok]` 未发现新的订阅误用或凭据复用缺口；仍受 A-01、A-02 的全局发布与首次启用缺口影响 |
| CC Switch、Claude Code Router、LiteLLM、OpenRouter BYOK、企业 gateway、custom Base URL | bridge 与 provider 分离；route/failover、Chat/Responses/Messages、public/secret header、proxy/mTLS、unknown metering 均有有界路径 | `[ok]` 不要求猜 URL/协议/header/计量；仍受 A-01、A-02 的全局门影响 |
| Ollama Cloud、LM Studio Link、oMLX、vLLM、SGLang、llama.cpp、LocalAI、Docker Model Runner、Podman AI Lab、Foundry Local、Apple Foundation Models、LAN 算力 | local/cloud/LAN compute 分开；冷态、停止、端口冲突、preload、owned capacity 和长尾分级均有处方 | `[fail]` macOS fresh/offline 的全功能路径强制先过远程 witness，但该前置动作未计入 local/provider GA 旅程；见 A-02 |
| Bedrock、Google Vertex、Azure OpenAI/Foundry | API key、static profile、role/SSO、ADC/WIF、Entra user/service principal/managed identity 分别建模，不走无界 default chain | `[ok]` 多账号、region、身份、proxy/mTLS 与离开返回边界明确；仍受 A-01、A-02 的全局门影响 |
| 被动发现、主动发现与 publisher 公平 | static/passive-loopback/explicit-active 分层，默认零 LAN 扫描；固定 probe capability、peer admission、host/publisher 配额和 WDRR | `[ok]` 未发现会要求用户猜端口或允许单 publisher 饿死核心 detector 的新缺口 |
| provider-first、唯一主动作、登录/MFA/恢复、双 locale/a11y | 字段按来源收窄；每状态一个 `primaryAction`；外部任务、MFA、copy/paste、leave-return、错误循环及 `zh-CN/en-US`/`en-XA` 被计量 | `[fail]` witness 被做成独立 entry，而非 provider 首次旅程的组成部分，点击和用时承诺可被低报；见 A-02 |
| inventory/install/login/rights/conformance/readiness/费用/数据 | 内部发现四级、四条证据轴、Connection/Solution readiness、Billing/DataBoundary 分开 | `[ok]` 维度本身没有再次合并；问题在于 GA 对 readiness 和覆盖集合的资格约束不足，见 A-01、A-03 |

## A 级发现

### A-01 `completed_pass` 可把核心旅程的最终状态定义成 `blocked`

- 精确位置：目标 L13587-L13588 定义 `blocked` 属于两种 readiness；L13674-L13688 允许任意 `ConnectionReadiness`/`SolutionReadiness` 作为 journey 的 expected 值；L14049-L14068 的 `GaJourneyPassPayloadV2` 对两套 readiness 的全部成员做笛卡尔映射；L14136-L14155 的 run gate再次接受同样的全部组合；L14227-L14242 与 L14264-L14282 只要求集合、maturity/tier和 expected/actual 精确相等。L14451 声称“blocked不能自报pass”，但前述合同没有表达该限制。L15660-L15665 还允许 `advanced` 以 `action_required`/beta 结束。
- 具体旅程与最短反例：把固定 required entry `global.openai.responses.api-key` 的 journey 定义为 `journeyTier="advanced"`、`expectedConnectionReadiness="blocked"`、`expectedSolutionReadiness="blocked"`；运行结果也填两个 `blocked`，`outcome="completed_pass"`、`exitCode=0`。这正好命中 `GaJourneyPassPayloadV2` 和 run gate；entry/ecosystem gate只看到“expected与actual完全相等”，因此 reference-grade GA 可通过，但普通 OpenAI 用户仍不能建立连接或开始对话。
- 现有门为何挡不住：readiness equality 只防止“期望 ready、实际 blocked”被冒充成功，不能防止发布者一开始就把 required journey 的期望写成 blocked/action_required。`proves...EligibleAndExact: true` 是结论字段，未提供一个把 required journey terminal tuple 限定为可用状态的判别联合。负面/恢复 fixture 和用户可用终态也没有分开。
- 根因级修法：为 `requiredForGa:true` 增加不可宽化的 `GaEligibleTerminalReadiness`。Inference required journey 的 pass 至少必须为 `connected_verified + conversation_ready|review_ready`；Execution/control journey应分别冻结其可用终态，不能复用通用 blocked/action_required tuple。`advanced`、最终 blocked/action_required 只能作为非 required entry，或作为一个成功 journey 内的负面/恢复 fixture，不能生成 release-eligible pass。为三层 gate增加 required entry expected=blocked、expected=action_required、advanced-required 的 mutation fixture并要求非零。

### A-02 强制 witness 是全功能接入前置，却未并入 provider/local 的首次旅程指标

- 精确位置：目标 L3351-L3376 规定 macOS arm64 唯一合格持久 backend 是 `remote_transparency_witness`，且全功能模式必须有合格 backend；L3914-L3930 把未登记、披露、注册、离线/代理恢复、ready继续配置拆成多个有主动作的 UI 状态；L13598-L13612 的 provider journey subject不含 anchor前置状态；L13614-L13622 的 `startingAccountState` 也没有 `anchor_not_enrolled/ready`；L13809 与 L13848-L13855 将 witness 仅作为独立 entry/独立旅程。与此同时，L57、L14459、L15406、L15638-L15640 对首次 local/subscription/payg 给出全局 1/2/3 个 SayDo 动作上限。L14442-L14443 则确认没有持久 backend 时只能使用 boot-scoped、匿名、本机 `plain_dialog`，登录、API、工具和 fallback均不可用。
- 具体旅程与最短反例：fresh macOS 用户已有 OpenAI key。为进入 OpenAI 全功能配置，他先要从 `not_enrolled` 进入 witness review，再完成数据/网络披露和登记，ready 后还要“继续完整配置”；随后才进入 key、conformance 费用、runtime 预算的最多三动作旅程。GA 可以分别让 `control.anchor-witness` 和 OpenAI provider journey通过，并让 OpenAI run从“witness已ready”开始，因此两份报告都绿，但新用户实际总动作、离开返回、代理失败和总耗时超过对外承诺。fresh offline Ollama 用户虽能临时 plain dialog，重启后还要重走，且工具、登录与持久配置仍不可达。
- 现有门为何挡不住：run subject和 UX metrics没有可组合的 prerequisite closure；`startingAccountState` 只描述 provider/account/local-service，不描述 SayDo 的 anchor状态。exact Cartesian run、copy/paste/leave-return 和 separate witness journey都只能证明各段各自完整，不能证明端到端首次启用的总动作与总时长。独立 entry 正是可以低报总旅程的切缝。
- 根因级修法：给每个非 boot-scoped journey增加签名的 `requiredControlPlanePrerequisiteSet` 和 `startingAnchorState`，并定义组合计量算法。fresh-install GA run必须从真实 `anchor_not_enrolled` 起步，在同一 event inventory 中累计 witness disclosure/enrollment/recovery与 provider/local后续动作、copy/paste、leave-return、raw/app time；单独 witness evidence不得替代组合门。若产品不准备在总计下满足 1/2/3 动作，就把所有动作上限明确收窄为“strong anchor 已ready之后”，并新增首页在计步前披露该前置条件的验收。macOS online/offline、全球/中国 realm、企业 proxy和 continuity loss都要有组合 journey。

### A-03 reference-grade 允许已声明为 L0 的主流入口完全不参与 GA

- 精确位置：目标 L13712-L13725 明确允许 `requiredForGa:false` 与 `ecosystemTier:"L0"` 同时存在；L13774-L13814 的固定具名集合不含腾讯混元、百度千帆等条目；L13863-L13866 的中国大陆 category只要求五个完成项，L13917-L13925 又允许一个 additional China slot。L14812-L14820 将混元普通 API、千帆普通 API及多个其他中国入口明确标为 L0；L15155 将混元、千帆列入 Phase 3 正式子批；L15498 声称 GA 时 L0 清单全过，但这条文字没有进入 required-entry集合规则。
- 具体旅程与最短反例：matrix 中保留 `腾讯混元普通 API` 和 `百度千帆普通 API` 两个 L0 entry，但设置 `requiredForGa:false`。中国 category 用智谱、Kimi、DeepSeek、百炼北京及一个允许的附加入口满足五项；固定具名集合、category minimum、逐 run exact set均可通过。发布仍可保留 reference-grade/GA designation，而只持有混元或千帆的普通用户没有受 GA 约束的 provider-first journey、恢复报告或 readiness 证据。
- 现有门为何挡不住：non-required 分支只声明它不能用于补 fixed/minimum，却没有要求“所有 L0 必须 required”。支持清单和 Phase 3 子批是文字/registry内容，ecosystem gate只对 baseline选中的 expected set做 exact equality；所以“精确”只证明一个可被缩小的集合内部无遗漏。owner调整具体产品和 category minimum也不能替代产品级主流覆盖。
- 根因级修法：在 reference profile与matrix refinement中加入 `ecosystemTier="L0" => requiredForGa:true`，并让 required entry set由冻结 matrix 的全部 L0 product-realm-auth keys确定性派生；或者把确实不承诺 GA 的入口降为 L1/inventory并同步移除“L0全过”措辞。至少把混元、千帆及所有§9中声明为 L0的 realm/product加入不可替换具名集合；owner只能增加要求，不能把这些主流 entry移出。增加“任一 L0翻为required=false仍保持其他category满足”的mutation，release verifier必须非零。

## B/C 级

- B=0：其余被点名的 API、CLI/订阅、bridge/custom、local/LAN、cloud multi-auth、离线提示、双 locale/a11y与安全发现均已有足够具体且有界的拟议处方；没有把与上述 A 同根因的表现重复计数为 B。
- C=0：未记录纯非阻断项。

