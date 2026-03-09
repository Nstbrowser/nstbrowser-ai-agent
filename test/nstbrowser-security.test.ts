import { describe, it, expect, beforeEach } from 'vitest';
import {
  maskApiKey,
  maskPassword,
  maskProxyUrl,
  maskSensitiveString,
  sanitizeObject,
  sanitizeLogData,
  createSafeErrorMessage,
  getMaskedEnvVars,
  addAuditLogEntry,
  getAuditLog,
  clearAuditLog,
} from '../src/nstbrowser-security.js';

describe('nstbrowser-security', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  describe('maskApiKey', () => {
    it('should mask short keys completely', () => {
      expect(maskApiKey('short')).toBe('***');
      expect(maskApiKey('12345678')).toBe('***');
    });

    it('should show first and last 4 characters for long keys', () => {
      expect(maskApiKey('abcdefghijklmnopqrstuvwxyz')).toBe('abcd...wxyz');
      expect(maskApiKey('1234567890abcdefghijklmnop')).toBe('1234...mnop');
    });

    it('should handle empty or invalid input', () => {
      expect(maskApiKey('')).toBe('***');
      expect(maskApiKey(null as any)).toBe('***');
      expect(maskApiKey(undefined as any)).toBe('***');
    });
  });

  describe('maskPassword', () => {
    it('should mask passwords completely', () => {
      expect(maskPassword('password123')).toBe('***');
      expect(maskPassword('secret')).toBe('***');
    });

    it('should handle empty or invalid input', () => {
      expect(maskPassword('')).toBe('');
      expect(maskPassword(null as any)).toBe('');
      expect(maskPassword(undefined as any)).toBe('');
    });
  });

  describe('maskProxyUrl', () => {
    it('should mask credentials in proxy URLs', () => {
      expect(maskProxyUrl('http://user:pass@proxy.com:8080')).toBe('http://***:***@proxy.com:8080');
      expect(maskProxyUrl('https://admin:secret@proxy.example.com:3128')).toBe(
        'https://***:***@proxy.example.com:3128'
      );
    });

    it('should not modify URLs without credentials', () => {
      expect(maskProxyUrl('http://proxy.com:8080')).toBe('http://proxy.com:8080');
      expect(maskProxyUrl('https://example.com')).toBe('https://example.com');
    });

    it('should handle invalid input', () => {
      expect(maskProxyUrl('')).toBe('');
      expect(maskProxyUrl(null as any)).toBe(null);
    });
  });

  describe('maskSensitiveString', () => {
    it('should mask Bearer tokens', () => {
      const input = 'Authorization: Bearer abc123def456ghi789';
      const output = maskSensitiveString(input);
      expect(output).toBe('Authorization: Bearer ***');
    });

    it('should mask Basic auth', () => {
      const input = 'Authorization: Basic YWRtaW46cGFzc3dvcmQ=';
      const output = maskSensitiveString(input);
      expect(output).toBe('Authorization: Basic ***');
    });

    it('should mask URLs with credentials', () => {
      const input = 'Connecting to http://user:pass@proxy.com:8080';
      const output = maskSensitiveString(input);
      expect(output).toBe('Connecting to http://***:***@proxy.com:8080');
    });
  });

  describe('sanitizeObject', () => {
    it('should mask sensitive fields', () => {
      const input = {
        name: 'test',
        apiKey: 'secret-key-12345678',
        password: 'mypassword',
        username: 'user',
      };

      const output = sanitizeObject(input);
      expect(output).toEqual({
        name: 'test',
        apiKey: 'secr...5678',
        password: '***',
        username: 'user',
      });
    });

    it('should handle nested objects', () => {
      const input = {
        config: {
          apiKey: 'secret-key-12345678',
          proxy: {
            host: 'proxy.com',
            password: 'proxypass',
          },
        },
      };

      const output = sanitizeObject(input);
      expect(output).toEqual({
        config: {
          apiKey: 'secr...5678',
          proxy: {
            host: 'proxy.com',
            password: '***',
          },
        },
      });
    });

    it('should handle arrays', () => {
      const input = {
        profiles: [
          { name: 'profile1', apiKey: 'key1-12345678' },
          { name: 'profile2', apiKey: 'key2-87654321' },
        ],
      };

      const output = sanitizeObject(input);
      expect(output).toEqual({
        profiles: [
          { name: 'profile1', apiKey: 'key1...5678' },
          { name: 'profile2', apiKey: 'key2...4321' },
        ],
      });
    });

    it('should handle proxy URLs', () => {
      const input = {
        proxyUrl: 'http://user:pass@proxy.com:8080',
      };

      const output = sanitizeObject(input);
      expect(output).toEqual({
        proxyUrl: 'http://***:***@proxy.com:8080',
      });
    });

    it('should prevent infinite recursion', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // Should not throw, should handle gracefully
      const output = sanitizeObject(circular);
      expect(output).toBeDefined();
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });

    it('should handle primitives', () => {
      expect(sanitizeObject('string')).toBe('string');
      expect(sanitizeObject(123)).toBe(123);
      expect(sanitizeObject(true)).toBe(true);
    });
  });

  describe('sanitizeLogData', () => {
    it('should be an alias for sanitizeObject', () => {
      const input = {
        apiKey: 'secret-key-12345678',
        data: 'normal data',
      };

      const output = sanitizeLogData(input);
      expect(output).toEqual({
        apiKey: 'secr...5678',
        data: 'normal data',
      });
    });
  });

  describe('createSafeErrorMessage', () => {
    it('should mask sensitive data in error messages', () => {
      const error = new Error('Failed to connect with apiKey: abcdefghijklmnopqrstuvwxyz123456');
      const message = createSafeErrorMessage(error);
      expect(message).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
      expect(message).toContain('abcd...3456');
    });

    it('should include sanitized context', () => {
      const error = new Error('Connection failed');
      const context = {
        apiKey: 'secret-key-12345678',
        host: 'localhost',
      };

      const message = createSafeErrorMessage(error, context);
      expect(message).toContain('Connection failed');
      expect(message).toContain('localhost');
      expect(message).not.toContain('secret-key-12345678');
      expect(message).toContain('secr...5678');
    });

    it('should handle non-Error objects', () => {
      const message = createSafeErrorMessage('Simple error string');
      expect(message).toBe('Simple error string');
    });
  });

  describe('getMaskedEnvVars', () => {
    it('should mask sensitive environment variables', () => {
      const originalEnv = process.env.NST_API_KEY;
      process.env.NST_API_KEY = 'test-key-12345678';
      process.env.NST_HOST = 'localhost';

      const masked = getMaskedEnvVars();

      expect(masked.NST_API_KEY).toBe('test...5678');
      expect(masked.NST_HOST).toBe('localhost');

      // Restore
      if (originalEnv) {
        process.env.NST_API_KEY = originalEnv;
      } else {
        delete process.env.NST_API_KEY;
      }
      delete process.env.NST_HOST;
    });

    it('should only include relevant environment variables', () => {
      const masked = getMaskedEnvVars();
      const keys = Object.keys(masked);

      // Should not include random env vars
      expect(keys.every(k => k.startsWith('NST') || k.startsWith('NSTBROWSER'))).toBe(true);
    });
  });

  describe('audit log', () => {
    it('should add entries to audit log', () => {
      addAuditLogEntry({
        action: 'profile_create',
        resource: 'profile-123',
        result: 'success',
      });

      const log = getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].action).toBe('profile_create');
      expect(log[0].resource).toBe('profile-123');
      expect(log[0].result).toBe('success');
      expect(log[0].timestamp).toBeDefined();
    });

    it('should sanitize sensitive data in audit log', () => {
      addAuditLogEntry({
        action: 'profile_create',
        resource: 'profile-123',
        result: 'success',
        details: {
          apiKey: 'secret-key-12345678',
          name: 'test-profile',
        },
      });

      const log = getAuditLog();
      expect(log[0].details?.apiKey).toBe('secr...5678');
      expect(log[0].details?.name).toBe('test-profile');
    });

    it('should limit audit log size', () => {
      // Add more than MAX_AUDIT_LOG_SIZE entries
      for (let i = 0; i < 1100; i++) {
        addAuditLogEntry({
          action: `action_${i}`,
          resource: `resource_${i}`,
          result: 'success',
        });
      }

      const log = getAuditLog();
      expect(log.length).toBeLessThanOrEqual(1000);
    });

    it('should support limiting returned entries', () => {
      for (let i = 0; i < 10; i++) {
        addAuditLogEntry({
          action: `action_${i}`,
          resource: `resource_${i}`,
          result: 'success',
        });
      }

      const log = getAuditLog(5);
      expect(log).toHaveLength(5);
      // Should return last 5 entries
      expect(log[0].action).toBe('action_5');
      expect(log[4].action).toBe('action_9');
    });

    it('should clear audit log', () => {
      addAuditLogEntry({
        action: 'test',
        resource: 'test',
        result: 'success',
      });

      expect(getAuditLog()).toHaveLength(1);

      clearAuditLog();
      expect(getAuditLog()).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle objects with special characters in keys', () => {
      const input = {
        'api-key': 'secret-key-12345678',
        'proxy.password': 'proxypass',
      };

      const output = sanitizeObject(input);
      expect(output).toEqual({
        'api-key': 'secr...5678',
        'proxy.password': '***',
      });
    });

    it('should handle very long strings', () => {
      const longKey = 'a'.repeat(1000);
      const masked = maskApiKey(longKey);
      expect(masked).toBe('aaaa...aaaa');
      expect(masked.length).toBeLessThan(20);
    });

    it('should handle objects with many nested levels', () => {
      const deep: any = { level: 0 };
      let current = deep;
      for (let i = 1; i < 15; i++) {
        current.nested = { level: i };
        current = current.nested;
      }
      current.apiKey = 'secret-key-12345678';

      const output = sanitizeObject(deep);
      expect(output).toBeDefined();
      // Should stop at max depth
    });
  });
});
