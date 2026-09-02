## 1. 最终裁决

`[fail]` — A 级 5，B 级 6，C 级 1。

总案覆盖面很广，Inference、Execution Agent、Tool/Connector 及 ACP/MCP/A2A 的概念分层总体正确；失败原因集中在当前公共真值遗漏、A 级安全项低估，以及若干 Wave 出口尚不能机械证明真实执行。

## 2. Findings

### A 级

- A-R1 — 现役部署树的权限、隐私和数据声明未被明确纳入 A 级治理。总案只抽象列出 `site` 等类别，却要求未来填写 exact path，见[总案:137–139](docs/plan/2026-08-28-project-gap-closure-program.md:137)、[总案:643](docs/plan/2026-08-28-project-gap-closure-program.md:643)；真正部署源是[docs/site/README.md:3](docs/site/README.md:3)。现役首页称手机审批封顶 S2，[deploy/index.html:490](deploy/saydo-octoooo-com/index.html:490)，现役 Docs 却说明当前 LAN 面不裁决 S2/S3，[deploy/docs/index.html:810](deploy/saydo-octoooo-com/docs/index.html:810)；隐私页称 token 存系统安全存储，[deploy/privacy/index.html:92](deploy/saydo-octoooo-com/privacy/index.html:92)，而浏览器入口写入 `localStorage` 并继续放进 WS query，[api.ts:20](packages/console/src/lib/api.ts:20)、[api.ts:47](packages/console/src/lib/api.ts:47)。风险是授权和隐私合同失真。最小修改：把 `deploy/saydo-octoooo-com/**` 中英文首页、Docs、Privacy、Terms、Support 列为 exact roots；扩展 G-A4/G-A6，分别投影浏览器与原生壳的 storage、transport、approval，以及“持久存储位置”和“请求数据出网”。

- A-R2 — G-B14 严重级别过低：当前审计确实可能永久保存原文。SQLite sink 原样序列化任意 `meta`，[misc.ts:83–100](packages/daemon/src/storage/dao/misc.ts:83)；生产路径会记录模型句子原文，[dialog.ts:1015–1021](packages/daemon/src/live/dialog.ts:1015)，以及用户理由、空间标题，[focuses.ts:142–152](packages/daemon/src/api/focuses.ts:142)、[spaces.ts:47–100](packages/daemon/src/api/spaces.ts:47)。这违反“敏感 payload 只记 digest”的硬规则，[AGENTS.md:67–68](AGENTS.md:67)、[e-crosscutting.md:24–28](docs/modules/e-crosscutting.md:24)。最小修改：把 G-B14 拆成“A：audit schema/redaction/raw-text”与“B：logger 容量/背压”；A 部分进入 Wave 1，要求 action 判别联合、逐事件 schema、digest/ref-only 和原文注入负例。

- A-R3 — E1 的 manifest 字段不足以证明 gate 真正阻断发布。当前规格只有命令、平台、依赖和 release-blocking 等字段，[总案:154–164](docs/plan/2026-08-28-project-gap-closure-program.md:154)、[总案:646](docs/plan/2026-08-28-project-gap-closure-program.md:646)，但真实执行还由 trigger/ref、job/step、matrix、`needs`、`if`、`continue-on-error`、runner、timeout、permissions 与 skip 决定，见[ci.yml:3–14](.github/workflows/ci.yml:3)、[ci.yml:85–104](.github/workflows/ci.yml:85)、[release.yml:135–143](.github/workflows/release.yml:135)、[release.yml:295–340](.github/workflows/release.yml:295)。风险是命令仍存在、却被条件或断开的依赖跳过而假绿。最小修改：将上述控制流字段加入 manifest；mutation 至少覆盖删除 matrix OS、恒假 `if`、`continue-on-error`、断开 `needs`、required step skipped。

- A-R4 — G-A5 的“DB hash 不变”不足以证明拒绝过程零写入。[总案:193–200](docs/plan/2026-08-28-project-gap-closure-program.md:193)只要求主 DB hash；当前 `openDb` 打开后先启用 WAL、再迁移，[db.ts:11–24](packages/daemon/src/storage/db.ts:11)，因此主文件不变时 `-wal/-shm/-journal` 仍可能创建或改变。风险是数据升级负例假绿。最小修改：使用 read-only/immutable probe，并对 `db`、`db-wal`、`db-shm`、`db-journal` 的存在 exact-set、字节 digest 和 `schema_migrations` exact-set 全部前后相等。

