# 86 · 交叉评审 triage(最终建议)

> 2026-08-21。输入:调度方草稿 + 四路独立评审(Codex gpt-5.6-sol max / Claude Code 2.1.220 max / 对外承诺 subagent / 本机 HANDOFF subagent)。
> 本文件只做裁决合成,不改官网、不改 HANDOFF、不部署。零 emoji。

## 四路产物

| 路 | 路径 | 总评 |
|---|---|---|
| Codex | `research/codex-findings/86-status-alignment-codex.md` | 需收窄。沙箱未读到 Tailscale/health/claude Keychain,把 H3 误判为「未登录」 |
| Claude Code | `research/codex-findings/86-status-alignment-claude.md` | 需收窄。本机快照全部独立复核成立 |
| 对外 | `research/codex-findings/86-status-alignment-product.md` | 需收窄。补首屏「数据不出你的设备」 |
| 本机 | `research/codex-findings/86-status-alignment-runtime.md` | 需收窄。补场次① failed、备份 15 天全失败 |

Prompt:`prompts/86-status-alignment-review.md`。日志:`logs/86-status-alignment-codex.log` / `logs/86-status-alignment-claude.log`。

## 分层纪律(四路一致,采纳)

对外文案对 HEAD / 访客;HANDOFF 对本机常驻。不用 7 月常驻落后去改官网;不把 HEAD 未部署批写成这台 Mac 已能用。

## 冲突裁决

| 点 | 冲突 | 终裁 |
|---|---|---|
| Claude 是否已登录 | Codex `loggedIn=false`(沙箱无 Keychain);Claude Code + 本机路 + 调度会话均为 `loggedIn=true` `subscriptionType=max` | **已登录 Max**。Codex H3 `[fail]` 不采 |
| Tailscale / `/health` | Codex 未独立复核 | 采 Claude Code + 本机路:Running / enabled / `runtimeSha=ada7981c` |
| 「不运营任何服务器」 | Codex 想整句改写;另三路要求保留 | **保留**。只收窄「不上传任何用户数据」 |
| Keychain 句 | 调度方一度想删;对外路 `[fail]` 删法 | **保留**(三端代码坐实)。浏览器 dogfood 另说,不否商店页 |
| 文档加「相对源码」 | 调度方选项;对外/Claude 裁混层 | **不加**。docs 已有 `SAYDO_MOBILE_LAN` 与 dogfood 注 |
| Win/Linux / App「内测中」 | 调度方曾建议 FAQ 向首页靠;三路对外评审要求首页向 FAQ 靠 | **首页改保守**:无包就不写内测。邮件可改「订阅进展」 |
| Silero / 实时字幕 | Codex 保留「进行中」一部分;Claude/对外降规划中 | **降规划中**(无在建批) |
| TTS live | 调度方列入待办 | **零动作**(HANDOFF §2-10 已写清) |

## 终稿三栏

### 优先对齐(本周,文案 + 档案;不 deploy、不升常驻)

1. **首页中英撤「内测中 / Closed beta」**:Win/Linux → 暂不支持、无时间表;三端 App → 开发中、未上架、无可下载包。含 `en/index.html:432` 申请按钮。FAQ 源稿保持「不承诺」。
2. **绝对隐私句**:首屏「数据不出你的设备」/`NEVER LEAVES`;privacy「不上传任何用户数据」;法律页/FAQ「只在局域网」。保留「不运营任何服务器」与 Keychain 句。privacy 改完更新生效日期。
3. **首页「拍板、审批」分面**:LAN 不能裁 S2/S3;tailnet 最多 S2;合并/删除只在电脑。
4. **docs 完成度**:实时字幕 / Silero VAD → 规划中。Claude 卡细句改为「能力实测与审批门纯函数已验证,尚未接入生产执行器」。
5. **HANDOFF / PLAN-2**:三层 SHA;场次① `failed`@ada7981;Claude 七处「已登录、下一批 5.4-b」;Tailscale 已 Running、烟测基线 ada7981 不外推 HEAD;Actions 败因=pnpm 版本键;T19×tailnet=升常驻前置门;备份自 08-07 连续 `WorkspacePolicyError`。不改 §2-10 TTS。

### 后续对齐(拍板,有顺序)

```
T19 × tailnet 合同(先定向验证 HEAD 上 tailnet 开 SPA 是否停错误卡)
  → 回写 09/11 → 才可能升常驻或开 SAYDO_MOBILE_LAN
备份 workspace_identity_changed 修复(部署门前置,可并行)
现树 just t2-pair 烟测(结论只对 ada7981)
W5.4-b 接线(独立轨)
公开仓 CI 删 pnpm Action version 键
场次重锁 SHA / 真人 / S3 / OctoBlog
```

未授权:**禁止** `just daemon deploy` 灌 HEAD;禁止 silent 把 `setup_local_only` 映射成 remote-mobile;禁止加 Cloudflare 隧道进说到。

### 保持不动

macOS / Cursor 执行器现在可用;Claude 执行器进行中(徽章);来电式 Coming soon;直达验收进行中;Keychain 句;「不运营任何服务器」;docs LAN dogfood 备注;HANDOFF §2-10 TTS。

## 若只做三件

1. 首页中英完成度口径(C1+C6+首屏绝对句)。
2. 法律页局域网 + 不上传(C2+C3),生效日同步。
3. HANDOFF/PLAN-2 事实账本(含场次① failed、备份停摆、T19 前置门)。
