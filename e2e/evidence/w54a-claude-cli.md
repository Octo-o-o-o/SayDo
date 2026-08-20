# w54a-claude-cli · W5.4-a Claude CLI spike 固化 + 纯函数层(2026-08-20)

> 范围 = IMPL-PROMPT-10 v2.1 阶段 A(RESULT + golden fixture)与阶段 B(B1-a → B1-b → B2 → B3 → B4)。不改执行器主流程接线、不改 `gateServer.ts`、不改 `config/types.ts`/`validateConfig.ts`/`index.ts`、不改 `checkCanaries` 的 trip 条件、不部署常驻。
> 完成定义 = spike RESULT 落盘 + 七件 fixture + 纯函数层独立提交 + evidence + HANDOFF 指针回填。本文件不自指 SHA。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做或沙箱受阻。

## 0. 坐标

- 工作目录:`<clone>`
- 分支:`batch/w54a-claude-cli`
- 开批基线 HEAD:`354b028`(允许作为 docs/license 之后的起点;`1ee5622` 是其祖先)
- 开批提交:`0649107f40e788b87a5468da15b2ddeaad086ebe`(`chore(batch): 开批 w54a-claude-cli`)
- 方案:`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` v3.1(调度方已改工作树,本 evidence 提交不带该 diff)
- IMPL:`docs/plan/IMPL-PROMPT-10-W54A-CLAUDE-CLI.md` v2.1(同上,不入本提交)
- spike 原始输出:`.tmp/spike-out/`(不入 Git);条目 sha256 与摘录见 `e2e/spikes/claude-cli-tier1/RESULT.md`
- golden fixture:`packages/daemon/test/fixtures/claude-cli/2.1.220/`

代码提交(本文件记录这些 SHA,不自指):

| SHA | 主题 |
|---|---|
| `ed8b0f3b0c21bb145ea2040df50c11f0ae687f4c` | feat(spike): 阶段 A RESULT + fixture |
| `5195164bf9611320f234eb0ec230940dd3105259` | refactor(daemon): B1-a cursor 抽取 |
| `0ae869202b4604f1c23512587fdc6f37b2f68f1c` | feat(daemon): B1-b claude backend 纯函数 |
| `16d24eb59e219afd38590ac596967139828ef13a` | feat(daemon): B2 门脚本 / fileToolToEffect / cmdEffect |
| `f1a5d28c01f95d99d2ac41b7547c3e33bfbfda46` | feat(daemon): B3 classifyClaudeRunOutcome + 订阅记账纯对象 |
| `70ef24a6ea92414943140e7af2abfd3f01d3bcec` | fix(daemon): exactOptionalPropertyTypes 适配 parseLine/explainFailure |

## 1. spike 总表(指针 RESULT.md)

调度方沙箱外执行 `bash e2e/spikes/claude-cli-tier1/run.sh --out .tmp/spike-out`。当时终版 argv 仍是 `--permission-mode acceptEdits`。B-10prime 红后方案升 v3.1,`run.sh` 与 B1-b argv 已改为 `default`。

### 阻塞红

| id | 判定 | 出处 |
|---|---|---|
| A-04 | [ok] | 选定 matcher `*`(EXPECTED.md 槽位已填) |
| S1 / S2 / S3 / S4 | [ok] | RESULT §1 |
| S-T / S5 / S14 / S-F | [ok] | RESULT §1 |
| B-2 / B-7 / B-10 | [ok] | RESULT §1 |
| B-10prime | [fail] | `acceptEdits` 下 hook 超时后圈内 `.env` 落盘。v3.1 改 `default`;X2 证实超时不落盘 |
| B-14 a–d / B-15 | [ok] | RESULT §1 |

检查点 3:IMPL 原文「阻塞红任一 [fail] ⇒ 停、不进 B」。调度方已用 v3.1 + X1–X5 处置 B-10prime 并明示进 B。本批按调度方指令继续,并在 RESULT 保留 [fail] 原判。

### 设计调整级

