# 18 · 对抗性评审：新增 `writing`（正式文章 / 学术 paper）业务流

## 结论

方向和治理边界成立，但当前只能标为 **P2 设计预留**、不能启用：没有运行时类型门禁和可证明的用户观点归属是现时硬伤；类型迁移、非 coding 执行/收口是 P2 启用前硬阻塞，引用、paper 就绪清单与迁移实现则已被文档诚实标成留白、仍必须补成可照抄合同。

## A 级（硬伤，必修）

### A-1 · `writing` 已进入 P0 可照抄词表，但没有 fail-closed 的能力门

**证据**

- 路线纪律明确“P0 只做 `coding`”，writing 在 P2（`docs/05-roadmap.md:59,105`）。
- 但 Project、DDL 和工具已经接受 `writing`（`docs/09-data-contracts.md:47,446-448,827`）；`proposeStart`/`confirmAndDispatch` 的签名没有 `projectType`、能力或阶段参数（`docs/09-data-contracts.md:774-783`），且整节标题仍是 `[P0-Tier1 就绪]`（`docs/09-data-contracts.md:767-769`）。
- 09 的总说明把对话/工具契约作为可照抄的 P0 基线（`docs/09-data-contracts.md:3-6`），writing 只在行内注释标 P2；实现者容易把“词表已出现”误读成“能力已开启”。
- 对照 SayDo 实施仓，`dispatchApprovedPackage` 固定 `route: "tier1"` 且不读取项目类型（`SayDo/packages/daemon/src/brain/liveTools.ts:95-153`），`proposeStart` 也没有类型门（`SayDo/packages/daemon/src/brain/liveTools.ts:189-245`）。当前旧实现的 enum 仍没有 writing（`SayDo/packages/contracts/src/types/project.ts:7`），这只是旧版本拒绝写入，不是安全门。

**为什么是 A**

一旦实施者照 09 同步 enum，`writing` 就可能被当作普通 Tier 1 coding 任务派发；“P0 行为不变”注释不能替代运行时约束。结果可能是错误工作区、错误 verify/merge 语义，且不会留下“功能未启用”的明确终态。

**修法**

在 daemon 的所有入口（`promoteProject`、`proposeStart`、签发/消费收据、`confirmAndDispatch`、retry、scheduler/worker 认领）统一使用 `enabledProjectTypes`/capability matrix，P0 默认只含 `coding`，非启用类型统一返回 `project_type_not_enabled`；P2 同时具备 writing executor、结果/验收合同后才开启。09 §13 和 §12 增加门禁正反例，并把 P2 扩展契约从 `[P0-Tier1 就绪]` 区域视觉隔离。

### A-2 · `TranscriptTurn.turnId` 不能单独证明“用户观点”，现有实现还存在 ref 口径断裂

**证据**

- 产品规则把核心论点、经验和判断归给用户，并把 `TranscriptTurn.turnId` 当锚（`docs/02-product-definition.md:94`）。
- TranscriptTurn 虽有 `speaker`、`sentences[].heard`（`docs/09-data-contracts.md:65-72`），但 `SourceRef.ref` 只是任意字符串，注释仅列 turnId 等定位（`docs/09-data-contracts.md:188-192`）；`Claim` 只有 `source` 和通用 `evidence`，没有用户来源/确认/稿件位置的归属字段（`docs/09-data-contracts.md:257-260`）。
- 实施仓快照器只解析 `{turnId,text}`，不检查 `speaker` 或 `heard`（`SayDo/packages/daemon/src/evaluator/snapshotter.ts:131-153`）；freshness 也只按 turnId/text 比较（`SayDo/packages/daemon/src/evaluator/verify.ts:89-103`）。同时 live tool 写入的是 `transcript:${sessionId}#${turnId}`（`SayDo/packages/daemon/src/brain/liveTools.ts:483-490`），而快照器注释/解析约定的是裸 turnId（同文件 `:131-147`），当前不能稳定命中同一转写行。
- 现有信任分类器对 `requestedTrust` 为 `user_stated/user_approved` 的输入直接放行，没有把 `source.kind` 绑定到用户转写（`SayDo/packages/daemon/src/memory/classify.ts:61-73`）；这不能作为写作归属合同。
- 转写又允许因隐私同意而不落盘（`SayDo/packages/daemon/src/session/manager.ts:93-110`）；若 `store_transcript=false`，事后不存在可回读的 turnId，writing 不能同时宣称“可溯源”而不提供用户编辑稿/确认摘要等替代证据。

**为什么是 A**

只要能伪造或误绑定一个 turnId，AI 改写、AI 轮次、`heard=false` 或 ASR 错听内容都可能被呈成“用户亲口观点”；这直接触碰 04 的 provenance/taint 红线，而不是普通字段遗漏。

