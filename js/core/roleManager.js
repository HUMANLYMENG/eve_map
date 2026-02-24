/**
 * @fileoverview 角色管理器 - 支持中英文客户端
 * 管理 EVE Online 角色，监控其所在星系变化
 */

import { LogParser } from './logParser.js';
import { SystemNameResolver } from '../data/systemNameResolver.js';

/**
 * 角色信息类
 */
export class RoleInfo {
  constructor(name, fileHandle = null) {
    this.name = name;
    this.fileHandle = fileHandle;
    this.currentSystem = null;
    this.isChineseClient = false;
    this.lastUpdateTime = null;
  }
}

/**
 * 角色管理器类
 */
export class RoleManager {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
    this.roles = new Map(); // roleName -> RoleInfo
    this.parser = new LogParser();
    this.nameResolver = new SystemNameResolver();
    this.systemChangeCallbacks = [];
    this.isWatching = false;
    this.watchIntervals = new Map();
  }

  /**
   * 扫描目录获取角色列表（支持模拟文件列表）
   * @param {Array|FileSystemDirectoryHandle} source - 文件列表或目录句柄
   * @returns {Promise<Array>} - 角色信息数组
   */
  async scanRoles(source) {
    const roles = [];
    
    // 如果是数组（模拟文件列表）
    if (Array.isArray(source)) {
      for (const file of source) {
        if (this.isValidLogFile(file.name)) {
          // 为模拟文件创建一个模拟的 fileHandle
          const mockHandle = {
            name: file.name,
            kind: 'file',
            content: file.content
          };
          const roleInfo = await this.extractRoleInfo(mockHandle);
          if (roleInfo) {
            roles.push(roleInfo);
          }
        }
      }
    }
    // 如果是 FileSystemDirectoryHandle（真实文件系统）
    else if (source && typeof source.entries === 'function') {
      for await (const [name, handle] of source.entries()) {
        if (handle.kind === 'file' && this.isValidLogFile(name)) {
          const roleInfo = await this.extractRoleInfo(handle);
          if (roleInfo) {
            roles.push(roleInfo);
          }
        }
      }
    }
    
    return roles;
  }

  /**
   * 检查是否是有效的本地频道日志文件
   * @param {string} filename - 文件名
   * @returns {boolean} - 是否有效
   */
  isValidLogFile(filename) {
    if (!filename || !filename.endsWith('.txt')) {
      return false;
    }
    // 匹配 Local_*.txt 或 本地_*.txt（中英文客户端）
    return /^(Local|本地)_.+\.txt$/i.test(filename);
  }

  /**
   * 从文件句柄提取角色信息
   * @param {FileSystemFileHandle} fileHandle - 文件句柄
   * @returns {Promise<Object|null>} - 角色信息
   */
  async extractRoleInfo(fileHandle) {
    try {
      let content;
      // 处理模拟文件句柄（用于测试）
      if (fileHandle.content) {
        content = fileHandle.content;
      } else {
        // 处理真实文件句柄
        const file = await fileHandle.getFile();
        content = await file.text();
      }
      return this.extractRoleInfoFromContent(content, fileHandle);
    } catch (e) {
      console.error('[RoleManager] 读取文件失败:', e);
      return null;
    }
  }

  /**
   * 从文件对象提取角色信息（用于测试）
   * @param {Object} fileObj - 文件对象
   * @returns {Promise<Object|null>} - 角色信息
   */
  async extractRoleInfoFromFile(fileObj) {
    // 模拟文件读取
    if (fileObj.content) {
      return this.extractRoleInfoFromContent(fileObj.content, fileObj);
    }
    return null;
  }

  /**
   * 从内容提取角色信息
   * @param {string} content - 日志内容
   * @param {Object} fileHandle - 文件句柄
   * @returns {Object|null} - 角色信息
   */
  extractRoleInfoFromContent(content, fileHandle = null) {
    const lines = content.split(/\r?\n/);
    
    for (const line of lines) {
      const parsed = this.parser.parseLine(line);
      if (parsed && parsed.type === 'listener') {
        const isChineseClient = this.parser.detectChineseClient(content);
        return {
          name: parsed.role,
          fileHandle: fileHandle,
          fileName: fileHandle?.name || 'unknown',
          isChineseClient: isChineseClient
        };
      }
    }
    
    return null;
  }

  /**
   * 检测是否是中文客户端日志
   * @param {string} content - 日志内容
   * @returns {boolean} - 是否是中文客户端
   */
  detectChineseClient(content) {
    return this.parser.detectChineseClient(content);
  }

  /**
   * 添加角色
   * @param {string} name - 角色名
   * @param {Object} fileHandle - 文件句柄
   * @param {boolean} isChineseClient - 是否是中文客户端
   */
  addRole(name, fileHandle = null, isChineseClient = false) {
    const roleInfo = new RoleInfo(name, fileHandle);
    roleInfo.isChineseClient = isChineseClient;
    this.roles.set(name, roleInfo);
    return roleInfo;
  }

  /**
   * 获取角色信息
   * @param {string} name - 角色名
   * @returns {RoleInfo|null} - 角色信息
   */
  getRole(name) {
    return this.roles.get(name) || null;
  }

  /**
   * 移除角色
   * @param {string} name - 角色名
   */
  removeRole(name) {
    // 停止监控
    this.stopWatching(name);
    this.roles.delete(name);
  }

  /**
   * 解析日志内容获取当前星系
   * @param {string} content - 日志内容
   * @returns {Object|null} - 解析结果
   */
  async parseCurrentSystem(content) {
    const lines = content.split(/\r?\n/);
    
    // 从后向前查找最后一条星系变化记录
    for (let i = lines.length - 1; i >= 0; i--) {
      const parsed = this.parser.parseLine(lines[i]);
      if (parsed && parsed.type === 'system_change') {
        const systemName = parsed.system;
        
        // 查找星系数据
        const system = this.findSystem(systemName);
        
        // 如果找不到星系数据，返回 null
        if (!system) {
          return null;
        }
        
        return {
          original: systemName,
          resolved: this.nameResolver.resolve(systemName),
          system: system
        };
      }
    }
    
    return null;
  }

  /**
   * 查找星系（支持中英文）
   * @param {string} name - 星系名称
   * @returns {Object|null} - 星系数据
   */
  findSystem(name) {
    if (!name || !this.dataLoader) return null;
    
    // 直接查找
    let system = this.dataLoader.systemsByName?.get(name);
    if (system) return system;
    
    // 解析后的名称查找
    const resolvedName = this.nameResolver.resolve(name);
    system = this.dataLoader.systemsByName?.get(resolvedName);
    if (system) return system;
    
    // 小写查找
    const lower = name.toLowerCase();
    for (const [sysName, sysData] of this.dataLoader.systemsByName || []) {
      if (sysName.toLowerCase() === lower) {
        return sysData;
      }
    }
    
    return null;
  }

  /**
   * 获取角色的当前星系
   * @param {string} roleName - 角色名
   * @returns {Promise<Object|null>} - 当前星系信息
   */
  async getCurrentSystem(roleName) {
    const role = this.roles.get(roleName);
    if (!role || !role.fileHandle) return null;
    
    try {
      const file = await role.fileHandle.getFile();
      const content = await file.text();
      return this.parseCurrentSystem(content);
    } catch (e) {
      console.error('[RoleManager] 获取当前星系失败:', e);
      return null;
    }
  }

  /**
   * 注册星系变化回调
   * @param {Function} callback - 回调函数 (roleName, system) => void
   */
  onSystemChange(callback) {
    if (typeof callback === 'function') {
      this.systemChangeCallbacks.push(callback);
    }
  }

  /**
   * 触发星系变化通知
   * @param {string} roleName - 角色名
   * @param {Object|string} system - 星系数据或星系名称
   */
  notifySystemChange(roleName, system) {
    // 如果传入的是字符串（星系名），查找对应的星系对象
    let systemData = system;
    if (typeof system === 'string') {
      systemData = this.findSystem(system);
      if (!systemData) {
        console.warn(`[RoleManager] 找不到星系: ${system}`);
        return;
      }
    }
    
    for (const callback of this.systemChangeCallbacks) {
      try {
        callback(roleName, systemData);
      } catch (e) {
        console.error('[RoleManager] 回调执行失败:', e);
      }
    }
  }

  /**
   * 开始监控角色（模拟实现，实际使用 File System Access API）
   * @param {string} roleName - 角色名
   * @param {number} interval - 检查间隔（毫秒）
   */
  startWatching(roleName, interval = 1000) {
    const role = this.roles.get(roleName);
    if (!role) return;
    
    // 停止已有监控
    this.stopWatching(roleName);
    
    let lastSystem = role.currentSystem;
    
    // 使用 setInterval 模拟文件监控
    const timer = setInterval(async () => {
      try {
        const result = await this.getCurrentSystem(roleName);
        if (result && result.system) {
          const systemId = result.system.id;
          
          // 星系发生变化
          if (lastSystem !== systemId) {
            lastSystem = systemId;
            role.currentSystem = systemId;
            role.lastUpdateTime = new Date();
            
            this.notifySystemChange(roleName, result.system);
          }
        }
      } catch (e) {
        console.error('[RoleManager] 监控失败:', e);
      }
    }, interval);
    
    this.watchIntervals.set(roleName, timer);
    this.isWatching = true;
  }

  /**
   * 停止监控角色
   * @param {string} roleName - 角色名
   */
  stopWatching(roleName) {
    const timer = this.watchIntervals.get(roleName);
    if (timer) {
      clearInterval(timer);
      this.watchIntervals.delete(roleName);
    }
    
    // 检查是否还有监控中的角色
    if (this.watchIntervals.size === 0) {
      this.isWatching = false;
    }
  }

  /**
   * 停止所有监控
   */
  stopAllWatching() {
    for (const [roleName, timer] of this.watchIntervals) {
      clearInterval(timer);
    }
    this.watchIntervals.clear();
    this.isWatching = false;
  }

  /**
   * 获取所有角色列表
   * @returns {Array} - 角色信息数组
   */
  getAllRoles() {
    return Array.from(this.roles.values());
  }

  /**
   * 清空所有角色
   */
  clear() {
    this.stopAllWatching();
    this.roles.clear();
  }
}

// 默认导出
export default RoleManager;
