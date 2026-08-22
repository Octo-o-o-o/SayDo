# 88 · Windows 对齐 · 实现可行性/安全评审(subagent)

评审员:独立 code-reviewer subagent。工作树 `feat/windows-alignment`。只读。
输入:`prompts/88-windows-alignment-implementation-review.md`。

**结论:** 现实现不能原样加 win32 分支。工程 ADR-003 与设计 ADR-004 在回收手段上打架。A 级必须先收口再动手。

## A 级

- A-1 Job Object 匿名句柄 + ADR-004 允许 taskkill 会逼出无身份杀树。生产必须具名 Job + KILL_ON_JOB_CLOSE;koffi 失败拒起执行器。
- A-2 Named Pipe 默认 ACL + 全局可猜名 + 无认证 /gate 弱于 unix socket;listen 失败仍可能留下钩子。须 nonce+HMAC/cap-token;禁止 AF_UNIX 文件与 TCP 回退。
- A-3 alive1:pid 仍是生产回退;WMI CreationDate 秒级不够。用 GetProcessTimes 100ns FILETIME。
- A-4 getuid 缺失即跳过 owner;junction 不是 isSymbolicLink;cap-token chmod 软吞。
- A-5 `[A-Za-z]:/` 会把 https:// 当路径;`\\?\C:\` 可绕拒。
- A-6 W-Win 与 W5.4-b 双写 gate 协议。运输与协议拆所有权。
- A-7 verify 只改 HOME,Windows 仍读 USERPROFILE。

## B 级

- B-1 POSIX 删 alive1 会打现网 macOS 锁;测试手写 alive1
- B-2 icacls 真调会打爆 setup.ts
- B-3 gate-socket 测试无 skipIf(win32)
- B-4 uvBin PATH.split(":")
- B-5 justfile bash + pipeline add_signal_handler
- B-6 editorDeepLink POSIX 词法
- B-7 notify 写死 osascript

## C 级

open.ts 空参数、测试硬编码 /Users、SIGTERM 在 Windows、Task 1 path 字符串相等。
