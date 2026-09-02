# 2026-09-02 月度双向对账:最近一月文档 ↔ commit 交叉核验、修复与收口

> 范围:`git log --since=2026-08-02`——在对账起点 HEAD `79211f6`(PG-00 E)上计 565 个 commit(含 PG-00 两提交;PG-01A 在途线的 I 当时未定案,按 worktree 状态对账)与同期改动过的 976 份 Markdown(主树 tracked + PG-01A worktree 新增)。本轮自身的提交(PG-01A I/E、隐私脱敏、对账/分发系列)不在该分母内;收口时同一命令在最终 HEAD 上的计数会更大,以 journal R127 记录的最终 HEAD 为准。
> 关系:supersede 关系上承接 `history/PROCESS-JOURNAL.md` R114(2026-08-27 月度全量双向审计,覆盖 07-27 → 08-27);本轮**先核验 R114 的修复是否真正落盘**,再对 08-27 之后的全部变更(PG-00 导入、PG-01A 三轮恢复、08-31 只读评估)做完整对账,最后用机械手段覆盖全月。
> 方法纪律:每条结论对应本会话真实命令输出;未运行的项写「未运行」;不抽样(SHA 解析与 commit 覆盖都是全集扫描)。
> 本文件不是排产源,也不改变 PLAN-2 的唯一串行链(`next=PG-01B`)。

## 1. 结论

- **文档 → commit**:全月 976 份文档中出现的 1071 个 7–40 位十六进制串,696 个解析为本仓 Git 对象;其余 198 个经逐条上下文分类全部是**非 SayDo commit 标识**(Codex 会话 id 26、文件/日志 SHA-256 前缀 24、Cloudflare deployment id 7、外部仓 commit 或 tree OID、显式标注的临时 checkpoint、示例串 `0123456789abcdef…`)。**没有发现引用不存在 commit 的文档**。
- **commit → 文档**:565 个 commit 中 429 个被文档以 hash 直接点名;其余 136 个全部落在 `history/DEV-VERSION-LEDGER.md` §2 已登记的批次区间内(08-04–08-13 的 Focus/E2/redesign/向导/UI 标准化各批以「代码 SHA 段 + 提交信息」登记;08-25–08-27 的 `chore(evidence)` 账本重生成与 rc.10–rc.12 `--verify` 证据提交由内容文件本身承载)。**没有发现脱离任何批次记录的孤儿 commit**。
- **R114 修复清单复核**:R114 列出的 30 项文档修复逐项 grep 核验,29 项直接命中;1 项(「DSH D-09 勘误」)文件名与 R114 缩写不同(实际在 `docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md` §表 D-09 行与 §第一刀表),已核实存在。**R114 的修复无一虚报**。
- **08-27 之后**:PG-00 导入(`9cfbfe8`/`79211f6`)与 PG-01A(`2a786ed`/`f4d8de9`)的文档与代码一致;PG-01A 由本会话按 program §20.2 完成 I amend、clean I 全部门禁、Q0 report、E 与 clean E 门禁后 ff 合入 main(详见 `e2e/evidence/project-gap-pg-01a.md` 收口节与 journal R126)。
- **发现的真实缺陷**:A 级 1(公开树隐私探针),B 级 4,C 级 4;全部当轮修复,另有 3 项 owner 待决(§5)。

## 2. 方法与真实命令

| 步骤 | 命令(摘要) | 输出 |
|---|---|---|
| 月内 commit | `git log --since=2026-08-02 --format='%H %h %s'` | 565 |
| 月内文档 | `git log --since=2026-08-02 --name-only -- '*.md'` ∪ PG-01A worktree `git status` 新增 md | 976 |
| 文档引用的 hex | `grep -oE '[0-9a-f]{7,40}'` 逐文件 → `git cat-file -t` | 1071 unique;696 resolved;198 unresolved |
| unresolved 分类 | 逐条取所在行上下文 | session-id 26 / digest 24 / deploy-id 7 / session-ctx 21 / example 1 / 其余 119 条逐条人工核为外部仓 commit(Hopper `bdd1e548…`、open-webui docs `1eea3847…`、DeepSeek harness `47f94385…`、OctoAgent `4f2d918`)、临时 clone checkpoint(`2637d30d…`,prompts/196–197 明写「checkpoint」)、公开过滤树 tree OID(`f38b3d8c…`)、嵌套 git HEAD(`8e55c10d…`)、已消失候选分支(`4d4a442`,journal 明写 upstream 已消失) |
| commit 覆盖 | 565 个短 SHA 在 976 份文档中 `grep -F` | 429 命中;136 未命中 → 逐条与 `DEV-VERSION-LEDGER.md` §2 批次区间比对 |
| R114 修复复核 | 30 条 grep 断言(`chk` 循环) | 29 ok + 1 文件名差异(核实存在) |
| 文档门禁(HEAD `79211f6` clean worktree) | `check-emoji.sh`、`check-doc-links.mjs`、`week-audit --check`、`--check-bundle`、`test-public-text-redaction.mjs` | 全部 exit 0(`--check` 在带 untracked 文件的主树上报「应发布源文件未入 index」,系两个未入库文件所致,clean worktree 上绿) |
| 公开树隐私探针 | `check-public-tree-privacy.mjs --ref <PG-01A E>` | **exit 1,13 文件 `home-macos`**(§3 A-1) |

