# CTX-09 · 季度预算

- `as_of`: `2026-08-24`
- `valid_until`: `2026-09-30`；关账后实际数必须刷新。
- `claim_scope`: 2026 年第三季度批准预算与聚合实际用 `budget-summary.md`；审批规则用 `expense-policy.md`；差异原因只用 `variance-notes.md` 的待确认假设。
- `supported_questions`: `WRT-018, WRT-028, RES-020, OPS-005, OPS-021, DAT-004, DAT-009, DAT-016`
- `unsupported_scope`: 不含逐张发票、订阅席位、审批队列、关账凭证、全年现金流、税务或融资底表。
- 合成组织：三十人的产品设计公司。
- 币种：人民币；金额均为不含税内部管理数。
- 权威顺序：`budget-summary.md` 的批准预算 > `expense-policy.md` 的规则 > `variance-notes.md` 的解释假设。
- 限制：可做核对、预测和草稿，不得自动付款、报税或认定会计处理。

来源：

- [budget-summary.md](budget-summary.md)
- [expense-policy.md](expense-policy.md)
- [variance-notes.md](variance-notes.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:42205f9373c510563e64c2cee761468de8e80efb9fd4d66cf797ab9cf56bb4b0`
- `fixture_sources_digest`: `sha256:f65f958e68bcb8868c9f09a6cdb239c596d361d36c44f0ba0724a5719cfbb5b6`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| DAT-004 | 季度实际、采购单与已签合同承诺、未批准申请和未关账状态有明确分层 | budget-summary.md + expense-policy.md + variance-notes.md | LIVE 读取当前实际、承诺、未批准申请和关账状态 |
| DAT-009 | 五类预算、实际与承诺金额，以及尚未关账和待 owner 确认的差异解释 | budget-summary.md + variance-notes.md | - |
| DAT-016 | 差异说明中 6 个闲置席位、提前 workshop、场地订金和外包延期均待 owner 确认 | budget-summary.md + expense-policy.md + variance-notes.md | LIVE 读取已确认差异、owner 答复和剩余假设 |
| OPS-005 | 五类季度预算、7 至 8 月实际和 9 月已承诺金额齐备，实际尚未关账 | budget-summary.md + expense-policy.md + variance-notes.md | LIVE 读取当前采购承诺、关账状态和预算 owner 确认 |
| OPS-021 | 费用政策明确审批阈值、国际差旅书面批准和发票字段要求，不回答税务归类 | budget-summary.md + expense-policy.md + variance-notes.md | LIVE 读取本次报销单、发票和审批状态 |
| RES-020 | 软件订阅预算、7 至 8 月实际、9 月承诺和 18 个新增席位中 6 个待核的运营线索 | budget-summary.md + variance-notes.md | LIVE 读取当前席位登录、合同和续费记录 |
| WRT-018 | 费用政策给出金额审批、国际差旅、续费、发票和紧急采购规则，税务归类不在范围 | budget-summary.md + expense-policy.md + variance-notes.md | LIVE 读取当前正式费用政策版本与发布状态 |
| WRT-028 | 季度预算、实际与承诺金额以及未关账和待 owner 确认的解释可分开写经营叙事 | budget-summary.md + expense-policy.md + variance-notes.md | LIVE 读取本季度项目、预算、关账和解释确认状态 |
<!-- corpus:required-claims:end -->
