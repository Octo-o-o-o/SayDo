## 断言核验

**1. 部分成立。**

SayDo 当前生产可运行的 Tier1 只有 Cursor：daemon 直接启动 `cursor-agent -p --force --trust`，随后消费 NDJSON；执行前创建 git worktree 并写入 `.cursor/hooks.json`，hook 通过 UDS HTTP 回连审批门。[executor.ts:142](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:142) [executor.ts:1033](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1033) [executor.ts:1065](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1065) [adapter.ts:41](~/WorkSpace/SayDo/packages/daemon/src/tier1/adapter.ts:41) [gateServer.ts:24](~/WorkSpace/SayDo/packages/daemon/src/tier1/gateServer.ts:24)

Hopper route、两阶段 dispatch binding 和 `.hopper/events.jsonl` 只读消费者均存在。[task.ts:8](~/WorkSpace/SayDo/packages/contracts/src/types/task.ts:8) [dispatch.ts:18](~/WorkSpace/SayDo/packages/daemon/src/bridge/dispatch.ts:18) [events.ts:27](~/WorkSpace/SayDo/packages/daemon/src/bridge/events.ts:27)

但 Hopper 生产绑定明确标为 dormant、默认关闭；启动恢复也只统计悬挂 binding，没有执行重放。现有闭环是测试直接调用外部 Hopper 二进制。[binding.ts:269](~/WorkSpace/SayDo/packages/daemon/src/focus/binding.ts:269) [stage.ts:35](~/WorkSpace/SayDo/packages/daemon/src/focus/stage.ts:35) [reconciler.ts:66](~/WorkSpace/SayDo/packages/daemon/src/recovery/reconciler.ts:66) [p05b-fake-runner.e2e.test.ts:49](~/WorkSpace/SayDo/packages/daemon/test/p05b-fake-runner.e2e.test.ts:49)

所以准确表述是：**有 Tier1/Hopper 两种架构路由，但目前只有 Cursor Tier1 是生产执行器；Hopper 是 dormant 桥合同，不是第二个活跃 Runner。**

**2. 确认，但“纯推理笼”不是统一强隔离。**

这些 provider 只实现 `LlmProvider.chat()`，由模型槽 resolver 消费，不参与 Tier1 的 worktree、settle 或执行状态机。[types.ts:80](~/WorkSpace/SayDo/packages/daemon/src/providers/types.ts:80) [provider.ts:189](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:189) [slotResolvers.ts:86](~/WorkSpace/SayDo/packages/daemon/src/providers/slotResolvers.ts:86)

Claude 使用空工具集，Grok 使用 `--tools ""`，Codex 是 `-s read-only`；Cursor 只有 `ask + tripwire`，仍能看到真实 HOME，并非可证零工具。[cage.ts:44](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/cage.ts:44) [cage.ts:67](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/cage.ts:67) [cage.ts:88](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/cage.ts:88) [cage.ts:99](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/cage.ts:99)

因此“不是执行器”完全正确；“纯推理”是用途和输出处置语义，不代表四家都具有同等强度的技术禁闭。

**3. 证伪。当前代码已经允许单一 provider 合法配置。**

四个模型槽仍必须配置，但 API evaluator 与 dialog/thinking 同族时，只有未确认才产生 violation；`evaluator_same_family_ack=true` 会放行并给提示。测试也明确覆盖“API 同族有 ack 放行”，canonical 真值表标为 `active`。[types.ts:7](~/WorkSpace/SayDo/packages/daemon/src/config/types.ts:7) [validate.ts:286](~/WorkSpace/SayDo/packages/daemon/src/config/validate.ts:286) [config.test.ts:124](~/WorkSpace/SayDo/packages/daemon/test/config.test.ts:124) [09-data-contracts.md:1171](~/WorkSpace/SayDo/docs/09-data-contracts.md:1171)

`PROCESS-JOURNAL` 的“单家凭据无合法配置”是旧轮次过程记录，已被当前实现和 canonical 覆盖。[PROCESS-JOURNAL.md:361](~/WorkSpace/SayDo/history/PROCESS-JOURNAL.md:361)

