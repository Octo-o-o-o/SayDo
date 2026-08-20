# 84 · W5.4-a 批 评审 2(返工复核;Grok grok-4.6 xhigh 只读;Codex 配额耗尽回落)

> prompt:`prompts/84-w54a-claude-cli-review-2.md`;session `01a01b82-249f-7b62-a1f7-fe357b916ea2`;门禁由调度方沙箱外实跑(见 evidence)。

先按评审约定读技能说明和必读材料，再对照返工 diff 与代码核实 A-1、B 项和回归。评审 1 已读完。接着读规格、返工 diff 和必读源码。规格前半已拿到。接着读返工 diff 和核心实现文件。实现主干已读到。接着核对测试、executor 竞态和 patch 后半。接着核 cmdEffect 期望、canary、路径边界和脱敏残留。# 84 · W5.4-a 批 评审 2（返工复核；零上下文只读；Grok 回落）

> 对照：评审 1 `research/codex-findings/82-w54a-claude-cli-review.md`；返工 diff `.tmp/rework-diff.patch`（自称 `git diff c384687..HEAD`）；规格 `docs/plan/IMPL-PROMPT-10-W54A-CLAUDE-CLI.md` v2.1 与方案 v3.1 §3.3。  
> 范围：只读 `read_file` / `grep` / `list_dir`。本会话 **未** `git log`、**未** 跑测试 / `just ci`（门禁按调度口径不在范围）。下文 SHA 来自用户点名四提交与 evidence/patch 原文，**未**独立核哈希。

---

## 总评

**仍需返工** [fail]

评审 1 的 **A-1（悬空 symlink 假绿）已真正修好**：祖先链逐层 `lstat`，symlink 层 `realpathSync` 抛错 ⇒ `{dangling:true}` ⇒ S3，不再把 symlink 基名当普通后缀拼回 worktree。两种真悬空 symlink 测试都在。B-1…B-11 主体到位。cursor 路径与既有 223 条 cmdEffect 期望在 patch 里看不到被改。

不能并入的原因不是 A-1 没修完，而是 **圈判定单源仍有一条同族假绿**：`resolveFileToolPath` 在 `lstat` 之前先 `normalize()` 做**词法**折叠，`..` 穿过 live symlink 会变成圈内 `write_worktree`（S1，接线后 hook 会显式 allow）。方案 §3.3 把 `..` 与符号链接逃逸列为圈外；`fileToolToEffect` 仍是 W5.4-b 圈判定单源。门脚本 `path_outside` 的 `*..*` 只是字面子串补偿，不是算法修复。带着这条接线，就是 A-01「hook allow 拆掉 Claude 圈外拒写第二层」的变体。

---

## ① A-1 是否真正修复；还有没有别的路径归一化绕过

### A-1 原洞（悬空 symlink 当缺失目录拼接）[ok]

`packages/daemon/src/tier1/fileToolEffect.ts` 已去掉 `existsSync`。走法：

```53:77:packages/daemon/src/tier1/fileToolEffect.ts
  for (;;) {
    const st = lstatOrNull(ancestor);
    if (!st) {
      if (ancestor === dirname(ancestor)) return { unresolvable: true };
      suffixParts.unshift(basenameOf(ancestor));
      ancestor = dirname(ancestor);
      continue;
    }
    if (st.isSymbolicLink()) {
      let root: string;
      try {
        root = realpathSync(ancestor);
      } catch {
        return { dangling: true };
      }
      return { abs: suffixParts.length > 0 ? join(root, ...suffixParts) : root };
    }
    // 普通节点 realpath + 后缀拼接；抛错 ⇒ unresolvable
```

- 任一层 `lstat` 命中 symlink，对其 `realpathSync`；抛错（悬空）⇒ `{dangling:true}`，**不会**把该层基名推进 `suffixParts`。
- `fileToolToEffect` 对 dangling：Write ⇒ `{kind:"delete_data", target:"write-outside-worktree", reason:"dangling_symlink"}`；Read 同为 `delete_data` + `read-outside-worktree`。`computeRisk(delete_data)` 基线 S3（`policy/engine.ts:48`）。

