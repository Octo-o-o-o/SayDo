# SayDo 通话形态实施计划(Phone-Call Mode)· v3(定稿·已锁定)

> **状态:定稿并锁定(owner 2026-07-25),不立即实施。** 8 项决策已拍板(全按推荐);阈值表已落数(Phase -1)。**解锁触发**:场次②/③ dogfood 跑 1–2 周、owner 体感"离机只收文字推送"缺口 + 有数据(回叫接通率/离机时段占比)→ 先跑 Phase 0 spike,过则进 Phase 1。锁定期本计划为"冷冻可执行件",唯一维护 = 若 canonical(09/04)在 dogfood 中改动,解锁时轻量核对接缝漂移。
> **来源**:`phone-call-design-2026-07.md` v3。评审链:4 subagent(方案)→ Codex 15(方案 No-Go→A1–A9)→ 2 subagent(计划)→ Codex 16(计划 No-Go→A1–A4+B/C)。**v3 已吸收 Codex 16 全部**:阈值前移 Phase -1、Phase 5/6 拆 daemon/原生、Gate 0 运行时总闸、CallKit 降级冲突消解、Phase 0.5 拆"通话必需 vs 场次②债务"、G5 字段-表冻结、迁移二选一、验收矩阵、G6 最小门前移。
> **性质**:P1 特性。**分阶段只为分阶段开发,所有"值得做"的内容都在本计划内做完,不做部分上线。**
> **交付定义**:Phase 8 全量 readback + V1–V8 全绿(强制,无 skip)+ owner 真机验收(场次⑥)。
> **红线**:S3 屏幕强认证、手机通道 risk≤S2、状态词纪律不变;涉 canonical 先回写走轻量评审;每 Phase 末 code-review subagent(A 级必修),canonical 攒批 Codex。

## 工期口径(三口径,Phase 0 后按 spike 重估回写)

- **串行总工作量**:40–55 工程日;
- **关键路径**(媒体线∥控制面线、Phase 7 daemon 侧并行 Phase 6):约 34–47 日;
- **另计**:每 Phase 收尾仪式(0.5–1 天×N)、owner 场次、Apple 分发等待、安全回修——不并入上两口径。
Phase 6 真机不可压缩。

## 四道前置门(全部满足才算解除 Codex No-Go)

① Phase 0 spike 达 **Phase -1 已落数并 owner 签认的量化阈值表**;② A1–A9 全修(方案 v3 完成)+ **V5 十四条负例清单 + Gate 0 addendum 同一 canonical digest 冻结**(Phase 1.3);③ Phone-call Gate 0 addendum **owner 拍板 + canonical 回写 + 运行时总闸落地**(Phase 1.4);④ **Phase 0.5 通话共享地基门完成**(仅通话必需的生产接线;场次②桌面 dogfood 债务归还场次②)。

## 阶段依赖图(Codex A2 修正:Phase 5 daemon 编排 / Phase 6 原生实现分离)

```
Phase -1 前置+阈值签认 ──► Phase 0 spike(止损门)──► Phase 0.5 通话共享地基门
                                                          │
                                    Phase 1 契约+Gate0 运行时总闸(owner 拍板门)
                                                          │
                          Phase 2 网络身份v2+配对+WebView认证协议+写API面
                                                          │
        ┌──────────────────────────────────────────────────┼─────────────────────────────┐
  媒体线:Phase 3(VoiceHub phone role+媒体+EOU+3.4 A2 live 接线)   控制面线:Phase 4(APNs+投递表+来电状态机)
        └──────────────────────────────────────────────────┬─────────────────────────────┘
                          Phase 5 daemon 编排/协议(呼出呼入全链+S2 门控,注入测试)
                                                          │
                          Phase 6 iOS 原生实现(PushKit/CallKit/SE/媒体桥,真机)【Phase 7 daemon 侧并行】
                                                          │
                          Phase 8 真机全链 V1–V8 + readback + owner 场次⑥
```

> **Codex A2 关键**:CallKit 全链、`LAContext`/Secure Enclave 签名的**真机验收放 Phase 8**(Phase 5 只在 daemon+注入测试层验协议/编排;Phase 6 出原生实现)。Phase 5 不再声称"验 CallKit 全链"。

---

## Phase -1 · owner 前置 + 阈值签认(owner,约 1 天;缺则停)

