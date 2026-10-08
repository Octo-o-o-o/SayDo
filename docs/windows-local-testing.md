# 这台 Windows 机器的本地测试启动说明

记录日期：2026-10-08。仓库位置：`C:\WorkSpace\Saydo`。以下为本机开发测试操作记录，不改变产品合同。

代码提交：`a9eb283ccba42238964e7190ad7b1b94632ae748`。本轮使用独立状态目录 `.tmp/local-runtime`，不要误用日常账户的默认 `.saydo` 状态。

## 当前结论与限制

- 依赖已按锁文件安装；本机验证版本为 Node 22.23.2、pnpm 10.33.1、uv 0.12.23、Python 3.14.8。
- OpenRouter 的 `qwen/qwen3-32b` 承担 dialog/thinking/cheap；DeepSeek `deepseek-flash` 承担 evaluator，四槽真实请求均通过。DeepSeek 官方端点仅对象根 schema 切换为 JSON 模式，消费端仍严格校验；数组根不在此次适配范围内。
- 火山 ASR、TTS 及合成语音经过生产 WS 的对话链路通过；不代表物理麦克风、扬声器听感和浏览器交互通过。本轮浏览器控制器及 Windows Computer Use native pipe 不可用。
- Cursor Agent `2026.10.01-e373342` 已登录，当前默认模型为 `auto`；原生入口与真实对话可用。三次拒绝探测中 `beforeShellExecution` 没有向门服务发请求，测试用 echo 命令仍执行。直接调用同一 SayDo 门脚本则收到 deny。根因未定，不能据启动自检声称审批链通过。
- 当前生效配置已恢复为未配置 Tier1，执行器不认领任务。候选配置仅保存在 `.tmp/live-check/cursor-proposed-config.toml`；拒绝钩子未验通前不要恢复该配置、关闭 Gate 0 或绕过审批。
- Grok、Devin、Kimi 的独立对话调用通过，但未接入 SayDo 的代码执行后端。PATH 中的 `agent.exe` 属于 Grok，不是 Cursor。
- Qwen 曾返回 HTTP 429，重试后成功；当前降级文案可能误导为配置错误。原 OpenRouter `openai/gpt-5` 评估槽返回 403，现已替换。

## 凭据与状态

生效文件是 `.tmp/local-runtime/config.toml`、`.tmp/local-runtime/.env`。原始私有参考位于本机 Downloads 下的 `SayDo-Windows-test-config-20261008.md`。只在本机检查，不将密钥、capability token、原始配置附件或带 token 的浏览器地址写入 Git、日志或聊天。

`.env` 使用 UTF-8 无 BOM；API key 通过环境变量引用。保留 `[gate0] enabled=true`、`bypass=false`，以及 `store_audio=false`。本轮未落盘保存测试音频；合成音频在内存中转码。默认 DND 窗口为 23:00–08:00，深夜测试通知行为时需考虑该配置。ntfy/邮件通知未配置，不能据此验收外部推送。

`.tmp` 及虚拟环境均为本地忽略文件。重新 clone 后不会自动带入凭据或安装工具；缺配置时先向 owner 确认，不猜测服务商、密钥或模型。

## 每个测试终端先设置环境

使用普通 PowerShell；这些步骤不需要管理员权限。PowerShell profile 可能自动切到 Node 26，建议新开 `pwsh -NoProfile`，再执行：

```powershell
$repo = 'C:\WorkSpace\Saydo'
Set-Location -LiteralPath $repo
$nodeDir = Join-Path $env:APPDATA 'fnm\node-versions\v22.23.2\installation'
$pnpmDir = Join-Path $repo '.tmp\local-tools\node_modules\@pnpm\exe'
if (!(Test-Path -LiteralPath (Join-Path $nodeDir 'node.exe'))) { throw '缺少本轮验证的 Node 22' }
if (!(Test-Path -LiteralPath (Join-Path $pnpmDir 'pnpm.exe'))) { throw '本地 pnpm 未安装，请先核对工具配置' }
$env:Path = "$nodeDir;$pnpmDir;$env:Path"
$env:SAYDO_HOME = Join-Path $repo '.tmp\local-runtime'
node --version
pnpm --version
uv --version
```

避免让不同 Node 主版本混用已有的 better-sqlite3 原生依赖。需要重装时按锁文件操作：

```powershell
pnpm install --frozen-lockfile
uv --directory pipeline sync --locked
pnpm --filter @saydo/console build
```

最后一条构建控制台，daemon 会同源提供 `packages/console/dist`，本轮不需要另外启动 Vite。仅后续修改 UI 并需要热更新时才单独使用 Vite，并另外核验端口与鉴权接线。

## 启动与检查

先检查端口占用，不要直接杀掉监听进程：

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in @(47100, 5173, 5174) } |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

终端 A 设置上述环境后，前台启动 daemon：

```powershell
Set-Location -LiteralPath (Join-Path $repo 'packages\daemon')
node --import tsx src/index.ts
```

终端 B 同样设置环境，在仓库根前台启动语音管线：

```powershell
uv --directory pipeline run python -m saydo_pipeline
```

终端 C 检查健康状态并打开页面：

