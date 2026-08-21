# 04 · 关键机制(Key Mechanisms)

> 本篇是设计核心:八个决定成败的机制。静态结构见 [03 · 架构](03-architecture.md);每条机制的出处与外部先例见 [06 · 参考资料](06-references.md)。

## 1. 分层记忆与项目奠基

**这是本产品区别于"ChatGPT 新窗口语音版"的根本。** 区分两个概念:**持久知识库**(以后所有对话都用得到,大、稳定)≠ **Context Pack**(单次会话临时拼接的小切片)。

### 1.1 四层记忆(M0–M3)

> 命名说明:记忆层记 **M0–M3**,审批风险层记 **S0–S3**(§5)——`research/` 与 `history/` 的旧文献里两者都写作 L0–L3,读旧文时按上下文区分,新文档一律用 M/S。

| 层 | 名称 | 存储 | 生命周期 | 内容 |
|---|---|---|---|---|
| M0 | 用户档案 | `~/.saydo/profile.md` | 跨项目、长期 | 偏好、技术栈、沟通风格、术语热词(顺带提升 ASR 准确率) |
| M1 | 项目知识底座 | `<workspace>/.saydo/knowledge/` | 项目级、长期稳定 | 目标/背景/约束、代码库理解(架构/模块/术语)、关键决策、领域知识 |
| M2 | 累积对话知识 | 产物库 `artifacts` | 项目级、随对话增长 | 每次对话新生成的方案/决策、新调研的资料(版本化、可检索) |
| M3 | 会话工作记忆 | Context Window + 转写 | 单次会话 | 最近 N 轮、当前任务 |

**Context Pack = 检索器从 M0+M1+M2 挑相关切片 + M3,拼进窗口**(重建会话时 1.5k–3k token,带版本号,校验 HEAD/task 版本失配则重取)。**已知缺口**:Context Pack 目前只有材料清单,缺一份确定性的编译契约(来源优先级、冲突/否定/撤销规则、各层 token 预算、编译版本与 pack digest、canonical intent 账本)——实施前须按 `../research/codex-findings/01-architecture-redteam.md` §4.2 与 `03-voice-memory-tech.md` §4.3.4 补齐 ContextCompiler/IntentLedger 定义。

### 1.2 项目奠基:先备后答,持续深化

- **首次奠基是阻塞式的**:全新项目先把知识底座建到"足够"才实质开聊——宁可让用户等,不空脑袋硬答(owner 拍板:首轮质量优先于即时响应)。
- **奠基不是一次性的**:对话中若判断 context 不足,AI 有权暂停回答、先补背景("这个我得先补点背景,稍等"),且允许**超出当次提问范围**地前瞻性攒料。
- **等待必须透明**:「学习中」是一等状态——说清在学什么、进度、还要多久,让等待可理解、可信赖。
- **会话预热(每次,轻)**:加载 M1 + 按话题增量准备;代码变更以 `git diff` 为**种子**增量刷新——完整实现须覆盖 working tree/untracked/rename/rebase、依赖闭包与原子 generation 切换(奠基产物带 foundation manifest,刷新失败保留旧 generation,详见 `../research/codex-findings/03-voice-memory-tech.md` §3.2–§3.3),不能按"diff 到哪改哪"的字面实现。
- **生态互通**:奠基时反向吸收既有 AGENTS.md / CLAUDE.md / .cursor/rules;输出侧在 AGENTS.md 放幂等指针块指向知识库(AGENTS.md 已是 30+ 工具的事实标准,不互通则用户换工具时知识库价值归零)。

### 1.3 生长闭环与生命周期治理(行业头号翻车点)

生长(新产物写 M2)→ 提炼(会话末把稳定重要的蒸馏进 M1)→ 失效(git diff 标记过期部分增量重建)→ 索引(FTS5 起步)→ **人可编辑**(M1 是本地 Markdown,人可直接改,AI 尊重)。

只有"生长"没有"遗忘"会让知识库越长越脏,治理机制:**失效标记而非删除**(bi-temporal)、读取期衰减、后台 consolidation(去重/合并/降权)、`/doctor` 式审计;软删除 + 宽限期,**硬删两种触发:合规要求,或已认证用户显式"忘掉这个"**(都要从 FTS/向量/缓存/摘要/源快照正文(09 §4.1)真正清除并留 tombstone;**自动快照备份是不可变整体文件,P0 不做备份内逐条清除——靠保留期到期整份过期闭合,并如实告知**,owner 2026-07-24 拍板,09 §4 备份例外)。非代码知识(M2)不随 git 变,其陈旧靠时间衰减 + 矛盾检测 + 用户纠正。P0 起即用**可重放的 append-only 记忆事件账本**派生当前视图,而非直接改文件(P0 的最小可信记忆范围见 05 §4)。

**原始音频单列**:raw 音频/声纹/转写按敏感度分级——原始音频默认**不写入 M1/M2**、短保留期后删除;转写与录音分别征求同意;供应商侧可控数据(训练 opt-out)在接入时配置。

