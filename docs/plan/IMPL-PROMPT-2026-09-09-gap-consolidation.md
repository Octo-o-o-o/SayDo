# SayDo 缺口收敛实施 Prompt(2026-09-09)

> 用途:交给一个全新会话完整实施。本文自足,不需要原对话。它由 Fable 在 2026-09-08/09 对下列材料逐项核验后写成:owner 提供的 deepseek-harness SD 建议(`docs/plan/2026-09-08-deepseek-harness-sd-borrowing.md`)、08-13 DSH 评估、09-05 工程统一方案与项目缺口审查、09-08 邮件通道评估、PLAN-2 现役链。**所有“仍成立”结论都在 main `25a9924` 上用源码核过;已修复和核验无价值的条目已回写到各原文档,本 Prompt 不再列出。**

## 0. 你是谁、先读什么、授权边界

你是 SayDo 的实施会话,按 `AGENTS.md` 的“普通实施由当前会话直接完成”执行;不自动升级为 supervised/impl-review 编排。先读:`AGENTS.md`、`.octoworkflow/project-profile.md`、`docs/README.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` 顶部指针块,以及本文引用的每个文件。

启动时运行 `git status --short`、`git log -1 --format='%H %s'`、`git worktree list`。本文写作基线:main `25a99242a3863ba24ba7fc7a4b382c880c2c18d6`;PLAN-2 指针 `active=none, next=PG-02, last_closed=AS-01-AS-02`。开工按真实 HEAD 核验,已闭合的跳过,不为旧基线倒退。

**主树可能挂着其它分支的未提交 docs/research(2026-09-05 起的 codex 研究文件)。主树只读/收口,施工一律在独立 worktree。** 不用 `git add -A`、不 `reset --hard`、不覆盖他人工作。

授权边界(owner 把本文交给你即授权 §2 全部条目与 §3 的“默认做”条目;§3 标“待 owner 具名”的不做):

- 可直接做:改代码、改 canonical、补测试、跑门禁、在 worktree 内提交本地 commit。
- 需要 owner 当次确认(交付候选后停下问一次,不跳过):合并到 main、push 私有归档、公开快照、rc/发布、常驻部署、PLAN-2 指针改动。
- 不做:真实 provider 付费调用、真人语音评测、迁移或清洗真实用户记忆、全局配置。
- 状态词纪律:执行状态永不说“完成/做完”;门禁跑完说“执行和检查都跑完了,等你验收”;合并后才说“交付了”。自检不算独立 GREEN。

**排产关系:** 本文条目不在 PLAN-2 唯一串行链内(链当前 next=PG-02)。处理方式与 AS-01-AS-02 相同:作为一个具名小批 `GAP-02-consolidation` 插在 PG-02 之前。你先按 §5 生成批卡并同步 PLAN-2/HANDOFF 指针(这是 owner checkpoint 之一),owner 确认后再开工;若 owner 在交付本文时已写明“同意插批”,则直接开工。不改 PG-02..06 批卡内容。

## 1. 起点:已存在的候选,先收口再新增

`../SayDo-wt-sd-borrow`(分支 `sd-harness-borrow`,基于 main `25a9924`)里有 Fable 2026-09-08 未提交的 SD-1/2/3 候选:16 文件 + 新增 `packages/daemon/src/memory/m0Confirm.ts`、`packages/daemon/test/memory-m0-confirm.test.ts`;`just ci` 与 Playwright 在无并发条件下全绿(见 `history/PROCESS-JOURNAL.md` R141)。

1. 先核对该 worktree 仍存在且 `git diff --stat` 与 R141 描述一致;若已被合并或删除,按 main 现状跳过。
2. 复跑 `pnpm --filter @saydo/daemon exec vitest run test/dialog-loop.test.ts test/memory-m0-confirm.test.ts test/tier1-cmd-effect.test.ts test/live-wiring.e2e.test.ts` 与 `pnpm -r typecheck`。
3. 以两提交法在该分支落本地提交:`feat(gap-02): SD-1/2/3 ...` + `chore(evidence): gap-02 sd`;不 push、不合并,等 owner。后续 §2 条目继续在同一分支上追加提交,最终一并交 owner 合并。
4. 复用而不重做:SD-1 的 `LedgerActionRecord`/`presentLedgerOutcome`、SD-2 的 `MemoryPendingPayload`/`confirmMemoryProposal`、SD-3 的 `PKG_SCRIPT_EXEC`,后续条目直接引用。

