# SayDo 评审实施后复核与更新建议（SOL）

> 日期：2026-07-24
> 状态：增量复核与建议，**不是 canonical 设计，不替 owner 修改已拍板范围**
> 复核对象：`research/saydo-product-value-and-gap-analysis-sol.md` 之后，另一会话已落盘的文档修订
> 适用快照：2026-07-24 01:08:37（以当时磁盘内容为准）
> 并发说明：初稿形成后，另一会话又写入 `research/saydo-review-readback.cursor.md` 与 `history/PROCESS-JOURNAL.md` R30；本报告已完整重读并纳入 triage，未覆盖其内容。canonical 文件的上述快照未变。
> 关系：本报告不重写上一份 SOL 对价值、用户和场景的完整论证；凡涉及“当前缺口、实施建议、优先级、旧问题关闭状态与 owner 已决事项”，以本报告的增量结论为准。

## 0. 结论先行

### 0.1 更新后的总判断

**这一轮 Review 实施是有效的，但“文档补出了校验要求”不能等同于“合同已经机械闭合”。** route、返工链、outbox 诚实语义、daemon 身份、verify 冻结、hard forget 分层等方向已经明显变好；与此同时，SQLite 实测、两路 subagent 与一路 Codex 终审共同证明，仍有状态、收据、adapter 能力、安全 effect surface 和 source snapshot 的硬断口。

状态变化不是“产品已经开始实现”。本机事实仍是：

- `~/WorkSpace/SayDo/` 目录存在，但没有 `.git`，也没有项目文件；
- `~/.saydo/hopper-dist` 不存在；
- `~/.saydo/hopper-vault` 不存在；
- `~/.saydo/config.toml` 与 `~/.saydo/.env` 文件存在，但本轮出于敏感信息纪律没有读取或打印内容；
- 因此，**本轮实施的是文档评审意见，不是 SayDo 产品代码**。

更新后的工程判断分五层：

| 层级 | 当前判断 | 条件 |
|---|---|---|
| Phase 0 脚手架 | **Conditional Go** | 先修 authority、P0 状态/DDL、配置互斥合同，并完成 Phase 0 真正消费的 preflight；不必等待 Hopper、完整指标或 docs-lint |
| 自主 dispatch / Gate 0 | **No-Go** | selected adapter 必须证明所有 enabled effect 的事前拦截或由 OS sandbox 收口；“顶层 tool_call 没 hook 就 cancel”既会误杀，也不能证明副作用未发生 |
| Phase 3 就绪评估 | **No-Go** | 先补不可变 `SourceSnapshot → VerifiedExcerpt → ClaimSourceVerification`，再让零工具 evaluator 做语义判断 |
| Phase 4 dogfood | **可在安全门关闭后启动** | 指标协议未冻结前的数据只能标为 pilot / exploratory；协议冻结只阻塞价值解释，不阻塞自然自用 |
| P0.5 | **按 owner 的 v2.3 继续保留** | 修正 Hopper 身份/改需求/收据与 adapter capability 漂移；在各消费点前完成相应物理前置 |

这里的 Conditional Go 不是重新要求 owner 缩减“完整双路径首发”。owner 已于 2026-07-24 选择**方案 B：v2.3 范围不变、价值证据建议性且不设 stop/go 门**。本报告接受这个约束，不再把“先砍范围”作为当前建议；更新后的建议是：

> **保留 v2.3 的完整交付范围；安全门按 enabled path 硬阻塞，价值证据不做 stop/go；用单一 canonical capability 表、消费点前置和 claim gate 降低风险。**

### 0.2 真正价值没有变，但现在可以说得更精确

SayDo 真正值得验证的仍不是“用语音写代码”，而是：

> **把尚未整理好的意图，低负担地变成一份可批准的执行合同；让 agent 在可恢复、可追责的边界里离席执行；只在需要人判断时叫回；最后按原验收标准带证据回来。**

用户购买的不是 ASR、采访或后台 runner 中任意一个零件，而是两项**尚待验证的联合结果假设**：

1. **结果可信度不下降**：在预先定义的适用机会中，得到独立验收通过结果的概率不劣于现有工作流；
2. **主动注意力下降**：每个 verified outcome 消耗的人类主动沟通、判断、审批、review 和返工分钟更少。

Review 后的文档已经把安全、恢复、验收合同补得更扎实；这反而让剩余最大的不确定性更清楚：

> **SayDo 是否真的比 owner 现有的 Cursor / Codex / Claude 原生工作流少操心，而不是只把操心从写 prompt 转移到采访、审批和 review。**

### 0.3 最重要的新发现

本轮不是简单重复旧缺口。修订后最重要的新增或仍被误判为已关闭的问题有七个：

1. **P0 DDL 和工具状态没有机械闭合。** `reviewTask` 返回不存在于 TaskCard 状态机的 `rejected`；SQLite 实测仍接受 voice receipt 缺 `turn_ref`、`forget_hard` 缺 payload、以及两个 `dedupe_key = NULL` 的 active callback。
2. **Cursor Gate 0 的 canary 不是完整安全边界。** 只覆盖 shell hook 会漏掉 Read/web/其他 tool effect；把任何“无 hook 的顶层 tool_call”都 cancel 又会误杀无害工具，且事后 cancel 不能撤回已经发生的读取或出网。
3. **critical source 回读没有可实现边界。** evaluator 既不能自由浏览原始世界，又必须判断原文是否支持 claim；当前 `SourceRef` 与初稿建议都缺可供语义判断的有界 excerpt、不可变 snapshot、TOCTOU、保留/删除和注入边界。
4. **价值证据轨把观察性漏斗误写成 ITT / 非劣比较。** 自然选择工作流始终有 self-selection；等待时延也不是主动分钟。V1 只能做 prospective cohort/funnel，真正 ITT 需 V2 的随机 workflow 或 encouragement。
5. **canonical 优先级自相矛盾。** 项目纪律和计划正文都说 `docs/01–10 + adr/` 是真相源，但 `IMPL-PROMPT.md` 又要求计划与 `docs/09` 冲突时计划胜出，正在授权 contract fork。
6. **adapter、路径和收据身份仍不封闭。** `tier1 + codex` 在 schema 中可表达、架构中却把 Codex 放在 Hopper/Tier 2；Cursor transport/version/capability digest 未持久化；billing-switch 与 voice dispatch 缺可校验 receipt 绑定。
7. **P0/P0.5 横幅修了，实际单元格、ADR 和 Demo 旅程没有修完。** 直接验收、预授权、Hopper 改需求和 live steer 仍有互斥语义。

这些问题都不要求推翻产品骨架；它们要求把“方向已写对”“Zod/DAO 计划会拦”“数据库已拒绝”“危险 effect 从未发生”“价值比较有因果解释”五种强度分开陈述。

---

## 1. 本轮复核范围与证据纪律

### 1.1 复核方式

本轮以当前磁盘文件为事实源，重点完成六类检查：

1. 逐项对照上一份 SOL 的 A/B 级建议，判断为“已修复 / 部分修复 / owner 明确不采纳 / 仍未处理”；
2. 完整重读 canonical `docs/01–10 + adr/`、计划、交接 prompt、模板、Demo、README、历史与相关 research；
3. 在初稿后完整读取另一会话新增的 `saydo-review-readback.cursor.md` 与 journal R30，并逐项用当前文件或机械实验复核，而不把其“剩余全部是文本级”直接当事实；
4. 对本机 Phase -1 物理状态做只读检查，并用 headless Chrome 渲染 Demo 的 Dashboard、对话、审批与设置页面；
5. 将 `docs/09` 当前 DDL 载入 SQLite `:memory:`，构造安全关键非法行，验证约束是否真的由数据库拒绝；
6. 完成“产品与证据”“架构安全与集成”两个 subagent 评审，以及独立 `gpt-5.6-sol / max / read-only` 终审，再按 A/B/C triage 回修本报告。

本目录不是 Git worktree，无法用 commit 或 `git diff` 证明改动。快照用文件时间与 SHA-256 固定：

| 文件 | 快照时间 | SHA-256 |
|---|---:|---|
| `docs/01-vision-and-problem.md` | 01:06:38 | `0f0a22469481b579570cff65bcd04d05b44338657ef173605fb17511b0cc26f3` |
| `docs/04-key-mechanisms.md` | 01:06:49 | `de33793e6efb07a147350aaafdba4b00554f2f5250e97d1f6452bcf4944b17e5` |
| `docs/05-roadmap.md` | 01:08:13 | `136428ac7fe7fce20943addc66acbc0124263efe084d07cae9fc71d5a4d5cd28` |
| `docs/09-data-contracts.md` | 01:08:02 | `bf1b4639e28a61fb54713937c64d1f90ae6e3999a44563ab4bd87edbf5329892` |
| `IMPLEMENTATION-PLAN.md` | 01:08:37 | `355a1b58d6548eff0ad2c2c513078f340112c5891d32d25964c499e7fe3ab6b6` |

初稿后的新增非 canonical 输入：

| 文件 | 写入时间 | 本轮处理 |
|---|---:|---|
| `research/saydo-review-readback.cursor.md` | 01:20:34 | 已完整读取；采纳其 `reviewTask.rejected`、计划分档、ADR/引用等可复核发现，不采纳“剩余全部是文本级”的总判 |
| `history/PROCESS-JOURNAL.md` R30 | 01:21:20 | 已保留；本轮 journal 使用 R31，不覆盖 R30 |

SQLite 反例的真实原始输出为：

```text
voice_dispatch_null_turn_ref|1
forget_hard_null_payload|1
active_null_dedupe|2
```

其中尾数是成功插入后查询到的行数，不是预期值：当前 DDL **确实接受**了这三类非法或不应并存的记录。这也是为什么本报告将 MemoryEvent、A2/A8、receipt/outbox 从“已修复”降为“部分修复”。

