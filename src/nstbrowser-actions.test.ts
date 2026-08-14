import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeNstbrowserCommand } from './nstbrowser-actions.js';

vi.mock('./config-loader.js', () => ({
  loadNstConfig: () => ({ host: '127.0.0.1', port: 8848, apiKey: 'test-key' }),
}));

describe('Nstbrowser browser stop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns already stopped without sending a browser start or stop request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ err: false, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            err: false,
            data: {
              docs: [
                {
                  profileId: 'a152a370-7866-461c-b858-6b8fdbd2ce4a',
                  name: 'NST_901 [332]',
                  platform: 1,
                  kernel: '146',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      executeNstbrowserCommand({
        id: 'stop-test',
        action: 'nst_browser_stop',
        profileId: 'a152a370-7866-461c-b858-6b8fdbd2ce4a',
      })
    ).resolves.toEqual({
      id: 'stop-test',
      success: true,
      data: {
        stopped: false,
        alreadyStopped: true,
        profileId: 'a152a370-7866-461c-b858-6b8fdbd2ce4a',
        profileName: 'NST_901 [332]',
        message:
          'Browser for profile "NST_901 [332]" (ID: a152a370-7866-461c-b858-6b8fdbd2ce4a) is already stopped',
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'GET' });
  });
});
