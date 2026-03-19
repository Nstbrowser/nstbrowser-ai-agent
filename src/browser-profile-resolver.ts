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
import type { ProfileConfig, BrowserInstance } from './nstbrowser-types.js';
import { NstbrowserError } from './nstbrowser-errors.js';
import {
  BROWSER_START_VERIFICATION_DELAY,
  MAX_BROWSER_START_RETRIES,
  BROWSER_START_RETRY_DELAY,
  ERROR_CODES,
  buildWsProfileUrl,
  buildWsOnceUrl,
} from './constants.js';

/**
 * Check if a browser is a once/temporary browser
 *
 * Priority:
 * 1. If browser.once field is present, use that value
 * 2. Otherwise, check if name matches pattern: nst_<digits>
 */
export function isOnceBrowser(browser: BrowserInstance): boolean {
  // Priority 1: Use explicit once field if available
  if (browser.once !== undefined) {
    return browser.once;
  }

  // Priority 2: Fallback to name pattern matching
  if (browser.name) {
    // Check if name matches pattern: nst_<digits>
    // Must have at least one digit after "nst_"
    return /^nst_\d+$/.test(browser.name);
  }

  return false;
}

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

      const wsUrl = buildWsProfileUrl(
        options.nstHost,
        options.nstPort,
        profileId,
        options.nstApiKey
      );

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

      const wsUrl = buildWsProfileUrl(
        options.nstHost,
        options.nstPort,
        profileId,
        options.nstApiKey
      );

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

    // Start the browser with retry mechanism
    if (debug) {
      console.error(`[DEBUG] Starting browser for profile ID: ${profileId}`);
    }

    const started = await startBrowserWithRetry(client, profileId);

    if (!started) {
      throw new NstbrowserError(
        `Failed to start browser after ${MAX_BROWSER_START_RETRIES} attempts.\n` +
          `Profile ID: ${profileId}\n\n` +
          `This may indicate:\n` +
          `1. Nstbrowser client crashed or is not responding\n` +
          `2. Profile configuration is invalid\n` +
          `3. System resources are insufficient\n` +
          `4. Port conflict or browser process failed to start\n\n` +
          `Troubleshooting:\n` +
          `- Run: nstbrowser-ai-agent diagnose\n` +
          `- Check: nstbrowser-ai-agent nst status\n` +
          `- Try: nstbrowser-ai-agent repair\n` +
          `- Restart Nstbrowser client application`,
        ERROR_CODES.BROWSER_START_FAILED
      );
    }

    const wsUrl = buildWsProfileUrl(options.nstHost, options.nstPort, profileId, options.nstApiKey);

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

    // Query profiles by name (note: API uses fuzzy search, so we need exact match filtering)
    const profiles = await client.getProfiles({ name: profileName });

    // Filter for exact name match (API 's' parameter does fuzzy search)
    const exactMatches = profiles.filter((p) => p.name === profileName);

    if (debug) {
      console.error(
        `[DEBUG] Found ${exactMatches.length} exact matches for "${profileName}" ` +
          `(API returned ${profiles.length} total profiles via fuzzy search)`
      );
    }

    if (exactMatches.length === 0) {
      // Rule 3: Name specified and doesn't exist → create new profile
      if (debug) {
        console.error(`[DEBUG] Profile "${profileName}" not found, creating new profile...`);
      }

      const profileConfig: ProfileConfig = {
        name: profileName,
      };

      const newProfile = await client.createProfile(profileConfig);
      profileId = newProfile.profileId;
      const actualProfileName = newProfile.name;

      if (debug) {
        console.error(`[DEBUG] Created new profile with ID: ${profileId}`);
        if (actualProfileName !== profileName) {
          console.error(
            `[DEBUG] Note: Requested name "${profileName}" but API assigned "${actualProfileName}"`
          );
        }
      }

      // Inform user if profile name was modified by the API
      if (actualProfileName !== profileName) {
        console.error(
          `\n⚠️  Profile name modified by API: "${profileName}" → "${actualProfileName}"\n` +
            `   This happens when a profile with the requested name already exists.\n` +
            `   Use "--profile ${actualProfileName}" or "--profile ${profileId}" for future operations.\n`
        );
      }

      // Start the newly created profile with retry
      const started = await startBrowserWithRetry(client, profileId);

      if (!started) {
        throw new NstbrowserError(
          `Failed to start newly created profile "${profileName}" (${profileId}).\n\n` +
            `The profile was created but the browser failed to start. This may indicate:\n` +
            `1. Nstbrowser client is not responding\n` +
            `2. System resources are insufficient\n\n` +
            `Troubleshooting:\n` +
            `- Run: nstbrowser-ai-agent diagnose\n` +
            `- Try: nstbrowser-ai-agent repair\n` +
            `- Delete the profile and try again: nstbrowser-ai-agent profile delete ${profileId}`,
          ERROR_CODES.BROWSER_START_FAILED
        );
      }

      const wsUrl = buildWsProfileUrl(
        options.nstHost,
        options.nstPort,
        profileId,
        options.nstApiKey
      );

      return {
        profileId,
        profileName: actualProfileName, // Use actual name from API, not requested name
        isRunning: true,
        isOnce: false,
        wsUrl,
        wasCreated: true,
      };
    }

    // Use exact match (prioritize exact match over fuzzy matches)
    const profile = exactMatches[0];
    profileId = profile.profileId;

    if (exactMatches.length > 1 && debug) {
      console.error(
        `[DEBUG] Found ${exactMatches.length} profiles with exact name "${profileName}". ` +
          `Using the first one: ${profileId}`
      );
    }

    // Start the browser with retry
    if (debug) {
      console.error(`[DEBUG] Starting browser for profile "${profileName}" (ID: ${profileId})`);
    }

    const started = await startBrowserWithRetry(client, profileId);

    if (!started) {
      throw new NstbrowserError(
        `Failed to start browser for profile "${profileName}" (${profileId}).\n\n` +
          `Troubleshooting:\n` +
          `- Run: nstbrowser-ai-agent diagnose\n` +
          `- Check: nstbrowser-ai-agent nst status\n` +
          `- Try: nstbrowser-ai-agent repair`,
        ERROR_CODES.BROWSER_START_FAILED
      );
    }

    const wsUrl = buildWsProfileUrl(options.nstHost, options.nstPort, profileId, options.nstApiKey);

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
  // Use new isOnceBrowser function for improved detection
  const runningOnceBrowsers = runningBrowsers.filter((b) => isOnceBrowser(b));

  if (runningOnceBrowsers.length > 0) {
    // Use the earliest started once browser (first in list)
    const onceBrowser = runningOnceBrowsers[0];
    if (debug) {
      console.error(
        `[DEBUG] Found ${runningOnceBrowsers.length} running once browser(s), using earliest: ${onceBrowser.profileId}`
      );
    }

    const wsUrl = buildWsProfileUrl(
      options.nstHost,
      options.nstPort,
      onceBrowser.profileId,
      options.nstApiKey
    );

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
  const wsUrl = buildWsOnceUrl(options.nstHost, options.nstPort, configParam, options.nstApiKey);

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
  const envProfile = process.env.NST_PROFILE_ID || process.env.NST_PROFILE;
  return {
    profile: command.profile || envProfile,
    nstHost,
    nstPort,
    nstApiKey,
  };
}

