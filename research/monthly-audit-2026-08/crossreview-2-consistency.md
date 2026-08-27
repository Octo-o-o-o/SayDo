# 2026-08-27 月度审计修复批 · 零上下文全局一致性交叉复审（第 2 路）

- 复审时点:2026-08-27;复审对象 = 月度审计修复批后的 main(`HEAD = 596a030`,工作树 clean,领先 `origin/main`(=`12ba011`) 6 个 commit)
- 复审性质:只读;所有结论均有本会话真实命令输出为证
- 分级:**A = 3、B = 2、C = 5**

---

## 一、A 级(新矛盾 / 关键遗漏)

### A-1 · rc.4 发布说明未获同批「404 历史注」——rc.2/rc.3 已注、README 保留规则明列 rc.4,同类修复漏掉三分之一

938ee8a 给 `docs/release/v0.1.0-rc.2.md` 与 `v0.1.0-rc.3.md` 各加了历史注(diff 实读):

> `> 该候选从未产生 GitHub Release(首次 Actions 失败),下方安装命令的固定 URL 是 404——本文按发布纪律作为历史记录保留,不是可用的安装指引。当前可用版本见 [v0.1.0-rc.12.md](v0.1.0-rc.12.md)。`

同批给 `docs/release/README.md` 成文的保留规则**明确点名 rc.4 属保留文件**:

> `**被证据账本 cross-link 引用的版本说明留存**(rc.2/rc.3/rc.4),**其余随 bump 改名**——因此仓内只有 rc.2/rc.3/rc.4 + 当前版 rc.12 共四份`

而 rc.4 与 rc.2/rc.3 同罪——HANDOFF §1.1(本批改过的行)明写:

> `rc.4–rc.7 死于 publish 前校验/质量门,从未创建 Release`

但 `docs/release/v0.1.0-rc.4.md`(20 行)**零标注**,通篇仍是现行安装指引口吻(「这是面向 macOS、Windows 与 Linux 的预发布快速启动包……运行:npm exec --yes --package=https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.4/…」),该 URL 与 rc.2/rc.3 一样是 404。

证据:
- `git show --stat 938ee8a` 31 文件清单含 `v0.1.0-rc.2.md`/`v0.1.0-rc.3.md`(各 +2)而**无** `v0.1.0-rc.4.md`
- `grep -n "404\|历史记录保留\|不可用\|从未" docs/release/v0.1.0-rc.4.md` → 无匹配(exit 1),`wc -l` = 20
- rc.4 之外全仓再无「把 rc.4 当现行版」的活跃文档:`grep -rn "rc\.4"` 逐文件清点,其余命中均为历史时点文档(faststart 计划/评审、prompts/、e2e evidence、journal/台账)或已加历史括注的行;`deploy/`、`README.md`、`AGENTS.md`、`justfile`、`scripts`(仅 `test-mobile-release-contract.mjs` 的反例 fixture 与「已修假红」注释)、`release-profile.yaml`(rc.12)、`version-matrix.md`(2026-08-27 更新,rc.12 available)均干净

### A-2 · HANDOFF §1.1 权威坐标行「活动树 HEAD 应读作 9417b6d」已过时 11 个 commit,本批改过该行却未刷新、未标注,R114 修复清单亦未提

`HANDOFF.md:50`(自称「当前坐标唯一以本行为准」的 2026-08-26 快照行)行尾现文:

> `本行其余坐标(活动树/公开/RC 链/常驻)在 2026-08-27 的返工合并后应读作:活动树 HEAD = 9417b6d,其余不变。`

实测(本会话):
- `git rev-list --count 9417b6d..HEAD` = **11**;`git rev-list --count 12ba011..HEAD` = 6
- `git rev-parse origin/main` = `12ba011…`——快照行主文「活动树 HEAD = c383bc0(= origin/main)」与修正尾注「应读作 9417b6d」按**任一读法都对不上** origin/main(12ba011),更对不上本地 HEAD(596a030)
- `git show 938ee8a -- HANDOFF.md` 证明本批**编辑了这一行**(rc.4-rc.9 归因精确化),陈旧尾注原样保留;`grep -c "596a030\|938ee8a" HANDOFF.md` = 0
- journal R114「文档修复清单」逐项通读,只有「HANDOFF §1 头部 08-23 块降级历史段、rc.4-rc.9 归因精确化、新增硬教训第 3 条」,无坐标行刷新或「待推送后刷新」的标注

月度审计的主题恰是坐标与现势一致性,本批自己新增 6 个 commit 使该行更陈旧,却未按其自身惯例(每次刷新都新增快照行或补「应读作」尾注)处置——属关键遗漏。若属「等推送后统一刷新」的有意安排,也没有任何文档写下这一安排。

