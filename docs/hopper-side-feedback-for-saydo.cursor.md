# Hopper 侧反馈:SayDo 要更新的假设、要消化的边界、要拍板的两问

> **[ok] 状态更新(2026-07-24)**:X1/X3 已由 SayDo owner 拍板并回传,Hopper 侧已全部落实——批次 A + RunSettled 已 commit 并打 tag **`v0.1.0-saydo-baseline.2`**(commit `bdd1e548f9359789497a797eda24398beba68ac5`,40 位切锁用)。**两份新交付物**:`research/hopper-baseline2-diff-manifest.md`(ea3fb31..baseline.2 diff 面清单,审计+切锁流程)、`research/hopper-integration-appendix.md`(acceptance 验收标题词表+样例(给 C1)、`HOPPER_FAKE_SPEC` fake-runner harness(给 P0.5-B 契约测试))。本文其余内容作为背景保留;下一步在 SayDo:对 baseline.2 跑契约测试,全绿切锁,不绿停留 baseline.1+过渡兜底并回报失败用例。
>
> **给谁**:SayDo 项目的 AI/owner。**从哪来**:Hopper 维护者(刚实施完 saydo 批次 A + RunSettled)从 Hopper 侧看 SayDo 设计,产出的反馈。已经 4 subagent 对抗复审(Hopper 能力核实 / SayDo 一致性防重复 / 边界安全 / 价值优先级)+ triage。
> **怎么用**:这是「让 SayDo 侧 AI 思考是否接受」的输入。凡本文的「Hopper 侧事实」都附了 Hopper 源码/文档出处,SayDo 可交叉核对。**其中 §3 的两个问题(X1/X3)需要 SayDo owner 先拍板,拍板后把决定反馈给 Hopper 会话,Hopper 才会落实对应配合动作**(如重新打 tag、导出词表)。
> **一句话背景**:批次 A(capabilities/vault.json/project show/run \<task-id\>/`--req-id`/`--expect-*`/`--origin`/`--receipt`/last_run_cost)+ RunSettled 已在 Hopper 侧实施(已 commit,见顶部状态更新),SayDo 文档里当「待落地」的多处已可切正式形态;同时暴露了两套风险维度正交、retry 绕闸门等边界,SayDo canonical docs 需回填。
> **诚实分层**:本文一部分内容 Hopper 裁决 `docs/plan/2026-07-23-saydo-integration-adjudication.fable.md`(SayDo 已消费)其实**已告知过**,SayDo 只是没回填 canonical docs——这类标【裁决已给·回填遗漏】;裁决与 SayDo 都没有的标【新增】。

---

## 1. 这些假设已过时,SayDo 要更新(批次 A + RunSettled 已实施)

> 全部是时效性更新:SayDo 写文档时批次 A 未落,现在已落地并进 baseline.2,SayDo 多处「过渡兜底」可省。

### 1.1 settle barrier 可从「机械判定+轮询」升级为「消费 RunSettled 事件」【新增·纠正 09 §6.3】

- **SayDo 现状**:09 §6.3 路径二 settle 用机械判定(轮询 `hopper review show --json` 查 6 字段),注「RunSettled 随 M3b 落地后切」。
- **Hopper 现状(已变)**:RunSettled **已实施**(不是等 M3b),`capabilities.settle_event='runtime'`。emit 恒在全部 artifacts 落盘 + 投影写回**之后**;payload `{final_status, runner_status, runner_outcome, evidence_digest, summary_path, run_dir, recovery?}`;三条 emit 路径(正常收尾 / 异常兜底 recovery:true / cancel dead-owner 兜底)。
- **SayDo 该改**:C3 直接消费 RunSettled 事件触发 settle barrier,免轮询。**但保留廉价复核**(RunSettled 是单写者自报):核对 evidence_digest 与 `review show --json` 一致 + summary_path 存在;六字段机械判定降级为**事件缺失时的对账兜底**。
- **残余边界(不变)**:SIGKILL 级中断无 RunSettled,仍需「超时 → `hopper reconcile` → RecoveryRecorded」兜底。

### 1.2 cancel settled 判据可统一到 RunSettled【新增·09 §6.1】

cancel dead-owner 兜底也 emit RunSettled(recovery:true, runner_status:cancelled),owner 存活由正常收尾发。SayDo 可用「RunSettled 出现」统一判据,不再区分 RunnerFinished。

