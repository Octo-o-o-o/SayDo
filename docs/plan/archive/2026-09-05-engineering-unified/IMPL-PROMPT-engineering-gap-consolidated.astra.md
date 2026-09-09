# SayDo 工程缺口综合方案 · 实施交接 Prompt · Astra

日期：2026-09-05。配套[综合方案](2026-09-05-engineering-gap-consolidated.astra.md)。本文件是后续新会话的执行入口，生成文件本身不授权当前会话施工、改排产或部署。

本次成本修订：保留核心修复，新增能力逐项选择；取消固定轮询频率和 TTS/LLM 固定先后，按下方四行回报/成本说明约束实际开批范围。

## 1. 给新会话的任务

你是 SayDo 的 supervisor。完整读取本文件、配套综合方案、AGENTS.md、`.octoworkflow/project-profile.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` 当前批卡和它指向的总案批卡。按 owner 在新会话中的明确请求执行，使用 Grok CLI 进行产品实施，由独立零上下文 Codex 会话评审；supervisor 不代写产品代码、不代 reviewer 作语义 GREEN。

如果 owner 只问比较、状态或方案问题，不启动实施。如果 owner 明确说“按这个 prompt 继续实施”，且没有具名更换批次，默认只实施 PLAN-2 当前 next 批。在本文基线它是 PG-01B。不能把配套方案中全部候选自动升级为已授权。

后续提名优先考虑 VOBS-01、低开销 VIEW-01、最小被动 HOST-01；诊断不必等待分发改造。VOICE-01/02 由分段证据与安全可行性决定先选哪一项，编号不表示顺序；可能只做一项，也可能停在观测。VIEW-02、运行制品迁移/自动升级、gist、更多供应方、本地模型及外部连接均不在近期默认施工范围，必须满足综合方案 §5 的具体触发条件。此次更新文档本身不改变 PLAN-2。

owner 若明确要求优先实施 VOBS-01 或另一个未排产候选，先依据这条新授权将具名范围纳入唯一排产源，同步链断言、D17/总案等受影响引用及相应测试，并完成必要的独立方案审查，再派发产品实施。不因“综合方案已经写了”自行插批、合并 PG-04/05 或绕过 owner-stop。若只是含糊说“看看语音能不能先做”，先做只读影响分析，给出具体取舍，不当作改排产授权。

当前对 commit/push/merge/install/deploy 没有预先授权。本 prompt 不夹带这些授权。实施和验证应先形成可审查候选；提交、合并、发布或切换真实常驻只在 owner 当次明确允许的范围执行。

## 2. 启动与角色

1. 运行 `git status --short`、`git log -1 --format='%H %s'`、`git worktree list`，读取当前指针与既有任务 cycle；先运行 `python3 ~/.octoworkflow/candidate_fingerprint.py`。本文件记录的参考基线为 `bcf8ea855f25b177888d9159f75e49214f3dd892`，这是写稿时真实 `git log` 的结果；不得把它当作未来必须强退回的 HEAD。
2. 主工作树只读/收口。保留其他研究、journal、索引与未提交改动。施工优先独立 clone，分支用 `codex/` 前缀；固定来源 ref，并显式带入本次需要的未提交方案及其依赖，记录原始文件 SHA-256。不得使用整树覆盖、`git reset --hard` 或 `git add -A` 来清理并发工作。
3. 活动 cycle 读取其 `policy.frozen.json#roles`；新 cycle 才读取 `~/.octoworkflow/v2-policy.json#roles`。写稿时 implementation=`grok-4.6/xhigh`、review=`gpt-5.6-sol/max`。沿用有效 policy，不静默换模型/供应方或降档。Astra/Codex 主持调度与机械验收，正式语义 review 始终独立。
4. 读取 `$supervised-delivery`、`$external-cli-orchestrator` 及 `~/.octoworkflow/cli-forms.md`。启动 Grok 前按真实 `grok --help` 核对所需参数；`grok --version/models` 只在当前机器首次、升级或登录变化时预检，不反复调用。
5. 同一 parent 同时最多一个语义 child。实施退出并冻结 candidate 后才启动 reviewer；reviewer 不继承实施推理、不 resume、不施工，也不再派 reviewer。

## 3. 分阶段验收合同

