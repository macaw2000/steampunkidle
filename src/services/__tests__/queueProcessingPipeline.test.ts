/**
 * Queue Processing Pipeline Tests
 * Tests FIFO processing, priority support, prerequisite validation, and retry logic
 */

import { queueProcessingPipeline, QueueProcessingPipeline } from '../queueProcessingPipeline';
import { queueStateManager } from '../queueStateManager';
import { taskValidation } from '../taskValidation';
import {
  Task,
  TaskQueue,
  TaskType,
  TaskReward,
  TaskPrerequisite,
  ResourceRequirement,
  TaskValidationResult
} from '../../types/taskQueue';

// Mock dependencies
jest.mock('../queueStateManager', () => ({
  queueStateManager: {
    atomicUpdate: jest.fn(),
    loadState: jest.fn(),
    saveState: jest.fn(),
    validateState: jest.fn(),
    repairState: jest.fn(),
    createSnapshot: jest.fn()
  }
}));

jest.mock('../taskValidation', () => ({
  taskValidation: {
    validateTask: jest.fn()
  }
}));

const mockQueueStateManager = queueStateManager as jest.Mocked<typeof queueStateManager>;
const mockTaskValidation = taskValidation as jest.Mocked<typeof taskValidation>;

describe('QueueProcessingPipeline', () => {
  const testPlayerId = 'test-player-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockTaskValidation.validateTask.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: []
    } as TaskValidationResult);
  });

  describe('processQueue', () => {
    it('should process empty queue without errors', async () => {
      const emptyQueue = createTestQueue(testPlayerId, []);
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return await updateFn(emptyQueue);
      });

      const result = await queueProcessingPipeline.processQueue(testPlayerId);

      expect(result).toBeDefined();
      expect(result.playerId).toBe(testPlayerId);
      expect(result.currentTask).toBeNull();
      expect(result.queuedTasks).toHaveLength(0);
    });

    it('should start first task when queue is not empty and no current task', async () => {
      const task1 = createTestTask('task-1', TaskType.HARVESTING, 5000);
      const task2 = createTestTask('task-2', TaskType.CRAFTING, 3000);
      const queue = createTestQueue(testPlayerId, [task1, task2]);

      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return await updateFn(queue);
      });

      const result = await queueProcessingPipeline.processQueue(testPlayerId);

      expect(result.currentTask).toBeDefined();
      expect(result.currentTask?.id).toBe('task-1');
      expect(result.queuedTasks).toHaveLength(1);
      expect(result.queuedTasks[0].id).toBe('task-2');
      expect(result.isRunning).toBe(true);
    });

    it('should complete current task when duration elapsed', async () => {
      const completedTask = createTestTask('completed-task', TaskType.HARVESTING, 1000);
      completedTask.startTime = Date.now() - 2000; // Started 2 seconds ago, duration 1 second
      
      const queue = createTestQueue(testPlayerId, []);
      queue.currentTask = completedTask;
      queue.isRunning = true;

      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return await updateFn(queue);
      });

      const result = await queueProcessingPipeline.processQueue(testPlayerId);

      expect(result.currentTask).toBeNull();
      expect(result.isRunning).toBe(false);
      expect(result.totalTasksCompleted).toBe(1);
      expect(result.totalRewardsEarned.length).toBeGreaterThan(0);
    });

    it('should not process paused queue', async () => {
      const task = createTestTask('paused-task', TaskType.HARVESTING, 5000);
      const queue = createTestQueue(testPlayerId, [task]);
      queue.isPaused = true;
      queue.pauseReason = 'Test pause';

      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return await updateFn(queue);
      });

      const result = await queueProcessingPipeline.processQueue(testPlayerId);

      expect(result.isPaused).toBe(true);
      expect(result.currentTask).toBeNull();
      expect(result.queuedTasks).toHaveLength(1);
    });

    it('should handle priority tasks correctly', async () => {
      const lowPriorityTask = createTestTask('low-priority', TaskType.HARVESTING, 5000, 1);
      const highPriorityTask = createTestTask('high-priority', TaskType.COMBAT, 3000, 5);
      const mediumPriorityTask = createTestTask('medium-priority', TaskType.CRAFTING, 4000, 3);
      
      const queue = createTestQueue(testPlayerId, [lowPriorityTask, highPriorityTask, mediumPriorityTask]);
      queue.config.priorityHandling = true;

      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return await updateFn(queue);
      });

      const result = await queueProcessingPipeline.processQueue(testPlayerId);

      // Should start highest priority task first
      expect(result.currentTask?.id).toBe('high-priority');
      expect(result.queuedTasks).toHaveLength(2);
    });
  });

  describe('validatePrerequisites', () => {
    it('should return true when all prerequisites are met', async () => {
      const task = createTestTask('test-task', TaskType.HARVESTING, 5000);
      task.prerequisites = [
        {
          type: 'level',
          requirement: 5,
          description: 'Level 5 required',
          isMet: false
        }
      ];
      task.resourceRequirements = [
        {
          resourceId: 'wood',
          resourceName: 'Wood',
          quantityRequired: 10,
          quantityAvailable: 15,
          isSufficient: false
        }
      ];

      // Mock prerequisite checks to return true
      jest.spyOn(queueProcessingPipeline as any, 'checkPrerequisite').mockResolvedValue(true);
      jest.spyOn(queueProcessingPipeline as any, 'checkResourceRequirement').mockResolvedValue(true);

      const result = await queueProcessingPipeline.validatePrerequisites(task);

      expect(result).toBe(true);
      expect(task.prerequisites[0].isMet).toBe(true);
      expect(task.resourceRequirements[0].isSufficient).toBe(true);
    });

    it('should return false when prerequisites are not met', async () => {
      const task = createTestTask('test-task', TaskType.HARVESTING, 5000);
      task.prerequisites = [
        {
          type: 'level',
          requirement: 10,
          description: 'Level 10 required',
          isMet: false
        }
      ];

      // Mock prerequisite check to return false
      jest.spyOn(queueProcessingPipeline as any, 'checkPrerequisite').mockResolvedValue(false);

      const result = await queueProcessingPipeline.validatePrerequisites(task);

      expect(result).toBe(false);
      expect(task.prerequisites[0].isMet).toBe(false);
    });

    it('should return false when resource requirements are not met', async () => {
      const task = createTestTask('test-task', TaskType.CRAFTING, 5000);
      task.resourceRequirements = [
        {
          resourceId: 'iron',
          resourceName: 'Iron',
          quantityRequired: 20,
          quantityAvailable: 5,
          isSufficient: false
        }
      ];

      // Mock resource check to return false
      jest.spyOn(queueProcessingPipeline as any, 'checkResourceRequirement').mockResolvedValue(false);

      const result = await queueProcessingPipeline.validatePrerequisites(task);

      expect(result).toBe(false);
      expect(task.resourceRequirements[0].isSufficient).toBe(false);
    });
  });

  describe('handleTaskFailure', () => {
    it('should increment retry count and reset task for retry', async () => {
      const task = createTestTask('failing-task', TaskType.COMBAT, 5000);
      task.retryCount = 1;
      task.maxRetries = 3;
      task.startTime = Date.now() - 1000;
      task.progress = 0.5;
      task.completed = false;

      const error = new Error('Task failed');
      await queueProcessingPipeline.handleTaskFailure(task, error);

      expect(task.retryCount).toBe(2);
      expect(task.progress).toBe(0);
      expect(task.completed).toBe(false);
      expect(task.startTime).toBeGreaterThan(Date.now()); // Should be scheduled for future
    });

    it('should not retry task when max retries exceeded', async () => {
      const task = createTestTask('failing-task', TaskType.COMBAT, 5000);
      task.retryCount = 3;
      task.maxRetries = 3;
      task.startTime = Date.now() - 1000;
      task.progress = 0.5;
      task.completed = false;

      const error = new Error('Task failed permanently');
      await queueProcessingPipeline.handleTaskFailure(task, error);

      expect(task.retryCount).toBe(4);
      expect(task.progress).toBe(0);
      expect(task.completed).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff delay', () => {
      const delay1 = queueProcessingPipeline.calculateRetryDelay(1);
      const delay2 = queueProcessingPipeline.calculateRetryDelay(2);
      const delay3 = queueProcessingPipeline.calculateRetryDelay(3);

      expect(delay1).toBeGreaterThanOrEqual(1000); // Base delay
      expect(delay2).toBeGreaterThan(delay1); // Should increase
      expect(delay3).toBeGreaterThan(delay2); // Should continue increasing
      expect(delay3).toBeLessThanOrEqual(300000); // Should not exceed max delay
    });

    it('should cap delay at maximum value', () => {
      const delay = queueProcessingPipeline.calculateRetryDelay(10); // Very high retry count
      expect(delay).toBeLessThanOrEqual(300000); // Should be capped at max delay
    });
  });

  describe('pauseQueueOnPrerequisiteFailure', () => {
    it('should pause queue with reason', async () => {
      const queue = createTestQueue(testPlayerId, []);
      queue.isPaused = false;
      queue.isRunning = true;

      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return updateFn(queue);
      });

      const reason = 'Prerequisites not met';
      await queueProcessingPipeline.pauseQueueOnPrerequisiteFailure(testPlayerId, reason);

      expect(queue.isPaused).toBe(true);
      expect(queue.pauseReason).toBe(reason);
      expect(queue.canResume).toBe(true);
      expect(queue.isRunning).toBe(false);
      expect(queue.pausedAt).toBeDefined();
    });
  });

  describe('resumeQueueWhenReady', () => {
    it('should resume queue when prerequisites are met', async () => {
      const task = createTestTask('ready-task', TaskType.HARVESTING, 5000);
      const queue = createTestQueue(testPlayerId, [task]);
      queue.isPaused = true;
      queue.canResume = true;
      queue.pausedAt = Date.now() - 5000;

      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return await updateFn(queue);
      });

      // Mock prerequisite validation to return true
      jest.spyOn(queueProcessingPipeline, 'validatePrerequisites').mockResolvedValue(true);

      const result = await queueProcessingPipeline.resumeQueueWhenReady(testPlayerId);

      expect(result).toBe(true);
      expect(queue.isPaused).toBe(false);
      expect(queue.pauseReason).toBeUndefined();
      expect(queue.resumedAt).toBeDefined();
      expect(queue.totalPauseTime).toBeGreaterThan(0);
    });

    it('should not resume queue when prerequisites are still not met', async () => {
      const task = createTestTask('not-ready-task', TaskType.HARVESTING, 5000);
      const queue = createTestQueue(testPlayerId, [task]);
      queue.isPaused = true;
      queue.canResume = true;

      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return await updateFn(queue);
      });

      // Mock prerequisite validation to return false
      jest.spyOn(queueProcessingPipeline, 'validatePrerequisites').mockResolvedValue(false);

      const result = await queueProcessingPipeline.resumeQueueWhenReady(testPlayerId);

      expect(result).toBe(false);
      expect(queue.isPaused).toBe(true);
    });

    it('should not resume queue when canResume is false', async () => {
      const queue = createTestQueue(testPlayerId, []);
      queue.isPaused = true;
      queue.canResume = false;

      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return await updateFn(queue);
      });

      const result = await queueProcessingPipeline.resumeQueueWhenReady(testPlayerId);

      expect(result).toBe(false);
      expect(queue.isPaused).toBe(true);
    });
  });

  describe('processTask', () => {
    it('should process task successfully and return rewards', async () => {
      const task = createTestTask('process-task', TaskType.HARVESTING, 5000);

      const result = await queueProcessingPipeline.processTask(task);

      expect(result).toBeDefined();
      expect(result.task.completed).toBe(true);
      expect(result.task.progress).toBe(1.0);
      expect(result.rewards).toBeDefined();
      expect(result.rewards.length).toBeGreaterThan(0);
      expect(mockTaskValidation.validateTask).toHaveBeenCalledWith(task);
    });

    it('should throw error when task validation fails', async () => {
      const task = createTestTask('invalid-task', TaskType.HARVESTING, 5000);
      
      mockTaskValidation.validateTask.mockResolvedValue({
        isValid: false,
        errors: [{ code: 'INVALID_TASK', message: 'Task is invalid', severity: 'error' }],
        warnings: []
      } as TaskValidationResult);

      await expect(queueProcessingPipeline.processTask(task)).rejects.toThrow('Task validation failed');
    });
  });

  describe('concurrent processing protection', () => {
    it('should prevent concurrent processing of same queue', async () => {
      const queue = createTestQueue(testPlayerId, []);
      
      // Mock a slow atomic update
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return await updateFn(queue);
      });

      // Start two concurrent processes
      const promise1 = queueProcessingPipeline.processQueue(testPlayerId);
      const promise2 = queueProcessingPipeline.processQueue(testPlayerId);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should complete, but only one should have done the actual processing
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      
      // The atomic update should have been called only once for the actual processing
      expect(mockQueueStateManager.atomicUpdate).toHaveBeenCalledTimes(1);
    });
  });
});

