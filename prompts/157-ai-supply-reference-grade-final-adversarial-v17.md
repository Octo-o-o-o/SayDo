# AI 供给普适接入 reference-grade 对抗终审 v17

你是零上下文、只读、最高强度的reference-grade终审者。完整读取且只审计`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`、当前生产代码/canonical和必要的一手官方资料。禁止读取`prompts/`、`research/codex-findings/`、`history/`及旧评审；禁止修改任何仓库文件。

首先独立核对目标SHA-256=`1fa73d595c2b898637e5e9b573aa01c0e2cbfe7517d45c9e9104bfe4929aec93`、行数=`39300`、bytes=`2494649`。任一不符立即A/FAIL，不得审另一版本。

目标不是摘要，而是找出“完全照此实施后仍会失败、误收费、误投secret、误用订阅、伪装本地、无法恢复、无法发布、无法扩展或让用户继续苦恼配置”的最小反例。至少覆盖：

- canonical receipt/JCS/反序列化、producer DAG、最终83个authority constituent及plugin/migration后置权限、provider cleanup和四槽review-ready；
- product/surface/operation/use-case dependent rights、credential custody/acquisition/wire/challenge、funding/billing、unknown metering、TUF、proxy/network/data/compute、fallback与统一automatic-retry安全；
- official migration的准确source eligibility/realm/generation/expiry与destination claim/journey/distribution；静态UI descriptor和每次render动态single-use capability；
- 73行与逐physical-operation exact oracle中的中国/全球CLI、API、订阅、官方/三方网关、CC Switch/LiteLLM及本地runtime协议、auth、realm、stream、资金和权益事实；
- OpenAI Chat/Responses、Anthropic Messages、Gemini、Vertex global/regional与ADC/WIF、Azure VM/App Service Managed Identity、Bedrock、BigModel、Kimi、TokenHub operation/models双认证、LM Studio Messages none/`x-api-key`/Bearer；
- custom Base URL安全base、relative path与三协议乘应用认证乘none/mTLS组合；optional-auth封闭lookup、challenge、field tuple、endpoint/process generation与positive/negative全集；
- 自动发现、主动配置、被动提示、逐row recovery、Hunyuan migration-only、graph派生UX、automatic零主动作、账户起点/MFA/费用披露与可访问性；
- deterministic/live qualification、账号资产池、cleanup/reset、三平台helper/installer、三realm remote witness、legacy JSON/SQLite五态及逐kill-point恢复；
- fixed与owner support claim、四类发布产物、Connector SDK/第三方Execution/registry开源扩展、strict零stub编译、相对性能回退门、fail-fast Phase门与Definition Complete。

实际运行只读检查并构造反例。重点尝试：late authority subtype、cleanup后直接re-lease、delivery-unknown直接retry/fallback、side-effect跨request terminal或commit lease、rights跨use case/operation、旧eligibility/generation/expiry迁移、空official destination、静态registry动态字段、旧capability重放、WIF audience混同、Azure错误tenant endpoint、LM Studio Messages双header或错误auth继承、Hunyuan fresh CTA、row wire/auth swap、跨realm/distribution witness、owner自填compiled事实、evaluator proof跨solution、legacy半写状态。不要把“尚未施工”本身计为缺陷，只计方案按原样实施仍不闭合、事实错误、不可构造或无法机械判定的地方。

A=安全、权益、费用、数据、协议、不可构造/不可发布或可绕过机器门；B=主流路径不可用、重大平台/维护/性能/体验或验收缺口；C=非阻断改进。相同根因不得重复计数，也不得降级真实阻断项。

最终输出一份完整Markdown报告，结构必须为：冻结身份与方法、结论、A发现、B发现、C发现、主流供给/协议/安全/UX/工程覆盖矩阵、A/B/C精确计数、`PASS`或`FAIL`。每条A/B必须含目标准确行号或符号、最小反例、根因级修复和机器验收。只有A=0且B=0才可PASS。输出中不要要求自行写文件；外层调用会把最终消息原样保存为报告。
