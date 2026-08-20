# 82 · W5.4-a 批 code review(Grok grok-4.6 xhigh 只读;Codex 配额耗尽回落)

> prompt:`prompts/82-w54a-claude-cli-review.md`;session `01a01b65-0803-77f3-8279-08dbdabfe0cf`;门禁由调度方沙箱外实跑:`just ci` EXIT=0(contracts 103 / cli 19 / console 253 / daemon 1580|4 / python 33)。

先按对抗审查口径读规格、上一轮 A 级清单和 `.tmp/batch-diff.patch`，再逐项对照实现。规格和上一轮 A 级清单已读到前半；接着读方案关键条款、评审后半和 diff。评审技能走的是编排子代理；本轮按用户口径由本会话只读对账。接下来读 patch、源码和 A-01…A-10 对照点。先读安全关键实现：`fileToolEffect`、`gateScript`、`claude` backend、`cmdEffect` 和 outcome。关键文件已读完，接着核 `cmdEffect` 收紧、`executor` seam，以及测试覆盖是否对得上规格。对照规格、A-01…A-10 清单和实现后，结论先说：**需返工** [fail]。不是测试条数不够，而是 `fileToolToEffect` 把「断链中间目录」做成了圈内 `write_worktree`；W5.4-b 一旦按此接线，hook `allow` 会拆掉 Claude 对圈外写的第二层。

本会话只读了源码、测试、evidence 与 `.tmp/batch-diff.patch`。门禁未复跑；SHA 未用 `git log` 复核，只对照 evidence 自称。

---

## A 级

### A-1 · 断链中间目录走最长现存祖先拼接 ⇒ 圈内 allow（A-01 假绿）

**文件:** `packages/daemon/src/tier1/fileToolEffect.ts:39-52,67-88`；`packages/daemon/test/tier1-file-tool-effect.test.ts:34-38,41-48`

**问题:** `resolveFileToolPath` 用 `existsSync`（内部 `stat`，跟随 symlink）找「现存祖先」。悬空 symlink 的 `stat` 失败，`existsSync` 为 false，算法把它当成「尚未存在的普通目录名」，拼回 worktree realpath 下。结果 `isInsideWorktree` 为 true，Write 得到 `{kind:"write_worktree"}`（S1，hook 将显式 allow）。

Unix 上对悬空 symlink 做 `open(O_CREAT)` / `mkdir -p` 会跟随目标：目标是「圈外已存在目录里的尚不存在文件」时，文件会落在圈外。方案 A-01 已写明：hook 一旦 allow，就没有 Claude 圈外拒写第二层。

活 symlink 指向**已存在**圈外目录的用例是对的（`existsSync(link)` 为 true → `realpath` 出圈 → S3）。洞在**目标不存在**的 symlink。

**证据:**

```39:52:packages/daemon/src/tier1/fileToolEffect.ts
  while (ancestor !== dirname(ancestor)) {
    if (existsSync(ancestor)) break;
    suffixParts.unshift(basenameOf(ancestor));
    ancestor = dirname(ancestor);
  }
  if (!existsSync(ancestor)) return { unresolvable: true };
  // ...
  const resolved = suffixParts.length > 0 ? join(root, ...suffixParts) : root;
```

名为「断链中间目录」的测试实际测的是普通缺失目录，并且**期望 allow**：

```34:38:packages/daemon/test/tier1-file-tool-effect.test.ts
  it("新文件圈内 / 新文件圈外 / 断链中间目录", () => {
    const cwd = wt();
    expect(fileToolToEffect("Write", join(cwd, "src/brand-new.ts"), cwd).kind).toBe("write_worktree");
    expect(fileToolToEffect("Write", "/no/such/dir/x.txt", cwd).kind).toBe("delete_data");
    expect(fileToolToEffect("Write", join(cwd, "missing-dir/x.ts"), cwd).kind).toBe("write_worktree");
  });
```

仓内 `fileToolEffect.ts` 零 `lstat` / 零 dangling symlink。唯一真 symlink 用例是「指向已存在圈外目录后再 Write」（`:41-48`），覆盖不了断链。

**修法:**

