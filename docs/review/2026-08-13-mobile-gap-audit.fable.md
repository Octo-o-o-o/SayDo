# 移动端缺口、阻断与规范体检

> 施工顺序与旁路处方以 `docs/review/2026-08-13-mobile-shell-strategy-final.fable.md` 为准(2026-08-13 交叉对比 + Codex 69)。本文保留证据链;「CallKit 不要做」应读成本周不做;旁路须 `remote-mobile` 而不是把错误码映射成 `app`。
>
> 日期:2026-08-13
> 审计范围:原生三端壳(`apps/ios|android|harmonyos`)+ console 移动面(`packages/console/src/mobile`)+ daemon `mobile_lan` 访问面
> 深度档位:尽调级(4 路并行发现 + 2 路独立证伪 + 主会话逐条读代码)
> 代码锚:`cda99b83a44d72a2db7ff4c439082abf07f431c5` (`cda99b8`;后续 HEAD `0fe5fe8` 未改本文所列门控文件)
> 参与:主会话 + 4 finder + 2 verifier
> 对照合同:`docs/11-ui-spec.md` §5.6b/§5.8a、`docs/09-data-contracts.md` M1 移动 LAN 段、三端 README、`docs/release/*`

本报告回答三件事:**现在手机真正用不了什么**、**哪些看起来像缺口其实不该做**、**修了有没有完整回报**。
未经本会话读到的代码不作发现。核验标签:`[ok]CONFIRMED` / `[warn]PLAUSIBLE` / `[fail]REFUTED`。

---

## TL;DR

当前移动端不是「功能少一点的桌面」，而是三层叠在一起:

1. **M1 Web 壳**(窄屏独立树):今天 / 事 / 确认卡 / 开口聊,合同允许只读+文本+键盘听写。
2. **iOS M2-voice-a**:原生按住说话、Focus 托盘、系统 TTS、WKWebView 桥。只存在于 iOS。
3. **Android / 鸿蒙**:评估用 WebView 壳,无原生语音桥;明文 LAN + 长期 token。文档已写明 spike,禁止送审。

**唯一 Critical(远程手机整壳不可用):**T19 把 `SetupBootstrapBoundary` 做成硬门后,凡 `via` 不是 `local` 的 console 都过不了 `GET /api/setup/probe`——`mobile_lan` 得 `mobile_lan_route_rejected`,`tailnet`(W2 已交付的 T2 薄版)得 `setup_local_only`。两种 403 都被收成「没连上本机服务」,`MobileApp` 永不挂载。本机窄视口(via=`local`)不受影响,模拟器打 127.0.0.1 同样掩盖。相对 2026-08-12 的 iOS 语音闭环和更早的 T2 薄版,这是回归。

**本周有完整回报的只有两件事:**① 按错误码旁路 setup 门(解锁 LAN 壳、T2 薄版、已做好的 iOS 语音);② 去掉回前台的**重复**强制重连(不是禁止 iOS resume 重连)。其余多数是分期边界、提审债或合同漂移。

计数(通读校准后,按**当前战役价值**):Critical 1 / High 1 / 本周值得顺手的 Medium 3。商店虚假披露、手机 TTS blob 泄漏两条原 High **不成立**。

---

## 0. 现状地图(先对齐再谈缺口)

| 层 | 现在能做什么 | 明确不做 / 未做 |
|---|---|---|
| daemon `SAYDO_MOBILE_LAN=1` | 听 `0.0.0.0`;RFC1918 Host+peer+token;S3 拒;runtime_effect 手机裁决回桌面 | Noise / 逐设备身份 / HTTPS;probe 不在白名单 |
| console `#/m…` | 今天、事、Focus/泳道、确认卡、开口聊、菜单记忆只读 | 设置写口、配对管理、S3、Board/Review/产物库 |
| iOS 壳 | 扫码、多桌面、Keychain、主导航 origin 门、原生 ASR/TTS/桥 | 深链、生产配对、ATS 仅本地网络 |
| Android 壳 | 扫码、多桌面、Keystore、下拉刷新、失败重试 | 原生语音、主导航白名单、LAN IP 强制 |
| 鸿蒙壳 | 扫码(动态 ScanKit)、多桌面、HUKS、失败重试 | 相机权限声明、原生语音、下拉刷新、主导航门 |

