# 用途:把下面整段 prompt 复制到 Hopper 项目的 AI 会话里

> 背景:SayDo(原名 VoiceLoop)执行层已决策"复用 Hopper 现状、锁版本、不等待、双路径"(见 `~/WorkSpace/voice-coding/docs/adr/ADR-001-execution-layer.md`)。本 prompt 让 Hopper 侧 AI 逐项裁决对接需求并产出契约草案。
> 版本:v4(2026-07-23)。v3 经 Codex 源码实读;v4 经 4 subagent 对抗评审(Hopper 现状核对=准确度高 / 契约完整性 / 边界安全 / Hopper 维护者视角=约 1.5 轮可出货)修订:补 drop→执行触发合同、修承诺区危险措辞("CAS 预检"非原子)、全部改绝对路径、加输出分级、预写 P0-C 的 M3b 通道可选答案、请求 Hopper 真实状态枚举。
> 分隔线以下是要粘贴的完整内容(自包含)。**注意:粘进 Hopper 会话后 cwd 是 Hopper 仓库,Hopper 自己也有同名的 `docs/09-*` 文件,故本 prompt 内 SayDo 侧文件一律用绝对路径。**

---

# SayDo(原 VoiceLoop)↔ Hopper 对接需求(请逐项裁决并出契约草案)

## 背景(一分钟)

我在做 **SayDo**(仓库 `github.com/Octo-o-o-o/SayDo`;设计文档在 `~/WorkSpace/voice-coding/`):"对话优先于指令"的语音高级助手——用户只管和 AI 聊,AI 研究透项目、采访式问清需求,就绪后给决策包(成果预览 + 计划 + Demo)请用户拍板;确认后派本地 agent 后台执行,**跑到"等验收"状态后回叫用户**(我方状态词纪律:runner 退出 ≠ 完成,merge 后才是 done)。**重任务执行层已决策复用 Hopper 现状流水线**(drop→triage→compile→调度→worktree→执行→verification→acceptance→review→merge),把 Hopper 当外部系统、锁版本对接,不等平台化。SayDo 侧自建"控制面桥"(事件消费/回叫/审批收据/对账)。

**时间关系(重要,决定你的排期)**:SayDo 首发交付**包含接你的路径**(owner 已定:首发做完整,双路径都在第一次交付范围内)。开发顺序上我方 Tier 1 本地路径先行(不依赖你,约 3–4 周),**桥接阶段等你的契约落地即接上**。所以——**裁决(17 项)我现在就要**(在我关键路径上);**契约的"实现"有约 3–4 周落地窗口**(= 我方 Tier 1 开发期),可排进你现有 lane,但不是"无限期"。我最急需先拿到的最小裁决集见文末"请你输出"第一档。

产品语义补充:SayDo 派发有**两档执行模式**——「直达验收」(拍板时把预计的出圈动作作为受约束的**预授权 EffectGrant 清单**念给用户签署)与「逐步确认」(每个出圈动作/步骤边界停下问人)。**我方已自我设限:在你提供 effect enforcement(M3b 方向)之前,经你执行的路径只授权 S0/S1 级效果(worktree 内读写);S2/S3 级(装依赖、push 等——按你 `decision.ts` 的分级,push 属 S3)一律走我方 Tier 1 路径,P0.5 期间不经你放行**(切步停靠是 P1 升级项,别按多 dispatch 切步形态做你的容量/契约设计)——所以下面不含"让你现在实现运行中 effect broker"。

两个项目都是我的,**不需要单方迁就**:按"两个项目整体最优"评审,你认为不该 Hopper 做的直说并给替代方案;凡我把你现状说错的,直接纠正。

## 请先读(都在本机)

- 你自己的(cwd 内相对路径):`docs/01-specification.md`、`docs/11`+`docs/12`(Console——**注意:第 13 项指你已存在的 Console localhost 路由**,如 `/api/status`、`/api/events?after=`、`/api/stream`、`/api/review/...`,不是规格 §17 的 Obsidian Companion API)、`docs/SCHEMA-FREEZE-M3A.md`(里程碑口径:**M3b=command/executor+decision enforcement,M3c=usage accounting,M3d=workflow,WS4=Console/decision/notification surface**)、交付完整性批次(以 `src/delivery/` + schemas 为准,merge 锚点 `9cc835d`)。
- SayDo 侧(**绝对路径,别读成你自己的同名文件**):`~/WorkSpace/voice-coding/docs/adr/ADR-001-execution-layer.md`、`~/WorkSpace/voice-coding/docs/09-data-contracts.md`(合同草案,含 EffectGrant/DispatchBinding/收据——**逐字段批注只需覆盖"跨边界字段":digest 算法、S0–S3 与你 `decision.ts` 分级的对齐、constraints↔未来 M3b EffectGrant 语义;`spokenForm`/念读模板等授权 UX 内部件不必批**)、`~/WorkSpace/voice-coding/docs/05-roadmap.md` §3。**注意:09 §7 的投影表目前只是部分枚举映射,全枚举映射待你第 3 项给出真实状态词后重写(其 §14-A4 已登记);其余以其 §14 为准。**
- 第三方审计(绝对路径):`~/WorkSpace/voice-coding/research/codex-findings/02-hopper-integration.md`(基线 `c4c29c6`,与 `ea3fb31` 生产代码无差)——可直接反驳。

