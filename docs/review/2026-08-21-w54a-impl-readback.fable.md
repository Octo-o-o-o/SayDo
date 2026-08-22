# w54a-claude-cli 实施对账报告(readback)

> 分支 `batch/w54a-claude-cli`;merge `7fb3fa1`(2026-08-20 03:57 +0800,合入 main);分支提交 15 个(`git log 7fb3fa1^1..7fb3fa1^2` 本会话输出:开批 `0649107` → 末码 `f04b898`,其中代码提交 10 个:`ed8b0f3` / `5195164` / `0ae8692` / `16d24eb` / `f1a5d28` / `70ef24a` / `6313766` / `56f0731` / `2d7e363` / `54b981c`)。
> 分支基点 `354b028`(`0649107^` 本会话核出)。merge 引入 main 的 diff 与分支累计 diff 统计一致(37 文件,+4936/-41),且 `git diff f04b898 7fb3fa1` 的文件清单不含任何 `tier1/`、`e2e/spikes/`、w54a evidence 文件——merge 对 w54a 实现文件无夹带。
> 计划文档:`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` §6 W5.4-a 节(v3.1)+ `docs/plan/IMPL-PROMPT-10-W54A-CLAUDE-CLI.md`(v2.1)。evidence:`e2e/evidence/w54a-claude-cli.md`。
> 对账日期 2026-08-21;评审员与实施会话零上下文,全部证据为本会话 Read / git / vitest 真实输出。

## TL;DR

W5.4-a 的承诺清单已全部落地并可复核:阶段 A spike 固化(RESULT 逐条判定 + golden fixture 七件)、B1-a cursor seam 抽取(三句锚全过)、B1-b claude backend 纯函数、B2 门脚本 / fileToolToEffect / cmdEffect 收紧、B3 终态与记账纯函数、B4 evidence 与 HANDOFF 指针,全部有代码 + 测试双证据;批内三轮零上下文评审(82 → A-1,84 → A-2)的 A 级均经返工闭环(85 复核"可并入")。

- 状态计数:台账 22 条 = [ok] 19 / [warn] 2(result_max_turns 合成 fixture;evidence §9 复跑位留空)/ [divergent] 1(B-10prime 阻塞红保留 [fail] 原判、经方案 v3.1 修订 + X1–X5 补测后授权进 B——判定为合理处置而非走样)。[fail] 0。
- 门禁:六文件定向 vitest **321 passed,退出码 0**(本会话);独立降档扫描 **215 条命令 down=0 up=0**(本会话复跑,非采信 evidence 自述)。
- 质量复审:A 级 0;B 级 1(`AdapterKind` 与 contracts `Adapter` 词表分叉,红线 5 字面违反,无行为影响);C 级 6。

## 对账台账

证据列中 file:line 为本会话 Read 所得;命令输出为本会话运行所得。

### 阶段 A · spike 固化

