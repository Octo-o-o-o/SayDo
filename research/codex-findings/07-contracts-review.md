# 07 · 数据契约 / 语音话术规范对抗性评审

- 评审日期：2026-07-23
- 最终评审快照：`docs/09-data-contracts.md` **v1.0-rc / 419 行**；`docs/10-voice-ux-spec.md` **v1.0-rc / 115 行**
- 对照基线：`research/codex-findings/06-recent-rounds-review.md`、`02-hopper-integration.md`、`docs/01`～`08`、ADR-001、Hopper 当前源码
- Hopper 实读基线：`main@ea3fb31fd04946a66229022782b43daf57bf3fe4`

> **快照说明**：本轮开始时 09/10 还是用户点名的 Draft v0.9；评审过程中它们被外部并发回修为 v1.0-rc，02 也同步改动。本报告没有沿用旧快照结论，而是重新完整核对并以当前 v1.0-rc 为最终对象。报告未修改任何待评文档。

> **总判定**：09 与 10 仍未共同达到“实施者可照抄”。09 为 **No-Go**；10 的话术表已接近可实施，但作为包含授权/删除/后端降级的完整 Brain 规范仍为 **Conditional No-Go**。阻断项不在文风，而在跨域幂等、批准 presentation、取消/settle、可执行存储、hard forget 与模式能力矩阵。

## 0. 证据范围与判定口径

- 【事实】Hopper `git status --short --branch` 输出 `## main...origin/main`；`git rev-parse HEAD` 输出 `ea3fb31fd04946a66229022782b43daf57bf3fe4`。
- 【事实】`git diff --name-status c4c29c6..HEAD` 只有一份实施日志与三个 archive 文件，没有生产源码变化。因此 v3 prompt 所述“`c4c29c6` 与当前生产代码无差”准确。
- 【事实】VoiceLoop 当前目录不是 Git worktree（`git status` 返回 `fatal: not a git repository`），故回归结论来自 06 报告与当前文件逐项对照，不冒充 Git diff。
- 【事实】本轮没有运行 VoiceLoop/Hopper 测试套件；运行了 SQLite DDL 解析、TOML 解析、Markdown fence 计数与只读源码核对。历史提交中的 1076/48/198 不算本轮实测。
- 【judgement】A = 会造成越权、错误终态、跨 run 串线、数据承诺失真，或直接使“照抄实施”不成立；B = 不阻断最窄 spike，但会迫使实现者自行补合同；C = 清晰度、维护性与体验改进。

## 1. 总评

| 文档 | 当前判定 | v1.0-rc 已有实质进步 | 仍不能照抄的主因 |
|---|---|---|---|
| `docs/09-data-contracts.md` | **No-Go** | 明确 JCS 与三个签名域；补收据转换、TaskCard 转换表、出站 journal、Artifact、ContextSnapshot 表；EffectGrant 缩为两类并补约束；outbox 活跃唯一索引 | digest/ID 生成校验矩阵仍不闭合；Hopper 幂等被本地 key 冒充；取消投影与 settled 定义直接冲突；settle/outbox 不绑 run；DDL/TOML 解析失败；hard forget 崩溃后不可重放 |
| `docs/10-voice-ux-spec.md` | **Conditional No-Go** | S3 instructions 已补；ETA 双轨化；模式缺省与 02 对齐；P0/P1 审批卡分支清楚；状态词、热词承诺、Brain/摘要器角色与文本/音频 golden 分层均改善 | 运行中 S2 未被 E2 文案锁定；授权播报被打断后 presentation 不失效；删除话术早于传播 proof；模式切换未按后端 capability 分支；摘要、隐私与进度数据源仍不完整 |

【judgement】09 目前可作为 D9 spike 的高质量输入清单，但开头“唯一 canonical、照抄、不再发明 schema”的承诺仍过早。10 的普通对话和状态话术可以先实现；涉及 S2/S3、barge-in、forget、切档、回叫的路径必须等本文相应 A 级关闭。

### 1.1 用户点名的 Brain 硬规则核对

| 硬规则 | 结果 | 核对 |
|---|---|---|
| readiness evaluator 独立 | **通过** | 【事实】`docs/10:95` 要求每轮 `assess_readiness`，Brain 不自判；02/07 另有不同模型家族门禁。 |
| 预授权只念 E2 生成内容 | **预授权通过，运行中 S2 未通过** | 【事实】`docs/10:97` 锁定预授权 `spokenForm`；`docs/10:51` 的逐项 S2 仍只写“动作+关键约束”，未要求逐字 E2 输出与 downstream trigger。 |
| 不预设模式选择 | **通过** | 【事实】`docs/10:96` 使用中性二选一，推荐不替用户选；`docs/02:32` 已与 04/10 统一为“不置可否→逐步确认”。 |
| S3 语音绝不放行 | **通过** | 【事实】`docs/10:52,98` 已同时进入话术表与可复制 instructions，并区分 P0 降级和 P1 审批卡。 |

