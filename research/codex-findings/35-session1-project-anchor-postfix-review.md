# Codex 对抗审计 35：场次①项目归属返工复审

审计时间：2026-07-31 00:52–01:24 +0800
审计对象：审计 34 处置后、审计 35 新处置前的未提交工作树静态快照
原始结论：A=4，B=3，C=1；阻断发布前 commit

## 原始发现与处置

### A1 `resolveProject` 未机械验证唯一 name-only

原发现：实现只做项目 title 子串匹配。普通需求、否定句或 `OctoBlogger` 一类包含唯一
title 子串的文本在 Brain 误调工具时也会被改写成索要本地路径。

处置：已修，待最终复审。新增 daemon 单源 `classifyProjectAnchorTurn`，分类
`explicit_path | name_only | other`；name-only 只允许项目名本身或礼貌/填充词与
“继续、接着、回到、切到、在该项目上”等归属意图。显式路径和唯一 name-only 均在进入
Brain 前机械预路由，`resolveProject` handler 复用同一分类器。否定、需求载荷、项目名
子串和多匹配全部 fail-closed。新增分类器正反例及 Brain 故意误调 E2E。

### A2 durable accept 后仍可能口播“这轮没改”

原发现：`LiveDialog` 用同一 `try` 包住 durable accept 和成功口播；成功口播或成本钩子
异常会落入“这轮没改”。`acceptProjectAnchorWithFollowup` 的诊断 `warn` 自身也可能向
外抛。

处置：已修，待最终复审。`LiveDialog` 只在 durable accept 返回前使用“没改”错误域；
获得 committed event 后，成功口播异常只记 post-commit 诊断，不再进入 pre-commit
话术。follow-up 的诊断统一走不会外抛的 `safeWarn`。新增 durable revision 已递增后
成功口播异常、delivery/rebuild/warn 同时异常的回归，均断言不反转提交事实。

### A3 `tts.say=true` 不能证明同步 enqueue 成功

原发现：`broadcast` 吞 peer `send` 异常且不返回成功数；只要预检查存在 OPEN pipeline，
`sendTtsSay` 就返回 true，未实际 enqueue 的确认仍可能 arm。反向上，成功 enqueue 后成本
钩子异常会把真成功反转成失败。

处置：已修，待最终复审。`VoiceHub.broadcast` 返回
`{attempted,succeeded,failed}`；`sendTtsSay` 只在至少一个 pipeline peer 的同步 `send`
接受 enqueue 后返回 true。console mirror、成本钩子和诊断日志均不能反转 pipeline
enqueue 结果。真实 VoiceHub 回归覆盖 pipeline send 抛错返回 false、成本钩子抛错仍返回
true；既有 live 回归继续覆盖首次 arm 与 barge-in replay 的 false/throw 分支。

### A4 未加引号路径的尾撇号会被截短

原发现：unquoted 路径把非词内 ASCII 撇号当终止符。当前缀和尾撇号目录同时存在且前缀
已登记时，会静默签发错误旧项目候选。

处置：已修，待最终复审。unquoted span 严格按 canonical 终止集扫描，引号字符只在
quoted span 起点具有包裹语义；路径内和末尾撇号都作为路径原文核验。新增前缀已登记、
尾撇号目录同时存在的回归，断言候选 canonical path 精确指向尾撇号目录。

### B1 `/readyz` 身份未绑定真实唯一 pipeline peer

原发现：`/dev/inject` 可注入 `pipeline.health`，多个 pipeline peer 可覆盖同一全局健康
快照，正确 peer 断开后仍可能保留另一 peer 与陈旧绿值。

处置：已修，待最终复审。VoiceHub 同时只接受一个已握手 pipeline；第二个以 4003
fail-closed，旧 peer 关闭后才允许替换。`injectPipelineMsg` 明确拒绝
`pipeline.health`。新 pipeline 入场通过单源 `pipelineRuntimeJoined` 清空旧状态根、健康
时间和 ASR/TTS 绿值，收到新 peer 心跳前 `/readyz` 必为 false。新增重复连接、关闭后替换、
伪造 health 和健康快照清空回归。

### B2 通用归属问题的 durable 最多一次可被模型改写绕过

原发现：输出识别器只认接近锁定原句的文本，同义改写可直接口播且不进入
`reserved → asked|enqueue_failed`。

处置：已修，待最终复审。仍未归属 draft 的 `other` 首轮由 daemon 直接签发锁定句并执行
durable 状态迁移，不再等待 Brain 自由改写；输出闸继续按“新事情/新任务 + 继续/接着 +
项目”的语义骨架拦截意外改写。测试断言首轮零 provider 调用、第二轮模型同义重复被替换，
且全场锁定句仅一次。

### B3 `session.project` 生产投递失败不会标 degraded

原发现：生产 `sendSessionProject` 返回 void 且吞 send 异常，helper 的 delivery catch
只能被测试 mock 触发，不能反映真实 VoiceHub。

处置：已修，待最终复审。`sendSessionProject` 返回真实 console 投递统计；生产
post-commit delivery 闭包在目标 peer 投递失败时抛给独立 degraded 错误域，durable event
仍由 console 重连回放。真实 VoiceHub 测试注入 console send 异常并断言
`attempted=1,succeeded=0,failed=1`。

### C1 审计、journal 与场次档案提前宣称关闭

处置：本报告保留审计 35 的原始阻断结论；R63 与场次①档案将在最终复审和全量 CI 后统一
更新，不再用审计 34 的中途结论代表最终快照。

## 原始证据

- Prompt：`prompts/35-session1-project-anchor-postfix-review.md`
- 本地日志：`logs/35-session1-project-anchor-postfix-review.log`
- 日志：290 行，1,452,401 bytes
- SHA-256：`9d86e37e932a2b2d9f3146da807811f8a56ee5b5193ddc90ffe20fb4f9da9dff`
- 审计 35 的只读 sandbox 内：typecheck、lint、`git diff --check`、shell syntax 和 ruff
  通过；Vitest、pytest、官方 emoji 门禁受只读临时目录限制未完整运行；runtime 47100
  不可达，preflight 未通过。以上未通过项没有冒充成功。

## 处置后中途验证

- `pnpm --filter @saydo/daemon exec vitest run test/project-anchor.test.ts
  test/live-wiring.e2e.test.ts test/runtime-identity.test.ts test/voice-hub.test.ts
  --no-file-parallelism`：4 files、94 tests 通过。
- `pnpm --filter @saydo/daemon typecheck`：通过。
- `bash scripts/check-emoji.sh`：`[ok] emoji gate: clean`。
- `git diff --check`：通过。

本报告仅记录审计 35 原始发现与返工事实。处置后的最终工作树仍须重新接受两路独立复审、
下一轮 Codex 终审与完整 `just ci`；在这些门禁完成前仍不进入发布前 commit。
