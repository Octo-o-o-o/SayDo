# ADR-004 · 桌面 OS 矩阵:Windows 一等公民对齐

- **状态**:已决策(owner 2026-08-21 授权完整对齐;经一致性/实现可行性两路 subagent + Codex 88 回修后升"已批准")
- **决策范围**:桌面执行面允许哪些 OS、跨 OS 不变量、能力矩阵与诚实对外口径。
  **不含**产品载体(独立 vs 千手,仍归预留的设计 ADR-003)。
  **不含**具体 IPC/进程/ACL API(见工程 [ADR-003](../ADR-003-os-adapters.md))。
- **背景**:公开仓与官网口径为"仅 macOS 可用;Windows / Linux 暂不支持、无时间表"。
  实现与 canonical 把 POSIX 机制(launchd、unix-socket + `gate.sh`、`uid`、
  `curl --unix-socket`、`osascript`、`say`、`/bin/ps` birth identity)写成合同。
  owner 在 Windows 开发机要求完整对齐,不是 WSL 宿主,也不是"先降级对话面"。

## 1. 候选与裁决

| 路线 | 内容 | 否决/采纳理由 |
|---|---|---|
| A. WSL2 作运行时宿主 | 产品在 WSL 内跑 POSIX 栈,Windows 只开浏览器 | **否决作产品 SKU**。路径身份、workspace 政策、WebAuthn rpId、cursor-agent 安装面都会变成双 OS;对外仍不能称 Windows。允许用户私自这么跑,不做支持面、不做 CI 矩阵、不写进 02 §7 |
| B. 原生 Windows 对话面 + 关闭 Tier1/常驻 | 只修 daemon 起得来,派发与审批门标 unsupported | **否决作终局**。与"完整对齐"和 T1 执行面定义冲突;可作为实施**内部里程碑**,不得对外称为 Windows 支持 |
| C. 原生 Windows 一等公民(本 ADR) | 不变量跨 OS;机制走 adapter;能力矩阵诚实分期 | **采纳** |

**Linux**:本批不升正式 SKU。POSIX 路径本就可跑(无 launchd)。将来若升 SKU,复用本 ADR 的不变量 + systemd user unit,另开设计增量。

> **owner 解除(2026-08-22)**:原文「不为 Linux 单开 CI 或官网承诺」中的**官网承诺**部分由 owner 明确解除——
> 官网可写「Windows / Linux 桌面服务已开放」,但必须同句写明「常驻安装、系统通知等链路当前为 macOS 实现」。
> **未解除的部分**:Linux 仍**不是正式 SKU**;`docs/plan/LINUX-ALIGNMENT.md` §3 的「不得以 `ubuntu-latest` 绿判定
> Linux 可用、依赖面须在最小镜像验证」仍是**升 SKU 的前置**,不因官网口径放开而关闭。
> 证据不对称如实记:Windows = 真机全量门禁(10.0.26200,daemon 1643 passed,evidence `windows-alignment.md`);
> Linux = `ubuntu-latest` node+python 双 job 绿 + `node:22-slim` 的后代回收实测,**尚无最小镜像全量依赖面验证**。
> 出处:评审 90 A-7 提出冲突,owner 2026-08-22 裁决「两个都保留,改 canonical」。

## 2. 决策

1. **Windows 10 22H2+ / Windows 11 x64 是目标正式桌面执行面**(与 macOS 并列)。~~工程对齐进行中,P0 证据收口且 owner 授权前不宣布产品已支持~~ —— **两个条件已于 2026-08-22 达成**:P0 证据收口(Windows 10.0.26200 真机全量门禁,`e2e/evidence/windows-alignment.md`)+ owner 授权;官网口径已翻转,同句须披露常驻安装与系统通知仍为 macOS 实现。
   ARM64 为 best-effort,不单开合同。最低 Node 22、Python 3.12、**本地固定 NTFS**(启动时机械断言,非 ReFS/SMB/subst/可移动盘)。
2. **不变量跨 OS,机制可替换**。09/04/Gate 0 的语义(fail-closed 身份、禁静默信 path 字符串、
   门超时 deny、每命令独立审批、S3 仅本机强认证、状态根不可为可漂移链接)不得因换 OS 放宽。
   POSIX 专有机制(unix-socket、`uid`、`chmod 0600`、launchd、`osascript`)降级为
   **某 OS 上的实现**,不再冒充唯一合同。
3. **能力矩阵(见 §4)是诚实口径**:未列 P0 的能力不得在 Windows 上假装已有。
   macOS 既有**安全**行为零放宽;实例锁去掉 `alive1`/`pgrep` birth 是 hardening,
   无进程起始时刻则拒起(可用性变化,见工程 ADR-003)。
