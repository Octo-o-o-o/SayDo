# W5.4 方案：Claude Code CLI 作为 Tier1 执行器后端（adapter `claude_code` · 传输 = `claude -p` 子进程）

> 版本：**v3.1（2026-08-20 凌晨；v3 + 阶段 A 终版 spike 结果回修：B-10' 在 `acceptEdits` 下红 ⇒ 改 `--permission-mode default` + 圈内写显式 allow，X1–X5 补测证实 fail-closed；详见 §9 v3.1 段）**。v2 经两路 subagent 评审回修；v3 = 对抗评审回修：Codex 配额耗尽（至 2026-08-20 11:29），按职能回落链由 Grok `grok-4.6`+`xhigh` 只读会话执行（prompt `prompts/77-w54-plan-adversarial-review.md`，报告 `research/codex-findings/77-w54-plan-adversarial-review.md`：A 10 / B 12 / C 6，总评"不能按 v2 开 W5.4-a"），A-01…A-10 与 B-01…B-12 全部处置见 §9 v3 段。Codex 配额恢复后可再补一轮，若再出 A 级则 v4。
> 产出：Claude Fable 5（本会话实读 `packages/daemon/src/tier1/*`、`providers/byoa/*`、`docs/03/04/07/09`、设计 ADR-001、工程 ADR-002、PLAN-2 5.4；一路 Explore 子代理做接缝梳理（坐标经本会话抽查）；一路 claude-code-guide 子代理抓官方文档；**本会话亲手跑了 17 次 `claude -p` spike**（Claude Code 2.1.220，附录 A）。标"实测"者为本会话命令输出；标"文档"者为官方页原文；标"推断"者为未验证判断。
> 对象：SayDo `main` @ `1ee5622`（cmdeffect-hardening 已合入）。
> 关系声明：本文落实 `docs/plan/IMPLEMENTATION-PLAN-2.md` **5.4**（"Claude SDK Tier1 主档接入(订阅解锁后):四能力冒烟 + live steer + dev↔产品缺省切换 + observedModel 豁免的身份核验实施"）与 `IMPLEMENTATION-PLAN.md` 0.0(b)（"claude_sdk 四能力冒烟(streaming input / canUseTool 阻塞 / resume / live steer)"）。**它会 supersede `docs/07-tech-stack-decisions.md` D8 行（:118）与弃选表（:180）里"Claude Code … 不走 CLI（Claude CLI 无 canUseTool，一手实测）"这一陈述**（理由 = 2.1.220 的 `-p` 下 `PreToolUse` hooks 能做 S1–S3 裁决，§1.2），并对设计 ADR-001 路径一的"Claude **SDK** 薄执行器（daemon 进程内）"提出传输形态附注（§2 D1）；不改"产品缺省执行器 = Claude"与 canUseTool 语义（hook 等价）；不改工程 ADR-002 的收窄条款（但更正其"休眠"状态陈述，§2 D4）。与 `2026-08-15-default-runner-decision.md` 决策点 2（是否立 `native_api` 执行器）正交：本文不取代、不预设该决策。
> 文档纪律：零 emoji（`scripts/check-emoji.sh`），文本标记 `[ok]/[warn]/[fail]`；`docs/plan/` 不属合同 canonical，合同变更见 §5 清单（分"开批前置"与"随批补录"两栏），走一致性评审后回写。
> 术语（三分，贯穿全文）：**adapter** = canonical 词表值 `claude_code`（`packages/contracts/src/types/task.ts:12`）；**transport** = CLI 子进程（`DevAgentBinding.claude_code` 分支拟加可选 `transport:"cli"`，与 cursor 对称）；**BYOA provider** = `claude_cli`（推理槽词表，与执行器无关）。"backend" 只指 adapter 的实现对象，不新增词表。

## 0. TL;DR

| 问 | 答 |
|---|---|
| 订阅到位后 Tier1 怎么接 Claude | **spawn 官方 `claude` 二进制的 `-p --output-format stream-json` 子进程**，沿用现有 `AgentSpawner`/进程组/env 白名单骨架；审批门用 Claude Code 的 `PreToolUse` hooks（`--settings` 内联注入，`--setting-sources ""` 屏蔽 worktree 里 agent 可写的配置），hook 脚本回连现有 unix socket，daemon 侧 `decideCommand` 链不变 |
| 为什么不用 Agent SDK 包 | 主轴 = 架构复用与零新依赖（现有执行器本来就是"子进程 + NDJSON 行流 + 进程组 + env 白名单 + `--resume` 钥匙"，CLI 路径全部复用；仓内无 `@anthropic-ai/*`）；佐证 = 官方 legal 页把第三方产品与 Agent SDK 并提要求 API key、而 `setup-token`/`-p` 是订阅的正当程序化形态，且 `agent-sdk/overview` 明写"run the CLI as a subprocess"。需要 ADR-001 附注 + supersede 07 D8 的"不走 CLI"（owner 决策 D1） |
| 03 §5 / 07 D8 里"Claude CLI 无 canUseTool"怎么办 | 那句话本身仍为真（CLI 没有 SDK 的 `canUseTool` 回调），但 **CLI 现在有等价物**：本会话实测 `-p` 下 `PreToolUse` hook 的 `permissionDecision allow/deny` 生效、hook 输入含 `tool_name/tool_input/cwd/session_id/tool_use_id`；`ask` 在 `-p` 等同 deny（所以 S2 必须像 cursor 一样在 hook 内同步等审批）；hook **超时 = 非阻断，落回 Claude 自身权限流**（实测：无害 Bash 会跑、变更类 Bash 被 Claude 自拒）——所以脚本必须先于超时自返 deny。两处 canonical 随本批回写 |
| 比 cursor 后端多什么安全面 | 文件工具（Write/Edit/NotebookEdit/Read）**也能进门**（cursor 只有 shell 过 `beforeShellExecution`，内置写工具免门——`e2e/poc/tier1-live-executor/RESULT.md` 校准事实 2）；hooks 由命令行注入而非 worktree 内文件，少一条"agent 改 hooks.json"的攻击面；圈内 S0/S1 文件操作 hook **不裁决**、交给 Claude 的 `acceptEdits` 自决，这样 Claude 自身对圈外读写的拒绝（实测）才真正是第二层（hook 一旦返回 allow 就绕过它） |
| 不做什么 | 不 import `@anthropic-ai/*`；不启用 `bypassPermissions`/`dontAsk`；**不放开 `live` steer、不实现 streaming input**（仍 `queued_delta`/`cancel_resume`；`--input-format stream-json` 只做可行性 spike；这是对 5.4/0.0(b) 两件事的如实缩水，见 §2 D5/D9）；Tier1 不使用 `verified_binary_default` 豁免（恒 `exempted=false`）；不碰 Hopper 路径、不部署常驻、不改 BYOA 四槽 |
| 拆批 | 三批（§6）：**W5.4-a** = spike 固化 + 纯函数层（零行为变化）；**W5.4-b** = 接线（配置/门/恢复/记账/自检）；**W5.4-c** = live 冒烟 + conformance + canonical 回写 + 对抗评审。合同"开批前置"项（§5 左栏）在 W5.4-b 开批前先回写 |
| 代价 | 执行器要先把 cursor 硬耦合的三处（argv/解析/门）拆出 backend seam，且 `realAgentSpawner` 有两处 cursor 专属行为要改（吞 stderr、result 即 SIGKILL）；Claude Code 是滚动发布的 CLI（本会话 2.1.220，且会自更新），版本 pin + 身份核验 + `DISABLE_AUTOUPDATER` 必须做成一等公民；`-p` 下所有需要"问"的都会被拒，审批时延全压在 hook 等待窗 |

## 1. 事实底座

### 1.1 政策原文（2026-08-19 抓取）

- `code.claude.com/docs/en/legal-and-compliance`：「Advertised usage limits for Pro and Max plans assume **ordinary, individual usage of Claude Code and the Agent SDK**」「OAuth authentication is intended exclusively for purchasers of … subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications」「Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication … Anthropic does not permit third-party developers to offer Claude.ai login or to route requests through Free, Pro, or Max plan credentials on behalf of their users」「Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice」。
- `code.claude.com/docs/en/authentication`：`claude setup-token`「For CI pipelines, scripts … This token authenticates with your Claude subscription and requires a Pro, Max, Team, or Enterprise plan」；认证优先级 API key > `apiKeyHelper` > `CLAUDE_CODE_OAUTH_TOKEN` > 订阅 OAuth；「In non-interactive mode (`-p`), the key is always used when present」。
- `code.claude.com/docs/en/agent-sdk/overview`：「To drive the same agent loop from another language, **run the CLI as a subprocess** with the `-p` flag and `--output-format json`」。
- `code.claude.com/docs/en/headless`：SIGTERM ⇒「aborts the in-progress turn, terminates the process tree of any running Bash command, runs SessionEnd hooks, and exits with code 143」；`total_cost_usd`「client-side estimates」；`--bare` 不读 OAuth。
- `code.claude.com/docs/en/hooks`（评审员抓取）：「A timed-out command … hook doesn't block the tool call. The call continues through the normal permission flow, so don't count on a stalled hook to act as a gate」；`exit 2` 才是阻断。
- `code.claude.com/docs/en/cli-reference`（评审员抓取）：v2.1.223 起 `--resume <id>` 会搜索本机所有项目——跨 cwd 失败（S5）是版本相关行为，SayDo 的"同 cwd 才 resume"要写成自家策略。

**结论与范围**：SayDo 在 owner 本机以 owner 自己的登录态驱动 Claude Code 做 owner 自己的任务（无第三方用户、无身份伪装、无 token 抽取），落在"ordinary, individual usage"与"run the CLI as a subprocess"这一格；HANDOFF #6 硬约束（只经 `claude` 登录态、零 API key、不共席）继续成立，`AGENT_ENV_ALLOWLIST`（`packages/daemon/src/tier1/executor.ts:107`）本就剔除一切 `ANTHROPIC_*`/`CLAUDE_CODE_OAUTH_TOKEN`，HOME 在白名单内、登录态天然可达（08-15 决策文档 §七 spike 1 指出的"方案 C 要放宽 G4"问题在 Claude 路径上不存在）。**这一结论的范围 = 单机 owner 自用**；`claude_code` 作为**产品缺省**（D2）在将来分发形态下会变成"第三方开发者替用户走订阅凭据"——`docs/07-tech-stack-decisions.md:248` 已有 ToS 观察项，分发前必须复核，本文不代答。

### 1.2 Claude Code CLI 能力实测（本会话，2.1.220；命令、hook 脚本正文与原始输出见附录 A；全部在 `env -i PATH HOME USER LANG TERM TMPDIR` 下、cwd 为空临时目录、stdin `< /dev/null`）

