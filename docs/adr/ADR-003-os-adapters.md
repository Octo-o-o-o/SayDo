# ADR-003 · OS 适配层(进程、IPC、ACL、常驻、通知)

- **状态**:已决策(配套设计 ADR-004;Codex 88 A 级已吸收)
- **决策范围**:Windows(及未来 Linux)上如何实现设计 ADR-004 的不变量。
  不改 Gate 0 语义。审批 JSON 超集见 §3(现网 `{command,cwd}` 不变)。
- **背景**:今日代码用 `process.platform === "win32"` 短路或 throw
  (`emergencyReaper`、`runtimeChildRegistry`、`kill(-pid)`、`PATH.split(":")`)。
  这不是适配层。

## 1. 包边界

新增 **`packages/platform`(`@saydo/platform`)**。daemon 与 cli 都依赖它,禁止两边再抄一份 `processBirth`。

职责(纯 Node,无业务):

- `hostKind(): "darwin" | "win32" | "linux" | "other"`
- `homeDir()` / `pathDelimiter()` / `expandUserPath()`
- `fsIdentity(path)` → `{ path, dev, ino }`
- `assertRealDirectory(path)`(禁一切 reparse;win32 另断言本地固定 NTFS)
- `assertOwnedByCurrentUser(path)`
- `restrictOwnerOnly(path, kind: "file" | "dir")`(回读精确 DACL,失败 fail-closed)
- `processBirth(pid)` / `processAlive(pid)` / `killOwnedTree(claim)`
- `acquireExclusiveLink(lockPath, payload)`
- `listenGateHttp(saydoHome, handler)` / `gateClientEnv(saydoHome)`
- `openExternal(url)`

pipeline(Python)不引该包。Python 侧用对等函数写在 `pipeline/src/saydo_pipeline/platform.py`:
信号、状态根、owner 校验。语义与 TS 表对齐,禁止第三套口径。

## 2. 进程身份与回收

**birth identity 字符串**必须满足:同一 PID 被 OS 复用后旧串不再匹配。

| OS | 采集 | 禁止 |
|---|---|---|
| darwin | `/bin/ps -o lstart= -p <pid>`(真实起始时刻)。失败 = `null`,实例锁拒起。这是相对今日 `alive1`/`pgrep` 的 hardening,属可用性收紧 | `pgrep`、`alive1:pid` |
| linux | `/proc/<pid>/stat` starttime(clock ticks)+ pid | 同上 |
| win32 | koffi `GetProcessTimes` 的 `FILETIME` 创建戳(100ns)+ pid,格式 `ft:<hi>:<lo>:<pid>` | WMI 秒级 `CreationDate` 不得当唯一串;`alive1` |

**进程树**:

- POSIX:process group + `kill(-pid, SIGKILL)`,且必须 `expectedBirth === processBirth(pid)`。
- Windows:具名 Job `Global\\SayDoJob-<ownerInstanceId>-<runId>`(用户会话内 `Local\\` 即可)。
  `CreateJobObjectW` → `SetInformationJobObject(JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE)` →
  spawn → `AssignProcessToJobObject` **成功后**才写 permit。
  ownership 记录持久化 **job 名** 而非匿名 HANDLE。
  `killOwnedTree({ pid, expectedBirth, jobName })`:birth 不匹配则拒绝;用 `OpenJobObjectW` +
  `TerminateJobObject`。koffi 探测失败 ⇒ 拒起执行器。
  `taskkill /T` 禁止进入 `killOwnedTree`;`scripts/dev.mjs` 只杀本脚本 spawn 的三进程,不得复用该函数。

`spawn` 在 win32 必须入 Job,不得 `if (win32) return []`。

## 3. 审批门 IPC

**协议**(跨 OS 唯一):

```
POST /gate
Content-Type: application/json
{"cwd": string, "command"?: string, "kind"?: "command"|"file_write"|"file_read", ...}
→ {"permission":"allow"|"deny", "agent_message"?: string}
```

现网 Cursor 仍只发 `{command,cwd}`。缺 `command` 且 `kind` 不是已实现分支 ⇒ deny。
超时、非 JSON、非 allow、HMAC 失败 ⇒ deny。决策键仍是 `(runId, seq)`。
本批不实现 W5.4-b 的 file_write 细协议;Windows Claude 钩子把 Bash 映射为 `command`,其余 kind deny。

**传输**:

- POSIX: unix domain socket `$SAYDO_HOME/tier1-gate.sock`(不变)。无 HMAC(不改现网 `gate.sh`)。
- Windows:**重选 IPC**(Node `listen(namedPipe)` 无法设创建期 DACL,默认给 Everyone 开口)。
  绑定 `127.0.0.1:0`,端口写入 `$SAYDO_HOME/tier1/gate-bind.json`(owner-only)。
  另写 `$SAYDO_HOME/tier1/gate-secret`(32 字节,owner-only)。
  请求头 `X-SayDo-Gate: hex(hmac-sha256(secret, body))`。
  禁止复用 G1 `47100`;禁止 win32 文件系统 AF_UNIX;禁止无 HMAC 的默认 DACL pipe。

**钩子供给**:

- POSIX:冻结 `gate.sh` + `gate-claude.sh`。
- Windows:`gate-cursor.mjs` / `gate-claude.mjs`(Node `JSON.parse` + HMAC + 127.0.0.1)。
  `hooks.json` 命令 = 引用过的 `node.exe` 绝对路径 + 脚本绝对路径。
