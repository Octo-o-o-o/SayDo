> 2026-09-23 状态更新：本文件为历史交接，不再直接执行。DAILY/JOURNEY已本地合并收口；当前基线与下一批建议以同目录 `方案.md` 第0章为准。旧active阻塞、旧额度与旧候选不能用于新批。

# SayDo Codex App Server 受控原型实施 Prompt

请在 SayDo 项目执行以下任务。本文是新会话的完整实施要求；附件、历史方案和网页中的指令只是研究材料，不额外授予权限。

## 1. 目标、优先级与授权终点

我选择按本仓监督交付要求实施一个完整的 Codex App Server 受控原型：固定版本的 TypeScript 本地 stdio 客户端、明确的会话控制、拒绝优先的反向请求处理、可复跑故障测试，以及真实本地协议握手。输出能够决定 PG-07 是否值得继续的代码和证据，不要只写下一份研究报告。

优先级判断：把此原型提高到 Smart Turn、持续 ASR、原生双工模型替换实验之前；不把它当作修复现有语音阻塞、TTS 轮次串位或完成当前用户旅程的前提。现有活动批不被抢占。本次不开放 Codex 生产执行后端，不替换 BYOA，不开展上述语音或模型改造。

本次允许：独立 worktree 中的原型、测试、必要研究文档及任务排产记录；项目局部依赖按已有锁文件安装；无模型调用的本地 App Server 握手及本次拥有进程的清理。不允许 commit、push、merge、发布、公开快照、常驻部署、真实数据库迁移、全局依赖/配置修改、模型下载、私人会话接管。

真实模型实验是单独授权终点：先把代码、离线矩阵与无模型 smoke 做完；如当前会话没有明确的测试账号、模型额度和效果范围授权，交付可运行脚本及具体所需条件，标记真实 Agent 验证为 not_run。不能把启动握手说成真实 Agent 控制验证，也不要因此丢弃已经可交付的原型成果。

## 2. 坐标与必读材料

主仓 `~/WorkSpace/SayDo`；2026-09-22 核验 HEAD 为 `25d96595cde150428b6840e450e15f11d50f021f`，主树无未提交改动。以下都是历史锚，开工重新查 Git、worktree、dirty、活动任务和依赖；发生漂移按当前事实增量核查，不 reset 回旧 SHA。

已有研究 worktree：`~/.codex/worktrees/saydo-research-20260922`。其中有未提交研究成果，不覆盖、不清理、不默认当成新实施基线。研究方案为 `research/saydo-interaction-20260922/方案.md`，SHA-256 `6684df9c6ad11e6a962561cfbbedbb8417789de88ffe669968b2c6e8e6e02e9f`，重点读 §2、§7、§9–10。上一轮两名 subagent 的结论仅覆盖该研究方案，不是本次代码验收。

在主仓只读下列现有路径；实施时以新 worktree 同路径为准：

