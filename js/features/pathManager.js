/**
 * 路径管理器
 * 管理路径记录和显示
 */

import { PathRecorder } from './pathRecorder.js';
import { PATH_MAX_DISPLAY } from '../core/config.js';

export class PathManager {
  constructor(maxDisplay = PATH_MAX_DISPLAY) {
    this.recorder = new PathRecorder(maxDisplay);
    this.onUpdate = null;
  }
  
  /**
   * 添加星系到路径
   */
  addSystem(system) {
    const prevCount = this.recorder.allSystems.size;
    this.recorder.addSystem(system);
    
    // 只在有变化时通知
    if (this.recorder.allSystems.size !== prevCount) {
      this._notifyUpdate();
    }
    
    return this.recorder.currentSystem;
  }
  
  /**
   * 获取路径数据（用于渲染）
   */
  getPathData() {
    return {
      systems: this.recorder.getDisplayPath(),
      connections: this.recorder.getDisplayConnections()
    };
  }
  
  /**
   * 获取访问顺序
   */
  getVisitOrder() {
    return this.recorder.getVisitOrder();
  }
  
  /**
   * 检查是否有路径
   */
  hasPath() {
    return this.recorder.hasPath();
  }
  
  /**
   * 清空路径
   */
  clear() {
    this.recorder.clear();
    this._notifyUpdate();
  }
  
  /**
   * 检查两个星系间是否有已知连接
   */
  hasConnection(fromId, toId) {
    const connections = this.recorder.getDisplayConnections();
    return connections.some(conn => {
      const forward = conn.from.id === fromId && conn.to.id === toId;
      const reverse = conn.from.id === toId && conn.to.id === fromId;
      return forward || reverse;
    });
  }
  
  /**
   * 获取当前星系
   */
  getCurrentSystem() {
    return this.recorder.currentSystem;
  }
  
  /**
   * 获取已访问的星系ID集合
   */
  getVisitedSystemIds() {
    return new Set(this.recorder.allSystems.keys());
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
      this.onUpdate(this.getPathData());
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      visitedSystems: this.recorder.allSystems.size,
      connections: this.recorder.connections.size,
      maxDisplay: this.recorder.maxDisplay
    };
  }
}
