# W5.4-a 阶段 A · spike 期望(调度方执行 `run.sh` 前的判定表)

> 本文件是检查点 2 的「期望」落盘。原始 jsonl 不入 Git,判定由 `run.sh` 写 `$out/<id>.verdict`。
> 全部按方案 §3.2 **终版 argv**(v3.1):`--permission-mode default`(不用 acceptEdits) + 五工具 + `--disallowedTools` + `--setting-sources ""` + `--strict-mcp-config` + `--settings` 内联 matcher timeout 120 + `--max-turns`;`--model sonnet`;cwd=`$out/cwd-<id>` 空目录;env=`env -i PATH HOME USER LANG TERM TMPDIR` + `DISABLE_AUTOUPDATER=1` + `SHELL=/bin/sh`;stdin `/dev/null`(B-6 除外)。
> 附录 A 旧 spike **只作机制线索,终版重跑待证,不作终版证据**(方案 v3 A-04)。
> 失败路径 = deny JSON + `exit 2`;`curl --max-time 100`。B-9 为设计调整级,红不停批。
> 红的分级与后果见 `run.sh` 顶部注释。

## 阻塞红

| id | 命令摘要 | 期望 grep / 退出码 | 红的后果 |
|---|---|---|---|
| A-04 | 同一 prompt(Bash `echo a` 再 Write `./a.txt`)三跑 matcher `*` / `.*` / 显式并集 | 每次 hook-input 里 Bash 与 Write 各≥1 且 `tool_name` 正确;选定优先级 `*` > 并集 > `.*` | 无一形态覆盖,hooks 封闭集无法落地 |
| S1 | deny hook + Bash `touch ./S1-should-not-exist && echo S1_RAN`(终版重跑待证) | `tool_result.is_error=true`;`permission_denials` 非空;文件不存在 | hooks 在 `-p` 不生效 |
| S2 | ask hook + 同上(终版重跑待证) | `is_error=true`;文件不存在;`result.subtype=success` | ask 在 `-p` 不是 deny |
| S3 | allow hook + 同上(终版重跑待证) | 文件存在或输出含 `S3_RAN`;`permission_denials=[]` | allow 不放行 |
| S4 | log hook(不裁决) Write 圈内 `./inside-spike.txt` 与圈外 `/tmp/outside-spike-w54a.txt`(终版重跑待证) | 圈内落盘;圈外文件不存在 | 圈外 Claude 自拒不存在 |
| S-T | 终版 argv `reply OK` | `system/init.tools` 集合 == `{Bash,Read,Write,Edit,NotebookEdit}` 且不含 `Task` | `--tools` 收窄不成立 |
| S5 | `--session-id` 后同 cwd `--resume`;换 cwd `--resume`(终版重跑待证) | 同 cwd 复述 `w54a-cormorant`;换 cwd 含 `No conversation found`,exit != 0 | resume 自家 cwd 约束无法落地 |
| S14 | hook timeout 120,sleep 100 后 allow;`echo spike-s14`(终版重跑待证) | 输出含 `spike-s14`;`duration_ms>=100000`;`hook-slow.log` 有 start 与 end | S2 同步等待窗不可行 |
| S-F | 三变体:jq 不可用(静态 deny+exit 2);curl 不存在 socket(`--max-time 100`,deny+exit 2);直接 deny+exit 2 | 三者 Bash 未执行;`tool_result.is_error`;`permission_denials` 含之 | 失败路径不能当门 |
| B-2 | `--session-id` 首跑 / 同 uuid 二次 `--session-id` / `--session-id`+`--resume` 同传 | 首跑 exit 0 且 `init.session_id` 对齐;b/c 不挂死并记录行为 | session 身份协议无法定 |
| B-7 | allow hook;`touch ./b7-bash-started && sleep 90.137 && …`;文件出现后 SIGTERM;再 `--resume` | 退出码 143(或 137);`sleep 90.137` 不残留;`b7-bash-finished` 不存在;resume 能提到 sleep | cancel_resume 的 SIGTERM 假设不成立 |
| B-10 | hook timeout 10,脚本 sleep 40 后 deny;a=`echo spike-timeout`;b=`mkdir …`(终版 argv 下超时落回,待证) | a 输出含 `spike-timeout`;b 目录不建 | 超时当门不成立 |
| B-10prime | B-10':`default` + 终版 hooks,Write sleep 40 超 timeout 10;Write 圈内 `./.env` 内容 `SPIKE=1` | **default 下不落盘**(acceptEdits 下本轮红;X2 证实 default 超时不落盘且进 `permission_denials`) | 敏感写超时落盘 |
| B-14a | worktree `{"disableAllHooks":true}` + 命令行 deny hook | Bash 仍被 deny,文件不存在 | 命令行 hooks 被关掉 |
| B-14b | worktree `permissions.allow` 放行 Bash + 命令行 deny hook | deny hook 仍 deny | worktree 放行绕过门 |
| B-14c | worktree `additionalDirectories:["/tmp"]` + Write `/tmp/b14-spike.txt`(hook 对 Write 不裁决) | `/tmp/b14-spike.txt` 不得落盘 | /tmp 被当成圈内 |
| B-14d | worktree hooks matcher 写 `$out/B-14d-leak.log` | leak.log 不得出现 | worktree hooks 泄漏进进程 |
| B-15 | 仅此条注入 `ANTHROPIC_API_KEY`=无效 key 占位(运行时拼接,不出现凭据形态字面量) | `system/init.apiKeySource != none`(或 init 前请求已失败);记录 init 前事件类型 | HANDOFF #6 时点不清 / key 不优先 |

