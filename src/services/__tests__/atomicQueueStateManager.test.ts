/**
 * Atomic Queue State Manager Tests
 * Tests for atomic operations and distributed locking
 */

import { AtomicQueueStateManager, AtomicOperation, QueueLock } from '../atomicQueueStateManager';
import { TaskQueuePersistenceService } from '../taskQueuePersistence';
import { TaskQueue, TaskType } from '../../types/taskQueue';

// Mock the persistence service
jest.mock('../taskQueuePersistence');

describe('AtomicQueueStateManager', () => {
  let atomicManager: AtomicQueueStateManager;
  let mockPersistenceService: jest.Mocked<TaskQueuePersistenceService>;

  const mockQueue: TaskQueue = {
    playerId: 'test-player-1',
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
      maxHistorySize: 100
    },
    lastUpdated: Date.now(),
    lastSynced: Date.now(),
    createdAt: Date.now(),
    version: 1,
    checksum: 'test-checksum',
    lastValidated: Date.now(),
    stateHistory: [],
    maxHistorySize: 100
  };

  beforeEach(() => {
    mockPersistenceService = {
      loadQueue: jest.fn(),
      saveQueueWithAtomicUpdate: jest.fn(),
      validateQueueIntegrity: jest.fn(),
      createStateSnapshot: jest.fn(),
      restoreFromSnapshot: jest.fn(),
      getPlayerSnapshots: jest.fn()
    } as any;

    atomicManager = new AtomicQueueStateManager(mockPersistenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear any active locks
    atomicManager.getActiveLocks().forEach(lock => {
      atomicManager.forceReleaseLock(lock.playerId);
    });
  });

  describe('executeAtomicOperation', () => {
    it('should execute operation successfully', async () => {
      const operation: AtomicOperation<string> = {
        operation: (queue: TaskQueue) => {
          queue.totalTasksCompleted += 1;
          return 'success';
        }
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();

      const result = await atomicManager.executeAtomicOperation('test-player-1', operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.retryCount).toBe(0);
      expect(mockPersistenceService.loadQueue).toHaveBeenCalledWith('test-player-1');
      expect(mockPersistenceService.saveQueueWithAtomicUpdate).toHaveBeenCalled();
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation: AtomicOperation<string> = {
        operation: (queue: TaskQueue) => {
          queue.totalTasksCompleted += 1;
          return 'success';
        },
        retryCount: 3
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      
      // Fail twice, then succeed
      mockPersistenceService.saveQueueWithAtomicUpdate
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce();

      const result = await atomicManager.executeAtomicOperation('test-player-1', operation);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(mockPersistenceService.saveQueueWithAtomicUpdate).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const operation: AtomicOperation<string> = {
        operation: (queue: TaskQueue) => {
          queue.totalTasksCompleted += 1;
          return 'success';
        },
        retryCount: 2
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      mockPersistenceService.saveQueueWithAtomicUpdate.mockRejectedValue(new Error('Persistent failure'));

      const result = await atomicManager.executeAtomicOperation('test-player-1', operation);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Persistent failure');
      expect(result.retryCount).toBe(2);
    });

    it('should perform rollback on failure when requested', async () => {
      const operation: AtomicOperation<string> = {
        operation: (queue: TaskQueue) => {
          throw new Error('Operation failed');
        },
        rollbackOnFailure: true,
        retryCount: 1
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.getPlayerSnapshots.mockResolvedValue([{
        snapshotId: 'test-snapshot',
        playerId: 'test-player-1',
        timestamp: Date.now(),
        queueState: mockQueue,
        checksum: 'test-checksum',
        version: 1,
        metadata: { reason: 'periodic', size: 1000 }
      }]);
      mockPersistenceService.restoreFromSnapshot.mockResolvedValue(mockQueue);

      const result = await atomicManager.executeAtomicOperation('test-player-1', operation);

      expect(result.success).toBe(false);
      expect(result.rollbackPerformed).toBe(true);
      expect(mockPersistenceService.restoreFromSnapshot).toHaveBeenCalled();
    });

    it('should prevent concurrent operations on same player', async () => {
      const operation1: AtomicOperation<string> = {
        operation: async (queue: TaskQueue) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'operation1';
        }
      };

      const operation2: AtomicOperation<string> = {
        operation: (queue: TaskQueue) => 'operation2'
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();

      // Start first operation
      const promise1 = atomicManager.executeAtomicOperation('test-player-1', operation1);
      
      // Wait a bit to ensure first operation acquires lock
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Try to start second operation
      const promise2 = atomicManager.executeAtomicOperation('test-player-1', operation2);

      const [result1, result2] = await Promise.allSettled([promise1, promise2]);

      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('rejected');
    });

    it('should fail if queue not found', async () => {
      const operation: AtomicOperation<string> = {
        operation: (queue: TaskQueue) => 'success'
      };

      mockPersistenceService.loadQueue.mockResolvedValue(null);

      const result = await atomicManager.executeAtomicOperation('test-player-1', operation);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Queue not found');
    });

    it('should fail if queue validation fails', async () => {
      const operation: AtomicOperation<string> = {
        operation: (queue: TaskQueue) => {
          queue.totalTasksCompleted += 1;
          return 'success';
        }
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: false,
        errors: [{ code: 'TEST_ERROR', message: 'Test validation error', severity: 'critical' }],
        warnings: [],
        integrityScore: 0,
        canRepair: false,
        repairActions: []
      });

      const result = await atomicManager.executeAtomicOperation('test-player-1', operation);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Queue validation failed');
    });
  });

  describe('executeAtomicTransaction', () => {
    it('should execute multiple operations as transaction', async () => {
      const operations: AtomicOperation<string>[] = [
        {
          operation: (queue: TaskQueue) => {
            queue.totalTasksCompleted += 1;
            return 'op1';
          }
        },
        {
          operation: (queue: TaskQueue) => {
            queue.totalTimeSpent += 1000;
            return 'op2';
          }
        }
      ];

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();
      mockPersistenceService.createStateSnapshot.mockResolvedValue('snapshot-id');

      const result = await atomicManager.executeAtomicTransaction('test-player-1', operations);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(['op1', 'op2']);
      expect(mockPersistenceService.saveQueueWithAtomicUpdate).toHaveBeenCalledTimes(2);
      expect(mockPersistenceService.createStateSnapshot).toHaveBeenCalledTimes(1); // Final snapshot
    });

    it('should rollback entire transaction on failure', async () => {
      const operations: AtomicOperation<string>[] = [
        {
          operation: (queue: TaskQueue) => {
            queue.totalTasksCompleted += 1;
            return 'op1';
          }
        },
        {
          operation: (queue: TaskQueue) => {
            throw new Error('Operation 2 failed');
          }
        }
      ];

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();
      mockPersistenceService.createStateSnapshot.mockResolvedValue('snapshot-id');

      const result = await atomicManager.executeAtomicTransaction('test-player-1', operations);

      expect(result.success).toBe(false);
      expect(result.rollbackPerformed).toBe(true);
      expect(result.error?.message).toBe('Operation 2 failed');
    });
  });

  describe('lock management', () => {
    it('should acquire and release locks properly', async () => {
      const operation: AtomicOperation<string> = {
        operation: (queue: TaskQueue) => 'success'
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();

      // Check no locks initially
      expect(atomicManager.getActiveLocks()).toHaveLength(0);

      const resultPromise = atomicManager.executeAtomicOperation('test-player-1', operation);

      // Should have lock during operation
      expect(atomicManager.getLockStatus('test-player-1')).toBeTruthy();

      await resultPromise;

      // Lock should be released after operation
      expect(atomicManager.getLockStatus('test-player-1')).toBeNull();
    });

    it('should force release locks', async () => {
      const operation: AtomicOperation<string> = {
        operation: async (queue: TaskQueue) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'success';
        }
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();

      // Start operation to acquire lock
      const operationPromise = atomicManager.executeAtomicOperation('test-player-1', operation);

      // Verify lock exists
      expect(atomicManager.getLockStatus('test-player-1')).toBeTruthy();

      // Force release lock
      const released = await atomicManager.forceReleaseLock('test-player-1');
      expect(released).toBe(true);
      expect(atomicManager.getLockStatus('test-player-1')).toBeNull();

      // Wait for operation to complete
      await operationPromise;
    });

    it('should clean up expired locks', async () => {
      // Create a lock with very short timeout
      const shortTimeoutManager = new AtomicQueueStateManager(mockPersistenceService);
      
      const operation: AtomicOperation<string> = {
        operation: async (queue: TaskQueue) => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return 'success';
        },
        timeout: 50 // Very short timeout
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });

      // This should complete but may have validation issues
      const result = await shortTimeoutManager.executeAtomicOperation('test-player-1', operation);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(shortTimeoutManager.getLockStatus('test-player-1')).toBeNull();
    });
  });

  describe('getLockStatus', () => {
    it('should return null for non-existent lock', () => {
      const status = atomicManager.getLockStatus('non-existent-player');
      expect(status).toBeNull();
    });

    it('should return lock details for active lock', async () => {
      const operation: AtomicOperation<string> = {
        operation: async (queue: TaskQueue) => {
          const status = atomicManager.getLockStatus('test-player-1');
          expect(status).toBeTruthy();
          expect(status?.playerId).toBe('test-player-1');
          expect(status?.operation).toBe('operation');
          return 'success';
        }
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();

      await atomicManager.executeAtomicOperation('test-player-1', operation);
    });
  });

  describe('getActiveLocks', () => {
    it('should return all active locks', async () => {
      const operation1: AtomicOperation<string> = {
        operation: async (queue: TaskQueue) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'op1';
        }
      };

      const operation2: AtomicOperation<string> = {
        operation: async (queue: TaskQueue) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'op2';
        }
      };

      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 100,
        canRepair: true,
        repairActions: []
      });
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();

      // Start operations for different players
      const promise1 = atomicManager.executeAtomicOperation('player-1', operation1);
      const promise2 = atomicManager.executeAtomicOperation('player-2', operation2);

      // Check active locks
      const activeLocks = atomicManager.getActiveLocks();
      expect(activeLocks).toHaveLength(2);
      expect(activeLocks.map(l => l.playerId)).toContain('player-1');
      expect(activeLocks.map(l => l.playerId)).toContain('player-2');

      await Promise.all([promise1, promise2]);

      // Locks should be cleared after operations complete
      expect(atomicManager.getActiveLocks()).toHaveLength(0);
    });
  });
});