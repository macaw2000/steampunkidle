/**
 * Queue State Manager Tests
 */

import { queueStateManager } from '../queueStateManager';
import { TaskQueue, TaskType, Task } from '../../types/taskQueue';
import { DatabaseService } from '../databaseService';

// Mock DatabaseService
jest.mock('../databaseService', () => ({
  DatabaseService: {
    getItem: jest.fn(),
    putItem: jest.fn(),
    updateItem: jest.fn(),
    scan: jest.fn(),
  },
  TABLE_NAMES: {
    TASK_QUEUES: 'task-queues',
    CHARACTERS: 'characters',
  },
}));

const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

describe('QueueStateManager', () => {
  const testPlayerId = 'test-player-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveState', () => {
    it('should save queue state with updated version and checksum', async () => {
      const queue: TaskQueue = createTestQueue(testPlayerId);
      
      mockDatabaseService.putItem.mockResolvedValue(undefined);

      await queueStateManager.saveState(queue);

      expect(mockDatabaseService.putItem).toHaveBeenCalledWith({
        TableName: 'task-queues',
        Item: expect.objectContaining({
          playerId: testPlayerId,
          version: expect.any(Number),
          checksum: expect.any(String),
          lastUpdated: expect.any(Number),
        }),
        ConditionExpression: expect.any(String),
        ExpressionAttributeValues: expect.any(Object),
      });
    });

    it('should add state snapshot to history', async () => {
      const queue: TaskQueue = createTestQueue(testPlayerId);
      queue.stateHistory = [];
      
      mockDatabaseService.putItem.mockResolvedValue(undefined);

      await queueStateManager.saveState(queue);

      expect(queue.stateHistory).toHaveLength(1);
      expect(queue.stateHistory[0]).toMatchObject({
        timestamp: expect.any(Number),
        currentTaskId: null,
        queuedTaskIds: [],
        isRunning: false,
        isPaused: false,
        totalTasksCompleted: 0,
        checksum: expect.any(String),
      });
    });

    it('should limit history size', async () => {
      const queue: TaskQueue = createTestQueue(testPlayerId);
      queue.maxHistorySize = 2;
      queue.stateHistory = [
        createTestSnapshot(1),
        createTestSnapshot(2),
      ];
      
      mockDatabaseService.putItem.mockResolvedValue(undefined);

      await queueStateManager.saveState(queue);

      expect(queue.stateHistory).toHaveLength(2);
      expect(queue.stateHistory[0].timestamp).toBe(2);
    });
  });

  describe('loadState', () => {
    it('should load and validate queue state', async () => {
      const queue = createTestQueue(testPlayerId);
      mockDatabaseService.getItem.mockResolvedValue(queue);

      const result = await queueStateManager.loadState(testPlayerId);

      expect(result).toEqual(queue);
      expect(mockDatabaseService.getItem).toHaveBeenCalledWith({
        TableName: 'task-queues',
        Key: { playerId: testPlayerId },
      });
    });

    it('should return null if queue not found', async () => {
      mockDatabaseService.getItem.mockResolvedValue(null);

      const result = await queueStateManager.loadState(testPlayerId);

      expect(result).toBeNull();
    });

    it('should repair queue if validation fails but can be repaired', async () => {
      const corruptedQueue = createTestQueue(testPlayerId);
      corruptedQueue.checksum = 'invalid-checksum';
      corruptedQueue.totalTasksCompleted = -1; // Invalid value
      
      mockDatabaseService.getItem.mockResolvedValue(corruptedQueue);
      mockDatabaseService.putItem.mockResolvedValue(undefined);

      const result = await queueStateManager.loadState(testPlayerId);

      expect(result).toBeDefined();
      expect(result!.totalTasksCompleted).toBe(0); // Should be repaired
      expect(result!.checksum).not.toBe('invalid-checksum'); // Should be recalculated
    });
  });

  describe('validateState', () => {
    it('should validate a correct queue state', async () => {
      const queue = createTestQueue(testPlayerId);
      // The queue already has a correct checksum from createTestQueue
      
      const result = await queueStateManager.validateState(queue);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.integrityScore).toBeGreaterThan(0.8);
    });

    it('should detect missing player ID', async () => {
      const queue = createTestQueue('');
      
      const result = await queueStateManager.validateState(queue);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_PLAYER_ID',
          severity: 'critical',
        })
      );
    });

    it('should detect checksum mismatch', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.checksum = 'invalid-checksum';
      
      const result = await queueStateManager.validateState(queue);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'CHECKSUM_MISMATCH',
          severity: 'major',
        })
      );
    });

    it('should detect negative statistics', async () => {
      const queue = createTestQueue(testPlayerId);
      queue.totalTasksCompleted = -5;
      queue.totalTimeSpent = -1000;
      
      const result = await queueStateManager.validateState(queue);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'NEGATIVE_COMPLETED_TASKS',
          severity: 'minor',
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'NEGATIVE_TIME_SPENT',
          severity: 'minor',
        })
      );
    });
  });

  describe('repairState', () => {
    it('should repair negative statistics', async () => {
      const queue = createTestQueue(testPlayerId);
      const originalVersion = queue.version;
      queue.totalTasksCompleted = -5;
      queue.totalTimeSpent = -1000;
      
      mockDatabaseService.putItem.mockResolvedValue(undefined);

      const result = await queueStateManager.repairState(queue);

      expect(result.totalTasksCompleted).toBe(0);
      expect(result.totalTimeSpent).toBe(0);
      expect(result.version).toBeGreaterThan(originalVersion);
    });

    it('should fix invalid timestamps', async () => {
      const queue = createTestQueue(testPlayerId);
      const futureTime = Date.now() + 86400000; // 1 day in future
      queue.createdAt = futureTime;
      queue.lastUpdated = futureTime;
      
      mockDatabaseService.putItem.mockResolvedValue(undefined);

      const result = await queueStateManager.repairState(queue);

      expect(result.createdAt).toBeLessThanOrEqual(Date.now());
      expect(result.lastUpdated).toBeLessThanOrEqual(Date.now());
    });

    it('should update checksum after repair', async () => {
      const queue = createTestQueue(testPlayerId);
      const originalChecksum = queue.checksum;
      queue.totalTasksCompleted = -1; // This will be repaired
      
      mockDatabaseService.putItem.mockResolvedValue(undefined);

      const result = await queueStateManager.repairState(queue);

      expect(result.checksum).not.toBe(originalChecksum);
      expect(result.checksum).toBeDefined();
    });
  });

  describe('atomicUpdate', () => {
    it('should perform atomic update with retry on version conflict', async () => {
      const queue = createTestQueue(testPlayerId);
      
      // Mock getItem to return the queue each time
      mockDatabaseService.getItem.mockResolvedValue(queue);
      
      // First putItem call fails with version conflict, second succeeds
      const versionError = new Error('ConditionalCheckFailedException');
      versionError.name = 'ConditionalCheckFailedException';
      
      mockDatabaseService.putItem
        .mockRejectedValueOnce(versionError)
        .mockResolvedValueOnce(undefined);

      const updateFn = jest.fn((q: TaskQueue) => {
        const updated = { ...q };
        updated.totalTasksCompleted += 1;
        // Recalculate checksum for the updated queue
        updated.checksum = calculateTestChecksum(updated);
        return updated;
      });

      const result = await queueStateManager.atomicUpdate(testPlayerId, updateFn);

      expect(updateFn).toHaveBeenCalledTimes(2); // Called twice due to retry
      expect(result.totalTasksCompleted).toBe(1);
      expect(mockDatabaseService.getItem).toHaveBeenCalledTimes(2);
    });

    it('should fail after maximum retries', async () => {
      const queue = createTestQueue(testPlayerId);
      
      mockDatabaseService.getItem.mockResolvedValue(queue);
      
      const versionError = new Error('ConditionalCheckFailedException');
      versionError.name = 'ConditionalCheckFailedException';
      mockDatabaseService.putItem.mockRejectedValue(versionError);

      const updateFn = jest.fn((q: TaskQueue) => ({ ...q }));

      await expect(
        queueStateManager.atomicUpdate(testPlayerId, updateFn)
      ).rejects.toThrow('Atomic update failed');

      expect(updateFn).toHaveBeenCalledTimes(3); // Maximum retry attempts
    });
  });

  describe('createSnapshot', () => {
    it('should create accurate state snapshot', () => {
      const queue = createTestQueue(testPlayerId);
      const task = createTestTask('task-1', TaskType.HARVESTING);
      queue.currentTask = task;
      queue.queuedTasks = [createTestTask('task-2', TaskType.COMBAT)];
      queue.isRunning = true;
      queue.isPaused = false;
      queue.totalTasksCompleted = 5;

      const snapshot = queueStateManager.createSnapshot(queue);

      expect(snapshot).toMatchObject({
        timestamp: expect.any(Number),
        currentTaskId: 'task-1',
        queuedTaskIds: ['task-2'],
        isRunning: true,
        isPaused: false,
        totalTasksCompleted: 5,
        checksum: expect.any(String),
      });
    });

    it('should handle empty queue', () => {
      const queue = createTestQueue(testPlayerId);

      const snapshot = queueStateManager.createSnapshot(queue);

      expect(snapshot).toMatchObject({
        currentTaskId: null,
        queuedTaskIds: [],
        isRunning: false,
        isPaused: false,
        totalTasksCompleted: 0,
      });
    });
  });
});

