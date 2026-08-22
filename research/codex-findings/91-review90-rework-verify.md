核验基线：启动时 `main=1d6680c243e3`，与题设一致；随后共享 `main` 被外部会话推进，以下全部冻结按 `1d6680c` 判定。

## 逐条复核

- **A-1 — STILL_BROKEN**：Bash/Write/Edit/NotebookEdit/Read、三 kind、三态及生成 JS 语法均成立，盘符、UNC、大小写、`..`、`wt2` 前缀处理也正确；但预筛把 hook `cwd` 当 worktree 根，`C:\wt\sub` 访问 `C:\wt\README.md` 会被误拒，且测试对分支/三态主要只是字符串包含断言。[gateScript.ts:429](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/gateScript.ts:429) [gateScript.ts:477](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/gateScript.ts:477) [executor.ts:959](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:959) [tier1-gate-claude-mjs.test.ts:17](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/tier1-gate-claude-mjs.test.ts:17)

- **A-2 — STILL_BROKEN**：identity 与 hook 把门已解耦、没有全 skipped 假绿且 gate 运行时仍 fail-closed，但首次写 identity 后必须重启才能武装；Windows `gateAssetsPresent` 只认两个普通文件，垃圾 bind/secret 也会报 `hook_bind=ok`，未验证 JSON、loopback、port、HMAC 或可达性。[selfTest.ts:105](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/selfTest.ts:105) [selfTest.ts:214](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/selfTest.ts:214) [selfTest.ts:224](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/selfTest.ts:224) [index.ts:3576](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:3576)

- **A-3 — CONFIRMED_FIXED**：源码仍未实现 init 一发一收断言，evidence 已把该锚准确标为 `[fail]` 并禁止判 C1 完成；阶段汇总用 `[warn]` 表示部分完成是自洽的。[selfTest.ts:1](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/selfTest.ts:1) [w54b-batch.md:12](/Users/wangyixiao/WorkSpace/SayDo/e2e/evidence/w54b-batch.md:12) [w54b-batch.md:26](/Users/wangyixiao/WorkSpace/SayDo/e2e/evidence/w54b-batch.md:26) [w54b-batch.md:74](/Users/wangyixiao/WorkSpace/SayDo/e2e/evidence/w54b-batch.md:74)

- **A-4 — CONFIRMED_FIXED**：Claude 缺失、空值、非字符串或非 `"none"` 均 fail-closed；Cursor 当前只把 init 投影为 `observed_model`，不会产出 init，未来若改变 parser 则必须同步修改该分支。[claude.ts:137](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/backends/claude.ts:137) [cursor.ts:25](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/backends/cursor.ts:25) [executor.ts:1713](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1713)

- **A-5 — REGRESSED**：三处 spawn 都已统一重验 identity，普通首次失败结算安全且 mtime/size 缓存是 D12 明示取舍；但恢复供给期间并发取消后再遇 identity 漂移，会对 `cancel_requested` 错调 `finalizeFailure`，任务转 blocked 失败后删除 active 却不 `resolveClaim`，可留下半开状态并挂住 recover barrier。[executor.ts:1580](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1580) [executor.ts:2776](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:2776) [executor.ts:2833](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:2833) [executor.ts:2339](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:2339)

- **A-6 — CONFIRMED_FIXED**：`total_cost_usd` 已贯通 fixture→parser→result event→subscription ledger meta，`0.0473673` 确实来自 fixture；`result_max_turns.jsonl` 缺字段时条件省略，不编数。[claude.ts:204](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/backends/claude.ts:204) [executor.ts:3088](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:3088) [result_success.jsonl:1](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/fixtures/claude-cli/2.1.220/result_success.jsonl:1)

- **A-7 — STILL_BROKEN**：官网承诺与正式 SKU 的切分概念上成立，但全局文本仍互相冲突：ADR-003 仍要求最小镜像才可判 Linux 可用，官网却称已支持；`docs/02` 和 ADR-004 回写清单仍保留“Windows 未宣布/官网不动”的旧口径。[ADR-003-os-adapters.md:203](/Users/wangyixiao/WorkSpace/SayDo/docs/adr/ADR-003-os-adapters.md:203) [02-product-definition.md:125](/Users/wangyixiao/WorkSpace/SayDo/docs/02-product-definition.md:125) [ADR-004-windows-platform.md:109](/Users/wangyixiao/WorkSpace/SayDo/docs/adr/design/ADR-004-windows-platform.md:109) [docs/index.html:893](/Users/wangyixiao/WorkSpace/SayDo/deploy/saydo-octoooo-com/docs/index.html:893)

- **A-8 — CONFIRMED_FIXED**：PLAN 与 crosscheck 已明确登记“违反”，未再用合并顺序自我开脱，并清楚列出合并态复审、Windows 真机四工具三态、真 Claude hook 冒烟三项欠账。[IMPLEMENTATION-PLAN-2.md:78](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:78) [2026-08-22-week-crosscheck.md:64](/Users/wangyixiao/WorkSpace/SayDo/docs/review/2026-08-22-week-crosscheck.md:64) [2026-08-22-week-crosscheck.md:109](/Users/wangyixiao/WorkSpace/SayDo/docs/review/2026-08-22-week-crosscheck.md:109)