产品合同本来就把「手机沟通 + 桌面执行」放在 T2,配对五件套放在 M2。把 W7.3 Capacitor/推送/CallKit 写成「现在的缺口」会误导——那是未开工的生产外壳,不是当前评估壳的缺陷。

---

## 1. 发现(按当前阶段价值,不是按发现顺序)

严重度在本节已按「修了能否完整收回成本」校准。技术上限若更高,在条目里另注。

### A. 真阻断 — 修了立刻收回全部已交付能力

#### A1 · Critical · 非 local 的手机 console 被 setup probe 门永久挡住

- **核验:**`[ok]CONFIRMED`(独立 verifier 同意;通读后范围扩大到 tailnet,见下)
- **触发:**
  1. 手机扫 LAN 码(`SAYDO_MOBILE_LAN=1`)或经 Tailscale 打开 console;
  2. `SetupProvider` 必调 `GET /api/setup/probe`;
  3. `via=mobile_lan` → 白名单 403 `mobile_lan_route_rejected`;`via=tailnet` → 显式 403 `setup_local_only`(`index.ts:961-973`,行号勘误 2026-08-27:原引 988-998 为 probe 响应拼装段);
  4. `resolveSetupBootstrapState` 进 `probe-error` → 全屏「没连上本机服务」→ `AppContent`/`MobileApp` 不挂载。点重试仍打同一 403。
- **证据:**

```11:26:packages/daemon/src/net/mobileLan.ts
export function mobileLanApiAllowed(method: string | undefined, pathname: string): boolean {
  if (method === "GET") {
    // attention / focuses / recent-transcript / memory ...
  }
  return method === "POST" && pathname === "/api/setup/first-run/query";
}
```

`packages/daemon/test/t2-thin.test.ts:196` 锁死 `GET /api/setup/probe` 为 false。`packages/daemon/src/index.ts:875-885` 对未放行路由直接 403。

```20:23:packages/console/src/components/SetupBootstrapBoundary.tsx
  if (input.loading) return input.showLoading ? "loading" : "pending";
  if (!input.probePresent && input.probeError) return "probe-error";
  if (!input.dialogReady && !input.peeked) return "wizard";
  return "app";
```

`SetupBootstrapBoundary.test.ts:42-51` 显式锁死:`peeked:true` 也不能逃出 `probe-error`。

- **合同:**`docs/11-ui-spec.md` §5.6b / §5.8a:真实 `mobile_lan` 不开放 setup probe,应走连接 Loading/降级,不得静默套桌面向导。T2 薄版同样不应进本机向导。实现把两种远程面都收成了「没连上」。
- **为何桌面验收看不出来:**本机窄视口 Host=`127.0.0.1` 且 peer 环回 → `via=local`,probe 放行。iOS 模拟器打本机 loopback 同样掩盖。真机 LAN IP 或 tailnet 名才踩坑。`research/codex-findings/66-wizard-ux-review.md:28-31` 在 T19 开工前已预警。
- **回归:**M2-voice-a(`2f49597`,2026-08-12)时尚无这道硬门;T19 之后,已交付的 iOS 原生语音和 W2 T2 薄版在远程面上整条不可达。
- **容易写错的修复(不完整回报):**
  - **不要**对所有 403 / 所有 probe 失败 fail-open。`token_mismatch` / `identity_rejected` 仍应停在错误卡,否则错码会伪装成空账本。
  - **不要**为此开放完整 `/api/setup/probe` 给 remote——配置画像会进 LAN/tailnet 明文面。
  - 现状 `SetupContext` 只把 `e.message` 写入 `probeError`,丢掉了 `ApiError.code`(`SetupContext.tsx:76-80`)。旁路必须先把 `mobile_lan_route_rejected` 与 `setup_local_only` 传到 boundary,不能拿中文文案做匹配。
- **正确修复(完整回报):**上述两个 code → 视为「远程面,跳过本机向导门」,挂 `AppContent`,用 §5.6b 连接态。本机 `via=local` 的 probe 失败保持第三态。开关 `SAYDO_MOBILE_LAN` 未打开时 LAN 根本进不了 G1,那是设计如此,不是本条。
- **附带事实:**`VoiceProvider` 在 boundary **外**,probe-error 屏底下 WS 可能已经连上。所以这是 UI 门的回归,不是传输层没做完。A1 修好后,`POST /api/setup/first-run/query` 已在白名单,开场白链路无需再开 API。
- **回报:**解锁今天/确认卡/开口聊/iOS 胶囊,以及本应能用的 T2 薄版。不做则后续一切移动体验讨论都是纸面。

