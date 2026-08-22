# 88 · Windows 对齐合同包 · Codex 对抗评审

- 模型:`gpt-5.6-sol` / reasoning=max / sandbox=read-only / ephemeral
- 命令:`codex exec -m gpt-5.6-sol -c model_reasoning_effort=max -s read-only --skip-git-repo-check --ignore-rules --ephemeral -`
- prompt:`prompts/88-windows-alignment-codex-review.md`
- 日志:`logs/88-windows-alignment-codex.log` 887742 bytes / SHA-256 `955523f64a62e08f463153344ef947cc6134c7714e3b65dd60ea7526d974d957`
- tokens used: 396645
- 结论:`[fail]` 仍需阻断实施。**A=7，B=7，C=1。**

完整逐条见本文件下文。原始 stdout 含工具轨迹,以日志为准。

---

文字合同没有直接放宽 Gate 0、S3 或身份 fail-closed；`koffi`、ACL 失败也被要求拒绝运行，而不是静默降级。但若按当前设计包照抄实施，仍有七个安全/身份/数据边界无法机械兑现。

## A 级

**A1** `pgrep -lf` 不是 birth identity。macOS 用真实 start time；取不到即 null。删除 pgrep 与 `alive1`。

**A2** Job Object 须具名 + `KILL_ON_JOB_CLOSE` + `killOwnedTree({pid, expectedBirth, jobName})`。koffi 失败拒 dispatch。

**A3** Node `listen(pipe)` 不能设 owner-only DACL。须 native 创建期 SD，或**重选 IPC**。

**A4** `icacls /grant` 不去掉显式 Everyone。须构造并回读精确 DACL；旧 token 也要收紧；非 NTFS 拒写。

**A5** “最低 NTFS”须机械排除 ReFS/SMB/subst/任意 reparse。

**A6** 门完整性补偿须覆盖活动入口(`gate.mjs`/`gate-claude.mjs`)，不能只哈希 `gate.sh`。

**A7** Windows P0 若声称 Claude 也走通，须冻结 `gate-claude.mjs` 物理链，不能只有 Cursor 形状。

## B 级

B1 macOS 去掉 `alive1` 是硬化，须写明 fail-closed 可用性变化。
B2 盘符词法须先排除 URI；quoted 必须整段是路径。
B3 TS/Python 要有共同身份测试向量。
B4 W-Win 与 W5.4-b 并行双写安全文件，须 owner 裁定串行。
B5 `windows-latest` 与本地 `just ci` 层级冲突；distribution/`X_OK` 未进 P0 文件表。
B6 内部“正式执行面”现在时 vs 官网暂不支持。
B7 S3 话术仍 Touch ID；Hello 真人证据未进计划。

## C 级

C1 07 D8 仍写死 jq。
