# 默认 Runner 决策：DeepSeek Harness vs 原生执行器

> 产出：Claude Opus 5（本会话实读）+ Codex `gpt-5.6-sol`/effort=max 对抗校审（报告 `research/codex-findings/72-dsh-default-runner-review.md`，prompt `prompts/72-dsh-default-runner-review.md`，事件流 `logs/72-dsh-review.jsonl`）
> 本产品基线：SayDo `feat/t20-fusion-layout`（工作树含未提交改动）
> 对方基线：`~/WorkSpace/Reference/deepseek-harness`，`origin` = 官方 `deepseek-ai/deepseek-harness`，`0.1.0-rc.5`，MIT，developer preview。该 checkout 是 owner 自己的 fork（`apps/desktop` 与少量 web/session 提交为 fork 新增）；**「fork 的 `packages/` 与上游逐字相同」未作为证据前提核验**。
> **supersede 关系**：本文 supersede `docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md` 的 **D-31 单条**（"是否把 DSH 收成 BYOA cage"）。该评估其余 41 条裁决不受影响。

## TL;DR

owner 提议：把默认 Runner 换成 DSH，用户不配时只填一个 DeepSeek API Key。

**结论分三层：**

1. **Brain 供给层（填一个 key 就能跑）——今天就成立，校验器零改动。** 缺的只是 onboarding 一键化，不需要 DSH。
2. **执行层默认 Runner ——不推荐 DSH。** 两方独立评估（本会话 + Codex）在细节上分歧，但在"不把 DSH 当安全承重的默认 Runner"上一致。
3. **推荐替代**：新增 provider-neutral 的 `native_api` Tier1 adapter（SayDo 原生最小执行器），默认指向 DeepSeek 官方兼容端点，用户可改任意 OpenAI-compatible 后端。

## 一、先修正三条被广泛误读的现状

### 1. 「单一 provider 无合法配置」已过期

`history/PROCESS-JOURNAL.md:361` 的"单家凭据无合法配置"是**旧轮次过程记录**，已被当前实现与 canonical 覆盖：

- API evaluator 与 dialog/thinking 同族时，**只有未确认才产生 violation**；`evaluator_same_family_ack = true` 放行并给提示（`packages/daemon/src/config/validate.ts:286`，测试 `packages/daemon/test/config.test.ts:124`）
- canonical 真值表标 `active`（`docs/09-data-contracts.md:1171`）

**「拒启动」的说法也不准确**：非法活动配置进入 `RECOVERY_ONLY`，daemon 仍启动配置自救面，只禁用对话与 dispatch（`packages/daemon/src/index.ts:617,665,897`）。

### 2. 真正的开箱门槛在执行层，不在异族规则

- Tier1：`cursor_agent_bin`（锁定副本**绝对路径**）+ `cursor_agent_pinned_version` 两键齐备才启用，缺任一不认领（`packages/daemon/src/config/types.ts:66-72`）
- **Hopper 生产绑定是 dormant、默认关闭**（`packages/daemon/src/focus/binding.ts:269`、`focus/stage.ts:35`）；启动恢复只统计悬挂 binding、不执行重放（`recovery/reconciler.ts:66`）。现有闭环是测试直接调外部二进制（`packages/daemon/test/p05b-fake-runner.e2e.test.ts:49`）

**准确表述：有 Tier1/Hopper 两种架构路由，但目前只有 Cursor Tier1 是生产执行器；Hopper 是 dormant 桥合同，不是第二个活跃 Runner。**

### 3. BYOA cage 不是执行器，但也不是统一强隔离

这些 provider 只实现 `LlmProvider.chat()`，不参与 worktree/settle/执行状态机（`providers/types.ts:80`、`byoa/provider.ts:189`）。但笼强度分档：claude 空工具集、grok `--tools ""`、codex `-s read-only`，而 **cursor 只有 ask+tripwire、仍看得到真实 HOME，并非可证零工具**（`byoa/cage.ts:44,67,88,99`）。

## 二、DSH 作为默认 Runner 的三处硬伤

按重要性排序。全部由 Codex 独立核验，本会话未复跑其引用行。