“拒启动”也不准确：非法活动配置进入 `RECOVERY_ONLY`，daemon 仍启动配置自救面，只禁用对话和 dispatch。[index.ts:617](~/WorkSpace/SayDo/packages/daemon/src/index.ts:617) [index.ts:665](~/WorkSpace/SayDo/packages/daemon/src/index.ts:665) [index.ts:897](~/WorkSpace/SayDo/packages/daemon/src/index.ts:897)

最小改动面分两层：

- **仅让单一 DeepSeek provider 合法：校验器零改动。** 现有 `ModelBinding` 已支持任意命名 API 端点和 `env:NAME` 凭据引用；配置 `family="deepseek"`，四槽共用端点，并显式确认同族风险即可。[modelbinding.ts:29](~/WorkSpace/SayDo/packages/contracts/src/types/modelbinding.ts:29) [modelbinding.ts:64](~/WorkSpace/SayDo/packages/contracts/src/types/modelbinding.ts:64) [validate.ts:175](~/WorkSpace/SayDo/packages/daemon/src/config/validate.ts:175)

- **让向导真正做到“只填 DeepSeek key”：** 增加 `DEEPSEEK_API_KEY` 到 daemon secret 白名单及 setup 重复名单；扩展 console 的 `ApiKeyName`、DeepSeek host 映射和一键方案；保留现有显式同族确认，不应静默代签。[envFile.ts:7](~/WorkSpace/SayDo/packages/daemon/src/config/envFile.ts:7) [setup.ts:791](~/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:791) [setupApi.ts:1194](~/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:1194) [setupApi.ts:1274](~/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:1274) [resourcePlans.ts:41](~/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:41) [resourcePlans.ts:473](~/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:473) [SetupWizard.tsx:1367](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1367)

- **若要求连风险确认都不需要：** 才需修改 `validate.ts:286-304`、§11 真值表、对应测试和 UI gate。这不是实现 DeepSeek 所必需的最小变更。

这些只解决 Brain 供给；Tier1 仍只实现 Cursor，不能因此用 DeepSeek key 执行代码。[validateConfig.ts:90](~/WorkSpace/SayDo/packages/daemon/src/tier1/validateConfig.ts:90)

**4. 确认，而且另有一处未写进该断言的门缺口。**

canonical 对同 UID、内置 write 绕过 shell hook 的描述仍成立；gate 脚本自身也承认目录并非强制不可写。[09-data-contracts.md:1135](~/WorkSpace/SayDo/docs/09-data-contracts.md:1135) [gateScript.ts:1](~/WorkSpace/SayDo/packages/daemon/src/tier1/gateScript.ts:1)

不过 canonical 仍写“digest 补偿待实施”，实际每次 gate 请求重读并比对脚本、漂移后终止活跃 run 的代码已经落地。[executor.ts:403](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:403) Canary 仍只比较 shell-start 与 gate 请求计数，抓不到内置文件写和所有“撒谎 POST”变体。[executor.ts:556](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:556)

额外问题：现有命令映射把 `node`、`python`、`python3` 无条件归为 `write_worktree`，而 `write_worktree` 是 S1；因此不能把该词法分类器视为完整 egress/S3 门。[cmdEffect.ts:19](~/WorkSpace/SayDo/packages/daemon/src/tier1/cmdEffect.ts:19) [cmdEffect.ts:124](~/WorkSpace/SayDo/packages/daemon/src/tier1/cmdEffect.ts:124) [engine.ts:37](~/WorkSpace/SayDo/packages/daemon/src/policy/engine.ts:37)

**5. 部分成立。**

`callId` 缺失时 ACP 确实 `return next()`，而 `ApprovalRequest.callId` 在类型上是 optional；测试也固定了“无 ID 不发 ACP permission 请求”。[ACP index.ts:212](~/WorkSpace/Reference/deepseek-harness/packages/acp/acp/src/index.ts:212) [user-approval index.ts:149](~/WorkSpace/Reference/deepseek-harness/packages/interaction/user-approval/src/index.ts:149) [approval.spec.ts:71](~/WorkSpace/Reference/deepseek-harness/packages/acp/acp/tests/approval.spec.ts:71)

但当前内置审批路径中，我没有找到缺 `callId` 的生产调用：

