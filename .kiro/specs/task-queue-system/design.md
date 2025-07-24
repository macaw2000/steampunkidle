# Global Task Queue System Design

## Overview

The Global Task Queue System provides the core idle game functionality through a server-side task processing engine that runs continuously on AWS Fargate. This design ensures true idle progression where players' tasks continue executing even when offline, with real-time synchronization when online.

## Architecture

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client  │◄──►│  API Gateway     │◄──►│  Fargate Tasks  │
│                 │    │  (Lambda)        │    │  (Game Engine)  │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ - UI Updates    │    │ - Queue API      │    │ - Task Processor│
│ - Progress Bar  │    │ - Auth           │    │ - Reward Calc   │
│ - Queue Display │    │ - Validation     │    │ - State Persist │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌──────────────────────┐
                    │    DynamoDB          │
                    │                      │
                    │ - Task Queues        │
                    │ - Player State       │
                    │ - Progress Tracking  │
                    └──────────────────────┘
```

### Data Flow

1. **Client → API Gateway**: Queue operations (add, remove, stop)
2. **API Gateway → Fargate**: Task processing commands
3. **Fargate → DynamoDB**: Persistent state updates
4. **Fargate → Client**: Real-time progress via WebSocket/polling

## Components and Interfaces

### Core Task Queue Engine (Fargate)

```typescript
interface TaskQueueEngine {
  // Queue Management
  addTask(playerId: string, task: Task): Promise<void>;
  removeTask(playerId: string, taskId: string): Promise<void>;
  stopAllTasks(playerId: string): Promise<void>;
  
  // Processing
  processPlayerQueue(playerId: string): Promise<void>;
  calculateTaskRewards(task: Task): Promise<TaskReward[]>;
  
  // State Management
  saveQueueState(playerId: string, queue: TaskQueue): Promise<void>;
  loadQueueState(playerId: string): Promise<TaskQueue>;
  
  // Progress Tracking
  updateTaskProgress(playerId: string, progress: TaskProgress): Promise<void>;
  notifyTaskCompletion(playerId: string, result: TaskCompletionResult): Promise<void>;
}
```

### Client-Side Service Layer

```typescript
interface ServerTaskQueueService {
  // Queue Operations
  addHarvestingTask(playerId: string, activity: HarvestingActivity): Promise<Task>;
  addCraftingTask(playerId: string, recipe: CraftingRecipe): Promise<Task>;
  addCombatTask(playerId: string, enemy: Enemy): Promise<Task>;
  
  // Queue Management
  getQueueStatus(playerId: string): QueueStatus;
  stopAllTasks(playerId: string): Promise<void>;
  reorderTasks(playerId: string, taskIds: string[]): Promise<void>;
  
  // Real-time Updates
  onProgress(playerId: string, callback: ProgressCallback): void;
  onTaskComplete(playerId: string, callback: CompletionCallback): void;
  
  // Synchronization
  syncWithServer(playerId: string): Promise<void>;
}
```

### Task Processing Pipeline

```typescript
class TaskProcessor {
  async processTask(task: Task): Promise<TaskCompletionResult> {
    // 1. Validate Prerequisites
    await this.validateTaskPrerequisites(task);
    
    // 2. Execute Task Logic
    const result = await this.executeTaskLogic(task);
    
    // 3. Calculate Rewards
    const rewards = await this.calculateRewards(task, result);
    
    // 4. Update Player State
    await this.updatePlayerState(task.playerId, rewards);
    
    // 5. Return Completion Result
    return {
      task: { ...task, completed: true, rewards },
      rewards,
      nextTask: await this.getNextQueuedTask(task.playerId)
    };
  }
}
```

## Data Models

### Enhanced Task Interface

```typescript
interface Task {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  icon: string;
  duration: number;
  startTime: number;
  playerId: string;
  
  // Activity-specific data
  activityData: HarvestingData | CraftingData | CombatData;
  
  // Prerequisites and requirements
  prerequisites: TaskPrerequisite[];
  resourceRequirements: ResourceRequirement[];
  
  // Progress and completion
  progress: number;
  completed: boolean;
  rewards: TaskReward[];
  
