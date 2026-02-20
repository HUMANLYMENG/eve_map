/**
 * 虫洞记录管理器
 */

import { WormholeRecord } from './wormholeRecord.js';
import { WORMHOLE_TYPES } from '../core/config.js';

export class WormholeManager {
  constructor() {
    this.localRecords = [];    // 本地虫洞记录
    this.eveScoutRecords = []; // EVE Scout 虫洞记录
    this.detectedWormholes = new Set(); // 已检测到的虫洞
    this.filter = 'all';       // 过滤器: 'all' | 'local' | 'evescout'
    this.onUpdate = null;      // 更新回调
  }
  
  /**
   * 添加本地虫洞记录
   */
  addLocalRecord(data) {
    const record = new WormholeRecord({
      ...data,
      source: 'local'
    });
    
    this.localRecords.push(record);
    this._notifyUpdate();
    return record;
  }
  
  /**
   * 设置 EVE Scout 记录
   */
  setEveScoutRecords(records) {
    this.eveScoutRecords = records.map(data => new WormholeRecord(data));
    this._notifyUpdate();
  }
  
  /**
   * 获取过滤后的记录
   */
  getFilteredRecords() {
    switch (this.filter) {
      case 'local':
        return this.localRecords;
      case 'evescout':
        return this.eveScoutRecords;
      case 'all':
      default:
        return this._mergeRecords();
    }
  }
  
  /**
   * 合并本地和 EVE Scout 记录
   */
  _mergeRecords() {
    const merged = [...this.localRecords];
    
    for (const esRecord of this.eveScoutRecords) {
      const isDuplicate = this.localRecords.some(local => 
        local.isSameWormhole(esRecord)
      );
      
      if (!isDuplicate) {
        merged.push(esRecord);
      }
    }
    
    return merged;
  }
  
  /**
   * 删除本地记录
   */
  deleteLocalRecord(id) {
    const index = this.localRecords.findIndex(r => r.id === id);
    if (index !== -1) {
      this.localRecords.splice(index, 1);
      this._notifyUpdate();
      return true;
    }
    return false;
  }
  
  /**
   * 更新本地记录
   */
  updateLocalRecord(id, updates) {
    const record = this.localRecords.find(r => r.id === id);
    if (record) {
      Object.assign(record, updates);
      // 重新计算过期时间
      if (updates.maxLife) {
        const lifeHours = { '1h': 1, '4h': 4, '1d': 24, '2d': 48 };
        record.expiresAt = record.recordTime + (lifeHours[updates.maxLife] || 24) * 60 * 60 * 1000;
      }
      this._notifyUpdate();
      return true;
    }
    return false;
  }
  
  /**
   * 检测新虫洞
   */
  detectWormhole(fromSystem, toSystem) {
    const key = `${fromSystem.id}-${toSystem.id}`;
    const reverseKey = `${toSystem.id}-${fromSystem.id}`;
    
    if (this.detectedWormholes.has(key) || this.detectedWormholes.has(reverseKey)) {
      return null; // 已检测过
    }
    
    this.detectedWormholes.add(key);
    return {
      fromSystem,
      toSystem,
      defaultType: 'K162'
    };
  }
  
  /**
   * 检查连接是否是已知虫洞
   */
  isDetectedWormhole(fromId, toId) {
    const key = `${fromId}-${toId}`;
    const reverseKey = `${toId}-${fromId}`;
    return this.detectedWormholes.has(key) || this.detectedWormholes.has(reverseKey);
  }
  
  /**
   * 设置过滤器
   */
  setFilter(filter) {
    this.filter = filter;
    this._notifyUpdate();
  }
  
  /**
   * 清空所有记录
   */
  clear() {
    this.localRecords = [];
    this.detectedWormholes.clear();
    this._notifyUpdate();
  }
  
  /**
   * 设置更新回调
   */
  onUpdateCallback(callback) {
    this.onUpdate = callback;
  }
  
  /**
   * 通知更新
   */
  _notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate(this.getFilteredRecords());
    }
  }
  
  /**
   * 获取虫洞类型列表
   */
  getWormholeTypes() {
    return WORMHOLE_TYPES;
  }
  
  /**
   * 搜索虫洞类型
   */
  searchTypes(query, limit = 10) {
    const lowerQuery = query.toLowerCase();
    return WORMHOLE_TYPES
      .filter(t => t.toLowerCase().includes(lowerQuery))
      .slice(0, limit);
  }
  
  /**
   * 验证虫洞类型
   */
  isValidType(type) {
    return WORMHOLE_TYPES.includes(type.toUpperCase());
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      local: this.localRecords.length,
      evescout: this.eveScoutRecords.length,
      total: this.getFilteredRecords().length
    };
  }
}
