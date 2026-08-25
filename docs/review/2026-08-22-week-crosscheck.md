# 最近一周文档 x 实施双向对账(2026-08-15 ~ 2026-08-22)

- **触发**:owner「先 commit 所有、合并全部本地分支与 worktree,再从文档对 commit、从 commit 对文档,逐条比对实施是否合理/标准/正确,有无疏漏与不一致;可判断的直接修」。
- **对账基线**:合并提交 `4d2824e`(main);对账范围 = `--since=2026-08-15` 的全部提交与被其触及的 138 份 markdown。
- **三级词表**:[ok] 本会话真实命令或 file:line 实证 / [warn] 差距如实 / [fail] 未做。
- **裁决原则**:实施有真实证据且文档只是没跟上 ⇒ 改文档;实施与 canonical 合同冲突 ⇒ 改实施;无法判断 ⇒ 上浮 owner(本文件 §4)。

## 0. 合并与门禁基线(先落事实)

| 项 | 结果 |
|---|---|
| 本地未提交工作入库 | [ok] 5 提交(`5036bee` canonical / `4c4bf96` W5.4-b C1+C2 / `479634c` 备案软著 / `cdf49f2` 官网 / `ad8adb1` 记录层) |
| main 快进 origin/main | [ok] `11e3653` → `5a73420`(W-Win + hardening 9 提交) |
| 批次分支合并 | [ok] `4d2824e`,10 处冲突全部语义合并(详 §2) |
| `pnpm typecheck` | [ok] exit 0 |
| `just ci` 双矩阵 | [ok] exit 0;daemon 1764 passed / 5 skipped、console 264、contracts 103、cli 20/1 skipped、platform 12、pipeline 34 passed |
| 公开仓 Actions | [ok] PR #1 node+python 均 SUCCESS(run `32545535527`);main 最新 push run `32547933533` success |

分支拓扑澄清(避免误判为「未合并」):

- `feat/windows-alignment` / `fix/ownership-anchor-and-cmd-escape` 是**公开快照线**分支(根为 `snapshot:` 提交,与 main 无共祖),内容已由 `sync/windows-alignment` / `sync/hardening-20260822` 移植进内部 main;`git diff` 两两为空。公开仓 `public/main` `7838479` 已 merge 二者。
- `~/WorkSpace/saydo-batch-*` 五个施工 clone 全部 clean 且 HEAD 均在 main 祖先链上;`~/WorkSpace/saydo-dogfood` 无远程,是 e2e 沙箱不是 SayDo 分支。

## 1. 逐条发现与裁决

编号 F1-F17。「方向」列 = 对齐文档还是对齐实施。

