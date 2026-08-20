# VoiceLoop 全新文档集完整评审

> 评审日期：2026-07-22
> 评审范围：`README.md`、`docs/01`—`docs/06`、`research/README.md`、`history/README.md`、`archive/README.md`；对照 `history/voice-coding-framework.Cursor2.md` v1.14、`history/scenarios/` 全部需求基线，以及任务指定的 `research/` 调研报告。
> 证据口径：下文【事实】均来自本次实际读取的本地文件或本次实际执行的只读检查；【judgement】是评审判断，不冒充实现事实或 owner 决策。行号按本次评审时工作区文件计。
> 范围异常：本次读取时，`README.md:22` 已把 `docs/07-tech-stack-decisions.md` 加入“正式文档”，但用户给定的待评审清单只到 `docs/06`。本报告仅检查了 07 的存在性及它与 03 的直接选型关系，没有把 07 纳入逐段完整评审；详见 B-13。

## ① 总评

【judgement】这次重写在“把逐轮演进稿变成可顺序阅读的正式文档”这一目标上完成度较高：01→02→03→04→05→06 的主叙事顺畅，三场景、三横切设计和“对话优先于指令”的设计哲学大体都已进入 canonical 文档；v1.14 最容易丢失的三项事实纠正——L3 必须强认证、隔夜交付必须是两层 workflow、Codex app-server 已支持 steer 但 Hopper 当前运行时未必接入——也都保留了。可是文档尚未达到“可交人工验证”的冻结标准：Hopper 成熟度、`review`/`done`、浏览器 AEC、S2S 成本、P0 记忆范围和安全门禁仍有事实错误或自相矛盾，且 Decision Package、跨边界合同与 PoC settle barrier 缺少可实施定义。当前更适合作为下一轮修订的高质量底稿，不适合作为工程开工或人工验收的唯一真相源。

### 六个评审维度的结论

| 维度 | 结论 | 核心依据 |
|---|---|---|
| 1. 完整性 | **未通过** | v1.14 的主干大多保留，但 Codex 01–04 中已升为 P0 的控制平面合同、canonical intent、PoC 8 条验收、effect-based 风险、review evidence surface 等未进入可执行正文；详见 A-02、A-07、A-08 与遗漏表。 |
| 2. 正确性 | **未通过** | Hopper schema/runtime 混淆、浏览器 AEC“工业级”、S2S 固定 5–6 倍、Brain“无状态”均与后出的对照报告冲突；详见 A-01、A-05、A-06、A-09。 |
| 3. 内部一致性 | **未通过** | `review` 与 `done`、P0 记忆分期、“设计定稿”与路线待拍板、会议模式 P2+/P3 均有冲突；但本地 Markdown 链接检查通过。 |
| 4. 逻辑清晰度 | **有条件通过** | 01→06 的认知顺序合理，愿景—产品—架构—机制—路线—证据层次清楚；问题是若干关键前提直到 05 §6 才以“未决事项”出现，晚于 01/README 的确定性承诺。 |
| 5. 简洁与可读性 | **基本通过** | 相比 v1.14 明显去除了大部分轮次日志和修订过程；仍有 `M3b/M3d/WS4`、双套 L0–L3、`done` 等对新读者不自解释的黑话/歧义。 |
| 6. AI 可读性 | **未通过冻结门槛** | 标题、表格、章节粒度适合检索，但缺 canonical 状态词典、合同 schema、事实/建议/决策状态标签和稳定来源锚点；AI 很容易把 schema-only、候选选型或 owner 未决事项读成现行能力。 |

### 已核验的正面结论

- 【事实】v1.14 §4.7 的 L3 强认证纠正已进入 `README.md:36`、`docs/04:109-124` 和 `docs/05:65`；新文档没有复活“复述短语可授权 L3”的旧错。
- 【事实】v1.14 §4.8 的“单 attempt 45 分钟 + 上层 deadline workflow + delivery preflight”已进入 `docs/04:134-138`，并明确 Hopper M3d 未实现。
- 【事实】v1.14 §4.9 的 Codex steer 事实纠正及“官方能力不等于 Hopper 已接入”的降级条件已进入 `docs/03:100-113` 和 `docs/05:95`。
- 【事实】v1.14 §17 的相关错误链、四维 readiness、两把钥匙、记忆投毒、唯一所有权和窄 PoC 均至少有正文落点，主要位于 `docs/03:39`、`docs/04:34-81`、`docs/05:41-51`。
- 【事实】本次对上述 10 个待评审 Markdown 文件执行本地链接解析，结果为 `LOCAL_LINKS_OK 10 files`；`archive/2026-07-22-pre-rewrite/` 实际文件数为 46，与 `archive/README.md:6` 一致。未发现失效的本地 Markdown 相对链接，裸章节号抽查也均指向存在的章节。

---

## ② 问题清单

## A 硬伤

### A-01 Hopper 的 schema 被重新写成“现成可运行能力”

- **位置**：`docs/03-architecture.md:26-30,52`；`docs/05-roadmap.md:7,23-25`。
- 【事实】03 架构图把 `DecisionRequest 审批 / NotificationIntent 通知`列为 Hopper 执行面的现成组成，05 §1 又称包括“审批物化、回叫管线”在内的全部下游能力已有“可运行、测试全绿的现成实现”，并把两种 schema 写进“代码级复用”清单。
- 【事实】对照材料结论相反：v1.14 §17.5（`history/voice-coding-framework.Cursor2.md:1090-1092`）、Codex 01 §2.1（`research/codex-findings/01-architecture-redteam.md:76-82`）和 Codex 02 §1.4/§6.2（`research/codex-findings/02-hopper-integration.md:84-89,454-465`）均明确：`DecisionRequest`、`NotificationIntent`、Command/workflow 目前是 schema-only，没有相应 runtime consumer/transport；可直接复用的是当前 coding task 流水线，不是平台控制面。
- 【judgement】这是本套文档最严重的事实回潮，会直接把 M3b/M3c/M3d/WS4 的工作量漏出排期，并让工程师错误地把“薄胶水”估成字段映射。
- **修改建议**：把 03/05 统一改成 current/future 能力矩阵：当前可用列出 drop、batch runner、worktree、event log、gates、review/merge、现有 usage；schema-only 单列 Decision/Command/Notification/workflow。把“薄缝合层”改名为显式 `Control Plane Bridge`，列明 command service、cursor/replay、outbox/inbox、approval receipt、transport、reconciliation 与 contract CI。

