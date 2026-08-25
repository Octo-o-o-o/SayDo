# 决策 2 影响面分析：Codex App Server / ACP 归属

- 日期：2026-08-24
- 目的：为 `docs/plan/2026-08-24-ai-supply-owner-decisions.md` 的**决策 2** 提供基于真实代码的判断材料
- 方法：只读现有 `packages/` 源码与 `docs/07-tech-stack-decisions.md` D8，**不引用 AI 供给方案的合同草案**
  （草案本身正是因为这项决策未定才同时容纳两种形态）
- 分析者：Claude（未参与 v1–v20 施工）

## 0. 结论先说

**方案给的默认推荐（「作为独立 Execution Agent plane」）与 D8 的现有立场存在张力，签署前应先明确一件事：
你要接的是 `codex exec` 还是 `codex app-server`。这两者的成本差一个数量级，而决策 2 的表述把它们混在了一起。**

> **2026-08-25 更新**：本结论仍成立，但**不完整**。后续实证
> （[`2026-08-25-agent-cli-acp-capability-survey.md`](2026-08-25-agent-cli-acp-capability-survey.md)）发现，
> 本机 11 个 agent CLI 中有 **6 个实测可作为 ACP server 启动并正确应答 `initialize`**
> （goose、opencode、kimi、gemini、copilot、qwen），返回结构同构的
> `protocolVersion: 1` + `agentCapabilities` + `authMethods`；Grok 的原生输出格式即 ACP session updates。
> **Codex 是唯一走专有 app-server 协议的**，而 SayDo 现有的两个 Tier 1 后端
> （`claude_code`、`cursor`）恰好是唯二完全不沾 ACP 的。
>
> 因此存在**第三条路线 C：ACP 适配层**。它与路线 B 需要的新抽象是同一种东西
> （能应答服务器反向审批请求的双向 JSON-RPC 客户端），但覆盖面是 6 个 vs 1 个。
> **决策 2 应先问「要不要接 ACP」，再问 Codex 走哪条。** 详见该实证报告 §4、§5。

- 若接 **`codex exec`**：现有 `Tier1Backend` 接口**已经能容纳**，且 `codex` 槽位**已在词表里预留**，
  成本约等于再写一个后端适配器（参照现有两个：71 行与 263 行）。不需要新平面。
- 若接 **`codex app-server`**：与现有接口**结构性不匹配**（下详），需要新的双向通道抽象。
  这才是方案要建「独立 Execution Agent plane」的真实原因。实证见 §4.1：
  它是 95 个客户端方法 + 10 个服务器反向请求（含 7 个审批/征询）的完整双向 JSON-RPC，
  而 `codex exec` 的全部输出只有四个单向事件。
  但该子命令仍标注 `[experimental]` 且协议 v1/v2 并存（§4.3）。

## 1. D8 的现有立场

`docs/07-tech-stack-decisions.md:131`（D8 表格 Codex 行）原文：

> Codex | 经 Hopper 现状 `codex exec` adapter(Tier 2) | P1/P2 评估 **app-server**（`turn/steer` + 审批回调）——官方正道，待 Hopper M3b 或缝合层直连

同节末句对 ACP 的立场（`docs/07-tech-stack-decisions.md:133`）：

> **ACP(Agent Client Protocol)持续跟进不押注**——Zed/JetBrains 共建、25+ agent，若成事实标准则适配层整体切 ACP。

读出来的三点：

1. Codex 当前定位是 **Tier 2、经 Hopper、用 `codex exec`**，不是 Tier 1。
2. app-server 被认作「官方正道」，但明确排在 **P1/P2**，且路径是「待 Hopper M3b 或缝合层直连」——
   倾向经 Hopper，而非另起平面。
3. ACP **不押注**。方案默认推荐把 ACP 与 App Server 并列作为独立平面的理由，与这条不一致。

## 2. 现有代码已经有两条执行平面

`packages/daemon/src/bridge/capabilityMatrix.ts:6`：

```ts
export type ExecBackend = "tier1" | "hopper";
```

两条平面的能力矩阵是**显式声明**的（同文件 `MATRIX`）：`tier1` 两种模式全支持且切档语义为 `live`；
`hopper` 的 `step_confirm` 为 `unsupported`，只支持 `direct_to_review`，切档语义为 `cancel_new_run`。

两条平面的执行模型截然不同：

| | Tier 1 | Hopper |
|---|---|---|
| 谁持有进程 | SayDo 自己 spawn CLI 子进程 | 外部系统；SayDo 只投递 |
| 交互方式 | 逐行解析 stdout | 投递（drop）后回填结果 |
| 工具拦截 | 写 hook 配置文件，同步阻塞回连 daemon | 不适用 |
| 代码位置 | `packages/daemon/src/tier1/`（10,421 行） | `packages/daemon/src/bridge/dispatch.ts`（100 行，管 binding 与回填） |

