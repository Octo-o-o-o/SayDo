# CTX-13 · 家庭照护协作

- `as_of`: `2026-08-24`
- `valid_until`: `2026-09-18`；复诊后医疗与排期信息必须刷新。
- `claim_scope`: 机构书面行政指示用 `clinic-instructions.md`；家属观察用 `care-notes.md`；日程用 `care-calendar.md`；隐私与协作规则用 `coordination-rules.md`。家属记录不能覆盖机构指示。
- `supported_questions`: `OPS-048, LIF-005, LIF-019, FAM-003, FAM-011, FAM-017`
- `unsupported_scope`: 不含学校、工作、搬家、完整家庭证件索引或任何诊断、疗效与改药依据。
- 合成家庭：三位成年子女共同协助一位独居长辈处理复诊、用药记录和生活安排。
- 本包用于行政整理与就医准备，不提供诊断或用药决定。
- 权威规则：机构书面行政指示只约束材料与复诊准备；药物冲突必须保持 unknown 并交专业人员核对。
- 隐私：共享时只给需要知道的人；对外发送前必须人工确认收件人和字段。

来源：

- [care-calendar.md](care-calendar.md)
- [clinic-instructions.md](clinic-instructions.md)
- [care-notes.md](care-notes.md)
- [coordination-rules.md](coordination-rules.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:c741719cb362312c372b0684be35c2f965bdfc1b8f53231d17d02f9e1062d62e`
- `fixture_sources_digest`: `sha256:72d2181b2a476df4ae9511f8a22635e8398acd5d49ba1aaf397b95eff94ad74f`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| FAM-003 | 复诊日期、两周血压材料、冲突用药清单、头晕记录要求和可用接送人 | clinic-instructions.md + care-notes.md + care-calendar.md | - |
| FAM-011 | 复诊、生活支持、票据与家庭复盘节点，以及取消、隐私和医疗决定边界 | clinic-instructions.md + care-calendar.md + coordination-rules.md | - |
| FAM-017 | 复诊与生活支持节点、待专业核对的冲突清单、家庭协作和最小共享边界；一年期当前记录不在 fixture 内 | clinic-instructions.md + care-notes.md + care-calendar.md + coordination-rules.md | LIVE 读取一年期照护进展、症状、支持安排和费用现势 |
| LIF-005 | 家属记录包含头晕时间缺口和两张冲突用药清单，机构要求由专业人员核对而非自行判断 | clinic-instructions.md + care-notes.md + care-calendar.md + coordination-rules.md | USER 提供最近症状和两张冲突清单；LIVE 通过 calendar 读取当前复诊安排 |
| LIF-019 | 机构要求按日期与时段整理血压，家属记录含待核头晕与用药冲突，医疗材料须受限共享；每周当前记录不在 fixture 内 | clinic-instructions.md + care-notes.md + coordination-rules.md | LIVE 读取当前血压、症状与生活记录；只保留连续记录所需的最小字段 |
| OPS-048 | 复诊材料要求、预约取消双重确认、医疗信息最小共享与专业决定边界；当前预约、渠道状态和患者本次授权不在 fixture 内 | clinic-instructions.md + care-calendar.md + coordination-rules.md | USER 提供患者或事项 owner 的明确授权、收件人和可共享字段边界；LIVE 读取当前预约与渠道状态 |
<!-- corpus:required-claims:end -->
