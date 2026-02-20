/**
 * 事件总线
 * 用于模块间的松耦合通信
 */

export class EventBus {
  constructor() {
    this.events = new Map();
  }
  
  /**
   * 订阅事件
   * @param {string} event 
   * @param {Function} callback 
   * @returns {Function} 取消订阅函数
   */
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);
    
    // 返回取消订阅函数
    return () => this.off(event, callback);
  }
  
  /**
   * 取消订阅
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    if (this.events.has(event)) {
      this.events.get(event).delete(callback);
    }
  }
  
  /**
   * 触发事件
   * @param {string} event 
   * @param {*} data 
   */
  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus] 事件处理错误 ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * 只订阅一次
   * @param {string} event 
   * @param {Function} callback 
   */
  once(event, callback) {
    const onceCallback = (data) => {
      this.off(event, onceCallback);
      callback(data);
    };
    this.on(event, onceCallback);
  }
  
  /**
   * 清空所有事件
   */
  clear() {
    this.events.clear();
  }
}

// 全局事件总线实例
export const eventBus = new EventBus();

// 预定义的事件名称
export const Events = {
  // 星系相关
  SYSTEM_SELECT: 'system:select',
  SYSTEM_HOVER: 'system:hover',
  
  // 星域相关
  REGION_CHANGE: 'region:change',
  
  // 路径相关
  PATH_UPDATE: 'path:update',
  PATH_CLEAR: 'path:clear',
  
  // 虫洞相关
  WORMHOLE_DETECTED: 'wormhole:detected',
  WORMHOLE_RECORD_ADD: 'wormhole:record:add',
  WORMHOLE_RECORD_DELETE: 'wormhole:record:delete',
  
  // 搜索相关
  SEARCH_SELECT: 'search:select',
  
  // 视图相关
  VIEW_RESET: 'view:reset',
  VIEW_ZOOM: 'view:zoom',
  VIEW_PAN: 'view:pan'
};