### 硬伤 1：`approval: ask` 不等于每个工具都问

`tools/pre-execute` 的**缺省决定是 `allow`**，只有另一个 policy 返回 `ask` 才进入 approval service（`packages/core/tools/src/index.ts:1473`）。

对 SayDo 的意义：DSH 的审批不是默认全覆盖门，而 S0–S3 要求的是 fail-closed 全覆盖。这不是配置问题，是缺省语义相反。

### 硬伤 2：hook 桥在故障时是 non-blocking

配置读取/解析失败只告警并"什么都不注册"；hook 执行基础设施故障默认 non-blocking，只有 hook 自身 exit 2 才拦截（`packages/hooks/hooks-claude-code/README.md:31`、`src/index.ts:96`、`packages/hooks/hook-protocol/README.md:22`）。

对 SayDo 的意义：**直接违反 fail-closed 红线**。SayDo 现有 gate 是"超时即 deny"，DSH hook 是"故障即放行"。

### 硬伤 3：ACP 审批帧信息不足以定级

ACP permission 帧**只有 `toolCallId`，没有工具名、参数或理由**（`packages/acp/acp/src/index.ts:218`）。客户端要知道"这条命令是什么"必须关联另一个工具事件流，而 **ACP 恰好不提供该事件流**（`src/index.ts:152`，README:27/76）。

对 SayDo 的意义：S0–S3 是按**动作效果**定级的。拿不到命令内容就无法定级，审批门形同虚设。

> 补充修正：我方原判"`callId` 缺失导致审批不外化"是**部分成立但不是现实缺口**——当前内置工具链（普通工具 `ask`、bash/fs 沙箱升级）都传 `callId`（`packages/core/tools/src/index.ts:1678`、`sandbox/escalation.ts:102`）。真实缺口是上面的信息不足，不是覆盖率。

### 附带修正：两条通道的判断要更新

我方原判"必须旁读 session 持久化"**被证伪**：SDK JSON-RPC 实时发送完整 `SessionEvent`，Host ApiProxy 也有 raw `session/event` 帧（`packages/sdk/protocol/src/types.ts:50`、`packages/host/apiproxy/src/api/events.ts:65`）。

但 `SessionEvent` **不是稳定外部契约**：`SESSION_FORMAT_VERSION=0`，根 `AGENTS.md:5` 明确允许 pre-release 自由 rename/repackage，无兼容承诺；`packages/README.md:11` 标的 "Product — stable API" 与之冲突，rc 阶段按后者处理（`packages/core/session/src/types.ts:33,40,404`）。

我方原判"无现成可运行 ACP app"**被部分证伪**：有可发布的 `dsh-acp-demo` bin（`pnpm demo:acp`）。但仍需维护自己的 leaf `cordis.yml` 与依赖闭包，且 DSH 子进程本身仍是 Cordis runtime。

## 三、ROI 对照

工作量为 Codex 粗估（单名高级 TS 工程师、macOS 首发、含 canonical/测试/故障注入，不含三平台认证，误差约 ±40%）。**这是架构估算不是测量值**。

| 方案 | 可评审 MVP | 默认级累计 | 长期维护 | rc 漂移暴露 |
|---|---:|---:|---|---|
| DSH + ACP + 日志投影 | 17–25 人天 | 24–36 人天 | 高：同时维护 ACP、hook、日志 schema、Cordis leaf | 高 |
| **A：SayDo 原生执行器** | 19–29 人天 | 27–40 人天 | 中：代码更多，但安全/状态合同单源 | **无** |
| C：现有 CLI 直接吃 DeepSeek key | 4–8 人天 | 7–12 人天 | 低至中 | 取决于 vendor |
| 第四路：DSH SDK JSON-RPC sidecar | 13–20 人天 | 20–30 人天 | 中高 | 高，但免日志 tail |

**方案 C 当前不成立**：executor 会主动剥离 API key 环境变量（`packages/daemon/src/tier1/executor.ts:106`、`tier1/validateConfig.ts:103`），仓内没有"Cursor 接任意 DeepSeek endpoint"的实现证据。需 spike 才能判定。

