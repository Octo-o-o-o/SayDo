# AI 供给普适接入方案架构闭包终审 v16

你是一个全新、零上下文、只读的架构终审者。不要读取`prompts/`、`research/codex-findings/`、`history/`或任何旧评审材料，不要猜测作者意图，也不要把方案尚未施工本身重复计为设计缺陷。只以当前仓库实际代码、canonical约束、必要的一手官方资料和下述冻结方案为证据。

目标文件：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结身份必须先独立核对：

- SHA-256：`8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da`
- `wc -l`：`36595`
- bytes：`2340853`

若任一不符，立即输出`FAIL`并把漂移列为A级；不得评审另一版本。不得修改目标、生产代码或canonical。只允许把最终报告写入`research/codex-findings/152-ai-supply-reference-architecture-final-closure-v16.md`。

请完整读取目标并做对抗性评审，至少覆盖：

1. 两平面、三核心推理协议、Execution、bridge与control语义是否互斥、完整且可扩展；第三方protocol core正例是否可构造，bundled/declarative是否可能包入third-party core。
2. canonical receipt payload/commit envelope、JCS、反序列化、deep-readonly、producer DAG和edge manifest是否能阻止body/id/sequence/token/CAS/epoch/anchor换挂；不得只看strict编译绿。
3. 逐constituent authority action/terminal/release、provider test account cleanup、`cleanup_verified → authority release barrier → available`顺序、`T → A → retryStart`和restart sweep是否都可构造且无摘要环、宽terminal或提前复用。
4. fallback是否只有零响应字节、零publication、零usage/tool/effect时才可自动advance；四槽evaluator proof是否精确绑定solution id/generation、四个binding/model/route/raw occurrence，并且solution constructor不能接受另一份proof。
5. Execution第三方插件是否从publisher、TUF lineage、signed manifest、provenance、artifact/open handle、用途专属consent、sandbox/permission/data/egress到注册runtime authority全链同值；跨artifact、decision、generation或distribution换挂必须失败。
6. 73行与73行exact connection oracle是否不只key双射，还逐row、逐physical operation绑定protocol、auth、path、query、framing、recipient、stream、models与fallback identity；重点核对TokenHub、Gemini、Vertex、Bedrock、Kimi和custom。
7. live qualification是否按真实dependency class派生，remote provider/upstream、local product、platform control及custom N/A边界准确；两cycle证据、lease、cursor和raw occurrence是否机械不相交且每轮资产释放或quarantine。
8. remote witness是否要求同一distribution下global、中国大陆、enterprise三realm各自独立operator、endpoint、IaC、data boundary、bootstrap、threshold、qualification、service与release；owner扩展是否只有raw输入并经过同等级semantic、journey/live/funding/platform/locale/a11y/mutation资格。
9. legacy JSON/SQLite五态是否对shadow、reconcile、repair、dual write、permit、cutover、rollback、downgrade、cleanup和quarantine resolution都有state-specific lease/intent/terminal/recovery/single-successor；逐kill-point公平重试是否最终到`sqlite_only`。
10. rights blocked和其余user-required/terminal状态是否携带直接可执行typed destination，automatic严格零主动作；reducer是否按状态接收typed domain event而非任意receipt或字符串查找。
11. 全部TypeScript合同能否零stub严格编译；required-`never`、readonly、正向构造性、可执行编译器receipt与mutation corpus是否避免“声明了布尔值就算证明”；source、instantiation、RSS和wall预算是否有足够扩展余量。
12. Phase 0–8及1A、owner决策、canonical回写、发布声明、四类生成物和Definition Complete是否可判定，是否仍会边施工边定义完成。

主动构造最小反例并实际运行只读检查。尤其尝试：candidate body swap、普通JSON恢复品牌、provider cleanup残留却成功、pending terminal自引用、cleanup后直接re-lease、首SSE token后fallback、third-party core为`never`或伪装bundled、无关Execution decision/artifact、funding cross-swap、remote N/A、cycle证据复用、row wire/auth swap、Vertex `global-aiplatform`、TokenHub models用`x-api-key`、Kimi冒充其他客户端、跨distribution/realm witness、owner自填派生事实、evaluator proof跨solution、dual-write每个崩溃边界、rights字符串动作。不要因为文档很长而降低标准。

严重级别：A为安全、权益、费用、数据丢失、协议错误、不可构造/不可发布、机器门可绕过或根本架构矛盾；B为主流路径不可用、开箱承诺失真、重大维护/性能/平台缺口或验收不可判定；C为不阻断正确实现的表达、组织或后续优化建议。

报告必须包含：冻结身份核对、实际检查方法与原始结果、逐条发现的级别/准确锚点/最小反例/根因修复/机械验收、十二项覆盖结论、A/B/C计数、最终`PASS`或`FAIL`。只有A=0且B=0才可`PASS`，不得为了给结论而降级发现。报告落盘后再次核对目标SHA、行数和字节数未漂移。
