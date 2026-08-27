# CTX-12 · 搬家项目

- `as_of`: `2026-08-24`
- `valid_until`: `2026-09-30`；报价按各自有效期更早失效。
- `claim_scope`: 家庭硬约束用 `constraints.md`；供应商自报价格用 `vendor-quotes.md`；未批准排期只用 `moving-plan.md` 草案。
- `supported_questions`: `OPS-013, LIF-008, LIF-013, FAM-009`
- `unsupported_scope`: 只支持本次同城搬家，不支持办公室搬迁、跨城择校或多代家庭迁移。
- 合成家庭：两位成人、一名学龄儿童、一只猫，从同城两居室搬到三居室。
- 最晚交房：2026-09-30；新房 2026-09-25 可入住。
- 权威顺序：`constraints.md` 的硬约束 > `moving-plan.md` 草案 > `vendor-quotes.md` 的报价。
- 限制：不得替用户付款、签合同或选择保险条款；报价有效期需复核。

来源：

- [constraints.md](constraints.md)
- [vendor-quotes.md](vendor-quotes.md)
- [moving-plan.md](moving-plan.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:e5d16ffa06f743c4792230f26407703e90f0605040b5232b46f5ef72b2cbf409`
- `fixture_sources_digest`: `sha256:901feebccae9a129da7b780d26723309d10dd50d337c2399042b43de0d7c2f29`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| FAM-009 | 家庭硬约束和搬家计划可拆打包、接送、宠物与交房依赖，当前人员可用性需刷新 | moving-plan.md + vendor-quotes.md + constraints.md | LIVE 读取家人当前可用性、任务完成和预约状态 |
| LIF-008 | 电梯、网络、学校、宠物和预算是硬约束，供应商报价有明确有效期且未上门核物量 | moving-plan.md + vendor-quotes.md + constraints.md | USER 提供现有报价和电梯、网络预约回执；LIVE 通过 browser 读取替代搬家公司，通过 calendar/tasks/maps 读取预约、关键路径和路程状态 |
| LIF-013 | 搬家计划、三家报价有效期和电梯网络硬约束已登记，当前预约与新报价不在 fixture 内 | moving-plan.md + vendor-quotes.md + constraints.md | LIVE 读取当前供应商报价、有效期和预约确认 |
| OPS-013 | 三家冻结报价在搬运、清洁、临储和有效期上口径不同，保险范围尚未比较 | moving-plan.md + vendor-quotes.md + constraints.md | LIVE 读取三家当前报价、保险和额外收费明细 |
<!-- corpus:required-claims:end -->
