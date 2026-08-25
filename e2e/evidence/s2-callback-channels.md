# s2-callback-channels · 回叫通道接线(2026-08-20)

> 范围 = IMPL-PROMPT-13:分级选路 L0 语音 / L1 桌面+ntfy、DND 只推不响、ack/resolve/冻结接线、canonical 注记。
> 完成定义 = §3 验收锚 + 本 evidence。不部署常驻、不 push、不改 `~/.saydo`。本文件不自指 SHA。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做。

## 0. 坐标

- 工作目录:`~/WorkSpace/saydo-batch-s2-callback-channels`
- 开批 HEAD:`33c5cf134f08942457f9bc7f5589eeef88c0fbce`(prompt 写 `354b028`;本 clone 多一个 docs 提交 `33c5cf1`,属允许的其后 docs 提交)
- 分支:`batch/s2-callback-channels`
- 代码提交 A(本文件记录此 SHA,不自指):`dedd327671bac6db72dae11b048083676bf69560`
- 代码提交 B:`37b349a01a59cfd58e33b08ca25ff88a645a8176`
- canonical 提交:`63600c62ac762aca4cecbc38391b8298a73d9c32`

开批 `rg` 核验(本会话):

| 项 | 结果 |
|---|---|
| `engine.ts` ESCALATION/attemptNotify/escalateIfStale/freezeForTask | `:46` / `:116` / `:144` / `:161` |
| 生产调用方 escalateIfStale/ack/resolve(排除 engine.ts) | 开批零命中 |
| `index.ts` ntfy sweep | 开批 `:3393-3441` |
| `arbitration.ts` arbitrate/reconnectFirstLine/PRIORITY | `:41` / `:58` / `:7` |
| `osascript` in `packages/daemon/src` | 开批零命中(EXIT=1) |
| Layout `setInterval(..., 30_000)` | 开批 `:304` |
| 开批 `callback.test.ts` + `t2-thin.test.ts` | 24 passed, EXIT=0 |

## 1. 检查点处置

1. [ok] `canTransitionOutbox`: `notified→notified` 否,`notified→requeued` 否(合同:requeued 只能从 acked 进入)。L0 30s 未 ack 升 L1 **不改状态机**:`bumpOutboxEscalation` 保持 `notified`,只把 `escalation` 0→1(上限 1)。未改 contracts 形状。
2. [ok] `settle_json` 是 `strictObject`,不能承载 `dnd_pushed`。DND 去重 = 推送成功后 `snooze` 到窗口末(再次 sweep 不取未到期条目)+ 审计 `callback.dnd_pushed`。未加 DDL/`meta_json` 列。
3. [ok] 既有 `say()` 已有 `nativeContext.origin`。`NativeReplyOrigin` 无 `callback`(不改 contracts):L0 下发 native.reply 走 `system`,审计 `callback.voice_sent`。未改 dialog 出句管线。

## 2. 落地

- [ok] `packages/daemon/src/callback/sweep.ts` `runCallbackSweep`:pending 按 PRIORITY 再 `created_at` 上限 5;L0 三要素(console peer ∧ TTS `ok` ∧ 不 busy)经 `arbitrate`;否则 L1 桌面+ntfy;requeued / L0 超时走 L1;`escalation` 上限 1。
- [ok] DND:`inDndWindow` 收口到 sweep deps;窗口内只 POST 低优先级 ntfy(正文前缀「（免打扰时段）」,priority 2),不语音不桌面,成功则 snooze。
- [ok] 桌面:`notifyMacDesktop` 注入 `spawnDetached`;生产 `osascript display notification`;测试桩,禁真弹。
- [ok] ntfy:`deps.ntfy.post` 注入;测试桩,禁真 POST。
- [ok] `POST /api/outbox/:id/ack` local/tailnet 200;mobile_lan 403(`mobileLanApiAllowed` 白名单 + handleOutboxAck 双闸)。
- [ok] 用户轮开始 `onUserTurnBegin` → `ackL0ForSession`(只 ack 同项目 `notified` 且 `escalation=0`)。
- [ok] sweep 每轮 `escalateAckedIfStale` 后对刚升级条目 L1 重投。
- [ok] review/cancel/retry 冻结:operations 既有 `freezeOutbox` → `resolved(superseded)`,本批以测试钉住,未再包一层 `engine.freezeForTask`(同 DAO,避免双冻)。
- [ok] Notify「知道了」→ `api.ackOutbox`;已 ack/resolved 不显示。Layout 侧栏轮询 30s→10s。
- [ok] `docs/04` §4 与 `docs/09` §6.3 现状注记。

