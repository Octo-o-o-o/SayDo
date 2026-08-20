# SayDo W5.4-a 实施批（Claude Code CLI Tier1 后端 · spike 固化 + 纯函数层）· 实施 Prompt（第十轮交接；**v2.1，2026-08-20：按方案 v3.1 更新（`--permission-mode default`、圈内写显式 allow）；owner 已授权开批**）

> 背景：方案 `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md`（**v3**：v2 经两路 subagent 评审回修后，再经对抗评审 `research/codex-findings/77-w54-plan-adversarial-review.md`（Grok 回落执行，A 10/B 12/C 6）回修；v3 §9 有逐条处置表。**本稿 v2 与方案 v3 同步；方案与本稿冲突以方案 v3 为准**）。W5.4 拆三批（方案 §6/D10）：**本批 = W5.4-a**（阶段 A spike 固化 + 阶段 B 纯函数层 + cursor seam 抽取，不改执行器主流程/gateServer 接线/配置 schema）；W5.4-b（接线）与 W5.4-c（live 冒烟 + 收口）另出 prompt，且 W5.4-b 前置 = 方案 §5 左栏 canonical 回写。
> 性质：spike + 纯函数 + cursor 后端 seam 抽取 + cmdEffect 只升不降的收紧。**不再使用"零行为变化 / 一字不改"措辞**（方案 v3 A-10）；cursor seam 的验收 = 三句可判定锚（§2）。不涉 canonical（本批不改 09/04/07；合同变更留 W5.4-b 前置）。
> 开批前置（SayDo 纪律）：HANDOFF「当前批次指针」为空 → 开批写 `w54a-claude-cli`，收口清除；两提交法（feat/fix → chore(evidence)）；evidence `e2e/evidence/w54a-claude-cli.md`；零 emoji；不部署常驻（8 月纪律）；施工用独立 clone（主工作树可能有并发会话）。
> 调度分工：实施 = Grok 4.6（headless，`--always-approve --sandbox workspace`）；**spike 的 `claude -p` 真跑由调度方在沙箱外执行**（Grok 沙箱写不了 `~/.claude`，见 §4 检查点 2）；评估 = 零上下文会话（Codex 或 Claude 子代理）；实施/评估会话隔离。

---

你接手 **SayDo W5.4-a 批**。代码仓 = 调度方给你的独立 clone（分支 `batch/w54a-claude-cli`）。完成判定 = §3 验收锚全绿 + evidence 落盘 + HANDOFF 指针回填 + §5 对账表。

## 0. 坐标核验（先做，漂移即停并汇报；期望值 2026-08-19 22:xx 实测）

| 命令 | 期望 |
|---|---|
| `git log --oneline -1` | `1ee5622`（cmdeffect O-1 落地）或其后 docs 提交；`git status --short` 干净（`.tmp/` 被 gitignore） |
| `rg -n "当前批次指针" HANDOFF.md` | 指针为空（非空 ⇒ 有批在途，停） |
| `just ci` | 双矩阵绿，退出码显式（`just ci; echo "exit=$?"`，禁管道取尾）；基线 contracts 103 / cli 19 / console 253 / **daemon 1500 passed \| 4 skipped** / python 33（沙箱内 python 段若因 `~/.cache/uv` 只读而红，如实记录，调度方沙箱外复跑） |
| `rg -n "export function realAgentSpawner" packages/daemon/src/tier1/executor.ts` | `:142` |
| `rg -n "child.stderr.on" packages/daemon/src/tier1/executor.ts` | `:224`（吞 stderr 现状） |
| `rg -n "private consumeEventLine\|private isShellToolCall\|async handleGateRequest\|private readNativeResumeKey" packages/daemon/src/tier1/executor.ts` | `:1122` / `:1178` / `:442` / `:2226` |
| `rg -n "gateRequestSchema = z.object" packages/daemon/src/tier1/gateServer.ts` | `:11` |
| `rg -n "export function tier1StartupVerdict" packages/daemon/src/tier1/validateConfig.ts` | `:94` |
| `rg -n "GATE_CURL_TIMEOUT_SEC" packages/daemon/src/tier1/gateScript.ts` | `:12`（=110） |
| `rg -n "SENSITIVE_PATH_RE" packages/daemon/src/tier1/cmdEffect.ts` | 定义处 `:94` 附近，未导出 |
| `grep -cE '^\s*it\(' packages/daemon/test/tier1-gate-socket.test.ts packages/daemon/test/tier1-config-validate.test.ts packages/daemon/test/tier1-executor.test.ts` | 7 / 13 / 37 |
| `pnpm --filter @saydo/daemon exec vitest run test/tier1-cmd-effect.test.ts` | 223 passed |
| `ls -la $(which claude); readlink -f $(which claude); $(readlink -f $(which claude)) --version` | `/opt/homebrew/bin/claude -> ../lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`；`2.1.220 (Claude Code)`（不同则 spike 全部按新版本记录，fixture 目录名随版本） |
| `shasum -a 256 $(readlink -f $(which claude)) \| cut -c1-12` | `8addc857f3fe`（不同 = 二进制变了，停并汇报） |
| `claude auth status` | `loggedIn:true, authMethod:"claude.ai"`（调度方核验；Grok 沙箱可跳过） |
| `ls packages/daemon/src/providers/byoa/parsers.ts packages/daemon/src/providers/byoa/processFailure.ts packages/daemon/src/cost/ledger.ts packages/daemon/src/tier1/adapter.ts` | 存在 |

