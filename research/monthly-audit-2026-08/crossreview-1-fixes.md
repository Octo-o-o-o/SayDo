# 月度审计修复批 · 零上下文对抗复核报告(crossreview-1)

- 复核对象:`cf50f52` / `911ce95`+`f723ab7` / `f5ca882` / `938ee8a` / `596a030`(HEAD=`596a030`,工作树 clean,`git status --porcelain` 0 行)
- 复核时间:2026-08-27;复核方式:全部结论来自本会话独立命令,未采信 commit message 自述
- 立场:证伪。结论:**修复批主体真实、大面积经得起对抗核验**;发现 **A 级 3、B 级 2、C 级 3**,全部集中在"修复批新写入文本自身的事实性瑕疵",没有发现代码级错误或门禁破坏。

---

## 一、结论总表

| # | 级别 | 对象 | 一句话 |
|---|---|---|---|
| A-1 | A | `938ee8a` → docs/release/v0.1.0-rc.12.md | 新句"rc.11 与 rc.12 之间**仅有**官网可用性文案与证据账本的事务性更新"不实——两 tag 间还有 release.yml + 7 个发布门脚本的功能性修复(10e1cde 实体门 mutate 入 index,正是 rc.12 存在的原因) |
| A-2 | A | `938ee8a` → HANDOFF.md 硬教训第 3 条 | 括注实证三处失准:纪律断裂起点是 `9a3e180` 不是 `728eeb6`;"--check-bundle 门在 main 上红了一天"——该门在 main CI 上从未实际跑红(两次红都死在更早的 pnpm test 步骤,另两次是基础设施故障) |
| A-3 | A | `938ee8a` → journal R114 | "`codex/week-audit-evidence-20260823` 分支……随后删除"不实——分支现仍存在于本地;且 R113 原裁决是"**刻意不删**、是否归档由 owner 定","按 R113 裁决"的转述在删除这半句上也不成立 |
| B-1 | B | `938ee8a` → docs/09 §10 新词表 | `native.reply` 写 `turnId: Id`,实际 schema 是 `z.string().min(1)`(pipeline.ts:38),与同批 `screen_text` 用 idSchema 不同——逐字段核对唯一不一致 |
| B-2 | B | `938ee8a` → version-matrix.md | "桌面三系统实体门四项真机证据"易误读为三系统真机——证据目录只有 Mac/Windows 各 2 项,门本身"必须直接实跑 Mac/Windows"(post-release-gate.mjs:91),Linux 覆盖靠 CI smoke 不是真机 |
| C-1 | C | journal R114 | "585 个 commit / 1009 份月内动过的 md"无法精确复现(我在各合理口径下得 578–599 / 867–1011),журнал 数字未带命令锚 |
| C-2 | C | HANDOFF §1.1 | 2026-08-22 快照行仍原文保留"当前坐标唯一以本行为准"字样(旧文保留纪律所致,08-26 行已显式 supersede,但双"唯一"字面残留) |
| C-3 | C | 审计可复核性 | 九线 subagent 报告与 w54b 四轮复审 prompt/报告原文均只在会话 scratchpad(§18.1 自己也承认)——R114 宣称的"A 18 / B 31 / C 40"清单在仓内不可逐条复核,本报告只能核验其已落盘的修复面 |

其余抽验全部通过(见下文逐条证据)。

---

## 二、逐条核验记录

### 1. f5ca882(拍平副本清理)——PASS(超额核验)

- **170 个被删文件逐一(非抽样)与 canonical 对比 blob**:对 `git diff-tree --diff-filter=D f5ca882~1 f5ca882` 的全部 170 个路径,`git rev-parse f5ca882~1:<拍平路径>` 与 `f5ca882~1:research/customer-question-corpus/<同名路径>` 逐个比较 → `RESULT ok=170 mismatch=0 missing=0`。零信息损失属实。
- **README 恢复**:`git show dfb6f9d~1:research/README.md`(15 行)与 `f5ca882:research/README.md`(16 行)diff 仅 +1 行(customer-question-corpus 条目);HEAD 与 f5ca882 版本无差。且 `f5ca882~1:research/README.md` 与 corpus README 同 blob `424213eb`,证实 dfb6f9d 确实覆盖了原索引。
- **残留引用**:`git grep -E 'research/(questions|contexts|contracts|simulations|dry-runs)/'`、`research/0[0-4]-`、`research/review` 全仓 0 命中(grep 机器已用 corpus 引用正例自检有效)。
- **勘误自述核验**:cf50f52 message 确有"只收 28 个文件"句;dfb6f9d message 第 17 行确有"research/README.md 是主树更新(60 行 vs main 15),该版保留"的误判原文。f5ca882 的两条勘误都对。

