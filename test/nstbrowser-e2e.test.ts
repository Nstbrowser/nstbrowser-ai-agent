/**
 * Nstbrowser End-to-End Tests
 * 
 * These tests verify complete workflows with real Nstbrowser client and browser automation.
 * Requires a running Nstbrowser client with valid API credentials.
 * 
 * Run with: NST_API_KEY=your-key pnpm test test/nstbrowser-e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserManager } from '../src/browser.js';
import { isNstbrowserRunning } from '../src/nstbrowser-utils.js';

const SKIP_E2E_TESTS = !process.env.NST_API_KEY;

describe.skipIf(SKIP_E2E_TESTS)('Nstbrowser End-to-End Tests', () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    const host = process.env.NST_HOST || '127.0.0.1';
    const port = parseInt(process.env.NST_PORT || '8848', 10);

    // Check if Nstbrowser is running
    const isRunning = await isNstbrowserRunning(host, port);
    if (!isRunning) {
      throw new Error(
        'Nstbrowser client is not running. Please start it before running E2E tests.'
      );
    }

    browser = new BrowserManager();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Browser Launch and Connection', () => {
    it('should launch browser with Nstbrowser provider', async () => {
      await browser.launch({
        id: 'test-launch',
        action: 'launch',
        provider: 'nst',
      });

      expect(browser.isLaunched()).toBe(true);
    }, 30000);

    it('should connect to existing Nstbrowser session', async () => {
      const page = browser.getPage();
      expect(page).toBeDefined();
      expect(page.url()).toBeDefined();
    });
  });

  describe('Navigation and Page Interaction', () => {
    it('should navigate to a URL', async () => {
      const page = browser.getPage();
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

      const url = page.url();
      expect(url).toContain('example.com');
    }, 15000);

    it('should get page title', async () => {
      const page = browser.getPage();
      const title = await page.title();
      expect(title).toBeDefined();
      expect(title.length).toBeGreaterThan(0);
    });

    it('should take a screenshot', async () => {
      const page = browser.getPage();
      const screenshot = await page.screenshot({ type: 'png' });
      expect(screenshot).toBeDefined();
      expect(screenshot.length).toBeGreaterThan(0);
    });

    it('should evaluate JavaScript', async () => {
      const page = browser.getPage();
      const result = await page.evaluate(() => {
        return document.title;
      });
      expect(result).toBeDefined();
    });
  });

  describe('Form Interaction', () => {
    it('should fill and submit a form', async () => {
      const page = browser.getPage();
      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });

      // Wait for search input
      await page.waitForSelector('textarea[name="q"]', { timeout: 5000 });

      // Fill search input
      await page.fill('textarea[name="q"]', 'Nstbrowser');

      // Get the filled value
      const value = await page.inputValue('textarea[name="q"]');
      expect(value).toBe('Nstbrowser');
    }, 20000);
  });

  describe('Cookies and Storage', () => {
    it('should set and get cookies', async () => {
      const page = browser.getPage();
      const context = page.context();

      // Set cookie
      await context.addCookies([
        {
          name: 'test-cookie',
          value: 'test-value',
          domain: 'example.com',
          path: '/',
        },
      ]);

      // Navigate to domain
      await page.goto('https://example.com');

      // Get cookies
      const cookies = await context.cookies('https://example.com');
      const testCookie = cookies.find((c) => c.name === 'test-cookie');
      expect(testCookie).toBeDefined();
      expect(testCookie?.value).toBe('test-value');
    }, 15000);

    it('should set and get localStorage', async () => {
      const page = browser.getPage();
      await page.goto('https://example.com');

      // Set localStorage
      await page.evaluate(() => {
        localStorage.setItem('test-key', 'test-value');
      });

      // Get localStorage
      const value = await page.evaluate(() => {
        return localStorage.getItem('test-key');
      });

      expect(value).toBe('test-value');
    }, 15000);
  });

  describe('Multiple Tabs', () => {
    it('should open and switch between tabs', async () => {
      const page = browser.getPage();
      const context = page.context();

      // Open new tab
      const newPage = await context.newPage();
      await newPage.goto('https://example.com');

      // Verify we have multiple pages
      const pages = context.pages();
      expect(pages.length).toBeGreaterThan(1);

      // Switch back to original page
      await page.bringToFront();

      // Close new tab
      await newPage.close();
    }, 20000);
  });

  describe('Navigation Controls', () => {
    it('should navigate back and forward', async () => {
      const page = browser.getPage();

      // Navigate to first page
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
      const url1 = page.url();

      // Navigate to second page
      await page.goto('https://www.iana.org', { waitUntil: 'domcontentloaded' });
      const url2 = page.url();

      expect(url2).not.toBe(url1);

      // Go back - use waitUntil: 'domcontentloaded' instead of 'load' to avoid timeout
      await page.goBack({ waitUntil: 'domcontentloaded' });
      expect(page.url()).toContain('example.com');

      // Go forward
      await page.goForward({ waitUntil: 'domcontentloaded' });
      expect(page.url()).toContain('iana.org');
    }, 30000);

    it('should reload page', async () => {
      const page = browser.getPage();
      await page.goto('https://example.com');

      // Reload page
      await page.reload();

      // Verify page is still loaded
      expect(page.url()).toContain('example.com');
    }, 15000);
  });

  describe('Viewport and Emulation', () => {
    it('should set viewport size', async () => {
      const page = browser.getPage();

      // Set viewport
      await page.setViewportSize({ width: 1280, height: 720 });

      // Get viewport size
      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(1280);
      expect(viewport?.height).toBe(720);
    });

    it('should emulate user agent', async () => {
      const page = browser.getPage();
      const context = page.context();

      // Set user agent
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgent', {
          get: () => 'Custom User Agent',
        });
      });

      await page.goto('https://example.com');

      // Verify user agent
      const userAgent = await page.evaluate(() => navigator.userAgent);
      expect(userAgent).toBeDefined();
    }, 15000);
  });

  describe('Performance', () => {
    it('should measure page load time', async () => {
      const page = browser.getPage();

      const startTime = Date.now();
      await page.goto('https://example.com', { waitUntil: 'load' });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000); // Should load in less than 10 seconds
    }, 15000);

    it('should handle multiple concurrent operations', async () => {
      const page = browser.getPage();
      await page.goto('https://example.com');

      // Execute multiple operations concurrently
      const operations = [
        page.title(),
        page.url(),
        page.evaluate(() => document.body.innerHTML),
        page.screenshot({ type: 'png' }),
      ];

      const results = await Promise.all(operations);
      expect(results).toHaveLength(4);
      expect(results.every((r) => r !== undefined)).toBe(true);
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle navigation timeout', async () => {
      const page = browser.getPage();

      // Try to navigate to non-existent domain with short timeout
      await expect(
        page.goto('https://this-domain-does-not-exist-12345.com', {
          timeout: 5000,
          waitUntil: 'load',
        })
      ).rejects.toThrow();
    }, 10000);

    it('should handle selector not found', async () => {
      const page = browser.getPage();
      // Navigate to a reliable page first
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
      
      // Wait a bit for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to click non-existent element with short timeout
      await expect(
        page.click('#non-existent-element', { timeout: 2000 })
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Cleanup', () => {
    it('should close browser cleanly', async () => {
      await browser.close();
      expect(browser.isLaunched()).toBe(false);
    }, 10000);
  });
});

if (SKIP_E2E_TESTS) {
  console.log('\n⚠️  Skipping Nstbrowser E2E tests - NST_API_KEY not set\n');
  console.log('To run E2E tests, set environment variables:');
  console.log('  NST_API_KEY=your-api-key');
  console.log('  NST_HOST=127.0.0.1 (optional)');
  console.log('  NST_PORT=8848 (optional)\n');
}
