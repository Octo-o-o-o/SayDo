# Codex 攒批评审 16:接线增量批 canonical 回写复核(2026-07-25)

你是本项目评审制度中的独立 Codex 复核(第 3 路;生成方不能自评)。**只读**,不改任何文件。

## 背景

SayDo 接线增量批(HANDOFF §2-9 六项)已完成实现(SayDo 仓 main,提交 4e97ae1 + 5769ae9),
随批 canonical 回写两处,请逐条对抗性复核:

1. `voice-coding/docs/09-data-contracts.md` §10:PipelineMsg 词表补录两条工程 additive 扩展
   (`latency.stage`,`asr.hotwords`)——复核:(a) 与实现(SayDo `packages/contracts/src/types/pipeline.ts`、
   `packages/daemon/src/voice/hub.ts`、`pipeline/src/saydo_pipeline/hub_client.py`)形状一致;
   (b) 与 09 其余章节(§5 topicTerms/§13/§12)无冲突;(c) 补录措辞是否诚实(工程先行、canonical 补录的时序如实)。
2. `SayDo/docs/adr/ADR-002-byoa-observed-model.md` 文末附则——复核:与 09 §11 规则 2(SoT)逐句一致性;
   附则四条(封闭枚举/身份核验前提/exempted 审计标记/豁免休眠)有无漏项或语义漂移;
   "本批不实现身份核验链"的声明与 Codex 15 Q2 裁决一致性。

## 顺带实现-合同一致性抽查(A 级找茬视角)

3. 09 §6.1 `failed → queued (U)` 新边:SayDo `packages/contracts/src/statemachines/task.ts` 的实现与边注
   (证据不串线/重过派发前置/离开 failed 冻结 trigger=failed 回叫)是否被 `packages/daemon/src/tier1/operations.ts`
   retryTask 完整兑现;有无绕 `canTransitionTask` 的残留路径。
4. 09 §13 reviewTask:实现把 approve 的 evidenceDigest 改为"settle proof 库内自取、拒外部注入"
   (operations.ts)——这是合同收紧还是偏离?§13 原文语义("approve→绑 evidenceDigest 落 audit_log")
   是否被保持?
5. 10 §2.5 确认词表环:SayDo `packages/daemon/src/live/confirm.ts` + `live/dialog.ts` 的裁决轮设计
   (pending 时 asr.final 不进 Brain、unmatched 复读/二次转屏、barge-in 作废重播)与 10 §2.5/§3 的
   匹配细则是否一字不差;有无误放行路径。
6. transitionTask CAS + parked 字段进出(`storage/dao/tasks.ts`)与 09 §6.1 T 边/TaskCard.parkedAt 语义一致性;
   `live/scheduler.ts` 的 30s/72h 两级调度与 04 §5.4/09 §6.1 的边表触发者(T)一致性。

## 输出要求

- 逐条编号裁决:A 级硬伤(安全/契约/数据丢失)/ B 级应修 / C 级建议;每条给文件:行号证据与最小改法;
- 结尾给"事实前提核验表"(你实读了哪些文件、哪些结论来自推断);
- 全部结论必须来自实读代码/文档,不许臆测;读不到的如实标注。

仓库路径:设计库 `/Users/wangyixiao/WorkSpace/voice-coding`(canonical);实现仓 `/Users/wangyixiao/WorkSpace/SayDo`。
