# SayDo 一键安装(Windows PowerShell 5.1+ / PowerShell 7)。
#   irm https://saydo.octoooo.com/install.ps1 | iex
# 只在用户目录内安装,不需要管理员,不改系统 Node:
#   %LOCALAPPDATA%\SayDo\toolchain\   本脚本下载的 Node 22(仅当本机没有 Node 22 时)与 saydo 包
#   %LOCALAPPDATA%\SayDo\bin\saydo.cmd 启动器
# 可选环境变量:
#   SAYDO_INSTALL_NO_MODIFY_PATH=1   不改用户 PATH(默认把 bin 目录加进用户级 PATH,可重复执行)
#   SAYDO_INSTALL_RUN=1              安装完成后直接 `saydo up`
#   SAYDO_INSTALL_ROOT=<dir>         安装根目录(默认 %LOCALAPPDATA%\SayDo;必须在用户目录之下,除非 SAYDO_INSTALL_ALLOW_OUTSIDE_HOME=1)
#   SAYDO_INSTALL_MIRROR=1           直接用官网镜像下载 SayDo 包(默认先 GitHub Release,连不上时自动改用镜像;两者 SHA-256 相同)
#   SAYDO_INSTALL_NPM_REGISTRY=<url> 安装依赖用的 npm registry(默认 registry.npmjs.org;国内可设 https://registry.npmmirror.com)
# 卸载:删除 %LOCALAPPDATA%\SayDo 并从用户 PATH 移除其 bin 目录。
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$SaydoVersion = "0.1.0-rc.12"
$SaydoTgzSha256 = "8e31998c2757b584e2f5fb848eee4e4bce4667c7429dd3e8a84c7df6ffd9eac0"
$SaydoTgzUrl = "https://github.com/Octo-o-o-o/SayDo/releases/download/v$SaydoVersion/saydo-cli-$SaydoVersion.tgz"
$SaydoTgzMirrorUrl = "https://dl.saydo.octoooo.com/releases/v$SaydoVersion/saydo-cli-$SaydoVersion.tgz"
$BetterSqlite3Mirror = "https://npmmirror.com/mirrors/better-sqlite3"
$NodeMajor = 22
$NodeDist = "https://nodejs.org/dist"

function Write-Ok([string]$m) { Write-Host "[ok] $m" }
function Write-Info([string]$m) { Write-Host "[..] $m" }
function Fail([string]$m) { Write-Host "[fail] $m" -ForegroundColor Red; exit 1 }

