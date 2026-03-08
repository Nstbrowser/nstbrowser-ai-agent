/**
 * Nstbrowser CLI Integration Tests
 * 
 * Tests the Nstbrowser daemon integration without requiring Rust CLI compilation.
 * Requires a running Nstbrowser client with valid API credentials.
 * 
 * Run with: NST_API_KEY=your-key pnpm test test/nstbrowser-cli.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { isNstbrowserRunning } from '../src/nstbrowser-utils.js';
import { NstbrowserClient } from '../src/nstbrowser-client.js';

const SKIP_CLI_TESTS = !process.env.NST_API_KEY;

describe.skipIf(SKIP_CLI_TESTS)('Nstbrowser CLI Integration Tests', () => {
  let client: NstbrowserClient;

  beforeAll(async () => {
    const host = process.env.NST_HOST || '127.0.0.1';
    const port = parseInt(process.env.NST_PORT || '8848', 10);
    const apiKey = process.env.NST_API_KEY!;

    // Check if Nstbrowser is running
    const isRunning = await isNstbrowserRunning(host, port);
    if (!isRunning) {
      throw new Error(
        'Nstbrowser client is not running. Please start it before running CLI tests.'
      );
    }

    client = new NstbrowserClient(host, port, apiKey);
  });

  describe('Profile Management', () => {
    it('should list profiles', async () => {
      const profiles = await client.listProfiles();
      expect(Array.isArray(profiles)).toBe(true);
    });

    it('should create and delete a profile', async () => {
      const profileName = `test-cli-${Date.now()}`;
      const profile = await client.createProfile({ name: profileName });
      expect(profile.name).toBe(profileName);

      await client.deleteProfiles([profile.profileId]);
      const profiles = await client.listProfiles();
      expect(profiles.find(p => p.profileId === profile.profileId)).toBeUndefined();
    });
  });

  describe('Browser Management', () => {
    it('should list running browsers', async () => {
      const browsers = await client.listBrowsers();
      expect(Array.isArray(browsers)).toBe(true);
    });
  });

  describe('Tags Management', () => {
    it('should list tags', async () => {
      const tags = await client.listTags();
      expect(Array.isArray(tags)).toBe(true);
    });
  });

  describe('Groups Management', () => {
    it('should list groups', async () => {
      const groups = await client.listGroups();
      expect(Array.isArray(groups)).toBe(true);
    });
  });
});

if (SKIP_CLI_TESTS) {
  console.log('\n⚠️  Skipping Nstbrowser CLI tests - NST_API_KEY not set\n');
  console.log('To run CLI tests, set environment variables:');
  console.log('  NST_API_KEY=your-api-key');
  console.log('  NST_HOST=127.0.0.1 (optional)');
  console.log('  NST_PORT=8848 (optional)\n');
}
