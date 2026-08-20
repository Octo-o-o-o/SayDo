# 85 · W5.4-a 批 评审 3(A-2 复核;Grok grok-4.6 xhigh 只读;Codex 配额耗尽回落)

> prompt:`prompts/85-w54a-claude-cli-review-3.md`;session `01a01b91-411b-7560-a6bc-af41d6429392`;调度方沙箱外 `just ci` EXIT=0(contracts 103 / cli 19 / console 253 / daemon 1592|4 / python 33)。

先读评审 2 报告、返工 diff 和必读源码，再按 A-2 / lint / 回归三项逐条对账。评审 2 和核心源码已拿到。接着读返工 patch、HANDOFF、cmdEffect 期望和相关回归锚点。patch 前半已对上。接着核调用点、cmdEffect 223、凭据字面量、gate 脚本和剩余绕过面。对照评审 2 的 A-2、返工 patch 和当前 `fileToolEffect.ts` / 测试全文后，A-2 已按分量在 `normalize` 之前拒绝，要求的真 symlink 用例也在。下面按 ①②③ 给结论。

# 85 · W5.4-a 批 评审 3（A-2 复核；零上下文只读；Grok 回落）

> 对照：评审 2 `research/codex-findings/84-w54a-claude-cli-review-2.md`；返工 diff `.tmp/rework2-diff.patch`（自称 `git diff 0642260..HEAD`；两提交 `54b981c` / `a6a79ec`）。  
> 范围：只读 `read_file` / `grep` / `list_dir`。本会话 **未** `git log`、**未** 跑 vitest / `pnpm lint` / `just ci`。下文 SHA 来自用户点名与 HANDOFF/evidence/patch 原文，**未**独立核哈希。

---

## 总评

**可并入** [ok]

评审 2 的 **A-2 已真正修好**：`resolveFileToolPath` 在 `normalize()` / `lstat` 之前按 `/` 分量检查 `..`，命中即 `{dotdot:true}` ⇒ Write `delete_data` / `write-outside-worktree` / `reason:"dotdot"`（`computeRisk` 基线 S3）。相对路径拼接从 `path.join` 改成字面拼接，避免 `join` 先把 `..` 折掉。测试真建 `symlinkSync(".", link)`，Write `link/../leaked.txt` 与圈外 live symlink `outlink/../x` 均为 `delete_data`。`./..`、`link/.././x`、反斜杠在算法上同样命中分量检查；URL 编码不是这条词法预折叠洞。

lint 无用 `\$`、run.sh 凭据字面量、HANDOFF 代码末码、`/tmp/missing-file` 唯一化均已落地。`src/../src/a.ts` 改为 S3 是声明过的保守收紧；cmdEffect 文件不在本 diff；file-tool 其余期望未改。B-12 仍在、按计划留 W5.4-b，不挡本轮并入。

---

## ① A-2 是否真正修复

**是** [ok]

### 修法（分量检查先于 `normalize`）

`packages/daemon/src/tier1/fileToolEffect.ts`:

```40:59:packages/daemon/src/tier1/fileToolEffect.ts
function hasDotDotComponent(p: string): boolean {
  return p.replace(/\\/g, "/").split("/").includes("..");
}
// ...
  if (hasDotDotComponent(path)) return { dotdot: true };
  const expanded = expandUser(path.trim());
  if (expanded === "unresolvable") return { unresolvable: true };
  if (hasDotDotComponent(expanded)) return { dotdot: true };
  // ...
    abs = `${cwd.replace(/[/\\]+$/, "")}/${expanded}`;
  if (hasDotDotComponent(abs)) return { dotdot: true };
  abs = normalize(abs);
```

三道检查分别打在：原始 path、`expandUser` 之后、与 cwd 字面拼接之后；**全部通过才** `normalize`。`fileToolToEffect` 对 `dotdot`：Write ⇒ `outsideWrite("dotdot")`；Read ⇒ `read-outside-worktree` + `reason:"dotdot"`。`policy/engine.ts:48`：`delete_data` 基线 S3，`reason` 不参与升级。

相对路径不再走 `path.join(cwd, abs)`（POSIX `join` 会词法折叠 `..`，正好复现 A-2）。cwd 自身若带 `..`，第三道检查也会拒。

这是评审 2 给出的两条修法里的第一条（拒 `..` 分量，与门脚本 `*..*` 对齐），不是按分量 `realpath` 再应用 `..`。对 `src/../src/a.ts` 这种物理仍在圈内的路径一律 S3——用户已标明这是保守收紧。

