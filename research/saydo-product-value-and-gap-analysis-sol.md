# SayDo 核心价值假设、目标用户与实施前校准方案（SOL）

> 日期：2026-07-23
> 状态：分析与建议，**不是 owner 已批准决策，也不是 canonical 设计**
> 目的：在正式实施前，重新回答“为什么值得做、先为谁做、在哪些场景成立、哪些设计应保留/收缩/后移”，并给出可证伪的实施顺序。

## 0. 结论先行

### 0.1 总判断

**SayDo 值得继续，但当前最需要的不是再增加设计，而是先补产品证据。建议 owner 重裁当前“完整双路径首发”：先做 5–7 个工作日的探索实验，再用 2–4 周自然任务观察行为复用；若接受该重裁建议，证据通过后才把研究 slice 升为产品实施基线。**

按当前文档与历史评审，**本轮最值得验证的核心价值假设**不是“用语音写代码”，也不是“把 prompt 换成说话”，而是：

> **把人尚未整理成可委派合同、并可能持续变化的意图，通过对话变成一份可审计、可授权、可恢复、可验收的执行合同；把合同安全地委派给 agent；只在需要人判断时叫回；最后带着逐条证据回来。**

可以把这个新类别概括为：

> **对话驱动的可信委派控制面（conversation-to-accountable-delegation）。**

用户侧最短承诺是：

> **聊清楚，你确认，它去做；有事叫你；带证据回来。**

“语音”是重要入口和体验放大器，但尚未证明是独立壁垒。Cursor / Claude / Codex 等模型与 adapter 可在能力合同内替换；**Hopper 则是当前已批准的重执行控制边界，替换它属于架构迁移，不是普通 provider 切换。** 当前最可能形成复利的四层是：

1. **会不会问**：能否识别真正影响结果的缺口，而不是机械采访；
2. **何时该做**：能否校准 readiness，避免过早开工和无尽追问；
3. **到底批准了什么**：版本化意图、边界、验收标准和副作用合同；
4. **回来后是否容易判断**：按验收标准组织证据，验证能否降低 review 与返工成本。

### 0.2 当前最关键的错位

当前文档对安全、幂等、恢复、记忆删除、模型供给和跨系统合同的推演非常深入，这些工作大多是正确的；但实施顺序优先证明了“系统能否完整运行”，没有先证明：

> **开放对话能否比用户现有的 Cursor / Codex / Claude 工作流，更少占用主动注意力，并产生更少返工的可验收结果。**

当前正式计划有大量工程验收，却没有产品价值对照、留存/复用、主动人类分钟、first-pass acceptance、review time 等退出线。本地检查仅在 `docs/04` 找到 readiness 的 false-ready shadow 校准，没有找到 PMF、对照实验或核心 outcome 门禁。此前独立红队已经明确提出同一核心实验，但后续文档主要吸收了安全合同，未把验证顺序吸收到实施计划（`research/codex-findings/01-architecture-redteam.md:719-805`）。

因此，项目当前状态更准确的表述是：

> **设计与合同准备度高；工程开工仍待 Phase -1；产品价值验证是否前置尚待 owner 裁决。**

### 0.3 建议的战略动作

1. **不要废弃现有设计。** 把它视为“通过价值验证后的可靠性蓝图”，而不是第一天全部实现的 backlog。
2. **拆出 V-1 实验前置。** 先准备真实 repo、一个可用 agent 和计时/记录模板；完整工程 Phase -1 不必全部前置。
3. **先跑三层证据轨。** 5–7 日探索、2–4 周行为复用、独立 readiness/safety replay，三者不混成一个小样本 Gate。
4. **研究 slice 只保留一个用户画像、一个 coding 任务域、H1/H2 两个预注册任务层、一个 adapter 候选、单并发任务。**
5. **把 review/acceptance 提升为与采访/决策包同等重要的半边产品。**
6. **把 voice、screen、text 的范围作为 owner 重裁项。** 当前 v2.3 已明确纯文字是 P0 非目标；本报告建议做 intake 消融，但不把文字侧通道冒充现行范围。
7. **证据回来后，再重裁“Tier 1 + Hopper + 直达验收 + Demo 生成器”是否仍需同次首发。**

---

## 1. 阅读范围与证据口径

本轮先程序化建立初始文档清单，再完整阅读当时项目自有的 93 个 Markdown / HTML / TOML 文档型文件，覆盖：

- 根目录入口、交接和实施计划；
- `docs/01–10` 与 ADR；
- `research/` 的调研、业务流、9 轮 Codex 报告及其 prompts、spike 结论；
- `history/` 的过程日志、旧主方案和全部场景基线；
- `archive/` 的历史快照；
- 配置模板、品牌说明与当前 Demo HTML。

归档中与当前文件完全相同的副本用 SHA-256 对照确认，没有把同一内容重复计作新证据；归档中的独有旧文件另行阅读。第三方 `node_modules` 文档、原始运行日志和二进制图片不属于项目设计文档，未作为产品判断输入。`demo/saydo-console-demo.html` 已用本机 headless Chrome 实际渲染并检查首页。

事实与判断分开：

- **文档事实**：当前文件真实写明的状态、范围、合同或历史裁决；
- **分析判断**：本报告基于这些事实作出的产品推断；
- **待验证假设**：必须通过真实任务或用户行为回答，不能被文档完整度替代。

本目录不是 Git worktree，本轮无法提供分支、commit 或 `git diff` 证据；所有交付以文件内容、行号、校验命令为准。

> **并发更新说明**：初稿评审期间，canonical 与 Demo 被另一并发工作流更新到 `IMPLEMENTATION-PLAN.md` v2.3；本轮两名 subagent 与 Codex 10 均为只读。最终报告已在评审结束后重新读取当前磁盘快照，并以 2026-07-23 23:08 后的现状为准；没有覆盖这些并发更新。

最终复核时，另一并发工作流又新增了 `saydo-value-gaps-review.cursor.md` 并在 journal 写入 R28。本轮也完整阅读了这份新增报告，并逐条回到 v2.3、当前 `docs/09`、spike 原件和本机路径核验；只吸收在当前快照仍成立的发现。该报告基于较早快照的 `docs/03`、验收返工话术、11 页裁剪等结论已被后续 canonical 或 owner 裁决改变，未照抄。

---

## 2. SayDo 的核心价值假设

### 2.1 最值得验证的购买理由是“少操心”，不是语音本身

对目标用户而言，打字本身通常不是最大成本。真正昂贵的是：

- 想清楚该怎么描述；
- 判断 agent 是否理解对了；
- 反复补上下文和纠偏；
- 一直盯着执行，怕它卡住或越权；
- 最后从 diff、日志、测试和口头总结中判断是否真的可收。

本轮提出的价值函数假设是：

```text
共同主门 A = 全部预注册 eligible attempts 的 verified outcome rate
共同主门 B = 全部 eligible attempts 的主动人类分钟总和
             ÷ 独立验收通过的结果数

净价值还要扣除首次配置、奠基、采访、审批、operator 人工和 review 成本，
并由自然任务中的复用频率验证。
```

这也解释了两件事：

1. 一个语音对话很顺，但 review 更慢，产品仍然是负价值；
2. 一个基础设施很可靠，但用户每月只遇到一次适用任务，也难形成产品。

建议把北极星定义成一对共同主门，而不是只统计成功样本：

> **verified outcome rate 不劣于基线；同时，每个 verified outcome 消耗的全体主动人类分钟低于基线。**

失败、放弃、超时、未验收和返工任务的时间全部进入分子；若没有 verified outcome，结果视为不可通过。质量、安全和验收是共同硬门，不能由“问得更少”或“review 更快”抵消。

### 2.2 最有价值的 JTBD

第一条核心 Job-to-be-Done 不是“当我说一句需求时，替我写代码”，而是：

> **当我只有一个不完整想法、没有精力把它整理成 prompt，也不想持续盯着 agent 时，帮我识别关键缺口、形成我敢批准的任务、在边界内执行，并把结果整理到我能快速判断的程度。**

这个 JTBD 有四个连续阶段：

```text
模糊意图
  → 可批准的执行合同
  → 可中断/可恢复的异步执行
  → 按验收标准组织的交付证据
```

其中任何一段缺失，价值都会塌掉：

- 只有采访：是高级需求整理器；
- 只有执行：是另一个 coding agent；
- 只有通知：是 agent 遥控器；
- 只有语音：是语音输入层；
- 没有 review：把认知负担从表达阶段推迟到交付阶段。

还要保留第二条独立 JTBD：**需求已经较清楚，但执行会持续 30–90 分钟，用户想离开并在卡住或可验收时再回来。** 这条价值主要来自异步执行、回叫和 review，而不是采访；实验必须分层报告，不能只挑对采访最有利的模糊任务。

### 2.3 语音的正确角色

语音真正擅长的是：

- 用户边想边说、信息尚未结构化；
- 人仍在电脑附近但手被占用、不想打字，或在沙发/会议间隙；
- AI 一次一问，用户做短判断；
- blocked、风险和结果摘要的主动回叫；
- 对某条决策或证据继续追问。

语音不擅长的是：

- 精确符号、路径、命令、数字和长列表；
- 安静办公室、共享空间和敏感会议；
- 大段 diff、日志、引用和证据比较；
- 不可逆审批；
- 用户已经有一段完整文本可直接粘贴时。

因此正确产品原则应是：

