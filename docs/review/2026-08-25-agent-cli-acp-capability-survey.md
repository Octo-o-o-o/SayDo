# Agent CLI 的 server / ACP 能力实证

- 日期：2026-08-25
- 方法：本机已安装的全部 agent CLI，逐个抓 `--help`，对声明支持 ACP 的**实际启动并发送 `initialize` 请求**
- 目的：回答「除 Codex 外，其他 provider 是否也有 app-server 类概念」，并据此更新决策 2 的建议
- 实证者：Claude（未参与 v1–v20 施工）

## 0. 结论

**ACP（Agent Client Protocol）已经是事实标准，不再是「跟进不押注」的候选。**

本机 11 个 agent CLI 中，**6 个实测可作为 ACP server 启动并正确应答 `initialize`**，
返回结构同构的 `protocolVersion: 1` + `agentCapabilities` + `authMethods`；
第 7 个（Grok）的原生输出格式本身就是 ACP session updates。

**而 SayDo 目前唯二实现的两个 Tier 1 后端（`claude_code`、`cursor`）恰好是唯二完全不沾 ACP 的。**

`docs/07-tech-stack-decisions.md:133` 对 ACP 的现有立场是：

> **ACP(Agent Client Protocol)持续跟进不押注**——Zed/JetBrains 共建、25+ agent，**若成事实标准则适配层整体切 ACP**。

**该条自带的触发条件已经满足。** 决策 2 因此不应只问「Codex App Server 归哪」，
而应先问「要不要接 ACP」——这是覆盖面差一个数量级的两件事。

## 1. 实测矩阵

版本为本机实测（2026-08-25）。「ACP 实测」列指实际启动并对 `initialize` 请求取得合法 JSON-RPC 响应。

| CLI | 版本 | server / 长连接形态 | 协议 | ACP 实测 |
|---|---|---|---|---|
| **goose** | 1.37.0 | `goose acp`（stdio）、`goose serve`（HTTP + WebSocket） | ACP | **通过** |
| **opencode** | 1.18.21 | `opencode acp`、`opencode serve`（headless）、`opencode attach <url>` | ACP | **通过** |
| **kimi** | 0.38.0 | `kimi acp`（stdio） | ACP | **通过** |
| **gemini** | 0.55.1 | `--acp`（`--experimental-acp` 已标 deprecated） | ACP | **通过** |
| **copilot** | 1.0.61 | `--acp`（Start as Agent Client Protocol server） | ACP | **通过** |
| **qwen** | 0.18.0 | `--acp`、`--channel ACP`；另有 `qwen serve`（HTTP daemon，Stage 1 experimental） | ACP | **通过** |
| **grok** | 1.0.5 | 无 acp 子命令；但 `--output-format streaming-json` 定义为「NDJSON of the agent **native ACP session updates**」 | ACP（输出格式） | 未作为 server 测 |
| **codex** | 0.147.0 | `codex app-server`（`[experimental]`）、`codex mcp-server`、`codex exec-server`（`[EXPERIMENTAL]`） | **专有** JSON-RPC（v1/v2 并存） | 不适用 |
| **droid** | 0.147.0 | `droid daemon`（Run the Factory daemon server） | 未验证 | 未测 |
| **claude** | 2.1.220 | 无 server 子命令；但有 `--input-format stream-json`（realtime streaming input）+ `--output-format stream-json` + `--replay-user-messages` | 专有 stream-json | **无 ACP** |
| **cursor-agent** | 2026.08.11-e8db854 | 无 server 模式；`--output-format stream-json` 仅单向输出 | 专有（单向） | **无 ACP** |

## 2. 互操作性证据

对六个 CLI 发送**同一条**手写请求：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,
 "clientCapabilities":{"fs":{"readTextFile":false,"writeTextFile":false}}}}
