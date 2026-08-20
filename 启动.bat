@echo off
chcp 65001 >nul
title HOUSE HUNTER · 看房助手启动器

cd /d "%~dp0"

echo.
echo ========================================
echo    🏠 HOUSE HUNTER · 看房助手启动器
echo ========================================
echo.

REM 优先使用 Node.js 方案（启动后自动打开浏览器）
where node >nul 2>nul
if %errorlevel%==0 (
    echo [1/2] 检测到 Node.js，使用 Node 启动服务器...
    echo.
    node server.js
    if %errorlevel%==0 goto END
    echo.
    echo [提示] Node 启动失败，尝试 Python 方案...
    echo.
)

REM 回退到 Python 方案
where python >nul 2>nul
if %errorlevel%==0 (
    echo [1/2] 检测到 Python，使用 Python 启动服务器...
    echo.
    start "" "http://localhost:8765/"
    echo [2/2] 正在打开浏览器访问 http://localhost:8765/
    echo.
    echo ========================================
    echo   看房助手 已启动！端口：8765
    echo   本机访问： http://localhost:8765/
    echo   关闭此窗口即可停止服务
    echo ========================================
    echo.
    python -m http.server 8765
    goto END
)

REM 两者都没有时给出安装引导
echo.
echo ❌ 未检测到 Node.js 或 Python，无法启动。
echo.
echo 请先安装其中任意一个（任选其一即可）：
echo.
echo  方案 A（推荐）：安装 Python 3
echo     下载地址：https://www.python.org/downloads/windows/
echo     安装时勾选 "Add Python to PATH"
echo     安装完成后双击本脚本即可
echo.
echo  方案 B：安装 Node.js
echo     下载地址：https://nodejs.org/zh-cn/ （选 LTS 版本）
echo     安装完成后双击本脚本即可
echo.
echo 或者参考 README_启动指南.md 中的详细说明。
echo.
pause
:END
