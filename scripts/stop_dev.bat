@echo off
chcp 65001 >nul
title OmniGit Stop Dev Server

echo =======================================================
echo          OmniGit - Stop Dev Server (Port 5345)
echo =======================================================
echo.

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5345" ^| findstr "LISTENING"') do (
    set FOUND=1
    echo [Stop] Found active server PID %%a listening on port 5345. Terminating...
    taskkill /F /PID %%a >nul 2>&1
)

if "%FOUND%"=="1" (
    echo [Success] OmniGit dev server has been stopped.
) else (
    echo [Info] No active server found on port 5345.
)

echo.
timeout /t 3 >nul
