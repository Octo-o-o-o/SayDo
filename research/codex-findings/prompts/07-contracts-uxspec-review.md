# 任务:review 两份新文档(09 数据契约 / 10 语音话术规范)+ 本轮回修

你是严苛的对抗性评审员。VoiceLoop(`/Users/wangyixiao/WorkSpace/voice-coding/`)为开工前补齐了两份实施级文档,并按你上一份报告(06)完成了回修。请完整 review,写中文报告。

## 待评审(重点)

1. `docs/09-data-contracts.md`(新,Draft v0.9):canonical schema——DecisionPackage/EffectGrant/ApprovalReceipt/MemoryEvent/ContextSnapshot/TaskCard/DispatchBinding/CallbackOutbox/状态投影表/取消状态机/语音管线 WS/SQLite DDL/文件布局/config/契约测试清单。
2. `docs/10-voice-ux-spec.md`(新,Draft v0.9):人格与口播纪律、canonical 话术表、轮次与打断规则、Brain instructions 骨架、摘要器输出规格、golden 对话集。
3. 回修抽查:`docs/04`(§5.4 路径二 S0/S1 红线、模式×后端矩阵、成本条件语气)、`docs/05`(§3 时序、Gate 0 引言、§6.1)、`docs/adr/ADR-001`(投影表、CURRENT/TARGET 标签、测试数字锚定)、`README.md`/`docs/03`(状态两行制)、`research/hopper-integration-request.md`(v3,17 项)。

## 对照材料

- 你自己的 `research/codex-findings/06-recent-rounds-review.md`(逐项检查 A-01~A-05、B 级是否真正关闭,有无新回归);
- `research/codex-findings/02-hopper-integration.md` + 本机 `/Users/wangyixiao/WorkSpace/Hopper/`(只读):核对 09 §6/§7 的映射与 `[待Hopper裁决]` 标注是否与现状一致、v3 prompt 的 17 项与现状描述是否准确;
- `docs/01/02/03/06/07/08`:交叉一致性(术语/状态词/分期)。

## 评审焦点

1. **09 的内部自洽**:schema 之间的引用闭合吗(每个 digest/Id 都有明确的生成者与校验者)?收据 outcome 状态机完备吗?取消状态机与 TaskCard.status 枚举一致吗?DDL 与 TypeScript 定义字段对得上吗?契约测试清单覆盖了它自己定义的全部红线吗?
2. **09 与 Hopper 现状**:投影表/settle 四项/DispatchBinding 的 `[待Hopper裁决]` 标注是否标全了(有没有把待裁决当已有)?
3. **10 的可实施性**:话术表与 04 状态词/S 分级/模式纪律有无任何一句矛盾?instructions 骨架有没有漏掉已立的硬规则(评估器独立/预授权只念 E2 生成/不预设模式选择)?
4. **过度设计检查**:09/10 里有没有 P0 不需要、应该砍掉或降级为 P1 的部分(对照"每个依赖要有回报")?
5. **回修回归检查**:06 报告的 A-01~A-05 是否全部关闭,B 级处理是否引入新矛盾。

## 输出

写入 `/Users/wangyixiao/WorkSpace/voice-coding/research/codex-findings/07-contracts-review.md`(中文):① 总评(09/10 是否达到"实施可照抄"标准);② A/B/C 分级问题清单(文件+位置+改法);③ 06 报告回归核对表;④ 过度设计裁决清单。区分【事实】/【judgement】;不修改任何文件。