# SayDo W5.4-b C2a · Grok CLI 实施(spawn + 门面接线)

你是 `~/WorkSpace/SayDo` 的施工工程师。在**当前工作树**直接施工(分支 `main`,HEAD `11e3653`;canonical 前置与 C1 均在工作区未提交)。owner 已授权基于工作区实施;入库挂官网线,本会话**不 commit、不 push、不 deploy**。

## 调度与沙箱(必守)

- 你由 Grok CLI 派发:模型 `grok-4.6`、`--sandbox workspace`。可写范围 = 仓 CWD + `/tmp` + `~/.grok/`。
- **禁止** `git clean` / `git checkout` / `git restore` / `git stash` / `git reset` / `git commit` / `git push`。工作区有未提交的 C1 与 canonical,清掉即事故(R78 教训)。
- **禁止改** `deploy/`、`docs/release/`、`docs/site/`、`artifacts/release/`、live `~/.saydo/config.toml`。
- 沙箱内 `just ci` 的 python/uv 若因 `~/.cache/uv` 不可写而红:设 `UV_CACHE_DIR=/tmp/saydo-uv-cache` 再跑,并如实记录。
- 不真调 `claude`(全 fake/fixture)。零 emoji。沟通简体中文,标识符英文。

## 必读(坐标自己实测)

1. `docs/plan/IMPL-PROMPT-15-W54B-WIRING.md` §2 红线全文 + §3 C2 段
2. 方案 `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` §3.1 / §3.2 / §3.3
3. `docs/09-data-contracts.md` §11「claude_code 后端配置承载与门合同」(工作区终态)
4. 现状:`packages/daemon/src/tier1/executor.ts`、`gateServer.ts`、`gateScript.ts`、`adapter.ts`、`backends/{types,cursor,claude}.ts`、`gate.ts`、`approvalFlow.ts`、`fileToolEffect.ts`

## 已收口(不要重做,在其上接线)

C1 已在工作区:daemon vitest 基线 **1719 passed / 4 skipped**,`just ci` exit 0。产物 = `tier1/resolveAdapter.ts`、`tier1/claudeIdentity.ts`、`tier1/selfTest.ts`、`providers/binaryIdentity.ts`、`backends/claude.ts` 的 `claudeEnvOverrides`、`[tier1]` 四键 schema 与 claude 启动校验分支。`checkCanaries` 的 cursor 分支禁改(换左值归 C2b)。

## 本阶段范围 = C2a 六项(C2b/C3 不要做)

1. **AgentSpawner.spawn 入参扩**(可选 `settingsJson`/`sessionId`/`maxTurns`,cursor 忽略)+ `realAgentSpawner` 按 backend 分叉:argv = `backend.buildArgv(...)`;hooks = `backend.provisionHooks(cwd, gatePaths)`(cursor 写 hooks.json;claude `--settings` 内联、零文件);stderr 有界环形缓冲经 `AgentProcessHandle.stderrTail?()`(可选,既有 fake 不强制);finish 按 `backend.finishPolicy`(cursor `kill_on_result`;claude `wait_exit_then_kill`:result 后等自然退出 ≤5s 再 SIGTERM→5s→SIGKILL);claude env 合并 `claudeEnvOverrides`。锚:cursor argv/终态快照零变;新增 claude spawn 单测(fake)≥4(argv 封闭集 / env 两键且无 ANTHROPIC_* / settings 内联 / finishPolicy 时序)。
2. **`consumeEventLine` 改吃 `backend.parseLine`**:cursor 内部保留原正则;claude 走 `parseClaudeTier1Line`;unknown/parse_error 计数进审计不作废。锚:既有 executor 事件测试零改动 + claude fixture 流 ≥3(init / 多块 tool_use / result)。
3. **gate-claude.sh 生产供给**:启动/spawn 前按 backend 落 `$SAYDO_HOME/tier1/gate-claude.sh`(`buildClaudeGateScript`,原子写);`gateScriptExpected` 扩为**两脚本 digest 集合**(任一不符 ⇒ 既有 fail-closed);hooks.json 仅 cursor 路径。锚:drift guard 两脚本各漂移一次均拦 ≥2。
4. **`GateWireRequest` 判别联合**:`legacy{command,cwd} | {kind:"command"} | {kind:"file_write",tool,path,cwd} | {kind:"file_read",path,cwd}`——无 `kind` 不注入键(既有 wire `toEqual` 零改动)。`handleGateRequest` 按 `"kind" in req` 分叉:command 现状;`file_write` → `fileToolToEffect`(圈内非敏感 allow / 圈内敏感 S2「要改敏感文件 <脱敏基名>,批准吗」 / 圈外或判不出 deny,永不 S2 永不 allow);`file_read` → 圈内 `no_decision` / 圈外 deny(审计不上浮);收据 command = `"<tool> <abs path>"`;`consumeEditSuggestion` 对 file kind 不适用;审计 meta 增 `tool`/`kind`(additive)。锚:`tier1-gate-socket.test.ts` 新增 ≥6(圈内 allow / 敏感 S2 / 圈外 deny / file_read 两态 / 未知 kind 拒),既有 7 零改动;`tier1-executor.test.ts` handler 分叉 ≥3。
5. **并发 S2 串行化**:同一 run 前一 S2 未决时,第二张直接 deny + 提示「等待审批结果后再试」;`approvalWaitingSince` 改区间并集(cursor canary 观察语义不变)。锚:并发 ≥2(第二张不插播、前一张裁决后恢复)。
6. **C1 遗留**:`config/projectOverrides.ts` 的 `dev.agent` enum 放开 `claude_code` + `config-project-overrides.test.ts:202` 附近既有断言随任务翻转(逐行登记)。

最小接线 `index.ts`:启动供给 claude gate 脚本、backend 选择、把 claude 键传给 verdict/spawner。assertVersion 全串比对与一发一收 init 归 C2b / W5.4-c,本阶段不要扩。

## 红线(IMPL-PROMPT-15 §2 全文有效)

- cursor 路径零行为变化;`tier1-gate-socket` 既有 7 例与 `tier1-executor` 既有用例期望值零改动。
- 禁止 `bypassPermissions`/`dontAsk`/`acceptEdits`/`--dangerously-skip-permissions`/`--add-dir`/`--no-session-persistence`/`--bare`/`--fallback-model`。
- 圈外写永不 allow 永不 S2;圈外 Read deny;工具面外一律 deny。
- 超白名单的期望值改动 = 停该项、上浮,继续其他。

## 门禁与汇报

完成后依次:`pnpm --filter @saydo/daemon exec tsc --noEmit`;`pnpm --filter @saydo/daemon exec vitest run`(全量,基线 1719+);`just ci`(退出码显式,禁管道取尾);`bash scripts/check-emoji.sh` 对改动文件显式清单。

最终 stdout 必须含:改动文件清单(每文件一句) / 新增测试数与要点 / 门禁命令+退出码+计数 / 白名单内既有改动逐行登记(含 :202) / C2b 待接线点坐标 / 方案与现实冲突列出不自决。撞 canonical 缺口 = 停该项继续其他并点名。
