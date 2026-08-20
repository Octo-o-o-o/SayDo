# 69 移动外壳战略交叉对抗审

> 日期：2026-08-13；HEAD：`0fe5fe8a9e0bc85b89a2324da77cad5a7710cb97`；只读。  
> `git status --short` 当前有 17 条未提交或未跟踪项。未采用 `/Users/wangyixiao/WorkSpace/OctoDesk` 审计证据。本轮未跑真机，硬件行为结论标 `[warn]`。

## 终裁

采纳“薄壳 + 一套 React 移动产品面 + 各端不对称系统能力”，推翻材料 A 的无条件当前态和 20 份工时分配。材料 B 对 `mobile_lan` 的 Critical 判断成立；`tailnet` 同样被代码挡住，但与 `docs/09-data-contracts.md:1141` 的“bootstrap 仅 local”存在 canonical 分歧，不能未经 owner 拍板就扩大旁路。材料 B 的 A2 诊断成立，但实现处方还必须规定事件单一归属和去抖，不能把所有 `OPEN` 都禁止重连。CallKit/PushKit 是战略上应做的 P1，不是本周工作。

本周唯一收口定义：真实 LAN IP 手机进入一个明确的 `remote-mobile` 降级状态并挂载 `MobileApp`；不开放远程 `GET /api/setup/probe`，只保留既有移动 API；回前台事件在同一窗口内最多触发一次重连，健康 `OPEN` 不被普通 `visibilitychange` 打断。`127.0.0.1`、本机窄视口和模拟器不算验收。

## Findings

### A. `[fail]` 当前唯一用户阻断被材料 A 漏成了零工时

打哪份材料：材料 A 的当前态和 20 份分配见 `mobile-shell-strategy.canvas.tsx:201-204`、`:248-287`；材料 B 的 A1 见 `docs/review/2026-08-13-mobile-gap-audit.fable.md:23-25`、`:51-90`。

证据：

- `packages/daemon/src/net/mobileLan.ts:11-25` 的 GET 白名单没有 `/api/setup/probe`；单测 `packages/daemon/test/t2-thin.test.ts:187-200` 明确断言该路由为 `false`。
- `packages/daemon/src/index.ts:877-887` 对 `mobile_lan` 返回 `mobile_lan_route_rejected`；`:988-999` 对 `tailnet` 返回 `setup_local_only`。
- `packages/console/src/components/SetupBootstrapBoundary.tsx:20-23` 先判断 `probe-error`，再判断 `peeked`；`SetupBootstrapBoundary.test.ts:31-51` 锁死 `peeked:true` 也不能绕过。
- `packages/console/src/App.tsx:154-163` 把 `AppContent` 包在该 Boundary 内，因此远程 probe 失败时 `MobileApp` 不会挂载。

本机窄视口确实会掩盖问题：`packages/daemon/src/net/identity.ts:66-74` 只有 loopback peer 才判为 `local`；`packages/console/src/mobile/useMobileViewport.ts:14-24` 只决定移动树，不改变来源身份。

裁决：材料 B 对 `mobile_lan` 的阻断判断胜出。材料 A 的“能真机看页面、iOS 能按住说话”只能成立于 `via=local` 或已绕过该门的条件，不能当作真实手机 LAN 当前态。

### B. `[warn]` 材料 B 的旁路方向对，但“挂 AppContent”还不够

`peeked`、iPad 强制移动壳和 first-run 都不是隐藏旁路：

- `SetupBootstrapBoundary.tsx:142-148` 的 dev hash 旁路只发生在 `wizard` 分支，不能越过 `probe-error`。
- iOS 的 `__saydoForceMobileShell` 只在 `apps/ios/SayDo/WebContainer.swift:198-212` 注入，`useMobileViewport.ts:5-17` 只消费它来选树。
- `POST /api/setup/first-run/query` 虽在 `mobileLan.ts:25` 放行，但调用点在 `MobileChatPage.tsx:180-201`，必须先挂载 `MobileApp`。

还存在一个未被材料 B 写清的安全边界：`SetupBootstrapBoundary` 在 `AppContent` 外，而移动/桌面选择在 `App.tsx:140-151` 的 `AppContent` 内。若把两个错误码全局映射成普通 `app`，宽视口的远程 console 也可能挂载桌面树；这不是移动旁路，而是远程 setup fail-open。