**裁决理由**：DSH 相对 A 可能节省几天 agent loop / compaction / FS-shell 工具建设，但审批缺省 allow、hook 故障放行、ACP 帧信息不足、`SessionEvent` 无兼容承诺、egress 不受控，把这些节省基本吃完。**作为安全承重的默认 Runner，这笔交换不划算。**

## 四、推荐路径：`native_api` Tier1 adapter

1. **先改 canonical 与封闭词表**：`DevAgentBinding`、`Task.adapter`、两处 SQLite CHECK、项目 dev override、startup verdict（`packages/contracts/src/types/modelbinding.ts:48`、`types/task.ts:11`、`daemon/src/storage/ddl.ts:112,183`、`config/projectOverrides.ts:18`）
2. **把 Tier1 编排与 Cursor transport 拆开**：抽出 `Tier1Runner`（`start/cancel/resume` + 规范化事件）。现有 `AgentSpawner` 只抽象进程，parser/hooks/session id/终态/observed model 全嵌在 `executor.ts`（:93、:1122、:1221），还不是真正的 Runner seam
3. **原生 loop 复用 provider 与循环骨架，但另建执行域 ToolRegistry**——不要复用 Brain 的 live tool 实例（`brain/liveTools.ts:513` 是账本/项目/确认域工具）。MVP 工具面：结构化 `read/list/search/write/edit`、`git status/diff`、冻结登记的 `run_verify`、明确包名的 `install_dependency`、经风险门的受限 shell
4. **安全门内建，不依赖外部 hook**：Gate 0 仍在 dispatch 前拒；工具执行前统一产生 `EffectDescriptor`；S2 直接调现有 `RuntimeApprovalFlow`（`tier1/approvalFlow.ts:41`）；S3 Runner 内硬拒，合并仍走本机 WebAuthn（`tier1/gate.ts:36`、`tier1/s3Tools.ts`）
5. **由 SayDo 自己产生进度/usage/恢复事件**：先写 durable run state 再推 UI；raw transcript 只作日志。usage 从现有 provider 取（`providers/openaiCompat.ts:171`），价格与 `known` 仍归 SayDo 计费层
6. **一键 DeepSeek onboarding**：`DEEPSEEK_API_KEY` 进 secret 白名单（`config/envFile.ts:7`）与 setup 名单（`api/setup.ts:791`）；console 扩 `ApiKeyName`/host 映射/一键方案（`console/src/lib/setupApi.ts:1194,1274`、`lib/resourcePlans.ts:41,473`）；执行 adapter 缺省从硬编码 Cursor 改为 `native_api`（`daemon/src/index.ts:2406`、`config/defaultTemplate.ts:20`）

## 五、顺带发现的两处安全缺口（与本决策独立，建议单独修）

1. **`node`/`python`/`python3` 被无条件归为 `write_worktree`(S1)**（`tier1/cmdEffect.ts:19,124`、`policy/engine.ts:37`）。通用解释器可发网络请求、可写任意路径，按 S1 自动放行是实质扩权。建议：egress 隔离完成前，只允许登记 verify 使用解释器，其余按 S3/manual。
2. **canonical 与实现不同步**：09 §11 写"digest 补偿待实施"，但"每次 gate 请求重读比对脚本、漂移即终止活跃 run"的代码已落地（`tier1/executor.ts:403`）。canary 仍只比 shell-start 与 gate 请求计数，抓不到内置文件写与"撒谎 POST"变体（`executor.ts:556`）。

## 六、owner 决策点（本文不代拍）

1. ~~**同族确认的强度**~~ **已拍板 2026-08-15 = (a) 保留一次显式确认**：预设单家方案**前置**展示 ack 并默认勾选，用户点一次「启动」即过，不再撞 422；canonical 真值表不变（`validate.ts:286-304` 未改）。**已实施，见第九节。** 未采纳的 (b) 是"取消 API 同族 ack 门"（violation 改 hint + 改 §11 真值表）——若日后仍嫌一次勾选多余，再上浮。**注意：异族规则是质量护栏（防相关错误链），不是安全护栏，放松它不碰 Gate 0/S0–S3/审计。**
2. **是否开 `native_api` 执行器批**，以及排在 W5 剩余/R-B 之前还是之后。
3. **DSH 是否保留为实验 adapter**（走 SDK sidecar 而非 ACP）。建议：不进首发，作为质量对比基线保留。