### A-3 · R114 称 evidence 分支「随后删除」——与 R113「刻意不删」直接矛盾,且分支实际仍存在

`history/PROCESS-JOURNAL.md` R114 收敛动作节原文:

> `codex/week-audit-evidence-20260823 分支唯一独有 commit(6624299 冻结账本)的三处增量(冻结 SHA/活跃文档 96/tgz 摘要)逐条确认已被 main 吸收且超越,分支按 R113 裁决不合并、随后删除。`

而 R113(同文件,90 行之前)原文:

> `保留的 4 个分支中,codex/week-audit-evidence-20260823 有 1 个未并入提交且刻意不删:它是 2026-08-23 周审计账本的冻结快照(49,684 行),main 上虽有更新版本,但这个冻结点只存在于该分支,删了不可恢复。是否归档由 owner 定。`

git 现状(本会话):
- `git branch -vv` 列出 `codex/week-audit-evidence-20260823 6624299` ——**分支存在**
- `git reflog show --date=iso codex/week-audit-evidence-20260823` 仅两条(08-23 08:40 创建、08:54 commit),**无删除/重建痕迹**
- 远端亦无同名分支(`git branch -r` 仅 origin/feature/focus-contract-v0、origin/main、public/*)

即 R114 的「随后删除」是不实陈述(无论解读为「已执行删除」还是「R113 裁决了删除」都与事实相悖),且与 R113 的「刻意不删、归档待 owner 定」互相矛盾。注:两处对独有 commit 价值的定性也相反(R113「冻结点只存在于该分支,删了不可恢复」 vs R114「已被 main 吸收且超越」),需随更正一并裁决哪个是终论。

---

## 二、B 级(次要遗漏 / 留尾巴)

### B-1 · console 源码两处注释仍引「11 §5.1 登记」,§5.11 改号后指向了按钮节

- `packages/console/src/components/redesign/TaskCard.tsx:1`:`状态 chip 用既有 StatusChip 单源(11 §5.1 登记)`
- `packages/console/src/components/redesign/AttentionItemCard.tsx:1`:`AttentionItemCard(demo .attn-item 四色收件箱条目,11 §5.1 登记组件)`

938ee8a 把 docs/11 的「三面一栏新组件登记」从 §5.1 改号为 §5.11(与按钮节撞号),文档侧内查已自洽(docs/11:354 的「§5.1 危险确认纪律」实指按钮节 §5.1,其中确有危险确认纪律,正确),但改号只扫了 md,未扫源码注释——上述两处现在字面指向「§5.1 按钮」。全仓 md 侧其余「docs/11 §5.1」引用仅剩两处历史文档(见 C-2)。

### B-2 · R113 说「保留 3 个 worktree」,现只剩 2 个——第三个的移除无任何记录

R113 原文:`保留的 3 个 worktree = 主工作区 ~/WorkSpace/SayDo、main 的 checkout(SayDo-rc4-runtime-final-reimplementation-20260824)、.claude/worktrees/trusting-panini-f5d41b`。

本会话 `git worktree list` 只有 2 个(主树 @ main、trusting-panini @ 911ce95);`ls ~/WorkSpace/SayDo-*` 下该目录已不存在(仅剩 R113 明文保留的独立 clone `SayDo-rc4-review-clean-v3.zkC5HW`)。R114 通篇未记这次移除。方向是收敛(且与本次复审任务书的预期终态一致),但台账链断了一环。附:R113「未处置」还记载主工作区停在 faststart 分支 dirty 76 项,现主工作区已在 main 且 clean——该转变可由 R114「284 个未入库/漂移文件逐一定向」间接覆盖,但「切回 main」这步同样无明文。

---

## 三、C 级(观察)

- **C-1 · R114 两个总量数字真实但未注口径**:「585 个 commit」在合并收敛点精确复现(`git log --since=2026-07-27 --oneline f723ab7 | wc -l` = 585;现 HEAD 为 588,差值恰为其后 3 个修复 commit);「1009 份月内动过的 md」须加 `--all`(含分支)才复现(`git log --all --since=2026-07-27 --name-only … | sort -u` = 1009;仅 main = 989)。数字都对,但不写口径就难复核。
- **C-2 · 两处历史文档保留旧「§5.1 新组件登记表」引用,属合理**:`HANDOFF-前端组件化施工交接.md:13`(文件头部有「已交付归档(2026-08-09)…仅留痕,不再是活合同」横幅)与 `docs/plan/2026-08-13-ui-standardization-audit.md:180`(任务书已豁免)。
- **C-3 · 修复批止于本地**:main 领先 origin/main 6 commit,公开快照未推、公开仓 CI 红灯待「推送后确认转绿」——R114 已自认为后续步骤,非遗漏,但在推送前 HANDOFF/账本对外读者拿不到这 6 个 commit。
- **C-4 · 「5.11」出现同名异物**:docs/11 新 §5.11(组件登记)与 PLAN-2 W5 的「5.11 篮」(订阅限流等杂项篮)编号相同;现有引用均带前缀(「11 §5.11」 vs 「5.11 篮」)可区分,暂无实际混淆,留意后续引用纪律。
- **C-5 · owner 待决八项核对无误**:R114 待决清单与实况相符(抽验:IMPL-15 §3.5 第 2/3 条确无书面确认;ADR-002 已带 2026-08-21「状态更正」节,余下只是 owner 确认动作)。均为已登记的旧账,非本批新遗漏。

---

## 四、门禁与测试全景(任务 2)——全绿

| 检查 | 结果(本会话实跑) |
|---|---|
| `node scripts/week-audit.mjs --check` | `[ok] week audit ledger verified: main=115 all_refs=131 extra=16 paths=434 docs=219`,exit 0 |
| `node scripts/check-doc-links.mjs` | `[ok] active document links: files=114 broken=0`,exit 0 |
| `node scripts/check-public-tree-privacy.mjs --fs` | `[ok] public-tree-privacy scanned=1868 binary=108 excluded=8 hits=0`,exit 0 |
| `bash scripts/check-emoji.sh` | `[ok] emoji gate: clean`,exit 0 |
| `git status --porcelain | wc -l` | 0(工作树干净) |

## 五、逐任务核验记录

**任务 1(改 A 未改 B)**:
- (a) §5.1→§5.11:文档侧自洽(docs/11 内查 + 全仓 grep「三面一栏 / 11 §5.1 / §5.1 新组件」),漏网 = 源码注释 2 处(B-1);历史文档 2 处合理保留(C-2)。
- (b) rc.4 口径:活跃文档仅剩 `v0.1.0-rc.4.md` 本体呈现现行安装指引(A-1);version-matrix/release-profile/README/deploy 均已 rc.12。
- (c) runtimeSha:docs/09(990/1030/1591 行)三处均为废止表述;capture 方案(138/437 行)两处均带「分叉已消除(2026-08-27 注)」;代码侧 `packages/contracts/src/runtime.ts:128-132` `runtimeProtocolCompatible` 只比 major,`grep "runtimeSha ===\|!=="` 全仓零命中——runtimeSha 仅作上报别名字段(runtimeIdentity.ts / index.ts:861-864 / recoveryOnlyServer.ts:400),无判据用法。**docs↔code 一致,干净**。
- (d) HANDOFF §1.1 HEAD 快照:未刷新、未标注(A-2)。

**任务 3(月审覆盖)**:585 复现(见 C-1);canonical 抽查 4 份——docs/07(Node 22+ ↔ `package.json engines >=22`/cli `>=22 <23`,一致)、ADR-002(自带 08-21 状态更正节,现势自洽)、ADR-003(承诺的 `packages/platform` 实存)、docs/08 §6(2026-08-08 IA 修订注与 938ee8a 重写的 docs/11 §3 外壳段互文一致;全 docs 无残留「1200px」「surface-raised 侧栏」旧口径)。未见 R114 之外的明显陈旧断言。

**任务 4(HANDOFF/PLAN-2 自洽)**:下一批指针一致(HANDOFF §1.1「下一批 = ai-supply」↔ PLAN-2 §1 `ai-supply` 节存在,含方案/决策单 SHA-256 锚);W5.4-b 收口 SHA 两处同为 `9417b6d`(代码 `8941e1c`);PLAN-2 头部声明「三层坐标唯一以 HANDOFF §1 快照行为准,不复制第二套」——因此 A-2 的陈旧快照行是唯一坐标源失真,无第二处互相矛盾的坐标句。

**任务 5(worktree/分支收敛)**:worktree = 主树(main @ 596a030)+ trusting-panini(@ 911ce95)共 2 个;本地分支恰 4 个(main、claude/trusting-panini-f5d41b、codex/week-audit-evidence-20260823、codex/week-audit-faststart-20260822)。`git cherry main <branch>`:panini = 0、faststart = 0、evidence 仅 `+ 6624299`(任务书预期例外,R113 裁决不并)。**拓扑与预期完全一致**;唯 R114 对该分支的叙述失实(A-3)、第三 worktree 移除无记录(B-2)。
