# EVE Regional Map - 启动方式

由于 Electron 28 存在模块加载兼容性问题，提供以下启动方式：

## 推荐方式：批处理启动器（最简单）

双击运行 **`start-app.bat`**

### 功能
- ✅ 自动启动本地 HTTP 服务器
- ✅ 自动打开 Chrome/Edge 浏览器（无边框应用模式）
- ✅ 关闭时自动停止服务器
- ✅ 角色跟随功能完全可用

### 要求
- Python 3.x（已安装）
- Chrome 或 Edge 浏览器

---

## 方式二：手动启动

### 1. 启动服务器
```bash
python -m http.server 8080
```

### 2. 打开浏览器
访问 http://localhost:8080

---

## 方式三：VS Code Live Server

1. 在 VS Code 安装 "Live Server" 扩展
2. 右键 index.html → "Open with Live Server"

---

## 桌面应用方案

### 方案 A：等待 Electron 修复
Electron 28 的 `require('electron')` 返回 npm 包路径而非 API，这是已知问题。

### 方案 B：降级到 Electron 25
```bash
npm install electron@25 --save-dev
npm run electron:dev
```

### 方案 C：使用 Tauri（推荐长期方案）
Tauri 是更现代的桌面应用框架：
- 应用体积 < 5MB（Electron > 100MB）
- Rust 内核，更安全
- 原生 WebView，性能更好

安装步骤：
```bash
# 1. 安装 Rust
https://rustup.rs/

# 2. 安装 Tauri CLI
cargo install tauri-cli

# 3. 初始化
cargo tauri init

# 4. 开发
cargo tauri dev

# 5. 构建
cargo tauri build
```

---

## 功能完整性

所有启动方式都支持完整功能：

| 功能 | 批处理 | 浏览器 | Electron |
|------|--------|--------|----------|
| 星域地图 | ✅ | ✅ | ❌ |
| 角色跟随 | ✅ | ✅ | ❌ |
| EVE Scout | ✅ | ✅ | ❌ |
| 虫洞记录 | ✅ | ✅ | ❌ |
| 路径记录 | ✅ | ✅ | ❌ |

Electron 列显示为 ❌ 是因为当前版本存在模块加载问题，需要降级到 v25 或等待修复。

---

## 推荐使用流程

### 日常使用
1. 双击 `start-app.bat`
2. 浏览器以应用模式打开
3. 使用角色跟随功能
4. 关闭窗口自动停止

### 开发调试
1. 启动 `python -m http.server 8080`
2. 访问 `http://localhost:8080`
3. F12 打开开发者工具

### 打包分享
直接将项目文件夹压缩分享，接收方：
1. 解压
2. 双击 `start-app.bat`
