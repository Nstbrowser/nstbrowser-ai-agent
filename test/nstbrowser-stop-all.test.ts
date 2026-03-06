/**
 * Test for nst browser stop-all command fix
 * Tests that stopAllBrowsers sends empty array as request body
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NstbrowserClient } from '../src/nstbrowser-client.js';

describe('NstbrowserClient.stopAllBrowsers', () => {
  let client: NstbrowserClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create client
    client = new NstbrowserClient('127.0.0.1', 8848, 'test-api-key');

    // Mock fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('should send empty array as request body when stopping all browsers', async () => {
    // Mock successful response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ err: false, data: null }),
    });

    // Call stopAllBrowsers
    await client.stopAllBrowsers();

    // Verify fetch was called with correct parameters
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8848/api/v2/browsers/', // Note: trailing slash required
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
        }),
        body: JSON.stringify([]), // Empty array as request body
      })
    );
  });

  it('should handle API errors correctly', async () => {
    // Mock error response
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'Invalid request' }),
    });

    // Call should throw error
    await expect(client.stopAllBrowsers()).rejects.toThrow();
  });

  it('should handle network errors correctly', async () => {
    // Mock network error
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    // Call should throw error
    await expect(client.stopAllBrowsers()).rejects.toThrow();
  });
});
