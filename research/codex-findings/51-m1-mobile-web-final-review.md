No-Go

当前为 **2A / 3B / 0C**。50 号原 A-1～A-4、B-1、B-2 的直接缺陷已关闭，B-3 仍开放；回修另引入两个 A 级阻断。

## A 级

### A-1：durable 接纳锚不能证明 Brain 已接手，崩溃窗口会永久吞掉处理

- 当前代码：用户轮先写 transcript 和 digest：[voiceSessions.ts:152](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts:152)、[voiceSessions.ts:162](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts:162)；随后立即触发 ACK：[dialog.ts:520](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:520)、[index.ts:2211](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:2211)。普通轮到 [dialog.ts:760](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:760) 才真正进入 Brain。重试命中 digest 后只回 ACK 并返回：[dialog.ts:476](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:476)、[dialog.ts:486](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:486)。
- 可复现反例：发送普通 mobile 文本，在 digest 已提交、ACK 尚未送达且 Brain 尚未调用时杀 daemon。重启后以原 `turnId` 同文重试，得到 `turn.accepted`，但 Brain 总调用数为 0，文本不会被继续处理；同 ID 异文虽然会拒绝，也不能修复该轮。
- 规格依据：[docs/09:1139](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1139)、[docs/09:1141](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1141)、[docs/11:221](/Users/wangyixiao/WorkSpace/SayDo/docs/11-ui-spec.md:221)。要求实际是“一次接纳、一次处理、ACK 可重放”，当前只有 at-most-once Brain。
- 最小修法：增加以 `(sessionId, turnId)` 为键的 durable processing/outbox 状态，区分 `accepted` 与 `brain_handed_off/processed`，启动时恢复未交付轮；不能用单一正文 digest 代表 Brain 已处理。增加在 ACK/Brain 间杀进程的故障注入测试。

### A-2：`untrusted_source` 被误当终态广播，桌面原卡消失且手机无法再 withdraw

- 当前代码：runtime 的 pending/gate 本身正确保留：[dialog.ts:985](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:985)、[dialog.ts:1001](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:1001)。但入口把非终态失败包装成 `confirm.resolved`：[index.ts:2190](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:2190)；VoiceHub 发给同 session 全部 console：[hub.ts:683](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:683)、[hub.ts:691](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:691)。桌面对任何 matching `confirm.resolved` 都清卡：[useVoiceChannel.ts:549](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/voice/useVoiceChannel.ts:549)。手机收到错误后把整卡设为 unavailable：[CardPage.tsx:103](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:103)、[CardPage.tsx:120](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:120)。
- 可复现反例：桌面和手机同绑原 session，手机对 runtime 卡点“做”。receipt、gate、pending 均仍在，但桌面卡消失；手机三个动作同时禁用，连本应安全的 withdraw 也不能再点。
- 规格依据：[docs/09:1139](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1139) 明确要求保持原卡/receipt 待受信屏幕处理，withdraw 仍只撤 presentation；[docs/11:221](/Users/wangyixiao/WorkSpace/SayDo/docs/11-ui-spec.md:221) 要求如实引导回桌面。
- 最小修法：把非终态裁决结果只回复发起 socket，只有真实生命周期终态才能按 session 广播 `confirm.resolved`；手机对 `untrusted_source` 保留 withdraw。补“桌面 peer + mobile peer”联测。

## B 级

### B-1：移动幂等索引扩散到全部用户轮，超出最小白名单边界

- 当前代码：无条件加入 v29 表和迁移：[ddl.ts:768](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/storage/ddl.ts:768)、[ddl.ts:810](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/storage/ddl.ts:810)；通用 `onUserTurn` 无条件写 digest：[voiceSessions.ts:152](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts:152)、[voiceSessions.ts:162](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts:162)。本地 pipeline `asr.final` 也走同一路径：[index.ts:2151](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:2151)、[index.ts:2173](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:2173)。
- 可复现反例：保持 `SAYDO_MOBILE_LAN` 关闭，走既有本地语音轮，仍会为正文写 `accepted_user_turns`，改变非移动路径的持久化、隐私和重复 ID 语义。
- 规格依据：v3.3 把 [四项列为“允许的全部 daemon 改动”](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:143)。即使把幂等表视为移动对话入口的必要实现细节，也没有依据把它挂到全部 ASR 用户轮。
- 最小修法：为 mobile typed 接纳建立独立入口或显式模式，只在该路径写/查询幂等锚；若要保留全局行为，先由 owner 明确扩充 v3.3 白名单。

