# Phase 4 · Tier1 执行 + 回叫 — 验收证据(补记于 2026-07-25;此前漏落盘,两提交法对账修复)

> 注:本文件为回溯补记(教训:phase-4 evidence 当时未真正落盘)。全部证据可由 git log + 测试复跑复核;
> 代码提交与测试均为真实历史,补记只是把散落的证据归档成六段格式。

## 1. 测试命令与尾行输出

- `just ci`(2026-07-25 最近一次):`contracts 65 passed / daemon 331 passed`(含 Phase 4 全部模块)。
- Phase 4 期间逐步提交时的计数:4.1 末 daemon 236 → 4.5 末 daemon 271(见各提交信息)。

## 2. §12 条目 ↔ 测试对照(Phase 4 归属)

| §12 条目 | 测试 |
|---|---|
| §12-3 收据全生命周期/超时按档/nonce | policy-approvals.test + approvals-service.test |
| §12-5 outbox(settle 缺一不叫/dedupe/DND/取消冻结) | callback.test |
| §12-6 Tier1 取消子集(proof 齐备/晚到转历史) | tier1-operations.test |
| §12-7 Tier1 子集(崩溃重放/恢复钥匙) | storage-crash.test + summary-reconcile.test(reconcileOnStartup) |
| §12-9 运行时子集(tripwire/observedModel/argv 快照) | byoa.test(1.2b 落)+ tier1-security.test |
| §12-10 reviewTask/MergeProof/AcceptanceCheck | tier1-operations.test(评审回修后含 DB 对账基准回归例) |
| 安全反例(canary/digest 拦截/DNS-rebinding) | tier1-security.test(G1/G3/G4 全套) |

## 3. golden

Phase 4 收尾时 golden 为 PHASE1 5 条 + 执行中/回叫话术(#21/#23/#24/#28/#29b/#30/#31 等)——
5.3 扩为覆盖矩阵 43 条全过(golden-coverage.test),含逆风。

## 4. 截图清单

Phase 4 无 UI 面(console 归 Phase 5);4.0 预检脚本输出留 research/spikes/cursor-cli-tier1/。

## 5. 偏离与回写

- reviewTask.reject 落取消链(§6.1 边表无 failed 边;§13 返回词勘误挂下轮 canonical 回写)——综合评审 B5 暴露。
- steer:cursor_cli 无 live steer,按 §13 queued_delta 应答(v2.3 已知缺口,claude_sdk 顺延)。
- 迟到评审回修(2026-07-25):MergeProof 对账基准落库/protectedBranches 安全默认/取消返工冻结接线/
  canary 一次性核销/晚到事件数字感知比较/B6 不可达不误 snooze——全部已修(`e8e9876`/`e50668e`)。

## 6. 代码提交

`55dac30`(4.0) `51c4703`(4.1) `adb2569`(4.2) `59c7998`(4.3) `e47b783`(4.4) `319ba22`(4.5);
评审回修 `e8e9876` `e50668e`。