### A-02 `review`、`ready_for_review` 与 `done` 再次混用，PoC 仍可能提前回叫

- **位置**：`README.md:3,6,36`；`docs/01-vision-and-problem.md:49-51`；`docs/02-product-definition.md:19,34-35`；`docs/03-architecture.md:23`；`docs/04-key-mechanisms.md:93-101,140,144`；`docs/05-roadmap.md:45-51`。
- 【事实】05 §3 正确写明 Hopper `review ≠ done`，只有 merge 后才是 `done`；04 §6 也定义 `review → merging → done`。但 04 §4 的回叫优先级和 §7 的摘要生成仍使用未限定的 `done`，README/01/02 多次在“等待人验收/尚有决策”的阶段口播“做完了/完成”，03 架构图又写成“消费执行事件→摘要→回叫”，05 的 PoC 图写“消费完成事件”。
- 【事实】Codex 02 §3.1–§3.3（`research/codex-findings/02-hopper-integration.md:193-235`）明确：`RunnerFinished` 早于 post-run gates，`DocsAlignmentChecked` 后仍有 artifact/projection 落盘竞态；事件只能触发 reconciliation，bridge 必须等待 summary、runner result/final snapshot 可读并确认投影为 `review`。其 §7.6 第 3–5 条（同文件 `:625-634`）专门覆盖 verification fail、settle 延迟与 gap/corrupt line。
- 【judgement】这不是文案小瑕疵，而是会造成 false-complete 的状态机硬伤；未来 AI 也会从高频自然语言“完成”推断可以合并或停止监督。
- **修改建议**：全套只保留三个不重叠术语：`run.completed`（runner 退出，不对用户播完成）、`ready_for_review`（闸门和 artifacts settle，允许回叫“等待验收”）、`task.done`（合并/归档后）。把 03/05 的“事件→回叫”改成“候选事件→state/artifact reconciliation→settle barrier→durable callback outbox→回叫”，并把 Codex 02 的 8 条 PoC 验收完整纳入 05 §3。

### A-03 P0 记忆承诺与路线分期直接冲突

- **位置**：`docs/04-key-mechanisms.md:28-43`；`docs/03-architecture.md:117-134`；`docs/05-roadmap.md:57-81`。
- 【事实】04 §1.3 明写“P0 起即用可重放的 append-only 记忆事件账本”，§1.4 又把 provenance/taint/删除传播升为 P0 安全项；但 05 的 P0 只有“轻量只读 Context 预研器”，P1 才做 L1 奠基和生长闭环，P2 才做“记忆生命周期治理完整版（账本/审计/consolidation）”。03 数据模型也没有 `memory_event/current_projection`。
- 【事实】v1.14 §17.4/§17.8（`history/voice-coding-framework.Cursor2.md:1086-1088,1110`）与 Codex 03 §2.3（`research/codex-findings/03-voice-memory-tech.md:463-524`）都把 append-only event/current projection、provenance 和真删除定义为可信记忆的基础，不是 P2 装饰。
- 【judgement】三份正式文档给出了三个不同实现阶段，工程师无法判断 P0 到底是“无持久记忆的只读预研”、最小可信记忆，还是完整 L0–L3。
- **修改建议**：二选一并全套统一。推荐 P0 做最小可信集：immutable transcript/evidence、versioned candidate artifacts、只收用户批准决定/机械 repo facts 的 L1、用户显式 opt-in 的低敏 L0、append-only ledger/current projection、source-bound Context Pack、delete/export/restore 测试；consolidation 自动化和丰富召回可留 P1/P2。05 应逐项列入 P0，03 补对应 schema/owner。

### A-04 风险分级仍按动作名放行，且电话“批准”与只读约束冲突

- **位置**：`docs/04-key-mechanisms.md:101,107-130`；`docs/03-architecture.md:89`；`docs/05-roadmap.md:65,94,107`。
- 【事实】04 §5.1 把“读代码/只读命令”固定为自动 L0，把“装依赖、push feature 分支”固定为可语音批准的 L2；电话 DTMF 又写“0=批”。同一文档 §5.2 却说手机/电话默认只读，远程下发指令需 PIN 或推送确认。05 §6 已承认 secret/egress/供应链隔离是 P0 缺口，但 P0 清单没有相应控制。
- 【事实】Codex 01 §4.3（`research/codex-findings/01-architecture-redteam.md:238-268`）已纠正这一模型：读操作可能触及 `.env`/客户数据/密钥，安装可能执行恶意 postinstall，feature push 可能触发 CI/预览部署/泄密；风险应由 `effect × target × data × identity × credential/trigger/cost` 计算，并在执行点复验一次性 receipt。口述 PIN 也不应当作强认证。
- 【judgement】当前表格会让未来实现按动词硬编码，复活 v1.14 之后已经识别的安全缺口；DTMF 的“批”没有绑定风险级、payload、身份和 revision，尤其危险。
- **修改建议**：将风险层改名 S0–S3，并以 effect policy 计算，不再用动作例子决定等级；安装、读敏感数据、push/CI 均可动态升级。DTMF 只允许 `ack/snooze/reject`，不做 effect approval；远程批准必须返回 digest-bound、single-use、带 auth strength 的 receipt，S3/L3 仍只走已登录 UI + OS/passkey。明确普通通知 ACK 不等于问题 resolved 或动作 authorized。

### A-05 浏览器 AEC 被错误提升为“工业级”

- **位置**：`docs/03-architecture.md:68-75`；`docs/06-references.md:28`。
- 【事实】03 §3 和 06 §2 都称 `getUserMedia({echoCancellation:true})` 提供“工业级 AEC”。
- 【事实】Codex 03 §1.2.1（`research/codex-findings/03-voice-memory-tech.md:160-177`）核实 MDN/W3C 后的结论是：该字段只是请求浏览器协商约束，可能不支持或被忽略，没有固定算法或效果 SLA；USB/蓝牙切换、独立 TTS 播放路径、double-talk、恢复预热等都会失效。报告最终结论（同文件 `:1181`）是“够 P0 baseline，不够质量承诺”。
- 【judgement】“工业级”会误导 P1 外放能力和验收标准，也与 05 P0 实际采用耳机/PTT 的保守策略不一致。
- **修改建议**：统一改为“浏览器 WebRTC AEC 是 P0/P1 的可测 baseline，不作质量保证”；要求检查 `getSupportedConstraints()`/`track.getSettings()`，建立设备×浏览器×double-talk QA，保留 PTT/耳机与原生 VoiceProcessingIO 降级。