> **语音负责思考、澄清、选择和摘要；屏幕负责精确、比较、证据和强确认；文字适合粘贴、修正和不便出声时继续。**

当前文档已经坚持“口播短、细节上屏”和 PTT，这是正确底座；完整文字侧通道只在“连续误听后敲一个词”出现，P0 总验收要求除 S3 和开麦外不碰键盘（`docs/05-roadmap.md:86`、`IMPLEMENTATION-PLAN.md:117`）。**v2.3 又明确把纯文字列为 P0 非目标**（`IMPLEMENTATION-PLAN.md:3`、`docs/05-roadmap.md:89`）。因此，text side channel 是本报告建议 owner 重裁的实验变量，不是可直接修正的“遗漏”。

### 2.4 真正可能形成壁垒的资产

| 层 | 可积累资产 | 为什么有复利 | 当前状态 |
|---|---|---|---|
| 采访策略 | 哪类任务该问什么、哪问是多余的 | 真实任务越多，问题选择越准 | 有结构设计，无真实任务数据 |
| Readiness 校准 | 不同风险/任务下何时该 propose | 可形成按任务类型校准的独有数据集 | 有评估器与 shadow 设计，无 corpus 基线 |
| 可信项目记忆 | 已批准决定、约束、历史结果及其来源 | 重复项目中减少重新解释 | 合同很完整，净收益未验证 |
| 委派合同 | intent → package → receipt → result 的 adapter 无关链 | 可跨 Cursor/Codex/Claude；Hopper 是另一执行边界 | 设计强，但当前存在 route/adapter 枚举漂移 |
| Review attention | 哪些证据能让人最快发现严重偏差 | 直接决定信任与复用 | canonical 已认定为 P0 瓶颈，结果合同与验错实验仍不足 |

语音 provider、模型 provider、通知和执行 adapter 都可替换。不要把“接了更多 agent”误当作护城河。

---

## 3. 潜在用户：先为谁做

### 3.1 首发滩头用户

最适合的首发用户不是泛化的“CEO”或“不懂技术的人”，而是：

> **已经高频使用 AI agent、能判断代码结果、同时承担需求取舍与交付责任的技术型项目 owner。**

典型画像：

- 独立开发者、技术型创始人、Staff/Senior IC、小团队 engineering lead；
- 同时维护 1–10 个持续演进的 repo；
- 每周反复遇到两类中等规模改动：有少量真实取舍的模糊任务，或需求清楚但会执行较久、希望切走注意力的任务；
- 已有 Cursor / Codex / Claude 订阅和本地开发环境；
- 能看懂 diff、测试、风险和验收证据；
- 经常需要切换注意力，不愿陪 agent 全程；
- 愿意为本地 daemon、工作区权限和一次性奠基承担少量设置成本。

选择这群人的原因不是他们更容易讨好，而是他们同时具备四项必要条件：

1. 模糊中型或清晰耗时型委派高频发生；
2. 结果质量可以由本人可靠验收；
3. 现有 agent workflow 足够成熟，能形成真实对照基线；
4. 至少有一个熟悉、测试健康、可机械验收且无外部副作用的 brownfield repo。

### 3.2 三个相邻用户群

| 用户群 | 潜在价值 | 进入条件 | 建议阶段 |
|---|---|---|---|
| 小型工程团队负责人 | 多任务回叫、统一合同、跨 agent 治理 | 多用户身份、团队权限、共享 review、审计保留 | P1/P2 |
| 产品负责人 / 非技术创始人 | 先聊透，再产出开工文档并监督实施 | 领域模板、独立执行/评估、无需本人懂代码的 acceptance oracle | P3 |
| 调研、营销、客户准备等知识工作者 | 对话变成方案与交付物 | 每类 executor、引用验证、外部发送审批、质量基准 | P2/P3 |

当前 `docs/02` 已把 engineering 设为 P0、非开发项目设为 P2/P3，这是正确分期；但 Demo 首页同时展示 coding 与“Q3 出海营销”，会在首发心智中重新放大泛化承诺。

另可保留一个语音刚需研究 cohort：RSI、视力疲劳、行动不便或经常双手被占用的技术用户。当前 owner 已把无障碍/纯文字定为 P0 非目标，本报告不据此扩大实现范围，只建议后续用户研究不要漏掉“语音是必要入口”而非便利入口的人群。

### 3.3 暂时不应作为首发用户

- **不能独立 review 代码的人**：系统还没有足够强的独立验收 oracle 替他承担责任；
- **只做一次性小任务的人**：奠基、采访和配置成本无法摊薄；
- **事故响应/on-call 用户**：默认采访和奠基会延误恢复；
- **大企业多人协作团队**：身份、权限、合规、共享状态不是 P0；
- **高度敏感或必须全离线的场景**：当前云 ASR/TTS 和多 provider 路径不匹配；
- **希望“一句话全自动上线”的用户**：S3、部署、对外动作和长 workflow 都还不是当前可信能力。

---

## 4. 场景组合：在哪些时刻成立

### 4.1 研究 slice 必须区分的六个场景

| 优先级 | 场景 | 用户真实触发 | SayDo 独特价值 | 成立条件 |
|---:|---|---|---|---|
| 1 | 熟悉 repo 的模糊中型改动 | “导出功能该做了，大概像上次那个” | 少写 prompt，AI 找关键缺口，形成可签合同 | 采访短、能引用 live repo 事实、包可快速改 |
| 2 | 清晰但耗时的中型改动 | issue 已清楚，但 agent 会跑 30–90 分钟 | 少盯执行，卡住/可验收才回来 | Quick 不强行采访；durable 状态与可靠回叫 |
| 3 | 电脑附近、手被占用时收拢想法 | 沙发上或手边在做别的事 | 语音把散乱想法沉淀成可继续的任务 | 桌面 PTT、短问答、不会误派发 |
| 4 | 派发后切走注意力 | 用户要去开会或做另一件事 | 任务长命、会话短命；只有 blocked/风险/验收才叫 | durable 状态、可靠回叫、明确送达语义 |
| 5 | 结果回来后快速验收 | 用户不想重新读完整上下文 | 按 acceptance criterion 展示 pass/fail/unknown 和证据 | 独立 verify、未验证项诚实、关键偏差可见 |
| 6 | 同一项目反复协作 | 下周继续做相关功能 | 已批准决定与约束复用，少重复解释 | 4–6 周纵向观察；记忆可查看/纠正/删除 |

场景 1 验证采访/合同，场景 2 与 4 验证异步委派，场景 5 验证 review，场景 6 才能验证记忆复利。真正的走路/通勤场景需要手机采集入口；当前桌面 P0 无法把它列成 must-win，只可用一次性薄录音入口做 desirability 实验。

还应把“聊清楚后决定暂不派发”视为合法产出：咨询、梳理取舍、生成待办或沉淀决定，不应因没有 dispatch 被统计为失败。否则系统会为提高派单率而过早收敛，违背“不过早逼用户拍板”的设计哲学。实验中应单列“无派单但有经用户确认的有效沉淀”，同时防止用它替代 H1/H2 的 verified outcome 主门。

### 4.2 有价值，但不应进入首发关键路径

这是本报告从“提高产品假设可识别性”出发的重裁建议；当前 v2.3 已把其中 Hopper、直达验收、11 页控制台与 Demo 纳入同次首发，未经 owner 重拍不得据此裁剪。

- 重任务转 Hopper 并跨进程恢复；
- 直达验收档和 EffectGrant 预授权；
- 手机来电式回叫；
- 多 agent / 多 runner 动态选择；
- 通用 marketing / research / planning executor；
- 多项目全局控制台和团队级成本治理（**当前 v2.3 已由 owner 决定 P0 11 页全保留；此处仅是报告的重裁建议**）；
- S2S 自然对话、多人会议旁听。

这些能力可能最终都合理，但它们不能优先回答“用户是否更愿意用 SayDo 委派一件真实任务”。

### 4.3 明确不适合的任务

| 任务 | 为什么不适合 | 应有产品行为 |
|---|---|---|
| 一行改动、精确命令、已有完整 issue | 对话开销大于直接执行 | 已奠基项目走现有 Quick 兜底，不强行采访；纯文字仍是 P0 非目标 |
| 生产事故与紧急回滚 | 默认采访/首次奠基会延误，错误代价高 | P0 仅已奠基项目 Quick 兜底；专用事故车道按 owner 裁决留 P1 |
| 自动部署、付费、删除、对外发送 | 不可逆、身份与影响面复杂 | S3 屏幕强认证或明确拒绝 |
| 纯视觉“凭感觉调到好看” | 语音无法提供稳定视觉 ground truth | 强制截图/设计稿/视觉 diff |
| 大型陌生 monorepo 的泛泛想法 | 首次奠基成本高且可能研究错方向 | 不进入首轮实验；阻塞式奠基是否优于渐进式须另做 owner 批准的对照 |
| 用户无法判断交付是否正确 | 把风险转嫁给不具备验收能力的人 | 不承诺自主交付，要求领域 reviewer |

---

## 5. 当前缺口、不足与错误

### 5.1 A 级：实施前应先处理的产品缺口

#### A1. 缺少可证伪的价值门禁

当前计划把 Phase 0–5 的技术闭环估为 21–27 工程日，再把 Hopper 桥与直达验收估为 6–9 工程日（`IMPLEMENTATION-PLAN.md:47-148`）；这只是文档估算下限，明确不含合同回修、owner 场次和评审开销。验收覆盖合同、语音、记忆、执行、回叫、控制台和 Gate 0，但没有一项要求与用户当前 agent 工作流对照：

