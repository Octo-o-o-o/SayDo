# VoiceLoop P0 实施计划 v2.0 + 契约回修评审（Codex 08）

> 评审日期：2026-07-23
> 评审对象：`IMPLEMENTATION-PLAN.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/adr/ADR-001-execution-layer.md`；对照 `docs/05-roadmap.md`、`docs/08-module-design.md`、Codex 06/07、Hopper 当前代码。
> 严格状态口径：只有原 A 级的全部关闭条件都已进入 canonical schema/validator/正反例测试，才记“关闭”；只修语法或补待办文字不算关闭。

## 0. 评审快照与方法

- 【事实】本报告以本轮最终读取到的磁盘快照为准：
  - `IMPLEMENTATION-PLAN.md`：`80ef21325c44daff18e98aa5f165886b7cc09e4bbd6e8f50abd8f7774a9fe225`
  - `docs/09-data-contracts.md`：`cd10e468005571b2fead6247f6f828f3caab1e195f61d55875de32cc1374e0e9`
  - `docs/10-voice-ux-spec.md`：`0f2f26a6b3df32683b2b2bcc3afdc2085e58adfcabe4445a4ffa8f976130f502`
- 【事实】两路独立只读评审分别覆盖“范围/Gate 0/依赖/估时”和“契约/回归/Hopper”；两者均判定当前版本不能原样交新会话实施。本报告再以主评审的 SQLite/TOML/FTS 与 Hopper 只读复核交叉校验。
- 【事实】本轮没有修改被评审文件；交付物为本报告。按仓库强制评审流程，后台 Codex 的 prompt 与原始日志另存于 `research/codex-findings/prompts/08-plan-review.md`、`research/codex-findings/logs/08.log`。

## 1. 总评

### 1.1 结论

【judgement】**No-Go：当前 P0 尚未达到“可把实施 prompt 交给新会话直接执行”的标准。** “P0 只做 Tier 1、Hopper/直达验收移到 P0.5”是正确收敛方向，也确实避开了 Hopper 专属的 review first-wins、真实状态映射和跨域 cancel/redrop 大部分风险；但 P0 自身仍依赖三个被列入 §14/P0.5 的合同：

1. Tier 1 每次 S2 语音确认所需的 presentation、nonce、barge-in void 和原子消费（07-A2/A8）；
2. Gate 0 G6 所需的可恢复 hard-forget（07-A6）；
3. Tier 1 的本地 invocation/recovery、settle/cancel proof 与 callback 幂等；现文档只有 Hopper 形态或自由字符串。

【judgement】因此，当前所谓 `docs/09` 的 `[P0-Tier1 就绪]` 子集**不自足，也未闭合**。问题不是“还要多写一些实现细节”，而是实施者必须自行发明授权对象、持久化状态、恢复判据和 Gate 0 证据；这会直接重建 Codex 07 判定的错误链。

### 1.2 本轮真正进步

- 【事实】Gate 0 已有分散落点、`Gate 0 未关 ⇒ 拒 dispatch` 铁律和 5.3 证据复核（计划 25–40、111），结构上消除了 v1 “最后补门禁”的主要时序倒挂。
- 【事实】Claude SDK 的三能力冒烟已从旧 4.0 前移到 Phase 0 的 0.0（计划 50），失败时明确上浮 owner；这是 Tier 1 生死前提的正确位置。4.0 保留真实 worktree 全链复验（计划 96）也合理。
- 【事实】最新计划已补入 E1 provider 抽象、C8 记账接线和 B4 产物库写入（计划 65、87），不再完全遗漏这三块。
- 【事实】P0 标题已改为 21–27 日理想关键路径（计划 44），与各 Phase 在 P1/P2 完全重叠假设下的算术一致；但文末仍残留 15–18 日（计划 139）。
- 【事实】SQLite DDL 与两段 TOML 的**纯语法**问题已关闭，详见下一节。

### 1.3 P0.5 前置清单完整性

- 【事实】`docs/09 §14` 已逐行列出 07 的 A2/A3/A4/A6/A7/A8（09:522–527），A4 中的 Hopper TaskStatus 枚举与当前代码一致。
- 【judgement】但清单仍**不完备**：07-A1（全 digest/ID DAG）、A5（DDL/TS/migration 语义）和 A9（MUST 溯源矩阵）没有进入 §14，也没有在别处真正关闭；A4 还漏 cursor 的 vault/generation/file identity 与截断/替换判别。
- 【judgement】分层也不诚实：A2/A8 的 Hopper review 部分可留 P0.5，但 Tier 1 S2 presentation 子集必须回到 P0；A6 是 P0 Gate 0 G6 的直接前提，也不能整体留 P0.5。反过来，P0 的 0.3 又把 A3 的 `DispatchBinding/hopper_commands` 偷带回来。
- 【judgement】P0.5-B 要做 `approve→merge`，却没有把 VoiceLoop 侧 S3 已认证屏幕流程列为前置或实施步；若坚持 P0/P0.5 都不做该屏幕面，就应把 P0.5 的终点明确停在 review/manual handoff，不能宣称桥内闭环 merge。

## 2. 可复现核验

### 2.1 SQLite / TOML

