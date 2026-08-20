# SayDo 评审回修对账(readback)与更新建议(2026-07-24 01:30)

> **性质**:对"另一会话按 `saydo-value-gaps-review.cursor.md`(R28)+ `saydo-product-value-and-gap-analysis-sol.md`(R29)实施的 canonical 回修"做**逐项取证对账**;非 canonical,供 owner 审阅。
> **对账基线**:R28 整合版评审(A 级 10 项 / B 级约 22 项 / C 级错误 E1–E23 / 过度设计 O1–O7 / owner 拍板题 10 个)。
> **取证纪律**:每个"[ok]"都来自本会话对当前文件的实际 Read/grep(标注 文件+章节),不采信实施方自述;本仓非 git,无 commit 可引,以 mtime + 内容为证。
> **并发披露**:对账进行中(01:02–01:12)对方会话仍在写入(docs/01/04/05/09/计划最后写于 01:06–01:08),我在写入静默 4 分钟后重读了全部受影响文件;若对方会话继续追加,本报告以 **01:12 快照**为准。
> **状态词**:[ok] 已落(有文本证据)/ [warn] 部分(缺什么写明)/ [fail] 未动 / [mixed] owner 裁决关闭(不再是缺口)。

---

## 0. TL;DR

**总判:这轮回修质量高——R28 的 10 个 A 级全部得到处理(8 个干净落地、2 个留下同步残留),安全四件套的落法甚至比我建议的更诚实(canary 标注"不可降级"、G4 证据按后端分行);同时吸收了 SOL 报告的多项好东西(承诺口径分档、价值证据轨、AcceptanceCheck 合同)。但回修本身又引入了 2 个新的不一致(N1/N2),且 B/C 级约有 20 项未动——这正是我上一轮警告的"文档漂移债动力学"在现场重演。建议:清完下面"批次一"(约半天文本量)后,正式宣布 docs 冻结、发 IMPL-PROMPT 开工;不要再开新的设计轮次。**

关键数字:A 级 **10/10 处理**(其中 2 项带残留);B 级 **8 落、3 项 owner 裁决关闭、11 未动**;C 级错误清单 **4 落、3 半、约 16 未动**;回修引入新问题 **2 个 B 级 + 5 个 C 级**。

**发 IMPL-PROMPT 前必须清的(批次一,合计约 0.5 天)**:

1. **[N2,A-]** 计划"分档"行与 IMPL-PROMPT [warn] 前置**都还没同步 Phase -1 D 的新事实**:D 段已改口"物理落地【未做】、是 0.5 的真实前置",但分档行仍写"可挂起(D 仅剩 Hopper 批次 A 排期)"、IMPL-PROMPT 前置清单仍只列"建仓/填模板/装 just/指定 dogfood 仓"——新会话按分档执行会跳过 D,首周 0.5 照样卡死。**这是 A6 修复自身的半拉子**。
2. **[N1,B]** 新增的 `reviewTask` 工具返回态 `"rejected"` 在 TaskCard 里**无此枚举、无状态边**(09 §13:623 vs §6.1 转换表/§9 status 枚举;§7 还把 Hopper 的 rejected 投影为 `failed`)——reject 的 Tier1 落态需要定死(建议对齐 §7 先例:`ready_for_review →(U:reject)→ failed`,或全链新增 `rejected` 枚举,二选一)。
3. **[C4/E13,B]** 审批 decision 词表三处不一致原样未动:04 §5.2"四动作"(无 reject) vs 09 §3 五值(respond 在 outcome 转换表**仍无出边**)vs §13 `approveAction` 只开 accept/reject(语音应有的 ignore 不可达)。0.2b 契约包就要编码它。
4. **[E22,B]** ADR-001 操作归属表仍写旧语义"改需求 = cancel + 重 drop(supersede 关联)",与 09 §6.1 新定的"缺省=同卡修订链(cancel_settled → queued,task 身份不变)"冲突——两份 canonical 打架,P0.5 前必须收口。

---

## 1. A 级对账台账(R28 §0/§7 的 10 项)