1. 祖先链用 `lstat`：任一层是 symlink，对其 `realpath`；`realpath` 抛错（悬空）⇒ `{kind:"delete_data", target:"write-outside-worktree"}`（或 `unresolvable`），**禁止**把 symlink 基名当普通后缀拼接。
2. 测试必须 `symlinkSync("/no/such/outside", join(cwd,"broken"))`，再 Write `join(cwd,"broken/leaked.txt")`，期望 `delete_data`，不得 `write_worktree`。
3. 再加：悬空链指向 `/tmp/missing-file`（父目录存在、文件不存在）的 Write。

本批虽未接 `gateServer`，但 `fileToolToEffect` 就是 W5.4-b 的圈判定单源。带着这个假绿接线，就是 A-01 原链。

---

## B 级

### B-1 · `wait_exit_then_kill`：result 早于 `ownershipEstablished` 则 5s 定时器永不启动

**文件:** `packages/daemon/src/tier1/executor.ts:238-256,272-276`

`kill_on_result` 在 `ownershipEstablished()` 里会 `finish(pendingResultExitCode)`。`wait_exit_then_kill` 只在「已 ownership 且收到 result」时启动 5s→SIGTERM→5s→SIGKILL；ownership 回调对这条策略是空操作。Claude 若不自退（cursor 已证实 stream-json 常不自退），进程会挂死。

cursor 缺省仍 `kill_on_result`，本批不接 claude spawn，所以还不是现网回归。evidence `:94` 已自报。W5.4-b 接线前必须在 `ownershipEstablished` 对称补启动。

### B-2 · 「jq 不在 PATH」用例假绿

**文件:** `packages/daemon/test/tier1-gate-socket.test.ts:243-255`；`e2e/evidence/w54a-claude-cli.md:106-107`

`PATH=/usr/bin:/bin`。本机若 `jq` 在 `/usr/bin/jq`（evidence 已写），脚本仍有 jq，失败走的是 curl 不通（同文件另有一例）。未断言静态 printf 正文、也未断言 `command -v jq` 失败。S-F 的 jq 缺失分支在 CI 上可以从未跑到。

**修法:** `PATH=/nonexistent`，并断言 stdout 等于 `HOOK_DENY_STATIC` 字面量。

### B-3 · `~/` 展开用 `path.join` 丢前缀；测试掩盖

**文件:** `packages/daemon/src/tier1/fileToolEffect.ts:16-17`

`~/foo` → `p.slice(1)` 得 `/foo`；POSIX `join(homedir(), "/foo")` = `/foo`（第二段绝对则丢弃第一段）。`$HOME/foo` 那条先剥前导 `/`，行为不一致。当前 `~/...` 多半落到圈外 S3，是碰巧 fail-closed，不是正确展开。测试只断言 `~/.bashrc` 的 `kind==="delete_data"`，绿不了展开。

**修法:** `join(homedir(), p.slice(2))`（`~/` 之后），或对 `~`/`$HOME` 前缀直接 unresolvable/圈外（与 cmdEffect `pathClass` 一致）。

### B-4 · worktree 为 `/` 时前缀判定把所有绝对路径当圈内

**文件:** `packages/daemon/src/tier1/fileToolEffect.ts:54-65`

`cwd === "/"` → `wt === ""` → `p.startsWith("/" )` 对任意绝对路径为 true。SayDo 正常 git worktree 不会是 `/`，但是 fail-open。应用 `path.relative` 或拒绝 `wt.length === 0`。

### B-5 · 圈外/判不出 Read 的 effect 仍是 S0 `read`

**文件:** `packages/daemon/src/tier1/fileToolEffect.ts:70-82`

Write 判不出是 `delete_data`（S3）。Read 判不出/圈外是 `{kind:"read", target:"outside_read"}`。`computeRisk(read)` = S0。方案要脚本 deny，靠 W5.4-b handler 看 `target`，不能走 `decideCommand`。纯函数层把 deny 做成「标记」而非 S3，接线误用就会放行圈外读。

### B-6 · `claudeBackend.provisionHooks` 把 cursor 的 `gate.sh` 塞进 Claude hooks；`buildArgv` 无 settings 则 hooks 为空

**文件:** `packages/daemon/src/tier1/backends/claude.ts:22-27,197-204`；`gateScript.ts:52-56`

`GatePaths.scriptPath` 是 `gate.sh`（cursor 协议 `{permission}`）。`provisionHooks` 用它生成 PreToolUse command。同时 `buildArgv` 已带 `--settings`，缺省 `"{}"`（无 hooks）。本批不接线，但这两个函数并排放着，W5.4-b 抄错就会出现「无门」或「协议不对」。