---

#### A2 · High · 回前台把同一根连接拆两次(不要误修成「OPEN 绝不重连」)

- **核验:**`[ok]CONFIRMED`(有害的是叠加;「禁止 OPEN 时重连」本身**未**被真机证伪,见修复边界)
- **触发:**App 从后台回来时,下面几条会叠在一起,把已经 `OPEN` 的 WS `close()` 再建,状态闪 `offline`/禁发:
  - `MobileApp` 无条件 `voice.reconnect()`(`visibilitychange` + `saydo:native-resume` + 手动事件);
  - `useVoiceChannel` 自己也对 `saydo:reconnect-request` 做 `forceReconnect`;
  - iOS `scenePhase.active` 再派一次 `native-resume`。
- **证据:**`useVoiceChannel` 自己的 visibility 监听是克制的(仅非 OPEN 才重连):

```409:414:packages/console/src/voice/useVoiceChannel.ts
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) forceReconnect();
    };
```

但 `MobileApp` 绕开了这层保护:

```81:86:packages/console/src/mobile/MobileApp.tsx
  useEffect(() => {
    return installMobileForegroundReconnect(() => {
      voice.reconnect();
    });
  }, [voice]);
```

`voice.reconnect()` = `forceReconnect()`,OPEN 也会 `close()`。`installMobileForegroundReconnect` 对 visible / `saydo:native-resume` / `saydo:reconnect-request` 一律 `fire()`。iOS 回前台还会 `notifyNativeResume()`,与 `visibilitychange` 叠成双击。手动「重连」按钮事件名与 `useVoiceChannel` 的 `WS_RECONNECT_REQUEST_EVENT` 相同,会各打一次。

另:`MobileApp` 该 effect 依赖整个 `voice` 对象;`useVoiceChannel` 每次 render 返回新对象,监听器会高频拆装(有 dispose,不是泄漏,但是抖动窗口)。

- **不完整回报(通读时改掉的处方):**把 native-resume 也改成「OPEN 则不动」。iOS 后台经常留下僵尸 OPEN(close 事件不上来),强制重连可能是故意的,本会话**没有**真机证据能证伪它。一刀切会把「切微信回来能续上」修成「看起来连着其实已经死」。
- **正确修复(完整回报):**
  1. 删掉 `MobileApp` 对 `visibilitychange` 的第二份监听,只留 `useVoiceChannel` 那份「非 OPEN 才重连」;
  2. `native-resume` 与手动重连各只走一条 `forceReconnect`,去重/合并,不要双击;
  3. effect deps 改稳定的 `reconnect` 引用。
- **回报:**A1 之后最常见的体感就是切应用闪掉线。修叠加即可,不要借机重写重连状态机。

---

### B. 与 A 同批可顺手(Medium;只留真正半日能收完的)

通读后从本组拿掉 B2/B5/B6:刘海未截图像素核;WebContent 被杀和旋转是边角,不是「立刻变好」。见 F5/F6 与盲区。

#### B1 · 触控热区低于 44px(mic / send / 返回)

- **核验:**`[ok]CONFIRMED`
- **证据:**`.m-composer` 两翼 `36px`(`mobile.css:120-124`);`.m-back` / `.m-avatar` `38px`(`mobile.css:674-678`)(行号勘误 2026-08-27 月度审计:原文两处互换)。菜单钮已是 48px。合同 `docs/11-ui-spec.md` §9:移动 ≥44。
- **回报:**加透明 padding,不改视觉。不要把所有 36px 图标都改成大按钮。焦点环(`outline:0`,E4)可顺手画在 `.m-composer:focus-within` 上。

#### B3 · 列表错误态有 `reload` 却没传进页面

- **核验:**`[ok]CONFIRMED`
- **证据:**`hooks.ts:14-21` 已有 `reload`;`MobileApp.tsx` 的 `MobilePage` 只把 `attention`/`attentionError` 传给 `TodayPage`,**没有**把 `reload` 传下去;`TodayPage.tsx:21`、`ThingsPage.tsx:15` 只有 `MobileNotice`。失败后只能等 30s 轮询。
- **回报:**把已有回调穿到错误条。不要新造错误框架。

#### B4 · 只读卡一律写「去泳道看」