## 2. A 级问题

### A-01 digest / ID 的生成者、签名域和校验者仍未闭合

**位置**：`docs/09:5,10-25,66-102,117-133,192-205,254-270,315-321,364`

- 【事实】§0.1 只定义 DecisionPackage、EffectGrant、ContextSnapshot 三个签名域；同文另有 `runtime_effect.refDigest`、`HopperCommand.payloadDigest`、`Artifact.digest`、`projectSnapshotDigest`、`last_line_digest` 等 Digest，却无 canonical payload、生成者和校验者。文件字节/JSONL 行也不能直接套用“所有 digest 都是 JCS JSON”。
- 【事实】`DecisionPackage.expiresAt` 决定能否 dispatch，却在签名域中明确排除；文档没有把它定义为不可变派生值。修改有效期不会改变已批准 digest。
- 【事实】包只签 `preauthorizedEffects[].grantDigest`，但没有硬规则要求验签时从内嵌 grant 字段递归重算；测试也缺“篡改 grant 字段但保留旧 grantDigest”的反例。
- 【事实】`runtime_effect.refDigest` 仍没有对应的 `RuntimeEffectIntent` schema；`projectSnapshotDigest` 只出现在 dispatch binding，未进入用户批准的 package/receipt。
- 【事实】ContextSnapshot 签名域排除 projectId/sessionId；同一个 pack digest 可被重新归属到另一项目/会话，SQLite 又以 pack_digest 单主键保存 session。
- 【事实】ID 只给前缀，没有“哪个组件在何时生成、哪些引用由谁校验”的 owner 表。
- 【judgement】旧版“digest 自引用/可变 status”已修，但授权与审计图仍不是闭合 DAG；实现者仍需发明关键摘要。

**改法**：为每个 ID/Digest 给出 `producer → exact signing payload/domain separator → verifier → failure` 表。package 的有效期要么签绝对值/签 TTL+锚点，要么声明由不可变 receipt 唯一派生且不可写。验包必须递归重算 grantDigest；新增 RuntimeEffectIntent；project snapshot 在呈现前进 package payload，dispatch 前再 CAS 复验。文件类 digest 单独定义 bytes/encoding/newline 规则。

### A-02 ApprovalReceipt 的合法组合、presentation 与原子消费仍不足

**位置**：`docs/09:114-158,335-340,412`；`docs/04:140-145`；`docs/10:51,81`

- 【事实】09 声称合法矩阵会进入“写入校验 + DDL CHECK”，DDL 实际只检查 S3 和 push；没有约束 voice=voice_weak、screen 强度、preauthorized 继承、kind 与 parent/grant 字段、decision/outcome/decidedAt/consumedAt 的组合。
- 【事实】`preauthorized` 声称继承父 dispatch 收据的 authStrength，却没有 parent receipt id，无法证明继承来源。
- 【事实】`respond` 没有任何 outcome 转换；09 新增 `reject` 后又与 04 的四动作 `accept/edit/respond/ignore` 不一致。`outcome=pending` 同时表示“未决定”和“accept 后待消费”，只能靠隐含组合区分。
- 【事实】收据没有 presentation digest/版本/失效原因；projectId 缺失、taskId 可选，与 04 “审批卡必须带项目/任务”冲突。turnRef 只能证明存在一轮转写，不能证明用户听完了哪段授权。
- 【事实】没有 per-subject version/CAS；本地 nonce 单次消费不能让 Hopper Console/CLI 的 review 决策变成 first-wins。
- 【judgement】超时 outcome 已能表示，但“所闻即所签、所签只消费一次、他端先决不可翻转”仍没有同一条可执行状态机。

**改法**：优先拆 `ApprovalRequest/Presentation/Receipt`；若坚持一表，至少用显式 `awaiting_decision/authorized_pending_consume/...` discriminated states。补 project/task/subject、presentation digest+nonce、heard/invalidated 状态、parentReceiptId、version/CAS 与完整 CHECK/validator。review first-wins 明标 HOPPER-CHANGE，本地只能 reconcile，不能称原子兜底。

### A-03 本地 Dispatch/HopperCommand journal 不能提供文档承诺的外部幂等

**位置**：`docs/09:16,251-271,345-348,416`；`research/hopper-integration-request.md:28,40,50-57`

