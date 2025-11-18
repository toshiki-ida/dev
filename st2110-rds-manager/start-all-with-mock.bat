@echo off
REM ST2110 RDS Manager - Start All Servers (Including Mock RDS)
echo ============================================
echo ST2110 RDS Manager - Starting All Servers
echo Including Mock RDS Servers
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
echo [1/5] Checking dependencies...
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
echo [2/5] Starting Backend Server (Port 3000)...
cd backend
start "ST2110 RDS Manager - Backend" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul
cd ..

echo.
echo [3/5] Starting Frontend Development Server (Port 5173)...
cd frontend
start "ST2110 RDS Manager - Frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
cd ..

echo.
echo [4/5] Starting Mock RDS Servers...
echo Starting Mock RDS on port 8080...
curl -X POST http://localhost:3000/api/mock-rds/start -H "Content-Type: application/json" -d "{\"port\":8080}" 2>nul
timeout /t 1 /nobreak >nul

echo Starting Mock RDS on port 8081...
curl -X POST http://localhost:3000/api/mock-rds/start -H "Content-Type: application/json" -d "{\"port\":8081}" 2>nul
timeout /t 1 /nobreak >nul

echo.
echo [5/5] All servers started!
echo.
echo ============================================
echo Server Status:
echo ============================================
echo Backend API:     http://localhost:3000
echo Frontend App:    http://localhost:5173
echo.
echo Mock RDS 1:      http://localhost:8080
echo Mock RDS 2:      http://localhost:8081
echo.
echo NMOS API Example:
echo   http://localhost:8080/x-nmos/registration/v1.3/resource
echo.
echo Application Pages:
echo   Dashboard:       http://localhost:5173/
echo   RDS Management:  http://localhost:5173/rds
echo   Test RDS:        http://localhost:5173/test-rds
echo   Node Operations: http://localhost:5173/nodes
echo ============================================
echo.
echo Press any key to open the Test RDS page in your browser...
pause >nul

REM Open browser to Test RDS page
start http://localhost:5173/test-rds

echo.
echo Application opened in browser.
echo.
echo To stop all servers, run: stop-all.bat
echo Or close the command windows manually.
echo.
echo Mock RDS servers will be stopped when the backend stops.
echo.
pause
