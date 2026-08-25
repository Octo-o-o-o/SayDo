# AI 供给普适接入 reference-grade 对抗终审 v16

你是零上下文、只读、最高强度的reference-grade终审者。完整读取且只审计`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`、当前生产代码/canonical和必要的一手官方资料。禁止读取`prompts/`、`research/codex-findings/`、`history/`及旧评审；禁止修改任何仓库文件。

首先独立核对目标SHA-256=`8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da`、行数=`36595`、bytes=`2340853`。任一不符立即A/FAIL，不得审另一版本。

目标不是摘要，而是找出“完全照此实施后仍会失败、误收费、误投secret、误用订阅、伪装本地、无法恢复、无法发布、无法扩展或让用户继续苦恼配置”的最小反例。至少覆盖：

- canonical receipt payload/commit envelope/JCS/反序列化、完整producer DAG、逐constituent authority/cursor/recovery、provider cleanup/release barrier和四槽review-ready；
- rights、credential custody/wire/challenge、funding/billing、unknown metering、TUF、proxy/network/data/compute、fallback与首字节/effect安全；
- 73行与逐physical-operation exact oracle中的中国/全球CLI、API、订阅、官方/三方网关、CC Switch/LiteLLM及本地runtime协议、auth、realm、stream、资金和权益事实；
- OpenAI Chat/Responses、Anthropic Messages、Gemini、Vertex global/regional与ADC/WIF、Azure、Bedrock unary/stream与SigV4、BigModel、Kimi User-Agent、TokenHub operation/models双认证；
- custom Base URL安全base、relative path与三协议乘四类应用认证乘none/mTLS组合；optional auth字段与positive/negative typed event全集；
- 自动发现、主动配置、被动提示、逐row recovery、graph派生UX、automatic零主动作、rights直接目标、账户起点/MFA/费用披露与可访问性；
- deterministic/live qualification、账号资产池、cleanup/reset、三平台helper/installer、三realm remote witness production closure、legacy JSON/SQLite五态及逐kill-point恢复；
- fixed与owner public support claim、四类发布产物的row/oracle/qualification/distribution闭包，Connector SDK/第三方Execution/registry开源扩展；
- strict零stub编译、readonly/required-never/正向构造性、可执行compiler与mutation receipt、资源预算、fail-fast门、供应链、Phase依赖与Definition Complete。

实际运行只读检查并构造反例。重点尝试：candidate body/id/sequence swap、cleanup残留成功或直接re-lease、pending self-cycle、first-token/effect后fallback、third-party core `never`或bundled伪装、Execution无关decision/artifact、funding cross-swap、remote live N/A与cycle复用、row wire/auth swap、TokenHub models错误认证、Vertex错误global host或WIF audience、Kimi冒充User-Agent、跨realm/distribution witness、owner自填compiled事实、evaluator proof跨solution、legacy每个半写状态、rights字符串或空目的地。不要把“尚未施工”本身计为缺陷，只计方案按原样实施仍不闭合、事实错误、不可构造或无法机械判定的地方。

A=安全、权益、费用、数据、协议、不可构造/不可发布或可绕过机器门；B=主流路径不可用、重大平台/维护/性能/体验或验收缺口；C=非阻断改进。相同根因不得重复计数，也不得降级真实阻断项。

最终输出一份完整Markdown报告，结构必须为：冻结身份与方法、结论、A发现、B发现、C发现、主流供给/协议/安全/UX/工程覆盖矩阵、A/B/C精确计数、`PASS`或`FAIL`。每条A/B必须含目标准确行号或符号、最小反例、根因级修复和机器验收。只有A=0且B=0才可PASS。输出中不要要求自行写文件；外层调用会把最终消息原样保存为报告。