### 1.4 记忆首先是安全边界(Codex 红队结论,升为 P0 安全项)

持久记忆的头号风险不是陈旧,而是 **provenance + 投毒 + 跨项目泄漏**:仓库/网页/上传资料/会议参与者都可能污染候选记忆,"自动提炼 + 静默沉淀"会把一次 prompt injection 固化成未来所有项目的行动依据。写路径必须是:

```
raw evidence(不可信)→ candidate(带来源/引文/信任级/有效期)→ 冲突/taint/policy 检查
→ 低影响的项目本地事实可自动入库;偏好/决策/外部事实需人或 reviewer 批准 → trusted
```

硬规则:**第三方内容永远不能定义"用户喜欢什么/允许什么/凭据在哪"**(M0 只能由用户自己的行为写);检索期做 taint 过滤;删除要传播(连带 embedding/摘要/提炼;备份走保留期过期,09 §4 备份例外)。

**代码事实的真相源边界**(避免绝对化误读):源码与 Git 是代码事实的**最终权威**;M1 可以保存带 provenance 的**派生理解**(架构图/模块导航/术语),但派生物不作为行动依据的终点——执行前对关键代码事实 agentic grep/live 复核;LLM 只能提名 consolidation/失效候选。Markdown 投影与 SQLite 索引均可从账本重建,账本是记忆域的真相源。

## 2. 采访、就绪决断与决策包

### 2.1 采访纪律

AI 主导提问(播客 Host 采访 Guest 的范式,同行产品 InfiniSynapse 实证):带着预研结论问("我看报表页已有分页但没有导出,这个导出是给财务对账还是用户下载?"),**一次一问、选择题优先**(每题 2–5 个互斥选项 + 推荐项——语音场景里让用户说"第二个"比组织一段描述容易一个数量级);选题按覆盖扫描 + Impact × Uncertainty 排序;**停止策略放代码层**(问题预算 + 边际收益;**"值得问"的机械定义(SOL §9.3):一个问题只有在会改变 outcome / scope / acceptance / 风险授权级 / 执行路径,或消除一个阻塞 propose 的 critical unknown 时才值得问,否则从预算删除**——"无效问题率"作为核心度量),不放 prompt;风格/审美类隐性需求用视觉参考图代替语言(全行业弱点)。

### 2.2 就绪自省:从"双维"到可校准的证据账本

每轮回答结束,Brain 调 `assess_readiness` 自省"够不够开始"。基础判定是**双维**——知识充分度(奠基 + 调研够不够支撑实施)AND 需求明确度(类型模板就绪清单)——**缺哪维补哪维**:知识不够 → 主动学习(learning);需求不够 → 定向采访;都够 → 出决策包。

**评估分两层**(成本与延迟工程,也是 07 D18 BYOA 经济性的前提):**规则层**每轮末跑(纯规则扫证据账本:critical 项状态/覆盖缺口,零模型成本);**异族深评层**只在规则层判"可能就绪"以及 `propose_start` 之前触发(每会话次数 ≈ 1–3 次,低频)——异族 evaluator 模型只在深评层出场。

Codex 对抗审查指出双维"太粗、无量表、无校准",实施时按以下升级(设计约束,分期落地):