- **核验:**`[ok]CONFIRMED`
- **证据:**`CardPage.tsx:84-93` 非 confirmation 卡固定该链,但无 `focusId` 时 `back` 是 `/m`。
- **回报:**无 focus/lane 则改「回今天」或隐藏。多数卡有 focus,伤害小,改三行,不单独立项。

---

### C. 三端不对等 — 按你实际用哪台手机决定,不要当成「全仓必修」

#### C1 · 原生按住说话只在 iOS

- **核验:**`[ok]CONFIRMED`(产品缺口,不是隐藏 bug)
- **证据:**iOS `RootView.swift` 装配 `NativeBridgeController` / `NativeSpeechController` / `NativeTTSController`。Android / 鸿蒙源树对 Speech、TTS、`saydoNative` 零匹配。Android README 写明明文 HTTP 下 `getUserMedia` 预计不可用,native 桥归 M2。
- **合同:**M1 底部话筒只聚焦输入,placeholder「用键盘上的话筒说话」,禁止假 PTT。Android/鸿蒙走的是这条合法路径,键盘听写可用。
- **完整回报?:**把 iOS 语音层移植到 Android/鸿蒙是数日级工作(权限、音频会话、桥 origin/nonce、中文识别探针),只有当你的日常狗粮机不是 iPhone 时才值得现在做。否则键盘听写已覆盖 M1 沟通。**不要**为了「三端对等」在 A1 修好前开移植。

#### C2 · 鸿蒙未声明相机权限,但扫码走 ScanKit

- **核验:**`[ok]CONFIRMED`;披露矩阵已登记
- **证据:**`module.json5:28-30` 仅 `ohos.permission.INTERNET`;`ScanPlugin.ets:73-81` 调系统扫码(含相册)。
- **回报:**若你用鸿蒙扫码狗粮,这是该端阻断,补权限+reason。若不用鸿蒙,提审前再补即可。

#### C3 · 鸿蒙无下拉刷新;iOS/Android 有

- **核验:**`[ok]CONFIRMED`
- **回报:**弱。失败页已有「重试」。不要为对等而造手势。

#### C4 · 配对校验宽严不一致

- **核验:**`[ok]CONFIRMED`
- **证据:**鸿蒙强制 IP 字面量、`pathname === '/'`、单一 token 参数(`DesktopProfile.ets:35-45`)。iOS/Android 只要求 `http` + host + 显式 port + 非空 token。iOS README 写「验收必须 LAN IP」,代码未 enforce。
- **回报:**三端对齐「RFC1918 + 显式端口 + 根路径」成本低,能减少误扫。与 D1 同源,可捆在提审前壳加固,不必单独立项。

---

### D. 提审前壳信任边界 — 现在修回报不完整,送审前必修

当前战役是占坑(`docs/release/2026-08-13-store-submission-status.md`):三店应用记录已建,**明确勿传 spike 包**。下列在「若上架」视角是 High;在「本周狗粮」视角不是阻断。

#### D1 · Android / 鸿蒙主导航无配对 origin 门;Android 可加载任意明文 http 站

- **核验:**`[ok]CONFIRMED`
- **证据:**iOS `WebContainer.swift:155-172` `allowsProfileURL` 拦主框。Android `WebPanel.kt` 的 `WebViewClient` 无 `shouldOverrideUrlLoading`;鸿蒙 `Index.ets` 无 `onLoadIntercept`。Android 配对不限 RFC1918(`DesktopProfile.kt:35-43`)且 `usesCleartextTraffic=true`。恶意二维码 → 壳加载任意明文站。daemon G1 会拒非 RFC1918 的**真 SayDo**,挡不住 WebView 已经离开。
- **已知边界:**矩阵写明「无第一方源白名单 / Guideline 4.7」。iOS 已有 post-load 门,三端落差是新事实,不是「计划未做」能盖住的。
- **完整回报?:**对齐 iOS 白名单是半天级,建议**捆进生产壳**,或 A1 之后顺手给 Android 加 `shouldOverrideUrlLoading`。单独当本周主任务则回报不完整——owner 扫自己的码时打不到。

#### D2 · token 长期放在 WebView URL query

- **核验:**`[ok]CONFIRMED`;合同已声明 LAN + 长期 capability token
- **证据:**三端 `authenticatedURL` 都把 token 拼回 query。叠加 D1,离开源后可能进 Referer。
- **回报:**生产应改为一次性兑换 / header。现在改 header-only 而不做配对协议,是半截工程。留给 M2。

