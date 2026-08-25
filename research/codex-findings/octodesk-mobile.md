# OctoDesk 手机↔桌面/服务端连接实现调查

> 调查时间:2026-07-22。范围:`~/WorkSpace/OctoDesk/`。
> 方法:rg 精准定位 + 读 15 个核心文件,未做全项目遍历。证据标注 `文件:行`;区分【事实】【推断】【未确认】。

## TL;DR

OctoDesk 的手机↔桌面连接是**双通道架构**:
- **通道 A(Desktop Remote,重头戏)**:手机原生壳 ↔ 桌面 Electron 的 **LAN 直连 WebSocket**,失败后回退到**服务端自建 WS 字节中继**;全程 **Noise XX 风格 E2E 加密**(X25519+HKDF-SHA256+AES-256-GCM),中继只转发密文不解密。
- **通道 B(Mobile Companion 云面)**:手机 ↔ 企业服务端(Hono.js)的 **HTTPS + JWT + SSE**,承载 Mail/Calendar/Files/AI Chat 等 server-backed 业务。
两通道独立,推送(APNs/FCM JWT/OAuth 直连)已接真实业务。工程质量高(契约先行、fail-closed、脚本守门),但 E2E 直连栈与 OctoDesk 的 Bridge/契约体系深度耦合,复用要拆。

---

## 问题 1:架构拓扑

**【事实】三层拓扑,LAN 直连优先 + 服务端中继兜底,无 WebRTC P2P 打洞。**

1. **LAN 直连**:桌面 Electron main 起一个本机 WebSocket server(`electron/services/desktopRemoteHost/transport.ts:1-42`,注释明确 "WebSocket transport in Electron main"),配对票据里带多个 LAN endpoints(`electron/services/desktopRemoteHost/pairing.ts:44-50` 的 `PairingInterface {host, port}`)。iOS 端按候选列表逐个探测,LAN 候选连接超时仅 1.2 秒(`apps/ios/App/Sources/DesktopRemoteTransport/DesktopRemotePlugin.swift:620,661`)。
2. **服务端中继兜底**:LAN 全部失败后回退到 OctoDesk 自建 WS relay。`server/src/api/desktop-remote-relay/index.ts:1-19`:两个 WS 端点 `/host`(桌面反向连接)和 `/mobile`(手机连接),"The relay is pure bytes-pipe: every frame is forwarded to the other peer without inspection. Noise XX (E2EE) sits on top"。
3. **服务端信令面**:桌面注册为 host 并保持一条 events WS(`server/src/api/desktop-remote-cloud/desktop-hosts.ts:1-6`,注册/列出/撤销 + events WS 订阅;桌面侧 `electron/services/desktopRemoteCloudClient.ts:102,133` 连 `/api/devices/desktop-hosts/:id/events`);手机通过 REST 创建 pair intent 并 1Hz 轮询(`src/mobile/services/mobileDesktopCloudPair.ts:5-15`);服务端把 pair intent 推给在线桌面(`server/src/api/desktop-remote-cloud/pair-tickets.ts:29-32` 的 `pushToHost`/`isHostOnline`)。
4. **中继会话是 RAM-only**:`server/src/services/desktop-remote-cloud/relay-session.ts:14-17`,"Storage is RAM-only by design…sessions are 5-15 min transient"。

**【事实】无 P2P NAT 打洞/WebRTC**:relay RFC 走的是自建 WS 中继而非 TURN/ICE;全 mobile/server/electron 范围 rg webrtc 无命中(见问题 2 检索)。
**【推断】** `PairingInterface.source` 有 `'overlay'` 枚举(`src/mobile/pairing/desktopRemotePairingTicket.ts:20`),可能预留 Tailscale 类 overlay 网络,但未见实现。

另外还有一条独立通道:**手机↔企业服务端**的常规 HTTPS API(`src/mobile/services/mobileHttp.ts:32`,默认 base `https://qianshou-api.octoooo.com`),承载 Mail/Calendar/Files/AI 等 server-backed 业务,与 Desktop Remote 互不依赖。