## 3. 发现与处置

### 3.1 A 级(阻断公开快照 / 合同违反)

| # | 发现 | 证据 | 处置 |
|---|---|---|---|
| A-1 | PG-00 E(`79211f6`)入库的 `prompts/206–207`、`research/codex-findings/206–220` 与 journal R119 含本机绝对路径,公开树隐私探针 13 文件 290 处 `home-macos` 命中;`scripts/publish-public-snapshot.sh` 推快照前必跑该探针,**下次公开快照会被拒绝**。PG-00 的 `FG-PG00-E` 门列表(emoji / doc-links / check-bundle / diff-check)未含该探针,是 PG-00 合同的漏项 | `check-public-tree-privacy.mjs --ref f4d8de9` → `hits=13 files=13`;R114 已把「归档文档不含本机绝对路径」定为纪律(`143357f`/`85b0470`) | 本轮 `babd864` 按同一约定脱敏(`<repo>` / 相对路径),`--fs` 复扫 hits=0;PG-01A 的 15 个 prompt/report/control 文件在入库前已同样脱敏(evidence 收口节注明 digest 变化) |

### 3.2 B 级(不一致 / 缺漏,已修)

| # | 发现 | 处置 |
|---|---|---|
| B-1 | PG-01A 三份归档 reviewer 报告含 Markdown 双空格硬换行,`git diff --check P..E` 硬门 exit 2 | E 前统一去行尾空白,归一后 digest 记入 evidence;journal R120/R121 所记归档副本 digest 标注为归一前值 |
| B-2 | PG-01A 完整门禁在深路径 TMPDIR 下 `platform/home-lock.test.ts` 两例 `EADDRINUSE`(tsx IPC Unix socket 超 macOS `sun_path` 104 字节上限) | 环境错误不计产品失败;改用短 TMPDIR 重跑 exit 0(两次日志 SHA-256 均记入 evidence);测试基线要求「isolated TMPDIR 必须短路径」写入 R126 |
| B-3 | 主树两个未入库文件:`CLAUDE.md`(项目指令桥接,`@AGENTS.md`)与 `docs/review/2026-08-31-project-status-ai-onboarding-impl-readback.fable.md`(owner 请求的只读评估,RED,7 条 G-A blocker),导致 `week-audit --check` 在主树报错且评估结论无 Git 身份 | `f35c234` 入库两者;评估报告的 blocker 全部对应 PLAN-2 已排 PG-01B–PG-06,不新造台账 |
| B-4 | 根目录 `HANDOFF-3`、`HANDOFF-4` 无「已交付归档」横幅(`HANDOFF-2`、`HANDOFF-前端组件化` 有),`DEPLOY-测试机部署清单.md` 是 08-12 源码部署路径却无定位注,且四者均未被任何索引引用 | `f35c234` 补横幅(引用 `DEV-VERSION-LEDGER` §2 的批次 SHA)与定位注,指向 README「快速运行」 |

### 3.3 C 级(登记,本轮顺手修或明确不修)

| # | 发现 | 处置 |
|---|---|---|
| C-1 | PG-01A 修改了 README 的 availability 锚句(「普通用户无需克隆源码。…可直接使用:」→ 「当前公开定位是 developer/preview。…不含语音 pipeline:」),而 `scripts/post-release-gate.mjs` 的 README before/after 替换表仍是旧句 | 不在本轮改:该表在每次 RC bump 时整体改写(rc.11→rc.12 先例 `4e5f09f` 改 54 行),rc.13 bump 必须同步;已写入 §5 待办与 `docs/plan/2026-09-02-quick-start-distribution.md` §4 |
| C-2 | journal R124/R125 与 evidence 记录 FG-1 归档报告 `6250 bytes / c86f2403…`;本轮未再改该文件,digest 仍成立(已复核) | 无需处置 |
| C-3 | `docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md` 的 `P2-001` `last_validated_candidate` 仍是 `2b5517d + d324b59b…`(HEAD+dirty 身份);最终 I 为 `2a786ed` | 按台账规则不在在途阶段改写(未重验);final sweep 时按最终候选重验 |
| C-4 | `docs/plan/README.md` 未索引本轮新增的两份专题文档 | 本轮补索引 |

