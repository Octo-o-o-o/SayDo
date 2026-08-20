你是 SayDo 场次①聚焦返工的发布前对抗审查员。只读审查当前未提交工作树，不修改文件。

背景：真人反馈是中文 ASR 好、OctoBlog 英文稍差；首次询问项目归属合理，但用户明确输入
`~/WorkSpace/OctoBlog` 后仍重复同一问题不合理。前一轮审计 34 原判 A=2/B=4/C=2，报告在
`research/codex-findings/34-session1-project-anchor-release-review.md`，本轮声称已全部处置。

请重点验证：

1. 显式路径是否由 daemon 确定性路由，`resolveProject` 是否只接受唯一 name-only；Brain
   误调、重复问题、隐私关闭、迟到旧轮是否都不能重复索路、签发旧候选或迟到口播。
2. durable accept、`session.project` 投递、readiness/Pack 重建是否真正分错误域；
   post-commit 异常是否绝不被口播成“这轮没改”。
3. `ensureProjectAnchorProducts` 是否与生产 composition root 同源，真实 readiness
   assessment/digest 和 Pack expected revision 均验证后才推进双 revision CAS。
4. daemon/pipeline 的 `SAYDO_HOME` 是否从启动、心跳、health/readyz 到 preflight 全链对账
   实际运行根；磁盘 plist 更新是否可能制造假通过，pipeline plist 缺失是否 fail-closed。
5. 通用归属问题的 durable 顺序是否满足同 session 最多一次；barge-in replay 与
   presentation 终局清理是否仍保持原安全语义。
6. 路径解析的 quoted/unquoted、普通英文撇号、非路径引号内 slash、symlink/owner/identity/
   overlap/type immutable 是否 fail-closed。
7. canonical、测试、场次记录、审计报告是否与实现一致；测试是否误用 mock 代替生产链。

请执行安全只读检查。按 A/B/C 分级给出精确 file:line、可复现触发链和最小修复建议；明确
哪些命令真实通过、哪些没运行。最后只回答：是否可以进入发布前 commit，还是仍需阻断。
