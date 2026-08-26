param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$RequestBase64Url
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

try {
  if ($RequestBase64Url -notmatch "^[A-Za-z0-9_-]+$") {
    throw "request encoding is not base64url"
  }
  $encoded = $RequestBase64Url.Replace("-", "+").Replace("_", "/")
  switch ($encoded.Length % 4) {
    0 { }
    2 { $encoded += "==" }
    3 { $encoded += "=" }
    default { throw "request encoding length is invalid" }
  }
  $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
  $request = $json | ConvertFrom-Json
  $expectedProperties = @(
    "challenge",
    "installMode",
    "nodePath",
    "packageUrl",
    "schemaVersion",
    "tag",
    "verifierPath"
  ) | Sort-Object
  $actualProperties = @($request.PSObject.Properties.Name | Sort-Object)
  if (Compare-Object -ReferenceObject $expectedProperties -DifferenceObject $actualProperties) {
    throw "request property set is invalid"
  }
  if ($request.schemaVersion -ne 1 -or $request.tag -ne "v0.1.0-rc.8") {
    throw "request release identity is invalid"
  }
  $expectedUrl = "https://github.com/Octo-o-o-o/SayDo/releases/download/$($request.tag)/saydo-cli-$($request.tag.Substring(1)).tgz"
  if ($request.packageUrl -cne $expectedUrl) {
    throw "request package URL is invalid"
  }
  if ($request.installMode -notin @("exec", "global")) {
    throw "request install mode is invalid"
  }
  if ($request.challenge -notmatch "^[0-9a-f]{64}$") {
    throw "request challenge is invalid"
  }
  if ($request.verifierPath -cne "scripts/verify-release-url.mjs") {
    throw "request verifier path is invalid"
  }
  if ($request.verifierPath -match "(\.\.|//|\\\\|[\x00-\x1f])" -or $request.verifierPath.StartsWith("/") -or $request.verifierPath -match "^[A-Za-z]:") {
    throw "request verifier path is invalid"
  }
  if ($request.nodePath -notmatch "^[A-Za-z]:[\\/].+\.exe$" -or $request.nodePath -match "[\x00-\x1f]") {
    throw "request node path is invalid"
  }
  if (-not (Test-Path -LiteralPath $request.nodePath -PathType Leaf)) {
    throw "node executable does not exist"
  }
  if (-not (Test-Path -LiteralPath $request.verifierPath -PathType Leaf)) {
    throw "verifier script does not exist"
  }

  Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
  Remove-Item Env:NODE_PATH -ErrorAction SilentlyContinue
  & $request.nodePath $request.verifierPath $request.packageUrl $request.installMode "--challenge" $request.challenge
  exit $LASTEXITCODE
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
