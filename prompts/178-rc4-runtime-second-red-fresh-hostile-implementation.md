# RC4 runtime 第二次红灯：全新会话 hostile identity 修复

你是全新的实施会话。不要读取任何 Grok/Codex/评审日志，不要 resume 旧会话，不要提交、推送、联网或改动用户原始 dirty worktree。只在本文件所在 worktree 内施工。

先完整读取适用 `AGENTS.md`、`prompts/170-rc4-runtime-hostile-error-fresh-reimplementation.md`、`prompts/175-rc4-runtime-fresh-readback-return.md`，再核对当前代码。当前常规门禁已由宿主跑绿，但独立 hostile readback 仍有以下四个 P1；必须全部关闭并增加不能被产品常量自证的回归。

## 1. 任意层级 Proxy 必须 trap-free

- 根值、`AggregateError.errors` 容器、errors 元素以及任意原型链含 Proxy 的普通对象，都不得在识别前触发 `get`、`getOwnPropertyDescriptor`、`ownKeys`、`getPrototypeOf`、`instanceof` 相关 trap。
- 禁止对不可信值先做 `instanceof` 或描述符读取再判 Proxy。
- 可使用 Node 22 的 `node:util/types` 安全判别能力，但必须用 hostile probe 证明：
  - Proxy errors 数组的全部 trap 计数为 0；
  - 自身不是 Proxy、原型链含 Proxy 的对象全部 trap 计数为 0；
  - non-revoked/revoked Proxy 都不作为原对象返回；同 identity intern 稳定。
- 图级 cycle/budget sentinel 与普通 hostile object identity 叶不得混淆。

## 2. pipe unknown 全链不得读原对象或泄漏原文

- `runtimeChildRegistry.ts`、`tier1/executor.ts` 以及相关 BYOA `packages/daemon/src/providers/byoa/runner.ts` 的 pipe listener 都必须消费 canonical projection；不得丢弃 projection 后再读原对象的 `code`/`message`。
- primitive、plain object、Error、accessor、function、non-revoked Proxy、revoked Proxy、`null`、`undefined` 均不得使 listener 同步抛错或产生 unhandled rejection。
- 普通对象 `{ code: "SECRET", message: "SECRET" }`、Error/Proxy/accessor 中的 `SECRET` 不得进入 message、stack、日志或最终诊断。
- 不可信 getter/toString/valueOf/ownKeys/getPrototypeOf 调用次数必须为 0；诊断使用稳定受控文本，并保留各 distinct identity 的次数/顺序。
- 给 BYOA 路径增加真实 listener hostile 回归，不能只覆盖 registry/executor helper。

## 3. distinct signal failure 不得丢叶

- 当前 `signalFailure ??=` 会丢第二次真实 signal 错误。持久 contamination 仍须 first-wins，但当前调用的瞬态聚合必须按 first-seen identity 保留每个 distinct signal failure。
- 双信号 hostile probe 必须得到 timeout/work 叶 + `signal-first` + `signal-second`，顺序固定、每个 identity 一次；相同 identity 重复仍只保留一次。
- 恢复被弱化的测试：`runtime-child-registry.test.ts` 中 signal leaf 数量不得用 `>= 1`，改回验收要求的 exact 数量/消息/顺序。

## 4. nullish primitive 也是 opaque work failure

- `null` 与 `undefined` 和其他 primitive 一样投影到 primitive opaque sentinel；walker/combine 不得用 nullish 过滤把它们当作“没有错误”。
- work-only rejection 为 `null`/`undefined` 时必须抛稳定投影，不逃逸原值。
- work=`null`/`undefined` + release failure 的双错必须同时保留 opaque work 叶与 release 叶，顺序为 work-first；不得退成 graph sentinel 或只剩 release。

## 不得回归

- plain object/function 与 primitive sentinel 分离；同一 object 跨调用稳定，不同 object 不合并。
- raw Error 与 wrapper 的 raw+wrapper、wrapper+raw、重复 wrapper 均 canonical 去重且 first-seen exact。
- Prompt 162 的 managed `signal + unreaped` 必须仍为 exact 两叶、顺序与 identity 固定。
- lifecycle contamination 持久 barrier first-wins；Windows/POSIX ownership、cycle/budget、settle/release 语义不得退化。

## 门禁

至少运行并如实报告：

1. 新增 hostile 聚焦测试；
2. `pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts`；
3. `pnpm --filter @saydo/daemon test`；
4. daemon typecheck、根 lint、emoji、`git diff --check`。

若 workspace sandbox 禁止真实 `/bin/ps`，不得把沙箱红灯伪报为绿；明确列出宿主必须重跑的命令。测试进程出现失败后残留时应终止自己的精确测试进程组并清理自己的 ignored 临时根，不得修改用户数据。