1. 扩为**四维**:+ 可执行性(环境/权限/依赖/预算)+ 可验证性(有没有验收 oracle);
2. 每维是**证据账本**(每条 claim 带状态/来源/置信度/是否 critical),不是模型自报分数;**任一 critical 项 unknown/conflicting 直接不就绪**,不能被低权重项平均掉;**空账本 fail-closed(R-A 2026-07-26,场次① B1 实测漏洞回填)**:账本的 critical 项**不是模型临场产出、而是从类型就绪清单机械派生的固定骨架**——每个类型模板的就绪清单项(02 §5:coding 的目标/验收标准/范围…;writing 的核心论点/读者/文体…)在会话开始即实例化为一条 critical claim,初值 `state=unknown`,由采访/调研逐步填成 verified;**因此"零 claims / 空账本"在合法实现里不可能出现,若出现即 = 骨架未装配的实现 bug,规则层必须判 `gap_critical`(fail-closed),绝不空真放行**(实测:owner 一句话零采访,dims 恒空被判 ready 凭空出决策包——根因是生产 dims 未从清单派生,09 §13 补构造义务;机械承载 = 09 §13 `readinessSkeleton(type, projectEvidence, lane)` contracts 单源纯函数,会话绑定装配 / assessReadiness / proposeStart 复用,Codex 21 A3)。**覆盖判定的机械语义(A3-armed 2026-07-28 定稿,09 §13 covered 块)**:骨架项从 unknown 变 verified 的唯一路径 = 账本候选绑定(remember 带 readinessKey,来源完整性四闸)→ **复述确认升格**(daemon 机械渲染绑定内容,用户封闭确认 → ReadinessBinding 一等实体)——Brain 单方记账(candidate)不算覆盖,编造内容在复述时刻暴露给用户本人(人在环防线);证据带版本(checklistDigest/evidenceDigest 随包绑定),撤销在派发事务内权威复核(readiness_stale 拒);**规则层判定全程零模型成本、机械可重放**,深评层对带 key 绑定做纵深抽查(A5-armed,生产装配后续批);
3. 停止条件不是"能完美实施"(会奖励无止境追问),而是"剩余不确定性低于本次风险预算,且再问一个问题的预期收益 < 用户负担";
4. **校准回路**:先 shadow mode 记录判定分数 vs 结局(接受/小改/推翻),积累 false-ready 率后按项目类型和风险层校准阈值(Devin 公开过此曲线,绿灯 PR 合并率约为红灯 2 倍)。**诚实纪律**:少量正常任务(如 20 个)不能宣称 false-ready `<1%`——达标判定需扩样 replay corpus(P1,05 §值证据轨 E2 轨),dogfood 顺利 ≠ 就绪已校准。
5. **critical claim source 回读抽查(P0,owner 2026-07-24 拍板)**:深评层对每条 critical claim 按 `SourceRef` 回读原文(quote 比对 / repo 现读),不一致 ⇒ 该 claim 置 `conflicting` → `gap_critical`。细分口径以 09 §4.1 合同为准:源在快照后变化(stale)是**不可消费中间态**——重新快照重验成功产新 fresh verification 才进通过谓词,重验不可达 ⇒ unknown → gap_critical,新快照仍不符 ⇒ conflicting → gap_critical;原始维度(integrity/freshness/quoteMatch/semanticSupport)独立持久化,critical-support 资格纯函数派生。抵御"证据账本被上游写歪"(奠基污染 → claim 标 verified → 评估器照单全收——异族只防同模型偏好、不防污染换入口);深评每会话仅 1–3 次,抽查成本可控。反例入 09 §12-11 与实施计划 3.2(篡改 claim 状态但 source 不符 ⇒ gap_critical);09 §13 `assessReadiness` 语义补此抽查义务。

### 2.3 防"相关错误链"(整个方案最危险的结构性风险)

同一个 Brain 产事实、判缺口、做 Demo、再自评"够不够"——这些错误**高度相关而非相互校验**:被污染的奠基 → 错误事实进 Context Pack → 按错事实采访 → 同一模型判 ready → 生成看似合理的 Demo → 用户因具体预览产生自动化偏信 → 轻确认 → 无人值守执行。Demo 和轻确认在这条链上**不是护栏**。

真正独立的护栏必须**换信息源或换判定机制**:机械事实检查、独立 evaluator(只读证据、不读 Brain 的自辩)、版本化验收契约、OS 沙箱、独立 verify、高风险点人工签署。→ 设计约束:**readiness 判定与生成/执行解耦**。(evaluator"读禁闭"的供给资格与唯一例外——本机开发 `profile="dev"` 双开关、结果标 `evaluator_isolation="unproven"`——见 07 D18/09 §11;dev 放宽的是本节防错链强度,审批安全链 Gate 0/S3/收据不动。)

### 2.4 决策包(Decision Package)

就绪时 `propose_start` 端出三件套 + 一问:

1. **成果预览**:做完你会得到什么(一句话 + 要点);
2. **实施计划**:分几步、每步**显式标注 AI 执行 vs 需要人配合**(给凭据/线下动作/对外拍板/找资源单列,不假装全自动);确认后即为 dispatch 内容;
3. **Demo**(可能的话):轻量 HTML 预览"最终长什么样"(mock 数据、可抛弃、生成便宜);非 UI 类用报告样章/方案一页纸/流程图;
4. **"要不要现在就开始?一口气跑完,还是每步问你?"**——拍板时同时选**执行模式**(§5.4 两档:直达验收 / 逐步确认);AI 按任务风险与预计确认次数给推荐档("这个任务大约要确认 5 次"),推荐只是建议,切档永远人做。

工程要求:**计划落盘为可编辑 artifact**(用户可直接改而非对话反复修正,批准版本固化为"合同");**Demo 与最终实现同源**(至少同一份数据结构/文案,Demo 元素与计划条目编号互引)——否则会发生"确认了 Demo、实现却不一样"的信任损耗。

**canonical schema**:决策包/预授权/收据的可签署合同已定义于 [09 · 数据契约](09-data-contracts.md) §2–§3(Draft v0.9,随 Hopper 对接裁决回填)——授权绑定的每一项(scope/副作用/预算)都是用户**看得到/听得到**的字段("所闻即所签");原始字段依据见 `../research/codex-findings/04-interaction-product.md` §3.2–§3.5。

### 2.5 就绪 ≠ 授权:两把钥匙

**认识判断(Epistemic:证据够了)**和**治理授权(Authority:有权的人批准了这个 package + scope + 副作用 + 预算 + 有效期)**是两个独立字段/状态转换。多人会议里"大家听起来都同意"不能代替授权;授权 token 绑定 package hash + 环境 + 预算 + 有效期;执行中发现新 scope 或 critical 假设错误,暂停并给 Plan Delta 请求重授权。

