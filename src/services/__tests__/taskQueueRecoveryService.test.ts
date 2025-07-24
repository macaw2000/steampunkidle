/**
 * Task Queue Recovery Service Tests
 */

import { TaskQueueRecoveryService, RecoveryOptions, RecoveryResult } from '../taskQueueRecoveryService';
import { TaskQueuePersistenceService } from '../taskQueuePersistence';
import { AtomicQueueStateManager } from '../atomicQueueStateManager';
import { TaskQueue } from '../../types/taskQueue';

// Mock dependencies
jest.mock('../taskQueuePersistence');
jest.mock('../atomicQueueStateManager');

describe('TaskQueueRecoveryService', () => {
  let recoveryService: TaskQueueRecoveryService;
  let mockPersistenceService: jest.Mocked<TaskQueuePersistenceService>;
  let mockAtomicManager: jest.Mocked<AtomicQueueStateManager>;

  const mockQueue: TaskQueue = {
    playerId: 'test-player',
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

  beforeEach(() => {
    mockPersistenceService = new TaskQueuePersistenceService({
      tableName: 'test-table',
      snapshotTableName: 'test-snapshots',
      migrationTableName: 'test-migrations',
      region: 'us-east-1',
      maxRetries: 3,
      retryDelayMs: 1000,
      snapshotInterval: 300000,
      maxSnapshots: 10
    }) as jest.Mocked<TaskQueuePersistenceService>;

    mockAtomicManager = new AtomicQueueStateManager(mockPersistenceService) as jest.Mocked<AtomicQueueStateManager>;

    recoveryService = new TaskQueueRecoveryService(mockPersistenceService, mockAtomicManager);
  });

  describe('recoverQueue', () => {
    it('should successfully recover from snapshot', async () => {
      // Mock successful snapshot recovery
      mockPersistenceService.getPlayerSnapshots.mockResolvedValue([
        {
          snapshotId: 'snapshot-1',
          playerId: 'test-player',
          timestamp: Date.now(),
          queueState: mockQueue,
          checksum: 'test-checksum',
          version: 1,
          metadata: {
            reason: 'periodic',
            size: 1000
          }
        }
      ]);

      mockPersistenceService.restoreFromSnapshot.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 1.0,
        canRepair: false,
        repairActions: []
      });

      const result = await recoveryService.recoverQueue('test-player');

      expect(result.success).toBe(true);
      expect(result.recoveryMethod).toBe('snapshot_restore');
      expect(result.recoveredQueue).toEqual(mockQueue);
      expect(result.errors).toHaveLength(0);
    });

    it('should recover through state repair when snapshots fail', async () => {
      // Mock failed snapshot recovery
      mockPersistenceService.getPlayerSnapshots.mockResolvedValue([]);

      // Mock successful state repair
      mockPersistenceService.loadQueue.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: false,
        errors: [
          {
            code: 'CHECKSUM_MISMATCH',
            message: 'Checksum mismatch',
            severity: 'major'
          }
        ],
        warnings: [],
        integrityScore: 0.8,
        canRepair: true,
        repairActions: [
          {
            type: 'update_checksum',
            description: 'Update checksum'
          }
        ]
      });

      const repairedQueue = { ...mockQueue, checksum: 'new-checksum' };
      mockPersistenceService.repairQueue.mockResolvedValue(repairedQueue);

      const result = await recoveryService.recoverQueue('test-player');

      expect(result.success).toBe(true);
      expect(result.recoveryMethod).toBe('state_repair');
      expect(result.recoveredQueue).toEqual(repairedQueue);
      expect(result.warnings).toContain('Queue repaired successfully: 1 actions applied');
    });

    it('should create fallback queue when all recovery methods fail', async () => {
      // Mock all recovery methods failing
      mockPersistenceService.getPlayerSnapshots.mockResolvedValue([]);
      mockPersistenceService.loadQueue.mockResolvedValue(null);

      // Mock localStorage backup not available
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn().mockReturnValue(null)
        }
      });

      // Mock successful fallback creation
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();

      const result = await recoveryService.recoverQueue('test-player');

      expect(result.success).toBe(true);
      expect(result.recoveryMethod).toBe('fallback_creation');
      expect(result.fallbackQueue).toBeDefined();
      expect(result.warnings).toContain('Created new fallback queue - all previous queue data has been lost');
    });

    it('should handle circuit breaker open state', async () => {
      // Simulate multiple failures to trigger circuit breaker
      const options: Partial<RecoveryOptions> = {
        enableCircuitBreaker: true
      };

      // First, cause failures to open circuit breaker
      mockPersistenceService.getPlayerSnapshots.mockRejectedValue(new Error('Service unavailable'));
      mockPersistenceService.loadQueue.mockRejectedValue(new Error('Service unavailable'));

      // Multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await recoveryService.recoverQueue('test-player', options);
      }

      // Now the circuit breaker should be open
      const result = await recoveryService.recoverQueue('test-player', options);

      expect(result.success).toBe(false);
      expect(result.recoveryMethod).toBe('graceful_degradation');
      expect(result.errors[0].code).toBe('CIRCUIT_BREAKER_OPEN');
    });

    it('should handle resource overload with graceful degradation', async () => {
      // Mock resource overload
      const mockResourceMonitor = {
        getStatus: jest.fn().mockResolvedValue({
          memoryUsage: 0.95,
          cpuUsage: 0.9,
          databaseConnections: 100,
          activeOperations: 50,
          isOverloaded: true,
          degradationLevel: 'severe'
        })
      };

      // Replace the resource monitor (this would be done through dependency injection in real code)
      (recoveryService as any).resourceMonitor = mockResourceMonitor;

      const result = await recoveryService.recoverQueue('test-player', {
        gracefulDegradation: true
      });

      expect(result.success).toBe(true);
      expect(result.recoveryMethod).toBe('graceful_degradation');
      expect(result.warnings).toContain('Emergency mode activated due to severe system load');
    });

    it('should handle backup recovery from localStorage', async () => {
      // Mock failed snapshot and state repair
      mockPersistenceService.getPlayerSnapshots.mockResolvedValue([]);
      mockPersistenceService.loadQueue.mockResolvedValue(null);

      // Mock localStorage backup available
      const backupQueue = { ...mockQueue, version: 2 };
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn().mockReturnValue(JSON.stringify(backupQueue))
        }
      });

      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 1.0,
        canRepair: false,
        repairActions: []
      });

      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();

      const result = await recoveryService.recoverQueue('test-player');

      expect(result.success).toBe(true);
      expect(result.recoveryMethod).toBe('backup_restore');
      expect(result.warnings).toContain('Queue restored from local storage backup');
    });

    it('should handle corrupted backup data', async () => {
      // Mock failed snapshot and state repair
      mockPersistenceService.getPlayerSnapshots.mockResolvedValue([]);
      mockPersistenceService.loadQueue.mockResolvedValue(null);

      // Mock corrupted localStorage backup
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn().mockReturnValue('invalid-json')
        }
      });

      // Mock successful fallback creation
      mockPersistenceService.saveQueueWithAtomicUpdate.mockResolvedValue();

      const result = await recoveryService.recoverQueue('test-player');

      expect(result.success).toBe(true);
      expect(result.recoveryMethod).toBe('fallback_creation');
    });

    it('should handle recovery with minimal degradation', async () => {
      // Mock cached queue available
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: jest.fn().mockReturnValue(JSON.stringify(mockQueue))
        }
      });

      const mockResourceMonitor = {
        getStatus: jest.fn().mockResolvedValue({
          memoryUsage: 0.75,
          cpuUsage: 0.65,
          databaseConnections: 20,
          activeOperations: 10,
          isOverloaded: true,
          degradationLevel: 'minimal'
        })
      };

      (recoveryService as any).resourceMonitor = mockResourceMonitor;

      const result = await recoveryService.recoverQueue('test-player', {
        gracefulDegradation: true
      });

      expect(result.success).toBe(true);
      expect(result.recoveryMethod).toBe('graceful_degradation');
      expect(result.warnings).toContain('Using cached queue data due to system load');
    });
  });

  describe('circuit breaker functionality', () => {
    it('should track circuit breaker status', async () => {
      // Cause failures to trigger circuit breaker
      mockPersistenceService.getPlayerSnapshots.mockRejectedValue(new Error('Service unavailable'));

      // Multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await recoveryService.recoverQueue('test-player', { enableCircuitBreaker: true });
      }

      const status = recoveryService.getCircuitBreakerStatus('test-player');
      expect(status).toBeDefined();
      expect(status?.isOpen).toBe(true);
    });

    it('should allow force reset of circuit breaker', async () => {
      // Cause failures to trigger circuit breaker
      mockPersistenceService.getPlayerSnapshots.mockRejectedValue(new Error('Service unavailable'));

      for (let i = 0; i < 6; i++) {
        await recoveryService.recoverQueue('test-player', { enableCircuitBreaker: true });
      }

      // Force reset
      await recoveryService.forceResetCircuitBreaker('test-player');

      const status = recoveryService.getCircuitBreakerStatus('test-player');
      expect(status).toBeNull();
    });
  });

  describe('system resource monitoring', () => {
    it('should provide system resource status', async () => {
      const status = await recoveryService.getSystemResourceStatus();
      
      expect(status).toBeDefined();
      expect(status).toHaveProperty('memoryUsage');
      expect(status).toHaveProperty('cpuUsage');
      expect(status).toHaveProperty('isOverloaded');
      expect(status).toHaveProperty('degradationLevel');
    });
  });

  describe('error handling', () => {
    it('should handle errors during recovery gracefully', async () => {
      // Mock all methods throwing errors
      mockPersistenceService.getPlayerSnapshots.mockRejectedValue(new Error('Database error'));
      mockPersistenceService.loadQueue.mockRejectedValue(new Error('Database error'));
      mockPersistenceService.saveQueueWithAtomicUpdate.mockRejectedValue(new Error('Database error'));

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn().mockImplementation(() => {
            throw new Error('Storage error');
          })
        }
      });

      const result = await recoveryService.recoverQueue('test-player');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.recoveryMethod).toBe('fallback_creation');
    });

    it('should handle recovery service errors', async () => {
      // Mock the recovery service itself throwing an error
      const originalMethod = recoveryService.recoverQueue;
      recoveryService.recoverQueue = jest.fn().mockImplementation(() => {
        throw new Error('Recovery service error');
      });

      const result = await originalMethod.call(recoveryService, 'test-player');

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('RECOVERY_SYSTEM_ERROR');
    });
  });

  describe('performance and timing', () => {
    it('should track recovery duration', async () => {
      mockPersistenceService.getPlayerSnapshots.mockResolvedValue([
        {
          snapshotId: 'snapshot-1',
          playerId: 'test-player',
          timestamp: Date.now(),
          queueState: mockQueue,
          checksum: 'test-checksum',
          version: 1,
          metadata: {
            reason: 'periodic',
            size: 1000
          }
        }
      ]);

      mockPersistenceService.restoreFromSnapshot.mockResolvedValue(mockQueue);
      mockPersistenceService.validateQueueIntegrity.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        integrityScore: 1.0,
        canRepair: false,
        repairActions: []
      });

      const result = await recoveryService.recoverQueue('test-player');

      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle timeout scenarios', async () => {
      // Mock long-running operation
      mockPersistenceService.getPlayerSnapshots.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const startTime = Date.now();
      const result = await recoveryService.recoverQueue('test-player', {
        maxRetries: 1
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(50);
      expect(result.duration).toBeGreaterThan(50);
    });
  });
});