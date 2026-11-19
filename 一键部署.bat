@echo off
chcp 65001 >nul
title 脉络社媒数据台 - 一键部署
echo ============================================
echo   脉络社媒数据台 - 一键部署到 Cloudflare
echo ============================================
echo.
echo 本脚本会把代码推送到 GitHub 并部署到 Cloudflare Pages，
echo 域名：social.lietrade.com
echo.
echo 运行前请准备好两个 Token（只需一次）：
echo.
echo 1) GitHub Personal Access Token (classic)
echo    打开 https://github.com/settings/tokens
echo    点 Generate new token (classic)，勾选 repo 权限，生成后复制
echo.
echo 2) Cloudflare API Token
echo    打开 https://dash.cloudflare.com/profile/api-tokens
echo    点 Create Token -^> Edit Cloudflare Pages 模板，
echo    再加 DNS Edit 权限（Zone:DNS:Edit，作用域 lietrade.com）
echo.
echo --------------------------------------------
set /p GHTOKEN=粘贴 GitHub Token 后回车: 
set /p CFTOKEN=粘贴 Cloudflare Token 后回车: 
echo.
echo 开始部署，请稍候...
echo.
cd /d "%~dp0"
set GITHUB_TOKEN=%GHTOKEN%
set CLOUDFLARE_API_TOKEN=%CFTOKEN%
node deploy\deploy.cjs
echo.
echo ============================================
echo 部署脚本已结束。若上面显示站点地址，说明成功。
echo ============================================
pause
