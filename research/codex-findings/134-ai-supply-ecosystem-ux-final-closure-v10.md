# AI Supply 生态与配置体验最终闭包复核 v10

## 输入完整性

- 唯一目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 冻结值核对：`19,742` 行、`1,182,440` bytes、SHA-256 `e5100062006a86b5828630a068f51b615c38aee2642229f572271b0b5e5a9cdc`
- 读取方式：从第 1 行到第 19,742 行连续完整读取；未读取其他仓库文件或旧评审。
- 读后复核：`19,742` 行、`1,182,440` bytes、SHA-256 `e5100062006a86b5828630a068f51b615c38aee2642229f572271b0b5e5a9cdc`
- 输入漂移：`[ok]` 无漂移。

## 唯一结论

`FAIL`

计数：A=1，B=2，C=0。

方案已经把协议、权益、费用、数据边界、本地计算、发现安全、正向 readiness、两种 anchor 起点和大多数主流生态路径写得很完整；但当前 reference-grade 机器合同仍能漏掉正文规定的固定生态最低项，执行旅程仍能借用宽松上限冒充 `zero_config/guided_*`，登录等离开应用的旅程也缺少可执行的返回焦点合同。因此尚不能给出 A=0、B=0 的通过结论。

## 生态与旅程覆盖矩阵

| 检查面 | 目标中的主要落点 | 结论 |
|---|---|---|
| OpenAI、Anthropic、Gemini、OpenRouter、OpenCode、BigModel/Z.AI、Kimi、DeepSeek、百炼、方舟/BytePlus、混元、千帆、MiniMax、SiliconFlow及长尾 | 16755–16804、18144–18206、18303–18318 | `[fail]` 品牌与产品面广，但正文固定的细粒度最低集没有全部进入可机械派生的 reference profile，见 A-001。 |
| CLI、订阅、App Server、ACP及权益边界 | 17882–17921、18208–18227、18667–18728 | `[ok]` 推理与 Execution 分面，订阅登录、API key、企业 token及未知权益均有独立边界。 |
| bridge、gateway、自定义 Base URL、header、mTLS与未知计量 | 15719–15724、17954–17963、18241–18254 | `[ok]` 发送前预览、逐 hop身份、secret header、mTLS-only及两类 unknown metering均有明确合同。 |
| Ollama Cloud、LM Link、oMLX、vLLM、SGLang、llama.cpp、LocalAI、Docker、Podman、Foundry Local、Apple Foundation Models及LAN | 17788–17790、17923–17952、18229–18239、18604–18655 | `[warn]` 技术与处方路径充分；但 LM Studio/BytePlus等正文固定语义未全部成为精确 reference requirement，归并到 A-001。 |
| AWS、GCP、Azure认证变体 | 16828–16839、17845–17854、18801–18818 | `[ok]` API key、静态profile、role、SSO、ADC、WIF、Entra user、service principal、managed identity均被拆成独立旅程。 |
| provider-first、单一主动作、登录/MFA、离开返回、首次见证、离线/代理/中国可达性、恢复、冷启动、停服与迁移 | 16341–16531、17793–17796、18024–18125、18624–18789 | `[fail]` 流程与处方大体齐全，但返回后的键盘/读屏焦点没有状态合同，见 B-002。 |
| GA正向终态 | 16608–16650、17183–17388 | `[ok]` pass只允许连接加对话/复核、连接加Execution-ready或control-ready；blocked、action-required、advanced仅为负向fixture。 |
| `not_enrolled`与`ready`两种anchor起点及完整动作/时间计数 | 16533–16586、16996–17110、17423–17572 | `[fail]` 两种起点和前置事件合并已闭合，但执行旅程档位与精确计数上限仍可错配，见 B-001。 |
| reference profile、全部L0、固定中国/全球入口、逐realm/auth journey、owner只增不减 | 16689–16949、17801–17803、18301–18319 | `[fail]` 正文与类型中的类别词表及固定入口不等价，可在保留GA徽章时漏项，见 A-001。 |
| discovery安全与publisher公平 | 14969–14993、15385–15398、15764–15858、17782–17790 | `[ok]` static/passive/explicit-active分层、零secret、资源预算、core保留容量和overload公平性均可验。 |
| 禁止让用户猜协议、URL、账号、region、route或模型能力 | 15719–15724、17856–17865、17965–17973 | `[ok]` Base URL语义、最终URL预览、多账号选择和协议探测均不靠静默猜测。 |
| inventory、安装、登录、权益、conformance、readiness、费用、数据边界、本地计算与可能外连分离 | 15411–15424、16307–16323、17939–17952、19108–19128 | `[ok]` 证据轴与当前可用性分离；loopback、local compute和data locality没有混写。 |
| 被动/主动状态、错误、返回焦点、screen reader与低认知负担 | 18077–18125、18758–18778 | `[fail]` 唯一主动作、错误解释、键盘和screen-reader门已写入，但缺返回焦点的机器状态与断言，见 B-002。 |
| 未授权消费者订阅的官方API或其他来源替代 | 18037–18075、18084–18090、19201–19209 | `[ok]` 不复用订阅token、不静默PAYG；有安全官方目的地才跳转，否则选择其他来源。 |

