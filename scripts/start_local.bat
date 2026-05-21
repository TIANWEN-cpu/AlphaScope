@echo off
title AI-Finance Local
cd /d "%~dp0.."

echo ========================================
echo   AI-Finance 本地启动
echo ========================================
echo.

REM 检查是否首次运行
if not exist ".first_run_complete" (
    echo 检测到首次运行，正在安装依赖...
    echo.
    powershell -ExecutionPolicy Bypass -File "%~dp0install_deps.ps1"
    if errorlevel 1 (
        echo.
        echo 依赖安装失败，请查看上方错误信息。
        pause
        exit /b 1
    )
    echo.
)

REM 启动服务
powershell -ExecutionPolicy Bypass -File "%~dp0start_local.ps1" %*
pause
