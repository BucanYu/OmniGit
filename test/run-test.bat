@echo off
rem =====================================================================
rem OmniGit Automated Test Suite Runner (Windows Batch)
rem =====================================================================

cd /d "%~dp0\.."
echo [OmniGit Test Suite] Starting unified automated tests...
node test\scripts\run-all-tests.cjs

if %ERRORLEVEL% EQU 0 (
    echo [OmniGit Test Suite] All tests passed!
    exit /b 0
) else (
    echo [OmniGit Test Suite] Tests failed with exit code %ERRORLEVEL%!
    exit /b %ERRORLEVEL%
)
