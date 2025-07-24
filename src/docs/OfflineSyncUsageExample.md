# Offline/Online Synchronization Usage Guide

This document provides comprehensive examples of how to use the offline/online synchronization system for the task queue.

## Overview

The offline synchronization system consists of three main components:

1. **OfflineTaskQueueManager** - Handles local queue management and tracks pending operations
2. **OfflineSyncIntegration** - Manages incremental synchronization with conflict resolution
3. **SyncStatusIndicator** - Provides UI feedback for sync status

## Basic Usage

### Setting up Offline Queue Management

```typescript
import { OfflineTaskQueueManager } from '../services/offlineTaskQueueManager';

// Get the singleton instance
const offlineManager = OfflineTaskQueueManager.getInstance();

// Add a task to the offline queue
await offlineManager.addTask('player-1', {
  id: 'task-1',
  type: TaskType.HARVESTING,
  name: 'Wood Cutting',
  duration: 60000,
  // ... other task properties
});

// Remove a task
await offlineManager.removeTask('player-1', 'task-1');

// Reorder tasks
await offlineManager.reorderTasks('player-1', ['task-2', 'task-1', 'task-3']);

// Pause/resume queue
await offlineManager.pauseQueue('player-1', 'Taking a break');
await offlineManager.resumeQueue('player-1');
```

### Checking Sync Status

```typescript
// Get current sync status
const syncIndicator = offlineManager.getSyncIndicator('player-1');

console.log('Status:', syncIndicator.status); // 'online', 'offline', 'syncing', 'error', 'conflict'
console.log('Message:', syncIndicator.message);
console.log('Pending operations:', syncIndicator.pendingCount);
console.log('Can manual sync:', syncIndicator.canManualSync);
```

### Manual Synchronization

```typescript
try {
  const result = await offlineManager.triggerManualSync('player-1');
  
  if (result.success) {
    console.log('Sync successful');
    if (result.conflicts.length > 0) {
      console.log('Conflicts resolved:', result.conflicts);
    }
  }
} catch (error) {
  console.error('Sync failed:', error);
}
```

## Advanced Usage

### Using Incremental Sync Integration

```typescript
import { OfflineSyncIntegration } from '../services/offlineSyncIntegration';

const syncIntegration = OfflineSyncIntegration.getInstance();

// Perform incremental sync with custom configuration
const result = await syncIntegration.performIncrementalSync('player-1', {
  enableIncrementalSync: true,
  syncBatchSize: 25,
  maxRetryAttempts: 5,
  conflictResolutionStrategy: 'merge',
  syncTimeoutMs: 15000
});

// Check sync metrics
const metrics = syncIntegration.getSyncMetrics('player-1');
console.log('Total syncs:', metrics.totalSyncs);
console.log('Success rate:', metrics.successfulSyncs / metrics.totalSyncs);
console.log('Average sync time:', metrics.averageSyncTime);
```

### Handling Network Status Changes

The system automatically handles network status changes, but you can also manually trigger responses:

```typescript
// Listen for network status changes
window.addEventListener('online', () => {
  console.log('Back online - sync will be triggered automatically');
});

window.addEventListener('offline', () => {
  console.log('Gone offline - operations will be queued locally');
});
```

## React Component Integration

### Using the Sync Status Indicator

```tsx
import React from 'react';
import { SyncStatusIndicator } from '../components/taskQueue/SyncStatusIndicator';

const MyComponent: React.FC = () => {
  const handleSyncComplete = () => {
    console.log('Sync completed, refreshing data...');
    // Refresh your component data here
  };

  return (
    <div>
      <h2>My Game Dashboard</h2>
      
      {/* Basic sync indicator */}
      <SyncStatusIndicator 
        playerId="player-1"
        onSyncComplete={handleSyncComplete}
      />
      
      {/* Detailed sync indicator */}
      <SyncStatusIndicator 
        playerId="player-1"
        showDetails={true}
        className="detailed-sync-status"
        onSyncComplete={handleSyncComplete}
      />
    </div>
  );
};
```

### Custom Sync Status Display

```tsx
import React, { useState, useEffect } from 'react';
import { OfflineTaskQueueManager, SyncIndicator } from '../services/offlineTaskQueueManager';

const CustomSyncStatus: React.FC<{ playerId: string }> = ({ playerId }) => {
  const [syncStatus, setSyncStatus] = useState<SyncIndicator | null>(null);

  useEffect(() => {
    const offlineManager = OfflineTaskQueueManager.getInstance();
    
    const updateStatus = () => {
      const status = offlineManager.getSyncIndicator(playerId);
      setSyncStatus(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, [playerId]);

  if (!syncStatus) return <div>Loading sync status...</div>;

  return (
    <div className={`sync-status sync-status-${syncStatus.status}`}>
      <div className="sync-message">{syncStatus.message}</div>
      
      {syncStatus.pendingCount && syncStatus.pendingCount > 0 && (
        <div className="pending-count">
          {syncStatus.pendingCount} changes pending
        </div>
      )}
      
      {syncStatus.progress !== undefined && (
        <div className="sync-progress">
          <div 
            className="progress-bar" 
            style={{ width: `${syncStatus.progress}%` }}
          />
        </div>
      )}
      
      {syncStatus.canManualSync && (
        <button 
          onClick={() => {
            const offlineManager = OfflineTaskQueueManager.getInstance();
            offlineManager.triggerManualSync(playerId);
          }}
        >
          Sync Now
        </button>
      )}
    </div>
  );
};
```

## Conflict Resolution Examples

### Server Wins Strategy

