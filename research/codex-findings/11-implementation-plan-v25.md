# Codex 复审报告:实施计划 v2.5 + IMPL-PROMPT(2026-07-24)

> 模型 gpt-5.6-sol / reasoning max / read-only 沙箱;prompt 见 prompts/11-implementation-plan-v25.md;原始日志 logs/11-implementation-plan-v25.log。
>
> **Triage(主会话,2026-07-24 当轮)**:**A1–A6 全部采纳并已修**(A1 切锁 SHA→`bdd1e548…` 全链勘误 09/plan/IMPL-PROMPT/ADR;A2 summary_path .md→受控映射 .html 合同落 11 §5.5/ADR;A3 settle 复核按终态拆分落 09 §6.3;A4 trust-report emoji 呈现层转换落 11 §5.5;A5 P0.5 合并统一人工交接、自动 merge 禁用落 plan P0.5-B;A6 共享 redactor+脱敏 golden 落 plan 1.4)。**B1–B20 全部采纳并已修**(0.4 子集/前置循环/§13 三工具+TaskView 定形/收据与 promote 枚举收紧/话术单档分期/pricing 合同/依赖图重写/StatusChip 派生态/权威边界与路径基准/卡点缺省动作/两提交法/工期 34–47/后端停机口径/shadow 澄清/A8 残留/A6 传播/modules 三处同步/clone 自办)。**C1–C6 全部采纳并已修**。No-Go 判定的六项 A 级全部闭环 ⇒ 视为 Go。

---

总评：**No-Go**——§12 1–10、§14 六项和 §13 主体虽有承载，但 6 个 A 级合同/安全错误会让 baseline.2 切锁、失败态 settle、证据视图或合并授权直接违约，当前不能作为开工 Prompt 发出。

## [A]

- [A] `IMPLEMENTATION-PLAN.md:3,22,133,184`；`IMPL-PROMPT.md:5,9`；`docs/09:537-540`；`ADR-001:74` | 把 annotated-tag object `ff6cee…` 当作 commit/`expected_version`，按计划 checkout 后 `rev-parse HEAD == ff6cee…` 必失败 | `research/hopper-baseline2-diff-manifest.md:8-16` 明确切锁 commit 是 `bdd1e548f9359789497a797eda24398beba68ac5`；本轮实测 `git cat-file -t ff6cee…`=`tag`、tag 指向 `bdd1e548…` | 全部 checkout、HEAD/capabilities 断言和 `expected_version` 改锁 `bdd1e548…`，`expected_tag` 改 baseline.2，`ff6cee…` 仅标注为 tag-object SHA。

- [A] `IMPLEMENTATION-PLAN.md:140`；`ADR-001:54` | 把 `RunSettled.summary_path` 当作可直接 iframe 的 HTML，真实字段指向 `.md` | 锁定源码 `execute.ts:466-476` 生成 `<runId>.md` 路径；`postrun/pipeline.ts:427,449` 另写同名 `.html`；`research/hopper-integration-appendix.md:159` 也只断言 `.md` | 回写合同为“校验受信 vault 内的 `.md` 后，受控映射到同 basename `.html`”，并测试越界路径、文件不存在和扩展名异常。

- [A] `docs/09:328`；`IMPLEMENTATION-PLAN.md:138` | failed/blocked 的廉价复核和兜底要求 summary 存在，但 baseline.2 对这些终态不运行 post-run，因此 `summary_path=null`，会永远无法 settle/回叫 | 锁定源码 `execute.ts:281-312,474-476`；`research/hopper-integration-appendix.md:160-161` 明确 failed 不生成 summary | 按终态拆复核：review 必须 evidence+MD summary；failed/blocked/recovery 接受相应 RunSettled/退出或问题证据并允许 summary 为空，补 §12-8 正反例。

- [A] `IMPLEMENTATION-PLAN.md:140` | 直接嵌入 Hopper trust-report 会把 emoji 带进 SayDo UI | `docs/11 §0.5、§12` 是全项目零 emoji 硬合同；锁定源码 `trust-report.ts:76-89,117` 实含多种 emoji | 在展示层做确定性文本/Lucide 转换并加 DOM 字符门禁，原始报告原样留存，不改变证据 digest。