| # | 发现 | 证据 | 方向 | 处置 |
|---|---|---|---|---|
| F1 | 官网文案稿 `docs/site/2026-08-20-homepage-structure-copy.fable.md` §B.2/§B.9 与 `2026-08-20-docs-page-content.fable.md` FAQ 仍写「Windows / Linux 暂不支持、没有明确时间表」,而部署 HTML(中英八页)已改为「已开放 / 现在可用」 | 稿 line 72/73/139/140/143、docs 稿 line 771 vs `deploy/saydo-octoooo-com/index.html:96,379,427`、`docs/index.html:893` | 对齐实施 | 已改稿 |
| F2 | `HANDOFF.md` §1 自相矛盾:第一条写批次指针 = `w54b-wiring`,第二条快照行写「当前批次指针 = `w54b-canonical-preface`」 | HANDOFF.md:21 vs :22 | 对齐实施(preface 已收口入库) | 已改 |
| F3 | HANDOFF §1 快照行「最近已入库的合并基线 = `11e3653`」在本轮合并后过期 | 同上 | 对齐实施 | 已改 |
| F4 | HANDOFF §2-5 与 PLAN-2 写 Actions「Node job 因 pnpm 版本冲突失败;本批不改 workflow」,而 `3279c0f` 已修且两 job 已绿 | `.github/workflows/ci.yml`;`gh run list` | 对齐实施 | 已改 |
| F5 | HANDOFF §2-6 / §3 写 `claude` CLI **2.1.225**,本机实测 **2.1.220**(与 fixture 基准一致) | `claude --version` = `2.1.220 (Claude Code)` | 对齐实施(实测为准) | 已改 |
| F6 | PLAN-2 §开头现时态与 W-Win 节写「W-Win 进行中,本批独占 gate 运输,W5.4-b 暂停改 `handleGateRequest`」,而 W-Win 已收口且 W5.4-b 已改该面 | PLAN-2:10,78 vs `4d2824e` | 对齐实施 + **如实登记红线违反**(见 §2 末) | 已改 |
| F7 | 版本台账 §2 时代 VII 缺 W-Win / hardening / 软著 / w54b-wiring 四行;已入库的三行仍写「待入库;工作区」 | `history/DEV-VERSION-LEDGER.md`:118-124 | 对齐实施 | 已改 |
| F8 | 台账 §3 未登记本周新增三处编号撞号:journal R80/R81 双占、`prompts/88-*` 双占、`research/codex-findings/88-*` 五文件双主题 | 见 §3 | 补登记 | 已改 |
| F9 | journal 缺 Windows 批回修与内部主线移植轮次(R90 只到 `be82f98`,其后 `640e982`/`d427716` 与 hardening 五提交无轮次) | `git log 316f031^..5a73420` | 补记 | 已补 R91 |
| F10 | journal 缺本轮(合并 + 双向对账)轮次 | — | 补记 | 已补 R92 |
| F11 | `docs/adr/README.md` 状态列过期:工程 ADR-002 写「已定,豁免休眠」(ADR 文末已加状态更正,豁免已随 T18 落地);ADR-003 / 设计 ADR-004 写「已决策,评审中」(评审已收口并已实施) | ADR README:10,11,20,21 vs 各 ADR 文首/文末 | 对齐实施 | 已改 |
| F12 | `docs/07` §0 第 2 条留「官网在 W-Win 收口前仍可写"Windows 暂不支持"」的过期从句 | docs/07:9 | 对齐实施 | 已改 |
| F13 | 设计 ADR-004 §约束 4「官网 FAQ 在本批收口且 owner 授权前保持暂不支持」条件已达成但未标注 | ADR-004:33 | 对齐实施 | 已改(标注达成条件与依据) |
| F14 | W5.4-b **C3(console 与话术)未实施**,IMPL-PROMPT-15 §3 的三阶段只落 C1/C2;无 `e2e/evidence/w54b-batch.md`,两提交法的 evidence 提交缺位 | `git status` 无 `packages/console` 改动;`ls e2e/evidence/w54b*` 无匹配 | 对齐实施(如实登记未做) | 已补 evidence 文件并标 C3 [fail] |
| F15 | 合并冲突暴露的**实现缺口**:`ensureGateScript` 在 POSIX 上不写 `gate-claude.sh`(W-Win 侧只在 win32 写 claude 门脚本),与 09 §11 claude_code 承载段「门脚本落 `$SAYDO_HOME/tier1/`」不符 | 合并前 `gateScript.ts` HEAD 版 | **对齐文档(改实施)** | 已改:新增 `buildActiveClaudeGateScript`,双脚本按平台同写 |
| F16 | `@saydo/platform` 的 `GateHttpHandler` 只允许 `allow`/`deny`,挡住 claude PreToolUse 的 `no_decision` 三态(09 §11 claude_code 段要求三态) | `packages/platform/src/gate.ts:62` | **对齐文档(改实施)** | 已改为三态 |
| F17 | **部署门前置的真实缺陷**:定时快照备份自 2026-08-07 起连续 `workspace_identity_changed` 失败(HANDOFF §2-18 登记为「下一次部署门前置,但本批不修」)。根因 = `revalidateWorkspaceIdentity` 拿 `st_dev` 当硬身份锚,而 macOS/APFS 的 `st_dev` 是挂载期标识 | 生产库 `dev=16777234 / ino=765311` vs `stat` 实测 `dev=16777231 / ino=765311`(ino 未变) | **改实施** | 已修 `d406387`:身份锚收敛为 `(path, inode)`,+3 回归锚。owner 本轮授权升常驻,该项正在部署路径上,故不留到下批 |