- 是否更快形成获批任务；
- 是否减少主动人类分钟；
- 是否减少 package 修改和执行返工；
- 是否更快、更可靠地验收；
- 用户下一次是否主动选择 SayDo。

这意味着计划即使全部“绿”，也只能证明软件按设计工作，不能证明设计创造了净价值。

**建议**：增加独立的产品证据轨；未通过时不得用“工程已经投入很多”作为继续展开双路径的理由。5–7 日只能做探索，不能单独承担 stop/go。

#### A2. 首发一次验证了太多假设

当前“完整双路径一次交付”同时引入：

- 实时级联语音；
- 项目奠基与可信记忆；
- 采访 + readiness + 决策包；
- Tier 1 交互执行；
- Hopper 跨域桥；
- 两档执行模式与预授权；
- durable callback / recovery；
- BYOA 与多模型槽位；
- 11 路由控制台和 Demo 生成器。

如果用户最后不复用，无法判断究竟是语音、采访、奠基、执行、review、配置成本还是任务选择出了问题。首发不是“更完整所以判断更准”，而是变量越多，因果越难识别。

**建议**：把“完整双路径 + Demo”保留为 owner 待重裁的发布目标；研究版本只使用一个 adapter 候选做受监督 concierge。Cursor CLI 当前只是审批门 spike 已通过，**完整 adapter 尚未验收**。

#### A3. Review 已被文档认定为瓶颈，但结果合同与验错实验仍不足

当前 canonical 已明确写出“review 是异步执行的真实瓶颈，不留 P1”（`docs/05-roadmap.md:84`），模块设计也已有 evidence view。缺口不是“项目没有认识到 review”，而是 criterion→evidence 的完整结果合同、严重错误检出实验、比较/返工体验在实施中仍明显弱于输入侧。项目红队指出移动执行与通知正在商品化，用户能否低成本发现错误才是关键差异（`research/codex-findings/01-architecture-redteam.md:66-70,783-797`）。

如果决策包是“委派合同的前半”，review card 就是同一合同的“履约对账后半”。两者应共享同一组 acceptance criteria，而不是执行后再生成一个漂亮摘要。

并发更新后的当前文档已经补了 `ready_for_review → running` 返工边与 #29b 返工话术（`docs/09-data-contracts.md:250`、`docs/10-voice-ux-spec.md:71`），这两项不再是缺口。但 `docs/09 §13` 仍没有 `reviewTask` / `retryTask` 一类 Brain 工具把“验收通过、请求修改、拒绝、部分接受”机械落到该状态机；`requestManualMerge` 也只写 watcher，没有定义人工合并 proof 如何合法推进 `task_done`。因此用户故事在 UI/话术层看似闭合，在工具面仍可能临场发明路径。

**建议**：

- 每条验收标准必须显示 `pass / fail / unknown`；
- 每个 `pass` 绑定独立来源、命令和证据；
- 单列“没有做 / 偏离了 / 未验证 / agent 自主决定”；
- review 动作至少有 `accept / request change / reject / open details`；
- request change 如构成 material change，生成新 package revision；
- 用植入错误实验验证 review 能否发现严重偏差。

#### A4. 阻塞式奠基存在 activation cliff，但这是 owner 已裁决假设

“新项目先研究透、奠基后再进入实质问答”对大型陌生 repo 有价值，但可能对小修、专家用户和空仓项目制造高等待成本。当前 owner 已明确裁决“首轮质量优先于即时响应”，首次奠基阻塞（`docs/04-key-mechanisms.md:22-27`）；已奠基项目另有 Quick 兜底（`docs/05-roadmap.md:87`）。历史红队仍建议实测 activation cliff（`research/codex-findings/01-architecture-redteam.md:101-105`）。

因此下表不是可直接回写的修复，而是建议 owner 批准一个对照实验：

| 车道 | 适用任务 | 先读什么 | 是否阻塞 |
|---|---|---|---|
| Quick | 目标明确、低风险、小改 | AGENTS、工作区状态、相关文件与 verify 模板 | 不阻塞完整奠基 |
| Guided | 中等模糊、熟悉 repo | 轻量项目摘要 + 针对性 live search | 只阻塞关键未知 |
| Explore | 大型陌生 repo、高影响决策 | 完整 Foundation Scan | 阻塞 propose，不阻塞用户先表达 |

若实验不通过，才考虑改为渐进式 grounding；在 owner 重裁前，现行阻塞语义不变。“学习中”仍必须告诉用户当前覆盖到哪里、哪些仍未知。

#### A5. Voice-first 的适用边界尚未被独立验证

P0 的“除 S3 与开麦外不碰键盘”是当前 owner 明确接受的体验目标，v2.3 又把纯文字设为 P0 非目标（`IMPLEMENTATION-PLAN.md:3`、`docs/05-roadmap.md:89`）。它不是文档错误，但仍是未经用户数据验证的产品假设；技术用户大量输入是路径、issue、错误日志、设计图、链接和半成品文字。

**建议**：不静默改范围；先在 concierge 做三臂 intake 消融：

1. 打字 + 原生 agent；
2. 普通语音转写 + 原生 agent；
3. SayDo 采访 + 合同循环。

若第三臂价值来自采访而非语音，或精确输入摩擦显著，再把完整文字侧通道作为 owner 重裁项。

#### A6. 产品承诺与首次设置成本不匹配

用户体验文案是“只管聊”，但当前 Phase -1 包含建仓、填多种 key、模型家族配对、CLI 登录态、ntfy、dogfood repo、音频底板等（`IMPLEMENTATION-PLAN.md:12-23`）。这对项目 owner 自用可接受，对外部首发用户是明显的激活断层。

**建议**：

- 内部 dogfood 可保留手工配置；
- 对外产品在验证后必须提供“一个推荐 profile + 自动探测 + 一次授权”；
- 高级 BYOA、五槽位、三方 endpoint 放入 Advanced；
- 首页不展示用户在第一次任务前不需要理解的 adapter、family、vault 和 Hopper 概念。

#### A7. “隔夜交活”承诺领先于当前任务模型

`docs/01-vision-and-problem.md:51` 仍以“睡觉，第二天早上交活”作为目标故事；当前可信闭环是单任务运行到 `ready_for_review`，而可靠多步 workflow、跨长时间恢复和移动验收仍未全部落地。项目自己的早期红队已指出单 run 与隔夜 workflow 的能力差距（`research/codex-findings/01-architecture-redteam.md:107-110`）。

**建议把承诺拆成三档，禁止混用**：

- **后台尝试**：用户可离开，卡住会叫；
- **给出可审阅成果**：到 `ready_for_review`，带验证证据；
- **经用户验收交付**：用户确认并完成 merge/归档后。

首发只承诺前两档。营销文案可说“离开到验收点”，不能暗示可靠完成任意隔夜 workflow。

#### A8. Readiness 机制先有精密结构，后补真实校准数据

当前设计已经有独立 evaluator、维度、critical gate、shadow 和版本记录，这是正确方向；但没有真实任务 corpus、提问收益、false-block 成本和不同任务类型阈值。过早把分数做成主 UI，会给用户和实现者一种不存在的精确感。

**建议**：

- P0 只显示“已覆盖 / 未知 / 有冲突”的关键缺口，不显示伪精确总分；
- 评估器先 shadow，不自动 propose；
- 用真实 package 被接受、小改、推翻的结果校准；
- 同时记录“多问这一问是否改变了合同”，把无效问题率作为核心指标。

#### A9. Cursor CLI 的审批门只证明了“能拦”，还没有证明“不可被绕过”

当前 spike 把 `.cursor/hooks.json` 与 `gate.sh` 写进任务 worktree，原件也确实位于 agent 可写目录；spike 只测试一条 shell 的 deny / allow / 阻塞，没有测试 agent 先用文件编辑工具改写或删除 gate，再发第二条 shell（`research/spikes/cursor-cli-tier1/RESULT.md:6-31` 与同目录原件）。此外，当前设计没有：

- 把 gate 实现与决策状态移到 agent 不可写的 daemon 私有目录；
- 每次 invocation 校验 gate digest；
- 发现 shell tool event 却没有对应 hook callback 时立即 cancel 的 canary；
- 记录并 pin `cursor-agent` 版本，版本变化后强制重跑门禁；
- 验证 `beforeReadFile` / `preToolUse`、内建网络工具、未知 tool event 与 gate 崩溃时的 fail-closed 行为。

这不是要否定 Cursor CLI，而是要把“物理前提 GO”与“无人值守 adapter GO”分开。建议把上述项目加入 selected-adapter conformance 和 Gate 0；未通过时只允许监督式研究。

#### A10. 本地控制面身份边界尚未形成合同

架构写明 Console 走 `http://localhost`，并有 HTTP/WS 页面与事件通道（`docs/03-architecture.md:48`、`docs/08-module-design.md:15`），但当前文档没有定义本地 capability token、Host/Origin allowlist、CSRF、防 DNS rebinding 或 WS 握手鉴权。尚无代码，不能断言已有漏洞；但若实现者只照现文搭 localhost API，恶意网页可能绕过语音审批直接调用 daemon 工具。

建议在首次出现 daemon HTTP/WS 面之前，把以下内容并入 G1：

