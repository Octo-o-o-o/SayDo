# 19 · IMPLEMENTATION-PLAN-2 对抗性评审

**结论：v1.0 不能直接开工，也不能据此宣称“第一期全量清偿”；至少有 9 项 A 级硬伤，另有一批明确的 P1/触发项没有可追踪的工作流与验收。**

## A 级（硬伤必修）

### A-1 · W5.6 把已完成的 presentation 当成 A6 待办，且漏掉真正的 A6 债务

- `IMPLEMENTATION-PLAN-2.md:59` 把“digest+nonce/heard/invalidated/parentReceiptId/per-subject CAS”称为“A6 presentation 完整形态”，并引用 `09 §14-A6`。
- `docs/09-data-contracts.md:850,855,857` 明确：完整 presentation 是 **A2/A8**；A6 是 hard-forget，P0 形态已经闭合，剩下的 P1 只有独立 deletion job/progress。`docs/modules/b-memory.md:23` 也如此标定。
- `IMPLEMENTATION-PLAN.md:133,137` 已把 A2/A8 的完整形态列入 P0.5-A，A6 完整形态降为 P1；SayDo 的 `e2e/evidence/p05.md:1-25,37-46` 和 `HANDOFF.md:21,52` 证明这批 presentation/人工合并链已收口。

**修法：**删除 W5.6 的 presentation 实施项；若 owner 的“全量”确实包含 A6 P1，则另列 deletion job/progress 的表/进度、备份保留期、崩溃重放与验收反例（`docs/09-data-contracts.md:853`），不能只改标题。否则必须记录 owner 明确的排除决策。

### A-2 · S3 merge 把执行域 ownership 和保守缺省改掉了

- `IMPLEMENTATION-PLAN-2.md:43,48` 在 R-A 中预设“Tier1 卡授权后 daemon 本地合并，替代 `requestManualMerge`”，并在 W4 把人工链降为降级路径。
- `docs/08-module-design.md:153-161` 的跨域所有权是 Hopper 持有执行状态、worktree 和 merge，SayDo 只通过官方写入口发起；`docs/09-data-contracts.md:321-325,799-805` 当前契约是 `requestManualMerge + MergeProof` watcher，必须核对 `prospectiveTreeSha`/树证明后才进入 `task_done`。
- 首发事实也不是本地自动合并：`SayDo/e2e/evidence/p05.md:39-46` 明写 S3 人工合并交接且“不自动调 hopper merge”，`SayDo/HANDOFF.md:52` 更把它列为铁律。

**修法：**R-A 只能列方案和 owner/安全裁决门，不能把 daemon-local merge 写成既定语义。默认保持 `requestManualMerge + MergeProof`（或 Hopper 官方 `merge` 写入口）；若 owner 要 Tier1 本地合并，先改 ADR-001、08、09 §6/§13 的 ownership/状态机，再补认证强度与 receipt 绑定、approved/prospective tree SHA、protected branch、冲突/回滚、审计和契约测试。S3 卡落 09/10 前不得解禁任何自动 merge 路径。

### A-3 · W2 的“前置=无”跳过了已写死的系统门和 D2 未决 spike

- `IMPLEMENTATION-PLAN-2.md:35-37,95-103` 把 W2 标成无前置，并称可与合同轮同周自然并行。
- 交接 Prompt 的红线是：Tailscale 装机、tailnet 主机名、launchd plist 均为 owner 检查点，OctoDesk 首次奠基前要知会 owner，且无回复要暂停分支（`IMPL-PROMPT-5-PULLFORWARD.md:31,38-42,53-55`）。
- W2-D 直接排 VAD/EOU/AEC，但 `docs/07-tech-stack-decisions.md:20,57-63` 和 `docs/modules/a-dialogue.md:14` 仍把 D2（Pipecat watermark vs LiveKit）标为待 spike；该 spike 的结果会改变语音进程选型和“unheard 不进事实”的实现边界。

**修法：**把 W2 拆成 A/B/C/D 的实际门控：A/B/C 先列 owner hold point，D 先完成 D2/ADR-102 spike 再决定落在哪条管线；“前置=无”改成“可并行准备，门未过不得安装/真仓执行/切换框架”。R-A 与 W2 的并行只限不触碰合同的准备工作。

### A-4 · `network_fetch` 被写成通用预授权通道，直接撞 Gate 0 红线

