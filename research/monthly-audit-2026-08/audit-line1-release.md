# RC 发布链 commit↔文档 双向对照审计报告（line1-release）

- 审计日期：2026-08-27
- 审计对象：SayDo 仓库（~/WorkSpace/SayDo，main = `f723ab7`）RC 发布链工作线，39 个 commit（清单 line1-release.txt，b201514/07-30 → 9a3e180/08-27）
- 审计员：零上下文独立会话（只读；未修改/新建任何仓库正式文件，未 git add/commit）
- 证据纪律：每条发现均附本会话真实执行命令的输出摘录；外部核验用 `git ls-remote` 与 `gh api`（只读）
- 锚定文档：docs/release/v0.1.0-rc.12.md、v0.1.0-rc.12-assets.json、release-profile.yaml、README.md（docs/release/）、metadata.json、version-matrix.md；docs/review/2026-08-25-rc4-runtime-final-reimplementation-readback.md §13–§17（RC 链唯一叙事载体）；docs/review/2026-08-23-remediation-ledger.md；history/PROCESS-JOURNAL.md R94–R97/R110；e2e/evidence/2026-08-26-rc10/11/12-*.json、2026-08-26-rc12-physical/、2026-08-26-rc12-site-deploy.md；HANDOFF.md

## 计数

| 级别 | 数量 |
|---|---|
| A（错误/不一致） | 2 |
| B（疏漏/不足） | 2 |
| C（观察） | 5 |

---

## A 级发现

### A-1 rc.12 发布说明（即已发布的 GitHub Release 正文）沿用 rc.4 时代文本，两处事实性断言与已落地实施矛盾

**主张**：`docs/release/v0.1.0-rc.12.md` 是 rc.12 的 GitHub Release 正文来源（release.yml publish 步骤 `notes_file="docs/release/${GITHUB_REF_NAME}.md"`，mark-release-available 步骤以同文件覆写正文），其内容与 rc.4 说明逐字相同（仅版本串替换，python difflib 实测唯一差异是 rc.4.md 后加的「manifest 已被取代」括注）。其中两处断言对 rc.12 为假：

(a) 「三项 exact-set 的 filename、**bytes、sha256**（tgz 另含 **npmIntegrity**/entryCount）以及 sourceRevision/buildId/protocolVersion 冻结在仓内 tracked manifest `v0.1.0-rc.12-assets.json`」——实际 v2 manifest **没有** bytes/sha256/npmIntegrity。发布合同 v2（commit `0a2f290`，rc.7→rc.8 之间）明确把这三个机器相关字段移出 tracked manifest（「外壳字节交还 CI 自洽链」），且该 commit 的 `--name-only` 只有 `.github/workflows/release.yml` + 3 个 scripts，未同步更新发布说明。

(b) 「**本候选替代未创建 Release 的 rc.3**」「rc.3 标签与首次失败 Actions 记录继续保留」——rc.12 实际取代的是 rc.11（全绿 available 的 Release，`gh api` 实测标题 `SayDo CLI 0.1.0-rc.11`）。「替代 rc.3」是 rc.4 说明的句子，随 8 次改名 bump 原样带到 rc.12。