/**
 * Start browser with retry mechanism
 * @returns true if browser started successfully, false otherwise
 */
async function startBrowserWithRetry(
  client: NstbrowserClient,
  profileId: string,
  maxRetries: number = MAX_BROWSER_START_RETRIES
): Promise<boolean> {
  const debug = process.env.NSTBROWSER_AI_AGENT_DEBUG === '1';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (debug && attempt > 1) {
        console.error(
          `[DEBUG] Browser start attempt ${attempt}/${maxRetries} for profile: ${profileId}`
        );
      }

      await client.startBrowser(profileId);

      // Wait for browser to initialize
      await new Promise((resolve) => setTimeout(resolve, BROWSER_START_VERIFICATION_DELAY));

      // Verify browser is running
      const browsers = await client.getBrowsers();
      const running = browsers.find((b) => b.profileId === profileId && b.running);

      if (running) {
        if (debug && attempt > 1) {
          console.error(`[DEBUG] Browser started successfully on attempt ${attempt}`);
        }
        return true; // Success
      }

      // Browser not found in running list
      if (attempt < maxRetries) {
        if (debug) {
          console.error(
            `[DEBUG] Browser not running after start (attempt ${attempt}/${maxRetries}), retrying in ${BROWSER_START_RETRY_DELAY}ms...`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, BROWSER_START_RETRY_DELAY));
      }
    } catch (error) {
      if (attempt === maxRetries) {
        // Last attempt failed, throw error
        throw error;
      }
      if (debug) {
        console.error(
          `[DEBUG] Browser start failed (attempt ${attempt}/${maxRetries}): ${error instanceof Error ? error.message : String(error)}`
        );
        console.error(`[DEBUG] Retrying in ${BROWSER_START_RETRY_DELAY}ms...`);
      }
      await new Promise((resolve) => setTimeout(resolve, BROWSER_START_RETRY_DELAY));
    }
  }

  return false; // All attempts failed
}

/**
 * Verify browser health
 * @returns true if browser is healthy, false otherwise
 */
async function verifyBrowserHealth(client: NstbrowserClient, profileId: string): Promise<boolean> {
  try {
    // Check if browser is running
    const browsers = await client.getBrowsers();
    const browser = browsers.find((b) => b.profileId === profileId);

    if (!browser || !browser.running) {
      return false;
    }

    // Try to get CDP URL (tests if browser is responsive)
    const cdpInfo = await client.getCdpUrl(profileId);
    return !!cdpInfo.webSocketDebuggerUrl;
  } catch (error) {
    return false;
  }
}