```

三个来自完全不同厂商的实际响应（截断展示）：

**goose（Block）**

```json
{"jsonrpc":"2.0","result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true,
"promptCapabilities":{"image":true,"audio":false,"embeddedContext":true},
"mcpCapabilities":{"http":true,"sse":false},"sessionCapabilities":{"list":{},"close":{}},
"auth":{}},"authMethods":[{"id":"goose-provider","name":"Configure Provider",...}]},"id":1}
```

**opencode**

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true,
"mcpCapabilities":{"http":true,"sse":true},"promptCapabilities":{"embeddedContext":true,"image":true},
"sessionCapabilities":{"close":{},"fork":{},"list":{},"resume":{}}},
"authMethods":[{"description":"Run `opencode auth login` in the terminal",...}],"agentInf...
```

**kimi（Moonshot）**

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true,
"promptCapabilities":{"image":true,"audio":false,"embeddedContext":true},
"sessionCapabilities":{"list":{},"resume":{},"close":{},"delete":{},"fork":{},"additionalDirectories":{}},
"mcpCapabilities":{"http":true,"sse":true},"auth":{"logout":{}}},
"authMethods":[{"id":"login","type":"terminal","name":"Login w...
```

**同一个客户端实现可以对接全部三家**：字段名、层级、`protocolVersion` 完全一致，
差异只在各家声明的 `sessionCapabilities` 子集（opencode 与 kimi 支持 `fork`/`resume`，goose 当前不声明）。
这正是 ACP 设计的能力协商机制在起作用——**客户端按声明的能力降级，而不是按品牌写分支**。

copilot 与 qwen 的响应另含 `agentInfo`（`{"name":"Copilot","title":"Copilot","version":"1.0.61"}` /
`{"name":"qwen-code","title":"Qwen Code","version":"0.18.0"}`），同属该协议的可选字段。

## 3. 三个附带发现

### 3.1 Gemini 的 ACP 已从实验转正

`gemini --help` 中：

```
--acp                 Starts the agent in ACP mode
--experimental-acp    Starts the agent in ACP mode (deprecated, use --acp instead)
```

**实验标志被废弃、正式标志上位**，是该协议在这家厂商内部转正的明确信号。
对比之下，Codex 的 `app-server` 至今仍标 `[experimental]`。

### 3.2 Gemini 个人订阅路径已下线（生态事实的实时验证）

`gemini --acp` 的 stderr 原样返回：

```
Error authenticating: IneligibleTierError: This client is no longer supported for
Gemini Code Assist for individuals. To continue using Gemini, please migrate to the
Antigravity suite of products: https://antigravity.google
```

这与主方案 §6.2 记载的「自 2026-06-18 起，Gemini CLI 不再服务 Google AI Pro/Ultra 与免费个人账号，
个人终端路径迁到 Antigravity CLI」**一致**，本轮取得官方报错原文作为直接证据。

注意：**认证失败并不妨碍 ACP `initialize` 正确应答**——协议层与认证层是分离的。
这对 SayDo 有直接意义：可以在不持有任何凭据的情况下完成 ACP 能力探测。

### 3.3 Claude CLI 具备双向 stream-json，D8 的一条判断需复核

`docs/07-tech-stack-decisions.md:129` 现记：

> live steer/streaming input 仍 SDK 独有，W5.4 不做

但本机 Claude Code **2.1.220（正是 D8 所引的实测版本）** 的 `--help` 含：

- `--input-format <format>`：`"text"`（默认）或 `"stream-json"`（**realtime streaming input**）
- `--output-format <format>`：含 `"stream-json"`（realtime streaming）
- `--replay-user-messages`：从 stdin 重新发出用户消息到 stdout 以供确认，
  **仅在 `--input-format=stream-json` 且 `--output-format=stream-json` 时有效**

`--replay-user-messages` 的存在直接说明**stdin 侧有持续的消息流**，否则无需「回显确认」机制。

**但这不足以断定 D8 写错了。** 「存在 streaming input 选项」与「语义上等价于 SDK 的 live steer
（会话进行中打断并转向）」是两件事，本轮**未实测**其行为。
W5.4 团队在同一版本上得出「仍 SDK 独有」的结论，可能正是基于语义差异。
**建议复核这一条**，因为若 CLI 的 stream-json 输入已可承载转向，
Tier 1 的能力边界与 §7 的 `switchSemantics` 声明都可能需要更新。

## 4. 对决策 2 的影响

原分析（`2026-08-24-decision-2-impact-analysis.md`）的结论是
「真正的分歧点是 `codex exec` 还是 `codex app-server`」。**该结论仍然成立，但不完整。**

补充后的完整图景：

| 路线 | 覆盖面 | 协议稳定性 | 与现有 `Tier1Backend` 的关系 |
|---|---|---|---|
| A. `codex exec` 作第三个 Tier 1 后端 | **1 个** agent | 正式子命令 | 完全吻合，成本≈一个适配器 |
| B. `codex app-server` 独立平面 | **1 个** agent（专有协议） | `[experimental]`，v1/v2 并存 | 结构性不匹配，需新双向抽象 |
| **C. ACP 适配层** | **实测 6 个**，含 Codex 之外的全部主流 | `protocolVersion: 1`，gemini 已转正 | 结构性不匹配，需新双向抽象 |

**关键**：B 与 C 需要的新抽象是**同一种东西**——一个能应答服务器反向审批请求的双向 JSON-RPC 客户端。
既然成本相同，覆盖 6 个的方案显然优于覆盖 1 个。

**且 Codex 并不因此被排除**：它有 `codex mcp-server` 子命令，且其 app-server 协议与 ACP 同为
JSON-RPC + 能力协商 + 反向审批的形态，未来若 Codex 也提供 ACP surface，可复用同一适配层。

## 5. 建议

### 5.1 决策 2 应重述

原表述「Codex App Server/ACP 归属：推荐作为独立 Execution Agent plane」把两件事捆在了一起。
建议拆成三问：

1. **本轮是否引入 ACP 适配层？** 若是，一次接入覆盖实测 6 个 agent，
   且 D8 第 133 行「若成事实标准则适配层整体切 ACP」的触发条件已满足。
2. **Codex 走哪条？** 短期沿用 `codex exec`（D8 现状，成本最低）；
   中期观察其 app-server 何时脱离 `[experimental]`；
   不建议为单一专有协议单独建平面。
3. **`claude_code` 与 `cursor` 保持现状。** 二者无 ACP，现有 hook 机制是对它们的正确适配，
   不应为了统一而废弃。

### 5.2 方案 §9.4 的表述需要修订

主方案 §9.4 目前把 ACP 描述为若干 agent 的可选 surface。按本轮实证，
ACP 已是 6 家共同实现的互操作协议，建议在 §9.4 与 §6.2 中把它提升为
**独立的接入路径**，而不是逐个 agent 的特性。

### 5.3 一个可观的省力点

若采纳 ACP 适配层，`kimi acp`、`opencode acp` 两条在主方案 §9.4 中分别列为
「L1 Execution Agent」的条目，与 goose、copilot、qwen 一起**共用同一适配器与同一套 TCK**，
不再各自写 driver。这直接削减 §9.4 的长尾接入成本。

## 6. 本实证的边界

- 只测了 `initialize` 一个方法。**未测** `session/new`、`session/prompt`、
  以及服务器反向请求（审批回调）的真实往返与时序。
- 未验证各家对 ACP 可选能力的**实现深度**——`sessionCapabilities` 的声明只是声明。
- grok 未作为 ACP server 实测（它没有 acp 子命令，其 ACP 体现在输出格式）。
- droid 的 `daemon` 未验证协议类型。
- Claude CLI 的 `--input-format stream-json` **未实测行为**，§3.3 的结论仅基于 `--help` 文本。
- 全部结论锚定于第 1 节所列版本，不自动适用于未来版本。
- 未修改任何生产代码。