#### D3 · 深链 well-known 已挂,壳未接

- **核验:**`[ok]CONFIRMED`;状态文档 Pass 2 未勾
- **证据:**iOS 无 entitlements / `onOpenURL`;Android 仅 `MAIN`/`LAUNCHER`;鸿蒙 skills 仅 home。
- **回报:**没有生产配对协议时,接 Associated Domains 只是空壳。**不要现在做。**

#### D4 · 明文 HTTP / ATS / MixedMode

- **核验:**`[ok]CONFIRMED`;三端 README 与矩阵已登记为 spike,不是新洞
- **回报:**关明文等于关 LAN 狗粮。等 HTTPS 或 Tailscale 密文面,不要提前关。

#### D5 · 壳内演示模式不存在

- **核验:**`[ok]CONFIRMED`
- **材料:**`app-materials.md` §4 建议做,DEC-9 审核夹具(家里 Mac mini)不依赖它。
- **回报:**提审窗口再做。现在做演示账本是另一条产品线。

#### D6 · 三端版本号不一致

- **核验:**`[ok]CONFIRMED`
- **证据:**iOS `CFBundleShortVersionString=1.0`;Android `0.1-spike`;鸿蒙 `0.1.0`。状态文档写 spike 0.1、version SoT 未建。
- **回报:**提审/TestFlight 前统一。五分钟。误传 IPA 会显示 1.0,那才疼。

---

### E. 合同 / 文案漂移 — 改文档或改代码二选一,不要当功能债

#### E1 · 确认卡「做」副文过长变「按建议」

- **核验:**`[ok]CONFIRMED` 为合同漂移;用户伤害 **降为 Low**
- **证据:**`confirmCopy.ts:17-23` 标题 >12 字返回「按建议」;`CardPage.tsx:145,154` h1 已渲染 `item.title`。`docs/11` §5.6b 要求副行逐字 `prompt_text`。
- **回报:**主问题已经在标题里,用户不会因此错批。回写 §5.6b 承认「副行短摘要」或改回全文,选成本低的那个。不要为此重做确认卡。

#### E2 · `mobileLanApiAllowed` 比 09 合同多放了三条 GET

- **核验:**`[ok]CONFIRMED` 为合同分叉
- **证据:**实现放行 `/api/sessions/recent-transcript`、`/api/memory/recent`、`GET /api/projects/:id/memory`。09 M1 段只列 attention / focuses / Focus 详情 + `first-run/query`。Chat 历史和菜单记忆**依赖**前两条。
- **完整回报?:**收紧白名单会拆开口聊回放和记忆库,是**负回报**。正确动作是回写 09,把这三条登记为 M1 只读增量,并写清脱敏边界(转写含 sessionId+原文,记忆含 claim 全文,相对 Focus 详情更宽)。

#### E3 · 挂网隐私写三端「按住说话」

- **核验:**原「虚假披露阻断」`[fail]REFUTED`;材料未按端拆分仍是事实
- **证据:**`app-materials.md` §2 能力表写麦克风「按住说话」。`store-submission-status.md` 写三商店表单未填、勿传 spike。矩阵草稿已按端拆分。
- **回报:**提审填表前按矩阵改挂网正文。现在改对狗粮零收益。

#### E4 · composer `outline:0` 与焦点环张力

- **核验:**`[ok]CONFIRMED`;`docs/11` §2.8 第 7 条已记债
- **回报:**低。随 B1 顺手即可。

#### E5 · 挂网隐私写「一次性扫码交换的令牌」,实现是长期 `.cap-token`

- **核验:**`[ok]CONFIRMED`(文案不诚实;不是本周功能债)
- **证据:**`app-materials.md`「数据存储与传输」写一次性交换;daemon `loadOrCreateCapToken` 把同一 token 写到 `~/.saydo/.cap-token` 长期使用,删文件再重启则**所有**已配对设备一起掉线(`DEPLOY-测试机部署清单.md` 已登记)。
- **回报:**提审前改成「长期令牌,保存在本机安全存储;桌面轮换后需重新扫码」。现在改对狗粮零收益。不要借此开 M2 配对协议。

---

### F. 稳定性 / 多端 — 单用户狗粮下优先级靠后

#### F1 · `tts.say` / `focus.entity` / `session.project` 广播给全部 console;仅 `native.reply` 与 `confirm.*` 按 session

