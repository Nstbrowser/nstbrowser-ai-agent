import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BrowserManager } from './browser.js';
import { IOSManager } from './ios-manager.js';
import { parseCommand, serializeResponse, errorResponse } from './protocol.js';
import { executeCommand, initActionPolicy } from './actions.js';
import { executeIOSCommand } from './ios-actions.js';
import { executeNstbrowserCommand } from './nstbrowser-actions.js';
import { StreamServer } from './stream-server.js';
import type { Command } from './types.js';
import {
  getSessionsDir,
  ensureSessionsDir,
  getEncryptionKey,
  encryptData,
  isValidSessionName,
  cleanupExpiredStates,
  getAutoStateFilePath,
} from './state-utils.js';

type Manager = BrowserManager | IOSManager;

/**
 * Backpressure-aware socket write.
 * If the kernel buffer is full (socket.write returns false),
 * waits for the 'drain' event before resolving.
 */
export function safeWrite(socket: net.Socket, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.destroyed) {
      resolve();
      return;
    }
    const canContinue = socket.write(payload);
    if (canContinue) {
      resolve();
    } else if (socket.destroyed) {
      resolve();
    } else {
      const cleanup = () => {
        socket.removeListener('drain', onDrain);
        socket.removeListener('error', onError);
        socket.removeListener('close', onClose);
      };
      const onDrain = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onClose = () => {
        cleanup();
        resolve();
      };
      socket.once('drain', onDrain);
      socket.once('error', onError);
      socket.once('close', onClose);
    }
  });
}

const isWindows = process.platform === 'win32';

let currentSession = process.env.NSTBROWSER_AI_AGENT_SESSION || 'default';

let streamServer: StreamServer | null = null;

const DEFAULT_STREAM_PORT = 9223;

/**
 * Save state to file with optional encryption.
 */
async function saveStateToFile(
  browser: BrowserManager,
  filepath: string
): Promise<{ encrypted: boolean }> {
  const context = browser.getContext();
  if (!context) {
    throw new Error('No browser context available');
  }

  const state = await context.storageState();
  const jsonData = JSON.stringify(state, null, 2);

  const key = getEncryptionKey();
  if (key) {
    const encrypted = encryptData(jsonData, key);
    fs.writeFileSync(filepath, JSON.stringify(encrypted, null, 2));
    return { encrypted: true };
  }

  fs.writeFileSync(filepath, jsonData);
  return { encrypted: false };
}

const AUTO_EXPIRE_ENV = 'NSTBROWSER_AI_AGENT_STATE_EXPIRE_DAYS';
const DEFAULT_EXPIRE_DAYS = 30;

function runCleanupExpiredStates(): void {
  const expireDaysStr = process.env[AUTO_EXPIRE_ENV];
  const expireDays = expireDaysStr ? parseInt(expireDaysStr, 10) : DEFAULT_EXPIRE_DAYS;

  if (isNaN(expireDays) || expireDays <= 0) {
    return;
  }

  try {
    const deleted = cleanupExpiredStates(expireDays);
    if (deleted.length > 0 && process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
      console.error(
        `[DEBUG] Auto-expired ${deleted.length} state file(s) older than ${expireDays} days`
      );
    }
  } catch (err) {
    if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
      console.error(`[DEBUG] Failed to clean up expired states:`, err);
    }
  }
}

/**
 * Get the validated session name and auto-state file path.
 * Centralizes session name validation to prevent path traversal.
 */
