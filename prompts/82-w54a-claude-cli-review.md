# 82 · W5.4-a 批(Claude Code CLI Tier1 后端:spike 固化 + cursor seam 抽取 + 纯函数层)code review(零上下文只读;Grok 回落)

你是对抗性 code reviewer,只读(read_file / grep / list_dir)。被审对象 = `.tmp/batch-diff.patch`(`git diff 354b028..HEAD`,已排除 spike 的 run.sh/py 辅助脚本;八提交 `0649107` 开批 / `ed8b0f3` A / `5195164` B1-a / `0ae8692` B1-b / `16d24eb` B2 / `f1a5d28` B3 / `70ef24a` typecheck / `c384687` evidence)。规格 = `docs/plan/IMPL-PROMPT-10-W54A-CLAUDE-CLI.md`(v2.1)与方案 `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md`(v3.1;§3.1–3.5、§6 W5.4-a 段、§9 v3/v3.1 段)。上一轮方案对抗评审 `research/codex-findings/77-w54-plan-adversarial-review.md`(A-01…A-10)是你的检查清单:逐条核对实现是否真按回修后的条款做。门禁由调度方沙箱外实跑(不在你范围)。

找问题不给好评,按 A/B/C:
- A 级:安全退化——`fileToolEffect.ts` 的最长现存祖先 realpath 算法(新文件 / 断链 / symlink 逃逸 / `..` / `~` / 相对路径 / 判不出 ⇒ 必 S3 deny,绝不 S2/allow);`gateScript.ts` 的 claude 门脚本(失败路径 deny JSON + `exit 2`;jq 缺失 printf 静态 deny;curl `--max-time 100`;圈内非敏感写 allow、圈内敏感等 daemon、圈外/判不出 deny、Read 圈内空输出、未知 tool deny;shell 注入面:路径/命令含引号、换行、`$()` 时脚本是否安全);`backends/claude.ts` argv 快照(`--permission-mode default`、五工具、`--disallowedTools`、`--setting-sources ""`、`--strict-mcp-config`、内联 `--settings` matcher `*`、`--max-turns`、`--session-id`/`--resume` 互斥;不含 bypass/dontAsk/acceptEdits/--add-dir/--no-session-persistence/--bare/--fallback-model);`parseClaudeTier1Line` 未调用 `parseClaudeLine`、多块 tool_use 逐块、init 含 apiKeySource/tools、rate_limit、result;cursor seam 抽取是否改变 cursor 行为(argv/解析/kill_on_result/canary 左值 `shellStarted`、`checkCanaries` cursor 分支未改);cmdEffect 收紧是否有**降档**(相对 354b028,除方案明文允许的 `cd`/`pushd` 圈内 S1 外);B3 是否真的不 INSERT;契约只 import `@saydo/contracts`;fixture 不含凭据形态 / 本机路径。
- B 级:测试锚数量与覆盖(file-tool ≥36、cmdEffect +≥26 且既有 223 期望不变、gate-socket +≥10 真 bash/jq/curl、claude backend 快照、outcome ≥12);`AgentSpawner` 可选入参/`stderrTail?` 的向后兼容;`wait_exit_then_kill` 5s 实现正确性;evidence 与 RESULT 的数字 / SHA 与 diff 实况;本机绝对路径泄漏(evidence / RESULT / fixture);HANDOFF 指针开/清。
- C 级:措辞。

对照源:`packages/daemon/src/tier1/{backends/*,fileToolEffect,gateScript,claudeOutcome,cmdEffect,executor,gate,gateServer}.ts`、`packages/daemon/src/providers/byoa/{parsers,processFailure}.ts`、`packages/daemon/src/policy/engine.ts`、`packages/contracts/src/types/task.ts`,新增/改动测试与 fixture,`e2e/spikes/claude-cli-tier1/{RESULT,EXPECTED}.md`,`e2e/evidence/w54a-claude-cli.md`,`HANDOFF.md`。

产出:A/B/C 发现(文件:行、问题、证据、修法)+ 总评(可并入 / 需返工)。简体中文,零 emoji,[ok]/[warn]/[fail]。报告全文作为最终回复输出。
