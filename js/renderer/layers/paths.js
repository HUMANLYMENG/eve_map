/**
 * 路径层渲染器
 */

import { RenderLayer } from './base.js';

export class PathsLayer extends RenderLayer {
  constructor(ctx, viewport) {
    super(ctx, viewport);
    this.pathSystems = [];
    this.pathConnections = [];
  }
  
  setPathData(pathSystems, pathConnections) {
    this.pathSystems = pathSystems || [];
    this.pathConnections = pathConnections || [];
  }
  
  render(data, allSystems, hasStargateFn, dataLoader) {
    if (!this.pathConnections.length) return;
    
    this.dataLoader = dataLoader;
    this.currentData = data;
    
    console.log('[PathsLayer] render:', {
      connections: this.pathConnections.length,
      allSystemsSize: allSystems.size,
      hasData: !!data,
      hasBounds: !!data?.bounds
    });
    
    // 检查是否有路径星系在当前视图
    if (!this._hasPathInView(allSystems)) {
      console.log('[PathsLayer] No path systems in view');
      return;
    }
    
    // 计算外部路径位置
    const externalPositions = this._calculateExternalPositions(allSystems);
    console.log('[PathsLayer] External positions:', externalPositions.size);
    
    // 获取路径上所有星系的位置信息
    const pathPositions = this._buildPathPositions(allSystems, externalPositions);
    console.log('[PathsLayer] Path positions:', pathPositions.size);
    
    // 绘制不在当前星域的路径星系
    this._drawExternalPathSystems(pathPositions, allSystems);
    
    // 绘制路径连线
    this._drawPathConnections(pathPositions, hasStargateFn);
    
    // 高亮当前视图中的路径星系
    this._highlightPathSystems(allSystems);
  }
  
