# SayDo W4 实施批(S3 卡 + writing 窄版落地)· 实施 Prompt(第八轮交接,复制分隔线以下到新会话)

> 背景:W1/W2/W5a 已收口并经 /impl-review 对账通过(evidence `w1-batch.md`/`pull-forward-batch.md`/`w5a-batch.md`;readback 报告在设计库 research/)。R-A 合同轮已收口(2026-07-26 夜主体 + 2026-07-27 补完轮:4 subagent + Codex 21 对抗评审、A1–A6 全量回修,journal R49–R51;Codex 22 独立复核因账号登录态失效转追认制,追认若出 A 级增量按"合同增量随批走"通则处理)。本批 = PLAN-2 §1-W4 + 三个增量项(§3.7–3.9,owner 停点确认后生效)。估 3–5 天 + 增量 2–3 天,做不完如实登记顺延,不硬塞。

---

你接手 **SayDo W4 批(S3 卡 + writing 窄版落地)**。代码仓 `/Users/wangyixiao/WorkSpace/SayDo`(main 直推);设计库 `/Users/wangyixiao/WorkSpace/voice-coding`(只读;canonical 回写见 §2 红线)。完成判定 = §3 各项验收锚绿 + evidence `e2e/evidence/w4-batch.md` 落盘 + HANDOFF 回填(批次指针开批写 `W4`、收口清除)。

## 0. 坐标核验(先做,漂移即停;期望值 2026-07-27 19:10 实测)

| 命令 | 期望 |
|---|---|
| `git -C ~/WorkSpace/SayDo log --oneline -1` | `eabc5ac`(W5a 收口)或其后 evidence 提交;工作区干净(e2e/screenshots png 抖动可 checkout 复原) |
| `rg -n "当前批次指针" ~/WorkSpace/SayDo/HANDOFF.md` | 指针为空(非空 ⇒ 有批在途,停) |
| `cd ~/WorkSpace/SayDo && just ci` | contracts **67** + daemon **564 passed \| 4 skipped** + python **20**;ci-exit=0(退出码显式核查,禁管道取尾) |
| `pnpm exec playwright test` | **14 passed** |
| `git -C ~/.saydo/runtime rev-parse HEAD` | `eabc5ac`(本批收口后 `just daemon deploy` 更新) |
| `rg -n "### 3.3 " ~/WorkSpace/voice-coding/docs/09-data-contracts.md` | 197 行附近(§3.3 S3 卡;±10 行内可接受,大漂移 ⇒ 停,设计库可能有 Codex 22 追认回修,重读合同节) |
| `rg -c "MIGRATIONS" ~/WorkSpace/SayDo/packages/daemon/src/storage/ddl.ts` | 迁移现到 **v8**(W5a:v6 decisions/v7 project_settings/v8 subscription_retry)——**本批新迁移从 v9 起,版本号现取勿写死** |

## 1. 必读(按序)

1. `SayDo/HANDOFF.md`(§0 硬教训 / §4 铁律)+ `SayDo/AGENTS.md`
2. `voice-coding/IMPLEMENTATION-PLAN-2.md` §1-W4 行 + §4 通则 + R-A 行(合同已落状态)
3. **合同节(本批照抄源,坐标 2026-07-27 19:10 实测)**:
   - S3 卡全链:`docs/09-data-contracts.md` §3.3(197 起:schema 201-235 / S3MergeReceipt 判别型 228 / assertS3LocalAndBound 守卫 237 / 注册链 239 / 签发链 241 / 合并链 243 / 同步凭据诚实条款 245 / turn_ref 放宽 249 / 契约测试句 253)+ §9 两表 DDL(592 起)与 approvals 六列两 CHECK(约 566-590)+ §13 四工具(registerWebauthn/issueS3Challenge/verifyS3Assertion 约 975-990、approveMerge 五步事务合同 995-1010)+ §12-13(反例集收编)
   - writing 窄版:09 §6.1a(410 起:route/门禁 414 / verify 语义 415 / WritingSettleProof 418-428 / **writingSettleBarrier 五断言** 430 / 逐节停靠 / content_done / 合并链 / 迁移与开值)+ §11 `enabled_project_types`(858:缺省 ["coding"],**翻值 = 本批收口动作,前置清单七项全绿才翻**)+ §12-12(fixture 断言口径换型)+ §12-14(barrier 反例)
   - UI:`docs/11-ui-spec.md` §5.4(175:S3 卡 Touch ID 按钮/诚实注脚/tailnet 不渲染/未注册降级)+ §5.5(182:writing manual 项逐条裁决置灰 + 合并按钮语义 + route=hopper 不渲染 S3 主按钮)
   - 话术:`docs/10-voice-ux-spec.md` #20(S3 导航)+ §5(content_done 分支)+ §6(golden 扩位,s1-b2 已登记)
   - 机制:`docs/04-key-mechanisms.md` §5.1(141:S3 语义)+ §6(195:合并段按类型)
4. `SayDo/e2e/evidence/w5a-batch.md`(W5a 现状边界;v6-v8 迁移已占用)

## 2. 红线(违反即停)

