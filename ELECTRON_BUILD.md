# EVE Regional Map - Electron 打包说明

## 环境要求

- Node.js 18+ 
- npm 或 yarn

## 安装依赖

```bash
npm install
```

## 运行开发模式

```bash
npm run electron:dev
```

## 打包应用

### Windows (NSIS 安装包 + 便携版)
```bash
npm run electron:build:win
```

### macOS (DMG + ZIP)
```bash
npm run electron:build:mac
```

### Linux (AppImage + DEB)
```bash
npm run electron:build:linux
```

### 所有平台
```bash
npm run dist
```

## 输出目录

打包后的文件位于 `dist-electron/` 目录：

- Windows: `EVE Regional Map Setup.exe`, `EVE Regional Map.exe` (便携版)
- macOS: `EVE Regional Map.dmg`, `EVE Regional Map-mac.zip`
- Linux: `EVE Regional Map.AppImage`, `eve-regional-map.deb`

## Electron 特性

相比浏览器版本，Electron 版本具有以下优势：

1. **自动检测默认日志路径** - 启动时自动尝试加载 `Documents/EVE/logs/Chatlogs`
2. **原生文件对话框** - 使用系统文件选择器，支持记住上次路径
3. **更好的文件监控** - 使用 Node.js 高效监控日志文件变化
4. **UTF-16 LE BOM 支持** - 完美支持 EVE 中文客户端日志编码
5. **离线运行** - 无需联网，所有数据本地加载
6. **跨平台** - 支持 Windows、macOS、Linux

## 注意事项

- Windows 上首次运行可能需要允许防火墙访问（用于自动更新检查，可选）
- 如果需要自定义图标，请替换 `assets/` 目录下的图标文件：
  - Windows: `icon.ico` (256x256)
  - macOS: `icon.icns` (512x512)
  - Linux: `icon.png` (512x512)

## 故障排除

### 打包失败
1. 确保已安装所有依赖: `npm install`
2. 清理缓存: `npm run build` 然后重新打包

### 无法读取日志文件
1. 检查 EVE 日志目录路径是否正确
2. 确保 EVE 客户端已生成 Local_*.txt 日志文件
3. 检查文件权限

### 角色跟随不工作
1. 确认已选择正确的角色
2. 检查是否在 EVE 客户端中切换了星系（生成新的日志记录）
3. 查看控制台日志 (Ctrl+Shift+I) 获取错误信息