### A-06 把一个代表性成本估算写成普遍固定倍数

- **位置**：`docs/03-architecture.md:62-66`；`docs/04-key-mechanisms.md:85-88`；`docs/06-references.md:26`。
- 【事实】三处均断言“S2S 约为级联 5–6 倍”，04 还据此写“真实成本大头不是语音”。
- 【事实】Codex 01 §2.2（`research/codex-findings/01-architecture-redteam.md:84-88`）只把 5–6 倍定义为 OpenAI full Realtime 对低价级联在一个代表性 mix 下的工程推断；Codex 03 §1.1.3（`research/codex-findings/03-voice-memory-tech.md:88-118`）进一步核实 Gemini/mini 后明确说不能换成固定每分钟或固定 N 倍，真实差距取决于 talk ratio、上下文复计费、缓存、文本模型和工具重试。其 §1.5 暂缓项（同文件 `:352-357`）明确禁止在没有 usage trace 前宣称固定便宜 N 倍。
- 【judgement】文档保留了 v1.14 的中间纠正，却漏掉了随后完成的 03 报告终判，属于“后出证据没有覆盖旧结论”。
- **修改建议**：改成条件式案例：“在某个 OpenAI full-vs-low-cost-cascade 代表性 mix 中约 5–6×；mini/Gemini 可能接近或更低，不作普遍结论。”正文只保留可复算公式和所需 usage 维度，具体倍数移入带日期/供应商/假设的 benchmark 表。

### A-07 决策包内容不足以支撑它宣称绑定的授权，审批 owner 仍有双义

- **位置**：`docs/02-product-definition.md:31-35`；`docs/03-architecture.md:39,84-90,117-134`；`docs/04-key-mechanisms.md:68-81,120-124`。
- 【事实】04 §2.4 的决策包只有成果预览、步骤/人机分工、Demo 和“开始吗”；紧接着 §2.5 却称授权绑定 `package + scope + 副作用 + 预算 + 有效期`。上述 scope、out-of-scope、假设、验收、风险/副作用、回退、成本上限并未成为决策包的规范字段。03 同时在 daemon 的 `approvals` 表和 Hopper `DecisionRequest` 中放审批，却没有区分“批准 dispatch package”与“运行中批准具体 effect”的两个 decision domain。
- 【事实】Codex 04 §3.2–§3.5（`research/codex-findings/04-interaction-product.md:233-310`）要求 Decision Card 至少包含 Outcome、In/Out、Preview、Assumptions、Acceptance、Plan/owners、Cost/risk/side effects、Decision actions，并给 package_id/version/hash/supersedes；Codex 01 §6.2–§6.5（`research/codex-findings/01-architecture-redteam.md:353-405`）明确了 DecisionPackage、DispatchApproval、runtime DecisionRequest、ResultReceipt 的不同 owner 和 digest 关系。
- 【judgement】现在的“合同”只有产品文案，没有 canonical schema；用户没有看见的副作用却被授权 token 默认为已批准，违反“所闻即所签”。
- **修改建议**：在 04 增加唯一的 `DecisionPackage@revision` schema 和一屏 Decision Card；所有执行、任务、验收、Plan Delta 都引用 package digest。另定义 `ApprovalReceipt`（VoiceLoop 采集、Hopper 执行点复验）与 runtime `DecisionRequest/Resolution`（Hopper 为真相源），禁止复用一个 `approved=true`。03 数据模型/所有权矩阵同步拆开两种审批。

### A-08 已知 P0 阻断项被放在“归 owner 的未决事项”，却未进入 P0 交付与验收

- **位置**：`docs/05-roadmap.md:57-66,101-108`；`README.md:8,36`。
- 【事实】05 §6.5 把身份/多说话人、跨边界幂等、独立 acceptance oracle、secret/egress/供应链、canonical intent、删除/同意传播明确称为“实施前必须覆盖的 P0 级缺口”；但这些项目没有 owner、交付物、顺序或验收，且绝大多数不在 P0 2–3 周清单。README 同时用确定语气描述自主就绪、后台执行和高危安全闭环。
- 【事实】v1.14 §17.7（`history/voice-coding-framework.Cursor2.md:1098-1104`）已把六类缺口列为实施前需覆盖；Codex 01 §8.1/§9.1/§14（`research/codex-findings/01-architecture-redteam.md:508-516,543-555,828-850`）把它们定义为未关闭不得开放自主 dispatch 的 P0 gates，而非需要 owner 决定“做不做”的产品选项。
- 【judgement】把工程安全门禁和商业路线选择混在“未决事项”里，会让排期默认跳过它们；P0 的“单 agent 全闭环”因此不是可验收范围。
- **修改建议**：把 §6.5 移入 P0 Gate 0/Phase 0，逐项指定 owner、artifact 与退出条件；商业取舍仍留 §6。至少包含 identity/auth model、canonical intent ledger、Decision/Dispatch/Result contracts、bridge chaos/idempotency、memory threat model、secret/egress policy、delete/consent propagation 和 independent oracle。P0 总验收必须引用这些 gate，而不只引用故事一。

### A-09 “Brain 无状态”是已被对照材料纠正的错误表述

- **位置**：`docs/03-architecture.md:34-39`。
- 【事实】03 §1 把“Brain 无状态”列为分层铁律，并称工具返回值是 Brain 的“全部世界观”；但同一套文档又要求 Brain 依赖 L0–L3、Context Pack、readiness history、未决问题、批准 package 和 artifact 版本。
- 【事实】Codex 01 §2.3（`research/codex-findings/01-architecture-redteam.md:90-93`）已明确纠正：模型进程可以 disposable/stateless，Brain 服务不无状态；Context compiler 与 intent ledger 是它的 durable state machine。把 Brain 称为无状态会漏掉恢复、审计和 schema migration。
- 【judgement】这是概念层的事实错误，会诱导实现只保存 transcript/工具返回而不保存决策语义状态。
- **修改建议**：改为“语音模型会话/推理进程可丢弃；Brain 不直接拥有执行状态，但 VoiceLoop 对话域持有 durable ConversationEvidence、IntentLedger、ReadinessAssessment、DecisionPackage refs 与 ContextSnapshot”。明确哪些状态归 daemon、哪些只是可重建投影。

### A-10 “设计定稿/落地形态已定”与战略路线待拍板自相矛盾

