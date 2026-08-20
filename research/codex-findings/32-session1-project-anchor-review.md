# Codex 对抗审计 32：场次①项目归属闭环

审计时间：2026-07-30 22:15–23:22 +0800
审计对象：审计期间持续变化的未提交工作树；Codex 最终声明以 23:21 的稳定快照为准
结论原值：A=2，B=4，C=1

## 发现与处置

### A1 旧异步轮可回捞已失效的持久化转写

原发现：`LiveVoiceSessions.findUserTurn` 在当前 `turnId` 不匹配时回退读取
`TranscriptTurn`。若含路径的旧轮等待模型期间新轮先到，迟到工具调用仍可从磁盘捞回旧路径
并签发候选。

处置：已修。当前轮只认进程内 `EphemeralHeardTurn`，下一用户轮覆盖后旧轮立即失效，不再
回捞持久化转写；增加 deferred provider 的 A/B 轮交错回归。

### A2 确认重播在 TTS 成功前重新放行裸肯定

原发现：barge-in 后第一次答复会先 `replay()` 清失效，再尝试 TTS；若 enqueue 失败，下一次
裸肯定仍可 accept。

处置：已修。重播改成 `prepareReplay → enqueue → armReplay`；enqueue 返回 false 或抛异常时
presentation 保持 `replay_pending`，后续裸肯定仍零写入，并有行为回归。

### B1 路径词法误拒普通闭合引号并可能从 `~user/` 内部斜杠起扫

处置：已修。改为单次扫描闭合引号；普通 `"OctoBlog"` 不再当路径引号错误；显式拒绝
`~user/`，并补两类正反例。

### B2 accept 未重验已定型 type，数据库无不可变写闸

处置：已修。accept 在写事务内要求当前 type 为 `pending` 或等于候选 type，UPDATE 带条件并
检查 `changes=1`；新库 DDL 与 v15 迁移均增加非 pending type 不可变 trigger。

### B3 re-anchor 分支未在写锁内重验祖先/后代冲突

处置：已修。两条分支在分流前统一执行 overlap 重验；增加候选签发后注入后代登记的零写入
回归。

### B4 测试操作现役 `~/.saydo/projects`

处置：不成立于最终候选。Vitest setup 在加载 workspace 模块前设置独立临时
`SAYDO_HOME`，测试结束后删除；Codex 仅看到测试内调用固定 helper，未结合全局 setup 的环境
注入。最终全量 daemon 测试输出也不再出现旧 managed-root 降级告警。

### C1 主路径 fake provider 未断言完整 request

处置：已修。provider helper 现把完整 `ChatRequest` 交给脚本；主路径在返回工具调用前断言
system instruction、当前用户路径和无 path 参数的 tool manifest。

## 原始证据

- Prompt：`prompts/32-session1-project-anchor-review.md`
- 本地日志：`logs/32-session1-project-anchor-review.log`
- 日志：462 行，3,028,568 bytes
- SHA-256：`84885655540e667ac0c6b5ea602a8bc2439d827e5d179a3a4a821c308753f3fc`
- Codex 自报最终只读门禁：daemon、console `tsc --noEmit` 与 `git diff --check` exit 0；未重跑
  完整测试。

本报告保留原发现与最终 triage；修复后的静态终审另见 33。
