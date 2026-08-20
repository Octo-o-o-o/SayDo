# W5.4-a 阶段 A · Claude Code CLI spike RESULT

> 调度方沙箱外执行 `bash e2e/spikes/claude-cli-tier1/run.sh --out .tmp/spike-out`(2026-08-20 02:07–02:16)。
> 二进制 `2.1.220`，`--model sonnet`。原始 jsonl 留 `.tmp/spike-out/`(不入 Git)。sha256 取对应 `.sha256` 文件;X1–X5 本会话 `hashlib.sha256`。
> 附录 A 旧 spike 只作机制线索。本轮按终版 argv 重跑(当时 `--permission-mode acceptEdits`)。B-10' 红后方案升 **v3.1**:终版改为 `default`，圈内非敏感写 hook 显式 allow。

## 0. 总表

### 阻塞红

| id | 判定 | 说明 |
|---|---|---|
| A-04 | [ok] | 三形态 Bash/Write hook-input 各 1;选定 `*` |
| S1 | [ok] | deny 生效,文件不存在,`permission_denials_n=1` |
| S2 | [ok] | ask 在 `-p` = deny |
| S3 | [ok] | allow 放行,`S3_RAN` |
| S4 | [ok] | 圈内 Write 落盘;圈外不落盘 |
| S-T | [ok] | `init.tools` 恰五件,无 Task |
| S5 | [ok] | 同 cwd 复述 codeword;换 cwd `No conversation found`,exit 1 |
| S14 | [ok] | `duration_ms=106600`;slow hook start/end 都有 |
| S-F / a/b/c | [ok] | jq 缺失 / curl 不通 / deny+exit 2 三者均阻断 |
| B-2 | [ok] | 首跑 session 对齐;二次 `--session-id` 报 already in use;同传报需 `--fork-session` |
| B-7 | [ok] | SIGTERM exit 143;sleep 不残留;resume 可续 |
| B-10 | [ok] | 无害 echo 超时后仍跑;mkdir 圈外未建 |
| B-10prime | [fail] | `acceptEdits` 下圈内 `.env` 落盘。v3.1 改 `default`;X2 证实超时不落盘 |
| B-14 / a–d | [ok] | 四项矩阵在 `--setting-sources ""` 下均不生效 |
| B-15 | [ok] | `apiKeySource=ANTHROPIC_API_KEY`;首事件 init;init 前零事件;随后 `api_retry`;exit 143 |

### 设计调整级(红不停批)

| id | 判定 | 说明 |
|---|---|---|
| B-9 | [ok] | result 后 kill -9(exit 137)仍能 resume 复述 codeword。`finishPolicy` 仍取 `wait_exit_then_kill`(N=5s)保 transcript/SessionEnd |
| B-11 | [warn] | `persist=unknown`(模型未按预期连续给出两条 `pwd`) |
| B-12 | [ok] | 多出变量名见下;无 shell rc 导出 |
| B-13 | [ok] | auto-memory **经 Write** 写 `MEMORY.md` / `user_preferences.md` |
| B-3 | [ok] | `task_seen=no`,`hook_agent_id=no` |

### 信息级

| id | 判定 | 说明 |
|---|---|---|
| B-6 | [ok] | `--input-format stream-json` 一发一收 `subtype=success` exit 0 |
| B-16 | [ok] | 仅见 `rate_limit_event.status=allowed`;拒绝态未复现 |

## 1. 逐条(摘录 + sha256)

路径前缀 `$out` = `.tmp/spike-out`。摘录已去掉本机绝对路径。

### A-04 [ok] blocking

- `selected_matcher=*`(`A-04.selected`);`*` / 并集 / `.*` 均为 Bash=1 Write=1。
- sha256 star `09014839c867853239db29233294745e8ccf10828fcc6aa78c75bf9bca9e64d9`
- sha256 union `529d16cd350ce698002abee75cfd1adffb87961920f608d90173513dd76795af`
- sha256 dotstar `22991192abce94de1519b9ad06a0ab7d701d0cb3df7f30be4680dd6bc87a7328`
- 摘录(star):assistant `tool_use` name=Bash command=`echo a`;随后 name=Write。

