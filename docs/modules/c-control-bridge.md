# 模块详设 C · 控制面桥(C1–C8)

> **性质**:实施视角详设 + 核对索引,细化 [08](../08-module-design.md) §2 C 域。合同真相源 = [09](../09-data-contracts.md)(状态机 §6、投影 §7、DDL §9、工具 §13、测试 §12)与 [设计 ADR-001](../adr/design/ADR-001-execution-layer.md);本文引用不复制,冲突时 canonical 胜。
> C 域是跨域边界的家:**执行域状态归 Hopper,对话域状态归 daemon,跨域只走 durable 合同**(03 §1 所有权矩阵)。

## C1 · 任务卡渲染器(TaskCardRenderer)

- **职责**:`DecisionPackage` → Hopper drop 格式(frontmatter `id` + 正文 + 尾部 dispatch 注释行);verify 白名单绑定进卡。**不做**:内容创作(包是 A6 的)、直接 drop(C2 执行)。
- **接口面**:幂等三级去重合同(09 §14-A3:frontmatter id + `<!-- saydo:dispatch dsp_xxx rev=N digest=... -->`,授权变 ⇒ 正文 hash 变);**acceptance 标题按 Hopper 词表渲染**(单源 `headings.ts`,Hopper 侧导出词表+样例;没有可测验收标题 ⇒ triage 即 blocked);**drop 前 `hopper lint <file> --json` 预检**(09 §6.2:必须查 `result.classification`/`execution_decision`,`missing_acceptance` 只是 warning 不进退出码)。
- **设计要点**:① 不达标不 drop,回对话补验收标准;② 调试用 `hopper prompt` 预览编译产物;③ content-risk 意识:正文措辞影响 Hopper 关键词分诊(04 §5.1 双维语义),渲染器不做规避(诚实),但拍板话术提示高风险词后果(10 #30)。
- **依赖**:A6(包)、E2(verify 白名单);被 C2 消费。
- **验证归属**:§12-8(缺验收标题被 lint 拦不 drop)、P0.5-B(渲染 golden)。
- **分期**:P0.5-B(0.5 手动 PoC 先用手写卡验词表)。

## C2 · 执行客户端(ExecutionClient)

- **职责**:两形态一接口——**C2-Tier1**(P0):SDK/CLI 薄执行器,canUseTool 语义审批门;**C2-Hopper**(P0.5):drop/run/cancel/review/merge/retry 经官方 CLI。**不做**:执行逻辑本身(agent/Hopper 的)、审批裁决(C5)。
- **接口面(Tier1)**:`DevAgentBinding`(09 §11:agent=claude_code|cursor|codex、transport=sdk|cli)、`tier1_runs` 表 + 转换规则(09 §9)、steer 应答 `queued_delta/cancel_resume`(09 §13);适配器矩阵 07 D8(claude_sdk=产品缺省 canUseTool+live steer;cursor_cli=dev 缺省 hooks 审批门、无 live steer;codex=Tier2 经 Hopper)。
- **接口面(Hopper)**:`HopperCommand`(09 §6.2:op 词表/idemKey/先 intent 后 confirmed)、`--req-id`/`--expect-*`/`--origin`(baseline.2)、**retry 闸门**(高风险不自动 retry、分诊 blocked 恢复走 re-drop→unblock,09 §6.2)、capabilities 握手第一调用(09 §11 [hopper])。
- **设计要点(Tier1 安全,4.1 全量)**:① cursor 审批门 = 每任务 worktree `.cursor/hooks.json` `beforeShellExecution` 阻塞回连 daemon socket,**fail-closed 四律**(只依赖 deny/jq 构造 JSON/超时=deny/每条命令独立审批);② 审批门完整性:gate 在 agent 不可写目录、**tool_call 无 hook 回调 canary ⇒ 立即 cancel**、`cursor-agent` 版本 pin;③ worktree 供给:setup 缺省 `--ignore-scripts`、凭据剥离(G4)、verify **内容冻结**(dispatch 冻结 argv+脚本 digest,执行前重校,不符 fail-closed,G3);④ daemon HTTP/WS 身份:capability token + Host/Origin 白名单(G1 网络半边);⑤ 恢复钥匙 =(adapter, nativeSessionId, cwd),失败降级"摘要+diff 注入新会话"。
- **设计要点(Hopper)**:提交串行 ≤1 in-flight、间隔 ≥200ms、撞 scheduler.lock 退避 ≥5s;MutationResult 五状态,`expired ≠ 失败`(对账 `.result.json`);merge 是独立命令,S3 收据绑 merge 动作本身(设计 ADR-001)。
- **依赖**:C5(审批)、C1(卡)、E2(风险)、C7(恢复);Tier1 依赖所选 adapter 登录态(Phase -1 A⑤)。
- **失效与恢复**:hopper_commands ≠confirmed 重放(idemKey);tier1_runs 崩溃重放基元(0.3);cancel 语义三分(answer_permission / kill_and_resume / cancel,03 §5)。
- **验证归属**:§12-6(取消/改需求,Tier1 子集属 P0)、§12-7(崩溃恢复)、§12-10(route×adapter 判别 + 安全反例:canary/digest 冻结/DNS-rebinding)、4.0(**脚本级预检**)、4.1(全链 conformance 报告 + deny 拦截/阻塞放行 e2e——4.0/4.1 分工见计划,Codex 复审 B19 同步)。
- **分期与开放项**:C2-Tier1=P0;C2-Hopper=P0.5-B。开放:claude_sdk 四能力验证顺延至订阅购入(v2.3①);cursor_sdk(API key)后续优化。

## C3 · 事件消费器(EventConsumer)

- **职责**:消费 Hopper `events.jsonl`:byte cursor 断点续读、半行保留、损坏行计数、未知事件/字段容忍、schema_version fail-closed;**settle barrier**;投影 total mapping(09 §7)。**不做**:改执行域状态(只读)、直接触发回叫(settle 后交 C4)。
- **接口面**:`events_cursor` 表(09 §9:byte_offset 只推进到完整行、vault_id 身份、file_generation 本地自增全量重建);settle 合同(09 §6.3:**主判据=消费 RunSettled + 廉价复核**(evidence_digest 对账 + summary_path 存在),六字段机械判定=事件缺失兜底,SIGKILL 走 reconcile→RecoveryRecorded);cancel settled=RunSettled 出现(09 §6.1)。
- **设计要点**:① 投影是**用户语言翻译**(粗阶段条+当前活动+已花预算,不做假百分比);② ready∧risk-high 投影 blocked(09 §7,X3);③ retry 轮注明"在原快照基础上继续"(旧 base 告警,08 §5.1);④ `evidenceDigest` 当不透明字符串,不重算;⑤ blocked 四来源分支翻译(10 #30)。
- **依赖**:Hopper(只读)、C4/C6(settle 后下游);被 D1 消费(投影)。
- **失效与恢复**:cursor 断点续读天然幂等;文件截断/替换 → file_generation+1 全量重建。
- **验证归属**:§12-8 全绿(含 RunSettled 消费/复核不符不 settle/风险双维反例;harness=`HOPPER_FAKE_SPEC` fake-runner;fixtures/migration-samples 作种子)。
- **分期**:P0.5-B。

## C4 · 回叫引擎(CallbackEngine)

- **职责**:durable outbox 状态机 + PagerDuty 式升级链(L0 语音 → L1 桌面+ntfy → L2 电话 P1)+ 免打扰/输出仲裁。**不做**:消费原始事件(**只认 settle 后状态**,08 §3 硬规则 ②)、内容生成(C6 给 one_liner)。
- **接口面**:`CallbackOutboxEntry`(09 §6.3:trigger 七值/occurrenceKey 口径表/dedupeKey 四段 NOT NULL/活跃唯一索引/requeued 唯一语义/取消与返工冻结 superseded);投递口径=至少一次+dedupe 收敛(诚实注记);回叫话术 10 #29–#35。
- **设计要点**:① settle 四项缺一不叫(proof 齐备才写 outbox);② 重建接通第一句=原因;③ DND 窗口 snooze 补叫;ack 后 resolution-timeout(缺省 30min)重升级;④ 输出仲裁:同时多事件按优先级序播报,不叠音(02 §5);⑤ 多任务回叫聚合=P1(05 §6 盲区表态,P0 兜底=通知优先级+仲裁)。
- **依赖**:C3(settle 态)、C6(摘要)、A2(重建会话)、ntfy(E1 供给);被 D1 通知页消费。
- **失效与恢复**:重启扫活跃条目,同 dedupeKey 不重复入队("重启只叫一次");拨出成功与落盘间的重复窗口如实声明(≤1 次是测试断言不是上界)。
- **验证归属**:§12-5 全绿(dedupe NOT NULL 反例/settle 缺一不叫/DND 补叫/重升级/取消冻结)。
- **分期**:P0(L2 电话 P1)。

## C5 · 审批服务(ApprovalService)

- **职责**:两类审批(dispatch_package / runtime_effect)全生命周期:digest 绑定、单次消费 nonce、超时按档终局、落盘可恢复;**执行模式策略承载点**(两档的 S2 姿态差异全在此)。**不做**:风险计算(E2)、S3 语音放行(永不)。
- **接口面**:`approvals` DDL + 合法组合矩阵 CHECK(09 §9:S3 只走屏幕强认证/voice 弱认证封顶 S2 且**必绑 turn_ref**/push 配对 PIN 封顶 S2/preauthorized 须父包);收据状态机 09 §3;`approveAction`(09 §13);billing-switch 一次性收据(09 §11 规则 5);presentation 状态机(**09 §14-A2**,P0 最小版=S2 打断即作废;A8 = 完整 E2 签名 presentation 六字段形态,P0.5-A——Codex 复审 B16 勘误);**S3 卡 WebAuthn 挑战/收据链(R-A 2026-07-26/27,W4 实施)**:`webauthn_credentials`/`s3_challenges` 两表 + 四工具(registerWebauthn/issueS3Challenge/verifyS3Assertion/approveMerge)+ S3MergeReceipt 判别型 + assertS3LocalAndBound 守卫(09 §3.3/§13)。
- **设计要点**:① 中断点落盘可恢复(LangGraph interrupt 范式),超时绝不悬挂:直达档=默认拒绝(agent 换路)、逐步档=转 blocked 停靠等人(04 §5.2);② 所闻即所签:S2 播报被打断 ⇒ presentation 失效,必须完整重播,裸"好"不消费(4.2 音频烟测);③ 审批卡必带项目/任务上下文;④ 三熔断挂本模块外沿(活跃墙钟停表+回合+成本,04 §6);⑤ 停靠老化 72h 取消转草稿,长停靠恢复强制复验收据有效期。
- **依赖**:E2(等级)、A7(turn_ref)、A2(重建);被 C2 的 canUseTool 回调消费。
- **验证归属**:§12-3 全绿(单次消费/nonce/S3 CHECK/voice 缺 turn_ref 拒/超时按档/timeout_parked 复验)+ §12-13(S3 合并链反例集,09 §3.3)+ 4.2(熔断注入/打断作废)。
- **分期**:P0(逐步确认档全量);EffectGrant 预授权链=P0.5-C;edit 动作=P1。

## C6 · 摘要器(Summarizer)

- **职责**:agent 原始事件流 → 三层口播摘要(one_liner / walkthrough / decisions[]):统计走纯规则(实时免费),叙事走廉价档(仅关键节点惰性)。**不做**:把原始事件流给 Brain(**永不**,03 §2)。
- **接口面**:`explainResult`(09 §13);摘要判别联合 `kind: coding_done|content_done|blocked|failed|unknown` 各自模板(content_done=writing 成稿完成态,R-A 2026-07-26,09 §6.1a/10 §5 摘要输出规格);数字纪律:文件数来自 git、测试数来自独立 gate、未知标 unknown、附 asOf。
- **设计要点**:① 叙事模型只做措辞,不得产生规则层没有的数字;② decisions[] P0 只采集落库进证据视图,不口播(P1);③ 摘要缓存按 evidenceDigest 键(同证据不重算)。
- **依赖**:C3(事件)、E1(廉价档);被 C4/A3/D1 消费。
- **验证归属**:4.3(摘要数字=规则统计断言)。
- **分期**:P0。

## C7 · 对账与恢复(Reconciler)

- **职责**:daemon 启动对账:孤儿进程、中断任务、`hopper_commands ≠confirmed` 重放、dispatch binding NULL 行重放;delivery preflight;电源断言(caffeinate)。**不做**:业务决策(只恢复到一致态,悬案上浮)。
- **接口面**:两阶段 dispatch 合同(09 §6.2);Tier1 恢复钥匙(09 §12-7);Hopper 侧 reconcile(settle 兜底,09 §6.3)。
- **设计要点**:① 恢复顺序:先本地账(SQLite journal)→ 再跨域对账(Hopper 投影)→ 最后叫人(回叫补发经 C4 dedupe);② preflight:回叫拨出前验通道可达(免打扰/设备在线);③ 长任务电源断言防睡眠中断。
- **依赖**:全部 C 域 journal 表;E3(审计)。
- **验证归属**:§12-7(kill -9 注入:两阶段 dispatch/journal 重放/Tier1 恢复降级)。
- **分期**:P0。

## C8 · 成本账本(CostLedger)

- **职责**:全链记账 estimate → budget → actual:对话侧(ASR 分钟/token/TTS 字符,1.2 接线)+ 执行侧(Tier1 usage + Hopper `last_run_cost` 逐 run 按 taskId 累加,04 §6 2026-07-24 更新)。**不做**:预测剩余订阅额度、显示伪精确。
- **接口面**:`cost_entries` DDL(09 §9:known/source CHECK,订阅行恒 known=0/amount=NULL);三态呈现纪律(09 §11 规则 5:known 金额/unknown"还没有确切数字"/subscription"订阅额度内已用 N 次");月预算与 maxCost 只 SUM `source='api'` 行;billing-switch 收据后才产生 api 行。
- **设计要点**:① per-task 归因:dispatch_binding 的 taskId↔runId 映射 + `show --json` last_run_cost 累加(不需 Hopper 改);② codex 成本=估算 USD(订阅下等价 API 口径,非真实账单)如实标"估算";③ 熔断维度归 C5/04 §6,C8 只供数。
- **依赖**:E1(用量事件)、C3(Hopper 成本);被 D1 成本页/A6(估算)消费。
- **验证归属**:§12-9(subscription 行形状 DDL CHECK/限流未确认不产生 api 行)。
- **分期**:P0 记账 / P1 表盘。
