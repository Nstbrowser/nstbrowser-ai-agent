/**
 * Enhanced output formatting for better AI Agent understanding
 */

import type { Profile, BrowserInstance } from './nstbrowser-types.js';

export interface EnhancedMetadata {
  apiVersion: string;
  timestamp: string;
  executionTime?: string;
  [key: string]: unknown;
}

export interface EnhancedResponse<T> {
  success: boolean;
  metadata: EnhancedMetadata;
  data: T;
  schema?: {
    version: string;
    url?: string;
  };
}

/**
 * Format time duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format timestamp to human-readable relative time
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return 'in the future';
  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} minutes ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} hours ago`;
  if (diffMs < 2592000000) return `${Math.floor(diffMs / 86400000)} days ago`;
  if (diffMs < 31536000000) return `${Math.floor(diffMs / 2592000000)} months ago`;
  return `${Math.floor(diffMs / 31536000000)} years ago`;
}

/**
 * Enhance profile data with human-readable information
 */
export function enhanceProfile(profile: Profile): any {
  const platformNames: Record<number, string> = {
    0: 'Windows',
    1: 'macOS',
    2: 'Linux',
  };

  const platformCode = typeof profile.platform === 'number' ? profile.platform : 0;

  return {
    id: profile.profileId,
    name: profile.name,
    platform: {
      code: platformCode,
      name: platformNames[platformCode] || 'Unknown',
    },
    kernel: {
      version: profile.kernel,
      // Note: Would need API to check latest version
    },
    proxy: profile.proxyConfig
      ? {
          type: profile.proxyConfig.proxyType || profile.proxyConfig.protocol,
          host: profile.proxyConfig.host,
          port: profile.proxyConfig.port,
          status: profile.proxyResult ? 'active' : 'unknown',
          location: profile.proxyResult
            ? {
                country: profile.proxyResult.country,
                city: profile.proxyResult.city,
                state: profile.proxyResult.state,
                ip: profile.proxyResult.ip,
              }
            : undefined,
        }
      : undefined,
    group: profile.groupId
      ? {
          id: profile.groupId,
          name: profile.groupName,
        }
      : undefined,
    tags: profile.tags || [],
    usage: profile.lastLaunchTime
      ? {
          lastUsed: profile.lastLaunchTime,
          lastUsedHumanReadable: formatRelativeTime(profile.lastLaunchTime),
        }
      : undefined,
    // Health score would be calculated based on various factors
    health: {
      status: 'unknown', // Would need to implement health check logic
      score: 0,
    },
  };
}

/**
 * Enhance browser instance data
 */
export function enhanceBrowserInstance(browser: BrowserInstance): any {
  const platformNames: Record<number | string, string> = {
    0: 'Windows',
    1: 'macOS',
    2: 'Linux',
    Windows: 'Windows',
    macOS: 'macOS',
    Linux: 'Linux',
  };

  const platformCode =
    typeof browser.platform === 'number' ? browser.platform : browser.platform;

  return {
    profileId: browser.profileId,
    name: browser.name,
    platform: {
      code: platformCode,
      name: platformNames[platformCode] || String(platformCode),
    },
    kernel: browser.kernel,
    port: browser.remoteDebuggingPort,
    status: browser.running ? 'running' : 'stopped',
    webSocketUrl: `ws://localhost:${browser.remoteDebuggingPort}/devtools/browser`,
  };
}

/**
 * Create enhanced response wrapper
 */
export function createEnhancedResponse<T>(
  data: T,
  options: {
    executionTime?: number;
    schemaUrl?: string;
  } = {}
): EnhancedResponse<T> {
  return {
    success: true,
    metadata: {
      apiVersion: 'v2',
      timestamp: new Date().toISOString(),
      executionTime: options.executionTime ? formatDuration(options.executionTime) : undefined,
    },
    data,
    schema: options.schemaUrl
      ? {
          version: '1.0',
          url: options.schemaUrl,
        }
      : undefined,
  };
}

/**
 * Create profile list summary
 */
export function createProfileSummary(profiles: Profile[]): any {
  const byPlatform: Record<string, number> = {};
  const byStatus: Record<string, number> = {
    healthy: 0,
    warning: 0,
    critical: 0,
  };

  profiles.forEach((profile) => {
    // Count by platform
    const platformCode = typeof profile.platform === 'number' ? profile.platform : 0;
    const platformName = ['Windows', 'macOS', 'Linux'][platformCode] || 'Unknown';
    byPlatform[platformName] = (byPlatform[platformName] || 0) + 1;

    // Count by status (simplified - would need actual health check)
    byStatus.healthy++;
  });

  return {
    total: profiles.length,
    byPlatform,
    byStatus,
  };
}

/**
 * Format error for enhanced output
 */
export function formatEnhancedError(error: Error, suggestions?: string[]): any {
  return {
    success: false,
    error: {
      message: error.message,
      code: (error as any).code || 'UNKNOWN_ERROR',
      suggestions: suggestions || [],
      timestamp: new Date().toISOString(),
    },
  };
}