### 3.4 复核为一致、无需处置(抽样禁止,全部逐项)

- HANDOFF §1.1 三层时钟:活动树 / 公开快照 / 常驻 runtime 坐标与 `git`/`gh` 实读一致(公开 `public/main=83e0aca`=内部 `280b0cf` 快照;公开 CI 该快照 success;常驻 runtime 未探活、未升级,与 HANDOFF 陈述一致)。
- README / 官网 / `packages/cli/README` / `docs/release/version-matrix.md` / `release-profile.yaml` 的 rc.12 available 口径一致;`docs/release/v0.1.0-rc.12.md` 勘误段存在。
- `docs/plan/README.md` 对 PG 三文件、AI 供给三分法、历史锁版的描述与文件实况一致;`IMPL-PROMPT*` 均为历史锁版。
- `history/PROCESS-JOURNAL.md` R105–R125 编号连续(PG-01A worktree 的 R120–R125 随 E 入库,本轮 R126/R127 顺延)。
- e2e/evidence 引用的 30 份证据文件全部存在;PLAN-2 W1–W9 行引用的 evidence 路径存在。
- 公开仓 CI:最近快照 run `33083971636` success;私有归档 `SayDo-archive` 的 CI 自 08-27 起 8 个 job 全部「not started」——annotation 明示 **GitHub 账户付款失败 / spending limit**,不是代码红(§5 owner 项)。

## 4. 本轮实施(与本报告同一工作线)

| 提交 | 内容 |
|---|---|
| `f4d8de9`(ff 合入 main) | PG-01A E:I `2a786ed` 定案、Q0 report、readback/prompt 归档、指针 `active=none,next=PG-01B` |
| `babd864` | A-1 隐私脱敏 |
| `f35c234` | B-3/B-4 |
| 后续提交(见 journal R127) | 快速启动分发:`deploy/saydo-octoooo-com/install.sh` + `install.ps1` + `_headers`、R2 镜像、`scripts/test-install-scripts.mjs` 挂入 `just ci`/CI、README/官网/CLI README/站点文稿同步、`docs/plan/2026-09-02-quick-start-distribution.md`;本报告;journal;HANDOFF 快照行;week-audit 账本重生成 |

## 5. owner 待决(本轮不代拍)

1. **GitHub Actions 账户付款失败**:私有归档 `SayDo-archive` 的 CI 自 2026-08-27 起全部 job 未启动(annotation:recent account payments have failed / spending limit)。公开仓不受影响(免费额度)。需要 owner 在 GitHub Billing 处理;处理前私有归档只能靠本地 `just ci` 与公开仓 CI 双认。
2. **rc.13**:PG-01A 收紧后的 console 文案尚未进入任何 Release(rc.12 包内仍是旧文案);安装脚本钉住 rc.12。是否现在开 rc.13(需走完整发布合同:bump → 公开快照 + tag → release.yml → 实体门 Mac/Windows → availability 翻转 → 官网部署)由 owner 决定;本轮不擅自发新 Release。
3. **npm registry 发布**:`@saydo/cli` 尚未发布到 npm(owner 明示手动上传);发布后在 README/官网加 registry 入口。
4. (延续 R114 待决 1–9)未在本轮解决,原样保留于 R114 尾部。

## 6. 门禁与推送结果

### 6.1 快速启动实测(详表见 `docs/plan/2026-09-02-quick-start-distribution.md` §6)

- macOS(本机):系统 Node 路径、无 Node 下载路径、强制镜像路径三条全绿(安装 → status → up → /health → SIGINT 停止 → 无残留)。
- Windows(局域网主机,PowerShell 5.1):默认路径与强制镜像路径全绿(含 cli-stop 优雅停止、0 残留)。
- R2 镜像 `dl.saydo.octoooo.com`:Mac/Windows 均 200,字节与 Release 全等。

### 6.2 移动端

- iOS 壳:`apps/ios/build-and-install.sh --build-only` → `BUILD SUCCEEDED`、产物 codesign 校验通过。真机安装**未完成**:iPhone Air 经 devicectl 可达(tunnel IP 已分配)但 `The developer disk image could not be mounted on this device`(iOS 27.0 / Xcode 27.0 beta 27A5194q;通常需要设备解锁并信任本机,或 Xcode 提供对应 DDI),安装器按合同拒绝「非 connected/available」目标。需要 owner 在手机上解锁/确认后重跑 `./build-and-install.sh --device BF884EAE-…`。
- Android 壳:`--build-only` debug 构建与产物校验通过;`adb devices` 为空,**无真机可装**。
- HarmonyOS 壳:`--build-only` 的 `hvigorw` BUILD SUCCESSFUL,但安装器按合同拒绝 unsigned HAP(缺 SayDo 签名 Profile,与 `docs/release/version-matrix.md` 一致);`hdc list targets` 为空,**无真机可装**。
- 三端均未装机 ⇒ 未做真机测试;不宣称移动端已验。

