# SayDo 工程改进统一实施 Prompt · Astra

> **状态(2026-09-09)**:本 Prompt 具名的近期组合 PG-01B → AS-01/AS-02 已全部收口并入 main(见 PLAN-2 批卡状态行),本文转为历史交接材料,不再派发。后续缺口收敛的现行入口是 `IMPL-PROMPT-2026-09-09-gap-consolidation.md`。

日期：2026-09-05。配套[统一方案](2026-09-05-engineering-unified.astra.md)。这是本次工程缺口与 ECC 合并后的唯一实施交接入口。归档文档只供取证；旧 Prompt 不再派发。本轮生成/归档文档不启动产品实施。

## 1. 给新会话的任务与选批

你是 SayDo 的 supervisor。完整读取本文件、统一方案、AGENTS.md、`.octoworkflow/project-profile.md`、PLAN-2 当前指针/批卡及其引用。用 Grok CLI 实施，由全新零上下文 Codex 独立 review；supervisor 不代写产品代码或自判语义 GREEN。

用户只问方案/状态时继续只读。用户明确说“按统一 Prompt 实施”且未收窄范围时，具名采纳的近期组合为 **PG-01B → AS-01/AS-02 隐私批**，不是全部 PG 链和全部候选；本次请求合并文档本身不构成这项产品施工授权。启动后按实际代码/evidence/合并祖先关系跳过已闭合工作，不能只因历史 SHA 或 `last_closed` 字样已改变就重跑或停工。

- PG-01B 未闭合时，先按 §3.1–3.3 实施该现役批，形成可审查候选。AS 仅可做不修改 canonical/排产的依赖准备。不得沿旧 ECC Prompt 一直只准备而不推进已授权的 PG-01B。
- AS 的前置是 PG-01B 已合并、批卡要求的 evidence 可验证；候选 GREEN、脏树、未入库 evidence、指针文字都不单独证明合并。需要且尚未获准的 commit/merge 是交付具体候选后的 checkpoint，不能跳过。
- 前置成立且本新任务已具名采纳上述组合后，由 supervisor 登记此次授权到现有 owner 决策载体，并同步 PLAN-2 的 AS 批卡、依赖/链断言、受影响引用和相应测试，再启动 AS。位置为 PG-01B 后、PG-02 前；不要求 owner 手改指针，不把旧 D17 当新增范围的授权，不改写旧签署原话。若 PG-02 等已实际闭合，给出剩余依赖的具体安排，不回滚现势制造旧位置。
- AS 采用统一 contract→implementation 两阶段，两个阶段已预先接受；GREEN+该阶段门禁后可继续下一阶段。AS 正式闭合后排产接回 PG-02，本 Prompt 默认施工授权到 AS 候选收口为止。后续 PG 批或候选须另有具名授权及完整合同。

原 PG-03/04/05/06 批卡与 owner-stop 保留。VOBS/VIEW/HOST 可按统一方案提名；语音按分段证据选一个安全且有收益的瓶颈；AS-03..07、升级、gist、更多供应方/本地模型与外部来源不自动进入。所有实际选中批次填 §3 的四行回报/成本说明。

当前没有 commit/push/merge/install/deploy、真实账号调用或付费探针的预授权。只在已有授权范围内行动，先完成可审查候选再处理实际 checkpoint；不因缺少无关的全项目成本基线拖延已批准止损。临时容量/程序问题按有效 policy 受控恢复，不用重复询问替代必要工作。

## 2. 启动与角色