事实、判断和建议仍严格分开：

- **事实**：当前文件或本机检查真实显示什么；
- **判断**：这些事实对产品、架构或实施意味着什么；
- **建议**：建议 owner 或后续实施会话如何处理，未写回 canonical 前均不算决定。

### 1.2 本报告明确不做的事

- 不覆盖另一会话已经落盘的 canonical 修订；
- 不读取或打印 `.env`、token、API key；
- 不把“文档新增了测试要求”写成“测试已经通过”；
- 不把 Hopper 裁决完成写成 Hopper 物理安装完成；
- 不把 owner 已明确保留的 v2.3 范围重新包装成已同意裁剪；
- 不在本轮修改 `docs/01–10`、ADR、实施计划或 Demo；本文件只给更新建议。
- 不把自然选择工作流的 owner dogfood 叫作 ITT、非劣试验或因果比较；
- 不把 Zod/DAO 中准备实现的校验写成 SQLite 已经机械拒绝。

---

## 2. 上一份 SOL 建议的实施状态

### 2.1 已实质改善或关闭

以下是本轮可以由当前文本确认的真实进展；“已进入计划”只证明工作已登记，不证明运行时边界已通过：

| 上一轮问题 | 当前状态 | 当前证据 |
|---|---|---|
| review 后缺返工、重试、人工合并工具面 | **主体关闭，留一个状态 bug** | `reviewTask`、`retryTask`、`requestManualMerge`、`MergeProof` 与 `AcceptanceCheck` 已补；但 reject 返回的 `rejected` 不在 TaskCard 枚举中（`docs/09:226-261,621-637`） |
| cancel 后改需求错误地总新建任务 | **docs/09 已关闭** | 当前主合同统一为同一 TaskCard revision / 新 attempt，显式换卡才 `superseded`；ADR 操作表仍需同步 |
| outbox 被写成 exactly-once | **核心语义关闭** | `docs/09:314-317` 已改为“至少一次 + dedupe 收敛”，并承认崩溃窗口可重复；其他文档与 DDL 约束仍有残留 |
| “隔夜交活”过度承诺 | **关闭** | 当前明确区分愿景与现状，只承诺离席执行到 review 点（`docs/01:51-53`、`docs/04:186`） |
| “值得问”没有机械定义 | **关闭** | 已定义会改变 outcome/scope/acceptance/授权/路径或消除 critical unknown 才值得问（`docs/04:55`） |
| Phase -1 把 Hopper 物理路径写成已完成 | **事实披露已纠正** | `IMPLEMENTATION-PLAN:20` 明说 dist/vault 未落地，并列出 checkout/build/init 与版本断言；消费点分档仍不一致 |
| daemon 身份、verify 冻结、setup lifecycle 风险未登记 | **已进入 Gate 0 / 实施验收** | capability token、Host/Origin、解析后 argv/digest、`--ignore-scripts` 已进入 `docs/05:67-70` 和计划；config 示例与实际 conformance 仍未闭合 |

这说明 Review 实施不是无效改字；它确实把多项隐含要求提升为显式合同或门禁。问题在于，上一会话的 readback 又把“显式登记”进一步推成了“硬伤已关闭”，而机械反例不支持这一步。

### 2.2 部分修复

| 上一轮问题 | 为什么仍是“部分” |
|---|---|
| `route` / adapter | TaskCard/DDL 已能区分 `tier1 + adapter` 与 `hopper + null adapter`（`docs/09:225-231,393-395`），但仍允许 `tier1 + codex`，而 `docs/03/07/09` 又把 Codex 经 Hopper 归 Tier 2；transport/version/capability digest 也未入持久合同 |
| selected-adapter Gate 0 | 计划要求 conformance 和 fail-closed 是进步；但当前 shell hook、顶层 `tool_call` canary、Read/web/egress 之间互相不能构成“危险 effect 从未发生”的证明 |
| MemoryEvent / A2 / A8 | TS 判别联合和 P0/P0.5 分层已写；SQLite 仍接受 `forget_hard` 空 payload，presentation 主要是文字要求，voice receipt 也未强制关联 transcript，因此只能算**计划级部分修复** |
| outbox 语义 | `docs/09` 已正确，但 `docs/04:114`、`docs/05:55`、`docs/08:50` 仍保留“重启只叫一次”；SQLite 的 partial unique index 允许多个 `NULL dedupe_key` active row |
| safe setup | 计划 4.1 与测试反例已有 `--ignore-scripts`，但 `docs/09:544` 的 canonical 示例仍是自由字符串 `pnpm install --prefer-offline`，模板尚未形成统一 argv/cwd 合同 |
| Phase -1 诚实状态 | 计划第 20 行承认物理路径未做，但第 23 行又说 D “仅剩 Hopper 批次 A 排期”；标题“owner 完成”也容易被读成已完成状态 |
| selected adapter | 停止规则已正确，generic config / env 和 roadmap 仍把 Cursor 执行后端标为 P1；dev 模板本身已正确选择 Cursor，不能笼统说“两份模板都错” |
| 产品价值证据 | 已新增方案 B 证据轨与周报，但当前分母、主动分钟代理、基线和缺陷植入方法还不能支持它声称的结论 |
| 决策卡—验收卡配对 | `AcceptanceCheck` 已把验收标准一一对账升成合同；Demo 和指标仍未证明这能减少 review 漏检或主动分钟 |
| critical source 回读 | `docs/04` 增加了正确的安全目标，但 `docs/09` 未补可执行 verifier 合同，形成新的实现断口 |
| billing switch / voice dispatch receipt | 文字要求存在，但 receipt kind、schema、工具与 DDL 没形成一条可重放链；当前 SQLite 允许 voice dispatch receipt 不带 `turn_ref` |

### 2.3 owner 已明确选择不同方向

以下不再作为“待修 bug”重复提出：

| 上一份 SOL 建议 | 当前 owner 决定 | 本报告处理 |
|---|---|---|
| 先做单路径研究 slice，再决定完整双路径 | 首发保持 P0 + P0.5 完整双路径 | **接受**；改为分期 feature gate、claim gate 和真实前置 |
| 考虑裁掉部分 Console 页面 | P0 11 页全保留，但不得有空壳 | **接受**；只建议按核心旅程排序实施与验收 |
| E0/E1/E2 可能成为前置 Gate | 价值证据建议性、零阻塞，不设 stop/go | **接受**；只修测量有效性，并限制对外声明 |
| 纯文字作为产品内对照通道 | P0 纯文字/无障碍非目标 | **接受**；基线用现有原生 agent 的离线记录，不偷加 P0 text 产品功能 |

正确的后续姿态不是反复重问这些选择，而是把它们带来的代价透明化：

- 完整双路径会增加首发时间和文档同步面；
- 11 页全保留会增加实现/维护面；
- 证据不阻塞意味着即使结果不佳也会继续 P0.5；
- 因而必须把“工程交付完成”“owner 自用有价值”“外部用户价值成立”“安全率已校准”四种结论严格分开。

---

## 3. 更新后的价值、用户与场景判断

### 3.1 产品类别

上一份 SOL 提出的类别仍成立：

> **对话驱动的可信委派控制面。**

更精确地说，SayDo 不是替代模型、IDE 或 Hopper，而是负责五件跨系统工作：

```text
开放意图
  → 收敛成可签署 DecisionPackage
  → 按能力与风险选择执行路径
  → 持久化运行中断点、授权和回叫
  → 按原 acceptance 生成可判断的 review evidence
```

其中：

- 语音是降低表达摩擦和允许离席的入口；
- 采访/就绪是把模糊意图变成合同的判断层；
- receipt / journal / reconcile / Gate 0 是“敢交出去”的信任底座；
- result/evidence 是“回来后不必重新调查”的价值兑现面；
- 跨任务记忆只有在同一 repo 的重复使用中才可能形成复利。

真正可能积累的资产不是某个 ASR 或某个 agent adapter。这里必须分成两类，不能把本地数据天然称为平台 moat：

1. **本地个人复利**：同一 owner / repo 的 foundation、带 provenance 的记忆、纠错与偏好，价值可留在本机，不要求跨用户汇聚；
2. **跨用户学习资产**：什么问题改变结果、readiness 与返工的校准、执行路径的风险/介入分布。它只有在明确同意、去标识、用途限制、删除传播和足够样本成立后，才可能成为平台资产。

DecisionPackage → 执行事件 → AcceptanceCheck → 人类裁决是一条可审计的关联链；在没有随机化或可信对照前，不应称为“因果链”。

### 3.2 滩头用户

当前最可信的第一用户仍是：

> **熟悉一个健康 brownfield repo、已经高频使用 AI agent、能自己 review 结果、但不想持续盯执行的技术型 owner / solo builder。**

他需要同时满足：

- 有一批 20 分钟到数小时、边界可描述、可本地验证的 coding 任务；
- 每周至少自然出现约 2–3 个这类委派机会，否则安装、奠基与复习成本很难摊薄；
- 能判断 diff、测试和未验证项；
- 愿意运行本地 daemon、授权 repo，并接受初次配置；
- 痛点是组织意图、持续看守和收尾判断，而不只是打字速度；
- 会在同一 repo 重复使用，给记忆和 foundation 复利机会。

相邻用户按现实距离排序：

| 用户 | 潜在价值 | 还缺什么 |
|---|---|---|
| 2–5 人小团队技术负责人 | 把零散需求变成可审计委派，减少追 agent 和收尾成本 | 多主体授权、任务并发、共享记忆治理、责任归属 |
| 同时管理多个技术项目的 founder | 通过回叫和证据卡减少上下文切换 | 跨项目队列、回叫聚合、移动 review |
| 非技术项目 owner | “聊清楚—交出去—带证据回来”的价值更大 | 非代码 artifact oracle、外部副作用审批、无法亲自 code review 时的可信验收 |

