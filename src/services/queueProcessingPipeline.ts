/**
 * Enhanced Queue Processing Pipeline
 * Implements FIFO processing with priority support, automatic progression,
 * prerequisite validation, and exponential backoff retry logic
 */

import {
  Task,
  TaskQueue,
  TaskCompletionResult,
  TaskProgress,
  TaskType,
  TaskReward,
  TaskPrerequisite,
  ResourceRequirement,
  TaskValidationResult,
  TaskValidationOptions,
  ValidationBypassReason,
  HarvestingTaskData,
  CraftingTaskData,
  CombatTaskData
} from '../types/taskQueue';
import { queueStateManager } from './queueStateManager';
import { TaskValidationService } from './taskValidation';
import { TaskUtils } from '../utils/taskUtils';

/**
 * Queue Processing Pipeline Interface
 */
export interface QueueProcessingPipeline {
  processQueue(playerId: string): Promise<TaskQueue>;
  processTask(task: Task): Promise<TaskCompletionResult>;
  validatePrerequisites(task: Task): Promise<boolean>;
  handleTaskFailure(task: Task, error: Error): Promise<void>;
  calculateRetryDelay(retryCount: number): number;
  pauseQueueOnPrerequisiteFailure(playerId: string, reason: string): Promise<void>;
  resumeQueueWhenReady(playerId: string): Promise<boolean>;
}

/**
 * Task Retry Configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
}

/**
 * Queue Processing Statistics
 */
interface ProcessingStats {
  tasksProcessed: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksRetried: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
  lastProcessedAt: number;
}

/**
 * Enhanced Queue Processing Pipeline Implementation
 */