## 1. 必读（按序）

1. 本仓 `AGENTS.md`、`HANDOFF.md` §0 硬教训 / §4 铁律 / §2 #4 #6 #11。
2. 方案 `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` **全文**（重点 §1.2 实测表、§2 决策表、§3.1–3.5、§6 W5.4-a 段、§7、附录 A/B）。
3. `docs/plan/IMPLEMENTATION-PLAN-2.md` 5.4 行 + §7 排产驾驶规程；`docs/plan/IMPLEMENTATION-PLAN.md` 0.0(b) 行。
4. 合同节（本批只读不改）：`docs/09-data-contracts.md` §11 `[tier1]` 承载段（:1139）、规则 2/3（:1160-1168）、§12-9（:1222/:1235）；`docs/04-key-mechanisms.md` §5.1/§5.3/§5.4（:161-184）/§6（:186-196）；`docs/03-architecture.md` §5（:102-120）；`docs/07-tech-stack-decisions.md` D8（:118）。
5. 代码：`packages/daemon/src/tier1/executor.ts`（`:77-105` AgentSpawner 接口、`:142-241` realAgentSpawner、`:1122-1184` consumeEventLine 与两正则、`:442-524` handleGateRequest、`:1221-1305` settleAttempt）；`tier1/gate.ts`、`gateScript.ts`、`gateServer.ts`、`adapter.ts`、`approvalFlow.ts:41-80`、`cmdEffect.ts`（词表与 `pathClass`，`:94` 敏感正则）；`providers/byoa/parsers.ts:162-246`（parseClaudeLine）、`processFailure.ts:60-91`、`billing.ts`（isCliSubscriptionRateLimit）、`cost/ledger.ts:25-110`、`storage/ddl.ts:165-175`（cost_entries CHECK）；测试 `tier1-executor.test.ts`、`tier1-gate-socket.test.ts`、`tier1-cmd-effect.test.ts`、`tier1-security.test.ts`（它引用 `adapter.ts` 的死代码，本批不动）。
6. `e2e/poc/tier1-live-executor/RESULT.md`（校准事实 1–3）、`e2e/evidence/tier1-conformance.md`、`e2e/evidence/cmdeffect-hardening.md`（词表近况与"只收紧不放宽"的降档扫描方法）。

## 2. 红线（违反即停）

