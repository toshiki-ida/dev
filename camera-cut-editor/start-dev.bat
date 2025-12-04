@echo off
title Camera Cut Editor - Dev Server
echo ========================================
echo   Camera Cut Editor - Development
echo ========================================
echo.

:: Clean up any existing Next.js dev server on port 3000
echo [0/4] Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
:: Remove stale lock file
if exist ".next\dev\lock" del /f ".next\dev\lock" >nul 2>&1
echo Done.
echo.

:: Check if MongoDB is running
echo [1/4] Checking MongoDB...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo MongoDB is already running.
) else (
    echo Starting MongoDB...
    start "MongoDB" cmd /c "mongod --dbpath C:\data\db"
    timeout /t 3 /nobreak >nul
)

:: Generate Prisma client if needed
echo.
echo [2/4] Checking Prisma client...
if not exist "node_modules\.prisma\client" (
    echo Generating Prisma client...
    call npx prisma generate
)

:: Start dev server with Socket.io
echo.
echo [3/4] Starting dev server with Socket.io...
echo.
echo ========================================
echo   Server: http://localhost:3000
echo   Layout Editor: http://localhost:3000/layout-editor
echo.
echo   Real-time collaboration enabled!
echo   Multiple users can edit cameras together.
echo.
echo   Press Ctrl+C to stop
echo ========================================
echo.

npm run dev