- 【事实】把 09:337–377 原样交给本机 `sqlite3 3.54.0` 执行成功；`PRAGMA integrity_check` 输出 `ok`，生成 16 个显式业务表、1 个显式索引。
- 【事实】用 Python 3.12 `tomllib` 解析 09:405–440 与 444–455 成功，顶层键分别为：

```text
config.toml: models,voice,privacy,budget,dnd,hopper,gate0,params
project.toml: project,git,verify,setup
```

- 【事实】同一 DDL 仍接受以下无效数据，并接受 `projects/sessions/tasks` 的 `INSERT DEFAULT VALUES`：

```text
bad_runtime|runtime_effect|S2|voice|voice_weak||||consumed
bad_voice|dispatch_package|S2|voice|os_biometric||||pending
default_rows=1,1,1
```

- 【事实】09:192 的“删除用 `delete` 命令”有歧义。若解释为 FTS5 特殊 delete control，实测 `INSERT INTO memory_fts(memory_fts,...) VALUES('delete',...)` 返回 `SQL logic error`（exit 1），行仍存在；标准 `DELETE FROM memory_fts WHERE rowid=?` 成功（exit 0）。这不影响 DDL 解析，但实现合同应写出后一条精确 SQL，不能只写 `delete`。
- 【judgement】结论只能写成“SQLite/TOML 语法可执行”，不能写成“DDL/config 契约可照抄”。09:145 承诺合法矩阵进入 DDL CHECK，实际 09:348–349 只有 S3 与 push 两条 CHECK；没有 NOT NULL/FK/schema migration，也没有把 kind/parent/grant、voice/auth、decision/outcome/timestamp 联合约束落盘。

### 2.2 Hopper 真实状态

- 【事实】本轮读取到 Hopper `main@ea3fb31fd04946a66229022782b43daf57bf3fe4`；相对基线 `c4c29c6` 只有 docs/archive 变化，没有生产源码差异。
- 【事实】`Hopper/src/schemas/common.ts:27–42` 的 TaskStatus 为 `received,draft,plan_needed,research,ready,running,review,blocked,failed,rejected,done,archived,deferred,conflict`，与 09:524 的 §14-A4 枚举一致；09 §7 仍使用不存在的 `triage/queued`（09:311）。
- 【事实】取消相关事件当前投影为 task `failed + cancelled_by_user`（`Hopper/src/core/state/projector.ts:153–168,200–205`），不能单凭该投影宣告 `cancel_settled`；`ReviewApproved` 本身也不推进到 done（同文件 213–215）。
- 【judgement】**只有 A4 的 Hopper total mapping、外部 cancel/run-bound settle 半边**留到裁决后的 P0.5 是诚实的；Tier 1 settle/outbox 与 cursor identity 仍被 P0 使用却未定义。把旧 §6.2/§7/§12-7 实现要求留在 P0 也不成立。

### 2.3 估时算术

- 【事实】六个 Phase 的标称投入相加为 `24–31 人日`：`3–4 + 5–7 + 3–4 + 4–5 + 5–6 + 4–5`。
- 【事实】若 Phase 2 完全与 Phase 1 重叠，理想关键路径为 `21–27 日`；这与计划标题 44 一致，但与变更摘要“约两周”（计划 3）及依赖图下“15–18 工程日”（计划 139）冲突。
- 【judgement】21–27 日只能当**合同已闭合、spike 一次成功、P1/P2 充分并行**时的理想下限，不包含本报告 A 级回修、owner 场次与评审制度开销。

---

## 3. A 级问题（发实施 prompt 前必须关闭）

### A-01 Tier 1 的 S2 授权仍依赖被整体推迟的 A2/A8

**位置**：计划 88、90、98；09:32、123–167、522、527；10:52、77、83。

- 【事实】P0 明确要求逐步确认档“每个 S2 语音确认”，4.2 又要求“打断后裸‘好’不消费”；但 09 的 `ApprovalReceipt` 没有 presentation id/digest/version、heard/invalidated 状态或 subject CAS，TranscriptTurn/WS 也没有 presentation/nonce/invalidated 事件。
- 【事实】E2 文案来源这一个子项已修：10:52 把 #19 的动作指向 effect 渲染，10:107–109 又要求所有 S2/预授权 `spokenForm` 走 `renderSpoken`。但 09:32 仍把 presentation 整体标 P0.5，#39 也标 P0.5；09 还没有 `RuntimeEffectIntent` schema，无法定义 `runtime_effect.refDigest` 究竟签什么。
- 【judgement】计划 4.2 的“最小版”没有可实现的数据合同；Tier 1 仍会出现“用户只听到前半句、系统却消费旧 pending”的错误授权。A2/A8 不是直达验收或 Hopper 专属问题。
- **改法**：把 A2/A8 拆层。P0 先定义本地 `RuntimeEffectIntent → ApprovalRequest → Presentation → DecisionReceipt → Consume` 判别联合，至少绑定 project/task/effect/target/downstream/expiry、presentation digest、nonce、heard/invalidated、version/CAS；barge-in 与消费反例进入 P0 §12/golden。仅 Hopper review first-wins/reconcile 留 P0.5；保留 #19/#39 也可以，但必须统一为 P0 的同一 render/validator 与 presentation 生命周期，而不是两个分期。

