[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$lock = Get-Content -LiteralPath (Join-Path $root "dependencies.lock.json") -Raw | ConvertFrom-Json
$manifestPath = Join-Path $root "single-player\runtime-manifest.json"

$trackedNative = & git -C $root ls-files single-player live-bridge 2>$null |
  Where-Object { $_ -match "\.(dll|exe|pyd|so|dylib|zip|cat)$" }
if ($trackedNative) {
  throw "Native files are tracked in source directories:`n$($trackedNative -join "`n")"
}
if (!(Test-Path -LiteralPath $manifestPath)) {
  throw "Missing generated single-player/runtime-manifest.json. Run npm run prepare:single-player first."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.python.archiveSha256 -ne $lock.python.sha256 -or $manifest.pyooz.commit -ne $lock.pyooz.commit -or !$manifest.pyooz.builtFromSource) {
  throw "Runtime provenance does not match dependencies.lock.json."
}
foreach ($entry in $manifest.files) {
  $path = Join-Path $root ($entry.path.Replace("/", "\"))
  if (!(Test-Path -LiteralPath $path)) { throw "Generated dependency is missing: $($entry.path)" }
  $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $entry.sha256) { throw "Generated dependency changed after preparation: $($entry.path)" }
}

$python = Join-Path $root "single-player\runtime\python.exe"
$signature = Get-AuthenticodeSignature -LiteralPath $python
if ($signature.Status -ne "Valid" -or $signature.SignerCertificate.Subject -notmatch "Python Software Foundation") {
  throw "Embedded Python signature verification failed."
}
$vendor = Join-Path $root "single-player\vendor"
& $python -c "import sys; sys.path.insert(0, r'$vendor'); from palworld_save_tools.compressor.oozlib import OozLib; OozLib(); print('Pinned ooz module loaded successfully')"
if ($LASTEXITCODE -ne 0) { throw "The source-built ooz module could not be loaded." }

$bridgeManifestPath = Join-Path $root "live-bridge\runtime-manifest.json"
if (!(Test-Path -LiteralPath $bridgeManifestPath)) { throw "Missing live bridge provenance manifest." }
$bridgeManifest = Get-Content -LiteralPath $bridgeManifestPath -Raw | ConvertFrom-Json
if ($bridgeManifest.source.assetSha256 -ne $lock.ue4ssPalworld.assetSha256) {
  throw "Live bridge provenance does not match dependencies.lock.json."
}
foreach ($entry in $bridgeManifest.files) {
  $path = Join-Path $root ($entry.path.Replace("/", "\"))
  $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $entry.sha256) { throw "Live bridge dependency checksum mismatch: $($entry.path)" }
}

Write-Host "Supply-chain verification passed: no tracked native dependencies, official Python and pinned UE4SS verified, source-built ooz verified."
