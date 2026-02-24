/**
 * @fileoverview FollowMode 测试 - TDD 方式
 * 测试角色跟随模式功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FollowMode } from '../../js/features/followMode.js';

describe('FollowMode', () => {
  let followMode;
  let mockRoleManager;
  let mockPathManager;
  let mockRenderer;

  beforeEach(() => {
    // 模拟依赖
    mockRoleManager = {
      getAllRoles: vi.fn().mockReturnValue([]),
      getRole: vi.fn(),
      startWatching: vi.fn(),
      stopWatching: vi.fn(),
      stopAllWatching: vi.fn(),
      onSystemChange: vi.fn(),
      parseCurrentSystem: vi.fn(),
      getCurrentSystem: vi.fn()
    };

    mockPathManager = {
      addSystem: vi.fn(),
      clear: vi.fn(),
      getPathData: vi.fn().mockReturnValue({ systems: [], connections: [] }),
      getDisplayPath: vi.fn().mockReturnValue([]),
      getDisplayConnections: vi.fn().mockReturnValue([])
    };

    mockRenderer = {
      centerOnSystem: vi.fn(),
      setPathData: vi.fn()
    };

    followMode = new FollowMode(mockRoleManager, mockPathManager, mockRenderer);
  });

  describe('模式切换', () => {
    it('应该默认是手动模式', () => {
      expect(followMode.isFollowing()).toBe(false);
      expect(followMode.getCurrentRole()).toBeNull();
    });

    it('应该能启动跟随模式', async () => {
      const mockRole = { name: 'TestRole', currentSystem: null };
      mockRoleManager.getRole.mockReturnValue(mockRole);
      mockRoleManager.parseCurrentSystem.mockResolvedValue({
        system: { id: 30000142, name: 'Jita' }
      });

      const result = await followMode.startFollowing('TestRole');

      expect(result).toBe(true);
      expect(followMode.isFollowing()).toBe(true);
      expect(followMode.getCurrentRole()).toBe('TestRole');
      expect(mockRoleManager.startWatching).toHaveBeenCalledWith('TestRole', 1000);
    });

    it('启动跟随模式时应该清空现有路径', async () => {
      const mockRole = { name: 'TestRole', currentSystem: null };
      mockRoleManager.getRole.mockReturnValue(mockRole);
      mockRoleManager.parseCurrentSystem.mockResolvedValue({
        system: { id: 30000142, name: 'Jita' }
      });

      await followMode.startFollowing('TestRole');

      expect(mockPathManager.clear).toHaveBeenCalled();
    });

    it('应该能停止跟随模式', async () => {
      const mockRole = { name: 'TestRole', currentSystem: null };
      mockRoleManager.getRole.mockReturnValue(mockRole);
      mockRoleManager.parseCurrentSystem.mockResolvedValue({
        system: { id: 30000142, name: 'Jita' }
      });

      await followMode.startFollowing('TestRole');
      followMode.stopFollowing();

      expect(followMode.isFollowing()).toBe(false);
      expect(followMode.getCurrentRole()).toBeNull();
      expect(mockRoleManager.stopWatching).toHaveBeenCalledWith('TestRole');
    });

    it('对不存在的角色应该返回 false', async () => {
      mockRoleManager.getRole.mockReturnValue(null);

      const result = await followMode.startFollowing('NonExistentRole');

      expect(result).toBe(false);
      expect(followMode.isFollowing()).toBe(false);
    });
  });

  describe('星系变化处理', () => {
    beforeEach(async () => {
      // 先启动跟随模式
      const mockRole = { name: 'TestRole', currentSystem: null };
      mockRoleManager.getRole.mockReturnValue(mockRole);
      mockRoleManager.getCurrentSystem.mockResolvedValue({
        system: { id: 30000142, name: 'Jita' }
      });
      
      await followMode.startFollowing('TestRole');
    });

    it('应该添加新星系到路径', async () => {
      const system = { id: 30000144, name: 'Perimeter', nameZh: '周边' };
      
      await followMode.handleSystemChange('TestRole', system);

      expect(mockPathManager.addSystem).toHaveBeenCalledWith(system);
      expect(mockRenderer.centerOnSystem).toHaveBeenCalledWith(system);
    });

    it('不应该重复添加相同的星系', async () => {
      // 先添加一个星系
      const system1 = { id: 30000144, name: 'Perimeter' };
      await followMode.handleSystemChange('TestRole', system1);
      
      // 重置 mock
      mockPathManager.addSystem.mockClear();
      
      // 再次添加同一星系
      await followMode.handleSystemChange('TestRole', system1);

      expect(mockPathManager.addSystem).not.toHaveBeenCalled();
    });

    it('应该在星系变化时更新渲染器', async () => {
      const system = { id: 30000144, name: 'Perimeter' };
      
      await followMode.handleSystemChange('TestRole', system);

      expect(mockRenderer.setPathData).toHaveBeenCalled();
    });

    it('不跟随的角色不应该触发路径添加', async () => {
      mockPathManager.addSystem.mockClear();
      const system = { id: 30000145, name: 'Other' };
      
      // 尝试处理其他角色的星系变化
      await followMode.handleSystemChange('OtherRole', system);

      expect(mockPathManager.addSystem).not.toHaveBeenCalled();
    });
  });

  describe('状态回调', () => {
    it('应该触发状态变化回调', async () => {
      const onStatusChange = vi.fn();
      followMode.onStatusChange(onStatusChange);

      const mockRole = { name: 'TestRole', currentSystem: null };
      mockRoleManager.getRole.mockReturnValue(mockRole);
      mockRoleManager.getCurrentSystem.mockResolvedValue({
        system: { id: 30000142, name: 'Jita' }
      });

      await followMode.startFollowing('TestRole');

      expect(onStatusChange).toHaveBeenCalledWith({
        isFollowing: true,
        role: 'TestRole',
        currentSystem: expect.any(Object)
      });
    });

    it('应该触发星系变化回调', async () => {
      const onSystemChange = vi.fn();
      followMode.onSystemChange(onSystemChange);

      // 先启动跟随模式
      const mockRole = { name: 'TestRole', currentSystem: null };
      mockRoleManager.getRole.mockReturnValue(mockRole);
      mockRoleManager.getCurrentSystem.mockResolvedValue({
        system: { id: 30000142, name: 'Jita' }
      });
      await followMode.startFollowing('TestRole');
      
      // 重置回调计数
      onSystemChange.mockClear();
      
      const system = { id: 30000144, name: 'Perimeter' };
      await followMode.handleSystemChange('TestRole', system);

      expect(onSystemChange).toHaveBeenCalledWith('TestRole', system);
    });
  });

  describe('获取角色状态', () => {
    it('应该返回所有可用角色', () => {
      const mockRoles = [
        { name: 'Role1', currentSystem: 30000142 },
        { name: 'Role2', currentSystem: null }
      ];
      mockRoleManager.getAllRoles.mockReturnValue(mockRoles);

      const roles = followMode.getAvailableRoles();

      expect(roles).toEqual(mockRoles);
    });

    it('应该返回当前角色信息', async () => {
      const mockRole = { 
        name: 'TestRole', 
        currentSystem: 30000142,
        isChineseClient: false,
        fileName: 'Local_TestRole.txt'
      };
      mockRoleManager.getRole.mockReturnValue(mockRole);
      mockRoleManager.getCurrentSystem.mockResolvedValue({
        original: 'Jita',
        system: { id: 30000142, name: 'Jita' }
      });

      await followMode.startFollowing('TestRole');
      const info = followMode.getCurrentRoleInfo();

      expect(info).toEqual(expect.objectContaining({
        name: 'TestRole',
        currentSystem: 30000142,
        isChineseClient: false
      }));
    });
  });
});
