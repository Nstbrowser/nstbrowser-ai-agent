/**
 * Property-based tests for profile UUID detection
 * Feature: profile-uuid-detection
 */

import { describe, it, expect } from 'vitest';
import { isUuid } from '../src/nstbrowser-profile-resolver.js';

describe('Profile UUID Detection', () => {
  describe('Property 1: UUID Detection Accuracy', () => {
    /**
     * Feature: profile-uuid-detection, Property 1: UUID Detection Accuracy
     * For any string input, if it matches the UUID v4 pattern (case-insensitive),
     * the isUuid function should return true, and if it does not match, the function should return false.
     * Validates: Requirements 1.1, 1.2, 1.4, 1.5
     */

    it('should detect valid lowercase UUIDs', () => {
      const validUuids = [
        'ef2b083a-8f77-4a7f-8441-a8d56bbd832b',
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];

      for (const uuid of validUuids) {
        expect(isUuid(uuid)).toBe(true);
      }
    });

    it('should detect valid uppercase UUIDs', () => {
      const validUuids = [
        'EF2B083A-8F77-4A7F-8441-A8D56BBD832B',
        '123E4567-E89B-12D3-A456-426614174000',
        'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
        'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
      ];

      for (const uuid of validUuids) {
        expect(isUuid(uuid)).toBe(true);
      }
    });

    it('should detect valid mixed-case UUIDs', () => {
      const validUuids = [
        'Ef2B083a-8F77-4a7f-8441-A8d56BBd832B',
        '123e4567-E89B-12d3-A456-426614174000',
        'A0EEbc99-9c0B-4EF8-bb6D-6BB9bd380A11',
      ];

      for (const uuid of validUuids) {
        expect(isUuid(uuid)).toBe(true);
      }
    });

    it('should reject profile names (non-UUID strings)', () => {
      const profileNames = [
        'proxy_ph',
        'my-test-profile',
        'test-profile-123',
        'production',
        'dev-environment',
        'user_profile_1',
      ];

      for (const name of profileNames) {
        expect(isUuid(name)).toBe(false);
      }
    });

    it('should reject UUIDs without hyphens', () => {
      const invalidUuids = [
        'ef2b083a8f774a7f8441a8d56bbd832b',
        '123e4567e89b12d3a456426614174000',
      ];

      for (const uuid of invalidUuids) {
        expect(isUuid(uuid)).toBe(false);
      }
    });

    it('should reject incomplete UUIDs', () => {
      const invalidUuids = [
        'ef2b083a-8f77-4a7f-8441',
        'ef2b083a-8f77-4a7f',
        'ef2b083a-8f77',
        'ef2b083a',
      ];

      for (const uuid of invalidUuids) {
        expect(isUuid(uuid)).toBe(false);
      }
    });

    it('should reject UUIDs with wrong hyphen positions', () => {
      const invalidUuids = [
        'ef2b083a8-f77-4a7f-8441-a8d56bbd832b',
        'ef2b083a-8f774-a7f-8441-a8d56bbd832b',
        'ef2b083a-8f77-4a7f8-441-a8d56bbd832b',
      ];

      for (const uuid of invalidUuids) {
        expect(isUuid(uuid)).toBe(false);
      }
    });

    it('should reject strings with non-hex characters', () => {
      const invalidUuids = [
        'gf2b083a-8f77-4a7f-8441-a8d56bbd832b',
        'ef2b083a-8f77-4a7f-8441-a8d56bbd832z',
        'ef2b083a-8f77-4a7f-8441-a8d56bbd832!',
      ];

      for (const uuid of invalidUuids) {
        expect(isUuid(uuid)).toBe(false);
      }
    });

    it('should reject empty strings and special cases', () => {
      const invalidInputs = [
        '',
        ' ',
        'null',
        'undefined',
        '   ef2b083a-8f77-4a7f-8441-a8d56bbd832b   ', // with spaces
      ];

      for (const input of invalidInputs) {
        expect(isUuid(input)).toBe(false);
      }
    });

    it('should reject UUIDs with extra characters', () => {
      const invalidUuids = [
        'xef2b083a-8f77-4a7f-8441-a8d56bbd832b',
        'ef2b083a-8f77-4a7f-8441-a8d56bbd832bx',
        '{ef2b083a-8f77-4a7f-8441-a8d56bbd832b}',
      ];

      for (const uuid of invalidUuids) {
        expect(isUuid(uuid)).toBe(false);
      }
    });

    // Property-based test: Generate random valid UUIDs
    it('should detect randomly generated valid UUIDs', () => {
      const generateRandomUuid = (): string => {
        const hex = '0123456789abcdef';
        const parts = [8, 4, 4, 4, 12];
        return parts
          .map((length) => {
            let part = '';
            for (let i = 0; i < length; i++) {
              part += hex[Math.floor(Math.random() * 16)];
            }
            return part;
          })
          .join('-');
      };

      // Test 100 randomly generated UUIDs
      for (let i = 0; i < 100; i++) {
        const uuid = generateRandomUuid();
        expect(isUuid(uuid)).toBe(true);
      }
    });

    // Property-based test: Generate random non-UUID strings
    it('should reject randomly generated non-UUID strings', () => {
      const generateRandomString = (): string => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_-';
        const length = Math.floor(Math.random() * 30) + 5;
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars[Math.floor(Math.random() * chars.length)];
        }
        // Ensure it doesn't accidentally match UUID pattern
        return result.length !== 36 ? result : result + 'x';
      };

      // Test 100 randomly generated non-UUID strings
      for (let i = 0; i < 100; i++) {
        const str = generateRandomString();
        // Only test if it's clearly not a UUID format
        if (str.length !== 36 || !str.includes('-')) {
          expect(isUuid(str)).toBe(false);
        }
      }
    });

    // Property-based test: Case variations
    it('should detect UUIDs with random case variations', () => {
      const baseUuid = 'ef2b083a-8f77-4a7f-8441-a8d56bbd832b';
      
      // Test 50 random case variations
      for (let i = 0; i < 50; i++) {
        const variedUuid = baseUuid
          .split('')
          .map((char) => {
            if (char >= 'a' && char <= 'f') {
              return Math.random() > 0.5 ? char.toUpperCase() : char;
            }
            return char;
          })
          .join('');
        
        expect(isUuid(variedUuid)).toBe(true);
      }
    });
  });

  describe('Property 2: Profile ID Pass-Through', () => {
    /**
     * Feature: profile-uuid-detection, Property 2: Profile ID Pass-Through
     * For any valid UUID string provided to profile resolution,
     * it should be returned directly without querying the profile API.
     * Validates: Requirements 1.1
     */

    it('should return UUID directly without API call', async () => {
      // Mock client that would throw if called
      const mockClient = {
        getProfiles: () => {
          throw new Error('API should not be called for UUID input');
        },
      } as any;

      const testUuids = [
        'ef2b083a-8f77-4a7f-8441-a8d56bbd832b',
        '123e4567-e89b-12d3-a456-426614174000',
        'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
      ];

      const { getProfileId } = await import('../src/nstbrowser-profile-resolver.js');

      for (const uuid of testUuids) {
        const result = await getProfileId(mockClient, uuid);
        expect(result).toBe(uuid);
      }
    });

    it('should pass through randomly generated UUIDs', async () => {
      const mockClient = {
        getProfiles: () => {
          throw new Error('API should not be called for UUID input');
        },
      } as any;

      const generateRandomUuid = (): string => {
        const hex = '0123456789abcdef';
        const parts = [8, 4, 4, 4, 12];
        return parts
          .map((length) => {
            let part = '';
            for (let i = 0; i < length; i++) {
              part += hex[Math.floor(Math.random() * 16)];
            }
            return part;
          })
          .join('-');
      };

      const { getProfileId } = await import('../src/nstbrowser-profile-resolver.js');

      // Test 50 random UUIDs
      for (let i = 0; i < 50; i++) {
        const uuid = generateRandomUuid();
        const result = await getProfileId(mockClient, uuid);
        expect(result).toBe(uuid);
      }
    });
  });

  describe('Property 3: Profile Name Resolution', () => {
    /**
     * Feature: profile-uuid-detection, Property 3: Profile Name Resolution
     * For any non-UUID string provided to profile resolution,
     * it should trigger an API query to resolve the name to a profile ID.
     * Validates: Requirements 1.2
     */

    it('should query API for profile names', async () => {
      let apiCalled = false;
      const mockClient = {
        getProfiles: async (query: any) => {
          apiCalled = true;
          expect(query.name).toBeDefined();
          return [{ profileId: 'resolved-uuid-123', name: query.name }];
        },
      } as any;

      const { getProfileId } = await import('../src/nstbrowser-profile-resolver.js');

      const profileNames = ['proxy_ph', 'my-test-profile', 'production'];

      for (const name of profileNames) {
        apiCalled = false;
        const result = await getProfileId(mockClient, name);
        expect(apiCalled).toBe(true);
        expect(result).toBe('resolved-uuid-123');
      }
    });

    it('should query API for randomly generated non-UUID strings', async () => {
      const generateRandomName = (): string => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_-';
        const length = Math.floor(Math.random() * 20) + 5;
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
      };

      let apiCallCount = 0;
      const mockClient = {
        getProfiles: async (query: any) => {
          apiCallCount++;
          return [{ profileId: `resolved-${apiCallCount}`, name: query.name }];
        },
      } as any;

      const { getProfileId } = await import('../src/nstbrowser-profile-resolver.js');

      // Test 30 random names
      for (let i = 0; i < 30; i++) {
        const name = generateRandomName();
        const initialCount = apiCallCount;
        await getProfileId(mockClient, name);
        expect(apiCallCount).toBe(initialCount + 1);
      }
    });
  });

  describe('Error Messages', () => {
    /**
     * Test that error messages correctly indicate whether the system
     * searched by profile ID or profile name
     */

    it('should indicate "name" in error message for non-UUID input', async () => {
      const mockClient = {
        getProfiles: async () => [],
      } as any;

      const { getProfileId } = await import('../src/nstbrowser-profile-resolver.js');

      const profileName = 'non-existent-profile';

      try {
        await getProfileId(mockClient, profileName);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('name');
        expect(error.message).toContain(profileName);
      }
    });

    it('should provide helpful error message with list command', async () => {
      const mockClient = {
        getProfiles: async () => [],
      } as any;

      const { getProfileId } = await import('../src/nstbrowser-profile-resolver.js');

      try {
        await getProfileId(mockClient, 'test-profile');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('profile list');
      }
    });

    it('should return UUID directly without error for valid UUID', async () => {
      // UUID inputs should not throw errors - they are returned directly
      const mockClient = {
        getProfiles: async () => {
          throw new Error('API should not be called');
        },
      } as any;

      const { getProfileId } = await import('../src/nstbrowser-profile-resolver.js');

      const uuid = 'ef2b083a-8f77-4a7f-8441-a8d56bbd832b';
      const result = await getProfileId(mockClient, uuid);
      expect(result).toBe(uuid);
    });
  });
});
