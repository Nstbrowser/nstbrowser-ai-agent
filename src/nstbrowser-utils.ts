/**
 * Nstbrowser integration utility functions
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

/**
 * Check if Nstbrowser client is installed
 */
export async function isNstbrowserInstalled(): Promise<boolean> {
  const platform = process.platform;
  let installPath: string;

  if (platform === 'darwin') {
    installPath = '/Applications/Nstbrowser.app';
  } else if (platform === 'win32') {
    installPath = path.join(process.env.LOCALAPPDATA || '', 'Nstbrowser');
  } else {
    installPath = path.join(os.homedir(), '.nstbrowser');
  }

  return fs.existsSync(installPath);
}

/**
 * Check if Nstbrowser client is running
 */
export async function isNstbrowserRunning(host: string, port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/api/v2/browsers`, {
      signal: AbortSignal.timeout(2000),
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Attempt to start Nstbrowser client
 */
export async function startNstbrowserClient(): Promise<boolean> {
  const platform = process.platform;
  let command: string;
  let args: string[] = [];

  if (platform === 'darwin') {
    command = 'open';
    args = ['-a', 'Nstbrowser'];
  } else if (platform === 'win32') {
    const installPath = path.join(process.env.LOCALAPPDATA || '', 'Nstbrowser', 'Nstbrowser.exe');
    command = installPath;
  } else {
    command = 'nstbrowser';
  }

  try {
    spawn(command, args, { detached: true, stdio: 'ignore' }).unref();

    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await isNstbrowserRunning('127.0.0.1', 8848)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get Nstbrowser installation instructions
 */
export function getNstbrowserInstallInstructions(): string {
  const platform = process.platform;

  if (platform === 'darwin') {
    return 'Please download and install Nstbrowser from https://www.nstbrowser.io/download';
  } else if (platform === 'win32') {
    return 'Please download and install Nstbrowser from https://www.nstbrowser.io/download';
  } else {
    return 'Please download and install Nstbrowser from https://www.nstbrowser.io/download';
  }
}
