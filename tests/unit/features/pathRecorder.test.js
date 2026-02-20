/**
 * PathRecorder 类单元测试
 * 测试路径记录的所有核心功能
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { PathRecorder } from '../../../js/features/pathRecorder.js';

describe('PathRecorder', () => {
  let recorder;
  const systemA = { id: 1, name: '星系A', regionID: 100 };
  const systemB = { id: 2, name: '星系B', regionID: 100 };
  const systemC = { id: 3, name: '星系C', regionID: 101 };
  
  beforeEach(() => {
    recorder = new PathRecorder(6);
  });
  
  describe('构造函数', () => {
    test('应正确初始化', () => {
      expect(recorder.connections).toBeInstanceOf(Map);
      expect(recorder.allSystems).toBeInstanceOf(Map);
      expect(recorder.visitOrder).toEqual([]);
      expect(recorder.currentSystem).toBeNull();
      expect(recorder.maxDisplay).toBe(6);
    });
  });
  
  describe('addSystem', () => {
    test('应记录第一个星系', () => {
      recorder.addSystem(systemA);
      
      expect(recorder.currentSystem).toEqual(expect.objectContaining({
        id: 1,
        name: '星系A',
        regionID: 100
      }));
      expect(recorder.allSystems.has(1)).toBe(true);
      expect(recorder.visitOrder).toHaveLength(1);
    });
    
    test('连续点击同一星系不应重复记录', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemA);
      recorder.addSystem(systemA);
      
      expect(recorder.visitOrder).toHaveLength(1);
      expect(recorder.connections.size).toBe(0);
    });
    
    test('应正确记录星系间的连接', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemB);
      
      expect(recorder.connections.size).toBe(1);
      const conn = recorder.connections.get('1-2');
      expect(conn).toBeDefined();
      expect(conn.from.id).toBe(1);
      expect(conn.to.id).toBe(2);
    });
    
    test('反向连接应被视为相同连接（无向图）', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemB);
      recorder.addSystem(systemA); // 返回 A
      
      // 应该只有一条连接记录（1-2）
      expect(recorder.connections.size).toBe(1);
    });
    
    test('应支持多段路径', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemB);
      recorder.addSystem(systemC);
      
      expect(recorder.visitOrder).toHaveLength(3);
      expect(recorder.connections.size).toBe(2);
      expect(recorder.connections.has('1-2')).toBe(true);
      expect(recorder.connections.has('2-3')).toBe(true);
    });
    
    test('不应记录空值', () => {
      recorder.addSystem(null);
      recorder.addSystem(undefined);
      
      expect(recorder.currentSystem).toBeNull();
      expect(recorder.visitOrder).toHaveLength(0);
    });
  });
  
  describe('getDisplayPath', () => {
    test('应返回所有访问过的星系', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemB);
      
      const path = recorder.getDisplayPath();
      expect(path).toHaveLength(2);
      expect(path.some(s => s.id === 1)).toBe(true);
      expect(path.some(s => s.id === 2)).toBe(true);
    });
    
    test('空路径应返回空数组', () => {
      const path = recorder.getDisplayPath();
      expect(path).toEqual([]);
    });
  });
  
  describe('getDisplayConnections', () => {
    test('应返回所有唯一连接', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemB);
      recorder.addSystem(systemC);
      
      const connections = recorder.getDisplayConnections();
      expect(connections).toHaveLength(2);
    });
    
    test('连接应包含完整的星系信息', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemB);
      
      const [conn] = recorder.getDisplayConnections();
      expect(conn.from).toMatchObject({ id: 1, name: '星系A' });
      expect(conn.to).toMatchObject({ id: 2, name: '星系B' });
      expect(conn.timestamp).toBeDefined();
    });
  });
  
  describe('getVisitOrder', () => {
    test('应返回正确的访问顺序', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemB);
      recorder.addSystem(systemC);
      
      const order = recorder.getVisitOrder();
      expect(order[0].id).toBe(1);
      expect(order[1].id).toBe(2);
      expect(order[2].id).toBe(3);
    });
  });
  
  describe('clear', () => {
    test('应清空所有数据', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemB);
      recorder.clear();
      
      expect(recorder.connections.size).toBe(0);
      expect(recorder.allSystems.size).toBe(0);
      expect(recorder.visitOrder).toHaveLength(0);
      expect(recorder.currentSystem).toBeNull();
    });
  });
  
  describe('hasPath', () => {
    test('空路径应返回 false', () => {
      expect(recorder.hasPath()).toBe(false);
    });
    
    test('有记录时应返回 true', () => {
      recorder.addSystem(systemA);
      expect(recorder.hasPath()).toBe(true);
    });
  });
  
  describe('边界情况', () => {
    test('应正确处理包含大量星系的路径', () => {
      for (let i = 1; i <= 100; i++) {
        recorder.addSystem({ id: i, name: `星系${i}`, regionID: 100 });
      }
      
      expect(recorder.visitOrder).toHaveLength(100);
      expect(recorder.connections.size).toBe(99);
    });
    
    test('循环路径应正确处理', () => {
      recorder.addSystem(systemA);
      recorder.addSystem(systemB);
      recorder.addSystem(systemC);
      recorder.addSystem(systemA); // 回到起点
      
      // 应该有 3 条连接：A-B, B-C, C-A
      expect(recorder.connections.size).toBe(3);
      expect(recorder.hasPath()).toBe(true);
    });
  });
});