- 普通工具 `ask` 总是传 `exec.callId`。[tools index.ts:1678](~/WorkSpace/Reference/deepseek-harness/packages/core/tools/src/index.ts:1678)
- bash/fs 沙箱升级也要求并传入 `callId`。[escalation.ts:102](~/WorkSpace/Reference/deepseek-harness/packages/sandbox/sandbox/src/escalation.ts:102) [tool-bash index.ts:213](~/WorkSpace/Reference/deepseek-harness/packages/shell/tool-bash/src/index.ts:213) [tool-fs sandbox.ts:87](~/WorkSpace/Reference/deepseek-harness/packages/fs/tool-fs/src/sandbox.ts:87)

所以缺口主要位于未来或第三方直接调用者，不是当前内置工具链。更现实的问题是 ACP permission 帧只有 `toolCallId`，没有工具名、参数或理由；客户端必须靠另一个工具事件流关联，而 ACP 恰好不提供该事件流。[ACP index.ts:218](~/WorkSpace/Reference/deepseek-harness/packages/acp/acp/src/index.ts:218)

**6. 前半确认，“必须读持久化”证伪。**

ACP 实现只转发 committed `assistant/message` 的文本或图片占位；raw chunk、reasoning、tool、plan、usage 均省略。[ACP index.ts:152](~/WorkSpace/Reference/deepseek-harness/packages/acp/acp/src/index.ts:152) [ACP README.md:27](~/WorkSpace/Reference/deepseek-harness/packages/acp/acp/README.md:27) [ACP README.md:76](~/WorkSpace/Reference/deepseek-harness/packages/acp/acp/README.md:76)

完整 `SessionEvent` 才包含 raw chunk、tool call/result 和每次 assistant message 的 token usage。[session types.ts:230](~/WorkSpace/Reference/deepseek-harness/packages/core/session/src/types.ts:230) [session types.ts:265](~/WorkSpace/Reference/deepseek-harness/packages/core/session/src/types.ts:265) [session types.ts:273](~/WorkSpace/Reference/deepseek-harness/packages/core/session/src/types.ts:273) [session types.ts:279](~/WorkSpace/Reference/deepseek-harness/packages/core/session/src/types.ts:279)

因此：

- **ACP 单通道确实不足以做任务进度和成本账本。**
- **但不必然要读持久化。** SDK JSON-RPC 会实时发送完整 `SessionEvent`，Host ApiProxy 也有 raw `session/event` 帧。[SDK types.ts:50](~/WorkSpace/Reference/deepseek-harness/packages/sdk/protocol/src/types.ts:50) [SDK README.md:15](~/WorkSpace/Reference/deepseek-harness/packages/sdk/protocol/README.md:15) [events.ts:65](~/WorkSpace/Reference/deepseek-harness/packages/host/apiproxy/src/api/events.ts:65)
- 若坚持 ACP，则确实需要第二数据源。JSONL 默认 zstd、最多延迟 200ms，外部 tail 必须新建 raw `compression:'none'` root；SQLite 虽然一事件一行，仍是内部 schema。[JSONL README.md:24](~/WorkSpace/Reference/deepseek-harness/packages/session/session-persistence-jsonl/README.md:24) [JSONL README.md:70](~/WorkSpace/Reference/deepseek-harness/packages/session/session-persistence-jsonl/README.md:70) [SQLite README.md:9](~/WorkSpace/Reference/deepseek-harness/packages/session/session-persistence-sqlite/README.md:9)
- DSH 只提供 token 数，不提供金额；其 pi-ai 适配器明确没有 spend consumer。因此金额仍需 SayDo 自己的价格表和计费归属。[TokenUsage types.ts:127](~/WorkSpace/Reference/deepseek-harness/packages/llm/llm/src/types.ts:127) [catalog.ts:27](~/WorkSpace/Reference/deepseek-harness/packages/llm/llm-pi-ai/src/catalog.ts:27)

**7. 证伪。`SessionEvent` 当前不是可依赖的稳定外部兼容契约。**

它确实是公开导出的 TypeScript 类型，也是 DSH 内部 append-only session 真相源。[session package.json:14](~/WorkSpace/Reference/deepseek-harness/packages/core/session/package.json:14) [session types.ts:230](~/WorkSpace/Reference/deepseek-harness/packages/core/session/src/types.ts:230)

但稳定性证据相反：