## 2. 合并冲突的语义裁决(10 处)

W-Win(Windows/Linux 原生对齐)与 W5.4-b(claude 接线)并行开发,PLAN-2 曾要求二者串行于 gate 运输面,实际并行,故冲突集中在门面。逐处裁决:

| 文件 | 冲突 | 裁决 |
|---|---|---|
| `docs/07` | Claude 行 vs Cursor 行各自被一侧改写 | 取 W5.4-b 的 Claude 行 + W-Win 的 Cursor 行(JSON 解析器按 OS) |
| `docs/09` | 同上 | 同上;另给 claude 门脚本补 Windows 投影注(`gate-claude.mjs`),与 09 既有 §11 传输段一致 |
| `history/PROCESS-JOURNAL.md` | 两线各自用了 R80/R81 | 备案/记录链 R80-R88 被台账 §2 与 HANDOFF §1 多处引用、链内还互指,改号成本高故保号;Windows 两节的标题号顺延 R89/R90、正文未改并附编号注(判据 = 改号成本,不是落盘先后——评审 91 B-13 校正) |
| `gateScript.ts` x3 | 平台路径 vs 双脚本同写 | 合成:`buildActiveClaudeGateScript` 与 `buildActiveGateScript` 对称,双脚本按平台同写,win32 两脚本都过 `restrictOwnerOnly`(修 F15) |
| `gateServer.ts` | 扁平 schema(可选 kind) vs 判别联合 | 取判别联合(无 kind ⇒ legacy `{command,cwd}`;未知 kind 拒),删被取代的扁平 schema 与重复的 `parseGateWireRequest` 定义。与 PLAN-2「协议超集现网 `{cwd, command?}` 不变,可选 kind,未知 deny」一致 |
| `validateConfig.ts` | import 各自新增 | 取并集 |
| `backends/claude.ts` | win32/POSIX 门脚本分叉 vs `hookTimeoutSec` 参数化 | 两者都取 |
| `executor.ts` x5 | 漂移面框架 vs claude 门脚本漂移面;`.cursor/hooks.json` 内联供给 vs backend 委派 | `gateIntegritySurfaces` 收编 claude 门脚本;drift guard 合成「逐漂移面一条审计(带 `script` 基名)+ 只自愈漂移面」;`provisionWorktree` 改走 `backend.provisionHooks`,但只在 cursor 后端登记 worktree 内 `hooks.json` 漂移面——claude 门脚本在 `~/.saydo/tier1/`,已由 `cfg.gateClaudeScript*` 覆盖,重复登记会拿 cursor 的 `hooks.json` 期望值比 claude 脚本、恒漂移 |
| `index.ts` x3 | `executorCfg` 两侧字段 | 合成;`gateScriptExpected` 改用 `buildActiveGateScript` 保持跨平台 |
| `tier1-executor.test.ts` x2 | 期望值构造函数 | 改用 active 形态,跨平台成立 |

**红线违反登记(评审 90 A-8;本报告初稿曾写「按序满足串行意图」,是错误的重释)**:
`docs/plan/WINDOWS-ALIGNMENT.md:17,218-221` 的约束是「本批独占 gate 运输与 `gate-*.mjs`;W5.4-b **暂停改** `handleGateRequest` 直到本批收口」——
约束的对象是**开发期不并行动同一面**,不是「合并顺序」。拓扑可证两批从共同祖先并行分叉:

```sh
git merge-base 5a73420 4c4bf96                      # -> 11e3653
git merge-base --is-ancestor 5a73420 4c4bf96; echo $?  # -> 1
git merge-base --is-ancestor 4c4bf96 5a73420; echo $?  # -> 1
```

故判定:**红线被违反**。补救不是重释,而是欠下的三件事——① 合并态门面的零上下文对抗评审(本轮评审 90 已做第一轮,回修后须复审);
② Windows/POSIX 四工具三态的合并态测试(本轮已补 `tier1-gate-claude-mjs.test.ts` + `tier1-file-tool-effect` 圈根用例,仍缺 Windows 真机复跑);
③ 真 Claude hook 冒烟(归 W5.4-c)。三件未清前,W5.4-b 不得判收口。

