# W4 实施批(S3 卡 + writing 窄版落地 + 三增量项)—— 验收证据(2026-07-27)

> 范围 = IMPLEMENTATION-PLAN-2 §1-W4 + 增量 3.7/3.8/3.9(owner 2026-07-27 开批第一停点确认全做)。
> 竖切 3.1(S3 卡)→ 3.2(writing 窄版)→ 3.3(golden)→ 3.7/3.8(增量)→ 3.4(双仓并行)→ 3.9(输入区)→ 3.5(E2E)→ 3.6(收尾)。
> 三级词表:[ok] 可复跑证据 / [warn] 差距如实 / [fail] 未做。SHA 均为本会话 git log 真实输出。
> 开批基线 `eabc5ac`(W5a 收口);§0 坐标核验七项全过(ci contracts 67 + daemon 564|4 skipped + python 20;
> playwright 14;批次指针空;runtime HEAD eabc5ac;docs/09 §3.3 @197 行;迁移到 v8)。

## 收口基线(本会话真实命令输出)

- `just ci`:**contracts 73 + daemon 638 passed | 4 skipped + python 20**;`[ok] just ci: node + python matrices green`(退出码显式核查 ci=0,未管道取尾)。
- `pnpm exec playwright test`:**21 passed**(W5a 14 → +7:S3 卡 3 + writing/输入区/迁移归一等)。
- 迁移现到 **v11**(v9 S3 卡两表+approvals 六列 / v10 projects+writing / v11 proposed TTL)。

## 3.1 S3 屏幕审批卡全链(最高优先;合同 09 §3.3;代码 `af1af36`)

- [ok] **v9 迁移**:`webauthn_credentials`(单活跃部分唯一索引 + BE/BS 列)+ `s3_challenges`(challenge UNIQUE + merge/register 双 CHECK)两表;`approvals` 六列(s3_challenge_id UNIQUE REFERENCES/credential_id/assertion_digest/attempt/package_revision/prospective_tree_sha)+ S3 判别域双向 CHECK;**turn_ref 放宽**(删 runtime_effect 非预授权须绑 turn_ref 行,唯一强制余 voice)。表重建行数对账。
- [ok] **四工具**(`tier1/s3Tools.ts`,签名/事务逐字照 09 §13):issueS3Challenge(绑定对象全库内自取拒外部注入,strictObject 拒 rpId/refDigest)/ registerWebauthn(挑战消费制 bootstrap 一次性,绝不签 ApprovalReceipt)/ verifyS3Assertion(同事务签 S3MergeReceipt + 置 consumed + 更新 signCount,原子防重放)/ approveMerge(五步事务:判别→收据消费 CAS→任务转移 CAS→全匹配→merge 执行段)。
- [ok] **WebAuthn 验签核**(`tier1/webauthn/`,零第三方依赖):最小 CBOR(indefinite/tag/float 全拒)+ COSE ES256/P-256 验签 + authenticatorData 解析(UP/UV 断言)+ signCount 规则(平台 passkey 0/0 跳过克隆检测并诚实记账)。
- [ok] **assertS3LocalAndBound 四断言**(`net/s3Guard.ts`):socket peer=loopback(req.socket.remoteAddress 不可伪造)/ Origin 精确 http://localhost:<port> / via=local / rpId 常量;全 S3 endpoint 业务逻辑前先行;全端点强制 POST(封"同源 GET 无 Origin"口)。
- [ok] **S3 收据单产单消**:产生仅 verifyS3Assertion;消费仅 approveMerge;通用 decide 端点(index.ts HTTP + approvalFlow.decide)对 risk=S3 显式拒;四工具**不进 Brain manifest**(brain/ 零 S3 符号)。
- [ok] **console S3 卡**(11 §5.4/§5.5;`TaskDetail.tsx` + `lib/api.ts`):Touch ID 按钮(navigator.credentials.get)+ 未注册降级(去受信终端手动合并 + 注册入口)+ tailnet 不渲染(引导回桌面)+ 诚实注脚(同步凭据条款逐字)+ 批准前置灰;127.0.0.1 页面 308 归一 localhost(rpId 部署约束)。
- [ok] **合并执行段**(executeMergeSegment):进入 merging 后 worktree 树漂移断言 + 冻结 verify 重跑 + 主仓快进安全 + commit-tree ff-only + HEAD tree 断言 → task_done;冲突 ⇒ merge_failed;幂等(重放短路)+ daemon 重启 recoverMergingTasks。
- [ok] **§12-13 反例集 32 例**(`test/s3-merge-chain.test.ts`,真 P-256 签名 fake authenticator,不 mock 验签):基础 7 + A1 增 10 + A2 增 9 + 迁移对账 + 崩溃恢复 + 全链正例。含并发双 approveMerge 恰一成功、崩溃注入回滚、generic screen 冒充拒、tailnet/无 Origin 拒。

