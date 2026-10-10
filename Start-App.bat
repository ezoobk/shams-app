@echo off
title Shams App Launcher
color 0B
echo ===================================================
echo         Shams App - Setup and Launcher
echo ===================================================
echo.

:: Check if Node is installed
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js is not installed on this computer!
    echo To run this application, Node.js is required.
    echo Please download and install it from: https://nodejs.org/
    echo.
    echo After installing, double click this file again.
    pause
    exit /b
)

:: Install dependencies if node_modules doesn't exist
IF NOT EXIST "node_modules\" (
    echo [INFO] First time setup detected!
    echo [INFO] Installing required files... (this may take a minute or two)
    call npm install
    echo.
)

echo [INFO] Starting the application...
echo [INFO] The browser will open automatically. Keep this window open!

:: Open browser after a short 3 second delay to let Vite start
start "" cmd /c "timeout /t 3 >nul && start http://localhost:5173"

:: Run the Vite server
call npm run dev
