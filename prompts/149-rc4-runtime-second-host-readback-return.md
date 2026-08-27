# RC4 运行时第二次主会话 readback 退回

你是原运行时实施会话。只在当前 worktree 修复，不提交、不推送、不部署，不改无关文件。继续遵守原计划、仓库 AGENTS.md 与本会话既有约束；禁止 subagent。

## 主会话最终读回仍为红灯

当前 `walkErrorGraph` 虽已改为 index 读取，但仍有以下可复现的语义缺口；当前测试中还有把错误行为写成期望值的用例。必须修正实现与测试，不能只加解释。

### R1 畸形、循环和预算截断必须保守且保留已读取叶

1. `AggregateError.errors` 不是数组时，当前把外层 AggregateError 当普通叶并分类为非 lifecycle；这是无法安全枚举，必须加入稳定 lifecycle sentinel。
2. 一旦 `markUnsafe()`，while 顶部立即 `break`。当 child slot 超预算时，已经成功读取并压栈的 bounded children 永远不再处理，因此可到达业务叶被丢失。要求：停止继续扩展不可信图，但处理已经安全读取/入队的节点，最终顺序中保留所有已读取且 identity 去重的业务/lifecycle 叶，并附加一次 sentinel。
3. 纯 self-cycle / nested cycle 当前因 `seen` 跳过而得到空叶且分类 false。没有可证明叶的循环图必须保守加入一次 sentinel；有真实叶的循环也需保留真实叶并只附一次 sentinel，不能静默当普通失败。
4. 非 Error 叶当前执行 `String(current)`；恶意对象的 `toString` 可抛错或不终止。不得调用不可信转换函数。用稳定、无攻击者文本的 typed/constant leaf 表示 non-Error 值。
5. `UNSAFE_ERROR_GRAPH_SENTINEL` 是公开可变单例。至少 `Object.freeze`，并保证调用者不能改变 name/message/code；若导出仅为测试也必须不可变。
6. 对允许的 `Error.cause` 图给出明确一致策略：若遍历，只能有界、cycle-safe、descriptor-safe；若无法安全读取则 sentinel，且不得丢失外层/已读取叶。当前仅在 `ProcessGroupLifecycleError.cause instanceof AggregateError` 时下钻，普通 cause 被静默忽略，不可保持这种偶然分支。

必须把现有以下错误期望改正：

```text
not-array AggregateError => 当前 false，目标 true + sentinel
self/nested cycle without leaf => 当前 false/空，目标 true + sentinel
over-budget graph => 保留预算内已安全读取叶 + 单一 sentinel
hostile non-Error toString => 不调用，有限同步返回
```

### R2 signal、business、unreaped 三类失败全部保真

1. `latchSignalFailure(current, err)` 当前 `return current ?? typed`，第二个及后续不同 signal error 全丢。改为 identity-deduped、有序聚合；同一对象只出现一次，不同对象都保留。
2. `finalizeInvocationWait` 当前只要存在 signal，就会忽略 distinct `unreaped`；无 signal 时又会在存在 business + unreaped 时只返回 unreaped。要求按确定顺序聚合所有实际存在且不同的叶：`business -> signal(s) -> unreaped/release`，identity 去重。
3. business 不存在时仍需保留所有不同 signal + unreaped；business 存在时保留其 `RuntimeInvocationError` 结构字段。
4. real-agent 与 managed 两条路径都增加至少：two distinct signals、business+two signals、signal+unreaped、business+two signals+unreaped、重复同一对象去重。断言 leaves 精确顺序、结构字段、lifecycle contamination、owner/job 保留、下一 spawn barrier、unhandled rejection=0。

## 可判定验收目标

- 所有 public 分类/flatten 调用对上述有限输入在同步有界时间内返回；不得调用 iterator、getter 迭代协议或 non-Error `toString`。
- 正常 256 层 plain/lifecycle 均正确；超预算/畸形/循环 fail-closed。
- leaf identity 不丢、不重、稳定顺序；sentinel 最多一次且不可变。
- real-agent 与 managed 的 business/signal/unreaped 不互相覆盖。

## 必跑门禁

逐条运行并记录真实退出码与摘要：

```text
pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts
pnpm --filter @saydo/daemon typecheck
pnpm --filter @saydo/daemon test
pnpm lint
node scripts/check-emoji.mjs
git diff --check 77d6cb417cfe577101ae401d079b2e84e5454c7c --
```

完整 daemon suite 本轮必须跑，不能再只跑聚焦子集。另加一个带 hostile `toString` 计数器（应为 0）、not-array、cycle、budget 已读取叶、business+2 signals+unreaped 的主审等价测试。完成后只报告改动文件、关键设计、逐条门禁退出码、剩余风险；不要宣称部署完成。
