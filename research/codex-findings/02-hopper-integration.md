# VoiceLoop × Hopper 集成可行性评估与最小对接方案

> 评估日期：2026-07-22（Asia/Shanghai）
> Hopper 基线：本地 `main@c4c29c6`；Node/TypeScript；本报告只读 Hopper，未改其源码。
> 评估范围：VoiceLoop 的“语音访谈/决策包/拍板/语音回叫”对接 Hopper 当前 task 级交付流水线，以及 Hopper 统一自动化平台 program 的 M3a 冻结模型。
> 联网状态：已联网；外部实践只引用官方文档、官方仓库或标准。
> 核心口径：**schema 已存在不等于 runtime 已实现；事件已出现不等于 run 已原子完成；runner 进程能被杀不等于可流式 steer。**

## 0. 执行结论

**总判定：task 粒度的异步最小闭环今天可拼出，生产级对接为 Conditional Go；VoiceLoop 设想的流式 steer、交互问答、正式 `DecisionRequest` 语音审批和 `NotificationIntent` transport 今天不可直接使用。**

今天可以不改 Hopper 源码，由 VoiceLoop 侧写四块胶水，跑通：

1. 把已拍板决策包渲染成 Hopper Markdown task；
2. 经 `hopper --json drop --stdin` 投递，并经 `scan`/`run next` 执行；
3. 以只读游标消费 `events.jsonl`（或本机 Console SSE + `/api/events` 回补）；
4. 在候选终态事件后等待 run artifact 落定，确认 task 已进入 `review`，写 callback outbox，再触发一次语音回叫。

这条闭环的产品语义必须是“**执行和 Hopper 闸门已结束，等待验收**”，不能说“任务已完成”。Hopper 的 code task 只有 merge/archive 后才是 `done`；当前 review approval 也明确返回“code tasks need merge to become done”（`Hopper/src/scheduler/mutation/handlers/review.ts:102-119`）。

### 0.1 六个问题的一页结论

| 问题 | 判定 | 今天可用的接口 | 关键限制 |
|---|---|---|---|
| 1. 任务卡 drop | **可行** | Markdown stdin/file + CLI `--json`；项目预注册 | repo/base branch 不属于 task 输入；决策包 digest、会话/回叫关联没有一等字段 |
| 2. 事件 → 语音回叫 | **PoC 可行，生产需桥接层** | `events.jsonl`；Console `/api/stream` + `/api/events?after=` | 无 webhook；无正式 `RunFinalized`；`NotificationIntent` 只有 schema |
| 3. 语音审批 | **模型形状部分可承接，运行时不可用** | 当前 `review approve` 可绑定 run/evidence/tree | M3a Decision runtime 未实现；无 `voice` channel、nonce、语音呈现证据/身份上下文 |
| 4. stream / steer | **现状不满足** | 粗粒度 `cancel`；随后新 run `retry --message` | runner contract 是单发+终报；session id 未接续；不是同一 turn steer |
| 5. 成熟度 | **现 task 流水线成熟；平台控制面未成熟** | drop/triage/worktree/runner/gates/review/merge/event log/现 usage | M3b/M3c/M3d/WS4 仍是后续里程碑 |
| 6. 最小 PoC | **3–4 工程日可做** | 全部复用现接口，Hopper 0 源码改动 | 需 VoiceLoop 侧 renderer、CLI client、event bridge、durable callback outbox |

工期均为本评估的**工程推断**，不是 Hopper 项目承诺：已有可调用语音回叫能力时，PoC 约 3–4 工程日；若还需实现 TTS/电话或实时会话唤回，再加约 1–2 日。生产级 task bridge（稳定契约、outbox、恢复、监控）约 1–2 周；真正 streaming/steer/permission adapter 约 2–4 周，且取决于 provider 能力与测试深度。

### 0.2 事实标签与核验基线

- **【已验证事实·本地】**：本次实际读到的仓库文件、源码或命令输出。
- **【已验证事实·联网】**：本次从官方文档、官方仓库或标准核实。
- **【推断】**：基于上述事实的接口设计、风险判断或工期估算，不冒充实现现状。
- **【建议】**：推荐落地方式；尚未在当前仓库实现。

本次本地核验：

- **【已验证事实·本地】** Hopper HEAD 实际输出为 `c4c29c6`；工作树已有用户改动 `M docs/IMPL-LOG-PLATFORM-2026-07-20.md`，本评估未触碰该文件。
- **【已验证事实·本地】** 定向执行 `npx vitest run test/unit/platform-schemas.test.ts test/unit/drop.test.ts test/e2e/console.test.ts test/e2e/cli-smoke.test.ts`，原始汇总为 `Test Files 4 passed (4)`、`Tests 58 passed (58)`，耗时 `28.23s`。这证明相关现有路径在本基线通过，不证明未实现的 M3b/M3c/M3d runtime 存在。
- **【已验证事实·本地】** Hopper 要求 Node `>=22`，build、typecheck、test、e2e 和开发态 `hopper` 命令均已在 `package.json` 声明（`Hopper/package.json:15-39`）。

---

## 1. Hopper 现有接口清单

### 1.1 输入与命令面

| 接口 | 当前事实 | 对 VoiceLoop 的用法 | 稳定性判断 |
|---|---|---|---|
| Markdown drop CLI | `drop [files...]` 可读多文件；省略文件或 `--stdin` 可读 stdin；可指定 `--project`（`Hopper/src/cli/register/task.ts:33-47`） | 主入口：将 Task Card 渲染为 Markdown 后走 stdin | **PoC/当前产品可用** |
| JSON CLI envelope | 全局有 `--json`、`--vault`、`--no-llm`（`Hopper/src/cli/index.ts:40-57`）；drop 返回严格 outcome/result（`Hopper/src/schemas/drop-result.ts:5-23`） | 子进程调用、机器解析，不抓人类文本 | **推荐** |
| direct filesystem drop | Hopper 的 vault 有 Inbox/Tasks/Runs/Events 等目录，README 把文件系统定义为真相面（`Hopper/README.md:72-85`） | 不推荐 VoiceLoop 直接写内部状态；只读 artifacts/events | **不要作为写 API** |
| project link | project config 绑定 repo、runner、default branch 和 verification（`Hopper/src/core/config/load.ts:241-272`）；CLI 提供 `link-project`（`Hopper/src/cli/register/vault.ts:42-60`） | 接入前预注册 repo；Task Card 只引用 project | **必需前置** |
| scan / triage | `scan` 发现/登记 Inbox 并做 deterministic triage；`triage` 支持单 task/全量和 `--no-llm`（`Hopper/src/cli/register/task.ts:65-85`） | drop 后显式 scan，得到 ready/blocked 等状态 | **可用** |
| run / daemon | Hopper 的主流程是 drop→triage→compile→schedule→worktree→runner→post-run gates→review→merge（`Hopper/docs/00-overview.md:25-31`） | PoC 用 attended `run next`；持续服务再评估 daemon | **可用但有边界** |
| cancel / retry | 当前 control CLI 有 task cancel（`Hopper/src/cli/register/control.ts:15-23`）；retry 会重新执行 task，并拼接人工 retry context（`Hopper/src/review/retry.ts:35-100`、`Hopper/src/review/retry.ts:113-156`） | 只能做“取消当前 run + 新 run 修订”，不宣称 live steer | **粗粒度可用** |
| Console write API | Console 有本机 HTTP routes，包含 POST drop；读写有 Bearer/Origin 约束（`Hopper/src/console/server.ts:223-361`、`Hopper/src/console/auth.ts:19-39`） | 可用于本机 Demo；不应当作稳定公开服务 API | **内部 UI 面** |

Hopper 自己把当前边界说得很清楚：它是 coding-agent delivery gate 和本地 Markdown inbox orchestration；文件系统是真相，runner 输出不可信，验收由独立闸门完成（`Hopper/README.md:38-50`）。因此 VoiceLoop 应把 Hopper 当**另一个 bounded context**，通过输入/事件协议集成，而不是复用其内部 store 类或直接改 frontmatter/status。

### 1.2 状态、事件与 artifacts

- **事件日志：** `EventLog.append()` 会校验 event、追加 JSONL 并 `fsync`；`readEvents()` 支持缓存、增量读取、文件截断检测和坏行报告（`Hopper/src/core/events/log.ts:54-82`、`Hopper/src/core/events/log.ts:84-127`、`Hopper/src/core/events/log.ts:129-197`）。这是当前最接近 durable integration contract 的接口。
- **投影：** task 状态按 event append order 投影；`RunnerFinished` 只是 runner 终报，verification/acceptance/docs/review/merge 是后续状态（`Hopper/src/core/state/projector.ts:81-115`、`Hopper/src/core/state/projector.ts:143-229`）。
- **run artifacts：** vault 为每个 run 提供目录，并有 run summary、runner result、verification/review 等路径（`Hopper/src/core/vault/layout.ts:65-90`、`Hopper/src/core/vault/layout.ts:127-129`）。
- **Console 增量读：** `/api/events` 接收 cursor；`/api/stream` 提供 SSE（`Hopper/src/console/server.ts:238-279`）。前端保存 seq、在 hello 检测 gap/truncation 后回补，并在 SSE 失败时轮询（`Hopper/src/console/web/app.js:42-62`、`Hopper/src/console/web/app.js:854-934`）。这套算法值得桥接层复用。
- **Console watcher：** chokidar 使用 100ms `awaitWriteFinish`、150ms 广播 debounce、25 秒 heartbeat（`Hopper/src/console/watch.ts:29-40`、`Hopper/src/console/watch.ts:85-97`）。在本机稳定写入下，**推断**事件到 SSE 通知通常约为 250ms 加调度开销，但源码没有 SLA，不能承诺 P95。

