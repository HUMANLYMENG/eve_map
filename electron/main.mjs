/**
 * EVE Regional Map - Electron 主进程 (ESM 格式)
 * Electron 内置模块通过 import 加载
 */

// Electron 内置模块
import electron from 'electron';
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const dialog = electron.dialog;

import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 保持窗口对象的全局引用，防止被垃圾回收
let mainWindow = null;

// 默认 EVE 日志路径
const DEFAULT_LOG_PATHS = {
  win32: path.join(os.homedir(), 'Documents', 'EVE', 'logs', 'Chatlogs'),
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'EVE Online', 'logs', 'Chatlogs'),
  linux: path.join(os.homedir(), '.eve', 'logs', 'Chatlogs')
};

function getDefaultLogPath() {
  return DEFAULT_LOG_PATHS[process.platform] || DEFAULT_LOG_PATHS.win32;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.mjs')
    },
    title: 'EVE Regional Map',
    icon: path.join(__dirname, '..', 'assets', 'icon.png')
  });

  // 加载应用
  const isDev = process.argv.includes('--dev');
  
  // 加载 index.html
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用生命周期
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC 处理 - 选择目录
ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return { canceled: true };
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择 EVE 日志目录',
    defaultPath: getDefaultLogPath()
  });
  
  return {
    canceled: result.canceled,
    filePaths: result.filePaths
  };
});

// IPC 处理 - 获取默认日志路径
ipcMain.handle('get-default-log-path', () => {
  return getDefaultLogPath();
});

// IPC 处理 - 检查路径是否存在
ipcMain.handle('path-exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// IPC 处理 - 扫描目录中的日志文件
ipcMain.handle('scan-log-directory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const logFiles = [];
    
    for (const entry of entries) {
      // 匹配 Local_*.txt 和 本地_*.txt
      if (entry.isFile() && /^(Local|本地)_.+\.txt$/i.test(entry.name)) {
        const filePath = path.join(dirPath, entry.name);
        try {
          const content = await readEveLogFile(filePath);
          logFiles.push({
            name: entry.name,
            path: filePath,
            content: content
          });
        } catch (err) {
          console.warn(`[Main] 读取文件失败: ${entry.name}`, err.message);
        }
      }
    }
    
    return { success: true, files: logFiles };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC 处理 - 读取日志文件内容
ipcMain.handle('read-log-file', async (event, filePath) => {
  try {
    const content = await readEveLogFile(filePath);
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC 处理 - 开始监控目录变化
ipcMain.handle('start-watching', async (event, dirPath, roleName) => {
  // 使用简单的轮询方式监控文件变化
  const watchInterval = setInterval(async () => {
    if (!mainWindow) {
      clearInterval(watchInterval);
      return;
    }
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && /^(Local|本地)_.+\.txt$/i.test(entry.name)) {
          const filePath = path.join(dirPath, entry.name);
          const content = await readEveLogFile(filePath);
          
          // 提取角色名
          const listenerMatch = content.match(/Listener:\s*(.+)/);
          if (listenerMatch && listenerMatch[1].trim() === roleName) {
            // 找到最后一条星系变化记录
            const lines = content.split(/\r?\n/);
            for (let i = lines.length - 1; i >= 0; i--) {
              const systemMatch = lines[i].match(/Channel changed to Local\s*:\s*(.+)/i) ||
                                 lines[i].match(/频道更换为本地\s*:\s*(.+)/);
              if (systemMatch) {
                const systemName = systemMatch[1].trim().replace(/\*$/, '');
                mainWindow.webContents.send('system-change', {
                  roleName,
                  systemName,
                  timestamp: Date.now()
                });
                break;
              }
            }
            break;
          }
        }
      }
    } catch (err) {
      console.error('[Main] 监控文件变化失败:', err);
    }
  }, 1000);
  
  // 返回一个 watch ID，用于停止监控
  const watchId = Date.now().toString();
  
  // 存储 interval 以便后续清理
  global.watchIntervals = global.watchIntervals || {};
  global.watchIntervals[watchId] = watchInterval;
  
  return { success: true, watchId };
});

// IPC 处理 - 停止监控
ipcMain.handle('stop-watching', async (event, watchId) => {
  if (global.watchIntervals && global.watchIntervals[watchId]) {
    clearInterval(global.watchIntervals[watchId]);
    delete global.watchIntervals[watchId];
  }
  return { success: true };
});

/**
 * 读取 EVE 日志文件（支持 UTF-16 LE BOM）
 */
async function readEveLogFile(filePath) {
  const buffer = await fs.readFile(filePath);
  
  // 检测 BOM
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    // UTF-16 LE with BOM
    return buffer.toString('utf16le', 2);
  } else if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    // UTF-8 with BOM
    return buffer.toString('utf8', 3);
  } else {
    // 尝试 UTF-16 LE（无 BOM）或 UTF-8
    try {
      // 先尝试 UTF-16 LE
      const utf16Content = buffer.toString('utf16le');
      // 如果包含大量空字符，可能是 UTF-8
      const nullCount = (utf16Content.match(/\x00/g) || []).length;
      if (nullCount > utf16Content.length * 0.1) {
        return buffer.toString('utf8');
      }
      return utf16Content;
    } catch {
      return buffer.toString('utf8');
    }
  }
}