| # | 实测项 | 结果 | 对设计的含义 |
|---|---|---|---|
| S1 | `-p --output-format stream-json --verbose --permission-mode default --tools "Bash,Read" --setting-sources "" --strict-mcp-config --no-session-persistence --max-turns 3 --settings '<hooks JSON>'`，hook 对 Bash 返回 deny | [ok] 登录态可用（`system/init.apiKeySource="none"`）；hook 触发；hook stdin = `{session_id, transcript_path, cwd, prompt_id, permission_mode, effort, hook_event_name:"PreToolUse", tool_name:"Bash", tool_input:{command, description}, tool_use_id}`；输出 `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"…"}}` ⇒ `ls -la` 未执行，`user.tool_result.is_error=true` 且内容 = reason；`result.permission_denials` 含该 tool_use | hooks 可由命令行注入、在 `-p` 下生效；Bash 门协议 = `tool_input.command` + `cwd`，与现有 `GateWireRequest{command,cwd}` 同形；hook 拒绝会进 `permission_denials` |
| S2 | 同上，hook 返回 `ask` | [ok] 在 `-p` 下等同拒绝（`tool_result.is_error=true`，"requires approval"），`result.subtype=success` | S2 不能靠 `ask`：必须在 hook 内同步等 daemon 审批后返回 allow/deny |
| S3 | 同上，hook 返回 `allow` | [ok] 命令执行；`permission_denials=[]` | **allow 绕过 Claude 自身权限询问**——hook 一旦 allow 就没有第二层 |
| S4 | `--permission-mode acceptEdits --tools "Write,Read"`，hook（matcher 文件工具）只记日志**不裁决**；让模型写 `./inside-spike.txt` 与 `/tmp/outside-spike.txt` | [ok] 圈内写成功；**圈外写被 Claude 自身拒**（"requested permissions to write to /tmp/outside-spike.txt, but you haven't granted it yet"）；hook 输入 `tool_input.file_path` 为绝对路径 | 在"hook 不裁决"的前提下 Claude 自身是一层圈外防线；hook 拿到绝对路径，可直接判圈 |
| S5 | `--session-id <uuid>`（持久化开）后 `--resume <uuid>`：同 cwd / 换 cwd | [ok] 同 cwd 恢复上下文；[fail] 换 cwd：stderr `No conversation found with session ID`，`result.subtype=error_during_execution`、`is_error=true`、exit 1（2.1.220；2.1.223 起文档称会全局搜索） | Tier1 每任务 worktree 固定；resume 绑定 `tier1_runs.cwd` 作为**自家策略** |
| S6 | 无 `--tools` 时 `system/init.tools` | `['Task','Bash','CronCreate','CronDelete','CronList','DesignSync','Edit','EnterWorktree','ExitWorktree','Monitor','NotebookEdit','PushNotification','Read','RemoteTrigger','ReportFindings','ScheduleWakeup','SendMessage','Skill','TaskCreate','TaskGet','TaskList','TaskOutput','TaskStop','TaskUpdate','ToolSearch','WebFetch','WebSearch','Workflow','Write']`（无 Glob/Grep/MultiEdit/TodoWrite） | 必须显式 `--tools` 收窄；且 hook 脚本内再做封闭集（`*` matcher，工具面外一律 deny），不依赖 `--tools` 跨版本稳定 |
| S7 | `system/init` 字段 | `model`（`--model sonnet` → `claude-sonnet-5`）、`session_id`、`cwd`、`tools`、`permissionMode`、`claude_code_version`、`apiKeySource`、`mcp_servers`、`plugins`、`agents`、`skills`、`slash_commands`、`memory_paths`、`output_style`… | observedModel 主源 = `system/init.model` ∪ 每条 `assistant.message.model`（同一次 run 里实测出现过 `claude-sonnet-5` 与 `claude-opus-5`，`result.modelUsage` 还含 `claude-haiku-4-5-20251001`——内置辅助调用）；族校验按集合 |
| S8 | `result` 字段 | `subtype`、`is_error`、`num_turns`、`duration_ms`、`duration_api_ms`、`total_cost_usd`、`usage{input_tokens,output_tokens,cache_read_input_tokens,cache_creation_input_tokens,…}`、`modelUsage{<model>:…}`、`permission_denials[{tool_name,tool_use_id,tool_input}]`、`stop_reason`、`session_id`、`api_error_status`、`terminal_reason`、`ttft_ms` | 记账四键齐全；`permission_denials` 可与门 deny 计数对账 |
| S9 | 流内 `rate_limit_event` | `{"rate_limit_info":{"status":"allowed","resetsAt":…,"rateLimitType":"five_hour","overageStatus":"rejected","overageDisabledReason":"org_level_disabled",…}}` 每次 run 开头出现 | 订阅限流有结构化信号；本会话只见过 `allowed`，拒绝态词表待实测，设计只对**明确拒绝态**动作 |
| S10 | stdin | 不给 stdin 时 stderr 警告「no stdin data received in 3s … redirect stdin explicitly: < /dev/null」 | spawner `stdin:"ignore"`（现状） |
| S11 | `--max-turns 1` 到限（任务需两轮） | exit 1；`result.subtype=error_max_turns`、`is_error=true`、`terminal_reason=max_turns`、`num_turns=2`；到限前的 Bash **已执行** | 到限 ⇒ failed `max_turns`，不得假定零副作用 |
| S12 | `acceptEdits --tools "Read"` 读圈外 `/etc/hosts`，hook 不裁决 | [ok] Claude 自身拒（"requested permissions to read from /etc/hosts"） | 圈外 Read 在 Claude 侧缺省 = 问 = 拒；hook allow 会绕过 |
| S13 | `--setting-sources ""` 下 `system/init` | `plugins=[]`、`mcp_servers=[]`、`skills` = 内置技能表、`agents` = 内置子代理类型、`memory_paths.auto=~/.claude/projects/<cwd-hash>/memory/` | 用户级插件/MCP 被排除；内置技能只是上下文（`Skill` 不在工具面即不可调用）；auto-memory 落 HOME 侧（写入路径待 spike，§7 R-13） |
| S14 | hook 阻塞 100s 后 allow（hook `timeout:120`） | [ok] 等满 100s 后执行，`duration_ms=110208` | S2 同步等待窗可行（hook timeout ≥ 120s，脚本内 curl 110s） |
| S15 | hook `timeout:10`，脚本 sleep 40 后 deny；`acceptEdits --tools "Bash"`，命令 `echo spike-timeout` | **超时后命令照跑**（`tool_result "spike-timeout"`，`permission_denials=[]`） | 证实文档：超时 = 非阻断，落回 Claude 自身权限流；无害 Bash 会被 Claude 自动放行 |
| S16 | 同上，命令 `mkdir -p /tmp/spike-b10-dir && touch /tmp/spike-b10-dir/x && echo done` | 超时后 Claude 自身拒（"The following parts require approval: mkdir …, touch …"），文件未创建 | 落回路径对变更类 Bash 是"问=拒"，对无害类是放行 ⇒ **脚本必须先于超时自返 deny**（curl `--max-time` < hook `timeout`），不可把超时当门 |
| S17 | `--session-id` 首跑后 `--resume`（S5 同 cwd）+ 自然退出 | [ok]（S5 即此） | "result 行后立即 SIGKILL 再 resume"尚未测（§7 R-11，W5.4-a 阻塞红 B-9） |

### 1.3 SayDo Tier1 现状的接缝（坐标经抽查；细节见接缝梳理）

1. **进程 seam 只有 `AgentSpawner{version,spawn({binary,model,prompt,cwd,env,resumeChatId})}`**（`packages/daemon/src/tier1/executor.ts:77-105`），argv、终态判定硬编在 `realAgentSpawner()`（`:142-241`：`-p --force --trust --output-format stream-json --model … [--resume chatId] <prompt>`；**result 行 = 权威完成信号并立即 `hardKill()` SIGKILL 进程组**（`:185-212`）；**stderr 被吞**（`:224`））。
2. **事件解析硬耦合 cursor**：`consumeEventLine`（`:1122-1176`）用 `parseCursorLine` + 正则 `isShellToolCall`/`isStartedToolCall`（`:1178-1184`）；只消费 observed_model / result / tool_call(started)；unknown/parse_error 执行档不作废。
3. **session_id 抠取寄生在 observedModel 分支**（`:1136-1156`）；恢复链把"有 `expectedResumeSessionId`"当作"正在 resume"（`:1136-1150`、`:2236-2247`），`recoverAttempt` 据此等 30s 身份确认（`:2044-2056`）；`classifyActiveWork({requireNativeForGracefulRunning:true})` 的"graceful 且无钥匙 ⇒ failed"（`:2279,2383`；`restartPolicy.ts:279`）。
4. **门 = cursor 专属物理形态**：`.cursor/hooks.json`（`adapter.ts:42-53`，每次 spawn 前重写 `executor.ts:1078-1083`）→ `gate.sh`（`gateScript.ts:14-43`，`~/.saydo/tier1/`，`GATE_CURL_TIMEOUT_SEC=110`）→ `curl --unix-socket ~/.saydo/tier1-gate.sock POST /gate {command,cwd}`（`gateServer.ts:11-15,28-72`）→ `handleGateRequest`（`executor.ts:442-524`：drift guard → cwd 匹配 run → abort/restartPending → `++gateSeq` → `matchesFrozenVerify`/`commandToEffect`（`:462-464`）→ `decideCommand`（`gate.ts:43-71`：S0/S1 allow、S3 deny、S2 `stepConfirm` 经 `approvalFlow.request` 等 45s+5s，`:498`）→ 审计 `tier1.gate_decision` → edit 预批收据 `consumeEditSuggestion`）。**daemon 侧链后端无关；只有 hooks.json/gate.sh 两端是 cursor 形状。** `GateRequest.command` 必填（`gate.ts:16`）；edit 第四动作以命令文本 digest 绑定（`approvalFlow.ts:112-117,295-363`）；单 pending 不变量：用户正在裁决别的时不插播（`approvalFlow.ts:196-200`）。
5. **门只覆盖 shell**（校准事实 2）；**canary 是纯计数对账**（`shellStarted` vs `gateSeq`，`:557-583` 两 tick + `:1227-1234` 结算硬检；两 tick 判定不看 `approvalWaitingSince`）；04 §6 :189"不可降级"。
6. **`tier1StartupVerdict` 的 `adapter !== "cursor"` 是唯一开关**（`validateConfig.ts:103-109`，且 `:95-102` 先判 cursor 两键）；`[tier1]` 只有 `cursor_agent_bin`/`cursor_agent_pinned_version`（`config/types.ts:67-73`）并断言 `versions/<pinned>/`（`validateConfig.ts:58-65`）；后端选择键 `[models.dev].agent ∈ {claude_code,cursor,codex}`（`types.ts:26-32`；canonical `DevAgentBinding` `contracts/src/types/modelbinding.ts:48-57`，`transport` 只在 cursor 分支）；`readDevAdapter`（`index.ts:2406-2413`，缺省 cursor、**不看 profile**，三处消费 `:2406,2658,2740`）；dev 双开关 `devMode = profileDev && envDev`（`config/validate.ts:213-215`；09 :1189）；项目级 override `dev.agent: z.enum(["cursor"])`（`projectOverrides.ts:24`），`effectiveDevModel` 不看 agent（`:204-208`），`resolveRunModel` 照单用（`executor.ts:816-830`）。
7. **Tier1 没有四字段 observedModel 合同**（只有 `run.observedModel`，`executor.ts:324`；缺失 ⇒ `observed_model_missing`、跨族 ⇒ failed，`:1276-1286`）。**BYOA 侧 `verified_binary_default` 链已实施并条件武装**：`config/cliProviders.ts:25-27`（`claude_cli`/`codex_cli`）、`providers/byoa/provider.ts:134-152` `verifyBinaryIdentity`（模块私有）、`:241-246/366-372/418-427`、`consume.ts:126-136`（流内无 model 且核验通过 ⇒ `source="verified_binary_default"`、`exempted=true`）、`slotResolvers.ts:120-123,169`；`cliCapability.ts:159-166` claude 条目（`claude auth status`）、`:885-893` digest。
8. **Tier1 零计费落库**（只读 `SUM(amount) WHERE source='api'` 做熔断，`executor.ts:629-634`）；`recordCliSubscriptionInvocation`（`cost/ledger.ts:25-55`）slot 限四槽、tokens 硬编 0；`cost_entries` CHECK 只约束 source（`ddl.ts:169-172`）；`subscription_retry_queue(slot NOT NULL, kind NOT NULL,…)`（`ddl.ts:194-199`），`retryQueue.ts` 按 kind 注入 replayer（`:26 enqueueRateLimited`、`:50 sweepRetryQueue`）。
9. **恢复**：`recover()`（`:1759-1957`）优先 `--resume <native_session_id>` 并等 `system.init.session_id` 身份核验，无钥匙降级"摘要+diff 注入新会话"，graceful marker 且无钥匙 ⇒ failed；`recoverAttempt` 单次 spawn → wait → settle（`:2030-2106`），exit 1 ⇒ `finalizeFailure agent_exit:1`；`readNativeResumeKey` 对 `adapter_mismatch` 只降级新会话（`:2226-2234`）；续跑（running 无活跃 run 被 `claimNext` 捡起）永远新会话（`:1035-1042`）。
10. **steer**：`steerApplied()` 恒 `queued_delta`（`operations.ts:67-70`），`live` 为合同预留值（09 :1314）；取消 = `process.kill(-pid, SIGTERM)` → 5s → SIGKILL（`executor.ts:224-238`）；派发缺省 `maxTurns: 80` 按 tool_call started 计（`brain/liveTools.ts:398-401`、`executor.ts:625`）。
11. **BYOA 侧可复用件**：`parseClaudeLine`（`parsers.ts:162-246`：多 `tool_use` 块只留最后一块 `:200-205`、`fallback.to.model`、裸 result、`system` 族 ignore、`rate_limit_event` ignore、`user` 落 unknown）、`explainCliProcessFailure`（`processFailure.ts:60-91`；AUTH_RE 不含 "Login expired"，`:18-19`）、`isCliSubscriptionRateLimit`（`billing.ts`）、`verifyBinaryIdentity` + `CliSlotRegistration{binaryPath,binaryDigest,expectedFamily}`（`cliRuntime.ts:22-37`，封闭四槽 + 严格版本登记表）。
12. 本机 `claude` = `/opt/homebrew/bin/claude → ../lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`（npm 全局、Mach-O 单文件 256MB、`2.1.220`、owner 可写、会自更新）；`claude auth status` ⇒ `loggedIn:true, authMethod:"claude.ai"`；`cmdEffect.ts` 词表无 `cd`/`pushd`、无任何 agent CLI 词头；`SENSITIVE_PATH_RE`（`:94`）未导出且含 `token` 等宽词（本仓 `tokens.css`/`capToken.ts` 等 5 个跟踪文件命中）。
13. **无任何 claude Tier1 spike 证据**（`research/spikes/`、`e2e/spikes/` 均无）；`@anthropic-ai/*` 依赖零命中；`claude_sdk` 只在注释与文档；`tier1/adapter.ts:15-24` 的 `Tier1Adapter`/`CursorCliAdapter` 在生产零引用（仅 `tier1-security.test.ts` 用）。

### 1.4 对旧结论的更正

| 旧结论 | 更正 | 证据 |
|---|---|---|
| 07 D8（:118）「Claude Code … Agent SDK streaming … **不走 CLI**（Claude CLI 无 canUseTool，一手实测）」、弃选表（:180）；03 §5 :110「SDK canUseTool（Claude CLI 路径不可用，一手实测）」；09 :1130/:1136「claude_code ⇒ Agent SDK canUseTool 回调」；06 :35/:105、modules/c :17/:25 | "CLI 无 canUseTool 回调"仍为真；但 2.1.220 的 CLI 有 **hook 等价物**（`PreToolUse` allow/deny 裁决 S1–S3，S2 在 hook 内同步等），足以承载 Tier1 审批门；live steer 仍是 SDK/streaming-input 独有 | 1.2 S1–S4、S14–S16 |
| `parsers.ts:240`「claude observedModel 不在 system.init」 | 2.1.220 的 `system/init` 有 `model`；assistant 每条也有 `message.model` | S7 |
| HANDOFF #4/#6、ADR-002 附则④、本文 v1「豁免继续休眠」 | **BYOA 侧核验链 + 条件豁免已随 T18 落地**（流内无 model 且登记身份核验通过才触发；2.1.220 流内有 model ⇒ 实践不触发）；Tier1 `claude_code` 不使用豁免、恒 `exempted=false` | 1.3-7 |
| 04 §6 :194「Claude 会话按 cwd 哈希存、跨目录 resume 会失败」 | 2.1.220 实测坐实；2.1.223 起文档称全局搜索——SayDo 同 cwd 约束改为自家策略 | S5 |

