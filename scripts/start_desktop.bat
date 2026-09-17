@echo off
chcp 65001 >nul
title OmniGit Desktop Client

echo =======================================================
echo          OmniGit - Desktop Native Client
echo =======================================================
echo.
echo [1/3] Checking environment...
if exist "D:\tools\nvm\nodejs" set "PATH=%PATH%;D:\tools\nvm\nodejs"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found in PATH! Please install Node.js ^(>=18.0^).
    pause
    exit /b 1
)

echo [2/3] Environment ready:
node -v

echo.
echo [3/3] Compiling and starting OmniGit Desktop Window...
cd /d "%~dp0..\app"
call npm run electron:preview

pause
