# W5.4-b C1 init 探针实施

你是 SayDo 的独立实施会话。只改 C1，不评审、不 commit、不 push、不 deploy、不用 subagent/web。
上一会话因循环规划被中止且零落地；本轮请少解释，读完指定文件后立即编辑与测试。

## 范围与验收

只修改以下必要文件：

- `packages/daemon/src/tier1/selfTest.ts`
- `packages/daemon/test/tier1-self-test.test.ts`
- 若类型需要，可最小修改同目录直接依赖；不要改 console/docs/evidence。

在现有注入式 `Tier1SelfTestProbes` 增加 Claude `system/init` 物理探针，并把它纳入
`claude_code` 的二进制身份检查链：

1. 生产 probe 用 `execFile` 调 `claude -p`，有界超时，参数必须包含
   `--output-format stream-json --verbose --model <[tier1].model> --permission-mode default
   --tools "" --setting-sources "" --strict-mcp-config --no-session-persistence --max-turns 1`；
   prompt 仅要求回复 OK，不执行工具。
2. env 必须复用 `strippedAgentEnv(process.env)` 并只叠加 `claudeEnvOverrides`，不得继承
   `ANTHROPIC_*` 或 `CLAUDE_CODE_OAUTH_TOKEN`。
3. 用既有 `parseClaudeTier1Line` 解析 NDJSON；要求首个可识别事件是 init，且 init 同时满足：
   `apiKeySource === "none"`、`claudeCodeVersion === pinned`、`permissionMode === "default"`、
   `tools` 是空数组、`model` 经既有 `familyFromModelName` 判为 `claude`。
4. 超时/非零退出/无输出/缺 init/任一字段缺失或不符均 fail-closed，check 名为 `init`，
   错误文案给出可行动处方但不得泄露原始 stdout、环境或完整路径。
5. `init` 红不得写 identity；其余现有身份与 hook 分层语义不变。
6. 测试全部注入 fake，普通单测不得真调 Claude。至少覆盖全绿、缺 init、API key 来源、
   版本漂移、模型异族、tools 非空、probe 非零/超时形态，并断言 init 红时 identity 不写。

本机真实只读预探针已经确认 Claude 2.1.220 的实际形状为：首事件 `system/init`、
`apiKeySource=none`、`model=claude-opus-5`、`claude_code_version=2.1.220`、
`permissionMode=default`、`tools=[]`，随后 result success。不要据此硬编码 model 全名。

## 门禁

运行并报告真实退出码：

```text
pnpm --filter @saydo/daemon test -- tier1-self-test
pnpm --filter @saydo/daemon typecheck
pnpm --filter @saydo/daemon lint
```

最终只列改动文件、测试结果和仍未做项。不得声称独立评审已通过。
