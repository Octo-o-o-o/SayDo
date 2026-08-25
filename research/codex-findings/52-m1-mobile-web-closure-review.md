# No-Go

当前候选判定：**2A / 4B / 0C**。HEAD 确认为基线 `415df2a86a5208c1f68672bab0c75618f3070594`。

51 号的 `untrusted_source` 与 Focus 脱敏已在源码上关闭；durable outbox 只修掉了 Brain 前吞轮，却留下重复 Brain、假 `processed` 和恢复竞态，因此不能 Go。

## A 级

### A-1：`processing` 重放会重复 Brain，并可重复持久副作用

当前顺序是：写 `processing`、默认档 ACK、运行完整 Brain/tool loop，最后才写 `processed`：[dialog.ts:520](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:520)、[dialog.ts:531](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:531)、[dialog.ts:540](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:540)。启动又会重跑全部 `accepted|processing`：[dialog.ts:554](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:554)。

可复现反例：

1. T1 收到 ACK，scripted provider 返回 `remember`。
2. `remember` 已执行 `ledger.add`：[liveTools.ts:1236](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:1236)。
3. 在 `markAcceptedUserTurnProcessed` 前 SIGKILL，或让该方法注入异常。
4. 重启执行 `recoverPendingMobileTurns`。
5. Brain 与 `remember` 再执行一次，`MemoryLedger.add` 每次生成新 `memId` 并再次插入：[ledger.ts:98](~/WorkSpace/SayDo/packages/daemon/src/memory/ledger.ts:98)。

Provider 请求没有 idempotency key，[types.ts:27](~/WorkSpace/SayDo/packages/daemon/src/providers/types.ts:27)、[openaiCompat.ts:88](~/WorkSpace/SayDo/packages/daemon/src/providers/openaiCompat.ts:88)。因此这是实际的重复计费、重复 Brain、重复工具副作用窗口。

现有“崩溃窗”测试把首个 provider 永久挂起，只证明 Brain 尚未产出时能恢复：[live-wiring.e2e.test.ts:301](~/WorkSpace/SayDo/packages/daemon/test/live-wiring.e2e.test.ts:301)。

### A-2：同 session 新轮可把旧轮误记为 `processed`

`mobileTurnRuns` 只合并同 `(sessionId,turnId)`，不串行化同 session 的不同轮：[dialog.ts:483](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:483)。手机收到早期 ACK 后立即解除 `pendingSend`，可以发送 T2：[MobileApp.tsx:43](~/WorkSpace/SayDo/packages/console/src/mobile/MobileApp.tsx:43)。

可复现反例：

1. T1 收到 ACK，provider 暂停。
2. 发送不同 `turnId` 的 T2。
3. T2 覆盖 `currentUserTurn`：[voiceSessions.ts:168](~/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts:168)。
4. T1 返回后命中 stale 检查，输出被丢弃：[dialog.ts:868](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:868)。
5. 外层仍无条件把 T1 写成 `processed`：[dialog.ts:540](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:540)。
6. T1 后续重试只回 ACK，不再处理：[dialog.ts:510](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:510)。

启动时也先 `listen`，再以未等待的异步任务恢复：[index.ts:2372](~/WorkSpace/SayDo/packages/daemon/src/index.ts:2372)、[index.ts:2391](~/WorkSpace/SayDo/packages/daemon/src/index.ts:2391)。客户端重连发 T2 能触发相同竞态。这是数据丢失与假终态。

## B 级

### B-1：桌面 `turn.text` 被扩散了新的 ACK 协议行为

durable outbox 已限制在 `mobileTurn`，本地 ASR 也仍走旧入口；但候选对所有非 mobile 桌面文本轮仍传入 ACK callback：[index.ts:2206](~/WorkSpace/SayDo/packages/daemon/src/index.ts:2206)。随后 `turn.accepted` 按 session 广播：[hub.ts:713](~/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:713)。

反例：两个 local console peer 绑定同 session，其中一个发送桌面 `turn.text`，两端都会收到基线不存在且没有 outbox 重放保证的 `turn.accepted`。

桌面当前忽略该消息，故未发现直接 UI 回归；但这是可观察协议变化，违反 [docs/09:1145](~/WorkSpace/SayDo/docs/09-data-contracts.md:1145) 的桌面文本轮隔离要求。

### B-2：隐私配置跨重启时，ACK 策略不再对应该轮的可恢复性

`ackOnAccept` 只读取当前全局配置：[dialog.ts:521](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:521)，outbox 行没有记录该轮是否有 transcript，恢复路径也不补写原文：[voiceSessions.ts:176](~/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts:176)。

