# A3-armed 设计方案:就绪门证据绑定语义(covered 判定)v1.2 定稿

> 轮次:A3-armed 设计批(重制度)。作者:设计库会话,2026-07-28。
> 评审链:v1.0 → 双 subagent(产品一致性 × 架构安全,6A/8B)→ v1.1 → Codex 23(5A/7B/3C,报告
> `research/codex-findings/23-a3-armed-design-review.md`)→ **v1.2 定稿(本文)**。
> 所有 A 级全部吸收;triage 裁决记 §7。定稿后落 canonical 并同批实施。
> 前情:Codex 22 把 A3 列为 R-A ready 翻转的最后 A 级条件;owner 首日 dogfood 真实复现
> "零采访出包 + 编造调研内容"(journal R54 补记二)。

## 0. 问题、目标与威胁模型

**问题**:readinessSkeleton 机制链(单源骨架/fail-closed/readinessRef)已随 W4 实施,但 `evidence.covered` 的判定语义是 canonical 留白——生产未 armed,`proposeStart` 对空账本照常出包,且 Brain 可编造"调研结论"填充包体。

**目标**:covered 的机械判定 + 证据版本 + 撤销线性化 + 生产武装,使"采访不足 ⇒ 机械出不了包"与"编造内容 ⇒ 无法成为覆盖证据"都成为系统保证。fail-closed 方向恒定。

**威胁模型(v1.2 关闭编造缝)**:v1.1 的机械四闸只证明"有一个用户轮",不证明 claim 与用户话语一致、更不证明 claim 满足该 key(Codex 23 A-1)。v1.2 的关闭方式不是深评前置,而是**人在环:覆盖成立以"复述确认升格"为准**——Brain 编造的候选绑定必须经 daemon 机械渲染、用户亲耳听到复述并封闭确认才算覆盖;编造内容在复述时刻暴露给用户本人。深评抽查(A5-armed)降级为纵深而非前置。

## 1. 核心机制:候选绑定 → 复述确认升格 → covered

### 1.1 三态覆盖模型

每个就绪清单 key 的覆盖状态:**none →(remember 带 key)→ candidate →(复述确认环)→ confirmed**。

- **candidate(候选绑定)**:采访中用户陈述某项,Brain 调 `remember({..., readinessKey})` 落账本。四个**来源完整性闸**(fail-closed,违任一拒):
  1. key ∈ 会话锚定项目类型的清单词表(contracts `READINESS_CHECKLISTS` 单源;词表外/类型不符拒);
  2. source 由 daemon 从 ToolContext 自取(kind=user_utterance、ref=当前 turnId;Brain 无 source 入参)——daemon 校验该 turn 属于本会话、存在用户转写(speaker=user ∧ heard=true);
  3. trust 参数 ∈ {user_stated}(**候选一律 user_stated;`user_approved` 不再是 Brain 可自报的值**——它只能由确认环产生,Codex 23 A-1-4);
  4. projectId 由 daemon 从会话锚定项目自取(忽略 Brain 自报)。
  [warn] 命名纪律:这四闸是"来源完整性闸",**不是人背书证明**(candidate 不算 covered)。
