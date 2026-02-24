/**
 * @fileoverview RoleManager 测试 - TDD 方式
 * 测试角色管理功能（模拟文件系统）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoleManager } from '../../js/core/roleManager.js';

describe('RoleManager', () => {
  let manager;
  let mockDataLoader;

  beforeEach(() => {
    mockDataLoader = {
      systemsByName: new Map([
        ['Jita', { id: 30000142, name: 'Jita', nameZh: '吉他' }],
        ['吉他', { id: 30000142, name: 'Jita', nameZh: '吉他' }],
        ['Perimeter', { id: 30000144, name: 'Perimeter', nameZh: '周边' }],
        ['周边', { id: 30000144, name: 'Perimeter', nameZh: '周边' }],
      ])
    };
    
    manager = new RoleManager(mockDataLoader);
  });

  describe('角色扫描', () => {
    it('应该从 Local_*.txt 文件中识别角色', async () => {
      // 模拟文件对象（带 content 属性）
      const mockFiles = [
        { name: 'Local_20251226_104209_95988132.txt', kind: 'file', content: '  Listener:        Role1' },
        { name: 'Alliance_20251226_104209_95988132.txt', kind: 'file', content: '  Listener:        Role2' },
        { name: 'Local_20251226_114209_95988133.txt', kind: 'file', content: '  Listener:        Role3' },
      ];

      const roles = await manager.scanRoles(mockFiles);
      
      // 应该只识别 Local_ 开头的文件
      expect(roles.length).toBe(2);
      expect(roles[0].name).toBe('Role1');
      expect(roles[1].name).toBe('Role3');
    });

    it('应该识别中文本地频道文件名', async () => {
      const mockFiles = [
        { name: '本地_20251226_104209_95988132.txt', kind: 'file', content: '  侦听器:          中文角色' },
      ];

      const roles = await manager.scanRoles(mockFiles);
      expect(roles.length).toBe(1);
      expect(roles[0].name).toBe('中文角色');
      expect(roles[0].isChineseClient).toBe(true);
    });
  });

  describe('角色信息提取', () => {
    it('应该从英文日志中提取角色名', async () => {
      const englishLog = '  Listener:        Crack1ngBanana';
      
      const roleInfo = await manager.extractRoleInfoFromContent(englishLog);
      
      expect(roleInfo).not.toBeNull();
      expect(roleInfo.name).toBe('Crack1ngBanana');
      expect(roleInfo.isChineseClient).toBe(false);
    });

    it('应该从中文日志中提取角色名', async () => {
      const chineseLog = '  侦听器:          测试角色';
      
      const roleInfo = await manager.extractRoleInfoFromContent(chineseLog);
      
      expect(roleInfo).not.toBeNull();
      expect(roleInfo.name).toBe('测试角色');
      expect(roleInfo.isChineseClient).toBe(true);
    });

    it('应该检测中文客户端', () => {
      const chineseLog = '[ 2025.12.26 10:42:13 ] EVE 系统 > 频道更换为本地 : 吉他';
      expect(manager.detectChineseClient(chineseLog)).toBe(true);

      const englishLog = '[ 2025.12.26 10:42:13 ] EVE System > Channel changed to Local : Jita';
      expect(manager.detectChineseClient(englishLog)).toBe(false);
    });
  });

  describe('当前星系获取', () => {
    beforeEach(() => {
      manager.roles.set('TestRole', {
        name: 'TestRole',
        isChineseClient: false
      });
    });

    it('应该获取英文客户端的当前星系', async () => {
      const logContent = `
        Listener: TestRole
        [ 2025.12.26 10:42:13 ] EVE System > Channel changed to Local : Jita
      `;

      const result = await manager.parseCurrentSystem(logContent);
      
      expect(result).not.toBeNull();
      expect(result.original).toBe('Jita');
      expect(result.system.id).toBe(30000142);
    });

    it('应该获取中文客户端的当前星系', async () => {
      const logContent = `
        Listener: 测试角色
        [ 2025.12.26 10:42:13 ] EVE 系统 > 频道更换为本地 : 吉他
      `;

      const result = await manager.parseCurrentSystem(logContent);
      
      expect(result).not.toBeNull();
      expect(result.original).toBe('吉他');
      expect(result.system.id).toBe(30000142);
    });

    it('应该获取最后一条星系变化记录', async () => {
      const logContent = `
        [ 2025.12.26 10:40:00 ] Channel changed to Local : Jita
        [ 2025.12.26 10:41:00 ] Channel changed to Local : Perimeter
        [ 2025.12.26 10:42:00 ] Channel changed to Local : 吉他
      `;

      const result = await manager.parseCurrentSystem(logContent);
      
      expect(result.original).toBe('吉他');
      expect(result.system.id).toBe(30000142);
    });

    it('应该处理带 * 标记的星系名', async () => {
      const logContent = `
        [ 2025.12.26 10:42:13 ] EVE System > Channel changed to Local : Jita*
      `;

      const result = await manager.parseCurrentSystem(logContent);
      
      expect(result.original).toBe('Jita');
      expect(result.system.id).toBe(30000142);
    });

    it('对于未知星系应该返回 null', async () => {
      const logContent = `
        [ 2025.12.26 10:42:13 ] EVE System > Channel changed to Local : UnknownSystem
      `;

      const result = await manager.parseCurrentSystem(logContent);
      
      expect(result).toBeNull();
    });
  });

  describe('星系变化回调', () => {
    it('应该在星系变化时触发回调', async () => {
      const callback = vi.fn();
      manager.onSystemChange(callback);

      // 模拟星系变化
      manager.notifySystemChange('TestRole', 'Jita');

      expect(callback).toHaveBeenCalledWith('TestRole', expect.objectContaining({
        id: 30000142,
        name: 'Jita'
      }));
    });
  });
});