## SayDo 的对接原则(我方承诺;标注"现在可执行"与"裁决落地前过渡形态")

- **[可执行]** 只读消费 `events.jsonl`(byte cursor、容忍半行/截断、**绝不**自行清理 corrupt 行)或你的只读 API;绝不写 event/frontmatter;
- **[过渡形态]** 写只走官方入口;**现状 CLI 无 origin/receipt/first-wins**——这些是下面请求的新合同。落地前我方以"**非原子状态预检 + 提交后对账收敛**"运行,**并自认这是 TOCTOU 窗口:它只降低冲突概率、不能阻止他端翻转,因此不构成第 6 项 first-wins 可被降级/不做的理由**;
- **[可执行]** 锁定完整 commit SHA(现状无 tag,是否打归你),独立安装副本 + 专用 vault 运行;bridge 启动断言:落地前 = 对副本自算 commit/schema 文件 hash,第 11 项握手落地后 = 运行时查询;升级跑契约测试;
- **[可执行]** 不 import 内部模块、不共库、不共数据库;**[过渡形态]** artifacts 版本化读口是第 14 项(P1),落地前对锁定 SHA 的既知布局只读访问、升级即失效;
- **[目标态]** review/merge 真相源永远是 Hopper 状态机。两种情形分开处理:**预检发现你侧已有终局决策 ⇒ 不提交、本地收据标 `voided_by_conflict`、永不重试**;**对账发现我方提交在窗口期覆盖了你侧决策 ⇒ 以你侧状态机为准、告警留痕**(此危险形态在第 6 项 first-wins 落地前无法根除);
- **[可执行]** 成本 unknown 显示"未知"不显示 ¥0;调用频率/退避遵守**第 9 项及你在"请你输出"第 7 条给出的约束**。

## 需求清单(请逐项裁决:现状已有 / 微调 / 新增 / 不做+替代)

> 我方对你现状的理解已尽力核实(标注在各项);理解错了请直接纠正。

### P0-A · dispatch 与映射

1. **drop 契约**:字段映射(标题/目标/验收标准/约束/runner 建议)+ **DispatchBinding**(`voice_task_id ↔ dispatch_id ↔ hopper project/task/revision(number)/run ↔ package_id/revision/digest ↔ mode ↔ vault_id`,承载字段可以是 Task Card 附加区或 sidecar,由你定;**注意:`effect_grant_digest` 在 P0.5 恒空(route=hopper 时预授权清单必为空,见背景自限),不入 binding,除非作为 M3b enforcement 预留位——请裁决**);**外部 dispatch 幂等 key**(现状按 id→content_hash→source_path 三级去重——业务幂等不能靠 body dedup,授权变而正文同的 re-drop 必须可区分);**四种 drop outcome**(created/updated_draft/new_revision/duplicate_ignored)机器可读返回与处理协议;预算上限字段(现状无,预期裁决"新增或 P1")。
2. **project 登记、preflight 与执行触发**:`link-project` 参数契约;**dispatch 前回读 project 配置快照**(repo/default_branch/runner/trusted verification)读取口(纳入 package digest);`workspace ↔ Hopper project ↔ vault` 映射与所有权;**专用 vault** 初始化方式;**【执行触发合同(最关键,别漏)】**:drop 成功后任务如何从 queued 进入 running?——你 daemon 是否自动认领(策略/风险范围?)、还是需外部调 `run next`/`run <id>`?若需外部触发,给该命令的目标选择/并发上限/幂等/结构化返回(注意:若走 bridge 触发,我方 09 §6.2 `HopperCommand.op` 要加一类 `run`)。另附**批式管线存活探测口**(事件静默 = 空闲还是进程死了,直接影响我方回叫诚实度)。

### P0-B · 事件与 settle

