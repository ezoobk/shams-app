@echo off
title Shams App - Smart Desktop App Builder
color 0B
echo ===================================================
echo     Shams App - Smart Application Builder
echo ===================================================
echo.
echo This tool will automatically:
echo  - Increment the version number
echo  - Clean old setup files
echo  - Build a fresh Windows Setup Installer (.exe)
echo.
pause

echo.
echo [1/2] Checking Electron framework...
call npm install electron electron-builder -D --silent

echo.
echo [2/2] Building the Desktop Application...
call npm run smart-build

if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERROR] Something went wrong during the build process.
    pause
    exit /b %ERRORLEVEL%
)

IF EXIST "release\*.exe" (
    echo.
    color 0A
    echo ===================================================
    echo                     SUCCESS!
    echo ===================================================
    echo.
    echo Your standalone application has been built!
    echo You will find the new versioned .exe inside the "release" folder.
    echo.
    echo Send that .exe file to any PC. They can just double-click 
    echo it to install the app properly on their Windows system!
    echo.
) ELSE (
    color 0C
    echo [ERROR] Setup file not found in release folder.
)

pause
