# PDFToolKit - Tailwind CSS v4 Production Build Script
# Usage: .\scripts\build-css.ps1

Write-Host "Compiling production minified Tailwind CSS..." -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
Set-Location $rootDir

npx @tailwindcss/cli -i assets/css/tailwind.input.css -o assets/css/tailwind.min.css --minify

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item "assets/css/tailwind.min.css").Length
    Write-Host "Success! assets/css/tailwind.min.css built ($size bytes)" -ForegroundColor Green
} else {
    Write-Host "CSS build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