### S1 [ok] blocking · rec S1-a1 · sha256 `80eb0231dc6043ec5ffb06fe9f4f4778949859898ae8c081508199191b09c2b2`

```
{"type":"user","message":{"content":[{"type":"tool_result","content":"SayDo spike: denied by gate (fail-closed)","is_error":true}]}}
{"type":"result","subtype":"success","permission_denials":[{"tool_name":"Bash"}]}
```

文件 `S1-should-not-exist` 不存在。exit 0。

### S2 [ok] blocking · rec S2-a1 · sha256 `03de11851d5c59c64cd2e0c6a892d35d2e095ead8f60b3fce35e771c94689c14`

`tool_is_error=true`;文件不存在;`subtype=success`。ask 在 `-p` 等同 deny。

### S3 [ok] blocking · rec S3-a1 · sha256 `1df30d4db036996caa3883f17ba9c534590f94b9f129fcb00249e48e71ae6751`

`ran=yes`;`permission_denials_n=0`;result `"Output: S3_RAN"`。

### S4 [ok] blocking · rec S4-a1 · sha256 `942b284f7dc0accb09c9bbeae84bbbc46191b645f521c8382504703331842c81`

`inside=yes` `outside=no`。hook 不裁决时 Claude 自身拒圈外 Write。

### S-T [ok] blocking · sha256 `9eb882c4b3a6fc1b31cb3343284c8e12ba11c93849eff6b80b7c32899b3c6da5`

```
{"type":"system","subtype":"init","tools":["Bash","Edit","NotebookEdit","Read","Write"],"apiKeySource":"none","claude_code_version":"2.1.220","permissionMode":"acceptEdits"}
```

(当时 argv 仍是 acceptEdits;v3.1 后 init.permissionMode 应变为 default。)

### S5 [ok] blocking

- setup sha256 `4fe42c48723a26c5495a4a3f3dbdf889d244b69efb1e3121335ee1c027b3812c`
- same sha256 `f1d36bcdfd2a8b6189626a282d5107ac2ede4fef433505a00cfc1ca6acafb93e` 复述 `w54a-cormorant`
- cross sha256 `74f69b541240e21314f0c4f78e44e7ea7e9496b1cfcc9b39764d7e2c05307dfa` exit 1
- stderr:`No conversation found with session ID: 939d9ecc-…`
- result `{"subtype":"error_during_execution","is_error":true}`

### S14 [ok] blocking · sha256 `1c232a0c9228db20ac751ef84ec039dce9fdc15d4e1a32944ef3a3321aa44e0a`

`duration_ms=106600`;`ran=yes`;`slow_start=yes` `slow_end=yes`。S2 同步等待窗可行。

### S-F [ok] blocking

| 变体 | sha256 | 判定 |
|---|---|---|
| S-Fa jq 缺失 | `a896a3765a35dca0e82d3fadd84b41d648d996421bda0b338b507272bb21612e` | 文件不存在,`is_error=true`,`permission_denials_n=1` |
| S-Fb curl 不通(`--max-time 100`) | `0fcf79f4992a09aa6cac2be6bffc395cfa6f7084238e8f595b0262a2d05b1d4a` | 同上 |
| S-Fc deny+exit 2 | `7f169b830a09f2725f0a9e9af0698fb2ac5348dc5809a9be0ec6ebac59f9435d` | 同上 |

失败路径 deny JSON + `exit 2` 在 `-p` 下阻断。

### B-2 [ok] blocking · uuid `ffda93e8-245a-4e85-ad4c-5658c7b2b275`

