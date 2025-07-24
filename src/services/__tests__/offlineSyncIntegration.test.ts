/**
 * Offline Sync Integration Tests
 */

import { OfflineSyncIntegration, SyncConfiguration, SyncMetrics } from '../offlineSyncIntegration';
import { OfflineTaskQueueManager } from '../offlineTaskQueueManager';
import { ServerTaskQueueService } from '../serverTaskQueueService';
import { NetworkUtils } from '../../utils/networkUtils';
import { TaskQueue, TaskType, Task, TaskSyncResult } from '../../types/taskQueue';

// Mock dependencies
jest.mock('../offlineTaskQueueManager');
jest.mock('../serverTaskQueueService');
jest.mock('../../utils/networkUtils');

const mockOfflineManager = OfflineTaskQueueManager.getInstance as jest.MockedFunction<typeof OfflineTaskQueueManager.getInstance>;
const mockServerService = ServerTaskQueueService.getInstance as jest.MockedFunction<typeof ServerTaskQueueService.getInstance>;
const mockNetworkUtils = NetworkUtils as jest.Mocked<typeof NetworkUtils>;

describe('OfflineSyncIntegration', () => {
  let syncIntegration: OfflineSyncIntegration;
  let mockQueue: TaskQueue;
  let mockTask: Task;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton
    (OfflineSyncIntegration as any).instance = null;
    syncIntegration = OfflineSyncIntegration.getInstance();

    mockTask = {
      id: 'task-1',
      type: TaskType.HARVESTING,
      name: 'Test Task',
      description: 'Test task',
      icon: 'icon.png',
      duration: 60000,
      startTime: Date.now(),
      playerId: 'player-1',
      activityData: {
        activity: {
          activityId: 'wood-cutting',
          name: 'Wood Cutting',
          description: 'Cut wood',
          icon: 'wood.png',
          baseTime: 60000,
          baseReward: { type: 'resource', resourceId: 'wood', quantity: 1 },
          requirements: []
        },
        playerStats: {
          playerId: 'player-1',
          level: 1,
          experience: 0,
          health: 100,
          maxHealth: 100,
          energy: 100,
          maxEnergy: 100,
          skills: {}
        },
        tools: [],
        expectedYield: []
      },
      prerequisites: [],
      resourceRequirements: [],
      progress: 0,
      completed: false,
      rewards: [],
      priority: 1,
      estimatedCompletion: Date.now() + 60000,
      retryCount: 0,
      maxRetries: 3,
      isValid: true,
      validationErrors: []
    };

    mockQueue = {
      playerId: 'player-1',
      currentTask: null,
      queuedTasks: [mockTask],
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
        priorityHandling: true,
        retryEnabled: true,
        maxRetries: 3,
        validationEnabled: true,
        syncInterval: 30000,
        offlineProcessingEnabled: true,
        pauseOnError: false,
        resumeOnResourceAvailable: true,
        persistenceInterval: 5000,
        integrityCheckInterval: 60000,
        maxHistorySize: 100
      },
      lastUpdated: Date.now(),
      lastSynced: Date.now() - 60000,
      createdAt: Date.now() - 3600000,
      version: 5,
      checksum: 'abc123',
      lastValidated: Date.now(),
      stateHistory: [],
      maxHistorySize: 100
    };

    // Setup mocks
    const mockOfflineManagerInstance = {
      getQueueState: jest.fn().mockReturnValue(mockQueue),
      getSyncIndicator: jest.fn(),
      triggerManualSync: jest.fn()
    };

    const mockServerServiceInstance = {
      syncWithServer: jest.fn(),
      getQueueStatus: jest.fn()
    };

    mockOfflineManager.mockReturnValue(mockOfflineManagerInstance as any);
    mockServerService.mockReturnValue(mockServerServiceInstance as any);
  });

  afterEach(() => {
    syncIntegration.destroy();
  });

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = OfflineSyncIntegration.getInstance();
      const instance2 = OfflineSyncIntegration.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default configuration', () => {
      expect(syncIntegration).toBeDefined();
    });
  });

  describe('Incremental Sync', () => {
    it('should perform incremental sync with no pending operations', async () => {
      // Mock no pending operations
      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue([]);

      const result = await syncIntegration.performIncrementalSync('player-1');

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.resolvedQueue).toEqual(mockQueue);
    });

    it('should perform incremental sync with pending operations', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          type: 'add_task',
          timestamp: Date.now(),
          data: mockTask,
          taskId: 'task-1',
          playerId: 'player-1',
          localVersion: 6,
          applied: false
        }
      ];

      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue(mockOperations);
      
      const mockServerResponse = {
        success: true,
        conflicts: [],
        serverQueue: mockQueue,
        appliedOperations: ['op-1']
      };

      mockNetworkUtils.postJson.mockResolvedValue(mockServerResponse);

      const result = await syncIntegration.performIncrementalSync('player-1');

      expect(result.success).toBe(true);
      expect(mockNetworkUtils.postJson).toHaveBeenCalledWith(
        '/api/task-queue/incremental-sync',
        expect.objectContaining({
          syncData: expect.objectContaining({
            playerId: 'player-1',
            operations: expect.arrayContaining([
              expect.objectContaining({
                id: 'op-1',
                type: 'add_task'
              })
            ])
          })
        })
      );
    });

    it('should handle sync timeout', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          type: 'add_task',
          timestamp: Date.now(),
          data: mockTask,
          taskId: 'task-1',
          playerId: 'player-1',
          localVersion: 6,
          applied: false
        }
      ];

      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue(mockOperations);
      
      // Mock timeout
      mockNetworkUtils.postJson.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 35000))
      );

      const config: Partial<SyncConfiguration> = {
        syncTimeoutMs: 1000
      };

      await expect(
        syncIntegration.performIncrementalSync('player-1', config)
      ).rejects.toThrow('Sync timeout');
    });

    it('should prevent concurrent syncs for same player', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          type: 'add_task',
          timestamp: Date.now(),
          data: mockTask,
          taskId: 'task-1',
          playerId: 'player-1',
          localVersion: 6,
          applied: false
        }
      ];

      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue(mockOperations);
      
      // Mock slow server response
      mockNetworkUtils.postJson.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          conflicts: [],
          serverQueue: mockQueue,
          appliedOperations: ['op-1']
        }), 100))
      );

      // Start first sync
      const sync1Promise = syncIntegration.performIncrementalSync('player-1');
      
      // Try to start second sync immediately
      await expect(
        syncIntegration.performIncrementalSync('player-1')
      ).rejects.toThrow('Sync already in progress for this player');

      // Wait for first sync to complete
      await sync1Promise;
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using server_wins strategy', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          type: 'update_task',
          timestamp: Date.now(),
          data: { ...mockTask, progress: 0.5 },
          taskId: 'task-1',
          playerId: 'player-1',
          localVersion: 6,
          applied: false
        }
      ];

      const serverTask = { ...mockTask, progress: 0.8 };
      const serverQueue = { ...mockQueue, queuedTasks: [serverTask] };

      const mockServerResponse = {
        success: true,
        conflicts: [
          {
            type: 'task_modified',
            taskId: 'task-1',
            serverValue: serverTask,
            clientValue: { ...mockTask, progress: 0.5 },
            resolution: 'use_server'
          }
        ],
        serverQueue,
        appliedOperations: []
      };

      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue(mockOperations);
      mockNetworkUtils.postJson.mockResolvedValue(mockServerResponse);

      const config: Partial<SyncConfiguration> = {
        conflictResolutionStrategy: 'server_wins'
      };

      const result = await syncIntegration.performIncrementalSync('player-1', config);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.resolvedQueue.queuedTasks[0].progress).toBe(0.8); // Server value
    });

    it('should resolve conflicts using client_wins strategy', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          type: 'add_task',
          timestamp: Date.now(),
          data: mockTask,
          taskId: 'task-1',
          playerId: 'player-1',
          localVersion: 6,
          applied: false
        }
      ];

      const mockServerResponse = {
        success: true,
        conflicts: [
          {
            type: 'task_added',
            taskId: 'task-1',
            serverValue: null,
            clientValue: mockTask,
            resolution: 'use_client'
          }
        ],
        serverQueue: { ...mockQueue, queuedTasks: [] },
        appliedOperations: []
      };

      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue(mockOperations);
      mockNetworkUtils.postJson.mockResolvedValue(mockServerResponse);

      const config: Partial<SyncConfiguration> = {
        conflictResolutionStrategy: 'client_wins'
      };

      const result = await syncIntegration.performIncrementalSync('player-1', config);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.resolvedQueue.queuedTasks).toHaveLength(1);
      expect(result.resolvedQueue.queuedTasks[0]).toEqual(mockTask);
    });

    it('should resolve conflicts using merge strategy', async () => {
      const clientTask = { ...mockTask, progress: 0.3, priority: 2 };
      const serverTask = { ...mockTask, progress: 0.7, priority: 1 };

      const mockOperations = [
        {
          id: 'op-1',
          type: 'update_task',
          timestamp: Date.now(),
          data: clientTask,
          taskId: 'task-1',
          playerId: 'player-1',
          localVersion: 6,
          applied: false
        }
      ];

      const mockServerResponse = {
        success: true,
        conflicts: [
          {
            type: 'task_modified',
            taskId: 'task-1',
            serverValue: serverTask,
            clientValue: clientTask,
            resolution: 'merge'
          }
        ],
        serverQueue: { ...mockQueue, queuedTasks: [serverTask] },
        appliedOperations: []
      };

      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue(mockOperations);
      mockNetworkUtils.postJson.mockResolvedValue(mockServerResponse);

      const config: Partial<SyncConfiguration> = {
        conflictResolutionStrategy: 'merge'
      };

      const result = await syncIntegration.performIncrementalSync('player-1', config);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      
      const mergedTask = result.resolvedQueue.queuedTasks[0];
      expect(mergedTask.progress).toBe(0.7); // Higher progress (server)
      expect(mergedTask.priority).toBe(2); // Client priority
    });
  });

  describe('Data Minimization', () => {
    it('should minimize operation data for efficient transfer', () => {
      const operation = {
        id: 'op-1',
        type: 'add_task',
        timestamp: Date.now(),
        data: mockTask,
        taskId: 'task-1',
        playerId: 'player-1',
        localVersion: 6,
        applied: false
      };

      const minimized = (syncIntegration as any).minimizeOperationData(operation);

      expect(minimized).toEqual({
        id: mockTask.id,
        type: mockTask.type,
        name: mockTask.name,
        duration: mockTask.duration,
        activityData: mockTask.activityData,
        priority: mockTask.priority
      });

      // Should not include all task properties
      expect(minimized.description).toBeUndefined();
      expect(minimized.rewards).toBeUndefined();
      expect(minimized.validationErrors).toBeUndefined();
    });

    it('should minimize remove_task operation data', () => {
      const operation = {
        id: 'op-1',
        type: 'remove_task',
        timestamp: Date.now(),
        data: mockTask,
        taskId: 'task-1',
        playerId: 'player-1',
        localVersion: 6,
        applied: false
      };

      const minimized = (syncIntegration as any).minimizeOperationData(operation);

      expect(minimized).toEqual({ taskId: 'task-1' });
    });
  });

  describe('Reward Merging', () => {
    it('should merge rewards intelligently', () => {
      const serverRewards = [
        { type: 'experience', quantity: 100 },
        { type: 'item', itemId: 'wood', quantity: 5 }
      ];

      const clientRewards = [
        { type: 'experience', quantity: 80 },
        { type: 'item', itemId: 'stone', quantity: 3 }
      ];

      const merged = (syncIntegration as any).mergeRewards(serverRewards, clientRewards);

      expect(merged).toHaveLength(3);
      expect(merged.find((r: any) => r.type === 'experience').quantity).toBe(100); // Max value
      expect(merged.find((r: any) => r.itemId === 'wood')).toBeDefined();
      expect(merged.find((r: any) => r.itemId === 'stone')).toBeDefined();
    });
  });

  describe('Sync Metrics', () => {
    it('should track sync metrics', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          type: 'add_task',
          timestamp: Date.now(),
          data: mockTask,
          taskId: 'task-1',
          playerId: 'player-1',
          localVersion: 6,
          applied: false
        }
      ];

      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue(mockOperations);
      
      const mockServerResponse = {
        success: true,
        conflicts: [],
        serverQueue: mockQueue,
        appliedOperations: ['op-1']
      };

      mockNetworkUtils.postJson.mockResolvedValue(mockServerResponse);

      await syncIntegration.performIncrementalSync('player-1');

      const metrics = syncIntegration.getSyncMetrics('player-1');

      expect(metrics.totalSyncs).toBe(1);
      expect(metrics.successfulSyncs).toBe(1);
      expect(metrics.failedSyncs).toBe(0);
      expect(metrics.operationsSynced).toBe(1);
      expect(metrics.lastSyncDuration).toBeGreaterThan(0);
    });

    it('should track failed sync metrics', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          type: 'add_task',
          timestamp: Date.now(),
          data: mockTask,
          taskId: 'task-1',
          playerId: 'player-1',
          localVersion: 6,
          applied: false
        }
      ];

      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue(mockOperations);
      mockNetworkUtils.postJson.mockRejectedValue(new Error('Network error'));

      await expect(
        syncIntegration.performIncrementalSync('player-1')
      ).rejects.toThrow('Network error');

      const metrics = syncIntegration.getSyncMetrics('player-1');

      expect(metrics.totalSyncs).toBe(1);
      expect(metrics.successfulSyncs).toBe(0);
      expect(metrics.failedSyncs).toBe(1);
    });

    it('should reset sync metrics', () => {
      // First create some metrics
      (syncIntegration as any).syncMetrics.set('player-1', {
        totalSyncs: 5,
        successfulSyncs: 4,
        failedSyncs: 1,
        conflictsResolved: 2,
        averageSyncTime: 1500,
        lastSyncDuration: 1200,
        dataTransferred: 5000,
        operationsSynced: 10
      });

      syncIntegration.resetSyncMetrics('player-1');

      const metrics = syncIntegration.getSyncMetrics('player-1');
      expect(metrics.totalSyncs).toBe(0);
      expect(metrics.successfulSyncs).toBe(0);
      expect(metrics.failedSyncs).toBe(0);
    });
  });

  describe('Sync Status', () => {
    it('should check if sync is active', async () => {
      expect(syncIntegration.isSyncActive('player-1')).toBe(false);

      const mockOperations = [
        {
          id: 'op-1',
          type: 'add_task',
          timestamp: Date.now(),
          data: mockTask,
          taskId: 'task-1',
          playerId: 'player-1',
          localVersion: 6,
          applied: false
        }
      ];

      (syncIntegration as any).getPendingOperations = jest.fn().mockResolvedValue(mockOperations);
      
      // Mock slow response to keep sync active
      mockNetworkUtils.postJson.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          conflicts: [],
          serverQueue: mockQueue,
          appliedOperations: ['op-1']
        }), 100))
      );

      const syncPromise = syncIntegration.performIncrementalSync('player-1');
      
      expect(syncIntegration.isSyncActive('player-1')).toBe(true);
      
      await syncPromise;
      
      expect(syncIntegration.isSyncActive('player-1')).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      syncIntegration.destroy();

      expect(syncIntegration.isSyncActive('player-1')).toBe(false);
      
      const metrics = syncIntegration.getSyncMetrics('player-1');
      expect(metrics.totalSyncs).toBe(0);
    });
  });
});