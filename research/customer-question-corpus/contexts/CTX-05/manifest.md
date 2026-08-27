# CTX-05 · 东南亚市场进入

- `as_of`: `2026-08-20`
- `valid_until`: `2026-09-20`；法规、价格与竞品现势仍必须通过 `LIVE` 刷新。
- `claim_scope`: 调研问题与交付边界用 `research-brief.md`；访谈原始线索与样本偏差用 `interview-notes.md`；冻结外部事实用 `official-and-market-snapshot.md`；检索状态用 `source-register.md`。
- `supported_questions`: `PRJ-021, PRJ-048, PRJ-057, WRT-022, RES-001, RES-016, MKT-012, MKT-016, MKT-018, MKT-021`
- `unsupported_scope`: 不含五家竞品全量研究、十份完整材料、十国本地审批或一年持续情报系统。
- 合成公司：一家面向中小企业的库存 SaaS。
- 调研问题：先评估新加坡、马来西亚、泰国三个市场，不直接决定进入国家。
- 原始研究截止日期：2026-08-01；本包于 2026-08-20 补入冻结快照，动态使用仍须重新联网核验。
- 权威顺序：官方统计和监管来源 > 一手访谈 > 行业报告摘要 > 团队假设。
- `interview-notes.md` 仅有六位受访者，不能代表市场比例。

来源：

- [research-brief.md](research-brief.md)
- [interview-notes.md](interview-notes.md)
- [official-and-market-snapshot.md](official-and-market-snapshot.md)
- [source-register.md](source-register.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:e15121da3b14897aa75716febb3c0077c5298a2afc6b1b7a1acbf4a372f95d3d`
- `fixture_sources_digest`: `sha256:4851d0e716c0c8e3edd31b79e2111fd62b1041ba9f7b278c8059c73244582d7f`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| MKT-012 | 三家竞品冻结价格按门店、用户和订单量计价且不可直接比，现实价格需刷新 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | LIVE 读取竞品当前价格、能力和日期来源 |
| MKT-016 | 马来西亚访谈把多语言和电子发票列为前置，隐私与票据规则仍需当地专业复核 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | LIVE 读取马来西亚当前术语、货币和官方规则 |
| MKT-018 | 竞品计价单位和生态差异有 2026-08-20 冻结快照，折扣、税和当前能力不在其中 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | LIVE 读取竞品当前价格、能力与可回查来源 |
| MKT-021 | 会计、电商、支付生态与本地伙伴线索可支撑定位假设，但渠道样本有明显偏差 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | LIVE 读取客户替代方案、竞品和最新定位证据 |
| PRJ-021 | 六名小样本受访者提供会计集成、多语言、电子票据和本地伙伴线索，不能外推市场比例 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | LIVE 读取当前访谈全文、招募边界和机会证据 |
| PRJ-048 | 三国生态、计价单位和监管门不同，冻结快照只支持共同核心与待本地复核差异 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | LIVE 读取三国当前法规、生态和发布日期约束 |
| PRJ-057 | 调研简报列出目标市场问题、能力现状和不替用户选国的边界，可支撑逐轮战略访谈 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | USER 提供内部能力缺口、非公开约束和不做项；LIVE 通过 browser 刷新目标市场、竞品与来源日期 |
| RES-001 | 三国在市场结构、生态、计价和监管门上存在不可直接相加的差异，现实使用须刷新 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | LIVE 刷新三国市场、生态、竞品和官方规则 |
| RES-016 | 访谈线索、冻结事实和来源状态按权威层级分开；昨天新增两份反证不在 fixture 内 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | USER 提供昨天新增的两份反证、来源日期和当前选项变化 |
| WRT-022 | 市场简报、六名访谈摘要、冻结外部事实和来源状态可区分事实、估计与建议 | research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md | LIVE 刷新报告所需外部事实、来源和访问日期 |
<!-- corpus:required-claims:end -->
