[CmdletBinding()]
param([switch]$Force)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$lock = (Get-Content -LiteralPath (Join-Path $root "dependencies.lock.json") -Raw | ConvertFrom-Json).ue4ssPalworld
$cache = Join-Path $root ".supply-chain-cache"
$runtime = Join-Path $root "live-bridge\runtime"
$dwmapi = Join-Path $runtime "dwmapi.dll"
$ue4ss = Join-Path $runtime "ue4ss\UE4SS.dll"
$manifestPath = Join-Path $root "live-bridge\runtime-manifest.json"

function Assert-Sha256([string]$Path, [string]$Expected) {
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $Expected.ToLowerInvariant()) {
    throw "SHA-256 mismatch for $Path. Expected $Expected, received $actual."
  }
}

New-Item -ItemType Directory -Force $cache, (Split-Path -Parent $ue4ss) | Out-Null
$needsFiles = $Force -or !(Test-Path -LiteralPath $dwmapi) -or !(Test-Path -LiteralPath $ue4ss)
if ($needsFiles) {
  $archive = Join-Path $cache "UE4SS-Palworld.zip"
  if (!(Test-Path -LiteralPath $archive)) {
    Write-Host "Downloading checksum-pinned Palworld UE4SS release..."
    Invoke-WebRequest -UseBasicParsing -Uri $lock.assetUrl -OutFile $archive
  }
  Assert-Sha256 $archive $lock.assetSha256
  $staging = Join-Path $cache "ue4ss-staging"
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
  Expand-Archive -LiteralPath $archive -DestinationPath $staging -Force
  Copy-Item -LiteralPath (Join-Path $staging "dwmapi.dll") -Destination $dwmapi -Force
  Copy-Item -LiteralPath (Join-Path $staging "ue4ss\UE4SS.dll") -Destination $ue4ss -Force
}

Assert-Sha256 $dwmapi $lock.dwmapiSha256
Assert-Sha256 $ue4ss $lock.ue4ssSha256
$manifest = [ordered]@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  source = [ordered]@{ repository = $lock.repository; releaseTag = $lock.releaseTag; assetUrl = $lock.assetUrl; assetSha256 = $lock.assetSha256 }
  files = @(
    [ordered]@{ path = "live-bridge/runtime/dwmapi.dll"; sha256 = $lock.dwmapiSha256 },
    [ordered]@{ path = "live-bridge/runtime/ue4ss/UE4SS.dll"; sha256 = $lock.ue4ssSha256 }
  )
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Live bridge runtime reconstructed and recorded in live-bridge/runtime-manifest.json."
