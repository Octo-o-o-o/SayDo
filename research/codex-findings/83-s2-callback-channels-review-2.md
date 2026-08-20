# 83 · S2 批 评审 2(返工复核;Grok grok-4.6 xhigh 只读;Codex 配额耗尽回落)

> prompt:`prompts/83-s2-callback-channels-review-2.md`;session `01a01b7a-e644-7e90-aac6-92a7e45e0f63`;门禁由调度方沙箱外实跑(评审 2 前置修 DAO 封顶后 `just ci` EXIT=0)。

先读评审 skill 与必读材料，再对照返工 diff 与源码核验 A1/A2、B1–B9 和回归点。评审 1 与规格已对齐。接下来读返工 patch、回叫实现和测试全文。patch 前半已读完。继续读剩余 diff 与必读源码。继续核对 `hasUserTurnInFlight` 生命周期、sweep 接线、状态机和全部新测试。接下来把 `userTurnInFlight` 的置位/清位、sweep 注册段和测试全文对上。还要核 `userTurnInFlight` 的其它入口、仲裁、`deliveryPreflight`、以及 B 项对应的 console/文档现状。再核对测试、文档、`apiErrorMessage` 和冻结接线，确认有没有漏网回归。再核 Layout 轮询尾部、ack 接线、`callback.test.ts` 的 DND 改写，以及 B2「按候选 session 判 busy」是否真落地。`MIN(escalation)` 的 grep 和刚才读到的源码不一致，我再核对这一行。`outbox.ts` 的 escalation 上限前后两次读数不一致，正在重新取证。再对一下 `outbox.ts` 全文里的 cap，以及 `mobileLan` 对 ack 路由的白名单。核对过源码、返工 patch、评审 1 与规格。门禁与 `git log` 本会话未跑（调度方范围）。commit hash 来自用户说明与 evidence 自述，未用本机 `git log` 复核。

---

# 83 · S2 批评审 2（返工复核；零上下文只读）

对照：`research/codex-findings/81-s2-callback-channels-review.md` × `.tmp/rework-diff.patch`（自称 `ce7e7a7..HEAD`：`8ec247e` / `93eb814` / `52c10d5`）× `docs/plan/IMPL-PROMPT-13-S2-CALLBACK-CHANNELS.md`。只读。未跑门禁、未跑 `git log`。

**总评：[ok] 可并入。** A1 / A2 生产路径已按评审 1 修法落地，不再出现「开口后整链静默」或「acked 超时先写成 notified 再失叫」。B1–B9 主体到位，残差是 B/C，不构成回叫丢失。

---

## ① A1 / A2 是否真正修复

### A1 · `voiceBusy`：[ok] 已修

**生产判据**（`packages/daemon/src/index.ts:3459-3463`）：

```
row?.state === "talking" && liveDialog.hasUserTurnInFlight(sessionId)
```

不再读 `liveSessions.hasCurrentUserTurn`。`hasCurrentUserTurn` 全仓生产路径已无调用（只剩 `voiceSessions.ts:182` 定义与 `callback-voice-busy.test.ts:79` 对照断言）。

**`userTurnInFlight` 生命周期**（`packages/daemon/src/live/dialog.ts`）：

| 时刻 | 动作 | 证据 |
|---|---|---|
| 初值 | `controlState()` 建态时 `false` | `:231` |
| 置 true | `onAsrFinal` 在 `++userTurnGeneration`、挂 `AbortController` 之后、`runUserTurn` 之前 | `:578-581` |
| 置 false | `onAsrFinal` 的 `finally`：仅当 `userTurnGeneration` 与 `activeUserTurnController` 仍是本轮 | `:590-596` |
| 置 false | `onBargeIn`：先 `generation++`、删 controller，再清标志，并 `speechPending=true` | `:554-557` |
| 置 false | `retireSession`（挂起/关闭） | `:257-262` |
| 读取 | `hasUserTurnInFlight` = `controlBySession.get(sid)?.userTurnInFlight === true`；无条目 ⇒ `false` | `:211-213` |

ASR 与 `turn.text` 都进同一 `onAsrFinal`（`index.ts:2874` / `:2916`）。hold-for-confirm / 空 final 只走 `settlePendingSpeech`，不置 inFlight（`:2857` / `:2866`），语义正确。

