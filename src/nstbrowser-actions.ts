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
import {
  enhanceProfile,
  enhanceBrowserInstance,
  createEnhancedResponse,
  createProfileSummary,
  formatRelativeTime,
} from './nstbrowser-enhanced-output.js';
import { ProgressBar } from './nstbrowser-concurrency.js';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  createProfileFromTemplate,
  exportTemplate,
  importTemplate,
  batchCreateFromTemplate,
  initializeDefaultTemplates,
} from './nstbrowser-template.js';

/**
 * Execute a Nstbrowser command
 */
export async function executeNstbrowserCommand(command: Command): Promise<Response> {
  // Get Nstbrowser configuration from environment
  const host = process.env.NST_HOST || 'localhost';
  const port = parseInt(process.env.NST_PORT || '8848', 10);
  const apiKey = process.env.NST_API_KEY || '';

  // Debug: log environment variables
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
      case 'nst_template_create':
        return await handleTemplateCreate(command, client);
      case 'nst_template_list':
        return await handleTemplateList(command, client);
      case 'nst_template_show':
        return await handleTemplateShow(command, client);
      case 'nst_template_update':
        return await handleTemplateUpdate(command, client);
      case 'nst_template_delete':
        return await handleTemplateDelete(command, client);
      case 'nst_template_export':
        return await handleTemplateExport(command, client);
      case 'nst_template_import':
        return await handleTemplateImport(command, client);
      case 'nst_profile_create_from_template':
        return await handleProfileCreateFromTemplate(command, client);
      case 'nst_profile_batch_create_from_template':
        return await handleProfileBatchCreateFromTemplate(command, client);
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
  command: { id: string; action: 'nst_browser_list'; enhanced?: boolean },
  client: NstbrowserClient
): Promise<Response> {
  const startTime = Date.now();
  const browsers = await client.getBrowsers();
  const executionTime = Date.now() - startTime;

  // Check if enhanced output is requested
  if (command.enhanced) {
    const enhancedBrowsers = browsers.map(enhanceBrowserInstance);

    const enhancedResponse = createEnhancedResponse(
      {
        browsers: enhancedBrowsers,
        summary: {
          total: browsers.length,
          running: browsers.filter((b) => b.running).length,
          stopped: browsers.filter((b) => !b.running).length,
        },
      },
      {
        executionTime,
      }
    );

    return successResponse(command.id, enhancedResponse);
  }

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
    enhanced?: boolean;
  },
  client: NstbrowserClient
): Promise<Response> {
  const startTime = Date.now();
  const profiles = await client.getProfiles(command.query);
  const executionTime = Date.now() - startTime;

  // Check if enhanced output is requested
  if (command.enhanced) {
    const enhancedProfiles = profiles.map(enhanceProfile);
    const summary = createProfileSummary(profiles);

    const enhancedResponse = createEnhancedResponse(
      {
        profiles: enhancedProfiles,
        summary,
      },
      {
        executionTime,
        schemaUrl: 'https://docs.nstbrowser.io/api/schema/profile-list',
      }
    );

    return successResponse(command.id, enhancedResponse);
  }

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
    showProgress?: boolean;
  },
  client: NstbrowserClient
): Promise<Response> {
  const profileIds = await resolveProfileIds(client, command.profileIds);
  
  // Show progress if requested
  let progressBar: ProgressBar | undefined;
  if (command.showProgress && !process.env.NSTBROWSER_AI_AGENT_JSON) {
    progressBar = new ProgressBar(profileIds.length);
  }

  const startTime = Date.now();
  
  // Use batch operation with concurrency
  const { results, errors } = await client.batchOperation(
    profileIds,
    async (profileId) => {
      await client.updateProfileProxy(profileId, command.proxyConfig);
      return profileId;
    },
    {
      concurrency: 10,
      onProgress: (completed, total) => {
        if (progressBar) {
          progressBar.update(completed);
        }
      },
    }
  );

  if (progressBar) {
    progressBar.finish();
  }

  const executionTime = Date.now() - startTime;

  return successResponse(command.id, {
    updated: results.length,
    failed: errors.length,
    errors: errors.map((e) => ({ profileId: e.item, error: e.error.message })),
    executionTime: `${executionTime}ms`,
  });
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

// ==================== Template Management ====================

async function handleTemplateCreate(
  command: {
    id: string;
    action: 'nst_template_create';
    name: string;
    config: Omit<ProfileConfig, 'name'>;
    description?: string;
  },
  client: NstbrowserClient
): Promise<Response> {
  try {
    const template = createTemplate(command.name, command.config, command.description);
    return successResponse(command.id, { template });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

async function handleTemplateList(
  command: { id: string; action: 'nst_template_list' },
  client: NstbrowserClient
): Promise<Response> {
  const templates = listTemplates();
  return successResponse(command.id, { templates });
}

async function handleTemplateShow(
  command: { id: string; action: 'nst_template_show'; name: string },
  client: NstbrowserClient
): Promise<Response> {
  const template = getTemplate(command.name);
  
  if (!template) {
    return errorResponse(command.id, `Template '${command.name}' not found`);
  }
  
  return successResponse(command.id, { template });
}

async function handleTemplateUpdate(
  command: {
    id: string;
    action: 'nst_template_update';
    name: string;
    config?: Partial<Omit<ProfileConfig, 'name'>>;
    description?: string;
  },
  client: NstbrowserClient
): Promise<Response> {
  try {
    const template = updateTemplate(command.name, command.config || {}, command.description);
    return successResponse(command.id, { template });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

async function handleTemplateDelete(
  command: { id: string; action: 'nst_template_delete'; name: string },
  client: NstbrowserClient
): Promise<Response> {
  try {
    deleteTemplate(command.name);
    return successResponse(command.id, { deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

async function handleTemplateExport(
  command: { id: string; action: 'nst_template_export'; name: string },
  client: NstbrowserClient
): Promise<Response> {
  try {
    const json = exportTemplate(command.name);
    return successResponse(command.id, { json });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

async function handleTemplateImport(
  command: {
    id: string;
    action: 'nst_template_import';
    json: string;
    name?: string;
  },
  client: NstbrowserClient
): Promise<Response> {
  try {
    const template = importTemplate(command.json, command.name);
    return successResponse(command.id, { template });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

async function handleProfileCreateFromTemplate(
  command: {
    id: string;
    action: 'nst_profile_create_from_template';
    templateName: string;
    profileName: string;
    overrides?: Partial<ProfileConfig>;
  },
  client: NstbrowserClient
): Promise<Response> {
  try {
    const config = createProfileFromTemplate(
      command.templateName,
      command.profileName,
      command.overrides
    );
    const profile = await client.createProfile(config);
    return successResponse(command.id, { profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

async function handleProfileBatchCreateFromTemplate(
  command: {
    id: string;
    action: 'nst_profile_batch_create_from_template';
    templateName: string;
    profileNames: string[];
    showProgress?: boolean;
  },
  client: NstbrowserClient
): Promise<Response> {
  let progressBar: ProgressBar | undefined;
  if (command.showProgress && !process.env.NSTBROWSER_AI_AGENT_JSON) {
    progressBar = new ProgressBar(command.profileNames.length);
  }

  try {
    const { succeeded, failed } = await batchCreateFromTemplate(
      command.templateName,
      command.profileNames,
      async (config) => await client.createProfile(config),
      {
        onProgress: (completed, total, current) => {
          if (progressBar) {
            progressBar.update(completed, current);
          }
        },
      }
    );

    if (progressBar) {
      progressBar.finish();
    }

    return successResponse(command.id, {
      succeeded: succeeded.length,
      failed: failed.length,
      profiles: succeeded,
      errors: failed,
    });
  } catch (error) {
    if (progressBar) {
      progressBar.finish();
    }
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
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