### B-7 · 门脚本注入面：实现上 jq `--arg` 能挡住引号/换行/`$()`，但零反例

**文件:** `packages/daemon/src/tier1/gateScript.ts:109-154`；`tier1-gate-socket.test.ts:186-327`

Bash command / file_path / cwd 经 `jq -r` 取出再用 `jq --arg` 组 payload，`$()` 与引号不构成注入。`SOCK='${sockPath}'` 与 `curl --max-time ${curlMax}` 是 JS 插值，路径含 `'` 或 `curlMaxTimeSec` 非整数可破。测试无引号/换行/`$()`/`'` 路径用例。未知 tool 走 `emit_deny`（`exit 0`）不是失败路径的 `exit 2`，与「未知 tool deny」字面相符，但 `emit_deny` 里 jq 失败仍会 `exit 0` 且可能空输出（= no_decision）。

### B-8 · 测试锚：数字够，语义不够

| 锚 | 实况 |
|---|---|
| file-tool ≥36 | 表驱动约 37 行 [ok]；「断链」不是 dangling symlink [fail]；「路径非字符串」只测了 `""`/`$VAR`，没有非 string |
| cmdEffect +≥26 | 新增 27 行 [ok]；既有 223 期望在 patch 里未改 [ok]；缺 B-03 点名的 `timeout 1 cursor-agent -p`（实现上 `peelWrapper` 能剥 duration，缺测试） |
| gate-socket +≥10 | 新增 10 个 `it` [ok]；「圈内/圈外/判不出」全靠桩返回 allow/deny，脚本不做圈判定；jq 缺失假绿 |
| claude argv 快照 | `--permission-mode default`、五工具、`--disallowedTools`、`--setting-sources ""`、`--strict-mcp-config`、matcher `*`、`--max-turns`、session/resume 互斥、禁 bypass/dontAsk/acceptEdits/--add-dir/--bare/--fallback-model/--no-session-persistence [ok]；`rg parseClaudeLine backends/claude.ts` 无命中 [ok] |
| outcome ≥12 | `it.each` 12 行 [ok]；`buildTier1SubscriptionCostEntry` 4 例、零 INSERT、生产路径零调用 [ok] |

cmdEffect 相对 354b028：既有命令集降档 0 来自 evidence 自称，本会话未双加载复跑。patch 里既有 223 条期望未改；明文允许的降档只有 `cd src && pnpm test` / `pushd src`（S2→S1）。圈外只读升 S2 用 `floorS2` 改成 `install_dependency`，不是方案字面的 `read` + `pathClass=outside`，风险档同为 S2。

### B-9 · cursor seam：控制流对齐，但 canary 左值增量改了条件形态

**文件:** `executor.ts:603-616`（`checkCanaries` 正文未改）；`:1214`；`backends/cursor.ts:15-20,53-54`

cursor `buildArgv` 仍是 `-p --force --trust --output-format stream-json`；`finishPolicy:"kill_on_result"`；`canaryLeft:"shell_started"`。`checkCanaries` 仍是 `shellStarted > gateSeq`。左值增量从无条件 `isStarted && isShell` 改为 `canaryLeft === "shell_started" && isCursorShellToolCall`；缺省 cursor backend 下等价。`parseCursorLine` 把 `subtype:"started"` 填进 `tool`（测试期望 `tool: "started"`），这是 BYOA parser 旧行为，不是本批新洞。

stderr 从丢弃改为 64KB 环形缓冲；cursor 路径仍不读 `stderrTail`。`AgentSpawner.spawn` 只增可选 `settingsJson?`/`sessionId?`/`maxTurns?`；`stderrTail?` 可选。既有 executor 测试在 patch 中无期望改动。

### B-10 · evidence / 指针 / 路径

- HANDOFF「当前批次指针」为 `(空)`，并写了 spike/fixture 路径 [ok]。
- evidence 自称 SHA 链 `0649107`→`ed8b0f3`→`5195164`→`0ae8692`→`16d24eb`→`f1a5d28`→`70ef24a`；本会话未 `git log` 核对这些哈希。
- 本机路径泄漏：`e2e/evidence/w54a-claude-cli.md:9` `/Users/wangyixiao/WorkSpace/saydo-batch-w54a-claude-cli`；`:139-140` `/Users/wangyixiao/.cache/uv`。RESULT 声称摘录已脱敏。fixture 用 `/tmp/saydo-fixture/`，未见真实 HOME。
- `EXPECTED.md:30` 含凭据形态字面量 `ANTHROPIC_API_KEY=sk-invalid-spike`（spike 说明，不在 golden fixture）。
- `init.jsonl` 的 `permissionMode` 仍是 `acceptEdits`，生产 argv 已是 `default`。