### A-02 hard-forget A6 同时被 P0 使用、被 P0.5 声明未封闭

**位置**：计划 37、76、120；09:172–193、358–361、463、502、525；10:76。

- 【事实】计划 2.1 要求 target ids/digests、generation、deletion job 和崩溃重放；09 §4 只在 prose 中提 target/generation，`MemoryEvent` interface 仍没有这些字段且不是按 op 的判别联合，DDL 也没有 generation、tombstone target 或 deletion progress。
- 【事实】09:192 又说 P0 不需要 job 表，§14-A6 则把 deletion job/phase/progress 留到 P0.5；`forget()` 只返回 `marked|purged`，没有 job/proof/retry identity。FTS 删除只写含混的 `delete`，没有明确标准 SQL；计划 0.1 同时建立备份，却没有备份删除/不可恢复介质的传播规则。
- 【judgement】当前 canonical 不能证明“追加 tombstone 后、覆写前崩溃”一定知道删谁并最终收敛，也不能支撑 10 #38 在 proof 后说“删掉了”。G6 因而不能关闭。
- **改法**：A6 移回 P0 contract-first：把 `MemoryEvent` 拆成 op 判别联合；持久化稳定 target 集、memory generation、deletion job id、每个 active store 的 phase/progress/proof；规定备份的 crypto-erasure/retention 口径；增加每个崩溃相位的幂等重放 fixture。§14 只保留超出 P0 store 集的扩展，不再把 A6 整体列 P0.5。

### A-03 Phase 0 仍偷带 Hopper 的 A3/A4

**位置**：计划 33、40、54、125；09:263–280、354–357、466、523–524。

- 【事实】计划声明 P0 不做 Hopper，却在 0.3 要求 `DispatchBinding(dropOutcome=NULL)` 与 `hopper_commands intent` 重放，G2 也以该实现和 §12-7 作为关闭证据；P0.5-B 又重复实现同一 journal。
- 【事实】当前结构仍缺可重发 payload/ref、结果 envelope、`unknown→reconcile`、per-op retry class、vault/receipt/authoritative state；`hopper.revision` 仍为 string。09 §14 自己承认这些要等 Hopper 裁决。
- 【judgement】这会让 Phase 0 在首周重新撞上本次切分本应绕开的 No-Go，且把“本地先落盘”误写成“外部 exactly-once”。
- **改法**：从 P0 0.3、G2 和 P0 §12-7 中删除 Hopper-specific DAO/测试；P0 改为单独定义 Tier 1 invocation journal、daemon↔pipeline 消息幂等和 callback outbox。`dispatch_bindings/hopper_commands/events_cursor` 的 migration、重放和 §12-6/8 全部移到 P0.5-B。

### A-04 Tier 1 的 run/settle/cancel/review 收尾没有 canonical 合同

**位置**：计划 96–101、103、112；09:218–303、484–495；10:67–73。

- 【事实】09 唯一机械 settle barrier 明标“路径二”（09:303）；`CallbackOutboxEntry.settleProof` 只有 `projectionCursor` 与自由字符串 `artifactChecks`。没有 Tier 1 run/attempt、package revision、native session、worktree tree、verify evidence 的绑定，也没有 Tier 1 `cancel_settled` proof。
- 【事实】§13 的 `TaskView` 只说等于 §7 用户视图，而 §7 是 Hopper 投影表；P0 的步骤边界“一步”如何映射一次 SDK session/run/settle、resume 后如何避免重复执行均未定义。
- 【事实】P0 总验收要求 `ready_for_review→人工合并→task_done`，但 P0 不做 S3 卡，计划没有人工 handoff、合并观察、合并后独立 verify、状态对账的实施 owner/API。05:84 的 P0 终点反而是 `ready_for_review`、合并仍人触发。
- 【judgement】4.3/4.4/4.5 不能只引用 Hopper 语义来实现本地 Claude SDK 闭环；当前会发生过早回叫、旧 run 证据串线或永远到不了 `task_done`。
- **改法**：在 09 新增 Tier 1 判别分支：`Tier1Invocation`、`Tier1Run/Attempt`、`Tier1SettleProof`、`Tier1CancelProof` 与 outbox 绑定；明确 step_confirm 是同一 session 暂停还是多 run 分步。owner 决定 P0 终点：若停 `ready_for_review`，删去 task_done 承诺；若保留 task_done，补“受信终端人工合并 handoff → merge result watcher → 独立 verify → 状态推进”及反例。

### A-05 Gate 0 前移了位置，但六项仍没有可机械关闭的谓词

**位置**：计划 25–40、50–55、65–68、76、88、97–100、111；05:59–70；09:61–67、337–377、431–455。

