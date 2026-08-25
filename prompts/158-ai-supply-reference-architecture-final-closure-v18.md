# AI 供给普适接入 v18 架构终审

你是零上下文、只读、对抗性的参考架构审查者。只审查下列冻结目标，不读取任何旧 prompt、旧 finding、过程日志或其他 agent 的结论，也不修改目标文件：

- 目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 预期 SHA-256：`c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0`
- 预期行数：42,437
- 预期 bytes：2,672,219
- 仓库 HEAD：`174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`

先独立核验身份并完整读取目标，再从根本架构、安全、可构造类型合同和可实施性角度终审。不得把“计划尚未施工”本身计为缺陷；只判断方案是否足以指导一次高质量实施并形成可机械验收的发布闭包。

必须主动构造反例并检查：

1. receipt/JCS/反序列化、private producer、deep-frozen边界、typed edge manifest、无环DAG、writer fencing、monotonic anchor、single-successor CAS、过期/撤销/重启/回滚；
2. authority inventory所有constituent、pre-intent closure、首字节、secret read、browser/process/network/effect、cleanup/reconciliation和release barrier是否逐项闭合；
3. inference、fallback、billing/ledger、delivery unknown、retry、unknown metering、Rights/DataBoundary、四槽review-ready是否存在跨subject、跨route、跨distribution或结果重标旁路；
4. Execution session/turn/request/tool/effect、plugin dispatch、provider测试账号、external identity、runtime child JSON/SQLite迁移和operation乘kill-point恢复是否完整；
5. OpenAI Chat/Responses、Anthropic Messages、Google、AWS、Azure、TokenHub、BytePlus、自定义认证、local/bridge/CLI surface的协议与认证是否由唯一真相和exact oracle驱动；
6. 73行requirements/oracle、owner append-only扩展、independent expected oracle、claim、四件支持产物、release binding、TUF和phase BOM是否具有真实mandatory producer/consumer路径；
7. accessibility、remote witness三realm、平台helper、性能环境与相对回退门是否可机械证明；
8. TypeScript基础编译是否掩盖required-`never`、非分布式`Extract`、并集推断、宽`ReceiptRef`、结构性自填或类型爆炸。必须运行必要的strict编译、Compiler API检查和最小正反例。

严重度：A为会导致越权、数据/费用/状态错误、不可构造主路径、发布假阳性或无法实施的阻断缺陷；B为会显著削弱稳定性、扩展性、性能、运维或证据质量的实质缺口；C为非阻断改进。只有A=0且B=0才可给`PASS`。

把完整报告写入`research/codex-findings/158-ai-supply-reference-architecture-final-closure-v18.md`。报告必须包含冻结身份、实际方法与命令摘要、逐项反例或证明、A/B/C精确计数和最终`PASS`或`FAIL`。写完后再次核验目标SHA未漂移；只写报告，不修改其他文件。