### B-11 · `SENSITIVE_FILE_BASENAME_RE` 对 `.env*` 收窄过死

**文件:** `fileToolEffect.ts:7-8`

`\.env(?:$|\.)` 命中 `.env` / `.env.local`，不命中 `.envrc`（direnv 密钥）。圈内写 `.envrc` 会 S1 自动 allow。与方案「`.env*`」不完全同延。`tokens.css` 不敏感 [ok]。

---

## C 级

- IMPL 字面 `{target:"write-outside-worktree", reason:"unresolvable"}`；实现用 `target:"unresolvable"`（EffectDescriptor 无 `reason`）。S3 档没错，evidence 已记。W5.4-b 若按字面 grep `reason` 会落空。
- 「断链中间目录」测试名与缺失目录行为绑在一起，会把后续接线会话带偏。
- `classifyClaudeRunOutcome` 在 `subtype==="success"` 且 `terminal_reason==="max_turns"` 时仍 failed（测试写死）。与「success ⇒ settle」并排时要靠注释说明优先级。
- `backends/types.ts` 自写 `AdapterKind`，未从 `@saydo/contracts` 的 `Adapter` 引入；值集合一致，但是分叉苗头。
- HANDOFF 把「空」写成「(空)」，检索锚仍能命中「当前批次指针」。

---

## A-01…A-10 对账

| 77 条 | 本批 | 判定 |
|---|---|---|
| A-01 祖先 realpath；判不出 S3；断链/新文件反例 | 新文件圈内/圈外、活 symlink 出圈 [ok]；**断链假绿** | [fail] 见 A-1 |
| A-02 圈外写无 S2/allow | Write 圈外 `delete_data` / `write-outside-worktree` | [ok] |
| A-03 失败路径 deny+exit 2；curl 100 | 脚本形态对；jq 缺失测试假绿 | [warn] |
| A-04 matcher `*` | `CLAUDE_HOOK_MATCHER="*"`；EXPECTED 已填 | [ok] |
| A-05 禁止 `parseClaudeLine`；多块 tool_use | 源码不含该符号；fixture 两块都计 | [ok] |
| A-06 B3 不 INSERT | 仅测试调用；零生产引用 | [ok] |
| A-07 B-9 不停批 | `wait_exit_then_kill`；实现有 ownership 竞态 | [warn] |
| A-08 B-14 矩阵 | 属 spike；RESULT 报 [ok]，本会话未重跑 jsonl | 不评代码 |
| A-09 圈外只读词头 S2 | `cat /etc/hosts` 等升 S2；实现用 `install_dependency` | [ok] 档 / [warn] 形状 |
| A-10 取消零行为变化；canary 分 backend | cursor 左值仍 `shellStarted`；`checkCanaries` 未改 trip 条件 | [ok] |

argv 封闭集、Gate 0 无 bypass、B3 不落库、契约新文件未重定义 09 类型：未发现 A 级违规。

---

## 总评

**需返工** [fail]

不能并入。A-1 是方案 77 A-01 点名的洞：最长现存祖先算法在悬空 symlink 上退化成「当新目录拼回 worktree」，测试还用缺失目录冒充断链并期望 allow。其余（argv、`parseClaudeTier1Line`、cmdEffect 只升不降、B3 纯对象、cursor `kill_on_result` / `shellStarted`、HANDOFF 指针已清）未构成同等安全退化。

返工最小集：

1. `lstat` + dangling ⇒ S3 deny，不得后缀拼接。
2. 真建悬空 symlink 的表驱动（替换现在的 `missing-dir` 假「断链」）。
3. 顺手：jq 缺失测试用空 PATH 并断言静态 JSON；`ownershipEstablished` 补 `wait_exit_then_kill` 定时器（可留 b 批，但不要再当已完成）。

未复跑：`just ci`、cmdEffect 双版本降档扫描、spike jsonl 原文。evidence 里 `just ci` python 段红、node 段自称绿，本会话不当作已验证。