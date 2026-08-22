# 88 · 版本记录对账评审(version-records-audit)· Codex 对抗评审报告

> 命令:`codex exec -m gpt-5.6-sol -c model_reasoning_effort=max -s read-only`(prompt = `prompts/88-version-records-audit-review.md`);2026-08-21;耗时约 33 分钟,exit 0。
> 日志:`logs/88-version-records-audit-review.log`(1173802 bytes / SHA-256 `dcc4802264814a47f7c6651f012d2ff8cce3af2c9fd7a2f00aa819b94751ac23`,不入 Git)。
> 本文件 = Codex 报告原文(§A)+ 调度会话 triage(§B,同日)。

## A. Codex 报告原文

结论先行：按 P1–P8 原文执行，结论是 No-Go。不是所有发现都完整成立，但 P1、P3、P5、P7 含有会写入错误事实的路径；当前并行 R80 还存在晚到且未提交的网页、备案和材料改动。完成下述修订，并由 owner 裁决公开快照边界后，才可转为“修改后 Go”。本次只读，未改文件。

取证基线：

- `git rev-parse HEAD origin/main` 均为 `11e3653012584ae1ec3dde61d58938871e1d2a77`；`git log` 显示 `1679078`、`920af91`、merge `11e3653` 依次于 09:32–09:33 入库；`git reflog` 有 `refs/remotes/origin/main ... update by push`。
- `git ls-remote origin refs/heads/main` 本会话失败，输出 `Failed to connect to 127.0.0.1:7897`，退出码 128。因此只能证明本地 tracking ref 和 push reflog，不能复读远端当前状态。
- `git status --short` 实测 20 个已修改 tracked 路径、4 个 untracked 项；包含 `history/PROCESS-JOURNAL.md`、`history/DEV-VERSION-LEDGER.md`、R80 release 文件、deploy 页面和软著材料。
- `bash scripts/check-emoji.sh` 在 `scripts/check-emoji.sh:21` 的 `mktemp` 处因权限错误退出 1，尚未扫描，不能记为 clean。
- 按仓库纪律尝试启动指定 Codex 对抗审查时，进程因 `Operation not permitted` 未初始化成功；以下结论不采信该进程输出。

## F1–F9

### F1：部分成立，级别 B

证据：

- `git log` 和 reflog 证明 `1679078`、`920af91`、`11e3653` 已在本地 main；`HANDOFF.md:22` 仍写活动树 `088b8f0` 和“本批不以提交收口”。
- `history/PROCESS-JOURNAL.md:1661-1687`（R78）和 `:1689-1708`（R79）仍写未 commit/push。
- `e2e/evidence/status-alignment-20260821.md:3-5`、`:130`、`:197`保留原始“未提交”结论，但同文件 `:199-201` 已追加 owner 授权后的入库事实。

所以“journal/HANDOFF 没有同步入库动作”成立；“evidence 全文仍只写未提交”不成立，应判部分成立。远端“已同步”只能写成本地 tracking/push 证据。

### F2：成立，级别 B；P1 对应 A 级风险

证据：

- `git show --stat cb2fba8` 输出：`history/PROCESS-JOURNAL.md` 删除 28 行。
- `git show cb2fba8^:history/PROCESS-JOURNAL.md` 的 `:1595-1622` 是完整 cmdeffect R75；当前 journal `:1595` 已被官网 R75 占用。
- `e2e/evidence/cmdeffect-hardening.md:133` 明确写 journal 索引待补。

发现成立。但旧 R75 `:1604` 写 `just ci EXIT=0`，当前 evidence `:78`、`:169`、`:232` 三处均写 `just ci` 为 2（Python `uv` 沙箱受阻）。直接全文恢复会制造未解释的门禁矛盾。

### F3：部分成立，级别 B

证据：

- `git log --merges` 给出四个 2026-08-20 merge：`f7d7492`、`1a41b45`、`aa2dffc`、`7fb3fa1`。
- 对应 evidence 文件首行分别确认 2026-08-20：`e2e/evidence/public-readiness.md:1`、`s1-demo-wiring.md:1`、`s2-callback-channels.md:1`、`w54a-claude-cli.md:1`。
- `rg` 在 `history/PROCESS-JOURNAL.md` 中找不到这四个批次名称。
- 但 `rg` 在 `HANDOFF.md` 和 `IMPLEMENTATION-PLAN-2.md` 中只找到 `w54a-claude-cli`，找不到前三批；`e2e/evidence/s1-demo-wiring.md:6` 还明确写“不写 HANDOFF 当前批次指针”。