**两类审批、两个 owner,不共用一个 `approved=true`**:①"批准 dispatch 这个决策包"(对话域,daemon 采集、落 `approvals`);②"运行中批准某个具体副作用"(执行域,Hopper `DecisionRequest` 为真相源)。审批凭据是 digest 绑定、单次消费的 receipt,执行点复验。

## 3. 语音会话经济学

- 会话是**短命、事件驱动**的:建会话(注入 Context Pack)→ 对话若干轮 → 派发/答疑完成 → 空闲 45 秒或人说"去吧" → 挂起(零成本)。任务在后台照跑。
- **成本事实**(经 Codex 核实官方计价):Realtime 连接/带宽不收费、VAD 过滤空输入,"静默期烧钱"不成立;真正的成本点是**每次 Response 重带整个 conversation,后续 turn 越来越贵**——所以要短会话 + 及时挂起 + Context Pack 压缩。挂起阈值 45 秒的理由是隐私/功耗/占麦(阈值本身是实验参数)。
- **在当前代表性用量组合下,成本大头预计来自 foundation/调研/agent 执行/独立验证/失败重试而非语音 I/O**(S2S 与级联的差距也只是约 5–6 倍的工程估算,非数量级)——这是估算不是产品常量,任务很短/语音很长/模型组合不同时可能反转,**以真实 usage trace 决策**。因此要建**全链成本账本**:project → 决策包 estimate(expected/p95/max)→ dispatch budget → run actual。
- 供应商会话上限(OpenAI 60 分钟 / Gemini 15 分钟)是**必须架构绕开的边界**:四类状态里 AudioSession 可丢,Conversation/Task/Memory 状态不可丢,重建时注入小 Context Pack 无缝续接。
- 挂起后"对空气说话唤醒"在 P0 **不存在**(WebRTC 已断,没人在听);唤醒动作是点击/通知/推送;本地唤醒词是 P2 特性。回叫重建会话依赖页面仍开着且已授权麦克风,不满足则自动降级通知链路。

## 4. 回叫策略

**先定状态词,防"假完成"**(全套文档统一,这是状态机硬约束而非文案):

| 状态词 | 含义 | 允许的口播 |
|---|---|---|
| `run.completed` | runner 进程退出(闸门/产物可能还没 settle) | **不对用户播"完成"** |
| `ready_for_review` | 验收闸门跑完、产物落盘确认,等人验收 | "执行和检查都跑完了,等你验收"(全套统一此措辞,绝不说"做完了") |
| `task.done` | 人验收 + 合并/归档后 | "这件事交付了" |

回叫由 `ready_for_review` 等**settle 后**的状态触发,不由原始事件直接触发:候选事件 → 状态/产物对账(settle barrier)→ durable callback outbox → 回叫(重放幂等、重启只叫一次)。

```
事件优先级:blocked(等人)> failed > approval_request > ready_for_review > progress(默认不通知)
升级链:  控制台在线 → 语音回叫(重建会话,Brain 亲口播报,30s 无应答挂断)
        → 桌面通知 + ntfy 手机推送 → blocked 且仍无应答 → 电话(P1)
移动端:  PushKit 唤醒 + CallKit 来电式语音汇报(见 03 §8)
免打扰:  静音窗口内只推送不出声;blocked/failed 在窗口结束后立即补叫
```

> **实现注记(2026-08-20 S2,评审 1 返工)**:L0 三要素 = 该任务所属项目有 console peer 在线 ∧ pipeline TTS 健康 ∧ 该 session **没有在途用户轮**(`LiveDialog.hasUserTurnInFlight`;开口留下的 `currentUserTurn` 不算 busy)。busy 按候选条目各自 session 判:该 session 头一条 queue,同 session 其余降 L1;其它空闲 session 仍可 L0。无语音条件直接 L1。桌面通知 = OS provider(macOS=`osascript display notification`;Windows=toast;失败同构降 ntfy,设计 ADR-004 / 工程 ADR-003)。DND 窗口内对 **pending 与 requeued** 只推低优先级 ntfy 一次并 snooze,不语音不桌面;去重靠 `snoozed_until`,审计 `callback.dnd_pushed` 只留痕。`micHeldByMeeting` 无数据源,恒 `false`(下方「会议占麦」是目标语义,S2 未接)。电话 L2 未做,`escalation` 上限 1。resolution-timeout 只把 acked 写成 `requeued`,投递成功才 `notified`。L0 30s 应答窗相对 15s sweep 最坏约 45s。

- **PagerDuty 式状态机**:`pending → notified(level n) → ack'd → resolved`;ack 只停止升级、**不等于解决、更不等于授权任何动作**,resolution timeout 到期未处理**重新升级**(防"接了电话又睡");urgency 两档(验收=低 / 卡住审批=高);电话层 DTMF 只做 `ack / snooze / 拒绝`,**不做任何副作用审批**(见 §5.2 远程通道)。
- **拦截 ≠ 叫人**(直达验收档语义;逐步确认档下 S2 直接上浮,不做双拦截缓冲):危险动作先把原因反馈给 agent 让它换路,同一意图被拦 ≥ 2 次才进回叫链——可把回叫频率降一个数量级。事件优先级与升级链**不随执行模式变**,模式只改变哪些事件会成为 approval_request(§5.4)。
- **输出仲裁**:语音会话进行中,新播报不插播、排队到收尾;检测到麦克风被会议软件(Zoom 等)占用则跳过语音、降级通知——完工播报不打断你开会。