| # | 计划项 | 状态 | 证据 |
|---|---|---|---|
| A1 | `run.sh` 落盘:终版 argv(v3.1 `default`)、幂等、`set -u`、退出码显式、凭据运行时拼接 | [ok] | `e2e/spikes/claude-cli-tier1/run.sh` 1498 行;`set -u` 于 :89(主体)与 :217/:226(hook 脚本);:1078-1081 `spike_key="sk-"` 再拼 `invalid-spike`(仓内无凭据形态字面量);头部注释 :9-12 declare 终版 argv 与禁用旗标 |
| A2 | RESULT.md 逐条 `[ok]/[warn]/[fail]` + 原始输出摘录 + sha256 | [ok] | `e2e/spikes/claude-cli-tier1/RESULT.md`:§0 三档总表,§1 每条附 sha256 与摘录(jsonl 留 `.tmp/` 不入 Git,本会话无法重算 hash,如实声明) |
| A3 | 阻塞红 A-04 / S1–S4 / S-T / S5 / S14 / S-F(a/b/c)/ B-2 / B-7 / B-10 / B-14(a–d)/ B-15 全 `[ok]` | [ok] | RESULT.md §0/§1:A-04 三形态各 Bash=1 Write=1、选定 matcher `*`;S-T `init.tools` 恰五件不含 Task;S-F 三变体 deny+exit 2 均阻断;B-14 四项矩阵在 `--setting-sources ""` 下均不生效;B-15 `apiKeySource=ANTHROPIC_API_KEY` 且 init 前零事件 |
| A4 | B-10prime(`.env` 超时不落盘) | [divergent] | RESULT.md 保留 `[fail]` 原判(`acceptEdits` 下 `.env` 落盘)。IMPL 检查点 3 原文"阻塞红任一 [fail] ⇒ 停、不进 B";实际处置 = 方案升 v3.1(`--permission-mode default`)+ X1–X5 补测(X2:default 超时不落盘且进 `permission_denials`),调度方明示进 B,evidence §1 如实登记。终版实现(`backends/claude.ts:56-57` `--permission-mode default`)与补测结论一致。判定:**合理处置**——保留原判不涂绿、方案文档同步修订(`2026-08-19-w54-claude-cli-tier1.fable.md` §9 v3.1 段)、补测闭环,非走样 |
| A5 | 设计调整级 B-9 / B-11 / B-12 / B-13 / B-3 | [ok] | RESULT.md:B-9 `[ok]`(仍取 `wait_exit_then_kill` 5s);B-11 `[warn] persist=unknown` 如实(cd 收紧不依赖该结论);B-12 变量名清单无值;B-13 auto-memory 经 Write 证实;B-3 未开 Task |
| A6 | 信息级 B-6 / B-16 | [ok] | RESULT.md §1:B-6 stream-json 一发一收 exit 0;B-16 仅见 `allowed`,拒绝态如实"未复现" |
| A7 | golden fixture 七件齐且逐行 JSON.parse 通过 | [ok] | 本会话 `ls` + `node -e` 逐行 parse:init 1 / rate_limit 1 / result_max_turns 1 / result_success 1 / resume_fail 1 / tool_result 2 / tool_use_multi 1 行全过;`init.jsonl` permissionMode 已按返工改为 `default`(`2d7e363`),路径已脱敏为 `/tmp/saydo-fixture/…` |
| A8 | fixture 来源如实 | [warn] | `result_max_turns.jsonl` 无 live `error_max_turns` 流,按附录 A S11 形状合成——RESULT.md §3 与 evidence §2 均已声明;分类器按 subtype 测过,W5.4-c live 冒烟时应补真流校准 |

### 阶段 B · 纯函数层

