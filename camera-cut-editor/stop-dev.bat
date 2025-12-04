@echo off
title Camera Cut Editor - Stop Services
echo ========================================
echo   Camera Cut Editor - Stopping Services
echo ========================================
echo.

:: Stop Next.js (node processes on port 3000)
echo [1/2] Stopping Next.js dev server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)
echo Done.

:: Optionally stop MongoDB
echo.
set /p STOP_MONGO="[2/2] Stop MongoDB as well? (y/N): "
if /i "%STOP_MONGO%"=="y" (
    echo Stopping MongoDB...
    taskkill /F /IM mongod.exe 2>nul
    echo MongoDB stopped.
) else (
    echo MongoDB left running.
)

echo.
echo ========================================
echo   All services stopped.
echo ========================================
pause
