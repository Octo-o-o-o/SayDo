# CTX-07 · 企业销售机会

- `as_of`: `2026-08-22`
- `valid_until`: `2026-10-31`；进入合同谈判后必须刷新。
- `claim_scope`: 客户业务目标与现场不确定项用 `discovery-call.md`；账户阶段与相关方用 `account-brief.md`；书面安全要求用 `security-questions.md`。本包不存在正式 RFP。
- `supported_questions`: `PRJ-025, PRJ-061, WRT-023, RES-013, RES-021, OPS-019, SAL-001, SAL-002, SAL-003, SAL-004, SAL-005, SAL-006, SAL-007, SAL-020, SAL-023, LRN-006`
- `unsupported_scope`: 不含系统架构、删除传播链、多次访谈、顾问委员会、跨十国交易或完整账户历史。
- 合成客户：Rivermark Manufacturing，约 2,400 名员工。
- 权威规则：业务需求以客户原话为准；安全要求以书面预问卷为准；阶段与相关方以账户摘要为准；销售推测不能覆盖任何上述 claim。
- 阶段：技术评估前，尚未进入合同谈判。
- 红线：不得代表客户承诺预算，不得擅自回答未确认的安全能力。

来源：

- [account-brief.md](account-brief.md)
- [discovery-call.md](discovery-call.md)
- [security-questions.md](security-questions.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:a512366d971e1cd4bc55b5423b9c7c4927ccea91d1bd758712a22f8bf3716ed0`
- `fixture_sources_digest`: `sha256:c5f49a745d398bbd736058ceff0c9612414370220f87a26c09f0aa9ccd60c137`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| LRN-006 | 账户资料记录采购流程目标、关键角色、审计关注、例外流程和离线要求尚未确认 | account-brief.md + discovery-call.md | USER 提供下周客户会的日期、练习目标和本人当前表达 |
| OPS-019 | 六类安全问题、未决答复和销售不得代填的责任边界，只作为字段与责任模板；三份真实供应商问卷来自现场系统 | security-questions.md | LIVE 读取三份真实供应商安全问卷、当前 owner 与答复时限 |
| PRJ-025 | 账户简报和发现会区分客户原话、阶段与未确认预算签署人；本轮新增承诺需读现场记录 | account-brief.md + discovery-call.md + security-questions.md | LIVE 通过 crm/messaging 读取本轮客户承诺与聊天记录，通过 tasks 读取履约状态 |
| PRJ-061 | 客户目标、相关方和安全问题可作为会议背景，但参会同意、共享层级与正式授权不在 fixture 内 | account-brief.md + discovery-call.md + security-questions.md | LIVE 读取参会同意、共享层级、各方立场和授权状态 |
| RES-013 | 客户目标、总部与工厂范围、关键相关方、试点节点及预算签署未知项可构成会前简报 | account-brief.md + discovery-call.md + security-questions.md | LIVE 读取客户公司、系统环境和公开风险现势 |
| RES-021 | 客户提到工厂网络不稳但未确认离线为硬要求；目标平台限制和最小 spike 证据不在 fixture 内 | account-brief.md + discovery-call.md + security-questions.md | LIVE 核验目标平台限制与当前实现 |
| SAL-001 | 账户阶段、客户原话、关键角色和未确认预算签署人可与 CRM 当前事实和销售猜测分层 | account-brief.md + discovery-call.md + security-questions.md | LIVE 读取当前 CRM、会议前账户变化和销售备注 |
| SAL-002 | 客户目标、审计与例外关注、未决离线要求和试点节点可用于跟进；当前收件人与日期不在 fixture 内 | account-brief.md + discovery-call.md + security-questions.md | USER 提供刚结束电话的录音或转写；LIVE 通过 transcription/crm 读取客户目标与未决问题，通过 email/tasks 读取收件人、日期和下一步 |
| SAL-003 | 现有资料只确认客户需求与六项安全问法，第 4、5 项内部答案仍是草案 | account-brief.md + discovery-call.md + security-questions.md | LIVE 读取当前产品能力证据 |
| SAL-004 | 安全问卷六项中分包商与漏洞 SLA 只有草案，销售不得自行填完全支持 | account-brief.md + discovery-call.md + security-questions.md | LIVE 读取正式安全材料、草案版本和当前 owner |
| SAL-005 | 有客户原话支撑的痛点、阶段和时间约束，以及未确认的预算与最终签署人 | account-brief.md + discovery-call.md | - |
| SAL-006 | 客户最关心的审计、例外处理、网络条件与六个月实施红线 | account-brief.md + discovery-call.md | - |
| SAL-007 | 客户关于六个月实施不可接受的原话、网络与例外流程顾虑及未确认预算 | discovery-call.md | - |
| SAL-020 | 账户简报记录十月试点决策，离线要求尚待现场确认；本次会后原话与 CRM 状态需实时补充 | account-brief.md + discovery-call.md + security-questions.md | LIVE 读取本次会后原话、CRM 状态和写入目标 |
| SAL-023 | 客户试点时间预期、业务目标、关键相关方、例外流程与离线要求的未知状态 | account-brief.md + discovery-call.md | - |
| WRT-023 | 客户要求书面回答的六项安全问题，以及第 4、5 项当前只有草案的明确缺口 | security-questions.md | USER 提供当前获批产品安全答案、不支持项、版本和批准状态 |
<!-- corpus:required-claims:end -->