## 5. 审批与安全

### 5.1 风险分级(S0–S3,按效果计算而非动作名)

语音是弱认证通道(在场任何人都能说话、ASR 有误听率),审批权按风险分级。**分级由效果计算**:`effect × 目标(圈内/圈外)× 触及数据敏感度 × 身份/凭据 × 触发的下游(CI/部署)× 成本`——下表的例子只是**典型缺省**,同一动作会因效果升级(读 `.env`/客户数据 → 升 S2+;装带 postinstall 脚本的依赖、push 会触发预览部署的分支 → 升 S2/S3):

| 级别 | 典型例子(缺省,可被效果升级) | 审批方式 |
|---|---|---|
| S0 读(不触敏感数据) | 读代码、只读命令 | 自动放行 |
| S1 写(worktree 内) | 改代码、跑测试、本地 commit | 自动放行 |
| S2 出圈但可逆 | 装依赖、push 到 feature 分支 | 逐步确认档:语音确认;直达验收档:命中决策包声明并念出的预授权清单则放行(收据照落、执行点复验),未命中则拒绝反馈 agent 换路(§5.4) |
| S3 不可逆/外部影响 | force push、合 main、部署、花钱、删数据、对外发消息 | **必须已认证屏幕点击 / OS 生物识别 / passkey(与执行模式无关)** |

**S3 语音绝不放行**(含复述短语):同一麦克风、同一 ASR 的复述**不构成独立认证因子**(录音/旁人/合成语音都绕得过,NIST SP 800-63B 也不允许声纹作认证);语音只能"导航到审批卡 + 朗读将发生什么 + 留痕用户在场"。合并动作属 S3,永远由人触发——**"人触发"的精确语义(R-A 2026-07-26 拍板 WebAuthn 形态后收窄)= 人在屏幕上完成一次强认证(WebAuthn platform authenticator:Touch ID/passkey,`authStrength=os_biometric`)签发一张单次消费的 S3 收据,daemon 凭收据执行合并**(收据 = 09 §3.3 `S3MergeReceipt` 判别型,普通屏幕收据不构成,Codex 21 A1);这与"人自己去终端 `git merge`"是同一"人触发"语义的两种落地(前者 Tier1 缺省,后者 = 无 passkey 时的降级人工交接,§5 合并链见 09 §3.3/§6.1/§13)。daemon 无收据不得自发合并;WebAuthn 断言在 daemon 本地校验(challenge-response,防重放),不是"语音批 merge"的换皮。

**双维风险语义(owner 2026-07-24 拍板 X3,Hopper 反馈 §2.1)**:路径二存在**两套正交的风险维度,取交集、互不替代**——
- **effect 维(SayDo 的 S0–S3)**:上表,由 Brain 事前预测 + SayDo 侧闸门执行;Hopper **运行中对 effect 零约束**(sandbox 恒 workspace-write、Bash 全开、网络类 S3 外发无拦截、post-run 不检),所以"路径二只授权 S0/S1"的唯一执行者是我们自己。
- **content 维(Hopper triage 的 low/medium/high)**:按**正文关键词**算(auth/billing/security 词 → securityish;migration/ci/deploy/删数据 → high-danger;命中即 medium/high),不读 frontmatter 且会覆盖写回。它改变**执行路径**:medium 不被 daemon 自动执行(需显式 run/drain),high 的 ready 任务**无自动执行入口**(SayDo 投影为 blocked 类,话术=改卡降险或转 Tier 1,09 §7)。
- **推论两条,写死**:① **Hopper 判 low 不是 effect 安全背书**(词表窄,"上传产物+发通知"正文无命中词照样 low 直跑,效果在人看到前已不可逆)——effect 闸门永不因 content=low 而松;② content=high 也不因 effect≤S1 而放——**bridge 自动 retry 前必须重读投影 risk,high 不自动 retry**(`hopper retry` 本身不查风险白名单,直连执行;分诊 blocked 的恢复只走 re-drop→unblock,不走 retry,09 §6.2 retry 闸门)。

### 5.2 审批工程