## 3. 门禁(退出码紧跟命令本身)

开批定向:

```
pnpm --filter @saydo/daemon exec vitest run test/callback.test.ts test/t2-thin.test.ts; echo EXIT=$?
```

EXIT=0; Tests **24 passed**(callback 8 + t2-thin 16)。

收口定向:

```
pnpm --filter @saydo/daemon exec vitest run test/callback.test.ts test/callback-sweep.test.ts test/callback-ack.test.ts test/t2-thin.test.ts; echo EXIT=$?
```

EXIT=0; Tests **42 passed**(callback 8 零改动 + sweep 12 + ack 6 + t2-thin 16)。

```
pnpm --filter @saydo/console exec vitest run src/pages/Notify.test.tsx; echo EXIT=$?
```

EXIT=0; Tests **1 passed**。

`just ci` 本会话一次:`JUST_CI_EXIT=2`。node 段已跑完且绿;python 段 `uv sync` 写 `~/.cache/uv` 被环境拒绝(`Operation not permitted`)。node 摘录:

| 包 | 用例 |
|---|---|
| contracts | 103 passed |
| cli | 19 passed |
| console | 254 passed |
| daemon | 1518 passed / 4 skipped |

随后 python 用 `UV_CACHE_DIR=/tmp/saydo-uv-cache` 复跑:`ruff` EXIT=0;`pytest -q` EXIT=0,**33 passed** in 0.29s。

其它:`pnpm typecheck`(daemon/console) EXIT=0;`bash scripts/check-emoji.sh` EXIT=0,`[ok] emoji gate: clean`。

## 4. 用例数前后

| 范围 | 开批 | 收口 | 差 |
|---|---|---|---|
| `callback.test.ts` | 8 | 8 | 0(既有零改动) |
| `callback-sweep.test.ts` | 0 | 12 | +12 |
| `callback-ack.test.ts` | 0 | 6 | +6 |
| `t2-thin.test.ts` | 16 | 16 | 0 |
| console `Notify.test.tsx` | 0 | 1 | +1 |
| daemon 全量(just ci node) | (本会话未在改码前跑全量) | 1518 passed / 4 skipped | 定向新增 18 |
| console 全量 | (未在改码前跑全量) | 254 passed | 定向新增 1 |

## 5. 未做清单

- [fail] L2 电话(escalation 上限 1,注释如实)
- [fail] `micHeldByMeeting` 数据源(恒 false)
- [fail] console 无新 WS 推送,只 10s 轮询
- [fail] 真机 macOS 通知 / 真 POST ntfy(本批测试全桩;属调度方/owner 触点)
- [fail] 浏览器走查 Notify 页(无 just dev;以单测 markup 核「知道了」按钮)

## 6. 对账(完成 / 部分 / 未做)

| 项 | 状态 | 证据 |
|---|---|---|
| 3.1 A sweep 分级选路 + DND | 完成 | SHA `dedd327671bac6db72dae11b048083676bf69560`;sweep 12/12 EXIT=0 |
| 3.2 B ack / 隐式 ack / 终局冻结 / resolution-timeout | 完成 | SHA `37b349a01a59cfd58e33b08ca25ff88a645a8176`;ack 6/6 + Notify 1/1 EXIT=0 |
| 3.3 C canonical | 完成 | SHA `63600c62ac762aca4cecbc38391b8298a73d9c32` |
| L2 / 真通知 / micHeldByMeeting | 未做 | 见 §5 |

## 7. 评审 1 返工

报告:`research/codex-findings/81-s2-callback-channels-review.md`。[fail] A1/A2 必修,B1–B9 同批修。测试仍禁真 spawn osascript / 真 fetch。

