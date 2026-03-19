/**
 * Nstbrowser API client
 * Handles all communication with Nstbrowser API v2
 */

import type {
  BrowserInstance,
  StartBrowserOptions,
  StartBrowserResponse,
  Profile,
  ProfileQuery,
  ProfileConfig,
  ProxyConfig,
  Tag,
  TagConfig,
  ProfileGroup,
  ConnectResponse,
  OnceBrowserConfig,
  NstApiResponse,
} from './nstbrowser-types.js';
import {
  NstbrowserError,
  NstbrowserAuthError,
  handleNstbrowserError,
} from './nstbrowser-errors.js';
import { VERSION } from './version.js';
import {
  DEFAULT_NST_PORT,
  DEFAULT_REQUEST_TIMEOUT,
  DEFAULT_RETRY_COUNT,
  AGENT_INFO_TIMEOUT,
  HEADER_API_KEY,
  HEADER_CONTENT_TYPE,
  CONTENT_TYPE_JSON,
  API_AGENT_INFO,
  API_BROWSERS,
  API_BROWSERS_ONCE,
  API_BROWSERS_BATCH,
  API_PROFILES,
  API_LOCAL_PROFILES,
  API_PROFILES_CURSOR,
  API_PROFILES_TAGS,
  API_PROFILES_PROXY_BATCH,
  API_PROFILES_PROXY_BATCH_RESET,
  API_PROFILES_TAGS_BATCH,
  API_PROFILES_TAGS_BATCH_CLEAR,
  API_PROFILES_GROUP_BATCH,
  API_PROFILES_GROUPS,
  API_CDP_CONNECT,
  ERROR_CODES,
} from './constants.js';
import { isUuid } from './nstbrowser-profile-resolver.js';

export class NstbrowserClient {
  private baseUrl: string;
  private apiKey: string;
  private host: string;
  private port: number;
  private static readonly CI_HEADER = NstbrowserClient.buildCiHeader();

