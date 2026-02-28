# EVE Regional Map - 开发进度记录

## 当前分支: `feature/supabase`

## 已完成功能

### 1. Supabase 云端同步
- ✅ Supabase 数据库连接和初始化
- ✅ 虫洞数据云端存储（`WormholeRecord` 表）
- ✅ 实时 WebSocket 订阅（多用户同步）
- ✅ 自动刷新（每分钟）
- ✅ 本地与云端数据合并显示
- ✅ **云端虫洞连接地图显示（青色实线）**

### 2. EVE Online SSO 认证
- ✅ PKCE 认证流程实现
- ✅ JWT Token 解析（base64url 支持）
- ✅ 角色公开信息查询（ESI API）
- ✅ 军团和联盟信息查询
- ✅ **联盟 ID 495729389 认证检测**
- ✅ 浏览器和 Electron 双版本支持

### 3. 批量导入功能
- ✅ EVE 游戏数据粘贴解析
- ✅ Tab 分隔符处理
- ✅ HTML 实体解码（`&gt;` → `>`）
- ✅ 反向虫洞自动匹配
- ✅ 时间转换（UTC+0 → 北京时间）

### 4. Electron 桌面应用
- ✅ Electron 主进程配置
- ✅ Preload 脚本安全暴露 API
- ✅ 本地 HTTP 服务器接收回调（端口 9000）
- ✅ 系统浏览器 SSO 流程
- ✅ 应用打包配置（ZIP 格式）

### 5. UI 界面
- ✅ 虫洞记录表格
- ✅ EVE 登录按钮（页面左上角）
- ✅ 认证状态显示（头像 + 角色名 + 联盟标签）
- ✅ 云端同步状态提示

### 6. 安全与配置
- ✅ **密钥外部化配置（config.js，不提交到Git）**
- ✅ **GitHub 历史清理（移除硬编码密钥）**
- ✅ GitGuardian 安全警报修复

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | Vanilla JS + Canvas |
| 后端 | Supabase (PostgreSQL + Realtime) |
| 认证 | EVE SSO (OAuth2 + PKCE) |
| 桌面 | Electron 25 |
| 打包 | electron-builder |

## 地图连接样式

| 连接类型 | 颜色 | 线型 | 标记 |
|----------|------|------|------|
| 星门连接 | 白色 | 实线 | - |
| 外部星门 | 白色 | 虚线 | - |
| **云端虫洞** | **青色 (#00d4ff)** | **实线** | **箭头** |
| EVE Scout | 紫色 (#c084fc) | 虚线 | 箭头 |
| 本地路径 | 蓝色 (#5a8fc7) | 虚线 | 箭头 |
| 有星门路径 | 橙色 (#ffaa00) | 实线 | 箭头 |

## 回调 URL 配置

### EVE Developer 配置
```
http://localhost:9000/callback
```

### 端口分配
| 版本 | 端口 |
|------|------|
| Electron | 9000 |
| 浏览器开发 | 8080 |

## 最近提交

```
82b881b security: 移除硬编码凭证，改用配置文件 - 修复GitGuardian安全警报
a3ca07c docs: 更新进度文档，添加地图连接样式说明
69b21c9 feat: 云端虫洞连接地图显示 - 青色实线样式
1cc921b docs: 添加开发进度记录 PROGRESS.md
...
```

## 安全修复记录

| 日期 | 修复内容 |
|------|----------|
| 2026-02-28 | 移除硬编码 Supabase key 和 EVE Client Secret |
| 2026-02-28 | 创建 config.js 配置文件（.gitignore 排除）|
| 2026-02-28 | 使用 git-filter-repo 清理 GitHub 历史 |
| 2026-02-28 | GitGuardian 安全警报已解决 |

## 待办事项

- [x] **Supabase 云端同步**
- [x] **EVE 联盟认证（495729389）**
- [x] **批量导入虫洞**
- [x] **Electron 桌面应用打包**
- [x] **云端虫洞地图显示**
- [x] **安全修复（密钥外部化）**
- [ ] 重新生成并配置新的 Supabase/EVE 密钥
- [ ] 发布 v1.3.0 正式版本
- [ ] 编写用户文档
- [ ] 测试多用户实时同步稳定性
- [ ] 添加更多 ESI API 支持（实时位置、技能等）

## 构建输出

```
dist-electron/
└── EVE Regional Map-1.2.0-win.zip (121 MB)
```

---

**最后更新**: 2026-02-28  
**当前版本**: v1.2.0（开发中）  
**Git 分支**: feature/supabase