### 1.3 过渡兜底可切正式形态【新增·09 §6.2/§11、ADR-001】

| SayDo 过渡形态 | 批次 A 正式形态(已可用) |
|---|---|
| `projectSnapshotDigest` 读 projects.toml + 缺省表 | `hopper project show <name> --json` 全字段 |
| `vaultId` 用首行 event_id 快照 | `.hopper/vault.json` 的 `vault_id`(init 幂等生成) |
| 幂等靠业务幂等+对账 | mutation `--req-id`(直连/队列一致返回首次结果) |
| first-wins 靠预检 | `--expect-status`/`--expect-last-event`(全局尾 CAS) |
| origin 缺位 | `--origin` 审计透传(receipt 目前仅 `review approve` 旗标) |
| 版本断言自算 hash | `hopper capabilities --json`(commit 仅 dist 构建有;+能力分级+枚举单源) |
| 定向触发 `drain --max 1` | `hopper run <task-id>`(机器可读 skip reason) |

- **精度提醒**:`req_id`/expects 的**底层机制** Hopper HEAD 已有,批次 A 新增的是**CLI 旗标暴露 + 直连路径 req_id 去重 + origin/receipt 字段**;其余(capabilities/vault.json/project show/run \<task-id\>/last_run_cost/RunSettled)是全新。
- **握手顺序建议**:bridge 启动第一调用 = `hopper capabilities --json`,一次拿 commit(断言锁定点)+ 能力分级(steer 探测)+ 枚举单源。

---

## 2. 这些边界 SayDo 要消化(否则会撞墙)

### 2.1【核心】两套风险维度正交,双向都要处理

**Hopper 事实**(源码,已核实):Hopper triage 的 `risk`(low/medium/high)由**正文关键词**算(`src/core/risk/taxonomy.ts`):auth/登录/认证/token、billing/计费/订阅、security/权限/密钥 = securityish;migration/迁移、ci/deploy/部署、删除数据/用户数据 = high-danger。命中 high+sec → **high**,任一 → **medium**。triage **不读 frontmatter 的 risk**,且会用算出的覆盖写回。

**方向一:content-risk 会挡任务**【裁决 §2.2 已告知 · SayDo canonical docs 回填遗漏】
- 「给登录页加导出」(你的 effect=S1)含「登录」→ medium → daemon 不自动、要显式 `run`/`drain`;「迁移认证表」→ high → ready 路径无自动入口。
- **裁决 §2.2.4 已原话告知过**「high 的 ready 任务无自动执行路径……把分诊为 high 当 blocked 类,用户改卡降险或转 Tier1」。但 SayDo canonical docs 未回填:**09 §7 缺 ready∧risk-high 投影行、04 §5 红线只有 effect 维、10 无对应话术**——这是要补的回填。
- **【新增·必须纠正一个事实】**:「high 无**任何**自动执行入口」**不成立**——`hopper retry` **不查风险白名单/预算/usage**(只查状态集 `{failed,review,rejected,conflict,blocked}`),直连执行。而 retry 恰是裁决给你的两条主通路(修订链 cancel→re-drop→retry、答案注入 `retry --message`),bridge 会自动调。风险:① medium 任务被 post-run 升 high→review→用户口头改→bridge 自动 retry→high 再次执行且零闸门;② 分诊即 blocked 的 high 任务若用 retry 恢复则首跑直通所有闸门。
  - **SayDo 要补的红线**:bridge 自动 retry 前重读投影 risk,**high 不自动 retry(转人工)**;分诊 blocked 恢复只走 re-drop→unblock→调度,**不走 retry**。

**方向二:content-risk=low 不代表 effect≤S1**【新增·初稿也漏,复审补】
- Hopper **运行中对 effect 维度零执行点约束**:sandbox 恒 `workspace-write`;claude adapter 默认 `Read,Edit,Bash`(Bash 全开);push isolation 只拦 `git push`;post-run guardrails 只检 diff 路径/secret/branch——**网络类 S3 效果(npm publish、外发 API、发消息)运行中无拦截、post-run 无检测**。
- 后果:一个「上传产物 + Slack 通知」的任务正文无命中词 → low → daemon 自动执行 → Bash 完成外发(你定义的 S3)→ post-run 全绿落 review。**效果在人看到前已不可逆**。你「路径二只授权 S0/S1」的唯一执行者是 Brain 的**事前预测**,两侧都无 runtime backstop。
- **SayDo 要写清的双维语义**:effect≤S1 与 content-risk 过闸**取交集、互不替代**;**Hopper 判 low 不是 effect 安全背书**(关键词词表窄,任何不在表内的措辞穿过)。你 04 §5.4 已要求的契约测试反例(postinstall/CI 触发/未知 S2)应登记为对接验收项。

