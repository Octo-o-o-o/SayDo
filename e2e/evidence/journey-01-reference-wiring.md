# JOURNEY-01 候选 · 参考旅程接线证据(未提交候选)

> 历史阶段快照：本文的未提交/未合并/门禁待验描述只对应当时阶段。2026-09-23已按owner授权本地合入main；当前收口状态见[本地集成记录](../../e2e/evidence/journey-01.md)。历史证据与未运行边界不改写。

> 范围 = 在 DAILY-01 在途工作版之上,把 consolidation 里仍有价值的语音屏障/安全续接/真实实体入口选入,并按 JOURNEY-01 scope 接通「提需求→采访澄清→决策包→批准→执行→证据验收→记忆复用」。
> 完成定义(本轮如实) = 缺陷 B1–B4/P2/demo 有对应实现 + focused 测试(含真实浏览器七步与负向、DDL 恢复、trusted 消费)绿 + 三包 typecheck/lint 绿 + 本文件按真实结果改写。
> **不是**独立 GREEN;**不是** `just ci` / 全 Playwright / `just precommit` 已跑。
> 本文件不写绝对用户 home 路径,不自指 SHA;候选未 commit。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做或受阻。

## 0. 坐标

- 候选:worktree `SayDo-journey01-integ`,HEAD `25d96595`,叠加 DAILY-01 dirty 快照 + consolidation 选择性移植 + 本轮验收修复。
- 主树 `SayDo` HEAD `25d96595`,全程只读。
- DAILY 树 `SayDo-daily01` HEAD `0880c49`,未覆盖/未重置。
- consolidation 树只作来源:`49ed96f` 起按符号/功能挑选,未整树 merge/copy。
- 排产指针仍 `active=DAILY-01-workbench-restore next=JOURNEY-01`;本轮未重跑 schedule-pointer。

## 1. 七步旅程 → 真实面与失败路径

| 步 | 页面动作 | 真实写口/读口(权威面) | 本轮实测 | 失败/边界路径 |
|---|---|---|---|---|
| 1 提需求 | Focus「在这件事里开口」→ Chat | 锚定后生产 WS `turn.text`(同 sid) | [ok] 浏览器发出 `七步提需求 …` | 锚定失败→pendingAnchor 保留草稿 |
| 2 采访澄清 | 同 sid 真发,不是草稿等同答复 | 现役采访无独立 REST;页面选项走 `sendText`/`turn.text` | [ok] 浏览器发出「受众是谁」我选:商业受众 | 无当前 sid→blocked,不自动发 |
| 3 决策包 | 生产 GET focus tasks + task detail package + attention/live | loader 灌 lookups;无任务 pending 包靠 pending.focus_id 或 session.primary_focus_id | [ok] GET task 包 `pkg_01F1XT0RE0A000000000000000` rev 1 `sha256:4fb516fa…`;[warn] fixture Focus tasks/packages 空(无 bindings) | 不从已执行任务反推包形成循环 |
| 4 批准 | 确认卡身份 session/focus/pkgID/revision/receipt/digest | `confirm.click`(receipt+digest+decision);屏幕强认证 | [ok] 负向:无匹配卡不打开 TaskModal;[ok] 身份匹配单测 + confirm present 用 extractFocusId ?? sessionPrimaryFocus | 跨 session/旧 receipt/其它卡不消费 |
| 5 执行 | 任务表真账 | GET `/p/:pid/tasks`;retry 仍走既有 POST | [ok] 浏览器任务表可见「报表导出 CSV」 | API 错误原文 toast;`merge_failed` 不误调 retry |
| 6 证据验收 | `/review/:taskId` | 既有验收面 | [ok] 浏览器 review 页可达 | projectId 读不到回落 `/review/:tid` |
| 7 记忆复用 | 记忆页 + compiler | candidate→trusted;下一回合 `compileLivePack` + `context_snapshot_uses` | [ok] 浏览器记忆页可达;[ok] daemon `memory-m0-confirm` 断言 user_approved 后进 pack 且有 uses | 不把记忆页空态当消费闭环 |

辅助:B3 Chat A→B 等待/成功/离页返回仍 B(截图输入框「草稿B-等待中改的」);成本「全部」用 byProject 全账本,300 窗可见且导出标窗口;正本 demo DAILY 六页签已重绘并 headless 截图(仓外任务目录)。

## 2. 验收证据(本轮真实退出码)

- [ok] `pnpm --filter @saydo/contracts exec vitest run test/voice-barrier-schema.test.ts` — 10 通过。
- [ok] console focused 9 文件 — 50 通过(`chatAnchorSuccess`/`costWindow`/`focusWorkLookups`/`taskModalView`/`focusEntryActions`/`mobile/data`/`useFocusPageData`/`FocusPage`/`FocusPageRoute`)。
- [ok] daemon focused 6 文件 — 50 通过(`ddl-v32-v33-backup`/`console-api`/`voice-barrier-hf-done`/`focus-daily01`/`confirm-card-identity`/`memory-m0-confirm`)。
- [ok] `uv --directory pipeline run python -m pytest tests/test_voice_barrier_quiesce.py tests/test_vad_handsfree.py -q` — 15 通过。
- [ok] 三包 typecheck 重跑 exit 0(修前 console 曾红,已修 `direction` 与 `"text" in card`)。
- [ok] `pnpm lint` exit 0。
- [ok] `pnpm --filter @saydo/daemon exec vitest run test/voice-barrier.test.ts test/live-wiring.e2e.test.ts` — 70 通过(确认环/派发权威链在此,不旁路生产 WS)。
- [ok] `pnpm exec playwright test e2e/console/journey-01-seven-step.spec.ts` — 2 通过 / 13.8s。
- [fail] `just ci` — 本轮未跑,旧稿「双矩阵绿」作废。
- [fail] `pnpm exec playwright test`(全量) — 本轮未跑,旧稿「50/50」作废。
- [fail] `just precommit` — 本轮未跑,旧稿「全绿」作废。

实体 ID 摘录(浏览器实测,见仓外 `seven-step-ids.json`):focus `foc_01F1XT0RE0F0CVS00000000001` rev 1;task `tsk_01F1XT0RE0TSKRDY0000000000`;package 如上;session `ses_STFX7HQFH0YSTSQV4BJHA4YVG0`。

## 3. 旅程内动作裁决(相对旧 toast)

- `pkg` 四动作、`interview_pick`:批准走生产匹配;采访走同 sid `sendText`,不是草稿工厂等同发出。
- `step_ok`/`billing`:pending 确认卡 modal 或 TaskModal 预填(可编辑,不自动发)。
- `review`/`s3_merge`/`merge_conflict`/`explain`/`open_focus`/`retry`:既有真实导航/REST。
- `dep_add`/`dep_undo`/`fork`/`locate`:DAILY 真面保留;切换 task/obligation 互斥清列。
- `standby`:排障 toast,非生产旅程动作。

## 4. not_run / 如实差距

- [warn] 真实麦克风、云 ASR、多设备、owner 真人全程旅程:未跑。
- [warn] Focus 页内嵌完整 ChatComposer 未挂载;入口仍是「在这件事里开口」经 pendingAnchor 进 Chat。
- [warn] fixture Focus 无执行绑定,浏览器步看不到该 focus 上的工作卡包列表;无任务 pending 包可见性由 daemon `console-api` + loader 单测覆盖。
- [warn] 托管 CI/远端 required:不 push,远端未运行。
- [ok] Gate 0 无 bypass;S3 批准仅屏幕强认证,语音不放行。