因此 journal 欠账成立；prompt 所称“四批 HANDOFF/PLAN 状态行齐全”不成立。P1 乙必须同时登记这三个状态行缺口或明确授权例外。

### F4：部分成立，级别 B

证据：

- journal headings 从 `R63:1040` 直接到 `R64:1124`，没有 8 月 4–10 日 Focus Contract 批次名称。
- `git rev-list --count` 对 7/31–8/11、8/11–8/16 分别得到 122、147 个提交；`e2e/evidence/focus-contract-batch.md` 及 `HANDOFF-2-页面拼装施工交接.md`、`HANDOFF-3-UI修正批施工交接.md`、`HANDOFF-4-资源画像向导批.md` 存在。
- 8/12–8/15 并非整段无轮次：journal 已有 R64–R68、D1 无编号条目、R69/R70、R71；但 `a7d517c`（M2+D1）、`6cd362d`（voice-fix）、`aa8034e`（批 B）仍没有各自索引。

空洞和大量遗漏成立，但“整段完全无轮次”过宽。

### F5：成立，级别 B

证据：

- `docs/plan/IMPL-PROMPT-11-PUBLIC-READINESS.md:1` 和 `IMPL-PROMPT-11-STATUS-ALIGNMENT.md:1` 都写“第十一轮交接”。
- `IMPL-PROMPT-12-S1-DEMO-WIRING.md:1`、`IMPL-PROMPT-13-S2-CALLBACK-CHANNELS.md:1` 分别占用第十二、十三轮。

按时间序列把状态对齐登记为第十四轮合理，但应标为事后勘误，不改历史派发正文。

### F6：部分成立，级别 B

证据：

- R70 确有两节：`history/PROCESS-JOURNAL.md:1454`、`:1471`。
- 设计序列 `R34:489` 后直接到 `R36:505`，但实施序列在 `:569` 存在 R35。因此是“设计序列缺 R35”，不是全 journal 缺 R35。
- 文件头 `:4` 仍写“截至 07-22、共 16 轮”，速览表 `:9-37`止于 R25。
- `history/README.md:7`只说明旧的 R54/R55，未覆盖 R70 等后续重复。

F6 的三类问题成立，但需限定语境和统计层级。

### F7：成立，级别 B

证据：

- `find research/codex-findings -name '75*' -o -name '76*'` 无报告文件。
- `logs/75-website-redesign-review.log` 和 `logs/76-website-docs-review.log` 存在，大小分别 2928、2908 bytes。
- journal `:1605`、`:1610`、`:1628-1634` 明确记录额度或容量错误。
- 75/76 当前 prompt 的 bytes/SHA 已与 journal 原记录不同：当前分别为 2234/d6331…、2382/dda1…；journal 记录的是 2200/9e541…、2342/3f2e…。

欠账成立；销案占位必须保留原始 prompt hash、当前 hash、日志信息和“未运行”状态。

### F8：成立但范围不完整，级别 B

证据：

- `research/codex-findings/60*` 不存在；`61-d1-desktop-foundation-review.md` 与 `61-d1-distributable-runtime-review.md` 同号。
- `71-phase-analysis-review.md` 与 `71-phase-analysis-review-attempt1.md` 也同号。
- 顶层 `prompts/` 的编号统计显示 18、19 各两份。
- `research/codex-findings/prompts/` 存在 `12-atelier-demo-review.md`、两个 15 号文件、`16-phone-call-plan.md`；顶层则有 12 和 16 的另一套文件。
- 没有证据证明两份 61 中任何一份本来就是 60。

发现主旨成立，但应把 71、顶层 18/19 等一并盘点；“61 之一推断为 60”不能写成事实。

### F9：部分成立，级别 B

证据：

- `git stash list` 为空，`git reflog --all | rg stash` 无输出，`.git/logs/refs/stash` 不存在。
- 但 `git fsck --no-reflogs --unreachable` 找到 dangling commit `50fc6aa`，时间为 `2026-08-21 01:46:41 +0800`，message 含 `safety/pre-grok-status-alignment-20260821`。
- 现有 evidence/journal 文字不能独立证明提示中的 09:34→09:48 时间链。

只能说当前 stash ref 已消失、存在不可达安全快照对象；不能断言精确生命周期或“彻底清除”。

## P1–P8

### P1：建议修改，A级风险

三轮结构可以保留，但需改为：