### 2.2 执行触发维持 bridge-driven(Hopper 侧已否决「daemon 为主」的设想)【裁决 §2.2 已告知】

- `drain --max 1` 同步阻塞到 post-run 完全跑完才返回(已核实调用链);但 bridge 是 spawn 子进程、**天然异步**,进度靠 C3 并行读 events.jsonl(逐事件 fsync 实时落盘)——这是 C3 本职。
- Hopper 侧评估过「daemon 为主」并**否决**:daemon 只 low(你的任务高频 medium)、且会让「投递面=授权面」(drop 即武装、撤回变竞态、bridge 死 daemon 活、intake 面变执行授权面)。**维持裁决默认 bridge-driven**;daemon 是 P1 优化项。
- **预算护栏的真实力度(纠正)**:daemon 预算预检**不是硬护栏**——`daily_budget_usd` 缺省默认 5、不配也启动;`hard_budget_enabled` 默认 false=只告警;订阅 runner 成本估算口径可能低估。daemon 模式实际熔断只剩 per-run 超时。若你未来要 daemon,`hard_budget_enabled:true` 必配,且需 ① 专用 vault 外部 intake 恒关 ② 「drop=不可撤回授权」纳入念读 ③ 声明 bridge/daemon 存活解耦。

### 2.3 成本 per-task 归因:SayDo 逐 run 累加即可【04 §6 已成文·方案新增】

- **纠正一个过时认知**:「codex 成本恒 unknown」已过时——Hopper V7b 起 codex 从 token×单价表**估算** USD(订阅下=等价 API 成本估算,非真实账单);仅模型未登记才 known:false。「大面积 unknown」不成立,多数是估算值。
- Hopper ledger 按 runner/project 分桶、无 per-task 维度(你 04 §6 已诚实登记)。**方案**:你有 dispatch_binding 知道 taskId↔runId,**逐 run 读 `show --json` 的 last_run_cost 按 taskId 累加**即得 per-task,不需 Hopper 改。「订阅额度内/估算成本」话术要覆盖 Hopper 路径。

### 2.4 acceptance 标题契约 + 用 `hopper lint` 预检【格式:裁决已给指针·lint:全新】

- acceptance 分母来自正文**验收标题段**(词表单源 `headings.ts`);**没有可测验收标准 → triage 就判 blocked**。你的 C1 TaskCardRenderer 要用 Hopper 认的标题格式渲染 `DecisionPackage.acceptance[]`,否则任务落 blocked。裁决 §2.1 给了指针但没列词表——**Hopper 侧会导出词表+样例给你**(见 §3 X4,直接做)。
- **`hopper lint <file>` 是现成的任务卡预检器**(HEAD 已有,`--json`,vault 可选离线用):你 C1 **drop 前**跑它,不达标不 drop、回对话补,避免 drop 进去才 blocked。价值可提前到第 1 周(手写 PoC 任务卡就用)。
- **关键用法(纠正)**:lint 的 `missing_acceptance` 是 **warning、不进退出码**!「缺可测验收标准→blocked」的硬闸在 lint 里无对应 blocking 项。所以你**不能只查 blocking**,必须同时查 `--json` 里的 `result.classification`(=blocked 等)/`execution_decision`(=needs_human)——否则漏掉最常见的「缺验收标准」blocked 因。

### 2.5 两处引用/小点

- **Console 深链 token**:随进程存亡、无轮换,深链 URL **不能缓存**(每次现取 tokenFile)。**你的引用要更正**:「深链凭据待只读 token」在 **ADR-001**(协调点 2 + 读路径段),不是 09 §7。**且下面 §3 的 trust-report HTML 直读能绕开整个 token 问题。**
- **retry worktree**:retry 默认复用 worktree,base 落后只告警不重建;展示进度要知道 retry 可能在旧 base 上跑。

---

## 3. 需要 SayDo owner 先拍板的两问(拍板后反馈给 Hopper)