class QueueProcessingPipelineService implements QueueProcessingPipeline {
  private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000, // 1 second
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 2,
    jitterEnabled: true
  };

  private readonly processingStats = new Map<string, ProcessingStats>();
  private readonly activeProcessing = new Set<string>();

  /**
   * Process a player's task queue with FIFO and priority support
   */
  async processQueue(playerId: string): Promise<TaskQueue> {
    // Prevent concurrent processing of the same queue
    if (this.activeProcessing.has(playerId)) {
      console.log(`Queue processing already active for player ${playerId}`);
      const queue = await queueStateManager.loadState(playerId);
      return queue || this.createEmptyQueue(playerId);
    }

    this.activeProcessing.add(playerId);
    const startTime = Date.now();

    try {
      return await queueStateManager.atomicUpdate(playerId, async (queue) => {
        if (!queue) {
          return this.createEmptyQueue(playerId);
        }

        // Skip processing if queue is paused
        if (queue.isPaused) {
          console.log(`Queue paused for player ${playerId}: ${queue.pauseReason}`);
          return queue;
        }

        const processingResult = await this.processQueueInternal(queue);
        
        // Update processing statistics
        this.updateProcessingStats(playerId, startTime, processingResult.tasksProcessed);
        
        return processingResult.queue;
      });

    } finally {
      this.activeProcessing.delete(playerId);
    }
  }

  /**
   * Internal queue processing logic
   */
  private async processQueueInternal(queue: TaskQueue): Promise<{
    queue: TaskQueue;
    tasksProcessed: number;
  }> {
    let tasksProcessed = 0;
    const now = Date.now();

    // Process current task if it exists
    if (queue.currentTask && queue.isRunning) {
      const currentTask = queue.currentTask;
      const elapsed = now - currentTask.startTime;
      
      // Update task progress
      currentTask.progress = Math.min(elapsed / currentTask.duration, 1);
      
      // Check if task is completed
      if (elapsed >= currentTask.duration) {
        try {
          // Process task completion
          const result = await this.processTask(currentTask);
          
          // Update queue statistics
          queue.totalTasksCompleted++;
          queue.totalTimeSpent += currentTask.duration;
          queue.totalRewardsEarned.push(...result.rewards);
          
          // Clear current task
          queue.currentTask = null;
          queue.isRunning = false;
          
          tasksProcessed++;
          
          console.log(`Task ${currentTask.id} completed for player ${queue.playerId}`);
          
        } catch (error) {
          console.error(`Error processing task ${currentTask.id}:`, error);
          await this.handleTaskFailure(currentTask, error as Error);
          
          // If task failed permanently, remove it and continue
          if (currentTask.retryCount >= currentTask.maxRetries) {
            queue.currentTask = null;
            queue.isRunning = false;
            tasksProcessed++;
          }
        }
      }
    }

    // Start next task if no current task and queue is not empty
    if (!queue.currentTask && queue.queuedTasks.length > 0 && !queue.isPaused) {
      const nextTask = await this.getNextTaskToProcess(queue);
      
      if (nextTask) {
        // Validate prerequisites before starting
        const canStart = await this.validatePrerequisites(nextTask);
        
        if (canStart) {
          // Remove task from queue and start it
          queue.queuedTasks = queue.queuedTasks.filter(t => t.id !== nextTask.id);
          nextTask.startTime = now;
          nextTask.progress = 0;
          queue.currentTask = nextTask;
          queue.isRunning = true;
          
          console.log(`Started task ${nextTask.id} for player ${queue.playerId}`);
          
        } else {
          // Pause queue due to prerequisite failure
          const reason = `Prerequisites not met for task: ${nextTask.name}`;
          await this.pauseQueueOnPrerequisiteFailure(queue.playerId, reason);
          queue.isPaused = true;
          queue.pauseReason = reason;
          queue.canResume = true; // Can resume when prerequisites are met
          
          console.log(`Queue paused for player ${queue.playerId}: ${reason}`);
        }
      }
    }

    // Update queue metadata
    queue.lastUpdated = now;
    
    return {
      queue,
      tasksProcessed
    };
  }

  /**
   * Get next task to process with priority support
   */
  private async getNextTaskToProcess(queue: TaskQueue): Promise<Task | null> {
    if (queue.queuedTasks.length === 0) {
      return null;
    }

    // If priority handling is enabled, sort by priority first
    if (queue.config.priorityHandling) {
      // Sort by priority (higher priority first), then by order added (FIFO for same priority)
      const sortedTasks = [...queue.queuedTasks].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        // For same priority, maintain FIFO order (tasks added earlier have lower index)
        return queue.queuedTasks.indexOf(a) - queue.queuedTasks.indexOf(b);
      });
      
      return sortedTasks[0];
    }

    // Default FIFO processing
    return queue.queuedTasks[0];
  }

  /**
   * Process a single task
   */
  async processTask(task: Task): Promise<TaskCompletionResult> {
    console.log(`Processing ${task.type} task ${task.id} for player ${task.playerId}`);
    
    // Validate task before processing
    const validationResult = TaskValidationService.validateTask(task, {} as any, 1, {});
    if (!validationResult.isValid) {
      throw new Error(`Task validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }
    
    // Execute task-specific logic
    const rewards = await this.calculateTaskRewards(task);
    
    // Mark task as completed
    task.completed = true;
    task.rewards = rewards;
    task.progress = 1.0;
    
    // Apply rewards to player (this would integrate with character/inventory systems)
    await this.applyRewardsToPlayer(task.playerId, rewards);
    
    const result: TaskCompletionResult = {
      task,
      rewards,
      nextTask: null // Will be set by queue processor
    };
    
    return result;
  }

  /**
   * Validate task prerequisites
   */
  async validatePrerequisites(task: Task): Promise<boolean> {
    try {
      // Check all prerequisites
      for (const prerequisite of task.prerequisites) {
        const isMet = await this.checkPrerequisite(task.playerId, prerequisite);
        prerequisite.isMet = isMet;
        
        if (!isMet) {
          console.log(`Prerequisite not met for task ${task.id}: ${prerequisite.description}`);
          return false;
        }
      }
      
      // Check resource requirements
      for (const requirement of task.resourceRequirements) {
        const isSufficient = await this.checkResourceRequirement(task.playerId, requirement);
        requirement.isSufficient = isSufficient;
        
        if (!isSufficient) {
          console.log(`Resource requirement not met for task ${task.id}: ${requirement.resourceName} (need ${requirement.quantityRequired}, have ${requirement.quantityAvailable})`);
          return false;
        }
      }
      
      return true;
      
    } catch (error) {
      console.error(`Error validating prerequisites for task ${task.id}:`, error);
      return false;
    }
  }

  /**
   * Handle task failure with retry logic
   */
  async handleTaskFailure(task: Task, error: Error): Promise<void> {
    task.retryCount = (task.retryCount || 0) + 1;
    
    console.log(`Task ${task.id} failed (attempt ${task.retryCount}/${task.maxRetries}): ${error.message}`);
    
    if (task.retryCount < task.maxRetries) {
      // Calculate retry delay with exponential backoff
      const retryDelay = this.calculateRetryDelay(task.retryCount);
      
      // Reset task for retry
      task.startTime = Date.now() + retryDelay;
      task.progress = 0;
      task.completed = false;
      
      console.log(`Task ${task.id} will retry in ${retryDelay}ms`);
      
    } else {
      // Task has exceeded max retries
      console.error(`Task ${task.id} failed permanently after ${task.retryCount} attempts`);
      
      // Mark task as failed
      task.completed = false;
      task.progress = 0;
      
      // Could emit failure event here for monitoring/alerting
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount: number): number {
    const config = this.DEFAULT_RETRY_CONFIG;
    
    // Calculate exponential backoff delay
    let delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, retryCount - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, config.maxDelayMs);
    
    // Add jitter to prevent thundering herd
    if (config.jitterEnabled) {
      const jitter = delay * 0.1 * Math.random(); // Up to 10% jitter
      delay += jitter;
    }
    
    return Math.floor(delay);
  }

  /**
   * Pause queue when prerequisites are not met
   */
  async pauseQueueOnPrerequisiteFailure(playerId: string, reason: string): Promise<void> {
    try {
      await queueStateManager.atomicUpdate(playerId, (queue) => {
        if (!queue) return queue;
        
        queue.isPaused = true;
        queue.pauseReason = reason;
        queue.pausedAt = Date.now();
        queue.canResume = true; // Can resume when prerequisites are met
        queue.isRunning = false;
        
        return queue;
      });
      
      console.log(`Queue paused for player ${playerId}: ${reason}`);
      
    } catch (error) {
      console.error(`Error pausing queue for player ${playerId}:`, error);
    }
  }

  /**
   * Resume queue when prerequisites are met
   */
  async resumeQueueWhenReady(playerId: string): Promise<boolean> {
    try {
      let canResume = false;
      
      await queueStateManager.atomicUpdate(playerId, async (queue) => {
        if (!queue || !queue.isPaused || !queue.canResume) {
          return queue;
        }
        
        // Check if we can start the next task
        if (queue.queuedTasks.length > 0) {
          // Get the next task synchronously instead of using await
          const nextTask = queue.queuedTasks[0];
          
          if (nextTask) {
            const prerequisitesMet = await this.validatePrerequisites(nextTask);
            
            if (prerequisitesMet) {
              // Resume queue
              queue.isPaused = false;
              queue.pauseReason = undefined;
              queue.resumedAt = Date.now();
              
              // Calculate pause duration for statistics
              if (queue.pausedAt) {
                const pauseDuration = queue.resumedAt - queue.pausedAt;
                queue.totalPauseTime = (queue.totalPauseTime || 0) + pauseDuration;
              }
              
              canResume = true;
              console.log(`Queue resumed for player ${playerId} - prerequisites now met`);
            }
          }
        }
        
        return queue;
      });
      
      return canResume;
      
    } catch (error) {
      console.error(`Error resuming queue for player ${playerId}:`, error);
      return false;
    }
  }

  /**
   * Calculate task rewards based on task type and player stats
   */
  private async calculateTaskRewards(task: Task): Promise<TaskReward[]> {
    const rewards: TaskReward[] = [];
    
    // Task-specific rewards
    switch (task.type) {
      case TaskType.HARVESTING:
        // For harvesting, we use the specialized calculator which includes experience
        rewards.push(...await this.calculateHarvestingRewards(task));
        break;
      case TaskType.CRAFTING:
        // Base experience reward
        const craftingExperience = this.getBaseExperienceForTaskType(task.type);
        rewards.push({
          type: 'experience',
          quantity: craftingExperience,
        });
        rewards.push(...await this.calculateCraftingRewards(task));
        break;
      case TaskType.COMBAT:
        // Base experience reward
        const combatExperience = this.getBaseExperienceForTaskType(task.type);
        rewards.push({
          type: 'experience',
          quantity: combatExperience,
        });
        rewards.push(...await this.calculateCombatRewards(task));
        break;
      default:
        // Base experience reward for unknown types
        const baseExperience = this.getBaseExperienceForTaskType(task.type);
        rewards.push({
          type: 'experience',
          quantity: baseExperience,
        });
    }
    
    return rewards;
  }

  /**
   * Get base experience for task type
   */
  private getBaseExperienceForTaskType(taskType: TaskType): number {
    switch (taskType) {
      case TaskType.HARVESTING:
        return 25;
      case TaskType.CRAFTING:
        return 30;
      case TaskType.COMBAT:
        return 35;
      default:
        return 20;
    }
  }

  /**
   * Calculate harvesting-specific rewards
   */
  private async calculateHarvestingRewards(task: Task): Promise<TaskReward[]> {
    try {
      // Import the harvesting reward calculator dynamically to avoid circular dependencies
      const { HarvestingRewardCalculator } = await import('./harvestingRewardCalculator');
      
      const harvestingData = task.activityData as HarvestingTaskData;
      const playerStats = harvestingData.playerStats;
      const playerLevel = this.getPlayerLevelFromTask(task);
      
      // Use the specialized calculator for detailed reward calculation
      return HarvestingRewardCalculator.calculateRewards(task, playerStats, playerLevel);
    } catch (error) {
      console.error('Error calculating harvesting rewards:', error);
      
      // Fallback to basic rewards if calculator fails
      const rewards: TaskReward[] = [];
      
      // Add basic resource rewards
      rewards.push({
        type: 'resource',
        itemId: 'wood', // Example resource
        quantity: Math.floor(Math.random() * 5) + 1,
        rarity: 'common'
      });
      
      // Rare resource chance
      if (Math.random() < 0.1) {
        rewards.push({
          type: 'resource',
          itemId: 'rare_wood',
          quantity: 1,
          rarity: 'rare',
          isRare: true
        });
      }
      
      return rewards;
    }
  }
  
  /**
   * Get player level from task data
   */
  private getPlayerLevelFromTask(task: Task): number {
    // Try to get level from prerequisites
    const levelPrereq = task.prerequisites.find(p => p.type === 'level');
    if (levelPrereq) {
      return Number(levelPrereq.requirement) || 1;
    }
    
    // Try to get from combat data
    if (task.type === TaskType.COMBAT) {
      const combatData = task.activityData as CombatTaskData;
      return combatData.playerLevel || 1;
    }
    
    // Default level
    return 1;
  }

  /**
   * Calculate crafting-specific rewards
   */
  private async calculateCraftingRewards(task: Task): Promise<TaskReward[]> {
    const rewards: TaskReward[] = [];
    
    // Add crafted item rewards
    rewards.push({
      type: 'item',
      itemId: 'crafted_item', // Example item
      quantity: 1,
      rarity: 'common'
    });
    
    return rewards;
  }

  /**
   * Calculate combat-specific rewards
   */
  private async calculateCombatRewards(task: Task): Promise<TaskReward[]> {
    const rewards: TaskReward[] = [];
    
    // Add currency reward
    rewards.push({
      type: 'currency',
      quantity: Math.floor(Math.random() * 20) + 10,
    });
    
    // Loot drop chance
    if (Math.random() < 0.3) {
      rewards.push({
        type: 'item',
        itemId: 'combat_loot',
        quantity: 1,
        rarity: 'common'
      });
    }
    
    return rewards;
  }

  /**
   * Check individual prerequisite
   */
  private async checkPrerequisite(playerId: string, prerequisite: TaskPrerequisite): Promise<boolean> {
    // This would integrate with character/inventory systems
    // For now, return true as placeholder
    console.log(`Checking prerequisite for player ${playerId}: ${prerequisite.description}`);
    return true;
  }

  /**
   * Check resource requirement
   */
  private async checkResourceRequirement(playerId: string, requirement: ResourceRequirement): Promise<boolean> {
    // This would integrate with inventory system
    // For now, return true as placeholder
    console.log(`Checking resource requirement for player ${playerId}: ${requirement.resourceName} x${requirement.quantityRequired}`);
    return true;
  }

  /**
   * Apply rewards to player
   */
  private async applyRewardsToPlayer(playerId: string, rewards: TaskReward[]): Promise<void> {
    // This would integrate with character/inventory systems
    console.log(`Applying ${rewards.length} rewards to player ${playerId}`);
    
    for (const reward of rewards) {
      console.log(`- ${reward.type}: ${reward.quantity}${reward.itemId ? ` ${reward.itemId}` : ''}`);
    }
  }

  /**
   * Create empty queue for new player
   */
  private createEmptyQueue(playerId: string): TaskQueue {
    return {
      playerId,
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
        maxTaskDuration: 24 * 60 * 60 * 1000, // 24 hours
        maxTotalQueueDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
        autoStart: true,
        priorityHandling: false,
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
      checksum: TaskUtils.calculateChecksum(''),
      lastValidated: Date.now(),
      stateHistory: [],
      maxHistorySize: 10
    };
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(playerId: string, startTime: number, tasksProcessed: number): void {
    const processingTime = Date.now() - startTime;
    const existing = this.processingStats.get(playerId);
    
    if (existing) {
      existing.tasksProcessed += tasksProcessed;
      existing.totalProcessingTime += processingTime;
      existing.averageProcessingTime = existing.totalProcessingTime / existing.tasksProcessed;
      existing.lastProcessedAt = Date.now();
    } else {
      this.processingStats.set(playerId, {
        tasksProcessed,
        tasksCompleted: 0,
        tasksFailed: 0,
        tasksRetried: 0,
        averageProcessingTime: processingTime,
        totalProcessingTime: processingTime,
        lastProcessedAt: Date.now()
      });
    }
  }

  /**
   * Get processing statistics for a player
   */
  getProcessingStats(playerId: string): ProcessingStats | null {
    return this.processingStats.get(playerId) || null;
  }

  /**
   * Clear processing statistics for a player
   */
  clearProcessingStats(playerId: string): void {
    this.processingStats.delete(playerId);
  }
}

// Export singleton instance
export const queueProcessingPipeline = new QueueProcessingPipelineService();

// Export interface for testing is already exported above