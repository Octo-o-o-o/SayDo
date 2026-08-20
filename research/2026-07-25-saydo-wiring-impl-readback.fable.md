# SayDo 接线增量批 · 实施对账报告(/impl-review)

> 对账对象:接线批会话(交接 prompt = `IMPL-PROMPT-3-WIRING.md`;任务单一真相 = SayDo `HANDOFF.md` §2-9 六项)。
> 仓库:SayDo main;基线 `4307358` → HEAD `cd9f893`(与 origin/main 同步、工作区干净——本会话实测);区间 **6 个提交,64 文件 +3674/-244**(本会话 `git log/diff --stat` 实测)。
> 引用 hash 存在性:`0111d5f`/`b78d2e6`/`cd9f893` 均 commit(`git cat-file -t`,无幻觉引用);`4e97ae1`/`5769ae9`/`2292a37` 在区间 log 中实见。
> 评审路径:本人逐项取证 + 门禁亲跑 + 1 个独立 code-review subagent(区间 diff,见 §3)。

## TL;DR

**接线批交付成立:六项全部落地且有代码+测试双证据,门禁四路本会话亲跑与自报一致,自报边界诚实(执行器批缺口白纸黑字)。**
台账 13 项:[ok] 12 / [warn] 1(live-wiring e2e 为库层装配 rig,语音链生产入口覆盖靠场次①真人补——复审 C4)/ [fail] 0 / [mixed] 0;独立复审:**可合并、无 A 级**,4B 6C——owner 授权后已全部回收(见 §5 终态,`bf4b956`);**场次①的工程前置至此全部就绪**。
门禁(本会话亲跑):`just ci` 双矩阵绿(contracts **66** + daemon **386 passed | 1 skipped** + pytest **11** + emoji 门禁自检 4/4)+ Playwright **10 passed**(12.7s)。
关键定性:**"六项全部 [ok]"属实,但正式人工测试的解锁范围 = 场次①**——场次②③④还差"Tier1 生产执行器批"(认领 queued 起 agent 进程 + S2 live 上浮 + settle 回叫链),该边界不在 §2-9 六项内且已在 HANDOFF #1/#9、session-2 §0、wiring-batch.md §5 三处如实声明(本会话 grep 复核:daemon src 零执行器生产调用,边界为真)。

## 1. 对账台账(计划项 → 状态 → 本会话证据)

| # | IMPL-PROMPT-3 §3 项 | 状态 | 证据(本会话) |
|---|---|---|---|
| 1 | SessionManager live 构造 + unheard 过滤 + 转写落盘 | [ok] | `live/voiceSessions.ts` 存在;evidence 表 live-voice-sessions.test 7 例(在 386 绿集合);G6 锚 = index.ts 传 `cfg.privacy.store_transcript` |
| 2 | tier1 操作面(Brain 工具 + console 写口 + sheets 回填) | [ok] | `api/actions.ts`(头注声明 G1 门内=index.ts 统一 token+Origin 校验,深度由 §3 复审)+ `brain/liveTools.ts`;console-actions.test 14 例;session-2 step5/6 owner 触发动作已定稿(本会话 Read);**接线收紧**:approve evidenceDigest 库内自取(拒外部注入)——方向正确的偏离,已在 evidence 注记 |
| 3 | live 工具环 + Context Pack + 热词 | [ok] | `brain/registry.ts`/`live/confirm.ts`/`live/pack.ts`;live-wiring e2e 6 例(派单全链→queued/含糊复读/barge-in 作废/否定拒/Gate 0 拒/过期补发拒);hub_client.py 传 hotwords + pytest +3 |
| 4 | 停靠调度 + transitionTask CAS | [ok] | `live/scheduler.ts` + dao CAS;park-scheduler.test 4 例(30s 边界/T-U 竞态先提交者胜/72h 全链/活跃 run 不伪 settled) |
| 5 | console 端口修 | [ok] | api.ts 同源化 + vite proxy + allowedHosts(0111d5f B2 收窄);Playwright 新增 2 例(47120 真实回归 + 操作行)本会话亲跑绿;**直连改 proxy 是合理偏离**(不放宽 G1 Origin 白名单——比放宽白名单的方案安全) |
| 6 | retryTask 重派发 | [ok] | contracts task.ts failed→queued 边 + operations.ts 走 canTransitionTask(裸 UPDATE 删除);tier1-operations.test 重派发正反例 |
| 7 | 六条 e2e | [ok] | live-wiring.e2e + console-actions + park-scheduler 覆盖六条(evidence §2 锚;**派单链如实止于 queued**——执行器边界) |
| 8 | evidence 六段 | [ok] | `e2e/evidence/wiring-batch.md`(含 §5 诚实差距清单——比要求多出六条挂账明细) |
| 9 | HANDOFF 清账 + 场次解锁声明 | [ok] | #9 划账带 SHA;#1 场次解锁声明(①可约/②③④差执行器批)——本会话 Read 原文 |
| 10 | canonical 回写走评审 | [ok] | 09 §10 词表补录(latency.stage/asr.hotwords,时序注明)+ §13 两注 + 11 §5.5 两按钮 + ADR-002 附则与 superseded 前向指针(本会话逐处 Read);一致性 subagent(0A/3B5C 全吸收)+ **Codex 16**(报告+triage 实存:50 分钟,5A=4 修 1 登记、7B 全修——triage 理由逐条可核) |
| 11 | 评审仪式(code-review A 必修) | [ok] | 三路评审留痕;A 级累计 6(subagent 1 + Codex 5),5 修 1 登记(BYOA familyFixed 生产不可达+owner 决策承载——登记合理) |
| 12 | 两提交法 + 推远端 | [ok] | feat×2 + fix×2 + evidence×2,与 origin 同步 |
| 13 | journal | [ok] | voice-coding R38 实存 |

