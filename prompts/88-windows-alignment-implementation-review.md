# Windows 对齐设计包 · 实现可行性/安全评审输入

只读评审。角度 = 现有 TS/Python 能否按工程 ADR-003 落地、Windows 安全等价、测试与 CI。

必读:两份 ADR + WINDOWS-ALIGNMENT.md。对照:
`packages/cli/src/emergencyReaper.ts`、`packages/daemon/src/runtimeChildRegistry.ts`、
`gateServer.ts`、`gateScript.ts`、`index.ts` 锁、`workspace.ts`、`anchor.ts` pathSpans、
`pipeline/.../__main__.py`、`justfile`、`uvBin.ts`。

重点攻击:koffi/Job Object、Named Pipe ACL、birth identity、icacls fail-closed、
路径误触发、alive1 回归、与 W5.4-b 文件冲突。

输出:A/B/C,每条 file:line 或设计段落、后果、最小修复。
