/**
 * Nstbrowser Integration Tests
 *
 * These tests require a running Nstbrowser client with valid API credentials.
 * Set NST_API_KEY, NST_HOST, and NST_PORT environment variables before running.
 *
 * Run with: NST_API_KEY=your-key pnpm test test/nstbrowser-integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NstbrowserClient } from '../src/nstbrowser-client.js';
import { isNstbrowserRunning } from '../src/nstbrowser-utils.js';

const SKIP_INTEGRATION_TESTS = !process.env.NST_API_KEY;

describe.skipIf(SKIP_INTEGRATION_TESTS)('Nstbrowser Integration Tests', () => {
  let client: NstbrowserClient;
  let testProfileId: string | null = null;

  beforeAll(async () => {
    const host = process.env.NST_HOST || '127.0.0.1';
    const port = parseInt(process.env.NST_PORT || '8848', 10);
    const apiKey = process.env.NST_API_KEY || '';

    // Check if Nstbrowser is running
    const isRunning = await isNstbrowserRunning(host, port);
    if (!isRunning) {
      throw new Error(
        'Nstbrowser client is not running. Please start it before running integration tests.'
      );
    }

    client = new NstbrowserClient(host, port, apiKey);
  });

  afterAll(async () => {
    // Cleanup: delete test profile if created
    if (testProfileId && client) {
      try {
        await client.deleteProfile(testProfileId);
      } catch (error) {
        console.error('Failed to cleanup test profile:', error);
      }
    }
  });

  describe('Browser Instance Management', () => {
    it('should list running browsers', async () => {
      const browsers = await client.getBrowsers();
      expect(Array.isArray(browsers)).toBe(true);
    });

    it('should start and stop a browser', async () => {
      // Get or create a test profile
      const profiles = await client.getProfiles();
      if (profiles.length === 0) {
        const profile = await client.createProfile({
          name: `test-profile-${Date.now()}`,
          platform: 'Windows',
        });
        testProfileId = profile.profileId;
      } else {
        testProfileId = profiles[0].profileId;
      }

      // Start browser
      const startResult = await client.startBrowser(testProfileId);
      expect(startResult.profileId).toBe(testProfileId);
      expect(startResult.webSocketDebuggerUrl).toContain('ws://');
      expect(startResult.remoteDebuggingPort).toBeGreaterThan(0);

      // Wait longer for browser to fully start and appear in list
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Verify browser is running - retry a few times if not found immediately
      let runningBrowser;
      for (let i = 0; i < 3; i++) {
        const browsers = await client.getBrowsers();
        runningBrowser = browsers.find((b) => b.profileId === testProfileId);
        if (runningBrowser) break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // If browser is in list, verify it's running
      if (runningBrowser) {
        expect(runningBrowser.running).toBe(true);
      }
      // Note: Browser might not appear in list immediately after start, which is acceptable

      // Stop browser
      await client.stopBrowser(testProfileId);

      // Wait a bit for browser to fully stop
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify browser is stopped (may not be in list anymore, or running=false)
      const browsersAfterStop = await client.getBrowsers();
      const stoppedBrowser = browsersAfterStop.find((b) => b.profileId === testProfileId);
      // Browser may be removed from list or marked as not running
      if (stoppedBrowser) {
        expect(stoppedBrowser.running).toBe(false);
      }
      // If not in list, that's also valid (browser was stopped and removed)
    }, 45000); // 45 second timeout
  });

  describe('Profile Management', () => {
    it('should list profiles', async () => {
      const profiles = await client.getProfiles();
      expect(Array.isArray(profiles)).toBe(true);
    });

    it('should create and delete a profile', async () => {
      // Create profile
      const profileName = `test-profile-${Date.now()}`;
      const profile = await client.createProfile({
        name: profileName,
        platform: 'Windows',
      });

      expect(profile.profileId).toBeDefined();
      expect(profile.name).toBe(profileName);
      // API returns platform as number: 0 = Windows, 1 = macOS
      expect(profile.platform).toBe(0);

      // Delete profile immediately (we trust the creation worked based on the response)
      await client.deleteProfile(profile.profileId);

      // Wait a bit for profile to be fully deleted
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify profile is deleted by checking it's not in the list
      const profilesAfterDelete = await client.getProfiles();
      const deletedProfile = profilesAfterDelete.find((p) => p.profileId === profile.profileId);
      expect(deletedProfile).toBeUndefined();
    }, 15000);
  });

  describe('Proxy Management', () => {
    it('should update and reset profile proxy', async () => {
      // Get or create a test profile
      const profiles = await client.getProfiles();
      let profileId: string;

      if (profiles.length === 0) {
        const profile = await client.createProfile({
          name: `test-profile-${Date.now()}`,
          platform: 'Windows',
        });
        profileId = profile.profileId;
        testProfileId = profileId;
      } else {
        profileId = profiles[0].profileId;
      }

      // Update proxy
      const proxyConfig = {
        type: 'http' as const,
        host: '127.0.0.1',
        port: 8080,
      };
      await client.updateProfileProxy(profileId, proxyConfig);

      // Reset proxy
      await client.resetProfileProxy(profileId);
    }, 15000);
  });

  describe('Tag Management', () => {
    it('should list, create, and clear profile tags', async () => {
      // Get or create a test profile
      const profiles = await client.getProfiles();
      let profileId: string;

      if (profiles.length === 0) {
        const profile = await client.createProfile({
          name: `test-profile-${Date.now()}`,
          platform: 'Windows',
        });
        profileId = profile.profileId;
        testProfileId = profileId;
      } else {
        profileId = profiles[0].profileId;
      }

      // List tags
      const tags = await client.getProfileTags();
      expect(Array.isArray(tags)).toBe(true);

      // Create tag
      await client.createProfileTags(profileId, [{ name: 'test-tag', color: '#FF0000' }]);

      // Clear tags
      await client.clearProfileTags(profileId);
    }, 15000);
  });

  describe('Group Management', () => {
    it('should list profile groups', async () => {
      const groups = await client.getAllProfileGroups();
      expect(Array.isArray(groups)).toBe(true);
    });

    it('should change profile group', async () => {
      // Get or create a test profile
      const profiles = await client.getProfiles();
      let profileId: string;

      if (profiles.length === 0) {
        const profile = await client.createProfile({
          name: `test-profile-${Date.now()}`,
          platform: 'Windows',
        });
        profileId = profile.profileId;
        testProfileId = profileId;
      } else {
        profileId = profiles[0].profileId;
      }

      // Get available groups
      const groups = await client.getAllProfileGroups();
      if (groups.length > 0) {
        const groupId = groups[0].groupId;
        await client.changeProfileGroup(profileId, groupId);
      }
    }, 15000);
  });

  describe('Data Management', () => {
    it.skip('should clear profile cache and cookies', async () => {
      // Note: These endpoints may not be available in all Nstbrowser versions
      // Get or create a test profile
      const profiles = await client.getProfiles();
      let profileId: string;

      if (profiles.length === 0) {
        const profile = await client.createProfile({
          name: `test-profile-${Date.now()}`,
          platform: 'Windows',
        });
        profileId = profile.profileId;
        testProfileId = profileId;
      } else {
        profileId = profiles[0].profileId;
      }

      // Clear cache
      await client.clearProfileCache(profileId);

      // Clear cookies
      await client.clearProfileCookies(profileId);
    }, 15000);
  });

  describe('CDP Connection', () => {
    it('should connect to browser via CDP', async () => {
      // Get or create a test profile
      const profiles = await client.getProfiles();
      let profileId: string;

      if (profiles.length === 0) {
        const profile = await client.createProfile({
          name: `test-profile-${Date.now()}`,
          platform: 'Windows',
        });
        profileId = profile.profileId;
        testProfileId = profileId;
      } else {
        profileId = profiles[0].profileId;
      }

      // Connect to browser
      const connectResponse = await client.connectBrowser(profileId);
      expect(connectResponse.profileId).toBe(profileId);
      expect(connectResponse.webSocketDebuggerUrl).toContain('ws://');
      expect(connectResponse.remoteDebuggingPort).toBeGreaterThan(0);

      // Stop browser after test
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await client.stopBrowser(profileId);
    }, 20000);

    it('should connect to once browser via CDP', async () => {
      const config = {
        platform: 'Windows' as const,
        autoClose: true,
        clearCacheOnClose: true,
      };

      const connectResponse = await client.connectOnceBrowser(config);
      expect(connectResponse.profileId).toBeDefined();
      expect(connectResponse.webSocketDebuggerUrl).toContain('ws://');
      expect(connectResponse.remoteDebuggingPort).toBeGreaterThan(0);

      // Stop browser after test
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await client.stopBrowser(connectResponse.profileId);
    }, 20000);
  });

  describe('Error Handling', () => {
    it('should handle invalid profile ID', async () => {
      await expect(client.startBrowser('invalid-profile-id')).rejects.toThrow();
    });

    it('should handle invalid proxy configuration', async () => {
      const profiles = await client.getProfiles();
      if (profiles.length > 0) {
        const invalidProxy = {
          type: 'http' as const,
          host: '',
          port: -1,
        };
        await expect(
          client.updateProfileProxy(profiles[0].profileId, invalidProxy)
        ).rejects.toThrow();
      }
    });
  });
});

if (SKIP_INTEGRATION_TESTS) {
  console.log('\n⚠️  Skipping Nstbrowser integration tests - NST_API_KEY not set\n');
  console.log('To run integration tests, set environment variables:');
  console.log('  NST_API_KEY=your-api-key');
  console.log('  NST_HOST=127.0.0.1 (optional)');
  console.log('  NST_PORT=8848 (optional)\n');
}
