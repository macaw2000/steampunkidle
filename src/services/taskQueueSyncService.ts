/**
 * Task Queue Real-Time Synchronization Service
 * Handles efficient delta synchronization and conflict resolution for task queues
 */

import { TaskQueue, Task, TaskSyncData, TaskSyncResult, TaskSyncConflict, QueueStateSnapshot } from '../types/taskQueue';
import WebSocketService from './websocketService';
import { DatabaseService } from './databaseService';

export interface DeltaUpdate {
  type: 'task_added' | 'task_removed' | 'task_updated' | 'queue_state_changed' | 'task_progress';
  playerId: string;
  taskId?: string;
  data: any;
  timestamp: number;
  version: number;
  checksum: string;
}

export interface SyncMessage {
  type: 'sync_request' | 'sync_response' | 'delta_update' | 'conflict_resolution' | 'heartbeat' | 'heartbeat_response';
  playerId: string;
  data: any;
  timestamp: number;
  messageId: string;
}

export interface HeartbeatData {
  playerId: string;
  lastActivity: number;
  queueVersion: number;
  connectionId: string;
}

export interface ConflictResolutionStrategy {
  type: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  priority: number;
  description: string;
}

export class TaskQueueSyncService {
  private static instance: TaskQueueSyncService;
  private wsService: WebSocketService;
  private pendingSyncs: Map<string, Promise<TaskSyncResult>> = new Map();
  private deltaBuffer: Map<string, DeltaUpdate[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatFrequency = 30000; // 30 seconds
  private connectionStates: Map<string, HeartbeatData> = new Map();
  private conflictResolutionStrategies: Map<string, ConflictResolutionStrategy> = new Map();

  private constructor() {
    this.wsService = WebSocketService.getInstance();
    this.initializeConflictStrategies();
    this.setupWebSocketHandlers();
    this.startHeartbeat();
  }

  static getInstance(): TaskQueueSyncService {
    if (!TaskQueueSyncService.instance) {
      TaskQueueSyncService.instance = new TaskQueueSyncService();
    }
    return TaskQueueSyncService.instance;
  }

  /**
   * Initialize conflict resolution strategies
   */
  private initializeConflictStrategies(): void {
    this.conflictResolutionStrategies.set('default', {
      type: 'server_wins',
      priority: 1,
      description: 'Server state takes precedence in conflicts'
    });

    this.conflictResolutionStrategies.set('client_priority', {
      type: 'client_wins',
      priority: 2,
      description: 'Client state takes precedence for user actions'
    });

    this.conflictResolutionStrategies.set('merge', {
      type: 'merge',
      priority: 3,
      description: 'Attempt to merge conflicting states intelligently'
    });
  }

  /**
   * Setup WebSocket message handlers for synchronization
   */
  private setupWebSocketHandlers(): void {
    this.wsService.subscribe('sync_request', this.handleSyncRequest.bind(this));
    this.wsService.subscribe('sync_response', this.handleSyncResponse.bind(this));
    this.wsService.subscribe('delta_update', this.handleDeltaUpdate.bind(this));
    this.wsService.subscribe('conflict_resolution', this.handleConflictResolution.bind(this));
    this.wsService.subscribe('heartbeat', this.handleHeartbeat.bind(this));
    this.wsService.subscribe('heartbeat_response', this.handleHeartbeatResponse.bind(this));
  }

  /**
   * Start heartbeat mechanism to detect disconnected clients
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.checkStaleConnections();
    }, this.heartbeatFrequency);
  }

  /**
   * Send heartbeat to server
   */
  private sendHeartbeat(): void {
    if (!this.wsService.isConnected()) {
      return;
    }

    const playerId = this.getCurrentPlayerId();
    if (!playerId) {
      return;
    }

    const heartbeatMessage: SyncMessage = {
      type: 'heartbeat',
      playerId,
      data: {
        timestamp: Date.now(),
        queueVersion: this.getQueueVersion(playerId),
        connectionId: this.getConnectionId()
      },
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };

    this.wsService.send(heartbeatMessage);
  }

  /**
   * Check for stale connections and clean them up
   */
  private checkStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = this.heartbeatFrequency * 3; // 90 seconds

    for (const [playerId, heartbeatData] of this.connectionStates.entries()) {
      if (now - heartbeatData.lastActivity > staleThreshold) {
        console.warn(`Stale connection detected for player ${playerId}`);
        this.connectionStates.delete(playerId);
        this.handleStaleConnection(playerId);
      }
    }
  }

  /**
   * Handle stale connection cleanup
   */
  private handleStaleConnection(playerId: string): void {
    // Clear pending syncs for this player
    this.pendingSyncs.delete(playerId);
    
    // Clear delta buffer
    this.deltaBuffer.delete(playerId);
    
    // Notify other services about disconnection
    this.notifyConnectionLost(playerId);
  }

