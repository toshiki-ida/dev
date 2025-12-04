# Camera Cut Editor - PowerShell Development Script
# Usage: .\dev.ps1 [start|stop|restart|status]

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "start"
)

$Host.UI.RawUI.WindowTitle = "Camera Cut Editor - Dev"

function Write-Header {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Camera Cut Editor - Development" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Get-MongoStatus {
    $mongo = Get-Process -Name "mongod" -ErrorAction SilentlyContinue
    return $null -ne $mongo
}

function Get-NextStatus {
    $connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    return $null -ne $connections
}

function Start-MongoDB {
    if (Get-MongoStatus) {
        Write-Host "[MongoDB] Already running" -ForegroundColor Green
        return
    }

    Write-Host "[MongoDB] Starting..." -ForegroundColor Yellow

    # Create data directory if not exists
    $dataPath = "C:\data\db"
    if (-not (Test-Path $dataPath)) {
        New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
    }

    Start-Process -FilePath "mongod" -ArgumentList "--dbpath", $dataPath -WindowStyle Minimized
    Start-Sleep -Seconds 2

    if (Get-MongoStatus) {
        Write-Host "[MongoDB] Started successfully" -ForegroundColor Green
    } else {
        Write-Host "[MongoDB] Failed to start" -ForegroundColor Red
    }
}

function Stop-MongoDB {
    if (-not (Get-MongoStatus)) {
        Write-Host "[MongoDB] Not running" -ForegroundColor Yellow
        return
    }

    Write-Host "[MongoDB] Stopping..." -ForegroundColor Yellow
    Stop-Process -Name "mongod" -Force -ErrorAction SilentlyContinue
    Write-Host "[MongoDB] Stopped" -ForegroundColor Green
}

function Start-NextDev {
    if (Get-NextStatus) {
        Write-Host "[Next.js] Already running on port 3000" -ForegroundColor Green
        return
    }

    # Generate Prisma client if needed
    if (-not (Test-Path "node_modules\.prisma\client")) {
        Write-Host "[Prisma] Generating client..." -ForegroundColor Yellow
        npx prisma generate
    }

    Write-Host "[Next.js] Starting dev server..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Note: Server will start on port 3000" -ForegroundColor Yellow
    Write-Host "  If port 3000 is in use, check console for actual port" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Main page: http://localhost:3000" -ForegroundColor White
    Write-Host "  Layout Editor: http://localhost:3000/layout-editor" -ForegroundColor White
    Write-Host ""
    Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""

    npm run dev
}

function Stop-NextDev {
    if (-not (Get-NextStatus)) {
        Write-Host "[Next.js] Not running" -ForegroundColor Yellow
        return
    }

    Write-Host "[Next.js] Stopping..." -ForegroundColor Yellow

    $connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }

    Write-Host "[Next.js] Stopped" -ForegroundColor Green
}

function Show-Status {
    Write-Host ""
    Write-Host "Service Status:" -ForegroundColor Cyan
    Write-Host "---------------"

    if (Get-MongoStatus) {
        Write-Host "  MongoDB:  " -NoNewline
        Write-Host "Running" -ForegroundColor Green
    } else {
        Write-Host "  MongoDB:  " -NoNewline
        Write-Host "Stopped" -ForegroundColor Red
    }

    if (Get-NextStatus) {
        Write-Host "  Next.js:  " -NoNewline
        Write-Host "Running (http://localhost:3000)" -ForegroundColor Green
    } else {
        Write-Host "  Next.js:  " -NoNewline
        Write-Host "Stopped" -ForegroundColor Red
    }

    Write-Host ""
}

# Main execution
Write-Header

switch ($Action) {
    "start" {
        Start-MongoDB
        Start-NextDev
    }
    "stop" {
        Stop-NextDev
        $response = Read-Host "Stop MongoDB as well? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            Stop-MongoDB
        }
        Write-Host ""
        Write-Host "All services stopped." -ForegroundColor Green
    }
    "restart" {
        Stop-NextDev
        Start-Sleep -Seconds 1
        Start-NextDev
    }
    "status" {
        Show-Status
    }
}
