# 72 条模拟会话覆盖与自然度独立终审

- 评审日期：2026-08-26
- 评审对象：`research/customer-question-corpus/simulations/`
- 评审尺度：模拟使用数据，不按生产合同逐字验收；只有破坏用途的结构性问题进入 A 级
- 评审方式：直接审阅生成后的 12 个 sessions 与 12 个 fixtures，并用独立只读脚本复核；不以生成器声明或验证器绿灯代替内容判断

## 1. 结论

[pass] 本轮终审通过。A=0，B=3，C=3。

72 个会话的数量、领域、频率、源记录映射、输入模式、标签范围、场景范围和安全边界完整。逐条审阅后，72/72 个会话都至少有一轮会改变范围、证据层级、用户约束、授权状态或恢复路径的实质后续；没有整条会话仅靠“好的”“嗯”或同义复述凑轮次。10 个 F4 会话全部以 `refused_and_rescoped` 收口，17 个 S3/F4 会话均未伪造发送、付款、发布、部署或授权收据。未发现娱乐场景、真实凭据、个人联系方式或不可安全分发的数据。

存在三项非阻塞 B 级问题：部分静态 fixture 提前含有后续 USER 信息，四个失败变体与基线状态相同，以及 `SIM-OPS-05` 的结果摘要没有吸收已经确认的总价档。它们会降低个别回放对“何时知道什么”的辨别力，但没有让相关会话整体失去状态变化，也没有打开危险 effect，因此不升 A。

## 2. 范围与方法

已完整读取：

- `00-simulation-plan.md`、`01-schema.md`、`02-coverage.md`、`README.md`；
- `rebuild-simulations.mjs` 与 `validate-simulations.mjs`；
- `sessions/` 下全部 12 个领域文件，共 72 个会话；
- `fixtures/` 下全部 12 个领域文件，共 80 个事件；
- `questions/` 中 600 条源记录，用于独立核对 72 个映射条目的八个源字段。

独立程序化复核直接解析渲染后的 Markdown，而不是调用 `buildSpecs()`：

- `question_records=600 rendered_sessions=72 unique_sim=72 unique_corpus=72`
- `field_comparisons=576 mismatches=0`
- `session_blocks=72 user_turns=217 later_turns=145 fixture_events=80`
- `turn_fixture_refs=225 unique_referenced=80 unreferenced_fixture_events=0 rendered_crosscheck_errors=0`

其中 576 次字段比较为 72 条乘以频率、角色与情境、原问题、对应目的、档位、工具、上下文、能力/边界八个字段。人工审阅覆盖全部 72 条；程序化统计只用于防漏，不用抽样推断自然度。

生成器只做了只读代码审查，没有执行。原因是它会先删除并重写 `sessions/`、`fixtures/` 和 `02-coverage.md`（`rebuild-simulations.mjs:234-244`），而本轮明确禁止修改报告之外的文件。代码路径中未见随机数或当前时间参与渲染，但本报告不把这一静态观察写成“已实跑重建”。

## 3. 硬覆盖复核

| 检查项 | 实际 | 结论 | 证据 |
|---|---:|---|---|
| 会话数 / 领域数 / 每域 | 72 / 12 / 6 | [pass] | `02-coverage.md:7-10`；独立解析 72 个块 |
| H/M/L | 32/25/15 | [pass] | `02-coverage.md:10` |
| 每域频率 | 核心工作域 3/2/1；LRN/LIF/FAM 2/2/2；CAR 2/3/1 | [pass] | `02-coverage.md:22-33` |
| SIM 与 corpus 唯一性 | 72 / 72 | [pass] | 独立解析；八字段 576 次比较零不一致 |
| C/D/H/R/K/S/F | 所有规定档位均出现 | [pass] | `02-coverage.md:35-43` |
| CTX / USER / LIVE / `-` | 35 / 28 / 51 / 2 | [pass] | `02-coverage.md:11-14` |
| S3 或 F4 | 17 | [pass] | `02-coverage.md:15`；逐条安全复核 |
| LIF/FAM | 12 | [pass] | `02-coverage.md:16` |
| 生命周期九类 | 25/24/17/40/19/8/11/10/10 | [pass] | `02-coverage.md:47-57`，全部达到最低数 |
| fixture 对位 | 80 个事件，225 次轮次引用 | [pass] | 80 个事件全部被引用，locator/status 零错位 |
| 终态 | 五种合法非完成态 | [pass] | 26 draft、17 waiting、10 evidence、10 refused、9 review |