- `IMPLEMENTATION-PLAN-2.md:80-83` 把 `network_fetch` 放在 W8 实施中，并写成“research/writing 证据采集的预授权通道”。
- `docs/05-roadmap.md:67-70` 对 cursor egress 的事实声明是 `uncontrolled`，明确禁止 `network_fetch` 类预授权；`docs/09-data-contracts.md:105-127` 的 P0 EffectGrant 只有 install/push，且 Hopper route 的 `preauthorizedEffects` 必须为空。
- `docs/09-data-contracts.md:3-7` 也把 network_fetch 标为 P1/P2 reserved，不是已有可照抄的通道。

**修法：**按 adapter 分开定义能力：Hopper/cursor uncontrolled 路径不得预授权或假装有 SSRF 防护；Tier1 若要做，只能在有运行时 grant、来源白名单、DNS rebinding/SSRF 防护、快照/quote/证据留痕、egress/risk 升级和 fail-closed 反例的合同之后启用。将网络合同从“一个 R-C 通行证”拆成独立设计门。

### A-5 · R-C/W8 把 P3 的 planning 执行器纳入一期

- `IMPLEMENTATION-PLAN-2.md:82` 明列 `research/marketing/general/planning` 四执行器；`IMPLEMENTATION-PLAN-2.md:107-110` 的显式边界却没有排除 planning。
- canonical P2 类型清单是 `research/writing/marketing/general`（`docs/05-roadmap.md:114-120`）；planning 的“采访→文档体系→协同审阅→批准→批量派单”完整流程在 `docs/05-roadmap.md:122-125` 明确属于 P3，`docs/02-product-definition.md:110-125` 仍没有可照抄的实施合同。

**修法：**W8 改为四个 P2 类型 `research/writing/marketing/general`；planning 保留 P3/owner-triggered discovery。若 owner 要把 planning 提前，必须先立范围、交互、状态和审批合同，再另开设计轮，不能用 R-C 的泛名义吞入。

### A-6 · 电话项同时发生层级错称、能力越界和工期失真

- `IMPLEMENTATION-PLAN-2.md:68,72-74` 把电话排为 W7 “升级链 L3”，写成 Realtime SIP 呼入 + “DTMF 确认收据”，但没有写 DTMF 的禁止语义。
- `docs/04-key-mechanisms.md:124,153` 明确电话 DTMF 只能 `ack/snooze/拒绝`，不能批准任何副作用；`docs/09-data-contracts.md:377-390` 只定义电话为 escalation level 2。`docs/07-tech-stack-decisions.md:137-141,252-258` 又把 APNs/FCM 直连列 P1、SIP 呼入列 P2，Plan2 没有解释这两个阶段口径的冲突。
- 已锁定的电话实施件不是 6–10 天小批：`research/phone-call-impl-plan-2026-07.md:1-18` 要求 dogfood 触发后再解锁、四道前置门，`9-14,43-60` 给出 40–55 工程日、Apple/iPhone/Tailscale/DERP/真机与 Phase 0 spike。

**修法：**先把 W7.2 拆成“L2 回叫状态机/DTMF ack-snooze-reject 回执”（无 approve/dispatch/merge）和未来 SIP V3；SIP 必须挂研究计划的触发、Gate 0、Apple/真机/网络 owner gates，并按 40–55 日重估。不要用“确认收据”这一含混词给实现留下批准解释。

### A-7 · 总工期在算术上不成立

- `IMPLEMENTATION-PLAN-2.md:114` 宣称所有 W1–W8 工程总量只有 31–51 人日、约 6–10 周，同时把 W7 电话（6–10 天）和 W8 的类型执行器、writing full、网络、T3、移动/菜单栏/app-server 等全部算入。
- 仅锁定电话计划的串行工作量就是 40–55 工程日（`research/phone-call-impl-plan-2026-07.md:9-14`），还不含 owner 场次、Apple 分发等待和安全回修；W8 的 scope 又覆盖 `docs/05-roadmap.md:114-120` 的多项 P2。

**修法：**按每个能力拆工程日、合同/评审日、owner 等待和外部审核日，给出关键路径与可并行区间；电话不能同时既算进总量又只给 6–10 天。没有重估前，去掉“6–10 周全部完成”的承诺。

### A-8 · W9 把两套互不替代的数据资产合并，导致“全量”验收可被假满足

