# T18a 三槽 CLI 补位对抗审

## Findings A

1. **A1：runtime registry 可绕过真实 self-test，直接错误武装 evaluator**

   [cliRuntime.ts:152](~/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:152) 接受普通 JSON 文件作为登记；[cliRuntime.ts:336](~/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:336) 的生产门只核对 `bindingDigest`、当前文件 digest 和 provider，不核对对应的成功 self-test 或不可变 audit receipt。[cliRuntime.ts:44](~/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:44) 甚至允许调用方自行填入 `verified_binary_default + observedModel`，与 canonical“固定族只能证明 family、不得用请求值自证实际模型”冲突。

   反例：在双 ack 已开启的配置下，向 `cli-runtime.json` 写入语法合法的 evaluator row，计算当前任意可执行文件 digest，并声明 `verified_binary_default`，无需执行 `/api/setup/test` 或产生 `config.cli_runtime_registered` 审计，[slotResolvers.ts:321](~/WorkSpace/SayDo/packages/daemon/src/providers/slotResolvers.ts:321) 即可返回 `active`。

   最小修法：登记必须携带由成功 self-test 原子产生的完整性凭据，resolver 必须交叉核对该凭据、binding、binary digest、四字段和成功审计；`verified_binary_default` 登记禁止携带未经独立证明的 `observedModel`。补“手写 registry 不得武装”的进程测试。

2. **A2：旧用户轮的 `finally` 可取消更新的用户轮，造成当前输入丢失**

   [dialog.ts:503](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:503) 用共享布尔值 `userTurnInFlight` 表示多个可能重叠的轮。旧轮和新轮各有 controller，但旧轮结算时无条件在 [dialog.ts:513](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:513) 把布尔值清成 false 并泵控制队列；控制轮随后在 [dialog.ts:313](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:313) 启动，并由 [dialog.ts:211](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:211) 的 `beginModelTurn` abort 当前的新用户轮。

   反例顺序：轮 A 阻塞→轮 B 到达并 abort A→确认事件排入 control queue→A 比 B 先结算→A 的 `finally` 清掉 B 的 in-flight 状态→控制轮启动并取消 B。

   最小修法：以 controller/generation 标识当前用户轮；只有仍持有当前 generation 的 `finally` 才能清状态和泵队列。补“旧轮先结算、第二轮仍挂起、队列中有控制轮”的竞态测试。

3. **A3：recovery-only 的 restart/SIGTERM 未终止或等待 BYOA 子进程**

   recovery-only 可在 [recoveryOnlyServer.ts:437](~/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:437) 启动真实 CLI self-test，但 restart 路径 [recoveryOnlyServer.ts:160](~/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:160) 和信号路径 [recoveryOnlyServer.ts:499](~/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:499) 都没有调用 `abortAllByoaInvocations`。restart 的三秒兜底还可能在请求未结束时拉起新 daemon 并退出父进程。

   结果是 SIGTERM 可等待到 120 秒 wall timeout；restart 则可能留下 CLI 后代或让新旧进程短时并存。正常 composition root 已在 [index.ts:2363](~/WorkSpace/SayDo/packages/daemon/src/index.ts:2363) 和 [index.ts:2860](~/WorkSpace/SayDo/packages/daemon/src/index.ts:2860) 正确 drain，recovery-only 漏接。

   最小修法：两条退出路径都先永久进入 draining、拒绝新调用、abort 并等待 settled，再 spawn/exit；补 recovery-only 活跃 self-test 下的 restart 与 SIGTERM 真实进程测试。

## Findings B

1. **B1：Codex 已知事件上的 `model` 字段会被忽略，豁免可覆盖流内冲突**

   [parsers.ts:155](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/parsers.ts:155) 对 `thread.started` 直接返回 `ignore`，不检查其中是否出现 `model`；随后 [consume.ts:99](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/consume.ts:99) 会按二进制固定族豁免。

   反例：`thread.started` 携带 `model:"claude-sonnet-5"`，后续为合法 Codex 成功流，最终仍可能按 GPT `verified_binary_default` 收成成功。违反“流内一旦给 model 必须按 stream 校验”。

   最小修法：对所有白名单事件显式处理/拒绝 `model` 字段；补固定族已知元事件携带异族 model 的反例。

