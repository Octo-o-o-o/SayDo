No-Go

当前仍有 4A / 3B / 0C。核心阻断是：LAN 来源可伪装成本机、真实浏览器的移动 GET 全部被 Origin 门拒绝、文本仍可能静默丢失、runtime `withdraw` 在真正的 `mobile_lan` 路径上不可用。

## A 级

### A-1 LAN 客户端可伪造 `local`，绕过整个移动 HTTP/WS 最小面

证据：

- 开关使 daemon 监听 `0.0.0.0`：[mobileLan.ts:7](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/net/mobileLan.ts:7)。
- `via` 完全由客户端可控的 `Host` 决定；`Host: localhost:<port>` 直接得到 `local`：[identity.ts:35](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/net/identity.ts:35)、[identity.ts:44](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/net/identity.ts:44)。
- 身份输入和调用处均没有 socket `remoteAddress`：[identity.ts:80](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/net/identity.ts:80)、[index.ts:283](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:283)。
- HTTP、WS 限制只在已经被标为 `mobile_lan` 时执行：[index.ts:439](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:439)、[hub.ts:378](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:378)、[hub.ts:501](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:501)。

可复现反例：从另一台 LAN 主机携带手机已经持有的长期 token，请求 daemon 的 LAN IP，但设置：

```text
Host: localhost:<port>
Origin: http://localhost:<port>
```

例如访问 `/api/spaces`。身份门会返回 `via=local`，移动路由白名单不再执行。WS 同样可伪装为本机 console，发送 `confirm.click` 或二进制麦克风帧；后者会被转发 pipeline：[hub.ts:516](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:516)。

规格依据：[docs/09:1136](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1136)、[v3.3:143](</Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:143>)。

最小修法：身份判定加入规范化后的 socket peer address；只有 loopback peer 才能成为 `local`。非 loopback 请求必须按真实网络来源进入 `mobile_lan`/`tailnet` 判定，不能由 `Host` 自选可信级别；HTTP 与 WS 共用该结果，并增加原始客户端伪造 Host/Origin 的拒绝测试。

### A-2 正常手机浏览器无法读取 Today、Focus 列表及详情

证据：

- `mobile_lan` 请求缺少 `Origin` 时一律拒绝：[identity.ts:54](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/net/identity.ts:54)、[identity.ts:61](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/net/identity.ts:61)。
- 三个移动读口都是普通同源 GET，只添加 token header：[api.ts:31](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/api.ts:31)、[data.ts:7](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/data.ts:7)。
- 现有“真实进程”测试手工注入了浏览器通常不会为同源 GET 携带的 `Origin`：[mobile-lan-process.test.ts:14](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/mobile-lan-process.test.ts:14)。