## 2. 决策点与偏离（不代 owner 拍；每条给推荐与理由）

| # | 决策 | 推荐 | 理由 / 代价 |
|---|---|---|---|
| D1 | 传输形态：ADR-001"Claude **SDK** 薄执行器（daemon 进程内）" vs "`claude -p` 子进程" | **子进程**；ADR-001 加附注；**supersede 07 D8 的"不走 CLI"**（§5 前置项） | 主轴 = 架构复用 + 零依赖（§0）；佐证 = 政策原文（HANDOFF #6 原话本就是"Tier1 Claude Agent SDK 走同一 CLI 登录"，与 legal 页"Claude Code 和 Agent SDK 并列 ordinary usage"一致——SDK 并非政策上不可用，而是本方案不需要它）。代价：无 `canUseTool` 回调与 streaming input 原语，审批只能 hook 同步等待（S2 时延上限 = hook timeout），live steer 不在本批 |
| D2 | 后端选择键 | **（v3 改，回应 B-08 双源）不新增 `[tier1].agent`；`[models.dev].agent ∈ {claude_code,cursor,codex}` 是唯一选择键**（canonical `DevAgentBinding` 词表不变）；"产品缺省 = Claude"由 `templates/saydo.config.example.toml` 的示例值承载（W5.4-c 收口后把模板示例从 cursor 切回 `claude_code`），dev 机配置写 cursor；三处 `readDevAdapter` 消费点保持同一 resolver（缺省值随模板而非代码硬编码：代码缺省仍 cursor 直到 W5.4-c 收口，避免半接线期把用户引到未完成后端） | 一个键一处真相；项目级 override 规则见 §3.9（`dev.agent` ≠ 生效 adapter ⇒ 忽略 + 审计）；模型键按 backend 分：claude ⇒ `[tier1].model`，cursor ⇒ `[models.dev].model` |
| D3 | 工具面与权限模式 | **（v3.1）`--permission-mode default`** + `--tools "Bash,Read,Write,Edit,NotebookEdit"` + `--disallowedTools "WebFetch,WebSearch"` + `--setting-sources ""` + `--strict-mcp-config`（不传 `--mcp-config`）+ hooks 内联（`*` matcher 已由 A-04 实测选定，脚本内封闭集）；**不**用 `acceptEdits`/`bypassPermissions`/`dontAsk`；**P0 不开 `Task`**；宿主工具一律不进 | 阶段 A 实测：`acceptEdits` 下 hook 超时 ⇒ 圈内 `.env` 落盘（B-10' 红）；`default` 下 hook 超时 / 无裁决 ⇒ Claude 问 = `-p` 下 deny（X2/X3 实测文件不落盘，`permission_denials` 记录）⇒ **超时天然 fail-closed**，与 09 律③一致。代价：圈内每次 Write/Edit 都要 hook 显式 allow（本机 socket 毫秒级）；圈内 Read 在 default 下仍自动放行（X4），圈外 Read Claude 自拒（X5）且 hook 亦 deny |
| D4 | observedModel 豁免 | Tier1 对 claude 走"流内严格"：`system/init.model` ∪ 每条 `assistant.message.model` 全部 `familyOf`=claude 才通过，缺失 ⇒ `observed_model_missing` failed；`observedModelExempted` 恒 false。身份核验链（绝对路径 + digest + 版本串）随 W5.4-b 实施（复用/提升 `verifyBinaryIdentity`），用于 pin 不用于豁免。**上浮文案**（= HANDOFF #4 要求的"再次上浮"）："BYOA 侧核验链 + 条件豁免已随 T18 落地（流内无 model 且核验通过才触发；2.1.220 流内有 model ⇒ 实践不触发）；Tier1 claude_code 不使用豁免" | v1 "豁免继续休眠"是事实错误（1.3-7），HANDOFF #4/#6 与 ADR-002 ④ 的状态陈述同步更正 |
| D5 | steer：`live` | **不放开**；`queued_delta`/`cancel_resume` 不变；`steerApplied()` 不改 | 0.0(b) 的"streaming input / live steer"在 CLI 路径的载体 = `--input-format stream-json`，本批只做可行性 spike（B-6），不实现；替代路径 = `queued_delta`（下回合注入）与 `cancel_resume`，对用户如实告知（PLAN 0.0 风险行允许降级但要求如实）。**这是对 5.4/0.0(b) 的范围缩水，需 owner 在此确认** |
| D6 | 记账 | run 结束按 `result.usage` 落 `cost_entries`（`source='subscription'`、amount NULL、known=0、tokens 四键、**`kind='tier1.run'`（09 §9 前缀词表新增项，P-5 先回写）、`requests=1`（每个 run 一行；`num_turns` 进 meta，不冒充"已用 N 次"）**、meta 含 `modelUsage`/`num_turns`/`total_cost_usd_estimate`/`usage_unavailable`）；新函数 `recordTier1SubscriptionRun`（不复用四槽版）；cursor backend 同步补（只加不改）。**（v3，A-06）W5.4-a 的 B3 只产出纯对象、不 INSERT；落库与 P-5 同批（W5.4-b）** | 07 D18 纪律 3 与 09 §11-6 口径延伸到执行器 |
| D7 | 产品缺省模型 | `[tier1].model` 缺省 `opus`（别名）；自检回显 `system/init.model` | 别名由 Claude 解析；owner 可改 |
| D8 | 回合与预算上限 | `[tier1].claude_max_turns` 缺省 200（`--max-turns`，Claude 回合）；现有派发 `maxTurns: 80`（按 tool_call started 计）不动但 W5.4-c evidence 记录每能力的 `toolCalls`，若常规任务逼近 80 再上浮（Claude 无 Glob/Grep，Read 逐文件，工具调用天然多） | 两把尺子如实分清；`--max-turns` 只是防失控兜底 |
| D9 | `ask` / `--permission-prompt-tool` | hook 内同步等待 = 唯一 S2 通道；P0 不做 `--permission-prompt-tool`（MCP） | `ask` 在 `-p` 等同 deny（S2）；MCP 通道要起 stdio server 并改 `--strict-mcp-config` 口径，P1 |
| D10 | 拆批 | 三批 W5.4-a/b/c（§6），各自 IMPL-PROMPT + evidence + readback | 四阶段一批约 8–12 人日（评审员推断），超出 W5 刻度；拆批预授权只给 W7/W8（PLAN-2 §7-6），故需 owner 批准 |
| D11 | 合同时序 | §5 左栏"开批前置"项在 **W5.4-b 开批前**先回写（一致性 subagent + Codex 一次）；W5.4-a（spike + 纯函数、零行为变化）可先行 | PLAN-2 通则③"语义级变更一律先回写"；09 §11 `[tier1]` 2026-07-25 有"实现先行/时序如实"先例，若 owner 选先例路线需书面批准 |
| D12 | 身份登记承载 | (b) 新建 `~/.saydo/tier1/claude-identity.json`（`{binaryPath, binaryDigest, version, testedAt, runtimeTargetPath?, runtimeTargetDigest?, receipt}`；Windows npm `.cmd` 两个 runtime target 键成对钉住最终 JS）+ 把 `verifyBinaryIdentity` 提为共享函数；不扩 T18a 封闭四槽登记表 | 控爆炸半径；BYOA 保留 mtime/size 缓存，但 Tier1 安全门在启动与每次 spawn 前对 wrapper/JS 逐次全量重哈希；同尺寸同 mtime 替换与任一漂移均拒 |
| D13 | agent env 新增 `DISABLE_AUTOUPDATER=1`、`SHELL=/bin/sh` | 批准作为**显式注入/覆盖键**（非凭据；写进 09 §11 G4 例外） | `--setting-sources ""` 让用户 `autoUpdates=false` 失效、npm 全局路径 owner 可写、自更新会在批中途改 digest（R-1）；`SHELL` 在白名单内但值来自 owner 登录 shell，Claude 的 Bash 工具按它初始化 shell 快照会把 `~/.zshrc` 导出的变量带进 agent Bash（B11），钉成 `/bin/sh` 止漏（待 spike B-12 对照） |
| D14 | 文件读门 P0 口径 | 圈内 Read ⇒ hook 不裁决（Claude 自动放行；与 cursor Read 无门的现状持平，`.env` 圈内读残余如实）；**圈外 Read ⇒ deny**（reason 提示 agent 用 worktree 内信息；owner 预授权圈外读列 P1）。**（v3，A-09）Bash 侧同口径：只读词头（`cat/head/tail/less/sed -n/grep/…`）目标为圈外绝对路径 / `~` / `$HOME` 时，cmdEffect 升为 S2（`read` + `pathClass=outside` ⇒ 不再 S0 自动放行；两后端同受益、只升不降）；敏感路径仍按既有词表再升。`/etc/passwd`、`~/.claude/projects/...` 等不再自动放行** | v1 "圈外 Read S2 上浮"会撞单 pending 不变量（并行 Read 突发多张收据 ⇒ 近乎恒拒）且 `SENSITIVE_PATH_RE` 宽词会让圈内 `tokens.css` 都上浮；P0 取最简 fail-closed；Bash 读圈外取 S2 而非 deny 是因为 Bash 读不会并行风暴且人可批 |

## 3. 机制设计

### 3.1 Backend seam（最小拆分，不重写执行器）

把 `realAgentSpawner()` 里硬编的 cursor 细节抽成 `Tier1Backend`（新目录 `packages/daemon/src/tier1/backends/{cursor,claude}.ts`），执行器只认接口：

```
interface Tier1Backend {
  readonly adapter: AdapterKind;                      // "cursor" | "claude_code"
  buildArgv(i: {model; prompt; resumeKey?; sessionId?; settingsJson?; maxTurns?}): string[];  // 纯函数,§12-9 快照断言;(v3,B-01)AgentSpawner.spawn 入参同步增 settingsJson/sessionId/maxTurns(可选,cursor 忽略)
  provisionHooks(cwd, gate: GatePaths): {extraArgs: string[]; filesWritten: string[]};         // cursor 写 .cursor/hooks.json;claude 返回 --settings 内联
  parseLine(line): Tier1Event;                        // 规范化:init{session_id,model,tools,permissionMode,apiKeySource} | observed_model | tool_started{tool}(逐块) | tool_result{tool,isError} | rate_limit{status,resetsAt} | result{…} | ignore | unknown
  isTerminalResult(line): boolean;                    // result 行
  finishPolicy: "kill_on_result" | "wait_exit_then_kill";   // cursor 前者(校准事实 3b);claude 后者:result 后等自然退出 ≤ 5 s(v3,C-06 定量),再 SIGTERM→5s→SIGKILL
  canaryLeft: "shell_started" | "tool_result";             // (v3,A-10)canary 左值按 backend:cursor 仍 shellStarted,claude 用门后 tool_result 计数;checkCanaries 的 cursor 分支禁改
  explainFailure(exit, stderrTail, lines): {code; message};   // 复用 processFailure(AUTH_RE 补 "Login expired")
}
```

`AgentSpawner.spawn` 继续负责进程（`spawnRuntimeChild` + 进程组 + 终态 + kill），改动两处：**(a) stderr 不再吞**——有界环形缓冲（与 BYOA runner 同口径）经 `AgentProcessHandle.stderrTail?(): string`（**可选方法**，v3 A-10：测试 fake handle 可不实现）暴露；**(b) finish 按 backend 的 `finishPolicy`**。`consumeEventLine` 改吃 `backend.parseLine`（cursor backend 内部保留原正则）。B1 先做"cursor 抽取"独立提交，**验收改为三句可判定（v3，A-10，取代"零行为变化 / 一字不改"）：① cursor 的 argv、事件解析、`kill_on_result`、canary 左值 `shellStarted` 不变（快照断言）；② 既有 `tier1-*.test.ts` 的**期望值**零改动（允许为新可选入参 / 可选方法补类型或 fake 的一行适配，并在 evidence 逐行登记）；③ `just ci` 绿**。`tier1/adapter.ts` 的死代码 `Tier1Adapter`/`CursorCliAdapter`：B1 明确**不动**（仍供 `tier1-security.test.ts`），避免实施会话二选一；合并/删除列为 W5.4-c 顺带项。**这是 08-15 决策文档 §四-2 点名的 Runner seam 的最小版**，不引入 native loop。

### 3.2 启动 argv / env / cwd（claude backend；终版，W5.4-a 的 spike 全部按此重跑）

