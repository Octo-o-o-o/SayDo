# SayDo W5.4-b C2b · Grok CLI 实施(session / canary / 记账 / 限流 / 恢复)

你是 `/Users/wangyixiao/WorkSpace/SayDo` 施工工程师。在**当前工作树**继续(分支 `main`,HEAD `11e3653`)。C1+C2a 均未提交。owner 授权基于工作区实施;**不 commit / 不 push / 不 deploy**。

C2a 已收口:daemon **1737 passed / 4 skipped**,`just ci` exit 0。产物含 spawn 分叉、`GateWireRequest` 联合、file 三态、并发 S2、双脚本 drift、`dev.agent` 放开 `claude_code`。C2a 汇报把下列项留给本阶段。

## 调度与沙箱

- Grok CLI:`grok-4.6`、`--sandbox workspace`。禁止 `git clean/checkout/restore/stash/reset/commit/push`。
- 禁止改 `deploy/`、`docs/release/`、`docs/site/`、`artifacts/release/`、live `~/.saydo/config.toml`。
- `just ci` 用 `UV_CACHE_DIR=/tmp/saydo-uv-cache`。不真调 claude。零 emoji。

## 必读

1. `docs/plan/IMPL-PROMPT-15-W54B-WIRING.md` §2 红线 + §3 C2 段剩余项
2. 方案 `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` §3.4 / §3.6 / §3.8
3. `docs/09-data-contracts.md` §11 claude_code 承载段(四元组、`native_session_confirmed`)+ §9 `tier1.run` + retry queue `slot=tier1/kind=tier1_run`
4. C2a 坐标:`executor.ts` `consumeEventLine` `:1486` 注释(init/rate_limit/tool_result 未消费);`checkCanaries` cursor 分支禁改

## 调度方对 C2a 上浮项的裁决(照此做,勿再上浮同题)

1. 并发 S2 作用在同一 run 全部 S2:**接受**(方案即 run 级)。
2. 生产 `index.ts` 恒把 `gate-claude.sh` 纳入 drift 集合:**接受**。
3. 敏感写口语外套「——对吗?」:**C3 再收**,本阶段不动 `buildConfirmPrompt`。
4. **`resolveRunModel` 接 `effectiveDevModelForAdapter`**:本阶段做(C1 注释点名 C2)。
5. `--session-id` 预生成 + 确认列:本阶段核心。

## 任务

1. **DDL 增量迁移**:`tier1_runs.native_session_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(IN (0,1))`。锚:v4-era fixture 升级后缺省 0、既有行不损(`packages/daemon/test/fixtures/schema-v4-era.sql` + 既有 migration 测试模式)。
2. **session 身份**:首跑 daemon 预生成 uuid → `--session-id` + 落 `native_session_id` 且 confirmed=0;`system/init.session_id` 对上 ⇒ 置 1 + 审计 `tier1.session_identity_confirmed`;不等 ⇒ kill + failed `native_session_mismatch`。恢复/续跑只认四元组 `(adapter, native_session_id, cwd, confirmed=1)`。`expectedResumeSessionId` 改名语义为 `expectedSessionIdentity` + `isResume` 布尔(审计字段)。`reserved` 行恢复重生成 uuid 覆写。cursor 仍三元组,零行为变化。
3. **`apiKeySource !== "none"`** ⇒ 立即终止 + failed `subscription_auth_violation`(收到 init 即判)。
4. **observedModels**:`run.observedModels: Set<string>` 收集 init.model 与 assistant.message.model;settle 时 `familyOf` 全为 claude 且非空才过;`run.observedModel` 取 init.model。四字段进 `tier1.settled_review`/`blocked`/`failed` 审计 meta(`observedModelSource:"stream"`、`observedModelExempted:false`;additive,不改 DDL)。
5. **canary 左值按 backend**:cursor 仍 `shellStarted`,`checkCanaries` cursor 分支禁改;claude = 门后 `tool_result` 计数(按 tool_use_id 反查封闭集);右值 `gateSeq`;两 tick 差 trip。三方对账进审计只记不 trip:`permission_denials.length >= 门 deny 数`。
6. **记账**:settle/blocked/failed 路径消费 `buildTier1SubscriptionCostEntry` → `recordTier1SubscriptionRun`(W5.4-a 纯对象);cursor 同步补 `kind=tier1.run`。
7. **限流**:`rate_limit` / 终态词表 → blocked `subscription_rate_limited` + 审计 + `subscription_retry_queue` enqueue(`slot=tier1`,`kind=tier1_run`);replayer=`retryTask`;绝不静默转 api 计费。
8. **恢复/续跑**:`queued_delta` 与 recover 查上一条 run 四元组等值且已确认才 `--resume`,否则新会话并审计 `tier1.resume_skipped_<reason>`。`resume_not_found` ⇒ 审计 `tier1.recover_resume_failed`,清 ownership 后新会话**只重试一次**。`row.adapter !== cfg.adapter` ⇒ reap + 任务 blocked(F-14)。cursor 三元组路径快照不变。
9. **`resolveRunModel`** 改吃 `effectiveDevModelForAdapter`。

C3 / live steer / 一发一收 init 自检 / 改 console 话术:不要做。

## 锚(IMPL-PROMPT-15 §3 C2 点名)

`tier1-executor.test.ts` 新增(相对 C2a 后再加)覆盖:认领→argv(含 `--session-id`/`--resume`)→事件→settle;canary 不误 trip(S2 等待期多 tool_use);resume mismatch;rate limited blocked + `subscription.retry_enqueued` 审计 + sweep 重认领;auth_required blocked;apiKeySource 拒;resume_not_found 降级一次;adapter mismatch reap。既有用例期望值零改动(含 C2a 新增)。`tier1-gate-socket` 既有+C2a 新增期望值零改动。

## 门禁与汇报

`tsc` / daemon vitest 全量 / `just ci` / emoji 显式清单,退出码写入汇报。列出文件一句、新增测试数、白名单既有改动(若有则上浮)、与方案冲突不自决。不 commit。