**执行器边界核验(本会话独立)**:`rg "from \"./tier1/executor|runTier1|claimQueued" src(排除测试)` 零命中;index.ts 无 adapter/spawn 调用——**场次②③④依赖执行器批的声明为真**,不是实施方推责。

## 2. 我方独立发现

1. **无虚报**:六项、门禁数字、评审账目、canonical 回写逐一复现;daemon 计数"391 笔误"已被 evidence 自纠(以 386 为准,本会话亲跑证实)。
2. **诚实度为三轮实施最佳**:§5 差距清单主动列了六条挂账(执行器/消费口/BYOA 并存/assessReadiness 最小形态/S2 live 上浮/seedTerms),均有承载批注——上一轮"可接线 vs 已接线"的表述教训被吸收。
3. [warn] 微瑕:IMPL-PROMPT-3 §3 曾写"console API 现全 GET,需加动作端点"并要求 e2e"审批语音消费"——已达成;但 §3 任务 3 的"approveAction 等按 09 §13"在实施中被裁剪为"无消费者不造接口"(approveAction 未注册,S2 live 上浮归执行器批)——**合理偏离**(接口无发起方即空壳,违反反空壳纪律),evidence §5 已注记,不算走样。

## 3. 质量复审(独立 code-review subagent,区间 4307358..cd9f893;其本机复现全部门禁 + hexdump 验字节 + node 实测词表行为)

**总判定:可合并——安全红线(Gate 0/S3/redactor/收据/G1)全部无破坏,无 A 级;4B 6C 列 §5。**八项声称逐一核对:7 项证实、1 项部分证实(live-wiring "e2e" 实为库层装配 rig,语音链生产入口覆盖打折——console 写口有 Playwright 真 HTTP 链,daemon 装配段靠场次①真人补;命名口径建议改 "wiring")。

| 级 | 位置 | 问题 | 要点 |
|---|---|---|---|
| B1 | `approvals/confirmVocab.ts:12` | norm 剥除表里是**两个 ASCII `!`**,全角感叹号 `\uFF01` 不在表内——与 Codex 16 A2 修掉的"两个 ASCII ?"同种字节病残留 | hexdump 实证;`"可以!"`(半角)accept、`"可以！"(全角)unmatched`——sauc 实测回全角标点(ADR-101),带语气的肯定会被系统性**误拒**→复读→两次转屏。方向 fail-safe 但词表环可用性受损,**场次①体验直接命中** |
| B2 | `live/dialog.ts:133,162` | 收据被 15s sweep 终局后,内存 pending 未同步清:用户此时答"可以","receipt is terminal" 异常只落 log——**用户零反馈且 pending 被删** | 修法:applyReceiptEvent 包 try/catch → "这个确认过期了,重新说一遍"话术;同样命中场次① |
| B3 | `tier1/operations.ts:396-398` | retryTask 的 blocked→running 不冻结 `trigger=blocked` 活跃回叫条目(failed/ready_for_review/cancel 都有冻结,唯独 blocked 缺)——通知链上线后会重叫已答复的问题 | 一行:blocked 分支补 `freezeOutbox(...,"blocked")`;显性化时点=执行器批 |
| B4 | `index.ts:310-312,353-359` | **config.toml 损坏(非缺失)时 catch 回落朝宽松侧**:storeTranscript 回落 true(owner 设 false 被静默翻转,G6 同意翻转)、readGate0 回落 enabled:true(dispatch 放行);TOML 语法错误被吞,daemon 带宽松缺省继续跑 | 修法:隐私项回落 false,或"config 存在但解析失败 ⇒ 拒启动"(与 [params] 非法同律)——唯一 fail-closed 例外点 |
| C1–C6 | 详见复审原文 | POST body 无上限/句中问号剥除/工具环步数耗尽零句/live-wiring 命名/readTaskMessages 消费口防遗忘/45s 定时器无直接测试 | 低风险,随下批 |

