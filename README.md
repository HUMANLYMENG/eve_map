# EVE Regional Map

EVE Online 星域地图 - Eveeye 风格的交互式星图

## 项目简介

一个基于 Web 的 EVE Online 星域地图查看器，支持：
- 按星域浏览所有星系
- 显示星系连接关系
- 显示相邻星域的入口星系
- 点击跳转相邻星域

## 在线访问

```bash
cd /Users/ke/Documents/eve-regional-map
python3 -m http.server 8080
```

访问 http://localhost:8080

## 功能特性

### 已实现
- ✅ 星域选择器（113个星域）
- ✅ 2D Canvas 渲染
- ✅ 星系安全等级颜色（高安/低安/00区）
- ✅ 入口星系标记（绿色发光）
- ✅ 相邻星域星系显示
- ✅ 点击相邻星系跳转
- ✅ 鼠标拖拽平移
- ✅ 滚轮缩放
- ✅ 星系信息显示面板

### 交互操作
| 操作 | 功能 |
|------|------|
| 左键拖拽 | 平移地图 |
| 滚轮 | 缩放 |
| 单击 | 选中星系 |
| 双击 | 重置视图 |

## 技术栈

- HTML5 Canvas
- Vanilla JavaScript (ES6+)
- CSS3
- js-yaml (YAML 解析)

## 数据来源

EVE Online Static Data Export (SDE)
- `mapRegions.jsonl`
- `mapConstellations.jsonl`
- `mapSolarSystems.yaml`
- `mapStargates.yaml`

## 项目结构

```
eve-regional-map/
├── index.html              # 主页面
├── css/
│   └── style.css           # 样式
├── js/
│   ├── dataLoader.js       # 数据加载
│   ├── mapRenderer.js      # Canvas 渲染
│   ├── interaction.js      # 交互处理
│   └── main.js             # 应用入口
├── data/                   # EVE 地图数据
│   ├── mapRegions.jsonl
│   ├── mapConstellations.jsonl
│   ├── mapSolarSystems.yaml
│   └── mapStargates.yaml
├── README.md               # 项目说明
├── TODO.md                 # 待办事项
└── CHANGELOG.md            # 更新日志
```

## 开发记录

详见 [CHANGELOG.md](./CHANGELOG.md) 和 [TODO.md](./TODO.md)

## License

数据来源于 CCP Games 的 EVE Online SDE
