# 21 · 对抗性评审：R-A 合同轮

审查对象：`docs/01–11`（canonical）与 `~/WorkSpace/SayDo`（只读实施参照）。
审查日期：2026-07-27。行号均按本轮实际读取结果记录。

## 一句话结论

R-A 的设计文字已经写出 WebAuthn、空账本、writing 和场次①的目标语义，但当前不能验收为“可实施/已落合同”：S3 收据来源与本机隔离没有机械闭环，空账本仍能从 `ready` 旁路到 `proposeStart`，writing 开值与执行器/DDL 完全脱节，proposed TTL 也没有终态实现。

## 证据边界

- canonical 的正向设计（例如 WebAuthn 的 UV/UP、120 秒窗口、事务原子性）已逐条核对；以下不会把“文字尚未写出”误报成缺失，重点只报未绑定、不可执行或与实施仓冲突的部分。
- SayDo 的 `HANDOFF.md:28,58` 明确 S3 卡与 writing 顺延 W4；本报告把“W4 尚未实现”与“canonical 已把能力开值/写成 P0 合同”分开定级。
- 已按项目评审制度启动两路互补 subagent。独立 `codex exec` 也已尝试，但本机 app-server 返回 `Operation not permitted`，`research/codex-findings/logs/21-ra-codex-review.log` 为 0 字节；没有伪造 Codex 结论。

## A 级（硬伤必修）

### A1 · S3 主链没有实施落点，且通用 screen 收据可冒充 S3

**证据**

- canonical 把 S3 卡写成主路径：`docs/09-data-contracts.md:185,213-215,903-908`；并称新增 DDL v6：`docs/09-data-contracts.md:549-556`。
- 实施仓没有任何 WebAuthn/S3 符号或工具（对 `SayDo/packages e2e docs HANDOFF.md` 执行 `rg -n -i 'webauthn|navigator\.credentials|s3_challenges|webauthn_credentials|issueS3Challenge|verifyS3Assertion|approveMerge'` 无匹配）；动作面仍只有 `request-manual-merge/verify-merge`：`SayDo/packages/daemon/src/api/actions.ts:30-35`。
- 实施 DDL 仍是 v1，审批表还保留旧的 `runtime_effect` 无 `turn_ref` 禁止条件：`SayDo/packages/daemon/src/storage/ddl.ts:18-38`；迁移只到 v5：`SayDo/packages/daemon/src/storage/ddl.ts:196-202`。这与 canonical 允许 screen S3 `turn_ref=NULL`（`docs/09-data-contracts.md:547-548`）直接冲突。
- 现有 fixture/test 只需插入 `risk='S3', decided_via='screen', auth_strength='screen_authenticated'` 就视为合法：`SayDo/packages/daemon/src/api/fixture.ts:78-90`、`SayDo/packages/daemon/test/storage-checks.test.ts:38-46`。没有 WebAuthn challenge/credential provenance。
- 状态转换层只检查“触发者/当前状态”，没有 S3 receipt 谓词：`SayDo/packages/contracts/src/statemachines/task.ts:37-43`、`SayDo/packages/daemon/src/storage/dao/tasks.ts:74-114`。

**为什么是 A**

现在既没有四个 S3 工具，也没有 v6 迁移或 S3 receipt 判别型；任何未来“复用 generic screen receipt”的接线都会把普通屏幕收据当成 WebAuthn 强认证。即使实现 `approveMerge`，现有状态 DAO 也不会机械阻止无 S3 receipt 的 `waiting→merging`。若 W4 feature flag 明确关闭，这首先是“未实施”；在当前 canonical 把 S3 写成主路径的口径下，它是上线前 A 级阻断。

**修法**