| # | 计划项 | 状态 | 证据 |
|---|---|---|---|
| B1 | B1-a:`Tier1Backend` 接口 + `backends/cursor.ts`,cursor argv / 解析 / `kill_on_result` / canary 左值不变(锚①) | [ok] | `packages/daemon/src/tier1/backends/types.ts:43-56`(接口八员与方案 §3.1 同形);`backends/cursor.ts:15-20`(argv 与抽取前 `-p --force --trust --output-format stream-json` 逐字一致)、`:53-54`(`kill_on_result` / `shell_started`);快照测试 `test/tier1-cursor-backend.test.ts:12-44` 3 例钉死 |
| B2 | B1-a 锚②:既有 `tier1-*.test.ts` 期望值零改动,白名单适配逐行登记 | [ok] | 本会话 `git diff 0649107 f04b898 --numstat`:`tier1-executor.test.ts` +54/-0、`tier1-cmd-effect.test.ts` +36/-0(纯新增);`tier1-security` / `tier1-operations` / `tier1-story-e2e` / `tier1-approval-live` 不在改动清单(零改动);`tier1-gate-socket.test.ts` +256/-1,唯一删除行为 import 行扩展(非期望值);evidence §2 B1-a 表逐行登记三处可选适配(`stderrTail?` / spawn 三可选参 / `ExecutorDeps.backend?`) |
| B3 | B1-a 锚③ + executor 改动限于 seam | [ok] | 本会话读 `executor.ts` 全量 diff:改动 = argv 走 `backend.buildArgv`(:148-166)、stderr 环形缓冲 ≤64KB(:180-182,:265-268)、`finishPolicy` 分叉与 `armWaitExitThenKill`(:200-218,评审 1 B-1 补 `ownershipEstablished` 对称 :273-281)、`consumeEventLine` 改吃 `backend.parseLine`(:1180)、canary 左值增量守卫 `canaryLeft === "shell_started" && isCursorShellToolCall`(:1219);缺省 `cursorBackend()`(:146,:418)。六文件门禁绿 + evidence/85 报告记录调度方沙箱外 `just ci` EXIT=0(daemon 1592\|4) |
| B4 | B1-b:`buildClaudeArgv`(v3.1 终版、sessionId XOR resumeKey、禁用词断言) | [ok] | `backends/claude.ts:39-87`:`--permission-mode default`(:56-57)、五工具、`--disallowedTools`、`--setting-sources ""`、`--strict-mcp-config`、`--settings` 必填断言(:43-46)、互斥断言(:40-42)、八禁用词运行时扫描(:74-85,排除 prompt 段);测试 `tier1-claude-backend.test.ts:32-78` 必含/必不含两张表 |
| B5 | B1-b:`buildClaudeHooksSettings`(matcher = A-04 选定 `*`、timeout ≥ 120 且 > curl+10 断言) | [ok] | `backends/claude.ts:89-105`(`CLAUDE_HOOK_MATCHER = "*"` :9,断言 :90-94);测试 :82-90 含过短 timeout 抛错反例;`provisionHooks` 写 `gate-claude.sh` 而非 cursor `gate.sh`(:222-228,测试 :92-106) |
| B6 | B1-b:`parseClaudeTier1Line` 全新实现,禁调 `parseClaudeLine`(grep 断言) | [ok] | `backends/claude.ts:107-212`:init(含 apiKeySource/tools/claudeCodeVersion,附带 observed_model)、assistant 逐块 `tool_started`(每块一条 :159-169)、user `tool_result`、rate_limit、result 全字段;import 面仅 `explainCliProcessFailure`(:3),无 `parseClaudeLine`;测试 :186-191 grep 断言 + 七件 fixture 逐件断言(:109-167,含并行 tool_use 两块都计) |
| B7 | B1-b:`finishPolicy=wait_exit_then_kill` / `canaryLeft=tool_result` / `explainFailure`(AUTH_RE 补词) | [ok] | `backends/claude.ts:231-232`;`processFailure.ts` diff 仅 AUTH_RE 增 `login expired\|please run \/login`(IMPL 明文允许);`process-failure.test.ts` 不在改动清单(既有 7 例零改动);executor 新增用例证 wait_exit_then_kill 对称启动(`tier1-executor.test.ts:1166-1218`,claude ≥4.5s 收、cursor <2s 立即收) |
| B8 | B2:`buildClaudeGateScript`(失败路径 deny+exit 2、jq 缺失 printf 静态 deny、curl --max-time 100、三态输出、不接线) | [ok] | `gateScript.ts:78-201`:`CLAUDE_GATE_CURL_TIMEOUT_SEC=100`、`CLAUDE_HOOK_DENY_STATIC`、空 stdin / jq 缺失 / jq 校验失败 / 未知 tool / 未知三态一律 deny+exit 2,`emit_deny` jq 失败回落静态 JSON+exit 2,`bashSingleQuoted` 防注入;`ensureGateScript` 未改(仍只写 cursor `gate.sh`);gate-socket 新增 14 例真 bash/jq/curl 物理执行(≥10 锚),含 curl 超时挂起 server、`PATH=/nonexistent` jq 缺失变体;既有 gate.sh 七例 describe 块零改动 |
| B9 | B2:`fileToolToEffect`(最长现存祖先 realpath、判不出 S3、`..` 分量拒、悬空 symlink 拒、敏感基名导出) | [ok] | `fileToolEffect.ts`:`hasDotDotComponent` 三道检查先于 `normalize`(:48/:51/:58,评审 2 A-2 修法);祖先链 `lstat` + symlink `realpathSync` 抛错 ⇒ dangling(:70-77,评审 1 A-1 修法);判不出 ⇒ `delete_data`/`unresolvable`(:120,:134);圈判定 `path.relative` 防 sibling 前缀(:101-104);`SENSITIVE_FILE_BASENAME_RE` 导出(:7-8,`.env[^/]*` 含 .envrc);Read 圈外 ⇒ `delete_data`/`read-outside-worktree` S3(:107-109);测试 `tier1-file-tool-effect.test.ts` 13 例,表驱动 38 行(≥36 锚),真建 symlink(指圈外 :74-82 / 悬空 :84-104 / `link/../leaked.txt` :48-65),`computeRisk` S3 断言在场 |
| B10 | B2:cmdEffect 收紧(cd/pushd、agent CLI 词头、bypass 旗标、`--force` 仅 agent 语境、圈外只读 S2;只升不降) | [ok] | `cmdEffect.ts` diff:`AGENT_CLI_HEADS` 七词头 ⇒ `send_external`/S3、`AGENT_BYPASS_TOKEN` 任意 token ⇒ S3、cd/pushd 无参与 `~`/`$HOME` ⇒ S3 / `$VAR`与`cd -` ⇒ S2 / 圈内 ⇒ S1、READ_ONLY_HEADS 与 sed 目标圈外 ⇒ `floorS2`,全部位于 `classifySegmentGivenHead`(剥 wrapper/sudo/env 之后,`sudo cursor-agent --force` S3 用例佐证);新增 `w54aCmdEffect` 28 条(≥26 锚),IMPL 点名的 14 个对照例逐条在列且判定一致(`git push --force origin main` 仍 S3、`npm run build --force` 仍 S1、`cat src/a.ts` 仍 S0) |
| B11 | B2:降档扫描 0 | [ok] | **本会话独立复跑**(不采信 evidence 自述):导出开批版 `0649107:cmdEffect.ts` 与开批版测试文件至 /tmp,两版 `commandToEffect` 喂同一仓内 `computeRisk`,命令集 = 开批版测试抽出的 215 条唯一命令 ⇒ `commands=215 down=0 up=0 same=215`(tsx 运行,EXIT=0)。与 evidence §4 自报(256 条 down=0)一致,条数差异来自抽取正则口径 |
| B12 | B3:`classifyClaudeRunOutcome` 表驱动 ≥ 12(`error_max_turns` ⇒ failed 不 settle) | [ok] | `claudeOutcome.ts:23-65`(max_turns 最先判、143±abort、resume_not_found、auth 补词、rate 拒绝词表);测试 `tier1-claude-outcome.test.ts:8-62` `it.each` 恰 12 行,覆盖方案 §3.5 全枚举 |
| B13 | B3:`buildTier1SubscriptionCostEntry` 纯对象、不 INSERT、不被生产路径调用 | [ok] | `claudeOutcome.ts:84-121`(`kind:"tier1.run"`/`source:"subscription"`/`amount:null`/`known:0`/`requests:1`、`usage_unavailable` 时四键 0 且并存);本会话 `rg -l` 全仓仅定义与测试两文件命中(零生产调用、零 INSERT);字段断言 4 例(:66-105)。tokens 四键落 `meta` 与既有 `cost/ledger.ts:97-103` 的 cost_entries meta 承载口径一致,不算偏离(见 C-1 键名观察) |
| B14 | B4:evidence + HANDOFF 指针回填 | [ok] | `e2e/evidence/w54a-claude-cli.md` 293 行(坐标 / spike 总表 / 三提交 SHA / 门禁表 / 降档数字 / 明确未做 / 两轮返工);merge 时点 `git show 7fb3fa1:HANDOFF.md` :21 指针"(空)",w54a 收口条目登记末码 `54b981c` 与 spike/fixture 路径 |