- **核验:**`[ok]CONFIRMED`
- **证据:**`hub.ts:826-836` `broadcast("console", safe)`;`hub.ts:800-804` `focus.entity` 走 broadcast。`native.reply` 正确过滤 `via===mobile_lan && sessionIds.has(...)`(`hub.ts:857-860`)。
- **触发:**两台手机同 token、不同 session 时可能串话。
- **回报:**你现在是单机狗粮,修了几乎无体感。第二台设备出现再做。不要和 A2 捆在一起「顺便重构 hub」。

#### F2 · 确认卡每次新开一条 WebSocket

- **核验:**`[ok]CONFIRMED`
- **证据:**`confirmDecision.ts:39-87` `new WebSocket(daemonWsUrl())`,hello 后再 `confirm.decision`,5s 超时后 `ws.close()`。
- **回报:**隔离主语音通道是合理设计。没观测到卡确认失败前,不要合并进主 WS——那是不完整回报的重构。

#### F3 · attention / focuses 双路 30s 轮询,后台不暂停;列表未虚拟化

- **核验:**`[ok]CONFIRMED`
- **回报:**收件箱体量按设计是「今天挂着的事」,不是无限时间线。虚拟化是过度设计。后台暂停 interval 可随 A2 顺手,单独做价值薄。

#### F4 · iOS 语音无中断 / 路由监听

- **核验:**`[ok]CONFIRMED`
- **触发:**来电、切蓝牙。识别错误回落「识别中断了」,无 `AVAudioSession` interruption/routeChange。
- **回报:**真机会遇到。A1+A2 之后若胶囊在来电后卡死,再补。不要预做完整音频图。

#### F5 · iOS 无 `webViewWebContentProcessDidTerminate`(原 B5)

- **核验:**`[ok]CONFIRMED`
- **回报:**系统杀 WebContent 才疼,有下拉刷新兜底。标配补丁,不进本周完成定义。

#### F6 · Android 旋转重建 WebView(原 B6)

- **核验:**`[ok]CONFIRMED`
- **回报:**竖屏狗粮无感。不要为此上 Navigation 组件。遇到再加 `configChanges`。

#### F7 · HTTP `decide` 把非 tailnet 的 via(含 mobile_lan)落成 `screen`

- **核验:**`[ok]CONFIRMED` 为纵深不足,今日被路由白名单挡住
- **证据:**`index.ts:1494-1495`。若有人把 decide 加进 `mobileLanApiAllowed`,会以 `screen` 批 S2。
- **回报:**现在去改是在修一条未接通的路径。白名单评审时记住即可,不单独立项。

---

## 2. 证伪清单(防止下一轮审计重复踩)

| 原主张 | 裁决 | 为什么不成立 / 为何降级 |
|---|---|---|
| 手机 TTS blob URL 泄漏(原 High) | `[fail]REFUTED`(真实 mobile_lan) | `broadcastBinary` 跳过 `via===mobile_lan`(`hub.ts:758-765`);测试断言手机收不到 0x02。手机朗读走 `native.reply`+iOS 系统 TTS。桌面 blob 未 revoke 最多另立 Low,不记在移动阻断。 |
| 商店成文「按住说话」= 当前虚假披露阻断(原 High) | `[fail]REFUTED` | 表单未填、勿传包。矩阵已按端拆。材料债,不是本周合规事故。 |
| 确认卡「按建议」= High 用户伤害 | 降为合同漂移 / Low | h1 已展示问题全文,副行短语不导致错批。 |
| 鸿蒙 `network_config.json` 的 `ArkWeb:false` 导致明文失效 | `[warn]PLAUSIBLE`,未升格 | `module.json5` 未引用该 profile;组件上另有 `MixedMode.All`。未真机验证,不写进必修。 |
| peeked / 原生强制壳 / first-run 能绕过 setup 门 | `[fail]REFUTED` | peeked 锁在 probe-error 之后;forceMobile 只选树;first-run 只在 Chat 已挂载后才打。 |
| 从 mobile_lan 能放行 S3 / runtime_effect | `[fail]REFUTED`(正面确认) | 见 §3。 |
| 「T2 推送没做」是 Critical | 不立项 | 矩阵表 B 预告;材料禁止提前填。 |
| 骨架屏缺失是体验阻断 | 过度设计 | 见 §4。 |
| 回前台应禁止一切 OPEN 重连 | 处方不成立 | iOS 僵尸 OPEN 未真机证伪;完整回报只去双击,见 A2。 |
| 所有 probe 403 都旁路 setup 门 | 处方不成立 | `token_mismatch` 必须留下;只放行 `mobile_lan_route_rejected` 与 `setup_local_only`。 |