| Gate | 【事实】当前证据 | 【judgement】 | 必修改法 |
|---|---|---|---|
| G1 身份 | 计划表 38 仍说“非 owner 音频丢弃”，40 又承认 P0 无说话人标签，只测 PTT 窗外/挂起态；05:65 还要求设备配对，TranscriptTurn 只有 `speaker=user|ai`。 | **未关闭**；PTT 生命周期不等于 owner identity。 | 明确 P0 信任根（如 localhost + 已登录 OS session + 已配对控制面）及 principal 传播；无法区分旁人时不得声称“非 owner 过滤”。同步改 05 的最低交付。 |
| G2 幂等 | P0 没有 inbox/local invocation journal；09 §12-7 混合 Hopper 与 Tier 1；计划 40 承认只关“半边”，05:66 却仍要求 bridge outbox/inbox/cursor。 | **未关闭且口径冲突**。 | 列出 P0 每条活跃边界及 idem key/ack/replay/failure semantics；Hopper 半边明确不计入 P0 Gate。 |
| G3 oracle | verify 只引用 `project.toml` 的 package script/justfile；这些文件和脚本可被待验代码改写。 | **落点正确，信任边界未关**；白名单名字不等于可信 argv。 | owner-managed/signed 配置；冻结 argv、脚本内容 digest 与 base revision；待验 worktree 不能改 oracle。 |
| G4 secret/egress | `setup.command` 仍是自由 shell；`pnpm install` 可跑 postinstall/联网。04:149 已明确 P0 接受策略级隔离，05:68 的最低口径是凭据剥离 + egress 如实声明。 | **未关闭**；当前缺的是受信 setup、凭据不可见和“声明与实测能力不符即拒绝”，不是擅自把 OS 级禁网升为 P0。 | 受信 setup template/argv、pre-setup E2、凭据 allowlist、adapter egress capability probe/声明/失配拒绝及恶意 fixture；若要 OS 级网络硬隔离，先由 owner 修改 canonical。 |
| G5 intent | 转写在 JSONL，tasks/approvals 在 SQLite；无 transcript/intent 表或物化索引，`turn_ref` 可空且无 FK/CHECK。 | **无法用计划承诺的“一条 join 查询”证明无断链**。 | 先定义 IntentLedger/turn index schema、强制 voice receipt 的 project/task/session/turn/package linkage；补 orphan/错 digest/崩溃/重放负例。 |
| G6 删除/同意 | config 只有 `store_audio/store_transcript` 当前值；没有分别同意的 receipt、撤回时间线或 collection gate；hard-forget 见 A-02。 | **未关闭**。 | consent 状态机/审计/撤回测试必须在首次持久化音频或转写前完成，hard-forget proof 后才能关 G6。 |

- 【事实】09 新增 `[gate0] enabled=true, bypass=false`，但没有每项 gate 的 owner、evidence ref、validator、build/version 绑定；`enabled=false` 的语义也未定义。
- 【judgement】一个可手改的总布尔状态不是“无 bypass”。每项应是运行时从真实能力与证据推导的 fail-closed predicate，不能由配置直接宣告 closed。
- 【judgement】G3/G4 落在第一次真实执行前、G5 落在 dispatch 前、5.3 只复核证据，这个**时间结构是正确的**；问题是当前关闭证据不足，不能据表宣称 Phase 4 后六项已关。

### A-06 09 的 DDL 只有语法可执行，尚非可复制的 P0 持久化合同

**位置**：09:3–5、145–167、334–378、458–470；计划 52–55。

- 【事实】2.1 已复现：非法 receipt 和全 NULL 核心行可写入；FTS 删除措辞也没有精确到可照抄 SQL。DDL 没有 schema-version/migration 表、FK/NOT NULL、完整 enum/transition CHECK；计划却要求实施者同时完成 schema version、DAO、round-trip。
- 【事实】TS↔DDL 仍漂移：`TaskCard` interface 没有 `createdAt` 而 SQL 有；ContextSnapshot 的 digest 排除 project/session，SQL 却以 digest 单主键挂一个 session；hard-forget 与 presentation 没有存储形态。
- 【judgement】“Zod 写入校验”可以承担一部分语义，但必须在 09 明确 DB 与 validator 的责任分界，并用 migration fixture 证明所有写入口都经过同一 validator；当前“DDL CHECK 已落实”的事实声明不成立。
- **改法**：把 §9 交付为真实 migration v1：必要 NOT NULL/FK/CHECK/索引、schema version、升级/回滚策略；为不能用 CHECK 表达的联合约束列出唯一 Zod validator 与 transaction API；生成 TS↔DB round-trip、非法直写和 migration-upgrade tests。同步收窄 09:4 的“可照抄”表述，直到测试存在。

### A-07 §13 工具面仍不足以让实施者照写

**位置**：09:472–514；计划 67；03/10 的 snake_case tool instructions。

- 【事实】本轮已补 remember/forget/hotword/project/receipt 工具，这是实质进步；但仍有以下断点：
  1. `proposeStart(sessionId)` 没有 `taskDraftId` 入参，和 09:512“由 proposeStart 消费 taskDraftId”矛盾；
  2. Brain 没有读取完整 DecisionPackage 的工具，无法按 10 #10 口播成果、计划、成本、风险；
  3. `assessReadiness` 返回签名没有 prose 新增的 `verdict`；`TaskView`、`Decision` 没有完整 interface；
  4. `approveAction` 不携带 presentation/nonce/version/heard，仍无法实现 A-01；
  5. `forget` 没有 job/proof；`explainResult` 返回自由文本，丢掉 10 §5 的 discriminated union、asOf/evidence；
  6. 没有 P0 人工 review/merge handoff/结果对账工具；错误 envelope 只写在 prose，函数签名仍全是 success-only；
  7. 09 用 camelCase，03/10 instructions 使用 snake_case。
