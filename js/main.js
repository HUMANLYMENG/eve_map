/**
 * 应用程序入口
 */

import { RegionalMapApp } from './app.js';

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new RegionalMapApp();
  window.app.init();
});

// 导出全局访问（用于调试）
export { RegionalMapApp };