**证据**：
- `docs/release/v0.1.0-rc.12.md:16` 起句「本候选替代未创建 Release 的 rc.3」；`:20` 含「filename、bytes、sha256（tgz 另含 npmIntegrity/entryCount）…冻结在仓内 tracked manifest」（本会话 Read 原文）。
- `docs/release/v0.1.0-rc.12-assets.json` 全文 23 行（本会话 Read）：tgz 条目仅 `filename/entryCount/contentDigest`，SHA256SUMS 与 release-metadata.json 仅 `filename`；无 bytes/sha256/npmIntegrity。schema = `saydo-release-assets/v2`。
- `git show 0a2f290 --name-only` → 仅 `.github/workflows/release.yml`、`scripts/release-asset-manifest.mjs`、`scripts/test-release-provenance.mjs`、`scripts/verify-release-url.mjs`；commit body 明言「bytes/sha256/npmIntegrity 移出 tracked manifest」。
- `scripts/release-asset-manifest.mjs:183-200`：tracked 只承载 filename（tgz 另 entryCount/contentDigest）；`:15-16` 注释同义。
- python difflib 对比（版本串归一化后）：rc.12.md 与 rc.4.md 唯一差异为 rc.4.md 的取代括注；即「替代 rc.3」段完整继承。
- `.github/workflows/release.yml` publish 步骤 `notes_file="docs/release/${GITHUB_REF_NAME}.md"`；mark-release-available 用同文件把正文写回并断言 `release.body.trimEnd() === notes`。
- `git diff main 7a9b6e8 -- docs/release/v0.1.0-rc.12.md` 为空（tag 内文本与 main 相同）→ 已发布正文确为此文本。tag 内 assets.json sha256 与 main 逐字节一致（`ed7b76db…` 两侧相同）。
- `gh api repos/Octo-o-o-o/SayDo/releases` → rc.10/11/12 标题为 `SayDo CLI 0.1.0-rc.X`（available），rc.8/rc.9 为 `UNAVAILABLE - …`；rc.2–rc.7 无 Release（印证「替代 rc.11 而非 rc.3」）。

**波及面**：同一文本自 rc.8 起随每次 bump 发布——rc.8–rc.12 五个已发布（immutable）Release 正文都带 (a)；(b) 在全部改名版本中存在。

**建议处置**：对齐实施。已发布 Release 正文按纪律不追改（immutable + 不重跑）；应修 `docs/release/v0.1.0-rc.12.md` 在仓内的文本（改为合同 v2 口径 + 正确的 supersede 链），使 rc.13+ 继承正确文本；并在 readback 或 journal 登记「rc.8–rc.12 已发布正文带 v1 合同表述」这一既成事实。是否给 rc.12.md 增补勘误段由 owner 裁决。

### A-2 版本 SoT（version-matrix.md）与 release-profile.yaml 注释仍断言 CLI = 0.1.0-rc.4，与已 available 的 rc.12 直接矛盾，且引用已删除文件

**主张**：`docs/release/release-profile.yaml:12` 指定 `version_sot: "docs/release/version-matrix.md"`，注释写 `# shells 0.1.0 (1); CLI remains 0.1.0-rc.4`。而 version-matrix.md 头部（更新止于 2026-08-23）写「CLI 仍为 `0.1.0-rc.4`，不得改桌面 tag/version」，§1 表格 Desktop CLI 行版本 `0.1.0-rc.4`、build code 「见 `docs/release/v0.1.0-rc.4-assets.json`」。实际：`packages/cli/package.json` version = `0.1.0-rc.12`；公开仓 tag `v0.1.0-rc.12` 存在且 Release 为 available；README 与官网四页均已翻转到 rc.12；`v0.1.0-rc.4-assets.json` 已在 `e37ebe5`（rc.4→rc.5 bump）删除，现树不存在。被指定为「版本 SoT」的文档当前给出错误版本并挂空引用。

**证据**：
- `docs/release/release-profile.yaml:12`（Read 原文）：`version_sot: "docs/release/version-matrix.md"  # shells 0.1.0 (1); CLI remains 0.1.0-rc.4`。
- `docs/release/version-matrix.md:5`「更新:2026-08-23。CLI 仍为 `0.1.0-rc.4`，不得改桌面 tag/version」；`:11` 表行 `0.1.0-rc.4` + 「见 docs/release/v0.1.0-rc.4-assets.json」。
- `packages/cli/package.json:3` `"version": "0.1.0-rc.12"`（本会话 head 实读）。
- `ls docs/release/` → 无 v0.1.0-rc.4-assets.json，仅 v0.1.0-rc.12-assets.json；`git show e37ebe5 --stat` → `docs/release/v0.1.0-rc.4-assets.json | 28 ----`（删除）。
- `git ls-remote public 'refs/tags/*'` → `7a9b6e8… refs/tags/v0.1.0-rc.12`；`gh api …releases` → `SayDo CLI 0.1.0-rc.12`（available）。
- README.md:18-29（grep 实读）：rc.12 固定 URL 已由不可变 Release 验证可直接使用。

