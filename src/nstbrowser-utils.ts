/**
 * NSTBrowser utility functions
 * Helper functions for NSTBrowser API operations
 */

import { NstbrowserError } from './nstbrowser-errors.js';
import type { NstbrowserClient } from './nstbrowser-client.js';

// Simple in-memory cache for profile lookups
const profileCache = new Map<string, { profiles: any[]; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Check if a string is a valid UUID format
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Get profiles with caching
 * @param bypassCache - If true, bypass cache and fetch fresh data
 */
async function getCachedProfiles(client: NstbrowserClient, bypassCache = false): Promise<any[]> {
  const cacheKey = 'profiles';
  const cached = profileCache.get(cacheKey);
  const now = Date.now();

  // Bypass cache if requested or cache is expired
  if (bypassCache || !cached || now - cached.timestamp >= CACHE_TTL_MS) {
    const profiles = await client.getProfiles();
    profileCache.set(cacheKey, { profiles, timestamp: now });
    return profiles;
  }

  return cached.profiles;
}

/**
 * Clear the profile cache
 * Useful after creating or deleting profiles
 */
export function clearProfileCache(): void {
  profileCache.clear();
}

/**
 * Resolve a profile identifier (name or ID) to a profile ID
 *
 * This function attempts to resolve a profile by:
 * 1. Detecting if input is UUID format (profile ID)
 * 2. If UUID, looking up by ID directly
 * 3. If not UUID, searching by name
 * 4. If multiple profiles with same name, returning first one
 *
 * Priority order for profile resolution:
 * - Direct UUID match (profile ID)
 * - Name match (first match if multiple)
 *
 * @param client - NSTBrowser API client instance
 * @param nameOrId - Profile name or profile ID
 * @returns The resolved profile ID
 * @throws {NstbrowserError} If profile is not found
 */
export async function resolveProfileId(
  client: NstbrowserClient,
  nameOrId: string
): Promise<string> {
  if (!nameOrId || nameOrId.trim() === '') {
    throw new NstbrowserError('Profile name or ID cannot be empty', 'INVALID_INPUT');
  }

  const trimmedInput = nameOrId.trim();

  try {
    // Always bypass cache for Profile Name lookups to avoid stale data
    // Profile Names may have just been created and not yet in cache
    const profiles = await getCachedProfiles(client, true);

    // Step 1: Check if input is UUID format
    if (isUUID(trimmedInput)) {
      // Try to find by ID
      const profileById = profiles.find((p) => p.profileId === trimmedInput);
      if (profileById) {
        return profileById.profileId;
      }
      // UUID format but not found
      throw new NstbrowserError(
        `Profile ID not found: "${trimmedInput}"\n\n` +
          `Troubleshooting:\n` +
          `1. List available profiles: nstbrowser-ai-agent profile list\n` +
          `2. Verify the profile exists: nstbrowser-ai-agent profile show ${trimmedInput}\n` +
          `3. Create a new profile: nstbrowser-ai-agent profile create <name>`,
        'PROFILE_NOT_FOUND',
        404
      );
    }

    // Step 2: Search by name (not UUID format)
    const profilesByName = profiles.filter((p) => p.name === trimmedInput);

    if (profilesByName.length === 0) {
      throw new NstbrowserError(
        `Profile not found: "${trimmedInput}"\n\n` +
          `Troubleshooting:\n` +
          `1. List available profiles: nstbrowser-ai-agent profile list\n` +
          `2. Create the profile: nstbrowser-ai-agent profile create ${trimmedInput}\n` +
          `3. Use a temporary browser: nstbrowser-ai-agent browser start-once`,
        'PROFILE_NOT_FOUND',
        404
      );
    }

    if (profilesByName.length > 1) {
      // Multiple profiles with same name - return first one and log warning
      if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
        console.warn(
          `[WARNING] Multiple profiles found with name "${trimmedInput}". Using first match: ${profilesByName[0].profileId}`
        );
      }
    }

    // Return first match (whether single or multiple)
    return profilesByName[0].profileId;
  } catch (error) {
    // If it's already a NstbrowserError, re-throw it
    if (error instanceof NstbrowserError) {
      throw error;
    }

    // Wrap other errors
    throw new NstbrowserError(
      `Failed to resolve profile "${trimmedInput}": ${error instanceof Error ? error.message : String(error)}`,
      'RESOLUTION_ERROR'
    );
  }
}