**「永久 busy」：** 只有 `runUserTurn` 真挂死、且未被 barge-in / retire / abort 打断时，标志会一直为 true。那是「轮次确实在途」，不是评审 1 的假阳性。`onAsrFinal` 的 `finally` 在 throw 时也会跑；世代不匹配时由**新一轮**持有标志，旧 `finally` 不会误清。

**「永不 busy」：** 该 session 从未进 `onAsrFinal`（`controlBySession` 无条目）时为 false，正确。barge-in 到下一条 `asr.final` 之间有一段 `userTurnInFlight=false`（用户还在说、Brain 轮未开始），L0 可能插播，窗口短，见文末 C。

**busy 时其余条目走 L1：** `sweep.ts:201-204`：`result.action === "queue" || headBusy` 时只 `queued += 1`，`voiceReady.slice(1)` 进 `noVoice` → `deliverL1`。头一条保持 `pending`，不吞整链。单测 `callback-sweep.test.ts:227-238`：blocked 仍 `pending`，ready_for_review 变 `notified(1)` 且有桌面调用。

生产向测 `callback-voice-busy.test.ts:58-133`：`await onAsrFinal` 后 `hasCurrentUserTurn===true` 且 `hasUserTurnInFlight===false`，sweep 仍 `say` 一次、`notified(0)`。钉住的是评审 1 的假阳性，不是「在途中必须 queue」（后者用 stub `voiceBusy:true` 覆盖）。

**残差（不升 A）：** `voiceBusy` 仍只问 `voiceReady[0]` 的 session（`sweep.ts:195-196`）。evidence 写「busy 问候选 session」过满。跨项目时 head busy 会把本可 L0 的其它 session 条目降 L1，但仍有桌面/ntfy，不是静默。见 B2。

### A2 · `escalateIfStale`：[ok] 已修

**只到 `requeued`：** `engine.ts:184-191` 只 `transitionOutbox(..., "requeued")`，**不再** `transitionOutbox(..., "notified", { escalationDelta: 1 })`。`toLevel` 只作返回值，不写库。`callback.test.ts:112-116` 断言超时后 `state==='requeued'` 且 `escalationLevel===0`。

**投递成功才 `notified`：** 非 DND 路径 `loadDue(..., "requeued")` → `pushL1` → `deliverL1`；成功才 `attemptNotify`（`sweep.ts:298-299`）。`canTransitionOutbox("requeued","notified")` 合法（`packages/contracts/src/statemachines/outbox.ts:10`）。同轮先 `escalateAcked()` 再 `loadDue`，刚升上去的 id 本轮就能 L1（`callback-ack.test.ts:239-244`）。

**DND 内 requeued 与 pending 同一套：** `deliverDnd`（`sweep.ts:248-265`）对两种 state 都做 priority 2 ntfy + `snooze`。`snooze` SQL 已改为 `state IN ('pending','requeued')`（`engine.ts:142`）。DND 判定在 `escalateAcked` **之后**，acked 先变成 requeued 再进 DND 队列。测：`callback-ack.test.ts:247-290`（超时 + DND 仍 `requeued`、ntfy priority 2）；`callback-sweep.test.ts:349-363`（两种 state 各 snooze 一次、不改 state、无桌面）。

**L1 双失败保持可重投：** `deliverL1` 双失败直接 `return`，不 `attemptNotify`（`sweep.ts:288-294`）。`callback-ack.test.ts:293-335`：第一轮仍 `requeued`，桩改成功后第二轮 `notified` 且 level 1。

DND 下去重仍只靠 `snoozed_until`；审计 `callback.dnd_pushed` 只留痕（`sweep.ts:257`），与评审 1 修法 / 现 `docs/09:643` 一致。

---

## ② B1–B9 处置

