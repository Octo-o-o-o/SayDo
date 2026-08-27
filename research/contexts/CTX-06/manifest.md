# CTX-06 · 小型服务公司运营

- `as_of`: `2026-08-23`
- `valid_until`: `2026-09-23`
- `claim_scope`: 批准流程用 `service-sop.md`；四周聚合趋势用 `weekly-metrics.md`；个案只用 `ticket-sample.md`。
- `supported_questions`: `PRJ-019, PRJ-027, PRJ-064, WRT-002, WRT-011, WRT-043, WRT-047, RES-030, RES-035, OPS-003, OPS-009, OPS-024, OPS-026, OPS-044, LRN-015`
- `unsupported_scope`: 不含客户级财务明细、授权案例全文、需求预测或自由职业者 CRM 数据。
- 合成组织：十二人的数字化实施工作室。
- 权威顺序：`service-sop.md` 的批准流程 > `ticket-sample.md` 的个案；`weekly-metrics.md` 只覆盖最近四周。
- 目标：发现重复劳动、交接断点和可安全自动化的步骤。
- 限制：不得自动承诺客户工期、发票折扣或合同变更。

来源：

- [service-sop.md](service-sop.md)
- [weekly-metrics.md](weekly-metrics.md)
- [ticket-sample.md](ticket-sample.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:7907cbd4ccdd3a93b9238a0bb55abaa8465fb0c4938301f990823a53361dd503`
- `fixture_sources_digest`: `sha256:24ffa1321409b89371f89aa6aa46c768003cdd8b404b7e0ee47f19613f9bd198`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| LRN-015 | SOP 明列六步交付流程、上线前须由另一位顾问做数据抽检及新增范围须走 change request；样本含 4% 客户编码前导零丢失 | service-sop.md + ticket-sample.md | - |
| OPS-003 | SOP 规定销售、运营、顾问、抽检和财务职责，四周数据与样本显示等待点 | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 读取当前项目、等待时长、owner 和系统状态 |
| OPS-009 | 四周聚合指标可识别逾期、客户输入、返工和尾款异常，但下周实时依赖与拍板项不在 fixture 内 | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 读取下周异常、跨团队依赖和待拍板事项 |
| OPS-024 | 样本项目分别出现字段映射表等待、未开 change request 的 12 小时返工、上线抽检 4% 编码丢失和验收邮件未关联导致尾款晚开九天 | service-sop.md + ticket-sample.md | LIVE 通过 crm/tasks/monitoring 读取同一客户当前等待、审批和风险事件 |
| OPS-026 | 成交到项目建立由 CRM、运营和客户材料衔接，新增范围必须走 change request | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 读取 CRM、项目系统、失败补偿和人工例外状态 |
| OPS-044 | 销售到财务的同一 SOP 与四周指标呈现跨部门等待、返工和尾款共同问题 | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 通过 crm 读取销售事件，通过 tasks/issue-tracker 读取交付与客服事件，通过 finance 读取财务事件 |
| PRJ-019 | 现行 SOP 规定新增范围必须形成 change request，销售口头同意不构成批准；客户原话与原合同正文不在 fixture 内 | service-sop.md | USER 提供客户原话与原合同正文 |
| PRJ-027 | 样本项目 A 因字段映射表迟交且未再次提醒而延期，SOP 要求客户确认后才能配置迁移 | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 读取当前等待天数、客户联系人和可替代路径 |
| PRJ-064 | SOP 覆盖成交、项目建立、访谈、配置迁移、抽检、验收和尾款，样本显示等待与返工节点 | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 读取真实项目的 CRM、合同、任务、验收和尾款状态 |
| RES-030 | 四周指标显示等客户输入、返工与未开尾款上升，四个样本给出具体等待和绕流程点 | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 读取工单时间戳、访谈原文和当前流程日志 |
| RES-035 | 六步交付 SOP 和四类样本问题可区分前台、后台、等待与失败补救 | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 读取客户申请到解决的工单与服务状态 |
| WRT-002 | 项目 A 因缺字段映射表延期，SOP 要求两日内建立项目并收材料，可说明提醒的事实依据 | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 读取缺失材料、影响节点、收件人和最晚日期 |
| WRT-011 | 现行 SOP 有六步入口、抽检、书面验收和 change request 规则，样本列出四类常见误区 | service-sop.md + weekly-metrics.md + ticket-sample.md | USER 提供当前口头交接、例外和升级实践的录音或口述材料 |
| WRT-043 | 六步交付 SOP、新范围 change request 规则和四类典型现场错误 | service-sop.md + ticket-sample.md | - |
| WRT-047 | 现行 SOP 和样本可判断流程内容与常见冲突，但当前知识库页面、替代关系和写权限不在 fixture 内 | service-sop.md + weekly-metrics.md + ticket-sample.md | LIVE 读取知识库目标页面、重复版本、权限和回退状态 |
<!-- corpus:required-claims:end -->
