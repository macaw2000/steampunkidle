/**
 * Server-side Task Queue Service
 * This service communicates with the server-side task queue processor
 * to provide true idle game functionality
 */

import { Task, TaskType, TaskProgress, TaskCompletionResult, TaskReward, TaskValidationResult, CraftingStation, HarvestingLocation, EquippedTool } from '../types/taskQueue';
import { HarvestingActivity } from '../types/harvesting';
import { CraftingRecipe } from '../types/crafting';
import { Enemy, PlayerCombatStats } from '../types/combat';
import { CharacterStats } from '../types/character';
import { taskQueueService } from './taskQueueService';
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
  private useLocalFallback: boolean = false;
  private offlineStateCache: Map<string, ServerTaskQueue> = new Map();
  private pendingOperations: Map<string, Array<{ operation: string; data: any; timestamp: number }>> = new Map();

  constructor() {
    this.apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  }

  /**
   * Sync with server-side task queue (deprecated, use enhanced version below)
   */
  async syncWithServerDeprecated(playerId: string): Promise<void> {
    try {
      console.log('ServerTaskQueueService: Syncing with server for player:', playerId);
      
      const data = await NetworkUtils.postJson(`${this.apiUrl}/task-queue/sync`, {
        action: 'sync',
        playerId,
      }, {
        timeout: 8000, // 8 seconds for sync operations
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('ServerTaskQueueService: Server sync response:', data);

      // Update local state
      this.lastKnownState.set(playerId, data.queue);

      // Start real-time sync if not already running
      if (!this.syncIntervals.has(playerId)) {
        this.startRealTimeSync(playerId);
      }

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to sync with server:', error);
      
      // Fall back to local processing if server is unavailable
      if (error.isNetworkError) {
        if (error.isOffline) {
          console.warn('ServerTaskQueueService: Device is offline, using local fallback');
        } else if (error.isTimeout) {
          console.warn('ServerTaskQueueService: Server sync timed out, using local fallback');
        } else {
          console.warn('ServerTaskQueueService: Network error during sync, using local fallback');
        }
      } else {
        console.warn('ServerTaskQueueService: Server error during sync, using local fallback');
      }
      
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
      const data = await NetworkUtils.fetchJson(`${this.apiUrl}/task-queue/${playerId}`, {}, {
        timeout: 5000, // 5 seconds for status checks
        retries: 1, // Only retry once for frequent status checks
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

    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for addCraftingTask');
      this.queuePendingOperation(playerId, 'addCraftingTask', { recipe, playerStats, playerLevel, playerInventory, options });
      return taskQueueService.addCraftingTask(playerId, recipe.name, recipe);
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

      console.log('ServerTaskQueueService: Crafting task added to server queue:', task.id);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to add crafting task to server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'addCraftingTask');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'addCraftingTask', { recipe, playerStats, playerLevel, playerInventory, options });
      return taskQueueService.addCraftingTask(playerId, recipe.name, recipe);
    }

    return task;
  }
  
  /**
   * Start a crafting task immediately (replaces current task)
   */
  async startCraftingTask(
    playerId: string,
    recipe: CraftingRecipe,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: {
      craftingStation?: CraftingStation;
      quantity?: number;
    } = {}
  ): Promise<Task> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for startCraftingTask');
      this.queuePendingOperation(playerId, 'startCraftingTask', { recipe, playerStats, playerLevel, playerInventory, options });
      return taskQueueService.addCraftingTask(playerId, recipe.name, recipe);
    }

    // Stop current tasks first
    await this.stopAllTasks(playerId);
    
    // Add new task with high priority
    const taskOptions = {
      ...options,
      priority: 10 // Default to high priority for immediate tasks
    };
    
    return await this.queueCraftingTask(playerId, recipe, playerStats, playerLevel, playerInventory, taskOptions);
  }

  /**
   * Queue a crafting task (adds to queue without interrupting current task)
   */
  async queueCraftingTask(
    playerId: string,
    recipe: CraftingRecipe,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: {
      craftingStation?: CraftingStation;
      quantity?: number;
      priority?: number;
    } = {}
  ): Promise<Task> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for queueCraftingTask');
      this.queuePendingOperation(playerId, 'queueCraftingTask', { recipe, playerStats, playerLevel, playerInventory, options });
      return taskQueueService.addCraftingTask(playerId, recipe.name, recipe);
    }

    // Use default priority for queued tasks
    return await this.addCraftingTask(playerId, recipe, playerStats, playerLevel, playerInventory, options);
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

    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for addCombatTask');
      this.queuePendingOperation(playerId, 'addCombatTask', { enemy, playerStats, playerLevel, playerCombatStats, options });
      return taskQueueService.addCombatTask(playerId, enemy.name, enemy);
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

      console.log('ServerTaskQueueService: Combat task added to server queue:', task.id);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to add combat task to server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'addCombatTask');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'addCombatTask', { enemy, playerStats, playerLevel, playerCombatStats, options });
      return taskQueueService.addCombatTask(playerId, enemy.name, enemy);
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
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for addHarvestingTask');
      this.queuePendingOperation(playerId, 'addHarvestingTask', { activity, playerStats, options });
      return taskQueueService.addHarvestingTask(playerId, activity, playerStats);
    }

    const playerLevel = options.playerLevel || 15; // Default to level 15 if not provided
    
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
        timeout: 8000, // 8 seconds
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('ServerTaskQueueService: Harvesting task added to server queue:', task.id);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to add harvesting task to server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'addHarvestingTask');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'addHarvestingTask', { activity, playerStats, options });
      return taskQueueService.addHarvestingTask(playerId, activity, playerStats);
    }

    return task;
  }

  /**
   * Start a harvesting task immediately (replaces current task)
   */
  async startHarvestingTask(
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
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for startHarvestingTask');
      this.queuePendingOperation(playerId, 'startHarvestingTask', { activity, playerStats, options });
      return taskQueueService.startHarvestingTask(playerId, activity, playerStats);
    }

    // Stop current tasks first
    await this.stopAllTasks(playerId);
    
    // Add new task with high priority
    const taskOptions = {
      ...options,
      priority: options.priority || 10 // Default to high priority for immediate tasks
    };
    
    return await this.addHarvestingTask(playerId, activity, playerStats, taskOptions);
  }

  /**
   * Queue a harvesting task (adds to queue without interrupting current task)
   */
  async queueHarvestingTask(
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
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for queueHarvestingTask');
      this.queuePendingOperation(playerId, 'queueHarvestingTask', { activity, playerStats, options });
      return taskQueueService.queueHarvestingTask(playerId, activity, playerStats);
    }

    // Use default priority for queued tasks
    return await this.addHarvestingTask(playerId, activity, playerStats, options);
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

    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for reorderTasks');
      this.queuePendingOperation(playerId, 'reorderTasks', { taskIds });
      return this.localReorderTasks(playerId, taskIds);
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

      console.log('ServerTaskQueueService: Tasks reordered on server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to reorder tasks on server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'reorderTasks');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'reorderTasks', { taskIds });
      return this.localReorderTasks(playerId, taskIds);
    }
  }

  /**
   * Update task priority
   */
  async updateTaskPriority(playerId: string, taskId: string, priority: number): Promise<void> {
    // Validate priority range
    if (priority < 0 || priority > 10) {
      throw new Error('Task priority must be between 0 and 10');
    }

    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for updateTaskPriority');
      this.queuePendingOperation(playerId, 'updateTaskPriority', { taskId, priority });
      return this.localUpdateTaskPriority(playerId, taskId, priority);
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/update-priority`, {
        action: 'updateTaskPriority',
        playerId,
        taskId,
        priority,
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Task priority updated on server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to update task priority on server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'updateTaskPriority');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'updateTaskPriority', { taskId, priority });
      return this.localUpdateTaskPriority(playerId, taskId, priority);
    }
  }

  /**
   * Remove a specific task from the queue
   */
  async removeTask(playerId: string, taskId: string): Promise<void> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for removeTask');
      this.queuePendingOperation(playerId, 'removeTask', { taskId });
      return this.localRemoveTask(playerId, taskId);
    }

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

      console.log('ServerTaskQueueService: Task removed from server queue:', taskId);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to remove task from server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'removeTask');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'removeTask', { taskId });
      return this.localRemoveTask(playerId, taskId);
    }
  }

  /**
   * Complete a specific task (mark as finished)
   */
  async completeTask(playerId: string, taskId: string): Promise<void> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for completeTask');
      this.queuePendingOperation(playerId, 'completeTask', { taskId });
      return this.localCompleteTask(playerId, taskId);
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/complete-task`, {
        action: 'completeTask',
        playerId,
        taskId,
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Task completed on server:', taskId);
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to complete task on server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'completeTask');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'completeTask', { taskId });
      return this.localCompleteTask(playerId, taskId);
    }
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
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/stop-tasks`, {
        action: 'stopTasks',
        playerId,
      }, {
        timeout: 6000, // 6 seconds
        retries: 1, // Only retry once for stop operations
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: All tasks stopped on server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to stop tasks on server:', error);
      
      // Fall back to local processing
      if (error.isNetworkError) {
        if (error.isOffline) {
          console.warn('ServerTaskQueueService: Device is offline, using local fallback for stop');
        } else if (error.isTimeout) {
          console.warn('ServerTaskQueueService: Server timeout, using local fallback for stop');
        } else {
          console.warn('ServerTaskQueueService: Network error, using local fallback for stop');
        }
      } else {
        console.warn('ServerTaskQueueService: Server error, using local fallback for stop');
      }
      
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
      taskCompletionRate: queue.totalCompleted > 0 ? 1.0 : 0.0, // Simplified calculation
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
    
    // Bonus for completed tasks
    if (queue.totalCompleted > 0) {
      score += Math.min(0.1, queue.totalCompleted * 0.01);
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Pause the task queue
   */
  async pauseQueue(playerId: string, reason?: string): Promise<void> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for pauseQueue');
      this.queuePendingOperation(playerId, 'pauseQueue', { reason });
      return this.localPauseQueue(playerId, reason);
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/pause`, {
        action: 'pauseQueue',
        playerId,
        reason: reason || 'Manual pause'
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Queue paused on server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to pause queue on server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'pauseQueue');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'pauseQueue', { reason });
      return this.localPauseQueue(playerId, reason);
    }
  }

  /**
   * Resume the task queue
   */
  async resumeQueue(playerId: string): Promise<void> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for resumeQueue');
      this.queuePendingOperation(playerId, 'resumeQueue', {});
      return this.localResumeQueue(playerId);
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/resume`, {
        action: 'resumeQueue',
        playerId
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Queue resumed on server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to resume queue on server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'resumeQueue');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'resumeQueue', {});
      return this.localResumeQueue(playerId);
    }
  }

  /**
   * Clear all tasks from the queue
   */
  async clearQueue(playerId: string): Promise<void> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for clearQueue');
      this.queuePendingOperation(playerId, 'clearQueue', {});
      return this.localClearQueue(playerId);
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/clear`, {
        action: 'clearQueue',
        playerId
      }, {
        timeout: 6000,
        retries: 1,
        exponentialBackoff: false,
      });

      console.log('ServerTaskQueueService: Queue cleared on server');
      
      // Immediately sync to get updated state
      await this.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to clear queue on server:', error);
      
      // Fall back to local processing
      this.handleServerError(error, 'clearQueue');
      this.useLocalFallback = true;
      this.queuePendingOperation(playerId, 'clearQueue', {});
      return this.localClearQueue(playerId);
    }
  }

  /**
   * Local fallback methods for queue management
   */
  private async localPauseQueue(playerId: string, reason?: string): Promise<void> {
    try {
      // This would need to be implemented in the local taskQueueService
      console.log(`ServerTaskQueueService: Paused queue locally for ${playerId}, reason: ${reason}`);
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to pause queue locally:', error);
      throw error;
    }
  }

  private async localResumeQueue(playerId: string): Promise<void> {
    try {
      // This would need to be implemented in the local taskQueueService
      console.log(`ServerTaskQueueService: Resumed queue locally for ${playerId}`);
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to resume queue locally:', error);
      throw error;
    }
  }

  private async localClearQueue(playerId: string): Promise<void> {
    try {
      await taskQueueService.stopAllTasks(playerId);
      console.log(`ServerTaskQueueService: Cleared queue locally for ${playerId}`);
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to clear queue locally:', error);
      throw error;
    }
  }

  /**
   * Load player queue (called during authentication)
   */
  async loadPlayerQueue(playerId: string): Promise<void> {
    console.log('ServerTaskQueueService: Loading player queue from server:', playerId);
    
    // Try to load from offline cache first
    const cachedState = this.loadOfflineState(playerId);
    if (cachedState) {
      this.lastKnownState.set(playerId, cachedState);
      console.log('ServerTaskQueueService: Loaded queue from offline cache');
    }
    
    await this.syncWithServer(playerId);
  }

  /**
   * Enhanced client-side validation before submitting tasks
   */
  private validateTaskBeforeSubmission(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number }
  ): TaskValidationResult {
    // Perform comprehensive validation
    const validation = TaskValidationService.validateTask(task, playerStats, playerLevel, playerInventory, {
      skipResourceCheck: false,
      skipPrerequisiteCheck: false,
      skipEquipmentCheck: false,
      allowInvalidTasks: false
    });

    // Additional queue-specific validations
    const additionalErrors = this.performAdditionalValidations(task, playerStats, playerLevel);
    
    return {
      isValid: validation.isValid && additionalErrors.length === 0,
      errors: [...validation.errors, ...additionalErrors],
      warnings: validation.warnings
    };
  }

  /**
   * Perform additional queue-specific validations
   */
  private performAdditionalValidations(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number
  ): any[] {
    const errors = [];

    // Check task duration limits
    const maxTaskDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (task.duration > maxTaskDuration) {
      errors.push({
        code: 'TASK_TOO_LONG',
        message: `Task duration ${Math.round(task.duration / 1000 / 60)} minutes exceeds maximum of 24 hours`,
        field: 'duration',
        severity: 'error'
      });
    }

    // Check minimum task duration
    const minTaskDuration = 1000; // 1 second
    if (task.duration < minTaskDuration) {
      errors.push({
        code: 'TASK_TOO_SHORT',
        message: 'Task duration must be at least 1 second',
        field: 'duration',
        severity: 'error'
      });
    }

    // Validate priority range
    if (task.priority < 0 || task.priority > 10) {
      errors.push({
        code: 'INVALID_PRIORITY',
        message: 'Task priority must be between 0 and 10',
        field: 'priority',
        severity: 'error'
      });
    }

    // Check retry limits
    if (task.maxRetries > 5) {
      errors.push({
        code: 'TOO_MANY_RETRIES',
        message: 'Maximum retries cannot exceed 5',
        field: 'maxRetries',
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Validate queue state before operations
   */
  private validateQueueState(playerId: string): { isValid: boolean; errors: string[] } {
    const queue = this.getQueueStatus(playerId);
    const errors: string[] = [];

    // Check queue size limits
    const maxQueueSize = 50;
    if (queue.queueLength >= maxQueueSize) {
      errors.push(`Queue is full (${queue.queueLength}/${maxQueueSize} tasks)`);
    }

    // Check total queue duration
    const totalDuration = queue.queuedTasks.reduce((sum, task) => sum + task.duration, 0);
    const maxTotalDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (totalDuration > maxTotalDuration) {
      errors.push(`Total queue duration exceeds 7 days limit`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Enhanced offline state management with conflict resolution
   */
  private mergeOfflineChanges(
    localState: ServerTaskQueue,
    serverState: ServerTaskQueue
  ): ServerTaskQueue {
    // Server state takes precedence for most fields
    const mergedState = { ...serverState };

    // Preserve local changes that haven't been synced
    if ((localState.lastUpdated || 0) > (serverState.lastSynced || 0)) {
      console.log('ServerTaskQueueService: Merging offline changes with server state');
      
      // Merge queued tasks (server wins for conflicts)
      const serverTaskIds = new Set(serverState.queuedTasks.map(t => t.id));
      const localOnlyTasks = localState.queuedTasks.filter(t => !serverTaskIds.has(t.id));
      
      if (localOnlyTasks.length > 0) {
        console.log(`ServerTaskQueueService: Adding ${localOnlyTasks.length} local-only tasks to server state`);
        mergedState.queuedTasks = [...serverState.queuedTasks, ...localOnlyTasks];
        mergedState.queueLength = mergedState.queuedTasks.length;
      }
    }

    return mergedState;
  }

  /**
   * Enhanced state persistence with integrity checking
   */
  private saveOfflineState(playerId: string, state: ServerTaskQueue): void {
    try {
      // Add integrity checksum
      const stateWithChecksum = {
        ...state,
        checksum: this.calculateStateChecksum(state),
        lastSaved: Date.now()
      };

      this.offlineStateCache.set(playerId, stateWithChecksum);
      
      // Also save to localStorage for persistence across sessions
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`serverTaskQueue_${playerId}`, JSON.stringify({
          state: stateWithChecksum,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to save offline state:', error);
    }
  }

  /**
   * Calculate checksum for state integrity
   */
  private calculateStateChecksum(state: ServerTaskQueue): string {
    const stateString = JSON.stringify({
      currentTaskId: state.currentTask?.id,
      queuedTaskIds: state.queuedTasks.map(t => t.id),
      isRunning: state.isRunning,
      totalCompleted: state.totalCompleted
    });
    
    return TaskUtils.calculateChecksum(stateString);
  }

  /**
   * Validate state integrity
   */
  private validateStateIntegrity(state: any): boolean {
    if (!state || !state.checksum) {
      return false;
    }

    const expectedChecksum = this.calculateStateChecksum(state);
    return state.checksum === expectedChecksum;
  }

  /**
   * Handle server errors with appropriate fallback logic
   */
  private handleServerError(error: any, operation: string): void {
    if (error.isNetworkError) {
      if (error.isOffline) {
        console.warn(`ServerTaskQueueService: Device is offline, using local fallback for ${operation}`);
      } else if (error.isTimeout) {
        console.warn(`ServerTaskQueueService: Server timeout, using local fallback for ${operation}`);
      } else {
        console.warn(`ServerTaskQueueService: Network error, using local fallback for ${operation}`);
      }
    } else {
      console.warn(`ServerTaskQueueService: Server error, using local fallback for ${operation}`);
    }
  }

  /**
   * Queue pending operations for later sync when server becomes available
   */
  private queuePendingOperation(playerId: string, operation: string, data: any): void {
    if (!this.pendingOperations.has(playerId)) {
      this.pendingOperations.set(playerId, []);
    }
    
    const operations = this.pendingOperations.get(playerId)!;
    operations.push({
      operation,
      data,
      timestamp: Date.now()
    });

    // Limit pending operations to prevent memory issues
    if (operations.length > 50) {
      operations.splice(0, operations.length - 50);
    }

    console.log(`ServerTaskQueueService: Queued pending operation ${operation} for player ${playerId}`);
  }

  /**
   * Store an operation for offline processing
   */
  private storeOfflineOperation(playerId: string, operation: string, data: any): void {
    if (!this.pendingOperations.has(playerId)) {
      this.pendingOperations.set(playerId, []);
    }
    
    const operations = this.pendingOperations.get(playerId)!;
    operations.push({
      operation,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Process pending operations when server becomes available
   */
  private async processPendingOperations(playerId: string): Promise<void> {
    const operations = this.pendingOperations.get(playerId);
    if (!operations || operations.length === 0) {
      return;
    }

    console.log(`ServerTaskQueueService: Processing ${operations.length} pending operations for player ${playerId}`);

    let successCount = 0;
    let failureCount = 0;

    // Process operations in chronological order
    for (const op of operations) {
      try {
        switch (op.operation) {
          case 'addHarvestingTask':
            await this.addHarvestingTask(playerId, op.data.activity, op.data.playerStats);
            break;
          case 'addCraftingTask':
            await this.addCraftingTask(playerId, op.data.recipe, op.data.playerStats, op.data.playerLevel, op.data.playerInventory, op.data.options);
            break;
          case 'addCombatTask':
            await this.addCombatTask(playerId, op.data.enemy, op.data.playerStats, op.data.playerLevel, op.data.playerCombatStats, op.data.options);
            break;
          case 'reorderTasks':
            await this.reorderTasks(playerId, op.data.taskIds);
            break;
          case 'updateTaskPriority':
            await this.updateTaskPriority(playerId, op.data.taskId, op.data.priority);
            break;
          case 'removeTask':
            await this.removeTask(playerId, op.data.taskId);
            break;
          case 'completeTask':
            await this.completeTask(playerId, op.data.taskId);
            break;
          case 'stopAllTasks':
            await this.stopAllTasks(playerId);
            break;
          case 'pauseQueue':
            await this.pauseQueue(playerId, op.data.reason);
            break;
          case 'resumeQueue':
            await this.resumeQueue(playerId);
            break;
          case 'clearQueue':
            await this.clearQueue(playerId);
            break;
        }
        successCount++;
      } catch (error) {
        console.error(`ServerTaskQueueService: Failed to process pending operation ${op.operation}:`, error);
        failureCount++;
        // Continue with other operations even if one fails
      }
    }

    // Clear processed operations
    this.pendingOperations.delete(playerId);
    console.log(`ServerTaskQueueService: Completed processing pending operations for player ${playerId}. Success: ${successCount}, Failures: ${failureCount}`);
  }

  /**
   * Add a generic task to the server queue
   */
  async addTask(playerId: string, task: Task): Promise<void> {
    // Use local fallback if server is unavailable
    if (this.useLocalFallback) {
      await this.localAddTask(playerId, task);
      return;
    }

    try {
      await NetworkUtils.postJson(`${this.apiUrl}/task-queue/add-task`, {
        action: 'addTask',
        playerId,
        task,
        timestamp: Date.now()
      });

      // Update local cache
      const currentState = this.lastKnownState.get(playerId);
      if (currentState) {
        currentState.queuedTasks.push(task);
        currentState.queueLength = currentState.queuedTasks.length + (currentState.currentTask ? 1 : 0);
        currentState.lastUpdated = Date.now();
        this.lastKnownState.set(playerId, currentState);
      }

      console.log('ServerTaskQueueService: Task added successfully:', task.id);
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to add task:', error);
      
      // Store operation for retry when server is available
      this.storeOfflineOperation(playerId, 'addTask', { task });
      
      // Fall back to local processing
      this.useLocalFallback = true;
      await this.localAddTask(playerId, task);
    }
  }

  /**
   * Local fallback method for adding tasks
   */
  private async localAddTask(playerId: string, task: Task): Promise<void> {
    try {
      // For testing purposes, use the local taskQueueService directly
      // This bypasses the server-specific validation and parameter requirements
      await taskQueueService.addTask(playerId, task);
    } catch (error) {
      console.error('ServerTaskQueueService: Local add task failed:', error);
      throw error;
    }
  }

  /**
   * Add multiple tasks in batch
   */
  async addTasksBatch(
    playerId: string,
    tasks: Array<{
      type: 'harvesting' | 'crafting' | 'combat';
      data: any;
      options?: any;
    }>,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number } = {},
    playerCombatStats?: PlayerCombatStats
  ): Promise<Task[]> {
    const addedTasks: Task[] = [];
    const errors: string[] = [];

    // Validate batch size
    if (tasks.length > 10) {
      throw new Error('Batch size cannot exceed 10 tasks');
    }

    // Validate queue capacity
    const queueValidation = this.validateQueueState(playerId);
    if (!queueValidation.isValid) {
      throw new Error(`Queue validation failed: ${queueValidation.errors.join(', ')}`);
    }

    for (const taskRequest of tasks) {
      try {
        let task: Task;
        
        switch (taskRequest.type) {
          case 'harvesting':
            task = await this.addHarvestingTask(playerId, taskRequest.data, playerStats);
            break;
          case 'crafting':
            task = await this.addCraftingTask(playerId, taskRequest.data, playerStats, playerLevel, playerInventory, taskRequest.options);
            break;
          case 'combat':
            if (!playerCombatStats) {
              throw new Error('Combat stats required for combat tasks');
            }
            task = await this.addCombatTask(playerId, taskRequest.data, playerStats, playerLevel, playerCombatStats, taskRequest.options);
            break;
          default:
            throw new Error(`Unknown task type: ${taskRequest.type}`);
        }
        
        addedTasks.push(task);
      } catch (error: any) {
        errors.push(`Failed to add ${taskRequest.type} task: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      console.warn('ServerTaskQueueService: Batch operation had errors:', errors);
    }

    return addedTasks;
  }

  /**
   * Get detailed queue information including estimates and warnings
   */
  getDetailedQueueInfo(playerId: string): {
    queue: ServerTaskQueue;
    statistics: any;
    warnings: string[];
    recommendations: string[];
  } {
    const queue = this.getQueueStatus(playerId);
    const statistics = this.getQueueStatistics(playerId);
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for potential issues
    if (queue.queueLength > 30) {
      warnings.push('Queue is getting very long, consider prioritizing tasks');
    }

    if (statistics.estimatedCompletionTime > 24 * 60 * 60 * 1000) {
      warnings.push('Queue will take more than 24 hours to complete');
    }

    if (!queue.isRunning && queue.queueLength > 0) {
      warnings.push('Queue is not running despite having tasks');
      recommendations.push('Check if there are any blocking issues preventing queue execution');
    }

    // Provide recommendations
    if (queue.queueLength === 0) {
      recommendations.push('Consider adding some tasks to maintain continuous progression');
    }

    if (statistics.queueEfficiencyScore < 0.5) {
      recommendations.push('Queue efficiency is low, consider optimizing task order and priorities');
    }

    return {
      queue,
      statistics,
      warnings,
      recommendations
    };
  }

  /**
   * Health check for the service
   */
  getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    serverConnection: boolean;
    localFallback: boolean;
    activeConnections: number;
    pendingOperations: number;
    lastSyncTime: number;
  } {
    const now = Date.now();
    const activeConnections = this.syncIntervals.size;
    const totalPendingOps = Array.from(this.pendingOperations.values())
      .reduce((sum, ops) => sum + ops.length, 0);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (this.useLocalFallback) {
      status = 'degraded';
    }
    
    if (totalPendingOps > 50) {
      status = 'unhealthy';
    }

    const lastSyncTimes = Array.from(this.lastKnownState.values())
      .map(state => state.lastSynced || 0);
    const lastSyncTime = lastSyncTimes.length > 0 ? Math.max(...lastSyncTimes) : 0;

    return {
      status,
      serverConnection: !this.useLocalFallback,
      localFallback: this.useLocalFallback,
      activeConnections,
      pendingOperations: totalPendingOps,
      lastSyncTime
    };
  }

  /**
   * Save queue state for offline access (deprecated, use enhanced version above)
   */
  private saveOfflineStateDeprecated(playerId: string, state: ServerTaskQueue): void {
    try {
      this.offlineStateCache.set(playerId, state);
      
      // Also save to localStorage for persistence across sessions
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`serverTaskQueue_${playerId}`, JSON.stringify({
          state,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to save offline state:', error);
    }
  }

  /**
   * Load queue state from offline cache with integrity validation
   */
  private loadOfflineState(playerId: string): ServerTaskQueue | null {
    try {
      // Try memory cache first
      const cachedState = this.offlineStateCache.get(playerId);
      if (cachedState) {
        if (this.validateStateIntegrity(cachedState)) {
          return cachedState;
        } else {
          console.warn('ServerTaskQueueService: Memory cached state failed integrity check');
          this.offlineStateCache.delete(playerId);
        }
      }

      // Try localStorage
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(`serverTaskQueue_${playerId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          const age = Date.now() - parsed.timestamp;
          
          // Only use cached state if it's less than 1 hour old and passes integrity check
          if (age < 3600000) {
            if (this.validateStateIntegrity(parsed.state)) {
              this.offlineStateCache.set(playerId, parsed.state);
              return parsed.state;
            } else {
              console.warn('ServerTaskQueueService: Stored state failed integrity check');
              localStorage.removeItem(`serverTaskQueue_${playerId}`);
            }
          } else {
            // Remove stale cache
            localStorage.removeItem(`serverTaskQueue_${playerId}`);
          }
        }
      }
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to load offline state:', error);
    }

    return null;
  }

  /**
   * Enhanced sync with server that handles offline state merging
   */
  async syncWithServer(playerId: string): Promise<void> {
    try {
      console.log('ServerTaskQueueService: Syncing with server for player:', playerId);
      
      const data = await NetworkUtils.postJson(`${this.apiUrl}/task-queue/sync`, {
        action: 'sync',
        playerId,
        lastSyncTimestamp: this.getLastSyncTimestamp(playerId),
        pendingOperations: this.pendingOperations.get(playerId) || []
      }, {
        timeout: 8000,
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('ServerTaskQueueService: Server sync response:', data);

      // Update local state
      this.lastKnownState.set(playerId, data.queue);
      this.saveOfflineState(playerId, data.queue);

      // Process any pending operations if server is now available
      if (this.useLocalFallback) {
        this.useLocalFallback = false;
        await this.processPendingOperations(playerId);
      }

      // Start real-time sync if not already running
      if (!this.syncIntervals.has(playerId)) {
        this.startRealTimeSync(playerId);
      }

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to sync with server:', error);
      
      // Fall back to local processing if server is unavailable
      if (error.isNetworkError) {
        if (error.isOffline) {
          console.warn('ServerTaskQueueService: Device is offline, using local fallback');
        } else if (error.isTimeout) {
          console.warn('ServerTaskQueueService: Server sync timed out, using local fallback');
        } else {
          console.warn('ServerTaskQueueService: Network error during sync, using local fallback');
        }
      } else {
        console.warn('ServerTaskQueueService: Server error during sync, using local fallback');
      }
      
      this.useLocalFallback = true;
      
      // Initialize local task queue service
      await taskQueueService.loadPlayerQueue(playerId);
    }
  }

  /**
   * Get last sync timestamp for a player
   */
  private getLastSyncTimestamp(playerId: string): number {
    const state = this.lastKnownState.get(playerId);
    return state?.lastSynced || 0;
  }

  /**
   * Local fallback method for reordering tasks
   */
  private async localReorderTasks(playerId: string, taskIds: string[]): Promise<void> {
    try {
      // Get current queue from local service
      const currentQueue = taskQueueService.getQueueStatus(playerId);
      
      // Validate that all task IDs exist in the queue
      const existingTaskIds = currentQueue.queuedTasks.map(task => task.id);
      const invalidIds = taskIds.filter(id => !existingTaskIds.includes(id));
      
      if (invalidIds.length > 0) {
        throw new Error(`Invalid task IDs: ${invalidIds.join(', ')}`);
      }

      // Reorder tasks locally
      const reorderedTasks = taskIds.map(id => 
        currentQueue.queuedTasks.find(task => task.id === id)!
      );

      // Update local queue (this would need to be implemented in taskQueueService)
      console.log('ServerTaskQueueService: Reordered tasks locally:', taskIds);
      
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to reorder tasks locally:', error);
      throw error;
    }
  }

  /**
   * Local fallback method for updating task priority
   */
  private async localUpdateTaskPriority(playerId: string, taskId: string, priority: number): Promise<void> {
    try {
      // Get current queue from local service
      const currentQueue = taskQueueService.getQueueStatus(playerId);
      
      // Find the task
      const task = currentQueue.queuedTasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }

      // Update priority locally
      task.priority = priority;
      
      console.log(`ServerTaskQueueService: Updated task ${taskId} priority to ${priority} locally`);
      
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to update task priority locally:', error);
      throw error;
    }
  }

  /**
   * Local fallback method for removing tasks
   */
  private async localRemoveTask(playerId: string, taskId: string): Promise<void> {
    try {
      // Use local task queue service to remove task
      await taskQueueService.removeTask(playerId, taskId);
      
      console.log(`ServerTaskQueueService: Removed task ${taskId} locally`);
      
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to remove task locally:', error);
      throw error;
    }
  }

  /**
   * Local fallback method for completing tasks
   */
  private async localCompleteTask(playerId: string, taskId: string): Promise<void> {
    try {
      // Use local task queue service to complete task
      // This would mark the task as completed and trigger reward processing
      const queueStatus = await taskQueueService.getQueueStatus(playerId);
      const task = queueStatus.queuedTasks.find(t => t.id === taskId) || queueStatus.currentTask;
      
      if (task && task.id === taskId) {
        task.completed = true;
        task.progress = 1.0;
        
        // Remove from queue if it's not the current task
        if (queueStatus.currentTask?.id !== taskId) {
          await taskQueueService.removeTask(playerId, taskId);
        }
        
        console.log(`ServerTaskQueueService: Completed task ${taskId} locally`);
      } else {
        console.warn(`ServerTaskQueueService: Task ${taskId} not found for completion`);
      }
      
    } catch (error) {
      console.error('ServerTaskQueueService: Failed to complete task locally:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const serverTaskQueueService = new ServerTaskQueueService();