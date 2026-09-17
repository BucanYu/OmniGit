@echo off
chcp 65001 >nul
title OmniGit - Build Desktop Package

echo =======================================================
echo      OmniGit - Cross-Platform Desktop Packager
echo =======================================================
echo.

set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=all"

echo [1/4] Checking build environment...
if exist "D:\tools\nvm\nodejs" set "PATH=%PATH%;D:\tools\nvm\nodejs"
if exist "D:\tools\7-Zip" set "PATH=%PATH%;D:\tools\7-Zip"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found in PATH! Please install Node.js ^(>=18.0^).
    goto :BUILD_FAIL
)

cd /d "%~dp0..\app"

:: -------------------------------------------------------
:: Read Product Version
:: -------------------------------------------------------
set "PRODUCT_VERSION="
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "(Get-Content -Raw -Path '%~dp0..\app\package.json' | ConvertFrom-Json).version"') do set "PRODUCT_VERSION=%%a"
if "%PRODUCT_VERSION%"=="" set "PRODUCT_VERSION=0.3.0"
echo Detected OmniGit Version: %PRODUCT_VERSION%
echo Selected Target: [%TARGET%] (all = Windows + macOS)

:: -------------------------------------------------------
:: 1. Build Frontend & Electron Base
:: -------------------------------------------------------
echo.
echo [2/4] Compiling React frontend ^& Electron core...
call npm run build:all
if errorlevel 1 goto :BUILD_FAIL

:: -------------------------------------------------------
:: 2. Windows Packaging
:: -------------------------------------------------------
if /i "%TARGET%"=="mac" goto :SKIP_WINDOWS

echo.
echo [3/4] Packaging Windows standalone application...
call node scripts/package.cjs
if errorlevel 1 goto :BUILD_FAIL

echo.
echo Compiling Windows NSIS Setup Installer...
cd /d "%~dp0"
call "%~dp0tools\nsis\makensis.exe" /DPRODUCT_VERSION="%PRODUCT_VERSION%" "%~dp0installer.nsi"
if errorlevel 1 (
    del /f /q "%~dp0..\app\release\OmniGit-Setup-%PRODUCT_VERSION%.exe" 2>nul
    goto :BUILD_FAIL
)
cd /d "%~dp0..\app"

:SKIP_WINDOWS

:: -------------------------------------------------------
:: 3. macOS Packaging
:: -------------------------------------------------------
if /i "%TARGET%"=="win" goto :SKIP_MAC

echo.
echo [4/4] Packaging macOS applications (Apple Silicon arm64 + Intel x64)...
call node scripts/package-mac.cjs --arch=all
if errorlevel 1 goto :BUILD_FAIL

:SKIP_MAC

echo.
echo =======================================================
echo  [SUCCESS] Packaging Pipeline Completed Successfully!
echo.
if /i not "%TARGET%"=="mac" (
    echo  --- Windows Packages ---
    echo  1. Single-file Setup Installer:
    echo     app\release\OmniGit-Setup-%PRODUCT_VERSION%.exe
    echo.
    echo  2. Standalone Portable Folder:
    echo     app\release\OmniGit-win32-x64\
    echo.
)
if /i not "%TARGET%"=="win" (
    echo  --- macOS Apple Packages ---
    echo  3. Apple Silicon [M1/M2/M3/M4]:
    echo     app\release\OmniGit-v%PRODUCT_VERSION%-mac-arm64.zip
    echo.
    echo  4. Intel x64:
    echo     app\release\OmniGit-v%PRODUCT_VERSION%-mac-x64.zip
    echo.
)
echo  Usage Tips:
echo  - Double click or "build_desktop.bat"      : Builds all platforms (Windows + macOS)
echo  - Command "build_desktop.bat win"          : Builds only Windows installer
echo  - Command "build_desktop.bat mac"          : Builds only macOS packages
echo =======================================================
goto :END

:BUILD_FAIL
echo.
echo =======================================================
echo  [ERROR] Build failed! Please check console logs above.
echo =======================================================

:END
echo.
pause