测试是真建 symlink，不是缺失目录冒充：

| 用例 | 做法 | 期望 |
|---|---|---|
| 目标目录不存在 | `symlinkSync("/no/such/outside", join(cwd,"broken"))` 再 Write `broken/leaked.txt` | `delete_data` / `write-outside-worktree` / `dangling_symlink` / S3 |
| 父目录存在、文件不存在 | `symlinkSync("/tmp/missing-file", join(cwd,"to-missing"))` 再 Write `to-missing` 本身 | 同上（这正是 Unix `open(O_CREAT)` 跟随悬空链、在圈外建文件的形态） |

原「断链中间目录」已改名为「普通缺失目录(圈内)」，仍 `write_worktree`，语义不再绑 dangling。活 symlink 指向已存在圈外目录后再 Write `link/leaked.txt` 仍走 realpath 出圈。

### 新 A · `normalize()` 词法折叠 ⇒ `..` 穿过 live symlink 假绿（A-01 同族）

**文件:** `fileToolEffect.ts:50`（`abs = normalize(abs)` 在 `lstat` 循环之前）；测试 `tier1-file-tool-effect.test.ts:32-36,46-54`

Node `path.normalize` 只做词法段折叠，**不**跟随中间 symlink。POSIX `open`/`lstat` 对中间分量会先解析 symlink 再应用 `..`。

反例（静态可判定，本会话未跑）：

1. `ln -s . link`（或指向任意目录的 live symlink）。`cmdEffect` 对 `ln`：源 `.` 为圈内 ⇒ `write_worktree` / S1，会自动 allow（`cmdEffect.ts:1058-1065`）。
2. Write `link/../leaked.txt`。
3. 分类器：`normalize(cwd/link/../leaked.txt)` = `cwd/leaked.txt` → 祖先是 worktree → `{kind:"write_worktree"}`（S1）。
4. 实际打开：`link` 解析为 cwd（或圈外目标），`..` 落到**目标的父目录**。`link → .` 时物理路径是 worktree 的父目录，圈外。

现有「`..` 逃逸」测试只覆盖 `src/../src/a.ts`（`src` 是真目录，词法与物理一致）和 `../outside.txt`，**没有** `link/../x`。活 symlink 用例只测 `link/leaked.txt`（无 `..`），那条是对的。

门脚本 `path_outside` 用 `*..*` 会在 hook 层 deny 含 `..` 的字面路径（`gateScript.ts:144-146`）。这是补偿，不是 `fileToolToEffect` 修法。方案 v3.1 §3.3 与评审 1 都把该函数定为 W5.4-b 圈判定单源；W5.4-b 若以它为准、或把 `path_outside` 当重复逻辑删掉，hook allow 仍会拆掉 Claude 圈外拒写第二层。

**修法（最小）：**

1. `normalize` 之前若路径含 `..` 分量 ⇒ `unresolvable` / 圈外 S3（与脚本 `*..*` 对齐）；**或**按分量走：遇 symlink 先 `realpath` 再应用后续 `..`，禁止词法预折叠。
2. 表驱动必含：`symlinkSync(".", join(cwd,"link"))` 再 Write `join(cwd,"link/../leaked.txt")`，期望 `delete_data`，不得 `write_worktree`。再加一条 live symlink 指向圈外目录的 `link/../x`。

### 其余归一化点

