/**
 * Nstbrowser integration type definitions
 */

// Browser instance related types
export interface BrowserInstance {
  profileId: string;
  name: string;
  platform: number | string; // API returns number (0=Windows, 1=macOS, 2=Linux)
  kernel: string;
  remoteDebuggingPort: number;
  running: boolean;
}

export interface StartBrowserOptions {
  headless?: boolean;
  autoClose?: boolean;
  timedCloseSec?: number;
  clearCacheOnClose?: boolean;
  incognito?: boolean;
  restoreLastSession?: boolean;
  disableImageLoading?: boolean;
  doNotTrack?: boolean;
  args?: string[];
  skipProxyChecking?: boolean;
}

export interface StartBrowserResponse {
  profileId: string;
  webSocketDebuggerUrl: string;
  remoteDebuggingPort: number;
}

// Profile related types
export interface Profile {
  profileId: string;
  name: string;
  platform: number | string; // API returns number (0=Windows, 1=macOS, 2=Linux), but can be string in queries
  kernel: string;
  proxyType?: string;
  proxyHost?: string;
  proxyPort?: number;
  groupId?: string;
  groupName?: string;
  tags?: Tag[];
  lastLaunchTime?: string;
  fingerprint?: FingerprintConfig;
  proxyConfig?: {
    protocol?: string;
    host?: string;
    port?: string;
    username?: string;
    password?: string;
    proxyType?: string;
    url?: string;
  };
  proxyResult?: {
    ip?: string;
    country?: string;
    city?: string;
    state?: string;
    timezone?: string;
    protocol?: string;
    checkedAt?: string;
  };
}

export interface ProfileQuery {
  name?: string;
  groupId?: string;
  platform?: 'Windows' | 'macOS' | 'Linux';
  tags?: string | string[]; // Can be a single tag or array of tags
}

export interface ProfileConfig {
  name: string;
  platform?: 'Windows' | 'macOS' | 'Linux';
  kernel?: string;
  fingerprint?: FingerprintConfig;
  proxy?: ProxyConfig;
  groupId?: string;
}

// Fingerprint configuration
export interface FingerprintConfig {
  canvas?: 'Noise' | 'Block' | 'Allow';
  webgl?: 'Noise' | 'Block' | 'Allow';
  audio?: 'Noise' | 'Masked' | 'Allow';
  fonts?: 'Masked' | 'Allow';
  geolocation?: GeolocationConfig;
  timezone?: string;
  screen?: ScreenConfig;
  webrtc?: 'Custom' | 'Disabled' | 'Real';
  userAgent?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  language?: string;
  languages?: string[];
}

export interface GeolocationConfig {
  mode: 'Custom' | 'Prompt' | 'Block';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface ScreenConfig {
  width: number;
  height: number;
}

// Proxy configuration
export interface ProxyConfig {
  type: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

// Tag related types
export interface Tag {
  name: string;
  color?: string;
}

export interface TagConfig {
  name: string;
  color?: string;
}

// Profile group related types
export interface ProfileGroup {
  groupId: string;
  name: string;
  isDefault: boolean;
  extensionIds?: string[];
  settings?: Record<string, unknown>;
}

// CDP connection related types
export interface ConnectResponse {
  profileId: string;
  webSocketDebuggerUrl: string;
  remoteDebuggingPort: number;
}

export interface OnceBrowserConfig {
  platform?: 'Windows' | 'macOS' | 'Linux';
  kernel?: string;
  fingerprint?: FingerprintConfig;
  proxy?: ProxyConfig;
  startupUrls?: string[];
  headless?: boolean;
  autoClose?: boolean;
  clearCacheOnClose?: boolean;
}

// API response types
export interface NstApiResponse<T = unknown> {
  err: boolean; // false means success
  msg: string;
  data?: T;
  code?: number;
}

// Batch operation types
export interface BatchOperationResult<T = unknown> {
  success: boolean;
  results: T[];
  errors: Array<{ index: number; error: string }>;
}