- **confirmed(确认绑定)**:Brain 采访完调 `confirmReadiness` 工具 → daemon 从账本**机械渲染**复述清单(renderReadinessChecklist:逐 key "「{label}:{claim 原文}」",Brain 不得改写,同 10 #12 grant 清单先例)→ TTS 播复述 + 屏幕上卡 → 用户封闭肯定词确认(复用既有 confirm 环机制,新 kind=readiness)→ daemon 在确认事务内把这批候选升格:每 key 落一条 **ReadinessBinding**(一等实体,见 §1.2),trust 记 user_approved(daemon 确认流程产生,绑确认收据)。
  - 聚合确认:一次环可升格多 key(采访完一次复述全部;quick 车道同——lane 只影响话术密度,不豁免确认,每 key 仍独立成绑定);
  - 用户否认/修正 ⇒ 本环作废,Brain 按修正重新 remember 候选 → 再确认;
  - **covered(projectId) = 现役 confirmed 绑定的 key 集**。candidate 不计(骨架 state=unknown,话术可播"记了还没跟你核对")。

### 1.2 ReadinessBinding(一等实体,新表;Codex 23 A-1-1/B-5)

```
readiness_bindings:
  id, project_id, key, axis,            -- axis 冗余自清单(knowledge/requirement)
  mem_id, claim_digest,                 -- 绑定时点的 claim 指纹(同 key 换证可测)
  snapshot_id,                          -- 确认时捕获/引用的转写快照(§4.1 SourceSnapshot 链;非裸 digest)
  receipt_id,                           -- 确认收据(user_approved 的机械承载)
  session_id, turn_id,                  -- 确认发生轮(审计)
  foundation_generation,                -- 仅 knowledge 轴填:奠基换代 ⇒ 绑定失效(§1.4)
  bound_at, superseded_at, superseded_by
```

- **同 key 再确认 ⇒ 旧绑定自动 superseded**(daemon 确认事务内机械做,不靠 prompt 纪律;Codex 23 A-2-5);
- **现役判定**:未 superseded ∧ 底层 claim 现役(未 forget/invalidate/supersede/过期——按账本 active 投影全枚举,不只 forget)∧(knowledge 轴)foundation_generation 现役;
- hard-forget 联动:清 binding 行与 snapshot link(§4.1 隐私纪律沿用);audit 只留索引字段不留正文。

### 1.3 证据版本与撤销传导(Codex 23 A-2/A-3)

- **provider 返回结构化证据**(非裸 key 集):`ReadinessEvidence { checklistDigest, bindings: [{key, memId, claimDigest, bindingId}] }`(排序确定);`evidenceDigest = jcs(bindings)`;
- **assessment 行持久化 `checklist_digest + evidence_digest`;readinessRef 扩为 `{assessmentId, dimsDigest, checklistDigest, evidenceDigest, verdict}`**,随包入 digest(§0.1 签名域同步);
- **权威现势复核放在 `dispatchApprovedPackage` 的 SQLite 事务内**(与收据消费/包 approve/task 创建原子):从**当前类型完整清单**重新生成 skeleton + 现读 evidence,比对 checklistDigest/evidenceDigest/per-key state;任何漂移(forget 的 verified→unknown、新增覆盖、同 key 换证 claimDigest 变、清单增删改)⇒ 不消费收据、不 approve、不建 task,返回 `readiness_stale`(结构化 reason:evidence_changed/checklist_changed/type_changed/provider_error),**收据置终态 voided_by_evidence_change 不可补发**;
- `issueDispatchReceipt` 保留同规则**预检**(尽早反馈),但非权威点;
- 序列化语义:forget 先提交 ⇒ dispatch 复核失败;dispatch 先提交 ⇒ 后续 forget 不追溯已启动任务(验收环/Plan Delta 兜底)——09 明示;
- covered 三消费点(会话绑定装配 / assessReadiness / proposeStart)现算不缓存。

### 1.4 knowledge 轴的时效(SA1-B4 + Codex 23 A-5-4 定死)

- **requirement 轴**绑定不随奠基换代失效(用户亲述需求与代码无关);
- **knowledge 轴**(`codebase_understood`/`thesis_material`/`style_ref` 等)绑定携带 `foundation_generation`,**奠基换代 ⇒ 自动失效回 unknown**(理解对象已变);同一奠基代内跨任务复用(不每单重确认——确认摩擦仅在换代后重现);
- `codebase_understood` 确认话术 = 仪式句:Brain 播报奠基结论要点 → 用户确认(经确认环升格)。

### 1.5 armed 语义收口(Codex 22 ②④ + 23 A-5/B-6)

- **生产恒 armed**:composition root 注入真实 provider 且**类型 required、缺失 fail-fast 拒启执行面**(高层);低层 gate 保留 optional 依赖仅用于"错误组装也 fail-closed 落 gap_critical 行"的防御测试(B-6 分层);
- 删除 skeletonGate null 旁路与 assessReadiness `ready,dims:[]` 回退;
- **回退口径 = fail-closed 维护,不提供 unarmed 回退**(unarmed 即重开本批要关的 A 级洞):门误拦 ⇒ 处方是引导重绑(§1.7);门实现 bug ⇒ hotfix;
- provider throw / dispatch 事务内 provider 失败 ⇒ gap_critical / readiness_stale(provider_error),不 fail-open。

### 1.6 门拒绝集与 verdict 语义(SA1-A1 + Codex 23 B-4)

- 新增同源纯函数 **`isReadinessBlocking(verdict) = (verdict === "gap_critical")`**,rules/deep/propose/issue/dispatch 五处统一调用(不再散落 `verdict !== "ready"`);
- `gap_knowledge/gap_requirement` = **可播报建议态**(非 critical 缺口),不阻塞组包/拍板;话术:"关键项都齐了,还有 {N} 项建议缺口({labels}),不妨碍先出提案";
- critical 项 unknown/conflicting ⇒ gap_critical(既有);confirmed 才算 verified(candidate=unknown);
- [warn] 09 现文"ready=false 一律拒组包"句收窄为"gap_critical 拒组包"——**产品语义变更,汇报向 owner 显式声明**(回归 02 §5 critical=阻塞/非 critical=建议的设计意图)。

### 1.7 pending 与存量激活(Codex 23 A-4 选项②/A-5)

- **pending 最小清单**(READINESS_CHECKLISTS 加 `pending` 词表):`type_intent`(这是件什么类型的事,critical)+ `rough_goal`(粗目标,critical)。pending 包**照常产版本化 readinessRef**(绑 pending checklistDigest)——"proposed 起 ref 必填"合同保持无例外;覆盖同走候选→确认升格;
- promote 转正 ⇒ 类型清单换 ⇒ checklistDigest 变 ⇒ 旧 pending 包拍板/派发时 `readiness_stale(checklist_changed)` ⇒ 重新采访(新类型清单)重组包——(a) 案体验保留(pending 可出首提案),ref 语义完整,机械闭环;
- #10 话术 pending 变体:"先立项——{type_intent}、目标 {rough_goal}。要往下推进我再逐项确认细节"(不得用普通包"我评估过了可以开始"句式);
- **存量项目激活**:历史零 key ⇒ 全 unknown(fail-closed 正确)。处方 = **引导重绑**:Brain 从 Context Pack 读旧事实 → 复述发起确认环 → 升格(机制天然支持,无迁移工具;禁止 Brain 自动 backfill);激活前跑存量盘点(active 项目 × 缺失 critical key 清单)交 owner;
- 两步上线:先 additive(schema/写路径/instructions/观测)真实 keyed 采访 dogfood;再原子开硬门 + 删旁路。

### 1.8 Brain 采访引导单源(Codex 21 B3)

`buildInstructions(type, coveredStates)` 由类型清单生成采访段(同一 READINESS_CHECKLISTS 单源),**每轮组装现算**(promote 后自然刷新):清单 key+label+三态、候选→确认纪律("用户亲口给出 ⇒ remember 带 key;采访齐 ⇒ confirmReadiness 发起复述;绝不替用户补内容")。pending 注入定型引导。消双源:instructions 不再手写清单文字。

### 1.9 会话↔项目绑定装配(Codex 23 B-1)

第三消费点定义为"**每次 session↔project 绑定建立或变更**":created / rebuilt(daemon 重启后重建)/ promoteProject 成功 / reanchor·项目切换(未来写口在合同列明唯一钩子)。装配幂等(重复调用只落新评估行)。

## 2. canonical 变更清单(v1.2 全量;含 Codex 23 B-2 补漏)

| 文件 | 变更 |
|---|---|
| 09 §0.1 | readinessRef 扩 checklistDigest/evidenceDigest:producer/签名域/verifier/失败动作 |
| 09 §1 | 绑定来源轮约束(同 session、speaker=user、heard=true、turn locator) |
| 09 §2 | proposed ref 必填(pending 亦然,绑 pending 清单)——去例外 |
| 09 §4 | MemoryEvent add payload 加 readinessKey?(候选);active 投影枚举句(invalidate/forget/supersede/expiry);readiness 撤销传导句 |
| 09 §4.1 | ReadinessBinding↔SourceSnapshot 链;hard-forget 联动;深评抽查=纵深(A5-armed 留白如实) |
| 09 §5 | 三个"claim"辨析注(MemoryClaim/骨架 dim/绑定) |
| 09 §9 | readiness_bindings DDL(v13)+ assessments 加两 digest 列 + payload_json 映射更新 |
| 09 §11 | (若本批深评不接生产)调用律不变,附 A5-armed 注 |
| 09 §12 | §12-15 扩(§4 反例全集)+ 回挂 §12-1(digest)/§12-4(记忆失效)/§12-11(语义谓词留 A5) |
| 09 §13 | remember 四闸 + confirmReadiness 工具合同 + covered 三态 + isReadinessBlocking 门语义(改"ready=false 一律拒"句)+ pending 清单 + 拍板/派发双点(预检+事务权威)+ 收据终态 + quick 句收敛 |
| 02 §5 | 词表单源声明 + critical=阻塞/非 critical=建议门语义 + pending 最小清单 |
| 04 §2.2 | 分层更新:规则层=确认绑定现算;深评=纵深抽查(A5-armed) |
| 06 §5 | 词条:readinessKey(四闸)/ReadinessBinding/readinessArmed(注:armed=硬门接线≠语义校准完成)/confirmReadiness;readinessSkeleton 词条扩 |
| 10 | 复述确认环话术(聚合句式/否认修正/两环差异:信息确认≠授权确认);缺口播报;readiness_stale 重提议;codebase_understood 仪式句;pending #10 变体;存量引导重绑话术 |
| 11 | 就绪复述确认卡(屏幕面)+ pending 提案卡变体 |
| modules/a-dialogue.md | A2 会话绑定装配钩子;A5 就绪评估三态;A6 ref 必填口径 |
| modules/b-memory.md | B2 绑定失效规则(active 枚举+knowledge 轴 generation) |
| IMPLEMENTATION-PLAN-2.md | A3 状态与本批入口 |

## 3. 实施变更清单(SayDo,三段提交)

**段1 additive 基础(零破坏)**:contracts(ReadinessBinding/ReadinessEvidence/pending 清单/结构化 dims{key,label,axis,critical,state}(B-3:text 派生,digest 签结构)/isReadinessBlocking);v13 迁移(readiness_bindings 表 + assessments 两 digest 列);remember 四闸候选;confirmReadiness 工具 + renderReadinessChecklist + confirm 环新 kind + 升格事务(含同 key supersede);provider readinessEvidenceFromLedger;audit。
**段2 armed 生效**:index required 注入(fail-fast);readinessRef 扩双 digest 入包 digest;issue 预检 + dispatch 事务权威复核(readiness_stale + 收据终态);pending 清单接骨架(豁免删除);promote/rebuilt 重装配;buildInstructions 每轮现算;e2e 主链插入"采访→候选→确认→propose"轮。
**段3 收口**:删 null 旁路/删 ready,dims:[] 回退(低层留 optional 防御测试);W1.4 深评测试组入口迁移(显式构造);全量测试适配;§12-15 反例全集;存量盘点脚本跑一次交 owner。

## 4. 反例清单(§12-15;Codex 23 B-7 全吸收)

来源完整性:词表外/类型不符/pending 词表外 key 拒;turnId 无用户转写拒;trust 传 user_approved 拒(只能确认环产);Brain 自报 projectId 被忽略。
确认升格:candidate 不算 covered(critical 全 candidate 仍 gap_critical);复述确认后 confirmed=verified;用户否认 ⇒ 环作废零升格;user_approved 无确认收据的绑定不可能存在(构造性断言);同一轮/无关轮刷多个 candidate 也拦在确认环(用户听复述会否认)。
证据版本:同 key 换证(forget A + add B + 再确认)⇒ claimDigest 变 ⇒ 旧包 dispatch `readiness_stale`;双 active 冲突 ⇒ unknown;invalidate/supersede/expiry 各一例(不只 forget);清单 add/remove/改 critical/改 axis ⇒ checklistDigest 变 ⇒ stale。
线性化:issue 预检过 → forget → 用户确认 → dispatch 事务拦 + 收据终态不可补发;dispatch 先提交 → forget 不追溯;dispatch 事务内 provider throw ⇒ 拒。
armed:provider 未注入 fail-fast(高层)/gap_critical 落行(低层防御);ready,dims:[] 路径不存在断言;重启重建 covered 一致。
门语义:critical 全 confirmed + 非 critical 空 ⇒ gap_knowledge/gap_requirement ⇒ propose/拍板放行(建议态);gap_critical 拒。
pending/生命周期:pending 包带 pending-checklist ref;promote 后旧包 stale(checklist_changed)重组包;pending 会话零采访 ⇒ 无普通 ready 话术(行为级);promote/rebuilt 后重装配落行;knowledge 轴 generation bump ⇒ 回 unknown,requirement 轴不动;存量零 key 项目 ⇒ 全 unknown + 引导重绑成功一例。

## 5. 分期边界(本轮不做)

深评生产装配武装(A5-armed:双谓词 semanticSupport ∧ claimSatisfiesReadinessKey 抽查带 key 绑定——本轮交付其全部机械输入:binding/snapshot/digest);network_fetch 真调研(R-C);奠基自动覆盖 knowledge 项(恒不做,确认环是唯一升格路径);语义匹配式 covered(恒不做);research/marketing 门禁开值。

## 6. 值报观察(C-1)

readiness_stale 结构化 reason 计数、重提议率、确认环否认率(错绑率代理)、存量重绑进度;不落 claim/转写正文。

## 7. triage 裁决记录(Codex 23 → v1.2)

| Codex 23 | 裁决 | 落点 |
|---|---|---|
| A-1 语义缝 | 采纳修法5(人在环复述确认升格,替代深评前置)+修法4(user_approved 只能确认环产) | §1.1/1.2 |
| A-2 证据版本 | 全采纳(结构化 evidence/双 digest/一等绑定/同 key supersede/active 全枚举) | §1.2/1.3 |
| A-3 线性化 | 全采纳(dispatch 事务权威复核/收据终态/两向序列化) | §1.3 |
| A-4 pending | 采纳选项②(最小清单+版本化 ref;不拆新实体——复用现机制,合同无例外) | §1.7 |
| A-5 回退/存量 | 全采纳(fail-closed 维护/两步上线/引导重绑/generation 定死) | §1.4/1.5/1.7 |
| B-1..B-7 | 全采纳 | §1.9/§2/B-3 结构化 dims/§1.6/§1.2 snapshot/§1.5 分层/§4 |
| 开放点 1-4 | 按 Codex 裁决落文(来源完整性闸命名/owner 声明/版本化词表/quick 同源) | §1.1/1.6/1.3/1.1 |
| SA 双评 | v1.1 已吸收,v1.2 保留(话术聚合/06 词条/§12 互引/深评谓词留 A5) | §2/10 行 |
