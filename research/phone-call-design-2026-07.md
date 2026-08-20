# SayDo 通话形态设计方案(Phone-Call Mode)· v3(定稿·已锁定)

> **状态:定稿并锁定(owner 2026-07-25),不立即实施。** 8 项 owner 决策已拍板(全按推荐,见 `phone-call-owner-decisions-2026-07.md`);实施时机 = 场次②/③ dogfood 跑 1–2 周体感缺口 + 有数据后,先过 Phase 0 spike 再启动(解锁触发见决策清单文末)。锁定期本方案为"冷冻可执行件"。
> **v3——已吸收 4 subagent 交叉评审 + Codex(gpt-5.6-sol,max)对抗评审(No-Go→按 A1–A9 修正)。评审 triage 全文见 §9。**
> **上游证据**:`voice-call-channel-scan-2026-07.md`、`saydo-improvement-scan-2026-07.md` §3.4(F4/F5)、`voice-model-tech-scan-2026-07.md`、`mobile-desktop-connectivity.md`;Codex 报告 `codex-findings/logs/15-phone-call-design.log`。
> **地基现状(已核实,含评审修正)**:SayDo P0+P0.5 工程收口(`just ci` 双矩阵绿,以实际运行为准——不锚定固定测试数以免漂移)。**评审修正 v1 三处认识错误**:① VoiceHub 现为 pipeline/console 双角色广播契约(下行 MP3 句帧、PTT 整段 ASR、无设备身份、mic 缓冲全局单一),`phone` 是**新 adapter/role 而非"复用契约"**;② C4 outbox 无 transport/设备/来电状态字段,`attemptNotify()` 置 `notified` **不代表来电已呈现或接通**——需独立通话投递表;③ **"不引 WebRTC"是 v1 的错误裁决**——D12/03 §8 早已定稿"iOS 原生 WebRTC 音频";D13 反对的只是 WebRTC **P2P/TURN**。媒体传输须走 ADR/spike(§2.6)。
> **红线继承**:S3 屏幕强认证、effect-based 风险、三熔断、状态词纪律、两把钥匙不变。**但"不触碰 Gate 0"的 v1 声明被 Codex A8 否决**——手机是新的可写远程通道,必须出 **Phone-call Gate 0 addendum**(§3.7)重新关闭 G1/G5/G6 与跨边界幂等,owner 拍板 + canonical 回写后方可实现。

## 0. 一页决策摘要

**做什么**:把"通话"做成 SayDo 移动端核心交互——**AI 打给你**(任务卡住/失败/待审批时手机锁屏来电,接起听汇报、口头给下一步)+ **你打给它**(App 内"呼叫 SayDo",随时挂断、任务照跑)。走 VoIP(Tailscale 加密通道),不使用 PSTN 分钟费(但有 APNs/网络/ASR/TTS/开发者账号等基础设施成本,不等于零成本)。

**为什么现在**:① P0 控制面(回叫 outbox/审批矩阵/会话重建)是通话形态的地基,但评审确认还需四块前置改造(VoiceHub 通话化 / 网络身份 v2 / 通话投递层 / A2 live 接线)——通话是"地基上的第一层楼";② 2026-07 行业(GPT-Live/Grok)已把"AI=可通话"变成用户预期,SayDo 差异点:**挂了电话,活还在干;干完了,它打给你**;③ dogfood 即将开始,owner 离电脑后当前只有 ntfy 文本推送,接不起对话。

**不做什么(硬边界)**:PSTN/SIP 真号码(P2)、Android(P2)、供应商语音平台托管、语音克隆、多人通话、S2S 引擎、手机全功能控制台、唤醒词/常听、Watch/Live Activity、呼入 CallKit 化 + iOS 快捷指令(P1.5)。

**安全立场**:手机通道**硬性 `risk ≤ S2`**(校验器固定,不可配);锁屏接听 = 只听去敏摘要 + ack/拒接/推迟;S1/S2 需**解锁 + 前台 + 每次新鲜本地生物识别**;S2 消费凭据 = **在场生物识别签名**(不是"解锁布尔 + WebView 点击");S3 维持屏幕强认证;推送仅唤醒信号(opaque id);WebView 不持长期凭据。

