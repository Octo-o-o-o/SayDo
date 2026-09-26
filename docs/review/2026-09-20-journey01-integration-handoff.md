# 2026-09-20 SayDo 剩余价值整合 + JOURNEY-01 参考旅程 · 交接报告

> 历史阶段快照：本文的未提交/未合并/门禁待验描述只对应当时阶段。2026-09-23已按owner授权本地合入main；当前收口状态见[本地集成记录](../../e2e/evidence/journey-01.md)。历史证据与未运行边界不改写。

> 候选未提交。主树/DAILY/consolidation 三方只读保留。自检不等于独立 GREEN;reviewer 未派发。
> 本文件不写绝对用户 home 路径;仓外日志与截图目录见任务目录 `repair2-evidence/SUMMARY.md`。

## 0. 冻结坐标

- 候选:本仓 worktree `SayDo-journey01-integ`
- HEAD:`25d96595cde150428b6840e450e15f11d50f021f`(与 main 相同;全部工作为未提交 dirty)
- `git-diff-v1` 指纹:不嵌入本文件(会自指失效);以现场重算为准
- dirty:约 191 条 `git status --short` 行(含本报告与旅程证据;亮暗基线截图计入 modified)
- `git diff --check`:本轮未重跑;上一轮曾干净
- 本轮**未跑** `just ci`、全量 `pnpm exec playwright test`、`just precommit`;不得把 focused 绿写成全门绿

## 1. 基线判定与三方保留

| 树 | 处理 | 依据 |
|---|---|---|
| main `25d9659` | 候选基点,全程只读 | 干净;`0880c49`(DAILY 基点)是其祖先 |
| DAILY `0880c49` + 原树 dirty | 文件级快照进候选,原树未动 | 原树未覆盖/未重置 |
| consolidation `49ed96f` + 原树 dirty | 只读来源,按符号/功能挑选 | 未整树 merge/copy |

## 2. 选择 / 跳过 / 复用 / 本轮修复

### 选入(consolidation → 候选)

- 语音屏障合同与实现:`packages/contracts/src/types/voiceBarrier.ts`、`packages/daemon/src/voice/{voiceBarrier,holdForConfirmQueue}.ts`、daemon 锚定接线、`pipeline` hub_client 屏障。
- 安全续接:`pendingAnchor`、`voiceAnchorFlow`、`chatAnchor`、`focusAnchorCoordinator`、`quiescedTranscripts`、`captureQueue`、`taskModalContext`、`themedVoiceHold`、`chatDraftEvent`。
- 实体入口:`focusEntryActions`/`resolveFocusLocate`、TaskModal nested task 读取与 prefill、Records 真线标题续接。

### 跳过(已裁决不搬)

- docs/09 §17 truth plane 全章、docs/11 §12.1 action-ledger 及其 `§17.2(b)` 引用(PG-02 范围)。
- consolidation 中审计/治理/平台/无关措辞勘误;mockAuth、假进度、LAN 403 重开、移动 S3 merge。
- 全仓 White 换肤、旧常驻右栏、投资人演示动作照搬。

### 复用(不新造)

- 既有四层语音协议与 `confirm.click`(receiptId+digest+decision);既有 `/api/tasks/:id`、`GET /api/focuses/:id`、`/api/tasks/:id/retry`、`/review/:tid`、`/p/:pid/task/:tid`、`/api/focuses/:id/fork`、`/api/obligations/:id/waiting-on`;既有 candidate→trusted 记忆链。
- 无独立采访 REST;采访只走同 sid `turn.text`。

### 本轮验收修复(B1–B4 / P2 / demo)