- [A] `IMPLEMENTATION-PLAN.md:32,138` | 首发排除 S3 屏幕审批卡，却安排 Hopper `approve→merge`，没有合法 S3 merge receipt 来源 | `docs/09:146-153,251-254,646-649` 与 `ADR-001:53` 均要求 merge 为独立 S3 动作；09 已提供 `requestManualMerge + MergeProof` | 首发 Hopper 合并统一走已计划的人工合并交接和 watcher；自动 `merge` 在 S3 屏幕授权具备前保持禁用。

- [A] `IMPLEMENTATION-PLAN.md:71,75,107,122` | 话术红线只写进 Prompt，没有共享脱敏序列化器或反例测试的实施步骤 | `docs/10:15` 要求 token、secret、客户数据、完整路径永不进入 TTS，且审批播报与溯源共用 data-class redaction | 在 1.2/1.4 落共享 redactor，并给 #19/#37/#39 加 token、客户数据、完整路径的 golden 反例。

## [B]

- [B] `IMPLEMENTATION-PLAN.md:57-60,83-110,138` | §12 1–10 没有完全裸项，但 0.4 过早宣称 §12-9 全绿；argv、parser、tripwire、observedModel、billing-switch、verify 等要到 1.2b/4.1 才存在 | `docs/09 §12`；现有承载为 `1→0.2a/3.3`、`2→0.2b/P0.5-C`、`3→0.2b/3.4/4.2`、`4→2.1`、`5→4.4`、`6→4.5/P0.5-B`、`7→0.3/4.3/P0.5-B`、`8→P0.5-B`、`9→0.4/1.2b/4.1`、`10→0.3/2.1/4.1/4.5` | 把 0.4 出口改成“§12-9 配置/启动子集”，完整 §12-9 在后续步骤关闭。

- [B] `IMPLEMENTATION-PLAN.md:133-151`；`IMPL-PROMPT.md:9,18` | §14 六项都有承载，但“未封闭不进本阶段编码”与 P0.5-A 自己负责封闭 A2/A8 构成循环 | `docs/09:682-695` 只禁止未闭合时进入路径二行为；承载为 A2/A8=`4.2最小版+P0.5-A`、A3/A4=`P0.5-A/B`、A6=`2.1`、A7=`P0.5-A/B/C` | 允许 P0.5-A 编写合同、validator 和测试；只在运行时 dispatch/P0.5-D 前设全绿门，baseline.2 不绿则维持既定 baseline.1 分支。

- [B] `IMPLEMENTATION-PLAN.md:74`；`docs/09:633,640,655,661` | §13 中 `createTask`、`getStatus`、`openOnScreen` 只有泛化“工具路由”，无明确 handler/验收；`TaskView` 只有名称没有字段 | `docs/09 §13`；其中 #23 话术还要求已发生时长、步骤号和步骤名 | 为三项补显式实施落点、最小 `TaskView` schema 与测试；`openOnScreen` 明确 P0 本地 review URL，Hopper Console 深链按既定分期处理。

- [B] `docs/09:636,673` | `issueDispatchReceipt.authStrength:string`、`promoteProject.type:string` 宽于同篇 canonical union；前者也未表达 voice 收据的当前 `turnRef` 绑定 | `docs/09:44,133-153,398-399` | 工具输入引用严格枚举/判别联合，并明确由当前用户确认轮绑定 `sessionId/turnRef`，补非法字符串与错轮次反例。

- [B] `IMPLEMENTATION-PLAN.md:97,99,122`；`docs/10:5,41-46,58,61-63,72,74` | P0 一边只实现 `step_confirm`，一边仍让 Brain 询问两档并按话术表全部 P0 行跑 golden，可能提前激活直达档、Hopper 和 grant 分支 | `docs/10:5` 已声明 #12/#25/#27/#30/#32/#39 的相关分支属 P0.5，但表内 #12–15/#22/#25/#27 等仍标 P0 | P0 固定逐步确认且不询问两档；把混合行按 mode/route 拆分有效分期，P0.5-C 再启用直达相关 golden。

- [B] `IMPLEMENTATION-PLAN.md:96` | 3.3 要从 `[params]` 读取单价表，但 canonical 配置没有单价字段、货币或 `asOf` 结构 | `docs/09:16,546-554` | 3.3 前补最小 pricing config 合同；没有表项时严格输出 unknown，不猜价格。

- [B] `IMPLEMENTATION-PLAN.md:79,149` | “2.1–2.3 排序自由”不成立；B1/B5/B3 依赖 B2，B3 还依赖尚到 3.3 才实现的 B4；2.3 的 API 前置也不能只写“有 key” | `docs/modules/b:10,30,49`；`docs/modules/e:10-13` | 改成至少 `1.2 provider→2.1→2.2→2.3`，前移 B4 最小写入或延后 B3-B4 集成；CLI 路补 1.2b，API 路要求有效 provider+key。

