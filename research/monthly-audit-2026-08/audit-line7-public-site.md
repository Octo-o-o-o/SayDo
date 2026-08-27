# 审计报告 · 线 7「仓库公开化 + 官网」commit↔文档 双向对照

- 审计员:零上下文独立会话(Claude Fable 5),2026-08-27
- 审计对象:~/WorkSpace/SayDo,`main` @ `f723ab7`(工作树 clean;`git status` 实测「On branch main … nothing to commit, working tree clean」;任务描述所附的脏树快照已过时)
- 清单:`scratchpad/line7-public-site.txt`,24 条
- 纪律:全部结论基于本会话真实命令输出;未复核项显式标注;只读(未改任何仓库正式文件、未 add/commit;仅跑只读校验脚本与只读网络查询)

---

## 0. 发现总计

| 级别 | 数量 | 编号 |
|---|---|---|
| A(错误/不一致) | 2 | A-1、A-2 |
| B(疏漏/不足) | 5 | B-1 ~ B-5 |
| C(观察) | 3 | C-1 ~ C-3 |

---

## 1. A 级发现

### A-1 清单归属错误:24 条中 5 条不属本工作线

- **主张**:`edac8d0`(07-28 chore(evidence): w4-readback 勘误)、`ce0e381`/`e56bd27`/`30cb277`(08-05 feat(focus) 批1.5/2/3)、`6a6568a`(08-06 fix(focus) W2/W3 生命周期)与「仓库公开化 + 官网」线无关,混入清单。
- **证据**:
  - `git show --stat` 逐个核对:五个 commit 触及的全部是 `packages/daemon|console|contracts` 的 focus/lifecycle 代码、`e2e/evidence/w4-batch.md`、`HANDOFF.md`;无一触及 `deploy/`、`docs/site/`、LICENSE、脱敏或快照脚本。
  - 文档归属检索(`grep -rl <hash> history/ docs/review/ docs/plan/ e2e/evidence/ HANDOFF.md`):`6a6568a`/`30cb277`/`e56bd27`/`ce0e381` 四个 hash 在全部文档中 **零引用**;`edac8d0` 的引用在 `history/PROCESS-JOURNAL.md`、`history/DEV-VERSION-LEDGER.md`、`e2e/evidence/ra-closeout-batch.md`——均为 w4/RA 收口线语境。
  - PROCESS-JOURNAL R84 将 focus 批次归入「Focus Contract 时代(08-04~08-10)」,载体为 `e2e/evidence/focus-contract-batch.md`,与本线(R75 起的官网线、R84 内的 public-readiness/license 条目)分属不同批次条目。
- **处置建议**:从线 7 清单剔除这 5 条(或注明其归属线);若清单由日期/关键词过滤生成,修过滤器。

### A-2 风格探索稿 §五 的「demo 稿 U+2713 已统一替换、全量 emoji 门禁通过」(08-25)与 08-27 入库记录相矛盾

- **主张**:`docs/site/2026-08-25-homepage-style-exploration.md` §五(记 2026-08-25 当晚)称「门禁修正:demo 稿中的 `●`(U+2713)违反零 emoji 门禁,统一换成 `●`;全量 emoji 门禁与 doc-links 门禁通过」。但 `dfb6f9d`(08-27 抢救入库)commit message 与 journal R113 记载:入库时「demo 稿里 34 处装饰符号(U+2713/U+2717/U+279C/U+2726…)按 `2026-08-25-homepage-style-exploration.md` 自述办法换为 U+25CF/U+00D7/U+2192/U+25C6」——即 08-27 时 6 份 demo 稿仍含 34 处禁区码点。两条记载不能同真:若 08-25 已「统一换成」且「全量门禁通过」,08-27 不应仍需替换 34 处。
- **证据**:
  - §五 原文见该文件 :134(本会话 Read);`dfb6f9d` message 见本会话 `git show`(「demo 稿里 34 处装饰符号…换为…」);R113 同段(journal :2934-2937)。
  - emoji 门禁扫描范围含未跟踪文件:`scripts/check-emoji.mjs:25` 为 `git ls-files -z --cached --others --exclude-standard`——08-25 时 demo 稿虽未跟踪也在「全量」扫描面内,U+2713 落在其禁区(R113 自述「U+2600–U+27BF 禁区」),故「全量通过」与「demo 稿含 U+2713」互斥。可能的实情是 08-25 只替换/只校验了落地到 `deploy/` 的文件(deploy 侧本会话实测四类码点均 0 文件命中),但文稿写成了「demo 稿…统一换成…全量…通过」。
  - 现状已闭合:本会话实测 `docs/site/style-demos/` 四类码点命中文件数均 0、U+25CF 文件 6 个;`bash scripts/check-emoji.sh` exit 0「[ok] emoji gate: clean」。
