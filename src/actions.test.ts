import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  });

  it('closes without resolving or launching a browser first', async () => {
    const browser = {
      isLaunched: vi.fn(() => {
        throw new Error('close must not inspect browser launch state');
      }),
      close: vi.fn(),
    } as unknown as BrowserManager;

    await expect(executeCommand({ id: 'close-test', action: 'close' }, browser)).resolves.toEqual({
      id: 'close-test',
      success: true,
      data: { closed: true },
    });
    expect(browser.isLaunched).not.toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalledOnce();
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
