# CTX-08 · 增长活动

- `as_of`: `2026-08-24`
- `valid_until`: `2026-09-21`
- `claim_scope`: 品牌允许与禁用承诺用 `brand-guide.md`；漏斗观察值用 `funnel-metrics.md`；现有素材可用性用 `asset-inventory.md`。
- `supported_questions`: `PRJ-032, PRJ-038, PRJ-055, RES-007, MKT-001, MKT-002, MKT-003, MKT-006, MKT-007, MKT-013, MKT-014, MKT-015, MKT-017, MKT-029, DAT-013`
- `unsupported_scope`: 不含真实页面全文、优秀与失败文案库、客户或竞品语料、用户级触达明细。
- 合成产品：面向自由职业团队的项目管理 SaaS。
- 活动目标：提高新注册用户在七天内创建首个客户项目的比例。
- 权威顺序：`brand-guide.md` 的品牌与禁用承诺 > `funnel-metrics.md` 的指标 > `asset-inventory.md` 的素材可用性。
- 注意：漏斗数据是观察数据，不证明因果。

来源：

- [brand-guide.md](brand-guide.md)
- [funnel-metrics.md](funnel-metrics.md)
- [asset-inventory.md](asset-inventory.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:37cf2b6aa2a9b3815427b6faa23c5dcc044a33c3ea0bdfdfb30ac94ad1e55e00`
- `fixture_sources_digest`: `sha256:a639d9918380a2a0e165106b1995f8c6a4b46802e3d38b1e9b166d38f93608af`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| DAT-013 | 漏斗各阶段人数、转化和设备渠道混杂可作为图表口径；待审图表由用户提供 | brand-guide.md + funnel-metrics.md + asset-inventory.md | USER 提供待审图表与口径 |
| MKT-001 | 漏斗显示七日内产生可分享进度页为 48.9%，品牌禁止保证收入和虚假紧迫 | brand-guide.md + funnel-metrics.md + asset-inventory.md | LIVE 读取当前活动基线、渠道状态和指标实现 |
| MKT-002 | 品牌允许强调减少整理和清楚交接，禁止全自动替代人、保证收入与虚假紧迫 | brand-guide.md + funnel-metrics.md + asset-inventory.md | LIVE 读取当前首屏、产品证据和已批准文案 |
| MKT-003 | 最近 28 天漏斗和品牌护栏可约束七日邮件目标；当前发送配置与频控不在 fixture 内 | brand-guide.md + funnel-metrics.md + asset-inventory.md | LIVE 通过 email/calendar 读取发送配置与频控，通过 bi 读取七日行为数据 |
| MKT-006 | 注册到首个项目的漏斗有阶段数据，移动端与渠道混杂；邮件打开率和落地页现势不在 fixture 内 | brand-guide.md + funnel-metrics.md + asset-inventory.md | LIVE 读取邮件、落地页、渠道设备分层和实验状态 |
| MKT-007 | 当前品牌护栏和最近 28 天漏斗基线；上次提前看数实验的原始设计需用户补充 | brand-guide.md + funnel-metrics.md | USER 提供上次实验设计、样本和提前看数记录 |
| MKT-013 | 品牌允许的价值主张、禁止承诺和已授权素材范围明确，案例授权不含付费广告 | brand-guide.md + funnel-metrics.md + asset-inventory.md | USER 提供当前获批素材、渠道授权和广告草稿状态 |
| MKT-014 | 当前品牌边界与普通产品漏斗基线；品牌搜索和地域基线必须实时读取 | brand-guide.md + funnel-metrics.md | LIVE 读取品牌搜索、投放地域和历史基线 |
| MKT-015 | 品牌边界、28 天漏斗和素材库存可作复盘基线；本月活动成本与结果需实时读取 | brand-guide.md + funnel-metrics.md + asset-inventory.md | LIVE 读取本月活动、成本与结果 |
| MKT-017 | 素材库存列出授权案例、截图、视频、帮助文章及过时 UI 和广告授权缺口 | brand-guide.md + funnel-metrics.md + asset-inventory.md | LIVE 读取素材当前版本、授权、过期 UI 和渠道可用性 |
| MKT-029 | 28 天漏斗从 8,420 个注册降至 1,080 个七日可分享进度页，品牌禁止保证收入与虚假紧迫，现有案例未获付费广告授权 | brand-guide.md + funnel-metrics.md + asset-inventory.md | LIVE 读取固定预算、当前渠道成本和实验容量 |
| PRJ-032 | 创建工作区到首个客户项目的漏斗损失、移动端混杂和当前可用于实验的素材 | funnel-metrics.md + asset-inventory.md | - |
| PRJ-038 | 最近 28 天漏斗给出创建项目前后的断点和移动端混杂，可据此定义结果与护栏 | brand-guide.md + funnel-metrics.md + asset-inventory.md | LIVE 读取当前产品指标、实现状态和护栏基线 |
| PRJ-055 | 最近 28 天漏斗断点和现有素材约束；四个候选实验的成本与污染关系需用户补充 | funnel-metrics.md + asset-inventory.md | USER 提供四个候选实验、成本与互相污染关系 |
| RES-007 | 邀请或导入阶段转化为 46.4%，移动端流失更高但与渠道混杂，不能直接归因 | brand-guide.md + funnel-metrics.md + asset-inventory.md | LIVE 读取渠道设备分层、实验状态和当前漏斗 |
<!-- corpus:required-claims:end -->
