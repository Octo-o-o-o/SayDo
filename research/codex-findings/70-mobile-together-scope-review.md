# 70 移动第 0 步同批范围对抗审

> 日期：2026-08-13；HEAD：`e987f051ce52f3fb70435a06402d73b7a52d190f`。  
> 依据：`git rev-parse HEAD`、当前工作树源码与指定材料；只读，未改仓库文件，未运行会写临时文件的 Playwright 或真机测试。终稿和 69 号材料里的 `0fe5fe8` 是旧代码锚，本审以当前 HEAD 和当前源码行号为准。

## 终裁

收窄第 0 步同批定义，不扩大战略范围。代码同批只保留两条竖切：一是按精确错误码进入 `remote-mobile`，并直接挂 `MobileApp`；二是回前台重连去重，同时保留 iOS `native-resume`。另有两项非竖切收口条件：把三条现有 GET 及其隐私边界写回 `docs/09`，以及用真实 RFC1918 LAN、横屏、Today/Things、文本和 first-run 做定向证据。B3 `reload` 是真实 UX 缺口，但不是 A1 门禁条件，降为“无范围扩张时顺手”；en0 fallback 只在配对主机实际不合格时触发。CallKit、Android 原生语音、Noise、三端源白名单、Android force flag、`just dev` 默认开 LAN、原生 PTR、刘海/键盘/B1/B4 仍后置。

## Findings

1. **probe-error 旁路必须是新 kind**

   - 打终稿哪一句：§3 同批第 1 条、§7 表第一行。
   - 证据：`packages/console/src/components/SetupBootstrapBoundary.tsx:10-23` 当前没有 `remote-mobile`；`packages/console/src/lib/setupApi.ts:402-405` 明确 `isDialogReadyFromProbe(null)` 为 `false`；`SetupContext.tsx:76-80` 只保存 `e.message`，丢掉 `ApiError.code`。现有测试 `SetupBootstrapBoundary.test.ts:31-51` 还锁着 `peeked=true` 也不能越过 `probe-error`。
   - 对派工：结论成立，但“必然进 wizard”应限定为首开 `peeked=false`。必须保留错误码来源，只对本次 probe 的 `mobile_lan_route_rejected`，以及 owner 批准的 `setup_local_only` 进入新 kind；`origin_rejected`、`host_rejected`、`token_missing`、`token_mismatch` 等继续错误卡。

2. **横屏直接挂移动树，不得让视口自行选树**

   - 打终稿哪一句：§3 同批第 2 条。
   - 证据：`packages/console/src/mobile/useMobileViewport.ts:3,10-24` 以 `<768` 判移动；`apps/ios/SayDo/WebContainer.swift:200-204` 只在 iPad 注入 `__saydoForceMobileShell`；Android `WebPanel.kt:36-42`、鸿蒙 `Index.ets:137-155` 没有同类注入。`App.tsx:140-151` 的宽屏分支会进桌面树；`packages/daemon/src/index.ts:877-887` 与 `t2-thin.test.ts:196-199` 证明 LAN 下 `/api/overview` 等路由不在白名单。
   - 对派工：结论成立。`remote-mobile` 必须有独立 wrapper，负责取得 `useMobileRoute` 后挂 `MobileApp`；不能把 `remote-mobile` 映射成普通 `app`，也不能只改 `useMobileViewport`。

3. **A2 双重重连是同批必修；B3 不是**

   - 打终稿哪一句：§3 前台重连条目，以及 §3 同批第 3 条。
   - 证据：`MobileApp.tsx:81-86` 无条件调用 `voice.reconnect()`；`reconnect.ts:32-48` 对 visibility、native-resume、手动事件都触发；`useVoiceChannel.ts:409-417` 自己也监听 visibility/同名手动事件，且 `392-407` 会关闭 `OPEN/CONNECTING`。`VoiceContext.tsx:75-77` 每次返回新对象，而 `useVoiceChannel.ts:689-691` 的 `reconnect` 本身是稳定引用。
   - 对派工：A2 必须做，但删除 `MobileApp` effect 时不能丢掉 native-resume；应由一个 owner 统一处理并做短窗口合并。B3 方面，`hooks.ts:5-27` 确有 `reload`，但 `TodayPage.tsx:12-21`、`ThingsPage.tsx:11-16` 只收 `error`，且 `MobileNotice.tsx:232-233` 没有动作入口。审计将其列为 Medium（`docs/review/2026-08-13-mobile-gap-audit.fable.md:146-150`），69 号也明确说只在不扩范围时顺手（`research/codex-findings/69-mobile-shell-strategy-review.md:213-233`）。它造成最多 30 秒等待，不阻断 A1 进壳、文本或 WS，故不纳入收口门。

