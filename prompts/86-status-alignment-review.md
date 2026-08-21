# 86 · 官网/文档/HANDOFF/本机三层状态对齐 · 对抗性交叉评审

你是独立评审员。只读取证。禁止:git commit / push / deploy / `just daemon deploy` / 改官网或 HANDOFF / 再起 nested codex 或 nested claude / 把 cap-token 或 `.env` 原文写入报告。

零 emoji。分级用 A/B/C。标记用 `[ok]/[warn]/[fail]`。简体中文。

## 任务

调度方有一份「状态未对齐」草稿建议。你的工作是**证伪**,不是附和。每条草稿主张必须对照真实文件或本会话真实命令,标:

- `[ok]` 主张成立,证据足够
- `[warn]` 方向对但过满/混层/受众错
- `[fail]` 主张不成立或建议会把对外承诺改错

然后给出**你自己的最终建议**(优先对齐 / 后续对齐 / 改承诺 / 保持不动),不要复述调度方的排期当结论。

## 三层时钟(先接受这个分界,再决定哪一层该改)

| 层 | 锚 | 用来诚实对谁 |
|---|---|---|
| 对外 | `deploy/saydo-octoooo-com/` 中英首页、文档、隐私、条款、FAQ | 访客与商店审核 |
| 源码 HEAD | git `088b8f0` | 克隆仓库的人「今天能装到什么」 |
| 本机狗粮 | launchd `com.saydo.daemon`;`~/.saydo/runtime`;`GET /health` 的 `runtimeSha` | 只对 owner 操作手册(HANDOFF) |

**硬纪律**:不要用本机常驻落后去改对外文案(访客不跑 owner 的 7 月树);也不要把 HEAD 上的未部署批写成「你这台 Mac 已经能用」。

## 调度方给出的本机快照(可复核,勿盲信)

调度方 2026-08-21 声称(不含秘密):

- HEAD = `088b8f0`
- `/health` `runtimeSha` = `ada7981c67ef3a07e6df0431643bb8b7661e22d4`(2026-07-31)
- `git rev-list --count ada7981c..HEAD` = 355
- launchd:`SAYDO_HOME=~/.saydo` `SAYDO_DEV=1`;**无** `SAYDO_MOBILE_LAN`
- live `config.toml`:`[models.dev] agent=cursor`;`[t2] tailnet_hosts` 两槽已填;`listen=0.0.0.0`;TTS `zh_female_jitangmei_uranus_bigtts`
- 监听 `*:47100`
- Tailscale:调度方称 BackendState=Running / Online=True / 扩展 enabled(请尽你环境所能复核;沙箱读不到则标「未独立复核」)
- `claude` CLI 2.1.220;`claude auth status` 调度方称 `loggedIn=true` `subscriptionType=max`(不要把邮箱写入报告)
- GitHub Actions 公开仓 run `32334615753` 失败原因:pnpm Action `version: 10` 与 `package.json` `packageManager=pnpm@10.33.1` 冲突(约 14s),不是「billing 未开」
- 三端商店:`docs/release/2026-08-13-store-submission-status.md` = 占坑,明确勿传 spike 包;Play 未见 12 人内测门

## 草稿主张(请逐条证伪)

### 对外承诺

C1. 首页把 Windows/Linux 标「内测中 + 发邮件」;文档 FAQ(`deploy/saydo-octoooo-com/docs/index.html` 与 `docs/site/2026-08-20-docs-page-content.fable.md`)写「暂不支持、无时间表、不承诺」。必须改到同一句。

C2. 架构图已写「局域网或远程连接」;隐私/条款/首页隐私带/FAQ 仍写「只在局域网」。Tailscale 已是产品面(文档 §13 tailnet 薄版「现在可用(需手工配)」),法律页字面已旧。

C3. 隐私「不上传任何用户数据 / 不运营任何服务器」过宽:桌面级联语音走火山;可选 ntfy。应收窄。

C4. 隐私写令牌在 Keychain/Keystore。调度方一度想删。请核:`apps/ios/SayDo/ConnectionStore.swift`、`apps/android` TokenStore。可能成立于原生壳、不成立于手机浏览器 dogfood。不要用浏览器路径否掉商店隐私。

C5. 首页架构/开始使用暗示手机可「审批」。文档说 LAN 面不能裁 S2/S3;tailnet 薄版可批 S2、合并仍拒。请核首页是否把两种远程面混成一句而夸大。

C6. 首页三端 App「内测中」vs 文档「均未提审上架」。商店现状是占坑不是 TestFlight。请判断「内测中」算不算完成度不诚实。

C7. 文档完成度「实时字幕、Silero VAD 进行中」。代码侧能量 VAD +「说完了」已在;Silero 注释留 R-C;级联识别形态仍是按住整段。请判断徽章该不该从「进行中」降为「规划中」。

C8. 文档 LAN 手机面 / Focus / 回叫升级链标「现在可用」是对 HEAD 说话。`remote-mobile-w0` 完成定义写明不部署常驻、不宣称真机狗粮。请判断对外该不该加「相对源码 / 需开 SAYDO_MOBILE_LAN」还是保持现有 dogfood 备注已够。