  /**
   * 检查当前视图中是否有路径星系
   */
  _hasPathInView(allSystems) {
    // 辅助函数：检查 ID 是否匹配（处理数字/字符串类型差异）
    const isInSystems = (id) => {
      if (allSystems.has(id)) return true;
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      const strId = String(id);
      return allSystems.has(numId) || allSystems.has(strId);
    };
    
    for (const pathSys of this.pathSystems) {
      if (isInSystems(pathSys.id)) return true;
    }
    // 检查 EVE Scout 特殊连接（from 端在当前视图）
    for (const conn of this.pathConnections) {
      if (conn.isEveScoutConnection && isInSystems(conn.from.id)) {
        return true;
      }
    }
    // 检查 EVE Scout 连接（to 端是当前视图中的虫洞，如 Thera/Turnur）
    for (const conn of this.pathConnections) {
      if (conn.isEveScoutConnection && isInSystems(conn.to.id)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * 构建路径位置映射
   */
  _buildPathPositions(allSystems, externalPositions) {
    const positions = new Map();
    
    // 辅助函数：获取系统中的位置
    const getSystemPosition = (id) => {
      if (allSystems.has(id)) {
        return allSystems.get(id).position2D;
      }
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      const strId = String(id);
      if (allSystems.has(numId)) return allSystems.get(numId).position2D;
      if (allSystems.has(strId)) return allSystems.get(strId).position2D;
      return null;
    };
    
    // 辅助函数：检查系统是否在 allSystems 中
    const isInSystems = (id) => {
      if (allSystems.has(id)) return true;
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      const strId = String(id);
      return allSystems.has(numId) || allSystems.has(strId);
    };
    
    // 添加当前星域中的系统
    for (const [id, system] of allSystems) {
      positions.set(id, system.position2D);
    }
    
    // 添加路径中的外部系统
    for (const pathSys of this.pathSystems) {
      const sysPos = getSystemPosition(pathSys.id);
      if (sysPos) {
        positions.set(pathSys.id, sysPos);
      } else if (externalPositions.has(pathSys.id)) {
        positions.set(pathSys.id, externalPositions.get(pathSys.id));
      }
    }
    
    // 添加 EVE Scout 等特殊连接的外部系统位置
    for (const conn of this.pathConnections) {
      if (conn.isEveScoutConnection || conn.source === 'evescout') {
        // from 端在当前星域
        const fromPos = getSystemPosition(conn.from.id);
        if (fromPos) {
          positions.set(conn.from.id, fromPos);
        } else if (externalPositions.has(conn.from.id)) {
          positions.set(conn.from.id, externalPositions.get(conn.from.id));
        }
        
        // to 端在当前星域或外部
        const toPos = getSystemPosition(conn.to.id);
        if (toPos) {
          positions.set(conn.to.id, toPos);
        } else if (externalPositions.has(conn.to.id)) {
          positions.set(conn.to.id, externalPositions.get(conn.to.id));
        }
      }
    }
    
    return positions;
  }
  
  /**
   * 计算外部路径位置
   * 将外部星系放在与其连接的当前星域星系附近，避免与其他节点重叠
   */
  _calculateExternalPositions(allSystems) {
    const externalPathPositions = new Map();
    
    if (!this.currentData || !this.currentData.bounds) {
      console.log('[PathsLayer] No bounds available');
      return externalPathPositions;
    }
    
    const bounds = this.currentData.bounds;
    const domainSize = Math.max(bounds.width, bounds.height);
    const baseOffset = domainSize * 0.08; // 基础偏移距离
    
    // 辅助函数：检查系统是否在当前星域（处理数字/字符串类型差异）
    const isInCurrentRegion = (id) => {
      if (allSystems.has(id)) return true;
      // 尝试数字和字符串两种格式
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      const strId = String(id);
      return allSystems.has(numId) || allSystems.has(strId);
    };
    
    // 辅助函数：获取系统中的实际ID
    const getActualSystemId = (id) => {
      if (allSystems.has(id)) return id;
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      const strId = String(id);
      if (allSystems.has(numId)) return numId;
      if (allSystems.has(strId)) return strId;
      return id;
    };
    
    // 收集所有路径中的外部星系
    const externalSystemIds = new Set();
    for (const pathSys of this.pathSystems) {
      if (!isInCurrentRegion(pathSys.id)) {
        externalSystemIds.add(pathSys.id);
      }
    }
    
    // 从 EVE Scout 等特殊连接中收集外部星系（包括 to 和 from 端）
    for (const conn of this.pathConnections) {
      if (conn.isEveScoutConnection || conn.source === 'evescout') {
        // to 端不在当前星域
        if (!isInCurrentRegion(conn.to.id)) {
          externalSystemIds.add(conn.to.id);
        }
        // from 端不在当前星域
        if (!isInCurrentRegion(conn.from.id)) {
          externalSystemIds.add(conn.from.id);
        }
      }
    }
    
    console.log('[PathsLayer] External system IDs:', Array.from(externalSystemIds));
    console.log('[PathsLayer] Current systems:', Array.from(allSystems.keys()));
    
    // 构建连接图：外部星系 -> 当前星域中的连接星系
    const externalConnections = new Map(); // externalId -> [anchorIds]
    
    for (const conn of this.pathConnections) {
      const fromInCurrent = isInCurrentRegion(conn.from.id);
      const toInCurrent = isInCurrentRegion(conn.to.id);
      const fromInExternal = externalSystemIds.has(conn.from.id);
      const toInExternal = externalSystemIds.has(conn.to.id);
      
      console.log(`[PathsLayer] Connection: ${conn.from.name} -> ${conn.to.name}, fromInCurrent: ${fromInCurrent}, toInCurrent: ${toInCurrent}, fromInExternal: ${fromInExternal}, toInExternal: ${toInExternal}`);
      
      if (fromInCurrent && toInExternal) {
        const actualFromId = getActualSystemId(conn.from.id);
        if (!externalConnections.has(conn.to.id)) externalConnections.set(conn.to.id, []);
        externalConnections.get(conn.to.id).push(actualFromId);
        console.log(`[PathsLayer] Added external connection: ${conn.to.id} -> anchor ${actualFromId}`);
      } else if (toInCurrent && fromInExternal) {
        const actualToId = getActualSystemId(conn.to.id);
        if (!externalConnections.has(conn.from.id)) externalConnections.set(conn.from.id, []);
        externalConnections.get(conn.from.id).push(actualToId);
        console.log(`[PathsLayer] Added external connection: ${conn.from.id} -> anchor ${actualToId}`);
      }
    }
    
    console.log('[PathsLayer] External systems count:', externalSystemIds.size, 
                'Connections:', externalConnections.size);
    console.log('[PathsLayer] External connections map:', Array.from(externalConnections.entries()));
    if (externalSystemIds.size === 0 && externalConnections.size === 0) return externalPathPositions;
    
    // 收集所有需要避开的节点位置（当前星域的所有星系）
    const avoidPositions = [];
    const minDistance = domainSize * 0.06; // 最小间距为6%星域大小
    
    for (const system of allSystems.values()) {
      avoidPositions.push({
        x: system.position2D.x,
        y: system.position2D.y,
        minDist: minDistance
      });
    }
    
    // 为每个外部星系计算位置
    let index = 0;
    const allExternalIds = new Set([...externalSystemIds, ...externalConnections.keys()]);
    
    for (const externalId of allExternalIds) {
      const anchorIds = externalConnections.get(externalId) || [];
      
      // 找到锚点星系
      let anchorSystem = null;
      for (const anchorId of anchorIds) {
        if (allSystems.has(anchorId)) {
          anchorSystem = allSystems.get(anchorId);
          break;
        }
      }
      
      // 如果没有锚点，使用中心点
      const anchorX = anchorSystem ? anchorSystem.position2D.x : bounds.centerX;
      const anchorY = anchorSystem ? anchorSystem.position2D.y : bounds.centerY;
      
      // 计算基础方向
      const dirX = anchorX - bounds.centerX;
      const dirY = anchorY - bounds.centerY;
      const baseAngle = Math.atan2(dirY, dirX);
      
      // 尝试不同的角度和距离，找到不重叠的位置
      const pos = this._findNonOverlappingPosition(
        anchorX, anchorY, baseAngle, baseOffset, avoidPositions, index
      );
      
      externalPathPositions.set(externalId, pos);
      
      // 将这个位置加入避开列表，防止后续外部星系与之重叠
      avoidPositions.push({
        x: pos.x,
        y: pos.y,
        minDist: minDistance // 外部星系之间也保持相同间距
      });
      
      console.log(`[PathsLayer] Position for external ${externalId}:`, pos, 'anchor:', anchorSystem?.name);
      
      index++;
    }
    
    return externalPathPositions;
  }
  
  /**
   * 检查系统是否为外部系统（EVE Scout 特殊连接等）
   */
  _isExternalSystem(system) {
    if (!system) return false;
    // EVE Scout 特殊连接的目标系统
    if (system.systemId && typeof system.systemId === 'string' && system.systemId.startsWith('evescout-')) {
      return true;
    }
    // 虫洞星系
    if (system.isWormhole || (system.id && system.id > 31000000)) {
      return true;
    }
    return false;
  }
  
  /**
   * 查找不与其他节点重叠的位置
   */
  _findNonOverlappingPosition(anchorX, anchorY, baseAngle, baseOffset, avoidPositions, index) {
    // 尝试的角度偏移（从基础角度向两边展开，更多选择避免重叠）
    const angleOffsets = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0, 2.4, -2.4];
    const distanceMultipliers = [1, 1.15, 1.3, 1.45, 1.6, 1.8, 2.0]; // 距离倍数，最大增加到2倍
    
    for (const distMult of distanceMultipliers) {
      const offset = baseOffset * distMult;
      
      for (let i = 0; i < angleOffsets.length; i++) {
        const angle = baseAngle + angleOffsets[i] + (index * 0.1); // 添加索引偏移避免多个外部星系在同一锚点冲突
        
        const pos = {
          x: anchorX + Math.cos(angle) * offset,
          y: anchorY + Math.sin(angle) * offset
        };
        
        // 检查是否与任何现有节点重叠
        let hasOverlap = false;
        for (const avoid of avoidPositions) {
          const dx = pos.x - avoid.x;
          const dy = pos.y - avoid.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < avoid.minDist) {
            hasOverlap = true;
            break;
          }
        }
        
        if (!hasOverlap) {
          return pos;
        }
      }
    }
    
    // 如果所有尝试都失败，使用最大距离的基础角度 + 索引偏移避免重叠
    const finalOffset = baseOffset * 2.0;
    const finalAngle = baseAngle + (index * 0.5);
    return {
      x: anchorX + Math.cos(finalAngle) * finalOffset,
      y: anchorY + Math.sin(finalAngle) * finalOffset
    };
  }
  
  /**
   * 绘制外部路径星系（带名称）
   */
  _drawExternalPathSystems(pathPositions, allSystems) {
    const { ctx } = this;
    const nodeSize = this.getScaledSize(12);
    const fontSize = this.getScaledSize(10);
    
    // 辅助函数：检查系统是否在当前星域
    const isInSystems = (checkId) => {
      if (allSystems.has(checkId)) return true;
      const numId = typeof checkId === 'string' ? parseInt(checkId, 10) : checkId;
      const strId = String(checkId);
      return allSystems.has(numId) || allSystems.has(strId);
    };
    
    let drawCount = 0;
    
    for (const [id, pos2D] of pathPositions) {
      if (isInSystems(id)) continue;
      
      const pos = this.worldToScreen(pos2D);
      
      // 获取星系信息
      const system = this._getSystemById(id);
      const pathSystem = this.pathSystems.find(s => s.id === id);
      const name = system?.name || pathSystem?.name || `ID:${id}`;
      
      // 检查 EVE Scout 系统类型
      const isEveScoutSpecial = pathSystem?.isEveScoutSpecial || 
                                 this._isEveScoutSystemInConnections(id);
      const isEveScoutEntry = pathSystem?.isEveScoutEntry ||
                              this._isEveScoutEntrySystem(id);
      const isEveScoutWormhole = isEveScoutEntry && 
                                  (pathSystem?.isWormhole || 
                                   (typeof id === 'string' ? parseInt(id,10) : id) >= 31000000);
      
      // 颜色配置：
      // - Thera/Turnur (EVE Scout 特殊): 紫色
      // - K-Space 入口: 青色
      // - J-Space (虫洞) 入口: 绿色
      // - 普通路径外部星系: 橙色
      let color, fillAlpha;
      if (isEveScoutSpecial) {
        color = '#c084fc'; // 紫色 - Thera/Turnur
        fillAlpha = 0.4;
      } else if (isEveScoutWormhole) {
        color = '#5ac75a'; // 绿色 - J-Space 虫洞
        fillAlpha = 0.4;
      } else if (isEveScoutEntry) {
        color = '#5a8fc7'; // 青色 - K-Space
        fillAlpha = 0.4;
      } else {
        color = '#ffaa00'; // 橙色 - 普通路径
        fillAlpha = 0.3;
      }
      
      console.log(`[PathsLayer] Drawing external system: ${name} at screen (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`, 
                  isEveScoutSpecial ? '(Special)' : isEveScoutWormhole ? '(J-Space)' : isEveScoutEntry ? '(K-Space)' : '');
      
      // 背景清除
      ctx.fillStyle = '#0a0808';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeSize * 0.6, 0, Math.PI * 2);
      ctx.fill();
      
      // 外圈虚线
      ctx.strokeStyle = color;
      ctx.lineWidth = this.getScaledSize(1.5);
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeSize * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // 内部填充
      ctx.fillStyle = this._hexToRgba(color, fillAlpha);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeSize * 0.4, 0, Math.PI * 2);
      ctx.fill();
      
      // 显示名称
      ctx.font = `${fontSize}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      // 构建显示名称
      let displayName = name;
      if (isEveScoutEntry && pathSystem?.regionName) {
        displayName = `${name} (${pathSystem.regionName})`;
      }
      if (isEveScoutWormhole && pathSystem?.wormholeClass) {
        displayName = `${name} (C${pathSystem.wormholeClass})`;
      }
      
      ctx.fillText(displayName, pos.x, pos.y - fontSize);
      
      drawCount++;
    }
    
    console.log(`[PathsLayer] Drew ${drawCount} external systems`);
  }
  
  /**
   * 检查系统是否在 EVE Scout 连接中（作为目标，如 Thera/Turnur）
   */
  _isEveScoutSystemInConnections(systemId) {
    // 支持中英文的 Ther/Turnur 名称
    const specialNames = ['thera', 'turnur', 'turner', '席拉', '图尔鲁尔'];
    
    // 检查是否是 EVE Scout 连接的 to 端（普通星域视图中）
    const isToEnd = this.pathConnections.some(conn => 
      (conn.isEveScoutConnection || conn.source === 'evescout') && 
      conn.to.id === systemId
    );
    if (isToEnd) return true;
    
    // 检查名称是否匹配特殊星系（从 pathSystems 中查找）
    const pathSys = this.pathSystems.find(s => s.id === systemId);
    if (pathSys?.isEveScoutSpecial) return true;
    if (pathSys?.name && specialNames.some(name => pathSys.name.toLowerCase().includes(name))) return true;
    
    return false;
  }
  
  /**
   * 检查系统是否是 EVE Scout 入口星系（在 Thera/Turnur 视图中显示）
   */
  _isEveScoutEntrySystem(systemId) {
    // 在 pathSystems 中查找是否有标记为 isEveScoutEntry 的系统
    const pathSys = this.pathSystems.find(s => s.id === systemId);
    if (pathSys?.isEveScoutEntry) return true;
    
    // 或者检查这个系统是否是 EVE Scout 连接的 from 端（Thera/Turnur 视图中）
    return this.pathConnections.some(conn => 
      (conn.isEveScoutConnection || conn.source === 'evescout') && 
      conn.from.id === systemId
    );
  }
  
  /**
   * 检查系统是否是 EVE Scout 连接的 J-Space 虫洞
   */
  _isEveScoutWormholeEntry(systemId) {
    const pathSys = this.pathSystems.find(s => s.id === systemId);
    // 优先使用 isWormhole 标记
    if (pathSys?.isEveScoutEntry && pathSys?.isWormhole) return true;
    
    // 或者检查 ID 是否大于 31000000（虫洞星系）
    const id = typeof systemId === 'string' ? parseInt(systemId, 10) : systemId;
    if (pathSys?.isEveScoutEntry && id >= 31000000) return true;
    
    return false;
  }
  
  /**
   * 十六进制颜色转 RGBA
   */
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  /**
   * 通过ID获取星系信息
   */
  _getSystemById(id) {
    // 优先从 pathSystems 查找（包含 EVE Scout 特殊系统）
    const pathSys = this.pathSystems.find(s => s.id === id);
    if (pathSys) {
      return {
        name: pathSys.name,
        isEveScoutSpecial: pathSys.isEveScoutSpecial,
        isEveScoutEntry: pathSys.isEveScoutEntry,
        isWormhole: pathSys.isWormhole,
        wormholeClass: pathSys.wormholeClass,
        wormholeType: pathSys.wormholeType,
        wormholeSize: pathSys.wormholeSize,
        regionName: pathSys.regionName
      };
    }
    
    // 使用 dataLoader
    if (this.dataLoader) {
      return this.dataLoader.systems?.get(id) || this.dataLoader.wormholeSystems?.get(id);
    }
    
    // 尝试从全局 dataLoader 获取
    if (typeof dataLoader !== 'undefined') {
      return dataLoader.systems?.get(id) || dataLoader.wormholeSystems?.get(id);
    }
    
    return null;
  }
  
  /**
   * 绘制路径连线
   */
  _drawPathConnections(pathPositions, hasStargateFn) {
    const { ctx } = this;
    
    for (const conn of this.pathConnections) {
      const fromPos = pathPositions.get(conn.from.id);
      const toPos = pathPositions.get(conn.to.id);
      
      if (!fromPos || !toPos) continue;
      
      const from = this.worldToScreen(fromPos);
      const to = this.worldToScreen(toPos);
      
      // 检查是否是 EVE Scout 虫洞连接
      const isEveScout = conn.isEveScoutConnection || conn.source === 'evescout';
      const hasStargate = !isEveScout && hasStargateFn(conn.from.id, conn.to.id);
      
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      
      if (isEveScout) {
        // EVE Scout 虫洞连接 - 使用紫色虚线
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = this.getScaledSize(2);
        const dashScale = this.getScaledSize(1);
        ctx.setLineDash([4 * dashScale, 3 * dashScale]);
      } else if (hasStargate) {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = this.getScaledSize(2.5);
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = '#5a8fc7';
        ctx.lineWidth = this.getScaledSize(1.5);
        const dashScale = this.getScaledSize(1);
        ctx.setLineDash([6 * dashScale, 4 * dashScale]);
      }
      
      ctx.stroke();
      ctx.setLineDash([]);
      
      // 绘制箭头
      const arrowColor = isEveScout ? '#c084fc' : (hasStargate ? '#ffaa00' : '#5a8fc7');
      this._drawArrow(from, to, arrowColor);
    }
  }
  
  /**
   * 绘制箭头
   */
  _drawArrow(from, to, color) {
    const { ctx } = this;
    const headLen = this.getScaledSize(8);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowX = from.x + (to.x - from.x) * 0.5;
    const arrowY = from.y + (to.y - from.y) * 0.5;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - headLen * Math.cos(angle - Math.PI / 6), arrowY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(arrowX - headLen * Math.cos(angle + Math.PI / 6), arrowY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
  
  /**
   * 高亮路径星系
   */
  _highlightPathSystems(allSystems) {
    const { ctx } = this;
    const radius = this.getScaledSize(10);
    const lineWidth = this.getScaledSize(2);
    
    // 辅助函数：获取系统中的星系
    const getSystem = (id) => {
      if (allSystems.has(id)) return allSystems.get(id);
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      const strId = String(id);
      if (allSystems.has(numId)) return allSystems.get(numId);
      if (allSystems.has(strId)) return allSystems.get(strId);
      return null;
    };
    
    for (const pathSys of this.pathSystems) {
      const system = getSystem(pathSys.id);
      if (!system) continue;
      
      const pos = this.worldToScreen(system.position2D);
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