### 1.3 执行、验收与使用量

- Runner adapter 当前只有 `buildCommand()` 与 `parseResult()`；输入是一次 run 的 prompt/worktree/schema 等，接口没有 `events()`、`steer()`、`answerPermission()` 或 `resume()`（`Hopper/src/runners/types.ts:4-28`、`Hopper/src/runners/types.ts:38-48`）。
- executor spawn 子进程后关闭 stdin，等待退出，再从完整 stdout 解析终报；cancel/timeout 是进程级终止（`Hopper/src/runners/executor.ts:34-67`、`Hopper/src/runners/executor.ts:69-147`）。
- Claude adapter 使用 `claude -p --output-format json --json-schema`；Codex adapter 使用 `codex exec --json ... -`，两者都是一次性命令（`Hopper/src/runners/claude-adapter.ts:47-89`、`Hopper/src/runners/codex-adapter.ts:46-91`）。
- runner 成功后才进入 verification→guardrails→risk→acceptance→docs→summary；`RunnerFinished` 在 post-run 之前发出（`Hopper/src/scheduler/execute.ts:262-315`）。
- 当前 review approval 已不是裸布尔值：它计算并落账 `run_id + evidence_digest + prospective tree_sha`，merge 时逐项复验且再算实际 merge tree（`Hopper/src/scheduler/mutation/handlers/review.ts:58-119`、`Hopper/src/review/merge.ts:83-97`、`Hopper/src/review/merge.ts:241-273`）。
- 当前 usage gate 有并发、总预算、runner/project bucket 和 daemon preflight；但现 ledger 对未知 cost 在聚合桶中按 0 计，不是 M3c 的 attempt/step `UsageEvent` 完整体（`Hopper/src/usage/gate.ts:13-34`、`Hopper/src/usage/gate.ts:60-81`、`Hopper/src/usage/ledger.ts:70-121`）。

### 1.4 M3a 平台模型：已冻结的“合同”，不是已运行的服务

- M3a 冻结对象包括 `DecisionRequest`、`Command`、`ExecutorHandle`、`UsageEvent`、workflow/notification 等 schema；append order 仍是权威顺序（`Hopper/docs/SCHEMA-FREEZE-M3A.md:10-26`）。
- 设计文档明确说 M3a 产 schema，runtime 分属 M3b/M3c；`Run/Attempt` 也是目标模型，不是当前 task/run 投影已整体迁移（`Hopper/docs/M3A-DOMAIN-MODEL-DESIGN-2026-07-21.md:16-22`）。
- 冻结说明把 command/decision enforcement、usage、workflow loader/projector 等消费者义务分派给 M3b/M3c/M3d，并明确 14 个新事件当前没有 projector cases（`Hopper/docs/SCHEMA-FREEZE-M3A.md:36-54`）。
- 本次对 `src/` 排除 `src/schemas/**` 后检索 `DecisionRequested|DecisionResolved|NotificationIntentIssued|NotificationIntent`，没有找到运行时 producer/consumer。**这是负向源码证据**；结合前述里程碑文档，结论是“schema-only”，不是“因没搜到就绝对不存在”。

---

## 2. 问题 1：VoiceLoop Task Card 如何进入 Hopper

### 2.1 推荐入口

**【建议】唯一推荐的 PoC 写入口是：受控子进程调用 Hopper CLI，Markdown 从 stdin 输入，打开 `--json` 并固定 vault。**

```bash
node /path/to/Hopper/bin/hopper.mjs \
  --vault "$VOICELOOP_HOPPER_VAULT" \
  --json \
  drop --stdin --project reporting-app
```

理由：

1. CLI 已把 stdin/file、project、mutation 单写者和结构化结果封装起来（`Hopper/src/cli/commands/drop.ts:16-60`）。
2. mutation queue 会在有 daemon 时排队；默认等待上限 30 秒、轮询 150ms，并由 handler 落到同一 drop 实现（`Hopper/src/scheduler/mutation/queue.ts:32-95`、`Hopper/src/scheduler/mutation/queue.ts:140-166`）。VoiceLoop 不应绕过它并直接写 `events.jsonl`。
3. drop 会解析 Markdown/frontmatter，按显式 id、正文 hash、source path 去重，并对正在执行/待 review 的同 id 内容产生新 revision 而非静默覆盖（`Hopper/src/core/drop/drop.ts:46-100`、`Hopper/src/core/drop/drop.ts:112-143`、`Hopper/src/core/drop/drop.ts:150-276`）。

Console POST drop 可做展示，但 server 默认随机端口、随机 token、只监听 `127.0.0.1`（`Hopper/src/console/server.ts:68-141`），且没有版本化公开 API 声明；长期 bridge 不宜依赖其生命周期。

### 2.2 字段映射

VoiceLoop 当前 Task Card 规定了 `id/title/goal/acceptance/repo/base_branch/constraints/agent/status/worktree` 等字段，并要求先口头确认再创建（`voice-coding-framework.Cursor2.md:265-287`）。Hopper task frontmatter 的一等字段见 `Hopper/src/schemas/frontmatter.ts:61-89`。

| VoiceLoop 字段 | Hopper 落点 | 映射结论 |
|---|---|---|
| `id` | frontmatter `id` | 直接映射，建议命名空间 `vl-<project>-<ulid>`；Hopper 要求 id 为安全单路径段（`Hopper/src/core/drop/drop.ts:60-64`） |
| `title` | 正文首个 `# H1` | 直接映射；Hopper 从 H1/首个非空行抽 title（`Hopper/src/core/frontmatter/frontmatter.ts:104-114`） |
| `goal` | `## Goal` 正文 | 语义映射；编译器会把 task body 带入 runner prompt（`Hopper/src/compiler/compiler.ts:118-151`） |
| `acceptance[]` | `## Acceptance Criteria` 下逐条 bullet | 必须是可判定条目；缺验收会被 triage 阻断（`Hopper/src/triage/rules.ts:124-193`） |
| `constraints[]` | `## Constraints` 正文 | 语义映射；不要把口语自由文本映成 verification shell 命令 |
| `agent` | frontmatter `runner` | 映射为已注册 runner/profile；合法 selector 由 schema 校验（`Hopper/src/schemas/frontmatter.ts:20-31`） |
| `repo` | `projects.toml` 中 project 的 `repo` | **不应放 task body 作为权威值**；接入时先 `link-project` |
| `base_branch` | project 的 `default_branch` | **不属于当前 task 一等字段**；不同 base 应拆 project/profile 或先扩 Hopper 契约 |
| Voice `status` | 不映射 | Hopper status 是事件投影；drop 默认 `received`（`Hopper/src/core/frontmatter/frontmatter.ts:78-101`） |
| Voice `worktree` | 不映射实际路径 | 只可选 Hopper `worktree: auto/always/never`；路径由 Hopper 创建并拥有 |
| 决策包/来源 | 正文中的 digest/ref；`resources[]` 仅作 trace metadata | `resources` 是路径数组（`Hopper/src/schemas/frontmatter.ts:73-79`），但当前 compiler 收集 task body/retry/wikilinks/agent instructions，没有消费该字段（`Hopper/src/compiler/context.ts:118-190`）；完整 package 留在 VoiceLoop immutable store |
| Voice risk | Hopper `risk` 或交由 triage | 需要显式词表映射；不能假定 Voice L0-L3 等于 Hopper task risk |

建议渲染模板：

```markdown
---
type: hopper/task
id: vl-reporting-01J...
project: reporting-app
priority: normal
runner: claude
worktree: auto
resources:
  - /absolute/path/to/voiceloop/decision-packages/dp-01J....json
tags:
  - voiceloop
---

# 修复月报导出中的时区偏移

## Goal
让月报的统计边界按 Asia/Shanghai 计算。

## Decision Package
- package_id: dp-01J...
- payload_sha256: <64-hex>
- VoiceLoop task_id: vl-task-01J...

## Constraints
- 不改变历史数据格式。
- 不引入新的外部服务。

## Acceptance Criteria
- Asia/Shanghai 月末 23:59 的记录计入当月。
- UTC 月界线不再影响月报分组。
- 项目登记的测试与 typecheck 全部通过。
```

### 2.3 能对上什么、缺什么

**【已验证事实·本地】能对上：** coding task 的 identity、标题、目标、约束、验收条目、runner selector、project 引用、依赖、优先级、risk、worktree policy 和资源路径元数据。正文 hash 只基于 body，不受 Hopper 后续 frontmatter 投影字段影响（`Hopper/src/core/frontmatter/frontmatter.ts:31-33`），适合做 task revision 去重。

**`resources[]` 当前不是 context import API。** 若 runner 必须看到某段决策上下文，应把最小必要内容写进 Task Card body，或把经过脱敏的 Hopper-local decision/plan 文档放入同 project 子树并在正文使用 `[[wikilink]]`；compiler 只会在 token budget 内解析这类链接（`Hopper/src/compiler/context.ts:153-172`、`Hopper/src/compiler/context.ts:229-255`）。VoiceLoop 外部 package path 只用于 bridge/人类审计，不应假定 runner 会读取。

