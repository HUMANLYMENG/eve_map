/**
 * 星域数据管理模块
 */

export class RegionsManager {
  constructor(systemsManager) {
    this.regions = new Map();
    this.constellations = new Map();
    this.systemsManager = systemsManager;
  }
  
  /**
   * 处理星域数据
   */
  process(regionsData) {
    for (const item of regionsData) {
      const id = item._key;
      this.regions.set(id, {
        id,
        name: item.name?.zh || item.name?.en || `Region ${id}`,
        nameEn: item.name?.en || '',
        description: item.description?.zh || item.description?.en || '',
        constellationIDs: item.constellationIDs || [],
        factionID: item.factionID,
        wormholeClassID: item.wormholeClassID,
        systems: []
      });
    }
  }
  
  /**
   * 处理星座数据
   */
  processConstellations(constellationsData) {
    for (const item of constellationsData) {
      const id = item._key;
      this.constellations.set(id, {
        id,
        name: item.name?.zh || item.name?.en || `Constellation ${id}`,
        regionID: item.regionID,
        systemIDs: item.solarSystemIDs || []
      });
    }
  }
  
  /**
   * 关联星系到星域
   */
  linkSystems() {
    for (const system of this.systemsManager.getAllKSpace()) {
      const region = this.regions.get(system.regionID);
      if (region) {
        region.systems.push(system.id);
      }
    }
  }
  
  /**
   * 获取星域
   */
  get(id) {
    return this.regions.get(id);
  }
  
  /**
   * 获取星域名称
   */
  getName(id) {
    const region = this.regions.get(id);
    return region ? region.name : `Region ${id}`;
  }
  
  /**
   * 获取星域列表（排序后）
   */
  getList() {
    const list = [];
    for (const region of this.regions.values()) {
      list.push({
        id: region.id,
        name: region.name,
        systemCount: region.systems.length
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }
  
  /**
   * 获取所有星域
   */
  getAll() {
    return Array.from(this.regions.values());
  }
  
  /**
   * 清空数据
   */
  clear() {
    this.regions.clear();
    this.constellations.clear();
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      regions: this.regions.size,
      constellations: this.constellations.size
    };
  }
}