1. W4 前把 S3 与 writing 作为真正的 feature flag（默认关闭），UI 不得把人工交接按钮标成“屏幕强认证”。
2. 新增 `S3MergeReceipt` 判别联合（至少 `s3ChallengeId/action/taskId/attempt/packageRevision/evidenceDigest/prospectiveTreeSha/credentialId/assertionDigest`），generic `ApprovalReceipt` 不能满足 `approveMerge`。
3. `approveMerge` 在同一事务内 CAS 校验 `route=tier1`、`review_approved_waiting_merge → merging`、receipt 未消费/未过期、action=merge、任务/attempt/tree 全匹配；Hopper 永远走人工；失败回滚并可重签新挑战。
4. 加 v6/存量库迁移、旧库 fixture 和“generic screen receipt、无 receipt、receipt 跨 task、并发双消费”反例。

### A2 · “仅本机”与挑战目标绑定不是机械事实

**证据**

- 合同只在 prose 中要求 `rpId/origin` 与本机绑定：`docs/09-data-contracts.md:195,213,215`；但 `registerWebauthn` 仍由调用方传 `rpId`，`issueS3Challenge` 仍由调用方传 `refDigest` 且 `taskId` 可省略：`docs/09-data-contracts.md:904-907`。
- `S3Challenge` 的 `taskId/projectId` 可选、`refDigest` 一个字段同时被描述为 review evidence digest 与 prospective tree 对账依据：`docs/09-data-contracts.md:200-207,213-215`；`ApprovalReceipt` 没有 challenge/credential/tree 来源字段：`docs/09-data-contracts.md:138-154`。`Digest` 又明确是 `sha256:<hex>`，而 `treeSha` 是 Git tree SHA：`docs/09-data-contracts.md:13-15,29-40`。
- 实施 `via` 只由可伪造的 HTTP `Host/Origin` 推导，未检查 socket peer：`SayDo/packages/daemon/src/net/identity.ts:12-20,23-32,61-77`；监听地址可配置为非回环：`SayDo/packages/daemon/src/index.ts:768-777`。审批 API 计算了 `idvVia` 却固定传 `{via:"screen"}`：`SayDo/packages/daemon/src/index.ts:192,213-229`。

**风险**

持有 capability token 的远端客户端可连非回环地址并自报 `Host: localhost`；缺失 `Origin` 也被当作 CLI 合法。注册/签发若只信调用方的 `rpId/refDigest`，会出现首个凭据抢注册、跨任务/跨 attempt 重放，或实现者为解决 `treeSha`/`Digest` 类型不等而跳过树绑定。`platform` 也不等于 device-bound：同步 passkey/BE-BS 与“本机”红线的关系没有定论。

**修法**

- rpId/origin 由 daemon 固定派生（建议专用 loopback/Unix socket、精确 `localhost` origin），S3 endpoint 拒绝无 Origin 的 CLI 请求；不要接受请求方 rpId。
- 注册挑战绑定一次性本机 bootstrap、当前 console session 和 owner intent；`register` 不得产生 runtime S3 receipt。
- merge 挑战只接受库内 `review_approved_waiting_merge` 的当前 task/attempt/package/tree/evidence，服务端派生 digest；明确 synced passkey/BE-BS 策略。
- 所有 S3 API 共享一个 `assertS3LocalAndBound()` 守卫，不能复用通用 `/api/approvals/:id/decide`。

### A3 · 空账本 fail-closed 仍可直接绕过

**证据**

- canonical 已明确：类型清单机械生成 skeleton，零/缺失/全 unknown 恒 `gap_critical`：`docs/04-key-mechanisms.md:65-69`、`docs/09-data-contracts.md:951`。
- 实施生产 dims 恒空：`SayDo/packages/daemon/src/index.ts:688-703`；空 dims 被标成 `not_armed`：`SayDo/packages/daemon/src/brain/liveTools.ts:90-94`。
- 有草稿但未 armed/未深评时，`assessReadiness` 直接返回 `ready,dims:[]`：`SayDo/packages/daemon/src/brain/liveTools.ts:711-724`；`proposeStart` 只拒绝 deep 非 ready 或 throttled，`not_armed/null` 继续组包：`SayDo/packages/daemon/src/brain/liveTools.ts:285-299`。规则层本身对 `assessRules([])` 也返回 ready：`SayDo/packages/daemon/src/evaluator/readiness.ts:37-47`。
- 组包固定 `assumptions:[]`，`assertProposable` 只扫描 assumptions，空数组天然通过：`SayDo/packages/daemon/src/brain/liveTools.ts:322-337`、`SayDo/packages/daemon/src/packages/factory.ts:50-56`。