  /**
   * Synchronize queue state with server using delta updates
   */
  async syncQueueState(playerId: string, localQueue: TaskQueue): Promise<TaskSyncResult> {
    // Check if sync is already in progress
    const existingSync = this.pendingSyncs.get(playerId);
    if (existingSync) {
      return existingSync;
    }

    const syncPromise = this.performSync(playerId, localQueue);
    this.pendingSyncs.set(playerId, syncPromise);

    try {
      const result = await syncPromise;
      return result;
    } finally {
      this.pendingSyncs.delete(playerId);
    }
  }

  /**
   * Perform actual synchronization
   */
  private async performSync(playerId: string, localQueue: TaskQueue): Promise<TaskSyncResult> {
    try {
      // Get server queue state
      const serverQueue = await this.getServerQueueState(playerId);
      
      if (!serverQueue) {
        // No server state, upload local state
        return this.uploadLocalState(playerId, localQueue);
      }

      // Compare versions and detect conflicts
      const conflicts = this.detectConflicts(localQueue, serverQueue);
      
      if (conflicts.length === 0) {
        // No conflicts, apply any pending deltas
        const updatedQueue = await this.applyPendingDeltas(playerId, localQueue);
        return {
          success: true,
          conflicts: [],
          resolvedQueue: updatedQueue,
          syncTimestamp: Date.now()
        };
      }

      // Resolve conflicts
      const resolvedQueue = await this.resolveConflicts(localQueue, serverQueue, conflicts);
      
      // Update server with resolved state
      await this.updateServerState(playerId, resolvedQueue);

      return {
        success: true,
        conflicts,
        resolvedQueue,
        syncTimestamp: Date.now()
      };

    } catch (error) {
      console.error(`Sync failed for player ${playerId}:`, error);
      return {
        success: false,
        conflicts: [],
        resolvedQueue: localQueue,
        syncTimestamp: Date.now()
      };
    }
  }