**【已验证事实·本地】缺少一等字段：** VoiceLoop conversation/session id、decision package id/digest、拍板 receipt、callback recipient/policy、交互能力需求（可否 steer/需否 permission）、外部 correlation id、VoiceLoop 的 L0-L3 授权等级，以及每 task repo/base branch。

未知 frontmatter key 在 parse/serialize 时可以保留（`Hopper/src/core/frontmatter/frontmatter.ts:36-70`），但它们不在 task schema，Hopper runtime 也不会赋予语义。**【建议】不要把“能保留”误当“正式协议”；PoC 用正文/resource ref + VoiceLoop 自己的 mapping store，平台化时再增加 namespaced `external_refs`/`intake_ref`。**

### 2.4 drop 的幂等与冲突策略

VoiceLoop bridge 必须显式处理四种结果：`created`、`updated_draft`、`new_revision`、`duplicate_ignored`（`Hopper/src/schemas/drop-result.ts:5-23`）。建议策略：

- `created`：记录 `voice_task_id ↔ hopper_task_id ↔ package_digest`，继续 scan/run。
- `duplicate_ignored`：只有 mapping 中 digest 与当前 package 一致才当幂等成功。
- `updated_draft`：记录新 revision；再次确认 acceptance/digest 后才 dispatch。
- `new_revision`：**不自动执行**；旧 task 已进入受保护状态，要求用户确认“替代旧任务、取消旧 run，还是作为后续任务”。

VoiceLoop 不能仅依赖相同 Markdown body 去重：决策包 digest、授权 receipt 或 callback policy 变化可能不改变 coding body，却会改变执行授权语义。外层 dispatch 仍需自己的 `dispatch_id` 和 CAS/idempotency ledger。

---
## 3. 问题 2：事件消费如何驱动语音回叫

### 3.1 当前事件能表达哪些回叫语义

Hopper event envelope 包含 `event_id`、时间、actor/source、task/project/run/attempt、summary 和 payload；**raw `events.jsonl` 本身没有 `seq` 字段**（`Hopper/src/schemas/event.ts:17-56`）。Console read/watch 层才按当前 append position 派生 1-based `seq`（`Hopper/src/console/handlers/read.ts:159-166`、`Hopper/src/console/watch.ts:91-96`）。event type union 同时列出当前 task 流水线事件与 M3a 新事件（`Hopper/src/schemas/event.ts:117-184`、`Hopper/src/schemas/event.ts:192-285`）。VoiceLoop 可从当前已产生的 task 事件归一化出以下回叫：

| VoiceLoop 回叫类别 | 当前 Hopper 信号 | 说话口径 |
|---|---|---|
| `execution_failed` | `RunnerFinished.payload.status` 为 failed/timeout/blocked/cancelled，或 `RunnerCancelled` | “执行未完成/已取消；原因……” |
| `gate_blocked` | `VerificationFinished` failed/timeout；`RiskReevaluated` 升级并阻断；`RecoveryRecorded` 需人工；triage 进入 blocked/conflict | “Hopper 在某道闸门停住，需要处理……” |
| `ready_for_review` | post-run 全部闸门落定且投影状态为 `review` | “执行和自动闸门已结束，等待你验收” |
| `approval_needed` | **当前 task 模型没有通用 DecisionRequest runtime**；可从 `review` 状态派生“请验收” | 不要伪称 Hopper 已发正式审批请求 |
| `done` | `MergeFinished` 后投影确认 `done`（该事件也可能表示 conflict/tree mismatch），或 `Archived.final_status=done` | “任务已完成/已合并” |

这里有一个集成级 P0 陷阱：**不能把 `RunnerFinished(status=completed)` 当完成，也不能单独把当前最后一个 `DocsAlignmentChecked` 当作 run 已原子 finalized。**

- `RunnerFinished` 在整个 post-run pipeline 之前发出（`Hopper/src/scheduler/execute.ts:262-310`）。
- `DocsAlignmentChecked` 在 docs artifacts 写完后发出，但 Hopper 随后才采集 final worktree、计算 prospective merge tree、写 `worktree-changes.json`、生成 delivery evidence，最后写 summary（`Hopper/src/postrun/pipeline.ts:236-283`、`Hopper/src/postrun/pipeline.ts:285-328`）。
- 全部事件处理完后，execute 才重放投影并写回 frontmatter（`Hopper/src/scheduler/execute.ts:313-315`）。
- 同理，不能只按 event type 把任意 `MergeFinished` 当成功；projector 只在 payload status 缺省/merged 时置 `done`，conflict 置 `conflict`，tree mismatch 保持原状态（`Hopper/src/core/state/projector.ts:220-229`）。

**【结论】** `DocsAlignmentChecked` 只能是 `ready_for_review` 的**候选唤醒信号**。bridge 收到后还要等待 `20-Runs/Summaries/<run_id>.md` 和 `runner-result.json`/final snapshot 可读，并重放或读取 task projection，确认 `last_run_id` 一致且 status=`review`；否则继续等待或转 `integration_fault`。生产版最好让 Hopper 在 summary、delivery evidence、projection 都落定后新增明确的 `RunFinalized`（短期）或平台目标 `AttemptFinished`（M3b/M3c）事件。

### 3.2 三种消费方式

| 方式 | 如何接 | 优点 | 缺点 | 建议 |
|---|---|---|---|---|
| 定时读 `events.jsonl` | 只读打开；按 byte offset/本地 append index 增量解析；每 500–1000ms poll | 不依赖 Console 进程；最少组件 | raw event 无 seq；要自己处理半行、截断、坏行、重启 | **PoC 首选** |
| watch + 增量读文件 | watcher 只作唤醒；真正数据仍从 last offset 重读 | 本机延迟低 | `fs.watch`/底层 watcher 在网络/虚拟 FS 不稳定 | 本机可用，必须有 polling fallback |
| Console SSE + 回补 | Bearer 连 `/api/stream`；保存 seq；断线后 `/api/events?after=<seq>` | 已有前端参考实现，低延迟 | random port/token、本机 loopback、Console 生命周期、非公开版本化 API | Demo 可用，生产不建议绑定 |

没有现成 webhook：server 对已列 GET/POST route 之外返回 404，公开路由中没有 webhook registration/delivery（`Hopper/src/console/server.ts:223-361`）。`NotificationIntent` 当前也不是 transport；它只有 urgency、dedup key、recipient、title/body、decision/subject refs 与 issued time 的严格 schema（`Hopper/src/schemas/platform/workflow.ts:93-106`）。注释还明确 transport 由 WS4 消费，而 program 排期把 Decision Inbox/NotificationIntent transports 放在后续 WS4（`OpenClaw-MultiAgent-Kit/docs/CONTROL-TOWER-DESIGN-2026-07-20-Cursor.md:217-220`）。

### 3.3 推荐消费协议

**【建议】在 VoiceLoop 与 Hopper 之间运行一个本机 `hopper-voice-bridge`，协议如下：**

1. **初始化游标：** 文件模式持久化 `{vault_id, generation, file_identity, byte_offset, complete_line_count, prefix_checkpoint, last_event_id}`；Console 模式才使用 `{last_seq, last_event_id}`。首次上线从当前 EOF 开始，只跟踪之后由 VoiceLoop dispatch 的 task；需要补历史时全量 replay。
2. **单调读取：** 每次只读完整 JSONL 行，按 Hopper event schema 校验；不完整尾行留到下一轮，绝不写/修复 Hopper 日志。
3. **gap/truncation：** Console 模式遇到 `seq > last_seq+1` 时 backfill，hello seq 回退时全量 replay。文件模式没有内建 seq；文件尺寸小于 offset、identity 改变、prefix checkpoint 不匹配或出现 corrupt line 时切换 generation 并全量重建。Console 前端已有 hello seq + backfill 的同类做法（`Hopper/src/console/web/app.js:854-934`）。
4. **相关性过滤：** 只处理 mapping store 中的 `hopper_task_id`；再核对 `run_id`、decision package digest 和当前 revision，防止旧 run 回叫到新语音会话。
5. **事件分类：** event 只触发 state reconciliation，不直接 TTS。bridge 读取当前投影与 artifacts，计算 `callback_kind` 和可播报 summary。
6. **durable outbox：** 写入 VoiceLoop 自己的 callback outbox，幂等键至少为 `(hopper_task_id, run_id, callback_kind, state_version)`；保存触发 `event_id`。先持久化，再调用语音回叫 transport。
7. **at-least-once：** transport ack 后标 sent；超时重试。用户端对同 dedup key 只播一次，重复 delivery 可进入文字通知而不重复拨号。
8. **可恢复对账：** bridge 重启后从相应 file/Console cursor replay，再扫描所有处于 pending/inflight 的 VoiceLoop dispatch；以 Hopper projection/artifacts 对账，而不是相信上一次进程内状态。

Hopper 的 `EventLog` 明确承担单写者追加（`Hopper/src/core/events/log.ts:54-82`）。VoiceLoop bridge 必须是**只读消费者**；任何 callback ack、游标或语音 transcript 都写在 VoiceLoop store，不能追加到 Hopper `events.jsonl` 冒充 Hopper 事件。

### 3.4 延迟预期

