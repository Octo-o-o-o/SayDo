# v0.1.0-rc.12 官网部署证据（2026-08-26）

## 部署方式与门的差异（owner 裁决按先例走 wrangler OAuth）

`post-release-gate --deploy` 的部署子命令本就是 `wrangler pages deploy`（OAuth 登录态即可）；
其 env 凭据（CLOUDFLARE_ACCOUNT_ID/API_TOKEN）仅用于 REST 回读验证。owner 指示按先例
（此前会话即以 wrangler OAuth 直接部署）执行，REST 回读以 `wrangler pages deployment list`
（同 OAuth）替代，验证强度等价：部署元数据（Production/main/commit hash 绑定）仍有独立信道回读。
其余流程形态与门一致：preview 先行 → 验证 → production → 线上域名实测。

## 部署记录（wrangler 4.112.0，OAuth 登录态（owner 账户，标识不入公开树））

| 站点 | 阶段 | 分支 | commit | 部署 URL |
|---|---|---|---|---|
| saydo | preview | preview-v0.1.0-rc.12 | 80ff448 | https://b89abe24.saydo-3xb.pages.dev |
| saydo | production | main | 80ff448 | https://1f22c9cd.saydo-3xb.pages.dev |
| saydo-link | preview | preview-v0.1.0-rc.12 | 80ff448 | (alias preview-v0-1-0-rc-12.saydo-link.pages.dev) |
| saydo-link | production | main | 80ff448 | https://eb3c9119.saydo-link.pages.dev |

## 元数据回读（wrangler pages deployment list）

- saydo:      Production/main/`80ff448` → 1f22c9cd（本次）
- saydo-link: Production/main/`80ff448` → eb3c9119（本次）

## 线上实测（https://saydo.octoooo.com）

| 页面 | rc.12 出现 | available 文案 |
|---|---|---|
| / | 3 | 1 |
| /en/ | 3 | 1 |
| /docs/ | 4 | 2 |
| /en/docs/ | 4 | 2 |

preview URL 部署后同锚实测通过（rc.12=3 + available 文案）后才推 production。
link.saydo.octoooo.com HTTP 200。

四页全部携带「v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release 与六项 smoke 验证，可直接使用」
（英文页对应 immutable Release 句式）。