**附带澄清（审计任务问到的「release-profile.yaml 的 availability 字段」）**：release-profile.yaml **不存在** availability 字段（全文 Read 核实）。availability 状态的实际载体是：README/docs-site 两份 fable 稿/官网四页的文案锚（release 工具以 before/after 快照替换，见 scripts/release-availability.mjs）+ GitHub Release 标题 + e2e/evidence/2026-08-26-rc12-availability.json。profile 里与版本相关的失真只有上述 line 12 注释。

**建议处置**：对齐实施。更新 version-matrix.md Desktop CLI 行（rc.12、build code 指向 v0.1.0-rc.12-assets.json、可分发性=available Release）与 release-profile.yaml line 12 注释。「不得改桌面 tag/version」这句当年是对移动线的约束，宜改写为明确的适用范围，避免再被读作现行事实。

---

## B 级发现

### B-1 rc.5–rc.9 五个已烧版本在仓内没有任何逐版验收/失败证据工件，链条中段证据惯例断档

**主张**：项目对失败候选的既有惯例是落证据文件（rc.2/rc.3 → `e2e/evidence/2026-08-23-rc3-release-recovery.md`；rc.4 → `2026-08-23-rc4-release-candidate.md`），对成功版本落 verify JSON（rc.10/11/12 → `2026-08-26-rc1X-release-verify.json`）。但 rc.5、rc.6、rc.7、rc.8、rc.9 五个版本（各自失败于 doc-links / e2e 偶发+断退路 / 合同前提证伪 / smoke 3 项 / smoke 1 项）在 e2e/evidence/ 与 research/ 均无对应工件；其失败定性只存在于 bump commit message 与 readback §14–§16 的叙述（均不带 commit hash，不带原始输出存档）。§14 引用的关键数字（rc.7 sourceRevision `df3ba41e…`、本地/CI tgz 1201207/1208305 字节、容器 sha `88645e07…`）在仓内无任何一手输出可复核，属未核实的会话自述。

**证据**：
- `ls e2e/evidence/` → 存在 2026-08-23-rc3-release-recovery.md、2026-08-23-rc4-release-candidate.md、2026-08-26-rc10/11/12-release-verify.json、2026-08-26-rc12-availability.json、2026-08-26-rc12-physical/、2026-08-26-rc12-site-deploy.md；**无任何 rc5–rc9 条目**。
- 逐 hash 全仓 grep（docs/ history/ research/ e2e/）：08-26 全链 19 个 commit 中除 `410eb84`（1 处，journal R113 语境）外全部 0 引用。
- 旁证（外部实测，支持叙述真实性而非替代证据工件）：`gh api releases` → rc.8/rc.9 Release 标题 `UNAVAILABLE - SayDo CLI 0.1.0-rc.8/9`（immutable），rc.5–rc.7 无 Release——与 §15/§16「smoke 失败永久 unavailable」「rc.7 死在 publish 校验」吻合。

**建议处置**：需 owner 裁决。可选：(1) 认可「commit message + readback 叙述 + GitHub 侧不可变记录」为 rc.5–rc.9 的证据形态并在 readback 显式声明；(2) 补一份轻量的 rc5–rc9 失败台账（引用各 run id/URL——run id 可从 GitHub Actions 历史回查）。不建议伪造事后「证据」，只登记可回查的坐标。

### B-2 08-26 RC 链（rc.4→rc.12 + 合同 v2 + 实体门 + availability 翻转,21 个 commit）没有 PROCESS-JOURNAL R 条目，唯一叙事载体挂在标题/日期为「2026-08-25 RC4 runtime 重实施 readback」的文档尾部

