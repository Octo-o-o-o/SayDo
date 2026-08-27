# CTX-11 · 求职项目

- `as_of`: `2026-08-24`
- `valid_until`: `2026-11-24`；岗位仍开放与否必须通过 `LIVE` 复核。
- `claim_scope`: 候选人事实用 `accomplishment-bank.md`；目标岗位要求只用 `job-requirements.md`；现有表达问题用 `resume-draft.md`。岗位要求不能覆盖候选人事实。
- `supported_questions`: `CAR-001, CAR-002, CAR-003, CAR-005, CAR-006, CAR-010, CAR-011, CAR-012, CAR-020`
- `unsupported_scope`: 不含真实姓名、联系方式、正式管理经历、市场薪资现势或代表用户外发授权。
- 合成候选人：有六年经验的后端工程师，目标是技术负责人或 staff 级 IC。
- 权威规则：候选人经历以 `accomplishment-bank.md` 为准；岗位要求以 `job-requirements.md` 为准；简历草稿只反映当前写法。
- 归属纪律：不得编造业绩、头衔或技术栈；岗位文案不是候选人事实。
- 隐私：材料不含真实姓名、公司或联系方式。

来源：

- [resume-draft.md](resume-draft.md)
- [job-requirements.md](job-requirements.md)
- [accomplishment-bank.md](accomplishment-bank.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:13977946e353877642a1f5018ddf5f5602edb0a124d7873a99f805e6a4f3a15f`
- `fixture_sources_digest`: `sha256:7d83f3a91f8f093c4e7f6a803e7ec96444712ae22a833de84a323430a77ccc6f`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| CAR-001 | 简历弱点、三类岗位共性与差异，以及五条可证实经历 | resume-draft.md + job-requirements.md + accomplishment-bank.md | - |
| CAR-002 | A、B、C 三类岗位的共同要求和差异；具体选择哪个岗位需用户确认 | job-requirements.md | USER 确认 A、B、C 中本轮要模拟的岗位 |
| CAR-003 | 五条带真实结果或失败反思的可证实经历及公开范围要求 | accomplishment-bank.md | - |
| CAR-005 | 候选人技术背景、A/B/C 岗位差异和可用于求职信的可证实经历；本轮目标岗位由用户当下提供 | resume-draft.md + job-requirements.md + accomplishment-bank.md | USER 提供已选定的当下目标岗位 |
| CAR-006 | 可证实成果和团队协作边界；待改作品集正文必须由用户提供 | accomplishment-bank.md | USER 提供待改作品集正文和个人贡献证据 |
| CAR-010 | 岗位共性与候选人可证实经历可判断作品方向；原十二周计划、前四周进度和当前资源不在 fixture 内 | resume-draft.md + job-requirements.md + accomplishment-bank.md | USER 提供原十二周计划和前四周真实进度；LIVE 读取当前可用时间、任务资源和目标岗位要求 |
| CAR-011 | 岗位要求、简历现状和可证实成果可构成个人证据；当前市场薪酬与谈判优先项不在 fixture 内 | resume-draft.md + job-requirements.md + accomplishment-bank.md | USER 提供优先项、不可让步项和可让步项；LIVE 通过 browser 获取带日期的市场薪酬区间 |
| CAR-012 | 经历库含可量化结果、协作、指导与失败反思，可用于绩效举证但当前周期材料不在 fixture 内 | resume-draft.md + job-requirements.md + accomplishment-bank.md | USER 提供本周期绩效结果、合作证据和反馈材料；仅使用本次回顾所需内容 |
| CAR-020 | 简历、岗位类别和可证实经历只可用于材料准备，不包含冒充申请或自动回复授权 | resume-draft.md + job-requirements.md + accomplishment-bank.md | LIVE 读取当前职位、申请系统和招聘者线程；fixture 不提供冒充或自动外发授权 |
<!-- corpus:required-claims:end -->