---

## 3. 正面确认(可以放心的)

1. **S3 不能从手机放行。**`s3Guard` 要求 `via=local`;index 把非 local 映射成 tailnet 送进 S3 门。远程 console 在场时语音工具环 S3 集合亦拒。
2. **runtime_effect 手机 accept/reject → `untrusted_source`,话术回桌面,不广播清卡;**withdraw 仍可撤 presentation。
3. **WS 上行白名单与合同一致:**`voice.mode` / `turn.text` / `confirm.decision` / `console.heartbeat`。二进制上行对 mobile_lan 丢弃。
4. **`native.reply` 脱敏且只发给同 session 的 `mobile_lan` console。**
5. **G1:**localhost Host + 非环回 peer 拒;mobile 无 Origin 须同 Host Referer;`Sec-Fetch-Site` 非 same-origin 拒。
6. **token 不进明文 profile 元数据:**iOS Keychain / Android Keystore AES-GCM / 鸿蒙 HUKS。未发现打日志或进剪贴板。
7. **路由表与 §5.6b 六路由一致;**宽窄切换不重建主 WS(`VoiceProvider` 在 boundary 外)。
8. **底部 dock:**mic 只 `focus()`,无假 PTT;nativeMode 收薄 Web dock;非 online 只禁发送,草稿保留。
9. **确认卡三段 + stale/missing 零动作 + runtime 回桌面**主路径实现了。stale 文案符合「可能已在桌面处理,或已过期搁置」。
10. **色值:**`mobile.css` `--m-*` 只消费矿彩层,切暗仍是纸。
11. **披露矩阵 / 送审状态对「勿传 spike、明文、深链未接、推送未做」口径与代码一致**,没有「材料假装 T2 已上线」。
12. **鸿蒙 ScanKit 动态 import**,非 HMS 设备不在首屏崩。

---

## 4. 明确不要做(过度设计 / 回报不完整)

这些在发现阶段都「能写成条目」。第二遍把它们从工程队列拿掉。

| 冲动 | 为什么回报不完整 |
|---|---|
| 按 W7.3 重写成 Capacitor | 三端原生壳已经在。Capacitor 是过期计划指针,不是当前缺口。重写会挤掉 A1/A2。 |
| 现在做 APNs/FCM/HMS、CallKit、Live Activity | 无配对信任层,推送 payload 合同未落(R-B)。做了也不能安全投递。 |
| 现在接深链 | well-known 已挂;壳接了也没有生产配对可完成。 |
| 给 Android/鸿蒙做网页 getUserMedia 语音 | 明文 HTTP 不是 secure context,探针必失败。要语音就走原生桥,否则用键盘听写。 |
| 收紧 mobile_lan 白名单,砍掉 transcript/memory | 会拆 Chat 回放和记忆菜单。应回写 09,不是回滚功能。 |
| 骨架屏、虚拟列表、transcript 上限 | 收件箱不是无限 feed。§5.9 骨架是桌面合同惯性,移动空态文案已可读。 |
| 壳内演示模式 / 审核夹具工程化 | DEC-9 已选家里 Mac mini;演示模式非前置。占坑战役不做送审包。 |
| 统一三端 PTR / 音频图 / 旋转动画 | 对等癖。鸿蒙重试页已够;音频中断等胶囊真卡再补。 |
| 把确认卡并进主 WS、重构 VoiceHub 定向 | 单用户无串话体感;易引入回归。 |
| 为刘海 / 键盘遮挡单独开批 | 顶栏 `safe-area` 与 `visualViewport` 只有布局推断,未截图。A1 真机那天顺手看一眼,不要预做。 |
| 为「规范」先做生产配对(Noise XX / 一次性票据) | 那是 M2 正批,不是本报告的修补项。A1 不依赖它。 |

---

## 5. 建议顺序(完整回报链)

```
A1 按错误码旁路 setup 门 → LAN 与 tailnet 都能进壳
A2 去掉回前台双击重连     → 切应用不闪掉线(保留 iOS resume 强制)
B1/B3/B4 CSS 与错误重试   → 可与 A 同批,半日;不单独立项
C1 仅当狗粮机不是 iPhone 时移植原生语音
D1 主导航白名单           → 生产壳 / 提审前
E2 回写 09 白名单增量     → 文档,不是砍功能
其余 D/E/F               → 按触发线,不进本周完成定义
```

