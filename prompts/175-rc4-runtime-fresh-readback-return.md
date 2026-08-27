# RC4 运行时 fresh readback 首次红灯返工

继续 prompt 170 的原实施会话，只在当前 worktree 施工。零上下文独立复审给出 No-Go：核心门禁全绿，但 hostile unknown rejection 全链仍有 6 个 P1。不得提交、推送、联网或修改无关文件。

## P1-1：object-like 不得折叠到 primitive sentinel

当前普通 object、cross-realm Error 或 `instanceof Error === false` 的 object-like failure 会与 primitive `42` 折叠到同一 `OPAQUE_FAILURE`。

验收：

1. 只有 primitive 才走 primitive sentinel；任何 object/function 都按原对象身份进入模块级唯一 WeakMap 投影。
2. 同一 object 在所有调用点得到同一受控叶子；两个不同 object 得到两个不同受控叶子；object 与 primitive 绝不共享叶子。
3. 不得 boxing primitive，不得为每个调用创建新 store。

## P1-2：Proxy 检测不得触发用户 trap，原 Proxy 不得作为叶子

当前 `instanceof` 与 `Object.getOwnPropertyDescriptor` 会触发 Proxy 的 `getPrototypeOf` / descriptor trap，部分安全 Error Proxy 还会原样返回；descriptor trap 抛错时同时产生 hostile projection 与 graph sentinel。

验收：

1. 在任何 `instanceof`、prototype、descriptor 或属性读取之前，以 Node 内建、不触发用户 trap 的方式识别 Proxy（例如 `node:util`.types.isProxy）。
2. 所有 non-revoked/revoked Proxy 直接按对象身份投影；不得执行 get/getPrototypeOf/getOwnPropertyDescriptor/ownKeys/toString/valueOf 等用户 trap，不得返回原 Proxy。
3. graph sentinel 只用于图宽度/深度/循环等遍历截断，不得表示叶子检查失败。hostile Proxy 只能产生其 identity projection，不得再附加 graph sentinel。

## P1-3：source wrapper 必须与 origin canonical 去重

当前普通 Error 被包装为 `ProcessGroupLifecycleError`，但 raw Error 与 wrapper 一起收集时得到两个叶子；只有 aggregate wrapper 被当 transparent。

验收：

1. 所有由 source failure 生成的 wrapper 都保留内部安全、不可被外部 getter 伪造的 canonical origin/cause alias。
2. walker 按 canonical origin 身份去重；raw+wrapper、wrapper+raw、重复 wrapper 均只有一个叶子并保持首见顺序。
3. 不得通过读取不可信 `.cause` 实现；alias 必须由模块内部 WeakMap/安全 own-data 建立。

## P1-4：work-only hostile rejection 不得原样逃逸

当前 work 失败、lease release 成功时，`settleWithLeaseRelease` 抛出原 hostile object；Tier1 catch 又在 lifecycle 分类前执行 `String(err)`，恶意 `toString` 可中断 contamination 与状态收口。

验收：

1. settle 边界先把所有 unknown rejection 归一为稳定 identity projection，再抛受控 lifecycle failure；work-only 也不得抛原对象。
2. 所有 catch 必须先 lifecycle 分类/污染/状态收口，formatter 只消费受控投影。全仓相关路径不得对不可信 error 使用 `String(err)`、模板插值、直接 message/stack/code 读取。
3. 对 hostile toString/message/valueOf 计数保持 0；最终状态与 contamination 仍准确落地，攻击文本不进入日志/审计/诊断。

## P1-5：child/Tier1 pipe error 全链必须按 unknown 安全处理

当前 `bindAgentStdioPipeErrors`、diagnostics、runtime child registry 和 Tier1 直接读取 `err.code`/`err.message`；primitive 还会进入 `WeakSet.add` 抛错。

验收：

1. EventEmitter 的 `error` 参数一律视为 `unknown`，统一先走 identity-safe projection。
2. 只有 object/function 才可进入 WeakSet/WeakMap；primitive 有稳定且不强制转换的分支。
3. hostile code/message getter、普通 object、primitive、non-revoked/revoked Proxy 的 emit 都不得从 listener 抛出；diagnostics 与 lifecycle failure 恰好记录一次，零 trap，零原文泄漏。
4. child registry、Tier1 executor、process lifecycle 必须共享同一 canonical identity 语义；不要各造一套弱化 helper。

## P1-6：恢复 Prompt 162 的 exact 回归

当前若干断言从 exact array/order/count 被弱化为 `contains`、`some`、`>=1`，会让 duplicate signal leaf 假绿。

验收：

1. 恢复四条全路径用例的 exact leaf count、exact order、exact identity、exact signal count；managed `signal + unreaped` 必须总叶子数恰为 2。
2. 补 hostile getter、普通 object、non-revoked/revoked Proxy、primitive、raw+wrapper 混合、pipe `code` getter 抛错的 registry/Tier1 全链用例。
3. 不删除或弱化现有 Prompt 162/170 断言；新测试必须先能在旧实现稳定复现红灯。

## 指定门禁

1. `pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts`。
2. `pnpm --filter @saydo/daemon test`。
3. `pnpm --filter @saydo/daemon typecheck`。
4. `pnpm exec eslint packages/daemon/src/processGroupLifecycle.ts packages/daemon/src/runtimeChildRegistry.ts packages/daemon/src/tier1/executor.ts`。
5. `node scripts/check-emoji.mjs`。
6. `git diff --check`。

沙箱权限造成的 test failure 只能标为沙箱红灯；主会话会在宿主机复跑。最终逐项报告实现、hostile trap 计数、exact leaf 断言与真实退出码。