  // Metadata
  priority: number;
  estimatedCompletion: number;
  retryCount: number;
  maxRetries: number;
}
```

### Queue State Management

```typescript
interface TaskQueue {
  playerId: string;
  currentTask: Task | null;
  queuedTasks: Task[];
  
  // Queue status
  isRunning: boolean;
  isPaused: boolean;
  pauseReason?: string;
  
  // Statistics
  totalTasksCompleted: number;
  totalTimeSpent: number;
  totalRewardsEarned: TaskReward[];
  
  // Configuration
  maxQueueSize: number;
  autoStart: boolean;
  
  // Timestamps
  lastUpdated: number;
  lastSynced: number;
  createdAt: number;
}
```

### Activity-Specific Data Structures

```typescript
interface HarvestingData {
  activity: HarvestingActivity;
  playerStats: PlayerStats;
  location: HarvestingLocation;
  tools: EquippedTool[];
}

interface CraftingData {
  recipe: CraftingRecipe;
  materials: MaterialRequirement[];
  craftingStation: CraftingStation;
  playerSkillLevel: number;
}

interface CombatData {
  enemy: Enemy;
  playerLevel: number;
  equipment: Equipment[];
  combatStrategy: CombatStrategy;
}
```

## Error Handling and Recovery

### Failure Scenarios

1. **Network Disconnection**: Client falls back to local task queue service
2. **Server Overload**: Graceful degradation with cached state
3. **Task Validation Failure**: Skip task and continue with queue
4. **Resource Shortage**: Pause queue until resources available
5. **Data Corruption**: Restore from last known good state

### Recovery Mechanisms

```typescript
interface TaskQueueRecovery {
  // State Recovery
  recoverFromCorruption(playerId: string): Promise<TaskQueue>;
  validateQueueIntegrity(queue: TaskQueue): Promise<boolean>;
  
  // Conflict Resolution
  resolveQueueConflicts(localQueue: TaskQueue, serverQueue: TaskQueue): TaskQueue;
  
  // Retry Logic
  retryFailedTask(task: Task): Promise<TaskCompletionResult>;
  exponentialBackoff(retryCount: number): number;
}
```

## Performance Optimizations

### Database Design

- **Partition Key**: `playerId` for even distribution
- **Sort Key**: `taskId` for efficient task lookups
- **GSI**: `status-timestamp` for processing active queues
- **TTL**: Automatic cleanup of completed tasks after 30 days

### Caching Strategy

- **Redis Cache**: Active queue states for sub-100ms access
- **Client Cache**: Last known state for offline resilience
- **CDN**: Static task definitions and icons

### Processing Efficiency

- **Batch Processing**: Process multiple tasks per player in single operation
- **Connection Pooling**: Reuse database connections
- **Async Processing**: Non-blocking task execution
- **Resource Pooling**: Shared computation resources

## Security Considerations

### Authentication and Authorization

- **JWT Tokens**: Secure API access
- **Player Isolation**: Strict playerId validation
- **Rate Limiting**: Prevent queue spam
- **Input Validation**: Sanitize all task data

### Data Protection

- **Encryption**: All data encrypted at rest and in transit
- **Audit Logging**: Track all queue modifications
- **Backup Strategy**: Regular automated backups
- **GDPR Compliance**: Player data deletion capabilities

## Monitoring and Observability

### Key Metrics

- **Queue Processing Time**: Average task completion time
- **Queue Length Distribution**: Monitor queue sizes across players
- **Error Rates**: Track task failures and recovery success
- **Resource Utilization**: CPU, memory, and database usage
- **Player Engagement**: Active queue usage patterns

### Alerting

- **High Error Rate**: > 5% task failures
- **Long Processing Time**: > 30s average task time
- **Queue Backup**: > 1000 tasks in single queue
- **Database Issues**: Connection failures or timeouts
- **Memory Leaks**: Increasing memory usage over time

## Testing Strategy

### Unit Tests
- Task validation logic
- Reward calculation algorithms
- Queue state management
- Error handling scenarios

### Integration Tests
- Client-server synchronization
- Database persistence
- Real-time update delivery
- Offline/online transitions

### Load Tests
- 1000+ concurrent players
- Queue processing under load
- Database performance limits
- Memory usage patterns

### End-to-End Tests
- Complete task lifecycle
- Multi-device synchronization
- Long-running queue scenarios
- Recovery from failures