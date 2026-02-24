/**
 * @fileoverview 星系名称解析器 - 支持中英文映射
 * 提供星系名称的中英文互查功能
 */

// 常用星系中英文对照表（从 EVE SDE 数据提取）
const SYSTEM_NAME_MAP = {
  // The Forge 星域 - 主要贸易中心
  'Jita': '吉他',
  'Perimeter': '周边',
  'New Caldari': '新加达里',
  'Urlen': '乌兰',
  'Maurasi': '毛拉西',
  'Kisogo': '木舌戈',
  'Todaki': '户幕',
  'Amsen': '阿姆森',
  
  // Domain 星域 - Amarr
  'Amarr': '艾玛',
  'Bourar': '布拉尔',
  'Madirmilire': '玛迪米利亚',
  'Sarum Prime': '萨姆首星',
  'Nabura': '纳布拉',
  
  // Heimatar 星域 - Minmatar
  'Rens': '伦斯',
  'Lustrevik': '卢斯特雷维克',
  'Gelfiven': '格尔菲文',
  'Osoggur': '奥索古尔',
  
  // Sinq Laison 星域 - Gallente
  'Dodixie': '多迪谢',
  'Eglennaert': '埃格伦纳特',
  'Aufay': '奥菲',
  'Botane': '波坦',
  
  // Lonetrek 星域
  'Aeschee': '艾舍',
  'Waskisen': '瓦斯基森',
  'Elonaya': '艾洛纳亚',
  
  // The Citadel 星域
  'Kakakela': '卡卡科拉',
  'Tamo': '塔莫',
  'Ono': '奥诺',
  
  // Genesis 星域
  'Yulai': '尤拉',
  'New Eden': '新伊甸',
  
  // 一些虫洞常用星系
  'Thera': '席拉',
  'Turnur': '图尔鲁尔',
};

/**
 * 星系名称解析器类
 */
export class SystemNameResolver {
  constructor() {
    this.enToZh = new Map();
    this.zhToEn = new Map();
    this._initializeMaps();
  }

  /**
   * 初始化中英文映射表
   * @private
   */
  _initializeMaps() {
    for (const [en, zh] of Object.entries(SYSTEM_NAME_MAP)) {
      // 存储原始大小写
      this.enToZh.set(en, zh);
      this.zhToEn.set(zh, en);
      
      // 也存储小写版本用于查找
      this.enToZh.set(en.toLowerCase(), zh);
      this.zhToEn.set(zh.toLowerCase(), en);
    }
  }

  /**
   * 解析星系名称，返回对应的中文或英文名称
   * @param {string} name - 星系名称（中英文均可）
   * @returns {string} - 对应的名称（如果找到映射）或原名
   */
  resolve(name) {
    if (!name) return '';
    
    const normalized = name.trim();
    const lower = normalized.toLowerCase();
    
    // 如果是英文，返回中文
    if (this.enToZh.has(normalized)) {
      return this.enToZh.get(normalized);
    }
    if (this.enToZh.has(lower)) {
      return this.enToZh.get(lower);
    }
    
    // 如果是中文，返回英文
    if (this.zhToEn.has(normalized)) {
      return this.zhToEn.get(normalized);
    }
    if (this.zhToEn.has(lower)) {
      return this.zhToEn.get(lower);
    }
    
    // 没有找到映射，返回原名
    return normalized;
  }

  /**
   * 检查是否是有效的星系名称（在映射表中存在）
   * @param {string} name - 星系名称
   * @returns {boolean} - 是否有效
   */
  isValidSystem(name) {
    if (!name) return false;
    
    const normalized = name.trim();
    const lower = normalized.toLowerCase();
    
    // 检查是否在映射表中
    return this.enToZh.has(normalized) || 
           this.enToZh.has(lower) ||
           this.zhToEn.has(normalized) || 
           this.zhToEn.has(lower);
  }

  /**
   * 获取英文名称对应的中文名称
   * @param {string} enName - 英文星系名
   * @returns {string|null} - 中文名称或 null
   */
  getChineseName(enName) {
    if (!enName) return null;
    return this.enToZh.get(enName.trim()) || 
           this.enToZh.get(enName.trim().toLowerCase()) || 
           null;
  }

  /**
   * 获取中文名称对应的英文名称
   * @param {string} zhName - 中文星系名
   * @returns {string|null} - 英文名称或 null
   */
  getEnglishName(zhName) {
    if (!zhName) return null;
    return this.zhToEn.get(zhName.trim()) || 
           this.zhToEn.get(zhName.trim().toLowerCase()) || 
           null;
  }

  /**
   * 获取所有英文名称列表
   * @returns {string[]} - 英文名称数组
   */
  getAllEnglishNames() {
    const names = new Set();
    for (const key of this.enToZh.keys()) {
      // 只返回非小写版本（去重）
      if (key[0] !== key[0].toLowerCase()) {
        names.add(key);
      }
    }
    return Array.from(names).sort();
  }

  /**
   * 获取所有中文名称列表
   * @returns {string[]} - 中文名称数组
   */
  getAllChineseNames() {
    const names = new Set();
    for (const key of this.zhToEn.keys()) {
      // 中文没有大小写问题，直接添加
      if (!/[a-z]/.test(key)) {
        names.add(key);
      }
    }
    return Array.from(names).sort();
  }

  /**
   * 批量添加映射（用于从 SDE 数据初始化）
   * @param {Object} mappings - 映射对象 {en: zh}
   */
  addMappings(mappings) {
    for (const [en, zh] of Object.entries(mappings)) {
      this.enToZh.set(en, zh);
      this.enToZh.set(en.toLowerCase(), zh);
      this.zhToEn.set(zh, en);
      this.zhToEn.set(zh.toLowerCase(), en);
    }
  }

  /**
   * 获取映射数量
   * @returns {number} - 映射对数
   */
  getMappingCount() {
    // 返回实际的映射对数（非小写版本）
    return Object.keys(SYSTEM_NAME_MAP).length;
  }
}

// 默认导出
export default SystemNameResolver;