- 每次启动生成或解封本地 capability token，页面和 WS 都校验；
- 固定 Host/Origin allowlist，拒绝跨站表单和非预期 WebSocket；
- 写操作使用不可猜 nonce / CSRF 约束；
- `confirmAndDispatch`、`approveAction`、S3 屏幕确认与 merge 的主体绑定测试；
- 恶意页面、DNS rebinding、重放和过期 token 的反例。

### 5.2 B 级：真实旅程中还会撞到的缺口

| 场景 | 当前缺口 | 建议 |
|---|---|---|
| 第二个任务到来 | P0 单队列，但没有明确的排队告知、位置和预计何时轮到 | 不扩多任务执行；先在 Dashboard 和话术中如实显示队列，并记录发生频率 |
| 问题预算耗尽仍未就绪 | 有“预算耗尽必停”，没有“补料 / 带假设出草案 / 暂存”收口合同 | 给用户三选一；任何接受的假设进入 package 并显式标注 |
| 第一次使用空白画布 | 现有话术偏向已有项目/会话，外部新用户缺最小引导 | 第二位外部用户前补 30–60 秒开场与项目选择，不做长表单 |
| 仅咨询、不派发 | 指标和主循环容易把它当失败或强推任务化 | 定义“经确认的咨询沉淀”结果，但不与 verified execution outcome 混分母 |
| P0 真正离席 | 逐步确认会在每个 S2/步骤边界叫人，手机通道又在后续 | dogfood 分单步/多步、S2 次数报告主动分钟；只承诺“可在电脑附近切走注意力” |
| 语言扩展 | 话术、golden、热词和评估 rubric 实质上是中文优先 | 把中文写成首发边界；国际化是话术/评测体系重做，不只是 UI 翻译 |

紧急车道、callback 聚合、纯文字/无障碍的分期已在 v2.3 由 owner 表态；它们是待验证或后续范围，不再列作“文档没回应”。

### 5.3 当前文档中的具体一致性错误

下表不是战略分歧，而是当前文件之间会直接误导实现的漂移，应在真正开工前修正：

| 级别 | 问题 | 当前证据 | 建议修正 |
|---|---|---|---|
| A | `TaskCard.route` 无法表达当前 dev 默认 Cursor CLI | `docs/09-data-contracts.md:221-235,380-386` 只允许 `tier1_claude_sdk / hopper`，`adapter` 又是可选自由字符串；计划 `IMPLEMENTATION-PLAN.md:101-103` 以 `cursor_cli` 为 dev 默认 | 用判别联合表达 `route=tier1 + adapter` 与 `route=hopper`；同步 TS、DDL conditional CHECK、恢复键和 route×mode×capability 反例 |
| A | selected adapter 的开工/停止规则互相冲突 | `IMPLEMENTATION-PLAN.md:53` 说 Cursor/Claude 任一成立即可；`:101` 与 v2.3 选 Cursor；`:158` 仍规定 Claude 任一能力失败即全停，`IMPL-PROMPT.md:17,47` 同时混用两者 | 4.0 与风险表改为 selected-adapter conformance suite；所有允许 adapter 都失败才停 |
| A | P0 已依赖的合同仍被 §14 标为未封闭 | `docs/09-data-contracts.md:624-635` 的 A2/A6/A8 仍未闭；计划 `IMPLEMENTATION-PLAN.md:81,103` 已使用 hard-forget 与最小 S2 barge-in | 明拆“P0 最小状态机/删除 proof”与“P0.5 完整扩展”，各自给 schema、validator、正反例和成熟度标签 |
| A | outbox 保证超出机制能力 | `docs/09-data-contracts.md:308-311` 同时写“至少一次 + dedupe”与“重复 ≤1 次”；发送成功、落状态前可连续崩溃多次 | 改为诚实的 at-least-once；接收端幂等、外呼 receipt/attempt ledger 或明确允许重复，不能承诺机械上界 |
| A | `MemoryEvent` 判别联合无法按当前 DDL 持久化 | TS 合同的 `forget_hard` 需要 `targets / targetDigests / generation / stores`，`invalidate` 需要 targets/reason；`memory_events` 表只有 claim/source/trust 等列（`docs/09-data-contracts.md:170-185,391-392`） | 加判别 payload 与 op 组合 CHECK，或增专列/job 表；给 `memoryGeneration` 持久落点并做崩溃重放 |
| A | 验收返工已补状态与话术，但 Brain 工具面仍断 | `ready_for_review → running` 与 #29b 已存在；§13 仍无 review verdict / retry 工具，`requestManualMerge` watcher 也没有 manual merge proof 的合法终态边（`docs/09-data-contracts.md:250-253,580-620`） | 定义 `reviewTask(verdict, comments, expectedAttempt/evidenceDigest)`、`retryTask` 与人工 merge proof；旧 attempt evidence 不得串到新 attempt |
| A | 取消后的同卡修订语义自相矛盾 | `cancel_settled → superseded` 同一行又说缺省 task 身份不变，且没有回到 queued/running 的边；confirmed/queued 也没有用户取消边（`docs/09-data-contracts.md:242-259`） | 拆为同卡新 revision/attempt 与显式换卡两条边；补排队取消和相应 receipt/proof |
| A | Phase -1 把未落地的 Hopper 副本写成已完成 | `IMPLEMENTATION-PLAN.md:20` 的 D 段把三元组写入“均已完成”，但本会话检查 `~/.saydo/hopper-dist`、`~/.saydo/hopper-vault` 均为 `MISSING` | 区分“裁决/路径已定”与“物理安装已完成”；路径存在、版本、build 和 vault init 进入 Phase -1 真实检查 |
| A | Cursor fail-closed 律在交接 prompt 丢了一条 | 计划 4.1 与 `docs/09 §11` 是四律；`IMPL-PROMPT.md:47` 仍写三律，漏“每条命令独立审批” | 交接 prompt 与 selected-adapter suite 对齐，加入第二条命令不得搭第一条 allow 的反例 |
| B | verify 白名单冻结了名字，没有冻结实现内容 | 当前允许 `package_script = "test"` 等登记模板（`docs/09-data-contracts.md:513-520`），但 agent 可改 worktree 内 `package.json` / `Justfile` 令验证恒绿或执行额外命令 | dispatch 时冻结解析后的 argv、脚本内容 digest 和执行环境；变化须 Plan Delta 或 fail closed |
| B | setup 可能先于任何审批执行供应链脚本 | 计划 4.1 直接做 worktree setup，现文未要求 `--ignore-scripts`、沙箱或 S2 presentation | 缺省禁 lifecycle scripts；确需执行时按 S2 显示 target/下游影响并签单次 receipt |
| B | 审批、callback 与 Tier 1 状态还有一组小型合同洞 | `respond` 无 outcome 出边；blocked/failed occurrenceKey 仍写未定义的 episode；#30 又绑定 Hopper event_id；outbox 缺 parked/subscription 触发；`tier1_runs` 有状态 CHECK 无转换表（`docs/09-data-contracts.md:135-166,296-311,415-427`；`docs/10-voice-ux-spec.md:72-77`） | 在 Phase 0 schema 冻结前一次收口词表、trigger/key、Tier1 blocked/failed proof、retry attempt 和状态转换 |
| B | Cursor 能力矩阵部分已修、部分仍旧 | `docs/03-architecture.md:106-117` 已修成 Cursor CLI Tier 1；但 `docs/07-tech-stack-decisions.md:26,221,256`、`docs/05-roadmap.md:78,93` 仍保留旧结论 | 统一 current capability matrix；区分“审批门物理 spike 通过”与“完整 adapter 验收通过” |
| B | ADR 的路径名仍硬编码 Claude SDK | `docs/adr/ADR-001-execution-layer.md:16-18` 写“路径一·Claude SDK 薄执行器” | 不静默改历史；追加日期 addendum 抽象成 Tier 1 路径，实质改决策则新建 superseding ADR |
| B | P0/P0.5 标签靠顶部横幅兜底，表内仍冲突 | `docs/10-voice-ux-spec.md:5,43,61-74` 与 `docs/08-module-design.md:5,47-56` 冲突；`docs/05-roadmap.md:74-86` 仍把直达验收写入 P0 | 逐行改真实阶段，不依赖“冲突时计划优先” |
| B | 工期仍有旧口径 | `docs/05-roadmap.md:74` 仍写 P0 2–3 周；计划 `IMPLEMENTATION-PLAN.md:148` 是 21–27 日下限，完整首发另加 P0.5 6–9 日 | `docs/05` 只保留当前滚动估算，并注明不含回修/owner/评审 |
| B | “实施就绪”状态偏乐观 | `README.md:10` 同时写实施就绪和 Phase -1 前置；`docs/09-data-contracts.md:624-635` 尚有当前路径相关硬卡 | 改成“设计/合同高准备度；工程待 Phase -1 与 enabled-path 硬卡”；Value Gate 仍标新建议 |
| C | TTS “定稿”与“定档 spike”措辞冲突 | `docs/07-tech-stack-decisions.md:23,71-81` 已定 seed-tts-2.0；`IMPLEMENTATION-PLAN.md:67` 又写 TTS 定档 | 改称 SLO/兼容性 smoke 与调参；未达门槛才重开选型 |
| B | Demo 的分期标记不足 | 当前总 banner 在 `demo/saydo-console-demo.html:281` 只说 P1/P2；marketing `:370`、直达验收 `:475`、S3 Touch ID `:604` 无 P2/P0.5/P1 就地徽标；Demo **没有** Hopper 字样 | 每个超出 P0 的元素就地标期；不要把总 banner 当逐元素标注 |
| B | 工具合同重复声明 | `docs/09-data-contracts.md:583,616-617` 两次声明 `issueDispatchReceipt` | 保留唯一 canonical 签名，其他章节引用，不复制 |