**主张**：PROCESS-JOURNAL.md 的 R 编号总纲覆盖到 rc.2→rc.4（R95/R96/R97，2026-08-23），随后 R98–R109 全是 AI 供给线，R110（08-27）只回收了 ios 门禁回归（9a3e180），R111 起是其它线。整月最重的发布里程碑——08-26 单日 21 个 commit：9477c70→410eb84，含发布合同 v2、六项 smoke 首触发、实体门三缺陷、availability 翻转——在 journal 总纲中没有条目。其完整叙述位于 `docs/review/2026-08-25-rc4-runtime-final-reimplementation-readback.md` §14–§17，但该文档标题、日期前缀（08-25）与开头元数据（「RC4 runtime 全新重实施——实施与验证报告」）都不指向 RC 链收口；不知情读者按文件名/标题检索「rc.12 收口在哪」会落空（本会话作为零上下文审计员即是实证：需 grep 关键词才定位到 §17）。

**证据**：
- `grep -n "^## R" history/PROCESS-JOURNAL.md` 尾部 40 条：R95(rc.2→rc.3)、R96(rc.3→rc.4)、R97(rc.4 复验)之后无任何 rc.5–rc.12 条目；R110 标题「W5.4-b 四轮独立复审收口、ios 门禁回归修复…」。
- journal 全文 grep `rc.12|rc.11|rc.10|availability`：命中仅 2179（R97 展望句）、2796/2803-2804（R110 门禁语境）、2921-2922/2940（R113 抢救保全语境）——全部是他线条目的旁及，无 RC 链自身条目。
- readback 文档头部（:1-9）自述为 RC4 runtime 重实施报告，worktree/branch/验收合同均是 runtime 线坐标；§14–§17 为后续追加。
- HANDOFF.md:48 的「详账见 docs/review/2026-08-25-rc4-runtime-final-reimplementation-readback.md」是当前唯一的显式指路。

**建议处置**：对齐文档。补一条 R 条目（或在 R110 前插补记）索引 RC 链收口，指向 readback §14–§17 与三份 verify JSON/physical 证据；readback 文档头部加一行范围声明（本文档 §13 起承载 release 线合并→rc.12 收口）。属文档组织问题，不涉实施回改。

---

## C 级观察

### C-1 rc.4→rc.5 bump 拆成 3 分钟内两个同题 commit，第一个的 message 描述了它 diff 里不存在的改动

`e37ebe5`（09:27）与 `72e30a1`（09:29）subject 完全相同（`release: bump 0.1.0-rc.4 -> 0.1.0-rc.5`）。`git show e37ebe5 --stat` 仅 2 个文件（rc.4-assets.json 删除 + rc.4.md→rc.5.md 改名），但其 message 列出「版本绑定逐处更新: packages/cli/package.json / release.yml / release-physical-closure.mjs」——这些实际落在 `72e30a1`（stat 含 package.json、release.yml、rc.5-assets.json 新建等 7 文件）。两个一起看内容完整，单看第一个则 message 与 diff 不符（疑似暂存拆分事故）。观察项，无需处置；若在意历史整洁可在 readback 挂一句注记。

### C-2 「各版本发布说明并存」的政策在 rc.6 起被收窄，收窄依据只存在于 commit message

`c35d1ba` 明言「正确形态是各版本发布说明并存:rc.2 / rc.3 / rc.4 / rc.5」（因 rc.4.md 是账本 cross-link 引用的历史证据，改名会红 week-audit --check）。但 `8874105`（rc.5→rc.6）起恢复改名策略，理由「已确认未被账本 cross-link 引用,与 rc.4.md 不同,故可改名」——现树因此只有 rc.2/rc.3/rc.4/rc.12 四份说明，rc.5–rc.11 无。实际规则已演化为「被账本引用的留存,其余随 bump 改名」，该规则没有落入任何文档,只散在两条 commit message 里。建议随 A-1 修 notes 时在 docs/release/README.md 或 readback 补一句现行规则。

### C-3 HANDOFF.md 对 rc.4–rc.9 不可用原因的归因不精确；§1 标题仍是 rc.4 时点