## 2. 必做条目(按顺序;每条含现状证据、目标、验收)

### 2.1 SD-2 尾巴:Console 确认卡 kind 与 daemon 对齐(小)

现状:`packages/console/src/components/redesign/types.ts:114-117` 的 `ConfirmKind` 有 9 个值,缺 daemon 已存在的 `memory`(SD-2 新增)、`project_anchor`、`expectation_ack`;`components/redesign/ConfirmCard.tsx:9-19,46` 用 `Record<ConfirmKind,string>` 查表,未知 kind 渲染成空前缀且无默认分支;`voice/useVoiceChannel.ts:637` 会把任意串喂进来。生产确认卡走 `pages/Chat.tsx:617` 与 `mobile/pages/CardPage.tsx:143`,需同样核对它们对 `memory` kind 的文案(“记忆 · 信息确认 · 不是授权”)。

目标:`ConfirmKind` 与 `packages/daemon/src/live/confirm.ts` 的 `SEMANTIC_MUTATION_KINDS ∪ NON_SEMANTIC_CONFIRM_KINDS` 全等,单源放 `@saydo/contracts`(硬规则 5);`KIND_GROUP` 有默认分支(未知 kind 显示“确认”而非空);`docs/11-ui-spec.md` 确认卡段补 `memory` 行。

验收:contracts 测试断言两端集合全等;console 单测覆盖 `memory` 与未知 kind 渲染;fixture 增 `memory` 卡。

### 2.2 AS-05 剩余 Git grammar:hooks 绕过(小)

现状(`packages/daemon/src/tier1/cmdEffect.ts`):`git -c core.hooksPath=…` 已判 S3(`:318,1007`);但 `git commit --no-verify`、`git commit -n` 仍是 `GIT_LOCAL_SUB` → `write_worktree`/S1 自动放行(`:48,1002`);`git push --no-verify` 仍与普通 push 同档 S2(`:415-437` 只识别 mirror/prune/delete/force)。全仓无 `noVerify` 处理。

目标:在既有 git 子命令分类内补有限 grammar:`commit`/`merge` 的 `--no-verify` 与 `commit` 的 `-n`(注意 `merge -n` 是 `--no-stat`、`cherry-pick -n` 是 `--no-commit`、`am` 无 `-n`,不得误伤)⇒ floor S2(`install_dependency`,target `git-hooks-bypass`);`push --no-verify` ⇒ 与 hooksPath 同档 floor S3(`delete_data`,target `git-hooks-bypass`)。风险只取较高者;组合短选项(如 `-am`)与取值参数区分;verify 冻结不因提级解冻。

验收:`test/tier1-cmd-effect.test.ts` 新增正反例:`git commit -n -m x`、`git commit --no-verify -m x`、`git merge --no-verify f` → S2;`git push --no-verify origin f` → S3;`git commit -am x`、`git cherry-pick -n abc`、`git merge -n f`、`git push --dry-run origin f` 不变。`docs/04-key-mechanisms.md` §5.1 表加一行“绕过 hooks 的 git 形态”。

### 2.3 SD-1/PG-04 止损:对话审计去原文(小)

现状:`packages/daemon/src/live/dialog.ts:1030` 的 `dialog.result_phrase_blocked` 把模型句子原文 `text.slice(0,80)` 写入不可变审计,`:1032` 同时写日志;同文件其它 audit(`:936/949/962`)已只留 `sentenceId`。`storage/dao/misc.ts:96` sink 原样序列化 meta。

