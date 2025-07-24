# Integration Patterns

## Overview

This guide covers common integration patterns for the Task Queue System, providing practical examples and best practices for different use cases.

## Client-Side Integration

### React Component Integration

#### Basic Queue Display

```typescript
import React, { useEffect, useState } from 'react';
import { TaskQueueService } from '../services/taskQueueService';

interface QueueDisplayProps {
  playerId: string;
}

export const QueueDisplay: React.FC<QueueDisplayProps> = ({ playerId }) => {
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const service = new TaskQueueService();
    
    // Initial load
    service.getQueueStatus(playerId)
      .then(setQueueStatus)
      .finally(() => setLoading(false));

    // Real-time updates
    const unsubscribe = service.onProgress(playerId, (progress) => {
      setQueueStatus(prev => ({
        ...prev,
        currentTask: { ...prev.currentTask, progress }
      }));
    });

    return unsubscribe;
  }, [playerId]);

  if (loading) return <div>Loading queue...</div>;

  return (
    <div className="queue-display">
      {queueStatus.currentTask && (
        <div className="current-task">
          <h3>{queueStatus.currentTask.name}</h3>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${queueStatus.currentTask.progress * 100}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="queued-tasks">
        {queueStatus.queuedTasks.map(task => (
          <div key={task.id} className="queued-task">
            <span>{task.name}</span>
            <span>{formatDuration(task.estimatedDuration)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### Task Management Interface

```typescript
export const TaskManager: React.FC<{ playerId: string }> = ({ playerId }) => {
  const service = new TaskQueueService();

  const addHarvestingTask = async (activity: string) => {
    try {
      await service.addHarvestingTask(playerId, {
        activity,
        location: 'enchanted_forest',
        quantity: 50
      });
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  const stopAllTasks = async () => {
    if (confirm('Stop all tasks? This will clear your queue.')) {
      await service.stopAllTasks(playerId);
    }
  };

  return (
    <div className="task-manager">
      <div className="task-buttons">
        <button onClick={() => addHarvestingTask('chop_oak_trees')}>
          Chop Oak Trees
        </button>
        <button onClick={() => addHarvestingTask('mine_iron_ore')}>
          Mine Iron Ore
        </button>
        <button onClick={stopAllTasks} className="danger">
          Stop All Tasks
        </button>
      </div>
    </div>
  );
};
```

### Service Layer Pattern

```typescript
// services/taskQueueService.ts
export class TaskQueueService {
  private apiClient: ApiClient;
  private websocket: WebSocketService;

  constructor() {
    this.apiClient = new ApiClient();
    this.websocket = new WebSocketService();
  }

  async addTask(playerId: string, taskData: TaskData): Promise<Task> {
    const response = await this.apiClient.post(`/queue/${playerId}/tasks`, taskData);
    return response.data;
  }

  onProgress(playerId: string, callback: ProgressCallback): () => void {
    return this.websocket.subscribe(`queue.${playerId}.progress`, callback);
  }

  async syncWithServer(playerId: string): Promise<void> {
    const serverState = await this.apiClient.get(`/queue/${playerId}`);
    // Merge with local state and resolve conflicts
    await this.mergeQueueState(serverState.data);
  }
}
```

## Server-Side Integration

### Lambda Function Integration

```typescript
// lambda/taskQueueHandler.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { TaskQueueEngine } from '../services/taskQueueEngine';

export const handler: APIGatewayProxyHandler = async (event) => {
  const engine = new TaskQueueEngine();
  const { playerId } = event.pathParameters;
  
  try {
    switch (event.httpMethod) {
      case 'GET':
        const status = await engine.getQueueStatus(playerId);
        return {
          statusCode: 200,
          body: JSON.stringify(status),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
        
      case 'POST':
        const taskData = JSON.parse(event.body);
        const task = await engine.addTask(playerId, taskData);
        return {
          statusCode: 201,
          body: JSON.stringify(task)
        };
        
      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Task queue error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

### Fargate Task Processor

```typescript
// fargate/taskProcessor.ts
export class TaskProcessor {
  private dynamodb: DynamoDBService;
  private redis: RedisService;

  async processPlayerQueues(): Promise<void> {
    const activeQueues = await this.getActiveQueues();
    
    await Promise.all(
      activeQueues.map(queue => this.processQueue(queue))
    );
  }

  private async processQueue(queue: TaskQueue): Promise<void> {
    if (!queue.currentTask) {
      queue.currentTask = queue.queuedTasks.shift();
      if (!queue.currentTask) return;
    }

    const progress = await this.calculateProgress(queue.currentTask);
    
    if (progress >= 1.0) {
      const rewards = await this.completeTask(queue.currentTask);
      await this.notifyCompletion(queue.playerId, rewards);
      queue.currentTask = null;
    } else {
      await this.updateProgress(queue.playerId, progress);
    }

    await this.saveQueueState(queue);
  }
}
```

## Database Integration Patterns

### DynamoDB Schema Design

```typescript
// Table: TaskQueues
interface TaskQueueRecord {
  PK: string; // "PLAYER#${playerId}"
  SK: string; // "QUEUE"
  playerId: string;
  currentTask: Task | null;
  queuedTasks: Task[];
  isRunning: boolean;
  lastUpdated: number;
  GSI1PK: string; // "ACTIVE_QUEUE" for processing
  GSI1SK: string; // lastUpdated timestamp
}

// Table: TaskHistory
interface TaskHistoryRecord {
  PK: string; // "PLAYER#${playerId}"
  SK: string; // "TASK#${timestamp}#${taskId}"
  taskId: string;
  taskType: string;
  completedAt: number;
  rewards: TaskReward[];
  duration: number;
}
```

### Repository Pattern

```typescript
export class TaskQueueRepository {
  private dynamodb: DynamoDB.DocumentClient;

  async getQueue(playerId: string): Promise<TaskQueue | null> {
    const result = await this.dynamodb.get({
      TableName: 'TaskQueues',
      Key: {
        PK: `PLAYER#${playerId}`,
        SK: 'QUEUE'
      }
    }).promise();

    return result.Item as TaskQueue || null;
  }

  async saveQueue(queue: TaskQueue): Promise<void> {
    await this.dynamodb.put({
      TableName: 'TaskQueues',
      Item: {
        ...queue,
        PK: `PLAYER#${queue.playerId}`,
        SK: 'QUEUE',
        GSI1PK: queue.isRunning ? 'ACTIVE_QUEUE' : 'INACTIVE_QUEUE',
        GSI1SK: queue.lastUpdated
      }
    }).promise();
  }

  async getActiveQueues(): Promise<TaskQueue[]> {
    const result = await this.dynamodb.query({
      TableName: 'TaskQueues',
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'ACTIVE_QUEUE'
      }
    }).promise();

    return result.Items as TaskQueue[];
  }
}
```

## Real-Time Communication Patterns

### WebSocket Integration

```typescript
// WebSocket connection management
export class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();

  async handleConnection(connectionId: string, playerId: string): Promise<void> {
    const connection = new WebSocket(connectionId);
    this.connections.set(playerId, connection);

    // Send initial queue state
    const queue = await this.getQueueStatus(playerId);
    await connection.send(JSON.stringify({
      type: 'QUEUE_STATE',
      data: queue
    }));
  }

  async broadcastProgress(playerId: string, progress: number): Promise<void> {
    const connection = this.connections.get(playerId);
    if (connection) {
      await connection.send(JSON.stringify({
        type: 'TASK_PROGRESS',
        data: { progress, timestamp: Date.now() }
      }));
    }
  }

  async notifyTaskCompletion(playerId: string, result: TaskCompletionResult): Promise<void> {
    const connection = this.connections.get(playerId);
    if (connection) {
      await connection.send(JSON.stringify({
        type: 'TASK_COMPLETED',
        data: result
      }));
    }
  }
}
```

### Event-Driven Architecture

```typescript
// Event system for loose coupling
export class TaskQueueEventBus {
  private handlers: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  async emit(event: string, data: any): Promise<void> {
    const handlers = this.handlers.get(event) || [];
    await Promise.all(handlers.map(handler => handler(data)));
  }
}

