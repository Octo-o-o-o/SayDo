# 模块详设 D · 呈现域(D1–D2)

> **性质**:实施视角详设 + 核对索引,细化 [08](../08-module-design.md) §2 D 域。信息架构真相源 = 08 §6;**视觉与交互真相源 = [11 · UI 规范](../11-ui-spec.md)**(2026-07-24 建立,与 Demo HTML 冲突时 11 胜);话术 = 10。

## D1 · Web 控制台(Console)

- **职责**:桌面浏览器 SPA,11 页全量(owner v2.3:不剪页、每页真实功能、禁空壳):全局区(Dashboard/审批中心/通知/成本/全局设置)+ 项目区(对话/任务/任务详情/记忆/产物/项目设置)+ 项目切换器。**不做**:执行运维面(diff/日志全文属 Hopper Console 排障深链)、自创状态色(11 §2.6 单源)。
- **技术形态**:Vite + React SPA,hash 路由(08 §7-R8);桌面 `http://localhost`(secure context);栈=Tailwind v4 + shadcn/ui + lucide-react(11 §1,禁第二组件库/禁 emoji)。
- **接口面**:路由表与页面职责 = 08 §6(11 路由);数据 = daemon HTTP/WS(capability token + Host/Origin 白名单,G1 网络半边,4.1);状态词与投影 = 09 §7 经 C3;组件合同 = 11 §5(StatusChip 单源/审批卡含 S3 卡 WebAuthn 交互/证据视图/转写流/会话指示器/对话输入区 11 §5.10——三态采集与语音+可编辑转写双呈现,R-A 2026-07-26)。
- **设计要点**:① Dashboard 即主入口("开始新对话/选项目继续"+ 待你处理聚合条 + 项目卡);② 切项目不断语音会话(顶栏指示器锚定,自动断言 5.2);③ review 证据视图按 acceptance 分组,路径二嵌 Hopper trust-report HTML(iframe 直读,零外部跳转,11 §5.5);④ 诚实呈现:假百分比/伪精确/庆祝语全禁(11 §0);⑤ 亮暗双主题 + 跟随系统(11 §2.5)。
- **依赖**:daemon 全部读口 + C4(通知)+ C8(成本);E3(审计事件时间线)。
- **失效与恢复**:纯投影层,刷新即重建;WS 断连显式降级横幅(不静默假实时)。
- **验证归属**:5.1/5.2(Playwright 冒烟:各路由渲染+fixture 一致;切项目不断会话断言;证据视图零外跳)、11 §12(截图基线亮暗各 11 页;禁 emoji CI 门禁)。
- **分期与开放项**:P0(5.1 全局区 → 5.2 项目区)。开放:Console 只读投影 API/SSE(P1,现轮询文件);手机 review 形态深化归 owner(05 §6)。

## D2 · 移动外壳(MobileShell)

- **职责**:Capacitor 原生外壳 + 薄原生模块(PushKit/CallKit/AVAudioSession):回叫即来电(PushKit 唤醒 → CallKit 锁屏来电 → 接起即语音汇报);Android 同壳统一体验。**不做**:PWA 承载 iOS 语音(不可行,03 §8)、独立设计语言(复用 11 响应式规则)。
- **接口面**:连接 = Tailscale 直连优先,或按 OctoDesk Desktop Remote 模板重实现瘦身版(LAN WS 直连 + WS 密文中继 + Noise XX E2E,**不用 WebRTC P2P**);配对/信任/resume/推送隐私五件套采用 OctoDesk 设计(一次性票据/Ed25519 JWS + nonce/opaque push payload/Keychain,03 §7)。
- **设计要点**:① 手机默认**只读+听汇报**,远程指令需配对设备+PIN 且封顶 S2(04 §5.2);② capability 模型自定义为双向(OctoDesk 是只读面,保留其 fail-closed+denylist 守门测试做法);③ 记忆归属:手机只 I/O + M3 会话缓存。
- **依赖**:D1 同一套页面(WebView)+ 原生桥;C4(推送)。
- **验证归属**:P1 阶段自带(推送隐私 payload 白名单测试/配对流测试)。
- **分期与开放项**:P1(T2 拓扑);T3 服务端 = P2。开放:iOS VoIP push 审核策略变化风险。
