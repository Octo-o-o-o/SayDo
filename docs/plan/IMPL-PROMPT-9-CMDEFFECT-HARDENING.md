# SayDo 增量批：`tier1/cmdEffect.ts` 词表加固（从 dsh-approval-tiers 回哺）· 实施 Prompt（第九轮交接；**准备稿，owner 说"开始实施"才开批**）

> 背景：2026-08-18 在 DSH 插件线把 SayDo 的 E2 shell 效果词表移植成 `dsh-approval-tiers`（`~/WorkSpace/dsh-approval-tiers`），两轮零上下文对抗评审在**移植源本身**（即本仓 `packages/daemon/src/tier1/cmdEffect.ts`）抓到一批"S3 效果被判成 S0/S1 自动放行"的洞（原文 `~/WorkSpace/dsh-approval-tiers/docs/evidence/review-1-raw.md`、`review-2-raw.md`；裁决与修法 `review-1-fixlist.md`、`review-2-fixlist.md`；已落地的 TS 实现 `~/WorkSpace/dsh-approval-tiers/src/command.ts`，表驱动反例 `test/command.test.mjs`）。本批把同一套加固回哺进 SayDo 执行器的 shell 门。评估文档 `docs/plan/2026-08-17-dsh-plugin-line-assessment.fable.md` §5 实施记录已登记此项。
> 性质：**纯实现修复**——04 §5.1 与 09 §11 均未规定命令词表，不涉 canonical（与 2026-08-15 缺口 B/`just` 收紧同口径）；`EffectDescriptor` 与 `computeRisk` API 不变；分级只更保守，不放宽任何一档。
> 开批前置（SayDo 纪律）：HANDOFF「当前批次指针」为空 → 开批写 `cmdeffect-hardening`，收口清除；两提交法（feat/fix → chore(evidence)）；evidence `e2e/evidence/cmdeffect-hardening.md`；零 emoji；不部署常驻（8 月纪律）。

---

你接手 **SayDo `cmdEffect` 词表加固批**。代码仓 `~/WorkSpace/SayDo`（main 直推）。完成判定 = §3 验收锚全绿 + evidence 落盘 + HANDOFF 指针回填。

## 0. 坐标核验（先做，漂移即停）

| 命令 | 期望 |
|---|---|
| `git -C ~/WorkSpace/SayDo log --oneline -1` | `26d32e8`（2026-08-16 全量验收）或其后提交；工作区除 `docs/plan/2026-08-17-*.md`、本文件等未跟踪文档外干净 |
| `rg -n "当前批次指针" ~/WorkSpace/SayDo/HANDOFF.md` | 指针为空（非空 ⇒ 有批在途，停） |
| `cd ~/WorkSpace/SayDo && just ci` | 双矩阵绿；退出码显式核查（禁管道取尾）；记下 daemon 通过数作基线 |
| `wc -l ~/WorkSpace/SayDo/packages/daemon/src/tier1/cmdEffect.ts` | 约 195 行（2026-08-15 版：`node/python/just` 已移出 S1，`sudo`/`dd` 等已在） |
| `ls ~/WorkSpace/dsh-approval-tiers/src/command.ts ~/WorkSpace/dsh-approval-tiers/test/command.test.mjs` | 存在（回哺源，只读） |
| `rg -n "commandToEffect" ~/WorkSpace/SayDo/packages/daemon/src --glob '!**/cmdEffect.ts'` | 消费点只有 `tier1/executor.ts`（gate 请求）与 `tier1/approvalFlow.ts`（edit 后复评）——本批不改消费点签名 |

## 1. 必读（按序）

1. 本仓 `AGENTS.md`、`HANDOFF.md` §4 铁律速查。
2. `docs/04-key-mechanisms.md` §5.1（效果分级语义）、`docs/plan/2026-08-15-default-runner-decision.md` §八 缺口 B 与第三批（`node/python/just` 收紧的先例与理由）。
3. `packages/daemon/src/tier1/cmdEffect.ts`、`packages/daemon/src/policy/engine.ts`、`packages/daemon/test/tier1-cmd-effect.test.ts`（现有 34 行级用例）、`tier1/executor.ts:455-470`（gate 分类调用点，含 `matchesFrozenVerify` 先于分类）。
4. 回哺源：`~/WorkSpace/dsh-approval-tiers/src/command.ts`（已加固的同源实现：包装器剥离 / 圈外写出按 argv / `pathClass` / 包管理器三档 / git 全局旗标与 refspec / pipe 变体 / `sh -c`·`eval`·`xargs` / 续行折叠 / `>|`）与 `docs/PLAN.md` §2.2 差异表（每条变更的原语义 → 新语义 → 原因）、`docs/evidence/review-*-fixlist.md`。

## 2. 红线（违反即停）