HANDOFF.md:48「rc.4–rc.9 的 tag 存在但按 `run_attempt===1` 铁律永久不可用」——run_attempt 铁律（smoke 失败不可重跑）严格说只适用于走到 smoke 的 rc.8/rc.9（`gh api` 实测二者有 UNAVAILABLE Release）；rc.4–rc.7 根本没有 Release（各死于 publish 校验/质量门），其不可重跑源于「tag==origin/main 快照校验 + workflow 全历史恰一次」组合。另 HANDOFF §1 标题（:19）仍写「rc.4 补救候选正在收口」——文档自身声明:48 为唯一现时坐标行,标题按其 supersede 语义算历史残留。低危,顺手改时一并修。

### C-4 rc.2/rc.3 发布说明保留完整安装命令但对应固定 URL 是 404，文内无失败横幅

rc.2/rc.3 从未创建 Release（gh api 实测 releases 只有 rc.8–rc.12 五个），但 `docs/release/v0.1.0-rc.2.md` / `v0.1.0-rc.3.md` 仍以「这是…预发布快速启动包。…运行:」开头给出 `releases/download/v0.1.0-rc.2/...` 安装命令；rc.2.md 甚至没有 rc.3.md 那句 supersede 说明,也没有 rc.4/rc.12 版的「本页描述的是发布候选合同,不是对外放行声明」。零上下文读者可能照抄命令得到 404。建议在两文件顶部各加一行「该候选未产生 Release,历史保留」。

### C-5 08-23→08-24 发布加固批（43cb7ff/e22be46/89cdc22/704048f/85c9a51/8b123ac）与 08-26 小改（358c451/0e33260）的文档痕迹只在 prompts/ 工作文件

remediation ledger（docs/review/2026-08-23-remediation-ledger.md）范围止于 `3fccf4a..b768089`；此后 08-23 晚→08-24 的六个 fix(release)（Codex 评审回修环）hash 仅出现在 prompts/114–203 的评审往返文件,readback 正文只点名 `3bafd53`（§13 tag ruleset guard 归属）与 `09f7920`（ios 门禁引入,经 R110 回指）。`358c451`（诊断增强）与 `0e33260`（官网在途改动合入）全仓零引用。prompts/ 是 tracked 的一手往返记录,可接受;列为观察,供 owner 判断是否要求 canonical 文档兜底。

---

## 双向对照结论明细

### 1) 文档→commit：锚定文档事实断言核验表（抽样标注证据来源）