**判定与前置**:Codex 判 v1 **No-Go(一次交付)**;解除条件 = A1–A9 全修 + 媒体/CallKit spike 形成量化门槛 + Phone-call Gate 0 addendum 经 owner 拍板并回写 canonical。**工作量 24–34 工程日**(spike 后滚动重估;不含 Apple 分发等待与安全回修)。**外部前置**:Apple 开发者账号、iPhone 真机、Tailscale、(蜂窝兜底)可选国内自建 DERP。

## 1. 产品设计

### 1.1 交互隐喻:一对动词"呼叫/接听"

| 方向 | 入口 | 体验 |
|---|---|---|
| **呼出(AI→人)** | PushKit 唤醒 → CallKit 锁屏来电,**统一显示"SayDo"**(不带项目名——`includesCallsInRecents=false`,项目名接通认证后再显示) | 接通预热占位音 → "{项目}的事,{原因一句话}。现在方便吗?"→ 听汇报、(解锁后)口头 steer、ack/拒接/推迟 |
| **呼入(人→AI)** | App 内"呼叫 SayDo"(**P1=App 内直连对话**;CallKit `startCall` 化 + 快捷指令 = P1.5) | 接通即重建会话(Context Pack):查状态/继续采访/(解锁后)追加指令/新任务口述 |

**心智模型**:和一直在干活的同事通电话——通话结束 ≠ 交互结束。挂断 = `suspend_session`;再打 = 重建(A2 机制,A2 live 接线为前置工程 §4.4)。

### 1.2 通话中能力边界(冻结状态矩阵,A1;术语按 04 §5.2 归位,评审安全 4)

**硬约束:手机通道 `risk ≤ S2`(校验器固定);S3 无消费路径。**

| 能力 | 锁屏接听 | 解锁+前台+新鲜生物识别 | 定性 |
|---|---|---|---|
| 去敏摘要("2 项等验收,1 项要你拍板") | [ok] | [ok] | S0 只读、去敏 |
| 完整汇报(项目名/decisions[]/细节,经 redactor) | [fail] 引导解锁 | [ok] | S0 只读 |
| ack / 拒接 / 口头推迟 | [ok] | [ok] | 回叫状态机既有语义 |
| 口头 steer / 答 agent 提问 / 新任务口述进 draft | [fail] | [ok] | **远程下发指令**(04 §5.2:已配对+认证态,全程留痕;通话来源 utterance 打 transport+taint,draft 转正需桌面二次确认) |
| **S2 审批确认** | [fail] | [ok] 在场生物识别签名(§3.2) | 04 §5.2 封顶 S2 |
| S3 审批 | [fail] 转屏幕 | [fail] 转屏幕 | 04 §5.1 不变量 |

**steer 按后端能力降级(A14)**:通话握手读运行时 capability——Claude live-steer 原地注入;Cursor/无 live-steer 播"取消后重建";Hopper `step_confirm=unsupported` 播"这个任务不能中途改,要么等它到验收点、要么取消重来"。V1 拆三后端验收场景。

### 1.3 与回叫升级链的融合(04 §4 增量;09 §6.3 补状态转换)

- **高 urgency(blocked/failed/approval_request)**:桌面语音回叫无应答 → **CallKit 来电**(不同发 ntfy;`voip_ring_timeout_sec=30` 无人接 → missed → 补 ntfy → 升级链继续);
- **拒接(A/评审①-4)**:主动按掉 = ack-later,立即补 ntfy,`voip_redial_after_min=30` 后至多补叫一次,再无应答只 push;与 missed 区分记录;
- **低 urgency(ready_for_review)**:默认 push 不来电(`voip_call_for_review=false`);
- **来电频率熔断(A17)**:`voip_max_calls_per_hour=2`,超限聚合为一条 push;
- **通话中新事件(评审①-2)**:通话期间到达高 urgency 事件经输出仲裁**并入当前通话播报**,不发第二通来电;挂断时未播报的走升级链;
- **09 §6.3 新增状态转换**:现状唯一升级转换要求先 ack(评审②-②),需补 "notified 无应答超时→requeued(missed)";outbox 投递语义见 §2.5 独立表。

