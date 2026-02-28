# EVE Regional Map - 便携版打包脚本
# 无需 electron-builder 签名，直接打包未打包版本

$ErrorActionPreference = "Stop"

$sourceDir = "dist-electron\win-unpacked"
$outputDir = "dist-electron"
$appName = "EVE Regional Map"
$version = (Get-Content package.json | ConvertFrom-Json).version

if (-not (Test-Path $sourceDir)) {
    Write-Error "未找到未打包版本: $sourceDir"
    Write-Host "请先运行: npm run electron:build:win"
    exit 1
}

Write-Host "=========================================="
Write-Host "打包便携版"
Write-Host "版本: $version"
Write-Host "=========================================="
Write-Host ""

# 创建 zip 文件
$zipName = "$appName $version Portable.zip"
$zipPath = Join-Path $outputDir $zipName

Write-Host "[1/2] 清理旧文件..."
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Write-Host "[OK] 清理完成"
Write-Host ""

Write-Host "[2/2] 创建 zip 压缩包..."
Compress-Archive -Path "$sourceDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "[OK] 压缩包创建完成"
Write-Host ""

Write-Host "=========================================="
Write-Host "打包完成!"
Write-Host "输出文件: $zipPath"
Write-Host ""
Write-Host "使用方法:"
Write-Host "1. 解压 $zipName 到任意目录"
Write-Host "2. 双击运行 'EVE Regional Map.exe'"
Write-Host "=========================================="