### B-2：Focus 轨迹只做字段白名单，没有对允许字段正文脱敏

- 当前代码：[console.ts:693](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:693) 原样复制 `payload.title` 和字符串 `revision`；shared schema 也允许任意字符串：[mobile.ts:109](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/mobile.ts:109)。测试仅把路径放在必被删除的 `path` 字段：[console-api.test.ts:84](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/console-api.test.ts:84)、[console-api.test.ts:98](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/console-api.test.ts:98)。
- 可复现反例：写入 `payload.title="修 /Users/alice/private/.env，Bearer sk-..."`，移动 Focus 详情会原样返回该 title。
- 规格依据：[docs/09:1139](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1139) 要求“脱敏轨迹摘要”。
- 最小修法：允许字段仍须经过共享敏感内容 redactor；限制或同样脱敏字符串 `revision`，并把完整路径/token 直接放进 title 做回归测试。

### B-3：测试证明力仍开放

- 当前测试源码补了真实 RFC1918 地址进程链：[mobile-lan-process.test.ts:48](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/mobile-lan-process.test.ts:48)、[mobile-lan-process.test.ts:65](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/mobile-lan-process.test.ts:65)，以及 Chromium 无 Origin GET：[console.spec.ts:176](/Users/wangyixiao/WorkSpace/SayDo/e2e/console/console.spec.ts:176)。
- 可复现反例：first-run UI 用例仍由 `route.fulfill` 自造 `presented`：[console.spec.ts:157](/Users/wangyixiao/WorkSpace/SayDo/e2e/console/console.spec.ts:157)；即使真实 daemon 从不返回开场白，该用例仍会通过。重试测试是在首轮 Brain 已完整返回后才重试：[live-wiring.e2e.test.ts:278](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/live-wiring.e2e.test.ts:278)，会放过 A-1；dialog 层 withdraw 测试会放过 A-2 的广播副作用：[tier1-approval-live.test.ts:118](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/tier1-approval-live.test.ts:118)。
- 规格依据：[v3.3:154](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:154)、[v3.3:156](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:156)。
- 最小修法：补 fresh HOME 下真实 first-run 浏览器链、RFC1918 peer 伪报已配置 tailnet Host、无 Origin 加跨站 Referer/`cross-site`、真实 WS 丢首个 ACK 后原 ID 重连/重启、ACK/Brain 间崩溃恢复，以及双 peer `untrusted_source` 测试；ACK callback 内即时查询 durable 行。

## C 级

零。

## 合同与隔离核对

- 错误或跨 session `turn.accepted` 会被 `sessionId + turnId` 双键拒绝；同文重试复用原 ID：[sendText.ts:13](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/sendText.ts:13)、[sendText.ts:63](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/sendText.ts:63)。daemon 正常路径在 transcript 与 digest 写完后才回 ACK；同 ID 异文拒绝：[dialog.ts:486](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:486)。当前“定向”是同 session peers 定向，不是 originating socket 单播，但错误 ACK 不会清草稿。
- Attention、移动 Focus、outcome 已由 shared contracts 承载：[mobile.ts:23](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/mobile.ts:23)、[mobile.ts:51](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/mobile.ts:51)、[mobile.ts:125](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/mobile.ts:125)；daemon 和 mobile console 分别 parse 同一 schema：[console.ts:432](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:432)、[data.ts:8](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/data.ts:8)。DTO 形状已排除 repo note、artifact ref、sessionId、raw payload，正文脱敏例外见 B-2。
- 既有桌面源码相对基线只有 [App.tsx:136](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/App.tsx:136) 有 diff；Provider 位于分树外：[App.tsx:150](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/App.tsx:150)。移动 CSS 未发现非 `.m-root` selector，media query 内也保持作用域：[mobile.css:1](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/mobile.css:1)、[mobile.css:767](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/mobile.css:767)。
- 除 B-1 的通用用户轮持久化外，其余 daemon 源码改动可映射到 v3.3 四项白名单。

