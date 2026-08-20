# 场次①项目归属发布复审 38

你是最终对抗性评审者。只读审查当前工作树，不修改文件、不提交、不部署。上一轮报告为
`research/codex-findings/37-session1-project-anchor-rereview.md`，当时结论 A=2、B=3、C=1；
本轮目标是验证这些发现是否在当前静态快照中真实关闭，并寻找同类绕过。

必须逐项核验：

1. `docs/09-data-contracts.md` 已定稿为恰好一个路径字面量；重复同路径或兼容链接加真实路径
   均应 fail-closed。路径外残余必须完整匹配正向归属 allowlist，不能靠否定/任务载荷黑名单。
   验证分类器、handler、live 路由三层，并主动构造未在测试中枚举的绕过句。
2. Brain 通用归属问句必须在分句播放前按完整输出识别；跨句以及“新档/老工程/仓库”等
   同义表达在 `unasked_draft`、`asked_unresolved`、`anchored` 三态都不能原样下发。
3. VoiceHub 当前 pipeline owner 进入 `CLOSING`、socket error 或 terminate 时必须立即失效
   runtime readiness，但仍占唯一席位直到 close；其 JSON、二进制和 daemon broadcast 均
   不得在 unavailable 后穿透。
4. Python pipeline 必须以连接级 task set 覆盖 TTS、PTT 串行链中的每个 task、inline ASR、
   EOU；断线必须 cancel+await 全集并清 mic/VAD/pending/active session，旧 task 不得向旧
   websocket 发送。
5. 生产使用的 `session.project` 投递判定必须和真实 VoiceHub 测试同源；durable accept、
   投递失败、rebuild/logger 异常不得反转 revision 真值。
6. 审计 36、37 已关闭项不得回归；特别核验 `projectRevision>0`/active revision=0、
   name-only 单 span、logger 隔离、TTS worker 重连。
7. 运行只读环境允许的 typecheck、lint、聚焦测试、ruff、`git diff --check`。若因只读沙箱
   无法创建临时文件，明确记录为环境限制，不得写成代码失败；主会话会在可写环境重跑。

输出：

- 先给“可放行/仍需阻断”和 A/B/C 数量。
- 每条发现必须给 file:line、可复现输入/时序、实际后果和最小修复。
- 给审计 37 六项关闭矩阵：`[closed]`、`[partial]`、`[open]`。
- 没有 A/B 时必须明确写 `A=0、B=0`，不要为了凑数升级风格建议。
- 报告只输出到 stdout；不要自行写文件。