- A-R5 — “任一 unknown 都零 secret read/零 packet”越过了 owner 已签费用决策。总案在[总案:436](docs/plan/2026-08-28-project-gap-closure-program.md:436)、[总案:448](docs/plan/2026-08-28-project-gap-closure-program.md:448)普遍拒绝 unknown；但 owner 已签决定保留单次授权和硬上限预算出口，[owner 决策:227–230](docs/plan/2026-08-24-ai-supply-owner-decisions.md:227)，专题也明确允许两种 `externally_metered_unknown_*` 逐次确认路径，同时禁止进入推荐、fallback 和后台调用，[AI 方案:196–200](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:196)。风险是总案反向改写已签合同。最小修改：按字段判定；identity/egress/rights/data unknown 继续零读零包，funding unknown 仅保留已定义的逐次确认、请求/token/physical cap 路径。

### B 级

- B-R1 — A 级 disposition 没有绑定具体技术门。[总案:572](docs/plan/2026-08-28-project-gap-closure-program.md:572)允许统一的 `owner_downgraded_with_public_limit`；虽然[总案:584](docs/plan/2026-08-28-project-gap-closure-program.md:584)另列了技术出口，因此未上调为 A，但未来 `wave-exit-contract` 没有定义 A-ID→gate/disabled-entrypoint 映射。最小修改：文案型 A 才能单纯公开降级；运行时 A 必须记录 `disabled_entrypoints` exact-set、负例 gate 和 claim receipt，否则保持 `blocks_expansion`。

- B-R2 — Execution scope 还不是机械 exact set，Wave 2 也遗漏 S6 certification。总案把 shared ACP、Codex 命令和 Claude/Cursor hook 混在一个集合，[总案:416](docs/plan/2026-08-28-project-gap-closure-program.md:416)；owner 签单实际列出六个 ACP 产品及共享 TCK，[owner 决策:120–128](docs/plan/2026-08-24-ai-supply-owner-decisions.md:120)，现有 Hopper 关系还在[docs/07:125–133](docs/07-tech-stack-decisions.md:125)。S6 在[总案:444](docs/plan/2026-08-28-project-gap-closure-program.md:444)，却未进入 Wave 2 的[总案:586–590](docs/plan/2026-08-28-project-gap-closure-program.md:586)。最小修改：scope key 固定 `(plane, product, edition, realm, surface, protocolVersion, driver, distribution, maturity)`；六家逐行 included/deferred，Hopper 标既有依赖；Wave 2 对选中 exact-set 要求 live/no-skip S6 证据。

- B-R3 — AI canonical Phase 0 没有成为 Wave 的显式 blocking predecessor。专题要求先改 canonical 并做一致性门，[AI 方案:1300–1313](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1300)，但总案 Wave 0/1 只笼统写 E0、manifest 与 S0.5，[总案:574–584](docs/plan/2026-08-28-project-gap-closure-program.md:574)。当前仍有“三处模型”与“四个 inference 槽 + 独立 execution”的 canonical 冲突，[docs/02:102–110](docs/02-product-definition.md:102)、[docs/09:1191–1208](docs/09-data-contracts.md:1191)、[docs/11:417–420](docs/11-ui-spec.md:417)。最小修改：把 scoped AI canonical diff、ADR 和一致性 gate 设为 S0.5/S1 的阻断前置；未签 decision 对应 row 只能 deferred。

- B-R4 — Wave 3 可被 mock snapshot 满足。总案自己的 connector 完成定义明确“mock 不证明 live”，[总案:484–486](docs/plan/2026-08-28-project-gap-closure-program.md:484)，但 Wave 3 出口只要求 artifact/source/freshness 与失败诚实，[总案:592–596](docs/plan/2026-08-28-project-gap-closure-program.md:592)。最小修改：固定所选 `capability_id` exact-set，要求真实授权 read journey；账户、最小 scope、空结果、分页、auth expiry、rate limit 必须有 live evidence，required case skipped/expired 时不得升 `supported`。

- B-R5 — E8/E9 没有 Wave 归属。二者定义在[总案:267–291](docs/plan/2026-08-28-project-gap-closure-program.md:267)，但 Wave 0–5 从[总案:574](docs/plan/2026-08-28-project-gap-closure-program.md:574)到[总案:608](docs/plan/2026-08-28-project-gap-closure-program.md:608)均未纳入。风险是 G-B14–G-B17 无限悬空。最小修改：E8 的非 audit 部分安排在 Wave 1 相邻批；E9 设为“下一 RC 前”的 blocking batch。