这些漂移也说明：在同一套文档里同时维持“愿景全景、首发全景、P0/P0.5 实现真相”已经开始超过顶部警告能控制的复杂度。

### 5.4 哪些是过度设计，哪些不是

#### 不是过度设计：应保留的可信底线

下列设计即使收窄 MVP 也不应删除：

- package revision / digest 与“所见/所闻即所签”；
- canonical intent、审批收据和结果之间的追溯链；
- worktree 隔离、verify 白名单和 independent acceptance oracle；
- secret / egress / 供应链边界；
- `run.completed`、`ready_for_review`、`task.done` 三态纪律；
- 异步任务的 durable 状态、崩溃对账和回叫去重；
- S3 不经语音放行；
- 对实际存储的数据提供查看、纠正、导出和删除。

这些不是“企业级装饰”，而是无人值守委派成立的最低信任条件。

#### 真正的过度设计：不是机制错，而是验证前做得太宽

| 当前设计 | 问题 | 建议 |
|---|---|---|
| Tier 1 + Hopper + 两档执行同次首发 | 同时验证两个执行域、跨域合同和预授权 | 研究 slice 只做一个 Tier 1 adapter 候选；另手工跑 2–3 个 Hopper 重任务探索臂 |
| 五模型槽位 + 多 CLI/API provider + family/cage 全矩阵 | 设置、测试和故障组合数先于用户价值 | 一个推荐 profile；只实现实际使用的 dialog/evaluator/dev 供给 |
| M0–M3 全景 + 多 store hard forget | 为尚未证明会被复用的数据启用过多长期记忆 | M3 会话、package/review/evidence 与 approved M1 决策必须保留；hard delete 覆盖所有实际启用 store，只后移未启用 store |
| 四维 readiness 分数与精细展示 | 没有 corpus 时精度不可证 | critical gaps + shadow evaluator；有数据再校准/展示分数 |
| 每个 DecisionPackage 都生成 Demo | 非 UI 任务价值低，且 Demo 会制造确认偏差 | UI/格式类任务才生成；其他任务用结果样张或 acceptance examples |
| 11 路由控制台、全局/项目双层 IA | 首次任务前暴露过多控制面 | **owner v2.3 已否决剪页**；若实验显示激活摩擦，再重裁默认导航/渐进展开，不把本报告当现行范围 |
| 完整成本表盘 | P0 真正需要的是熔断和可追溯，不是 dashboard | 先记账、封顶、任务页显示；跨项目表盘后移 |
| 通用项目类型与营销全流程 | 每类都有不同 executor 和验收 ground truth | P0 只开放 coding；其他类型不在首页制造可用错觉 |

“先做窄”不等于写一次性代码。稳定的 package、receipt、result、state 接口仍可从第一天保留；收窄的是启用的路由、存储和 UI，不是未来可扩展边界。

---

## 6. 建议后的产品定义

### 6.1 一句话定位

面向高频使用 AI agent 的技术型项目 owner，SayDo 是一个本地优先的可信委派助手：它通过语音与屏幕把意图聊成可批准的任务，让一个现有 agent 在隔离环境中执行，只在需要判断时叫你，并带着按验收标准整理的证据回来。文字 intake 是本报告建议验证的消融变量，当前不是 P0 承诺。

### 6.2 第一版只承诺三件事

1. **少写完整 prompt**：SayDo 只问会改变合同的问题；
2. **少盯执行**：派发后可以离开，卡住、越界或可验收时再叫；
3. **少花力气验收**：结果与原 acceptance criteria 逐条对账。

不承诺：

- 比所有 IDE agent 写代码更强；
- 任意模糊任务都能自主判断成熟；
- 任意项目都能隔夜完成；
- 不懂技术的人无需 reviewer 就能安全收代码；
- 一套通用流程同时适配 coding、营销、调研与企业协作。

### 6.3 建议的研究 / dogfood slice 边界

| 维度 | 研究 slice |
|---|---|
| 用户 | 单用户、技术型项目 owner |
| 项目 | 一个已配置、熟悉且测试健康的本地 coding repo；单并发任务 |
| 任务 | H1 模糊中型 + H2 清晰耗时中型；可机械验证、无生产外部副作用 |
| 输入 | 产品臂为 PTT 语音 + 屏幕；普通转写/文字只作实验对照 |
| 对话 | Quick / Guided 两车道；Explore 先做人工或后台实验 |
| 记忆 | M3 会话、package/review/evidence + 用户批准且带来源的 M1 决定；不做自动跨项目偏好 |
| 执行 | Cursor CLI 审批门 spike 已通过，完整 adapter 尚未验收；通过 selected-adapter conformance 后才能自治 dogfood |
| 安全 | 启用范围内 Gate 0 全部关闭，无 bypass；详见下文 |
| 可靠性 | durable run mapping、两阶段 dispatch、startup reconcile、settle/cancel proof、callback active dedupe、失败安全降级 |
| 回叫 | blocked / approval / failed / ready_for_review；桌面为主 |
| Review | acceptance-by-criterion、diff/test/decision/unknown、请求修改 |
| UI | owner v2.3 已决定 11 页全保留；研究只把默认任务旅程聚焦在五个状态，不删除页面 |

启用路径的最低 Gate 0 不能以后“再补”：

- 单用户、受控本地设备、PTT 窗口外音频不产生指令；不虚构声纹能力；
- daemon HTTP/WS capability token、Host/Origin/CSRF 与写操作主体绑定；不能把 localhost 当作身份；
- `turnRef → DecisionPackage@revision/digest → dispatch receipt → task/run/result` canonical intent 链；
- raw audio 默认不存，录音/转写分别同意；
- transcript、package、approved decision、索引和实际备份全部可硬删；未启用 store 才可后移；
- effect-based S0–S3，逐步确认档每个 S2 独立收据，material Plan Delta 重签；
- 活跃墙钟、回合数、API 成本三熔断与 delivery preflight；
- independent verify、worktree、secret/egress 和 S3 语音拒绝；
- selected adapter 的 gate 不在 agent 可写域，带 digest、版本 pin 与 callback canary；
- verify 冻结解析后的 argv / script digest；setup 缺省不运行 lifecycle scripts，确需执行按 S2 上浮；
- `Tier1SettleProof` 齐备后才允许 `ready_for_review` 与 callback。

### 6.4 主界面围绕五个用户状态，而不是后台模块

```text
① 正在聊
   ↓
② 等你批准这份任务
   ↓
③ 已派发，可离开
   ↓
④ 需要你做一个判断
   ↓
⑤ 带证据等你验收
```

任务、审批、通知、记忆、成本和 adapter 仍可有内部模块。owner 已决定 P0 不剪 11 页，因此本报告不再建议静默改 IA；只建议默认入口和视觉层级围绕这五个状态，避免用户为完成一次委派而先理解整个控制平面。

---

## 7. 三层证据轨：不要让一个小样本回答所有问题

### 7.1 三个分开的核心假设

至少分层回答：

1. **H1 · 采访/合同**：对有少量关键未知的任务，是否更快形成高质量可执行意图，并减少返工；
2. **H2 · 异步委派/review**：对已较清楚但执行耗时的任务，是否减少盯执行与验收的主动分钟；
3. **H3 · 记忆复利**：在同一 repo 重复协作 4–6 周后，是否减少重复解释而不增加 stale/错误召回。

共同底线是 verified outcome rate、安全和严重错误检出不劣于基线。不能把三个假设混成一个平均数，也不能用漂亮 Demo 或低 ASR 延迟代替。

### 7.2 V-1 · 实验前置

只准备：

- 一个真实 dogfood repo；
- 一个可工作的现有 agent；
- eligibility 与排除理由登记表；
- 主动人类分钟 / operator 分钟 / 机器成本 / 壁钟时间四套计时；
- 独立验收 rubric 与盲评流程；
- 不涉及任何真实生产外部副作用的实验边界。

这部分复用当前 Phase -1 的 repo、登录态和测试资产；新代码仓、完整 provider profile、CI、音频底板等工程前置可后置。Value Gate 不是“在 Phase -1 之前什么都不准备”。

### 7.3 E0 · 5–7 日探索性 desirability 实验

目标不是 Go/No-Go，而是验证流程、埋点、任务分层与最大失败模式。建议完成 6–10 个真实任务，全部自然机会先登记，再按规则纳入/排除：

- 熟悉、测试健康、可机械验收的 brownfield repo；
- 同时纳入 H1 模糊中型与 H2 清晰耗时中型，不强制“至少两个未知”；
- 预计 15–90 分钟总历时；每个自动 attempt 仍服从当前 45 分钟活跃熔断；
- 排除 flaky/no-test、secret-heavy/受监管、跨 repo、外部调研、生产副作用任务；
- 一行改动和大型重构是边界样本，不叫“负对照”。

concierge 流程：