### 1.4 话术增量(docs/10 新条目;继承 M6 变体三档 + 封闭肯定词表)

来电开场(30 字内先给上下文)、呼入开场、接通预热占位("正在接通…"超时降级)、无屏声明态(转屏点二选一)、口头推迟、拒接/挂断收尾、S2 门控引导("解锁点一下确认")、去敏摘要(锁屏态)。**呼出脚本纪律**:AI 通话中永不索要口令/密钥/验证码;用户主动报出也不记录(A9:文案改"不会主动索要,仍按转写同意策略留存",不承诺"绝不记录"直到输入侧脱敏实现)。

## 2. 技术架构

### 2.1 拓扑与连接(复用 D13 + 评审修正)

```
iPhone(Capacitor 外壳)              Mac(daemon)
┌──────────────────────┐            ┌──────────────────────┐
│ WebView: console      │◄─ wss ────►│ console 静态托管(HTTPS)│
│  (只读 view model,     │            │ VoiceHub + phone role │
│   不持长期凭据 A3)     │            │ 通话投递表(新)        │
│ 原生层(独占凭据/签名): │◄─ 媒体 ───►│ 网络身份 v2(新)      │
│  PushKit/CallKit      │  (§2.6)    │ APNs 客户端(新)       │
│  AVAudioSession+媒体  │            │ 设备/nonce/authEpoch  │
│  Secure Enclave       │            │  表(新)               │
│  native bridge(白名单)│            │                      │
└──────────────────────┘            └──────────────────────┘
        └── Tailscale(WireGuard;tailscale serve 反代拿 HTTPS/ts.net 证书)──┘
外部一跳:daemon → APNs(VoIP push,payload=opaque id)
```

- **连接 = Tailscale**(D13:T2 首选);**`tailscale serve` 反向代理**:daemon 维持 loopback bind,反代对 tailnet 暴露 HTTPS——同时解决 secure context(`crypto.subtle` 可用)、ATS、Host 白名单三问(A10);ACL 收窄"仅 owner 手机↔daemon 端口";未知节点告警。
- **网络边界接通(A10)**:补 WSS、证书/主机名轮换、Host/Origin 策略、daemon launchd/休眠健康检查、手机 deep link → tailnet URL 映射;`openOnScreen` 基址按来源设备生成(现硬编码 loopback)。

### 2.2 设备配对与信任(D13 五件套落成可验证协议,A7)

写成状态机(非零散字段):

- **配对**:桌面 console 生成**单次高熵票据**(绑定 daemon 身份 + TTL 5 分钟)→ QR 内嵌**桌面静态公钥指纹** → 手机扫码、本地(Secure Enclave)生成密钥对、只上送公钥 → **桌面与手机同显 6 位 SAS 短码,owner 带外目视比对一致才人工确认** → 落 `devices`(公钥持久化,`pubkey_fpr` 仅索引、验签用完整公钥)。
- **重连**:签名 resume(私钥签 `nonce ‖ device_id ‖ session_id ‖ ts`)+ **单次消费 nonce**(`challenge_nonces` 表)+ 时钟窗 + 查 `device.status=active`,绑定本次 WS `sessionEpoch`。**原生通道身份仅由设备签名裁决,HTTP Origin 对原生客户端无效**。
- **撤销**:递增 `authEpoch` → 关闭该设备活跃 WS → 作废其未消费 presentation;撤销/消费竞态走事务校验;console 设备管理页 + "一键 panic revoke 所有移动设备"。

### 2.3 WebView 与原生凭据边界(A3,新增关键节)