| 点 | 判定 |
|---|---|
| `./`、多余 `/` | [ok] `normalize` 折叠后，live symlink 的 `link/./x`、`link//x` 仍落到 `link/x` 再 `lstat`/`realpath` |
| 大小写不敏感 FS | [ok] 祖先 `realpath` + `path.relative`；sibling `${cwd}-evil` 不因前缀放行（B-4 已改） |
| NUL | [ok] 实际写：Node 22 `fs` 对嵌入 NUL 抛 `ERR_INVALID_ARG_VALUE`，写不出去。分类器可能把带 `\0` 的字符串标成圈内，属误标不是出圈写 |
| `~//foo`、`$HOME//foo` | [warn] `join(homedir(), "/foo")` 仍丢家目录，落到 `/foo`（碰巧圈外 S3，不是正确展开） |

---

## ② B-1…B-11 处置

| id | 判定 | 证据 |
|---|---|---|
| B-1 `wait_exit_then_kill` 竞态 | [ok] | `armWaitExitThenKill` 抽成函数；result 早到只记 `pendingResultExitCode`；`ownershipEstablished` 对非 `kill_on_result` 对称 `armWaitExitThenKill`（`executor.ts:200-217,253-258,274-281`）。新测：result 后再 `ownershipEstablished`，等待 ≥4500ms；cursor 缺省仍立即收（`<2000ms`） |
| B-2 jq 不在 PATH | [ok] | `execFile("/bin/bash", …, { env: { PATH: "/nonexistent" } })`；`r.stdout === CLAUDE_HOOK_DENY_STATIC`；`r.code === 2`（`tier1-gate-socket.test.ts:249-261`）。绝对路径 bash，空 PATH 仍能起脚本 |
| B-3 `~/` 展开 | [ok] | `join(homedir(), p.slice(2))` / `$HOME/` 同法；测试断言 abs 等于 `join(homedir(), ".bashrc")` 且不是 `/.bashrc`。残留见上 `~//foo` |
| B-4 worktree 为 `/` | [ok] | cwd 为 `/` 或空 ⇒ unresolvable；`path.relative`；sibling `${cwd}-evil` 期望 `delete_data` |
| B-5 圈外 Read | [ok] | 圈外/判不出 Read ⇒ `{kind:"delete_data", target:"read-outside-worktree"}`；`computeRisk` S3（测试有断言）。脚本 `path_outside`：Write `/etc/x`、Read `/etc/hosts` 在桩 `{permission:"allow"}` 下仍 deny（`tier1-gate-socket.test.ts:336-361`） |
| B-6 provisionHooks / 缺 hooks | [ok] | `provisionHooks` 写 `join(gate.dir, "gate-claude.sh")` + `buildClaudeGateScript`，不用 cursor `gate.sh`。`buildClaudeArgv` 缺 `settingsJson`、`"{}"`、空 `hooks` 抛错。测试断言 `filesWritten[0]` 匹配 `gate-claude.sh$` 且 `endsWith("gate.sh")===false` |
| B-7 插值转义与整数 | [ok] | SOCK/LOG 走 `bashSingleQuoted`（`'` → `'\''`）；`assertPositiveInt`（非整数 / `<=0` / `>3600` 抛错）。未知 tool 改 `emit_fail`（静态 deny + exit 2）。`emit_deny` 的 jq 失败回落静态 JSON + exit 2。测试：`bash -n` 覆盖 `'` / 换行 / `$()` / 反引号；`jq --arg` 反例 `a'$(whoami).ts` 原样到桩。弱项：引号用例只跑 `bash -n`，未跑带毒 SOCK 的真 curl |
| B-8 测试锚 | [ok] | `timeout 1 cursor-agent -p` S3；路径非 string（`1`/`null`/`42`）；gate-socket 两条桩 allow 仍 deny；jq `--arg` 反例。file-tool 表仍 `>=36` |
| B-9 cursor canary | [ok] | `checkCanaries` 仍是 `shellStarted > gateSeq`（`executor.ts:608-621`），patch 未改 trip 条件。左值增量仍 `canaryLeft === "shell_started" && isCursorShellToolCall`（`:1219`）。cursor `canaryLeft:"shell_started"` |
| B-10 evidence / 脱敏 | [ok] 主体 | evidence 工作目录改为 `<clone>`；uv 缓存改为 `~/.cache/uv`；EXPECTED B-15 去掉 `sk-` 字面量；`init.jsonl` `permissionMode` 改为 `default`。残留：`run.sh:1078` 仍是 `ANTHROPIC_API_KEY":"sk-invalid-spike"`（evidence 已自报）；HANDOFF「返工末码」写 `56f0731`，未反映用户点名的后两提交 `2d7e363` / `0642260` |
| B-11 `.env*` | [ok] | `SENSITIVE_FILE_BASENAME_RE` 改为 `\.env[^/]*$`（整正则 `i`）；测试覆盖 `.env` / `.envrc` / `.env.local`；`tokens.css` 仍不敏感 |

