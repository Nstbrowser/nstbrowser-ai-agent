/**
 * Configuration loader for nstbrowser-ai-agent
 * Reads configuration from file with fallback to environment variables
 * Priority: Config file > Environment variables > Defaults
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = '.nst-ai-agent';
const CONFIG_FILE = 'config.json';

interface ConfigFile {
  nstApiKey?: string | null;
  nstHost?: string | null;
  nstPort?: number | null;
  // ... other config fields
}

export interface NstConfig {
  apiKey: string;
  host: string;
  port: number;
}

/**
 * Load NST configuration with priority: Config file > Environment > Defaults
 */
export function loadNstConfig(): NstConfig | null {
  const configPath = path.join(os.homedir(), CONFIG_DIR, CONFIG_FILE);

  let fileConfig: ConfigFile = {};

  // Try to read config file
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(content);
    } catch (error) {
      console.error(`[WARN] Failed to read config file: ${error}`);
    }
  }

  // Priority: Config file > Environment variable > Default
  const apiKey = fileConfig.nstApiKey || process.env.NST_API_KEY || '';
  const host = fileConfig.nstHost || process.env.NST_HOST || 'localhost';
  const port =
    fileConfig.nstPort || (process.env.NST_PORT ? parseInt(process.env.NST_PORT, 10) : 8848);

  if (!apiKey) {
    return null;
  }

  return { apiKey, host, port };
}