**为什么是 A**

这正是 W1 实测的“零采访空账本判就绪”漏洞，R-A 的补丁没有改变生产路径。评估器不可用、类型未注册或 provider 未装配时反而更容易落入 `ready`；若先把有效启用集收窄并明确拒绝，这项才可降为未实施的 B。

**修法**

把 `readinessSkeleton(type, projectEvidence, lane)` 做成 contracts 单源纯函数，在会话建立、`assessReadiness` 和 `proposeStart` 三处复用；skeleton 缺失/全 unknown/空 dims/provider 不可用都返回并持久化 `gap_critical`，且把 assessment id/digest 绑定进 DecisionPackage。Quick 只能复用已验证项目事实、减少访谈，不能绕过 critical skeleton。

### A4 · canonical effective enablement 已写开值，但项目、产物和执行器仍拒绝/走 coding 语义

**证据**

- canonical 把 writing 写成已落合同并加入启用集：`docs/09-data-contracts.md:380-402,789`、`docs/02-product-definition.md:88`、`docs/05-roadmap.md:101`。
- 实施 project enum/DDL 不含 writing：`SayDo/packages/contracts/src/types/project.ts:7`、`SayDo/packages/daemon/src/storage/ddl.ts:6-11`；转正类型也由该 enum 推导：`SayDo/packages/daemon/src/projects/lifecycle.ts:33-49`。
- `params` 不接受数组，且没有 `enabled_project_types` 默认值：`SayDo/packages/daemon/src/config/types.ts:81-100`；所以 canonical 示例数组本身无法装载。
- `article` 不在 artifact enum：`SayDo/packages/contracts/src/types/artifact.ts:8-16`；任务 proof 只有 `Tier1SettleProof`：`SayDo/packages/contracts/src/types/task.ts:75-85`。执行器固定要求至少一个 verify，空 verify 直接 `no_verify_registered`：`SayDo/packages/daemon/src/tier1/executor.ts:807-810`，并只产 Tier1 proof：`SayDo/packages/daemon/src/tier1/executor.ts:846-871`。
- HANDOFF 明确该域仍顺延 W4，OctoBlog 未就绪前不派单：`SayDo/HANDOFF.md:28,36`。

**修法**

二选一且必须在同一批完成：
(a) W4 前从 effective enabled 集移除 writing，文档标“合同已设计、能力未启用”；或
(b) 同批补 zod/DDL/旧库迁移、全局类型门、`article` artifact、WritingSettleProof、按 type 的 executor/verify/pause/resume 和正反例，再打开 writing。

### A5 · WritingSettleProof 不是 settle barrier

**证据**

- canonical proof 允许 `sectionCoverage` 出现 `empty`，`acceptanceChecks` 没有最小/全量/全 pass 约束，verify 还可为空：`docs/09-data-contracts.md:384-399`。
- `outlineSectionId` 没有稳定来源；DecisionPackage plan 只有 `seq/step/owner`：`docs/09-data-contracts.md:81-100`、`SayDo/packages/contracts/src/types/package.ts:46-48`。
- 实施 executor 不读取 `project.type` 或 outline，settle 一律进入 `ready_for_review`：`SayDo/packages/daemon/src/tier1/executor.ts:458-483,692-715,846-871`；TaskDetail 只要 settled 就把全部 acceptance 标 `pass`：`SayDo/packages/console/src/pages/TaskDetail.tsx:67-91`。

**风险**

空文章、缺节或全 `unknown` 的 proof 可以被误投影成 `content_done/ready_for_review`；反过来，writing 默认没有测试 verify 时又会被当前 executor 直接阻塞。两条路径都不是“内容评审 gate”。

