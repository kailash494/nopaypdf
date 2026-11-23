# NoPayPDF - Turnkey Release Build & SEO Verification Script
# Usage: .\scripts\build-release.ps1 [-BaseUrl "https://nopaypdf.com"] [-AdMode "off"]

param(
    [string]$BaseUrl = "https://nopaypdf.com",
    [string]$AdMode = "off"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
Set-Location $rootDir

# Resolve PHP binary (from PATH or WinGet packages)
$phpCmd = "php"
if (-not (Get-Command php -ErrorAction SilentlyContinue)) {
    $wingetPhp = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "php.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($wingetPhp) {
        $phpDir = Split-Path -Parent $wingetPhp.FullName
        $env:PATH = "$phpDir;" + $env:PATH
        $phpCmd = $wingetPhp.FullName
        Write-Host "Discovered local PHP at: $phpCmd" -ForegroundColor DarkGray
    }
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " NoPayPDF - Production Release Builder" -ForegroundColor Cyan
Write-Host " Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host " Ad Mode:  $AdMode" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Compile minified Tailwind CSS v4
Write-Host "`n>>> [1/3] Compiling Tailwind CSS v4..." -ForegroundColor Yellow
npm run build:css
if ($LASTEXITCODE -ne 0) {
    Write-Host "CSS build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. Export clean static pages into dist/
Write-Host "`n>>> [2/3] Exporting static site into dist/..." -ForegroundColor Yellow
& $phpCmd scripts/build-static.php --base-url="$BaseUrl" --ad-mode="$AdMode"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Static export failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Verify build-time SEO and consistency
Write-Host "`n>>> [3/3] Verifying SEO and site integrity..." -ForegroundColor Yellow
& $phpCmd scripts/verify-seo.php
if ($LASTEXITCODE -ne 0) {
    Write-Host "SEO verification failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host " Release build & SEO verification successful!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