- [B] `IMPLEMENTATION-PLAN.md:148-151` | 总图还缺隐藏依赖：3.1 A4 依赖 3.2 A5；Phase 3 依赖真实 B2/B5；4.1 的审批闭环依赖 4.2 C5；P0.5-D 同时依赖 B 与 C；2.4 还缺 1.3a，转正条件又依赖奠基或首包 | `docs/modules/a:41`、`docs/modules/c:22`、`docs/09:53-71,673` | 补 `2.2/2.3→Phase3`、`3.2核心→3.1`、`4.2核心→4.1 E2E/出口`、`B∧C→D`；2.4 加 1.3a，并将 promote 延到 2.3 或首个决策包后。

- [B] `IMPLEMENTATION-PLAN.md:120`；`docs/11:104-123` | 要照抄的 StatusChip 表自称与 TaskCard 状态一一对应，却缺 `confirmed`、多出派生的 `waiting_confirmation/parked`，并合并两个 cancel 状态 | `docs/09:226-228` 是持久态枚举 | 把 11 的表改成“持久态+派生态 TaskView 映射”，补 confirmed、拆 cancel 两态，并明确派生规则，不能扩写数据库枚举。

- [B] `IMPL-PROMPT.md:9,13,19,34-37`；`README.md:10,32`；`AGENTS.md:17` | 新会话权威边界不完整且自相矛盾：相对路径基准未写、AGENTS 最后读、设计仓既称只读又要求回写、canonical 只列 09/10/ADR、库可自决又与 07/11 锁定选型冲突；首读 README 仍写 v2.4/baseline.1，AGENTS 漏 11/modules | `IMPLEMENTATION-PLAN.md:11-12` 与本轮给定 canonical 范围 | 指定所有先读路径相对 voice-coding 绝对根，AGENTS 先读；列全 01–11/modules/ADR；说明设计仓仅经评审可写；自决库仅限 canonical 未锁定的内部实现，并刷新 README/AGENTS。

- [B] `IMPL-PROMPT.md:35,49-50` | 必须确认类卡点仍要求“无回复执行缺省动作”，可能代 owner 选择范围、安全或花费 | Prompt 自己的必须确认边界与项目 owner 唯一决策纪律 | 规定必须确认项的缺省动作只能是暂停受影响分支并继续无关安全工作。

- [B] `IMPLEMENTATION-PLAN.md:30,175`；`IMPL-PROMPT.md:30-31` | evidence 要先包含随后创建的同一 commit hash，这是不可实现的自指哈希 | Git commit hash 取决于文件内容 | 改记 tested tree/代码提交 SHA，或明确“代码提交→证据提交”两提交法。

- [B] `IMPLEMENTATION-PLAN.md:61,72,154` | 单人串行口径已改，但算式不成立：当前文字应约为 `24–31 + 7–10 + 3–6 = 34–47`，不是 30–38 | 同计划各步骤估算 | 明确哪些工时已内含后再给唯一总量；按当前写法应改为约 34–47 工程日。

- [B] `IMPL-PROMPT.md:35`；`IMPLEMENTATION-PLAN.md:55,163` | Prompt 写“所选后端全败才停”，计划风险表却是所选后端任一必需能力不成立即停 | 计划 0.0 与风险表自身口径 | 改为“已选后端缺任一必需能力即停；未选后端延期不触发停止”。

- [B] `IMPLEMENTATION-PLAN.md:95`；`docs/modules/a:47-53` | P0 critical/rule gate 应阻塞，但模块文档又说 shadow 期全部不拦截 | `docs/09:680` 明定 critical unknown/conflicting ⇒ `gap_critical` | 明确只有模型维度的校准结果处于 shadow，P0 critical/rule gate 始终阻塞。

- [B] `IMPLEMENTATION-PLAN.md:99`；`docs/modules/c:50` | §14-A8 错配仍有残留：计划把 EffectGrant 全链称为 A8，模块把通用 presentation 状态机只引 A8 | `docs/09:688,693`：A2 是 presentation 状态机，A8 是六字段 E2 presentation | EffectGrant 改引 09 §2/§12-2，通用状态机引 A2，A8 只用于完整 E2 签名 presentation。

