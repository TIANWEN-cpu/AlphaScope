@echo off
title AI-Finance Setup
cd /d "%~dp0"

echo ========================================
echo   AI-Finance 一键安装
echo ========================================
echo.
echo 本脚本将自动完成以下步骤：
echo   1. 检查 Python 和 Node.js
echo   2. 安装项目依赖
echo   3. 创建配置文件
echo   4. 创建桌面快捷方式
echo   5. 启动服务
echo.
pause

REM 运行安装脚本
echo.
echo [1/4] 安装依赖...
powershell -ExecutionPolicy Bypass -File "scripts\install_deps.ps1"
if errorlevel 1 (
    echo.
    echo 安装失败，请查看上方错误信息。
    pause
    exit /b 1
)

echo.
echo [2/4] 创建桌面快捷方式...
powershell -ExecutionPolicy Bypass -File "scripts\create_shortcut.ps1"

echo.
echo [3/4] 标记首次运行完成...
echo Setup completed at %date% %time% > .first_run_complete

echo.
echo [4/4] 启动服务...
powershell -ExecutionPolicy Bypass -File "scripts\start_local.ps1"