验证器会检查结构、源字段、locator、标签、敏感字面量及 S3/F4 禁止动作（`validate-simulations.mjs:36-147`），也核对 12 个 session/fixture 文件与覆盖统计（`validate-simulations.mjs:153-224`）。本报告另做内容审阅，因为验证器只要求“后续出现允许的 move”，并不判断该轮是否真的带来新状态（`validate-simulations.mjs:87-92`）。

## 4. 逐域全量审阅

| 领域 | H/M/L | 后续用户轮 | 有实质变化的会话 | 场景价值与变化类型 |
|---|---:|---:|---:|---|
| ENG | 3/2/1 | 13 | 6/6 | 修复状态、测试范围、事故证据、SSO 设计、CI 门禁、部署越权；覆盖纠正、续接、补充、确认与拒绝 |
| PRJ | 3/2/1 | 12 | 6/6 | 项目续接、供应依赖、范围边界、顾问会、实验、排期；撤回旧约束与决策权边界明确 |
| WRT | 3/2/1 | 12 | 6/6 | 长文、邮件、道歉、证据包、RFP、代写发布；作者归属、日期改口与不外发均有变化 |
| RES | 3/2/1 | 12 | 6/6 | 市场证据、学习判断、法律时间线、选项比较、实验复现、路线托管；来源权威和未知项清楚 |
| OPS | 3/2/1 | 12 | 6/6 | 关账、预算、邮箱、隐私请求、差旅、实体去重；确认与授权分开 |
| SAL | 3/2/1 | 12 | 6/6 | 演示、会后跟进、CRM、续约、合同红线、批量外联；发送与法律边界关闭 |
| MKT | 3/2/1 | 12 | 6/6 | 实验、培育邮件、落地页、联合活动、社区、敏感定向；无虚假收入承诺与隐私推断 |
| DAT | 3/2/1 | 12 | 6/6 | 埋点、预算差异、周报、cohort、隔离门、财务自动化；假设、现势与写路径分层 |
| LRN | 2/2/2 | 12 | 6/6 | 备考、提醒、文献、匿名问诊训练、练习、课程；学习目标和通知授权均可撤回 |
| LIF | 2/2/2 | 12 | 6/6 | 复诊准备、证件到期、搬家、身份门户、出行、账单；医疗、身份和支付边界安全 |
| CAR | 2/3/1 | 12 | 6/6 | 作品计划、催款、报价、薪酬、内容、求职；不虚构经历、不冒名投递 |
| FAM | 2/2/2 | 12 | 6/6 | 照护、学校、志愿排班、活动安全、家庭支持、共同决策；不改药、不代付、不公开敏感信息 |

这 12 个领域同时覆盖生产力、职业成长、个人事务和家庭协作；生活/家庭不是用工作场景简单换名。没有游戏、追剧、音乐、明星或陪伴闲聊。以 72 条“代表性回放”而非真实使用日志的定位看，未发现会造成整体失真的明显场景缺口。

## 5. 多轮状态变化与自然度

### 5.1 实质变化

[pass] 72/72 个会话至少有一轮实质后续。145 个后续用户轮的动作分布为：

- `confirm` 38；
- `supplement` 35；
- `correct` 27；
- `constraint_change` 22；
- `reject` 15；
- `resume` 8。

全量审阅时把“实质变化”限定为至少改变一个可观察维度：新增材料或事实、纠正事实层级、撤回旧约束、收缩范围、确认对象但不授权 effect、拒绝危险动作，或从失败点恢复。没有只回复“好的”“嗯”的轮次。B-01 所列会话存在 fixture 提前可见问题，但每条仍有其他新约束或授权变化，因此本轮不把整条会话判作虚假多轮。

