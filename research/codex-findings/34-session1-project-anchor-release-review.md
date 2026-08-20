# Codex 对抗审计 34：场次①项目归属发布审查

审计时间：2026-07-31 00:04–00:34 +0800
审计对象：修复审计 33 后、尚未追加本轮处置的未提交工作树静态快照
原始结论：A=2，B=4，C=2；不建议形成发布前 commit

## 原始发现与处置

### A1 显式路径仍可能被 `resolveProject` 或重复问题错误索路

原发现：`resolveProject` 没有机械验证当前轮确实是 name-only；含明确路径、没有项目名或
多匹配时仍会播“请直接说它的本地路径”。Brain 在显式路径轮重复输出通用归属问题时，
输出闸的固定 fallback 也会再次索路。

处置：已修。daemon 对显式路径轮在进入 Brain 前先机械调用无路径参数的
`proposeProjectAnchor`；exact 已登记路径直接进入封闭确认，新路径缺 type 才继续交给
Brain。`resolveProject` 对含路径、零匹配或多匹配全部 fail-closed，不口播索路。重复问题
输出闸在当前轮已有路径时只询问类型，不再索路。新增 E2E 故意提供一个会误调
`resolveProject` 的 provider，断言 provider 调用数为 0、无索路话术、形成已有项目确认。

### A2 durable accept 后异常会被错误说成“这轮没改”

原发现：SQLite accept、`session.project` 投递和 readiness/Pack 重建处在同一个
`try/catch`；后两者异常会落入“这轮没改”话术，即数据库已改变但语音陈述相反事实。

处置：已修。提取 `acceptProjectAnchorWithFollowup`，把 durable accept、事件投递和重建
拆成三个错误域；post-commit 异常只返回 `postCommitDegraded`，仍继续尝试重建，口播承认
项目归属已经挂上。`VoiceHub.broadcast` 对单 peer send 异常隔离。新增真实 accept 后注入
投递异常回归，断言项目/workspace/session revision 已提交、重建仍被调用、结果只标
degraded。

### B1 preflight 不能证明运行中的 daemon/pipeline 使用同一状态根

原发现：preflight 从磁盘 plist 读取 `SAYDO_HOME`，不能排除 plist 已改但运行中 job 仍持有
旧环境；`install` 在 pipeline plist 缺失时仍可只安装 daemon。

处置：已修。pipeline 心跳携带 `stateRootDigest=sha256(绝对 SAYDO_HOME UTF-8)`；daemon
`/health` 与 `/readyz` 分别回显 daemon/pipeline digest，ready 只有双方 digest 相同才为
真；preflight 对账健康端点中的运行值。daemon install 缺 pipeline plist 时 fail-closed。

### B2 迟到旧轮仍可能继续调用 provider 并产出口播

处置：已修。工具环在每次 provider/tool await 后检查当前 turn；`ToolContext` 把现势闸
传入 handler，tool 内部 provider 返回后、任何草稿/候选/评估/包/audit 写入前再次检查；
旧轮立即返回空输出。`LiveDialog` 在最终记账/口播前再次检查，失效轮落审计并静默丢弃。
竞态 E2E 覆盖 provider 等待和 `createTask` 内部 provider 等待两种窗口。

### B3 通用归属问题的 enqueue 与 durable audit 存在重启窗口

处置：已修。先写 durable `reserved`，成功后才更新内存状态并尝试 TTS；enqueue 成功落
`asked`，明确失败落 `enqueue_failed`。重建按 audit `rowid` 读取末态：孤立 `reserved`
保守视作已问，只有 `enqueue_failed` 才开放重试；audit 失败不 enqueue、不误标已问。

### B4 readiness/Pack 双闸测试没有经过生产实现

处置：已修。把 `index.ts` 内联闭包提取为生产和测试共用的
`ensureProjectAnchorProducts`。真实测试使用 `assembleOnSessionStart`、`evidenceFor` 与
`compileLivePack`，只有 assessment session、checklist/evidence/dims digest 和 Pack
expected revision 全匹配后才推进双 revision CAS。

### C1 普通英文撇号会被路径扫描器误判为未闭合路径引号

处置：已修。只有引号后的首字符实际为 `/` 或 `~/` 时才进入 quoted-path 分支；
`John's Blog，路径是 ...` 新增正例。

### C2 untracked 审计报告存在 trailing whitespace

处置：已修。审计 32、33 标题元数据的四处尾随空白已移除。

## 原始证据

- Prompt：`prompts/34-session1-project-anchor-release-review.md`
- 本地日志：`logs/34-session1-project-anchor-release-review.log`
- 日志：351 行，1,030,607 bytes
- SHA-256：`3c0d378c5adeaca3cbac60fa348b8e58dc3525062304c48e8acf05723e187f38`
- Codex 独立验证：contracts、daemon、console typecheck 与 tracked `git diff --check`
  通过；只读 sandbox 内 Vitest 和 emoji 门禁因无法写临时文件未运行，未冒充通过。

本报告保留原始分级与处置。处置后的工作树须重新接受两个独立评审、下一轮 Codex 静态
终审与完整 `just ci`，通过前不形成发布前 commit。
