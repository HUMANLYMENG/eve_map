/**
 * SystemsManager 单元测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { SystemsManager } from '../../../js/data/systems.js';
import { mockSystems } from '../../mocks/dataMocks.js';

describe('SystemsManager', () => {
  let manager;
  
  beforeEach(() => {
    manager = new SystemsManager();
  });
  
  describe('process', () => {
    test('应正确处理星系数据', () => {
      const rawData = {
        30005008: {
          name: { zh: '耶舒尔', en: 'Yeeshur' },
          regionID: 10000064,
          securityStatus: 0.7,
          position2D: { x: 1e16, y: 2e16 }
        }
      };
      
      manager.process(rawData);
      
      expect(manager.systems.size).toBe(1);
      const system = manager.get(30005008);
      expect(system.name).toBe('耶舒尔');
      expect(system.securityClass).toBe('high');
    });
    
    test('应区分 K-Space 和虫洞星系', () => {
      const rawData = {
        30005008: { name: { zh: 'K-Space' }, regionID: 10000064 },
        31000001: { name: { zh: 'J100001' }, regionID: 11000001 }
      };
      
      manager.process(rawData);
      
      expect(manager.systems.size).toBe(1);
      expect(manager.wormholeSystems.size).toBe(1);
    });
  });
  
  describe('get', () => {
    test('应能获取 K-Space 星系', () => {
      manager.process({ 30005008: { name: { zh: '测试' }, regionID: 1 } });
      const system = manager.get(30005008);
      expect(system).toBeDefined();
      expect(system.name).toBe('测试');
    });
    
    test('应能获取虫洞星系', () => {
      manager.process({ 31000001: { name: { zh: '虫洞' }, regionID: 11000001 } });
      const system = manager.get(31000001);
      expect(system).toBeDefined();
      expect(system.isWormhole).toBe(true);
    });
  });
  
  describe('search', () => {
    beforeEach(() => {
      manager.process({
        30005008: { name: { zh: '耶舒尔', en: 'Yeeshur' }, regionID: 1 },
        30005009: { name: { zh: '测试星系', en: 'Test System' }, regionID: 1 }
      });
    });
    
    test('应支持中文搜索', () => {
      const results = manager.search('耶舒');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('耶舒尔');
    });
    
    test('应支持英文搜索', () => {
      const results = manager.search('yeesh');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('耶舒尔');
    });
    
    test('应限制结果数量', () => {
      const results = manager.search('星', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });
  
  describe('getByRegion', () => {
    test('应返回指定星域的所有星系', () => {
      manager.process({
        30005008: { name: { zh: 'A' }, regionID: 100 },
        30005009: { name: { zh: 'B' }, regionID: 100 },
        30005010: { name: { zh: 'C' }, regionID: 101 }
      });
      
      const region100 = manager.getByRegion(100);
      expect(region100).toHaveLength(2);
    });
  });
});