最小正确形态应是 `remote-mobile` 状态：

- 先把 `ApiError.code` 从 `SetupContext.tsx:66-84` 传到 Boundary；
- 只对 probe 请求的 `mobile_lan_route_rejected`，以及 owner 认定属于 T2 的 `setup_local_only`，进入移动降级树；
- `token_mismatch`、`identity_rejected` 等仍停在错误卡；
- 宽视口远程 console 不得因此自动进入桌面应用。

iOS 原生胶囊也不能作为“已经进壳”的证据：`MobileApp.tsx:164-176` 才会安装 JS bridge，而 `apps/ios/SayDo/VoiceCapsule.swift:15-20` 要求 `bridge.pageReady` 和在线状态。

### C. `[ok]` 薄壳主轴正确；`Capacitor` 是文档决策，不是回滚命令

材料 A 的“不做三套 Today/卡/对话”见画布 `:42-46`；实际代码也支持它：

- iOS 是 `WebContainer + VoiceCapsule`：`apps/ios/SayDo/RootView.swift:17-47`；
- Android 是 WebView 壳：`apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:24-49`；
- 鸿蒙是 ArkWeb 加载同一页面：`apps/harmonyos/entry/src/main/ets/pages/Index.ets:137-155`；
- 共享 React 移动树的合同在 `docs/11-ui-spec.md:370-374`。

因此不应为了 D12 的旧文字重写成 Capacitor，也不应开始 SwiftUI/Compose/ArkUI 三套产品面。

但材料 A 的“仓里放弃 Capacitor，这一步是对的”不是已批准的 canonical 决策。`docs/03-architecture.md:156-162`、`docs/07-tech-stack-decisions.md:29-31`、`:146-151`、`docs/modules/d-presentation.md:16-23` 仍写 Capacitor；`docs/adr/README.md:5-10` 又明确设计 ADR-003 尚未成文。

方案含义：保留当前薄壳施工方向；在生产壳开工前由 owner 通过 ADR-003 决定“自写三端薄壳 + 共用桥”是否取代 D12，然后一次性回写 03、05、07、modules/d。不能静默改文档，也不应现在回滚代码。

### D. `[fail]` 材料 A 的 React 行数口径不成立

材料 A 声称行数“不含测试与资源文件”，见画布 `:37-38`、`:49-53`。本会话复验命令输出：

```text
iOS Swift                         2064 total
Android Kotlin                    905 total
Harmony ETS                       1195 total
React mobile non-test ts/tsx/css  3051 total
React mobile non-test ts/tsx       2095 total
React mobile test files             729 total
```

`2095 + 729 = 2824`，所以材料 A 的 React `2824` 实际上是排除了 CSS、但包含测试；三端原生总数则与画布数字一致。

这不改变“薄壳优先”的战略，但必须修正画布的量化证据，不能用错误行数支撑 20 份工时分配。

### E. `[ok]/[fail]` CallKit/PushKit 战略上应做，本周做会得到半截形状

材料 A 把 iOS CallKit/PushKit 列为 5 份、2–4 周，见画布 `:278-281`；材料 B 把“现在做 APNs/FCM/HMS、CallKit”列为不要做，见 `docs/review/2026-08-13-mobile-gap-audit.fable.md:339-347`。

代码核验：

```text
rg -n -i 'CallKit|PushKit|APNs|FCM|VoIP|UNUserNotification|PKPush|CXProvider' apps/ios apps/android apps/harmonyos
rg_exit=1
```

仓内原生三端没有这些实现。战略合同却明确把它放在 P1：`docs/05-roadmap.md:98`、`:111`，`docs/07-tech-stack-decisions.md:29`、`:140-149`，`docs/modules/d-presentation.md:18-23`。

材料 B 的“本周不要做”正确；若理解成“战略不要做”则过杀。`docs/plan/IMPLEMENTATION-PLAN-2.md:69-85` 把 R-B 配对/信任合同、APNs/FCM payload、PushKit/CallKit、设计 ADR-003、Apple Developer 账号列为前置；`:117-120` 还把这些依赖串起来，电话形态另有 40–55 工程日计划。

没有生产配对、opaque push payload、device-token digest、投递契约和 Apple 凭据面时，CallKit 只能做本地 UI/音频 spike，不是完整“来电式汇报”。

