# SayDo S2 批（回叫通道：分级选路 / L0 语音 / L1 桌面 + ntfy / DND 只推不响 / ack·resolve·冻结）· 实施 Prompt（第十三轮交接）

> 方案源：`docs/plan/2026-08-20-seven-steps-gap-closure.fable.md` §0/§3（裁决 D-S2-1…D-S2-6）。背景：官网七步第 6 步承诺"升级链 语音回叫 → 桌面通知 + 手机推送"，而代码只有 ntfy 真投递：sweep 不看 `escalation`、不仲裁；L0 语音未接；桌面通知零代码；`escalateIfStale/ack/resolve` 零调用方（条目永停 `notified`）；DND 双判且窗口内什么都不发（canonical 要求"只推送不出声"）。
> 性质：接线为主（`callback/` 域 + `index.ts` sweep 重写 + 一个 ack 端点 + console 小改），零 DDL（`escalation/acked_at/resolved_at/snoozed_until` 列都在），零 contracts 形状变更；canonical 随批补录（`docs/04 §4` 对"桌面通知已接"与 `micHeldByMeeting` 恒 false 的如实注记；`docs/11 §6` 通知文案沿用）。
> 纪律：两提交法；evidence `e2e/evidence/s2-callback-channels.md`；零 emoji；不部署常驻、不 push、不改 `~/.saydo`；**测试与单测不得真的弹 macOS 通知或真的 POST ntfy**（全部注入 spawn/fetch 桩）；施工 = 独立 clone 分支 `batch/s2-callback-channels`；实施 = Grok 4.6 headless，评估 = 零上下文只读会话。本批**不写 HANDOFF 指针**（W5.4-a 占用）。

---

你接手 **SayDo S2 批**。代码仓 = 当前目录（独立 clone，分支 `batch/s2-callback-channels`，基线 `354b028`）。完成判定 = §3 各项验收锚全绿 + evidence + §5 对账表。

## 0. 坐标核验

| 命令 | 期望 |
|---|---|
| `git log --oneline -1` | `354b028` |
| `rg -n "ESCALATION_CHANNELS\|escalateIfStale\|attemptNotify\|freezeForTask" packages/daemon/src/callback/engine.ts` | `:46-50` / `:144-153` / `:116-136` / `:161-165` |
| `rg -n "ESCALATION_CHANNELS\|escalateIfStale\|callbackEngine.ack\|callbackEngine.resolve" packages/daemon/src --glob '!callback/engine.ts'` | 零命中（= 零生产调用方，本批要接） |
| `rg -n "ntfySweepBusy\|ntfyTarget\|postNtfy\|renderNtfyMessage" packages/daemon/src/index.ts` | sweep 段约 `:3393-3444` |
| `rg -n "export function arbitrate\|reconnectFirstLine\|PRIORITY" packages/daemon/src/callback/arbitration.ts` | `:41-55` / `:58-73` / `:7-15` |
| `rg -n "const say = \|sendTtsSay\|sendConsoleSay\|hasConsolePeerForSession\|pipelineAvailable" packages/daemon/src/index.ts packages/daemon/src/voice/hub.ts` | index `:2260-2273`；hub `:810-847` / `:863-868` / `:732-740` / `:297` |
| `rg -n "inDndWindow\|deliveryPreflight" packages/daemon/src/recovery/reconciler.ts packages/daemon/src/callback/engine.ts packages/daemon/src/index.ts` | 双判位置（reconciler `:102-115`；engine `:120`；index `:3421`） |
| `rg -n "osascript" packages/daemon/src` | 零命中 |
| `rg -n "canTransitionOutbox" packages/contracts/src/types/outbox.ts packages/daemon/src/storage/dao/outbox.ts` | 合同与 DAO 消费点 |
| `rg -n "setInterval\(.*30_000" packages/console/src/shell/Layout.tsx` | `:304` 附近（轮询 30s） |
| `pnpm --filter @saydo/daemon exec vitest run test/callback.test.ts test/t2-thin.test.ts` | 全绿（记基线用例数） |

## 1. 必读