| 代表旅程 | 正向终态与起点 | 动作/时间口径 | 复核结果 |
|---|---|---|---|
| 本地零配置/已有容量 | `connected_verified + conversation_ready`；`not_enrolled/ready` | 主旅程1次SayDo动作，前置见证另计并合并 | 终态和anchor闭合；固定最低旅程的机械清单受A-001影响。 |
| API key/payg | `connected_verified + conversation_ready/review_ready`；两种anchor | 凭据、conformance成本、runtime预算分别计数 | supply映射正确；逐类上限没有进入最终gate，受B-001影响。 |
| OAuth/订阅 | `connected_verified + conversation_ready/review_ready`；两种anchor | 登录、MFA、provider页面、离开返回均记录 | 计数存在；浏览器返回后的焦点恢复未验，受B-002影响。 |
| 企业云 | `connected_verified + conversation_ready/review_ready`；两种anchor | 账号/region/admin等待、raw/app elapsed分记 | auth路径拆分充分；同样受B-001的逐类上限缺口影响。 |
| Execution Agent | `connected_verified + execution_ready`；两种anchor | 当前统一使用enterprise/execution宽限额 | `[fail]` `zero_config/guided_*`标签与上限可错配，见B-001。 |
| anchor control | `control_ready`；`not_enrolled/ready` | 独立前置/控制旅程上限 | 正向终态和两种起点均有类型约束。 |
| blocked/action-required/advanced | 不得进入pass | 仅负向fixture | 类型与mutation门均明确拒绝。 |

## Findings

### A-001 reference-grade类型无法机械推出正文规定的固定生态最低集

- 严重级别：A
- 精确行号：16755–16804、16861–16908、16941–16947、18301–18319。
- 具体旅程/最小反例：构造一个合法的 `ReferenceGradeProfileV2`，保留16755–16804的全部固定key，但不加入BytePlus ModelArk；把BytePlus维持为L1非required或直接不进入matrix。用OpenAI、Anthropic、Gemini、OpenRouter等其他条目满足16863–16866的`global_official_api >= 8`，再按“全部matrix L0 + fixed named + owner additions”生成baseline。该对象不违反类型中的固定key、七个粗粒度category minimum或owner只增并集，却违反18308明确要求的`global_realm_split`四个国际realm，因为固定key列表中不存在BytePlus。相同缝隙还允许把18306要求的Kimi双protocol、18311要求的LM Studio冷/暖与多协议、18314要求的普通CLI stdio缩成任意非空generic journey。
- 为什么当前方案失败：§9.9使用`mainland_subscription_api`、`mainland_realm_split`、`global_realm_split`、`global_native_api`、`enterprise_cloud_identity`等细粒度mandatory category；但`ReferenceGradeProfileV2.requiredCategoryMinimums`只固定七个更粗类别，`requiredEntryCategoryMappings.categoryKeys`的literal union也无法表达绝大多数§9.9类别。`requiredJourneyRequirements`和baseline中的category/journey数组只是非空数据与digest，没有一个从§9.9固定tuple推导这些集合的封闭算法。因而“exact set”门只能证明实际集合等于一份已经被缩小的profile，不能证明profile仍等于本文承诺的reference minimum。18301还写owner可“调整具体产品”，与16701–16704和16946的只增不减目标冲突。
- 根因级修复：把§9.9每一行改成唯一的、版本化的`ReferenceRequirementV3`精确tuple，逐项冻结entry key、realm、protocol、auth、funding、journey key、state/fixture及platform/locale要求；把`global.byteplus-modelark`、LM Studio具名旅程、Kimi双protocol和普通CLI stdio等正文最低项直接列入该tuple。`requiredEntryKeys/categoryKeys/journeySubjects/runSubjects`只能由此tuple加owner additions确定性派生，删除手填证明布尔与第二套粗类别名单。增加“删除或替换每一个固定entry/realm/auth/protocol/journey均失败”的逐项mutation；owner只能追加，若另建缩减profile则必须更名并失去reference-grade/GA。

