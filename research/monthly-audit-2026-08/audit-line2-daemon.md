# daemon 核心线 commit↔文档 双向对照审计报告

- 日期:2026-08-27
- 审计员:零上下文独立会话(只读;未修改/新建任何仓库正式文件,未 git add/commit)
- 基线:`main` @ `f723ab7`(本会话 `git log` 实测:`f723ab7 merge(byoa): 并入 L-1 修复线…`),工作树 clean(`git status --short` 空输出)
- 输入:118 条 commit 清单(`scratchpad/line2-daemon.txt`);锚定文档见任务书
- 分级:A=错误/不一致;B=疏漏/不足;C=观察

---

## 0. 结论速览

- **A 级 1 条,B 级 7 条,C 级 5 条。**
- 118 条 commit 分 16 簇,**无「实质 feat/fix 且零文档痕」的孤儿提交**;文档覆盖最薄的两处是(a)L-1/B-5 两条已并入 main 的修复线(仅 commit message + 源 finding,零过程记录,B-2),(b)runtime 重实施 + rc.5–rc.12 段(仅 readback 叙事覆盖,双轨登记欠账,B-3)。
- capture-device-ingress 方案与当前代码逐条对照:**PR1 未实施**(与方案「定稿候选待 owner 批准」状态一致,机械证据见 §1.1);唯一例外是 Codex B-5——方案说「另行立项修复」,实际已当日修复并入 main,但**方案文本未回注**(B-1)。
- L-1(BYOA spawn 前身份门)修复 `911ce95` 与 `e2e/evidence/w54b-batch.md` §18.4 L-1 条目的修法方向**逐点吻合**(§1.2)。
- canonical 抽查发现一处**docs/09 内部自相矛盾**(§10 握手合同 vs §16 运行时合同,A-1)与一处**§10 词表缺口**(6+ 种在网 WS 消息零回写,B-4)。

---

## 1. 方向 A:文档 → commit/代码

### 1.1 capture-device-ingress 方案(docs/plan/2026-08-26-capture-device-ingress.fable.md)逐条状态对照

方案自述状态:「方案定稿候选,待 owner 批准」「本轮未改任何生产代码」(§10 分档、journal R111)。核验前提:**代码侧应当零 capture 实施**。机械证据(本会话实跑):

```
grep -rn "ingressOrigin|InputPrincipal|capture-token|captureToken" packages/daemon/src/ packages/contracts/src/   → 零命中
grep -c "capture" packages/contracts/src/types/pipeline.ts                                                        → 0
packages/daemon/src/net/ 目录列表:capToken.ts identity.ts mobileLan.ts pairUrl.ts pairingInfo.ts s3Guard.ts t2.ts(无 captureToken.ts)
packages/contracts/src/runtime.ts:3   export const RUNTIME_PROTOCOL_VERSION = "1.0.0";(方案 PR1 要求 bump 1.1.0,未发生)
packages/daemon/src/voice/hub.ts:323  hello.role 仍只接受 "pipeline"/"console"("invalid role" 4003)
packages/daemon/src/net/identity.ts:137  IdentityVerdict 仍单一 principal: "owner"
```

结论:**与方案状态一致,无「文档声称已修、代码没修」的条目**。逐个编号条目(Codex `research/codex-findings/100` 的 6A/10B/4C + 方案 §1 对前案的 4A/2B/1C 修订)在方案 v2 里的处置全部是「吸收进方案文本」,不是代码变更;逐条抽验方案文本确已承载:

| 条目 | 方案声称的处置 | 文本核验 | 代码侧核验 |
|---|---|---|---|
| A-1(origin 不进工具环) | §2.6 禁自动接受 + §2.7 工具三档(fail-closed) | §2.6/§2.7/§7.1 用例 25-28 均在 | `ingressOrigin` 零命中 = 未实施,一致 |
| A-2(版本偏斜猜测后备) | 删猜测,改 protocol minor 能力门(§2.4) | §2.4「版本门替代猜测(v2)」在 | `runtime.ts:3` 仍 1.0.0;`:128-133` `runtimeProtocolCompatible` 仍只比 major(方案引用行号准确) |
| A-3(无界 ASR 队列) | captureInFlight 单在途闸(§2.5) | §2.5 第四影子值「单在途上限 1」在 | 未实施,一致 |
| A-4(虚假 heard=true) | 第一刀收窄「Console 在场的第二麦克风」(§2.1 原则 5/§2.3) | 在 | 未实施,一致 |
| A-5(会话解析误挂) | 删 DB 兜底,只取 console lastVoiceModeSessionId(§2.3) | 在 | 未实施,一致 |
| A-6(fall through 吞 hold 旗) | 独立 handler 入口分流 + return(§2.6);ensureSession 先于 onUserTurnBegin | 在 | 未实施,一致 |
| B-1(transport 巨帧) | §3.4 如实声明现网既有暴露,PR2 独立 maxPayload | 在 | `hub.ts` WSS 无 maxPayload(与方案口径一致) |
| B-2/B-3/B-9(过强承诺) | 降级为如实声明(§2.1 原则 4/§2.6 已知残余/§9) | 在 | — |
| **B-5(pipeline 重连不重发 voice.mode)** | 「现网既有缺陷另行立项修复,不进本方案改动面」(§2.5/§9) | 在 | **已修:`7f6562e`(见 §1.3)——方案未回注,B-1 发现** |
| B-4/B-6/B-7/B-8/B-10、C-1..C-4 | 逐条吸收于 §2.2/§3/§6/§7(合并单帧、判定顺序 a-h 重排、测试文件列全、principal/via 正交、len>=7 等) | 抽验 §2.2 判定 a-h、§3.4 len>=7、§6 PR1 表含四个测试文件、§3.2 正交声明——均在 | — |

