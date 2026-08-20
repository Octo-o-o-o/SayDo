# T18b dialog CLI oneshot + 三形态卡回修复审

> 日期:2026-08-12
> 基线:`main` / `9a6e767013e5c11a04f70eaed47c9bddf0123185`
> 评审对象:`feat/t18b-oneshot-ui` 未提交工作树
> 前件:`research/codex-findings/55-t18b-oneshot-ui-review.md`
> 本文 supersede 55 号的终局裁决,但不改写其 No-Go 历史快照。

## 终局结论

**Go。A=0,B=0,C=1,OPEN QUESTION=0。**

C 级保留观察:启动预检到同目录 rename 之间,外部进程若越过 setup 写口并发改写
pending,仍存在 TOCTOU 可能。正常 self-restart 由单 daemon 协调且 activation digest 在
runtime 发布前会再次命中 active 文件;本观察不构成当前 A/B,也不影响本批交付。

## 55 号 findings 回修

| 项 | 回修行动 | 裁决 |
|---|---|---|
| A-1 activation 非原子 | config/.env 共用预检;任一失败两份均不晋升。文件全部 rename 后才发布 runtime;四槽 receipt/二进制任一不符则零子集发布、保留 staged 证据并恢复旧活动文件。无 active `.env` 的本转用 `bakPath:null` 表示回滚后仍不存在,禁止复活历史 secret bak。 | Fixed |
| A-2 高级流程只看 dialog | `failedSetupSlots` 统一检查 dialog/thinking/cheap/evaluator;基础卡与高级逐槽均在四槽全绿前不请求 restart,重启后再做一次四槽检查。 | Fixed |
| B-1 关键编排测试偏纯函数 | 实际组件调用统一复用 `activateStagedPlan` 与 `failedSetupSlots`;测试锁定 stage→test→restart 顺序、任一槽红灯零 restart、L26 先保存 hash 再重启、语音不可用按钮真实渲染。fake CLI 再增空白 reply 真进程反例。 | Fixed |
| C-1 Cursor auto-only 画像失真 | 资源画像与卡片共用 `cliUsableForPlans`;只有存在非 `auto` 模型才宣称可承担四槽。 | Fixed |

## 独立复审新增 findings 回修

### oneshot 运行时

- `confirmReadiness` 成功返回 `control:"await_user"`,oneshot 不再依赖并不存在的
  `ok:true` 才停止余下 action;canonical 签名也已改为 `i:{}`,并明示 session/turn 由
  ToolContext 自取。
- 格式重试强化指令合并进首条 system,不会在 256 KiB cap 下挤掉当前 user;
  provider 返回 `attemptsMade`,dialog 共享同一个全调用重试预算,不存在第三个进程。
- reply/action id 空白经 trim 拒绝;fake CLI 进程级反例实证空白 reply 只试两次、
  零 dispatch。action 失败、单 pending、await_user 立即停止和部分应用后不重试均有
  fake 进程反例。
- 未知 NDJSON 审计只记固定 shape 标签,不再把不受信 `type/subtype` 原文写入
  不可变审计。

### activation 与热刷新

- pending self-test gate 复核当前 config/env digest 与 registry activation;候选被改写后立即失效。
- runtime 登记以整个 activation 为单元预检;先晋升文件,再原子写 active registry。
  runtime 发布失败后依 activation digest 把候选放回 pending 并恢复本转 bak;无本转
  bak 则恢复为“活动文件不存在”。回滚失败时强制 recovery-only。
- 启动 probe、日志和 `daemon.start` 审计使用 `effectivePromotion`;中途 rename 后又回滚的
  config/env 投影为 `promoted:false`,不再伪报成功。
- `/api/setup/test` 后重解析全局 dialog provider。`dialogProviderFor` 存在时其 `null` 是明确热撤销,
  LiveDialog 不再回退构造期旧 provider。因此 active 自检绿灯与红灯都在同进程下一轮生效。

### console 如实呈现

- `probe=null`、live ASR 红灯、pipeline peer 断开、key 缺失和 WS 断开都禁用语音按钮;
  文本输入仍可用,页面区分“语音未配置”与“连接未就绪”。
- oneshot 轮次进度只消费现有 turn/thinking 事件,不伪造 assistant 文本;无终态的保守兜底为
  245 秒,覆盖两次 120 秒的合法上界。
- 三形态卡按真实 capability 生成,全 CLI 自检失败才降级为混合卡;双 ack 必须由用户
  分别确认。L26 在 restart 前先保存 `#/chat-new`,刷新协调不丢导航意图。

## 实际验证

- `pnpm ci:node`:exit 0。contracts 7 files/91 tests;console 14 files/97 tests;daemon
  94 files passed/2 skipped、1177 passed/4 skipped;typecheck、lint、emoji gate 全绿。
- `pnpm --filter @saydo/daemon exec vitest run test/setup-onboarding.test.ts`:32/32 通过;包含
  历史 secret bak 不复活与有效晋升三态投影。
- `pnpm --filter @saydo/daemon exec vitest run test/byoa-fake-cli.e2e.test.ts`:69/69 通过;
  包含 oneshot 空白 reply 两进程且零 dispatch 反例。
- `pnpm --filter @saydo/daemon exec vitest run test/t18a-cli-slots.test.ts test/live-wiring.e2e.test.ts
  test/setup-onboarding.test.ts test/recovery-only-process.test.ts`:100/100 通过;后续新增 bak 反例后
  相关三文件 95/95 再通过。
- `pnpm --filter @saydo/console test`:14 files/97 tests 通过。
- `pnpm --filter @saydo/daemon exec tsx test/byoa-smoke.mjs`:exit 0,真实 Codex 用时
  32481ms;`ok/resultOk/schemaValid/oneshotResultOk/rememberActionPresent=true`,
  `toolCallCount=0`,`voided=false`,`cwdEmptyAtSpawn/cwdUnderTmp/cwdCleaned=true`,
  `oneshotUnknownEventShapes=[]`。实录 envelope:

```json
{
  "version": 1,
  "reply": "已记下:买了乐高。",
  "actions": [
    {
      "id": "remember-1",
      "tool": "remember",
      "arguments": {
        "tier": "M1",
        "claim": "买了乐高",
        "trust": "user_stated",
        "projectId": null
      }
    }
  ]
}
```

- `git diff --check` 无输出;`scripts/check-emoji.sh` 输出 `[ok] emoji gate: clean`。

## 评审边界

- 55 号 Codex 对抗审为 `gpt-5.6-sol` / `model_reasoning_effort=max`,完整日志仅存本机忽略位。
- 两路独立复审分别检查 UI/编排与 runtime/security;它们提出的 A 级全部回修、B 级全部吸收。
- 未 push、未部署、未改常驻 runtime。
