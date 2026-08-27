# CTX-16 · 供应商采购

- `as_of`: `2026-08-24`
- `valid_until`: `2026-09-30`；价格、产品功能和厂商状态必须通过 `LIVE` 复核。
- `claim_scope`: 评审权重与硬门用 `evaluation-rules.md`；需求和验收用 `rfp-summary.md`；能力与价格相关陈述只按 `vendor-responses.md` 的厂商自报处理。
- `supported_questions`: `PRJ-034, PRJ-040, WRT-008, WRT-050, RES-002, OPS-029, SAL-014, SAL-015, SAL-022, SAL-029, SAL-035, SAL-042, SAL-044`
- `unsupported_scope`: 不含代码供应链、软件交付审计、监管披露、客服工单明细、一般供应商绩效或课程题库。
- 合成采购：为 180 人公司选择新的工单与知识库平台。
- 采购上限：首年 420,000 元，含迁移与培训。
- 权威顺序：`evaluation-rules.md` 的评审规则 > `rfp-summary.md` 的需求 > `vendor-responses.md` 的厂商自报。
- 厂商陈述未经证明前只能标“自报”，不能标“已满足”。

来源：

- [rfp-summary.md](rfp-summary.md)
- [evaluation-rules.md](evaluation-rules.md)
- [vendor-responses.md](vendor-responses.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:2af5e0424abd8bfaac8a2f275175d9e1c773f06178149f7589eab2b88b225c6c`
- `fixture_sources_digest`: `sha256:70a72c7bc3ff72e82f38cb8565f3c36eb35c2dd3028169fda3b8f815e625763d`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| OPS-029 | RFP 必须项、五项权重、独立评分和安全书面通过规则已明确；当前发题收件与审批状态不在 fixture 内 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | LIVE 读取当前发题、材料收件、评分、共识会和审批状态 |
| PRJ-034 | 12,000 篇迁移规模、500 篇抽样要求、附件权限时间字段和必须项停门 | rfp-summary.md + evaluation-rules.md | - |
| PRJ-040 | RFP 要求沙箱真实流程、500 篇迁移抽样、安全书面通过和回退证据，采购完成不等于上线 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | LIVE 读取目标系统配置、迁移数据、培训、试点和回退状态 |
| RES-002 | 三家厂商回复均为 2026-08-24 冻结自报，必须项和评分规则可用；真实流程实测结果不在 fixture 内 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | LIVE 读取厂商当前能力、价格、独立来源和三条真实流程实测结果 |
| SAL-014 | 三年总拥有成本透明要求、安全必须项硬门、迁移抽样验收与三家厂商冻结自报差异 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | LIVE 通过 browser 刷新厂商产品状态，通过 test 读取迁移实测，通过 tasks 读取审批状态，通过 spreadsheet/finance 读取价格和三年 TCO |
| SAL-015 | RFP 定义三条真实流程和迁移抽样，厂商回复只是自报，当前 demo 与 POC 实测需另取 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | LIVE 读取当前厂商环境、演示材料和 POC 实测证据 |
| SAL-022 | 必须项、评分维度和厂商未答缺口可拆 owner 与证据任务，当前答复和截止状态不在 fixture 内 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | LIVE 读取当前答复、owner、证据版本、风险和截止状态 |
| SAL-029 | 我方安全硬门、厂商自报差异、证据缺口及安全团队书面审批要求 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | - |
| SAL-035 | 必须项不能靠加权分绕过，POC 需真实流程、迁移抽样和安全书面通过；当前实测不在 fixture 内 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | LIVE 读取 POC 实测、迁移抽样和安全审批现势 |
| SAL-042 | RFP 给出迁移规模、抽样验收、安全硬门和三年成本要求；现合同退出、双跑与业务中断事实由用户提供 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | USER 提供现合同退出、双跑与业务中断事实 |
| SAL-044 | 共同 RFP 硬门与评分规则已确定；五个子公司的本地需求、冲突声明和独立评分由用户提供 | rfp-summary.md + evaluation-rules.md + vendor-responses.md | USER 提供五个子公司的本地需求与利益冲突声明 |
| WRT-008 | RFP 必须项、可延期项、迁移验收和厂商自报中需要继续确认的能力 | rfp-summary.md + vendor-responses.md | - |
| WRT-050 | 五项权重、必须项否决规则和三家厂商冻结自报与未答缺口 | evaluation-rules.md + vendor-responses.md | - |
<!-- corpus:required-claims:end -->