- [B] `docs/09:5,695`；`docs/modules/b:23` | A6 完整形态降 P1 未完整传播，仍出现“A6完整形态留 P0.5-A”及 deletion job=P0.5 | `docs/09:691` 已裁定 2.1 的 P0 形态即闭环、job/progress=P1 | 删除 A6 的 P0.5 前置表述，modules 同步为 P1。

- [B] `docs/modules/a:23` | G1 验证名仍写“非 owner 音频丢弃”，会复活当前不可实现的软过滤测试 | `IMPLEMENTATION-PLAN.md:43,45,73` 与 `docs/05 §4` 已统一为 PTT 窗口外/挂起态 | 改为 PTT 窗口外和挂起态不产生指令的测试名与断言。

- [B] `docs/modules/c:24` | 仍把完整 selected-adapter conformance 归 4.0，与修复后的计划倒置 | `IMPLEMENTATION-PLAN.md:105-106` | 同步为 4.0 脚本预检、4.1 完整 conformance/E2E。

- [B] `IMPLEMENTATION-PLAN.md:20,25`；`IMPL-PROMPT.md:5,9,23` | 交接要求本地 SayDo clone 已可用，但本轮实测 `~/WorkSpace/SayDo` 不是 Git 仓库，新会话会在 Phase -1 阻塞 | `git -C …/SayDo rev-parse` 本轮结果为 `SayDo: not a git repo`；远端仓是否存在、现有 key 是否有效均**未证实** | 发送 Prompt 前完成本地 clone 和基本 auth/smoke 证据，或明确授权新会话先自办 clone。

## [C]

- [C] `IMPL-PROMPT.md:41` | 声称计划只有三次 owner 场次，漏掉 P0.5-D 场次④ | `IMPLEMENTATION-PLAN.md:140` | 改为四场，并明确④是首发前真人验收。

- [C] `IMPL-PROMPT.md:17`；`IMPLEMENTATION-PLAN.md:61` | 仍写“不等裁决”“回写对接谈判”，但裁决已完成 | 计划头部与 Prompt 5/9 已声明 Hopper 裁决终稿完成 | 改成“用既定裁决验证现状/留 PoC 证据”，不再写谈判。

- [C] `docs/09:684` | 仍把路径二称为 Phase 5 | 当前计划路径二是 P0.5-B/D | 改成 P0.5 路径二阶段。

- [C] `docs/11:214` | 仍称现存 Demo 早于 UI 规范、Phase 5 要重刷 | `README.md:34` 与 `IMPLEMENTATION-PLAN.md:141` 均称 v5 已按 11 对齐 | 按实际截图核验后统一“已对齐”或列出真实待改项。

- [C] `IMPLEMENTATION-PLAN.md:3,90` | “SOL A3”与同文 §14-A3 重号，出处不唯一 | modules A5 只称 SOL A3 项，没有报告路径 | 改成完整评审文件路径和 finding 标识。

- [C] `docs/08:44`；`docs/09:697` | 08 总表仍写派生 `current_projection`，而 09 又声明已同步修正 | `docs/09:193` 明定 P0 不落该表 | 把 08 改为“账本重放出的内存投影”。

过度设计判断：**未发现确定性的新增低价值维护负担**；A6 独立删除 job 降 P1、v1 预建两张桥表、4.0 版本预检均有明确合同或安全收益。

统计：**A=6，B=20，C=6**。

本轮验证过的上一轮修复：

- §14-A8 错配：**部分成立**；P0.5-A 正确，计划 99 与模块 C5 仍残留。
- G1 三处口径：**计划三处及 docs/05 成立**；modules A2 测试名未同步。
- 0.3 v1 全集：**成立**；计划 59 与 09 的 v1 全集口径一致。
- 4.0/4.1 倒置：**计划正文成立**；modules C2 未同步，且 4.1→4.2 的 C5 依赖仍隐藏。
- baseline.2 状态：**交付/tag 存在成立，切锁 SHA 不成立**；commit 应为 `bdd1e548…`。
- 工期口径：**“单人串行”成立，30–38 数值不成立**。
- A6 完整形态降 P1：**计划与 09-A6 行成立，09 头尾及 modules B2 未同步**。
- `2.3→1.2b`：**方向成立但不充分**，还需 1.2 provider 及 B2/B4/B5 依赖。
- `2.4→{1.2,1.3b,2.1}`：**三条均成立但不充分**，还缺 1.3a，promote 路径需 2.3 或首个决策包。

无法读取的文件：**无**。