当前不应对外泛化为：

- 面向所有人的语音助手；
- 不会 review 也能放心交付的软件工程代理；
- 紧急事故自动处置系统；
- 多人会议自动采纳并执行的协作系统；
- 任意长 workflow 的“睡一觉必交活”平台。

### 3.3 最有价值的首批使用场景

| 场景 | 例子 | SayDo 的独特价值 | P0 适配度 |
|---|---|---|---|
| H1 模糊但重要的 brownfield 改动 | “把报表导出做得适合财务对账，但我还没想清格式” | 先读 repo，再问会改变 outcome 的问题，形成可签合同 | 高 |
| H2 清晰但耗时、会中途卡住的改动 | “给现有 API 加分页、兼容旧客户端、补测试” | 离席执行、失败/blocked 回叫、按标准验收 | **有条件高**：仅限低风险、S2 少、owner 仍在设备附近；S2 密集或真正长时间离席应后移验证 |
| H3 同 repo 的重复改动 | 连续数周维护同一产品 | foundation 与可信记忆可能降低重复解释成本 | 中；4–6 周只是观察窗，必须另测 recall 使用/正确/过期/纠错，不能用“待得久”代替记忆价值 |
| H4 需要可逆探索的方案工作 | 先调研 repo 再给两种实现与小 Demo | 对话与 DecisionPackage 比直接 prompt 更适合 | 中；Demo 生成器在 P0.5 |
| H5 对 H1/H2 的对抗旅程 | 依赖装不上、发现接口前提错误、owner 临时追加约束 | 验证 durable park、Plan Delta、能力感知 steer/cancel-resume | 不是独立 JTBD；作为 H1/H2 的故障/变化测试矩阵 |

不适合作为价值证明的任务：

- 两分钟能完成的微改动：采访和审批固定成本可能大于收益；
- 生产事故：当前 Quick 只是兜底，不是完整 incident lane；
- 验收没有 oracle 的高风险改动：漂亮总结不能替代真验证；
- S3 或外部副作用密集任务：会频繁停靠，人类注意力未必下降；
- 需要手机上细看大 diff 的场景：P0 移动 review 能力不足；
- 新用户一次性陌生 repo：安装、奠基和信任建立成本可能压过收益。

### 3.4 “过度设计”的更新判断

上一轮之后，不应再笼统把 receipt、journal、reconcile、verify freeze、daemon 身份、hard forget 或 adapter canary 叫作过度设计。只要产品允许离席执行，这些都是 enabled path 的必要成本。

当前真正的过度设计风险转移到两处：

1. **重复表达同一个合同。** `docs/03/08` 保存字段级 shadow schema，`docs/04/05/10` 又各自重述分期和能力；修一次要同步很多份，已经持续产生漂移。
2. **证据未成立前就构建完整产品宽度。** owner 已接受这个投资选择，所以它不是待裁范围；但它仍是机会成本，必须用 phase gate 和 claim gate 管理，不能因“全做了”自动推导“用户价值成立”。

优化方向不是把安全深度砍掉，而是：

- canonical 合同只保留一份，其他文档引用或由工具生成；
- 先建立一张 canonical phase/capability 表供计划、话术、模块与 Demo 引用；在 runtime capability matrix 真正存在后再考虑生成 manifest，避免现在新增一份手写真相源；
- 先让一个端到端旅程在 11 页之间真实连通，再填低频页面，不做静态空壳；
- 对外定位只承诺已有证据支持的用户和场景。

---

## 4. 当前仍需处理的缺口

本节按“在哪个时间点前必须修”分级，而不是把所有问题都粗暴写成“Phase 0 前阻塞”：

- **A0**：正式启动实施会话前；
- **A3**：进入 Phase 3 就绪评估前；
- **AD**：第一条 evidence-grade dogfood 数据产生前；不阻塞安全范围内的 pilot / exploratory dogfood；
- **A5**：进入 P0.5 前；
- **B**：不会立即破坏安全，但会制造实现歧义、维护债或错误产品表达；
- **C**：文档卫生与自动化优化。

### 4.1 A3 · critical source 回读与 evaluator 隔离断链

#### 当前事实

- `docs/04:69` 新增 P0 要求：深评层对每条 critical claim 按 `SourceRef` 回读 quote 或现读 repo，不一致则 `conflicting → gap_critical`；
- 同一文件 `docs/04:75`、`docs/07:99,198,230-234`、`docs/08:37,73` 又要求 evaluator 只读证据账本、不读 Brain 自辩，并尽量做到零工具；
- `docs/09:655` 只写 evaluator 读取 `readiness_assessments` 与证据账本，没有 source 回读输入、输出、失败状态或 resolver；
- `SourceRef` 当前包含 `user_utterance / user_edit / repo_file / web / artifact / agent_output / import`（`docs/09:184-187`），不同来源不能用同一种“回读”动作。
- 当前 transcript DDL 只是普通可更新行，未形成 append-only / digest chain（`docs/09:63-68,366-368`）；因此“immutable transcript”仍是要求，不是数据库事实。

#### 风险

直接实现会落入二选一：

1. 给 evaluator repo/web/file 工具：它能回读，但扩大了读面与 prompt-injection 面，破坏“只读证据”的原隔离设计；
2. 不给工具：它只能相信上游提供的 quote，无法发现“账本被写歪”，新增机制形同虚设。

#### 更新建议

在 daemon 侧新增机械的 snapshotter / resolver，**不要让 evaluator 自己浏览原始世界**。初稿仅返回 `excerptDigest`，却又要求 evaluator 判断语义，内部仍然断链；最小合同应拆成三层：

```typescript
type SourceSnapshot = {
  snapshotId: string;                 // content-addressed
  source: SourceRef;
  canonicalLocator: string;
  contentDigest: Digest;
  capturedAt: Ts;
  contentType: string;
  encoding: "utf-8";
  resolverKind: string;
  resolverVersion: string;
  retentionClass: "task" | "memory_source";
};

type VerifiedExcerpt = {
  snapshotId: string;
  byteRange: { start: number; end: number };
  observedExcerpt: string;            // 有界数据，不是工具能力
  excerptDigest: Digest;
  taint: "user" | "repo" | "web" | "agent";
};

type ClaimSourceVerification = {
  claimId: string;
  snapshotId?: string;
  excerpt?: VerifiedExcerpt;
  integrity: "matched" | "mismatched" | "missing";
  freshness: "current" | "stale" | "not_applicable";
  supportEligibility: "critical_ok" | "advisory_only" | "forbidden";
  reason?: string;
  verifiedAt: Ts;
};
```

`observedExcerpt` 必须有严格字节/字符上限；它作为**不可信数据**放入 evaluator 的独立数据槽，不能与 system / instruction 拼接，也不能携带链接后触发自动工具调用。零工具能限制副作用，却不能自动消除 prompt injection；必须用结构化边界、明确“只判断 claim 支持关系”的 prompt、对抗 fixture 与输出校验共同处理。

按来源定义 resolver：

| SourceRef.kind | P0 回读方式 | 约束 |
|---|---|---|
| `user_utterance` | 从 append-only transcript snapshot 按 `turnId` 取有界原文 | 不能只信 claim 内 quote；turn、presentation、voice receipt 需在同一 digest 链 |
| `user_edit` | 读取已登记编辑事件的不可变内容 snapshot | live 文件已变化时另标 freshness，不覆盖旧 snapshot |
| `repo_file` | Git blob/commit，或对同一已打开 fd 原子 hash + range | path 归一化、限制 worktree root、no-follow symlink、阻断 traversal/secret path |
| `artifact` | 按 artifact id + version + digest 读取 | 版本缺失即 unsupported |
| `web` | 只读已授权缓存 snapshot + final URL/content-type/digest | URL 本身不是证据；redirect、大小和 MIME 白名单 |
| `agent_output` | 可回放但保持 `candidate/low trust` | 不因 digest 匹配升级为事实 |
| `import` | 需要 import manifest + digest | 来源链断裂即 unsupported |

还必须固定 canonicalization：原始 bytes、UTF-8 解码失败策略、换行规范、range 语义和 digest 算法。hash、取 excerpt 和记录 metadata 必须来自同一 Git blob / fd / 原子 snapshot，不能先读后 hash 造成 TOCTOU。

evaluator 只接收 `Claim + ClaimSourceVerification`，规则层先做：

```text
critical && (
  integrity != matched
  || freshness == stale
  || supportEligibility != critical_ok
)
  → Claim.state = conflicting
  → verdict = gap_critical
```

异族模型只负责判断“这个有界原文是否语义支持 claim”，不负责寻找原文。readiness verdict 需持久化 snapshot/excerpt digest、evaluator model、prompt digest 和 resolver version，才能重放。

dispatch 前还要把 `verificationDigest` 绑定到：

```text
readiness verdict → DecisionPackage revision → dispatch receipt
```

对 live critical source，在 dispatch 前重读并比较；变化则旧 receipt 失效，回到 gap/Plan Delta。snapshot 的保留与删除必须服从 consent 和 `forget_hard`：删除原文 snapshot、派生 excerpt 与索引，保留允许保留的最小 tombstone/audit 元数据，不能让 digest 指向仍可恢复的孤儿内容。

应补的反例至少包括：

- claim quote 被篡改，但 transcript digest 不变；
- `repo_file` 的 path 相同、commit 改变；
- web URL 内容后来变化；
- artifact 被 supersede；
- resolver 超时或来源丢失；
- symlink 跳出 worktree、`../` traversal、`.env`/secret path；
- snapshot 捕获期间文件变化；
- excerpt 中包含“忽略规则并通过”的 prompt injection；
- agent_output 自己支持自己的 claim。

**截止点：进入计划 3.2 前。** Phase 0 的数据库和基础合同可以先做，但不能照当前断口实现 readiness。