**阻塞 Phase 0(缺则停)**:① Apple 开发者账号(个人,VoIP push);② iPhone 真机 + Xcode + 开发者模式;③ Tailscale 装好登录同 tailnet + VPN On-Demand;④ **阈值表(已 owner 签认 2026-07-25,样本 ≥20/指标、p50/p95 双分位)**:接起→占位音首响 p50≤1.5s/p95≤3s;说完→出声(通话内)p50≤1.8s/p95≤3.5s;连续 3 分钟丢帧率 ≤2%;Wi-Fi↔5G 切换恢复 ≤3s;5% 丢包可懂性 = ASR 回转 WER ≤15%;后台恢复 ≤2s;tailnet 直连率 ≥70%;DERP RTT ≤200ms;睡眠 8 小时后接通空窗 ≤10s——实施时补版本/环境/命令/证据路径/失败聚合规则;⑤ **owner 真机操作场次预约**(0.2 锁屏响铃、0.4 睡眠后来电——可先开发但阻塞 Phase 0 出口);⑥ **国内 VPS DERP(已定预置)**。
**owner 拍板项(已全部拍板 2026-07-25,见 `phone-call-owner-decisions-2026-07.md`)**:媒体倾向 A(spike 最终定)、Gate 0 addendum 批准、S3 手机承载维持不做、`voip_call_for_review`=false、Android=P2、CallKit 降级=停下重拍、Phase 0.5 债务按边界拆。

---

## Phase 0 · Spike(止损门,2–3 天;只执行不决策阈值,Codex A1)

| 步 | 内容 | 执行 | 验收 |
|---|---|---|---|
| 0.1 | 最小 Capacitor 工程 + 开发者签名直装国行真机 | AI+owner | 真机运行 |
| 0.2 | PushKit 唤醒→delegate 返回前同步 `reportNewIncomingCall`→CallKit 锁屏来电 | AI+owner | **国行真机+大陆网络锁屏来电实显响铃**;脱调试器测 report |
| 0.3 | 媒体 A/B 各测 over tailnet(可用参考壳对比) | AI+owner | 逐项对照 Phase -1 阈值表 pass/fail,选 A/B |
| 0.4 | 睡眠 8 小时后来电 + 响铃期预热最小验证 | AI+owner | 对照阈值表 |
| 0.5 | spike 报告 + 媒体 ADR | AI | 逐门槛 pass/fail;**不达标 → 止损,owner 重新拍板范围/V1/工期(Codex A4),不在计划内静默降级** |

**出口**:报告 + ADR;owner 确认继续。**CallKit 降级(LiveCommunicationKit/普通 push)若被接受,必须先回写独立验收档、不得让 V1 静默变形(Codex A4)。**

---

## Phase 0.5 · 通话共享地基门(3–5 天;Codex B5 拆分)

> **只做通话必需的生产接线**(评审实证:callback/审批/工具/会话"库+测试就绪、生产未接线")。**桌面完整 L0/L1、全部 BrainTools、桌面 S2 语音确认全链 = 场次②债务,归还场次②**;若场次②已完成,本门以**固定 commit + 回归命令 + 生产入口 + 责任人验收**核对,不凭"已完成"缩短。

| 步 | 内容 | 验收 |
|---|---|---|
| 0.5a | callback outbox **通话必需**运行时:事件源(blocked/failed/approval→enqueue)+ 调度循环 + `index.ts` 装配 CallbackEngine + ntfy 发送器(L1,来电前的降级通道) | task blocked→outbox→ntfy e2e |
| 0.5b | 会话/transport 接缝:SessionManager live 构造(`dialogHistory`→SessionManager)+ store_transcript(G6)+ transport 字段贯通(为 Phase 3.4 铺路) | 会话态驱动对话环 e2e |
| 0.5c | 审批**验证接口**接线(不含桌面 S2 全链 UI,那归场次②):`applyReceiptEvent`/`SignedPresentationStore` 生产可调 + 装配证明 | 收据消费接口 e2e |

**出口**:通话所需的回叫/会话/审批接缝在生产可用;场次②债务清单单列(不并入本门验收)。

---

## Phase 1 · 契约封闭 + Gate 0 运行时总闸(owner 拍板门,4–5 天)

