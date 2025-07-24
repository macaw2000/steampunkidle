/**
 * Enhanced Task Queue Manager
 * Implements advanced queue state management with pause/resume, statistics, and persistence
 */

import {
  TaskQueue,
  TaskQueueManager,
  TaskQueueConfiguration,
  QueueStatistics,
  QueueHealthStatus,
  QueueHealthIssue,
  QueueValidationResult,
  Task,
  TaskType,
  TaskReward
} from '../types/taskQueue';
import { queueStateManager } from './queueStateManager';
import { TaskUtils } from '../utils/taskUtils';

class EnhancedTaskQueueManagerService implements TaskQueueManager {
  private readonly DEFAULT_PAUSE_REASON = 'Manual pause';
  private readonly HEALTH_CHECK_INTERVAL = 300000; // 5 minutes
  private readonly STATISTICS_CACHE_TTL = 60000; // 1 minute

  private statisticsCache = new Map<string, { stats: QueueStatistics; timestamp: number }>();
  private healthCheckTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Add task to queue with enhanced validation and configuration checks
   */
  async addTask(playerId: string, task: Task): Promise<void> {
    try {
      await queueStateManager.atomicUpdate(playerId, (queue) => {
        // Check queue size limits
        if (queue.queuedTasks.length >= queue.config.maxQueueSize) {
          throw new Error(`Queue is full (max size: ${queue.config.maxQueueSize})`);
        }

        // Check task duration limits
        if (task.duration > queue.config.maxTaskDuration) {
          throw new Error(`Task duration exceeds maximum allowed (${queue.config.maxTaskDuration}ms)`);
        }

        // Check total queue duration
        const totalDuration = this.calculateTotalQueueDuration(queue) + task.duration;
        if (totalDuration > queue.config.maxTotalQueueDuration) {
          throw new Error(`Adding task would exceed maximum total queue duration`);
        }

        // Validate task if validation is enabled
        if (queue.config.validationEnabled) {
          if (!task.isValid || task.validationErrors.length > 0) {
            throw new Error(`Task validation failed: ${task.validationErrors.join(', ')}`);
          }
        }

        // Add task to queue or start immediately
        if (!queue.currentTask && queue.config.autoStart && !queue.isPaused) {
          task.startTime = Date.now();
          queue.currentTask = task;
          queue.isRunning = true;
        } else {
          // Handle priority if enabled
          if (queue.config.priorityHandling && task.priority > 0) {
            this.insertTaskByPriority(queue.queuedTasks, task);
          } else {
            queue.queuedTasks.push(task);
          }
        }

        return queue;
      });

      console.log(`Task ${task.id} added to queue for player ${playerId}`);

    } catch (error) {
      console.error('Failed to add task to queue:', error);
      throw error;
    }
  }

  /**
   * Remove task from queue
   */
  async removeTask(playerId: string, taskId: string): Promise<void> {
    try {
      await queueStateManager.atomicUpdate(playerId, (queue) => {
        // Check if it's the current task
        if (queue.currentTask?.id === taskId) {
          queue.currentTask = null;
          queue.isRunning = false;
          
          // Start next task if auto-start is enabled and queue is not paused
          if (queue.config.autoStart && !queue.isPaused && queue.queuedTasks.length > 0) {
            const nextTask = queue.queuedTasks.shift()!;
            nextTask.startTime = Date.now();
            queue.currentTask = nextTask;
            queue.isRunning = true;
          }
        } else {
          // Remove from queued tasks
          queue.queuedTasks = queue.queuedTasks.filter(task => task.id !== taskId);
        }

        return queue;
      });

      console.log(`Task ${taskId} removed from queue for player ${playerId}`);

    } catch (error) {
      console.error('Failed to remove task from queue:', error);
      throw error;
    }
  }

  /**
   * Reorder tasks in queue
   */
  async reorderTasks(playerId: string, taskIds: string[]): Promise<void> {
    try {
      await queueStateManager.atomicUpdate(playerId, (queue) => {
        // Create new ordered array
        const reorderedTasks: Task[] = [];
        
        // Add tasks in the specified order
        for (const taskId of taskIds) {
          const task = queue.queuedTasks.find(t => t.id === taskId);
          if (task) {
            reorderedTasks.push(task);
          }
        }

        // Add any remaining tasks that weren't in the reorder list
        for (const task of queue.queuedTasks) {
          if (!taskIds.includes(task.id)) {
            reorderedTasks.push(task);
          }
        }

        queue.queuedTasks = reorderedTasks;
        return queue;
      });

      console.log(`Tasks reordered for player ${playerId}`);

    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      throw error;
    }
  }