**修法**

新增结构化 `TurnRef(sessionId, turnId, speaker, sentenceId, textDigest)` 与 `Attribution`/`UserOrigin` 合同：核心主张必须 `speaker=user`、`heard=true`，并有 `user_stated` 或 `user_approved` 的确认事件；还要区分 `user_authored` 与用户朗读/转述的 `user_quoted`，不能仅凭 speaker 判断原创归属。稿件段落/句子到 Claim/TurnRef 的映射一等持久化。AI 候选仍标 `agent_output`/`candidate`，用户采纳只能改变“采用状态”，不能回写成“用户原始陈述”。统一 live tool、snapshotter、verify 的 ref 形状并补 AI 轮、heard=false、改 speaker、ASR 变更反例。

### A-3 · “research → writing” 的类型演化没有可执行语义

**证据**

- 产品文字承认“同项目变更 type，还是新项目 + 产物按 candidate 并入”目前显式留白（`docs/02-product-definition.md:90`）。
- `Project.type` 是单值且没有历史/phase 字段（`docs/09-data-contracts.md:45-54`）；现有 `reanchor` 只覆盖 draft 并回既有项目（`docs/09-data-contracts.md:75`），`promoteProject` 只覆盖 draft→active（`docs/09-data-contracts.md:826-828`）。
- 架构图虽画出 `phases(project_id,type,...)`，但没有对应 09 契约/DDL/工具（`docs/03-architecture.md:128-135`）。

**为什么是 A（P2 启用前）**

“聊着聊着开始写”无法判定是原项目改型、子项目、还是新决策包；旧 research 包、readiness、任务和转写的失效/继承边界也不明。不同实现会产生不同项目污染和审计结果。

**修法（由 owner 选一条，不代拍板）**

1. `Project.type` 保持不可变：建立 linked writing child/project，保留 `parentProjectId`、artifact lineage，旧包只读；
2. 增加用户确认的 `ProjectTypeTransition`/phase 合同：旧包 `superseded`、重跑 writing readiness、保留 research artifact 作为带 provenance 的证据，并落审计与确认轮次。

两条都必须规定旧 Claim/Artifact 如何重新验证，不能仅靠“召回复用”。

### A-4 · writing 的执行、逐节确认和收口没有与 coding 语义分叉

**证据**

- 02 宣称后台成文、逐步确认可“每节停靠”（`docs/02-product-definition.md:88`），但 04 明确非 coding 无 merging、以内容评审收尾（`docs/04-key-mechanisms.md:195`）。
- TaskCard 只有 `tier1|hopper` route 和 coding 风格状态/merge 边（`docs/09-data-contracts.md:289-323`）；Tier 1 settle proof 强制 `treeSha` 与 `tier1VerifyDigest`（`docs/09-data-contracts.md:553-576`），没有文章 artifact/content-review proof。
- 成功结果仍只有 `coding_done`（`docs/09-data-contracts.md:805-807`、`docs/10-voice-ux-spec.md:140-145`、`docs/modules/c-control-bridge.md:56-63`），任务详情和操作行仍固定“合并”( `docs/08-module-design.md:181-185`、`docs/11-ui-spec.md:181-185`、`docs/10-voice-ux-spec.md:74-77` )。05 §4 已承认非 coding 完成态/话术尚待扩展（`docs/05-roadmap.md:101-105`）。

**为什么是 A（P2 启用前）**

没有 writing executor、section checkpoint、返工/取消/settle proof 和成功结果，所谓“原样复用主闭环”只能把文章误送 coding runner，或在没有文章验收证据时错误回叫“完成”。

**修法**

定义 writing route/capability 及 `WritingSettleProof`（artifact/version digest、渲染/编译结果、section acceptance、citation coverage、content-review receipt），并定义 `article_ready`/`article_blocked` 等结果联合、逐节暂停/返工/取消状态。非 coding 不进入 merge；UI/话术按 project type 分支，能力不支持时在拍板前 fail-closed，不静默换档。

## B 级（应改，P2 前置）

### B-1 · 就绪清单对正式 paper 还不可判定

`docs/02-product-definition.md:78` 当前实际列了六个斜杠项（核心论点、读者/发表场景、文体/篇幅、结构、论点—素材覆盖、风格参照），方向正确，但 `docs/09-data-contracts.md:774-775,834` 仍只有通用 `Claim[]` 与 knowledge/requirement 文本前缀，没有 typed key、证据状态或 writing 分支。学术 paper 至少需要按 `subtype=paper` 条件启用：研究问题/贡献或新颖性、related work 与文献缺口、方法/数据/结果/限制、伦理/数据许可/可复现性、作者署名与 AI disclosure、venue/template/version、字数/页数/编译 oracle、citation style/DOI/page。普通行业文章不应被强塞全部 paper 字段。