本节是 `.octoworkflow/project-profile.md` 的阶段验收入口。每次只锁定一批。下表给 PG-01B 的默认合同；若当前 next 已变，先从其现役批卡提取同样完整的 scope/acceptance/gates 并写入该批执行副本，不用本表重跑旧批。下一批必须已具名获准、范围与门禁已冻结、前置 evidence 成立且无 owner checkpoint，才可继续。

在本批执行副本中补四行，收口时对照实际结果更新：

- 用户可见回报：哪项动作、状态、排障步骤或等待时间改善，以及如何判断。
- 增量运行成本与上限：请求、存储、模型用量、后台资源；无新增写明依据，未知如实标记。新增候选在冻结前把相关上限变成可验证条件。
- 用户负担：哪些功能受限，是否需要配置、重新登录/配对、重启或短暂停用；没有则明确写没有。
- 后续维护与停止/扩展条件：由哪个现有模块/维护者承接；何时收益不足应停止，何种具体需求才值得扩大范围。

只复用本批文档、现有测试与证据，不加独立审批、通用成本 checker 或监控平台。既定止损不因缺少无关的全项目成本基线而拖延；新能力不能以“预计很便宜”替代成本边界，也不能为取数自动调用真实 provider 或新增外部费用。

### 3.1 阶段表

| 阶段 | 实际工作与可判定出口 | 继续条件 |
|---|---|---|
| S0 RECONCILE | 确认选定批、授权、HEAD/fingerprint、scope exact-set、cycle 预算、验收与门禁，并填写四行回报/成本说明；不存在旧活进程或未固化部分落地 | preflight 全部有效 |
| S1 合同对齐 | 按现役批卡先修必要 canonical，再代码；PG-01B 为 L3 远程/权限边界。已有有效且范围未变的独立方案审查可复用，不为复用重新开通用 review | canonical 与有限 coverage matrix 可共同审查；若新增跨边界方案先独立审查 |
| S2 Grok 实施与 focused | 只实现本批 exact-set，满足 A1–A7；运行下方真实 focused 命令，保留失败与修复证据 | 固定 candidate，Grok 已退出，文件变化符合 scope |
| S3 独立 review | 一名零上下文 reviewer 对 A1–A7、回归边界和证据取证；输出唯一 review-manifest，经 validator 绑定该 candidate 验证 | valid 且 next_action=full_gate，或按预算修复 |
| S4 本地完整门禁 | 在语义 GREEN candidate 上运行 `just ci` 与 `pnpm exec playwright test`；记录不同矩阵/环境状态 | 本地门禁成功；缺 required 平台覆盖按项目状态如实记录 |
| S5 候选收口 | 证据/journal、唯一 P2 ledger、一次任务最终 sweep；报告真实输出、候选位置及未做项。未授权提交时保留未提交候选，不伪造 I/E 或关闭 PG 批 | 提交/合并等授权已有才执行；否则交给 owner 审查具体候选 |

### 3.2 默认 PG-01B 的边界

权威来源为 PLAN-2 `PG-01B · runtime-entry-stoploss` 和缺口总案 §20.4，`close_set=[G-A6]`、`stop_loss_set=[G-A3]`。G-A3 的最终关闭属于 PG-02。

允许触达：`packages/daemon/src/net/**`、`index.ts`、`voice/hub.ts`、`api/recoveryOnlyServer.ts`、`tier1/gateServer.ts`（仅证明 Unix socket 不属远程面）、`brain/liveTools.ts`、实际 touched API exact-set、Console action/budget/remote 消费点、对应测试、09/10/11 及配对 URL/远程面 inventory 和检查脚本。先列出实际文件白名单；不得因通配 scope 将整个 Console 或 index.ts 重写。

排除：远程重开、完整直达验收、G-A9 审计关闭、新看板聚合或刷新、流式、gist、provider 扩展、升级部署。保留 `direct_to_review` 设计 schema 并标 designed/deferred，从 active selector/default route/public claim 移除。无实现动作按原合同禁用/说明，不能虚造成功响应。

PG-01B 的四行说明必须包含远程功能损失：手机/远程浏览器不能再读取或操作业务数据，单纯只读并非安全例外；已有本地正常入口保留，受限状态与已有替代入口需清楚可见。若 owner 的核心使用依赖远程，提出具名安全重开建议与优先级取舍，不把重开塞进本批，也不把止损改成无限期忽略需求。重开仍依赖缺口 owner 决策表的 D6/D18、相应 ADR、认证加密传输与信任根、逐设备最小权限及撤销、凭据存储/轮转、兼容与恢复；不是 `docs/07` 的模型供给 D18。可能的重配对/登录及中断成本由重开批写明，不通过恢复旧 bearer 读口缓解。

