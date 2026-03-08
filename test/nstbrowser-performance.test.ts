/**
 * Nstbrowser Performance Tests
 * 
 * These tests measure performance metrics for Nstbrowser integration.
 * Requires a running Nstbrowser client with valid API credentials.
 * 
 * Run with: NST_API_KEY=your-key pnpm test test/nstbrowser-performance.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NstbrowserClient } from '../src/nstbrowser-client.js';
import { isNstbrowserRunning } from '../src/nstbrowser-utils.js';

const SKIP_PERFORMANCE_TESTS = !process.env.NST_API_KEY;

interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
}

describe.skipIf(SKIP_PERFORMANCE_TESTS)('Nstbrowser Performance Tests', () => {
  let client: NstbrowserClient;
  const metrics: PerformanceMetrics[] = [];

  beforeAll(async () => {
    const host = process.env.NST_HOST || '127.0.0.1';
    const port = parseInt(process.env.NST_PORT || '8848', 10);
    const apiKey = process.env.NST_API_KEY || '';

    const isRunning = await isNstbrowserRunning(host, port);
    if (!isRunning) {
      throw new Error('Nstbrowser client is not running');
    }

    client = new NstbrowserClient(host, port, apiKey);
  });

  afterAll(() => {
    // Print performance summary
    console.log('\n=== Performance Test Summary ===\n');
    
    const successfulMetrics = metrics.filter(m => m.success);
    const failedMetrics = metrics.filter(m => !m.success);
    
    console.log(`Total operations: ${metrics.length}`);
    console.log(`Successful: ${successfulMetrics.length}`);
    console.log(`Failed: ${failedMetrics.length}\n`);
    
    if (successfulMetrics.length > 0) {
      console.log('Operation Performance:');
      const grouped = successfulMetrics.reduce((acc, m) => {
        if (!acc[m.operation]) {
          acc[m.operation] = [];
        }
        acc[m.operation].push(m.duration);
        return acc;
      }, {} as Record<string, number[]>);
      
      Object.entries(grouped).forEach(([operation, durations]) => {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const min = Math.min(...durations);
        const max = Math.max(...durations);
        console.log(`  ${operation}:`);
        console.log(`    Average: ${avg.toFixed(2)}ms`);
        console.log(`    Min: ${min.toFixed(2)}ms`);
        console.log(`    Max: ${max.toFixed(2)}ms`);
      });
    }
    
    if (failedMetrics.length > 0) {
      console.log('\nFailed Operations:');
      failedMetrics.forEach(m => {
        console.log(`  ${m.operation}: ${m.error}`);
      });
    }
    
    console.log('\n================================\n');
  });

  async function measureOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      metrics.push({ operation, duration, success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      metrics.push({
        operation,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  describe('API Response Times', () => {
    it('should list browsers within acceptable time', async () => {
      const result = await measureOperation('getBrowsers', () => client.getBrowsers());
      expect(Array.isArray(result)).toBe(true);
      
      const metric = metrics[metrics.length - 1];
      expect(metric.duration).toBeLessThan(2000); // Should complete in < 2 seconds
    });

    it('should list profiles within acceptable time', async () => {
      const result = await measureOperation('getProfiles', () => client.getProfiles());
      expect(Array.isArray(result)).toBe(true);
      
      const metric = metrics[metrics.length - 1];
      expect(metric.duration).toBeLessThan(2000);
    });

    it('should list profile tags within acceptable time', async () => {
      const result = await measureOperation('getProfileTags', () => client.getProfileTags());
      expect(Array.isArray(result)).toBe(true);
      
      const metric = metrics[metrics.length - 1];
      expect(metric.duration).toBeLessThan(2000);
    });

    it('should list profile groups within acceptable time', async () => {
      const result = await measureOperation('getAllProfileGroups', () =>
        client.getAllProfileGroups()
      );
      expect(Array.isArray(result)).toBe(true);
      
      const metric = metrics[metrics.length - 1];
      expect(metric.duration).toBeLessThan(2000);
    });
  });

  describe('Browser Lifecycle Performance', () => {
    it('should start browser within acceptable time', async () => {
      // Get or create a test profile
      const profiles = await client.getProfiles();
      let profileId: string;

      if (profiles.length === 0) {
        const profile = await measureOperation('createProfile', () =>
          client.createProfile({
            name: `perf-test-${Date.now()}`,
            platform: 'Windows',
          })
        );
        profileId = profile.profileId;
      } else {
        profileId = profiles[0].profileId;
      }

      // Start browser
      const result = await measureOperation('startBrowser', () =>
        client.startBrowser(profileId)
      );
      expect(result.webSocketDebuggerUrl).toBeDefined();
      
      const metric = metrics[metrics.length - 1];
      expect(metric.duration).toBeLessThan(10000); // Should start in < 10 seconds

      // Stop browser
      await measureOperation('stopBrowser', () => client.stopBrowser(profileId));
      
      const stopMetric = metrics[metrics.length - 1];
      expect(stopMetric.duration).toBeLessThan(5000); // Should stop in < 5 seconds
    }, 30000);

    it('should connect to browser via CDP within acceptable time', async () => {
      const profiles = await client.getProfiles();
      let profileId: string;

      if (profiles.length === 0) {
        const profile = await client.createProfile({
          name: `perf-test-${Date.now()}`,
          platform: 'Windows',
        });
        profileId = profile.profileId;
      } else {
        profileId = profiles[0].profileId;
      }

      // Connect to browser
      const result = await measureOperation('connectBrowser', () =>
        client.connectBrowser(profileId)
      );
      expect(result.webSocketDebuggerUrl).toBeDefined();
      
      const metric = metrics[metrics.length - 1];
      expect(metric.duration).toBeLessThan(10000); // Should connect in < 10 seconds

      // Stop browser
      await client.stopBrowser(profileId);
    }, 30000);
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent API calls', async () => {
      const operations = [
        measureOperation('concurrent-getBrowsers', () => client.getBrowsers()),
        measureOperation('concurrent-getProfiles', () => client.getProfiles()),
        measureOperation('concurrent-getProfileTags', () => client.getProfileTags()),
        measureOperation('concurrent-getAllProfileGroups', () => client.getAllProfileGroups()),
      ];

      const startTime = performance.now();
      const results = await Promise.all(operations);
      const totalTime = performance.now() - startTime;

      expect(results).toHaveLength(4);
      expect(totalTime).toBeLessThan(5000); // All should complete in < 5 seconds
    });

    it('should handle batch profile operations efficiently', async () => {
      // Create multiple profiles
      const profileNames = Array.from({ length: 5 }, (_, i) => `batch-test-${Date.now()}-${i}`);
      
      const createStartTime = performance.now();
      const profiles = await Promise.all(
        profileNames.map((name) =>
          measureOperation(`batch-createProfile-${name}`, () =>
            client.createProfile({ name, platform: 'Windows' })
          )
        )
      );
      const createTime = performance.now() - createStartTime;

      expect(profiles).toHaveLength(5);
      expect(createTime).toBeLessThan(15000); // Should create 5 profiles in < 15 seconds

      // Delete profiles
      const deleteStartTime = performance.now();
      await Promise.all(
        profiles.map((profile) =>
          measureOperation(`batch-deleteProfile-${profile.profileId}`, () =>
            client.deleteProfile(profile.profileId)
          )
        )
      );
      const deleteTime = performance.now() - deleteStartTime;

      expect(deleteTime).toBeLessThan(10000); // Should delete 5 profiles in < 10 seconds
    }, 60000);
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform 50 operations
      for (let i = 0; i < 50; i++) {
        await measureOperation(`memory-test-${i}`, () => client.getBrowsers());
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
      
      console.log(`Memory increase after 50 operations: ${memoryIncreaseMB.toFixed(2)} MB`);
      
      // Memory increase should be reasonable (< 50MB for 50 operations)
      expect(memoryIncreaseMB).toBeLessThan(50);
    }, 60000);
  });

  describe('Error Recovery Performance', () => {
    it('should handle errors quickly', async () => {
      const startTime = performance.now();
      
      try {
        await measureOperation('error-invalidProfile', () =>
          client.startBrowser('invalid-profile-id-12345')
        );
      } catch (error) {
        // Expected to fail
      }
      
      const errorTime = performance.now() - startTime;
      expect(errorTime).toBeLessThan(5000); // Error should be detected quickly
    });

    it('should recover from errors and continue operations', async () => {
      // Trigger an error
      try {
        await client.startBrowser('invalid-profile-id');
      } catch {
        // Expected
      }
      
      // Verify subsequent operations still work
      const result = await measureOperation('recovery-getBrowsers', () =>
        client.getBrowsers()
      );
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

if (SKIP_PERFORMANCE_TESTS) {
  console.log('\n⚠️  Skipping Nstbrowser performance tests - NST_API_KEY not set\n');
}
