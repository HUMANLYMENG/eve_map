/**
 * @fileoverview SystemNameResolver 测试 - TDD 方式
 * 测试星系名称中英文映射功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SystemNameResolver } from '../../js/data/systemNameResolver.js';

describe('SystemNameResolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new SystemNameResolver();
  });

  describe('中英文映射', () => {
    it('应该将英文星系名映射为中文', () => {
      expect(resolver.resolve('Jita')).toBe('吉他');
      expect(resolver.resolve('Perimeter')).toBe('周边');
      expect(resolver.resolve('Amarr')).toBe('艾玛');
    });

    it('应该将中文星系名映射为英文', () => {
      expect(resolver.resolve('吉他')).toBe('Jita');
      expect(resolver.resolve('周边')).toBe('Perimeter');
      expect(resolver.resolve('艾玛')).toBe('Amarr');
    });

    it('对于未知星系名应返回原名', () => {
      expect(resolver.resolve('UnknownSystem123')).toBe('UnknownSystem123');
      expect(resolver.resolve('未知星系')).toBe('未知星系');
    });

    it('应该处理带空格的名称', () => {
      expect(resolver.resolve('  Jita  ')).toBe('吉他');
      expect(resolver.resolve('  吉他  ')).toBe('Jita');
    });
  });

  describe('有效性检查', () => {
    it('应该能识别有效的英文星系名', () => {
      expect(resolver.isValidSystem('Jita')).toBe(true);
      expect(resolver.isValidSystem('UnknownSystem123')).toBe(false);
    });

    it('应该能识别有效的中文星系名', () => {
      expect(resolver.isValidSystem('吉他')).toBe(true);
      expect(resolver.isValidSystem('未知星系')).toBe(false);
    });

    it('应该能处理映射后的星系名', () => {
      // 即使传入英文，只要有对应中文映射就算有效
      expect(resolver.isValidSystem('Perimeter')).toBe(true);
      expect(resolver.isValidSystem('周边')).toBe(true);
    });
  });

  describe('批量获取', () => {
    it('应该能获取所有映射的键', () => {
      const enNames = resolver.getAllEnglishNames();
      expect(enNames).toContain('Jita');
      expect(enNames).toContain('Perimeter');
      expect(enNames.length).toBeGreaterThan(0);
    });

    it('应该能获取所有映射的值', () => {
      const zhNames = resolver.getAllChineseNames();
      expect(zhNames).toContain('吉他');
      expect(zhNames).toContain('周边');
      expect(zhNames.length).toBeGreaterThan(0);
    });
  });
});