1. 甲轮不要“全文恢复”旧 R75。应保留撤回事实和原始 SHA，同时按当前 evidence 标注不同执行环境、`just ci` 退出码 2，以及 O-1 的 223/348/daemon 1500 计数。
2. 乙轮必须逐批列出 M2、voice-fix、CLI 扩容、向导、T19、融合布局、UI 标准化、品牌/备案、隐私三连，以及四个 8/20 批次；每行写日期、代码提交、merge、evidence、findings、日志文件/bytes/SHA、HANDOFF/PLAN 状态。
3. 丙轮要把“原始未提交阶段”和“后续入库阶段”分开，不能改写 R78/R79 原文。push 只写本地 reflog 已记录、远端直查失败的 provenance；stash 写“ref 已空、dangling 对象仍可见”。
4. 当前 R80 是工作区未提交尾部，不能被 R81 分配覆盖。另需独立登记 10:02–10:06 的晚到网页、备案和软著材料改动。

### P2：建议修改，方向同意，级别 B

`HANDOFF.md:22` 是唯一明确过时的当前坐标；`HANDOFF.md:21` 的空指针以及 `:52-53` 的 runtime 分层应保留。

不建议直接写“当前 HEAD=11e3653”，因为记录层后续提交后它会再次过时。建议写成：

“最近已入库的状态对齐合并基线为 11e3653（代码 1679078，证据 920af91）；当前工作区另有 R80 与记录层未提交改动。”

### P3：建议修改，A级阻断

裁决点 1：同意不归档现有 journal/evidence/HANDOFF；journal 继续作叙事真相源。

裁决点 2：不同意当前“内容内部但随公开快照、无需改发布脚本”的默认解释，理由是现状已经与文档政策冲突：

- `scripts/publish-public-snapshot.sh:2-4`、`:27-30` 使用整个 `HEAD^{tree}`，没有 history/research/prompts 排除。
- `public/main` 本地 ref `84af899` 的 tree 已含 history、research、prompts，计数为 19、155、66。
- `README.md:61`仍称过程史保存在私有归档；`docs/plan/MIGRATION.md:107-109`明确写未来公开须另做脱敏。
- 对 public tree 的模式扫描命中 141 个含本机路径模式的过程文件、40 个含 credential/config 关键词模式的文件、60 个含 runtime/launchd/tailscale 模式的文件。这些不是逐项确认证据，但足以证明现有六条窄探针不能证明安全。

最小方案二选一：

- 真正私有：改为 public allowlist/projection，排除过程档，并由 owner 授权处理已有公开快照；
- 继续公开：明确改写 README/MIGRATION/台账语义为“公开树内的过程索引、非 release notes”，先做广泛脱敏，禁止新增绝对路径和会话私密。

此外：

- `history/README.md:3` 目前只允许 journal 追加，需同步说明 ledger 的追加例外。
- 台账 `:112` 混用代码 SHA 与 evidence SHA，应拆列。
- 台账 `:136` 的重复号计数与标题实际不符；至少漏 R49、R55、R56，且 R54 计数取决于是否包含 `###` 补记。
- 台账 `:139` 声称 cmdeffect 已恢复，但当前 journal 中 `rg cmdeffect-hardening` 无结果。
- 台账 `:146` 的“61 推断 60”和 `:149` 的“86/87 全链 supersede”都没有足够 provenance。
- evidence 和 IMPL prompt 应使用完整路径，例如 `e2e/evidence/...`、`docs/plan/...`。
- knowledge generation 5 只能引用 `docs/plan/MIGRATION.md:228` 的迁移快照；当前仓内 `.saydo/knowledge/current/core.md` 不存在，不能写成当前可直接复核文件。

### P4：建议修改，级别 B

保留文件名和原始首行可以接受，但只改 STATUS 文件顶部仍可能让读者在 PUBLIC-READINESS 文件首行看到两个“第十一轮”。

最小修法是：两份 prompt 或台账都加非破坏性映射，明确“原始派发时仍称第十一轮；本次为 post-run ordinal erratum，按时间序列登记为第十四轮”，不改原始派发内容和 hash。

### P5：建议修改，级别 B；无条件写 supersede 时升 A

可以不补跑，但不能把 86/87 写成完整替代。75 prompt 覆盖视觉、a11y、SEO、性能、链接和移动端；76 prompt 覆盖双语内容、21 个锚点、HTML 转义和移动布局。86/87 主要是状态、数据路径和档案一致性，未找到逐项覆盖矩阵。

销案占位文件至少应包含：

- `not run` 和额度/容量失败原因；
- 原始 prompt/log bytes/SHA 与当前文件 SHA 的差异；
- 75/76 原始评审范围；
- 86/87 只覆盖哪些部分、哪些残余未覆盖；
- owner 对“不补跑”的明确 waiver。

### P6：建议修改，级别 B

不要写模糊的“R8x”。当前文件尾部是工作区 R80，且未提交。应分别修正：

