/**
 * Application-wide constants
 * Centralized location for all magic values to improve maintainability
 */

// ==================== Network Configuration ====================

/**
 * Default host for Nstbrowser API service
 */
export const DEFAULT_NST_HOST = 'localhost';

/**
 * Default port for Nstbrowser API service
 */
export const DEFAULT_NST_PORT = 8848;

/**
 * Loopback IPv4 address
 */
export const LOCALHOST_IP = '127.0.0.1';

/**
 * Loopback IPv6 address
 */
export const LOCALHOST_IPV6 = '::1';

// ==================== HTTP Headers ====================

/**
 * HTTP header for API authentication
 */
export const HEADER_API_KEY = 'x-api-key';

/**
 * HTTP header for content type
 */
export const HEADER_CONTENT_TYPE = 'Content-Type';

/**
 * JSON content type value
 */
export const CONTENT_TYPE_JSON = 'application/json';

// ==================== API Endpoints ====================

/**
 * Base path for Nstbrowser API v2
 */
export const API_V2_BASE = '/api/v2';

/**
 * Agent info endpoint
 */
export const API_AGENT_INFO = '/api/agent/agent/info';

/**
 * Browser management endpoints
 */
export const API_BROWSERS = `${API_V2_BASE}/browsers`;
export const API_BROWSERS_ONCE = `${API_V2_BASE}/browsers/once`;
export const API_BROWSERS_BATCH = `${API_V2_BASE}/browsers/batch`;

/**
 * Profile management endpoints
 */
export const API_PROFILES = `${API_V2_BASE}/profiles/`;
export const API_LOCAL_PROFILES = `${API_V2_BASE}/local/profiles/`;
export const API_PROFILES_CURSOR = `${API_V2_BASE}/profiles/cursor`;
export const API_PROFILES_TAGS = `${API_V2_BASE}/profiles/tags`;
export const API_PROFILES_GROUPS = `${API_V2_BASE}/profiles/groups`;
export const API_PROFILES_PROXY_BATCH = `${API_V2_BASE}/profiles/proxy/batch`;
export const API_PROFILES_PROXY_BATCH_RESET = `${API_V2_BASE}/profiles/proxy/batch-reset`;
export const API_PROFILES_TAGS_BATCH = `${API_V2_BASE}/profiles/tags/batch`;
export const API_PROFILES_TAGS_BATCH_CLEAR = `${API_V2_BASE}/profiles/tags/batch-clear`;
export const API_PROFILES_GROUP_BATCH = `${API_V2_BASE}/profiles/group/batch`;

/**
 * CDP (Chrome DevTools Protocol) endpoints
 */
export const API_CDP_CONNECT = `${API_V2_BASE}/connect`;

// ==================== Timeouts ====================

/**
 * Default HTTP request timeout in milliseconds
 */
export const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Agent info check timeout in milliseconds
 */
export const AGENT_INFO_TIMEOUT = 3000; // 3 seconds

/**
 * Wait command timeout for first attempt
 */
export const WAIT_TIMEOUT_FIRST_ATTEMPT = 15000; // 15 seconds

/**
 * Wait command timeout for retry attempt
 */
export const WAIT_TIMEOUT_RETRY = 30000; // 30 seconds

/**
 * Profile cache TTL in milliseconds
 */
export const PROFILE_CACHE_TTL = 30000; // 30 seconds

/**
 * Browser start verification delay in milliseconds
 */
export const BROWSER_START_VERIFICATION_DELAY = 2000; // 2 seconds

/**
 * Maximum retry attempts for browser start
 */
export const MAX_BROWSER_START_RETRIES = 3;

/**
 * Delay between browser start retry attempts in milliseconds
 */
export const BROWSER_START_RETRY_DELAY = 2000; // 2 seconds

// ==================== Retry Configuration ====================

/**
 * Default number of retry attempts
 */
export const DEFAULT_RETRY_COUNT = 3;

/**
 * Maximum retry attempts for wait command
 */
export const WAIT_MAX_ATTEMPTS = 2;

// ==================== Appium Configuration ====================

/**
 * Default Appium server host
 */
export const APPIUM_HOST = '127.0.0.1';

/**
 * iOS automation timeout
 */
export const IOS_AUTOMATION_TIMEOUT = 30000; // 30 seconds

/**
 * iOS polling interval
 */
export const IOS_POLLING_INTERVAL = 500; // 500 milliseconds

// ==================== Error Codes ====================

/**
 * Nstbrowser specific error codes
 */
export const ERROR_CODES = {
  NST_NOT_INSTALLED: 'NST_NOT_INSTALLED',
  NST_NOT_RUNNING: 'NST_NOT_RUNNING',
  NST_AUTH_ERROR: 'NST_AUTH_ERROR',
  NST_PROFILE_NOT_FOUND: 'NST_PROFILE_NOT_FOUND',
  NST_CONNECTION_ERROR: 'NST_CONNECTION_ERROR',
  NO_PROFILE_SPECIFIED: 'NO_PROFILE_SPECIFIED',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  RESOLUTION_ERROR: 'RESOLUTION_ERROR',
  BROWSER_START_VERIFICATION_FAILED: 'BROWSER_START_VERIFICATION_FAILED',
  BROWSER_START_FAILED: 'BROWSER_START_FAILED',
} as const;

// ==================== URL Helpers ====================

/**
 * Build HTTP URL for Nstbrowser API
 */
export function buildApiUrl(host: string, port: number, path: string): string {
  return `http://${host}:${port}${path}`;
}

/**
 * Build WebSocket URL for CDP connection
 */
export function buildWsUrl(host: string, port: number, path: string, apiKey: string): string {
  return `ws://${host}:${port}${path}?x-api-key=${apiKey}`;
}

/**
 * Build WebSocket URL for CDP profile connection
 */
export function buildWsProfileUrl(
  host: string,
  port: number,
  profileId: string,
  apiKey: string
): string {
  return buildWsUrl(host, port, `${API_CDP_CONNECT}/${profileId}`, apiKey);
}

/**
 * Build WebSocket URL for CDP once browser connection
 */
export function buildWsOnceUrl(host: string, port: number, config: string, apiKey: string): string {
  return `ws://${host}:${port}${API_CDP_CONNECT}?config=${config}&x-api-key=${apiKey}`;
}
