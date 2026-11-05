@echo off
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>&1
if errorlevel 1 (
    echo ERROR: Windows PowerShell is required for automatic setup.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\bootstrap.ps1" -ProjectRoot "%~dp0"
set "result=%ERRORLEVEL%"
if not "%result%"=="0" (
    echo.
    echo Setup or launch failed. Read the error above.
    pause
)
exit /b %result%
