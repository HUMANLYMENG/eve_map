# EVE Regional Map - 待办事项

## 已完成 ✅

### 模块化重构
- [x] 将 main.js 拆分为 ES6 模块
  - core/: config, eventBus, utils
  - data/: loader, systems, regions, connections, regionDataBuilder
  - renderer/: viewport, layers (background, connections, systems, paths, labels)
  - features/: pathManager, pathRecorder, wormholeManager, searchManager
  - ui/: toast
  - interaction/: interaction handlers
- [x] 保持原始 index.html 可用（创建 main-legacy.js）

### EVE Scout 集成
- [x] 从 EVE Scout API 获取虫洞数据
- [x] 显示 Ther a/Turnur 虫洞连接到星图（紫色虚线）
- [x] 在 Ther a/Turnur 视图显示连接的星系（K-Space 和 J-Space）
- [x] 外部星系定位算法，避免重叠

### Bug 修复
- [x] 外部路径系统定位算法改进（基于锚点）
- [x] 视口重置问题（从虫洞返回普通星域）
- [x] 虫洞过滤器标签功能

## 待修复 🔧

### EVE Scout 星系名称中文转换
- [ ] Ther a 显示为 "席拉"（目前显示为英文 "Thera"）
- [ ] Turnur 显示为 "图尔鲁尔"（目前显示为英文 "Turnur"）
- [ ] 其他星系名称转换为中文

**问题分析：**
- 之前的修改导致了匹配逻辑失效
- 需要在 `eveScoutService.js` 中正确转换星系名称
- 同时保持 `app.js` 中的匹配逻辑正常工作

**建议方案：**
1. 保留英文匹配逻辑（'thera', 'turnur'）
2. 在 `convertToWormholeRecord` 中转换名称为中文
3. 在 `app.js` 中只使用英文进行匹配，但显示中文名称

## 测试页面

- test-complete.html: 完整功能测试（模块化版本）
- index.html: 原始版本（使用 main-legacy.js）

## 访问地址

- http://localhost:8080/test-complete.html (新模块化版本)
- http://localhost:8080/index.html (原始版本)