目标:该 meta 改为 `{sessionId, sentenceId, textDigest: textDigest(text)}`;日志同改。不在本批做 PG-04 的 envelope/白名单(留给 PG-04),只堵这一处新增原文。

验收:daemon 测试断言审计行不含句子原文、含 digest;`grep -rn "text: s.text" packages/daemon/src/live/dialog.ts` 零命中。

### 2.4 VOBS-01:语音延迟观测准确性(中)

现状(`packages/daemon/src/obs/latency.ts`):`passPublish`/`passInternal` 只判 P50(`:132-133`),P90 算出不参与判定;partial Map 无容量/TTL,只在五段齐时删除(`:76,88,99`),abort/barge-in 轮永久滞留;报告只有 `n=completed`(`:56,126`),失败/取消/缺段轮从分母消失;completed 已有 500 上界(`:101`,已修)。

目标(按统一方案 §4 VOBS-01 原验收):

1. 样本 ≥20 且 P50 ≤1500 ms 且 P90 ≤2500 ms 同时满足才 pass;少样本、非有限/逆序时间戳给 `undeterminable`,不给 pass。
2. pending 固定容量 500、TTL 120 s;溢出/超时计数;重复/迟到事件不复活已结算轮。
3. 分母区分 started/completed/cancelled/timeout/missing_segment;按 origin(文本轮/PTT/免手/工具轮)打标,不混一个分布。
4. 报告字段名如实:`llm_first_token`/`tts_first_byte` 标注为“响应/整句合成完成的近似”,daemon 接收时间是跨进程代理;不改 WS 词表(要改先回 09 §10/§16)。
5. 用合成 fixture 验证:成功、P90 超限、取消、缺段、重复事件;经 `voice/hub.ts` 与 `live/dialog.ts` 的真实接线路径各验一条,不只直调 collector。

验收:`test/latency*.test.ts`(新建标 `[new]`)+ 现有 voice-hub/live-dialog 测试;`/dev/latency-report` 输出含新分母与 `undeterminable` 状态;`docs/03-architecture.md:62` SLO 句补“P50 与 P90 同判”。真实供应方基线 `not_run`。

### 2.5 VIEW-01:正式页面的失效刷新与局部失败(中)

现状(console redesign 四页):`hooks/redesign/useBoardPageData.ts:49-69` N+2 扇出;`:66-67` detail 失败转 null、`:99-100` 跳过该 Focus(事项凭空消失);`:150` effect 只依赖手动 `tick`;`useReviewPageData.ts:87`、`useFocusPageData.ts:142`、`useRecordsPageData.ts:117` 同样只有 tick。WS 侧 `confirm.card/confirm.resolved/focus.entity` 只改本地语音状态或侧栏(`shell/Layout.tsx:328-334`),四个 redesign Route(`App.tsx:49,82,86,88`)不订阅任何失效。旧版页面反而有 30 s 轮询(`pages/Board.tsx:164`)。`useBoardPageData.ts:83,88-91` 用 attention 颜色近似任务状态;`useFocusPageData.ts:111,119` tasks/memories 留空。

目标(统一方案 §4 VIEW-01,不做 VIEW-02 的聚合读口):

1. detail 失败保留该 Focus 并显示占位错误 + 重试;不再静默丢项。
2. 失效来源:本页动作成功后定向 reload;`focus.entity`、`confirm.resolved` 事件;`visibilitychange` 回前台/WS 重连时重取;有界兜底刷新(开批冻结上限,建议 60 s,后台标签页暂停)。请求去重、组件卸载 abort、晚到旧响应不覆盖新状态。
3. 颜色近似状态处显示“未知/待核实”标签,不伪装确定状态;不新增读口。

验收:console 单测(生产 hook + 合成 API):一个 detail 5xx 时 visibleFocuses 不减、出现重试;动作成功后请求发生;`visibilitychange` 触发一次重取;重复挂载卸载后无残留定时器/请求;晚到响应被丢弃。Playwright 定向用例一条。不宣称解决 N+2。

### 2.6 A11Y-01:TaskModal 与 redesign Modals 键盘闭环(小)

