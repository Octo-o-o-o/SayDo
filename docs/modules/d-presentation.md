# 模块详设 D · 呈现域(D1–D2)

> **性质**:实施视角详设 + 核对索引,细化 [08](../08-module-design.md) §2 D 域。信息架构真相源 = 08 §6;**视觉与交互真相源 = [11 · UI 规范](../11-ui-spec.md)**(2026-07-24 建立,与 Demo HTML 冲突时 11 胜);话术 = 10。

## D1 · Web 控制台(Console)

- **职责**:桌面浏览器 SPA。页面全集与 IA 以 08 §6 修订为准(2026-08-27 月度审计注:08-05 壳层主轴倒置后,主入口=「今天」`#/today`,侧栏树=开口聊 CTA/今天/全景看板/正在持续的事/记录/旧版折叠,项目选择器沉底;原 v2.3 的"11 页全量+Dashboard 主入口+项目切换器置顶"为历史形态,Dashboard 已入旧版折叠组)。owner v2.3 的"不剪页、每页真实功能、禁空壳"纪律继续有效。**不做**:独立执行运维平台(Hopper Console 深链仅属延期路线设计；现役 Tier1 证据入口按11 §5.5)、自创状态色(11 §2.6 单源)。
- **技术形态**:Vite + React SPA,hash 路由(08 §7-R8);桌面 `http://localhost`(secure context);栈=Tailwind v4 + shadcn/ui + lucide-react(11 §1,禁第二组件库/禁 emoji)。
- **接口面**:路由表与页面职责 = 08 §6(11 路由);数据 = daemon HTTP/WS(capability token + Host/Origin 白名单,G1 网络半边,4.1);状态词与投影按09与现役 Tier1 事件映射；C3 是延期 Hopper 分支索引；组件合同 = 11 §5(StatusChip 单源/审批卡含 S3 卡 WebAuthn 交互/证据视图/转写流/会话指示器/对话输入区 11 §5.10——三态采集与语音+可编辑转写双呈现,R-A 2026-07-26)。主题续接准备期的停采/可重试/`requestId`+`daemonEpoch` 持久/按 `captureId` 认轮/`recognitionOutcome` 区分空轮与识别失败/等 `anchor_status` 再写锚与放行/旧轮稿分列与 `turn.text.result`/未确认音频的屏幕放弃(discard 同时结算 pending registry)与空轮`emptyRound` 见 11 §5.10 与 09 §10.1(本候选已接线处理链,完整语音硬件/云 ASR 未验)。**Focus 生产 loader(09 §15.2,2026-09-20)**:`useFocusPageData` 必须从 `GET /api/focuses/:id`.tasks、`GET /api/tasks/:id`、`GET /api/attention`、live 确认卡灌 `rail.tasks`/`lookups.tasks|packages`;采访只投影已归属会话;批准比 `packageId`+`revision`,禁止任意 `confirmCard`。`#/cost`「全部」用 `byProject`;移动航迹投影保留 `laneId`/`obligationId`(schema 已有,不得剥)。
- **设计要点**:① 主入口=「今天」页(待你处理聚合 + 开口聊 CTA;原"Dashboard 即主入口"已被 08 §6 修订 supersede);② 切项目不断语音会话(顶栏指示器锚定,自动断言 5.2);③ review 证据视图按 acceptance 分组,现役消费 Tier1 持久证据;路径二嵌 Hopper trust-report HTML 为延期设计(11 §5.5),不作为当前实现声明;④ 诚实呈现:假百分比/伪精确/庆祝语全禁(11 §0);⑤ 亮暗双主题 + 跟随系统(11 §2.5)。
- **依赖**:daemon 全部读口 + C4(通知)+ C8(成本);E3(审计事件时间线)。
- **失效与恢复**:纯投影层,刷新即重建;WS 断连显式降级横幅(不静默假实时)。09 §10.1 已接线处理链下,续接 `requestId`/`daemonEpoch`、未 ACK 旧稿与未收到 `turn.text.result.accepted` 的待发稿走 sessionStorage;`prepared`/HTTP 200/`rearmed` 不得当已发送;重载不得当已发送或已无旧稿。`voice_audio_unknown` 只走屏幕「返回处理 / 放弃未确认语音」;不得自动带 discard。屏障 `failed` 后须新 `requestId` 才能观察 `unknownEpochs`;不得把旧 failed 拒绝当未知集通道。跨 Chat 卸载的共享串行协调必须仍能结束在途 prepare。
- **验证归属**:5.1/5.2(Playwright 冒烟:各路由渲染+fixture 一致;切项目不断会话断言;证据视图零外跳)、11 §12(截图基线亮暗各 11 页;禁 emoji CI 门禁)。
- **分期与开放项**:P0(5.1 全局区 → 5.2 项目区)。开放:Console 只读投影 API/SSE(P1,现轮询文件);手机 review 形态深化归 owner(05 §6)。

## D2 · 移动外壳(MobileShell)

以下为移动端目标设计；现役 PG-01B 已关闭远程业务 HTTP/WS，包括只读业务。原生壳构建/历史装机不证明 PushKit、CallKit、Noise 信任链或远程业务已可用，当前证据见release/version-matrix.md与09远程关闭合同。

- **职责**:Capacitor 原生外壳 + 薄原生模块(PushKit/CallKit/AVAudioSession):回叫即来电(PushKit 唤醒 → CallKit 锁屏来电 → 接起即语音汇报);Android 同壳统一体验。**不做**:PWA 承载 iOS 语音(不可行,03 §8)、独立设计语言(复用 11 响应式规则)。
- **接口面**:连接 = Tailscale 直连优先,或按 OctoDesk Desktop Remote 模板重实现瘦身版(LAN WS 直连 + WS 密文中继 + Noise XX E2E,**不用 WebRTC P2P**);配对/信任/resume/推送隐私五件套采用 OctoDesk 设计(一次性票据/Ed25519 JWS + nonce/opaque push payload/Keychain,03 §7)。
- **设计要点**:① 手机默认**只读+听汇报**,远程指令需配对设备+PIN 且封顶 S2(04 §5.2);② capability 模型自定义为双向(OctoDesk 是只读面,保留其 fail-closed+denylist 守门测试做法);③ 记忆归属:手机只 I/O + M3 会话缓存。
- **依赖**:D1 同一套页面(WebView)+ 原生桥;C4(推送)。
- **验证归属**:P1 阶段自带(推送隐私 payload 白名单测试/配对流测试)。
- **分期与开放项**:P1(T2 拓扑);T3 服务端 = P2。开放:iOS VoIP push 审核策略变化风险。