### 红线与固定审查项

| # | 项 | 状态 | 证据 |
|---|---|---|---|
| R1 | 不改 executor 认领主流程(seam 抽取除外) | [ok] | executor.ts 全量 diff 逐段核过(台账 B3);`handleGateRequest` / settle / recover / claimNext 均不在 diff 中 |
| R2 | 不改 `gateServer.ts` | [ok] | 分支 37 文件改动清单无此文件 |
| R3 | 不改 `config/types.ts` / `validateConfig.ts` / `index.ts` | [ok] | 同上,三文件均不在清单(daemon `src/index.ts` 的改动来自 main 第一父上其他批次) |
| R4 | 不改 `checkCanaries` cursor 分支 trip 条件 | [ok] | 当前 `executor.ts:608-620` 两 tick `shellStarted > gateSeq` 与结算硬检 :1268 原样;diff 未触及;左值增量点仅加 `canaryLeft` 守卫(缺省 cursor 下与抽取前等价,`tool_started` 事件由 `isCursorStartedToolCall` 过滤,同一正则) |
| R5 | 不 import `@anthropic-ai/*` | [ok] | 本会话 `rg '@anthropic-ai' packages/daemon/src/` 零命中(退出码 1) |
| R6 | `adapter.ts` 死代码不动 | [ok] | 不在改动清单;`tier1-security.test.ts` 亦零改动 |
| R7 | 净新增 `eslint-disable` / `@ts-ignore` / `@ts-expect-error` / `.skip(` / `.only(` / `fromCharCode` | [ok] | 本会话对 `git diff 0649107 f04b898 -- 'packages/daemon/**'` 的 `+` 行 grep,零命中(退出码 1) |
| R8 | 计划外文件改动甄别 | [ok] | 仅两处且均有据:`policy/engine.ts` +2(EffectDescriptor 增可选 `reason?`,注明不参与 computeRisk,评审 1 A-1 返工引入,不在禁改清单);`providers/byoa/processFailure.ts` AUTH_RE 补词(IMPL B1-b 明文允许) |