- **中断点落盘可恢复**(daemon 重启不丢审批,LangGraph interrupt 范式);**超时有默认终局、绝不悬挂**,按档位分叉:直达验收档 = 默认拒绝(agent 换路);逐步确认档 = 转 blocked 停靠等人(免打扰窗口结束补叫)——该档承诺"没问过我就不出圈也不改道",默认拒绝后 agent 自寻绕路反而违背用户选这档的动机。schema 四动作 accept/edit/respond/ignore(语音只给 accept/ignore,屏幕开放 edit)。
- **所闻即所签**:审批绑定 digest(可朗读摘要 + digest 绑完整 payload)、单次消费、执行前重校(借 OctoDesk EffectIntent / Hopper DecisionRequest 设计);直达验收档的类级预授权收据带约束参数(白名单/目标分支),实例消费仍落单次子收据。
- **审批卡必带项目/任务上下文**(多项目并行时的必填字段,防"批了个不知道谁家的 S2")。
- **远程通道**:手机/电话默认**只读**(听汇报);远程下发指令需已配对设备 + PIN/推送确认,且封顶 S2;电话 DTMF 只做 ack/snooze/拒绝,**不做批准**(口述 PIN 不算强认证);S3 永远只走已认证屏幕。

### 5.3 执行沙箱(诚实声明)

Codex 有 OS 级沙箱(可硬禁网);Claude/Cursor 本地是**策略级**拦截(白名单挡已知工具调用,非网络栈隔离)。P0 接受策略级 + worktree 隔离为默认;不信任任务可选容器 / `sandbox-exec` 加固;`--yolo` / `--dangerously-skip-permissions` 一律禁止裸机使用。

**verify 命令白名单(命令注入防护)**:编排器跑的验证命令**只能从项目预登记模板选**(package.json scripts / justfile / 配置登记),Brain 只能选模板、不能自由拼装——否则 ASR 误听或幻觉即可注入 `rm -rf` 级命令,绕过一切沙箱。执行套与 agent 同级沙箱,命令原文以文字推送留痕。

### 5.4 执行模式:两档(直达验收 / 逐步确认)

**执行模式是 dispatch 参数,不是安全参数**——它只调"运行中审批姿态与确认点密度",作用域三处:审批服务对 S2 的打扰姿态(C5)、回叫引擎的确认点密度(C4)、以及 Tier 2 下的 dispatch 拓扑(逐步确认 = 步序循环,由执行客户端 C2 承载)。以下**模式不变量**任何档位不得触碰:effect-based 风险计算、S3 屏幕强认证、三熔断阈值、verify 白名单、Plan Delta 重授权、回叫优先级序、状态词纪律、两把钥匙、Gate 0(直达验收档不豁免任何一项)。

| 档 | 语义 | 仍然会叫人的事件 |
|---|---|---|
| **直达验收**(口语:"一口气跑完") | 拍板即授权整包:决策包**逐项声明并念出**本任务预计的 S2 效果类(装依赖/推 feature 分支等),随 package digest 签署;运行中命中清单的 S2 自动放行(落 preauthorized 收据),未命中/被效果升级的拒绝并反馈 agent 换路(同一意图被拦 ≥2 次才叫);派单纪律附加"能自决则自决并记入 decisions[]" | S3、真 blocked、failed、熔断触发、Plan Delta、ready_for_review——**这六类永远叫人,与档位无关** |
| **逐步确认**(口语:"每步问我/盯着点") | 每个出圈动作(S2)前置确认 + 计划步骤边界确认(多 run 任务);agent 提问即时上浮,不做自决兜底;S0/S1 任何档都不确认(worktree 已兜底,确认它们纯烧注意力预算) | 同左 + 每个 S2 + 每个步骤边界(步骤边界确认属 approval_request 类事件,不属 progress) |

- **预授权范围永远属于决策包、由用户听到并签署;模式只是这份清单的启用开关**——否则"切到全自动"就成了一句话扩权通道(所闻即所签)。
- **预授权清单纪律**:① **无约束参数的效果类不可预授权**("装依赖"必须带 registry/包名单约束、"push"必须带目标分支模式)——清单由安全策略引擎从计划推导,不由 Brain 自由声明;② 清单 **> 3 项时强制屏幕同显**(或建议改逐步确认档),语音念"类别 + 关键约束"、digest 绑全量参数,防念读橡皮图章化;③ **每包重新生成并念出,无项目级模板继承**(项目级默认只限档位,不含清单)。
- **拍板 UI/话术纪律(防旁路)**:预选位**永远等于生效默认**(项目默认,出厂=逐步确认);AI 的推荐只以徽章 + 一句理由呈现,**不占预选位**;确认句保持中性二选一("一口气跑完,还是每步问你?"),不得演化为"我推荐 X,好吗?"的是/否偏置;**用户不置可否时按逐步确认执行**。理由:生成计划的模型不能同时决定"要不要盯着它"的缺省答案(§2.3 相关错误链)。
- **Tier 映射**:Tier 1(交互回调型运行时,如 Claude SDK)两档共用 adapter,差异全在审批回调裁决策略,永不使用 bypassPermissions;Tier 2(预授权型运行时,**按运行时能力探测,不按型号**——含经 Hopper 的批式路径)直达验收 = 预授权清单编译成后端配置 + 沙箱兜底,逐步确认 = **步序循环**(计划切步、每步一个 dispatch、步末 settle→汇报→确认→续跑;Brain 如实说明"这个后端只能每步结束时问你,不能动作瞬间拦")。
- **路径二 P0 红线(Codex 审查裁决 + Hopper 反馈 §2.1 证实)**:批式路径运行中**没有拦截点、没有执行点复验**(Hopper 侧源码核实:对 effect 维零执行点约束)——在 Hopper 提供 effect enforcement 之前,**路径二 P0 只允许 S0/S1 效果**;需要 S2 的任务要么走 Tier 1(真实回调),要么在每个 S2 前切步停靠,**不得用"预授权清单编译成宽权限配置"冒充执行点校验**;**Hopper content-risk 判 low 不减免本红线**(§5.1 双维语义)。契约测试须含反例:未知 S2、目标分支变化、postinstall、CI 触发、过期/重复收据、package revision 漂移、Gate 0 未关、**risk=high 的自动 retry、分诊 blocked 走 retry 恢复**——全部必须拒绝;此反例集登记为 P0.5 对接验收项(计划 P0.5-B)。
- **模式 × 后端支持矩阵(§14-A7,owner 拍板 2026-07-23,canonical)**(模式是正交参数,后端按能力应答 supported/degraded/unsupported,不静默换档也不静默换后端):