| ID | 验收目标 | 至少一项反例 |
|---|---|---|
| A1 | 正式远程 business API/WS 各入口均按 inventory fail-closed；例外只含合同允许的无业务 payload health/static shell/安全跳转；Unix socket 另分类 | 远程 GET/写请求、直接深链及 WS 各路径不能读写业务或由 fallback 绕开；例外不泄露业务数据 |
| A2 | 本地正常业务路径与必要恢复入口仍符合 canonical；不用“全部 403”凑远程止损绿 | 本地既有动作/恢复正例成功；remote/local 身份混淆被拒 |
| A3 | 放弃入口不再调用 archive 造成 archived；缺预算显示 unknown，不构造 `0/0` | 刷新/重开后状态一致；缺值与真实 0 区分；disabled 入口不能假成功 |
| A4 | 直达验收的设计合同保留，当前默认/selector/claim 与保守拒绝一致；真实 TaskModal 写口按动作核对并保留 | 旧客户端/深链不能触发未实现能力；有效本地任务动作不被一并禁用 |
| A5 | touched 文档/共享 schema/客户端/服务端一致，09 已有类型从 `@saydo/contracts` 引入；没有 bypass、S3 语音放行或敏感原文新增 | 越向 WS 消息、未知动作、未登记路径和误投递按合同拒绝；不是拼字符串绕检查 |
| A6 | inventory 的正式路径可达，正例/反例覆盖现役支持 grammar；测试实际断言上述行为 | 受管入口漏登记、abandon→archive 和 unknown→0 的真实回归会红；不做无限语言 fuzz |
| A7 | 证据绑定实际 candidate；门禁输出、未运行的外部矩阵、产品与报告状态分开；与其它未提交工作隔离 | pre-commit/dirty 的绿不能冒充已提交 release HEAD 的绿；失效 manifest 不消费 |

这是原批卡目标的执行展开，不修改原 scope 或降低原验收要求。遇到与 canonical 的真冲突，先在原范围内修文档并复核；需要新增能力/改策略的部分停下给 owner 一个具体决策，其余无依赖工作继续。

### 3.3 PG-01B focused 与 full gate

下列命令来自本轮实际读取的 PLAN-2。标 `[new]` 的脚本只有本批建立后才可运行；不存在不是通过。类型/lint 覆盖由完整 `just ci` 确认，迭代可用 package scripts 中已核实的受影响子门。

```text
pnpm --filter @saydo/console exec vitest run src/hooks/redesign/mappers.test.ts src/components/redesign/DecisionPackageCard.test.tsx src/lib/apiError.test.ts
pnpm --filter @saydo/daemon exec vitest run test/console-actions.test.ts test/console-api.test.ts test/p05c-direct-mode.test.ts test/mobile-lan-process.test.ts test/pairing-info.test.ts test/t2-thin.test.ts test/logger.test.ts
node scripts/test-pairing-url-corpus.mjs
```

本批建立后运行 `[new] node scripts/check-remote-surface-inventory.mjs`、`[new] node scripts/test-remote-surface-inventory.mjs`。文档检查：`bash scripts/check-emoji.sh`、`node scripts/check-doc-links.mjs`、`git diff --check`、`node scripts/schedule-pointer.mjs --check`（验证现役指针，不自行推进）。

语义 GREEN 后完整门禁：`just ci`；`pnpm exec playwright test`。这只是本地 Node/Python 与浏览器基线，不外推托管 CI、真机、真实 provider 或发行物验证。复用已有测试扩大精确断言，不为了数目新增通用 checker。

### 3.4 选择新增候选时的合同生成规则

VOBS-01 被 owner 具名选中并入排产后，以综合方案 §5 的五项技术验收及资源约束冻结 A-ID：P50/P90 与样本下限、pending 上界与失败分母对账、模式/工具分组、近似时钟口径、现役事件路径；计数窗口、分组基数、已结算轮去重索引和聚合日志均有界。复用普通日志现有轮转，明确新增字段的输出频率与保留容量/期限，不增加逐轮原文或外部监控服务，不裁剪不可变审计。按代码实际测试目录核准 collector/voice-hub/live-dialog/Python 的 focused 命令。只调用 collector 的 fixture 不够证明生产接线；真实 provider 未授权时用明确标记的 fixture，不宣称真实首响改善。