4. ~~**官网 FAQ 在本批收口且 owner 授权前保持"暂不支持"**~~ **条件已达成(2026-08-22)**:本批已收口(真机全量门禁 `e2e/evidence/windows-alignment.md` + Linux Actions 双 job 绿),owner 已在本轮授权并翻转中英八页与 FAQ;翻转后口径必须同时写明「常驻安装、系统通知等链路当前为 macOS 实现」,不得只说"已支持"。
   内部 canonical 写"目标正式执行面,工程对齐进行中,狗粮面 = 本机 daemon/console/pipeline/Tier1"。
   禁止用官网旧句阻挡本仓合同回写。
5. **WSL 不是支持面,也不是测试替身**。P0 验收 = owner 机原生 Windows 上 `just ci`/`pnpm ci:node`;
   GitHub Actions `windows-latest` 为 P1,不挡本批工程收口。

## 3. 跨 OS 不变量(合同层;形状冲突以 09 为准)

| 不变量 | 跨 OS 语义 | macOS / POSIX 实现 | Windows 实现 |
|---|---|---|---|
| 状态根 | 绝对路径、实体目录、不可为可漂移链接、owner 匹配、realpath 等于词法位置 | 非 symlink + `uid` + `realpath` | 非 reparse(含 junction/symlink) + 当前用户 SID 为 Owner + `GetFinalPathNameByHandle`/`realpathSync` |
| workspace 身份 | canonical path + filesystem identity 元组,漂移 fail-closed | `(dev,ino)` | 同列存 **volume serial + file index**(Node `stat.dev`/`stat.ino` 在 NTFS 已是此映射;合同改称 `fsId`,列名保持 `workspace_dev`/`workspace_ino`) |
| 路径词法 | 当前用户轮恰好一个绝对路径字面量 | `/` 或 `~/` | 另接受 `X:\` / `X:/`(盘符 + 斜杠任一);quoted span 同;拒 `file://`、`~user/`、`\\?\`、UNC `\\server\share` |
| owner-only 机密 | `.cap-token`、锁文件、sessions 对非特权用户不可读 | mode `0600`/`0700` | 去继承 ACL,仅 Owner:(R,W)(目录再加 D);Administrators ≡ Unix root,诚实声明 |
| 单 HOME 单实例 | birth identity 锁,PID 复用不得误杀/误夺 | 进程起始时刻(darwin:`ps -o lstart=` 或等价;失败=`null`,禁止 `pgrep`/`alive1`) + `linkSync` | `GetProcessTimes` 100ns FILETIME + pid;失败=`null`。NTFS hardlink |
| 子进程回收 | 只杀能证明属于本 HOME 的树 | POSIX process group + `kill(-pid)` | 具名 Job Object + `KILL_ON_JOB_CLOSE` + `killOwnedTree({pid, expectedBirth, jobName})`;koffi 失败拒起执行器。禁止无身份 `taskkill /T` |
| 审批门律①–④ | deny 可靠、JSON 解析器、同步阻塞超时 deny、每命令独立 | `gate.sh` + jq + `curl --unix-socket` | 协议不变(HTTP POST `/gate` JSON)。传输 = **本机环回临时端口**(非 G1 47100)+ HMAC(`gate-secret`)+ owner-only 秘密文件。钩子 = `gate-cursor.mjs` / `gate-claude.mjs`。Node 默认 Named Pipe DACL 与 win32 AF_UNIX 文件均不作生产门。律② = JSON 解析器 |
| S3 | WebAuthn platform authenticator, UV=1, 仅 `via=local` | Touch ID / 密码 | Windows Hello(生物或 PIN);文案去 Apple 专有口吻 |
| 语音采集 | 浏览器 `getUserMedia` | 同 | 同(不把 WASAPI 采集塞进 pipeline) |
| TTS 主路径 | 云端火山;本地兜底"回叫永远发得出声" | Kokoro MLX → piper → `say` | 云端主路径不变;本地兜底 = SAPI(PowerShell `System.Speech`)或 piper win;无 MLX |
| 桌面通知 L1 | 失败降 ntfy,不阻断 | `osascript` | 失败同样降 ntfy;实现 = PowerShell toast 或 WinRT,见工程 ADR-003 |
| 常驻 | 崩溃自启 + 登录自起 | launchd | P0 = CLI supervisor(`saydo up`);P1 = 当前用户 Scheduled Task / 服务。不模拟 launchd plist |

**明确不移植**:CallKit/PushKit、VoiceProcessingIO、Seatbelt/`sandbox-exec`、Keychain 字面 API、菜单栏 Swift 壳、MLX。Windows 上对应能力要么不存在并保持"策略级 + 诚实声明",要么用 DPAPI / Windows Hello / ntfy 已有降级链。

## 4. 能力矩阵(狗粮定义)

**Windows P0(本实施计划必须兑现,缺一不得称工程对齐收口)**:

- `just ci` / `just dev` 在原生 PowerShell 下可跑(门禁脚本无 bash 硬依赖,或 just 调 pwsh 等价物;单一 Node 实现优先)。
- daemon + console + pipeline 三进程;浏览器语音 + 云 ASR/TTS。
- `SAYDO_HOME` 缺省 `%USERPROFILE%\.saydo`(与 `os.homedir()` 一致)。
- 实例锁、进程树回收、emergency reaper 闭环(今日 win32 直接 throw 必须消灭)。
- workspace 登记/重校验/路径词法(含 `C:\` 口语)。
- cap-token / 锁文件 owner-only ACL。
- Tier1 审批门(Windows 环回+HMAC + `gate-cursor.mjs`/`gate-claude.mjs`)与 cursor-agent.exe 命令钩子可走通 fail-closed 四律;Claude PreToolUse 物理链在本 ADR 批次冻结(未知 `kind` deny,当时不提前拼接尚未收口的 W5.4-b 协议)。W5.4-b 后续已于 2026-08-23 收口 C1/C2/C3,真 Claude hook 全链验证仍归 W5.4-c。
- 深链打开复用已有 `packages/cli/src/open.ts` win32 分支;编辑器探测读 `%LOCALAPPDATA%`。
- S3 卡走 Windows Hello;无 Hello 时既有 requestManualMerge 降级。
- 单测:非 darwin 专有用例在 win32 绿;darwin 专有 skip 并在测试名标明。

**Windows P1(设计已定,本批可排但不阻塞 P0 收口)**:

- 登录常驻(Scheduled Task)。
- `SetThreadExecutionState` 防睡眠(对位 `caffeinate`)。
- SAPI/piper 本地 TTS 兜底。
- GitHub Actions `windows-latest` 矩阵(better-sqlite3 预编译必须先绿)。
- 官网 FAQ 翻转(另需 owner 授权)。

**Windows 明确不做(本 ADR 生命期内)**:

- Electron/Tauri 壳。
- WSL 作为官方安装通道。
- UNC/网络盘作 workspace。
- 把 AF_UNIX 文件或 Node 默认 DACL Named Pipe 当 Windows 生产门。
- 无身份 `taskkill /T` 当 `killTree`。
- `pgrep` / `alive1:pid` 当 birth。

## 5. 排产关系

- 插入 PLAN-2 为 **W-Win**(与 W5.4-b 并行轨道,由本 owner 指令当场开工)。
- 不吞并设计 ADR-003。
- 不修改 T19 × tailnet、备份恢复、升常驻(macOS launchd)前置。
- macOS launchd / unix-socket / `gate.sh` **保持生产路径**,Windows adapter 是加面不是换面。

## 6. 回写清单

| 文件 | 回写要点 |
|---|---|
| `docs/02` §7 | T2 执行面改为"家里/公司的桌面(macOS / Windows / Linux)"。~~补"工程对齐进行中,未对外宣布支持"~~ **2026-08-22 作废**:owner 已解除官网承诺限制,该行改为"三端桌面服务已开放 + 同句披露常驻安装与系统通知仍为 macOS 实现" |
| `docs/03` 文首 + §7 | 增加桌面 OS 矩阵指针;Keychain → OS 机密存储(Keychain / DPAPI) |
| `docs/04` §4 实现注记 | 桌面通知 = OS provider,macOS=`osascript`,Windows=toast,失败降 ntfy |
| `docs/07` 原则 2、D5、D11、D17 | macOS 优先 → 桌面 OS 矩阵;补 Windows 行 |
| `docs/09` §1 路径词法/身份、§11 审批门、机密文件 mode | 见上表;律②改 JSON 解析器 |
| `docs/11` §5.4/§5.5 | "用本机认证批准"(Touch ID / Windows Hello);iCloud 注脚改为平台同步凭据条款 |
| `docs/adr/README.md` | 登记本 ADR + 工程 ADR-003 |
| `docs/plan/IMPLEMENTATION-PLAN-2.md` | 增 W-Win 行 |
| 官网 FAQ | **本批不动**;收口后另授权 |

## 7. 后果

- **正**:owner Windows 开发机可按与 macOS 相同的 Gate 0 / 审批 / 身份纪律狗粮;合同不再把 POSIX 当宇宙。
- **负**:审批门与进程回收要在 Windows 上重测 fail-closed;NTFS junction 与 PID 复用是新攻击面,必须用 §3 表挡住。
- **非后果**:不降低 macOS 门完整性。
  > 原文「不宣布产品已支持 Windows」由 owner 于 2026-08-22 解除(评审 90 A-7):Windows 已有真机全量门禁,
  > 官网可写「已开放 / 现在可用」,但必须同句披露常驻安装与系统通知仍为 macOS 实现。
  > 与 §约束 4 的达成条件同源,两处口径一致。
