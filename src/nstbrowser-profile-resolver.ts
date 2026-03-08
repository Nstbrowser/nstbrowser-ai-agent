/**
 * Unified profile resolution logic for Nstbrowser
 *
 * This module provides a consistent way to resolve profile names or IDs
 * across all browser-related commands.
 *
 * Resolution Priority:
 * 1. Explicit profileId parameter
 * 2. Explicit profileName parameter
 * 3. NST_PROFILE_ID environment variable
 * 4. NST_PROFILE environment variable
 * 5. No profile (use once/temporary browser)
 *
 * Name Resolution Logic:
 * When a profile name is provided:
 * 1. Check running browsers for matching name (use earliest if multiple)
 * 2. If not running, query profile API for matching name
 * 3. If found, use the first matching profile
 * 4. If not found, throw error
 */

import type { NstbrowserClient } from './nstbrowser-client.js';

/**
 * Check if a string is a valid UUID (case-insensitive)
 *
 * @param input - String to check
 * @returns true if input is a valid UUID, false otherwise
 */
export function isUuid(input: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}

export interface ProfileResolutionOptions {
  /** Explicit profile ID (highest priority) */
  profileId?: string;
  /** Explicit profile name */
  profileName?: string;
  /** Whether to allow once/temporary browser (default: true) */
  allowOnce?: boolean;
  /** Whether to auto-start browser if not running (default: true) */
  autoStart?: boolean;
}

export interface ResolvedProfile {
  /** Resolved profile ID (undefined for once browser) */
  profileId?: string;
  /** Profile name (if resolved from name) */
  profileName?: string;
  /** Whether browser is already running */
  isRunning: boolean;
  /** Whether this is a once/temporary browser */
  isOnce: boolean;
  /** CDP WebSocket URL */
  wsUrl?: string;
}

/**
 * Resolve profile from name or ID
 *
 * @param client - Nstbrowser API client
 * @param options - Resolution options
 * @returns Resolved profile information
 * @throws Error if profile not found or invalid
 */
export async function resolveProfile(
  client: NstbrowserClient,
  options: ProfileResolutionOptions = {}
): Promise<ResolvedProfile> {
  const debug = process.env.NSTBROWSER_AI_AGENT_DEBUG === '1';

  // Determine profile from options or environment
  let profileId = options.profileId;
  let profileName = options.profileName;

  // Priority 3: Environment variables
  if (!profileId && !profileName) {
    profileId = process.env.NST_PROFILE_ID;
    if (profileId && debug) {
      console.error(`[DEBUG] Using profile ID from NST_PROFILE_ID env: ${profileId}`);
    }
  }

  if (!profileId && !profileName) {
    profileName = process.env.NST_PROFILE;
    if (profileName && debug) {
      console.error(`[DEBUG] Using profile name from NST_PROFILE env: ${profileName}`);
    }
  }

  // If we have a profile name, resolve it to profileId
  if (profileName && !profileId) {
    if (debug) {
      console.error(`[DEBUG] Resolving profile name: ${profileName}`);
    }

    // Step 1: Check running browsers for matching name
    const browsers = await client.getBrowsers();
    const runningBrowsersWithName = browsers.filter((b) => b.name === profileName && b.running);

    if (runningBrowsersWithName.length > 0) {
      // Use the earliest started browser (first in the list)
      profileId = runningBrowsersWithName[0].profileId;
      if (debug) {
        console.error(`[DEBUG] Found running browser with name "${profileName}": ${profileId}`);
      }

      return {
        profileId,
        profileName,
        isRunning: true,
        isOnce: false,
      };
    }

    // Step 2: No running browser found, query profile API
    if (debug) {
      console.error(
        `[DEBUG] No running browser found, querying profile API for name: ${profileName}`
      );
    }

    const profiles = await client.getProfiles({ name: profileName });

    if (profiles.length === 0) {
      throw new Error(
        `Profile "${profileName}" not found. ` +
          `Run 'nstbrowser-ai-agent profile list' to see available profiles.`
      );
    }

    if (profiles.length > 1 && debug) {
      console.error(
        `[DEBUG] Found ${profiles.length} profiles with name "${profileName}". ` +
          `Using the first one: ${profiles[0].profileId}`
      );
    }

    profileId = profiles[0].profileId;
    if (debug) {
      console.error(`[DEBUG] Resolved profile name "${profileName}" to profileId: ${profileId}`);
    }
  }

  // If we have a profileId, check if browser is running
  if (profileId) {
    if (debug) {
      console.error(`[DEBUG] Checking if browser is running for profileId: ${profileId}`);
    }

    const browsers = await client.getBrowsers();
    const runningBrowser = browsers.find((b) => b.profileId === profileId && b.running);

    return {
      profileId,
      profileName,
      isRunning: !!runningBrowser,
      isOnce: false,
    };
  }

  // No profile specified
  if (options.allowOnce === false) {
    throw new Error(
      'No profile specified. Use --profile <name> or --profile-id <id>, ' +
        'or set NST_PROFILE or NST_PROFILE_ID environment variable.'
    );
  }

  if (debug) {
    console.error('[DEBUG] No profile specified, will use once/temporary browser');
  }

  return {
    isRunning: false,
    isOnce: true,
  };
}

