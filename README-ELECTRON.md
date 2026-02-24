# EVE Regional Map - Electron 桌面版

EVE Online 星域地图的桌面应用版本，支持角色自动跟随功能。

## 功能特性

- 🗺️ **星域地图浏览** - 类似 Eveeye 的交互式星图
- 🔄 **EVE Scout 集成** - 自动同步虫洞数据
- 👤 **角色跟随** - 自动跟踪角色位置，记录跳跃路径
- 🔍 **星系搜索** - 快速定位和跳转
- 📍 **路径记录** - 显示最近访问的星系
- 🌐 **中英文支持** - 支持中英文 EVE 客户端日志

## Electron 版优势

| 功能 | 浏览器版 | Electron 版 |
|------|---------|------------|
| 文件选择 | ⚠️ 需要 Chrome/Edge | ✅ 原生文件对话框 |
| 默认路径 | ❌ 无法自动检测 | ✅ 自动加载默认路径 |
| 文件监控 | ⚠️ 受限 | ✅ 高效原生监控 |
| 编码支持 | ⚠️ UTF-16 LE 可能有问题 | ✅ 完美支持 |
| 离线使用 | ⚠️ 需要本地服务器 | ✅ 完全离线 |
| 自动更新 | ❌ 不支持 | ✅ 支持 |

## 快速开始

### 方法一：使用预构建版本

1. 从 Releases 下载对应平台的安装包
2. 安装并运行
3. 点击"角色跟随"面板的"浏览..."按钮选择 EVE 日志目录
4. 选择角色并开始跟随

### 方法二：从源码构建

#### 环境要求
- Node.js 18+
- Windows/macOS/Linux

#### 步骤

1. **克隆仓库**
```bash
git clone <repository-url>
cd eve_map
```

2. **安装依赖**
```bash
# Windows
.\setup-electron.ps1

# 或手动
npm install electron electron-builder --save-dev
```

3. **运行开发模式**
```bash
npm run electron:dev
```

4. **打包应用**
```bash
# Windows
npm run electron:build:win

# macOS  
npm run electron:build:mac

# Linux
npm run electron:build:linux

# 所有平台
npm run dist
```

打包后的文件位于 `dist-electron/` 目录。

## 使用指南

### 角色跟随设置

1. **设置日志目录**
   - Electron 版会自动检测默认路径 `Documents/EVE/logs/Chatlogs`
   - 如果未自动加载，点击"浏览..."手动选择

2. **选择角色**
   - 从下拉菜单选择要跟随的角色
   - 或点击 🔄 刷新角色列表

3. **开始跟随**
   - 点击"开始跟随"按钮
   - 应用会自动读取 Local 频道日志，跟踪角色位置
   - 路径会自动显示在"路径记录"面板

### 地图操作

- **左键拖动** - 平移地图
- **滚轮** - 缩放
- **单击星系** - 选中并记录到路径
- **双击空白处** - 重置视图
- **Home 键** - 重置视图

### 虫洞记录

- 自动从 EVE Scout 同步虫洞数据
- 支持手动添加本地虫洞记录
- 显示剩余时间和来源标记

## 日志路径

### Windows
```
%USERPROFILE%\Documents\EVE\logs\Chatlogs\
```

### macOS
```
~/Library/Application Support/EVE Online/logs/Chatlogs/
```

### Linux
```
~/.eve/logs/Chatlogs/
```

## 故障排除

### 无法读取日志文件
1. 确认 EVE 客户端已开启 Local 频道日志记录
   - 游戏设置 → 系统设置 → 日志 → 启用 Local 频道日志
2. 检查日志文件是否存在 `Local_*.txt` 文件
3. 确认选择的目录路径正确

### 角色跟随不工作
1. 检查角色名是否正确（区分大小写）
2. 确保在 EVE 客户端中切换了星系（生成新日志条目）
3. 查看日志：Ctrl+Shift+I 打开开发者工具

### 中文系统名显示问题
- Electron 版已自动处理 UTF-16 LE BOM 编码
- 如需手动刷新，点击 🔄 按钮

## 技术栈

- **前端**: Vanilla JS, HTML5 Canvas, CSS3
- **桌面**: Electron 28
- **打包**: electron-builder
- **数据**: js-yaml

## 项目结构

```
eve_map/
├── index.html              # 主页面
├── css/                    # 样式文件
├── js/                     # JavaScript 模块
│   ├── dataLoader.js       # 数据加载
│   ├── mapRenderer.js      # 地图渲染
│   ├── interaction.js      # 交互处理
│   ├── main-legacy.js      # 主应用逻辑
│   └── roleFollowIntegration.js  # 角色跟随
├── data/                   # 星图数据 (YAML)
├── electron/               # Electron 相关
│   ├── main.js            # 主进程
│   └── preload.js         # 预加载脚本
├── assets/                 # 图标资源
└── package.json           # 项目配置
```

## 许可证

MIT License

## 致谢

- EVE Online © CCP Games
- 星图数据来源于 EVE Online
- 虫洞数据来源于 EVE Scout