恒律全套（零 emoji / 状态词纪律 / 契约只 import `@saydo/contracts` / 两提交法 / 每步独立核实 SHA / 门禁退出码显式核查 / 敏感样本运行时拼接）+ 本批专属：
- **范围锁**：W5.4-a 不改执行器主流程、不改 `gateServer.ts` 接线、不改 `config/types.ts`/`validateConfig.ts`/`index.ts`、**不改 `checkCanaries` 的 cursor 分支**。cursor seam 抽取的验收 = 三句可判定锚：① cursor 的 argv、事件解析、`kill_on_result`、canary 左值 `shellStarted` 不变（快照断言）；② 既有 `tier1-*.test.ts` 的**期望值**零改动——允许且仅允许为新增的可选入参 / 可选方法（`stderrTail?()`、`settingsJson?`/`sessionId?`/`maxTurns?`）补一行类型适配或 fake 缺省实现，并在 evidence 逐行登记；③ `just ci` 绿。`AgentSpawner` 接口只**增**可选项。
- **门语义（方案 v3.1 §3.3）**：终版 argv 用 **`--permission-mode default`**（不用 acceptEdits，阶段 A B-10' 实测红）；`fileToolToEffect` 用"最长现存祖先 realpath + 后缀拼接"；祖先不存在 / 判不出 / 圈外 ⇒ **S3 deny**（永不 S2、永不 allow）；**圈内非敏感写 ⇒ 脚本显式 `allow`**（default 模式下无裁决 = Claude 问 = deny）；圈内敏感基名 ⇒ S2 上浮后 allow/deny；圈内 Read ⇒ `no_decision`（空输出 exit 0）；圈外 Read ⇒ deny；脚本失败路径 **deny JSON + `exit 2`**，jq 缺失用 printf 静态 deny，`curl --max-time 100` < hook timeout 120。
- **解析**：**禁止调用 `parseClaudeLine()`**（它吞 init / rate_limit / 并行 tool_use）；新写 `parseClaudeTier1Line`，单测 grep 断言 backends/claude.ts 不引用 `parseClaudeLine`。
- **记账**：B3 只产纯对象（`buildTier1SubscriptionCostEntry`），**不 INSERT**（`kind='tier1.run'` 词表随 P-5 回写后在 W5.4-b 落库）。
- **不 import `@anthropic-ai/*`**；不在 argv 里出现 `bypassPermissions`/`dontAsk`/`--dangerously-skip-permissions`/`--add-dir`/`--no-session-persistence`/`--bare`/`--fallback-model`（快照断言）。
- **cmdEffect 只收紧不放宽**：相对本批开批 HEAD 做降档扫描（方法同 `e2e/evidence/cmdeffect-hardening.md` §9/§10：两版同时加载 + 同一 `computeRisk`），降档 0；既有 223 条用例零改动。
- **spike 不在 Grok 沙箱内跑 `claude`**（写不了 `~/.claude`）：你只写 `run.sh` 与期望，调度方执行后把原始 jsonl 放回 `.tmp/spike-out/`，你再写 RESULT.md 与 fixture（§4 检查点 2）。spike 用 e2e 临时目录，**不得**指向 `~/WorkSpace/OctoDesk`/`OctoBlog`/`SayDo` 主仓。
- 不碰 Hopper 路径、不部署常驻、不改 BYOA 四槽、不改 canonical、不 push。

## 3. 任务清单（竖切；每项验收锚可判定）

### 3.1 阶段 A · spike 固化

