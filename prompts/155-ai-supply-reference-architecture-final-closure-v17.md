# AI 供给普适接入方案架构闭包终审 v17

你是一个全新、零上下文、只读的架构终审者。不要读取`prompts/`、`research/codex-findings/`、`history/`或任何旧评审材料，不要猜测作者意图，也不要把方案尚未施工本身重复计为设计缺陷。只以当前仓库实际代码、canonical约束、必要的一手官方资料和下述冻结方案为证据。

目标文件：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结身份必须先独立核对：

- SHA-256：`1fa73d595c2b898637e5e9b573aa01c0e2cbfe7517d45c9e9104bfe4929aec93`
- `wc -l`：`39300`
- bytes：`2494649`

若任一不符，立即输出`FAIL`并把漂移列为A级；不得评审另一版本。不得修改目标、生产代码或canonical。只允许把最终报告写入`research/codex-findings/155-ai-supply-reference-architecture-final-closure-v17.md`。

请完整读取目标并做对抗性评审，至少覆盖：

1. 两平面、三核心推理协议、Execution、bridge与control语义是否互斥、完整且可扩展；第三方protocol core正例是否可构造，bundled/declarative是否可能包入third-party core。
2. canonical receipt payload/commit envelope、JCS、反序列化、deep-readonly、producer DAG和edge manifest是否能阻止body/id/sequence/token/CAS/epoch/anchor换挂；不得只看strict编译绿。
3. compiler AST authority census是否逐一覆盖最终74个expected type name、8个lease alias、60个branch-free policy与23个判别分支；plugin artifact handle、broker IPC、runtime-child migration operation/recovery、逐terminal/release/restart sweep是否恰好形成83个constituent且无摘要环或提前复用。
4. fallback与automatic retry是否对inference、Execution physical、read-only tool、side-effect tool使用同一exact attempt闭包；`delivery_unknown`是否永远先调和，side-effect sent retry是否必须绑定同一request terminal、commit lease、idempotency与权威not-committed evidence。
5. runtime rights是否把同一product、surface、operation、use case、principal、realm贯穿ingress、PolicySubject、entitlement、funding、slot、physical attempt、fallback和Execution tool policy；restriction floor能否被动态权益放宽。
6. rights-blocked官方迁移是否精确绑定source eligibility receipt、source realm、generation、expiry与destination requirement/claim/realm/auth journey/distribution；无合格目的地时是否只能进入排除原principal/credential family的安全替代picker。
7. 静态UI registry是否完全不含session、subject、nonce、generation、expiry、domain receipt或control epoch；每次render的动态single-use capability是否绑定准确domain subject和local session，并在refresh/restart/replay/双击并发下只成功一次。
8. 73行与73行exact connection oracle是否不只key双射，还逐row、逐physical operation绑定protocol、auth、path、query、framing、recipient、stream、models与fallback identity；重点核对TokenHub、Gemini、Vertex、Bedrock、Kimi、LM Studio和custom。
9. optional-auth封闭lookup是否与canonical conditional binding union、requirement key和scheme key精确同源；none、Basic、Bearer、`x-api-key`、field tuple、challenge、endpoint/process generation及broker handle能否跨row或跨run换挂。
10. WIF、Azure VM/App Service Managed Identity和OpenRouter API-key PKCE的credential acquisition是否与最终请求认证分开，物理请求、audience、endpoint、principal、generation和expiry都可机械验证。
11. Hunyuan migration-only是否在requirement、run derivation、live mode、公开claim、picker和终态全部禁止fresh CTA；deterministic与live qualification、provider account cleanup、两cycle不相交和三平台/三realm closure是否可重复执行。
12. legacy JSON/SQLite五态、第三方Execution插件、owner扩展、支持claim四件套、Phase 0至8和1A、Definition Complete是否都可判定且不会边施工边定义完成。
13. 全部TypeScript合同能否零stub严格编译；required-`never`、readonly、正向构造性、可执行编译器receipt与mutation corpus是否避免“声明布尔值即证明”；source、instantiation、RSS和wall绝对门与相对回退门是否有真实扩展余量。

主动构造最小反例并实际运行只读检查。尤其尝试：late authority subtype、provider cleanup后直接re-lease、`delivery_unknown`直接retry/fallback、side-effect跨commit lease、cross-use-case rights、旧eligibility/generation/expiry官方迁移、静态registry夹带动态字段、旧capability重放、LM Studio Messages双credential header、WIF把IdP aud当STS audience、Azure调用tenant token endpoint、Hunyuan fresh账户笛卡尔、row wire/auth swap、跨distribution witness、owner自填派生事实、evaluator proof跨solution、dual-write每个崩溃边界。不要因为文档很长而降低标准。

严重级别：A为安全、权益、费用、数据丢失、协议错误、不可构造/不可发布、机器门可绕过或根本架构矛盾；B为主流路径不可用、开箱承诺失真、重大维护/性能/平台缺口或验收不可判定；C为不阻断正确实现的表达、组织或后续优化建议。

报告必须包含：冻结身份核对、实际检查方法与原始结果、逐条发现的级别/准确锚点/最小反例/根因修复/机械验收、十三项覆盖结论、A/B/C计数、最终`PASS`或`FAIL`。只有A=0且B=0才可`PASS`，不得为了给结论而降级发现。报告落盘后再次核对目标SHA、行数和字节数未漂移。