```typescript
// Server state takes precedence
const result = await syncIntegration.performIncrementalSync('player-1', {
  conflictResolutionStrategy: 'server_wins'
});

// All conflicts will be resolved in favor of server state
```

### Client Wins Strategy

```typescript
// Client state takes precedence
const result = await syncIntegration.performIncrementalSync('player-1', {
  conflictResolutionStrategy: 'client_wins'
});

// All conflicts will be resolved in favor of client state
```

### Merge Strategy

```typescript
// Intelligent merging of conflicting states
const result = await syncIntegration.performIncrementalSync('player-1', {
  conflictResolutionStrategy: 'merge'
});

// Conflicts will be merged using intelligent rules:
// - Higher progress values are kept
// - Client priority preferences are preserved
// - Rewards are combined
// - Latest timestamps are used
```

### Manual Resolution

```typescript
// Queue conflicts for manual resolution
const result = await syncIntegration.performIncrementalSync('player-1', {
  conflictResolutionStrategy: 'manual'
});

// Conflicts will be queued for manual resolution in the UI
// (Implementation depends on your UI requirements)
```

## Error Handling

### Handling Sync Errors

```typescript
try {
  await offlineManager.triggerManualSync('player-1');
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Sync timed out, will retry automatically');
  } else if (error.message.includes('network')) {
    console.log('Network error, check connection');
  } else {
    console.error('Unexpected sync error:', error);
  }
}
```

### Monitoring Sync Health

```typescript
const syncIntegration = OfflineSyncIntegration.getInstance();

// Check if sync is currently active
if (syncIntegration.isSyncActive('player-1')) {
  console.log('Sync in progress, please wait...');
}

// Get detailed metrics
const metrics = syncIntegration.getSyncMetrics('player-1');

if (metrics.failedSyncs > metrics.successfulSyncs) {
  console.warn('High sync failure rate detected');
}

if (metrics.averageSyncTime > 10000) {
  console.warn('Sync performance is degraded');
}
```

## Performance Optimization

### Batch Operations

```typescript
// Instead of multiple individual operations
await offlineManager.addTask('player-1', task1);
await offlineManager.addTask('player-1', task2);
await offlineManager.addTask('player-1', task3);

// Consider batching operations when possible
const tasks = [task1, task2, task3];
for (const task of tasks) {
  await offlineManager.addTask('player-1', task);
}
// Single sync will handle all operations
```

### Sync Configuration Tuning

```typescript
// For high-frequency operations
const highFreqConfig = {
  syncBatchSize: 100,
  syncTimeoutMs: 5000,
  maxRetryAttempts: 2
};

// For low-latency requirements
const lowLatencyConfig = {
  syncBatchSize: 10,
  syncTimeoutMs: 2000,
  maxRetryAttempts: 1
};

// For unreliable connections
const reliableConfig = {
  syncBatchSize: 25,
  syncTimeoutMs: 30000,
  maxRetryAttempts: 5
};
```

## Testing

### Simulating Offline Scenarios

```typescript
// Simulate going offline
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: false
});

// Trigger offline event
window.dispatchEvent(new Event('offline'));

// Perform operations while offline
await offlineManager.addTask('player-1', task);

// Check that operations are queued
const indicator = offlineManager.getSyncIndicator('player-1');
expect(indicator.status).toBe('offline');
expect(indicator.pendingCount).toBeGreaterThan(0);

// Simulate coming back online
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

window.dispatchEvent(new Event('online'));

// Sync should be triggered automatically
```

### Testing Conflict Resolution

```typescript
// Create conflicting states
const localTask = { ...baseTask, progress: 0.3, priority: 2 };
const serverTask = { ...baseTask, progress: 0.7, priority: 1 };

// Mock server response with conflict
const mockServerResponse = {
  success: true,
  conflicts: [{
    type: 'task_modified',
    taskId: baseTask.id,
    serverValue: serverTask,
    clientValue: localTask,
    resolution: 'merge'
  }],
  serverQueue: { queuedTasks: [serverTask] },
  appliedOperations: []
};

// Test conflict resolution
const result = await syncIntegration.performIncrementalSync('player-1');

// Verify merge result
expect(result.resolvedQueue.queuedTasks[0].progress).toBe(0.7); // Server value
expect(result.resolvedQueue.queuedTasks[0].priority).toBe(2); // Client value
```

## Best Practices

1. **Always check sync status** before performing critical operations
2. **Handle offline scenarios gracefully** - queue operations locally
3. **Provide user feedback** about sync status and pending operations
4. **Use appropriate conflict resolution strategies** based on data importance
5. **Monitor sync performance** and adjust configuration as needed
6. **Test offline scenarios thoroughly** in your application
7. **Implement proper error handling** for all sync operations
8. **Consider data minimization** for large payloads
9. **Use incremental sync** for better performance
10. **Provide manual sync options** for user control

## Troubleshooting

### Common Issues

1. **Sync never completes**: Check network connectivity and server availability
2. **High conflict rate**: Review conflict resolution strategy and operation timing
3. **Poor sync performance**: Adjust batch size and timeout settings
4. **Data loss**: Ensure proper error handling and retry mechanisms
5. **UI not updating**: Verify event listeners and state management

### Debug Information

```typescript
// Enable debug logging
localStorage.setItem('debug-sync', 'true');

// Check pending operations
const state = offlineManager.getOfflineState('player-1');
console.log('Pending operations:', state.pendingOperations);

// Check sync metrics
const metrics = syncIntegration.getSyncMetrics('player-1');
console.log('Sync metrics:', metrics);

// Check queue state
const queue = offlineManager.getQueueState('player-1');
console.log('Queue state:', queue);
```