1. **`e2e/spikes/claude-cli-tier1/run.sh`**：bash，参数 `--out <dir>`；每条 spike = 函数（命令 + 期望 grep + 退出码 + 判定写入 `$out/<id>.verdict`）；全部按方案 §3.2 **终版 argv**（v3.1：`--permission-mode default` + 五工具 + `--disallowedTools` + `--setting-sources ""` + `--strict-mcp-config` + `--settings` 内联 `*` matcher、timeout 120 + `--max-turns`），env 用 `env -i PATH HOME USER LANG TERM TMPDIR` + `DISABLE_AUTOUPDATER=1` + `SHELL=/bin/sh`，cwd = `$out/cwd-<id>` 空目录，stdin `< /dev/null`，`--model sonnet`（省额度）。hook 脚本随 run.sh 生成到 `$out/hooks/`（deny/ask/allow/log/slow/timeout/gate-sim——gate-sim 模拟 daemon 三态：按 `tool_name` 与路径圈内/圈外返回 allow/deny/空）。
   - 清单与分级（方案 v3 §6 W5.4-a 阶段 A + 附录 B）：**阻塞红** A-04（matcher 形态：终版 argv 下分别测 `*`、`.*`、显式并集，判定 = hook-input 日志里 Bash 与 Write 各 ≥1 条且 `tool_name` 正确；选定形态写进 EXPECTED 供 B1-b 取用）、S1–S4 终版重跑、S-T（`system/init.tools` 恰为五件且不含 `Task`）、S14、S-F（脚本失败路径：jq 缺失 / curl 不通 / 输出 deny + `exit 2` ⇒ Claude 阻断且 `permission_denials` 含之）、B-2、B-7、B-10 + B-10'（`acceptEdits` + Write 圈内 `.env` + hook 超时 ⇒ 文件不得落盘）、B-14 四项矩阵（`disableAllHooks:true` / `permissions.allow` 放行 Bash / `additionalDirectories:["/tmp"]` 再 Write `/tmp/x` / 覆盖 `hooks` matcher——四项在 `--setting-sources ""` 下都不得生效）、B-15；**设计调整级（红不停批）** B-9、B-11、B-12、B-13、B-3（`Task` 只记录）；**信息级** B-6、B-16。每条在 run.sh 顶部注释写清"命令 / 期望 / 红的后果"。
   - B-9 具体（设计调整级）：用 `--session-id` 跑一条会写 transcript 的对话，监听 stdout 见到 `"type":"result"` 的瞬间对进程组 `kill -9`，再同 cwd `--resume`；期望能复述上下文（红 ⇒ `finishPolicy` 定为 `wait_exit_then_kill`（等 ≤5s 自然退出再 SIGTERM→5s→SIGKILL），写进 RESULT 与 B1，**继续不停**）。
   - B-10' 具体（阻塞红）：`acceptEdits --tools "Bash,Read,Write,Edit,NotebookEdit"` + 终版 hooks 但脚本对 Write 故意 `sleep 40`（hook `timeout:10`），让模型 Write 圈内 `./.env`（内容 `SPIKE=1`）；期望超时后文件**不存在**。若存在 ⇒ 红：RESULT 写明，方案 §3.3 敏感基名本地 watchdog 条款启用。
   - S-F 具体（阻塞红）：三个变体各一跑：① hook 脚本里 `PATH=/nonexistent` 让 jq 不可用（脚本须仍输出静态 deny JSON 并 `exit 2`）；② curl 指向不存在的 socket（deny + exit 2）；③ 直接输出 deny + `exit 2`。期望三者 Bash 均未执行、`tool_result.is_error=true`、`permission_denials` 含之。
   - S-T 具体（阻塞红）：终版 argv 跑 `reply OK`，断言 `system/init.tools` 集合 == `{Bash,Read,Write,Edit,NotebookEdit}`。
   - A-04 具体（阻塞红）：同一 prompt（让模型先 Bash `echo a` 再 Write `./a.txt`）分别用 matcher `*`、`.*`、显式并集跑三次；每次检查 hook-input 日志 Bash/Write 各 ≥1 条；任一形态满足即选定（优先级 `*` > 显式并集 > `.*`），三者皆不满足 ⇒ 红停批。
   - B-14 具体（四项矩阵，全阻塞红，每项单独 cwd 与 settings.json）：① `{"disableAllHooks":true}` ⇒ 命令行注入的 deny hook 仍触发（Bash 被 deny）；② `{"permissions":{"allow":["Bash(*)"]}}` ⇒ deny hook 仍 deny；③ `{"permissions":{"additionalDirectories":["/tmp"]}}` + 让模型 Write `/tmp/b14-spike.txt`（hook 对 Write 不裁决）⇒ 文件不得落盘（Claude 仍视 /tmp 为圈外）；④ `{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"<写 leak.log 的脚本>"}]}]}}` ⇒ `leak.log` 不得出现。任一失败 ⇒ 红停批。
   - B-15 具体：`ANTHROPIC_API_KEY=sk-invalid-spike` 注入（仅此一条，证明 `-p` 下 key 优先且 `apiKeySource` 会变）：期望 `system/init.apiKeySource != "none"` 且请求失败/或首个事件即 init；记录 init 之前有没有 `assistant`/`api_retry` 事件。
   - B-12 具体：`--tools "Bash"` + allow hook，命令 `printenv | sort`，对照白名单 + `DISABLE_AUTOUPDATER`/`SHELL`，多出的变量名逐个列出（值不记录）。
   - B-11 具体：两条 Bash：`cd /tmp && pwd`（allow）与随后 `pwd`（allow）——第二条输出若为 `/tmp` ⇒ cwd 持久。
   - B-13 具体：跑一条让模型"记住偏好"的对话并观察 hook 日志里是否出现 `~/.claude/projects/…/memory/` 的 Write；或 `ls` 该目录前后对比。