### 测试锚（真建 symlink，不是字面冒充）

`packages/daemon/test/tier1-file-tool-effect.test.ts:47-64`：

| 要求 | 落盘 | 期望 |
|---|---|---|
| `symlinkSync(".", join(cwd,"link"))` + Write `` `${cwd}/link/../leaked.txt` `` | 有 | `delete_data` / `write-outside-worktree` / `reason:"dotdot"` |
| 相对路径 `link/../leaked.txt` | 有 | `.reason === "dotdot"` 且 `computeRisk` S3 |
| 圈外 live symlink `outlink/../x` | 有（`symlinkSync(outside, outlink)`） | 同上 `delete_data` |
| 测试用字面量保留 `..`（不用 `path.join`） | 有注释 + 模板字符串 | 避免测试自己先折叠 |

本会话未跑 vitest；以上是源码里的断言，不是执行输出。

### 词法预折叠绕过面

| 形态 | 判定 | 理由 |
|---|---|---|
| `./..`、`link/./../x` | [ok] 拒 | 分量数组含 `".."` |
| `link/.././x`、`link//../x` | [ok] 拒 | 同上（空分量、`.` 不影响 `includes("..")`） |
| `link\..\x`、`link/..\x` | [ok] 拒 | 检查前 `\` → `/`；POSIX 上这是保守误拒（反斜杠不是分隔符），fail-closed |
| `~/../.ssh`、`$HOME/../etc` | [ok] 拒 | 第一道检查在 `expandUser`/`join` 之前，不会被 `path.join` 先折掉 |
| 前导空白 `"  ../x"` | [ok] 拒 | 第一道可能漏（分量是 `"  .."`），`trim` 后第二道命中 |
| `%2e%2e` / `%2E%2E` | [ok] 非本洞 | 分类器不做 percent-decode；`normalize` 也不把该字面量当成 `..`。随后若 `link` 为 live symlink，祖先链会拼出 `realpath(link)/%2e%2e/x`，那是圈内字面目录名，不是 POSIX `..` 出圈。未见 Claude `file_path` 会 URI 解码的证据 |
| 全角斜杠 / 带空白的 ` ..` | [ok] 非本洞 | 不是 POSIX 分量 `".."`，`normalize` 也不会折；最多建成怪文件名 |

`normalize` 在拒 `..` 之后仍会折叠 `.` 与重复 `/`。`link/./x`、`link//x` 仍落到 `link/x` 再 `lstat`/`realpath`，A-1 的 live/dangling symlink 路径保持有效。

门脚本 `path_outside` 的 `*..*` 仍是字面子串补偿（`foo..bar.ts` 会假 deny）。A-2 要求的是分类器单源，不再把脚本当修法。相对 `link/../x` 脚本与分类器双拒；无 `..` 的 `link/leaked.txt` 仍靠 daemon 祖先 `realpath`（A-1）。

---

## ② lint / 凭据字面量 / HANDOFF 末码 / 唯一化

| 项 | 判定 | 证据 |
|---|---|---|
| lint `gateScript.ts:147` 无用 `\$` | [ok] 源码 | `'\$HOME'*` → `'$HOME'*`。JS 模板里 `'\$HOME'` 与 `'$HOME'` 生成 bash 同为 `'$HOME'*`（字面 `$HOME` 前缀）；`'\${HOME}'` 仍需转义以防模板插值。本会话 **未**跑 `pnpm lint` |
| `run.sh` 凭据字面量 | [ok] | `spike_key="sk-"` 再 `${spike_key}invalid-spike`；`e2e/` 下已无相连的 `sk-invalid-spike`。IMPL-PROMPT / 方案正文仍有该字样，是规格叙述不是可执行样本 |
| HANDOFF 末码 | [ok] | §1 写评审 2 返工末码 `54b981cc0e38dbb4d66f8b5868761c208b3b1617`；§ 关键实测知识写 evidence §9、代码末码 `54b981c`。相对评审 2 的 `56f0731` 已更新。`a6a79ec` 按两提交法应是 chore(evidence)，evidence 写「不自指」符合 AGENTS 约定。本会话未 `git log` 核父子关系 |
| `/tmp/missing-file` 唯一化 | [ok] | `join(mkdtempSync(join(tmpdir(),"saydo-fte-miss-")), "no-such-file")` 再 `symlinkSync`。父目录存在、文件不存在，不再绑全局 `/tmp/missing-file` |