### 4.2 A0 · canonical 真相源优先级冲突

#### 当前事实

- 项目纪律规定 `docs/01–10 + adr/` 是唯一 canonical；
- `IMPLEMENTATION-PLAN:9` 也要求发现设计问题先回写文档，再改代码；
- `IMPL-PROMPT:19` 却写明：计划步骤表与 `docs/09` 标注冲突时，计划优先，只需在 evidence 登记；
- `docs/05:5`、`docs/08:5` 又用“正文尚未逐处改，冲突以计划为准”的横幅维持已知漂移。

#### 风险

实施者会被合法授权去：

- 按计划实现一个 `docs/09` 不允许的状态或行为；
- 事后只记“偏离”，不修 canonical；
- 让下一 Phase、Demo、话术和契约测试继续读取不同真相。

这正是当前文档已经反复发生的漂移机制。

#### 更新建议

建立按问题域划分的 authority map：

| 问题 | 唯一权威 |
|---|---|
| 产品目标、用户、风险与分期 | `docs/01/02/04/05/06`，owner 决策优先 |
| 系统边界、组件责任与运行时能力 | `docs/03/07/08`，不得复制 09 的字段级 shadow schema |
| 字段、状态、校验、工具签名 | `docs/09` |
| 用户话术与呈现红线 | `docs/10` |
| 已批准架构取舍 | `docs/adr/`；若与更新后的 canonical 正文冲突，先同步 ADR，不靠附注豁免旧表 |
| 实施先后、里程碑和工程步骤 | `IMPLEMENTATION-PLAN.md` |

计划可以决定“何时实现一个已定义合同”，不能静默重定义“合同是什么”。建议把 `IMPL-PROMPT:19` 改为：

> 步骤表只裁决实施顺序。若步骤与 canonical 的字段、状态、行为或分期标注冲突，停止该冲突项；先按轻量评审回写 canonical 与计划使其一致，再实现。不得只在 evidence 登记后选一边。

为了避免小措辞也阻塞，可限定触发条件为：

- schema / state transition；
- 风险等级 / 授权；
- P0/P0.5/P1 enabled behavior；
- 用户承诺；
- owner 已决范围。

纯工程拆分或估时差异仍由计划决定。

**截止点：发送实施 prompt 前。** 只暂停发生实质冲突的项；不相关的 Phase 0 脚手架可继续，避免把一次最小 authority 修复扩大成“全量 docs-lint 完成前全项目停工”。

### 4.3 A0 · P0 状态、DDL 与 voice receipt 尚未机械闭合

#### 当前事实

1. `reviewTask` reject 返回 `"rejected"`，但 `TaskCard.status` 没有该枚举，状态转换表也没有相应边；Hopper 投影又把 rejected 映射为 `failed`（`docs/09:226-261,341,622-624`）。
2. `docs/09` 把 DDL 标为可照抄，计划 0.3 又要求 CHECK / NOT NULL 直接拒绝非法行；但 `tasks.status`、`callback_outbox.trigger/state` 等安全关键枚举没有 CHECK，多个 TS 必填关系只存在于文字或未来 Zod/DAO。
3. 本轮把当前 DDL 载入 SQLite `:memory:` 后，真实得到：

   ```text
   voice_dispatch_null_turn_ref|1
   forget_hard_null_payload|1
   active_null_dedupe|2
   ```

   即 voice dispatch receipt 缺 transcript 关联仍能写入，`forget_hard` 缺 payload 仍能写入，两个 `dedupe_key = NULL` 的 active callback 也能同时存在。
4. 当前 `ApprovalReceipt` 只定义两个 kind，`issueDispatchReceipt` 也没有 `turnRef / presentation / heardNonce` 输入；“billing switch 需要一次性收据”的文字尚无 receipt kind、schema、工具或表与之对应。

#### 风险

- 实施者无法返回一个合法的 reject 状态，只能临场发明状态或映射；
- 崩溃恢复从 SQLite 重放时，可能读到类型合同声称“不可能存在”的行；
- 语音派单无法证明“哪一轮、以何种 presentation、用户实际确认了什么”；
- callback 的 NULL 绕过 unique index，会让“同 occurrence 只保留一个 active row”的不变量失效；
- 文档把未来 DAO 校验误写成数据库不变量，后续测试容易产生假绿灯。

#### 更新建议

开工前先形成一张 invariant ownership 表，明确每条约束由哪里执行：

| 不变量 | 最低机械层 |
|---|---|
| TaskCard / outbox / receipt 的状态枚举 | SQLite CHECK + Zod |
| `route × adapter`、receipt kind × 必填字段 | SQLite CHECK/trigger 或只暴露受测 DAO；若只由 DAO 保证，计划不得宣称非法直写都会被 SQLite 拒绝 |
| active callback dedupe | active path 的 `dedupe_key NOT NULL`，或生成稳定 occurrence key，再建 partial unique index |
| `forget_hard` payload/generation | kind-specific CHECK + contract test |
| voice dispatch 绑定 transcript | `turn_ref NOT NULL` + `presentation_digest` + `heard_nonce` + TaskCard/DecisionPackage revision |
| billing switch | 独立一次性 receipt kind、展示摘要、scope、expiry、first-wins/replay 规则 |

最小修法：

1. reject 统一落现有 `failed` 并记录 reason，或正式增加 `rejected` 的全链状态；前者改动更小；
2. 对 P0 安全关键枚举与必填关系补 CHECK/NOT NULL，并把其他 DAO-only 约束逐条写明；
3. 把上述三个 SQLite 反例加入真正的 migration/contract test，期望由“能插入”改成“被拒绝”；
4. `issueDispatchReceipt` 持久化 `adapterKind + transportVersion + capabilityDigest + turnRef + presentationDigest + heardNonce`，package 和 dispatch 均绑定同一 approved revision；
5. billing switch 不复用模糊 `respond`，建立独立单次收据。

**截止点：** P0 基础 schema / tool contract 在 Phase 0 开始前收口；billing-switch 的独立收据最迟在启用该路径前。

### 4.4 A0/A5 · P0、P0.5、adapter capability 与 Gate 0 仍漂移

#### 当前事实

当前计划已经很清楚：

- P0 只做 `step_confirm`；
- `direct_to_review`、预授权全链、Hopper 桥和 Demo 生成器属于 P0.5；
- dev 所选 Tier 1 后端是 Cursor CLI，已知没有 live steer，用 `queued_delta / cancel_resume` 降级。

但下游仍存在：

1. `docs/05:78-79` 把 ClaudeAdapter/Hopper 与两种执行模式都列进 P0；
2. `docs/05:93` 仍写 Codex/Cursor 以 Tier 2 在 P1 接入；
3. `docs/07:256` 的 P0 映射仍是 Hopper + Claude SDK，遗漏当前 Cursor CLI Tier 1；
4. `docs/08:47-54` 的 C1/C3/Hopper usage 单元格仍标 P0，只靠文件头横幅解释为 P0.5；
5. `docs/10:41-46` 的就绪问句、预授权、直达复述、默认切档仍标 P0；
6. `docs/10:60` 把 live steer 写成 P0 主线，未对 Cursor 分支；
7. `docs/10:61-64,72-75` 的 Hopper 改需求/回叫/合并话术仍标 P0，尽管文件头说它们是 P0.5；
8. `IMPLEMENTATION-PLAN:129` 仍要求 owner 决定 A7 capability matrix，而 `docs/09:667` 已记录 owner 拍板关闭；
9. `IMPLEMENTATION-PLAN:41` 要“非 owner 音频丢弃测试”，第 43 行又承认 P0 无 speaker detection，只能测 PTT 窗口；
10. generic config 与 env 仍说 Cursor/Codex 执行后端是 P1（`templates/saydo.config.example.toml:39-43`、`templates/saydo.env.example:23-25`）。
11. TaskCard/schema 允许 `route=tier1 + adapter=codex`，而架构与技术决策把 Codex 作为 Hopper/Tier 2；没有精确的 backend discriminated union。
12. Cursor 目前可证明的主要是 shell hooks（`docs/03:110,116`）；`docs/04:184` 又规定任何顶层 `tool_call` 没对应 hook 就 cancel，而 `docs/05:70` 明确承认内建 Read/web/egress 拦不住。三条合起来没有一个一致的 effect model：
    - 只看 shell hook 会漏 non-shell effect；
    - 所有无 hook tool_call 都 cancel 会误杀无害读取；
    - effect 发生后再 cancel 不能撤销已读取的 secret 或已发送的网络数据。
13. Cursor CLI/SDK 的 transport、版本、capability digest、allowed effects 与恢复策略没有作为 attempt/dispatch 的持久身份；重启后无法证明恢复的是同一能力边界。

#### 更新建议

不要再靠“文件头免责声明”修分期，也不要先新增一份手写 YAML feature manifest。最低成本做法是：

1. 在 canonical 中只保留一张 **phase × backend × capability × allowed-effect** 表，其他文档逐项引用；
2. backend 使用判别联合，至少包含 `kind / route / transport / version / capabilityDigest / allowedEffects / fallback`；Codex 若只能经 Hopper，就禁止 `tier1 + codex`；
3. 每个 attempt、approved package 和 dispatch receipt 持久化实际 backend identity 与 capability digest；恢复时不一致则 park/re-authorize，不能静默换后端；
4. conformance 按 tool class / event → **pre-effect hook** 覆盖，而不是只统计“有没有某个 hook 回调”；
5. vendor 无法事前拦截的 effect 由 OS sandbox/container、只读/受控 worktree、凭据剥离和网络策略收口；若仍不可控，capability 表诚实标红并禁止相应自主 path；
6. Gate 0 的反例要断言“危险 effect 没发生”，不能只断言“事后任务被 cancel”。

建议最小 conformance matrix：