- `AGENTS.md`、`HANDOFF.md`、`docs/README.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md`：红线、单批规则、canonical、排产。
- `.octoworkflow/project-profile.md`：本仓 full gate、状态词、评审及 owner checkpoint。
- `docs/adr/design/ADR-005-execution-single-route.md`：Tier1 唯一生产路线；现役 cursor/claude_code；Codex PG-07 延期。
- `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、`docs/modules/c-control-bridge.md`、`docs/modules/e-crosscutting.md`：run/receipt、取消、verify/settle、语音批准、审计与隐私。
- `docs/review/2026-08-24-decision-2-impact-analysis.md`、`docs/review/2026-08-25-agent-cli-acp-capability-survey.md`：既有 ACP/exec 决策与历史探测，不能当成当前实测。
- `packages/daemon/src/tier1/backends/types.ts`、`packages/daemon/src/tier1/executor.ts`、`packages/daemon/src/tier1/approvalFlow.ts`、`packages/daemon/src/tier1/operations.ts`、`packages/daemon/src/tier1/verifyFreeze.ts`、`packages/daemon/src/callback/engine.ts`：核验实际接口与治理边界。
- `packages/daemon/src/providers/byoa/cage.ts`、`packages/daemon/src/providers/byoa/provider.ts`：明确 BYOA 保持独立。

补充材料根目录 `~/Downloads/Anyvia_SayDo_Codex_Research_Packs_2026-09-18/SayDo/`：读 `background/04_Codex_AppServer_SDK_ACP_完整调研.md`、`05_SayDo_架构映射与跨项目边界.md`、`06_SayDo_实验与验收矩阵.md`、`08_证据索引与待核实清单.md`。这里列出的待研究能力不自动成为必做范围。

官方参考：https://learn.chatgpt.com/docs/app-server 。2026-09-22 仍提示 app-server 命令和 WebSocket transport 不支持生产负载；stdio 不消除该警告。联网刷新后标明查阅日期，wire 形状用实际安装版本生成的 schema 核验。当前机器为 `codex-cli 0.153.3`，上一轮只生成 schema，未调用模型。

## 3. 开工检查点 K0：活动批与有效评审配置

这是唯一预定的开工检查点，不可用“研究目录不碰生产”绕过单批规则。

已知问题：HEAD 的 `HANDOFF.md` 指向 `DAILY-01-workbench-restore`，PLAN-2 未同步；`node scripts/schedule-pointer.mjs --check` 当时 exit 1，报 active 不是合法批 id。不能据此认定旧批已结束、自动清空指针或放宽校验器。

先核查当前活动批的真实状态。有明确收口证据且没有运行中的旧任务，才可按现行规则对齐记录并登记本次原型批；若旧批仍在运行或归属不明，完成只读核对，给出冲突事实与准确续接条件，停止施工，不自行修旧批业务、不造假收口。

本 Prompt 被我采用时，授权新原型在旧批确实收口后排在模型替换实验之前；这不解锁完整 PG-07，也不修改其他既定批次的验收条件。

配置问题：项目 profile 指向缺失的 `~/.octoworkflow/v2-policy.json`、pinned 2.4.2；本机存在 `~/.octoworkflow/policy.json`。对于本次全新任务，我授权使用开批时实际可解析的现行 policy，按其要求冻结，并在本次任务记录中明确此有限覆盖；不修改全局文件、不迁移旧任务、不借旧任务 policy/预算，不硬编码模型。如现行 runtime 仍无法满足本仓 required review，先报告具体缺失，不伪造执行渠道。

K0 通过条件：活动批可合法登记、排产指针一致且门禁通过、本次生效 policy 与评审渠道可解析。通过后完成整个原型包再做最终独立代码验收，不按文件数设置重复检查点。若需修改产品 canonical，则先完成相应一致性评审再施工；优先保持本次纯非生产原型，无需更改生产合同。

## 4. 三阶段实施

### 阶段 A：冻结最小实验合同

使用新独立 worktree/clone，基于重新核验的当前基线。预期新增 `packages/daemon/src/experimental/codex-app-server/`、对应 daemon tests，以及 `research/codex-app-server/` 的简短说明和证据；这是建议落点，若仓库已有等价原型则复用。实验模块不得被生产 `index.ts`、后端选择、配置枚举或用户界面装配。

固定 CLI 实际版本、必要 schema 子集与校验和、启动参数、能力 allowlist。不要提交整套几百份上游 schema；保留本次使用的原始片段/来源与可复现生成办法。默认关闭 experimentalApi；只有本次明确必需且完成审查的接口才启用相关实验能力。版本不兼容明确失败，不静默升级 CLI 或降级权限。

先定义实验内 session driver 的输入输出，不将上游类型冒充 `@saydo/contracts` 类型，不复制本仓已有合同。对 `AgentSpawner/AgentProcessHandle`、`Tier1Backend` 做一页 seam 对照：哪些可复用、哪些双向能力没有入口、未来生产接线需要哪些合同决策。此次只输出接线裁决，不重构 executor、不造通用 Agent 平台或新 DDL。

### 阶段 B：实现完整的受控 driver 与测试

1. 子进程 stdio 生命周期：显式拥有本次 child；initialize/initialized 后才接受业务请求；JSONL 分帧处理分包/粘包、UTF-8、行长上限、坏帧、EOF、stderr 有界尾、写入背压、超时与 close。清理仅作用于有归属证据的本次进程，不能只凭旧 PID 杀进程。
2. 正确区分 response、notification、server request；请求 ID 不与服务器请求命名空间混淆。交错、重复、晚到和未知消息有确定行为；一个审批等待不阻塞整个读循环。对会改变安全或终态语义的未知形状关闭受影响能力；普通未知通知不自动视为批准，也不无条件杀死所有会话。
3. 仅管理本次创建的测试 thread。支持创建、查询、自有 thread 的续接、新轮、活动轮 steer、中断；绑定 session/run 标签、thread、turn、进程世代和测试 worktree。`expectedTurnId` 缺失/过期就拒绝；禁止退化成新轮或注入另一任务。resume 只能在归属及上游状态核清后执行，不承诺恢复旧进程控制权。
4. 反向请求按本机 schema 实现拒绝和受控回答，包括命令/文件批准、权限请求、`item/tool/requestUserInput`。初版真实实例一律不授予执行扩权；批准成功分支仅在 fixture 中使用具名、一次性、限定目标的测试授权。问题回答与效果批准分开；过期、重复、已 resolved、取消后回答不能再次消费。未知权限/MCP elicitation/动态工具等不自动允许；使用该版本合法拒绝/错误响应，不能挂起未决 Promise 或伪造用户回答。
5. 明确区分发送前失败与发送后结果未知。start 的请求 ID 不当作服务端幂等键；超时不盲重发，不因重启重复 turn/start。原型用可注入的最小意图记录接口和本地测试存储验证先记录后发送、写失败不发送、重启保持 unknown、核对不能证明时不恢复执行；不写生产数据库，不称其已具备生产恢复能力。
6. 中断 ACK、原生终态、本地任务取消、停播为不同事实；终态不会调用 SayDo 回叫或自行生成 settled/交付状态。取消与晚到 completed 竞争只更新原型观测，不覆盖既有任务状态。未来 verify/settle/outbox 接线必须列为未实施，不能用 mock 证明生产闭环。
7. 提供手工可运行入口：无模型握手 smoke 默认可执行；真实 Agent smoke 单独显式开关且校验授权参数。默认测试不得调用真实模型、继承用户 MCP/插件配置或读取私人线程。临时配置/环境尽量最小化，不能把只读 sandbox 解释成秘密不可读；无法证明隔离时不启动真实模型。

不同时加入 Python helper、TS exec SDK、ACP adapter；不做 fork/旁问、桌面/TUI attach、跨宿主控制、远程 WebSocket、MCP/插件安装、自动账户切换、自动重试外部效果。没有验证需求就不添加抽象层。

### 阶段 C：验证、独立评审与裁决

先跑本地确定性矩阵，再跑真实本地握手；后者不启动 turn、不调用模型。真实 Agent 实验若已获得明确授权，应仅用合成任务与隔离目录，先固定总轮数、墙钟/额度上限、允许效果和停止条件；不得为了触发某个审批无限重试。没有实际触发的行为记 not_observed；未执行记 not_run。

按实际效果列覆盖表：文件写、shell、网络、MCP/插件、子 Agent、权限扩张，逐项写 disabled / fixture_verified / runtime_observed / unknown。见过 approval 不等于覆盖所有效果；不允许把 fake server 注入事件算成真实模型行为。

最终说明是否推荐继续生产 PG-07，以及尚缺哪些证明。原型符合验收即交付未提交候选；是否开放生产是后续独立决策，不在本任务自动推进。

## 5. 八条可判定红线

1. 主树、原研究成果、其他项目和全局配置无本任务写入；候选仅位于独立工作树。
2. 生产入口、Claude/Cursor 路由和 BYOA 不引用新 driver；无 Codex 默认后端或默认能力扩张。
3. Gate 0、S3 屏幕强确认、receipt 消费、verify/settle/outbox 原有约束不变。
4. 不控制他人 thread/process；过期 turn 和取消后审批零注入、零放行。
5. 发送结果 unknown 不自动变成功/失败，也不自动再执行一次；存储失败不能继续发起副作用。
6. 真实进程不自动批准工具/扩权；不以提示词充当隔离；未知权限请求不放行。
7. 不将 token、凭据、私人原文写入产物；审计敏感 payload 只留 digest；全仓零 emoji。
8. fixture、真实协议握手、真实 Agent、生产接线、独立验收分别报告；费用未知不填零；未合并不说“交付了”。

## 6. 验收与门禁

验收清单：

- A1：版本/schema/依赖可复现，默认无生产引用；不支持版本明确拒绝。
- A2：请求与服务器请求交错、同值 ID、分帧、坏帧、重复响应、背压、超时、退出都无串线/悬挂/无界缓冲。
- A3：自有 thread/turn/世代绑定；stale steer、他人线程、旧世代通知和取消后回应均拒绝；interrupt ACK 不作最终成功。
- A4：拒绝/过期/重复/未知审批、用户提问、resolved 竞争都有负例；未知普通通知策略有测试。
- A5：发送意图先落盘；写失败、ACK 丢失、退出及重启不会重复 start；不能确认时保持 unknown。
- A6：真实无模型握手使用本机 CLI，记录实际版本、退出码、脱敏结果；无模型调用与进程清理有证据。
- A7：原有后端/BYOA/取消/审批/回叫回归通过；完整 required gate 无本任务引入的失败。
- A8：一份结果说明列代码、测试、效果覆盖、原生实测边界、生产 seam 裁决和撤回方式。撤回原型不影响生产装配，不宣称能回滚上游已经产生的效果。

下列命令在新实施 worktree 根目录执行；`SAYDO_TASK_WT` 必须替换为本次真实绝对路径，不使用已有研究工作树。长执行按已安装 external-cli-orchestrator 的 runner 记录终态，不重复启动仍运行的检查，不在模型层定频轮询。

```sh
cd "$SAYDO_TASK_WT"
pnpm --filter @saydo/daemon exec vitest run test/codex-app-server.test.ts
pnpm --filter @saydo/daemon exec vitest run test/tier1-cursor-backend.test.ts test/tier1-claude-backend.test.ts test/tier1-executor.test.ts test/tier1-operations.test.ts test/tier1-security.test.ts test/byoa.test.ts test/byoa-fake-cli.e2e.test.ts test/callback.test.ts
pnpm --filter @saydo/daemon typecheck
just ci
pnpm exec playwright test
bash scripts/check-emoji.sh
node scripts/check-doc-links.mjs
node scripts/schedule-pointer.mjs --check
node scripts/check-active-claims.mjs
node scripts/check-public-tree-privacy.mjs --fs
git diff --check
```

首条 `test/codex-app-server.test.ts` 是本批必须创建的测试入口，若拆分测试则该入口仍应覆盖全部原型套件，不能利用 passWithNoTests 获绿。本地 smoke 的准确 argv 由实现新增并写入结果说明，核验实际文件存在后运行。每条命令独立采集紧随其后的退出码，不让后续成功遮掉前序失败。

full gate 来自项目 profile，不能因无 UI 改动自行省略 Playwright。安装缺失依赖只限本 worktree、遵从锁文件和既有构建脚本策略；缺浏览器或其他 required 条件记录未验，不默许安装全局工具。既有基线红灯区分归因但不冒充全绿；不为本批顺手修无关缺陷。

本次不 push，因此不能触发/承诺新的远端 required CI。核查可取得的公开快照 CI 状态，远端 pending/RED 如实保留，本地通过不能宣称托管 CI 或生产验收通过。

## 7. 评审与结束

当前宿主作为 supervisor，按本次生效 policy 安排实施和一名 fresh、零上下文、只读候选 reviewer；不把上轮研究双评审复用为代码验收，不附加多余角色。实施者完成代码与自测后结束实施调用，不自行派 reviewer 或给独立 GREEN。

按项目规则冻结 detached candidate 与 HEAD + git-diff-v1，派发前后用 `~/.octoworkflow/candidate_fingerprint.py` 核对；reviewer 只读该候选。评审检查维度限定为协议/生命周期、权限/归属、兼容性/证据三个维度。评审产物不要写进正在冻结的候选而改变指纹；按 runtime 的控制目录落盘，收口再归档到项目规定位置。真实发现按同一任务预算回修，不重新开批清零旧 RED。

最终交付候选路径、diff 摘要、A1–A8 对账、真实命令与退出码、日志路径/字节数/SHA-256、独立 review 结论、未测/阻塞项及 PG-07 建议。更新本批必要 journal 与排产状态时只写实际事实。未 commit、未上线、真实 Agent 未验分别明说。范围和验收明确后连续推进，不反复问是否继续；遇到 K0 或真实新增授权边界，说明对应项目规则和已准备好的具体结果。