- 根规则明确允许 pre-release 阶段自由 rename/repackage，`SESSION_FORMAT_VERSION=0` 且没有兼容承诺。[AGENTS.md:5](~/WorkSpace/Reference/deepseek-harness/AGENTS.md:5)
- 格式注释明确写着不兼容日志直接拒绝、当前无 migration。[session types.ts:33](~/WorkSpace/Reference/deepseek-harness/packages/core/session/src/types.ts:33)
- 有认真设计的版本 bump 和 `ignorable` 纪律，但普通事件可 additive 增长，结构/语义变化可以 bump；这不是 additive-only 承诺。[session types.ts:40](~/WorkSpace/Reference/deepseek-harness/packages/core/session/src/types.ts:40) [session types.ts:404](~/WorkSpace/Reference/deepseek-harness/packages/core/session/src/types.ts:404)
- Host 的 Zod schema 只冻结 envelope，`type` 是任意字符串、`data` 是 `unknown`，没有冻结每种事件 payload。[sessions.schema.ts:40](~/WorkSpace/Reference/deepseek-harness/packages/host/apiproxy/src/api/sessions.schema.ts:40)
- SDK 虽把 `SessionEvent` 带上 wire，但明确无协议版本协商、pre-release 无兼容承诺。[SDK README.md:25](~/WorkSpace/Reference/deepseek-harness/packages/sdk/protocol/README.md:25) [SDK README.md:35](~/WorkSpace/Reference/deepseek-harness/packages/sdk/protocol/README.md:35)

`packages/README` 把 core/session/sdk/acp 标为 “Product — stable API”，但这和更明确的 pre-release/no-compat 条款冲突；rc 阶段应按后者处理。[packages README.md:11](~/WorkSpace/Reference/deepseek-harness/packages/README.md:11) [packages README.md:45](~/WorkSpace/Reference/deepseek-harness/packages/README.md:45)

结论：**读 session 日志或 SDK `SessionEvent` 都是在接内部版本化格式；前者更糟，但二者都必须精确 pin + golden fixture + fail-loud。**

**8. 部分成立；“完全没有跨重启恢复/预算”说过头了。**

Jobs 结论正确：`jobs-local` 全在内存、无队列、无抢占，绑定精确 owner，进程结束记录即失；契约本身也承认 durable/cross-process backend 需要重塑身份和生命周期。[jobs-local README.md:5](~/WorkSpace/Reference/deepseek-harness/packages/jobs/jobs-local/README.md:5) [jobs-local README.md:7](~/WorkSpace/Reference/deepseek-harness/packages/jobs/jobs-local/README.md:7) [jobs-local README.md:31](~/WorkSpace/Reference/deepseek-harness/packages/jobs/jobs-local/README.md:31) [jobs README.md:36](~/WorkSpace/Reference/deepseek-harness/packages/jobs/jobs/README.md:36)

但 session 有 durable crash repair 和 agent resume，因此“进程死后一切不可恢复”是错的。[JSONL README.md:40](~/WorkSpace/Reference/deepseek-harness/packages/session/session-persistence-jsonl/README.md:40) [SQLite README.md:17](~/WorkSpace/Reference/deepseek-harness/packages/session/session-persistence-sqlite/README.md:17) [agent-loop index.ts:647](~/WorkSpace/Reference/deepseek-harness/packages/core/agent-loop/src/index.ts:647)

预算方面，它有单次模型输出 `maxTokens`、工具 timeout 和有限 retry；但 agent loop 明确没有 turn budget，workflow 也没有跨子任务 token budget，甚至 `always` retry 可无限计费。因此没有 SayDo 这种 task 级金额/活跃墙钟/工具调用聚合熔断。[agent-loop README.md:129](~/WorkSpace/Reference/deepseek-harness/packages/core/agent-loop/README.md:129) [workflow README.md:53](~/WorkSpace/Reference/deepseek-harness/packages/workflow/workflow/README.md:53) [llm-retry README.md:39](~/WorkSpace/Reference/deepseek-harness/packages/llm/llm-retry/README.md:39)

“全仓不存在 triage/交付验收闸门”无法用局部 `file:line` 严格证明，列为**未核验**。现有 plan review 只负责退出 plan mode，不是 post-run delivery acceptance。[plan-mode README.md:13](~/WorkSpace/Reference/deepseek-harness/packages/plan/plan-mode/README.md:13)

