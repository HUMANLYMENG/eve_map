/**
 * 星系数据管理模块
 */

import { getSecurityClass } from '../core/utils.js';

export class SystemsManager {
  constructor() {
    this.systems = new Map();      // K-Space 星系
    this.wormholeSystems = new Map(); // 虫洞星系 (J-space)
  }
  
  /**
   * 处理星系数据
   */
  process(systemsData) {
    console.log('[SystemsManager] 处理星系数据');
    
    for (const [idStr, raw] of Object.entries(systemsData)) {
      const id = parseInt(idStr);
      const system = this._createSystem(id, raw);
      
      if (id >= 31000000) {
        this.wormholeSystems.set(id, system);
      } else {
        this.systems.set(id, system);
      }
    }
    
    console.log(`[SystemsManager] 加载了 ${this.systems.size} 个K-Space星系, ${this.wormholeSystems.size} 个虫洞星系`);
  }
  
  /**
   * 创建系统对象
   */
  _createSystem(id, raw) {
    const pos2D = raw.position2D || { x: 0, y: 0 };
    
    return {
      id,
      name: raw.name?.zh || raw.name?.en || `System ${id}`,
      nameEn: raw.name?.en || '',
      constellationID: raw.constellationID,
      regionID: raw.regionID,
      securityStatus: raw.securityStatus ?? 0,
      securityClass: getSecurityClass(raw.securityStatus),
      position2D: { x: pos2D.x, y: pos2D.y },
      stargateIDs: raw.stargateIDs || [],
      isBorder: raw.border || false,
      isHub: raw.hub || false,
      isRegional: raw.regional || false,
      isInternational: raw.international || false,
      borderConnections: [],
      isWormhole: id >= 31000000
    };
  }
  
  /**
   * 获取星系
   */
  get(id) {
    return this.systems.get(id) || this.wormholeSystems.get(id);
  }
  
  /**
   * 获取 K-Space 星系
   */
  getKSpace(id) {
    return this.systems.get(id);
  }
  
  /**
   * 获取虫洞星系
   */
  getWormhole(id) {
    return this.wormholeSystems.get(id);
  }
  
  /**
   * 获取所有 K-Space 星系
   */
  getAllKSpace() {
    return Array.from(this.systems.values());
  }
  
  /**
   * 搜索星系
   */
  search(query, limit = 20) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    // 搜索 K-Space
    for (const system of this.systems.values()) {
      if (results.length >= limit) break;
      
      if (this._matchesQuery(system, lowerQuery)) {
        results.push(system);
      }
    }
    
    // 搜索虫洞
    for (const system of this.wormholeSystems.values()) {
      if (results.length >= limit) break;
      
      if (this._matchesQuery(system, lowerQuery)) {
        results.push({ ...system, isWormhole: true });
      }
    }
    
    return results;
  }
  
  /**
   * 检查是否匹配搜索
   */
  _matchesQuery(system, lowerQuery) {
    const nameMatch = system.name.toLowerCase().includes(lowerQuery);
    const nameEnMatch = system.nameEn && system.nameEn.toLowerCase().includes(lowerQuery);
    return nameMatch || nameEnMatch;
  }
  
  /**
   * 获取某星域的所有星系
   */
  getByRegion(regionId) {
    return this.getAllKSpace().filter(s => s.regionID === regionId);
  }
  
  /**
   * 获取虫洞星域数据
   */
  getWormholeRegionData(targetSystemId) {
    const wormholeSystem = this.wormholeSystems.get(targetSystemId);
    if (!wormholeSystem) return null;
    
    return {
      region: {
        id: `wormhole-${targetSystemId}`,
        name: `${wormholeSystem.name} (虫洞)`,
        nameEn: wormholeSystem.nameEn,
        isWormholeRegion: true,
        systems: [targetSystemId]
      },
      mainSystem: {
        ...wormholeSystem,
        isBorder: true
      }
    };
  }
  
  /**
   * 清空数据
   */
  clear() {
    this.systems.clear();
    this.wormholeSystems.clear();
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      kSpace: this.systems.size,
      wormhole: this.wormholeSystems.size
    };
  }
}
