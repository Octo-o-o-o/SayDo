# Codex 对抗性评审 36：场次①项目归属终审

日期：2026-07-31
评审输入：`prompts/36-session1-project-anchor-final-review.md`
评审时基线：`1a26b0786a952f8411ed008aa444208d6d6ff945`

## 结论

Codex 判定仍需阻断：A=2、B=3、C=3。两项 A 分别是“路径字面量绕过否定/比较/任务载荷”
和“`projectRevision>0` 已锚定会话仍进入归属问句/索路”。三项 B 分别是归属问句同义改写
绕过、旧 pipeline 在 `CLOSING` 窗口污染 health、pipeline 重连后旧 TTS worker 吞新连接
消息。三项 C 涉及 post-commit logger 隔离、生产同型投递测试缺口和 name-only 单 span
严格性。

本报告记录评审快照，不代表回修后的最终发布判定；回修须再经独立复审、下一轮 Codex
终审与完整 `just ci`。

## A 级发现与行动

### A1 路径语义未 fail-closed

复现：

```text
不要挂到 /Users/wangyixiao/WorkSpace/SayDo，先按新事情继续
=> explicit_path
=> 形成 adopt_workspace 候选
```

同类反例包括比较路径与“给路径加 RSS 输出”。行动：

- canonical 明确只有单一、白名单式正向归属表达可分类为 `explicit_path`；
- 分类器对否定、比较、多路径和任务载荷归为 `other`；
- `proposeProjectAnchor` 复用同一分类做 handler 二次校验；
- 增加分类、handler 与 live E2E 反例。

### A2 已锚定会话仍进入归属链

复现显示 `projectRevision=1` 但 durable asked=false 时，Brain 仍收到“尚未问过”提示，并可
播通用问句；纯项目名还会被机械预路由成索路。行动：

- 状态显式分为 `unasked_draft / asked_unresolved / anchored`；
- Brain 指令、预路由、输出闸、`resolveProject` 与 `proposeProjectAnchor` 全部消费该状态；
- `projectRevision>0` 时禁止归属问句、索路和 draft 候选；
- 增加模型故意输出问句、误调两个工具及项目名/路径输入的回归测试。

## B 级发现与行动

1. 同义归属问句：扩展语义骨架，并规定 Brain 问句永不原样下发，只能由 daemon 播锁定句。
2. 旧 pipeline 污染 health：VoiceHub 维护唯一 `currentPipelinePeer`；旧 owner 完成 close
   前拒绝替换，所有 pipeline JSON/二进制消息校验 owner 与 `OPEN`。
3. pipeline 重连 TTS worker：断线时取消并等待全部捕获旧 websocket 的 TTS/ASR/EOU
   任务，清空旧队列；新连接创建新 worker。

## C 级发现与行动

1. post-commit TTS 异常后的 `log.warn` 改为 best-effort，不再让 logger 异常逃出 durable
   commit 域；VoiceHub 入离场回调和诊断同样隔离。
2. `name_only` 只删除一次唯一 title span；重复 title 归为 payload，合法“回到项目继续”
   补回白名单。
3. accept 到真实 VoiceHub stats 的生产同型测试仍作为 C 级增强项保留；现有生产装配已真实
   消费投递统计，且 helper、VoiceHub、live wiring 三层测试分别覆盖。

## 评审运行证据

- 日志：`logs/36-session1-project-anchor-final-review.log`
- 行数：170
- 字节数：919464
- SHA-256：`d32d9a3ba237c6d4f770339ea1a09ed838b563fd3254157c7b1ab829a6fcc9c5`
- Codex 只读沙箱内通过：`pnpm typecheck`、`pnpm lint`、ruff、`git diff --check`、
  `bash -n scripts/runtime-preflight.sh`
- Codex 只读沙箱内 Vitest/pytest/emoji 因临时文件写权限受限未启动；这些结果不计通过，
  由主会话在可写环境重跑。

## 主会话回修后的聚焦证据

```text
Test Files  4 passed (4)
Tests  103 passed (103)
```

Python：

```text
11 passed in 0.07s
All checks passed!
```

daemon typecheck 与 `git diff --check` exit 0。最终发布判定仍须等待独立复审、下一轮 Codex
终审和完整 `just ci`。
