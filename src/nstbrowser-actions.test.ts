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

  it('stops a running profile by its exact browser name', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            err: false,
            data: [
              {
                profileId: 'a152a370-7866-461c-b858-6b8fdbd2ce4a',
                name: 'NST_901 [332]',
                running: true,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ err: false, data: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      executeNstbrowserCommand({
        id: 'stop-name-test',
        action: 'nst_browser_stop',
        profileId: 'NST_901 [332]',
      })
    ).resolves.toMatchObject({
      success: true,
      data: {
        stopped: true,
        profileId: 'a152a370-7866-461c-b858-6b8fdbd2ce4a',
        profileName: 'NST_901 [332]',
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/api/v2/browsers/a152a370-7866-461c-b858-6b8fdbd2ce4a'
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  });

  it('does not guess when multiple running profiles have the same name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          err: false,
          data: [
            { profileId: 'profile-1', name: 'Duplicate', running: true },
            { profileId: 'profile-2', name: 'Duplicate', running: true },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      executeNstbrowserCommand({
        id: 'stop-duplicate-name-test',
        action: 'nst_browser_stop',
        profileId: 'Duplicate',
      })
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('Use the profile ID'),
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