- 【事实】Hopper 排队路径支持调用方传 `req_id`、落 `.result.json` 并在已有结果时跳过；但直接持锁路径及不同官方写入口没有统一覆盖的外部 idem/first-result 合同。09 却把“一切跨边界重放返回首次结果”写成通用保证，未标 `[待Hopper裁决]`。
- 【事实】若 Hopper 已落 drop、VoiceLoop 在回填 outcome 前崩溃，本地 NULL 行不能独立证明外部是否成功；能否按原 key 查询首次结果取决于实际入口，09 没定义分支与对账。
- 【事实】HopperCommand 只存 payloadDigest，不存可重发 payload/ref、结构化结果、retryability、winner/version 或 `unknown/reconcile_required`；当前 review/reject 重放还可能追加或翻转事件。
- 【事实】DispatchBinding 的 Hopper revision 仍写 `string`，而 Hopper `DropResult.revision_no` 是 number；Binding 仍缺 package id/revision、vault identity、批准收据、权威 dispatch state 和结果 envelope。
- 【judgement】“先落本地 journal”是必要条件，但不是跨系统 exactly-once。当前文案会把 crash-after-commit 当安全重放，反而放大重复副作用。

**改法**：把 Hopper 外部幂等/first-result 明标 HOPPER-CHANGE。P0 fallback 必须定义 deterministic Hopper task/source identity、提交前 CAS、timeout 后查询与 `unknown→reconcile`，并按每个 op 标 `safe_to_retry/reconcile_only/permanent`。journal 持久化 versioned payload 或可重建 ref、返回 envelope、attempt 与 winner；Binding 补完整 package/vault/receipt/state。

### A-04 Hopper 投影、取消、settle 与 callback 仍会混淆旧 run

**位置**：`docs/09:230-249,274-310,358-364,414-417`

- 【事实】Hopper 当前 task enum 为 `received,draft,plan_needed,research,ready,running,review,blocked,failed,rejected,done,archived,deferred,conflict`；09 §7 使用不存在的 `triage/queued`，遗漏 ready/conflict 等多个真实状态。
- 【事实】`cancel_requested→cancel_settled` 要求“权威终态+进程退出+锁释放+事件对账”，但 §7 又把 `failed+cancelled_by_user` 直接映成 cancel_settled。Hopper 当前可在 finally 释放锁前写出取消相关事件。
- 【事实】没有 `CancelSettlementProof`；settleProof 只有自由字符串 cursor/checks，没有 Hopper task/run/attempt/revision/tree/evidence digest/settledAt。旧 run 文件存在即可误过 barrier。
- 【事实】Hopper 已有 ReviewApproved、MergeStarted、MergeFinished 事件，但 §7 没给出这些事件到 `review_approved_waiting_merge/merging/merge_failed` 的精确映射、失败分支或 run/revision 绑定；仅列用户视图结果不足以实现投影。
- 【事实】outbox 宣称“至少一次且重复 ≤1”，但发送成功、落 notified 前连续崩溃可重复任意次；没有 transport idem 或接收方去重就无法给出 ≤1 上界。
- 【事实】events_cursor 只含 source/offset/last-line digest，缺 vault/generation/file identity/prefix checkpoint/last event id；无法安全区分替换、截断和跨 vault。
- 【judgement】06 A-03 与 B-02/B-03 未关闭；当前实现可过早重 drop、把旧 artifact 当新证据或重复回叫。

**改法**：建 Hopper task 全枚举 × attempt/run event × VoiceLoop local operation 的 total mapping，每行标 CURRENT/VOICELOOP-OWNED/HOPPER-CHANGE。取消候选事件只推进 requested，复合 proof 后才 settled。settle/outbox 快照同一 dispatch/package/task/run/attempt/revision/tree/evidence/cursor。若无 transport idem，诚实写“可能重复，消费者按 dedupeKey 幂等”，不要声称 ≤1。

### A-05 号称可照抄的 SQLite/TOML 仍不能解析，TS↔DDL 也未对齐

**位置**：`docs/09:325-365,391-406`

- 【事实】直接执行 DDL 的原始结果：

  ```text
  Error near line 24: parse error in tokenize directive
  ```

- 【事实】把配置示例交给 Python `tomllib` 的原始结果：

  ```text
  TOMLDecodeError: Expected newline or end of document after a statement (at line 2, column 11)
  ```

- 【事实】DecisionPackage 的 approvedVia 没有明确持久化列；ContextSnapshot 的 projectId/createdAt 与 TS/DDL 不对齐；TaskCard 的 createdAt 只在 SQL；收据完整矩阵没有变成 CHECK；memory lifecycle/generation 与 hard-delete progress 无表。
- 【事实】DDL 没有 schema version/migration，关键必填字段多数可 NULL；FTS tokenizer 仍是占位符。
- 【judgement】这在“设计骨架”中可接受，在 v1.0-rc 的“照抄实施”承诺下属于直接阻断。

