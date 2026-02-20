/**
 * 星域数据构建器
 * 构建特定星域的完整数据（包含外部星系）
 */

import { calculateBounds } from '../core/utils.js';

export class RegionDataBuilder {
  constructor(systemsManager, regionsManager, connectionsManager) {
    this.systemsManager = systemsManager;
    this.regionsManager = regionsManager;
    this.connectionsManager = connectionsManager;
  }
  
  /**
   * 构建星域数据
   */
  build(regionId) {
    const region = this.regionsManager.get(regionId);
    if (!region) return null;
    
    const systems = this.systemsManager.getByRegion(regionId);
    const borderSystems = systems.filter(s => s.isBorder);
    
    const bounds = this._calculateBounds(systems);
    const externalSystems = this._buildExternalSystems(systems, regionId, bounds);
    const { internalConnections, externalConnections } = this._buildConnections(systems, regionId, externalSystems);
    
    return {
      region,
      systems,
      borderSystems,
      externalSystems: Array.from(externalSystems.values()),
      bounds,
      internalConnections,
      externalConnections
    };
  }
  
  /**
   * 计算边界
   */
  _calculateBounds(systems) {
    if (systems.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
    }
    
    const positions = systems.map(s => s.position2D);
    const bounds = calculateBounds(positions);
    
    // 如果只有一个系统，设置默认大小
    if (bounds.width === 0) {
      bounds.width = 1e16;
      bounds.minX -= bounds.width / 2;
      bounds.maxX += bounds.width / 2;
    }
    if (bounds.height === 0) {
      bounds.height = 1e16;
      bounds.minY -= bounds.height / 2;
      bounds.maxY += bounds.height / 2;
    }
    
    return bounds;
  }
  
  /**
   * 构建外部星系数据
   */
  _buildExternalSystems(systems, regionId, bounds) {
    const externalSystems = new Map();
    const globalPositions = [];
    
    // 收集本星域星系位置用于碰撞检测
    for (const system of systems) {
      globalPositions.push({ x: system.position2D.x, y: system.position2D.y });
    }
    
    const domainScale = Math.max(bounds.width, bounds.height);
    const distanceRange = { min: domainScale * 0.06, max: domainScale * 0.10 };
    
    for (const system of systems) {
      const connections = this.connectionsManager.get(system.id);
      
      for (const targetId of connections) {
        const target = this.systemsManager.get(targetId);
        if (target && target.regionID !== regionId) {
          const uniqueKey = `${system.id}-${targetId}`;
          
          if (!externalSystems.has(uniqueKey)) {
            const virtualPos = this._calculateExternalPosition(
              system, target, bounds, distanceRange, globalPositions
            );
            
            externalSystems.set(uniqueKey, {
              ...target,
              isExternal: true,
              connectedFrom: system.id,
              connectedFromName: system.name,
              position2D: virtualPos,
              uniqueKey
            });
            
            globalPositions.push(virtualPos);
          }
        }
      }
    }
    
    return externalSystems;
  }
  
  /**
   * 计算外部星系位置
   */
  _calculateExternalPosition(borderSystem, targetSystem, bounds, distanceRange, globalPositions) {
    const dirX = borderSystem.position2D.x - bounds.centerX;
    const dirY = borderSystem.position2D.y - bounds.centerY;
    const baseAngle = Math.atan2(dirY, dirX);
    
    // 尝试不同角度
    const angles = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5];
    const minGap = Math.max(bounds.width, bounds.height) * 0.01;
    
    for (const angleOffset of angles) {
      const angle = baseAngle + angleOffset;
      const distance = (distanceRange.min + distanceRange.max) / 2;
      
      const pos = {
        x: borderSystem.position2D.x + Math.cos(angle) * distance,
        y: borderSystem.position2D.y + Math.sin(angle) * distance
      };
      
      // 检查碰撞
      let hasCollision = false;
      for (const placed of globalPositions) {
        const dx = pos.x - placed.x;
        const dy = pos.y - placed.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minGap) {
          hasCollision = true;
          break;
        }
      }
      
