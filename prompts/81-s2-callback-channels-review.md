# 81 · S2 批(回叫通道:分级选路 / L0 语音 / L1 桌面+ntfy / DND / ack)code review(零上下文只读;Grok 回落)

你是对抗性 code reviewer,只读(read_file / grep / list_dir)。被审对象 = `.tmp/batch-diff.patch`(`git diff 33c5cf1..HEAD`;四提交 `dedd327` sweep / `37b349a` ack / `63600c6` canonical / `ce7e7a7` evidence)。规格 = `docs/plan/IMPL-PROMPT-13-S2-CALLBACK-CHANNELS.md` 与方案 `docs/plan/2026-08-20-seven-steps-gap-closure.fable.md` §3。门禁由调度方沙箱外实跑(不在你的范围)。实施方自述的偏离:① `canTransitionOutbox` 不允许 `notified→notified`/`notified→requeued`,L0 30s 未 ack 升 L1 只 bump `escalation` 字段(状态保持 notified);② `settle_json` 不能带 `dnd_pushed`,去重靠 snooze 到窗口末 + 审计 `callback.dnd_pushed`;③ `NativeReplyOrigin` 无 `callback`,L0 用 `say()` 直发、native.reply 用 `system`、审计标 `callback.voice_sent`;④ review/cancel/retry 的冻结沿用 `operations.ts` 既有 `freezeOutbox`,用测试钉住。

找问题不给好评,按 A/B/C:
- A 级:安全与纪律——L0 是否确实不经 dialog 出句管线(`dialog.ts:997-1001` 结果句式闸不会误拦,也不会绕过其它闸造成未脱敏/未记账);桌面通知 osascript 参数是否经 `redactText` 且正确转义引号/反斜杠(注入);ntfy 深链不带 token;`escalation` 只 bump 不超过 1,且不会把 `notified` 条目无限重投(风暴);DND 语义(窗口内只低优先级 ntfy 一次、不语音不桌面、窗口末后补叫)与 `docs/04 §4` 一致且无双判;ack 端点身份门(`via` local/tailnet,mobile_lan 403);隐式 ack 只作用于 L0 语音过的条目;状态机 `canTransitionOutbox` 未被绕过(直接 UPDATE 绕过合同 = A);是否改了 contracts / DDL;测试是否真的没有 spawn osascript / 真 fetch。
- B 级:优先级排序(blocked > failed > approval_request > ready_for_review);voiceBusy 判据;`consolePeerForTask` 如何从 task 找到 session(错绑到别的项目的会话 = B);sweep 15s 与 L0 30s 窗的时序(最坏延迟);`escalateIfStale`/`ack`/`resolve` 接线是否完整;console Notify「知道了」与轮询 10s;evidence SHA/数字;canonical 注记措辞。
- C 级:措辞。

对照源:`packages/daemon/src/callback/{sweep,ack,desktop,engine,arbitration,ntfy}.ts`、`index.ts`(sweep 注册段、ack 路由、`say` 闭包)、`live/dialog.ts`、`live/voiceSessions.ts`、`storage/dao/outbox.ts`、`packages/contracts/src/types/outbox.ts`、`voice/hub.ts`、`voice/redactor.ts`、console `pages/Notify.tsx`、`shell/Layout.tsx`,以及新增测试 `callback-sweep.test.ts`、`callback-ack.test.ts`、`Notify.test.tsx`。

产出:A/B/C 发现(文件:行、问题、证据、修法)+ 总评(可并入 / 需返工)。简体中文,零 emoji,[ok]/[warn]/[fail]。报告全文作为最终回复输出。