- 【judgement】Phase 1.3b 若“照抄 §13”，仍会在第一条真实对话中自行发明核心 API，且不同模块会形成两套命名和失败语义。
- **改法**：用一份可生成 Zod/TS/tool manifest 的 canonical API；列完整 request/success/error unions、capability/phase guard 与 idempotency；补 `getDecisionPackage`、draft→package 绑定、Tier1 TaskView、presentation-aware approve、forget job/proof、structured summary、manual handoff/reconcile；为每个工具做 Brain-call→daemon-validator→DB transition fixture。

### A-08 P0/P0.5 分期没有同步到计划声明的真相源

**位置**：计划 6、27、90、118–129；05:45–53、72–84；08:36、45–52、145–157；ADR:7–18、77；10:38–43、58–60、89–105；Demo 311–441、615–624。

- 【事实】计划说 P0 只做 Tier 1 + step_confirm，且 `docs/01–10 + adr/` 都是真相源；但 05 仍把 Hopper PoC、Tier 1 两档和直达验收列 P0，08 仍把 C1/C3 Hopper 桥、Demo 与 Hopper usage 列 P0，ADR 附注说 P0.5 而正文仍写“双路径(P0)”，10 的 #12/#14/#15/#25/#27 及 Brain instructions 仍把直达/Hopper/切档标 P0。
- 【事实】Demo 仍展示未标分期的直达验收、预授权和 S3 Touch ID；这违反仓库 `AGENTS.md:17`“超出 P0 必须标注分期”。02/04/07 也继续把两档/Hopper 写成 P0 事实。
- 【judgement】新会话会同时读到“禁止实现”和“P0 必须实现”两套指令，无法靠“09 胜”解决产品分期冲突。
- **改法**：先由 owner 确认一张唯一 `phase × route × mode × capability × UI` 矩阵，再同步 02/04/05/07/08/09/10/ADR/Demo。P0 的 schema 可以保留 reserved enum，但 dispatch validator/UI/instructions 必须机械拒绝或隐藏 `route=hopper`、`direct_to_review` 与 preauthorization；Demo 加 P0.5/P1 badge 或删除相应流程。

### A-09 依赖图和估时仍不能作为交付基线

**位置**：计划 44–55、63–68、76–88、96–112、118–140、146–150；`research/codex-findings/02-hopper-integration.md:743–763`。

- 【事实】主图的 P1/P2 汇合与 P4→P5 顺序已修；3.4 先做 dispatch receipt、4.2 再标 C5 全生命周期，这可以是 `C5 receipt-core → C5 runtime-effect` 的合理拆分，但计划没有声明该拆分、owner 与接口依赖；G6 的 consent 必须先于 Phase 1 首次存转写，不能等并行的 2.1；P0.5-D 真实 PoC 必须依赖 P0.5-B bridge，图却把 B/C/D/E 都画成 A 的直接后继。
- 【事实】计划 103 把 Phase 4 出口叫“P0 交付点”，114 又说 Phase 5 才 P0 完成；两处定义不同。
- 【事实】P0 的 24–31 人日/21–27 理想关键路径尚未计 A 级合同回修。Phase 1 同时含双 provider spike、管线 bake-off、WS/browser audio、会话与 Brain；Phase 4 同时含 sandbox、approval、三熔断、recovery、callback、steer、E2E，5–7/5–6 日均偏紧。
- 【事实】P0.5 只估 6–9 日；既有 Hopper 评估单 PoC 已是 3–4 日，生产 bridge 另估 1–2 周，尚未含六项合同、直达档、S3 面和 Demo（Codex 02:743–763）。
- 【judgement】P0 标题的 21–27 日可保留为“合同关闭后的理想 elapsed lower bound”，但不能再同时承诺两周/15–18；P0.5 的 6–9 日明显低估。
- **改法**：先插入 `Contract Closure 0`，显式画出 `C5 receipt-core/IntentLedger → 3.4 → C5 runtime-effect/Tier1 execution`；再补 `consent gate → voice persistence` 与 `P0.5-A → B → D`。统一写 `24–31 人日 / 21–27 日理想关键路径 + 合同回修与 owner 场次另计`，在 0.0/1.0/1.1 后滚动重估；P0.5 至少按“合同关闭 + bridge 1–2 周 + direct/Demo/S3”分项估算。

### A-10 Phase 0 生死 spike 漏测 P0 主线的 live steer

**位置**：计划 50、101、149；07:172–178；10:57。

- 【事实】0.0 只测 `streaming input / canUseTool / resume`；07:175 把 `steer` 同列为 Tier 1 成立前提，计划 4.5 与 10 #24 又把 live steer 当 P0 主线能力。
- 【judgement】若 steer 到 Phase 4 才发现不可用，P0 的“改需求直接注入、本轮不作废”承诺和状态机都要返工；三能力 probe 不能证明 Tier 1 全闭环成立。
- **改法**：0.0 改为四能力最小 probe，并记录 steer 的 ack/ordering/resume 后语义；不支持时立即上浮 owner 决定收窄 P0 或明确采用 `kill_and_resume`，同步 03/07/10 与验收，不能静默降级。

