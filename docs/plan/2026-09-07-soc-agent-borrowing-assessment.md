# soc-agent 借鉴评估（SayDo）

> 对方 repo:`https://github.com/llm-net/soc-agent`（本机 `~/WorkSpace/Reference/soc-agent`）
> 对方版本:git `3d0c3237900b57a1764839df4bc58185a6bf6770`（2026-09-05, tag `2609052022-4a8e`）
> 对方 license:**MIT**（`LICENSE` 原文, Copyright (c) 2026 socagent.com）
> 本产品基线:SayDo `bcf8ea855f25b177888d9159f75e49214f3dd892`
> 既有评估:同日初稿把 5 条标成 B。本文是收紧后的终稿：那些 B 是把通用工程卫生写成了对方专属可借物。仓内此前无 soc-agent 评估。不 supersede `docs/07` D13/D15/D18，不导入 `IMPLEMENTATION-PLAN-2.md`。

## TL;DR

**没有值得借鉴的点。** soc-agent 的独特机制都长在「板上模型 API 网关」上：按 Key 选路、请求路径微元入账、未写出字节前切上游、设备 A/B 升级、从设备下发 CLI。SayDo 不是这个产品，也不该变成它。

初稿里的「升级五步合同」「AES-GCM 密封」「未定价≠0」「将来的目录只填空」「T2 的 LANOnly」全部收回。那些要么 SayDo 已经有对等物，要么是任何安装器都会写的常识，要么是尚未存在的产品面，要么正确做法是 Keychain 而不是抄 Go 密封器。

第一刀：**不借，不施工。**

裁决计数:**A×0 / B×0 / C×12**。

## 对方是什么

内网 ARM 设备上的 OpenAI/Anthropic 兼容网关 + `/ui/` 管理台。独特处是代理位置本身：它看见每一笔转发，所以能选路、能 429、能按微元入账。固件与 `soc` 引导器共用版本串；官网匿名只读，无设备登记。

## 借鉴目标（复审后）

只问：有没有 **SayDo 现在缺、且只有对方那种机制才能补上** 的能力。成功标准不是「对方有漂亮状态机」，而是「不借会在现有产品面上留下真实缺口」。结论：没有这样的缺口。

## 能力登记表

| # | 描述 | 对方位置 | 本产品现状 | 裁决 | 理由 |
|---|---|---|---|---|---|
| 1 | 固件升级：校验→备份二进制+DB→健康窗口→失败回退 | `firmware/internal/updated/updated.go:1-16,547-706` | `install.sh` 已钉版本+SHA-256。`saydo daemon deploy` 失败搬回 `-legacy-` 目录（`packages/daemon/src/launchd/cli.ts:334-358`）。配置已有 pending→`.bak`（`packages/daemon/src/config/pending.ts:1-32`） | **C** | 对方独特的是 root UDS + 迁移后看护并还原 DB。SayDo 不是板上 ELF，没有这条热路径。剩下的「换包前留备份」是常识，现有 deploy/pending 已覆盖；为尚未存在的 `saydo update` 预借合同是硬找 |
| 2 | 安装：已有配置不改；SHA-256 硬失败 | `install.sh:328-331,443-458` | 用户目录安装 + SHA-256 + GitHub/R2（`deploy/saydo-octoooo-com/install.sh:1-19,74-141`） | **C** | 重复 |
| 3 | device-key AES-256-GCM + 分类 AAD | `firmware/internal/store/seal.go:3-21,115-153` | `~/.saydo/.env` 明文 0600，白名单，value 不进日志（`packages/daemon/src/config/envFile.ts:1-17`）。CLI 登录态在 Keychain/厂商侧 | **C** | 对方自己写明 key 与 DB 同目录，一起被拿走仍可解。这不是该抄的密封。若要加强，macOS 走 Keychain，不引进 Go 密封器 |
| 4 | 微元账本、宁松勿紧、未定价不装成 0 | `firmware/internal/usage/usage.go:4-19` | 已有 `cost_entries` + 任务三熔断。`[pricing]` 缺项则 `amount=NULL`，不编数 | **C** | 「不编金额」已有。对方更好的部分是网关热路径 settle，SayDo 不代理请求，搬不过来 |
| 5 | 官方价只填未定价行 | `firmware/internal/admin/catalogsync.go:24-26` | 无目录。生产是静态五槽 `config.toml`。AI 供给方案未下沉 | **C** | 没有这个产品面。为未开工的目录预借口径是过度借鉴 |
| 6 | 未写出字节前故障切换 | `firmware/internal/gateway/proxy.go:1-17,146-211` | `allow_fallbacks=false`。D15 不引网关 | **C** | 红线。自动切上游 = 静默改计费 |
| 7 | 按 Key 的模型范围 / 开发工具闸 | `firmware/internal/gateway/keyauth.go:3-10` | 单机 cap-token（`packages/daemon/src/net/capToken.ts:1-21`） | **C** | 不是多客户端网关 |
| 8 | Cloudflare Tunnel + LAN 域名 | `firmware/internal/gateway/tunnel.go:1-21` | T2 = 系统 Tailscale（D13） | **C** | 已裁定运输面 |
| 9 | 从设备下发 `soc` / 官方 CLI | `firmware/internal/sochelper/handler.go:1-22` | 派本机已装 Claude/Cursor CLI | **C** | 不做 CLI CDN |
| 10 | 高风险写 LANOnly | `firmware/internal/admin/server.go:242,359-362` | 缺省 `127.0.0.1`；T2 过 Host/Origin/token；S3 不离本机 | **C** | 已有更强约束。把对方路由标签写成 T2 待办是硬找 |
| 11 | 官网无身份/无心跳 | `firmware/internal/officialsite/client.go:1-4` | 已是本地优先 | **C** | 重复 |
| 12 | `/login` 与 `/connect` 分轨 | `firmware/web/ui/src/features/auth/login-view.tsx:1-8` | 控制台是 cap-token，不是设备管理台 | **C** | UI 形状不同 |

## 红线

1. D15：不引 LiteLLM / 内嵌第二套路由与费用网关。
2. D18：不预测订阅额度。
3. D13：远程面是系统 Tailscale。
4. 不做设备 API 网关。
5. S3 不离开本机。
6. 对方 OTA 无代码签名。即使以后自写升级，也不要借完后声称「安全签名更新」。

## 第一刀

不借。不写升级合同，不改 `.env` 落盘，不进 PLAN-2。

## 不借清单

网关本体、升级状态机、密封器、价目目录、Tunnel、`soc` helper、登录/Connect 管理台。初稿 5 条 B 全部收回。