### 5.2 文本自然度与重复

[pass] 后续轮总体接近日常工作对话。去标点后的长度为 8–47 个字符，中位数 20，均值 21.9；短句与带条件的完整句都有。145 条后续用户文本精确重复为 0。对 10,440 对后续文本做中文字符 trigram Jaccard 辅助检查，没有一对达到 0.4；该指标只用于发现近拷贝，最终判断仍来自逐条阅读。

[pass] 领域术语与角色匹配，例如 staging、quarantine、RFP、owner、V-07 等只出现在相应专业场景；用户原话没有普遍退化成 schema 或验收合同口吻。多数后续用“先别”“不要”“那你先”“还是”等自然承接词，且承接的对象不同。

### 5.3 工具、状态与 effect 闭合

[pass] 80 个 fixture 事件状态为 `ok=52 no_tool=9 conflict=7 partial=6 stale=4 empty=1 permission_denied=1`。基线状态之外，72 条还各自给出一个失败或扰动变体。所有 K0 用 `no_tool`，非 K0 没有只靠 `no_tool` 冒充工具执行。

[pass] 10 个 F4 会话为 `SIM-ENG/PRJ/WRT/RES/SAL/MKT/DAT/LIF/CAR/FAM-06`，全部终止于 `refused_and_rescoped`。其余 7 个 S3 会话停在 `waiting_for_user` 或 `draft_ready`，没有实际消费。敏感字面量扫描对 sessions/fixtures 中真实 URL、邮箱、本机路径、私钥、Bearer、API key 和明文 password 零命中。

## 6. A/B/C 发现

### A 级

[pass] A-0：未发现数量或映射错误、整条虚假多轮、导致代表性失真的明显场景缺口，或安全越界。A=0。

### B 级，非阻塞

[fail] B-01：至少 6 个会话的静态 fixture 在第 1 轮已经携带后续 USER 才补充或确认的精确信息，削弱了时间边界。

- `SIM-WRT-01` 明写草稿尚未提供并要求先索取（`sessions/03-writing-content.md:19,29-30`），但首轮绑定的 `author-rag` 已含 `industry 40%`（`fixtures/03-writing-content.md:18`），用户到第 2 轮才给该数字（`sessions/03-writing-content.md:35`）。
- `SIM-RES-05` 的失败日志尚未提供（`sessions/04-research-decision.md:322`），首轮 fixture 已含 `libx 1.4.2` 与 seed 17（`fixtures/04-research-decision.md:101-102`），用户到第 2 轮才给出（`sessions/04-research-decision.md:338`）。
- `SIM-OPS-05` 声明人员名单后续确认（`sessions/05-business-operations.md:320`），首轮 fixture 已含 A-01/A-02/A-03 与含税 18,600（`fixtures/05-business-operations.md:119-124`），用户分别到第 2、3 轮确认（`sessions/05-business-operations.md:336,343`）。
- `SIM-SAL-05` 声明红线由用户后续口述（`sessions/06-sales-customer-procurement.md:321`），首轮 fixture 已含两条 `userRedlines`（`fixtures/06-sales-customer-procurement.md:82-85`），用户到第 2 轮才给出（`sessions/06-sales-customer-procurement.md:337`）。
- `SIM-MKT-01` 声明旧实验设计尚未提供（`sessions/07-marketing-growth.md:18-20`），首轮 fixture 已含 `previousN: 220`（`fixtures/07-marketing-growth.md:17`），用户到第 2 轮才补充 n=220（`sessions/07-marketing-growth.md:35`）。
- `SIM-CAR-03` 声明 brief 尚未提供（`sessions/11-career-freelance.md:169`），市场 fixture 已含用户每周上限 10 小时（`fixtures/11-career-freelance.md:52`），用户到第 2 轮才提供（`sessions/11-career-freelance.md:185`）。

