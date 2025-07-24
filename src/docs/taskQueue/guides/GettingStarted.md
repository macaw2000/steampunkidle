# Getting Started with Task Queue System

## Overview

This guide will help you get up and running with the Task Queue System quickly. You'll learn how to set up the development environment, understand core concepts, and implement basic functionality.

## Prerequisites

### System Requirements

- Node.js 18+ and npm
- AWS CLI configured with appropriate permissions
- Docker (for local development)
- Git

### AWS Services Required

- DynamoDB (for task persistence)
- ElastiCache Redis (for caching)
- Lambda (for API handlers)
- Fargate (for task processing)
- API Gateway (for REST API)

## Quick Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/steampunk-idle-game.git
cd steampunk-idle-game

# Install dependencies
npm install

# Install development tools
npm install -g aws-cdk
```

### 2. Environment Configuration

Create your local environment file:

```bash
# Copy example environment
cp .env.example .env.local

# Edit with your settings
nano .env.local
```

Basic `.env.local` configuration:

```env
# Environment
ENVIRONMENT=development
AWS_REGION=us-east-1
LOG_LEVEL=debug

# Database (use local DynamoDB for development)
DYNAMODB_TABLE=TaskQueues-dev
DYNAMODB_ENDPOINT=http://localhost:8000

# Redis (use local Redis for development)
REDIS_ENDPOINT=localhost:6379
REDIS_TLS_ENABLED=false

# Authentication
JWT_SECRET=your-development-jwt-secret-key-here
JWT_EXPIRATION=24h

# Task Processing
MAX_QUEUE_SIZE=50
MAX_TASK_DURATION=86400000
PROCESSING_INTERVAL=5000
```

### 3. Local Development Setup

Start local services using Docker:

```bash
# Start DynamoDB Local and Redis
docker-compose -f docker-compose.dev.yml up -d

# Create local tables
npm run setup:local-db

# Start the development server
npm run dev
```

### 4. Verify Installation

Test that everything is working:

```bash
# Run health check
curl http://localhost:3000/health

# Run basic tests
npm test

# Check task queue functionality
npm run test:integration
```

## Core Concepts

### Task Queue Architecture

```
Player → API Gateway → Lambda → Fargate → DynamoDB
   ↑                              ↓
   └── WebSocket ← Notifications ←┘
```

### Key Components

1. **Task**: A unit of work (harvesting, crafting, combat)
2. **Queue**: Ordered list of tasks for a player
3. **Processor**: Server-side component that executes tasks
4. **Rewards**: Items, experience, or currency earned from tasks

### Task Lifecycle

```
Created → Queued → Validated → Processing → Completed → Rewards Distributed
```

## Basic Usage Examples

### 1. Adding a Simple Task

```typescript
import { TaskQueueService } from './src/services/taskQueueService';

const taskService = new TaskQueueService();

// Add a harvesting task
const task = await taskService.addHarvestingTask('player_123', {
  activity: 'chop_oak_trees',
  location: 'enchanted_forest',
  quantity: 25
});

console.log('Task added:', task.id);
```

### 2. Monitoring Queue Status

```typescript
// Get current queue status
const status = await taskService.getQueueStatus('player_123');

console.log('Current task:', status.currentTask?.name);
console.log('Queued tasks:', status.queuedTasks.length);
console.log('Total queue time:', status.totalQueueTime / 1000, 'seconds');
```

### 3. Real-time Progress Updates

```typescript
// Listen for progress updates
const unsubscribe = taskService.onProgress('player_123', (progress) => {
  console.log('Task progress:', Math.round(progress * 100) + '%');
});

// Listen for task completion
taskService.onTaskComplete('player_123', (result) => {
  console.log('Task completed:', result.task.name);
  console.log('Rewards:', result.rewards);
});