C9. 首页 Claude Code 卡:「能力实测与审批门已落地,接线进行中」。W54a 是 spike+纯函数,`tier1StartupVerdict` 非 cursor 启动即拒。请判断这句是否过满。

C10. 首页「来电式语音汇报 · Coming soon」(PushKit/CallKit)与 HEAD 已有的 S2 桌面+ntfy 回叫不是同一件事。不要建议改成现在可用。

### 内部档案 / 本机

H1. HANDOFF §2-12 仍写 Tailscale 扩展 waiting for user。若本机已 Running,档案过期。剩手机烟测。不要为此 `just daemon deploy`。

H2. HANDOFF 场次①仍锁 runtime `b201514`;现 `/health` 为 `ada7981`。三层 SHA 应写清。未授权不要把 HEAD 灌进 launchd。

H3. HANDOFF §2-6「下周购入 Claude」过期。CLI 已登录 Max。W5.4-a 已收口;主流程未接。PLAN-2「下一工程批 = 5.4 挂订阅」应改成 5.4-b 接线,不再挂「没买订阅」。

H4. HANDOFF §2-5 Actions「2026-08 再开」。workflow 已跑、因 pnpm 版本键冲突失败。这是工程债,不是对外承诺。

H5. live TTS 仍 jitangmei;源码缺省 tianmeiyueyue。听感归 owner,档案写清即可。

H6. HEAD 的 T19:`setup_local_only`(见 `packages/daemon/src/index.ts` 与 `SetupBootstrapBoundary.test.ts`)对 tailnet 的 `/api/setup/probe` 停错误卡;LAN 旁路码只有 `mobile_lan_route_rejected`。升常驻到 HEAD 会让已配 `[t2]` 的远程 setup 变差,除非 owner 拍板把该码纳入 remote-mobile。禁止 silent 扩合同。

### 调度方的排期草稿(可推翻)

P0 本周只改文案+HANDOFF,不动工程:

- 统一 Win/Linux 口径
- 法律页补「局域网或你自己的加密组网」
- 收窄「不上传/不运营服务器」
- 首页不要暗示 LAN 手机能做 S2/S3
- HANDOFF 清 Tailscale/Claude/SHA/Actions

P1 后续、需 owner 拍板:

- 手机 Tailscale 烟测(`just t2-pair`;URL 含令牌,报告里只写步骤名)
- 是否为狗粮升常驻并开 `SAYDO_MOBILE_LAN`(8 月完成定义曾明确不部署)
- T19 × tailnet 合同
- Claude 执行器接线(W5.4-b)
- 真人场次 / S3 Touch ID / OctoBlog(先验哪棵树)

保持不动:

- macOS 现在可用;cursor 执行器现在可用
- Claude 执行器进行中;来电式 Coming soon;直达验收进行中(合同在、真人未收口)

不要做:deploy HEAD;Cloudflare 隧道写进说到;把 cap-token 贴进任何文件。

## 必读(按需,不要通读全仓)

- `deploy/saydo-octoooo-com/index.html` 与 `en/index.html`(现状区、架构、隐私带、开始使用、FAQ)
- `deploy/saydo-octoooo-com/docs/index.html` §4.7 / §13 / §16 / FAQ Windows
- `deploy/saydo-octoooo-com/privacy/index.html` `terms/index.html` 及 en 对应页
- `docs/site/2026-08-20-docs-page-content.fable.md`(FAQ 源稿)
- `HANDOFF.md` §1 批次指针、§2-1/2-5/2-6/2-10/2-12
- `docs/plan/IMPLEMENTATION-PLAN-2.md` 文首指针与 W5.4 / remote-mobile-w0
- `packages/console/src/components/SetupBootstrapBoundary.tsx` 与 `.test.ts`
- `packages/daemon/src/tier1/validateConfig.ts` `tier1StartupVerdict`
- `pipeline/src/saydo_pipeline/vad.py` 头注释
- `docs/release/2026-08-13-store-submission-status.md` §0
- `e2e/evidence/w54a-claude-cli.md` 范围声明(不接线、不部署)
- 若可读:`~/.saydo/runtime` 是否存在 `SetupBootstrapBoundary.tsx`、`packages/daemon/src/focus`

## 产出合同

写一份完整报告到本仓指定路径(见调用方最后一行)。结构必须是:

1. 评审身份与取证范围(读了哪些文件;本机命令哪些跑了、哪些未跑)
2. 分层纪律裁决:哪几条草稿把「对外」和「本机狗粮」混层了
3. 逐条 C1–C10、H1–H6:`[ok]/[warn]/[fail]` + 证据(`文件:行号` 或命令摘录) + 一句修法
4. 你漏掉的、草稿没写的错位(若有)
5. 最终建议三栏:**优先对齐(本周)** / **后续对齐(拍板后)** / **改承诺的具体句子**(给出替换句,不要只说「改一下」) / **保持不动**
6. 总评:草稿建议整体是「可执行 / 需收窄 / 会改错」三选一;列出若只做三件事会做哪三件

A 级 = 对外自相矛盾、完成度撒谎、或建议会让法律页/商店口径变假。
B 级 = 档案过期、混层、徽章用词不准。
C 级 = 文风。