1. 运行 `git status --short`、`git log -1 --format='%H %s'`、`git worktree list`，读取当前指针与既有任务 cycle；先运行 `python3 ~/.octoworkflow/candidate_fingerprint.py`。本文件记录的参考基线为 `bcf8ea855f25b177888d9159f75e49214f3dd892`，这是写稿时真实 `git log` 的结果；不得把它当作未来必须强退回的 HEAD。
2. 主工作树只读/收口。保留其他研究、journal、索引与未提交改动。施工优先独立 clone，分支用 `codex/` 前缀；固定来源 ref，并显式带入本次需要的未提交方案及其依赖，记录原始文件 SHA-256。不得使用整树覆盖、`git reset --hard` 或 `git add -A` 来清理并发工作。
3. 活动 cycle 读取其 `policy.frozen.json#roles`；新 cycle 才读取 `~/.octoworkflow/v2-policy.json#roles`。写稿时 implementation=`grok-4.6/xhigh`、review=`gpt-5.6-sol/max`。沿用有效 policy，不静默换模型/供应方或降档。Astra/Codex 主持调度与机械验收，正式语义 review 始终独立。
4. 读取 `$supervised-delivery`、`$external-cli-orchestrator` 及 `~/.octoworkflow/cli-forms.md`。启动 Grok 前按真实 `grok --help` 核对所需参数；`grok --version/models` 只在当前机器首次、升级或登录变化时预检，不反复调用。
5. 同一 parent 同时最多一个语义 child。实施退出并冻结 candidate 后才启动 reviewer；reviewer 不继承实施推理、不 resume、不施工，也不再派 reviewer。

## 3. 分阶段验收合同

本节是阶段验收入口，每次只冻结一批的一阶段。§3.1–3.3 为 PG-01B；§3.4 为 AS 两阶段；§3.5 为未排产候选的生成规则。按 §1 核实前置和选批；若实际 next 或代码范围已改变，先对账现役合同，不用旧表重跑已闭合工作。新阶段不重置未结算的旧阶段预算，只有预先接受、前置成立且无 checkpoint 才继续。

在本批执行副本中补四行，收口时对照实际结果更新：

- 用户可见回报：哪项动作、状态、排障步骤或等待时间改善，以及如何判断。
- 增量运行成本与上限：请求、存储、模型用量、后台资源；无新增写明依据，未知如实标记。新增候选在冻结前把相关上限变成可验证条件。
- 用户负担：哪些功能受限，是否需要配置、重新登录/配对、重启或短暂停用；没有则明确写没有。
- 后续维护与停止/扩展条件：由哪个现有模块/维护者承接；何时收益不足应停止，何种具体需求才值得扩大范围。

只复用本批文档、现有测试与证据，不加独立审批、通用成本 checker 或监控平台。既定止损不因缺少无关的全项目成本基线而拖延；新能力不能以“预计很便宜”替代成本边界，也不能为取数自动调用真实 provider 或新增外部费用。

### 3.1 PG-01B 阶段表

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

### 3.4 AS-01/AS-02：同一隐私批的两个预先接受阶段

任务标识建议 `ecc-as01-as02-privacy`，沿既有有效 state 续跑，不为合并文档重开已运行的预算。风险按持久化隐私与信任边界 L3 准备；AS-01/AS-02 和失败恢复一起设计、一起实现，不按三个功能反复拆评审。

| 阶段 | 范围与 acceptance | 门禁与继续条件 |
|---|---|---|
| contract / c1 | AS-C1：统一方案 §3 全部新写入/拒写/Git 保护与三类失败语义进入必要 canonical；AS-C2：保护默认私有与人工共享不冲突；AS-C3：冻结下面 M1–M8、实际文件白名单、正反例、成本上限和真实 gates；AS-C4：PLAN-2 登记及前置真实，无越权/多余共享设置 | 一名只读设计 reviewer；文档/排产检查全部通过，若触及共享 zod schema 则跑受影响 contracts typecheck 与测试。GREEN 后进入 implementation；不在本阶段改 daemon 行为 |
| implementation / c1 | 实现 M1–M8；先记录第一阶段 GREEN/schema baseline，再写代码与测试；前后预算分属这两个已接受阶段 | 一名全新代码 reviewer；GREEN 后 `just ci` + `pnpm exec playwright test`。收口后不自动实施 AS-03..07 或 PG-02 |