- `IMPLEMENTATION-PLAN-2.md:87` 写 replay corpus 与 W7.6 共用 300–500 条。
- `docs/07-tech-stack-decisions.md:69,246` 的 300–500 是 ASR provider 切换用的真实 golden；`docs/05-roadmap.md:137` 的 E1/E2 是另一套 ≥200 条分层 readiness/safety replay corpus，另含三臂 intake 消融、外部 3–5 用户行为轨、预注册非劣检验和盲评，触发条件也不同。

**修法：**拆成两套有独立 schema/去重/分层和 evidence 的资产：ASR golden 只服务 7.6；readiness/safety corpus 服务 false-ready 与 E1/E2。W9 必须记录第二用户/对外发布触发、实验 protocol、盲评和 owner gate；若触发条件未到，标为待触发而不是“全量已收”。

### A-9 · writing 窄版合同把“无 merging”与“worktree+合并”并列为可选实现

- `IMPLEMENTATION-PLAN-2.md:44,48` 一方面写非 coding `ready_for_review→approve→task_done` “无 merging”，另一方面又要求 R-A 在 worktree+合并和托管直写之间择一。
- `docs/04-key-mechanisms.md:195` 是非 coding 无 merging、以内容评审收尾；`docs/02-product-definition.md:88,96` 要求逐节停靠和对外发表的 S3 屏幕门；`docs/05-roadmap.md:118` 明说 writing 的非 coding 收尾、`explainResult`、settle proof 尚待合同。
- 研究审查已指出当前缺 `WritingSettleProof`、section checkpoint、结果联合和 citation/attribution 层（`research/codex-findings/18-writing-flow-review.md:63-77,87-107`）。

**修法：**R-A 只定义 writing artifact 写入、section review、返工、settle 和对外发布边界；不得复用 coding 的 MergeProof，也不能把“合并”作为默认选项。若 git 仓现实确需 merge，先由 owner 改 canonical 的 non-coding ownership/状态机，再另行排产。

## B 级（应改）

### B-1 · 显式 P1/触发项没有逐项落到工作流和验收

下列不是“泛化一句”就能证明已收：

- **ACP 与 Cursor SDK**：Plan2:62 只把 Cursor SDK 写成可选，W8 的 Codex app-server 也不等于 ACP；`docs/07-tech-stack-decisions.md:116-119,188-190,239,257`、`docs/modules/e-crosscutting.md:13` 都把它们列为后续能力。
- **APNs/FCM 直连**：Plan2:73-74 只写 PushKit/CallKit，没有 D11 要求的 APNs/FCM JWT/OAuth、opaque payload、token digest 和投递表验收（`docs/07-tech-stack-decisions.md:137-146,252-258`、`docs/modules/d-presentation.md:18-23`）。
- **D9 检索 spike/决策**：Plan2:60 只写 sqlite-vec 可选；`docs/07-tech-stack-decisions.md:27,123-129,248,258` 和 `docs/modules/b-memory.md:44-50` 仍要求先做 trigram/分词/预分词的真实语料 spike，且 sqlite-vec 在 07 与 modules 的 P1/P2 标注不一致，不能静默选一边。
- **模块 P1**：rolling gist、Impact×Uncertainty 校准、A5 四维 executability/verifiability、A7 独立 IntentLedger（`docs/modules/a-dialogue.md:28,43,47-53,64-71`）；按模型档自适应 token budget、deletion job/progress、B3 持续深化（`docs/modules/b-memory.md:13,23,27-33`）；C8 成本表盘、E3 指标（`docs/modules/c-control-bridge.md:74-81`、`docs/modules/e-crosscutting.md:24-31`）。
- **移动/T3/长期执行**：Noise XX/WS 密文中继与跨设备 resume（`docs/07-tech-stack-decisions.md:150-152`）、VoiceProcessing/AEC 原生降级（`docs/07-tech-stack-decisions.md:143-147`）、M3d deadline/checkpoint workflow（`docs/04-key-mechanisms.md:191-194`）均未在 W7/W8 给出 bounded baseline 和验收。

**修法：**增加“canonical 条目→W 编号→合同/负责人→验收命令→证据路径→owner trigger/显式排除”的矩阵。可选或触发项不能计入“全部完成”，除非写明不计完成的 owner 决策。

### B-2 · W5.3 重复排了已完成的 Hopper bridge，并把 unsupported 能力写成“完整接入”