| # | R28 项 | 状态 | 证据(当前文件) | 残留 |
|---|---|---|---|---|
| A1 | **验收-返工循环三重断链**(三方独立命中) | [ok] | 09 §6.1 新增 `ready_for_review → running`(返工,Tier1=同 task 新 attempt 复用 worktree / Hopper=request_changes+retry)、`review_approved_waiting_merge → task_done`(人工合并 watcher+MergeProof)、全态取消边;§13 新增 `reviewTask`(带 expectedAttempt 防串)与 `retryTask`;§6.3 新增"返工/离开 ready_for_review 冻结"+ occurrenceKey 改 attempt 号;tier1_runs 补转换表与 attempt 规则(§9);10 新增 **#29b** 返工话术(P0);§12-10 补返工 dedupe 反例 | 衍生 N1(reject 落态);人工合并边的 MergeProof 用了 Hopper 术语描述 Tier1(N4,C) |
| A2 | **cursor 审批门完整性**(钩子自篡改/版本漂移/canary) | [ok] | 04 §6 新增"Tier 1 审批门完整性"bullet(决策走 daemon socket、gate 落 agent 不可写目录、canary=stream tool_call 无 hook 回调 ⇒ 立即 cancel、**"hooks.json 无法防删改,canary 是唯一不依赖 vendor 语义的兜底、不可降级"**、版本 pin);05 §4 Gate 0 G1 同款;计划 4.1 + 反例;IMPL-PROMPT 尾部"门完整性"三件套 | 无 |
| A3 | **daemon/控制台 API 无鉴权** | [ok] | 05 §4 G1:"每会话 capability token(SPA 注入+每请求/WS 握手校验)+ Host/Origin 白名单 + 防 DNS rebinding + 写工具主体绑定……否则恶意网页可绕语音授权直调 daemon";计划 4.1;09 §12-10"跨站/DNS-rebinding 无 token 调 daemon 被拒"反例 | 无 |
| A4 | **memory_events DDL 与判别联合脱节** | [ok] | 09 §9 加 `payload_json`/`generation` 列 + op CHECK + "op×payload 必填组合由 zod 层校验"注;§12-10 补 op×payload 反例与 TS↔DDL round-trip | 无 |
| A5 | **cancel_settled→superseded 自相矛盾** | [ok][warn] | 09 §6.1 拆为 `cancel_settled → queued`(同卡修订,尊重同仓串行)与 `→ superseded`(显式换卡);补 confirmed/queued 取消边 | **ADR-001 操作表未同步**(E22,批次一) |
| A6 | **Phase -1 D"均已完成"失实** | [ok][warn] | 计划 D 段改口:"物理落地【未做】……本会话实测均不存在;0.5 按 ADR 同机隔离红线须用锁定副本,D 是 0.5 的真实前置" | **分档行 + IMPL-PROMPT [warn] 未同步**(N2,批次一) |
| A7 | **IMPL-PROMPT 三律 vs 四律** | [ok] | IMPL-PROMPT 尾部已为四律(含 ④ 禁便车)+ 门完整性 | 无 |
| A8 | **claude_sdk 后端口径三处互斥 / 零 dogfood** | [ok][mixed] | owner v2.3① 拍板:Cursor CLI(Fable 5)过渡,Claude 订阅因**封号**推迟约 1 周购入(解释了 .env 里 ANTHROPIC key 为何不可用),live-steer 为"时限性已知缺口、接受";0.0(b) 顺延、4.0 改"selected-adapter 全链复验(不预设已冒烟)"、风险表重写为 selected-adapter 语义——三处口径已统一 | 提醒:订阅到位后 0.0(b)+4.0 复验是产品缺省后端就绪的硬门,dogfood 顺利不能替代(计划已如此写,执行时别跳) |
| A9 | **dogfood 评估门缺失**(三方命中) | [ok][mixed] | 05 新增"**价值证据轨**"(owner 2026-07-24 采方案 B:建议性零阻塞):双北极星 proxy(intent-to-treat)+ 零新建设 SQL 周报(返工率/接通率/自发选择率/无派单沉淀占比/车道占比等)+ 近零埋点(lane 标签/无效问题率)+ **review 检错仪式(植入已知缺陷)** + 诚实阅读纪律 + E1/E2 完整实验机器列 P1 触发项;计划场次② 挂周报 | owner 明确**不作 stop/go 门**——是有意决策,已记录,尊重 |
| A10 | **presentation 多 pending 不串**(P8) | [ok] | 09 §14-A2 补"P0 最小形态":`presentation={sentenceId, receiptId, invalidatedAt?}` + §12-3 两条 P0 反例(barge-in 后裸"好"不消费、**多 pending 不串**) | 无 |