**改法**：D9 后交付能由 sqlite3 直接执行的 migration、schema version、FK/NOT NULL/CHECK 与 FTS trigger/删除路径；生成或测试 TS↔SQL round-trip。TOML 每个 assignment 独占合法语句，配置示例进入 parser fixture。

### A-06 hard forget 的 tombstone 无目标，崩溃后无法靠重放收敛

**位置**：`docs/09:160-184,349-353,413`；`docs/10:75`

- 【事实】MemoryEvent 对所有 op 强制 claim/source；forget_hard 又要求 tombstone 仅 id+ts、不留内容，但没有 target id/digest 或稳定目标集合。
- 【事实】若“追加 tombstone”之后、“覆写历史相关事件”之前崩溃，重放看到的 tombstone 不知道该清哪些事件、FTS、摘要与备份。
- 【事实】memoryGeneration 被要求强制 +1，却没有持久化计数器或与 tombstone 同事务的记录；多目标传播也没有 phase/progress。
- 【事实】10 在没有传播 proof 的情况下直接说“从记录里删了”，并把关联建议是否作废留成可选；09 自己要求派生摘要一起清除。
- 【judgement】Gate 0 的硬删通路仍不可恢复，且会对用户虚报完成。

**改法**：把 MemoryEvent 做成按 op 的 discriminated union。tombstone 不存敏感正文，但必须存稳定 target ids/digests、generation 与 deletion job id；记录各 active store 的 phase，幂等重放。10 改两阶段话术：“已标记不留记录，正在删除”→ proof 成功后“已删除”；所有依赖结论自动 stale，再询问是否重算。

### A-07 P0 模式×后端×分期仍无法同时实现

**位置**：`docs/04:165-169`；`docs/05:76-77`；`docs/adr/ADR-001:12-14`；`docs/09:216-247,411`；`docs/10:59`

- 【事实】04 说“重任务+逐步确认 P0=步骤边界停靠”；05 把 Tier 2 步序循环排 P1；ADR 又规定 Hopper 路径 P0 只有直达验收。
- 【事实】10 切档统一承诺“之后每步问你”，没有按 route/capability 分支；09 状态机也允许 Hopper 走 paused_step_boundary，却没有 P0/P1 或 capability guard。
- 【事实】路径二 P0 又必须 grants 为空、只准 S0/S1；因此“显式切直达验收并念清单”在 ADR 与 09 中也需要说明清单为空/不产生 S2 授权，不能复用 Tier 1 话术。
- 【judgement】这不是正交参数的实现细节，而是 P0 是否存在某条 route 的冲突。实现者会被迫静默换后端、静默降能力或违背分期。

**改法**：owner 只保留一张 capability matrix。若以 ADR/05 为准：P0 Hopper `step_confirm=unsupported`，用户可显式改走 Tier 1；正在运行的 batch 切档走 cancel-settle-new-run。若以 04 为准，则把 C2 步序循环升 P0 并补多 dispatch/settle/预算/恢复合同。10 的切档话术按 capability 分支。

### A-08 Voice 的运行中 S2 与 barge-in presentation 仍未满足“所闻即所签”

**位置**：`docs/10:51,81,94-102,113-115`；`docs/09:53-56,123,129,369-380`

- 【事实】S3 语音禁批已经修好；剩余缺口是运行中 S2：话术只要求“动作+关键约束”，instructions 的 E2 `spokenForm` 纪律只写在预授权，没有要求逐字与 project 上下文；task 前缀在 P0 单任务时还可省，也未绑定 downstream trigger 与 channel eligibility。
- 【事实】授权/清单播报被打断时，规则只有“关键确认必须重述”，没有使当前 presentation nonce 作废，也没禁止随后裸一句“好”消费旧 pending receipt。
- 【事实】TranscriptTurn 只有整句 heard:boolean；WS 的播放定位只有 sentenceId/truncatedSentenceId + 毫秒时间，没有字符/词 alignment、presentation id 或 `invalidated_by_barge_in` 事件。
- 【事实】音频 golden 只断言 unheard 不入事实和关键确认重述，没有断言 receipt/package/dispatch/tool 状态均保持不变。
- 【judgement】用户可能只听到授权前半段，系统却消费整包；这是当前 10 最重要的安全阻断。

**改法**：所有 S2 都只播放 E2 生成并签名的 presentation，带 project/task/效果/目标/下游/有效期；policy 层校验 channel。barge-in 立即将 presentation/nonce 置 void，随后任何裸肯定不得消费；完整重播或转屏幕后签发新 presentation。golden 必须断言无 receipt、无 package 状态变化、无工具/dispatch 调用。

### A-09 契约测试清单仍没有覆盖自身全部红线

**位置**：`docs/09:408-419`；`docs/10:111-115`