- `IMPLEMENTATION-PLAN-2.md:56` 把“Codex 经 Hopper 完整接入”与 Tier2 step loop 混成一项。
- 首发计划和证据已经证明 bridge/drop/scan/run/settle/review/人工合并链完成（`IMPLEMENTATION-PLAN.md:138-140`、`SayDo/e2e/evidence/p05.md:1-25,32-46`）；当前未完成的是 Hopper `step_confirm`，canonical 明确为首发 unsupported、P1 再评（`docs/04-key-mechanisms.md:177-181`、`docs/09-data-contracts.md:854`）。

**修法：**从待办删除“完整 Hopper 接入”，改成 capability handshake、Tier2 step-loop 的边界实验和 `queued_delta/cancel_resume` 验收；默认仍是 unsupported，不能因 W5 名称而承诺 Hopper 原生逐步循环。

### B-3 · W6 的新合同不能用“随批轻量评审”带过

- `IMPLEMENTATION-PLAN-2.md:64-66` 新增 shared blackboard 实体/并发预检、聚合 digest、任务拆分语义，却只写“合同增量随批轻量评审”。
- `IMPLEMENTATION-PLAN-2.md:110,116` 自己承认合同缺口要回设计库；`IMPLEMENTATION-PLAN.md:176` 要求任何 09/10 canonical 回写经过一致性 subagent + Codex，不能用普通 code review 代替。

**修法：**把 W6 的新实体/状态/权限/并发/聚合合同移入 R-C 或单独设计门；完成 canonical 回写和重制度评审后才解锁实施，不能先在 SayDo 自定语义。

### B-4 · 双仓并行没有交接锚，无法防长期漂移

- `IMPLEMENTATION-PLAN-2.md:103,115` 只有“不同仓天然并行”“独立 prompt + readback”，没有 canonical SHA、文件 manifest、合同版本、owner 决策和证据的交接格式。
- `SayDo/HANDOFF.md:7-8,15,52` 要求设计库为 canonical、每次写入/提交独立核实、契约不分叉；`IMPL-PROMPT-5-PULLFORWARD.md:43` 也要求 evidence/SHA/HANDOFF 回填。

**修法：**每批开始 pin 设计库 commit + 09/10 digest，交接时附“输入 SHA→改动文件→测试/证据 SHA→canonical 回写 SHA”；R-A/R-C 回写未核验前，W4/W8 分支保持 blocked。

### B-5 · 外部与 owner gate 被压成“解锁点”，且 W7 mobile review 越过未决取舍

- `IMPLEMENTATION-PLAN-2.md:100,120` 只列 Claude/OpenAI/server/billing 等粗粒度解锁，W2 的 launchd/Tailscale/真仓检查点和暂停缺省不在依赖图。
- `IMPL-PROMPT-5-PULLFORWARD.md:38-42,53-55` 明确这些动作必须停等 owner；`docs/05-roadmap.md:159` 仍把“手机 diff + 语音 resume”做多深列为 owner 决策，但 `IMPLEMENTATION-PLAN-2.md:74` 已把完整 mobile review 当成 W7 交付。

**修法：**把每个外部物件写成显式 gate（负责人、最晚时间、无回复动作、证据），W7 先做 transport/shell 基础；mobile review 深度等 owner 选择后再排产。

### B-6 · W5.5 的项目级模型覆盖没有写清安全承载

- `IMPLEMENTATION-PLAN-2.md:58` 写“项目级模型/预算覆盖（设置页）”，容易被实现成 project.toml。
- `docs/09-data-contracts.md:705-709,739-741` 明确仓库随附的 project.toml 禁止 `models/providers/gate0/hopper/privacy/voice`；`docs/02-product-definition.md:98-108` 的项目覆盖是产品设置语义，不是允许不可信仓库改 provider。

**修法：**把预算/模型意图明确落在 daemon settings/DB 的受控表，project.toml 只走白名单；补“项目文件出现禁键即拒启动”的正反例。

### B-7 · Console API/SSE 和菜单栏都缺真实依赖/范围门

- `IMPLEMENTATION-PLAN-2.md:61,83` 给 Hopper Console API/SSE、菜单栏分发固定排期。
- `docs/08-module-design.md:159-161` 与 `docs/adr/ADR-001-execution-layer.md:41,65` 说明 Console 只读 API/SSE 依赖 Hopper WS4 的 scope token；`docs/07-tech-stack-decisions.md:35,53,257-258` 只把菜单栏列为 P2 评估，不是已设计的菜单栏实现。