| 模式 \ 后端 | Tier 1(SDK 薄执行器,轻任务) | Hopper 批式(重任务,P0.5) |
|---|---|---|
| 逐步确认(出厂默认) | [ok] 步骤边界停靠 = 同一 SDK session 内暂停续跑(09 §9);S2 逐个上浮 | [fail] **unsupported(首发)**:批式流水线无步序停靠点——拍板时如实说明,给两个显式选项:任务够轻改走 Tier 1,否则改直达验收;**步序循环形态(计划切步、每步一 dispatch)P1 再评**,动作级确认待 Hopper M3b |
| 直达验收 | [ok] 预授权清单随包念读签署,S2 命中清单经回调复验自动放行 | [ok] P0.5 主形态;**route=hopper 预授权恒空(仅 S0/S1,上文红线)**,S2/S3 到验收/合并环节人工 |
| 运行中切档 | 降档立即生效;升档需重念清单重签(下条) | **cancel-new-run**:取消本轮 + 修订重跑,Brain 如实说明"这轮作废" |
- **步骤边界确认的话术样例**(逐步确认档的主体体验):"第 2 步跑完了——{one_liner 摘要}。继续第 3 步吗?"(30 秒无应答 → 转 blocked 停靠,按 §4 升级链叫人;免打扰窗口结束补叫)。
- **默认档:逐步确认**(默认收紧,对冲自动化偏信;"信任毕业制"已被否决)。选择位置:项目级默认 + 决策包拍板时单次覆盖;运行中降档(收紧)随时生效(口语:"盯紧点"),升档 = 扩大预授权、需重新念清单(封顶 S2,语音可批;口语:"剩下的一口气跑完");模式与预授权清单进 package digest 与留痕链;切档入口在任务详情页与"改需求"并列。
- **命名纪律**:UI 与话术不用"全自动"(对外承诺过头——S3 与验收永远在人手里);AI 复述固定为"一口气跑到等你验收",不跟读用户口中的"做完";对非技术用户可说"一口气跑到等你确认"。逐步确认的推荐话术带一句"改代码、跑测试不会问你"(防被理解为每步都吵)。

## 6. 执行可靠性

