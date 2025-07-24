/**
 * Offline Task Queue Manager
 * Handles local queue management when offline and synchronization when reconnecting
 */

import { 
  Task, 
  TaskQueue, 
  TaskType, 
  TaskReward, 
  TaskProgress, 
  TaskCompletionResult,
  TaskSyncResult,
  TaskSyncConflict,
  QueueStateSnapshot
} from '../types/taskQueue';
import { CharacterStats } from '../types/character';
import { HarvestingActivity } from '../types/harvesting';
import { CraftingRecipe } from '../types/crafting';
import { Enemy, PlayerCombatStats } from '../types/combat';

export interface OfflineQueueState {
  playerId: string;
  queue: TaskQueue;
  pendingOperations: OfflineOperation[];
  lastOnlineSync: number;
  offlineStartTime: number;
  isOffline: boolean;
  localVersion: number;
  syncStatus: SyncStatus;
  conflictResolutionLog: ConflictResolution[];
}

export interface OfflineOperation {
  id: string;
  type: 'add_task' | 'remove_task' | 'reorder_tasks' | 'pause_queue' | 'resume_queue' | 'update_task' | 'clear_queue';
  timestamp: number;
  data: any;
  taskId?: string;
  playerId: string;
  localVersion: number;
  applied: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncAttempt: number;
  lastSuccessfulSync: number;
  syncInProgress: boolean;
  pendingOperationsCount: number;
  conflictsDetected: number;
  syncErrors: SyncError[];
  nextSyncScheduled?: number;
  manualSyncRequested: boolean;
}

export interface SyncError {
  timestamp: number;
  error: string;
  operation?: OfflineOperation;
  retryCount: number;
  resolved: boolean;
}

export interface ConflictResolution {
  timestamp: number;
  conflictType: string;
  resolution: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  taskId?: string;
  details: string;
}

export interface IncrementalSyncData {
  playerId: string;
  fromVersion: number;
  toVersion: number;
  operations: OfflineOperation[];
  checksum: string;
  timestamp: number;
}

export interface SyncIndicator {
  status: 'online' | 'offline' | 'syncing' | 'error' | 'conflict';
  message: string;
  progress?: number;
  lastSync?: number;
  pendingCount?: number;
  canManualSync: boolean;
}

/**
 * Offline Task Queue Manager
 * Provides comprehensive offline queue management with conflict resolution
 */
export class OfflineTaskQueueManager {
  private static instance: OfflineTaskQueueManager;
  private offlineStates: Map<string, OfflineQueueState> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly STORAGE_KEY_PREFIX = 'offline_queue_';
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private readonly MAX_PENDING_OPERATIONS = 1000;
  private readonly MAX_OFFLINE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

  private constructor() {
    this.initializeFromStorage();
    this.startSyncMonitoring();
    this.setupNetworkListeners();
  }

  static getInstance(): OfflineTaskQueueManager {
    if (!OfflineTaskQueueManager.instance) {
      OfflineTaskQueueManager.instance = new OfflineTaskQueueManager();
    }
    return OfflineTaskQueueManager.instance;
  }