// Usage in task processor
const eventBus = new TaskQueueEventBus();

eventBus.on('task.completed', async (data) => {
  await updatePlayerStats(data.playerId, data.rewards);
  await logTaskCompletion(data.task);
  await notifyAchievements(data.playerId, data.rewards);
});

eventBus.on('queue.paused', async (data) => {
  await sendNotification(data.playerId, 'Queue paused: ' + data.reason);
});
```

## Offline/Online Synchronization

### Conflict Resolution Pattern

```typescript
export class QueueSyncManager {
  async syncQueues(localQueue: TaskQueue, serverQueue: TaskQueue): Promise<TaskQueue> {
    // Server state takes precedence for running tasks
    const mergedQueue: TaskQueue = {
      ...serverQueue,
      queuedTasks: this.mergeQueuedTasks(localQueue.queuedTasks, serverQueue.queuedTasks)
    };

    // Resolve conflicts based on timestamps
    if (localQueue.lastUpdated > serverQueue.lastUpdated) {
      // Local changes are newer, merge carefully
      mergedQueue.queuedTasks = this.resolveTaskConflicts(
        localQueue.queuedTasks,
        serverQueue.queuedTasks
      );
    }

    return mergedQueue;
  }

  private resolveTaskConflicts(localTasks: Task[], serverTasks: Task[]): Task[] {
    const serverTaskIds = new Set(serverTasks.map(t => t.id));
    const localOnlyTasks = localTasks.filter(t => !serverTaskIds.has(t.id));
    
    // Merge server tasks with local-only tasks
    return [...serverTasks, ...localOnlyTasks];
  }
}
```

## Testing Integration Patterns

### Mock Service Pattern

```typescript
export class MockTaskQueueService implements TaskQueueService {
  private mockQueue: TaskQueue = {
    playerId: 'test_player',
    currentTask: null,
    queuedTasks: [],
    isRunning: false
  };