“DSH 更同位于 Tier1、不能替代 Hopper”的架构结论成立：Hopper 有两阶段 dispatch 和独立 settle 复核，而 DSH jobs 没有 durable execution ledger。[dispatch.ts:18](~/WorkSpace/SayDo/packages/daemon/src/bridge/dispatch.ts:18) [events.ts:76](~/WorkSpace/SayDo/packages/daemon/src/bridge/events.ts:76)

**9. 部分成立。**

三种 mode、文件效果限定和 unavailable 时 fail-closed 均属实；Linux 选择 bwrap→Landlock，macOS Seatbelt，Windows ACL，并如实报告 `full|partial`。[sandbox README.md:5](~/WorkSpace/Reference/deepseek-harness/packages/sandbox/sandbox/README.md:5) [sandbox-local README.md:5](~/WorkSpace/Reference/deepseek-harness/packages/sandbox/sandbox-local/README.md:5) [sandbox-local README.md:34](~/WorkSpace/Reference/deepseek-harness/packages/sandbox/sandbox-local/README.md:34)

“所有后端探测失败才 fail-closed”不精确：macOS 和 Windows 都是单候选，代码明确不做启动 functional probe；失败在实际执行时按 runner failure 关闭。[sandbox-local index.ts:150](~/WorkSpace/Reference/deepseek-harness/packages/sandbox/sandbox-local/src/index.ts:150)

文件策略明确不覆盖网络、进程、syscall、设备或凭据；Windows 还明确写着网络和进程可见性不受限制。[sandbox README.md:37](~/WorkSpace/Reference/deepseek-harness/packages/sandbox/sandbox/README.md:37) [windows-acl README.md:73](~/WorkSpace/Reference/deepseek-harness/packages/sandbox/sandbox-windows-acl/README.md:73)

所以接入后 `egress="uncontrolled"` 是正确且必须的口径；SayDo 已有这个能力词表。[adapter.ts:12](~/WorkSpace/SayDo/packages/daemon/src/tier1/adapter.ts:12)

**10. 确认。**

直接 DeepSeek adapter 支持可配 `baseURL`、可替换模型目录，provider route 为 `deepseek-official`。[llm-deepseek README.md:11](~/WorkSpace/Reference/deepseek-harness/packages/llm/llm-deepseek/README.md:11) [llm-deepseek index.ts:44](~/WorkSpace/Reference/deepseek-harness/packages/llm/llm-deepseek/src/index.ts:44)

`llm-pi-ai` 支持已有多 provider，也支持手工声明任意 OpenAI-compatible gateway。[llm-pi-ai README.md:5](~/WorkSpace/Reference/deepseek-harness/packages/llm/llm-pi-ai/README.md:5) [llm-pi-ai README.md:47](~/WorkSpace/Reference/deepseek-harness/packages/llm/llm-pi-ai/README.md:47)

**11. 部分证伪。**

`packages/bundle/` 确实只有 base/headless/web-app，没有 ACP bundle。[bundle README.md:5](~/WorkSpace/Reference/deepseek-harness/packages/bundle/README.md:5)

但已经有可运行、可发布的 `dsh-acp-demo` bin；它装配 agent spine、JSONL、checkpoint、query 与 ACP，外部 leaf 负责 LLM、sandbox、approval、FS 和 tools。[acp-demo README.md:5](~/WorkSpace/Reference/deepseek-harness/packages/examples/acp-demo/README.md:5) [acp-demo README.md:17](~/WorkSpace/Reference/deepseek-harness/packages/examples/acp-demo/README.md:17) [acp-demo package.json:14](~/WorkSpace/Reference/deepseek-harness/packages/examples/acp-demo/package.json:14)

实际启动可用 `dsh-acp-demo --config ...`，仓内等价脚本是 `pnpm demo:acp`；runnable composition 要求 provider/model。[acp-demo README.md:19](~/WorkSpace/Reference/deepseek-harness/packages/examples/acp-demo/README.md:19) [acp-demo README.md:43](~/WorkSpace/Reference/deepseek-harness/packages/examples/acp-demo/README.md:43) [package.json:137](~/WorkSpace/Reference/deepseek-harness/package.json:137)

因此不是“要从零组一个 ACP app”，而是“要维护自己的 leaf `cordis.yml`、依赖闭包和启动包装”。SayDo daemon 可以不引入 Cordis；但 DSH 子进程本身仍然是 Cordis runtime，因为 DSH 明确是全插件架构。[AGENTS.md:3](~/WorkSpace/Reference/deepseek-harness/AGENTS.md:3)