| 断言 | 结论 | 证据 |
|---|---|---|
| rc.12-assets.json：tag/v0.1.0-rc.12、version 0.1.0-rc.12、schema v2 | [ok] | Read 原文;packages/cli/package.json 同版本 |
| rc.12-assets.json sourceRevision `11036438bc74…`/buildId/protocolVersion | [ok] 三方一致 | 与 e2e/evidence/rc12-release-verify.json、rc12-physical/4 份、rc12-availability.json 逐字段相同(python 实读) |
| buildId 构造口径 | [ok] | packages/cli/scripts/build.mjs:90-96:`${version}+${rev12}.p${protocol 点转横}.c${inputDigest12}`——与 `0.1.0-rc.12+11036438bc74.p1-0-0.c11036438bc74` 吻合 |
| contentDigest 口径(解包按路径排序逐文件 sha256 聚合) | [ok] | scripts/release-asset-manifest.mjs:91-108 tarballContentDigest 实现与注释 |
| tgz entryCount=17 | [ok](与全链口径一致) | R94/R95/§14 均 17;manifest --check 消费同函数 |
| rc.12.md「bytes/sha256/npmIntegrity 冻结在 tracked manifest」 | [fail] **A-1(a)** | 见 A-1 |
| rc.12.md「本候选替代未创建 Release 的 rc.3」 | [fail] **A-1(b)** | 见 A-1 |
| rc.12.md「公开 tag 推送前…零次 push run + active tag ruleset」 | [ok] | scripts/publish-public-snapshot.sh:76-77/176-177(`uniqueness --require-zero` + `ruleset`);release-tag-guard.mjs:132-151 逐条校验 active/tag/零 bypass/deletion+update |
| rc.12.md「workflow 全历史恰好一次且 run_attempt=1;三处重读远端 tag SHA」 | [ok] | release.yml snapshot(:26)/publish(:147 及 create 前 :223-227)/mark-available(:345 及改标题前)均有 `git ls-remote` 重读 + `uniqueness --require-current`;另有 `Refuse availability on a rerun attempt`(run_attempt≠1 即红) |
| rc.12.md「availability 文案与证据/审计包按同一事务写入」 | [ok] | `git show 410eb84 --stat`:README+官网 4 页+2 fable 稿+availability/physical 证据+2 账本 JSON 同一 commit |
| rc.12.md「Pages 先 preview 后 production」 | [ok] | e2e/evidence/2026-08-26-rc12-site-deploy.md:preview→验证→production 表格与线上四页实测(owner 以 wrangler OAuth 执行,裁决记录在案) |
| rc.12.md「空 npm cache、空全局 prefix、空 SAYDO_HOME…无 daemon 孤儿」 | [ok](实质等价) | verify-release-url.mjs:39-44 scratch cache/prefix/user-home/saydo-home,:176-186 HOME 全套覆写,:335 `--home saydoHome`,:460 noOrphans。注:SAYDO_HOME 非 env 字面量,经 `--home` 旗标实现,语义等价 |
| release-profile.yaml availability 字段 | 字段不存在(澄清见 A-2) | Read 全文 |
| release-profile.yaml「CLI remains 0.1.0-rc.4」/version-matrix「CLI 仍为 rc.4」 | [fail] **A-2** | 见 A-2 |
| readback §17 rc.10「首个全绿 available,15 job 全绿」 | [ok] | `gh api runs/32959475535` success/attempt1;`/jobs`:16 个 job,0 失败,1 skipped(mark-failed)→15 个执行且全 success |
| readback §17 rc.11/rc.12 全绿 available | [ok] | runs/32962334198、32964777392 均 success/attempt 1,head_sha=各 tag SHA;Release 标题无 UNAVAILABLE 前缀 |
| readback §17 实体门四项真机/45 分钟窗/指纹两两一致且互异 | [ok] | post-release-gate.mjs:680-683 四条 invariant;rc12-physical 4 份 JSON:Mac fp `7d16a84d…`×2,Win fp `0fa86657…`×2,互异,testedAt 全落 11:51:08–11:51:59(52 秒) |
| readback §17「公开仓 main(ec605d9)携带翻转文案,ci 全绿」 | [ok] | `git log -1 ec605d9`=snapshot from internal 410eb84;`gh api runs?head_sha=ec605d9c283f…`→ci success attempt 1 |
| readback §15 rc.8 smoke 3/6、两类缺陷、永久 unavailable | [ok](处置与状态);根因数字未核实 | 9d36acf diff:tar cwd+basename 改造(verify-release-url 三处+manifest 两处)、exec 验收 {0,130,SIGINT}、waitGone 加强;gh api:rc.8 UNAVAILABLE immutable |
| readback §16 rc.9 进程组 SIGINT 修复 | [ok] | f6f425c diff:`process.kill(-proc.pid, "SIGINT")` + 回退直发;gh api:rc.9 UNAVAILABLE |
| readback §17 缺陷1 remoteCommand 内层引号 | [ok] | c0df247 diff:`"cd /d ${root} && …"` 外包引号,post-release-gate.mjs |
| readback §17 缺陷2 mutate 先入 index | [ok] | 10e1cde diff:add-before-refreshAuditBundle + 失败对称 `git reset`,post-release-gate.mjs |
| readback §14 rc.7 定界数字(df3ba41e/7098B/88645e07) | [warn] 未核实 | 仓内无一手输出工件(见 B-1);commit 0a2f290 body 与 §14 同源复述,不构成独立证据 |
| R110「9a3e180 删 ios 门禁,main 转绿,d83c341 为引入点」 | [ok] | 9a3e180 diff:删 scripts/test-ios-build-and-install.mjs(54 行)+justfile/package.json;该脚本由 09f7920 引入(`git log --diff-filter=A`);main 现况 just ci 未在本会话重跑(未核实),但 HEAD 含该修复 |
| 账本外部锚已跟到 rc.12 | [ok] | scripts/week-audit.mjs:435 `expectedPublication?.tag !== "v0.1.0-rc.12"` 即抛错 |

