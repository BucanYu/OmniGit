# OmniGit PowerShell Stop Script
$Host.UI.RawUI.WindowTitle = "OmniGit Stop Dev Server (Port 5345)"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "          OmniGit - Stop Dev Server (Port 5345)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$connections = Get-NetTCPConnection -LocalPort 5345 -State Listen -ErrorAction SilentlyContinue

if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        Write-Host "[Stop] Terminating process PID $p on port 5345..." -ForegroundColor Yellow
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[Success] OmniGit dev server stopped." -ForegroundColor Green
} else {
    Write-Host "[Info] No active server found listening on port 5345." -ForegroundColor Cyan
}

Start-Sleep -Seconds 2