- **原生层独占**设备私钥、设备 token、审批签名 API;
- **WebView 不接收长期凭据**,只拿**短期只读 view model**(不再像 P0 console 那样把 capability token 写 URL/localStorage);
- 所有**写动作**经**显式 allowlist 的 native bridge**,bridge 执行本地生物识别 + Secure Enclave 签名;daemon 对 HTTP/WS/bridge **统一校验设备、能力、来源、会话绑定**;
- console 加移动环境探测:禁用 web 麦克风采集(改走原生桥事件),写入口默认只读/重定向到 bridge。

### 2.4 推送与来电链(呼出;连接预热 A/评审⑤)

```
C4 outbox 命中 voip_call → daemon 经 APNs HTTP/2(JWT ES256,apns-push-type=voip,
  topic=<bundleId>.voip)发 VoIP push,payload={opaque_callback_id}(绑 targetDeviceId+TTL+单次消费)
→ PushKit 唤醒 → 【delegate 返回前同步 reportNewIncomingCall】(callservicesd ~7s 二次核查,
  违则进程被终止;不是"5 秒内先干别的")
→ 响铃期同时预热 tailnet(VPN On-Demand)+ 预建 WS(吃掉睡眠后连接空窗)
→ CallKit 锁屏来电(显示"SayDo")→ 接听 → 设备认证握手 → opaque_id 经认证通道拉取上下文
→ 未就绪播占位音,超时 voip_connect_timeout_sec 降级 ntfy → 就绪则重建会话 → Brain 播报
```

- **推送隐私(F5/A11)**:payload 只 opaque id;push 不携带也不触发审批语义;**原始 push token 放受控加密存储/Keychain**(digest 仅去重,无法凭 digest 发 APNs——A11 修正 v1);未过设备认证的 WS 不呈现业务内容;
- **APNs 凭据生命周期**:p8 密钥 + bundle/team + **sandbox/production 环境隔离**(开发直装=sandbox、TestFlight=production,daemon 配 `apns_environment`)+ token 轮换 + 失效清理 + report 失败回写;
- **普通通知维持 ntfy**(D11;**回写 D11 记此例外**——D11 原写 P1 迁 APNs 直连,现 APNs 仅承载 VoIP 来电,alert 通知仍 ntfy,A16);低优先绝不走 VoIP push(避免 report 失败节流)。

### 2.5 通话投递与来电状态机(A6,不复用 C4 状态机)

- 保留业务 `callback_outbox`;**另建** `voip_call_attempts` / `notification_deliveries`:记 `deviceId/callUuid/idempotencyKey/apns_status/report_status/answeredAt/endedReason`;
- 来电状态机:`ringing → reported → answered → connected → ended` / 旁路 `missed / auth_failed`;
- 同一 callback 同时只一个活跃 `callUuid`,ack/snooze 只作用于该 callback;
- 断线中间态(A13):`sessionEpoch` + 切网恢复 + "CallKit 已响但 daemon 睡眠/上下文拉取失败"必须有明确 `endedReason` + 回叫重试 + 审计。

### 2.6 媒体传输(A5,先 ADR/spike 决定,不预设裁决)

**v1 "不引 WebRTC" 是错误裁决**——D12/03 §8 已定稿 iOS 原生 WebRTC 音频,D13 反对的只是 WebRTC P2P/TURN(over tailnet 不涉 P2P 打洞)。媒体二选一,spike 量化门槛决定:

- **选项 A(默认倾向)**:原生 WebRTC + Opus(over tailnet DataChannel/媒体),拿成熟 jitter/拥塞/NACK;
- **选项 B**:完整 WS 媒体协议(codec + 20ms 帧 + 时间戳 + jitter buffer + 背压 + sessionEpoch + 切网策略)——现状下行是 MP3 句帧、上行 PTT 整段,均需重做。

spike 量化门槛:锁屏首音延迟、连续通话稳定性、Wi-Fi/5G 切换、受控丢包、后台恢复——达标才进 P1。采样率:上行 48k→16k、下行 24k TTS,转换归手机端;蓝牙 HFP 路由切换重建音频引擎。**AEC**:CallKit `didActivate` 配 AVAudioSession(`.playAndRecord`/`.voiceChat`)。

## 3. 安全设计(要求+缓解口径;A1–A9 修正后)

