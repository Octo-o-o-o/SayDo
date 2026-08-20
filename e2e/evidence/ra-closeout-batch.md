# RA-closeout 批(R-A 收口小批)—— 验收证据(2026-07-28)

> 范围 = Codex 22 终局追认 triage(报告 `research/codex-findings/22-ra-verification-completion.md`)的实施侧清偿:
> pending 生命周期 owner 裁决 (a) 案落地 + A2 残余 + 六实施小项。owner 授权"都按建议实施",设计库会话执行。
> 三级词表:[ok] 可复跑证据 / [warn] 差距如实 / [fail] 未做。SHA 均本会话 git log 真实输出。
> 开批基线 `edac8d0`(W4 + readback 回修收口);收口 HEAD `a737ed9`。

## 1. pending 生命周期(owner 裁决 (a) 案 2026-07-28;Codex 22 新 A 关闭;代码 `3962a72`)

- [ok] **typeGate 分 phase**:`assertProjectTypeEnabled(db, projectId, enabled, "propose"|"dispatch")`——pending propose 放行(首包 = 供 owner 过目的提案)、dispatch 拒(`project_pending_promotion`,话术引导先定型)。
- [ok] **三个派发入口全闸**:proposeStart(propose 相)/ issueDispatchReceipt 工具层(新增 pending 闸)/ dispatchApprovedPackage(dispatch 相)。
- [ok] **executor settle 白名单分叉**:coding/writing 之外(pending/读不到/无执行合同类型)⇒ fail-closed blocked(`project_type_unexecutable:<type>`),不按 coding 兜底——原 `?? "coding"` 兜底删除。
- [ok] **promoteProject 生产接线(批末 review A-2 回修,`a737ed9`)**:注册 Brain 工具(09 §13 签名:projectId/title/type 词表限六值)——转正链此前生产零调用点,"首包可出永不可拍"死锁消除;首包后转正流程 = pending 出首包 → owner 说开始 → promoteProject → 重新拍板。
- [ok] **反例**:pending propose 放行 + 拍板拒(`project_pending_promotion`)+ promote 后同包可拍(经真实工具链)/ executor pending settle blocked / typeGate 双 phase 四断言(writing-narrow + readiness-skeleton)。

## 2. A2 残余:挑战目标绑定固化 + register intent(Codex 22 §7.1-1;代码 `3962a72`)

- [ok] **v12 迁移**:s3_challenges 加 attempt/package_revision/bootstrap_intent_id 三列;CHECK 收紧(merge ⇒ attempt+package_revision 必填;register ⇒ task/project/tree 全空 ∧ session 或 intent 至少其一)。老库表重建:老 merge 行经 approvals(s3_challenge_id UNIQUE)**JOIN 回填真实值不造数**;无收据引用的孤儿 merge 行删除(120s 短命凭证,删除计数落 audit_log——review B-2);老 register 行 grandfather 兜底 `s3i_000...0`(idSchema 合法,回读不炸——review B-1)。
- [ok] **签发固化**:issueS3Challenge(merge)签发时点固化 attempt=当前 run/package_revision=任务包版;verifyS3Assertion 交叉断言(attempt_drift/revision_drift——签发后换代/换版即废,与 tree/evidence 断言同签发-验证同源读法)。
- [ok] **register 强制可审计 intent**:console 会话优先绑 sessionId;无会话上下文 daemon 生成一次性 `s3i_` intent + `s3.bootstrap_intent` 审计行(§9 CHECK 双重承载)。
- [ok] **schema 同源投影(review B-1)**:s3ChallengeSchema superRefine 同步 v12 双 CHECK。
- [ok] **反例 6 例**(s3-merge-chain "RA-closeout · A2 残余" describe):attempt_drift / revision_drift / 固化值行可查 / register 无会话 ⇒ intent 生成+审计 / register 带 project DDL 拒 / consumedAt 复验。

## 3. 六实施小项(代码 `3962a72` + `a737ed9`)

