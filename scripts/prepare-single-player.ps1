[CmdletBinding()]
param(
  [string]$BuildPython = "python",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = Split-Path -Parent $PSScriptRoot
$lock = Get-Content -LiteralPath (Join-Path $root "dependencies.lock.json") -Raw | ConvertFrom-Json
$runtime = Join-Path $root "single-player\runtime"
$native = Join-Path $root "single-player\vendor\palworld_save_tools\lib\windows\ooz.pyd"
$manifestPath = Join-Path $root "single-player\runtime-manifest.json"
$cache = Join-Path $root ".supply-chain-cache"

function Assert-Sha256([string]$Path, [string]$Expected) {
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $Expected.ToLowerInvariant()) {
    throw "SHA-256 mismatch for $Path. Expected $Expected, received $actual."
  }
}

function Invoke-Checked([string]$Program, [string[]]$Arguments) {
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Program failed with exit code $LASTEXITCODE."
  }
}

New-Item -ItemType Directory -Force $runtime, $cache | Out-Null

$pythonExe = Join-Path $runtime "python.exe"
if ($Force -or !(Test-Path -LiteralPath $pythonExe)) {
  $archive = Join-Path $cache "python-$($lock.python.version)-embeddable-amd64.zip"
  if (!(Test-Path -LiteralPath $archive)) {
    Write-Host "Downloading official Python $($lock.python.version) embedded runtime..."
    Invoke-WebRequest -UseBasicParsing -Uri $lock.python.url -OutFile $archive
  }
  Assert-Sha256 $archive $lock.python.sha256

  $staging = Join-Path $cache "python-staging"
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
  New-Item -ItemType Directory -Force $staging | Out-Null
  Expand-Archive -LiteralPath $archive -DestinationPath $staging -Force
  Get-ChildItem -LiteralPath $staging -File | Copy-Item -Destination $runtime -Force
}

if ((Get-Item -LiteralPath $pythonExe).VersionInfo.FileVersion -notlike "3.12.10*") {
  throw "The reconstructed Python runtime is not version 3.12.10."
}
$pythonSignature = Get-AuthenticodeSignature -LiteralPath $pythonExe
if ($pythonSignature.Status -ne "Valid" -or $pythonSignature.SignerCertificate.Subject -notmatch "Python Software Foundation") {
  throw "python.exe does not have a valid Python Software Foundation signature."
}

$mustBuildNative = $Force -or !(Test-Path -LiteralPath $native)
if (!$mustBuildNative -and !(Test-Path -LiteralPath $manifestPath)) {
  throw "An unverified ooz.pyd is present. Remove it or run this script with -Force to rebuild it from pinned source."
}

if ($mustBuildNative) {
  $source = Join-Path $cache "pyooz-src"
  if (Test-Path -LiteralPath $source) { Remove-Item -LiteralPath $source -Recurse -Force }
  Invoke-Checked "git" @("clone", "--recursive", $lock.pyooz.repository, $source)
  Invoke-Checked "git" @("-C", $source, "checkout", "--detach", $lock.pyooz.commit)
  Invoke-Checked "git" @("-C", $source, "submodule", "update", "--init", "--recursive")

  $sourceCommit = (& git -C $source rev-parse HEAD).Trim()
  $oozSource = Join-Path $source "ooz\dep\ooz"
  $simdeSource = Join-Path $oozSource "simde"
  $oozCommit = (& git -C $oozSource rev-parse HEAD).Trim()
  $simdeCommit = (& git -C $simdeSource rev-parse HEAD).Trim()
  if ($sourceCommit -ne $lock.pyooz.commit -or $oozCommit -ne $lock.pyooz.oozCommit -or $simdeCommit -ne $lock.pyooz.simdeCommit) {
    throw "The checked-out pyooz source or one of its submodules does not match dependencies.lock.json."
  }

  $buildRequirements = Join-Path $cache "build-requirements.txt"
  @(
    "setuptools==$($lock.pythonBuildTools.setuptools) --hash=sha256:$($lock.pythonBuildTools.setuptoolsSha256)",
    "wheel==$($lock.pythonBuildTools.wheel) --hash=sha256:$($lock.pythonBuildTools.wheelSha256)"
  ) | Set-Content -LiteralPath $buildRequirements -Encoding ASCII
  Invoke-Checked $BuildPython @("-m", "pip", "install", "--disable-pip-version-check", "--no-input", "--require-hashes", "-r", $buildRequirements)
  $wheelhouse = Join-Path $cache "wheelhouse"
  if (Test-Path -LiteralPath $wheelhouse) { Remove-Item -LiteralPath $wheelhouse -Recurse -Force }
  New-Item -ItemType Directory -Force $wheelhouse | Out-Null
  Invoke-Checked $BuildPython @("-m", "pip", "wheel", "--no-build-isolation", "--no-deps", "--wheel-dir", $wheelhouse, $source)

  $wheel = Get-ChildItem -LiteralPath $wheelhouse -Filter "pyooz-*.whl" | Select-Object -First 1
  if (!$wheel) { throw "The pinned pyooz build did not produce a wheel." }
  $wheelZip = Join-Path $wheelhouse "pyooz.zip"
  Copy-Item -LiteralPath $wheel.FullName -Destination $wheelZip -Force
  $expanded = Join-Path $wheelhouse "expanded"
  Expand-Archive -LiteralPath $wheelZip -DestinationPath $expanded -Force
  $builtNative = Get-ChildItem -LiteralPath $expanded -Recurse -Filter "ooz*.pyd" | Select-Object -First 1
  if (!$builtNative) { throw "The pyooz wheel did not contain a Windows ooz extension." }
  New-Item -ItemType Directory -Force (Split-Path -Parent $native) | Out-Null
  Copy-Item -LiteralPath $builtNative.FullName -Destination $native -Force
}

$nativeFiles = @(
  Get-ChildItem -LiteralPath $runtime -File | Where-Object { $_.Name -ne "README.md" }
  Get-Item -LiteralPath $native
)
$fileRecords = foreach ($file in $nativeFiles) {
  [ordered]@{
    path = $file.FullName.Substring($root.Length + 1).Replace("\", "/")
    sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}
$manifest = [ordered]@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  python = [ordered]@{ version = $lock.python.version; sourceUrl = $lock.python.url; archiveSha256 = $lock.python.sha256 }
  pyooz = [ordered]@{ repository = $lock.pyooz.repository; commit = $lock.pyooz.commit; oozCommit = $lock.pyooz.oozCommit; simdeCommit = $lock.pyooz.simdeCommit; builtFromSource = $true }
  files = @($fileRecords)
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Single-player runtime reconstructed and recorded in single-player/runtime-manifest.json."