```powershell
Invoke-RestMethod 'http://127.0.0.1:47100/health'
$accessToken = (Get-Content -LiteralPath (Join-Path $env:SAYDO_HOME '.cap-token') -Raw).Trim()
Start-Process ('http://localhost:47100/?token=' + [Uri]::EscapeDataString($accessToken))
Remove-Variable accessToken
```

页面使用 `localhost` 同源地址，保留鉴权。健康接口 200 只表示 daemon 存活，还需观察 pipeline 重连日志，并在界面做模型/语音自检。真人测试需在浏览器允许麦克风，分别检查采集、识别文本、模型回答与实际播放；收到 TTS 二进制不能代替听感验收。

后台自动化启动必须用 `Start-Process -WindowStyle Hidden`，stdout/stderr 分开重定向，并记录 PID、创建时间、可执行路径和启动参数。不要只存一个可被系统复用的 PID。本次没有新增系统服务、开机启动项或管理员任务。

## 停止本轮服务

优先在终端 B、A 依次按 Ctrl+C。后台实例先根据记录核实进程身份和父子关系，再对本轮进程逐个停止；Python 管线可能同时出现 uv、虚拟环境启动器和实际 Python 子进程。不要执行全局 `taskkill /IM node.exe` 或杀掉所有 Python。

核查命令：

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -in @('node.exe', 'python.exe', 'uv.exe') } |
  Select-Object ProcessId, ParentProcessId, CreationDate, ExecutablePath, CommandLine
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in @(47100, 5173, 5174) } |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

确认身份后才使用 `Stop-Process -Id <本轮PID>`；随后重新检查进程与端口。不要删除 SQLite、审计、配置或凭据。中断测试若留下 runtime owner 记录，应走项目的身份核验恢复路径，不直接删记录掩盖未回收状态。

## 验证记录

输入未变的既有验证证据沿用，未冒充重新跑全套：typecheck、lint、DeepSeek 相关 102 项、contracts 158 项、Cursor 原生入口与 ownership 18 项通过；emoji、公开隐私扫描与 diff 检查通过。两项修复均经过两位独立 reviewer 的设计与实现评审。

Cursor 配置测试 24 通过、1 失败、2 跳过，失败为 Windows 下既有 Claude 可执行权限断言；未改主仓复跑相同失败。runtime-child-registry 84 通过、19 失败，失败名称集合与最初基线完全相同，并有测试根未回收的 teardown 错误。初始全量测试还存在 CLI、daemon、platform、Python 失败。没有声称全仓 CI 通过，远端 CI 未运行，代码派发/验收未通过。

本地详细证据：`.tmp/live-check/result.json`；初始基线：`.tmp/local-validation/result.json`。这些 JSON 与原始日志不随 Git 分发。评审候选 SHA-256：

- DeepSeek：`14fe2d9d6f9ddb3622e6b0a84c0ba747869a0ccaf87cdf7257473dec721af727`。
- 含 Cursor 适配的最终候选：`bc2eeccbb6ac777511f5942a0378bf1241c0650cbc3d3653ead02ebfb3e3a0a3`。

Git Bash 请使用本机实际安装位置，避免 PATH 中的 WindowsApps `bash.exe` 落到 WSL 后找不到 Node：

```powershell
& (Join-Path $env:LOCALAPPDATA 'Programs\Git\bin\bash.exe') scripts/check-emoji.sh
node scripts/check-public-tree-privacy.mjs --fs
git diff --check
```

### 日志证据索引

以下为 `.tmp/live-check/` 内的冻结快照；日志不入 Git。

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| fix-typecheck-snapshot.log | 510 | `5208cfbf1901678c12e6c4db6ef3e34b47a2b25bce392e2506438fca28632fac` |
| fix-lint-snapshot.log | 102 | `e6bf518f12d9d933203060eab3523a0c8980bd6aca710012affa9b53f7fe2ca5` |
| fix-tests-snapshot.log | 3254 | `d8121fd720e2b03a492d8c7a5753824dfb18be8810f087d6374456f1312afdc3` |
| fix-contracts-snapshot.log | 1072 | `49723f0453cbc66cda565d5ebad0677316bd98f99b2da04e5b6aff1764f31f31` |
| cursor-typecheck-snapshot.log | 510 | `efb5902fa36f9f98a3d3ec0c290025f2177a1a591b24ba0990d3081a6ecd534e` |
| cursor-lint-snapshot.log | 102 | `e6bf518f12d9d933203060eab3523a0c8980bd6aca710012affa9b53f7fe2ca5` |
| cursor-native-tests-snapshot.log | 599 | `4bfc452d51f6019ece16922e6cabeaaaab09bf340948eb32b1e29abd767f8a16` |
| cursor-tests-snapshot.log | 6333 | `7319576bf136165d83344ac45748e66bd3e24ca4d26e921c60256576388ef018` |
| cursor-baseline-config-tests-snapshot.log | 5999 | `d0d7e82d40fc052c0cebf6a5a1304a22c6a386bb8673fe2c5bac780906c2c51e` |
| cursor-runtime-regression-snapshot.log | 24846 | `db583d1bbef70ac807c0bd7bd3f1fd6fca19ff09464bc06a1580517a51014be1` |
