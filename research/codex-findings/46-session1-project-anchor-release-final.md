# Codex 对抗性评审 46：场次①项目归属发布终验

日期：2026-07-31
评审输入：`prompts/46-session1-project-anchor-release-final.md`
评审时基线：`1a26b0786a952f8411ed008aa444208d6d6ff945` 加当前未提交工作树

## 结论

可放行：A=0、B=0、C=0。审计 45 的唯一 B 项已关闭，审计 37 的六项均为
`[closed]`，未见回归。

## 核验摘要

- 归属问句要求恰好两个完整 alternatives，一侧 full-match 新建分支，另一侧
  full-match 续接分支；跨句只允许后句以 connector 开头。
- 动态矩阵覆盖 10 个正例与 7 个反例，失败数为 0；终验 45 的三个 connector 尾句变体
  均为 false。
- 纯对话与工具环都保留 provider 完整 `modelText`；截断后置归属问句在播放前被整体
  替换，动态探针两路均零泄漏。
- CLOSING owner 动态探针结果为 owner 仍占席、pipeline unavailable、JSON/binary/TTS
  投递均为 0；transport-aware readiness 返回 fail-closed。
- canonical、实现和回归测试一致；路径 allowlist、重复路径拒绝、Python 断线任务清账及
  生产投递 helper 未见回归。

## 评审运行证据

- 日志：`logs/46-session1-project-anchor-release-final.log`
- 行数：169
- 字节数：892540
- SHA-256：`028ce5c717b1c510ec57392442d7dddb552fd878f7f6ea93fc206fa4ede8bd43`
- 通过：`pnpm typecheck`、`pnpm lint`、ruff、`git diff --check`、
  `bash -n scripts/runtime-preflight.sh`；关闭 capture/cache 后的 pipeline 聚焦测试
  11 项通过；只读动态矩阵与等价 emoji 扫描通过。
- 环境限制：Vitest、官方 emoji 脚本和默认 pytest 因只读沙箱无法创建临时文件而未完整
  启动，不计通过；`just ci` 留给主会话在可写环境执行。

评审期间未修改文件、未提交、未部署。