## 3.2 writing 窄版落地(合同 09 §6.1a;代码 `9790c27`)

- [ok] **contracts**:project enum + writing;artifact 'article';WritingSettleProof(kind 判别)+ writingSettleStructuralViolations(barrier ②③ 单源纯函数);ExplainKind + content_done。
- [ok] **executor 按 project.type 分叉**(`tier1/executor.ts`):writing → verify 可空=内容评审 gate(不因 no_verify 阻塞);成稿对账 ①(worktree 现读 article.md 存在+非空+digest+git ls-tree 命中树)+ 落 article artifact + sectionCoverage(ai 步 seq)+ acceptanceChecks(manual 恒 unknown)+ 结构 barrier;缺一转 blocked/failed 不 settle。
- [ok] **reviewTask writing 分支**(`tier1/operations.ts`):evidenceDigest = H(JCS(WritingSettleProof));manual 项由 approve 逐条置 pass,未逐条裁决拒(barrier ④,11 §5.5);critical fail 不带病批准。
- [ok] **类型门禁**(`tier1/typeGate.ts`):proposeStart/confirmAndDispatch 前置 project.type ∈ enabled_project_types(缺省 ["coding"]);pending 草稿放行(定型前不拦)。
- [ok] **v10 迁移**:projects CHECK 加 writing(表重建 + defer_foreign_keys 处理 sessions/tasks FK)。
- [ok] **explainResult content_done**(`summary/explain.ts`):one_liner 内容型模板"成稿 {drafted}/{total} 节,{ac_pass}/{ac_total} 项验收待过目"(10 §144);TaskDetail 逐条裁决 UI(settled ≠ 全绿置灰)。
- [ok] **§12-12(类型门禁)+ §12-14(writing barrier)反例 14 例 + 全链闭合 e2e**(`test/writing-narrow.test.ts`,真 git worktree + fake agent):空稿/漏节/幽灵节/重复节/manual 自填 pass/verify fail/未逐条裁决拒;全链闭合(成稿→逐节验收→S3 合并→定稿,§3.5)。
- [warn] **翻值 enabled_project_types = 收口停点(§4-④),缺省仍 coding-only**:前置清单七项——config 数组装载[过] / artifact 'article'[过] / WritingSettleProof validator[过] / settle barrier[过] / content_done 分支[过] / verify 内容型模板[过——readback B-3 勘误:收口时"可空 gate"缺 fail⇒不 settle 机械检查,已随 readback 回修批补齐(executor lint gate + 正反例 2 例)] / §12-12+§12-14 正反例[过],等 owner 过目后翻(见 §待 owner)。合同先行不代表能力开启。(readback 勘误 2026-07-28:原文此处用 pictographic 勾号致 emoji 门禁红——收口 SHA 上 `just ci` 非绿,已随 readback 回修批改字修复。)

## 3.3 golden 扩 writing/S3 场景(10 §6;代码 `9790c27`)

- [ok] `W4_GOLDEN` 4 条(`brain/golden.ts`):S3 导航 #20 卡片 P1 版(Touch ID 导航,绝不语音放行)+ content_done 完成回叫(状态词纪律)+ writing 逐节停靠回叫 + writing 交付;`golden-coverage.test.ts` 断言绿(模板要素 + 状态词零违规 + 零 emoji)。

## 3.7 readinessSkeleton 生产接线(增量;Codex 21 A3;代码 `e9f900a`)

