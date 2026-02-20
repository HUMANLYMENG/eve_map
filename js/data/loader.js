/**
 * 数据加载器
 * 负责加载和初始化所有游戏数据
 */

import { SystemsManager } from './systems.js';
import { RegionsManager } from './regions.js';
import { ConnectionsManager } from './connections.js';
import { RegionDataBuilder } from './regionDataBuilder.js';

export class DataLoader {
  constructor() {
    this.systems = new SystemsManager();
    this.regions = new RegionsManager(this.systems);
    this.connections = new ConnectionsManager(this.systems, this.regions);
    this.regionBuilder = new RegionDataBuilder(this.systems, this.regions, this.connections);
    this.loaded = false;
  }
  
  /**
   * 加载所有数据
   */
  async loadAll() {
    try {
      console.log('[DataLoader] 开始加载数据...');
      
      const [systemsData, stargatesData, regionsData, constellationsData] = await Promise.all([
        this._loadYAML('data/mapSolarSystems.yaml'),
        this._loadYAML('data/mapStargates.yaml'),
        this._loadJSONL('data/mapRegions.jsonl'),
        this._loadJSONL('data/mapConstellations.jsonl')
      ]);
      
      this.regions.process(regionsData);
      this.regions.processConstellations(constellationsData);
      this.systems.process(systemsData);
      this.regions.linkSystems();
      this.connections.process(stargatesData);
      
      this.loaded = true;
      
      console.log('[DataLoader] 数据加载完成:');
      console.log(`  - 星域: ${this.regions.getStats().regions}`);
      console.log(`  - 星系: ${this.systems.getStats().kSpace}`);
      console.log(`  - 连接: ${this.connections.count()}`);
      
      return true;
    } catch (error) {
      console.error('[DataLoader] 数据加载失败:', error);
      throw error;
    }
  }
  
  /**
   * 加载 YAML 文件
   */
  async _loadYAML(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    const text = await response.text();
    return jsyaml.load(text);
  }
  
  /**
   * 加载 JSONL 文件
   */
  async _loadJSONL(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    const text = await response.text();
    return text
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }
  
  /**
   * 获取星域列表
   */
  getRegionList() {
    return this.regions.getList();
  }
  
  /**
   * 获取星域数据
   */
  getRegionData(regionId) {
    return this.regionBuilder.build(regionId);
  }
  
  /**
   * 获取虫洞星域数据
   */
  getWormholeRegionData(wormholeId, connectedKSpaceSystems = []) {
    return this.regionBuilder.buildWormhole(wormholeId, connectedKSpaceSystems);
  }
  
  /**
   * 搜索星系
   */
  searchSystems(query, limit = 20) {
    return this.systems.search(query, limit);
  }
  
  /**
   * 获取星系名称
   */
  getSystemName(systemId) {
    const system = this.systems.get(systemId);
    return system ? system.name : `System ${systemId}`;
  }
  
  /**
   * 获取星域名称
   */
  getRegionName(regionId) {
    return this.regions.getName(regionId);
  }
  
  /**
   * 检查星门连接
   */
  hasStargateConnection(fromId, toId) {
    return this.connections.areConnected(fromId, toId);
  }
}

// 全局单例
export const dataLoader = new DataLoader();
