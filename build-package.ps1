# ============================================
# DASE - Build Package Script
# Generates a publishable VSIX package locally.
#
# TFX is shipped as a tarball dependency (file:tootega-tfx-1.0.0.tgz) so vsce
# bundles all runtime deps without following a symlink. package.json is NOT
# mutated at build time - it already points at the tarball.
# ============================================

param(
    [string]$Version = "",
    [switch]$SkipTests,
    [switch]$SkipTFX,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warn { Write-Host $args -ForegroundColor Yellow }
function Write-Err { Write-Host $args -ForegroundColor Red }

# Run a native command via cmd so PowerShell 5.1 does not treat stderr warnings
# (ts-jest WARN, vsce file-count warning) as terminating NativeCommandError.
function Invoke-Native {
    param([string]$CommandLine)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { cmd /c "$CommandLine 2>&1" }
    finally { $ErrorActionPreference = $prev }
}

if ($Help) {
    Write-Host @"

DASE Build Package Script
=========================

Usage: .\build-package.ps1 [options]

Options:
  -Version <string>  Version for the package (default: increment package.json patch)
  -SkipTests         Skip running tests
  -SkipTFX           Skip rebuilding TFX (reuse existing dist/)
  -Help              Show this help message

Examples:
  .\build-package.ps1                       # Auto-increment patch, full build
  .\build-package.ps1 -Version 1.2.3        # Build a specific version
  .\build-package.ps1 -SkipTFX -SkipTests   # Quick DASE-only rebuild

Output:
  DASE/dase-<version>.vsix

"@
    exit 0
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  DASE - Build Package" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

$RootDir = $PSScriptRoot
$TfxDir  = Join-Path $RootDir "TFX"
$DaseDir = Join-Path $RootDir "DASE"

if (-not (Test-Path $TfxDir))  { Write-Err "TFX directory not found: $TfxDir";  exit 1 }
if (-not (Test-Path $DaseDir)) { Write-Err "DASE directory not found: $DaseDir"; exit 1 }

# ============================================
# Step 1: Build TFX
# ============================================
if (-not $SkipTFX) {
    Write-Info "[1/6] Building TFX..."
    Push-Location $TfxDir
    try {
        Write-Host "  Installing dependencies..."
        npm ci --silent 2>$null
        if ($LASTEXITCODE -ne 0) { npm install --silent }

        Write-Host "  Compiling TypeScript..."
        npm run build
        if ($LASTEXITCODE -ne 0) { Write-Err "TFX build failed!"; exit 1 }
        Write-Success "  TFX built successfully"
    }
    finally { Pop-Location }
} else {
    Write-Warn "[1/6] Skipping TFX build (-SkipTFX)"
}

# ============================================
# Step 2: Test TFX
# ============================================
if (-not $SkipTests -and -not $SkipTFX) {
    Write-Info "[2/6] Testing TFX..."
    Push-Location $TfxDir
    try {
        Invoke-Native "npm run test"
        if ($LASTEXITCODE -ne 0) { Write-Err "TFX tests failed!"; exit 1 }
        Write-Success "  TFX tests passed"
    }
    finally { Pop-Location }
} else {
    Write-Warn "[2/6] Skipping TFX tests"
}

# ============================================
# Step 3: Pack TFX tarball into DASE
# ============================================
Write-Info "[3/6] Packing TFX tarball into DASE..."
Push-Location $TfxDir
try {
    $TfxVersion = (Get-Content (Join-Path $TfxDir "package.json") -Raw | ConvertFrom-Json).version
    $ExpectedTgz = "tootega-tfx-$TfxVersion.tgz"
    $DepSpec = (Get-Content (Join-Path $DaseDir "package.json") -Raw | ConvertFrom-Json).dependencies."@tootega/tfx"
    if ($DepSpec -ne "file:$ExpectedTgz") {
        Write-Err "DASE depends on '$DepSpec' but TFX packs as '$ExpectedTgz'."
        Write-Err "Fix DASE/package.json @tootega/tfx to 'file:$ExpectedTgz' (or align TFX version)."
        exit 1
    }
    Invoke-Native "npm pack --pack-destination `"$DaseDir`"" | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Err "npm pack (TFX) failed!"; exit 1 }
    Write-Success "  Packed $ExpectedTgz"
}
finally { Pop-Location }

# ============================================
# Step 4: Install DASE deps + set version
# ============================================
Write-Info "[4/6] Installing DASE dependencies..."
Push-Location $DaseDir
try {
    # Drop any stale @tootega/tfx (a symlink left by a prior file:../TFX install)
    # so npm re-materializes it from the tarball named in package-lock.json.
    $TfxTarget = Join-Path $DaseDir "node_modules\@tootega\tfx"
    if (Test-Path $TfxTarget) {
        $item = Get-Item $TfxTarget -Force
        if ($item.LinkType) {
            # Delete the reparse point itself (do not recurse into the link target).
            [System.IO.Directory]::Delete($TfxTarget, $false)
        } else {
            Remove-Item $TfxTarget -Recurse -Force
        }
    }

    npm ci --silent 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "  npm ci failed (lock out of sync?) - falling back to npm install"
        npm install --silent
        if ($LASTEXITCODE -ne 0) { Write-Err "DASE dependency install failed!"; exit 1 }
    }

    # npm resolves a file: dependency through the cache entry recorded in package-lock.json.
    # TFX always packs as tootega-tfx-1.0.0.tgz, so a rebuilt tarball carries the same name
    # and version and does NOT invalidate that entry - npm then quietly restores the PREVIOUS
    # build into node_modules and the DASE compile fails against a stale .d.ts. Reinstall
    # straight from the tarball on disk to defeat the cache.
    Write-Host "  Reinstalling TFX from the freshly packed tarball..."
    Invoke-Native "npm install `"$ExpectedTgz`" --no-save --no-audit --no-fund --silent" | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Err "TFX reinstall from tarball failed!"; exit 1 }

    $tfxIndex = Join-Path $TfxTarget "dist\index.js"
    if (-not (Test-Path $tfxIndex)) { Write-Err "TFX not materialized in node_modules!"; exit 1 }

    # Sanity check: what landed in node_modules must be byte-identical to what TFX just built.
    # Without this the build can still ship a stale TFX and only fail much later, at runtime.
    $builtDist     = Join-Path $TfxDir "dist"
    $installedDist = Join-Path $TfxTarget "dist"
    $stale = @()
    foreach ($file in Get-ChildItem $builtDist -Recurse -File -Filter *.js) {
        $rel = $file.FullName.Substring($builtDist.Length + 1)
        $mirror = Join-Path $installedDist $rel
        if (-not (Test-Path $mirror)) { $stale += "missing: $rel"; continue }
        if ((Get-FileHash $file.FullName -Algorithm SHA256).Hash -ne
            (Get-FileHash $mirror -Algorithm SHA256).Hash) { $stale += "differs: $rel" }
    }
    if ($stale.Count -gt 0) {
        Write-Err "Installed TFX does not match the one just built ($($stale.Count) file(s)):"
        $stale | Select-Object -First 10 | ForEach-Object { Write-Err "    $_" }
        Write-Err "  Try: npm cache clean --force"
        exit 1
    }
    Write-Success "  TFX in node_modules matches the build"

    # Determine version - increment the patch segment unless one was passed.
    if ([string]::IsNullOrEmpty($Version)) {
        $BaseVersion = (Get-Content (Join-Path $DaseDir "package.json") -Raw | ConvertFrom-Json).version
        $Parts = $BaseVersion -split '\.'
        $Version = "$($Parts[0]).$($Parts[1]).$([int]$Parts[2] + 1)"
    }
    Write-Host "  Version: $Version"
    npm version $Version --no-git-tag-version --allow-same-version 2>$null

    Write-Host "  Compiling TypeScript..."
    npm run compile
    if ($LASTEXITCODE -ne 0) { Write-Err "DASE build failed!"; exit 1 }
    Write-Success "  DASE built successfully"
}
finally { Pop-Location }

# ============================================
# Step 5: Test DASE
# ============================================
if (-not $SkipTests) {
    Write-Info "[5/6] Testing DASE..."
    Push-Location $DaseDir
    try {
        Invoke-Native "npm test"
        if ($LASTEXITCODE -ne 0) { Write-Err "DASE tests failed!"; exit 1 }
        Write-Success "  DASE tests passed"
    }
    finally { Pop-Location }
} else {
    Write-Warn "[5/6] Skipping DASE tests"
}

# ============================================
# Step 6: Package VSIX
# ============================================
Write-Info "[6/6] Packaging VSIX..."
Push-Location $DaseDir
try {
    if (-not (Get-Command vsce -ErrorAction SilentlyContinue)) {
        Write-Host "  Installing vsce..."
        npm install -g @vscode/vsce
    }

    Get-ChildItem "dase-*.vsix" -ErrorAction SilentlyContinue | Remove-Item -Force

    $VsixFile = "dase-$Version.vsix"
    Invoke-Native "vsce package --out `"$VsixFile`""
    if ($LASTEXITCODE -ne 0) { Write-Err "Packaging failed!"; exit 1 }

    $VsixPath = Join-Path $DaseDir $VsixFile
    if (-not (Test-Path $VsixPath)) { Write-Err "VSIX not produced!"; exit 1 }
    $VsixSize = [math]::Round((Get-Item $VsixPath).Length / 1KB, 2)
    Write-Success "  Package created: $VsixFile ($VsixSize KB)"
}
finally { Pop-Location }

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Version:  $Version" -ForegroundColor White
Write-Host "  Package:  DASE\dase-$Version.vsix" -ForegroundColor White
Write-Host ""
Write-Host "To publish:  .\publish-package.ps1 -Pat <token>" -ForegroundColor Cyan
Write-Host "To install:  code --install-extension DASE\dase-$Version.vsix" -ForegroundColor Cyan
Write-Host ""