## 问题 2:通信传输

**【事实】按通道分层:**

| 通道 | 传输 | 证据 |
| --- | --- | --- |
| 手机↔桌面 Desktop Remote | **WebSocket 二进制帧**(自定义 wire format:1 字节 type tag + payload;steady state 为 0x20 加密 envelope 帧) | `electron/services/desktopRemoteHost/transport.ts:9-31`(帧格式注释)、`:52` `import { WebSocket, WebSocketServer } from 'ws'` |
| 桌面↔服务端(信令) | WebSocket(events WS,反向长连) | `desktop-hosts.ts:1-6`;`desktopRemoteCloudClient.ts:133` |
| 手机↔服务端(中继数据) | WebSocket(字节管道) | `desktop-remote-relay/index.ts:6-8` |
| 手机↔服务端(业务 API) | HTTPS fetch(JSON) | `src/mobile/services/mobileHttp.ts:1-27` |
| 手机 AI 流式 | **SSE**,且 SSE 传输由原生壳执行、WebView 只渲染 chunk(经 Bridge `sse.start`/`sse.event`/`sse.end` 转发) | `src/mobile/services/mobileAiStream.ts:4-6`("The native shells own the SSE transport");`src/mobile/services/useBridgeSseStream.ts:7-19` |
| 配对 intent 状态 | HTTP 轮询 1Hz | `mobileDesktopCloudPair.ts:10` "`pollPairIntent()` → GET /api/devices/pair-tickets/:id (1 Hz)" |
| 心跳 | Desktop Remote 15s 心跳 / 45s 超时 | `DesktopRemotePlugin.swift:57-58` |

**【事实】无 WebRTC**(rg 全 `src/mobile server/src electron/services` 只在无关文件命中 websocket 等词,webrtc 零命中)。推送另见问题 5。

## 问题 3:认证与安全

**【事实】双体系:Desktop Remote 用"票据 + Noise XX E2E + 桌面确认",服务端 API 用 JWT。**

### Desktop Remote(手机↔桌面)
- **配对**:桌面 `openTicket()` 生成一次性票据(随机 ticketId + nonce,默认 TTL 5 分钟),经 **QR 码扫描 / 手动粘贴 / 云下发**三种途径给手机(`pairing.ts:8-18,70-71`;`desktopRemotePairingTicket.ts:4-8` "Inputs can come from QR scan, explicit manual paste, or cloud polling")。票据内含桌面静态公钥 `hostPublicHex`(`desktopRemotePairingTicket.ts:15`),即桌面身份 key 经带外(QR)分发。
- **状态机**:`idle → awaitingMobile → awaitingDesktopConfirm → established`,需要**桌面端人工确认**(`pairing.ts:8-14`);已信任设备可跳过确认自动配对(`trustedDevices.ts:8-19`,"已配对过的手机再次配对自动成功",信任锚定手机长期 Curve25519 公钥)。
- **E2E 加密(有,真 E2E)**:Noise XX 等价握手,pattern 字符串 `OctoDesk/desktop-remote/XX/X25519+HKDF-SHA256+AES-256-GCM/v1`(`DesktopRemotePlugin.swift:60`)。互认证 + 前向保密 + 身份隐藏,msg1/2/3 流程、HKDF key chain、每方向 64-bit counter nonce、防重放(counter 回退即断)全部写明(`noise-handshake.ts:1-57`)。中继模式下服务端只见密文(`desktop-remote-relay/index.ts:17-18`)。
- **密钥保管**:手机侧 X25519 静态私钥 + Ed25519 身份私钥都在 Keychain,不进 WebView(`DesktopRemotePlugin.swift:11-16` privacy invariants);桌面侧 hostKeyStore(`desktopRemoteHost/hostKeyStore.ts`)。
- **中继认证**:短命 sessionToken(≤15 分钟,HMAC 签发)经 query param 传递,relay 不验 JWT——注释解释因为三平台原生 WS 客户端不能可靠带 Authorization header(`desktop-remote-relay/index.ts:10-16`;`relay-session.ts:22-27` RELAY_TOKEN_HMAC_KEY)。
- **权限最小化**:capability scopes 按票据授予、fail-closed(`transport.ts:71-74` `checkEnvelopeCapability`);desktop-remote 是**只读面**,所有写/破坏性工具进 denylist,有防漂移测试守门(CLAUDE.md:403;`electron/services/desktopRemoteHost/__tests__/realAgentRunner.test.ts:32,105`)。