B 级原清单没有仍标 [fail] 的项。B-7/B-10 的缺口降为 C。

---

## ③ 返工是否引入回归

**未发现 cursor 路径或既有期望被改。** 依据是 patch 文本，不是本会话测试输出。

| 锚 | 判定 | 证据 |
|---|---|---|
| cursor argv | [ok] | `cursor.ts:15-19` 仍是 `-p --force --trust --output-format stream-json`；`tier1-cursor-backend.test.ts` 快照未改；rework patch 不含 `cursor.ts` |
| cursor 解析 | [ok] | `parseLine` 仍包 `parseCursorLine`；started shell 期望 `tool: "started"` 未动 |
| `kill_on_result` | [ok] | `cursorBackend.finishPolicy === "kill_on_result"`。result 分支：`kill_on_result` 仍是「已 ownership ⇒ `finish`，否则只记 pending」。`ownershipEstablished` 里 `else armWaitExitThenKill` 仅非 cursor 策略 |
| canary 左值 / trip | [ok] | cursor `canaryLeft:"shell_started"`；`checkCanaries` 正文未改 |
| `wait_exit_then_kill` 定时器不对 cursor 生效 | [ok] | 缺省 `realAgentSpawner()` = `cursorBackend()`；新测后半断言 cursor hang 在 2s 内以 exit 0 收，不会等 5s |
| 既有 223 cmdEffect 期望 | [ok] | patch 只给 `w54aCmdEffect` **追加**一行 `timeout 1 cursor-agent -p`；既有 describe / plan / review 表未见期望改写 |
| 既有 executor 测试期望 | [ok] | patch 只在 `real agent spawner 终态判定` **追加**一个 `it`；原 `subtype=error` 例仍 `toEqual({ exitCode: 1 })` |
| `parseClaudeLine` | [ok] | `backends/claude.ts` 零命中 |
| Gate 0 / 主流程 / gateServer | [ok] | patch 未改 `gateServer.ts` / `config/types.ts` / `checkCanaries` 正文 |

`AgentSpawner.spawn` 对 claude 现在强制 `settingsJson`+hooks。这是 B-6 要的 fail-closed。本批认领主流程仍不接 claude backend，缺省 cursor 不受影响。

---

## A 级

### A-2 · `normalize()` 先于 `lstat`：`..` 穿过 live symlink ⇒ 圈内 allow

见①。影响与评审 1 A-1 相同：分类器给出 `write_worktree`，W5.4-b 按 v3.1 对圈内非敏感写显式 allow，Claude 对圈外写的第二层被拆掉。前置 `ln -s . link` 在 cmdEffect 是 S1 自动放行，不需要先有一条指向圈外的 symlink。

脚本 `*..*` 不能当作本项已修。测试未钉死该反例。

---

## B 级

本轮原 B-1…B-11 无未闭环项。新观察（不挡 A-1 结论，但 W5.4-b 前要处理）：

### B-12 · `path_outside` 是词法前缀，不是 realpath

