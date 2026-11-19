@echo off
chcp 65001 >nul
title Mailuo Publisher Center
cd /d "%~dp0"

echo.
echo   ==========================================
echo      Mailuo Publisher Center  starting...
echo   ==========================================
echo.

node publisher\server.js

echo.
echo   ---- server stopped ----
echo   * If "node" is not recognized: install Node.js first.
echo   * If port 8899 is busy: close the program using it.
echo.
pause
