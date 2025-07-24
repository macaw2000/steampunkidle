/**
 * Optimized Task Queue Service
 * Integrates performance optimizations with task queue operations
 */

import { TaskQueue, Task, TaskProgress, TaskCompletionResult, TaskType } from '../types/taskQueue';
import { performanceOptimizationService, BatchOperation } from './performanceOptimizations';
import { TaskQueuePersistenceService } from './taskQueuePersistence';
import { TaskValidationService } from './taskValidation';
import { CharacterStats } from '../types/character';

export interface OptimizedTaskQueueConfig {
  enableCaching: boolean;
  enableBatching: boolean;
  enableConnectionPooling: boolean;
  cacheStrategy: 'aggressive' | 'conservative' | 'adaptive';
  batchStrategy: 'immediate' | 'delayed' | 'smart';
}

export class OptimizedTaskQueueService {
  private persistenceService: TaskQueuePersistenceService;
  private config: OptimizedTaskQueueConfig;
  private activeQueues: Map<string, TaskQueue> = new Map();
  private queueUpdateTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    persistenceService: TaskQueuePersistenceService,
    config: OptimizedTaskQueueConfig = {
      enableCaching: true,
      enableBatching: true,
      enableConnectionPooling: true,
      cacheStrategy: 'adaptive',
      batchStrategy: 'smart'
    }
  ) {
    this.persistenceService = persistenceService;
    this.config = config;
  }

  /**
   * Load player queue with caching optimization
   */
  async loadPlayerQueue(playerId: string): Promise<TaskQueue | undefined> {
    // Try cache first if enabled
    if (this.config.enableCaching) {
      const cachedQueue = await performanceOptimizationService.getCachedQueueState(playerId);
      if (cachedQueue) {
        this.activeQueues.set(playerId, cachedQueue);
        return cachedQueue;
      }
    }

    // Load from database with optimized connection
    const queue = await this.persistenceService.loadQueue(playerId);
    
    if (queue) {
      this.activeQueues.set(playerId, queue);
      
      // Cache the loaded queue
      if (this.config.enableCaching) {
        await this.cacheQueueState(playerId, queue);
      }
      
      return queue;
    }

    return undefined;
  }

  /**
   * Save queue with performance optimizations
   */
  async savePlayerQueue(playerId: string, queue: TaskQueue): Promise<void> {
    // Update local state
    this.activeQueues.set(playerId, queue);

    // Cache immediately for fast access
    if (this.config.enableCaching) {
      await this.cacheQueueState(playerId, queue);
    }

    // Handle persistence based on batching strategy
    if (this.config.enableBatching && this.config.batchStrategy !== 'immediate') {
      await this.batchQueueSave(playerId, queue);
    } else {
      // Immediate save
      await this.persistenceService.saveQueueWithAtomicUpdate(queue);
    }
  }

  /**
   * Add task with optimizations
   */
  async addTask(
    playerId: string,
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number }
  ): Promise<void> {
    // Validate task before processing
    const validation = TaskValidationService.validateTask(task, playerStats, playerLevel, playerInventory);
    if (!validation.isValid) {
      throw new Error(`Task validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Load current queue (with caching)
    let queue = await this.loadPlayerQueue(playerId);
    
    if (!queue) {
      // Create new queue if none exists
      queue = this.createDefaultQueue(playerId);
    }

    // Add task to queue
    queue.queuedTasks.push(task);
    queue.lastUpdated = Date.now();
    queue.version++;

    // Start task if queue is empty and not running
    if (!queue.currentTask && !queue.isRunning && queue.queuedTasks.length === 1) {
      queue.currentTask = task;
      queue.isRunning = true;
    }

    // Save with optimizations
    await this.savePlayerQueue(playerId, queue);

    // Cache task progress for real-time updates
    if (this.config.enableCaching && queue.currentTask?.id === task.id) {
      await performanceOptimizationService.cacheTaskProgress(task.id, {
        taskId: task.id,
        progress: task.progress,
        timeRemaining: this.calculateTimeRemaining(task),
        isComplete: task.completed
      });
    }
  }

  /**
   * Update task progress with caching
   */
  async updateTaskProgress(playerId: string, taskId: string, progress: number): Promise<void> {
    const queue = this.activeQueues.get(playerId);
    if (!queue || !queue.currentTask || queue.currentTask.id !== taskId) {
      return;
    }

    // Update progress
    queue.currentTask.progress = progress;
    queue.lastUpdated = Date.now();

    // Cache progress for real-time access
    if (this.config.enableCaching) {
      const taskProgress: TaskProgress = {
        taskId,
        progress,
        timeRemaining: this.calculateTimeRemaining(queue.currentTask),
        isComplete: progress >= 1.0
      };
      
      await performanceOptimizationService.cacheTaskProgress(taskId, taskProgress);
    }

    // Batch or immediate save based on strategy
    if (this.shouldBatchProgressUpdate(progress)) {
      await this.batchProgressUpdate(playerId, queue);
    } else {
      await this.savePlayerQueue(playerId, queue);
    }
  }

  /**
   * Complete task with optimized reward processing
   */
  async completeTask(playerId: string, taskId: string, rewards: any[]): Promise<TaskCompletionResult> {
    const queue = this.activeQueues.get(playerId);
    if (!queue || !queue.currentTask || queue.currentTask.id !== taskId) {
      throw new Error('Task not found or not current');
    }

    const completedTask = queue.currentTask;
    completedTask.completed = true;
    completedTask.progress = 1.0;
    completedTask.rewards = rewards;

    // Update queue statistics
    queue.totalTasksCompleted++;
    queue.totalTimeSpent += completedTask.duration;
    queue.totalRewardsEarned.push(...rewards);

    // Move to next task
    queue.queuedTasks = queue.queuedTasks.filter(t => t.id !== taskId);
    queue.currentTask = queue.queuedTasks.length > 0 ? queue.queuedTasks[0] : null;
    queue.isRunning = queue.currentTask !== null;
    queue.lastUpdated = Date.now();

    // Save queue state
    await this.savePlayerQueue(playerId, queue);

    // Cache frequent data (player stats, rewards, etc.)
    if (this.config.enableCaching) {
      await this.cacheFrequentPlayerData(playerId, {
        totalCompleted: queue.totalTasksCompleted,
        totalRewards: queue.totalRewardsEarned.length,
        currentTask: queue.currentTask?.id || null
      });
    }

    return {
      task: completedTask,
      rewards,
      nextTask: queue.currentTask
    };
  }

  /**
   * Get queue status with caching
   */
  async getQueueStatus(playerId: string): Promise<{
    currentTask: Task | null;
    queueLength: number;
    queuedTasks: Task[];
    isRunning: boolean;
    totalCompleted: number;
  }> {
    // Try to get from active queues first
    let queue = this.activeQueues.get(playerId);
    
    if (!queue) {
      // Load with caching
      queue = await this.loadPlayerQueue(playerId);
    }

    if (!queue) {
      return {
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0
      };
    }

    return {
      currentTask: queue.currentTask,
      queueLength: queue.queuedTasks.length,
      queuedTasks: queue.queuedTasks,
      isRunning: queue.isRunning,
      totalCompleted: queue.totalTasksCompleted
    };
  }

  /**
   * Remove task with batching
   */
  async removeTask(playerId: string, taskId: string): Promise<void> {
    const queue = this.activeQueues.get(playerId) || await this.loadPlayerQueue(playerId);
    if (!queue) {
      return;
    }

    // Remove from queued tasks
    queue.queuedTasks = queue.queuedTasks.filter(t => t.id !== taskId);
    
    // If removing current task, move to next
    if (queue.currentTask?.id === taskId) {
      queue.currentTask = queue.queuedTasks.length > 0 ? queue.queuedTasks[0] : null;
      queue.isRunning = queue.currentTask !== null;
    }

    queue.lastUpdated = Date.now();
    queue.version++;

    await this.savePlayerQueue(playerId, queue);
  }

  /**
   * Stop all tasks with immediate persistence
   */
  async stopAllTasks(playerId: string): Promise<void> {
    const queue = this.activeQueues.get(playerId) || await this.loadPlayerQueue(playerId);
    if (!queue) {
      return;
    }

    queue.currentTask = null;
    queue.isRunning = false;
    queue.isPaused = false;
    queue.queuedTasks = [];
    queue.lastUpdated = Date.now();
    queue.version++;

    // Force immediate save for stop operations
    await this.persistenceService.saveQueueWithAtomicUpdate(queue);
    
    // Update cache
    if (this.config.enableCaching) {
      await this.cacheQueueState(playerId, queue);
    }
  }

  /**
   * Batch multiple operations for efficiency
   */
  async batchOperations(operations: Array<{
    type: 'add' | 'remove' | 'update' | 'complete';
    playerId: string;
    taskId?: string;
    data?: any;
  }>): Promise<void> {
    // Group operations by player
    const playerOps = new Map<string, typeof operations>();
    
    for (const op of operations) {
      if (!playerOps.has(op.playerId)) {
        playerOps.set(op.playerId, []);
      }
      playerOps.get(op.playerId)!.push(op);
    }

    // Process each player's operations
    const promises = Array.from(playerOps.entries()).map(async ([playerId, ops]) => {
      const queue = this.activeQueues.get(playerId) || await this.loadPlayerQueue(playerId);
      if (!queue) return;

      let modified = false;

      for (const op of ops) {
        switch (op.type) {
          case 'add':
            if (op.data) {
              queue.queuedTasks.push(op.data);
              modified = true;
            }
            break;
          case 'remove':
            if (op.taskId) {
              const initialLength = queue.queuedTasks.length;
              queue.queuedTasks = queue.queuedTasks.filter(t => t.id !== op.taskId);
              modified = queue.queuedTasks.length !== initialLength;
            }
            break;
          case 'update':
            if (op.taskId && op.data) {
              const task = queue.queuedTasks.find(t => t.id === op.taskId);
              if (task) {
                Object.assign(task, op.data);
                modified = true;
              }
            }
            break;
        }
      }

      if (modified) {
        queue.lastUpdated = Date.now();
        queue.version++;
        await this.savePlayerQueue(playerId, queue);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Private helper methods
   */
  private async cacheQueueState(playerId: string, queue: TaskQueue): Promise<void> {
    await performanceOptimizationService.cacheActiveQueueState(playerId, queue);
  }

  private async batchQueueSave(playerId: string, queue: TaskQueue): Promise<void> {
    const operation: BatchOperation = {
      id: `queue_save_${playerId}_${Date.now()}`,
      type: 'update',
      tableName: 'task-queues',
      key: { playerId },
      data: queue,
      timestamp: Date.now(),
      priority: this.calculateSavePriority(queue)
    };

    performanceOptimizationService.addToBatch(operation);
  }

  private async batchProgressUpdate(playerId: string, queue: TaskQueue): Promise<void> {
    // Clear existing timer
    const existingTimer = this.queueUpdateTimers.get(playerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer for batched update
    const timer = setTimeout(async () => {
      await this.savePlayerQueue(playerId, queue);
      this.queueUpdateTimers.delete(playerId);
    }, 2000); // 2 second delay

    this.queueUpdateTimers.set(playerId, timer);
  }

  private shouldBatchProgressUpdate(progress: number): boolean {
    if (this.config.batchStrategy === 'immediate') {
      return false;
    }
    
    if (this.config.batchStrategy === 'delayed') {
      return true;
    }

    // Smart batching - batch frequent updates but save important milestones immediately
    const importantMilestones = [0.25, 0.5, 0.75, 1.0];
    return !importantMilestones.some(milestone => Math.abs(progress - milestone) < 0.01);
  }

  private calculateSavePriority(queue: TaskQueue): number {
    let priority = 5; // Base priority

    // Higher priority for running queues
    if (queue.isRunning) priority += 2;
    
    // Higher priority for recently updated queues
    if (Date.now() - queue.lastUpdated < 30000) priority += 1;
    
    // Higher priority for queues with many tasks
    if (queue.queuedTasks.length > 5) priority += 1;

    return Math.min(10, priority);
  }

  private calculateTimeRemaining(task: Task): number {
    const elapsed = task.progress * task.duration;
    return Math.max(0, task.duration - elapsed);
  }

  private async cacheFrequentPlayerData(playerId: string, data: any): Promise<void> {
    await performanceOptimizationService.cacheFrequentData(`player_${playerId}`, data, 600); // 10 minutes
  }

  private createDefaultQueue(playerId: string): TaskQueue {
    return {
      playerId,
      currentTask: null,
      queuedTasks: [],
      isRunning: false,
      isPaused: false,
      pauseReason: undefined,
      canResume: true,
      totalTasksCompleted: 0,
      totalTimeSpent: 0,
      totalRewardsEarned: [],
      averageTaskDuration: 0,
      taskCompletionRate: 0,
      queueEfficiencyScore: 0,
      totalPauseTime: 0,
      config: {
        maxQueueSize: 50,
        maxTaskDuration: 24 * 60 * 60 * 1000, // 24 hours
        maxTotalQueueDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
        autoStart: true,
        priorityHandling: true,
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
      checksum: '',
      lastValidated: Date.now(),
      stateHistory: [],
      maxHistorySize: 100
    };
  }

  /**
   * Performance monitoring and statistics
   */
  getPerformanceStats(): {
    activeQueues: number;
    cacheStats: any;
    memoryStats: any;
    batchStats: any;
  } {
    return {
      activeQueues: this.activeQueues.size,
      cacheStats: performanceOptimizationService.getCacheStats(),
      memoryStats: performanceOptimizationService.getMemoryStats(),
      batchStats: performanceOptimizationService.getBatchStats()
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.queueUpdateTimers.values()) {
      clearTimeout(timer);
    }
    this.queueUpdateTimers.clear();

    // Save all active queues
    const savePromises = Array.from(this.activeQueues.entries()).map(([playerId, queue]) => 
      this.persistenceService.saveQueueWithAtomicUpdate(queue)
    );
    
    await Promise.allSettled(savePromises);

    // Clear active queues
    this.activeQueues.clear();

    // Shutdown performance service
    await performanceOptimizationService.shutdown();
  }
}