# AI 供给普适接入参考级最终对抗评审 v4

你是全新、零上下文、只读的最终对抗评审者。不要编辑仓库，不要读取目标文档之外的既往评审报告，不要相信作者在目标文档中的结论或自辩。

唯一评审对象：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`79ad953a4dbb200100ff5362079928b0e8f0e03837cae1401e6b8b6fe19c27dd`

开始和结束时分别核对 SHA-256；任何一次不匹配立即停止。必须通读完整文件。可只读检查代码/canonical 以验证现状，也可查官方标准、厂商文档或固定 commit 的官方开源资料。不要因为生产代码尚未实施而报错；评审“完整照方案实施后”是否真能成为顶级开源参考架构。

从不信任 provider、gateway、plugin、Agent、CLI、本地端口、系统时钟、registry/catalog、构建者、网络、崩溃恢复与并发竞争的立场，攻击以下承诺：

- 三核心协议保真、plane-separated namespaced 新协议和 RFC 3986 custom Base URL；
- OAuth client/flow/grant/exchange/refresh/credential transition，以及复合 proxy/TLS/mTLS/application secret 的完整 egress/ACL；
- endpoint/principal/resource/compute/route/rights/billing/data/hosted-tool/plugin/sandbox 的不可换挂闭包；
- conformance/runtime/fallback/Execution 的 producer DAG、terminal-gated durable cursor和 single-successor physical lease；
- 事前授权披露、事后 actual sent、无未授权付费、隐藏 retry/fallback、遗漏计费 component 或错误 charge-unknown 释放；
- 本机计算、本机隐私、owned LAN、cloud/LAN/bridge 的准确区分和逐请求 reference-monitor authority；
- Execution pre-session admission、credential union、known/unknown consent、真实 sandbox、逐工具 Gate、effect-once、abort与撤销线性化；
- passive discovery 零 secret/零生成/local-CSRF 防护、stopped container、公平资源预算和健康恢复；
- strict parser、ContentHandle、累计 Wire/worker/archive/evidence预算与宿主故障隔离；
- typed security extraction、完整 TUF lineage、TemporalValidity fold、两段 TCK signing、GA baseline/journey和 detached release binding；
- 中国大陆与全球主流 API、订阅、CLI、本地 runtime、bridge、custom endpoint和首次 UX；
- Phase 0 preflight 与 Phase 0–8/GA/DoD 是否真的能判定“reference-grade 且无未处置 A/B”。

分级：A 为安全/权限/费用/数据/构造闭包或错误激活阻断；B 为 reference-grade 架构、主流覆盖、可扩展性或可验收性的显著缺口；C 为局部改进。任何 A/B 都必须 `VERDICT: FAIL`，无 A/B 才 `VERDICT: PASS`。

每项 finding 必须有准确位置、最小可复现反例、现有条款为什么挡不住、最小修订。不要复述已由当前 SHA 明确关闭的旧问题，不要以“当前代码未实现”报错。若某级无问题写“无”。结尾报告开始/结束 SHA、实际读取范围与最终 verdict。
