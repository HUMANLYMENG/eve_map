# 重构说明

## 概述

本项目已重构为模块化架构，使用 ES6 模块系统。

## 文件结构

```
js/
├── core/           # 核心工具模块
├── data/           # 数据管理模块
├── renderer/       # 渲染模块
├── features/       # 业务功能模块
├── interaction/    # 交互模块
├── ui/             # UI 组件
├── app.js          # 应用主类
└── main.js         # 入口文件
```

## 测试指南

### 1. 启动本地服务器

```bash
cd /Users/ke/Documents/eve-regional-map
python3 -m http.server 8080
```

### 2. 访问测试页面

打开浏览器访问: `http://localhost:8080/test.html`

### 3. 运行测试

点击测试面板中的按钮:
- **运行单元测试** - 运行所有测试
- **测试核心模块** - 测试 core/ 模块
- **测试数据模块** - 测试 data/ 模块
- **测试功能模块** - 测试 features/ 模块

### 4. 对比测试

访问原版: `http://localhost:8080/index.html`
访问新版: `http://localhost:8080/test.html`

## 模块依赖图

```
main.js
  └── app.js
       ├── data/
       │    ├── loader.js
       │    ├── systems.js
       │    ├── regions.js
       │    ├── connections.js
       │    └── regionDataBuilder.js
       ├── renderer/
       │    ├── viewport.js
       │    └── layers/
       │         ├── background.js
       │         ├── connections.js
       │         ├── systems.js
       │         ├── paths.js
       │         └── labels.js
       ├── features/
       │    ├── wormholeManager.js
       │    ├── pathManager.js
       │    └── searchManager.js
       ├── interaction/
       │    └── interaction.js
       └── ui/
            └── toast.js
```

## 回滚方法

如需回滚到旧版本，修改 `index.html`:

```html
<!-- 旧版引用 -->
<script src="js/dataLoader.js?v=90"></script>
<script src="js/mapRenderer.js?v=90"></script>
<script src="js/interaction.js?v=90"></script>
<script src="js/eveScoutService.js?v=90"></script>
<script src="js/main.js?v=90"></script>

<!-- 新版引用 (ES6 模块) -->
<script type="module" src="js/main.js"></script>
```

## 已知问题

1. **需要本地服务器**: ES6 模块不能通过 `file://` 协议加载
2. **浏览器兼容性**: 需要现代浏览器（Chrome 60+, Firefox 60+, Safari 12+）
3. **EVE Scout 服务**: 需要确保 `eveScoutService.js` 也在新架构中正常工作

## 后续优化

- [ ] 引入 Vite 构建工具
- [ ] 添加完整的错误处理
- [ ] 性能优化（数据懒加载）
- [ ] TypeScript 迁移
