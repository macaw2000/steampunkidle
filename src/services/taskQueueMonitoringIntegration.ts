/**
 * Task Queue Monitoring Integration
 * Wraps existing services with comprehensive monitoring, logging, and metrics collection
 */

import { taskQueueLogger } from './taskQueueLogger';
import { taskQueueMetrics } from './taskQueueMetrics';
import { taskQueueAlerting } from './taskQueueAlerting';
import { Task, TaskType, TaskQueue } from '../types/taskQueue';

export class TaskQueueMonitoringIntegration {
  private static instance: TaskQueueMonitoringIntegration;

  private constructor() {}

  static getInstance(): TaskQueueMonitoringIntegration {
    if (!TaskQueueMonitoringIntegration.instance) {
      TaskQueueMonitoringIntegration.instance = new TaskQueueMonitoringIntegration();
    }
    return TaskQueueMonitoringIntegration.instance;
  }

  /**
   * Wrap a service method with comprehensive monitoring
   */
  wrapServiceMethod<T extends any[], R>(
    serviceName: string,
    methodName: string,
    originalMethod: (...args: T) => Promise<R>,
    context: any
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startTime = Date.now();
      const playerId = this.extractPlayerId(args);
      const taskId = this.extractTaskId(args);
      
      // Log operation start
      taskQueueLogger.logQueueOperation(
        `${serviceName}.${methodName}`,
        playerId || 'unknown',
        true,
        undefined,
        { args: this.sanitizeArgs(args) }
      );

      try {
        // Execute the original method
        const result = await originalMethod.apply(context, args);
        const duration = Date.now() - startTime;

        // Log successful completion
        taskQueueLogger.logQueueOperation(
          `${serviceName}.${methodName}`,
          playerId || 'unknown',
          true,
          duration,
          { success: true }
        );

        // Record performance metrics
        taskQueueMetrics.recordHistogram(
          `service.${serviceName}.${methodName}.duration`,
          duration,
          { success: 'true' }
        );

        // Record specific metrics based on method type
        this.recordMethodSpecificMetrics(serviceName, methodName, args, result, duration);

        return result;

      } catch (error: any) {
        const duration = Date.now() - startTime;

        // Log error
        taskQueueLogger.logError(
          `${serviceName}.${methodName} failed`,
          error,
          playerId,
          taskId,
          { duration, args: this.sanitizeArgs(args) }
        );

        // Record error metrics
        taskQueueMetrics.recordHistogram(
          `service.${serviceName}.${methodName}.duration`,
          duration,
          { success: 'false', error_type: error.name || 'unknown' }
        );

        taskQueueMetrics.incrementCounter(
          `service.${serviceName}.${methodName}.errors`,
          1,
          { error_type: error.name || 'unknown' }
        );

        // Re-throw the error
        throw error;
      }
    };
  }

  /**
   * Monitor task processing operations
   */
  monitorTaskProcessing(
    taskId: string,
    playerId: string,
    taskType: TaskType,
    operation: 'start' | 'progress' | 'complete' | 'fail',
    duration?: number,
    metadata?: Record<string, any>
  ): void {
    const success = operation !== 'fail';
    
    // Log task processing
    taskQueueLogger.logTaskProcessing(
      taskId,
      playerId,
      operation,
      success,
      duration,
      metadata
    );

    // Record metrics based on operation
    switch (operation) {
      case 'start':
        taskQueueMetrics.incrementCounter('task.started.total', 1, {
          task_type: taskType,
          player_id: playerId
        });
        break;

      case 'complete':
        if (duration) {
          taskQueueMetrics.recordTaskProcessingTime(duration, taskType, playerId);
        }
        taskQueueMetrics.incrementCounter('task.completed.total', 1, {
          task_type: taskType,
          player_id: playerId
        });
        break;

      case 'fail':
        taskQueueMetrics.recordTaskFailure(
          taskType,
          metadata?.errorType || 'unknown',
          playerId
        );
        break;

      case 'progress':
        taskQueueMetrics.recordGauge('task.progress', metadata?.progress || 0, {
          task_id: taskId,
          player_id: playerId
        });
        break;
    }
  }

  /**
   * Monitor queue state changes
   */
  monitorQueueState(
    playerId: string,
    queueStatus: TaskQueue,
    operation: string
  ): void {
    // Record queue length
    taskQueueMetrics.recordQueueLength(queueStatus.queuedTasks.length, playerId);

    // Record queue state metrics
    taskQueueMetrics.recordGauge('queue.is_running', queueStatus.isRunning ? 1 : 0, {
      player_id: playerId
    });

    taskQueueMetrics.recordGauge('queue.is_paused', queueStatus.isPaused ? 1 : 0, {
      player_id: playerId
    });

    // Log queue operation
    taskQueueLogger.logQueueOperation(
      operation,
      playerId,
      true,
      undefined,
      {
        queueLength: queueStatus.queuedTasks.length,
        isRunning: queueStatus.isRunning,
        isPaused: queueStatus.isPaused,
        currentTask: queueStatus.currentTask?.id
      }
    );

    // Record player activity
    taskQueueMetrics.recordPlayerActivity(playerId, operation);
  }

  /**
   * Monitor validation operations
   */
  monitorValidation(
    operation: string,
    playerId: string,
    taskId: string,
    success: boolean,
    errors?: string[],
    duration?: number
  ): void {
    taskQueueLogger.logValidation(
      operation,
      playerId,
      taskId,
      success,
      errors,
      { duration }
    );

    if (!success) {
      taskQueueMetrics.recordValidationFailure(operation, playerId);
    }

    if (duration) {
      taskQueueMetrics.recordHistogram('validation.duration', duration, {
        operation,
        success: success.toString(),
        player_id: playerId
      });
    }
  }

  /**
   * Monitor synchronization operations
   */
  monitorSync(
    operation: string,
    playerId: string,
    success: boolean,
    duration: number,
    conflictsResolved?: number,
    metadata?: Record<string, any>
  ): void {
    taskQueueLogger.logSync(
      operation,
      playerId,
      success,
      conflictsResolved,
      metadata
    );

    taskQueueMetrics.recordSyncOperation(
      operation,
      success,
      duration,
      playerId
    );
  }

  /**
   * Monitor database operations
   */
  monitorDatabaseOperation(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    taskQueueMetrics.recordDatabaseOperation(operation, duration, success);

    if (!success) {
      taskQueueLogger.logError(
        `Database operation ${operation} failed`,
        new Error('Database operation failed'),
        undefined,
        undefined,
        { ...metadata, duration }
      );
    } else {
      taskQueueLogger.logPerformance(
        `database.${operation}`,
        duration,
        undefined,
        metadata
      );
    }
  }

  /**
   * Monitor cache operations
   */
  monitorCacheOperation(
    operation: string,
    hit: boolean,
    playerId?: string,
    metadata?: Record<string, any>
  ): void {
    taskQueueMetrics.recordCacheOperation(operation, hit);

    taskQueueLogger.logPerformance(
      `cache.${operation}`,
      0,
      playerId,
      { ...metadata, hit }
    );
  }

  /**
   * Monitor security events
   */
  monitorSecurity(
    event: string,
    playerId?: string,
    severity: 'low' | 'medium' | 'high' = 'medium',
    metadata?: Record<string, any>
  ): void {
    taskQueueLogger.logSecurity(event, playerId, severity, metadata);

    taskQueueMetrics.incrementCounter('security.events.total', 1, {
      event,
      severity,
      player_id: playerId || 'unknown'
    });
  }

  /**
   * Create a performance timer for measuring operation duration
   */
  createPerformanceTimer(operation: string, playerId?: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      taskQueueLogger.logPerformance(operation, duration, playerId);
      
      taskQueueMetrics.recordHistogram('operation.duration', duration, {
        operation,
        player_id: playerId || 'unknown'
      });
    };
  }

  // Helper methods
  private extractPlayerId(args: any[]): string | undefined {
    // Try to find playerId in the first few arguments
    for (let i = 0; i < Math.min(3, args.length); i++) {
      const arg = args[i];
      if (typeof arg === 'string' && arg.length > 0) {
        return arg;
      }
      if (arg && typeof arg === 'object' && arg.playerId) {
        return arg.playerId;
      }
    }
    return undefined;
  }

  private extractTaskId(args: any[]): string | undefined {
    for (const arg of args) {
      if (arg && typeof arg === 'object') {
        if (arg.id) return arg.id;
        if (arg.taskId) return arg.taskId;
        if (arg.task && arg.task.id) return arg.task.id;
      }
    }
    return undefined;
  }

  private sanitizeArgs(args: any[]): any[] {
    // Remove sensitive data and large objects from args for logging
    return args.map(arg => {
      if (typeof arg === 'string') {
        return arg.length > 100 ? `${arg.substring(0, 100)}...` : arg;
      }
      if (typeof arg === 'object' && arg !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(arg)) {
          if (key.toLowerCase().includes('password') || 
              key.toLowerCase().includes('token') ||
              key.toLowerCase().includes('secret')) {
            sanitized[key] = '[REDACTED]';
          } else if (typeof value === 'string' && value.length > 100) {
            sanitized[key] = `${value.substring(0, 100)}...`;
          } else if (typeof value === 'object') {
            sanitized[key] = '[OBJECT]';
          } else {
            sanitized[key] = value;
          }
        }
        return sanitized;
      }
      return arg;
    });
  }

  private recordMethodSpecificMetrics(
    serviceName: string,
    methodName: string,
    args: any[],
    result: any,
    duration: number
  ): void {
    // Record specific metrics based on the method being called
    if (methodName.includes('Task') && args.length > 0) {
      const playerId = this.extractPlayerId(args);
      if (playerId) {
        taskQueueMetrics.recordPlayerActivity(playerId, `${serviceName}.${methodName}`);
      }
    }

    if (methodName.includes('queue') || methodName.includes('Queue')) {
      taskQueueMetrics.incrementCounter(`queue.operations.total`, 1, {
        service: serviceName,
        method: methodName
      });
    }

    if (methodName.includes('sync') || methodName.includes('Sync')) {
      const playerId = this.extractPlayerId(args);
      if (playerId) {
        taskQueueMetrics.recordSyncOperation(methodName, true, duration, playerId);
      }
    }
  }
}

// Export singleton instance
export const taskQueueMonitoring = TaskQueueMonitoringIntegration.getInstance();