**这意味着「独立 Execution Agent plane」不是全新概念**——Hopper 已经是一条独立平面。
真正的问题是 Codex App Server 更接近哪一种，还是两者都不是。

## 3. `codex` 槽位已经预留

`packages/contracts/src/types/task.ts:12`：

```ts
export const adapterSchema = z.enum(["claude_code", "cursor", "codex"]);
```

但 `packages/daemon/src/tier1/backends/types.ts:5` 只实现了两个：

```ts
export type AdapterKind = Extract<Adapter, "cursor" | "claude_code">;
```

即：**合同词表里 `codex` 已是合法 Tier 1 后端，只是没有实现**。
`packages/daemon/src/tier1/resolveAdapter.ts` 的 adapter 解析与一致性检查（`checkRunAdapterConsistency`）
是后端无关的，新增第三个后端不需要改动它。

## 4. 为什么 `codex exec` 能塞进来，而 `app-server` 不能

`Tier1Backend` 接口（`packages/daemon/src/tier1/backends/types.ts:48-65`）的形状：

```ts
export interface Tier1Backend {
  readonly adapter: AdapterKind;
  buildArgv(i: Tier1BuildArgvInput): string[];
  provisionHooks(cwd, gate, hookTimeoutSec?): { extraArgs: string[]; filesWritten: string[] };
  parseLine(line: string): readonly Tier1Event[];
  isTerminalResult(line: string): boolean;
  finishPolicy: "kill_on_result" | "wait_exit_then_kill";
  canaryLeft: "shell_started" | "tool_result";
  explainFailure(exit, stderrTail, lines?): { code: string; message: string };
}
```

这个接口的每一个成员都假设了**「构造一次命令行 → 单向读 stdout → 进程结束」**的生命周期：

- `buildArgv()` 返回 `string[]`：一次性命令行，没有会话建立的概念。
- `parseLine()` / `isTerminalResult()`：单向行流解析。
- `finishPolicy`：`kill_on_result` 或 `wait_exit_then_kill`，两者都是进程终止策略。
- `provisionHooks()`：靠**写配置文件**注入拦截（Claude 的 `PreToolUse` hook、Cursor 的 `beforeShellExecution`）。
- `explainFailure(exit, stderrTail, ...)`：从**退出码与 stderr** 解释失败。

**接口里没有任何「向 agent 发送消息」的方法。** 整个抽象是单向的。

`codex exec` 是一次性命令、逐行 JSON 事件输出、进程退出 —— 与上述每一条都吻合。
`codex app-server` 是 JSON-RPC **长连接**，需要 SayDo 在会话中途**主动发送**消息并**应答**
来自 agent 的审批请求，这在当前接口里没有落点，也无法靠 `provisionHooks` 写文件模拟。

### 4.1 两者形态的实证（2026-08-24 本机实测，codex-cli 0.147.0）

**`codex exec`** —— 实跑 `codex exec -s read-only -m gpt-5.6-sol --json 'reply with OK only' < /dev/null`，
exit=0，完整事件流仅四条，随后进程退出：

```
thread.started → turn.started → item.completed → turn.completed
```

单向 stdout 行流，启动后**没有任何输入通道**。
（首行为 `Reading additional input from stdin...`，即不加 `< /dev/null` 会阻塞的已知形态。）

**`codex app-server`** —— 该子命令自带协议 schema 生成器，
`codex app-server generate-json-schema --out <DIR>` 产出 39 个类型文件。实测统计：

| 方向 | 数量 | 说明 |
|---|---|---|
| `ClientRequest`（客户端 → 服务器） | **95** 个方法 | 含 `thread/start`、`thread/resume`、`thread/fork`、`thread/rollback`、`turn/start`、**`turn/steer`**、`turn/interrupt`、`thread/compact/start` |
| `ServerRequest`（服务器 → 客户端） | **10** 个方法 | 其中审批/征询类 **7** 个 |
| `ServerNotification` | **70** 个 | 单向事件 |

服务器反向请求的审批/征询类（v2 五项 + v1 遗留两项）：

```
item/commandExecution/requestApproval     item/fileChange/requestApproval
item/permissions/requestApproval          item/tool/requestUserInput
mcpServer/elicitation/request              applyPatchApproval（v1）
execCommandApproval（v1）
```

另有三个非审批的反向请求：`item/tool/call`（服务器请求客户端执行工具）、
`account/chatgptAuthTokens/refresh`、`attestation/generate`。

传输层由 `--listen` 决定，支持 `stdio://`（默认）、`unix://`、`unix://PATH`、`ws://IP:PORT`、`off`。

### 4.2 一个架构反讽