---

## ③ 是否引入回归

**未发现 cursor 路径或既有 cmdEffect 期望被改。** 依据是 patch 文件清单与当前测试源码，不是本会话测试输出。

| 锚 | 判定 | 证据 |
|---|---|---|
| `src/../src/a.ts` 现一律 S3 | [ok] 保守收紧 | 单测与表驱动第 4 行均改为 `delete_data` / `write-outside-worktree`（表行未强制 `reason`，但 kind/target 已钉死）。agent 需改用规范路径 |
| cmdEffect 既有期望（开批口径 223） | [ok] 未改 | rework2 patch **不含** `tier1-cmd-effect.test.ts` / `cmdEffect.ts`。`timeout 1 cursor-agent -p` 仍在 `w54aCmdEffect` 末行，其余表未见改写 |
| file-tool 其它期望 | [ok] 未改 | 圈内/圈外读写、新文件、无 `..` 的 live symlink `link/leaked.txt`、两种 dangling、`~`/`$HOME`/盘符、cwd=`/`、敏感基名、`tokens.css`、非字符串、chmod、表驱动其余行（≥36，现 38 行）期望与评审 2 时一致 |
| cursor argv / `kill_on_result` / canary / `parseClaudeLine` / `checkCanaries` / `gateServer` | [ok] 未改 | 本 diff 只动 `fileToolEffect.ts`、`gateScript.ts` 一行 lint、file-tool 测试、HANDOFF/evidence/`run.sh` |

`Write ../x` 表行仍只断言 `kind:"delete_data"`；现在描述符多了 `target`/`reason`，旧断言仍成立。

---

## A 级

无未闭环项。评审 2 A-2 关闭。

---

## B 级

### B-12 · `path_outside` 仍是词法前缀，不是 realpath（W5.4-b）

**未修，且本轮不该修成 A。** `gateScript.ts:142-156` 绝对路径仍只比 `"$root"|"$root"/*`。macOS 上 cwd=`/tmp/wt`、Claude 若把 `file_path` 收成 `/private/tmp/wt/a.ts`，脚本假 deny（fail-closed，不出圈）。活 symlink 不含 `..` 时脚本当圈内，圈判定单源仍是 daemon——这正是 A-2 必须在分类器里修、不能靠 `*..*` 的原因。

evidence §9 已写明：接线时不要删脚本 `*..*` 补偿，也不要把词法前缀当成 realpath 等价。B-5 测试仍用 `/tmp/wt` 与字面一致的子路径，覆盖不到 `/tmp` vs `/private/tmp`。

---

## C 级

- 本会话未跑 `pnpm lint` / file-tool 13 条 / cmdEffect / `just ci`。evidence 自报 lint/tsc EXIT=0、file-tool 12→13，不当作本会话已验证。
- 表驱动未钉 `./..`、`link/.././x`、反斜杠；算法覆盖，缺回归钉。
- `~//foo` / `$HOME//foo`：`join(homedir(), "/foo")` 仍丢家目录，落到 `/foo`，碰巧 S3。
- 判不出 Write 仍是 `target:"unresolvable"`，不是方案字面 `{target:"write-outside-worktree", reason:"unresolvable"}`。W5.4-b 按字面 grep `reason` 会漏。
- 评审 2 其余 C 本轮未动：`provisionHooks.extraArgs` 双份 `--settings`；init 例未断言 `permissionMode`；B-7 毒 SOCK 只 `bash -n`；`backends/types.ts` 自写 `AdapterKind`。

---

## 对账（相对评审 2 返工最小集）

| 项 | 本轮 | 判定 |
|---|---|---|
| A-2 拒 `..` 分量 / 禁止词法预折叠 | `hasDotDotComponent` ×3 先于 `normalize`；拼接不用 `join` | [ok] |
| 真建 `link → .` + `link/../leaked.txt` ⇒ S3 | 测试有 | [ok] |
| 圈外 live `outlink/../x` ⇒ S3 | 测试有 | [ok] |
| lint `\$` | 已删 | [ok] 源码；lint 进程未跑 |
| HANDOFF 末码 | `54b981c` 全文 | [ok] |
| `run.sh` `sk-invalid-spike` | 运行时拼接 | [ok] |
| `/tmp/missing-file` 唯一化 | mkdtemp | [ok] |
| B-12 | 登记 W5.4-b | [ok] 留作接线前置，不挡并入 |