**修法**

定义类型化 `writingSettleBarrier`：article artifact 存在且 digest/tree 对账；outline section 做 exact-set（无漏节、重复节）；direct 模式要求全稿，step_confirm 只允许当前节后停靠；每条 writing critical acceptance 必须有人工 review receipt/criteria digest（或明确 pending 不得 settle）。`reviewTask(approve)` 与 proof 在同一事务对账，补空稿、漏节、unknown/fail、崩溃恢复反例。

### A6 · proposed TTL/supersede 只写在文档，旧包仍可继续派发

**证据**

- canonical 要求 proposed 24h 到期为 `expired`、同项目新提议 supersede 旧 proposed，且 expiresAt 派生不可写：`docs/09-data-contracts.md:39,97-109,784`。
- 实施状态转换仍禁止 `proposed→expired`：`SayDo/packages/contracts/src/types/package.ts:66-73`；现有测试也明确断言该转换抛错：`SayDo/packages/daemon/test/storage-roundtrip.test.ts:100-103`。
- 只读复跑该测试的原始输出为 `Test Files 1 passed (1); Tests 7 passed (7)`；“全绿”只是把旧的非法转换断言跑通，不能证明 R-A TTL 已实现。
- scheduler 只扫 approvals，不扫 proposed packages：`SayDo/packages/daemon/src/live/scheduler.ts:133-159`；`proposeStart` 只插入新 proposed，不关闭旧 proposed：`SayDo/packages/daemon/src/brain/liveTools.ts:322-338`。
- factory 在 draft assemble 时直接 `now+7d` 写 expiresAt：`SayDo/packages/daemon/src/packages/factory.ts:149-156`；DAO 暴露任意 `updatePackageExpiry`：`SayDo/packages/daemon/src/storage/dao/packages.ts:41-46`。`issueDispatchReceipt`/dispatch 只检查 receipt 时效或 proposed 状态，未把 package expiresAt 作为第二道闸：`SayDo/packages/daemon/src/brain/liveTools.ts:188-207,430-465`。

**修法**

增加不可变 `proposedAt`/状态进入事件（draft 的 expiresAt 语义也要明确），propose 事务内 CAS 关闭旧 proposed 并建唯一 active 索引；scheduler/DAO 实现 proposed→expired/superseded，dispatch/approve 同时复验 package 与 receipt TTL；禁止裸改 expiresAt。`expiresAt` 排除 digest 本身没有问题，但前提是上述派生值真正不可写且不会因配置变更漂移。

## B 级

### B1 · WebAuthn 细节与 schema/DDL/测试仍不闭合

- 注册接口没有 `challengeId`，却声称先发 `action=register` challenge；`refDigest` 对注册没有对象语义：`docs/09-data-contracts.md:200-211,904`。
- DDL 没有 `challenge UNIQUE/CAS`、`action=merge ⇒ task_id/project_id NOT NULL`、credential active/revoked/rotation 或 receipt 外键：`docs/09-data-contracts.md:550-556`。
- `cred_`/`s3c_` 与全局 Id 约定不一致：`docs/09-data-contracts.md:13,189,201`；实施 `idSchema` 只接受三字母前缀且无这两个实体：`SayDo/packages/contracts/src/ids.ts:7-33`。
- `S3Challenge.action` 一次列出 `publish/deploy/delete_data/external_send/force_push`，但没有这些动作的 target schema、执行链或测试；`approveMerge` 也没有强制 `action=merge`：`docs/09-data-contracts.md:203-207,905-907`。R-A 应先收窄到 `register|merge`，其余另立判别合同。
- `authStrength="os_biometric"` 把 WebAuthn UV 等同于生物识别，但 UV 可能是设备 PIN/同步 passkey；应新增 `webauthn_uv` 或收窄文案，并列 BE/BS、clientData type/origin、RP ID hash、credentialId mismatch 反例。
- §12 只有七个 S3 基础反例：`docs/09-data-contracts.md:219`；缺注册抢占、并发双验、receipt 过期/消费竞态、跨 attempt/tree、来源 spoof、v6 migration 和 crash recovery。