1. PTT/录音或现成转写收集一次真实表达；
2. 由现有模型按采访 rubric 一次一问，必要时人工修正；
3. 生成精简 `DecisionPackage` 用户呈现卡（简称决策卡，不新增合同类型）；
4. 用户批准 revision；
5. 用已经可用的 Cursor CLI/Codex/Claude 手工派发到 worktree；
6. 由脚本与人工整理 result/evidence 用户呈现卡（简称验收卡）；
7. 模拟 blocked / ready_for_review 回叫；
8. 记录每次人工介入的 operator minutes、修改字段、原因，以及若不介入是否会误派发；
9. 结果由不知道分组的 reviewer 按统一 rubric 盲评。

在样本允许时加最小 intake 消融：

1. 打字 + 原生 agent；
2. 普通语音转写 + 原生 agent；
3. SayDo 采访 + 合同循环。

另可手工跑 2–3 个 Hopper 重任务探索臂，只回答重任务的注意力收益和恢复需求，不建设 bridge，也不据此否决或证明双路径。

E0 只输出配对差值、计数、区间、operator 占比和失败类型；**不得因为 6–10 个任务好看就宣称 PMF，也不得因为一周未复用就否决记忆。**

### 7.4 E1 · 2–4 周行为 Gate

根据 E0 方差预注册样本量、非劣界值和停止规则，再运行自然任务观察：

- 每一个 eligible opportunity 都登记，含不用 SayDo 的选择与排除原因；
- eligibility 冻结后，在用户内按 H1/H2、规模与风险分层分派，避免主观“配对”；
- 基线共同终点是“用户发出最终可执行意图的时刻”，不假设原生 agent 有 DecisionPackage；
- 3–5 位外部目标用户只能提供早期外部证据，不能“证明”产品成立；
- 安装本地 daemon、授权真实 repo、采用推荐 profile、替代哪个工具和付费/采购意愿一并记录；
- H3 记忆另延长到 4–6 周，记录重复解释分钟、有效 recall、stale/错误召回、纠正次数和删除后零召回。

### 7.5 E2 · 独立 readiness / safety / review Gate

自然低风险任务不能估计 `<1%` 高风险 false-ready，也不能用“刚好没出事故”证明安全。另建：

- ≥200 条按任务类型、风险、明确度分层的 replay corpus；
- 模糊 yes、改口、打断、错 revision、presentation 作废；
- secret/egress、恶意 package/hook、S2/S3、删除重放、kill -9 与 outbox 重放；
- 植入已知严重行为偏差、漏测和副作用的 review 样本；
- false-ready、严重错误检出和恢复指标报告置信区间。

普通 `<5%`、高风险 `<1%` 等建议线只属于这个扩样轨，并须以置信上界判定；不能从 20 个正常 live tasks 推断。

### 7.6 指标与通过规则

| 类别 | 指标 | 正确口径 | 用途 |
|---|---|---|---|
| 共同主门 A | verified outcome rate | 全部预注册 eligible attempts；独立验收 | 对基线非劣，界值在 E0 后预注册 |
| 共同主门 B | 主动人类分钟 / verified outcome | 所有 eligible attempts 的说/打字/判断/审批/review/失败/返工分钟进入分子 | 目标下降幅度在 E0 后预注册；建议 20–25% 仅作起点 |
| Dispatch | time-to-dispatch | 两组都从首次表达结束到最终可执行意图发出 | 比较流程摩擦 |
| 合同质量 | 盲评 rubric | scope/acceptance/risk/unknown 完整性，不要求基线已有 package | 诊断 H1 |
| 提问 | 实质问题收益 | 改变合同/风险/路径，或验证并消除 critical unknown | 防微调字段刷分 |
| 自动化 | operator minutes 与介入率 | 与用户分钟分列；记录无介入反事实 | 防 Wizard-of-Oz 买出结果 |
| Review | active minutes + 严重错误检出 | first-pass acceptance 只作辅指标 | 诊断 H2，不替代正确性 |
| 复用 | eligible opportunity 中自发选择率 | 第 2–4 周自然选择，含拒用理由 | 行为证据，不预先写伪精确阈值 |
| 咨询沉淀 | 无 dispatch 但经用户确认的决定/待办/不做结论 | 单列次数与复用，不计为 verified execution outcome | 防系统为派单率过早收敛 |
| 语音 | 三臂 intake 差值 | 纠错、完成率、隐私/场景退出原因 | 区分 voice 与 interview 治理价值 |
| 安全 | 错 revision / 越权 / false-complete / delete residual | replay、故障注入与审计链 | 全部为硬门，不与价值指标互相抵消 |

通过逻辑：

1. E0 只有“继续扩样 / 修改实验 / 明显不可用”结论，不宣称产品 Go；
2. E1 必须同时满足共同主门 A 与 B；合同、first-pass、review 不能替代主门；
3. E2 的 enabled-path 安全硬门全部通过；
4. 用户在自然任务中自发复用，并能指出被替代的旧行为；
5. 所有阈值、样本和排除规则在看 E1/E2 结果前预注册。

### 7.7 失败后的区分实验，而不是继续堆功能

| 观察结果 | 首选解释（不是单因果结论） | 下一步区分实验 |
|---|---|---|
| 采访快，但 package 仍大改 | rubric/readiness/任务选择至少一项失效 | 盲评问题收益与 package 缺口，再决定是否收缩成语音草稿 |
| package 好，但 review 更慢 | criterion→evidence 或 UI 可能是瓶颈 | 暂停语音扩展，做同结果不同 review surface 的对照 |
| 只在离开键盘时使用 | voice 入口可能强于控制面 | 与普通语音转写臂对照，再判断是否收缩成 voice intake transport |
| 只在同一 repo 重复使用 | 记忆复利可能是主价值 | 做 4–6 周 memory on/off 与 stale recall 对照 |
| 执行可靠但用户不复用 | 频率、设置或替代品切换成本可能不成立 | 访谈拒用机会；验证安装/授权/任务准入摩擦 |
| 用户愿复用但安全/恢复失败 | desirability 可能成立，工程门未过 | 继续 Gate 0 与可靠性，不扩大用户或承诺 |

---

## 8. 建议实施顺序

这里把“研究顺序”与“已批准的首发范围”分开。前者用于降低错误投入，后者仍以 `IMPLEMENTATION-PLAN.md` v2.3 为准；任何范围变化都必须由 owner 重新裁决。

### 8.1 先跑 E0 / E1 / E2，而不是把一周 dogfood 当最终价值门

- E0 用 5–7 日、6–10 个任务校验流程、埋点、operator 介入和最大失败模式；
- E1 用 2–4 周自然机会验证 H1/H2 的行为收益与自发复用；
- H3 记忆至少观察 4–6 周；
- E2 用扩样 replay corpus 独立验证 readiness、安全、恢复和 review 检错；
- E0 后、看 E1/E2 结果前，预注册样本、阈值、排除规则和停止规则。

这一步允许 concierge，但必须披露并计入 operator minutes；不能把人工救场伪装成产品能力。

### 8.2 S1 · 单路径研究 / dogfood slice

若 E0 没有暴露方向性失败，可先做一条受监督、可测量的研究闭环：

```text
PTT / screen
  → Quick / Guided interview
  → DecisionPackage 用户呈现
  → 权威审批 revision
  → 已选 Tier 1 adapter conformance
  → worktree + durable run mapping + two-phase dispatch
  → independent verify + Tier1SettleProof
  → 幂等 blocked / ready_for_review callback
  → result / evidence 用户呈现
  → request change / accept
```

这一 slice 不是“删掉安全机制的 MVP”。只要路径启用，下列 Gate 0 与可靠性能力就不能后置：

- 身份、PTT 激活边界、音频/转写同意与可撤回；
- canonical intent、revision/digest、权威审批与不可复用 receipt；
- 已启用数据存储中的真实删除、删除重放零残留；
- effect-based S0–S3、S2 receipt / Plan Delta、S3 拒绝、secret/egress；
- worktree 隔离、独立 verify、preflight、预算/尝试熔断与无旁路；
- daemon HTTP/WS 身份、Origin/CSRF/WS 握手反例；
- adapter gate 完整性、版本 pin/canary、冻结后的 verify argv/script digest 与 setup lifecycle-script 规则；
- Tier 1 journal、任务与 run 的持久映射、two-phase dispatch、启动 reconciliation；
- `Tier1SettleProof`、callback outbox active dedupe、取消冻结、重放与恢复；
- resume 失败时进入明确的 `blocked` 或新 session，不能静默假装续跑；
- result 与批准 revision/digest 的绑定，以及按 acceptance criterion 的证据对账。

Cursor CLI 当前只证明“可通过 hook 拦截并审批部分 tool call”的物理前提，尚未证明完整 adapter conformance。进入无人值守 dogfood 前，至少要补：

- 多步骤执行和每命令 nonce；
- gate 文件不可写、每 run digest 校验、CLI 版本变化重测、hook callback canary；
- setup / push / 外部副作用拦截；
- setup lifecycle scripts 缺省禁用或独立 S2 授权，verify argv / script digest 不可由被验代码自改；
- `beforeReadFile` / `preToolUse` 与内建网络工具的真实能力边界；
- unknown event fail closed；
- cancel / resume / crash reconciliation；
- settle proof 与重复 callback；
- secret / egress / 权限绕过测试。

未通过时可以继续有明确人工值守的 concierge 研究，不能对外承诺“离开也可控”。

### 8.3 S2 · 扩大可靠性与重复使用

S1 产生自然复用后，再扩大而不是首次补齐基础恢复：

