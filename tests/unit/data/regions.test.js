/**
 * RegionsManager 单元测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { RegionsManager } from '../../../js/data/regions.js';
import { SystemsManager } from '../../../js/data/systems.js';

describe('RegionsManager', () => {
  let manager;
  let systemsManager;
  
  beforeEach(() => {
    systemsManager = new SystemsManager();
    manager = new RegionsManager(systemsManager);
  });
  
  describe('process', () => {
    test('应正确处理星域数据', () => {
      const regionsData = [
        { _key: 10000064, name: { zh: '金纳泽', en: 'Genesis' } }
      ];
      
      manager.process(regionsData);
      
      const region = manager.get(10000064);
      expect(region).toBeDefined();
      expect(region.name).toBe('金纳泽');
    });
  });
  
  describe('getList', () => {
    test('应返回排序后的星域列表', () => {
      manager.process([
        { _key: 2, name: { zh: 'B星域' } },
        { _key: 1, name: { zh: 'A星域' } },
        { _key: 3, name: { zh: 'C星域' } }
      ]);
      
      const list = manager.getList();
      expect(list[0].name).toBe('A星域');
      expect(list[1].name).toBe('B星域');
      expect(list[2].name).toBe('C星域');
    });
  });
  
  describe('getName', () => {
    test('应返回星域名称', () => {
      manager.process([{ _key: 100, name: { zh: '测试星域' } }]);
      expect(manager.getName(100)).toBe('测试星域');
    });
    
    test('未知星域应返回默认值', () => {
      expect(manager.getName(999)).toBe('Region 999');
    });
  });
});