### B2 · writing proof、content_done 和内容评审的联合契约缺失

- `tier1_runs.settle_proof_json` 只是无判别 JSON，DDL 只定义通用列：`docs/09-data-contracts.md:633-639`；没有 WritingSettleProof DDL/validator/round-trip。
- 实施没有 `content_done`、`explainResult` 工具或摘要分支：`SayDo/packages/contracts/src/types/tools.ts:51-55`、`SayDo/packages/daemon/src/summary/summarizer.ts:9,38-55`；`liveTools.ts` 也未注册该工具。
- canonical 要求 writing verify 是内容型只读白名单：`docs/09-data-contracts.md:385`；实施 project config 仍允许通用 `package_script/justfile`：`SayDo/packages/daemon/src/tier1/projectConfig.ts:16-31`。
- `AcceptanceCheck.source="manual"` 没有 reviewer/turn/criteria digest 绑定，不能证明是人评而非 agent 自填：`docs/09-data-contracts.md:933`、`SayDo/packages/contracts/src/types/tools.ts:42-49`。

### B3 · readiness 与 Brain instructions 仍双源

canonical 说 skeleton 与 Brain instructions 同源，且 writing 清单有六项：`docs/09-data-contracts.md:951`、`docs/02-product-definition.md:74-80`；实施 instructions 只有通用目标/验收/边界文字：`SayDo/packages/daemon/src/brain/instructions.ts:4-18`，没有 type registry 或可执行版本。应由一个 registry 生成 skeleton、prompt、package acceptance，并做 digest/版本一致性测试。

### B4 · fallback 和 tailnet S2 的来源语义不够强

- 现行人工路径本身不是自动 merge：`SayDo/packages/daemon/src/tier1/operations.ts:345-385` 仍要求 `approved_tree_sha + MergeProof`；但 `verify-merge` 不要求先存在一次性的 manual handoff intent：`SayDo/packages/daemon/src/api/actions.ts:103-130`，UI 直接把按钮标为“合并(去屏幕强认证)”并调用 `requestManualMerge`：`SayDo/packages/console/src/pages/TaskDetail.tsx:200-232`。应增加 owner 明确选择、reason、task/attempt 一次性 handoff token；否则“降级”会成为永久默认弱路径。
- canonical 已把 tailnet S2 定为 `push + paired_device_pin`：`docs/09-data-contracts.md:161-166`；W2 实现仍把屏幕决策记成 `screen/screen_authenticated`，且 API 忽略 `idvVia`：`SayDo/packages/daemon/src/index.ts:192,213-229`。这暂不等同于 S3 放行，但会让来源面无法由收据证明。

### B5 · 场次①“硬规则”在实施中仍是 prompt/golden，而非运行时闸

canonical 要求结果类句式只能由 callback 驱动：`docs/10-voice-ux-spec.md:110-121`。实施 `dialogLoop` 对模型文本只做分句和 redact 后直发：`SayDo/packages/daemon/src/brain/dialogLoop.ts:48-85`；摘要器仍没有 `content_done`：`SayDo/packages/daemon/src/summary/summarizer.ts:9-55`。golden 不能替代生产 gate。应由 callback summary 生成/校验结果话术，普通对话命中结果句式时拒绝或改写，并加 writing 回叫测试。

### B6 · 配置门与契约测试会漂移

