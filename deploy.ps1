# deploy.ps1 - Utmost repository deploy script
# Usage:  .\deploy.ps1 "commit message"

param([Parameter(Position=0)][string]$Message = "")

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$changes = git status --porcelain
if (-not $changes) {
    Write-Host "No changes." -ForegroundColor Yellow
    exit 0
}

$count = ($changes | Measure-Object).Count
Write-Host ""
Write-Host "Changed files: $count" -ForegroundColor Cyan
$changes | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
Write-Host ""

if (-not $Message) {
    $Message = "update " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

# bump service worker version -> open apps show the update popup
$swPath = Join-Path $PSScriptRoot "sw.js"
$ver = Get-Date -Format "yyyyMMdd-HHmmss"
$sw = [IO.File]::ReadAllText($swPath)
$sw = $sw -replace "const VERSION = '[^']*'", "const VERSION = '$ver'"
[IO.File]::WriteAllText($swPath, $sw, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "sw.js VERSION = $ver" -ForegroundColor Cyan

git add -A
git commit -m $Message
git push

Write-Host ""
Write-Host "Deployed. Live in 1-2 minutes." -ForegroundColor Green
Write-Host "https://youngbaekim.github.io/utmost/" -ForegroundColor Green