3. **事件消费 + 状态枚举**:envelope `schema_version='1'` 的 additive-only **冻结范围与升级规则**(v2 出现消费方 fail-closed);raw JSONL 无 seq——**byte/line cursor、半行、截断、轮转(现状不轮转,长期计划?)、文件被替换/重建时游标失效的 identity 信号(file generation / 首行 header / vault id)、未知事件类型容忍(EVENT_TYPES 只增)**的机器语义;权威顺序 = append order 确认。**并请给出:你的 task status 全枚举 + attempt 终态词表 + projector 两层(task×attempt)推导语义**(triage 出口 rejected/deferred/conflict 如何向用户转译)——我方据此重写投影映射、关闭 A4。
4. **"可验收已 settle"的官方判定**(最重要):我方理解现状 `RunnerFinished` 先到、verification/acceptance/docs 事件后到、artifact 再落盘——需要一个**带 scope 的终结语义**(建议字段:`task_id/run_id/attempt_id/revision/final_state_digest/evidence_digest/projection_cursor/settled_at`,保证发生在全部必需 artifacts 落盘 + 投影更新之后;**事件名由你定**,我方只依赖语义);次选:机械判定文档。**终结事件请带 evidence 定位符**(路径解析规则或最小"证据存在性/digest 读取口")——我方自建 settle barrier 要机械核验"summary/逐 AC 证据可读",而完整版本化读口在第 14 项(P1),这个最小切片需要前移。

### P0-C · 写入口与并发终结(收尾链)

> **承载面预答**(免得来回一轮):5/6/7 项用"现状 CLI 命令"框架提问,但我方知道你的冻结纪律是"新写入方的控制动作只准走 Command 族(M3a 冻结、M3b 实现)"。**若你裁决"这些语义 = M3b Command 通道,不给 legacy CLI 加第二套并发语义"——我方接受**,条件是:给出 (a) 过渡期机械兜底口径(我方已承诺非原子预检+对账),(b) M3b 的大致时间窗,(c) 届时外部接入的申请方式。

5. **写入口按你现状命令形状对齐**(我方已核实:`review approve <id>` / `review request-changes <id> --message` / `review reject <id> --message` / `merge <id>` 独立 / `cancel [task-id] --run <run-id>` / `unblock <task-id>` 无 answer / `retry --message`):请为每个入口补 **request/settlement 两态、结构化返回、幂等语义、origin 与外部收据字段**(origin 是审计标注非信任依据;我方理解现状 review 事件 source 固定 'cli'、非 TTY 会降权为 automation——受信 bridge/token 通道怎么建,归你裁决)。
6. **review 决策的原子性与 first-wins**(防 split-brain 的关键):我方已核实现状——approve 后任务仍停 review、重复 approve 继续追加、**approve 后 reject 会翻转投影**;mutation schema 有 `expected_status/expected_last_event_id` 但 review CLI 不填,且 expected_last_event_id 对全局尾不对 subject。请裁决:统一的 review-decision 原子命令(CAS 主键建议 `task_id+run_id+evidence_digest+decision_epoch`),第一个终局决策落账,后续同 payload 返回 `duplicate_same`、异 payload 返回 `decision_conflict` + winner/origin 回显;**approve→merge 的部分成功态**(`review_approved_waiting_merge`)与 merge 失败(冲突/verify 挂)的结构化返回、重试归属。**过渡形态披露**:我方 S3 屏幕审批卡是 P1,P0.5 期间 merge 可能由用户在**你侧入口**(Console/受信终端)亲手执行、我方只对账——所以 merge 事件请带 origin、外部收据字段设 optional(非 bridge 入口天然无收据,靠 origin 区分)。
7. **cancel 终结屏障**(改需求 = cancel+重 drop 的前提):我方已核实现状 cancel 返回受理时 kill/lock 释放尚未完成,`findActiveRun` 取最后一个 RunReserved。请裁决:cancel 的 `requested/settled` 两态(settled = 权威取消终态 + 进程退出 + lock 释放 + 事件对账),超时/崩溃恢复语义,重复 cancel 幂等,**旧 run 竞态自然完成时结果转历史、不触发当前回叫**;新 revision 的 supersedes 关联字段。
8. **blocked/需人事件的结构化**:问题文本 + question_id/revision + 可选项;**答案的注入通路**(我方理解现状 unblock 不带答案、答案应走 retry --message 或改卡——请定正确形态,要求答案进入下次 run 编译上下文、留痕、一个答案只消费一次)。

### P0-D · 运维合同(bridge 正确性前提,不是"偏好")

