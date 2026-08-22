# Windows 对齐批 · 证据(2026-08-22)

> 性质:原生 Windows P0 工程对齐。官网 FAQ 仍为「暂不支持」。无部署、本文件落盘时尚未 commit。
> 工作树:`feat/windows-alignment` 相对 `origin/main` `84af899`(`snapshot: 2026-08-21 from internal 11e3653`)。
> 代码提交:`be82f98`(feat(windows-alignment);证据提交不自指)。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做。
> 设计源:设计 ADR-004、工程 ADR-003、`docs/plan/WINDOWS-ALIGNMENT.md`;形状以 `docs/09-data-contracts.md` 为准。

## 1. 本机坐标

- OS: Windows 10.0.26200 x64, PowerShell, Node v22.22.0
- 包管理: pnpm 10.33.1
- 命令在 `C:\Users\satan\WorkSpace\SayDo` 执行,无 WSL 替身

## 2. 本机命令与数字(收口复跑)

| 命令 | 结果 |
|---|---|
| `pnpm typecheck` | [ok] 6 个 workspace typecheck 绿 |
| `pnpm lint` | [ok] `eslint packages` exit 0 |
| `pnpm --filter @saydo/platform test` | [ok] 9 passed |
| `pnpm --filter @saydo/contracts test` | [ok] 103 passed |
| `pnpm --filter @saydo/cli test` | [ok] 20 passed / 1 skipped |
| `pnpm --filter @saydo/console test` | [ok] 264 passed |
| `pnpm --filter @saydo/daemon test` | [ok] **1643 passed / 33 skipped**, 113 files pass / 4 skip |
| `node scripts/check-emoji.mjs` 及 emoji/color/migration 自测 | [ok] 门禁绿;migration FIFO 在 win32 skip |
| `uv --directory pipeline run python -m ruff check .` | [ok] All checks passed |
| `uv --directory pipeline run python -m pytest -q` | [ok] **34 passed** |
| `pnpm --filter @saydo/cli verify:distribution` | [ok] `ok: true`;lifecycle `prepareShutdown=restart_pending` 后续接 `settled_review`;`orphanCheck=daemon_agent_and_descendant_exited`;identity `protocolVersion=1.0.0` |
| `git diff --check` | [ok] 无空白错误 |

分发校验摘要(第二次收口复跑,koffi 已标 esbuild external):

- tarball `saydo-cli-0.0.1.tgz` entryCount=12
- sourceRevision `45f575529cde0cfc45d1d2b5913bad8b6c0bed7663637fc67e1eba0f54a6f180`
- defaultPort `owned_on_47100`
- 优雅停走 `$SAYDO_HOME/runtime/cli-stop-<cliPid>`,不把 `child.kill("SIGINT")` 当 Windows 可捕获信号

## 3. win32 skip 名单(darwin/POSIX 专有或 live 门控)

daemon 本机 33 skip:

- `test/tier1-gate-socket.test.ts` 整文件 21:POSIX unix-socket + `gate.sh`;win32 对等面是 `tier1-gate-loopback.test.ts`
- `test/p05b-fake-runner.e2e.test.ts` 3 + `test/p05b-recovery.e2e.test.ts` 1:本机无 Hopper 锁定副本
- `test/tier1-live.e2e.test.ts` 3:`SAYDO_LIVE_E2E` 未开
- `recovery-only-process.test.ts` 3:SIGINT/SIGTERM drain;POSIX 进程组可捕获 SIGTERM,Windows 走 Job(emergency-reaper / runtime-child / executor setup-hang 覆盖)
- `tier1-config-validate.test.ts` 1:POSIX `X_OK`;win32 不按 unix 可执行位
- `launchd-plist.test.ts` 1:非可执行跳过(unix mode)

cli 1 skip:`emergency-reaper.test.ts` A4 POSIX PGID 盲杀反例;对等 win32 例「组长死后仍经具名 Job 回收后代」已跑绿。

scripts:migration FIFO 在 win32 skip。

## 4. 合同与机制(对照评审)

- [ok] `@saydo/platform`:birth=`ft:<hi>:<lo>:<pid>`;具名 Job + `KILL_ON_JOB_CLOSE`;`killOwnedTree` win32 必带 `jobName`
- [ok] Job 已不存在且 leader 已死:`OpenJobObjectW` missing 视为已收口,不把 recover 打挂
- [ok] `closeNamedJob` 幂等;`execRuntimeChild` 第一次 close 即从 map 删除
- [ok] 审批门:环回临时端口 + HMAC;`gate-cursor.mjs` / `gate-claude.mjs`;未知 `kind` deny
- [ok] verify 隔离 `USERPROFILE`/`HOMEDRIVE`/`HOMEPATH`/`APPDATA`/`LOCALAPPDATA`;执行 argv 加 `--ignore-workspace`,冻结合同仍是 `pnpm run <name>`
- [ok] Windows 通知 P0 诚实返回 false,不把 `Write-Output` 当 toast,好让 ntfy 接手
- [ok] daemon/cli esbuild `external: better-sqlite3,koffi`;CLI 运行时依赖为二者真实版本,`@saydo/platform` 在 devDependencies
- [ok] 官网 FAQ 未改
- [warn] Actions `windows-latest`、Scheduled Task、SAPI 仍是 P1,本批不做
- [warn] `just ci` 的 `ci-node` 不含 `verify:distribution`;本机按 `package.json` `ci:node` 等价集 + 显式 `verify:distribution` 留证

## 5. 评审

Phase 末 code-review subagent:[Review](c550279c-445b-41a1-ae41-6c310a535131)。A 级两条已回修(Job missing=已收口;Job 句柄只 close 一次)。Important:koffi external、通知诚实失败、`dev.mjs` 直 spawn node/corepack、darwin birth 去掉 `pgrep1`/`token1` 写入,均已吸收。
