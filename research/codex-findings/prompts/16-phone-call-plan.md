# Codex 评审 prompt · 16:通话形态实施计划(v2)对抗性评审

你是 SayDo 项目的对抗性评审员。SayDo 是语音驱动本地 AI agent 的"幕僚长"产品,P0(桌面 Tier1 全闭环)+P0.5(Hopper 桥/直达验收)已工程收口。现评审 P1 通话形态(Phone-Call Mode)的**分阶段实施计划 v2**。方案本体(v3)已过你上一轮评审(No-Go→A1–A9 修正)+ 4 subagent;本计划 v2 已过 2 路计划评审(完整性 + 落地一致性)。你是计划定稿前最后一道关。

## 评审对象

`research/phone-call-impl-plan-2026-07.md`(实施计划 v2,逐 Phase 精读)

## 上下文材料

- `research/phone-call-design-2026-07.md`(方案 v3,§9 有你上轮的 A1–A9)
- `research/codex-findings/logs/15-phone-call-design.log`(你上轮报告)
- `IMPLEMENTATION-PLAN.md`(既有 SayDo 实施计划,对照 Phase/门禁/两提交法风格与工期口径)
- 实施仓 ~/WorkSpace/SayDo/(只读,核实计划步骤落点;重点 packages/daemon/src 的 callback/approvals/voice/session/net)

## 评审任务

1. **前置门正确性**:四道前置门(spike 阈值 / A1–A9+V5 冻结 / Gate0 addendum owner 拍板 / Phase 0.5 生产接线)的卡位、去循环是否正确?有无仍存在的循环依赖或"给未通电电路加保险丝"?
2. **Phase 0.5 判断**:评审实证"callback/审批/工具环生产未接线"——把它升为通话计划前置是否正确?还是应归还场次② dogfood 范围(即通话计划不该背这个债)?边界怎么划才对?
3. **依赖图与工期**:分叉(媒体线∥控制面线)是否正确?30–40 工程日 + 各 Phase 天数是否可信?有无仍然过重/过轻的 Phase?
4. **覆盖完整性**:方案 v3 的 A1–A9、V1–V8、in 范围是否都有落点?仍有遗漏?
5. **验收可判定性**:每步验收是否可机械判定?Phase 0 阈值冻结(0.0)设计是否解决了"止损门不可判定"?
6. **一次交付纪律**:是否真正"分阶段开发、不分步上线"?有无暗含部分上线?
7. **与既有裁决一致性**:是否违反 canonical 不变量、Gate 0、迁移纪律(如 approvals 表重建迁移与"v1 后 additive"纪律的冲突处理是否恰当)?

## 输出格式

- 总判定:Go / Conditional Go(列条件) / No-Go(列理由)
- 发现清单:编号,每条【级别 A/B/C】【发现】【证据(计划 Phase/步 + 方案节 + 代码文件)】【修法】
- ≤200 字总评
- 全部简体中文