- a exit 0,`init.session_id` 对齐。sha256 `c387f8958d5c087a6f13432e1700af44dbe1342dce102b25b81c4446c1cc0d7b`
- b 二次 `--session-id` stderr:`Error: Session ID … is already in use.` jsonl 空(sha256 空文件 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`)
- c `--session-id`+`--resume` stderr:`Error: --session-id can only be used with --continue or --resume if --fork-session is also specified.` jsonl 空(同上空文件 hash)

不挂死。身份协议:首跑用 `--session-id`;续跑只用 `--resume`(互斥)。

### B-7 [ok] blocking

- a SIGTERM exit 143;`started=yes` `finished=no` `sleep_leftover=no`。sha256 `5bfe1703829f896c512e50b148f558c17811e0f67f46ee16291d9e3f3fa50208`
- b resume_ok=yes。sha256 `92b65e24383cc11a2db4b3708caa07aee2a255f6c9be960f817379d757822a9e`

### B-9 [ok] design

- a kill-on-result exit 137。sha256 `4a1b39201f3ab2c80718062c9ec12a0ded525bd147cc525b1f6fe70dd379cf1b`
- b 复述 `w54a-killresume`。sha256 `634b8e28b20f7eed45cca10bbf19b93c5fee83baf9c1dd2a308c14d50b44be5d`

红则必须 `wait_exit_then_kill`。本轮绿,仍取 `wait_exit_then_kill`(N=5s)作为偏好,保 SessionEnd/transcript。

### B-10 [ok] blocking

- a `harmless_ran=yes` sha256 `81d215fedd662e5682fcd94d8cfd60afebcd56c24ba5571ce39bcf186067051c`
- b `mutate_created=no` `hook_reached_end=no` sha256 `8ab35739b68fe11dc01cac10d7a934d83d53cd1a6f05bd4552afa2f8538a832f`

超时非阻断:无害 Bash 落回 Claude 自放行;变更类问=`-p` 拒。

### B-10prime [fail] blocking · sha256 `d028a8e4affe504d32c6be8e695637aa64c02b6a1f8b09d93f4639cca07c8d5c`

`env_exists=yes`。`acceptEdits` 下 hook 超时后圈内 Write 自动落盘,`permission_denials=[]`。

**v3.1 处置**:终版 `--permission-mode default`;圈内非敏感写改为 hook 显式 allow。调度方补测:

| id | sha256 | 结论 |
|---|---|---|
| X1-default-allow | `2d2d87b53293ca216d78519afd73a418faaa697e7c89252155eb3c66c998a2d0` | default+allow ⇒ 圈内 Write 成功,`permission_denials=[]` |
| X2-default-timeout | `db8e93a7fda37d9548a2fde7f3d2c030de3166f85da11f151dded6930f122d0d` | default+hook 超时 ⇒ `.env` 不落盘,`permission_denials` 含 Write |
| X3-default-nodecision | `2ad1f06f855561fed1e1015af71f4ee33457832c88435da2e21327d60857c8d7` | default+无裁决 ⇒ 圈内 Write 被拒 |
| X4-default-read-nodecision | `f36389e2e397fee8d81cf4a4db9d1134f5136a10b25b91874e96e9085e6f0bab` | 圈内 Read 自动放行 |
| X5-default-read-outside-nodecision | `6e23034e318b63e2b0c9ecf760ee449ba23d3c591fcd5314759d365b1d5e051e` | 圈外 Read Claude 自拒,`permission_denials` 含 Read |

X2 摘录:`permission_denials:[{"tool_name":"Write","tool_input":{"file_path":"…/.env","content":"SPIKE=1"}}]`。B-10' 口径改为「default 下超时不落盘」。不启用敏感基名 watchdog。

### B-14 矩阵 [ok] blocking

| 项 | sha256 | 判定 |
|---|---|---|
| a disableAllHooks | `c639f50bf6d5e88d1d0ebfd45acce4a5d24a5c2550a59f2724e9c6a0c985b5f2` | CLI deny 仍触发 |
| b permissions.allow Bash | `942699c490766048a0c02e547df1826b0f52dad9dd442899f633c171d12da3e3` | deny 仍 deny |
| c additionalDirectories /tmp | `b508d7d04a52faffec3e150d3983ed8ac0a44fb813b7abcc05d90226791a4365` | `/tmp/b14-spike.txt` 不落盘 |
| d 覆盖 hooks matcher | `9e80d77c620339eb05089dbed3e4a3fa96e67ad90b083b45edf14b5d8e797c5b` | leak.log 不出现 |

### B-15 [ok] blocking · sha256 `c4efbdde0231521d0a708016f97d8c6bc2a2e792555b55b4fb1e5e38d7aa373a`

`apiKeySource=ANTHROPIC_API_KEY`;`first_type=system/init`;`events_before_init` 空;init 之后出现 `system/api_retry`;exit 143。init 即判 `apiKeySource` 时点成立(此前无 assistant)。

### B-11 [warn] design · rec B-11-a1 · sha256 `cbaf4520c81c5a068092ff731246ded98b83f00b53b5560b4fae23fee1f64cae`

`persist=unknown`。流里有两次 Bash,但 `pwd_lines` 只收到一条工作目录路径,无法判定第二条是否仍为 `/tmp`。cmdEffect `cd` 收紧仍按方案 v3 落地(只升不降,不依赖本条)。

### B-12 [ok] design · rec B-12-a1 · sha256 `8f3e661dc6c3bac0853613e1a4353ffff015df1a73cfc483e4abbf809af38302`

白名单外变量名(不记值):`_` `AI_AGENT` `CLAUDE_CODE_CHILD_SESSION` `CLAUDE_CODE_ENTRYPOINT` `CLAUDE_CODE_EXECPATH` `CLAUDE_CODE_SESSION_ID` `CLAUDE_EFFORT` `CLAUDE_PID` `CLAUDECODE` `COREPACK_ENABLE_AUTO_PIN` `GIT_EDITOR` `LOGNAME` `NoDefaultCurrentDirectoryInExePath` `OLDPWD` `PWD` `SHLVL`。Claude 自注入,非凭据。无 zshrc 导出变量 ⇒ `SHELL=/bin/sh` 止漏有效。

### B-13 [ok] design · sha256 `7554bc6b84c0314af36f57acca28e8f3b3da8cc747840f0cc5b9a83e0b4c23da`

`write_via_tool=yes`。Write 目标:`…/memory/user_preferences.md` 与 `MEMORY.md`。`default` + 圈外写 deny 下这些写会被门拒(噪音而非风险)。R-13:P0 接受 deny,审计标 `auto_memory_denied`;W5.4-c 再观察噪音量。

### B-3 [ok] design · sha256 `b28cf8f573a3f2eff82b4f7b12ab79c5bbfce39d9fe101521c6356347fbb9401`

未调用 Task,无 `agent_id`。P0 不开 Task。

### B-6 [ok] info · sha256 `14623291e937dde899fd8ff87d81913dd5cbcc76e16c2644a912ebab191b747e`

`subtype=success` exit 0。P1 live steer 前提可行,本批不实现。

### B-16 [ok] info · sha256 `0a5e6a7276b3485af225bf77cd0eea331641396d1c309569578aa00fa2f6cb5d`

```
{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","rateLimitType":"five_hour"}}
```

拒绝态词表未复现。只对明确拒绝态动作。

## 2. 对方案条款的反馈

| 条款 | 反馈 |
|---|---|
| D3 / §3.2 permission-mode | `acceptEdits` 不可用(B-10' 红)。终版 `default` + 圈内写显式 allow(X1–X3) |
| §3.3 matcher | A-04 选定 `*` |
| §3.1 finishPolicy | B-9 绿仍取 `wait_exit_then_kill`(5s) |
| B-11 / cmdEffect `cd` | persist 未测出;收紧条款仍落地 |
| B-12 | 上表变量名登记;SHELL 止漏有效 |
| B-13 / R-13 | auto-memory 经 Write;P0 deny+审计标记 |
| S-F | 失败路径 deny+exit 2 已证阻断 |
| B-2 | `--session-id` 与 `--resume` 必须互斥 |

## 3. golden fixture

`packages/daemon/test/fixtures/claude-cli/2.1.220/` 七件,路径已替换为 `/tmp/saydo-fixture/…`,`node -e` 逐行 `JSON.parse` 通过。

- `init.jsonl` 出自 S-T
- `tool_use_multi.jsonl` 把 A-04-star 的 Bash+Write 两块合进一条 assistant
- `tool_result.jsonl` 出自 S1 deny + A-04-star 成功
- `result_success.jsonl` 出自 S3
- `result_max_turns.jsonl` **无 live `error_max_turns` 流**(B-11 `--max-turns 5` 未到限);按附录 A S11 形状合成
- `rate_limit.jsonl` 出自 B-16
- `resume_fail.jsonl` 出自 S5-cross

## 4. 阶段 A 出口

阻塞红除 B-10prime 外全 [ok]。B-10prime 已由 v3.1 + X2 闭环,不启用 watchdog,不挡进 B。`run.sh` 终版 argv 已改为 `--permission-mode default`。