> 安全评审判 v1 的 F4 走样(把"解锁布尔+WebView 点击"当第二因子);本节按修正后要求陈述,均可测可验。

### 3.1 通道认证分档(04 §5.2 增量)

| 通道 | 认证要素 | 能力上限 |
|---|---|---|
| 锁屏接听 | 持有设备 | 去敏摘要 + ack/拒接/推迟;**不消费任何收据** |
| 解锁+前台+新鲜生物识别 | 持有 + 在场生物识别 | + 远程指令(留痕)+ S2(§3.2) |
| PSTN(P2,不建) | 号码(弱) | 只听去敏摘要 + ack |

### 3.2 S2 确认:在场生物识别签名(A2/F4 核心)

`deviceUnlocked` 布尔**不作凭据**(客户端声明,非认证证明)。正确路径:每次 S2 点击触发**新鲜 `LAContext.evaluatePolicy(deviceOwnerAuthentication)`** → 由**受用户在场保护、不可导出的 Secure Enclave/Keychain 私钥**签 `approvalId ‖ refDigest ‖ presentationId ‖ nonce ‖ deviceId ‖ expiresAt ‖ authEpoch` → daemon 验签 + nonce 单次未用 + `device.status=active` + `authEpoch` 匹配 → 原子消费。**收据新增字段** `transport/deviceId/authProofDigest/authAt`;**校验器固定手机通道最大 S2**。签名在原生层完成,WebView/JS 不接触私钥或签名原语。语音应答不消费收据;超时(`voip_receipt_timeout_sec` > 45s)转 blocked。此点严于现状 canonical,是收紧。

### 3.3 来电信任链与脚本纪律(F5/A9)

push 仅唤醒;内容经认证通道拉取;来电显示名本地渲染。呼出脚本纪律入 instructions(不索要秘密)。**A9 修正**:redactor 现仅处理出方向 TTS 文本;转写落盘(`storeTranscript=true`)无输入侧过滤——需在落盘前实现输入侧数据分类/脱敏,明确音频/原文/摘要各自同意与保留期;未实现前话术不承诺"绝不记录",V5 加真实 token/验证码输入反例。

### 3.4 术语归位(评审安全 4)

通话中 steer/答疑/口述**不套 S0–S3**(执行域副作用等级),统一为 04 §5.2 **远程下发指令**(解锁认证态 + 审计留痕),不标"自动放行"。

### 3.5 隐私增量(评审安全 7/8)

`includesCallsInRecents=false`、来电去项目化;04 §1.3 增"通话 transport"条款(原始音频缺省不留存、旁人入音保守、呼入首次告知转写用途);通话输入打低信任 taint、不直接晋升记忆、draft 转正桌面二次确认(04 §1.4 落地)。

### 3.6 S3 与残余风险(诚实)

S3 维持屏幕强认证。**开放问题(归 owner)**:已配对手机生物识别是否算"已认证屏幕"承载 S3?本方案**保守封顶 S2**,S3 转桌面;放宽需 owner 拍板 + 先落 §3.2 SE 在场签名 + 修 04 §5.1/§5.2 字面冲突。残余风险如实列:设备被物理接管且解锁(缓解:panic revoke + 收据审计 + 覆盖活跃连接 + 短时 S2 认证窗口 + 失败次数限制)、语音重放/克隆在"摘要+ack"面仍可行(ack≠授权;S2 需 SE 签名不受影响)、tailnet 内其他节点(ACL 收窄 + 设备签名 + 告警)、Keychain accessibility 取 `AfterFirstUnlock` 且不 iCloud 同步。

### 3.7 Phone-call Gate 0 addendum(A8,owner 拍板前不得实现为生产可写能力)

手机是新可写远程通道,重新影响并需**重新关闭**:

- **G1 身份/授权**:设备配对 + 在场签名 + 手机通道 risk≤S2 校验器固定;
- **G5 意图审计**:留痕补 `deviceId/callUuid/approvalId/presentationId/authProofDigest/wsEpoch/endedReason`,一条贯通 join;
- **G6 录音/转写同意**:通话音频/转写分别同意 + 输入侧脱敏(§3.3)+ 保留期;
- **跨边界幂等**:opaque callback 单次消费 + 通话投递表幂等 key。