## 50 号七项结论

| 50 号项 | 结论 | 当前判断 |
|---|---|---|
| A-1 Host 伪装 localhost/tailnet | Fixed | socket peer 已参与 local/tailnet/mobile 判定 |
| A-2 同源 GET 无 Origin | Fixed | 同 Host Referer 通过；缺/跨站 Referer 与 `cross-site` 拒绝 |
| A-3 ACK 前断线静默丢草稿 | Fixed | 普通断线和 ACK 丢失重试已修；A-1 是新的崩溃窗口 |
| A-4 mobile runtime withdraw | Fixed | withdraw 先执行且 gate/receipt 保持；A-2 是先误点 accept 后的新副作用 |
| B-1 无 Focus 假“去泳道看” | Fixed | 无真实 Focus/Lane 目标时零动作 |
| B-2 contracts 分叉 | Fixed | daemon 与 mobile console 共用 schema/type |
| B-3 测试证明力 | 仍开放 | 真实 first-run、故障注入、tailnet spoof、双 peer 生命周期仍缺 |

## 本轮实际命令边界

- `git rev-parse HEAD`：`415df2a86a5208c1f68672bab0c75618f3070594`。
- 最终快照执行 `pnpm typecheck`：退出码 0，contracts/daemon/console 均 `Done`。
- 最终快照执行 `pnpm lint`：退出码 0。
- `git diff --check 415df2a86a5208c1f68672bab0c75618f3070594`：退出码 0、无输出。
- 直接用 Node 22 调当前 `verifyIdentity`：远端伪报 localhost/tailnet 均 `host_rejected`；同源无 Origin GET 为 `ok:mobile_lan`；缺 Referer、跨站 Referer、`cross-site`、evil Origin 均 `origin_rejected`。
- 定向 daemon/console Vitest 均在创建 Vite 临时目录时收到 `EPERM`，显示 `Tests no tests`；因此没有 Vitest 通过结论。
- `scripts/check-emoji.sh` 因 `mktemp: Operation not permitted` 未执行成功。
- Playwright、真实 daemon 进程、Chromium、双向视口、重连、withdraw 二次裁决均未实际运行；这里只审查了测试源码，不写成通过。
- 审查期间工作树曾被外部并发修改，本轮未写文件。最终报告针对 2026-08-11 17:33:44 +0800 的稳定快照；全部 modified/untracked 文件内容清单聚合 SHA-256 为 `2ed197fd06f20320693ce1e327ffcaa22d5c351ff8ed71f9caa3d5708c26f8be`。

## 施工 triage 与终局改判（2026-08-11）

- A-1 与 B-1 所依赖的新增 `turn.accepted`/`accepted_user_turns`/处理 outbox 已整组删除。v3.3 只授权“放行既有对话路由”，移动文本现在直接调用分树外 VoiceProvider 的既有 `sendText`；因此不再新增跨崩溃接纳语义，也不扩散到本地 ASR/桌面文本协议。
- A-2 已按 source peer 单播非终态 `untrusted_source`；手机只禁 accept/reject，仍可 withdraw。真实终态继续按既有 session 广播。
- B-2 已对 Focus 轨迹允许字段 `title` 与字符串 `revision` 逐项 `redactText`，测试直接放入完整路径与 token；B-3 已补 source peer、socket peer、真 RFC1918、fresh first-run、双向视口、成功重连及真实断网证据。
- 最终验证：`pnpm ci:node` exit 0（contracts 91、console 86、daemon 1042），M1/first-run Playwright 8/8，daemon M1 定向 139/139；结论改判 **Go，A=0/B=0/C=0**。
