# SayDo 当前实施与 AI 普适上手对账报告

> 日期：2026-08-31
> task：project-status-ai-onboarding；stage：read-only-readback；cycle：owner-request-20260831
> task_mode=review_only；review_scope=step；review_ordinal=1；本 cycle repair=0 / rereview=0
> 分支：codex/project-gap-plans-20260828
> candidate HEAD：79211f6fec5c6eb092419c1871e35d8eedc4e3e5
> git-diff-v1：e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727
> 取证前及测试后工作树 clean；manifest 绑定报告写入前的产品候选，不包含本报告这一评估产物。
> 基线：当前完整树的状态核对，非某个新产品 diff 的合入评审；merge-base 不适用。
> 当前排产：docs/plan/IMPLEMENTATION-PLAN-2.md；缺口来源：docs/plan/2026-08-28-project-gap-closure-program.md。
> V2：legacy/defaulted-to-v2。当前 PG-01A 尚未开工，没有现役 IMPL-PROMPT；docs/plan/README.md:48–51 明确旧 prompt 仅作历史。没有重开或重置 PG-00 的评审预算。
> 本报告延续现有 G-A / G-B 编号，不另造治理方案；只更新截至本轮的状态判断，不推翻历史批次在其原范围内的结论。

## 1. 结论

**当前有较完整的开发者 RC 基础，但尚不能承诺“不同用户拿自己已有的任意本地/云端、订阅/API 服务，都能快速开始并走完 SayDo”。**

主要差距不是再列几个厂商名字，而是四件事没有一起闭环：

1. AI 供给身份与保存：多家 API 的 key 引用会合并覆盖，同一主机不同端口的本地服务也会合并。
2. 能力范围：七种 CLI 的推理接入，不等于七种受控执行器；API 兼容不等于完整工具/结构化输出能力；本地 LLM 不等于全本地语音。
3. 用户旅程：默认新界面仍有未接动作，直达验收语音确认明确拒绝，发布包不含语音 pipeline。
4. 验收与安全：当前完整本地基线有一个失败，真实账号/麦克风/设备验收未闭环，远程凭据、审计明文与数据库升级还有已规划但未实施的收紧。

本轮十个验收面统计：5 项部分具备、3 项阻塞、2 项待验或未开工；这是“面向用户可验证的完整路径”统计，不是代码完成百分比。隔离诊断共 9 项：8 个缺口得到复现、1 项仅观察请求协议；没有读取真实 AI 凭据或调用真实模型。

Verdict：RED，仅针对当前普适上手/全面验收就绪度；不是重审 PG-00 文档导入，也不是否认既有代码积累。

## 2. 当前实际坐标与实施台账

### 2.1 最近变化主要是排产，不是这些缺口已经修好

本会话 git log -3 的真实输出：

~~~text
79211f6fec5c6eb092419c1871e35d8eedc4e3e5 2026-08-29 chore(evidence): 记录 PG-00 排产导入证据
9cfbfe8a3ac98aa4124636ed415cbe78760ff80b 2026-08-29 docs(plan): 导入 PG-00 排产与授权
280b0cfa1594a8963bed2a4b730734915a3762b0 2026-08-27 chore(evidence): 随 mobile contract 动态化修复重生成账本
~~~

最近 PG-00 是两条本地文档/证据提交。PLAN-2:8–20 和 HANDOFF.md:49 的当前指针均为 active=none、next=PG-01A，未开工。D17 的原始授权仅覆盖 PG-00 导入，明确不授权产品代码、部署、真实账号调用或付费；见 owner 决策单:35–62。本轮“阅读与评估”的请求也没有扩大这些权限。

### 2.2 常驻运行版与当前树不同

本会话只读查询常驻 runtime 的 git log，并仅读取 /health、/readyz 的健康字段：

~~~text
runtime git HEAD: 6d98a6eeec68b0cfe940c212dd80061f05288426
runtime commit date: 2026-08-22T22:21:35+08:00
/health: HTTP 200, ok=true
/readyz: HTTP 200, coreReady=true, voiceReady=true, pipelineConnected=true
daemonRuntimeSha = pipelineRuntimeSha = 6d98a6eeec68b0cfe940c212dd80061f05288426
asr=ok, tts=ok
~~~

这证明当时旧运行版健康，不证明当前 candidate 已部署、最新 Claude 执行器接线已进入常驻版，也不等于本轮进行了真人语音测试。没有重启或改动常驻服务。

### 2.3 按完整使用路径核对

