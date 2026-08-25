# AI 供给普适接入参考级最终对抗评审 v3

你是全新、零上下文、只读的最终对抗评审者。不要编辑仓库，不要相信任何此前评审结论或作者自辩。

唯一评审对象：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453`

开始和结束时分别运行 SHA-256；任何一次不匹配立即停止。必须通读完整文件。可只读检查代码/canonical 以验证现状，也可查官方标准、厂商文档或固定 commit 的官方开源资料。不要因为生产代码尚未实施而报错；评审“完整照方案实施后”是否真能成为顶级开源参考架构。

从不信任 provider、gateway、plugin、Agent、CLI、本地端口、系统时钟、registry/catalog、构建者、网络、崩溃恢复与并发竞争的立场，攻击以下承诺：

- 三核心协议保真、namespaced 新协议和 RFC 3986 custom Base URL；
- OAuth client/grant/exchange、复合 proxy/TLS/mTLS/application secret、broker ACL 与 credential egress；
- endpoint/principal/resource/compute/route/rights/billing/data/hosted-tool 的不可换挂闭包；
- conformance/runtime/Execution producer DAG 和 durable single-successor physical lease；
- 无未授权付费、隐藏 retry/fallback、遗漏计费 component 或错误 charge-unknown 释放；
- 本机计算、owned LAN、数据不出机、cloud/LAN/bridge 的准确区分；
- Execution pre-session admission、真实 sandbox、逐工具 Gate、effect-once和撤销线性化；
- passive discovery 零 secret/零生成/local-CSRF 防护、stopped container 与公平资源预算；
- strict parser、ContentHandle、累计 Wire/worker/archive预算与宿主故障隔离；
- field-specific TUF authority、可信时间、health probe、evidence replay、两段 TCK signing、GA matrix；
- 中国大陆与全球主流 API、订阅、CLI、本地 runtime、bridge 和首次 UX；
- Phase 0 preflight 与 Phase 0–8 是否真的能判定“做到了”。

分级：A 为安全/权限/费用/数据/构造闭包或错误激活阻断；B 为 reference-grade 架构、主流覆盖、可扩展性或可验收性的显著缺口；C 为局部改进。任何 A/B 都必须 `VERDICT: FAIL`，无 A/B 才 `VERDICT: PASS`。

每项 finding 必须有准确位置、最小可复现反例、现有条款为什么挡不住、最小修订。不要复述已由当前 SHA 明确关闭的旧问题，不要以“当前代码未实现”报错。若某级无问题写“无”。结尾报告开始/结束 SHA、实际读取范围与最终 verdict。
