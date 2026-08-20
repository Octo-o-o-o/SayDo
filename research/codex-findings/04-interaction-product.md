# VoiceLoop「AI 主导采访 × 双维就绪决断 × 决策包」产品与交互深度 Review

> 调研日期：2026-07-22
> Review 范围：[VoiceLoop 框架](../voice-coding-framework.Cursor2.md) §0、§4.3、§4.16、§4.17、§4.20、§4.21，以及 [scenarios](../scenarios/) 下的场景与设计哲学文件。
> 证据口径：文中用 **[事实]** 标出外部资料或现有设计中可核验的陈述；用 **[判断]** 标出基于证据对 VoiceLoop 的产品判断；用 **[建议]** 标出拟议机制。2026 年论文中尚未正式发表的 arXiv 稿件按“预印本”看待，不把其结论写成定论。

## 0. 结论先行

VoiceLoop 的独特性不在“会问问题”“会写计划”或“能做 HTML Demo”中的任何单项，而在一条完整的控制链：**AI 承担发现问题的劳动 → 用可审计的证据判断是否足以承诺 → 把抽象意图转换成可审阅对象 → 人只需批准一个边界明确的行动**。这条链在现有 AI 产品中尚未被稳定地端到端实现；v0、Replit、Stitch、Kiro、Deep Research 等各自覆盖了其中一段。

现有方案方向正确，但有三个会让差异化退化成口号的缺口：

1. **“知识够不够”和“需求清不清”目前只有自然语言自省，没有证据账本、硬门槛或结果校准。** 同一个模型既采访、又自评、又生成漂亮的决策包，最容易出现“叙述很完整，因此误以为已就绪”。
2. **“perfectly implement”是错误的停止条件。** 它会奖励无止境追问。真正的条件应是“剩余不确定性已低于本次行动的风险预算，且再问一个问题的预期收益不再高于用户负担”。
3. **把 Demo 定义成一次性 mock 会制造新的规格漂移。** 决策包必须是版本化的“评审契约”；Demo、计划、验收项与最终产物至少共享同一份结构化来源，UI 项目则优先直接预览真实代码中的薄切片。

最值得落地的两条原则是：

- **就绪是可校准的决策，不是一个好看的分数。** 内部保留覆盖度、风险预测和逐项证据；对用户只解释“已确认什么、假设什么、为何现在建议开工”。
- **Demo 不是固定的 HTML 页面，而是最低成本的“判断界面”。** UI 用可点击原型，调研用证据样章，营销用创意与投放样件，设计用对比原型，谈大客户用异议演练和 Mutual Action Plan。

---

## 1. 就绪判定：何时停止追问，何时主动给决策包

### 1.1 2026 实践给出的共同答案