- **位置**：`README.md:7-8`；`docs/03-architecture.md:5-7,26-30`；`docs/05-roadmap.md:31-41,101-103`。
- 【事实】README 把 VoiceLoop+Hopper 写成确定“落地形态”并标“设计定稿阶段”，03 也把 Hopper 放入 canonical 架构；05 §2/§6 却明确战略路线仍待 owner 拍板，拍板后还要先出 ADR，选择项包括并入 OctoDesk、独立、极薄遥控器等。
- 【judgement】这会让人和 AI 无法判断 Hopper 是 approved decision、recommended option 还是待决假设；“设计定稿”也掩盖了 A-01/A-08 的关键门禁。
- **修改建议**：在 owner 决策前统一标成“推荐目标架构（proposed，Conditional Go）”，README 状态改为“方案收敛/关键 ADR 待决”；拍板后新增 ADR 编号和日期，再把 03/README 提升为 approved，并标明 supersede 的旧职责。

## B 应改

### B-01 “完整闭环没人做、三块能力市面都没有”超出了证据边界

- **位置**：`README.md:7,37`；`docs/01-vision-and-problem.md:19`；`docs/05-roadmap.md:9-14`。
- 【事实】这些位置使用“没人做全”“市面产品都不具备”等全称判断，依据仍写成最初的“6 路竞品调研”。后出的 Codex 01 §1.6/§10.1（`research/codex-findings/01-architecture-redteam.md:66-70,590-610`）补出了原扫描漏掉的 Paseo：其已覆盖本地 daemon、多 runner、语音、手机/桌面、worktree、follow-up、diff、plan card、通知和恢复；Codex/Claude 官方也已商品化移动沟通、后台执行、审批/steer/review 的大量链路。
- 【judgement】对照材料仍支持“经校准的采访/readiness/授权合同可能有差异化”，但不支持对整个市场作存在性证明。绝对化表述也会让未来 AI 忽略最危险近邻。
- **修改建议**：统一改为“在截至 2026-07-22 已审样本中，尚未发现把 X/Y/Z 以同一治理合同闭环实现的产品”；把 Paseo、Codex from anywhere、Claude background/Cowork 纳入 06 和竞争基线，并把壁垒表述收敛到 calibrated readiness、可撤销记忆、vendor-neutral contract 和 review attention，而非语音/通知/本地 daemon。

### B-02 产品层承诺“中途插话即改需求”，没有携带运行时降级条件

- **位置**：`docs/01-vision-and-problem.md:17`；`docs/02-product-definition.md:35`；`docs/03-architecture.md:88,100-113`；`docs/05-roadmap.md:61,95`。
- 【事实】03 §5 正确区分 Claude SDK live steer、Codex app-server steer 和 Hopper `codex exec`/Cursor 的 `kill_and_resume`；05 也承认 Hopper M3b 未实现。但 01 把三家笼统写成支持“中断/追加指令”，02 又无条件承诺“改需求可中途插话”，P0 还允许在 Claude SDK 与 Hopper PoC 两条行为不同的路径中二选一。
- 【judgement】核心事实纠正虽然存在，却埋在架构深处，产品语义仍会让用户以为指令已送达正在运行的 agent。
- **修改建议**：在 02 的执行步骤直接区分 `live_steer`、`cancel_and_resume`、`cancel`，UI/口播基于 runtime capability snapshot 显示“已即时送达”或“将终止本轮并续跑”；05 为两条 P0 路径分别写验收，不再共享一个无条件“完整闭环”。

### B-03 Context Pack 只有材料清单，没有确定性的编译语义与 canonical intent

- **位置**：`docs/03-architecture.md:18,39,48-49,117-134`；`docs/04-key-mechanisms.md:7-18,34-43`；`docs/05-roadmap.md:107`。
- 【事实】新文档有 pack 大小、HEAD/task 版本、provenance/taint 和 owner 边界，但没有定义来源优先级、冲突/否定/撤销、按层 token 预算、跨项目过滤、compaction 验证、稳定编译版本与唯一行动文本；`canonical intent 审计`仅被列在 05 §6 的未决缺口。
- 【事实】Codex 01 §4.2（`research/codex-findings/01-architecture-redteam.md:207-236`）已给出上述缺口和 `ContextSnapshot` 最小字段；Codex 03 §4.3.4（`research/codex-findings/03-voice-memory-tech.md:873-908`）又给出 repo/tree/dirty hash、memory generation、heard dialogue、evidence/rank trace 的 schema。
- 【judgement】对未来 AI 而言，“从 L0+L1+L2 挑相关切片”仍是不可复现的自然语言指示；相同 snapshot 可能得到不同授权上下文。
- **修改建议**：新增 canonical `ContextCompiler`/`IntentLedger` 章节：不可变输入 refs、明确优先级与冲突规则、否定/撤销不复活、source/trust/taint、跨项目 data class、tier budget、compiler/schema version、pack digest 和 deterministic test。高风险语音 turn 还要规定音频理解、独立 transcript、屏幕文字和执行 intent 不一致时 fail closed。

### B-04 “git diff 增量刷新受影响部分”过于简化，检索也漏掉结构关系

- **位置**：`docs/02-product-definition.md:53-55`；`docs/04-key-mechanisms.md:20-32`；`docs/03-architecture.md:155-168`。
- 【事实】新文档把刷新描述为 `git diff` 后增量重建“受影响部分”，但没有说明 working tree/index/HEAD/commit 范围、untracked、rename、rebase/不可达 base、submodule、特殊路径、依赖闭包和原子 generation；03 §9 的检索只写 FTS5 + 可选向量，未把 live `rg` 和多文件结构 graph 作为组合明确落地。
- 【事实】Codex 03 §3.2–§3.3（`research/codex-findings/03-voice-memory-tech.md:629-760`）给出 foundation manifest、source inventory、安全排除、`--raw -z`/untracked、ancestry、依赖闭包和原子切换要求；§4.4/§5.2（同文件 `:912-922,958-976`）推荐 P0 为 FTS5 + live `rg` + source/freshness hard filter，并用结构 graph 补多文件任务。
- 【judgement】当前表述适合愿景，不足以成为“已定架构”；按字面实现会产生 silent stale 和半刷新索引。
- **修改建议**：在 04 增加 `foundation-manifest` 与 generation 状态机，明确 diff 只是 seed、刷新依赖闭包、失败保留旧 generation；03 选型改为 FTS5 + live `rg` + provenance filter，结构 graph 是否 P0/P1写出 spike 和退出条件，向量只在概念失败集证明收益后启用。

