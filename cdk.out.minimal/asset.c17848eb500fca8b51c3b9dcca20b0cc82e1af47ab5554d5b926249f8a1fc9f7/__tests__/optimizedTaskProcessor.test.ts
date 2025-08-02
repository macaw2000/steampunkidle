/**
 * Optimized Task Processor Lambda Tests
 * Tests the performance-optimized Lambda function for task processing
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler, warmup, cleanup } from '../optimizedTaskProcessor';
import { Task, TaskType } from '../../../types/taskQueue';

// Mock dependencies
jest.mock('../../../services/optimizedTaskQueueService');
jest.mock('../../../services/taskQueuePersistence');
jest.mock('../../../services/performanceOptimizations');

const mockOptimizedTaskQueueService = {
  addTask: jest.fn(),
  removeTask: jest.fn(),
  updateTaskProgress: jest.fn(),
  completeTask: jest.fn(),
  getQueueStatus: jest.fn(),
  stopAllTasks: jest.fn(),
  batchOperations: jest.fn(),
  getPerformanceStats: jest.fn(),
  shutdown: jest.fn(),
};

// Mock the service constructor
jest.mock('../../../services/optimizedTaskQueueService', () => ({
  OptimizedTaskQueueService: jest.fn(() => mockOptimizedTaskQueueService),
}));

describe('OptimizedTaskProcessor Lambda', () => {
  let mockEvent: APIGatewayProxyEvent;
  let mockContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEvent = {
      httpMethod: 'POST',
      path: '/task-queue/process',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false,
      multiValueHeaders: {},
    };

    mockContext = {
      callbackWaitsForEmptyEventLoop: true,
      functionName: 'optimized-task-processor',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:optimized-task-processor',
      memoryLimitInMB: '256',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/optimized-task-processor',
      logStreamName: '2023/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };

    // Mock performance stats
    mockOptimizedTaskQueueService.getPerformanceStats.mockReturnValue({
      activeQueues: 5,
      cacheStats: new Map([
        ['test-key', { hits: 10, misses: 2, evictions: 0 }],
      ]),
      memoryStats: {
        heapUsed: 50000000,
        heapTotal: 100000000,
        external: 5000000,
        rss: 120000000,
        cacheSize: 100,
        connectionPoolSize: 5,
        batchQueueSize: 10,
      },
      batchStats: {
        queueSizes: new Map([['test-table_write', 5]]),
        activeBatches: 2,
        totalPendingOperations: 15,
      },
    });
  });

  describe('Add Task Operation', () => {
    it('should add task successfully', async () => {
      const mockTask: Task = {
        id: 'test-task-1',
        type: TaskType.HARVESTING,
        name: 'Mine Copper',
        description: 'Mining copper ore',
        icon: 'copper-ore',
        duration: 30000,
        startTime: Date.now(),
        playerId: 'test-player',
        activityData: {},
        prerequisites: [],
        resourceRequirements: [],
        progress: 0,
        completed: false,
        rewards: [],
        priority: 5,
        estimatedCompletion: Date.now() + 30000,
        retryCount: 0,
        maxRetries: 3,
      };

      mockEvent.body = JSON.stringify({
        action: 'addTask',
        playerId: 'test-player',
        task: mockTask,
      });

      mockOptimizedTaskQueueService.addTask.mockResolvedValueOnce(undefined);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockOptimizedTaskQueueService.addTask).toHaveBeenCalledWith(
        'test-player',
        mockTask,
        {},
        1,
        {}
      );

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.performance).toBeDefined();
      expect(responseBody.performance.processingTime).toBeGreaterThan(0);
    });

    it('should return error for missing task data', async () => {
      mockEvent.body = JSON.stringify({
        action: 'addTask',
        playerId: 'test-player',
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toBe('Missing task data');
    });
  });

  describe('Remove Task Operation', () => {
    it('should remove task successfully', async () => {
      mockEvent.body = JSON.stringify({
        action: 'removeTask',
        playerId: 'test-player',
        taskId: 'task-to-remove',
      });

      mockOptimizedTaskQueueService.removeTask.mockResolvedValueOnce(undefined);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockOptimizedTaskQueueService.removeTask).toHaveBeenCalledWith(
        'test-player',
        'task-to-remove'
      );

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
    });

    it('should return error for missing taskId', async () => {
      mockEvent.body = JSON.stringify({
        action: 'removeTask',
        playerId: 'test-player',
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toBe('Missing taskId');
    });
  });

  describe('Update Progress Operation', () => {
    it('should update progress successfully', async () => {
      mockEvent.body = JSON.stringify({
        action: 'updateProgress',
        playerId: 'test-player',
        taskId: 'test-task',
        progress: 0.5,
      });

      mockOptimizedTaskQueueService.updateTaskProgress.mockResolvedValueOnce(undefined);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockOptimizedTaskQueueService.updateTaskProgress).toHaveBeenCalledWith(
        'test-player',
        'test-task',
        0.5
      );

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
    });

    it('should return error for missing progress data', async () => {
      mockEvent.body = JSON.stringify({
        action: 'updateProgress',
        playerId: 'test-player',
        taskId: 'test-task',
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toBe('Missing taskId or progress');
    });
  });

  describe('Complete Task Operation', () => {
    it('should complete task successfully', async () => {
      const mockCompletionResult = {
        task: { id: 'test-task', completed: true },
        rewards: [{ type: 'experience', quantity: 50 }],
        nextTask: null,
      };

      mockEvent.body = JSON.stringify({
        action: 'completeTask',
        playerId: 'test-player',
        taskId: 'test-task',
        rewards: [{ type: 'experience', quantity: 50 }],
      });

      mockOptimizedTaskQueueService.completeTask.mockResolvedValueOnce(mockCompletionResult);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockOptimizedTaskQueueService.completeTask).toHaveBeenCalledWith(
        'test-player',
        'test-task',
        [{ type: 'experience', quantity: 50 }]
      );

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.result).toEqual(mockCompletionResult);
    });
  });

  describe('Get Status Operation', () => {
    it('should get queue status successfully', async () => {
      const mockStatus = {
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 5,
      };

      mockEvent.body = JSON.stringify({
        action: 'getStatus',
        playerId: 'test-player',
      });

      mockOptimizedTaskQueueService.getQueueStatus.mockResolvedValueOnce(mockStatus);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockOptimizedTaskQueueService.getQueueStatus).toHaveBeenCalledWith('test-player');

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.status).toEqual(mockStatus);
    });
  });

  describe('Stop Tasks Operation', () => {
    it('should stop all tasks successfully', async () => {
      mockEvent.body = JSON.stringify({
        action: 'stopTasks',
        playerId: 'test-player',
      });

      mockOptimizedTaskQueueService.stopAllTasks.mockResolvedValueOnce(undefined);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockOptimizedTaskQueueService.stopAllTasks).toHaveBeenCalledWith('test-player');

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should process batch operations successfully', async () => {
      const operations = [
        { type: 'add', playerId: 'player-1', data: { id: 'task-1' } },
        { type: 'remove', playerId: 'player-1', taskId: 'task-2' },
      ];

      mockEvent.body = JSON.stringify({
        action: 'batchOperations',
        playerId: 'test-player',
        operations,
      });

      mockOptimizedTaskQueueService.batchOperations.mockResolvedValueOnce(undefined);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockOptimizedTaskQueueService.batchOperations).toHaveBeenCalledWith(operations);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.message).toBe('2 operations processed');
    });

    it('should return error for invalid operations array', async () => {
      mockEvent.body = JSON.stringify({
        action: 'batchOperations',
        playerId: 'test-player',
        operations: 'invalid',
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toBe('Missing or invalid operations array');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in request body', async () => {
      mockEvent.body = 'invalid json';

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toBe('Invalid JSON in request body');
    });

    it('should handle missing required fields', async () => {
      mockEvent.body = JSON.stringify({});

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toBe('Missing required fields: action, playerId');
    });

    it('should handle unknown action', async () => {
      mockEvent.body = JSON.stringify({
        action: 'unknownAction',
        playerId: 'test-player',
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toBe('Unknown action: unknownAction');
    });

    it('should handle service errors gracefully', async () => {
      mockEvent.body = JSON.stringify({
        action: 'getStatus',
        playerId: 'test-player',
      });

      mockOptimizedTaskQueueService.getQueueStatus.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toBe('Internal server error');
      expect(responseBody.error.details).toBe('Database connection failed');
    });
  });

  describe('Performance Monitoring', () => {
    it('should include performance metrics in response', async () => {
      mockEvent.body = JSON.stringify({
        action: 'getStatus',
        playerId: 'test-player',
      });

      mockOptimizedTaskQueueService.getQueueStatus.mockResolvedValueOnce({
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('X-Processing-Time');
      expect(result.headers).toHaveProperty('X-Operation-Count');

      const responseBody = JSON.parse(result.body);
      expect(responseBody.performance).toBeDefined();
      expect(responseBody.performance.processingTime).toBeGreaterThan(0);
      expect(responseBody.performance.operationCount).toBe(1);
      expect(responseBody.performance.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(responseBody.performance.memoryUsage).toBeGreaterThan(0);
    });

    it('should calculate cache hit rate correctly', async () => {
      mockEvent.body = JSON.stringify({
        action: 'getStatus',
        playerId: 'test-player',
      });

      // Mock cache stats with hits and misses
      mockOptimizedTaskQueueService.getPerformanceStats.mockReturnValueOnce({
        activeQueues: 1,
        cacheStats: new Map([
          ['key1', { hits: 8, misses: 2, evictions: 0 }],
          ['key2', { hits: 6, misses: 4, evictions: 0 }],
        ]),
        memoryStats: {
          heapUsed: 50000000,
          heapTotal: 100000000,
          external: 5000000,
          rss: 120000000,
          cacheSize: 100,
          connectionPoolSize: 5,
          batchQueueSize: 10,
        },
        batchStats: {
          queueSizes: new Map(),
          activeBatches: 0,
          totalPendingOperations: 0,
        },
      });

      mockOptimizedTaskQueueService.getQueueStatus.mockResolvedValueOnce({
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0,
      });

      const result = await handler(mockEvent, mockContext);

      const responseBody = JSON.parse(result.body);
      // Cache hit rate should be (8+6)/(8+2+6+4) = 14/20 = 70%
      expect(responseBody.performance.cacheHitRate).toBe(70);
    });
  });

  describe('Warmup Function', () => {
    it('should warm up successfully', async () => {
      mockOptimizedTaskQueueService.getQueueStatus.mockResolvedValueOnce({
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0,
      });

      await expect(warmup()).resolves.not.toThrow();
      expect(mockOptimizedTaskQueueService.getQueueStatus).toHaveBeenCalledWith('warmup-test');
    });

    it('should handle warmup errors gracefully', async () => {
      mockOptimizedTaskQueueService.getQueueStatus.mockRejectedValueOnce(
        new Error('Warmup failed')
      );

      await expect(warmup()).resolves.not.toThrow();
    });
  });

  describe('Cleanup Function', () => {
    it('should cleanup successfully', async () => {
      mockOptimizedTaskQueueService.shutdown.mockResolvedValueOnce(undefined);

      await expect(cleanup()).resolves.not.toThrow();
      expect(mockOptimizedTaskQueueService.shutdown).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockOptimizedTaskQueueService.shutdown.mockRejectedValueOnce(
        new Error('Cleanup failed')
      );

      await expect(cleanup()).resolves.not.toThrow();
    });
  });

  describe('Response Headers', () => {
    it('should include CORS headers', async () => {
      mockEvent.body = JSON.stringify({
        action: 'getStatus',
        playerId: 'test-player',
      });

      mockOptimizedTaskQueueService.getQueueStatus.mockResolvedValueOnce({
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });
});