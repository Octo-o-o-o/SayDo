# 81 · S2 批(回叫通道)code review(Grok grok-4.6 xhigh 只读;Codex 配额耗尽回落)

> prompt:`prompts/81-s2-callback-channels-review.md`;session `01a01b59-8076-77b1-8d9a-c33351757d3d`;门禁由调度方沙箱外实跑:`just ci` EXIT=0(contracts 103 / cli 19 / console 254 / daemon 1518|4 / python 33)。

先读评审 skill 与规格文档，再对照 patch 和实现源码做只读对账。规格已读完。接着拉 patch、提交记录和回叫通道实现，逐项对 A/B/C 红线。patch 很长，接着把回叫通道源码、合同和测试全读一遍。继续读 `index.ts` 接线、outbox DAO、dialog 出句闸和测试。关键接线还没看完：`say` 闭包、出句闸、outbox 状态机、mobile_lan 白名单和测试桩。重点核对脱敏、`say`/`sendTtsSay`、DND 双判、以及 osascript 转义。接着核身份门、冻结接线、`say` 记账，以及 osascript / DND 边角。核对完 `voiceBusy` 的真实语义：`currentUserTurn` 只在挂起时清空，开口一次就会把 L0/L1 一起卡住。下面按 A/B/C 出报告。

# S2 回叫通道 · 对抗 code review

对照：`.tmp/batch-diff.patch`（自称 `33c5cf1..HEAD`：`dedd327` / `37b349a` / `63600c6` / `ce7e7a7`）× `docs/plan/IMPL-PROMPT-13-S2-CALLBACK-CHANNELS.md` × `docs/plan/2026-08-20-seven-steps-gap-closure.fable.md` §3。只读，未跑门禁、未跑 `git log`。commit hash / 用例数以 evidence 自述为准，本会话未复核。

**总评：[fail] 需返工。** 至少两条 A 会在「控制台在线」和「ack 后再升级」两条主链上把回叫吃掉：用户听不到、也收不到桌面/ntfy，条目却离开 `pending` 或永远停在 `pending`。未构成问题的 A 项核对放在文末，不抵消返工。

---

## A 级

### A1 · `voiceBusy` 把「上一轮用户句还在内存」当成「在途用户轮」——开口一次后 L0/L1 双死

**问题：** 生产 `voiceBusy` 是 `sessions.state==='talking' ∧ liveSessions.hasCurrentUserTurn(sessionId)`。`currentUserTurn` 在 `onUserTurn` 写入后，只在 `suspend` 里清空，用户轮结束不清。console 开着、人说过一句话（正常在线态）之后，该 session 会一直 busy。sweep 对 `voiceReady` 走 `arbitrate` 的 `queue` 分支：不 `say`、不降 L1、状态保持 `pending`。15s 一轮空转，直到会话挂起。

这直接打穿 D-S2-1「console 在线 → L0」和「不满足三要素 → 直接 L1」。IMPL 锚写 `voiceBusy ⇒ queue 不发`，测试只桩了 `voiceBusy: true`，没有钉生产判据。

**证据：**

```3461:3465:packages/daemon/src/index.ts
            voiceBusy: (sessionId) => {
              const row = db.prepare("SELECT state FROM sessions WHERE id=?").get(sessionId) as
                | { state: string }
                | undefined;
              return row?.state === "talking" && liveSessions.hasCurrentUserTurn(sessionId);
            },
```

```153:157:packages/daemon/src/live/voiceSessions.ts
  onUserTurn(sessionId: string, turnId: string, text: string, opts: { excludeFromHistory?: boolean } = {}): void {
    this.settlePendingAi(sessionId);
    const st = this.state(sessionId);
    st.currentUserTurn = { turnId, text };
```

```181:184:packages/daemon/src/live/voiceSessions.ts
  hasCurrentUserTurn(sessionId: string): boolean {
    return this.live.get(sessionId)?.currentUserTurn != null;
  }
```

```349:357:packages/daemon/src/live/voiceSessions.ts
  suspend(sessionId: string, reason: "idle" | "explicit" = "idle"): void {
    // ...
    if (st) st.currentUserTurn = null;
```

```190:220:packages/daemon/src/callback/sweep.ts
    const result = deps.arbitrate(
      voiceReady.map((v) => ({ entryId: v.row.id, trigger: v.row.trigger, createdAt: v.row.created_at })),
      { voiceBusy: deps.voice.voiceBusy(top.sessionId), micHeldByMeeting: false }
    );
    // ...
    } else if (result.action === "queue") {
      report.queued += 1;
    }
```

`currentUserTurn` 全文件只有：写入 `onUserTurn`、读取 `findUserTurn`/`hasCurrentUserTurn`、清空 `suspend`、初始化 `null`。没有「轮次结束」清空。

