# WebSocket Events Reference

## Overview

The Task Queue System uses WebSocket connections for real-time communication between the client and server. This document describes all available events, their payloads, and usage patterns.

## Connection Management

### Establishing Connection

```typescript
const ws = new WebSocket('wss://api.steampunk-idle.com/ws');

ws.onopen = () => {
  // Authenticate the connection
  ws.send(JSON.stringify({
    type: 'AUTH',
    token: 'your_jwt_token',
    playerId: 'player_123'
  }));
};
```

### Authentication Response

```json
{
  "type": "AUTH_SUCCESS",
  "data": {
    "connectionId": "conn_abc123",
    "playerId": "player_123",
    "timestamp": 1642789200000
  }
}
```

## Queue State Events

### Initial Queue State

Sent immediately after successful authentication.

```json
{
  "type": "QUEUE_STATE",
  "data": {
    "playerId": "player_123",
    "currentTask": {
      "id": "task_456",
      "type": "harvesting",
      "name": "Chop Oak Trees",
      "progress": 0.65,
      "startTime": 1642789000000,
      "estimatedCompletion": 1642789200000,
      "activityData": {
        "activity": "chop_oak_trees",
        "location": "enchanted_forest"
      }
    },
    "queuedTasks": [
      {
        "id": "task_789",
        "type": "crafting",
        "name": "Craft Iron Sword",
        "estimatedDuration": 300000,
        "activityData": {
          "recipeId": "iron_sword",
          "materials": [
            {
              "type": "iron_ingot",
              "amount": 3
            }
          ]
        }
      }
    ],
    "isRunning": true,
    "isPaused": false,
    "queueLength": 5,
    "totalQueueTime": 1800000,
    "lastUpdated": 1642789100000
  }
}
```

### Queue Updated

Sent when the queue structure changes (tasks added, removed, reordered).

```json
{
  "type": "QUEUE_UPDATED",
  "data": {
    "playerId": "player_123",
    "changes": {
      "type": "TASK_ADDED",
      "taskId": "task_new_123",
      "position": 3
    },
    "queuedTasks": [
      // Updated queue array
    ],
    "queueLength": 6,
    "totalQueueTime": 2100000,
    "timestamp": 1642789300000
  }
}
```

## Task Progress Events

### Task Progress Update

Sent periodically during task execution (typically every 1-5 seconds).

```json
{
  "type": "TASK_PROGRESS",
  "data": {
    "playerId": "player_123",
    "taskId": "task_456",
    "progress": 0.75,
    "timeRemaining": 60000,
    "estimatedCompletion": 1642789260000,
    "timestamp": 1642789200000
  }
}
```

### Task Started

Sent when a new task begins execution.

```json
{
  "type": "TASK_STARTED",
  "data": {
    "playerId": "player_123",
    "task": {
      "id": "task_456",
      "type": "harvesting",
      "name": "Chop Oak Trees",
      "startTime": 1642789200000,
      "estimatedDuration": 600000,
      "activityData": {
        "activity": "chop_oak_trees",
        "location": "enchanted_forest"
      }
    },
    "queuePosition": 0,
    "timestamp": 1642789200000
  }
}
```

### Task Completed

Sent when a task finishes successfully.

```json
{
  "type": "TASK_COMPLETED",
  "data": {
    "playerId": "player_123",
    "task": {
      "id": "task_456",
      "type": "harvesting",
      "name": "Chop Oak Trees",
      "completedAt": 1642789800000,
      "actualDuration": 598000
    },
    "rewards": [
      {
        "type": "item",
        "itemId": "oak_wood",
        "amount": 25,
        "rarity": "common"
      },
      {
        "type": "experience",
        "skill": "woodcutting",
        "amount": 150
      },
      {
        "type": "gold",
        "amount": 50
      }
    ],
    "nextTask": {
      "id": "task_789",
      "name": "Craft Iron Sword"
    },
    "timestamp": 1642789800000
  }
}
```

### Task Failed

Sent when a task fails due to validation or processing errors.

```json
{
  "type": "TASK_FAILED",
  "data": {
    "playerId": "player_123",
    "taskId": "task_456",
    "error": {
      "code": "INSUFFICIENT_RESOURCES",
      "message": "Not enough iron ingots to complete crafting",
      "details": {
        "required": 3,
        "available": 1
      }
    },
    "retryCount": 1,
    "maxRetries": 3,
    "nextRetryAt": 1642789500000,
    "timestamp": 1642789400000
  }
}
```

## Queue Management Events

### Queue Paused

Sent when the queue is paused due to validation failures or manual action.

```json
{
  "type": "QUEUE_PAUSED",
  "data": {
    "playerId": "player_123",
    "reason": "INSUFFICIENT_RESOURCES",
    "details": {
      "message": "Queue paused: Not enough materials for next task",
      "requiredResources": [
        {
          "type": "iron_ingot",
          "required": 3,
          "available": 1
        }
      ]
    },
    "canResume": true,
    "timestamp": 1642789400000
  }
}
```

### Queue Resumed

Sent when a paused queue resumes processing.

```json
{
  "type": "QUEUE_RESUMED",
  "data": {
    "playerId": "player_123",
    "reason": "RESOURCES_AVAILABLE",
    "resumedTaskId": "task_789",
    "timestamp": 1642789500000
  }
}
```

### Queue Stopped

Sent when all tasks are stopped and the queue is cleared.

```json
{
  "type": "QUEUE_STOPPED",
  "data": {
    "playerId": "player_123",
    "stoppedTaskId": "task_456",
    "clearedTaskCount": 4,
    "refundedResources": [
      {
        "type": "iron_ingot",
        "amount": 2
      }
    ],
    "timestamp": 1642789600000
  }
}
```