// Helper functions
function createTestQueue(playerId: string): TaskQueue {
  const now = Date.now();
  
  const queue: TaskQueue = {
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
    checksum: '',
    lastValidated: now,
    stateHistory: [],
    maxHistorySize: 10,
  };
  
  // Calculate correct checksum
  queue.checksum = calculateTestChecksum(queue);
  
  return queue;
}

function calculateTestChecksum(queue: TaskQueue): string {
  // Use crypto to match the actual implementation
  const crypto = require('crypto');
  
  // Replicate the checksum calculation from the service
  const criticalData = {
    playerId: queue.playerId,
    currentTaskId: queue.currentTask?.id || null,
    queuedTaskIds: queue.queuedTasks.map(task => task.id).sort(),
    isRunning: queue.isRunning,
    isPaused: queue.isPaused,
    totalTasksCompleted: queue.totalTasksCompleted,
    totalTimeSpent: queue.totalTimeSpent,
    version: queue.version || 0
  };

  const dataString = JSON.stringify(criticalData);
  return crypto
    .createHash('sha256')
    .update(dataString)
    .digest('hex');
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

function createTestSnapshot(timestamp: number) {
  return {
    timestamp,
    currentTaskId: null,
    queuedTaskIds: [],
    isRunning: false,
    isPaused: false,
    totalTasksCompleted: 0,
    checksum: 'test-checksum',
  };
}