### 服务端 API(手机↔服务端)
- **JWT HS256 access+refresh**,refresh 防重放靠 DB 行单次使用(CLAUDE.md Tech Stack 表,server Auth 行)。
- **refresh token 永不进 JS runtime**,由原生壳存 Keychain/EncryptedSharedPreferences/HUKS,access token(约 1h)只存 WebView 模块级单例、不落 localStorage(`src/mobile/services/mobileAuth.ts:7-15`)。
- **设备池 entitlement**:`X-Device-Id` 激活 + 心跳 staleness 窗口,`requireEntitlement({feature})` 中间件分级灰度(CLAUDE.md:440);云配对路由整体挂 `cloudRelay` entitlement(`pair-tickets.ts:40-45`)。
- **【未确认】** 手机↔服务端 HTTPS 是否强制 cert pinning 未查证。

## 问题 4:状态同步 / resume

**【事实】Desktop Remote 断线恢复机制完整且规范;通用数据 sync 是 503 stub。**

- **Desktop Remote resume**:专用 wire 帧 `0x03 resume.hello / 0x04 resume.ack`(`transport.ts:19-24`)。手机用 Keychain 中的 **Ed25519 身份 key 对 resume.hello 做 JWS 签名**,桌面用 trustedDevices 存的公钥验签(`resumeProof.ts:1-14,37-60`;`trustedDevices.ts:38-40`);**resume nonce 单次消费防重放**(`transport.ts:340,382-387` `consumeResumeNonce`);协议 `octodesk-resume-v1`(`DesktopRemotePlugin.swift:59`)。
- **中继 resume**:手机可向 `/api/devices/desktop-hosts/:hostId/relay-resume` 申请新中继会话再走 resume 握手(`DesktopRemotePlugin.swift:729-800` `requestRelayResume`/`relayResumeURL`;server 侧 `desktop-hosts.ts:18` `createRelayResumeRequest`)。iOS 状态机含 `reconnecting/suspended/offline/hostKeyChanged` 等完整恢复态(`DesktopRemotePlugin.swift:37-53`)。
- **跨设备数据同步**:**未实现**。`/api/sync/*` 全部返回 503 `INFRA.ENDPOINT_NOT_IMPLEMENTED`,契约已定义但实现 scoped to P5+(`server/src/api/sync.ts:1-17`)。
- **AI 流 resume**:**未实现**。`/api/ai/resume/:streamId/resume` 是 503 skeleton,客户端把 503 解读为"本服务器不支持 resume"降级(`server/src/api/ai/resume.ts:2-16`)。
- **离线**:`/api/offline/*` 有真实现(pin 元数据 Prisma 持久化 + outbox 计数,不存实体 body)(`server/src/api/offline.ts:1-9`)。
- **【事实】桌面 Agent 会话的 handoff/resume 持久化**是另一套(Synara 借鉴合入,CLAUDE.md:342),属桌面 BYOA 域,与手机通道无直接关系。

## 问题 5:推送

**【事实】自建 server 直连 APNs + FCM,已接真实业务(2026-07-07),不经第三方推送 SaaS。**