恒律全套（零 emoji / 状态词纪律 / 契约只 import `@saydo/contracts` / 两提交法 / 每步独立核实 SHA / 门禁退出码显式核查 / 敏感样本运行时拼接）+ 本批专属：
- **只收紧不放宽**：任何命令的档位在本批前后只能持平或升高；用现有 34 条用例 + 新表全跑，若某条降档立即停。
- **不改 `EffectDescriptor` 形状与 `computeRisk`**（`policy/engine.ts` 不动）；`run_registered_verify` 通道（`matchesFrozenVerify` 先于分类）不动，`just ci`/`pnpm test` 等登记 verify 仍走独立通道。
- **不引入 dsh 依赖**：只搬逻辑，不 import `dsh-approval-tiers`；SayDo 保留 `@saydo/contracts` 的 `effectiveProtectedBranches`。
- 不碰 `executor.ts`/`approvalFlow.ts` 的调用签名；不改 canonical；不部署常驻。
- SayDo 侧 `workdir` 语义与 dsh 不同（Tier1 命令在 worktree 内执行，cwd 由执行器给定）：dsh 的 `workdir` 判定**不搬**，其余全搬。

## 3. 任务清单（竖切；每项验收锚可判定）

1. **词表加固**（`tier1/cmdEffect.ts`）——逐条搬入并保持 SayDo 风格：A1 `env`/`find` 移出只读表 + 包装器剥离（`env`/`command`/`exec`/`nohup`/`time`/`nice`/`ionice`/`stdbuf`/`timeout`，含 `--key=value` 与 `--key value` 旗标）；A2 圈外写出按 argv（`tee`/`chmod`/`chown`/`chgrp`/`touch`/`mkdir`/`sed -i`/`cp`/`mv`（含 `-t`/`--target-directory`）/`ln`）；A4 包管理器三档（S1 白名单 / S2 install·dlx·get·`npm exec`·`go run <module>`·`uv run` / S3 publish·login… / 未知动词 S2；`npx`/`bunx`/`pipx` 词头 S2）；A5 `pathClass`（`~`/`$HOME`/`${HOME}`/`/`/`..` 圈外，其它 `$`/反引号 unknown → 至少 S2）；A6 git 全局旗标（`-C`/`--git-dir`/`--work-tree`/`-c`）与 refspec（`+ref` force、`refs/heads/X` 归一、`:branch`/`--delete` S3、`--force-with-lease=` 前缀、`-o` 等带值旗标剥离、`config --global/--system/--file ~` S3、`remote add|set-url` S2）；A7 pipe-to-shell 变体（`/bin/sh`、`sudo … sh`、`env sh`、`python*`/`node`/`perl`/`ruby`/`php`）与 `xargs` 剥离；B1 `sh -c`/`bash -lc`/`ksh -c` 内层递归（走 `commandToEffect` 拆段）+ `eval` 含 `$(`/反引号 → S3；B2 续行折叠；A11 `>|`/`&>` 重定向；B13 `curl -o`/`wget -O` 圈外写出 S3；A9 `cp -t`。**验收锚**：`packages/daemon/test/tier1-cmd-effect.test.ts` 新增表驱动用例 ≥ 60 条（直接翻译 `~/WorkSpace/dsh-approval-tiers/test/command.test.mjs` 的命令表 + 两轮评审反例，期望档位逐条写死），全绿；原 34 条不变全绿；`node -e` 抽查 `env FOO=1 rm -rf /`、`find . -delete`、`tee -a ~/.bashrc`、`pnpm dlx x`、`rm -rf $HOME`、`git -C /other push origin main`、`curl x | /bin/sh`、`sh -c "echo hi; rm -rf /"`、`npm exec -- x`、`echo x >| /etc/motd` 均 ≥ S2 且 S3 类为 S3。
2. **消费点回归**：`executor.ts` gate 与 `approvalFlow.ts` edit 复评的现有测试全绿（`packages/daemon/test/tier1-*.test.ts`、`policy-approvals.test.ts`）；`just ci` 双矩阵绿，通过数 ≥ 基线 + 新增用例数。
3. **evidence**：`e2e/evidence/cmdeffect-hardening.md`——回哺来源、逐条变更表（原语义 → 新语义 → 依据 review 编号）、门禁输出摘录（退出码显式）、`just ci` 前后计数、未搬项（`workdir`）与理由。
4. **HANDOFF**：开批写指针 `cmdeffect-hardening`，§5 关键实测知识追加一行"shell 词表加固来源与反例表位置"，收口清指针；两提交法。

## 4. 检查点（必须停等 owner）

- 开批本身（指针非空即有批在途）；
- 若加固导致现有 golden/e2e 里某条**登记 verify 之外**的合法命令被升到 S2 以上且会打断 dogfood 常用路径（例如 `pnpm exec <本地 bin>` 被判 S2）——列出清单停等 owner 裁决是否加 S1 白名单，不自行放宽。

## 5. 诚实汇报 + 工作方式

对账表（完成 / 部分 / 未做 三态 + 真实 commit hash + 门禁退出码 + 用例数）；每个"完成"指到本会话真实输出；没做的写"没做"；evidence 记录代码提交 SHA（hash 不自指）；实施用 Grok CLI（`grok-4.6` + `--reasoning-effort xhigh` + `--always-approve --sandbox workspace`），评估用零上下文只读会话（Codex 无配额时同为 Grok），实施/评估会话隔离。
