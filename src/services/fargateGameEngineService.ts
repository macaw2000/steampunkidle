/**
 * Fargate Game Engine Service
 * React service layer for communicating with the Fargate game engine API
 * Provides real-time task queue status updates and progress display
 */

import { Task, TaskProgress, TaskCompletionResult, TaskType } from '../types/taskQueue';
import { NetworkUtils } from '../utils/networkUtils';
import { TaskUtils } from '../utils/taskUtils';

export interface FargateTaskQueue {
  currentTask: Task | null;
  queueLength: number;
  queuedTasks: Task[];
  isRunning: boolean;
  totalCompleted: number;
  lastUpdated?: number;
  lastSynced?: number;
}

export interface FargateTaskProgress {
  taskId: string;
  progress: number;
  timeRemaining: number;
  isComplete: boolean;
}

export interface FargateQueueResponse {
  queue: FargateTaskQueue;
  currentProgress: FargateTaskProgress | null;
}

export interface FargateHealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  activeQueues: number;
  uptime: number;
}

export interface TaskQueueStatistics {
  totalTasksCompleted: number;
  averageTaskDuration: number;
  taskCompletionRate: number;
  queueEfficiencyScore: number;
  estimatedCompletionTime: number;
}

export class FargateGameEngineService {
  private static instance: FargateGameEngineService;
  private apiUrl: string;
  private progressCallbacks: Map<string, (progress: TaskProgress) => void> = new Map();
  private completionCallbacks: Map<string, (result: TaskCompletionResult) => void> = new Map();
  private statusCallbacks: Map<string, (status: FargateTaskQueue) => void> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastKnownState: Map<string, FargateTaskQueue> = new Map();
  private isHealthy: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Use environment variable or default to localhost for development
    this.apiUrl = process.env.REACT_APP_FARGATE_API_URL || 'http://localhost:3001';
    this.startHealthMonitoring();
  }

  static getInstance(): FargateGameEngineService {
    if (!FargateGameEngineService.instance) {
      FargateGameEngineService.instance = new FargateGameEngineService();
    }
    return FargateGameEngineService.instance;
  }

  /**
   * Start health monitoring of the Fargate service
   */
  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        console.warn('Fargate health check failed:', error);
        this.isHealthy = false;
      }
    }, 30000);

    // Initial health check
    this.checkHealth().catch(() => {
      this.isHealthy = false;
    });
  }

  /**
   * Check health status of Fargate game engine
   */
  async checkHealth(): Promise<FargateHealthStatus> {
    try {
      const response = await NetworkUtils.fetchJson(`${this.apiUrl}/health`, {}, {
        timeout: 5000,
        retries: 1,
        exponentialBackoff: false,
      });

      this.isHealthy = response.status === 'healthy';
      this.lastHealthCheck = Date.now();

      return response;
    } catch (error) {
      this.isHealthy = false;
      throw error;
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): { isHealthy: boolean; lastCheck: number } {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastHealthCheck
    };
  }

  /**
   * Sync with Fargate task queue for a player
   */
  async syncPlayerQueue(playerId: string): Promise<FargateTaskQueue> {
    try {
      console.log('FargateGameEngineService: Syncing queue for player:', playerId);
      
      const response = await NetworkUtils.postJson(`${this.apiUrl}/task-queue/sync`, {
        playerId,
      }, {
        timeout: 8000,
        retries: 2,
        exponentialBackoff: true,
      });

      const queue: FargateTaskQueue = response.queue;
      
      // Update local state
      this.lastKnownState.set(playerId, queue);

      // Start real-time sync if not already running
      if (!this.syncIntervals.has(playerId)) {
        this.startRealTimeSync(playerId);
      }

      console.log('FargateGameEngineService: Queue synced successfully');
      return queue;

    } catch (error: any) {
      console.error('FargateGameEngineService: Failed to sync queue:', error);
      throw error;
    }
  }

  /**
   * Get current task queue status for a player
   */
  async getTaskQueueStatus(playerId: string): Promise<FargateQueueResponse> {
    try {
      const response = await NetworkUtils.fetchJson(`${this.apiUrl}/task-queue/${playerId}`, {}, {
        timeout: 5000,
        retries: 1,
        exponentialBackoff: false,
      });

      const queueResponse: FargateQueueResponse = response;
      
      // Update local state
      this.lastKnownState.set(playerId, queueResponse.queue);

      return queueResponse;
    } catch (error) {
      console.error('FargateGameEngineService: Failed to get queue status:', error);
      throw error;
    }
  }

  /**
   * Add a task to the player's queue
   */
  async addTaskToQueue(playerId: string, task: Task): Promise<void> {
    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/add-task`, {
        playerId,
        task,
      }, {
        timeout: 8000,
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('FargateGameEngineService: Task added to queue:', task.id);
      
      // Immediately sync to get updated state
      await this.syncPlayerQueue(playerId);

    } catch (error) {
      console.error('FargateGameEngineService: Failed to add task to queue:', error);
      throw error;
    }
  }

  /**
   * Stop all tasks for a player
   */
  async stopAllTasks(playerId: string): Promise<void> {
    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/stop-tasks`, {
        playerId,
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('FargateGameEngineService: All tasks stopped for player:', playerId);
      
      // Immediately sync to get updated state
      await this.syncPlayerQueue(playerId);

    } catch (error) {
      console.error('FargateGameEngineService: Failed to stop tasks:', error);
      throw error;
    }
  }

  /**
   * Start real-time synchronization with Fargate service
   */
  private startRealTimeSync(playerId: string): void {
    // Sync with Fargate every 2 seconds for real-time updates
    const interval = setInterval(async () => {
      try {
        await this.fetchAndUpdateStatus(playerId);
      } catch (error) {
        console.error('FargateGameEngineService: Real-time sync error:', error);
      }
    }, 2000);

    this.syncIntervals.set(playerId, interval);
  }

  /**
   * Fetch current status and update callbacks
   */
  private async fetchAndUpdateStatus(playerId: string): Promise<void> {
    try {
      const response = await this.getTaskQueueStatus(playerId);
      const queue = response.queue;
      const currentProgress = response.currentProgress;

      // Check if state changed
      const lastState = this.lastKnownState.get(playerId);
      const stateChanged = !lastState || 
        lastState.currentTask?.id !== queue.currentTask?.id ||
        lastState.totalCompleted !== queue.totalCompleted ||
        lastState.isRunning !== queue.isRunning;

      if (stateChanged) {
        console.log('FargateGameEngineService: Queue state changed:', {
          previousTask: lastState?.currentTask?.id,
          currentTask: queue.currentTask?.id,
          previousCompleted: lastState?.totalCompleted,
          currentCompleted: queue.totalCompleted,
          previousRunning: lastState?.isRunning,
          currentRunning: queue.isRunning,
        });

        // Check if a task was completed
        if (lastState && queue.totalCompleted > lastState.totalCompleted) {
          const completedTasks = queue.totalCompleted - lastState.totalCompleted;
          console.log(`FargateGameEngineService: ${completedTasks} task(s) completed`);
          
          // Notify completion callback
          const completionCallback = this.completionCallbacks.get(playerId);
          if (completionCallback && lastState.currentTask) {
            const result: TaskCompletionResult = {
              task: { ...lastState.currentTask, completed: true, rewards: [] },
              rewards: this.generateMockRewards(lastState.currentTask),
              nextTask: queue.currentTask,
            };
            completionCallback(result);
          }
        }

        // Update local state
        this.lastKnownState.set(playerId, queue);

        // Notify status callback
        const statusCallback = this.statusCallbacks.get(playerId);
        if (statusCallback) {
          statusCallback(queue);
        }
      }

      // Update progress callback
      if (currentProgress) {
        const progressCallback = this.progressCallbacks.get(playerId);
        if (progressCallback) {
          progressCallback({
            taskId: currentProgress.taskId,
            progress: currentProgress.progress,
            timeRemaining: currentProgress.timeRemaining,
            isComplete: currentProgress.isComplete,
          });
        }
      }

    } catch (error) {
      console.error('FargateGameEngineService: Failed to fetch status:', error);
    }
  }

  /**
   * Generate mock rewards for completed tasks
   */
  private generateMockRewards(task: Task): any[] {
    const rewards: any[] = [];

    switch (task.type) {
      case TaskType.HARVESTING:
        rewards.push({
          type: 'resource',
          itemId: 'copper_ore',
          quantity: Math.floor(Math.random() * 3) + 1,
          rarity: 'common',
          isRare: false,
        });
        rewards.push({
          type: 'experience',
          quantity: 25,
        });
        break;

      case TaskType.COMBAT:
        rewards.push({
          type: 'experience',
          quantity: 35,
        });
        rewards.push({
          type: 'currency',
          quantity: 15,
        });
        break;

      case TaskType.CRAFTING:
        rewards.push({
          type: 'experience',
          quantity: 30,
        });
        rewards.push({
          type: 'item',
          itemId: 'clockwork_gear',
          quantity: 1,
          rarity: 'common',
          isRare: false,
        });
        break;
    }

    return rewards;
  }

  /**
   * Get current queue status from local state
   */
  getLocalQueueStatus(playerId: string): FargateTaskQueue | null {
    return this.lastKnownState.get(playerId) || null;
  }

  /**
   * Calculate queue statistics
   */
  getQueueStatistics(playerId: string): TaskQueueStatistics {
    const queue = this.getLocalQueueStatus(playerId);
    
    if (!queue) {
      return {
        totalTasksCompleted: 0,
        averageTaskDuration: 0,
        taskCompletionRate: 0,
        queueEfficiencyScore: 0,
        estimatedCompletionTime: 0,
      };
    }

    // Calculate estimated completion time for all queued tasks
    const estimatedCompletionTime = queue.queuedTasks.reduce((total, task) => {
      return total + task.duration;
    }, 0);

    // Add current task remaining time if applicable
    let currentTaskRemaining = 0;
    if (queue.currentTask && queue.currentTask.progress < 1) {
      currentTaskRemaining = queue.currentTask.duration * (1 - queue.currentTask.progress);
    }

    // Calculate average task duration
    const averageTaskDuration = queue.queuedTasks.length > 0 
      ? queue.queuedTasks.reduce((sum, task) => sum + task.duration, 0) / queue.queuedTasks.length 
      : 0;

    // Calculate efficiency score
    let efficiencyScore = 0.5; // Base score
    if (queue.queuedTasks.length > 0) efficiencyScore += 0.2; // Bonus for having queued tasks
    if (queue.totalCompleted > 10) efficiencyScore += 0.1; // Bonus for experience
    if (queue.isRunning) efficiencyScore += 0.2; // Bonus for active processing

    return {
      totalTasksCompleted: queue.totalCompleted,
      averageTaskDuration,
      taskCompletionRate: queue.totalCompleted > 0 ? 1.0 : 0.0,
      queueEfficiencyScore: Math.min(1.0, efficiencyScore),
      estimatedCompletionTime: estimatedCompletionTime + currentTaskRemaining,
    };
  }

  /**
   * Register progress callback
   */
  onProgress(playerId: string, callback: (progress: TaskProgress) => void): void {
    this.progressCallbacks.set(playerId, callback);
  }

  /**
   * Register completion callback
   */
  onTaskComplete(playerId: string, callback: (result: TaskCompletionResult) => void): void {
    this.completionCallbacks.set(playerId, callback);
  }

  /**
   * Register status change callback
   */
  onStatusChange(playerId: string, callback: (status: FargateTaskQueue) => void): void {
    this.statusCallbacks.set(playerId, callback);
  }

  /**
   * Remove all callbacks for a player
   */
  removeCallbacks(playerId: string): void {
    this.progressCallbacks.delete(playerId);
    this.completionCallbacks.delete(playerId);
    this.statusCallbacks.delete(playerId);
    
    // Stop real-time sync
    const interval = this.syncIntervals.get(playerId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(playerId);
    }
    
    // Clear cached state
    this.lastKnownState.delete(playerId);
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Stop all sync intervals
    for (const interval of this.syncIntervals.values()) {
      clearInterval(interval);
    }

    // Clear all data
    this.syncIntervals.clear();
    this.lastKnownState.clear();
    this.progressCallbacks.clear();
    this.completionCallbacks.clear();
    this.statusCallbacks.clear();
  }
}

export const fargateGameEngineService = FargateGameEngineService.getInstance();
export default fargateGameEngineService;