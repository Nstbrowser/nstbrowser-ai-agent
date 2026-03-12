/**
 * Enhanced browser profile resolution for all browser actions
 *
 * This module implements the unified profile resolution logic that ensures
 * all browser action commands can seamlessly work with Nstbrowser profiles.
 *
 * Resolution Priority:
 * 1. If --profile is UUID format → treat as profile ID
 * 2. If --profile is not UUID → treat as profile name
 * 3. Check running browsers for matching name/ID (prefer earliest if multiple)
 * 4. If not running, start browser with profileId
 * 5. If name specified and profile doesn't exist → create new profile
 * 6. If ID specified and doesn't exist → error
 * 7. If no profile specified → use existing once browser or create new once browser
 */

import type { NstbrowserClient } from './nstbrowser-client.js';
import type { ProfileConfig } from './nstbrowser-types.js';
import { NstbrowserError } from './nstbrowser-errors.js';

/**
 * Check if a string is a valid UUID (case-insensitive)
 */
export function isUuid(input: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}

export interface BrowserProfileResolutionOptions {
  /** Profile name or ID (auto-detected by UUID format) */
  profile?: string;
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
 * 1. Auto-detect UUID format in profile parameter
 * 2. Check running browsers for matching name/ID
 * 3. Start browser if not running
 * 4. Create profile if name specified and doesn't exist
 * 5. Error if ID specified and doesn't exist
 * 6. Use once browser if no profile specified
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

  // Auto-detect UUID format: if profile is UUID, treat as ID; otherwise treat as name
  let profileId: string | undefined;
  let profileName: string | undefined;

  if (options.profile) {
    if (isUuid(options.profile)) {
      profileId = options.profile;
      if (debug) {
        console.error(`[DEBUG] Profile "${options.profile}" is UUID format, treating as profileId`);
      }
    } else {
      profileName = options.profile;
      if (debug) {
        console.error(`[DEBUG] Profile "${options.profile}" is not UUID, treating as profile name`);
      }
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

    // Wait for browser to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify browser is actually running
    const browsersAfterStart = await client.getBrowsers();
    const runningBrowser = browsersAfterStart.find((b) => b.profileId === profileId && b.running);

    if (!runningBrowser) {
      throw new NstbrowserError(
        `Browser started but not found in running list. This may be a timing issue.\n\n` +
          `Troubleshooting:\n` +
          `1. Try using Profile ID directly: nstbrowser-ai-agent --profile ${profileId} open <url>\n` +
          `2. Check browser status: nstbrowser-ai-agent browser list\n` +
          `3. Stop all and retry: nstbrowser-ai-agent browser stop-all`,
        'BROWSER_START_VERIFICATION_FAILED'
      );
    }

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
    console.error('[DEBUG] No profile specified, checking for running once browsers...');
  }

  // Rule 4.1: Check if there's already a running once browser
  // Once browsers have profile name matching pattern: nst_<timestamp>
  const runningOnceBrowsers = runningBrowsers.filter((b) => b.name && b.name.match(/^nst_\d+$/));

  if (runningOnceBrowsers.length > 0) {
    // Use the earliest started once browser (first in list)
    const onceBrowser = runningOnceBrowsers[0];
    if (debug) {
      console.error(
        `[DEBUG] Found ${runningOnceBrowsers.length} running once browser(s), using earliest: ${onceBrowser.profileId}`
      );
    }

    const wsUrl = `ws://${options.nstHost}:${options.nstPort}/api/v2/connect/${onceBrowser.profileId}?x-api-key=${options.nstApiKey}`;

    return {
      profileId: onceBrowser.profileId,
      profileName: onceBrowser.name,
      isRunning: true,
      isOnce: true,
      wsUrl,
    };
  }

  // Rule 4.2: No running once browser, create a new one
  if (debug) {
    console.error('[DEBUG] No running once browser found, will create new once browser');
  }

  // Build once browser WebSocket URL with config
  // Note: autoClose should be false to prevent immediate browser closure
  const config = {
    platform: 'Windows',
    autoClose: false, // Keep browser open for commands
    clearCacheOnClose: true,
  };
  const configParam = encodeURIComponent(JSON.stringify(config));
  const wsUrl = `ws://${options.nstHost}:${options.nstPort}/api/v2/connect?config=${configParam}&x-api-key=${options.nstApiKey}`;

  return {
    isRunning: false, // Will be started when connecting
    isOnce: true,
    wsUrl,
    wasCreated: true, // Once browser will be created on connection
  };
}

/**
 * Helper to extract profile resolution options from command
 */
export function extractProfileOptions(
  command: { profile?: string },
  nstHost: string,
  nstPort: number,
  nstApiKey: string
): BrowserProfileResolutionOptions {
  return {
    profile: command.profile,
    nstHost,
    nstPort,
    nstApiKey,
  };
}