| id | 判定 | 对实现的影响 |
|---|---|---|
| B-9 | [ok] | 仍取 `finishPolicy=wait_exit_then_kill`(N=5s) |
| B-11 | [warn] | `persist=unknown`;cmdEffect `cd` 收紧仍落地 |
| B-12 | [ok] | 额外变量名清单见 RESULT,无值 |
| B-13 | [ok] | auto-memory 经 Write 写 `MEMORY.md` / `user_preferences.md` |
| B-3 | [ok] | 未开 Task |

### 信息级

B-6 / B-16 [ok]。B-16 仅见 `rate_limit_event.status=allowed`。

X1–X5 sha256 见 RESULT B-10prime 表(本会话核过 RESULT 原文,未重算 X 文件;X1–X5 由上一实施回合 `hashlib.sha256` 写入 RESULT)。

## 2. 阶段 B 落点

### B1-a cursor 抽取 [ok]

- 新 `packages/daemon/src/tier1/backends/types.ts` / `cursor.ts`
- `realAgentSpawner(backend = cursorBackend())`;缺省仍 cursor
- cursor argv 快照:`-p --force --trust --output-format stream-json`(测试 `tier1-cursor-backend.test.ts` 3 例)
- `finishPolicy:"kill_on_result"`;`canaryLeft:"shell_started"`
- 既有 `tier1-executor.test.ts` 37 / `tier1-security` 24 / `tier1-operations` 18 / `tier1-story-e2e` 2 / `tier1-approval-live` 18 **期望值零改动**(检查点 4 未触发)
- `checkCanaries` trip 条件仍是 `shellStarted > gateSeq`;左值增量改为 `canaryLeft === "shell_started" && isCursorShellToolCall(line)`

可选入参/方法(IMPL 允许的类型适配,既有测试文件零行改动):

| 位置 | 适配 |
|---|---|
| `AgentProcessHandle.stderrTail?(): string` | `executor.ts` 可选;fake 可不实现 |
| `AgentSpawner.spawn` 增 `settingsJson?` / `sessionId?` / `maxTurns?` | 可选;cursor 忽略;既有 FakeSpawner 窄签名未改 |
| `ExecutorDeps.backend?: Tier1Backend` | 缺省 `cursorBackend()` |

### B1-b claude backend [ok]

- argv: `-p --output-format stream-json --verbose --permission-mode default` + 五工具 + `--disallowedTools WebFetch,WebSearch` + `--setting-sources ""` + `--strict-mcp-config` + `--settings` + `--max-turns`;`sessionId` XOR `resumeKey`
- 必不含:`bypassPermissions` / `dontAsk` / `--dangerously-skip-permissions` / `--add-dir` / `--no-session-persistence` / `--bare` / `--fallback-model` / `acceptEdits`
- hooks matcher `*`,timeout 120,断言 `hookTimeoutSec >= 120 && > 100+10`
- `parseClaudeTier1Line` 返回 `Tier1Event[]`;`rg parseClaudeLine packages/daemon/src/tier1/backends/claude.ts` 退出码 1(无命中)
- `finishPolicy:"wait_exit_then_kill"`;`canaryLeft:"tool_result"`
- AUTH_RE 补 `Login expired` / `Please run /login`(既有 `process-failure.test.ts` 7 例未改期望)
- 测试 `tier1-claude-backend.test.ts` **15 passed**(argv / hooks / 七件 fixture / explainFailure 三例 / 源码不含 parseClaudeLine)
- fixture 七件 `node -e` 逐行 `JSON.parse` 通过(init 1 / tool_use_multi 1 / tool_result 2 / result_success 1 / result_max_turns 1 / rate_limit 1 / resume_fail 1)

[warn] `result_max_turns.jsonl` 无 live `error_max_turns` 流,按附录 A S11 形状合成(RESULT §3 已声明)。

[warn] `wait_exit_then_kill`:result 若早于 `ownershipEstablished` 到达,`ownershipEstablished()` 只处理 `kill_on_result`,不会补启动 5s SIGTERM 定时器。本批 claude backend 未接生产认领;W5.4-b 接线前应补对称启动。

### B2 门 + fileTool + cmdEffect [ok]