归纳：明确错误的是 **3、6 的‘必须持久化’、7、8 的绝对化表述、11 的‘无现成 runnable app’**；1、5、9 部分成立；2、4、10 成立。

## ROI 裁决

**裁决：不建议采用“DSH + ACP + session 日志旁读”作为默认 Tier1；推荐替代 A，即 SayDo 原生最小执行器。**

关键原因不是 DSH agent loop 不好，而是它的控制面与 SayDo 的承重面错位：

- DSH 的 `approval: ask` 不代表每个工具都会询问。`tools/pre-execute` 的缺省决定是 `allow`，只有另一个 policy 返回 `ask` 才进入 approval service。[tools index.ts:1473](~/WorkSpace/Reference/deepseek-harness/packages/core/tools/src/index.ts:1473)
- 自带 hook bridge 能截获工具参数，但配置读取/解析失败只告警并“什么都不注册”；hook 执行基础设施故障默认也是 non-blocking，只有 hook 自己 exit 2 才拦截。[hooks README.md:31](~/WorkSpace/Reference/deepseek-harness/packages/hooks/hooks-claude-code/README.md:31) [hooks index.ts:96](~/WorkSpace/Reference/deepseek-harness/packages/hooks/hooks-claude-code/src/index.ts:96) [hook-protocol README.md:22](~/WorkSpace/Reference/deepseek-harness/packages/hooks/hook-protocol/README.md:22)
- ACP 又隐藏工具事件和 usage。因此 SayDo 必须另外维护 policy/hook、session projector、版本兼容、审批关联和进程生命周期，相当于形成第二套控制平面。
- A 已可复用 OpenAI-compatible tool-call 适配器、通用工具循环和 ToolRegistry；缺的是执行域专用工具及 durable runner 状态，而不是从零写全部 LLM 基础设施。[openaiCompat.ts:46](~/WorkSpace/SayDo/packages/daemon/src/providers/openaiCompat.ts:46) [dialogLoop.ts:622](~/WorkSpace/SayDo/packages/daemon/src/brain/dialogLoop.ts:622) [registry.ts:19](~/WorkSpace/SayDo/packages/daemon/src/brain/registry.ts:19)

以下是单名高级 TS 工程师、macOS 首发、包含 canonical/测试/故障注入但不含完整三平台认证的粗估，误差约 ±40%：

| 方案 | 可评审 MVP | 默认级累计 | 长期维护 | rc 漂移暴露 |
|---|---:|---:|---|---|
| DSH + ACP + 日志投影 | 17–25 人天 | 24–36 人天 | 高：同时维护 ACP、hook、日志 schema、Cordis leaf | 高 |
| A：SayDo 原生执行器 | 19–29 人天 | 27–40 人天 | 中：代码更多，但安全/状态合同单源 | 无 DSH rc 暴露 |
| C：现有 CLI 直接吃 DeepSeek key | 4–8 人天 | 7–12 人天 | 低至中 | 取决于 vendor CLI |
| 第四路：DSH SDK JSON-RPC | 13–20 人天 | 20–30 人天 | 中高 | 高，但免去日志 tail |

方案 C 只有在 vendor 能力被真实 spike 证明后才是最优。当前代码只能启动 Cursor，且会主动剥离所有 API key 环境变量；仓内没有“Cursor 接任意 DeepSeek endpoint”的实现证据。[executor.ts:106](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:106) [validateConfig.ts:103](~/WorkSpace/SayDo/packages/daemon/src/tier1/validateConfig.ts:103) 所以目前不能把 C 当已存在的低成本路线。

DSH 相对 A 可能节省几天 agent loop、compaction、FS/shell 工具建设，但 ACP 丢事件、审批非全局门、SessionEvent 无兼容承诺和 egress 不受控，把这些节省基本吃完。作为安全承重的默认 Runner，这笔交换不划算。

## 推荐方案与最小路径

推荐新增一个 provider-neutral 的 `native_api` Tier1 adapter，以 DeepSeek 官方兼容端点为默认，用户仍可改成其他 OpenAI-compatible 后端。

