# Linux 对齐计划(T3 服务端执行端)

- **性质**:工程适配计划。决策口径以 `docs/adr/ADR-003-os-adapters.md` §10 为准,本文件只排实施。
- **动机**:03 §拓扑的 **T3「手机沟通 + 服务端执行」** 把执行端放到服务器,Linux 是该形态的唯一执行端 OS。
  若 SayDo 要以云实例形态分发(厂商预装镜像),Linux 就是**产品面**而非兼容面。
- **现状基线**:`721385c` 之后。Windows P0 批已把机制收口到 `@saydo/platform`,Linux 复用其 POSIX 分支。
- **三级词表**:[ok] 本会话实证 / [warn] 已知差距 / [fail] 未做。

## 1. 已成立(2026-08-22 实证)

| 项 | 结论 | 证据来源 |
|---|---|---|
| 全量门禁 | [ok] node + python 两 job 全绿 | GitHub Actions `ubuntu-latest`,PR #1 |
| 审批门(unix socket) | [ok] `tier1-gate-socket.test.ts` 在 Linux 跑且过(skip 条件只有 win32) | 同上 |
| birth identity | [ok] `/proc/<pid>/stat` starttime,无 procps 依赖 | `linuxBirthFromProc` |
| 进程组锚 | [ok] `/proc/<pid>/{stat,cmdline}` | `processAnchor`(本轮新增) |
| wrapper 后代回收 | [ok] 扫 `/proc` 的 pgrp;改前在最小镜像**逃逸**,改后可回收 | docker `node:22-slim` 实测 |
| 音频设备 | [ok] **不需要**:pipeline 经 `/ws/voice` 收帧,ASR/TTS 走云 API | `hub_client.py` |
| GPU | [ok] 不需要(同上) | — |

## 2. 待办(按对 T3 的阻断程度)

### P0-1 常驻:systemd user unit

`launchd/cli.ts` 的 install/uninstall/start/stop/restart/status/logs/deploy 全部绑 `launchctl` +
`~/Library/LaunchAgents`。Linux 需对等实现,建议按 `plist.ts` 的形状新增 `systemd/unit.ts`:

- 单元文件写 `~/.config/systemd/user/saydo-daemon.service` 与 `saydo-pipeline.service`。
- `systemctl --user daemon-reload / enable --now / stop / status / journalctl --user -u`。
- **必须 `loginctl enable-linger <user>`**,否则 SSH 断开即被杀,云主机场景直接失效。
- `Restart=on-failure` + `RestartSec`;`WorkingDirectory` 指 runtime 树(与 macOS C2 分离口径一致)。
- 无 systemd 的发行版/容器:fail-closed 报明确指引,**不得**用 nohup/screen/`&` 冒充常驻。

验收:`saydo daemon install` 在 Ubuntu LTS 上装成、重启主机后自起、`status` 如实反映状态。

### P0-2 部署前置依赖声明与自检

最小镜像(`node:22-slim`)实测缺 `git`/`jq`/`curl`/`ps`/`pgrep`。其中 `git` 是硬依赖(生产代码 14 处)。

- 增加 `saydo doctor`(或 setup 阶段自检):逐项检查并给出**该发行版的**安装命令,缺失即 fail-closed。
- 部署文档列出最小包集:`git`(必需)、`jq` + `curl`(当前 `gate.sh` 必需,见 P1-1 可消除)。

### P1-1 POSIX 审批门去 jq/curl 化

现 `gate.sh` 依赖 `jq`(25 处)+ `curl --unix-socket` + `#!/bin/bash`。Windows 已走 Node 单文件
(`gate-cursor.mjs` / `gate-claude.mjs`)。POSIX 可同构改造:Node 的 `http.request({ socketPath })`
原生支持 unix socket,`JSON.parse` 替掉 jq,于是三个外部依赖一起消失。

注意:这会改动**现网冻结的 gate 入口内容**,digest 补偿基准同步变化,需按既有漂移处置流程走一轮。
收益是最小镜像零额外依赖 + 与 Windows 同构;成本是一次冻结基准迁移。**建议与 P0-1 分批**。

### P2 降级面(云场景可接受,记录即可)

- 桌面通知:Linux 无 osascript/toast,`notifyDesktop` 返回 false → 降 ntfy。**云上这是正确行为**,不改。
- `openExternal`:`xdg-open` 在无桌面主机不存在;深链对 T3 无意义,保持失败可见即可。
- 编辑器探测:仅 darwin;T3 下编辑器在手机/本地端,不在执行端。
- 电源断言:no-op(云主机不睡眠)。

## 3. 测试环境口径

> **口径边界(2026-08-22,评审 90 A-7 后 owner 裁决)**:本节判定的是**「Linux 可升正式 SKU」**,不是官网措辞。
> owner 已解除官网侧限制(官网可写「Linux 桌面服务已开放」+ 同句披露常驻/通知仍为 macOS 实现),
> 但**本节的最小镜像依赖面验证仍是升 SKU 的前置,未解除**。两者不要互相援引。

- **不得**以 `ubuntu-latest` runner 的绿判定"Linux 可用(可升 SKU)":它预装 jq/curl/git/procps,会掩盖依赖缺口。
  依赖面必须在最小镜像(`node:*-slim` / distroless)上验证。
- 常驻与 linger 只能在**真实 systemd 主机**上验(容器默认无 systemd;WSL2 需显式开 `systemd=true`)。
- 架构:云主机常见 x86_64,开发机若为 Apple Silicon 需注意原生模块(`better-sqlite3`、`koffi`)的
  prebuild 覆盖,跨架构结论不可直接互推。