## 3. 本周新增编号撞号(已同步登记进台账 §3)

| 撞号 | 事实 | 处置 |
|---|---|---|
| journal R80 / R81 | Windows 线在公开快照 clone 独立写作,与备案/记录链同号 | Windows 两节顺延 R89/R90,原文未改,附编号注 |
| `prompts/88-*` | `88-version-records-audit-review.md`(记录对账)与 `88-windows-alignment-{codex,consistency,implementation}-review.md`(Windows)同号 | 沿 `history/README.md`「原始证据不重编号」裁决,只登记不改名 |
| `research/codex-findings/88-*` | 同上,五文件两主题 | 同上 |

## 4. owner 裁决(2026-08-22 本轮当面确认)

| # | 问题 | owner 裁决 | 落地 |
|---|---|---|---|
| O-1 | 「完整部署」的范围:HANDOFF §2-17 与 PLAN-2 都写明 T19 x tailnet 合同 + 备份恢复可用是**任何升常驻动作的前置**,两者当前均未解除(备份自 2026-08-07 起连续 `workspace_identity_changed` 失败) | **官网 + 常驻 runtime 一起升** | 视作对上述两条前置门的显式豁免;豁免与其理由随本轮登记(journal R92 结论段),前置项本身**不因此关闭**,仍挂 HANDOFF §2-17/§2-18 |
| O-2 | 官网把 Windows / Linux 由「暂不支持」翻转为「开源 · 现在可用」(中英八页 + FAQ),设计 ADR-004 §约束 4 要求 owner 授权 | **是 owner 改的,照此发布** | ADR-004 §约束 4 标条件达成;两份文案稿同步(F1);口径必须同时写明常驻安装与系统通知仍为 macOS 实现 |
| O-3 | 安卓真机未连接(`adb devices` 为空) | **owner 现场插设备** | 已插上并装机成功。**更正**:我此前判 `apps/android/build-and-install.sh` 里的 `-s 01234ABC` 是占位符,实测该串就是设备真实序列号(联想 TB350XC),脚本无需改 |
| O-4 | 软著鉴别材料(约 2.5 MB)入库后会随整棵 HEAD 树进公开仓 | **只留私有归档,公开快照排除** | `scripts/publish-public-snapshot.sh` 加 `PUBLIC_EXCLUDE`,用临时 index 裁剪出公开树并断言剔除成功;隐私探针 pathspec 同步排除。副作用:`docs/release` 里指向该目录的相对链接在公开侧 404,已在脚本注释写明是有意的 |

### 4.1 评审 90 后的二次裁决(2026-08-22,基于 Codex 翻出的 canonical 原文)

| # | 问题 | owner 裁决 | 落地 |
|---|---|---|---|
| O-2 复议 | 评审 90 A-7:三处 canonical 明文与官网口径直接冲突——`LINUX-ALIGNMENT.md:60`「不得以 `ubuntu-latest` 绿判定 Linux 可用」、`ADR-004:20`「不为 Linux 单开 CI 或官网承诺」、`ADR-004:115`「不宣布产品已支持 Windows」。证据强度不对称:Windows 有真机全量门禁,Linux 只有 ubuntu CI(恰是被明文禁止当依据的那种) | **两个都保留,改 canonical** | ADR-004 两处加 owner 解除注(解除的是**官网承诺**,不是 SKU 判定);LINUX-ALIGNMENT §3 加口径边界注,明确「最小镜像依赖面验证仍是升 SKU 前置,未解除」;两处都如实写下证据不对称 |
| O-5 | 评审 90 B-13:journal 并线撞号顺延与 `history/README.md`「不重编号」政策冲突 | **认顺延先例,改 README 政策** | `history/README.md` 编号政策改写为两情形:同线历史重复不重编号;**并线撞号**由**改号成本低的一方**顺延标题号、正文不动、台账登记。R89/R90 由临时口径转为依政策处置。**评审 91 B-13 再校正**:初版措辞写成「先落盘者保号」,与实际处置矛盾(Windows `05bc91d` 10:15 早于记录链 `ad8adb1` 12:48 却顺延),已按真实判据改写 |