---

## 4. B 级问题（对应 Phase 开始前修）

### B-01 C5 receipt-core / runtime-effect 拆分未声明

- **位置**：计划 88、98；09:508–512。
- 【事实】3.4 已要求签发/校验 `dispatch_package` 收据并用它完成 G5 join；4.2 才以 C5 名义实现收据全生命周期。
- 【judgement】顺序本身可以成立，但计划没有声明 3.4 是 C5 receipt-core 切片、4.2 是 runtime-effect/presentation 扩展；新会话可能重复实现，或让 G5 用桩数据假关闭。
- **改法**：显式拆出 C5 receipt core 的 owner/interface/测试，再让 3.4 与 4.2 依赖它；G5 最终真实 join 证据放到首个真实 dispatch 后。

### B-02 每 Phase Gate 退出规则与跨 Phase Gate 冲突

- **位置**：计划 25、33、37、40。
- 【事实】通用质量门要求“本 Phase 归属 Gate 关闭”，但 G2/G6 明确跨两个 Phase，G5 还要等真实 dispatch。
- **改法**：Gate 状态分 `not_started/foundation_ready/closed/not_applicable_for_disabled_route`；自主 dispatch 只接受启用 route 的适用项为 `closed`。

### B-03 成本熔断缺 Tier 1 执行用量接线

- **位置**：计划 65、97–99；09:369–370。
- 【事实】1.2 只明确接 ASR/LLM/TTS 用量；4.2 要执行成本熔断，4.1 却没有 Agent SDK usage producer、unknown 降级或重启对账。
- **改法**：把 Tier 1 usage adapter、source/asOf/unknown 行为与 task/session 归因列为 4.1 前置；不可测时只启用 turns/walltime 熔断并如实上浮。

### B-04 P0 数据模型仍有内部矛盾

- **位置**：09:28、35、75–97、201–214、239–258、362–363。
- 【事实】`DecisionPackage.expiresAt` 在批准前 required，又定义为 receipt 后派生；`any→failed` 允许终态倒退；ContextSnapshot 排除 project/session，却以 digest 单主键挂一个 session。
- **改法**：拆 TTL/批准后 expiry；声明 terminal set 与 route guard；把快照拆成内容寻址实体 + session binding，或把归属纳入 identity，并补稳定 event-id tie-break。

### B-05 outbox 的重复上界仍是错误承诺

- **位置**：09:300–303、464、524；计划 100。
- 【事实】没有 transport idempotency 时，发送成功、落 `notified` 前连续崩溃可重复多次，“重复 ≤1 次”无法成立。
- **改法**：实现 transport/接收方 dedupe，或诚实写 at-least-once、消费者按 dedupeKey 收敛；增加连续 crash fixture。

### B-06 P0.5 DAG 过度并行，6–9 日不可信

- **位置**：计划 118–139；Codex 02:743–763。
- 【事实】P0.5-D 必须依赖 B bridge，C 依赖 A presentation/receipt/matrix；B 若做 approve→merge 还依赖认证 S3 handoff。图却把 B/C/D/E 都画成 A 的直接后继。
- **改法**：至少改为 `A→B`、`A→C`、`B+C+S3 handoff→D`；E 标明 artifact 依赖并分项估时。

### B-07 Phase -1 仍不是机器可验 handoff

- **位置**：计划 9–20、50–51。
- 【事实】Phase -1 是六段 prose，没有逐项状态、secret ref、验证命令或交接产物；环境清单未列 `just`，Phase 0 却要求 `just dev`。
- **改法**：生成不含秘密值的 `PREWORK.md/preflight.json`，每项记录 owner、`ready|blocked|deferred`、证据路径与验证时间；Phase 0 首命令机械校验。

### B-08 WS 契约不足以实现计划 1.2

- **位置**：计划 65；09:380–393。
- 【事实】计划要求版本/重连，09 只有消息 union；没有 protocol hello/version、音频格式、seq 作用域与 ack、gap/resume、backpressure、错误/关闭码。
- **改法**：补 wire envelope、session epoch、audio format、ack/resume cursor、gap/fail-closed、容量上限与 golden byte fixtures。

### B-09 D4/D5 spike 缺可裁决阈值

- **位置**：计划 18、63–64、147；07 D4/D5；10:129–131。
- 【事实】5 条底板、50–100 条种子、未来 300–500 条 dogfood 数据三个口径并存，没有 WER/术语准确率、首包 P50/P90、自然度或两家皆失败时的阈值。
- **改法**：明确 smoke/seed/golden 三层资产的来源、授权、评分脚本、硬阈值与失败分支；同步 07 D4 分期。

### B-10 实施期轻量评审与仓库规则冲突

- **位置**：计划 7、154–159；仓库 `AGENTS.md` 评审制度。
- 【事实】仓库规则要求重要产出固定 2 subagent + 1 Codex；计划对纯代码改成 1 subagent、Codex 攒批，同时称“遵守 AGENTS.md”。
- 【judgement】新会话必须服从仓库规则，计划的轻量制度当前无效，估时也漏了评审成本。
- **改法**：owner 修改 AGENTS 明确 supersede，或删除计划中的冲突规则并按现行制度估时。