- 【事实】09 新清单比 v0.9 明显完整，但仍缺：DDL/TOML 真解析与 TS↔DB round-trip、Hopper 状态 total mapping、内嵌 grant 篡改后递归重算、presentation binding/barge-in 作废、receipt 全合法组合、hard-forget 各崩溃相位、cursor file/vault generation、dispatch unknown/reconcile、永久失败禁止重放、outbox 连续 crash 重复。
- 【事实】10 golden 未断言 E2 文案一致、S3/S2 工具调用、presentation 作废、cancel settled 后才播“停了”、hard-forget proof、secret/path redaction。
- 【judgement】“P0 必须全绿”目前只能证明清单中的九组例子，不能证明文档自己的全部 MUST。

**改法**：建立 `MUST → producer/validator → positive fixture → negative fixture → phase/owner` traceability matrix；测试清单由矩阵生成。解析样例、状态穷举和崩溃相位必须是门禁，不是人工 review 项。

## 3. B 级问题

### B-01 TaskCard 转换表还有终态倒退和 route 混用

- **位置**：`docs/09:230-249`
- 【事实】`any→failed` 字面允许 task_done/cancel_settled/superseded 等终态倒退；缺 `ready_for_review→running` 的 request-changes/retry 路径。`blocked→running` 对 Tier 1 可成立，对 Hopper 当前 triage blocked 则通常要改卡+unblock/重排队。
- **改法**：按 route 做 transition guards，明确 terminal set；补 review 打回、retry、Hopper unblock 的真实路径。

### B-02 ContextSnapshot 决定性与存储主键仍有缺口

- **位置**：`docs/09:192-205,352-353`
- 【事实】同 ts 的事件没有稳定 event-id tie-break；digest 排除 session/project，表却用 pack_digest PRIMARY KEY 保存单个 session；createdAt 只在 SQL。
- **改法**：加入 event sequence/id tie-break；明确 snapshot 是内容寻址可复用还是会话审计实体。若后者，把 project/session 纳入 identity 或使用 `(packDigest, sessionId)`。

### B-03 Money 能表达 unknown，但 DecisionPackage/TaskCard 没有使用

- **位置**：`docs/09:13,77,223-224,356-357`；`docs/10:38,60`
- 【事实】通用 Money 支持 unknown；package cost 与 task maxCost 仍是必填 number，10 却有 unknown 口播分支。
- 【judgement】实现者会在 unknown 时编 0、拒绝建包或自创 nullable 规则。
- **改法**：estimate/actual/budget 统一使用带 known/asOf/source 的金额结构；max 可知、expected 未知时允许分字段表达。

### B-04 10 的摘要与进度模板仍假定不存在的数据

- **位置**：`docs/10:55,66-69,107-109`；`docs/adr/ADR-001:29`
- 【事实】get_status 固定说“第 n 步/步骤名”，Hopper P0 batch 没有 current activity 事件。摘要器只有成功 coding 字符串，没有 blocked/failed/unknown discriminant、asOf、source refs 或 evidence digest。
- **改法**：能力不足时说“仍在运行，暂时没有更细进度”；摘要输出改结构化 union，文件数来自 git，测试数来自独立 gate，未知显式标 unknown。

### B-05 10 的记忆口播与隐私规则内部不一致

- **位置**：`docs/09:170,182`；`docs/10:73-75,100`
- 【事实】话术允许 `auto_low_impact` 沉默通过后说“记下了”，instructions 又说只有用户亲述/确认的才可说“记下了”。全篇没有 token、secret、客户数据、完整本机路径的 TTS redaction 规则。
- **改法**：区分“系统记录了项目事实”与“我记住了你的偏好”；shared TTS serializer 加 data-class redaction，审批与 provenance 也必须走同一层。

### B-06 Quick 例外、选项互斥与摘要字数尚未同步

- **位置**：`docs/02:42,83`；`docs/04:55,187`；`docs/10:28,37,92,108`
- 【事实】02 规定 Quick+无 S2 不问模式，10 的最高频 ready 模板无条件询问；10 已有“4–5 个时念前三个、其余上屏”，但未把 04 的“总数 2–5 个且互斥”写进 instructions；10 walkthrough=120 字，02/04 仍为 150 字。
- 【judgement】10 作为 canonical instructions 会覆盖掉这些例外。
- **改法**：补 Quick 分支、互斥性硬规则；统一一个字数上限并以真实 TTS duration 为最终 gate。

### B-07 WS 还缺重连、序列与文本对齐协议

- **位置**：`docs/09:369-380`
- 【事实】增加 sessionId 是进步；仍无 protocolVersion/message revision/ack/reconnect，asr.partial 无 partial seq，watermarkMs 无字符/词 alignment。
- **改法**：补版本、乱序/重复/断线恢复与 playout offset；审批 presentation 使用独立 ack/invalidated 事件，不能只靠音频毫秒推断。

