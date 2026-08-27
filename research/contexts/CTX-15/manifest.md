# CTX-15 · 经营指标仓库

- `as_of`: `2026-08-24T00:00:00Z`
- `valid_until`: `2026-09-24`
- `claim_scope`: 批准指标定义用 `metric-contracts.md`；数据路径与已知风险用 `lineage-notes.md`；异常只用 `anomaly-report.md` 形成调查假设。
- `supported_questions`: `ENG-062, RES-036, DAT-002, DAT-003, DAT-006, DAT-008, DAT-014, DAT-015, DAT-017, DAT-028, LRN-018`
- `unsupported_scope`: 不含 SQL 执行计划、索引、数据库 schema 变更或真实生产写权限。
- 合成公司：订阅制协作软件。
- 权威顺序：`metric-contracts.md` 的批准口径 > `lineage-notes.md` > `anomaly-report.md` 的异常假设。
- 数据截止：2026-08-24 00:00 UTC。
- 限制：异常报告只指向调查方向，不应直接改数或归因。

来源：

- [metric-contracts.md](metric-contracts.md)
- [lineage-notes.md](lineage-notes.md)
- [anomaly-report.md](anomaly-report.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:f4b2ab45f0ba60e341c3d6dac6edc6c4a815e9380f3beb5eb5a892fdb02b4e0a`
- `fixture_sources_digest`: `sha256:837b73cfb0fbabf2a3162f67e29dfae677595f680ca81a2ecff5e0a415cabf9b`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| DAT-002 | 指标合同、移动端重复事件和 8 月 20 至 23 日异常窗口可区分口径、血缘与质量跳变 | metric-contracts.md + lineage-notes.md + anomaly-report.md | LIVE 读取本周看板、查询、血缘和质量状态 |
| DAT-003 | activation 从 31.2% 升至 36.9% 的日期、移动端重复事件证据和指标排除规则 | anomaly-report.md + lineage-notes.md + metric-contracts.md | - |
| DAT-006 | 重复事件窗口、数据血缘、内部用户与回填排除规则；原始事件和执行连接需实时补充 | anomaly-report.md + lineage-notes.md + metric-contracts.md | LIVE 读取原始事件、查询环境并执行 cohort 重算 |
| DAT-008 | active workspace、activation、MRR 和 churn 均有公式与排除项，owner 和刷新机制不在 fixture 内 | metric-contracts.md + lineage-notes.md + anomaly-report.md | LIVE 读取当前 owner、刷新频率、查询和反例样本 |
| DAT-014 | 指标口径、异常停止信号和保留原始分区要求已登记；每周当前数据与发布状态需实时读取 | metric-contracts.md + lineage-notes.md + anomaly-report.md | LIVE 读取每周当前数据、延迟异常和报告发布状态 |
| DAT-015 | gross MRR 与 net MRR 的差异和订阅血缘已明确；当前两份报告、目标节点与写权限不在 fixture 内 | metric-contracts.md + lineage-notes.md + anomaly-report.md | LIVE 读取两份报告、血缘目标节点、影响范围和写入权限 |
| DAT-017 | fixture 只含指标合同、既有血缘和日期异常；用户手工表、字段映射、目标表、回填窗口与写权限均不在 fixture 内 | metric-contracts.md + lineage-notes.md + anomaly-report.md | USER 提供手工表正文、字段含义和允许迁移范围；LIVE 读取目标表、回填窗口、写权限与 staging 状态 |
| DAT-028 | 指标排除规则、移动端重复事件和回填批次要求可定义质量门；当前数据、quarantine 目标与通知对象不在 fixture 内 | metric-contracts.md + lineage-notes.md + anomaly-report.md | LIVE 读取当前数据、质量阈值、quarantine 目标和通知 owner |
| ENG-062 | 现有血缘说明事件去重、内部租户过滤和分区保留要求；目标管线代码与运行状态不在 fixture 内 | metric-contracts.md + lineage-notes.md + anomaly-report.md | LIVE 读取目标管线代码、运行状态、迟到数据和重跑环境 |
| LRN-018 | 重复事件、血缘和指标口径可构成事故案例，但原始客户信息与教学去敏标准不在 fixture 内 | metric-contracts.md + lineage-notes.md + anomaly-report.md | LIVE 读取经授权事故数据、去敏范围和教学验收环境 |
| RES-036 | gross MRR、net MRR 等口径和订阅血缘已定义，可定位定义与查询分叉但不授权重跑回填 | metric-contracts.md + lineage-notes.md + anomaly-report.md | LIVE 读取当前查询、SQL 血缘、owner 和报告分叉 |
<!-- corpus:required-claims:end -->
