# 移动外壳加码：交叉对比后的方案建议

> 日期:2026-08-13
> 本文是 SoT 方案建议。单独当施工单使用下列材料时,以本文为准:
> - 浅调研画布 `mobile-shell-strategy.canvas.tsx`(战略方向保留,当前态与 20 份工时分配不采用)
> - 深体检 `docs/review/2026-08-13-mobile-gap-audit.fable.md`(阻断与顺序保留;「CallKit 不要做」收窄为本周不做、触发线后做;HEAD 锚已过期,关键门控文件相对 `cda99b8` 未改)
> Codex 对抗审:`research/codex-findings/69-mobile-shell-strategy-review.md`(战略);`research/codex-findings/70-mobile-together-scope-review.md`(第 0 步同批范围,HEAD `e987f05`)
> 代码锚:`e987f051ce52f3fb70435a06402d73b7a52d190f` (`e987f05`;门控文件相对 `0fe5fe8`/`cda99b8` 未改)
> 不含 OctoDesk 那份移动审计——那是另一个产品。本轮未跑真机,硬件行为标 `[warn]`。

本页回答:三端外壳该加什么、不该加什么、先做什么。不是能力愿望清单。

---

## TL;DR

**战略听画布,顺序听体检,处方听 Codex 收紧后的 `remote-mobile`。**

冻下来的工程纪律:产品面只养一棵 React 移动树;原生只 own 系统能力;鸿蒙当通道;加码前先冻桥;不要退回 Capacitor,也不要三套 Today。

画布把当前态写成「能真机看页面、iOS 能按住说话」,并把接下来 20 份工时分给生产配对 / CallKit / Android 语音 / 演示夹具。代码事实是:凡 `via` 不是 `local` 的 console 都停在 `GET /api/setup/probe` 门上,`MobileApp` 挂不上。本机缩窄窗口和模拟器 `127.0.0.1` 会掩盖。iOS 语音胶囊也不能当「已经进壳」的证据——`pageReady` 只在 `MobileApp` 挂载后才会装。

因此:**本周唯一完成定义是「真实 LAN IP 手机进入明确的 `remote-mobile` 降级态并挂上 `MobileApp`;回前台同一窗口内最多一次重连」。** CallKit、Android 语音核、Noise 配对、壳内演示模式方向都对,现在做是半截工程。画布的 20 份分配把唯一阻断漏成 0,不能当本周排产。

2026-08-13 二次通读 + Codex 70:没有新的 Critical,也没有第三条运行时竖切。同批只保留 A1+A2+09 合同回写;B3 reload 从「必修」降为顺手。仍不要把 CallKit / 安卓语音 / 源白名单提前。见 §3 / §7 / §8。

错误处方(体检原文偏宽,Codex 已证伪其实现形态):把 `mobile_lan_route_rejected` / `setup_local_only` 全局映射成 `app`。Boundary 在 `AppContent` 外,宽视口远程 console 会因此挂上桌面树——那是远程 setup fail-open,不是移动旁路。

正确处方:新增 `remote-mobile` 状态,只挂移动树;不开放远程 `GET /api/setup/probe`;`token_mismatch` / `identity_rejected` 仍停错误卡。`tailnet` 是否纳入该态,须你按 09「bootstrap 仅 local」拍板后回写 canonical,不能 silently 扩大旁路。

---

## 0. 三份材料各解决什么

| | 画布(浅) | 体检(深) | Codex 69(对抗) |
|---|---|---|---|
| 问的问题 | 加工作量该加在哪一层 | 现在什么是真阻断 | 两份材料谁赢、处方会不会修出新洞 |
| 看对了 | 薄壳;手感来自语音和来电;仓里放弃 Capacitor 是对的 | T19 门、回前台双击 WS、三端桥不对等 | `remote-mobile` 必须强制移动树;`tailnet` 与 09 有 canonical 分歧;A2 还要单一事件归属+去抖 |
| 看漏了 / 看错了 | 当前态;React 2824 声称不含测试(实际含 729 行测试);20 份工时 0 分给「进壳」 | 「CallKit 不要做」过宽;HEAD 锚 `cda99b8` 已过期;旁路若写成挂 `AppContent` 会 fail-open 桌面 | 无颠覆性否决;本周派工从「进壳+稳定连」收成两个竖切 |