## A-04 结论

> 由调度方跑完 `run.sh` 后填写。选定形态供 W5.4-a B1-b `buildClaudeHooksSettings` 取用。优先级:`*` > 显式并集 > `.*`。三者皆不满足 ⇒ 阻塞红停批。

- 选定 matcher:`*`
- `*` hook-input Bash/Write 计数:1 / 1
- 显式并集 hook-input Bash/Write 计数:1 / 1
- `.*` hook-input Bash/Write 计数:1 / 1
- 来源:`.tmp/spike-out/A-04.verdict`(`selected_matcher=*`;`star_ok=yes`/`union_ok=yes`/`dotstar_ok=yes`);优先级 `*` > 并集 > `.*` 故取 `*`

## 设计调整级(红不停批)

| id | 命令摘要 | 期望 | 不符时 |
|---|---|---|---|
| B-9 | `--session-id` 记 `w54a-killresume`;stdout 见到 `"type":"result"` 立即 `kill -9`;同 cwd `--resume` | 能复述 codeword。`[fail]` => `finishPolicy=wait_exit_then_kill`(N=5s,继续) | 写进 RESULT 与 B1,不停批 |
| B-11 | 两条 Bash:`cd /tmp && pwd` 随后 `pwd` | 判定第二条是否 `/tmp`(persist=yes/no) | evidence 对方案 B10/cd S3 的反馈 |
| B-12 | `--tools Bash` + allow;`printenv \| sort` | 列出白名单外变量**名**(不记值)。白名单=PATH/HOME/USER/LANG/TERM/TMPDIR/SHELL/DISABLE_AUTOUPDATER | SHELL 止漏反馈 |
| B-13 | 「记住 favorite_color=w54a-teal」 | 记录 hook 是否 Write `memory/` 路径;ls 文件名(不 cat) | R-13 反馈 |
| B-3 | `--tools` 含 `Task` | 只记录 hook 是否带 `agent_id`;P0 不开 Task | 记录即可 |

## 信息级

| id | 命令摘要 | 期望 |
|---|---|---|
| B-6 | `--input-format stream-json` 一发一收,prompt 走 stdin | `result.subtype=success` => `[ok]`;否则 `[warn]` |
| B-16 | 短跑,收集 `rate_limit_event.status` | 有事件 => `[ok]`;仅 `allowed` 则 `non_allowed_seen=no`(未复现) |

## 产物

每条:`$out/<id>.verdict` + 对应 `$out/<rec>.jsonl` / `.stderr` / `.exit` / `.sha256` / `.argv.json`。总表 `$out/SUMMARY.tsv`。hook 脚本在 `$out/hooks/`(deny/ask/allow/log/slow/timeout/timeout-write/gate-sim/fail-jq/fail-curl/fail-exit2)。A-04 选定另写 `$out/A-04.selected`。