// Helper functions
function createTestTask(
  id: string, 
  type: TaskType, 
  duration: number, 
  priority: number = 0
): Task {
  return {
    id,
    type,
    name: `Test ${type} Task`,
    description: `Test task for ${type}`,
    icon: 'test-icon',
    duration,
    startTime: 0,
    playerId: 'test-player-123',
    activityData: {} as any,
    prerequisites: [],
    resourceRequirements: [],
    progress: 0,
    completed: false,
    rewards: [],
    priority,
    estimatedCompletion: Date.now() + duration,
    retryCount: 0,
    maxRetries: 3,
    isValid: true,
    validationErrors: []
  };
}

function createTestQueue(playerId: string, tasks: Task[]): TaskQueue {
  return {
    playerId,
    currentTask: null,
    queuedTasks: tasks,
    isRunning: false,
    isPaused: false,
    canResume: true,
    totalTasksCompleted: 0,
    totalTimeSpent: 0,
    totalRewardsEarned: [],
    averageTaskDuration: 0,
    taskCompletionRate: 0,
    queueEfficiencyScore: 0,
    config: {
      maxQueueSize: 50,
      maxTaskDuration: 24 * 60 * 60 * 1000,
      maxTotalQueueDuration: 7 * 24 * 60 * 60 * 1000,
      autoStart: true,
      priorityHandling: false,
      retryEnabled: true,
      maxRetries: 3,
      validationEnabled: true,
      syncInterval: 5000,
      offlineProcessingEnabled: true,
      pauseOnError: true,
      resumeOnResourceAvailable: true,
      persistenceInterval: 30000,
      integrityCheckInterval: 300000,
      maxHistorySize: 10
    },
    lastUpdated: Date.now(),
    lastSynced: Date.now(),
    createdAt: Date.now(),
    version: 1,
    checksum: 'test-checksum',
    lastValidated: Date.now(),
    stateHistory: [],
    maxHistorySize: 10
  };
}