- **Provider adapters**:APNs 走 **JWT(ES256 team/key)HTTP/2 直连**(`server/src/services/push/providerAdapters.ts:94-153` `apnsJwt()`/`apnsEndpoint()`);FCM 走 **OAuth access token**(`providerAdapters.ts:37-61` fcmAccessTokenCache);缺 env 抛 `PushProviderNotConfiguredError` 优雅降级而非 503(CLAUDE.md 移动专章)。HMS(HarmonyOS)在契约里列了(`push-payload.ts:7-8`)但鸿蒙侧 notifications 能力仍是"语义假接通"(CLAUDE.md:60 专章 [warn] 段)。
- **隐私红线**:push payload **只带 opaque id + 最小元数据**,禁止 message body/prompt/路径/OAuth secret 过第三方基础设施;meta key 白名单 server 端强制剥离(`packages/core/src/contracts/push-payload.ts:12-21,53-57`)。kind 枚举含 `agent.completed`/`task.attention_required`/`intel.completed` 等——**"完成/需输入通知手机"正是走这个**(`push-payload.ts:28-44`)。
- **API**:`POST /api/push/digest|test` + idempotencyKey 冲突检测(409)(`server/src/api/push.ts:29-70`);push token 注册幂等、服务端只存 sha256 digest 不存原始 token(`server/src/api/devices.ts:12-16`)。
- **【事实】完整 Push UX / native channel 仍按 evidence 门控**(CLAUDE.md 移动专章:"完整 Push UX / native upload channel(P3/P4.2 才接,当前仅 server 骨架 + token 烟测)")。即服务端管线真、端上体验未完线。

## 问题 6:成熟度 + 可复用性裁决

### 成熟度(【事实】,以 `docs/plan/2026-06-06-mobile-readback-ledger.md` 为准)
- **已在基线**:R0+P0 工程铺底、Desktop Remote 基础(host/relay preflight/QR/pairing/只读 remote agent)、Home/Mail/Files/Calendar 前台写基线、bundle/privacy/deeplink gates(ledger §2)。
- **未完**:真实 multi-peer drill 仍是 blocker(ledger §2 Remote handoff 行);R1 live upload、R2 multi-peer drill、R3 approvals 按 blocker 管理;P5+ 待 GA;`/api/sync` 与 AI stream resume 是 503 stub(ledger §3;`sync.ts`/`ai/resume.ts`)。
- **R4 泛化 remote write 明确 No-Go**(ledger §3),desktop-remote 保持只读面。
- **工程规范度评价(【推断】,基于所读代码)**:先进且规范——契约先行(Zod + OpenAPI → TS/Swift/Kotlin/ArkTS 四端 codegen,CLAUDE.md 移动专章)、自研 Noise XX 握手带完整协议注释与 fail-closed 失败模式、防漂移测试守门、审计 sink 不记 payload 字节(`transport.ts:33-35`)、模块边界纪律(transport 不 import ipcMain,pairing 纯库)。iOS 传输插件 1214 行、桌面 host 栈约 5700 行,是认真做的产线代码,不是 demo。

### VoiceLoop 可复用性裁决

**可直接借鉴(设计/协议层,搬思路不搬代码)**:
1. **拓扑模式**:LAN WS 直连优先(1.2s 快速探测)+ 自建 WS 字节中继兜底 + 服务端只做信令/中继不碰明文——这是"手机沟通面↔Mac 执行面"的成熟范式,比 WebRTC 简单可控。
2. **配对/信任模型**:QR 一次性票据(带外分发 host 公钥)→ Noise XX 互认证 → 桌面人工确认 → trustedDevices 免确认重连。整套状态机 + 一次性票据 + 公钥即设备身份的设计可整体照搬。
3. **resume 协议**:Ed25519 JWS 签名 resume.hello + 单次 nonce + 中继 relay-resume 端点,断线恢复设计完整,直接可抄协议。
4. **推送隐私契约**:opaque-id-only payload + meta 白名单 + token 只存 digest + 幂等 key,这套 push 卫生规范值得原样采用。
5. **密钥保管纪律**:refresh token 永不进 JS/WebView、E2E 私钥只在 Keychain、原生壳own SSE 传输——若 VoiceLoop 手机端也是 WebView 混合架构,这是必须学的边界。

