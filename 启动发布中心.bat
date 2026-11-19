@echo off
chcp 65001 >nul
title 脉络 · 发布中心
cd /d "%~dp0"
echo.
echo   ============================================
echo      脉络 · 发布中心  正在启动...
echo   ============================================
echo.
node publisher\server.js
if errorlevel 1 (
  echo.
  echo   启动失败。请确认：
  echo    1. 已安装 Node.js
  echo    2. 8899 端口没有被占用
  echo.
  pause
)