```
claude -p --output-format stream-json --verbose
       --model <[tier1].model>
       --permission-mode default         # v3.1:不用 acceptEdits(B-10' 红);圈内写由 hook 显式 allow
       --tools "Bash,Read,Write,Edit,NotebookEdit"
       --disallowedTools "WebFetch,WebSearch"
       --setting-sources ""            # 不读 user/project/local settings:worktree 里 agent 可写的 .claude/settings.json 注不进 hooks/权限(待 spike B-14 证实)
       --strict-mcp-config             # 且不传 --mcp-config ⇒ 零 MCP
       --settings '<内联 JSON: hooks>'  # daemon 构造,纯函数,快照断言;matcher 形态由阶段 A 的 A-04 spike 定(见 §3.3),未证前不得当作封闭集
       --max-turns <[tier1].claude_max_turns>
       --session-id <uuid>             # 首跑:daemon 预生成,先落 tier1_runs.native_session_id(未确认态);续跑/恢复改用 --resume <uuid>
       <prompt>
```
- **不加** `--no-session-persistence`（要 resume）、`--bare`（不读 OAuth）、`--dangerously-skip-permissions`、`--add-dir`、`--fallback-model`（observedModel 纪律）、**`--permission-mode acceptEdits`**（v3.1）。
- env = `strippedAgentEnv`（`executor.ts:109`）+ 显式注入 `DISABLE_AUTOUPDATER=1` + 覆盖 `SHELL=/bin/sh`（D13）；`stdin:"ignore"`。
- cwd = worktree；`--resume` 只在 `tier1_runs.cwd` 与当前 worktree realpath 相等且钥匙已确认时使用（自家策略）。
- 残留（如实）：`--setting-sources ""` 挡不住内置 auto-memory 与 worktree 内 `CLAUDE.md` 加载；auto-memory 的写入路径（是否经 Write 工具；若经工具则圈外 deny 会产生噪音）待 spike B-13，两种处置见 §7 R-13；transcript 落 `~/.claude/projects/<cwd-hash>/*.jsonl`，含 worktree 内文件内容——超出 SayDo privacy 口径的部分登记到诚实残余（§4）。

### 3.3 门（shell + 文件工具，同一条 daemon 决策链）

**hooks 内联 JSON**（`buildClaudeHooksSettings(gateScriptPath, hookTimeoutSec)`，纯函数；`hookTimeoutSec = cfg.hooksTimeoutSec ?? 120`，断言 `> GATE_CURL_TIMEOUT_SEC(110) + 余量`）：
```
{"hooks":{"PreToolUse":[{"matcher":"*","hooks":[{"type":"command","command":"<~/.saydo/tier1/gate-claude.sh>","timeout":120}]}]}}
```
**matcher（v3，A-04）**：目标是"工具面内外的每一次工具调用都进脚本"。`*` 在 2.1.220 是否按正则编译（`RegExp("*")` 非法）**未证**：阶段 A 增加阻塞红 **A-04 spike**——终版 argv（`acceptEdits` + 五工具 + `--disallowedTools` + `--setting-sources ""` + `--strict-mcp-config` + 内联 `--settings`）下分别测 matcher `*`、`.*`、显式并集 `Bash|Read|Write|Edit|NotebookEdit|Task|WebFetch|WebSearch|Glob|Grep|MultiEdit|Skill|Workflow`，判定 = hook-input 日志里 **Bash 与 Write 各至少一条**、`tool_name` 正确；选用实测能覆盖全集且不报错的形态写进 `buildClaudeHooksSettings`；没有任何形态能同时覆盖 Bash 与 Write ⇒ 阻塞红停批。脚本内仍按封闭集分支，工具面外 ⇒ deny。

**`gate-claude.sh`**（daemon 生成、每次启动原子重写、与 `gate.sh` 同目录、同一 drift guard——`gateScriptExpected` 扩为两脚本 digest 集合；启动/自检时物理跑一次 hook 链：jq/curl 存在 + socket 可达，B3 残余登记）：读 stdin → `jq -e` 校验对象与 `tool_name` 字符串 → 按工具分支：
- `Bash`：`command` 非空串否则 deny；POST `{"kind":"command","command":.tool_input.command,"cwd":.cwd}` → daemon `permission` → **allow/deny 显式输出**（Bash 在 `acceptEdits` 下变更类会被 Claude 问=拒，所以 S0/S1 必须显式 allow；**Bash 的 allow 会绕过 Claude 自身权限询问（S3），因此 daemon 对 Bash 只在 S0/S1 或 S2 获批时才回 allow——圈外绝对路径读按 D14 v3 升 S2，不再自动 allow**）。
- `Write|Edit|NotebookEdit`：POST `{"kind":"file_write","tool":.tool_name,"path":(.tool_input.file_path // .tool_input.notebook_path),"cwd":.cwd}`；daemon 返回二态：**`allow`**（圈内非敏感 ⇒ 立即 allow；圈内敏感基名 ⇒ S2 上浮获批后 allow）/ **`deny`**（圈外、判不出、祖先不存在、S2 拒或超时）。**（v3.1）`--permission-mode default` 下圈内写必须显式 allow**（无裁决 = Claude 问 = `-p` deny，X3）；**（v3，A-01/A-02）圈外写没有 S2 通道：一律 deny**——Claude 自身对圈外写的拒绝（S4/X5）仍是第二层（hook 从不对圈外回 allow）。
- `Read`：POST `{"kind":"file_read","path":.tool_input.file_path,"cwd":.cwd}`；圈内 ⇒ `no_decision`（default 模式下 Claude 自动放行圈内读，X4）；圈外 / 判不出 ⇒ `deny`（D14；Claude 自身亦拒，X5）。
- 其它 `tool_name`（含 `Task`/`WebFetch`/宿主工具）⇒ 直接 deny（工具面外，fail-closed）。
输出形状：allow ⇒ `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}`；deny ⇒ `…"deny","permissionDecisionReason":<agent_message>`；no_decision ⇒ 空输出 + `exit 0`。**失败路径（v3，A-03）= 同时输出 deny JSON 并 `exit 2`**：jq 缺失（脚本用 shell 内置 printf 输出静态 deny JSON，不依赖 jq）/ stdin 非 JSON / 缺字段 / curl 不通 / curl 超时 / 响应非 JSON / 未知三态值 ⇒ deny + `exit 2`；`curl --max-time 100`、hook `timeout 120`（余量 20s：脚本自返 deny 必须先于 Claude 的 hook 超时——S15/S16 证实 hook 超时 = 非阻断、落回 Claude 自身权限流，**不是 deny**；09 §11 律③对 `claude_code` 单列改写进 P-4：vendor 超时 ≠ deny，脚本超时前自返 deny 才是门）。阶段 A 阻塞红 **B-10'** 实测：`acceptEdits` 下红（`.env` 落盘）；**v3.1 改 `default` 模式后复测（X2，同 hook 同 prompt）文件不落盘、`permission_denials` 含该 Write** ⇒ 以 `default` 为终版，B-10' 口径改为"`default` 模式下超时不落盘"。

**daemon 侧**：`GateWireRequest` 从 `{command,cwd}` 扩成 `z.union([legacy{command,cwd}, {kind:"command",…}, {kind:"file_write",…}, {kind:"file_read",…}])`——**无 `kind` 时不注入键**（既有 `tier1-gate-socket.test.ts` 的 `toEqual([{command,cwd},…])` 零改动），handler 内按 `"kind" in req` 分叉。`handleGateRequest` 的 drift guard、cwd→run 匹配、`abort/restartPending`、`gateSeq` 递增、审计、edit 预批消费全部复用，只在"算 effect"与"响应三态"分叉：
- `command` ⇒ 现状（`matchesFrozenVerify` → `commandToEffect`）；
- `file_write` ⇒ 新纯函数 `fileToolToEffect(tool, path, cwd)`（**v3，A-01 归一算法**：对"现存的最长祖先目录"做 `realpathSync`，再拼未存在的后缀；祖先也不存在 / 路径非绝对且无法相对 cwd 解析 / realpath 抛错 ⇒ 返回 `{kind:"delete_data",target:"write-outside-worktree",reason:"unresolvable"}`（**S3 deny，不是 S2**）；归一后以 worktree realpath 为前缀（含 `/` 边界）⇒ 圈内 `{kind:"write_worktree"}`；否则（`..`、`~`、`$HOME`、符号链接逃逸、盘符、大小写在大小写不敏感 FS 上按 realpath 结果判）⇒ 圈外 `{kind:"delete_data",target:"write-outside-worktree"}`（S3）；圈内且 `SENSITIVE_FILE_BASENAME_RE`（新导出、按文件名收窄：`.env*`/`*.pem`/`*.key`/`id_rsa*`/`id_ed25519*`/`.npmrc`/`.netrc`/`credentials*`）⇒ `touchesSensitiveData`（⇒ S2 上浮）；**"判不出 ⇒ install_dependency/S2" 条款删除**）；
- `file_read` ⇒ 圈内 `{kind:"read"}` ⇒ `no_decision`；圈外 / 判不出 ⇒ deny（审计记 `tier1.gate_decision` kind=file_read，不上浮，D14）。
- 响应映射（v3.1，与 effect 表同一句话）：圈内非敏感写 ⇒ **allow**；圈内敏感写 S2 ⇒ `stepConfirm`（文案：「要改敏感文件 <脱敏基名>，批准吗」）⇒ allow/deny；**圈外或判不出写 ⇒ deny（永不 S2、永不 allow）**；圈内 Read ⇒ `no_decision`；圈外 Read ⇒ deny；command S0/S1 ⇒ allow；command S2 ⇒ `stepConfirm` ⇒ allow/deny；S3 ⇒ deny。
- 收据与审计：文件请求的 `GateRequest.command` 填合成串 `"<tool> <abs path>"`，`meta.kind` 标明；**edit 第四动作对文件请求不适用**（`consumeEditSuggestion` 按 kind 匹配，文件 kind 返回"不适用"）；审计 `tier1.gate_decision.meta` 增 `tool`/`kind`（additive）。
- **cmdEffect 收紧（W5.4-a B2，只升不降，两后端同受益；v3 按 B-02/B-03/B-04/A-09 补齐）**：`cd`/`pushd` 目标圈外 ⇒ S3、圈内 ⇒ S1、含变量/命令替换或 `cd -` ⇒ S2；**`cd` 无参数 / `cd ~` / `cd $HOME` / `pushd` 无参数 ⇒ 圈外 S3**（Claude 的 Bash 工具 cwd 跨调用持久，B10；spike B-11 证实后生效，未证实也保留收紧）；判定在**剥 wrapper/`sudo`/`env`/`command`/`exec` 之后**做（与既有词表同一前处理）；agent CLI 词头（`claude`/`cursor-agent`/`codex`/`grok`/`gemini`/`qwen`/`copilot`）⇒ S3 `send_external spawn-unsupervised-agent`（嵌套无监管 agent 共享同一登录态、其工具调用不在外层事件流）；任意 token 含 `--dangerously-skip-permissions`/`bypassPermissions`/`--permission-mode`/`--yolo` ⇒ S3；**`--force` 只在 agent CLI 词头语境下算 S3**（`git push --force` 仍走既有 force-push S3、`npm run build --force` 仍 S1）；只读词头目标为圈外绝对路径 / `~` / `$HOME` ⇒ `read` + `pathClass=outside` 升 S2（A-09）。

**canary 口径（不可降级；v3 按 backend 分左值，A-10）**：`cursor` 左值不变 = `shellStarted`（`checkCanaries` 的 cursor 分支禁改）；`claude_code` 左值 = **门后事件**——`user` 事件里 `tool_result` 块（按 `tool_use_id` 反查工具 ∈ 封闭集）的计数（assistant 事件先于 hook，且一条消息可含多个 tool_use，用它做左值会在 S2 等待期误 trip，B1）；右值 = `gateSeq`；`parseLine` 逐块产出 `tool_started`/`tool_result`。仍是两 tick 差 trip + 结算硬检；另加 settle 三方对账进审计（只记录不 trip，先观察一批）：`gate-fired.log` 计数 vs `gateSeq` vs `result.permission_denials.length`——**关系是 `permission_denials.length >= 门 deny 数`（多出的 = Claude 自身 deny，即 hook 未裁决/失效信号，写入审计），不得写成等式当绿门（v3，A-07）**。

**并发 S2**：Claude 会并行发起多个工具调用；单 pending 不变量下第二张收据不插播（`approvalFlow.ts:196-200`）。本批策略：hook 等待串行化——同一 run 内第二个 S2 请求在前一个未决时直接 deny 并给 agent 明确提示"等待审批结果后再试"；`approvalWaitingSince` 改为区间并集计时。

### 3.4 事件解析、session、observedModel

- `parseLine`：**（v3，A-05）禁止调用 `parseClaudeLine()`**（它只保留最后一块 `tool_use`、`system` 族一律 ignore、`rate_limit_event` ignore，会把 init/限流/并行工具全吞掉）。新写 `parseClaudeTier1Line(line)`：只借鉴其块级循环写法，分叉产出 `init{session_id,model,tools,permissionMode,apiKeySource,claudeCodeVersion}` / `tool_started{tool,toolUseId}`（**每块一条**）/ `user` ⇒ `tool_result{toolUseId,isError}` / `rate_limit{status,resetsAt,rateLimitType}` / `result{…}` / `observed_model` / `ignore` / `unknown`；unknown/parse_error 执行档仍不作废（现状），计数进审计。单测必须用 `tool_use_multi` fixture 断言两块都计、用 `init` fixture 断言 `apiKeySource` 与 `tools` 字段存在（阶段 A 另加 `system/init.tools` 恰为五件且不含 `Task` 的断言，B-10）。
- **session 身份**：首跑 daemon 生成 uuid 经 `--session-id` 传入，落 `tier1_runs.native_session_id` + 新列/标记 `native_session_confirmed=0`；`system/init.session_id` 对上 ⇒ 置 1（审计 `tier1.session_identity_confirmed`）；不等 ⇒ kill + failed `native_session_mismatch`（审计 `tier1.session_identity_mismatch`）。恢复链/reconciler "按列判 resumable" 改为看 `confirmed`；`recover_resume_native` 审计只在真 resume 时记（`expectedResumeSessionId` 字段不再重载首跑语义，改名 `expectedSessionIdentity` + `isResume` 布尔）；`reserved` 行恢复重生成 uuid 覆写。
- observedModel：`run.observedModels: Set<string>` 收集 `system/init.model` 与每条 `assistant.message.model`（含带 tool_use 的 assistant 事件）；settle 时 `familyOf` 全为 claude 且非空 ⇒ 通过；`run.observedModel` 取 `system/init.model`（展示）。四字段（09 §11 规则 3）进 `tier1.settled_review`/`tier1.blocked`/`tier1.failed` 审计 meta（`observedModelSource:"stream"`、`observedModelExempted:false`；additive，不改 DDL）。
- `apiKeySource !== "none"` ⇒ 立即终止并 failed `subscription_auth_violation`（HANDOFF #6 机械化；时点 = 收到 init 即判，spike B-15 确认 init 前是否已有 API 请求在途）。