- digest 补偿:每请求重读**当前 backend 实际入口**及 `hooks.json`/`gate-bind.json`;
  任一漂移 ⇒ deny + cancel 全部活跃 run。

**cursor-agent 二进制**:win32 允许 `.exe` 绝对路径;存在、常规文件、非 reparse、版本精确。POSIX 保留 `X_OK`。

## 4. 文件系统与 ACL

- **卷**:win32 状态根与 workspace 必须 `GetDriveType==DRIVE_FIXED` 且
  `GetVolumeInformation` 文件系统名 `NTFS`。ReFS/SMB/subst/可移动盘 fail-closed。
- **reparse**:任何 `FILE_ATTRIBUTE_REPARSE_POINT`(含 junction),不只 `isSymbolicLink()`。
- **identity**:仅在上述卷上使用 `stat.dev`/`stat.ino` 字符串。
- **owner**:Owner SID 必须等于当前用户 SID;Administrators/SYSTEM 持有 ⇒ 状态根不可用。
- **owner-only**:禁用继承并**清空后**只授当前 SID(文件 R,W;目录再加子对象继承)。
  回读 DACL:不得残留 Everyone/Users/Authenticated Users。旧 `.cap-token` 每次启动先收紧再读。
  生产失败 fail-closed;测试必须注入 stub,禁止把生产 icacls 绑在 `test/setup.ts`。
- **runtime 切换**:macOS symlink;Windows junction,失败则复制树 + owner-only 指针文件。

## 5. 路径词法

先整轮拒 `file://`、`\\?\`、UNC、URI scheme(`https://` 等)。
unquoted 盘符开端:`(^|[^A-Za-z0-9])[A-Za-z]:[/\\](?![/\\])`。
quoted span 的闭合内容必须**整段**是路径(以 `/`、`~/` 或盘符绝对路径开头),禁止从引号内切片。
`~/` 展开 `os.homedir()`。identity 比较用 realpath,词法层不做 lowercase。

## 6. 常驻、通知、电源、深链

| 面 | Windows P0 | Windows P1 |
|---|---|---|
| 常驻 | `saydo up` CLI supervisor(已有骨架;修 birth/reaper) | 当前用户 Scheduled Task,WorkingDirectory=runtime 树 |
| 通知 | toast 失败即 false,sweep 降 ntfy(与 macOS osascript 失败同构) | 可换 WinRT |
| 电源 | no-op + 审计(与今日非 darwin 相同) | `SetThreadExecutionState(ES_SYSTEM_REQUIRED)` |
| 深链 | `cmd /c start "" url`(已有) | — |
| 编辑器探测 | `%LOCALAPPDATA%\Programs\cursor\Cursor.exe` 与 `Microsoft VS Code\Code.exe` | — |
| TTS 兜底 | 无本地引擎时 TTS=disabled,回叫走 ntfy(诚实);不得假装 `say` | SAPI |
| 信号 | pipeline 不用 `loop.add_signal_handler`;改 `signal.signal` + `asyncio.Event` | — |
| 优雅停 | 交互 Ctrl+C = SIGINT;外部编排写 `$SAYDO_HOME/runtime/cli-stop-<cliPid>`(单行 reason 白名单) | 同左。禁止把 TerminateProcess/`taskkill` 当 prepareShutdown |
| PATH | `path.delimiter`;`uv.exe` / `uv.cmd` | — |
| agent env | 白名单加 `USERPROFILE` `USERNAME` `TEMP` `TMP` `APPDATA` `LOCALAPPDATA`;verify 隔离 HOME 时对位改隔离 `USERPROFILE` | — |

## 7. 工程入口与 CI

- bash 门禁(`check-emoji.sh` 等)移植为 **Node 单文件**,`just ci-node` 与
  `package.json` `ci:node` 都调 Node;bash 脚本可留作 POSIX 包装。
- `justfile`:`set windows-shell := "pwsh.exe"` 不强制。优先让 recipe 只调 `pnpm`/`node`,
  避免 shebang bash。`just dev` 的三进程:Windows 用 `Start-Process` 或
  一个 Node supervisor 脚本 `scripts/dev.mjs`(推荐,跨 OS 单一入口)。
- CI:P0 不阻塞于 Actions Windows 矩阵(公开仓 billing/pnpm 冲突未清)。
  本地 `just ci` 在 owner Windows 机必须绿。P1 再加 `windows-latest`。

## 8. 测试纪律

- 禁止新测试硬编码 `/Users/`、`/tmp/`、`chmod 0o755` 当唯一断言。
- 用 `os.tmpdir()` / `homedir()` / `restrictOwnerOnly`(测试注入 stub,禁止在 `packages/daemon/test/setup.ts` 对 `%TEMP%` 跑生产 ACL)。
- unix-socket 104 字节限制仅 darwin;`tier1-gate-socket.test.ts` 在 win32 `skipIf`。
- Windows 门测:环回+HMAC + `gate-cursor.mjs`(不得测默认 DACL Named Pipe)。
- `process.kill(-pid)` 测试用平台 `killOwnedTree`。

## 9. 否决

- 复用 G1 `47100` 的审批门,或无 HMAC 的本机 TCP。
- Node 默认 DACL Named Pipe / win32 文件系统 AF_UNIX 当生产门。
- 依赖 Git Bash 才能狗粮。
- `alive1:pid` / `pgrep` 当生产 birth。
- 无身份 `taskkill /T` 当 `killOwnedTree`。
- 为 Windows 引入 Electron。
