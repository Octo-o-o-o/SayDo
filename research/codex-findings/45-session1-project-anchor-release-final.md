# Codex 对抗性评审 45：场次①项目归属发布终验

日期：2026-07-31
评审输入：`prompts/45-session1-project-anchor-release-final.md`
评审时基线：`1a26b0786a952f8411ed008aa444208d6d6ff945`

## 结论

Codex 对该稳定工作树快照判定仍需阻断：A=0、B=1、C=0。

唯一 B 项是跨句 choice window 超出 canonical：实现除“后句以 connector 开头”外，
还接受“前句以 connector 结尾”，使
`新建项目还是？沿用旧项目。` 被误判为归属问句，进而把 provider 完整输出整体替换。

行动：删除“前句 connector 结尾”分支，只保留 canonical 允许的后句 connector 开头；
把该输入加入 false 回归集。回修后的结论见终验 46。

## 其余核验

- 恰好两个 full-match alternatives、一新一旧、成对 `要么`、`请问` 证据及指定正反例
  未发现其他偏离。
- 纯对话与工具环均保留 provider 完整 `modelText`，在截断、分句和播放前执行输出闸。
- CLOSING owner 保留席位，JSON、binary、TTS 均阻断；`/readyz` 使用 transport-aware
  readiness helper。
- 审计 37 的路径 allowlist、重复路径、pipeline 重连清理和生产 `session.project`
  投递项未见回归。

## 评审运行证据

- 日志：`logs/45-session1-project-anchor-release-final.log`
- 行数：139
- 字节数：587455
- SHA-256：`5baf9a1cb081e10aa425cd2b799013cf8a8439400c113dba6f188f0105ca14f2`
- 通过：`pnpm typecheck`、`pnpm lint`、ruff、`git diff --check`、
  `bash -n scripts/runtime-preflight.sh`，以及只读沙箱可执行的内存矩阵。
- 环境限制：Vitest 与默认 pytest 因只读沙箱无法创建临时文件而未进入测试体，不计通过；
  `just ci` 未运行。

评审期间未修改文件、未提交、未部署。
