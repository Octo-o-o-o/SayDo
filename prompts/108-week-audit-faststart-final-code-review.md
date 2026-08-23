# SayDo 最近一周双向审计与快速发布最终对抗评审

你是零上下文、只读的对抗性评审者。仓库位于
`/Users/wangyixiao/WorkSpace/SayDo`，当前候选提交是 `4f04c03`；本轮修复分支相对
`3fccf4a` 的全部提交都属于审查范围，尤其要逐行审查 `4f04c03^..4f04c03`。不得修改文件，
不得把仓内既有 review、自述或测试名称当作正确性证据；必须以代码、合同、真实命令结果为准。

目标是判断该候选是否足以进入最终审计证据提交、公开 GitHub Release 与三平台安装测试。请重点寻找：

1. Tier1 `failure | review` durable intent 在进程退出、restart marker、ownership 清理、verify/snapshot、
   terminal transaction 任意崩溃点是否会重启 agent、重复副作用、伪造成本/游标或留下半终态；取消与 steer
   在恢复、gate 请求、异步 reap 和首次 SQLite 写失败时是否始终优先且可自愈。
2. request/settle/reject/approve 的 task、run、message、outbox、audit 是否真正处于正确事务边界；
   审计 sink 抛错或 CAS 竞争时是否可能部分生效。
3. writing approve 是否在同一批准事务内重读 task/run/package/proof/artifact，并以不可变 git tree blob、
   canonical `articlePath` 与磁盘 artifact 字节交叉证明；POSIX/Windows 绝对路径、UNC、盘符、反斜杠穿越
   和旧 proof 兼容是否 fail-closed。
4. daemon API 到 console mapper 的 `AcceptanceCheck` 是否仍可能因 task 状态、重复 criterion、缺/伪造
   evidenceRef、错误 source 或伪造 owner audit 显示 pass/fail。
5. Windows 全局 npm 安装产生的标准 `.cmd` shim 是否被完整模板解析为 `node.exe + JS`，多行 prompt/settings
   是否原样传递，且不能借额外命令、变量、参数、绝对目标或非标准模板进入 `cmd.exe` 或执行错误入口。
6. GitHub immutable prerelease 是否从发布瞬间就是 unavailable/pending，三平台 `exec/global` 固定 URL smoke
   全绿后才可用，失败后仍显式 unavailable；workflow 的 `needs/if/permissions/readback` 是否有假绿或无人收口路径。
7. `publish-public-snapshot.sh` 是否精确绑定 clean main、origin SHA、CLI version/tag、workflow trigger、immutable
   设置、公开 remote、隐私探针与 atomic push；grep/网络/探针缺失失败是否会被误判成“无命中”。
8. canonical 文档与实现是否仍有实质矛盾，测试是否遗漏上述最危险的反例。

可只读运行必要的定向测试。输出中文报告，按 A（发布阻断）、B（重要不足）、C（改进建议）分级；
每条必须给精确 `file:line`、可复现状态链和最小修复。明确列出已独立验证的命令与原始结果摘要。
若没有 A/B，明确给出 Go；否则给出 No-Go。不要执行 push、发布、部署、删除、编辑或提交。