### B-001 GA旅程标签没有绑定完整、逐类的动作与时间上限

- 严重级别：B
- 精确行号：16341–16378、16431–16531、16588–16640、17183–17388、19012–19023。
- 具体旅程/最小反例：定义一个Execution journey为`journeyTier: "zero_config"`，但按16618–16630使用`enterprise_cloud_or_execution`限额；让主旅程发生4次SayDo主动作、3个外部任务和2个手填字段，最后达到`connected_verified + execution_ready`。17183–17388的pass/gate会按enterprise限额接受它，而19016对`zero_config`承诺的是1个SayDo动作、0外部任务、0手填字段。另一个反例是`guided_oauth`记录多次MFA或多次账号创建，只要未超过聚合external-task上限即可；16341–16378定义的逐类planned maxima没有被journey definition、pass payload或gate引用为上限。
- 为什么当前方案失败：supply tier有精确映射，Execution却把`zero_config | guided_oauth | guided_key`三种标签统一映射到最宽的enterprise限额。最终gate只绑定`GaReferenceUxLimitV2`的聚合字段；`GaUxPlannedMetricsV2.maximumExternalTasksByClass/maximumManualFieldsByClass`只被借来描述actual字段形状，没有成为reference limit，也没有逐类比较关系。结果是报告“完整计数”却不能阻止标签与真实负担不符。
- 根因级修复：建立同时适用于supply和Execution的判别型tier→limit映射；每个reference limit必须包含主旅程、anchor前置和合计三层的逐类external task、manual field、provider step、admin wait、copy/paste、leave-return、错误、恢复及app/raw elapsed上限。若企业/管理员旅程确实需要宽限额，使用独立`enterprise_managed`层级并禁止显示`zero_config/一步登录/填一次key`。gate从完整typed event inventory逐类重算，不接受producer布尔；增加Execution zero-config借enterprise limit、MFA超类上限、manual-field分类漏计等mutation。

### B-002 离开应用再返回时没有可执行的键盘与读屏焦点恢复合同

- 严重级别：B
- 精确行号：18077–18097、18112–18125、18758–18778。
- 具体旅程/最小反例：键盘和screen-reader用户在`action_required.login`卡片触发“打开登录”，在浏览器完成登录/MFA后返回SayDo；原按钮因状态更新已从DOM移除，卡片变成验证中或新的primary action。当前合同只要求自动回到原卡、`aria-live=polite`且更新不抢现有输入焦点，没有规定原焦点已消失时落到哪个稳定语义目标。实现可把焦点留在`body`或浏览器chrome，用户必须从头Tab搜索；现有截图、唯一按钮和一般键盘可达测试仍可能全部通过。
- 为什么当前方案失败：`leaveAndReturnCount`只计数往返；`aria-live`只解决播报且明确“不抢焦点”；“自动回到原卡并重探”只保证视觉状态连续。目标中没有invoker语义ID、返回后的focus target、目标消失时fallback、错误/成功分支的announcement与active-element断言，因此登录、MFA、打开provider页面、Docker/Podman处方和恢复流程都可能对键盘/读屏用户形成共同断点。
- 根因级修复：为所有leave-and-return动作增加typed `ReturnFocusPolicy`：记录触发动作/卡片语义ID，返回时若触发元素仍存在则恢复它；若状态已推进，则聚焦新状态标题或新的唯一primary action，并通过一次受控live-region消息说明变化；目标不存在时使用同卡片可预测fallback，禁止落到`body`。把focus transition、announcement和fallback写入typed action log及GA run evidence，使用真实浏览器callback/MFA、provider文档往返、错误恢复和容器处方fixture断言`activeElement`与accessibility tree，而不只做截图或“可Tab到”检查。

## 收口条件

只有A-001的reference requirement改为唯一可派生真相源，且B-001/B-002分别进入强类型旅程gate与真实浏览器/可访问性fixture后，才具备重新冻结输入并争取`PASS`的前提。
