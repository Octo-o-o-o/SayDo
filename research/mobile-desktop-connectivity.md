# 移动端 × 桌面/服务端:连接与形态选型(为 §4.22 定稿)

> 日期:2026-07-22。目的:为 VoiceLoop 的 T2/T3 部署形态(手机做沟通面、桌面/服务端做执行面)选定"手机↔桌面/服务端"的连接方式与移动端 App 形态。
> 两部分:**A. 业界最先进/最合适方案(联网调研,已完成)** + **B. OctoDesk 现有实现评估(待 subagent 回填)**。选型建议见 §C。

---

## A. 业界方案(联网调研,2026-07,附来源)

### A1. 手机↔桌面/服务端连接:三条成熟路线

| 路线 | 代表 | 机制 | 优点 | 缺点 | 适配 VoiceLoop |
|---|---|---|---|---|---|
| **E2E 加密中继** | **Happy**(遥控 Claude Code,23k stars,全开源可自托管) | CLI(电脑)+ 手机 + relay server;WebSocket(Socket.IO)传输;QR 码共享密钥(TweetNaCl);**服务器只转发密文、zero-knowledge**;加密推送 | 过防火墙(双方 outbound 连中继)、任意网络可用、隐私强、有推送 | 需运营一个中继(可自托管/用其免费云);非直连有一跳延迟 | **通用底座首选**(尤其 T3 和复杂网络) |
| **Tailscale mesh** | RustDesk/libretether + Tailscale | WireGuard 直连、mesh VPN、NAT 打洞;2026 有 Peer Relays;10% 兜底走 DERP(仍加密) | 免开端口、免自建 relay、直连低延迟、"网络拓扑消失" | 依赖 Tailscale 协调器(新连接);需装 Tailscale | **T2 自桌面场景首选**(人↔自己的 Mac) |
| **WebRTC P2P + 自托管 signaling** | libretether(QUIC+AEAD+pinned Ed25519)、freeremotedesk(Cloudflare Worker signaling) | DTLS-SRTP/QUIC E2E、DataChannel、自动 P2P 升级、relay 只见密文、mutual auth(无 TOFU) | 浏览器优先、零安装、直连低延迟、signaling 极轻 | 自己处理 ICE/TURN、pairing;工程量大 | 备选(要浏览器零安装 + 屏幕流时) |

**共识**:三者都做到"relay 只见密文 + 自动/优先直连 + 双向认证";差别在部署心智——Tailscale 最省心(自己设备)、E2E 中继最通用(任意网络+推送)、WebRTC P2P 最轻量(浏览器)。