### B-11 风险表仍允许不存在的 Tier 2 fallback

- **位置**：计划 50、96、149。
- 【事实】0.0 已写任一 SDK 能力失败即上浮、P0 无退路；风险表仍称“4.0 首日实测，不符降级 Tier2”，而 P0 已移除 Hopper/Tier2。
- **改法**：改成“0.0 失败立即停止并上浮；4.0 仅真实 worktree conformance 复验”，不设自动降级。

### B-12 §12 的 P0/P0.5 选择集不可生成

- **位置**：09:458–470。
- 【事实】分层脚注遗漏 5(outbox)与 7(recovery)，第 7 组又混合 Hopper/Tier1；所称 MUST traceability matrix 尚不存在。
- **改法**：给每项稳定 ID 与 phase/route 标签，拆 Tier1/Hopper，并真正落一份由 CI 消费的 traceability manifest。

## 5. C 级问题（随本轮清理）

1. 【事实】`docs/10` 标题仍为 v1.0-rc，变更说明称 38 条，正文已有 #39（10:1、4、77）。
2. 【事实】09 行首 fence 共 37 个，末行 530 是孤立围栏；Markdown 不闭合。
3. 【事实】09:90/121 引用不存在的 `§11-2`，09:455 引用不存在的 `§14-B10`，09:518 仍称路径二为“Phase 5”。
4. 【事实】`[gate0]` 同时有 `enabled=true` 与 `bypass=false`（09:431–433），计划又称不存在 bypass；应删除可手改总开关或定义所有非安全组合均拒 dispatch。
5. 【事实】计划 103 称 Phase 4 为“P0 交付点”，114 又称 Phase 5 才 P0 完成；前者应改为受控 dogfood gate。
6. 【事实】ADR:13、07:99 仍无时态声称测试全绿，ADR:76 才给出正确提交快照口径。
7. 【事实】仓库 `AGENTS.md` 称 canonical 为 `01–08 + adr/`，计划 6 与 09:3 又把 09/10 作为 canonical；owner 需统一层级。
8. 【事实】08 实际为 A1–A7、B1–B5、C1–C8、D1–D2、E1–E3，共 25 个模块，并非任务背景所称 22 个。
9. 【事实】09:529 声称上游同步完成，但本报告已复现 05/08/10/ADR 的旧分期；机械 readback 前应改未来时。

---

## 6. Codex 06 / 07 A 级最终状态表

> **关闭**＝整项关闭条件已进入 canonical schema/validator/正反例；**P0.5 诚实推迟**＝P0 不走该路径且没有偷用；其余均记**仍遗漏**。混合项按启用路径的最不利状态归类。

| 来源 | 原 A 级 | 最终状态 | 【事实】核对 |
|---|---|---|---|
| 06-A01 | 直达验收安全语义跨边界丢失 | **仍遗漏（目标是 P0.5）** | 计划/ADR 附注已移出 P0，但 05/08/10/ADR 主体仍标 P0，当前不能称诚实推迟。 |
| 06-A02 | review first-wins 与 S3 receipt 不原子/不可认证 | **P0.5 诚实推迟** | §14-A2/A3/A4 列 Hopper CAS/receipt/reconcile；P0 不调用 Hopper review/merge。P0.5 仍须补 S3 handoff。 |
| 06-A03 | cancel + redrop 无终结屏障 | **仍遗漏（目标是 P0.5）** | §14-A4 列 CancelSettlementProof/run 绑定，P0 不走 Hopper redrop；但计划 0.3 仍实现含 cancel 的 Hopper journal，10 #25 仍标 P0，尚不能称诚实推迟。 |
| 06-A04 | `ready_for_review` 状态词回归 | **仍遗漏（主体修复）** | 04/05/10/计划已正确；01:31、59 与 02:45 仍有“做完叫人/完成后叫”式总括。 |
| 06-A05 | ADR 已定却仍写待拍板 | **仍遗漏** | README/03/05 已修；07:101 仍写 owner 拍板路线后“先出 ADR”。 |
| 07-A01 | digest/ID producer、domain、verifier 未闭合 | **仍遗漏（部分修复）** | §0.1 补主要 digest；但无全 ID owner 表，`runtime_effect.refDigest` 无 schema，P0 presentation/intent 无签名对象，§14 无 A1。 |
| 07-A02 | Receipt 合法组合、presentation、原子消费不足 | **仍遗漏（跨域部分 P0.5，Tier1 子集漏 P0）** | §14-A2 有目标；P0 4.2 已依赖 void，interface/DDL/§13 无 presentation/CAS，DDL 接受非法组合。 |
| 07-A03 | 本地 journal 冒充外部 exactly-once | **仍遗漏（目标是 P0.5）** | §14-A3 明确 unknown→reconcile、retry class 与 Hopper change；但 P0 0.3/G2 仍要求旧 journal 与重放，尚未真正移出。 |
| 07-A04 | Hopper mapping/cancel/settle/callback 串旧 run | **仍遗漏（Hopper 部分 P0.5，P0 本地部分缺）** | §14-A4 的枚举正确；§7 仍错误，Tier1 settle/cancel proof 缺失，outbox“重复 ≤1”仍不成立。 |
| 07-A05 | SQLite/TOML 不可解析且 TS↔DDL 不齐 | **仍遗漏（语法子项关闭）** | DDL/TOML 真实解析成功；非法 receipt/空核心行可写，migration、round-trip 与缺失对象未闭；FTS 删除措辞未精确到标准 SQL。 |
| 07-A06 | hard forget 无目标、崩溃不收敛 | **仍遗漏** | prose/10 方向已修；interface/DDL/job/proof 不承载，FTS 删除写法有歧义，P0 G6 仍依赖。 |
| 07-A07 | mode×backend×phase 不可同时实现 | **仍遗漏** | 计划/ADR 附注方向正确，§14-A7 待 owner；02/04/05/08/10/ADR/Demo 未同步，P0 无 phase guard。 |
| 07-A08 | runtime S2/barge-in 不满足所闻即所签 | **仍遗漏** | E2 `renderSpoken` 文案来源已修，10:83/#39 有 void 规则；但 #39 标 P0.5，schema/WS/tool/golden 仍无 presentation/nonce/CAS 承载。 |
| 07-A09 | 契约测试未覆盖自身红线 | **仍遗漏** | §12 有扩充；仍无 P0 presentation、Tier1 settle/merge、deletion crash phase 与真实 MUST manifest。 |