### 3.5 settle / verify / 验收

不变（daemon 侧跑登记模板，`settleCoding`/`settleWriting`、`commitSettle`、回叫链与后端无关）。终态分类纯函数 `classifyClaudeRunOutcome(result, rateLimitEvents, stderrTail, exitCode, abort)`：`success` ⇒ settle；`error_max_turns` ⇒ failed `max_turns`（到限前工具已执行，不得假定零副作用；worktree 保留；**不 settle、不跑 verify**——verify 只在 settle 路径跑，v3 B-09 定一）；`is_error` 且限流词表 ⇒ `subscription_rate_limited`（blocked，§3.8）；`auth_required`（AUTH_RE 补 "Login expired"/"Please run /login"）⇒ blocked；`error_during_execution` + stderr `No conversation found` ⇒ `resume_not_found`（§3.6）；exit 143 ∧ run.abort ⇒ cancel/steer_resume 结算（现状）；exit 143 ∧ 无 abort ⇒ failed `agent_killed_externally`；其余 ⇒ failed `agent_exit:<code>`。

### 3.6 steer / cancel / resume

- `queued_delta`：新 attempt 在认领时查同 task 上一条 run 的 `(adapter, native_session_id, cwd, native_session_confirmed)`——四者规范化等值且已确认才 `--resume`，否则新会话并审计 `tier1.resume_skipped_<reason>`；prompt = delta + 续跑约定。
- `cancel_resume`：SIGTERM 进程组（Claude 终止 Bash 子树、跑 SessionEnd、exit 143）→ 5s → SIGKILL（现状）；恢复时同上规则。
- 恢复：`claude_code` 的 running run：钥匙已确认 ∧ cwd 等值 ⇒ `--resume`；否则降级摘要+diff 新会话（现状）；graceful marker ∧ 未确认 ⇒ failed（现状语义保留，只是条件改为"未确认"）。**resume 失败**（`resume_not_found`）⇒ 审计 `tier1.recover_resume_failed`，清 ownership 后以新会话**只重试一次**。**adapter 切换**（`row.adapter !== cfg.adapter`）⇒ 按"inconsistent"口径 reap + 任务 blocked 叫人，不跨后端接续（F-14）。
- `live`：不放开（D5）。

### 3.7 身份核验与版本 pin（ADR-002 附则②、HANDOFF #4）

- `[tier1].claude_bin`（绝对路径，缺省 = `which claude` 的 realpath；symlink 解析到实体文件）、`[tier1].claude_pinned_version`（精确串，如 `2.1.220`；`claude --version` 首 token 比对，`assertExactVersion` 复用）。
- 登记承载 = `~/.saydo/tier1/claude-identity.json`（D12），由自检写入；启动与每次 spawn 前 `verifyBinaryIdentity`（提为共享函数）——Tier1 对 wrapper 与 runtime target 逐次全量重哈希，不使用 mtime/size 缓存；Windows npm `.cmd` 同时整份校验受支持的 cmd-shim 模板与最终 JS 路径/digest；不符 ⇒ `binary_identity_mismatch` 不认领 + 处方化提示；`DISABLE_AUTOUPDATER=1` 注入（D13）。
- 豁免不启用：`observedModelExempted` 恒 false（D4 上浮文案）。

### 3.8 订阅面：记账 / 限流 / 登录过期 / 并发预检

- 记账：`recordTier1SubscriptionRun(db,{taskId,runId,adapter,model,usage,modelUsage,numTurns})` → `insertCostEntry`（`kind='tier1.run'`（P-5 回写后）、`source='subscription'`、amount NULL、known 0、tokens 四键、**`requests=1`，`num_turns` 进 meta**；`usage_unavailable:true` 时四键记 0——二者可同时为真：`usage_unavailable` 表示"供应商未回 usage"，四键 0 表示"不可得"不表示"零消耗"，meta 显式并存，B-11）；cursor 同步补。W5.4-a 只产纯对象不落库（A-06）。
- 限流：只对**明确拒绝态**动作——`rate_limit_event.rate_limit_info.status` 命中拒绝词表（spike 待取；本会话只见 `allowed`）或 `result` 命中 `isCliSubscriptionRateLimit("claude_cli")` ⇒ blocked（reason `subscription_rate_limited`，带 `resetsAt`）+ `subscription_retry_queue` enqueue（`slot="tier1"`、`kind="tier1_run"`、`not_before=resetsAt`）+ 通知一次；replayer = `retryTask`（blocked→running）→ 认领循环按 §3.6 规则 `--resume`；再限流 ⇒ 指数退避（现成）；`expired` ⇒ 通知 + 保持 blocked。**不**静默转 API 计费（07 D18 纪律 3）。
- 登录过期 ⇒ blocked `auth_required` + 通知「请在终端跑 `claude` 并 `/login`」+ 不自动重试。
- 并发预检（PLAN-2 风险 ⑥）：本批只做观测展示（`rate_limit_event.resetsAt` → 设置页"五小时窗重置时间"），不做闸，如实。

### 3.9 配置、启动校验、产品缺省切换、自检

- `[tier1]`（09 §11 :1139 additive）：`agent`（D2）、`claude_bin`、`claude_pinned_version`、`model`（claude 专用，缺省 `opus`）、`claude_max_turns`（缺省 200）；cursor 两键不动。模型键按 backend 单源：claude ⇒ `[tier1].model`（+ 同词表的项目 override）；cursor ⇒ `[models.dev].model`。
- `tier1StartupVerdict`：先按生效 adapter 分叉再校验（现 `:95-109` 的顺序重排）；claude 分支：bin 绝对路径+存在+可执行、pinned 非空、`model` 解析出 claude 族（别名 `opus/sonnet/haiku/fable` 与 `claude-*`）、identity 登记存在；cursor 分支输出形状不变；其余 `unsupported_adapter`（文案更新）。既有 `tier1-config-validate` 13 例允许且仅允许两处改动：`claude_code` 从 `unsupported_adapter` 改为 `not_configured`+处方含 claude 键名；codex 维持。
- 产品缺省切换：`readDevAdapter()` 三处消费改为 `resolveTier1Adapter(cfg)`（D2 规则）；项目 override：`dev.agent` 放开 `claude_code`，但 `dev.agent !== 生效 adapter` ⇒ 忽略 + 审计 `tier1.model_override_ignored_adapter_mismatch`。
- setup 自检（`POST /api/setup/test scope=tier1`）：`claude --version` == pinned、`claude auth status` loggedIn、hook 链物理自检（jq/curl/socket）、一发一收 `-p --tools "" --max-turns 1 "reply OK"` 取 `system/init`（`apiKeySource=="none"`、族、`claude_code_version`、`permissionMode`）、写 identity 登记、回显设置页；不过 ⇒ 不认领。
- 控制台：设置页 Tier1 卡（后端/模型/版本/登录态/自检/五小时窗）；任务详情显示 adapter + observedModel；`api/setup.ts:287-300,1222` 读 `models.dev.agent` 的设置态改走 resolver。

### 3.10 语音与 UI 触点

- S2 上浮文案新增文件工具分支（10 #19 槽位）；S3 拒绝话术不变（04 §5.1 :141）；新 blocked 原因（限流/登录过期/身份漂移/max_turns）的人话进 10 状态词表（不说"完成"）；prompt 执行约定按 backend 措辞（现 "不要改动 .cursor/ 目录"，`executor.ts:1107`，对 claude 改为 "不要改动 .claude/ 目录"）。

## 4. 安全矩阵（claude_code 后端 vs cursor 后端，如实分行）

| 面 | cursor（现状） | claude_code（本方案） | 说明 |
|---|---|---|---|
| shell 命令门 | `beforeShellExecution` hook → gate.sh → socket；deny-only，`--force` 放行非 deny | `PreToolUse[*]` hook → gate-claude.sh → 同一 socket；Bash 显式 allow/deny | daemon 决策链完全相同（`decideCommand` + `commandToEffect` 单源） |
| 文件写门 | **无**（内置 write 工具免门，校准事实 2） | `fileToolToEffect` → 同链；`default` 模式：圈内非敏感显式 allow、圈内敏感 S2 获批才 allow、**圈外 / 判不出 一律 deny（无 S2 通道、hook 永不对圈外回 allow）**；hook 超时 / 无裁决 ⇒ Claude 问 = `-p` deny（X2/X3），Claude 自身对圈外写的拒绝仍是第二层 | 净提升；超时 fail-closed（v3.1） |
| 文件读 | 无门 | Read 工具：圈内 `no_decision`；圈外 deny（D14）。Bash 只读词头目标为圈外绝对路径 / `~` / `$HOME` ⇒ S2 上浮（不再 S0 自动 allow；v3 A-09）；敏感路径再升 | 两面口径已对齐为"圈外不自动放行"；Bash 读圈外取 S2（人可批）而非 deny |
| egress | uncontrolled（如实） | uncontrolled（WebFetch/WebSearch 禁用；Bash curl 经 cmdEffect S2/S3） | 都不是网络栈隔离（04 §5.3） |
| hooks 完整性 | `.cursor/hooks.json` 在 worktree 内（agent 可写）+ gate.sh digest 补偿 + canary | hooks 由 `--settings` 内联（进程参数，agent 不可改）+ `--setting-sources ""`（**B-14 矩阵全阻塞红：`disableAllHooks` / `permissions.allow` 放行 Bash / `additionalDirectories:["/tmp"]` 再 Write `/tmp/x` / worktree settings 覆盖 matcher——任一仍生效 ⇒ 不能声称命令行 hooks 是唯一门，停批**，v3 A-08）+ gate-claude.sh 纳入同一 drift guard + canary；**残余**：hook 进程被 timeout 杀或脚本不可执行时在 Claude 侧 = 非阻断、落回 Claude 自身权限流（S15/S16：无害 Bash 放行、变更类问=拒、圈内写在 acceptEdits 下自动）——脚本失败路径一律 deny + `exit 2`、curl 100 < hook 120 自返 deny、启动自检物理跑 hook 链 + canary 两 tick 兜底，如实登记 | 净提升但非全封闭 |
| 审批语义 | S2 在 hook 内同步等（curl 110 < hook 120） | 同；`ask` 在 `-p` 等同 deny；并发 S2 串行化（第二张直接 deny + 提示） | `hookTimeoutSec ≥ 120`、脚本自返 deny 先于超时（A1/F-02） |
| 版本与身份 | `versions/<ver>/cursor-agent` 绝对路径 + 精确版本串；无 digest | 绝对路径 + 精确版本串 + shim/最终 JS sha256 digest 登记（`claude-identity.json`）+ `DISABLE_AUTOUPDATER=1` | 净提升；升级须重跑仪式 |
| 模型身份 | `system.init.model` 严格 | `system/init.model` ∪ `assistant.message.model` 集合严格；`apiKeySource` 必须 `none` | 净提升 |
| 进程与取消 | 进程组 SIGTERM→SIGKILL；result 即 SIGKILL | 进程组 SIGTERM→SIGKILL；result 后等自然退出再收（`finishPolicy`，保 transcript/SessionEnd 完整，待 B-9 证实必要性） | 同级 |
| env | `AGENT_ENV_ALLOWLIST` | 同 + 显式 `DISABLE_AUTOUPDATER=1` + `SHELL=/bin/sh`（防 profile 快照泄漏，B11/B-12） | G4 不变（两键非凭据，写进 09 §11 例外） |
| 恢复 | `--resume chatId` + session 身份核验 | `--resume uuid`（钥匙先于进程存在但**须确认**）+ `system/init.session_id` 核验 + 同 cwd 约束 + resume-not-found 降级一次 | 同级；cwd 约束与确认位是新增硬条件 |
| 嵌套 agent / 子代理 / MCP / 宿主工具 | cmdEffect 未知词头 S2 | `Task` P0 不开；`--strict-mcp-config` 零 MCP；宿主工具不在 `--tools` 且脚本封闭集 deny；Bash 内起 `claude`/`cursor-agent`/`codex`/`grok` 或带 bypass 旗标 ⇒ S3（cmdEffect 收紧，两后端同受益） | 工具面封闭 |
| 订阅限流 / 登录过期 | 无处置（归 process_exit） | `rate_limit_event` 明确拒绝态 + `result` 分因 → blocked + durable 重放 / 人工恢复 | 净提升 |
| 隐私残余 | cursor 自身会话存储 | transcript（`~/.claude/projects/<cwd-hash>/*.jsonl`）含 worktree 内文件内容；auto-memory 落同目录 | 如实登记（B13、R-13） |

## 5. canonical 回写清单（additive；本文不直接改）

**左栏 = 开批前置（语义级；PLAN-2 通则③，W5.4-b 开批前先回写 + 一致性 subagent + Codex 一次）**：