## 4. 数据契约与 canonical 回写增量(实施走轻量评审,M 批模式)

### 4.1 09 增量

- `devices`:`device_id PK, platform, display_name, pubkey(完整,验签用), pubkey_fpr(索引), push_token_ref(受控保管指针), status CHECK, primary, authEpoch, timezone, push_env, paired_at, last_seen_at, revoked_at`;
- `challenge_nonces`:`nonce PK, device_id, issued_at, consumed_at`(单次消费);
- `voip_call_attempts` / `notification_deliveries`(§2.5 状态机 + 幂等);
- `sessions` 增 `transport`(`desktop_web`|`phone_voip`)+ `device_id` + `sessionEpoch`;
- `approvals` 增 `transport/deviceId/authProofDigest/authAt`,消费点校验(§3.2);校验器固定手机≤S2;
- opaque callback:`targetDeviceId/expiresAt/consumedAt` 原子消费;
- `[params]`:`voip_ring_timeout_sec/voip_connect_timeout_sec/voip_redial_after_min/voip_max_calls_per_hour/voip_call_for_review/voip_receipt_timeout_sec/voip_max_call_duration_sec/voip_daily_minutes_cap/apns_environment`,DND 明确时区口径(A12);
- **成本熔断(A17)**:通话 ASR/TTS 分钟入全链成本账本 + 单次/每日/并发/推送频率熔断;
- **顺带对齐既存 DDL 双源漂移**:`sessions.lane`、`tasks.approved_tree_sha` 已在 DDL 但 09 无(评审②-⑥);测试计数以 `just ci` 实际为准,不在文档锚定固定数(A18)。

### 4.2 其他 canonical 增量

02 §7(用户主动呼入)、04 §4(升级链 VoIP 具体化+拒接/熔断/通话中新事件)、04 §5.2(通道分档+SE 签名+术语归位)、04 §1.3/§1.4(通话音频同意+输入 taint)、05 §4(**Phone-call Gate 0 addendum**,A8)、07 D11(ntfy 例外)/D12(Capacitor 插件清单+媒体 ADR)/D13(tailscale serve/cert/ACL/可选 DERP)、10(话术)、03 §7/§8(iOS 先行+媒体裁决记录)、09 §10(VoiceHub phone role+媒体协议+per-peer)。

### 4.3 通话模式 EOU(一等设计项)

现状 PTT 整段;通话免 PTT 需 VAD/语义 EOU(03 §3 三层轮次落地,D2 spike 对齐)。降级兜底:"轻 PTT"(说话时轻触屏幕)过渡,如实告知。

### 4.4 A2 live 接线(前置工程)

SessionManager 挂起/重建已建成但**未接进 live 对话环**(现用进程内 dialogHistory、不查会话态、注记漏 store_transcript 违 G6)。列为通话形态**显式前置工程**:会话态接入对话环 + G1 判定 + `opaque_id→挂起会话定位→rebuild`。

## 5. 范围裁决(in/out)

**In(一次交付,分阶段开发不分步上线)**:1 天 spike(止损门,含媒体+CallKit 量化门槛)、iOS Capacitor 外壳 + 原生插件(PushKit/CallKit/AVAudioSession+媒体桥/Secure Enclave/native bridge)、Tailscale serve/cert/ACL、设备配对(互认证+SAS+resume+撤销状态机)、网络身份 v2、WebView 凭据隔离、APNs VoIP push(含凭据生命周期)、VoiceHub phone role 通话化(媒体协议+EOU+per-peer)、A2 live 接线、通话投递表+来电状态机、呼出全链、呼入(App 内直连)、S2 在场签名门控、成本/时长/并发熔断、话术+golden、Phone-call Gate 0 addendum、安全反例、E2E。

