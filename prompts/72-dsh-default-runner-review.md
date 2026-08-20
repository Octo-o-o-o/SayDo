# 对抗评审：DeepSeek Harness 作为 SayDo 默认 Runner 的可行性与回报

你是独立对抗评审员。**只读**检查，不修改任何文件，不启动子代理，不接受本 prompt 的任何断言作为证据——下面每一条"待核验断言"都必须由你自己读代码复核，给出 `file:line`。

## 两个仓

- 本产品：`/Users/wangyixiao/WorkSpace/SayDo`（分支 `feat/t20-fusion-layout`）
- 候选 Runner：`/Users/wangyixiao/WorkSpace/Reference/deepseek-harness`（`origin` = 官方 `deepseek-ai/deepseek-harness`，`0.1.0-rc.5`，MIT，developer preview；该 checkout 是 owner 自己的 fork，仅 `apps/desktop` 与少量 web/session 提交为 fork 新增，`packages/` 为上游内核）

## owner 的提议

把 SayDo 的**默认 Runner** 改成 DeepSeek Harness（DSH）：用户仍可配自己的后端，但**不配时只需填一个 DeepSeek API Key** 就能开箱跑起来。

## owner 已明确的裁决（不要挑战这条，只评估它的实现代价）

**「异族 evaluator 规则」的优先级低于「用户开箱即用」。** 用户如果只有一个 provider，异族规则会直接阻塞他使用产品；此时"能跑起来"比"评估独立性"更重要。请把这条当作既定前提，评估：在保持 Gate 0 / S0–S3 / 审计不可变等**安全**红线不变的情况下，如何以最小代价让"单一 provider 也有合法配置"。

## 待核验断言（我的初步结论，请逐条证伪或确认）

### 关于 SayDo 现状
1. SayDo 的"Runner"是两层：Tier1 执行器（daemon 自己 spawn `cursor-agent -p --force --trust`，git worktree 隔离，`.cursor/hooks.json` 的 `beforeShellExecution` failClosed 回连 daemon 审批 socket）与 Hopper 路径（外部系统，drop 文件 + `events.jsonl` 只读消费）。
2. `packages/daemon/src/providers/byoa/cage.ts` 里的 claude/codex/cursor 等**不是执行器**，是给 Brain 当 LLM 用的**纯推理笼**（`--tools ""` / `-s read-only`）。
3. SayDo 当前对"用户只有单一 provider"是 **fail-closed 拒启动**，即 `history/PROCESS-JOURNAL.md:370` 所记"单家凭据无合法配置"。请核验这条在**代码**里的实际形态（`packages/daemon/src/config/validate.ts`、`docs/09-data-contracts.md` §11 规则 4/5 真值表），并给出：要让"单一 DeepSeek key"成为合法配置，**最小改动面**是哪些文件与哪些校验分支。
4. Tier1 的门完整性在 P0 已知不完备：gate 目录与 agent 同 UID，`cursor-agent` 内置 write 工具不经 shell 门（见 `docs/09-data-contracts.md:1139` 附近的"门完整性诚实口径"）。请核验这条是否仍是现状。

### 关于 DSH
5. DSH 的 ACP server（`packages/acp/acp/src/index.ts`）把审批经 `conn.requestPermission` 转给外部 ACP 客户端，但 `request.callId === undefined` 时 `return next()` 不外化 —— 即**审批外化不是全覆盖**。请核验哪些审批路径不带 callId。
6. DSH 的 ACP `session/update` **只发 `agent_message_chunk`**（committed assistant message 的文本块），raw deltas 与非 message 事件被省略 —— 即 ACP 通道**拿不到工具级事件流**。请核验，并判断：SayDo 若要做任务卡进度投影与成本账本，是否必须转而消费 session 持久化（`packages/session/session-persistence-jsonl` / `-sqlite`）。
7. **关键 ROI 分歧点**：DSH 的 `SessionEvent` 是否是**对外稳定契约**（有类型导出、有 schema 冻结纪律、有 additive-only 承诺），还是内部存储格式？这直接决定"读 session 日志做投影"在 rc 期的成本。请给出证据。
8. DSH 的 `jobs` 是**进程内内存态**（`packages/jobs/jobs-local/README.md`：keeps every record in memory），绑 agent owner，进程死即失；DSH **没有** durable 任务队列 / triage / 验收闸门 / 预算熔断 / 跨重启恢复对账。因此 DSH **替代不了 Hopper**，它真正同位的是 Tier1。
9. DSH 沙箱（`packages/sandbox/`）为 `read-only | workspace-write | danger-full-access`，Linux bwrap→Landlock、macOS Seatbelt、Windows ACL，探测失败 fail-closed 且诚实报 `full|partial`；但**只管文件写效应，不管网络与进程**。若属实，SayDo 接入后 egress 仍须标 `uncontrolled`。
10. DSH 的 LLM seam 不锁死 DeepSeek：`llm-deepseek` 的 `baseURL` 可配，另有 `llm-pi-ai` 通用多 provider 适配器。
11. DSH 无现成 acp bundle（`packages/bundle/` 只有 base/headless/web-app），跑 ACP 需自行组 profile，且 `packages/acp/acp/README.md` 称 runnable ACP composition 需同时给 provider 与 model。请核验实际启动路径与工作量。

## 你要回答的问题（按重要性排序）

1. **上面 11 条里哪几条是错的？** 给 `file:line`。特别关注第 6、7 两条——它们决定整个方案的成本量级。
2. **回报（ROI）判断**：把 DSH 作为 Tier1 的一个 adapter（外部子进程 + ACP stdio，不引入 Cordis 依赖），相对于以下两个替代方案，是否更划算？
   - **替代 A**：SayDo 自建最小执行器（复用已有 ToolRegistry / 审批门 / worktree / gate socket，自己写 agent loop + 文件与 shell 工具集，直接接 OpenAI 兼容 API，因此天然支持 DeepSeek key）。
   - **替代 C**：不换执行器，只把现有某个 CLI 后端改造成"API key 也能用"的形态。
   请给出各方案的**工作量量级**（人天粗估）、**长期维护成本**、**对 rc 版本漂移的暴露面**，并明确推荐一个。
3. **如果推荐 DSH**：给出最小可行接入路径（哪些文件新增/改动、审批如何映射到 S0–S3、进度投影从哪里取、版本锁如何做），以及必须先做的 spike 清单。
4. **如果推荐自建或其他**：说明为什么 DSH 的收益不足以覆盖成本。
5. **有没有我们都没想到的第四条路？**

## 输出要求

- 结构：`## 断言核验`（逐条 确认/证伪/部分成立 + 证据）→ `## ROI 裁决`（含工作量估算表）→ `## 推荐方案与最小路径` → `## 必做 spike` → `## 我不确定的地方`
- 每条事实性结论必须带 `file:line`；**读不到就写"未核验"，绝不推测**。
- 不要复述本 prompt。不要给鼓励性套话。发现我错了就直说错在哪。
