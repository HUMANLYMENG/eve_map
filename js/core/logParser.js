/**
 * @fileoverview 日志解析器 - 支持中英文识别
 * 解析 EVE Online 客户端日志，识别角色名和星系变化
 */

// 日志解析正则表达式配置
const LOG_PATTERNS = {
  // 角色识别（Listener 行）
  listener: {
    en: /Listener:\s*(.+)/,
    zh: /侦听器:\s*(.+)/
  },
  
  // 星系变化识别
  systemChange: {
    en: /Channel changed to Local\s*:\s*(.+)/i,
    zh: /频道更换为本地\s*:\s*(.+)/
  },
  
  // 频道名称（用于验证是本地频道）
  channelName: {
    en: /Channel Name:\s*Local/i,
    zh: /Channel Name:\s*本地/i
  }
};

/**
 * 日志解析器类
 */
export class LogParser {
  constructor() {
    this.patterns = LOG_PATTERNS;
  }

  /**
   * 解析单行日志
   * @param {string} line - 日志行
   * @returns {Object|null} - 解析结果
   */
  parseLine(line) {
    if (!line || typeof line !== 'string') {
      return null;
    }

    // 尝试匹配星系变化（中英文）
    const systemMatch = this.matchSystemChange(line);
    if (systemMatch) {
      return {
        type: 'system_change',
        system: this.cleanSystemName(systemMatch[1])
      };
    }
    
    // 尝试匹配角色名（中英文）
    const listenerMatch = this.matchListener(line);
    if (listenerMatch) {
      return {
        type: 'listener',
        role: listenerMatch[1].trim()
      };
    }
    
    return null;
  }

  /**
   * 匹配星系变化
   * @param {string} line - 日志行
   * @returns {Array|null} - 匹配结果
   */
  matchSystemChange(line) {
    // 先尝试英文，再尝试中文
    return line.match(this.patterns.systemChange.en) || 
           line.match(this.patterns.systemChange.zh);
  }

  /**
   * 匹配角色名
   * @param {string} line - 日志行
   * @returns {Array|null} - 匹配结果
   */
  matchListener(line) {
    return line.match(this.patterns.listener.en) || 
           line.match(this.patterns.listener.zh);
  }

  /**
   * 清理星系名称（去掉 * 标记和前后空格）
   * @param {string} name - 原始星系名
   * @returns {string} - 清理后的星系名
   */
  cleanSystemName(name) {
    if (!name) return '';
    return name.trim().replace(/\*$/, '').trim();
  }

  /**
   * 检测是否是中文客户端日志
   * @param {string} content - 日志内容
   * @returns {boolean} - 是否是中文客户端
   */
  detectChineseClient(content) {
    if (!content) return false;
    // 检查是否包含中文标识
    return /频道更换为本地|本地\s*:/.test(content) ||
           /[\u4e00-\u9fa5]{2,}/.test(content);
  }

  /**
   * 解析整个日志文件内容
   * @param {string} content - 日志内容
   * @returns {Object} - 解析结果
   */
  parseContent(content) {
    const lines = content.split(/\r?\n/);
    const result = {
      listener: null,
      systemChanges: [],
      isChineseClient: this.detectChineseClient(content)
    };

    for (const line of lines) {
      const parsed = this.parseLine(line);
      if (parsed) {
        if (parsed.type === 'listener') {
          result.listener = parsed.role;
        } else if (parsed.type === 'system_change') {
          result.systemChanges.push({
            system: parsed.system,
            line: line.trim()
          });
        }
      }
    }

    return result;
  }

  /**
   * 获取最后一条星系变化记录
   * @param {string} content - 日志内容
   * @returns {string|null} - 最后的星系名
   */
  getLastSystem(content) {
    const result = this.parseContent(content);
    if (result.systemChanges.length > 0) {
      return result.systemChanges[result.systemChanges.length - 1].system;
    }
    return null;
  }
}

// 默认导出
export default LogParser;