### 2) commit→文档：39 个 subject 全扫结果

- **版本链完整性**：rc.2→rc.3(`23c2251`)→rc.4(`951249e`)→rc.5(`e37ebe5`+`72e30a1`)→rc.6(`8874105`)→rc.7(`8dd9fe0`)→rc.8(`a6e76f8`)→rc.9(`37c6209`)→rc.10(`886d375`)→rc.11(`34449e5`)→rc.12(`4e5f09f`)——链无缺环;公开仓 11 个 tag rc.2–rc.12 全部存在(`git ls-remote` 全量,无截断)。每个 bump 的 commit body 都记录了上一版失败根因与本版差异(逐条读取核实)。内部链型 bump→`chore(evidence) 账本重生成`→snapshot→tag 在 rc.10/11/12 均成立(例:`329a40d^`=`4e5f09f`,snapshot `7a9b6e8` 声明 from internal 329a40d,tagSha 与 verify JSON 一致)。
- **逐版 verify 证据**:rc.2/rc.3/rc.4 有 e2e/evidence 文档;rc.10/11/12 有 verify JSON + (rc.12)physical/availability/site-deploy;**rc.5–rc.9 无仓内工件**(B-1)。
- **精读 diff 的重点 commit(8 个)**:`0a2f290`(合同 v2)、`9d36acf`(tar/竞态)、`f6f425c`(进程组 SIGINT)、`c0df247`(引号)、`10e1cde`(入 index)、`410eb84`(翻转)、`9a3e180`(ios 门禁)、`e37ebe5`+`72e30a1`+`1fb3b17`+`c35d1ba`(rc.5 bump 组)——实施与其 message/readback 描述全部一致,未发现「声称完成实际未做」。
- **08-22 前旧提交**:`174ab48`(21 处文档引用)、`951249e`(7)、`23c2251`(5)等由 docs/review/2026-08-23-remediation-ledger.md 双向账本覆盖;`479634c`/`aac3d60`/`b201514` 各有 7–8 处文档引用(journal R80–R88/R84 等)。
- **文档痕迹薄弱者**:见 B-2(08-26 整链 hash 零引用)与 C-5。

### 3) 发布合同 v2 条款 vs release 脚本实际行为

逐条比对 `0a2f290` body 声明与现行代码:tgz 绑 {filename,entryCount,contentDigest} [ok](manifest.mjs:31,192-197);SHA256SUMS/metadata 只绑文件名 [ok](:200 非 tgz 禁 entryCount/contentDigest,构建侧只写 filename);Release API 断言=文件名集合+size>0 [ok](:288-296);载荷级来源绑定 [ok](verify-release-url.mjs:101-134 tgz 内嵌 build-metadata 三元组→assertIdentityMatchesTrackedManifest);publish job upload-artifact 留痕 30 天 [ok](release.yml:172-178,含 rc.7 教训注释);v2 回归锚 [ok](test-release-provenance.mjs 在 0a2f290 改写,未逐行复读——标记为轻度未核实)。唯一与合同 v2 矛盾的是发布说明文本(A-1)。

## 未核实项(如实声明)

1. rc.7 定界的具体数字(df3ba41e…/1201207/1208305/7098B/88645e07…)——仓内无一手工件,GitHub artifact 留痕 30 天且当时 job 无 upload(该机制正是 rc.7 之后才加的)。
2. test-release-provenance.mjs 的 v2 回归锚未逐行读。
3. main 当前 `just ci` 未在本会话重跑(9a3e180 之后 R110 自述 exit 0)。
4. 官网线上现值未实测(采信 e2e/evidence/2026-08-26-rc12-site-deploy.md 的四页实测记录)。
5. 三平台 smoke/质量 job 的逐 job 日志未拉取,以 run/jobs conclusion 聚合值为准。
