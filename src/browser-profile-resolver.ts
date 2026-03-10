/**
 * Enhanced browser profile resolution for all browser actions
 *
 * This module implements the unified profile resolution logic that ensures
 * all browser action commands can seamlessly work with Nstbrowser profiles.
 *
 * Resolution Priority:
 * 1. Check running browsers for matching name/ID (prefer earliest if multiple)
 * 2. If not running, start browser with profileId
 * 3. If name specified and profile doesn't exist → create new profile
 * 4. If ID specified and doesn't exist → error
 * 5. If no profile specified → use existing once browser or create new once browser
 */

import type { NstbrowserClient } from './nstbrowser-client.js';
import type { BrowserInstance, Profile, ProfileConfig } from './nstbrowser-types.js';
import { NstbrowserError } from './nstbrowser-errors.js';

/**
 * Check if a string is a valid UUID (case-insensitive)
 */
export function isUuid(input: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}

export interface BrowserProfileResolutionOptions {
  /** Explicit profile ID (highest priority) */
  profileId?: string;
  /** Explicit profile name */
  profileName?: string;
  /** NST API configuration */
  nstHost: string;
  nstPort: number;
  nstApiKey: string;
}

export interface ResolvedBrowserProfile {
  /** Resolved profile ID (undefined for once browser) */
  profileId?: string;
  /** Profile name (if resolved from name) */
  profileName?: string;
  /** Whether browser is already running */
  isRunning: boolean;
  /** Whether this is a once/temporary browser */
  isOnce: boolean;
  /** CDP WebSocket URL */
  wsUrl: string;
  /** Whether a new profile was created */
  wasCreated?: boolean;
}

/**
 * Resolve and ensure browser profile is ready for actions
 *
 * Implements the complete resolution logic:
 * 1. Check running browsers for matching name/ID
 * 2. Start browser if not running
 * 3. Create profile if name specified and doesn't exist
 * 4. Error if ID specified and doesn't exist
 * 5. Use once browser if no profile specified
 *
 * @param client - Nstbrowser API client
 * @param options - Resolution options
 * @returns Resolved profile information with WebSocket URL
 * @throws NstbrowserError if profile ID not found or other errors
 */