- [ok] **consumedAt 复验(Codex 22 A1-B)**:approveMerge 判别段拒"未消费挑战配已签收据"(provenance 异常;留痕 = 外层 `s3.approve_merge_rejected` 事务外审计,不随回滚丢失)。
- [ok] **proposed_ttl_hours 全局键(Codex 21 B6 尾项)**:入 PARAMS_GLOBAL_ONLY,项目层覆盖剥离(恶意仓不可操纵拍板窗口)。
- [ok] **tailnet 配对屏幕批对表(09 §3 push 行)**:decide via=tailnet ⇒ 收据行如实落 `push/paired_device_pin`(此前固定 screen 属实施未对齐);edit 面 tailnet 403 引导回桌面;用例断言行值+消费。
- [ok] **readinessGate 况④(Codex 22 §5.1 回补)**:evidenceProvider throw ⇒ 持久化 gap_critical 落行(fail-closed 不外抛)+ 用例。
- [ok] **dialog 装配接线锚(w4-readback code-review B-1)**:armed 下两次 onAsrFinal 装配恰一次(created 守卫)+ assemble throw 不断对话链 + 用例。
- [ok] **迁移框架 FK 合规(批末 review A-1/B-4,升级即砖修复)**:migrate() 框架化 SQLite 官方十二步——连接级 `foreign_keys=OFF`(事务外)+ 每迁移事务内 `PRAGMA foreign_key_check` 全库校验(违规 throw ⇒ 事务回滚库不坏,完整性不降级)+ finally 恢复 ON;v10/v12 撤自设 defer(deferred FK = 违规计数器、RENAME 不复原的错误理解勘误);**带数据老库回归两例**(review B-3):v10 路径(sessions/tasks 引用行存活)/ v12 路径(JOIN 回填 attempt=3/revision=3 真实值 + 孤儿删除审计 dropped=1 + grandfather 值)。

## 批末评审(轻量制度;A 级必修,前台 code-review subagent)

- **首轮结论:A 级 2 条,已全修(`a737ed9`)并经带数据实验用例锚定**:
  - **A-1**:v12 DROP+RENAME 被 FK 引用的父表,deferred FK 违规计数在 COMMIT 必炸——任何做过真实 S3 合并的老库升级即砖(评审用真实 openDb 实验证实;v10 同病 = B-4 既有缺陷)。修 = migrate() 框架 FK 合规(上节)。
  - **A-2**:(a) 案只落"拒"半边,promoteProject 生产零调用点 ⇒ 新用户全链死锁。修 = Brain 工具注册 + 全链用例改走真实工具。
- **B 级 4 条全修**:B-1 schema 同步+grandfather 合法值 / B-2 孤儿删除审计 / B-3 带数据回归用例 / B-4 v10 同框架修复。
- **C 级登记(不阻塞)**:C-1 register intent 审计在 insert 前事务外(过录方向可接受);C-2 tailnet 改写 decided_via 与"voice 张被 screen 点保持签发通道"口径不一致 + UPDATE 与 applyReceiptEvent 非同事务(建议 09 §14-A2 presentation 拆分时统一);C-5 v12 老 register 行 project_id 静默置 NULL(生产写路径无此组合)。
- **首轮 review 顺带确认**:JOIN 回填 UNIQUE 前提/派发入口无遗漏/固化断言同源/consumedAt 顺序/tailnet CHECK 兼容/红线全过(零 emoji/契约单源/S3 语音零触碰/Hopper 恒人工)。

## 测试与门禁(本会话真实输出)

- `just ci` 收口终值:**contracts 73 + daemon 654 passed | 4 skipped + python 20**,`CI_EXIT=0`(退出码显式核查;emoji gate [ok])。
- `pnpm exec playwright test`:**21 passed**。
- 过程如实:中途一轮全量 ci 出现 3 例并发抖动失败(tier1-executor 成功全链/story-e2e 合并对账/writing lint 红——单跑 47/47 全绿,复跑全量恢复全绿;既有 flaky 面,与本批改动域无涉,登记不掩盖)。
- 新增测试:pending 三例 + A2 六例 + tailnet 一例 + provider throw 一例 + dialog 接线锚一例 + 带数据老库迁移两例;fixture/storage-checks/live-wiring 按 v12 形状与新产品流程改造(live-wiring 预建定型项目 = 全链剧本聚焦派单链;pending 拍板拒有专项用例,不掩盖)。

## 待回写清单(canonical;设计库会话本批随批落盘)

1. 09 §13 类型门禁注:pending 裁决 (a) 案(已随批落)+ promoteProject 转正流程句。
2. 09 §3.3/S3Challenge schema + §9 DDL:attempt/packageRevision/bootstrapIntentId 三字段与 v12 CHECK 同步。
3. 09 §12-13 反例集:A2 残余六例 + consumedAt 复验收编。
4. 09 §11 T2 注/§3 对表:tailnet 收据对齐"已实施"状态注。
5. 09 §9 迁移纪律注:migrate() FK 合规框架(父表重建十二步)一句。

## 代码提交(SHA 均本会话 git log 真实输出)

`c108c42`(开批指针,随 W4 批注)→ 本批:`3962a72`(feat:pending gate + A2 + 六小项)/ `a737ed9`(fix:review A-1/A-2 回修)。基线 `edac8d0`。本文件与 HANDOFF 更新随末次 `chore(evidence)`(不自指)。
