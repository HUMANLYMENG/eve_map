@echo off
chcp 65001 >nul
echo ==========================================
echo EVE Regional Map - 启动器
echo ==========================================
echo.

:: 查找可用端口
set PORT=8080

:: 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请安装 Python 3.x
    pause
    exit /b 1
)

:: 启动 Python HTTP 服务器（后台）
echo [1/3] 启动本地服务器（端口 %PORT%）...
start /B python -m http.server %PORT% >nul 2>&1

:: 等待服务器启动
timeout /t 2 /nobreak >nul

:: 测试服务器是否启动
curl -s http://localhost:%PORT%/ >nul
if errorlevel 1 (
    echo [错误] 服务器启动失败
    pause
    exit /b 1
)

echo [2/3] 服务器已启动
echo.

:: 尝试打开浏览器
set URL=http://localhost:%PORT%/index.html

echo [3/3] 打开浏览器...

:: 尝试 Chrome（应用模式）
start chrome --app=%URL% --disable-features=TranslateUI 2>nul
if not errorlevel 1 goto :success

:: 尝试 Edge（应用模式）
start msedge --app=%URL% 2>nul
if not errorlevel 1 goto :success

:: 尝试默认浏览器
start %URL%

echo [提示] 如果浏览器没有自动打开，请手动访问: %URL%

goto :success

:success
echo.
echo ==========================================
echo 应用已启动！
echo.
echo 功能说明:
echo - 角色跟随: 点击"浏览..."选择 EVE 日志目录
echo - 地图操作: 左键拖动平移，滚轮缩放
@echo - 关闭此窗口将停止服务器
echo ==========================================
echo.
pause

:: 停止服务器
echo.
echo 正在停止服务器...
taskkill /F /IM python.exe >nul 2>&1
echo 已退出。
