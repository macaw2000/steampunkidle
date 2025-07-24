/**
 * Queue State Management Service
 * Handles queue persistence, validation, and atomic updates
 */

import { 
  TaskQueue, 
  QueueStateSnapshot, 
  QueueStateManager, 
  QueueValidationResult,
  QueueValidationError,
  QueueValidationWarning,
  QueueRepairAction,
  TaskQueueConfiguration,
  Task
} from '../types/taskQueue';
import { DatabaseService, TABLE_NAMES } from './databaseService';
import crypto from 'crypto';

class QueueStateManagerService implements QueueStateManager {
  private readonly CHECKSUM_ALGORITHM = 'sha256';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly ATOMIC_UPDATE_TIMEOUT = 5000; // 5 seconds

  /**
   * Save queue state with atomic updates to prevent corruption
   */
  async saveState(queue: TaskQueue): Promise<void> {
    try {
      // Update version and checksum before saving
      queue.version = (queue.version || 0) + 1;
      queue.checksum = this.calculateChecksum(queue);
      queue.lastUpdated = Date.now();

      // Create state snapshot
      const snapshot = this.createSnapshot(queue);
      
      // Add snapshot to history (keep only recent ones)
      queue.stateHistory = queue.stateHistory || [];
      queue.stateHistory.push(snapshot);
      
      // Limit history size
      if (queue.stateHistory.length > queue.maxHistorySize) {
        queue.stateHistory = queue.stateHistory.slice(-queue.maxHistorySize);
      }

      // Atomic save operation
      await this.performAtomicSave(queue);

    } catch (error) {
      console.error('Failed to save queue state:', error);
      throw new Error(`Queue state save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load queue state with integrity validation
   */
  async loadState(playerId: string): Promise<TaskQueue | null> {
    try {
      const queue = await DatabaseService.getItem<TaskQueue>({
        TableName: TABLE_NAMES.TASK_QUEUES,
        Key: { playerId },
      });

      if (!queue) {
        return null;
      }

      // Validate loaded state
      const validation = await this.validateState(queue);
      
      if (!validation.isValid) {
        console.warn(`Queue state validation failed for player ${playerId}:`, validation.errors);
        
        // Attempt to repair if possible
        if (validation.canRepair) {
          console.log(`Attempting to repair queue for player ${playerId}`);
          return await this.repairState(queue);
        } else {
          console.error(`Cannot repair queue for player ${playerId}, creating new queue`);
          return this.createDefaultQueue(playerId);
        }
      }

      return queue;

    } catch (error) {
      console.error('Failed to load queue state:', error);
      throw new Error(`Queue state load failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate queue state integrity
   */
  async validateState(queue: TaskQueue): Promise<QueueValidationResult> {
    const errors: QueueValidationError[] = [];
    const warnings: QueueValidationWarning[] = [];
    const repairActions: QueueRepairAction[] = [];

    try {
      // Validate basic structure
      if (!queue.playerId) {
        errors.push({
          code: 'MISSING_PLAYER_ID',
          message: 'Queue is missing player ID',
          severity: 'critical',
          field: 'playerId',
          suggestedFix: 'Set valid player ID'
        });
      }

      // Validate checksum
      const expectedChecksum = this.calculateChecksum(queue);
      if (queue.checksum !== expectedChecksum) {
        errors.push({
          code: 'CHECKSUM_MISMATCH',
          message: 'Queue checksum does not match calculated value',
          severity: 'major',
          field: 'checksum',
          suggestedFix: 'Recalculate and update checksum'
        });
        repairActions.push({
          type: 'update_checksum',
          description: 'Update queue checksum to match current state'
        });
      }

      // Validate timestamps
      if (queue.createdAt > Date.now()) {
        errors.push({
          code: 'INVALID_CREATED_AT',
          message: 'Created timestamp is in the future',
          severity: 'minor',
          field: 'createdAt',
          suggestedFix: 'Set created timestamp to current time'
        });
        repairActions.push({
          type: 'fix_timestamps',
          description: 'Fix invalid timestamps'
        });
      }

      if (queue.lastUpdated > Date.now()) {
        warnings.push({
          code: 'FUTURE_LAST_UPDATED',
          message: 'Last updated timestamp is in the future',
          impact: 'data_integrity',
          suggestion: 'Update timestamp to current time'
        });
      }

      // Validate pause/resume state consistency
      if (queue.isPaused && queue.isRunning) {
        errors.push({
          code: 'INCONSISTENT_PAUSE_STATE',
          message: 'Queue cannot be both paused and running',
          severity: 'major',
          field: 'isPaused',
          suggestedFix: 'Set isRunning to false when paused'
        });
        repairActions.push({
          type: 'fix_timestamps',
          description: 'Fix inconsistent pause state'
        });
      }

      if (queue.isPaused && !queue.pauseReason) {
        warnings.push({
          code: 'MISSING_PAUSE_REASON',
          message: 'Queue is paused but no pause reason is provided',
          impact: 'functionality',
          suggestion: 'Add pause reason for better tracking'
        });
      }

      if (queue.pausedAt && queue.resumedAt && queue.pausedAt > queue.resumedAt) {
        errors.push({
          code: 'INVALID_PAUSE_RESUME_SEQUENCE',
          message: 'Resume timestamp is before pause timestamp',
          severity: 'minor',
          field: 'resumedAt',
          suggestedFix: 'Fix pause/resume timestamps'
        });
        repairActions.push({
          type: 'fix_timestamps',
          description: 'Fix invalid pause/resume sequence'
        });
      }

      // Validate current task
      if (queue.currentTask) {
        const taskValidation = await this.validateTask(queue.currentTask);
        if (!taskValidation.isValid) {
          errors.push({
            code: 'INVALID_CURRENT_TASK',
            message: 'Current task is invalid',
            severity: 'major',
            field: 'currentTask',
            suggestedFix: 'Remove invalid current task'
          });
          repairActions.push({
            type: 'remove_invalid_task',
            description: 'Remove invalid current task',
            taskId: queue.currentTask.id
          });
        }
      }

      // Validate queued tasks
      const invalidTasks: string[] = [];
      for (const task of queue.queuedTasks) {
        const taskValidation = await this.validateTask(task);
        if (!taskValidation.isValid) {
          invalidTasks.push(task.id);
        }
      }

      if (invalidTasks.length > 0) {
        warnings.push({
          code: 'INVALID_QUEUED_TASKS',
          message: `${invalidTasks.length} queued tasks are invalid`,
          impact: 'functionality',
          suggestion: 'Remove invalid tasks from queue'
        });
        
        for (const taskId of invalidTasks) {
          repairActions.push({
            type: 'remove_invalid_task',
            description: 'Remove invalid queued task',
            taskId
          });
        }
      }

      // Validate queue size limits
      if (queue.queuedTasks.length > queue.config.maxQueueSize) {
        warnings.push({
          code: 'QUEUE_SIZE_EXCEEDED',
          message: `Queue size (${queue.queuedTasks.length}) exceeds maximum (${queue.config.maxQueueSize})`,
          impact: 'performance',
          suggestion: 'Remove excess tasks or increase queue size limit'
        });
      }

      // Validate statistics consistency
      if (queue.totalTasksCompleted < 0) {
        errors.push({
          code: 'NEGATIVE_COMPLETED_TASKS',
          message: 'Total completed tasks cannot be negative',
          severity: 'minor',
          field: 'totalTasksCompleted',
          suggestedFix: 'Reset to 0'
        });
        repairActions.push({
          type: 'recalculate_stats',
          description: 'Recalculate queue statistics'
        });
      }

      if (queue.totalTimeSpent < 0) {
        errors.push({
          code: 'NEGATIVE_TIME_SPENT',
          message: 'Total time spent cannot be negative',
          severity: 'minor',
          field: 'totalTimeSpent',
          suggestedFix: 'Reset to 0'
        });
        repairActions.push({
          type: 'recalculate_stats',
          description: 'Recalculate queue statistics'
        });
      }

      // Validate queue configuration
      if (!queue.config) {
        errors.push({
          code: 'MISSING_CONFIGURATION',
          message: 'Queue configuration is missing',
          severity: 'major',
          field: 'config',
          suggestedFix: 'Reset to default configuration'
        });
        repairActions.push({
          type: 'reset_state',
          description: 'Reset to default configuration'
        });
      } else {
        // Validate configuration values
        if (queue.config.maxQueueSize <= 0) {
          errors.push({
            code: 'INVALID_MAX_QUEUE_SIZE',
            message: 'Maximum queue size must be positive',
            severity: 'minor',
            field: 'config.maxQueueSize',
            suggestedFix: 'Reset to default value'
          });
          repairActions.push({
            type: 'recalculate_stats',
            description: 'Fix invalid configuration values'
          });
        }

        if (queue.config.maxTaskDuration <= 0) {
          errors.push({
            code: 'INVALID_MAX_TASK_DURATION',
            message: 'Maximum task duration must be positive',
            severity: 'minor',
            field: 'config.maxTaskDuration',
            suggestedFix: 'Reset to default value'
          });
          repairActions.push({
            type: 'recalculate_stats',
            description: 'Fix invalid configuration values'
          });
        }
      }

      // Validate state history
      if (!queue.stateHistory) {
        warnings.push({
          code: 'MISSING_STATE_HISTORY',
          message: 'Queue state history is missing',
          impact: 'data_integrity',
          suggestion: 'Initialize empty state history'
        });
        repairActions.push({
          type: 'recalculate_stats',
          description: 'Initialize state history'
        });
      } else if (queue.stateHistory.length > queue.maxHistorySize) {
        warnings.push({
          code: 'HISTORY_SIZE_EXCEEDED',
          message: `History size (${queue.stateHistory.length}) exceeds maximum (${queue.maxHistorySize})`,
          impact: 'performance',
          suggestion: 'Truncate history to maximum size'
        });
        repairActions.push({
          type: 'recalculate_stats',
          description: 'Truncate state history'
        });
      }

      // Calculate integrity score
      const totalChecks = 15; // Total number of validation checks
      const failedChecks = errors.length + warnings.length;
      const integrityScore = Math.max(0, (totalChecks - failedChecks) / totalChecks);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        integrityScore,
        canRepair: repairActions.length > 0 && errors.filter(e => e.severity === 'critical').length === 0,
        repairActions
      };

    } catch (error) {
      console.error('Error during queue validation:', error);
      return {
        isValid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'critical'
        }],
        warnings: [],
        integrityScore: 0,
        canRepair: false,
        repairActions: []
      };
    }
  }

