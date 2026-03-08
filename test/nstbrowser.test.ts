import { describe, it, expect } from 'vitest';
import { parseCommand } from '../src/protocol.js';

describe('Nstbrowser command validation', () => {
  // Browser management commands
  describe('nst_browser_list', () => {
    it('accepts nst_browser_list command', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_list' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('nst_browser_start', () => {
    it('accepts nst_browser_start with profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_start', profileId: 'profile-123' })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_browser_start with options', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_browser_start',
          profileId: 'profile-123',
          headless: true,
          autoClose: false
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_browser_start without profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_start' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nst_browser_stop', () => {
    it('accepts nst_browser_stop with profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_stop', profileId: 'profile-123' })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_browser_stop without profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_stop' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nst_browser_stop_all', () => {
    it('accepts nst_browser_stop_all command', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_stop_all' })
      );
      expect(result.success).toBe(true);
    });
  });

  // Profile management commands
  describe('nst_profile_list', () => {
    it('accepts nst_profile_list command', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_list' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('nst_profile_create', () => {
    it('accepts nst_profile_create with name', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_create', name: 'test-profile' })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_create with proxy config', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_create',
          name: 'test-profile',
          proxyConfig: {
            host: '127.0.0.1',
            port: 8080,
            type: 'http',
            enabled: true
          }
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_profile_create without name', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_create' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nst_profile_delete', () => {
    it('accepts nst_profile_delete with single profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_delete', profileIds: ['profile-123'] })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_delete with multiple profileIds', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_delete',
          profileIds: ['profile-1', 'profile-2', 'profile-3']
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_profile_delete without profileIds', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_delete' })
      );
      expect(result.success).toBe(false);
    });

    it('rejects nst_profile_delete with empty profileIds array', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_delete', profileIds: [] })
      );
      expect(result.success).toBe(false);
    });
  });

  // Proxy management commands
  describe('nst_profile_proxy_update', () => {
    it('accepts nst_profile_proxy_update with required fields', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_proxy_update',
          profileId: 'profile-123',
          proxyConfig: {
            host: '127.0.0.1',
            port: 8080,
            type: 'http'
          }
        })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_proxy_update with authentication', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_proxy_update',
          profileId: 'profile-123',
          proxyConfig: {
            host: 'proxy.example.com',
            port: 8080,
            type: 'http',
            user: 'username',
            password: 'password'
          }
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_profile_proxy_update without profileId', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_proxy_update',
          proxyConfig: { host: '127.0.0.1', port: 8080, type: 'http' }
        })
      );
      expect(result.success).toBe(false);
    });

    it('rejects nst_profile_proxy_update without proxyConfig', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_proxy_update', profileId: 'profile-123' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nst_profile_proxy_reset', () => {
    it('accepts nst_profile_proxy_reset with single profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_proxy_reset', profileIds: ['profile-123'] })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_proxy_reset with multiple profileIds', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_proxy_reset',
          profileIds: ['profile-1', 'profile-2']
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_profile_proxy_reset without profileIds', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_proxy_reset' })
      );
      expect(result.success).toBe(false);
    });
  });

  // Tag management commands
  describe('nst_profile_tags_list', () => {
    it('accepts nst_profile_tags_list command', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_tags_list' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('nst_profile_tags_create', () => {
    it('accepts nst_profile_tags_create with profileId and tag', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_tags_create',
          profileId: 'profile-123',
          tag: 'production'
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_profile_tags_create without profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_tags_create', tag: 'production' })
      );
      expect(result.success).toBe(false);
    });

    it('rejects nst_profile_tags_create without tag', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_tags_create', profileId: 'profile-123' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nst_profile_tags_clear', () => {
    it('accepts nst_profile_tags_clear with single profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_tags_clear', profileIds: ['profile-123'] })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_tags_clear with multiple profileIds', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_tags_clear',
          profileIds: ['profile-1', 'profile-2']
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_profile_tags_clear without profileIds', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_tags_clear' })
      );
      expect(result.success).toBe(false);
    });
  });

  // Group management commands
  describe('nst_profile_groups_list', () => {
    it('accepts nst_profile_groups_list command', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_groups_list' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('nst_profile_group_change', () => {
    it('accepts nst_profile_group_change with single profileId', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_group_change',
          groupId: 'group-123',
          profileIds: ['profile-123']
        })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_group_change with multiple profileIds', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_group_change',
          groupId: 'group-123',
          profileIds: ['profile-1', 'profile-2']
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_profile_group_change without groupId', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_group_change',
          profileIds: ['profile-123']
        })
      );
      expect(result.success).toBe(false);
    });

    it('rejects nst_profile_group_change without profileIds', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_group_change', groupId: 'group-123' })
      );
      expect(result.success).toBe(false);
    });
  });

  // Data management commands
  describe('nst_profile_cache_clear', () => {
    it('accepts nst_profile_cache_clear with single profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_cache_clear', profileIds: ['profile-123'] })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_cache_clear with multiple profileIds', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_cache_clear',
          profileIds: ['profile-1', 'profile-2']
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_profile_cache_clear without profileIds', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_cache_clear' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nst_profile_cookies_clear', () => {
    it('accepts nst_profile_cookies_clear with single profileId', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_cookies_clear',
          profileIds: ['profile-123']
        })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_cookies_clear with multiple profileIds', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_cookies_clear',
          profileIds: ['profile-1', 'profile-2']
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_profile_cookies_clear without profileIds', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_cookies_clear' })
      );
      expect(result.success).toBe(false);
    });
  });

  // New commands - Batch operations and CDP endpoints
  describe('nst_browser_start_batch', () => {
    it('accepts nst_browser_start_batch with profileIds array', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_browser_start_batch',
          profileIds: ['profile-1', 'profile-2', 'profile-3']
        })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_browser_start_batch with config options', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_browser_start_batch',
          profileIds: ['profile-1', 'profile-2'],
          config: {
            headless: true,
            autoClose: false,
            proxyEnabled: true
          }
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_browser_start_batch without profileIds', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_start_batch' })
      );
      expect(result.success).toBe(false);
    });

    it('rejects nst_browser_start_batch with empty profileIds array', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_start_batch', profileIds: [] })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nst_browser_start_once', () => {
    it('accepts nst_browser_start_once without config', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_start_once' })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_browser_start_once with config', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_browser_start_once',
          config: {
            platform: 'Windows',
            headless: true,
            autoClose: true
          }
        })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_browser_start_once with fingerprint config', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_browser_start_once',
          config: {
            platform: 'macOS',
            kernel: 'chrome',
            fingerprint: {
              userAgent: 'custom-ua',
              language: 'en-US'
            }
          }
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('nst_profile_list_cursor', () => {
    it('accepts nst_profile_list_cursor without parameters', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_profile_list_cursor' })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_list_cursor with cursor', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_list_cursor',
          cursor: 'cursor-token-123'
        })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_list_cursor with pageSize', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_list_cursor',
          pageSize: 50
        })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_list_cursor with direction', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_list_cursor',
          cursor: 'cursor-123',
          direction: 'next'
        })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_profile_list_cursor with all parameters', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_profile_list_cursor',
          cursor: 'cursor-123',
          pageSize: 25,
          direction: 'prev'
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('nst_browser_connect', () => {
    it('accepts nst_browser_connect with profileId', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_browser_connect',
          profileId: 'profile-123'
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_browser_connect without profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_connect' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nst_browser_connect_once', () => {
    it('accepts nst_browser_connect_once without config', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_connect_once' })
      );
      expect(result.success).toBe(true);
    });

    it('accepts nst_browser_connect_once with config', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_browser_connect_once',
          config: {
            platform: 'Linux',
            kernel: 'firefox'
          }
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('nst_browser_cdp_url', () => {
    it('accepts nst_browser_cdp_url with profileId', () => {
      const result = parseCommand(
        JSON.stringify({
          id: '1',
          action: 'nst_browser_cdp_url',
          profileId: 'profile-123'
        })
      );
      expect(result.success).toBe(true);
    });

    it('rejects nst_browser_cdp_url without profileId', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_cdp_url' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nst_browser_cdp_url_once', () => {
    it('accepts nst_browser_cdp_url_once command', () => {
      const result = parseCommand(
        JSON.stringify({ id: '1', action: 'nst_browser_cdp_url_once' })
      );
      expect(result.success).toBe(true);
    });
  });
});
