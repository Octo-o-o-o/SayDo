# AI 供给普适接入方案架构闭包终审 v14

你是一个全新、零上下文、只读的架构终审者。不要读取`prompts/`、`research/codex-findings/`、`history/`或任何旧评审材料，不要猜测作者意图，也不要把方案尚未施工本身重复计为设计缺陷。只以当前仓库实际代码、canonical约束、必要的一手官方资料和下述冻结方案为证据。

目标文件：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结身份必须先独立核对：

- SHA-256：`fcde60a8700dbfc14566d7183a30bf14d0310aa070d628173e23177dd1bda1ab`
- `wc -l`：`30490`
- bytes：`1830991`

若任一不符，立即输出`FAIL`并把漂移列为A级；不得评审另一版本。不得修改目标、生产代码或canonical。只允许把最终报告写入`research/codex-findings/146-ai-supply-reference-architecture-final-closure-v14.md`。

请完整读取目标并做对抗性评审，至少覆盖：

1. 两平面、三核心推理协议、Execution、bridge与control语义是否互斥、完整且可扩展。
2. receipt edge、deep-readonly/JCS、producer DAG、租约authority、cursor、首字节/副作用前授权、after-intent/restart恢复是否有循环、双持权、裸引用、漏终态、跨row换挂或不可构造分支。
3. 四槽solution与`review_ready`私有producer、逐slot qualification、Activation pointer、runtime/journey/distribution/evaluator proof是否能机械拒绝伪造与复用。
4. rights、credential custody/wire/challenge、funding、billing、data/compute/network、TUF repository/role/rotation是否能阻止套餐误用、unknown洗白、隐式超额、跨realm/key/route替换与local伪装。
5. 73行requirements、逐row runtime recovery、run/journey/evidence/GA投影、deterministic与live qualification是否存在宽联合、自证闭环、漏行、错误计数或不可重复账户生命周期。
6. Connector SDK、第三方Execution、detector、registry、TUF、plugin sandbox、三平台native helper、remote witness、JSON/SQLite迁移与开源贡献路径是否是可交付产品，而非只写门槛。
7. 全部TypeScript合同能否零stub独立编译，构造性、required-`never`、开放扩展、编译资源预算、热路径性能、故障隔离、可观测性、回滚和供应链门是否足够。
8. Phase 0–8及1A的依赖、owner决策、canonical回写、fail-fast orchestrator、验收资产和Definition Complete是否可判定，是否仍会边施工边定义完成。

主动构造最小反例并实际运行只读检查。尤其尝试：裸`ReceiptRef`替代语义收据、wrong registry row、wrong solution slot、unknown funding进入自动链、错误wire header、TUF跨repo/role、失败terminal伪pass、automatic状态伪按钮、旧JSON/新SQLite单边崩溃、live账号cleanup失败、合同资源超门。不要因为文档很长而降低标准。

严重级别：

- A：安全、权益、费用、数据丢失、协议错误、不可构造/不可发布、机器门可绕过或根本架构矛盾，必须冻结前修。
- B：会造成主流路径不可用、开箱承诺失真、重大维护/性能/平台缺口或验收不可判定，必须冻结前修。
- C：不阻断正确实现的表达、组织或后续优化建议。

报告必须包含：冻结身份核对、实际检查方法与结果、逐条发现的级别/准确锚点/最小反例/根因修复/机械验收、八项覆盖结论、A/B/C计数、最终`PASS`或`FAIL`。只有A=0且B=0才可`PASS`，不得为了给结论而降级发现。报告落盘后再次核对目标SHA、行数和字节数未漂移。