      if (!hasCollision) return pos;
    }
    
    // 默认位置
    return {
      x: borderSystem.position2D.x + Math.cos(baseAngle) * distanceRange.min,
      y: borderSystem.position2D.y + Math.sin(baseAngle) * distanceRange.min
    };
  }
  
  /**
   * 构建连接数据
   */
  _buildConnections(systems, regionId, externalSystems) {
    const internalConnections = [];
    const externalConnections = [];
    const systemsMap = new Map(systems.map(s => [s.id, s]));
    
    for (const system of systems) {
      const connections = this.connectionsManager.get(system.id);
      
      for (const targetId of connections) {
        const target = this.systemsManager.getKSpace(targetId);
        if (!target) continue;
        
        if (target.regionID === regionId) {
          // 内部连接：避免重复
          if (system.id < targetId) {
            internalConnections.push({
              from: system.id,
              to: targetId,
              fromPos: system.position2D,
              toPos: target.position2D
            });
          }
        } else {
          // 外部连接
          const uniqueKey = `${system.id}-${targetId}`;
          const externalInstance = externalSystems.get(uniqueKey);
          
          if (externalInstance) {
            externalConnections.push({
              from: system.id,
              to: targetId,
              fromPos: system.position2D,
              toPos: externalInstance.position2D,
              targetRegion: target.regionID,
              targetRegionName: this.regionsManager.getName(target.regionID),
              targetSystem: target.name,
              targetSystemObj: target
            });
          }
        }
      }
    }
    
    return { internalConnections, externalConnections };
  }
  
  /**
   * 构建虫洞星域数据
   */
  buildWormhole(wormholeId, connectedKSpaceSystems = []) {
    const wormholeSystem = this.systemsManager.getWormhole(wormholeId);
    if (!wormholeSystem) return null;
    
    const regionData = this.systemsManager.getWormholeRegionData(wormholeId);
    const mainSystem = regionData.mainSystem;
    
    const externalSystems = [];
    const externalConnections = [];
    
    // 使用固定的虚拟坐标范围，确保显示比例合适
    const centerX = wormholeSystem.position2D.x;
    const centerY = wormholeSystem.position2D.y;
    const radius = 8e15; // 增加半径以便于显示
    
    if (connectedKSpaceSystems.length > 0) {
      const count = connectedKSpaceSystems.length;
      
      for (let i = 0; i < count; i++) {
        const { system, signal } = connectedKSpaceSystems[i];
        // 从顶部开始布置，顺时针排列
        const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
        
        const virtualPos = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        };
        
        // 获取星域名称
        const regionName = this.regionsManager.getName(system.regionID);
        
        externalSystems.push({
          ...system,
          name: system.name, // 确保名称正确
          regionName: regionName, // 添加星域名称
          isExternal: true,
          isWormholeConnection: true, // 标记为虫洞连接
          connectedFrom: wormholeId,
          connectedFromName: wormholeSystem.name,
          position2D: virtualPos,
          uniqueKey: `wormhole-${wormholeId}-${system.id}`,
          wormholeSignal: signal
        });
        
        externalConnections.push({
          from: wormholeId,
          to: system.id,
          fromPos: wormholeSystem.position2D,
          toPos: virtualPos,
          targetRegion: system.regionID,
          targetRegionName: regionName,
          targetSystem: system.name,
          targetSystemObj: system,
          isWormholeConnection: true,
          signal
        });
      }
    }
    
    // 计算 bounds 时包含所有星系
    const allPositions = [
      mainSystem.position2D,
      ...externalSystems.map(s => s.position2D)
    ];
    const bounds = calculateBounds(allPositions);
    
    // 如果没有外部星系，使用默认大小
    if (externalSystems.length === 0) {
      if (bounds.width === 0) bounds.width = 1e16;
      if (bounds.height === 0) bounds.height = 1e16;
    }
    
    return {
      region: regionData.region,
      systems: [mainSystem],
      borderSystems: [mainSystem],
      externalSystems,
      bounds,
      internalConnections: [],
      externalConnections
    };
  }
}