`gateScript.ts:142-156`：绝对路径只比 `"$root"|"$root"/*`。macOS 上 cwd=`/tmp/wt`、Claude 若把 `file_path` realpath 成 `/private/tmp/wt/a.ts`，脚本会 **假 deny**（fail-closed，不是出圈）。活 symlink `cwd/link/file` 不含 `..` 时脚本当圈内，靠 daemon `fileToolToEffect` 拦——这正是为什么分类器不能留 A-2。

B-5 测试用 `/tmp/wt` 与 `/tmp/wt/a.ts` 字面一致，覆盖不到 `/tmp` vs `/private/tmp`。

---

## C 级

- HANDOFF「评审 1 返工末码」写 `56f0731`，与用户点名链 `6313766` → `56f0731` → `2d7e363` → `0642260` 不一致；evidence §8 只列前三（证据提交不自指，合理），指针仍偏旧。
- `run.sh:1078` 仍含 `sk-invalid-spike`；EXPECTED 已改。evidence 已自报。
- `~//foo` / `$HOME//foo`：`join` 第二段绝对路径丢家目录，碰巧 S3。
- 悬空第二例硬编码 `/tmp/missing-file`：若该路径已存在，则不是 dangling，期望 `reason:"dangling_symlink"` 会红。应用临时唯一目标。
- 判不出 Write 仍是 `target:"unresolvable"`，不是方案字面 `{target:"write-outside-worktree", reason:"unresolvable"}`。dangling 才带 `reason`。W5.4-b 按字面 grep `reason` 会漏 unresolvable。
- `provisionHooks.extraArgs` 仍带 `--settings`，`buildArgv` 也已注入。W5.4-b 若拼接 extraArgs 会双份。
- `init.jsonl` 已改 `permissionMode:"default"`，`tier1-claude-backend.test.ts` 的 init 例未断言该字段。
- B-7 毒 SOCK 只 `bash -n`，未跑 runtime curl。
- 评审 1 C：`backends/types.ts` 自写 `AdapterKind`，本轮未动。

---

## A-01…A-10 对账（相对评审 1）

| 77 条 | 本轮 | 判定 |
|---|---|---|
| A-01 祖先 realpath；判不出 S3；断链/新文件 | 悬空两种真 symlink [ok]；**`..` 穿过 live symlink 仍假绿** | [fail] 见 A-2 |
| A-02 圈外写无 S2/allow | Write 圈外 `delete_data` | [ok] |
| A-03 失败路径 deny+exit 2 | jq 缺失现真走到静态 printf | [ok] |
| A-04 matcher `*` | 未改 | [ok] |
| A-05 禁止 `parseClaudeLine` | 源码零命中 | [ok] |
| A-06 B3 不 INSERT | patch 未引入落库 | [ok] |
| A-07 B-9 不停批 | `ownershipEstablished` 已对称启动 5s 定时器 | [ok] |
| A-09 圈外只读 S2 | 未改形状；`timeout 1 cursor-agent -p` 已补 | [ok] |
| A-10 取消零行为变化；canary 分 backend | cursor trip 条件未改 | [ok] |

---

## 返工最小集

1. **A-2 必修：** 禁止在跟随 symlink 之前词法折叠 `..`（拒 `..` 分量，或按分量 `realpath` 后再应用 `..`）。测试必须真建 `symlinkSync(".", join(cwd,"link"))`，Write `link/../leaked.txt`，期望 S3 `delete_data`，不得 `write_worktree`。
2. B-12 可留 W5.4-b：`path_outside` 与 `fileToolToEffect` 对齐，或明确脚本只做粗滤、圈判定单源在 daemon。
3. C 择要：HANDOFF 末码、`run.sh` 凭据字面量、`/tmp/missing-file` 唯一化。

未复跑：`just ci`、vitest、cmdEffect 双版本降档扫描。evidence 自称返工后 file-tool 12 / cmd-effect 251 / gate-socket 21 / claude-backend 17 / executor 38 / tsc 0，本会话不当作已验证。