4. **09 回写必须同批，但终稿对“谁依赖三条”说宽了**

   - 打终稿哪一句：§3 同批第 4 条、§7 E2。
   - 证据：`packages/daemon/src/net/mobileLan.ts:11-25` 和 `t2-thin.test.ts:187-199` 已放行三条 GET；`packages/console/src/mobile/ChatPage.tsx:162-177` 直接使用 `recent-transcript`，`MobileChrome.tsx:131-149` 直接使用 `memory/recent`。`rg -n 'loadProjectMemory|loadRecentTranscript|loadRecentMemories' packages/console/src` 的结果显示 `loadProjectMemory` 目前只有 `data.ts:84-87` 定义和测试引用，没有当前页面调用。`docs/09-data-contracts.md:1143` 仍未登记三条路径。
   - 对派工：E2 必须回写 `docs/09`，不能只在 PR 说明里写一句；但表述应改成“前两条已有直接消费者，第三条是现有 allowlist/helper 合同”，不要声称 Chat/菜单当前都调用三条。按审计 `docs/review/2026-08-13-mobile-gap-audit.fable.md:238-242`，回写还要写清 transcript 的 `sessionId`/原文和 memory 的全文 claim 边界，不是只加路径名。

5. **A1 必须拉绿定向 LAN 用例，不必救全部 29 条桌面用例**

   - 打终稿哪一句：§3 验收条件；问题 5。
   - 证据：`e2e/console/global-setup.ts:54-75` 启动了 `SAYDO_MOBILE_LAN=1` 并只种 fixture；`packages/daemon/src/api/fixture.ts:17-20` 只处理空库种子，不会武装 dialog，也不设置 `saydo.setup.peeked`。`console.spec.ts:26-29` 的 `open()` 不做 peek；直接 LAN 用例在 `195-209`，first-run 用例在 `182-193`。当前 probe 路由会先在 `index.ts:877-887` 返回 403，因此这些定向 LAN 用例在现状下会卡在 probe-error。
   - 对派工：A1 需要定向跑 LAN Today、横屏、文本和 first-run 证据；确认卡可在有夹具时补。`docs/11-ui-spec.md:575` 和 `docs/plan/2026-08-13-ui-standardization-audit.md:182-190` 将 `29 failed/3 passed` 归因为 T19 首启向导与本地 e2e 装配不匹配，不是 LAN probe 结论。不要为本周顺手改 global-setup 去救全部桌面用例。

6. **origin_rejected 不能旁路；WKWebView 行为仍是 [warn]**

   - 打终稿哪一句：终稿关于“只匹配两个远程 code、auth fail-closed”的约束；问题 6。
   - 证据：`packages/daemon/src/net/identity.ts:89-107` 要求 mobile LAN 缺 Origin 时有同 Host Referer，`140-158` 对来源或 token 失败统一拒绝。`packages/console/src/lib/api.ts:88-99,128-130` 的 `fetch` 没有显式设置 Referer，只依赖浏览器行为。Playwright 用例 `e2e/console/console.spec.ts:195-209` 证明 Chromium 的“无 Origin + 同源 Referer”能过；进程测试 `mobile-lan-process.test.ts:88-108` 证明缺 Referer 或跨站 Referer 必须得到 `origin_rejected`。
   - 对派工：不能把 Chromium 结果外推为 WKWebView 已验证。真机要记录 API/WS 的 Origin、Referer、`Sec-Fetch-Site`；若 iOS 复现 `origin_rejected`，需 owner 决定合法来源证明方案。本轮不改 G1 的 fail-closed，也不把 `origin_rejected` 加入 `remote-mobile`。

7. **en0 只认接口的风险是条件性，不是现在预做 fallback**

   - 打终稿哪一句：§3/§7 “浮层报错再扩 en0”。
   - 证据：`packages/daemon/src/net/pairingInfo.ts:16-22` 只扫 `en0`，且只排除 internal，不判断 RFC1918；`packages/console/src/lib/pairing.ts:25-33` 只要 `lanIp` 非空就生成二维码。相反，G1 `identity.ts:26-33,72-74` 只接受 RFC1918 Host/peer。测试 harness `global-setup.ts:18-30` 已是“所有接口中找 RFC1918”，说明产品配对与测试前置条件不一致。
   - 对派工：本周不预写 fallback，但验收触发条件不能只写“浮层报错”：还要检查二维码 Host 是否 RFC1918、扫码后是否得到 `host_rejected`。若 en0 返回非 RFC1918 地址或实际扫描失败，再触发 fallback；是否把该支持前移需 owner 拍板。缺真机照片，标 [warn]，不据此否掉源码机制。