### 6.3 Codex 零上下文交叉评审(gpt-5.6-sol / max,只读)

- 第一次派发(`prompts/222`)维度过宽,1500 s 硬超时内未产出结论(ignored 事件流 797457 bytes,SHA-256 `d54559a4…`,exit −15/timeout);按纪律不 `resume`,起全新会话。
- 第二次派发(`prompts/223`,范围收窄、2400 s):783.9 s 完成,`turn.completed` 1 次,报告 `research/codex-findings/223-monthly-crosscheck-quickstart-review-retry.md`(原始 8018 bytes SHA-256 `651c0c75…`;归档副本把其引用的内网 IP 脱敏为 `<lan-ip>` 后 8012 bytes `78a8cf59…`),结论 `[fail] 7A/7B/5C`。
- triage:A-01(安装根目录可越出用户目录)、A-02(`HOME` 缺失时 `set -u` 裸崩)、A-03(HOME 含空格时 rc 路径被拆词)、A-04(PATH 标记用子串匹配,无关注释即跳过写入)、A-05(fish 不读 `.profile`)、A-06(`saydo.cmd` 以 ASCII 写入含非 ASCII 用户目录的路径)、A-07(journal R127 写入了内网 IP,隐私探针 `rfc1918` 命中)——7 条全部成立、全部当轮修复并在两端回归实测;B-01…B-07(自测可被 7 种 mutation 绕过)——吸收为 17 条结构不变量 + 2 项动态无写入检查 + 8 个新 mutation(自测现为 16 mutation 全红);C-02(release.yml 未挂自测)修;C-04(脚本不在 active-claims roots)修,roots 31→33;C-05(报告 commit 计数未绑定 HEAD)修正表述;C-01(post-release-gate README 锚)与 C-03(`--check-bundle` 在收口提交前必红)为既定安排,不改。
- 修复后的候选 `01ab5cf` 由另一名全新零上下文 reviewer 复审(`prompts/224`,报告 `research/codex-findings/224-monthly-crosscheck-quickstart-rereview.md`):A-02…A-07 与 B-01…B-07 全部 `closed`;A-01 `partially_closed`(`SAYDO_HOME=$HOME/../../var/…` 用 `..` 绕过前缀判断)与新发现 N-01/P1(Windows 只按 `%USERPROFILE%` 判定,`%LOCALAPPDATA%` 被重定向到其他盘时默认根目录被误拒)。第 2 次修复:POSIX 词法拒绝含 `..` 的 `SAYDO_HOME`/`HOME`,有 `realpath` 时按真实路径复核(symlink 越出同样拒绝);Windows 以 `%USERPROFILE%` 与 `%LOCALAPPDATA%` 两个基准判定(`GetFullPath` 已消解 `..`);自测加 2 条动态无写入检查与 2 个 mutation(18 mutation 全红、22 条不变量)。Mac 回归:`..` 绕过与 symlink 越出均在写入前 `[fail]` 且不建目录,合法嵌套路径与默认路径安装正常;Windows 回归见 journal R127。第 3 次(最后一次)复审(`prompts/225`,候选 `3630edf`,报告 `research/codex-findings/225-monthly-crosscheck-quickstart-final-review.md`):N-01 `closed`;A-01 仍 `partially_closed`——当 `realpath` 不在 PATH 上时 symlink 越出不被复核;另报 N-02(`prompts/225` 与归档的 224 报告里我写的示例 `C:\Users\<某用户名>` 触发隐私探针 `home-windows`)。**处置与预算声明**:A-01 属同根因第 3 次修复,超出 V2 「同根因最多 2 次修复尝试」上限,且复审预算 3/3 已用完;因 owner 本轮明确要求「直接修复完善」且修复是确定性的最小改动(用 POSIX 自带 `cd -P && pwd -P` 取代 `realpath` 依赖,并把 symlink 越出场景在带/不带 `realpath` 两种 PATH 下写进自测的动态检查),本会话应用了该修复并如实登记:**最终候选未再经零上下文复审**,只有本会话自测(18 mutation / 22 不变量 / 6 动态检查)、Mac 真实安装启停回归与完整 `just ci` 作为证据;owner 若要求,可另开周期派第 4 次复审。N-02 已脱敏(占位符 `<win-home>` / `<win-localappdata-on-D>`),隐私探针 `--fs` hits=0。

### 6.4 仓库门禁、推送与部署

(见 journal R127 追补;本报告不自指最终 SHA。)
