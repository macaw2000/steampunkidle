/**
 * Unified Task Queue Service
 * Manages all game activities through a single queue system
 */

import { Task, TaskType, TaskQueue, TaskProgress, TaskCompletionResult, TaskReward } from '../types/taskQueue';
import { harvestingService } from './harvestingService';
import { HarvestingActivity, HarvestingReward } from '../types/harvesting';
import { DatabaseService, TABLE_NAMES } from './databaseService';
import { TaskUtils } from '../utils/taskUtils';

class TaskQueueService {
  private queues: Map<string, TaskQueue> = new Map();
  private progressCallbacks: Map<string, (progress: TaskProgress) => void> = new Map();
  private completionCallbacks: Map<string, (result: TaskCompletionResult) => void> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Get or create task queue for a player
   */
  getQueue(playerId: string): TaskQueue {
    if (!this.queues.has(playerId)) {
      const now = Date.now();
      this.queues.set(playerId, {
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
          maxTaskDuration: 86400000, // 24 hours in milliseconds
          maxTotalQueueDuration: 604800000, // 7 days in milliseconds
          autoStart: true,
          priorityHandling: true,
          retryEnabled: true,
          maxRetries: 3,
          validationEnabled: true,
          syncInterval: 5000,
          offlineProcessingEnabled: true,
          pauseOnError: true,
          resumeOnResourceAvailable: true,
          persistenceInterval: 60000, // 1 minute in milliseconds
          integrityCheckInterval: 300000, // 5 minutes in milliseconds
          maxHistorySize: 100
        },
        lastProcessed: new Date().toISOString(),
        lastSaved: now,
        lastUpdated: now,
        lastSynced: now,
        createdAt: now,
        pausedAt: undefined,
        resumedAt: undefined,
        version: 1,
        checksum: "initial",
        lastValidated: now,
        stateHistory: [],
        maxHistorySize: 10
      });
    }
    return this.queues.get(playerId)!;
  }

  /**
   * Load player's task queue from database
   */
  async loadPlayerQueue(playerId: string): Promise<void> {
    console.log('TaskQueueService: Loading player queue for:', playerId);
    try {
      // Load from AWS DynamoDB
      const savedQueue = await DatabaseService.getItem<TaskQueue>({
        TableName: TABLE_NAMES.TASK_QUEUES,
        Key: { playerId }
      });

      if (savedQueue) {
        console.log('TaskQueueService: Restoring queue state:', savedQueue);
        // Restore the queue state
        this.queues.set(playerId, savedQueue);
        
        // If there was an active task, resume it
        if (savedQueue.currentTask && savedQueue.isRunning) {
          console.log('TaskQueueService: Resuming task:', savedQueue.currentTask.name);
          const currentTime = Date.now();
          const elapsed = currentTime - savedQueue.currentTask.startTime;
          
          console.log(`TaskQueueService: Task was running for ${Math.floor(elapsed / 1000)}s while offline`);
          
          // Check if the task should have completed while offline
          if (elapsed >= savedQueue.currentTask.duration) {
            // Task completed while offline - complete it and continue
            console.log('TaskQueueService: Task completed while offline, processing...');
            await this.completeOfflineTask(playerId, savedQueue.currentTask);
          } else {
            // Task is still in progress - resume tracking
            console.log('TaskQueueService: Task still in progress, resuming...');
            this.startProgressTracking(playerId);
          }
        } else {
          console.log('TaskQueueService: No active task to resume - currentTask:', savedQueue.currentTask, 'isRunning:', savedQueue.isRunning);
        }
      } else {
        console.log('TaskQueueService: No saved task queue found for player:', playerId);
      }
    } catch (error) {
      console.error('TaskQueueService: Error loading player queue:', error);
      // Continue with empty queue if loading fails
    }
  }

  /**
   * Save player's task queue to database
   */
  async savePlayerQueue(playerId: string): Promise<void> {
    try {
      const queue = this.getQueue(playerId);
      const queueData = {
        ...queue,
        lastSaved: Date.now()
      };

      // Save to AWS DynamoDB
      await DatabaseService.putItem({
        TableName: TABLE_NAMES.TASK_QUEUES,
        Item: queueData
      });
      console.log('TaskQueueService: Saved task queue to database:', queueData);
    } catch (error) {
      console.error('TaskQueueService: Error saving player queue:', error);
    }
  }

  /**
   * Handle tasks that completed while player was offline
   */
  private async completeOfflineTask(playerId: string, task: Task): Promise<void> {
    const queue = this.getQueue(playerId);
    
    // Calculate how many times the task could have completed
    const currentTime = Date.now();
    const totalElapsed = currentTime - task.startTime;
    const completions = Math.floor(totalElapsed / task.duration);
    
    // Complete the task multiple times if it's an idle game loop
    for (let i = 0; i < completions; i++) {
      // Generate rewards for each completion
      const rewards = await this.generateTaskRewards(task);
      
      // Update queue stats
      queue.totalTasksCompleted++;
      queue.totalTimeSpent += task.duration;
      
      // Notify completion callback if registered
      const completionCallback = this.completionCallbacks.get(playerId);
      if (completionCallback) {
        completionCallback({
          task: { ...task, rewards, completed: true },
          rewards,
          nextTask: null
        });
      }
    }
    
    // Start a new task with the remaining time
    const remainingTime = totalElapsed % task.duration;
    const newTask = this.createIdenticalTask(task);
    newTask.startTime = currentTime - remainingTime;
    
    queue.currentTask = newTask;
    queue.isRunning = true;
    
    // Start progress tracking for the new task
    this.startProgressTracking(playerId);
    
    // Save the updated state
    await this.savePlayerQueue(playerId);
  }

  /**
   * Add a harvesting task to the queue
   */
  addHarvestingTask(playerId: string, activity: HarvestingActivity, playerStats: any): Task {
    // Use TaskUtils to create a properly structured task
    const task = TaskUtils.createHarvestingTask(playerId, activity, playerStats, 15); // Assuming level 15
    
    this.addTaskToQueue(playerId, task);
    return task;
  }

  /**
   * Start a harvesting task immediately (replaces current task)
   */
  startHarvestingTask(playerId: string, activity: HarvestingActivity, playerStats: any): Task {
    // Use TaskUtils to create a properly structured task
    const task = TaskUtils.createHarvestingTask(playerId, activity, playerStats, 15); // Assuming level 15

    // Stop current task and start this one immediately
    this.stopCurrentTask(playerId);
    this.startTask(playerId, task);
    return task;
  }

  /**
   * Queue a harvesting task (adds to queue without interrupting current task)
   */
  queueHarvestingTask(playerId: string, activity: HarvestingActivity, playerStats: any): Task {
    // Use TaskUtils to create a properly structured task
    const task = TaskUtils.createHarvestingTask(playerId, activity, playerStats, 15); // Assuming level 15

    // Always add to queue, never start immediately
    const queue = this.getQueue(playerId);
    queue.queuedTasks.push(task);
    
    // Save the updated queue state
    this.savePlayerQueue(playerId);
    
    return task;
  }

  /**
   * Add a combat task to the queue
   */
  addCombatTask(playerId: string, enemyName: string, enemyData: any): Task {
    // Create a temporary combat task structure for backward compatibility
    const task: Task = {
      id: `combat-${enemyName}-${Date.now()}`,
      type: TaskType.COMBAT,
      name: `Fighting ${enemyName}`,
      description: `Engage in combat with ${enemyName}`,
      icon: '⚔️',
      duration: 15000, // 15 seconds
      startTime: 0,
      playerId,
      activityData: {
        enemy: { enemyId: enemyName, name: enemyName, ...enemyData },
        playerLevel: 15,
        playerStats: { health: 100, maxHealth: 100, attack: 20, defense: 10, speed: 15, abilities: [] },
        equipment: [],
        combatStrategy: { strategyId: 'balanced', name: 'Balanced', description: 'Balanced approach', modifiers: [] },
        estimatedOutcome: { winProbability: 0.7, estimatedDuration: 15, expectedRewards: [], riskLevel: 'medium' as const }
      },
      prerequisites: [],
      resourceRequirements: [],
      progress: 0,
      completed: false,
      rewards: [],
      priority: 5,
      estimatedCompletion: Date.now() + 15000,
      retryCount: 0,
      maxRetries: 1,
      isValid: true,
      validationErrors: []
    };

    this.addTaskToQueue(playerId, task);
    return task;
  }

  /**
   * Add a crafting task to the queue
   */
  addCraftingTask(playerId: string, recipeName: string, recipeData: any): Task {
    // Create a temporary crafting task structure for backward compatibility
    const task: Task = {
      id: `crafting-${recipeName}-${Date.now()}`,
      type: TaskType.CRAFTING,
      name: `Crafting ${recipeName}`,
      description: `Creating ${recipeName}`,
      icon: '🔧',
      duration: 15000, // 15 seconds
      startTime: 0,
      playerId,
      activityData: {
        recipe: { recipeId: recipeName, name: recipeName, ...recipeData },
        materials: [],
        craftingStation: undefined,
        playerSkillLevel: 5,
        qualityModifier: 1.0,
        expectedOutputs: []
      },
      prerequisites: [],
      resourceRequirements: [],
      progress: 0,
      completed: false,
      rewards: [],
      priority: 5,
      estimatedCompletion: Date.now() + 15000,
      retryCount: 0,
      maxRetries: 2,
      isValid: true,
      validationErrors: []
    };

    this.addTaskToQueue(playerId, task);
    return task;
  }

  /**
   * Add a generic task to the queue
   */
  addTask(playerId: string, task: Task): void {
    this.addTaskToQueue(playerId, task);
  }

  /**
   * Add task to queue and start processing if not already running
   */
  private addTaskToQueue(playerId: string, task: Task): void {
    const queue = this.getQueue(playerId);
    
    if (!queue.currentTask) {
      // Start immediately if no current task
      this.startTask(playerId, task);
    } else {
      // Add to queue
      queue.queuedTasks.push(task);
    }
  }

  /**
   * Start processing a task
   */
  private startTask(playerId: string, task: Task): void {
    const queue = this.getQueue(playerId);
    
    task.startTime = Date.now();
    queue.currentTask = task;
    queue.isRunning = true;

    console.log('TaskQueueService: Starting task:', {
      taskName: task.name,
      taskId: task.id,
      startTime: task.startTime,
      duration: task.duration,
      playerId
    });

    // Start progress tracking
    this.startProgressTracking(playerId);
    
    // Save state to database
    this.savePlayerQueue(playerId);
  }

  /**
   * Start progress tracking for current task
   */
  private startProgressTracking(playerId: string): void {
    // Clear any existing interval
    if (this.intervals.has(playerId)) {
      clearInterval(this.intervals.get(playerId)!);
    }

    const interval = setInterval(() => {
      this.updateProgress(playerId);
    }, 100); // Update every 100ms for smooth progress

    this.intervals.set(playerId, interval);
  }

  /**
   * Update progress and check for completion
   */
  private updateProgress(playerId: string): void {
    const queue = this.getQueue(playerId);
    const task = queue.currentTask;

    if (!task) {
      this.stopProgressTracking(playerId);
      return;
    }

    const elapsed = Date.now() - task.startTime;
    const progress = Math.min(elapsed / task.duration, 1);
    const timeRemaining = Math.max(task.duration - elapsed, 0);
    const isComplete = progress >= 1;

    const progressData: TaskProgress = {
      taskId: task.id,
      progress,
      timeRemaining,
      isComplete
    };

    // Debug logging
    if (Math.random() < 0.01) { // Log 1% of the time to avoid spam
      console.log('TaskQueue Progress:', {
        taskName: task.name,
        elapsed,
        duration: task.duration,
        progress: Math.round(progress * 100) + '%',
        timeRemaining: Math.round(timeRemaining / 1000) + 's'
      });
    }

    // Notify progress callback
    const progressCallback = this.progressCallbacks.get(playerId);
    if (progressCallback) {
      progressCallback(progressData);
    } else {
      console.warn('No progress callback registered for player:', playerId);
    }

    // Check for completion
    if (isComplete) {
      this.completeCurrentTask(playerId);
    }
  }

  /**
   * Complete the current task and start next one
   */
  private async completeCurrentTask(playerId: string): Promise<void> {
    const queue = this.getQueue(playerId);
    const task = queue.currentTask;

    if (!task) return;

    // Generate rewards based on task type
    const rewards = await this.generateTaskRewards(task);
    task.rewards = rewards;
    task.completed = true;

    // Update queue stats
    queue.totalTasksCompleted++;
    queue.totalTimeSpent += task.duration;

    // Prepare completion result
    const nextTask = queue.queuedTasks.shift() || null;
    const result: TaskCompletionResult = {
      task,
      rewards,
      nextTask
    };

    // Notify completion callback
    const completionCallback = this.completionCallbacks.get(playerId);
    if (completionCallback) {
      completionCallback(result);
    }

    // Stop current progress tracking to prevent rubber-banding
    this.stopProgressTracking(playerId);
    
    // Keep the current task but mark it as completed and reset progress
    queue.isRunning = false;

    // Send a final reset signal to ensure progress bar shows 0%
    const progressCallback = this.progressCallbacks.get(playerId);
    if (progressCallback) {
      progressCallback({
        taskId: task.id,
        progress: 0,
        timeRemaining: 0,
        isComplete: false
      });
    }

    // Add a delay to ensure progress bar stays at 0% before starting new task
    setTimeout(() => {
      // Start the next task after visual reset
      if (nextTask) {
        this.startTask(playerId, nextTask);
      } else {
        // Create a new identical task to continue the idle loop
        const newTask = this.createIdenticalTask(task);
        this.startTask(playerId, newTask);
      }
    }, 300); // 300ms delay to ensure progress bar stays completely blank
  }

  /**
   * Create an identical task for continuous idle gameplay
   */
  private createIdenticalTask(originalTask: Task): Task {
    return {
      ...originalTask,
      id: `${originalTask.type}-${Date.now()}`,
      startTime: 0, // Will be set properly by startTask
      completed: false,
      rewards: []
    };
  }

  /**
   * Generate rewards based on task type
   */
  private async generateTaskRewards(task: Task): Promise<TaskReward[]> {
    switch (task.type) {
      case TaskType.HARVESTING:
        return this.generateHarvestingRewards(task);
      case TaskType.COMBAT:
        return this.generateCombatRewards(task);
      case TaskType.CRAFTING:
        return this.generateCraftingRewards(task);
      default:
        return [];
    }
  }

  /**
   * Generate harvesting rewards using enhanced system
   */
  private generateHarvestingRewards(task: Task): TaskReward[] {
    // Type guard to ensure we have harvesting data
    if (task.type !== TaskType.HARVESTING) {
      return [];
    }
    
    const harvestingData = task.activityData as any; // Temporary type assertion for backward compatibility
    const activity = harvestingData.activity || harvestingData;
    
    try {
      // Use the new enhanced reward system
      const enhancedReward = harvestingService.generateEnhancedRewards(activity.id, task.playerId);
      const rewards: TaskReward[] = [];

      // Add primary material
      rewards.push({
        type: 'resource' as const,
        itemId: enhancedReward.primaryMaterial.itemId,
        quantity: enhancedReward.primaryMaterial.quantity,
        rarity: 'common',
        isRare: false
      });

      // Add exotic item if found
      if (enhancedReward.exoticItem) {
        rewards.push({
          type: 'resource' as const,
          itemId: enhancedReward.exoticItem.itemId,
          quantity: enhancedReward.exoticItem.quantity,
          rarity: enhancedReward.exoticItem.rarity,
          isRare: true
        });
      }

      // Add experience reward
      rewards.push({
        type: 'experience' as const,
        quantity: enhancedReward.skillGained
      });

      return rewards;
    } catch (error) {
      console.error('Error generating enhanced harvesting rewards:', error);
      
      // Fallback to old system if enhanced system fails
      const harvestingRewards = harvestingService.generateRewards(activity.dropTable);
      return harvestingRewards.map((reward: HarvestingReward) => ({
        type: 'resource' as const,
        itemId: reward.itemId,
        quantity: reward.quantity,
        rarity: reward.rarity,
        isRare: reward.isRare
      }));
    }
  }

  /**
   * Generate combat rewards (placeholder)
   */
  private generateCombatRewards(task: Task): TaskReward[] {
    return [
      { type: 'experience', quantity: 25 },
      { type: 'currency', quantity: 10 }
    ];
  }

  /**
   * Generate crafting rewards (placeholder)
   */
  private generateCraftingRewards(task: Task): TaskReward[] {
    return [
      { type: 'experience', quantity: 20 },
      { type: 'item', itemId: 'crafted-item', quantity: 1 }
    ];
  }

  /**
   * Stop the current task and clear queue
   */
  stopAllTasks(playerId: string): void {
    const queue = this.getQueue(playerId);
    
    queue.currentTask = null;
    queue.queuedTasks = [];
    queue.isRunning = false;
    
    this.stopProgressTracking(playerId);
  }

  /**
   * Stop only the current task but allow queued tasks to continue
   */
  stopCurrentTask(playerId: string): void {
    const queue = this.getQueue(playerId);
    
    if (queue.currentTask) {
      queue.currentTask = null;
      
      // Start next queued task if available
      const nextTask = queue.queuedTasks.shift();
      if (nextTask) {
        this.startTask(playerId, nextTask);
      } else {
        queue.isRunning = false;
        this.stopProgressTracking(playerId);
      }
    }
  }

  /**
   * Stop progress tracking
   */
  private stopProgressTracking(playerId: string): void {
    if (this.intervals.has(playerId)) {
      clearInterval(this.intervals.get(playerId)!);
      this.intervals.delete(playerId);
    }
  }

  /**
   * Get current task progress
   */
  getCurrentProgress(playerId: string): TaskProgress | null {
    const queue = this.getQueue(playerId);
    const task = queue.currentTask;

    if (!task) return null;

    const elapsed = Date.now() - task.startTime;
    const progress = Math.min(elapsed / task.duration, 1);
    const timeRemaining = Math.max(task.duration - elapsed, 0);

    return {
      taskId: task.id,
      progress,
      timeRemaining,
      isComplete: progress >= 1
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
   * Remove callbacks (cleanup)
   */
  removeCallbacks(playerId: string): void {
    this.progressCallbacks.delete(playerId);
    this.completionCallbacks.delete(playerId);
    this.stopProgressTracking(playerId);
  }

  /**
   * Get queue status
   */
  getQueueStatus(playerId: string): {
    currentTask: Task | null;
    queueLength: number;
    queuedTasks: Task[];
    isRunning: boolean;
    totalCompleted: number;
  } {
    const queue = this.getQueue(playerId);
    
    return {
      currentTask: queue.currentTask,
      queueLength: queue.queuedTasks.length,
      queuedTasks: queue.queuedTasks,
      isRunning: queue.isRunning,
      totalCompleted: queue.totalTasksCompleted
    };
  }

  /**
   * Remove a task from the queue
   */
  async removeTask(playerId: string, taskId: string): Promise<void> {
    const queue = this.getQueue(playerId);
    
    // Check if it's the current task
    if (queue.currentTask?.id === taskId) {
      queue.currentTask = null;
      queue.isRunning = false;
    } else {
      // Remove from queued tasks
      queue.queuedTasks = queue.queuedTasks.filter(task => task.id !== taskId);
    }
    
    // Start next task if needed
    if (!queue.currentTask && queue.queuedTasks.length > 0 && !queue.isPaused) {
      queue.currentTask = queue.queuedTasks.shift() || null;
      queue.isRunning = !!queue.currentTask;
    }
  }
}

export const taskQueueService = new TaskQueueService();