- `history/PROCESS-JOURNAL.md:3-4` 的“从第 1 轮到现在、共 16 轮”；
- 说明速览表 `:9-37` 是设计期 R1–R25 快照；
- 说明正文当前尾部 R80 属并行未提交工作区；
- 表后增加台账指针，不要把指针伪装成 R26。

### P7：建议修改，级别 B；把推断写成事实时升 A

“不改名、不移动、只登记”同意。裁决点应明确写：

“60 未分配，无法判定；61 两份均保留，不能选择其中一份作为 60。”

同时把 findings 71、顶层 prompts 18/19 和早期 15 的多文件情况纳入盘点。所有缺号都要区分“文件不存在”“当时未保存”“另一命名空间存在”，不能制造整数连续性的假象。

### P8：建议修改，级别 B

不 commit、不 push、不 deploy 同意。但 `check-emoji.sh` 必须在可写临时目录重跑：

- 无参数跑一次，覆盖 tracked 与 untracked；
- 对所有新增/修改文件再显式跑一次；
- 记录真实退出码和原始输出。

另加 `git diff --check`、路径/链接检查、SHA 对象存在性检查、重复编号程序化统计和广泛隐私扫描。当前本会话的 emoji 命令没有进入扫描阶段，不能写成通过。

## 对账遗漏补查

### git log

抽查命令：

```text
git log --all --merges --since=2026-08-11
```

发现：

- `a7d517c`：M2 三端壳、原生语音层、D1 桌面地基合并；
- `6cd362d`：voice-fix 前端批合并；
- `aa8034e`：批 B console 列表与推荐槽合并。

`history/PROCESS-JOURNAL.md` 没有对应批次标题。另有 Apache/privacy 链 `354b028`、`55a224d`、`693475a`、`6365513`、`f090078`，当前台账只列其中部分，未给 journal/evidence provenance。

### evidence

抽查：

- `e2e/evidence/public-readiness.md:1`
- `e2e/evidence/s1-demo-wiring.md:1`
- `e2e/evidence/s2-callback-channels.md:1`
- `e2e/evidence/w54a-claude-cli.md:1`

四份 evidence 均存在，但前 3 批在 HANDOFF/PLAN 中没有同名状态锚，journal 也没有索引。`cmdeffect-hardening.md:78,169,232` 与撤回 R75 的 `just ci=0` 之间存在未解释的门禁来源差异。`scripts/gen-copyright-docs.mjs:20-28` 只从 `git ls-files` 取源文件；当前软著产物和生成器是 untracked，不能写成 HEAD 可重现或已入库。

### journal

抽查：

- `R70` 双标题：`:1454`、`:1471`；
- `R54/R55/R56` 的 `##` 与 `### 补记` 层级混用，台账目前没有说明统计口径；
- R80 `:1710-1725` 写“未改官网 HTML、公安备案未做”，但工作区 deploy diff 已在页脚加入备案链接，`docs/release/2026-08-13-store-submission-status.md:122-143` 已写官网部署和公安备案提交；
- `docs/release/2026-08-13-tencent-icp-app-filing.md` 也被修改，尽管 `docs/release/README.md:11,23`规定该文件是冻结快照、后续只在 status SoT 补号。

这是一条比 F1 更紧的晚到对账缺口：不能把 R80 原结论当作当前最终事实，也不能把晚到改动倒填进 R77–R79。

### findings/prompts

抽查：

- findings 71 有正式报告和 `attempt1` 两份；
- findings 60 缺失、61 双文件；
- 顶层 prompts 18、19 各双文件；
- 75/76 报告不存在但 prompt/log 存在，且 prompt hash 已漂移；
- 早期 `research/codex-findings/prompts/` 与顶层 `prompts/` 是两个命名空间，15 号在早期目录还有多份文件。

## 总评

**No-Go（按原方案）。**

进入记录层施工前至少要先处理四个阻断：

1. P1 不得无注释恢复旧 R75，必须按当前 evidence 重建 provenance；
2. P3 必须由 owner 裁决过程档案的公开/隔离边界，并修正现有 public snapshot 与私有承诺的冲突；
3. P5、P7 不得把“部分覆盖”或“推断编号”写成既成事实；
4. 先完成 R80 晚到网页、备案、冻结快照和软著材料的独立对账。

上述事项落实并重新跑门禁后，方案可进入“修改后 Go”。

## B. 调度会话 triage(2026-08-21,同日)

总裁决:Codex「No-Go(按原方案)/ 修改后 Go」**全盘接受**,按其修订要求实施(实施记录 = journal R85 与本节;落盘期间与并行备案会话再撞 R81,本轮三节按「先落盘者为准、后者顺延」定格为 R83/R84/R85)。