- `buildClaudeGateScript`:失败路径静态 deny JSON + `exit 2`;curl `--max-time 100`;allow / deny / no_decision 三态;`ensureGateScript` 仍只写 cursor `gate.sh`
- 脚本本身不在 hook 内跑 `fileToolToEffect`(本批不接 gateServer);Write/Read 的圈内/圈外判定由 daemon 桩回 allow/deny/no_decision,测试覆盖该协议
- `fileToolToEffect`:最长现存祖先 realpath + 后缀拼接;判不出写 `{kind:"delete_data",target:"unresolvable"}`(EffectDescriptor 无 `reason` 字段,未按 IMPL 字面 `reason:"unresolvable"`)
- `SENSITIVE_FILE_BASENAME_RE` 新导出
- `tier1-file-tool-effect.test.ts` 9 个 `it`(含表驱动 `rows.length >= 36`)
- `tier1-gate-socket.test.ts` 既有 7 + 新增 10 = **17 passed**
- cmdEffect 新增 27(`w54aCmdEffect`):既有 223 期望未改;总计 **250 passed**

[warn] 「jq 不在 PATH」用例设 `PATH=/usr/bin:/bin`,本机 `jq` 在 `/usr/bin/jq`,该例实际走 curl 不通路径(同文件另有 curl 不通例)。jq 缺失分支在 PATH 真不含 jq 的环境才测到。

### B3 终态与记账 [ok]

- `classifyClaudeRunOutcome` 表驱动 12 行;`error_max_turns` ⇒ failed
- `buildTier1SubscriptionCostEntry` 4 例:`kind=tier1.run` / `source=subscription` / `amount=null` / `known=0` / `requests===1`;`usage_unavailable:true` 时四键 0 且并存
- 生产路径零调用、零 INSERT(`rg buildTier1SubscriptionCostEntry` 仅定义与测试)

`tier1-claude-outcome.test.ts` **16 passed**。

## 3. 门禁(退出码紧跟命令本身)

| 命令 | 退出码 | 摘录 |
|---|---|---|
| `pnpm --filter @saydo/daemon exec tsc --noEmit`(typecheck 修复后) | 0 | 无诊断 |
| `pnpm --filter @saydo/daemon exec vitest run` 定向 12 文件 | 0 | **416 passed**(含 executor 37 / cmd-effect 250 / gate-socket 17 / claude-backend 15 / claude-outcome 16 / file-tool 9 / cursor-backend 3 / process-failure 7) |
| `just ci` | **2** | node 矩阵跑完;python 在 `uv sync` 写 `~/.cache/uv` 被拒(见 §6) |
| `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `cd pipeline && .venv/bin/python -m ruff check .` | 0 | `All checks passed!`(既有 venv,不是 `just ci` 本体) |
| `cd pipeline && .venv/bin/python -m pytest -q` | 0 | **33 passed** in 0.26s |

`just ci` node 段摘录(本会话):

- contracts Tests **103 passed**
- cli Tests **19 passed**
- console Tests **253 passed**
- daemon Test Files **109 passed | 2 skipped**;Tests **1580 passed | 4 skipped (1584)**
- emoji-gate self-test pass=11 fail=0
- color gate `[summary] pass=21 fail=0`

python `uv sync` 原文:

```
error: Failed to initialize cache at `~/.cache/uv`
  Caused by: failed to open file `~/.cache/uv/sdists-v9/.git`: Operation not permitted (os error 1)