**修法：**Console 先做 token/WS4 spike 和只读 scope 验收；菜单栏改成 bounded evaluation，不能把“评估”当已承诺的产品分发。

### B-8 · 价值证据轨只收了子集，且缺“建议性不设闸”声明

- `IMPLEMENTATION-PLAN-2.md:31,87-90` 只列双北极星、返工/接通/自发选择和第二锚点。
- `docs/05-roadmap.md:127-137` 的既有 SQL 矩阵还包括 first-pass/package modification、readiness outcome、time-to-dispatch、成本、S2、误听、lane、review 检错仪式和 E1/E2 触发；并明确该轨“建议性、不阻塞”。

**修法：**补完整指标矩阵或明确本期 subset；在 W1/W9 验收中写死“只观察、不作 stop/go、不改变 canonical 北极星”。

### B-9 · 音频状态锚与实施仓真相仍冲突

- `IMPLEMENTATION-PLAN-2.md:15,33` 已把 3/5 音频和 owner 决策回填作为现状锚。
- 但实施仓 `SayDo/HANDOFF.md:32` 仍写“五条待 owner、合成语料替代”；详情只在 `IMPL-PROMPT-5-PULLFORWARD.md:49`，且要求实施会话再把 `audio-smoke-5.py` 收编。

**修法：**在 HANDOFF/evidence 先落真实命令、venv、文件 digest 和 3/5 输出，再更新 Plan2 锚；在此之前把 3/5 标为“已录但待 canonical 回写/复核”，不要同时称 pending 和已闭。

### B-10 · ADR-002 标签被两种决策混用，边界文字把“已批复的实施”误放进决策线

- `IMPLEMENTATION-PLAN-2.md:109` 把“产品载体 ADR-002”与 repo merge 一并称为非工程决策；但 `docs/05-roadmap.md:156` 的 ADR-002 是未来产品载体 ADR，而 `SayDo/HANDOFF.md:34,56` 的 ADR-002 是 observedModel 身份豁免条款，两个决策标签不能混用。后者已获 owner 批复，只因身份核验未实现而休眠。
- `IMPLEMENTATION-PLAN-2.md:57` 又正确地把 Claude/observedModel 核验排入 W5.4，前后口径不一致。

**修法：**区分仍开放的产品载体取舍和已批复、待工程实现的 ADR-002 条款；W5.4 的身份核验/审计落点不能被 §3 边界误删。

### B-11 · R-C 的 full writing 仍没有可判定出口

- `IMPLEMENTATION-PLAN-2.md:82-83` 只列 ArticleCitation、归属、parentProjectId 等名词，没有 `WritingSettleProof`、citation coverage、paper `WritingSpec`、迁移/回滚/fixture 和失败状态。
- `research/codex-findings/18-writing-flow-review.md:79-107` 已把 paper 就绪、Citation/Attribution、SQLite migration 和契约测试列为 P2 前置。

**修法：**R-C 产出必须逐项绑定 schema/validator/正反例/迁移策略/证据路径；没有这些出口的条目只能留在设计 backlog，不得算 W8 完成。

### B-12 · “持续项/owner 提供”没有 bounded baseline

- `IMPLEMENTATION-PLAN-2.md:83,120` 把 Hopper capability 演进、T3 owner server、多人旁听 owner trigger 放进 W8 总量，却没有最小交付、停止条件或“未完成不阻塞”的标记。
- canonical 只承诺 T3/P2 与多人 discovery（`docs/05-roadmap.md:119-120`），没有承诺随外部系统无限跟随。

**修法：**每项改成 bounded spike + owner gate + evidence；外部资源未到时保持 deferred，不把开放式维护任务计入“全量已完成”。

### B-13 · 执行器批明确登记的两项 P1 安全债没有被收进计划

- `IMPLEMENTATION-PLAN-2.md:30` 的 W1.4 只核实 setup/push hooks、精确 `--resume`、deep readiness 和 seedTerms；全文没有 verify config-file surface 或 HOME 凭据隔离的清偿项。
- `SayDo/e2e/evidence/executor-batch.md:54-58` 明确登记：框架 config（如 `vitest.config.ts`）仍在冻结面外，verify 进程仍保留 HOME、可触达 `~/.ssh` 等文件系统凭据；`tier1-conformance.md:28-46` 也把两项标为 warn/P1。

