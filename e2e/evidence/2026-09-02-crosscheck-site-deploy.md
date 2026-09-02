# 月度对账 + 快速启动分发批的官网部署证据(2026-09-02)

## 性质

本批改动了 `deploy/saydo-octoooo-com/` 站点源(首页/Docs 的一条命令安装文案、新增 `install.sh` / `install.ps1`、`_headers`),因此不是同内容刷新,而是内容变更部署;`deploy/link-saydo-octoooo-com/` 本批未改动。流程照 rc.12 / 08-27 先例:preview → 锚点与脚本实测 → production → 线上域名实测。部署方式为 wrangler 4.112.0 OAuth 登录态(owner 账户,标识不入公开树)。

## preview(推 production 之前)

| 站点 | 分支 | commit | 部署 URL |
|---|---|---|---|
| saydo | preview-crosscheck-20260902 | d1cd29c | https://d4c7f25c.saydo-3xb.pages.dev |

preview 实测(2026-09-02):

| 检查 | 结果 |
|---|---|
| `/`、`/en/`、`/docs/`、`/en/docs/` | 均 200(`text/html; charset=utf-8`) |
| `/install.sh`、`/install.ps1` | 均 200,`text/plain; charset=utf-8`;线上 bytes SHA-256 与仓内文件全等(`547ec522…` / `17e2af01…`) |
| 可用性 marker | 中文首页 `v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release` 1 处;英文首页 `immutable v0.1.0-rc.12 GitHub Release` 1 处 |
| 新入口 | 中文首页 `install.sh \| sh` 1 处;中文 Docs `install.ps1 \| iex` 1 处;英文 Docs `Fastest` 1 处 |
| 端到端 | macOS:`curl -fsSL <preview>/install.sh \| sh`(隔离 SAYDO_HOME、不改 PATH)安装全绿;Windows:`irm <preview>/install.ps1 \| iex` 安装全绿(该时刻 GitHub 不可达,脚本自动回退 `dl.saydo.octoooo.com` 镜像) |

## production(2026-09-02,绑定最终候选 `560f5ff`)

部署顺序调整说明:本批把 production 部署放在公开快照推送**之前**(绑定的 commit 即随后 ff 进 main 并推送的同一 SHA),以便部署证据与 journal 追补能进入同一次收口提交;公开 CI 结论另记于 journal R127 追补二。

| 站点 | 阶段 | 分支 | commit | deployment id | 部署 URL |
|---|---|---|---|---|---|
| saydo | production | main | 560f5ff | 647fa1c8-9b73-429b-9a89-7a51c6438248 | https://647fa1c8.saydo-3xb.pages.dev |
| saydo-link | production(内容未变,同 commit 重绑) | main | 560f5ff | 2e973545-4fa0-47f4-a535-a9527ba3c658 | https://2e973545.saydo-link.pages.dev |

元数据回读(`wrangler pages deployment list`):saydo 上一 Production = 9ac98a6b/`49c1d1f`(08-27);saydo-link 上一 Production = 21145c4e/`49c1d1f`。

## 线上实测(https://saydo.octoooo.com,production 后约 20 s)

| 检查 | 结果 |
|---|---|
| `/`、`/en/`、`/docs/`、`/en/docs/` | 均 200(`text/html; charset=utf-8`;47098 / 48374 / 130011 / 151900 bytes) |
| `/install.sh`、`/install.ps1` | 200,`text/plain; charset=utf-8`,9627 / 10785 bytes;线上 bytes 与仓内 `560f5ff` 文件 SHA-256 全等 |
| 可用性 marker | 中文首页 `v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release` 1 处;英文首页 `immutable v0.1.0-rc.12 GitHub Release` 1 处(`test-release-provenance.mjs` 的线上 marker 保持可命中) |
| 新入口 | 中文首页 `install.sh \| sh` 1 处;英文首页 `install.ps1 \| iex` 1 处;中文 Docs 提到镜像 `dl.saydo.octoooo.com` 1 处;英文 Docs `Fastest` 1 处 |
| `https://link.saydo.octoooo.com/` | 200 |
| 镜像 `https://dl.saydo.octoooo.com/releases/v0.1.0-rc.12/saydo-cli-0.1.0-rc.12.tgz` | 200,1208303 bytes(与 Release 资产同字节) |
| 端到端 · macOS | `curl -fsSL https://saydo.octoooo.com/install.sh \| sh`(临时 HOME、不改 PATH):本机 Node 22 → GitHub 下载 → SHA-256 通过 → 安装 → `saydo status` exit 1(端口空闲) |
| 端到端 · Windows | `irm https://saydo.octoooo.com/install.ps1 \| iex`(隔离 `SAYDO_INSTALL_ROOT`、不改 PATH):本机 Node 22 → GitHub 超时 → **自动回退官网镜像** → SHA-256 通过 → 安装 → `saydo.cmd status` exit 1;测试目录与测试脚本随后已从该主机清理 |