行数复验(2026-08-13,与 Codex 69 一致):iOS Swift 2064;Android Kotlin 905;鸿蒙 ETS 1195;React 移动非测试 ts/tsx 2095 + 测试 729 = 2824。画布的 2824 含测试、不含 CSS。这不改变薄壳战略,但不能用错误行数撑 20 份工时。

HEAD `0fe5fe8` 相对体检锚新增:`PairingOverlay` 仍是 `http://lanIp:port/?token=<长期 capToken>`,不是 R-B/Noise;Chat 页 `systemVoice` 是桌面浏览器回退,不是 Android 原生桥。A1/A2 门控文件相对 `cda99b8` 未改。

---

## 1. 一致项(直接冻成纪律)

1. **产品面只养一棵 React 树**(`packages/console/src/mobile`,`#/m`)。Today / 事 / 卡 / 对话不在 Swift / Compose / ArkUI 各写一遍。
2. **原生只 own 系统能力**:配对与安全存储、音频会话、将来的推送唤醒 / 来电。iOS 已经走在「壳 own 音频、WebView 只渲染」上。
3. **鸿蒙是通道**:备案和 AGC 已经付过通道税。能装能连能看即可。未把鸿蒙当日常沟通机之前,不做第三套语音核。
4. **加码前先冻桥合同**:现在只认 `window.webkit.messageHandlers.saydoNative`(`nativeBridge.ts`)。版本号、pageNonce、origin、focus 发布、转写回执三端同一套,各端只换音频与推送实现。未冻桥不开 Kotlin 语音。
5. **商店拒的不是「不够原生」**:4.7 拒任意 URL WebView;4.2 拒审核员没电脑。SwiftUI 重写卡片过不了这两条。源白名单可以先于 Noise,但不能冒充生产信任层。
6. **不要退回 Capacitor,也不要静默改 D12**:鸿蒙没有 Capacitor;CallKit/PushKit 反正要自写。偏差是文档落后。回写走设计 ADR-003(产品载体,预留尚未成文),一次性改 03 / 05 / 07 / modules/d,不能边施工边改合同。

---

## 2. 硬矛盾与终审

