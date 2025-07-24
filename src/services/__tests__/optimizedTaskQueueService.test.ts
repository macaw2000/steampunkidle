/**
 * Optimized Task Queue Service Tests
 * Tests integration of performance optimizations with task queue operations
 */

import { OptimizedTaskQueueService } from '../optimizedTaskQueueService';
import { TaskQueuePersistenceService } from '../taskQueuePersistence';
import { performanceOptimizationService } from '../performanceOptimizations';
import { TaskQueue, Task, TaskType, TaskProgress } from '../../types/taskQueue';
import { CharacterStats } from '../../types/character';

// Mock dependencies
jest.mock('../taskQueuePersistence');
jest.mock('../performanceOptimizations');
jest.mock('../taskValidation');

const mockPersistenceService = {
  loadQueue: jest.fn(),
  saveQueueWithAtomicUpdate: jest.fn(),
  createStateSnapshot: jest.fn(),
  validateQueueIntegrity: jest.fn(),
} as jest.Mocked<TaskQueuePersistenceService>;

const mockPerformanceService = {
  getCachedQueueState: jest.fn(),
  cacheActiveQueueState: jest.fn(),
  getCachedTaskProgress: jest.fn(),
  cacheTaskProgress: jest.fn(),
  cacheFrequentData: jest.fn(),
  getCachedFrequentData: jest.fn(),
  addToBatch: jest.fn(),
  getMemoryStats: jest.fn(),
  getCacheStats: jest.fn(),
  getBatchStats: jest.fn(),
  shutdown: jest.fn(),
};

// Mock TaskValidationService
jest.mock('../taskValidation', () => ({
  TaskValidationService: {
    validateTask: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  },
}));

