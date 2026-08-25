# AI 供给普适接入 v18 最终对抗审查

对`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`做一次零上下文、target-only、read-only的最终对抗审查。禁止读取旧 prompt、旧 finding、过程日志或其他审查结论，禁止修改目标。

冻结身份：SHA-256 `c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0`，42,437行，2,672,219 bytes；仓库HEAD `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`。先核验，再完整读取。

目标是判断该方案是否已经达到可供其他开源项目借鉴的reference-grade标准：按它实施后，主流CLI/订阅、官方与三方API、自定义OpenAI/Anthropic协议、本地模型、bridge、中国大陆与全球供给都能以安全、诚实、低配置成本接入，并且未来扩展不牺牲性能、稳定性、代码质量或证据闭包。计划尚未施工不算缺陷。

请主动攻击全部关键链：canonical receipt与producer DAG、authority/secret/network/effect、Rights/Billing/DataBoundary、retry/delivery unknown/fallback、Execution、plugin、provider账号、迁移、TUF/回滚、exact oracle、73行release claim、owner扩展、四件支持产物、UX状态机、MFA/SCA、a11y、remote witness、三平台、phase BOM、性能门。运行strict TypeScript、Compiler API和最小正反例，重点寻找required-`never`、非分布式条件类型、并集推断、cross-subject/distribution换挂、宽ref、结构性自填、悬空producer和证据自引用。易变外部事实只用当前官方一手资料。

A为安全/费用/数据/状态错误、不可构造主路径、发布假阳性或根本不可实施；B为显著的稳定性、性能、扩展性、生态或UX缺口；C为非阻断改进。仅A=0且B=0可`PASS`。

最终报告直接写入`research/codex-findings/160-ai-supply-reference-grade-final-adversarial-v18.md`，包含身份、方法、反例、覆盖矩阵、A/B/C精确计数和`PASS`/`FAIL`。结束前复核目标SHA未漂移；只写报告。
