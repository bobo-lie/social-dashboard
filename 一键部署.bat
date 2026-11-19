@echo off
chcp 65001 >nul
title Mailuo - Deploy to Cloudflare
cd /d "%~dp0"

type "deploy-readme.txt"
echo.
echo ------------------------------------------
set /p GHTOKEN=GitHub Token: 
set /p CFTOKEN=Cloudflare Token: 
echo.
echo Deploying...
echo.

set GITHUB_TOKEN=%GHTOKEN%
set CLOUDFLARE_API_TOKEN=%CFTOKEN%
node deploy\deploy.cjs

echo.
echo ---- deploy finished ----
echo If a site URL was printed above, it succeeded.
echo.
pause
