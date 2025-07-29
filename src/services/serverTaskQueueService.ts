/**
 * Server-side Task Queue Service - AWS Only
 * This service communicates with AWS-hosted task queue processor
 * All local fallback mechanisms have been removed
 */

import { Task, TaskType, TaskProgress, TaskCompletionResult, TaskReward, TaskValidationResult, CraftingStation, HarvestingLocation, EquippedTool } from '../types/taskQueue';
import { HarvestingActivity } from '../types/harvesting';
import { CraftingRecipe } from '../types/crafting';
import { Enemy, PlayerCombatStats } from '../types/combat';
import { CharacterStats } from '../types/character';
import { NetworkUtils } from '../utils/networkUtils';
import { TaskUtils } from '../utils/taskUtils';
import { TaskValidationService } from './taskValidation';

interface ServerTaskQueue {
  currentTask: Task | null;
  queueLength: number;
  queuedTasks: Task[];
  isRunning: boolean;
  totalCompleted: number;
  lastUpdated?: number;
  lastSynced?: number;
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

  constructor() {
    this.apiUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_AWS_API_URL || '';
    if (!this.apiUrl) {
      throw new Error('AWS API URL must be configured via REACT_APP_API_URL or REACT_APP_AWS_API_URL');
    }
  }

  /**
   * Sync with server-side task queue
   */
  async syncWithServer(playerId: string): Promise<void> {
    try {
      console.log('ServerTaskQueueService: Syncing with AWS server for player:', playerId);
      
      const data = await NetworkUtils.postJson(`${this.apiUrl}/task-queue/sync`, {
        action: 'sync',
        playerId,
      }, {
        timeout: 8000,
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('ServerTaskQueueService: AWS server sync response:', data);

      // Update local state
      this.lastKnownState.set(playerId, data.queue);

      // Start real-time sync if not already running
      if (!this.syncIntervals.has(playerId)) {
        this.startRealTimeSync(playerId);
      }

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to sync with AWS server:', error);
      throw new Error(`Failed to sync with AWS server: ${error.message}`);
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
      const data = await NetworkUtils.fetchJson(`${this.apiUrl}/task-queue/${playerId}`, {}, {
        timeout: 5000,
        retries: 1,
        exponentialBackoff: false,
      });
      const serverQueue: ServerTaskQueue = data.queue;
      const currentProgress: ServerTaskProgress | null = data.currentProgress;

      // Check if state changed
      const lastState = this.lastKnownState.get(playerId);
      const stateChanged = !lastState || 
        lastState.currentTask?.id !== serverQueue.currentTask?.id ||
        lastState.totalCompleted !== serverQueue.totalCompleted;

      if (stateChanged) {
        console.log('ServerTaskQueueService: AWS server state changed:', {
          previousTask: lastState?.currentTask?.id,
          currentTask: serverQueue.currentTask?.id,
          previousCompleted: lastState?.totalCompleted,
          currentCompleted: serverQueue.totalCompleted,
        });

        // Check if a task was completed
        if (lastState && serverQueue.totalCompleted > lastState.totalCompleted) {
          const completedTasks = serverQueue.totalCompleted - lastState.totalCompleted;
          console.log(`ServerTaskQueueService: ${completedTasks} task(s) completed on AWS server`);
          
          // Notify completion callback
          const completionCallback = this.completionCallbacks.get(playerId);
          if (completionCallback && lastState.currentTask) {
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
      console.error('ServerTaskQueueService: Failed to fetch AWS server status:', error);
      throw error;
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
   * Add a crafting task to the server queue
   */
  async addCraftingTask(
    playerId: string, 
    recipe: CraftingRecipe, 
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: { priority?: number; craftingStation?: any; quantity?: number } = {}
  ): Promise<Task> {
    // Client-side validation before sending to server
    const task = TaskUtils.createCraftingTask(playerId, recipe, playerStats, playerLevel, playerInventory, options);
    const validation = this.validateTaskBeforeSubmission(task, playerStats, playerLevel, playerInventory);
    
    if (!validation.isValid) {
      throw new Error(`Task validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/add-task`, {
        action: 'addTask',
        playerId,
        task,
      }, {
        timeout: 8000,
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('ServerTaskQueueService: Crafting task added to AWS server queue:', task.id);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to add crafting task to AWS server:', error);
      throw new Error(`Failed to add crafting task to AWS server: ${error.message}`);
    }

    return task;
  }

  /**
   * Add a combat task to the server queue
   */
  async addCombatTask(
    playerId: string,
    enemy: Enemy,
    playerStats: CharacterStats,
    playerLevel: number,
    playerCombatStats: PlayerCombatStats,
    options: { priority?: number; equipment?: any[]; strategy?: any } = {}
  ): Promise<Task> {
    // Client-side validation before sending to server
    const task = TaskUtils.createCombatTask(playerId, enemy, playerStats, playerLevel, playerCombatStats, options);
    const validation = this.validateTaskBeforeSubmission(task, playerStats, playerLevel, {});
    
    if (!validation.isValid) {
      throw new Error(`Task validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/add-task`, {
        action: 'addTask',
        playerId,
        task,
      }, {
        timeout: 8000,
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('ServerTaskQueueService: Combat task added to AWS server queue:', task.id);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to add combat task to AWS server:', error);
      throw new Error(`Failed to add combat task to AWS server: ${error.message}`);
    }

    return task;
  }

  /**
   * Add a harvesting task to the server queue
   */
  async addHarvestingTask(
    playerId: string, 
    activity: HarvestingActivity, 
    playerStats: CharacterStats,
    options: {
      playerLevel?: number;
      playerInventory?: { [itemId: string]: number };
      playerEquipment?: { [slot: string]: any };
      location?: HarvestingLocation;
      tools?: EquippedTool[];
      priority?: number;
    } = {}
  ): Promise<Task> {
    const playerLevel = options.playerLevel || 15;
    
    // Use TaskUtils to create a properly structured task with enhanced options
    const task = TaskUtils.createHarvestingTask(playerId, activity, playerStats, playerLevel, {
      location: options.location || undefined,
      tools: options.tools || undefined,
      priority: options.priority,
      playerInventory: options.playerInventory,
      playerEquipment: options.playerEquipment
    });
    
    // Client-side validation before sending to server
    const validation = TaskValidationService.validateTask(
      task, 
      playerStats, 
      playerLevel, 
      options.playerInventory || {}
    );
    
    if (!validation.isValid) {
      throw new Error(`Task validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/add-task`, {
        action: 'addTask',
        playerId,
        task,
      }, {
        timeout: 8000,
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('ServerTaskQueueService: Harvesting task added to AWS server queue:', task.id);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to add harvesting task to AWS server:', error);
      throw new Error(`Failed to add harvesting task to AWS server: ${error.message}`);
    }

    return task;
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
    this.progressCallbacks.set(playerId, callback);
  }

  /**
   * Register completion callback
   */
  onTaskComplete(playerId: string, callback: (result: TaskCompletionResult) => void): void {
    this.completionCallbacks.set(playerId, callback);
  }

  /**
   * Remove callbacks and stop sync (cleanup)
   */
  removeCallbacks(playerId: string): void {
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
   * Get queue statistics and metrics
   */
  getQueueStatistics(playerId: string): {
    totalTasksCompleted: number;
    averageTaskDuration: number;
    taskCompletionRate: number;
    queueEfficiencyScore: number;
    estimatedCompletionTime: number;
  } {
    const queue = this.getQueueStatus(playerId);
    
    // Calculate estimated completion time for all queued tasks
    const estimatedCompletionTime = queue.queuedTasks.reduce((total, task) => {
      return total + task.duration;
    }, 0);

    // Add current task remaining time if applicable
    let currentTaskRemaining = 0;
    if (queue.currentTask && queue.currentTask.progress < 1) {
      currentTaskRemaining = queue.currentTask.duration * (1 - queue.currentTask.progress);
    }

    return {
      totalTasksCompleted: queue.totalCompleted,
      averageTaskDuration: queue.queuedTasks.length > 0 
        ? queue.queuedTasks.reduce((sum, task) => sum + task.duration, 0) / queue.queuedTasks.length 
        : 0,
      taskCompletionRate: queue.totalCompleted > 0 ? 1.0 : 0.0,
      queueEfficiencyScore: this.calculateEfficiencyScore(queue),
      estimatedCompletionTime: estimatedCompletionTime + currentTaskRemaining
    };
  }

  /**
   * Calculate queue efficiency score
   */
  private calculateEfficiencyScore(queue: ServerTaskQueue): number {
    // Base score starts at 50%
    let score = 0.5;
    
    // Bonus for having tasks queued (shows planning)
    if (queue.queueLength > 0) {
      score += 0.2;
    }
    
    // Bonus for queue being active
    if (queue.isRunning) {
      score += 0.2;
    }
    
    // Bonus for consistent task completion
    if (queue.totalCompleted > 10) {
      score += 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Validate task before submission to server
   */
  private validateTaskBeforeSubmission(
    task: Task, 
    playerStats: CharacterStats, 
    playerLevel: number, 
    playerInventory: { [itemId: string]: number }
  ): TaskValidationResult {
    return TaskValidationService.validateTask(task, playerStats, playerLevel, playerInventory);
  }

  /**
   * Stop all tasks for a player
   */
  async stopAllTasks(playerId: string): Promise<void> {
    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/stop-tasks`, {
        action: 'stopTasks',
        playerId,
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: All tasks stopped on AWS server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to stop tasks on AWS server:', error);
      throw new Error(`Failed to stop tasks on AWS server: ${error.message}`);
    }
  }

  /**
   * Remove a specific task from the queue
   */
  async removeTask(playerId: string, taskId: string): Promise<void> {
    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/remove-task`, {
        action: 'removeTask',
        playerId,
        taskId,
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Task removed from AWS server queue:', taskId);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to remove task from AWS server:', error);
      throw new Error(`Failed to remove task from AWS server: ${error.message}`);
    }
  }

  /**
   * Reorder tasks in the queue
   */
  async reorderTasks(playerId: string, taskIds: string[]): Promise<void> {
    // Validate task IDs
    if (!taskIds || taskIds.length === 0) {
      throw new Error('Task IDs array cannot be empty');
    }

    // Check for duplicate task IDs
    const uniqueIds = new Set(taskIds);
    if (uniqueIds.size !== taskIds.length) {
      throw new Error('Duplicate task IDs found in reorder request');
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/reorder`, {
        action: 'reorderTasks',
        playerId,
        taskIds,
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Tasks reordered on AWS server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to reorder tasks on AWS server:', error);
      throw new Error(`Failed to reorder tasks on AWS server: ${error.message}`);
    }
  }

  /**
   * Clear all tasks from the queue
   */
  async clearQueue(playerId: string): Promise<void> {
    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/clear`, {
        action: 'clearQueue',
        playerId,
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Queue cleared on AWS server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to clear queue on AWS server:', error);
      throw new Error(`Failed to clear queue on AWS server: ${error.message}`);
    }
  }

  /**
   * Pause the queue
   */
  async pauseQueue(playerId: string, reason?: string): Promise<void> {
    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/pause`, {
        action: 'pauseQueue',
        playerId,
        reason,
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Queue paused on AWS server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to pause queue on AWS server:', error);
      throw new Error(`Failed to pause queue on AWS server: ${error.message}`);
    }
  }

  /**
   * Resume the queue
   */
  async resumeQueue(playerId: string): Promise<void> {
    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/resume`, {
        action: 'resumeQueue',
        playerId,
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Queue resumed on AWS server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to resume queue on AWS server:', error);
      throw new Error(`Failed to resume queue on AWS server: ${error.message}`);
    }
  }
}

export const serverTaskQueueService = new ServerTaskQueueService();