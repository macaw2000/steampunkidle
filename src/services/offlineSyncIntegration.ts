/**
 * Offline Sync Integration Service
 * Integrates offline queue management with server synchronization
 */

import { 
  TaskQueue, 
  Task, 
  TaskSyncResult, 
  TaskSyncConflict,
  IncrementalSyncData 
} from '../types/taskQueue';
import { OfflineTaskQueueManager, OfflineOperation, SyncStatus } from './offlineTaskQueueManager';
import { serverTaskQueueService } from './serverTaskQueueService';
import { NetworkUtils } from '../utils/networkUtils';

export interface SyncConfiguration {
  enableIncrementalSync: boolean;
  syncBatchSize: number;
  maxRetryAttempts: number;
  retryBackoffMs: number;
  conflictResolutionStrategy: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  enableOptimisticUpdates: boolean;
  syncTimeoutMs: number;
}

export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictsResolved: number;
  averageSyncTime: number;
  lastSyncDuration: number;
  dataTransferred: number;
  operationsSynced: number;
}

/**
 * Enhanced offline synchronization with incremental updates and conflict resolution
 */
export class OfflineSyncIntegration {
  private static instance: OfflineSyncIntegration;
  private offlineManager: OfflineTaskQueueManager;
  private serverService: typeof serverTaskQueueService;
  private syncMetrics: Map<string, SyncMetrics> = new Map();
  private activeSyncs: Set<string> = new Set();
  
  private readonly defaultConfig: SyncConfiguration = {
    enableIncrementalSync: true,
    syncBatchSize: 50,
    maxRetryAttempts: 3,
    retryBackoffMs: 1000,
    conflictResolutionStrategy: 'merge',
    enableOptimisticUpdates: true,
    syncTimeoutMs: 30000
  };

  private constructor() {
    this.offlineManager = OfflineTaskQueueManager.getInstance();
    this.serverService = serverTaskQueueService;
  }

  static getInstance(): OfflineSyncIntegration {
    if (!OfflineSyncIntegration.instance) {
      OfflineSyncIntegration.instance = new OfflineSyncIntegration();
    }
    return OfflineSyncIntegration.instance;
  }

  /**
   * Enhanced synchronization with incremental updates
   */
  async performIncrementalSync(
    playerId: string, 
    config: Partial<SyncConfiguration> = {}
  ): Promise<TaskSyncResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    if (this.activeSyncs.has(playerId)) {
      throw new Error('Sync already in progress for this player');
    }

    this.activeSyncs.add(playerId);
    const startTime = Date.now();
    
