# 模块详设 B · 记忆域(B1–B5)

> **性质**:实施视角详设 + 核对索引,细化 [08](../08-module-design.md) §2 B 域。合同真相源 = [09 §4/§5/§9](../09-data-contracts.md) 与 [04 §1](../04-key-mechanisms.md);本文引用不复制,冲突时 canonical 胜。

## B1 · 上下文编译器(ContextCompiler)

- **职责**:确定性编译 Context Pack:来源优先级、冲突与撤销规则、各层 token 预算、taint 过滤、pack digest 与 compilerVersion。**不做**:检索排序的语义创新(B5 给候选,B1 只按规则装配)、会话状态(A2)。
- **接口面**:09 §5(Context Pack 合同**七规则**——2026-07-25 M7 增⑥装配序恒定/⑦驱逐纪律)、`context_snapshots` 内容表 + `context_snapshot_uses` 使用记录表(09 §9,M1 拆表);`ContextSnapshot` 草图 08 §4。
- **设计要点**:① **同输入同 digest**(可缓存、可审计、可复现——"Brain 看到了什么"永远可回答);② 冲突规则:新 user_stated > 旧;invalidate/forget 即时生效;expiresAt 到期不入 pack;③ taint 过滤:third_party/candidate 不进 M0 位置,repo_file 带 taint 标注;④ excluded 记录(什么被裁掉+为什么,供 A5 判"知识缺口"与调试);⑤ 分层预算:M0 常驻小、M1 结构化、M2 按需引用、M3 只进当前会话相关轮;⑥ **前缀稳定**(M7):segment 按 tier 恒定(M0/M1=stable 字典序渲染、M2/M3=topical 后置),parentPackDigest 入签名、prefixDigest 派生不入签名。
- **依赖**:B2(事实)、B4(产物引用)、B5(候选检索);被 A2/A3/A5 消费。
- **失效与恢复**:纯函数式(输入=账本快照+预算配置);崩溃无状态可丢。
- **验证归属**:2.2(同输入同 digest;excluded 记录;freshness 过滤;**prefix-diff——相邻两次编译全部易变字段位于公共前缀之后**,M7)。
- **分期与开放项**:P0 最小规则集。开放:token 预算的按模型档自适应(P1)。

## B2 · 记忆账本(MemoryLedger)