**Out(理由)**:PSTN/SIP(P2,合规+弱认证)、Android(P2)、APNs alert 普通通知(ntfy 已够,回写 D11 例外)、手机全 11 页适配(审批卡 1 页够)、呼入 CallKit 化+快捷指令(P1.5)、锁屏项目名(缓存脆弱+元数据泄漏)、语音克隆/多人/唤醒词/Watch/Live Activity、S3 手机承载(owner 议题)、LAN 直连+自建中继瘦身版(Tailscale 已够 T2)。**iOS 快捷指令明确列 Out→P1.5(A16 消歧)**。

## 6. 风险与开放问题

| # | 风险 | 缓解 |
|---|---|---|
| R1 | CallKit 中国区限制 | 限制在上架审核层,国行真机+大陆网络 CallKit 功能完整(V2EX 实测);自用=开发者签名直装/TestFlight。降级三级:CallKit→LiveCommunicationKit(iOS 17.4+,可过中国区审核)→普通 push+App 内 UI。spike 验国行真机锁屏来电实显 |
| R2 | PushKit report 时序 | delegate 返回前同步 report(~7s 二次核查);节流测试须脱离 Xcode 调试器,复位靠删重装 |
| R3 | 蜂窝+海外 DERP 音频质量 | 媒体 spike 量化(`tailscale ping` 直连率+DERP RTT);预置国内公网 IP VPS 自建 DERP |
| R4 | 睡眠后来电 tailnet 连接空窗 | 响铃期预热(report 同时预建 VPN/WS);占位音;超时降级 ntfy |
| R5 | Capacitor 原生插件工作量 | CallKit UI 层评估 `@capgo/capacitor-incoming-call-kit`(2026 活跃,MPL-2.0);PushKit/媒体桥/SE 自写(媒体桥最难,3–5 天);社区插件不可用则全自写 |
| R6 | Apple 账号/证书/真机 | §7;个人开发者账号支持 VoIP push(免费 Personal Team 不行);签名有效期(直装 1 年/TestFlight 90 天) |
| R7 | 通话中切 App 音频存活 | CallKit 持音频会话+voip 后台模式(架构假设"手机断连不影响后端") |

**开放问题(实施前 owner 拍板)**:① S3 手机承载(建议维持不做);② `voip_call_for_review` 出厂值(建议 false);③ Android 时点;④ 是否预置国内 DERP;⑤ 媒体选项 A(WebRTC)vs B(WS 协议)——建议 spike 决定。

## 7. 实施前置与工作量

### 7.1 工作量(24–34 工程日;spike 后滚动重估,不含 Apple 分发等待+安全回修)

spike(1,止损门)· Capacitor 外壳+tailscale serve(1.5)· 原生插件含媒体桥/SE/路由/采样率(7–11)· VoiceHub phone role 通话化+媒体协议+EOU+per-peer(4–6)· A2 live 接线(1–2)· 网络身份 v2+配对/resume/撤销状态机+WebView 凭据隔离(4–5)· APNs 客户端+凭据生命周期+连接预热(2–3)· S2 在场签名+通话投递表+来电状态机+成本熔断(3–4)· Phone-call Gate 0 addendum+话术+golden+安全反例+E2E+canonical 回写(4–5)。

### 7.2 owner 前置清单

1. Apple 开发者账号(个人,支持 VoIP push);
2. iPhone 真机 + Xcode + 开发者模式(iOS 16+);
3. 手机装 Tailscale、登录同 tailnet、开 VPN On-Demand;
4. 配对仪式内预请求麦克风权限(否则锁屏首次来电采集无权限);
5. (可选)国内公网 IP VPS 自建 DERP;
6. 先跑 **1 天 spike**(止损门):PushKit 唤醒→同步 report→CallKit 接听(国行真机锁屏实显)→AVAudioSession 采集→媒体(A/B 各测)→ts.net WS/媒体回传 + 蜂窝直连率/空窗时长——**不通过则止损回炉**。

## 8. 端到端验收场景(交付判定;负例冻结入 Gate 0,A18)

