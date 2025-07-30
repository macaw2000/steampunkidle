"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskQueuePersistenceService = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const crypto_1 = require("crypto");
class TaskQueuePersistenceService {
    constructor(config) {
        this.config = config;
        this.client = new client_dynamodb_1.DynamoDBClient({ region: config.region });
        this.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(this.client);
    }
    async saveQueueWithAtomicUpdate(queue, options = {}) {
        const opts = {
            maxRetries: this.config.maxRetries,
            retryDelayMs: this.config.retryDelayMs,
            validateBeforeUpdate: true,
            createSnapshot: true,
            ...options
        };
        let retryCount = 0;
        while (retryCount < opts.maxRetries) {
            try {
                if (opts.createSnapshot) {
                    await this.createStateSnapshot(queue, 'before_update');
                }
                if (opts.validateBeforeUpdate) {
                    const validation = await this.validateQueueIntegrity(queue);
                    if (!validation.isValid) {
                        throw new Error(`Queue validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
                    }
                }
                const updatedQueue = {
                    ...queue,
                    version: queue.version + 1,
                    checksum: this.calculateChecksum(queue),
                    lastUpdated: Date.now(),
                    lastValidated: Date.now()
                };
                await this.docClient.send(new lib_dynamodb_1.UpdateCommand({
                    TableName: this.config.tableName,
                    Key: { playerId: queue.playerId },
                    UpdateExpression: `
            SET 
              queueData = :queueData,
              version = :newVersion,
              checksum = :checksum,
              lastUpdated = :lastUpdated,
              lastValidated = :lastValidated,
              isRunning = :isRunning,
              isPaused = :isPaused,
              currentTaskId = :currentTaskId,
              queueSize = :queueSize,
              totalTasksCompleted = :totalTasksCompleted,
              lastProcessed = :lastProcessed
          `,
                    ConditionExpression: 'attribute_exists(playerId) AND version = :currentVersion',
                    ExpressionAttributeValues: {
                        ':queueData': updatedQueue,
                        ':newVersion': updatedQueue.version,
                        ':checksum': updatedQueue.checksum,
                        ':lastUpdated': updatedQueue.lastUpdated,
                        ':lastValidated': updatedQueue.lastValidated,
                        ':isRunning': updatedQueue.isRunning ? 'true' : 'false',
                        ':isPaused': updatedQueue.isPaused ? 'true' : 'false',
                        ':currentTaskId': updatedQueue.currentTask?.id || 'none',
                        ':queueSize': updatedQueue.queuedTasks.length,
                        ':totalTasksCompleted': updatedQueue.totalTasksCompleted,
                        ':lastProcessed': new Date().toISOString(),
                        ':currentVersion': queue.version
                    }
                }));
                return;
            }
            catch (error) {
                retryCount++;
                if (error.name === 'ConditionalCheckFailedException') {
                    const currentQueue = await this.loadQueue(queue.playerId);
                    if (currentQueue) {
                        queue.version = currentQueue.version;
                    }
                }
                if (retryCount >= opts.maxRetries) {
                    throw new Error(`Failed to save queue after ${opts.maxRetries} retries: ${error.message}`);
                }
                await this.delay(opts.retryDelayMs * Math.pow(2, retryCount - 1));
            }
        }
    }
    async loadQueue(playerId) {
        try {
            const result = await this.docClient.send(new lib_dynamodb_1.GetCommand({
                TableName: this.config.tableName,
                Key: { playerId },
                ConsistentRead: true
            }));
            if (!result.Item) {
                return null;
            }
            const queue = result.Item.queueData;
            const validation = await this.validateQueueIntegrity(queue);
            if (!validation.isValid) {
                console.warn(`Loaded queue has integrity issues for player ${playerId}:`, validation.errors);
                if (validation.canRepair) {
                    const repairedQueue = await this.repairQueue(queue);
                    await this.saveQueueWithAtomicUpdate(repairedQueue, { createSnapshot: true });
                    return repairedQueue;
                }
            }
            return queue;
        }
        catch (error) {
            console.error(`Failed to load queue for player ${playerId}:`, error);
            throw error;
        }
    }
    async createStateSnapshot(queue, reason = 'periodic') {
        const snapshotId = `${queue.playerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = Date.now();
        const compressedQueue = this.compressQueueData(queue);
        const snapshot = {
            snapshotId,
            playerId: queue.playerId,
            timestamp,
            queueState: compressedQueue,
            checksum: this.calculateChecksum(queue),
            version: queue.version,
            metadata: {
                reason,
                size: JSON.stringify(queue).length,
                compressionRatio: JSON.stringify(compressedQueue).length / JSON.stringify(queue).length
            }
        };
        await this.docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: this.config.snapshotTableName,
            Item: {
                snapshotId,
                playerId: queue.playerId,
                timestamp,
                snapshotData: snapshot,
                ttl: Math.floor((timestamp + (30 * 24 * 60 * 60 * 1000)) / 1000)
            }
        }));
        await this.cleanupOldSnapshots(queue.playerId);
        return snapshotId;
    }
    async restoreFromSnapshot(playerId, snapshotId) {
        const result = await this.docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: this.config.snapshotTableName,
            Key: { snapshotId }
        }));
        if (!result.Item) {
            throw new Error(`Snapshot ${snapshotId} not found`);
        }
        const snapshot = result.Item.snapshotData;
        if (snapshot.playerId !== playerId) {
            throw new Error(`Snapshot ${snapshotId} does not belong to player ${playerId}`);
        }
        const restoredQueue = this.decompressQueueData(snapshot.queueState);
        restoredQueue.lastUpdated = Date.now();
        restoredQueue.version = snapshot.version;
        await this.saveQueueWithAtomicUpdate(restoredQueue, {
            validateBeforeUpdate: false,
            createSnapshot: false
        });
        return restoredQueue;
    }
    async getPlayerSnapshots(playerId, limit = 10) {
        const result = await this.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: this.config.snapshotTableName,
            IndexName: 'playerId-timestamp-index',
            KeyConditionExpression: 'playerId = :playerId',
            ExpressionAttributeValues: {
                ':playerId': playerId
            },
            ScanIndexForward: false,
            Limit: limit
        }));
        return (result.Items || []).map(item => item.snapshotData);
    }
    async validateQueueIntegrity(queue) {
        const errors = [];
        const warnings = [];
        if (!queue.playerId) {
            errors.push({
                code: 'MISSING_PLAYER_ID',
                message: 'Queue is missing playerId',
                severity: 'critical'
            });
        }
        const calculatedChecksum = this.calculateChecksum(queue);
        if (queue.checksum !== calculatedChecksum) {
            errors.push({
                code: 'CHECKSUM_MISMATCH',
                message: `Queue checksum mismatch. Expected: ${calculatedChecksum}, Got: ${queue.checksum}`,
                severity: 'major'
            });
        }
        if (queue.lastUpdated > Date.now()) {
            warnings.push({
                code: 'FUTURE_TIMESTAMP',
                message: 'Queue lastUpdated timestamp is in the future',
                impact: 'data_integrity',
                suggestion: 'Check system clock synchronization'
            });
        }
        if (queue.currentTask && !queue.queuedTasks.some(t => t.id === queue.currentTask.id)) {
            errors.push({
                code: 'ORPHANED_CURRENT_TASK',
                message: 'Current task is not in the queued tasks list',
                severity: 'major'
            });
        }
        if (queue.queuedTasks.length > queue.config.maxQueueSize) {
            warnings.push({
                code: 'QUEUE_SIZE_EXCEEDED',
                message: `Queue size (${queue.queuedTasks.length}) exceeds maximum (${queue.config.maxQueueSize})`,
                impact: 'performance',
                suggestion: 'Consider increasing maxQueueSize or removing some tasks'
            });
        }
        const taskIds = queue.queuedTasks.map(t => t.id);
        const uniqueTaskIds = new Set(taskIds);
        if (taskIds.length !== uniqueTaskIds.size) {
            errors.push({
                code: 'DUPLICATE_TASK_IDS',
                message: 'Queue contains duplicate task IDs',
                severity: 'major'
            });
        }
        if (queue.stateHistory.length > queue.maxHistorySize) {
            warnings.push({
                code: 'HISTORY_SIZE_EXCEEDED',
                message: `State history size (${queue.stateHistory.length}) exceeds maximum (${queue.maxHistorySize})`,
                impact: 'performance',
                suggestion: 'Consider reducing the maxHistorySize or clearing old history entries'
            });
        }
        const integrityScore = Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5));
        const canRepair = errors.every(e => e.severity !== 'critical');
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            integrityScore,
            canRepair,
            repairActions: this.generateRepairActions(errors, warnings)
        };
    }
    async repairQueue(queue) {
        const validation = await this.validateQueueIntegrity(queue);
        if (!validation.canRepair) {
            throw new Error('Queue cannot be repaired automatically');
        }
        let repairedQueue = { ...queue };
        for (const action of validation.repairActions) {
            switch (action.type) {
                case 'update_checksum':
                    repairedQueue.checksum = this.calculateChecksum(repairedQueue);
                    break;
                case 'fix_timestamps':
                    if (repairedQueue.lastUpdated > Date.now()) {
                        repairedQueue.lastUpdated = Date.now();
                    }
                    break;
                case 'remove_invalid_task':
                    if (action.taskId) {
                        repairedQueue.queuedTasks = repairedQueue.queuedTasks.filter(t => t.id !== action.taskId);
                    }
                    break;
                case 'recalculate_stats':
                    repairedQueue.totalTasksCompleted = Math.max(0, repairedQueue.totalTasksCompleted);
                    repairedQueue.totalTimeSpent = Math.max(0, repairedQueue.totalTimeSpent);
                    break;
                case 'reset_state':
                    if (repairedQueue.currentTask && !repairedQueue.queuedTasks.some(t => t.id === repairedQueue.currentTask.id)) {
                        repairedQueue.currentTask = null;
                        repairedQueue.isRunning = false;
                    }
                    break;
            }
        }
        if (repairedQueue.stateHistory.length > repairedQueue.maxHistorySize) {
            repairedQueue.stateHistory = repairedQueue.stateHistory
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, repairedQueue.maxHistorySize);
        }
        repairedQueue.lastValidated = Date.now();
        repairedQueue.version += 1;
        repairedQueue.checksum = this.calculateChecksum(repairedQueue);
        return repairedQueue;
    }
    async createMigration(migrationId, fromVersion, toVersion, migrationFn) {
        const migration = {
            migrationId,
            fromVersion,
            toVersion,
            timestamp: Date.now(),
            status: 'pending',
            affectedPlayers: [],
            migrationData: {
                migrationFunction: migrationFn.toString()
            }
        };
        await this.docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: this.config.migrationTableName,
            Item: migration
        }));
    }
    async executeMigration(migrationId) {
        const migrationResult = await this.docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: this.config.migrationTableName,
            Key: { migrationId }
        }));
        if (!migrationResult.Item) {
            throw new Error(`Migration ${migrationId} not found`);
        }
        const migration = migrationResult.Item;
        await this.docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: this.config.migrationTableName,
            Key: { migrationId },
            UpdateExpression: 'SET #status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': 'in_progress' }
        }));
        try {
            const scanResult = await this.docClient.send(new lib_dynamodb_1.ScanCommand({
                TableName: this.config.tableName,
                FilterExpression: 'version = :fromVersion',
                ExpressionAttributeValues: {
                    ':fromVersion': migration.fromVersion
                }
            }));
            const affectedPlayers = [];
            for (const item of scanResult.Items || []) {
                const queue = item.queueData;
                try {
                    await this.createStateSnapshot(queue, 'before_update');
                    const migrationFn = new Function('return ' + migration.migrationData.migrationFunction)();
                    const migratedQueue = migrationFn(queue);
                    await this.saveQueueWithAtomicUpdate(migratedQueue, {
                        validateBeforeUpdate: false,
                        createSnapshot: false
                    });
                    affectedPlayers.push(queue.playerId);
                }
                catch (error) {
                    console.error(`Failed to migrate queue for player ${queue.playerId}:`, error);
                }
            }
            await this.docClient.send(new lib_dynamodb_1.UpdateCommand({
                TableName: this.config.migrationTableName,
                Key: { migrationId },
                UpdateExpression: 'SET #status = :status, affectedPlayers = :players',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                    ':status': 'completed',
                    ':players': affectedPlayers
                }
            }));
        }
        catch (error) {
            await this.docClient.send(new lib_dynamodb_1.UpdateCommand({
                TableName: this.config.migrationTableName,
                Key: { migrationId },
                UpdateExpression: 'SET #status = :status, error = :error',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                    ':status': 'failed',
                    ':error': error.message
                }
            }));
            throw error;
        }
    }
    calculateChecksum(queue) {
        const stableData = {
            playerId: queue.playerId,
            currentTaskId: queue.currentTask?.id || null,
            queuedTaskIds: queue.queuedTasks.map(t => t.id).sort(),
            isRunning: queue.isRunning,
            isPaused: queue.isPaused,
            totalTasksCompleted: queue.totalTasksCompleted,
            totalTimeSpent: queue.totalTimeSpent
        };
        return (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(stableData))
            .digest('hex');
    }
    compressQueueData(queue) {
        return {
            ...queue,
            stateHistory: queue.stateHistory.slice(-5),
            totalRewardsEarned: queue.totalRewardsEarned.slice(-100)
        };
    }
    decompressQueueData(compressedQueue) {
        return {
            ...compressedQueue,
            stateHistory: compressedQueue.stateHistory || [],
            totalRewardsEarned: compressedQueue.totalRewardsEarned || []
        };
    }
    async cleanupOldSnapshots(playerId) {
        const snapshots = await this.getPlayerSnapshots(playerId, this.config.maxSnapshots + 10);
        if (snapshots.length > this.config.maxSnapshots) {
            const snapshotsToDelete = snapshots.slice(this.config.maxSnapshots);
            for (const snapshot of snapshotsToDelete) {
                await this.docClient.send(new lib_dynamodb_1.DeleteCommand({
                    TableName: this.config.snapshotTableName,
                    Key: { snapshotId: snapshot.snapshotId }
                }));
            }
        }
    }
    generateRepairActions(errors, warnings) {
        const actions = [];
        for (const error of errors) {
            switch (error.code) {
                case 'CHECKSUM_MISMATCH':
                    actions.push({
                        type: 'update_checksum',
                        description: 'Recalculate and update queue checksum'
                    });
                    break;
                case 'ORPHANED_CURRENT_TASK':
                    actions.push({
                        type: 'reset_state',
                        description: 'Reset current task and running state'
                    });
                    break;
                case 'DUPLICATE_TASK_IDS':
                    actions.push({
                        type: 'remove_invalid_task',
                        description: 'Remove duplicate tasks'
                    });
                    break;
            }
        }
        for (const warning of warnings) {
            switch (warning.code) {
                case 'FUTURE_TIMESTAMP':
                    actions.push({
                        type: 'fix_timestamps',
                        description: 'Fix invalid timestamps'
                    });
                    break;
                case 'QUEUE_SIZE_EXCEEDED':
                    actions.push({
                        type: 'recalculate_stats',
                        description: 'Recalculate queue statistics'
                    });
                    break;
            }
        }
        return actions;
    }
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.TaskQueuePersistenceService = TaskQueuePersistenceService;
