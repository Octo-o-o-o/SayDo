# 攒批评审:实施期 canonical 回写第一批(2026-07-24)

你是独立评审员。对 voice-coding 设计文档库(当前目录)刚完成的一批 canonical 回写做缺陷优先评审。只读文档,输出发现;不改文件。

## 本批回写内容(已含一致性 subagent 评审 2A/9B 的回修)

1. **09 §4.1 源快照与引证验证**(主体,Phase 3 前置):SourceSnapshot/VerifiedExcerpt/ClaimSourceVerification 三类型;§0 前缀 snap_;§0.1 矩阵三行;§4 stores 枚举加 "snapshot";§9 DDL(readiness_assessments 两列 + source_snapshots 表);§12-11 反例;§13 assessReadiness 消费语义;04 §1.3/§2.2-5(stale 重验闭合);06 术语表;modules/a A5 结项。
   依据:research/codex-findings/11-post-review-reassessment-sol-review.md 第 78-94/165 行(A3 项)。
2. **09 §10 confidence 可选化**:asr.partial/final 的 confidence 改可选(定档 sauc 大模型实测不回置信度);10 #7 触发器停用语义 + #37 stale 槽位。
3. **07 D4 ASR 定档回填**:火山豆包 bigmodel 流式 sauc 单家起步(实现仓 SayDo docs/adr/ADR-101;60 条跑分热词 +10 点);09 §11 asr 注释同步。

## 评审焦点(按严重度 A/B/C 分级)

1. §4.1 合同的可实现性与安全:TOCTOU 纪律是否可落地;hard-forget 快照传播是否闭合(与 §4 多目标清除/备份例外的关系);no_quote 资格规则是否会误伤正常 claim(所有 critical claim 都必须带 quote 是否过强——评审此取舍);stale 重验语义是否与 04 §2.2-5 完全一致;注入防护是否只靠"数据栅栏"一句话(需要什么最低实现约束)。
4. 跨文档一致性残留:09 §4.1 与 §5(Claim)/§13(assessReadiness)/§14 开放项清单;07 D4 与 05 路线图;10 #7 停用与 02/05 的语音体验承诺。
5. DDL 与 TS 类型对账(§12-9 round-trip 视角):source_snapshots 列集 vs SourceSnapshot 字段(encoding/resolver.name 豁免注记是否足够)。
6. 引用锚点正确性(行号/编号/文件路径)。

输出:发现列表(级别/位置/问题/依据/建议措辞),最后给"本批回写 Go/No-Go + 必修清单"。简体中文。
