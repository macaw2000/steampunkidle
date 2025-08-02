/**
 * Optimized Task Processor Lambda Function
 * Integrates performance optimizations for task queue processing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { OptimizedTaskQueueService } from '../../services/optimizedTaskQueueService';
import { TaskQueuePersistenceService } from '../../services/taskQueuePersistence';
import { performanceOptimizationService } from '../../services/performanceOptimizations';
import { Task, TaskType, TaskCompletionResult } from '../../types/taskQueue';

// Initialize services
const persistenceConfig = {
  tableName: process.env.TASK_QUEUES_TABLE || 'steampunk-idle-game-task-queues',
  snapshotTableName: process.env.TASK_QUEUE_SNAPSHOTS_TABLE || 'steampunk-idle-game-task-queue-snapshots',
  migrationTableName: process.env.TASK_QUEUE_MIGRATIONS_TABLE || 'steampunk-idle-game-task-queue-migrations',
  region: process.env.AWS_REGION || 'us-east-1',
  maxRetries: 3,
  retryDelayMs: 1000,
  snapshotInterval: 300000, // 5 minutes
  maxSnapshots: 10,
};

const persistenceService = new TaskQueuePersistenceService(persistenceConfig);

const optimizedTaskQueueService = new OptimizedTaskQueueService(persistenceService, {
  enableCaching: true,
  enableBatching: true,
  enableConnectionPooling: true,
  cacheStrategy: 'adaptive',
  batchStrategy: 'smart',
});

interface TaskProcessorRequest {
  action: 'addTask' | 'removeTask' | 'updateProgress' | 'completeTask' | 'getStatus' | 'stopTasks' | 'batchOperations';
  playerId: string;
  taskId?: string;
  task?: Task;
  progress?: number;
  rewards?: any[];
  operations?: Array<{
    type: 'add' | 'remove' | 'update' | 'complete';
    playerId: string;
    taskId?: string;
    data?: any;
  }>;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Set Lambda context for performance monitoring
  context.callbackWaitsForEmptyEventLoop = false;

  const startTime = Date.now();
  let operationCount = 0;

  try {
    console.log('Optimized Task Processor - Request received:', {
      httpMethod: event.httpMethod,
      path: event.path,
      headers: event.headers,
    });

    // Parse request body
    let requestBody: TaskProcessorRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!requestBody.action || !requestBody.playerId) {
      return createErrorResponse(400, 'Missing required fields: action, playerId');
    }

    let result: any = {};

    // Process request based on action
    switch (requestBody.action) {
      case 'addTask':
        if (!requestBody.task) {
          return createErrorResponse(400, 'Missing task data');
        }
        await optimizedTaskQueueService.addTask(
          requestBody.playerId,
          requestBody.task,
          {
            strength: 10,
            dexterity: 10,
            intelligence: 10,
            vitality: 10,
            craftingSkills: {
              clockmaking: 1,
              engineering: 1,
              alchemy: 1,
              steamcraft: 1,
              level: 1,
              experience: 0
            },
            harvestingSkills: {
              mining: 1,
              foraging: 1,
              salvaging: 1,
              crystal_extraction: 1,
              level: 1,
              experience: 0
            },
            combatSkills: {
              melee: 1,
              ranged: 1,
              defense: 1,
              tactics: 1,
              level: 1,
              experience: 0
            }
          }, // Default player stats - would be loaded separately in production
          1, // Player level would be loaded separately
          {} // Player inventory would be loaded separately
        );
        result = { success: true, message: 'Task added successfully' };
        operationCount = 1;
        break;

      case 'removeTask':
        if (!requestBody.taskId) {
          return createErrorResponse(400, 'Missing taskId');
        }
        await optimizedTaskQueueService.removeTask(requestBody.playerId, requestBody.taskId);
        result = { success: true, message: 'Task removed successfully' };
        operationCount = 1;
        break;

      case 'updateProgress':
        if (!requestBody.taskId || requestBody.progress === undefined) {
          return createErrorResponse(400, 'Missing taskId or progress');
        }
        await optimizedTaskQueueService.updateTaskProgress(
          requestBody.playerId,
          requestBody.taskId,
          requestBody.progress
        );
        result = { success: true, message: 'Progress updated successfully' };
        operationCount = 1;
        break;

      case 'completeTask':
        if (!requestBody.taskId) {
          return createErrorResponse(400, 'Missing taskId');
        }
        const completionResult = await optimizedTaskQueueService.completeTask(
          requestBody.playerId,
          requestBody.taskId,
          requestBody.rewards || []
        );
        result = { success: true, result: completionResult };
        operationCount = 1;
        break;

      case 'getStatus':
        const status = await optimizedTaskQueueService.getQueueStatus(requestBody.playerId);
        result = { success: true, status };
        operationCount = 1;
        break;

      case 'stopTasks':
        await optimizedTaskQueueService.stopAllTasks(requestBody.playerId);
        result = { success: true, message: 'All tasks stopped successfully' };
        operationCount = 1;
        break;

      case 'batchOperations':
        if (!requestBody.operations || !Array.isArray(requestBody.operations)) {
          return createErrorResponse(400, 'Missing or invalid operations array');
        }
        await optimizedTaskQueueService.batchOperations(requestBody.operations);
        result = { success: true, message: `${requestBody.operations.length} operations processed` };
        operationCount = requestBody.operations.length;
        break;

      default:
        return createErrorResponse(400, `Unknown action: ${requestBody.action}`);
    }

    // Get performance statistics
    const performanceStats = optimizedTaskQueueService.getPerformanceStats();
    const processingTime = Date.now() - startTime;

    // Log performance metrics
    console.log('Optimized Task Processor - Performance metrics:', {
      action: requestBody.action,
      playerId: requestBody.playerId,
      processingTime,
      operationCount,
      performanceStats: {
        activeQueues: performanceStats.activeQueues,
        memoryUsage: Math.round(performanceStats.memoryStats.heapUsed / 1024 / 1024) + 'MB',
        cacheSize: performanceStats.memoryStats.cacheSize,
        batchQueueSize: performanceStats.memoryStats.batchQueueSize,
      },
    });

    // Return success response with performance data
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'X-Processing-Time': processingTime.toString(),
        'X-Operation-Count': operationCount.toString(),
      },
      body: JSON.stringify({
        ...result,
        performance: {
          processingTime,
          operationCount,
          cacheHitRate: calculateCacheHitRate(performanceStats.cacheStats),
          memoryUsage: performanceStats.memoryStats.heapUsed,
        },
      }),
    };

  } catch (error: any) {
    console.error('Optimized Task Processor - Error:', error);

    // Log error with context
    const processingTime = Date.now() - startTime;
    console.error('Error context:', {
      processingTime,
      operationCount,
      memoryUsage: process.memoryUsage(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    });

    return createErrorResponse(500, 'Internal server error', error.message);
  }
};

/**
 * Create standardized error response
 */
