# AI 供给普适接入 v19 最终对抗审查

对`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`做一次全新零上下文、target-only、read-only的最终对抗审查。禁止读取旧 prompt、旧 finding、过程日志、journal或其他审查结论，禁止修改目标。

冻结身份：SHA-256 `f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7`，44,555行，2,797,930 bytes；仓库HEAD `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`。先核验，再完整读取；不得抽样或只依赖文档自述的验证结果。

目标是判断该方案是否达到可供其他开源项目借鉴的reference-grade标准：按它实施后，主流CLI/订阅、官方与三方API、自定义OpenAI Chat/Responses与Anthropic Messages、本地模型、bridge、中国大陆与全球供给都能以安全、诚实、低配置成本接入，并且未来扩展不牺牲性能、稳定性、代码质量或证据闭包。计划尚未施工不算缺陷。

主动攻击全部关键链：v19唯一public export、deep-frozen/JCS/deserialize、53-root typed edge manifest、producer DAG；76 source/89 constituent authority、secret/network/process/effect/cleanup；TUF role/time/high-water；Rights/Billing/Network/DataBoundary/claim；physical attempt/retry/delivery unknown/fallback；Execution、plugin、provider账号、external identity、迁移；73行exact oracle、owner扩展、migration正反gate、四件支持产物；非联合distribution；Codex command auth；19 UX state；3真实locale加pseudo的972格a11y；remote witness与三平台anchor；32-suite/34-row exact-predecessor BOM、成功/失败orchestrator和release binding；5进程性能门与签名相对baseline。运行strict TypeScript、Compiler API和最小正反例，重点找required-`never`、非分布式条件、并集推断、cross-subject/distribution换挂、宽ref、结构性自填、悬空producer、错误前驱、证据自引用和类型爆炸。生态易变事实只用当前官方一手资料。

A为安全/费用/数据/状态错误、不可构造主路径、发布假阳性或根本不可实施；B为显著的稳定性、性能、扩展性、生态或UX缺口；C为非阻断改进。仅A=0且B=0可`PASS`。每个finding必须给准确行号、可复现反例和最小根因修复；不得把不同表述的同一根因重复计数。

不要尝试通过文件工具写报告；把完整报告作为最终消息返回，由外层只读执行器的`-o`原样保存到`research/codex-findings/163-ai-supply-reference-grade-final-adversarial-v19.md`。报告必须包含身份、方法、反例、覆盖矩阵、A/B/C精确计数和`PASS`/`FAIL`。结束前复核目标SHA未漂移。