2. **`RESULT.md`**：逐条 `[ok]/[warn]/[fail]` + 原始输出摘录 + 每条 jsonl 的 sha256（jsonl 留 `.tmp/spike-out/`，不入 Git）+ 三档红的总表 + 对方案条款的影响（哪条 D/§3 要改）。
3. **golden fixture**：`packages/daemon/test/fixtures/claude-cli/<version>/{init,tool_use_multi,tool_result,result_success,result_max_turns,rate_limit,resume_fail}.jsonl`（从原始流裁剪，删除 transcript_path 等含本机路径字段或替换为占位；**不得**含任何凭据形态字面量）。
   **验收锚**：run.sh 可重复执行（幂等、`set -u`、退出码显式）；RESULT.md 阻塞红全 `[ok]`（任一 `[fail]` ⇒ 停，§4 检查点 3）；fixture 七件齐且 `node -e` 逐行 `JSON.parse` 通过。

### 3.2 阶段 B · 纯函数层

- **B1-a cursor 抽取（独立提交 `refactor(daemon): tier1 后端 seam——cursor 抽取`）**：新 `packages/daemon/src/tier1/backends/types.ts`（`Tier1Backend` 接口，方案 §3.1）、`backends/cursor.ts`（`buildArgv` = 现 `:149-152` 的 argv；`parseLine` 包 `parseCursorLine` + 现两正则；`finishPolicy:"kill_on_result"`；`explainFailure` 现状文案）；`realAgentSpawner(backend)` 改为由 backend 提供 argv 与终态判定，进程逻辑不变；`AgentProcessHandle` 增**可选** `stderrTail?(): string`（有界环形缓冲 ≤ 64KB；cursor 路径仍不消费但不再吞）；`AgentSpawner.spawn` 入参增可选 `settingsJson?/sessionId?/maxTurns?`（cursor 忽略）；backend 接口含 `canaryLeft:"shell_started"|"tool_result"`，cursor 恒 `shell_started`。**锚**：cursor argv/解析/`kill_on_result`/canary 左值快照断言；`tier1-executor.test.ts` 37 / `tier1-gate-socket` 7 / `tier1-security` / `tier1-operations` / `tier1-story-e2e` / `tier1-approval-live` **期望值零改动**全绿（仅允许可选项的一行类型适配，evidence 逐行登记）；`just ci` 绿。
- **B1-b claude backend**（`backends/claude.ts`）：`buildArgv`（方案 §3.2 终版；`sessionId` 与 `resumeKey` 互斥断言）、`buildClaudeHooksSettings(gateScriptPath, hookTimeoutSec=120)`（matcher = 阶段 A A-04 选定形态，从 EXPECTED 取；断言 `hookTimeoutSec >= 120 && hookTimeoutSec > 100 + 10`）、`parseClaudeTier1Line`（**不得调用 `parseClaudeLine`**；借鉴其块级循环，逐块产出 `tool_started{tool,toolUseId}`；`user` ⇒ `tool_result{toolUseId,isError}`；`system/init` ⇒ `init{session_id,model,tools,permissionMode,apiKeySource,claudeCodeVersion}`；`rate_limit_event` ⇒ `rate_limit{status,resetsAt,rateLimitType}`；`result` ⇒ `result{subtype,isError,numTurns,usage,modelUsage,permissionDenials,stopReason,terminalReason}`；其余 ignore/unknown）、`finishPolicy`（按 B-9 结论；`wait_exit_then_kill` 的 N=5s）、`canaryLeft:"tool_result"`、`explainFailure`（复用 `explainCliProcessFailure("claude_cli",…)`，AUTH_RE 补 `Login expired`/`Please run /login`——改 `processFailure.ts` 时既有测试不变）。**锚**：新 `packages/daemon/test/tier1-claude-backend.test.ts`：argv 封闭集合断言（必含/必不含两张表）；hooks JSON 快照；`parseClaudeTier1Line` 对七件 fixture 逐行断言（并行 tool_use 两块都计、`user` tool_result、init 含 `apiKeySource`/`tools`、rate_limit、result_max_turns）；`explainFailure` 三例；grep 断言 `backends/claude.ts` 不含 `parseClaudeLine`。
- **B2 门纯函数 + cmdEffect 收紧**：`buildClaudeGateScript(sockPath, logPath)`（方案 v3 §3.3：stdin 先用 shell 判非空，jq -e 校验、按 tool 分支、三态输出、curl `--max-time 100`；**失败路径 = 输出 deny JSON 并 `exit 2`**，jq 缺失时用 printf 静态 deny JSON（不依赖 jq）；no_decision = 空输出 `exit 0`；**不接线**到 `ensureGateScript`，本批只产生函数与测试）；`fileToolToEffect(tool, path, cwd): EffectDescriptor`（**最长现存祖先 realpath + 后缀拼接**；祖先不存在 / 非绝对且无法相对 cwd 解析 / realpath 抛错 ⇒ `{kind:"delete_data",target:"write-outside-worktree",reason:"unresolvable"}` S3；圈内 write_worktree；圈外 delete_data write-outside-worktree；圈内 `SENSITIVE_FILE_BASENAME_RE`（新导出）⇒ touchesSensitiveData；**无 install_dependency 兜底**；Read 圈内 read、圈外/判不出返回标记 `outside_read`）；脚本三态输出按 v3.1：Write/Edit/NotebookEdit 圈内非敏感 ⇒ `allow`、圈内敏感 ⇒ 等 daemon 裁决 ⇒ allow/deny、圈外/判不出 ⇒ deny；Read 圈内 ⇒ 空输出 exit 0、圈外 ⇒ deny；cmdEffect：`cd`/`pushd` 目标圈外 ⇒ S3、圈内 ⇒ S1、含变量/命令替换或 `cd -` ⇒ S2、**`cd` 无参 / `cd ~` / `cd $HOME` / `pushd` 无参 ⇒ S3**，判定在剥 wrapper/`sudo`/`env`/`command`/`exec` 之后；agent CLI 词头（`claude`/`cursor-agent`/`codex`/`grok`/`gemini`/`qwen`/`copilot`）⇒ S3 `send_external spawn-unsupervised-agent`；任意 token 含 `--dangerously-skip-permissions`/`bypassPermissions`/`--permission-mode`/`--yolo` ⇒ S3；`--force` 只在 agent CLI 词头语境下算 S3；**只读词头目标为圈外绝对路径 / `~` / `$HOME` ⇒ `read` + `pathClass=outside` 升 S2**（A-09）。**锚**：`fileToolToEffect` 表驱动 ≥ 36（圈内 / 圈外 / `..` / 符号链接逃逸（真建 symlink）/ `~` / `$HOME` / 盘符 / 大小写 / 新文件圈内 / 新文件圈外 / 断链中间目录 / symlink 指向圈外后再 Write / 相对路径相对 cwd / 路径非字符串 / 圈内 `tokens.css` 不敏感 / `.env` 与 `id_ed25519` 敏感）；cmdEffect 新增 ≥ 26（含对照：`cd src && pnpm test` S1、`cd /tmp` S3、`cd` 无参 S3、`cd ~` S3、`cd $DIR` S2、`cd -` S2、`claude -p x` S3、`sudo cursor-agent --force` S3、`git push --force origin main` 仍 S3、`npm run build --force` 仍 S1、`cat /etc/hosts` S2、`cat ~/.ssh/config` ≥ S2、`cat src/a.ts` S0、`sed -n 1,3p /etc/passwd` S2）；既有 223 条**期望值**零改动；降档扫描 0；`tier1-gate-socket.test.ts` **新增** ≥ 10 真 bash/jq/curl 用例跑 `buildClaudeGateScript` 产物（Bash allow / Bash deny / 畸形 stdin ⇒ deny+exit 2 / curl 不通 ⇒ deny+exit 2 / curl 超时（`--max-time 1` + 挂起假 server）⇒ deny+exit 2 / jq 不在 PATH ⇒ 静态 deny+exit 2 / Write 圈内非敏感 ⇒ allow / Write 圈内敏感 ⇒ 转 daemon 裁决（桩回 allow 与 deny 各一）/ Write 圈外 deny / Write 判不出 deny / Read 圈内空输出 exit 0 / Read 圈外 deny / 未知 tool deny），既有 7 零改动。
- **B3 终态与记账纯函数**：`classifyClaudeRunOutcome(result, rateLimitEvents, stderrTail, exitCode, abort)`（方案 v3 §3.5 枚举；`error_max_turns` ⇒ failed，不 settle 不 verify）+ `buildTier1SubscriptionCostEntry(input)`（**只返回纯对象**：`kind='tier1.run'`、`source='subscription'`、`amount:null`、`known:0`、tokens 四键、`requests:1`、meta `{modelUsage,num_turns,total_cost_usd_estimate,usage_unavailable}`；`usage_unavailable:true` 时四键 0 且并存）。**锚**：`classifyClaudeRunOutcome` 表驱动 ≥ 12；`buildTier1SubscriptionCostEntry` 字段断言 ≥ 4（含 `requests===1`、`usage_unavailable` 并存语义）；**不 INSERT、不被任何生产路径调用**（落库随 W5.4-b 与 09 P-5 同批）。
- **B4 evidence + HANDOFF**：`e2e/evidence/w54a-claude-cli.md`（坐标、spike 总表与 RESULT 指针、三提交 SHA、门禁表、降档扫描、未做清单、对方案条款的反馈）；HANDOFF 开批写指针 `w54a-claude-cli`、收口清指针 + §5 追加一行（spike 目录与 fixture 路径）。