### B-05 缺少可由用户切换的交互深度与风险覆盖层

- **位置**：`docs/02-product-definition.md:29-32,59-81`；`docs/04-key-mechanisms.md:47-60`。
- 【事实】新文档只说“清晰就少问、模糊就多问”，项目模板也只有一种深度。competitive scan §1（`research/competitive-scan-2026-07.md:50-56`）已指出 Kiro 的 Feature/Bugfix/Quick Plan 深浅；Codex 01 §3/§12.1（`research/codex-findings/01-architecture-redteam.md:141-142,711-717`）建议 Quick/Guided/Explore；Codex 04 §6.1（`research/codex-findings/04-interaction-product.md:417-435`）又建议 Quick/Standard/High-stakes 风险覆盖层。
- 【judgement】仅靠模型自适应会把“小修为何先阻塞奠基”和“高风险为何只问三题”都留给 prompt，既增加 activation cliff，也难以校准用户负担。
- **修改建议**：区分两组正交概念：对话车道 Quick/Guided/Explore（用户一言可切）与治理深度 Quick/Standard/High-stakes（由 effect risk 决定，用户不能降过 hard gate）；把它们写入状态机、metrics 和模板 schema。

### B-06 review/acceptance 被当成末端页面和未决项，没有成为核心产品面

- **位置**：`docs/01-vision-and-problem.md:79`；`docs/02-product-definition.md:35,42`；`docs/03-architecture.md:45,91`；`docs/05-roadmap.md:71,97,106`。
- 【事实】文档只写“细节转屏幕/open_on_screen/diff 人工把关”，05 §6 甚至仍把 review 面列为 owner 未决；没有定义按 acceptance criterion 组织 diff、测试、截图、风险、未验证项和决策的 evidence view，也没有 review time/错误检出率的验收。
- 【事实】competitive scan `:70-74` 和 Codex 01 §1.6/§8.2/§10.3E（`research/codex-findings/01-architecture-redteam.md:66-70,518-521,651-653`）都把 review 认定为长任务真实瓶颈和核心留存面，而非辅助跳转。
- 【judgement】如果 Decision Package 是开工合同，review surface 就是交付合同的另一半；缺它无法验证“认知负担从表达转移到判断”是否真的降低了总负担。
- **修改建议**：将 review card 提升为 P0：逐验收项证据、风险聚焦差异、未验证/假数据标记、decisions、回退/修订动作；把严重错误检出率、review minutes、first-pass acceptance 纳入 P0 指标，不把它留给 P1 `open_on_screen`。

### B-07 场景基线中的 `Project > Phase > Task/Artifact` 与产物控制面只被部分保留

- **位置**：`docs/02-product-definition.md:83-87`；`docs/03-architecture.md:117-134`；`docs/04-key-mechanisms.md:150-153`。
- 【事实】02 保留了 planning 的阶段流水，03 也有 projects/tasks/artifacts，但数据模型没有 v1.14 §4.16（`history/voice-coding-framework.Cursor2.md:467-481`）明确的 `Phase` 一等实体。04 的产物库有全程写入、版本、检索、召回和显式导出，但未保留 v1.14 §4.18（同文件 `:519-526`）及场景基线 `cross-cutting-artifact-persistence.md:35-39` 的控制台时间线、版本对比操作和“任意子集导出”契约。
- 【judgement】对 S2“先规划文档、批准后批量实施”，Phase 不是排版概念，而是决定审批版本、任务归属和阶段门禁的状态边界；产物仅“可对比”也不等于已有可操作的版本控制面。
- **修改建议**：在 03 数据模型补 `phases(project_id,type,status,package_ref,...)` 或明确为何不需要；04 补 artifact lineage、时间线、版本 diff、supersedes、任意子集导出和权限/受众过滤。

### B-08 多人/会议模式的分期在同套文档内有 P2+ 与 P3 两种答案

- **位置**：`docs/01-vision-and-problem.md:80`；`docs/02-product-definition.md:101-105`；`docs/05-roadmap.md:76-86,108`。
- 【事实】01、02 与 05 §6 都标 P2+，但 05 §4 把“多人/会议旁听模式评估”放在 P3。
- 【judgement】虽然这是未来项，分期冲突会污染 roadmap 查询和 AI 自动生成任务优先级。
- **修改建议**：选定唯一口径。建议将“合规/说话人/authority 预研与被动旁听实验”标 P2 discovery，把真正产品化的多人会议标 P3；三处使用同一名称与状态。

### B-09 `L0–L3` 同时命名记忆层和风险层，已造成实际歧义

- **位置**：`docs/03-architecture.md:18,89,128-131`；`docs/04-key-mechanisms.md:9-18,107-118`；`docs/05-roadmap.md:12,29,65`。
- 【事实】04 同一文件先用 L0–L3 表示记忆层，后又用 L0–L3 表示动作风险；05:29 的“L3 自动外发”脱离上下文无法判断指 memory/session 还是 high-risk effect。
- 【judgement】这是显著的 AI 检索歧义，也增加人读交叉引用成本。
- **修改建议**：记忆改为 M0–M3（或 Profile/Project/Artifact/Session），安全沿用 Codex 建议 S0–S3；全局搜索替换并给术语表，避免只靠章节上下文消歧。

### B-10 “代码理解存 L1”与“代码事实永不进知识库”、双重存储真相之间边界不清

- **位置**：`docs/04-key-mechanisms.md:11-16,30,43`；`docs/03-architecture.md:117-134,167`。
- 【事实】04 的 L1 内容包括架构/模块/术语等“代码库理解”，同一节又说“代码事实…agentic grep 现读，不进知识库”；03 一方面声明“文件系统为真相”，另一方面同时列 SQLite `artifacts` 和 `.voiceloop/artifacts/`，却未说明正文、元数据、memory event/current projection 谁是 authoritative、谁可重建。
- 【judgement】合理意图应是“源码/Git 是原始事实权威，L1 可保存带 provenance 的派生导航；行动前刷新”，但当前绝对句会让 AI 要么不建 L1 架构图，要么把派生摘要误当代码真相。
- **修改建议**：增加 source-of-truth 表：源码/Git、用户确认、memory ledger、Markdown projection、SQLite index、artifact body/path 的权威与重建关系；把“不进知识库”改为“不把派生 L1 当代码事实的最终权威，执行前 live verify”。

