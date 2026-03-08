/**
 * Nstbrowser integration error classes
 */

export class NstbrowserError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'NstbrowserError';
  }
}

export class NstbrowserNotInstalledError extends NstbrowserError {
  constructor() {
    super('Nstbrowser client is not installed', 'NST_NOT_INSTALLED');
  }
}

export class NstbrowserNotRunningError extends NstbrowserError {
  constructor() {
    super('Nstbrowser client is not running', 'NST_NOT_RUNNING');
  }
}

export class NstbrowserAuthError extends NstbrowserError {
  constructor() {
    super('Invalid Nstbrowser API key', 'NST_AUTH_ERROR', 401);
  }
}

export class NstbrowserProfileNotFoundError extends NstbrowserError {
  constructor(profileName: string) {
    super(`Profile "${profileName}" not found`, 'NST_PROFILE_NOT_FOUND', 404);
  }
}

export class NstbrowserConnectionError extends NstbrowserError {
  constructor(message: string) {
    super(`Failed to connect to Nstbrowser: ${message}`, 'NST_CONNECTION_ERROR');
  }
}

/**
 * Convert Nstbrowser API errors to user-friendly error messages
 */
export function handleNstbrowserError(error: unknown): Error {
  if (error instanceof NstbrowserError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for network errors
    if (error.message.includes('ECONNREFUSED')) {
      return new NstbrowserNotRunningError();
    }

    // Check for authentication errors
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return new NstbrowserAuthError();
    }

    return new NstbrowserError(error.message);
  }

  return new NstbrowserError(String(error));
}