现状:`packages/console/src/components/TaskModal.tsx:425` 有 `role="dialog" aria-modal`,但全文件无 Escape/focus trap/初始焦点/焦点归还;`components/redesign/Modals.tsx:23` 连 `aria-modal` 都没有。仓内 `PairingOverlay.tsx:52,73-74` 与 `SetupWizard.tsx:970` 已有 Escape 实现可复用。

目标:两处补 Escape 关闭、焦点进入、Tab 环内循环、关闭后焦点回触发按钮;复用现有实现,不引入依赖。

验收:console 单测(Testing Library):Escape 关闭、Tab 不逃逸、关闭后 `document.activeElement` 为触发按钮;`docs/11-ui-spec.md` 弹窗段补一句键盘合同。

### 2.7 HOST-01:`saydo doctor` 只读诊断(中)

现状:`packages/cli/src/options.ts:5,32` 只有 `up|status|open`;`status` 只 dump 一个 `/health`(`cli/src/probe.ts:77`)。可聚合端点:`GET /health`(`daemon/src/index.ts:811`)、`GET /readyz`(`:838`,含 coreReady/voiceReady/pipeline/asr/tts/recovery)、recovery-only 的 `/health`/`/readyz`(`api/recoveryOnlyServer.ts:387,410`)、`GET /dev/latency-report`(`:930`,本机 only)。

目标:新增 `saydo doctor`:汇总已安装版本、实际运行 identity、state root 的脱敏标识(digest)、daemon/pipeline 可用性、配置生效世代、哪些能力不可用、下一步怎么恢复。只读:不发 provider 请求、不执行第三方 CLI、不打印 key/完整路径。判定能区分“服务没起 / 旧 runtime 还在跑 / pipeline 未安装 / 配置待生效 / 某上游降级”。

验收:cli 单测用 fixture 响应覆盖五种判定;输出可安全分享(隐私探针 `scripts/check-public-text-redaction` 口径);README 命令表加 doctor。不做 upgrade/uninstall(HOST-02)。

### 2.8 logger 背压隔离(小)

现状:`packages/daemon/src/obs/logger.ts:59` 每条 `appendFileSync`,无 try/catch,ENOSPC/EACCES 直接冒进业务调用栈;`obs/audit.ts:29` 同形态但审计**不可变**,不能改成可丢弃。

目标:普通 logger 改有界队列 + 异步写 + 写失败计数与降级(丢弃普通日志并在 `/readyz` 暴露 `logger_degraded`);审计 sink 保持同步且失败 fail-closed(抛给调用方),只补失败可见。不引入外部日志库。

验收:daemon 测试:注入写失败后业务调用不抛、计数递增、readyz 可见;审计写失败仍抛;`docs/modules/e-crosscutting.md` E3 补“日志可降级、审计不可”。

### 2.9 BYOA cage 分档类型化(小;08-13 D-14 与 AS-03 的最小前置)

现状:`packages/daemon/src/providers/byoa/cage.ts` 分档只在注释(`:2-5`),返回 `{bin,args,cwd}` 无等级字段;`byoa/provider.ts:456-462` 在审计 meta 里内联三元算 `cage: "tool-deny"|"write-sandbox"|"ask+tripwire"`。

目标:`cage.ts` 导出 `CAGE_LEVELS` 常量与 `CageLevel` 类型(含 `enforcement: "full"|"partial"`:tool-deny/write-sandbox=full,ask+tripwire=partial),provider 审计与 `/api/setup/cli-capability` 输出改引用该单源;不做 AS-03 的真实 CLI conformance 探针。

验收:测试断言四个 CLI 的等级与 argv 对应;capability 输出含 `enforcement`;`docs/09` §11 cage 段补字段。

## 3. 可选与待 owner 具名的条目

**默认做(小,顺手):**

