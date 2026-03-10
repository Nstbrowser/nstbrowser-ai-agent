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
  const result = await client.startBrowser(profileId, command.options);
  return successResponse(command.id, result);
}

async function handleBrowserStop(
  command: { id: string; action: 'nst_browser_stop'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  const profileId = await resolveProfileId(client, command.profileId);
  await client.stopBrowser(profileId);
  return successResponse(command.id, { stopped: true });
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
  },
  client: NstbrowserClient
): Promise<Response> {
  const profiles = await client.getProfiles(command.query);
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
  // Build ProfileConfig from command
  const profileConfig: ProfileConfig = {
    name: command.name,
    platform: command.platform,
    kernel: command.kernel,
    fingerprint: command.fingerprint,
    groupId: command.groupId,
  };

  // Add proxy config if provided
  if (command.proxyConfig) {
    profileConfig.proxy = {
      type: command.proxyConfig.type,
      host: command.proxyConfig.host,
      port: command.proxyConfig.port,
      username: command.proxyConfig.username,
      password: command.proxyConfig.password,
    };
  }

  const profile = await client.createProfile(profileConfig);
  return successResponse(command.id, { profile });
}

async function handleProfileDelete(
  command: { id: string; action: 'nst_profile_delete'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  if (profileIds.length === 1) {
    await client.deleteProfile(profileIds[0]);
  } else {
    await client.deleteProfilesBatch(profileIds);
  }
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
  // Convert single tag string to TagConfig array
  const tags = [{ name: command.tag }];
  await client.createProfileTags(profileId, tags);
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
