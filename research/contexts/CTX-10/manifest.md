# CTX-10 · 专业认证学习

- `as_of`: `2026-08-24`
- `valid_until`: `2026-11-21`
- `claim_scope`: 考试范围与权重用 `exam-outline.md`；个人薄弱点用 `mistake-log.md`；排期约束用 `time-constraints.md`，三类 claim 不互相覆盖。
- `supported_questions`: `RES-019, LRN-001, LRN-002, LRN-003, LRN-008, LRN-009, LRN-012, LRN-013, LRN-028`
- `unsupported_scope`: 不含教材、勘误、六周共学成员或考试保证。
- 合成学习者：全职数据分析师，准备云数据工程认证。
- 考试日期：2026-11-21。
- 权威顺序：`exam-outline.md` 的官方范围 > `mistake-log.md` 的个人薄弱点 > `time-constraints.md` 的排期。
- 限制：不得把旧题库答案当官方事实；练习成绩不能保证考试结果。

来源：

- [exam-outline.md](exam-outline.md)
- [mistake-log.md](mistake-log.md)
- [time-constraints.md](time-constraints.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:4dc6fd8f9bd8c7bd8d4af509e25ab9a74479c79f5477523ffddec96365dd860c`
- `fixture_sources_digest`: `sha256:6e5317172461e491e1425210d4c152d8540c1d864962ee815a78e2aea5525605`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| LRN-001 | 考试权重、五类错题、工作日和周末可用时间及十月出差约束 | exam-outline.md + mistake-log.md + time-constraints.md | - |
| LRN-002 | 错题摘要记录学习者混淆 exactly-once 与幂等写入；原题、本人作答和可核验答案不在 fixture 内 | mistake-log.md | USER 提供原题、本人作答和可核验答案；仅保存完成复盘所需的最小摘要 |
| LRN-003 | 两次模考得分为 62% 与 68%，错题涵盖幂等、存储、灾备、权限和监控；通勤有 25 分钟且适合口头复盘与错题回放 | mistake-log.md + time-constraints.md | USER 提供逐题原文、本人作答和可核验答案；十分钟是本次题面限制，不是 fixture 事实 |
| LRN-008 | 考试领域、权重与仍易错主题；真正掌握的主题必须由用户另行确认 | exam-outline.md + mistake-log.md | USER 提供已确认掌握且可公开的主题 |
| LRN-009 | 五类错题、考试权重、每周可用时段和不希望多次提醒的偏好可约束两周复习提醒 | exam-outline.md + mistake-log.md + time-constraints.md | USER 确认当前错题范围与提醒偏好；LIVE 通过 forms 读取错题进展，通过 calendar 读取未来两周时段，并由 automation/notification 执行到时提醒 |
| LRN-012 | 考试五领域权重和当前五类薄弱点，可用于加权情景提问 | exam-outline.md + mistake-log.md | - |
| LRN-013 | 可用时间、错题摘要和出差约束是冻结基线；上周计划与实际完成情况由用户提供 | exam-outline.md + mistake-log.md + time-constraints.md | USER 提供上周计划与实际进展 |
| LRN-028 | 考试权重、错题与时间偏好可作计划基线；每日表现和重大目标授权不在 fixture 内 | exam-outline.md + mistake-log.md + time-constraints.md | USER 确认重大目标、可调整范围和提醒边界；LIVE 通过 tasks/forms 读取每日表现、计划与提醒状态 |
| RES-019 | 两次 62% 与 68% 模考得分、五类错题和考试领域权重 | exam-outline.md + mistake-log.md | - |
<!-- corpus:required-claims:end -->
