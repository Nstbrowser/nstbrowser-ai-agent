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
    const message = `Invalid Nstbrowser API key

Setup:
1. Get your API key from Nstbrowser dashboard
2. Configure using one of these methods:

   Method 1 (Recommended - Config file):
   nstbrowser-ai-agent config set key YOUR_API_KEY

   Method 2 (Environment variable):
   export NST_API_KEY="YOUR_API_KEY"`;
    super(message, 'NST_AUTH_ERROR', 401);
  }
}

export class NstbrowserProfileNotFoundError extends NstbrowserError {
  constructor(profileName: string) {
    const message = `Profile '${profileName}' not found

Suggestions:
1. List available profiles:
   nstbrowser-ai-agent nst profile list

2. Create a new profile:
   nstbrowser-ai-agent nst profile create ${profileName}

3. Use temporary browser:
   nstbrowser-ai-agent nst browser start-once`;
    super(message, 'NST_PROFILE_NOT_FOUND', 404);
  }
}

export class NoProfileSpecifiedError extends NstbrowserError {
  constructor() {
    const message = `No profile specified

Options:
1. Specify profile by name:
   nstbrowser-ai-agent --profile my-profile open https://example.com

2. Specify profile by ID:
   nstbrowser-ai-agent --profile <UUID> open https://example.com

3. Use temporary browser:
   nstbrowser-ai-agent nst browser start-once`;
    super(message, 'NO_PROFILE_SPECIFIED');
  }
}

export class NstbrowserConnectionError extends NstbrowserError {
  constructor(message: string) {
    const fullMessage = `Failed to connect to Nstbrowser: ${message}

Troubleshooting:
1. Verify Nstbrowser client is running
2. Check API endpoint: http://127.0.0.1:8848
3. Test connection:
   curl http://127.0.0.1:8848/api/v2/profiles
4. Check API key is configured:
   echo $NST_API_KEY`;
    super(fullMessage, 'NST_CONNECTION_ERROR');
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