9. **mutation/read 操作合同**:稳定错误码词表(区分"仍在执行/可安全重试/永久拒绝/状态竞态")+ retryability 标注 + timeout 后对账方式;`expects` CAS 在 CLI/API 暴露;相同幂等 key 的重放规则;最大调用频率与退避;(我方已核实现状 MutationResult=applied/rejected/conflict/expired/failed + 自由文本 reason,默认 30s 排队/150ms 轮询)。
10. **状态查询**:按 task id 过滤的 `--json` 投影(我方理解现状 `hopper status` 无 task 过滤参数);返回含 run/attempt/status/reason;**成本字段 `{known, value, currency, asOf}`**,unknown 明示(现状 usage 可 unknown、不能当 0);"当前活动"不存在就不返回,不接受编造。
11. **锁定与测试素材**:pin 完整 commit SHA(基线锚点 c4c29c6,当前 ea3fb31 生产代码无差;**测试数字口径:1076/48/198 是 c4c29c6 提交记录的 gate 数,升级时由契约 CI 重跑**);golden fixtures 引用许可(fixture version + 升级回滚条件);**能力/版本握手**:一个可查询的 `schema_only/runtime` 能力清单 + API/schema version + commit identity,bridge 启动断言用。
12. **安全附录**:受信 bridge 通道的建立方式(token 签发/轮换/scope);**S3 收据验证责任二选一请裁决**——(a) 你侧当不透明字符串存证回显、验证责任全在我方,或 (b) 你侧校验存在性并绑定 subject、缺失即拒;Task Card 正文按不可信输入处理的确认;**项目配置面(setup/verify 自由 shell,含 S2 效果如装依赖/postinstall)的写入主体、变更审计、变更后是否需人重确认**——这是我方"只授权 S0/S1"自限的已知例外,边界要写清;artifact/日志读取的敏感路径限制与脱敏责任;credential compromise 时的 fail-closed 行为。

### P1 · Console 消费面(现状已有路由,请求"稳定化"而非"新增")

13. **把现有 Console read 路由提炼为版本化 machine surface**:服务发现(端口/token 现状随进程随机)、**独立只读 scope 的 client credential**(现状 read/write 共用 Bearer;且我方已核实 GET/SSE 只验 Bearer 不验 Origin、写才验 Origin,另有全请求 Host 校验防 DNS-rebinding——**请裁决读路径是否补来源约束、或显式声明为非目标,文档按实描述**)、SSE reconnect/backfill(现状 100ms await-write/150ms debounce/64 客户端上限)、响应分页/体积上限、脱敏;Console 未运行时的拉起责任;(可选顺手项)decision origin 展示——前提是第 6 项 origin 字段先存在。
14. **交付合同/逐 AC 证据/回执的版本化读取口**:canonical schema + run/tree/contract digest 绑定 + 缺证据/陈旧证据语义("completion receipt"不等同 task done);我方验收界面直接消费。

### 未来 · 平台化留位(只要求设计上不堵死)

15. **NotificationIntent transport 挂接**(WS4):SayDo 注册 transport;补 transport 注册/认证、intent dedup key、ack vs resolved、retry/DND、payload 脱敏、我方宕机时的积压上限;现状你不发 intent,我方自建 outbox。
16. **DecisionRequest 桥接**(M3b enforcement + WS4 inbox):正式接入需 digest/revision/expiry/options 复验、受信 channel、nonce/防重放、presentation evidence;**低成本预留请求(可拒、不阻塞)**:M3a additive 允许的话,在 Decision schema 预留 `voice` channel 与 `auth_context_ref/evidence_ref` 字段位——**我方知道 Decision 是冻结对象、additive 也要走 integration owner 流程,若你裁"M3b 设计时一并进"我方接受**;若预留,请让 validator 在 enforcement 存在前**拒绝/忽略这些字段的实际使用**(fail-closed,防止字段位被提前接线成"看似有认证实则不复验")。
17. **流式/steer 升级条件**:**按能力握手不按里程碑**——我方已核实当前 Command verb 与 ExecutorHandle.capabilities 均无 steer;只有当能力清单报告 `steer`(含强度)且存在 durable command/ack 与安全门时,"改需求"才从 cancel+重 drop 升级,否则永久保留 cancel-and-new-run。

## 请你输出(分两档,单轮别硬塞数万字)

**本轮必须"能照着写代码"的(我方最小阻塞集,缺任一 P0.5 无法开工)**:
1. **逐项裁决表**(17 项:已有/微调/新增/不做+替代,各附现状依据文件:行);
2. **第 1/2/3/4/9/11 项的完整契约草案**(命令/参数/字段/返回值含错误码词表/示例)——尤其第 2 项的**执行触发**与第 3 项的**status 全枚举**;
3. **锁定 SHA(或新打 tag)+ 专用 vault 初始化 + 升级节奏**(可操作步骤);

**本轮给"裁决 + 骨架 + 排期"即可的**:
4. 第 5/6/7/8/10/12 项(若裁走 M3b Command 通道,按 P0-C 预答给 a/b/c 三件);第 13/14 项(P1);
5. 对 `~/WorkSpace/voice-coding/docs/09-data-contracts.md` 的**跨边界字段**批注(接受/改名/反对;范围见"请先读");
6. **与在途改造的冲突或顺路点**(console lane / WS 系列 / M3b/M3c/M3d)+ 工作量与顺序(一天内 / 排进现有 lane / 建议 SayDo 侧自建);
7. **反向约束与异议**:events 轮询频率/文件礼仪/提交速率/重试规范,以及你认为这份清单设计得不对的地方——直说。