8. **确认卡独立 WS 和 first-run 没有额外 mobile_lan 阻断**

   - 打终稿哪一句：§7 “确认卡独立 WS / hub 广播 / 音频中断仍后置”。
   - 证据：`packages/console/src/mobile/confirmDecision.ts:39-85` 独立 WS 先 hello 再发 `confirm.decision`；`packages/daemon/src/voice/hub.ts:140-156,183-205,443-458` 放行该上行及 `confirm.resolved` 下行，并统一做身份校验；`live/dialog.ts:1083-1103` 对 mobile runtime effect 返回 `untrusted_runtime`，withdraw 仍可用。`ChatPage.tsx:179-201` 会重试 `delivered=false`，`219-220` 明确提示不影响继续对话。
   - 对派工：没有新的同批代码债。验收有卡时做一次定向确认；first-run 只需验证“可取到或明确提示且仍可发文本”，不把 `delivered=false` 升格为入口阻断。

9. **iOS PTR 不需要与 A2 同批改原生实现**

   - 打终稿哪一句：终稿和 69 号“不为对等补原生 PTR”。
   - 证据：`apps/ios/SayDo/WebContainer.swift:80-89,139-148,175-177` 的下拉刷新是 `webView.reload()`，并结束 refresh；原生回前台另走 `RootView.swift:75-80` → `WebContainer.swift:46-53` 的 `saydo:native-resume`。网页侧去重路径在 `reconnect.ts:32-48` 和 `useVoiceChannel.ts:392-417`，当前没有 PTR 直接派发该事件的路径。
   - 对派工：不改原生 PTR。A2 收口后只验一次下拉刷新、一次切后台回前台，确认 WS 不出现双开；若真机时序失败，再另开问题。

10. **§7 之外没有新的运行时代码竖切；有两项收口补充**

   - 打终稿哪一句：§7“没有新的 Critical”。
   - 证据：token 注入在 `packages/console/src/lib/api.ts:20-27`；iOS 本地网络 ATS 在 `apps/ios/SayDo/Info.plist:23-31`；Android Internet/cleartext 在 `AndroidManifest.xml:4-6,23`；鸿蒙 Internet 在 `module.json5:28-30`；移动 API/WS 路由分别由 `mobileLan.ts:11-25`、`hub.ts:140-156` 锁定。审计正面确认也覆盖 token、WS、native.reply（`docs/review/2026-08-13-mobile-gap-audit.fable.md:324-332`）。
   - 对派工：没有新 runtime 必修项。新增的只是 E2 文档边界和 QR RFC1918 预检，均不构成第三条竖切。没有证据推翻 69 对薄壳、CallKit、Android 语音、Noise 的裁决。

## 对 §7 十条候选的逐条裁决

| 候选 | 终稿主张 | 代码终审 | 派工 |
|---|---|---|---|
| 1. 只跳过 probe-error | 新 `remote-mobile` 必须做 | [ok] 对首开成立；不能把所有 probe 失败都旁路 | A1 必修，精确 code + 单测 |
| 2. 横屏/force flag | 直接挂 `MobileApp` | [ok] 成立；iPhone 横屏会越过 `<768`，LAN 桌面 API 受拒 | A1 必修，补 LAN 横屏证据 |
| 3. B3 reload | 与 A2 同批，否则 A1 会踩 | [warn] 缺口真实，但只是 30 秒恢复延迟，不是 A1 门禁 | 从收口定义拿掉；无扩散时顺手 |
| 4. 09 三条 GET | 同批回写 | [ok] 合同分叉真实；[warn] 当前直接消费者主要是前两条 | 同批写回三条及 payload/privacy 边界 |
| 5. LAN e2e / global-setup | A1 需定向拉绿 | [ok] LAN 专项当前受 probe 门；29/3 是本地向导基线 | 跑专项，不救全部 29 条桌面用例 |
| 6. origin_rejected | 缺 Origin 需同源 Referer | [ok] G1 逻辑成立；[warn] WKWebView 未实测 | 保持 fail-closed，真机记录来源头 |
| 7. en0 | 浮层报错再扩 | [warn] 非 RFC1918 en0 不一定触发浮层错误 | 先做 RFC1918/扫码预检，失败再扩 |
| 8. 确认 WS/first-run | 后置 | [ok] 代码无额外 mobile_lan 阻断，first-run 不挡聊天 | 不增代码竖切，做定向验收 |
| 9. PTR 与 A2 | 不补原生 PTR | [ok] 两条路径独立 | 不改原生 PTR，验收时观察 |
| 10. 新发现 | §7 无新 Critical | [ok] 无新运行时竖切；有 E2 边界与 QR 预检补充 | 不加 CallKit/Android voice/Noise 等 |

