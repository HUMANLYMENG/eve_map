@echo off
chcp 65001 >nul
echo ==========================================
echo Electron 离线/半离线安装脚本
echo ==========================================
echo.

:: 设置淘宝镜像加速
echo [1/3] 配置 npm 镜像...
call npm config set registry https://registry.npmmirror.com
call npm config set ELECTRON_MIRROR https://npmmirror.com/mirrors/electron/
echo [OK] 镜像配置完成
echo.

:: 清理可能损坏的安装
echo [2/3] 清理旧文件...
if exist "node_modules\electron" (
    rmdir /s /q "node_modules\electron" 2>nul
)
if exist "node_modules\.electron-*" (
    rmdir /s /q "node_modules\.electron-*" 2>nul
)
echo [OK] 清理完成
echo.

:: 分步安装
echo [3/3] 安装 Electron (这可能需要几分钟)...
echo 如果卡住超过5分钟，请按 Ctrl+C 取消后重试
echo.

call npm install electron@28.0.0 --save-dev --verbose

if errorlevel 1 (
    echo.
    echo [错误] 安装失败，尝试备用方案...
    echo.
    echo 请手动下载 Electron:
    echo 1. 访问 https://github.com/electron/electron/releases/tag/v28.0.0
    echo 2. 下载 electron-v28.0.0-win32-x64.zip
    echo 3. 解压到 node_modules\electron\dist\
    echo.
    pause
    exit /b 1
)

echo.
echo [4/4] 安装 electron-builder...
call npm install electron-builder@^24.0.0 --save-dev

if errorlevel 1 (
    echo [警告] electron-builder 安装失败，但 electron 已成功
    echo 可以尝试再次运行此脚本
    pause
    exit /b 1
)

echo.
echo ==========================================
echo 安装完成！
echo 运行 npm run electron:dev 测试
echo ==========================================
pause