function getSessionAutoStatePath(): string | undefined {
  const sessionNameRaw = process.env.NSTBROWSER_AI_AGENT_SESSION_NAME;
  if (!sessionNameRaw) return undefined;

  if (!isValidSessionName(sessionNameRaw)) {
    if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
      console.error(`[SECURITY] Invalid session name rejected: ${sessionNameRaw}`);
    }
    return undefined;
  }

  const sessionId = process.env.NSTBROWSER_AI_AGENT_SESSION || 'default';
  try {
    const autoStatePath = getAutoStateFilePath(sessionNameRaw, sessionId);
    return autoStatePath && fs.existsSync(autoStatePath) ? autoStatePath : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get the auto-state file path for saving (creates sessions dir if needed).
 * Returns undefined if no valid session name is configured.
 */
function getSessionSaveStatePath(): string | undefined {
  const sessionNameRaw = process.env.NSTBROWSER_AI_AGENT_SESSION_NAME;
  if (!sessionNameRaw) return undefined;

  if (!isValidSessionName(sessionNameRaw)) return undefined;

  const sessionId = process.env.NSTBROWSER_AI_AGENT_SESSION || 'default';
  try {
    return getAutoStateFilePath(sessionNameRaw, sessionId) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Set the current session
 */
export function setSession(session: string): void {
  currentSession = session;
}

/**
 * Get the current session
 */
export function getSession(): string {
  return currentSession;
}

/**
 * Get port number for TCP mode (Windows)
 * Uses a hash of the session name to get a consistent port
 */
function getPortForSession(session: string): number {
  let hash = 0;
  for (let i = 0; i < session.length; i++) {
    hash = (hash << 5) - hash + session.charCodeAt(i);
    hash |= 0;
  }
  return 49152 + (Math.abs(hash) % 16383);
}

/**
 * Get the base directory for socket/pid files.
 * Priority: NSTBROWSER_AI_AGENT_SOCKET_DIR > XDG_RUNTIME_DIR > ~/.nstbrowser-ai-agent > tmpdir
 */
export function getAppDir(): string {
  if (process.env.XDG_RUNTIME_DIR) {
    return path.join(process.env.XDG_RUNTIME_DIR, 'nstbrowser-ai-agent');
  }

  const homeDir = os.homedir();
  if (homeDir) {
    return path.join(homeDir, '.nstbrowser-ai-agent');
  }

  return path.join(os.tmpdir(), 'nstbrowser-ai-agent');
}

export function getSocketDir(): string {
  if (process.env.NSTBROWSER_AI_AGENT_SOCKET_DIR) {
    return process.env.NSTBROWSER_AI_AGENT_SOCKET_DIR;
  }
  return getAppDir();
}

/**
 * Get the socket path for the current session (Unix) or port (Windows)
 */
export function getSocketPath(session?: string): string {
  const sess = session ?? currentSession;
  if (isWindows) {
    return String(getPortForSession(sess));
  }
  return path.join(getSocketDir(), `${sess}.sock`);
}

/**
 * Get the port file path for Windows (stores the port number)
 */
export function getPortFile(session?: string): string {
  const sess = session ?? currentSession;
  return path.join(getSocketDir(), `${sess}.port`);
}

/**
 * Get the PID file path for the current session
 */
export function getPidFile(session?: string): string {
  const sess = session ?? currentSession;
  return path.join(getSocketDir(), `${sess}.pid`);
}

/**
 * Check if daemon is running for the current session
 */
export function isDaemonRunning(session?: string): boolean {
  const pidFile = getPidFile(session);
  if (!fs.existsSync(pidFile)) return false;

  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EPERM') {
      return true;
    }
    cleanupSocket(session);
    return false;
  }
}

/**
 * Get connection info for the current session
 * Returns { type: 'unix', path: string } or { type: 'tcp', port: number }
 */
export function getConnectionInfo(
  session?: string
): { type: 'unix'; path: string } | { type: 'tcp'; port: number } {
  const sess = session ?? currentSession;
  if (isWindows) {
    return { type: 'tcp', port: getPortForSession(sess) };
  }
  return { type: 'unix', path: path.join(getSocketDir(), `${sess}.sock`) };
}

/**
 * Clean up socket and PID file for the current session
 */
export function cleanupSocket(session?: string): void {
  const pidFile = getPidFile(session);
  const streamPortFile = getStreamPortFile(session);
  try {
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    if (fs.existsSync(streamPortFile)) fs.unlinkSync(streamPortFile);
    if (isWindows) {
      const portFile = getPortFile(session);
      if (fs.existsSync(portFile)) fs.unlinkSync(portFile);
    } else {
      const socketPath = getSocketPath(session);
      if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
    }
  } catch {}
}

/**
 * Get the stream port file path
 */
export function getStreamPortFile(session?: string): string {
  const sess = session ?? currentSession;
  return path.join(getSocketDir(), `${sess}.stream`);
}

/**
 * Start the daemon server
 * @param options.streamPort Port for WebSocket stream server (0 to disable)
 * @param options.provider Provider type ('ios' for iOS Simulator, undefined for desktop)
 */
export async function startDaemon(options?: {
  streamPort?: number;
  provider?: string;
}): Promise<void> {
  const socketDir = getSocketDir();
  if (!fs.existsSync(socketDir)) {
    fs.mkdirSync(socketDir, { recursive: true, mode: 0o700 });
  }

  cleanupSocket();

  runCleanupExpiredStates();

  initActionPolicy();

  const provider = options?.provider ?? process.env.NSTBROWSER_AI_AGENT_PROVIDER;
  const isIOS = provider === 'ios';

  const manager: Manager = isIOS ? new IOSManager() : new BrowserManager();
  let shuttingDown = false;

  const streamPort =
    options?.streamPort ??
    (process.env.NSTBROWSER_AI_AGENT_STREAM_PORT
      ? parseInt(process.env.NSTBROWSER_AI_AGENT_STREAM_PORT, 10)
      : 0);

  if (streamPort > 0 && !isIOS && manager instanceof BrowserManager) {
    streamServer = new StreamServer(manager, streamPort);
    await streamServer.start();

    const streamPortFile = getStreamPortFile();
    fs.writeFileSync(streamPortFile, streamPort.toString());
  }

  const server = net.createServer((socket) => {
    let buffer = '';
    let httpChecked = false;

    const commandQueue: string[] = [];
    let processing = false;

    async function processQueue(): Promise<void> {
      if (processing) return;
      processing = true;

      while (commandQueue.length > 0) {
        const line = commandQueue.shift()!;

        try {
          const parseResult = parseCommand(line);

          if (!parseResult.success) {
            const resp = errorResponse(parseResult.id ?? 'unknown', parseResult.error);
            await safeWrite(socket, serializeResponse(resp) + '\n');
            continue;
          }

          if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
            console.error(
              '[DAEMON] Received command:',
              JSON.stringify(parseResult.command, null, 2)
            );
          }

          if (parseResult.command.action === 'device_list') {
            const iosManager = new IOSManager();
            try {
              const devices = await iosManager.listAllDevices();
              const response = {
                id: parseResult.command.id,
                success: true as const,
                data: { devices },
              };
              await safeWrite(socket, serializeResponse(response) + '\n');
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              await safeWrite(
                socket,
                serializeResponse(errorResponse(parseResult.command.id, message)) + '\n'
              );
            }
            continue;
          }

          if (parseResult.command.action.startsWith('nst_')) {
            try {
              const response = await executeNstbrowserCommand(parseResult.command);
              await safeWrite(socket, serializeResponse(response) + '\n');
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              await safeWrite(
                socket,
                serializeResponse(errorResponse(parseResult.command.id, message)) + '\n'
              );
            }
            continue;
          }

          if (
            !manager.isLaunched() &&
            parseResult.command.action !== 'launch' &&
            parseResult.command.action !== 'close' &&
            parseResult.command.action !== 'state_load'
          ) {
            if (isIOS && manager instanceof IOSManager) {
              const cmd = parseResult.command as { iosDevice?: string };
              const iosDevice = cmd.iosDevice || process.env.NSTBROWSER_AI_AGENT_IOS_DEVICE;
              await manager.launch({
                device: iosDevice,
                udid: process.env.NSTBROWSER_AI_AGENT_IOS_UDID,
              });
            } else if (manager instanceof BrowserManager) {
              const extensions = process.env.NSTBROWSER_AI_AGENT_EXTENSIONS
                ? process.env.NSTBROWSER_AI_AGENT_EXTENSIONS.split(',')
                    .map((p) => p.trim())
                    .filter(Boolean)
                : undefined;

              const argsEnv = process.env.NSTBROWSER_AI_AGENT_ARGS;
              const args = argsEnv
                ? argsEnv
                    .split(/[,\n]/)
                    .map((a) => a.trim())
                    .filter((a) => a.length > 0)
                : undefined;

              const proxyServer = process.env.NSTBROWSER_AI_AGENT_PROXY;
              const proxyBypass = process.env.NSTBROWSER_AI_AGENT_PROXY_BYPASS;
              const proxy = proxyServer
                ? {
                    server: proxyServer,
                    ...(proxyBypass && { bypass: proxyBypass }),
                  }
                : undefined;

              const ignoreHTTPSErrors = process.env.NSTBROWSER_AI_AGENT_IGNORE_HTTPS_ERRORS === '1';
              const allowFileAccess = process.env.NSTBROWSER_AI_AGENT_ALLOW_FILE_ACCESS === '1';
              const colorSchemeEnv = process.env.NSTBROWSER_AI_AGENT_COLOR_SCHEME;
              const colorScheme =
                colorSchemeEnv === 'dark' ||
                colorSchemeEnv === 'light' ||
                colorSchemeEnv === 'no-preference'
                  ? colorSchemeEnv
                  : undefined;

              const cmd = parseResult.command as Command & {
                nstProfileName?: string;
                nstProfileId?: string;
              };
              const nstProfileName = cmd.nstProfileName;
              const nstProfileId = cmd.nstProfileId;

              await manager.launch({
                id: 'auto',
                action: 'launch' as const,
                headless: process.env.NSTBROWSER_AI_AGENT_HEADED !== '1',
                executablePath: process.env.NSTBROWSER_AI_AGENT_EXECUTABLE_PATH,
                extensions: extensions,
                profile: process.env.NSTBROWSER_AI_AGENT_PROFILE,
                storageState: process.env.NSTBROWSER_AI_AGENT_STATE,
                args,
                userAgent: process.env.NSTBROWSER_AI_AGENT_USER_AGENT,
                proxy,
                ignoreHTTPSErrors: ignoreHTTPSErrors,
                allowFileAccess: allowFileAccess,
                colorScheme,
                autoStateFilePath: getSessionAutoStatePath(),
                nstProfileName,
                nstProfileId,
              });
            }
          }

          if (
            manager instanceof BrowserManager &&
            manager.isLaunched() &&
            !manager.hasPages() &&
            parseResult.command.action !== 'launch' &&
            parseResult.command.action !== 'close'
          ) {
            await manager.ensurePage();
          }

          if (
            parseResult.command.action === 'launch' &&
            manager instanceof BrowserManager &&
            !parseResult.command.autoStateFilePath
          ) {
            const autoStatePath = getSessionAutoStatePath();
            if (autoStatePath) {
              parseResult.command.autoStateFilePath = autoStatePath;
            }
          }

          if (parseResult.command.action === 'close') {
            if (manager instanceof BrowserManager && manager.isLaunched()) {
              const savePath = getSessionSaveStatePath();
              if (savePath) {
                try {
                  const { encrypted } = await saveStateToFile(manager, savePath);
                  fs.chmodSync(savePath, 0o600);
                  if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
                    console.error(
                      `Auto-saved session state: ${savePath}${encrypted ? ' (encrypted)' : ''}`
                    );
                  }
                } catch (err) {
                  if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
                    console.error(`Failed to auto-save session state:`, err);
                  }
                }
              }
            }

            const response =
              isIOS && manager instanceof IOSManager
                ? await executeIOSCommand(parseResult.command, manager)
                : await executeCommand(parseResult.command, manager as BrowserManager);
            await safeWrite(socket, serializeResponse(response) + '\n');

            if (!shuttingDown) {
              shuttingDown = true;
              setTimeout(() => {
                server.close();
                cleanupSocket();
                process.exit(0);
              }, 100);
            }

            commandQueue.length = 0;
            processing = false;
            return;
          }

          const response =
            isIOS && manager instanceof IOSManager
              ? await executeIOSCommand(parseResult.command, manager)
              : await executeCommand(parseResult.command, manager as BrowserManager);

          if (manager instanceof BrowserManager) {
            const warnings = manager.getAndClearWarnings();
            if (warnings.length > 0 && response.success && response.data) {
              (response.data as Record<string, unknown>).warnings = warnings;
            }
          }

          await safeWrite(socket, serializeResponse(response) + '\n');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await safeWrite(socket, serializeResponse(errorResponse('error', message)) + '\n').catch(
            () => {}
          );
        }
      }

      processing = false;
    }

    socket.on('data', (data) => {
      buffer += data.toString();

      if (!httpChecked) {
        httpChecked = true;
        const trimmed = buffer.trimStart();
        if (/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|CONNECT|TRACE)\s/i.test(trimmed)) {
          socket.destroy();
          return;
        }
      }

      while (buffer.includes('\n')) {
        const newlineIdx = buffer.indexOf('\n');
        const line = buffer.substring(0, newlineIdx);
        buffer = buffer.substring(newlineIdx + 1);

        if (!line.trim()) continue;
        commandQueue.push(line);
      }

      processQueue().catch((err) => {
        console.warn('[warn] processQueue error:', err?.message ?? String(err));
        if (process.env.NSTBROWSER_AI_AGENT_DEBUG === '1') {
          console.error(
            '[DEBUG] processQueue error stack:',
            err?.stack ?? err?.message ?? String(err)
          );
        }
      });
    });

    socket.on('error', () => {});
  });

  const pidFile = getPidFile();

  fs.writeFileSync(pidFile, process.pid.toString());

  if (isWindows) {
    const port = getPortForSession(currentSession);
    const portFile = getPortFile();
    fs.writeFileSync(portFile, port.toString());
    server.listen(port, '127.0.0.1', () => {});
  } else {
    const socketPath = getSocketPath();
    server.listen(socketPath, () => {});
  }

  server.on('error', (err) => {
    console.error('Server error:', err);
    cleanupSocket();
    process.exit(1);
  });

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (streamServer) {
      await streamServer.stop();
      streamServer = null;
      const streamPortFile = getStreamPortFile();
      try {
        if (fs.existsSync(streamPortFile)) fs.unlinkSync(streamPortFile);
      } catch {}
    }

    await manager.close();
    server.close();
    cleanupSocket();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    cleanupSocket();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    cleanupSocket();
    process.exit(1);
  });

  process.on('exit', () => {
    cleanupSocket();
  });

  process.stdin.resume();
}

if (process.argv[1]?.endsWith('daemon.js') || process.env.NSTBROWSER_AI_AGENT_DAEMON === '1') {
  startDaemon().catch((err) => {
    console.error('Daemon error:', err);
    cleanupSocket();
    process.exit(1);
  });
}