**修法：**在 W1 或治理批另列安全清偿：把可执行 config 输入纳入 dispatch 快照/冻结或保守拒绝，并用受控环境/最小 HOME/凭据挂载隔离 verify；正反例必须证明改 config 不能自证通过、verify 不能读取宿主凭据。精确 `--resume` 已由 W1.4 覆盖，不要与这两项混成一个“conformance 已在案”。

## C 级（可选）

- `IMPLEMENTATION-PLAN-2.md:60` 的 sqlite-vec 可选项应显式注明 07 与 modules 的 P1/P2 标注冲突，先收 D9 分词 spike 再决定是否加向量层（`docs/07-tech-stack-decisions.md:27,248,258`）。
- `IMPLEMENTATION-PLAN-2.md:37` 的 M1“生长闭环”可补一句“consolidation 只提名、人批准”，与 `IMPL-PROMPT-5-PULLFORWARD.md:32,40` 保持验收口径，避免被实现成自动 consolidation。
- `IMPLEMENTATION-PLAN-2.md:116` 的“每批 readback”可进一步规定固定证据模板（输入 SHA、命令、尾行、产物 digest）；这是降低漂移的改进，不替代 B-4 的交接门。

## 免修确认清单（已核过、当前没有问题）

- **Tier1 执行器批与接线批确实已完成**：Plan2 的 `HEAD 602aa09` 与 `git -C ~/WorkSpace/SayDo log` 一致；`SayDo/e2e/evidence/executor-batch.md:9-25`、`HANDOFF.md:23,39` 证明 66 contracts/451 daemon、认领→真 cursor-agent→S2→settle→人工合并链已落地。Plan2 将其作为现状锚；W1.4/W5.3 仍需按下方 W1.4 免修项和 B-2 拆成“已完成能力 + 尚欠增量”，不能重复收口。
- **W1.3 仍是未完成项而非误列**：`HANDOFF.md:38` 的 Codex 14 #8-②确实要求 dogfood 第一周做 project-level config production load，Plan2:29 的独立 project schema/白名单反例方向正确。
- **W1.4 已列的三个差距引用属实**：`executor-batch.md:59-63` 明确 `--resume` 精确恢复、live deep readiness 和 seedTerms 仍有 warn；Plan2:30 以“核实/缺则补”表达，没有把这三项虚报为已完成。该证据前两条安全债未被 W1.4 收入，已单列 B-13。
- **提前批四项的范围与红线基本一致**：launchd、T2 薄版、M1、VAD/EOU/AEC 对应 `docs/05-roadmap.md:97-102` 和 `IMPL-PROMPT-5-PULLFORWARD.md:38-42`；T2 手机浏览器不放行 S3、PTT 保留、consolidation 人工批准等边界也有出处。
- **P3 的三项显式排除方向正确**：Plan2:107 排除多人旁听产品化、场景 2 协同 UI、非技术用户模式，与 `docs/05-roadmap.md:122-125` 对齐；本报告 A-5 只针对被错误加入的 planning executor。
- **W7.4/W7.5/W7.6/W7.7 的能力方向有 canonical 依据**：S2S 仅呈现层、MLX/唤醒词、第二 ASR 依赖 OpenAI key 与真实 golden、说话人标签按所选 ASR 条件启用，分别可追到 `docs/07-tech-stack-decisions.md:68-69,83-86`、`docs/05-roadmap.md:67,116-120`；问题在依赖/工期/数据资产，而不是这些方向本身。
- **S3 语音禁放行、Gate 0、TTS redactor、契约不分叉等铁律被 Plan2 明文继承**：`IMPLEMENTATION-PLAN-2.md:5,110,115` 与 `HANDOFF.md:52` 一致；A-2/A-9 指出的是具体实施语义不能越过这些铁律。
- **Claude/OpenAI/billing 的外部解锁事实没有被编造**：`IMPLEMENTATION-PLAN-2.md:17,100` 与 `HANDOFF.md:35-37`、`IMPL-PROMPT-5-PULLFORWARD.md:47-49` 相符；应补的是 owner gate 的形式化，而不是改写这些现状。

> 评审证据说明：本轮尝试按项目纪律启动独立 `codex exec -m gpt-5.6-sol -c model_reasoning_effort=max`，但当前受限环境在 app-server IPC/网络连接处返回 `Operation not permitted`，未产出独立 Codex 结论。以上报告只采用本会话实际读取的文件、SayDo evidence 和互补审查回报，未把失败运行当作评审证据。