error: recipe `ci-python` failed on line 28 with exit code 2
```

## 4. 降档扫描

方法:把开批 `0649107` 的 `cmdEffect.ts` 与当前版同时加载,同一 `computeRisk`。命令集从 `tier1-cmd-effect.test.ts` 抽出唯一字符串。

| 命令集 | 条数 | 降档 | 升档 | 持平 |
|---|---|---|---|---|
| 开批测试文件(既有 223 用例所含命令) | 256 | **0** | 0 | 256 |
| 加上本批 `w54aCmdEffect` 27 条后 | 283 | 2 | 20 | 261 |

既有 223 条 vitest 期望一字未改,且其命令集相对开批 cmdEffect **降档 0**。

含新表后的 2 条「降档」都是 IMPL 明文要求的圈内 cd/pushd → S1(旧档未知词头 S2):

| 命令 | 开批 | 现判 |
|---|---|---|
| `cd src && pnpm test` | S2 | S1 |
| `pushd src` | S2 | S1 |

升档 20 条(只收紧):`cd /tmp`/`cd`/`cd ~`/`cd $HOME`/`pushd`/`pushd /var` S2→S3;agent CLI 词头 S2→S3;`cat /etc/hosts` 与 `cat ~/.ssh/config` S0→S2;`sed -n 1,3p /etc/passwd` S1→S2;`echo x --yolo` S1→S3;`true --dangerously-skip-permissions` S2→S3 等。

圈外只读未改 `computeRisk` 签名:Bash `cat /etc/hosts` 走 `floorS2({kind:"read"}, "outside-read")` ⇒ `install_dependency` S2。file 工具圈外 Read 用 `{kind:"read",target:"outside_read"}`。

## 5. 对方案条款的反馈

| 条款 | 反馈 |
|---|---|
| D3 / §3.2 permission-mode | `acceptEdits` 不可用(B-10prime 红)。终版 `default` + 圈内写 hook 显式 allow。X2 超时不落盘,X3 无裁决拒写,X4 圈内 Read 自放行,X5 圈外 Read 自拒 |
| §3.3 matcher | A-04 选定 `*` |
| §3.1 finishPolicy | B-9 绿仍取 `wait_exit_then_kill`(5s) |
| B-11 / cmdEffect `cd` | persist 测不出(`unknown`);`cd` 收紧仍落地,不依赖 persist 证据 |
| B-12 | 额外环境变量名见 RESULT(无值);`SHELL=/bin/sh` 止漏有效 |
| B-13 / R-13 | auto-memory **经 Write**;P0 在 `default` 下圈外/未 allow 的写会被拒,审计标 `auto_memory_denied`(方案侧,本批未接线) |
| fileTool 判不出 | 实现用 `target:"unresolvable"`,无 `reason` 字段 |
| 圈外只读 S2 | 不改 `computeRisk`;Bash 走 floorS2 |
| `error_max_turns` fixture | 无 live 流,合成件;分类器按 subtype 测过 |

## 6. 明确未做

- 未把 claude backend 接到执行器认领主路径(`realAgentSpawner()` 缺省仍 cursor)
- 未改 `gateServer.ts`;`buildClaudeGateScript` 未进 `ensureGateScript`
- 未改 `config/types.ts` / `validateConfig.ts` / `index.ts`
- 未改 `checkCanaries` 的 trip 条件
- 未 INSERT 订阅记账;未改 09 canonical
- 未跑 `claude -p`(本实施会话;spike 由调度方沙箱外执行)
- 未碰 `~/.saydo` / `~/.claude`
- 未 `just daemon deploy` / 未 push
- 批末 code-review 由独立会话落 `research/codex-findings/82-w54a-claude-cli-review.md`;返工见 §8
- 调度方改过的方案 v3.1 / IMPL v2.1 工作树 diff、`docs/site/`、`prompts/77-*`、`research/codex-findings/77-*` **未纳入本批提交**

## 7. §5 对账表

| 项 | 状态 | 证据 |
|---|---|---|
| 开批指针 | 完成 | `0649107`;收口清指针见 HANDOFF 同提交 |
| 阶段 A RESULT + fixture | 完成 | `ed8b0f3`;RESULT.md;七件 fixture JSON.parse 过 |
| B1-a | 完成 | `5195164`;既有期望零改;cursor 快照 3 例 |
| B1-b | 完成 | `0ae8692` + typecheck `70ef24a`;backend 测试 15 |
| B2 | 完成 | `16d24eb`;gate-socket 17;cmd-effect 250;file-tool 表 ≥36 |
| B3 | 完成 | `f1a5d28`;outcome 16;不 INSERT |
| B4 evidence + HANDOFF | 完成 | 本文件 + HANDOFF 指针(空) + §5 一行 |
| `just ci` 双矩阵 | 完成(调度方沙箱外) | 见 §8:EXIT=0 / daemon 1580\|4 / python 33 |
| 降档 0(既有 223) | 完成 | 256 命令 down=0;新表 2 条圈内 cd/pushd 按条款落到 S1 |
| 评估线 | 完成 | `research/codex-findings/82-w54a-claude-cli-review.md`;本文件 §8 返工 |

## 8. 评审 1 返工(报告 `research/codex-findings/82-w54a-claude-cli-review.md`)

报告结论 [fail]。调度方沙箱外门禁(报告原文,本返工会话未复跑完整 `just ci`):`just ci` **EXIT=0**(contracts 103 / cli 19 / console 253 / daemon **1580|4** / python **33**)。

返工代码 SHA(本文件记录,不自指):

| SHA | 主题 |
|---|---|
| `6313766472de4308fd9117c4bd85c4701afca642` | fileToolToEffect 悬空 symlink / ~ 展开 / 根 worktree / Read 圈外 S3 |
| `56f0731fb3ce270cfc032947a370abaeac0f05ee` | 门脚本与测试锚 |
| `2d7e363aaa1c5f0e8679a4047b31a2b12b5b667b` | EXPECTED 脱敏 + init fixture permissionMode |

### A-1 [ok]

祖先链改 `lstat`。真建 `symlinkSync("/no/such/outside", join(cwd,"broken"))` 再 Write `broken/leaked.txt` ⇒ `{kind:"delete_data",target:"write-outside-worktree",reason:"dangling_symlink"}`(S3)。悬空链指向 `/tmp/missing-file` 同判。原「断链中间目录」改名为「普通缺失目录(圈内)」,仍 `write_worktree`。EffectDescriptor 增可选 `reason?`(computeRisk 不读;非 config schema)。

### B 级

| id | 处置 | 本会话门禁 |
|---|---|---|
| B-1 | `ownershipEstablished` 对称 `armWaitExitThenKill`;cursor `kill_on_result` 仍立即收。单测 5s 锚 | executor 38 passed(原 37),退出码 0 |
| B-2 | `PATH=/nonexistent` + `/bin/bash`;stdout === `CLAUDE_HOOK_DENY_STATIC`;exit 2 | gate-socket 该例绿 |
| B-3 | `~/` → `join(homedir(), p.slice(2))`;`$HOME/` 同法。断言 abs 等于 `join(homedir(), ".bashrc")` 且不是 `/.bashrc` | file-tool 该例绿 |
| B-4 | cwd 为 `/` 或空 ⇒ unresolvable/S3;`path.relative`;sibling `${cwd}-evil` 不因 startsWith 放行 | 同上 |
| B-5 | 圈外/判不出 Read ⇒ `{kind:"delete_data",target:"read-outside-worktree"}`;`computeRisk` S3。脚本 `path_outside` 在桩 allow 下仍 deny | file-tool + gate-socket |
| B-6 | `provisionHooks` 写 `gate-claude.sh`(不是 cursor `gate.sh`);`buildArgv` 缺 settingsJson / 空 hooks 抛错 | claude-backend 17 passed(原 15) |
| B-7 | SOCK/LOG `bashSingleQuoted`;curlMax 正整数断言;`bash -n` 覆盖 `'`,换行,`$()`,反引号。未知 tool `emit_fail` exit 2。`emit_deny` 的 jq 失败回落静态 JSON + exit 2 | gate-socket 21 passed(原 17) |
| B-8 | `timeout 1 cursor-agent -p` S3;file-tool 路径非 string(`1`/`null`);gate-socket 两条桩 allow 但圈外仍 deny;jq `--arg` 反例 `a'$(whoami).ts` | cmd-effect 251 passed(原 250) |
| B-9 | 如实:canary 左值增量从无条件 `isStarted && isShell` 改为 `canaryLeft === "shell_started" && isCursorShellToolCall`。`checkCanaries` trip 仍是 `shellStarted > gateSeq`。缺省 cursor backend 下与抽取前等价;claude `canaryLeft:"tool_result"` 本批不接生产认领,不涨 `shellStarted` | 未改 trip 条件 |
| B-10 | 本文件工作目录改为 `<clone>`;uv 缓存改为 `~/.cache/uv`。EXPECTED B-15 去掉 `sk-` 字面量。init.jsonl `permissionMode` 改为 `default`(形状仍来自 S-T,仅该字段改写)。补调度方沙箱外 just ci 如上 | 见上表 SHA |
| B-11 | `SENSITIVE_FILE_BASENAME_RE` 改为 `\.env[^/]*$`(`.env` / `.env.local` / `.envrc`);`tokens.css` 仍不敏感 | file-tool 12 passed(原 9) |

