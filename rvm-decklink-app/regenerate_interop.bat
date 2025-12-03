@echo off
REM Change to the directory where this batch file is located
cd /d "%~dp0"

echo ============================================
echo DeckLink Interop DLL Regeneration Script
echo ============================================
echo.
echo Output directory: %CD%
echo.

REM Check for DeckLinkAPI64.dll location - try multiple paths
set DECKLINK_DLL=

REM Path 1: Desktop Video (DeckLink 8K Pro)
if exist "C:\Program Files\Blackmagic Design\Desktop Video\DeckLinkAPI64.dll" (
    set DECKLINK_DLL=C:\Program Files\Blackmagic Design\Desktop Video\DeckLinkAPI64.dll
    goto :found_dll
)

REM Path 2: Blackmagic Desktop Video (older installations)
if exist "C:\Program Files\Blackmagic Design\Blackmagic Desktop Video\DeckLinkAPI64.dll" (
    set DECKLINK_DLL=C:\Program Files\Blackmagic Design\Blackmagic Desktop Video\DeckLinkAPI64.dll
    goto :found_dll
)

REM Path 3: DeckLink folder
if exist "C:\Program Files\Blackmagic Design\DeckLink\DeckLinkAPI64.dll" (
    set DECKLINK_DLL=C:\Program Files\Blackmagic Design\DeckLink\DeckLinkAPI64.dll
    goto :found_dll
)

echo ERROR: DeckLinkAPI64.dll not found.
echo.
echo Searched locations:
echo   - C:\Program Files\Blackmagic Design\Desktop Video\DeckLinkAPI64.dll
echo   - C:\Program Files\Blackmagic Design\Blackmagic Desktop Video\DeckLinkAPI64.dll
echo   - C:\Program Files\Blackmagic Design\DeckLink\DeckLinkAPI64.dll
echo.
echo Please find DeckLinkAPI64.dll and run:
echo   tlbimp "path\to\DeckLinkAPI64.dll" /out:Interop.DeckLinkAPI.dll /namespace:DeckLinkAPI
pause
exit /b 1

:found_dll

echo Found DeckLinkAPI64.dll at:
echo   %DECKLINK_DLL%
echo.

REM Try different tlbimp locations
set "TLBIMP_48=C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\x64\tlbimp.exe"
set "TLBIMP_472=C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.7.2 Tools\x64\tlbimp.exe"
set "TLBIMP_46=C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.6.1 Tools\x64\tlbimp.exe"

set TLBIMP=

if exist "%TLBIMP_48%" (
    set "TLBIMP=%TLBIMP_48%"
    echo Using .NET Framework 4.8 tlbimp
) else if exist "%TLBIMP_472%" (
    set "TLBIMP=%TLBIMP_472%"
    echo Using .NET Framework 4.7.2 tlbimp
) else if exist "%TLBIMP_46%" (
    set "TLBIMP=%TLBIMP_46%"
    echo Using .NET Framework 4.6.1 tlbimp
)

if "%TLBIMP%"=="" (
    echo ERROR: tlbimp.exe not found.
    echo Please install Visual Studio with .NET Framework development tools.
    echo.
    echo Or run from Visual Studio Developer Command Prompt:
    echo   tlbimp "%DECKLINK_DLL%" /out:Interop.DeckLinkAPI.dll
    pause
    exit /b 1
)

echo.
echo Generating Interop.DeckLinkAPI.dll...
echo.

"%TLBIMP%" "%DECKLINK_DLL%" /out:Interop.DeckLinkAPI.dll /namespace:DeckLinkAPI

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Failed to generate Interop DLL.
    pause
    exit /b 1
)

echo.
echo ============================================
echo SUCCESS! Interop.DeckLinkAPI.dll generated.
echo ============================================
echo.
echo File location: %CD%\Interop.DeckLinkAPI.dll
echo.
echo Next steps:
echo 1. Copy this DLL to your publish folder
echo 2. Restart RvmDecklink.exe
echo.
pause
