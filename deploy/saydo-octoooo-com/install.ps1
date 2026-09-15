# SayDo one-command installer bootstrap for Windows (PowerShell 5.1+ / 7).
#   irm https://saydo.octoooo.com/install.ps1 | iex
# This file is pure ASCII without a BOM so that Windows PowerShell 5.1 can run it through `irm | iex`
# (irm keeps a UTF-8 BOM as U+FEFF in the string and iex then fails to parse). It downloads
# install-core.ps1 (UTF-8 with BOM, Chinese messages) to a temp file and runs it with -File, which
# is the only form in which PowerShell 5.1 decodes a UTF-8 script correctly. All SAYDO_INSTALL_*
# environment variables are inherited by the core script. Nothing is installed outside your user
# directory; see install-core.ps1 for details.
$ErrorActionPreference = "Stop"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }
$coreUrl = if ($env:SAYDO_INSTALL_CORE_URL) { $env:SAYDO_INSTALL_CORE_URL } else { "https://saydo.octoooo.com/install-core.ps1" }
$tmpCore = Join-Path ([IO.Path]::GetTempPath()) ("saydo-install-core-" + [Guid]::NewGuid().ToString("N") + ".ps1")
$exitCode = 1
try {
  Invoke-WebRequest -Uri $coreUrl -OutFile $tmpCore -UseBasicParsing -TimeoutSec 60
  $bytes = [IO.File]::ReadAllBytes($tmpCore)
  if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
    throw "install-core.ps1 downloaded from $coreUrl is not UTF-8 with BOM; refusing to run it"
  }
  $shell = Join-Path $PSHOME "powershell.exe"
  if (-not (Test-Path $shell)) { $shell = Join-Path $PSHOME "pwsh.exe" }
  if (-not (Test-Path $shell)) { throw "cannot locate powershell.exe or pwsh.exe under $PSHOME" }
  & $shell -NoProfile -ExecutionPolicy Bypass -File $tmpCore
  $exitCode = $LASTEXITCODE
} finally {
  Remove-Item -Force $tmpCore -ErrorAction SilentlyContinue
}
if ($exitCode -ne 0) { Write-Host "[fail] SayDo install did not complete (exit $exitCode)" -ForegroundColor Red }
