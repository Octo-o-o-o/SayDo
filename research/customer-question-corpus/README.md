# SayDo 潜在客户生产力提问语料

本目录是一组面向产品研究、需求发现和测试设计的合成场景语料。它包含恰好 600 个生产力场景，每条都记录潜在客户会怎么问、真正想达到什么目的，以及复杂度、首个可审阅结果时延、现实周期、轮次、工具、安全风险和 SayDo 能力匹配档。

它不是可直接计分的多轮 benchmark。`R2`–`R4` 表示预计交互量，不代表本目录已经附带完整 transcript、授权状态和验收 oracle；要做自动评测，应从本语料选定子集后再补这些 fixture。这样可以避免把“问题清单完整”误写成“执行评测完整”。

这不是使用日志，也不是市场份额调查。`H/M/L` 表示“合格目标人群在未来 12 个月主动提出这类请求”的专家启发式先验，不能被引用为真实客户概率。每个领域都按目标人群覆盖、触发频次、自然表达可能性和罕见事件惩罚做人工全局校准，再满足固定配额；构建器只保留经复审确认的分档和少量相对顺序断言，不用 ID 或复杂度机械决定频率。外部访谈或遥测到位后，应覆盖这组先验而不是为它辩护。

## 文件导航

- [00-能力边界.md](00-%E8%83%BD%E5%8A%9B%E8%BE%B9%E7%95%8C.md)：从 canonical 与当前交接状态提炼的能力边界。
- [01-设计与分布.md](01-%E8%AE%BE%E8%AE%A1%E4%B8%8E%E5%88%86%E5%B8%83.md)：采样方法、标签定义、领域配额和验收口径。
- [questions/](questions/)：12 组问题，共 600 条。
- [contexts/](contexts/)：16 组合成上下文包，供需要 RAG、冲突消解或来源核验的条目复用。
- [contracts/](contracts/)：465 条 `LIVE` 逐对象来源登记与 46 条最终 `F1` 能力合同的显式生成源。
- [04-live-source-contracts.md](04-live-source-contracts.md)：由构建器生成的人可读 LIVE/F1 合同交付，共登记 986 个现势对象来源。
- [02-覆盖索引.md](02-%E8%A6%86%E7%9B%96%E7%B4%A2%E5%BC%95.md)：组织规模、角色、生命周期、生活生产力和渠道盲区的可复核索引。
- [03-频率与语义校准.md](03-%E9%A2%91%E7%8E%87%E4%B8%8E%E8%AF%AD%E4%B9%89%E6%A0%A1%E5%87%86.md)：频率判断、自然度、工具/输入闭合、风险与上下文事实契约的维护规则。
- [review/](review/)：独立评审结果与覆盖复核(20 份评审输出;回修本身落在语料正文与 prompts/codex-findings 的往返记录,本目录不含回修记录文档;编号 03/06 从未使用)。
- [simulations/](simulations/)：从 600 条中选取 72 条做多轮模拟回放。这是代表性演练材料，不是真实使用日志，也不能当作 connector 已接通或市场概率已验证。
- [validate.mjs](validate.mjs)：不依赖第三方包的全量结构门禁。
- [rebuild.mjs](rebuild.mjs)：保留人工改写、语义去重、分层频率先验和标签派生规则的可重复构建脚本。
- [test-mutations.mjs](test-mutations.mjs)：在临时副本注入已知反例，证明类别门禁会真实报错且正式树不变。

## 使用方式

单条回放时，先读取问题行中的 `上下文模式`：

- `-`：问题本身足以开始澄清，无需预置材料；
- `CTX-xx`：加载本仓的合成 fixture，先读对应 `manifest.md`；
- `USER`：必须由被访者提供附件、粘贴文本或口述记录，本仓不伪造这份个人输入；
- `LIVE`：必须读取当前 repo、系统、SaaS connector 或新鲜 Web 数据，并在 `contracts/live/*.json` 为每个所读对象登记具体 locator、题面所需字段、相称 reader、权威、新鲜度、`as_of` 与授权主体/范围，不能用冻结 fixture 冒充现势；
- 多种输入用 `+` 连接，例如 `CTX-03+LIVE` 表示发布 brief 已配套，但代码、项目状态或 connector 仍须现场读取。

`CTX` 是回放前注入的 fixture，不计入 `K`；工具列里的 `rag` 表示运行时还要在输入集合中检索。两者不是同义词。

若要做多轮回放，使用 [simulations/](simulations/) 中的 72 个会话。它们补了用户后续轮次、fixture 事件和 oracle，但仍是代表性模拟，不是使用日志，也不能替代真实执行 benchmark。

16 个 manifest 共有 172 条由构建脚本生成的 `required claims`、对应 50 个冻结来源文件。每一条都逐题列出该 fixture 实际支持的题目相关事实、具体来源文件，以及仍需 `USER` 或 `LIVE` 补齐的实体、字段、现势或权限；不允许用包级通用兜底代替逐题合同。`supported_questions` 只表示允许引用，`required claims` 才是可判定的事实闭合合同。

推荐将以下信号分别评分，不要合成一个模糊总分：

1. 是否识别用户的真实目的，而不只是复述表层请求；
2. 是否只追问会改变产出、范围、验收、安全等级或执行路径的问题；
3. 是否正确使用已给上下文并保留来源与冲突；
4. 是否选择与任务相称的工具和执行周期；
5. 是否在 S2/S3 或能力边界处主动设置人在环；
6. 是否诚实区分当前可做、需人工配合、路线图能力和明确边界。

`能力/边界` 形如 `F2/B-MED`：`F` 描述执行器成熟度，`B` 描述需要守住的专业、隐私、身份或授权边界。安全地整理就医材料可以是 `F2/B-MED`，只有用户要求诊断、改药或越权行动时才是 `F4`。

## 验证

```bash
node research/customer-question-corpus/rebuild.mjs
node research/customer-question-corpus/validate.mjs
rg --files -0 research/customer-question-corpus | xargs -0 bash scripts/check-emoji.sh
```

构建器先在同级临时目录生成全部问题、manifest 和 `04-live-source-contracts.md`，并在那里运行完整验证；验证通过后才依次晋升 `questions/`、`contexts/` 与 04 交付。可捕获的晋升失败会恢复旧产物，故障注入会验证这一点；它不是断电或进程强杀场景下的文件系统事务。验证器会检查固定文件集、总数、领域与频率配额、ID 唯一性、所有表格候选行、字段完整性、各档覆盖、工具唯一性与深度、上下文模式、50 个来源文件、172 条逐题 required claims、有效期、频率反耦合、自然度、全量 179700 对近重复和一组已知语义反例。全部 465 条 `LIVE` 必须与来源合同严格一一对应，986 个登记对象按 `source_kind` 核对 reader、locator、字段、新鲜度和授权范围；`CTX+LIVE` 还要与 manifest supplemental 对称。最终 46 条 `F1` 逐题锁定缺省 coding/workspace 基线、工具、允许 effect、验证证据与排除范围，另登记两条经复核降为 `F2` 的记录。三份 v7 终审输入出现的 99 个 ID、16 个 manifest 与两类注册表都有精确摘要基线。`rag`、`document`、`pdf`、`automation` 和 `notification` 不能冒充任意现势 reader。临时条件必须归因于题面或 `USER`，不能写成 fixture 事实。`test-mutations.mjs` 会在临时副本破坏这些类别并要求 validator 非零退出。验证器仍不替代逐题语义评审，也不能证明任意 claim 与来源之间的任意语义蕴含、真实授权有效性或市场概率；真实频率、自然度和能力边界仍需访谈、遥测及独立人工审查。