  /**
   * Initialize offline states from localStorage
   */
  private initializeFromStorage(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.STORAGE_KEY_PREFIX));
      
      for (const key of keys) {
        const playerId = key.replace(this.STORAGE_KEY_PREFIX, '');
        const storedData = localStorage.getItem(key);
        
        if (storedData) {
          const offlineState: OfflineQueueState = JSON.parse(storedData);
          this.offlineStates.set(playerId, offlineState);
        }
      }
    } catch (error) {
      console.error('Failed to initialize offline states from storage:', error);
    }
  }

  /**
   * Start monitoring for sync opportunities
   */
  private startSyncMonitoring(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.performPeriodicSync();
    }, this.SYNC_INTERVAL);
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.handleNetworkStatusChange(true);
      });

      window.addEventListener('offline', () => {
        this.handleNetworkStatusChange(false);
      });
    }
  }

  /**
   * Handle network status changes
   */
  private handleNetworkStatusChange(isOnline: boolean): void {
    for (const [playerId, state] of this.offlineStates.entries()) {
      const wasOffline = state.isOffline;
      state.isOffline = !isOnline;
      state.syncStatus.isOnline = isOnline;

      if (wasOffline && isOnline) {
        // Just came online, trigger sync
        this.triggerSync(playerId);
      } else if (!wasOffline && !isOnline) {
        // Just went offline, record timestamp
        state.offlineStartTime = Date.now();
      }

      this.persistOfflineState(playerId, state);
    }
  }

  /**
   * Get or create offline state for a player
   */
  private getOfflineState(playerId: string): OfflineQueueState {
    let state = this.offlineStates.get(playerId);
    
    if (!state) {
      state = {
        playerId,
        queue: this.createEmptyQueue(playerId),
        pendingOperations: [],
        lastOnlineSync: Date.now(),
        offlineStartTime: 0,
        isOffline: !navigator.onLine,
        localVersion: 1,
        syncStatus: {
          isOnline: navigator.onLine,
          lastSyncAttempt: 0,
          lastSuccessfulSync: 0,
          syncInProgress: false,
          pendingOperationsCount: 0,
          conflictsDetected: 0,
          syncErrors: [],
          manualSyncRequested: false
        },
        conflictResolutionLog: []
      };
      
      this.offlineStates.set(playerId, state);
      this.persistOfflineState(playerId, state);
    }
    
    return state;
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
        priorityHandling: true,
        retryEnabled: true,
        maxRetries: 3,
        validationEnabled: true,
        syncInterval: 30000,
        offlineProcessingEnabled: true,
        pauseOnError: false,
        resumeOnResourceAvailable: true,
        persistenceInterval: 5000,
        integrityCheckInterval: 60000,
        maxHistorySize: 100
      },
      lastUpdated: Date.now(),
      lastSynced: Date.now(),
      createdAt: Date.now(),
      version: 1,
      checksum: '',
      lastValidated: Date.now(),
      stateHistory: [],
      maxHistorySize: 100
    };
  }

  /**
   * Add task to offline queue
   */
  async addTask(playerId: string, task: Task): Promise<void> {
    const state = this.getOfflineState(playerId);
    
    // Add task to local queue
    state.queue.queuedTasks.push(task);
    state.queue.lastUpdated = Date.now();
    state.localVersion++;
    
    // Record operation for sync
    const operation: OfflineOperation = {
      id: this.generateOperationId(),
      type: 'add_task',
      timestamp: Date.now(),
      data: task,
      taskId: task.id,
      playerId,
      localVersion: state.localVersion,
      applied: false
    };
    
    this.addPendingOperation(state, operation);
    this.updateSyncStatus(state);
    this.persistOfflineState(playerId, state);
    
    // Process task if queue should auto-start
    if (state.queue.config.autoStart && !state.queue.isRunning && !state.queue.isPaused) {
      await this.startLocalProcessing(playerId);
    }
  }

  /**
   * Remove task from offline queue
   */
  async removeTask(playerId: string, taskId: string): Promise<void> {
    const state = this.getOfflineState(playerId);
    
    // Remove from local queue
    const taskIndex = state.queue.queuedTasks.findIndex(task => task.id === taskId);
    if (taskIndex >= 0) {
      const removedTask = state.queue.queuedTasks.splice(taskIndex, 1)[0];
      state.queue.lastUpdated = Date.now();
      state.localVersion++;
      
      // Record operation for sync
      const operation: OfflineOperation = {
        id: this.generateOperationId(),
        type: 'remove_task',
        timestamp: Date.now(),
        data: removedTask,
        taskId,
        playerId,
        localVersion: state.localVersion,
        applied: false
      };
      
      this.addPendingOperation(state, operation);
      this.updateSyncStatus(state);
      this.persistOfflineState(playerId, state);
    }
  }

  /**
   * Reorder tasks in offline queue
   */
  async reorderTasks(playerId: string, taskIds: string[]): Promise<void> {
    const state = this.getOfflineState(playerId);
    
    // Reorder local queue
    const reorderedTasks: Task[] = [];
    for (const taskId of taskIds) {
      const task = state.queue.queuedTasks.find(t => t.id === taskId);
      if (task) {
        reorderedTasks.push(task);
      }
    }
    
    state.queue.queuedTasks = reorderedTasks;
    state.queue.lastUpdated = Date.now();
    state.localVersion++;
    
    // Record operation for sync
    const operation: OfflineOperation = {
      id: this.generateOperationId(),
      type: 'reorder_tasks',
      timestamp: Date.now(),
      data: { taskIds },
      playerId,
      localVersion: state.localVersion,
      applied: false
    };
    
    this.addPendingOperation(state, operation);
    this.updateSyncStatus(state);
    this.persistOfflineState(playerId, state);
  }

  /**
   * Pause offline queue
   */
  async pauseQueue(playerId: string, reason?: string): Promise<void> {
    const state = this.getOfflineState(playerId);
    
    state.queue.isPaused = true;
    state.queue.pauseReason = reason;
    state.queue.pausedAt = Date.now();
    state.queue.lastUpdated = Date.now();
    state.localVersion++;
    
    // Record operation for sync
    const operation: OfflineOperation = {
      id: this.generateOperationId(),
      type: 'pause_queue',
      timestamp: Date.now(),
      data: { reason },
      playerId,
      localVersion: state.localVersion,
      applied: false
    };
    
    this.addPendingOperation(state, operation);
    this.updateSyncStatus(state);
    this.persistOfflineState(playerId, state);
  }

  /**
   * Resume offline queue
   */
  async resumeQueue(playerId: string): Promise<void> {
    const state = this.getOfflineState(playerId);
    
    state.queue.isPaused = false;
    state.queue.pauseReason = undefined;
    state.queue.resumedAt = Date.now();
    state.queue.lastUpdated = Date.now();
    state.localVersion++;
    
    // Record operation for sync
    const operation: OfflineOperation = {
      id: this.generateOperationId(),
      type: 'resume_queue',
      timestamp: Date.now(),
      data: {},
      playerId,
      localVersion: state.localVersion,
      applied: false
    };
    
    this.addPendingOperation(state, operation);
    this.updateSyncStatus(state);
    this.persistOfflineState(playerId, state);
    
    // Resume local processing
    await this.startLocalProcessing(playerId);
  }

  /**
   * Get current queue state
   */
  getQueueState(playerId: string): TaskQueue {
    const state = this.getOfflineState(playerId);
    return { ...state.queue };
  }

  /**
   * Get sync status indicator
   */
  getSyncIndicator(playerId: string): SyncIndicator {
    const state = this.getOfflineState(playerId);
    const syncStatus = state.syncStatus;
    
    if (syncStatus.syncInProgress) {
      return {
        status: 'syncing',
        message: 'Synchronizing with server...',
        progress: this.calculateSyncProgress(state),
        lastSync: syncStatus.lastSuccessfulSync,
        pendingCount: syncStatus.pendingOperationsCount,
        canManualSync: false
      };
    }
    
    if (!syncStatus.isOnline) {
      return {
        status: 'offline',
        message: `Offline - ${syncStatus.pendingOperationsCount} changes pending`,
        lastSync: syncStatus.lastSuccessfulSync,
        pendingCount: syncStatus.pendingOperationsCount,
        canManualSync: false
      };
    }
    
    if (syncStatus.syncErrors.length > 0) {
      return {
        status: 'error',
        message: `Sync error - ${syncStatus.syncErrors.length} errors`,
        lastSync: syncStatus.lastSuccessfulSync,
        pendingCount: syncStatus.pendingOperationsCount,
        canManualSync: true
      };
    }
    
    if (syncStatus.conflictsDetected > 0) {
      return {
        status: 'conflict',
        message: `${syncStatus.conflictsDetected} conflicts detected`,
        lastSync: syncStatus.lastSuccessfulSync,
        pendingCount: syncStatus.pendingOperationsCount,
        canManualSync: true
      };
    }
    
    if (syncStatus.pendingOperationsCount > 0) {
      return {
        status: 'syncing',
        message: `${syncStatus.pendingOperationsCount} changes to sync`,
        lastSync: syncStatus.lastSuccessfulSync,
        pendingCount: syncStatus.pendingOperationsCount,
        canManualSync: true
      };
    }
    
    return {
      status: 'online',
      message: 'All changes synchronized',
      lastSync: syncStatus.lastSuccessfulSync,
      pendingCount: 0,
      canManualSync: true
    };
  }

  /**
   * Trigger manual sync
   */
  async triggerManualSync(playerId: string): Promise<TaskSyncResult> {
    const state = this.getOfflineState(playerId);
    state.syncStatus.manualSyncRequested = true;
    
    return this.performSync(playerId);
  }

  /**
   * Perform synchronization with server
   */
  async performSync(playerId: string): Promise<TaskSyncResult> {
    const state = this.getOfflineState(playerId);
    
    if (state.syncStatus.syncInProgress) {
      throw new Error('Sync already in progress');
    }
    
    state.syncStatus.syncInProgress = true;
    state.syncStatus.lastSyncAttempt = Date.now();
    this.updateSyncStatus(state);
    
    try {
      // Get server queue state
      const serverQueue = await this.fetchServerQueueState(playerId);
      
      if (!serverQueue) {
        // No server state, upload local state
        const result = await this.uploadLocalState(playerId, state.queue);
        this.handleSyncSuccess(state, result);
        return result;
      }
      
      // Detect conflicts
      const conflicts = this.detectConflicts(state.queue, serverQueue);
      
      if (conflicts.length === 0) {
        // No conflicts, apply pending operations
        const result = await this.applyPendingOperations(playerId, state);
        this.handleSyncSuccess(state, result);
        return result;
      }
      
      // Resolve conflicts
      const resolvedQueue = await this.resolveConflicts(state.queue, serverQueue, conflicts);
      
      // Update server with resolved state
      await this.updateServerState(playerId, resolvedQueue);
      
      const result: TaskSyncResult = {
        success: true,
        conflicts,
        resolvedQueue,
        syncTimestamp: Date.now()
      };
      
      this.handleSyncSuccess(state, result);
      return result;
      
    } catch (error) {
      this.handleSyncError(state, error as Error);
      throw error;
    } finally {
      state.syncStatus.syncInProgress = false;
      state.syncStatus.manualSyncRequested = false;
      this.persistOfflineState(playerId, state);
    }
  }

  /**
   * Add pending operation with deduplication
   */
  private addPendingOperation(state: OfflineQueueState, operation: OfflineOperation): void {
    // Remove old operations that would be superseded
    if (operation.type === 'reorder_tasks') {
      state.pendingOperations = state.pendingOperations.filter(op => op.type !== 'reorder_tasks');
    }
    
    state.pendingOperations.push(operation);
    
    // Limit pending operations
    if (state.pendingOperations.length > this.MAX_PENDING_OPERATIONS) {
      state.pendingOperations = state.pendingOperations.slice(-this.MAX_PENDING_OPERATIONS);
    }
  }

  /**
   * Update sync status
   */
  private updateSyncStatus(state: OfflineQueueState): void {
    state.syncStatus.pendingOperationsCount = state.pendingOperations.filter(op => !op.applied).length;
    
    // Schedule next sync if online and has pending operations
    if (state.syncStatus.isOnline && state.syncStatus.pendingOperationsCount > 0 && !state.syncStatus.nextSyncScheduled) {
      state.syncStatus.nextSyncScheduled = Date.now() + this.SYNC_INTERVAL;
    }
  }

  /**
   * Persist offline state to localStorage
   */
  private persistOfflineState(playerId: string, state: OfflineQueueState): void {
    try {
      const key = this.STORAGE_KEY_PREFIX + playerId;
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to persist offline state:', error);
    }
  }

  /**
   * Start local task processing
   */
  private async startLocalProcessing(playerId: string): Promise<void> {
    const state = this.getOfflineState(playerId);
    
    if (state.queue.isPaused || state.queue.isRunning) {
      return;
    }
    
    state.queue.isRunning = true;
    
    // Simple local processing - just mark tasks as completed after their duration
    if (state.queue.queuedTasks.length > 0 && !state.queue.currentTask) {
      const nextTask = state.queue.queuedTasks.shift()!;
      state.queue.currentTask = nextTask;
      nextTask.startTime = Date.now();
      
      // Simulate task completion after duration
      setTimeout(() => {
        this.completeLocalTask(playerId, nextTask.id);
      }, nextTask.duration);
    }
    
    this.persistOfflineState(playerId, state);
  }

  /**
   * Complete local task processing
   */
  private async completeLocalTask(playerId: string, taskId: string): Promise<void> {
    const state = this.getOfflineState(playerId);
    
    if (state.queue.currentTask?.id === taskId) {
      const completedTask = state.queue.currentTask;
      completedTask.completed = true;
      completedTask.progress = 1;
      
      // Move to completed and start next task
      state.queue.currentTask = null;
      state.queue.totalTasksCompleted++;
      state.queue.totalTimeSpent += completedTask.duration;
      
      // Start next task if available
      if (state.queue.queuedTasks.length > 0) {
        await this.startLocalProcessing(playerId);
      } else {
        state.queue.isRunning = false;
      }
      
      this.persistOfflineState(playerId, state);
    }
  }

  /**
   * Perform periodic sync for all players
   */
  private async performPeriodicSync(): Promise<void> {
    for (const [playerId, state] of this.offlineStates.entries()) {
      if (state.syncStatus.isOnline && 
          state.syncStatus.pendingOperationsCount > 0 && 
          !state.syncStatus.syncInProgress &&
          (!state.syncStatus.nextSyncScheduled || Date.now() >= state.syncStatus.nextSyncScheduled)) {
        
        try {
          await this.performSync(playerId);
        } catch (error) {
          console.error(`Periodic sync failed for player ${playerId}:`, error);
        }
      }
    }
  }

  /**
   * Calculate sync progress
   */
  private calculateSyncProgress(state: OfflineQueueState): number {
    const total = state.pendingOperations.length;
    const applied = state.pendingOperations.filter(op => op.applied).length;
    return total > 0 ? (applied / total) * 100 : 0;
  }

  /**
   * Detect conflicts between local and server state
   */
  private detectConflicts(localQueue: TaskQueue, serverQueue: TaskQueue): TaskSyncConflict[] {
    const conflicts: TaskSyncConflict[] = [];
    
    // Version mismatch indicates potential conflicts
    if (localQueue.version !== serverQueue.version) {
      const localTaskMap = new Map(localQueue.queuedTasks.map(task => [task.id, task]));
      const serverTaskMap = new Map(serverQueue.queuedTasks.map(task => [task.id, task]));
      
      // Check for task modifications
      for (const [taskId, localTask] of localTaskMap) {
        const serverTask = serverTaskMap.get(taskId);
        if (serverTask && this.tasksConflict(localTask, serverTask)) {
          conflicts.push({
            type: 'task_modified',
            taskId,
            serverValue: serverTask,
            clientValue: localTask,
            resolution: 'use_server'
          });
        }
      }
      
      // Check for added tasks
      for (const taskId of localTaskMap.keys()) {
        if (!serverTaskMap.has(taskId)) {
          conflicts.push({
            type: 'task_added',
            taskId,
            serverValue: null,
            clientValue: localTaskMap.get(taskId),
            resolution: 'use_client'
          });
        }
      }
      
      // Check for removed tasks
      for (const taskId of serverTaskMap.keys()) {
        if (!localTaskMap.has(taskId)) {
          conflicts.push({
            type: 'task_removed',
            taskId,
            serverValue: serverTaskMap.get(taskId),
            clientValue: null,
            resolution: 'use_server'
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Check if two tasks conflict
   */
  private tasksConflict(task1: Task, task2: Task): boolean {
    return (
      task1.progress !== task2.progress ||
      task1.completed !== task2.completed ||
      task1.priority !== task2.priority ||
      task1.startTime !== task2.startTime
    );
  }

  /**
   * Resolve conflicts using intelligent strategies
   */
  private async resolveConflicts(
    localQueue: TaskQueue,
    serverQueue: TaskQueue,
    conflicts: TaskSyncConflict[]
  ): Promise<TaskQueue> {
    let resolvedQueue = { ...serverQueue };
    
    for (const conflict of conflicts) {
      switch (conflict.resolution) {
        case 'use_client':
          resolvedQueue = this.applyClientValue(resolvedQueue, conflict);
          break;
        case 'use_server':
          // Already using server state
          break;
        case 'merge':
          resolvedQueue = this.mergeConflict(resolvedQueue, conflict);
          break;
      }
    }
    
    resolvedQueue.version = Math.max(localQueue.version, serverQueue.version) + 1;
    resolvedQueue.lastSynced = Date.now();
    
    return resolvedQueue;
  }

  /**
   * Apply client value to resolved queue
   */
  private applyClientValue(resolvedQueue: TaskQueue, conflict: TaskSyncConflict): TaskQueue {
    const updated = { ...resolvedQueue };
    
    if (conflict.type === 'task_added' && conflict.clientValue && conflict.taskId) {
      updated.queuedTasks.push(conflict.clientValue);
    }
    
    return updated;
  }

  /**
   * Merge conflicting values
   */
  private mergeConflict(resolvedQueue: TaskQueue, conflict: TaskSyncConflict): TaskQueue {
    // For now, use server value (can be enhanced with more sophisticated merging)
    return resolvedQueue;
  }

  /**
   * Handle successful sync
   */
  private handleSyncSuccess(state: OfflineQueueState, result: TaskSyncResult): void {
    state.syncStatus.lastSuccessfulSync = Date.now();
    state.syncStatus.syncErrors = [];
    state.syncStatus.conflictsDetected = result.conflicts.length;
    
    // Mark operations as applied
    state.pendingOperations.forEach(op => op.applied = true);
    
    // Update local queue with resolved state
    state.queue = result.resolvedQueue;
    state.localVersion = result.resolvedQueue.version;
    
    this.updateSyncStatus(state);
  }

  /**
   * Handle sync error
   */
  private handleSyncError(state: OfflineQueueState, error: Error): void {
    const syncError: SyncError = {
      timestamp: Date.now(),
      error: error.message,
      retryCount: 0,
      resolved: false
    };
    
    state.syncStatus.syncErrors.push(syncError);
    
    // Limit error history
    if (state.syncStatus.syncErrors.length > 10) {
      state.syncStatus.syncErrors = state.syncStatus.syncErrors.slice(-10);
    }
  }

  // Placeholder methods for server communication
  private async fetchServerQueueState(playerId: string): Promise<TaskQueue | null> {
    // This would make an actual API call to fetch server state
    return null;
  }

  private async uploadLocalState(playerId: string, queue: TaskQueue): Promise<TaskSyncResult> {
    // This would upload local state to server
    return {
      success: true,
      conflicts: [],
      resolvedQueue: queue,
      syncTimestamp: Date.now()
    };
  }

  private async applyPendingOperations(playerId: string, state: OfflineQueueState): Promise<TaskSyncResult> {
    // This would apply pending operations to server
    return {
      success: true,
      conflicts: [],
      resolvedQueue: state.queue,
      syncTimestamp: Date.now()
    };
  }

  private async updateServerState(playerId: string, queue: TaskQueue): Promise<void> {
    // This would update server with resolved state
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return 'op-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Trigger sync for a specific player
   */
  private async triggerSync(playerId: string): Promise<void> {
    try {
      await this.performSync(playerId);
    } catch (error) {
      console.error(`Failed to trigger sync for player ${playerId}:`, error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.offlineStates.clear();
  }
}