| 条 | 裁决 | 证据 |
|---|---|---|
| B1 escalation 上限 1 | [ok] 生产路径到位；DAO 封顶与自述有分叉，见下方 B | sweep `ESCALATION_CAP=1`（`sweep.ts:16,297`）；`bumpUnackedToL1` cap=1（`engine.ts:152`）；`escalateIfStale` 不再加 level。测 `callback-ack.test.ts:338-359`。**末次读盘** `outbox.ts:73` 仍是 `MIN(..., 2)`，与 patch/evidence/docs/09「transitionOutbox MIN 1」不一致（本会话对该行先后读到 1 与 2，以末次 Read + grep 为准）。生产 sweep 对已是 1 的条目传 `delta=0`，不会从 sweep 升到 2；测试「ack 两次超时」是直调 `attemptNotify({escalationDelta:1})`，若 HEAD 也是 MIN 2 该测应红。调度方须 `git show HEAD:.../outbox.ts` 核对。 |
| B2 peer 排序 | [ok] 排序已修；[warn] busy 仍只问 head | `pickConsolePeerForTask` talking 优先、`started_at` 新到旧（`sweep.ts:121-135`）；生产 SQL 取 `id,state,started_at`（`index.ts:3452-3456`）。测 `callback-sweep.test.ts:383-393` 选中 `ses_talk2`。未按心跳排。`voiceBusy` 仍只问 `head.sessionId`（见上）。 |
| B3 DND 收口 | [ok] 按评审 1 建议，不按 IMPL 原文红线 | 选路在 sweep；`attemptNotify` 不再收 `dndWindow`、不做窗口 snooze（`engine.ts:120-135`）。`deliveryPreflight` 仍保留 DND 分支，但生产不传 `dndWindow`，不会双判。`callback.test.ts:100-116` 已改成 `engine.snooze` + 「只到 requeued」。 |
| B4 桌面转义 / error | [ok] 主体到位 | 先 `truncateForOsa` 再 `escapeOsa`（`desktop.ts:30-35`）。`child.on?.("error")` ⇒ `false`（`:49`）。测：引号/反斜杠、截断边界、error⇒false、无 error⇒true（`callback-desktop.test.ts` 全文）。残差：`setTimeout(0)` 仍把「spawn 未立刻抛」当成功，不等退出码。 |
| B5 say 不算气泡 | [ok] | L0 `deps.voice.say` 只 `voiceHub.sendTtsSay`（`index.ts:3465-3473`）。`sendTtsSay` 无 pipeline peer 返回 false（`hub.ts:827-834`）→ sweep 把该条推进 L1。`sendConsoleSay` 只在 TTS 不健康旁路（`sweep.ts:186-189`）。 |
| B6 request_changes / reject | [ok] | 测 `callback-ack.test.ts:151-178`。生产：`operations.ts:369`（request_changes 冻 `ready_for_review`）、`:391`（reject 冻全部活跃）。 |
| B7 最坏约 45s | [ok] 已写入 canonical | `docs/04:124`、evidence §7。实现仍是 15s 节拍上判 `notified_at+30s`。所谓「提前到每轮开头」只是先 `loadL0Timeouts`，DND 分支并不处理这批，最坏时延未变。 |
| B8 轮询 / ack 可见失败 | [ok] 主体到位 | `Layout.tsx:315-325`：attention/outbox 10s，focus/spaces 30s。`Notify.tsx` 失败走 `apiErrorMessage` + `data-ack-error`。测 spy `api.ackOutbox`（`Notify.test.tsx:55-65`）。残差：测的是 `requestOutboxAck` 直调，不是点 `Notify()` 按钮；Notify 页本身仍不轮询。 |
| B9 evidence / 09 对齐 | [ok] 大部对齐；[warn] 一条过满 | `docs/09:635-643`：上限 1、requeued 投递前不写 notified、L0 bump 不改 `notifiedAt`、DND 去重靠 snooze。`docs/04:124` 已改「currentUserTurn 不算 busy」、会议占麦是目标语义。evidence 写「busy 问候选 session」与代码不符。 |

---

## ③ 回归点