/**
 * Ensure browser is running for the resolved profile
 *
 * @param client - Nstbrowser API client
 * @param resolved - Resolved profile information
 * @returns Updated profile information with wsUrl
 */
export async function ensureBrowserRunning(
  client: NstbrowserClient,
  resolved: ResolvedProfile,
  nstHost: string,
  nstPort: number,
  nstApiKey: string
): Promise<ResolvedProfile> {
  const debug = process.env.NSTBROWSER_AI_AGENT_DEBUG === '1';

  if (resolved.isOnce) {
    // Once browser - build WebSocket URL with config
    const config = {
      platform: 'Windows',
      autoClose: true,
      clearCacheOnClose: true,
    };
    const configParam = encodeURIComponent(JSON.stringify(config));
    const wsUrl = `ws://${nstHost}:${nstPort}/api/v2/connect?config=${configParam}&x-api-key=${nstApiKey}`;

    return {
      ...resolved,
      wsUrl,
    };
  }

  if (!resolved.profileId) {
    throw new Error('Profile ID is required for non-once browser');
  }

  // Check if browser is already running
  if (resolved.isRunning) {
    if (debug) {
      console.error(
        `[DEBUG] Browser already running for profile ${resolved.profileId}, ` +
          'connecting to existing instance...'
      );
    }

    const wsUrl = `ws://${nstHost}:${nstPort}/api/v2/connect/${resolved.profileId}?x-api-key=${nstApiKey}`;

    return {
      ...resolved,
      wsUrl,
    };
  }

  // Start the browser
  if (debug) {
    console.error(`[DEBUG] Starting browser for profile ${resolved.profileId}...`);
  }

  await client.startBrowser(resolved.profileId);

  if (debug) {
    console.error(`[DEBUG] Browser started successfully for profile ${resolved.profileId}`);
  }

  const wsUrl = `ws://${nstHost}:${nstPort}/api/v2/connect/${resolved.profileId}?x-api-key=${nstApiKey}`;

  return {
    ...resolved,
    isRunning: true,
    wsUrl,
  };
}

/**
 * Get profile ID from name or ID (without starting browser)
 *
 * This is useful for commands that need profile ID but don't need to start browser
 * (e.g., profile delete, profile update, etc.)
 *
 * @param client - Nstbrowser API client
 * @param nameOrId - Profile name or ID
 * @returns Profile ID
 * @throws Error if profile not found
 */
export async function getProfileId(client: NstbrowserClient, nameOrId: string): Promise<string> {
  const debug = process.env.NSTBROWSER_AI_AGENT_DEBUG === '1';

  // Check if it looks like a profile ID (UUID format)
  if (isUuid(nameOrId)) {
    if (debug) {
      console.error(`[DEBUG] Input looks like profile ID: ${nameOrId}`);
    }
    return nameOrId;
  }

  // Treat as profile name, resolve to ID
  if (debug) {
    console.error(`[DEBUG] Resolving profile name to ID: ${nameOrId}`);
  }

  const profiles = await client.getProfiles({ name: nameOrId });

  if (profiles.length === 0) {
    throw new Error(
      `Profile with name "${nameOrId}" not found. ` +
        `Run 'nstbrowser-ai-agent profile list' to see available profiles.`
    );
  }

  if (profiles.length > 1 && debug) {
    console.error(
      `[DEBUG] Found ${profiles.length} profiles with name "${nameOrId}". ` +
        `Using the first one: ${profiles[0].profileId}`
    );
  }

  return profiles[0].profileId;
}

/**
 * Get multiple profile IDs from names or IDs
 *
 * @param client - Nstbrowser API client
 * @param namesOrIds - Array of profile names or IDs
 * @returns Array of profile IDs
 * @throws Error if any profile not found
 */
export async function getProfileIds(
  client: NstbrowserClient,
  namesOrIds: string[]
): Promise<string[]> {
  const profileIds: string[] = [];

  for (const nameOrId of namesOrIds) {
    const profileId = await getProfileId(client, nameOrId);
    profileIds.push(profileId);
  }

  return profileIds;
}
