/**
 * Auto-update checker for nstbrowser-ai-agent
 *
 * Checks for new versions and notifies users about available updates.
 * Respects user preferences and caching to avoid excessive network requests.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { homedir } from 'os';

const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const GITHUB_REPO = 'Nstbrowser/nstbrowser-ai-agent';
const NPM_PACKAGE = 'nstbrowser-ai-agent';

interface UpdateCheckCache {
  lastCheck: number;
  latestVersion: string;
  currentVersion: string;
  dismissed?: boolean;
}

/**
 * Get the cache directory for update checks
 */
function getCacheDir(): string {
  const cacheDir = path.join(homedir(), '.nst-ai-agent', 'cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

/**
 * Get the cache file path
 */
function getCacheFile(): string {
  return path.join(getCacheDir(), 'update-check.json');
}

/**
 * Read update check cache
 */
function readCache(): UpdateCheckCache | null {
  try {
    const cacheFile = getCacheFile();
    if (!fs.existsSync(cacheFile)) {
      return null;
    }
    const content = fs.readFileSync(cacheFile, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write update check cache
 */
function writeCache(cache: UpdateCheckCache): void {
  try {
    const cacheFile = getCacheFile();
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Get current package version
 */
function getCurrentVersion(): string {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return pkg.version;
    }
  } catch {
    // Ignore errors
  }
  return '0.0.0';
}

/**
 * Fetch latest version from npm registry
 */
async function fetchLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'registry.npmjs.org',
      path: `/${NPM_PACKAGE}/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'nstbrowser-ai-agent-update-checker',
      },
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const pkg = JSON.parse(data);
            resolve(pkg.version);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

/**
 * Compare version strings (semver-like)
 */
function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }

  return false;
}

/**
 * Check for updates and notify user if available
 *
 * This function:
 * - Checks cache to avoid excessive network requests
 * - Fetches latest version from npm registry
 * - Notifies user if update is available
 * - Respects user's dismiss preference
 */
export async function checkForUpdates(silent = false): Promise<void> {
  // Check if update checks are disabled
  if (process.env.NSTBROWSER_AI_AGENT_NO_UPDATE_CHECK === '1') {
    return;
  }

  const currentVersion = getCurrentVersion();
  const cache = readCache();
  const now = Date.now();

  // Check if we should skip (recently checked or dismissed)
  if (cache) {
    if (cache.dismissed && cache.latestVersion) {
      // User dismissed this version, don't show again
      return;
    }

    if (now - cache.lastCheck < UPDATE_CHECK_INTERVAL) {
      // Checked recently, skip
      return;
    }
  }

  // Fetch latest version
  const latestVersion = await fetchLatestVersion();

  if (!latestVersion) {
    // Network error or timeout, update cache timestamp only
    if (cache) {
      writeCache({ ...cache, lastCheck: now });
    }
    return;
  }

  // Update cache
  const newCache: UpdateCheckCache = {
    lastCheck: now,
    latestVersion,
    currentVersion,
    dismissed: false,
  };
  writeCache(newCache);

  // Check if update is available
  if (isNewerVersion(latestVersion, currentVersion)) {
    if (!silent) {
      console.error('');
      console.error(`╭${'─'.repeat(76)}╮`);
      console.error(
        `│ Update available: ${currentVersion} → ${latestVersion}${' '.repeat(76 - 24 - currentVersion.length - latestVersion.length)}│`
      );
      console.error(`│${' '.repeat(76)}│`);
      console.error(`│ Run: npm install -g nstbrowser-ai-agent@latest${' '.repeat(76 - 49)}│`);
      console.error(`│ Or:  npx nstbrowser-ai-agent@latest${' '.repeat(76 - 39)}│`);
      console.error(`│${' '.repeat(76)}│`);
      console.error(
        `│ Changelog: https://github.com/${GITHUB_REPO}/releases${' '.repeat(76 - 54 - GITHUB_REPO.length)}│`
      );
      console.error(`│${' '.repeat(76)}│`);
      console.error(
        `│ To disable update checks: NSTBROWSER_AI_AGENT_NO_UPDATE_CHECK=1${' '.repeat(76 - 66)}│`
      );
      console.error(`╰${'─'.repeat(76)}╯`);
      console.error('');
    }
  }
}

/**
 * Dismiss current update notification
 */
export function dismissUpdate(): void {
  const cache = readCache();
  if (cache) {
    cache.dismissed = true;
    writeCache(cache);
  }
}

/**
 * Force check for updates (ignores cache)
 */
export async function forceCheckForUpdates(): Promise<{
  current: string;
  latest: string;
  updateAvailable: boolean;
}> {
  const currentVersion = getCurrentVersion();
  const latestVersion = await fetchLatestVersion();

  if (!latestVersion) {
    throw new Error('Failed to fetch latest version from npm registry');
  }

  const updateAvailable = isNewerVersion(latestVersion, currentVersion);

  // Update cache
  writeCache({
    lastCheck: Date.now(),
    latestVersion,
    currentVersion,
    dismissed: false,
  });

  return {
    current: currentVersion,
    latest: latestVersion,
    updateAvailable,
  };
}