## 3.5 owner 决策附注位（开批时已裁决的写这里，由调度方填）

- D1–D14 采用方案 v3 值（owner 2026-08-19 "都按你的建议继续往下推进"；2026-08-20 授权开批）。v3 相对 v2 的关键变化：D2 取消 `[tier1].agent`（`[models.dev].agent` 唯一）；D6 `requests=1`、本批不落库；D14 增 Bash 圈外只读 S2。对抗评审 77 已回修进方案 v3；Codex 配额恢复后若再出 A 级，调度方在检查点回合告知。
- 拆批 D10 已采用；本批 = W5.4-a。

## 4. 检查点（必须停等调度方/owner；"无回复 = 暂停该分支继续其他"）

1. 开批本身（指针非空即有批在途）。
2. **run.sh 写完后停**：输出"请调度方执行 `bash e2e/spikes/claude-cli-tier1/run.sh --out .tmp/spike-out`"并结束本回合；调度方执行后 `--resume` 你继续写 RESULT.md/fixture。
3. 阶段 A 任一**阻塞红** `[fail]` ⇒ 停，RESULT.md 交调度方/owner，不进 B。
4. B1-a 抽取后若任何既有 `tier1-*.test.ts` 需要改动 ⇒ 停。
5. B-9 若红 ⇒ `finishPolicy` 定为 `wait_exit_then_kill`（N=5s），写进 RESULT 后继续（不停）；B-11/B-12/B-13 的结论与方案不符 ⇒ 记录到 evidence"对方案条款的反馈"，继续。阻塞红清单以 §3.1 为准（A-04 / S1–S4 / S-T / S14 / S-F / B-2 / B-7 / B-10 / B-10' / B-14 矩阵 / B-15）。
6. 任何 canonical/`computeRisk`/消费点签名的改动冲动 ⇒ 停。

## 5. 诚实汇报 + 工作方式

对账表（完成 / 部分 / 未做 三态 + 真实 commit hash + 门禁退出码 + 用例数前后）；每个"完成"指到本会话真实输出；没做的写"没做"；evidence 记录代码提交 SHA（hash 不自指）；spike 原始输出 sha256；降档扫描数字；实施用 Grok CLI（`grok-4.6` + `--reasoning-effort xhigh` + `--always-approve --sandbox workspace`），评估用零上下文只读会话，实施/评估会话隔离。