## 证伪

- [fail] 终稿 §3 第 3 条“**不传 reload，A1 验收当天就会踩**”：源码只证明失败后等待 30 秒轮询，没有证明 A1 入口、文本、WS 或 first-run 会因此不可达。
- [fail] 终稿 §3 第 4 条“**Chat 回放和菜单记忆已经依赖三条 GET**”：`recent-transcript` 和 `memory/recent` 有直接调用；`loadProjectMemory` 当前只有定义和测试引用。三条仍应回写合同，但理由要改窄。
- [warn] 终稿 §3/§7“**浮层报错再扩 en0**”：当前浮层只对 `lanIp=null` 报错；非 RFC1918 的非空 en0 会生成二维码，随后被 G1 拒绝，不一定出现浮层提示。
- [fail] 体检 `docs/review/2026-08-13-mobile-gap-audit.fable.md:90` 的“挂 `AppContent`”处方已被代码证伪：`App.tsx:149-151` 会按宽度选桌面树，69 号和终稿改成直接 `MobileApp` 才是安全形态。
- [warn] 不能把 `docs/11-ui-spec.md:575` 的 `29 failed/3 passed` 当作 LAN probe 结果；该行明确归因于本地 e2e 未武装 dialog 与 `open()` 不 peek。

## 可派工条件

1. **Remote mobile gate**

   - 保持 daemon 拒绝远程 `GET /api/setup/probe`。
   - `SetupContext` 保留 `ApiError.code` 及当前 probe 请求语境。
   - 仅允许 `mobile_lan_route_rejected`；`setup_local_only` 是否纳入取决于 owner 对 tailnet 的决定。
   - 新 `remote-mobile` wrapper 自己取得 `useMobileRoute` 并直接挂 `MobileApp`，不得走 `AppContent`、`useMobileViewport` 或桌面 `Layout`。
   - 单测覆盖：未 peek 首开、已 peek、`token_mismatch`/`origin_rejected`、宽视口 remote-mobile 仍为移动树。

2. **Foreground reconnect**

   - 一个 owner 处理 visibility、手动事件和 native-resume；不能简单删掉 `MobileApp` effect 后丢 iOS resume。
   - 依赖稳定的 `reconnect` 引用，短窗口合并事件。
   - 覆盖 `OPEN`、`CONNECTING`、僵尸、事件连发；不把“健康 OPEN 是否应重连”改成未经真机证明的绝对规则。

3. **E2 合同回写**

   - 在 `docs/09-data-contracts.md:1143` 的 M1 段登记三条现有 GET。
   - 同时写清 transcript 的 `sessionId`/原文、memory claim/source 的移动边界；只写路径名不算合同收口。
   - 不改 allowlist 语义，不因文档遗漏而删除现有路由。

4. **定向验收**

   - 使用真实 RFC1918 LAN 二维码，不用 `127.0.0.1`、本机窄窗或仅竖屏。
   - 至少验证 Today、Things、文本发送、first-run；有确认夹具时验证一次独立 confirm WS。
   - 包含 iPhone 横屏，并记录 API/WS 的 Origin、Referer、`Sec-Fetch-Site`。
   - 二维码 Host 必须先通过 RFC1918 检查；若当前 en0 非法或扫码后 `host_rejected`，再触发 fallback。

5. **明确的范围取舍**

   - B3 从“必修”拿掉，原因是 Medium UX 缺口、影响是轮询延迟而非 A1 可达性，且实际会触及 `MobileNotice`/Today/Things 多文件；可以在 A2 不扩散时顺手。
   - global-setup 的 29 条桌面红保留为 T19 基线，不并入本周移动 gate。
   - tailnet 的 `setup_local_only` 需 owner 拍板；未拍板前不纳入本周验收。
   - CallKit、Android 原生语音、Noise、三端源白名单、Android force flag、默认开启 `SAYDO_MOBILE_LAN`、原生 PTR、刘海/键盘/B1/B4继续后置。