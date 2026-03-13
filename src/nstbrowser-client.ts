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

export class NstbrowserClient {
  private baseUrl: string;
  private apiKey: string;
  private host: string;
  private port: number;

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
    const timeout = options?.timeout || 30000;
    const retries = options?.retries || 3;
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
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'No response body');

          // Create structured error message with diagnostic information
          let errorMessage: string;
          switch (response.status) {
            case 400:
              errorMessage = `NST Service Error (HTTP 400): ${errorText}\n\nDiagnostic Information:\n• The Nstbrowser desktop client may not be running\n• API endpoint may not be accessible\n• Request format may be invalid\n\nTroubleshooting Steps:\n1. Start the Nstbrowser desktop client\n2. Check if port ${this.port} is accessible: curl http://${this.host}:${this.port}\n3. Verify API key: nstbrowser-ai-agent config show\n4. Check service status: nstbrowser-ai-agent status\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting`;
              break;
            case 401:
              errorMessage = `NST Authentication Error (HTTP 401): ${errorText}\n\nDiagnostic Information:\n• API key is missing or invalid\n• API key may have expired\n\nTroubleshooting Steps:\n1. Set your API key: nstbrowser-ai-agent config set key YOUR_API_KEY\n2. Verify API key: nstbrowser-ai-agent config show\n3. Check if API key is valid in Nstbrowser dashboard\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting`;
              throw new NstbrowserError(errorMessage, 'NST_AUTH_ERROR', 401);
            case 403:
              errorMessage = `NST Permission Error (HTTP 403): ${errorText}\n\nDiagnostic Information:\n• API key lacks required permissions\n• Resource access is restricted\n\nTroubleshooting Steps:\n1. Check API key permissions in Nstbrowser dashboard\n2. Verify you have access to the requested resource\n3. Contact support if permissions appear correct\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting`;
              break;
            case 404:
              errorMessage = `NST Resource Not Found (HTTP 404): ${errorText}\n\nDiagnostic Information:\n• Profile ID or name does not exist\n• Browser instance may have been stopped\n• API endpoint may be incorrect\n\nTroubleshooting Steps:\n1. List available profiles: nstbrowser-ai-agent profile list\n2. Check running browsers: nstbrowser-ai-agent browser list\n3. Verify profile ID format (UUID) or name spelling\n4. Create profile if needed: nstbrowser-ai-agent profile create <name>\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting`;
              if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
                console.error('[DEBUG] 404 Error details:', {
                  url,
                  status: response.status,
                  statusText: response.statusText,
                  body: errorText,
                });
              }
              throw new NstbrowserError(errorMessage, 'NST_NOT_FOUND', 404);
            default:
              if (response.status >= 500) {
                errorMessage = `NST Server Error (HTTP ${response.status}): ${errorText}\n\nDiagnostic Information:\n• Nstbrowser service encountered an internal error\n• Service may be overloaded or misconfigured\n\nTroubleshooting Steps:\n1. Wait a moment and try again\n2. Restart the Nstbrowser desktop client\n3. Check Nstbrowser service logs\n4. Contact support if problem persists\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting`;
              } else {
                errorMessage = `NST Service Error (HTTP ${response.status}): ${errorText}\n\nDiagnostic Information:\n• Unexpected HTTP status code\n• Service may be unavailable\n\nTroubleshooting Steps:\n1. Check if Nstbrowser desktop client is running\n2. Verify network connectivity to ${this.host}:${this.port}\n3. Check service status: nstbrowser-ai-agent status\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting`;
              }
              break;
          }

          const errorData = (await response.json().catch(() => ({}))) as {
            message?: string;
            code?: number;
          };
          throw new NstbrowserError(errorMessage, errorData.code?.toString(), response.status);
        }

        const result = (await response.json()) as NstApiResponse<T>;

        // Nstbrowser API uses 'err: false' to indicate success
        if (result.err) {
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
      await this.request<unknown>('GET', '/api/agent/agent/info', undefined, {
        timeout: 3000,
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
    const result = await this.request<BrowserInstance[] | null>('GET', '/api/v2/browsers');
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
    }>('POST', `/api/v2/browsers/${profileId}`);

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
    return this.request<StartBrowserResponse>('POST', '/api/v2/browsers/once', config);
  }

  /**
   * Start multiple browsers in batch
   */
  async startBrowsersBatch(
    profileIds: string[],
    options?: StartBrowserOptions
  ): Promise<StartBrowserResponse[]> {
    return this.request<StartBrowserResponse[]>('POST', '/api/v2/browsers/batch', {
      profileIds,
      ...options,
    });
  }

  /**
   * Stop a browser instance
   */
  async stopBrowser(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/v2/browsers/${profileId}`);
  }

  /**
   * Stop all browser instances
   * API Doc: https://apidocs.nstbrowser.io/api-15554896.md
   * Note: Requires empty array as request body to stop all browsers
   * Note: Endpoint requires trailing slash to avoid 307 redirect
   */
  async stopAllBrowsers(): Promise<void> {
    await this.request<void>('DELETE', '/api/v2/browsers/', []);
  }

  /**
   * Get all pages for a browser instance
   */
  async getBrowserPages(profileId: string): Promise<unknown[]> {
    return this.request<unknown[]>('GET', `/api/v2/browsers/${profileId}/pages`);
  }

  /**
   * Get remote debugging address for a browser
   */
  async getBrowserDebugger(profileId: string): Promise<{ debuggerUrl: string }> {
    return this.request<{ debuggerUrl: string }>('GET', `/api/v2/browsers/${profileId}/debugger`);
  }

  // ==================== Profile Management ====================

  /**
   * Get profiles with optional query
   * API Doc: https://apidocs.nstbrowser.io/api-15554903.md
   */
  async getProfiles(query?: ProfileQuery): Promise<Profile[]> {
    // Build query parameters for server-side filtering
    const params = new URLSearchParams();

    if (query) {
      if (query.name) {
        params.append('s', query.name); // 's' parameter searches by name or id
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
    const endpoint = queryString ? `/api/v2/profiles?${queryString}` : '/api/v2/profiles';

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
    const endpoint = queryString
      ? `/api/v2/profiles/cursor?${queryString}`
      : '/api/v2/profiles/cursor';

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
    const response = await this.request<Profile>('POST', '/api/v2/profiles', config);

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
    await this.request<void>('DELETE', `/api/v2/profiles/${profileId}`);
  }

  /**
   * Delete multiple profiles in batch
   * API Doc: https://apidocs.nstbrowser.io/api-15554905.md
   */
  async deleteProfilesBatch(profileIds: string[]): Promise<void> {
    // Note: API expects array directly as request body, not wrapped in object
    await this.request<void>('DELETE', '/api/v2/profiles', profileIds);
  }

  // ==================== Proxy Management ====================

  /**
   * Update profile proxy configuration
   * API Doc: https://apidocs.nstbrowser.io/api-15554907.md
   */
  async updateProfileProxy(profileId: string, proxy: ProxyConfig): Promise<void> {
    // Convert ProxyConfig to URL format expected by API
    const proxyUrl = `${proxy.type}://${proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`;
    await this.request<void>('PUT', `/api/v2/profiles/${profileId}/proxy`, { url: proxyUrl });
  }

  /**
   * Update proxy for multiple profiles in batch
   * API Doc: https://apidocs.nstbrowser.io/api-15554909.md
   */
  async batchUpdateProxy(profileIds: string[], proxy: ProxyConfig): Promise<void> {
    // Convert ProxyConfig to URL format expected by API
    const proxyUrl = `${proxy.type}://${proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`;

    await this.request<void>('PUT', '/api/v2/profiles/proxy/batch', {
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
    await this.request<void>('DELETE', `/api/v2/profiles/${profileId}/proxy`);
  }

  /**
   * Reset proxy for multiple profiles in batch
   */
  async batchResetProfileProxy(profileIds: string[]): Promise<void> {
    await this.request<void>('POST', '/api/v2/profiles/proxy/batch-reset', { profileIds });
  }

  // ==================== Tag Management ====================

  /**
   * Get all available tags
   */
  async getProfileTags(): Promise<Tag[]> {
    return this.request<Tag[]>('GET', '/api/v2/profiles/tags');
  }

  /**
   * Create tags for a profile
   */
  async createProfileTags(profileId: string, tags: TagConfig[]): Promise<void> {
    // API expects array directly, not wrapped in object
    await this.request<void>('POST', `/api/v2/profiles/${profileId}/tags`, tags);
  }

  /**
   * Create tags for multiple profiles in batch
   */
  async batchCreateProfileTags(profileIds: string[], tags: TagConfig[]): Promise<void> {
    await this.request<void>('POST', '/api/v2/profiles/tags/batch', {
      profileIds,
      tags,
    });
  }

  /**
   * Update tags for a profile
   */
  async updateProfileTags(profileId: string, tags: TagConfig[]): Promise<void> {
    await this.request<void>('PUT', `/api/v2/profiles/${profileId}/tags`, { tags });
  }

  /**
   * Update tags for multiple profiles in batch
   */
  async batchUpdateProfileTags(profileIds: string[], tags: TagConfig[]): Promise<void> {
    await this.request<void>('PUT', '/api/v2/profiles/tags/batch', {
      profileIds,
      tags,
    });
  }

  /**
   * Clear tags for a profile
   */
  async clearProfileTags(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/v2/profiles/${profileId}/tags`);
  }

  /**
   * Clear tags for multiple profiles in batch
   */
  async batchClearProfileTags(profileIds: string[]): Promise<void> {
    await this.request<void>('POST', '/api/v2/profiles/tags/batch-clear', { profileIds });
  }

  // ==================== Group Management ====================

  /**
   * Get all profile groups
   */
  async getAllProfileGroups(): Promise<ProfileGroup[]> {
    return this.request<ProfileGroup[]>('GET', '/api/v2/profiles/groups');
  }

  /**
   * Change profile group
   */
  async changeProfileGroup(profileId: string, groupId: string): Promise<void> {
    await this.request<void>('PUT', `/api/v2/profiles/${profileId}/group`, { groupId });
  }

  /**
   * Change group for multiple profiles in batch
   */
  async batchChangeProfileGroup(profileIds: string[], groupId: string): Promise<void> {
    await this.request<void>('PUT', '/api/v2/profiles/group/batch', {
      profileIds,
      groupId,
    });
  }

  // ==================== Local Data Management ====================

  /**
   * Clear profile cache
   */
  async clearProfileCache(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/v2/profiles/${profileId}/cache`);
  }

  /**
   * Clear profile cookies
   */
  async clearProfileCookies(profileId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/v2/profiles/${profileId}/cookies`);
  }

  // ==================== CDP Endpoints ====================

  /**
   * Get CDP WebSocket URL for a profile browser
   * Uses the correct CDP endpoint: GET /api/v2/connect/{profileId}
   */
  async getCdpUrl(profileId: string): Promise<{ webSocketDebuggerUrl: string }> {
    const response = await this.request<{
      webSocketDebuggerUrl: string;
    }>('GET', `/api/v2/connect/${profileId}`);

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
    }>('GET', '/api/v2/connect');

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
    }>('POST', `/api/v2/browsers/${profileId}`);

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
    }>('POST', '/api/v2/browsers/once', config);

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