Tier 1 现在靠 `provisionHooks()` 写配置文件实现工具拦截
（Claude 的 `PreToolUse` hook、Cursor 的 `beforeShellExecution`，同步阻塞回连 daemon 等裁决，见 D8）。
而 app-server 的 `item/fileChange/requestApproval` 等 5 个 v2 审批请求**就是协议原生的同一件事**。

即：**Tier 1 的 hook 机制正是在模拟 app-server 天生具备的能力**。
把 Codex app-server「并入 Tier 1」在架构上是别扭的——`Tier1Backend` 那套
`buildArgv`/`parseLine`/`finishPolicy` 是为「没有回话通道的 CLI」设计的补偿，
硬套给一个原生双向的协议，等于把原生能力降级成文件 hook。

### 4.3 但 app-server 有两个减分项

1. **`codex app-server --help` 首行标注 `[experimental]`**。同为实验性的还有 `exec-server`
   （`[EXPERIMENTAL] Run the standalone exec-server service`）。
2. **协议已有 v1/v2 两套并存**：schema 输出目录同时含 `v1/`、`v2/` 与
   `codex_app_server_protocol.schemas.json`、`codex_app_server_protocol.v2.schemas.json`；
   `applyPatchApproval`/`execCommandApproval` 是 v1 遗留，v2 换成了 `item/*/requestApproval`。

押注 experimental 且正在换代的协议，意味着接入后要跟随其变更。
**D8 把 app-server 排在 P1/P2 而非当下，从实证看是站得住的判断。**

## 5. 两条路的成本对比

以下为基于现有代码规模的估计，不是精确工时。

**路线 A：接 `codex exec`，作为第三个 Tier 1 后端**

- 新增：`packages/daemon/src/tier1/backends/codex.ts`。
  参照量：`cursor.ts` 71 行、`claude.ts` 263 行。
- 修改：`AdapterKind` 的 `Extract<...>` 加一项；`resolveAdapter` 无需改。
- 合同：`adapterSchema` 已含 `codex`，**不需要改合同**。
- 不需要新平面、新状态机、新 proof 合同。
- 局限：`codex exec` 无 live steer；能力矩阵需为其声明 `step_confirm` 支持度（现有矩阵已有此机制）。

**路线 B：接 `codex app-server`，作为独立 Execution Agent plane**

- `ExecBackend` 从二元扩为三元，`capabilityMatrix` 需要为新平面补全模式支持声明。
- 需要新的双向会话抽象（建立/turn/steer/审批回调/取消/终止），无法复用 `Tier1Backend`。
- 需要新的执行状态与 proof 归属 —— D8 明确要求「若并入 Tier 1/Hopper，必须同步 D8 与全部状态/proof 合同」。
- `docs/modules/c-control-bridge.md` C2/C5 的 dispatch Gate 0 与逐工具前置审批需为新平面重新证明。
- 这正是 AI 供给方案 §4 铺开约 2,154 行 `execution` 相关合同的来源。

## 6. 给 owner 的建议

**建议把决策 2 拆成两问再签**，否则签下去的东西边界不清：

1. **本轮要接的 Codex surface 是 `codex exec` 还是 `codex app-server`？**
   - 若沿用 D8 现状（`codex exec`，Tier 2 经 Hopper），则本决策的答案是「不新建平面」，
     且大部分 §4 的 execution 合同在本轮**用不上**。
   - 若要在本轮接 app-server，则需要独立平面，方案默认推荐成立，但要承担第 5 节路线 B 的全部成本，
     并且这与 D8 把 app-server 排在 P1/P2 的现状冲突，需要同时更新 D8。
2. **ACP 是否随本决策一起押注？**
   D8 现状是「持续跟进不押注」。方案默认推荐把 ACP 与 App Server 并列进独立平面，
   等于提前押注。若无充分理由，建议保持 D8 现状，ACP 只做 inventory。

**一个可能省掉大量工作的观察**：如果本轮答案是「沿用 `codex exec`」，
那么 §4 中为「独立执行面」准备的合同在本轮不需要收敛，
草案下沉 `packages/contracts` 时可以整段推迟——这会直接减少 v20 十一条 A 级里
与 authority lease / execution terminal 相关的若干条的紧迫性。

## 7. 本分析的边界

- 未读 AI 供给方案的合同草案，结论只基于现有生产代码与 D8。
- 第 5 节的成本对比是基于现有文件规模的**估计**，不是实测工时。
- `codex app-server` 的协议细节**已于 2026-08-24 本机实证**（codex-cli 0.147.0，见 §4.1），
  不再依赖 D8 表格的转述。但实证仅覆盖协议 schema 与 `exec` 的事件流形态，
  **未实际建立 app-server 会话**，也未验证其审批回调在真实执行中的时序与超时语义。
- 本机版本 0.147.0 的结论不自动适用于未来版本，尤其在协议标注 `[experimental]` 且 v1/v2 并存的情况下。
- 未修改任何生产代码。