  /**
   * Repair queue state based on validation results
   */
  async repairState(queue: TaskQueue): Promise<TaskQueue> {
    try {
      const validation = await this.validateState(queue);
      
      if (!validation.canRepair) {
        throw new Error('Queue cannot be repaired, too many critical errors');
      }

      console.log(`Repairing queue for player ${queue.playerId} with ${validation.repairActions.length} actions`);

      // Apply repair actions
      for (const action of validation.repairActions) {
        switch (action.type) {
          case 'remove_invalid_task':
            if (action.taskId) {
              if (queue.currentTask?.id === action.taskId) {
                queue.currentTask = null;
                queue.isRunning = false;
              } else {
                queue.queuedTasks = queue.queuedTasks.filter(task => task.id !== action.taskId);
              }
            }
            break;

          case 'fix_timestamps':
            const now = Date.now();
            if (queue.createdAt > now) {
              queue.createdAt = now;
            }
            if (queue.lastUpdated > now) {
              queue.lastUpdated = now;
            }
            
            // Fix pause/resume timestamps
            if (queue.pausedAt && queue.resumedAt && queue.pausedAt > queue.resumedAt) {
              queue.resumedAt = queue.pausedAt + 1000; // Set resume 1 second after pause
            }
            
            // Fix inconsistent pause state
            if (queue.isPaused && queue.isRunning) {
              queue.isRunning = false;
            }
            
            // Add missing pause reason
            if (queue.isPaused && !queue.pauseReason) {
              queue.pauseReason = 'System pause';
            }
            break;

          case 'recalculate_stats':
            queue.totalTasksCompleted = Math.max(0, queue.totalTasksCompleted);
            queue.totalTimeSpent = Math.max(0, queue.totalTimeSpent);
            
            // Recalculate derived statistics
            if (queue.totalTasksCompleted > 0) {
              queue.averageTaskDuration = queue.totalTimeSpent / queue.totalTasksCompleted;
            } else {
              queue.averageTaskDuration = 0;
            }
            
            // Fix task completion rate
            queue.taskCompletionRate = Math.min(1, Math.max(0, queue.taskCompletionRate));
            
            // Fix efficiency score
            queue.queueEfficiencyScore = Math.min(1, Math.max(0, queue.queueEfficiencyScore));
            
            // Initialize or truncate state history
            if (!queue.stateHistory) {
              queue.stateHistory = [];
            } else if (queue.stateHistory.length > queue.maxHistorySize) {
              queue.stateHistory = queue.stateHistory.slice(-queue.maxHistorySize);
            }
            
            // Fix configuration values
            if (queue.config) {
              if (queue.config.maxQueueSize <= 0) {
                queue.config.maxQueueSize = 50; // Default value
              }
              if (queue.config.maxTaskDuration <= 0) {
                queue.config.maxTaskDuration = 24 * 60 * 60 * 1000; // 24 hours
              }
            }
            break;

          case 'update_checksum':
            queue.checksum = this.calculateChecksum(queue);
            break;

          case 'reset_state':
            // Last resort - reset to safe state
            queue.currentTask = null;
            queue.queuedTasks = [];
            queue.isRunning = false;
            queue.isPaused = false;
            queue.pauseReason = undefined;
            queue.canResume = true;
            
            // Reset configuration to defaults if missing
            if (!queue.config) {
              queue.config = this.getDefaultConfiguration();
            }
            break;
        }
      }

      // Update metadata
      queue.version = (queue.version || 0) + 1;
      queue.checksum = this.calculateChecksum(queue);
      queue.lastUpdated = Date.now();
      queue.lastValidated = Date.now();

      // Save repaired state
      await this.saveState(queue);

      console.log(`Queue repair completed for player ${queue.playerId}`);
      return queue;

    } catch (error) {
      console.error('Failed to repair queue state:', error);
      throw new Error(`Queue repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a state snapshot
   */
  createSnapshot(queue: TaskQueue): QueueStateSnapshot {
    return {
      timestamp: Date.now(),
      currentTaskId: queue.currentTask?.id || null,
      queuedTaskIds: queue.queuedTasks.map(task => task.id),
      isRunning: queue.isRunning,
      isPaused: queue.isPaused,
      pauseReason: queue.pauseReason,
      totalTasksCompleted: queue.totalTasksCompleted,
      checksum: this.calculateChecksum(queue)
    };
  }

  /**
   * Restore queue from snapshot
   */
  async restoreFromSnapshot(playerId: string, snapshot: QueueStateSnapshot): Promise<TaskQueue> {
    try {
      // Load current queue to get full task data
      const currentQueue = await this.loadState(playerId);
      
      if (!currentQueue) {
        throw new Error('Cannot restore snapshot: no current queue found');
      }

      // Find tasks by ID from snapshot
      const currentTask = snapshot.currentTaskId 
        ? this.findTaskById(currentQueue, snapshot.currentTaskId)
        : null;

      const queuedTasks = snapshot.queuedTaskIds
        .map(id => this.findTaskById(currentQueue, id))
        .filter(task => task !== null) as Task[];

      // Create restored queue
      const restoredQueue: TaskQueue = {
        ...currentQueue,
        currentTask,
        queuedTasks,
        isRunning: snapshot.isRunning,
        isPaused: snapshot.isPaused,
        pauseReason: snapshot.pauseReason,
        totalTasksCompleted: snapshot.totalTasksCompleted,
        version: (currentQueue.version || 0) + 1,
        lastUpdated: Date.now()
      };

      // Update checksum
      restoredQueue.checksum = this.calculateChecksum(restoredQueue);

      // Save restored state
      await this.saveState(restoredQueue);

      return restoredQueue;

    } catch (error) {
      console.error('Failed to restore from snapshot:', error);
      throw new Error(`Snapshot restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform atomic queue update
   */
  async atomicUpdate(playerId: string, updateFn: (queue: TaskQueue) => TaskQueue | Promise<TaskQueue>): Promise<TaskQueue> {
    let attempts = 0;
    
    while (attempts < this.MAX_RETRY_ATTEMPTS) {
      try {
        // Load current state
        const currentQueue = await this.loadState(playerId);
        
        if (!currentQueue) {
          throw new Error('Queue not found for atomic update');
        }

        // Apply update function
        const updatedQueue = await Promise.resolve(updateFn({ ...currentQueue }));

        // Validate updated state
        const validation = await this.validateState(updatedQueue);
        
        if (!validation.isValid) {
          throw new Error(`Atomic update validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }

        // Save with version check for optimistic locking
        await this.saveWithVersionCheck(updatedQueue, currentQueue.version);

        return updatedQueue;

      } catch (error) {
        attempts++;
        
        if (attempts >= this.MAX_RETRY_ATTEMPTS) {
          console.error('Atomic update failed after maximum retries:', error);
          throw new Error(`Atomic update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Wait before retry with exponential backoff
        await this.delay(Math.pow(2, attempts) * 100);
      }
    }

    throw new Error('Atomic update failed: maximum retries exceeded');
  }

  /**
   * Calculate queue checksum for integrity verification
   */
  private calculateChecksum(queue: TaskQueue): string {
    // Create a deterministic string representation of critical queue data
    const criticalData = {
      playerId: queue.playerId,
      currentTaskId: queue.currentTask?.id || null,
      queuedTaskIds: queue.queuedTasks.map(task => task.id).sort(),
      isRunning: queue.isRunning,
      isPaused: queue.isPaused,
      totalTasksCompleted: queue.totalTasksCompleted,
      totalTimeSpent: queue.totalTimeSpent,
      version: queue.version || 0
    };

    // Use crypto for secure hash generation
    const dataString = JSON.stringify(criticalData);
    return crypto
      .createHash(this.CHECKSUM_ALGORITHM)
      .update(dataString)
      .digest('hex');
  }

  /**
   * Validate individual task
   */
  private async validateTask(task: Task): Promise<{ isValid: boolean }> {
    try {
      // Basic task validation
      if (!task.id || !task.type || !task.playerId) {
        return { isValid: false };
      }

      if (task.duration <= 0) {
        return { isValid: false };
      }

      if (task.progress < 0 || task.progress > 1) {
        return { isValid: false };
      }

      return { isValid: true };

    } catch (error) {
      return { isValid: false };
    }
  }

  /**
   * Create default queue for new players
   */
  private createDefaultQueue(playerId: string): TaskQueue {
    const now = Date.now();
    
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
      config: this.getDefaultConfiguration(),
      lastUpdated: now,
      lastSynced: now,
      createdAt: now,
      version: 1,
      checksum: '',
      lastValidated: now,
      stateHistory: [],
      maxHistorySize: 10
    };
  }

  /**
   * Get default queue configuration
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
      persistenceInterval: 30000, // 30 seconds
      integrityCheckInterval: 300000, // 5 minutes
      maxHistorySize: 10
    };
  }

  /**
   * Find task by ID in queue
   */
  private findTaskById(queue: TaskQueue, taskId: string): Task | null {
    if (queue.currentTask?.id === taskId) {
      return queue.currentTask;
    }
    
    return queue.queuedTasks.find(task => task.id === taskId) || null;
  }

  /**
   * Perform atomic save with optimistic locking and timeout
   */
  private async performAtomicSave(queue: TaskQueue): Promise<void> {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Queue save operation timed out')), this.ATOMIC_UPDATE_TIMEOUT);
    });

    // Create the save operation promise
    const savePromise = DatabaseService.putItem({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Item: queue,
      ConditionExpression: 'attribute_not_exists(version) OR version = :expectedVersion',
      ExpressionAttributeValues: {
        ':expectedVersion': (queue.version || 1) - 1
      }
    });

    // Race the promises to implement timeout
    await Promise.race([savePromise, timeoutPromise]);
  }

  /**
   * Save with version check for optimistic locking
   */
  private async saveWithVersionCheck(queue: TaskQueue, expectedVersion: number): Promise<void> {
    await DatabaseService.putItem({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Item: queue,
      ConditionExpression: 'version = :expectedVersion',
      ExpressionAttributeValues: {
        ':expectedVersion': expectedVersion
      }
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const queueStateManager = new QueueStateManagerService();