| 步 | 内容 | 验收 |
|---|---|---|
| 1.1 | 回写 09:`devices`/`challenge_nonces`/`voip_call_attempts`/`notification_deliveries` 表 + sessions(transport/device_id/sessionEpoch)+ opaque callback 消费字段 + `[params]` VoIP 9 键 + DND 时区 + ids 新前缀 + §12 通话测试条目编号;**G5 字段-表映射冻结**(Codex B6:deviceId/callUuid/approvalId/presentationId/authProofDigest/wsEpoch/endedReason 各落哪表、主外键、wsEpoch↔sessionEpoch 关系、一条固定 join SQL/fixture);对齐 lane/approved_tree_sha 双源漂移 | 一致性 subagent;round-trip;G5 join fixture |
| 1.2 | **收据迁移二选一**(Codex B7,倾向前者):**新增 phone-specific receipt 表/类型,旧 approvals 不动**(避免 12-step 重建);若必须改 approvals CHECK 词表→取 canonical 迁移例外 + 版本号 + 备份恢复点 + 行数/digest + `foreign_key_check`/`integrity_check` + 回滚 + **"仍为零数据"设为阻塞条件** | 迁移 round-trip;零数据断言 |
| 1.3 | 回写 04(§5.2 通道分档+SE 在场签名+术语归位)/§4(升级链+拒接+熔断+通话中新事件)/§1.3-1.4(音频同意+输入 taint);**V5 十四条负例 + Gate 0 addendum 同一 canonical digest 冻结**(Codex B10) | 一致性 subagent;V5+addendum digest |
| 1.4 | **Phone-call Gate 0 addendum + 运行时总闸**(Codex A3):05 §4 增手机通道关闭 G1/G5/G6+跨边界幂等;**代码固化 `phoneGate0Closed` + `phone_mode_enabled=false` 默认**,所有手机写路径(HTTP/WS 写端点、APNs 发送、native bridge、receipt consume、callback route)**统一调用总闸**;逐端点"Gate 未关拒绝"测试 | **owner 拍板**;逐端点 Gate 拒绝测试绿 |
| 1.5 | 回写 02 §7 / 03 §7-§8 / 07 D11(ntfy 例外)D12 D13 / 09 §10 / 10;设备管理页/首次转写告知/ID 词表明确 in(Codex C14) | 一致性 subagent |
| 1.6 | contracts:新类型+状态机+校验器固定手机 risk≤S2(三层挂点) | 手机>S2 拒;非法转换拒 |
| 1.7 | 攒批 Codex 复核回写 | A 级清零 |

**出口**:canonical 回写 + owner 拍板 addendum + 运行时总闸(默认关)+ contracts 绿。

---

## Phase 2 · 网络身份 v2 + 配对 + WebView 认证协议 + 写 API 面(5–6 天)

| 步 | 内容 | 验收 |
|---|---|---|
| 2.0 | **WebView 认证协议冻结**(Codex B12,Phase 2 前):签发者/TTL/设备+epoch 绑定/刷新/撤销/WS 首认/bridge 参数签名 + 负例(复制/过期/撤销/跨设备/跨 Origin/旧 epoch/非 allowlist bridge/错参 均拒) | 认证时序文档 + 负例清单 |
| 2.1 | `tailscale serve` 反代 HTTPS/ts.net 证书(daemon 维持 loopback);改 `verifyIdentity`(ts.net 主机名+https Origin+原生豁免 Origin);**serve 路径白名单只映 `/`/`/api`/`/ws/voice`,不映 `/dev/*` 与无门静态壳**;证书轮换+休眠健康检查;console `ws://`→`wss://`;Tailscale ACL 收窄+未知节点告警 | 手机经 ts.net 开 console;`/dev/*` 不可达反例 |
| 2.2 | 网络身份 v2:设备签名验证(原生通道仅签名裁决,Origin 无效)+ challenge_nonces 单次+authEpoch+sessionEpoch | 签名/重放/authEpoch 失配拒 |
| 2.3 | 配对状态机(A7):单次高熵票据(绑 daemon 身份+TTL)+QR 嵌桌面公钥指纹+6 位 SAS 带外比对+桌面人工确认+公钥持久化 | 配对 e2e(模拟客户端,真机归 6.4);过期/重用/SAS 不符拒 |
| 2.4 | 撤销:authEpoch 递增+断活跃 WS+作废未消费 presentation+panic revoke+竞态事务校验;**设备管理页 UI**(Codex C14) | 撤销即时+断连+竞态一致反例 |
| 2.5 | daemon 生产写 API 面从零建:配对/SAS/撤销/S2 决定/draft 转正/ack 写端点+幂等+native bridge allowlist(全部调 Gate 0 总闸) | 写端点鉴权+Gate 拒绝 e2e |
| 2.6 | WebView 凭据隔离(按 2.0 协议):只读 view model+native bridge+console 移动探测 | WebView 直调写 API 拒 |