2. **B2：setup 对 API evaluator 使用静态 fallback 家族，可能自检绿而生产 unarmed**

   [setup.ts:899](~/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:899) 在任何 CLI self-test 前预计算全部 API resolver，且没传 runtime registry。生产 evaluator resolver 则会在 [slotResolvers.ts:332](~/WorkSpace/SayDo/packages/daemon/src/providers/slotResolvers.ts:332) 根据 thinking 的活动登记改用真实家族。

   反例：dialog=GPT、已登记 thinking=Claude CLI、evaluator=Claude API、无 same-family ack。生产为 `unarmed`，但 `/api/setup/test` 会把 thinking 当作回落 GPT，可能将 evaluator 测成 `ok`。

   最小修法：thinking 自检/登记后再按候选最终 runtime 状态解析 evaluator；断言 setup 结果与随后 probe/生产 resolver 一致。

3. **B3：订阅限流分类未接入真实 CLI**

   [billing.ts:59](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/billing.ts:59) 已定义限流判定，但生产代码没有引用；[provider.ts:408](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:408) 把所有非零退出统一压成非重试的 `process_exit`。

   因此 CLI 报 subscription/quota/rate limit 时不会返回 `subscription_rate_limited`，也不会进入合同要求的 `waiting_confirmation`。当前不会静默切 API，但用户会得到错误分类。

   最小修法：按供应商 stderr/结构化事件建立限流分类表，在通用非零退出前返回 canonical 错误，并补 fake CLI 限流反例。

4. **B4：fake CLI “畸形 JSON”没有覆盖进程边界的非法 NDJSON**

   [byoa-fake-cli.e2e.test.ts:124](~/WorkSpace/SayDo/packages/daemon/test/byoa-fake-cli.e2e.test.ts:124) 所谓畸形 JSON 实际由 [fake-byoa-cli.mjs:85](~/WorkSpace/SayDo/packages/daemon/test/fixtures/fake-byoa-cli.mjs:85) 生成合法供应商 NDJSON，只是终态正文为 `not-json`。原始 NDJSON 语法错误仅有纯函数测试，没有经过 spawn、decoder、即时 stop 和审计链。idle watchdog 也只有实现，没有 fake 进程反例，现有 timeout 测的是 wall timeout。

   最小修法：fixture 增加直接写出非法 NDJSON 的模式，以及持续输出后静默触发 idle timeout 的模式。

## Findings C

无。

## 其余裁决

- canonical 三件回写方向一致：`docs/07`、`docs/09`、`docs/11` 已明确 T18a/T18b/T18-ui 分界；`docs/10` 与基线 SHA-256 相同，现有 #40–#42 已承载订阅限流和等待话术。
- schema 文件传递/清理、Claude 内联 schema、Cursor prompt schema 单次严格重试、非零/空输出/unknown event fail-closed、wall/output cap、UTF-8 decoder、per-CLI=1/全局=2/busy、双 ack、project override 恒拒、逐槽真实 self-test、逐请求订阅记账的主实现均存在。
- console 确认零改动：`git diff --quiet d1bde0d..HEAD -- packages/console` 返回 0。
- 没有实现 T18b/T18-ui；改动范围为三份 canonical 和 daemon 源码/测试。全量为 `44 files changed, 4073 insertions, 507 deletions`。
- 分支恰含指定四个提交；工作区仍只有既有未跟踪文件 `prompts/53-t18a-cli-slots-review.md`，本审没有写文件。

## 验证边界

- `pnpm --filter @saydo/daemon typecheck`：exit 0。
- `pnpm exec eslint packages/daemon/src`：exit 0。
- `git diff --check d1bde0d..HEAD`：exit 0。
- Vitest 未运行到任何测试：普通模式因 `.vite-temp` 写入 `EPERM`；`--configLoader runner` 又因临时 `ssr` 目录 `mkdir EPERM`，报告明确为 `Tests no tests`，不能据此宣称测试通过。
- `scripts/check-emoji.sh` 同样因只读沙箱下 `mktemp EPERM` 未执行扫描。

OPEN QUESTION：若威胁模型明确把所有可写 `SAYDO_HOME` 的同 UID 进程视为完全可信，A1 的“攻击”严重度可讨论；但它仍然违反“只有真实 self-test 才 active”的合同，并对手工篡改/状态恢复 fail-open，因此不影响本轮 No-Go。
