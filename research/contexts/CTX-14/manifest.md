# CTX-14 · 社区公益活动

- `as_of`: `2026-08-26`
- `valid_until`: `2026-10-18`
- `claim_scope`: 活动目标与预算用 `event-brief.md`；常设安全门用 `venue-rules.md`；志愿者基线用 `volunteer-roster.md`；场地退回意见和两名志愿者的已确认变更只用 `venue-feedback.md`。
- `supported_questions`: `OPS-051, FAM-008, FAM-014`
- `unsupported_scope`: 只支持本次 120 人维修日，不支持 500 人活动、年度报告、全国倡议或灾害调度。
- 合成活动：社区旧物维修日，预计 120 名居民参加。
- 日期：2026-10-18。
- 权威顺序：`venue-feedback.md` 的本轮整改与已确认时段变更 > `venue-rules.md` 的常设要求 > `event-brief.md` > `volunteer-roster.md` 的基线可用性。
- 外部发布、供应商下单和志愿者个人信息分享都需人工确认。

来源：

- [event-brief.md](event-brief.md)
- [venue-rules.md](venue-rules.md)
- [volunteer-roster.md](volunteer-roster.md)
- [venue-feedback.md](venue-feedback.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:53611518804a4d77593327262d7439cc434a28e19c1e2558b1eaacae5c78803d`
- `fixture_sources_digest`: `sha256:ffb4c5f10bcfe21fa789e2b1e07e80c90b7d7745337ac833c79d864f85de80cc`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| FAM-008 | 各技能的基线时段和两位志愿者已确认的时间变更；当前报名与最低覆盖阈值由现场系统补充 | volunteer-roster.md + venue-feedback.md | LIVE 读取当前确认报名和最新排班状态 |
| FAM-014 | 活动目标与安全边界、场地方带日期的退回意见，以及两名志愿者已确认的时间变更 | event-brief.md + venue-feedback.md | LIVE 读取活动当前报名、排班与整改落地状态 |
| OPS-051 | 120 人活动范围、场地安全规则和场地方要求整改的具体意见；活动当日人流、设备与安全事件来自现场系统 | event-brief.md + venue-rules.md + venue-feedback.md | LIVE 通过 monitoring/database/forms 读取人流、设备与安全事件，通过 tasks 读取分派状态 |
<!-- corpus:required-claims:end -->
