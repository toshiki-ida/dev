@echo off
REM ST2110 RDS Manager - Stop All Servers
echo ============================================
echo ST2110 RDS Manager - Stopping All Servers
echo ============================================
echo.

REM Kill Node.js processes related to this project
echo [1/3] Stopping Backend Server...
for /f "tokens=2" %%a in ('tasklist ^| findstr /i "node.exe"') do (
    taskkill /PID %%a /F >nul 2>nul
)

echo [2/3] Stopping Frontend Development Server...
for /f "tokens=2" %%a in ('tasklist ^| findstr /i "node.exe"') do (
    taskkill /PID %%a /F >nul 2>nul
)

REM Also kill tsx processes (TypeScript runner)
for /f "tokens=2" %%a in ('tasklist ^| findstr /i "tsx.exe"') do (
    taskkill /PID %%a /F >nul 2>nul
)

echo [3/3] Closing command windows...
REM Close windows with specific titles
taskkill /FI "WINDOWTITLE eq ST2110 RDS Manager - Backend*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq ST2110 RDS Manager - Frontend*" /F >nul 2>nul

echo.
echo ============================================
echo All servers stopped successfully!
echo ============================================
echo.
echo To start servers again, run: start-all.bat
echo.
pause