反例：

1. T1 在 `store_transcript=false` 下留下无原文 `processing` 行，未 ACK。
2. 重启前改成 `true`。
3. 手机同键重试时会按新配置提前 ACK，但 resume 路径仍没有持久正文。
4. 再次在 `processed` 前崩溃，手机已清草稿，daemon 无正文恢复。

反方向 `true→false` 也会因启动恢复被全局条件直接跳过，见 [index.ts:2391](~/WorkSpace/SayDo/packages/daemon/src/index.ts:2391)。

### B-3：fresh first-run HOME 会把 token、数据库和转写留在工作树

`.gitignore` 只忽略 `.pw-home/`，没有忽略 `.pw-first-run-home/`：[.gitignore:21](~/WorkSpace/SayDo/.gitignore:21)。setup 创建该目录，但 teardown 不删除：[global-setup.ts:54](~/WorkSpace/SayDo/e2e/console/global-setup.ts:54)、[global-setup.ts:122](~/WorkSpace/SayDo/e2e/console/global-setup.ts:122)。

当前 `git status` 已显示：

```text
?? e2e/console/.pw-first-run-home/
```

其中存在 `.cap-token`、SQLite、日志和 session JSONL；未读取 token 内容。复现方式是运行一次 Playwright 后执行 `git status --short`，整个目录可被误暂存。

### B-4：终局证据仍不能覆盖真实 AI 回复及两个 A 窗口

文本浏览器用例只断言 ACK、草稿清空和用户气泡：[console.spec.ts:188](~/WorkSpace/SayDo/e2e/console/console.spec.ts:188)。让 provider 在 ACK 后永久挂起，该测试仍不要求出现 AI 回复，因此七项验收③没有被证明。

同时缺少：

- Brain/tool 已提交后、`processed` 前的 crash fault injection；
- 同 session T1/T2 并发；
- server 已监听期间恢复与新入站竞争；
- 隐私配置跨未决轮切换。

## 51 号逐项裁决

| 51 号项 | 当前裁决 | 依据 |
|---|---|---|
| A-1 durable 接纳 | **未关闭** | Brain 前恢复已补，但被 A-1 重复副作用和 A-2 假 `processed` 反例击穿 |
| A-2 `untrusted_source` 广播 | **源码关闭** | 非终态只回发起 socket；真实终态仍按 session 广播 |
| B-1 幂等扩散 | **部分关闭** | durable 表未再扩散；桌面 `turn.accepted` 仍是新协议行为 |
| B-2 Focus 脱敏 | **关闭** | 允许的 `title`、字符串 `revision` 均经 `redactText` |
| B-3 证明力 | **部分关闭** | 真 first-run 设计已补；AI 回复、post-Brain crash、并发恢复仍缺 |

outbox 的其他子项源码上成立：

- DDL 确有 digest-only `accepted→processing→processed`：[ddl.ts:768](~/WorkSpace/SayDo/packages/daemon/src/storage/ddl.ts:768)。
- 已 `processed` 同文重试只回 ACK。
- `store_transcript=false` 单一配置正常路径不落 transcript，且先 `processed` 后 ACK。
- transcript/index 写失败路径不发 ACK。
- 本地 ASR 和桌面文本不写 `accepted_user_turns`；但桌面 ACK 泄漏见 B-1。

## 其余专项裁决

- `untrusted_source`：只回源 socket，[hub.ts:443](~/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:443)；手机禁 accept/reject、保留 withdraw，[CardPage.tsx:109](~/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:109)、[CardPage.tsx:141](~/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:141)。真实终态仍由 [index.ts:1818](~/WorkSpace/SayDo/packages/daemon/src/index.ts:1818) 按 session 广播。
- Focus 轨迹：`title` 与字符串 `revision` 都脱敏，[console.ts:694](~/WorkSpace/SayDo/packages/daemon/src/api/console.ts:694)；测试输入直接包含完整路径与 token，[console-api.test.ts:84](~/WorkSpace/SayDo/packages/daemon/test/console-api.test.ts:84)。
- first-run：独立 fresh HOME、第二个真实 daemon 在 [global-setup.ts:72](~/WorkSpace/SayDo/e2e/console/global-setup.ts:72)；真实浏览器直接访问 RFC1918 daemon 与既有端点，[console.spec.ts:159](~/WorkSpace/SayDo/e2e/console/console.spec.ts:159)。该用例没有 route mock；后面的 mock 是另一条重挂测试。
- 合同与白名单：Attention、Focus、confirm outcome 共用 [mobile.ts:23](~/WorkSpace/SayDo/packages/contracts/src/types/mobile.ts:23)，console 仅作类型别名；未发现 DTO 分叉。除 B-1 外，daemon 改动可映射到 v3.3 四项白名单。
- 桌面源码隔离：既有 console 源码相对基线只改 [App.tsx:136](~/WorkSpace/SayDo/packages/console/src/App.tsx:136)；Provider 位于分树外，移动 CSS 未发现全局 selector。源码树隔离成立，协议隔离因 B-1 不成立。

