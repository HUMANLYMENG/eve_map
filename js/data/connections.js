/**
 * 星门连接管理模块
 */

export class ConnectionsManager {
  constructor(systemsManager, regionsManager) {
    this.connections = new Map();
    this.systemsManager = systemsManager;
    this.regionsManager = regionsManager;
  }
  
  /**
   * 处理星门数据
   */
  process(stargatesData) {
    // 初始化连接列表（包括 K-Space 和虫洞星系）
    for (const systemId of this.systemsManager.systems.keys()) {
      this.connections.set(systemId, []);
    }
    for (const systemId of this.systemsManager.wormholeSystems.keys()) {
      this.connections.set(systemId, []);
    }
    
    // 解析星门连接
    for (const [, gate] of Object.entries(stargatesData)) {
      const fromSystemId = gate.solarSystemID;
      const toSystemId = gate.destination?.solarSystemID;
      
      if (!fromSystemId || !toSystemId) continue;
      if (!this._isValidSystem(fromSystemId) || !this._isValidSystem(toSystemId)) {
        continue;
      }
      
      this._addConnection(fromSystemId, toSystemId);
      this._addConnection(toSystemId, fromSystemId);
    }
    
    // 标记入口星系
    this._markBorderSystems();
    
    console.log(`[ConnectionsManager] 处理了 ${this.count()} 条连接`);
  }
  
  /**
   * 检查是否是有效系统
   */
  _isValidSystem(systemId) {
    return this.systemsManager.systems.has(systemId) || 
           this.systemsManager.wormholeSystems.has(systemId);
  }
  
  /**
   * 添加连接
   */
  _addConnection(fromId, toId) {
    const connections = this.connections.get(fromId);
    if (connections && !connections.includes(toId)) {
      connections.push(toId);
    }
  }
  
  /**
   * 标记入口星系
   */
  _markBorderSystems() {
    for (const [systemId, connectedIds] of this.connections) {
      const system = this.systemsManager.get(systemId);
      if (!system) continue;
      
      for (const connectedId of connectedIds) {
        const connectedSystem = this.systemsManager.get(connectedId);
        if (connectedSystem && connectedSystem.regionID !== system.regionID) {
          system.isBorder = true;
          system.borderConnections.push({
            systemId: connectedId,
            systemName: connectedSystem.name,
            regionId: connectedSystem.regionID,
            regionName: this.regionsManager.getName(connectedSystem.regionID)
          });
        }
      }
    }
  }
  
  /**
   * 获取连接
   */
  get(systemId) {
    return this.connections.get(systemId) || [];
  }
  
  /**
   * 检查两个星系是否相连
   */
  areConnected(fromId, toId) {
    const connections = this.connections.get(fromId);
    return connections ? connections.includes(toId) : false;
  }
  
  /**
   * 获取所有连接
   */
  getAll() {
    return this.connections;
  }
  
  /**
   * 统计连接数
   */
  count() {
    let count = 0;
    for (const connections of this.connections.values()) {
      count += connections.length;
    }
    return count / 2; // 双向连接只算一次
  }
  
  /**
   * 清空数据
   */
  clear() {
    this.connections.clear();
  }
}
