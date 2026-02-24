# EVE Regional Map - Electron 环境设置脚本

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "EVE Regional Map - Electron 环境设置" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
try {
    $nodeVersion = node --version
    Write-Host "[✓] Node.js 已安装: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[✗] 未检测到 Node.js，请先安装 Node.js 18+" -ForegroundColor Red
    Write-Host "下载地址: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 检查 npm
try {
    $npmVersion = npm --version
    Write-Host "[✓] npm 已安装: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[✗] 未检测到 npm" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 安装依赖
Write-Host "[1/2] 安装 Electron 依赖..." -ForegroundColor Yellow
npm install electron@^28.0.0 electron-builder@^24.0.0 --save-dev

if ($LASTEXITCODE -ne 0) {
    Write-Host "[✗] 依赖安装失败" -ForegroundColor Red
    exit 1
}

Write-Host "[✓] 依赖安装完成" -ForegroundColor Green
Write-Host ""

# 创建图标目录
if (-not (Test-Path "assets")) {
    New-Item -ItemType Directory -Name "assets" | Out-Null
    Write-Host "[✓] 创建 assets 目录" -ForegroundColor Green
}

# 下载默认图标 (可选)
Write-Host "[2/2] 设置完成！" -ForegroundColor Green
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "接下来你可以运行:" -ForegroundColor White
Write-Host ""
Write-Host "  开发模式:   npm run electron:dev" -ForegroundColor Yellow
Write-Host "  打包 Windows: npm run electron:build:win" -ForegroundColor Yellow
Write-Host "  打包所有:   npm run dist" -ForegroundColor Yellow
Write-Host ""
Write-Host "或使用图形界面: .\build-electron.bat" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

Read-Host "按 Enter 键退出"