## Error Events

### Connection Error

Sent when there are connection-related issues.

```json
{
  "type": "CONNECTION_ERROR",
  "data": {
    "error": {
      "code": "AUTH_EXPIRED",
      "message": "Authentication token has expired",
      "reconnectRequired": true
    },
    "timestamp": 1642789700000
  }
}
```

### Processing Error

Sent when there are server-side processing errors.

```json
{
  "type": "PROCESSING_ERROR",
  "data": {
    "playerId": "player_123",
    "error": {
      "code": "SERVER_OVERLOAD",
      "message": "Server is temporarily overloaded",
      "retryAfter": 30000
    },
    "affectedOperations": ["task_processing", "queue_updates"],
    "timestamp": 1642789800000
  }
}
```

## Client-to-Server Events

### Subscribe to Updates

Request to receive specific types of updates.

```json
{
  "type": "SUBSCRIBE",
  "data": {
    "events": ["TASK_PROGRESS", "TASK_COMPLETED", "QUEUE_UPDATED"],
    "playerId": "player_123"
  }
}
```

### Unsubscribe from Updates

Stop receiving specific types of updates.

```json
{
  "type": "UNSUBSCRIBE",
  "data": {
    "events": ["TASK_PROGRESS"],
    "playerId": "player_123"
  }
}
```

### Heartbeat

Keep the connection alive and check server status.

```json
{
  "type": "PING",
  "data": {
    "timestamp": 1642789900000
  }
}
```

**Response:**
```json
{
  "type": "PONG",
  "data": {
    "timestamp": 1642789900000,
    "serverTime": 1642789901000,
    "latency": 50
  }
}
```

## Event Handling Patterns

### React Hook Pattern

```typescript
import { useEffect, useState } from 'react';

interface UseTaskQueueWebSocket {
  queueState: TaskQueue | null;
  isConnected: boolean;
  lastError: string | null;
}

export const useTaskQueueWebSocket = (playerId: string): UseTaskQueueWebSocket => {
  const [queueState, setQueueState] = useState<TaskQueue | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket('wss://api.steampunk-idle.com/ws');

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'AUTH',
        token: localStorage.getItem('authToken'),
        playerId
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'QUEUE_STATE':
        case 'QUEUE_UPDATED':
          setQueueState(message.data);
          break;
          
        case 'TASK_PROGRESS':
          setQueueState(prev => prev ? {
            ...prev,
            currentTask: prev.currentTask ? {
              ...prev.currentTask,
              progress: message.data.progress
            } : null
          } : null);
          break;
          
        case 'TASK_COMPLETED':
          // Handle task completion
          setQueueState(prev => prev ? {
            ...prev,
            currentTask: message.data.nextTask || null,
            queuedTasks: prev.queuedTasks.slice(1)
          } : null);
          break;
          
        case 'CONNECTION_ERROR':
        case 'PROCESSING_ERROR':
          setLastError(message.data.error.message);
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      setLastError('WebSocket connection error');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [playerId]);

  return { queueState, isConnected, lastError };
};
```

### Event Bus Pattern

```typescript
class TaskQueueEventBus {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Function[]> = new Map();

  connect(playerId: string, authToken: string): void {
    this.ws = new WebSocket('wss://api.steampunk-idle.com/ws');
    
    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({
        type: 'AUTH',
        token: authToken,
        playerId
      }));
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.emit(message.type, message.data);
    };
  }

  on(eventType: string, handler: Function): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  private emit(eventType: string, data: any): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.forEach(handler => handler(data));
  }
}

// Usage
const eventBus = new TaskQueueEventBus();
eventBus.connect('player_123', 'auth_token');

const unsubscribe = eventBus.on('TASK_COMPLETED', (data) => {
  console.log('Task completed:', data.task.name);
  showRewards(data.rewards);
});
```

## Connection Management

### Reconnection Strategy

```typescript
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(playerId: string, authToken: string): void {
    this.ws = new WebSocket('wss://api.steampunk-idle.com/ws');
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.authenticate(playerId, authToken);
    };

    this.ws.onclose = () => {
      this.handleReconnect(playerId, authToken);
    };

    this.ws.onerror = () => {
      this.handleReconnect(playerId, authToken);
    };
  }

  private handleReconnect(playerId: string, authToken: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        this.connect(playerId, authToken);
      }, delay);
    }
  }

  private authenticate(playerId: string, authToken: string): void {
    this.ws?.send(JSON.stringify({
      type: 'AUTH',
      token: authToken,
      playerId
    }));
  }
}
```

## Testing WebSocket Events

### Mock WebSocket Server

```typescript
class MockWebSocketServer {
  private clients: Set<MockWebSocket> = new Set();

  addClient(client: MockWebSocket): void {
    this.clients.add(client);
  }

  broadcast(message: any): void {
    this.clients.forEach(client => {
      client.receive(message);
    });
  }

  simulateTaskProgress(playerId: string, taskId: string): void {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.1;
      
      this.broadcast({
        type: 'TASK_PROGRESS',
        data: {
          playerId,
          taskId,
          progress: Math.min(progress, 1.0),
          timestamp: Date.now()
        }
      });

      if (progress >= 1.0) {
        clearInterval(interval);
        this.broadcast({
          type: 'TASK_COMPLETED',
          data: {
            playerId,
            task: { id: taskId, name: 'Test Task' },
            rewards: [{ type: 'gold', amount: 100 }],
            timestamp: Date.now()
          }
        });
      }
    }, 100);
  }
}
```

This WebSocket events reference provides complete documentation for all real-time communication in the Task Queue System.