/**
 * Resolve multiple profile identifiers to profile IDs
 *
 * @param client - NSTBrowser API client instance
 * @param namesOrIds - Array of profile names or IDs
 * @returns Array of resolved profile IDs
 * @throws {NstbrowserError} If any profile is not found
 */
export async function resolveProfileIds(
  client: NstbrowserClient,
  namesOrIds: string[]
): Promise<string[]> {
  if (!Array.isArray(namesOrIds) || namesOrIds.length === 0) {
    throw new NstbrowserError('Profile names or IDs array cannot be empty', 'INVALID_INPUT');
  }

  // Resolve all profiles in parallel
  const resolvedIds = await Promise.all(
    namesOrIds.map((nameOrId) => resolveProfileId(client, nameOrId))
  );

  return resolvedIds;
}

/**
 * Check if a profile exists by name or ID
 *
 * @param client - NSTBrowser API client instance
 * @param nameOrId - Profile name or profile ID
 * @returns True if profile exists, false otherwise
 */
export async function profileExists(client: NstbrowserClient, nameOrId: string): Promise<boolean> {
  try {
    await resolveProfileId(client, nameOrId);
    return true;
  } catch (error) {
    if (error instanceof NstbrowserError && error.code === 'PROFILE_NOT_FOUND') {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get profile by name or ID
 *
 * @param client - NSTBrowser API client instance
 * @param nameOrId - Profile name or profile ID
 * @returns The profile object
 * @throws {NstbrowserError} If profile is not found
 */
export async function getProfileByNameOrId(client: NstbrowserClient, nameOrId: string) {
  const profiles = await client.getProfiles();

  // Try to find by ID first
  const profileById = profiles.find((p) => p.profileId === nameOrId);
  if (profileById) {
    return profileById;
  }

  // Try to find by name
  const profileByName = profiles.find((p) => p.name === nameOrId);
  if (profileByName) {
    return profileByName;
  }

  throw new NstbrowserError(`Profile not found: "${nameOrId}"`, 'PROFILE_NOT_FOUND', 404);
}

/**
 * Check if NSTBrowser client is installed
 *
 * @returns True if NSTBrowser client is installed, false otherwise
 */
export async function isNstbrowserInstalled(): Promise<boolean> {
  // Check if NSTBrowser client executable exists
  // This is a placeholder - actual implementation would check for the client binary
  // For now, we assume it's installed if NST_API_KEY is set
  return !!process.env.NST_API_KEY;
}

/**
 * Check if NSTBrowser client is running
 *
 * @param host - NSTBrowser API host
 * @param port - NSTBrowser API port
 * @returns True if NSTBrowser client is running, false otherwise
 */
export async function isNstbrowserRunning(host: string, port: number): Promise<boolean> {
  try {
    // Try to connect to the NSTBrowser API
    const response = await fetch(`http://${host}:${port}/api/v2/browsers`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.NST_API_KEY || '',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start NSTBrowser client
 *
 * @returns True if client was started successfully, false otherwise
 */
export async function startNstbrowserClient(): Promise<boolean> {
  // This is a placeholder - actual implementation would start the client process
  // For now, we just return false to indicate manual start is required
  return false;
}

/**
 * Get NSTBrowser installation instructions
 *
 * @returns Installation instructions string
 */
export function getNstbrowserInstallInstructions(): string {
  return `
NSTBrowser Installation Instructions:

1. Download NSTBrowser from: https://www.nstbrowser.io/
2. Install and launch the NSTBrowser client
3. Set the NST_API_KEY environment variable with your API key
4. Ensure the client is running on the configured host and port

For more information, visit: https://docs.nstbrowser.io/
`;
}