控制目录用本任务两个独立 stage 目录，如 `docs/plan/ecc-as01-as02-privacy-contract/` 与 `...-implementation/`，各自 `cycle.json`。P2 使用本任务唯一 ledger，contract 阶段只登记，最终才做一次 sweep；不是每阶段一份账本。

范围：daemon `memory/ledger.ts`、`memory/foundation.ts`、`brain/liveTools.ts` 的 remember、必要的纯检测/Git 保护模块及实际 workspace/foundation 入口；相关 API/错误投递 exact-set、对应测试。UI 允许修改现有 ProjectSettings 奠基/重试和错误卡消费，不新增设置页或共享设置字段；本轮源码 `App.tsx` 的 psettings 路由确实进入 ProjectSettings，未来仍须核实正式路径。不是“设置页完全不能改”。canonical 限统一方案 §3 列出的 03/04/09/10/11 与 modules/b；已有 09 类型从 contracts 共享，不另造 DTO。

排除：PG-01B 的 net 业务范围、共享 schema/UI、`knowledgeShare`、projectOverrides 新字段、DDL、Gate 0/S3/trust 枚举/blocked 原因改变、通知中心、provider/runtime/安装器扩展。shared liveTools/09/10/11 只基于 PG-01B 合并后版本改本批 exact-set。新增拒写事件只存允许的 kind/digest，不能提前宣称 PG-04 整体关闭。

| ID | 必须实现的结果 | 必测反例/边界 |
|---|---|---|
| M1 | 窄凭据字面量检测置于 MemoryLedger.add/classify/insert 之前，覆盖 supersedes 与 remember；所有实际写入口共用一套规则 | user_stated/requestedTrust 不能绕过；拒写不 insert、不在日志/错误/TTS 回显原文；不因一条拒写停整个项目 |
| M2 | foundation 对所有将落盘的声明原文（excerpts、现场 .cursor/rules、package scripts、justfile 等）在首次 raw staging 写前检查；命中终止本次新 generation | 不先写再告警、不发布 partial 新版、不改旧 generation status/current.json；首次无旧知识不假称可保留 |
| M3 | 私有 write set 的 create-only ignore 和实际 Git 保护验证 | 等价规则接受不覆盖；tracked 目标停本次私有投影并保留文件/人工配置；不自动 git rm、不全目录强制字节全等、不自动清历史 |
| M4 | 非 Git、worktree .git 文件、根外 symlink、写失败/保护不足各有确定结果 | 非 Git 跳过 Git 查询仍有凭据检测；根外拒写；未知/失败不当受保护；不得以团队共享当无条件绕过 |
| M5 | 三类失败可区分：单条未保存、刷新失败仍用旧有效知识、首次暂无底座；修复源文件/保护后可用现有重试真正发布新一代 | 不把未更新说成成功；不要求重装或关闭保护；同一流程最小去重、不建通知中心 |
| M6 | 安全元数据仅向现有 UI 提供脱敏相对来源/行号/分类/处方；合法引用和占位符不误拦 | 不整表搬 TTS regex；env 引用、digest、ID、路径、泛长串不作为凭据证据；同形假 token 不承诺准确区分 |
| M7 | 扫描/Git 查询只在相关写入/构建边界；四行回报/成本中规定输入规模、调用次数/去重、缓冲及必要日志上限 | 不每轮全仓扫、不持续上报、不留命中原文；超界或失败按所影响写入的安全规则处理，不吞失败造成功 |
| M8 | canonical/schema/代码/正式 UI 路径/证据一致，保护上线后的恢复不静默取消要求 | 保留旧有效数据、用户文件和已建保护；不重放被拒内容、不自动删库/改 Git 历史；未测平台与 live 保留 not_run |

