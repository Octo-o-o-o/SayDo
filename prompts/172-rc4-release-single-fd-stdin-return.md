# RC4 发布：helper stdin 单一 fd 绑定返工

继续原 `grok-4.6` 发布实施会话，只修改当前 `<repo>` worktree。不要 commit、push、联网、发布、部署或启动 subagent；不要修改用户原始 dirty worktree。

上一轮按 op 精确失败元组与 5 次 provenance 已在主机真实通过，但对新临时输入通道的独立复核连续被平台中断，未形成 Go。主会话逐行检查确认一个新的发布可靠性 P1，因此仍不可封板。

## 已确认问题

`runOpenatHelper()` 当前先 `writeFileSync(tmpPath, ..., {flag:"wx",mode:0600})`，随后再 `openSync(tmpPath,"r")`。这是两次按路径打开；若两步之间发生同用户普通并发 rename/替换，传给子进程的 fd 不保证仍是刚写入的对象。随机名称和 0600 不构成对象 identity 证明。

## 必须完成

1. 临时输入从创建到传给 `spawnSync` 必须始终是同一个 fd：一次以 exclusive create、owner-only、read/write、no-follow 语义打开；不得在写后按路径 reopen。
2. 写入要处理 short write，并采用不会把该 fd 的共享读 offset 推到 EOF 的定位写入，确保子进程从 byte 0 读到 exact JSON；写后验证同一 fd 仍是普通 single-link owner-only 对象、size 精确且 identity 未漂移。
3. 在启动子进程前 unlink 名称，使运行期间只剩已绑定 fd；unlink 失败必须 fail-closed，finally 仍要尽力关闭/清理。任何创建、写入、校验、unlink、spawn、close 异常都返回既有通用失败，不回显路径或 payload。
4. 维持 `MAX_OPENAT_STDIN_BYTES`、1 MiB evidence MAX/MAX+1、30 秒 timeout、stdout 上限和 helper 返回解析合同；Windows 的 `OPENAT_UNSUPPORTED` 语义不变。
5. 增加确定性回归，证明旧式“创建后再按路径打开”的替换窗口不再存在：测试不得靠高次数概率竞跑。优先对 fd 创建/定位写/校验/unlink/交付各阶段注入可控 IO，并断言 spawn 接收的就是创建时 fd；测试入口不能成为生产 ambient 旁路。
6. 保持上一轮 per-op `(error, optional code)` 表、跨 op/笛卡尔负例、`read + LEASE_LOST + ENOENT` fail-closed、合法缺失与 mutation=0 全部不退化。

## 稳定性门禁

无并行发布测试时连续运行完整 provenance 至少 5 次，每次单独记录 exit。另逐条运行：

```text
node scripts/test-release-physical-evidence.mjs
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
node scripts/check-doc-links.mjs
git diff --check
actionlint
```

报告单 fd 创建 flags/mode、定位写与 short-write 结果、unlink-before-spawn 证据、确定性 replacement-window 回归、每个 op 合法元组/负例/mutation 数和 5 次 provenance exit。不要创建最终 boundary，不要回显绝对路径、payload 或本机身份。
