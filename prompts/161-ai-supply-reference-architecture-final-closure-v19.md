# AI 供给普适接入 v19 架构终审

你是全新零上下文、只读、对抗性的参考架构审查者。只审查下列冻结目标，不读取任何旧 prompt、旧 finding、过程日志、journal 或其他 agent 的结论，也不修改目标文件：

- 目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 预期 SHA-256：`f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7`
- 预期行数：44,555
- 预期 bytes：2,797,930
- 仓库 HEAD：`174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`

先独立核验身份并完整读取目标，再从根本架构、安全、可构造类型合同、性能和可实施性角度终审。不得把“计划尚未施工”本身计为缺陷；只判断方案是否足以指导一次高质量实施并形成可机械验收的发布闭包。目标文件很长，不得抽样或只读摘要。

必须主动构造反例并检查：

1. v19唯一public boundary是否真实只有55个resolved ID，54个callable是否顶层直接返回deep-frozen committed receipt，19状态registry是否穷举，53个root的typed edge manifest、JCS、deserialize、opaque leaf、producer ID、DAG和runtime verifier是否同源；legacy/ambient/bare `ReceiptRef`能否旁路；
2. 76个authority source、8个纯alias、61个branch-free policy和28个判别branch是否准确形成89个lifecycle constituent；process/browser/network/secret/effect/cleanup/reconciliation/pre-intent/首字节/重启/过期/撤销/rollback和release barrier是否逐项闭合；
3. TUF root rotation、timestamp/snapshot/targets/ordered delegated roles、逐role high-water、最终target role、本次可信时间和distribution绑定是否可抗回放；
4. physical attempt准确subject、before/after-send terminal、delivery unknown、retry、funding和fallback subject/cursor/start/advance/final DAG是否存在结果重标、双终态或跨subject换挂；
5. Rights、pre-credential eligibility、Billing、Network、DataBoundary、claim下游关系、unknown metering与四槽review-ready是否存在自引用、联合推断或跨route/distribution旁路；
6. Execution session/turn/request/tool/effect、plugin consent与dispatch、provider测试账号cleanup、external identity、runtime child JSON/SQLite迁移及operation乘kill-point恢复是否完整；
7. 73行requirement与73行exact oracle、owner namespace/raw source/compiler/四子qualification、fresh与migration-only正反gate、independent expected oracle、claim与四件支持产物是否具有mandatory producer/consumer路径；
8. 32个suite递归生成的34行signed BOM，逐行passed/failed/not-run准确前驱、first-failure fold、成功/失败orchestrator和release binding是否能防漏项、重排、错前驱、失败晋升或未运行伪通过；
9. 非联合distribution、trust roots、support artifacts、platform anchor、remote observer、Codex command-backed auth、972格a11y matrix、MFA最坏路径与compile gate是否按准确主体闭合；
10. TypeScript基础编译是否掩盖required-`never`、非分布式条件、并集推断、宽ref、结构性自填、悬空producer、错误overload或类型爆炸。必须实际运行strict编译、Compiler API全量检查和最小正反例；检查5进程性能协议、绝对门与签名相对baseline的边界是否诚实。

严重度：A为会导致越权、数据/费用/状态错误、不可构造主路径、发布假阳性或无法实施的阻断缺陷；B为会显著削弱稳定性、扩展性、性能、运维或证据质量的实质缺口；C为非阻断改进。只有A=0且B=0才可给`PASS`。不要为追求finding数量把已由准确类型和producer闭合的性质重复报为缺陷；每个finding必须给出可复现反例、准确行号和最小根因修复。

把完整报告写入`research/codex-findings/161-ai-supply-reference-architecture-final-closure-v19.md`。报告必须包含冻结身份、实际方法与命令摘要、逐项反例或证明、A/B/C精确计数和最终`PASS`或`FAIL`。写完后再次核验目标SHA未漂移；只写报告，不修改其他文件。
