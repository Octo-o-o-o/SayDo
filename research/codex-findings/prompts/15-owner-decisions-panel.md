# Codex 独立裁决:首发收口后的四件 owner 决策(对抗面板第 5 路)

你是 SayDo 项目的独立裁决评审(与 4 个并行 subagent 互为对抗面板,你不知道他们的结论)。项目 = 语音驱动的 AI 开发工作台(本地单用户,TS daemon + Python 语音管线 + SQLite)。首发工程侧已收口:P0 Tier1 全闭环 + P0.5(Hopper 桥/直达验收档/Demo),全量对账通过、双矩阵门禁绿。剩四件 owner 决策,请你**独立**给出最合适结论——你的独有职责是**实读代码验证各决策的事实前提**,不许只读文档。

## 必读材料(按序)

1. `/Users/wangyixiao/WorkSpace/SayDo/HANDOFF.md`(现状单一真相;§2 = 待决清单)
2. `/Users/wangyixiao/WorkSpace/SayDo/e2e/evidence/final-readback.md` + `closeout-verification.md`(交付判定口径)
3. `/Users/wangyixiao/WorkSpace/SayDo/e2e/owner-sessions/`(session-1..4 现场清单 + adr-002-review-brief.md)
4. `/Users/wangyixiao/WorkSpace/SayDo/docs/adr/ADR-002-byoa-observed-model.md`
5. `/Users/wangyixiao/WorkSpace/voice-coding/IMPLEMENTATION-PLAN.md`(场次定义/受控 dogfood gate/风险表)
6. `/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md` §6.1(任务状态机边表)+ §11 规则 2(observedModel 分档)
7. `/Users/wangyixiao/WorkSpace/voice-coding/research/codex-findings/14-canonical-writeback-closeout.md`(三件上浮的原始裁决 #2/#3b/横1)
8. `/Users/wangyixiao/WorkSpace/voice-coding/docs/05-roadmap.md`(dogfood 与价值证据轨)

## 必须实读代码验证的前提(逐项给 file:line 证据)

- `SayDo/packages/daemon/src/approvals/parkAging.ts`:库层老化逻辑就绪度;若场次② dogfood 前不接 30s/72h 调度,实际风险是什么(审批超时停靠的任务会怎样)。
- `SayDo/packages/daemon/src/tier1/operations.ts` 的 `retryTask`:绕状态机的具体行为;补 §6.1 failed→running 边 vs 改重派发流程,哪个与既有取消链/attempt 语义更自洽。
- `SayDo/packages/daemon/src/providers/byoa/consume.ts` 的 familyFixed 分档:恒定族豁免的实现面;"二进制锁族=零谎报面"的前提有多牢(比如 codex CLI 被换二进制/别名劫持时会怎样)。
- `session-1..4.md` 引用的命令与路径真伪抽查(owner 现场会不会卡在不存在的命令上)。

## 四个决策题(每题必须选边,不许两可)

**Q1 tag**:现在打 `v0.1.0-rc.1` 并推远端,还是场次④过后再打?还是"rc.1 现在打 + `v0.1.0` 场次④后打"两段式?考虑:rc 语义、evidence 锚定价值、"首发交付 = final-readback + 场次④"的判定口径、回退成本。
**Q2 ADR-002 条款去留**:09 §11 规则 2 的"codex_cli/claude_cli 恒定族 observedModel 缺失豁免"——保留(现状休眠)/删除(回归全严格,代价 = codex_cli 作 evaluator 永久不可用)/收窄改写(给出具体条款文本)?owner 曾表态"严格口径不放宽"(语境是 api),后又裁定 dev 用 cursor 两族使豁免休眠。
**Q3 三件上浮排期**:① 停靠老化调度接线 ② 项目层配置生产加载 ③ retryTask 状态机边——各给排期档(场次②前必做 / dogfood 期 / P1)+ 理由;③ 另给 canonical 处置方向(补边 vs 重派发)。
**Q4 场次编排与人工测试**:场次①(语音体感)②(受控 dogfood gate)③(P0 总验收)④(P0.5-D Hopper 全链)的最优编排(可否合并/顺序/时长/owner 前置准备);session sheets 可执行性缺口;"owner 第一次上手"的最短人工测试路径。

## 输出格式(严格)

每题:**结论一句(选边)** + 关键理由 ≤3 条(引用证据 file:line 或文档节)+ 最强反方立场一句(steelman)+ 置信度(高/中/低)。
末节 1:"跨题一致性检查"(四个结论组合起来有没有内在矛盾)。
末节 2:"事实前提核验表"(上列四项代码验证的结论,逐项 file:line)。
凡无法证实的断言标"未证实";读不到的文件列文件名。不要建议新增功能;不要重开已收口的工程决策。