| effect | 允许路径 | 需要的事前证明 |
|---|---|---|
| shell process / file write | selected worktree | `preToolUse`/等价 hook 能在 effect 前 deny；路径规范化 |
| file read | scope 内、secret denylist 外 | `beforeReadFile`/等价能力，或 OS sandbox；no-follow symlink |
| web/network | 显式 grant 范围 | egress policy 或完全禁用；不能靠 shell hook 推断 |
| external side effect | 默认禁止 | 单次 scope receipt + adapter capability |
| benign metadata/status | 只读 | 不应因“无 shell hook”被全局 canary 误杀 |

runtime capability matrix 真正进入代码后，才考虑由它生成 Demo badge 和 docs 检查；在此之前先完成一次逐行同步。

Demo 还需两项修正：

- P0 视图中把“直达验收”禁用或切成明确的 P0.5 preview，而不是只在第一次出现时放一个徽标；
- 给 T-0042 的直达旅程、preauthorized receipt、Demo artifact、Dashboard 的 S3 待处理项等所有后续呈现继承 phase badge。当前 banner 声称“超 P0 元素就地标注”，但实际并未全覆盖（`demo:281,352-353,493-526,675,760-793`）。

**截止点：** phase/backend 判别在相关 schema 开工前同步；任何自主 dispatch 在所选 backend 的 enabled-effect conformance 通过前保持 No-Go；P0.5 细节最迟在进入 P0.5 前同步。

### 4.5 AD · 价值证据轨的分母、代理与基线无效

#### 4.5.1 eligible dispatch 不是 intent-to-treat

`docs/05:118` 定义：

```text
verified outcome rate
= 独立验收通过数 / 全部 eligible dispatch
```

它能避免只看成功 dispatch 的幸存者偏差，但仍排除了：

- 任务本来适合 SayDo，owner 却选择了现有 agent；
- 进入 SayDo 后在决策包或 dispatch 前放弃；
- foundation / 采访负担太高，导致根本没有 dispatch；
- 因 Phase 能力缺失而改走其他工具。

所以它只是 **dispatch reliability**。即使在选工具前登记机会，自然工作流选择仍有 self-selection；V1 只能叫 prospective cohort / funnel，**不能再使用“接近 ITT”**。真正 ITT 需要 V2 随机分配 workflow，或至少随机 encouragement 并按 assignment 分析。

先冻结分析单位：

```text
analysis unit = opportunity_id
treatment instance = task_card_id + approved_revision
attempt / retry / Plan Delta = opportunity 内嵌变量，不另算新机会
```

再冻结两个端点：

```text
reviewable-result rate
= 固定观察窗内，进入 settled ready_for_review
  且所有 critical acceptance 已被充分验证的 opportunity 比例

verified-delivery rate
= reviewer approve
  + MergeProof / task_done
  + acceptance oracle 通过的 opportunity 比例
```

取消、切换工作流、观察窗到期、发现“其实是新需求”、一张卡多次 retry / revision 的归属规则必须在看结果前写入 protocol。

建议报告五层漏斗，而不是一个伪因果总数：

```text
target opportunity coverage
= registered target-eligible / estimated target opportunities

SayDo adoption
= SayDo-started / registered target-eligible

SayDo-started outcome rate
= verified delivery / SayDo-started

dispatch reliability
= verified delivery / eligible dispatch

product funnel yield
= verified delivery / registered target-eligible
```

最后一项只是 adoption × downstream outcome 的观察性漏斗，不是“SayDo 相对现有工作流的效果”。

机会日志必须在选工具前 append-only 登记，至少包含：

```text
opportunity_id
registered_at
eligibility_rule_version
registered_before_workflow_choice = true
task_class / estimated_size / risk
target_eligible
enabled_path_eligible
capability_digest_at_registration
inclusion_reason / exclusion_reason
chosen_workflow / switch_reason?
fixed_observation_window
task_card_id? / approved_revision?
adjudicator / endpoint_evidence_ref
```

`target_eligible` 回答“产品想服务谁”，`enabled_path_eligible` 回答“当前版本能否服务”；不能因 P0→P0.5 能力变化事后改分母。漏登记率与缺失结果也要单列。

#### 4.5.2 审批时延与 review 跨度不是主动分钟

`docs/05:118` 把会话语音时长、审批时延、review 跨度和自报相加作为主动人类分钟代理。这里混了三种不同量：

- **主动注意力**：人在说话、打字、读、判断、点击审批、review；
- **响应延迟**：请求到人作答之间经过的时间；
- **日历跨度**：ready_for_review 到验收结束的墙钟时间。

后两者可以很长但人完全没在工作。把它们放进主动分钟会制造虚假成本，也可能把“用户晚饭后才 review”误判为产品效率差。

建议：

```text
active_human_minutes
= foreground voice speaking
 + attended TTS / listening
 + decision / approval / correction
 + explicit evidence / diff review
 + operator intervention
 + failure/rework attention

approval_response_latency
= request_at → decision_at

review_calendar_latency
= ready_for_review_at → review_resolved_at

machine_runtime
= dispatch_at → settled_at，扣除人工 park 时段
```

需要固定 sessionization：idle cutoff、同一时间多个任务如何归属、后台 tab 是否算 active、缺失 timer 如何处理。TTS 只有在用户被要求听取且不能自由做其他事时才计入主动注意力；无人等待不计。

同时报告：

- 每个 opportunity 的主动分钟（包含失败、切换和未完成）；
- 每个 verified delivery 的主动分钟；
- approval/review 日历延迟；
- 机器运行时；
- operator intervention 次数与分钟。

只报“每个成功结果分钟”会再次隐藏失败机会。P0 可用“系统事件估算 + 每任务一行自报校正”，但必须保留缺失/估算标记。

#### 4.5.3 “非劣基线”没有基线采集

当前证据轨写了“非劣基线 + 分钟下降”，但没有定义如何收集 baseline。建议在 Phase 4 前，用 owner 现有自然工作流记录 5–10 个相近任务：

- 仍使用现有 Cursor / Codex / Claude；
- 不把 text mode 加成 SayDo P0 产品功能；
- 用同一 opportunity log、outcome 判定和主动分钟口径；
- 按 H1/H2、预计规模和风险层分层，避免拿微任务和长任务硬比；
- baseline 只是描述性参照，小样本不做显著性、非劣或因果宣称。

即使有这 5–10 个任务，它仍只能帮助发现量纲错误、固定成本和极端差异，不能回答“比现有方式更省注意力”。若未来要做因果比较，应随机 workflow / encouragement，或至少在更大 prospectively matched cohort 中预注册分析。

#### 4.5.4 readiness outcome 不能直接代表 false-ready

`readiness_assessments.outcome` 当前只有：

```text
accepted / small_edit / overturned
```

它能描述决策包结局，但“被接受”不等于当时没有遗漏 critical unknown，“被推翻”也可能是用户后来改变主意。建议增加盲标或 replay ground truth：

```text
critical_miss_at_proposal: yes | no | unknown
source_mismatch_at_proposal: yes | no
scope_or_acceptance_changed_after_new_info: yes | no
labeler
evidence_ref
```

false-ready 必须以“提议开始时存在本应阻塞的 critical unknown/conflict”为 ground truth，而不是只看包有没有被改。

#### 4.5.5 已知缺陷只能进隔离 fixture

`docs/05:121` 写“dogfood 期 3–5 个任务植入已知缺陷”。若在真实工作中植入，会污染产物、安全和统计。

正确方法：

- 只在独立 fixture repo / 临时分支；
- 缺陷清单对 reviewer 隐藏，对实验管理员可追；
- 同时测严重缺陷检出率与误报率；
- 完成后销毁或明确标记测试分支；
- 绝不进入真实业务分支、外部发布或用户数据；
- 自然 dogfood 只记录真实缺陷，不人为制造。

这个 fixture 只能证明 review surface 的 smoke，不证明它优于原始 diff。若要检验 evidence view 的增益，应在隔离 fixture 中：

- 随机呈现“原始 diff”或“SayDo evidence view”；
- 平衡缺陷严重度、任务顺序与 reviewer 熟悉度；
- 同时报检出率、false positive、review 主动分钟与置信度；
- 不把同一 reviewer 看过的缺陷再当盲测。

#### 4.5.6 外部激活不能只看“已激活用户复用”

若只统计成功进入产品的人，会把安装、本地 daemon、repo 授权和第一次信任建立全部藏掉。外部漏斗至少是：

```text
invited
→ agreed
→ installed
→ repo authorized
→ first natural opportunity registered
→ first task started
→ first reviewable result
→ second natural reuse
```

每层都记录退出原因。3–5 个“已经激活且愿意重复用”的用户只能说明下游体验，不能证明可激活性。

#### 4.5.7 同 repo 观察时长不等于记忆价值

4–6 周只是让记忆有机会被调用。H3 应记录：

```text
source-bound recall shown / used
recall correct / stale / unsupported
user correction / deletion
repeat-explanation minutes
memory-caused error
forget_hard 后的 zero-recall
```

可选的后续比较是对相似自然任务做 memory on/off 或延迟展示；在此之前只能说“观察到被使用且正确的 recall”，不能说“记忆形成护城河”。

#### 4.5.8 证据轨命名与架构模块冲突

当前项目已用：

- E1 = ModelProviders；
- E2 = PolicyEngine。

价值证据又使用“完整 E1/E2 实验机器”，会在计划、代码和讨论中产生同名歧义。建议改为：

- `V0`：自然机会登记与基线；
- `V1`：owner dogfood 行为轨；
- `V2`：external users / replay / calibration。

这是命名修正，不改变 owner 的方案 B。

**截止点：** 安全 Gate 0 关闭后可以立即开始自然 dogfood；protocol 冻结前的数据统一标为 `pilot/exploratory`。第一条 evidence-grade 数据产生前冻结上述口径，避免事后移动分母。安全门仍是硬门，指标协议不是 stop/go。

