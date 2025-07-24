# Queue API Reference

## Overview

The Task Queue API provides RESTful endpoints for managing player task queues, with real-time updates via WebSocket connections.

## Base URL

```
Production: https://api.steampunk-idle.com/v1
Development: https://dev-api.steampunk-idle.com/v1
Local: http://localhost:3001/v1
```

## Authentication

All API requests require JWT authentication:

```http
Authorization: Bearer <jwt_token>
```

## Core Queue Operations

### Get Queue Status

Retrieve the current state of a player's task queue.

```http
GET /queue/{playerId}
```

**Response:**
```json
{
  "playerId": "player_123",
  "currentTask": {
    "id": "task_456",
    "type": "harvesting",
    "name": "Chop Oak Trees",
    "progress": 0.65,
    "estimatedCompletion": 1642789200000
  },
  "queuedTasks": [
    {
      "id": "task_789",
      "type": "crafting",
      "name": "Craft Iron Sword",
      "estimatedDuration": 300000
    }
  ],
  "isRunning": true,
  "totalQueueTime": 1800000,
  "queueLength": 5
}
```

### Add Task to Queue

Add a new task to the player's queue.

```http
POST /queue/{playerId}/tasks
```

**Request Body:**
```json
{
  "type": "harvesting",
  "activityData": {
    "activity": "chop_oak_trees",
    "location": "enchanted_forest",
    "duration": 600000
  }
}
```

**Response:**
```json
{
  "taskId": "task_new_123",
  "queuePosition": 3,
  "estimatedStartTime": 1642789800000,
  "success": true
}
```

### Remove Task from Queue

Remove a specific task from the queue.

```http
DELETE /queue/{playerId}/tasks/{taskId}
```

**Response:**
```json
{
  "success": true,
  "removedTaskId": "task_456",
  "newQueueLength": 4
}
```

### Stop All Tasks

Stop the current task and clear the entire queue.

```http
POST /queue/{playerId}/stop
```

**Response:**
```json
{
  "success": true,
  "stoppedTaskId": "task_456",
  "clearedTasks": 5,
  "refundedResources": [
    {
      "type": "wood",
      "amount": 10
    }
  ]
}
```

### Reorder Queue

Change the order of tasks in the queue.

```http
PUT /queue/{playerId}/reorder
```

**Request Body:**
```json
{
  "taskIds": ["task_789", "task_456", "task_123"]
}
```

## Activity-Specific Endpoints

### Harvesting Tasks

```http
POST /queue/{playerId}/tasks/harvesting
```

**Request Body:**
```json
{
  "activity": "chop_oak_trees",
  "location": "enchanted_forest",
  "quantity": 50,
  "tools": ["iron_axe"]
}
```

### Crafting Tasks

```http
POST /queue/{playerId}/tasks/crafting
```

**Request Body:**
```json
{
  "recipeId": "iron_sword",
  "quantity": 1,
  "craftingStation": "forge",
  "materials": [
    {
      "type": "iron_ingot",
      "amount": 3
    }
  ]
}
```

### Combat Tasks

```http
POST /queue/{playerId}/tasks/combat
```

**Request Body:**
```json
{
  "enemyType": "forest_goblin",
  "difficulty": "normal",
  "duration": 300000,
  "equipment": ["iron_sword", "leather_armor"]
}
```

## Queue Management

### Pause Queue

Temporarily pause queue processing.

```http
POST /queue/{playerId}/pause
```

### Resume Queue

Resume paused queue processing.

```http
POST /queue/{playerId}/resume
```

### Get Queue Statistics

Retrieve detailed queue statistics.

```http
GET /queue/{playerId}/stats
```

**Response:**
```json
{
  "totalTasksCompleted": 1250,
  "totalTimeSpent": 45000000,
  "averageTaskDuration": 36000,
  "mostCommonTaskType": "harvesting",
  "totalRewardsEarned": {
    "experience": 15000,
    "gold": 2500,
    "items": 450
  },
  "queueEfficiency": 0.92
}
```

## Error Responses

### Standard Error Format

```json
{
  "error": {
    "code": "INVALID_TASK_TYPE",
    "message": "The specified task type is not supported",
    "details": {
      "supportedTypes": ["harvesting", "crafting", "combat"]
    }
  },
  "timestamp": 1642789200000,
  "requestId": "req_123456"
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `QUEUE_FULL` | Queue has reached maximum capacity | 400 |
| `INSUFFICIENT_RESOURCES` | Player lacks required resources | 400 |
| `INVALID_PREREQUISITES` | Task prerequisites not met | 400 |
| `TASK_NOT_FOUND` | Specified task does not exist | 404 |
| `QUEUE_PROCESSING_ERROR` | Server error during task processing | 500 |
| `RATE_LIMIT_EXCEEDED` | Too many requests in time window | 429 |

## Rate Limits

- **Queue Operations**: 60 requests per minute per player
- **Task Addition**: 10 requests per minute per player
- **Status Queries**: 120 requests per minute per player

## Validation Rules

### Task Validation
- Maximum queue size: 50 tasks
- Maximum single task duration: 24 hours
- Maximum total queue time: 7 days
- Required fields: `type`, `activityData`

### Resource Validation
- All required materials must be available
- Player level must meet task requirements
- Equipment must be equipped and functional

## SDK Examples

### JavaScript/TypeScript

```typescript
import { TaskQueueClient } from '@steampunk-idle/task-queue-sdk';

const client = new TaskQueueClient({
  apiUrl: 'https://api.steampunk-idle.com/v1',
  authToken: 'your_jwt_token'
});

// Add harvesting task
const task = await client.addHarvestingTask('player_123', {
  activity: 'chop_oak_trees',
  location: 'enchanted_forest',
  quantity: 50
});

// Get queue status
const status = await client.getQueueStatus('player_123');
```

### Python

```python
from steampunk_idle import TaskQueueClient

client = TaskQueueClient(
    api_url='https://api.steampunk-idle.com/v1',
    auth_token='your_jwt_token'
)

# Add crafting task
task = client.add_crafting_task('player_123', {
    'recipe_id': 'iron_sword',
    'quantity': 1,
    'materials': [{'type': 'iron_ingot', 'amount': 3}]
})
```

## Testing

### Test Endpoints

Development environment provides additional testing endpoints:

```http
POST /test/queue/{playerId}/simulate
POST /test/queue/{playerId}/fast-forward
GET /test/queue/metrics
```

### Mock Data

Use the test data generator for consistent testing:

```typescript
import { generateTestQueue } from '@steampunk-idle/test-utils';

const mockQueue = generateTestQueue({
  playerId: 'test_player',
  taskCount: 5,
  includeCurrentTask: true
});
```