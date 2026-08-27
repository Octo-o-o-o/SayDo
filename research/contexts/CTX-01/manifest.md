# CTX-01 · SaaS 账单导出

- `as_of`: `2026-08-20`
- `valid_until`: `fixture-frozen`；真实产品状态必须通过 `LIVE` 复核。
- `claim_scope`: 产品范围与验收以 `product-brief.md` 为准；需求线索与样本偏差以 `feedback-notes.md` 为准。
- `supported_questions`: `ENG-008, ENG-009, ENG-027, ENG-035, ENG-037, ENG-056, PRJ-001, PRJ-009, PRJ-017, WRT-015, RES-006, RES-017, DAT-005`
- `unsupported_scope`: 不含代码、真实用量、总账、邮件发送或跨月导出数据；这些输入必须来自 `LIVE`。
- 合成组织：云杉协作，一款面向小团队的订阅制协作工具。
- 截止日期：2026-08-20。
- 权威顺序：`product-brief.md` 的明确合同 > `feedback-notes.md` 的用户需求线索。
- 冲突规则：反馈中的“所有字段”不是已批准范围；若要扩字段，必须先形成范围变更。
- 可推断：高频反馈可用于优先级判断。
- 不可推断：不得从三条反馈外推全部客户比例。

来源：

- [product-brief.md](product-brief.md)
- [feedback-notes.md](feedback-notes.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:c0baa52dd410b956cc4476f3ce818842e51825e348114c3bf210a53a94eb6d6d`
- `fixture_sources_digest`: `sha256:089101de1706365ca5eb867e268eb24be406bd0426b78d1cb4ec635b39539c95`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| DAT-005 | 导出文件的月份、状态、币种和金额字段及金额合计验收；总账与现场导出不在 fixture 内 | product-brief.md | LIVE 读取当前账单导出、总账汇总与对账期间 |
| ENG-008 | 账单导出只允许管理员按单个自然月读取六个固定字段，超过 50,000 行须给出可理解错误 | product-brief.md + feedback-notes.md | LIVE 读取当前 API、权限模型和测试仓库状态 |
| ENG-009 | 获批入口在设置的账单页且仅管理员可用；窄屏布局与其他页面影响不在 fixture 内 | product-brief.md + feedback-notes.md | LIVE 读取当前设置页、断点和交互实现 |
| ENG-027 | 获批产物是 UTF-8 月度 CSV，字段、账户时区、Excel 无乱码和金额合计均有明确验收 | product-brief.md + feedback-notes.md | LIVE 读取现有计费代码、字段 schema 和 Excel 验收环境 |
| ENG-035 | 导出包含账单号、月份、项目、金额、币种和支付状态；fixture 未批准记录账单内容的分析事件 | product-brief.md + feedback-notes.md | LIVE 读取当前埋点规范、代码和日志脱敏规则 |
| ENG-037 | 账单导出明确仅限管理员，无权用户必须得到 403 | product-brief.md + feedback-notes.md | LIVE 读取当前接口权限代码并运行反例测试 |
| ENG-056 | 已批准范围仅是月度账单 CSV，暂不含跨月合并、自动邮件或会计系统直连；模块依赖不在 fixture 内 | product-brief.md + feedback-notes.md | LIVE 读取计费模块依赖、变更记录和故障边界 |
| PRJ-001 | 每月手工复制约 300 行的用户痛点、金额与 Excel 验收关注点，以及当前已批准的导出范围 | product-brief.md + feedback-notes.md | - |
| PRJ-009 | 账单导出的管理员入口、六个固定字段、账户时区、50,000 行限制、403 与 Excel 验收条件 | product-brief.md | - |
| PRJ-017 | 月度账单导出已有入口、固定字段、权限、容量和 Excel 验收边界，可据此拆独立验收故事 | product-brief.md + feedback-notes.md | LIVE 读取当前实现约束与故事跟踪状态 |
| RES-006 | 已批准范围不含自动邮件，三位受访者也都未提出自动邮件；团队转述只能作为待验证假设 | product-brief.md + feedback-notes.md | LIVE 读取当前产品、用户工作流与替代方案证据 |
| RES-017 | 三条带日期的导出反馈、受访者角色、明确未提自动邮件及主动报名样本限制 | feedback-notes.md | - |
| WRT-015 | 账单导出的目标、已批准范围及暂不包含自动邮件和会计系统直连 | product-brief.md | - |
<!-- corpus:required-claims:end -->
