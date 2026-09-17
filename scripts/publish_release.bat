@echo off
chcp 65001 >nul
title OmniGit - Publish Release to GitHub

echo =======================================================
echo        OmniGit - GitHub Release Publisher
echo =======================================================
echo.

set "REPO=BucanYu/OmniGit"
set "PRODUCT_VERSION="
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "(Get-Content -Raw -Path '%~dp0..\app\package.json' | ConvertFrom-Json).version"') do set "PRODUCT_VERSION=%%a"
if "%PRODUCT_VERSION%"=="" set "PRODUCT_VERSION=0.3.0"

echo Current Version: v%PRODUCT_VERSION%
echo Target Repository: %REPO%
echo.

set "SETUP_EXE=%~dp0..\app\release\OmniGit-Setup-%PRODUCT_VERSION%.exe"
if not exist "%SETUP_EXE%" (
    echo [ERROR] Installer not found: %SETUP_EXE%
    echo Please run "scripts\build_desktop.bat" first to compile the installer.
    pause
    exit /b 1
)

echo Found Installer: %SETUP_EXE%
echo.
echo Checking GitHub CLI (gh)...
where gh >nul 2>nul
if errorlevel 1 (
    echo [NOTICE] GitHub CLI (gh) is not installed.
    echo.
    echo You can manually upload the installer to GitHub Releases:
    echo 1. Open: https://github.com/%REPO%/releases/new
    echo 2. Enter Tag: v%PRODUCT_VERSION%
    echo 3. Drag and drop file: %SETUP_EXE%
    echo 4. Click "Publish release"
    echo.
    start https://github.com/%REPO%/releases/new
    pause
    exit /b 0
)

echo Creating GitHub Release v%PRODUCT_VERSION% and uploading installer...
gh release create "v%PRODUCT_VERSION%" "%SETUP_EXE%" --repo "%REPO%" --title "OmniGit v%PRODUCT_VERSION%" --generate-notes
if errorlevel 1 (
    echo [ERROR] Failed to publish release via gh CLI. Please verify your login with "gh auth login".
) else (
    echo [SUCCESS] Release published successfully!
    echo View at: https://github.com/%REPO%/releases/tag/v%PRODUCT_VERSION%
)

pause