### B-08 v3 prompt 主体准确，但一处编号和 P0/P1 artifact 依赖不自洽

- **位置**：`research/hopper-integration-request.md:27-32,40-41,64-65`
- 【事实】`:32` 写“频率/退避遵守第16项”，实际在第9项；第16项是 DecisionRequest。原则说 artifacts 走版本化读取口，但该读取口排 P1，第4项 P0 settle 已依赖 summary/final snapshot/evidence。
- **改法**：改成“第9项”；写清 P0 锁版本后用 pinned path adapter，P1 切稳定读取 API。09 修完 A-01/A-03/A-04 前，不应声称我方字段已可逐项接受。

### B-09 其他 canonical 文档没有同步 v1.0-rc 与 current/target

- **位置**：`docs/04:85`；`docs/07:100-101,108`；`docs/08:40,151-157`；`docs/adr/ADR-001:9,28-33`
- 【事实】04 仍称 09 为 Draft v0.9；08 仍承诺 P0 current_projection，而 09 明确 P0 不落该表。ADR/07/08 的 M3b/M3c 职责仍互相冲突；07 还说 owner 拍板后“先出 ADR”，但 ADR-001 已存在。ADR/09 投影都使用 Hopper 不存在的 triage/queued。
- 【judgement】v1.0-rc 尚未真正成为全套 canonical，因为上游仍会把实现者带回旧版本/旧里程碑/旧状态。

### B-10 setup command 的信任边界不清楚

- **位置**：`docs/09:401-405`；`docs/04:151,174`
- 【事实】verify 被限制为登记模板，但 project.toml 仍可提供自由 `setup.command`；文档没说明谁能写该配置、何时签署、是否经 E2/postinstall 升级。
- 【judgement】若仓库内不可信内容能改 project.toml，setup 会成为绕过 EffectGrant 的 shell 通路。
- **改法**：配置放用户管理面或签 digest；setup 使用受信模板/argv schema，安装依赖仍过 E2。

## 4. C 级问题

1. **Markdown fence 失配**：【事实】`docs/09` 行首 fence 共 31 个，末行 419 是多余 fence。
2. **工具过渡语边界不清**：【事实】`docs/10:12` 在全局纪律中给了通用工具过渡语，但未限定适用条件；【judgement】只对用户可感知且超过首响阈值的等待口播。
3. **TTS 上限应按 duration 验收**：【judgement】120/150 字都只是近似，应由目标 voice 实测秒数和分句器控制。
4. **outbox resolution 词表**：【事实】普通 user_cancel 也被写成 `resolution=superseded`；应补 `cancelled`。
5. **settleProof 应按 trigger 判别**：【事实】当前结构让 approval_request/step_boundary 也必带路径二四项 settle；改成 trigger-discriminated proof。
6. **状态命名统一**：UI 文档同时出现 `task.done`、`task_done`；事件名、存储枚举、用户文案应分层，不混作一个 canonical token。

## 5. 09 与 Hopper 当前现状 / `[待Hopper裁决]` 核对

### 5.1 CURRENT 与漏标项

| 项目 | Hopper 当前事实 | 09 当前写法 | 裁决 |
|---|---|---|---|
| drop 四 outcome | 已有 created/updated_draft/new_revision/duplicate_ignored | 已列 | **CURRENT，正确** |
| task status | 无 triage/queued；有 ready/draft/plan_needed/research/conflict 等 | §7 仍用 triage/queued且漏状态 | **事实错误，不是待裁决** |
| project link/snapshot | config 已有；稳定读取、绑定、vault ownership 待定 | 已标待裁决 | **标注方向正确；snapshot 进入签署包的时点仍错** |
| official finalized event | schema 已预留 AttemptFinished/CommandSettled；当前 legacy execute 路径没有在全部 artifacts+投影完成后发出的统一终结事件 | settle 官方事件标待裁决 | **标注方向正确；本地 barrier proof 不足** |
| cancel settlement | cancel accepted 不等于 process/lock/event settled | 转换行标待裁决，投影却直接 settled | **漏在投影行，且内部矛盾** |
| external idempotency first-result | 无稳定外部合同 | 写成通用保证 | **HOPPER-CHANGE，漏标** |
| review first-wins/origin/receipt | 当前可重复/翻转；无 VoiceLoop receipt 验证 | 收据+journal 像可安全重放 | **HOPPER-CHANGE，漏标** |
| structured blocked/answer | unblock 无 answer 单次消费合同 | 直接投影结构化文本/blocked→running | **HOPPER-CHANGE，漏标** |
| versioned artifact read | 当前主要依赖 vault 文件布局 | P0 barrier 直接读，prompt P1 才请求 API | **P0 fallback/P1 target 未分栏** |
| command idem/retry result | 排队路径有 req_id/result 文件；直接路径及各 op 没有统一 first-result 合同 | HopperCommand 原 key重放 | **HOPPER-CHANGE/按入口本地 reconcile，漏标** |

