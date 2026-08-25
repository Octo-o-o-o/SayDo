# 人工确认事项

自动化已经覆盖:`just ci` 双矩阵、live 桌面/窄屏/LAN 路由渲染、G1、设置页五槽、Cursor CLI `setup/test`、桌面文本 `turn.text` 烟测。截图与步骤见 [report.md](report.md)。

## 必须人做(AI 不能代跑)

1. **真麦**:开口聊点「点击说话」→ 录音 → 发送或转文字。确认 VOLC ASR/TTS、口播状态词(执行中不说「完成」)、浏览器自动播放拦截时点解锁。
2. **Touch ID / S3 过卡**:本机已注册 passkey 时走合并。夹具库无凭据,不能冒充通过。127.0.0.1 已 308 到 localhost,过卡请用 `http://localhost:47100/`。
3. **真机扫配对码**:点「与手机配对」。码里含 capability token,不要把 URL 贴到聊天或截进 Git。验 iPhone Safari;WKWebView 仍不是本轮宣称范围。
4. **writing 首篇**:生产库若仍无 writing 项目,先立篇再逐节验收。
5. **对真实仓库派活**:先看执行器 pin 与开发槽 `composer-2.5-fast`,不要用验收探针句当任务。

## 环境注意

- 本轮把 live 模型改成了 Cursor CLI grok 4.6 / composer 2.5。备份:`~/.saydo/config.toml.bak-2026-08-16-acceptance`。若要恢复旧模型,停源码进程后再换配置。
- 常驻 launchd / `~/.saydo/runtime` 仍是旧树。本验收打的是源码 `bc2ac87`,不能当发布场次锁。
- 文本烟测留下一个「未命名草稿」会话。可在控制台丢掉,不是故障。
- Playwright 25 红不必在狗粮前先修;live 已经证明对应页面能开。若要绿 e2e 套件,需要单独批去武装夹具 HOME 并对齐今天首页。

## 人怎么复测桌面烟

1. `open "http://localhost:47100/?token=$(cat ~/.saydo/.cap-token)"`
2. 设置页看五槽:对话/沉思/评估 = grok 4.6,廉价/开发 = composer 2.5
3. 开口聊随便说一句无工具请求,等 CLI 15–25 秒
4. 手机扫配对码进 LAN,确认是移动树而不是桌面向导

## 另一台设备(Git 拉下来之后)

Git 只带源码与本目录证据,不带 `~/.saydo`(token、config.toml、SQLite、常驻 runtime)。换机必须在那台机器上重新武装:

1. `git pull` 到含 `feat(console): LAN remote-mobile` 的 HEAD(短 SHA `addfd19` 及之后的 evidence 提交)。
2. 从源码起 daemon + pipeline + console;`SAYDO_MOBILE_LAN=1` 才允许扫码。不要默认常驻 `~/.saydo/runtime` 已经是这棵树。
3. 向导或手改 `~/.saydo/config.toml`:对话/沉思/评估 = `cursor_cli` / `cursor-grok-4.6-high-fast`;廉价与 `[models.dev]` = `composer-2.5-fast`。然后跑设置里的自检或 `POST /api/setup/test` `scope=plan`。Cursor CLI 须已登录且能列出这两个模型。
4. 入口用那台机器自己的 token:`http://localhost:47100/?token=$(cat ~/.saydo/.cap-token)`。不要复用本报告里的局域网地址 `<private-ip>`。
5. 先做本页「必须人做」四场;自动化走查脚本 `walkthrough.mjs` 可选用,F1 等待条件有已知缺陷,以截图和设置页为准。
