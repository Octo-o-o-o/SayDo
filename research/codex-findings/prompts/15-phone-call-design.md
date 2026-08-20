# Codex 评审 prompt · 15:通话形态设计方案(v1)对抗性评审

你是 SayDo 项目的对抗性设计评审员。SayDo 是语音驱动本地 AI agent 的"幕僚长"产品,P0(桌面 Tier1 全闭环)+P0.5(Hopper 桥/直达验收/Demo)已工程收口(daemon 335 测 + contracts 65 测全绿)。现在评审的是 P1 通话形态(Phone-Call Mode)设计方案 v1。

## 评审对象

`research/phone-call-design-2026-07.md`(方案本体,必须逐节读完)

## 上下文材料(按需查阅,均在仓内)

- `research/voice-call-channel-scan-2026-07.md`(通话调研+B1–B6 建议)
- `research/saydo-improvement-scan-2026-07.md` §3.4(F1–F6 安全发现,方案吸收了 F4/F5)
- `research/mobile-desktop-connectivity.md`(连接选型定稿:Tailscale/OctoDesk 五件套/CallKit+PushKit 证据)
- `docs/02-product-definition.md` §7(部署形态)、`docs/03-architecture.md` §7/§8(移动连接/原生外壳)
- `docs/04-key-mechanisms.md` §3(会话经济学)/§4(回叫)/§5(审批 S0–S3,重点 §5.2 远程通道)
- `docs/07-tech-stack-decisions.md` D11/D12/D13(推送/移动外壳/移动连接选型)
- `docs/09-data-contracts.md`(§9 DDL、§10 VoiceHub WS 契约)
- 实施仓现状可参考(只读):/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/(voice/hub.ts、callback/、approvals/、session/)

## 评审任务(按优先级)

1. **安全正确性**:§3 认证分档/S2 解锁门控/来电信任链是否有漏洞或与 canonical 04 §5 不变量冲突?锁屏/解锁态判定(isProtectedDataAvailable + WS 会话属性)是否可被绕过?残余风险声明是否诚实完整?
2. **架构接缝真实性**:§2 声称"复用 VoiceHub WS/C4 outbox/A2 重建/capability token 扩展"——这些复用假设是否成立?PCM over WS(不用 WebRTC)在蜂窝网络下是否站得住?有无被忽略的技术依赖?
3. **过度设计/欠设计双向检查**:哪些节可以砍(说出理由)?哪些必要环节缺失(如证书管理、时区/多设备、断线中间态、审计字段)?
4. **范围裁决合理性**:§5 out 清单的每条理由是否成立?有无应 in 而 out、应 out 而 in?
5. **工作量与风险**:15–20 工程日与 R1–R6 风险表是否可信?遗漏的风险?
6. **与既有裁决的一致性**:是否违反任何已定稿决策(D11–D13、04 §5.4 模式不变量、Gate 0)?

## 输出格式

- 总判定:Go / Conditional Go(列条件) / No-Go(列理由)
- 发现清单:编号,每条【级别 A=必须修/B=应修/C=建议】【发现】【证据(文件+节)】【修法】
- ≤200 字总评
- 全部简体中文
