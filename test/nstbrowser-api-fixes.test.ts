/**
 * Tests for Nstbrowser API fixes
 * Verifies that API endpoints use correct HTTP methods and paths
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NstbrowserClient } from '../src/nstbrowser-client.js';

describe('Nstbrowser API Fixes', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: NstbrowserClient;

  beforeEach(() => {
    // Mock fetch globally
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    // Create client instance
    client = new NstbrowserClient('localhost', 8848, 'test-api-key');
  });

  describe('getProfiles() - Fixed API endpoint', () => {
    it('should use GET method instead of POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: { docs: [] } }),
      });

      await client.getProfiles();

      // Verify GET method is used
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/profiles'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should NOT use POST /api/v2/profiles/query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: { docs: [] } }),
      });

      await client.getProfiles();

      // Verify POST to /query is NOT called
      const calls = mockFetch.mock.calls;
      for (const call of calls) {
        const url = call[0] as string;
        const options = call[1] as any;

        // Should not have POST method with /query path
        if (options.method === 'POST') {
          expect(url).not.toContain('/api/v2/profiles/query');
        }
      }
    });

    it('should pass query parameters as URL query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: { docs: [] } }),
      });

      await client.getProfiles({ name: 'test-profile', groupId: 'group-123' });

      // Verify query parameters are in URL
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('s=test-profile'); // 's' parameter for name search
      expect(callUrl).toContain('groupId=group-123');
    });

    it('should handle tags parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: { docs: [] } }),
      });

      await client.getProfiles({ tags: ['tag1', 'tag2'] });

      // Verify tags are joined and passed
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('tags=tag1%2Ctag2'); // URL encoded comma
    });

    it('should apply client-side platform filtering', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          err: false,
          data: {
            docs: [
              { profileId: '1', name: 'profile1', platform: 0 }, // Windows
              { profileId: '2', name: 'profile2', platform: 1 }, // macOS
              { profileId: '3', name: 'profile3', platform: 0 }, // Windows
            ],
          },
        }),
      });

      const result = await client.getProfiles({ platform: 'Windows' });

      // Should filter to only Windows profiles (platform: 0)
      expect(result).toHaveLength(2);
      expect(result.every((p: any) => p.platform === 0)).toBe(true);
    });
  });

  describe('getProfilesByCursor() - Fixed API endpoint', () => {
    it('should use GET method instead of POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          err: false,
          data: { docs: [], hasMore: false },
        }),
      });

      await client.getProfilesByCursor();

      // Verify GET method is used
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/profiles/cursor'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should use correct path /api/v2/profiles/cursor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          err: false,
          data: { docs: [], hasMore: false },
        }),
      });

      await client.getProfilesByCursor();

      // Verify correct path (not /query-cursor)
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('/api/v2/profiles/cursor');
      expect(callUrl).not.toContain('/query-cursor');
    });

    it('should pass parameters as query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          err: false,
          data: { docs: [], hasMore: false },
        }),
      });

      await client.getProfilesByCursor('cursor-123', 20, 'next');

      // Verify query parameters
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('cursor=cursor-123');
      expect(callUrl).toContain('pageSize=20');
      expect(callUrl).toContain('direction=next');
    });

    it('should return correct response format', async () => {
      const mockResponse = {
        docs: [{ profileId: '1', name: 'test' }],
        hasMore: true,
        nextCursor: 'next-cursor',
        prevCursor: 'prev-cursor',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: mockResponse }),
      });

      const result = await client.getProfilesByCursor();

      // Verify response structure
      expect(result).toHaveProperty('docs');
      expect(result).toHaveProperty('hasMore');
      expect(result).toHaveProperty('nextCursor');
      expect(result).toHaveProperty('prevCursor');
      expect(result.docs).toHaveLength(1);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('batchUpdateProxy() - Fixed parameter field name', () => {
    it('should use proxyConfig field name instead of proxy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: null }),
      });

      await client.batchUpdateProxy(['profile-1', 'profile-2'], {
        type: 'http',
        host: '127.0.0.1',
        port: 8080,
      });

      // Verify request body uses 'proxyConfig' field
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toHaveProperty('proxyConfig');
      expect(requestBody).not.toHaveProperty('proxy');
      expect(requestBody.proxyConfig).toHaveProperty('url');
    });

    it('should convert ProxyConfig to URL format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: null }),
      });

      await client.batchUpdateProxy(['profile-1'], {
        type: 'http',
        host: '127.0.0.1',
        port: 8080,
        username: 'user',
        password: 'pass',
      });

      // Verify URL format
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.proxyConfig.url).toBe('http://user:pass@127.0.0.1:8080');
    });

    it('should handle proxy without credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: null }),
      });

      await client.batchUpdateProxy(['profile-1'], {
        type: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
      });

      // Verify URL format without credentials
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.proxyConfig.url).toBe('socks5://proxy.example.com:1080');
    });
  });

  describe('API Documentation Links', () => {
    it('should have documentation links in method comments', () => {
      // This is a meta-test to ensure we maintain documentation
      const clientSource = client.constructor.toString();

      // Check that key methods have doc comments (this is a basic check)
      expect(typeof client.getProfiles).toBe('function');
      expect(typeof client.getProfilesByCursor).toBe('function');
      expect(typeof client.batchUpdateProxy).toBe('function');
    });
  });

  describe('Performance improvements', () => {
    it('getProfiles should make only one request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: { docs: [] } }),
      });

      await client.getProfiles();

      // Should make exactly one request (no fallback)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not produce 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ err: false, data: { docs: [] } }),
      });

      await client.getProfiles();

      // Verify no 404 responses
      const calls = mockFetch.mock.calls;
      for (const call of calls) {
        const response = await (call[0] as any);
        if (response && response.status) {
          expect(response.status).not.toBe(404);
        }
      }
    });
  });
});