## 七、必做 spike（任一失败即淘汰对应方案）

1. **方案 C 一日 kill-spike**：已 pin 的 CLI 能否仅凭 DeepSeek key/base URL 无交互启动，并保持 observed model、tool event、usage、取消与 gate 语义。任一缺失即淘汰 C。
   **2026-08-15 部分结论（本会话实测）**：发现一条比"未实现"更硬的障碍——`AGENT_ENV_ALLOWLIST` 是**白名单**（仅 `PATH/HOME/USER/LOGNAME/SHELL/LANG/LC_*/TERM/TMPDIR`），任何 API key 都进不了执行 agent 的环境（`packages/daemon/src/tier1/executor.ts:106-116`，G4 原话"agent 环境不带任何 key/token；登录态走 HOME 下 cursor 自身存储"）。**方案 C 与现有安全设计正面冲突**，不只是缺实现：要让 CLI 吃 DeepSeek key，得把 key 放进 agent env（削弱 G4）或走 HOME 下配置文件。CLI 侧实测：四家（cursor-agent/codex/claude/grok）本机均已安装；`cursor-agent` 有 `--api-key` 与 `-e/--endpoint`，但那是 **Cursor 自家 API endpoint**（自托管/代理），**不是 OpenAI 兼容模型端点，不能据此认定它能吃 DeepSeek key**；`codex` 有 `-c` 与 `--oss/--local-provider`，是方案 C 更有希望的载体，但 Tier1 目前只实现 cursor spawn，换 codex 需新 adapter。**尚未验证**：任一 CLI 真的连上 DeepSeek 端点并完成一轮工具调用。
   **衍生 owner 决策点**：G4 防的是"agent 拿到用户 key 去干别的"；若 agent 本就靠该 key 驱动，风险性质从"越权获取第三方凭据"变为"持有自身推理凭据"。是否为零安装上手放松 G4，需 owner 拍。**注意这一点反向加强了方案 A**：原生执行器把 key 留在 daemon 进程内、不经子进程环境，天然绕开该冲突。
2. ~~**DeepSeek 原生 tool-loop**~~ **已实测 2026-08-15**（`e2e/spikes/deepseek-toolloop/`，走生产 `createOpenAICompatProvider`，非另写 client）：

   - **通过（方案 A 的最小前提成立）**：单工具调用；**多轮 tool result 回填后续跑出终答**；**一轮并行返回 2 个 tool_calls**；`observedModel` 提取与 deepseek 族复核（`source=stream`、`exempted=false`、零拒收）；prompt caching 生效且 adapter 正确提取 `cachedPromptTokens`（实测 cached:256）。
   - **模型名（已据此修正一键预设）**：官方 `/v1/models` 当前**仅** `deepseek-v4-flash` / `deepseek-v4-pro`。旧别名 `deepseek-chat` / `deepseek-reasoner` 仍可调用，但服务端**双双映射到 v4-flash**（实测 observedModel 恒为 flash）——会让沉思档拿不到更强模型，且配置写的与实际跑的不一致（违反 observedModel 纪律）。预设已改为 v4-flash（dialog/cheap）+ v4-pro（thinking/evaluator）。
   - **发现缺口（阻塞级，本轮未修）**：V4 系列 **flash 与 pro 都是混合推理模型**。复杂输入下 reasoning 吃光 token 预算 ⇒ `content` 为空、`finish=length`（pro 与 flash 各实测一例，reasoning_tokens 均 3000）。adapter 现有防护 `reasoning:{max_tokens:1200}` **只对 openrouter 的 baseUrl 发送**（`openaiCompat.ts:80`），且实测该键被 DeepSeek 官方端点**静默忽略**（不报错、无效果）。
     **确切修法（已实测有效）**：官方直连改用 OpenAI 风格 `reasoning_effort`——`"low"` 实测 reasoning 478 / content 421 / finish=stop；`thinking:{budget_tokens:300}` 亦生效但约束较松（实际 1138）。落地需扩 `OpenAICompatOptions` 并按槽位映射档位，属**生产 provider 变更**，不在本轮 onboarding 批内，须 owner 决定何时修。**在修好之前，DeepSeek 一键方案在长 instructions / 复杂任务下会拿到空回答。**
   - **本会话曾误判并已纠正**：一度报「maxTokens 被 DeepSeek 忽略、成本护栏失效」，实为 adapter 自身 `Math.max(req.maxTokens, 3000)` 抬高下限所致（`openaiCompat.ts:78`，8/6 既有修复）。**成本护栏未失效。**
   - **仍未验证**：429/5xx 限流行为；取消——`ChatRequest` 无 `signal` 字段（`providers/types.ts:26-35`），provider 层无法主动中断进行中的调用，只能靠 `timeoutMs`。此为静态阅读所得；方案 A 的原生执行器若要支持「喊停」需先扩 provider 接口。
