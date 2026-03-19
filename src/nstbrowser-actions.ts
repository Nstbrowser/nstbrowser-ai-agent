/**
 * Nstbrowser command handlers
 * Handles all Nstbrowser-specific commands
 */

import { NstbrowserClient } from './nstbrowser-client.js';
import type { Response, Command } from './types.js';
import { successResponse, errorResponse } from './protocol.js';
import type {
  ProfileConfig,
  ProxyConfig,
  TagConfig,
  StartBrowserOptions,
} from './nstbrowser-types.js';
import { resolveProfileId, resolveProfileIds, getProfileByNameOrId } from './nstbrowser-utils.js';
import { loadNstConfig } from './config-loader.js';
import { cleanupExpiredStates } from './state-utils.js';
import { resolveBrowserProfile, isOnceBrowser } from './browser-profile-resolver.js';

/**
 * Execute a Nstbrowser command
 */
export async function executeNstbrowserCommand(command: Command): Promise<Response> {
  // Load configuration from file (priority: config file > env var > default)
  const config = loadNstConfig();

  if (!config) {
    return errorResponse(
      command.id,
      'NST API key is required. Configure it with: nstbrowser-ai-agent config set key <your-api-key>'
    );
  }

  // Debug: log configuration source
  if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
    console.error('[DEBUG] Nstbrowser daemon configuration:', {
      host: config.host,
      port: config.port,
      apiKey: `${config.apiKey.substring(0, 8)}...`,
      source: 'config file or environment',
    });
  }

  const client = new NstbrowserClient(config.host, config.port, config.apiKey);

  try {
    switch (command.action) {
      case 'nst_browser_list':
        return await handleBrowserList(command, client);
      case 'nst_browser_start':
        return await handleBrowserStart(command, client);
      case 'nst_browser_stop':
        return await handleBrowserStop(command, client);
      case 'nst_browser_stop_all':
        return await handleBrowserStopAll(command, client);
      case 'nst_profile_list':
        return await handleProfileList(command, client);
      case 'nst_profile_create':
        return await handleProfileCreate(command, client);
      case 'nst_profile_delete':
        return await handleProfileDelete(command, client);
      case 'nst_profile_proxy_update':
        return await handleProfileProxyUpdate(command, client);
      case 'nst_profile_proxy_reset':
        return await handleProfileProxyReset(command, client);
      case 'nst_profile_tags_list':
        return await handleProfileTagsList(command, client);
      case 'nst_profile_tags_create':
        return await handleProfileTagsCreate(command, client);
      case 'nst_profile_tags_clear':
        return await handleProfileTagsClear(command, client);
      case 'nst_profile_groups_list':
        return await handleProfileGroupsList(command, client);
      case 'nst_profile_group_change':
        return await handleProfileGroupChange(command, client);
      case 'nst_profile_cache_clear':
        return await handleProfileCacheClear(command, client);
      case 'nst_profile_cookies_clear':
        return await handleProfileCookiesClear(command, client);
      case 'nst_profile_show':
        return await handleProfileShow(command, client);
      case 'nst_profile_proxy_show':
        return await handleProfileProxyShow(command, client);
      case 'nst_browser_pages':
        return await handleBrowserPages(command, client);
      case 'nst_browser_debugger':
        return await handleBrowserDebugger(command, client);
      case 'nst_profile_tags_update':
        return await handleProfileTagsUpdate(command, client);
      case 'nst_profile_proxy_batch_update':
        return await handleProfileProxyBatchUpdate(command, client);
      case 'nst_profile_proxy_batch_reset':
        return await handleProfileProxyBatchReset(command, client);
      case 'nst_profile_tags_batch_create':
        return await handleProfileTagsBatchCreate(command, client);
      case 'nst_profile_tags_batch_update':
        return await handleProfileTagsBatchUpdate(command, client);
      case 'nst_profile_tags_batch_clear':
        return await handleProfileTagsBatchClear(command, client);
      case 'nst_profile_group_batch_change':
        return await handleProfileGroupBatchChange(command, client);
      case 'nst_browser_start_once':
        return await handleBrowserStartOnce(command, client);
      case 'nst_browser_cdp_url':
        return await handleBrowserCdpUrl(command, client);
      case 'nst_browser_cdp_url_once':
        return await handleBrowserCdpUrlOnce(command, client);
      case 'nst_browser_connect':
        return await handleBrowserConnect(command, client);
      case 'nst_browser_connect_once':
        return await handleBrowserConnectOnce(command, client);
      case 'nst_profile_list_cursor':
        return await handleProfileListCursor(command, client);
      case 'diagnose':
        return await handleDiagnose(command, client, config);
      case 'verify':
        return await handleVerify(command, client, config);
      case 'repair':
        return await handleRepair(command, client);
      default:
        return errorResponse(
          (command as { id: string }).id,
          `Unknown Nstbrowser action: ${(command as { action: string }).action}`
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

// ==================== Browser Instance Management ====================

async function handleBrowserList(
  command: { id: string; action: 'nst_browser_list' },
  client: NstbrowserClient
): Promise<Response> {
  const browsers = await client.getBrowsers();
  return successResponse(command.id, { browsers });
}

async function handleBrowserStart(
  command: {
    id: string;
    action: 'nst_browser_start';
    profileId: string;
    options?: StartBrowserOptions;
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileId = await resolveProfileId(client, command.profileId);
  try {
    const result = await client.startBrowser(profileId, command.options);
    return successResponse(command.id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('already exists')) {
      throw error;
    }

    const browsers = await client.getBrowsers();
    const existing = browsers.find((browser) => browser.profileId === profileId && browser.running);

    return successResponse(command.id, {
      alreadyRunning: true,
      profileId,
      remoteDebuggingPort: existing?.remoteDebuggingPort,
      message: existing
        ? `Browser for profile ${existing.name || profileId} is already running`
        : `Browser for profile ${profileId} is already running`,
    });
  }
}

async function handleBrowserStop(
  command: { id: string; action: 'nst_browser_stop'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  // First, get all browsers to check if this is a once browser
  const browsers = await client.getBrowsers();

  // Try to find browser by name first (for once browsers)
  const browserByName = browsers.find((b) => b.name === command.profileId && b.running);

  if (browserByName && isOnceBrowser(browserByName)) {
    // This is a once/temporary browser
    await client.stopBrowser(browserByName.profileId);
    return successResponse(command.id, {
      stopped: true,
      profileId: browserByName.profileId,
      message: `Stopped temporary browser ${command.profileId}`,
    });
  }

  // Regular profile: use resolveProfileId to handle both names and IDs
  const profileId = await resolveProfileId(client, command.profileId);

  // Get profile details to show in response
  const profile = await getProfileByNameOrId(client, profileId);

  await client.stopBrowser(profileId);

  return successResponse(command.id, {
    stopped: true,
    profileId: profile.profileId,
    profileName: profile.name,
    message: `Stopped browser for profile "${profile.name}" (ID: ${profile.profileId})`,
  });
}

async function handleBrowserStopAll(
  command: { id: string; action: 'nst_browser_stop_all' },
  client: NstbrowserClient
): Promise<Response> {
  await client.stopAllBrowsers();
  return successResponse(command.id, { stopped: true });
}

// ==================== Profile Management ====================

async function handleProfileList(
  command: {
    id: string;
    action: 'nst_profile_list';
    query?: { name?: string; groupId?: string; platform?: 'Windows' | 'macOS' | 'Linux' };
    verbose?: boolean;
  },
  client: NstbrowserClient
): Promise<Response> {
  const profiles = await client.getProfiles(command.query);

  // If not verbose, return simplified profile data
  if (!command.verbose) {
    const simplifiedProfiles = profiles.map((profile) => ({
      profileId: profile.profileId,
      name: profile.name,
      platform: profile.platform,
      groupName: profile.groupName,
      // Include basic proxy info but not full details
      proxyResult: profile.proxyResult
        ? {
            ip: profile.proxyResult.ip,
          }
        : undefined,
      // Include tag names but not full tag objects
      tags: profile.tags?.map((tag) => ({ name: tag.name })),
    }));
    return successResponse(command.id, { profiles: simplifiedProfiles });
  }

  // Verbose mode returns full profile data
  return successResponse(command.id, { profiles });
}

async function handleProfileCreate(
  command: {
    id: string;
    action: 'nst_profile_create';
    name: string;
    proxyConfig?: {
      type: 'http' | 'https' | 'socks5';
      host: string;
      port: number;
      username?: string;
      password?: string;
      enabled?: boolean;
    };
    platform?: 'Windows' | 'macOS' | 'Linux';
    kernel?: string;
    fingerprint?: Record<string, unknown>;
    groupId?: string;
  },
  client: NstbrowserClient
): Promise<Response> {
  // Create the profile first, then apply proxy settings as a second step.
  // NST's create-profile endpoint accepts the core profile fields reliably,
  // while proxy updates are handled consistently through the dedicated
  // proxy endpoint.
  const profileConfig: ProfileConfig = {
    name: command.name,
    platform: command.platform,
    kernel: command.kernel,
    fingerprint: command.fingerprint,
    groupId: command.groupId,
  };

  const profile = await client.createProfile(profileConfig);

  if (command.proxyConfig) {
    await client.updateProfileProxy(profile.profileId, {
      type: command.proxyConfig.type,
      host: command.proxyConfig.host,
      port: command.proxyConfig.port,
      username: command.proxyConfig.username,
      password: command.proxyConfig.password,
    });

    const refreshedProfile = await getProfileByNameOrId(client, profile.profileId);
    return successResponse(command.id, { profile: refreshedProfile });
  }

  return successResponse(command.id, { profile });
}

async function handleProfileDelete(
  command: { id: string; action: 'nst_profile_delete'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  await client.deleteProfilesBatch(profileIds);
  return successResponse(command.id, { deleted: profileIds.length });
}

// ==================== Proxy Management ====================

async function handleProfileProxyUpdate(
  command: {
    id: string;
    action: 'nst_profile_proxy_update';
    profileId: string;
    proxyConfig: {
      type: 'http' | 'https' | 'socks5';
      host: string;
      port: number;
      username?: string;
      password?: string;
    };
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileId = await resolveProfileId(client, command.profileId);
  await client.updateProfileProxy(profileId, command.proxyConfig);
  return successResponse(command.id, { updated: true });
}

async function handleProfileProxyReset(
  command: { id: string; action: 'nst_profile_proxy_reset'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  if (profileIds.length === 1) {
    await client.resetProfileProxy(profileIds[0]);
  } else {
    await client.batchResetProfileProxy(profileIds);
  }
  return successResponse(command.id, { reset: profileIds.length });
}

// ==================== Tag Management ====================

async function handleProfileTagsList(
  command: { id: string; action: 'nst_profile_tags_list' },
  client: NstbrowserClient
): Promise<Response> {
  const tags = await client.getProfileTags();
  return successResponse(command.id, { tags });
}

async function handleProfileTagsCreate(
  command: {
    id: string;
    action: 'nst_profile_tags_create';
    profileId: string;
    tag: string;
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileId = await resolveProfileId(client, command.profileId);
  // Build the next tag set from the existing profile tags so the ergonomic
  // "tags create <profile> <tag>" command appends one tag without making the
  // caller understand the full replacement semantics of the update endpoint.
  const profile = await getProfileByNameOrId(client, profileId);
  const existingTags = (profile.tags ?? []).map((tag) => ({
    name: tag.name,
    color: tag.color,
  }));

  if (!existingTags.some((tag) => tag.name === command.tag)) {
    existingTags.push({ name: command.tag, color: '#8B5CF6' });
  }

  await client.updateProfileTags(profileId, existingTags);
  return successResponse(command.id, { created: true });
}

async function handleProfileTagsClear(
  command: { id: string; action: 'nst_profile_tags_clear'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  if (profileIds.length === 1) {
    await client.clearProfileTags(profileIds[0]);
  } else {
    await client.batchClearProfileTags(profileIds);
  }
  return successResponse(command.id, { cleared: profileIds.length });
}

// ==================== Group Management ====================

async function handleProfileGroupsList(
  command: { id: string; action: 'nst_profile_groups_list' },
  client: NstbrowserClient
): Promise<Response> {
  const groups = await client.getAllProfileGroups();
  return successResponse(command.id, { groups });
}

async function handleProfileGroupChange(
  command: {
    id: string;
    action: 'nst_profile_group_change';
    groupId: string;
    profileIds: string[];
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  if (profileIds.length === 1) {
    await client.changeProfileGroup(profileIds[0], command.groupId);
  } else {
    await client.batchChangeProfileGroup(profileIds, command.groupId);
  }
  return successResponse(command.id, { changed: profileIds.length });
}

// ==================== Local Data Management ====================

async function handleProfileCacheClear(
  command: { id: string; action: 'nst_profile_cache_clear'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  // Note: API doesn't have batch cache clear, so we do them sequentially
  for (const profileId of profileIds) {
    await client.clearProfileCache(profileId);
  }
  return successResponse(command.id, { cleared: profileIds.length });
}

async function handleProfileCookiesClear(
  command: { id: string; action: 'nst_profile_cookies_clear'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  // Note: API doesn't have batch cookies clear, so we do them sequentially
  for (const profileId of profileIds) {
    await client.clearProfileCookies(profileId);
  }
  return successResponse(command.id, { cleared: profileIds.length });
}

// ==================== New Commands ====================

async function handleProfileShow(
  command: { id: string; action: 'nst_profile_show'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  const profile = await getProfileByNameOrId(client, command.profileId);
  return successResponse(command.id, { profile });
}

async function handleProfileProxyShow(
  command: { id: string; action: 'nst_profile_proxy_show'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  const profile = await getProfileByNameOrId(client, command.profileId);
  return successResponse(command.id, {
    proxyConfig: profile.proxyConfig,
    proxyResult: profile.proxyResult,
  });
}

async function handleBrowserPages(
  command: { id: string; action: 'nst_browser_pages'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  const profileId = await resolveProfileId(client, command.profileId);
  const pages = await client.getBrowserPages(profileId);
  return successResponse(command.id, { pages });
}

async function handleBrowserDebugger(
  command: { id: string; action: 'nst_browser_debugger'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  const profileId = await resolveProfileId(client, command.profileId);
  const debuggerInfo = await client.getBrowserDebugger(profileId);
  return successResponse(command.id, debuggerInfo);
}

async function handleProfileTagsUpdate(
  command: {
    id: string;
    action: 'nst_profile_tags_update';
    profileId: string;
    tags: TagConfig[];
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileId = await resolveProfileId(client, command.profileId);
  await client.updateProfileTags(profileId, command.tags);
  return successResponse(command.id, { updated: true });
}

async function handleProfileProxyBatchUpdate(
  command: {
    id: string;
    action: 'nst_profile_proxy_batch_update';
    profileIds: string[];
    proxyConfig: {
      type: 'http' | 'https' | 'socks5';
      host: string;
      port: number;
      username?: string;
      password?: string;
    };
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  await client.batchUpdateProxy(profileIds, command.proxyConfig);
  return successResponse(command.id, { updated: profileIds.length });
}

async function handleProfileProxyBatchReset(
  command: {
    id: string;
    action: 'nst_profile_proxy_batch_reset';
    profileIds: string[];
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  await client.batchResetProfileProxy(profileIds);
  return successResponse(command.id, { reset: profileIds.length });
}

async function handleProfileTagsBatchCreate(
  command: {
    id: string;
    action: 'nst_profile_tags_batch_create';
    profileIds: string[];
    tags: TagConfig[];
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  await client.batchCreateProfileTags(profileIds, command.tags);
  return successResponse(command.id, { created: profileIds.length });
}

async function handleProfileTagsBatchUpdate(
  command: {
    id: string;
    action: 'nst_profile_tags_batch_update';
    profileIds: string[];
    tags: TagConfig[];
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  await client.batchUpdateProfileTags(profileIds, command.tags);
  return successResponse(command.id, { updated: profileIds.length });
}

async function handleProfileTagsBatchClear(
  command: {
    id: string;
    action: 'nst_profile_tags_batch_clear';
    profileIds: string[];
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  await client.batchClearProfileTags(profileIds);
  return successResponse(command.id, { cleared: profileIds.length });
}

async function handleProfileGroupBatchChange(
  command: {
    id: string;
    action: 'nst_profile_group_batch_change';
    profileIds: string[];
    groupId: string;
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  await client.batchChangeProfileGroup(profileIds, command.groupId);
  return successResponse(command.id, { changed: profileIds.length });
}

// ==================== New Commands - Batch and CDP ====================

async function handleBrowserStartOnce(
  command: {
    id: string;
    action: 'nst_browser_start_once';
    config?: {
      platform?: 'Windows' | 'macOS' | 'Linux';
      kernel?: string;
      fingerprint?: Record<string, unknown>;
      remoteDebuggingPort?: number;
      headless?: boolean;
      disableGpu?: boolean;
      proxyEnabled?: boolean;
      autoClose?: boolean;
    };
  },
  client: NstbrowserClient
): Promise<Response> {
  const result = await client.startOnceBrowser(command.config || {});
  return successResponse(command.id, result);
}

async function handleBrowserCdpUrl(
  command: {
    id: string;
    action: 'nst_browser_cdp_url';
    profileId: string;
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileId = await resolveProfileId(client, command.profileId);
  const result = await client.getCdpUrl(profileId);
  return successResponse(command.id, result);
}

async function handleBrowserCdpUrlOnce(
  command: {
    id: string;
    action: 'nst_browser_cdp_url_once';
  },
  client: NstbrowserClient
): Promise<Response> {
  const result = await client.getCdpUrlOnce();
  return successResponse(command.id, result);
}

async function handleBrowserConnect(
  command: {
    id: string;
    action: 'nst_browser_connect';
    profileId: string;
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileId = await resolveProfileId(client, command.profileId);
  const result = await client.connectBrowser(profileId);
  return successResponse(command.id, result);
}

async function handleBrowserConnectOnce(
  command: {
    id: string;
    action: 'nst_browser_connect_once';
    config?: {
      platform?: 'Windows' | 'macOS' | 'Linux';
      kernel?: string;
      fingerprint?: Record<string, unknown>;
    };
  },
  client: NstbrowserClient
): Promise<Response> {
  const result = await client.connectOnceBrowser(command.config || {});
  return successResponse(command.id, result);
}

async function handleProfileListCursor(
  command: {
    id: string;
    action: 'nst_profile_list_cursor';
    cursor?: string;
    pageSize?: number;
    direction?: 'next' | 'prev';
  },
  client: NstbrowserClient
): Promise<Response> {
  const result = await client.getProfilesByCursor(
    command.cursor,
    command.pageSize,
    command.direction
  );
  return successResponse(command.id, result);
}

// Type for Nstbrowser commands
type NstCommand =
  | { id: string; action: 'nst_browser_list' }
  | { id: string; action: 'nst_browser_start'; profileId: string; options?: StartBrowserOptions }
  | { id: string; action: 'nst_browser_stop'; profileId: string }
  | { id: string; action: 'nst_browser_stop_all' }
  | {
      id: string;
      action: 'nst_profile_list';
      query?: { name?: string; groupId?: string; platform?: 'Windows' | 'macOS' | 'Linux' };
    }
  | { id: string; action: 'nst_profile_create'; config: ProfileConfig }
  | { id: string; action: 'nst_profile_delete'; profileId: string }
  | { id: string; action: 'nst_profile_proxy_update'; profileId: string; proxy: ProxyConfig }
  | { id: string; action: 'nst_profile_proxy_reset'; profileId: string }
  | { id: string; action: 'nst_profile_tags_list' }
  | { id: string; action: 'nst_profile_tags_create'; profileId: string; tags: TagConfig[] }
  | { id: string; action: 'nst_profile_tags_clear'; profileId: string }
  | { id: string; action: 'nst_profile_groups_list' }
  | { id: string; action: 'nst_profile_group_change'; profileId: string; groupId: string }
  | { id: string; action: 'nst_profile_cache_clear'; profileId: string }
  | { id: string; action: 'nst_profile_cookies_clear'; profileId: string };

// ==================== Diagnostic Commands ====================

/**
 * Diagnose system environment and configuration
 */
async function handleDiagnose(
  command: {
    id: string;
    action: 'diagnose';
    checks: string[];
  },
  client: NstbrowserClient,
  config: { host: string; port: number; apiKey: string }
): Promise<Response> {
  const results: Record<string, any> = {};

  // 1. Check NST Status
  try {
    const isRunning = await client.checkAgentInfo();
    results.nst_status = {
      status: isRunning ? 'OK' : 'FAILED',
      message: isRunning
        ? 'Nstbrowser agent is running and responsive'
        : 'Nstbrowser agent is not responding',
    };
  } catch (error) {
    results.nst_status = {
      status: 'FAILED',
      message: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Ensure Nstbrowser client is running and accessible',
    };
  }

  // 2. Check API Key
  results.api_key = {
    status: config.apiKey ? 'OK' : 'MISSING',
    message: config.apiKey
      ? `API key configured (${config.apiKey.substring(0, 8)}...)`
      : 'API key not configured',
    suggestion: config.apiKey
      ? null
      : 'Set API key with: nstbrowser-ai-agent config set key <your-api-key>',
  };

  // 3. Check Running Browsers
  try {
    const browsers = await client.getBrowsers();
    const runningCount = browsers.filter((b) => b.running).length;
    results.running_browsers = {
      status: 'OK',
      total: browsers.length,
      running: runningCount,
      message: `${runningCount} browser(s) running out of ${browsers.length} total`,
    };
  } catch (error) {
    results.running_browsers = {
      status: 'FAILED',
      message: `Failed to list browsers: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // 4. Check Profiles
  try {
    const profiles = await client.getProfilesByCursor(undefined, 1);
    results.profiles_count = {
      status: 'OK',
      sampled: profiles.docs.length,
      hasMore: profiles.hasMore,
      message: profiles.hasMore
        ? 'Profile access is working (at least one profile found; more profiles available)'
        : `Profile access is working (${profiles.docs.length} profile(s) found)`,
    };
  } catch (error) {
    results.profiles_count = {
      status: 'FAILED',
      message: `Failed to access profiles: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // 5. Config Validity
  results.config_validity = {
    status: 'OK',
    host: config.host,
    port: config.port,
    api_key_set: !!config.apiKey,
    endpoint: `http://${config.host}:${config.port}`,
  };

  // Overall status
  const allOk = Object.values(results).every((r: any) => !r.status || r.status === 'OK');

  return successResponse(command.id, {
    overall_status: allOk ? 'OK' : 'ISSUES_DETECTED',
    checks: results,
    suggestion: allOk
      ? 'All checks passed. System is configured correctly.'
      : 'Some issues detected. Run "nstbrowser-ai-agent repair" to attempt automatic fixes.',
  });
}

/**
 * Verify browser functionality
 */
async function handleVerify(
  command: {
    id: string;
    action: 'verify';
    testUrl: string;
    profile?: string;
    nstProfileId?: string;
    nstProfileName?: string;
  },
  client: NstbrowserClient,
  config: { host: string; port: number; apiKey: string }
): Promise<Response> {
  try {
    // Resolve profile
    const profile = command.profile || command.nstProfileId || command.nstProfileName;

    // Use resolveBrowserProfile to start/connect to browser
    const resolved = await resolveBrowserProfile(client, {
      profile,
      nstHost: config.host,
      nstPort: config.port,
      nstApiKey: config.apiKey,
    });

    // Return success with browser info
    return successResponse(command.id, {
      status: 'OK',
      message: 'Browser verification successful',
      profile: resolved.profileName || resolved.profileId || 'once browser',
      isOnce: resolved.isOnce,
      isRunning: resolved.isRunning,
      wasCreated: resolved.wasCreated,
      wsUrl: resolved.wsUrl ? 'Available' : 'Not available',
      suggestion: 'Browser is ready. You can now run browser commands like "open <url>".',
    });
  } catch (error) {
    return errorResponse(
      command.id,
      `Verification failed: ${error instanceof Error ? error.message : String(error)}\n\n` +
        `Troubleshooting:\n` +
        `- Run: nstbrowser-ai-agent diagnose\n` +
        `- Check: nstbrowser-ai-agent nst status\n` +
        `- Try: nstbrowser-ai-agent repair`
    );
  }
}

/**
 * Repair common configuration issues
 */
async function handleRepair(
  command: {
    id: string;
    action: 'repair';
    tasks: string[];
  },
  client: NstbrowserClient
): Promise<Response> {
  const tasks: Record<string, { status: string; message: string }> = {};

  // 1. Stop all browsers
  try {
    await client.stopAllBrowsers();
    tasks.stop_all_browsers = {
      status: 'OK',
      message: 'All browsers stopped successfully',
    };
  } catch (error) {
    tasks.stop_all_browsers = {
      status: 'FAILED',
      message: `Failed to stop browsers: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // 2. Clear stale states
  try {
    const deleted = cleanupExpiredStates(7); // Clean up states older than 7 days
    tasks.clear_stale_states = {
      status: 'OK',
      message: `Expired state files cleaned up (${deleted.length} files removed)`,
    };
  } catch (error) {
    tasks.clear_stale_states = {
      status: 'FAILED',
      message: `Failed to clear states: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // 3. Verify config
  const config = loadNstConfig();
  tasks.verify_config = {
    status: config?.apiKey ? 'OK' : 'FAILED',
    message: config?.apiKey
      ? 'Configuration is valid'
      : 'API key is missing. Set it with: nstbrowser-ai-agent config set key <your-api-key>',
  };

  // 4. Test connection
  try {
    const isRunning = await client.checkAgentInfo();
    tasks.test_connection = {
      status: isRunning ? 'OK' : 'FAILED',
      message: isRunning
        ? 'Connection to Nstbrowser agent successful'
        : 'Nstbrowser agent is not responding',
    };
  } catch (error) {
    tasks.test_connection = {
      status: 'FAILED',
      message: `Connection test failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const allOk = Object.values(tasks).every((t) => t.status === 'OK');

  return successResponse(command.id, {
    overall_status: allOk ? 'OK' : 'PARTIAL',
    tasks,
    suggestion: allOk
      ? 'All repair tasks completed successfully. Try your command again.'
      : 'Some repair tasks failed. Check the detailed messages above and address any remaining issues.',
  });
}