> 复审后从 5 问减到 2 问真决策。拍板后把决定发回 Hopper 会话,Hopper 据此落实(commit/打 tag/导出词表)。

**X1 · 锁定点是否条件式前移到 baseline.2?**
- 背景:批次 A + RunSettled 全在 `ea3fb31` 之后且未 commit。前移=Hopper commit+合入+打 `v0.1.0-saydo-baseline.2`(钉死确定 commit)+公布 `ea3fb31..baseline.2` diff 面 → **SayDo 契约测试对 baseline.2 全绿才切锁,否则停留 baseline.1 + 过渡兜底**。
- 利:省一整层过渡兜底代码(§1.3 全部可切正式)。弊:baseline.2 比你审计过的 ea3fb31 多一批改动(都 additive、有 Hopper 侧测试,但你没跑过契约测试)。SayDo 继续锁 40 位 SHA(tag 只作助记)。
- **Hopper 侧倾向**:条件式前移(过渡兜底本是等批次 A 的临时物;前移不放弃「锁已审计 SHA」前提,靠契约测试+diff 审阅补)。
- **你要答**:接受条件式前移?还是坚持 ea3fb31 + 全走过渡兜底?

**X3 · 接受两条风险边界?**
- (a)「content-risk(关键词)改变执行路径、high 不走路径二自动执行(retry 也须被 SayDo 侧挡)」;
- (b)「effect 与 content 双维取交集、Hopper 判 low 非 effect 背书」。
- 接受 → SayDo 补红线(effect+content 双维、retry 挡 high、drop 前 lint 查 classification、每次 `run <task-id>` 绑定已拍板 dispatch);Hopper 侧把「triage 尊重受信 bridge 的 risk」按收窄条件留 M3b 评估(降险永不随通道信任批发)。
- **你要答**:接受这两条边界作为 P0.5 契约?

---

## 4. SayDo 可立即消费的三件 Hopper 免费资产(告知,无需拍板)

> 这三件是 Hopper 已有的独立资产,能显著削减你 P0 的自建量,且多数服务你 P0 前三周(不用等第 4 周桥接)。Hopper 零改或仅补文档。

1. **`hopper check` = 你 Tier1 路径的独立验收 oracle**。`hopper check --base <ref>|--staged --criteria - --format json`:对任意 git repo diff 跑四道确定性闸门(verification/guardrails 含 secret+forbidden 扫描/逐条 AC acceptance/docs),不写事件流不动工作区,退出码 0–4(4=needs_human 映射回叫),`--criteria -` 直接喂 `DecisionPackage.acceptance[]`,报告纯确定性。**它比你自建的「异族模型 oracle」独立性更强,直接顶掉你评审 §4-S2/G3 的一大块**(秘密/禁区扫描+逐 AC 证据+评审证据原料)。建议你 **Phase 0 就做可行性验证**(agent 未 commit 产出用 `git add -A`+`--staged`)。
2. **`HOPPER_FAKE_SPEC` fake-runner = 你桥契约测试的 harness**。设此 env 后真实 CLI 走生产路径选中 fake runner,fake spec 可产任意终态/非法 JSON/触 forbidden/sleep 触 timeout。你 P0.5-B 的全闭环契约测试(drop→…→RunSettled→merge,含 cancel/timeout/blocked)可对**锁定二进制**在 CI **确定性跑通、零 LLM 成本**——没有它你只能 mock(测不出契约漂移)或烧真额度。Hopper 侧补半页 harness 文档。
3. **自包含 trust-report HTML = 你 review 证据视图组件**。`20-Runs/Summaries/<runId>.html` 零外链单文件,RunSettled payload 带 `summary_path`,你拥有该 vault → 直接读文件嵌 iframe。**砍掉你 5.2 证据视图对路径二任务的大半自建,且绕开 §2.5 的 Console token 问题**(不经 Console)。

(顺手:`fixtures/migration-samples/` 三组真实事件流可作 C3 测试种子;`hopper prompt` 编译预览给 C1 调试。)

---

## 附:本反馈的完整版与复审账

Hopper 侧完整分析(含配合工作的 Hopper 侧实施细节 + 4-subagent 复审 triage 全表)在 Hopper 仓 `docs/plan/2026-07-24-saydo-collaboration-and-gaps.cursor.md`。本文是其「交给 SayDo 提问」的切片。