- 扩展 kill -9、数据库/队列故障、乱序/重复事件和 cancel race 矩阵；
- 增加多个真实项目、安装路径和推荐 profile；
- 用 4–6 周检验 approved decision memory 的收益、污染、过期和 hard-forget；
- 扩展 readiness corpus、shadow 校准、问题收益和严重错误检出；
- 仅按真实任务需要增加最小跨项目总览。

### 8.4 S3 · Hopper、直达验收与完整 Demo

Hopper 是已批准的重执行控制边界，不是普通 provider。若 owner 重新采用证据驱动的研究顺序，可在以下证据出现后建设完整跨域路径：

- Tier 1 确实承载不了一批高价值重任务；
- “离开更久”在自然机会中高频出现；
- Hopper 的已有恢复能力显著优于继续扩建 Tier 1；
- 逐步确认的打扰已成为主要流失点，且直达验收有可测收益；
- `EffectGrant`、inbox/outbox、settle barrier 的额外复杂度有相称收益。

当前 v2.3 已明确首发保留双路径、全部 11 个 Console 页面与 Demo 真实功能，因此本节是需要 owner 重拍的研究建议，不是已生效的 scope cut。

### 8.5 S4 · 新用户与新载体

按证据只选一条扩展：

- 手机采集 + 桌面执行；
- 小团队共享 review；
- 非技术 planning；
- research / marketing executor；
- 平台化 voice / intake API。

每扩一个场景，都要重新定义 acceptance oracle、权限主体和失败成本；不能只换项目类型模板。真正走路/通勤的完整会话需要移动端或电话载体，当前桌面 PTT 只能覆盖“人在电脑附近、手暂时不便”的场景。

### 8.6 与当前 owner 裁决的关系

本报告不静默覆盖 v2.3。当前已决事项包括：

- P0 使用完整双路径并保留 11 个 Console 页面；
- blocking foundation 是既定前置；
- 纯文字 / 无键盘可用性不是 P0 目标，但架构不封死；
- 紧急车道与 callback 聚合在 P1，P0 使用现有 fallback。

若接受本报告的证据顺序，owner 需要明确选择：

1. **研究优先**：把 S1 定义为研究 / dogfood slice，E1/E2 通过后再重拍完整发布范围；
2. **保持 v2.3**：继续完整 P0，但把 E0/E1/E2 作为独立产品证据轨；不得因工程完成自动判定价值成立或自动进入 P0.5。

同时还需分别重拍 foundation 时序、纯文字侧信道、11 页面信息架构和 Demo 范围；它们不能被“单路径研究”四个字打包改掉。

---

## 9. 核心产品 UI 应呈现一对 canonical 合同

### 9.1 委派前：`DecisionPackage` 的用户呈现（决策卡）

首屏只展示用户做决定需要的信息：

- 想得到什么；
- in scope / out of scope；
- acceptance criteria；
- 关键假设与未知；
- 计划及人机分工；
- 会发生的副作用；
- 预算/时间熔断；
- 执行车道；
- revision 与“批准后变更会重签”的说明。

“决策卡”只是 UI 名称，不新增平行于 `DecisionPackage` 的合同对象。

### 9.2 委派后：result / evidence 的用户呈现（验收卡）

必须与批准的 `DecisionPackage` 一一对账：

| 批准的 `DecisionPackage` | result / evidence 用户呈现 |
|---|---|
| outcome | 实际得到的成果 |
| acceptance criterion | pass / fail / unknown + evidence |
| scope | 做了什么 / 没做什么 / 越界检查 |
| assumptions | 哪些被证实、推翻或仍未知 |
| plan | 实际执行轨迹和偏离 |
| human/AI ownership | 哪些决定由 agent 自主作出 |
| effects | 实际 effect receipt |
| budget | time/cost/attempt actual |
| package revision | result 绑定的 revision/digest |

材料性变更必须生成新 revision、重新审批并签发新 receipt；旧 package、旧 result 和旧 evidence 保留为不可变历史，不可把新结果覆盖绑定到旧批准。验收卡同样只是 canonical result/evidence 的 UI surface。

这对呈现是 SayDo 的核心 UI。采访、语音、记忆和执行 adapter 都服务于它们。

### 9.3 “问得好”的机械定义

一个采访问题只有在至少满足一项时才值得问：

- 回答会改变 outcome；
- 会改变 scope 或 acceptance；
- 会改变风险/授权级别；
- 会改变执行路径或所需人工配合；
- 能消除一个阻塞 propose 的 critical unknown。

否则应从用户问题预算中删除。这个定义比“AI 像播客主持人”更适合写进可测试的产品策略。

---

## 10. 产品形态与潜在商业路径

同一技术骨架可走三种产品形态，但证据要求不同：

| 形态 | 购买者/用户 | 购买理由 | 当前匹配度 |
|---|---|---|---|
| 个人本地工具 | AI-native 技术 owner | 节省主动注意力、复用订阅、可信异步委派 | **最高，先验证** |
| 团队治理产品 | eng lead / 平台团队 | 统一合同、权限、审计、跨 agent review | 中期；需多人和组织能力 |
| Hopper/OctoDesk 插件 | 现有执行平台用户/内部生态 | 语音 intake、决策包、回叫 transport | 核心价值未独立成立时的合理收缩路径 |

即使外部 PMF 不成立，项目仍有三项真实但不同性质的保底价值：owner 的个人生产力工具、Hopper/OctoDesk 生态的首个治理型消费端、以及可复用的 intent/package/receipt/result 安全合同资产。它们足以解释“为什么值得做一条研究 slice”，但不能拿来证明“为什么值得做一个完整外部产品”；两套账必须分开。

建议先把 SayDo 当作 owner 自己每天愿意用的个人产品，而不是提前定义为通用项目协作平台。外部 3–5 位同画像用户主动复用只能形成早期外部证据；要排除“为一个复杂个人工作流定制”的解释，还需更长的自然机会记录、安装/授权行为和扩大样本。

对个人用户，BYOA 是降低边际成本和采购阻力的加分项；但它不是用户第一次完成委派前应该理解的卖点。对团队用户，真正愿意付费的可能是审计、权限与 review，而不是语音本身。两类路径都应记录“愿否安装 daemon、授权真实 repo、采用推荐 profile、替代哪个现有工具、愿否付费/申请采购”，而不是只问主观喜欢程度。

---

## 11. 建议的 canonical 文档回写清单

本轮只产出分析报告，**没有修改 canonical 文档**。若 owner 批准本方案，建议按以下顺序回写：

### 11.1 无论战略是否批准都应修的硬漂移

1. `docs/09`：修 `route` / `adapter` schema 与 DDL CHECK，使 Cursor CLI 可表达；封闭 P0 已引用的 A2/A6/A8；把 outbox 的 at-least-once、active dedupe、重复可观测性和产品重复上界拆开；去掉重复的 `issueDispatchReceipt` 声明；
2. `docs/09`：补 `MemoryEvent` 的持久化判别、同卡修订/显式换卡转换、review/retry/manual-merge proof 工具、Tier1 状态表和 callback trigger/key；
3. `IMPLEMENTATION-PLAN.md`：把“任一 adapter 成立即可开工”、Phase 4 的 Claude 特定步骤、Cursor dev 默认和“Claude 失败即全停”统一为一个 selected-adapter conformance gate；
4. `IMPLEMENTATION-PLAN.md` / `docs/04` / `docs/09`：把 gate 防篡改、CLI 版本 pin/canary、本地 HTTP/WS 鉴权、冻结 verify 内容和 setup lifecycle-script 规则并入 enabled-path Gate 0；
5. `IMPLEMENTATION-PLAN.md`：把 Hopper 裁决完成与 `hopper-dist` / vault 物理落地分开；本机会话检查两路径当前均不存在；
6. `IMPL-PROMPT.md`：主循环不再先写 Claude SDK、末尾才改称 Cursor CLI 默认；三律补成四律；
7. `docs/07`、`docs/05`：清掉 Cursor 仍为 Tier 2 / “无法不用 Claude”的残留；`docs/03` 当前矩阵已更新，无需重复改；
8. ADR-001：用 addendum 或 superseding ADR 表达 `cursor_cli` Tier 1，并同步同卡修订/显式换卡语义；保留历史决策，不静默改写原文；
9. `docs/08`、`docs/10`：逐行修 P0/P0.5 分期；
10. `docs/05`：统一工期口径；
11. Demo：对 marketing、直达验收、S3 Touch ID 等超 P0 元素就地标期；当前 Demo 主体没有 `Hopper` 文案，不应按旧快照误改；
12. README：改成“设计/合同准备度高，工程开工仍待 Phase -1 与 enabled-path 硬门”，并更新仍写 v2.2 的索引文字。

### 11.2 owner 批准价值校准后再改

| 文档 | 回写内容 |
|---|---|
| `docs/01` | 真正价值、首发承诺三档、删除无条件“隔夜交活” |
| `docs/02` | 滩头用户、anti-scenarios；若 owner 重拍，再加入 text side channel / progressive grounding |
| `docs/04` | Value Gate、问题收益、北极星与 readiness 校准闭环 |
| `docs/05` | E0/E1/E2 证据轨；若 owner 重拍，再调整完整首发时序 |
| `docs/08` | canonical package/result 双呈现；11 页是否改变须 owner 重拍 |
| `IMPLEMENTATION-PLAN.md` | 加独立证据轨；只有 owner 改裁决后才变更发布范围 |
| `IMPL-PROMPT.md` | 加 selected-adapter conformance 与价值证据检查；是否改完整双路径承诺由 owner 决定 |
| `README.md` | 定位改为“对话驱动的可信委派控制面” |

