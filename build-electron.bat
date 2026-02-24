@echo off
chcp 65001 >nul
echo ==========================================
echo EVE Regional Map - Electron 构建脚本
echo ==========================================
echo.

:: 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+
    pause
    exit /b 1
)

echo [1/4] 检查 Node.js 版本...
node --version
echo.

:: 检查 node_modules
if not exist "node_modules\electron" (
    echo [2/4] 安装 Electron 依赖...
    call npm install electron electron-builder --save-dev
    if errorlevel 1 (
        echo [错误] 安装依赖失败
        pause
        exit /b 1
    )
) else (
    echo [2/4] Electron 已安装，跳过
)
echo.

:: 开发模式测试
echo [3/4] 是否先测试开发模式? (Y/N)
set /p testDev=
if /i "%testDev%"=="Y" (
    echo 启动开发模式...
    npm run electron:dev
    goto :end
)
echo.

:: 打包
echo [4/4] 开始打包 Windows 版本...
call npm run electron:build:win
if errorlevel 1 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo ==========================================
echo 打包完成！
echo 输出目录: dist-electron\
echo ==========================================
pause