---

## Phase 3 · VoiceHub phone role + 媒体 + A2 live 接线(7–9 天;控制面线可并行)

| 步 | 内容 | 验收 |
|---|---|---|
| 3.1 | VoiceHub 新增 phone role(路由重写:群发→会话/设备寻址)+deviceId/sessionId/transport 绑定+单活跃音频腿仲裁+per-session 路由+帧/队列上限+背压+断线清理;pipelineMsgSchema 扩展+hello 版本策略 | 桌面+手机不互串;未绑定 asr.final 拒驱动 Brain |
| 3.2 | 媒体(按 0.5 ADR):jitter buffer+时间戳/epoch+切网恢复+上行 48k→16k/下行 24k 转换+蓝牙 HFP 路由切换重建 | 媒体 e2e 达阈值(注入通道) |
| 3.3 | 通话 EOU(pipeline 新组件):VAD/语义 EOU 免 PTT;不达标降"轻 PTT"如实告知 | 轮次切分正确;降级可用 |
| 3.4 | A2 live 接线(依赖 0.5b live SessionManager,Codex B8):**所有 asr.final 先经身份+transport+session 状态校验再调 Brain**;`shouldAcceptUtterance` 为 phone 分叉("通话 connected=窗口开")+opaque_id→挂起会话定位→rebuild | 挂断→重建上下文连续;绕过校验的桌面回归负例 |
| 3.5 | **G6 最小隐私门**(Codex B11,真实语音前):同意检查+输入 redactor+默认不落盘/fixture-only(完整保留期+反例 Phase 7) | 首次真实语音前 G6 最小门绿 |

---

## Phase 4 · APNs + 通话投递表 + 来电状态机(4–5 天;控制面线,并行 Phase 3)

| 步 | 内容 | 验收 |
|---|---|---|
| 4.1 | APNs 客户端(JWT ES256,voip type,topic=.voip)+p8 受控保管+sandbox/production 隔离(apns_environment)+原始 token 受控保管(digest 仅去重)+轮换/失效清理 | 发 VoIP push 到真机(sandbox,收端复用 spike 工程);环境切换正确 |
| 4.2 | voip_call_attempts/notification_deliveries+来电状态机(ringing→reported→answered→connected→ended/missed/auth_failed)+幂等 key+同 callback 单活跃 callUuid | 状态转换测试;重复 push 幂等反例 |
| 4.3 | C4 融合(接 0.5a):outbox 命中 voip_call→发起来电;notified 无应答超时→requeued(missed) 新转换;ack/snooze 只作用该 callback | 无应答→missed→补 ntfy;拒接→ack-later 反例 |
| 4.4 | daemon 侧连接支撑:voip_connect_timeout_sec 超时降级 ntfy+endedReason+断线中间态+sessionEpoch(手机侧预热与睡眠后来电实测归 Phase 6) | 超时降级反例;中间态 |
| 4.5 | 通话中新事件仲裁(V7):新高 urgency 事件经仲裁并入播报队列+不触发第二通+挂断后回归升级链 | V7 前半注入测试 |

---

## Phase 5 · daemon 编排/协议:呼出呼入全链 + S2 门控(5–6 天;注入测试层,真机验收在 Phase 8,Codex A2)

| 步 | 内容 | 验收(注入/daemon 层,不含真机) |
|---|---|---|
| 5.1 | 呼出编排:blocked→push→(CallKit 由 Phase 6 实现)→认证握手协议→opaque_id 拉上下文→重建会话→Brain 播报;去敏摘要(锁屏)vs 完整汇报(解锁)分档 | 注入测试:锁屏只播去敏摘要反例 |
| 5.2 | 呼入编排:认证 WS→重建/新建会话→对话;新任务口述进 draft(持久化+transport/taint)→桌面二次确认转正 | 呼入注入 e2e;draft taint 反例 |
| 5.3 | S2 门控**协议侧**:收据签名验证逻辑(验签+nonce 单次+device active+authEpoch)+语音应答不消费+voip_receipt_timeout_sec 超时转 blocked(**SE 签名产生在 Phase 6 原生层**;此处验 daemon 验签与拒绝路径) | 注入:伪造/缺签名/过期 nonce 拒;锁屏语音"批准"不消费反例 |
| 5.4 | steer 后端能力降级(A14):握手读 capability;Claude live-steer/Cursor cancel-resume/Hopper 播"到验收点或取消重来" | 三后端 steer 话术分支 |