### 4.6 A0/A5 · Phase -1 与安全配置示例仍不闭合

#### 物理状态

当前只读检查结果：

```text
~/WorkSpace/SayDo
SayDo/.git: MISSING
hopper-dist: MISSING
hopper-vault: MISSING
```

因此：

- `IMPLEMENTATION-PLAN:12` 的 Phase -1 不能被标成已完成；
- C“仓库/CI”没有完成；
- D 的锁定 Hopper 副本和专用 vault 没有完成；
- 0.5 手动 PoC 依赖真实锁定副本，不能按计划第 23 行把 D 简化为“仅剩批次 A 排期”；
- config/env 文件“存在”不代表 key、模型家族、登录态和 endpoint 已验证，本轮没有读取秘密，不能断言 A 已完成。

建议把 Phase -1 改成可程序化检查表，每项只有：

```text
not_checked → checked_failed → checked_passed
```

不要用段落中的“已落”“未做”“仅剩”混合表达状态，也不要把所有前置绑成一个 Phase 0 总门。按消费点分档：

| 消费点 | 必须已过的 preflight |
|---|---|
| Phase 0 脚手架 | 有效 Git worktree/基础 CI、Node/pnpm/Python/uv/Chrome/just、当前 Phase 的非空 credential reference（不打印值）、至少一个 selected adapter smoke、独立 fixture |
| 0.5 Hopper 手动 PoC | `hopper-dist`、专用 vault、HEAD/tag/build 断言 |
| Phase 1 voice | 麦克风/耳机/PTT 音频底板 |
| P0.5 Hopper bridge | Hopper 批次 A，或 owner 明确批准的窄兜底合同 |

建议提供 `just preflight --target <phase>`，只检查该消费点需要的事实。这样既不会因 Hopper 未就绪误停 Phase 0 脚手架，也不会在 0.5/P0.5 时漏跑物理前置。

#### canonical config 与模板冲突

当前存在三个具体风险：

1. `docs/09:501-504` 用 `[voice] tts = "volc"`；
2. `templates/saydo.config.example.toml:58-69` 用 `[voice.tts]` 子表，并明确说字符串写法会与子表重复键冲突；
3. `docs/09:544` 用自由字符串：

   ```toml
   command = "pnpm install --prefer-offline"
   ```

   既缺 `--ignore-scripts`，也没有明确是否经 shell 解析。

建议 canonical 只保留模板能解析的形态，并把 setup 改成 argv：

```toml
[setup]
argv = ["pnpm", "install", "--prefer-offline", "--ignore-scripts"]
cwd = "controlled_worktree_root"
```

`cwd = "."` 依赖启动进程所在目录，恢复/daemon 场景下既含糊又可能越界。它应是受控枚举或已规范化的 worktree root id；拒绝绝对路径、`..`、symlink 跳转和 repo 外路径。

如确需 lifecycle scripts：

1. 先产生具体的 `SetupEffect`；
2. 展示 package、registry、目标 repo 与下游；
3. 按 S2 签单次收据；
4. 再执行不带 `--ignore-scripts` 的冻结 argv；
5. 执行前重校 package manifest digest。

generic config / env 还应同步当前 dev 后端；`saydo.config.dev.example.toml` 已正确选择 Cursor，不应笼统判为“两份模板都漂移”：

- Cursor CLI 是当前 P0 dev 所选 Tier 1，不是 P1；
- Claude SDK 是产品缺省但尚待订阅与四能力验证；
- Codex 经 Hopper 仍是 Tier 2；
- “模型供给用 cursor_cli”与“执行后端用 cursor_cli”应分别表述，避免同名混淆。

**截止点：** schema/config parser 开工前统一 canonical 与 generic 模板；每个物理项在上表相应消费点前通过。

### 4.7 A5/B · 契约、收据与状态语义仍有实现歧义

#### 工具命名双轨

`docs/09:634` 规定 canonical 工具名为 camelCase；`docs/03`、`docs/04` 与 `docs/10` 仍使用：

```text
assess_readiness
propose_start
get_status
steer_task
cancel_task
explain_result
open_on_screen
suspend_session
```

“实现时统一”仍要求人脑转换，容易让 Brain instructions 与 tool manifest 对不上。建议：

- canonical 文档一律 camelCase；或
- `docs/09` 生成 tool manifest 与 instructions，旧文档不再手写工具标识符。

不要同时给模型两套名称，也不要在 adapter 中维护隐式 aliases。

#### `respond` 没有状态语义

`ApprovalReceipt.decision` 仍含：

```text
accept | reject | edit | respond | ignore
```

但运行中 agent 问题已经有独立的 `answerAgentQuestion`，`approveAction` 只接受 `accept | reject`。当前没有说明：

- `respond` 对哪一种 request 生效；
- 是否消费 approval receipt；
- 与 answer 的关联；
- timeout / first-wins / replay 怎么处理。

建议从 `ApprovalReceipt` 删除 `respond`，或把问题流拆成独立 `QuestionRequest / AnswerReceipt`。审批和问答不应共享一个模糊枚举。

#### callback 文字仍过强

`docs/09:317` 的真实语义是：

> 至少一次投递；同一 dedupeKey 不重复入队；拨出成功到状态落盘之间仍可重复。

因此其他文件应统一说：

> 重启后不重复创建同一 occurrence 的活跃 outbox；通知端按 dedupeKey 幂等，极端崩溃窗口仍可能重复播报。

“重启只叫一次”适合作为用户目标，不适合作为无条件系统保证。

#### Hopper 改需求与批量授权仍冲突

- ADR 附注已说路径二改需求以 `docs/09` 同卡 revision 为准，但操作表仍写 cancel + 重新 drop + supersede（`docs/adr/ADR-001:17,47-53`）；这会带歪 task identity、dedupe 和历史关联。
- `docs/08:112` 仍把 batch path 写成事后补 preauthorized receipt，而 `docs/09` 的 Hopper grants 在该路径应为空；事后补授权不能使已经发生的 effect 获得事前授权。
- 计划 P0.5 行仍重开 “exactly-once” / A3 / A4 的旧口径，并遗漏 A6 的完整形态；删除传播 job 也在计划与 `docs/09` 的 P0/P0.5 分层间漂移。

修法不是再发明第三套路径：P0.5 前让 ADR、08、09、计划都引用同一条规则——同一意图改动为同卡新 revision/attempt；显式换任务才 supersede；Hopper 路径只执行其事前合同允许的 effect，不能用 post-hoc receipt 洗白。

### 4.8 B · canonical 漂移仍由“横幅豁免”维持

以下是本轮仍能程序化查到的具体漂移：

| 漂移 | 当前位置 | 应处理方式 |
|---|---|---|
| P0 不落 `current_projection`，但 03/08 仍写表/派生对象 | `docs/03:134`、`docs/08:42` vs `docs/09:193` | 删除 shadow 表述，改为 P0 内存重放 + Markdown 投影 |
| `docs/09` 已 v1.1，04 仍称 Draft v0.9 | `docs/04:88` | 更新版本或不写易腐版本号 |
| walkthrough 已降为 120 字，04 仍写 150 字 | `docs/04:197` vs `docs/10:6` | 只在 10 定义数值，04 引用 |
| 09 声称 08 已同步，但 08 正文仍有 current_projection | `docs/09:672` vs `docs/08:42` | 修正文，再保留同步记录 |
| docs04 声称 09 §13 已补 source 回读义务，实际没有 | `docs/04:69` vs `docs/09:655` | 按 4.1 补合同，不能只改引用 |
| README 说 08 有 22 个模块，实际表为 25 个 | `README:25`、`docs/08:28-61` | 自动计数或不写数量 |
| README/docs06 仍说 16 轮，journal 实际已到 R30 | `README:39`、`docs/06:99`、`history:417` | 更新索引和当前状态 |
| journal 本轮前的一句话状态仍是计划 v2.1、prompt 待发 Hopper | 本轮读取时的旧尾段；现见 `history:468` | 已在 R31 后更新为 v2.3、裁决已回、Phase -1 未完成 |
| “SOL §9.3”无文件链接 | `docs/04:55` | 链到具体 research 文件，或把规则完整自含后删除模糊引用 |

这些不是产品方向问题，但在“实施照抄”项目中会直接增加错误概率。开工前先人工收掉安全/状态/分期的确定冲突；`docs-lint` 降为 C 级，从确定性规则起步：

- 检查工具 snake/camel 双轨；
- 检查少量已登记的 stale P0/P0.5 phrase，不尝试用 grep 推断全部产品语义；
- 检查版本号与状态词；
- 检查关键短语“exactly once / 重启只叫一次 / 完成”；
- 校验 Markdown 内链；
- 对模块数量、话术数量等衍生数字自动生成。

### 4.9 B · Demo 的信息架构可用，但“当前能力”表达不诚实

本轮 headless Chrome 已实际渲染 Dashboard、对话、审批和设置页；页面结构、深浅色和基本跳转可读，没有发现渲染崩溃。

产品表达仍有两类问题：

1. **phase badge 只标第一次出现，不随对象传播。**
   直达模式选择处有 P0.5 badge，但 T-0042 卡片、详情、preauthorized receipt、验收旅程、Demo artifact 没有持续标明 P0.5；Dashboard 的 S3 待审批也没有直接带 P1。
2. **Demo 同时扮演 P0 当前态和完整首发预览，页级说明仍不够显眼。**
   用户容易把完整首发预览误读为 Phase 0 当前能力。

最小修复不需要先做 phase selector 或 `featureId` 系统：

- 补全 T-0042、直达旅程、preauthorized receipt、Demo artifact/preview 和 Dashboard S3 汇总的静态 P0.5/P1 badge；
- 在所有相关页统一显示“本页含完整首发/后续阶段预览”的横幅；
- P0 不可执行的控件设 disabled/preview，并解释当前 fallback。

