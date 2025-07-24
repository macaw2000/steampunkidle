/**
 * Task Queue Robust State Persistence Service
 * Implements atomic operations, state snapshots, and recovery mechanisms
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand,
  TransactWriteCommand,
  QueryCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';
import { TaskQueue, QueueStateSnapshot, QueueValidationResult, QueueValidationError, QueueValidationWarning, QueueRepairAction } from '../types/taskQueue';
import { createHash } from 'crypto';

export interface TaskQueuePersistenceConfig {
  tableName: string;
  snapshotTableName: string;
  migrationTableName: string;
  region: string;
  maxRetries: number;
  retryDelayMs: number;
  snapshotInterval: number;
  maxSnapshots: number;
}

export interface AtomicUpdateOptions {
  maxRetries: number;
  retryDelayMs: number;
  validateBeforeUpdate: boolean;
  createSnapshot: boolean;
}

export interface StateSnapshot {
  snapshotId: string;
  playerId: string;
  timestamp: number;
  queueState: TaskQueue;
  checksum: string;
  version: number;
  metadata: {
    reason: 'periodic' | 'before_update' | 'manual' | 'recovery';
    size: number;
    compressionRatio?: number;
  };
}

export interface MigrationRecord {
  migrationId: string;
  fromVersion: number;
  toVersion: number;
  timestamp: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  affectedPlayers: string[];
  migrationData: any;
  rollbackData?: any;
  error?: string;
}

export class TaskQueuePersistenceService {
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private config: TaskQueuePersistenceConfig;

  constructor(config: TaskQueuePersistenceConfig) {
    this.config = config;
    this.client = new DynamoDBClient({ region: config.region });
    this.docClient = DynamoDBDocumentClient.from(this.client);
  }

  /**
   * Enhanced DynamoDB schema operations with optimized indexing
   */
  async saveQueueWithAtomicUpdate(
    queue: TaskQueue, 
    options: Partial<AtomicUpdateOptions> = {}
  ): Promise<void> {
    const opts: AtomicUpdateOptions = {
      maxRetries: this.config.maxRetries,
      retryDelayMs: this.config.retryDelayMs,
      validateBeforeUpdate: true,
      createSnapshot: true,
      ...options
    };

    let retryCount = 0;
    
    while (retryCount < opts.maxRetries) {
      try {
        // Create snapshot before update if requested
        if (opts.createSnapshot) {
          await this.createStateSnapshot(queue, 'before_update');
        }

        // Validate queue integrity before update
        if (opts.validateBeforeUpdate) {
          const validation = await this.validateQueueIntegrity(queue);
          if (!validation.isValid) {
            throw new Error(`Queue validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
          }
        }

        // Calculate new checksum and increment version
        const updatedQueue = {
          ...queue,
          version: queue.version + 1,
          checksum: this.calculateChecksum(queue),
          lastUpdated: Date.now(),
          lastValidated: Date.now()
        };

        // Perform atomic update with condition check
        await this.docClient.send(new UpdateCommand({
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
      } catch (error: any) {
        retryCount++;
        
        if (error.name === 'ConditionalCheckFailedException') {
          // Version conflict - reload and retry
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

  /**
   * Load queue with integrity validation
   */
  async loadQueue(playerId: string): Promise<TaskQueue | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.config.tableName,
        Key: { playerId },
        ConsistentRead: true
      }));

      if (!result.Item) {
        return null;
      }

      const queue = result.Item.queueData as TaskQueue;
      
      // Validate loaded queue integrity
      const validation = await this.validateQueueIntegrity(queue);
      if (!validation.isValid) {
        console.warn(`Loaded queue has integrity issues for player ${playerId}:`, validation.errors);
        
        // Attempt to repair if possible
        if (validation.canRepair) {
          const repairedQueue = await this.repairQueue(queue);
          await this.saveQueueWithAtomicUpdate(repairedQueue, { createSnapshot: true });
          return repairedQueue;
        }
      }

      return queue;
    } catch (error: any) {
      console.error(`Failed to load queue for player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Create periodic state snapshots for faster recovery
   */
  async createStateSnapshot(
    queue: TaskQueue, 
    reason: StateSnapshot['metadata']['reason'] = 'periodic'
  ): Promise<string> {
    const snapshotId = `${queue.playerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    // Compress queue data for storage efficiency
    const compressedQueue = this.compressQueueData(queue);
    
    const snapshot: StateSnapshot = {
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

    await this.docClient.send(new PutCommand({
      TableName: this.config.snapshotTableName,
      Item: {
        snapshotId,
        playerId: queue.playerId,
        timestamp,
        snapshotData: snapshot,
        ttl: Math.floor((timestamp + (30 * 24 * 60 * 60 * 1000)) / 1000) // 30 days TTL
      }
    }));

    // Clean up old snapshots
    await this.cleanupOldSnapshots(queue.playerId);

    return snapshotId;
  }

  /**
   * Restore queue from snapshot
   */
  async restoreFromSnapshot(playerId: string, snapshotId: string): Promise<TaskQueue> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.config.snapshotTableName,
      Key: { snapshotId }
    }));

    if (!result.Item) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    const snapshot = result.Item.snapshotData as StateSnapshot;
    
    if (snapshot.playerId !== playerId) {
      throw new Error(`Snapshot ${snapshotId} does not belong to player ${playerId}`);
    }

    // Decompress and restore queue data
    const restoredQueue = this.decompressQueueData(snapshot.queueState);
    
    // Update timestamps and version
    restoredQueue.lastUpdated = Date.now();
    restoredQueue.version = snapshot.version;
    
    // Save restored queue
    await this.saveQueueWithAtomicUpdate(restoredQueue, { 
      validateBeforeUpdate: false,
      createSnapshot: false 
    });

    return restoredQueue;
  }

  /**
   * Get available snapshots for a player
   */
  async getPlayerSnapshots(playerId: string, limit: number = 10): Promise<StateSnapshot[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.config.snapshotTableName,
      IndexName: 'playerId-timestamp-index',
      KeyConditionExpression: 'playerId = :playerId',
      ExpressionAttributeValues: {
        ':playerId': playerId
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit
    }));

    return (result.Items || []).map(item => item.snapshotData as StateSnapshot);
  }

  /**
   * Validate queue integrity with comprehensive checks
   */
  async validateQueueIntegrity(queue: TaskQueue): Promise<QueueValidationResult> {
    const errors: QueueValidationError[] = [];
    const warnings: QueueValidationWarning[] = [];

    // Check basic structure
    if (!queue.playerId) {
      errors.push({
        code: 'MISSING_PLAYER_ID',
        message: 'Queue is missing playerId',
        severity: 'critical'
      });
    }

    // Validate checksum
    const calculatedChecksum = this.calculateChecksum(queue);
    if (queue.checksum !== calculatedChecksum) {
      errors.push({
        code: 'CHECKSUM_MISMATCH',
        message: `Queue checksum mismatch. Expected: ${calculatedChecksum}, Got: ${queue.checksum}`,
        severity: 'major'
      });
    }

    // Validate timestamps
    if (queue.lastUpdated > Date.now()) {
      warnings.push({
        code: 'FUTURE_TIMESTAMP',
        message: 'Queue lastUpdated timestamp is in the future',
        impact: 'data_integrity',
        suggestion: 'Check system clock synchronization'
      });
    }

    // Validate task consistency
    if (queue.currentTask && !queue.queuedTasks.some(t => t.id === queue.currentTask!.id)) {
      errors.push({
        code: 'ORPHANED_CURRENT_TASK',
        message: 'Current task is not in the queued tasks list',
        severity: 'major'
      });
    }

    // Validate queue size limits
    if (queue.queuedTasks.length > queue.config.maxQueueSize) {
      warnings.push({
        code: 'QUEUE_SIZE_EXCEEDED',
        message: `Queue size (${queue.queuedTasks.length}) exceeds maximum (${queue.config.maxQueueSize})`,
        impact: 'performance',
        suggestion: 'Consider increasing maxQueueSize or removing some tasks'
      });
    }

    // Check for duplicate task IDs
    const taskIds = queue.queuedTasks.map(t => t.id);
    const uniqueTaskIds = new Set(taskIds);
    if (taskIds.length !== uniqueTaskIds.size) {
      errors.push({
        code: 'DUPLICATE_TASK_IDS',
        message: 'Queue contains duplicate task IDs',
        severity: 'major'
      });
    }

    // Validate state history
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

  /**
   * Repair corrupted queue data
   */
  async repairQueue(queue: TaskQueue): Promise<TaskQueue> {
    const validation = await this.validateQueueIntegrity(queue);
    
    if (!validation.canRepair) {
      throw new Error('Queue cannot be repaired automatically');
    }

    let repairedQueue = { ...queue };

    // Apply repair actions
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
          if (repairedQueue.currentTask && !repairedQueue.queuedTasks.some(t => t.id === repairedQueue.currentTask!.id)) {
            repairedQueue.currentTask = null;
            repairedQueue.isRunning = false;
          }
          break;
      }
    }

    // Trim state history if needed
    if (repairedQueue.stateHistory.length > repairedQueue.maxHistorySize) {
      repairedQueue.stateHistory = repairedQueue.stateHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, repairedQueue.maxHistorySize);
    }

    // Update repair metadata
    repairedQueue.lastValidated = Date.now();
    repairedQueue.version += 1;
    repairedQueue.checksum = this.calculateChecksum(repairedQueue);

    return repairedQueue;
  }

  /**
   * Data migration tools for schema updates
   */
  async createMigration(
    migrationId: string,
    fromVersion: number,
    toVersion: number,
    migrationFn: (queue: TaskQueue) => TaskQueue
  ): Promise<void> {
    const migration: MigrationRecord = {
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

    await this.docClient.send(new PutCommand({
      TableName: this.config.migrationTableName,
      Item: migration
    }));
  }

  async executeMigration(migrationId: string): Promise<void> {
    // Get migration record
    const migrationResult = await this.docClient.send(new GetCommand({
      TableName: this.config.migrationTableName,
      Key: { migrationId }
    }));

    if (!migrationResult.Item) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    const migration = migrationResult.Item as MigrationRecord;
    
    // Update status to in_progress
    await this.docClient.send(new UpdateCommand({
      TableName: this.config.migrationTableName,
      Key: { migrationId },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'in_progress' }
    }));

    try {
      // Scan for queues that need migration
      const scanResult = await this.docClient.send(new ScanCommand({
        TableName: this.config.tableName,
        FilterExpression: 'version = :fromVersion',
        ExpressionAttributeValues: {
          ':fromVersion': migration.fromVersion
        }
      }));

      const affectedPlayers: string[] = [];
      
      // Process each queue
      for (const item of scanResult.Items || []) {
        const queue = item.queueData as TaskQueue;
        
        try {
          // Create backup before migration
          await this.createStateSnapshot(queue, 'before_update');
          
          // Apply migration
          const migrationFn = new Function('return ' + migration.migrationData.migrationFunction)();
          const migratedQueue = migrationFn(queue);
          
          // Save migrated queue
          await this.saveQueueWithAtomicUpdate(migratedQueue, {
            validateBeforeUpdate: false,
            createSnapshot: false
          });
          
          affectedPlayers.push(queue.playerId);
        } catch (error: any) {
          console.error(`Failed to migrate queue for player ${queue.playerId}:`, error);
        }
      }

      // Update migration status to completed
      await this.docClient.send(new UpdateCommand({
        TableName: this.config.migrationTableName,
        Key: { migrationId },
        UpdateExpression: 'SET #status = :status, affectedPlayers = :players',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'completed',
          ':players': affectedPlayers
        }
      }));

    } catch (error: any) {
      // Update migration status to failed
      await this.docClient.send(new UpdateCommand({
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

  /**
   * Utility methods
   */
  private calculateChecksum(queue: TaskQueue): string {
    // Create a stable representation for checksum calculation
    const stableData = {
      playerId: queue.playerId,
      currentTaskId: queue.currentTask?.id || null,
      queuedTaskIds: queue.queuedTasks.map(t => t.id).sort(),
      isRunning: queue.isRunning,
      isPaused: queue.isPaused,
      totalTasksCompleted: queue.totalTasksCompleted,
      totalTimeSpent: queue.totalTimeSpent
    };
    
    return createHash('sha256')
      .update(JSON.stringify(stableData))
      .digest('hex');
  }

  private compressQueueData(queue: TaskQueue): TaskQueue {
    // Remove non-essential data for snapshots
    return {
      ...queue,
      stateHistory: queue.stateHistory.slice(-5), // Keep only last 5 history entries
      totalRewardsEarned: queue.totalRewardsEarned.slice(-100) // Keep only last 100 rewards
    };
  }

  private decompressQueueData(compressedQueue: TaskQueue): TaskQueue {
    // Restore full queue structure
    return {
      ...compressedQueue,
      stateHistory: compressedQueue.stateHistory || [],
      totalRewardsEarned: compressedQueue.totalRewardsEarned || []
    };
  }

  private async cleanupOldSnapshots(playerId: string): Promise<void> {
    const snapshots = await this.getPlayerSnapshots(playerId, this.config.maxSnapshots + 10);
    
    if (snapshots.length > this.config.maxSnapshots) {
      const snapshotsToDelete = snapshots.slice(this.config.maxSnapshots);
      
      for (const snapshot of snapshotsToDelete) {
        await this.docClient.send(new DeleteCommand({
          TableName: this.config.snapshotTableName,
          Key: { snapshotId: snapshot.snapshotId }
        }));
      }
    }
  }

  private generateRepairActions(
    errors: QueueValidationError[], 
    warnings: QueueValidationWarning[]
  ): QueueRepairAction[] {
    const actions: QueueRepairAction[] = [];

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

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}