    try {
      // Get local state and pending operations
      const localQueue = this.offlineManager.getQueueState(playerId);
      const pendingOps = await this.getPendingOperations(playerId);
      
      if (pendingOps.length === 0) {
        // No changes to sync
        return {
          success: true,
          conflicts: [],
          resolvedQueue: localQueue,
          syncTimestamp: Date.now()
        };
      }

      // Create incremental sync data
      const syncData = this.createIncrementalSyncData(playerId, localQueue, pendingOps);
      
      // Send incremental update to server
      const serverResponse = await this.sendIncrementalUpdate(syncData, finalConfig);
      
      // Handle server response and conflicts
      const result = await this.processServerResponse(
        playerId, 
        localQueue, 
        serverResponse, 
        finalConfig
      );
      
      // Update metrics
      this.updateSyncMetrics(playerId, startTime, result, syncData);
      
      return result;
      
    } catch (error) {
      this.handleSyncError(playerId, error as Error, startTime);
      throw error;
    } finally {
      this.activeSyncs.delete(playerId);
    }
  }

  /**
   * Create incremental sync data with minimal payload
   */
  private createIncrementalSyncData(
    playerId: string,
    localQueue: TaskQueue,
    operations: OfflineOperation[]
  ): IncrementalSyncData {
    return {
      playerId,
      fromVersion: localQueue.version - operations.length,
      toVersion: localQueue.version,
      operations: operations.map(op => ({
        ...op,
        // Only include essential data to minimize payload
        data: this.minimizeOperationData(op)
      })),
      checksum: this.calculateChecksum(operations),
      timestamp: Date.now()
    };
  }

  /**
   * Minimize operation data for efficient transfer
   */
  private minimizeOperationData(operation: OfflineOperation): any {
    switch (operation.type) {
      case 'add_task':
        // Only include essential task data
        return {
          id: operation.data.id,
          type: operation.data.type,
          name: operation.data.name,
          duration: operation.data.duration,
          activityData: operation.data.activityData,
          priority: operation.data.priority
        };
      
      case 'remove_task':
        return { taskId: operation.taskId };
      
      case 'reorder_tasks':
        return operation.data;
      
      case 'update_task':
        // Only include changed fields
        return this.extractChangedFields(operation.data);
      
      default:
        return operation.data;
    }
  }

  /**
   * Extract only changed fields from task update
   */
  private extractChangedFields(taskData: any): any {
    // This would compare with previous version and only include changes
    // For now, return all data (can be optimized)
    return taskData;
  }

  /**
   * Send incremental update to server
   */
  private async sendIncrementalUpdate(
    syncData: IncrementalSyncData,
    config: SyncConfiguration
  ): Promise<any> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Sync timeout')), config.syncTimeoutMs);
    });

    const syncPromise = NetworkUtils.postJson('/api/task-queue/incremental-sync', {
      syncData,
      config: {
        batchSize: config.syncBatchSize,
        conflictStrategy: config.conflictResolutionStrategy
      }
    });

    return Promise.race([syncPromise, timeoutPromise]);
  }

  /**
   * Process server response and handle conflicts
   */
  private async processServerResponse(
    playerId: string,
    localQueue: TaskQueue,
    serverResponse: any,
    config: SyncConfiguration
  ): Promise<TaskSyncResult> {
    const { success, conflicts, serverQueue, appliedOperations } = serverResponse;
    
    if (!success) {
      throw new Error('Server rejected sync request');
    }

    if (conflicts && conflicts.length > 0) {
      // Resolve conflicts based on strategy
      const resolvedQueue = await this.resolveConflicts(
        localQueue,
        serverQueue,
        conflicts,
        config.conflictResolutionStrategy
      );
      
      return {
        success: true,
        conflicts,
        resolvedQueue,
        syncTimestamp: Date.now()
      };
    }

    // No conflicts, apply server changes
    const mergedQueue = this.mergeServerChanges(localQueue, serverQueue, appliedOperations);
    
    return {
      success: true,
      conflicts: [],
      resolvedQueue: mergedQueue,
      syncTimestamp: Date.now()
    };
  }

  /**
   * Resolve conflicts using specified strategy
   */
  private async resolveConflicts(
    localQueue: TaskQueue,
    serverQueue: TaskQueue,
    conflicts: TaskSyncConflict[],
    strategy: string
  ): Promise<TaskQueue> {
    let resolvedQueue = { ...localQueue };
    
    for (const conflict of conflicts) {
      switch (strategy) {
        case 'server_wins':
          resolvedQueue = this.applyServerValue(resolvedQueue, conflict);
          break;
          
        case 'client_wins':
          resolvedQueue = this.applyClientValue(resolvedQueue, conflict);
          break;
          
        case 'merge':
          resolvedQueue = await this.mergeConflictIntelligently(resolvedQueue, conflict);
          break;
          
        case 'manual':
          // Queue for manual resolution
          await this.queueManualResolution(conflict);
          break;
      }
    }
    
    // Update version and sync timestamp
    resolvedQueue.version = Math.max(localQueue.version, serverQueue.version) + 1;
    resolvedQueue.lastSynced = Date.now();
    resolvedQueue.checksum = this.calculateQueueChecksum(resolvedQueue);
    
    return resolvedQueue;
  }

  /**
   * Apply server value in conflict resolution
   */
  private applyServerValue(queue: TaskQueue, conflict: TaskSyncConflict): TaskQueue {
    const updated = { ...queue };
    
    switch (conflict.type) {
      case 'task_modified':
        if (conflict.serverValue && conflict.taskId) {
          const index = updated.queuedTasks.findIndex(task => task.id === conflict.taskId);
          if (index >= 0) {
            updated.queuedTasks[index] = conflict.serverValue;
          }
        }
        break;
        
      case 'task_removed':
        if (conflict.taskId) {
          updated.queuedTasks = updated.queuedTasks.filter(task => task.id !== conflict.taskId);
        }
        break;
        
      case 'queue_state_changed':
        if (conflict.serverValue) {
          Object.assign(updated, conflict.serverValue);
        }
        break;
    }
    
    return updated;
  }

  /**
   * Apply client value in conflict resolution
   */
  private applyClientValue(queue: TaskQueue, conflict: TaskSyncConflict): TaskQueue {
    const updated = { ...queue };
    
    switch (conflict.type) {
      case 'task_added':
        if (conflict.clientValue && !updated.queuedTasks.find(task => task.id === conflict.clientValue.id)) {
          updated.queuedTasks.push(conflict.clientValue);
        }
        break;
        
      case 'task_modified':
        if (conflict.clientValue && conflict.taskId) {
          const index = updated.queuedTasks.findIndex(task => task.id === conflict.taskId);
          if (index >= 0) {
            updated.queuedTasks[index] = conflict.clientValue;
          }
        }
        break;
    }
    
    return updated;
  }

  /**
   * Merge conflicts intelligently based on data types
   */
  private async mergeConflictIntelligently(
    queue: TaskQueue,
    conflict: TaskSyncConflict
  ): Promise<TaskQueue> {
    const updated = { ...queue };
    
    if (conflict.type === 'task_modified' && conflict.serverValue && conflict.clientValue) {
      // Intelligent merging for task properties
      const mergedTask = {
        ...conflict.serverValue,
        // Use higher progress value
        progress: Math.max(conflict.serverValue.progress || 0, conflict.clientValue.progress || 0),
        // Use client priority (user preference)
        priority: conflict.clientValue.priority,
        // Merge rewards
        rewards: this.mergeRewards(conflict.serverValue.rewards || [], conflict.clientValue.rewards || []),
        // Use latest timestamps
        startTime: Math.max(conflict.serverValue.startTime || 0, conflict.clientValue.startTime || 0),
        // Use completion status from more advanced state
        completed: conflict.serverValue.completed || conflict.clientValue.completed
      };
      
      const index = updated.queuedTasks.findIndex(task => task.id === conflict.taskId);
      if (index >= 0) {
        updated.queuedTasks[index] = mergedTask;
      }
    }
    
    return updated;
  }

  /**
   * Merge reward arrays intelligently
   */
  private mergeRewards(serverRewards: any[], clientRewards: any[]): any[] {
    const rewardMap = new Map();
    
    // Add server rewards
    serverRewards.forEach(reward => {
      const key = `${reward.type}-${reward.itemId || 'none'}`;
      rewardMap.set(key, reward);
    });
    
    // Merge client rewards
    clientRewards.forEach(reward => {
      const key = `${reward.type}-${reward.itemId || 'none'}`;
      const existing = rewardMap.get(key);
      if (existing) {
        existing.quantity = Math.max(existing.quantity, reward.quantity);
      } else {
        rewardMap.set(key, reward);
      }
    });
    
    return Array.from(rewardMap.values());
  }

  /**
   * Merge server changes into local queue
   */
  private mergeServerChanges(
    localQueue: TaskQueue,
    serverQueue: TaskQueue,
    appliedOperations: string[]
  ): TaskQueue {
    // Start with server state as base
    const merged = { ...serverQueue };
    
    // Apply any local changes that weren't included in the sync
    const unappliedLocalChanges = this.getUnappliedLocalChanges(localQueue, appliedOperations);
    
    for (const change of unappliedLocalChanges) {
      merged.queuedTasks = this.applyLocalChange(merged.queuedTasks, change);
    }
    
    return merged;
  }

  /**
   * Get local changes that weren't applied in sync
   */
  private getUnappliedLocalChanges(localQueue: TaskQueue, appliedOperations: string[]): any[] {
    // This would track local changes and filter out applied ones
    // For now, return empty array
    return [];
  }

  /**
   * Apply local change to task list
   */
  private applyLocalChange(tasks: Task[], change: any): Task[] {
    // Apply local change logic
    return tasks;
  }

  /**
   * Queue conflict for manual resolution
   */
  private async queueManualResolution(conflict: TaskSyncConflict): Promise<void> {
    // Store conflict for manual resolution UI
    console.log('Conflict queued for manual resolution:', conflict);
  }

  /**
   * Get pending operations for a player
   */
  private async getPendingOperations(playerId: string): Promise<OfflineOperation[]> {
    // This would get pending operations from offline manager
    // For now, return empty array
    return [];
  }

  /**
   * Update sync metrics
   */
  private updateSyncMetrics(
    playerId: string,
    startTime: number,
    result: TaskSyncResult,
    syncData: IncrementalSyncData
  ): void {
    const duration = Date.now() - startTime;
    const metrics = this.syncMetrics.get(playerId) || this.createEmptyMetrics();
    
    metrics.totalSyncs++;
    if (result.success) {
      metrics.successfulSyncs++;
    } else {
      metrics.failedSyncs++;
    }
    
    metrics.conflictsResolved += result.conflicts.length;
    metrics.lastSyncDuration = duration;
    metrics.averageSyncTime = (metrics.averageSyncTime * (metrics.totalSyncs - 1) + duration) / metrics.totalSyncs;
    metrics.dataTransferred += JSON.stringify(syncData).length;
    metrics.operationsSynced += syncData.operations.length;
    
    this.syncMetrics.set(playerId, metrics);
  }

  /**
   * Handle sync error
   */
  private handleSyncError(playerId: string, error: Error, startTime: number): void {
    const duration = Date.now() - startTime;
    const metrics = this.syncMetrics.get(playerId) || this.createEmptyMetrics();
    
    metrics.totalSyncs++;
    metrics.failedSyncs++;
    metrics.lastSyncDuration = duration;
    
    this.syncMetrics.set(playerId, metrics);
    
    console.error(`Sync failed for player ${playerId}:`, error);
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): SyncMetrics {
    return {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsResolved: 0,
      averageSyncTime: 0,
      lastSyncDuration: 0,
      dataTransferred: 0,
      operationsSynced: 0
    };
  }

  /**
   * Calculate checksum for operations
   */
  private calculateChecksum(operations: OfflineOperation[]): string {
    const data = JSON.stringify(operations.map(op => ({
      id: op.id,
      type: op.type,
      timestamp: op.timestamp,
      taskId: op.taskId
    })));
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(16);
  }

  /**
   * Calculate checksum for queue
   */
  private calculateQueueChecksum(queue: TaskQueue): string {
    const data = JSON.stringify({
      version: queue.version,
      currentTaskId: queue.currentTask?.id,
      queuedTaskIds: queue.queuedTasks.map(task => task.id),
      isRunning: queue.isRunning,
      isPaused: queue.isPaused
    });
    
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(16);
  }

  /**
   * Get sync metrics for a player
   */
  getSyncMetrics(playerId: string): SyncMetrics {
    return this.syncMetrics.get(playerId) || this.createEmptyMetrics();
  }

  /**
   * Reset sync metrics for a player
   */
  resetSyncMetrics(playerId: string): void {
    this.syncMetrics.delete(playerId);
  }

  /**
   * Check if sync is active for a player
   */
  isSyncActive(playerId: string): boolean {
    return this.activeSyncs.has(playerId);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.activeSyncs.clear();
    this.syncMetrics.clear();
  }
}

export default OfflineSyncIntegration;