| 议题 | 画布 | 体检 | 代码+Codex | 方案 |
|---|---|---|---|---|
| 现在手机能不能用 | 能看页面,iOS 能按住说话 | 远程面整壳不可用 | **听体检。** `mobileLan.ts` GET 白名单无 probe;LAN 得 `mobile_lan_route_rejected`;tailnet 得 `setup_local_only`;boundary 先判 `probe-error`,peeked 也逃不出去;`App.tsx:154-163` 把 `AppContent` 包在门内 | 本周第一件事:`remote-mobile`,不开放完整 probe |
| 旁路怎么写 | 未谈 | 两错误码跳过向导门,挂 AppContent | **听 Codex。** 全局映射成 `app` 会让宽视口远程 console 挂桌面树。iPad `__saydoForceMobileShell` 只选树,不越过 probe-error | 新状态只挂移动树;先把 `ApiError.code` 从 `SetupContext.tsx:76-80` 传到 Boundary |
| tailnet | 未分面 | 与 LAN 一并旁路 | **09:1141 写明 bootstrap 仅 local。** 旁路 LAN 是 UI 门回归;旁路 tailnet 是合同扩张 | LAN 本周必做;tailnet 等你拍板后回写 09 再纳入验收 |
| 下一步工时 | 配对 5 / 来电 5 / 安卓语音 4 / 夹具 3 / 鸿蒙 2 | A1+A2,其余触发线 | **听体检的顺序,听画布的方向。** 20 份里「进壳」必须先于来电和安卓语音 | 见 §3 |
| CallKit | 最值得加,2–4 周 | 不要做 | **方向对,时点错。** 05/07/modules/d 仍是 P1 形状;仓内零 CallKit/PushKit/APNs 代码;无 R-B、opaque push、device-token digest、Apple 凭据面时只能做本地 UI spike | 本周不做;触发线后做 |
| Android 语音 | 做,1–2 周,复用桥 | 仅当狗粮机不是 iPhone | **1–2 周只够探针。** Android `WebPanel` 无 JS bridge / AudioRecord / TTS;M1 合同底部话筒已是键盘听写 | 先冻桥再估生产批;日常机若是 iPhone 再往后 |
| 生产配对 | 必须,协议只实现一次 | M2,本周不依赖 | HEAD 只有长期 token QR(`pairing.ts:25-27`),三端 README 写明无 Noise。不能把新浮层计入「生产配对 5」 | 提审前做源白名单;R-B 后置且只留一套协议 |
| 4.7 源白名单 | 上架硬门 | 提审前壳加固 | iOS 已有 `allowsProfileURL`;Android 无 `shouldOverrideUrlLoading`;鸿蒙无 `onLoadIntercept` | 可先于 Noise,列入提审触发线,不进本周唯一收口 |
| 4.2 演示 | 3 份,模式和夹具一起 | DEC-9 不依赖壳内模式 | Mac mini 已选,夹具未建;壳内 demo mode 可选 | 提审前执行夹具;本周不做模式 |
| 回前台重连 | 未谈 | 去双击,保留 iOS resume | 重复路径是代码事实;「切回来一定闪 offline」缺真机,标 `[warn]`。健康 OPEN 与 iOS 僵尸 OPEN 无法区分,禁止「OPEN 绝不重连」 | 删 MobileApp 第二份 visibility;手动事件单一 owner;native resume 保留强制并与 visibility 短窗口合并;effect 依赖稳定 `reconnect` 引用 |
| 证据新鲜度 | React 2824 且不含测试 | 锚 cda99b8 | 2824 含测试;HEAD 已到 0fe5fe8;门控文件未改 | 以本文数字与锚点为准 |

---

## 3. 分期方案(完整回报链)

### 第 0 步 · 本周唯一完成定义(狗粮)

目标:真机扫 LAN 码,进入明确的 `remote-mobile`,挂上 `MobileApp`,切应用不把健康连接拆两次。

只派两个运行时竖切。09 回写是同批合同收口,不是第三条功能。

| 项 | 做什么 | 明确不做什么 |
|---|---|---|
| Remote mobile gate | `SetupContext` 保留本次 probe 的 `ApiError.code`;仅当 code 为 `mobile_lan_route_rejected`(以及你拍板后的 `setup_local_only`)时进入新 kind `remote-mobile`;该态自己取 `useMobileRoute` 并**直接挂 `MobileApp`**,不走 `AppContent`/`useMobileViewport`/桌面 `Layout` | 不开放远程 `GET /api/setup/probe`;不把 `token_mismatch` / `token_missing` / `origin_rejected` / `host_rejected` fail-open;未拍板前 tailnet 不纳入验收 |
| Foreground reconnect | 单一 owner 处理 visibility / 手动事件 / native-resume,短窗口合并;删 `MobileApp` 第二份 visibility 时不得丢掉 iOS resume;effect 依赖稳定 `reconnect` 引用(`useVoiceChannel.ts:689-691`) | 不禁止 iOS resume 强制重连;不把「OPEN 绝不重连」写成已证实 |

**同批完整回报(Codex 70 收窄后):**