## 5. 仍未关闭(不因本轮对账而消失)

1. **W5.4-b 未收口**:C3(console 与话术)未做;合并后的门面未经零上下文对抗评审。
2. **升常驻两前置**:T19 x tailnet 合同未拍板回写 canonical(**未动**);定时快照备份的**根因已修**(F17,`d406387`)但**现场未复验**——部署后须跑一次 `just backup` 确认真出快照。O-1 是**本次部署的豁免**,不是这两项的关闭。
3. **跨平台四项未做**:Linux systemd unit / Windows Scheduled Task 常驻安装、系统通知、SAPI TTS、Actions `windows-latest`。
4. **四场真人验收**:场次① `failed` @ `ada7981c` 待复验;②-④ `not_run`;`[t2]`/`listen` 变更已使旧场次锁作废,owner 尚未重新声明基线。
5. **Linux 升正式 SKU 的前置未清**:最小镜像(`node:*-slim` / distroless)依赖面验证、systemd user unit + `loginctl enable-linger` 真实主机验证。官网口径放开不等于这两项关闭。
6. **评审 90 欠账三件**(gate 串行红线违反的补救):合并态门面复审、Windows 真机复跑四工具三态、真 Claude hook 冒烟。

## 6. 评审 90 交叉 review(Codex `gpt-5.6-sol` + max,只读)

- prompt:`prompts/90-week-crosscheck-review.md`;报告:`research/codex-findings/90-week-crosscheck-review.md`。
- 裁决:**No-Go**。A 级八条、B 级十四条、C 级两条、O 级两条。
- 我方独立复核后**全部认定成立**(A-7 部分成立:事实面成立、canonical 冲突成立,已走 owner 二次裁决)。
- 逐条回修台账见 `e2e/evidence/w54b-batch.md` §7。回修后 `just ci` 双矩阵 exit 0,daemon 1783 passed / 5 skipped(相对回修前 +19 例)。
- 我方独立复核另发现两条 Codex 未列的(A-1 在其审查前已由我方 `058090d` 修、B-5 由 `3bf3d10` 修),两者均被 Codex 独立确认为真问题。

## 7. 评审 91 复核(同通道复核评审 90 的回修)

- prompt:`prompts/91-review90-rework-verify.md`;报告:`research/codex-findings/91-review90-rework-verify.md`。
- 裁决:**仍 No-Go**。5 条 CONFIRMED_FIXED、6 条 STILL_BROKEN、**1 条 REGRESSED(回修引入)**。
- 二次回修逐条台账见 `e2e/evidence/w54b-batch.md` §8。要点三条:
  1. **我引入了一个退化**:身份核验失败复用的 `finalizeFailure`,在「任务被并发转走」的早退路径上漏了 `resolveClaim`,
     会挂住认领链与 recover barrier。已在**根上**补(修的是所有调用方,不只我的新路径)+ 回归锚。
  2. **我一度改错了方向又改回来**:按 A-1/B-4 删掉了门脚本的圈外预筛,发现这会让「圈外写永不 allow」只剩 daemon 单层、
     且要动受保护的既有 7 例(红线停点),已回滚并改为写清边界 + 归 W5.4-c。如实记,不掩饰。
  3. **我上一轮把错误行为写进了测试**:B-6 的 `not_limited=true` 被我当成 fail-closed 固化,实际字面语义相反,已改正。
- 门禁:`just ci` 双矩阵 exit 0;daemon **1790 passed / 5 skipped**。
- 诚实边界:Codex 本轮因只读沙箱写 Vite 缓存被 `EPERM` 拦下,**未独立复跑测试**,其结论是静态审读。

## 8. 评审 92 与 owner 二次停点

- prompt `prompts/92-review91-rework-verify.md`;报告 `research/codex-findings/92-review91-rework-verify.md`;裁决 **No-Go**。
- 抓到**我新引入的一条 A 级**:修 macOS 备份失败时把 workspace 身份锚的 `dev` **全平台**去掉,
  而 09 §规则 1 明写 `realpath + (dev,ino)` 且注明 Windows 上 `dev` 承载 volume serial(那里它稳定)——
  既弱化了 Windows,又**静默双改了契约**。已改按平台分叉 + 同批回写 09。