验收 A1 必须用**真机 + LAN IP 二维码**(以及若你在用 Tailscale:tailnet 主机名),不能用模拟器 127.0.0.1,也不能用本机窄视口代替。

---

## 6. 方法论与覆盖范围

**做了什么**

- 通读三端 README、release 矩阵/送审状态/材料、`docs/11` §5.6b/§5.8a、09 M1 LAN 段。
- 主会话阅读:`SetupBootstrapBoundary` / `SetupContext` / `App.tsx` / `mobileLan.ts` / `identity.ts` / `hub.ts`(上下行白名单与 binary) / `MobileApp` / `nativeBridge` / `reconnect` / `confirmCopy` / `CardPage` / `MobileChrome` / 三端 `DesktopProfile` / iOS `WebContainer` / Android Manifest / 鸿蒙 `module.json5`。
- 4 路 finder:原生壳、console 移动 UI、daemon 访问面、性能+商店合规。
- 2 路独立证伪:A1 全因果;H1–H6 High 包。

**没做 / 盲区(必须写明,以免被读成「全都查过了」)**

- 未在真机跑扫码、LAN 进壳、来电打断、动态岛遮挡、Android 旋转、鸿蒙 ScanKit 权限弹窗。A1 的机制由代码+单测锁死,行为仍欠真机照片。
- 未解包 APK/HAP 看最终权限合并。
- 未 curl 复验线上 well-known(只核仓库部署文件与壳未接线)。
- 未把桌面 daemon 二维码生成与 token 熵纳入本轮。
- 产品正本 `2026-08-11-SayDo移动端完整方案-v1.md` 不在本仓,对照以已回写的 `docs/11` / `docs/09` 为准。
- 键盘是否遮住 dock、顶栏是否切到刘海:仅有 `position:fixed` / 无 `visualViewport` / `m-dstat` 未加 `safe-area-inset-top` 的代码推断,标 `[warn]PLAUSIBLE`,不升格必修。
- tailnet 薄版与 A1 的叠加由代码锁死,未在本会话连真实 Tailscale 复现。

**已知截断:**性能项未做 profiler;商店后台表单未打开(文档称未填,采信)。

---

## 7. 通读后修订记录(本轮第二遍)

起草后主会话把全文又读了一遍,改动如下(对应你要求的「疏漏 / 不足 / 错误 / 过度设计 / 是否有完整回报」):

1. **疏漏 · A1 范围偏窄。**初稿只写了 `mobile_lan`。`GET /api/setup/probe` 对 `tailnet` 同样 403(`setup_local_only`,`index.ts:961-973`),W2 已交付的 T2 薄版也被同一扇门挡住。这提高了 A1 的回报,不是新开一条。
2. **错误处方 · 「所有 403 旁路」会把错 token 伪装成空账本。**`SetupContext` 还丢掉了 `ApiError.code`。完整回报=只放行两个远程面 code,并先把 code 传到 boundary。
3. **错误处方 · A2「OPEN 绝不重连」。**有害的是 visibility + native-resume + 手动事件叠成双击。iOS 僵尸 OPEN 未真机验证,禁止 resume 强制重连是不完整回报,可能把续连修断。
4. **过度设计 · 把 B2/B5/B6 写成「立刻变好」。**刘海未截图;进程被杀和旋转是边角。已降到 F 或盲区。本周顺手只留 B1/B3/B4。
5. **疏漏 · 隐私「一次性令牌」vs 长期 `.cap-token`。**比「按住说话」更触及传输事实,记为 E5,提审前改文案,不开配对协议。
6. **疏漏 · VoiceProvider 在门外面。**A1 是 UI 门回归,不是 WS 没做;修好后 first-run 已在白名单。
7. **仍成立、未改结论的:**S3/runtime 封顶、手机无 0x02 TTS、商店表单未填故不是虚假披露阻断、不要 Capacitor/推送/深链/收紧白名单。
8. **价值判据:**只有 A1 把「远程手机完全不能用」变成「能看账、能聊、iPhone 能说话、Tailscale 薄版能回来」。其它条目若不能回答「用户多做到哪一步」,不进本周完成定义。