if (-not $env:LOCALAPPDATA -or -not $env:USERPROFILE) { Fail "缺少 LOCALAPPDATA / USERPROFILE 环境变量,无法确定用户目录" }
$Root = if ($env:SAYDO_INSTALL_ROOT) { $env:SAYDO_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA "SayDo" }
if (-not [IO.Path]::IsPathRooted($Root)) { Fail "SAYDO_INSTALL_ROOT 必须是绝对路径:$Root" }
$Root = [IO.Path]::GetFullPath($Root)
# 只在用户目录内写文件:安装根目录必须位于 %USERPROFILE% 或 %LOCALAPPDATA%(可能被重定向到其他盘)之下;
# GetFullPath 已消解 ".."。确需其他位置须显式 SAYDO_INSTALL_ALLOW_OUTSIDE_HOME=1。
$userBases = @([IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\'), [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\'))
$insideUserDir = $false
foreach ($base in $userBases) {
  if ($Root.Equals($base, [StringComparison]::OrdinalIgnoreCase) -or $Root.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) { $insideUserDir = $true }
}
if (-not $insideUserDir -and $env:SAYDO_INSTALL_ALLOW_OUTSIDE_HOME -ne "1") {
  Fail "SAYDO_INSTALL_ROOT 不在用户目录($($userBases -join ' / '))之下:$Root(本脚本只在用户目录内安装;确需其他位置请设 SAYDO_INSTALL_ALLOW_OUTSIDE_HOME=1)"
}
$Toolchain = Join-Path $Root "toolchain"
$Prefix = Join-Path $Toolchain "prefix"
$BinDir = Join-Path $Root "bin"
New-Item -ItemType Directory -Force -Path $Toolchain, $BinDir | Out-Null

$arch = $env:PROCESSOR_ARCHITECTURE
$nodeArch = switch ($arch) { "AMD64" { "x64" } "ARM64" { "arm64" } default { Fail "不支持的 CPU 架构:$arch" } }

function Get-NodeMajor([string]$exe) {
  # 只解析 `node -v` 的 vNN. 前缀;不把含引号的 JS 表达式交给 PowerShell 5.1 传参(会丢内层引号)。
  try {
    $v = (& $exe -v 2>$null | Select-Object -First 1)
    if ($v -match '^v(\d+)\.') { return [int]$Matches[1] }
    return 0
  } catch { return 0 }
}

# 1. 选 Node:本机已有 Node 22 直接用;否则下载官方 Node 22 zip 到 toolchain(用户目录内)。
$NodeExe = $null
$sysNode = Get-Command node.exe -ErrorAction SilentlyContinue
if ($sysNode -and (Get-NodeMajor $sysNode.Source) -eq $NodeMajor) {
  $NodeExe = $sysNode.Source
  Write-Ok "使用本机 Node $(& $NodeExe -v)($NodeExe)"
} else {
  Get-ChildItem -Path $Toolchain -Directory -Filter "node-v$NodeMajor.*" -ErrorAction SilentlyContinue | ForEach-Object {
    $candidate = Join-Path $_.FullName "node.exe"
    if ((Test-Path $candidate) -and (Get-NodeMajor $candidate) -eq $NodeMajor) { $script:NodeExe = $candidate }
  }
  if (-not $NodeExe) {
    Write-Info "本机没有 Node $NodeMajor,下载官方 Node $NodeMajor 到 $Toolchain(不改系统)"
    $index = Invoke-RestMethod -Uri "$NodeDist/index.json"
    $entry = $index | Where-Object { $_.version -like "v$NodeMajor.*" } | Select-Object -First 1
    if (-not $entry) { Fail "无法从 nodejs.org 解析 Node $NodeMajor 版本" }
    $nodeVer = $entry.version
    $nodePkg = "node-$nodeVer-win-$nodeArch.zip"
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("saydo-node-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    Invoke-WebRequest -Uri "$NodeDist/$nodeVer/$nodePkg" -OutFile (Join-Path $tmp $nodePkg)
    Invoke-WebRequest -Uri "$NodeDist/$nodeVer/SHASUMS256.txt" -OutFile (Join-Path $tmp "SHASUMS256.txt")
    $line = Get-Content (Join-Path $tmp "SHASUMS256.txt") | Where-Object { $_ -match "\s$([regex]::Escape($nodePkg))$" } | Select-Object -First 1
    if (-not $line) { Fail "SHASUMS256.txt 里没有 $nodePkg" }
    $expected = ($line -split "\s+")[0].ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 (Join-Path $tmp $nodePkg)).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { Fail "Node 下载校验失败:$actual != $expected" }
    Expand-Archive -Path (Join-Path $tmp $nodePkg) -DestinationPath $Toolchain -Force
    Remove-Item -Recurse -Force $tmp
    $NodeExe = Join-Path $Toolchain "node-$nodeVer-win-$nodeArch\node.exe"
    if (-not (Test-Path $NodeExe)) { Fail "Node 解压后未找到 $NodeExe" }
  }
  Write-Ok "使用 toolchain Node $(& $NodeExe -v)($NodeExe)"
}
$NodeDir = Split-Path -Parent $NodeExe
$NpmCli = Join-Path $NodeDir "node_modules\npm\bin\npm-cli.js"
if (-not (Test-Path $NpmCli)) { Fail "找不到与 Node 配套的 npm:$NpmCli" }

# 2. 下载 SayDo CLI 包(固定版本 + SHA-256 校验),装进用户目录内的独立 prefix。
$tgz = Join-Path $Toolchain "saydo-cli-$SaydoVersion.tgz"
$needDownload = $true
if (Test-Path $tgz) {
  if ((Get-FileHash -Algorithm SHA256 $tgz).Hash.ToLowerInvariant() -eq $SaydoTgzSha256) { $needDownload = $false }
}
$usedMirror = $false
if ($needDownload) {
  if (Test-Path "$tgz.part") { Remove-Item -Force "$tgz.part" }
  $fromGithub = $false
  if ($env:SAYDO_INSTALL_MIRROR -ne "1") {
    try {
      Invoke-WebRequest -Uri $SaydoTgzUrl -OutFile "$tgz.part" -TimeoutSec 30 -UseBasicParsing
      $fromGithub = $true
      Write-Info "已从 GitHub Release 下载 SayDo CLI $SaydoVersion"
    } catch {
      Write-Info "GitHub Release 不可达($($_.Exception.Message)),改用官网镜像"
    }
  }
  if (-not $fromGithub) {
    if (Test-Path "$tgz.part") { Remove-Item -Force "$tgz.part" }
    Invoke-WebRequest -Uri $SaydoTgzMirrorUrl -OutFile "$tgz.part" -TimeoutSec 60 -UseBasicParsing
    $usedMirror = $true
    Write-Info "已从官网镜像下载 SayDo CLI $SaydoVersion"
  }
  Move-Item -Force "$tgz.part" $tgz
}
$actualTgz = (Get-FileHash -Algorithm SHA256 $tgz).Hash.ToLowerInvariant()
if ($actualTgz -ne $SaydoTgzSha256) { Fail "SayDo 包校验失败:$actualTgz != $SaydoTgzSha256" }
Write-Ok "SayDo CLI $SaydoVersion 包校验通过"
Write-Info "安装到 $Prefix(npm install --global --prefix,不需要管理员)"
$env:Path = "$NodeDir;$env:Path"
# 依赖里的 better-sqlite3 预构建二进制默认从 GitHub 下载;GitHub 不可达(已回退镜像)时改用 npmmirror 的同名镜像。
if ($usedMirror -and -not $env:npm_config_better_sqlite3_binary_host_mirror) { $env:npm_config_better_sqlite3_binary_host_mirror = $BetterSqlite3Mirror }
if ($env:SAYDO_INSTALL_NPM_REGISTRY) { $env:npm_config_registry = $env:SAYDO_INSTALL_NPM_REGISTRY }
& $NodeExe $NpmCli install --global --prefix $Prefix --no-fund --no-audit --loglevel=error $tgz
if ($LASTEXITCODE -ne 0) { Fail "npm install 失败(exit $LASTEXITCODE)" }
$CliMjs = Join-Path $Prefix "node_modules\@saydo\cli\dist\cli.mjs"
if (-not (Test-Path $CliMjs)) { Fail "安装后未找到 $CliMjs" }

# 3. 启动器:固定用上面选定的 Node,不依赖当时 PATH 上是哪个 node。
#    批处理文件按控制台代码页解析(936 / 65001 不同机器不同),所以启动器不写任何字面路径:
#    像 npm 的 .cmd shim 一样,安装根目录下的一切都用 %~dp0(启动器自身目录)相对引用,文件保持纯 ASCII;
#    只有 Node 在根目录之外(如 C:\Program Files\nodejs)时才写它的字面路径,且含非 ASCII 时按系统 ANSI 代码页写入。
function ConvertTo-LauncherPath([string]$p) {
  $rootPrefix = $Root.TrimEnd('\') + '\'
  if ($p.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { return '%~dp0..\' + $p.Substring($rootPrefix.Length) }
  return $p
}
$launcher = Join-Path $BinDir "saydo.cmd"
$launcherNodeDir = ConvertTo-LauncherPath $NodeDir
$launcherCli = ConvertTo-LauncherPath $CliMjs
$launcherText = "@echo off`r`nrem SayDo launcher (generated by install.ps1; re-run install.ps1 to rebuild)`r`nset `"SAYDO_NODE_DIR=$launcherNodeDir`"`r`nset `"PATH=%SAYDO_NODE_DIR%;%PATH%`"`r`n`"%SAYDO_NODE_DIR%\node.exe`" `"$launcherCli`" %*`r`n"
$launcherEncoding = if ($launcherText -match '[^\x00-\x7F]') { [Text.Encoding]::Default } else { [Text.Encoding]::ASCII }
[IO.File]::WriteAllText($launcher, $launcherText, $launcherEncoding)
Write-Ok "已安装:$launcher"

# 4. PATH:默认加进用户级 PATH(可重复执行);SAYDO_INSTALL_NO_MODIFY_PATH=1 跳过。
if ($env:SAYDO_INSTALL_NO_MODIFY_PATH -ne "1") {
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($userPath) { $parts = $userPath -split ";" | Where-Object { $_ -ne "" } }
  if ($parts -notcontains $BinDir) {
    [Environment]::SetEnvironmentVariable("Path", (@($BinDir) + $parts) -join ";", "User")
    Write-Ok "已把 $BinDir 加入用户 PATH(新开的终端生效)"
  }
  if (($env:Path -split ";") -notcontains $BinDir) { $env:Path = "$BinDir;$env:Path" }
}

Write-Host ""
Write-Ok "安装完成。启动:"
Write-Host "    saydo up        (浏览器会打开 http://localhost:47100;远程终端加 --no-open;Ctrl+C 优雅停止)"
Write-Host "  本终端若还找不到 saydo,直接运行:$launcher up"
Write-Host "  该包只含 daemon 与 Web 控制台;语音 pipeline 与系统常驻不在其中;Windows 当前以前台方式运行。"
if ($env:SAYDO_INSTALL_RUN -eq "1") {
  & $launcher up
}