  async addTask(playerId: string, taskData: TaskData): Promise<Task> {
    const task: Task = {
      id: `mock_task_${Date.now()}`,
      ...taskData,
      progress: 0,
      startTime: Date.now()
    };
    
    this.mockQueue.queuedTasks.push(task);
    return task;
  }

  async getQueueStatus(playerId: string): Promise<TaskQueue> {
    return { ...this.mockQueue };
  }

  onProgress(playerId: string, callback: ProgressCallback): () => void {
    // Simulate progress updates
    const interval = setInterval(() => {
      if (this.mockQueue.currentTask) {
        callback(Math.min(this.mockQueue.currentTask.progress + 0.1, 1.0));
      }
    }, 1000);

    return () => clearInterval(interval);
  }
}
```

### Integration Test Pattern

```typescript
describe('Task Queue Integration', () => {
  let service: TaskQueueService;
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
    service = new TaskQueueService(mockDb);
  });

  it('should process complete task lifecycle', async () => {
    const playerId = 'test_player';
    
    // Add task
    const task = await service.addTask(playerId, {
      type: 'harvesting',
      activity: 'chop_oak_trees'
    });

    // Verify task is queued
    const status = await service.getQueueStatus(playerId);
    expect(status.queuedTasks).toContain(task);

    // Simulate task processing
    await service.processQueue(playerId);

    // Verify completion
    const finalStatus = await service.getQueueStatus(playerId);
    expect(finalStatus.currentTask).toBeNull();
  });
});
```

## Performance Optimization Patterns

### Caching Strategy

```typescript
export class CachedTaskQueueService {
  private cache: RedisService;
  private repository: TaskQueueRepository;

  async getQueueStatus(playerId: string): Promise<TaskQueue> {
    const cacheKey = `queue:${playerId}`;
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const queue = await this.repository.getQueue(playerId);
    if (queue) {
      await this.cache.setex(cacheKey, 60, JSON.stringify(queue));
    }

    return queue;
  }

  async updateQueue(queue: TaskQueue): Promise<void> {
    // Update database
    await this.repository.saveQueue(queue);
    
    // Update cache
    const cacheKey = `queue:${queue.playerId}`;
    await this.cache.setex(cacheKey, 60, JSON.stringify(queue));
  }
}
```

### Batch Processing Pattern

```typescript
export class BatchTaskProcessor {
  async processBatch(queues: TaskQueue[]): Promise<void> {
    const batchSize = 10;
    
    for (let i = 0; i < queues.length; i += batchSize) {
      const batch = queues.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(queue => this.processQueue(queue))
      );
      
      // Small delay between batches to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

This integration patterns guide provides practical examples for common scenarios. Each pattern includes complete code examples and can be adapted to specific use cases.