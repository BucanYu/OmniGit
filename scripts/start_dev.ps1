# OmniGit PowerShell Startup Script
$Host.UI.RawUI.WindowTitle = "OmniGit Dev Server (Port 5345)"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "          OmniGit - Desktop Git Manager" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Checking environment..." -ForegroundColor Yellow
if (Test-Path "D:\tools\nvm\nodejs") {
    $env:Path = "$env:Path;D:\tools\nvm\nodejs"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found in PATH! Please install Node.js (>=18.0)." -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Environment ready:" -ForegroundColor Yellow
node -v

Write-Host ""
Write-Host "[3/3] Starting OmniGit Dev Server on port 5345..." -ForegroundColor Green
Start-Process "http://localhost:5345"

Set-Location "$PSScriptRoot\..\app"
npm run dev
