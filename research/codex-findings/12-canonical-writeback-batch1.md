结论：**No-Go**。共发现 **3A / 3B / 1C**。§4.1 的方向正确，但 hard-forget、fail-closed 判定和 ASR 实施权威仍有硬冲突，当前不能作为 Phase 3 “可照抄合同”。

范围说明：当前目录没有 `.git` 元数据，无法核对本批精确 diff；以下基于当前文档快照。全程只读，未改文件。

## 发现列表

### A1｜hard-forget 对快照及派生副本没有闭合

- **位置**：[09 §4 L183](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:183)、[L195](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:195)、[§4.1 L212](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:212)、[DDL L478](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:478)、[§12-11 L686](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:686)、[§14-A6 L759](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:759)、[10 #38](/Users/wangyixiao/WorkSpace/voice-coding/docs/10-voice-ux-spec.md:80)。
- **问题**：当前只承诺删除 `bodyPath`，但活动存储里还可能保留明文：
  - `source_snapshots.source_json` 含 `SourceRef.quote/ref`；
  - `readiness_assessments.dims_json` 承载 `Claim.text/source`；
  - `source_verifications_json` 若按当前类型完整序列化，会含 `VerifiedExcerpt.text`；
  - 没有 memory/claim→snapshot 的一等关联，也没有 `project_id`，无法可靠枚举应清快照。
- 同一个源快照若被多条 claim 复用，删一条 claim 时直接删正文还会破坏其他 claim；若不删则遗忘失败。备份保留期例外只适用于备份，不能覆盖这些活动 DB 副本。
- **依据**：全库只在 §4 prose 中出现“按 claim 关联的 snapshotId”，DDL 没有对应关系表；§14 却已宣称 A6 P0 闭环，#38 允许播报“删掉了”。
- **建议措辞**：

  > hard-forget 的 active-store 清除集必须逐项覆盖 memory event、FTS、投影、摘要、`source_snapshots` 行与正文、assessment 中的 claim/source/excerpt 明文及 invocation 输入；备份是唯一延迟删除例外。建立 `claim_snapshot_links`（含 projectId/memoryEventId/claimDigest/snapshotId）并定义共享快照的重建或引用规则。删除 proof 只有在活动存储零明文、零孤儿正文后才成功。

  同时重开 §14-A6，扩充 §12-4/§12-11；否则 #38 不得说“删掉了”。

### A2｜critical claim 验证目前是 fail-open，stale 与注入语义不闭合

- **位置**：[ClaimSourceVerification L225–239](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:225)、[04 §2.2-5](/Users/wangyixiao/WorkSpace/voice-coding/docs/04-key-mechanisms.md:69)、[09 §13](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:748)、[10 #37](/Users/wangyixiao/WorkSpace/voice-coding/docs/10-voice-ux-spec.md:79)。
- **问题**：
  - `semanticSupport` 是可选字段且包含 `unclear`，消费谓词却只拒绝 `unsupported`；因此 `undefined/unclear` 都能穿过。
  - `freshness="stale"` 不在拒绝谓词中；“触发重快照”只是 prose，没有不可消费中间态，也未定义重快照失败、源删除或不可达的终局。
  - “数据栅栏”不是注入防护边界；当前只有一个“忽略以上指令”反例，没有输入隔离、严格输出、解析失败和模型权限边界。
  - #37 仅凭 `freshness=stale` 就可播“我按新版又核了一遍”。但 stale 只证明源变了/不可达；成功重验后最新验证理论上又应是 fresh。
- **后果**：被注入或无法判断的摘录仍可能让 critical claim 进入 ready。
- **建议措辞**：

  > deep verification 仅在 `integrity=intact ∧ freshness=fresh（当前终态快照）∧ evidenceBinding 已验证 ∧ semanticSupport=supported` 时通过。`stale` 是不可消费中间态；重验不可达/失败 ⇒ `unknown → gap_critical`，新快照明确不符 ⇒ `conflicting → gap_critical`。critical claim 的 `semanticSupport` 必填，`unclear/缺失` 一律阻塞。

  最低注入约束应增加：摘录只进入转义后的结构化 untrusted-data 字段、不得拼入 system instruction；evaluator 零工具；严格 JSON Schema/枚举；额外文本、解析失败、超长或异常类型均 fail-closed；机械门只能被模型降级、不能被升级；增加多种越界、伪分隔符、角色冒充和间接指令语料。

  #37 应由显式 `revalidation.status="succeeded"` 驱动；失败时改说“原文变了，我现在无法按新版确认”。

### A3｜D4 已定档，但路线权威仍会把实施卡回“待选型”

- **位置**：[07 D4 L68–69](/Users/wangyixiao/WorkSpace/voice-coding/docs/07-tech-stack-decisions.md:68)、[07 §10-4](/Users/wangyixiao/WorkSpace/voice-coding/docs/07-tech-stack-decisions.md:246)、[IMPLEMENTATION-PLAN Phase -1](/Users/wangyixiao/WorkSpace/voice-coding/IMPLEMENTATION-PLAN.md:18)、[Plan 1.0](/Users/wangyixiao/WorkSpace/voice-coding/IMPLEMENTATION-PLAN.md:69)、[modules/a A1](/Users/wangyixiao/WorkSpace/voice-coding/docs/modules/a-dialogue.md:10)、[05 权威声明](/Users/wangyixiao/WorkSpace/voice-coding/docs/05-roadmap.md:5)。
- **问题**：
  - D4 说单家定档、第二家非阻塞；Plan 却仍要求“≥2 家 key”为 P0 硬门并要求两家跑分。
  - 07 自己的 P0 spike 清单仍写“300–500 条、两家对比后定 D4”。
  - modules/a 仍写“ASR 待 1.0 spike”。
  - 05 明定 Plan 管分期，因此实施者应按 Plan 停工，而不是按 D4 开工。
  - [ADR-101 L19–20](/Users/wangyixiao/WorkSpace/SayDo/docs/adr/ADR-101-asr-volc.md:19)把“PTT 整段识别”放 P0、实时分片放 P1；但 [05 P0](/Users/wangyixiao/WorkSpace/voice-coding/docs/05-roadmap.md:76)仍承诺流式 ASR。
  - [05 风险表](/Users/wangyixiao/WorkSpace/voice-coding/docs/05-roadmap.md:130)仍依赖“复述确认”，而 [10 #7](/Users/wangyixiao/WorkSpace/voice-coding/docs/10-voice-ux-spec.md:33)已停用缺省触发器。
- **建议措辞**：

  > D4 已于 2026-07-24 结项：P0 使用火山 sauc 单家起步；第二家对比和 300–500 条真实 golden 是换 provider 门禁，不是 Phase -1/P0 开工门。

  流式范围必须二选一并统一：若 P0 是松键后整段识别，05 应明确“不保证 `asr.partial`”；若保留 P0 流式体验承诺，则 ADR 的实时分片不能放 P1。05 风险缓解改为“热词 + 用户纠错事件 + 连续纠错降级打字；provider 有 confidence 时才启用低置信复述”。

### B1｜TOCTOU 只写了目标，没有可执行的捕获与提交纪律

- **位置**：[09 L206–215](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:206)、[DDL L482](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:482)、[文件布局 L549](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:549)。
- **问题**：
  - `realpath(禁 symlink 穿越)`不成立：`realpath` 会跟随 symlink；未定义 `O_NOFOLLOW/openat/fstat`。
  - Web 缺 redirect 上限、scheme/content-type/大小、私网地址策略。
  - 未定义临时文件、流式 hash、`fsync`、原子 rename、DB insert 顺序及孤儿清理。
  - `git:<commit>:<path>` 是不可变快照定位，但 freshness 需要“逻辑源当前版本”；两种 locator 混在一个字段里。
  - 声称不可变，但 DDL/DAO 不禁止 UPDATE；`snapshots/` 也未列入 §11 文件布局。
- **建议措辞**：

  > 快照正文写临时文件时同步计算原始字节 digest，完成后 `fsync + atomic rename`，再插入 DB；崩溃孤儿由确定性扫描清理。文件源使用 no-follow 打开并在读取前后校验 inode/size/mtime；Web 限 HTTPS、redirect 次数、content-type、正文大小和私网访问。分离 immutable `snapshotLocator` 与用于 freshness 的 `liveLocator/versionToken`。

### B2｜`no_quote` 的安全意图合理，但状态和证据模型过强且自相矛盾

- **位置**：[09 L209](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:209)、[L232–236](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:232)、[Claim L244](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:244)、[06 术语表](/Users/wangyixiao/WorkSpace/voice-coding/docs/06-references.md:85)。
- **判断**：让 `no_quote` **阻塞 ready 是合理的 fail-closed 选择**；但把它直接变成 `conflicting`，并要求所有正常 critical claim 都自带单条原文 quote，过强。
- **问题**：
  - 综合多个转写/文件得出的正常 critical claim 无法用单条原文 quote 表达。
  - `Claim.source` 是单数，却写“单源且 agent_output/import”。
  - agent/import 被声明“豁免快照”，但 `ClaimSourceVerification.snapshotId` 必填，类型无法构造。
  - 所谓三个独立维度并不独立：`criticalSupportEligible` 又由 `integrity + quoteMatch + source.kind` 聚合；真正的 source credibility 也没有单独字段，普通 web 源可成为唯一支持。
- **建议措辞**：

  > `quoteMatch=mismatch` 才表示 conflicting；`no_quote` 表示 `evidence_missing/unknown`，继续阻塞 ready。critical claim 须有至少一条 `EvidenceBinding`；quote 可由上游提供，也可由 daemon 从稳定源生成 VerifiedExcerpt。Claim 改为 `evidence: EvidenceBinding[]`。agent_output/import 无快照时使用显式 rejected union，不伪造 snapshotId。各原始维度独立保存，`criticalSupportEligible` 由纯函数派生而不持久化。

### B3｜DDL 可解析，但 round-trip/replay 约束不足

- **位置**：[source_snapshots DDL](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:482)、[readiness DDL](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:478)、[replay 声明](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:239)、[assessReadiness](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:697)。
- **依据**：DDL 送入 `sqlite3 ':memory:'` 可执行；但实际探针结果：
  - 插入 `source_snapshots.id=NULL` 成功，查询输出 `1|1`；
  - 只写 assessment id 也成功，`evaluator_model/prompt_digest/source_verifications_json` 均空，输出 `r|1|1|1`。
- **问题**：
  - `id TEXT PRIMARY KEY` 在 SQLite rowid 表不等价于显式 `NOT NULL`。
  - replay 三列全可空，且没有 `rules|deep` 判别字段来允许规则层例外。
  - `source_verifications_json` 未明确必须序列化完整字段/range；只有 prompt digest 不能恢复 prompt 正文或模板版本，“完整重放”表述过强。
  - `assessReadiness` 在规则层也强制返回 `evaluatorModel:string`，会把“配置模型”和“实际调用模型”混为一谈。
- **建议措辞**：

  > `source_snapshots.id` 显式 `PRIMARY KEY NOT NULL`。assessment 增加 `layer`；deep 行必须具备 evaluator/model invocation、prompt template/version、完整 verification 投影，rules 行才允许为空。将“完整重放”改为“可审计重建当次输入与裁决”；若真要重跑，保存 rendered prompt 或不可变 invocation 引用。

  `encoding` 与 `resolver.name` 是 literal 常量，**P0 不落列本身可以接受**，但必须由版本化 decoder 固定补回，并在 §12-9 加 round-trip 断言；将来出现第二值时先迁移 schema。

### C1｜引用锚点和证据归属有残留

- [04 L69](/Users/wangyixiao/WorkSpace/voice-coding/docs/04-key-mechanisms.md:69)的“§3.2 加反例”在本文件不存在，应写成 `IMPLEMENTATION-PLAN Phase 3 / step 3.2` 或 `09 §12-11`。
- [09 L226](/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md:226)引用“§0 textDigest 口径”，§0 没有 `textDigest` 定义。
- D4 所引 [ADR-101](/Users/wangyixiao/WorkSpace/SayDo/docs/adr/ADR-101-asr-volc.md:1)和 [RESULT](/Users/wangyixiao/WorkSpace/SayDo/e2e/spikes/asr-1.0/RESULT.md:14)确实存在，60 条与 55.4%→65.3% 能对上；但两份文档都没有“sauc 不回 confidence”的实测记录。该事实应补到 ADR/RESULT，或换成真实证据锚点。
- 用户给出的 SOL 依据行 78–94/165 与当前文件内容能对上。

## Go/No-Go 与必修清单

**本批 No-Go。** 至少完成以下事项后再判 Go：

1. 闭合 hard-forget 的全存储关系图、共享快照规则和删除 proof，并重开 §14-A6。
2. 将 semantic/stale/重验失败改为终态 fail-closed；#37 改用明确的重验结果。
3. 写入最低 prompt-injection 实现约束与反例矩阵。
4. 统一 D4、07 spike 清单、IMPLEMENTATION-PLAN、modules/a、05 与 ADR 的 ASR 状态和流式分期。
5. 修正 no_quote 状态、证据多源模型及 agent/import 无快照类型。
6. 收紧 DDL 的 `NOT NULL`、deep assessment replay 约束和 round-trip 测试。
7. 修复锚点，并给“无 confidence”补真实证据。