### B-11 Pipecat 的选型状态没有忠实呈现后出研究的“暂定 + 对照实验”

- **位置**：`docs/03-architecture.md:155-163`（以及被 README 新纳入但不在本次完整范围的 `docs/07-tech-stack-decisions.md:56-60`）。
- 【事实】Codex 03 §1.5/§5.2（`research/codex-findings/03-voice-memory-tech.md:335-343,958-976`）建议“LiveKit Agents 暂定 P0 + Pipecat 一周 bake-off”，核心理由是 heard-history truncation、async tools 和多管线；03 §9 则直接列 Pipecat 为选型。新出现的 07 虽写“待 spike”，又预先决定 P0 用 Pipecat、失败才 P1 换 LiveKit，并未说明这是对 Codex 03 推荐的显式反向裁决。
- 【judgement】owner 完全可以作不同技术决策；问题不是“必须选 LiveKit”，而是候选研究结论、当前决策状态和退出条件没有在被评审的 canonical 03 中透明区分。
- **修改建议**：03 速览把状态写成“暂定/待 spike”，列同一 golden test 下的 Pipecat vs LiveKit 判定项与切换时点；若已由 owner 裁决 Pipecat，记录 ADR、理由和对 Codex 03 建议的明确 supersede，而非用“定稿/待 spike”混合措辞。

### B-12 06 声称“每个关键结论都有出处”，但关键事实缺少可点击的一手锚点和快照

- **位置**：`docs/06-references.md:3,21-45,70-76`。
- 【事实】06 §2 的 12 条“已核实事实”大多没有就近链接；§3 也没有给 τ-Voice、NIST SP 800-63B、Realtime 定价/会话成本等若干关键事实的直接来源。Hopper 只给 `~/WorkSpace/Hopper` 和目录名，没有固定 commit；Codex 02 则明确其核验基线是 `main@c4c29c6`（`research/codex-findings/02-hopper-integration.md:3-5`）。
- 【judgement】人可以沿 research 追溯，未来 AI 却很容易把“核实于某日某 commit”读成永恒事实；“全部来源”这一承诺目前不可机械验证。
- **修改建议**：每条事实就近加官方/本地证据链接或 `source_id`；本地项目写 repo commit/date/test command，schema 与 runtime 分列；建立“claim → source → snapshot → status(current/candidate/superseded)”表。无法稳定核实的数字标工程推断，不放入“外部事实”栏。

### B-13 正式文档集合边界发生漂移，入口、归档导读和任务范围不一致

- **位置**：`README.md:12-22`；`archive/README.md:6-7`；`docs/03-architecture.md:157`。
- 【事实】README 当前把 07 列为第七篇正式文档，03 也把详细选型委托给 07；`archive/README.md:7` 仍说当前是“docs/ 六篇”，本次用户指定的“全部”清单也只到 06。
- 【judgement】这会让“完整 review”与后续 AI 读取范围不确定；若 07 是正式 canonical 文档，它必须进入文档集版本、导读和评审清单。
- **修改建议**：决定 07 是正式篇章还是附录/ADR。若正式，更新 archive/research 导读和文档集版本并另行补做 07 全文评审；若不是，从 README 的顺序正文移到“决策记录”支撑材料。本文不对 07 全文作通过结论。

### B-14 “hard delete 只为合规”漏掉用户主动 forget，原始音频保留策略也未落地

- **位置**：`docs/04-key-mechanisms.md:28-43`；`docs/05-roadmap.md:98,107`。
- 【事实】04 §1.3 写“硬删只为合规（合规 forget）”，但 Codex 03 §2.3.2（`research/codex-findings/03-voice-memory-tech.md:508-524`）定义的是“合规删除/用户忘记 → hard purge”；其 §1.4.5（同文件 `:320-331`）还要求 raw audio、voiceprint、transcript 分级，原始音频默认不写 L1/L2、短 retention，并覆盖供应商侧可控数据。新文档只笼统说默认不常听/本地存储/删除传播。
- 【judgement】用户显式“忘掉这个”是记忆产品的核心治理动作，不应被“是否属于合规请求”阻断；音频比普通日志更敏感，也不能只靠记忆层通用政策。
- **修改建议**：把 hard purge 触发改成“合规要求或已认证用户显式 forget”，定义 tombstone、不可 restore 和备份恢复规则；另列 raw audio/voiceprint/transcript 的默认 retention、供应商删除、训练 opt-out 和录音/转写分别同意。

### B-15 被列为“证据源”的旧业务流程图仍含 v1.14 已纠正的错误

- **位置**：`research/README.md:3,12`；`docs/06-references.md:14`；被索引的 `research/business-flows.md:4-5,52,81-89,174-182,236-275`。
- 【事实】辅助导读把 `business-flows.md/.html` 列为 docs/02 §2 的证据，06 也把它列入内部研究。该文件自己声明基准仅为 v1.12、Hopper 追加为 v1.13；正文仍称 Brain 无状态、把 `done` event 直接接回叫、把 L3 写成“必须屏幕确认或复述短语”，并把 Hopper DecisionRequest/NotificationIntent 画成现成执行面。这四项均已被 v1.14 §4.7/§17 和 Codex 01/02 纠正。
- 【judgement】正式 01–06 多数地方已经修正，但检索型 AI 很可能优先命中图和流程表，把 superseded 内容重新拼回当前方案；“原貌保留”不足以说明哪些结论不可再用。
- **修改建议**：在 research/README 与 06 对 business-flows 加醒目状态 `historical/superseded after v1.14，非规范证据`，并在文件头列四项已知失效；最好基于最终 canonical 状态机重生成 md/html，再恢复为可引用流程证据。

## C 建议

### C-01 补上场景 1 已明确记录的“一句话拆多任务”小缺口

- **位置**：`docs/02-product-definition.md:29-35`；`docs/05-roadmap.md:68-74`。
- 【事实】`history/scenarios/scenario-1-engineer-direct.md:29-48` 将“工程师一次说三四个独立任务，自动拆分并并行/排队”标为唯一小 gap；新文档只有多任务并行，没有 intake 拆分、逐任务确认和误拆合并规则。
- 【judgement】不阻塞 P0，但应保留在 backlog，避免重写后从需求基线消失。
- **修改建议**：P1 增加 `utterance → candidate tasks → user confirms grouping/dependencies → dispatch`，禁止一段话未经分组确认就产生多个副作用任务。