### 用例数前后(本返工会话 `vitest run` 退出码 0)

| 文件 | 返工前 | 返工后 |
|---|---|---|
| `tier1-file-tool-effect.test.ts` | 9 | 12 |
| `tier1-cmd-effect.test.ts` | 250 | 251 |
| `tier1-gate-socket.test.ts` | 17 | 21 |
| `tier1-claude-backend.test.ts` | 15 | 17 |
| `tier1-executor.test.ts` | 37 | 38 |
| `tier1-cursor-backend.test.ts` | 3 | 3 |

`pnpm --filter @saydo/daemon exec tsc --noEmit` 退出码 0。未改 executor 认领主流程 / `gateServer.ts` / `config/types.ts` / `checkCanaries` 正文。未 INSERT。未 push。

`run.sh` B-15 无效 key 已在评审 2 改为运行时拼接(见 §9)。

## 9. 评审 2 返工(报告 `research/codex-findings/84-w54a-claude-cli-review-2.md`)

报告结论:A-1 已修 [ok];新 A-2 必修。调度方沙箱外 `just ci` 曾红在 lint(`gateScript.ts:147` 无用 `\$`)。

返工代码 SHA(本文件记录,不自指):`54b981cc0e38dbb4d66f8b5868761c208b3b1617`

### A-2 [ok]

