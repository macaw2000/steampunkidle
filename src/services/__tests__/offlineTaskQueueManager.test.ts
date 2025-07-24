/**
 * Offline Task Queue Manager Tests
 */

import { OfflineTaskQueueManager, OfflineOperation, SyncStatus } from '../offlineTaskQueueManager';
import { Task, TaskType, TaskQueue } from '../../types/taskQueue';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  key: jest.fn(),
  length: 0
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window events
const mockAddEventListener = jest.fn();
Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener
});

describe('OfflineTaskQueueManager', () => {
  let manager: OfflineTaskQueueManager;
  let mockTask: Task;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset singleton
    if ((OfflineTaskQueueManager as any).instance) {
      (OfflineTaskQueueManager as any).instance.destroy();
      (OfflineTaskQueueManager as any).instance = null;
    }
    manager = OfflineTaskQueueManager.getInstance();

    mockTask = {
      id: 'task-1',
      type: TaskType.HARVESTING,
      name: 'Test Harvesting',
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
  });

  afterEach(() => {
    if (manager && manager.destroy) {
      manager.destroy();
    }
  });

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = OfflineTaskQueueManager.getInstance();
      const instance2 = OfflineTaskQueueManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should setup network listeners', () => {
      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should initialize from localStorage', () => {
      const storedState = {
        playerId: 'player-1',
        queue: { queuedTasks: [] },
        pendingOperations: [],
        lastOnlineSync: Date.now(),
        offlineStartTime: 0,
        isOffline: false,
        localVersion: 1,
        syncStatus: {
          isOnline: true,
          lastSyncAttempt: 0,
          lastSuccessfulSync: 0,
          syncInProgress: false,
          pendingOperationsCount: 0,
          conflictsDetected: 0,
          syncErrors: [],
          manualSyncRequested: false
        },
        conflictResolutionLog: []
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedState));
      Object.keys = jest.fn().mockReturnValue(['offline_queue_player-1']);
      
      // Create new instance to test initialization
      (OfflineTaskQueueManager as any).instance = null;
      const newManager = OfflineTaskQueueManager.getInstance();
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('offline_queue_player-1');
    });
  });

  describe('Task Management', () => {
    it('should add task to offline queue', async () => {
      await manager.addTask('player-1', mockTask);
      
      const queueState = manager.getQueueState('player-1');
      expect(queueState.queuedTasks).toHaveLength(1);
      expect(queueState.queuedTasks[0]).toEqual(mockTask);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should remove task from offline queue', async () => {
      await manager.addTask('player-1', mockTask);
      await manager.removeTask('player-1', 'task-1');
      
      const queueState = manager.getQueueState('player-1');
      expect(queueState.queuedTasks).toHaveLength(0);
    });

    it('should reorder tasks in offline queue', async () => {
      const task2 = { ...mockTask, id: 'task-2', name: 'Task 2' };
      await manager.addTask('player-1', mockTask);
      await manager.addTask('player-1', task2);
      
      await manager.reorderTasks('player-1', ['task-2', 'task-1']);
      
      const queueState = manager.getQueueState('player-1');
      expect(queueState.queuedTasks[0].id).toBe('task-2');
      expect(queueState.queuedTasks[1].id).toBe('task-1');
    });

    it('should pause and resume queue', async () => {
      await manager.pauseQueue('player-1', 'Test pause');
      
      let queueState = manager.getQueueState('player-1');
      expect(queueState.isPaused).toBe(true);
      expect(queueState.pauseReason).toBe('Test pause');
      
      await manager.resumeQueue('player-1');
      
      queueState = manager.getQueueState('player-1');
      expect(queueState.isPaused).toBe(false);
      expect(queueState.pauseReason).toBeUndefined();
    });
  });

  describe('Sync Status', () => {
    it('should provide sync indicator for online state', () => {
      const indicator = manager.getSyncIndicator('player-1');
      
      expect(indicator.status).toBe('online');
      expect(indicator.message).toBe('All changes synchronized');
      expect(indicator.canManualSync).toBe(true);
    });

    it('should provide sync indicator for offline state', async () => {
      // Simulate going offline
      (navigator as any).onLine = false;
      await manager.addTask('player-1', mockTask);
      
      const indicator = manager.getSyncIndicator('player-1');
      
      expect(indicator.status).toBe('offline');
      expect(indicator.message).toContain('Offline');
      expect(indicator.pendingCount).toBe(1);
      expect(indicator.canManualSync).toBe(false);
    });

    it('should provide sync indicator for syncing state', async () => {
      // Mock sync in progress
      const mockPerformSync = jest.fn().mockImplementation(() => new Promise(resolve => {
        setTimeout(resolve, 100);
      }));
      (manager as any).performSync = mockPerformSync;
      
      // Start sync without awaiting
      manager.triggerManualSync('player-1');
      
      const indicator = manager.getSyncIndicator('player-1');
      expect(indicator.canManualSync).toBe(false);
    });
  });

  describe('Manual Sync', () => {
    it('should trigger manual sync', async () => {
      const mockPerformSync = jest.fn().mockResolvedValue({
        success: true,
        conflicts: [],
        resolvedQueue: manager.getQueueState('player-1'),
        syncTimestamp: Date.now()
      });
      (manager as any).performSync = mockPerformSync;
      
      const result = await manager.triggerManualSync('player-1');
      
      expect(mockPerformSync).toHaveBeenCalledWith('player-1');
      expect(result.success).toBe(true);
    });

    it('should handle sync errors', async () => {
      const mockPerformSync = jest.fn().mockRejectedValue(new Error('Sync failed'));
      (manager as any).performSync = mockPerformSync;
      
      await expect(manager.triggerManualSync('player-1')).rejects.toThrow('Sync failed');
    });
  });

  describe('Network Status Changes', () => {
    it('should handle going offline', () => {
      const handleNetworkStatusChange = (manager as any).handleNetworkStatusChange.bind(manager);
      
      handleNetworkStatusChange(false);
      
      const indicator = manager.getSyncIndicator('player-1');
      expect(indicator.status).toBe('offline');
    });

    it('should handle coming online', () => {
      const handleNetworkStatusChange = (manager as any).handleNetworkStatusChange.bind(manager);
      const mockTriggerSync = jest.fn();
      (manager as any).triggerSync = mockTriggerSync;
      
      // First go offline
      handleNetworkStatusChange(false);
      // Then come online
      handleNetworkStatusChange(true);
      
      expect(mockTriggerSync).toHaveBeenCalledWith('player-1');
    });
  });

  describe('Pending Operations', () => {
    it('should track pending operations', async () => {
      await manager.addTask('player-1', mockTask);
      await manager.removeTask('player-1', 'task-1');
      
      const indicator = manager.getSyncIndicator('player-1');
      expect(indicator.pendingCount).toBe(2); // add + remove operations
    });

    it('should limit pending operations', async () => {
      // Mock MAX_PENDING_OPERATIONS to a small number for testing
      (manager as any).MAX_PENDING_OPERATIONS = 3;
      
      for (let i = 0; i < 5; i++) {
        await manager.addTask('player-1', { ...mockTask, id: `task-${i}` });
      }
      
      const state = (manager as any).getOfflineState('player-1');
      expect(state.pendingOperations.length).toBe(3);
    });

    it('should deduplicate reorder operations', async () => {
      await manager.addTask('player-1', mockTask);
      await manager.addTask('player-1', { ...mockTask, id: 'task-2' });
      
      await manager.reorderTasks('player-1', ['task-2', 'task-1']);
      await manager.reorderTasks('player-1', ['task-1', 'task-2']);
      
      const state = (manager as any).getOfflineState('player-1');
      const reorderOps = state.pendingOperations.filter((op: OfflineOperation) => op.type === 'reorder_tasks');
      expect(reorderOps.length).toBe(1); // Should only keep the latest reorder
    });
  });

  describe('Local Processing', () => {
    it('should start local processing when auto-start is enabled', async () => {
      const mockStartLocalProcessing = jest.fn();
      (manager as any).startLocalProcessing = mockStartLocalProcessing;
      
      await manager.addTask('player-1', mockTask);
      
      expect(mockStartLocalProcessing).toHaveBeenCalledWith('player-1');
    });

    it('should not start local processing when queue is paused', async () => {
      await manager.pauseQueue('player-1');
      
      const mockStartLocalProcessing = jest.fn();
      (manager as any).startLocalProcessing = mockStartLocalProcessing;
      
      await manager.addTask('player-1', mockTask);
      
      expect(mockStartLocalProcessing).not.toHaveBeenCalled();
    });
  });

  describe('Persistence', () => {
    it('should persist state to localStorage', async () => {
      await manager.addTask('player-1', mockTask);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_queue_player-1',
        expect.any(String)
      );
    });

    it('should handle localStorage errors gracefully', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await manager.addTask('player-1', mockTask);
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to persist offline state:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      manager.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});