### F. `[warn]` Android 原生语音方向正确，但 1–2 周只够探针，不够产品化

材料 A 的“复用桥合同，1–2 周”见画布 `:284-287`；材料 B 的条件性判断见 `docs/review/2026-08-13-mobile-gap-audit.fable.md:160-165`。

证据：

- 共享桥只认 `saydoNative`：`packages/console/src/mobile/nativeBridge.ts:3-5`、`:118-125`，并要求 `webkit.messageHandlers` 与 `pageNonce`。
- Android `WebPanel` 的 `WebViewClient` 只有加载/错误处理：`apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:43-79`，没有等价 JS bridge；权限代码 `:80-99` 只是 WebView permission request。
- Android/Harmony 原生桥、原生采集、`TextToSpeech` 等匹配命令无结果：

```text
rg -n 'addJavascriptInterface|saydoNative|shouldOverrideUrlLoading|AudioRecord|AudioTrack|SpeechRecognizer|TextToSpeech' apps/android/app/src/main apps/harmonyos/entry/src/main
rg_exit=1
```

- M1 移动合同已经把底部话筒定义为聚焦输入、使用键盘话筒：`docs/11-ui-spec.md:372-374`；实际 UI 在 `packages/console/src/mobile/MobileChrome.tsx:87-100`。
- HEAD 新增的 `systemVoice` 是共享桌面 Chat 的浏览器回退，不是 Android 原生桥：`packages/console/src/pages/Chat.tsx:191-201`、`:301-329`。

因此本周不做 Android 原生语音。只有当日常狗粮机是 Android 时，才在 A1 后先做桥合同/中文识别/权限探针，再估生产批；不能把 1–2 周写成包含音频会话、后台中断、origin/nonce、TTS 和真机验收的交付量。

### G. `[fail]` 当前“配对”仍是 LAN 长期 token spike；源白名单可以先于 Noise

最新 HEAD 虽新增了配对入口，但代码证据仍是：

- `packages/console/src/components/PairingOverlay.tsx:1-11`；
- `packages/console/src/lib/pairing.ts:25-44` 直接生成 `http://lanIp:port/?token=<capToken>`；
- `packages/daemon/src/index.ts:962-985` 的 `pairing-info` 仅限本机。

三端 README 都明确没有 Noise、设备信任、一次性票据和正式威胁模型，例如 `apps/ios/README.md:14-18`。这不是 R-B 生产配对，不能把新浮层计入材料 A 的“生产配对 5”。

当前占坑战役也明确“不是送评估壳”：`docs/release/2026-08-13-store-submission-status.md:1-5`、`:19-31`；生产配对、明文 LAN、审核夹具仍是送审硬原因。

源白名单可以独立于 Noise 先做：

- iOS 已有 `allowsProfileURL` 主框门：`apps/ios/SayDo/WebContainer.swift:155-172`；
- Android 没有 `shouldOverrideUrlLoading`；
- 鸿蒙没有 `onLoadIntercept`，见 `apps/harmonyos/entry/src/main/ets/pages/Index.ets:137-155`。

所以建议先做提审前的 origin/profile/RFC1918/root-path 加固，再做一次性的 R-B 配对协议；源白名单本身不能冒充生产信任层。

### H. `[ok]/[warn]` DEC-9 夹具已选，壳内演示模式不是本周前置

`docs/release/2026-08-13-store-submission-status.md:11` 已选家里 Mac mini；`:41-45` 明确夹具尚未建立，壳内演示模式只是建议，不是 DEC-9 前置。`docs/release/2026-08-13-app-materials.md:142-144`、`:181-188` 也把三者拆开。

材料 A 的“4.2 演示模式 + 审核夹具 3 份”把必需的提审夹具和可选的壳内演示模式混成一个工作项。结论是：

- 本周不做演示账本或壳内 demo mode；
- 进入提审触发线后，先做生产壳、Mac mini 夹具、演示数据、二维码和视频；
- 壳内 demo mode 仍是可选项，不得用它掩盖真实连接问题。

### I. `[ok]/[warn]` A2 的“去双击、保留 iOS resume”判断成立，但处方要再收紧

证据：

