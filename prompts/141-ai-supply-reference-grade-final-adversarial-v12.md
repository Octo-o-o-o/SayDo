# SayDo AI Supply 参考实现级最终对抗复核 v12

只读、target-only复核以下文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

先验证其准确为25,018行、1,513,595 bytes、SHA-256 `7ffadde7837eeab3332431a67437aff2a65595cc1e9cda8c88c69a2e970e8d09`；不一致只报告输入漂移并停止。不得读取仓库里的其他prompt、findings、history、journal、日志或实现者说明。必须连续读取完整目标，不得抽样。

以“这将成为别人借鉴的顶级开源参考实现规范”为门槛做最终对抗审计。尝试构造能通过文中类型、Zod、CAS、状态机、TCK、release gate或UX gate但违反真实意图的最小反例。覆盖架构边界、authority/producer DAG、费用权益数据、fallback四槽、capability/evaluator、Execution与side effect、discovery、OAuth/workload/custom auth、registry/plugin/TUF/release、remote witness、公平和资源预算、61行中国/全球/本地/订阅/API/bridge/custom生态、真实账户旅程、自动探测、主动/被动UX、可访问性、性能稳定性和Phase/DoD一致性。

特别检查本轮高风险闭包：

- 所有结构持权声明是否被AST穷举，inventory非空且每个authority在abort/expiry/restart/after-intent路径恰好关闭一次；
- descriptor→final lease→envelope→bundle→intent是否真正无环，Gate allow/deny/not-invoked和effect committed/not-committed/unknown是否都有唯一可构造终态；
- unknown funding是否仍能进入任何自动推荐、evaluator、fallback或后台健康链；
- Execution exact surface、reconciliation close-ready revision和manual committed result是否能被普通receipt或另一surface换挂；
- discovery三mode的semantic subject/run evidence/authority terminal是否可互借；
- 61行requirement是否都能从准确账户起点在自己的tier内到ready，custom五路径字段完整，订阅OAuth与本地执行图不混用；
- `user_primary_action/automatic`、条件式MFA、field ID、wait/copy/visibility/clock/window/route能否由同一事件总函数严格重算；
- signer-realm alias是否可能复制公平候选、service、debt或overload资格。

不要把证明布尔字段当作实现；必须检查是否有producer、类型形状、唯一前驱、原始证据和mutation能机械支撑。不要因长度、类型数量或既有自审数字而推定正确。

最终报告写到：

`research/codex-findings/141-ai-supply-reference-grade-final-adversarial-v12.md`

格式：输入完整性；A/B/C逐项finding，含精确行号/类型名、最小反例、根因、为何现有门抓不到、根因级修复；至少16项覆盖矩阵；计数；唯一结论。A为安全/费用/数据/权限/不可构造/主流最低集或发布阻断；B为参考实现级架构、性能稳定性、UX或机械验证缺口；C只作非阻断建议。只有A=0且B=0可`PASS`，否则`FAIL`。不得修改目标文档。
