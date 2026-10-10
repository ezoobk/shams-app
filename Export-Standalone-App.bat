@echo off
title Shams App - Standalone Exporter
color 0B
echo ===================================================
echo     Shams App - Standalone File Generator
echo ===================================================
echo.
echo This tool will package your ENTIRE application into ONE single 
echo file (ShamsApp.html) that can run on ANY computer WITHOUT 
echo needing Node.js or any setup!
echo.
pause

echo.
echo [1/3] Installing necessary build plugins...
call npm install

echo.
echo [2/3] Building the standalone application...
call npm run build

IF EXIST "dist\index.html" (
    echo.
    echo [3/3] Copying the final file...
    copy /Y "dist\index.html" "ShamsApp.html" >nul
    color 0A
    echo.
    echo ===================================================
    echo                     SUCCESS!
    echo ===================================================
    echo.
    echo You will now find a file named "ShamsApp.html" in this folder.
    echo.
    echo Just copy "ShamsApp.html" to your client's PC, a USB drive, 
    echo or send it to them. They can just double-click it to run 
    echo the app instantly in their browser! 
    echo NO installations needed!
    echo.
) ELSE (
    color 0C
    echo [ERROR] Something went wrong during the build process.
)

pause