describe('OptimizedTaskQueueService', () => {
  let service: OptimizedTaskQueueService;
  let mockQueue: TaskQueue;
  let mockTask: Task;
  let mockPlayerStats: CharacterStats;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Replace the actual performance service with our mock
    Object.assign(performanceOptimizationService, mockPerformanceService);

    mockQueue = {
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
      checksum: 'test-checksum',
      lastValidated: Date.now(),
      stateHistory: [],
      maxHistorySize: 100,
    };

    mockTask = {
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

    mockPlayerStats = {
      level: 15,
      experience: 1500,
      health: 100,
      mana: 50,
      strength: 20,
      agility: 15,
      intelligence: 10,
      vitality: 25,
    };

    service = new OptimizedTaskQueueService(mockPersistenceService as any, {
      enableCaching: true,
      enableBatching: true,
      enableConnectionPooling: true,
      cacheStrategy: 'adaptive',
      batchStrategy: 'smart',
    });
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Queue Loading with Caching', () => {
    it('should load queue from cache first', async () => {
      mockPerformanceService.getCachedQueueState.mockResolvedValueOnce(mockQueue);
      
      const result = await service.loadPlayerQueue('test-player');
      
      expect(result).toEqual(mockQueue);
      expect(mockPerformanceService.getCachedQueueState).toHaveBeenCalledWith('test-player');
      expect(mockPersistenceService.loadQueue).not.toHaveBeenCalled();
    });

    it('should fall back to database when cache miss', async () => {
      mockPerformanceService.getCachedQueueState.mockResolvedValueOnce(null);
      mockPersistenceService.loadQueue.mockResolvedValueOnce(mockQueue);
      
      const result = await service.loadPlayerQueue('test-player');
      
      expect(result).toEqual(mockQueue);
      expect(mockPerformanceService.getCachedQueueState).toHaveBeenCalledWith('test-player');
      expect(mockPersistenceService.loadQueue).toHaveBeenCalledWith('test-player');
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalledWith('test-player', mockQueue);
    });

    it('should return null when queue not found', async () => {
      mockPerformanceService.getCachedQueueState.mockResolvedValueOnce(null);
      mockPersistenceService.loadQueue.mockResolvedValueOnce(null);
      
      const result = await service.loadPlayerQueue('non-existent-player');
      
      expect(result).toBeNull();
    });
  });

  describe('Queue Saving with Optimizations', () => {
    it('should cache queue immediately and batch persistence', async () => {
      const updatedQueue = { ...mockQueue, version: 2 };
      
      await service.savePlayerQueue('test-player', updatedQueue);
      
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalledWith('test-player', updatedQueue);
      expect(mockPerformanceService.addToBatch).toHaveBeenCalled();
    });

    it('should save immediately when batching disabled', async () => {
      const immediateService = new OptimizedTaskQueueService(mockPersistenceService as any, {
        enableCaching: true,
        enableBatching: false,
        enableConnectionPooling: true,
        cacheStrategy: 'adaptive',
        batchStrategy: 'immediate',
      });

      const updatedQueue = { ...mockQueue, version: 2 };
      
      await immediateService.savePlayerQueue('test-player', updatedQueue);
      
      expect(mockPersistenceService.saveQueueWithAtomicUpdate).toHaveBeenCalledWith(updatedQueue);
    });
  });

  describe('Task Management', () => {
    it('should add task with validation and caching', async () => {
      mockPerformanceService.getCachedQueueState.mockResolvedValueOnce(mockQueue);
      
      await service.addTask('test-player', mockTask, mockPlayerStats, 15, {});
      
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalled();
      expect(mockPerformanceService.cacheTaskProgress).toHaveBeenCalled();
    });

    it('should create new queue if none exists', async () => {
      mockPerformanceService.getCachedQueueState.mockResolvedValueOnce(null);
      mockPersistenceService.loadQueue.mockResolvedValueOnce(null);
      
      await service.addTask('new-player', mockTask, mockPlayerStats, 15, {});
      
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalled();
    });

    it('should start task automatically if queue is empty', async () => {
      const emptyQueue = { ...mockQueue, queuedTasks: [], currentTask: null, isRunning: false };
      mockPerformanceService.getCachedQueueState.mockResolvedValueOnce(emptyQueue);
      
      await service.addTask('test-player', mockTask, mockPlayerStats, 15, {});
      
      // Should have started the task
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalledWith(
        'test-player',
        expect.objectContaining({
          currentTask: mockTask,
          isRunning: true,
        })
      );
    });
  });

  describe('Progress Updates with Caching', () => {
    it('should update progress and cache it', async () => {
      const runningQueue = { 
        ...mockQueue, 
        currentTask: mockTask, 
        isRunning: true,
        queuedTasks: [mockTask]
      };
      
      // Mock the active queue
      service['activeQueues'].set('test-player', runningQueue);
      
      await service.updateTaskProgress('test-player', 'test-task-1', 0.5);
      
      expect(mockPerformanceService.cacheTaskProgress).toHaveBeenCalledWith(
        'test-task-1',
        expect.objectContaining({
          taskId: 'test-task-1',
          progress: 0.5,
          isComplete: false,
        })
      );
    });

    it('should batch progress updates for non-milestone values', async () => {
      const runningQueue = { 
        ...mockQueue, 
        currentTask: mockTask, 
        isRunning: true,
        queuedTasks: [mockTask]
      };
      
      service['activeQueues'].set('test-player', runningQueue);
      
      await service.updateTaskProgress('test-player', 'test-task-1', 0.3);
      
      // Should batch the update (not save immediately)
      expect(mockPerformanceService.addToBatch).toHaveBeenCalled();
    });

    it('should save immediately for milestone progress', async () => {
      const runningQueue = { 
        ...mockQueue, 
        currentTask: mockTask, 
        isRunning: true,
        queuedTasks: [mockTask]
      };
      
      service['activeQueues'].set('test-player', runningQueue);
      
      await service.updateTaskProgress('test-player', 'test-task-1', 0.5);
      
      // Should save milestone immediately
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalled();
    });
  });

  describe('Task Completion', () => {
    it('should complete task and update statistics', async () => {
      const completedTask = { ...mockTask, progress: 1.0, completed: true };
      const runningQueue = { 
        ...mockQueue, 
        currentTask: completedTask, 
        isRunning: true,
        queuedTasks: [completedTask]
      };
      
      service['activeQueues'].set('test-player', runningQueue);
      
      const rewards = [{ type: 'experience', quantity: 50 }];
      const result = await service.completeTask('test-player', 'test-task-1', rewards);
      
      expect(result.task.completed).toBe(true);
      expect(result.rewards).toEqual(rewards);
      expect(mockPerformanceService.cacheFrequentData).toHaveBeenCalled();
    });

    it('should move to next task after completion', async () => {
      const task1 = { ...mockTask, id: 'task-1' };
      const task2 = { ...mockTask, id: 'task-2' };
      const runningQueue = { 
        ...mockQueue, 
        currentTask: task1, 
        isRunning: true,
        queuedTasks: [task1, task2]
      };
      
      service['activeQueues'].set('test-player', runningQueue);
      
      const result = await service.completeTask('test-player', 'task-1', []);
      
      expect(result.nextTask?.id).toBe('task-2');
    });

    it('should stop running when no more tasks', async () => {
      const runningQueue = { 
        ...mockQueue, 
        currentTask: mockTask, 
        isRunning: true,
        queuedTasks: [mockTask]
      };
      
      service['activeQueues'].set('test-player', runningQueue);
      
      await service.completeTask('test-player', 'test-task-1', []);
      
      // Should have stopped running
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalledWith(
        'test-player',
        expect.objectContaining({
          currentTask: null,
          isRunning: false,
        })
      );
    });
  });

  describe('Queue Status', () => {
    it('should get status from active queues first', async () => {
      service['activeQueues'].set('test-player', mockQueue);
      
      const status = await service.getQueueStatus('test-player');
      
      expect(status.currentTask).toEqual(mockQueue.currentTask);
      expect(status.queueLength).toBe(mockQueue.queuedTasks.length);
      expect(status.isRunning).toBe(mockQueue.isRunning);
      expect(status.totalCompleted).toBe(mockQueue.totalTasksCompleted);
    });

    it('should load queue if not in active queues', async () => {
      mockPerformanceService.getCachedQueueState.mockResolvedValueOnce(mockQueue);
      
      const status = await service.getQueueStatus('test-player');
      
      expect(mockPerformanceService.getCachedQueueState).toHaveBeenCalledWith('test-player');
      expect(status.currentTask).toEqual(mockQueue.currentTask);
    });

    it('should return empty status for non-existent queue', async () => {
      mockPerformanceService.getCachedQueueState.mockResolvedValueOnce(null);
      mockPersistenceService.loadQueue.mockResolvedValueOnce(null);
      
      const status = await service.getQueueStatus('non-existent-player');
      
      expect(status.currentTask).toBeNull();
      expect(status.queueLength).toBe(0);
      expect(status.isRunning).toBe(false);
      expect(status.totalCompleted).toBe(0);
    });
  });

  describe('Task Removal', () => {
    it('should remove task from queue', async () => {
      const task1 = { ...mockTask, id: 'task-1' };
      const task2 = { ...mockTask, id: 'task-2' };
      const queueWithTasks = { 
        ...mockQueue, 
        queuedTasks: [task1, task2]
      };
      
      service['activeQueues'].set('test-player', queueWithTasks);
      
      await service.removeTask('test-player', 'task-1');
      
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalledWith(
        'test-player',
        expect.objectContaining({
          queuedTasks: [task2],
        })
      );
    });

    it('should move to next task when removing current task', async () => {
      const task1 = { ...mockTask, id: 'task-1' };
      const task2 = { ...mockTask, id: 'task-2' };
      const queueWithTasks = { 
        ...mockQueue, 
        currentTask: task1,
        queuedTasks: [task1, task2],
        isRunning: true
      };
      
      service['activeQueues'].set('test-player', queueWithTasks);
      
      await service.removeTask('test-player', 'task-1');
      
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalledWith(
        'test-player',
        expect.objectContaining({
          currentTask: task2,
          isRunning: true,
        })
      );
    });
  });

  describe('Stop All Tasks', () => {
    it('should stop all tasks and clear queue', async () => {
      const runningQueue = { 
        ...mockQueue, 
        currentTask: mockTask, 
        isRunning: true,
        queuedTasks: [mockTask]
      };
      
      service['activeQueues'].set('test-player', runningQueue);
      
      await service.stopAllTasks('test-player');
      
      expect(mockPersistenceService.saveQueueWithAtomicUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          currentTask: null,
          isRunning: false,
          isPaused: false,
          queuedTasks: [],
        })
      );
    });
  });

  describe('Batch Operations', () => {
    it('should process multiple operations efficiently', async () => {
      const operations = [
        { type: 'add' as const, playerId: 'player-1', data: mockTask },
        { type: 'remove' as const, playerId: 'player-1', taskId: 'task-to-remove' },
        { type: 'update' as const, playerId: 'player-2', taskId: 'task-to-update', data: { progress: 0.5 } },
      ];

      mockPerformanceService.getCachedQueueState.mockResolvedValue(mockQueue);
      
      await service.batchOperations(operations);
      
      // Should have processed operations for each player
      expect(mockPerformanceService.cacheActiveQueueState).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    it('should provide performance statistics', () => {
      mockPerformanceService.getCacheStats.mockReturnValue(new Map());
      mockPerformanceService.getMemoryStats.mockReturnValue({
        heapUsed: 50000000,
        heapTotal: 100000000,
        external: 5000000,
        rss: 120000000,
        cacheSize: 100,
        connectionPoolSize: 5,
        batchQueueSize: 10,
      });
      mockPerformanceService.getBatchStats.mockReturnValue({
        queueSizes: new Map(),
        activeBatches: 2,
        totalPendingOperations: 15,
      });

      const stats = service.getPerformanceStats();
      
      expect(stats).toHaveProperty('activeQueues');
      expect(stats).toHaveProperty('cacheStats');
      expect(stats).toHaveProperty('memoryStats');
      expect(stats).toHaveProperty('batchStats');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const runningQueue = { ...mockQueue, version: 2 };
      service['activeQueues'].set('test-player', runningQueue);
      
      await service.shutdown();
      
      expect(mockPersistenceService.saveQueueWithAtomicUpdate).toHaveBeenCalledWith(runningQueue);
      expect(mockPerformanceService.shutdown).toHaveBeenCalled();
    });
  });
});