  /**
   * Clear all tasks from queue
   */
  async clearQueue(playerId: string): Promise<void> {
    try {
      await queueStateManager.atomicUpdate(playerId, (queue) => {
        queue.currentTask = null;
        queue.queuedTasks = [];
        queue.isRunning = false;
        queue.isPaused = false;
        queue.pauseReason = undefined;
        queue.canResume = true;

        return queue;
      });

      console.log(`Queue cleared for player ${playerId}`);

    } catch (error) {
      console.error('Failed to clear queue:', error);
      throw error;
    }
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(playerId: string): Promise<TaskQueue> {
    try {
      const queue = await queueStateManager.loadState(playerId);
      
      if (!queue) {
        throw new Error('Queue not found');
      }

      return queue;

    } catch (error) {
      console.error('Failed to get queue status:', error);
      throw error;
    }
  }

  /**
   * Pause queue with reason
   * @param playerId - The player ID
   * @param reason - Optional reason for pausing
   * @param allowResume - Whether the queue can be resumed (defaults to true)
   */
  async pauseQueue(playerId: string, reason?: string, allowResume: boolean = true): Promise<void> {
    try {
      await queueStateManager.atomicUpdate(playerId, (queue) => {
        if (queue.isPaused) {
          console.warn(`Queue for player ${playerId} is already paused`);
          return queue;
        }

        // Save current state before pausing
        const snapshot = queueStateManager.createSnapshot(queue);
        if (queue.stateHistory) {
          queue.stateHistory.push(snapshot);
          // Limit history size
          if (queue.stateHistory.length > queue.maxHistorySize) {
            queue.stateHistory = queue.stateHistory.slice(-queue.maxHistorySize);
          }
        }

        queue.isPaused = true;
        queue.isRunning = false;
        queue.pauseReason = reason || this.DEFAULT_PAUSE_REASON;
        queue.pausedAt = Date.now();
        queue.canResume = allowResume;

        return queue;
      });

      console.log(`Queue paused for player ${playerId}: ${reason || this.DEFAULT_PAUSE_REASON}`);

    } catch (error) {
      console.error('Failed to pause queue:', error);
      throw error;
    }
  }

  /**
   * Resume queue from pause
   * @param playerId - The player ID
   * @param force - Whether to force resume even if canResume is false
   */
  async resumeQueue(playerId: string, force: boolean = false): Promise<void> {
    try {
      await queueStateManager.atomicUpdate(playerId, (queue) => {
        if (!queue.isPaused) {
          console.warn(`Queue for player ${playerId} is not paused`);
          return queue;
        }

        if (!queue.canResume && !force) {
          throw new Error(`Queue cannot be resumed: ${queue.pauseReason}`);
        }

        // Save current state before resuming
        const snapshot = queueStateManager.createSnapshot(queue);
        if (queue.stateHistory) {
          queue.stateHistory.push(snapshot);
          // Limit history size
          if (queue.stateHistory.length > queue.maxHistorySize) {
            queue.stateHistory = queue.stateHistory.slice(-queue.maxHistorySize);
          }
        }

        queue.isPaused = false;
        queue.pauseReason = undefined;
        queue.resumedAt = Date.now();

        // Calculate pause duration for statistics
        if (queue.pausedAt) {
          const pauseDuration = queue.resumedAt - queue.pausedAt;
          // Update total pause time (create if doesn't exist)
          queue.totalPauseTime = (queue.totalPauseTime || 0) + pauseDuration;
        }

        // Resume current task if it exists
        if (queue.currentTask && queue.config.autoStart) {
          queue.isRunning = true;
        }

        return queue;
      });

      console.log(`Queue resumed for player ${playerId}`);

    } catch (error) {
      console.error('Failed to resume queue:', error);
      throw error;
    }
  }

  /**
   * Check if queue can be resumed
   */
  async canResumeQueue(playerId: string): Promise<boolean> {
    try {
      const queue = await queueStateManager.loadState(playerId);
      return queue ? queue.canResume : false;

    } catch (error) {
      console.error('Failed to check if queue can resume:', error);
      return false;
    }
  }

  /**
   * Get pause reason
   */
  async getPauseReason(playerId: string): Promise<string | null> {
    try {
      const queue = await queueStateManager.loadState(playerId);
      return queue?.pauseReason || null;

    } catch (error) {
      console.error('Failed to get pause reason:', error);
      return null;
    }
  }

  /**
   * Update queue configuration
   */
  async updateQueueConfig(playerId: string, config: Partial<TaskQueueConfiguration>): Promise<void> {
    try {
      await queueStateManager.atomicUpdate(playerId, (queue) => {
        queue.config = { ...queue.config, ...config };
        
        // Validate new configuration
        this.validateConfiguration(queue.config);
        
        // Apply configuration changes immediately
        if (config.maxQueueSize !== undefined && queue.queuedTasks.length > config.maxQueueSize) {
          // Truncate queue if it exceeds new size limit
          queue.queuedTasks = queue.queuedTasks.slice(0, config.maxQueueSize);
        }

        return queue;
      });

      console.log(`Queue configuration updated for player ${playerId}`);

    } catch (error) {
      console.error('Failed to update queue configuration:', error);
      throw error;
    }
  }

  /**
   * Get queue configuration
   */
  async getQueueConfig(playerId: string): Promise<TaskQueueConfiguration> {
    try {
      const queue = await queueStateManager.loadState(playerId);
      
      if (!queue) {
        throw new Error('Queue not found');
      }

      return queue.config;

    } catch (error) {
      console.error('Failed to get queue configuration:', error);
      throw error;
    }
  }

  /**
   * Reset queue configuration to defaults
   */
  async resetQueueConfig(playerId: string): Promise<void> {
    try {
      const defaultConfig = this.getDefaultConfiguration();
      await this.updateQueueConfig(playerId, defaultConfig);

      console.log(`Queue configuration reset to defaults for player ${playerId}`);

    } catch (error) {
      console.error('Failed to reset queue configuration:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics with caching
   */
  async getQueueStatistics(playerId: string): Promise<QueueStatistics> {
    try {
      // Check cache first
      const cached = this.statisticsCache.get(playerId);
      if (cached && Date.now() - cached.timestamp < this.STATISTICS_CACHE_TTL) {
        return cached.stats;
      }

      const queue = await queueStateManager.loadState(playerId);
      
      if (!queue) {
        throw new Error('Queue not found');
      }

      const stats = await this.calculateStatistics(queue);
      
      // Cache the results
      this.statisticsCache.set(playerId, {
        stats,
        timestamp: Date.now()
      });

      return stats;

    } catch (error) {
      console.error('Failed to get queue statistics:', error);
      throw error;
    }
  }

  /**
   * Calculate efficiency score
   */
  async calculateEfficiencyScore(playerId: string): Promise<number> {
    try {
      const stats = await this.getQueueStatistics(playerId);
      return stats.queueEfficiencyScore;

    } catch (error) {
      console.error('Failed to calculate efficiency score:', error);
      return 0;
    }
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(playerId: string): Promise<QueueHealthStatus> {
    try {
      const queue = await queueStateManager.loadState(playerId);
      
      if (!queue) {
        throw new Error('Queue not found');
      }

      const issues: QueueHealthIssue[] = [];
      const recommendations: string[] = [];

      // Check queue size
      if (queue.queuedTasks.length > queue.config.maxQueueSize * 0.8) {
        issues.push({
          type: 'performance',
          severity: 'medium',
          message: 'Queue is nearly full',
          affectedComponent: 'queue_capacity',
          suggestedAction: 'Consider increasing max queue size or removing some tasks'
        });
        recommendations.push('Monitor queue size and consider increasing capacity');
      }

      // Check for long-running tasks
      if (queue.currentTask && Date.now() - queue.currentTask.startTime > queue.config.maxTaskDuration * 0.9) {
        issues.push({
          type: 'performance',
          severity: 'high',
          message: 'Current task is taking longer than expected',
          affectedComponent: 'task_execution',
          suggestedAction: 'Check task configuration and server performance'
        });
        recommendations.push('Review task duration limits and server capacity');
      }

      // Check pause duration
      if (queue.isPaused && queue.pausedAt && Date.now() - queue.pausedAt > 3600000) { // 1 hour
        issues.push({
          type: 'configuration',
          severity: 'low',
          message: 'Queue has been paused for over an hour',
          affectedComponent: 'queue_state',
          suggestedAction: 'Resume queue or check pause reason'
        });
        recommendations.push('Consider resuming the queue if pause is no longer needed');
      }

      // Check data integrity
      const validation = await queueStateManager.validateState(queue);
      if (!validation.isValid) {
        issues.push({
          type: 'data_integrity',
          severity: validation.errors.some(e => e.severity === 'critical') ? 'critical' : 'medium',
          message: `Queue validation failed: ${validation.errors.length} errors`,
          affectedComponent: 'queue_data',
          suggestedAction: 'Run queue repair or contact support'
        });
        recommendations.push('Run queue validation and repair if necessary');
      }

      // Determine overall health
      let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (issues.some(i => i.severity === 'critical')) {
        overall = 'critical';
      } else if (issues.some(i => i.severity === 'high' || i.severity === 'medium')) {
        overall = 'warning';
      }

      return {
        overall,
        issues,
        recommendations,
        lastChecked: Date.now(),
        nextCheckDue: Date.now() + this.HEALTH_CHECK_INTERVAL
      };

    } catch (error) {
      console.error('Failed to get queue health:', error);
      return {
        overall: 'critical',
        issues: [{
          type: 'data_integrity',
          severity: 'critical',
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          affectedComponent: 'health_system',
          suggestedAction: 'Contact support'
        }],
        recommendations: ['Contact support for assistance'],
        lastChecked: Date.now(),
        nextCheckDue: Date.now() + this.HEALTH_CHECK_INTERVAL
      };
    }
  }

  /**
   * Validate queue integrity
   */
  async validateQueueIntegrity(playerId: string): Promise<QueueValidationResult> {
    try {
      const queue = await queueStateManager.loadState(playerId);
      
      if (!queue) {
        throw new Error('Queue not found');
      }

      return await queueStateManager.validateState(queue);

    } catch (error) {
      console.error('Failed to validate queue integrity:', error);
      throw error;
    }
  }

  /**
   * Repair queue
   */
  async repairQueue(playerId: string): Promise<TaskQueue> {
    try {
      const queue = await queueStateManager.loadState(playerId);
      
      if (!queue) {
        throw new Error('Queue not found');
      }

      return await queueStateManager.repairState(queue);

    } catch (error) {
      console.error('Failed to repair queue:', error);
      throw error;
    }
  }

  /**
   * Create backup
   */
  async createBackup(playerId: string): Promise<string> {
    try {
      const queue = await queueStateManager.loadState(playerId);
      
      if (!queue) {
        throw new Error('Queue not found');
      }

      const backupId = `backup_${playerId}_${Date.now()}`;
      const snapshot = queueStateManager.createSnapshot(queue);
      
      // In a real implementation, this would save to a backup storage system
      console.log(`Backup created: ${backupId}`, snapshot);
      
      return backupId;

    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(playerId: string, backupId: string): Promise<TaskQueue> {
    try {
      // In a real implementation, this would load from backup storage
      throw new Error('Backup restore not implemented - would load from backup storage');

    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw error;
    }
  }

  /**
   * Atomic queue update
   */
  async atomicQueueUpdate(playerId: string, updateFn: (queue: TaskQueue) => TaskQueue): Promise<TaskQueue> {
    return await queueStateManager.atomicUpdate(playerId, updateFn);
  }

  /**
   * Calculate total queue duration
   */
  private calculateTotalQueueDuration(queue: TaskQueue): number {
    let total = 0;
    
    if (queue.currentTask) {
      const elapsed = Date.now() - queue.currentTask.startTime;
      total += Math.max(0, queue.currentTask.duration - elapsed);
    }
    
    for (const task of queue.queuedTasks) {
      total += task.duration;
    }
    
    return total;
  }

  /**
   * Insert task by priority
   */
  private insertTaskByPriority(tasks: Task[], newTask: Task): void {
    let insertIndex = tasks.length;
    
    for (let i = 0; i < tasks.length; i++) {
      if (newTask.priority > tasks[i].priority) {
        insertIndex = i;
        break;
      }
    }
    
    tasks.splice(insertIndex, 0, newTask);
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(config: TaskQueueConfiguration): void {
    if (config.maxQueueSize <= 0) {
      throw new Error('Max queue size must be positive');
    }
    
    if (config.maxTaskDuration <= 0) {
      throw new Error('Max task duration must be positive');
    }
    
    if (config.maxTotalQueueDuration <= 0) {
      throw new Error('Max total queue duration must be positive');
    }
    
    if (config.maxRetries < 0) {
      throw new Error('Max retries cannot be negative');
    }
  }

  /**
   * Calculate queue statistics
   */
  private async calculateStatistics(queue: TaskQueue): Promise<QueueStatistics> {
    const now = Date.now();
    
    // Calculate task type distribution
    const taskTypeDistribution: { [key in TaskType]: number } = {
      [TaskType.HARVESTING]: 0,
      [TaskType.COMBAT]: 0,
      [TaskType.CRAFTING]: 0
    };

    // Count current task
    if (queue.currentTask) {
      taskTypeDistribution[queue.currentTask.type]++;
    }

    // Count queued tasks
    for (const task of queue.queuedTasks) {
      taskTypeDistribution[task.type]++;
    }

    // Find most common task type
    let mostCommonTaskType = TaskType.HARVESTING;
    let maxCount = taskTypeDistribution[TaskType.HARVESTING];
    
    for (const [type, count] of Object.entries(taskTypeDistribution)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonTaskType = type as TaskType;
      }
    }

    // Calculate uptime and pause time
    const totalTime = now - queue.createdAt;
    
    // Calculate total pause time from history or current pause
    let pauseTime = queue.totalPauseTime || 0;
    if (queue.isPaused && queue.pausedAt) {
      pauseTime += now - queue.pausedAt;
    }
    
    const uptime = totalTime - pauseTime;

    // Calculate task completion rate
    const completionRate = queue.totalTasksCompleted > 0 
      ? Math.min(1, queue.totalTasksCompleted / (queue.totalTasksCompleted + queue.queuedTasks.length))
      : 0;

    // Calculate efficiency score (0-1)
    let efficiencyScore = 0;
    if (queue.totalTasksCompleted > 0 && totalTime > 0) {
      const activeTime = queue.totalTimeSpent;
      const utilizationRate = Math.min(1, activeTime / uptime); // Only count uptime
      efficiencyScore = (utilizationRate * 0.6) + (completionRate * 0.4);
    }

    // Calculate error rate from task retries
    let totalRetries = 0;
    let totalTasks = queue.totalTasksCompleted;
    
    if (queue.currentTask) {
      totalRetries += queue.currentTask.retryCount;
      totalTasks += 1;
    }
    
    for (const task of queue.queuedTasks) {
      totalRetries += task.retryCount;
      totalTasks += 1;
    }
    
    const errorRate = totalTasks > 0 ? totalRetries / totalTasks : 0;

    // Calculate estimated completion time for entire queue
    let estimatedCompletionTime = now;
    if (queue.currentTask) {
      const remainingTime = Math.max(0, queue.currentTask.duration - (now - queue.currentTask.startTime));
      estimatedCompletionTime += remainingTime;
    }
    
    for (const task of queue.queuedTasks) {
      estimatedCompletionTime += task.duration;
    }

    return {
      totalTasksCompleted: queue.totalTasksCompleted,
      totalTimeSpent: queue.totalTimeSpent,
      averageTaskDuration: queue.averageTaskDuration,
      taskCompletionRate: completionRate,
      queueEfficiencyScore: Math.min(1, Math.max(0, efficiencyScore)),
      mostCommonTaskType,
      taskTypeDistribution,
      rewardsEarned: queue.totalRewardsEarned,
      uptime,
      pauseTime,
      errorRate,
      estimatedCompletionTime,
      totalQueuedTasks: queue.queuedTasks.length,
      totalRetries,
      lastCalculated: now
    };
  }

  /**
   * Get default configuration
   */
  private getDefaultConfiguration(): TaskQueueConfiguration {
    return {
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
    };
  }
}

export const enhancedTaskQueueManager = new EnhancedTaskQueueManagerService();