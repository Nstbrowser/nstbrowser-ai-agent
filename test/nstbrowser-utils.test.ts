import { describe, expect, it, vi } from 'vitest';

import type { NstbrowserClient } from '../src/nstbrowser-client.js';
import { getProfileByNameOrId, resolveProfileId } from '../src/nstbrowser-utils.js';

describe('resolveProfileId', () => {
  it('passes UUIDs directly to the profile-specific API', async () => {
    const getProfiles = vi.fn();
    const client = { getProfiles } as unknown as NstbrowserClient;
    const profileId = '5ded83ee-abde-4033-b99c-0f48a5e38b8f';

    await expect(resolveProfileId(client, profileId)).resolves.toBe(profileId);
    expect(getProfiles).not.toHaveBeenCalled();
  });

  it('gets profile details through a targeted UUID search', async () => {
    const profileId = '5ded83ee-abde-4033-b99c-0f48a5e38b8f';
    const profile = { profileId, name: 'page 21 profile' };
    const getProfiles = vi.fn().mockResolvedValue([profile]);
    const client = { getProfiles } as unknown as NstbrowserClient;

    await expect(getProfileByNameOrId(client, profileId)).resolves.toBe(profile);
    expect(getProfiles).toHaveBeenCalledWith({ name: profileId });
  });
});
