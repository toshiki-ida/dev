@echo off
echo Building vMix_OA executable...

REM Clean previous builds
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist vMix_OA.spec del vMix_OA.spec

REM Build executable
pyinstaller --onefile --windowed --name=vMix_OA --icon=NONE ^
    --add-data "config.json;." ^
    --hidden-import=customtkinter ^
    --hidden-import=tkinter ^
    --hidden-import=requests ^
    main.py

echo.
echo Build complete!
echo Executable location: dist\vMix_OA.exe
pause
