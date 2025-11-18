@echo off
REM ST2110 RDS Manager - Start All Servers
echo ============================================
echo ST2110 RDS Manager - Starting All Servers
echo ============================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dependencies are installed
echo [1/4] Checking dependencies...
cd backend
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install backend dependencies
        pause
        exit /b 1
    )
)
cd ..

cd frontend
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install frontend dependencies
        pause
        exit /b 1
    )
)
cd ..

echo.
echo [2/4] Starting Backend Server (Port 3000)...
cd backend
start "ST2110 RDS Manager - Backend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
cd ..

echo.
echo [3/4] Starting Frontend Development Server (Port 5173)...
cd frontend
start "ST2110 RDS Manager - Frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
cd ..

echo.
echo [4/4] All servers started!
echo.
echo ============================================
echo Server Status:
echo ============================================
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Test RDS Page: http://localhost:5173/test-rds
echo RDS Management: http://localhost:5173/rds
echo ============================================
echo.
echo Press any key to open the application in your browser...
pause >nul

REM Open browser
start http://localhost:5173

echo.
echo Application opened in browser.
echo.
echo To stop all servers, run: stop-all.bat
echo Or close the command windows manually.
echo.
pause