`normalize` 之前按分量检查 `..` ⇒ `{kind:"delete_data",target:"write-outside-worktree",reason:"dotdot"}`(S3;与门脚本 `*..*` 对齐)。**不**在跟随 symlink 之前做词法折叠。圈内含 `..` 的路径一律保守拒,agent 应改用规范路径(`src/a.ts` 而非 `src/../src/a.ts`)。`path.join` 会先折叠 `..`,测试用字面量 `${cwd}/link/../leaked.txt` 保留分量。

表驱动:真建 `symlinkSync(".", join(cwd,"link"))` 再 Write `link/../leaked.txt` ⇒ delete_data;live symlink 指向圈外目录的 `outlink/../x` ⇒ delete_data。file-tool **12→13**,本会话退出码 0。

### lint [ok]

`gateScript.ts` `'$HOME'` 去掉无用 `\$`。本会话 `pnpm lint` **EXIT=0**;`tsc --noEmit` **EXIT=0**。

### C

| 项 | 处置 |
|---|---|
| HANDOFF 末码 | 改为本批代码末码 `54b981cc0e38dbb4d66f8b5868761c208b3b1617`(本 chore 提交不自指) |
| `run.sh` B-15 | `spike_key="sk-"` 再拼 `invalid-spike`;仓内无 `sk-` 与后续片段相连的字面量 |
| `/tmp/missing-file` | 改为 `mkdtemp` 下 `no-such-file` |

### B-12 · W5.4-b 前要处理

`path_outside` 是词法前缀(`"$root"|"$root"/*`),不是 realpath。macOS 上 cwd=`/tmp/wt`、Claude 若把 `file_path` 收成 `/private/tmp/wt/a.ts`,脚本会假 deny(fail-closed,不出圈)。活 symlink 不含 `..` 时脚本当圈内,靠 daemon `fileToolToEffect` 拦。圈判定单源在 daemon;W5.4-b 接线时不要删脚本 `*..*` 补偿,也不要把词法前缀当成 realpath 等价。

### 调度方沙箱外复跑位

本返工会话未跑完整 `just ci`(只跑 lint/tsc/file-tool/gate-socket 定向)。请调度方补填:

- `just ci` EXIT=_
- daemon Tests _ passed | _ skipped
- python pytest _

(评审 1 后调度方曾报 EXIT=0 / daemon 1580|4 / python 33;评审 2 初跑因 lint `\$` 红,本修后待复跑。)