| # | Codex 发现/要求 | 裁决 | 处置 |
|---|---|---|---|
| 1 | F1 部分成立:evidence §10 已有 owner 授权入库记录,只有 journal/HANDOFF 欠账;「已 push」只能写本地证据 | 采纳 | R85 按两阶段表述;push 写「owner 授权合并推送(evidence §10)+ 本地 tracking/push reflog 证据」;其 `ls-remote` 失败为其沙箱代理所致,本会话同样只主张本地证据 |
| 2 | F2/P1-1 A 级:直接恢复旧 R75 节会与 evidence 的 `just ci` exit 2 形成未解释矛盾 | 采纳 | R83 恢复原文并附 provenance 注:EXIT=0 = 首轮调度方沙箱外复跑(daemon 1411);evidence §7/§11 exit 2 = 施工沙箱内 uv cache 受阻(node 段绿);O-1 后末态 223/348/daemon 1500 |
| 3 | F3 修正:public-readiness/s1/s2 三批连 HANDOFF/PLAN-2 状态行都没有(prompt 原称「状态行齐全」不实) | 采纳 | R84 逐批登记状态行缺口;HANDOFF §1 刷新句补四批收口锚;是否回填 PLAN-2 上浮 owner(排产源不代改) |
| 4 | F4/F6/F8/F9 表述修正(非整段无轮次;设计序列缺 R35;61→60 推断删除、补 71 与顶层 18/19 与子目录 15;stash 对象 `50fc6aa` 仍 dangling) | 采纳 | 台账 §3 与 R84/R85 均按修正后表述落盘 |
| 5 | P2:HANDOFF 不写「当前 HEAD=...」(会再过时),写「最近已入库合并基线」 | 采纳 | HANDOFF §1 按该措辞刷新 |
| 6 | P3 裁决点 2 A 级:公开快照已含 history/research/prompts(public/main 树实测 19/155/66 文件),与 README「过程史在私有归档」及 MIGRATION 脱敏注冲突;须 owner 裁决 allowlist 投影 vs 改承诺+广泛脱敏 | 采纳,上浮 | 本轮不改发布脚本、不改 README/MIGRATION 承诺;台账头部加「公开边界注意」;裁决点列入 R85 上浮清单首位 |
| 7 | P3 台账细节六条(SHA 混列/撞号计数漏 R49/口径注/「已恢复」时态/61 推断/75-76 supersede 措辞/全路径/knowledge 出处) | 采纳 | 台账已逐条修订 |
| 8 | P4:PUBLIC-READINESS 也要加映射注 | 采纳 | 两份 IMPL-PROMPT-11 顶部均已加事后勘误注(原始正文不改) |
| 9 | P5:销案不得写「全链 supersede」,五要素落盘,owner waiver 显式 | 采纳 | 75/76 销案登记文件按五要素写,覆盖差异如实列出;追认状态 =「owner 验收本轮即追认」,已列入上浮清单 |
| 10 | P6:头部不写模糊「R8x」;速览表指针不伪装轮次 | 采纳 | journal 头部与速览表注按精确表述落盘 |
| 11 | P8:check-emoji 在其沙箱 mktemp 失败不能记 clean;收口须全套门禁 | 采纳(其沙箱失败不影响本会话实测) | 收口门禁 = check-emoji 全仓兜底 + 新改文件显式清单 + `git diff --check` + SHA 存在性核验 + 编号程序化统计,真实退出码记入 R85 |
| 12 | 补查:R80 并行会话晚到改动(deploy 页脚备案链接、status SoT 更新、冻结快照 `2026-08-13-tencent-icp-app-filing.md` 被改、软著生成器 untracked)与 R80 原结论已不符 | 采纳登记,不代收口 | R85 登记观察;对账责任归该并行会话收口轮(其后续 R81/R82 已续记备案线);「冻结文件被改」上浮 owner 知悉 |
| 13 | 补查提及 privacy 链含 `f090078` | 不采 | `git cat-file` 全史查无此对象,系笔误;privacy 链实为 `55a224d`/`693475a`/`6365513` 三连,台账已列 |

残余风险登记:本轮补记与并行会话共写 `history/PROCESS-JOURNAL.md` 工作区(追加型)。该风险在本轮落盘期间实际发生两次——并行备案会话先后插入其 R81(腾讯云对账)与 R82(公安重交),本轮三节两度当场顺延、定格 R83/R84/R85 并同步全部交叉引用;若其后再有并行轮次,继续按此规则处理。