### C-02 将多人会议的 consent、speaker stance 和私密层边界留成明确 future contract

- **位置**：`docs/02-product-definition.md:101-105`。
- 【事实】02 只保留“全体知情同意 + 说话人分离”；Codex 04 §7.4（`research/codex-findings/04-interaction-product.md:632-645`）还区分逐项用途/保留期、持续 AI 状态、speaker/role/stance、Decision Owner、会议共识与 owner 私下顾虑、受众化外发预览。
- 【judgement】不必在 P0 展开实现，但这些是未来模式的边界，不写就容易把多人会议误建成“一段更长的用户输入”。
- **修改建议**：在 02 §8 增一张 future contract 清单并标 P2 discovery/P3 productization，至少保留 consent scope、authority、speaker stance、private/shared layers、撤回传播。

### C-03 给 `M3b/M3c/M3d/WS4`、receipt、taint、settle barrier 建短术语表

- **位置**：`docs/03-architecture.md:52,113`；`docs/04-key-mechanisms.md:32-43,136`；`docs/05-roadmap.md:35,95`。
- 【事实】这些内部里程碑/架构词在正文直接出现，新读者必须跳进 Hopper/Codex 报告才能知道含义。
- 【judgement】重写已经大幅减少轮次黑话，但这批缩写仍降低首次阅读和 AI chunk 独立可理解性。
- **修改建议**：在 README 或 06 增不超过一页的 glossary；首次出现处同时写自然语言，例如“M3b（Hopper 尚未实现的 durable command/runtime）”。

### C-04 对“事实、owner 决策、推荐、候选、实验参数”使用统一状态标签

- **位置**：全套，尤其 `docs/01:14-19,53-59`、`docs/03:62-68,140-167`、`docs/05:31-41`、`docs/06:21-45`。
- 【事实】同一语气目前同时承载外部事实、工程推断、owner 已拍板选择和待 spike 候选，例如“全部成熟”“已定稿”“首选”“待 owner”。
- 【judgement】这正是 A-01/A-06/A-10 得以发生的文档机制原因，也会使 AI 把 recommendation 误当 current fact。
- **修改建议**：采用统一前缀/元数据：`[verified@date]`、`[owner-decision ADR-x]`、`[proposed]`、`[spike]`、`[future dependency]`、`[superseded]`；数字附假设和有效日期。

### C-05 报告生成后同步索引，避免新的评审再次成为“藏在目录里的材料”

- **位置**：`research/README.md:5-14`；`docs/06-references.md:5-19`。
- 【事实】在本报告创建前，两处只索引 Codex 01–04；本文件写入后，`codex-findings/` 将有第 5 份正式评审，但任务明确禁止本次修改其它文档。
- 【judgement】不应在本任务越权修改索引，但下一轮应把 05 纳入证据地图，否则辅助导读立即落后于目录事实。
- **修改建议**：后续修订时给 research/README 和 06 各加一行 05，并标出它评审的文档集版本/日期；若 07 保持正式，也标注本报告未覆盖 07 全文。

### C-06 将裸 `03 §8` 一类引用改成带锚点链接

- **位置**：全套多处，例如 `docs/01:74,80-81`、`docs/03:45-52,84,138`、`docs/05:66,93`。
- 【事实】本次核验未发现章节号指错，但不少交叉引用只有裸文本，不能点击，也无法被普通 Markdown 链接检查器持续验证。
- 【judgement】当前不构成链接错误，却增加未来章节重排后的静默漂移风险。
- **修改建议**：使用稳定显式 heading slug 或自定义 HTML anchor；CI 同时验证目标文件与 anchor，不只验证文件存在。

---

## ③ 遗漏对照表

> 判定口径：只列“对照材料中已经出现、对 canonical 设计仍有必要，而新文档完全没有或仅有口号/待办、尚不足以实施”的内容。`部分`不等于全文未提，而是关键约束在其它肯定句、数据模型或路线中没有闭环。