// Clean up listeners when done
// unsubscribe();
```

## React Integration

### 1. Basic Queue Display Component

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
    const taskService = new TaskQueueService();
    
    // Load initial status
    taskService.getQueueStatus(playerId)
      .then(setQueueStatus)
      .finally(() => setLoading(false));

    // Subscribe to updates
    const unsubscribeProgress = taskService.onProgress(playerId, (progress) => {
      setQueueStatus(prev => prev ? {
        ...prev,
        currentTask: prev.currentTask ? {
          ...prev.currentTask,
          progress
        } : null
      } : null);
    });

    const unsubscribeComplete = taskService.onTaskComplete(playerId, (result) => {
      // Refresh queue status after completion
      taskService.getQueueStatus(playerId).then(setQueueStatus);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
    };
  }, [playerId]);

  if (loading) return <div>Loading queue...</div>;
  if (!queueStatus) return <div>No queue data</div>;

  return (
    <div className="queue-display">
      {queueStatus.currentTask && (
        <div className="current-task">
          <h3>Current Task: {queueStatus.currentTask.name}</h3>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${(queueStatus.currentTask.progress || 0) * 100}%` 
              }}
            />
          </div>
          <p>Progress: {Math.round((queueStatus.currentTask.progress || 0) * 100)}%</p>
        </div>
      )}
      
      <div className="queued-tasks">
        <h4>Queued Tasks ({queueStatus.queuedTasks.length})</h4>
        {queueStatus.queuedTasks.map((task, index) => (
          <div key={task.id} className="queued-task">
            <span className="task-position">#{index + 1}</span>
            <span className="task-name">{task.name}</span>
            <span className="task-duration">
              {Math.round(task.estimatedDuration / 1000)}s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 2. Task Management Component

```typescript
import React from 'react';
import { TaskQueueService } from '../services/taskQueueService';

interface TaskManagerProps {
  playerId: string;
  onTaskAdded?: () => void;
}

export const TaskManager: React.FC<TaskManagerProps> = ({ 
  playerId, 
  onTaskAdded 
}) => {
  const taskService = new TaskQueueService();

  const addHarvestingTask = async (activity: string) => {
    try {
      await taskService.addHarvestingTask(playerId, {
        activity,
        location: 'enchanted_forest',
        quantity: 25
      });
      onTaskAdded?.();
    } catch (error) {
      console.error('Failed to add task:', error);
      alert('Failed to add task: ' + error.message);
    }
  };

  const addCraftingTask = async (recipeId: string) => {
    try {
      await taskService.addCraftingTask(playerId, {
        recipeId,
        quantity: 1,
        craftingStation: 'workbench'
      });
      onTaskAdded?.();
    } catch (error) {
      console.error('Failed to add crafting task:', error);
      alert('Failed to add crafting task: ' + error.message);
    }
  };

  const stopAllTasks = async () => {
    if (confirm('Are you sure you want to stop all tasks? This will clear your queue.')) {
      try {
        await taskService.stopAllTasks(playerId);
        onTaskAdded?.(); // Refresh display
      } catch (error) {
        console.error('Failed to stop tasks:', error);
      }
    }
  };

  return (
    <div className="task-manager">
      <h3>Add Tasks</h3>
      
      <div className="task-category">
        <h4>Harvesting</h4>
        <button onClick={() => addHarvestingTask('chop_oak_trees')}>
          Chop Oak Trees
        </button>
        <button onClick={() => addHarvestingTask('mine_iron_ore')}>
          Mine Iron Ore
        </button>
        <button onClick={() => addHarvestingTask('catch_fish')}>
          Catch Fish
        </button>
      </div>

      <div className="task-category">
        <h4>Crafting</h4>
        <button onClick={() => addCraftingTask('wooden_sword')}>
          Craft Wooden Sword
        </button>
        <button onClick={() => addCraftingTask('iron_armor')}>
          Craft Iron Armor
        </button>
        <button onClick={() => addCraftingTask('health_potion')}>
          Brew Health Potion
        </button>
      </div>

      <div className="queue-controls">
        <button onClick={stopAllTasks} className="danger-button">
          Stop All Tasks
        </button>
      </div>
    </div>
  );
};
```

### 3. Complete Queue Interface

```typescript
import React from 'react';
import { QueueDisplay } from './QueueDisplay';
import { TaskManager } from './TaskManager';

interface TaskQueueInterfaceProps {
  playerId: string;
}

export const TaskQueueInterface: React.FC<TaskQueueInterfaceProps> = ({ 
  playerId 
}) => {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleTaskAdded = () => {
    // Force refresh of queue display
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="task-queue-interface">
      <div className="queue-section">
        <QueueDisplay key={refreshKey} playerId={playerId} />
      </div>
      
      <div className="management-section">
        <TaskManager 
          playerId={playerId} 
          onTaskAdded={handleTaskAdded}
        />
      </div>
    </div>
  );
};
```

## Common Patterns

### 1. Error Handling

```typescript
// Robust error handling for task operations
const addTaskWithErrorHandling = async (playerId: string, taskData: any) => {
  try {
    const task = await taskService.addHarvestingTask(playerId, taskData);
    return { success: true, task };
  } catch (error) {
    if (error.message.includes('INSUFFICIENT_RESOURCES')) {
      return { 
        success: false, 
        error: 'Not enough resources to start this task',
        code: 'INSUFFICIENT_RESOURCES'
      };
    } else if (error.message.includes('QUEUE_FULL')) {
      return { 
        success: false, 
        error: 'Your task queue is full. Complete some tasks first.',
        code: 'QUEUE_FULL'
      };
    } else {
      return { 
        success: false, 
        error: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR'
      };
    }
  }
};
```

### 2. Loading States

```typescript
// Managing loading states for better UX
const [loadingStates, setLoadingStates] = useState({
  addingTask: false,
  stoppingTasks: false,
  loadingQueue: true
});

const addTaskWithLoading = async (taskData: any) => {
  setLoadingStates(prev => ({ ...prev, addingTask: true }));
  
  try {
    await taskService.addHarvestingTask(playerId, taskData);
    // Success feedback
  } catch (error) {
    // Error handling
  } finally {
    setLoadingStates(prev => ({ ...prev, addingTask: false }));
  }
};
```

### 3. Optimistic Updates

```typescript
// Optimistic updates for better perceived performance
const addTaskOptimistically = async (taskData: any) => {
  // Immediately update UI
  const optimisticTask = {
    id: 'temp-' + Date.now(),
    name: taskData.activity,
    type: 'harvesting',
    progress: 0,
    estimatedDuration: 300000
  };
  
  setQueueStatus(prev => ({
    ...prev,
    queuedTasks: [...prev.queuedTasks, optimisticTask]
  }));

  try {
    // Send to server
    const actualTask = await taskService.addHarvestingTask(playerId, taskData);
    
    // Replace optimistic task with real one
    setQueueStatus(prev => ({
      ...prev,
      queuedTasks: prev.queuedTasks.map(task => 
        task.id === optimisticTask.id ? actualTask : task
      )
    }));
  } catch (error) {
    // Remove optimistic task on error
    setQueueStatus(prev => ({
      ...prev,
      queuedTasks: prev.queuedTasks.filter(task => task.id !== optimisticTask.id)
    }));
    
    // Show error message
    console.error('Failed to add task:', error);
  }
};
```

## Testing Your Implementation

### 1. Unit Tests

```typescript
// Example unit test for task service
import { TaskQueueService } from '../services/taskQueueService';

describe('TaskQueueService', () => {
  let service: TaskQueueService;
  
  beforeEach(() => {
    service = new TaskQueueService();
  });

  it('should add harvesting task successfully', async () => {
    const taskData = {
      activity: 'chop_oak_trees',
      location: 'enchanted_forest',
      quantity: 25
    };

    const task = await service.addHarvestingTask('test-player', taskData);

    expect(task).toBeDefined();
    expect(task.type).toBe('harvesting');
    expect(task.activityData.activity).toBe('chop_oak_trees');
  });

  it('should reject invalid task data', async () => {
    const invalidTaskData = {
      activity: '', // Invalid empty activity
      location: 'enchanted_forest',
      quantity: -1 // Invalid negative quantity
    };

    await expect(
      service.addHarvestingTask('test-player', invalidTaskData)
    ).rejects.toThrow();
  });
});
```

### 2. Integration Tests

```typescript
// Example integration test
describe('Task Queue Integration', () => {
  it('should process complete task lifecycle', async () => {
    const service = new TaskQueueService();
    const playerId = 'integration-test-player';

    // Add task
    const task = await service.addHarvestingTask(playerId, {
      activity: 'chop_oak_trees',
      location: 'test_forest',
      quantity: 1
    });

    // Verify task is queued
    const status = await service.getQueueStatus(playerId);
    expect(status.queuedTasks).toContainEqual(
      expect.objectContaining({ id: task.id })
    );

    // Simulate task processing (in real scenario, this happens server-side)
    await service.processQueue(playerId);

    // Verify completion
    const finalStatus = await service.getQueueStatus(playerId);
    expect(finalStatus.currentTask).toBeNull();
  });
});
```

## Next Steps

Once you have the basic setup working:

1. **Explore Advanced Features**: Check out the [Integration Patterns](../api/IntegrationPatterns.md) guide
2. **Add Custom Task Types**: See [Extending the System](./ExtendingSystem.md)
3. **Deploy to Production**: Follow the [Deployment Guide](../operations/DeploymentGuide.md)
4. **Monitor Performance**: Set up monitoring using the [Monitoring Setup](../operations/MonitoringSetup.md) guide

## Troubleshooting

### Common Issues

1. **Connection Errors**: Check that local DynamoDB and Redis are running
2. **Authentication Failures**: Verify JWT_SECRET is set correctly
3. **Task Validation Errors**: Ensure player has required resources and levels
4. **WebSocket Issues**: Check that WebSocket endpoint is configured properly

For more detailed troubleshooting, see the [Troubleshooting Guide](../operations/TroubleshootingGuide.md).

## Support

- Check the [API Reference](../api/QueueAPI.md) for detailed endpoint documentation
- Review [WebSocket Events](../api/WebSocketEvents.md) for real-time communication
- See [Configuration Reference](../operations/ConfigurationReference.md) for all settings

This getting started guide should have you up and running with the Task Queue System quickly. The system is designed to be developer-friendly while providing the robustness needed for production use.