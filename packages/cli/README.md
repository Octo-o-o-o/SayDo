# SayDo CLI

SayDo CLI 是无需克隆源码的桌面运行包，包含 daemon 与 Web 控制台，支持 macOS、Windows 和 Linux。

需要 Node.js 22。一次运行：

```sh
npm exec --yes --package=https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.7/saydo-cli-0.1.0-rc.7.tgz -- saydo up
```

常用安装：

```sh
npm install --global https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.7/saydo-cli-0.1.0-rc.7.tgz
saydo up
```

默认打开 `http://localhost:47100`。远程终端可加 `--no-open`；按 `Ctrl+C` 优雅停止。

当前包只启动 daemon 与 Web 控制台。语音 pipeline、macOS launchd 常驻服务和源码开发仍按仓库安装说明操作。Windows 与 Linux 当前以前台方式运行，不包含 Scheduled Task 或 systemd 常驻安装。

This package starts the SayDo daemon and Web console without a source checkout. It requires Node.js 22 and currently runs in the foreground on Windows and Linux. The optional voice pipeline and service installation are not included.