- B-R6 — 两项 A 级证据链仍不够权威。G-A4 引用了明确冻结、禁止当现行材料的 `docs/store/02`，[总案:82](docs/plan/2026-08-28-project-gap-closure-program.md:82)、[store 文稿:3](docs/store/02-商店文案.md:3)、[release README:19](docs/release/README.md:19)；应改引 active listing projection 和部署树。G-A7 的两处证据只能证明 secret 槽和 entitlement 推断问题，不能单独证明六维 admission 全局不存在；应补配置先写、secret 后写，[setupApi.ts:1414–1418](packages/console/src/lib/setupApi.ts:1414)，resolver 取 secret，[resolve.ts:80–89](packages/daemon/src/providers/resolve.ts:80)，以及实际 Bearer 发包，[openaiCompat.ts:113–118](packages/daemon/src/providers/openaiCompat.ts:113)。

### C 级

- C-R1 — 若干 file:line 需校正，但不改变原严重级别：G-A2 应写“三套非同构、互有缺项”，实际 `ci-node` 是[justfile:7–26](justfile:7)；G-B2 的 TOCTOU 证据在[verifyFreeze.ts:62–69](packages/daemon/src/tier1/verifyFreeze.ts:62)，不是 `:1–12`；G-B4 的 `SetupWizard:130–207` 只是进度逻辑，供给暴露应引[SetupWizard.tsx:1435](packages/console/src/components/SetupWizard.tsx:1435)和[SetupWizard.tsx:1543](packages/console/src/components/SetupWizard.tsx:1543)，并删除无用户可见证据的“daemon”；G-A8 应补自动触发链[SetupWizard.tsx:1096](packages/console/src/components/SetupWizard.tsx:1096)、[daemon index.ts:1101](packages/daemon/src/index.ts:1101)。

其余证据复核结果：G-A1/A3/A5/A6 的当前事实与级别成立；G-A8 结论成立但需补触发链；G-B1/B3/B5/B6/B8–B13/B15–B17 成立。G-B14 的现状事实成立，但 audit 部分必须上调 A。G-A1 的静态计数重新得到 `986 / 752 / 234`。

## 3. 五角覆盖复核

- 工程：`[fail]`。覆盖面完整，但 audit 隐私、workflow 控制图和 SQLite sidecar 三个 A 级机械门缺失。
- 用户：`[partial]`。初级、资深、非开发、移动、弱网、无障碍、locale、团队路径齐全；现役部署页仍存在移动权限和隐私错述。
- AI 供给：`[fail]`。三平面清楚，Codex/ACP 方向基本服从 owner；但 funding unknown 规则冲突已签决策，Execution exact-set 和 live certification 不闭合。
- 工具：`[partial]`。没有把 MCP/ACP/A2A 或 mock 冒充 production；但 Wave 3 缺真实 connector read 出口，D5 厂商选择仍需 owner 签署。
- 语料：`[ok]`。Q0 正确承认当前假闭合，Q1–Q6 覆盖产品 meta、48 journeys、12 个长会话、6 对跨 session、17 类故障和四层 oracle，也明确 mock 不等于 connector。

## 4. 依赖与机械验收复核

总体依赖顺序是合理的：Wave 0 真值/合同形状 → Wave 1 安全与恢复 → Wave 2 普通用户及 AI 纵切片 → Wave 3 connector read → Wave 4 移动/专业/外部写 → Wave 5 长会话校准。

开工前仍须最小补齐：

1. AI canonical Phase 0 成为 S0.5/S1 的硬前置。
2. 每个 A disposition 绑定 gate ID、disabled entrypoint 和负例证据。
3. Wave 2 纳入选定 Execution surface 的 S6 live/no-skip gate。
4. Wave 3 要求真实 connector read evidence。
5. E8/E9 获得明确 Wave/RC 归属。
6. gate manifest 加入 workflow 控制图字段；DB gate 覆盖所有 SQLite sidecar。
7. claim roots 明列实际 `deploy/` 树。

owner 决策复核：Codex 继续 `codex exec`、共享 ACP、Claude/Cursor 保留 hook，以及首发仅内置受信 connector、第三方 pack/SDK/TUF/code plugin deferred，均已在文字范围中体现；当前只能判 `[partial]`，因为 scope manifest 尚未把产品、协议、driver、distribution 和 live gate 做成 exact-set。

总案确实回应了“先计划、暂不实际测试”：它明确说明候选 gate 脚本尚不存在、当前未运行产品测试，[总案:648–657](docs/plan/2026-08-28-project-gap-closure-program.md:648)。本次评审也只运行了 `rg`、`sed`、`wc`、`git status` 等静态读取命令；未联网、未构建、未运行产品测试、未修改文件。