  /**
   * Detect conflicts between local and server queue states
   */
  private detectConflicts(localQueue: TaskQueue, serverQueue: TaskQueue): TaskSyncConflict[] {
    const conflicts: TaskSyncConflict[] = [];

    // Check version mismatch
    if (localQueue.version !== serverQueue.version) {
      // Compare individual tasks
      const localTaskMap = new Map(localQueue.queuedTasks.map(task => [task.id, task]));
      const serverTaskMap = new Map(serverQueue.queuedTasks.map(task => [task.id, task]));

      // Check for modified tasks
      for (const [taskId, localTask] of localTaskMap) {
        const serverTask = serverTaskMap.get(taskId);
        if (serverTask && this.tasksConflict(localTask, serverTask)) {
          conflicts.push({
            type: 'task_modified',
            taskId,
            serverValue: serverTask,
            clientValue: localTask,
            resolution: 'use_server' // Default resolution
          });
        }
      }

      // Check for added/removed tasks
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

      // Check queue state changes
      if (localQueue.isRunning !== serverQueue.isRunning ||
          localQueue.isPaused !== serverQueue.isPaused ||
          localQueue.currentTask?.id !== serverQueue.currentTask?.id) {
        conflicts.push({
          type: 'queue_state_changed',
          serverValue: {
            isRunning: serverQueue.isRunning,
            isPaused: serverQueue.isPaused,
            currentTaskId: serverQueue.currentTask?.id
          },
          clientValue: {
            isRunning: localQueue.isRunning,
            isPaused: localQueue.isPaused,
            currentTaskId: localQueue.currentTask?.id
          },
          resolution: 'use_server'
        });
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
      task1.startTime !== task2.startTime ||
      JSON.stringify(task1.rewards) !== JSON.stringify(task2.rewards)
    );
  }

  /**
   * Resolve conflicts using configured strategies
   */
  private async resolveConflicts(
    localQueue: TaskQueue,
    serverQueue: TaskQueue,
    conflicts: TaskSyncConflict[]
  ): Promise<TaskQueue> {
    let resolvedQueue = { ...serverQueue }; // Start with server state

    for (const conflict of conflicts) {
      const strategy = this.getConflictStrategy(conflict);
      
      switch (strategy.type) {
        case 'server_wins':
          // Already using server state, no action needed
          break;
          
        case 'client_wins':
          resolvedQueue = this.applyClientValue(resolvedQueue, conflict);
          break;
          
        case 'merge':
          resolvedQueue = await this.mergeConflict(resolvedQueue, conflict);
          break;
          
        case 'manual':
          // For now, fall back to server wins
          // In a full implementation, this would prompt user or queue for manual resolution
          break;
      }
    }

    // Update metadata
    resolvedQueue.version = Math.max(localQueue.version, serverQueue.version) + 1;
    resolvedQueue.lastSynced = Date.now();
    resolvedQueue.checksum = this.calculateChecksum(resolvedQueue);

    return resolvedQueue;
  }

  /**
   * Get conflict resolution strategy for a specific conflict
   */
  private getConflictStrategy(conflict: TaskSyncConflict): ConflictResolutionStrategy {
    // Use different strategies based on conflict type
    switch (conflict.type) {
      case 'task_added':
        return this.conflictResolutionStrategies.get('client_priority')!;
      case 'task_removed':
        return this.conflictResolutionStrategies.get('default')!;
      case 'task_modified':
        return this.conflictResolutionStrategies.get('merge')!;
      case 'queue_state_changed':
        return this.conflictResolutionStrategies.get('default')!;
      default:
        return this.conflictResolutionStrategies.get('default')!;
    }
  }

  /**
   * Apply client value to resolved queue
   */
  private applyClientValue(resolvedQueue: TaskQueue, conflict: TaskSyncConflict): TaskQueue {
    const updated = { ...resolvedQueue };
    
    switch (conflict.type) {
      case 'task_added':
        if (conflict.clientValue && conflict.taskId) {
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
        
      case 'queue_state_changed':
        if (conflict.clientValue) {
          updated.isRunning = conflict.clientValue.isRunning;
          updated.isPaused = conflict.clientValue.isPaused;
          if (conflict.clientValue.currentTaskId) {
            updated.currentTask = updated.queuedTasks.find(task => task.id === conflict.clientValue.currentTaskId) || null;
          }
        }
        break;
    }
    
    return updated;
  }

  /**
   * Merge conflicting values intelligently
   */
  private async mergeConflict(resolvedQueue: TaskQueue, conflict: TaskSyncConflict): Promise<TaskQueue> {
    const updated = { ...resolvedQueue };
    
    if (conflict.type === 'task_modified' && conflict.serverValue && conflict.clientValue) {
      // Merge task properties intelligently
      const mergedTask = this.mergeTaskProperties(conflict.serverValue, conflict.clientValue);
      const index = updated.queuedTasks.findIndex(task => task.id === conflict.taskId);
      if (index >= 0) {
        updated.queuedTasks[index] = mergedTask;
      }
    }
    
    return updated;
  }

  /**
   * Merge task properties with intelligent conflict resolution
   */
  private mergeTaskProperties(serverTask: Task, clientTask: Task): Task {
    return {
      ...serverTask,
      // Use the higher progress value
      progress: Math.max(serverTask.progress, clientTask.progress),
      // Use client priority if different (user preference)
      priority: clientTask.priority !== serverTask.priority ? clientTask.priority : serverTask.priority,
      // Merge rewards (combine unique rewards)
      rewards: this.mergeRewards(serverTask.rewards, clientTask.rewards),
      // Use latest start time
      startTime: Math.max(serverTask.startTime, clientTask.startTime),
      // Use completion status from more advanced state
      completed: serverTask.completed || clientTask.completed
    };
  }

  /**
   * Merge reward arrays, combining unique rewards
   */
  private mergeRewards(serverRewards: any[], clientRewards: any[]): any[] {
    const rewardMap = new Map();
    
    // Add server rewards
    serverRewards.forEach(reward => {
      const key = `${reward.type}-${reward.itemId || 'none'}`;
      rewardMap.set(key, reward);
    });
    
    // Add client rewards, combining quantities for same items
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
   * Send delta update to connected clients
   */
  async sendDeltaUpdate(playerId: string, update: DeltaUpdate): Promise<void> {
    if (!this.wsService.isConnected()) {
      // Buffer the update for later
      this.bufferDeltaUpdate(playerId, update);
      return;
    }

    const message: SyncMessage = {
      type: 'delta_update',
      playerId,
      data: update,
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };

    this.wsService.send(message);
  }

  /**
   * Buffer delta update for offline processing
   */
  private bufferDeltaUpdate(playerId: string, update: DeltaUpdate): void {
    if (!this.deltaBuffer.has(playerId)) {
      this.deltaBuffer.set(playerId, []);
    }
    
    const buffer = this.deltaBuffer.get(playerId)!;
    buffer.push(update);
    
    // Limit buffer size
    if (buffer.length > 100) {
      buffer.shift(); // Remove oldest update
    }
  }

  /**
   * Apply pending delta updates
   */
  private async applyPendingDeltas(playerId: string, queue: TaskQueue): Promise<TaskQueue> {
    const deltas = this.deltaBuffer.get(playerId) || [];
    if (deltas.length === 0) {
      return queue;
    }

    let updatedQueue = { ...queue };
    
    for (const delta of deltas) {
      updatedQueue = this.applyDeltaUpdate(updatedQueue, delta);
    }

    // Clear applied deltas
    this.deltaBuffer.delete(playerId);
    
    return updatedQueue;
  }

  /**
   * Apply a single delta update to queue
   */
  private applyDeltaUpdate(queue: TaskQueue, delta: DeltaUpdate): TaskQueue {
    const updated = { ...queue };
    
    switch (delta.type) {
      case 'task_added':
        if (delta.data && !updated.queuedTasks.find(task => task.id === delta.data.id)) {
          updated.queuedTasks.push(delta.data);
        }
        break;
        
      case 'task_removed':
        if (delta.taskId) {
          updated.queuedTasks = updated.queuedTasks.filter(task => task.id !== delta.taskId);
        }
        break;
        
      case 'task_updated':
        if (delta.taskId && delta.data) {
          const index = updated.queuedTasks.findIndex(task => task.id === delta.taskId);
          if (index >= 0) {
            updated.queuedTasks[index] = { ...updated.queuedTasks[index], ...delta.data };
          }
        }
        break;
        
      case 'task_progress':
        if (delta.taskId && delta.data) {
          const task = updated.queuedTasks.find(task => task.id === delta.taskId);
          if (task) {
            task.progress = delta.data.progress;
          }
          if (updated.currentTask?.id === delta.taskId) {
            updated.currentTask.progress = delta.data.progress;
          }
        }
        break;
        
      case 'queue_state_changed':
        if (delta.data) {
          Object.assign(updated, delta.data);
        }
        break;
    }
    
    updated.lastUpdated = delta.timestamp;
    updated.version = delta.version;
    
    return updated;
  }

  // WebSocket message handlers
  private async handleSyncRequest(message: any): Promise<void> {
    // Handle sync request from server
    console.log('Received sync request:', message);
  }

  private async handleSyncResponse(message: any): Promise<void> {
    // Handle sync response from server
    console.log('Received sync response:', message);
  }

  private async handleDeltaUpdate(message: any): Promise<void> {
    // Handle delta update from server
    const update = message.data as DeltaUpdate;
    console.log('Received delta update:', update);
    
    // Apply update to local state
    // This would integrate with the task queue manager
  }

  private async handleConflictResolution(message: any): Promise<void> {
    // Handle conflict resolution from server
    console.log('Received conflict resolution:', message);
  }

  private async handleHeartbeat(message: any): Promise<void> {
    // Respond to server heartbeat
    const response: SyncMessage = {
      type: 'heartbeat_response',
      playerId: message.playerId,
      data: {
        timestamp: Date.now(),
        received: message.timestamp
      },
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };

    this.wsService.send(response);
  }

  private async handleHeartbeatResponse(message: any): Promise<void> {
    // Update connection state
    const playerId = message.playerId;
    this.connectionStates.set(playerId, {
      playerId,
      lastActivity: Date.now(),
      queueVersion: message.data.queueVersion || 0,
      connectionId: message.data.connectionId || ''
    });
  }

  // Helper methods
  private async getServerQueueState(playerId: string): Promise<TaskQueue | null> {
    // This would make an API call to get server state
    // For now, return null to indicate no server state
    return null;
  }

  private async uploadLocalState(playerId: string, localQueue: TaskQueue): Promise<TaskSyncResult> {
    // Upload local state to server
    return {
      success: true,
      conflicts: [],
      resolvedQueue: localQueue,
      syncTimestamp: Date.now()
    };
  }

  private async updateServerState(playerId: string, queue: TaskQueue): Promise<void> {
    // Update server with resolved state
    console.log(`Updating server state for player ${playerId}`);
  }

  private calculateChecksum(queue: TaskQueue): string {
    // Calculate checksum for queue integrity
    const data = JSON.stringify({
      version: queue.version,
      currentTaskId: queue.currentTask?.id,
      queuedTaskIds: queue.queuedTasks.map(task => task.id),
      isRunning: queue.isRunning,
      isPaused: queue.isPaused
    });
    
    // Simple hash function (in production, use a proper hash)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  }

  private getCurrentPlayerId(): string | null {
    // Get current player ID from game state
    // This would integrate with your authentication system
    return localStorage.getItem('playerId');
  }

  private getQueueVersion(playerId: string): number {
    // Get current queue version
    // This would integrate with your queue state management
    return 1;
  }

  private getConnectionId(): string {
    // Get WebSocket connection ID
    return 'connection-' + Date.now();
  }

  private generateMessageId(): string {
    return 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  private notifyConnectionLost(playerId: string): void {
    // Notify other services about connection loss
    console.log(`Connection lost for player ${playerId}`);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.pendingSyncs.clear();
    this.deltaBuffer.clear();
    this.connectionStates.clear();
  }
}

export default TaskQueueSyncService;