不建议直接把本报告整段复制进 canonical；应按各文档职责做最小回写。

---

## 12. 需要 owner 拍板的决策

| 决策 | 推荐答案 | 不拍板的后果 |
|---|---|---|
| D1 产品类别 | 把“对话驱动的可信委派控制面”作为待验证定位，不再以输入形式定义产品 | 后续功能仍围绕 voice，而非用户 outcome |
| D2 滩头用户 | 熟悉健康 brownfield repo 的 AI-native 技术型项目 owner | CEO/营销/工程三条价值链继续混杂 |
| D3 证据设计 | 批准 E0 探索 + E1 行为 + E2 安全/review 三轨 | 一周 dogfood 会被误当成产品与安全证明 |
| D4 selected adapter | 先指定 Cursor CLI 研究路径，并以完整 conformance suite 决定能否无人值守；不是以一次 hook spike 代替 | 实施计划会在 Cursor / Claude 两套开工条件间摇摆 |
| D5 完整双路径与 Demo | 推荐先作为研究 slice；若保持 v2.3，则工程交付和价值 Gate 明确解耦 | 完整交付容易因沉没成本被误判为价值成立 |
| D6 产品载体 | E1 前不作长期绑定；用最薄本地壳或现有载体验证 | 过早在独立产品 / OctoDesk / 千手间做组织性投入 |
| D7 foundation 时序 | 当前决定是 P0 blocking；建议以 Quick vs blocking 的真实任务对照后再决定是否改 | 分析建议会被误当成已批准的渐进式 grounding |
| D8 纯文字 / 无键盘 | 当前决定是 P0 非目标；建议只把 text 作为受控 intake 消融侧信道，产品化需另批 | 无法识别语音增量，或反过来偷扩 P0 范围 |
| D9 Console IA | 当前决定保留 11 页；建议先验证五状态默认旅程，不等于删页 | “页面存在”与“主旅程清晰”继续混为一谈 |
| D10 Demo 生成器 | 当前决定为同次首发；建议明确它验证决策理解还是仅展示能力，并限定每任务生成成本 | Demo 容易成为昂贵的仪式或未经证实的承诺 |

此外还需 owner 在查看 E1/E2 结果前签字确认样本、排除规则、非劣界值、停止规则和安全置信上界。阈值可以在预注册时调整，不能看到结果后移动门柱。

---

## 13. 仍然未知、必须诚实保留的问题

本报告无法仅靠文档回答：

1. owner 自己是否每周真的有足够多适用任务；
2. H1 模糊任务与 H2 清晰耗时任务各自的自然频率和收益是否足够；
3. SayDo 的增量来自语音、采访策略、合同化，还是三者组合；
4. 语音采访相对打字 + 原生 agent、普通语音转写 + 原生 agent，能节省多少主动分钟；
5. 用户是否信任 AI 主动 propose，还是更愿意自己按“开始”；
6. 项目记忆的复用收益是否超过维护与污染成本；
7. result/evidence 呈现能否减少严重错误漏检，而不是只让总结更漂亮；
8. 外部用户是否愿意安装本地 daemon、授权 repo、采用推荐 profile；
9. 个人工具是否有付费意愿，还是只能作为 Hopper/OctoDesk 能力；
10. “离开到验收点”是否高频到值得为 durable control plane 付出完整复杂度。

这些不是继续写文档能消除的不确定性；必须由真实任务和真实选择回答。

---

## 14. 最终建议

SayDo 包含一个值得验证的产品假设。它不位于“语音”和“coding agent”的交集表面，而位于更深的一层：

> **人如何把尚未整理好的意图，低负担地变成一件敢于交出去、离开后仍可控、回来时容易验收的工作。**

当前项目已经把“可信、可追责、可恢复”想得很扎实；最大的风险不是安全机制太多，而是**工程完成度、用户价值和安全证明可能被合并成同一个“做完即可成立”的判断**。安全基元应随 enabled path 同步完成；执行路径和产品表面的宽度是否同次首发，则是 owner 已作出但仍可基于证据重拍的范围决策。

建议下一步：

1. 先修 route、selected adapter、MemoryEvent/返工/取消状态、A2/A6/A8、outbox，以及 gate 防篡改/本地 API 身份/verify 冻结等会让实施直接走歪或绕过授权的硬缺口；
2. 同时跑 E0，校准自然机会登记、三臂 intake、operator minutes 和盲评流程；
3. 用 E1 验证 H1/H2 的 verified outcome 与主动人类分钟，用 4–6 周单独验证 H3 记忆；
4. 用 E2 扩样验证 false-ready、恢复、删除和严重错误检出，不能用少量正常任务代替；
5. 把 `DecisionPackage` 与 result/evidence 做成一对 canonical 合同的核心呈现；
6. 由 owner 决定保持 v2.3 完整首发，还是把单 Tier 1 闭环改为研究 slice 后再恢复 Hopper、直达验收与 Demo。

一句话收口：

> **保留 enabled path 的安全深度；用独立证据证明 SayDo 真能省下注意力，再决定何时兑现完整平台宽度。**

---

## 附录 A · 关键本地证据索引

- 项目定位与两个故事：`docs/01-vision-and-problem.md:6-51`
- P0 用户与完整交互循环：`docs/02-product-definition.md:5-45`
- 当前 agent 能力矩阵：`docs/03-architecture.md:106-117`
- Readiness shadow 校准：`docs/04-key-mechanisms.md:68`
- 当前 P0/P0.5 与盲区裁决：`docs/05-roadmap.md:74-97`
- 当前 Cursor CLI Tier 1 正文与残留漂移：`docs/07-tech-stack-decisions.md:111-119,216-221,250-256`
- 模块与控制台范围：`docs/08-module-design.md:28-56,161-207`
- 记忆判别联合与 DDL：`docs/09-data-contracts.md:170-185,391-392`
- 状态、route、outbox、工具与未闭项：`docs/09-data-contracts.md:242-311,380-386,580-620,624-635`
- 语音分期与话术：`docs/10-voice-ux-spec.md:5-84`
- v2.3 owner 裁决、Tier 1 开工门与首发范围：`IMPLEMENTATION-PLAN.md:1-8,47-59,97-112,125-138`
- Tier 1 实施 prompt 的后端冲突：`IMPL-PROMPT.md:17-19,47`
- Cursor CLI spike 已证与未证边界：`research/spikes/cursor-cli-tier1/RESULT.md:6-31`、`research/spikes/cursor-cli-tier1/hooks.json`、`research/spikes/cursor-cli-tier1/hooks/gate.sh`
- 早期独立红队的核心实验与 MVP：`research/codex-findings/01-architecture-redteam.md:657-661,719-850`
- 并发全景评审（只吸收经当前快照复核仍成立项）：`saydo-value-gaps-review.cursor.md`
- 本轮独立 Codex 评审：`research/codex-findings/10-product-value-gap-sol-review.md`
- 当前 Demo 的全局分期提示与超 P0 元素：`demo/saydo-console-demo.html:281,370,475,604`

---

## 附录 B · 独立评审与 triage

按项目评审制度，本报告完成初稿后接受三路只读评审：

| 评审 | 总判 | 主要 A 级意见 | 本报告行动 |
|---|---|---|---|
| 产品价值 / 实验有效性 subagent | Conditional Go | 小样本不能验证 `<1%` false-ready；北极星幸存者偏差；H1/H2/H3 混合；桌面 PTT 不能承诺走路场景 | 拆 E0/E1/E2，改 intent-to-treat 双主门，分三类假设，移动场景后移 |
| 架构 / 一致性 subagent | Conditional Go | V1 不得后移 journal/reconcile/settle/callback；Gate 0 启用项不可缺；Cursor spike 不是完整 adapter；selected-adapter 规则冲突 | 把可靠性和 Gate 0 写入 S1，收窄 Cursor 结论，新增计划冲突 |
| Codex `gpt-5.6-sol`、reasoning max | Conditional Go | 同意上述两组硬伤；补充 owner 裁决不能被暗改、Hopper 类别、当前文档漂移和 UI 同义词问题 | 显式区分研究建议与 v2.3，补重裁项，统一 canonical 对象与证据表 |

初稿评审后新增的并发全景报告又提出执行侧安全与合同断链。本轮重新核验后：

- **采纳**：Cursor gate 可写/无 pin/canary、本地 HTTP/WS 身份未定义、verify 内容可自改、setup lifecycle scripts、MemoryEvent DDL、取消修订转换、Phase -1 Hopper 路径失实、三律漏一律；
- **部分采纳**：验收返工——当前 canonical 已补状态边与 #29b，只保留 Brain 工具和 manual merge proof 缺口；
- **不再成立**：`docs/03` 仍把 Cursor 固定 Tier 2、Demo 含 Hopper、11 页可直接裁剪、紧急车道/纯文字尚未表态等旧快照结论。

Codex prompt、原始日志与报告分别保存在：

- `research/codex-findings/prompts/10-product-value-gap-sol-review.md`
- `research/codex-findings/logs/10-product-value-gap-sol-review.log`
- `research/codex-findings/10-product-value-gap-sol-review.md`
