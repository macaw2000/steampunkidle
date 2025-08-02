"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanup = exports.warmup = exports.handler = void 0;
const optimizedTaskQueueService_1 = require("../../services/optimizedTaskQueueService");
const taskQueuePersistence_1 = require("../../services/taskQueuePersistence");
const persistenceConfig = {
    tableName: process.env.TASK_QUEUES_TABLE || 'steampunk-idle-game-task-queues',
    snapshotTableName: process.env.TASK_QUEUE_SNAPSHOTS_TABLE || 'steampunk-idle-game-task-queue-snapshots',
    migrationTableName: process.env.TASK_QUEUE_MIGRATIONS_TABLE || 'steampunk-idle-game-task-queue-migrations',
    region: process.env.AWS_REGION || 'us-east-1',
    maxRetries: 3,
    retryDelayMs: 1000,
    snapshotInterval: 300000,
    maxSnapshots: 10,
};
const persistenceService = new taskQueuePersistence_1.TaskQueuePersistenceService(persistenceConfig);
const optimizedTaskQueueService = new optimizedTaskQueueService_1.OptimizedTaskQueueService(persistenceService, {
    enableCaching: true,
    enableBatching: true,
    enableConnectionPooling: true,
    cacheStrategy: 'adaptive',
    batchStrategy: 'smart',
});
const handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const startTime = Date.now();
    let operationCount = 0;
    try {
        console.log('Optimized Task Processor - Request received:', {
            httpMethod: event.httpMethod,
            path: event.path,
            headers: event.headers,
        });
        let requestBody;
        try {
            requestBody = JSON.parse(event.body || '{}');
        }
        catch (error) {
            return createErrorResponse(400, 'Invalid JSON in request body');
        }
        if (!requestBody.action || !requestBody.playerId) {
            return createErrorResponse(400, 'Missing required fields: action, playerId');
        }
        let result = {};
        switch (requestBody.action) {
            case 'addTask':
                if (!requestBody.task) {
                    return createErrorResponse(400, 'Missing task data');
                }
                await optimizedTaskQueueService.addTask(requestBody.playerId, requestBody.task, {
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
                }, 1, {});
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
                await optimizedTaskQueueService.updateTaskProgress(requestBody.playerId, requestBody.taskId, requestBody.progress);
                result = { success: true, message: 'Progress updated successfully' };
                operationCount = 1;
                break;
            case 'completeTask':
                if (!requestBody.taskId) {
                    return createErrorResponse(400, 'Missing taskId');
                }
                const completionResult = await optimizedTaskQueueService.completeTask(requestBody.playerId, requestBody.taskId, requestBody.rewards || []);
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
        const performanceStats = optimizedTaskQueueService.getPerformanceStats();
        const processingTime = Date.now() - startTime;
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
    }
    catch (error) {
        console.error('Optimized Task Processor - Error:', error);
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
exports.handler = handler;
function createErrorResponse(statusCode, message, details) {
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
function calculateCacheHitRate(cacheStats) {
    let totalHits = 0;
    let totalRequests = 0;
    for (const stats of cacheStats.values()) {
        totalHits += stats.hits;
        totalRequests += stats.hits + stats.misses;
    }
    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
}
const warmup = async () => {
    console.log('Warming up optimized task processor...');
    try {
        const testPlayerId = 'warmup-test';
        await optimizedTaskQueueService.getQueueStatus(testPlayerId);
        const stats = optimizedTaskQueueService.getPerformanceStats();
        console.log('Warmup complete - Performance baseline:', {
            memoryUsage: Math.round(stats.memoryStats.heapUsed / 1024 / 1024) + 'MB',
            cacheSize: stats.memoryStats.cacheSize,
            connectionPoolSize: stats.memoryStats.connectionPoolSize,
        });
    }
    catch (error) {
        console.warn('Warmup failed (non-critical):', error);
    }
};
exports.warmup = warmup;
const cleanup = async () => {
    console.log('Cleaning up optimized task processor...');
    try {
        await optimizedTaskQueueService.shutdown();
        console.log('Cleanup complete');
    }
    catch (error) {
        console.error('Cleanup error:', error);
    }
};
exports.cleanup = cleanup;