### 5.2 v3 prompt 17 项准确性

| # | 结论 | # | 结论 |
|---:|---|---:|---|
| 1 | **准确**：drop/body dedup/四 outcome/外部 key 缺口 | 10 | **准确**：status 无 task filter，usage 可 unknown |
| 2 | **准确**：project config 有，稳定 snapshot/link/vault 合同待定 | 11 | **准确**：1076/48/198 是提交记录，不是本轮重跑 |
| 3 | **准确**：raw JSONL 无 seq，cursor/半行/截断/version 需合同 | 12 | **准确**：trusted bridge/receipt/security 待定 |
| 4 | **准确且关键**：runner/闸门/artifact/projection 有时序，缺 settled | 13 | **准确**：Console 路由已有，请求稳定化而非新增 |
| 5 | **准确**：当前 review/merge/cancel/unblock/retry 命令形状 | 14 | **准确**：versioned artifact read 缺；但 P1 分期需解释 P0 fallback |
| 6 | **准确**：review 可重复/翻转，缺 per-subject first-wins | 15 | **准确**：NotificationIntent transport 是未来项 |
| 7 | **准确**：cancel 返回时不能证明 process/lock settled | 16 | **准确**：DecisionRequest runtime/voice auth evidence 是未来项 |
| 8 | **准确**：blocked 无结构化 answer 单次消费合同 | 17 | **准确**：Command/ExecutorHandle 当前无 steer，须按 capability |
| 9 | **准确**：需错误码/CAS/retry/频率合同 |  |  |

【judgement】17 项没有把不存在的 Hopper runtime 当成已有；唯一明确文本错误仍是 prompt `:32` 的“第16项”。09 的问题不是“没有提前实现 Hopper 的请求项”，而是没有完整定义裁决前的 VoiceLoop fallback/unknown-reconcile/proof，并对依赖 Hopper 的能力漏标待裁决。

## 6. 06 报告 A-01～A-05 回归核对

> 严格按全套当前文件判定：**0/5 完全关闭**；A-01/A-04/A-05 部分关闭，A-02/A-03 未关闭。

| 06 编号 | 当前状态 | 【事实】与【judgement】 |
|---|---|---|
| A-01 直达验收安全语义在 Dispatch/Hopper 边界丢失 | **部分关闭** | 【事实】04/09 已写路径二 P0 仅 S0/S1、grant 必须为空，EffectGrant 也收窄并签摘要；但 project snapshot、外部幂等、完整 Binding 和 runtime intent 未闭合。【judgement】按本文 A-01/A-03 收尾。 |
| A-02 review first-wins 与 S3 收据不原子/不可认证 | **未关闭，但已诚实列入 prompt/ADR** | 【事实】ADR/v3 正确承认 Hopper 缺 first-wins；09 receipt 无 presentation/version/CAS，DDL 也未落实矩阵。【judgement】本地 reconcile 不能替代 Hopper 原子裁决。 |
| A-03 cancel+重 drop 无终结屏障 | **未关闭** | 【事实】09 新增理想 transition，但 §7 仍把 failed+cancelled 直接当 settled，且无 proof schema。【judgement】当前不能安全重 drop。 |
| A-04 ready_for_review 状态词回归 | **部分关闭** | 【事实】README/03/04/05/10 已正确；`docs/01:8,31,59`、`docs/02:34,45` 仍有“做完叫人/完成后叫”语境。【judgement】10 不再是回归源，但全库未统一。 |
| A-05 ADR 已定但仍写待拍板 | **点名文件关闭，全集残留** | 【事实】README/03/05 两行制已修；`docs/07:101` 仍说 owner 拍板后先出 ADR。【judgement】修时态即可完全关闭。 |

## 7. 06 报告 B/C 回归核对