**修法：**

1. `voiceBusy` 只认真正在途的用户轮（例如 `userTurnInFlight` / `activeUserTurnController`），不要用「上一句用户还挂在 live state」。
2. 即便 busy，也必须按 D-S2-1 降 L1（或只把「当前正在播的那一条」queue，其余 L1）。`queue` 不得吞掉整条升级链。
3. 补生产向单测：先 `onUserTurn` 再 sweep，断言不能整链静默。

---

### A2 · `escalateIfStale` 先把 `acked` 写成 `notified`，DND 直接 return / L1 失败都不重试——「接了又睡」永久失叫

**问题：** 每轮 sweep 无条件先跑 `escalateAckedIfStale()`。它在投递之前就做 `acked → requeued → notified` 且 `escalation+1`。随后：

- DND 窗口：`deliverDnd` 只扫 `pending`，然后 `return`。刚升上去的 `notified` 既不发低优先级 ntfy，也不 snooze。窗口结束后，sweep 只认 `pending` / `requeued` / `notified∧escalation=0`，这条 `notified(≥1)` 再也进不了队列。
- 非 DND：`deliverL1` 桌面+ntfy 都失败时 `return`，条目已经是 `notified`，同样不会再投。

09 §6.3 是至少一次；PagerDuty 语义是 resolution-timeout 必须重新叫人。现在是「状态假装叫过了」。

**证据：**

```162:166:packages/daemon/src/callback/sweep.ts
  const justEscalated = deps.escalateAcked ? deps.escalateAcked() : [];

  if (deps.dnd.inWindow(now)) {
    await deliverDnd(deps, now, nowIso, report);
    return report;
```

```177:186:packages/daemon/src/callback/engine.ts
  escalateIfStale(entryId: string, ackedAtIso: string): { escalated: boolean; toLevel?: 1 | 2 } {
    // ...
    transitionOutbox(this.db, entryId, "requeued", nowIso);
    const row = this.db.prepare("SELECT escalation FROM callback_outbox WHERE id=?").get(entryId) as { escalation: number };
    const toLevel = Math.min(row.escalation + 1, 2) as 1 | 2;
    transitionOutbox(this.db, entryId, "notified", nowIso, { escalationDelta: 1 });
    return { escalated: true, toLevel };
  }
```

```242:245:packages/daemon/src/callback/sweep.ts
async function deliverDnd(...): Promise<void> {
  const until = deps.dnd.windowEnd(now);
  const pending = loadDue(deps.db, nowIso, "pending");
```

```284:297:packages/daemon/src/callback/sweep.ts
  if (!desktopOk && !ntfyOk) {
    if (!deps.l1FailWarned.has(row.id)) {
      deps.l1FailWarned.add(row.id);
      deps.log.warn("callback L1 delivery failed; entry stays for retry", { entryId: row.id, state: row.state });
      report.alerts += 1;
    }
    return;
  }
  // ...
  } else if (row.state === "notified" && row.escalation === 0) {
    deps.engine.bumpUnackedToL1(row.id);
  }
```

`callback-ack.test.ts` 的超时用例把 desktop/ntfy 桩成成功，且 `inDnd: false`，两条失叫路径都没钉住。

**修法：**

1. `escalateIfStale` 只走到 `requeued`（合同允许 `acked→requeued`），**禁止**在投递成功前写 `notified`。
2. sweep 已有 `loadDue(..., "requeued")` → L1；投递成功再用 `attemptNotify(..., escalationDelta: 1)`。
3. DND 内不要把 acked 超时条目提前转 `notified`；应对 `requeued` 走与 pending 相同的「只低优先级 ntfy 一次 + snooze」。
4. 补测：DND + resolution-timeout；以及超时后 L1 双失败仍保持 `requeued`/`pending`、下轮再投。

---

### A 项核对（本批未构成 A）