这些会话仍各自包含别的实质变化，例如作者归属、禁止升级、客户会时段、付款账期、停止规则或不外发，所以不判 A。修复方向：给 fixture 增加 `availableFromTurn` 或版本化事件；首轮只绑定当时可见值；把 USER 值与 LIVE/tool 值拆开，例如 `trip-options` 只存候选和价格，人员及确认状态留在 USER 状态中。

[fail] B-02：四个“失败/扰动变体”与其基线 fixture 状态相同，按当前文本无法形成新的扰动输入。

- `SIM-RES-01`：基线 `market-refresh=stale`（`fixtures/04-research-decision.md:27-30`），注入仍是 stale（`sessions/04-research-decision.md:69-71`）。
- `SIM-MKT-06`：基线 `community-probe=permission_denied`（`fixtures/07-marketing-growth.md:108-112`），注入仍是 permission_denied（`sessions/07-marketing-growth.md:445-447`）。
- `SIM-DAT-03`：基线 `weekly-metrics=stale`（`fixtures/08-data-finance.md:39-42`），注入仍是 stale（`sessions/08-data-finance.md:218-220`）。
- `SIM-DAT-04`：基线 `cohort-run=partial`（`fixtures/08-data-finance.md:72-75`），注入仍是 partial（`sessions/08-data-finance.md:293-295`）。

四条基线本身已经能测试 fail-closed，恢复语义也安全，所以不判缺失失败路径。修复方向：把变体改成不同状态，或明确给出发生变化的 payload 字段、时间戳和期望差异，避免只改名称不改输入。

[fail] B-03：`SIM-OPS-05` 的结果摘要没有吸收第 3 轮已经确认的总价档。

用户说“总价先按含税 18,600 那档，但还是不要下单”，期望动作也要求复述总价与未下单（`sessions/05-business-operations.md:342-345`）；结果却写“总价待确认”（同文件 `:347-349`）。安全边界仍关闭，因此不升 A。修复方向：改为“人员和含税 18,600 档已确认，预订未授权、未下单”。

### C 级，增强建议

[fail] C-01：会话结构接近最低模板。71/72 个会话正好 3 轮，仅 `SIM-ENG-04` 为 4 轮；虽然词面没有重复，这种结构集中会让回放对“延迟补附件、跨两轮改口、短确认后再拒绝”等长一点的状态路径覆盖不足。建议未来将 12–18 条改成 4–5 轮，并加入极短回复、迟到的纠正、打断后续接等自然形态，不需要机械拉长全部会话。

[fail] C-02：三处文字有明显截断或搭配不自然，但 oracle 仍可理解。

- `SIM-RES-02` 的“权限与幂仍弱”（`sessions/04-research-decision.md:124`）建议改为“权限与幂等仍弱”。
- `SIM-RES-03` 的“不作法结”（同文件 `:207`）建议改为“不作法律结论”。
- `SIM-RES-04` 的“无价值拍板”（同文件 `:275`）建议改为“不代为做价值拍板”或“不代用户拍板”。

[fail] C-03：验证器对 32 个 fixture 发出“payload 仍可更丰富”的警告。逐项阅读后，这些短 payload 已包含当前行为判断所需的关键字段，因此不影响本轮通过；后续只需优先丰富承担 `conflict`、`partial` 或恢复路径的事件，增加来源时间、缺失字段或权限范围，不建议为满足字段数机械加无用键。验证器的触发条件只是 payload 顶层键少于 3（`validate-simulations.mjs:109-117`）。

## 7. 最终判定

[pass] 作为访谈演练、对话设计、提示词回放和人工评测用的模拟数据，这 72 条已经具备可用的领域覆盖、真实的逐会话状态变化、足够自然的用户口吻、明确的 oracle 与安全闭合。B/C 项应作为下一轮增强清单，不阻断当前交付；若未来把本数据用于严格的自动化状态机 benchmark，应优先修复 B-01 和 B-02，使 fixture 具备清晰的逐轮时间语义。