| ID | 验收面 | 状态 | 当前证据与剩余边界 |
|---|---|---|---|
| R1 | 不克隆源码启动 daemon + console | [partial] | packages/cli/README.md:3–22 有 rc.12 安装入口；CLI 本轮 49 tests passed。需要 Node 22；本轮未下载发布物重装、未跑分发验证。 |
| R2 | 四个推理槽位使用 CLI / API | [partial] | contracts/src/types/modelbinding.ts:10–44 登记七种 CLI；daemon/src/providers/slotResolvers.ts 有实际 resolver/self-test 登记约束。不是只写在清单里，但本轮没跑七家真实账号联通。 |
| R3 | 有门禁的开发任务执行 | [partial] | daemon/src/tier1/backends/types.ts:5 的实现子集为 cursor、claude_code。W5.4-b 已有配置、自检、执行与 UI 代码；真实 hooks/live conformance 仍待 W5.4-c，且本轮相关大文件有一条失败。 |
| R4 | 完整语音使用 | [partial] | 现有常驻版 readyz 声称 ASR/TTS 健康；pipeline/src/saydo_pipeline/__main__.py:82–86 只装配豆包/火山 ASR/TTS；分发包不带 pipeline，真人场次未闭环。 |
| R5 | 默认界面到实际动作 | [partial] | console 本轮 279 tests passed；但 App.tsx:80–88 默认使用 redesign 页面，FocusPageRoute.tsx:77–106 多个动作仍占位。 |
| R6 | 隐私、远程与升级安全 | [blocked] | 下文 G-A5/A6/A8/A9 的源码证据；未来版本数据库和审计明文均在合成 fixture 复现。 |
| R7 | 混合厂商、本地模型、单订阅快速接入 | [blocked] | key/endpoint 冲突及费用来源误判已复现；无 key 本地入口与未知模型家族尚不普适。 |
| R8 | 当前候选完整质量门 | [blocked] | just ci exit=1；单例重跑通过，不能将整套门禁翻绿。Python 单独补跑通过；其余 fail-fast 后续门未运行。 |
| R9 | owner 四场真实验收 | [pending] | session-1.md:54–59 为 failed；session-2.md:78–80、session-3.md:54–58、session-4.md:85 为 not_run。 |
| R10 | 当前缺口治理链 | [pending] | PG-01A 至 PG-06 共七批只是导入排产，尚未开工；普适接入完整草案仍 deferred。 |

源码表中的短路径分别位于 packages/contracts、packages/daemon、packages/console；后文使用完整仓内路径。

## 3. 各类 AI 用户现在能走到哪里

“有实现路径”只表示代码接了线，不表示已经用该用户真实账号完成端到端验收。

| 用户现有资源 | 当前可用路径 | 快速完整使用的障碍 |
|---|---|---|
| 已登录 Codex、Claude Code、Cursor、Grok、Gemini、Qwen、Copilot CLI | 七种均有推理槽 provider；不是仅 inventory | 需要 CLI 安装、身份自检登记、模型确认；CLI 对话为 oneshot；evaluator 有家族与本机读取隔离确认。不能据此认为任意一家的订阅都能完成受控开发任务。 |
| 只有一个聊天网站/App 订阅，没有可用 CLI 登录 | 没有“把任意网页订阅一键兑换通用 API”的入口 | 必须确认该服务本身允许且提供对应调用方式；网页登录、CLI 登录、API billing 是不同事实。不能收集网页登录 cookie 来补入口。 |
| 一个 OpenAI-compatible API key | 现有 /chat/completions adapter 可供四槽使用 | 需 endpoint、key、model、可识别的实际模型；单一账号仍不自动提供开发执行器、语音服务。仅 API 连通不足以证明工具循环与结构化输出可用。 |
| 多家云 API 混用，或云端 + 本地混用 | UI 允许逐槽选择 | [blocked] 多个非 OpenAI/Anthropic 端点共用 OPENROUTER_API_KEY；后保存的 key 覆盖前者，存在鉴权失败与发错凭据目标风险。 |
| Ollama、LM Studio 等本地服务 | 可尝试通过 OpenAI-compatible HTTP 端点接入 | 无 key 场景仍被配置/运行时拒绝；本地不同端口的端点名冲突；模型家族需可识别；没有本轮真实硬件、模型能力、延迟或离线验证。 |
| GLM 或任意自定义模型别名 | 可以输入 model 字符串，但不保证响应被接受 | glm-4.5 返回会触发 observed_model_family_unresolved；即使预设 family=glm 也不能绕过响应层词表。这是明确拒绝，不应通过伪造模型名绕过。 |
| Anthropic API | 官方现有 OpenAI 兼容层，可作为有限兼容路径；本项目仍只走通用 adapter | 不能再按旧代码注释断言“Anthropic API 一定不通”。其 response_format 被忽略，部分工具约束不保证；未验证 SayDo 的四槽完整合同，原生 Messages/额外 workspace 头也没有独立适配。 |
| Gemini 等提供 OpenAI 兼容端点的服务 | 兼容形态有机会走已有 adapter | 仍受 key 映射、model identity 与能力约束；不能把兼容端点等同于该厂商所有原生 API。 |
| Bedrock / Vertex / 企业 IAM、专有原生协议 | 当前 NamedApiProvider 仅 base_url、env key、family、provider_order | 没有通用原生签名、云身份、header 协议模型；本轮未测，不能声明开箱即用。网关兼容是另一条需单独验证的路径。 |
| Kimi / OpenCode / Pi / Aider 等其他 CLI，ACP 服务 | 部分有发现清单；ACP 在 schema 中存在 | WIRED_CLI_PROVIDERS 不含这些 CLI；ACP 仍被 P0 validator 拒绝。被发现不等于可选并可执行。 |
| 没有云账号、希望全部本地且离线 | daemon/console 本地运行，LLM 兼容接入只是可能的组成部分 | 当前语音实现依赖豆包/火山凭据；发布包没有 pipeline。不能承诺全本地完整语音项目。 |