- canonical 把 `enabled_project_types` 写成全局参数且项目层不可覆盖：`docs/09-data-contracts.md:706-707,789`；实施 `PARAMS_GLOBAL_ONLY` 只有 `backup_retention_days`，项目 `[params]` 接受任意键：`SayDo/packages/daemon/src/config/load.ts:21-42`、`SayDo/packages/daemon/src/config/project.ts:48,90-94`。接入后恶意仓可改类型开关；`proposed_ttl_hours` 接入时也必须评估为全局专属。
- §12 类型门禁仍把已启用的 writing 当“未启用反例”：`docs/09-data-contracts.md:789,866`；应改为 research 等未启用类型，并增加 writing 正例。
- `docs/09-data-contracts.md:402` 说“DDL 无需再迁”，同文件 `:517-519` 又要求旧库表重建；`docs/05-roadmap.md:99` 仍说 S3 合同未落，`:118` 仍把 writing proof/content_done 列为接入前待补。这些旧文案会让实施者按两套分期执行。

## C 级

- 场次①输入区/录音交互是清晰的设计合同，但实施尚未同步：`docs/10-voice-ux-spec.md:108`、`docs/11-ui-spec.md:209-216` 要 toggle、空格 hold、波形/计时/取消、待确认语音+可编辑转写；SayDo 仍是 PTT/免手按钮，松手立即发 `turn.done_speaking`，`asr.final` 直接进 Brain：`SayDo/packages/console/src/pages/Chat.tsx:78-157`、`SayDo/packages/console/src/voice/useVoiceChannel.ts:287-310`、`SayDo/packages/daemon/src/index.ts:731-739`。HANDOFF/evidence 已把它作为待实施项，不应在当前版本宣称已落。
- `readinessSkeleton` 示例有非法的 `stateःunknown` 字符：`docs/09-data-contracts.md:951`；改为合法的 `{ critical: true, state: "unknown" }`，并补可执行 schema。
- 模块导航仍把摘要联合写成 coding-only：`docs/modules/c-control-bridge.md:56-63`；writing 窄版与全量 R-C 的边界也应在 `docs/modules/b-memory.md` 等导航中明确。

## 免修确认清单

以下是本轮核对后不判为 canonical 设计硬伤的项目；实现缺口仍按上面分级记录：

1. WebAuthn 设计文字确实写了 `UP=1 ∧ UV=1`、120 秒过期、signCount=0 的 Apple 平台分支、同一事务消费 challenge+签 receipt：`docs/09-data-contracts.md:193,206,211-213`。问题在绑定、DDL、来源和实施，不是“完全没写安全意图”。
2. S3 语音红线与远程封顶未被本轮设计撤销：`docs/04-key-mechanisms.md:139-153`、`docs/10-voice-ux-spec.md:114-121`；HANDOFF 也保留“无 S3 卡前只人工交接、禁止自动 `hopper merge`”：`SayDo/HANDOFF.md:56-58`。
3. 当前 writing 与 `04 §6` 没有现行文字冲突：`docs/04-key-mechanisms.md:195` 明确 writing 是 worktree+merging 例外，`docs/02-product-definition.md:88` 与 `docs/09-data-contracts.md:401` 同口径。需修的是实施/分期，不是再改回“非 coding 一律无 merging”。
4. `expiresAt` 排除 DecisionPackage digest 的原则本身自洽：`docs/09-data-contracts.md:29,39`；真正的问题是 proposed/draft 的派生锚点、可写列和调度器没有实现。
5. writing 的对外发表/投稿仍被单独保留为 S3，不被 worktree 内写稿吞并：`docs/02-product-definition.md:96`、`docs/09-data-contracts.md:401`。
6. `requestManualMerge` 当前不会自动调用 Hopper，也不会凭空改主仓；它只返回 handoff，最终仍做 tree 对账：`SayDo/packages/daemon/src/tier1/operations.ts:345-385`。因此 literal 的“无 receipt 不进 `merging`”边界尚未被现有人工路径直接改写；但一次性 fallback intent 和 UI 语义仍必须按 B4 修。

## 审查结论

在 A1–A6 未关闭前，本轮应判 `R-A contract = not ready_for_review`，不能以“canonical 已回写”替代“实施可验收”。最小收口顺序是：先关闭 S3 来源/状态原子闸与空账本闸，再决定 writing 是保持 W4 disabled 还是完成全套类型化 proof，最后补 TTL、§12 反例和分期导航。
