/**
 * Server-side Task Queue Service
 * This service communicates with the server-side task queue processor
 * to provide true idle game functionality
 */

import { Task, TaskType, TaskProgress, TaskCompletionResult, TaskReward } from '../types/taskQueue';
import { HarvestingActivity } from '../types/harvesting';
import { taskQueueService } from './taskQueueService';

interface ServerTaskQueue {
  currentTask: Task | null;
  queueLength: number;
  queuedTasks: Task[];
  isRunning: boolean;
  totalCompleted: number;
}

interface ServerTaskProgress {
  taskId: string;
  progress: number;
  timeRemaining: number;
  isComplete: boolean;
}

class ServerTaskQueueService {
  private apiUrl: string;
  private progressCallbacks: Map<string, (progress: TaskProgress) => void> = new Map();
  private completionCallbacks: Map<string, (result: TaskCompletionResult) => void> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastKnownState: Map<string, ServerTaskQueue> = new Map();
  private useLocalFallback: boolean = false;

  constructor() {
    this.apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  }

  /**
   * Sync with server-side task queue
   */
  async syncWithServer(playerId: string): Promise<void> {
    try {
      console.log('ServerTaskQueueService: Syncing with server for player:', playerId);
      
      const response = await fetch(`${this.apiUrl}/task-queue/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync',
          playerId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server sync failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('ServerTaskQueueService: Server sync response:', data);

      // Update local state
      this.lastKnownState.set(playerId, data.queue);

      // Start real-time sync if not already running
      if (!this.syncIntervals.has(playerId)) {
        this.startRealTimeSync(playerId);
      }

    } catch (error) {
      console.error('ServerTaskQueueService: Failed to sync with server:', error);
      // Fall back to local processing if server is unavailable
      console.warn('ServerTaskQueueService: Falling back to local task processing');
      this.useLocalFallback = true;
      
      // Initialize local task queue service
      await taskQueueService.loadPlayerQueue(playerId);
    }
  }

  /**
   * Start real-time synchronization with server
   */
  private startRealTimeSync(playerId: string): void {
    // Sync with server every 5 seconds
    const interval = setInterval(async () => {
      try {
        await this.fetchServerStatus(playerId);
      } catch (error) {
        console.error('ServerTaskQueueService: Real-time sync error:', error);
      }
    }, 5000);

    this.syncIntervals.set(playerId, interval);
  }

  /**
   * Fetch current status from server
   */
  private async fetchServerStatus(playerId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/task-queue/${playerId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch server status: ${response.status}`);
      }

      const data = await response.json();
      const serverQueue: ServerTaskQueue = data.queue;
      const currentProgress: ServerTaskProgress | null = data.currentProgress;

      // Check if state changed
      const lastState = this.lastKnownState.get(playerId);
      const stateChanged = !lastState || 
        lastState.currentTask?.id !== serverQueue.currentTask?.id ||
        lastState.totalCompleted !== serverQueue.totalCompleted;

      if (stateChanged) {
        console.log('ServerTaskQueueService: Server state changed:', {
          previousTask: lastState?.currentTask?.id,
          currentTask: serverQueue.currentTask?.id,
          previousCompleted: lastState?.totalCompleted,
          currentCompleted: serverQueue.totalCompleted,
        });

        // Check if a task was completed
        if (lastState && serverQueue.totalCompleted > lastState.totalCompleted) {
          const completedTasks = serverQueue.totalCompleted - lastState.totalCompleted;
          console.log(`ServerTaskQueueService: ${completedTasks} task(s) completed on server`);
          
          // Notify completion callback
          const completionCallback = this.completionCallbacks.get(playerId);
          if (completionCallback && lastState.currentTask) {
            // Create mock completion result since server doesn't return detailed rewards
            const result: TaskCompletionResult = {
              task: { ...lastState.currentTask, completed: true, rewards: [] },
              rewards: this.generateMockRewards(lastState.currentTask),
              nextTask: serverQueue.currentTask,
            };
            completionCallback(result);
          }
        }

        // Update local state
        this.lastKnownState.set(playerId, serverQueue);
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
      console.error('ServerTaskQueueService: Failed to fetch server status:', error);
    }
  }

  /**
   * Generate mock rewards for completed tasks (until server returns detailed rewards)
   */
  private generateMockRewards(task: Task): TaskReward[] {
    const rewards: TaskReward[] = [];

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
        break;
    }