1. **禁止掉进向导。** 只跳过 `probe-error` 不够:首开 `peeked=false` 且 `probe=null` ⇒ `dialogReady=false` ⇒ `wizard`。必须是新 kind;现有单测锁死 peeked 也出不去 probe-error,要一起改。`origin_rejected` 等继续错误卡。
2. **强制移动树是横屏门。** iOS 只在 iPad 注入 force flag;iPhone 横屏 >768 会走桌面树;LAN 下 `/api/overview` 不在白名单。`remote-mobile` 不得映射成普通 `app`。
3. **回写 09 M1 段三条已放行 GET**(`recent-transcript`、`memory/recent`、`projects/:id/memory`)。直接消费者是前两条(Chat 回放、菜单记忆);第三条是已放行 helper,页面尚未调用。回写必须带 payload/隐私边界(转写含 sessionId+原文,记忆含 claim 全文),只加路径名不算收口。不改 allowlist 语义。

**从收口定义拿掉(Codex 70 证伪「A1 当天必踩」):**B3 `reload` 是真缺口,失败后最多干等 30s 轮询,不阻断进壳/文本/WS。A2 不扩散文件时可以顺手;要动 `MobileNotice`/Today/Things,不计入完成定义。

**验收(定向,不救全部 29 条桌面 e2e):**

- 真机或 Playwright LAN RFC1918,含一次横屏。已有用例:`e2e/console/console.spec.ts` 约 182–252 行(Today 缺 Origin+Referer、文本、first-run)。`docs/11:575` 的 29 failed/3 passed 是 localhost 向导未武装,`seed-fixture` 不配 dialog——那是 T19,不并进本周。
- 记录 API/WS 的 Origin / Referer / `Sec-Fetch-Site`。若真机是 `origin_rejected`,不要扩旁路,上浮你决定合法来源证明。
- 二维码 Host 先过 RFC1918。en0 给出非 RFC1918 时浮层不一定报错(只对 `lanIp=null` 报),扫码会变成 `host_rejected`——那时再扩接口选择,不要预做。
- 有确认夹具时走一次独立 confirm WS;first-run 允许 `delivered=false` 只要能发文本。
- 下拉刷新只观察,不改原生 PTR。

**本周仍不做:**CallKit / Android 原生语音 / Noise / 三端主导航白名单 / 鸿蒙相机权限 / 壳内演示 / 给 Android 注入 force flag / 改 `just dev` 默开 LAN / 武装 global-setup 救 29 条桌面 e2e。

`127.0.0.1`、本机窄视口、模拟器、只竖屏不算验收。iOS 胶囊出现不等于进壳。

### 第 1 步 · 冻桥,再谈第二套语音(仍是薄壳)

把 `nativeBridge.ts` 的版本、pageNonce、origin、focus、转写回执写成三端合同。Android 只换实现。**未冻桥不开 Kotlin 语音。**

### 第 2 步 · 提审前壳信任(占坑战役的下一步,不是本周)

按顺序,不要并行开第二套协议:

1. Android / 鸿蒙主导航对齐 iOS `allowsProfileURL`(origin / profile / RFC1918 / 根路径);明文策略与 HTTPS 或等价密文;鸿蒙相机权限。
2. 隐私正文按端拆;「一次性令牌」改成长期 token + 轮换须重扫;三端版本号收到 spike 口径(iOS 现在是 `1.0`)。
3. owner 通过设计 ADR-003 后,落 R-B 配对/信任五件套,替换当前长期 token QR,不并行维护第二套。
4. 生产壳可验收后执行 DEC-9 Mac mini 夹具、演示数据、二维码和视频。壳内 demo mode 仍是可选项,不得用它掩盖真实连接问题。

### 第 3 步 · 产品形状(有完整回报才开)

触发线=第 0 步真机狗粮一周 + R-B 配对/推送合同已落 + Apple Developer / APNs 凭据面已开。