- `useVoiceChannel.ts:392-417` 的 `forceReconnect` 会关闭 `OPEN/CONNECTING`，但自身的 `visibilitychange` 只在非 `OPEN` 时触发。
- `MobileApp.tsx:81-86` 另装一份无条件 `voice.reconnect()`。
- `reconnect.ts:28-48` 对 visibility、native resume、手动事件都调用同一回调；手动事件名又与 `useVoiceChannel.ts:124`、`:415-417` 相同。
- iOS 在 `RootView.swift:75-80` 发 resume token，`WebContainer.swift:46-52` 再发 `saydo:native-resume`。

因此 B 的重复路径是代码事实；但“切回来一定闪 offline”仍缺真机证据，标 `[warn]`。B 不把所有 `OPEN` 禁止重连是正确的：健康 `OPEN` 和 iOS 后台僵尸 `OPEN` 当前无法区分。

最终处方应是：

1. 去掉 MobileApp 的第二份 visibility 强制重连；
2. 手动事件只保留一个 owner，不能让 MobileApp 和 `useVoiceChannel` 各打一次；
3. native resume 暂时保留强制重连，并对 visibility/native resume 做短窗口合并；
4. 将 effect 依赖改为稳定的 `reconnect` 引用。

### J. `[fail]` 材料 B 的代码锚点已过期，但关键门控文件没有随之改变

材料 B 写的是 `cda99b8`，见 `docs/review/2026-08-13-mobile-gap-audit.fable.md:3-8`。最新独立命令得到 HEAD `0fe5fe8...`，中间已有 `40a607f`、`e7d1927`、`0fe5fe8` 三个提交。

本会话用 `git diff --quiet cda99b8..HEAD` 逐项核对，以下关键文件均输出 `unchanged`：

- `SetupBootstrapBoundary.tsx`
- `SetupContext.tsx`
- `App.tsx`
- `mobileLan.ts`
- `MobileApp.tsx`
- `reconnect.ts`
- `useVoiceChannel.ts`
- 三端 WebView 文件

所以 B 的 A1/A2 代码结论仍可用，但终稿必须刷新 HEAD 锚点，并补记 HEAD 新增的配对浮层和浏览器 system voice 范围。

## 硬矛盾裁决表

| 议题 | 材料 A | 材料 B | 代码终审 | 方案建议 |
|---|---|---|---|---|
| 当前能否真机远程进壳 | 能看页面，iOS 能按住说话 | 非 local 整壳被 probe 门挡住 | `[fail]` `mobile_lan` 明确被挡；`tailnet` 也 403；local 窄视口会掩盖 | 先修 mobile-only remote gate；tailnet 语义先按 owner 决策 canonical 化 |
| 薄壳还是三套 UI | 薄壳，原生 UI 0 | 不做 Capacitor 重写 | `[ok]` React 移动树 + 三个 WebView 壳；D12 仍是文档漂移 | 保留薄壳，不回滚；ADR-003 后统一回写 |
| CallKit/PushKit | 最值得加，5 份 | 现在不要做 | `[ok]` P1 产品形状；`[fail]` 当前无代码、无 R-B/APNs 前置 | 触发线后做，本周不做 |
| Android 原生语音 | 做，1–2 周 | 仅非 iPhone 狗粮机考虑 | `[fail]` 没有 Android bridge；`[ok]` M1 键盘话筒已有 | 先桥探针，再估生产批 |
| 生产配对 | 必须且只做一次 | M2 正批，当前不做 | 当前 HEAD 只有长期 token QR，不是 Noise/R-B | 提审前做源白名单；R-B 后置且只保留一套协议 |
| 4.7 源白名单 | 上架硬门 | 提审前壳加固 | iOS 有，Android/Harmony 缺 | 可以先于 Noise，列入提审触发线 |
| 4.2 演示 | 3 份，模式和夹具一起 | DEC-9 已选，模式非前置 | Mac mini 已选，夹具未建，模式可选 | 提审前执行夹具；本周不做模式 |
| 回前台重连 | 未给主张 | 去双击，保 iOS resume | 重复调用真实存在；健康/僵尸 `OPEN` 无真机裁决 | 单一事件 owner + 去抖，保留 native resume |
| 证据新鲜度 | React 2824 且不含测试 | 锚 cda99b8 | React 2824 含 729 行测试；HEAD 已到 0fe5fe8 | 修正文档数字与锚点 |

