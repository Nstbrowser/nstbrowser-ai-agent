import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NstbrowserClient } from './nstbrowser-client.js';
import { resolveBrowserProfile } from './browser-profile-resolver.js';

describe('resolveBrowserProfile', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates a non-running UUID with a targeted profile search', async () => {
    vi.useFakeTimers();
    const profileId = 'a152a370-7866-461c-b858-6b8fdbd2ce4a';
    const getBrowsers = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { profileId, name: 'page 21 profile', running: true, remoteDebuggingPort: 9222 },
      ]);
    const getProfiles = vi.fn().mockResolvedValue([{ profileId, name: 'page 21 profile' }]);
    const client = {
      getBrowsers,
      getProfiles,
      startBrowser: vi.fn().mockResolvedValue(undefined),
    } as unknown as NstbrowserClient;

    const resolution = resolveBrowserProfile(client, {
      profile: profileId,
      nstHost: '127.0.0.1',
      nstPort: 8848,
      nstApiKey: 'test-key',
    });
    await vi.runAllTimersAsync();

    await expect(resolution).resolves.toMatchObject({
      profileId,
      profileName: 'page 21 profile',
      isRunning: true,
    });
    expect(getProfiles).toHaveBeenCalledWith({ name: profileId });
  });
});
