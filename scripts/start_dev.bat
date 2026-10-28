@echo off
title OmniGit Dev Server (Port 5345)

echo =======================================================
echo          OmniGit - Desktop Git Manager
echo =======================================================
echo.
echo [1/3] Checking environment...
if exist "D:\tools\nvm\nodejs" set "PATH=%PATH%;D:\tools\nvm\nodejs"
if exist "D:\tools\nodejs" set "PATH=%PATH%;D:\tools\nodejs"
if exist "D:\tools\nvm\nvm\v20.19.5" set "PATH=%PATH%;D:\tools\nvm\nvm\v20.19.5"
if exist "D:\tools\nvm\nvm\v22.20.0" set "PATH=%PATH%;D:\tools\nvm\nvm\v22.20.0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found in PATH! Please install Node.js 18 or above.
    pause
    exit /b 1
)

echo [2/3] Environment ready:
node -v

echo.
echo [3/3] Starting OmniGit Dev Server on port 5345...
echo Opening http://localhost:5345 in your default browser...
start http://localhost:5345

cd /d "%~dp0..\app"
call npm run dev

pause
