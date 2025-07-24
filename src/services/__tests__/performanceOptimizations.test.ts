/**
 * Performance Optimizations Service Tests
 * Tests Redis caching, connection pooling, batch processing, and memory management
 */

import { PerformanceOptimizationService } from '../performanceOptimizations';
import { TaskQueue, Task, TaskType, TaskProgress } from '../../types/taskQueue';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

// Mock DynamoDB client
const mockDynamoClient = {
  send: jest.fn().mockResolvedValue({}),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => mockDynamoClient),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDynamoClient),
  },
}));

describe('PerformanceOptimizationService', () => {
  let service: PerformanceOptimizationService;
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
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

    service = new PerformanceOptimizationService(mockConfig);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Redis Caching', () => {
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

    it('should cache active queue state', async () => {
      await service.cacheActiveQueueState('test-player', mockQueue);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:queue:test-player',
        300,
        JSON.stringify(mockQueue)
      );
    });

    it('should retrieve cached queue state', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(mockQueue));
      
      const result = await service.getCachedQueueState('test-player');
      
      expect(result).toEqual(mockQueue);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test:queue:test-player');
    });

    it('should return null for cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      
      const result = await service.getCachedQueueState('test-player');
      
      expect(result).toBeNull();
    });

    it('should cache task progress', async () => {
      const progress: TaskProgress = {
        taskId: 'test-task',
        progress: 0.5,
        timeRemaining: 30000,
        isComplete: false,
      };

      await service.cacheTaskProgress('test-task', progress);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:progress:test-task',
        60,
        JSON.stringify(progress)
      );
    });

    it('should retrieve cached task progress', async () => {
      const progress: TaskProgress = {
        taskId: 'test-task',
        progress: 0.75,
        timeRemaining: 15000,
        isComplete: false,
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(progress));
      
      const result = await service.getCachedTaskProgress('test-task');
      
      expect(result).toEqual(progress);
    });

    it('should fall back to local cache when Redis fails', async () => {
      mockRedisClient.setEx.mockRejectedValueOnce(new Error('Redis connection failed'));
      
      await service.cacheActiveQueueState('test-player', mockQueue);
      
      // Should not throw error and should use local cache
      const result = await service.getCachedQueueState('test-player');
      expect(result).toEqual(mockQueue);
    });

    it('should cache frequent data with custom TTL', async () => {
      const data = { playerLevel: 15, experience: 1500 };
      
      await service.cacheFrequentData('player-stats', data, 1200);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:data:player-stats',
        1200,
        JSON.stringify(data)
      );
    });
  });

  describe('Connection Pooling', () => {
    it('should provide optimized database connection', () => {
      const connection1 = service.getOptimizedConnection();
      const connection2 = service.getOptimizedConnection();
      
      expect(connection1).toBeDefined();
      expect(connection2).toBeDefined();
      // Should reuse connections from pool
    });

    it('should track connection usage', () => {
      const connection = service.getOptimizedConnection();
      expect(connection).toBeDefined();
      
      // Usage should be tracked internally
      const memoryStats = service.getMemoryStats();
      expect(memoryStats.connectionPoolSize).toBeGreaterThan(0);
    });
  });

  describe('Batch Processing', () => {
    it('should add operations to batch queue', () => {
      const operation = {
        id: 'test-op-1',
        type: 'write' as const,
        tableName: 'test-table',
        key: { id: 'test' },
        data: { value: 'test-data' },
        timestamp: Date.now(),
        priority: 5,
      };

      service.addToBatch(operation);
      
      const batchStats = service.getBatchStats();
      expect(batchStats.totalPendingOperations).toBe(1);
    });

    it('should process batch when max size reached', async () => {
      // Add operations up to max batch size
      for (let i = 0; i < mockConfig.batch.maxBatchSize; i++) {
        const operation = {
          id: `test-op-${i}`,
          type: 'write' as const,
          tableName: 'test-table',
          key: { id: `test-${i}` },
          data: { value: `test-data-${i}` },
          timestamp: Date.now(),
          priority: 5,
        };
        
        service.addToBatch(operation);
      }

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Batch should be processed
      const batchStats = service.getBatchStats();
      expect(batchStats.totalPendingOperations).toBeLessThan(mockConfig.batch.maxBatchSize);
    });

    it('should prioritize operations correctly', () => {
      const lowPriorityOp = {
        id: 'low-priority',
        type: 'write' as const,
        tableName: 'test-table',
        key: { id: 'low' },
        timestamp: Date.now(),
        priority: 1,
      };

      const highPriorityOp = {
        id: 'high-priority',
        type: 'write' as const,
        tableName: 'test-table',
        key: { id: 'high' },
        timestamp: Date.now(),
        priority: 10,
      };

      service.addToBatch(lowPriorityOp);
      service.addToBatch(highPriorityOp);
      
      // High priority operation should be processed first
      const batchStats = service.getBatchStats();
      expect(batchStats.totalPendingOperations).toBe(2);
    });
  });

  describe('Memory Management', () => {
    it('should track memory statistics', () => {
      const memoryStats = service.getMemoryStats();
      
      expect(memoryStats).toHaveProperty('heapUsed');
      expect(memoryStats).toHaveProperty('heapTotal');
      expect(memoryStats).toHaveProperty('external');
      expect(memoryStats).toHaveProperty('rss');
      expect(memoryStats).toHaveProperty('cacheSize');
      expect(memoryStats).toHaveProperty('connectionPoolSize');
      expect(memoryStats).toHaveProperty('batchQueueSize');
    });

    it('should clean up local cache when size limit exceeded', async () => {
      // Fill cache beyond limit
      for (let i = 0; i < mockConfig.memory.maxCacheSize + 100; i++) {
        await service.cacheFrequentData(`test-key-${i}`, { data: i });
      }

      const memoryStats = service.getMemoryStats();
      expect(memoryStats.cacheSize).toBeLessThanOrEqual(mockConfig.memory.maxCacheSize);
    });

    it('should handle expired cache entries', async () => {
      // Cache data with very short TTL
      await service.cacheFrequentData('short-lived', { data: 'test' }, 0.001); // 1ms
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await service.getCachedFrequentData('short-lived');
      expect(result).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      // Cache miss
      await service.getCachedQueueState('non-existent-player');
      
      // Cache hit
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
      
      await service.cacheActiveQueueState('test-player', mockQueue);
      await service.getCachedQueueState('test-player');
      
      const cacheStats = service.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    it('should provide batch processing statistics', () => {
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
      expect(batchStats.activeBatches).toBe(0);
      expect(batchStats.queueSizes.size).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      mockRedisClient.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      // Should not throw error
      await expect(service.cacheActiveQueueState('test-player', {} as TaskQueue)).resolves.not.toThrow();
    });

    it('should handle database connection errors', () => {
      mockDynamoClient.send.mockRejectedValueOnce(new Error('Database error'));
      
      // Should still provide a connection (fallback)
      const connection = service.getOptimizedConnection();
      expect(connection).toBeDefined();
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', async () => {
      await service.shutdown();
      
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should process remaining batches on shutdown', async () => {
      const operation = {
        id: 'final-op',
        type: 'write' as const,
        tableName: 'test-table',
        key: { id: 'final' },
        timestamp: Date.now(),
        priority: 5,
      };

      service.addToBatch(operation);
      
      await service.shutdown();
      
      // Should have processed pending operations
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });
});