现有定向入口已核到：`pnpm --filter @saydo/daemon exec vitest run test/memory.test.ts test/memory-foundation.test.ts`；`pnpm --filter @saydo/contracts typecheck`；`pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts`；`pnpm --filter @saydo/console typecheck`。实际新增的 detector/Git/recovery/正式 UI 测试路径由 contract 阶段标 `[new]` 并冻结，建立后才能执行，不能只用旧测试通过声称 M1–M8 已覆盖。修改 schema 要有其正反例；修改 UI 要有正式入口的三态与恢复验证。

contract 文档/排产检查沿现役 `bash scripts/check-emoji.sh`、`node scripts/check-doc-links.mjs`、`node scripts/check-public-tree-privacy.mjs`、`node scripts/schedule-pointer.mjs --check`、`git diff --check`，以及实际受影响的链断言/mutation 入口；开批核准它们，不把四个文档门当作产品 CI。implementation 完整门遵守项目 profile 的 Node/Python 与浏览器基线；真实 provider/live/发行物另记，不外推本机绿。

### 3.5 选择新增候选时的合同生成规则

VOBS-01 被 owner 具名选中并入排产后，以统一方案 §4 的五项技术验收及资源约束冻结 A-ID：P50/P90 与样本下限、pending 上界与失败分母对账、模式/工具分组、近似时钟口径、现役事件路径；计数窗口、分组基数、已结算轮去重索引和聚合日志均有界。复用普通日志现有轮转，明确新增字段的输出频率与保留容量/期限，不增加逐轮原文或外部监控服务，不裁剪不可变审计。按代码实际测试目录核准 collector/voice-hub/live-dialog/Python 的 focused 命令。只调用 collector 的 fixture 不够证明生产接线；真实 provider 未授权时用明确标记的 fixture，不宣称真实首响改善。

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

按工具 schema 初始化/续跑 state、冻结有效 policy、acceptance、gate spec。具体 init/首次 implement/首审 receipt/修复的身份迁移按 §8，先登记真实 review completion 再运行独立 validator，不把尚未登记的初始 state 当已审状态。freeze 写入 ignore 后再计算 candidate 身份；control、cycle-state、原始日志不入 Git。coverage matrix 最多四个判断维度：正式入口/状态语义、边界与回归、证据与交接；覆盖 A1–A7 的有限正反例。

派发前运行完整 `cycle_control.py --preflight`，绑定 control-dir、cycle-state、handoff、coverage-matrix、expected HEAD/fingerprint/task/stage/cycle/ordinal。review 前后各运行 `candidate_fingerprint.py --expect <冻结指纹>`；漂移即失效，不算有效产品 RED。

reviewer 只获得固定 candidate、合同、coverage、canonical 和允许的测试入口，不获得实施自辩或旧 reviewer 推理。reviewer 只把原始报告写入本阶段已忽略的 `$CONTROL_DIR`，不向计入 fingerprint 的路径写入评审产物。唯一 `review-manifest` 包含 verdict、candidate identity、ordinal/scope、blockers、P2 delta、focused_gates、stop_reason。focused_gates 只含 `name/exit_code/summary`；supervisor 不执行 reviewer 输出的任意命令。

本阶段有效 GREEN、完整门禁及 `--finalize` 全部通过后，supervisor 才把原始报告与单列的机械收据归档到 `research/codex-findings/`，记录所评 candidate 身份和归档文件摘要。归档属于收口证据步骤，不是 reviewer 在冻结期间的写入路径；freeze、review、gate 期间不得提前向该目录写入新报告。

消费前运行 `validate_review_manifest.py`，绑定实际 HEAD/fingerprint、ordinal、cycle-state 和 task/stage/cycle。缺失、无效或坐标不符按程序性恢复处理，不捏造 GREEN。首次范围内可复现 P0/P1 且无需 owner 决策自动修一次；后续有进展按 policy 和持久预算续修，用全新零上下文 reviewer。P2 进唯一 ledger，不当轮扩修；最终只做一次 P2 sweep，随后仅跑受影响门禁，不另开通用复审。