3. **执行工具安全矩阵**：symlink/path traversal/`..`/worktree 外写/解释器网络/shell wrapper/敏感文件/push/deploy/gate 异常/进程组取消。必须证明 S3 零执行，并清偿上面的 `node/python → S1` 缺口。
4. **崩溃恢复**：分别在 model 请求中、`tool_requested` 后、effect 执行后但 result 落库前杀进程；恢复必须把不确定 side effect 标 unknown 并重验，不得假定未执行。
5. **质量与成本对比**：同一批 15–20 个真实 coding task，比较原生 loop / DSH / 当前 Cursor 的验收通过率、人工介入、token、墙钟、错误恢复。**静态阅读无法回答"DSH 的 agent loop 是否显著更聪明"。**
6. **空 HOME 一键路径**：只给 DeepSeek key，验证四槽合法、同族确认只出现一次、默认 Runner 可启动、Gate 0 与 S3 不变。
7. **若保留 DSH 候选**：必须证明 hook 缺失/解析失败/socket 失败/hook 进程异常都在首个 effect 前阻断，否则判定不满足默认 Runner 红线。版本精确 pin `0.1.0-rc.5` + 锁依赖与制品 digest + 完整事件 golden fixture 拒未识别事件。

## 八、本轮已实施（仅第一层：Brain 供给一键化；执行层未动）

**范围声明**：本轮只做 TL;DR 第 1 层（填一个 key 就能跑）。**执行层默认 Runner 未改动**——Tier1 仍只有 Cursor，`native_api` adapter 未开工。

改动 9 文件（相对 `8a8247a`，+89/−30；经 `git diff HEAD` 逐块核对，工作树无其他批次混入）：

| 层 | 文件 | 改动 |
|---|---|---|
| canonical | `docs/11-ui-spec.md` | §5 新增单家 API 预设方案的 ack 前置语义 + 三条适用边界 |
| daemon | `config/envFile.ts` | `DEEPSEEK_API_KEY` 进 `SECRET_NAME_WHITELIST` 与 `PROBE_SECRET_NAMES` |
| daemon | `api/setup.ts` | `SECRET_NAME_LIST` 由手抄副本改为 `SECRET_NAME_WHITELIST.join("|")`（消除白名单第三处分叉，AGENTS.md §66） |
| console | `lib/setupApi.ts` | `ApiKeyName` 加 `DEEPSEEK_API_KEY` |
| console | `lib/resourcePlans.ts` | label/baseURL 映射；`DEEPSEEK_SLOT_MODELS` 四槽预设；`apiKeyPlan` 对 DeepSeek 返回前置 ack |
| console | `components/SetupWizard.tsx` | `planPresetsSameFamilyAck` 前置显示；选中方案时按 `plan.requiredAcks` 默认勾选 |
| 模板 | `templates/saydo.env.example` | `DEEPSEEK_API_KEY` 由注释项提升为一等项 |
| 测试 | `console/lib/resourcePlans.test.ts` +3、`daemon/test/setup-onboarding.test.ts` +1 | 预设模型/前置 ack/其他端点不受影响/写口白名单 |