来源:[Happy How-it-works](https://happy.engineering/docs/how-it-works/) · [Happy 架构](https://slopus-happy-9.mintlify.app/development/architecture) · [Tailscale+RustDesk](https://tailscale.com/blog/tailscale-rustdesk-remote-desktop-access) · [libretether](https://github.com/JoaaoVerona/libretether) · [freeremotedesk](https://github.com/Teylersf/freeremotedesk)

### A2. 移动端形态:iOS 语音必须原生外壳(关键修正)

**核心结论:PWA 不能承载 VoiceLoop 的移动语音,iOS 上必须原生外壳。** 证据一致:

- **iOS PWA 杀后台音频**:Safari/PWA 在应用后台或锁屏时停掉 `<audio>`;MediaSession 只给锁屏控件、Web Audio/MediaSession 在 service worker 里不可用,无法保活音频。([ZAOOS 研究](https://github.com/bettercallzaal/ZAOOS/blob/main/research/infrastructure/218-mobile-app-strategy-pwa-native/README.md)、[magicbell iOS PWA 限制](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide))
- **iOS PWA 后台任务/VoIP 推送不行**:后台 sync 受限、无 VoIP push、通知投递不可靠(EU 还更受限)。
- **语音 agent 的正解是 CallKit + PushKit + 原生 WebRTC**:PushKit(VoIP push)从终止态唤醒 App(收到后须 5 秒内 `reportNewIncomingCall`,否则被节流);CallKit 提供锁屏来电 UI 并接管音频会话;**AVAudioSession 交给 CallKit 在 `didActivate` 里配置(`.playAndRecord`/`.voiceChat`),拿系统级 AEC、避免"机器人音"**;用原生 WebRTC 而非 WebView 的,拿硬件编码和稳定音频路由。([iOS CallKit+WebRTC 2026 指南](https://callsphere.ai/blog/vw4e-ios-callkit-webrtc-ai-voice-agents-2026.md))
- **Android PWA 尚可**(MediaSession + service worker 可后台保活音频),但为统一体验通常也走原生外壳。

**含义**:桌面浏览器控制台 P0 仍成立;但**移动端语音要 Capacitor/RN/Swift 原生外壳**——这修正了此前"移动端也用浏览器控制台"的假设。

### A3. 一个强落地点:CallKit/PushKit ≈ VoiceLoop 的"语音回叫"原生形态

VoiceLoop 的回叫(§4.6)"电脑干完活主动叫你"在 iOS 上可做成:**PushKit 唤醒 → CallKit 锁屏来电 UI → 接起来就是 AI 汇报**。这比 ntfy 文本推送高级得多,是移动端回叫的理想承载。注意 Apple 的硬约束(5 秒内 reportNewIncomingCall、`voip` 后台模式、让 CallKit 拥有音频会话激活),要按官方 pipeline 实现。

### A4. 与 Codex §17.8 结论的衔接

Codex 语音调研独立指出同一方向:S2S 只做对话呈现层、写操作交文本 agent;打断要截断"已听到历史"(LiveKit 原生);浏览器 AEC 够 P0 基线不够质量承诺、要留原生 VoiceProcessingIO。移动端原生外壳正好承载"原生 WebRTC + 系统 AEC + 打断"这套质量要求。

---

## B. OctoDesk 现有"手机控制电脑"实现评估(已回填)

**结论:OctoDesk 已经把"手机↔桌面 E2E 连接"做到产线水准,是一套可抄的协议设计模板(不是可 import 的库)。** 详见 `codex-findings/octodesk-mobile.md`。

**架构(双通道)**:
- **通道 A · Desktop Remote(重头戏)**:手机原生壳 ↔ 桌面 Electron 的 **LAN WebSocket 直连优先**(iOS 端 1.2s 快速探测候选 endpoint),失败回退到**服务端自建 WS 字节中继**;全程 **Noise XX 风格 E2E**(`X25519+HKDF-SHA256+AES-256-GCM`,互认证+前向保密+身份隐藏,64-bit counter nonce 防重放),**中继只转发密文、不解密**。**无 WebRTC/TURN P2P 打洞**。
- **通道 B · Mobile Companion 云面**:手机 ↔ 企业服务端(Hono.js)的 **HTTPS + JWT + SSE**,承载 Mail/Calendar/Files/AI Chat 等 server-backed 业务;两通道独立。

**配对/信任**:桌面生成一次性票据(随机 ticketId+nonce,TTL 5min,内含桌面静态公钥)→ QR 扫码 / 手动粘贴 / 云下发三途径给手机 → Noise XX 互认证 → **桌面端人工确认** → trustedDevices 记录手机长期 Curve25519 公钥、之后免确认重连。

**resume**:专用 `resume.hello/ack` 帧,手机用 Keychain 里的 **Ed25519 身份 key 做 JWS 签名**、桌面验签,**resume nonce 单次消费防重放**;中继侧有 `relay-resume` 端点重建瞬态会话(RAM-only,5–15min)。

**推送**:**自建 server 直连 APNs(JWT ES256 HTTP/2)+ FCM(OAuth)**,不经第三方 SaaS;**payload 只带 opaque id + 最小元数据**(禁止 body/prompt/路径/secret 过基础设施,meta 白名单强制剥离),token 只存 sha256 digest;kind 枚举含 `agent.completed`/`task.attention_required`——"完成/需输入通知手机"正走这个。

**密钥卫生**:refresh token 与 E2E 私钥**只在 Keychain、永不进 WebView**;access token 只在 WebView 模块级单例(不落 localStorage);**原生壳 own SSE 传输,WebView 只渲染 chunk**。

**成熟度(以 mobile-readback-ledger 为准)**:R0/P0 工程铺底、Desktop Remote 基础(host/relay preflight/QR/pairing/**只读** remote agent)在线;但**真实 multi-peer drill 仍是 blocker**、`/api/sync/*` 与 AI stream resume 是 **503 stub**(契约已定、实现 scoped P5+)、完整 push UX 待 P3/P4.2、鸿蒙 push 仍"语义假接通"。**R4 泛化 remote write 明确 No-Go**——desktop-remote 特意做成**只读面**。

**先进性/规范性评价**:先进且规范——契约先行(Zod+OpenAPI → TS/Swift/Kotlin/ArkTS 四端 codegen)、自研 Noise XX 带完整协议注释与 fail-closed、防漂移测试守门、审计不记 payload 字节。是认真的产线代码(iOS 传输插件 1214 行、桌面 host 栈约 5700 行),不是 demo。

**可复用性裁决**:
- **可抄(设计/协议层,搬思路不搬代码)**:① 拓扑模式(LAN 直连优先+自建 WS 中继兜底+服务端只碰密文,比 WebRTC 简单可控);② 配对/信任模型(一次性票据带外分发公钥→Noise XX→人工确认→trustedDevices 免确认);③ resume 协议(Ed25519 JWS+单次 nonce+relay-resume);④ 推送隐私契约(opaque-id-only + meta 白名单 + token 只存 digest);⑤ 密钥保管纪律(私钥只在 Keychain、原生壳 own SSE)。
- **不能直接搬**:① 代码全栈依赖 `@octodesk/core/contracts/*` + Bridge v1 + capability 枚举(拆出来=重写类型层);② 服务端耦合 Hono+Prisma+`requireEntitlement`(license/设备池);③ **只读红线与 VoiceLoop 方向相反**——VoiceLoop 要"手机下指令、桌面执行",capability 模型要自己重定义(但 fail-closed + denylist 守门测试的做法保留);④ 三端原生壳工程量大,VoiceLoop 单平台起步不必照搬。
- **一句话**:OctoDesk 的连接层是"协议设计模板"(五件套到产线水准),不是可 import 的库;VoiceLoop 应按其 RFC 思路**重实现瘦身版(单平台、双向 capability)**,而非 fork 代码。关键参考:`docs/plan/2026-05-13-desktop-remote-workbench-rfc.md`、`desktop-remote-cloud-pairing-rfc.md`。

---

## C. 给 VoiceLoop 的选型定稿(A 业界 + B OctoDesk 已齐)

**总原则:连接层"抄 OctoDesk 的协议模板 + 用 Tailscale 兜省心",移动端"业界原生外壳 + CallKit/PushKit",都不 fork 代码。**

1. **连接(OctoDesk 与业界收敛到同一答案)**:OctoDesk 的 **LAN WS 直连优先 + 自建 WS 密文中继兜底 + Noise XX E2E** 与业界(Happy E2E 中继 / Tailscale mesh)方向一致,且 OctoDesk 已把配对/E2E/resume 做到产线。定稿:
   - **T2 自桌面**:优先 **Tailscale 直连**(免自建、最省心);想要 OctoDesk 那种"QR 配对 + 无依赖 LAN 直连"体验时,**照 OctoDesk 的协议模板重实现瘦身版**(单平台、双向 capability)。
   - **T3/过防火墙/通用**:**自建 WS 密文中继**(OctoDesk relay 模式 = Happy 式 zero-knowledge,二者印证),服务端只转发密文。
   - **不用 WebRTC P2P/TURN**——OctoDesk 和 Happy 都刻意不用,自建 WS 中继更简单可控;WebRTC 仅在要"浏览器零安装屏幕流"时备选。
2. **配对/信任/resume/推送隐私**:**直接采用 OctoDesk 的五件套设计**(一次性票据带外分发公钥 → Noise XX 互认证 → 人工确认 → trustedDevices 免确认重连;Ed25519 JWS resume + 单次 nonce;推送 opaque-id-only + meta 白名单 + token 只存 digest;私钥只在 Keychain)。这套是现成、经产线打磨的规范,VoiceLoop 重实现即可,不必再从 Happy/业界重新推导。
3. **移动端形态**:**原生外壳(Capacitor 起步)** 承载语音;iOS 用 **CallKit + PushKit + 原生 WebRTC**(CallKit 管音频会话拿系统级 AEC);桌面仍用浏览器控制台。**注意与 OctoDesk 的区别**:OctoDesk 移动端是 WebView 混合 + 原生壳 own SSE、且 desktop-remote 是**只读面**;VoiceLoop 要"手机下指令、桌面执行"(**可写、双向 capability**),方向相反,capability 模型必须自己重定义(保留 fail-closed + denylist 守门测试的做法)。
4. **回叫**:移动端做成 **PushKit 唤醒 + CallKit 来电式语音汇报**(比 ntfy 高级);推送管线可抄 OctoDesk 的 APNs/FCM 直连 + 隐私契约;文本/低优先走 ntfy。
5. **记忆/执行归属**(呼应 §4.22):L1/L2 + 执行(Hopper)在桌面/服务端;手机只做 I/O + L3 会话缓存;手机断连不影响后端。
6. **安全**:远程下发指令需 PIN/设备认证;L3 授权必须手机屏幕/生物识别(呼应 §4.7 v1.14:语音不单独批 L3)。

**关键提醒(成熟度)**:OctoDesk 的 `/api/sync` 与 AI stream resume 目前是 **503 stub**、真实 multi-peer drill 仍是 blocker、完整 push UX 待 P3——所以"手机↔桌面连接"的**协议设计**可抄且成熟,但"跨设备数据同步/AI 流恢复"OctoDesk 自己也还没做完,VoiceLoop 别指望复用这块现成实现,要自己做(且正好对应 Codex §17 指出的"跨边界事务/恢复"P0 缺口)。