| # | 文件 | 变更 |
|---|---|---|
| P-1 | `docs/07-tech-stack-decisions.md:118`（D8 行）/`:180`（弃选表）/`:204`/`:230`/`:255` | supersede"Claude Code … 不走 CLI"：改为"CLI `-p` + `PreToolUse` hooks（allow/deny 裁决 S1–S3，S2 hook 内同步等；`ask` 在 `-p`=deny；hook 超时=落回 Claude 自身权限流）= canUseTool 等价物；live steer/streaming input 仍 SDK 独有，本批不做" |
| P-2 | `docs/adr/design/ADR-001-execution-layer.md` | 附注（2026-08-19）：路径一后端的传输形态 = `claude -p` 子进程（不是进程内 SDK），原因 = 架构复用 + 零依赖（政策原文佐证）；"产品缺省 = Claude"与 canUseTool 语义（hook 等价）不变 |
| P-3 | `docs/adr/ADR-002-byoa-observed-model.md` 附则④ + HANDOFF #4/#6 | 状态更正：BYOA 侧核验链 + 条件豁免已随 T18 落地（流内无 model 且核验通过才触发；2.1.220 流内有 model ⇒ 不触发）；Tier1 `claude_code` 不使用豁免；owner 确认日期 |
| P-4 | `docs/09-data-contracts.md` §11 :1139 `[tier1]` 承载段 + §11 config 示例块 | 补 `claude_bin`/`claude_pinned_version`/`model`/`claude_max_turns` 键与缺省（选择键仍 `[models.dev].agent`，v3 D2）、项目 override 规则；`GateWireRequest` 判别联合（无 `kind` = command）与 gate-claude.sh/双脚本 drift guard；**律③对 `claude_code` 单列改写（vendor hook 超时 ≠ deny；脚本失败路径 deny + exit 2 且自返先于超时）**；`native_session_confirmed` 列（DDL additive，B-07）；G4 显式注入键 `DISABLE_AUTOUPDATER`/`SHELL` |
| P-5 | `docs/09-data-contracts.md` §9 词表 / §11-6 / §13 | `cost_entries.kind` 前缀词表新增 `tier1.run`（`source='subscription'`、`requests=1`、`num_turns` 进 meta）；`subscription_retry_queue` 的 `slot="tier1"`/`kind="tier1_run"`；四字段在 Tier1 审计 meta 的承载；`steerTask` 注"claude_code 接入后 live 仍预留（CLI 单向）"（:1314）；`DevAgentBinding.claude_code` 分支加可选 `transport:"cli"`（:1130/:1136 的 "Agent SDK canUseTool 回调" 改为 hook 等价） |

**右栏 = 随批补录（additive，W5.4-c 收口攒批）**：

| # | 文件 | 变更 |
|---|---|---|
| R-1 | `docs/03-architecture.md:110/116/170` 能力矩阵 | Claude 行：审批 = CLI hooks（等价）；steer = CLI 单向；恢复 = 同 cwd 自家策略（2.1.223 起 `--resume` 全局搜索） |
| R-2 | `docs/04-key-mechanisms.md` §5.4 :173 / §6 :189 / :194 | "如 Claude SDK"→"如 Claude Code（CLI/SDK）"；审批门完整性一句改为"cursor_cli / claude_code 后端"并写 hooks 内联注入差异与超时非阻断残余；恢复一句补"同 cwd 自家策略" |
| R-3 | `docs/09-data-contracts.md` §12-9 | 反例追加：claude argv 快照（acceptEdits/五工具/disallowed/setting-sources 空/strict-mcp/settings 内联/无 bypass/no `--no-session-persistence`）、hooks JSON 快照（`*` matcher、timeout ≥ 120）、file_write 圈外 deny / 圈内 no_decision、Read 圈外 deny、`apiKeySource≠none` 拒、resume 跨 cwd 降级、`Task`/宿主工具不在面、cd 圈外 S3、agent CLI 词头 S3 |
| R-4 | `docs/06-references.md:35/105`、`docs/05-roadmap.md:35`、`docs/modules/c-control-bridge.md:17/18/25` | 术语与适配器矩阵行 |
| R-5 | `docs/10-voice-ux-spec.md` #19 与状态词表；`docs/11-ui-spec.md` 设置页 Tier1 卡 | S2 文件工具文案分支；新 blocked 原因人话；设置页卡 |
| R-6 | `e2e/evidence/tier1-conformance.md` | 加 claude 列（含诚实残余：hook 异常非阻断、transcript 隐私、Bash 读圈外 S0） |
| R-7 | HANDOFF §2 #4/#6/#11、§3 环境、§5 实测知识 | #6 落地状态、#4 上浮结论、#11 ③ 文案、claude 版本/登录态、spike 事实 |
| R-8 | 代码内文案与注释 | `validateConfig.ts:107` 拒起文案、`operations.ts:60-64` 注释、`parsers.ts:240` 注释、`executor.ts:1107` prompt 约定按 backend |

## 6. 分批、阶段与验收锚（IMPL-PROMPT 照抄；每项可判定；阶段 A 的"红"分级）

### W5.4-a · spike 固化 + 纯函数层 + cursor seam 抽取（可离线验收；不需要合同前置；v3 删去"零行为变化"的说法，验收见三句可判定锚）

**阶段 A · spike 固化**：`e2e/spikes/claude-cli-tier1/`（`run.sh`：每条 = 命令 + 期望 grep + 退出码；`RESULT.md` 附三个 hook 脚本原文与每条的判定；原始 jsonl 入 `.tmp/`（不入 Git），RESULT 记 sha256；**全部按 §3.2 终版 argv 重跑**；golden fixture 落 `packages/daemon/test/fixtures/claude-cli/2.1.220/{init,tool_use_multi,tool_result,result_success,result_max_turns,rate_limit,resume_fail}.jsonl`）。
- **阻塞红**（任一红 ⇒ 停止、RESULT.md 交调度方/owner、不进 B；**全部按 §3.2 终版 argv 跑**，附录 A 的旧 spike 不再作终版证据）：**A-04**（matcher 形态：Bash 与 Write 的 hook-input 各 ≥1 条）；S1–S4 终版重跑（deny/ask/allow/圈外写自拒）；**S-T**（`system/init.tools` 恰为五件且不含 `Task`，B-10）；S14；B-2（同一 uuid 二次 `--session-id` 在会话已存在/不存在两种情况的行为；`--session-id` 与 `--resume` 同传）；B-7（SIGTERM ⇒ exit 143 + Bash 子树终止 + 之后 `--resume` 可续）；**B-10**（终版 argv 下 hook 超时 = 落回 Claude 自身流的固化）+ **B-10'**（`acceptEdits` + Write 圈内 `.env` + hook 超时 ⇒ 文件不得落盘；落盘 ⇒ 红，按 §3.3 敏感基名本地 watchdog 口径改方案再进 B）；**B-14 矩阵**（worktree `.claude/settings.json` 分别含 `disableAllHooks:true` / `permissions.allow` 放行 Bash / `additionalDirectories:["/tmp"]` / 覆盖 `hooks` matcher——四项在 `--setting-sources ""` 下都不得生效）；**B-15**（`apiKeySource` 时点；init 前是否已发出 API 请求——用 `ANTHROPIC_API_KEY=sk-invalid-spike` 注入的反例观察首个事件）；**S-F**（脚本失败路径：jq 缺失 / curl 不通 / 输出 deny+`exit 2` 时 Claude 是否阻断——期望阻断，`permission_denials` 含之）。
- **设计调整级**（红 ⇒ 改方案对应条款再进 B，**不停批**）：**B-9**（result 行后立即 SIGKILL 再 `--resume` 是否仍能恢复上下文——红 ⇒ `finishPolicy` 定为 `wait_exit_then_kill`，写进 RESULT 与 B1，继续；v3 A-07 从阻塞红挪出）、B-3（`Task` 子代理 hook `agent_id`；P0 不开 Task，仅记录）、**B-11**（`-p` 下 Bash 工具 cwd 是否跨调用持久：`cd /tmp` 后 `pwd`）、**B-12**（agent 内 `printenv` 与白名单对照；`SHELL=/bin/sh` 是否止漏）、**B-13**（auto-memory 写入是否经 Write 工具：hook 日志里是否出现 `~/.claude/projects/...` 路径）。
- **信息级**：B-6（`--input-format stream-json` 一发一收可行性，P1 live steer 前提）、B-16（`rate_limit_event.status` 非 `allowed` 的词表——无法人为触发则如实写"未复现"）。
- 锚：RESULT.md 逐条 `[ok]/[warn]/[fail]`；阻塞红全 `[ok]`；fixture 七件齐；`RESULT.md` 由 owner 直批或 Codex 一次（AGENTS.md "spike ADR"口径）。

**阶段 B · 纯函数层**：
- B1 `Tier1Backend` 接口 + `backends/cursor.ts`（把 `realAgentSpawner` 里 argv/解析/终态搬入，**独立提交**；三句可判定锚见 §3.1：cursor argv/解析/`kill_on_result`/canary 左值快照不变 + 既有 `tier1-*.test.ts` 期望值零改动（允许为可选入参/可选方法补一行类型适配并逐行登记）+ `just ci` 绿）→ `backends/claude.ts`（`buildArgv`/`buildClaudeHooksSettings`/`parseClaudeTier1Line`/`finishPolicy`/`explainFailure`）+ `AgentProcessHandle.stderrTail?()`（可选）。锚：`tier1-claude-backend.test.ts` 对 argv 做封闭集合断言（含 `--permission-mode acceptEdits`、五工具、`--disallowedTools`、`--setting-sources ""`、`--strict-mcp-config` 且无 `--mcp-config`、`--settings` 内联、`--session-id`/`--resume` 互斥；不含 `bypassPermissions`/`dontAsk`/`--dangerously-skip-permissions`/`--add-dir`/`--no-session-persistence`/`--bare`/`--fallback-model`）；hooks JSON 快照（matcher = 阶段 A A-04 选定形态、timeout ≥ 120、`> curl 100 + 余量` 断言）；`parseClaudeTier1Line` 对七件 fixture 逐行产出断言（并行 tool_use 两块都计、`user` tool_result、init 含 `apiKeySource`/`tools`、rate_limit、result_max_turns）；**禁止调用 `parseClaudeLine`（grep 断言）**。
- B2 `buildClaudeGateScript`（纯函数；失败路径 deny + `exit 2`、jq 缺失用 printf 静态 deny、curl `--max-time 100`）+ `fileToolToEffect`（最长现存祖先 realpath 算法；判不出 ⇒ S3）+ `SENSITIVE_FILE_BASENAME_RE` 导出 + cmdEffect 收紧（`cd`/`pushd` 含无参/`~`/`$HOME`、agent CLI 词头、bypass 旗标、`--force` 仅 agent 语境、圈外只读 S2；只升不降，降档扫描 0）。锚：`fileToolToEffect` 表驱动 ≥ 36（圈内 / 圈外 / `..` / 符号链接逃逸（真建 symlink）/ `~` / `$HOME` / 盘符 / 大小写 / **新文件圈内 / 新文件圈外 / 断链中间目录 / symlink 指向圈外后再 Write / 相对路径相对 cwd / 路径非字符串** / 圈内 `tokens.css` 不敏感 / `.env` 与 `id_ed25519` 敏感）；cmdEffect 新增 ≥ 26（含 `cd src && pnpm test` S1、`cd /tmp` S3、`cd` 无参 S3、`cd ~` S3、`cd $DIR` S2、`cd -` S2、`claude -p x` S3、`sudo cursor-agent --force` S3、`git push --force origin main` 仍 S3、`npm run build --force` 仍 S1、`cat /etc/hosts` S2、`cat ~/.ssh/config` S2 或更高、`cat src/a.ts` S0、`sed -n 1,3p /etc/passwd` S2）且既有 223 条期望零改动；`tier1-gate-socket.test.ts` 新增真 bash/jq/curl 用例 ≥ 10 跑 `buildClaudeGateScript` 产物（Bash allow / Bash deny / 畸形 stdin ⇒ deny+exit 2 / curl 不通 ⇒ deny+exit 2 / curl 超时（`--max-time 1` + 挂起假 server）⇒ deny+exit 2 / jq 不在 PATH ⇒ 静态 deny+exit 2 / Write 圈内非敏感空输出 exit 0 / Write 圈外 deny / Write 判不出 deny / Read 圈外 deny / 未知 tool deny），既有 7 例零改动。
- B3 `classifyClaudeRunOutcome` 表驱动 ≥ 12（success / error_max_turns ⇒ failed 不 settle / rate limited / auth_required 含 "Login expired" / resume_not_found / 143+abort / 143 无 abort / agent_exit:n）+ `buildTier1SubscriptionCostEntry`（**只返回纯对象**：`kind='tier1.run'`、`source='subscription'`、amount null、known 0、tokens 四键、`requests=1`、meta `{modelUsage,num_turns,total_cost_usd_estimate,usage_unavailable}`；**不 INSERT**，落库随 W5.4-b 与 P-5 同批；A-06）。
- 门禁：`just ci` 双矩阵绿；B 阶段末 code-review（零上下文只读会话，A 级必修）。**W5.4-a 不改 executor 主流程、不改 gateServer 接线、不改配置 schema、不改 `checkCanaries` 的 cursor 分支**（只加文件与纯函数，cursor seam 抽取除外）。

### W5.4-b · 接线（前置：§5 左栏 P-1…P-5 已回写并过一致性评审 + Codex 一次，或 owner 书面批准"实现先行"）