| # | 严重度 | 对照来源位置 | 应保留的内容 | 新文档现状（【事实】） | 为什么应该补（【judgement】）/建议落点 |
|---|---|---|---|---|---|
| O-01 | A | v1.14 §17.5（`:1090-1092`）；Codex 01 §2.1/§6.3；Codex 02 §1.4/§6.2 | Hopper current task runtime 与 M3a schema-only 的明确边界；缝合层其实是 Control Plane Bridge | **部分且被反向表述覆盖**：03/05 提到 M3b/M3d 未实现，但又把 DecisionRequest/NotificationIntent/回叫管线列为可运行复用 | 不先拆 current/future 就无法可信估时；落 03 §1/§5 与 05 §1，关联 A-01。 |
| O-02 | A | v1.14 §17.6（`:1094-1096`）；Codex 02 §3.1–§3.3、§7.6（`:193-235,625-634`） | 候选事件后的 artifact/projection settle barrier，以及 PoC 8 条验收 | **部分**：只保留 replay 幂等、重启一次回叫、verify fail 文案；缺 settle、gap/corrupt、project snapshot、独立 vault/禁外部副作用等 | 这是防 false-complete 的最小可测合同；完整放入 05 §3，关联 A-02。 |
| O-03 | A | v1.14 §17.7（`:1098-1104`）；Codex 01 §8.1/§9.1 | identity、跨边界幂等、独立 oracle、secret/egress/supply-chain、canonical intent、删除/同意传播六类 P0 gate | **只有清单**：05 §6.5 罗列但未进入 P0 deliverables、owner 和验收 | “知道缺口”不等于路线覆盖；移入 05 Phase 0/P0 gates，关联 A-08。 |
| O-04 | A | Codex 01 §4.2（`:207-236`）；Codex 03 §4.3.4（`:873-908`） | 确定性 ContextCompiler、来源优先级、否定/撤销、tier budget、跨项目过滤、compiler version/digest、canonical intent | **缺失**：只有 L0–L3 取片、pack 大小和 HEAD/task 失配重取 | 它决定恢复后的 Brain 是否仍理解同一件事；落 03 数据模型 + 04 记忆机制，关联 B-03。 |
| O-05 | A | Codex 04 §3.2–§3.5（`:233-310`）；Codex 01 §6.2–§6.5 | Decision Card 完整字段；package_id/version/hash/supersedes；Approval/Dispatch/Result 合同及 owner | **部分**：有三件套、计划 artifact、package hash/Plan Delta，但没有 canonical schema、完整风险/边界/验收字段和两类审批 owner | 现有包不足以支撑 scope/effect/budget 授权；落 04 §2 与 03 owner matrix，关联 A-07。 |
| O-06 | A | Codex 01 §4.3（`:238-268`） | `effect × target × data × identity/credential/trigger/cost` 风险政策与执行点 receipt 复验 | **缺失**：仍为动作例子 L0–L3，并允许语音批 install/push | 避免低风险动词包裹高风险效果；替换 04 §5.1，关联 A-04。 |
| O-07 | A/B | Codex 01 §13/§14（`:809-821`）；Codex 04 §1.4/§8 | readiness corpus、false-ready/ECE/Brier/返工指标、shadow mode 产物和上线退出线 | **部分**：04 §2.2 提 shadow mode/false-ready，但 05 没有数据集、基线、阈值或 milestone | Readiness 是核心产品假设，不能只靠概念；在 05 P0 增 eval track 和退出标准。 |
| O-08 | B | Codex 01 §3/§12.1；competitive scan §1；Codex 04 §6.1 | Quick/Guided/Explore 交互车道 + Quick/Standard/High-stakes 治理深度 | **缺失**：只写模型按清晰度自适应问几轮 | 让小任务不被重流程拖累、高风险不被问题预算放行；落 02 §3/§5、04 §2，关联 B-05。 |
| O-09 | B | Codex 03 §3.2–§3.3（`:629-760`） | foundation manifest、安全 inventory、可见 degraded 状态、完整 Git delta/ancestry/closure、原子 generation | **缺失/过度简化**：只写首次奠基、`git diff` 刷新受影响部分 | 防 silent stale、半刷新和不可复建；落 04 §1.2–§1.3，关联 B-04。是否允许 degraded 可由 owner 决定，但必须记录决策和状态语义。 |
| O-10 | B | Codex 03 §3.1.5/§4.4/§5.2（`:619-625,912-922,958-976`） | FTS5 + live `rg` + source/freshness hard filter；结构 graph 补多文件；向量后置 | **部分**：正文提 agentic grep、选型表写 FTS5 + optional vector，没有结构 graph/组合检索合同 | 多文件 blast radius 不能由 FTS/grep 单独代替；落 03 §9 与 04 Context Pack。 |
| O-11 | B | Codex 01 §1.6/§8.2/§10.3E；competitive scan §3 | 以 acceptance criterion 组织 diff/test/screenshot/risk/unverified 的 review surface 和 review metrics | **缺失**：只有 `open_on_screen`/看 diff，且 05 仍列未决 | 审阅是异步 agent 的真实瓶颈，也是“表达→判断”价值能否成立的验收面；落 02 核心循环、03 控制台、05 P0，关联 B-06。 |
| O-12 | B | v1.14 §4.16（`:467-481`）；scenario 2 checklist（`scenario-2-ceo-to-docs-to-impl.md:34-43`） | `Project > Phase > Task/Artifact` 一等层级，阶段状态/批准版本与批量派单关系 | **部分**：02 有阶段流水，03 数据模型只有 project/session/task/artifact | S2 的规划→评审→实施需要 durable phase boundary；落 03 §6，关联 B-07。 |
| O-13 | B/C | v1.14 §4.18（`:513-528`）；artifact baseline（`cross-cutting-artifact-persistence.md:35-55`） | artifact 时间线、版本 diff、lineage、任意子集导出 | **部分**：有全程写、版本“可对比”、检索、召回与显式导出，但无控制面/子集/受众语义 | 这是 S2/S3 的可操作资产面；落 04 §8/03 控制台，关联 B-07。 |
| O-14 | C | scenario 1 checklist（`scenario-1-engineer-direct.md:29-48`） | 一次口述自动拆成多任务、展示分组/依赖并逐项确认 | **缺失**：只有后端多任务并行 | 原基线已明确标注的小 gap，不应因重写消失；放 P1 backlog，关联 C-01。 |
| O-15 | B | Codex 01 §1.6/§10.1（`:66-70,590-610`） | Paseo 及 2026 官方 mobile/background/review 能力作为竞争基线 | **缺失**：06 仍沿用旧 competitive scan，没有 Paseo | 后出研究已指出它是最危险近邻；补 01/05 竞争表与 06 来源，关联 B-01。 |
| O-16 | B | Codex 03 §1.4.5/§2.3.2（`:320-331,508-524`） | raw audio/voiceprint/transcript 分级 retention；用户主动 forget 的 hard purge | **缺失/部分**：只有通用本地存储与“合规 forget” | 语音原始数据风险高于普通日志，且用户应能主动忘记；落 04 §1.3/安全策略，关联 B-14。 |
| O-17 | C | Codex 04 §7.1–§7.4（`:608-645`） | 回答解析错误的 grounding、trust zone；会议 speaker/stance/authority、共享/私密层、consent scope | **部分**：有来源 trust/taint、全体知情与说话人分离，但没有 claim grounding 和会议权限模型 | 可留未来阶段，但需保住边界，避免把第三方话语变成用户授权；落 02 §8/04 证据账本，关联 C-02。 |
| O-18 | C | Codex 03 §7.1/§7.7/§8（`:1056-1082,1105-1119`） | half-cascade 候选、provider capability registry、统一 golden/cost/device 评测产物 | **缺失/部分**：有 runtime probe 和双引擎，无 half-cascade/registry；05 只有 ASR golden | 供应商能力快速漂移，未来 AI 需要读“实测能力”而非型号假设；可放 07/06 与 P1 技术债，不阻塞窄 PoC。 |

### 遗漏核对结论

【事实】三场景、三横切和设计哲学的主体并未整体丢失：S1/S2/S3、非技术用户、规划文档→批量任务、项目类型化验收、持久知识库 vs Context Pack、三条对话路径、产物全程写入、采访收敛和“规格是 AI 产物”都能在 01/02/04 找到对应正文。遗漏主要集中在四类：**运行时事实边界、可签署合同、P0 验证/安全门禁、可操作的 review/phase/artifact 控制面**。

【judgement】建议先关闭 A-01～A-10，再处理 B-03/B-04/B-06/B-12；完成后重新跑一次“claim→source、phase→deliverable、state→文案、link→anchor”机械对账。只有在 Hopper current/future 矩阵、canonical `review/done`、P0 gate 与 Decision/Dispatch/Result 合同四项一致后，才适合把状态改回“设计定稿、可交人工验证”。
