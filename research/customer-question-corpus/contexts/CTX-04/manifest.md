# CTX-04 · 技术长文

- `as_of`: `2026-08-24`
- `valid_until`: `fixture-frozen`；外部证据在引用前必须通过 `LIVE` 核验。
- `claim_scope`: 作者观点与亲历用 `author-claims.md`；待核外部线索用 `source-notes.md`；语气特征只用 `style-sample.md`。
- `supported_questions`: `WRT-003, WRT-004, WRT-016, WRT-030, WRT-045, CAR-016`
- `unsupported_scope`: 不含访谈全文、待审稿、定稿、整本书素材或嘉宾名单。
- 合成作者：一位基础设施团队负责人。
- 文章目标：向工程管理者解释“可靠 AI 自动化的瓶颈是验收，不是生成速度”。
- 权威顺序：`author-claims.md` 中经作者确认的论点 > `source-notes.md` 的外部材料 > `style-sample.md` 的表达特征。
- 归属纪律：外部来源可补证据，不得改写成作者亲历；样文只能说明风格，不能证明事实。

来源：

- [author-claims.md](author-claims.md)
- [source-notes.md](source-notes.md)
- [style-sample.md](style-sample.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:a2d40eb43152139a62887ff582e52ea1b70a821c5834f7a11e4a501d600123c9`
- `fixture_sources_digest`: `sha256:4d2e86f10e79b713daf8dd651bb8ba0de47594567b6e50b911aab8ddf811f4c7`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| CAR-016 | 四条可认领观点、一个账单项目轶事和作者既往语气；三个月项目库存需用户补充 | author-claims.md + style-sample.md | USER 提供可公开真实项目清单与三个月内容边界 |
| WRT-003 | 作者已确认验收、测试 oracle、交接证据和可推翻决策四条观点；采访回答不在 fixture 内 | author-claims.md + source-notes.md + style-sample.md | USER 提供采访回答与作者确认 |
| WRT-004 | 作者确认论点、可用内部案例和语气样例已有记录，外部数字须核原始来源后才能保留 | author-claims.md + source-notes.md + style-sample.md | USER 提供待改的第一节草稿 |
| WRT-016 | 作者目标长度、四条确认观点和冷静具体的既往语气可约束分享结构；待转换长文由用户提供 | author-claims.md + source-notes.md + style-sample.md | USER 提供待转换的长文 |
| WRT-030 | 样文体现冷静、具体和证据导向语气；第二节正文与不可改引用由用户提供 | author-claims.md + source-notes.md + style-sample.md | USER 提供待改第二节正文 |
| WRT-045 | 四条作者确认论点、一个内部案例、外部证据状态和既往语气样例 | author-claims.md + source-notes.md + style-sample.md | - |
<!-- corpus:required-claims:end -->