1. **先改 canonical 与封闭词表。**

   扩展 `DevAgentBinding`、`Task.adapter`、两处 SQLite CHECK、项目 dev override 和 startup verdict；当前这些位置都把词表封闭在 Cursor/Claude/Codex，项目覆盖甚至只允许 Cursor。[modelbinding.ts:48](~/WorkSpace/SayDo/packages/contracts/src/types/modelbinding.ts:48) [task.ts:11](~/WorkSpace/SayDo/packages/contracts/src/types/task.ts:11) [ddl.ts:112](~/WorkSpace/SayDo/packages/daemon/src/storage/ddl.ts:112) [ddl.ts:183](~/WorkSpace/SayDo/packages/daemon/src/storage/ddl.ts:183) [projectOverrides.ts:18](~/WorkSpace/SayDo/packages/daemon/src/config/projectOverrides.ts:18)

2. **把 Tier1 编排与 Cursor transport 拆开。**

   保留现有 claim、worktree、预算、取消、verify、settle、S3 merge 和恢复逻辑；抽出 `Tier1Runner`，至少提供 `start/cancel/resume` 和规范化事件。当前 `AgentSpawner` 只抽象进程，但 parser、hooks、session id、终态和 observed model 全嵌在 `executor.ts`，还不是真正的 Runner seam。[executor.ts:93](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:93) [executor.ts:1122](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1122) [executor.ts:1221](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1221)

3. **原生 loop 复用 provider 与循环骨架，但另建执行域 ToolRegistry。**

   不要直接复用 Brain 的 live tool 实例；后者是账本、项目和确认域工具，不是文件/命令工具。[liveTools.ts:513](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:513)

   MVP 只暴露：

   - 结构化 `read/list/search/write/edit`
   - `git status/diff`
   - 冻结登记的 `run_verify`
   - 明确包名的 `install_dependency`
   - 经风险门的受限 shell

4. **安全门直接内建，不再依赖外部 hook。**

   Gate 0 继续在 dispatch 前拒绝，Runner 无权绕过。[liveTools.ts:345](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:345)

   工具执行前统一产生 `EffectDescriptor`：

   - S0/S1：仅结构化 worktree 操作和登记 verify 自动放行。
   - S2：直接调用现有 `RuntimeApprovalFlow`，保留 turn/package/单次 receipt 绑定。[approvalFlow.ts:41](~/WorkSpace/SayDo/packages/daemon/src/tier1/approvalFlow.ts:41)
   - S3：Runner 内硬拒，合并仍只走现有本机 WebAuthn HTTP 链。[gate.ts:36](~/WorkSpace/SayDo/packages/daemon/src/tier1/gate.ts:36) [s3Tools.ts:1](~/WorkSpace/SayDo/packages/daemon/src/tier1/s3Tools.ts:1)

   在 egress 隔离完成前，不应把任意 `node/python/bash -c` 当 S1；可先只允许登记 verify 使用解释器，其余通用解释器按 S3/manual 处理。

5. **由 SayDo 自己产生进度、usage 和恢复事件。**

   建议规范化 `model_started/model_usage/tool_requested/tool_decided/tool_result/turn_ended/run_result`，先写 durable run state，再推 UI；raw transcript 只作日志。现有 Cursor `events.jsonl` 写失败会被忽略，不能升级为 authoritative ledger。[executor.ts:1122](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1122)

   模型 usage 可直接从现有 provider 返回；价格和 `known` 状态继续由 SayDo 计费层决定。[openaiCompat.ts:171](~/WorkSpace/SayDo/packages/daemon/src/providers/openaiCompat.ts:171)

6. **一键 DeepSeek onboarding。**

   增加 first-class `DEEPSEEK_API_KEY`、官方 host、默认模型方案和四槽共享 preset；向导只让用户填写一次 key，但仍显式展示一次“评估同源、独立性下降”的确认。执行 adapter 缺省从当前硬编码 Cursor 改为 `native_api`。[index.ts:2406](~/WorkSpace/SayDo/packages/daemon/src/index.ts:2406) [defaultTemplate.ts:20](~/WorkSpace/SayDo/packages/daemon/src/config/defaultTemplate.ts:20)

### 第四条路

如果仍想利用 DSH，应该评估 **SDK JSON-RPC sidecar，而不是 ACP + 日志 tail**。SDK 会实时发送完整 SessionEvent，直接消除第 6 条的双通道问题。[SDK server README.md:23](~/WorkSpace/Reference/deepseek-harness/packages/sdk/server/README.md:23)