- iOS CallKit + PushKit:这是 T2「干完活像来电话」的形状,画布没写错。modules/d D2 已标 VoIP 政策开放项,开工前再核 Apple 规则。没有 opaque push payload 时不要开。
- Android 原生语音:只有日常狗粮机是 Android 时,才在冻桥之后先做识别/权限/origin-nonce 探针,再估生产批。1–2 周不够音频会话 + 后台中断 + TTS + 真机验收。
- Live Activity:只评估,不预做。

### 明确永不进本方案

- SwiftUI / Compose / ArkUI 重写 Today / 卡 / 对话
- 退回 Capacitor 或再包一层跨端框架
- 为对等把语音核搬到鸿蒙
- 收紧 `mobileLanApiAllowed` 砍掉 transcript/memory(应回写 09,不是回滚功能)
- 把确认卡并进主 WS、重构 VoiceHub「顺便」
- 用壳内演示模式冒充「已经能连上家里的电脑」

---

## 4. 画布 20 份工时如何改读

原分配把「能进壳」当成已经成立。改读为两段:

**近段(本周,约 2.5 份,唯一收口):**remote-mobile gate(含横屏强制移动树+改向导单测) 1.5 + 回前台去重 0.5 + 09 白名单与隐私边界回写 0.5。B3/触控/刘海不计完成定义。

**远段(提审与产品形状,原 20 份仍然有用,但要加前置):**源白名单(可先于 Noise)+ 生产配对 5、CallKit 5、Android 语音 4、夹具 3、鸿蒙对齐 2、原生 UI 0。CallKit 与 Android 语音的 5+4 **不得与近段并行**,也不得在桥未冻、R-B 未落时开工。

---

## 5. owner 拍板(不代决)

1. **`tailnet` 的 `setup_local_only`**:继续遵守 09「奠基 bootstrap 仅 `via=local`」,还是正式把 T2 tailnet 手机纳入 `remote-mobile`(仍不开放远程 probe,只跳过向导门、只挂移动树)。选定后必须回写 09。不拍板则本周验收只认 LAN。
2. **设计 ADR-003**:D12 是否改为「三份薄原生壳 + 共用 React/bridge;音频不达标则壳 own 音频、Web 继续渲染」。不拍板则每次读 07 都会以为还要上 Capacitor。第 0 步不依赖这条。
3. **鸿蒙通道化**:明确「无原生语音核,直到日常机是鸿蒙」。不拍板则三端对等压力会把 ArkTS 语音排进来。
4. **CallKit 商业面**(触发线才需要):Apple Developer 费用、VoIP 审核风险、dogfood 离机数据是否值得开。
5. **壳内 demo mode** 是否单独立项。夹具本身在提审前必须执行,与这条无关。

战略与商业取舍归你。上面第 0 步的 LAN 竖切不依赖 2–5。

---

## 6. Codex 69 triage

prompt:`prompts/69-mobile-shell-strategy-review.md`
报告:`research/codex-findings/69-mobile-shell-strategy-review.md`(260 行 / 18161 bytes,SHA-256 `c28e99645e5ad8ed2f4d6e7a92327681171cb621e41437af02754fe68ffd9ded`)
日志:`logs/69-mobile-shell-strategy-review.log`(24264 行 / 1869043 bytes,SHA-256 `fcdcbd551022f61a628cc80a51810de9be01a25293f3b1ba4aefe7981cc27c71`)