- 另抓到我台账里一条**不实陈述**(「已去掉 ensureGateScript 的重复 ACL 调用」,实际回滚时连带撤销了),已改正。
- **owner 停点裁决(2026-08-22)**:A-1/B-4 门脚本圈根——**「现在就真对齐」,解除 `tier1-gate-socket` 既有 7 例的红线**。
  落地见 `e2e/evidence/w54b-batch.md` §9 对应行。
- **owner 停点裁决**:评审轮次到此为止,继续部署;W5.4-b 未完成项按原样如实登记,不因部署而改判。

## 9. 三轮评审后仍留在台面上的欠账

1. ~~POSIX `*..*` 与 win32 `..` 分量判定不同语义;两端预筛圈根口径与 daemon 不一致~~ **已随 owner「真对齐」裁决修掉**
   (两端按分量判 + 圈内外归 daemon 单点)。
2. **未锁住的测试**:B-1(bind 期望值)/ B-2(顶层兜底行为)/ C-1(win32 ACL)缺行为与 ACL 回归,需 Windows 真机。
3. **W5.4-b 仍未收口**:C3 未做 + C1 的 init 断言未做 + 评审 90 欠账三件。

## 10. 部署与清理实测(本会话真实命令)

| 项 | 结果 |
|---|---|
| 推私有归档 origin | [ok] `afd31b4..6d98a6e`(其后 `6d98a6e` 再推一次) |
| 公开快照 | [ok] snapshot **commit** 范围 `7838479..2bb9101`（`2bb9101` 不是 tree 对象；其可重算 public tree object digest 为 `2bb9101^{tree}` = `0fa18ac3e7c16c91ac21b1addce886e6ed1a4961`，对应快照说明 `public-tree:` 行）;`[ok] 公开树已剔除: artifacts/release/copyright`;`git ls-tree -r public/main` 对该路径计数 = 0 |
| 官网主站 | [ok] `wrangler pages deploy` Production/main;`https://d16c9509.saydo-3xb.pages.dev` |
| link 落地页 | [ok] `https://0505d9ad.saydo-link.pages.dev` |
| 生产域名 | [ok] 四路均 200(`/`、`/docs/`、`/en/`、link 站) |
| 线上内容核验 | [ok] ICP 号在主站与 link 站各命中 1;首屏平台句与 Docs FAQ 均为本轮版本 |
| 常驻 runtime | [ok] `just daemon deploy 6d98a6e` exit 0;`/readyz` `ok:true`、`voiceReady:true`、`sourceRevision=6d98a6e…`;daemon 与 pipeline loaded SHA 一致 |
| **F17 备份修复现场复验** | [ok] `just backup` exit 0 出快照 `20260822T142430Z`,manifest `completed:true`,含 `project_foundation`(4558B)/ `project_knowledge`(129066B)——正是此前取不到的两个源。距上次成功 `20260806T013953Z` 的 16 天空档闭合 |
| 局域网可达 | [ok] `http://<private-ip>:47100/` 返回 200(localhost 走 308 归一,符合 rpId 绑定口径) |
| 三端真机 | [ok] iPhone Air 装机;[ok] 安卓 TB350XC 装机 + `topResumedActivity` 在前台;[warn] 鸿蒙设备掉线且 HAP 未签名,按裁决只出包 |
| 分支清理 | [ok] 五个分支删除前逐条核验:`sync/*` 与 `batch/*` 提交可达 main;公开线两分支树与 `sync/*` **逐字一致**且已在 `public/main` 祖先链。删后只剩 `main` |
| worktree | [ok] 只剩主树;五个 `saydo-batch-*` clone 全 clean 且 HEAD 在 main 祖先链 |

**部署不改判的三件**:W5.4-b 的 C3、C1 的 init 断言、真 Claude hook 冒烟仍未做;
升常驻豁免的 T19 x tailnet 前置仍未动(备份那条已修并现场复验);本次升常驻再次前移发布锁,四场基线需 owner 重新声明。
