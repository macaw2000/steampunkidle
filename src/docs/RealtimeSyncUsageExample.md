# Real-Time Task Queue Synchronization Usage Example

This document demonstrates how to use the enhanced real-time synchronization system for task queues.

## Overview

The real-time synchronization system provides:
- **Efficient Delta Updates**: Only sync what has changed
- **Conflict Resolution**: Handle concurrent modifications intelligently
- **Heartbeat Monitoring**: Detect and handle disconnected clients
- **Offline Resilience**: Queue updates when offline and sync when reconnected

## Basic Setup

```typescript
import { TaskQueueRealtimeIntegration } from '../services/taskQueueRealtimeIntegration';
import { TaskQueueSyncService } from '../services/taskQueueSyncService';

// Initialize real-time sync for a player
const realtimeSync = TaskQueueRealtimeIntegration.getInstance();
await realtimeSync.initialize('player-123');
```

## Sending Task Queue Actions

```typescript
// Add a task to the queue with real-time sync
await realtimeSync.sendTaskQueueAction('add_task', {
  type: 'harvesting',
  activityId: 'harvest-wood',
  duration: 30000
});

// Remove a task from the queue
await realtimeSync.sendTaskQueueAction('remove_task', {
  taskId: 'task-456'
});

// Pause the queue
await realtimeSync.sendTaskQueueAction('pause_queue', {
  reason: 'User requested pause'
});
```

## Handling Real-Time Updates

```typescript
// Listen for task progress updates
window.addEventListener('taskProgressUpdate', (event) => {
  const { taskId, progress, timeRemaining } = event.detail;
  console.log(`Task ${taskId}: ${Math.round(progress * 100)}% complete`);
  
  // Update progress bar
  updateProgressBar(taskId, progress);
  
  // Update time remaining display
  updateTimeRemaining(taskId, timeRemaining);
});

// Listen for task completion
window.addEventListener('taskCompleted', (event) => {
  const { taskId, rewards } = event.detail;
  console.log(`Task ${taskId} completed with rewards:`, rewards);
  
  // Show completion animation
  showCompletionAnimation(taskId);
  
  // Update inventory with rewards
  updateInventory(rewards);
  
  // Show notification
  showNotification(`Task completed! Received ${rewards.length} rewards.`);
});

// Listen for queue state changes
window.addEventListener('queueStateChange', (event) => {
  const { queueState } = event.detail;
  console.log('Queue state updated:', queueState);
  
  // Update queue display
  updateQueueDisplay(queueState);
  
  // Update queue statistics
  updateQueueStats(queueState);
});
```

## Manual Synchronization

```typescript
// Force sync with server (useful after reconnection)
const localQueue = getCurrentQueueState();
await realtimeSync.syncQueueState(localQueue);

// Check sync status
const stats = realtimeSync.getStats();
console.log('Sync stats:', stats);
```

## WebSocket Connection Management

```typescript
import WebSocketService from '../services/websocketService';

const wsService = WebSocketService.getInstance();

// Monitor connection status
wsService.onConnectionStatusChange((connected) => {
  if (connected) {
    console.log('Real-time sync enabled');
    showConnectionStatus('online');
  } else {
    console.log('Offline mode - changes will sync when reconnected');
    showConnectionStatus('offline');
  }
});

// Get connection statistics
const connectionStats = wsService.getConnectionStats();
console.log('Connection stats:', connectionStats);
```

## Delta Synchronization

The system automatically handles delta updates for efficiency:

```typescript
// These operations generate delta updates automatically:

// Adding a task
await taskQueueManager.addTask(playerId, newTask);
// → Generates: { type: 'task_added', data: newTask }

// Updating task progress
await taskProcessor.updateProgress(taskId, 0.75);
// → Generates: { type: 'task_progress', taskId, data: { progress: 0.75 } }

// Completing a task
await taskProcessor.completeTask(taskId, rewards);
// → Generates: { type: 'task_completed', taskId, data: { rewards } }

// Pausing queue
await taskQueueManager.pauseQueue(playerId, 'Insufficient resources');
// → Generates: { type: 'queue_state_changed', data: { isPaused: true, pauseReason: '...' } }
```

## Conflict Resolution

When conflicts occur (e.g., multiple clients modifying the same queue), the system resolves them automatically:

```typescript
// Example conflict scenarios and resolutions:

// Scenario 1: Progress conflict (different progress values)
// Resolution: Use the higher progress value (more advanced state)

// Scenario 2: Task addition conflict (same task added from multiple clients)
// Resolution: Use client state (user action takes precedence)

// Scenario 3: Queue state conflict (different running states)
// Resolution: Use server state (authoritative)

// Monitor conflict resolution
const syncService = TaskQueueSyncService.getInstance();
// Conflicts are logged and resolved automatically
```

## Heartbeat and Health Monitoring

```typescript
// The system automatically monitors connection health:

// Heartbeat is sent every 30 seconds
// Connection is considered unhealthy after 90 seconds without response
// Automatic reconnection is attempted if connection fails

// Monitor connection health
setInterval(() => {
  const stats = wsService.getConnectionStats();
  
  if (stats.isConnected) {
    const timeSinceHeartbeat = Date.now() - stats.lastHeartbeat;
    if (timeSinceHeartbeat > 60000) { // 1 minute
      console.warn('Connection may be unhealthy');
      showConnectionWarning();
    }
  }
}, 10000); // Check every 10 seconds
```

## Error Handling

```typescript
// The system handles various error scenarios gracefully:

try {
  await realtimeSync.sendTaskQueueAction('add_task', taskData);
} catch (error) {
  if (error.message.includes('offline')) {
    // Handle offline scenario
    console.log('Action queued for when connection is restored');
    showOfflineNotification();
  } else if (error.message.includes('conflict')) {
    // Handle conflict scenario
    console.log('Conflict detected, resolving automatically');
    await realtimeSync.syncQueueState(localQueue);
  } else {
    // Handle other errors
    console.error('Task queue action failed:', error);
    showErrorNotification('Failed to update task queue');
  }
}
```

## Performance Considerations

```typescript
// The system is optimized for performance:

// 1. Delta updates minimize bandwidth usage
// 2. Message queuing prevents loss during disconnections
// 3. Efficient conflict resolution reduces sync overhead
// 4. Heartbeat mechanism detects issues quickly

// Monitor performance
const performanceStats = {
  messagesSent: wsService.getConnectionStats().queuedMessages,
  pendingAcks: wsService.getConnectionStats().pendingAcks,
  reconnectAttempts: wsService.getConnectionStats().reconnectAttempts
};

console.log('Performance stats:', performanceStats);
```

## Integration with Existing Components

```typescript
// TaskQueueDisplay component integration
import React, { useEffect, useState } from 'react';
import { TaskQueueRealtimeIntegration } from '../services/taskQueueRealtimeIntegration';

const TaskQueueDisplay: React.FC = () => {
  const [queueState, setQueueState] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    const realtimeSync = TaskQueueRealtimeIntegration.getInstance();
    
    // Initialize real-time sync
    realtimeSync.initialize(playerId).then(() => {
      setConnectionStatus('connected');
    }).catch(() => {
      setConnectionStatus('offline');
    });

    // Listen for queue updates
    const handleQueueUpdate = (event) => {
      setQueueState(event.detail.queueState);
    };

    window.addEventListener('queueStateChange', handleQueueUpdate);

    return () => {
      window.removeEventListener('queueStateChange', handleQueueUpdate);
    };
  }, []);

  return (
    <div className="task-queue-display">
      <div className="connection-status">
        Status: {connectionStatus}
      </div>
      {queueState && (
        <div className="queue-content">
          {/* Render queue state */}
        </div>
      )}
    </div>
  );
};
```

## Testing

```typescript
// Test real-time synchronization
describe('Real-time Task Queue Sync', () => {
  it('should sync task progress in real-time', async () => {
    const realtimeSync = TaskQueueRealtimeIntegration.getInstance();
    await realtimeSync.initialize('test-player');

    // Simulate server progress update
    const progressEvent = new CustomEvent('taskProgressUpdate', {
      detail: { taskId: 'test-task', progress: 0.5, timeRemaining: 15000 }
    });

    window.dispatchEvent(progressEvent);

    // Verify local state was updated
    expect(getLocalTaskProgress('test-task')).toBe(0.5);
  });

  it('should handle conflicts gracefully', async () => {
    // Test conflict resolution scenarios
    const localQueue = createMockQueue();
    const result = await realtimeSync.syncQueueState(localQueue);

    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });
});
```

This real-time synchronization system provides a robust foundation for keeping task queues synchronized across multiple clients while handling network issues, conflicts, and performance optimization automatically.