- **处置建议**:在探索稿 §五 补一行事后注(替换实际完成于 08-27 入库批 `dfb6f9d`,08-25 仅覆盖落地文件/或如实说明当时校验范围),消除与 R113 的互斥。

---

## 2. B 级发现

### B-1 清单疏漏:本线核心 commit 不在 24 条内

- **主张**:以下 main 提交属本线主干却未入清单:
  - 脱敏三连 `55a224d`(chore(privacy): 公开前脱敏——备案快照转存根、账号/订单/邮箱抹除、第三方叙述隐去;**补 SECURITY.md 与公开快照发布脚本**)、`693475a`(脱敏补漏+手机号探针加边界)、`6365513`(订单号残留抹除)——公开化线的实体动作大半在这三条里;
  - `11e3653`(08-21 merge: chore/status-alignment-20260821,官网重建 v2 入 main 的 merge);
  - `0e33260`(08-26 release: 官网在途改动合入并把可用性文案同步到 rc.5)——**11 号杂交重构真正进入版本控制的提交**(16 个 deploy/ 文件从主工作区合入,逐文件 SHA-256 校验)。
- **证据**:`git show -s` 三连与 `11e3653`/`0e33260` 均存在且主题如上;`git log -- deploy/saydo-octoooo-com/site.css` 显示 `0e33260` 是 08-22 之后首个触及站点样式的非 release-bump 提交;R84 明文「Apache-2.0 开源 + 隐私脱敏三连(08-20):`354b028` + `55a224d`/`693475a`/`6365513`」。
- **处置建议**:清单若口径为「线 7 全部 main 提交」,补这 5 条(release 线的 rc bump 触站点文件者可按线属 release 不补)。

### B-2 官网 11 号杂交重构(08-25 已上线)无 journal 轮次、无部署证据文件

- **主张**:本线最大的一次站点事件(30 方向发散→10 demo→11 号杂交定稿→site.css 全量重写→中英首页重写→**当日部署上线**)在 PROCESS-JOURNAL 无 R 轮次;那次(08-25)线上部署也没有 e2e/evidence 部署证据文件。
- **证据**:
  - `grep -n '风格\|杂交\|11 号\|hybrid' history/PROCESS-JOURNAL.md`:命中仅 R113 的抢救侧写(「docs/site/ 风格探索与 demo 稿」)与无关行;R 索引(R104–R113)无官网重构节。
  - `grep -rn '官网重构' e2e/evidence/ docs/ history/`:唯一记载是 `0e33260` commit message(「owner 确认官网重构已单独上线,可合入」——不在被 grep 的文档面,故 grep 零命中)。
  - `ls e2e/evidence/ | grep -iE 'site|deploy'`:站点部署证据仅 `2026-08-26-rc12-site-deploy.md`(rc.12 那次);08-25 的上线无对应文件。
  - 对照:同线此前每轮站点动作均有 R 轮次(R75 重建、R76 v2+Docs、R77-R79 状态对齐、R92/R93 部署)。
- **处置建议**:补一节 journal(可并入下轮收口):11 号杂交定稿依据(探索稿 §五)、上线时间、以及「入库滞后至 0e33260/dfb6f9d」的两段式事实;部署证据可引 0e33260 message 的 SHA-256 校验记述补记。

### B-3 docs/site/README.md 索引与「现行」状态未随 11 号稿更新