1. `AGENTS.md`、`HANDOFF.md` §0/§4/§5。
2. 方案 §3；`docs/04-key-mechanisms.md:104-126`（§4 回叫策略：状态词、优先级、升级链、PagerDuty 语义、拦截≠叫人、仲裁）；`docs/09-data-contracts.md:620-646`（§6.3 outbox 与 settle barrier；`escalationLevel 0|1|2`、`ackedAt`、requeued 唯一语义、冻结口径、至少一次）；`docs/10-voice-ux-spec.md:97-118`（§2.4 回叫话术 #29–#31、#41）与 `:136`（规则 5 第一句必须是回叫原因）、`:145`（结果句式只能由回叫链播）；`docs/11-ui-spec.md:516-520`（§6 通知文案）。
3. 代码：`packages/daemon/src/callback/{engine,ntfy,arbitration}.ts` 全文；`index.ts:3380-3450`（sweep）、`:2255-2295`（`say`/记账闭包）、`:2920-2965`（pipeline 健康 / console 心跳消费）；`voice/hub.ts:700-870`；`recovery/reconciler.ts:95-120`；`storage/dao/outbox.ts`；`packages/contracts/src/types/outbox.ts`；`tier1/operations.ts:248-300`（reviewTask）、`:551-606`（retry）、`:217-228`（cancel）；`live/scheduler.ts:82-150`；`live/dialog.ts` 用户轮入口（找"用户轮开始"的位置以挂 ack）；`voice/redactor.ts`（`redactText`）；console：`shell/Layout.tsx:280-310,700-760`、`pages/Notify.tsx`、`lib/api.ts`。
4. 测试：`packages/daemon/test/callback.test.ts`（纯单元）、`t2-thin.test.ts:291-346`（ntfy 渲染）、触及 outbox 的 `tier1-operations` / `park-scheduler` / `tier1-story-e2e`。

## 2. 红线

- **L0 语音直发走 `say()` 闭包，不经 dialog 出句管线**（避免结果句式闸 `dialog.ts:997-1001` 误拦 #29 "执行和检查都跑完了"）；origin 标 `callback`；TTS 字符照记账。
- 回叫第一句 = `reconnectFirstLine(trigger, title)`（原因先行，不寒暄）；标题/正文过 `redactText`；通知不带 capability token；深链只带路由。
- `escalation` 上限 1（level 2 电话不实现，注释如实）；`micHeldByMeeting` 恒 `false` 且注释"无数据源"；不新增 WS 事件类型；不改 DDL、不改 contracts 形状。
- DND 判定收口到 `engine.attemptNotify`（`deliveryPreflight`）一处；sweep 不再自己判。
- 单测禁止真 spawn `osascript`、真 `fetch` ntfy：`desktop` 与 `ntfy` 投递函数都经注入（`deps.spawnDetached` / `deps.postNtfy`），测试用桩。
- 零 emoji；状态词纪律；不 push。

## 3. 任务清单

### 3.1 A · sweep 抽出为纯调度函数 + 分级选路 + DND 只推不响（提交 `feat(callback): 回叫 sweep 分级选路（L0 语音 / L1 桌面+ntfy）与 DND 只推不响`）

- 新文件 `packages/daemon/src/callback/sweep.ts`：`runCallbackSweep(deps, now): Promise<SweepReport>`。`deps` = `{ db, engine, arbitrate, voice: { consolePeerForTask(taskId)→sessionId|null, ttsHealthy()→boolean, voiceBusy(sessionId)→boolean, say(sessionId, text, origin:"callback")→Promise<boolean>, consoleSay(sessionId,text) }, desktop: { notify({title,body})→Promise<boolean> }, ntfy: { enabled, post(msg)→Promise<boolean>, render }, dnd: { inWindow(now)→boolean, windowEnd(now)→iso|null }, log, audit }`。逻辑：
  1. 取 `pending`（未 snooze）按 `arbitration.PRIORITY` 再 `created_at` 排序，上限 5；取 `requeued` 同法（视为 level 1 重投）。
  2. DND 窗口内：对 pending 条目只发 **一次**低优先级 ntfy（priority 2，正文前缀「（免打扰时段）」），落 `snoozed_until=窗口末`、`meta.dnd_pushed=1`（`settle_json` 或新 meta 字段不可用时用审计 `callback.dnd_pushed` 去重），状态保持 `pending`；不发桌面、不语音。
  3. 非 DND：`escalation===0`（首投）：若 `consolePeerForTask` 有会话且 `ttsHealthy()` 且 `!voiceBusy` ⇒ 经 `arbitrate` 取最高优先一条 `say(reconnectFirstLine + 可选 one_liner)`；成功 ⇒ `attemptNotify(channelReachable:true)`（`notified`，escalation 0）+ 审计 `callback.voice_sent{entryId,sessionId}` + 记录 `notified_at`；其余同轮条目按 `arbitrate` 结果 `queue`（下轮）或 `downgrade_notify`（走 L1）。
  4. L1（`escalation===1` 的 `notified` 超 30s 未 ack 的 L0 条目 / 无语音条件的 pending / `requeued`）：桌面通知（`desktop.notify`，title `SayDo · {项目名}`，body = `renderNtfyMessage(...).body`）+ ntfy（现状）；任一成功 ⇒ `attemptNotify` 置 `notified` 且 `escalation=1`（从 0 升级时用 `transitionOutbox(..., escalationDelta:1)`，**先确认 `canTransitionOutbox` 允许 `notified→notified`；若不允许，用 `notified→requeued→notified` 两步，并在 evidence 说明**）；全失败 ⇒ 留 pending/requeued + 首败告警去重。
  5. L0 应答窗：`notified` 且 `escalation=0` 且 `notified_at + 30s < now` 且未 ack ⇒ 升 L1（步 4）。