## 用户七项验收

| 场景 | 裁决 |
|---|---|
| ① Today 与桌面同账本 | 源码满足：共用 `/api/attention`；本轮未做真机对照 |
| ② 做→桌面清卡→手机 toast | 真实终态广播和手机导航源码满足；未跑双浏览器 E2E |
| ③ 文本→AI 回复 | **未证明，且受两个 A 阻断** |
| ④ 键盘话筒听写 | 图标只聚焦输入、placeholder 正确；OS 听写未实测 |
| ⑤ Things→Focus→Lane | 路由和页面具备；未跑完整浏览器导航 |
| ⑥ 断网灰态、保草稿、自愈 | Playwright 用例已写；本轮未执行 |
| ⑦ stale 诚实且不重复执行 | resolver、文案和动作约束源码满足；本轮未执行 |

v3.3 新增的第⑧项真 LAN/default-off 也有真实进程测试源码，但本轮未运行。

## OPEN QUESTION

1. 跨 SIGKILL 的正式语义究竟是“Brain/tool 至少一次，所有副作用按 turn/step 幂等”，还是“Brain 最多一次，外部结果不确定时进入人工对账态”？仅靠当前三态无法同时保证不吞轮和不重复 Brain。
2. `store_transcript` 能否在存在未决 outbox 行时切换？若允许，必须按轮持久化可恢复策略；若禁止，需要 canonical 与配置门明确拒绝。
3. Go 前是否要求七项全部取得真手机、真 provider/dialog 和真实断网证据，目前候选只具备部分测试源码。

## 验证边界

- `pnpm typecheck`：退出码 0。
- `pnpm lint`：退出码 0。
- `git diff --check 415df2a86a5208c1f68672bab0c75618f3070594`：退出码 0、无输出。
- daemon、console、contracts 定向 Vitest 均因只读沙箱无法创建 `.vite-temp`/临时目录而在测试发现前报 `EPERM`；**没有测试通过结论，也不计为代码失败**。
- 本轮未运行 Playwright、真实 daemon kill/restart、Chromium或真机。
- 全程未修改任何文件。

## 施工 triage 与终局改判（2026-08-11）

- A-1/A-2 与 B-1/B-2 的共同根因，是候选为回执重试额外引入了跨 Brain/tool 的 durable 处理 outbox；这既无法在现有副作用边界证明精确一次，也超出 v3.3 “daemon 仅四项”白名单。最终没有为三态继续发明语义，而是删除 `turn.accepted`、`accepted_user_turns`、v29 迁移、处理恢复器及独立移动发送 WS；移动输入直接复用 Provider 外层既有 `turn.text`。四项因此均按“删除越界增量”关闭，桌面协议保持基线语义。
- B-3 已关闭：`.pw-first-run-home/` 加入 ignore，teardown 删除，失败运行遗留的 token/SQLite/转写/日志目录已清理。
- B-4 中与被删 outbox 相关的故障窗不再适用。文本浏览器用例现以本地测试 pipeline 只承接真实 daemon 下行，不伪造回复；确定性话术来自 `turn.text → VoiceHub → LiveDialog 撤销直通 → tts.say → M-Chat`，可证明真实 dialog 链，但不冒充真实 LLM/provider 调用。移动层仅在既有 Provider 已完成 `ws.send` 并追加新用户轮后清草稿；同步写异常或 closed no-op 都保留。first-run suppression 只存在于当前 React 树，不会在尚无 daemon 接纳证据时跨刷新吞掉权威查询。
- 原 OPEN QUESTION 1/2 随 outbox 删除而消失；第 3 项由 owner 已明确的本任务验收清单裁决，不擅自扩大为真机/真付费 provider 门。
- 最终验证：`pnpm ci:node` exit 0（contracts 91、console 86、daemon 1042），daemon 定向 139/139，contracts 定向 17/17，console mobile 21/21，M1/first-run Playwright 8/8，typecheck/lint/emoji/diff-check 全绿。结论改判 **Go，A=0/B=0/C=0，OPEN QUESTION=0**。