## 证伪

- `[fail]` 材料 A：`“能真机看页面、iOS 能按住说话”`（画布 `:201-204`）。  
  实际：非 local 请求先在 `SetupBootstrapBoundary` 进入 `probe-error`，`AppContent/MobileApp` 不挂载；这句话只能作为 local/spike 条件描述。

- `[fail]` 材料 A：`“行数来自 wc -l，不含测试与资源文件”`（画布 `:37-38`）。  
  实际：React 非测试 TS/TSX 为 2095 行，测试为 729 行，`2824` 正好包含测试。

- `[warn]` 材料 B：`“现在做 APNs/FCM/HMS、CallKit、Live Activity”`列入明确不要做（`:345-347`）。  
  实际：若指“本周不做”成立；若指“战略不做”被 `docs/05-roadmap.md:98`、`docs/07-tech-stack-decisions.md:29` 推翻。

- `[warn]` 材料 B：`“壳内演示模式 / 审核夹具工程化……不做”`（`:351`）。  
  实际：壳内模式确实非前置，但审核夹具在 `docs/release/2026-08-13-store-submission-status.md:41-45` 已选且尚未建立，送审前仍必须执行。

- `[fail]` 材料 B：`“代码锚 cda99b8”`（`:6`）。  
  实际：本会话最新 `git rev-parse HEAD` 为 `0fe5fe8a9e0bc85b89a2324da77cad5a7710cb97`。

## 可派工条件

### 本周做

只派两个竖切任务：

1. **Remote mobile gate**
   - 保持 daemon 对远程 `GET /api/setup/probe` 的拒绝；
   - `SetupContext` 保留 `ApiError.code`；
   - 只对允许的远程错误码进入 `remote-mobile` 状态；
   - 明确验证 `MobileApp` 真挂载、`/api/attention`、文本发送和 first-run query 可走；
   - `token_mismatch`、`identity_rejected` 仍停在错误卡；
   - 用真实 LAN IP 验收，tailnet 行为先按 owner 的 canonical 决策验收。

2. **Foreground reconnect 去重**
   - 删除第二份 visibility 强制重连；
   - 手动事件只留一个处理者；
   - 保留 native resume 强制重连并做短窗口合并；
   - 增加 `OPEN`、`CONNECTING`、僵尸模拟和事件连发测试。

B1/B3/B4 只能在上述两项不扩范围时顺手处理，不进入本周唯一收口定义。

### 本周不做

- Capacitor 重写或三套原生 Today/卡/对话；
- R-B/Noise/一次性票据的完整生产配对；
- CallKit/PushKit/APNs/FCM；
- Android 原生语音生产实现；
- 壳内演示账本和深链接线；
- 为了“对等”补鸿蒙原生语音、PTR 或动画。

### 触发线后再做

按顺序：

1. 提审前壳加固：Android/Harmony 主导航源白名单、RFC1918/根路径校验、HTTPS 或等价密文、明文策略、鸿蒙相机权限。
2. owner 通过 ADR-003 后，落 R-B 配对/信任五件套，替换当前长期 token QR 路径，不并行维护第二套协议。
3. 生产壳可验收后执行 DEC-9 Mac mini 夹具、演示数据、二维码和视频。
4. R-B、Apple Developer/APNs 凭据和 dogfood 离机数据都具备后，再开 iOS CallKit/PushKit。
5. 只有日常设备确实是 Android 时，才开 Android bridge/音频探针和后续原生语音批。

### 需要 owner 拍板

- `tailnet` 的 `setup_local_only`：是继续遵守 `docs/09-data-contracts.md:1141` 的 local-only bootstrap，还是正式把 T2 tailnet 手机纳入 remote-mobile 降级壳；选定后必须回写 canonical。
- 设计 ADR-003：D12 是否改为“三份薄原生壳 + 共用 React/bridge”。
- CallKit 的 Apple Developer 费用、VoIP 审核风险和 dogfood 触发数据。
- 鸿蒙是否长期降为通道，以及壳内 demo mode 是否值得单独立项。

终稿必须删除 A 的“当前已能真机远程使用”无条件表述、修正 React 行数和 B 的旧 HEAD 锚点，并把“CallKit 不做”改成“本周不做、触发线后做”。