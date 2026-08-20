# 2026-08-16 全量测试验收走查计划

## 宿主与入口

- 交付单元:本机 Web 控制台 SPA,由源码 daemon 静态服务(非 Electron / 非 WKWebView)。
- 主入口:`http://localhost:47100/?token=<cap-token>`(G1 首次注入;证据与日志不写 token)。
- LAN 入口:`http://<RFC1918>:47100/?token=<cap-token>`(须 `SAYDO_MOBILE_LAN=1`,监听 `0.0.0.0`)。
- 不作为主入口:vite `47120`/`47121`(dev proxy 回归另计);Playwright 装配 daemon `47188`(隔离夹具,不是 live)。
- 本入口能证明:armed 配置下桌面壳、hash 路由渲染、G1 拒、LAN `remote-mobile` 直挂、文本 `turn.text` 经 Cursor CLI oneshot。
- 本入口不能证明:真麦 ASR/TTS、Touch ID/S3 过卡、真机 WKWebView、writing 首篇、对 OctoDesk/OctoBlog 派真实改代码任务、v0.1.0 发布 runtime(当前是源码 HEAD,非常驻 `~/.saydo/runtime`)。

## 环境

- 仓:`/Users/wangyixiao/WorkSpace/SayDo`,HEAD `bc2ac87`(evidence 提交;feat `addfd19`)。
- 模型(验收临时改 live `~/.saydo/config.toml`;备份 `.bak-2026-08-16-acceptance`):
  - dialog / thinking / evaluator = `cursor_cli` / `cursor-grok-4.6-high-fast`
  - cheap = `cursor_cli` / `composer-2.5-fast`
  - `[models.dev]` = cursor CLI `composer-2.5-fast`
- 凭证:只从 `~/.saydo/.cap-token` 读取;截图不含地址栏;配对二维码不截(码内含 token)。
- 浏览器:项目 Playwright Chromium,headless。
- 超时:页面 20s;CLI self-test 180s;文本对话 120s。

## 范围

| 范围 | 内容 |
|---|---|
| config | G1、`/health`、probe、overview、模型槽、`POST /api/setup/test scope=plan` |
| usage | 今天/看板/开口聊/设置/成本/记忆/产物/项目设置/旧版页/窄屏移动树/localhost `#/m` 重定向 |
| full | LAN `remote-mobile` Today/Things/横屏;桌面文本对话烟测(grok 4.6 oneshot) |
| diagnostic | Playwright 全套对照、vite 端口、127.0.0.1 归一、控制台错误、不截配对码 |

## 状态词

`PASS` / `FAIL` / `TIMEOUT` / `SKIP` / `BLOCKED`。每步须正向断言,不得把“没抛错”当通过。

## 产物

本目录:`report.md` / `bugs-for-engineers.md` / `manual-retest-needed.md` / `screenshots/` / `board.html`。
仓内无 `kanban.html`,用本目录 `board.html` 作最近测试板。