代码提交(本文件记录,不自指):

- daemon:`8ec247e0ac2edac16e60956cd02c6d963e8b731b`
- console+canonical:`93eb8148ab695186a49a6f54f1f36e0e974fbf44`

| 条 | 处置 |
|---|---|
| A1 voiceBusy | 生产改 `liveDialog.hasUserTurnInFlight`;开口一轮后 `currentUserTurn` 仍在也不 busy。busy 只 queue 当前最高优先一条,其余 L1。单测:voice-busy 1 + sweep busy 其余 L1。 |
| A2 escalateIfStale | 只 `acked→requeued`;投递成功才 `notified`。DND 覆盖 pending+requeued。L1 双失败保持 requeued 下轮再投。 |
| B1 | `transitionOutbox` MIN(...,1);ack 两次超时仍为 1。 |
| B2 | `pickConsolePeerForTask`:talking 优先、started_at 新到旧;busy 问候选 session。 |
| B3 | DND 选路在 sweep,engine 只 `snooze`;删 engine 旧 DND 双真相测。 |
| B4 | 先截断再转义;spawn `error` ⇒ false;`escapeOsa` 单测。 |
| B5 | L0 `deps.voice.say` 只 `sendTtsSay`。 |
| B6 | ack 测补 request_changes / reject。 |
| B7 | L0 应答窗检查提前到每轮开头;最坏约 45s 写入 canonical/本段。 |
| B8 | Notify spy `api.ackOutbox`、失败 `data-ack-error`;10s 只刷 attention/outbox,focus/spaces 30s。 |
| B9 | 04/09 与代码对齐:上限 1、DND 去重靠 snooze 非审计、L0 bump 不改 notifiedAt、requeued 投递前不写 notified。 |

门禁(本会话,退出码紧跟命令):

```
pnpm --filter @saydo/daemon exec vitest run test/callback.test.ts test/callback-sweep.test.ts test/callback-ack.test.ts test/callback-desktop.test.ts test/callback-voice-busy.test.ts test/t2-thin.test.ts; echo EXIT=$?
```

EXIT=0; Tests **55 passed**(callback 8 + sweep 15 + ack 11 + desktop 4 + voice-busy 1 + t2-thin 16)。

```
pnpm --filter @saydo/console exec vitest run src/pages/Notify.test.tsx; echo EXIT=$?
```

EXIT=0; Tests **2 passed**。

`tsc --noEmit` daemon/console EXIT=0;`bash scripts/check-emoji.sh` EXIT=0。

用例数(评审 1 返工相对 §4 收口):

| 范围 | 返工前 | 返工后 |
|---|---|---|
| `callback-sweep.test.ts` | 12 | 15 |
| `callback-ack.test.ts` | 6 | 11 |
| `callback-desktop.test.ts` | 0 | 4 |
| `callback-voice-busy.test.ts` | 0 | 1 |
| console Notify | 1 | 2 |
| 定向合计(含 callback 8 + t2-thin 16) | 42 | 55 |

## 8. 评审 2 前置

`9224fb97fdfbf286bdcefb17547ec8e3f129bafb`:`transitionOutbox` 封顶恢复 2(storage-checks「escalation 封顶 2」绿);S2 只在 `escalation<1` 时传 `escalationDelta:1`。定向 callback+storage-checks 82 passed EXIT=0。

## 9. 评审 2 收口

`d2d7a310160e77baaf497a1961a1b01d41455368`:B-r2 `voiceBusy` 按候选条目各自 session 判——busy session 只 queue 该 session 头一条、同 session 其余 L1;其它空闲 session 仍 L0(两 session 用例)。C:`hasCurrentUserTurn` 注释改为 sweep 用 `hasUserTurnInFlight`;`notifyMacDesktop` 听 `spawn`/`error`,去掉 `setTimeout(0)`;NotifyView 按钮 → `makeNotifyAckHandler` → `api.ackOutbox`。

定向:`callback-sweep` 16、`callback-desktop` 5、Notify 3;callback 套件(+ t2-thin) 57 passed EXIT=0。§7 B2「busy 问候选 session」在此提交后与实现一致。