- **文件 polling PoC：** 1 秒 interval 时，事件发现延迟上界约为 1 秒 + artifact settle/reconcile 时间；这是配置推断，不是测得的 SLA。
- **Console SSE：** watcher 100ms settle + 150ms debounce，推断稳定本机通知通常约 250ms 加 OS/事件循环时间（`Hopper/src/console/watch.ts:29-40`、`Hopper/src/console/watch.ts:85-97`）。
- **回叫端到端：** 还包含 summary 生成、outbox、VoiceLoop session 唤回/TTS/电话 transport；Hopper 源码无法给出这部分延迟。

Node 官方明确提示 `fs.watch()` 在 NFS、SMB 及某些虚拟化文件系统可能不可靠；因此生产 bridge 要 polling/replay fallback，并将 vault 限定在本地磁盘。[Node.js `fs.watch` caveats](https://nodejs.org/api/fs.html#availability)

### 3.5 为什么暂不直接标准化为 SSE client

标准 SSE 可以用 `id:`/`Last-Event-ID` 支持断线续传；Hopper 当前用自定义 hello `seq` + `/api/events` 回补，而不是标准 SSE event id。其前端处理是正确的本地产品实现，但不构成跨版本 public protocol。[WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header)

**【建议】PoC 用文件 polling；生产 task bridge 要么把“cursor/backfill API”做成 Hopper 的版本化集成面，要么由 Hopper 提供稳定 Unix socket/HTTP service。不要让 VoiceLoop 永久复制 Console 私有协议。**

---

## 4. 问题 3：DecisionRequest 能否承接语音审批

### 4.1 结论：数据模型有核心绑定，缺运行时和语音证据

M3a `DecisionRequest` 已具备正确的安全骨架：

- `subject_ref + digest + revision`：批准绑定对象和版本，对象漂移时旧批准应失效（`Hopper/src/schemas/platform/decision.ts:30-38`）；
- `risk: S0..S3`、带 consequence 的 options、expiry 只允许 `reject|pause`，不会超时自动放行（`Hopper/src/schemas/platform/decision.ts:10-28`、`Hopper/src/schemas/platform/decision.ts:39-54`）；
- resolution 必须重复 digest/revision/option，区分 user 与 expiry default（`Hopper/src/schemas/platform/decision.ts:57-92`）；
- schema freeze 要求消费者执行四项 M2 复验：重算 digest、核对 revision、chosen option 在原 options 内、请求未过期/未 supersede（`Hopper/docs/SCHEMA-FREEZE-M3A.md:43-47`）。

但今天不能说“VoiceLoop 可以调用 Hopper DecisionRequest 审批服务”，因为：

1. M3a 文档明确将 projector/storage/execution 留给后续里程碑（`Hopper/docs/M3A-DOMAIN-MODEL-DESIGN-2026-07-21.md:16-22`、`Hopper/docs/M3A-DOMAIN-MODEL-DESIGN-2026-07-21.md:80-80`）。
2. 当前 strict resolution channel 仅允许 `console|telegram|cli|system`，没有 `voice`（`Hopper/src/schemas/platform/decision.ts:69-75`）。
3. 实际 strict request/resolution schema 没有 `nonce`、`evidence_ref`、`presentation_digest`、`authenticated_principal/session` 或 ASR/音频 receipt。设计文档的实体清单写过 nonce，但源码冻结 schema 未包含，存在 doc/code drift（`Hopper/docs/M3A-DOMAIN-MODEL-DESIGN-2026-07-21.md:54-62` 对比 `Hopper/src/schemas/platform/decision.ts:30-54`）。
4. `Command` 虽已有 approve/reject/interrupt/retry 等 verb 和 durable/lease/settlement 形状，文件头明确它是 M3b command store 的数据形态（`Hopper/src/schemas/platform/command.ts:5-23`、`Hopper/src/schemas/platform/command.ts:30-62`），当前没有通用 command runtime。

### 4.2 VoiceLoop L2/L3 与 Hopper S0-S3 的关系

VoiceLoop 要求 L2 可语音审批，L3 必须屏幕展示/复述和更强确认（`voice-coding-framework.Cursor2.md:365-382`）。Hopper S0-S3 则是副作用严重度：只读、本地可恢复、持久写入、外部发布（`Hopper/src/schemas/platform/decision.ts:10-12`）。

**【推断】两者不是同一维度，不能机械等号：**

- Voice L0-L3 是“授权交互强度/通道策略”；
- Hopper S0-S3 是“动作副作用严重度”；
- 应由 policy matrix 决定 `severity × action × environment × principal` 需要哪一级 Voice confirmation。

一个保守初版：S0 通常无需确认；S1 可按用户偏好语音确认；S2 至少 L2 且要求已认证设备会话和 digest-bound challenge；S3 强制 L3 屏幕/OS 或 passkey 确认，语音只负责说明与复述，不能单独授权。例外（删除凭证、公开发布、付款、生产数据）应按 action policy 上调，不能仅看 S3 标签。

NIST SP 800-63B 的当前安全基准明确不允许把 voice biometric comparison 用作认证，并要求 biometrics 与物理 authenticator 结合；它不是 VoiceLoop 必须遵守的唯一法规，但足以说明“识别出像用户的声音”不能替代设备侧加密认证。[NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html#sec5)

### 4.3 “所闻即所签”的可落地协议

**【建议】不要签 ASR 文本，也不要只签一段口头摘要；签 canonical payload，并把“播了什么”作为受绑定的 presentation receipt。**

1. VoiceLoop 冻结完整决策 payload：task goal、acceptance、constraints、repo/project、base、runner、预算、风险、允许副作用、到期策略和 package revision。
2. 用 RFC 8785 JSON Canonicalization Scheme 规范化 JSON，再算 SHA-256，得到 `payload_digest`。JCS 的目的就是让同一 JSON 得到可重复的 hash/signature 输入。[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html)
3. 创建 `DecisionRequest(subject_ref, digest, revision, risk, options, expires_at)`；同时创建一次性 `challenge_nonce`。
4. 播报内容必须由同一 frozen payload 机械生成，至少含动作、目标、关键后果、预算、不可逆性、选项，以及 digest 短后缀/随机 challenge。保存 `presentation_template_version`、完整播报文本 hash、audio artifact ref、设备 session/principal。
5. 用户回答后保存原始 audio ref、ASR transcript、置信度/歧义、所选 option、nonce、`payload_digest/revision`；低置信度或多意图一律不放行。
6. resolution 必须重复 digest/revision/chosen option；执行前做 M2 四复验，并原子消费 nonce。对象或 presentation 变化时旧 receipt 作废。
7. L3 在已认证屏幕显示完整 payload/diff/目标，用户用 OS credential/passkey/button 确认；语音可读回结果，但屏幕动作才是 authorization event。

最小“所闻即所签”收据建议形状：

```json
{
  "decision_id": "dec-...",
  "subject_ref": "task:vl-...",
  "payload_digest": "sha256:...",
  "revision": 3,
  "chosen_option": "approve",
  "challenge_nonce": "...",
  "presentation_digest": "sha256:...",
  "presentation_template_version": "voice-approval-v1",
  "audio_artifact_ref": "artifact:...",
  "transcript_artifact_ref": "artifact:...",
  "principal_ref": "user:...",
  "auth_context_ref": "device-session:...",
  "resolved_at": "..."
}
```

当前 schema 是 `.strict()`，不能悄悄附加上述字段。短期可让 VoiceLoop 保管 receipt，并只把 package digest/ref 写入 Hopper task；正式对接应为 Decision schema 增加 `voice` channel 和 `evidence_ref`/`auth_context_ref`，或定义独立 `DecisionPresentationReceipt`/`DecisionAuthorizationReceipt` artifact schema。

### 4.4 Hopper 已有可复用的安全先例，但不是现成审批接口

Hopper delivery attestation 已实现：签发 challenge nonce、一次性/TTL/replay 防护、校验 task/run/AC/policy/principal/nonce/signature，并把 artifact digest 纳入签名 envelope（`Hopper/src/delivery/attest.ts:24-50`、`Hopper/src/delivery/attest.ts:55-123`、`Hopper/src/delivery/nonce.ts:58-123`、`Hopper/src/delivery/verifier.ts:50-129`、`Hopper/src/schemas/delivery-receipts.ts:5-36`）。

**【建议】复用这个模式和 `NonceLedger`/artifact store 的设计经验，不要直接把 delivery attestation 当 DecisionRequest：**前者面向交付证据/AC，后者面向通用控制面动作，subject、expiry、options、身份和执行时复验语义不同。

### 4.5 今天能接的审批与不能接的审批

**今天能接：**

- VoiceLoop 在 dispatch 前完成自己的决策包拍板，把 immutable digest 写入 Task Card；Hopper 只执行已授权 task。
- run 结束后，VoiceLoop 可通知用户打开 Hopper review/diff。
- 用户在受认证屏幕/终端确认后，调用现有 `review approve`；它会绑定当前 run/evidence/tree，merge 时 fail-closed 复验（`Hopper/src/scheduler/mutation/handlers/review.ts:27-34`、`Hopper/src/review/merge.ts:83-97`）。

**今天不能安全直接：**

- 把用户在电话里一句“好”直接转换成 `hopper review approve`，尤其带 waiver 或 merge；当前 CLI 输入没有证明用户实际听到哪个 evidence/tree，也没有语音身份/nonce receipt。
- runner 中途产生 Hopper `DecisionRequest`，VoiceLoop 播报后 resolve，再由 Hopper command runtime 恢复；这些是 M3b + WS4 的工作。
- L3 外部发布只凭声纹/ASR 放行。现有 `review approve` 的内部 digest binding 很强，但它绑定的是批准时计算的 Hopper evidence/tree，不等于用户的语音呈现证据已被绑定。

---

## 5. 问题 4：stream / steer 适配器缺口与改动量

### 5.1 现状不是 AgentAdapter，而是 batch runner wrapper

VoiceLoop 目标接口要求 `start()`、异步 `events()`、`steer()`、`interrupt()`、`resume()`、`answerPermission()`，并归一化 text/tool/permission/terminal 事件（`voice-coding-framework.Cursor2.md:297-328`）。Hopper 当前 contract 与之不对称：

```text
VoiceLoop 期望：start → event stream ↔ steer / permission answer → terminal
Hopper 现状： buildCommand → spawn(close stdin) → wait process exit → parseResult → post-run
```

源码事实：

- `RunnerAdapter` 只有命令构建与终报解析（`Hopper/src/runners/types.ts:38-48`）。
- executor 明确在 spawn 后关闭 stdin，定期看 cancel/timeout，进程退出后才读取完整 stdout 并解析（`Hopper/src/runners/executor.ts:34-67`、`Hopper/src/runners/executor.ts:69-147`）。
- `runner-result` 是 attempt 的 terminal result，可保存 `sessionId`，但不是增量 event stream（`Hopper/src/schemas/runner-result.ts:30-64`）。
- capability manifest 为 Claude/Codex 声明 `resume_session: true`（`Hopper/src/runners/capability.ts:15-88`），但 retry 路径开启的是新的 `executeTask()`，只把 retry message 拼入文本 context（`Hopper/src/review/retry.ts:35-100`、`Hopper/src/review/retry.ts:113-156`）。本次源码检索没有找到把旧 `sessionId` 传回 adapter 的执行路径。故该 capability 目前不能作为 VoiceLoop 可调用 resume API。

### 5.2 今天的降级方案

**【建议】PoC 明确声明 `interaction_mode=batch`，不提供运行中 steer。**

用户中途修订时：

1. VoiceLoop 告知“当前 Hopper run 不能原地改指令，是否取消并以新 revision 重跑”；
2. 用户确认后调用当前 `cancel <task-id>`；handler 会写 cancel request，并与 scheduler/process owner 协调终止（`Hopper/src/scheduler/mutation/handlers/control.ts:34-104`）；
3. 等 `RunnerCancelled`/terminal state；
4. 冻结新版 decision package；
5. 视语义选择 drop new revision 或 `retry <task-id> --message <revision summary>`。

这叫“**cancel-and-retry with summarized context**”，不是 steer、不是 checkpoint resume、也不保证 provider 会延续隐含上下文。UI/语音必须如实表述。

### 5.3 哪些改 Hopper，哪些留在 VoiceLoop

| 能力 | 应由谁实现 | 原因 |
|---|---|---|
| Task Card renderer、dispatch mapping | VoiceLoop bridge | 属于前脑语义和外部关联 |
| callback classifier/outbox/TTS transport | VoiceLoop bridge | 属于通知偏好、会话与用户通道 |
| 稳定 event cursor/backfill API、明确 `RunFinalized` | Hopper | 只有 Hopper 知道 artifacts/projection 何时完成 |
| 子进程/SDK streaming owner | Hopper runner/executor | PID、lock、worktree、usage、secret、cancel 与 post-run 生命周期都在 Hopper |
| provider event → 平台 event 归一化 | Hopper adapter + platform runtime | 要与 run/attempt/command/event truth 对齐 |
| steer/interrupt/resume/permission command | Hopper M3b Command/ExecutorHandle | 必须 durable、幂等、lease、native-effect 对账 |
| Voice 意图 → Command/DecisionResolution | VoiceLoop bridge | 负责 ASR、用户身份、授权 receipt 与 UX |

**不要让 VoiceLoop 直接 attach Hopper 启动的 Claude/Codex child process。** 这样会出现两个 process owner、两个 cancel truth、绕过 usage/locks、丢失 worktree/run 关联，并使 crash recovery 无法判断原生动作是否生效。M3a `CommandSettlement.native_effect_ref` 和 `ExecutorHandle` 正是为解决该类控制幻觉而定形（`Hopper/src/schemas/platform/command.ts:51-85`）。

### 5.4 推荐的 Hopper 增量改造

以下是**建议接口草案**，不是当前源码：

```ts
interface StreamingRunnerAdapter extends RunnerAdapter {
  start(input: RunnerInput, controls: RunnerControls): Promise<RunnerSession>;
}

interface RunnerSession {
  handle: ExecutorHandle;
  events(): AsyncIterable<RunnerEvent>;
  command(command: Command): Promise<CommandSettlement>;
  terminal(): Promise<RunnerExecution>;
}
```

最小改动面：

1. **executor lifecycle：** stdin/SDK session 不再立即关闭；stdout/stderr 增量 drain，写 per-attempt raw log；terminal promise 与 event stream 解耦。
2. **normalized runner events：** 至少 `text_delta`、`tool_started/finished`、`permission_requested`、`checkpoint/session`、`usage_delta`、`terminal`；原始 provider payload 只作 artifact，不直接成为平台 truth。
3. **durable handle/session：** 持久化 provider session/thread id、PID/PGID、started/heartbeat、capability strength；恢复时先 reconcile native process/session。
4. **command store：** steer/interrupt/resume/permission answer 先写 durable Command，adapter ack 后写 CommandSettled；使用 expected attempt/turn/revision 做 CAS。
5. **decision gate：** permission request 转 DecisionRequest，resolve 前做 digest/revision/expiry/option 复验；S2/S3 command 不得默认 KILL/auto-approve。
6. **usage：** 增量 usage 写 M3c UsageEvent，未知/延迟账单保留 unknown exposure，不能按 0 当已知。
7. **终态顺序：** terminal runner event 后才启动 post-run；所有 artifacts/projection 落定后再发 `RunFinalized`/`AttemptFinished`。
8. **conformance tests：** 每个 adapter 验证 event ordering、backpressure、cancel race、duplicate command、session resume、permission timeout、process crash、restart reconcile 和 secret masking。

### 5.5 Provider 侧是否有现实路径

- **【已验证事实·联网】** Anthropic Agent SDK 官方把 streaming input mode 定义为 persistent interactive session，可做 interruption、permissions、session management 和 queued follow-up；single-message mode 不支持这些 session 行为。[Claude Agent SDK streaming vs single mode](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- **【已验证事实·联网】** OpenAI Codex TypeScript SDK 提供 thread start/resume 和 `runStreamed()` 结构化中间事件；官方仓库说明 SDK 通过 JSONL 与 `codex` 进程交换消息。[OpenAI Codex SDK](https://developers.openai.com/codex/sdk/) / [Codex TypeScript SDK](https://github.com/openai/codex/tree/main/sdk/typescript)

这些事实说明改造有技术路径，不说明 Hopper 已接入，也不说明两家对 mid-turn steer、permission、resume 有完全同构语义。Hopper 仍要做 capability negotiation；不支持的动作返回 `unsupported/degraded`，不能 UI 假成功。

### 5.6 改动量判断

| 交付层级 | Hopper 改动 | VoiceLoop/bridge 改动 | 推断工期 | 判定 |
|---|---:|---:|---:|---|
| 最小 task PoC | 0 | renderer + CLI + event poller + outbox | 3–4 工程日 | 现在做 |
| 补 `RunFinalized` + contract test | 小 | 小 | 0.5–1.5 日 | 建议尽快做 |
| 稳定 task bridge API/恢复/监控 | 小–中 | 中 | 1–2 周 | 可独立于 M3d 做 |
| 单一 runner 只读 streaming | 中 | 小 | 3–5 日/runner | 可试验 |
| durable steer/permission/resume | 大 | 中 | 2–4 周 | 应落 M3b/M3c，不做旁路 |
| 完整通用 workflow executor/Console transports | 大 | 大 | 服从 Hopper program | 等 M3d/WS4 |

工期不含未知 provider bug、跨平台 process semantics 和安全评审；“单一 runner 只读 streaming”也不包含 steer，只能用于更及时的进度播报。

---

## 6. 问题 5：成熟度 gap——今天能接什么，必须等什么

### 6.1 今天可直接复用（current task 粒度）

1. Markdown drop、id/hash/source 去重与 revision 保护。
2. project→repo/default branch/runner/verification 登记。
3. deterministic triage、Task Compiler、依赖/资源/风险/预算 preflight。
4. git worktree 创建、push isolation、base-relative diff（`Hopper/src/worktree/worktree.ts:42-90`、`Hopper/src/worktree/worktree.ts:182-213`）。
5. Claude/Codex/fake runner 的单发执行、timeout、cancel、终报。
6. verification、guardrails、risk reevaluation、acceptance、docs alignment、delivery evidence。
7. review、digest/tree-bound approval、merge/rebase/快照一致性闸门。
8. append-only event log、projection、run artifacts、Console SSE/polling。
9. 当前 run/project/runner/daemon 维度的预算和并发 gate。
10. daemon 的低风险 unattended 执行到 `review`；daemon 明确只取 low-risk，并且不会自动 merge（`Hopper/src/daemon/daemon.ts:50-59`、`Hopper/src/daemon/daemon.ts:69-145`）。

### 6.2 必须实现或等待

| 目标能力 | 依赖里程碑 | 当前缺口 | VoiceLoop 是否应旁路 |
|---|---|---|---|
| durable pause/steer/interrupt/retry/approve Command | M3b | store、lease、CAS、executor ack、native effect reconcile | **否** |
| DecisionRequest runtime/enforcement | M3b + WS4 | producer/projector/expiry/supersede/inbox/channel receipt | **否；PoC 只做 VoiceLoop 自有 pre-dispatch approval** |
| attempt/step UsageEvent、reservation、unknown exposure | M3c | 当前 ledger 是 run 后聚合，unknown cost 有 0 bucket 语义 | **否** |
| 通用 workflow/step executor | M3d | 当前只有 coding task pipeline，不是任意步骤 DAG | **否** |
| runner conformance/capability truth | M3e | manifest 与实际 resume/steer 能力未闭环 | **否** |
| NotificationIntent producer/dedup/transports | WS4 | schema 已定，runtime/voice transport 未实现 | **VoiceLoop 可先自有 outbox，但不要写成 Hopper transport** |
| 稳定外部 event/command API | 未明确独立里程碑 | Console 是内部 UI 面、文件是内部 truth | task bridge 可先协商小契约 |
| 跨机器/mobile 访问 | WS4/部署方案 | Console 仅 loopback、随机 token/port | PoC 本机；后续走 authenticated bridge/tunnel |

平台 program 的公开排期把 Phase 2 分为 M3a schema、M3b command/executor、M3c usage、M3d workflow、M3e conformance，之后才是 Phase 3/WS4 Console 与通知面（`OpenClaw-MultiAgent-Kit/docs/HOPPER-PLATFORM-IMPL-PLAN-2026-07-20-Cursor.md:104-127`）。总 program 自估 P50 10–12 周（且标为 aggressive）、P90 16–18 周（`OpenClaw-MultiAgent-Kit/docs/CONTROL-TOWER-DESIGN-2026-07-20-Cursor.md:28-28`）。

**【结论】VoiceLoop 不需要等 10–12 周才验证价值，但必须把 PoC 产品边界锁死在“一张 coding task、一次 batch run、一次 review-ready 回叫”。** 一旦 PoC 需要“agent 中途问用户”“语音改变正在执行的任务”“通用非代码 workflow”“Hopper 原生审批/通知”，就已经跨入未完成 program，不应在 glue 中偷偷再造。

### 6.3 当前只适合 coding delivery，不等于通用执行后端

Hopper package 自述是 coding-agent delivery gate（`Hopper/package.json:2-4`）；`new` 命令目前也只支持 `hopper/task` 模板（`Hopper/src/cli/register/task.ts:23-30`）。虽然 frontmatter doc types 还列出 idea/plan/research/decision 等（`Hopper/src/schemas/frontmatter.ts:7-18`），当前 worktree/runner/verification/merge 主链仍以 Git 代码交付为中心。

因此：

- “改代码、跑验证、给 diff/evidence、待 merge”是今天的强适配场景；
- “发邮件、操作 CRM、订票、执行多 SaaS workflow、长时间等待外部回执”不是当前 Hopper task runner 已证实的能力；
- VoiceLoop 如果未来是通用前脑，应把 `execution_backend` 做成可路由接口，Hopper 先承接 `coding_delivery` capability，而不是所有 Task Card 默认塞入 Hopper。

---

## 7. 问题 6：可落地最小 PoC

### 7.1 PoC 目标与非目标

**目标：** 用户语音确认一张 coding Task Card → VoiceLoop 冻结决策包 → drop 到本机 Hopper → Hopper 在已登记测试项目中跑到 `review` → bridge 消费完成候选事件并核对 artifacts/projection → VoiceLoop 发起一次语音回叫。

**非目标：** live text streaming、steer、runner permission answer、自动 review approve、自动 merge、跨机器 HA、通用 NotificationIntent、任意非代码 workflow。

### 7.2 前置条件

1. Node `>=22`；Hopper 已 `npm run build`。
2. 使用独立 PoC vault，不复用生产/个人主 vault。
3. 选择一个小型、测试命令确定、无真实凭证和外部发布权限的 Git repo。
4. runner 已登录且用最小权限；PoC project 的 network/secret/merge policy 收紧。
5. VoiceLoop 已有一个可接受 `callback(outbox_item)` 的回叫/TTS stub；没有真实电话时可用本机语音播放验证产品链路。

### 7.3 一次性初始化

```bash
export VOICELOOP_HOPPER_VAULT=/absolute/path/to/voiceloop-hopper-poc-vault

node /absolute/path/to/Hopper/bin/hopper.mjs \
  --vault "$VOICELOOP_HOPPER_VAULT" --json init

node /absolute/path/to/Hopper/bin/hopper.mjs \
  --vault "$VOICELOOP_HOPPER_VAULT" --json \
  link-project --project poc-app --repo /absolute/path/to/poc-app \
  --runner claude --no-inbox
```

`link-project` 实际把 project/repo/default runner 等配置落入 Hopper project config（`Hopper/src/cli/commands/link-project.ts:16-44`）。项目的 trusted verification 必须在 Hopper config 登记；Task Card 的 `verification_suggestions` 只是建议，compiler 将 project verification 与口语建议分开处理（`Hopper/src/compiler/compiler.ts:94-105`、`Hopper/src/compiler/compiler.ts:154-162`）。

### 7.4 胶水模块

建议在 VoiceLoop 仓库新增独立 package/service，先不改 Hopper：

| 模块 | 最小职责 |
|---|---|
| `task-card-renderer.ts` | 验证 Voice Task Card；冻结 canonical package/digest；渲染受控 Markdown |
| `hopper-cli-client.ts` | spawn CLI；stdin；超时；校验 JSON `DropResult/RunResult`；不解析彩色文本 |
| `dispatch-store.ts` | durable 保存 dispatch id、Voice/Hopper task id、package digest/revision、当前 run |
| `hopper-event-bridge.ts` | read-only poll/replay `events.jsonl`；cursor/gap；事件分类；artifact settle |
| `callback-outbox.ts` | callback intent、dedup、retry、ack、DND/升级策略 |
| `voice-callback-transport.ts` | 调 VoiceLoop realtime/TTS/电话；只消费 outbox，不碰 Hopper |

### 7.5 逐步执行

#### Step 1：语音产生并拍板决策包

- VoiceLoop 访谈得到 goal/constraints/acceptance/project/runner/budget/risk。
- 屏幕或口头复述，按 VoiceLoop 当前 L2/L3 policy 拍板。
- 将完整 package 用 JCS canonicalize，计算 SHA-256，保存 immutable artifact 和 authorization receipt。
- 生成 `dispatch_id`，写 dispatch store，状态 `prepared`。

**胶水：** `task-card-renderer.ts`、VoiceLoop 自有 approval receipt。
**Hopper 接口：** 无；这一步仍属于前脑。

#### Step 2：渲染并 drop

- 按 §2.2 模板生成 Markdown；repo/base 不进 task 权威字段。
- 调：

```bash
node /absolute/path/to/Hopper/bin/hopper.mjs \
  --vault "$VOICELOOP_HOPPER_VAULT" --json \
  drop --stdin --project poc-app
```

- 校验 `DropResult`；只有 `created` 或确认一致的 `duplicate_ignored` 继续。
- 原子记录 `voice_task_id ↔ hopper_task_id ↔ package_digest`，状态 `dropped`。

**Hopper 接口：** CLI `drop --stdin --project`；DropResult schema。
**胶水：** CLI client、mapping/idempotency。

#### Step 3：triage 到 ready

```bash
node /absolute/path/to/Hopper/bin/hopper.mjs \
  --vault "$VOICELOOP_HOPPER_VAULT" --json --no-llm scan
```

- 读取 JSON/投影，要求目标 task 为 `ready`。
- 若 `blocked/plan_needed/research/conflict`，写 callback outbox，播报缺的 acceptance/project/dependency，而不是强行 run。

**Hopper 接口：** `scan`/deterministic triage。
**胶水：** status→VoiceLoop reason mapper。

#### Step 4：启动 batch run

PoC 用 attended 单次命令，便于捕获 run id 与故障：

```bash
node /absolute/path/to/Hopper/bin/hopper.mjs \
  --vault "$VOICELOOP_HOPPER_VAULT" --json \
  run next
```

不建议第一版直接 daemon：daemon 还涉及 mutation queue、预算 preflight、低风险筛选和长期 process supervision；核心 PoC 不需要这些变量。Hopper e2e smoke 已覆盖 init/link/drop/scan/run/review/approve/merge 的完整 CLI 路径（`Hopper/test/e2e/cli-smoke.test.ts:112-193`）。

**Hopper 接口：** `run next`、现 scheduler/worktree/runner/post-run。
**胶水：** process timeout、run id/status 记录；不得把 CLI 进程存活当 run 成功。

#### Step 5：消费事件并确认 review-ready

- bridge 应在 drop 前启动，并先保存当前 file EOF（若走 Console 则保存 seq），避免漏掉快速 fake/small runner。
- 每 500ms–1s 只读 `events.jsonl`；以 event_id 去重，并用 file identity/offset/prefix checkpoint 检测截断或替换。raw event 没有 seq。
- 收到 `RunnerFinished` 只更新进度；若失败/timeout/cancel，立即生成 failure callback。
- 收到 `DocsAlignmentChecked` 后进入 `settling`：指数退避等待对应 run 的 summary、runner result、`worktree-changes.json`；然后读取/重放投影。
- 只有 `last_run_id` 一致、status=`review`、关键 artifacts 可校验时，写 `ready_for_review` outbox。超过例如 30 秒仍不一致，写 `integration_fault`，不播“完成”。

**Hopper 接口：** `events.jsonl` + run artifacts + projection/status read。
**胶水：** cursor/replay、settle barrier、classifier/outbox。

#### Step 6：一次语音回叫

outbox item 示例：

```json
{
  "dedup_key": "hopper:poc-task:run-123:ready_for_review:v1",
  "kind": "ready_for_review",
  "task_id": "poc-task",
  "run_id": "run-123",
  "trigger_event_id": "evt-...",
  "title": "修复月报导出中的时区偏移",
  "one_liner": "任务已执行并通过 Hopper 自动闸门，现在等待你的代码验收。",
  "detail_ref": "hopper-run:run-123"
}
```

VoiceLoop 回叫建议话术：

> “月报时区任务已经执行完，并通过 Hopper 的验证、风险、验收证据和文档对齐检查；现在处于待验收，还没有合并。要现在听摘要，还是在屏幕上看 diff？”

这句话把事实层级说清：`review` ≠ `done`，也不诱导用户用一句含糊“好”完成 L3 merge。

#### Step 7：可选人工验收（不属于最小成功条件）

- 打开 Hopper review/diff；用户在屏幕核对 evidence/tree。
- 如需 approve，只在已认证终端/Console执行；如需 merge，再次展示将合入的 branch/tree 和副作用。
- PoC 默认停在 review，不自动 approve/merge。

### 7.6 PoC 验收标准

1. 同一 `dispatch_id` 重放三次，只产生一个 Hopper 有效 task/run 或明确可解释的 duplicate/revision 结果。
2. bridge 在 run 中途重启，恢复后仍只回叫一次。
3. runner success 但 verification fail 时，回叫为“闸门阻断”，不是“完成”。
4. `DocsAlignmentChecked` 后 artifacts 延迟落盘时，不提前回叫；settle 成功后再播。
5. Console 出现 seq gap，或 events 文件发生截断/替换/corrupt line 模拟时，bridge 进入 backfill/replay/故障态，不静默越过。
6. 用户说“改一下目标”时，系统明确走 cancel/revision/retry，不声称 live steer。
7. 回叫能准确说出 task、run、当前 `review` 状态和未 merge 事实；日志中不泄露 secret/完整敏感口述。
8. demo repo 无任何自动 push/外部发布；PoC 失败可删除独立 vault/worktree，不影响用户主仓。

---

## 8. 风险清单

分级：P0 = 会造成错误授权/错误完成/不可恢复状态，PoC 前必须有控制；P1 = 会显著降低可靠性或阻碍生产化；P2 = 可在 PoC 后治理。`事实依据` 与 `风险判断` 分开写。

| ID | 级别 | 风险 | 事实依据 | 缓解/上线门禁 | Owner |
|---|---|---|---|---|---|
| R1 | P0 | 把 M3a schema 当已上线 runtime | M3a 自述 schema，M3b/M3c 才产 runtime；新事件当前无 projector（`Hopper/docs/M3A-DOMAIN-MODEL-DESIGN-2026-07-21.md:16-22`、`Hopper/docs/SCHEMA-FREEZE-M3A.md:36-54`） | capability handshake 必须报告 `schema_only/runtime`; PoC 不调用 Decision/Notification/Command | Hopper + bridge |
| R2 | P0 | `RunnerFinished` 误触发“完成”回叫 | Runner event 在 post-run 前（`Hopper/src/scheduler/execute.ts:262-310`） | event→reconcile→outbox；只有投影/artifacts barrier 后 `ready_for_review` | bridge |
| R3 | P0 | `DocsAlignmentChecked` 与真正落盘终点之间竞态 | event 后仍写 final snapshot、tree、delivery evidence、summary（`Hopper/src/postrun/pipeline.ts:236-328`） | PoC settle barrier；生产增加 `RunFinalized` + ordering test | Hopper + bridge |
| R4 | P0 | 一句“好”批准了错误/旧 payload | 当前 Decision schema有 digest/revision，但无 voice receipt/nonce，runtime 未实现（`Hopper/src/schemas/platform/decision.ts:30-75`） | canonical digest、revision、nonce、presentation receipt；L3 屏幕/设备认证；旧 revision fail closed | VoiceLoop + Hopper M3b |
| R5 | P0 | 把声音/声纹当用户身份 | 当前 Hopper resolution 只有 channel，没有 auth context（`Hopper/src/schemas/platform/decision.ts:69-75`）；NIST 不接受 voice biometric comparison | 设备 session + passkey/OS auth；voice 仅意图输入/说明 | VoiceLoop security |
| R6 | P0 | bridge 直接写 events/frontmatter 造成双写和投影分叉 | EventLog 是单写者追加/投影真相（`Hopper/src/core/events/log.ts:54-82`） | 所有 mutation 走 Hopper CLI/API；bridge 对 Hopper FS 只读 | bridge |
| R7 | P0 | Voice repo/base 与 Hopper project config 不一致，任务跑错仓/分支 | compiler 从 project config 取 repo/default（`Hopper/src/compiler/compiler.ts:94-105`） | dispatch 前 resolve project snapshot；UI 回读 repo/base；package digest 纳入 resolved project config ref | bridge + Hopper |
| R8 | P0 | live steer 承诺与 batch runner 事实不符，用户修订未生效 | adapter 无 steer/events，executor closes stdin（`Hopper/src/runners/types.ts:38-48`、`Hopper/src/runners/executor.ts:34-67`） | capability=`batch`; 语音明确 cancel-and-retry；禁止显示“已转告正在执行的 agent” | VoiceLoop product |
| R9 | P0 | 自动 review approve/merge 绕过真人验收 | automation approve 只允许无缺口；merge 另有 binding/gates（`Hopper/src/scheduler/mutation/handlers/review.ts:67-80`、`Hopper/src/review/merge.ts:41-97`） | PoC 停 review；L3 screen gate；waiver 永不由 voice automation 自动提交 | VoiceLoop + Hopper |
| R10 | P0 | 同一 dispatch/revision 重放导致两次执行或旧回叫 | drop 有四种 dedup/revision outcome，不等于业务 dispatch 幂等（`Hopper/src/core/drop/drop.ts:46-100`、`Hopper/src/schemas/drop-result.ts:5-23`） | 外层 dispatch CAS；callback dedup；task/run/revision/digest 四重关联 | bridge |
| R11 | P1 | Console seq gap，或 raw 文件截断、替换、半行/坏行导致漏回叫或错投影 | raw event 无 seq；Console 按位置派生 seq；EventLog 有 truncation/corrupt-line 处理（`Hopper/src/schemas/event.ts:17-56`、`Hopper/src/console/handlers/read.ts:159-166`、`Hopper/src/core/events/log.ts:105-197`） | 完整行校验、file identity/offset/checkpoint、Console seq backfill、generation/full replay；报警而非跳过 | bridge |
| R12 | P1 | Console 被当稳定公网 API，重启后 port/token 变化 | random token/port、bind 127.0.0.1（`Hopper/src/console/server.ts:68-141`） | PoC 文件消费；生产定义版本化 bridge API；不暴露 Console 到公网 | Hopper |
| R13 | P1 | callback transport 没有 durable ack，崩溃后丢/重复拨号 | NotificationIntent 只有 schema，WS4 transport 未实现（`Hopper/src/schemas/platform/workflow.ts:93-106`） | VoiceLoop 自有 transactional outbox、dedup、retry、DND、fallback text | VoiceLoop |
| R14 | P1 | watcher 在 NAS/同步盘丢事件 | Node 官方说明 `fs.watch` 在 NFS/SMB/虚拟 FS 不可靠 | vault 本地盘；polling/replay fallback；监控 cursor lag | bridge/ops |
| R15 | P1 | daemon 不取任务却被解释为“后台卡死” | daemon 仅 low risk 且到 review（`Hopper/src/daemon/daemon.ts:50-59`） | PoC attended；生产把 preflight reason 回传 VoiceLoop；明确 queue/blocked 状态 | Hopper + bridge |
| R16 | P1 | 预算显示为 0，实际 provider cost 未知 | current ledger 的未知 cost 在 buckets 中按 0；runner parser可无 cost（`Hopper/src/usage/ledger.ts:104-121`、`Hopper/src/scheduler/execute.ts:252-259`） | 展示 `unknown` 而非 `$0`; 预留 exposure；等 M3c UsageEvent | Hopper M3c |
| R17 | P1 | manifest 声称 resume，实际 retry 丢 session/context | capability 声明与 retry 新 execute 路径不闭环（`Hopper/src/runners/capability.ts:15-88`、`Hopper/src/review/retry.ts:35-100`） | conformance test 后才 advertise；未通过一律 `none/degraded` | Hopper M3e |
| R18 | P1 | secret/隐私被播报或进入 callback/outbox | Hopper 只明确在写 event summary 前 mask runner summary（`Hopper/src/scheduler/execute.ts:267-277`）；Task Card/artifacts仍可能含敏感数据 | 分级 redact；TTS allowlist；不播 diff/secret/path；audio/transcript retention policy | VoiceLoop security |
| R19 | P1 | runner 中途需要 permission/澄清却只能挂起或失败 | 当前 runner contract 无 permission event/answer（`Hopper/src/runners/types.ts:38-48`） | PoC 选择无需交互的 task；timeout→blocked callback；M3b Decision integration 后再开放 | Product + Hopper |
| R20 | P1 | task body 中的资料/prompt injection 变成 runner 指令 | compiler 会把 task body/acceptance送入 prompt（`Hopper/src/compiler/compiler.ts:118-151`）；VoiceLoop 又会沉淀外部资料 | VoiceLoop 区分 instruction 与 untrusted material refs；冻结/显示来源；Hopper guardrails 不替代 intake sanitization | VoiceLoop |
| R21 | P1 | generic VoiceLoop task 被误路由到 coding pipeline | Hopper 自述 coding delivery，`new` 仅支持 task template（`Hopper/package.json:2-4`、`Hopper/src/cli/register/task.ts:23-30`） | capability router；只有 `coding_delivery` 进入 Hopper current task path | VoiceLoop |
| R22 | P1 | worktree/bootstrap/依赖安装耗时或需网络，回叫超时 | worktree 由 Hopper按 project/base 创建（`Hopper/src/worktree/worktree.ts:42-90`） | 预热 repo/deps；runner wall-clock 分阶段；进度通知与完成通知分离 | Hopper/ops |
| R23 | P1 | callback 对应旧 run，用户正在讨论新 revision | events 带 task/run/attempt，drop 可产 new revision（`Hopper/src/schemas/event.ts:17-56`、`Hopper/src/core/drop/drop.ts:150-276`） | 回叫前 CAS 当前 mapping；旧 run 转历史通知，不打断当前 session | bridge |
| R24 | P1 | merge 前内容/base 漂移，语音批准对象已变化 | merge 会复验 evidence/tree 并重算 actual tree（`Hopper/src/review/merge.ts:83-95`、`Hopper/src/review/merge.ts:241-273`） | 保留现 fail-closed；Voice receipt 引用同一 tree；漂移必须重展示重批 | Hopper + VoiceLoop |
| R25 | P2 | 高频事件造成语音骚扰/通知风暴 | 当前 event log 是细粒度流水，不等于通知策略 | 仅 terminal/block/decision immediate；进度进 digest；DND/quiet hours/escalation | VoiceLoop |
| R26 | P2 | provider SDK/CLI 协议升级破坏 adapter | 当前 adapter 直接依赖 Claude/Codex CLI flags（`Hopper/src/runners/claude-adapter.ts:47-89`、`Hopper/src/runners/codex-adapter.ts:46-91`） | pin/version probe；golden fixtures；per-adapter conformance；可回退 batch | Hopper |
| R27 | P2 | M3a schema 在 bridge 中被复制，后续冻结变更产生双轨 | schema freeze 列出 canonical files 与 consumer obligations（`Hopper/docs/SCHEMA-FREEZE-M3A.md:10-18`、`Hopper/docs/SCHEMA-FREEZE-M3A.md:36-54`） | 从 Hopper 导出 JSON Schema/版本；contract tests；不手抄 enum | Hopper + bridge |
| R28 | P2 | PoC 用真实仓/凭证，失败副作用不可收拾 | Hopper runner 是不可信边界，README 明示需独立验证（`Hopper/README.md:38-50`） | 独立 vault、sandbox repo、只读/最小凭证、禁 push/merge、可清理 worktree | PoC owner |

### 8.1 上线前不可妥协的 P0 门禁

1. 明确 capability：`batch`，UI/语音不出现 stream/steer/resume 已生效的文案。
2. callback 由 state reconciliation 产生，不由单个 event 直接产生。
3. dispatch 与 callback 都有 durable idempotency/outbox。
4. bridge 对 Hopper vault 只读；所有 mutation 走受支持入口。
5. project/repo/base 在执行前回读并绑定 package digest/ref。
6. PoC 不自动 approve/waive/merge；L3 不以 voice biometric/ASR 单独授权。
7. `review` 与 `done` 在 schema、文案、测试、metrics 中完全分离。

---

## 9. 推荐的最小集成合同 v0

这不是要求 Hopper 立即新增 schema，而是给 VoiceLoop bridge 一个不越界的内部合同。

### 9.1 DispatchRequest（VoiceLoop-owned）

```json
{
  "dispatch_id": "dsp_...",
  "voice_task_id": "vl_task_...",
  "package_ref": "artifact:dp_...",
  "package_digest": "sha256:...",
  "package_revision": 1,
  "hopper_vault_ref": "local:poc",
  "hopper_project": "poc-app",
  "interaction_mode": "batch",
  "callback_recipient": "user:...",
  "created_at": "..."
}
```

### 9.2 DispatchReceipt（bridge-owned）

```json
{
  "dispatch_id": "dsp_...",
  "hopper_task_id": "vl-poc-...",
  "drop_outcome": "created",
  "drop_revision": 1,
  "hopper_event_cursor_at_submit": {"kind": "file", "byte_offset": 12345},
  "accepted_at": "..."
}
```

### 9.3 CallbackIntent（VoiceLoop-owned outbox）

```json
{
  "intent_id": "cb_...",
  "dedup_key": "hopper:<task>:<run>:ready_for_review:v1",
  "dispatch_id": "dsp_...",
  "hopper_task_id": "...",
  "hopper_run_id": "...",
  "kind": "ready_for_review",
  "state_observed": "review",
  "trigger_event_id": "...",
  "evidence_refs": ["hopper-run:<run>/summary", "hopper-run:<run>/runner-result"],
  "speech_template_version": "hopper-callback-v1",
  "issued_at": "..."
}
```

关键所有权：Hopper task/run/event/status/evidence 仍以 Hopper 为真；VoiceLoop conversation/package/authorization/callback receipt 仍以 VoiceLoop 为真；mapping/outbox 只是 integration truth，不反向改写任一领域的历史。

---

## 10. 分阶段建议与最终 Go/No-Go

### Phase A：现在，3–4 工程日

- 做 §7 的单 task PoC；Hopper 零源码改动。
- 文件 poll + replay；VoiceLoop 自有 mapping/outbox。
- 只回叫 failed/blocked/review-ready；PoC 停在 review。
- 以 fake runner 先跑幂等/竞态，再用一个真实小任务跑一次。

**退出标准：** §7.6 八项全过，且录到一份 event/artifact/callback timeline。

### Phase B：PoC 后，1–2 周

- 与 Hopper 约定 versioned integration contract；优先新增 `RunFinalized` 及 ordering tests。
- bridge supervisor、metrics、cursor lag、dead-letter、DND、redaction、crash replay。
- project config snapshot/capability handshake；正式区分 review-ready/done。
- 加 integration test matrix：duplicate、revision、verification fail、cancel、bridge restart、events truncation、Console restart。

### Phase C：跟随 M3b/M3c/WS4

- Voice approval receipt 与 DecisionRequest/Command 串联；M2 四复验、nonce、identity/evidence ref。
- streaming adapter、ExecutorHandle、CommandSettlement、usage reservation/unknown exposure。
- NotificationIntent producer + voice transport；Console Decision Inbox 做 L3 屏幕面。
- 最后才打开 live steer/permission/跨机器/mobile。

### 最终判定

- **Go：** 今天验证“语音拍板 coding task → Hopper batch 执行 → 自动闸门 → review-ready 语音回叫”的用户价值。
- **Conditional Go：** 生产级 task bridge，条件是 P0 门禁、`RunFinalized`/settle contract、durable outbox、版本化 API 和安全审批边界完成。
- **No-Go today：** 把 Hopper 宣称为可实时 steer 的通用执行后端；把 M3a DecisionRequest/NotificationIntent 当现成服务；让一句语音“批准”直接触发 waiver/merge/外部发布。

---

## 11. 证据范围与限制

本评估实际读取了用户指定的 Hopper README、overview、M3a design、`src/schemas/`、`src/runners/`、`src/core/events/`、`src/usage/`、`src/worktree/`、`src/console/`、`src/daemon/` 的相关核心实现，并追踪到 drop、mutation queue、triage/compiler、scheduler execute、post-run、review/merge、delivery attestation 与 e2e smoke。VoiceLoop 侧实际核对：

- `local-projects-borrowing-assessment.md:36-68`：Hopper 映射、单发 runner、审批/回叫缺口与最小验证；
- `business-flows.md:158-199`、`business-flows.md:236-275`：回叫/审批实体与 §11 职责切分；
- `voice-coding-framework.Cursor2.md:240-287`、`voice-coding-framework.Cursor2.md:297-402`、`voice-coding-framework.Cursor2.md:528-600`、`voice-coding-framework.Cursor2.md:664-689`：Brain/Task Card/AgentAdapter/回叫/审批/预算/记忆就绪定义。

限制：

1. 本次只跑了与 schema/drop/Console/CLI smoke 相关的 4 文件 58 tests，没有重跑全量测试或真实 provider smoke，因此不把“全仓测试全绿”写成本会话结论。
2. 未执行真实语音电话/TTS 回叫，也未对某个真实 VoiceLoop service API 做集成，因为当前请求是可行性评估与方案，不是实施。
3. 所有工期为基于代码面的架构估算，需由实际 owner 按团队熟悉度和 provider 选型重估。
4. 外部实践只证明可选技术路径/安全基准，不证明 Hopper 已实现相关能力。
