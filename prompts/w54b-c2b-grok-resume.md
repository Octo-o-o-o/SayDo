续跑 C2b。上一轮进程在改 `executor.ts` 时无声退出(无 GROK-EXIT,约 2026-08-21 17:51),不要重做已落盘的地基。

## 已在工作树(不要重写,在其上接线)

- DDL `tier1_runs.native_session_confirmed` + v4-era 升级用例 `storage-migration-v5.test.ts`「v30」
- DAO:落钥匙时 confirmed=0、对账成功置 1
- `recordTier1SubscriptionRun`(`cost/ledger.ts`)
- `ActiveRun` 已有 `expectedSessionIdentity` / `isResume` / `observedModels` / `gatedToolResults`
- `checkCanaries` claude 分支已看 `gatedToolResults`;cursor `shellStarted` 分支保留
- `AgentSpawner.spawn` 已有可选 `sessionId`

## 明确未完成(本轮必须做)

1. `consumeEventLine` 仍停在注释「C2a 只接 parseLine」:`init` / `rate_limit` / `tool_result` 未消费,`gatedToolResults` 无人递增。接上:session 对账、`apiKeySource !== "none"` 立即 failed、observedModels 收集、claude canary 左值、限流。
2. 生产 spawn 调用传 `--session-id`(首跑预生成 uuid)或四元组满足时 `--resume`;cursor 三元组路径快照不变。
3. settle/blocked/failed 调用 `recordTier1SubscriptionRun`;限流 enqueue `slot=tier1/kind=tier1_run`;`resume_not_found` 只重试一次;adapter mismatch reap;`resolveRunModel` 吃 `effectiveDevModelForAdapter`。
4. `tier1-executor.test.ts` 按 IMPL-PROMPT-15 C2 锚新增(C2a 的 49 例期望值零改动)。
5. 门禁:`tsc` / daemon vitest 全量 / `UV_CACHE_DIR=/tmp/saydo-uv-cache just ci` / emoji。写完整汇报。不 commit。

禁止 git clean/checkout/restore/stash/commit;禁止改 deploy/docs/release/docs/site/artifacts/release。