### 2. 938ee8a 抽验(11 处)

**2.1 rc.12.md 合同 v2 口径 —— 主体 PASS,新增 supersede 句一处不实(A-1)**

- 新文"对 tgz 冻结 filename/entryCount/contentDigest 及 sourceRevision/buildId/protocolVersion,对另两 asset 只冻结 filename"与实物完全一致:`docs/release/v0.1.0-rc.12-assets.json`(schema `saydo-release-assets/v2`)tgz 条目恰为三字段,SHA256SUMS/release-metadata.json 仅 filename;脚本 `scripts/release-asset-manifest.mjs` `TGZ_EXTRA_KEYS=["entryCount","contentDigest"]`、`ASSET_COMMON_KEYS=["filename"]`,normalize 分支(:191-201)行为一致。
- "合同 v2(`0a2f290`)":commit 存在("release: 发布合同 v2——跨机绑定改为来源+内容摘要,外壳字节交还 CI 自洽链"),且 `git merge-base --is-ancestor` 证实它落在 rc.7 bump(8dd9fe0)与 rc.8 bump(a6e76f8)之间;rc.7 manifest schema=v1(含 bytes/sha256/npmIntegrity),rc.8=v2。"v2 在 rc.7→rc.8 之间移出"属实。
- 勘误注"rc.8-rc.12 已发布正文沿用 rc.4 时代文本":gh api 实查 rc.12 Release body 含"bytes、sha256"v1 措辞与"替代未创建 Release 的 rc.3"句(2 命中),rc.8 body 同(1 命中)。属实。
- **A-1**:新句"本候选取代 rc.11……rc.11 与 rc.12 之间**仅有**官网可用性文案与证据账本的事务性更新,CLI 代码不变"。实测内部 `34449e5..4e5f09f` 与公开 tag `v0.1.0-rc.11..v0.1.0-rc.12` 的文件清单相同,均含:`.github/workflows/release.yml` + `scripts/post-release-gate.mjs`(71 行)/`test-release-provenance.mjs`(110 行)/`release-asset-manifest.mjs`/`release-physical-closure.mjs`/`run-release-verifier-windows.ps1`/`test-release-physical-evidence.mjs`/`week-audit.mjs`——即 `10e1cde` "fix(release): 实体门 mutate 先入 index 再刷账本"的功能性修复。"CLI 代码不变"为真(packages/cli 仅 README 措辞+版本号),"仅有……事务性更新"为假。缓解:同段后半句在"rc.4 以来的累积修复"里列了"实体门……mutate 入 index",但"仅有"从句仍是错的。修复建议:改为"仅有官网可用性文案、证据账本与实体门脚本修复(10e1cde),CLI 代码不变"。
- 附注:"rc.11(全绿 available 的 Release)"用词与 readback §17 表(rc.10/11/12 均"全绿 available")一致,该词汇体系里 available=Release 发布且 required jobs 全绿,与官网 availability 翻转(rc.12 实体门后)是两回事,不算矛盾。

**2.2 version-matrix / release-profile —— PASS,一处措辞易误导(B-2)**

- `packages/cli/package.json` version=`0.1.0-rc.12` [ok];`e2e/evidence/2026-08-26-rc12-availability.json` 与 `-release-verify.json`:tag=v0.1.0-rc.12、tagSha=`7a9b6e8…`(与 `git ls-remote --tags public` 一致)、workflowRunAttempt=1、14 required jobs 含六项 fixed URL smoke [ok];`2026-08-26-rc12-physical/` 目录存在 [ok]。
- **B-2**:该目录仅 4 文件:mac-exec/mac-global/windows-exec/windows-global。readback §17 明写"四项真机实跑:Mac exec/global + Windows exec/global";`post-release-gate.mjs:91`:"--write-availability 必须直接实跑 Mac/Windows"。矩阵新文"桌面三系统实体门四项真机证据"把 CI 三系统覆盖与两系统真机门压进一个短语,SoT 文件里易被读成三系统真机。
- rc.2/rc.3 的 404 历史注:gh api releases 实查——rc.8/rc.9 存在且标题带 UNAVAILABLE,rc.10/11/12 正常,rc.4–rc.7 与 rc.2/rc.3 无 Release(tag 存在)→ 404 注与 HANDOFF"rc.8/rc.9 走到 smoke 失败留 UNAVAILABLE Release、rc.4–rc.7 从未创建 Release"的归因精确化均属实。
- README 保留规则"仓内只有 rc.2/rc.3/rc.4+rc.12 四份说明":`ls docs/release/` 实证恰 4 份;所引 `c35d1ba`/`8874105` 存在且主题相符。

