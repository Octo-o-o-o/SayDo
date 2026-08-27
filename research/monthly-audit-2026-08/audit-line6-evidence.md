# 周审计工具与证据账本线(line6)commit↔文档 双向对照审计报告

- 审计日期:2026-08-27(本会话)
- 审计员:零上下文独立审计会话(只读;未修改/新建仓库正式文件,未执行 git add/commit)
- 仓库:`~/WorkSpace/SayDo`,分支 `main`,HEAD `f723ab7`(`git branch --show-current` + `git log -1` 实测),工作树 clean(`git status --short` 空输出)
- 审计对象:scripts/week-audit.mjs 生成的账本(research/week-audit/*.json)、隐私门禁(scripts/check-public-tree-privacy.mjs / public-text-redaction.mjs / publish-public-snapshot.sh 探针段)、98 条 commit 清单(scratchpad/line6-audit-evidence.txt)与五份锚定文档
- 结论速览:**A 级 2 条,B 级 2 条,C 级 3 条**;账本数字与语义证据链本身全部核验成立,但两个"当前是否仍通过"的门在本会话实测均为红

---

## 0. 审计范围与方法

双向:

- A 方向(文档→commit):账本口径数字(main=115 / all_refs=131 / paths=434 / docs=219 / markdown=154)逐项与 JSON 账本、脚本固定门、git 独立重算对照;F70–F82 抽 7 条核当前代码;week-audit.mjs 配置(cutoff / refsFrozenAt / base / rangeEnd / remediationEnd)与文档叙述对照;"broken 0" 复跑。
- B 方向(commit→文档):98 条中抽 10 条 chore(evidence) "随 XX 重生成账本" 核验触发源 XX 真实紧邻存在;8 条 chore(privacy) 逐条核 diff、文档记录与当前门禁行为;实跑 `node scripts/week-audit.mjs --check` 与 `node scripts/check-public-tree-privacy.mjs --fs`(任务明示允许的只读校验),另补跑了同脚本的 `--check-bundle`(CI 同款门)与 `node scripts/check-doc-links.mjs`(同为只读校验、CI 内联步骤)。

所有断言均附本会话真实命令输出;推断处明确标注。

---

## 1. A 级发现(错误/不一致)

### A-1 当前 main 上 week-audit 证据门是红的:`--check` 与 `--check-bundle` 均失败

**主张**:锚定文档把 `node scripts/week-audit.mjs --check` 列为复现门禁(docs/review/2026-08-23-week-audit-faststart-release.md §2 "复现门禁"),CI 在 "document and release metadata gates" 步骤跑 `--check-bundle`(.github/workflows/ci.yml:46);本会话在当前 main HEAD(`f723ab7`)上两者均 exit 1。

**证据**(本会话实跑):

```
$ node scripts/week-audit.mjs --check
[fail] 账本已漂移:research/week-audit/2026-08-23-publication-manifest.json
[fail] 账本 bundle 摘要不一致:research/week-audit/2026-08-23-publication-manifest.json
EXIT=1

$ node scripts/week-audit.mjs --check-bundle
Error: 公开发布树路径 exact-set 与冻结 manifest 不一致
    at assertPublicationExactSet (.../scripts/week-audit-publication.mjs:67:11)
EXIT=1
```

**根因**(有据推断):publication manifest 冻结的是 tracked 全树 exact-set + 逐文件指纹(week-audit.mjs `capturePublicationManifest`,行 578–597)。最后一次账本重生成是 `9417b6d`(2026-08-27,98 条清单第 1 条);其后 main 又落了 8 个提交、512 个变更路径而未重生成账本:

```
$ git log --oneline 9417b6d..HEAD
f723ab7 merge(byoa): 并入 L-1 修复线 ...
911ce95 fix(byoa): 身份门下沉到每次 spawn 前 ...
cf50f52 chore(archive): 入库 600 条提问线语料库全量实体 ...
12ba011 docs(journal): R113 回填推送与清理结果
4866330 fix(archive): 抢救入库的 prompts/146 撞门禁 ...
dfb6f9d chore(archive): 抢救入库 600 条提问 dry run 线的产物 ...
511787f chore(archive): 抢救入库 RC4 两条工作线 ... 61 份过程证据 ...
728eeb6 docs(w54b): 关批 w54b-wiring 并为 AI 供给专题开具名坐标
$ git diff --name-only 9417b6d HEAD | wc -l
512
```

第一个未随账本重生成的提交是 `728eeb6`(2026-08-27T15:36:36+08:00,改 HANDOFF.md 等 tracked 文档),按脚本逻辑从该提交起门即应转红(此句为推断;直接证据是当前 HEAD 实测红)。本线 98 条清单里"每次实质提交都跟一条 chore(evidence) 重生成"的纪律,在 08-27 的收尾三条工作线(w54b 关批 docs、archive 抢救线、byoa L-1 线)上断掉了。

**重要限定**(对本线有利的事实,必须一并写明):`--check` 模式先按当前 git 历史**重新生成**四份账本内容再与落盘文件逐字节对比(week-audit.mjs 行 1163–1177),本次失败清单里**只有** publication manifest 一项——即主账本 md、ledger.json、semantic-review.json、remediation 两份的内容与当前重算结果**逐字节一致**;且语义证据校验(`validateSemanticStructure` 行 936 + 全部 changeAssertions 的 blob/digest/diff-hunk 逐条复验,行 1045–1053)在报错点之前全部通过。漂移的只是"全树指纹快照"这一层,不是账本本体。

**建议处置**:在 main 上补一次 `node scripts/week-audit.mjs --write` + chore(evidence) 提交(需实施会话执行,本审计只读不代做);并把"实质提交后必须重生成账本"写进交接纪律(HANDOFF 或 AGENTS),否则每条新工作线收尾都会重复此断裂。

### A-2 公开仓 main CI 当前是红的:w54b 收口引入的 3 条 L-1 测试在 Linux 上失败,修复未随快照发布

**主张**:文档侧(journal R110、HANDOFF.md:46)记录 w54b 收口门禁 "`just ci` exit 0(daemon 2174 passed/6 skipped)";但公开仓 `Octo-o-o-o/SayDo` main 最近两次快照推送的 CI 实测失败,失败项恰是该收口代码提交引入的测试。

**证据**(本会话 `gh` 实测):

```
$ gh run list --repo Octo-o-o-o/SayDo --limit 5
failure  snapshot: 2026-08-27 from internal 12ba011...  ci  main  33061815709  2026-08-27T10:09:41Z
failure  snapshot: 2026-08-27 from internal 4866330...  ci  main  33061397898  2026-08-27T10:04:03Z
failure  snapshot: 2026-08-26 from internal c383bc0...  ci  main  32984617202  (runner 未分配,基础设施故障)
failure  snapshot: 2026-08-26 from internal 91efe7f...  ci  main  32983665585  (仅 android shell 因 SDK zip 损坏红,node 绿)
success  snapshot: 2026-08-26 from internal 343e97f...  ci  main  32980250672
```

run 33061815709 与 33061397898 的 node job 均在 `pnpm test` 失败,失败测试完全相同(--log-failed 摘录):

```
× BYOA fake CLI 进程级反例 > BYOA spawn 前身份核验每次真算;同 mtime/size 内容替换拒绝   (test/byoa-fake-cli.e2e.test.ts, 72 tests | 1 failed)
× BYOA spawn 前身份核验每次真算 > forceRehash 连续两次都调用哈希,同 mtime/size 内容替换 digest_mismatch
× BYOA spawn 前身份核验每次真算 > BYOA chat 路径连续两次核验都哈希,同 mtime/size 内容替换拒绝
```

三条测试均由 `8941e1c`(w54b 收口代码提交,2026-08-27T15:28:51+08:00)引入(`git log -S` 逐条确认),而对应产品修复 `911ce95 fix(byoa): 身份门下沉到每次 spawn 前(L-1)` 及其合并 `f723ab7` 在内部 main 上**晚于**最后一次公开快照(最新公开快照源为 internal `12ba011`,`git merge-base --is-ancestor` 确认 8941e1c 在 12ba011 内、911ce95 不在)。即:公开 main 目前处于"带 L-1 复现测试、无 L-1 修复"的确定性红(连续两个快照失败于同 3 条,非 flake)。

**不一致点**:R110/HANDOFF 记录收口时本机(macOS)`just ci` exit 0——与公开 Linux CI 红并存,说明这 3 条测试的绿是平台相关的(mtime/size 缓存行为差异,推断),"收口门禁全绿"的断言在异平台不成立,且此红在我能找到的任何文档(journal R110–R113、HANDOFF、readback doc)中均无记录。前两次 08-26 失败(91efe7f、c383bc0 快照)经逐 run 核对为 GitHub 基础设施故障(runner 未分配 / android SDK 包损坏),不属代码红,亦未见记录。

**建议处置**:把 `911ce95`/`f723ab7` 随下一次公开快照推出(应使三条测试转绿);在 journal 补记公开 CI 自 08-27 两次真实红与两次基础设施红的事实;评估把"公开快照推送后确认 CI 结论"纳入快照流程。

---

## 2. B 级发现(疏漏/不足)

### B-1 双向账本覆盖端点冻结在 rc.4 边界(b768089),其后 137 个提交无 commit↔doc 账本覆盖,且未见书面决定

**主张**:week-audit.mjs 硬编码 `remediationEnd = "b768089..."`(行 17,注释"最终实施冻结 SHA");回修账本覆盖 `3fccf4a..b768089` 共 29 提交(已核实)。但同一 bundle 的外部锚 `expectedPublication.tag` 已随 RC 链推进到 `"v0.1.0-rc.12"`(week-audit.mjs 行 435/1122,bundle-integrity.json 同),而 remediationEnd 未随之推进:

```
$ git rev-list --count b768089..HEAD
137
```

这 137 个提交(rc.5–rc.12 发布链、RC4 runtime 重实施线、w54b 收口、archive/byoa 线)只被 publication manifest 的全树指纹覆盖,**没有**逐提交的 commit↔文档双向行。F74 当初正是为同类缺口("首轮账本停在 3fcc,后续回修提交未进双向覆盖")建立的 remediation ledger;同样的缺口如今在 b768089 之后重现。rc.10–rc.12 的叙述有 §17(docs/review/2026-08-25-rc4-runtime-final-reimplementation-readback.md,21b365d 添加)承接,但那是散文纪实,不是机械双向账本。我在 readback doc、HANDOFF、journal 中 grep `remediationEnd|实施边界|不再扩展` 未找到"账本覆盖到 rc.4 为止、此后不扩展"的显式决定记录。

**限定**:文档的字面主张("回修账本覆盖至最终实施冻结 SHA"即 b768089)本身仍为真;此条是覆盖缺口与决定未留痕,不是文档说谎。

**建议处置**:或推进 remediationEnd 到新冻结点并重生成(工作量大),或在账本 md 头部/HANDOFF 写明"双向账本覆盖终点=b768089,此后提交由 publication manifest + §17 类纪实承接"的边界声明。

### B-2 d413e30(配对语料 RFC1918 改白名单)无 journal/评审文档记录

**主张**:8 条 chore(privacy) 中 7 条均可在文档中找到记录(见 §4.2 逐条),唯 `d413e30`(2026-08-26,改 scripts/check-public-tree-privacy.mjs +37 行)只有:代码内注释块(该脚本行 146–157,内容与提交主题一致且质量高)+ 账本机械收录(91efe7f "随隐私白名单重生成账本")。grep journal(`d413e30|配对语料|白名单校验`)与 docs/review、e2e/evidence 均无叙述性记录;docs/03、docs/08、docs/modules/e 命中的"白名单"均为无关语境(verify 白名单、推送 meta 白名单)。这是一次门禁语义变更(为三个移动端测试文件引入值级白名单),按本仓惯例应有 R 级或 evidence 级记录。

**建议处置**:在 journal 下一轮补一句记录(变更动机=mobile 线并入带入 RFC1918 语料、裁决=白名单而非豁免、允许值集合=6 个边界/文档示例值)。

---

## 3. C 级发现(观察)

### C-1 "活跃文档相对链接 | 96" 的计数单位存疑(broken 0 属实)

docs/review/2026-08-23-week-audit-faststart-release.md:51 写"活跃文档相对链接 | 96 | ...;broken 0"。检查脚本输出格式为文件数而非链接数:`console.log('[ok] active document links: files=${files.length} broken=0')`(scripts/check-doc-links.mjs:102);journal R110 记 "files=109 broken=0",本会话实跑 `files=114 broken=0, EXIT=0`。96→109→114 的演变佐证 96 更可能是**文件数**被标注在"链接"行——但冻结时点的真实链接总数无从复算,单位错标为**未核实的疑点**而非断言。broken 0 的主张当前复跑成立。

### C-2 01bb925 "随 rc.10 bump 重生成账本" 的触发提交与其间隔一个 docs 提交

抽验的 10 条"随 XX"里 9 条触发源为直接父提交;唯 `01bb925` 的 rc.10 bump(`886d375`)与其之间隔了 `d46f13a docs(review): 回写 rc.9 定界与容器闭环验证`(git log --oneline -4 01bb925 实测)。触发源真实存在于同一小段线性历史,叙述成立,仅非严格紧邻。

### C-3 一次无说明的账本重生成 revert(5572b92)

`c51046c chore(evidence): 随诊断补充重生成账本`(触发源 `358c451` 真实存在)随即被 `5572b92 Revert "..."` 撤销,revert 正文只有自动生成的一行,无原因;journal/readback/evidence grep(`5572b92|c51046c|358c451`)零命中。两提交各只动 bundle-integrity.json 与 publication-manifest.json 各 2/4 行,且其后 `8a12180 随 rc.11 bump 重生成账本` 重新覆盖,对账本终态无影响——但机械提交链上留下一处未解释的往返。

---

## 4. 核验成立项(双向,逐项带证据)

### 4.1 A 方向:文档口径 vs 账本/仓库真实状态

| 口径 | 文档主张 | 独立核验 | 结论 |
|---|---|---|---|
| 主线提交数 | 115(ledger md 头部、review doc §2、plan §2) | `git rev-list --count 8a8247a..3fccf4a` = **115** | [ok] |
| 全 ref 宇宙提交 | 131 = 115+16 | 按 ref-manifest 7 个 tip 重放 `git log --since=cutoff` 并按 committedAt≤refsFrozenAt 过滤,去重 = **131**,extra = **16**(本会话 node 脚本重算) | [ok] |
| 变更路径 | 434 | `git diff --name-only 8a8247a 3fccf4a \| wc -l` = **434** | [ok] |
| 文档型资产 | 219(154 md + 65 其他) | 按脚本同款 isDocument 规则独立重算 = **219 / 154 / 65** | [ok] |
| 分类计数 | paired 29 / doc-only 48 / impl-only 38 | bundle-integrity.json counts 同;29+48+38=115 | [ok] |
| md 表行数 | §1=115 / §2=16 / §3=219 | awk 分节数行 = 115 / 16 / 219 | [ok] |
| 回修账本 | 29 提交 / 189 路径 / 59 文档(`3fccf4a..b768089`) | `git rev-list --count` = **29**,`git diff --name-only \| wc -l` = **189**;remediation-ledger.json counts = 29/189/59 | [ok] |
| broken 链接 | broken 0 | 本会话 `node scripts/check-doc-links.mjs` → `files=114 broken=0` exit 0(计数单位见 C-1) | [ok] |
| F18–F28 锚 | 11 组人工 finding、23 SHA / 10 文档非空链接 | review-finding-anchor.json findingIds = F18..F28(11 个);scope 92/209 空链接 ⇒ 115-92=23、219-209=10 | [ok] |
| 语义证据 334 行 | 逐行绑定真实 diff hunk/blob/摘要 | `--check` 运行中 validateSemanticStructure + 全部 changeAssertions 复验在 publication-manifest 报错点之前全部通过(失败输出仅含 manifest 一项) | [ok](机械层) |

**week-audit.mjs 配置 vs 文档叙述**(week-audit.mjs 行 17–34):

- `cutoff: 2026-08-15T00:00:00+08:00` = ledger md "时间窗" = plan §2 [ok]
- `refsFrozenAt: 2026-08-22T22:30:44+08:00` = ledger md "提交时间上界" = ref-manifest.json `commitTimeCutoff` [ok]
- `base 8a8247a / rangeEnd 3fccf4a` = md "主线范围" = bundle-integrity generatedFrom [ok]
- `remediationEnd b768089` = remediation md "范围:3fccf4a..b768089" = review doc §7 "rc.4 最终实施边界为 b768089" = HANDOFF:35-36 [ok](覆盖端点问题另见 B-1)
- 脚本固定计数门(行 1218–1224:115/131/16/434/219/154;--check-bundle 行 516–523:115/131/16/219)与文档数字一致 [ok]
- `expectedPublication.tag = "v0.1.0-rc.12"`(行 435/1122)与 bundle-integrity.json 一致 [ok]

**F70–F82 抽验 7/13 条,当前代码全部兑现**:

| F | 声称 | 当前代码证据 | 结论 |
|---|---|---|---|
| F70 | settle 事务失败只记 `tier1.finalize_transaction_failed`、保留 review marker | packages/daemon/src/tier1/executor.ts:2773、3373、3468 三处该 action | [ok] |
| F71 | review marker 必带原始 result(resultEvent) | executor.ts:590/600 类型含 `resultEvent?: Extract<Tier1Event,{kind:"result"}>`,632–653 严格校验 | [ok] |
| F72 | Tier1 每次 spawn 前对 wrapper 与 runtime target 全量 SHA-256,不用 mtime/size 缓存 | packages/daemon/src/tier1/claudeIdentity.ts:80 注释明写"Tier1 每次调用都对 wrapper 与 runtime target 重哈希;BYOA 的 mtime/size 缓存不参与此安全门",114/169 两处 digest 核验,120–124/177–181 mismatch 分支 | [ok](BYOA 侧缓存后续由 L-1 线处理,见 A-2) |
| F75 | available job 拒绝 `run_attempt>1`;post gate 从 REST 重读 attempt=1 | .github/workflows/release.yml:355–359 "Refuse availability on a rerun attempt" `if: github.run_attempt != 1`;scripts/post-release-gate.mjs:256 `invariant(runDetail.run_attempt === 1, ...)` | [ok] |
| F78 | `commitSettle` 要求非空 entryId,空则失败 | executor.ts:3081 定义 commitSettle,3138–3140 `if (enq.entryId === "") throw new Error("ready_for_review 回叫未持久化:...")` | [ok] |
| F79 | 恢复 spawn 前无条件比较 durable adapter 与实际 backend,双向 mismatch → blocked 且 spawn=0 | executor.ts:3717 `exitEvidence: adapter_mismatch:${rowAdapter}->${effectiveAdapter}`;test/tier1-executor.test.ts:5820 "cursor → claude adapter mismatch ⇒ durable intent 原子收口且不 spawn"、5846 "claude → cursor ... 绝不跨后端 spawn"(5869 另覆盖 F80 的 outbox 失败整体回滚) | [ok] |
| F82 | Cursor camelCase usage 归一化为 canonical cost 四字段 | packages/daemon/src/providers/byoa/parsers.ts:150–153 `inputTokens/outputTokens/cacheReadTokens/cacheWriteTokens` | [ok] |

### 4.2 B 方向:commit → 文档

**98 条清单完整性**:逐条 `git merge-base --is-ancestor` 核验,98/98 均在当前 main 祖先链(missing=0)。

**chore(evidence) "随 XX" 触发源抽验(10 条,均以 `git log --oneline -4 <sha>` 实测)**:

| 账本提交 | 声称触发 | 实际紧邻提交 | 结论 |
|---|---|---|---|
| 91efe7f 随隐私白名单 | RFC1918 白名单 | 父提交 = d413e30 chore(privacy) RFC1918 白名单 | [ok] |
| c383bc0 随 205 更新 | prompts 205 | 父提交 = 61ce050 docs(prompts): 205 门 2 更新 | [ok] |
| 5e27796 随 mobile 并入与 205 | mobile 合并 + 205 | 父链 = 88ac8a2(205)← 6cb461c fix(mobile) ← d83c341 merge(rc4) mobile 线 | [ok] |
| 5d9321a 随部署证据 | rc.12 部署证据 | 父提交 = a8a68e4 固化 rc.12 官网部署证据 | [ok] |
| 80ff448 随 §17 | §17 回写 | 父提交 = 21b365d,其 diff 含 `+## 17. rc.10–rc.12:RC 链收口`(readback doc) | [ok] |
| 329a40d 随 rc.12 bump | rc.12 bump | 父提交 = 4e5f09f release: bump rc.11 -> rc.12 | [ok] |
| 8a12180 随 rc.11 bump | rc.11 bump | 上下文核验(revert 链后首个 bump 重生成) | [ok] |
| 01bb925 随 rc.10 bump | rc.10 bump | 886d375 bump 在隔 1 个 docs 提交处(见 C-2) | [ok],带注 |
| c06e949 随截图基线更新 | 截图基线 | 父提交 = 722b9c5 chore(evidence): 更新 e2e 截图基线 | [ok] |
| 429156c 随文档链接修复 | 链接修复 | 父提交 = ccb5cff fix(docs): rc.4 说明改为无链接引用 | [ok] |

(另核 revert 对 5572b92/c51046c:触发源 358c451 真实存在;revert 无说明,见 C-3。)

**chore(privacy) 8 条逐条**(diff 以 `git show --stat`/定向 diff 实测;文档记录以 grep 实证):

| 提交 | 日期 | diff 与主题相符 | 文档记录 | 当前门禁行为与描述一致 |
|---|---|---|---|---|
| 55a224d 公开前脱敏+SECURITY.md+发布脚本 | 08-20 | [ok] 12+ 文件(备案快照转存根 183 行删、SECURITY.md +5 等) | journal:1815 "隐私脱敏三连(08-20):354b028 + 55a224d/693475a/6365513" | [ok] 发布脚本存续且探针机制在 |
| 693475a 脱敏补漏+手机号探针十六进制边界 | 08-20 | [ok] 4 文件;publish-public-snapshot.sh 探针 `(^\|[^0-9])` → `(^\|[^0-9a-fA-F])` 逐字核对 | journal:1815 同上 | [ok] 当前 publish-public-snapshot.sh:86 仍为十六进制边界版手机号探针 |
| 6365513 订单号残留两档案抹除 | 08-20 | [ok] 2 文件 4 行 | journal:1815 同上 | n/a(内容性脱敏) |
| 143357f 去除归档文档本机绝对路径 | 08-26 | [ok] 3 文件(两份 Codex 报告 + prompts/109) | readback doc "隐私扫描抓到两类违规"节(83 处叙述与文件集合吻合);journal:2773 "RC4 线在 143357f 做过同类处置" | [ok] 本会话隐私门 hits=0 |
| 85b0470 去除 AI 供给专题绝对路径 | 08-26 | [ok] 12+ 文件 | journal:2770/2777("全部脱敏:599 处...;85b0470 脱敏") | [ok] 同上 |
| fdbe8a6 本报告路径样例改占位符 | 08-26 | [ok] 1 文件 | 载体即报告文档自身(自记录) | [ok] 同上 |
| 58e24d3 部署证据移除 OAuth email | 08-26 | [ok] 1 行:`OAuth:<email>` → "OAuth 登录态(owner 账户,标识不入公开树)"(email 本报告不复现) | 载体即部署证据文档;修改后表述自含说明 | [ok] 私有探针锚机制(F92)在 publish 脚本 90–117 行与 check 脚本 loadCanonicalPrivateProbes 均在;本会话 `--fs` hits=0 |
| d413e30 配对语料 RFC1918 白名单化 | 08-26 | [ok] check-public-tree-privacy.mjs +37 行 | **无 journal/评审记录(B-2)**;代码内注释块完整 | [ok] 当前脚本 146–175 行:3 个语料文件、6 个八位组拼装白名单值、白名单外值报 `rfc1918-corpus-disallowed`;父版本 grep 证实此前无任何 corpus 特例(收紧主张成立);d413e30^ 版本无 PAIRING 相关内容 |

**两个指定只读门当前实跑结果**:

```
$ node scripts/check-public-tree-privacy.mjs --fs
[ok] public-tree-privacy scanned=2038 binary=108 excluded=8 hits=0
EXIT=0                                  ← 通过

$ node scripts/week-audit.mjs --check
[fail] 账本已漂移:research/week-audit/2026-08-23-publication-manifest.json
[fail] 账本 bundle 摘要不一致:research/week-audit/2026-08-23-publication-manifest.json
EXIT=1                                  ← 失败(A-1)
```

---

## 5. 未核实/边界声明

1. A-1 的"从 728eeb6 起门即红"是按脚本逻辑的推断,未逐提交 checkout 复跑;直接证据仅为当前 HEAD 红。
2. A-2 中"macOS 上三条测试为何绿"(mtime/size 缓存平台行为差异)是推断,未在本机复跑该三条测试验证(避免与只读纪律边界纠缠,且非任务必需)。
3. C-1 冻结时点(e95fe2a 时代)的链接/文件真实计数无法复算,单位错标记为存疑而非断言。
4. 私有隐私探针文件(git common dir 内)内容按设计不可入公开树,本审计未读取其内容,仅验证其锚定与加载机制存在。
5. F70–F82 的另外 6 条(F73/F74/F76/F77/F80/F81)未逐条开码核验(任务要求抽一半);其中 F74(remediation ledger 存在且机械一致)与 F80(测试 5869 行)已获间接证据。
6. 公开仓 CI 结论以 gh CLI 读取为准;未访问 GitHub 网页端交叉验证。

## 6. 附:本会话关键命令清单(可复跑)

```
git branch --show-current; git status --short
git rev-list --count 8a8247a..3fccf4a                      # 115
git diff --name-only 8a8247a 3fccf4a | wc -l               # 434
git rev-list --count 3fccf4a..b768089                      # 29
git diff --name-only 3fccf4a b768089 | wc -l               # 189
git rev-list --count b768089..HEAD                         # 137
node scripts/week-audit.mjs --check                        # exit 1 (A-1)
node scripts/week-audit.mjs --check-bundle                 # exit 1 (A-1)
node scripts/check-public-tree-privacy.mjs --fs            # exit 0, hits=0
node scripts/check-doc-links.mjs                           # files=114 broken=0
gh run list --repo Octo-o-o-o/SayDo --limit 5              # 最近 4 次 failure (A-2)
gh run view 33061815709 --repo Octo-o-o-o/SayDo --log-failed
git log --oneline -S "同 mtime/size 内容替换拒绝" -- packages/daemon/test/   # 8941e1c
```