VIEW-01 先列出现有事件覆盖与缺口，优先用动作成功、已覆盖的现有事件、回前台/重连触发失效并合并请求；缺口保留有界兜底刷新和手动重试。不得默认每 5 秒全量拉取或承诺统一 6 秒更新。冻结指定 Focus 规模下的新鲜度上限与每活跃页面请求预算，同时验证后台暂停、事件突发、多标签、离线恢复、详情失败保留及旧响应不覆盖新状态。N+2 是读取形状及负载线索，不是已测得的性能瓶颈；预算/新鲜度不兼容或现有读口缺乏必要真实状态时，才提请 VIEW-02，不自动扩 API。

VOICE-01/02 先从同模式/配置分段证据选一处值得优化的瓶颈，并说明代理测点的归因局限；不得固定先做 TTS、再做 LLM，也不因没有真实基线就把 fixture 结论当实际瓶颈。选 VOICE-02 不要求先落 VOICE-01，可以保留整句 TTS。冻结所选路径的端到端改善目标、失败/取消回归界限、并发/重试/缓冲上限和取消后的在途工作边界。没有安全可行的早播路径、收益不足或资源超界时，保留旧安全路径并停在该结论，不自动实施另一项。流式可能产生已生成但未消费的计费用量，不能承诺费用不变。

HOST-01 只按需聚合现有本地状态、版本、配置世代及已记录故障；不自动探测 provider、执行第三方 CLI 或新增必填配置。分发变更或可复现身份差异才触发隔离同包验证，不作为最小诊断的强制扩项。HOST-02 只有具名分发需求和恢复/兼容条件齐备后才选择迁移或升级，不能捆绑默做。CONTEXT-01 要先证明重要约束丢失且现有 pack/记忆修正不足；READ-01、额外供应方/本地模型只为现有能力不能满足的一个具名任务选择一种来源/组合，分别限定调用、存储、本地资源和维护负担。全局快捷键、通用治理与大重构不扩进来，优先正式 TaskModal 的具体键盘闭环。

VIEW-01/02、VOICE-01/02、HOST-01/02、READ-01、CONTEXT-01 尚不是可直接串行施工的完整合同。被选中后先给 exact pathset、canonical 增量、四行回报/成本、可判定正反例和真实 gate argv，再冻结与派发。特别禁止把下列捷径写进执行副本：

- 新 `state.changed` 绕过封闭 WS schema，或仅因 payload 小而声称不涉及 09。
- LLM token 一到就播，绕开完整输出依赖的锚定/落账/模型身份/脱敏规则。
- MP3 chunk 一到就作为完整句播放，或取消后继续消费旧轮/旧 peer 的音频。
- gist 与工具输出直接写入 trusted 记忆，或把同步摘要延迟隐藏在语音首响里。
- `say` 本机有声音就视为远程/移动端 TTS 兜底，或 localhost 模型一次成功就升为 supported。
- 修改 plist 就视为 runtime 部署成功，或在无迁移前恢复点时增加自动 upgrade。

## 4. Grok CLI 派发

将选定批合同复制成任务专属实施输入，保留唯一 workflow-v2 block；把固定范围、验收 ID、canonical、运行命令及输出位置传给 Grok，不向它转发本会话的比较推理。先运行 `python3 ~/.octoworkflow/validate_handoff.py <本批执行副本>`，非零不派发。

Grok 当前规范形态为 `grok --prompt-file <本批输入文件> --cwd <独立clone> --output-format streaming-json --model grok-4.6 --reasoning-effort xhigh --no-subagents --verbatim --always-approve --sandbox workspace`。有效 frozen roles 改变时使用其对应值，不能机械套旧模型。不得加 `--max-turns 1`。

真实启动经 `~/.octoworkflow/await_external_cli.py` 执行，设置任务级 hard timeout 与 streaming idle timeout，日志只留任务 ignored 目录。超时按相近任务历史 p90 决定，无可用历史时为首次小批记录有界初值（hard 3600 秒、idle 900 秒），不得通过改短 timeout 伪装高效。

启动与等待放在同一个 `functions.exec` cell；完成前由工具层阻塞等待，不由模型定频查询进程或日志。55 秒 `notify()` 仅作 UI 进度。嵌套 terminal wait 按 runner 规范，outer buffer 覆盖 hard timeout 加 120 秒；host 提前 yield 只恢复同一 cell。遵守宿主更高优先级的单次等待限制，不能以此开启模型层轮询。最后只回收紧凑结果；确认进程已退出、`stopReason=end_turn`、实际模型 metadata 和真实 diff，不能只信“已完成”字样。