修法：新增 `WritingSpec`/`AcademicPaperSpec` 和每项 `status/evidence/critical`；把未覆盖的外部可核验主张标为 `uncited_external_claim`，直接阻塞 ready。

### B-2 · 09 §4.1 可复用作证据层，但不等于文章逐条引证合同

这里应肯定当前文档的诚实修正：`docs/02-product-definition.md:92-95` 已把“稿内引用逐条验证”标成 P2 扩展留白，因此不是把现有合同冒充成已完成能力。`SourceSnapshot/VerifiedExcerpt/ClaimSourceVerification` 能复用来证明快照完整性、freshness、quoteMatch 和 semantic support（`docs/09-data-contracts.md:199-250`），但仍缺文章层：

- `Artifact` 注释说“含参考文献元数据”，结构却只有 type/path/digest/tags/source（`docs/09-data-contracts.md:426-436`），DDL 也只有无 CHECK 的通用 TEXT 列（`docs/09-data-contracts.md:521-526`）。
- `claim_snapshot_links` 绑定的是 `memory_event_id`，不是 artifact 的段落/引用标记（`docs/09-data-contracts.md:521-524`）；把稿件主张硬塞成记忆事件会污染 M2 语义。
- `article` 只是注释为 writing 产出（`docs/09-data-contracts.md:426-436`），没有 `Artifact.type=article ⇒ Project.type=writing`（或明确 phase intent）的允许矩阵；迁移未定时，article 可能落在 research/coding 项目而无法选择正确验收路径。
- 没有 citation identity（作者/题名/年份/venue/DOI/URL）、页码/章节、直引/转述、文中标记↔参考文献一一映射、coverage、版本/撤稿策略或 citation-style/编译验收。
- §4.1 规定 UTF-8 且二进制源不作语义引证（`docs/09-data-contracts.md:210-212`）；02 表却承诺 md/docx/LaTeX（`docs/02-product-definition.md:78`）。对照实施仓当前 web/artifact 快照也明确 unsupported（`SayDo/packages/daemon/src/evaluator/snapshotter.ts:5-7,59-72`）。
- 实施仓 `ArtifactStore.write` 只接收旧 `ArtifactType`、把内容固定写成 `.md` 并按 UTF-8 文本 digest 读取（`SayDo/packages/daemon/src/artifacts/store.ts:28-67`），尚无 docx/LaTeX renderer、格式版本或导出 proof。

修法：新增 `ArticleCitation`/`ArticleClaimBinding`/`CitationVerification`（artifactId+version、稿件位置、bibliographic identity、snapshot/excerpt、verification digest、coverage/状态），定义 PDF/HTML 到稳定文本+页码/版本的解析边界；docx 作为带 renderer/version 的派生导出，或暂不承诺 docx 语义验收。缺绑定、错 DOI/页码、stale、未覆盖外部主张均 fail-closed，并在 §12 加正反例、遗忘/版本 lineage 测试。无需推翻 §4.1 基础层。

### B-3 · enum、DDL、迁移、配置和契约测试的交接仍不完整

- `docs/09-data-contracts.md:447-448` 已写明 SQLite CHECK 不能直接 ALTER、P2 首次写入前要做 zod/新库 DDL/存量表重建；但没有 migration version、表重建 SQL、事务/锁、备份与回滚、行数/digest 校验、旧 binary 行为或启动门禁。`schema_migrations` 仍称 v1 是全表全集（`docs/09-data-contracts.md:551-552`）。
- 对照实施仓仍是 additive-only、只有 1–3 迁移（`SayDo/packages/daemon/src/storage/ddl.ts:1-3,5-10,130-134`），已应用版本会跳过（`SayDo/packages/daemon/src/storage/db.ts:19-34`），迁移测试只断言最高版本 3（`SayDo/packages/daemon/test/storage-checks.test.ts:251-272`）；contracts 仍无 writing/article（`SayDo/packages/contracts/src/types/project.ts:7`、`artifact.ts:8-16`）。本轮实跑旧 CHECK 插入 writing 的原始输出为 `CHECK constraint failed`。
- `Artifact.type` 在 DDL 没有 enum CHECK（`docs/09-data-contracts.md:525-526`）；project.toml 示例仍只有 `type = "coding"`，没有 `enabledProjectTypes`（`docs/09-data-contracts.md:694-701`）。
- §12 清单虽有通用 TS↔DDL round-trip/源快照测试，但没有 writing/article 正例、P0 拒绝、旧库升级、Citation/Attribution 反例（`docs/09-data-contracts.md:748-764`）。