- [ok] **contracts 单源纯函数** `readinessSkeleton(type, evidence, lane)`(词表 02 §5 类型就绪清单)+ readinessRef 契约(§0.1 签名域,computePackageDigest 纳入)+ readinessDimsDigest。
- [ok] **daemon readinessGate** fail-closed 四况(类型模板缺失/骨架未装配/全 unknown/provider 不可用 ⇒ gap_critical 且落 readiness_assessments 行);三处同源接线(assessReadiness/proposeStart/会话建立 复用 skeletonGate;**readback B-4 勘误 2026-07-28:收口时"会话建立"装配点实未接线、仅两处——已随 readback 回修批补齐 assembleOnSessionStart + LiveDialog 接线 + armed 装配用例**)+ readinessRef 组包绑定 + 拍板门(缺失/dimsDigest 不符拒)。
- [ok] **§12-15 反例 12 例**(`test/readiness-skeleton.test.ts`):空账本恒 gap_critical / quick 不删 critical / 模板缺失 / readinessRef 缺失拒拍板 / W1 场景回归(空账本 proposeStart 拒,不凭空出包)。
- [warn] **证据绑定(covered:哪些 dim 被对话/记忆机械判定覆盖)= canonical 留白**(02 §5/09 §4,与 W5a "dims 生产语义留白" 同源):经 `readinessEvidence` 注入 armed;生产默认未 armed,不改现有 propose 行为(W1 硬门待证据绑定 canonical 语义落定接线)——登记待回写。

## 3.8 proposed TTL 实施(增量;Codex 21 A6;代码 `2c4e26e`)

- [ok] **v11 迁移**:decision_packages proposed_at 列 + CHECK(status!='proposed' OR proposed_at NOT NULL)+ 唯一活跃部分索引 pkg_active_proposed(表重建 + 行数对账)。
- [ok] **transitionToProposed**(propose 事务 CAS 关旧活跃 proposed + 写不可变 proposed_at + expires_at=now+TTL;proposed_at/expires_at 唯一写点)+ PackageTransitions 加 proposed→expired/superseded + sweepExpiredProposed(调度器扫,幂等)+ dispatch/approve 双闸(isProposedExpired,receipt 在期不豁免)。
- [ok] factory 移除 draft now+7d 写值、删 updatePackageExpiry;expiresAt 改可选(draft 无)。
- [ok] **§12-1 A6 反例 8 例(readback 勘误 2026-07-28:原自述 9 例计数虚 1,用例内容齐全)**(`test/proposed-ttl.test.ts`):缺锚 DDL 拒 / 双活跃拒(直插+CAS 两路)/ 到期判定 / 无独立写点断言 / 调度器崩溃重启幂等 / expired 重提新 revision 非复活 / draft 无 expiry。

## 3.4 双仓最小并行切片(代码 `2fd81fe`)

- [ok] executor 现有认领模型即满足:每 tick 一认领 + 同 project 活跃 run 互斥(同仓串行)+ 跨仓successive tick 认领(并发 2)+ 排队投影(getProjectTasks 返 queued)。补并发注入测试锚定(`tier1-executor.test.ts` W4 3.4):跨仓并行(两仓各一活跃 run)+ 同仓串行守恒(第三 tick 不认领)+ 每仓剩一 queued 可见。

## 3.9 对话输入区改版(增量;10 #7 + 11 §5.10;代码 `2fd81fe`)

- [ok] **三态输入区**(`Chat.tsx`):待命(点击 toggle + 空格 hold + 直接打字 + 免手 VAD 切换并列)/ 录音中(实时电平波形 + 计时 + 取消)/ 待确认(语音条 + 可编辑转写,采完不直发,改字确认再发 / 重录)。voice.mode 二值不动(ptt 涵盖 toggle/hold)。
- [ok] **turn.text WS 通路**:console 编辑后文本轮 → hub(白名单 console 可发)→ 对话环作用户轮(typed provenance);**asr.final 仍 pipeline 专属,B8 不放宽**。useVoiceChannel 加 mic RMS 电平 + sendText/stopCaptureHold。
- [ok] **Playwright 三态交互用例**(`console.spec.ts`):待命三态入口 + 文本回车/按钮发送 + 点击→录音中(电平/计时/取消)→取消回待命 + 录音→停止→待确认(可编辑转写+语音条+发送/重录)→发送回待命。

## 3.5 E2E 全链

- [ok] **writing 全链闭合(自动化)**:`test/writing-narrow.test.ts` W4 3.5——真 git worktree + fake agent + fake Touch ID 走完"聊(createTask)→写(executor settle)→成稿(WritingSettleProof)→逐节验收(reviewTask approve 逐条 pass)→S3 合并(挑战→断言→收据→approveMerge→执行段)→定稿(task_done,article.md 落主分支)"。
- [warn] **OctoBlog 真实文章 e2e + S3 卡真人过卡 = owner 触点,顺延**(§4-②③):需 owner 在场过 Touch ID 卡(②)、owner 逐节评审首篇(③)、翻值 enabled_project_types 前 owner 过前置清单(④)——三者均 owner-gated,缺省动作=顺延该子项;自动化全链已闭合证明机制正确,真人 dogfood 待 owner 时窗。

