/**
 * 工具函数单元测试
 */

import { describe, test, expect } from 'vitest';
import {
  getSecurityClass,
  formatSecurityStatus,
  getSecurityText,
  debounce,
  throttle,
  distance,
  calculateBounds,
  highlightMatch,
  clamp,
  isValidNumber,
  formatDuration
} from '../../../js/core/utils.js';

describe('Utils', () => {
  describe('getSecurityClass', () => {
    test('高安等级应返回 high', () => {
      expect(getSecurityClass(0.5)).toBe('high');
      expect(getSecurityClass(1.0)).toBe('high');
      expect(getSecurityClass(0.7)).toBe('high');
    });
    
    test('低安等级应返回 low', () => {
      expect(getSecurityClass(0.4)).toBe('low');
      expect(getSecurityClass(0.1)).toBe('low');
      expect(getSecurityClass(0.25)).toBe('low');
    });
    
    test('00区应返回 null', () => {
      expect(getSecurityClass(0.0)).toBe('null');
      expect(getSecurityClass(-0.5)).toBe('null');
      expect(getSecurityClass(-1.0)).toBe('null');
    });
    
    test('undefined/null 应返回 null', () => {
      expect(getSecurityClass(undefined)).toBe('null');
      expect(getSecurityClass(null)).toBe('null');
    });
  });
  
  describe('formatSecurityStatus', () => {
    test('应格式化为一位小数', () => {
      expect(formatSecurityStatus(0.7)).toBe('0.7');
      expect(formatSecurityStatus(0.75)).toBe('0.8');
      expect(formatSecurityStatus(-0.25)).toBe('-0.2');
    });
    
    test('无效值应返回 0.0', () => {
      expect(formatSecurityStatus(undefined)).toBe('0.0');
      expect(formatSecurityStatus(null)).toBe('0.0');
    });
  });
  
  describe('getSecurityText', () => {
    test('应返回正确的中文描述', () => {
      expect(getSecurityText('high')).toBe('高安');
      expect(getSecurityText('low')).toBe('低安');
      expect(getSecurityText('null')).toBe('00区');
      expect(getSecurityText('unknown')).toBe('未知');
    });
  });
  
  describe('debounce', () => {
    test('应在延迟后执行', async () => {
      let count = 0;
      const fn = debounce(() => count++, 50);
      
      fn();
      fn();
      fn();
      
      expect(count).toBe(0); // 立即检查应为 0
      
      await new Promise(r => setTimeout(r, 60));
      expect(count).toBe(1); // 延迟后只执行一次
    });
  });
  
  describe('throttle', () => {
    test('应在间隔内只执行一次', async () => {
      let count = 0;
      const fn = throttle(() => count++, 50);
      
      fn();
      fn();
      fn();
      
      expect(count).toBe(1); // 第一次立即执行
      
      await new Promise(r => setTimeout(r, 60));
      fn();
      expect(count).toBe(2); // 间隔后可以再次执行
    });
  });
  
  describe('distance', () => {
    test('应计算正确的距离', () => {
      expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
      expect(distance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
      expect(distance({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
    });
  });
  
  describe('calculateBounds', () => {
    test('应计算正确的边界框', () => {
      const points = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 0, y: 5 }
      ];
      
      const bounds = calculateBounds(points);
      
      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(3);
      expect(bounds.minY).toBe(2);
      expect(bounds.maxY).toBe(5);
      expect(bounds.width).toBe(3);
      expect(bounds.height).toBe(3);
      expect(bounds.centerX).toBe(1.5);
      expect(bounds.centerY).toBe(3.5);
    });
    
    test('空数组应返回零值', () => {
      const bounds = calculateBounds([]);
      expect(bounds.width).toBe(0);
      expect(bounds.height).toBe(0);
    });
  });
  
  describe('highlightMatch', () => {
    test('应高亮匹配的文本', () => {
      const result = highlightMatch('耶舒尔星系', '耶舒');
      expect(result).toContain('<mark');
      expect(result).toContain('耶舒');
      expect(result).toBe('耶舒<mark style="background: rgba(90, 143, 199, 0.4); color: inherit;">耶舒</mark>尔星系');
    });
    
    test('不匹配应返回原文', () => {
      const result = highlightMatch('耶舒尔星系', '测试');
      expect(result).toBe('耶舒尔星系');
    });
  });
  
  describe('clamp', () => {
    test('应在范围内返回原值', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
    
    test('超出范围应被限制', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });
  
  describe('isValidNumber', () => {
    test('应识别有效数字', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber(-45.6)).toBe(true);
    });
    
    test('应识别无效数字', () => {
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(-Infinity)).toBe(false);
      expect(isValidNumber('123')).toBe(false);
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
    });
  });
  
  describe('formatDuration', () => {
    test('应正确格式化时间', () => {
      expect(formatDuration(30000)).toBe('30秒');
      expect(formatDuration(120000)).toBe('2分钟');
      expect(formatDuration(7200000)).toBe('2小时');
      expect(formatDuration(90000000)).toBe('1天 1小时');
    });
  });
});