| 点 | 裁决 |
|---|---|
| `canTransitionOutbox` 被绕过？ | [ok] 无新增绕过。`transitionOutbox` 仍先查合同机（`outbox.ts:67-68`）。`acked→requeued`、`requeued→notified`、`pending→notified` 均合法。L0 升 L1 仍用 `bumpOutboxEscalation`（同态改字段，09 已写明不是状态转换）。`snooze` 只改 `snoozed_until`。`resolveActiveEntriesForTask` 直接 UPDATE 到 resolved 是冻结旧路径，本批未新开。 |
| `escalation` 上限 1 | [ok] 生产 sweep / bump / escalateIfStale 不会写到 2。DAO `MIN(...,2)` 与文档分叉见 B1，不造成 L2 电话（L2 未接）。 |
| `pickConsolePeerForTask` | [ok] talking 优先，其次 `started_at` 降序。测例：`ses_talk2`（talking, 11:00）压过更早 talking 与更新的 suspended。 |
| desktop 转义 / error | [ok] 先截断再转义，不再切断 `\"` / `\\`。error 事件可返回 false。仍不等 osascript 退出码。 |
| console 轮询 | [ok] 拆成两个 interval，无把 focuses/spaces 绑在 10s 上。`focus.entity` / 路由变化仍走 `loadSide()` 全量刷（`Layout.tsx:331-338`）。 |

未发现「成功投递前写 notified」「busy 吞整链」「L0 把 `sendConsoleSay` 算成功」类回归。

---

## 分级发现（本轮新/残留）

### A 级

无。评审 1 的 A1 / A2 在当前源码里对得上修法，且有对应单测。

### B 级

**B-r1 · `transitionOutbox` 封顶与自述不一致（B1 残差）**

末次读盘 `packages/daemon/src/storage/dao/outbox.ts:73`：

```
escalation = MIN(escalation + @escalationDelta, 2)
```

返工 patch、`docs/09:635`、evidence §7 都写 MIN 1。生产 sweep 因 `delta = escalation >= 1 ? 0 : 1` 不会从这条 SQL 升到 2；直调 `attemptNotify({escalationDelta:1})` 会。调度方并入前核 HEAD：若 HEAD 已是 1，则只是工作区脏；若 HEAD 也是 2，把 DAO 改回 1，否则「ack 两次超时仍为 1」与 canonical 都不成立。

**B-r2 · `voiceBusy` 仍只问 head session（B2 未做完）**

`sweep.ts:195-204` 只调用 `voiceBusy(head.sessionId)`。evidence「busy 问候选 session」不实。同项目通常同 session，无害；多项目同轮时，head busy 会把其它已就绪 session 的条目直接 L1。用户仍会被叫到，只是少一次 L0。

### C 级

- barge-in → 下一条 `asr.final` 之间 `userTurnInFlight=false`，L0 可能压过用户尚未成轮的开口。
- `notifyMacDesktop` 用 `setTimeout(0)` 默认 true，测里 error 走 `queueMicrotask` 避开了与 timer 的竞态；生产 ENOENT 多半 nextTick 先于 timer，仍不听 exit。
- `voiceSessions.ts:181` 注释仍写 `hasCurrentUserTurn` 供 sweep voiceBusy，已过时。
- Notify 测未经过 `Notify()` 的按钮 → `onAck` 全路径；Notify 页仍不轮询。
- `docs/04` 同节仍有「会议软件占麦则降级」目标句，注记已标明 S2 未接。
- `ESC_ICON[0]` 仍是 Phone（评审 1 C，本批未动）。
- L0 `origin` 仍是 `system`（已知可接受偏离）。

---

## 对评审 1 返工清单

| 最小集 | 本轮 |
|---|---|
| 重写 `voiceBusy`，busy 不得吞 L1；补「已开口仍能叫人」测 | [ok] |
| `escalateIfStale` 只到 `requeued`；DND 覆盖 requeued；L1 双失败可重投 | [ok] |
| 顺手 B1 封顶 1 | [warn] 生产路径有 cap；DAO MIN 与自述可能分叉，须核 HEAD |
| 顺手 B5 `say` 不算气泡 | [ok] |

---

## 总评

**可并入。** A1 / A2 已从「回叫丢失」变成「在途轮只挡住当前最高优先一条、超时只停在 requeued、投递成功才 notified」。这是评审 1 要求的两条主链。

并入前调度方只需做一件本会话做不了的事：核对 `HEAD` 上 `outbox.ts` 的 `MIN(escalation + @escalationDelta, ?)`。若是 2，改回 1 再并（与已写进 09 / evidence / 「ack 两次超时」测一致）。其余 B/C 可另开，不挡 S2。

门禁、SHA、`55 passed` 以沙箱外实跑为准，不抄 evidence。