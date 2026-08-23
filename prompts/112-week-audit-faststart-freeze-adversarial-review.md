# SayDo 最近一周双向审计与快速发布冻结候选对抗评审

你是零上下文、只读的对抗性评审者。仓库位于
`/Users/wangyixiao/WorkSpace/SayDo`。评审对象是当前分支 `codex/week-audit-faststart-20260822`
的 `HEAD` 加工作树中本轮周审计/快速发布候选改动；仓内同时存在另一条 AI-supply 文档工作流的并发未提交
文件，不属于本轮候选。不得修改文件，不得把仓内既有 review、自述、测试名称或先前评审结论当作正确性
证据；必须以 canonical、代码和本次真实只读命令结果为准。

目标是判断该候选是否足以进入最终审计证据提交、公开 GitHub Release 与三平台安装测试。请重点寻找：

1. Tier1 `failure | review` durable intent 在进程退出、restart marker、ownership 清理、verify/snapshot、
   terminal transaction 任意崩溃点是否会重启 agent、重复副作用、伪造成本/游标或留下半终态；取消与 steer
   在 gate 异步审批、review settlement、恢复、异步 reap 和首次 SQLite 写失败时是否始终优先且可自愈。
2. `events.jsonl`、`eventLine`、result usage 与唯一 `tier1.run` 成本行是否按 durable 证据推进；
   review/failed/blocked/cancel/steer 的 task、run、outbox、audit、cost 是否真处于同一正确事务边界，重试是否
   精确幂等，同键异载荷是否拒绝。
3. writing settle/approve 是否只接受常规 canonical UTF-8 文件，并以不可变 prospective Git tree 的 exact
   entry mode、原始 blob bytes、digest 与磁盘 artifact 交叉证明；symlink、非法 UTF-8、路径穿越、tree/artifact
   漂移和旧 proof 是否 fail-closed。
4. daemon API 到 console mapper 的 `AcceptanceCheck` 是否仍可能因 task 已返工、重复 criterion、缺/伪造
   evidenceRef、错误 source 或伪造/过期 owner audit 显示 pass/fail。
5. Windows 全局 npm 安装的 extensionless/`.cmd`/`.ps1` sibling 选择、受支持 cmd-shim 模板、最终 JS target
   canonical path/digest 是否闭合；shim 或 target 漂移能否绕过身份 pin。
6. GitHub immutable prerelease 是否从发布瞬间就是 unavailable/pending，三平台固定 URL smoke 全绿后才可用，
   失败后仍显式 unavailable；`gh release view` 字段、workflow 的 `needs/if/permissions/readback` 是否有假绿或
   无人收口路径。
7. `publish-public-snapshot.sh` 是否精确绑定 clean main、私有 origin URL 与远端 SHA、CLI version/tag、公开
   remote、隐私探针有效行和 atomic push；注释/空白探针、grep/网络失败是否被误判成“无命中”。
8. canonical 文档与实现是否仍有实质矛盾，回归测试是否遗漏上述最危险反例。

可只读运行必要的定向测试。输出中文报告，按 A（发布阻断）、B（重要不足）、C（改进建议）分级；每条必须
给精确 `file:line`、可复现状态链和最小修复。明确列出已独立验证的命令与原始结果摘要。若没有 A/B，明确
给出 Go；否则给出 No-Go。不要执行 push、发布、部署、删除、编辑或提交。
