/**
 * @fileoverview LogParser 测试 - TDD 方式
 * 测试日志解析器的中英文识别功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LogParser } from '../../js/core/logParser.js';

describe('LogParser', () => {
  let parser;

  beforeEach(() => {
    parser = new LogParser();
  });

  describe('角色识别 (Listener)', () => {
    it('应该识别英文客户端的角色名', () => {
      const line = '  Listener:        Crack1ngBanana';
      const result = parser.parseLine(line);
      
      expect(result).not.toBeNull();
      expect(result.type).toBe('listener');
      expect(result.role).toBe('Crack1ngBanana');
    });

    it('应该识别中文客户端的角色名', () => {
      const line = '  侦听器:          测试角色';
      const result = parser.parseLine(line);
      
      expect(result).not.toBeNull();
      expect(result.type).toBe('listener');
      expect(result.role).toBe('测试角色');
    });

    it('应该处理带空格的角色名', () => {
      const line = '  Listener:        Test Character';
      const result = parser.parseLine(line);
      
      expect(result).not.toBeNull();
      expect(result.role).toBe('Test Character');
    });
  });

  describe('星系变化识别 (System Change)', () => {
    it('应该识别英文客户端的星系变化', () => {
      const line = '[ 2025.12.26 10:42:13 ] EVE System > Channel changed to Local : Jita';
      const result = parser.parseLine(line);
      
      expect(result).not.toBeNull();
      expect(result.type).toBe('system_change');
      expect(result.system).toBe('Jita');
    });

    it('应该识别中文客户端的星系变化', () => {
      const line = '[ 2025.12.26 10:42:13 ] EVE 系统 > 频道更换为本地 : 吉他';
      const result = parser.parseLine(line);
      
      expect(result).not.toBeNull();
      expect(result.type).toBe('system_change');
      expect(result.system).toBe('吉他');
    });

    it('应该处理带 * 标记的星系名', () => {
      const line = '[ 2025.12.26 10:42:13 ] EVE System > Channel changed to Local : Jita*';
      const result = parser.parseLine(line);
      
      expect(result).not.toBeNull();
      expect(result.system).toBe('Jita');
    });

    it('应该处理中英文混合的星系名', () => {
      const line = '[ 2025.12.26 10:42:13 ] EVE 系统 > 频道更换为本地 : Perimeter';
      const result = parser.parseLine(line);
      
      expect(result).not.toBeNull();
      expect(result.system).toBe('Perimeter');
    });
  });

  describe('清理星系名称', () => {
    it('应该去掉尾部的 *', () => {
      expect(parser.cleanSystemName('Jita*')).toBe('Jita');
      expect(parser.cleanSystemName('  吉他  *  ')).toBe('吉他');
    });

    it('应该去掉前后空格', () => {
      expect(parser.cleanSystemName('  Jita  ')).toBe('Jita');
      expect(parser.cleanSystemName('\t吉他\n')).toBe('吉他');
    });
  });

  describe('无法识别的行', () => {
    it('应该返回 null 对于无关内容', () => {
      const lines = [
        '  Channel ID:      local',
        '  Session started: 2025.12.26 10:42:09',
        '',
        '[ 2025.12.26 10:42:10 ] Crack1ngBanana > Hello',
      ];

      lines.forEach(line => {
        expect(parser.parseLine(line)).toBeNull();
      });
    });
  });
});
