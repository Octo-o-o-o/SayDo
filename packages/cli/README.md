# SayDo CLI

SayDo CLI 是 GitHub Release 开发预览运行包，无需克隆源码，提供 macOS、Windows 和 Linux 的 daemon 与 Web 控制台。

最快的方式是官网一条安装命令（无需预装 Node.js；脚本在用户目录内准备 Node 22 并校验包的 SHA-256）：macOS / Linux 用 `curl -fsSL https://saydo.octoooo.com/install.sh | sh`，Windows 用 `irm https://saydo.octoooo.com/install.ps1 | iex`。

已有 Node.js 22 时可直接用 npm。一次运行：

```sh
npm exec --yes --package=https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.13/saydo-cli-0.1.0-rc.13.tgz -- saydo up
```

常用安装：

```sh
npm install --global https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.13/saydo-cli-0.1.0-rc.13.tgz
saydo up
```

默认打开 `http://localhost:47100`。远程终端可加 `--no-open`；按 `Ctrl+C` 优雅停止。`saydo status` 探活，`saydo open` 打开控制台；如启动时使用自定义 `--home`、`SAYDO_HOME` 或 `--port`，这些命令须沿用同一数据目录与端口。`saydo doctor`（可加 `--json`）做只读诊断：已安装/运行版本、配置待生效、pipeline 与语音上游状态及下一步，输出不含路径与密钥。

当前包只启动 daemon 与 Web 控制台。语音 pipeline、macOS launchd 常驻服务和源码开发仍按仓库安装说明操作。Windows 与 Linux 当前以前台方式运行，不包含 Scheduled Task 或 systemd 常驻安装。

This GitHub Release developer preview package starts the SayDo daemon and Web console without a source checkout. It requires Node.js 22 and currently runs in the foreground on Windows and Linux. The optional voice pipeline and service installation are not included.

源码候选（尚未重新发布）：`saydo help` / `--help` 不依赖数据目录配置；用法错误不回显原始参数。`--no-open` 的下一步提示包含实际端口，并提醒沿用原数据目录。上述修复不追溯到已发布 rc.13。
