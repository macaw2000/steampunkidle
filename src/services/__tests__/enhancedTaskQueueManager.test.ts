/**
 * Enhanced Task Queue Manager Tests
 */

import { enhancedTaskQueueManager } from '../enhancedTaskQueueManager';
import { queueStateManager } from '../queueStateManager';
import { TaskQueue, TaskType, Task, TaskQueueConfiguration } from '../../types/taskQueue';

// Mock queueStateManager
jest.mock('../queueStateManager', () => ({
  queueStateManager: {
    loadState: jest.fn(),
    saveState: jest.fn(),
    validateState: jest.fn(),
    repairState: jest.fn(),
    createSnapshot: jest.fn(),
    atomicUpdate: jest.fn(),
  },
}));

const mockQueueStateManager = queueStateManager as jest.Mocked<typeof queueStateManager>;

describe('EnhancedTaskQueueManager', () => {
  const testPlayerId = 'test-player-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addTask', () => {
    it('should add task to empty queue and start it', async () => {
      const queue = createTestQueue(testPlayerId);
      const task = createTestTask('task-1', TaskType.HARVESTING);
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return updateFn(queue);
      });

      await enhancedTaskQueueManager.addTask(testPlayerId, task);

      expect(mockQueueStateManager.atomicUpdate).toHaveBeenCalledWith(
        testPlayerId,
        expect.any(Function)
      );
    });

    it('should add task to queue when current task exists', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.currentTask = createTestTask('current-task', TaskType.COMBAT);
      const newTask = createTestTask('task-1', TaskType.HARVESTING);
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.queuedTasks).toContain(newTask);
        expect(updatedQueue.currentTask?.id).toBe('current-task');
        return updatedQueue;
      });

      await enhancedTaskQueueManager.addTask(testPlayerId, newTask);
    });

    it('should reject task if queue is full', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.config.maxQueueSize = 1;
      queue.queuedTasks = [createTestTask('existing-task', TaskType.COMBAT)];
      const newTask = createTestTask('task-1', TaskType.HARVESTING);
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return updateFn(queue);
      });

      await expect(
        enhancedTaskQueueManager.addTask(testPlayerId, newTask)
      ).rejects.toThrow('Queue is full');
    });

    it('should reject task if duration exceeds maximum', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.config.maxTaskDuration = 1000;
      const longTask = createTestTask('long-task', TaskType.HARVESTING);
      longTask.duration = 2000;
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return updateFn(queue);
      });

      await expect(
        enhancedTaskQueueManager.addTask(testPlayerId, longTask)
      ).rejects.toThrow('Task duration exceeds maximum allowed');
    });

    it('should handle priority insertion when priority handling is enabled', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.config.priorityHandling = true;
      queue.currentTask = createTestTask('current-task', TaskType.COMBAT);
      queue.queuedTasks = [
        { ...createTestTask('low-priority', TaskType.HARVESTING), priority: 1 },
        { ...createTestTask('medium-priority', TaskType.CRAFTING), priority: 5 },
      ];
      
      const highPriorityTask = { ...createTestTask('high-priority', TaskType.COMBAT), priority: 10 };
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.queuedTasks[0].id).toBe('high-priority');
        return updatedQueue;
      });

      await enhancedTaskQueueManager.addTask(testPlayerId, highPriorityTask);
    });
  });

  describe('removeTask', () => {
    it('should remove current task and start next task', async () => {
      const queue = createTestQueue(testPlayerId);
      const currentTask = createTestTask('current-task', TaskType.HARVESTING);
      const nextTask = createTestTask('next-task', TaskType.COMBAT);
      
      queue.currentTask = currentTask;
      queue.queuedTasks = [nextTask];
      queue.isRunning = true;
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.currentTask?.id).toBe('next-task');
        expect(updatedQueue.queuedTasks).toHaveLength(0);
        expect(updatedQueue.isRunning).toBe(true);
        return updatedQueue;
      });

      await enhancedTaskQueueManager.removeTask(testPlayerId, 'current-task');
    });

    it('should remove queued task without affecting current task', async () => {
      const queue = createTestQueue(testPlayerId);
      const currentTask = createTestTask('current-task', TaskType.HARVESTING);
      const taskToRemove = createTestTask('remove-me', TaskType.COMBAT);
      const keepTask = createTestTask('keep-me', TaskType.CRAFTING);
      
      queue.currentTask = currentTask;
      queue.queuedTasks = [taskToRemove, keepTask];
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.currentTask?.id).toBe('current-task');
        expect(updatedQueue.queuedTasks).toHaveLength(1);
        expect(updatedQueue.queuedTasks[0].id).toBe('keep-me');
        return updatedQueue;
      });

      await enhancedTaskQueueManager.removeTask(testPlayerId, 'remove-me');
    });
  });

  describe('pauseQueue', () => {
    it('should pause running queue with reason', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.isRunning = true;
      queue.isPaused = false;
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.isPaused).toBe(true);
        expect(updatedQueue.isRunning).toBe(false);
        expect(updatedQueue.pauseReason).toBe('Test pause');
        expect(updatedQueue.pausedAt).toBeDefined();
        expect(updatedQueue.canResume).toBe(true);
        return updatedQueue;
      });

      await enhancedTaskQueueManager.pauseQueue(testPlayerId, 'Test pause');
    });

    it('should use default reason when none provided', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.isRunning = true;
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.pauseReason).toBe('Manual pause');
        return updatedQueue;
      });

      await enhancedTaskQueueManager.pauseQueue(testPlayerId);
    });

    it('should handle already paused queue gracefully', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.isPaused = true;
      queue.pauseReason = 'Already paused';
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.pauseReason).toBe('Already paused'); // Should remain unchanged
        return updatedQueue;
      });

      await enhancedTaskQueueManager.pauseQueue(testPlayerId, 'New reason');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already paused')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('resumeQueue', () => {
    it('should resume paused queue', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.isPaused = true;
      queue.pauseReason = 'Test pause';
      queue.canResume = true;
      queue.currentTask = createTestTask('current-task', TaskType.HARVESTING);
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.isPaused).toBe(false);
        expect(updatedQueue.pauseReason).toBeUndefined();
        expect(updatedQueue.isRunning).toBe(true);
        expect(updatedQueue.resumedAt).toBeDefined();
        return updatedQueue;
      });

      await enhancedTaskQueueManager.resumeQueue(testPlayerId);
    });

    it('should not resume if canResume is false', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.isPaused = true;
      queue.canResume = false;
      queue.pauseReason = 'Cannot resume';
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return updateFn(queue);
      });

      await expect(
        enhancedTaskQueueManager.resumeQueue(testPlayerId)
      ).rejects.toThrow('Queue cannot be resumed: Cannot resume');
    });

    it('should handle non-paused queue gracefully', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.isPaused = false;
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return updateFn(queue);
      });

      await enhancedTaskQueueManager.resumeQueue(testPlayerId);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not paused')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('updateQueueConfig', () => {
    it('should update queue configuration', async () => {
      const queue = createTestQueue(testPlayerId);
      const configUpdate: Partial<TaskQueueConfiguration> = {
        maxQueueSize: 100,
        autoStart: false,
        priorityHandling: true,
      };
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.config.maxQueueSize).toBe(100);
        expect(updatedQueue.config.autoStart).toBe(false);
        expect(updatedQueue.config.priorityHandling).toBe(true);
        return updatedQueue;
      });

      await enhancedTaskQueueManager.updateQueueConfig(testPlayerId, configUpdate);
    });

    it('should truncate queue if new max size is smaller', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.queuedTasks = [
        createTestTask('task-1', TaskType.HARVESTING),
        createTestTask('task-2', TaskType.COMBAT),
        createTestTask('task-3', TaskType.CRAFTING),
      ];
      
      const configUpdate: Partial<TaskQueueConfiguration> = {
        maxQueueSize: 2,
      };
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.queuedTasks).toHaveLength(2);
        expect(updatedQueue.queuedTasks[0].id).toBe('task-1');
        expect(updatedQueue.queuedTasks[1].id).toBe('task-2');
        return updatedQueue;
      });

      await enhancedTaskQueueManager.updateQueueConfig(testPlayerId, configUpdate);
    });

    it('should reject invalid configuration', async () => {
      const queue = createTestQueue(testPlayerId);
      const invalidConfig: Partial<TaskQueueConfiguration> = {
        maxQueueSize: -1, // Invalid
      };
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        return updateFn(queue);
      });

      await expect(
        enhancedTaskQueueManager.updateQueueConfig(testPlayerId, invalidConfig)
      ).rejects.toThrow('Max queue size must be positive');
    });
  });

  describe('getQueueHealth', () => {
    it('should return healthy status for normal queue', async () => {
      const queue = createTestQueue(testPlayerId);
      
      mockQueueStateManager.loadState.mockResolvedValue(queue);
      mockQueueStateManager.validateState.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 1.0,
        canRepair: false,
        repairActions: [],
      });

      const health = await enhancedTaskQueueManager.getQueueHealth(testPlayerId);

      expect(health.overall).toBe('healthy');
      expect(health.issues).toHaveLength(0);
      expect(health.recommendations).toHaveLength(0);
    });

    it('should detect queue nearly full warning', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.config.maxQueueSize = 10;
      queue.queuedTasks = Array(9).fill(null).map((_, i) => 
        createTestTask(`task-${i}`, TaskType.HARVESTING)
      );
      
      mockQueueStateManager.loadState.mockResolvedValue(queue);
      mockQueueStateManager.validateState.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 1.0,
        canRepair: false,
        repairActions: [],
      });

      const health = await enhancedTaskQueueManager.getQueueHealth(testPlayerId);

      expect(health.overall).toBe('warning');
      expect(health.issues).toContainEqual(
        expect.objectContaining({
          type: 'performance',
          severity: 'medium',
          message: 'Queue is nearly full',
        })
      );
    });

    it('should detect long-running task issue', async () => {
      const queue = createTestQueue(testPlayerId);
      const longRunningTask = createTestTask('long-task', TaskType.HARVESTING);
      longRunningTask.startTime = Date.now() - (queue.config.maxTaskDuration * 0.95);
      queue.currentTask = longRunningTask;
      
      mockQueueStateManager.loadState.mockResolvedValue(queue);
      mockQueueStateManager.validateState.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 1.0,
        canRepair: false,
        repairActions: [],
      });

      const health = await enhancedTaskQueueManager.getQueueHealth(testPlayerId);

      expect(health.overall).toBe('warning');
      expect(health.issues).toContainEqual(
        expect.objectContaining({
          type: 'performance',
          severity: 'high',
          message: 'Current task is taking longer than expected',
        })
      );
    });

    it('should detect data integrity issues', async () => {
      const queue = createTestQueue(testPlayerId);
      
      mockQueueStateManager.loadState.mockResolvedValue(queue);
      mockQueueStateManager.validateState.mockResolvedValue({
        isValid: false,
        errors: [
          {
            code: 'CHECKSUM_MISMATCH',
            message: 'Checksum validation failed',
            severity: 'major' as const,
          },
        ],
        warnings: [],
        integrityScore: 0.5,
        canRepair: true,
        repairActions: [],
      });

      const health = await enhancedTaskQueueManager.getQueueHealth(testPlayerId);

      expect(health.overall).toBe('warning');
      expect(health.issues).toContainEqual(
        expect.objectContaining({
          type: 'data_integrity',
          severity: 'medium',
          message: 'Queue validation failed: 1 errors',
        })
      );
    });
  });

  describe('clearQueue', () => {
    it('should clear all tasks and reset queue state', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.currentTask = createTestTask('current-task', TaskType.HARVESTING);
      queue.queuedTasks = [
        createTestTask('task-1', TaskType.COMBAT),
        createTestTask('task-2', TaskType.CRAFTING),
      ];
      queue.isRunning = true;
      queue.isPaused = true;
      queue.pauseReason = 'Test pause';
      
      mockQueueStateManager.atomicUpdate.mockImplementation(async (playerId, updateFn) => {
        const updatedQueue = updateFn(queue);
        expect(updatedQueue.currentTask).toBeNull();
        expect(updatedQueue.queuedTasks).toHaveLength(0);
        expect(updatedQueue.isRunning).toBe(false);
        expect(updatedQueue.isPaused).toBe(false);
        expect(updatedQueue.pauseReason).toBeUndefined();
        expect(updatedQueue.canResume).toBe(true);
        return updatedQueue;
      });

      await enhancedTaskQueueManager.clearQueue(testPlayerId);
    });
  });
});

// Helper functions
function createTestQueue(playerId: string): TaskQueue {
  const now = Date.now();
  
  return {
    playerId,
    currentTask: null,
    queuedTasks: [],
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
      maxTaskDuration: 86400000,
      maxTotalQueueDuration: 604800000,
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
      maxHistorySize: 10,
    },
    lastUpdated: now,
    lastSynced: now,
    createdAt: now,
    version: 1,
    checksum: 'test-checksum',
    lastValidated: now,
    stateHistory: [],
    maxHistorySize: 10,
  };
}

function createTestTask(id: string, type: TaskType): Task {
  return {
    id,
    type,
    name: `Test ${type} Task`,
    description: `Test task of type ${type}`,
    icon: 'test-icon',
    duration: 60000, // 1 minute
    startTime: Date.now(),
    playerId: 'test-player-123',
    activityData: {} as any,
    prerequisites: [],
    resourceRequirements: [],
    progress: 0,
    completed: false,
    rewards: [],
    priority: 0,
    estimatedCompletion: Date.now() + 60000,
    retryCount: 0,
    maxRetries: 3,
    isValid: true,
    validationErrors: [],
  };
}