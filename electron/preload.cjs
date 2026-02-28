/**
 * EVE Regional Map - Electron 预加载脚本
 * 安全地暴露主进程 API 给渲染进程
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 选择目录
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // 获取默认日志路径
  getDefaultLogPath: () => ipcRenderer.invoke('get-default-log-path'),
  
  // 检查路径是否存在
  pathExists: (filePath) => ipcRenderer.invoke('path-exists', filePath),
  
  // 扫描日志目录
  scanLogDirectory: (dirPath) => ipcRenderer.invoke('scan-log-directory', dirPath),
  
  // 读取日志文件
  readLogFile: (filePath) => ipcRenderer.invoke('read-log-file', filePath),
  
  // 开始监控文件变化
  startWatching: (dirPath, roleName) => ipcRenderer.invoke('start-watching', dirPath, roleName),
  
  // 停止监控
  stopWatching: (watchId) => ipcRenderer.invoke('stop-watching', watchId),
  
  // 监听星系变化事件
  onSystemChange: (callback) => {
    ipcRenderer.on('system-change', (event, data) => callback(data));
  },
  
  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // 检查是否在 Electron 环境中运行
  isElectron: true,
  
  // EVE SSO 认证
  startEveAuth: (authUrl) => ipcRenderer.invoke('start-eve-auth', authUrl),
  onEveAuthCallback: (callback) => {
    ipcRenderer.on('eve-auth-callback', (event, data) => callback(data));
  }
});

// 为了兼容性，也暴露一个 nodeModules 对象
contextBridge.exposeInMainWorld('nodeModules', {
  isElectron: true
});
