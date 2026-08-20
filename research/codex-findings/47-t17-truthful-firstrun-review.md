# Go

T17b 已逐条回修本报告原 6A/2B。最终复核结论：A 级 0 项、B 级 0 项；允许合入。下列证据均取自 2026-08-11 最终工作树与真实命令结果。

## A 级回修

### A1 [Fixed] recovery-only 的 project override 自救链闭合

- 独立 recovery composition root 位于 `packages/daemon/src/api/recoveryOnlyServer.ts:131-425`，setup 写口额外以 `req.socket.remoteAddress` 强制回环，见 `:225-233`。
- 损坏 active 可先保存自身合法的 pending；重启后再处理存量 override，解除“配置与 override 相互阻断”的组合死锁，见 `recoveryOnlyServer.ts:405-412`。
- `GET /api/setup/project-overrides/invalid` 列出违规、整行删除受影响字段并签发五分钟快照 receipt；快照绑定 `SHA-256(projectId + NUL + overrides_json)`，见 `recoveryOnlyServer.ts:99-125,260-287`。
- POST 强制 `receipt + projectIds + deleteWholeOverride:true`，复核 receipt、重复 ID、当前仍非法及行 digest 未变化；DAO 的 `requestedProjectIds` 已改为必填，不再存在缺省清全部，见 `recoveryOnlyServer.ts:314-400`、`packages/daemon/src/config/projectOverrides.ts:151-164`。
- Console 明示每个项目会删除整份覆盖及 `affectedKeys`，并原样提交 receipt/IDs/整行确认，见 `packages/console/src/components/SetupGate.tsx:127-175`、`packages/console/src/lib/setupApi.ts:517-575`。
- 门禁级真实进程测试覆盖：损坏 active + 混合“非法 dialog/有效 budget”行、未先列出直接 POST 被拒、GET 后行变化使旧 receipt 409、刷新 receipt 后成功、数据库行确实删除、重启回 normal 并真投首跑，见 `packages/daemon/test/recovery-only-process.test.ts:242-368`。

### A2 [Fixed] recovery-only 为 inert composition root

- `packages/daemon/src/index.ts:251-264` 在任何业务装配前进入独立 recovery root；managed workspace、业务 HTTP/WS、Session/LiveDialog、恢复器、sweep、降格 saga、Tier 1 与 ntfy 均只在 normal 分支内，`ensureManagedWorkspaceRoot()` 也在 `:265` 之后。
- 可控运行时进程测试预置六类 durable 行、过期确认/包/outbox 与 ntfy trap，断言全表计数与关键行零变化、零 interval、零 child fetch、零 ntfy、零 managed projects 目录，且业务 API 503、WS 拒绝，见 `packages/daemon/test/recovery-only-process.test.ts:135-240`。

### A3 [Fixed] 四个 API 槽统一在适配器边界复核 observed family

- resolver 把同一 `resolveFamily()` 结果作为 `expectedFamily` 传到适配器，并统一落 `provider.observed_model_rejected`，见 `packages/daemon/src/providers/resolve.ts:22-84`；四槽生产 resolver 均透传 audit。
- `packages/daemon/src/providers/openaiCompat.ts:123-147` 在解析正文与 `tool_calls` 前优先校验响应 `model`；缺失、不可解析、家族冲突即 fail-closed 并审计，组合畸形正文不能再抢先绕过审计。
- 精确四槽 exploit fixture 使用命名端点 `family="claude"`，而配置与响应均为 GPT，四槽均按 endpoint family 拒绝并逐槽审计，见 `packages/daemon/test/slot-resolvers.test.ts:132-182`。
- 三个组合反例覆盖“missing model + 空 choices”“unresolved model + 畸形 tool”“mismatch model + 空 choices”，见 `packages/daemon/test/provider.test.ts:141-177`。

### A4 [Fixed] 空 HOME 首跑资格先于内部审计持久化

- `packages/daemon/src/index.ts:203-208` 先构造并执行 `initializeEligibility()`，之后才 bootstrap config/audit；内部 setup/restart 审计不再杀死已经落盘的 `eligible`。
- 门禁级真实进程测试完整覆盖“空 HOME→配置→重启→`/chat-new` 查询→固定开场白真投”，并检查响应丢失回放、第二次进程重启及唯一 audit，见 `packages/daemon/test/first-run-process.test.ts:23-116`。

### A5 [Fixed] once 回放稳定，marker 只在消息真正接纳后消费