**2.3 docs/09 §10 握手段 —— PASS**

hub.ts 逐点对上:identity 缺失/非法→`ws.close(4001, "pipeline runtime identity missing or invalid")`(hub.ts:336-338);`runtimeProtocolCompatible` 不满足→4001(:341-342,runtime.ts:128-133 确为 major 比较);health identity 与握手值 `JSON.stringify` 全等比较,不等→4001(:423-430);`{v:1, role:"pipeline", identity}` 首包与 role 白名单、tailnet 自称 pipeline 拒连均在(:307-333)。`runtimeSha` 在 daemon src 仅存兼容别名(全部来自 `RUNTIME_IDENTITY.sourceRevision` 投影,index.ts:393/824/3047),与"只可作兼容别名"一致。"§16.1 改判 2026-08-12"与 `2d3b653`(2026-08-12, "回写 09 §16 可分发运行时合同与 runtime schema")吻合。capture 方案里"docs/09:986-988 vs runtime.ts:128-133 分叉已消除"的回注也随之成立。

**2.4 docs/09 §10 新补 10 种 WS 消息逐字段 —— 9.5/10 PASS,1 字段不一致(B-1)**

对照 `packages/contracts/src/types/pipeline.ts`:`confirm.card`(sessionId/receiptId/text/kind/digest/digestVersion)、`confirm.countdown`(ms)、`confirm.resolved`(outcome)、`confirm.click`(accept|reject)、`confirm.decision`(accept|reject|withdraw)、`focus.entity`(entity{id,kind,title,sub,color,at})、`pipeline.restart_pending/ack`(generation)、`screen_text`(sessionId/turnId:idSchema/text)、`console.heartbeat`(sessionId/atMs)、`pipeline.health`(asr/tts/identity:runtimeIdentitySchema/stateRootDigest/generation?)全部逐字段一致。唯一不一致:**`native.reply` 文档写 `turnId: Id`,代码是 `turnId: z.string().min(1)`**(pipeline.ts:38)——Id 在该词汇表意指前缀 ULID(ids.ts),文档把约束写强了(B-1)。注释所引 `1ab27cc`(restart_pending/ack)、`2d3b653` 均存在且主题相符。

**2.5 docs/11 §3 外壳段 —— PASS**

`packages/console/src/shell/Layout.tsx`(注意:实际路径是 shell/ 不是 components/):main `max-w-[1600px]` 居中 + `--shell-gutter`(:801);侧栏/顶栏 `background: var(--bg-app)`(:416/:657)即宣纸通底,与 `--surface-raised` 行修订一致(`3918eef` 2026-08-13 "侧栏与顶栏宣纸通底"存在);树形导航六段(开口聊 CTA:450-467/今天:474/全景看板:478/正在持续的事:481/记录:517/旧版:535-551)与"项目切换器沉底"(:589-596 `data-project-switcher`)齐全;默认路由空 hash→today(router.ts:40)。`8b74430`(2026-08-06,"主容器 1200→1600")、`1482510`(.sh→.mjs,commit 实含 check-hardcoded-colors.mjs/.sh shim/test-color-gate.mjs)、`5c48eb4`(看小样)、`40a607f`(系统语音回退)全部存在且主题相符;DemoFrame.tsx 实为 `sandbox=""`+`srcDoc`,端点 `/api/artifacts/:id/versions/:version` 在 api.ts:252;`VoiceTransport = "cloud"|"system"|"unavailable"` 与 `VOICE_SYSTEM_NOTE` 在 systemVoice.ts:11/:6。docs/10 §3-8 三态修订与上述同源,一致。

**2.6 w54b-batch §14.2 更正 —— PASS**