修法：P2 前新增明确 v4（或等价版本）迁移，事务化 SQLite 表重建，备份/回滚/校验与并发锁；同步 zod、DAO、fixtures、配置 schema、旧二进制兼容策略和 §12。若暂不迁移，就保留旧库并由版本/feature gate 明确拒绝 writing，不能只靠注释。

### B-4 · research 边界和“AI 不查”措辞会误导 owner 设定的调研型准备

`docs/02-product-definition.md:90` 把 research 简化为“对内报告”、writing 简化为“对外成文”，但 paper/文章都可能先内部审阅；更关键的是 `docs/02-product-definition.md:94` 写成“素材主要靠采访挖、不靠 AI 查”，容易把“作者观点必须来自用户”误读成“相关工作/事实调研不能由 AI 辅助”。应按 epistemic goal + `publicationIntent/venue` 区分类型，并明确：AI 可以做相关工作、证据搜集和候选论点；只有用户确认后才能采用，且不能伪标为 `user_stated`。风格样文（`docs/02-product-definition.md:78,96`）也要有来源与确认状态，AI 自写样文不能反过来证明“像用户”。

### B-5 · canonical sweep 的小漏点和风险映射需回写

- 产物目录示例仍只列方案/调研/报告（`docs/03-architecture.md:136-139`、`docs/modules/b-memory.md:35-42`），应补 article/paper 或明确 P2 deferred。
- `network_fetch` 仍注释为 P1 research（`docs/09-data-contracts.md:104-111`）；writing 的外部证据采集应明确复用能力、来源白名单、SSRF/快照边界和风险升级，不应静默放网。
- 06 §5 只有三种 SourceSnapshot 合同，没有 `writing/article`、transition、attribution、citation coverage 等新 canonical 术语（`docs/06-references.md:80-101`）；建议补一行，避免“研究项目类型 / research artifact / Hopper task 状态”混用。
- `docs/02-product-definition.md:96` 把写稿固定称风险 S1；04 的风险是按效果、目标和数据计算（`docs/04-key-mechanisms.md:130-141`），而非代码项目默认工作树。应定义 managed artifact 的隔离、覆盖/删除、导出和共享文件升级规则。

## C 级（可选 / 见仁见智）

- `S1` 同时是 02 的场景编号、04 的风险语境的一部分，06 可注明“场景 S1–S3”与“风险 S0–S3”是两个命名空间，减少口播歧义（`docs/02-product-definition.md:9-15`、`docs/04-key-mechanisms.md:130-141`）。
- 03 的 artifacts 路径注释可以补“文章/论文”，但不应因此把 writing UI、demo 或 P0 工具提前塞入首发。
- 历史 `history/`、`research/` 中旧的场景枚举不属于 canonical；可在下一次归档 sweep 统一，不构成本轮 P0/P2 阻塞。

## 免修确认清单（已核过、当前没有问题）

- `docs/01-vision-and-problem.md:74-76` 已把“文章”纳入有明确产出与验收标准的范围。
- `docs/02-product-definition.md:13,78,82,86-96` 已同步 S3 场景、writing 示例、风格样文、用户确认与发表治理；并且已明确引用级合同是 P2 留白，没有把未实现能力写成现状。
- canonical 09 中 Project/DDL/promote 的 writing 词表位置彼此一致（`docs/09-data-contracts.md:47,446-448,827`）；迁移注记也诚实写出 SQLite CHECK 重建和 P2 首次写入前置（`docs/09-data-contracts.md:447-448`）。
- P0/P2 分期文字本身一致：P0 只 coding（`docs/05-roadmap.md:59`），writing/统一非 coding 执行器在 P2（`docs/05-roadmap.md:101-105`）；缺的是可执行门禁，不是分期文字。
- S3 治理没有被 writing 降级：写稿在圈内、发表/投稿/发编辑是出圈动作（`docs/02-product-definition.md:96`），04 明确 S3 需屏幕/生物识别且与执行模式无关（`docs/04-key-mechanisms.md:139-141,163-170`）。
- taint/provenance 方向相容：04 的 raw→candidate→taint→trusted 与“第三方不能定义用户偏好”规则（`docs/04-key-mechanisms.md:38-47`）和 09 的 agent_output 不得作为 critical 唯一支持（`docs/09-data-contracts.md:246-250`）一致；本轮需要补的是写作层映射，不是推翻底层哲学。
- SourceSnapshot/VerifiedExcerpt 的 TOCTOU、freshness、quoteMatch、semanticSupport、注入防护基础合同本身成立（`docs/09-data-contracts.md:199-250`）；它适合作为 writing 的 evidence layer，但不应被误当完整 citation manifest。
- 当前 demo 没有硬塞 writing，且 marketing 已明确标 P2/P3（`demo/saydo-console-demo.html:416-420`）；在 P2 executor/feature gate 未闭合前，README/demo/01/08 不新增 writing UI 是符合克制原则的。
