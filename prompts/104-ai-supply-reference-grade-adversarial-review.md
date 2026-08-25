# AI 供给参考实现级最终对抗评审

你是零上下文、只读、对抗性架构评审者。不要修改任何文件，不要相信文档中的历史 PASS，也不要因为方案很长而降低举证标准。

仓库：`<repo>`

唯一待评对象：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

评审前必须亲自计算 SHA-256；期望值为 `7fb98df5defe9f96dcc917067f645e4e7c1cac0148691c0e9f0633a5f964884c`。不一致则只报告输入漂移并停止。可读取当前代码、canonical、CI/release workflow 与方案引用的上游官方资料，但不得写文件或执行会改变状态的命令。

用户目标：一次完整实施后，常见 CLI、API、订阅、本地部署、官方和三方 gateway 都能以自动探测或极少步骤接入；主动配置与被动提示对非技术用户友好；架构、性能、稳定性、代码质量和开源扩展机制达到可被同行借鉴的水平。

请从“严格照方案实现后仍会失败”的角度攻击，至少覆盖：

1. 当前支持现状的事实结论，尤其智谱、Kimi、OpenCode，以及自定义 Base URL 对 OpenAI Chat/Responses 和 Anthropic Messages 的边界。
2. Inference/Execution 两平面、可保真 IR、AdaptationPlan、stream event/terminal、未知事件和能力降级是否存在丢语义或错误重试。
3. Connector SDK/TCK/包 DAG、声明式 provider pack、第三方 code plugin、宿主持有 transport/auth/secret 的扩展边界是否最小、可测试、可版本化且不让核心随 provider 数膨胀。
4. control-plane 编译、不可变 ActiveSupplySnapshot、data-plane admission/ledger/hard-stop/stream pipeline 是否既不把 catalog/DB 带入热路径，又不破坏费用、审计和撤销线性化。
5. discovery、registry/TUF 双信任域、rights/billing/data boundary、secret/SSRF、bridge 动态 route、local loopback cloud/LAN offload 是否还有安全或授权绕过。
6. 性能、背压、取消、内存、并发、plugin crash、chaos/soak SLO 是否唯一、可执行、可复现，不会因跨平台基准或阶段顺序而无法验收。
7. 中国大陆与全球 API/订阅/CLI、本地 runtime、CC Switch/OpenCode/LiteLLM/企业云的覆盖和 UX 是否真实，不靠 logo、假 key、`/models` 或消费级登录偷换“支持”。
8. public SDK 兼容政策、TCK report、SBOM/SLSA/Sigstore/OpenSSF、贡献和 sunset 流程是否足以形成可信开源生态；是否引入了不必要的复杂度或大爆炸迁移。
9. Phase 0–8 的依赖、owner 决策、门禁命令和定义完成能否机械判断；是否存在阶段先使用后定义、未来命令空壳、重复 SoT 或与当前 canonical/PLAN-2 冲突。

发现规则：

- 只报告可复现问题；每项必须含 `A/B/C`、短标题、准确 `file:line`、具体反例、现有条款为何挡不住、最小修订。
- A 级：安全/权益/付费/数据误导、不可恢复数据或账本错误、核心热路径/扩展边界根本失效、主流目标无法开箱、阶段或验收不可判定。
- B 级：不阻断正确性但会显著伤害性能、维护性、用户体验或开源采用。
- C 级：证据、术语、局部清晰度或低风险改良。
- owner 已明确保留的产品决策和 §0 开工阻断不算悬空 bug，除非方案允许施工方绕过。
- 计划中的未来命令可以尚不存在；只有阶段没有要求真实创建、红绿自测或持续门禁时才算问题。

最后给出 `PASS` 或 `FAIL`。只有无未处置 A 级才可 PASS；B/C 必须列出但不强行升为 A。结论用简体中文。