`git log -1 --format=%B d83c341` 的 `# Conflicts:` 恰为 5 文件(apps/ios/README.md、apps/ios/build-and-install.sh、e2e/evidence/2026-08-22-mobile-shells-device-build.md、justfile、package.json),含更正文所点的 build-and-install.sh 与 justfile [ok];对 merge-base `e22be46` 两文件均双侧修改 [ok];合并结果 installer blob == p2(mobile 侧)即"整取 mobile 侧" [ok];justfile 与两个 parent 都不同即人工并集 [ok]。"真正无冲突信号的只有 release 侧独有的门禁脚本本身"与 §14.2 原有归因相容。

**2.7 HANDOFF §1 双 supersede —— PASS(残留一处字面,C-2)**

08-23 块从"现势(supersede 本节下方所有旧措辞)"降级为"时点快照(历史保留……当前坐标唯一以 §1.1 的最新快照行为准)",与 §1.1 08-26 行的"当前坐标唯一以本行为准"不再互斥 [ok]。残留:被保留的 08-22 行仍字面含"当前坐标唯一以本行为准"(其上 08-26 行已显式"supersede 下方 2026-08-22 行"),按旧文保留纪律可接受,记 C-2。新硬教训第 3 条的机制表述(publication manifest 冻结 tracked 全树指纹、不重生成即 `--check-bundle` 红)与 week-audit.mjs 代码一致(--check-bundle 分支 :424 调 verifyPublicationManifest,对 live `git ls-files` exact-set + 逐文件指纹校验),但其括注实证不实,见 A-2。

**2.8 DSH D-09 勘误 —— PASS**

`git show c5148ab:packages/daemon/src/providers/byoa/runner.ts` :49-50 确有"BYOA spawn env 白名单(09 §11-3)"+`buildSpawnEnv`(默认剥离、仅透传显式给定)且 :113 spawn 实际消费;引入于 `ca102ea`(2026-07-24)与"07-24 起"一致;`AGENT_ENV_ALLOWLIST` 在 tier1/agentEnv.ts:2 [ok]。状态注三断言:`borrow-dsh-invariants` 在 PLAN-2/HANDOFF 0 命中 [ok];daemon src 无 `enforcement` 分档字段(唯一命中是 config/types.ts:101 注释里的 "close enforcement",非字段)[ok]。

**2.9 其余抽到的修复点(全 PASS)**

- PLAN-2 204 勘误:`9e9afee` 确于 08-26 入库 prompts/204 [ok];账本行"10 个 .ts 合计 45,734 行 + README 87 行":wc 实测 45734 / 87 / 10 个 .ts,逐数吻合。
- mobile-gap-audit 行号勘误:在该文自锚的 `cda99b8` 上,setup_local_only 403 块确在 index.ts 961-973,988-998 确是 probe 响应拼装(bootPromote JSON)——新行号在文档自己的代码锚上精确成立。
- IMPL-16 终态注所引 `61ce050`("205 门 2 更新——五条阻断已复核基本解除")存在 [ok];phase-gap B0 supersede 指向的 faststart 计划存在。
- 决策单:938ee8a 只把 4 个"[x]…Claude 预填草案,待 owner 确认"改成未勾选,**未触碰** `95a68a0` 里 owner 已签的 4 项([x]…owner 已签 2026-08-25 + 签署人/日期,现文 42/120/227/247 行原样)——改法正确,无误伤。
- 38→36 mutation 勘误:实跑 `node dry-runs/test-dry-run-mutations.mjs` exit 0,输出恰 **36** 行 "rejected" + 正控/总结行,`official tree unchanged`——勘误后的数字是对的。
- faststart"96 链接"勘误:改成"96 个文件"并注明 `files=N broken=0` 口径,与脚本真实输出格式一致(本会话实跑输出 `files=114 broken=0` 同格式)。
- runtime readback §11 后记所引 `9f0e735`("打开 Windows 单测门(A6 前置)")存在("92 failed"计数无法在 macOS 复核,列为其自述)。

### 3. journal R114 事实断言抽验(7 条)