**门禁（退出码单独取，未经管道）**：`pnpm typecheck` EXIT=0；`pnpm test` EXIT=0（contracts 103 / cli 19 / console 238 / daemon 1294，共 1654 passed）；`check-emoji.sh` EXIT=0；`check-hardcoded-colors.sh` EXIT=0。
**`pnpm lint` EXIT=1，但基线同样红**：`git stash` 掉本批改动后重跑，基线仍失败（同样 7 处 `no-unused-vars`，其中一处在本批未触碰的 `setupWizardUx.test.tsx`）。本批**未新增** lint 错误，也未顺手修既有项（属 t20 分支在途工作）。

**一致性核验（AGENTS.md §16「文档与实现可共同审查」）发现并已修正两处**：
1. canonical 原文另立了一句代价文案，而实现早有既有措辞（`SetupWizard.tsx:1600`）。改为"沿用既有 ack 行措辞，canonical 不另立新串"。
2. canonical 原文写"『先存、422 再摊开』行为取消"，属**过度承诺**——实现只对**预设方案**前置，用户手工组合出的 API 同族仍走 422（`requiredAcksForSupplies` 未改，console 不推断家族）。已改为三条明确边界。

**本轮后续追加**：owner 配好 key 后已跑完 spike 2（结论见第七节第 2 条），并据实测把一键预设的模型名从旧别名 `deepseek-chat`/`deepseek-reasoner` 改为 `deepseek-v4-flash`/`deepseek-v4-pro`（含测试同步）；spike 脚本落 `e2e/spikes/deepseek-toolloop/`（`spike.ts` 工具链路、`spike-pro.ts` 推理预算）。

**本轮第二批（owner 指示「明确缺口现在就修」，2026-08-15）——两处缺口已修复**：

**缺口 A · reasoning 预算耗尽 ⇒ 空回答**（`providers/openaiCompat.ts`）

- 根因不是 `reasoning_effort`，是 **`max_tokens` 下限 3000 本身不够**。实测同一难题：3000 ⇒ content=0/finish=length；8000 ⇒ content=730/finish=stop；16000 ⇒ 687/stop；32000 ⇒ 848/stop。`reasoning_effort` 三档在难题上均救不回来（pro low/medium/high 全部 content=0），只是辅助省 reasoning。**先前"改用 reasoning_effort"的结论建立在一道更简单的题上，已作废。**
- 修法一：输出预算下限按端点分档——DeepSeek 官方直连 16000，其余维持 3000。**收窄到已验证端点**：其他端点各有输出上限，盲目抬高可能被上游拒。max_tokens 是上限不是用量（32000 上限下实际只用 2875），不抬高成本。
- 修法二：`finish_reason=length` 且无 content 无 toolCalls ⇒ **返回 error 而非静默空 text**。此前 `content=""` 是合法 string，会通过既有检查被当成"模型回了空话"放行（fail-open）；空回答对上游是**坏结果而非无结果**，必须显形。
- 端到端复验：同一场景 pro 由 `content=0 / finish=length` 变为 **`content=583` / `finish=stop`**（reasoning 7236，预算够即留得下正文）。
- **已知权衡**：预算抬高后请求更耗时，`timeoutMs` 缺省 30s 更易触发（复验中 flash 难题一例 60s 被 abort）。但这是**把"静默返回空回答"换成"显式超时失败"**，方向正确、非 regression。是否为 thinking 槽单独放宽超时涉及 10 的语音延迟合同，**未擅自改，留 owner**。

**缺口 B · 通用解释器被判 S1 自动放行**（`tier1/cmdEffect.ts`）