function createErrorResponse(statusCode: number, message: string, details?: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      error: {
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    }),
  };
}

/**
 * Calculate cache hit rate from cache statistics
 */
function calculateCacheHitRate(cacheStats: Map<string, { hits: number; misses: number; evictions: number }>): number {
  let totalHits = 0;
  let totalRequests = 0;

  for (const stats of cacheStats.values()) {
    totalHits += stats.hits;
    totalRequests += stats.hits + stats.misses;
  }

  return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
}

/**
 * Warm up function for container reuse
 */
export const warmup = async (): Promise<void> => {
  console.log('Warming up optimized task processor...');
  
  try {
    // Initialize connections and cache
    const testPlayerId = 'warmup-test';
    await optimizedTaskQueueService.getQueueStatus(testPlayerId);
    
    // Get performance baseline
    const stats = optimizedTaskQueueService.getPerformanceStats();
    console.log('Warmup complete - Performance baseline:', {
      memoryUsage: Math.round(stats.memoryStats.heapUsed / 1024 / 1024) + 'MB',
      cacheSize: stats.memoryStats.cacheSize,
      connectionPoolSize: stats.memoryStats.connectionPoolSize,
    });
  } catch (error) {
    console.warn('Warmup failed (non-critical):', error);
  }
};

/**
 * Cleanup function for graceful shutdown
 */
export const cleanup = async (): Promise<void> => {
  console.log('Cleaning up optimized task processor...');
  
  try {
    await optimizedTaskQueueService.shutdown();
    console.log('Cleanup complete');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};