- **隔离**:每任务一个 git worktree(主工作区永不被 agent 碰);每仓库注册 setup 命令(装依赖,**缺省 `--ignore-scripts`——lifecycle/postinstall 属供应链执行面,确需时按 S2 上浮**,05 §4 Gate 0),重型仓库可降级单 worktree 串行;同仓任务串行、跨仓并行。**verify 执行前重校 dispatch 时冻结的 argv + 脚本内容 digest(`package.json`/`Justfile` 是 agent 可写),不符 ⇒ 闸门 fail-closed,防被验代码改 test 自证通过(05 §4 独立 oracle 门)。**
- **Tier 1 审批门完整性(cursor_cli 后端)**:审批决策走 daemon socket(非 worktree 内文件)、gate 逻辑落 agent 不可写目录;**canary**——从 cursor stream-json 取顶层 `tool_call` 事件与已收 hook 回调对账,出现 tool_call 却无回调 ⇒ 立即 cancel + 结果作废 + 告警(hooks.json 本体必须在可写的 `.cursor/` 内,无法防删改,canary 是唯一不依赖 vendor 语义的兜底,**不可降级**);`cursor-agent` 版本 pin + 变更重跑门禁(比照 Hopper 锁 SHA)。
- **三熔断**(防无人值守烧钱):墙钟上限(默认 45 分钟,**计活跃执行时间,审批/提问停靠期停表**——否则逐步确认档必然撞墙钟)+ 回合数上限 + token/成本上限,任一触发 → cancel → 带上下文进 blocked 叫人。熔断阈值与执行模式无关(预算来自决策包 cost 上限)。**停靠期另设老化上限**(默认 72h 无应答 → 取消并转草稿卡,可配置——停靠占着 worktree 与同仓队列,不能无限悬挂);长停靠恢复时**强制复验预授权收据有效期**(过期 → 降为逐项确认,不静默放行)+ 重跑 delivery preflight。"15 分钟无事件"只能抓挂死,抓不住"活跃地兜圈烧钱",故三者缺一不可。**诚实注记(路径二 P0,2026-07-24 更新)**:经 Hopper 的批式路径运行中只有超时 + 桶级预算 gate(无 per-task 预算字段、无回合数熔断),三熔断完整形态待对接裁决。**per-task 成本归因可闭环**(Hopper 反馈 §2.3):dispatch_binding 已知 taskId↔runId,逐 run 读 `hopper show --json` 的 `last_run_cost`(批次 A/baseline.2)按 taskId 累加,不需 Hopper 改;**「codex 成本恒 unknown」已过时**——Hopper V7b 起 codex 按 token×单价表**估算** USD(订阅下=等价 API 成本估算、非真实账单,仅未登记模型才 known:false),话术用"估算成本/订阅额度内",unknown 时才显示"未知"、永不显示 ¥0。**订阅供给例外(07 D18)**:经订阅 CLI 的调用不产生"元"——记账 `source='subscription'`,呈现"订阅额度内(已用 N 次)"而非"未知"或 ¥0;其熔断用已有的墙钟 + 回合数维度兜底(maxCost 只约束 api 计费部分),订阅限流事件按 D18 纪律 3 停下询问、不静默转计费。
- **"隔夜交活" = 两层结构,不是超长单 run**:单 attempt 保留 45 分钟 backstop;上层是**带 deadline 的 workflow**(总时长/总成本/最大 attempts/最大无进展次数),把大任务切 step、每步边界做 durable checkpoint、失败按类型重派(transient 自动重试 / deterministic 禁止盲重试 / ambiguous 先对账)、deadline 前预留 review 预算。此层对应 Hopper M3d(未实现)——就绪前"隔夜交活"诚实表述为"**离席后台执行到某个 review 点**"。
- **Delivery preflight**:dispatch 前检查电源/睡眠/网络/磁盘/额度/CLI 登录/secret/仓库状态/回调通道——把会导致夜间早停的问题在人离开前暴露,而不是凌晨 1 点回叫。
- **启动对账**:daemon 重启后扫描,`running` 但 PID 不存在的任务 → interrupted → 按 `native_session_id` resume,恢复不了降级叫人;任务运行期持有电源断言(`caffeinate`,仅插电可靠)。
- **恢复健壮性**:自持久化 (task, adapter, session_id, cwd, 事件游标) 映射表,不只信 agent 端 resume(Claude 会话按 cwd 哈希存、跨目录 resume 会失败);原生 resume 失败 → 降级"摘要 + diff 注入新会话"(Anthropic 文档明说更稳)。
- **合并不是终点,冲突是常态**:`ready_for_review`(人验收)→ `merging`(rebase/merge main + **重跑 verify** → 合并)→ `task.done` / `merge_failed`(→ agent 解冲突,或降级开 PR 移交人工)。**合并段按类型执行合同(R-A 2026-07-26 收窄旧口径)**:非 coding 类型**缺省**无测试型 verify、以内容评审收尾;但 **writing 窄版例外**——owner 拍板 worktree 交付(09 §6.1a),文章稿在 worktree 内写、评审通过后同样走 `merging`(rebase + treeSha 断言,verify=内容评审 gate 而非测试)经 §5.1 S3 卡合并回主分支。即"有无 merging"由类型执行合同定,不再是"coding 独占"。

## 7. 摘要器:事件流 → 口播

一次 30 分钟 run 产生几百条事件、几万 token diff,**任何时候都不塞给 Brain**。两级工作:统计走纯规则(文件数/测试通过率/当前步骤,免费实时);叙事走廉价文本模型(仅 ready_for_review/failed/blocked 或人索要时惰性生成)。三层产物:

1. **one_liner**:"改了 5 个文件,测试 12/12 过,1 个待确认决策"(回叫播报);
2. **walkthrough**:150 字口语稿(人说"讲讲"时);
3. **decisions[]**:agent 自主做的、人可能想推翻的决策清单("日期格式选了 ISO 8601")——语音交互里最有价值的部分。

## 8. 产物沉淀与主动巡检

- **统一产物库(M2)全程写入**:对话里生成的方案、调研抓到的资料、agent 产出实时落库;版本化(同一逻辑产物留全版本、带 lineage/supersedes,控制台可看时间线与版本 diff)、可检索、可召回注入 Context Pack("上次那版定价调研再给我看看");默认本地存储,导出(含任意子集导出)需显式动作。
- **主动巡检(P2)**:daemon 定期对注册 repo 跑只读巡检(TODO/失败 CI/lint/过期依赖),产**草稿任务卡**(具体到项目 + 缺口 + 建议)不执行;下次开麦时 Brain 顺带汇报,人一句"批准"转正式任务。巡检只读、只产草稿、不自动提权。