恒律全套(零 emoji / 状态词纪律 / Gate 0 无 bypass / **S3 语音绝不放行** / TTS 必经 redactor / 契约只 import `@saydo/contracts` / 两提交法 / 每步独立核实 SHA / 门禁退出码显式核查)+ 本批专属:
- **S3 面统一走 `assertS3LocalAndBound` 四断言**(09 §3.3:socket peer=loopback / Origin 精确 localhost / via="local" / rpId 常量);S3 收据只能由 `verifyS3Assertion` 产生,通用 decide 端点对 risk='S3' 一律拒;**四个 S3 工具不进 Brain tool manifest**;
- **`review_approved_waiting_merge → merging` 唯一入口 = `approveMerge`**(五步事务合同照抄 09:995,含收据消费 CAS 与任务转移 CAS);generic screen 收据不构成 S3MergeReceipt(类型层 + DDL CHECK 双层);**既有 fixture/storage-checks 里直插 `risk='S3',decided_via='screen'` 的行必须随 v9 CHECK 改造**;
- **Hopper 路径恒人工交接**(09 §14-A9 未裁决;SayDo 不自动调 `hopper merge`,HANDOFF §4 铁律不变);
- **writing 翻值纪律**:`enabled_project_types` 缺省翻 `["coding","writing"]` 是收口动作——09 §11 注前置清单七项(config 数组装载/artifact 'article'/WritingSettleProof validator/settle barrier/content_done 分支/verify 内容型模板/§12-12+14 正反例)**全绿后才翻**,翻值同批把 §12-12 反例改用 research 并加 writing 正例;
- **迁移版本号现取**(§0 断言 v8 为当前;本批 v9 起,勿写死——canonical 09 §9 注同口径);
- **canonical 回写攒批**:R-A 已收口,但 Codex 22 追认在途——本批 09/10/11 回写(如 HANDOFF §4 铁律行同步的 canonical 侧)登记进 evidence"待回写清单",收口时经设计库会话落盘;语义级缺口一律登记回设计库,不自定;
- 输入区/PTT 面:仅 §3.9 增量项(owner 确认后)可触碰,其余任务不碰。

## 3. 任务清单(竖切,按序;每项验收锚可判定)

