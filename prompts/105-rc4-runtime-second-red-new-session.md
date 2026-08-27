# RC4 owner 状态拆分第二次红灯新会话实施单

## 1. 会话与固化边界

这是全新的实施会话，不得读取或继承旧 Grok 会话的推理/自报。以当前工作树代码、原计划
`prompts/100-rc4-runtime-review-redlights-implementation.md`、首轮 readback
`prompts/103-rc4-runtime-final-sweep-return.md`、tombstone 返工单
`prompts/104-rc4-runtime-tombstone-return.md` 和本文件为唯一输入。

旧会话落地内容已全部显式 staged 固化：

- staged tree：`b428a6c4dbeae204fd9ada0a37be4ae0a2dad5bc`
- staged patch SHA-256：`78ab7f18db120eb1016bc6d6086e48548f07b929016e9935d9e7084aacdf7443`
- `git diff --cached --check`：exit 0

不要改 index、不要 commit；只在 working tree 形成相对 staged checkpoint 的最小未暂存差异。

## 2. 第二次红灯

宿主在 tombstone 首轮修复后真实执行：

`pnpm --filter @saydo/daemon exec vitest run test/restart-policy.test.ts --reporter=dot`

退出码 1，7 项中 6 passed、1 failed。失败发生在既有综合测试最后一段：它主动写入 invalid
`agent-owner.json`，同时保留一个仍存活的 legacy `agent.pid`，预期错误包含 `ownership unverified`；当前生产代码抛
`tier1 agent ownership record invalid:run_missing`。

完整 Tier1 已在同一宿主真实通过：115/115、exit 0。daemon typecheck 与 `git diff --check` 也为 0。

## 3. 应对齐的合同

请独立判断并做最小修复。合同边界是：

- valid-but-authoritatively-dead durable owner 是 `already_exited` tombstone，绝不二次 spawn；
- invalid owner 内容必须 fail-closed；
- owner absent 但 live legacy pid 必须 fail-closed 为 ownership unverified，不能杀未验证进程；
- invalid owner 与 live legacy pid 同时存在时同样不得杀进程。错误分类应精确、稳定，不得把 missing 与 invalid 混为一谈；
- Windows valid owner 缺 jobName 继续 fail-closed；不存在 owner 且不存在 legacy pid 才是 `absent`。

若新合同明确把“invalid owner 内容”作为第一原因，则更新旧测试的精确预期，并另加/保留“owner absent + live legacy pid”
断言 `ownership unverified`，避免通过改一条字符串丢掉旧安全合同。若代码仍无法区分这些状态，则修生产状态模型。

## 4. 验收

1. `restart-policy.test.ts` 全套 exit 0；
2. `tier1-executor.test.ts` 的 valid-dead tombstone 定向用例 exit 0；
3. daemon typecheck exit 0；
4. `git diff --check` exit 0；
5. 最终列出相对 staged checkpoint 的未暂存文件与精确 diff；不 commit、push、deploy、改版本或证据。
