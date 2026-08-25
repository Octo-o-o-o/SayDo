# 19 · 对抗性评审:IMPLEMENTATION-PLAN-2(补充实施方案 · 第一期全量清偿)

你是对抗性评审员。仓库 `~/WorkSpace/voice-coding` 是 SayDo 的设计文档仓(docs/01–11 + modules/ + adr/ 是 canonical,09 是实施照抄源);实施仓在 `~/WorkSpace/SayDo`(只读参照,HANDOFF.md 是其现状真相)。

## 评审对象

`IMPLEMENTATION-PLAN-2.md`(v1.0,2026-07-26)。背景:owner 指令"把所有文档里后续会做的待实施项全部收进第一期,全部完成";首发(IMPLEMENTATION-PLAN.md P0+P0.5)工程侧已收口(接线批+执行器批 evidence 在 SayDo/e2e/evidence/),场次①–④待 owner。方案把原 P1/P2 全量 + 提前批(owner 已拍,05 §4 提前批)+ 合同债 + 数据触发轨组织为 W1–W9 工作流。

## 请你对抗性审查(先读方案本体,再抽查其出处引用,重点五问)

1. **完整性(疏漏)**:对照 docs/01–11、modules/a–e、05 §4 原 P1/P2/P3 清单、09 的 reserved/[P1] 标记、07 的分期与 spike 列、IMPLEMENTATION-PLAN.md 的顺延/挂账项、SayDo/HANDOFF.md §2——方案有没有漏收"后续会做"的项?有没有已完成项被误列为待做?
2. **正确性**:每项的出处引用、前置关系、合同基础是否属实?(抽查:S3 卡 merge 语义现状、writing 窄版合同缺口清单、A6/edit 审批/network_fetch/电话升级在 09 的 reserved 位置、执行器批收口证据。)
3. **可行性**:依赖序(R-A→W4→W5→W6,R-C→W8)有没有倒置或缺环?双仓并行规则是否成立?工期粗估是否离谱?单会话串行 + 每批交接的漂移风险是否有对策?
4. **过度设计**:有没有把"没设计过的东西"当成可排产项(P3 边界是否守住)?有没有为假想需求发明机制?反向:显式边界(§3)有没有把 owner 明确要的东西错误排除?
5. **纪律一致**:与 AGENTS.md 评审制度、HANDOFF §4 铁律、"合同先行/契约不分叉"、S3 治理(卡片合同轮的 merge 解禁边界是否守住保守缺省)是否冲突?

## 输出要求

评审报告**写入** `research/codex-findings/19-plan2-review.md`(简体中文):结论一句话 → A 级(硬伤必修,给修法)→ B 级(应改)→ C 级(可选)→ 免修确认清单(核过没问题的点,逐条)。每条给文件/行号或章节证据。若无 A 级明说。不要修改方案本体或其他任何文件。