- `node/python/python3/tsx` 移出 `WORKTREE_WRITE_HEADS`，落到既有保守上浮档 `install_dependency`(S2，确认一次)。词面无法区分 `node -e "fetch(...)"` 与 `node build.js`，按 S1 自动放行等于让 S3 级效果无人过目。
- **高频合法用途不受影响**：登记 verify 在 gate 层**先于**本分类匹配（`executor.ts:462` `matchesFrozenVerify` ⇒ `run_registered_verify`），跑测试走独立通道；且 04 §5.4 允许 S2 效果类随决策包预授权，直达验收档不会频繁打断。
- 选 S2 而非 Codex 建议的 S3：S3 = 语音永不放行，会让 agent 完全不能用解释器；S2 是本文件既定的"识别不出即上浮"档，与 04 §5.1「改代码、跑测试、本地 commit 自动放行」不冲突（执行任意解释器本就不在其列举内）。
- **已知残留面（登记，不假装已覆盖）**：`just` 仍在 S1 词表内，它执行 worktree 内 justfile，风险同源，但属项目任务入口，单独收紧影响面更大，留待 egress 隔离批一并处理。

两处均为**纯实现修复**：09/04 都未规定命令词表或 `max_tokens`，故不涉 canonical 变更。测试 +4（provider 3 / cmdEffect 1，含"finish=length 但有 content 仍算成功"的反例）。

**本轮第三批（owner 指示「仔细思考是否值得，值得就实施」，2026-08-15）——三项做、两项判定不做**：

**已做**

1. **`just` 收紧**（`tier1/cmdEffect.ts`）。**上一批「影响面更大所以暂留」的理由站不住，已推翻**：`justfile:<task>` 本就是 verify 冻结的一等形态（`verifyFreeze.ts:23,41`，还会递归 justfile 体内的 pnpm 脚本闭包），所以 `just ci` / `just test` 这类登记任务照常走 `run_registered_verify` 通道、不受影响；而留在 S1 等于给刚收紧的解释器留一条绕行路（agent 可写 justfile 再 `just <task>`）。**缺口 B 的修复此前是不完整的。**
2. **槽位等待预算分档**（`providers/resolve.ts`，新增 `SLOT_TIMEOUT_MS`）。三个 provider 构造点此前都用 adapter 缺省 30s。dialog/cheap 在语音实时路径上维持 30s（延迟是合同的一部分）；thinking/evaluator 放宽到 180s——实测 deepseek-v4-pro 单次 out=7516，30s 必超时，且超时重试只会再烧一遍同样的推理。这两档本就低频（09 §11 `evaluator_deep_review_max_per_session=3`）。**这是缺口 A 抬高预算后暴露的副作用的正解**（而非放宽全局超时）。
3. **429 测试补齐**。行为本已正确（`:119` ⇒ `rate_limited` + retryable，与 4xx 不同档）但**生产路径零测试覆盖**，补「首次 429 重试后成功」与「持续 429 ⇒ 失败且 retryable」两例。

**判定不做（附理由，非遗漏）**

1. **`ChatRequest` 加 `signal`**：`brain/dialogLoop.ts` 现无任何 abort/interrupt 逻辑，即**当前没有消费者**，加了就是死代码；且扩 `ChatRequest` 会波及 BYOA provider 等所有 `LlmProvider` 实现。应与 `native_api` 执行器或语音打断批一并设计（那时才有真实调用方）。
2. **`native_api` adapter**：19–29 人天（第三节），属独立工程批而非「补缺口」，需单独立项与排产，不在本批范围。

**本轮仍未做**：`native_api` 执行层未开工；取消语义待上述批次；DSH 作为实验 adapter 未评估。

## 九、未验证事项（不得当作已证）

- 方案 C 的 vendor 能力：仓内证据不足，需真实 CLI spike。
- DeepSeek 当前模型的真实工具调用质量、thinking wire 行为与价格：**两方均未做网络调用**，不能从 DSH 示例配置推定。
- "DSH 全仓没有 triage/交付验收域"是未核验的全局否定；只确认了 jobs/plan/session 的边界。
- `SessionEvent` 正式发布后是否稳定：不可预测。
- 人天估算是架构粗估，最大不确定项是原生执行器达标所需的上下文管理与工具调优。
- 本会话未复跑 Codex 报告引用的每一行；DSH 侧行号以其报告为准，SayDo 侧关键行（`validate.ts:286-305`、`capabilityMatrix.ts`、`cage.ts`、`adapter.ts`、`executor.ts:150`、`config/types.ts:66-72`、`09:1171-1175`、`11:437`、`resourcePlans.ts:249-253`）为本会话实读。
