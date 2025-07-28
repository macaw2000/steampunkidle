/**
 * Fargate Game Engine Service Integration Tests
 * Tests for frontend-backend integration and real-time updates
 */

import { FargateGameEngineService } from '../fargateGameEngineService';
import { TaskType } from '../../types/taskQueue';
import { TaskUtils } from '../../utils/taskUtils';

// Mock NetworkUtils for testing
jest.mock('../../utils/networkUtils', () => ({
  NetworkUtils: {
    fetchJson: jest.fn(),
    postJson: jest.fn(),
  }
}));

import { NetworkUtils } from '../../utils/networkUtils';

describe('FargateGameEngineService Integration Tests', () => {
  let service: FargateGameEngineService;
  const mockPlayerId = 'test-player-123';

  beforeEach(() => {
    service = FargateGameEngineService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.removeCallbacks(mockPlayerId);
  });

  describe('Health Monitoring', () => {
    it('should check health status successfully', async () => {
      const mockHealthResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeQueues: 5,
        uptime: 3600
      };

      (NetworkUtils.fetchJson as jest.Mock).mockResolvedValue(mockHealthResponse);

      const health = await service.checkHealth();

      expect(health).toEqual(mockHealthResponse);
      expect(NetworkUtils.fetchJson).toHaveBeenCalledWith(
        'http://localhost:3001/health',
        {},
        {
          timeout: 5000,
          retries: 1,
          exponentialBackoff: false,
        }
      );
    });

    it('should handle health check failures', async () => {
      (NetworkUtils.fetchJson as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await expect(service.checkHealth()).rejects.toThrow('Connection failed');
      
      const healthStatus = service.getHealthStatus();
      expect(healthStatus.isHealthy).toBe(false);
    });
  });

  describe('Queue Synchronization', () => {
    it('should sync player queue successfully', async () => {
      const mockQueueResponse = {
        queue: {
          currentTask: null,
          queueLength: 0,
          queuedTasks: [],
          isRunning: false,
          totalCompleted: 5,
          lastUpdated: Date.now()
        }
      };

      (NetworkUtils.postJson as jest.Mock).mockResolvedValue(mockQueueResponse);

      const queue = await service.syncPlayerQueue(mockPlayerId);

      expect(queue).toEqual(mockQueueResponse.queue);
      expect(NetworkUtils.postJson).toHaveBeenCalledWith(
        'http://localhost:3001/task-queue/sync',
        { playerId: mockPlayerId },
        {
          timeout: 8000,
          retries: 2,
          exponentialBackoff: true,
        }
      );
    });

    it('should handle sync failures gracefully', async () => {
      (NetworkUtils.postJson as jest.Mock).mockRejectedValue(new Error('Sync failed'));

      await expect(service.syncPlayerQueue(mockPlayerId)).rejects.toThrow('Sync failed');
    });
  });

  describe('Task Queue Status', () => {
    it('should get task queue status successfully', async () => {
      const mockTask = TaskUtils.createTaskFromActivity(mockPlayerId, {
        id: 'copper_mining',
        name: 'Copper Mining',
        type: TaskType.HARVESTING,
        icon: '⛏️',
        description: 'Mine copper ore',
        duration: 30000
      });

      const mockStatusResponse = {
        queue: {
          currentTask: mockTask,
          queueLength: 2,
          queuedTasks: [mockTask],
          isRunning: true,
          totalCompleted: 10
        },
        currentProgress: {
          taskId: mockTask.id,
          progress: 0.5,
          timeRemaining: 15000,
          isComplete: false
        }
      };

      (NetworkUtils.fetchJson as jest.Mock).mockResolvedValue(mockStatusResponse);

      const status = await service.getTaskQueueStatus(mockPlayerId);

      expect(status).toEqual(mockStatusResponse);
      expect(NetworkUtils.fetchJson).toHaveBeenCalledWith(
        `http://localhost:3001/task-queue/${mockPlayerId}`,
        {},
        {
          timeout: 5000,
          retries: 1,
          exponentialBackoff: false,
        }
      );
    });

    it('should handle status fetch failures', async () => {
      (NetworkUtils.fetchJson as jest.Mock).mockRejectedValue(new Error('Status fetch failed'));

      await expect(service.getTaskQueueStatus(mockPlayerId)).rejects.toThrow('Status fetch failed');
    });
  });

  describe('Task Management', () => {
    it('should add task to queue successfully', async () => {
      const mockTask = TaskUtils.createTaskFromActivity(mockPlayerId, {
        id: 'gear_crafting',
        name: 'Gear Crafting',
        type: TaskType.CRAFTING,
        icon: '⚙️',
        description: 'Craft clockwork gears',
        duration: 45000
      });

      const mockSyncResponse = {
        queue: {
          currentTask: mockTask,
          queueLength: 1,
          queuedTasks: [mockTask],
          isRunning: true,
          totalCompleted: 0
        }
      };

      (NetworkUtils.postJson as jest.Mock)
        .mockResolvedValueOnce({}) // addTaskToQueue response
        .mockResolvedValueOnce(mockSyncResponse); // syncPlayerQueue response

      await service.addTaskToQueue(mockPlayerId, mockTask);

      expect(NetworkUtils.postJson).toHaveBeenCalledWith(
        'http://localhost:3001/task-queue/add-task',
        {
          playerId: mockPlayerId,
          task: mockTask
        },
        {
          timeout: 8000,
          retries: 2,
          exponentialBackoff: true,
        }
      );
    });

    it('should stop all tasks successfully', async () => {
      const mockSyncResponse = {
        queue: {
          currentTask: null,
          queueLength: 0,
          queuedTasks: [],
          isRunning: false,
          totalCompleted: 5
        }
      };

      (NetworkUtils.postJson as jest.Mock)
        .mockResolvedValueOnce({}) // stopAllTasks response
        .mockResolvedValueOnce(mockSyncResponse); // syncPlayerQueue response

      await service.stopAllTasks(mockPlayerId);

      expect(NetworkUtils.postJson).toHaveBeenCalledWith(
        'http://localhost:3001/task-queue/stop-tasks',
        { playerId: mockPlayerId },
        {
          timeout: 6000,
          retries: 1,
          exponentialBackoff: false,
        }
      );
    });
  });

  describe('Real-time Updates', () => {
    it('should register and call progress callbacks', (done) => {
      const mockProgress = {
        taskId: 'test-task-123',
        progress: 0.75,
        timeRemaining: 5000,
        isComplete: false
      };

      service.onProgress(mockPlayerId, (progress) => {
        expect(progress).toEqual(mockProgress);
        done();
      });

      // Simulate progress callback (this would normally be called by the real-time sync)
      const progressCallback = (service as any).progressCallbacks.get(mockPlayerId);
      if (progressCallback) {
        progressCallback(mockProgress);
      }
    });

    it('should register and call completion callbacks', (done) => {
      const mockTask = TaskUtils.createTaskFromActivity(mockPlayerId, {
        id: 'test_activity',
        name: 'Test Activity',
        type: TaskType.HARVESTING,
        icon: '🔧',
        description: 'Test activity',
        duration: 10000
      });

      const mockResult = {
        task: { ...mockTask, completed: true, rewards: [] },
        rewards: [
          {
            type: 'resource',
            itemId: 'copper_ore',
            quantity: 2,
            rarity: 'common',
            isRare: false,
          }
        ],
        nextTask: null
      };

      service.onTaskComplete(mockPlayerId, (result) => {
        expect(result).toEqual(mockResult);
        done();
      });

      // Simulate completion callback
      const completionCallback = (service as any).completionCallbacks.get(mockPlayerId);
      if (completionCallback) {
        completionCallback(mockResult);
      }
    });

    it('should register and call status change callbacks', (done) => {
      const mockStatus = {
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 10
      };

      service.onStatusChange(mockPlayerId, (status) => {
        expect(status).toEqual(mockStatus);
        done();
      });

      // Simulate status change callback
      const statusCallback = (service as any).statusCallbacks.get(mockPlayerId);
      if (statusCallback) {
        statusCallback(mockStatus);
      }
    });
  });

  describe('Queue Statistics', () => {
    it('should calculate queue statistics correctly', () => {
      const mockTask1 = TaskUtils.createTaskFromActivity(mockPlayerId, {
        id: 'task1',
        name: 'Task 1',
        type: TaskType.HARVESTING,
        icon: '⛏️',
        description: 'First task',
        duration: 30000
      });

      const mockTask2 = TaskUtils.createTaskFromActivity(mockPlayerId, {
        id: 'task2',
        name: 'Task 2',
        type: TaskType.CRAFTING,
        icon: '🔧',
        description: 'Second task',
        duration: 45000
      });

      // Set up mock local state
      (service as any).lastKnownState.set(mockPlayerId, {
        currentTask: { ...mockTask1, progress: 0.5 },
        queueLength: 1,
        queuedTasks: [mockTask2],
        isRunning: true,
        totalCompleted: 5
      });

      const stats = service.getQueueStatistics(mockPlayerId);

      expect(stats.totalTasksCompleted).toBe(5);
      expect(stats.averageTaskDuration).toBe(45000); // Only queued task
      expect(stats.estimatedCompletionTime).toBe(45000 + 15000); // Queued + remaining current
      expect(stats.queueEfficiencyScore).toBeGreaterThan(0.5);
    });

    it('should return default statistics for unknown player', () => {
      const stats = service.getQueueStatistics('unknown-player');

      expect(stats.totalTasksCompleted).toBe(0);
      expect(stats.averageTaskDuration).toBe(0);
      expect(stats.taskCompletionRate).toBe(0);
      expect(stats.queueEfficiencyScore).toBe(0);
      expect(stats.estimatedCompletionTime).toBe(0);
    });
  });

  describe('Callback Management', () => {
    it('should remove all callbacks for a player', () => {
      // Set up callbacks
      service.onProgress(mockPlayerId, () => {});
      service.onTaskComplete(mockPlayerId, () => {});
      service.onStatusChange(mockPlayerId, () => {});

      // Verify callbacks exist
      expect((service as any).progressCallbacks.has(mockPlayerId)).toBe(true);
      expect((service as any).completionCallbacks.has(mockPlayerId)).toBe(true);
      expect((service as any).statusCallbacks.has(mockPlayerId)).toBe(true);

      // Remove callbacks
      service.removeCallbacks(mockPlayerId);

      // Verify callbacks are removed
      expect((service as any).progressCallbacks.has(mockPlayerId)).toBe(false);
      expect((service as any).completionCallbacks.has(mockPlayerId)).toBe(false);
      expect((service as any).statusCallbacks.has(mockPlayerId)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (NetworkUtils.postJson as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.syncPlayerQueue(mockPlayerId)).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).isTimeout = true;
      
      (NetworkUtils.fetchJson as jest.Mock).mockRejectedValue(timeoutError);

      await expect(service.getTaskQueueStatus(mockPlayerId)).rejects.toThrow('Request timeout');
    });

    it('should handle server errors', async () => {
      const serverError = new Error('Internal server error');
      (serverError as any).status = 500;
      
      (NetworkUtils.postJson as jest.Mock).mockRejectedValue(serverError);

      await expect(service.syncPlayerQueue(mockPlayerId)).rejects.toThrow('Internal server error');
    });
  });

  describe('Service Lifecycle', () => {
    it('should cleanup resources on destroy', () => {
      // Set up some state
      service.onProgress(mockPlayerId, () => {});
      (service as any).lastKnownState.set(mockPlayerId, {});

      // Destroy service
      service.destroy();

      // Verify cleanup
      expect((service as any).progressCallbacks.size).toBe(0);
      expect((service as any).completionCallbacks.size).toBe(0);
      expect((service as any).statusCallbacks.size).toBe(0);
      expect((service as any).lastKnownState.size).toBe(0);
      expect((service as any).syncIntervals.size).toBe(0);
    });
  });
});