- C1 `[tier1]` schema/validate/`resolveTier1Adapter`（三处消费）/projectOverrides 规则（F-08/B5）/自检 `scope=tier1`（含 hook 链物理自检）/identity 登记（D12）/`DISABLE_AUTOUPDATER`+`SHELL` 注入/adapter 切换 reap（F-14）。锚：`tier1-config-validate.test.ts` 新增 ≥ 10 + 仅允许的两处既有改动；`project-overrides` 正反例；`setup` 自检测试。
- C2 executor 接 backend：gateServer union（无 kind 不注入）+ handler 三态响应 + file kind 审计/收据（edit 不适用）+ 并发 S2 串行化；session 身份（`native_session_confirmed` 列/标记 + `expectedSessionIdentity`+`isResume`）；observedModels 集合 + 四字段审计；canary 左值换 `tool_result` 计数 + 三方对账；`apiKeySource` 断言；stderr 尾；`finishPolicy`；记账；限流 blocked + enqueue + replayer（`retryTask`）；续跑/恢复 `--resume` 规则（四元组）+ resume 失败重试一次；`queued_delta` 新行为。锚：`tier1-executor.test.ts` 新增 ≥ 12（认领→argv→事件→settle；canary 不误 trip（S2 等待期多 tool_use）；resume mismatch；rate limited blocked + `subscription.retry_enqueued` 审计 + sweep 重认领；auth_required blocked；apiKeySource 拒；resume_not_found 降级一次；adapter mismatch reap），既有 37 零改动；`tier1-gate-socket` 既有 7 零改动；`just ci` 双矩阵绿。
- C3 console 设置页/任务详情 + 语音 S2 文件工具文案 + 10/11 回写草案 + prompt 约定按 backend。锚：console 单测 + Playwright 定向 ≥ 2（点名文件）。
- 门禁：`just ci`；C 阶段末 code-review subagent（A 级必修）+ 一致性 subagent（回写 canonical 部分）。

### W5.4-c · live 冒烟 + 收口

- D1 扩 `tier1-live.e2e.test.ts`（`SAYDO_LIVE_E2E=1` 门控，进程内 Executor + 临时 PoC 仓 + 真 gate socket；`SAYDO_TIER1_AGENT=claude_code`）四 `it`，对应 0.0(b)：
  | 0.0(b) 能力 | 本批状态 | 用例 |
  |---|---|---|
  | canUseTool 阻塞 | hook 同步等 = 等价 | ② S2 上浮（程序化收据 accept 1 / reject 1，与 `tier1-approval-live.test.ts` 同法；owner 真人点击为可选加分）+ S3 deny（`git push --force`）+ file_write 圈外 deny 1 |
  | resume | `--resume` 同 cwd | ③ `queued_delta` 续跑 + `cancel_resume`；④ executor 重建 + `recover()` 恢复 |
  | streaming input | **不实现**（B-6 仅可行性） | — |
  | live steer | **不实现**（D5；`steerApplied` 不放开） | — |
  | （基础）spawn+stream+settle | ① 出 `ready_for_review`（S0/S1 自动放行） | ① |
- 纪律：e2e 沙箱仓 `~/WorkSpace/saydo-dogfood`（不碰 OctoDesk/OctoBlog 真仓）；常驻 `~/.saydo/runtime` daemon 不重启（进程内 harness，独立 DB/socket 路径）；开跑前 owner 确认订阅五小时窗可用、BYOA 槽不在跑；撞限流/登录过期 ⇒ 如实记录、不重试烧额度、停等。
- evidence `e2e/evidence/w54-claude-cli.md` 可判定数字：`tier1.gate_decision` 中 S2 allow ≥1 / S2 deny ≥1 / S3 deny ≥1 / kind=file_write deny ≥1；`tier1.canary_tripped` 0；`cost_entries WHERE source='subscription' AND kind='tier1.run'` ≥ 4（`requests=1` 每行）；`permission_denials.length >= 门 deny 数`（多出的逐条进审计）；每能力 `toolCalls` 数（D8 观察）；四能力各一条真事件流摘录。
- 收口：`tier1-conformance.md` 加 claude 列；§5 右栏回写 + 一致性 subagent + Codex 攒批；零上下文对抗评审（点名：hooks 注入绕过、gate-claude.sh 畸形输入、file 门 realpath 逃逸、canary 左右值口径、resume 跨 cwd/确认位、apiKeySource、订阅限流静默转计费、hook 超时落回路径、并发 S2）；HANDOFF 指针开/清；journal。

### 工期（推断，评审员估算）

A 0.5–1 / B1 1.5–2 / B2 1–1.5 / B3 0.5 / C1 1 / C2 2–3（最大不确定项）/ C3 0.5–1 / D 1–2（含两轮评审）≈ 8–12 人日；每批 readback + 回收约等量。

## 7. 风险与未知（实测前不得当作已证）

| # | 风险 / 未知 | 处置 |
|---|---|---|
| R-1 | Claude Code 滚动发布 + 自更新（2.1.220；工具表、事件字段、hooks 语义、`--resume` 语义都在变） | 版本 pin + digest + `DISABLE_AUTOUPDATER=1` + 启动自检；fixture 绑定版本；升级 = 重跑阶段 A |
| R-2 | `--setting-sources ""` 的排除面 | [ok] 实测 S13：用户级 plugins 不加载、MCP 为空；内置 skills/agents 仍在上下文（工具面封闭后不可调用）；worktree `.claude/settings.json` 是否被排除待 B-14（阻塞红） |
| R-3 | `Task` 子代理内 hooks 的 `agent_id` 与 canary 对账 | P0 不开 Task；B-3 记录 |
| R-4 | 同一 run 多模型（S7） | 族集合校验；展示取 `system/init.model`；记账按 `modelUsage` 分行 |
| R-5 | hook 超时 = 非阻断（S15/S16） | 脚本自返 deny 先于超时（curl 110 < hook 120）；hook 进程异常残余如实（§4）；启动自检物理跑 hook 链 |
| R-6 | 订阅五小时窗与 BYOA 四槽争额度（PLAN-2 风险 ⑥） | 明确拒绝态 blocked + durable 重放；设置页显示窗口；开跑前人工确认 |
| R-7 | 登录态过期（`-p` 无法交互续期） | blocked `auth_required` + 通知；不自动重试 |
| R-8 | `--model` 别名解析随账号变化 | 自检回显实际 `system/init.model`；族校验兜底 |
| R-9 | 文件门路径归一（符号链接、`..`、大小写不敏感 FS、`~`）与 Bash 侧 `pathClass`（绝对路径一律 outside）的不对称：`tee /abs/worktree/x` S3 而 Write 同路径 no_decision | 文件门用 `realpath` 前缀判定 + 反例表；Bash 侧保守是既有口径，接受不对称，`tier1-conformance.md` claude 列如实 |
| R-10 | hooks 不覆盖的内置行为 | `--tools` 封闭集 + 脚本封闭集；`Skill`/`Workflow` 等不在面 |
| R-11 | result 行后立即 SIGKILL 是否破坏 transcript/resume | B-9 阻塞红；`finishPolicy` 备用 |
| R-12 | 并发 S2 / 单 pending 不变量 | hook 等待串行化 + 第二张直接 deny（§3.3） |
| R-13 | auto-memory 写入路径与 transcript 隐私 | B-13：若经 Write 工具 ⇒ 把 `~/.claude/projects/<cwd-hash>/memory/` 视为 Claude 内部 sink（`no_decision`，审计标记）或关闭 auto-memory（settings 键待查）；transcript 残余登记 §4 |
| R-14 | Bash cwd 持久 / profile 快照泄漏（B10/B11） | B-11/B-12 spike；`cd` 圈外 S3；`SHELL=/bin/sh` |
| R-15 | `maxTurns: 80`（按 tool_call）对 Claude 工具粒度偏紧 | W5.4-c 记录 `toolCalls`，逼近则上浮（D8） |
| R-16 | 限流词表未观测到拒绝态 | 只对明确拒绝态动作；其余观测 |

## 8. owner 决策点（本文不代拍；v2 补齐 D5/D9–D14）

1. **D1** 传输形态 = CLI 子进程；ADR-001 附注；supersede 07 D8 "不走 CLI"。
2. **D2** `[tier1].agent` 新键、缺省 `claude_code`、devMode 双开关沿用 `[models.dev].agent`。
3. **D3** 工具面封闭集 `Bash,Read,Write,Edit,NotebookEdit`，`Task`/Web 工具 P0 不开；`acceptEdits`；圈内文件操作 hook 不裁决。
4. **D4** Tier1 不用豁免（恒 `exempted=false`）、身份核验链 W5.4-b 实施；上浮文案按 v2 更正（BYOA 侧条件豁免已落地）。
5. **D5 / D9** live steer 与 streaming input 本批不实现（范围缩水如实）；`--permission-prompt-tool` P1。
6. **D6** Tier1 记账（含 cursor 顺带补）；**D7/D8** 模型 `opus`、`claude_max_turns` 200、派发 `maxTurns 80` 不动先观察。
7. **D10** 拆三批；**D11** 合同前置 vs 实现先行；**D12** identity 登记承载 (b)；**D13** `DISABLE_AUTOUPDATER=1` + `SHELL=/bin/sh` 显式注入；**D14** 圈外 Read deny（P1 再放 S2）。
8. 与 08-15 决策点 2（native_api）的排序：本文建议 W5.4 先行，native_api 另立战役。

## 9. 评审回修记录（v1 → v2；两路 subagent；Codex 待补）

| 来源 | 条目 | 处置 |
|---|---|---|
| 安全 A1 / 可实施 F-02 | 文件工具 hook timeout 30 < S2 窗；超时语义未证 | 统一 `*` matcher + timeout ≥ 120（断言 > 110+余量）；S15/S16 实测超时 = 落回 Claude 自身流；脚本自返 deny 先于超时；B-10 固化；三方对账 |
| 安全 A2 | 07 D8 "不走 CLI" 未登记 | 关系声明改为 supersede；§5 P-1 + 09:1130/1136、03:116/170、06、modules/c |
| 安全 A3 | "豁免休眠"事实错误 | D4/1.4/§5 P-3 更正：BYOA 侧条件豁免已落地；Tier1 不用 |
| 可实施 F-01 | live steer/streaming input 缩水未进决策；阶段 D "四能力"错位 | D5/D9 进 §8；§6 W5.4-c 增 0.0(b) 映射表 |
| 可实施 F-03 | canonical 先回写 | §5 拆左右栏；D11 |
| 可实施 F-04 / 安全 B8 B9 | stderr 吞、result 即 SIGKILL | §3.1 `stderrTail` + `finishPolicy`；B-9 阻塞红 |
| 安全 B1 | canary 左值为门前事件 | 左值改 `tool_result` 计数；逐块解析 |
| 安全 B2 | "两层"夸大 | 圈内文件 hook `no_decision`；§4 如实"单层 + Claude 兜底仅覆盖 hook 不裁决路径" |
| 安全 B3 | hook 异常非阻断残余 | §4 登记；启动自检物理跑 hook 链；`*` matcher + 脚本封闭集 |
| 安全 B4 | 嵌套 agent CLI | cmdEffect 收紧：agent 词头/bypass 旗标 ⇒ S3（B2） |
| 安全 B5 / 可实施 F-08 | devMode 双开关；override 规则 | D2 用 devMode；§3.9 override 规则 + 审计 |
| 安全 B6 / 可实施 F-07 | 圈外 Read S2 风暴；敏感宽词 | D14 圈外 Read deny；`SENSITIVE_FILE_BASENAME_RE` 收窄；并发 S2 串行化 |
| 安全 B7 / 可实施 F-05 | session 钥匙语义重载 | `native_session_confirmed` + `expectedSessionIdentity`/`isResume`；reserved 重生成 |
| 安全 B10 B11 | Bash cwd 持久；profile 快照泄漏 | `cd` 圈外 S3；`SHELL=/bin/sh`；B-11/B-12 spike |
| 安全 B12 / 可实施 F-15 F-16 | 记账/限流口径 | `recordTier1SubscriptionRun`、`slot="tier1"`/`kind="tier1_run"`、只对明确拒绝态、replayer=`retryTask` |
| 安全 B13 | auto-memory/transcript | R-13 + B-13 spike |
| 安全 B14 | 政策范围/产品缺省 | §1.1 范围声明 + 07:248 观察项；D1 主轴改架构复用 |
| 安全 B15 | edit 动作对文件请求 | 合成串 + meta kind + edit 不适用 |
| 可实施 F-06 | union 零影响有条件 | 无 kind 不注入键；handler `"kind" in req` |
| 可实施 F-09 | 身份登记承载 | D12 (b) + `DISABLE_AUTOUPDATER` |
| 可实施 F-10 F-11 F-21 | 阶段 A 分级/ D harness/复现材料 | §6 三档红 + fixture 路径 + live 用例与数字 + run.sh/RESULT 规格 |
| 可实施 F-12 F-13 F-14 | resume 失败/续跑规则/adapter 切换 | §3.6 |
| 可实施 F-17 | 拆批与工期 | D10 + §6 三批 + 工期 |
| 可实施 F-18 F-19 F-20 F-22 F-23 F-24 F-25 / 安全 C1–C3 | 测试改动白名单 / maxTurns / 术语 / 门禁 / 解析细节 / pathClass 不对称 / 小项 / 坐标 | 分别落 §3.9、D8、术语段、§6 门禁、§3.4、R-9、§3.10、1.3 坐标（`executor.ts:324`、审计动作名、jq `//`） |

### v3 → v3.1（阶段 A 终版 spike 实测，2026-08-20 02:0x–02:2x，Claude Code 2.1.220，`--model sonnet`）

