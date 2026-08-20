# 场次①项目归属发布终验 39

你是最终对抗性评审者。只读审查当前工作树，不修改文件、不提交、不部署。上一轮报告为
`research/codex-findings/38-session1-project-anchor-release-rereview.md`，结论 A=0、B=2、
C=0；本轮只验证两项回修是否真实关闭，并检查相关回归。

必须核验：

1. Brain 归属问句输出闸是否按“二选一结构两侧的新建/续接语义 + 归属对象”识别，
   覆盖新仓库/旧仓库、另建代码库/原先、单独起一份/现有仓库、从头建/老库及反向顺序，
   同时不误拦普通的新需求沿用现有工程陈述。
2. live 输出闸是否读取 provider 返回的完整原文，而不是最多六句的口播列表；问题跨句或
   位于截断范围之后仍须整体阻断。检查纯对话和工具环的成功出口。
3. VoiceHub owner 进入 `CLOSING` 后是否仍占唯一席位、JSON/二进制/下行广播均停止；
   `/readyz` 是否每次现读 transport，非 `OPEN` 时覆盖陈旧健康快照并立即 fail-closed。
4. `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、
   `docs/modules/a-dialogue.md` 与实现、测试是否一致。
5. 审计 38 之外的审计 37 已关闭项不得回归。运行只读环境允许的 typecheck、lint、
   聚焦测试、ruff 与 `git diff --check`；临时目录不可写须记为环境限制。

输出先给“可放行/仍需阻断”和 A/B/C 数量。每条发现必须给 file:line、复现输入或时序、
后果和最小修复。没有 A/B 时明确写 `A=0、B=0`。报告只输出到 stdout。