**不变量核对全绿**:Gate 0 唯一分支是拒;S3 无语音放行、无自动 merge(task_done 必经 git treeSha 对账);TTS hub 层统一 redact 收口;收据单次消费+同事务;G1 daemon 侧零改动(vite 层 Host 白名单补偿,token 门不豁免);契约零深 import;零 emoji;`SAYDO_DISABLE_CAP_TOKEN=1` 实测**恒拒非放行**(无测试后门)。

## 4. 门禁结果(本会话亲跑)

| 命令 | 结果 |
|---|---|
| `cd ~/WorkSpace/SayDo && just ci` | 绿:contracts `66 passed` + daemon `386 passed \| 1 skipped (387)` + pytest `11 passed` + `[ok] emoji gate: clean`(自检 4/4)+ 尾行 `[ok] just ci: node + python matrices green` |
| `pnpm exec playwright test` | `10 passed (12.7s)`(含 vite 47120 真实回归与任务详情操作行两条新增) |

## 5. 修复清单 → 回收终态(owner 2026-07-25 晚授权"修";代码 `bf4b956` + evidence `2f657ed`,已推远端)

1. **[B1] 全角感叹号误拒** → **已修**(norm 表显式 `\uFF01` + 7 断言回归)。
2. **[B2] 过期确认零反馈** → **已修**(try/catch 按错误面分话术:terminal=过期/基础设施故障=如实报障——复审 C-1 收窄并入)。
3. **[B3] blocked 回叫冻结** → **已修**(事务内 freezeOutbox("blocked") + 回归测试)。
4. **[B4] config 损坏回落方向** → **已修**(新模块 `config/runtime.ts`:存在但解析失败 ⇒ 启动拒;运行期 Gate 0 fail-closed enabled:false + 审计;4 测试)。
5. [C1/C2/C3] POST body 1MB 上限(/api + /dev 三路由,按网络字节计)→ **已修**;[C3 前批] 工具环零句兜底 → **已修**;[C4] rig 口径头注 + fixture 状态机可达 → **已修**;[C2 句中问号] 语义取舍**不动**;[C5/C6] 既有承载(执行器批任务单/dogfood 期)。

**回收批 2 复审**(第二只 code-review):**1 A 当轮修**——B4 修复自身引入的审计原文泄漏(TomlError message 内嵌 config 原文 codeblock,经 failClosedReason 流入 append-only audit_log;修法=摘要只取首行脱原文)——"修复引入新洞、复审再抓回"正是双环评审的存在意义;其余重点核查(B2 内存清理无遗漏/B4 无审计刷屏/C1 无双写/B3 事务同层/B1 否定优先不受影响/hub redact 收口未绕过)逐项确认通过。
门禁终态:`just ci` 双矩阵绿(contracts 66 + daemon **393 passed | 1 skipped**,+7 测试)+ Playwright 10/10(均本会话亲跑)。

## 6. 对"正式人工测试还差什么"的更新口径

接线批完成后:**场次①今天可约**(按 session-1.md §0 二次修订版);场次②③④的唯一剩余工程前置 = **Tier1 生产执行器批**(认领 queued 起 agent 进程 + S2 审批 live 上浮 + Tier1SettleProof 生产产出 + settle 回叫链;挂账明细 wiring-batch.md §5)。owner 侧前置不变(ntfy 订阅/dogfood 仓指定/耳机)。
