# SayDo 72 个模拟用户多轮使用会话实施

仓库：`~/WorkSpace/SayDo`。这是实施任务，不是 review。严格遵守仓库 AGENTS.md：简体中文、零 emoji、真实证据、改动聚焦、不 commit/push、不要 subagent、不要联网。

用户已明确调整方向：主 600 条问题已经足够，不再追加近义问题，也不再把模拟语料按真实 connector 可执行性无限复审。请完整读取：

- `research/customer-question-corpus/simulations/00-simulation-plan.md`
- corpus `README.md`、`00-能力边界.md`、`01-设计与分布.md`、`02-覆盖索引.md`、`03-频率与语义校准.md`
- 全部 12 个 `questions/*.md`
- 需要复用的 `contexts/**/manifest.md` 与 source

禁止读取任何旧 review、`research/codex-findings/**`、其他 prompts、logs、journal、Git 状态/历史/diff、`contract-model.mjs`、`test-mutations.mjs`。不得修改现有 questions、contexts、contracts、04、rebuild、validate 或旧评审产物。

## 交付

在 `research/customer-question-corpus/simulations/` 内创建：

1. `README.md`：用途、快速导航、如何回放、哪些内容是模拟、哪些不能当真实能力证明。
2. 保留并遵循 `00-simulation-plan.md`，只在必要时最小修订。
3. `01-schema.md`：单会话字段、turn 语义、fixture 事件、oracle、终态定义。
4. `02-coverage.md`：72 个 SIM 到 corpus ID 的完整映射和各维度统计。
5. `sessions/01-software-it.md` 至 `sessions/12-household-family-community.md`：每域 6 个会话，共 72 个。
6. `fixtures/01-software-it.md` 至 `fixtures/12-household-family-community.md`：每个会话至少一个 mock 工具/RAG 事件；K0 会话登记 `no_tool` 理由即可。
7. `simulation-spec.mjs`：72 个结构化显式 spec 的唯一生成源，内容需逐例具体，不能只套同一个模板换 ID。
8. `rebuild-simulations.mjs`：只生成 `sessions/`、`fixtures/`、`02-coverage.md`，不得改主语料。
9. `validate-simulations.mjs`：无第三方依赖，只把计划中的 A 级设为失败；B/C 只输出 `[warn]` 汇总且退出 0。

在 corpus `README.md` 与 `02-覆盖索引.md` 最小增加 simulations 导航和“72 个会话是代表性回放，不是使用日志”的说明。

## 选样与分布

- 每域恰好 6 个，corpus ID 全局唯一。
- H/M/L 合计必须为 32/25/15：ENG–DAT 八域各 3/2/1；LRN/LIF/FAM 各 2/2/2；CAR 2/3/1。
- 所选 ID 的频率和 C/D/H/R/K/S/F/B 必须从源问题原样解析，不手抄漂移。
- C1–C5、D0–D4、H0–H4、R1–R4、K0–K4、S0–S3、F1–F4 全覆盖。
- 至少 12 个 S3/F4、18 个 CTX、18 个 USER、24 个 LIVE、8 个 LIF/FAM。
- 生命周期最低数量按 `00-simulation-plan.md` 执行；一个会话可贡献多类。

## 单会话质量

每例必须是自然、具体、彼此有实质差异的 3–5 轮用户使用模拟，包含：

- `SIM-<DOMAIN>-NN` 和唯一 corpus ID；
- 源频率/完整标签/工具/上下文/F-B 摘要；
- 选样理由；
- 回放前状态，明确 CTX、USER、mock LIVE、授权是否已具备；
- 至少 3 个用户轮次；后续轮必须出现补充、纠正、约束变化、确认、拒绝或恢复之一，不能只是“好的”；
- 每轮相邻的期望系统动作，只规定行为，不强制逐字答案；
- fixture 事件引用与状态（ok/empty/stale/conflict/permission_denied/partial/no_tool）；
- 首个可审阅结果；
- `必须做到`、`不得做`、`可接受差异` oracle；
- 一个失败/扰动变体和恢复行为；
- 最终状态，只能是 waiting_for_user、ready_for_review、refused_and_rescoped、draft_ready、evidence_ready 等明确非“完成”的状态。

安全要求：

- S3/F4 不生成真实外部消费；只做预览、挑战、拒绝或安全降级。
- 不伪造授权收据、真实登录、真实付款/发送/部署。
- fixture 使用合成组织、账号代号和数值；无真实姓名、联系方式、密钥、完整路径、医疗诊断或交易指令。
- CTX 只引用 manifest/source 真有的事实；USER 与 LIVE 输入不可写成 fixture 已知事实。
- mock locator 使用 `sim://SIM-ID/event-name`，明确只定位本地模拟事件。

## 实施方式

- 先从源 questions 程序化解析全部候选，人工选择满足分层的 72 个 ID。
- `simulation-spec.mjs` 逐例写具体对话和 fixture payload；可以共享渲染函数，不得共享空泛内容。
- 生成两次，比较 `sessions+fixtures+02-coverage.md` 全树 SHA-256 一致。
- validator 至少检查：72/12域/HML、ID存在唯一、源标签完全一致、每例字段/3轮/oracle/失败变体/终态、fixture引用存在、输入与风险覆盖、mock locator、安全禁词、无娱乐、生命周期最低数量。
- B 级只输出 warn，例如自然度偏书面、某些 mock payload 仍可更丰富，不得因 B/C 退出非零。
- 运行限定 emoji 门。
- 批量生成后逐条程序化核验 72 例，不抽样。

最终回报：修改文件、真实命令与退出码、两次 SHA、72/分布/标签/输入/生命周期统计、validator 的 A=0 与 warn 数、emoji 结果。不要 commit/push，不要称自己的自检为独立 review。