| 编号 | 级别 | 是否改写本文 |
|---|---|---|
| A 进壳漏成零工时 | `[fail]` 画布当前态 | 已采纳:本周唯一收口=进壳 |
| B 旁路须 `remote-mobile` | `[warn]` 体检处方过宽 | **已改写 §3**:禁止全局映射成 `app` |
| C 薄壳 / 不回滚 Capacitor | `[ok]` | 已冻;回写走 ADR-003 |
| D React 行数含测试 | `[fail]` 画布量化 | 已改 2095+729 |
| E CallKit 战略应做、本周不做 | `[ok]/[fail]` | 已收窄体检「不要做」 |
| F Android 语音 1–2 周不够产品化 | `[warn]` | 已改为探针后再估 |
| G 配对仍是长期 token;源白名单可先 | `[fail]` | 已拆开第 2 步 |
| H 夹具已选、模式非前置 | `[ok]/[warn]` | 已拆开 |
| I A2 再收紧事件归属+去抖 | `[ok]/[warn]` | 已写入第 0 步第二竖切 |
| J HEAD 过期但门控文件未改 | `[fail]` 体检锚 | 69 时改锚 `0fe5fe8`;70 再改锚 `e987f05`;门控文件仍未改 |

无 A 级否决「先修进壳」。无发现需要把 CallKit 或 Android 语音提前到本周。

---

## 7. 二次通读 + Codex 70:还有没有同批缺口

问的是「A1+A2 之外,还有什么值得一起做」,不是再开一条产品线。对照进壳后的真机狗粮链走代码,再交 Codex 70 对抗。

**结论:没有新的 Critical,也没有第三条运行时竖切。** 白名单在 `MobileApp` 挂上之后够用;token 注入、iOS ATS 本地网络、配对浮层都已经在。Codex 70 把上一版「四件必修」收成「两件实现约束 + 一件合同回写」;B3 降级。

| 候选 | 终稿曾主张 | Codex 70 | 现派工 |
|---|---|---|---|
| 只旁路 probe-error | 新 kind | `[ok]` 首开成立 | A1 必修 |
| 挂 `AppContent` 选树 | 禁止 | `[ok]` 横屏会进桌面 | A1 必修,直接挂 `MobileApp` |
| B3 传 `reload` | 同批否则假绿 | `[fail]` 只是 30s 轮询,不挡进壳 | 从收口拿掉;不扩散时顺手 |
| E2 回写 09 | 三条都被页面依赖 | `[ok]` 分叉真实;`[fail]` 第三条无页面调用 | 同批回写三条+隐私边界 |
| LAN e2e / 29 红 | (未写清) | `[ok]` LAN 专项受 probe 门;29/3 是本地向导 | 跑 LAN 专项,不救 29 条 |
| origin_rejected | 不旁路 | `[ok]` 禁 fail-open;`[warn]` WKWebView 未测 | 真机记录来源头 |
| en0 | 浮层报错再扩 | `[warn]` 非 RFC1918 非空 en0 不报浮层 | QR 先检 RFC1918,失败再扩 |
| 确认 WS / first-run | 后置 | `[ok]` 无额外 LAN 阻断 | 定向验收,不加竖切 |
| PTR 与 A2 | 不改原生 | `[ok]` 两条路径独立 | 只观察 |
| CallKit / 语音 / Noise | 后置 | `[ok]` 69 未推翻 | 仍后置 |

操作清单:daemon `SAYDO_MOBILE_LAN=1`;侧栏「与手机配对」;真机扫 RFC1918 码,不要打 127.0.0.1。

---

## 8. Codex 70 triage

prompt:`prompts/70-mobile-together-scope-review.md`(84 行 / 4725 bytes,SHA-256 `0c93c792f35995e6d9bcddeac15b367fac9fba3b3e9f818ee2396d23492e7220`)
报告:`research/codex-findings/70-mobile-together-scope-review.md`(128 行 / 15093 bytes,SHA-256 `4252ebfe9bfd9f9bf5181da990bb919c02dd0d6d321be054d4c70cb8c1bd626d`)
日志:`logs/70-mobile-together-scope-review.log`(21313 行 / 1326013 bytes,SHA-256 `b9b1f69f256d33e16f190de0dd521600548bb741aaa1d417474d8c935a331c5b`)
耗时 1576122ms,EXIT 0。

终裁采纳:收窄同批,不扩大战略。本文 §3 已按 70 改写。无发现把 CallKit / 安卓语音提前。