## 质量复审发现

### A 级(必修)

零。

### B 级

- **B-1 · `AdapterKind` 与 contracts 词表分叉(红线 5 字面违反)**:`packages/contracts/src/types/task.ts:12-13` 已有 `adapterSchema = z.enum(["claude_code","cursor","codex"])` 与导出类型 `Adapter`(09 §6.1 词表),而 `packages/daemon/src/tier1/backends/types.ts:3` 自写 `export type AdapterKind = "cursor" | "claude_code"`。AGENTS.md 硬规则 5"09 已有的类型不得在别处重定义,一律 import `@saydo/contracts`"。缓解:为两个已实现后端的有意子集、纯类型层、零运行时词表、本批未接线,无行为分歧;修复一行(`Extract<Adapter, "cursor" | "claude_code">`)。批内评审 85 已发现并列 C 级;本 readback 因硬规则字面违反升 B,建议 W5.4-b 接线时顺带修。

### C 级

- **C-1 · 记账第四键名待统一**:`buildTier1SubscriptionCostEntry` meta 用 `cache_creation_input_tokens`(claude 原生名),既有 `cost/ledger.ts:103` 的 cost_entries meta 定型键为 `cache_write_input_tokens`。本批不落库无冲突;W5.4-b 落库与 09 P-5 词表回写时须择一。
- **C-2 · evidence §9 复跑位留空**:评审 2 返工后的完整 `just ci` 复跑数字在 evidence 中为空槽(`EXIT=_`),实际数据记录于评审 85 报告头部(`just ci` EXIT=0,contracts 103 / cli 19 / console 253 / daemon 1592\|4 / python 33)。信息不缺失但落位不在承诺文件内。
- **C-3 · `claudeIsTerminalResult` 宽正则**:`backends/claude.ts:214-216` 用 `/"type"\s*:\s*"result"/` 文本匹配(与 cursor 既有口径相同),assistant 文本含该字样会提前 arm `wait_exit_then_kill` 计时器。cursor 无回归,claude 是新路径同口径;W5.4-b 接线可改为 parse 后判 type。
- **C-4 · gate-socket import 行改动未逐行登记**:`tier1-gate-socket.test.ts` 唯一删除行是 import 行扩展(为引入 `buildClaudeGateScript` / `CLAUDE_HOOK_DENY_STATIC`),不属期望值改动、实质合规,但 evidence 的白名单登记表未列它。
- **C-5 · 评审 85 C 级遗留未修(均不挡本批)**:`provisionHooks` 返回 `extraArgs:["--settings",…]` 而 `buildArgv` 又要求 `settingsJson`,接线若双用会重复 `--settings`;claude-backend init 测试未断言 `permissionMode`;B-7 毒 SOCK 路径仅 `bash -n` 静态覆盖。
- **C-6 · 合成 fixture 的版本绑定风险**:`result_max_turns.jsonl` 为合成件(台账 A8),2.1.220 目录名下混有一件非实测产物;W5.4-c live 冒烟到限一次即可换真流。

### 批内评审线复核

三轮零上下文评审的 A 级链条本会话独立核对:82 提 A-1(悬空 symlink 假绿)→ `6313766` 修(lstat 祖先链 + 真建悬空 symlink 用例);84 复核 A-1 [ok]、新提 A-2(`normalize` 词法折叠让 `..` 穿 live symlink 变圈内)→ `54b981c` 修(三道 `..` 分量检查先于 normalize + 字面量测试);85 复核 A-2 [ok]、总评"可并入"、A 级零未闭环。实现与测试均与三轮处置一致(台账 B9)。