方案的现网行为断言抽查(在当前 main 上重验,均属实):

- `identity.ts:109-115` tokenEqual 长度早退 [ok](实读 105-115 行)
- `identity.ts:88-97` mobile_lan 无 Origin 要求同 Host Referer + Sec-Fetch-Site [ok](实读)
- `capToken.ts:11-22` 对任意非空旧值原样接受;randomBytes(24) base64url + 0600 [ok](实读)
- `dialog.ts:1318-1341` scheduleAutoAccept 5 秒倒计时 → consumeAutoAccept [ok](实读)
- `liveTools.ts:1111` cancelTask 注册 [ok](实读)
- `hub.ts:141-146` MOBILE_LAN_UPSTREAM_ALLOWED = {voice.mode, turn.text, confirm.decision, console.heartbeat} [ok](实读)

### 1.2 L-1(BYOA 多 spawn 不重验身份)条目 ↔ `911ce95` 实施一致性

L-1 的定义处不在 capture 方案里,而在 **`e2e/evidence/w54b-batch.md` §18.2/§18.4**(实读 530-610 行):

> `| L-1 | A | BYOA 单次 chat 内多 spawn 不重验二进制身份(网络重试 / tripwire / schema repair 三条路径) | 既有缺陷,独立安全线。修法方向:把身份核验下沉到每次 spawnRuntimeChild 之前,而非 chat() 开头一次 |`(w54b-batch.md:581)

`911ce95`(2026-08-27 18:46,经 `f723ab7` merge 入 main;本会话读完整 diff)与该条目逐点对照:

| L-1 条目要素 | 实施(diff 实证) | 判定 |
|---|---|---|
| 身份核验下沉到每次 spawnRuntimeChild 之前 | `runner.ts` `runSpawnAttempt` 内、`spawnRuntimeChild` 调用之前执行 `opts.preSpawnGate?.()`;provider 侧把 `checkBinaryIdentity`(forceRehash)收进 `preSpawnGate` 闭包 | 一致 |
| 覆盖网络重试路径 | `isRetryableNetworkFailure` 对 `spawnBlocked` 返回 false(被拦发不进重试判定);测试「同一次 chat 内网络重试:第二次 spawn 前必须重验身份(L-1)」 | 一致 |
| 覆盖 tripwire 强化重试路径 | 测试「同一次 chat 内 tripwire 强化重试:第二次 spawn 前必须重验身份(L-1)」+ fake-byoa-tamper-cli fixture(第一发退出前同 mtime/size 自替换) | 一致 |
| schema repair 路径 | fixture/测试未单列 schema repair 场景,但 preSpawnGate 挂在 runner 每次 attempt 前,机制上覆盖 | 一致(测试覆盖面略窄于条目列举,见 C 级观察) |
| 附加加固 | 审计 `actualBinaryDigest` 改为复用核验当次摘要(不事后重读);被拦发不进 attempts/订阅记账/byoa.invocation;身份漂移优先于 cost_ledger_failed 且 retryable=false | 超出条目要求的正向加固 |

**结论:实施与 L-1 条目一致,无漂移。** 但该修复的文档痕为零(见 B-2):journal 无 R 节(全文 grep `911ce95`/`preSpawnGate`/`trusting-panini` 仅 R113:2956 一句「施工中,未动」);R110:2833 仍写「L-1…未修」;w54b-batch.md §18.4 L-1 行未加「已修」注;merge `f723ab7` 的文件清单(实测 `--stat`)只有 5 个 src/test 文件,零文档。

### 1.3 Codex B-5 ↔ `7f6562e` 一致性 + 方案未回注

`research/codex-findings/100`:128-134(B-5)的建议修法:「Hub 保存最后一个权威 effective voice.mode,pipeline join 后主动重放…补『Console 保持连接、只重启 pipeline』的测试」。