- **B1** HF `done_speaking.captureMode:"hands_free"` additive;空/非空分类 `asr.final` 结算 leftover,不遗留 legacy 计数。
- **B2** 切换 task/obligation 依赖互斥清列;DDL v32→33 用真实旧库数据 + 升级幂等 + 生产 `backup()` 恢复/失败边界(不 copy 运行中 WAL)。
- **B3** Chat 成功回调用当前稿,不用启动 payload 覆盖等待期新输入;浏览器 A→B、成功、离页返回仍 B。
- **B4** 生产 loader 并行 sessions/attention/task details;无任务 pending 包靠 `pending_confirmations.focus_id` 或 `sessions.primary_focus_id`;批准匹配 session/focus/pkgID/revision/receipt/digest;其它卡不能打开或消费;采访同 sid 真发。
- **P2 手机** 投影保留 `laneId`/`obligationId`。
- **P2 成本**「全部」合计用 `byProject` 全账本聚合;明细 300 窗可见且导出标窗口;docs/09 改口:byProject 不是月预算权威,月预算维持既有期间 API,不另发框架。
- **正本 demo** DAILY 页签已重绘(对话/产物/泳道/依赖/记录/上下文),headless 截图在仓外任务目录。

### 未做(如实)

- 完整 ChatComposer 嵌入 Focus 页(FocusPageRoute 尾 TODO 仍在)。
- 真实麦克风/云 ASR/多设备/owner 真人旅程:not_run。
- `just ci` / 全 Playwright 主控 / `just precommit` / commit / push / 远端 CI:本轮未跑或未授权。
- JOURNEY-01 PLAN-2 批卡仍「未开工」;本候选是其实施工件,不是收口,不是独立 GREEN。
- fixture Focus `foc_01F1XT0RE0F0CVS00000000001` 无 `action_execution_bindings`,GET focus.tasks/packages 为空;浏览器步不把该空列表当决策包闭环。

## 3. 门禁结果(仅本轮真实命令)

| 命令 | 结果 | 日志(仓外,无 hash) |
|---|---|---|
| contracts `voice-barrier-schema.test.ts` | 10 pass,exit 0 | `contracts-schema.log` |
| console focused 9 文件 | 50 pass,exit 0 | `console-focused.log` |
| daemon focused 6 文件(含 DDL/记忆 pack/互斥清列) | 50 pass,exit 0 | `daemon-focused.log` |
| pipeline `test_vad_handsfree` + `test_voice_barrier_quiesce` | 15 pass,exit 0 | `pipeline-focused.log` |
| 三包 `typecheck` | 全绿(先红后修,重跑 exit 0) | `typecheck-contracts.log` / `typecheck-console.log` / `typecheck-daemon.log` |
| `pnpm lint`(eslint packages + 本轮改动文件) | exit 0 | `lint.log` |
| daemon `voice-barrier` + `live-wiring.e2e` | 19+51=70 pass,exit 0 | `daemon-affected.log` |
| Playwright **仅** `e2e/console/journey-01-seven-step.spec.ts` | 2 pass / 13.8s | `playwright-seven-step.log` |
| `just ci` | **未跑** | — |
| 全量 Playwright | **未跑** | — |
| `just precommit` | **未跑** | — |

`typecheck.log` 是修前失败副本(缺 `direction` / `text` 收窄),以三包分文件重跑为准。

## 4. 七步诚实边界

浏览器走生产页面 + 生产 WS + 生产 GET:

- 同 sid 两条 `turn.text`(提需求 + 「受众是谁」我选:商业受众)
- GET task 包身份 `pkg_01F1XT0RE0A000000000000000` rev 1 digest `sha256:4fb516fa…`
- 负向:无匹配确认卡不打开 TaskModal
- B3 输入框离页返回仍「草稿B-等待中改的」
- 成本页「全部」+ 明细窗口文案 + 导出标窗口
- 任务表 / review / 记忆页可达

确认环签发、派发、`user_approved` 后下一回合 `compileLivePack` + `context_snapshot_uses` 由 daemon focused / live-wiring 覆盖,不把 fixture 卡或 handler 单测当闭环。

## 5. 排产

PLAN-2 指针块此前已同步 DAILY-01 插批(`active=DAILY-01-workbench-restore`,`next=JOURNEY-01`)。本轮不改指针、不宣称 JOURNEY-01 收口。

## 6. 风险

- DAILY dirty 未经其作者验收即被快照纳入。
- 亮暗 e2e 截图基线若被重录,reviewer 应抽查而非全信。
- 本文件旧版曾把 `just ci` / Playwright 50/50 / `just precommit` 写成已跑——**作废**。