- `mobile/confirmDecision.ts:44` 仍 `new WebSocket(daemonWsUrl())`,而 `net/remoteSurface.ts:51-53` 已把 `mobile_lan` 的 `/ws/` 判 `remote_voice_ws_forbidden`。先核实移动确认路径是否因此失效;若是,按 PG-01B 的 fail-closed 语义给稳定 typed unsupported 并在 UI 说明,不重开远程面。

**待 owner 具名(本文不授权):**

- 邮件出站通道阶段 A(`docs/plan/2026-09-08-email-channel-consolidated.fable.md` §4.1):核验为有价值小批,但要 owner 回答该文 §5 的 1–4 题;先改 04 §4 / 07 D11 / 09 §6.3 再实施。
- 08-13 DSH D-01(实发 messages 可从 transcript 重建):核验仍成立(`brain/dialogLoop.ts:472-488,800,823` 工具轮内容不进 transcript)。价值中低;若 owner 选中,最小形态是把工具轮 assistant/tool 消息 digest 落 transcript 并加重建断言测试,可与 PG-04 同批。
- Console WS `?token=` 明文(`lib/api.ts:49-50`):属 PG-01B deferred `DF-REMOTE-REOPEN`,本地环回下不动。

## 4. 明确不做(已核验,不要再花时间)

- VIEW-02 聚合读口、CQRS、换数据库;VOICE-01/02 流式(先等 2.4 的分段证据);READ-01 资料链、CONTEXT-01 gist、HOST-02 升级/卸载;AS-03 真实 CLI conformance、AS-04 循环诊断、AS-06 依赖 advisory、AS-07 披露(各自条件未触发)。
- PG-02..06 批卡内容(能力真相、gate 真相、审计 envelope、DB 迁移恢复点、准入)——它们在 PLAN-2 链里,本批不吞并;2.3/2.8 只是止损。
- 08-13 DSH 的 D-02/03/05/07/08/11/17/18/19/20/30/32/33/41 与 SD 文档“明确不提”四条:已回写为核验无价值/已满足。
- verify 冻结的间接 import 闭包;`pnpm ls` 归 S1 而非 S0。

## 5. 批卡、门禁与交付

按 PLAN-2 现役批卡格式给 `GAP-02-consolidation` 写批卡(depends_on `AS-01-AS-02` evidence;A-ID 沿用 G-B14(logger)、G-B12 部分(doctor);deferred exact-set 列 §3/§4 条目;scope roots 为 §2 列出的文件;focused gate 至少:`pnpm --filter @saydo/daemon exec vitest run test/dialog-loop.test.ts test/memory-m0-confirm.test.ts test/tier1-cmd-effect.test.ts test/live-wiring.e2e.test.ts test/logger.test.ts [new] test/latency-report.test.ts`;`pnpm --filter @saydo/console exec vitest run src/hooks/redesign src/components/redesign src/components/TaskModal.test.tsx`;`pnpm --filter @saydo/cli test`;`bash scripts/check-emoji.sh`;`node scripts/check-doc-links.mjs`;`git diff --check`。full gate:`just ci`;`pnpm exec playwright test`。evidence:`e2e/evidence/gap-02-consolidation.md`。

纪律:

- 先改 canonical 再改代码(2.1/2.2/2.4/2.6/2.8/2.9 各有 canonical 行);同一提交内文档与实现可共同审查。
- 先写可失败的回归,再实施;复用项目 vitest,不借外部运行时。
- **不要在 `just ci` 运行期间并发启动另一个 vitest**(共享测试临时根会互相清理,导致 mkdtemp ENOENT 假红;R141 踩过)。
- Playwright 会重写 `e2e/screenshots/**` 已跟踪截图,跑完 `git checkout -- e2e/screenshots`,除非本批有意更新截图。
- `*.log` 不入 Git;evidence 记日志文件名、字节数、SHA-256。
- 每条目做完在 `history/PROCESS-JOURNAL.md` 顺延轮次(R142 起)写“输入/行动/产出/结论”。
- 最终交付:逐条裁决表(做了/未做/为何)、`git diff --stat`、门禁输出、未验状态、owner checkpoint 清单(合并、push、指针)。不把候选说成交付。
