@echo off
REM ST2110 RDS Manager - Quick Start (No pause, opens browser automatically)
title ST2110 RDS Manager - Quick Start

cls
echo.
echo  ██████╗ ██████╗ ███████╗    ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗ ███████╗██████╗
echo  ██╔══██╗██╔══██╗██╔════╝    ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝ ██╔════╝██╔══██╗
echo  ██████╔╝██║  ██║███████╗    ██╔████╔██║███████║██╔██╗ ██║███████║██║  ███╗█████╗  ██████╔╝
echo  ██╔══██╗██║  ██║╚════██║    ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║   ██║██╔══╝  ██╔══██╗
echo  ██║  ██║██████╔╝███████║    ██║ ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╔╝███████╗██║  ██║
echo  ╚═╝  ╚═╝╚═════╝ ╚══════╝    ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
echo.
echo  ST2110 NMOS IS-04 RDS Management System
echo  ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js not found. Please install from https://nodejs.org/
    timeout /t 10
    exit /b 1
)

echo [*] Starting servers...
echo.

REM Start backend
cd backend
if not exist "node_modules" (
    echo [*] Installing backend dependencies...
    call npm install --silent
)
start /min "RDS-Backend" cmd /c "npm run dev"
cd ..

REM Wait a bit for backend
timeout /t 4 /nobreak >nul

REM Start frontend
cd frontend
if not exist "node_modules" (
    echo [*] Installing frontend dependencies...
    call npm install --silent
)
start /min "RDS-Frontend" cmd /c "npm run dev"
cd ..

echo [*] Waiting for servers to start...
timeout /t 8 /nobreak >nul

echo.
echo [OK] Servers are running!
echo.
echo     Backend:  http://localhost:3000
echo     Frontend: http://localhost:5173
echo.
echo [*] Opening browser...
timeout /t 2 /nobreak >nul

start http://localhost:5173/test-rds

echo.
echo [*] Application started successfully!
echo.
echo     Press Ctrl+C to stop or close this window.
echo.

REM Keep window open
timeout /t -1
