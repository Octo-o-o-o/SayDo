# Codex app-server 受控原型

这是未装配进生产 daemon 的本地 stdio 实验。`packages/daemon/src/index.ts` 不加载本目录。Tier1 仍是唯一生产执行路径；`codex exec` 仅作 BYOA 模型供给，不是生产任务执行后端。PG-07 与设计 ADR-005 的生产接线继续 deferred。

官方说明:[Codex app-server](https://learn.chatgpt.com/docs/app-server)。2026-09-23 读到该接口仍是实验性的,不支持生产负载。本机生成的 JSON Schema 形状优先于文档叙述。来源是 codex-cli `0.153.3` 的 304 个 schema 文件;本目录只保留用到的字段和 `provenance.ts` 里的 sha256,不复制 schema 树。

## 已证层

离线 fixture 覆盖 JSONL 字节边界、UTF-8 切分、背压、shutdown 清理、initialize 顺序、thread/turn 归属、early terminal 与迟到 ACK、unknown 不自动重试、以及命令/文件/权限/用户输入的拒绝优先。这些不是真实模型控制成功。

## 未验层

- 2026-09-23 的真实无模型握手已通过，见[本地验收记录](../../../../../e2e/evidence/codex-as-spike-01.md)。这只证明当时固定 CLI 的 initialize/initialized；本次源码候选尚未重跑真实握手。
- 受控真实 Agent。入口默认拒绝。没有具名 model、`deny-exec-file-permissions`、次数和墙钟上限时不会 spawn。
- MCP、网络、浏览器和其它 effect 面没有实测。本原型只回答下面列出的审批请求。
- 不恢复重启前的 thread,不接管外部 thread id。`completed` 只是上游终态,不是 SayDo verify、settle 或用户验收。

## 真实无模型握手

在本 clone 根目录执行。先确认 `codex --version` 打印 `codex-cli 0.153.3`;版本不一致时脚本拒绝 spawn,不会升级。

```text
mkdir -p /tmp/saydo-codex-as-spike-20260923
pnpm --filter @saydo/daemon exec tsx src/experimental/codex-app-server/cli.ts handshake --timeout-ms 15000 --intent-log /tmp/saydo-codex-as-spike-20260923/handshake-intent.jsonl --report /tmp/saydo-codex-as-spike-20260923/handshake-report.json
```

脚本只发 `initialize` 和 `initialized`,然后关闭子进程。stdout 是脱敏 JSON,`modelExperiment` 为 false。不读 thread、账号或凭据。

## 真实实验入口

默认关闭。下面的命令在缺字段时退出码 2,不会 spawn。本批不要加 `--enabled true` 去跑它。

```text
pnpm --filter @saydo/daemon exec tsx src/experimental/codex-app-server/cli.ts experiment --intent-log /tmp/saydo-codex-as-spike-20260923/experiment-intent.jsonl
```

要真正发出 turn,必须同时给出 `--enabled true`、`--model <具名模型>`、`--effect-boundary deny-exec-file-permissions`、`--max-turns`(1 到 3)、`--wall-ms`(1000 到 120000)、`--task-id` 和 `--text`。即使如此,命令、文件和权限仍按 schema 拒绝,用户输入回答为空对象。意图日志只记关联和摘要,不记正文。未知 method 只记固定分类,不把对端提供的 method 原文写入诊断或意图日志。

## 接入生产前的最小缺口

生产 index 仍不能加载本原型。已有历史无模型握手证据，但仍缺真实 turn、审批效果、重启恢复，以及 MCP/网络/浏览器覆盖的证据。没有这些之前,不能把本目录接进后端选择器。

## 2026-09-27 审计候选

握手现在等待 `initialized` 实际写入 stdin 后才进入 ready；仅入队不算已发送。背压超时关闭会话并丢弃未写通知，迟到 drain 不能补发。定向 fixture 已覆盖成功 drain 与超时路径，尚未经过本批独立复审和完整门禁。