四槽 resolver 的约束见 packages/daemon/src/providers/slotResolvers.ts:228–245、336–355；dev 执行器子集见 packages/daemon/src/tier1/backends/types.ts:5。不能把四槽变绿当成 dev 就绪，也不能为“快”跳过 Gate 0。

### 3.1 需要刷新而非沿用的厂商判断

- Codex 官方区分 ChatGPT 登录与 API key；API key 使用 OpenAI Platform 计费，不是消耗 ChatGPT 套餐内额度。当前代码的 logged_in => subscription 推断不足以区分二者。[OpenAI 认证文档](https://learn.chatgpt.com/docs/auth)
- Claude Code 官方当前允许终端用户在未修改的 Claude Code 中以自己的订阅登录，并对产品承载方式提出条件；同时限制第三方代持 Claude.ai 凭据、代用户转发订阅请求。应按具体形态核对，不一概否定，也不能宣称订阅可以作为任意第三方通用 key。分发版选择仍应回到已有 AI 决策 4。[Claude Code 条款与认证说明](https://code.claude.com/docs/en/legal-and-compliance)
- Anthropic 官方已有 OpenAI SDK 兼容层，但将它定位为能力比较/测试用途，并列明 response_format 被忽略、strict 工具参数不保证等限制。因此本轮只证明 SayDo 会发 Chat Completions + Bearer + json_schema，没有用 fake 404 冒充真实服务不支持。[Anthropic 兼容层](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk)
- Ollama 官方本地兼容示例中的 apiKey 可被服务忽略。本项目仍要求非空 key，是 SayDo 的接入建模缺口，不能据此声称本地模型本身需要购买 API key。[Ollama 兼容说明](https://docs.ollama.com/api/openai-compatibility)

以上官方页在 2026-08-31 实际打开核对；没有使用旧搜索摘要替代当前正文，也没有据这些文档推定任何真实账号额度、合规批准或费用为零。

## 4. 优先修复的工程阻塞

下列沿用既有 G-A 编号。它们属于当前就绪度 blocker，不表示 owner 已授权本轮修复。

### G-A7 / P1：端点、凭据和费用来源未形成可靠的一一对应

- packages/console/src/lib/setupApi.ts:1339–1343 把 OpenAI、Anthropic 之外的端点统一映射至 OPENROUTER_API_KEY。
- 同文件:1385–1389 以 via 保存端点、以 env 名保存 secret；Map 的后值覆盖前值。合成 DeepSeek + Moonshot 两槽只产生一次 secret 写入，两个端点都引用同一个 key。
- 同文件:147–166 只以 hostname 构造 via，丢失 port/path；localhost:11434 与 localhost:1234 被序列化成同一个端点，后值获胜。
- 同文件:1347–1359 的既存 key 复用白名单不含 DeepSeek；resourcePlans 提供的“已有 DEEPSEEK_API_KEY”方案却无法 ready。
- packages/daemon/src/config/cliCapability.ts:599–641 的 Codex logged_in 路径没有区分 API key；合成“Logged in using an API key”被归为 subscription。

这不仅影响易用性：后续请求可能携带另一个厂商的凭据，费用性质也可能被误报。应先在 PG-06 的 admission/identity 范围内明确 endpoint identity、credential binding 和 funding=unknown 的边界，再开放组合实测。

### G-A8 / P1：首次发现仍会自动执行 CLI 探测

packages/console/src/components/SetupWizard.tsx:1096–1115 的挂载/重探测流程调用 fetchCliCapabilities；daemon 对应探测实现 packages/daemon/src/config/cliCapability.ts:1098–1138 会解析 binary、调用 auth/models 命令，并读取相关本机配置。发现清单不是纯静态清单。PLAN-2:119–129 已规划 static inventory 与自动 probe hard-disable，但尚未实施。

本轮没有打开会自动探测真实 CLI 的首次配置页；隔离复现仅调用纯函数及内存 fake，不消费真实登录态。

### G-A3 / P1：默认界面的动作与实际能力不一致

- packages/console/src/App.tsx:80–88 将 Focus/Review/Records 路由到 redesign。
- FocusPageRoute.tsx:77–106 的 step/retry/决策包/采访/fork 等仍有占位或仅打开 modal/toast，不能以页面可见认定业务写口已接。
- RecordsPageRoute.tsx:70–82 将 abandon 发往 archive。
- packages/console/src/hooks/redesign/mappers.ts:275–277 将预算占位为 spent=0/max=0，未知不应展示为真实零。
- packages/daemon/src/brain/liveTools.ts:983–988 对 direct_to_review 语音确认返回 direct_mode_not_wired，属于有意 fail-closed，不应移除保护来过测试。

因此应先执行 PG-01B 的入口收紧，再用 PG-02 建立动作可达性与支持真相；不要让 owner 逐个点击已知占位按钮来替代工程验收。

### G-A6 / P1：远程入口的凭据边界尚未收紧

packages/daemon/src/net/capToken.ts:11–21 复用持久 token；net/pairUrl.ts:25–34 把它置于 HTTP 配对 URL；packages/console/src/lib/api.ts:20–26 存入 localStorage，:48–50 继续以 ws + query token 建连接。这不是按设备、短时、可撤销会话的完整远程信任方案。

只读源码足以确认这些形态；没有访问真实 token 文件，也没有创建配对链接。手机业务测试应等待 PG-01B 收紧及相关远程边界决策，当前不建议把敏感业务数据作为测试材料。

### G-A9 / P1：审计仍可落模型/用户明文

packages/daemon/src/storage/dao/misc.ts:83–100 对任意 meta 直接 JSON.stringify；live/dialog.ts:1015–1021 真实调用将模型句子片段写入 audit 与 logger。隔离 SQLite fixture 中，合成 text 原样进入 audit_log.meta_json。

PG-04 的任务是先停止新增不安全明文；历史行、备份和副本不能因本次评估而删除或重写。

### G-A5 / P1：未来版本数据库没有拒绝，备份入口还会先迁移

packages/daemon/src/storage/db.ts:11–24 打开即修改 PRAGMA 并迁移；:39–45 只找未应用 migration，没有拒绝未知更高版本。合成数据库记录版本 1031，而当前 migration 最大值 31，openDb 仍接受。

packages/daemon/src/backup/cli.ts:21 在快照前调用 openDb，不能当成纯只读备份入口。没有对生产数据库执行此验证，也没有运行 just backup。应按 PG-05 完成兼容性检查与迁移前可恢复点，再安排 owner 的真实升级/回退测试。

### G-A2 / 验收阻塞：当前完整本地基线不是绿灯

just ci exit=1；失败发生于 tier1-executor.test.ts:6404，详见门禁证据。单例重跑通过，仅支持“可能是时序/隔离敏感问题”的推断，尚不能判定根因，也不能据此宣布稳定性通过。

此外 justfile 的本地入口不等于分发、浏览器、远端 CI、真实设备和 live gate 全部通过；PG-03 正在计划解决这种证据覆盖差异，本轮没有把历史绿灯借给当前候选。

## 5. 不是本轮立即扩建的范围缺口

当前总案已经登记 G-A1/G-A4 的 corpus/对外承诺问题。PLAN-2:47–57 要先把 986 个 source 引用按 unresolved/有限范围降级，而不是宣称都有真实 connector。该数字来自现有计划登记；本轮没有重新执行全部 corpus mutation 或真实 source 读取。

现有 G-B3/B4/B5/B7/B8/B12/B13 仍分别覆盖备份范围、新手心智负担、非开发者价值、locale/无障碍、长期恢复、完整打包、真实环境证据。这里只链接原缺口，不做第二份台账或最终 P2 sweep。

尤其应区分：

- docs/plan/ai-supply-contracts-draft 是类型草案，docs/plan/README.md:35–37 明确不参与构建、不属生产合同；严格 typecheck 不是普适接入已经实施的证明。
- PG-01A 至 PG-06 是先收紧风险与对外承诺，不会自动带来全本地语音、全厂商 adapter、普通人无指导安装、全平台常驻服务。
- 普通用户首个任务、connector、桌面易用性与语音完整打包属于后续有条件范围。不能在“修完 core”后不经选择就扩大承诺。

## 6. 需要 owner 亲自验证的部分

### 6.1 先统一“到底在测哪一个版本”

正式发布验收前由工程线准备一个明确候选，并经 owner 允许后部署；记录同一个 runtime SHA、有效配置 digest、执行 CLI 版本/模型身份、语音服务配置。不复制真实 key 到报告。

现有 owner-sessions 合同要求四场绑定相同 runtime/config；其中任何变化都会使原场次不再构成该候选的发布证据。目前常驻旧版可以做体验预演，但不能算最新 candidate 的正式验收。本轮没有代做部署，也没有读取真实有效配置/凭据来代 owner 决定基线。

### 6.2 真正需要人的测试清单

| 场次 / 面 | 你需要验证什么 | 工程前置与通过证据 |
|---|---|---|
| 场次 1：真麦与对话体感 | 耳机 + PTT；项目只锚定一次；2–3 轮采访；播报中插话；挂起约一分钟再续聊；中文夹英文术语；误听后纠正 | session-1.md 仍 failed。检查“未听完不算已听”、不重复问已答信息；分别记录 ASR final 与整体回应耗时。历史 12.79 秒是旧记录，不能当当前性能。 |
| 场次 2：一个真实小开发任务 | 用隔离小仓，提出改动、回答关键问题、逐步确认、离开后接回叫，再选择验收通过/修改/拒绝 | 先有相应版本完整门禁、注册且钉定的真实 Cursor/Claude 执行器与可控预算；真实 hooks/conformance 必须留证，不以 fake 代替。 |
| 场次 2 的 S3 屏幕卡 | 实际 Touch ID/passkey；拒绝/取消；未注册 passkey 时的人工路径；语音不能放行 S3 | 两条路径分别留证。不得因方便而跳过 Gate 0、签名绑定或自动合并保护；本轮不操作真实合并。 |
| 场次 3：一个真实写作任务 | 选一篇文章，从聊题到生成、逐节修改/裁决、artifact 引用与最终留档；顺带检查页面显示是否与实际结果一致 | 写作功能有代码，但首篇 owner 全链记录仍 not_run。至少记录实际模型、输入材料、产物和逐节结论；延迟样本按既有场次要求采集。 |
| 干净环境首次上手 | 让未预配 SayDo 的人，分别拿一种订阅 CLI、一个云 API、一个本地兼容服务开始；再测试一种混合配置 | 先修 key/endpoint 冲突和选中范围的入口缺口。记录从启动到首个有用结果的步骤、卡点、额外账号/费用要求；单一开发机已有七家 CLI 的成功不能替代新用户。 |
| 手机、远程与跨平台 | 真机通知、回到任务、断网/重连、后台恢复；Windows/Linux/macOS 的安装与退出行为 | 不现在拿敏感业务强测远程。先落实 G-A6 的入口收紧、选定 D6/D18 等相关边界；平台升级/回退另等 PG-05 的数据安全前置。 |

这些测试不需要一次全部做完，也不需要购买七家订阅。最有价值的是先选“你真实打算支持的资源组合”，避免继续累积只在作者开发机上成立的证据。

### 6.3 场次 4 不应照旧清单硬跑

session-4.md:1–12、43–50 仍要求真实 Hopper + runner、直达验收档语音念清单。当前 liveTools 明确返回 direct_mode_not_wired，而新排产默认选择隐藏这条入口，不是补齐它。

因此先由 owner 决定：本次仅验证逐步确认的 Developer Preview，还是另行授权完整直达档/bridge 范围。选择前，不能通过改记录把旧场次判 pass，也不能让你花一小时现场撞已知阻断。当前四场旧合同与新的缩窄发布范围需要明确处置。

### 6.4 AI 资源实测的最小覆盖矩阵

建议作为后续验收输入，而非本轮已经批准的扩建合同：

1. 一种已有订阅 CLI：认证方式准确、实际模型可追溯，首个对话与对应执行任务分别验证。
2. 一个云 API：首个工具调用、结构化结果、计费来源与余额/限流错误清楚。
3. 一个本地兼容服务：无真实云 key 的引导、模型身份、工具能力、冷启动与连续对话；确认是否真的没有出网。
4. 一种混合：本地 dialog + 云 evaluator，或两家 API；换槽位不能覆写另一家的 key。
5. 一次恢复场景：登录过期、429、端点离线、模型切换；停在哪里、是否换服务、是否额外付费必须明确，不能静默外发或降为另一种权益。

“安装十分钟内到首个有用结果”等时间目标可以作为你选择的新目标，但现有证据不足以承诺；不要把建议阈值写成已经达标。

## 7. 本轮真实门禁与复现证据

### 7.1 执行方式与边界

环境：Node v22.23.1、pnpm 10.33.1、uv 0.11.7。测试使用独立 TMPDIR=/tmp/sd-rb.2d9iDB，关闭 SAYDO_LIVE_E2E 与 SAYDO_SLOW_E2E；避免测试清理逻辑触及既有临时 fixture。

长测试按 external-cli-orchestrator 使用单个工具层等待程序，硬超时 1200 秒；没有语义子会话、轮询日志或真实模型调用。日志从本轮临时目录移到 logs/2026-08-31-project-status-ai-onboarding/，原 summary 内的临时路径保留作来源。

实际测试入口：

~~~sh
env -u SAYDO_LIVE_E2E -u SAYDO_SLOW_E2E TMPDIR=/tmp/sd-rb.2d9iDB just ci
env -u SAYDO_LIVE_E2E -u SAYDO_SLOW_E2E TMPDIR=/tmp/sd-rb.2d9iDB pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts -t ownershipEstablished
env TMPDIR=/tmp/sd-rb.2d9iDB just ci-python
~~~

隔离诊断调用入口为 pnpm --filter @saydo/daemon exec tsx 加本报告同名日志目录下 hermetic-readback.mts 的绝对路径；脚本只使用内存 fetch fake 和新建的合成 SQLite，不读生产凭据、数据库或真实用户项目。

### 7.2 结果

| 检查 | 真实结果 | 不能外推的范围 |
|---|---|---|
| pnpm typecheck，作为 just ci 第一步 | 五个有 typecheck script 的包均 tsc --noEmit 并输出 Done | 按各包 tsconfig 覆盖 contracts/platform/cli/daemon 与 console；不等于独立草案、mobile、所有发布平台都被检查。 |
| pnpm lint，作为 just ci 第二步 | eslint packages 后正常进入 pnpm test | 不是其他全部文档/发布门。 |
| contracts | 11 files / 111 passed | 契约测试不是所有真实 provider 合同。 |
| platform | 7 files / 72 passed / 14 skipped | 不能由 macOS 本机结果推定 Windows/Linux 真机通过。 |
| console | 33 files / 279 passed | 没有重跑浏览器 E2E，也不能证明占位动作已接线。 |
| cli | 4 files / 49 passed / 1 skipped | 未重新安装公开 tarball。 |
| daemon | 1 failed / 130 passed / 2 skipped files；2176 passed / 1 failed / 6 skipped tests | 本轮完整基线失败。 |
| ownershipEstablished 单例诊断 | 1 passed / 154 skipped，exit=0 | 只重跑一个测试，未跑完整文件或完整 CI 第二轮。 |
| just ci-python 单独补跑 | ruff: All checks passed；pytest: 34 passed in 0.28s；exit=0 | 不抹去 just ci 的失败。 |
| 隔离 readback | exit=0，8 个缺口成功复现 + 1 项协议观察 | 这是“证明缺口存在”的绿，不是产品可用性绿。 |

完整入口真实失败摘录：

~~~text
FAIL test/tier1-executor.test.ts > executor ownership / recover abort 行为回归 > ownershipEstablished 必须在 durable owner 写完之后
AssertionError: expected false to be true // Object.is equality
test/tier1-executor.test.ts:6404:85
expect(existsSync(join(saydoHome, "tier1", "runs", runId, "agent-owner.json"))).toBe(true);
Test Files 1 failed | 130 passed | 2 skipped (133)
Tests 1 failed | 2176 passed | 6 skipped (2183)
error: recipe ci-node failed on line 14 with exit code 1
~~~

just ci 耗时 109.347 秒、退出 1。该失败发生在 pnpm test，后面的 emoji/color/migration/release/mobile 等 ci-node 子门没有随完整入口执行；Python 已独立补跑。时序敏感只是基于“整套失败、单例通过”的假设，本轮没有改测试、修代码、删除断言或确认根因。

隔离诊断关键输出：

~~~json
{"id":"AI-MULTI-KEY","status":"gap_reproduced","endpoint_names":["deepseek","moonshot"],"secret_refs":["env:OPENROUTER_API_KEY","env:OPENROUTER_API_KEY"],"secret_write_count":1,"first_key_overwritten":true,"external_requests":0}
{"id":"AI-LOCAL-PORT-COLLISION","status":"gap_reproduced","distinct_ports":2,"serialized_endpoint_count":1,"external_requests":0}
{"id":"AI-FUNDING-INFERENCE","status":"gap_reproduced","synthetic_auth_kind":"API key","inferred_provenance":"subscription"}
{"id":"DB-FUTURE-SCHEMA","status":"gap_reproduced","known_max_version":31,"future_schema_accepted":true,"fixture_only":true}
{"check_count":9,"reproduced_gaps":8,"protocol_observations":1,"real_credentials_read":0,"external_requests":0}
~~~

Anthropic 初始诊断用人工 404 观察了请求路径；该人工响应不是真实服务证据。核对官方兼容层后，保留的最终脚本将这项改为 protocol_observed，并显式 live_result=not_tested，不把它统计为缺口。

### 7.3 原始日志索引

目录：logs/2026-08-31-project-status-ai-onboarding/。它被 .gitignore 忽略，日志不入 Git；以下 bytes 与 SHA-256 均来自本轮 wc -c / shasum -a 256：

| 文件 | bytes | SHA-256 |
|---|---:|---|
| just-ci.log | 73951 | 3e65beeebbcc4e5ed2c03eb27a6d45024bf93535dcdde4c811179ba711ced177 |
| owner-order-focused.log | 331 | 2be54c5a181c89e5a0a3fdce05f3f697bd21fd3f7ada9924742956803ca43289 |
| ci-python.log | 254 | 0415083526a3986af32898151316ea04973aca893b2e8c75324d81e7db6482c2 |
| hermetic-readback.log | 1445 | 022d127aba127b48a124747ca496c1ee38b4ad99e34f7c675c991edf4f846691 |
| hermetic-readback.mts | 8522 | 33fe66955ab6a46fbc15f49d730f3cbabc3c6787e6136042c5c8bc404d127626 |

### 7.4 未做与报告检查

未做：真实账号联通/额度查询、真实模型/connector 请求、Claude live hooks、真实麦克风、Touch ID、手机、全平台重装、当前 Release 下载验证、Playwright、本次远端 CI 核验、生产备份迁移、代码修改、commit/push/部署。

本次不是全仓逐文件穷尽的安全审计；重点覆盖当前排产、首用流程、AI resolver/向导/执行器/语音、默认动作、安全边界和现有人工验收记录。未重跑的专项门以及旧文档的历史 pass 都不补写为当前 pass。

报告检查：bash scripts/check-emoji.sh 加本报告路径，exit=0，原始输出为 [ok] emoji gate: clean。validate_review_manifest.py 使用报告头的 expected-head、expected-fingerprint、expected-ordinal=1，exit=0，原始输出如下。该结果只证明报告结构/坐标有效，不把 RED 转为产品通过。

~~~json
{"next_action": "stop_for_owner", "rule_ids": [], "status": "valid"}
~~~

## 8. Deferred P2 ledger delta

review_scope=step；本轮不进行任务最终 P2 sweep，不修 P2，不启动第二名 reviewer。

本轮没有新增或变更 P2 条目，结构化 delta=[]。现有 G-B 清单仍以 docs/plan/2026-08-28-project-gap-closure-program.md 为来源；没有给它们重新分级或写已关闭，也没有创建平行台账。

本轮七个阻塞主题沿用既有 G-A，进入下面 manifest；无 key 本地/额外模型族/原生协议/全量语音打包作为未选中或未达成的支持范围如实报告，不借这次只读评估自动扩建。

## 9. 后续顺序与交接边界

1. 先处理当前 just ci 的失败，查明是产品问题还是测试时序问题；在下一实施候选上按合同跑受影响门，不通过反复重跑筛出一次绿来关闭。
2. 经新的明确实施授权后，沿唯一排产 PG-01A → PG-01B → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop，先纠正承诺/入口、再补门禁、安全和 admission；本报告不改排产，也不越过 PG-00 的停点。
3. core 风险收紧后，由 owner 选一个小的普适上手范围：一种订阅 CLI、一个云 API、一个本地兼容服务和一种混合。明确目标用户、支持 OS、文本/语音边界、实测预算与允许外发的数据，再补阶段验收合同。
4. 由工程线先跑自动化与合成故障；owner 再跑第 6 节的真人、真实账号与设备验收。不要要求 owner 用手工回归代替已知 key 冲突、数据库或假按钮修复。
5. 最后才能据“具体 candidate + 具体资源组合 + 对应真实证据”更新 supported / conditional / unsupported；不能以 CLI 被探测到、类型草案通过或一次聊天成功覆盖全套承诺。

眼下需要 owner 的不是一次签完全部长期决策，而是两件事：是否授权下一批安全治理实施；下一个面向用户的版本究竟优先服务谁、包含哪些 AI/语音/平台路径。真实账号测试和任何付费需另有明确范围与上限。

返工去向：新的监督实施会话先 RECONCILE 本报告坐标、当前 tree、原计划及预算；不得在此 read-only 会话施工，不自动派 CLI，也不把本轮请求当作部署或外部调用授权。本轮 owned process 已结束；证据和诊断脚本已从临时目录固化到 ignored logs。交接只需本报告、现役 PLAN-2 和既有缺口来源；不得复制另一套台账。

## 10. Review Manifest

```review-manifest
{
  "verdict": "RED",
  "review_ordinal": 1,
  "candidate_head": "79211f6fec5c6eb092419c1871e35d8eedc4e3e5",
  "diff_fingerprint": "e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727",
  "review_scope": "step",
  "blockers": [
    {
      "id": "G-A7",
      "severity": "P1",
      "summary": "多厂商 key 与同机多端点合并覆盖，计费来源推断不可靠",
      "evidence": "packages/console/src/lib/setupApi.ts:147,1339,1385; packages/daemon/src/config/cliCapability.ts:599; hermetic-readback.log AI-MULTI-KEY/AI-LOCAL-PORT-COLLISION/AI-FUNDING-INFERENCE",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "R7 / PG-06"
    },
    {
      "id": "G-A8",
      "severity": "P1",
      "summary": "配置页挂载自动启动 CLI 探测，未落实 static-only 边界",
      "evidence": "packages/console/src/components/SetupWizard.tsx:1096; packages/daemon/src/config/cliCapability.ts:1098",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "R6 / PG-06"
    },
    {
      "id": "G-A3",
      "severity": "P1",
      "summary": "默认动作占位、abandon 映射 archive，直达语音确认尚未接通",
      "evidence": "packages/console/src/pages/redesign/FocusPageRoute.tsx:77; packages/console/src/pages/redesign/RecordsPageRoute.tsx:70; packages/daemon/src/brain/liveTools.ts:985",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "R5 / PG-01B / PG-02"
    },
    {
      "id": "G-A6",
      "severity": "P1",
      "summary": "持久 capability token 进入远程 URL 与 localStorage，远程信任边界待收紧",
      "evidence": "packages/daemon/src/net/capToken.ts:11; packages/daemon/src/net/pairUrl.ts:25; packages/console/src/lib/api.ts:20",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "R6 / PG-01B"
    },
    {
      "id": "G-A9",
      "severity": "P1",
      "summary": "当前审计 sink 可保存任意明文 meta，生产调用确有模型文本",
      "evidence": "packages/daemon/src/storage/dao/misc.ts:83; packages/daemon/src/live/dialog.ts:1015; hermetic-readback.log AUDIT-RAW-TEXT",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "R6 / PG-04"
    },
    {
      "id": "G-A5",
      "severity": "P1",
      "summary": "数据库未来版本未拒绝，备份入口仍先调用迁移型 openDb",
      "evidence": "packages/daemon/src/storage/db.ts:11,39; packages/daemon/src/backup/cli.ts:21; hermetic-readback.log DB-FUTURE-SCHEMA",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "R6 / PG-05"
    },
    {
      "id": "G-A2",
      "severity": "P1",
      "summary": "当前候选 just ci 非零；单例通过不能代替完整门禁",
      "evidence": "logs/2026-08-31-project-status-ai-onboarding/just-ci.log:591; packages/daemon/test/tier1-executor.test.ts:6404",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "R8 / current local baseline"
    }
  ],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "just-ci-local-baseline",
      "exit_code": 1,
      "summary": "typecheck/lint通过；daemon 2176通过、1失败、6跳过；完整入口非绿"
    },
    {
      "name": "ownershipEstablished-focused-diagnostic",
      "exit_code": 0,
      "summary": "1通过、154跳过；仅定向诊断，不替代整套门禁"
    },
    {
      "name": "ci-python",
      "exit_code": 0,
      "summary": "ruff通过，pytest 34通过"
    },
    {
      "name": "hermetic-readback",
      "exit_code": 0,
      "summary": "9项隔离检查：8个缺口复现、1个协议观察；非产品全绿"
    }
  ],
  "stop_reason": "review_only_owner_requested_assessment_no_implementation_authorization"
}
```