只有当 Demo 以后确实要同时承担“当前实现”和“全路线预览”两套用途，才值得增加全局 phase selector；runtime capability matrix 成熟后再考虑自动生成 badge。

---

## 5. 更新后的实施建议

### 5.1 F0 · 先关闭 Phase 0 真正消费的 A0

建议把下面五项组成一个独立最小批次，完成后即可进入 Phase 0 脚手架；不要求 SourceSnapshot、Hopper、价值 protocol、完整 docs-lint 或 Demo selector 同时完成：

| 项 | 动作 | 验收 |
|---|---|---|
| F0-1 | 修 `IMPL-PROMPT:19` 的计划覆盖 canonical 规则 | authority map 清晰；contract 冲突必须先回写 |
| F0-2 | 修 `reviewTask` 落态与 P0 DDL invariant ownership | 三个 SQLite 反例均被拒绝；状态枚举与工具返回一致 |
| F0-3 | 统一 config/TTS/setup argv + controlled worktree cwd | canonical/generic/dev 模板能由同一 parser 解析；setup 缺省带 `--ignore-scripts` |
| F0-4 | 封闭 P0 backend 判别与 receipt identity | 禁止非法 route/adapter；attempt/package/dispatch 能绑定 transport/version/capability/voice turn |
| F0-5 | 同步 P0 当前分期与 Cursor fallback | 05/07/08/10、模板和 P0 Demo 不再互斥；P0.5 细节可在其消费点前收口 |

这不是再开一轮战略设计，而是把已经拍板且 Phase 0 会照抄的内容冻结成单一可执行事实。

### 5.2 F1 · 按消费点完成 Phase -1

顺序建议：

1. Phase 0 前：初始化 `~/WorkSpace/SayDo` Git 仓与基础 CI，运行不泄密的 `preflight --target phase0`，验证当前凭据引用、Cursor smoke，并指定独立 fixture；
2. 0.5 前：checkout/build 锁定 Hopper dist、初始化专用 vault、断言 HEAD/tag，再运行手动 PoC；
3. Phase 1 前：通过音频底板；
4. P0.5 前：完成 Hopper 批次 A 或 owner 批准的窄兜底；
5. 每项证据记录命令、退出码、版本和路径，不用“已配置”文字代替。

每个消费点的出口都是机器生成的 pass/fail 表；这比一个含混的“Phase -1 全完成”更不易误停或漏跑。

### 5.3 F2 · Phase 0–3 保持当前 P0 纵向主线

owner 不剪范围不等于所有模块同时摊开。推荐的内部实现顺序：

```text
contracts + state machine
  → one real voice turn
  → one DecisionPackage
  → selected backend effect-surface conformance
  → one step_confirm Cursor run（危险 effect 未发生的证据）
  → one S2 park/resume
  → one ready_for_review AcceptanceCheck
  → one manual merge proof
  → crash/restart/reconcile
  → 再铺完整 11 页
```

自主 dispatch 前先关闭 selected backend Gate 0。进入 Phase 3 的 3.2 前，再落不可变 snapshot / resolver。就绪链建议分成：

```text
raw source
  → authorized content-addressed SourceSnapshot
  → bounded VerifiedExcerpt
  → candidate claim
  → ClaimSourceVerification
  → critical rule gate
  → isolated semantic evaluator
  → readiness verdict
  → bind verificationDigest to approved revision / dispatch
```

这条链应有独立 fixture，不能只用正常案例证明。

### 5.4 F3 · 在 evidence-grade 窗口前冻结 V0/V1/V2 protocol

建议的最小证据方案：

#### V0 · 基线与机会登记

- 先记录 5–10 个 owner 现有 agent 自然任务，只作描述性参照；
- 每个机会在选工作流前登记，冻结 eligibility rule、当前 capability、观察窗与排除原因；
- 以 `opportunity_id` 为单位，以 `task_card_id + approved_revision` 为 treatment instance；
- 固定取消、切换、aging、新需求和 retry/revision 归属；
- 不使用 ITT、非劣、因果或统计显著性表述。

#### V1 · owner dogfood

- protocol 冻结前可自然 dogfood，但数据标 `pilot/exploratory`；
- 每周输出 target coverage、adoption、SayDo-started outcome、dispatch reliability、product funnel yield；
- 同时报告 reviewable-result 与 verified-delivery 两个固定端点；
- 主动分钟、审批响应延迟、review 日历跨度、机器运行与 operator intervention 分开；
- 主动分钟同时按 opportunity 和 verified delivery 报告；
- 记录 first-pass acceptance、attempt、包 revision、S2 次数、误听纠正、切换/放弃；
- readiness 只报告原始 false-ready ground truth 计数，不外推低比例；
- 自然任务不植入缺陷。

#### V2 · fixture / replay / external

- 已知缺陷只进隔离 fixture；
- evidence view 的增益用随机 original diff vs evidence view、平衡 severity 的实验验证；
- deterministic 安全反例随 enabled path 在 P0/P0.5 必做，**不能因“完整实验 P1”而推迟**；
- ≥200 分层 replay 用于 readiness/safety 校准；
- 第二用户或对外发布前，启动 3–5 名外部用户完整激活漏斗，从 invite/install/repo auth 到第二次自然复用；
- 同 repo 记忆单列 recall used/correct/stale/correction/delete/zero-recall 与重复解释分钟；
- 三臂 intake 消融仍是 P1 研究，不偷加 P0 text 产品功能。

### 5.5 F4 · 按 owner 决定继续完整 P0.5，但使用 claim gate

P0.5 仍按当前首发定义完成。建议新增的不是 stop/go，而是“可以说什么”的 claim gate：

| 已有证据 | 允许结论 | 不允许结论 |
|---|---|---|
| 合同测试、故障注入、fixture | 某个机械合同在已测边界成立 | 真实用户更省心 |
| owner n=1、少量自然任务 | owner 在这些任务中可用；记录到描述性的注意力数值 | 相对基线非劣、因果提升、普遍 PMF |
| owner 连续 4–6 周且 recall 被使用、正确、减少重复解释 | 初步本地记忆复用信号 | 仅凭使用时长宣称记忆价值或平台护城河 |
| 3–5 外部用户走完整激活漏斗并第二次自然复用 | 早期激活与可重复使用信号 | 市场规模、付费意愿或普通用户价值已证明 |
| 分层 replay 与足够样本 | 在该 corpus 上的校准区间 | 全场景 `<1% false-ready` 或“绝对安全” |

这样既不阻止 v2.3，也避免工程完成后产生错误叙事。

### 5.6 P1 排序建议

方案 B 下，价值数据最适合影响 P1，而不是反向否决 P0.5：

| 数据表现 | P1 优先项 |
|---|---|
| H1 价值高、问题数太多 | interview policy、无效问题率、visual reference |
| H2 价值高、blocked 多 | capability-aware steer、恢复与回叫 |
| review 主动分钟高 | 移动 evidence/review、decisions、diff 摘要 |
| S2 停靠频繁 | grant 设计、风险策略与更精确作用域 |
| H3 重复使用明显 | foundation 增量更新、记忆治理 |
| 机会多但 adoption 低 | 首次激活、安装简化、默认 profile |
| 机会少 | 收窄定位或并入已有载体，而不是继续扩平台页面 |

---

## 6. 哪些决策仍需 owner 拍板

### 6.1 不需要重拍的决定

本报告不要求 owner 再回答：

- 是否保留完整双路径首发；
- 是否保留 11 页 Console；
- 是否把价值证据设成 stop/go；
- P0 是否产品化纯文字；
- 当前 dev 后端是否先用 Cursor CLI。

这些都有明确现行决定。

### 6.2 仍然开放的商业/产品决定

| 决策 | 更新建议 | 为什么仍需 owner |
|---|---|---|
| 产品载体 | 在 V1 有自然使用数据前保持可迁移；不急着把独立壳或并入千手写成长期组织承诺 | 涉及产品线与资源归属 |
| foundation “够了” | 用实际首响、首包接受率和重复解释减少量校准 | 阈值是体验取舍 |
| 收敛度 | 以“无效问题率 + 包 revision + false-ready ground truth”联合调 | 过问与过早开工不可由文档决定 |
| P1 review 深度 | 看主动 review 分钟与缺陷漏检分布排序 | 可能比更多 agent/移动形态更值钱 |
| 对外定位时点 | 至少有外部重复自然任务再扩大“owner 自用”结论 | 属商业声明 |
| 已知 owner 范围的机会成本 | 若工期显著超滚动估计，是否仍坚持 P0.5 同次首发 | 这是未来可能发生的新事实，不等于本轮重问旧决定 |

### 6.3 建议 owner 现在批准的只是修复方法

为了不再次进入范围争论，本轮最小需要 owner 接受的是：

1. source 回读通过 daemon verifier，而不是给 evaluator 自由 repo/web 工具；
2. 计划不能覆盖 canonical contract，只能裁决实施顺序；
3. P0 安全关键状态/receipt/DDL 先机械闭合，并明确 DB 与 DAO 各自负责什么；
4. Cursor Gate 0 按 enabled effect 做事前拦截/OS sandbox conformance，不用事后 cancel 冒充防护；
5. 价值指标拆成 prospective opportunity funnel / dispatch / active attention，不再称 ITT 或非劣；
6. 已知缺陷只进隔离 fixture；
7. 分期与 capability 先用一张 canonical 表完整同步，不再靠文件头免责声明；runtime matrix 成熟后再生成 manifest。

这些都是实现与证据正确性，不改变 v2.3 产品范围。

---

## 7. 建议的 canonical 回写清单

本报告未执行以下修改。若 owner 采纳，建议按一个设计文档批次回写并独立评审：