---

## Phase 6 · iOS 原生实现(真机,7–11 天,最长不确定项;出口 owner 场次⑤)

| 步 | 内容 | 验收 |
|---|---|---|
| 6.1a | PushKit 注册+report 时序 | 真机唤醒 |
| 6.1b | CallKit(评估 @capgo 插件,0.5 天时间盒,不可用转自写+工期重估)+includesCallsInRecents=false+锁屏仅显示"SayDo" | 真机锁屏来电、不入最近通话 |
| 6.1c | AVAudioSession(didActivate 配 AEC)+蓝牙路由 | 真机音频通 |
| 6.2 | 媒体桥(最难 3–5 天):按 ADR 实现+jitter buffer+采样率转换+路由切换重建 | 真机通话达阈值 |
| 6.3 | Secure Enclave 签名+native bridge(白名单写动作+LAContext 生物识别)+Keychain 卫生(AfterFirstUnlock 且不 iCloud 同步) | 真机 S2 生物识别签名消费 |
| 6.4 | 配对含预请求麦克风权限;deep link→tailnet URL;WebView 加载 console;响铃期预热+睡眠后来电真机实测 | 真机配对全流程+睡眠后接通 ≤ 阈值 |

**出口 [owner 场次⑤]**:owner 真机接听+配对体感。

---

## Phase 7 · 熔断 + 话术 golden + 安全反例(2–3 天;可并行 Phase 6)

7.1 成本/时长/并发熔断(A17,入全链成本账本)· 7.2 话术八条 golden+呼出脚本纪律 · 7.3 **V5 十四条负例逐条实现断言+证据**(按 1.3 冻结清单)· 7.4 输入侧脱敏完整版+通话音频/转写分别同意开关+保留期清理+真实 token/验证码输入不入库反例。

---

## Phase 8 · 真机全链 E2E + readback + owner 验收(3–4 天)

| 步 | 内容 | 验收 |
|---|---|---|
| 8.1 | **真机全链 V1–V8**(CallKit 全链、SE 签名 S2 在此汇合验收,Codex A2):方案 §8 八场景 | **V1–V8 全绿(强制,无 skip;任何 skip/deferred 须 Phase 0 前回写范围+owner 拍板,Codex B10)** |
| 8.2 | 全量 readback+两提交法 evidence+**Gate 0 addendum 四类证据逐类绑 test_id**(G5 贯通 join)+**A/V→Phase→test_id→command→fixture→expected→artifact 追踪矩阵**(Codex B10) | readback+矩阵齐 |
| 8.3 | 攒批 Codex 复核实现与设计一致性 | A 级清零 |
| 8.4 | **owner 真机验收(场次⑥)**:V1 全生命周期+V2 S2 门控 | owner 确认 |

**交付点**:8.1 V1–V8 全绿 + 8.2 readback + 8.4 owner 场次⑥。

---

## 风险预案(承接方案 §6)

R1(CallKit 中国区):spike 不实显→LiveCommunicationKit→push+App 内 UI→止损;**接受替代形态必先回写独立验收档(Codex A4)**。R5(插件):6.1b 0.5 天时间盒→自写+重估。R6(签名有效期):直装 1 年/TestFlight 90 天,到期提醒入 preflight/owner 运维。R3/R4/R7 已在 Phase 0 阈值+4.4/6.4 承接。

## 门禁与纪律

lint+typecheck+单测+契约测试绿;涉 canonical 先回写走轻量评审;每 Phase 末 code-review subagent(A 级必修);两提交法(feat→evidence,SHA 不自指);evidence 六段+§12 对照;验收全部机械可判定(test_id/command/fixture/expected/artifact)。四道前置门 + Gate 0 运行时总闸(默认关、逐端点校验、无 bypass)+ 手机 risk≤S2 从 Phase 1 存在。V1–V8 强制绿。

## owner 拍板(已全部完成 2026-07-25;明细见 `phone-call-owner-decisions-2026-07.md`)

1. 阈值表[已定,见 Phase -1];2. Gate 0 addendum[批准];3. 媒体[倾向 A,spike 定];4. CallKit 降级[停下重拍];5. S3 手机承载[维持不做]/`voip_call_for_review`[false];6. 国内 DERP[预置]/Android[P2];7. Phase 0.5 债务[按边界拆,场次②债务归还场次②]。
**唯一运行期决策 = 媒体 A/B 由 Phase 0 spike 数据最终敲定**(其余已冻结)。
