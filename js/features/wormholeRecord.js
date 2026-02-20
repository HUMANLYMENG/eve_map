/**
 * 虫洞记录类
 * 封装虫洞的所有属性和行为
 */

export class WormholeRecord {
  constructor(data) {
    // 数据来源标记: 'local' | 'evescout'
    this.source = data.source || 'local';
    
    // ID 生成
    if (this.source === 'evescout' && data.evescoutId) {
      this.id = `es-${data.evescoutId}`;
      this.evescoutId = data.evescoutId;
    } else {
      this.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    this.fromSystem = data.fromSystem;
    this.toSystem = data.toSystem;
    this.fromSignal = data.fromSignal;
    this.toSignal = data.toSignal;
    this.type = data.type;
    this.size = data.size;
    this.maxLife = data.maxLife;
    
    // 记录时间（EVE Scout 数据使用服务器时间）
    this.recordTime = data.recordTime || Date.now();
    
    // 过期时间（EVE Scout 数据直接提供）
    if (data.expiresAt) {
      this.expiresAt = data.expiresAt;
    } else {
      const lifeHours = { '1h': 1, '4h': 4, '1d': 24, '2d': 48 };
      this.expiresAt = this.recordTime + (lifeHours[data.maxLife] || 24) * 60 * 60 * 1000;
    }
    
    // EVE Scout 特有字段
    if (this.source === 'evescout') {
      this.createdBy = data.createdBy;
      this.inSystemClass = data.inSystemClass;
      this.inRegionName = data.inRegionName;
      this.whExitsOutward = data.whExitsOutward;
      this.inSystemId = data.inSystemId;
      this.outSystemId = data.outSystemId;
    }
  }
  
  /**
   * 获取剩余时间字符串
   */
  getRemainingTime() {
    const now = Date.now();
    const diff = this.expiresAt - now;
    
    if (diff <= 0) return '已过期';
    
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours >= 24) {
      return `${Math.floor(hours / 24)}天 ${hours % 24}小时`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }
  
  /**
   * 获取格式化的记录时间
   */
  getFormattedRecordTime() {
    const date = new Date(this.recordTime);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  /**
   * 获取来源标签
   */
  getSourceLabel() {
    if (this.source === 'evescout') {
      return '🌐 ES';
    }
    return '📝 本地';
  }
  
  /**
   * 获取来源提示文本
   */
  getSourceTitle() {
    if (this.source === 'evescout') {
      return `EVE Scout · ${this.createdBy || '未知'}`;
    }
    return '本地记录';
  }
  
  /**
   * 是否可编辑
   */
  isEditable() {
    return this.source === 'local';
  }
  
  /**
   * 获取书签名列表
   */
  getBookmarks() {
    const bookmarks = [];
    if (this.fromSignal && this.fromSignal !== '未知') {
      bookmarks.push({
        text: `${this.fromSignal} -> ${this.toSystem}`,
        copyText: `${this.fromSignal} -> ${this.toSystem}`
      });
    }
    if (this.toSignal && this.toSignal !== '未知') {
      bookmarks.push({
        text: `${this.toSignal} -> ${this.fromSystem}`,
        copyText: `${this.toSignal} -> ${this.fromSystem}`
      });
    }
    return bookmarks;
  }
  
  /**
   * 获取唯一键（用于去重）
   */
  getKey() {
    return `${this.fromSystem}-${this.toSystem}-${this.type}`;
  }
  
  /**
   * 检查是否与另一个记录是同一虫洞（双向比较）
   * @param {WormholeRecord} other 
   * @returns {boolean}
   */
  isSameWormhole(other) {
    if (this.type !== other.type) return false;
    
    // 正向匹配
    const forwardMatch = this.fromSystem === other.fromSystem && 
                         this.toSystem === other.toSystem;
    
    // 反向匹配
    const reverseMatch = this.fromSystem === other.toSystem && 
                         this.toSystem === other.fromSystem;
    
    return forwardMatch || reverseMatch;
  }
}