## 2. B/C 级对账(按主题;只列判定与残留,证据可按需展开)

### 2.1 已落 [ok] (除 A 级外)

| 项 | 落点 |
|---|---|
| S2 verify oracle 内容冻结 | 04 §6(argv+脚本 digest 执行前重校,fail-closed)、05 G3(点出"不在 projectSnapshotDigest 内"的精确论证)、计划 4.1、§12-10 反例 |
| S4 setup postinstall 供应链 | 04 §6(缺省 `--ignore-scripts`,确需按 S2 上浮)、05 G4、计划 4.1、§12-10 |
| S5 cursor 非 shell 通道 | 05 G4(`egress=uncontrolled` 声明、禁 network_fetch 预授权、G4 证据按后端分行)、03 §5 能力矩阵注"仅 shell 通道可拦" |
| P5 评估器 critical claim 抽查 | 04 §2.2 新增第 5 条(owner 2026-07-24 拍板 P0):source 回读/quote 比对,不符 ⇒ conflicting→gap_critical;§3.2 反例 |
| C5 occurrenceKey 唯一口径 | 09 §6.3(Hopper=event_id / Tier1=questionId;ready_for_review/failed=attempt 号) |
| C6 outbox trigger 缺两值 | 09 §6.3 加 `parked_expired`/`subscription_stalled` + occurrenceKey 规则 |
| C8 tier1_runs 转换表/retryTask/blocked-failed 最小 proof | 09 §9 尾部三段全补 |
| E1/E2 cursor Tier1 文档漂移 | 03 §5 矩阵+Tier 定义已改;06 §5 术语表已改("按审批回调能力分") |
| E4 AGENTS canonical 范围 | 已改"01–10 + adr/" |
| E10 issueDispatchReceipt 重复 | 已删并注明 |
| E8 计划三处后端口径 | 已统一(见 A8) |
| E9 半 | 08 §6 设置页已改"五槽位模型配置" |

### 2.2 owner 裁决关闭 [mixed] (不再是缺口,记录口径)

| 项 | owner 裁决(出处) |
|---|---|
| P4 打字输入 / 无障碍 | **非目标(P0),不架构性封死**;文字轮次 P1 做时再开(05 §4 盲区表态)。注:话术 #8"屏幕上敲一下记热词"仍在 P0——其落点应是**设置页表单**而非对话文字轮次,建议加半句注明(C) |
| O2 控制台收敛 6 页 | **否决**:11 页全保留,纪律="每页须真实功能、禁空壳占位"(计划 v2.3② + Phase 5 头) |
| O1 dev-profile 特例链 vs Claude 订阅 | 语境更新:订阅因封号推迟 1 周,特例链是必要过渡(v2.3①);1 周后订阅到位可重估降级 |
| 应急车道 / 回叫聚合 | P1,各有 P0 兜底(Quick 对已奠基项目免重研究 / 通知优先级+输出仲裁)(05 §4/P1) |
| I3 工期数字 | 未调数字,但 05 P0 头加"不含回修/owner 场次/评审"限定;owner 姿态"不在乎工期"(v2.3②)——按 owner 决策记录 |

### 2.3 未动 [fail] (残留清单,建议归批次)