- **职责**:append-only `memory_events` 真相源 + 派生投影;写路径 `raw → candidate → 检查(冲突/taint/policy) → trusted`;删除传播。**不做**:P0 不落 `current_projection` 表(启动全量重放入内存,`knowledge/*.md` 即文件投影)。
- **接口面**:09 §4(MemoryEvent 判别联合/Trust 词表/SourceRef)+ §9 DDL(op 枚举 CHECK、遗忘事件拒空 payload、forget_hard 须 generation——2026-07-24 已机械化);工具面 09 §13(remember/forget 等)。
- **设计要点**:① 直入 trusted 仅 `user_stated` 与 `auto_low_impact`,后者过**独立机械判定器**(source ∈ {git-tracked repo_file, user_edit} ∧ 事实性陈述;指令词/第三方一律降 candidate;不经 Brain——owner 2026-07-24);**M0 只收 user_stated/user_approved**(04 §1.4 安全边界:第三方内容永远不能定义偏好/权限/凭据);**readiness 联动(A3-armed 2026-07-28,09 §13 covered 块)**:add/correct 事件可带 readinessKey(候选绑定;`user_approved` 不再是工具可自报值,只能由 confirmReadiness 确认环产生);claim 失效(invalidate/forget_soft/forget_hard/supersede/expiresAt——active 投影全枚举)⇒ 其支撑的 ReadinessBinding 非现役 ⇒ 对应就绪 key 回 unknown(撤销传导,派发事务权威复核);② **forget_hard 是 append-only 的唯一例外**:tombstone(target ids/digests+generation)+ 就地覆写历史 claim/source + memoryGeneration 同事务 +1;清除多目标(FTS 行/投影/摘要)重放幂等;**备份例外**:快照备份不逐条清,登记待过期,`backup_retention_days`(缺省 30)到期整份删,话术如实告知(10 #38);③ FTS 用普通表(非 external-content),删除用标准 `DELETE`;④ 人工编辑 knowledge/*.md → daemon 监测 diff → 生成 `correct(source.kind=user_edit)` 回账本(双向)。
- **依赖**:E3(审计);被 B1/B5/A5 读。
- **失效与恢复**:崩溃在"tombstone 后/覆写前"→ 重放收敛(2.1 崩溃相位注入);投影可全量重放再生。
- **验证归属**:§12-4 全绿(传播/否定不复活/M0 拒第三方/过期不入 pack/重放幂等)+ DDL 反例(空 payload 拒)。
- **分期与开放项**:P0(G6 另一半,P0 形态即闭环);deletion job 表 = **P1**(09 §14-A6,2026-07-24 降级);consolidate = P1。

## B3 · 奠基器(FoundationBuilder)

- **职责**:项目奠基(一次性,重)与会话预热(每次,轻):生成 foundation manifest,generation 原子切换;AGENTS.md 双向互通。**不做**:无预算上限的全仓扫描。
- **接口面**:04 §1.2(先备后答);预算参数 09 §11 [params](`foundation_budget_min=5` / `foundation_budget_tokens=200000`);奠基产物入 B2/B4。
- **设计要点**:① **预算化**:超限产 partial manifest + 进度话术(如实"还没读完",不装读过);② generation 原子切换(奠基升级不半生不熟);③ 预热用 git diff 种子(上次快照以来变更);④ 沉思档承载(BYOA 订阅主场,07 D18);⑤ Quick-奠基复用:应急车道 P1 的 P0 兜底(05 §6 盲区表态)。
- **依赖**:B2/B4(写入)、B5(rg 现读)、E1(沉思档);被 A3/B1 消费。
- **失效与恢复**:中断 → partial manifest 可续跑;generation 未切换前旧底座继续可用。
- **验证归属**:2.3(中型仓预算内完成;大仓超限如实降级;预热增量 fixture)。
- **分期与开放项**:P0 轻量 / P1 完整(持续深化)。

## B4 · 产物库(ArtifactStore)

- **职责**:M2 全程写入:方案多版本/调研/报告/计划/文章稿(writing 窄版 W4——`article` artifact 随 09 §6.1a/WritingSettleProof;全量引证合同仍 R-C),version+lineage+supersedes 链,digest 校验。**不做**:P0 不做控制面(时间线/diff/子集导出 P1,浏览页 D1 只读列表)。
- **接口面**:`artifacts` 表 DDL(09 §9,PRIMARY KEY(id,version))+ `Artifact` 类型与 digest 规则(09 §8/§0);文件落 `<workspace>/.saydo/artifacts/`(03 §6)。**写入主体 = daemon 内部 DAO**(A6 计划落盘/C6 摘要落库直调,不经 Brain 工具);Brain 侧召回 P0 走检索(B5)+ Context Pack 引用,**09 §13 无独立产物工具**——若实施发现 Brain 需要直挂产物工具(如语音"召回注入对话"),先回写 09 §13 定签名再编码。
- **设计要点**:① 决策包计划落盘 = 可编辑 artifact(A6);② supersedes 链是"方案演进史"的真相(召回旧版本);③ source 标注(哪次会话/任务产的)。
- **依赖**:B2(索引事实)、E3;被 A6/B1/D1 消费。
- **验证归属**:3.3(digest 校验 + version/supersedes 链测试)。
- **分期与开放项**:P0 写入+版本 / P1 控制面。

## B5 · 检索(Retrieval)

- **职责**:FTS5(BM25,trigram 起步)+ live `rg` 组合检索;provenance/freshness 硬过滤。**不做**:向量检索(sqlite-vec P1 可叠)、把代码事实收进知识库(**永远 agentic grep 现读**,03 §9)。
- **接口面**:`memory_fts`(09 §9,trigram tokenizer);07 D9(分词 spike:trigram → simple 扩展 → 预分词;最坏 rg-only+结构图)。
- **设计要点**:① 双源合流:知识库(FTS)答"我们决定过什么",仓库(rg)答"代码现在是什么"——来源标注给 A3 区分口播口径;② freshness:expiresAt/invalidated 命中即过滤(不给 Brain 旧事实);③ provenance 随结果带出(溯源问答 10 #37 机械回放)。
- **依赖**:B2(账本)、workspace(rg);被 B1/A3/A4 消费。
- **验证归属**:2.2(freshness 过滤测试;D9 spike 语料两批跑分)。
- **分期与开放项**:P0。开放:中文召回不达标时的降级链(07 D9 风险表)。