- **主张**:`docs/site/README.md` 只索引两份 08-20 稿(标「现行」)与 v1 归档,未收录 `2026-08-25-homepage-style-exploration.md` 与 `style-demos/`;而首页的**结构**已被 11 号稿 supersede(对话式 FAQ、#dialogue 次按钮、单条安装命令、四卡产品现状等),08-20 首页稿的 A.2 结构与 B.9「两种入口并列展示」不再对应部署页。
- **证据»:README 本会话全文 Read(11 行,三行索引);部署页实测:`grep -n 'npm install --global' deploy/saydo-octoooo-com/index.html en/index.html` 零命中(仅 docs 页含全局安装命令,首页只保留一条 npm exec,配文「一条就够」)、FAQ 为 `.thread` 对话流 6 组、hero 次按钮 `#dialogue`。内容事实(而非结构)与 08-20 稿仍一致(见 §5)。
- **处置建议**:README 补两行索引(探索稿=风格 SoT、style-demos=留档),两份 08-20 稿注「结构面已被 2026-08-25 稿 §五 supersede,文案事实面仍现行」。

### B-4 repo-public-readiness §4.2「探针字面量集中在 scripts/publish-public-snapshot.sh」已过时

- **主张»:方案 §4 操作清单第 2 步称探针字面量集中在发布脚本;现实现中脚本只内联手机号正则一条(`scripts/publish-public-snapshot.sh:85-87`),其余隐私探针存于 Git 私有目录锚文件 `.git/info/saydo-private-probes`(:88-135 读取,要求常规文件、owner-only 权限、至少 1 条)。按文档去脚本里找字面量会落空。
- **证据**:脚本本会话全文 Read;`ls -la "$(git rev-parse --git-common-dir)/info/saydo-private-probes"` → `-rw-------@ wangyixiao`(存在,600)。
- **处置建议**:方案 §4.2 一句话更新(探针 = 脚本内联手机号正则 + `.git/info/saydo-private-probes` 私有锚)。

### B-5 cf50f52(清单第 1 条)无任何文档登记且未推送;dfb6f9d 在 R113 无 hash 级记载

- **主张**:`cf50f52`(08-27 18:45 入库 600 条提问线语料库全量实体)在 journal/docs 零引用,且尚未推送两仓;`dfb6f9d` 有 R113 叙事但 R113 只点名了第一批 `511787f`,第二批未记 hash。
- **证据»:`grep -rl cf50f52|dfb6f9d …` → NONE;`git log origin/main -1` → `12ba011`,`git log origin/main..HEAD` → `f723ab7`/`911ce95`/`cf50f52` 三条领先;R113 收尾记推送止于 `c383bc0..4866330`;公开快照 `public/main` = `f8db896`(from internal `12ba011`),不含语料库实体。
- **处置建议**:属在途状态(当日新提交),下轮收口时:R113 或新节补 `cf50f52`(及 `dfb6f9d`)hash,推送后同步公开快照。不构成错误,构成待办。

---

## 3. C 级观察

### C-1 gitleaks 基线漂移:方案记「434 commits 仅 2 条误报」,现为 713 commits 129 条命中(抽样全为假阳性类)

- **证据»:`gitleaks git . --no-banner` → 「713 commits scanned … leaks found: 129」(方案 §1 写 434/2)。按 规则×文件 聚合共 17 组,逐组抽样掩码检视:126 条 generic-api-key + 3 条 sourcegraph-access-token,类别为——测试标记串 `saydo-chil…`(48ch,≈110 条,分布在 daemon/cli/platform 测试)、`sshHostKeyFingerprint`/校验和 64-hex(rc12 evidence JSON,实读 :191 确认是指纹字段)、40-hex commit SHA(ai-supply 文档 :67 实读为「HEAD 174ab488…」)、RFC 6455 示例 `Sec-WebSocket-Key`(方案原注误报)、provider id `cn.baidu-q…`、文件名数组(方案原注误报)。未发现真实秘密;但方案的「2 条」声称已不可复现。
- **建议»:加 `.gitleaks.toml` allowlist(测试标记串、evidence 指纹字段)或在方案 §1 注记「基线为 2026-08-20 时点」;公开树的现役门是 `check-public-tree-privacy`(本会话实测 hits=0),不受影响。

### C-2 探索稿 §五 句面自相矛盾:「`●`(U+2713)…统一换成 `●`」

- **证据»:hexdump 实证该行两处反引号内字符均为 `e2 97 8f`(U+25CF ●),而括注写 U+2713([ok])——替换前后字符在句面上相同,读者无法还原原字符。成因可理解(文档自身不能携带禁区字符,R113 明说「刻意只写码点」),但此句连码点与所示字符都不对应。
- **建议»:改写为纯码点表述(如「U+2713 → U+25CF」,不展示字符)。

### C-3 CONTRIBUTING.md 未建(方案 §4.5 可选项)

- **证据»:`ls CONTRIBUTING.md` → No such file;同条可选项中 SECURITY.md 已建(:3 含 `support@octoooo.com` 私下披露口径,与方案一致)。可选项,不计疏漏。

---

## 4. A 部分核验明细(文档→commit)

### 4.1 repo-public-readiness(docs/plan/2026-08-20-repo-public-readiness.fable.md)

| 声称 | 判定 | 本会话证据 |
|---|---|---|
| LICENSE = Apache-2.0(commit `354b028`) | 属实 | `head LICENSE` 为 Apache 2.0 标准头,201 行,:189 `Copyright 2026 Yixiao Wang (汪义骁)`;`git show 354b028` 含 LICENSE/NOTICE/README/两个 package.json;`grep '"license"' package.json packages/cli/package.json` 均 `"Apache-2.0"`;GitHub 侧 `gh repo view Octo-o-o-o/SayDo --json licenseInfo` → `Apache License 2.0` |
| NOTICE 商标排除 | 属实 | NOTICE :2 版权行 + 名称/logo/assets 排除段(本会话 head 实读) |
| 全史 gitleaks 仅 2 误报 | 时点属实,现已漂移 | 见 C-1 |
| §3.1 P1 备案文件转存根、原文移 `~/.saydo/private/` | 属实(仓内侧) | `head docs/release/2026-08-13-tencent-icp-app-filing.md` 为存根,自述移出与私存路径;手机号探针 `git grep -clE '(^|[^0-9a-fA-F])1[3-9][0-9]{9}…' HEAD` → 0 文件(本机私存路径内容未验,超只读范围) |
| §3.1 P2/P3 字面抹除 | 属实(探针面) | `node scripts/check-public-tree-privacy.mjs --ref $(git rev-parse HEAD) --require-private-probes` → `scanned=2038 … hits=0`,true exit 0(探针含私有锚文件全部字面) |
| §3.1 原仓改名 SayDo-archive(private)、公开仓 SayDo | 属实 | `git remote -v`:origin=…/SayDo-archive.git,public=…/SayDo.git;`gh repo view`:archive PRIVATE / SayDo PUBLIC |
| §3.1 快照脚本 + README 归档节 + SECURITY.md | 属实 | `ls scripts/publish-public-snapshot.sh SECURITY.md` 均在;README :74-80「许可证」+「过程史与归档」两节实读 |
| §4.3 翻公开确认 | 属实 | `gh repo view Octo-o-o-o/SayDo --json isPrivate,licenseInfo` → `false` / Apache 2.0 |
| §4.4 官网「开源免费·前往 GitHub」生效 | 属实 | 部署首页 `grep -c 'github.com/Octo-o-o-o/SayDo'` 中英各 4 处;「开源免费」在信任条/hero note |
| §4.2 探针字面量位置 | 过时 | 见 B-4 |
| §4.5 可选项 | 部分 | SECURITY.md 有;CONTRIBUTING.md 无(C-3);About/topics/Issues 未查(未核实,影响小) |

### 4.2 seven-steps-gap-closure(七步完成度)

| 项 | 方案声称 | 现状实测 | 判定 |
|---|---|---|---|
| 步 3 / 批 S1(Demo 接线) | 开批落地 | `packages/daemon/src/packages/factory.ts:66-83,120-126` assemble/revise 同轮渲染 demo 并签入 `demoRef`;console `DemoFrame.tsx:1` iframe srcdoc + sandbox="";`packages/console/src/lib/api.ts:252` 调 `/api/artifacts/:id/versions/:version`;evidence `e2e/evidence/s1-demo-wiring.md` 在库(开批 HEAD `33c5cf1`) | 已落地,与 D-S1-2/3/4/5 一致 |
| 步 6 / 批 S2(回叫通道) | 开批落地 | `callback/sweep.ts:210` 调 `arbitrate(`;`callback/desktop.ts:45-46` osascript display notification;evidence `e2e/evidence/s2-callback-channels.md` 在库 | 已落地,与 D-S2-1/2 一致 |
| 批 S3(直达验收档) | 方案先行,暂不开批 | `brain/liveTools.ts:987` 仍有 `direct_mode_not_wired` | 一致(未开) |
| 批 S4(奠基深研) | 方案先行,暂不开批 | `memory/foundation.ts:3-4` 注释仍记「深研 = P1 沉思档承载…P1 接沉思档时语义回归 LLM token」,机械管道 | 一致(未开) |
| 步 1/2/7「全可用」 | 08-20 坐标级声称 | 未逐条复核(超出本审计抽查深度)——标注为未核实,无反证 | 未核实 |
| 步 5 W5.4「进行中」 | 08-20 时点 | R110(08-27)记 W5.4-b 四轮独立复审收口;方案为时点快照,不计错误 | 时点属实 |

R84 亦为 S1/S2 批提供索引(merge `1a41b45`/`aa2dffc`,评审 80/81/83)。

### 4.3 官网文案稿 vs deploy 实际 HTML(抽首页中英 + docs 页)

事实面一致、结构面按 11 号稿重写(结构偏离已由探索稿 §五 记录,归 B-3 的状态维护问题):

| 核对点 | 文案稿 | 部署页实测 | 判定 |
|---|---|---|---|
| H1 | 说到,就做到。/ Say it… | zh :95-97 glyph 拆字「说到,就做到。」;en「Say it, and it's done」(en 页与稿 B.1 的 *Say it. Consider it handled.* 不同——11 号稿重写,事实不损) | 同义 |
| hero 描述 | B.1 [改] 70+字收短版 | :98 再收短变体(读透项目/驱动已有 AI/办完叫你验收/无云端后台),事实同 | 同义 |
| 安装命令 | B.9 两种无源码入口(rc 固定 URL) | zh 首页 :519 `npm exec --yes --package=…v0.1.0-rc.12….tgz -- saydo up`(1 条,配「一条就够」+`/docs/#quickstart` 链);docs 页 :284/:287 两条齐(exec + `npm install --global`);en 同构;rc.12 与 `docs/site` 稿 §4.2 完全同串 | docs 页逐字一致;首页单条呈现属 11 号稿结构(B-3) |
| ICP 页脚 | B.12 京ICP备2025153079号-4A | zh/en/docs 三页各 1 处 | 一致 |
| FAQ | 五问+新增「要花钱吗」「会替我 push/开 PR 吗」 | 对话式 6 组,含订阅/费用组与「替我 push…开 PR」组(grep 命中) | 一致(形态为对话流) |
| 产品现状诚实区 | 7 卡(3 可用+4 Coming soon)→ 08-22 后口径 | 现为 4 卡(2 现在可用 + Claude Code 执行器·收口中 + 来电式语音汇报·规划中),桌面三端与移动三端状态移至 hero note(「macOS / Windows / Linux 现在可用」「iOS / Android / HarmonyOS 开发中」)与 #start 平台格(3 现在可用+3 开发中) | 事实一致,布局重排 |
| Claude Code 执行器口径 | B.6「收口中」(08-22 改) | 页面 badge 恰 1 处「收口中」 | 一致 |
| Docs 页关键事实 | §4.1-4.3(Node 22.x、端口 47100、saydo status/open、WebAuthn localhost、npm registry/Homebrew 未发布、常驻/通知 macOS-only) | `grep` 逐项命中:47100×13、`22.x`、saydo status×2、WebAuthn×4、「尚未发布到 npm registry 或 Homebrew」、「常驻安装与系统通知当前仍是 macOS 实现」;en 页 rc.12 + global install + npm registry 句同在 | 一致 |

### 4.4 homepage-style-exploration 选定方向 vs 部署

- 选定「11 号杂交(03 海报皮肤 × 01 对话骨架 × 04 环线图 × 08 总装图)」:部署页实测四要素齐——glyph 大字海报 hero(:95)、`.thread` 对话窗(FAQ 与 #dialogue)、「说到环线」闭环图(1 处,站名已按 §五 改简体)、`.sheet` 蓝图总装图(FAQ 回答「上面那张总装图」);`docs/site/style-demos/11-hybrid.html` 在库。
- §五「颜色一律消费 tokens 语义层、亮暗双主题」:site.css `var(--` 335 处、`:root[data-theme="dark"]` 系列规则、tokens.css 夜色层注释,均实测在。
- §五「`.map-card` 与 `.sheet` 两件实物道具不随暗色变色为有意设计」:site.css :8-9 头注逐字对应。
- §五 门禁修正句:见 A-2/C-2。

---

## 5. B 部分核验明细(commit→文档)

### 5.1 24 条逐个归属

| # | hash | 归属判定 | 文档锚(本会话 grep/实读) |
|---|---|---|---|
| 1 | cf50f52 | 本线(抢救入库/公开树卫生) | 无登记、未推送(B-5) |
| 2 | 4866330 | 本线 | R113 收尾(推送范围 `c383bc0..4866330`) |
| 3 | dfb6f9d | 本线 | R113 第二批叙事(无 hash,B-5) |
| 4 | 511787f | 本线 | R113 明文记 hash |
| 5 | 1d6680c | 本线(site 部分)+w54b 线混合 | R93 叙事 + `docs/review/2026-08-22-week-audit-ledger.md` #105 机械锚(15 文档/9 实现/4 测试逐项绑定) |
| 6 | cdf49f2 | 本线 | R92 §1 明文 + week-crosscheck + 台账 |
| 7 | 1679078 | 本线 | R85 §2(status-alignment 入库补记,收口码明文)+ `e2e/evidence/status-alignment-20260821.md` |
| 8 | 088b8f0 | 本线 | week-audit-ledger #83 + status-alignment evidence |
| 9 | f104563 | 本线(site 稿部分;主体 W5.4 方案) | week-audit-ledger #62 + 台账 |
| 10 | f7d7492 | 本线 | R84「public-readiness(08-20):merge f7d7492;evidence e2e/evidence/public-readiness.md;评审 78/79」 |
| 11 | c207729 | 本线 | week-audit-ledger #49 |
| 12 | 832e934 | 本线 | public-readiness.md + ledger |
| 13 | 39dbaef | 本线 | 同上 |
| 14 | 60e1147 | 本线 | 同上 |
| 15 | 33c5cf1 | 本线 | ledger + s1/s2 evidence(开批 HEAD 引用) |
| 16 | 7382f9c | 本线 | ledger |
| 17 | 96946e1 | 本线 | `e2e/evidence/public-readiness.md` F2 行逐字对应(SHA 全串) |
| 18 | 354b028 | 本线 | R84 + readiness 方案 §1 + 多份 IMPL-PROMPT/evidence |
| 19 | 3197fd8 | 本线 | R84「站点部署源入仓(08-15):3197fd8」 |
| 20-23 | 6a6568a/30cb277/e56bd27/ce0e381 | **不属本线**(focus 线) | 零文档引用(A-1) |
| 24 | edac8d0 | **不属本线**(w4/RA 线) | journal/台账/ra-closeout-batch(他线语境,A-1) |

R84 另记 public-readiness 批「HANDOFF/PLAN-2 无状态行(缺口登记,归 owner)」——既有登记,不重复立项。

### 5.2 chore(archive) 批门禁声称复核(当前树,HEAD f723ab7)

| 声称(commit message) | 本会话复跑 | 判定 |
|---|---|---|
| cf50f52/dfb6f9d:`check-doc-links files=114 broken=0` | `node scripts/check-doc-links.mjs` → `[ok] active document links: files=114 broken=0`,EXIT=0 | 吻合 |
| cf50f52/dfb6f9d:emoji clean | `bash scripts/check-emoji.sh` → `[ok] emoji gate: clean`,EXIT=0 | 吻合 |
| cf50f52:`public-tree-privacy hits=0`;511787f:`--fs exit 0、hits=0` | `node scripts/check-public-tree-privacy.mjs --fs` → `scanned=2038 binary=108 excluded=8 hits=0`,EXIT=0;`--ref <HEAD40> --require-private-probes` 同 hits=0,true exit 0 | 吻合 |
| 4866330:`test-public-text-redaction 28 pass / 0 fail` | `node scripts/test-public-text-redaction.mjs` → `pass=28 fail=0`,true exit 0 | 吻合 |
| 4866330:`just ci exit 0(contracts 111 / daemon 2174…)` | 未复跑(全量 CI 重,超出只读校验授权意图) | 未复核 |

### 5.3 官网部署证据 vs deploy 内容

- `e2e/evidence/2026-08-26-rc12-site-deploy.md`:wrangler 4.112.0 OAuth,preview→production 双站表,commit 绑定 `80ff448`——本会话 `git cat-file -t 80ff448` = commit(2026-08-26 chore(evidence): 随 §17 重生成账本),可解析。
- 线上与仓内逐字节比对(本会话 curl + diff):`https://saydo.octoooo.com/` 与 `deploy/saydo-octoooo-com/index.html` DIFF_EXIT=0;`/en/`、`/docs/`、`/en/docs/` 均 SAME。evidence 的「rc.12 出现」计数与本地 grep 口径一致(zh 首页 3 行)。
- 更早部署记录:R93(08-22 wrangler pages deploy,week-crosscheck :157)在库;08-25 重构上线无证据文件(B-2)。

---

## 6. 审计局限

- 未复跑全量 `just ci`(5.2 注);seven-steps 步 1/2/7 的坐标级「全可用」声称未逐条下钻;`~/.saydo/private/` 私存原件、GitHub About/topics/Issues 设置未查。
- gitleaks 129 条命中按 规则×文件 全 17 组抽样分类,未逐条(129/129)人工检视;分类结论为「抽样内全假阳性」,不外推为逐条断言。
- 线上比对仅覆盖四主页面(privacy/terms/support/link 站未比对)。
