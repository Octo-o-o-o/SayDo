# 月度审计后官网重部署证据（2026-08-27）

## 背景与性质

月度全量审计（journal R114）收口后按 owner 指令重部署官网。本轮审计未改 `deploy/` 站点源
（审计线 7 已实测线上与仓内逐字节一致），本次部署为同内容刷新——把 Production 部署的
commit 绑定从 `80ff448`（rc.12 部署时点）推进到月审收口 `49c1d1f`，流程照 rc.12 先例完整走
preview → 锚点实测 → production → 线上域名实测。

## 部署记录（wrangler 4.112.0，OAuth 登录态（owner 账户，标识不入公开树））

| 站点 | 阶段 | 分支 | commit | 部署 URL |
|---|---|---|---|---|
| saydo | preview | preview-monthly-audit-20260827 | 49c1d1f | https://791de4bc.saydo-3xb.pages.dev |
| saydo | production | main | 49c1d1f | https://9ac98a6b.saydo-3xb.pages.dev |
| saydo-link | preview | preview-monthly-audit-20260827 | 49c1d1f | https://6cfceae5.saydo-link.pages.dev |
| saydo-link | production | main | 49c1d1f | https://21145c4e.saydo-link.pages.dev |

## 元数据回读（wrangler pages deployment list）

- saydo:      Production/main/`49c1d1f` → 9ac98a6b（本次）；上一 Production = 1f22c9cd/`80ff448`
- saydo-link: Production/main/`49c1d1f` → 21145c4e（本次）；上一 Production = eb3c9119/`80ff448`

## preview 锚点实测（推 production 之前）

| 页面 | http | rc.12 出现 | available 文案 |
|---|---|---|---|
| / | 200 | 3 | 1（「可直接使用」） |
| /en/ | 200 | 3 | 1（immutable Release … ready to use 句式） |
| /docs/ | 200 | 4 | 1 |
| /en/docs/ | 200 | 4 | 1 |

## 线上实测（https://saydo.octoooo.com，production 后）

| 页面 | http | rc.12 出现 |
|---|---|---|
| / | 200 | 3 |
| /en/ | 200 | 3 |
| /docs/ | 200 | 4 |
| /en/docs/ | 200 | 4 |

link.saydo.octoooo.com HTTP 200。锚点数字与 2026-08-26 rc.12 部署证据完全一致（内容未变的预期结果）。