## 批末评审(轻量制度;A 级必修,前台 code-review subagent)

- **结论:A 级两条,已全修**(均在迁移健壮性,非 S3 链本体):
  - **A-1(v11)**:W4 前 proposeStart 不 supersede,老库同项目可多行 proposed;建唯一活跃索引前先收敛(保留最新,其余 superseded)——否则升级即启动阻断。修 `07377a4`,回归 `storage-migration-v5.test.ts`。
  - **B-1(v9,评审定 B、按数据/启动阻断同 A 级处理)**:老库/演示库 pre-W4 generic S3 行(risk='S3' 无判别六列)撞新 CHECK;迁移前剔除(与合同一致)。修 `07377a4`。
  - S3 链本体(守卫/验签/五步事务/单产单消/执行段树对账)评审逐条通过,与 09 §3.3 一致。
- **B/C 登记(择要;不阻塞收口)**:
  - **B-2**:executeMergeSegment 的冻结 verify 重跑用 execFileSync 同步阻塞事件循环(verify 分钟级时冻结 WS/TTS);现经 setImmediate 脱离 HTTP 响应路径,完整非阻塞需 worker/异步——登记后续独立批(避免仓促 async 重构 ripple 测试)。
  - **C-1**:writing barrier ② 的 sectionCoverage 由 executor 从 plan 自造全 drafted(direct 档"逐节覆盖"恒真),机械核验实剩"成稿存在+非空+树内";人评终局(approve 逐条)兜底——登记与 09 §6.1a 强度差(后续按 markdown 标题解析)。
  - **C-2**:insertPackage 保留"insert 即 proposed 时 proposed_at 兜底"第二写点(测试/迁移用);生产 factory 恒 draft 无实害。

## 待回写清单(canonical;设计库会话落盘——R-A 已收口但 Codex 22 追认在途,攒批)

1. **09 §9**:webauthn_credentials/s3_challenges 两表 + approvals 六列双向 CHECK + turn_ref 放宽已落实施仓 DDL(与 canonical 一致,追认)。
2. **09 §9**:decision_packages proposed_at 列 + CHECK + pkg_active_proposed 索引(v11);projects CHECK + writing(v10)——additive 迁移 canonical DDL 补录同口径。
3. **09 §2 注 ④**:expiresAt 唯一写点 = proposed 转移事务(draft 无 expiry;updatePackageExpiry 删)——实现口径回填。
4. **09 §11**:enabled_project_types 缺省仍 ["coding"](翻值待 owner);前置清单七项全绿状态登记。
5. **09 §13**:readinessSkeleton 证据绑定(covered 机械判定)canonical 留白——待 dogfood/R 轮定语义后接线生产 propose 硬门。
6. **09 §10**:turn.text WS 消息(console 编辑后文本轮,typed provenance)additive 扩展——canonical §10 补录。
7. **11 §5.10**:对话输入区三态实现口径(点击 toggle/空格 hold/免手并列 + 采完不直发双呈现)回填。
8. **HANDOFF §4 铁律行**:S3 卡兑现措辞(无 S3MergeReceipt 不进 merging;Hopper 仍人工)已同步实施仓 HANDOFF §4;canonical 侧同句(04 §5.1/09 §6.1)追认。

## 代码提交(SHA 均本会话 git log 真实输出)

`c108c42`(开批指针)/ `af1af36`(3.1 S3 卡)/ `9790c27`(3.2+3.3 writing+golden)/ `e9f900a`(3.7 readinessSkeleton)/
`2c4e26e`(3.8 proposed TTL)/ `2fd81fe`(3.4+3.9 双仓并行+输入区)/ `4fc2c5b`(3.5 writing 全链 e2e)/
`07377a4`(批末 review A-1/B-1 回修)。基线 `eabc5ac`(W5a 收口)。本文件与 HANDOFF 更新随末次 `chore(evidence)`(不自指)。
备注:部分提交夹带 e2e/screenshots 反锯齿抖动,已 checkout 复原不入提交。
