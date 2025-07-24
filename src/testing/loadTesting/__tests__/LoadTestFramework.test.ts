/**
 * Tests for Load Test Framework
 */

import { LoadTestFramework, LoadTestConfig } from '../LoadTestFramework';
import { ServerTaskQueueService } from '../../../services/serverTaskQueueService';

// Mock the ServerTaskQueueService
jest.mock('../../../services/serverTaskQueueService', () => {
  return {
    ServerTaskQueueService: jest.fn().mockImplementation(() => ({
      addHarvestingTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
      addCraftingTask: jest.fn().mockResolvedValue({ id: 'task-2' }),
      addCombatTask: jest.fn().mockResolvedValue({ id: 'task-3' }),
      getQueueStatus: jest.fn().mockReturnValue({ queueLength: 0 }),
      stopAllTasks: jest.fn().mockResolvedValue(undefined),
      reorderTasks: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

describe('LoadTestFramework', () => {
  let loadTestFramework: LoadTestFramework;
  let mockTaskQueueService: jest.Mocked<ServerTaskQueueService>;

  beforeEach(() => {
    mockTaskQueueService = new ServerTaskQueueService() as jest.Mocked<ServerTaskQueueService>;
    loadTestFramework = new LoadTestFramework(mockTaskQueueService);
  });

  afterEach(() => {
    if (loadTestFramework) {
      loadTestFramework.stopCurrentTest();
    }
  });

  describe('executeLoadTest', () => {
    it('should execute a basic load test successfully', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 10,
        testDurationMs: 5000, // 5 seconds for quick test
        tasksPerPlayer: 3,
        taskTypeDistribution: { harvesting: 50, crafting: 30, combat: 20 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 1000,
        rampDownTimeMs: 1000
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result).toBeDefined();
      expect(result.testId).toMatch(/^load-test-\d+$/);
      expect(result.config).toEqual(config);
      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.endTime).toBeGreaterThan(result.startTime);
    });

    it('should handle concurrent player simulation', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 5,
        testDurationMs: 3000,
        tasksPerPlayer: 2,
        taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 500,
        rampDownTimeMs: 500
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.averageResponseTime).toBeGreaterThan(0);
      expect(result.successfulRequests + result.failedRequests).toBe(result.totalRequests);
    });

    it('should collect performance metrics', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 3,
        testDurationMs: 2000,
        tasksPerPlayer: 1,
        taskTypeDistribution: { harvesting: 33, crafting: 33, combat: 34 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 500,
        rampDownTimeMs: 500
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result.peakMemoryUsage).toBeGreaterThan(0);
      expect(result.averageCpuUsage).toBeGreaterThan(0);
      expect(result.peakCpuUsage).toBeGreaterThanOrEqual(result.averageCpuUsage);
      expect(result.averageQueueLength).toBeGreaterThanOrEqual(0);
      expect(result.maxQueueLength).toBeGreaterThanOrEqual(result.averageQueueLength);
    });

    it('should generate task processing metrics', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 2,
        testDurationMs: 2000,
        tasksPerPlayer: 5,
        taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 500,
        rampDownTimeMs: 500
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result.taskProcessingRate).toBeGreaterThan(0);
      expect(result.totalTasksProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should handle different task type distributions', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 3,
        testDurationMs: 2000,
        tasksPerPlayer: 6,
        taskTypeDistribution: { harvesting: 20, crafting: 30, combat: 50 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 500,
        rampDownTimeMs: 500
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.config.taskTypeDistribution).toEqual(config.taskTypeDistribution);
    });

    it('should provide error analysis', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 2,
        testDurationMs: 1000,
        tasksPerPlayer: 2,
        taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 200,
        rampDownTimeMs: 200
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result.errorsByType).toBeDefined();
      expect(result.criticalErrors).toBeDefined();
      expect(Array.isArray(result.criticalErrors)).toBe(true);
    });

    it('should generate capacity insights', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 4,
        testDurationMs: 2000,
        tasksPerPlayer: 3,
        taskTypeDistribution: { harvesting: 40, crafting: 30, combat: 30 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 500,
        rampDownTimeMs: 500
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result.recommendedMaxPlayers).toBeGreaterThan(0);
      expect(result.bottleneckComponents).toBeDefined();
      expect(Array.isArray(result.bottleneckComponents)).toBe(true);
      expect(result.scalingRecommendations).toBeDefined();
      expect(Array.isArray(result.scalingRecommendations)).toBe(true);
    });
  });

  describe('stopCurrentTest', () => {
    it('should stop a running test', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 5,
        testDurationMs: 10000, // Long test
        tasksPerPlayer: 10,
        taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 1000,
        rampDownTimeMs: 1000
      };

      // Start test and stop it quickly
      const testPromise = loadTestFramework.executeLoadTest(config);
      
      // Stop after a short delay
      setTimeout(() => {
        loadTestFramework.stopCurrentTest();
      }, 1000);

      const result = await testPromise;
      
      // Test should complete even when stopped
      expect(result).toBeDefined();
      expect(result.endTime - result.startTime).toBeLessThan(config.testDurationMs);
    });
  });

  describe('getTestResults', () => {
    it('should return test results history', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 2,
        testDurationMs: 1000,
        tasksPerPlayer: 1,
        taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 200,
        rampDownTimeMs: 200
      };

      // Execute a test
      await loadTestFramework.executeLoadTest(config);

      const results = loadTestFramework.getTestResults();
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      expect(results[0].config).toEqual(config);
    });

    it('should accumulate multiple test results', async () => {
      const config1: LoadTestConfig = {
        concurrentPlayers: 1,
        testDurationMs: 500,
        tasksPerPlayer: 1,
        taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 100,
        rampDownTimeMs: 100
      };

      const config2: LoadTestConfig = {
        ...config1,
        concurrentPlayers: 2
      };

      await loadTestFramework.executeLoadTest(config1);
      await loadTestFramework.executeLoadTest(config2);

      const results = loadTestFramework.getTestResults();
      expect(results.length).toBe(2);
      expect(results[0].config.concurrentPlayers).toBe(1);
      expect(results[1].config.concurrentPlayers).toBe(2);
    });
  });

  describe('task simulation', () => {
    it('should create mock tasks for different activity types', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 1,
        testDurationMs: 1000,
        tasksPerPlayer: 3,
        taskTypeDistribution: { harvesting: 33, crafting: 33, combat: 34 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 200,
        rampDownTimeMs: 200
      };

      const result = await loadTestFramework.executeLoadTest(config);

      // Should have processed tasks for the single player
      expect(result.totalRequests).toBeGreaterThan(0);
    });

    it('should handle queue management operations', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 2,
        testDurationMs: 2000,
        tasksPerPlayer: 5,
        taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 500,
        rampDownTimeMs: 500
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result.averageQueueLength).toBeGreaterThanOrEqual(0);
      expect(result.maxQueueLength).toBeGreaterThanOrEqual(0);
    });
  });

  describe('performance analysis', () => {
    it('should calculate response time percentiles', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 3,
        testDurationMs: 2000,
        tasksPerPlayer: 4,
        taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 500,
        rampDownTimeMs: 500
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result.p95ResponseTime).toBeGreaterThanOrEqual(result.averageResponseTime);
      expect(result.p99ResponseTime).toBeGreaterThanOrEqual(result.p95ResponseTime);
    });

    it('should provide scaling recommendations based on performance', async () => {
      const config: LoadTestConfig = {
        concurrentPlayers: 10,
        testDurationMs: 3000,
        tasksPerPlayer: 5,
        taskTypeDistribution: { harvesting: 40, crafting: 30, combat: 30 },
        maxResponseTimeMs: 500, // Strict threshold
        maxErrorRate: 0.01, // Low error tolerance
        maxMemoryUsageMB: 200, // Low memory limit
        rampUpTimeMs: 500,
        rampDownTimeMs: 500
      };

      const result = await loadTestFramework.executeLoadTest(config);

      expect(result.scalingRecommendations.length).toBeGreaterThan(0);
      expect(result.recommendedMaxPlayers).toBeGreaterThan(0);
    });
  });
});