export async function resolveBrowserProfile(
  client: NstbrowserClient,
  options: BrowserProfileResolutionOptions
): Promise<ResolvedBrowserProfile> {
  const debug = process.env.NSTBROWSER_AI_AGENT_DEBUG === '1';

  // Determine profile from options or environment
  let profileId = options.profileId;
  let profileName = options.profileName;

  // CRITICAL: If profileName is provided and it's in UUID format, treat it as profileId instead
  // This satisfies requirement #5: all places that accept profile name must check if it's UUID format
  if (profileName && !profileId && isUuid(profileName)) {
    if (debug) {
      console.error(`[DEBUG] Profile name "${profileName}" is UUID format, treating as profileId`);
    }
    profileId = profileName;
    profileName = undefined;
  }

  // Check environment variables if not specified
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

    // Also check UUID format for environment variable
    if (profileName && isUuid(profileName)) {
      if (debug) {
        console.error(
          `[DEBUG] NST_PROFILE env "${profileName}" is UUID format, treating as profileId`
        );
      }
      profileId = profileName;
      profileName = undefined;
    }
  }

  // === Rule 1: Check running browsers for matching name/ID ===
  const browsers = await client.getBrowsers();
  const runningBrowsers = browsers.filter((b) => b.running);

  if (debug) {
    console.error(`[DEBUG] Found ${runningBrowsers.length} running browsers`);
  }

  // Check by profile ID first
  if (profileId) {
    const runningById = runningBrowsers.filter((b) => b.profileId === profileId);
    if (runningById.length > 0) {
      // Use earliest started browser (first in list)
      const browser = runningById[0];
      if (debug) {
        console.error(`[DEBUG] Found running browser with ID "${profileId}"`);
      }

      const wsUrl = `ws://${options.nstHost}:${options.nstPort}/api/v2/connect/${profileId}?x-api-key=${options.nstApiKey}`;

      return {
        profileId,
        profileName: browser.name,
        isRunning: true,
        isOnce: false,
        wsUrl,
      };
    }
  }

  // Check by profile name
  if (profileName && !profileId) {
    const runningByName = runningBrowsers.filter((b) => b.name === profileName);
    if (runningByName.length > 0) {
      // Use earliest started browser (first in list)
      const browser = runningByName[0];
      profileId = browser.profileId;
      if (debug) {
        console.error(
          `[DEBUG] Found running browser with name "${profileName}": ${profileId}` +
            (runningByName.length > 1 ? ` (${runningByName.length} matches, using earliest)` : '')
        );
      }

      const wsUrl = `ws://${options.nstHost}:${options.nstPort}/api/v2/connect/${profileId}?x-api-key=${options.nstApiKey}`;

      return {
        profileId,
        profileName,
        isRunning: true,
        isOnce: false,
        wsUrl,
      };
    }
  }

  // === Rule 2: Start browser if not running (profile ID specified) ===
  if (profileId) {
    if (debug) {
      console.error(`[DEBUG] Profile ID specified but not running: ${profileId}`);
    }

    // Verify the profile exists
    const profiles = await client.getProfiles();
    const profile = profiles.find((p) => p.profileId === profileId);

    if (!profile) {
      // Rule 4: ID specified but doesn't exist → error
      throw new NstbrowserError(
        `Profile with ID "${profileId}" not found. ` +
          `Run 'nstbrowser-ai-agent profile list' to see available profiles.`,
        'PROFILE_NOT_FOUND',
        404
      );
    }

    // Start the browser
    if (debug) {
      console.error(`[DEBUG] Starting browser for profile ID: ${profileId}`);
    }

    await client.startBrowser(profileId);

    const wsUrl = `ws://${options.nstHost}:${options.nstPort}/api/v2/connect/${profileId}?x-api-key=${options.nstApiKey}`;

    return {
      profileId,
      profileName: profile.name,
      isRunning: true,
      isOnce: false,
      wsUrl,
    };
  }

  // === Rule 2 & 3: Resolve profile name → create if doesn't exist ===
  if (profileName) {
    if (debug) {
      console.error(`[DEBUG] Resolving profile name: ${profileName}`);
    }

    // Query profiles by name
    const profiles = await client.getProfiles({ name: profileName });

    if (profiles.length === 0) {
      // Rule 3: Name specified and doesn't exist → create new profile
      if (debug) {
        console.error(`[DEBUG] Profile "${profileName}" not found, creating new profile...`);
      }

      const profileConfig: ProfileConfig = {
        name: profileName,
      };

      const newProfile = await client.createProfile(profileConfig);
      profileId = newProfile.profileId;

      if (debug) {
        console.error(`[DEBUG] Created new profile "${profileName}" with ID: ${profileId}`);
      }

      // Start the newly created profile
      await client.startBrowser(profileId);

      const wsUrl = `ws://${options.nstHost}:${options.nstPort}/api/v2/connect/${profileId}?x-api-key=${options.nstApiKey}`;

      return {
        profileId,
        profileName,
        isRunning: true,
        isOnce: false,
        wsUrl,
        wasCreated: true,
      };
    }

    // Use first matching profile
    const profile = profiles[0];
    profileId = profile.profileId;

    if (profiles.length > 1 && debug) {
      console.error(
        `[DEBUG] Found ${profiles.length} profiles with name "${profileName}". ` +
          `Using the first one: ${profileId}`
      );
    }

    // Start the browser
    if (debug) {
      console.error(`[DEBUG] Starting browser for profile "${profileName}" (ID: ${profileId})`);
    }

    await client.startBrowser(profileId);

    const wsUrl = `ws://${options.nstHost}:${options.nstPort}/api/v2/connect/${profileId}?x-api-key=${options.nstApiKey}`;

    return {
      profileId,
      profileName,
      isRunning: true,
      isOnce: false,
      wsUrl,
    };
  }

  // === Rule 5: No profile specified → use once browser ===
  if (debug) {
    console.error('[DEBUG] No profile specified, will use once browser');
  }

  // Note: Once browsers don't persist in the running browsers list with a special flag
  // We'll just create/connect to a once browser directly

  // Build once browser WebSocket URL with config
  const config = {
    platform: 'Windows',
    autoClose: true,
    clearCacheOnClose: true,
  };
  const configParam = encodeURIComponent(JSON.stringify(config));
  const wsUrl = `ws://${options.nstHost}:${options.nstPort}/api/v2/connect?config=${configParam}&x-api-key=${options.nstApiKey}`;

  return {
    isRunning: false, // Will be started when connecting
    isOnce: true,
    wsUrl,
  };
}

/**
 * Helper to extract profile resolution options from command
 */
export function extractProfileOptions(
  command: { nstProfileName?: string; nstProfileId?: string },
  nstHost: string,
  nstPort: number,
  nstApiKey: string
): BrowserProfileResolutionOptions {
  return {
    profileId: command.nstProfileId,
    profileName: command.nstProfileName,
    nstHost,
    nstPort,
    nstApiKey,
  };
}