| 06 编号 | 当前状态 | 核对结论 |
|---|---|---|
| B-01 模式正交与后端分流冲突 | **未关闭** | 04 vs 05/ADR 仍冲突，见 A-07 |
| B-02 Task/Attempt/遥测混用 | **未关闭** | 09/ADR 仍用不存在的 Hopper 状态，settle 又不绑 run |
| B-03 操作 current/target 与真实语义 | **部分关闭** | ADR 有总括标签；09/08 仍把目标态混进 current 表述 |
| B-04 prompt 缺错误码/CAS/重试/文件礼仪 | **主体关闭** | v3 第3/5/9项已补；只剩第16项交叉引用错误 |
| B-05 task↔project↔package/preflight | **请求层关闭，schema 未关闭** | v3 第1/2项完整；09 Binding/snapshot 仍不足 |
| B-06 localhost API/安全边界 | **请求层关闭** | v3 第12/13项准确；真正 stable surface 仍待 Hopper |
| B-07 M3b/M3c 映射 | **未关闭** | v3 已修；ADR/07/08 残留冲突 |
| B-08 canonical schema/引用 | **文件归属关闭，可实施性未关闭** | 09 成为 canonical；04 仍标 v0.9，09 自身有 A-01～A-06 |
| B-09 Demo settings route | **关闭** | 外部 `/settings` 已统一，`psettings` 仅内部 key |
| B-10 Demo Gate0/cancel/merge | **部分关闭** | Gate0 与 merge_failed 已补；Tier2 修订仍没画 requested→settled→new revision |

- **C-01 current/target matrix：部分关闭。** ADR 有总括，09 §7/08 仍混写。
- **C-02 测试数字锚定：ADR 指定位置关闭，其他文档残留。** ADR `:72` 已说提交快照/非本项目实测；03/05/07 仍有无时态“全绿/1076”。
- **C-03 run/attempt settlement：概念采纳、字段未落实。** 见 A-04。
- **C-04 成本条件语气：关闭。** `docs/04:97` 已明确“当前代表性用量组合/预计/非产品常量/以 usage trace 决策”；09 的 Money 接线仍按 B-03 修。

## 8. 过度设计裁决

| 项目 | 裁决 | 【judgement】 |
|---|---|---|
| immutable package/grant、Request/Receipt、dispatch journal | **P0 保留** | 不是过度设计；直接防所签非所做、重放和跨域串线，但要做小而完整 |
| run-bound settle、cancel proof、durable outbox/cursor | **P0 保留** | 是“回叫不早、改需求不并跑、重启可恢复”的最小正确性 |
| EffectGrant 只留 install/push | **已正确收窄** | v1.0-rc 的两类足够 coding P0；network_fetch 保留 P1 |
| project snapshot | **P0 最小版** | 只签 local coding repo identity/base/runner/trusted verify；remote registry 延后 |
| remote_repo/非 coding runtime | **reserved enum，执行 P2** | 不为 P0 背实现、迁移、测试义务 |
| s2s | **reserved，P2** | 当前标注正确 |
| consolidate/vector/backup adapter | **P1/P2** | 只清当前实际启用的 P0 stores；启用新 store 时必须注册删除传播 |
| Markdown 人工编辑 watcher | **P1** | v1.0-rc 变更说明称 edit=P1，但正文 `09:184` 未标；P0 保持账本单写入口 |
| 电话升级 | **P2** | 09 标 P1 与 05 的 SIP/远程回叫 P2 不一致；P0 在线语音+桌面+ntfy 足够 |
| S3 自建审批卡 | **P1，P0 只导航现有认证面** | 10 已正确吸收，不再是待整改项 |
| golden 全部做录音 | **已正确裁剪** | 10 已采用文本≥20 + 音频烟测5；只保留 ASR/barge-in/watermark 的音频证据 |
| 全部 Phase/Question/Artifact/Transcript 塞进 09 | **不扩张** | 09 应只持跨安全/恢复边界的最小 refs；其他实体由各自 canonical owner 管 |
| 每次 tool call 都口播 | **裁剪** | 只给超过首响阈值的用户可见等待口播 |

## 9. 关闭顺序与重新验收门槛

1. **先封授权根**：补全所有 digest/ID producer-verifier、package expiry/project snapshot、RuntimeEffectIntent、presentation 与 receipt 状态。
2. **再封跨域事务**：dispatch/command 的 unknown-reconcile、Hopper first-wins 边界、cancel proof、run-bound settle/outbox/cursor。
3. **让示例可执行**：SQLite migration、合法 TOML、TS↔DB round-trip、hard-forget crash-phase 恢复。
4. **修 Voice 安全路径**：E2-only runtime S2、barge-in presentation void、forget 两阶段话术、TTS redaction。
5. **owner 统一 capability matrix**：确定 Hopper step_confirm 的 P0/P1，随后同步 02/04/05/07/08/ADR/09/10/Demo。
6. **由 MUST traceability matrix 生成 gate**：每条红线都有 validator、正例、反例、崩溃相位与 owner 后，再称“P0 必须全绿”。

【judgement】战略主决策“复用 Hopper 现状、锁版本、不等待、双路径”无需推翻。09 的问题是合同闭包与 current/target 诚实性；10 的人格、普通话术和 S3 红线已经可用，但安全状态机不能只靠“关键确认要重述”这一句。