- **B-1 — CONFIRMED_FIXED**：期望值与写入值均逐字为 `` `${JSON.stringify(bind)}\n` ``，且直接使用 `listened.bind`。[index.ts:3635](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:3635) [gate.ts:48](/Users/wangyixiao/WorkSpace/SayDo/packages/platform/src/gate.ts:48)

- **B-2 — CONFIRMED_FIXED**：两份 mjs 都在同步读取和顶层 await 前安装兜底；Node 22 纯复跑确认同步 throw、TLA reject 均进入 `uncaughtException`，Claude 仍以 exit 2 失败。[gateScript.ts:324](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/gateScript.ts:324) [gateScript.ts:412](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/gateScript.ts:412)

- **B-3 — STILL_BROKEN**：脚本内部 SOCK/LOG 已转义，但 POSIX hook command 仍裸拼 `gateScriptPath`，路径含空格或单引号会在 shell 中损坏，并同时影响 Cursor 与 Claude settings。[adapter.ts:42](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/adapter.ts:42) [claude.ts:102](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/backends/claude.ts:102)

- **B-4 — STILL_BROKEN**：两个 `fileToolToEffect` 生产调用均已传 `run.worktree`，函数边界没有放宽；但 POSIX/Windows Claude 预筛仍先以 `cwd` 为根误拒合法 worktree 文件，使修正后的 daemon 裁决不可达。[executor.ts:843](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:843) [executor.ts:909](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:909) [gateScript.ts:224](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/gateScript.ts:224)

- **B-5 — CONFIRMED_FIXED**：生产供给与 drift guard 已通过 `gatePathBundle` 共享配置路径，不再从 `saydoHome` 另算活动脚本入口。[executor.ts:1547](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1547)

- **B-6 — STILL_BROKEN**：分词仍把 `not_limited`、`not_blocked`、`quota_not_exceeded` 识别为明确拒绝并强制 blocked；真实 fixture 只观测到 `allowed`，新增测试反而锁死了 `not_limited=true` 的错误行为。[claudeOutcome.ts:21](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/claudeOutcome.ts:21) [executor.ts:3125](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:3125) [tier1-claude-outcome.test.ts:122](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/tier1-claude-outcome.test.ts:122)

- **B-13 — STILL_BROKEN**：README 新政策写成“先落盘者保号”，但真实提交时间是 Windows `05bc91d` 早于 records `ad8adb1`，实际却让 Windows 顺延；ledger 同时仍声称原始文件不重编号。[history/README.md:7](/Users/wangyixiao/WorkSpace/SayDo/history/README.md:7) [DEV-VERSION-LEDGER.md:131](/Users/wangyixiao/WorkSpace/SayDo/history/DEV-VERSION-LEDGER.md:131) [PROCESS-JOURNAL.md:1909](/Users/wangyixiao/WorkSpace/SayDo/history/PROCESS-JOURNAL.md:1909)

- **C-1 — STILL_BROKEN**：路径分类正确，`hooks.json`/`gate-bind.json` 会走数据 writer；但自愈只 chmod+rename、未重走 `restrictOwnerOnly`，Windows 替换后没有 owner-only DACL 保证，脚本面也有同样缺口。[executor.ts:647](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:647) [gateScript.ts:77](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/gateScript.ts:77) [win32.ts:336](/Users/wangyixiao/WorkSpace/SayDo/packages/platform/src/win32.ts:336)

## 回修引入的新问题

- **A**：A-5 新增 identity-failure catch 复用了不接受 `cancel_requested` 的通用 finalizer，形成可达的恢复 barrier 挂死与半开状态。

- **B**：Windows Claude 新预筛沿用了 `cwd` 圈根错误；Windows self-test 新探针可把任意两个普通文件报成 hook transport 就绪；B-6 新测试把语义明确为否定态的 `not_limited` 固化成拒绝。

- **B**：编号政策回写后形成新矛盾——文字规定“先落盘者保号”，实际处置却按“引用较多者保号”。

- **C**：POSIX `*..*` 与 Windows 的 `..` 分量判断并非同语义；前者还会误拒 `foo..bar` 这类合法文件名。[gateScript.ts:185](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/gateScript.ts:185) [gateScript.ts:429](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/gateScript.ts:429)

- **C·测试未锁住**：A-1 的工具/kind/三态主要是字符串断言且 `ROOT===cwd`；A-5 未覆盖 recovery/retry/并发取消；A-6 未断言缺成本字段时 meta 不出现；B-1、B-2、C-1 没有直接行为/ACL 回归测试；A-2 的 fake probes 未提供 `gateAssetsPresent`，其“全绿”用例在原生 Windows 会失败。[tier1-self-test.test.ts:55](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/tier1-self-test.test.ts:55)

补充验证：`git diff --check 4d2824e..1d6680c -- packages/` 实测 exit 0；你方 `just ci` 结果未被否定，但本环境的目标 Vitest 在写 Vite 临时缓存时被只读沙箱以 `EPERM` 拦截，未进入测试，故不冒充独立复跑通过。

总裁决：No-Go。