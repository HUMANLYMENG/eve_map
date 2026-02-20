/**
 * 路径记录器
 * 记录唯一的无向连接（边）
 */

export class PathRecorder {
  constructor(maxDisplay = 6) {
    this.connections = new Map(); // 存储唯一的无向连接 key: "minId-maxId", value: {from, to, timestamp}
    this.currentSystem = null; // 当前所在星系
    this.allSystems = new Map(); // 所有访问过的星系（用于显示）
    this.visitOrder = []; // 访问顺序（用于路径面板显示）
    this.maxDisplay = maxDisplay;
  }
  
  /**
   * 添加星系到路径
   */
  addSystem(system) {
    if (!system) return;
    
    // 避免重复添加同一个星系（连续点击）
    if (this.currentSystem && this.currentSystem.id === system.id) return;
    
    // 记录星系访问
    const systemInfo = {
      id: system.id,
      name: system.name,
      regionID: system.regionID,
      timestamp: Date.now()
    };
    
    this.allSystems.set(system.id, systemInfo);
    this.visitOrder.push(systemInfo);
    
    // 如果有上一个星系，记录连接（无向，不重复）
    if (this.currentSystem) {
      const fromId = this.currentSystem.id;
      const toId = system.id;
      
      // 创建无向连接的唯一 key（小id在前，大id在后）
      const minId = Math.min(fromId, toId);
      const maxId = Math.max(fromId, toId);
      const key = `${minId}-${maxId}`;
      
      // 如果这条连接已存在，不重复记录
      if (!this.connections.has(key)) {
        this.connections.set(key, {
          from: { ...this.currentSystem },
          to: { 
            id: system.id, 
            name: system.name, 
            regionID: system.regionID 
          },
          timestamp: Date.now()
        });
      }
    }
    
    // 更新当前星系
    this.currentSystem = systemInfo;
  }
  
  /**
   * 获取显示路径（所有访问过的星系）
   */
  getDisplayPath() {
    return Array.from(this.allSystems.values());
  }
  
  /**
   * 获取显示连接（所有唯一的连接）
   */
  getDisplayConnections() {
    return Array.from(this.connections.values());
  }
  
  /**
   * 获取访问顺序
   */
  getVisitOrder() {
    return [...this.visitOrder];
  }
  
  /**
   * 清空路径
   */
  clear() {
    this.connections.clear();
    this.allSystems.clear();
    this.visitOrder = [];
    this.currentSystem = null;
  }
  
  /**
   * 是否有路径
   */
  hasPath() {
    return this.allSystems.size > 0;
  }
}