完整门禁由 supervisor 运行原合同冻结命令，`cycle_control --record-gate` 持有日志/收据，不传调用方 `--gate-log/--gate-exit`。满足条件后 `--finalize`；没有当前 candidate 的有效 GREEN、完整 gate 或仍有活进程/部分写入时不得 finalize。远端必需门缺失按 `LOCAL_GREEN_REMOTE_PENDING` / `BLOCKED_REQUIRED_GATE`，不能说托管 CI 等效。

如果 owner 已明确授权提交，按项目 I/E 两提交法：先代码 I，再证据 E 记录 I 的实际 SHA，不自指；在干净的 post-commit release HEAD 上重跑合同完整门禁后才执行另获授权的 push/install。没有提交授权时保留可审查候选，证据指纹对应 dirty candidate，不能关闭依赖 evidence commit 的排产节点。

下一批只按 §1 的具名范围与 §3 的预先接受阶段继续；PG-01B 未合并不能跨进 AS，AS 收口不默认开 PG-02 或其它候选。本 Prompt 不消除 owner-stop。

## 6. 最终回复要求

先说哪些可见行为已经由代码和本轮命令验证，再对照四行说明报告实际回报、持续运行成本、用户负担、维护与停止条件；无实测的成本/改善明确保留未知，不将新能力数量作为收益证明。给候选工作区、真实 HEAD/fingerprint、review verdict 和报告路径、focused/full gate 原始输出摘要、未做项、是否提交/部署及下一步。不要把“执行和检查都跑完了，等你验收”写成已经交付；合并后才说交付。

每次回修按项目 journal 下一编号记录输入/行动/产出/结论。日志只记录名称、字节数与 SHA-256，不把 secret、完整本机路径或日志正文塞入提交文件。全仓零 emoji。

## 7. Workflow V2 合同

