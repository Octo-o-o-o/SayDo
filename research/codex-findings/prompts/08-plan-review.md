# 任务:review VoiceLoop P0 实施计划 v2.0 + 本轮契约回修

你是严苛的交付计划评审员。VoiceLoop(`~/WorkSpace/voice-coding/`)设计文档已成体系,现有一份重构后的 P0 实施计划 v2.0,请完整 review,写中文报告。

## 背景

计划 v2.0 是对 v1 的重构,吸收了 4 个 subagent + 你(Codex 07)的评审:① Gate 0 六项前移到各 Phase 关闭(不再堆末尾);② **P0 收敛为 Tier 1 全闭环 + Gate 0 最小关闭(约 15–18 工程日),Hopper 桥/直达验收档/Demo 降为 P0.5**——目的是绕开 `docs/09 §14` 未封闭、依赖 Hopper 裁决的跨域契约;③ 新增 Phase -1 环境/决策前置;④ 修依赖图;⑤ 补 D4/D5 spike;⑥ 拆步骤;⑦ 实施期轻量评审。同时 09 升 v1.1(分层成熟度:标 [P0-Tier1 就绪] / [P0.5 前置·待封闭] / [P1/P2]),10 升 v1.1,均按你 07 报告回修了可复现的 SQLite/TOML 语法错误、补了工具契约 §13、把你列的 A 级作为 §14 P0.5 前置清单。

## 待评审

- `IMPLEMENTATION-PLAN.md`(v2.0,核心)
- `docs/09-data-contracts.md`(v1.1;重点看:§0.1 生成-校验矩阵、§9 DDL 是否真可执行、§11 TOML、§13 工具契约、§14 P0.5 清单是否完整涵盖你 07 的 A 级)
- `docs/10-voice-ux-spec.md`(v1.1;§3 barge-in void、§5 摘要 union、话术 #38/#39)
- `docs/adr/ADR-001`(附注:交付顺序 P0/P0.5)

## 对照

- 你自己的 `research/codex-findings/07-contracts-review.md`(逐项核对:哪些 A 级被"真正关闭"、哪些被"诚实推迟到 P0.5 并标注"、哪些仍遗漏)
- `docs/05-roadmap.md`(P0/Gate0)、`docs/08`(22 模块)、`research/codex-findings/02-hopper-integration.md`(Hopper 现状)
- 本机 `~/WorkSpace/Hopper/`(只读,如需核对 §14-A4 的真实状态枚举)

## 评审焦点

1. **P0/P0.5 切分是否真的绕开了 No-Go**:把 Hopper/直达验收推到 P0.5 后,P0(Tier1)所依赖的 09 子集是否**自足且已闭合**?有没有 P0 步骤偷偷依赖了 §14 里未封闭的东西(如 4.2 收据、3.4 收据矩阵是否牵扯 presentation/跨域)?
2. **Gate 0 前移是否到位**:六项分散表 + "无 bypass 铁律" + 7.3→5.3 复核,是否消除了你 07 判定"最危险"的时序倒挂?G1/G4/G5 的落点(1.x/4.1/3.4)现实吗?
3. **09 v1.1 可执行性**:DDL 现在能否 sqlite3 直接跑(我已本地验过,请你复核)、TOML 能否解析、§13 工具契约够不够实施者照写、§14 是否覆盖了你 07 的全部 A 级(A2/A3/A4/A6/A7/A8)且分层诚实(没有把 P0.5 的东西又混回 P0)?
4. **依赖图/估时**:修正后的图还有断裂吗?15–18 天对 Tier1 P0 现实吗(哪些步仍低估)?
5. **回归**:本轮回修有没有引入新矛盾;06/07 的 A 级在当前全套文件里的最终状态(逐条给 关闭/P0.5 诚实推迟/仍遗漏)。
6. **可开工性**:一个新会话拿 Phase -1 + Phase 0 能否直接动手?还剩哪些首日硬卡?

## 输出

写入 `~/WorkSpace/voice-coding/research/codex-findings/08-plan-review.md`(中文):① 总评(P0 计划是否达到"可交新会话实施"标准;P0.5 前置清单是否完备);② A/B/C 问题清单(位置+改法);③ 06/07 A 级最终状态表(关闭/P0.5 推迟/遗漏);④ 首日硬卡剩余清单;⑤ 一句话:能不能把实施 prompt 发出去开工。区分【事实】/【judgement】,不改任何文件。