- **3.1 S3 卡全链(最高优先;合同 = 09 §3.3 全节照抄)**:v9 additive 迁移(webauthn_credentials + s3_challenges 两表(09:592 形状,含 BE/BS 列、单活跃凭据部分唯一索引、challenge UNIQUE、merge/register 双 CHECK)+ approvals 六列(s3_challenge_id UNIQUE REFERENCES/credential_id/assertion_digest/attempt/package_revision/prospective_tree_sha)+ 双向 CHECK + **turn_ref 旧 CHECK 放宽**(`decided_via != 'voice' OR turn_ref IS NOT NULL` 替换 ddl.ts 现 runtime_effect 行,旧 voice 行全满足)+ 存量库表重建对账)→ 四工具实现(签名/事务语义逐字照 09 §13:registerWebauthn 挑战消费制 bootstrap 一次性、issueS3Challenge 绑定对象全库内自取拒外部注入、verifyS3Assertion 同事务签 S3MergeReceipt、approveMerge 五步事务)→ assertS3LocalAndBound 守卫(identity.ts 补 socket peer 校验)→ console S3 卡(11 §5.4:Touch ID 按钮 + navigator.credentials + 诚实注脚 + tailnet 不渲染 + 未注册降级 + 超时置灰)→ requestManualMerge/verify-merge 降级路径保留 → `canTransitionTask` 对 merging 边的 receipt-gated 谓词。验收:§12-13 反例集全绿(基础 7 + A1 增 10 + A2 增 9,09:253 收编句逐条;含并发双 approveMerge 恰一成功、崩溃注入回滚);S3 卡 Playwright 交互用例(渲染条件/置灰/降级);migration 前后行数/digest 对账。
- **3.2 writing 窄版落地(合同 = 09 §6.1a 全节)**:contracts project enum + zod 加 writing、config `params` 接受数组(`enabled_project_types` 装载)→ artifact 词表加 `article` → WritingSettleProof validator(kind 判别,与 Tier1SettleProof 并列)→ **writingSettleBarrier 五断言**(09:430 逐字:成稿对账/节 exact-set(outlineSectionId=String(plan.seq))/验收对账(manual 项 settle 恒 unknown)/人评终局在 approve(reviewTask writing 分支:evidenceDigest=H(JCS(proof)),manual 项逐条置 pass)/原子性)→ executor 按 project.type 分叉(writing:verify 可空=内容评审 gate,不再 no_verify_registered 阻塞;settle 走 barrier)→ explainResult content_done 分支 + 10 §5 话术模板 → TaskDetail 逐条裁决 UI(11 §5.5:manual 未逐条裁决"验收通过"置灰;settled ≠ 全绿)→ OctoBlog 奠基接入(W2-C 能力复用)→ **前置清单全绿后翻值** + §12-12 反例口径换型。验收:§12-14 反例全绿(空稿拒/漏节拒/agent 自填 pass 拒/未逐条裁决拒/崩溃重放收敛);writing 全链单测;翻值后缺省 fixture 断言更新。
- **3.3 golden 扩 writing/S3 场景**(10 §6):S3 导航话术(#20 卡片 P1 版)+ content_done 完成话术 + writing 回叫;文本注入级为主。验收:golden 断言绿。
- **3.4 双仓最小并行切片**:双 dogfood 仓(OctoDesk/OctoBlog)各一队列/并发 2 + 同仓串行守恒 + console 排队可见。验收:并发注入测试(同仓串行不破、跨仓并行、排队投影)。
- **3.5 E2E 全链**:OctoBlog 一篇真实文章"聊 → 开始写 → 成稿 → 逐节验收 → 定稿"(选材避开外部网页引证依赖——窄版无引证合同)+ **S3 卡真人过一次(owner 触点,§4)**。验收:e2e evidence 记录 + owner 过卡审计行。
- **3.6 收尾**:HANDOFF §4 铁律行同步(S3 卡兑现措辞:无 S3MergeReceipt 不进 merging;Hopper 仍人工——canonical 侧同步句登记待回写)+ evidence `w4-batch.md` + HANDOFF §2 回填 + 指针清除 + `just daemon deploy` + PLAN-2 §1-W4 行标状态(经设计库)。

**——以下三项为增量项(排产缝清偿,owner 停点确认后生效;砍掉不影响 3.1–3.6)——**

- **3.7 readinessSkeleton 生产接线(Codex 21 A3;W1 实测"空账本判就绪"漏洞的根修)**:contracts 单源纯函数 `readinessSkeleton(type, projectEvidence, lane)`(词表源 = 02 §5 类型清单)→ 会话建立/assessReadiness/proposeStart 三处复用(liveTools 三点接线,替换现"dims 恒空"路径)→ fail-closed 四况(类型模板缺失/骨架未装配/全 unknown/provider 不可用 ⇒ gap_critical 且落 readiness_assessments 行)→ `readinessRef` 组包绑定(factory 写入,§0.1 签名域已含)。验收:§12-15 反例全绿(空账本恒 gap_critical/三处同源断言/quick 车道不得删 critical/readinessRef 缺失拒拍板);W1 场景回归(owner 一句话零采访 ⇒ 不再凭空出包)。
- **3.8 proposed TTL 实施(Codex 21 A6;canonical 09 §2 注 ④ 照抄)**:v10 迁移(decision_packages 加 proposed_at 列 + CHECK + 唯一活跃部分索引)→ PackageTransitions 加 `proposed→expired/superseded` 两边 + **既有断言"该转换抛错"的测试改造**(storage-roundtrip.test.ts:100-102)→ propose 事务 CAS 关旧 → scheduler 扫描到期 → dispatch/approve 双闸 → factory 移除 draft 期 `now+7d` 写值 → 删 `updatePackageExpiry`。验收:§12-1 A6 反例全绿(缺锚 DDL 拒/双活跃拒/到期 dispatch 拒/无独立写点断言/调度器崩溃重启幂等)。
- **3.9 对话输入区改版(场次① owner 反馈;合同 = 10 #7 + 11 §5.10)**:三态采集(点击 toggle/空格 hold/免手 VAD 并列)+ 录制中反馈(电平/波形+计时+可取消)+ 采完不直发(手动档进输入区双呈现:语音条+可编辑转写,确认再发;免手档自动发但可事后编辑)。contracts 层 `voice.mode` 二值不动(ptt 涵盖两种手动触发)。验收:Playwright 输入区交互用例(三态切换/录制反馈/编辑后发送);免手档回归不破(W2-D 能力)。

## 4. 检查点(必须停等 owner)

① **增量项确认**(3.7/3.8/3.9 做不做——开批第一停点);② **S3 卡真人过卡**(3.5,owner 在场才能做;缺省动作 = 顺延该子项继续其他);③ OctoBlog 首篇文章验收(owner 逐节评审);④ 翻值 `enabled_project_types` 前把前置清单七项贴给 owner 过目;⑤ `just daemon deploy` 若 owner 在语音会话中先知会;⑥ 新花费:预期零(全部订阅额度内)。缺省动作:无回复 = 暂停该分支继续其他。

## 5. 诚实汇报 + 工作方式

三级词表([ok] 可复跑证据 / [warn] 差距 / [fail] 原因);SHA 与测试输出来自本会话真实命令;`just ci` 每提交前必绿(退出码显式核查);两提交法(feat/fix → chore(evidence));批末 1 个 code-review subagent(A 级必修,前台);canonical 回写攒批登记(§2);收口后 owner 用 /impl-review 对账;竖切顺序 3.1→3.2→…→3.6(增量项获准后插在 3.4 前后自定,3.9 建议最后——UI 面独立);批容量不足时 3.3/3.4 可顺延登记,3.1/3.2 是本批存在理由不可顺延。

开始吧:先跑 §0(指针非空或基线漂移即停),读 §1,在第一停点等 owner 对增量项表态,然后按 §3 顺序实施。