本 block 只定义执行预算与角色隔离；不能用它覆盖 §1 的选批、权限和排产边界。开新 cycle 时与 live policy 校验，活动 cycle 用 frozen policy；发生规则差异先按受控工具处理，不请求无依据 override。

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```

## 8. 各批共用的控制面机械接线（现有 API；不得跳步、不得合并互斥动作、不得新增 runtime）

先按当前选中阶段确定 `$TASK`、`$STAGE`、`$CYCLE`、`$CONTROL_DIR`、`$CYCLE_STATE`；`$HANDOFF` 为已通过 handoff 校验的本批执行副本。`$POLICY` 在新 cycle 初始化时取 live policy，freeze 后固定为该控制目录的 `policy.frozen.json`；活动 cycle 从一开始就使用其 frozen policy。下面 acceptance/coverage/gate/receipt 文件变量都指向真实文件，不是从归档 Prompt 复制的旧路径。

`cycle_control.py` 每次调用必须恰好一个动作（`--print-schema` / `--freeze-policy` / `--verify-freeze` / `--preflight` / `--check-coverage-matrix` / `--record-gate` / `--finalize` 等互斥）。`cycle_state.py` 每次调用必须恰好一个动作（`--init` / `--reserve` / `--start` / `--release` / `--advance`）。禁止把 `--preflight` 与 `--freeze-policy` 写在同一条命令里，禁止裸调用无动作的 `cycle_state.py`，禁止手改六个计数或 cycle-state 身份。

下列 `$NAME` 由 supervisor 在**启动现场**用真实命令填入后再执行；未替换的模板字符串不是可复制命令。现场生成后对照 `python3 ~/.octoworkflow/cycle_control.py --help`、`cycle_state.py --help`、`validate_review_manifest.py --help` 与 `--print-schema` 核验。本批用到的现有动作：`--init`、`--freeze-policy`、`--check-coverage-matrix`、`--preflight`、`--advance`、`--reserve`/`--start`/`--release`、`--record-gate`、`--finalize`，以及独立 `validate_review_manifest.py`。

**身份变量（必须区分，不得混用）：**

- `$HEAD_BEFORE` / `$FP_BEFORE`：init/freeze/首次 preflight 时的观测身份（实施写入前）。
- `$HEAD_CURRENT` / `$FP_CURRENT`：实施或修复写入后 `candidate_fingerprint.py` 的新身份。
- `$ORDINAL_STATE`：当时 cycle-state 的 `review_ordinal`。`--preflight`、`action=implement` / `repair` 收据的 `review_ordinal`、以及 `--expected-ordinal`（当命令校验的是 state 而不是待派 report）都用它。
- `$ORDINAL_REVIEW`：即将派发的 fresh review 报告的 `review_ordinal`。初审为 1；修后复审为当时 `$ORDINAL_STATE + 1`。不得跳号，不得因 fingerprint 变化清零预算。

**真实顺序：**

1. **准备 ignore 再 RECONCILE：** 先创建 `$CONTROL_DIR/.gitignore` 内容为 `*`（freeze 会幂等补全），再 `python3 ~/.octoworkflow/candidate_fingerprint.py`。这样 `$HEAD_BEFORE`/`$FP_BEFORE` 在 freeze 前后不变。控制产物、收据、报告、coverage、gate-evidence 都写在 `$CONTROL_DIR` 内，不得 `git add` 成 tracked；否则 `--record-gate` 会按观测 fingerprint 报 `diff_fingerprint_mismatch`。
2. **准备本阶段冻结构（真实文件，不是占位字符串）：**
   - acceptance contract：`schema_version`（1）、`task`、`stage`、`cycle`、`required_dimensions`、`acceptance_items[]`（`id`+`severity`∈P0/P1/P2）、`required_gates`。禁止 `command` / `run` / `prompt` / stdout / secret 字段。每个阶段一份，stage 名与 `$STAGE` 一致。
   - coverage matrix：`schema_version`、`task`、`stage`、`cycle`、`candidate_head`、`diff_fingerprint`、`dimensions`（精确等于合同 `required_dimensions`）、`acceptance_ids`、`cases[]`（`id`、`acceptance_id`、`kind`∈positive/negative、`coordinates`、`expected_outcome`、`evidence_ref`）。每个 P0/P1 item 至少一正一负；`kind=positive` 只能 `pass`，`kind=negative` 只能 `fail`；坐标向量不重复。PG-01B 仅覆盖 §3.2 A1–A7；AS contract 仅覆盖 §3.4 AS-C1–C4，AS implementation 覆盖 M1–M8；不能将另一阶段的 acceptance 混入当前矩阵。
   - gate spec：`schema_version`、`task`、`stage`、`cycle`、`gates[]`（`name` + `argv`）。`argv` 只能是长度为 2 的列表：`python3` 或 `bash` + **仓库内已存在**的相对入口。`just ci` 本身不是合法 argv。若要把产品门禁纳入 `--record-gate`，supervisor 须先写入真实可执行的仓内包装入口（包装必须实际调用下方产品命令，不得 echo 假绿），再冻结。`entry_sha256` 由 freeze 写入。
3. **init（必须 `--output`；freeze 要求 cycle-state 文件已存在）：**
   `python3 ~/.octoworkflow/cycle_state.py --init --task "$TASK" --stage "$STAGE" --cycle "$CYCLE" --expected-head "$HEAD_BEFORE" --expected-fingerprint "$FP_BEFORE" --output "$CYCLE_STATE" --policy "$POLICY" --followup-authorized`
4. **freeze（2.4.2 还必须绑定 acceptance contract 与 gate spec）：**
   `python3 ~/.octoworkflow/cycle_control.py --freeze-policy --policy "$POLICY" --control-dir "$CONTROL_DIR" --task "$TASK" --cycle-state "$CYCLE_STATE" --acceptance-contract "$ACCEPTANCE_CONTRACT" --gate-spec "$GATE_SPEC"`
   冻结产物 gitignore，不得 tracked。成功后 `$POLICY="$CONTROL_DIR/policy.frozen.json"`。
5. **coverage 核验，然后 preflight（两条分开；身份仍是 BEFORE，ordinal 为 `$ORDINAL_STATE`，初值为 1）：**
   `python3 ~/.octoworkflow/cycle_control.py --check-coverage-matrix --coverage-matrix "$COVERAGE_MATRIX" --acceptance-contract "$ACCEPTANCE_CONTRACT" --expected-head "$HEAD_BEFORE" --expected-fingerprint "$FP_BEFORE" --expected-task "$TASK" --expected-stage "$STAGE" --expected-cycle "$CYCLE" --policy "$POLICY"`
   `python3 ~/.octoworkflow/cycle_control.py --preflight --control-dir "$CONTROL_DIR" --cycle-state "$CYCLE_STATE" --handoff "$HANDOFF" --coverage-matrix "$COVERAGE_MATRIX" --expected-head "$HEAD_BEFORE" --expected-fingerprint "$FP_BEFORE" --expected-task "$TASK" --expected-stage "$STAGE" --expected-cycle "$CYCLE" --expected-ordinal "$ORDINAL_STATE" --policy "$POLICY"`
6. **实施本阶段授权写入**（范围与先设计后代码顺序按 §3，不将统一稿撰写当成产品实施）。未启动的无效预留用 `--release <kind> --reason preflight_invalid`。
7. **首次免费 implement 候选迁移（写入后、fresh review 前，强制）：** 再测 `$HEAD_CURRENT`/`$FP_CURRENT`。用 `action=implement`、`terminal=completed`、`cost_kind=none`、`consumed` 全 false、`review_ordinal=$ORDINAL_STATE` 的收据，把 cycle-state 从 BEFORE 迁到 CURRENT。这不是语义评审，不计 rereview 预算。`--advance` 的 `--expected-head`/`--expected-fingerprint` 用 **CURRENT**；绑定的 manifest 必须是 **BEFORE** 身份上的非 GREEN。
   CLI 要求 implement 绑定前一候选的非 GREEN manifest。空 `blockers=[]` 的 RED 会被 `validate_manifest` 以 `red_without_blockers` 拒绝（不得当作可执行占位）。当前工具已支持的初始登记方法：一份**机械未评审占位**，只为 `--advance action=implement` 记录「尚未评审不得放行」，字段为 `verdict=RED`、`stop_reason=initial-unreviewed-bootstrap`、`review_ordinal=1`、BEFORE 的 HEAD/fp、`review_scope=workflow-final`、空 `focused_gates`/`p2_ledger_delta`，以及 **一条 schema 所需的 P0/P1 blocker**（`id=initial-unreviewed-bootstrap`，`severity` 与冻结合同某一已有 P0/P1 `acceptance_item` 一致，`evidence` 用闭合 `file:line`，`in_scope=true`，`needs_owner_decision=false`）。这不是任何 reviewer 结论，不伪造产品 P1，不计语义评审，**不得**送到 `validate_review_manifest.py` 消费闸去授权行动，不给已发生 review 的 cycle 使用，不跨 cycle 冒用。`action=implement` 不会把该 blocker 写入 `current_blockers`。不得改全局脚本、不得裸手改 state、不得复用 GREEN 去 implement。连续免费 implement 换 candidate 会被拒绝。
   收据还须含 `schema_version`、`receipt_id`、`blocker_id_map=[]`、`evidence_refs`（闭合 `scheme:token`）、`task`/`stage`/`cycle`、`control_sha256`（`control.json` 原始字节 SHA-256）、`manifest_sha256`（解析出的 manifest 按工具 canonical JSON）。然后：
   `python3 ~/.octoworkflow/cycle_state.py --advance --previous "$CYCLE_STATE" --manifest "$BOOTSTRAP_REPORT" --receipt "$IMPLEMENT_RECEIPT" --expected-head "$HEAD_CURRENT" --expected-fingerprint "$FP_CURRENT" --expected-task "$TASK" --expected-stage "$STAGE" --expected-cycle "$CYCLE" --control-dir "$CONTROL_DIR" --output "$CYCLE_STATE" --policy "$POLICY"`
8. **更新 coverage 身份并 preflight 新候选：** 把 coverage 的 `candidate_head`/`diff_fingerprint` 改成 CURRENT，`--check-coverage-matrix` 与 `--preflight` 都用 CURRENT 与 `$ORDINAL_STATE`（此时仍为 1，rereview 尚未消费）。
9. **fresh review：** 实施线停止。supervisor 派**一名**全新零上下文 Codex reviewer，报告 `review_ordinal=$ORDINAL_REVIEW`（初审为 1），身份为 CURRENT。同时最多 1 个语义子会话。
10. **同一 candidate 的 `action=rereview` 收据，再独立 validate：** 初审收据 `review_ordinal=1`、`consumed.rereview=false`、`cost_kind=none`、`terminal=completed`。先 `--advance`（机械记账，尚不采用 GREEN），`--expected-head`/`--expected-fingerprint` 为 CURRENT。再：
    `python3 ~/.octoworkflow/validate_review_manifest.py "$REVIEW_REPORT" --expected-head "$HEAD_CURRENT" --expected-fingerprint "$FP_CURRENT" --expected-ordinal "$ORDINAL_REVIEW" --cycle-state "$CYCLE_STATE" --expected-task "$TASK" --expected-stage "$STAGE" --expected-cycle "$CYCLE" --control-dir "$CONTROL_DIR" --policy "$POLICY"`
    消费闸非零即不采用评审结论、不派发下一步，按 `plan_recovery.py` 处理。不能要求新 RED 先与尚未登记的 `current_blockers=[]` 一致。两命令任一失败都保留证据，不手改 blockers 或换 policy。
11. **RED 修复（不得跳号、不得按 fp 清预算）：** 先 `--reserve repair` 再 `--start repair`（`--expected-*` 仍为当时 CURRENT）。修复写入后得到新 CURRENT。`action=repair`、`terminal=completed`、`consumed.repair=true`、`cost_kind=product`、`review_ordinal=$ORDINAL_STATE` 的收据更新 candidate；绑定的是**刚登记的那份 RED 评审 manifest**（不是 bootstrap，不是 GREEN）。然后更新 coverage 并按 `$ORDINAL_STATE` preflight 新候选。再 `--reserve rereview` / `--start rereview`，派 fresh report，`review_ordinal=$ORDINAL_STATE+1`，收据 `action=rereview`、`consumed.rereview=true`、`cost_kind=product`。独立 validate 用新 ordinal。有可核验进展时可在最多 3 次产品修复、最多 3 次复审内继续。
12. **final gates / finalize：** 语义 GREEN 之后。`--finalize` 的 `--expected-ordinal` 必须等于当时 cycle-state `review_ordinal`。若第 11 步刚把 ordinal 推进，须对同一 CURRENT 再用新 ordinal `--preflight` 一次以写出对应 runtime receipt。然后对冻结合同 `required_gates` 逐个 `--record-gate`（只传 `--gate-name` 与 identity，禁止调用方 `--gate-log` / `--gate-exit`），再 `--finalize --control-dir --cycle-state --manifest --gate-evidence` 加完整 expected identity 与 `--expected-ordinal`。门禁义项见本 Prompt §3 的选定阶段；文档门不能冒充 `just ci`。

临时合成 workflow smoke 只用于核验本顺序，**不是生产 review**，不得当作本任务 GREEN。