## 门禁结果

1) 六文件定向测试(任务书指定命令,仓根执行,本会话原始输出):

```
pnpm --filter @saydo/daemon exec vitest run test/tier1-claude-backend.test.ts \
  test/tier1-claude-outcome.test.ts test/tier1-file-tool-effect.test.ts \
  test/tier1-cursor-backend.test.ts test/tier1-cmd-effect.test.ts test/tier1-gate-socket.test.ts

 [ok] test/tier1-claude-backend.test.ts (17 tests) 8ms
 [ok] test/tier1-file-tool-effect.test.ts (13 tests) 17ms
 [ok] test/tier1-cmd-effect.test.ts (251 tests) 14ms
 [ok] test/tier1-claude-outcome.test.ts (16 tests) 4ms
 [ok] test/tier1-cursor-backend.test.ts (3 tests) 3ms
 [ok] test/tier1-gate-socket.test.ts (21 tests) 1969ms
(vitest 原输出的逐文件通过标记为勾号字符,本报告按仓规改写为 [ok])
 Test Files  6 passed (6)
      Tests  321 passed (321)
EXIT=0
```

2) 降档扫描独立复跑(本会话,/tmp 沙箱,不触仓内文件):

```
packages/daemon/node_modules/.bin/tsx /tmp/w54a-scan/scan.mts
commands=215 down=0 up=0 same=215
EXIT=0
```

3) fixture 完整性(本会话):七件 `node -e` 逐行 `JSON.parse` 全过(init 1 / rate_limit 1 / result_max_turns 1 / result_success 1 / resume_fail 1 / tool_result 2 / tool_use_multi 1)。

4) 全量 `just ci`:本会话未跑(跳过;原因 = 任务书门禁指定为六文件定向,且工作区带有其他批次未提交改动会污染全量结论)。批内记录:评审 85 报告头部载调度方沙箱外 `just ci` EXIT=0(daemon 1592\|4),为实施方/调度方数据,非本会话验证。

5) 本报告 emoji 门禁:`bash scripts/check-emoji.sh docs/review/2026-08-21-w54a-impl-readback.fable.md`——首跑 `[fail]`(vitest 摘录携带的勾号字符被门禁拦下),按仓规改写为 `[ok]` 文本标记后复跑 ⇒ `[ok] emoji gate: clean`,退出码 0(本会话)。

## 修复清单(只列不修)

1. [B-1] `backends/types.ts` 的 `AdapterKind` 改为 import `@saydo/contracts` 的 `Adapter` 子集(`Extract<Adapter, "cursor" | "claude_code">`)——W5.4-b 接线时顺带,一行。
2. [已登记的 W5.4-b 前置,非新发现] `gate-claude.sh` 的 `path_outside` 是词法前缀而非 realpath(macOS `/tmp` vs `/private/tmp` 假 deny,fail-closed 方向;evidence §9 B-12 与评审 85 B 级均已登记):接线时不得删 `*..*` 补偿、不得把词法前缀当 realpath 等价,圈判定单源保持在 daemon `fileToolToEffect`。
3. [C-1] W5.4-b 落库 + 09 P-5 回写时统一 cache 第四键名(`cache_creation_input_tokens` vs 既有 `cache_write_input_tokens`)。
4. [C-2] evidence §9 复跑位回填(或补一行指针指向评审 85 报告头部的 `just ci` 数字)。
5. [C-3] W5.4-b 接线时把 `claudeIsTerminalResult` 收紧为 parse 后判 `type === "result"`。
6. [C-5] 评审 85 C 级遗留:`provisionHooks` 与 `buildArgv` 的 `--settings` 双供给语义在接线时定一;claude-backend init 测试补 `permissionMode` 断言;B-7 毒 SOCK 补物理执行用例。
7. [C-6] W5.4-c live 冒烟遇真 `error_max_turns` 流时替换合成 fixture。

返工去向:本轮无红灯条目,无需退回实施会话;上述各项按各自批次(W5.4-b/c)的 IMPL 排入即可。