只有配额/可用性信号才允许有效 policy 的回落或延期恢复。部分落地先固化；非配额失败不换 provider，程序性失败走 `plan_recovery.py`，CLI 容量走 `plan_cli_recovery.py`。不要并开替代实施者。

## 5. 独立 review 与受控收口

控制目录使用本批已有 canonical 路径；无则 `docs/plan/<task>/`，cycle-state 为 `docs/plan/<task>-cycle.json`。唯一 `Deferred P2 ledger` 在本任务控制目录；路径写入执行副本，不复制旧研究任务的计数或 ledger 作为新产品预算。

按工具 schema 初始化/续跑 state、冻结有效 policy、acceptance、gate spec。freeze 写入 ignore 后再计算 candidate 身份；control、cycle-state、原始日志不入 Git。coverage matrix 最多四个判断维度：正式入口/状态语义、边界与回归、证据与交接；覆盖 A1–A7 的有限正反例。

派发前运行完整 `cycle_control.py --preflight`，绑定 control-dir、cycle-state、handoff、coverage-matrix、expected HEAD/fingerprint/task/stage/cycle/ordinal。review 前后各运行 `candidate_fingerprint.py --expect <冻结指纹>`；漂移即失效，不算有效产品 RED。

reviewer 只获得固定 candidate、合同、coverage、canonical 和允许的测试入口，不获得实施自辩或旧 reviewer 推理。报告落 `research/codex-findings/`；只写 review artifacts。唯一 `review-manifest` 包含 verdict、candidate identity、ordinal/scope、blockers、P2 delta、focused_gates、stop_reason。focused_gates 只含 `name/exit_code/summary`；supervisor 不执行 reviewer 输出的任意命令。

消费前运行 `validate_review_manifest.py`，绑定实际 HEAD/fingerprint、ordinal、cycle-state 和 task/stage/cycle。缺失、无效或坐标不符按程序性恢复处理，不捏造 GREEN。首次范围内可复现 P0/P1 且无需 owner 决策自动修一次；后续有进展按 policy 和持久预算续修，用全新零上下文 reviewer。P2 进唯一 ledger，不当轮扩修；最终只做一次 P2 sweep，随后仅跑受影响门禁，不另开通用复审。

完整门禁由 supervisor 运行原合同冻结命令，`cycle_control --record-gate` 持有日志/收据，不传调用方 `--gate-log/--gate-exit`。满足条件后 `--finalize`；没有当前 candidate 的有效 GREEN、完整 gate 或仍有活进程/部分写入时不得 finalize。远端必需门缺失按 `LOCAL_GREEN_REMOTE_PENDING` / `BLOCKED_REQUIRED_GATE`，不能说托管 CI 等效。

如果 owner 已明确授权提交，按项目 I/E 两提交法：先代码 I，再证据 E 记录 I 的实际 SHA，不自指；在干净的 post-commit release HEAD 上重跑合同完整门禁后才执行另获授权的 push/install。没有提交授权时保留可审查候选，证据指纹对应 dirty candidate，不能关闭依赖 evidence commit 的排产节点。

下一批仅在已被具名授权、合同完整、前置和 owner checkpoint 均满足时自主继续；本 prompt 不授权默认全做或消除 owner-stop。安全链后候选未选定时提供一项具体下一步及其验收卡。

## 6. 最终回复要求

先说哪些可见行为已经由代码和本轮命令验证，再对照四行说明报告实际回报、持续运行成本、用户负担、维护与停止条件；无实测的成本/改善明确保留未知，不将新能力数量作为收益证明。给候选工作区、真实 HEAD/fingerprint、review verdict 和报告路径、focused/full gate 原始输出摘要、未做项、是否提交/部署及下一步。不要把“执行和检查都跑完了，等你验收”写成已经交付；合并后才说交付。

每次回修按项目 journal 下一编号记录输入/行动/产出/结论。日志只记录名称、字节数与 SHA-256，不把 secret、完整本机路径或日志正文塞入提交文件。全仓零 emoji。

## 7. Workflow V2 合同

本 block 只定义执行预算与角色隔离；不能用它覆盖 §1 的选批、权限和排产边界。开新 cycle 时与 live policy 校验，活动 cycle 用 frozen policy；发生规则差异先按受控工具处理，不请求无依据 override。

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```