- **V1 全生命周期闭环**(主打卖点):blocked→锁屏来电→接起听卡点→**解锁后**口头 steer→挂断→任务续跑→ready_for_review→ntfy→呼入/App 验收(桌面无人操作);拆 Claude/Cursor/Hopper 三后端 steer 子场景(A14);
- **V2 S2 门控**:通话中 S2→念参数→解锁+在场生物识别签名→消费→继续;锁屏语音"批准"**不**消费(反例);上报解锁布尔无 SE 签名→拒(反例);
- **V3 呼入**:锁屏→App 呼叫→听状态总账→口述新任务进 draft(带 transport/taint)→桌面二次确认转正;
- **V4 降级**:关 Tailscale→ntfy;重开→恢复;睡眠 8 小时后来电→预热→接通(空窗 ≤ 超时);
- **V5 安全反例集(冻结入 Gate 0)**:未配对 WS 拒;伪造 push 不呈现内容;吊销即失效且断活跃连接;通话任何 S3 一律转屏幕(无 S3 消费路径);过期/重用配对票据拒;重放已用 nonce 握手拒;上报解锁布尔无 SE 签名拒;跨设备拉取拒;撤销竞态一致;WebView 直调写 API 拒;旧 sessionEpoch WS 拒;重复 push 幂等;缺同意标记转写不写记忆;AI 被诱导索要验证码不从;
- **V6 会话经济学**:同任务"来电→挂断→回拨"三次,重建话术自然衔接 + `context_snapshot_uses.rebuild=1` 机械断言(不设主观前缀比例门槛,A18);
- **V7 拒接/风暴**:开会拒接→ntfy 补→30 分钟至多补叫一次;并发 3 任务 blocked→一通来电并入播报+频率熔断;
- **V8 熔断**:单次通话超 `voip_max_call_duration_sec`→收尾;每日分钟超额→降级 push。

## 9. 评审 triage 记录

**4 subagent(2026-07-25)**:范围/过度设计(判轻度过度局部欠缺,核心=呼出接听链)、架构接缝(四大复用假设"倒下两个半")、安全(F5 合格 F4 走样,A 级 4 条)、移动工程(地基牢靠、工时偏乐观)——A/B 级全采纳,见 §1–§8 内联标注。

**Codex(gpt-5.6-sol max)判 v1 No-Go(一次交付)**,19 条:A1(冻结状态矩阵,锁屏只读、解锁才 steer、手机 risk≤S2)、A2(deviceUnlocked 非凭据→在场签名+收据字段)、A3(WebView 凭据隔离+native bridge)、A4(phone 新 role 非复用契约)、A5(**媒体是新选型非"零新选型",D12/03§8 已定原生 WebRTC→ADR/spike**)、A6(独立通话投递表+来电状态机)、A7(配对/resume/撤销落成状态机+authEpoch)、A8(**Phone-call Gate 0 addendum**,"不触碰 Gate 0"声明不成立)、A9(输入侧转写脱敏+文案收敛)——全部并入 v3 对应节;B10–B18(网络边界接通/APNs 凭据链/多设备时区/断线状态机/steer 降级/工期拆门/范围漂移/成本熔断/负例冻结)、C19(锁屏通用标题+成本文案+panic revoke)全采纳。

**冲突裁决(设备密钥)**:范围评审建议"简化纯 bearer 省 1 天",安全评审 + Codex A2/A7 要求 SE 在场签名 + 完整配对协议——**取安全**:S2 在场签名依赖 SE,bearer 无法承载在场证明;设备密钥是 S2 门控地基,非镀金,保留。

---

**v3 结论**:方向与价值不变;认识从 v1 的"换外壳/零新选型/不触 Gate 0"修正为"地基上建第一层楼 + 媒体走 ADR + 出 Gate 0 addendum",工作量 24–34 天。**解除 Codex No-Go 的三件事写死为实施计划的前置门**:① 媒体/CallKit spike 达量化门槛;② A1–A9 全修 + 负例冻结入 Gate 0;③ Phone-call Gate 0 addendum 经 owner 拍板并回写 canonical。据此生成分步骤实施计划(`phone-call-impl-plan-2026-07.md`)。