| 优先级 | 文件 | 最小改动 |
|---|---|---|
| A0 | `IMPL-PROMPT.md` | 删除“计划冲突时胜出”，加入 authority map 与 conflict stop/repair |
| A0 | `docs/09` | 修 `reviewTask` reject 落态；补 P0 状态/receipt/outbox 的 CHECK/NOT NULL 与 invariant ownership；voice dispatch 绑定 turn/presentation/heard nonce；删除/拆分 `respond` |
| A0 | `IMPLEMENTATION-PLAN.md` | Phase -1 改为消费点分档；修 A7 已决状态和 SQLite 验收强度；登记三个机械反例 |
| A0 | `docs/03/04/05/07/09` + 计划 | 建立 effect-class → pre-effect hook/OS sandbox 的 Gate 0；conformance 证明危险 effect 未发生 |
| A0 | `docs/09` + templates | 统一 `[voice.tts]`、setup argv、controlled worktree cwd 与 `--ignore-scripts`；只修 generic/env 的 Cursor 漂移 |
| A3 | `docs/04/09` | 新增 `SourceSnapshot / VerifiedExcerpt / ClaimSourceVerification`、canonicalization、TOCTOU、retention/delete、注入边界、dispatch revalidation 与反例 |
| AD | `docs/05` | 重写 prospective V0/V1/V2：分析单位、端点、eligibility/version、active-minute sessionization、描述性 baseline、external activation、memory recall |
| A5 | `docs/adr/ADR-001` + `docs/08/09` | 同步同卡 revision、Hopper grants 与事前收据；不得 post-hoc 补授权 |
| A0/A5 | `docs/05/07/08/10` | 建一张 canonical phase/backend/capability/effect 表并逐项引用，不只放横幅 |
| B | `docs/03/08` | 删除 shadow schema/current_projection，链接或生成 canonical |
| B | Demo | 补全静态 phase badge、页级预览横幅和 disabled/fallback；selector 暂非前置 |
| C | README/docs06/history | 更新模块数、轮次数、当前版本和真实 Phase -1 状态 |
| C | docs-lint | 先检查坏链、非法旧状态词和已登记 stale phrase；不要用 grep 猜全部分期语义 |

完成 A0 最小批次后给 canonical 快照一个明确版本或 tag，即可进入 Phase 0 脚手架；A3/AD/A5 分别在各自消费点前关闭。不要把它们全部捆成新的全项目总门。

---

## 8. 最终建议

SayDo 经过这轮 Review 实施后，主骨架和 owner 范围已经稳定，若干关键合同也明显更接近可编码形态，尤其是：

- 返工、重试、人工合并；
- outbox 诚实语义；
- daemon 身份；
- verify 内容冻结；
- setup 供应链门；
- 决策卡与验收卡的一一对账。

但不能据此宣布“只剩文本收尾”。现在最值得做的不是再扩设计，而是按消费点收掉七个断口：

1. **P0 state / DDL / receipt**：数据库、DAO 与工具返回说同一种状态；
2. **Cursor Gate 0**：证明危险 effect 没发生，而不只是事后 cancel；
3. **source verification**：用有界不可变 snapshot 换信息源而不破坏 evaluator 隔离；
4. **authority**：计划管顺序，canonical 管合同；
5. **phase/backend/capability**：route、transport、effect 与 fallback 只有一个真相源；
6. **measurement**：观察性漏斗不冒充 ITT/非劣，机会、结果、主动注意力和日历延迟不混；
7. **consumer-scoped preflight**：每项物理前置在真正消费它的节点前通过。

一句话更新结论：

> **SayDo 的 Phase 0 脚手架在 A0 最小回修后 Conditional Go；自主 dispatch 与 Phase 3 readiness 仍各有硬门。产品价值方向没有改变但尚未被证明，owner 已选择不让价值证据阻塞 v2.3，因此下一步是“按消费点关安全门 + 正确实施 + 观察性测量 + 限制声明”，不是重问完整首发范围。**

---

## 附录 A · 关键证据索引

- 当前定位、状态与文档地图：`README.md:1-47`
- 愿景“隔夜交活”与现状限定：`docs/01-vision-and-problem.md:19,51-53`
- “值得问”、readiness、source 回读与隔离：`docs/04-key-mechanisms.md:55-75`
- outbox 用户目标残留：`docs/04-key-mechanisms.md:106-114`
- 执行模式与 Cursor gate：`docs/04-key-mechanisms.md:168-186`
- Cursor shell hook / Read-web 不可控的边界：`docs/03-architecture.md:110-116`、`docs/05-roadmap.md:67-70`
- 价值证据轨：`docs/05-roadmap.md:114-124`
- 当前 P0/P1 漂移：`docs/05-roadmap.md:74-97`
- evaluator 读禁闭与 BYOA cage：`docs/07-tech-stack-decisions.md:198-234`
- 技术分期漂移：`docs/07-tech-stack-decisions.md:245-258`
- 模块表、shadow schema 与分期横幅：`docs/08-module-design.md:5,28-61,75-112`
- SourceRef、MemoryEvent 与投影：`docs/09-data-contracts.md:174-214`
- route/adapter schema 与 DDL：`docs/09-data-contracts.md:225-231,393-395`
- TaskCard 状态与 `reviewTask` 返回：`docs/09-data-contracts.md:226-261,621-624`
- callback outbox 真实语义：`docs/09-data-contracts.md:290-317`
- readiness DDL 与 outcome：`docs/09-data-contracts.md:407-411`
- config、setup 与 adapter：`docs/09-data-contracts.md:470-568`
- tool contract 与 source 回读缺口：`docs/09-data-contracts.md:600-655`
- P0/P0.5 封闭状态：`docs/09-data-contracts.md:657-672`
- 话术分期与 live steer：`docs/10-voice-ux-spec.md:5-84`
- canonical 与计划优先级冲突：`IMPLEMENTATION-PLAN.md:8-23`、`IMPL-PROMPT.md:17-37`
- 当前 selected adapter 与 Gate 0：`IMPLEMENTATION-PLAN.md:91-108,151-160`
- 当前 P0.5 前置：`IMPLEMENTATION-PLAN.md:125-138`
- 配置模板冲突：`templates/saydo.config.example.toml:39-69`、`templates/saydo.env.example:23-25`
- Hopper 改需求语义冲突：`docs/adr/ADR-001-execution-layer.md:17,47-53`、`docs/09-data-contracts.md:258-259`
- Demo phase 标注传播问题：`demo/saydo-console-demo.html:281,352-353,475-526,595-607,675,760-794`
- 上一份完整 SOL：`research/saydo-product-value-and-gap-analysis-sol.md`
- 另一会话 readback：`research/saydo-review-readback.cursor.md`
- 独立 Codex 终审：`research/codex-findings/11-post-review-reassessment-sol-review.md`
- SQLite 反例原始结果：`voice_dispatch_null_turn_ref|1`、`forget_hard_null_payload|1`、`active_null_dedupe|2`
- 当前物理检查：`SayDo/.git: MISSING`、`hopper-dist: MISSING`、`hopper-vault: MISSING`

## 附录 B · 独立评审与 triage

本轮按项目制度完成两类 subagent 与一路 Codex 独立评审。生成方未把自己的初稿当终审结论。

| 评审 | 总判 | A 级输入 | triage / 本报告行动 |
|---|---|---|---|
| 产品与证据 subagent | Conditional Go | V1 不能称 ITT；冻结 opportunity unit / endpoint / exclusion；metric protocol 不应阻塞 dogfood；外部激活与记忆价值证据不足 | **采纳。** 重写 4.5、5.4、claim gate；自然 dogfood 可先作为 pilot，真正 ITT 推迟到随机 workflow/encouragement |
| 架构安全与集成 subagent | 当前草案收口 No-Go；Phase 0 脚手架 Conditional Go | SourceVerification 无 excerpt/TOCTOU；DDL 实测不闭合；Cursor canary 不能证明 effect 未发生；adapter/receipt/billing identity 断链 | **采纳。** 扩写 4.1、4.3、4.4；把 MemoryEvent/A2/A8 降为部分修复；自主 dispatch 单列 No-Go |
| Codex 11（`gpt-5.6-sol`, max, read-only） | Conditional Go | `reviewTask.rejected`、DDL 强度、Phase -1 分档、配置互斥、ADR 改需求冲突；指出初稿错误引用与方案过重 | **采纳硬伤并回修。** 新增 4.3，按消费点重写 4.6/5.2，修 R30 和 `08:672` 错引；feature manifest、Demo selector、全量 docs-lint 降级 |

分级 triage：

- **A 全采纳**：状态/DDL/receipt、effect Gate 0、SourceSnapshot、authority、消费点 preflight、V1 观察性 protocol、ADR/Hopper 授权语义；
- **B 择要采纳**：工具命名、outbox 文字、shadow schema、静态 Demo badge、确定性 docs-lint；
- **C 延后**：全量自动生成、全局 Demo phase selector、runtime matrix 尚不存在时的文档 manifest；
- **明确不采纳**：
  - 不因 Hopper 尚未物理落地而阻塞所有 Phase 0 脚手架；
  - 不把 feature manifest 建成新的手写真相源；
  - 不把 5–10 个自然基线任务写成非劣或因果比较；
  - 不把价值 protocol 变成 owner 已否决的 stop/go 门。

Codex 首次尝试因调用额外协作流程而无有效收口，第二次停在模型管理刷新；两次均终止并保留日志。第三次使用明确的只读、无协作、限量核查 prompt 完成，启动元数据真实显示：

```text
model: gpt-5.6-sol
sandbox: read-only
reasoning effort: max
```

对应 prompt、最终报告和日志分别为：

- `research/codex-findings/prompts/11-post-review-reassessment-sol-review.md`
- `research/codex-findings/11-post-review-reassessment-sol-review.md`
- `research/codex-findings/logs/11-post-review-reassessment-sol-review.log`
