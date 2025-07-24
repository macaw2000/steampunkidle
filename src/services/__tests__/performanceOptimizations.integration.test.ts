/**
 * Performance Optimizations Integration Test
 * Simple integration test to verify the performance optimization components work together
 */

import { PerformanceOptimizationService } from '../performanceOptimizations';
import { TaskQueue, Task, TaskType } from '../../types/taskQueue';

// Mock Redis for testing
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

describe('Performance Optimizations Integration', () => {
  let service: PerformanceOptimizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const config = {
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'test',
        ttl: {
          activeQueue: 300,
          taskProgress: 60,
          playerStats: 600,
          frequentData: 1800,
        },
        maxRetries: 3,
        retryDelayMs: 1000,
      },
      database: {
        maxConnections: 5,
        connectionTimeout: 5000,
        idleTimeout: 300000,
        region: 'us-east-1',
      },
      batch: {
        maxBatchSize: 10,
        batchTimeout: 1000,
        maxConcurrentBatches: 3,
      },
      memory: {
        maxCacheSize: 1000,
        gcInterval: 30000,
        memoryThreshold: 100 * 1024 * 1024,
        enableGcOptimization: true,
      },
    };

    service = new PerformanceOptimizationService(config);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  it('should initialize and provide basic functionality', async () => {
    // Test caching
    const mockQueue: TaskQueue = {
      playerId: 'test-player',
      currentTask: null,
      queuedTasks: [],
      isRunning: false,
      isPaused: false,
      totalTasksCompleted: 0,
      totalTimeSpent: 0,
      totalRewardsEarned: [],
      config: { maxQueueSize: 50, autoStart: true, priorityHandling: true },
      lastUpdated: Date.now(),
      lastSynced: Date.now(),
      createdAt: Date.now(),
      version: 1,
      checksum: '',
      lastValidated: Date.now(),
      stateHistory: [],
      maxHistorySize: 100,
    };

    // Cache queue state
    await service.cacheActiveQueueState('test-player', mockQueue);
    expect(mockRedisClient.setEx).toHaveBeenCalled();

    // Get cached state (will fall back to local cache since Redis mock returns null)
    const cachedQueue = await service.getCachedQueueState('test-player');
    expect(cachedQueue).toEqual(mockQueue);

    // Test connection pooling
    const connection = service.getOptimizedConnection();
    expect(connection).toBeDefined();

    // Test batch operations
    const operation = {
      id: 'test-op',
      type: 'write' as const,
      tableName: 'test-table',
      key: { id: 'test' },
      timestamp: Date.now(),
      priority: 5,
    };

    service.addToBatch(operation);
    const batchStats = service.getBatchStats();
    expect(batchStats.totalPendingOperations).toBe(1);

    // Test memory stats
    const memoryStats = service.getMemoryStats();
    expect(memoryStats).toHaveProperty('heapUsed');
    expect(memoryStats).toHaveProperty('cacheSize');
    expect(memoryStats).toHaveProperty('connectionPoolSize');
  });

  it('should handle cache operations with fallback', async () => {
    // Test frequent data caching
    const testData = { level: 15, experience: 1500 };
    await service.cacheFrequentData('player-stats', testData);
    
    const retrievedData = await service.getCachedFrequentData('player-stats');
    expect(retrievedData).toEqual(testData);
  });

  it('should provide performance statistics', () => {
    const cacheStats = service.getCacheStats();
    const memoryStats = service.getMemoryStats();
    const batchStats = service.getBatchStats();

    expect(cacheStats).toBeInstanceOf(Map);
    expect(memoryStats).toHaveProperty('heapUsed');
    expect(batchStats).toHaveProperty('totalPendingOperations');
  });

  it('should shutdown gracefully', async () => {
    await service.shutdown();
    expect(mockRedisClient.quit).toHaveBeenCalled();
  });
});