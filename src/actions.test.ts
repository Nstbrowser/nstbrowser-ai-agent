import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BrowserManager } from './browser.js';
import { executeCommand, toAIFriendlyError } from './actions.js';

const { executeNstbrowserCommandMock } = vi.hoisted(() => ({
  executeNstbrowserCommandMock: vi.fn(),
}));

vi.mock('./nstbrowser-actions.js', () => ({
  executeNstbrowserCommand: executeNstbrowserCommandMock,
}));

describe('executeCommand', () => {
  beforeEach(() => {
    executeNstbrowserCommandMock.mockReset();
    vi.stubEnv('NST_PROFILE_ID', '');
    vi.stubEnv('NST_PROFILE', '');
    vi.stubEnv('NST_API_KEY', 'test-key');
    vi.stubEnv('NSTBROWSER_AI_AGENT_PROVIDER', 'local');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('closes the current session without launching a browser first', async () => {
    const browser = {
      isLaunched: vi.fn(() => false),
      close: vi.fn(),
    } as unknown as BrowserManager;

    await expect(executeCommand({ id: 'close-test', action: 'close' }, browser)).resolves.toEqual({
      id: 'close-test',
      success: true,
      data: { closed: true },
    });
    expect(browser.isLaunched).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('prefers the attached session over an environment default profile', async () => {
    vi.stubEnv('NST_PROFILE', 'default-profile');
    const browser = {
      isLaunched: vi.fn(() => true),
      close: vi.fn(),
    } as unknown as BrowserManager;

    await executeCommand({ id: 'close-attached-test', action: 'close' }, browser);

    expect(browser.close).toHaveBeenCalledOnce();
    expect(executeNstbrowserCommandMock).not.toHaveBeenCalled();
  });

  it('uses the environment default when there is no attached session', async () => {
    vi.stubEnv('NST_PROFILE', 'default-profile');
    executeNstbrowserCommandMock.mockResolvedValue({
      id: 'close-env-test',
      success: true,
      data: { stopped: true, profileId: 'profile-id' },
    });
    const browser = {
      isLaunched: vi.fn(() => false),
      close: vi.fn(),
    } as unknown as BrowserManager;

    await executeCommand({ id: 'close-env-test', action: 'close' }, browser);

    expect(executeNstbrowserCommandMock).toHaveBeenCalledWith({
      id: 'close-env-test',
      action: 'nst_browser_stop',
      profileId: 'default-profile',
    });
    expect(browser.close).not.toHaveBeenCalled();
  });

  it('stops the only running Agent browser when the session daemon has no context', async () => {
    vi.stubEnv('NSTBROWSER_AI_AGENT_PROVIDER', 'nst');
    executeNstbrowserCommandMock
      .mockResolvedValueOnce({
        id: 'close-recovery-test',
        success: true,
        data: {
          browsers: [{ profileId: 'only-running-profile', running: true }],
        },
      })
      .mockResolvedValueOnce({
        id: 'close-recovery-test',
        success: true,
        data: { stopped: true, profileId: 'only-running-profile' },
      });
    const browser = {
      isLaunched: vi.fn(() => false),
      close: vi.fn(),
    } as unknown as BrowserManager;

    await expect(
      executeCommand({ id: 'close-recovery-test', action: 'close' }, browser)
    ).resolves.toMatchObject({
      success: true,
      data: { closed: true, stopped: true, profileId: 'only-running-profile' },
    });
    expect(executeNstbrowserCommandMock).toHaveBeenNthCalledWith(2, {
      id: 'close-recovery-test',
      action: 'nst_browser_stop',
      profileId: 'only-running-profile',
    });
    expect(browser.close).not.toHaveBeenCalled();
  });

  it('requires an explicit profile when recovery finds multiple running browsers', async () => {
    vi.stubEnv('NSTBROWSER_AI_AGENT_PROVIDER', 'nst');
    executeNstbrowserCommandMock.mockResolvedValue({
      id: 'close-ambiguous-test',
      success: true,
      data: {
        browsers: [
          { profileId: 'profile-1', running: true },
          { profileId: 'profile-2', running: true },
        ],
      },
    });
    const browser = {
      isLaunched: vi.fn(() => false),
      close: vi.fn(),
    } as unknown as BrowserManager;

    await expect(
      executeCommand({ id: 'close-ambiguous-test', action: 'close' }, browser)
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('Use "close --profile <name-or-id>"'),
    });
    expect(executeNstbrowserCommandMock).toHaveBeenCalledOnce();
    expect(browser.close).not.toHaveBeenCalled();
  });

  it('stops an explicit NST profile through the Agent without touching the browser manager', async () => {
    executeNstbrowserCommandMock.mockResolvedValue({
      id: 'close-profile-test',
      success: true,
      data: { stopped: true, profileId: 'a152a370-7866-461c-b858-6b8fdbd2ce4a' },
    });
    const browser = {
      close: vi.fn(),
    } as unknown as BrowserManager;

    await expect(
      executeCommand(
        {
          id: 'close-profile-test',
          action: 'close',
          profile: 'a152a370-7866-461c-b858-6b8fdbd2ce4a',
        },
        browser
      )
    ).resolves.toEqual({
      id: 'close-profile-test',
      success: true,
      data: {
        closed: true,
        stopped: true,
        profileId: 'a152a370-7866-461c-b858-6b8fdbd2ce4a',
      },
    });
    expect(executeNstbrowserCommandMock).toHaveBeenCalledWith({
      id: 'close-profile-test',
      action: 'nst_browser_stop',
      profileId: 'a152a370-7866-461c-b858-6b8fdbd2ce4a',
    });
    expect(browser.close).not.toHaveBeenCalled();
  });
});

describe('toAIFriendlyError', () => {
  describe('element blocked by overlay', () => {
    it('should detect intercepts pointer events even when Timeout is in message', () => {
      // This is the exact error from Playwright when a cookie banner blocks an element
      // Bug: Previously this was incorrectly reported as "not found or not visible"
      const error = new Error(
        'TimeoutError: locator.click: Timeout 10000ms exceeded.\n' +
          'Call log:\n' +
          "  - waiting for getByRole('link', { name: 'Anmelden', exact: true }).first()\n" +
          '    - locator resolved to <a href="https://example.com/login">Anmelden</a>\n' +
          '  - attempting click action\n' +
          '    2 x waiting for element to be visible, enabled and stable\n' +
          '      - element is visible, enabled and stable\n' +
          '      - scrolling into view if needed\n' +
          '      - done scrolling\n' +
          '      - <body class="font-sans antialiased">...</body> intercepts pointer events\n' +
          '    - retrying click action'
      );

      const result = toAIFriendlyError(error, '@e4');

      // Must NOT say "not found" - the element WAS found
      expect(result.message).not.toContain('not found');
      // Must indicate the element is blocked
      expect(result.message).toContain('blocked by another element');
      expect(result.message).toContain('modal or overlay');
    });

    it('should suggest dismissing cookie banners', () => {
      const error = new Error('<div class="cookie-overlay"> intercepts pointer events');
      const result = toAIFriendlyError(error, '@e1');

      expect(result.message).toContain('cookie banners');
    });
  });
});