代价是 SDK 当前没有 prompt cancel、session close 或 server→client approval request，协议也没有版本协商；取消只能终止整个 runtime，审批仍需 hook/native plugin。[SDK protocol README.md:35](~/WorkSpace/Reference/deepseek-harness/packages/sdk/protocol/README.md:35) 仓内有 `dsh-jsonrpc-agent`，但没有默认 config，且示例使用未沙箱化的 local bash/fs，不能原样进入 SayDo。[jsonrpc-demo README.md:29](~/WorkSpace/Reference/deepseek-harness/packages/examples/jsonrpc-demo/README.md:29) [cordis.yml:18](~/WorkSpace/Reference/deepseek-harness/examples/jsonrpc-agent/cordis.yml:18) [cordis.yml:69](~/WorkSpace/Reference/deepseek-harness/examples/jsonrpc-agent/cordis.yml:69)

它适合作为实验 adapter，不适合当前直接升默认。

## 必做 spike

1. **方案 C 一日 kill-spike。** 验证一个已 pin CLI 能否仅凭 DeepSeek key/base URL 无交互启动，并保持 observed model、tool event、usage、取消和 gate 语义。任一缺失即淘汰 C。

2. **DeepSeek 原生 tool-loop。** 真实验证 tool call 多轮回填、并行调用、thinking/reasoning 字段、usage、429/5xx、取消和 observed model。当前 OpenAI adapter 会发送工具调用，但对 reasoning 的特殊处理只针对 OpenRouter，不能据此推定官方 DeepSeek 完全兼容。[openaiCompat.ts:57](~/WorkSpace/SayDo/packages/daemon/src/providers/openaiCompat.ts:57) [openaiCompat.ts:75](~/WorkSpace/SayDo/packages/daemon/src/providers/openaiCompat.ts:75)

3. **执行工具安全矩阵。** 覆盖 symlink/path traversal、`..`、worktree 外写、解释器网络请求、shell wrapper、敏感文件、push/deploy、gate/approval 异常和进程组取消。必须证明 S3 零执行，并清偿 `node/python → S1` 缺口。

4. **崩溃恢复。** 分别在 model 请求中、`tool_requested` 后、effect 执行后但 result 落库前杀进程；恢复时必须把不确定 side effect 标成 unknown 并重新验证，不能假定未执行。

5. **质量与成本对比。** 用同一批 15–20 个 SayDo 真实 coding task 比较原生 loop、DSH、当前 Cursor 的验收通过率、人工介入、token、墙钟和错误恢复。代码静态阅读无法回答“DSH 的 agent loop 是否显著更聪明”。

6. **空 HOME 一键路径。** 只提供 DeepSeek key，验证四个 Brain 槽合法、同族确认只出现一次、默认 Runner 可启动、Gate 0 与 S3 路径不改变。

7. **若继续保留 DSH 候选：SDK/hook 反证 spike。** 必须证明 hook 缺失、解析失败、socket 失败和 hook 进程异常都会在首个 effect 前阻断；否则直接判定不满足默认 Runner 红线。版本需精确 pin `0.1.0-rc.5`、锁依赖与制品 digest，并用完整事件 golden fixture 拒绝未识别的 required event。[package.json:1](~/WorkSpace/Reference/deepseek-harness/package.json:1) [session types.ts:412](~/WorkSpace/Reference/deepseek-harness/packages/core/session/src/types.ts:412)

## 我不确定的地方

- 方案 C 的 vendor 能力未核验；SayDo 仓内没有足够证据，需真实 CLI spike。
- DeepSeek 当前模型的真实工具调用质量、thinking wire 行为和价格未做网络调用，不能从 DSH 示例配置推定。
- “DSH 全仓没有 triage/交付验收域”是未核验的全局否定；本报告只确认 jobs/plan/session 的实际边界。
- 当前 `SessionEvent` 明确没有兼容承诺，但正式发布后是否稳定无法预测。
- 人天估算是架构粗估，不是测量值；最大不确定项是原生执行器质量达标所需的上下文管理和工具调优。
- 报告针对当前 checkout 中逐行引用的内容；“fork 的 `packages/` 与上游完全相同”没有作为证据前提。