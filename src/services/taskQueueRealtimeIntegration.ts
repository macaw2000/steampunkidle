/**
 * Integration layer for Task Queue Real-Time Synchronization
 * Connects the task queue system with WebSocket synchronization
 */

import { TaskQueueSyncService } from './taskQueueSyncService';
import WebSocketService from './websocketService';
import { TaskQueue, Task, TaskProgress, TaskCompletionResult } from '../types/taskQueue';

export class TaskQueueRealtimeIntegration {
  private static instance: TaskQueueRealtimeIntegration;
  private syncService: TaskQueueSyncService;
  private wsService: WebSocketService;
  private isInitialized = false;

  private constructor() {
    this.syncService = TaskQueueSyncService.getInstance();
    this.wsService = WebSocketService.getInstance();
  }

  static getInstance(): TaskQueueRealtimeIntegration {
    if (!TaskQueueRealtimeIntegration.instance) {
      TaskQueueRealtimeIntegration.instance = new TaskQueueRealtimeIntegration();
    }
    return TaskQueueRealtimeIntegration.instance;
  }

  /**
   * Initialize real-time synchronization for task queues
   */
  async initialize(playerId: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Connect to WebSocket
      await this.wsService.connect(playerId);

      // Set up event handlers for task queue events
      this.setupTaskQueueEventHandlers();

      // Set up WebSocket message handlers
      this.setupWebSocketHandlers();

      this.isInitialized = true;
      console.log('Task queue real-time synchronization initialized');

    } catch (error) {
      console.error('Failed to initialize task queue real-time sync:', error);
      throw error;
    }
  }

  /**
   * Set up handlers for task queue events
   */
  private setupTaskQueueEventHandlers(): void {
    // Handle task progress updates
    this.wsService.subscribe('task_progress', (message) => {
      this.handleTaskProgressUpdate(message.data);
    });

    // Handle task completion
    this.wsService.subscribe('task_completed', (message) => {
      this.handleTaskCompletion(message.data);
    });

    // Handle task started
    this.wsService.subscribe('task_started', (message) => {
      this.handleTaskStarted(message.data);
    });

    // Handle queue updates
    this.wsService.subscribe('queue_updated', (message) => {
      this.handleQueueUpdate(message.data);
    });

    // Handle delta updates
    this.wsService.subscribe('delta_update', (message) => {
      this.handleDeltaUpdate(message.data);
    });
  }

  /**
   * Set up WebSocket-specific handlers
   */
  private setupWebSocketHandlers(): void {
    // Handle connection status changes
    this.wsService.onConnectionStatusChange((connected) => {
      if (connected) {
        console.log('WebSocket connected - enabling real-time sync');
        this.onConnectionRestored();
      } else {
        console.log('WebSocket disconnected - falling back to polling');
        this.onConnectionLost();
      }
    });
  }

  /**
   * Handle task progress updates from server
   */
  private handleTaskProgressUpdate(data: any): void {
    const { playerId, taskId, progress, timeRemaining } = data;
    
    console.log(`Task progress update: ${taskId} - ${Math.round(progress * 100)}%`);
    
    // Update local task state
    this.updateLocalTaskProgress(taskId, progress, timeRemaining);
    
    // Notify UI components
    this.notifyProgressUpdate(taskId, progress, timeRemaining);
  }

  /**
   * Handle task completion from server
   */
  private handleTaskCompletion(data: any): void {
    const { playerId, taskId, rewards, nextTaskId } = data;
    
    console.log(`Task completed: ${taskId}`, rewards);
    
    // Update local state
    this.updateLocalTaskCompletion(taskId, rewards);
    
    // Show completion notification
    this.showTaskCompletionNotification(taskId, rewards);
    
    // Start next task if available
    if (nextTaskId) {
      this.handleNextTaskStart(nextTaskId);
    }
  }

  /**
   * Handle task started from server
   */
  private handleTaskStarted(data: any): void {
    const { playerId, taskId, taskName, estimatedDuration } = data;
    
    console.log(`Task started: ${taskName} (${taskId})`);
    
    // Update local state
    this.updateLocalTaskStart(taskId, estimatedDuration);
    
    // Show start notification
    this.showTaskStartNotification(taskName, estimatedDuration);
  }

  /**
   * Handle queue updates from server
   */
  private handleQueueUpdate(data: any): void {
    const { playerId, queueState } = data;
    
    console.log('Queue state updated:', queueState);
    
    // Update local queue state
    this.updateLocalQueueState(queueState);
    
    // Notify UI components
    this.notifyQueueStateChange(queueState);
  }

  /**
   * Handle delta updates for efficient synchronization
   */
  private handleDeltaUpdate(data: any): void {
    const { type, playerId, taskId, data: updateData, timestamp, version } = data;
    
    console.log(`Delta update: ${type}`, updateData);
    
    switch (type) {
      case 'task_added':
        this.handleTaskAdded(updateData);
        break;
      case 'task_removed':
        this.handleTaskRemoved(taskId);
        break;
      case 'task_updated':
        this.handleTaskUpdated(taskId, updateData);
        break;
      case 'queue_state_changed':
        this.handleQueueStateChanged(updateData);
        break;
      case 'task_progress':
        this.handleTaskProgressUpdate(updateData);
        break;
    }
  }

  /**
   * Send task queue action to server with real-time sync
   */
  async sendTaskQueueAction(action: string, data: any): Promise<void> {
    try {
      if (this.wsService.isConnected()) {
        // Send via WebSocket for real-time response
        await this.wsService.sendWithAck({
          type: 'task_queue_action',
          action,
          data,
          timestamp: new Date()
        });
      } else {
        // Fallback to HTTP API
        await this.sendTaskQueueActionHTTP(action, data);
      }
    } catch (error) {
      console.error('Failed to send task queue action:', error);
      // Fallback to HTTP if WebSocket fails
      await this.sendTaskQueueActionHTTP(action, data);
    }
  }

  /**
   * Sync local queue state with server
   */
  async syncQueueState(localQueue: TaskQueue): Promise<void> {
    try {
      const result = await this.syncService.syncQueueState(localQueue.playerId, localQueue);
      
      if (result.success) {
        console.log('Queue state synchronized successfully');
        
        if (result.conflicts.length > 0) {
          console.log(`Resolved ${result.conflicts.length} conflicts`);
          this.handleSyncConflicts(result.conflicts);
        }
        
        // Update local state with resolved queue
        this.updateLocalQueueState(result.resolvedQueue);
        
      } else {
        console.warn('Queue synchronization failed, using local state');
      }
    } catch (error) {
      console.error('Queue synchronization error:', error);
    }
  }

  /**
   * Handle connection restored
   */
  private onConnectionRestored(): void {
    // Trigger full synchronization when connection is restored
    const playerId = this.getCurrentPlayerId();
    if (playerId) {
      // Get current local queue state and sync
      const localQueue = this.getLocalQueueState(playerId);
      if (localQueue) {
        this.syncQueueState(localQueue);
      }
    }
  }

  /**
   * Handle connection lost
   */
  private onConnectionLost(): void {
    // Switch to offline mode
    console.log('Switching to offline task queue mode');
    
    // Enable local task processing
    this.enableOfflineTaskProcessing();
  }

  // Helper methods for local state management
  private updateLocalTaskProgress(taskId: string, progress: number, timeRemaining: number): void {
    // Update local task progress
    // This would integrate with your local state management system
    console.log(`Updating local progress for ${taskId}: ${progress}`);
  }

  private updateLocalTaskCompletion(taskId: string, rewards: any[]): void {
    // Update local task completion
    console.log(`Marking task ${taskId} as completed with rewards:`, rewards);
  }

  private updateLocalTaskStart(taskId: string, estimatedDuration: number): void {
    // Update local task start
    console.log(`Starting task ${taskId} with duration ${estimatedDuration}ms`);
  }

  private updateLocalQueueState(queueState: any): void {
    // Update local queue state
    console.log('Updating local queue state:', queueState);
  }

  private handleTaskAdded(taskData: any): void {
    console.log('Task added to queue:', taskData);
  }

  private handleTaskRemoved(taskId: string): void {
    console.log('Task removed from queue:', taskId);
  }

  private handleTaskUpdated(taskId: string, updateData: any): void {
    console.log('Task updated:', taskId, updateData);
  }

  private handleQueueStateChanged(stateData: any): void {
    console.log('Queue state changed:', stateData);
  }

  private handleNextTaskStart(nextTaskId: string): void {
    console.log('Starting next task:', nextTaskId);
  }

  private handleSyncConflicts(conflicts: any[]): void {
    console.log('Handling sync conflicts:', conflicts);
    // Show conflict resolution UI or apply automatic resolution
  }

  // Notification methods
  private notifyProgressUpdate(taskId: string, progress: number, timeRemaining: number): void {
    // Notify UI components about progress update
    window.dispatchEvent(new CustomEvent('taskProgressUpdate', {
      detail: { taskId, progress, timeRemaining }
    }));
  }

  private notifyQueueStateChange(queueState: any): void {
    // Notify UI components about queue state change
    window.dispatchEvent(new CustomEvent('queueStateChange', {
      detail: { queueState }
    }));
  }

  private showTaskCompletionNotification(taskId: string, rewards: any[]): void {
    // Show task completion notification
    window.dispatchEvent(new CustomEvent('taskCompleted', {
      detail: { taskId, rewards }
    }));
  }

  private showTaskStartNotification(taskName: string, estimatedDuration: number): void {
    // Show task start notification
    window.dispatchEvent(new CustomEvent('taskStarted', {
      detail: { taskName, estimatedDuration }
    }));
  }

  // Fallback methods
  private async sendTaskQueueActionHTTP(action: string, data: any): Promise<void> {
    // Send action via HTTP API
    console.log('Sending task queue action via HTTP:', action, data);
  }

  private enableOfflineTaskProcessing(): void {
    // Enable offline task processing
    console.log('Offline task processing enabled');
  }

  private getCurrentPlayerId(): string | null {
    // Get current player ID
    return localStorage.getItem('playerId');
  }

  private getLocalQueueState(playerId: string): TaskQueue | null {
    // Get local queue state
    // This would integrate with your local state management
    return null;
  }

  /**
   * Get connection and sync statistics
   */
  getStats(): {
    wsConnected: boolean;
    wsStats: any;
    syncEnabled: boolean;
    lastSync: number;
  } {
    return {
      wsConnected: this.wsService.isConnected(),
      wsStats: this.wsService.getConnectionStats(),
      syncEnabled: this.isInitialized,
      lastSync: Date.now() // This would be actual last sync time
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.syncService.destroy();
    this.wsService.destroy();
    this.isInitialized = false;
  }
}

export default TaskQueueRealtimeIntegration;