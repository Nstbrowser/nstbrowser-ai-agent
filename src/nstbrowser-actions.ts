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

/**
 * Execute a Nstbrowser command
 */
export async function executeNstbrowserCommand(command: Command): Promise<Response> {
  const host = process.env.NST_HOST || 'localhost';
  const port = parseInt(process.env.NST_PORT || '8848', 10);
  const apiKey = process.env.NST_API_KEY || '';

  if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
    console.error('[DEBUG] Nstbrowser daemon environment variables:', {
      NST_HOST: process.env.NST_HOST,
      NST_PORT: process.env.NST_PORT,
      NST_API_KEY: apiKey ? `${apiKey.substring(0, 8)}...` : 'undefined',
      NST_PROFILE: process.env.NST_PROFILE,
    });
  }

  if (!apiKey) {
    return errorResponse(command.id, 'NST_API_KEY environment variable is required');
  }

  const client = new NstbrowserClient(host, port, apiKey);

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
  const result = await client.startBrowser(command.profileId, command.options);
  return successResponse(command.id, result);
}

async function handleBrowserStop(
  command: { id: string; action: 'nst_browser_stop'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  await client.stopBrowser(command.profileId);
  return successResponse(command.id, { stopped: true });
}

async function handleBrowserStopAll(
  command: { id: string; action: 'nst_browser_stop_all' },
  client: NstbrowserClient
): Promise<Response> {
  await client.stopAllBrowsers();
  return successResponse(command.id, { stopped: true });
}

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
  const profileConfig: ProfileConfig = {
    name: command.name,
    platform: command.platform,
    kernel: command.kernel,
    fingerprint: command.fingerprint,
    groupId: command.groupId,
  };

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
  if (command.profileIds.length === 1) {
    await client.deleteProfile(command.profileIds[0]);
  } else {
    await client.deleteProfilesBatch(command.profileIds);
  }
  return successResponse(command.id, { deleted: command.profileIds.length });
}

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
  await client.updateProfileProxy(command.profileId, command.proxyConfig);
  return successResponse(command.id, { updated: true });
}

async function handleProfileProxyReset(
  command: { id: string; action: 'nst_profile_proxy_reset'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  if (command.profileIds.length === 1) {
    await client.resetProfileProxy(command.profileIds[0]);
  } else {
    await client.batchResetProfileProxy(command.profileIds);
  }
  return successResponse(command.id, { reset: command.profileIds.length });
}

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
  const tags = [{ name: command.tag }];
  await client.createProfileTags(command.profileId, tags);
  return successResponse(command.id, { created: true });
}

async function handleProfileTagsClear(
  command: { id: string; action: 'nst_profile_tags_clear'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  if (command.profileIds.length === 1) {
    await client.clearProfileTags(command.profileIds[0]);
  } else {
    await client.batchClearProfileTags(command.profileIds);
  }
  return successResponse(command.id, { cleared: command.profileIds.length });
}

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
  if (command.profileIds.length === 1) {
    await client.changeProfileGroup(command.profileIds[0], command.groupId);
  } else {
    await client.batchChangeProfileGroup(command.profileIds, command.groupId);
  }
  return successResponse(command.id, { changed: command.profileIds.length });
}

async function handleProfileCacheClear(
  command: { id: string; action: 'nst_profile_cache_clear'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  for (const profileId of command.profileIds) {
    await client.clearProfileCache(profileId);
  }
  return successResponse(command.id, { cleared: command.profileIds.length });
}

async function handleProfileCookiesClear(
  command: { id: string; action: 'nst_profile_cookies_clear'; profileIds: string[] },
  client: NstbrowserClient
): Promise<Response> {
  for (const profileId of command.profileIds) {
    await client.clearProfileCookies(profileId);
  }
  return successResponse(command.id, { cleared: command.profileIds.length });
}

async function handleProfileShow(
  command: { id: string; action: 'nst_profile_show'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  const profiles = await client.getProfiles();
  const profile = profiles.find(
    (p) => p.profileId === command.profileId || p.name === command.profileId
  );

  if (!profile) {
    throw new Error(`Profile ${command.profileId} not found`);
  }

  return successResponse(command.id, { profile });
}

async function handleProfileProxyShow(
  command: { id: string; action: 'nst_profile_proxy_show'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  const profiles = await client.getProfiles();
  const profile = profiles.find(
    (p) => p.profileId === command.profileId || p.name === command.profileId
  );

  if (!profile) {
    throw new Error(`Profile ${command.profileId} not found`);
  }

  return successResponse(command.id, {
    proxyConfig: profile.proxyConfig,
    proxyResult: profile.proxyResult,
  });
}

async function handleBrowserPages(
  command: { id: string; action: 'nst_browser_pages'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  const pages = await client.getBrowserPages(command.profileId);
  return successResponse(command.id, { pages });
}

async function handleBrowserDebugger(
  command: { id: string; action: 'nst_browser_debugger'; profileId: string },
  client: NstbrowserClient
): Promise<Response> {
  const debuggerInfo = await client.getBrowserDebugger(command.profileId);
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
  await client.updateProfileTags(command.profileId, command.tags);
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
  await client.batchUpdateProxy(command.profileIds, command.proxyConfig);
  return successResponse(command.id, { updated: command.profileIds.length });
}

async function handleProfileProxyBatchReset(
  command: {
    id: string;
    action: 'nst_profile_proxy_batch_reset';
    profileIds: string[];
  },
  client: NstbrowserClient
): Promise<Response> {
  await client.batchResetProfileProxy(command.profileIds);
  return successResponse(command.id, { reset: command.profileIds.length });
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
  await client.batchCreateProfileTags(command.profileIds, command.tags);
  return successResponse(command.id, { created: command.profileIds.length });
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
  await client.batchUpdateProfileTags(command.profileIds, command.tags);
  return successResponse(command.id, { updated: command.profileIds.length });
}

async function handleProfileTagsBatchClear(
  command: {
    id: string;
    action: 'nst_profile_tags_batch_clear';
    profileIds: string[];
  },
  client: NstbrowserClient
): Promise<Response> {
  await client.batchClearProfileTags(command.profileIds);
  return successResponse(command.id, { cleared: command.profileIds.length });
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
  await client.batchChangeProfileGroup(command.profileIds, command.groupId);
  return successResponse(command.id, { changed: command.profileIds.length });
}

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