【judgement】严格整项口径下，本轮 **0 项完全关闭，1 项可记为 P0.5 诚实推迟，13 项仍遗漏或分层混用**。另有多项语法、话术和范围子问题得到实质修复，但尚未组成闭合交付合同。

---

## 7. 首日硬卡剩余清单

### 7.1 当前机器 / owner 前置

- 【事实】`~/WorkSpace/VoiceLoop/` 当前不存在；Phase -1 C 未完成。
- 【事实】Node `v22.23.1`、pnpm `10.33.1`、Python `3.12.13`、uv `0.11.7`、Google Chrome 与 `codex` 可执行文件已存在。
- 【事实】`just` 当前为 **MISSING**，`~/.voiceloop/config.toml` 也不存在；全局 Playwright 命令未安装（可由新仓本地依赖解决）。`codex --version` 返回 `codex-cli 0.145.0`，同时给出无法创建 PATH alias 的非致命 `Operation not permitted` 警告；本轮没有另跑 headless 任务探针，所以“binary 存在”尚不等于实施环境的 Codex 攒批链可用。
- 【事实】本轮没有读取或打印凭据，也没有验证额度、麦克风/扬声器、ASR/TTS key、ntfy、hosting、dogfood 项目与音频底板；“未验证”不等于“缺失”。
- 【judgement】Phase -1 是 owner handoff，不是新实施会话可自行猜测完成的步骤。

### 7.2 发 Phase 0 prompt 前必须关闭

1. 同步唯一 P0 capability/feature matrix；P0 UI/validator 机械禁用 Hopper、direct mode 与 preauthorization。
2. 把 0.0 改成 streaming input / `canUseTool` / resume / **steer** 四能力 probe，并定义失败后只能上浮 owner。
3. 把 Tier 1 S2 的最小 intent/presentation/receipt/barge-in 状态机前移 P0。
4. 把 P0 active stores 的 hard-forget durable job/proof 前移 P0，并把 FTS 删除明确为可执行标准 SQL。
5. 定义 Tier 1 invocation/run/settle/cancel/callback/manual-merge reconciliation。
6. 修通 §13 的 task draft→package→receipt→dispatch 调用图、结构化结果与 error union。
7. 将 Gate 0 改为 route-aware、由能力与证据推导的 predicate；关闭 G1 信任根、G3/G4 受信配置、G5 schema、G6 consent event。
8. 从 P0 0.3 移走 Hopper-specific journal，重画 P0.5-B/C/D 依赖。
9. 统一 P0 终点与工期：Phase 4 为受控 dogfood，Phase 5 才正式交付；删除“两周/15–18 日”。
10. owner 落盘无秘密的 Phase -1 handoff，创建目标仓、安装/替代 `just` 并完成环境/资产验证。

### 7.3 可以保留为首日 spike

- 【事实】0.0 把 Agent SDK 物理验证前移并设 Go/No-Go 是正确改进，但当前只覆盖 streaming input / `canUseTool` / resume，漏了 07:175 与 P0 4.5 依赖的 steer。
- 【judgement】补成四能力后，它必须在 7.1 handoff 与 7.2 文档硬卡关闭后运行；probe 全绿也不能替代缺失合同。

---

## 8. 最终裁决

【judgement】**P0 计划未达到“可交新会话实施”标准；P0.5 清单覆盖了 A2/A3/A4/A6/A7/A8 的标题，却未覆盖/关闭 A1/A5/A9，并错误地把 Tier 1 所需的 A2/A6/A8 子集一起推迟。**

**一句话：现在不能把正式实施 prompt 发出去；先完成 Phase -1 handoff，并关闭 P0 分期同步、四能力 SDK probe、Tier 1 presentation、hard-forget proof、Tier 1 settle/merge 与 Gate 0 真实谓词。**
