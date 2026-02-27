/**
 * EVE Regional Map - Electron 主进程
 * 兼容 Electron 25
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// 保持窗口对象的全局引用
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
      preload: path.join(__dirname, 'electron', 'preload.cjs')
    },
    title: 'EVE Regional Map'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (process.argv.includes('--dev')) {
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

// 读取 EVE 日志文件（支持 UTF-16 LE BOM）
async function readEveLogFile(filePath) {
  const buffer = await fs.readFile(filePath);
  
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return buffer.toString('utf16le', 2);
  } else if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.toString('utf8', 3);
  } else {
    try {
      const utf16Content = buffer.toString('utf16le');
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

// IPC 处理
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

ipcMain.handle('get-default-log-path', () => {
  return getDefaultLogPath();
});

ipcMain.handle('path-exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('scan-log-directory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const logFiles = [];
    
    for (const entry of entries) {
      if (entry.isFile() && /^(Local|本地)_.+\.txt$/i.test(entry.name)) {
        const filePath = path.join(dirPath, entry.name);
        try {
          const stats = await fs.stat(filePath);
          const content = await readEveLogFile(filePath);
          logFiles.push({
            name: entry.name,
            path: filePath,
            content: content,
            mtime: stats.mtime.getTime()
          });
        } catch (err) {
          console.warn(`[Main] 读取文件失败: ${entry.name}`, err.message);
        }
      }
    }
    
    // 按修改时间排序（最新的在前）
    logFiles.sort((a, b) => b.mtime - a.mtime);
    
    return { success: true, files: logFiles };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-log-file', async (event, filePath) => {
  try {
    const content = await readEveLogFile(filePath);
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('start-watching', async (event, dirPath, roleName) => {
  let lastSystemName = null;
  
  const watchInterval = setInterval(async () => {
    if (!mainWindow) {
      clearInterval(watchInterval);
      return;
    }
    
    try {
      // 获取所有文件并按修改时间排序
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const fileEntries = [];
      
      for (const entry of entries) {
        if (entry.isFile() && /^(Local|本地)_.+\.txt$/i.test(entry.name)) {
          const filePath = path.join(dirPath, entry.name);
          const stats = await fs.stat(filePath);
          fileEntries.push({
            name: entry.name,
            path: filePath,
            mtime: stats.mtime
          });
        }
      }
      
      // 按修改时间排序（最新的在前）
      fileEntries.sort((a, b) => b.mtime - a.mtime);
      
      // 找该角色的最新文件
      let latestContent = null;
      for (const fileEntry of fileEntries) {
        const content = await readEveLogFile(fileEntry.path);
        const listenerMatch = content.match(/Listener:\s*(.+)/);
        if (listenerMatch && listenerMatch[1].trim() === roleName) {
          latestContent = content;
          break;
        }
      }
      
      if (!latestContent) return;
      
      // 解析最新星系
      const lines = latestContent.split(/\r?\n/);
      for (let i = lines.length - 1; i >= 0; i--) {
        const systemMatch = lines[i].match(/Channel changed to Local\s*[:：]\s*(.+)/i) ||
                           lines[i].match(/频道更换为本地\s*[:：]\s*(.+)/);
        if (systemMatch) {
          const systemName = systemMatch[1].trim().replace(/\*$/, '').replace(/^：/, '');
          
          // 只有星系变化时才发送事件
          if (systemName !== lastSystemName) {
            console.log('[Main] 检测到星系变化:', lastSystemName, '->', systemName);
            lastSystemName = systemName;
            if (mainWindow && !mainWindow.isDestroyed()) {
              console.log('[Main] 发送 system-change 事件到渲染进程');
              mainWindow.webContents.send('system-change', {
                roleName,
                systemName,
                timestamp: Date.now()
              });
            } else {
              console.warn('[Main] mainWindow 不可用，无法发送事件');
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('[Main] 监控文件变化失败:', err);
    }
  }, 1000);
  
  const watchId = Date.now().toString();
  global.watchIntervals = global.watchIntervals || {};
  global.watchIntervals[watchId] = watchInterval;
  
  return { success: true, watchId };
});

ipcMain.handle('stop-watching', async (event, watchId) => {
  if (global.watchIntervals && global.watchIntervals[watchId]) {
    clearInterval(global.watchIntervals[watchId]);
    delete global.watchIntervals[watchId];
  }
  return { success: true };
});
