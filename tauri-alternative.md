# Electron 构建问题说明

## 当前问题

Electron 28/26 存在模块加载问题：`require('electron')` 返回 npm 包路径而非 API。

## 替代方案：使用浏览器 + 批处理脚本

创建一个简单的 Windows 批处理脚本，自动启动本地服务器并打开浏览器：

```batch
@echo off
chcp 65001 >nul
echo 启动 EVE Regional Map...
echo.

:: 查找可用端口
set PORT=8080

:: 启动 Python HTTP 服务器（后台）
start /B python -m http.server %PORT% >nul 2>&1

:: 等待服务器启动
timeout /t 2 /nobreak >nul

:: 打开 Chrome/Edge 浏览器
start chrome http://localhost:%PORT%/index.html --app=http://localhost:%PORT%/index.html

:: 如果 Chrome 不存在，尝试 Edge
if errorlevel 1 (
    start msedge http://localhost:%PORT%/index.html --app=http://localhost:%PORT%/index.html
)

echo 应用已启动，请勿关闭此窗口...
pause

:: 停止服务器
taskkill /F /IM python.exe >nul 2>&1
```

## 更好的替代方案：使用 Tauri

Tauri 是一个更现代的桌面应用框架：

1. **更轻量**：应用体积 < 5MB（Electron 通常 > 100MB）
2. **更安全**：使用 Rust 内核，内存安全
3. **更好的系统 API 访问**：文件系统、通知等
4. **更好的性能**：使用系统原生 WebView

### 快速开始 Tauri

```bash
# 安装 Rust（如果还没有）
https://rustup.rs/

# 安装 Tauri CLI
cargo install tauri-cli

# 在项目中初始化 Tauri
cargo tauri init

# 开发模式
cargo tauri dev

# 构建发布版本
cargo tauri build
```

需要我帮你配置 Tauri 版本吗？

## 最简单的解决方案

继续使用浏览器版本，配合此批处理脚本（已创建 `start-app.bat`）：

双击 `start-app.bat` 即可：
1. 自动启动本地服务器
2. 打开 Chrome/Edge 浏览器（无边框应用模式）
3. 关闭时自动停止服务器
