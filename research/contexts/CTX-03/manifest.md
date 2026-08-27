# CTX-03 · B2B 产品发布

- `as_of`: `2026-08-24`
- `valid_until`: `2026-10-15`；超过日期后只作历史 fixture。
- `claim_scope`: 已批准范围与成功标准用 `launch-brief.md`；相关方偏好用 `stakeholder-notes.md`；里程碑仅是 `milestones.md` 中的草案。
- `supported_questions`: `ENG-046, ENG-068, ENG-091, PRJ-002, PRJ-004, PRJ-006, PRJ-008, PRJ-010, PRJ-012, PRJ-014, PRJ-018, PRJ-028, PRJ-031, PRJ-035, PRJ-037, PRJ-047, PRJ-054, WRT-013, WRT-046, MKT-011, MKT-020, MKT-022`
- `unsupported_scope`: 不含 repo 实现、真实 API 消费量、当前任务状态或正式批准后的最终里程碑。
- 合成产品：Atlas 审批中心 2.0。
- 计划发布时间：2026-10-15。
- 权威顺序：`launch-brief.md` 的范围与成功标准 > `stakeholder-notes.md` 的个人偏好。
- 未决事项：迁移批次、销售演示环境、旧 API 下线日期。
- 不得把未决事项写成已经决定。

来源：

- [launch-brief.md](launch-brief.md)
- [stakeholder-notes.md](stakeholder-notes.md)
- [milestones.md](milestones.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:2c2770be128f7c6d54e05d9f233cf8be16921fd93901c52e2925100d78f08090`
- `fixture_sources_digest`: `sha256:adfa435ca30b6b26ba74b31a252533d4992c7cd0da2ea7a1aa0d216c6f694185`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| ENG-046 | 审批中心 2.0 范围、成功标准、迁移风险、权限疑问和目前无法验证的依赖 | launch-brief.md + milestones.md + stakeholder-notes.md | - |
| ENG-068 | 审批中心首发含只读 API，旧 API 日落日期和迁移失败回滚窗口仍需拍板 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取当前 API 消费者、实现与迁移遥测 |
| ENG-091 | 旧 API 日落尚未决定，迁移需分批并保留观察；当前消费者和新增大客户不在 fixture 内 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 通过 monitoring 读取当前消费者遥测，通过 crm 读取大客户依赖，并用 repo/api 核对下线实现 |
| MKT-011 | 获批目标客户与首发范围、销售提出的候选卖点、待验证成功标准、未获批准的群发主张和不能承诺的能力 | launch-brief.md + stakeholder-notes.md | - |
| MKT-020 | GA、文档客服冻结、演示环境和迁移演练已有节点，发布当天群发尚未获批 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取各渠道当前内容、排期、owner 和审批状态 |
| MKT-022 | 产品门、两轮试点、销售演示、客服培训与迁移演练存在明确依赖和缺口 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 通过 repo/test 读取产品门，通过 crm 读取试点，通过 tasks/issue-tracker 读取培训与客服就绪状态 |
| PRJ-002 | 审批中心 2.0 的目标客户、首发范围、不做项、成功标准和待拍板事项 | launch-brief.md + stakeholder-notes.md | - |
| PRJ-004 | 发布范围、计划里程碑、已知依赖和各方偏好已记录，但访谈纪要不等于正式决定 | launch-brief.md + milestones.md + stakeholder-notes.md | USER 提供刚结束会议的录音、转写或消息记录；LIVE 通过 transcription/tasks 读取会议内容与当前行动项 |
| PRJ-006 | 审批中心的目标、首发范围、成功标准、迁移风险与安全复审依赖可构成开工基线 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取当前风险、依赖、owner 与验收状态 |
| PRJ-008 | 计划 GA 为 2026-10-15，功能冻结、试点、迁移演练、文档培训和安全复审有前置节点 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取当前里程碑、owner 和未决项 |
| PRJ-010 | 销售希望九月底有演示环境，工程要求十批迁移并各观察 24 小时，二者形成可见冲突 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取当前工程容量、演示需求和依赖状态 |
| PRJ-012 | 10 月 15 日计划 GA、前置里程碑、未满足依赖和可用于范围取舍的首发边界 | launch-brief.md + milestones.md | - |
| PRJ-014 | 旧 API 日落、回滚窗口和未获批群发仍是待决事项；当前已确认决定需从项目系统读取 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取已确认决定、变更理由和项目工作区写入权限 |
| PRJ-018 | 首发范围包括条件审批、委托、审计导出和只读 API，可用于限定三条演示路径 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取当前原型资产、实现边界和评审反馈 |
| PRJ-028 | 功能、迁移、安全复审、文档客服冻结和回滚窗口均有明确就绪条件或未知项 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取功能、迁移、支持、安全、文档和回滚证据 |
| PRJ-031 | 发布日期、首发范围、迁移抽样和各方偏好已有记录；昨天新增决定不在 fixture 内 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取昨天以来新增决定、冲突与待问事项 |
| PRJ-035 | 安全复审、试点客户、迁移演练、文档培训与 GA 构成带未满足依赖的发布链 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取当前依赖状态、owner 和关键路径 |
| PRJ-037 | 试点成功需两周内建立流程且迁移状态一致，试点二客户尚未找到 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取 beta 客户候选、招募授权和反馈状态 |
| PRJ-047 | 来源事实：首发面向财务、采购和 IT 管理员，试点成功门为两周内 80% 建立新流程；10 月 8 日安排文档与客服培训，试点二尚缺客户，迁移仅在 50 租户测试环境中验证。是否构成采用风险属于后续分析，不是来源原文结论 | launch-brief.md + milestones.md + stakeholder-notes.md | - |
| PRJ-054 | 产品、工程、销售、客服和法务对发布的偏好、约束与待拍板事项；正式 RACI 和授权范围不在 fixture 内 | launch-brief.md + stakeholder-notes.md | USER 提供正式 RACI、授权政策和例外升级规则 |
| WRT-013 | 客户最可能追问的迁移和委托可见性问题，以及首发功能与不做项 | launch-brief.md + stakeholder-notes.md | - |
| WRT-046 | 首发功能、不可承诺项和客户最关心的迁移权限问题已有共同事实源；各渠道当前版本与批准状态不在 fixture 内 | launch-brief.md + milestones.md + stakeholder-notes.md | LIVE 读取各渠道当前事实、草稿、排期和逐渠道批准状态 |
<!-- corpus:required-claims:end -->