- `packages/daemon/src/api/firstRun.ts:67-118` 使用 `presenting→presented` 可恢复提交；同一 session 对 presented marker 稳定返回同一 `turnId/message`，不重复落轮。
- `packages/daemon/src/live/dialog.ts:491-540` 仅在 durable `sessions.onUserTurn()` 成功后调用 `onUserMessageAccepted`；生产接线在 `packages/daemon/src/index.ts:2020-2026` 单点更新 marker，handler 不再提前消费。
- closed session 拒收不通知回归见 `packages/daemon/test/live-wiring.e2e.test.ts:262-276`；recovery 无 WS 且 first-run 查询 503，进程测试确认 marker 保持 eligible。
- Console 可从同 session durable 回放重新呈现；Playwright 覆盖 Chat 卸载、重挂与整页重载，见 `e2e/console/console.spec.ts:130-157`。

### A6 [Fixed] TranscriptTurn.origin 三层持久化

- contracts 仅增加可选 `origin: z.enum(["onboarding"])`，见 `packages/contracts/src/types/project.ts:47-66`；缺省/onboarding/词表外反例见 `packages/contracts/test/schemas.test.ts:29-33`。
- append 保留 origin，见 `packages/daemon/src/session/manager.ts:94-112`；history rebuild 保留 origin，并覆盖 durable state 仍为 talking 的崩溃重启，见 `packages/daemon/src/live/voiceSessions.ts:78-139`。
- JSONL、suspend/rebuild、关闭并重开 SQLite/manager/live 的真实进程重建三层断言见 `packages/daemon/test/live-voice-sessions.test.ts:53-91`。

## B 级回修

### B1 [Fixed] 旧 BYOA 当前时态迁入 Future/History

- `docs/07-tech-stack-decisions.md:221-250`、`docs/09-data-contracts.md:1147-1160,1176-1178` 已明确为 Future/History，不属于 P0 当前合同或测试清单；T17 当前合同与测试位于 `docs/09-data-contracts.md:1136-1145,1164-1174`。
- `packages/console/src/components/SetupWizard.tsx:928` 已改为“仅展示只读画像,当前不能选择 CLI;请在下面改配 API”。

### B2 [Fixed] 用真实组合验收替代 helper 假绿

- recovery HTTP/WS/副作用矩阵与自救重启链：`recovery-only-process.test.ts:135-368`。
- 空 HOME 配置/重启/丢响应/再重启链：`first-run-process.test.ts:23-116`。
- 四槽生产 resolver→adapter→audit：`slot-resolvers.test.ts:132-182`。
- durable 接纳边界：`live-wiring.e2e.test.ts:262-276`；origin 三层恢复：`live-voice-sessions.test.ts:53-91`。
- 原弱自检已改为逐槽真实合法/非法输出断言，见 `packages/daemon/test/setup-onboarding.test.ts:614-670`；Console mount/reload 验收见 `e2e/console/console.spec.ts:130-157`。

## 最终复核与验收矩阵

- 两路独立终复核：runtime 为 A=0/B=0、Go；contract 为 A=0/B=0、Go。runtime 另记录一个非本批阻断 C：`config-project-overrides.test.ts` 以随机 ULID 排序推断插入序，单文件复跑 10/10，本次全量门禁亦通过，留后续去抖。
- Codex 对抗审 48 初审发现 A1 的“先列出”未由服务端绑定且整行删除未明示、A3 的畸形正文可绕 observedModel 审计两项 A；两项均按其最小修法回修，证据见上。原始发现与 triage 保存在 `research/codex-findings/48-t17b-truthful-firstrun-fix-review.md`。
- `pnpm ci:node` exit 0：typecheck、lint、emoji gate 全绿；contracts 7 files/87 tests，console 6 files/65 tests，daemon 91 files passed/2 skipped、1030 passed/4 skipped。
- 定向 `pnpm exec playwright test e2e/console/console.spec.ts --grep "first-run presented 回放"`：1 passed，10.1s。
- 全 Playwright 套件曾运行为 9 passed/16 failed；失败来自既有空 HOME setup gate 拦截旧用例及旧 fixture/route 漂移，不属于 `pnpm ci:node`，本批新增 first-run 用例随后单独复跑通过。此项不改写成全套绿色。
- `git diff --check` 与 `bash scripts/check-emoji.sh` 均通过；未 push。

## 结论

原 6A/2B 全部 Fixed，T17b 改判 **Go**。当前无 A/B 残留。