| 断言 | 判定 | 证据 |
|---|---|---|
| 公开仓 CI 真红 run `33061815709`/`33061397898`,pnpm test 同 3 条 L-1 身份门测试失败 | **属实** | gh api:两 run 均 ci/main/failure;失败步骤均 "Run pnpm test";job 日志 FAIL 行恰 3 条:binary-identity-force-rehash ×2 + byoa-fake-cli"BYOA spawn 前身份核验每次真算" ×1 |
| 根因=8941e1c 先入库测试、911ce95 未快照到公开仓 | **属实** | 8941e1c diff:A binary-identity-force-rehash.test.ts;公开快照 `f8db896…:runner.ts` grep preSpawnGate=0 而测试文件已在 |
| 另两次 08-26 失败为基础设施(runner 未分配 / android SDK zip 损坏) | **属实** | run 32984617202:多 job failure 且零失败步骤(未启动);run 32983665585:android shell 失败于 setup-android action |
| voice B-5 线 `7f6562e`(merge `1f2e57e`) | **属实** | 两 commit 存在,主题逐字吻合(hub 重放最近生效 voice.mode) |
| `cf50f52` 171 文件、d413e30 白名单、0e33260 16 个 deploy 文件 | **属实** | cf50f52 全部 171 个 A 均在 corpus 路径(quotepath=false 复数);两 commit 存在,0e33260 触及 deploy/ 恰 16 文件 |
| `6624299` 分支"不合并、**随后删除**" | **不实(A-3)** | `git branch --list` 现仍有 `codex/week-audit-evidence-20260823`;且 R113 原文(12ba011:journal:2958-2960)是"**刻意不删**……是否归档由 owner 定" |
| "585 个 commit / 1009 份月内 md" | **不可精确复现(C-1)** | --since=07-27 在 12ba011/938ee8a 各口径:all 594/599,no-merges 578/582,first-parent 458;md 触及数 867(12ba011)/1011(938ee8a) |

### 4. 596a030 账本 —— PASS(实跑)

- `node scripts/week-audit.mjs --check` → `[ok] … main=115 all_refs=131 extra=16 paths=434 docs=219`,**exit 0**
- `node scripts/week-audit.mjs --check-bundle` → `[ok] week audit bundle verified without private git objects: commits=115 docs=219`,**exit 0**

### 5. 911ce95 —— PASS(实跑 + 代码级复核)

- `npx vitest run test/binary-identity-force-rehash.test.ts` → **5 passed,exit 0**(与 message 自述"5 passed"一致)
- **daemon 全套实跑(超出清单)**:`npx vitest run` → **131 files passed/2 skipped,Tests 2177 passed | 6 skipped,exit 0**——与 911ce95/w54b L-1 行/R114 的"2177 passed/6 skipped"逐字吻合
- 代码复核:preSpawnGate 贴 spawn(runner.ts runSpawnAttempt 入口)、spawnBlocked 不进网络重试判定(isRetryableNetworkFailure 首项)、被拦发 `continue` 跳过 byoa.invocation 审计、`spawnedAttempts>0` 才记订阅、身份漂移先于 cost_ledger_failed 返回、actualDigest 复用核验当次摘要(binaryIdentity.ts 三个 !ok 分支带回)——message 六点全部有对应实现;全阻塞路径(consumedAttempts[-1] 回退)有兜底。`f723ab7` parents=cf50f52+911ce95,正常 merge。未发现引入缺陷。

### 6. 门禁 —— 全绿(实跑)

- `node scripts/check-doc-links.mjs` → `files=114 broken=0`,exit 0(与三个 commit message 的自述数字一致)
- `node scripts/check-public-tree-privacy.mjs --fs` → `scanned=1868 binary=108 excluded=8 hits=0`,exit 0
- `bash scripts/check-emoji.sh` → clean,exit 0
- 另:corpus mutation 自测 exit 0、daemon 全套 exit 0(见上)。范围声明:python/console/color 等其余 just ci 面未跑——本批未触及相应源码面(938ee8a 纯文档、f5ca882 纯 research、911ce95 已由 daemon 全套覆盖)。

---

## 三、A 级发现详证

### A-1 rc.12.md 新增 supersede 句 "仅有……事务性更新" 不实

`git diff --name-only 34449e5 4e5f09f`(rc.11 bump→rc.12 bump)与 `git diff --name-only 4b5b490… 7a9b6e8…`(公开 rc.11 tag→rc.12 tag)同列 23 文件,其中 `.github/workflows/release.yml`、`scripts/post-release-gate.mjs`、`scripts/test-release-provenance.mjs`、`scripts/release-asset-manifest.mjs`、`scripts/release-physical-closure.mjs`、`scripts/run-release-verifier-windows.ps1`、`scripts/test-release-physical-evidence.mjs`、`scripts/week-audit.mjs` 非"官网文案"亦非"证据账本";两 bump 间 commit 即 `10e1cde fix(release): 实体门 mutate 先入 index 再刷账本`——一个功能性 gate 修复,且按 readback §17 "tag 工具一致性锁",正是 rc.12 要另烧一版的原因。把这段 delta 概括为"仅有……事务性更新"在事实上不成立("CLI 代码不变"半句为真:packages/cli 仅 README 4 行 + version)。

