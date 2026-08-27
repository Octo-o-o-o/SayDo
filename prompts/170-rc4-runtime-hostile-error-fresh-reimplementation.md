# RC4 运行时：hostile Error identity 全新会话重做

你是新的 `grok-4.6` 实施会话。上一运行时实施会话在错误 identity 条目上第二次独立复审仍红，按仓库制度已废弃；不要 resume 或替它辩护。只以当前 `<repo>` 的实际代码、下述复现和验收目标施工。

只修改当前 worktree。不要 commit、push、联网、发布、部署或启动 subagent；不要修改用户原始 dirty worktree。不要并行运行多个 daemon Vitest。

## 已独立验证的现状

- 干净主机与独立评审均通过目标三文件：213 passed / 1 skipped。
- 独立额外 8 文件运行时回归：136 passed / 1 skipped。
- 独立完整 daemon suite：127 files passed / 2 skipped，2030 passed / 6 skipped。
- 普通 Error 的同一对象跨 aggregate/cause/release 去重成立；两个同 message 的不同普通 Error 会保留；real-agent、managed、two-distinct、同一 Job、三错/四叶、stdoutTail 与 unhandledRejection 用例成立。
- 唯一 P1 是 hostile Error 被全局 sentinel 合并。不要重写已成立的运行时设计。

## 已验证 P1

`processGroupLifecycle.ts` 把所有无法安全读取 message 的 Error 投影为同一个全局 `UNSAFE_ERROR_GRAPH_SENTINEL`，随后按投影对象 identity 去重。

独立探针组合两个不同的 throwing-message Error 与一个真实 lifecycle Error：输入对象不同，getter 调用为 0，但结果只有 2 叶；冻结合同要求 3 叶，即两个 distinct hostile 投影叶加一个真实 lifecycle 叶。

## 必须实现

1. 对 object-like hostile Error/Proxy 按原对象 identity 建立稳定的安全投影，例如模块级 `WeakMap<object, SafeProjectedError>`：
   - 同一个 hostile 原对象无论在 aggregate、cause、work/release 中出现多少次，只保留一个投影叶；
   - 两个不同 hostile 原对象即使类型和可见信息相同，也必须产生两个不同投影叶；
   - 禁止按 message、类别或全局 sentinel 合并不同原对象。
2. 投影过程不得调用 getter、iterator、`toString`、`valueOf`、Proxy 自定义属性读取；revoked Proxy 也只能用对象 identity 安全投影。
3. 区分“某个 hostile 叶的受控投影”和“整个图结构无法继续枚举/超预算/空图”的图级 sentinel。一个 hostile 投影本身已经提供 fail-closed 叶时，不得再无条件追加额外图级叶；真实结构故障仍必须保留稳定图级 sentinel。
4. 保持确定性 first-seen leaf 顺序。两个 distinct hostile + lifecycle 的顺序须与输入首次出现一致；同一 hostile 重复出现不得改变后续叶顺序。
5. 非 object primitive 不得触发 coercion。若继续共享一个 primitive opaque sentinel，要用回归明确该合同；不能把它与 object-like hostile identity 混为一谈。
6. 保持预算 512/512、深层栈安全、cycle、AggregateError own-data、transparent lifecycle wrap、contamination、business failure 与 release failure 组合语义不退化。

## 必加回归

- 两个 distinct throwing-message Error + lifecycle：3 叶，两个 hostile 投影对象不同，getterCalls=0。
- 同一 throwing-message Error 经 nested aggregate/cause/work/release 重复：只留 1 个 hostile 投影。
- 两个 distinct revoked Proxy：保留 2 个受控投影，不抛出。
- 同一 revoked Proxy 重复：只留 1 个投影。
- hostile、普通同文不同对象、lifecycle 混排：first-seen 顺序稳定。
- 图级 structural failure/超预算仍只追加所需的稳定图级 sentinel，不吞已有 distinct hostile 叶，也不重复追加。
- 原 prompt 162 的四个 duplicate-leaf 主机断言原样保持，不得改期望规避。

## 门禁

先独占运行窄用例，再运行完整门禁；逐条报告真实 exit code 和计数：

```text
pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts
pnpm --filter @saydo/daemon test
pnpm --filter @saydo/daemon typecheck
pnpm exec eslint packages/daemon/src/processGroupLifecycle.ts packages/daemon/src/runtimeChildRegistry.ts packages/daemon/src/tier1/executor.ts
git diff --check
```

测试文件当前不匹配 ESLint flat config；不要声称它们已被 lint。以 Vitest、typecheck 与 `git diff --check` 覆盖测试文件。报告新增 hostile 组合的叶数、identity 关系、getter/coercion 调用数与 unhandledRejection 数。
