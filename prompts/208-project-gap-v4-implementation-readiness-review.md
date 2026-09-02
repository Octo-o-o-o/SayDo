# SayDo 项目缺口治理 v4 最终对抗评审

你是独立、零上下文、只读的实施就绪性与范围克制评审者。仓库为当前工作目录。不要修改文件，
不要运行产品测试、构建、真实账号、设备、connector 或部署；允许只读检索与静态文档门查询。

## 必读

1. `AGENTS.md`
2. `docs/plan/2026-08-28-project-gap-closure-program.md`，重点第 10、11、14.6–14.8、20 节
3. `docs/plan/2026-08-28-project-gap-owner-decisions.md`
4. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`
5. `docs/plan/IMPLEMENTATION-PLAN-2.md` 的文首、ai-supply、§6、§7
6. `HANDOFF.md` 的开工先读与最新 active pointer
7. `docs/plan/2026-08-24-ai-supply-owner-decisions.md` 的已签状态与决策 2/4/5/7

## 目标

owner 要的是“标准完整的对应，同时零过度设计、零过度实施”。v4 声称只让 D17 导入
PG-01A–PG-06 七个 A 级 core 批；B/C、voice、live probe、retention、全量 API、下一 RC、
connector、产品扩圈均为条件包。D17 只授权 PG-00 文档事务，不授权代码、commit、push、deploy、
外部调用或数据删除。

请对当前磁盘字节做对抗评审，不能沿用历史 v1–v3 的结论。重点判断：

1. D17 是否真能一次签署并绑定 exact import spec，还是仍需第二次战略确认；输入漂移是否 fail-closed。
2. import spec 是否逐项、唯一处置 PLAN-2/HANDOFF 的 ai-supply、W5.4-c、R-B、A5/UI、W6–W8、
   app-server 与“缺省全做”，导入后是否只剩一个 next batch。
3. PG-01A–PG-06 是否有无循环的依赖、稳定 gate/receipt bootstrap、可判定的 scope/gate/evidence/
   rollback/非目标，足以在开批时生成独立 IMPL prompt。
4. G-A1–G-A9 是否都有且只有一个 core owner；fail-closed 收紧是否不会被 D1–D19 或 AI 未签决策卡死。
5. 条件包是否真的不进入 D17 denominator；Q1/Q2、12/24/48、AI 45k 草案、API、voice、live、
   history/retention、release/distribution 是否仍存在暗含的“默认全做”。
6. `repo_closed` 与 `deployed_closed`、本地 `just ci` 与 Playwright/托管 CI/跨平台/live/release 的
   证据边界是否不会导致假绿。
7. 方案是否还缺 owner 必须现在提供的信息；若无，请明确“当前只需 D17”。

说明：`PENDING_FINAL_REVIEW` digest 是刻意安排在本次内容评审、journal 记录之后执行的最后机械步骤。
可以把“必须回填且复核”列为 finalization prerequisite，但不要仅因占位符本身判内容设计 A；若
digest 绑定对象或防漂移机制本身不成立，则仍按 A 报告。

## 输出

先给 `[pass]` 或 `[fail]`，再按 A/B/C 列 findings。每条必须包含：

- 稳定 ID；
- 真实 `file:line` 证据；
- 失败场景/为什么阻塞实施或造成过度；
- 最小修法；
- disposition 建议：必须回修 / 条件登记 / 可接受。

A = 会导致越权开工、双排产、数据/安全/合同/evidence 假绿、循环依赖或无法验收；B = 会使批次
边界/成本/用户结果显著不清；C = 可读性或后续维护建议。不要把“尚未实施/尚未运行测试”本身算
finding，因为文档已明确是 implementation-ready candidate；只审其能否安全进入 D17。

最后给：

1. `D17_READY=yes/no`；
2. 当前 owner 必须现在提供的 exact-set；
3. 若回修后可签，一句话的最小签署文本；
4. 你实际读取/运行的只读命令清单，未运行项如实说明。
