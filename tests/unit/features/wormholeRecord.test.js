/**
 * WormholeRecord 类单元测试
 * 测试虫洞记录的所有核心功能
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { WormholeRecord } from '../../../js/features/wormholeRecord.js';
import { mockWormholeTypes } from '../../mocks/dataMocks.js';

describe('WormholeRecord', () => {
  let baseData;
  
  beforeEach(() => {
    baseData = {
      fromSystem: '耶舒尔',
      toSystem: 'J100001',
      fromSignal: 'ABC-123',
      toSignal: 'XYZ-789',
      type: 'C247',
      size: 'L',
      maxLife: '1d',
      source: 'local'
    };
  });
  
  describe('构造函数', () => {
    test('应正确创建本地虫洞记录', () => {
      const record = new WormholeRecord(baseData);
      
      expect(record.fromSystem).toBe('耶舒尔');
      expect(record.toSystem).toBe('J100001');
      expect(record.type).toBe('C247');
      expect(record.size).toBe('L');
      expect(record.source).toBe('local');
      expect(record.id).toBeDefined();
      expect(record.recordTime).toBeDefined();
      expect(record.expiresAt).toBeDefined();
    });
    
    test('应正确创建 EVE Scout 记录', () => {
      const esData = {
        ...baseData,
        source: 'evescout',
        evescoutId: 12345,
        createdBy: 'TestPilot',
        inSystemClass: 4,
        inRegionName: '金纳泽',
        whExitsOutward: true,
        expiresAt: Date.now() + 86400000
      };
      
      const record = new WormholeRecord(esData);
      
      expect(record.source).toBe('evescout');
      expect(record.id).toBe('es-12345');
      expect(record.evescoutId).toBe(12345);
      expect(record.createdBy).toBe('TestPilot');
    });
    
    test('应计算正确的过期时间', () => {
      const now = Date.now();
      const record1h = new WormholeRecord({ ...baseData, maxLife: '1h' });
      const record4h = new WormholeRecord({ ...baseData, maxLife: '4h' });
      const record1d = new WormholeRecord({ ...baseData, maxLife: '1d' });
      const record2d = new WormholeRecord({ ...baseData, maxLife: '2d' });
      
      // 允许 100ms 误差
      expect(record1h.expiresAt - now).toBeCloseTo(3600000, -3);
      expect(record4h.expiresAt - now).toBeCloseTo(14400000, -3);
      expect(record1d.expiresAt - now).toBeCloseTo(86400000, -3);
      expect(record2d.expiresAt - now).toBeCloseTo(172800000, -3);
    });
  });
  
  describe('getRemainingTime', () => {
    test('应返回正确的剩余时间格式', () => {
      const record = new WormholeRecord(baseData);
      
      // 模拟还有 2 小时 30 分钟
      record.expiresAt = Date.now() + (2 * 3600 + 30 * 60) * 1000;
      expect(record.getRemainingTime()).toBe('2小时 30分钟');
      
      // 模拟还有 45 分钟
      record.expiresAt = Date.now() + 45 * 60 * 1000;
      expect(record.getRemainingTime()).toBe('45分钟');
      
      // 模拟还有 1 天 5 小时
      record.expiresAt = Date.now() + (29 * 3600) * 1000;
      expect(record.getRemainingTime()).toBe('1天 5小时');
    });
    
    test('过期时应返回"已过期"', () => {
      const record = new WormholeRecord(baseData);
      record.expiresAt = Date.now() - 1000;
      
      expect(record.getRemainingTime()).toBe('已过期');
    });
  });
  
  describe('isSameWormhole', () => {
    test('应正确判断相同虫洞（正向匹配）', () => {
      const record1 = new WormholeRecord(baseData);
      const record2 = new WormholeRecord(baseData);
      
      expect(record1.isSameWormhole(record2)).toBe(true);
    });
    
    test('应正确判断相同虫洞（反向匹配）', () => {
      const record1 = new WormholeRecord(baseData);
      const record2 = new WormholeRecord({
        ...baseData,
        fromSystem: 'J100001',
        toSystem: '耶舒尔'
      });
      
      expect(record1.isSameWormhole(record2)).toBe(true);
    });
    
    test('不同类型应判断为不同虫洞', () => {
      const record1 = new WormholeRecord(baseData);
      const record2 = new WormholeRecord({
        ...baseData,
        type: 'H296'
      });
      
      expect(record1.isSameWormhole(record2)).toBe(false);
    });
    
    test('不同星系应判断为不同虫洞', () => {
      const record1 = new WormholeRecord(baseData);
      const record2 = new WormholeRecord({
        ...baseData,
        toSystem: 'J100002'
      });
      
      expect(record1.isSameWormhole(record2)).toBe(false);
    });
  });
  
  describe('getBookmarks', () => {
    test('应返回正确的书签名', () => {
      const record = new WormholeRecord(baseData);
      const bookmarks = record.getBookmarks();
      
      expect(bookmarks).toHaveLength(2);
      expect(bookmarks[0].text).toBe('ABC-123 -> J100001');
      expect(bookmarks[1].text).toBe('XYZ-789 -> 耶舒尔');
    });
    
    test('未知信号不应包含在书签名中', () => {
      const record = new WormholeRecord({
        ...baseData,
        fromSignal: '未知',
        toSignal: ''
      });
      const bookmarks = record.getBookmarks();
      
      expect(bookmarks).toHaveLength(0);
    });
  });
  
  describe('getSourceLabel', () => {
    test('本地记录应返回正确标签', () => {
      const record = new WormholeRecord(baseData);
      expect(record.getSourceLabel()).toBe('📝 本地');
    });
    
    test('EVE Scout 记录应返回正确标签', () => {
      const record = new WormholeRecord({
        ...baseData,
        source: 'evescout'
      });
      expect(record.getSourceLabel()).toBe('🌐 ES');
    });
  });
  
  describe('isEditable', () => {
    test('本地记录应可编辑', () => {
      const record = new WormholeRecord(baseData);
      expect(record.isEditable()).toBe(true);
    });
    
    test('EVE Scout 记录应不可编辑', () => {
      const record = new WormholeRecord({
        ...baseData,
        source: 'evescout'
      });
      expect(record.isEditable()).toBe(false);
    });
  });
});