- `index.ts`：删除旧 sweep 体，改为每 15s `runCallbackSweep(deps, now)`；`desktop.notify` 实现 = `nodeSpawn("osascript", ["-e", 'display notification "<body>" with title "<title>"'], {stdio:"ignore", detached:true}).unref()`（body/title 经 `redactText` + 转义引号；失败 ⇒ false + warn 一次）；`voice.*` 用 `hasConsolePeerForSession` / `pipelineRuntimeState.tts==="ok"` / 会话 `talking` 且有在途用户轮 ⇒ busy / `say` 闭包。
- **锚**：新 `packages/daemon/test/callback-sweep.test.ts` ≥ 12（内存 DB + 桩）：L0 条件满足 ⇒ say 一次 + notified(0)；无 peer ⇒ 直接 L1 两通道；TTS 不健康 ⇒ L1；voiceBusy ⇒ queue 不发；优先级 blocked 先于 ready_for_review；L0 30s 未 ack ⇒ 升 L1；DND ⇒ 仅 ntfy 低优先级一次 + snooze，再次 sweep 不重复发；DND 结束 ⇒ 正常链；桌面失败 ntfy 成功 ⇒ notified；两者都失败 ⇒ 仍 pending + 单次告警；requeued ⇒ L1 重投；`escalation` 不超过 1。`callback.test.ts` 既有零改动。

### 3.2 B · ack / resolve / 冻结接线（提交 `feat(callback): ack 端点与用户轮隐式 ack；任务终局 resolve/冻结；resolution-timeout 重升级`）

- `index.ts`：`POST /api/outbox/:id/ack`（`via` local/tailnet；mobile_lan 403）→ `engine.ack`；sweep 每轮先 `engine.escalateIfStale(now)`（`acked` 超 `callback_resolution_timeout_min` ⇒ `requeued`）。
- 隐式 ack：用户轮开始（`live/dialog.ts` 用户轮入口）时，对该 session 关联项目的 `notified(escalation 0)` 条目调 `engine.ack`（只 ack L0 语音回叫过的条目；按 `settle_json.taskId → task.projectId → session.projectId` 关联）。
- resolve/冻结：`tier1/operations.ts` `reviewTask`（approve/request_changes/reject）与 `cancel`、`retry`（blocked→running/queued）调用 `engine.resolve(entryId)` 或 `engine.freezeForTask(taskId)`（按 09 §6.3：离开 `ready_for_review` / 取消 ⇒ `resolved(superseded)`；blocked 被消解 ⇒ resolved）。
- console：`pages/Notify.tsx` 每条加「知道了」（调用 ack 端点；已 ack/resolved 不显示）；`lib/api.ts` 加 `ackOutbox(id)`；`shell/Layout.tsx` outbox/attention 轮询 30s → 10s。
- **锚**：daemon 测试 ≥ 6（ack 端点 200/mobile_lan 403；隐式 ack 只作用于 L0 条目；approve ⇒ resolved；cancel ⇒ freeze；retry 消解 blocked ⇒ resolved；acked 超时 ⇒ requeued ⇒ sweep L1 重投）；console 单测 ≥ 1（按钮存在且调用 api）。

### 3.3 C · canonical 补录 + evidence（提交 `docs(canonical): 04 §4 回叫链现状注记` 与 `chore(evidence): s2-callback-channels`）

- `docs/04-key-mechanisms.md:118-126`：升级链段后加注（2026-08-20 S2）：L0 条件三要素（console 在线 ∧ pipeline TTS 健康 ∧ 不忙）、无语音条件直接 L1、桌面通知 = macOS 通知中心（osascript）、DND 窗口内只推低优先级 ntfy、`micHeldByMeeting` 无数据源恒 false、电话 L2 未做。`docs/09 §6.3 :641` 补"desktop 通道已接、escalation 上限 1"。一致性评审由调度方跑。
- evidence：坐标、提交 SHA、门禁、用例数前后、未做清单（L2 电话；`micHeldByMeeting`；console 无 WS 推送只 10s 轮询；DND 期间推送去重靠审计/meta）。

## 4. 检查点

1. `canTransitionOutbox` 若不允许同状态重入且不允许 `notified→requeued` 手工路径 ⇒ 停并汇报（可能要改 contracts 状态机 = canonical）。
2. 若 `settle_json` 无法承载 `dnd_pushed` 且审计去重不可行 ⇒ 汇报备选（新增 `callback_outbox.meta_json` 列属 DDL 变更，需停）。
3. `say()` 闭包签名不支持 origin ⇒ 可加可选参数（不改既有调用）；若必须改 dialog 出句管线 ⇒ 停。

## 5. 诚实汇报

对账表（完成 / 部分 / 未做 + 真实 commit hash + `cmd; echo EXIT=$?` + 用例数前后）；真机弹通知与真 ntfy 投递属调度方/owner 触点，本批不做。