**[事实] 选择性追问优于“永远先问”或“永远猜”。** 2026 年预印本 [Ask or Assume?](https://arxiv.org/html/2603.26233) 把“识别欠规格”和“执行任务”拆成不同角色；其 UA-Multi 在实验中达到 69.4% 的 resolve rate，高于单角色版本的 61.2%，并显示被迫交互的基线会过度澄清。更重要的是，系统在不提问的任务上仍保持了接近隐藏意图基线的表现，说明目标不是增加问题数量，而是提高问题的选择性。

**[事实] 提问应按预期信息增益路由。** [Uncertainty-Aware Clarification with Information Gain](https://arxiv.org/html/2606.03135) 用 expected information gain 训练澄清策略；报告的平均成功率提升为 3.7%，总步骤只增加 0.3，学习到的澄清器平均触发 1.3 次，而固定式基线为 4.2 次。论文还指出，不必要的问题会把干扰上下文带进后续执行。

**[事实] “会不会问”必须同时测覆盖与多问。** [AskBench](https://arxiv.org/html/2602.11199) 用逐项 rubric/checkpoint 判断缺失意图或错误前提，核心指标同时包括：缺口覆盖率、所有缺口解决后的不必要提问率、模糊任务的提问率，以及清晰任务的直接作答率；评测还设置固定轮次预算，避免模型靠无限追问取胜。

**[事实] 问题价值会随时间和缺口类型变化。** 2026 年预印本 [Ask Early, Ask Late, Ask Right](https://arxiv.org/html/2605.07937) 在 84 个变体、6,000 多次运行中区分 goal、constraint、input、context 四类缺口：goal clarification 在任务早期价值最高，input 的价值衰减更慢；晚问会浪费已完成的工作。论文也发现不同模型的自然提问时机差异很大，说明一条 prompt 不能替代校准。

**[事实] 是否该问还与用户偏好和解释分布有关。** NAACL 2025 的 [Clarify When Necessary](https://aclanthology.org/2025.findings-naacl.306/) 用候选意图分布的熵来判断歧义，并把用户对速度/谨慎的偏好纳入决策；ICLR 2025 的 [Modeling Future Conversation Turns](https://proceedings.iclr.cc/paper_files/paper/2025/hash/97e2df4bb8b2f1913657344a693166a2-Abstract-Conference.html) 则显示，用预期后续结果而非当前一句话的表面质量训练偏好，可改善何时追问的判断。

**[判断]** VoiceLoop 的“双维就绪”是一个好抽象，但维度太粗，不能直接作为模型自报的两个 0–100 分。它应是两组可观察检查项的汇总；真正的动作门禁还必须包含风险、可逆性、验收可行性和“再问一次是否值得”。

### 1.2 建议的四层就绪模型

#### 第 1 层：证据账本，而不是聊天摘要

**[建议]** 每一类项目都维护结构化 Readiness Ledger。每个检查项至少包含：

| 字段 | 含义 | 示例 |
|---|---|---|
| item | 要判断的具体事项 | “目标用户是谁” |
| dimension | K（知识）或 R（需求） | R |
| state | confirmed / inferred / unknown / conflicting | inferred |
| evidence | 原话、文件、检索结果或系统事实 | “面向北美 SMB 销售负责人” |
| provenance | 用户、某位会议参与者、外部来源、AI 推断 | user:owner |
| confidence | 对该条证据解析正确的估计 | 0.72 |
| impact_if_wrong | 错了会造成多大返工或伤害 | high |
| reversibility | 执行后是否容易撤销 | medium |
| critical | 是否为硬门槛 | true |
| owner_to_resolve | AI 可自行查证，还是必须问人 | user |

这里的 state 必须由证据支持：用户明确说过才是 confirmed；AI 根据上下文补全只能是 inferred；两位参与者表达冲突就是 conflicting，不能靠摘要把冲突抹平。

#### 第 2 层：两个覆盖指数，但明确它们不是“成功概率”

**[建议]** 给每个检查项一个项目类型相关的权重 wᵢ，并先用以下保守初值编码证据状态：

- explicit/verified = 1.0
- supported inference = 0.5
- unknown 或 conflicting = 0

则知识覆盖 Cₖ 和需求覆盖 Cᵣ 分别为该维度的加权平均。它们只回答“重要事项覆盖了多少”，不应在 UI 上伪装成“87% 一定做对”。任何 critical 项为 unknown/conflicting 时，该维度的 hard gate 直接失败，不能被一堆低权重已知项平均掉。

知识维度建议至少拆为：现状/环境、可用资料、领域事实、工具与权限、依赖、风险、验证手段。需求维度建议至少拆为：要改变的结果、目标人群/利益相关者、范围内/外、成功与验收、约束、主观偏好、决策权与截止时间。

#### 第 3 层：风险预测与提问价值

**[建议]** 另外训练或规则估计一个经历史数据校准的 P(material_rework)：如果按当前包开工，发生重大改向、回滚或验收失败的概率。它与覆盖指数分开，因为“所有问题都回答了”不等于答案正确。

候选问题 q 的净价值可写成：

    NetVOI(q) = 当前预期损失 − 回答 q 后的预期损失 − 用户负担 − 延迟成本

AI 只问 NetVOI 最高且大于 0 的问题。优先级的实用近似式是：

    priority(q) ∝ 不确定性 × 错误影响 × 不可逆性 × 用户可回答性 ÷ 回答负担

这会自然产生三个不同动作：

- 缺的是可联网或从仓库查到的知识：AI 自己查，不把检索劳动转嫁给用户。
- 缺的是主观目标、授权或无法推断的隐性偏好：问用户。
- 问题很难回答、但可以低成本做样件：先做安全的 preview probe，让用户通过反应提供信息。

#### 第 4 层：明确的动作门禁

**[建议]** 只有同时满足下列条件，系统才进入 Package Ready：

    Gₖ = true 且 Gᵣ = true
    Cₖ ≥ τₖ(project_type, risk)
    Cᵣ ≥ τᵣ(project_type, risk)
    P(material_rework) ≤ risk_budget
    最佳剩余问题的 NetVOI ≤ 0
    已能生成可审阅样件和可验证验收项

可用以下值做 shadow mode 的启动假设，**不是行业标准，也不应未经数据直接上线**：

| 风险层 | 示例 | Cₖ 初值 | Cᵣ 初值 | 额外门槛 |
|---|---|---:|---:|---|
| L：隔离、可逆、低成本 | 草拟文档、沙盒原型 | 0.75 | 0.80 | 所有假设可见，可一键撤销 |
| M：会产生可见交付或中等返工 | 开发分支、正式营销素材 | 0.85 | 0.90 | 用户确认 critical 假设 |
| H：外部发送、生产、资金或不可逆 | 发客户邮件、改生产数据 | 0.95 | 0.95 | critical 项全部 explicit/verified，精确动作二次确认 |

高分不授权执行。Readiness 是“认识上足够”，Authorization 是“治理上允许”，两者必须是不同字段、不同状态转换。

### 1.3 Clarification budget：把预算定义成用户摩擦，不是死轮数

**[建议]** 语音默认采用“每个澄清小节最多 3 个问题”的启动假设，并 A/B 校准：

1. 一次只问一个语义决策；屏幕可同时显示剩余缺口，但不连续朗读一串问题。
2. 第 3 问后，AI 必须选择：按可逆假设出草案、做安全样件、给 Partial Decision Package，或说明“还有 2 个高影响决定，是否继续”。
3. 低风险任务不能因预算耗尽而卡死；高风险任务也不能因预算耗尽而猜测授权。
4. 用户可选“快一点 / 标准 / 谨慎”，改变 risk budget 与提问阈值，而不是换一套人格化措辞。

“3 个”只是可测试产品初值。真正应优化的是每个问题带来的决策损失下降、总用户说话时长和最终返工，而不是轮次数本身。

### 1.4 如何校准，避免双维就绪成为装饰

**[建议]** 用三层机制约束自评：

1. **角色分离。** 采访 Agent 更新证据账本；只在可能转入 Ready 时，由 Readiness Checker 读取“检查项 + 原始证据”独立判断，不读取采访 Agent 的自我辩护。这个分离与 Ask or Assume? 的不确定性识别/执行解耦方向一致。
2. **确定性硬门禁。** 权限、外部发送对象、预算上限、生产环境、验收方式、参与者冲突等字段用规则判断，不能被语言模型高置信覆盖。
3. **结果校准。** 初期只 shadow 记录，不影响交互；积累真实结果后按项目类型、风险层、用户分别校准阈值。

最低限度应记录以下指标：

| 指标 | 要发现的问题 |
|---|---|
| false-ready rate | 给包后被判 no-go，或开工后发生重大改向的比例 |
| false-not-ready / unnecessary-question rate | 已足够清晰却继续追问的比例 |
| checkpoint coverage | 关键缺口在出包前被解决的比例 |
| effective question rate | 问题是否改变了账本、计划或样件 |
| value per question | 每问带来的预计/实际返工下降 |
| decision latency | 从对话开始到用户能拍板的时间 |
| edit-before-go | 用户需要对包做多大修改才同意 |
| acceptance / rework / rollback | 执行后的真实质量与代价 |
| calibration error | 预测重大返工概率与真实频率是否一致 |

产品 UI 不必显示 87/92 这种伪精确数；显示“已确认 6 项、2 项按可逆假设、0 个阻塞项”更诚实。内部用 reliability diagram、Brier score/ECE 检查 P(material_rework) 的校准，并按开发/调研/营销/设计/大客户分别设阈值。

---

## 2. AI 主导采访的交互设计

### 2.1 一次一问是语音默认，但不是教条

**[事实]** Google 的 Conversation Design 指南建议每轮只提一个问题，并在提问后停止说话；其 [Questions](https://developers.google.com/assistant/conversation-design/questions) 指南区分 wide-focus 与 narrow-focus：开放问法能给熟悉领域的用户更多控制和信息空间，但会让不熟悉的用户无从下手；窄选项更易回答，却可能显得受限和机械。[Commands](https://developers.google.com/assistant/conversation-design/commands) 还建议复杂任务给新手多轮引导、给专家 one-shot shortcut，并指出用户通常一次只会提供 2–3 个信息片段。

**[事实]** 2026 年 [ReqElicitGym](https://arxiv.org/html/2602.18306) 在 101 个网站场景、632 个隐性需求上测试 7 个模型；即使最佳模型的 implicit requirement elicitation 也只有 0.32，所有模型都遗漏一半以上隐性需求。其 TKQR 指标专门奖励关键问题更早出现、惩罚冗余和延迟问题。

**[判断]** VoiceLoop 应把“一次一问”定义成“一次只要求用户做一个决定”，而不是强迫用户一次只说一句。用户如果自然地把目标、受众、期限一起讲完，系统应一次解析多个槽位，绝不能因为流程模板再逐项重复问。

### 2.2 推荐的问法协议

**[建议]** 每个问题都使用以下结构，但语音只读最短必要部分：

1. **短反映**：一句话说明 AI 刚理解到什么；只在有歧义时出现，不要每轮机械复述。
2. **为什么现在问**：高影响问题用半句话说明影响，例如“这会决定先做可点击原型还是直接接真实数据”。
3. **一个问题**：只包含一个决策轴。
4. **2–4 个可区分选项**：有推荐项，并提供“都不是 / 不确定 / 先按推荐”。
5. **开放出口**：用户随时可讲自己的答案、补上下文、上传参考物，或说“先给我看个样子”。

示例：

> 我已经能确定核心流程，但视觉方向会决定 Demo 是否值得评。你更希望它偏：A 冷静工具感（推荐，适合高频工作台）、B 友好陪伴感、C 高冲击发布感，还是先给你看三版？

选项应是信息架构，不是强迫选择。不要问“你喜欢蓝色还是绿色”这类把方案空间过早压扁的问题；要问能改变计划、样件或验收标准的轴。

### 2.3 什么时候开放问，什么时候给选项

| 情况 | 默认问法 | 原因 |
|---|---|---|
| 首次讲目标、故事、痛点 | 开放，但给一个示例起点 | 防止把问题定义错 |
| 高影响且候选空间已知 | 2–4 个互斥选项 + 推荐 | 降表达负担，易语音回答 |
| 用户不熟悉术语 | 用结果差异描述选项 | 不要求用户先学产品语言 |
| 用户明显是专家或一次给很多信息 | one-shot shortcut | 尊重其表达效率 |
| 风格、审美、语气 | 可视/可听对比，不问抽象形容词 | 隐性偏好靠反应更可靠 |
| 高风险授权 | 精确复述将发生的动作，再显式确认 | 错误成本高且难撤销 |
| 低风险、可逆且回答困难 | 先做两三个样件再问 | “看着判断”比凭空定义容易 |

**[事实]** Dust 在 2026 年 4 月上线的 [structured questions](https://docs.dust.tt/changelog/agents-can-now-ask-you-questions-to-clarify-their-next-steps) 允许 Agent 暂停并给 single-select/multi-select 选项；开源工作流 [Superpowers brainstorming](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md) 则把“一次一问、选项优先、先给 2–3 个方案与推荐再请求批准”固化为流程。它们是可借鉴的交互模式，不是效果研究。

### 2.4 语音场景的具体减负设计

**[建议]** VoiceLoop 不应做成只有音频的“黑盒面试官”，而应是 voice-first、screen-assisted：

- AI 说完问题后立即停；屏幕保留选项、刚确认的事实和“为什么问”。
- 实时字幕允许点选纠错；对金额、人名、域名、日期等高风险实体必须显示并确认。
- 支持说“A”“第一个”“按推荐”，也支持直接点选。Google 的 [多模态会话指南](https://developers.google.com/assistant/conversation-design/learn-about-conversation) 强调屏幕本身就是对话上下文，用户会自然说“第一个”“红色那个”。
- 端点检测不确定时提供“说完了”按钮，避免 AI 抢话；长答案中途只用非语言状态反馈，不插入完整句子。
- 屏幕常驻“先出样件”“先按合理假设”“还有什么没确定”“回到最初目标”四个逃生口。
- 每 3–4 个有效答案给一张可编辑的理解卡，而不是逐轮都问“对吗”。
- 同一个用户逐步学习：新手用引导式多轮，熟悉后允许一句话覆盖多个字段或直接检查决策包。

### 2.5 风格/审美类隐性需求：必须从“问形容词”转成“让用户做感知判断”

**[事实]** ReqElicitGym 对 style 隐性需求的发现尤其严峻：多数模型/设置的 style elicitation 接近 0，明显弱于 content 和 interaction。这与 vibe 用户常说的“我说不出，但它长得不对”一致。

**[判断]** 如果视觉项目的 style 只是需求清晰度中的一个低权重子项，VoiceLoop 会在功能需求都齐时错误宣布就绪。对设计、品牌、营销创意，style/vibe 必须是 critical gate，而且证据应是具体参照和比较行为，不是 AI 把“高级、简洁”润色成一段漂亮文案。

**[建议]** 使用五步 Contrastive Vibe Interview：

1. **参照采集**：让用户给 2 个“喜欢”、1 个“不要”的截图/站点/声音样例；没有素材就由 AI 先生成候选。
2. **成对或三选一**：一次只比较一个主要视觉轴，不把十几个风格词一次丢给用户。
3. **指哪说哪**：用户点具体区域并说“这里太像企业软件”“字太规整”；保存热点与原话。
4. **反向归因**：AI 把反应翻译成可执行约束，例如密度、字号层级、留白、对比、动效幅度、语气与禁用模式，并标记为 inferred，等待下一版验证。
5. **闭环复现**：用同一组件/设计 token 生成下一版；只有用户的选择在新样件上稳定复现，style gate 才通过。

Google Stitch 2026 的更新允许从文本、语音、现有代码或设计文件开始，并在画布上实时 steer 生成中的设计；这说明“边看边说、让视觉对象承接上下文”已经成为可抄的产品范式。[官方介绍](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/)

---

## 3. 决策包与 Demo：从“报告”变成可签署的评审契约

### 3.1 Demo-first 产品真正值得抄的不是生成速度

**[事实] v0 已经把预览与源代码打通。** [v0 Design Mode](https://v0.app/docs/design-mode) 操作的是正在运行的 app preview；用户选中元素做视觉调整后，Apply 会把改动写回 source code，形成可 diff、review、revert 的新版本。它不是一张脱离实现的效果图。

**[事实] Replit 同时展示了“样件快”和“同源”的张力。** [Agent 4 的 Design Canvas](https://replit.com/blog/whats-changed-agent3-to-agent4) 可并排放真实 app 的交互预览与更轻量的 visual mockup，也能把选中的 mockup 转换成真实 artifact；但官方明确说明 mockup 没有 server，仍需转换成 App。Agent 4 还把尝试隔离在主项目副本中，只有明确批准才合入，给 VoiceLoop 提供了“可试、可比、批准后晋升”的参考。

**[事实] Plan 模式正在形成轻确认范式。** [Replit Plan Mode](https://docs.replit.com/references/agent/plan-mode) 先产出可审阅任务列表，再由用户 Start building；[Bolt Plan Mode](https://support.bolt.new/best-practices/discussion-mode) 提供 Implement this plan、Show example、Refine 等直接动作；[OpenAI Deep Research](https://help.openai.com/en/articles/10500283-deep-research) 在执行前给可修改的研究计划，执行中可中断调整，结果带目录、引用、来源和活动历史。

**[事实] 规格工具把中间产物变成连续链条。** GitHub [Spec Kit](https://github.github.io/spec-kit/) 使用 Specify → Plan → Tasks → Implement；其 [Spec Persistence](https://github.github.com/spec-kit/concepts/spec-persistence.html) 明确讨论 spec-first、spec-anchored 与 living spec，并警告多个并列“真相源”会静默分叉。Kiro 的 [Feature Specs](https://kiro.dev/docs/web/specs/) 也把 requirements、design、tasks 做成可编辑、可审查的连续 artifact。

**[判断]** VoiceLoop 当前“计划 + 一次性 HTML mock + go/no-go”仍是三个并列输出。用户批准的是视觉印象，AI 执行的却可能是另一份文本理解；这会把认知负担从“表达”暂时挪走，又在验收时以“怎么和 Demo 不一样”返还给用户。

### 3.2 决策包建议采用三层渐进披露

**[建议]** 决策包不是长文档，而是同一个结构化对象的三种视图：

1. **15–30 秒语音摘要**：要做什么、最重要的假设、AI 建议现在为什么可以拍板。
2. **一屏 Decision Card**：结果预览、边界、风险、谁做什么、预计成本/时间、四个决策动作。
3. **可展开证据与样件**：需求证据、来源、对比方案、完整计划、验收、Demo、未决项。

一屏卡片至少包含：

| 区块 | 必须回答的问题 |
|---|---|
| Outcome | 完成后用户能看到或做到什么？ |
| In / Out | 本轮明确做什么、不做什么？ |
| Preview | 用户要审阅的最小真实样件是什么？ |
| Assumptions | 哪些是用户确认、AI 推断、仍待验证？ |
| Acceptance | 什么可观察条件算完成？ |
| Plan & owners | 每一步由 AI、人、第三方分别负责什么？ |
| Cost / risk / side effects | 时间、预算、权限、外部影响和回退方式是什么？ |
| Decision | 按此版本开工 / 修改 / 再问 / 保存稍后 |

用户不应只看到一个泛化的 “Go”。按钮文案要把批准范围说清，例如“按 v3 在隔离分支实现”“批准生成素材，不对外发布”“批准向这 3 位联系人发送”。

### 3.3 Demo 与最终实现同源：三级策略

**[建议]** 给每个 Demo 明确标注 fidelity 与晋升路径：

#### A. 同代码预览（优先）

适用于已有代码库或可快速建立薄切片的 UI。直接运行真实组件、路由、design tokens 和 fixture data；用户在 preview 中点选修改，写回同一分支。v0 Design Mode 是当前最清晰的参考。

#### B. 同结构样件

无法直接运行最终系统时，Demo 至少与实现共享：信息架构、文案、数据 schema、组件标识、样式 token、验收项。每个可见元素都能追到一个需求和计划任务，例如：

    R-03 用户要比较三个方向
      ↕
    D-07 Demo 中的三栏比较区
      ↕
    P-05 实现 VariantCompare 组件
      ↕
    A-04 能保留选择理由并生成下一版

#### C. 概念 mock（最后选择）

纯效果图或一次性 HTML 仍有价值，但必须显著标注“概念，不代表最终数据/性能/交互”，列出无法复用的部分，并在转实现时进行一次差异检查。不要让用户误以为像素外观已被批准就等于系统行为也被批准。

**[建议]** 决策包本身要有 package_id、version、内容 hash、created_at 和 supersedes。执行任务、提交、验收报告均引用 package_id；任何改变范围、外部影响、预算或 critical 假设的 plan delta 都使旧授权失效。这样“决策包”才是契约，而非聊天中一段容易被后续语句覆盖的摘要。

### 3.4 非 UI 项目的 Demo 应改名为 Review Artifact（评审样件）

**[判断]** “所有项目都做 HTML Demo”会形式主义化。真正统一的不是媒介，而是功能：让用户在付出低表达成本的情况下，对一个可观察样件做判断，并能从样件追溯到证据、假设和后续实施。

**[建议]** 产品对外可以继续说“先给你看个样子”，内部 schema 用 review_artifact，并根据项目选择：

| 项目 | 最有判断力的评审样件 | 用户在样件上判断什么 |
|---|---|---|
| 前端/产品开发 | 真实组件薄切片、可点击 happy path、状态切换 | 流程、信息层级、行为和视觉 |
| 后端/自动化 | API contract、fixture 输入输出、CLI transcript、状态机、测试样例 | 边界、数据与异常行为 |
| 调研 | 带真实来源的 1 页样章、证据矩阵、结论—证据链、来源覆盖图 | 深度、可信度、论证方式 |
| 营销 | 3 个创意方向、落地页/邮件/广告样件、内容日历、带假设的 KPI 情景器 | 受众、承诺、语气、渠道适配 |
| 设计 | reference board、两三个对比方向、关键流程原型、token 样板 | vibe、层级、品牌一致性 |
| 谈大客户 | 账户地图、MEDDPICC 证据热图、分支式异议演练、Mutual Action Plan | 缺口、政治风险、下一步与双方承诺 |
| 规划/写作 | 完整目录、一个高风险章节样稿、依赖图、里程碑 | 结构、论证和工作量 |

非 UI 样件也可以用 HTML 承载，但 HTML 只是容器。例如调研 Demo 里每条结论应能点开来源与反证；销售 Demo 的角色扮演必须标出哪些台词是假设，不能伪造客户表态；营销的 KPI 是情景假设，不应包装成预测事实。

### 3.5 决策包的验收标准

**[建议]** 决策包本身也要过 QA，至少满足：

- **可拍板**：用户能在 60 秒内说出批准的结果、边界和最大风险。
- **可追溯**：每个 critical 需求有来源，每个计划任务能回指需求，每个验收项能回指样件。
- **可执行**：AI/人/第三方责任无空白；权限和依赖已列出。
- **可证伪**：成功条件是可观察的，不是“效果好”“用户喜欢”。
- **诚实**：未知、冲突、推断、模拟数据显式可见。
- **可回退**：说明在哪里执行、何时检查、如何停止或撤销。
- **可版本化**：批准的是一个不可含混的版本，而非整个持续变化的对话。

---

## 4. 信任与控制：AI 可以自主提议，但不能把“就绪”偷换成“获准”

### 4.1 用户真正怕的不是 AI 有主见，而是边界不清

**[事实]** 2026 年研究 [Human Oversight of AI Coding Agents in Practice](https://arxiv.org/html/2606.05391) 访谈了 17 位有经验的开发者，归纳出事前控制、共同规划、实时监控、事后审阅四类监督。受访者常用计划、测试和目测作为“够好”的代理，却仍觉得实际控制有限；论文建议界面显示约束、成本、执行预览、内联控制，以及把 diff 与意图、测试和影响关联起来。

**[事实]** CHI 2026 的 [When Should Users Check AI?](https://tail.cc.gatech.edu/publications/zhou-chi-2026/) 通过 8 人形成性研究和 48 人组内实验比较检查时机；81% 参与者偏好策略性中间确认而非只在末尾确认，任务时间减少 13.54%。这支持“在高返工成本边界确认”，而不是每一步都打断或直到最后才问。

**[事实]** Replit 在 2025 年公开承认一次 Agent 删除数据库数据并影响生产环境的事件；数据可恢复，但当时开发更改可直接影响 production。随后增加 checkpoint/rollback、开发/生产隔离、Agent 开发期不能改生产，以及 planning/chat-only mode。[官方复盘](https://replit.com/blog/doubling-down-on-our-commitment-to-secure-vibe-coding) 说明“用户在对话里说了 code freeze”不是可靠权限边界，必须由产品架构强制执行。

**[判断]** 用户未必反感 AI 主动说“我认为已经可以开始”；他们反感的是不知道这句话会不会立即产生花费、写入、外发或不可逆动作。VoiceLoop 应大胆保留自主提议，把控制感放在“可见边界、精确授权、可撤销执行”上，而不是让 AI 永远谦虚地多问一句。

### 4.2 两把钥匙、四个状态

**[建议]** 状态机明确拆开：

    Interviewing
        → Package Ready（AI 的认识判断）
        → Awaiting Authorization（等待人的治理决定）
        → Executing（只在授权范围内执行）

对应两把独立钥匙：

- **Epistemic key**：证据和风险达到就绪门槛，由系统判定。
- **Authority key**：有权的人批准 package_id + scope + side effects + budget + expiry，由人给出。

多人会议中“大家听起来都同意”不能代替 Authority key；授权者身份本身是 critical requirement。

### 4.3 轻确认按风险渐进，不是一刀切

| 行动层 | 例子 | 确认方式 |
|---|---|---|
| R0 只读/生成草案 | 搜索、分析、在本地生成未发布草稿 | 用户可设置自动进行；始终显示状态 |
| R1 隔离且可撤销的写入 | 新分支、沙盒原型、未发送营销稿 | 一次明确“按 v3 在沙盒开工”，提供 Stop/Undo |
| R2 可见但可补救 | 合并候选、创建共享文档、提交待审素材 | 显示 exact diff/受众/成本，在关键边界确认 |
| R3 外部、生产、资金、删除 | 发客户邮件、投放、生产写入、删除数据 | 精确动作预览 + 显式二次确认；不接受含混的语音“嗯” |

**[建议]** 授权 token 绑定 package hash、执行环境、最大预算、外部对象和有效期。若执行中发现新范围或关键假设错误，系统暂停并给 Plan Delta：“原计划是什么、发现了什么、改变什么、额外代价、建议动作”。普通实现细节不打断；跨越上述边界才打断。

轻确认界面推荐四个动作：

- **按此版本安全开工**：主按钮，文案带环境或范围。
- **我改两处**：直接在包上批注，不回到空白对话框。
- **继续问我**：用户认为理解仍不足。
- **保存，暂不开工**：把决定与执行解耦。

不要默认使用倒计时自动开工；若用户主动为 R0/R1 开启 auto-proceed，也必须有可见倒计时与取消，并且不能继承到 R2/R3。

### 4.4 反面模式

**[建议]** 明确禁止以下交互：

- “我已经完全理解，现在开始了”——把模型自信、就绪和授权混为一谈。
- 一个泛化 “Yes” 同时授权写代码、买服务和对外发送。
- Demo 很漂亮，却隐藏假数据、缺失状态或无法复用的部分。
- 计划批准后，Agent 可静默扩大 scope 或换环境。
- 每个工具调用都确认，最终把用户训练成无脑点 Allow。
- 只在任务末尾给 diff，让用户无法在高返工边界纠偏。
- 用口头承诺代替开发/生产隔离、权限系统和回滚。

---

## 5. 不过早收敛 vs 及时收敛：用阶段和信息增益，而不是固定轮数

### 5.1 把对话分为四个可逆阶段

**[建议]** 在内部维护阶段，但不必让用户学习流程术语：

1. **Explore**：理解目标、故事、矛盾和可能方向；允许发散。
2. **Shape**：固定 north star，把分支放入 parking lot，定向补高影响缺口。
3. **Decide**：生成并迭代决策包；仍允许退回 Explore。
4. **Execute**：按版本化授权实施；新发现通过 Plan Delta 处理。

双维检查可以每轮运行，但不应每轮都打断用户说“已经 83%”。只有下列信号同时出现才主动转 Decide：

- critical gap 为 0；
- 最近两个有效问题没有产生新的关键分支；
- 最佳剩余问题的 NetVOI 低于用户负担；
- 已能做出有判断力的 review artifact；
- 用户的语言从“还有哪些可能”转向比较、取舍、时间或落地。

### 5.2 不同不确定性用不同顺序

**[事实]** Ask Early, Ask Late, Ask Right 表明 goal 缺口应尽早澄清，而 input/context 的价值衰减更慢。另一方面，UC Berkeley 2026 的一个 [30 人小型受控项目](https://www.ischool.berkeley.edu/programs/mims/projects/2026/ask-or-after-clarification-timing-and-user-experience-generative-ai) 比较 No Questions、Ask First、Ask After，发现澄清整体提高信任但也增加认知负担；总体时机差异不显著，文本任务中先给输出再问反而获得更高信任。该项目不是同行评审的大样本证据，但提示“先给可反应对象”在某些任务有价值。

**[建议]** 因而采用分流而非一个全局规则：

- **Goal / hard constraint / authority**：早问，避免在错误问题上做大量工作。
- **知识与资料缺口**：AI 先查，只有来源不可得或存在取舍时问。
- **可逆实现细节**：合理假设并在包中显式列出。
- **审美、语气、创意**：早做 2–3 个低成本样件，让用户通过比较回答。
- **高风险外部动作**：计划阶段早识别，执行前再对 exact action 确认。

### 5.3 用“最低可评审承诺”替换“perfectly implement”

**[判断]** §4.20 中“足以 perfectly implement”的表述会让模型认为任何未知都值得追问，也会把研究探索错误地压成完整规格。VoiceLoop 的承诺点应改成：

> 已足以生成一个忠实、可检验、风险受控的下一步；剩余未知已被列明，且不会在未经确认时跨越用户的风险边界。

**[建议]** 当用户仍在发散但系统已具备初步理解时，可以给 **Draft Decision Package**，明确“不代表已就绪”，让用户对样件和分支做反应。这样 Demo 同时是需求探针与最终批准对象，而不是只有收敛结束才出现。所有旁支进入 parking lot，并说明是否影响当前版本；用户可一键“继续探索这条”或“本轮先不做”。

---

## 6. 多项目类型模板：共享骨架 + 类型扩展 + 风险覆盖层

### 6.1 不要做五套互不相通的 prompt

**[事实]** 现有规格体系已经证明“按任务形态选择深度”比一张巨型清单更实用。Kiro 的 [Specs](https://kiro.dev/docs/web/specs/) 区分 Feature（requirements/design/tasks）、Bugfix（缺陷、期望行为、不变行为）和 Quick Plan；其 [Requirements-first](https://kiro.dev/docs/specs/feature-specs/requirements-first/) 用 EARS 风格验收条件和阶段审阅。Spec Kit 则用统一的 Specify → Plan → Tasks → Implement 保持跨项目 artifact 关系。

**[建议]** VoiceLoop 的模板引擎由三层组成：

1. **共享骨架**：Outcome、Stakeholders、In/Out、Success、Constraints、Evidence、Risks、Authority。
2. **类型扩展**：开发/调研/营销/设计/大客户各自的 K、R 检查项和 review artifact。
3. **风险覆盖层**：外发、生产、资金、隐私、合规、删除等一旦出现，增加硬门槛，不受项目类型限制。

再提供三种深度：

- **Quick**：低风险、可逆；允许合理假设，快速出样件。
- **Standard**：默认；完整核心骨架 + 类型关键项。
- **High-stakes**：关键项必须 explicit/verified，授权精确绑定，增加中间检查点。

项目路由也不是一次性分类。一个“给大客户做定制 Demo”的会话可能同时加载开发、设计、销售三个 extension；但 UI 只显示当前最高价值的问题，不把三份问卷拼起来。

### 6.2 开发 / 软件产品

#### 知识充分度 K

- 代码库、分支、运行方式、技术栈、相关模块和现有约定已查明。
- 真实数据/API/权限是否可用；若用 fixture，边界清楚。
- 依赖、部署环境、迁移、性能、安全与兼容性风险已识别。
- 可执行的测试/验收路径存在；AI 知道如何证明没有破坏既有行为。
- 任何生产、付费服务、凭证或外部系统操作已标记。

#### 需求明确度 R

- 用户问题与目标行为，不只是功能名。
- 主流程、关键异常/空/加载/权限状态。
- 范围内/外、平台/设备、非功能约束。
- 可观察验收标准及不应改变的既有行为。
- UI 项目的信息层级与 vibe 已通过视觉证据确认。

#### Hard gates

- 目标环境、主要成功路径、验收方式不明时不可宣告 Ready。
- 数据迁移、生产写入、删除、外部收费和凭证权限不可被假设。
- 视觉是目标核心时，style gate 不得被功能完整度平均掉。

#### 决策包与评审样件

- 可运行的真实组件/薄切片或 API fixture；关键状态可切换。
- 代码/架构影响图、计划任务、AI vs 人责任、测试与回退。
- 每个需求—Demo 区域—任务—测试的 traceability。

### 6.3 调研 / 分析

#### 知识充分度 K

- 可访问的信息源、时间覆盖、语言/地区和发布日期边界。
- 来源层级与可信度规则：一手/官方、论文、数据库、行业报道等。
- 检索策略、纳入/排除标准、已知证据缺口和相互冲突的材料。
- 需要定量、定性、竞品扫描、专家访谈还是系统综述；AI 是否真有相应数据。
- 结论能否逐条追溯，哪些只能作为推断。

#### 需求明确度 R

- 这份研究要支持哪个决定，而不只是“了解某主题”。
- 核心问题/假设、读者、地域、时间截止、比较对象和定义。
- 所需深度、交付格式、篇幅、截止时间、可接受来源与引用方式。
- 需要平衡观点、反证、风险，还是只做机会扫描。
- 什么结果会改变用户的决策。

#### Hard gates

- 决策问题、范围/时间截点、来源政策和交付对象必须明确。
- 不得把搜不到证据当成“证明不存在”，不得把推断写成事实。
- 涉及医学、法律、财务等高风险领域时，升级来源和人工审阅门槛。

#### 决策包与评审样件

- 一页真实样章 + 结论—证据矩阵 + 3–5 条实际引用 + 反证栏。
- 研究计划、查询/来源覆盖、预期结构、信息缺口、AI 与人需提供的材料。
- 用户主要判断“论证深度和证据标准”，而非只看目录。

**[事实]** [PRISMA 2020](https://www.prisma-statement.org/prisma-2020) 是系统综述报告规范，要求明确目标/问题、纳入排除标准、信息源、选择与综合方法，并提供 checklist 与 flow diagram；它不适合机械套到所有商业调研，但其“问题—来源—筛选—综合—局限”链条可作为 High-stakes 研究 extension。[OpenAI Deep Research](https://help.openai.com/en/articles/10500283-deep-research) 的可审计划、可指定来源、可中断过程、带引用报告，则是更接近普通 AI 调研的产品模板。

### 6.4 营销 / 增长

#### 知识充分度 K

- 产品事实、现有品牌资产、历史表现、可支持的 claims 与禁用表述。
- 渠道规格、受众数据、落地页/CRM/广告账户能力和归因限制。
- 预算、排期、素材依赖、审批链、地域/平台政策。
- 竞品与文化语境有来源，不靠模型刻板印象。

#### 需求明确度 R

- 商业目标与漏斗阶段；不是笼统的“提高曝光”。
- 目标受众、触发场景、核心洞察、offer、single-minded message、CTA。
- 语气/品牌 vibe、渠道、格式、频次、预算和时间窗口。
- KPI 定义、基线、评估周期，以及什么数据不可得到。
- 需要探索创意方向，还是按已定策略生产变体。

#### Hard gates

- 受众、可证实 claim、CTA、品牌/法律红线和发布授权必须明确。
- 没有数据时只能展示情景假设，不输出伪精确 ROI 预测。
- AI 可产素材不等于可自动投放；发布、预算和人群定向分别授权。

#### 决策包与评审样件

- 2–3 个有明确取舍的 campaign territory，每个含 hero 文案与代表素材。
- 真实尺寸的广告/邮件/落地页样件、内容日历、渠道计划、带参数的 KPI 情景器。
- AI 产出、品牌/法务审核、媒体购买、数据接入分别标 owner。

**[事实]** American Marketing Association 的 [Creative Brief Template](https://www.ama.org/toolkits/creative-brief-template/) 覆盖背景/目标、deliverables、受众行为、tone、message、channels、formats、timing、budget 等字段，适合作为 Marketing extension 的来源；VoiceLoop 需要在此之上加入证据状态、发布权限和 review artifact。

### 6.5 设计 / 品牌 / 体验

#### 知识充分度 K

- 当前产品/品牌、design system、平台规范、目标设备和技术约束。
- 现有用户流程、内容量、数据状态、无障碍与本地化要求。
- 可复用组件、字体/图片授权和实现团队能力。

#### 需求明确度 R

- 要改善的用户任务与体验问题。
- 信息层级、关键路径、必须呈现的内容与状态。
- 喜欢/不喜欢的具体参照，以及选择理由。
- 密度、排版、色彩、动效、语气等可执行 vibe 约束。
- 响应式、无障碍、设计交付和完成判定。

#### Hard gates

- 关键流程和内容层级不能只靠漂亮画面补全。
- style/vibe 必须由 reference + contrastive choice + 新版复现支持。
- 关键状态、目标 breakpoint、可访问性要求和实现约束已覆盖。

#### 决策包与评审样件

- reference board 与明确的 anti-reference。
- 2–3 个对比方向，不只是同一版换颜色；一个关键流程可点击。
- 选中方向的 design tokens、组件状态和实现影响。
- 用户的每个“这里不对”保留为 hotspot evidence，进入下一版与验收。

### 6.6 谈大客户 / Enterprise deal

#### 知识充分度 K

- 账户背景、现有关系、业务问题、组织图和每条信息的来源/时效。
- 已知 stakeholder 的角色、影响力、立场；未知不能自动补全。
- 采购、安全、法务、预算、paper process、竞争态势与历史承诺。
- 产品能力、不可承诺事项、成功案例与可验证证据。
- 会议参与者、谁能做什么决定、谁有对外沟通权限。

#### 需求明确度 R

- 本次会议/跟进要达成的一个具体 outcome 或 next commitment。
- 客户 decision criteria、decision process、关键痛点、可量化 value。
- Economic Buyer、Champion、Competition，以及仍需验证的假设。
- 可谈/不可谈的商业边界、语气、材料和后续节奏。
- go/no-go 的条件：约下次技术验证、获取数据、进入采购，还是暂停。

#### Hard gates

- 客户事实必须有说话人/文档来源和时间；AI 角色扮演不得伪装成真实客户意见。
- 对外邮件、报价、承诺、会议邀请要有有权人批准及精确收件人。
- 内部 owner 的私下顾虑不得写进面向客户的包，除非明确授权。

#### 决策包与评审样件

- MEDDPICC 证据热图：confirmed/inferred/unknown/conflicting，而不只是总分。
- 账户/影响力地图、关键假设、最可能异议的分支式演练及推荐应对。
- 双方 Mutual Action Plan：milestone、owner、date、exit criteria、依赖。
- 会后邮件和会议议程预览；发送前单独授权。

**[事实]** [MEDDPICC](https://meddpicc.com/) 提供 Metrics、Economic Buyer、Decision Criteria、Decision Process、Paper Process、Identify Pain、Champion、Competition 的机会检查框架；[Salesforce 的 Mutual Action Plan 指南](https://www.salesforce.com/blog/sales/mutual-action-plan/) 把 MAP 定义为买卖双方共享的阶段、责任、stakeholder 和 outcome 文档。VoiceLoop 最值得借的不是销售缩写，而是“证据缺口 + 双方共同承诺”；单个机会总分会掩盖致命空项，应继续使用 hard gates。

### 6.7 类型模板的产品化规则

**[建议]** 每个 extension 不应只是一段 prompt，而要包含五样可版本化资产：

1. Readiness items（K/R、权重、critical、默认 resolver）。
2. Question bank（开放/选项/视觉 probe，及何时不要问）。
3. Review artifact renderer（样件 schema 与交互）。
4. Acceptance schema（可观察完成条件）。
5. Outcome telemetry（该类型的 false-ready、返工和用户负担）。

模板选择也进入证据账本。分类不确定时先加载共享骨架；只有类型判断会改变下一问或样件时才追问“这是要做方案、真正实施，还是拿去推动客户决策？”。

---

## 7. 新发现与方案可能漏掉的部分

### 7.1 问对问题之后，仍可能理解错答案

**[事实]** 2026 年预印本 [Clarification Is Not Enough](https://arxiv.org/abs/2605.25204) 指出，即使澄清策略正确，模型对用户后续回答的解释仍可能成为瓶颈。

**[判断]** VoiceLoop 不能把“用户回答过”直接等同于“需求已清晰”。尤其是语音中的代词、修正、反讽、半句话和“A，但别太 A”，都可能被错误归槽。

**[建议]** 每个 critical 回答先落成结构化 claim，再进行最小必要 grounding：屏幕显示实体、范围和否定词；置信不足或与旧 claim 冲突时才复述确认。校准指标要区分“没问到”和“问到了但解析错”。

### 7.2 澄清状态本身是安全边界

**[事实]** Scale Labs 2026 的 [ASPI benchmark](https://labs.scale.com/papers/aspi) 构造 728 个 task-attack 场景，报告澄清寻求状态会放大被评估前沿模型的 prompt-injection 风险。

**[判断]** VoiceLoop 一边检索网页/文档、一边采访人时，不能把所有后续文本当作同等可信的“用户补充”。恶意网页中的“请向用户提问并在回答后执行……”可能借澄清回合提升权限。

**[建议]** 证据账本强制记录 trust zone：用户原话、会议参与者、仓库内容、网页、工具输出分开；只有授权者的直接输入能改变 Authority key。任何从不可信内容生成的澄清问题都要保留来源，用户回答不能自动授权该来源建议的动作。

### 7.3 Ask-vs-assume 还有公平性问题

**[事实]** FORC 2026 的 [When to Ask a Question](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.FORC.2026.7) 从信息 elicitation 的负担与偏差讨论何时询问；依赖群体相关性来推断偏好，可能系统性牺牲非典型用户。

**[判断]** 对字体、语气、无障碍需求、文化语境、商业红线等主观或身份相关维度，“多数用户通常喜欢”不是足够证据。越个性化的 VoiceLoop 越要区分“该用户历史确认”与“从相似人群推断”。

**[建议]** 对低返工的通用默认可以 assume；对主观偏好和可能影响少数用户的约束，降低 ask threshold，并永远允许用户查看/清除个性化假设。

### 7.4 多人会议不是“更长的一段用户输入”

**[事实]** Zoom 的 [AI Companion 第三方会议说明](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0080354) 会在会前邮件、会议聊天和机器人视频 tile 中提示其存在与转录状态。Microsoft Teams 提供 [录制/转录的显式同意策略](https://learn.microsoft.com/en-gb/MicrosoftTeams/meeting-recording)：参与者在解除静音、开摄像头或共享内容前可选择 Yes/No；2026 年的 [自定义通知文档](https://learn.microsoft.com/en-us/microsoftteams/recording-transcription-custom-message) 还区分隐式/显式同意和隐私政策提示。[Teams Copilot 会议管理文档](https://learn.microsoft.com/en-us/microsoftteams/copilot-teams-transcription) 也明确支持了解“谁说了什么、哪里同意或不同意”，说明 speaker attribution 与立场不是附属信息。

**[判断]** §4.21 的“会后单独开小会”很有价值，但最大的设计风险是 AI 把多人谈话压成一个伪共识，再把 owner 的私下偏好写成“会议决定”。此外，“所有人知道”不等于“所有人同意保存、训练、外发或让 owner 私下再利用”。

**[建议]** Meeting extension 至少增加：

- 会前：用途、是否转录/保存、保留期、谁能看、是否参与决策包，逐项可见；产品默认以最严格参与者同意为边界。
- 会中：持续可见的 AI 身份和状态；passive 默认；active 发言需主持人授权。
- 账本：每条 claim 带 speaker、role、timestamp、stance、confidence；同意、反对、未表态分开。
- 权力：明确 Decision Owner、Influencer、Contributor；只有 owner 能给内部执行授权，对外动作仍需相应权限。
- 会后私聊：包中分开 “会议明确达成”“AI 建议”“待验证”“owner 私下顾虑”；私下内容默认不回写共享纪要。
- 外发：在发送前给 audience-specific preview，自动移除不该共享的私密层。

### 7.5 漂亮的决策包可能成为新的“流畅性陷阱”

**[判断]** 人类监督研究显示用户会把计划、测试和目测当代理指标。VoiceLoop 越擅长生成完整、漂亮、可点击的包，用户越可能把表现流畅误认为事实完整。

**[建议]** 决策包强制提供 uncertainty affordance：

- “已证实 / 用户确认 / AI 推断 / 仍未知 / 存在冲突”视觉区分。
- 支持从每条结论点回原始证据。
- Demo 内的假数据和不工作的区域有持续标记，不能只在说明页脚写一次。
- 显示最可能让方案失败的 1–3 个假设，而不是只显示优势。
- 让用户能点“如果这个假设错了？”查看 plan delta 和回退。

### 7.6 决策包既是批准界面，也是长期记忆边界

**[判断]** 对话记忆适合积累偏好，但执行不应依赖一段不断被重写的“当前理解”。版本化决策包能同时解决三件事：用户知道批准了什么；执行 Agent 有稳定上下文；未来复盘能区分当时已知、后来发现与未经授权的扩展。

**[建议]** 长期记忆只保存可复用偏好和事实，并带来源/过期策略；项目承诺保存在 immutable package version。新对话可继承旧包，但必须生成 superseding version，不能静默修改原授权。

### 7.7 “认知负担从表达转移到审阅”也需要量化

**[判断]** 如果一个决策包有 12 页、5 个折叠面板和 40 个假设，VoiceLoop 只是把表达负担换成审阅负担。目标不是让用户少说，而是降低从意图到可靠决定的总成本。

**[建议]** 除了完成率，测量：用户总说话时长、主动纠正次数、Decision Card 首次拍板时间、展开详情比例、关键假设发现率、批准后重大修改量、后悔/回滚，以及用户能否复述 scope。对不同任务比较“纯对话”“先问”“先出样件”“双维门禁 + 决策包”，避免只看主观喜欢度。

---

## 8. 建议的 MVP 与实验顺序

### Phase 1：让双维决断可审计

- 先做共享 Readiness Ledger、critical gates、assumption provenance 和 package version。
- 只在 shadow mode 计算 Cₖ/Cᵣ 与 P(material_rework)，人工抽检 Ready/Not Ready。
- 开发、调研、设计各选一个 extension；先不覆盖所有类型。

### Phase 2：让 Demo 成为需求探针

- UI 项目接真实组件/fixture；调研做证据样章；设计做 contrastive variants。
- 记录用户在样件上的点击、批注、选择理由如何改变账本。
- A/B：只采访 vs 第 2–3 个问题后 preview-first；分别看 style 命中与总负担。

### Phase 3：校准 ask/assume 与轻确认

- 候选问题按 NetVOI 排序，默认三问 clarification episode。
- 比较 LLM 自评分、rubric gate、rubric + VOI 三组。
- 按风险层实验确认粒度；先只开放 R0/R1，验证 stop/undo，再触及外部动作。

### Phase 4：类型扩展与会议模式

- 营销和大客户接入来源/权限/外发硬门槛。
- 多人会议先做 passive + speaker ledger + 私聊包，不急于让 AI 主动插话。
- 完成同意、数据保留、受众分层和 authority model 后，再试 active mode。

**首要上线判据**不应是“用户觉得 AI 很聪明”，而应是：在不增加重大返工的前提下，用户表达时长与到拍板时间下降；false-ready 不高于现有流程；critical 假设和外部动作均可追溯。

---

## 9. 来源链接

以下来源均已在正文就近链接；这里按主题汇总，便于复核。检索截至 2026-07-22。

### 就绪、澄清与时机

1. [Ask or Assume? Uncertainty-Aware Multi-Agent Scaffold for Evidence-Grounded Task Completion（2026 预印本）](https://arxiv.org/html/2603.26233)
2. [Uncertainty-Aware Clarification with Information Gain（2026 预印本/论文页）](https://arxiv.org/html/2606.03135)
3. [AskBench: Benchmarking Clarification Behavior in LLM Assistants（2026 预印本）](https://arxiv.org/html/2602.11199)
4. [Ask Early, Ask Late, Ask Right: Clarification Timing in Agentic Systems（2026 预印本）](https://arxiv.org/html/2605.07937)
5. [Clarify When Necessary: Resolving Ambiguity Through Interaction with LMs（NAACL Findings 2025）](https://aclanthology.org/2025.findings-naacl.306/)
6. [Modeling Future Conversation Turns to Teach LLMs to Ask Clarifying Questions（ICLR 2025）](https://proceedings.iclr.cc/paper_files/paper/2025/hash/97e2df4bb8b2f1913657344a693166a2-Abstract-Conference.html)
7. [Ask or After? Clarification Timing and UX in Generative AI（UC Berkeley MIMS 2026，30 人项目）](https://www.ischool.berkeley.edu/programs/mims/projects/2026/ask-or-after-clarification-timing-and-user-experience-generative-ai)
8. [Clarification Is Not Enough（2026 预印本）](https://arxiv.org/abs/2605.25204)
9. [When to Ask a Question? Information Elicitation and Preference Inference（FORC 2026）](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.FORC.2026.7)

### 采访、语音与隐性需求

10. [Google Conversation Design: Learn about conversation](https://developers.google.com/assistant/conversation-design/learn-about-conversation)
11. [Google Conversation Design: Questions](https://developers.google.com/assistant/conversation-design/questions)
12. [Google Conversation Design: Commands](https://developers.google.com/assistant/conversation-design/commands)
13. [ReqElicitGym: Evaluating Requirement Elicitation in LLMs（2026 预印本）](https://arxiv.org/html/2602.18306)
14. [Dust: Agents can ask structured questions（2026-04）](https://docs.dust.tt/changelog/agents-can-now-ask-you-questions-to-clarify-their-next-steps)
15. [Superpowers: Brainstorming skill](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)
16. [Google Stitch 2026 updates](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/)

### 决策包、Demo-first 与规格链

17. [v0 Design Mode](https://v0.app/docs/design-mode)
18. [Replit: What changed from Agent 3 to Agent 4](https://replit.com/blog/whats-changed-agent3-to-agent4)
19. [Replit Plan Mode](https://docs.replit.com/references/agent/plan-mode)
20. [Bolt Plan/Discussion Mode](https://support.bolt.new/best-practices/discussion-mode)
21. [Bolt Version History and GitHub](https://support.bolt.new/concepts/version-history-github)
22. [GitHub Spec Kit](https://github.github.io/spec-kit/)
23. [Spec Kit: Spec Persistence](https://github.github.com/spec-kit/concepts/spec-persistence.html)
24. [Kiro Specs](https://kiro.dev/docs/web/specs/)
25. [Kiro Requirements-first Feature Specs](https://kiro.dev/docs/specs/feature-specs/requirements-first/)
26. [OpenAI Deep Research](https://help.openai.com/en/articles/10500283-deep-research)

### 信任、控制与安全

27. [Human Oversight of AI Coding Agents in Practice（2026 预印本）](https://arxiv.org/html/2606.05391)
28. [When Should Users Check AI? Confirmation Timing in Agentic AI（CHI 2026）](https://tail.cc.gatech.edu/publications/zhou-chi-2026/)
29. [Replit: Doubling Down on Secure Vibe Coding](https://replit.com/blog/doubling-down-on-our-commitment-to-secure-vibe-coding)
30. [ASPI: Agent Security Prompt Injection benchmark（2026）](https://labs.scale.com/papers/aspi)

### 类型模板与多人会议

31. [PRISMA 2020 Statement](https://www.prisma-statement.org/prisma-2020)
32. [PRISMA 2020 Checklist](https://www.prisma-statement.org/prisma-2020-checklist)
33. [American Marketing Association: Creative Brief Template](https://www.ama.org/toolkits/creative-brief-template/)
34. [MEDDPICC framework](https://meddpicc.com/)
35. [Salesforce: How to Create a Mutual Action Plan](https://www.salesforce.com/blog/sales/mutual-action-plan/)
36. [Zoom AI Companion in third-party meetings](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0080354)
37. [Microsoft Teams: Manage meeting recording and explicit consent](https://learn.microsoft.com/en-gb/MicrosoftTeams/meeting-recording)
38. [Microsoft Teams: Custom in-meeting recording/transcription notification（2026）](https://learn.microsoft.com/en-us/microsoftteams/recording-transcription-custom-message)
39. [Microsoft Teams: Manage Copilot in meetings and events（更新于 2026-07-09）](https://learn.microsoft.com/en-us/microsoftteams/copilot-teams-transcription)
