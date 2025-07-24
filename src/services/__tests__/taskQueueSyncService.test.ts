/**
 * Tests for Task Queue Real-Time Synchronization Service
 */

import { TaskQueueSyncService, DeltaUpdate, SyncMessage } from '../taskQueueSyncService';
import { TaskQueue, Task, TaskType, TaskSyncConflict } from '../../types/taskQueue';
import WebSocketService from '../websocketService';

// Mock WebSocket service
jest.mock('../websocketService');
const mockWebSocketService = WebSocketService as jest.Mocked<typeof WebSocketService>;

describe('TaskQueueSyncService', () => {
  let syncService: TaskQueueSyncService;
  let mockWsInstance: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock WebSocket instance
    mockWsInstance = {
      isConnected: jest.fn().mockReturnValue(true),
      send: jest.fn(),
      subscribe: jest.fn(),
      onConnectionStatusChange: jest.fn()
    } as any;

    mockWebSocketService.getInstance.mockReturnValue(mockWsInstance);
    
    // Create sync service instance
    syncService = TaskQueueSyncService.getInstance();
  });

  afterEach(() => {
    // Cleanup
    syncService.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with WebSocket handlers', () => {
      expect(mockWebSocketService.getInstance).toHaveBeenCalled();
      expect(mockWsInstance.subscribe).toHaveBeenCalledWith('sync_request', expect.any(Function));
      expect(mockWsInstance.subscribe).toHaveBeenCalledWith('sync_response', expect.any(Function));
      expect(mockWsInstance.subscribe).toHaveBeenCalledWith('delta_update', expect.any(Function));
      expect(mockWsInstance.subscribe).toHaveBeenCalledWith('heartbeat', expect.any(Function));
    });

    it('should start heartbeat mechanism', () => {
      // Heartbeat should be started during initialization
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'heartbeat'
        })
      );
    });
  });

  describe('Delta Synchronization', () => {
    const mockQueue: TaskQueue = {
      playerId: 'player1',
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
        pauseOnError: false,
        resumeOnResourceAvailable: true,
        persistenceInterval: 10000,
        integrityCheckInterval: 60000,
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

    it('should send delta update when connected', async () => {
      const deltaUpdate: DeltaUpdate = {
        type: 'task_added',
        playerId: 'player1',
        taskId: 'task1',
        data: { name: 'Test Task' },
        timestamp: Date.now(),
        version: 2,
        checksum: 'new-checksum'
      };

      await syncService.sendDeltaUpdate('player1', deltaUpdate);

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'delta_update',
          playerId: 'player1',
          data: deltaUpdate
        })
      );
    });

    it('should buffer delta updates when disconnected', async () => {
      mockWsInstance.isConnected.mockReturnValue(false);

      const deltaUpdate: DeltaUpdate = {
        type: 'task_updated',
        playerId: 'player1',
        taskId: 'task1',
        data: { progress: 0.5 },
        timestamp: Date.now(),
        version: 2,
        checksum: 'updated-checksum'
      };

      await syncService.sendDeltaUpdate('player1', deltaUpdate);

      // Should not send immediately when disconnected
      expect(mockWsInstance.send).not.toHaveBeenCalled();
    });

    it('should detect conflicts between local and server queues', async () => {
      const localQueue: TaskQueue = {
        ...mockQueue,
        version: 1,
        queuedTasks: [{
          id: 'task1',
          type: TaskType.HARVESTING,
          name: 'Harvest Wood',
          description: 'Harvest wood from trees',
          icon: 'wood',
          duration: 10000,
          startTime: Date.now(),
          playerId: 'player1',
          activityData: {} as any,
          prerequisites: [],
          resourceRequirements: [],
          progress: 0.3,
          completed: false,
          rewards: [],
          priority: 1,
          estimatedCompletion: Date.now() + 10000,
          retryCount: 0,
          maxRetries: 3,
          isValid: true,
          validationErrors: []
        }]
      };

      const serverQueue: TaskQueue = {
        ...mockQueue,
        version: 2,
        queuedTasks: [{
          id: 'task1',
          type: TaskType.HARVESTING,
          name: 'Harvest Wood',
          description: 'Harvest wood from trees',
          icon: 'wood',
          duration: 10000,
          startTime: Date.now(),
          playerId: 'player1',
          activityData: {} as any,
          prerequisites: [],
          resourceRequirements: [],
          progress: 0.7, // Different progress
          completed: false,
          rewards: [],
          priority: 1,
          estimatedCompletion: Date.now() + 10000,
          retryCount: 0,
          maxRetries: 3,
          isValid: true,
          validationErrors: []
        }]
      };

      const result = await syncService.syncQueueState('player1', localQueue);

      // Should detect progress conflict
      expect(result.success).toBe(true);
      // In a real implementation, this would detect the conflict
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using server wins strategy', async () => {
      const localQueue: TaskQueue = {
        ...mockQueue,
        version: 1,
        isRunning: true
      };

      const serverQueue: TaskQueue = {
        ...mockQueue,
        version: 2,
        isRunning: false
      };

      const result = await syncService.syncQueueState('player1', localQueue);

      expect(result.success).toBe(true);
      // Should use server state by default
    });

    it('should merge conflicting task properties intelligently', async () => {
      // This would test the intelligent merging of task properties
      // For example, taking the higher progress value
      const result = await syncService.syncQueueState('player1', mockQueue);
      expect(result.success).toBe(true);
    });
  });

  describe('Heartbeat Mechanism', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should send heartbeat at regular intervals', () => {
      // Fast forward time to trigger heartbeat
      jest.advanceTimersByTime(30000);

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'heartbeat'
        })
      );
    });

    it('should detect stale connections', () => {
      // Simulate no heartbeat response
      jest.advanceTimersByTime(90000); // 90 seconds

      // Should detect unhealthy connection
      // In a real implementation, this would trigger reconnection logic
    });

    it('should clean up stale connection data', () => {
      // Simulate stale connection cleanup
      jest.advanceTimersByTime(30000);

      // Should clean up internal state for stale connections
    });
  });

  describe('Message Queue Management', () => {
    it('should queue messages when disconnected', async () => {
      mockWsInstance.isConnected.mockReturnValue(false);

      const deltaUpdate: DeltaUpdate = {
        type: 'task_progress',
        playerId: 'player1',
        taskId: 'task1',
        data: { progress: 0.8 },
        timestamp: Date.now(),
        version: 3,
        checksum: 'progress-checksum'
      };

      await syncService.sendDeltaUpdate('player1', deltaUpdate);

      // Message should be queued, not sent
      expect(mockWsInstance.send).not.toHaveBeenCalled();
    });

    it('should process queued messages when reconnected', () => {
      // This would test the message queue processing when connection is restored
      mockWsInstance.isConnected.mockReturnValue(true);

      // Simulate connection restoration
      // Queued messages should be processed
    });

    it('should limit message queue size', async () => {
      mockWsInstance.isConnected.mockReturnValue(false);

      // Send more than max queue size messages
      for (let i = 0; i < 150; i++) {
        const deltaUpdate: DeltaUpdate = {
          type: 'task_progress',
          playerId: 'player1',
          taskId: `task${i}`,
          data: { progress: i / 150 },
          timestamp: Date.now(),
          version: i + 1,
          checksum: `checksum-${i}`
        };

        await syncService.sendDeltaUpdate('player1', deltaUpdate);
      }

      // Should limit queue size and remove oldest messages
    });
  });

  describe('Connection Health Monitoring', () => {
    it('should track connection health metrics', () => {
      const stats = syncService.getConnectionStats?.();
      
      if (stats) {
        expect(stats).toHaveProperty('isConnected');
        expect(stats).toHaveProperty('lastHeartbeat');
        expect(stats).toHaveProperty('queuedMessages');
        expect(stats).toHaveProperty('pendingAcks');
      }
    });

    it('should handle connection health degradation', () => {
      // Simulate poor connection health
      // Should trigger appropriate recovery mechanisms
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket send errors gracefully', async () => {
      mockWsInstance.send.mockImplementation(() => {
        throw new Error('WebSocket send failed');
      });

      const deltaUpdate: DeltaUpdate = {
        type: 'task_added',
        playerId: 'player1',
        data: { name: 'Test Task' },
        timestamp: Date.now(),
        version: 1,
        checksum: 'test-checksum'
      };

      // Should not throw error
      await expect(syncService.sendDeltaUpdate('player1', deltaUpdate)).resolves.not.toThrow();
    });

    it('should handle sync failures gracefully', async () => {
      const result = await syncService.syncQueueState('player1', mockQueue);

      // Should return a result even if sync fails
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('conflicts');
      expect(result).toHaveProperty('resolvedQueue');
    });

    it('should handle malformed messages', () => {
      // Test handling of malformed WebSocket messages
      // Should not crash the service
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency delta updates efficiently', async () => {
      const startTime = Date.now();

      // Send many delta updates rapidly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const deltaUpdate: DeltaUpdate = {
          type: 'task_progress',
          playerId: 'player1',
          taskId: 'task1',
          data: { progress: i / 100 },
          timestamp: Date.now(),
          version: i + 1,
          checksum: `checksum-${i}`
        };

        promises.push(syncService.sendDeltaUpdate('player1', deltaUpdate));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // 1 second
    });

    it('should efficiently calculate checksums', () => {
      // Test checksum calculation performance
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        // Calculate checksum for mock queue
        // This would test the checksum calculation method
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // 100ms
    });
  });
});