  constructor(host: string, port: number, apiKey: string) {
    this.host = host;
    this.port = port;
    this.baseUrl = `http://${host}:${port}`;
    this.apiKey = apiKey;

    // Validate endpoint
    this.validateEndpoint(host, port);

    // Debug mode warning
    if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
      console.error('[SECURITY] Debug mode enabled - API keys may be logged');
    }
  }

  /**
   * Build CI header with client information
   */
  private static buildCiHeader(): string {
    const name = `nstbrowser-ai-agent/${VERSION}`;
    const runtime = `node/${process.version.substring(1)}`;
    return `${name}; ${runtime}`;
  }

  /**
   * Validate endpoint configuration
   */
  private validateEndpoint(host: string, port: number): void {
    if (!host || host.trim() === '') {
      throw new Error('Invalid Nstbrowser host');
    }

    if (port < 1 || port > 65535) {
      throw new Error('Invalid Nstbrowser port (must be 1-65535)');
    }

    // Prevent connecting to dangerous internal addresses
    const dangerousHosts = ['0.0.0.0', '169.254.169.254'];
    if (dangerousHosts.includes(host)) {
      throw new Error(`Connecting to ${host} is not allowed for security reasons`);
    }
  }

  /**
   * Make HTTP request to Nstbrowser API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options?: { timeout?: number; retries?: number }
  ): Promise<T> {
    const timeout = options?.timeout || DEFAULT_REQUEST_TIMEOUT;
    const retries = options?.retries || DEFAULT_RETRY_COUNT;
    const url = `${this.baseUrl}${endpoint}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        this.logRequest(method, endpoint, data);

        const response = await fetch(url, {
          method,
          headers: {
            [HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON,
            [HEADER_API_KEY]: this.apiKey,
            ci: NstbrowserClient.CI_HEADER,
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Get the raw error response
          const errorText = await response.text().catch(() => '');
          let errorBody: { msg?: string; message?: string; code?: number } = {};

          // Try to parse JSON error response
          if (errorText) {
            try {
              errorBody = JSON.parse(errorText);
            } catch {
              // Not JSON, use raw text
            }
          }

          // Extract the actual error message from API response
          const apiMessage = errorBody.msg || errorBody.message || errorText || 'No error message';

          // Build concise error message with API response
          const errorMessage = `HTTP ${response.status}: ${apiMessage}`;

          // In debug mode, log full details
          if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
            console.error('[DEBUG] API Error:', {
              url,
              method,
              status: response.status,
              statusText: response.statusText,
              body: errorText,
              headers: Object.fromEntries(response.headers.entries()),
            });
          }

          // Special handling for auth errors
          if (response.status === 401) {
            throw new NstbrowserError(errorMessage, ERROR_CODES.NST_AUTH_ERROR, response.status);
          }

          // Throw error with original API message
          throw new NstbrowserError(errorMessage, errorBody.code?.toString(), response.status);
        }

        const result = (await response.json()) as NstApiResponse<T>;

        // Nstbrowser API uses 'err: false' to indicate success
        if (result.err) {
          // Return the exact error message from API
          throw new NstbrowserError(result.msg || 'Unknown error', result.code?.toString());
        }

        return result.data as T;
      } catch (error) {
        if (error instanceof NstbrowserError) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        // If last attempt, throw error
        if (attempt === retries - 1) {
          throw handleNstbrowserError(lastError);
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw lastError || new Error('Request failed');
  }

  /**
   * Log request details in debug mode
   */
  private logRequest(method: string, endpoint: string, data?: unknown): void {
    if (process.env.NSTBROWSER_AI_AGENT_DEBUG !== '1') return;

    console.log(`[NST] ${method} ${this.baseUrl}${endpoint}`);
    if (data) {
      console.log(`[NST] Request body:`, JSON.stringify(data, null, 2));
    }
  }

  // ==================== Browser Instance Management ====================

  /**
   * Check if NST agent is running and responsive
   */
  async checkAgentInfo(): Promise<boolean> {
    try {
      await this.request<unknown>('GET', API_AGENT_INFO, undefined, {
        timeout: AGENT_INFO_TIMEOUT,
        retries: 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all running browser instances
   */
  async getBrowsers(): Promise<BrowserInstance[]> {
    const result = await this.request<BrowserInstance[] | null>('GET', API_BROWSERS);
    return result || [];
  }

  /**
   * Start a browser instance for a profile
   */
  async startBrowser(
    profileId: string,
    options?: StartBrowserOptions
  ): Promise<StartBrowserResponse> {
    // Note: Options are not supported by this endpoint
    // Use startOnceBrowser for custom configuration
    const response = await this.request<{
      profileId: string;
      port: number;
      webSocketDebuggerUrl: string;
      proxy: string;
    }>('POST', `${API_BROWSERS}/${profileId}`);

    return {
      profileId: response.profileId,
      webSocketDebuggerUrl: response.webSocketDebuggerUrl,
      remoteDebuggingPort: response.port,
    };
  }

  /**
   * Start a temporary browser (once browser)
   */
  async startOnceBrowser(config: OnceBrowserConfig): Promise<StartBrowserResponse> {
    return this.request<StartBrowserResponse>('POST', API_BROWSERS_ONCE, config);
  }

  /**
   * Start multiple browsers in batch
   */
  async startBrowsersBatch(
    profileIds: string[],
    options?: StartBrowserOptions
  ): Promise<StartBrowserResponse[]> {
    return this.request<StartBrowserResponse[]>('POST', API_BROWSERS_BATCH, {
      profileIds,
      ...options,
    });
  }

  /**
   * Stop a browser instance
   */
  async stopBrowser(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `${API_BROWSERS}/${profileId}`);
  }

  /**
   * Stop all browser instances
   * API Doc: https://apidocs.nstbrowser.io/api-15554896.md
   * Note: Requires empty array as request body to stop all browsers
   * Note: Endpoint requires trailing slash to avoid 307 redirect
   */
  async stopAllBrowsers(): Promise<void> {
    await this.request<void>('DELETE', `${API_BROWSERS}/`, []);
  }

  /**
   * Get all pages for a browser instance
   */
  async getBrowserPages(profileId: string): Promise<unknown[]> {
    return this.request<unknown[]>('GET', `${API_BROWSERS}/${profileId}/pages`);
  }

  /**
   * Get remote debugging address for a browser
   */
  async getBrowserDebugger(profileId: string): Promise<{ debuggerUrl: string }> {
    return this.request<{ debuggerUrl: string }>('GET', `${API_BROWSERS}/${profileId}/debugger`);
  }

  // ==================== Profile Management ====================

  /**
   * Get profiles with optional query
   * API Doc: https://apidocs.nstbrowser.io/api-15554903.md
   */
  async getProfiles(query?: ProfileQuery): Promise<Profile[]> {
    // Build query parameters for server-side filtering
    const params = new URLSearchParams();
    params.append('pageSize', '20');
    const profileName = query?.name?.trim().replace(' ', '') || '';

    if (query) {
      if (profileName && profileName !== '') {
        params.append('s', profileName); // 's' parameter searches by name or id
      }
      if (query.groupId) {
        params.append('groupId', query.groupId);
      }
      if (query.tags) {
        const tagsStr = Array.isArray(query.tags) ? query.tags.join(',') : query.tags;
        params.append('tags', tagsStr);
      }
      // Note: platform filtering is not supported by the API query parameters
      // We'll apply it client-side if needed
    }

    const queryString = params.toString();
    const endpoint = queryString ? `${API_PROFILES}?${queryString}` : API_PROFILES;

    const response = await this.request<{ docs: Profile[] }>('GET', endpoint);
    let profiles = response.docs || [];

    // Apply client-side platform filtering if needed (API doesn't support this parameter)
    if (query?.platform) {
      const platformMap: Record<string, number> = { Windows: 0, macOS: 1, Linux: 2 };
      const platformNum = platformMap[query.platform];
      if (platformNum !== undefined) {
        profiles = profiles.filter((p) => p.platform === platformNum);
      }
    }

    if (profileName !== '' && !isUuid(profileName)) {
      profiles = profiles.filter((p) => p.name === profileName);
    }

    return profiles;
  }

  /**
   * Get profiles with cursor-based pagination
   * API Doc: https://apidocs.nstbrowser.io/api-19974738.md
   * Note: Requires Nstbrowser 1.17.3+
   */
  async getProfilesByCursor(
    cursor?: string,
    pageSize?: number,
    direction?: 'next' | 'prev'
  ): Promise<{
    docs: Profile[];
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
  }> {
    // Build query parameters
    const params = new URLSearchParams();

    if (pageSize) {
      params.append('pageSize', pageSize.toString());
    }
    if (cursor) {
      params.append('cursor', cursor);
    }
    if (direction) {
      params.append('direction', direction);
    }

    const queryString = params.toString();
    const endpoint = queryString ? `${API_PROFILES_CURSOR}?${queryString}` : API_PROFILES_CURSOR;

    return this.request<{
      docs: Profile[];
      hasMore: boolean;
      nextCursor?: string;
      prevCursor?: string;
    }>('GET', endpoint);
  }

  /**
   * Create a new profile
   */
  async createProfile(config: ProfileConfig): Promise<Profile> {
    const payload: Record<string, unknown> = {
      name: config.name,
    };

    if (config.platform) {
      payload.platform = config.platform;
    }
    if (config.kernel) {
      payload.kernel = config.kernel;
    }
    if (config.fingerprint) {
      payload.fingerprint = config.fingerprint;
    }
    if (config.groupId) {
      payload.groupId = config.groupId;
    }
    if (config.proxy) {
      const auth =
        config.proxy.username && config.proxy.password
          ? `${config.proxy.username}:${config.proxy.password}@`
          : '';
      payload.proxyConfig = {
        url: `${config.proxy.type}://${auth}${config.proxy.host}:${config.proxy.port}`,
      };
    }

    const response = await this.request<Profile>('POST', API_PROFILES, payload);

    // Debug log in debug mode
    if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
      console.error('[DEBUG] Create profile response:', JSON.stringify(response, null, 2));
    }

    return response;
  }

  /**
   * Delete a profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `${API_PROFILES}${profileId}`);
  }

  /**
   * Delete multiple profiles in batch
   * API Doc: https://apidocs.nstbrowser.io/api-15554905.md
   */
  async deleteProfilesBatch(profileIds: string[]): Promise<void> {
    // Note: API expects array directly as request body, not wrapped in object
    await this.request<void>('DELETE', API_PROFILES, profileIds);
  }

  // ==================== Proxy Management ====================

  /**
   * Update profile proxy configuration
   * API Doc: https://apidocs.nstbrowser.io/api-15554907.md
   */
  async updateProfileProxy(profileId: string, proxy: ProxyConfig): Promise<void> {
    // Convert ProxyConfig to URL format expected by API
    const proxyUrl = `${proxy.type}://${proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`;
    await this.request<void>('PUT', `${API_PROFILES}${profileId}/proxy`, { url: proxyUrl });
  }

  /**
   * Update proxy for multiple profiles in batch
   * API Doc: https://apidocs.nstbrowser.io/api-15554909.md
   */
  async batchUpdateProxy(profileIds: string[], proxy: ProxyConfig): Promise<void> {
    // Convert ProxyConfig to URL format expected by API
    const proxyUrl = `${proxy.type}://${proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`;

    await this.request<void>('PUT', API_PROFILES_PROXY_BATCH, {
      profileIds,
      proxyConfig: {
        // Note: API expects 'proxyConfig', not 'proxy'
        url: proxyUrl,
      },
    });
  }

  /**
   * Reset profile proxy to local type
   */
  async resetProfileProxy(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `${API_PROFILES}${profileId}/proxy`);
  }

  /**
   * Reset proxy for multiple profiles in batch
   */
  async batchResetProfileProxy(profileIds: string[]): Promise<void> {
    await this.request<void>('POST', API_PROFILES_PROXY_BATCH_RESET, { profileIds });
  }

  // ==================== Tag Management ====================

  /**
   * Get all available tags
   */
  async getProfileTags(): Promise<Tag[]> {
    return this.request<Tag[]>('GET', API_PROFILES_TAGS);
  }

  /**
   * Create tags for a profile
   */
  async createProfileTags(profileId: string, tags: TagConfig[]): Promise<void> {
    // API expects array directly, not wrapped in object
    await this.request<void>('POST', `${API_PROFILES}${profileId}/tags`, tags);
  }

  /**
   * Create tags for multiple profiles in batch
   */
  async batchCreateProfileTags(profileIds: string[], tags: TagConfig[]): Promise<void> {
    await this.request<void>('POST', API_PROFILES_TAGS_BATCH, {
      profileIds,
      tags,
    });
  }

  /**
   * Update tags for a profile
   */
  async updateProfileTags(profileId: string, tags: TagConfig[]): Promise<void> {
    await this.request<void>('PUT', `${API_PROFILES}${profileId}/tags`, tags);
  }

  /**
   * Update tags for multiple profiles in batch
   */
  async batchUpdateProfileTags(profileIds: string[], tags: TagConfig[]): Promise<void> {
    await this.request<void>('PUT', API_PROFILES_TAGS_BATCH, {
      profileIds,
      tags,
    });
  }

  /**
   * Clear tags for a profile
   */
  async clearProfileTags(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `${API_PROFILES}${profileId}/tags`);
  }

  /**
   * Clear tags for multiple profiles in batch
   */
  async batchClearProfileTags(profileIds: string[]): Promise<void> {
    await this.request<void>('POST', API_PROFILES_TAGS_BATCH_CLEAR, { profileIds });
  }

  // ==================== Group Management ====================

  /**
   * Get all profile groups
   */
  async getAllProfileGroups(): Promise<ProfileGroup[]> {
    return this.request<ProfileGroup[]>('GET', API_PROFILES_GROUPS);
  }

  /**
   * Change profile group
   */
  async changeProfileGroup(profileId: string, groupId: string): Promise<void> {
    await this.request<void>('PUT', `${API_PROFILES}${profileId}/group`, { groupId });
  }

  /**
   * Change group for multiple profiles in batch
   */
  async batchChangeProfileGroup(profileIds: string[], groupId: string): Promise<void> {
    await this.request<void>('PUT', API_PROFILES_GROUP_BATCH, {
      profileIds,
      groupId,
    });
  }

  // ==================== Local Data Management ====================

  /**
   * Clear profile cache
   */
  async clearProfileCache(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `${API_LOCAL_PROFILES}${profileId}`);
  }

  /**
   * Clear profile cookies
   */
  async clearProfileCookies(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `${API_LOCAL_PROFILES}${profileId}/cookies`);
  }

  // ==================== CDP Endpoints ====================

  /**
   * Get CDP WebSocket URL for a profile browser
   * Uses the correct CDP endpoint: GET /api/v2/connect/{profileId}
   */
  async getCdpUrl(profileId: string): Promise<{ webSocketDebuggerUrl: string }> {
    const response = await this.request<{
      webSocketDebuggerUrl: string;
    }>('GET', `${API_CDP_CONNECT}/${profileId}`);

    return {
      webSocketDebuggerUrl: response.webSocketDebuggerUrl,
    };
  }

  /**
   * Get CDP WebSocket URL for once browser
   * Uses the correct CDP endpoint: GET /api/v2/connect
   */
  async getCdpUrlOnce(): Promise<{ webSocketDebuggerUrl: string }> {
    const response = await this.request<{
      webSocketDebuggerUrl: string;
    }>('GET', API_CDP_CONNECT);

    return {
      webSocketDebuggerUrl: response.webSocketDebuggerUrl,
    };
  }

  /**
   * Connect to a browser (start and get CDP URL)
   */
  async connectBrowser(profileId: string): Promise<ConnectResponse> {
    const response = await this.request<{
      profileId: string;
      port: number;
      webSocketDebuggerUrl: string;
      proxy: string;
    }>('POST', `${API_BROWSERS}/${profileId}`);

    return {
      profileId: response.profileId,
      webSocketDebuggerUrl: response.webSocketDebuggerUrl,
      remoteDebuggingPort: response.port,
    };
  }

  /**
   * Connect to a temporary browser (once browser)
   */
  async connectOnceBrowser(config: OnceBrowserConfig): Promise<ConnectResponse> {
    const response = await this.request<{
      profileId: string;
      port: number;
      webSocketDebuggerUrl: string;
      proxy: string;
    }>('POST', API_BROWSERS_ONCE, config);

    return {
      profileId: response.profileId,
      webSocketDebuggerUrl: response.webSocketDebuggerUrl,
      remoteDebuggingPort: response.port,
    };
  }

  // ==================== Method Aliases for Convenience ====================

  /**
   * Alias for getProfiles()
   */
  async listProfiles(query?: ProfileQuery): Promise<Profile[]> {
    return this.getProfiles(query);
  }

  /**
   * Alias for deleteProfilesBatch()
   */
  async deleteProfiles(profileIds: string[]): Promise<void> {
    return this.deleteProfilesBatch(profileIds);
  }

  /**
   * Alias for getBrowsers()
   */
  async listBrowsers(): Promise<BrowserInstance[]> {
    return this.getBrowsers();
  }

  /**
   * Alias for getProfileTags()
   */
  async listTags(): Promise<Tag[]> {
    return this.getProfileTags();
  }

  /**
   * Alias for getAllProfileGroups()
   */
  async listGroups(): Promise<ProfileGroup[]> {
    return this.getAllProfileGroups();
  }
}