| 项 | 结论 |
|---|---|
| L0 不经 dialog 出句闸 | [ok] 走 `index.ts` `say()` → `voiceHub.sendTtsSay`（`index.ts:2282-2294` / `:3467-3470`）。`dialog.ts:1000-1011` 结果句式闸只拦 Brain 出句。 |
| L0 脱敏 / TTS 记账 | [ok] `spokenLine` 先 `redactText`；`sendTtsSay` 再脱敏并 `onTtsChars` → `recordTtsChars`。 |
| ntfy 深链带 token | [ok] 本批未改 `ntfy.ts`；`click` 仍是 `/#/p/{projectId}/task/{taskId}`。 |
| notified 风暴 | [ok] 成功 L1 后 `notified(≥1)` 不再进 pending/L0 超时集。风暴风险在 A1 的「永不投」而不在「无限重投」。 |
| ack 身份门 | [ok] 路由在 `POST` 块（`index.ts:1129` / `:1685-1701`）；`mobile_lan` 先被白名单 403，再被 `handleOutboxAck` 403。 |
| 隐式 ack 范围 | [ok] SQL 限定 `state='notified' AND escalation=0`（`ack.ts:46-48`），L1 不动。 |
| 改 contracts 形状 / DDL | [ok] `packages/contracts` schema 与 `ddl.ts` 未改；`docs/09` 只加注释。 |
| 测试真 spawn / 真 fetch | [ok] 新测全是 sweep deps 桩，未 import `desktop.ts` / 未调 `postNtfy`。 |
| `bumpOutboxEscalation` 直接 UPDATE | 不升 A：只改 `escalation`/`notified_at`，state 仍是 `notified`。合同机管的是 state。作 B 记偏离。 |
| osascript 注入 | 不升 A：argv 数组、先 `redactText` 再转义 `\`/`"`，无 shell。slice 截断转义目前正文够短，构不成稳定 RCE。作 B。 |

---

## B 级

### B1 · `escalation` 上限 1 被 `escalateIfStale` 写成 2

`transitionOutbox` 封顶是 2（`outbox.ts:73`）。`escalateIfStale` 每次 `escalationDelta: 1`（`engine.ts:184-185`）。L1 已 `escalation=1` 的条目再 ack、再超时，库里会变成 2。sweep 的 `ESCALATION_CAP=1` 管不到这条路径。canonical / evidence 写「上限 1」不实。

**修法：** `escalateIfStale` 与 `transitionOutbox` 在 S2 路径上 `MIN(..., 1)`；补「ack 两次超时仍为 1」测试。

### B2 · `consolePeerForTask` 无序，同项目会绑错会话

```3449:3458:packages/daemon/src/index.ts
            consolePeerForTask: (taskId) => {
              const rows = db
                .prepare(
                  `SELECT s.id FROM sessions s JOIN tasks t ON t.project_id = s.project_id WHERE t.id = ?`
                )
                .all(taskId) as { id: string }[];
              for (const row of rows) {
                if (voiceHub.hasConsolePeerForSession(row.id)) return row.id;
              }
              return null;
            },
```

JOIN 只保证同项目，没有 `ORDER BY`，也不偏置 `talking` / 最近心跳。多 tab、幽灵会话会把 L0 送到用户没在看的那路。不是跨项目，但是错会话。`voiceBusy` 还只用 `voiceReady[0]` 的 session（`sweep.ts:191-194`），一单 busy 全员 queue（叠加 A1）。

**修法：** 按 `state='talking'`、最近 `started_at`/心跳排序；`voiceBusy` 按候选条目自己的 session 判，不要只问 top。

### B3 · DND 收口位置与红线相反，且双语义残留

红线：收口到 `engine.attemptNotify` / `deliveryPreflight`，sweep 不再自己判。实现是 sweep 自判 + `deliverDnd`，`attemptNotify` 生产路径不传 `dndWindow`。`callback.test.ts` 仍测 engine 旧语义（DND 只 snooze、不推 ntfy）。生产无双判，但两套 DND 并存。

DND 还不处理 `requeued`（只 `pending`）。即便修了 A2 只停在 `requeued`，窗口内这些条目仍既不推也不 snooze。

**修法：** 选定一处（建议 sweep 选路 + engine 只做状态）。DND 对 `pending` 与 `requeued` 同一套「低优先级 ntfy 一次 + snooze」。删掉或改掉 engine 旧 DND 测，避免两套真相。

### B4 · 桌面通知：先转义再 `slice`，且 spawn 成功即当真

`desktop.ts:26-35`：`escapeOsa(...).slice(0, 120/200)` 可能截断 `\"` / `\\`；`spawn` 不听 `error`、不等退出码，语法失败也 `true`。正文目前是固定短句，title 才是项目名。非 macOS / `osascript` 失败可能变成未处理 `error` 事件。

**修法：** 先截断原文再转义；监听 `error` 并 `return false`；给 `escapeOsa` 加单测（引号、反斜杠、截断边界）。不要在无测试的情况下把 spawn 成功当投递成功。

### B5 · `say()` 闭包把 `sendConsoleSay` 算成 L0 成功

```2288:2294:packages/daemon/src/index.ts
  return voiceHub.sendTtsSay(
    message,
    [],
    nativeContext?.origin ?? "system",
    nativeContext?.turnId
  ) || voiceHub.sendConsoleSay(message);
```

规格：无 pipeline 的纯文字 console 不算 L0，应 L1 + 气泡且不改成 L0。`ttsHealthy()===true` 但 `sendTtsSay` 失败时，文字气泡会让 sweep 记 `notified(escalation 0)`，30s 内没有桌面/ntfy。