`7f6562e`(2026-08-26 22:32,经 `1f2e57e` merge;本会话读完整 diff)实施:

- `hub.ts` 新增 `private lastVoiceMode`(注释直引「capture ingress 评审 B-5(2026-08-26)」);
- `case "voice.mode"` 转发分支(现 549-556 行)留档,`firePipelineJoined` 在 pipeline (re)join(hello 即授权或首个 health 过 HOME 门)后重放;mobile_lan 来源不留档(同 dispatch 红线);
- 三条测试与建议逐一对应:①「console 保持连接、仅 pipeline 重连:join 后收到重放」;②「生产形态(HOME 门):重放在首个 health 过门后到达,门前不泄漏」;③「mobile_lan 的 voice.mode 不留档」。

**结论:实施与 B-5 建议逐点吻合。** 派生问题(B-1 发现):方案 §2.5「已知边界…pipeline 单独重连后 Console 不会重发 voice.mode…该现网缺陷另行立项修复」与 §9 风险表同句、§7.1 用例 8「pipeline 重连后 shadow 重置 ptt」——在 `7f6562e` 落地后,「Console 不会重发」的哑死形态已被 hub 重放兜住;若按方案原文实施 PR1,「onPipelineJoined 把 shadow 重置为 ptt」会在 join 后立刻被 hub 自己的重放(经 voice.mode 转发分支)覆盖回最近档位——机制上仍自洽(重放走同一分支会同步更新 shadow 与 consoleMicResidual 清零点),但 §2.5 的边界叙述、§9 的「现网既有缺陷」定性、§7.1-8 的断言语义都需按重放后的时序重写。方案定稿(R111 会话)与修复合入(22:33)同日先后,漂移可解释,但**未回注 = 实施 PR1 前的必修项**。

### 1.4 canonical 与模块文档抽查

**(a) docs/09 §10 vs §16 vs contracts(A-1 发现)** — 实读对照:

- `docs/09:984-988`(§10 开头):「生产握手首包为 `{v:1, role:"pipeline", runtimeSha:<40位 Git SHA>}`。daemon 以自身实际 Git HEAD 为期望值,缺失、非法或不一致均以 4001 拒绝;后续 `pipeline.health.runtimeSha` 必须与握手值和 daemon 值三方一致」;§10 sketch 的 `pipeline.health` 形状为 `{asr; tts; runtimeSha: string; stateRootDigest: string}`。
- `docs/09` §16.1(1540 起;相对行 12/27-28/32 = 绝对 1551/1566-1567/1571):「`protocolVersion: string; // 跨进程兼容判据;当前为 semver major 兼容」「旧 `runtimeSha` 只可作兼容别名,不得再作为进程兼容或启动成功判据」「pipeline hello/health 以 `protocolVersion` 兼容和 `stateRootDigest` 相同为接入条件」。
- 实现:`contracts/src/types/pipeline.ts` `pipeline.health` 分支为 `{asr, tts, identity: runtimeIdentitySchema, stateRootDigest, generation?}`;`contracts/src/runtime.ts:128-133` `runtimeProtocolCompatible` 只比 major——与 §16 一致,与 §10 冲突。

即:capture 方案 §9 与 Codex A-2 把这记作「canonical vs 实现的既有分叉…如实上浮 owner」,但真实状态是 **canonical 内部 §10 陈旧、§16 已改判**——实现与 §16 一致。定性差一半:该分叉的处置不是「canonical 与实现二选一」,而是 §10 段落回写。

**(b) docs/09 §10 词表缺口(B-4 发现)** — §10 sketch 自称「(词表以本节为 canonical)」,逐一 grep 全文(本会话实跑,逐消息计数):

| WS 消息(contracts 已在网) | docs/09 全文命中 | 引入 commit(实测) |
|---|---|---|
| `native.reply` | **0** | M2-voice-a 批(08-12) |
| `focus.entity` | **0** | focus 批 4(08-05 段) |
| `confirm.card` / `confirm.countdown` / `confirm.resolved` | **0 / 0 / 0** | F25+批 1(08-04/05 段) |
| `pipeline.restart_ack` | **0** | `1ab27cc`(08-10;`--stat` 实测该 commit 只改 contracts+test,未动 docs/09) |
| `pipeline.restart_pending`(作为 WS 消息) | 4 处命中**全部是 tier1 的 `restart_pending_*` marker/audit**(09:672/673/946/1634),无一是 pipeline 消息 | 同上 |
| `pipeline.health.generation` | 未见(§16 未提 generation 字段) | 同上 |
| `confirm.click` / `confirm.decision` / `screen_text` / `console.heartbeat` | 1/1/2/1(散见 §11 mobile_lan 段与 §15,§10 sketch 未收) | — |

对照纪律:capture 方案 §2.4 自己写明「(`pipeline.ts` 全部为 z.strictObject)…任何 additive 都必须改 schema + docs/09 §10」;正例是 `2d3b653`(08-12,`--stat` 实测同 commit 写入 docs/09 140 行 + contracts/runtime.ts),反例即上表。

**(c) docs/09 §13 工具契约 vs registry** — `liveTools.ts` 实测 `reg.register` 共 32 个工具,逐名 grep docs/09:**32/32 全部命中 ≥1 次**(resolveProject 6 / proposeStart 10 / confirmAndDispatch 13 / forget 24 / …/ getFocusStatus、addHotword、listProjectDir、readProjectFile、approveAction 各 1)。工具名层无漂移(逐工具的签名深度未逐一比对,标注为抽查)。

**(d) docs/modules 五份 vs packages/daemon/src** — 通读五份(a/b/c/d/e):

- 模块 ↔ 目录映射成立:A2↔`session/`、A3↔`brain/`、A4↔`interview/`、A5↔`evaluator/`、A6↔`demo/`、A7↔`intent/`、B↔`memory/`+`artifacts/`、C2-Tier1↔`tier1/`、C4↔`callback/`、C5↔`approvals/`、C6↔`summary/`、C7↔`recovery/`、C8↔`cost/`、E1↔`providers/`、E3↔`obs/`;c-control-bridge.md 已更新到 Tier1 现实(claude_code CLI hooks、W5.4-c 开放项、07 D8 矩阵)。
- 漂移一处(B-7 发现):`modules/a-dialogue.md` A3 设计要点④「对话档恒 API(BYOA 判死,07 D18 结案表)」与 docs/09 §11 T18b 段(09:1272 附近)「全局 dialog 接受 API 或 CLI binding…CLI 天然投影为 mode:"oneshot"」冲突。该文件自带「冲突时 canonical 胜」免责,但作为「实施与核对入口」已构成误导(T18b 是 08-12 就落的 canonical,该行至今未改)。
- `modules/d-presentation.md` D2 仍写 Capacitor/P1,与 mobile 壳已入 rc.12 分发的现实不符——呈现域超出本审计范围,仅记 C 级观察,不展开。

**(e) HANDOFF.md(B-6 发现)** — 实读:§1 头部块(约 23-44 行)自称「**2026-08-23 现势(supersede 本节下方所有旧“当前”措辞)**」,内容停在「当前候选升为 v0.1.0-rc.4…最终提交、Release、部署与设备结果将在本轮证据提交后回填本段」;而真正的当前坐标在其**下方** §1.1 内的快照行(48 行):「**2026-08-26 当前快照…当前坐标唯一以本行为准**…RC 链已收口于 v0.1.0-rc.12…rc.10/rc.11/rc.12 均为全绿 available…(2026-08-27 的返工合并后应读作:活动树 HEAD = 9417b6d)」。两个块各自宣称权威且方向相反(上块 claim supersede 下方,下块才是新值);承诺的「回填本段」未发生。按块序通读的新会话会先拿到 rc.4 假坐标。

---

## 2. 方向 B:commit → 文档

### 2.1 118 条 commit 分簇与覆盖(逐簇核对;归属用 `git merge-base --is-ancestor` 实测)

| # | 簇 | commit(数) | 文档/journal 覆盖 | 判定 |
|---|---|---|---|---|
| 1 | BYOA L-1 修复 | `f723ab7` `911ce95`(2,08-27) | 仅 commit message + w54b §18.4 L-1 源条目;**零 journal/evidence** | B-2 |
| 2 | voice B-5 修复 | `1f2e57e` `7f6562e`(2,08-26) | 仅 commit message + codex-findings/100 B-5 源条目 + R111 一句「已单独立项提示」;**零 journal R 节/evidence**(grep `vibrant-bose`/`重放最近生效` 于 history/ e2e/evidence/ docs/plan/ 零命中) | B-2 |
| 3 | rc 收尾修复(08-26) | `5297a29` `9e769ba`(2) | **readback §12/§13 逐字对应**(ACL SDDL 缩写根因、隐私夹具运行时拼接),实读吻合 | 覆盖 |
| 4 | runtime 对抗评审回修(08-25/26) | `4545769` `9f0e735` `4b7d0d6` `fe585a1` `3e56ac5`(5) | 评审全文 `research/codex-findings/2026-08-25-rc4-runtime-adversarial-review.md`(6A/8B);readback §10/§11 覆盖 A1-A5/:961 自杀链/等待窗;**但 A6 处置与 8B 处置只在 commit message**(B-5 发现) | 部分 |
| 5 | runtime 全新重实施 | `2378b7b`(1,08-25,55 files) | `docs/review/2026-08-25-rc4-runtime-final-reimplementation-readback.md` 直接点名(known-red checkpoint,§8) | 覆盖 |
| 6 | runtime 二轮红灯线(08-23/24) | `a2ed173`→`a4915d1`→`77d6cb4`→`c3f8aa5`(4,链关系实测) | `docs/review/2026-08-24-rc4-runtime-fresh-final-readback.md`(No-Go,R1-R11;§6「失败实现 checkpoint 精确暂存」即 `c3f8aa5`) | 覆盖(叙事级,hash 未点名) |
| 7 | 08-23 终态收口 | `611285e` `6a7623c` `52bef91` `a24eb70` `c4c72e5` `bb9d287` `3f8be93` `877c875` `3e74a5a`(9) | **`docs/review/2026-08-23-remediation-ledger.md` 逐 commit 成对登记**(实读 11-27 行,paired/implementation_only + 文档/实现/测试三列);R94 点名 `877c875`/`3e74a5a`;R97 点名 `b92b0ea` | 覆盖(最佳实践) |
| 8 | Windows 对齐尾修 | `08b7610`(1,08-23) | R95 行动 3 点名全 SHA `08b761010ec0e98b53d7a80d248dfe3acd0b855c` | 覆盖 |
| 9 | tier1 08-22 | `1d1d822` `3bf3d10` `316f031`(3) | `docs/review/2026-08-22-week-audit-ledger.md` 行 104/112/125 逐条登记(blob/行锚);R91 标题即含「POSIX 组长锚/cmd·bat 门」;w54b-batch.md:94 记 `3bf3d10` 已修 B-5(w54 线的 B-5,与 capture B-5 同号不同义) | 覆盖 |
| 10 | 08-20 四批 | 15 条(`54b981c`…`81e6b9a`) | 全部实测归属四个 merge:`7fb3fa1`(w54a-claude-cli,9 条)/`aa2dffc`(s2-callback,5 条)/`1a41b45`(s1-demo,1 条);R84 索引 + evidence `w54a-claude-cli.md`/`s2-callback-channels.md`/`s1-demo-wiring.md` + 评审 78-85 | 覆盖 |
| 11 | cmdEffect 线(08-15~19) | `adc2b9a` `115353e` `068e392` `e79d1d8` `03c6d54` `50193f3`(6) | R83 逐 hash 全 SHA 登记(前 4 条完全吻合)+ evidence `cmdeffect-hardening.md`;`50193f3` 实测 IN `af5d0b1`(默认 Runner 批,R84 索引);`03c6d54` 为 main 直提交、随 `f7d7492` 入主,commit message 自带完整依据(04 §5.4 对照) | 覆盖 |
| 12 | BYOA/CLI 供给 + 解析加固(08-13) | 22 条(`ba90a7a`…`56eb6a2` 等) | `648133d`/`ba90a7a` 实测 IN `aa8034e`(R84「CLI 供给扩容」+ 评审 65);`c0ae2a1` IN `013d84b`(T19-polish,评审 67);约 14 条解析加固为 main 直提交,穿插当日 console 批之间,同日有契约回写 commit(`2e46446` docs: 回写 unknown_event 同参一次重试合同);`ba90a7a` 的三新 provider 在 docs/09:1177-1179 + §11 规则有完整回写 | 覆盖(day 粒度,见 C-5) |
| 13 | oneshot/D1/CLI 能力(08-11/12) | `a106999` `b4b3742` `d952ebb` `2d3b653` `e170387` `f9c78f6` `7aa11e2` `3bc92dc`(8) | 实测:前两条 IN `1b59da2`(T19,评审 66);`d952ebb`/`2d3b653` IN `b74a00b`(D1 桌面地基,评审 61/62;`2d3b653` 同 commit 写 docs/09 §16 140 行);后四条 IN `e0bb23a`(画像向导,R84) | 覆盖 |
| 14 | onboarding(08-10) | `1ab27cc` `e8e987f` `0c4c04a` `c25b106` `f11cc8d` `b9b44f5`(6) | 实测 IN `862d921`(R84「onboarding」);§12-7 first-run 合同在 docs/09:1247;**但 `1ab27cc` 的三个 WS 消息/字段无 canonical 回写**(并入 B-4) | 部分 |
| 15 | focus/brain 合同批(08-08/09) | 12 条(`abd7474`…`12d3474`) | `12d3474` 即 R84 索引的「v0.4 批①-④」末码;其余实测均为其祖先;evidence `focus-contract-batch.md` + docs/09 §15(R84 记「§15 回写 9b8c7e9」) | 覆盖 |
| 16 | brain 08-06 修复 + voice 08-04 + voice/readiness 07-28 | 14 条 | 08-06 六条实测 IN `c00f09f`(R84「E2 修复串至 c00f09f」);F23/redactor(08-04)在 R84 Focus 时代索引;07-28 五条 voice = R56/R56 补记/R57 逐批叙事;五条 readiness = R55/R55 补记(「走查补齐五项」即 `dbb9e36` subject) | 覆盖 |

### 2.2 深读 commit(10 个)与文档一致性

| commit | 读取深度 | 一致性结论 |
|---|---|---|
| `911ce95`(byoa L-1) | 完整 diff | 与 w54b §18.4 L-1 修法方向逐点一致(§1.2);测试断言(hashes=2、invocation=1、actualBinaryDigest=哨兵)与 message 自述互证 |
| `7f6562e`(voice B-5) | 完整 diff | 与 codex 100 B-5 建议逐点一致(§1.3);三测试对应建议的补测要求 |
| `4545769`(8 条 B 级) | 全文 message + stat | 与评审 B1-B8 逐条可对上;subject 计数口径见 C-2;**处置结果无文档落点**(B-5 发现) |
| `4b7d0d6`(A1-A5) | 全文 message | 与 readback §11「A1-A5 已修」表逐条一致(259/native 异常/RetainedError/home_owned 复核/junction+ACL) |
| `9f0e735`(A6 前置) | 全文 message | 打开 Windows 单测门 + TOML 转义;**92 failed 新登记债在全部文档零命中**(grep "92 failed/Windows 单测门/ConnectNamedPipe" 于 docs/ e2e/evidence/ history/ → 0) |
| `3e56ac5`(Windows 自杀链) | 全文 message | 与 readback §10「:961 真实根因…Codex 定位」段逐字同源 |
| `03c6d54`(S1 收紧) | 全文 message + stat | message 自含 04 §5.4/verifyFreeze 依据;随 public-readiness 批入主 |
| `316f031`(POSIX 锚 + cmd/bat 门) | 全文 message + stat | R91 标题级覆盖;week-audit-ledger 登记 |
| `2d3b653`(contracts §16) | stat | **模范配对**:同 commit docs/09 +140 行 + contracts + 测试 |
| `1ab27cc`(restart_pending/ack) | stat | **反例**:只改 contracts+test,docs/09 至今零回写(B-4) |

### 2.3 孤儿判定

**未发现零文档痕的实质 feat/fix。** 每条 commit 至少落在:evidence 成对台账(簇 7/9)、readback 叙事(簇 4/5/6)、R 节全 SHA 登记(簇 8/11)、R84 一行索引 + merge 归属(簇 10/12-16)之一。最接近孤儿的是簇 1/2(L-1、B-5 修复):有源 finding、有高质量 commit message、有测试,但按本仓自立的记录纪律(R84:「后续批次收口按 PLAN-2 §7-9 一行索引 + 台账 §2 追加行双轨登记,不再欠账」)属欠账,列 B-2。

---

## 3. 发现清单

### A 级(错误/不一致)

**A-1 · docs/09 canonical 内部自相矛盾:§10 握手/兼容合同与 §16 冲突,且 §10 的 pipeline.health 形状与 contracts 不符**
- 主张:§10(09:984-988)仍要求握手首包带 `runtimeSha` 且「缺失、非法或不一致均以 4001 拒绝…三方一致」,sketch 中 `pipeline.health{runtimeSha}`;§16.1(09:1551/1566-1567/1571)已改判「protocolVersion…semver major 兼容」「旧 runtimeSha 只可作兼容别名,不得再作为进程兼容或启动成功判据」「pipeline hello/health 以 protocolVersion 兼容和 stateRootDigest 相同为接入条件」。实现(`contracts/src/runtime.ts:3,128-133`、`contracts/src/types/pipeline.ts` health 分支 `identity: runtimeIdentitySchema`)与 §16 一致。
- 证据:上引行号均为本会话实读;`grep -n "^## " docs/09` 定位 §10=984、§16=1540。
- 附注:该分叉已被 capture 方案 §9 与 Codex A-2 标记,但定性为「canonical vs 实现」,漏掉 §16 已回写这一半——处置方向因此不同。
- 建议处置:**对齐文档**——重写 §10 握手段(identity 三元组 + protocol major + stateRootDigest 判据,附 §16 指针),同步 sketch 的 health 形状;并把 capture 方案 §9 该行的定性改为「§10 陈旧待回写」。属 canonical 变更,上浮 owner 批准后执行。

### B 级(疏漏/不足)

**B-1 · capture 方案未回注 B-5 已修,§2.5/§9/§7.1-8 的前提在当前 main 上已不成立**
- 主张:方案 §2.5「已知边界…Console 不会重发 voice.mode…该现网缺陷另行立项修复,不进本方案改动面」、§9 风险表同句、§7.1 用例 8「pipeline 重连后 shadow 重置 ptt」——`7f6562e`(08-26 22:32 并入)后 hub 已重放最近生效 voice.mode,上述叙述过时;shadow「重置 ptt」会被随后的重放覆盖,断言语义需重写。
- 证据:§1.3;`7f6562e` 完整 diff(`lastVoiceMode` 留档 + `firePipelineJoined` 重放);方案定稿会话(R111)与修复同日先后。
- 建议处置:**对齐文档**(方案出 v2.1 增补:§2.5 边界段改写、§9 行改「已修 `7f6562e`」、§7.1-8 按重放时序重写)。实施 PR1 前必做。

**B-2 · L-1 与 B-5 两条已并入 main 的修复线零过程记录;三处既有文档相对 main 已过时**
- 主张:`911ce95`/`f723ab7`、`7f6562e`/`1f2e57e` 无 journal R 节、无 evidence 文件、无台账行;R110:2833「L-1…未修」、R113:2956「L-1 独立会话正在其中施工,未动」、w54b-batch.md:581 L-1 行(未注已修)相对 main 现状均已过时(journal 为 append-only,旧节不必改,但缺新节/追注)。
- 证据:journal 全文 grep `911ce95|7f6562e|1f2e57e|f723ab7|vibrant-bose|preSpawnGate` → 仅 R113:2956 一处;两 merge `--stat` 零文档文件;§1.2/§1.3。
- 建议处置:**对齐文档**——补一节 journal(或 R84 式一行索引)覆盖两条修复线;w54b §18.4 L-1 行追加「已修:`911ce95`(2026-08-27)」注。

**B-3 · runtime 重实施线 + rc.5–rc.12 发布链未按双轨登记纪律入账;DEV-VERSION-LEDGER 停更**
- 主张:journal 叙事止于 R97(rc.4,08-23),rc.5–rc.12(08-25/26)与 runtime 08-24~26 段(约 10 条 commit + 28 提交的分支收口)无 journal 索引、无台账 §2 行;`history/DEV-VERSION-LEDGER.md` §1 仍写「git tag | v0.1.0-rc.1…唯一 tag」(内部仓字面为真——`git tag` 实测仅 rc.1,rc.2-12 在公开仓——但作为版本线速览已严重滞后且易误读)。R84 曾立「不再欠账」的双轨纪律。
- 证据:journal grep `rc\.[5-9]` → 0 命中;ledger grep 实读;覆盖现靠 readback §13-§17 + HANDOFF:48 + `e2e/evidence/2026-08-26-rc1x-*.json`。
- 建议处置:**对齐文档**——台账 §1 tag 行注明公开仓 rc.2-12 与终态;§2 补 runtime 三段(recovery-rebuild 二轮红灯/全新重实施/评审回修)与 rc.5-12 行;journal 补一节索引。

**B-4 · docs/09 §10「canonical 词表」缺 6+ 种在网 WS 消息;`1ab27cc` 违反「schema+docs 同工作单元」纪律**
- 主张:`native.reply`、`focus.entity`、`confirm.card/countdown/resolved`、`pipeline.restart_ack` 在 docs/09 全文零命中;`pipeline.restart_pending`(WS 消息义)与 `health.generation` 亦无(现有 4 处 restart_pending 命中全为 tier1 marker:09:672/673/946/1634);`confirm.click/decision`、`screen_text`、`console.heartbeat` 仅散见 §11/§15,§10 sketch 未收。
- 证据:§1.4(b) 逐消息计数表;`1ab27cc --stat`(只改 contracts+test);对照正例 `2d3b653`(同 commit 写 docs/09)。
- 建议处置:**对齐文档**——§10 sketch 一次性补全(或改为「形状以 contracts/pipeline.ts 为照抄源,本节收语义与方向白名单」的显式指针);逐消息补方向/角色白名单语义。canonical 变更上浮 owner。

**B-5 · rc4 runtime 对抗评审 A6 与 8 条 B 级的处置结果、及 Windows 92 项单测债,只存在于 commit message**
- 主张:readback §11 停在「待 owner 裁决:A6 与 8 个 B 级」;实际 `4545769`(owner 裁定 B 级全部修完再发布:6 修/1 回退/2 known)与 `9f0e735`(owner 裁定先修真机加载;打开门后实测 daemon 单测 Windows 92 failed,「新登记的既有问题…后续投入待 owner 裁决」)均已发生,任何文档(docs/、e2e/evidence/、journal、HANDOFF)零记载。
- 证据:两 commit 全文 message;grep `B 级全部修完|SAYDO_WRAPPER_TRACE|homeLockOwnership|92 failed|Windows 单测门|ConnectNamedPipe` 于 docs/ e2e/evidence/ history/ → 全零。
- 建议处置:**对齐文档**——readback 追加「§11 后记:处置结果」段;Windows 92 项单测债登记去向(台账或 evidence 遗留清单,类比 w54b §18.4 形态)。

**B-6 · HANDOFF §1 两个「supersede」块互相冲突,rc.4 假坐标在前**
- 主张:§1 头部 08-23 块自称「supersede 本节下方所有旧“当前”措辞」且当前候选=rc.4、承诺「将在本轮证据提交后回填本段」;真现势(rc.12 available,08-26/27)在其下方 §1.1 的快照行(自称「当前坐标唯一以本行为准」)。回填未发生,按块序阅读先得假坐标。
- 证据:HANDOFF 实读(23-44 行块 vs 48 行快照);`grep -c "rc\.12" HANDOFF.md` = 1。
- 建议处置:**对齐文档**——把 08-23 块降级为历史段(删其 supersede 声明)或按其自己的承诺回填,快照行上提到 §1 头部。

**B-7 · modules/a-dialogue.md A3「对话档恒 API(BYOA 判死)」与 canonical T18b 冲突**
- 主张:docs/09 §11 T18b(09:1272 附近)自 08-12 起已改为「全局 dialog 接受 API 或 CLI binding(oneshot)」并明言「本节覆盖…旧表述」;modules/a A3 设计要点④未同步。
- 证据:两处实读(§1.4(d))。
- 建议处置:**对齐文档**(A3 行改为「对话档 API 为主;全局槽可接 CLI oneshot(T18b),项目级恒拒 CLI」)。

### C 级(观察)

**C-1 · capture 方案的 hub.ts 行锚在 B-5 合并后整体漂移 +5~+10;其余文件锚仍精确**
- 实测对照:318→323(role)、493-501→502-510(holdForConfirm 剥离,现 502-503)、543-546→549-556(voice.mode 转发)、573-576→583-586(mobile_lan 二进制拒)、588→597(len<5)、602→612(0x02);`identity.ts:90-91/109-115/137/162-172`、`capToken.ts:13-21`、`dialog.ts:1318-1340`、`liveTools.ts:1111-1204`、`runtime.ts:128-133` 均仍准确。方案有「2026-08-26 会话内核验」时点声明兜底;实施时重取即可。

**C-2 · `4545769` subject 计数口径:「8 条 B 级(6 修/1 回退/2 记为已知限制)」6+1+2=9 ≠ 8**
- 正文自洽:B7、B8 各拆两半(B7 的 4/5 处已修 + B7-3 known;B8 前半修 + 后半 known),B2 回退。仅 subject 面需读正文对齐,不构成事实错误。

**C-3 · prompts/205 双号未入台账勘误登记**
- `prompts/205-ai-supply-activation-refresh.md` 与 `prompts/205-capture-device-ingress-adversarial-review.md` 并存(ls 实测);台账 §3「同号多文件…引用必须带完整文件名」的登记停在 08-21/22,未收此条。与 B-3 的台账停更同根。

**C-4 · 两处微小记述偏差**
- R111 记方案「471 行」,实测 `wc -l` = 472(入库/脱敏后差 1 行,量级无害);
- R84「CLI 供给扩容(08-13):merge `aa8034e`」——该 merge 的 subject 字面是「批 B console 列表即菜单+推荐槽三席…」,但其分支确含供给线全部提交(`648133d`/`ba90a7a` 实测均为其祖先,merge 分支内含「闭合点扩 gemini/qwen/copilot」),索引指向正确、字面易误。

**C-5 · 08-13 约 14 条 BYOA 解析加固 commit 无独立索引名**
- `a478319`…`d51a863` 等为 main 直提交,穿插当日四个 console 批之间(first-parent 序列实读);R84 以四个批名覆盖当日,该子线未单独命名。缓解:同日有契约回写 commit(`2e46446`)与评审 65-68;L-1 测试对 schema repair 路径未单列用例亦记于此(§1.2)。

---

## 4. 未核实项(如实声明)

- docs/09 §13 各工具的**签名/字段级**一致性未逐一比对(仅做了 32/32 工具名存在性核验)。
- `2026-08-25-rc4-windows-tier1-selfkill-rootcause.md`(85 行)未通读,其与 `3e56ac5` 的一致性由 readback §10 的同源叙述间接支撑。
- rc.5–rc.9 各版的 evidence JSON 内容未逐一打开(仅确认文件存在:`e2e/evidence/2026-08-26-rc10/11/12-*.json` 等)。
- `modules/d-presentation.md` D2 与 mobile 现实的漂移仅表面观察(呈现域超范围)。
- 公开仓(SayDo)侧的 tag/Actions 状态未远端直查,rc.2-12 在公开仓的断言取自 HANDOFF:48 与 readback §17(标注为二手,与 `git tag` 本地仅 rc.1 的一手观测不矛盾)。