可复现反例：手机打开 `http://192.168.x.x:<port>/?token=...#/m`。静态壳和 WS 可建立，但浏览器发出的同源 GET `/api/attention` 不带 `Origin`，daemon 返回 `403 origin_rejected`。Fetch 标准只在相应 CORS/非 GET、HEAD 等条件下附加 Origin，网页也不能自行设置该 forbidden header：[WHATWG Fetch Origin header](https://fetch.spec.whatwg.org/#origin-header)。

规格依据：[docs/09:1136](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1136)、[docs/11:219](/Users/wangyixiao/WorkSpace/SayDo/docs/11-ui-spec.md:219)。

最小修法：先修订 canonical 中浏览器不可实现的“GET 必备 Origin”合同。可保留 GET，并要求同 Host `Referer` 加 `Sec-Fetch-Site: same-origin`；或将移动查询改成会自然携带 Origin 的 POST。两种方案都须配真实浏览器访问测试，不能只用 Node 手填 Origin。

### A-3 乐观 transcript 被误当成 daemon 入队证明，断线仍会丢草稿

证据：

- 点击发送后先记录 `pendingSend`，随后调用无返回值的 `voice.sendText`：[MobileApp.tsx:54](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/MobileApp.tsx:54)。
- `sendText` 在 `ws.send()` 后立即把同一文本加入本地 transcript：[useVoiceChannel.ts:699](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/voice/useVoiceChannel.ts:699)、[useVoiceChannel.ts:708](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/voice/useVoiceChannel.ts:708)。
- 移动端只按“新 seq 且文本相同”判定入队，并立即清草稿、跳转：[MobileApp.tsx:24](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/MobileApp.tsx:24)、[MobileApp.tsx:47](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/MobileApp.tsx:47)。
- daemon 收到 `turn.text` 后没有回传接受确认：[hub.ts:435](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:435)。

可复现反例：WS 处于 OPEN 时点击发送，浏览器完成本地 `ws.send()` 后立即断网、daemon 未收到帧。本地乐观 transcript 已满足判定，草稿被清除且页面跳转，文本静默丢失。

规格依据：[docs/11:221](/Users/wangyixiao/WorkSpace/SayDo/docs/11-ui-spec.md:221)、[v3.3:152](</Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:152>)。

最小修法：为 `turn.text` 增加按 `turnId` 定向的 daemon 接受/落账回执；乐观 transcript 标为 pending，不得作为成功证明。仅收到对应回执后清草稿和跳转。

### A-4 真正来自 `mobile_lan` 的 runtime `withdraw` 被提前拒绝

证据：

- runtime 来源检查先于 `decision === "withdraw"`：[dialog.ts:963](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:963)、[dialog.ts:966](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:966)。
- 因此 `applyConfirmDecision(session, receipt, "withdraw", "mobile_lan")` 返回 `untrusted_runtime`，不会执行下一行的 presentation withdrawal。
- 现有 withdraw 测试省略了 `mobile_lan` 参数，实际走默认 `local`：[tier1-approval-live.test.ts:118](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/tier1-approval-live.test.ts:118)、[tier1-approval-live.test.ts:122](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/tier1-approval-live.test.ts:122)。

规格依据：[docs/09:1136](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1136) 明确要求手机不得释放 runtime gate，但 `withdraw` 应只撤 presentation，并保留 gate/receipt pending。

最小修法：仅对 runtime 的 `accept`/`reject` 返回 `untrusted_runtime`；让 `withdraw` 先进入现有 presentation-only 路径。补带 `"mobile_lan"` 的测试，断言 presentation 消失、receipt/gate pending，之后桌面仍可裁决。

## B 级

### B-1 CardResolver 对无 Focus/Lane 目标的状态仍宣称可“去泳道看”

证据：

- `resolved`、`expired`、`stale` 无条件给 `open_lane`：[cardResolver.ts:7](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/cardResolver.ts:7)、[cardResolver.ts:43](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/cardResolver.ts:43)、[cardResolver.ts:63](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/cardResolver.ts:63)。
- 没有 focus 时 `back` 实际是 `/m`，但三个状态仍显示“去泳道看”：[CardPage.tsx:59](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:59)、[CardPage.tsx:69](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:69)、[CardPage.tsx:173](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:173)。

可复现反例：打开一个 `focusId=null` 且已过期的 confirmation 卡；页面显示“去泳道看”，点击后却回到 Today。

规格依据：[docs/11:221](/Users/wangyixiao/WorkSpace/SayDo/docs/11-ui-spec.md:221)。

最小修法：只有 `ref/cached` 确实带 focus 或 lane hint 时生成相应动作；无目标的 stale/expired/resolved 应为零动作，或使用不声称“泳道”的返回动作。

### B-2 移动 HTTP/确认 DTO 仍在 contracts 外重复定义

证据：

- daemon 与移动端分别定义 `AttentionItem`：[attention.ts:13](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/attention.ts:13)、[mobile/types.ts:13](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/types.ts:13)；当前 producer 已有 `ackedAt`，consumer 类型即未同步。
- `FocusRow`、`FocusDetailPayload` 仍只在移动端手写：[mobile/types.ts:32](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/types.ts:32)、[mobile/types.ts:65](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/types.ts:65)，daemon 返回值则是另一份推断结构：[console.ts:696](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:696)。
- contracts 将 `confirm.resolved.outcome` 放成任意字符串：[pipeline.ts:66](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/pipeline.ts:66)，移动端另造三种成功 outcome：[confirmDecision.ts:4](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/confirmDecision.ts:4)。

可复现反例：修改 daemon 的 Focus/attention 字段或增加 outcome 拼写错误，console 仍能独立通过 TypeScript 编译，直到运行时才暴露漂移。

规格依据：用户本轮“contracts 类型不得分叉”要求及 [docs/09:1136](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1136)。

最小修法：在 `@saydo/contracts` 导出移动 Attention、Focus list/detail、confirm outcome 的严格 schema/type；daemon 返回值和 console runtime parse 均引用同一合同。

### B-3 关键验收测试仍会放过当前阻断

证据：

- 所谓 LAN 进程测试实际始终连接 `127.0.0.1`，仅伪造私网 Host/Origin：[mobile-lan-process.test.ts:26](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/mobile-lan-process.test.ts:26)。
- first-run E2E 直接 mock 成功响应，没有穿过 daemon：[console.spec.ts:154](/Users/wangyixiao/WorkSpace/SayDo/e2e/console/console.spec.ts:154)。
- withdraw 测试未传 `mobile_lan`，因此当前 A-4 仍可存在。
- 草稿单测只向 helper 喂入 transcript，无法区分本地乐观项和 daemon 回执。

规格依据：[v3.3:154](</Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:154>)、[v3.3:156](</Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:156>)。

最小修法：增加非 loopback socket 的 LAN 测试、真实浏览器 GET Origin 行为、Host 伪装拒绝、实际 first-run daemon 链、`mobile_lan` runtime withdraw，以及断线发生在 daemon ack 前的草稿保留测试。

## C 级

零。

## 49 号逐项结论

| 49 号项 | 结论 | 当前判断 |
|---|---|---|
| A-1 移动 WS 继承全控制面 | 仍开放 | 正常 `mobile_lan` 分支已过滤，但 A-1 的 Host 伪装可完全绕过 |
| A-2 来源被擦成 voice、可放行 runtime S2 | 仍开放 | 正常路径已传递 `via` 并阻断；伪装为 `local` 后仍可释放 |
| A-3 withdraw 伪消费 | Fixed（原缺陷） | presentation/approval 已分离；但回修新增本报告 A-4 |
| A-4 recovery-only 随开关暴露 | Fixed | recovery 使用独立 composition root，并继续绑定 `t2Cfg.listen`：[recoveryOnlyServer.ts:129](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:129)、[recoveryOnlyServer.ts:482](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:482) |
| A-5 发送竞态丢草稿 | 仍开放 | 本地乐观 transcript 仍被当作入队证明 |
| A-6 acked open obligation 被判 stale | Fixed | 有非终态 snapshot 时恢复为 live：[cardResolver.ts:60](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/cardResolver.ts:60) |
| B-1 确认文案及虚假泳道恢复 | 仍开放 | “做”副文案已精确；无目标仍显示“去泳道看” |
| B-2 missing 态仍有动作 | Fixed | resolver 返回空动作，页面不显示动作：[cardResolver.ts:69](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/cardResolver.ts:69)、[CardPage.tsx:66](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:66) |
| B-3 桌面 hash 缩窄为移动 404 | Fixed | 双向映射已接入：[router.ts:15](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/router.ts:15)、[App.tsx:136](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/App.tsx:136) |
| B-4 dstat 与离线输入 | Fixed | 首连/重连有 3 秒上界，离线只禁发送：[dstat.ts:29](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/dstat.ts:29)、[MobileChrome.tsx:74](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/MobileChrome.tsx:74) |
| B-5 Origin 缺省放行及 ULA/IPv4 分叉 | Fixed（原缺陷） | 缺 Origin 已拒，口径收敛为 RFC1918 IPv4；但新增 A-1/A-2 使整体网络门仍不可验收 |
| B-6 暴露完整 Focus 详情 | Fixed | 移动 DTO 已去 repo/artifact/session/raw payload：[console.ts:695](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:695) |
| B-7 CardRef/fourState/DTO 合同分叉 | 仍开放 | CardRef 分期和 fourState 已修；Attention、Focus、confirm outcome 仍分叉 |
| B-8 验收测试缺口 | 仍开放 | 重连成功、双向视口、env 清理已补；真实 LAN/browser、source-correct withdraw、daemon ack、真实 first-run 仍缺 |

补充核实：`expiresAt` 已从 durable 数据投影：[attention.ts:110](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/attention.ts:110)、[attention.ts:139](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/attention.ts:139)；四状态使用单个聚合 SQL 并复用 contracts 类型：[console.ts:364](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:364)、[focus.ts:81](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/focus.ts:81)。既有桌面源码改动仅 `App.tsx`，移动 CSS 静态检查保持 `.m-root` 作用域。

## 本轮实际验证

- `git rev-parse HEAD`：`415df2a86a5208c1f68672bab0c75618f3070594`。
- `pnpm typecheck`：退出码 0；原始摘要为 `contracts Done`、`daemon Done`、`console Done`。
- `pnpm lint`：退出码 0。
- `git diff --check 415df2a86a5208c1f68672bab0c75618f3070594`：退出码 0、无输出。
- 定向 Vitest 未执行成功：首次在写入 `packages/console/node_modules/.vite-temp` 时收到 `EPERM`；使用 runner/no-cache 重试后又在系统临时目录创建 `ssr` 目录时收到 `EPERM`，输出为 `Tests no tests`。因此本报告不声称任何单测或 E2E 已通过。
- 本轮只读，未修改任何文件。

## 施工 triage 与终局改判（2026-08-11）

- 原 4A：远端伪报 localhost/tailnet 已由 socket peer 分类拒绝；同源 GET 缺 Origin 仅在同 Host Referer 且 `Sec-Fetch-Site` 合法时通过；移动 runtime accept/reject 返回 source-only `untrusted_source`，withdraw 仍可用且不消费 gate/receipt；文本发送最终回到既有共享 WS，不再存在候选新增 ACK 前竞态。
- 原 3B：无 Focus 目标的卡零动作；Attention/Focus/confirm outcome 全部复用 contracts 严格 schema；真实 RFC1918 进程、真浏览器 Referer、fresh first-run、宽→窄→宽 Provider 恒一次、真实断网恢复和 withdraw 后桌面二次裁决均有回归证据。
- 终审删除越界 `turn.accepted`/durable outbox，而非继续扩张 daemon 处理协议；这同时关闭后续报告发现的重复 Brain、假 processed、隐私切换与桌面 ACK 泄漏。
- 最终验证：`pnpm ci:node` exit 0（91/86/1042），M1/first-run Playwright 8/8，daemon 定向 139/139；结论改判 **Go，A=0/B=0/C=0**。