    return rewards;
  }

  /**
   * Add a harvesting task to the server queue
   */
  async addHarvestingTask(playerId: string, activity: HarvestingActivity, playerStats: any): Promise<Task> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for addHarvestingTask');
      return taskQueueService.addHarvestingTask(playerId, activity, playerStats);
    }

    const task: Task = {
      id: `harvesting-${activity.id}-${Date.now()}`,
      type: TaskType.HARVESTING,
      name: activity.name,
      description: activity.description,
      icon: activity.icon,
      duration: 15000, // 15 seconds
      startTime: 0,
      playerId,
      activityData: { activity, playerStats },
      completed: false,
    };

    try {
      const response = await fetch(`${this.apiUrl}/task-queue/add-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'addTask',
          playerId,
          task,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add task to server: ${response.status}`);
      }

      console.log('ServerTaskQueueService: Task added to server queue:', task.id);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error) {
      console.error('ServerTaskQueueService: Failed to add task to server:', error);
      // Fall back to local processing
      console.warn('ServerTaskQueueService: Falling back to local task processing');
      this.useLocalFallback = true;
      return taskQueueService.addHarvestingTask(playerId, activity, playerStats);
    }

    return task;
  }

  /**
   * Start a harvesting task immediately (replaces current task)
   */
  async startHarvestingTask(playerId: string, activity: HarvestingActivity, playerStats: any): Promise<Task> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for startHarvestingTask');
      return taskQueueService.startHarvestingTask(playerId, activity, playerStats);
    }

    // Stop current tasks first
    await this.stopAllTasks(playerId);
    
    // Add new task
    return await this.addHarvestingTask(playerId, activity, playerStats);
  }

  /**
   * Queue a harvesting task (adds to queue without interrupting current task)
   */
  async queueHarvestingTask(playerId: string, activity: HarvestingActivity, playerStats: any): Promise<Task> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for queueHarvestingTask');
      return taskQueueService.queueHarvestingTask(playerId, activity, playerStats);
    }

    return await this.addHarvestingTask(playerId, activity, playerStats);
  }

  /**
   * Stop all tasks for a player
   */
  async stopAllTasks(playerId: string): Promise<void> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for stopAllTasks');
      return taskQueueService.stopAllTasks(playerId);
    }

    try {
      const response = await fetch(`${this.apiUrl}/task-queue/stop-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'stopTasks',
          playerId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to stop tasks on server: ${response.status}`);
      }

      console.log('ServerTaskQueueService: All tasks stopped on server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error) {
      console.error('ServerTaskQueueService: Failed to stop tasks on server:', error);
      // Fall back to local processing
      console.warn('ServerTaskQueueService: Falling back to local task processing');
      this.useLocalFallback = true;
      return taskQueueService.stopAllTasks(playerId);
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus(playerId: string): {
    currentTask: Task | null;
    queueLength: number;
    queuedTasks: Task[];
    isRunning: boolean;
    totalCompleted: number;
  } {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      return taskQueueService.getQueueStatus(playerId);
    }

    const serverQueue = this.lastKnownState.get(playerId);
    
    if (!serverQueue) {
      return {
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0,
      };
    }

    return serverQueue;
  }

  /**
   * Register progress callback
   */
  onProgress(playerId: string, callback: (progress: TaskProgress) => void): void {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      return taskQueueService.onProgress(playerId, callback);
    }

    this.progressCallbacks.set(playerId, callback);
  }

  /**
   * Register completion callback
   */
  onTaskComplete(playerId: string, callback: (result: TaskCompletionResult) => void): void {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      return taskQueueService.onTaskComplete(playerId, callback);
    }

    this.completionCallbacks.set(playerId, callback);
  }

  /**
   * Remove callbacks and stop sync (cleanup)
   */
  removeCallbacks(playerId: string): void {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      return taskQueueService.removeCallbacks(playerId);
    }

    this.progressCallbacks.delete(playerId);
    this.completionCallbacks.delete(playerId);
    
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
   * Load player queue (called during authentication)
   */
  async loadPlayerQueue(playerId: string): Promise<void> {
    console.log('ServerTaskQueueService: Loading player queue from server:', playerId);
    await this.syncWithServer(playerId);
  }
}

export const serverTaskQueueService = new ServerTaskQueueService();