| 项 | 级别 | 一句话 | 建议批次 |
|---|---|---|---|
| C4/E13 decision 词表三处不一致 + respond 无出边 + approveAction 缺 ignore | B | 见 TL;DR-3 | **批次一** |
| E22 ADR 操作表旧 supersede 语义 | B | 见 TL;DR-4 | **批次一** |
| C7 投影条件洞("review∧settle 未通过"无行)+ 他端取消无 `running/blocked → cancel_settled(P)` 边 | B | 09 §7/§6.1 均未动;P0.5-B 前必须 | 批次二(P0.5-A 前) |
| C9 三子项:§0.1 矩阵缺 `tier1VerifyDigest` 行 / `payloadDigest` 签名域空引用 / `context_snapshots` 单主键撞 | B | 均未动;tier1VerifyDigest 是 P0 回叫安全根基,应随 0.2a | 批次二(Phase 0 前) |
| P2 排队话术 + 队列可见位 | B | 10 无;owner 多仓第一周必撞 | 批次二(Phase 4 前) |
| P3 采访预算耗尽收口话术 | B | 10 无;3.1"预算耗尽必停"停完说什么仍未定义 | 批次二(Phase 3 前) |
| P6 auto_low_impact 机械判定器 | B | 09 §4 写路径未动;投毒静默入 M1 的残余入口 | 批次二(Phase 2 前) |
| P7 TTS redaction golden 反例 + renderSpoken 过脱敏层 | B | 10 §6 未动 | 批次二(Phase 1 前) |
| I7 WS 契约 wire envelope(hello/version/ack/重连游标/关闭码) | B | 09 §10 未动;计划 1.2 要求"版本/重连"仍无 canonical 承载 | 批次二(Phase 1 前) |
| I4 ASR spike 种子来源/对比腿凭据/裁决阈值 | B | 计划 1.0 未动;OpenAI billing 问题下对比腿用什么 key 未定 | 批次二(Phase 1 前) |
| I5 自动快照备份 × hard-forget "backup" store 删不到 | B | 计划 0.1 与 09 §4 stores 均未动;owner 未答(原拍板题 7) | 批次二(2.1 前,owner 二选一) |
| I6 jq/just 进 Phase -1 B + 钩子脚本崩溃语义实测 | B | 未动;jq 是审批门安全关键依赖 | 批次二(Phase -1) |
| O3 billing-switch 收据最薄化 | B | 1.2b 未动;**四方共识项**,owner 未裁决(原拍板题遗漏) | 批次二(1.2b 前上浮一次) |
| S5 补验项:0.0(a) 未列"beforeReadFile/preToolUse deny 可靠性 + 内建 web 工具能否禁用" | C | 声明面已落,实测项缺 | 批次二(0.0 时顺做) |
| I8 dogfood bug 处理优先级(P0.5 期间) | C | 未动 | 批次三 |
| E5(10 #12 期标 P0 应为 P0.5)/ E6(research/README 对接 prompt v2→v4)/ E7(06 §1 未收录 codex 06–10 五份报告)/ E11(05 G1"软过滤"句 vs 计划诚实口径)/ E12(cost Money 币种)/ E14 半(10 #30 注未改引 09)/ E15(schema_migrations "v1=本表全集" vs 计划 0.3)/ E16(09 两处 "§11-2" 应为 §12-x)/ E18(gate0 enabled=false 语义)/ E19①②(IMPL-PROMPT"抄模板末尾 dev 块"已过时、"一项 owner 动作"实为多项)/ E20(计划 B 行漏 just/jq)/ E23(TaskView 本地态显示词 + #27 缺 Hopper cancel-new-run 分支) | C | 全部未动 | 批次三(一次攒批) |
| 其余 C:draft 老化、语音延迟分段预算表、evaluator 限流下 propose_start 降级姿态、商标检索留痕、语言边界一句(02)、02 §5.1"三处模型"→五槽位、P9 dev 隔离定性措辞、首发前近邻重扫入 P0.5 收尾 | C | 全部未动 | 批次三 |

## 3. 回修引入/暴露的新问题(N 系列)

| # | 级别 | 位置 | 问题 | 修法 |
|---|---|---|---|---|
| N1 | **B** | 09 §13:623 vs §6.1/§9/§7 | `reviewTask` 返回 `state:"rejected"`,但 TaskCard.status 枚举无 `rejected`、§6.1 无对应边;§7 先例是 Hopper rejected → 投影 `failed` | 定死 reject 落态:推荐 `ready_for_review →(U:reject)→ failed`(复用先例,failed 语义带"已打回终止"话术),reviewTask 返回改 `"failed"`;或全链加 `rejected` 枚举(状态表/DDL CHECK/投影/话术四处同步)。0.2b 前 |
| N2 | **A-** | 计划"分档"行:23 + IMPL-PROMPT [warn] | D 段已改"物理落地未做、0.5 真实前置",但分档行仍"可挂起(D 仅剩批次 A 排期)"、IMPL-PROMPT 发送前置仍未列 hopper-dist——新会话按分档会跳过 D | 分档行改"D 拆两半:物理落地=0.5 前置(Phase 0 内阻塞 0.5 行),批次 A=可挂起";IMPL-PROMPT [warn] 补一行 checkout/build/init 或明示"0.5 前 AI 可自行执行 D 落地(有 owner 授权)" |
| N3 | C | 04 §2.2-4 | 引用"05 §**值**证据轨 E2 轨",05 实际标题是"**价值**证据轨" | 改一字 |
| N4 | C | 09 §6.1 人工合并边 | `MergeProof{…treeSha 与批准 evidenceDigest 的 prospectiveTree 匹配}` 用 Hopper 术语(evidenceDigest/prospectiveTree)描述 Tier1 语义——Tier1 的对应物是 `Tier1SettleProof.treeSha` | 措辞按路径分写,防实施者去 Tier1 找不存在的 evidenceDigest |
| N5 | C | 10 #30 槽位注 | 仍自带"occurrence key=task_id+触发事件 event_id",09 §6.3 已改唯一口径(Hopper=event_id/Tier1=questionId)且声明"10 #30 引用此处" | #30 注改"见 09 §6.3" |
| N6 | C(流程) | history/PROCESS-JOURNAL.md | 实施轮(00:53–01:08 的 canonical 大规模回写 + owner 多项 2026-07-24 拍板)**未记 journal**(最后条目 R29);且按 AGENTS 轻量制度,"回写 canonical = 1 一致性 subagent + 攒批 Codex"的评审未见执行痕迹(codex-findings 无新文件) | 补 R30(或由该会话自记);本对账可充当"一致性评审"的半边,Codex 攒批仍欠 |
| N7 | C(未核) | demo v4 | README 称 demo v4(Soft Daylight 重刷+分期徽标),.playwright-mcp 01:01 有活动(推测已按 AGENTS 截图验证);本对账未逐元素核对 demo 与 08 §6 同步性 | 抽查一次或在批次三顺做 |

## 4. R28 十个 owner 拍板题的回收状态

| # | 拍板题 | 状态 |
|---|---|---|
| 1 | Claude 订阅/缺省后端 | [ok] 已拍板(v2.3①:Cursor 过渡、订阅 1 周后购入、live-steer 时限性缺口接受) |
| 2 | 返工循环 Tier1 语义 | [ok] 已拍板(同 task 新 attempt,09 §6.1) |
| 3 | 执行侧安全四件套 | [ok] 全落(04/05/计划/§12-10) |
| 4 | 控制台收敛 6 页 | [ok] 已拍板:**否决**(全量 11 页+禁空壳) |
| 5 | 工期 1.4× 校准 | [warn] 部分(05 加"不含…"限定;数字未动;owner"不在乎工期"——建议 P0.5 段也加同款限定,一行) |
| 6 | dogfood 评估门 | [ok] 已拍板(价值证据轨方案 B,建议性、不作 stop/go) |
| 7 | 自动备份砍/留 | [fail] 未答(I5 仍开着,2.1 前需二选一) |
| 8 | 文档冻结仪式 | [warn] 事实上清了一大批,但未宣布冻结;C 批未清、且本轮又新增 N 系列——**建议批次一清完即宣布冻结** |
| 9 | 三盲区+语言边界 | [ok] 盲区三项已表态入 05;[fail] 语言边界(中文优先)一句仍未写 |
| 10 | observedModel 官方端点放宽 | [fail] 未答(维持 Codex 09-A4 严格口径也可,建议显式记一句"维持"即可关题) |

## 5. 更新后的建议(合并优先级)

**批次一 · 发 IMPL-PROMPT 前(文本级,约 0.5 天;清完即可宣布 docs 冻结并开工)**
1. N2:计划分档行 + IMPL-PROMPT [warn] 补 hopper-dist 落地(A-);
2. N1:reviewTask reject 落态定死 + §6.1 补边 + §12 断言(B);
3. C4/E13:decision 词表三处统一 + respond 出边(B);
4. E22:ADR-001 操作表按"同卡修订缺省"回填(B);
5. N3/N5/E14:三处引用一字修(C,顺手);
6. 拍板题 7(备份)与 10(observedModel)各要一句话裁决,连同 O3(billing-switch 最薄化,四方共识)一并问掉——三题合计一分钟。

**批次二 · 对应 Phase 开始前(随实施节奏,约 1–1.5 天,可由实施会话按"先回写文档再改代码"纪律顺做)**
- Phase -1/0 前:I6(jq/just)、C9 三子项、E15;
- Phase 1 前:I7(WS wire envelope)、I4(ASR 种子/阈值/对比腿凭据)、P7(redaction golden);
- Phase 2 前:P6(auto_low_impact 机械判定)、I5(备份,按 owner 批次一裁决落地);
- Phase 3 前:P3(预算耗尽收口话术);
- Phase 4 前:P2(排队话术)、S5 补验项(0.0(a) 顺做);
- 1.2b 前:O3(按 owner 裁决落最薄形态或维持);
- P0.5-A 前:C7 两半(投影洞+他端取消边)、投影 7 词条话术(SA2-9)。

**批次三 · C 级攒批(0.5 天,可与批次二合并为一次 sweep)**
- E5/E6/E7/E11/E12/E16/E18/E19/E20/E23、02 五槽位(E9 半)、语言边界一句、draft 老化、延迟分段表、evaluator 限流姿态、商标留痕、近邻重扫入 P0.5 收尾、#8 热词落点半句、P9 措辞、N4 措辞、I8、N7 demo 抽查。

**流程债(不阻塞,但补上)**
- N6:实施轮补 journal(R30);本轮回写 canonical 的轻量评审欠"Codex 攒批"半边——本对账报告可作为一致性 subagent 半边的替代证据,Codex 攒批建议与批次一回修一起跑一次。

**保持项(质量高,别再动)**
- 价值证据轨(方案 B)、01 承诺口径分档、AcceptanceCheck 合同、04 审批门完整性/verify 冻结/setup --ignore-scripts、§6.3 投递语义诚实化、README 状态行诚实降级("设计/合同高准备度;工程待 Phase -1 硬前置")。
- 唯一执行期提醒:**Claude 订阅到位后,0.0(b) 四能力 + 4.0 复验是"产品缺省后端就绪"的硬门**——届时别因 cursor 路径 dogfood 顺利而省略;live-steer 体验(话术 #24)在那之前不存在于任何人的日用里,这是已接受的时限性缺口,发布叙事里别提前写。

## 6. 总评

这轮"评审→实施"的闭环本身运转良好:三方独立命中的重项(返工循环、dogfood 度量、安全旁路)全部落地,owner 在关键取舍上(后端过渡、控制台、价值门姿态、承诺口径)给出了明确且自洽的裁决。剩余工作全部是**文本级收尾**——没有任何一项需要重新设计。按批次一(半天)清完即可冻结开工;批次二/三可交给实施会话按既有"先回写再编码"纪律在各 Phase 前顺手完成,不必再组织专门的设计轮次。