### A-2 HANDOFF 硬教训 3 括注实证失准

1. 起点:最后一次账本重生成是 `c383bc0`(08-26 23:15),`git merge-base --is-ancestor c383bc0 9a3e180` 成立,`9a3e180`(08-27 09:37)起每个 commit 都改 tracked 文件(逐个 diff-tree 验证)→ 纪律断裂起于 `9a3e180`,比 `728eeb6`(15:36)早 4 个 commit/6 小时。"8 个提交"只有按"728eeb6 之后到 f5ca882 恰 8 个"才凑得上,但那样就漏算了 9a3e180…728eeb6 这 5 个同样断纪律的提交(至 938ee8a 实际 14 个)。
2. "门在 main 上红了一天":公开 main 4 次红中,08-26 两次是基础设施故障(R114 自己也这么归因),08-27 两次失败步骤均为 "Run pnpm test"(ci.yml 里 `--check-bundle` 在 pnpm test **之后**,fail-fast 根本没执行);私有归档仓 CI 长期全 job 启动即败(远早于本事件)。即:--check-bundle 门从未在任何 main CI 上实际跑红。机制本身(不重生成→该门必红)我已从 week-audit.mjs 代码确认为真,错的是"实证"引用。

### A-3 R114 "分支随后删除" 不实 + 转述 R113 失真

- `git branch --list` 当前输出含 `codex/week-audit-evidence-20260823`(以及 faststart 分支、panini 分支)——"随后删除"未发生。
- R113 原文(`git show 12ba011:history/PROCESS-JOURNAL.md` :2958-2960):"保留的 4 个分支中,`codex/week-audit-evidence-20260823` **有 1 个未并入提交**且**刻意不删**……是否归档由 owner 定。" R114 写"按 R113 裁决不合并、随后删除"——"不合并"半句符合 R113,"删除"半句既不符合 R113(其裁决恰是不删),也不符合现状。R114 对 `6624299` 三处增量已被 main 吸收的判断本身未证伪(该 commit 存在,内容未逐项核),但删除断言属"已完成断言无本会话证据"类错误。

---

## 四、B/C 级补充

- **B-1** docs/09 §10 `native.reply` 的 `turnId: Id` vs `z.string().min(1)`(pipeline.ts:38)。修法:词表改 `turnId: string`(或注明放宽原因),或收紧 schema——二选一,别留分叉。
- **B-2** version-matrix "桌面三系统实体门四项真机证据"——建议改"实体门四项真机证据(Mac/Windows exec+global;Linux 由 CI 六项 smoke 覆盖)"。
- **C-1** R114 的 585/1009 建议回补计数命令与截止 SHA,或改约数表述。
- **C-2** HANDOFF 08-22 行的"当前坐标唯一以本行为准"字面残留(已被 08-26 行显式 supersede,只在逐字读时刺眼)。
- **C-3** 九线审计报告与 w54b 四轮复审原文只在 scratchpad,R114 宣称的 A18/B31/C40 与"可修项全部修复"在仓内无法逐条对账(§18.1 新增的存放事实注对 w54b 部分已如实声明此点)。

## 五、方法与边界

- 全部命令在本仓 HEAD=`596a030`(clean)上执行;gh api 仅做只读查询(runs/jobs/logs/releases/ls-remote)。
- 未修改任何仓库文件、未 add/commit;运行过的工具均自证树未变(mutation 自测输出 `official tree unchanged`,收尾 `git status --porcelain` 为空)。
- 未覆盖:938ee8a 全部 31 文件中未逐字过的少量小改(docs/modules/a、d 两处 2-4 行对齐、site 风格探索稿 §五 注、DEV-VERSION-LEDGER 时代 VI/VII 索引行——其引用的锚点 commit 我抽验过的均存在);"Windows 92 failed"计数;公开仓推送后 CI 是否转绿(R114 自己标注"推送后须确认",属未来事项)。