| 条目 | 结果 / 处置 |
|---|---|
| A-04 matcher | `*` / `.*` / 显式并集三形态下 Bash 与 Write 的 hook-input 各 1 条 ⇒ **选定 `*`**（`A-04.selected`） |
| S1–S4、S-T、S14、S-F(a/b/c)、B-2、B-7、B-14a–d、B-15 | 全 `[ok]`：hook deny/ask=deny/allow 生效；圈外写自拒；`init.tools` 恰五件不含 Task；100s 同步等待可行；失败路径 deny+exit 2 三变体均阻断；`--session-id` 二次 / 同传均报错不挂死；SIGTERM 143 + Bash 子树死 + 可 resume；worktree settings 四项在 `--setting-sources ""` 下均不生效；注入 `ANTHROPIC_API_KEY` 时 `apiKeySource=ANTHROPIC_API_KEY` 且 init 前零事件 |
| **B-10'（阻塞红）** | `acceptEdits` 下 **红**（圈内 `.env` 落盘）⇒ 改 **`--permission-mode default`**：补测 X1（default + allow ⇒ 圈内 Write 成功）/ X2（default + hook 超时 ⇒ `.env` 不落盘、进 `permission_denials`）/ X3（default + no_decision ⇒ 圈内 Write 被拒）/ X4（default + no_decision ⇒ 圈内 Read 自动放行）/ X5（default + no_decision ⇒ 圈外 Read Claude 自拒）；D3 / §3.2 / §3.3 / §4 相应改写；圈内非敏感写改为显式 allow |
| B-9（设计级） | `[ok]`（result 后 `kill -9` 仍可 resume）⇒ `finishPolicy` 仍取 `wait_exit_then_kill(5s)` 以保 transcript/SessionEnd 完整（B-9 红时为必须，绿时为偏好） |
| B-11（设计级） | `[warn] persist=unknown`（模型未按预期连续执行两条 Bash）⇒ cmdEffect `cd` 收紧仍按 v3 保留（只升不降，不依赖该结论） |
| B-12（设计级） | agent 内多出的环境变量名：`_`、`AI_AGENT`、`CLAUDE_CODE_*`、`CLAUDECODE`、`CLAUDE_PID`、`CLAUDE_EFFORT`、`COREPACK_ENABLE_AUTO_PIN`、`GIT_EDITOR`、`LOGNAME` 等（Claude 自注入，非凭据）⇒ 登记 evidence；`SHELL=/bin/sh` 止漏有效（无 shell rc 导出变量） |
| B-13（设计级） | auto-memory **经 Write 工具**写 `~/.claude/projects/<cwd-hash>/memory/`（`MEMORY.md`、`user_preferences.md`）⇒ 在 `default` 模式 + 圈外写 deny 下这些写会被门拒并进 `permission_denials`（噪音而非风险）；R-13 处置 = P0 接受 deny（审计里标 `auto_memory_denied`），W5.4-c 观察噪音量再决定是否把该目录列为 Claude 内部 sink |
| B-3 / B-6 / B-16 | 信息级：未开 Task 故无 `agent_id`；`--input-format stream-json` 一发一收可行（P1 live steer 前提）；限流仅见 `allowed`（拒绝态词表未复现） |

### v2 → v3（Grok 对抗评审 77；Codex 配额耗尽回落）

| 条目 | 处置 |
|---|---|
| A-01 realpath 失败 ⇒ S2 ⇒ allow | `fileToolToEffect` 改最长现存祖先 realpath + 后缀拼接；判不出 / 祖先不存在 ⇒ S3 deny；删"判不出 ⇒ install_dependency"；B2 表驱动加新文件/断链/symlink 反例（§3.3、§6） |
| A-02 圈外写 S2 通道 | 删除；圈外 / 判不出一律 deny，脚本永不对圈外回 allow；S2 只留圈内敏感基名；§4 表同句（§3.3、§4） |
| A-03 `exit 0` + 超时落回 | 失败路径 deny + `exit 2`；jq 缺失用 printf 静态 deny；curl 100 < hook 120；B-10' 敏感写超时阻塞红；09 律③ claude 单列改写进 P-4（§3.3、§5、§6） |
| A-04 终版组合未测 | 附录 A 降级为"非终版证据"；阶段 A 全按终版 argv；A-04 matcher spike 阻塞红（Bash 与 Write hook-input 各 ≥1）（§3.2、§3.3、§6、附录 A） |
| A-05 `parseClaudeLine` 吞事件 | 禁止调用；新写 `parseClaudeTier1Line`；fixture 断言两块 tool_use + init 字段（§3.4、§6） |
| A-06 `kind='tier1.run'` 先落库 | W5.4-a B3 只产纯对象不 INSERT；`requests=1`，`num_turns` 进 meta；P-5 先回写再落库（D6、§3.8、§5、§6） |
| A-07 B-9 停/不停；等式 | B-9 移到设计调整级（不停批）；`permission_denials >= 门 deny`（§6、§3.3） |
| A-08 B-14 不充分 | B-14 升为四项矩阵，全阻塞红（§4、§6） |
| A-09 Bash `cat` 圈外 S0 allow | cmdEffect：只读词头目标圈外绝对路径 / `~` / `$HOME` ⇒ S2；§4 改为"圈外不自动放行"（D14、§3.3、§4） |
| A-10 "零行为变化/一字不改" 自相矛盾；canary 全局换左值 | 改三句可判定锚；`stderrTail` 可选；canary 按 backend 分左值，cursor 分支禁改（§3.1、§6） |
| B-01 spawn 入参 | `AgentSpawner.spawn` 增可选 `settingsJson/sessionId/maxTurns`（§3.1） |
| B-02/B-03/B-04 词表细则 | `--force` 仅 agent 语境；剥 wrapper/sudo 后判；`cd` 无参/`~`/`$HOME`/`pushd` 无参 ⇒ S3、`cd -` S2（§3.3） |
| B-05 快照锚 | B-12/B-14/B-15 结论写成 evidence 断言表（IMPL） |
| B-06 `--resume` 与续跑 | 续跑仍新会话（现状）；`--resume` 只用于 recover 与 `queued_delta` 四元组等值（§3.6 不变，措辞澄清） |
| B-07 `native_session_confirmed` | 定为 DDL 新列（additive），进 P-4（§5） |
| B-08 双源 | 取消 `[tier1].agent`；`[models.dev].agent` 唯一（D2） |
| B-09 max_turns 两可 | failed 不 settle 不 verify（§3.5） |
| B-10 init.tools 断言 | 阶段 A S-T 阻塞红；B1 fixture 断言（§6、§3.4） |
| B-11 meta 口径 | `usage_unavailable` 与四键 0 并存语义写明（§3.8） |
| B-12 分发闸 | 保留 §1.1 范围声明 + 07:248 观察项；产品缺省由模板示例承载，分发前复核 ToS（D2） |
| C-01…C-06 | 术语三分保持；C-02 P-1 措辞保留 live steer 仍 SDK 独有；C-03 IMPL 坐标表拆 vitest/grep 两列；C-04 drift guard 明写"两脚本 digest 集合"；C-05 附录 A 路径脱敏为 `<home>`；C-06 N=5s |

## 附录 A · 本会话 spike 命令与关键输出（2026-08-19，Claude Code 2.1.220；**非终版 argv——仅作机制线索，不作终版证据（v3，A-04）**；原始 jsonl 在调度方 scratchpad `spike-claude-cli/`，W5.4-a 阶段 A 按 §3.2 终版 argv 重跑入库）

- 环境：`env -i PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" HOME="$HOME" USER="$USER" LANG="en_US.UTF-8" TERM=dumb TMPDIR="$TMPDIR"`，cwd = 空临时目录，stdin `< /dev/null`，`--model sonnet`（S1 未传 `--model`，init 显示 `claude-sonnet-5`）。
- hook 脚本（三个，仅 `permissionDecision` 不同；`hook-log.sh` 只记日志 `exit 0`）：
  ```
  #!/bin/bash
  set -u
  input=$(cat)
  printf '%s\n' "$input" >> "$(dirname "$0")/hook-input.log"
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"SayDo spike: denied by gate (fail-closed)"}}'
  exit 0
  ```
- S1/S2/S3：`claude -p --output-format stream-json --verbose --permission-mode default --tools "Bash,Read" --setting-sources "" --strict-mcp-config --no-session-persistence --max-turns 3 --settings '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"<hook>.sh","timeout":30}]}]}}' "Run exactly this shell command and tell me its output: ls -la"`（S2/S3 为 `echo spike-ok`）。判定：deny ⇒ `tool_result {"content":"SayDo spike: denied by gate (fail-closed)","is_error":true}` 且 `permission_denials` 含之；ask ⇒ `tool_result.is_error=true`（"needs approval"）；allow ⇒ `tool_result "spike-ok"`；三次 `result.subtype=success`、exit 0。hook stdin 原文（deny 例）：`{"session_id":"af85b449-…","transcript_path":"<home>/.claude/projects/<cwd-hash>/af85b449-….jsonl","cwd":"…/cwd","prompt_id":"ab2e6d6a-…","permission_mode":"default","effort":{"level":"high"},"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls -la","description":"List all files in current directory"},"tool_use_id":"toolu_01CKedbiLNwfchXGDJadBruL"}`。
- S4：`--permission-mode acceptEdits --tools "Write,Read" --max-turns 4` + hook matcher `Write|Edit|MultiEdit|NotebookEdit` 用 `hook-log.sh`；prompt "Do two things using the Write tool only: (1) write the text 'inside' to ./inside-spike.txt in the current directory; (2) write the text 'outside' to /tmp/outside-spike.txt. Then tell me which writes succeeded."：圈内落盘；圈外 ⇒ `tool_result {"content":"Claude requested permissions to write to /tmp/outside-spike.txt, but you haven't granted it yet.","is_error":true}`，文件未创建；`permission_denials=[{"tool_name":"Write",…}]`。
- S5：`--tools "" --max-turns 1 --session-id 2738459c-…`，prompt "Remember the codeword 'pelican'. Reply with exactly: OK" → 同 cwd `--resume 2738459c-…` "What codeword did I give you earlier? Reply with just the word." ⇒ `pelican`；换 cwd ⇒ stderr `No conversation found with session ID: 2738459c-…`，`result {"subtype":"error_during_execution","is_error":true}`，exit 1。
- S6/S13：`--max-turns 1 --no-session-persistence "Reply with exactly: OK"`（无 `--tools`）的 `system/init`：tools 全表；`"plugins":[]`、`"mcp_servers":[]`、skills/agents 内置表、`memory_paths.auto`。
- S7/S8/S9：S1 的 init/result/rate_limit_event 原文摘录：`"apiKeySource":"none"`、`"claude_code_version":"2.1.220"`、`"permissionMode":"default"`；`rate_limit_event {"rate_limit_info":{"status":"allowed","resetsAt":1787148000,"rateLimitType":"five_hour","overageStatus":"rejected","overageDisabledReason":"org_level_disabled",…}}`。
- S10：stderr `Warning: no stdin data received in 3s, proceeding without it…`。
- S11：`--max-turns 1 --tools "Bash"` + allow hook，"Run 'echo spike-b1' with the Bash tool, then tell me the output" ⇒ Bash 执行后 `result {"subtype":"error_max_turns","is_error":true,"num_turns":2,"stop_reason":"tool_use","terminal_reason":"max_turns","result":null}`，exit 1。
- S12：`acceptEdits --tools "Read" --max-turns 3`，"Use the Read tool to read /etc/hosts …" ⇒ `tool_result {"content":"Claude requested permissions to read from /etc/hosts, but you haven't granted it yet.","is_error":true}`，`result.subtype=success`，exit 0。
- S14：hook `sleep 100` 后 allow（`"timeout":120`）：`hook-slow.log` start/end 相差 100s；Bash 照常执行，`result {"subtype":"success","duration_ms":110208}`。
- S15/S16：hook `"timeout":10`、脚本 `sleep 40` 后 deny；`acceptEdits --tools "Bash" --max-turns 3`：`echo spike-timeout` ⇒ 超时后照跑（`tool_result "spike-timeout"`，`permission_denials=[]`，`duration_ms=16452`）；`mkdir -p /tmp/spike-b10-dir && touch /tmp/spike-b10-dir/x && echo done` ⇒ `tool_result {"content":"This Bash command contains multiple operations. The following parts require approval: mkdir -p /tmp/spike-b10-dir, touch /tmp/spike-b10-dir/x","is_error":true}`，目录未创建；hook 日志只有 start 无 end（被 timeout 杀）。

## 附录 B · W5.4-a 阶段 A 的 spike 清单（分级见 §6）

（v3 分级）**阻塞红**：A-04 matcher 形态；S1–S4 终版重跑；S-T `init.tools` 五件不含 Task；S14；S-F 脚本失败路径阻断；B-2 `--session-id` 二次/同传/`--fork-session`；B-7 SIGTERM 143 + Bash 子树 + 之后 resume；B-10 终版下超时落回固化 + B-10' 敏感写超时不落盘；B-14 四项矩阵；B-15 `apiKeySource` 时点。**设计调整级**：B-9 result 后立即 SIGKILL 再 resume；B-3 `Task` 子代理 hook `agent_id`；B-11 Bash cwd 跨调用持久；B-12 agent 内 `printenv` 对照白名单 + `SHELL=/bin/sh`；B-13 auto-memory 写入路径。**信息级**：B-1 [已测 S11]；B-4 [已测 S13]；B-5 [已测 S14]；B-6 `--input-format stream-json` 一发一收；B-8 [已测 S12]；B-16 限流拒绝态词表。
