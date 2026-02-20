/**
 * 事件总线单元测试
 */

import { describe, test, expect, vi } from 'vitest';
import { EventBus, Events } from '../../../js/core/eventBus.js';

describe('EventBus', () => {
  describe('基本功能', () => {
    test('应正确订阅和触发事件', () => {
      const bus = new EventBus();
      const callback = vi.fn();
      
      bus.on('test', callback);
      bus.emit('test', { data: 123 });
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ data: 123 });
    });
    
    test('应支持多个订阅者', () => {
      const bus = new EventBus();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      bus.on('test', callback1);
      bus.on('test', callback2);
      bus.emit('test', 'data');
      
      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });
    
    test('应正确取消订阅', () => {
      const bus = new EventBus();
      const callback = vi.fn();
      
      bus.on('test', callback);
      bus.off('test', callback);
      bus.emit('test', 'data');
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    test('返回的函数应能取消订阅', () => {
      const bus = new EventBus();
      const callback = vi.fn();
      
      const unsubscribe = bus.on('test', callback);
      unsubscribe();
      bus.emit('test', 'data');
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  describe('once', () => {
    test('应只触发一次', () => {
      const bus = new EventBus();
      const callback = vi.fn();
      
      bus.once('test', callback);
      bus.emit('test', 1);
      bus.emit('test', 2);
      bus.emit('test', 3);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(1);
    });
  });
  
  describe('错误处理', () => {
    test('不应因一个处理器错误而影响其他', () => {
      const bus = new EventBus();
      const errorCallback = vi.fn(() => { throw new Error('test error'); });
      const normalCallback = vi.fn();
      
      bus.on('test', errorCallback);
      bus.on('test', normalCallback);
      
      // 不应抛出
      expect(() => bus.emit('test', 'data')).not.toThrow();
      
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });
  
  describe('clear', () => {
    test('应清空所有事件', () => {
      const bus = new EventBus();
      const callback = vi.fn();
      
      bus.on('test1', callback);
      bus.on('test2', callback);
      bus.clear();
      bus.emit('test1');
      bus.emit('test2');
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  describe('预定义事件', () => {
    test('应包含所有必要的事件常量', () => {
      expect(Events.SYSTEM_SELECT).toBe('system:select');
      expect(Events.SYSTEM_HOVER).toBe('system:hover');
      expect(Events.REGION_CHANGE).toBe('region:change');
      expect(Events.PATH_UPDATE).toBe('path:update');
      expect(Events.WORMHOLE_DETECTED).toBe('wormhole:detected');
      expect(Events.SEARCH_SELECT).toBe('search:select');
      expect(Events.VIEW_RESET).toBe('view:reset');
    });
  });
});
