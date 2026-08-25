# AI 供给普适接入方案架构闭包终审 v15

你是一个全新、零上下文、只读的架构终审者。不要读取`prompts/`、`research/codex-findings/`、`history/`或任何旧评审材料，不要猜测作者意图，也不要把方案尚未施工本身重复计为设计缺陷。只以当前仓库实际代码、canonical约束、必要的一手官方资料和下述冻结方案为证据。

目标文件：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结身份必须先独立核对：

- SHA-256：`7fbc0a8ba767d90d84e26a49f83a357d57c5a269f1cf0c43b54c2e6a4d832967`
- `wc -l`：`33210`
- bytes：`2146263`

若任一不符，立即输出`FAIL`并把漂移列为A级；不得评审另一版本。不得修改目标、生产代码或canonical。只允许把最终报告写入`research/codex-findings/149-ai-supply-reference-architecture-final-closure-v15.md`。

请完整读取目标并做对抗性评审，至少覆盖：

1. 两平面、三核心推理协议、Execution、bridge与control语义是否互斥、完整且可扩展；CC Switch opaque proxy是否仍暗含不可取得的route/control事实。
2. receipt candidate/commit、deep-readonly/JCS、producer DAG、逐constituent authority registry、cursor、首字节/副作用前授权、after-intent/restart/recovery是否有循环、双持权、裸引用、漏终态、跨row/state换挂或不可构造分支。
3. provider test account pool的flow/principal/MFA/admin set-cover、排他lease、cleanup retry authority、quarantine、双周期baseline恢复和crash recovery是否形成可达single-successor生命周期。
4. 四槽solution与`review_ready`私有producer、逐slot positive terminal、Activation pointer、runtime/journey/distribution/evaluator proof是否同值；public support claim是否精确保留row、oracle、资格和released distribution，四类发布产物能否分叉。
5. rights、credential custody/wire/challenge、funding、billing、data/compute/network、TUF repository/role/rotation是否能阻止套餐误用、unknown洗白、隐式超额、跨realm/key/route替换与local伪装。
6. 73行requirements与73行exact connection oracle、逐row runtime recovery、deterministic/live qualification是否存在宽回落、自证闭环、漏行、错误operation/auth/path或remote `not_applicable`逃逸。
7. custom Base URL的canonical base directory、相对路径、Chat/Responses/Messages、应用认证none/Bearer/`x-api-key`/custom secret header和传输none/mTLS是否真正正交、安全可构造，且不允许字符串绕过或公开未资格组合。
8. Connector SDK、第三方Execution、三平台helper/installer、remote witness production closure、legacy JSON/SQLite迁移、fail-fast orchestrator、开源贡献与升级回滚路径是否是可交付产品，而非只写门槛。
9. 全部TypeScript合同能否零stub独立编译，构造性、required-`never`、readonly、开放扩展、编译资源预算和热路径性能是否足够；尤其检查882,412次instantiation相对900,000上限的余量是否被方案的扩展方式持续消耗。
10. Phase 0–8及1A的依赖、owner决策、canonical回写、验收资产和Definition Complete是否可判定，是否仍会边施工边定义完成。

主动构造最小反例并实际运行只读检查。尤其尝试：伪candidate或可变嵌套receipt、wrong authority constituent、cleanup pending后无可取得retry lease、wrong requirement recovery state、remote live N/A、wrong exact oracle、字符串伪造safe relative path、协议/认证交叉组合、support claim跨row/distribution换挂、platform/witness跨release换挂、raw legacy v1不可lift、第三方Execution扩大permission。不要因为文档很长而降低标准。

严重级别：A为安全、权益、费用、数据丢失、协议错误、不可构造/不可发布、机器门可绕过或根本架构矛盾；B为主流路径不可用、开箱承诺失真、重大维护/性能/平台缺口或验收不可判定；C为不阻断正确实现的表达、组织或后续优化建议。

报告必须包含：冻结身份核对、实际检查方法与原始结果、逐条发现的级别/准确锚点/最小反例/根因修复/机械验收、十项覆盖结论、A/B/C计数、最终`PASS`或`FAIL`。只有A=0且B=0才可`PASS`，不得为了给结论而降级发现。报告落盘后再次核对目标SHA、行数和字节数未漂移。
