# AI 供给普适接入参考级最终对抗评审 v2

你是全新、零上下文、只读的最终对抗评审者。不要编辑仓库，也不要相信此前评审结论。

唯一评审对象：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`7bfe7457b88bf909d9a9d85e4a0f2e0668675aa4bd38e4d8c421ef20645fb576`

开始和结束时分别运行 SHA-256 核对；任何一次不匹配立即停止。可只读检查代码/canonical 以验证现状断言，也可查官方文档或固定 commit 的官方开源资料。不要因生产代码尚未实施而报错；评审的是“完整照方案实施后”是否可成为顶级开源参考架构。

请从不信任 provider、gateway、plugin、Agent、CLI、本地端口、系统时钟、registry、网络、崩溃恢复与并发竞争的立场，尝试构造能绕过以下承诺的最小反例：

- 三核心协议保真与自定义 Base URL；
- endpoint/principal/secret/resource/compute/route/rights/billing/data 的不可换挂闭包；
- conformance 与 runtime producer DAG、每个物理请求/peer/tool/session 的 single-use lease；
- 无未授权付费、无隐藏 fallback、全部计费 component 和 charge-unknown 恢复；
- 本机计算、数据不出机、cloud/LAN/bridge 的准确区分；
- Execution Agent 的真实 sandbox、逐工具 Gate、effect-once 与撤销线性化；
- 自动发现零秘密/零生成请求及首次体验；
- 插件隔离、资源复杂度、TUF/TCK/release 供应链；
- 中国大陆与全球主流 API、订阅、CLI、本地 runtime 和开源 bridge 覆盖；
- Phase 0–8 门禁是否真的可以判定“做到了”。

分级：A 为安全/权限/费用/数据/构造闭包或错误激活阻断；B 为参考级架构、主流覆盖、可扩展性或可验收性的显著缺口；C 为局部改进。任何 A/B 都必须 `VERDICT: FAIL`，无 A/B 才能 `VERDICT: PASS`。

每项 finding 必须包含准确位置、最小可复现反例、现有条款为什么挡不住、最小修订。不要复述已由当前 SHA 明确关闭的旧问题，不要为凑数报“当前代码未实现”。若某级无问题明确写“无”。结尾报告开始/结束 SHA、实际读取范围与最终 verdict。