**绑死 OctoDesk、不能直接搬的**:
1. **代码级依赖**:全栈依赖 `@octodesk/core/contracts/*`(desktop-remote、desktop-remote-resume、native-shell、api/devices 等 Zod 契约)+ Bridge v1 消息体系 + capability/scope 枚举(mail/calendar/files 语义),拆出来等于重写类型层。
2. **服务端耦合**:relay/pair-intent 挂在 Hono + Prisma + `requireEntitlement`(license/设备池)中间件上;中继会话 RAM-only 也预设了 OctoDesk 的"5-15 分钟瞬态"用法。
3. **只读红线**:OctoDesk desktop-remote 特意做成只读面(写工具 denylist);VoiceLoop 要"手机下指令、桌面执行",方向相反,capability 模型要自己重定义(但 fail-closed + denylist 守门测试的做法应保留)。
4. **三端原生壳**(SwiftUI/Compose/ArkUI + WebView + Bridge)工程量大,VoiceLoop 若只做 iOS 或 PWA 不必照搬。

**一句话裁决**:OctoDesk 的连接层是可抄的"协议设计模板"(拓扑、配对、E2E、resume、push 卫生五件套都到产线水准),但不是可 import 的库;VoiceLoop 应按其 RFC 思路重实现瘦身版(单平台、双向 capability),而非 fork 代码。关键参考文档:`docs/plan/2026-05-13-desktop-remote-workbench-rfc.md`、`docs/plan/2026-05-13-desktop-remote-cloud-pairing-rfc.md`(多个源文件头注释引用,文档本身未读——【未确认】其与代码的一致性)。

---

## 附:本次已读关键文件清单

| 文件 | 角色 |
| --- | --- |
| `CLAUDE.md`(Mobile Companion 专章等) | 边界与状态口径 |
| `electron/services/desktopRemoteHost/transport.ts` (1330 行) | 桌面 WS 传输 + wire format |
| `electron/services/desktopRemoteHost/noise-handshake.ts` (568 行) | Noise XX E2E 握手 |
| `electron/services/desktopRemoteHost/pairing.ts` (404 行) | 配对状态机/票据 |
| `electron/services/desktopRemoteHost/trustedDevices.ts` / `resumeProof.ts` | 信任存储 / Ed25519 resume JWS |
| `electron/services/desktopRemoteCloudClient.ts` (676 行) | 桌面→服务端 host 注册 + events WS |
| `server/src/api/desktop-remote-relay/index.ts` | 自建 WS 字节中继 |
| `server/src/api/desktop-remote-cloud/{pair-tickets,desktop-hosts}.ts` | 云配对信令 |
| `server/src/services/desktop-remote-cloud/relay-session.ts` | RAM-only 中继会话表 |
| `apps/ios/App/Sources/DesktopRemoteTransport/DesktopRemotePlugin.swift` (1214 行) | iOS 原生传输(LAN 探测/中继回退/resume) |
| `src/mobile/services/{mobileHttp,mobileAuth,mobileAiStream,useBridgeSseStream,mobileDesktopCloudPair}.ts` | 手机↔服务端 HTTPS/JWT/SSE |
| `src/mobile/pairing/desktopRemotePairingTicket.ts` | 票据解析(QR/粘贴/云) |
| `server/src/api/{push,devices,sync,offline}.ts` + `server/src/api/ai/resume.ts` | 推送/设备/同步/离线/resume API |
| `server/src/services/push/providerAdapters.ts` + `packages/core/src/contracts/push-payload.ts` | APNs/FCM 适配器 + 推送隐私契约 |
| `docs/plan/2026-06-06-mobile-readback-ledger.md` | 成熟度实况台账 |