**修法：** L0 的 `deps.voice.say` 只认 `sendTtsSay`；`sendConsoleSay` 仅走「TTS 不健康」那条旁路。

### B6 · 冻结接线只钉了 approve / cancel / retry

`operations.ts` 里 `request_changes`（`:369`）和 `reject`（`:391`）也有 `freezeOutbox`，本批测试没覆盖。`engine.resolve` 生产零调用，与「沿用 freeze」的自述一致，可接受，但 review 三分支只测了一支。

**修法：** ack 测试补 `request_changes` / `reject`。

### B7 · L0 30s 窗相对 15s sweep，最坏约 45s

`notified_at <= now-30s` 对齐在 sweep 节拍上。通知若落在 sweep 刚过后，下一拍 15s 未满 30s，再下一拍才升 L1，最坏约 45s。evidence 没写。可接受，但要写进 evidence，不要口头「30s」。

### B8 · console：轮询面过宽；Notify 单测没碰到 `api.ackOutbox`

`Layout.tsx:287-304` 把 focuses/spaces 一起从 30s 改 10s，超出「仅 outbox/attention」。Notify 页本身不轮询，只靠 mount + ack 后 `tick`。`Notify.test.tsx` 测的是 `onAck` 回调，不是 `api.ackOutbox`。失败被 `() => undefined` 吞掉（`Notify.tsx:69-72`）。

**修法：** 拆 interval 或接受并改文案；Notify 测 spy `api.ackOutbox`；ack 失败要可见。

### B9 · evidence / canonical 与代码不一致

- evidence 写 DND 去重「snooze + 审计 `callback.dnd_pushed`」：审计只 `record`，sweep 从不读（`sweep.ts:247-259`）。去重只靠 `snoozed_until`。
- evidence / `docs/09:635` 写 escalation 上限 1：与 B1 冲突。
- SHA / `1518 passed` / `JUST_CI_EXIT=2` 本会话未核。调度方应独立对 `git log` 与门禁输出，不要抄 evidence。

### B10 · `bumpOutboxEscalation` 是检查点 1 的偏离（已自述，可留）

`outbox.ts:93-105` 绕过 `canTransitionOutbox` 改字段。作为「同态升 level」可接受，但要把「不是状态转换」写进 09，而不是只写在 DAO 注释。`notified_at` 被刷新没有后续消费者（L0 超时要 `escalation=0`），建议不要改 `notified_at`，以免以后误用。

---

## C 级

- L0 `origin` 合同无 `callback`，native.reply 走 `system`，靠审计 `callback.voice_sent`。自述清楚。控制台若按 origin 过滤 system，回叫气泡可能不像「助手在叫你」。
- 规格 `reconnectFirstLine + one_liner?`，实现只有第一句（`sweep.ts:148-150`）。
- `docs/04` 注记与实现一致；同节仍写「会议软件占麦则降级」，与「`micHeldByMeeting` 恒 false」并排，读起来像能力已接。
- Notify 测试用「HTML 不含 acked 的 id」暗示行消失；acked/resolved 行仍渲染，只是没有按钮。和「已 ack/resolved 不显示」的含混说法对齐一下。
- `ESC_ICON[0]` 是 Phone，escalation 0 显示电话图标（`Notify.tsx:9,42-43`），L2 未做却像已在电话层。

---

## 对自述偏离

| 自述 | 裁决 |
|---|---|
| ① `notified→notified`/`notified→requeued` 不行，L0 超时只 bump `escalation` | 可接受（B10）。不要把同一手法用在 ack 超时上——那必须改 state，见 A2。 |
| ② `settle_json` 不能带 `dnd_pushed`，靠 snooze + 审计 | snooze 够用；审计不参与去重。evidence 写过了。 |
| ③ 无 `callback` origin，用 `system` | 可接受（C）。不影响脱敏/记账。 |
| ④ 冻结沿用 `operations.freezeOutbox` | 可接受。补 request_changes/reject 测试（B6）。 |

---

## 总评

**需返工，不能并入。**

A1 让「console 在线」这条主路径在用户开口后停止外呼，也不降 L1。A2 让「ack 后超时再升级」在 DND 或 L1 失败时写成已 notified，之后再无投递。两条都是回叫丢失，不是文案问题。

返工最小集：

1. 重写 `voiceBusy`，busy 不得吞 L1；补「已开口会话仍能叫人」测试。
2. `escalateIfStale` 只到 `requeued`，投递成功再 `notified`；DND 覆盖 `requeued`；补 DND×超时、L1 双失败测试。
3. 顺手收 B1（escalation 封顶 1）和 B5（`say` 不要把文字气泡算 L0）。

其余 B/C 可同批或另开。门禁与 SHA 由调度方在沙箱外核，不要用 evidence 自证。