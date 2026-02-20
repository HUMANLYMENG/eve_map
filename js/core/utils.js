/**
 * 通用工具函数
 */

import { SECURITY_THRESHOLDS } from './config.js';

/**
 * 根据安全等级获取分类
 * @param {number} securityStatus 
 * @returns {'high'|'low'|'null'}
 */
export function getSecurityClass(securityStatus) {
  if (securityStatus === undefined || securityStatus === null) return 'null';
  if (securityStatus >= SECURITY_THRESHOLDS.HIGH) return 'high';
  if (securityStatus >= SECURITY_THRESHOLDS.LOW) return 'low';
  return 'null';
}

/**
 * 格式化安全等级文本
 * @param {number} securityStatus 
 * @returns {string}
 */
export function formatSecurityStatus(securityStatus) {
  if (securityStatus === undefined || securityStatus === null) return '0.0';
  return securityStatus.toFixed(1);
}

/**
 * 获取安全等级的中文描述
 * @param {'high'|'low'|'null'} securityClass 
 * @returns {string}
 */
export function getSecurityText(securityClass) {
  const texts = {
    'high': '高安',
    'low': '低安',
    'null': '00区'
  };
  return texts[securityClass] || '未知';
}

/**
 * 防抖函数
 * @param {Function} fn 
 * @param {number} delay 
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 节流函数
 * @param {Function} fn 
 * @param {number} interval 
 * @returns {Function}
 */
export function throttle(fn, interval) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 计算两点之间的距离
 * @param {{x:number,y:number}} p1 
 * @param {{x:number,y:number}} p2 
 * @returns {number}
 */
export function distance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算多点范围的边界框
 * @param {Array<{x:number,y:number}>} points 
 * @returns {{minX:number,maxX:number,minY:number,maxY:number,centerX:number,centerY:number,width:number,height:number}}
 */
export function calculateBounds(points) {
  if (!points || points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  
  return {
    minX, maxX, minY, maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

/**
 * 高亮匹配文本
 * @param {string} text 
 * @param {string} query 
 * @returns {string} HTML
 */
export function highlightMatch(text, query) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) return text;
  
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  
  return `${before}<mark style="background: rgba(90, 143, 199, 0.4); color: inherit;">${match}</mark>${after}`;
}

/**
 * 复制文本到剪贴板
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // 降级方案
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      return false;
    }
  }
}

/**
 * 格式化时间间隔
 * @param {number} ms 
 * @returns {string}
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时`;
  const days = Math.floor(hours / 24);
  return `${days}天 ${hours % 24}小时`;
}

/**
 * 限制数值在范围内
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 检查值是否为有限数
 * @param {*} value 
 * @returns {boolean}
 */
export function isValidNumber(value) {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}
