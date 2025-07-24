# Task Queue System Troubleshooting Guide

## Overview

This guide covers common issues, their symptoms, causes, and solutions for the Task Queue System. Use this as your first resource when encountering problems.

## Quick Diagnosis

### System Health Check

```bash
# Check API health
curl https://api.steampunk-idle.com/health

# Check WebSocket connectivity
wscat -c wss://api.steampunk-idle.com/ws

# Check database connectivity
aws dynamodb describe-table --table-name TaskQueues --region us-east-1

# Check Fargate service status
aws ecs describe-services --cluster task-queue-cluster --services task-processor
```

### Common Symptoms and Quick Fixes

| Symptom | Quick Fix | Section |
|---------|-----------|---------|
| Tasks not starting | Check prerequisites and resources | [Task Validation Issues](#task-validation-issues) |
| Progress not updating | Verify WebSocket connection | [Real-time Update Issues](#real-time-update-issues) |
| Queue appears empty | Check synchronization status | [Synchronization Problems](#synchronization-problems) |
| High latency | Review performance metrics | [Performance Issues](#performance-issues) |
| Tasks failing repeatedly | Check error logs and retry logic | [Task Execution Failures](#task-execution-failures) |

## Task Validation Issues

### Problem: Tasks Won't Start

**Symptoms:**
- Tasks remain in "queued" state indefinitely
- Queue appears paused without user action
- Error messages about prerequisites not met

**Common Causes:**
1. Insufficient resources (materials, gold, etc.)
2. Player level too low for task requirements
3. Required equipment not equipped
4. Location or crafting station not available

**Diagnosis:**
```typescript
// Check task validation
const validation = await taskValidationService.validateTask(playerId, task);
console.log('Validation result:', validation);

// Check player resources
const resources = await playerService.getResources(playerId);
console.log('Available resources:', resources);

// Check prerequisites
const prereqs = await taskService.checkPrerequisites(playerId, task);
console.log('Prerequisites:', prereqs);
```

**Solutions:**
1. **Resource Issues:**
   ```typescript
   // Add missing resources for testing
   await playerService.addResources(playerId, {
     iron_ingot: 10,
     gold: 1000
   });
   ```

2. **Level Requirements:**
   ```typescript
   // Check and adjust player level
   const playerLevel = await playerService.getLevel(playerId);
   if (playerLevel < task.requiredLevel) {
     await playerService.setLevel(playerId, task.requiredLevel);
   }
   ```

3. **Equipment Issues:**
   ```typescript
   // Verify and equip required items
   await equipmentService.equipItem(playerId, 'iron_pickaxe');
   ```

### Problem: Invalid Task Data

**Symptoms:**
- Tasks rejected with validation errors
- Malformed task objects in queue
- Type errors in task processing

**Diagnosis:**
```typescript
// Validate task schema
import { taskSchema } from '../schemas/taskSchema';

const isValid = taskSchema.validate(taskData);
if (!isValid) {
  console.log('Validation errors:', taskSchema.errors);
}
```

**Solutions:**
1. **Schema Validation:**
   ```typescript
   // Ensure all required fields are present
   const validTask = {
     type: 'harvesting',
     activityData: {
       activity: 'chop_oak_trees',
       location: 'enchanted_forest',
       quantity: 50
     },
     duration: 600000,
     playerId: 'player_123'
   };
   ```

2. **Type Safety:**
   ```typescript
   // Use TypeScript interfaces
   interface HarvestingTaskData {
     activity: string;
     location: string;
     quantity: number;
     tools?: string[];
   }
   ```

## Real-time Update Issues

### Problem: Progress Not Updating

**Symptoms:**
- Progress bar stuck at same value
- No real-time updates in UI
- WebSocket connection appears inactive

**Diagnosis:**
```typescript
// Check WebSocket connection status
const ws = new WebSocket('wss://api.steampunk-idle.com/ws');
ws.onopen = () => console.log('Connected');
ws.onclose = () => console.log('Disconnected');
ws.onerror = (error) => console.log('Error:', error);

// Monitor message flow
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message.type, message.data);
};
```

**Solutions:**
1. **Connection Issues:**
   ```typescript
   // Implement reconnection logic
   class WebSocketManager {
     private reconnectAttempts = 0;
     private maxAttempts = 5;

     connect() {
       const ws = new WebSocket(this.url);
       
       ws.onclose = () => {
         if (this.reconnectAttempts < this.maxAttempts) {
           setTimeout(() => {
             this.reconnectAttempts++;
             this.connect();
           }, 1000 * Math.pow(2, this.reconnectAttempts));
         }
       };
     }
   }
   ```

2. **Authentication Issues:**
   ```typescript
   // Verify token is valid and not expired
   const token = localStorage.getItem('authToken');
   const decoded = jwt.decode(token);
   
   if (decoded.exp < Date.now() / 1000) {
     // Token expired, refresh it
     await refreshAuthToken();
   }
   ```

3. **Subscription Issues:**
   ```typescript
   // Ensure proper event subscription
   ws.send(JSON.stringify({
     type: 'SUBSCRIBE',
     data: {
       events: ['TASK_PROGRESS', 'TASK_COMPLETED'],
       playerId: 'player_123'
     }
   }));
   ```

### Problem: Delayed or Missing Notifications

**Symptoms:**
- Task completion notifications arrive late
- Some events never received
- Inconsistent update frequency

**Diagnosis:**
```bash
# Check WebSocket server logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/websocket-handler \
  --start-time $(date -d '1 hour ago' +%s)000

# Monitor connection metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=task-queue-websocket
```

**Solutions:**
1. **Server Overload:**
   ```bash
   # Scale up WebSocket handlers
   aws lambda put-provisioned-concurrency-config \
     --function-name websocket-handler \
     --provisioned-concurrency-config AllocatedConcurrency=50
   ```

2. **Message Queuing:**
   ```typescript
   // Implement message buffering
   class MessageBuffer {
     private buffer: any[] = [];
     private flushInterval = 100;

     add(message: any) {
       this.buffer.push(message);
       if (this.buffer.length >= 10) {
         this.flush();
       }
     }

     flush() {
       if (this.buffer.length > 0) {
         this.sendBatch(this.buffer);
         this.buffer = [];
       }
     }
   }
   ```

## Synchronization Problems

### Problem: Client-Server State Mismatch

**Symptoms:**
- Queue shows different tasks on different devices
- Completed tasks reappear after refresh
- Progress resets unexpectedly

**Diagnosis:**
```typescript
// Compare local and server state
const localQueue = await localStorageService.getQueue(playerId);
const serverQueue = await apiService.getQueue(playerId);

console.log('Local queue:', localQueue);
console.log('Server queue:', serverQueue);
console.log('Last sync times:', {
  local: localQueue.lastSynced,
  server: serverQueue.lastUpdated
});
```

**Solutions:**
1. **Force Synchronization:**
   ```typescript
   // Implement manual sync
   async function forceSyncQueue(playerId: string) {
     const serverQueue = await apiService.getQueue(playerId);
     await localStorageService.saveQueue(playerId, serverQueue);
     
     // Update UI
     updateQueueDisplay(serverQueue);
   }
   ```

2. **Conflict Resolution:**
   ```typescript
   // Merge conflicting states
   function mergeQueueStates(local: TaskQueue, server: TaskQueue): TaskQueue {
     // Server state takes precedence for current task
     const merged = { ...server };
     
     // Merge queued tasks, preserving local additions
     const serverTaskIds = new Set(server.queuedTasks.map(t => t.id));
     const localOnlyTasks = local.queuedTasks.filter(t => !serverTaskIds.has(t.id));
     
     merged.queuedTasks = [...server.queuedTasks, ...localOnlyTasks];
     return merged;
   }
   ```

3. **Sync Status Monitoring:**
   ```typescript
   // Add sync status indicator
   interface SyncStatus {
     isOnline: boolean;
     lastSyncTime: number;
     pendingChanges: number;
     syncInProgress: boolean;
   }

   const syncStatus = useSyncStatus(playerId);
   ```

### Problem: Offline Changes Lost

**Symptoms:**
- Tasks added offline don't appear when back online
- Progress made offline is reset
- Queue modifications lost during reconnection

**Diagnosis:**
```typescript
// Check offline storage
const offlineChanges = await offlineStorageService.getPendingChanges(playerId);
console.log('Pending offline changes:', offlineChanges);

// Verify sync mechanism
const syncLog = await syncService.getSyncLog(playerId);
console.log('Sync history:', syncLog);
```

**Solutions:**
1. **Offline Change Tracking:**
   ```typescript
   // Track offline modifications
   class OfflineChangeTracker {
     private changes: OfflineChange[] = [];

     trackChange(type: string, data: any) {
       this.changes.push({
         type,
         data,
         timestamp: Date.now(),
         id: generateId()
       });
       this.persistChanges();
     }

     async syncChanges() {
       for (const change of this.changes) {
         try {
           await this.applyChange(change);
           this.removeChange(change.id);
         } catch (error) {
           console.error('Failed to sync change:', change, error);
         }
       }
     }
   }
   ```

2. **Incremental Sync:**
   ```typescript
   // Sync only changed data
   async function incrementalSync(playerId: string, lastSyncTime: number) {
     const changes = await apiService.getChangesSince(playerId, lastSyncTime);
     
     for (const change of changes) {
       await applyServerChange(change);
     }
     
     const localChanges = await getLocalChangesSince(lastSyncTime);
     await apiService.applyChanges(playerId, localChanges);
   }
   ```

## Performance Issues

### Problem: Slow Queue Processing

**Symptoms:**
- Tasks take longer than expected to complete
- High latency in API responses
- UI feels sluggish during queue operations

**Diagnosis:**
```bash
# Check API response times
curl -w "@curl-format.txt" -s -o /dev/null https://api.steampunk-idle.com/queue/player_123

# Monitor database performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=TaskQueues

# Check Fargate CPU/Memory usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=task-processor
```

**Solutions:**
1. **Database Optimization:**
   ```typescript
   // Use batch operations
   const batchWriter = new DynamoDBBatchWriter();
   
   for (const queue of queues) {
     batchWriter.put({
       TableName: 'TaskQueues',
       Item: queue
     });
   }
   
   await batchWriter.execute();
   ```

2. **Caching Implementation:**
   ```typescript
   // Add Redis caching
   class CachedQueueService {
     async getQueue(playerId: string): Promise<TaskQueue> {
       const cacheKey = `queue:${playerId}`;
       
       // Try cache first
       const cached = await redis.get(cacheKey);
       if (cached) {
         return JSON.parse(cached);
       }
       
       // Fallback to database
       const queue = await database.getQueue(playerId);
       await redis.setex(cacheKey, 300, JSON.stringify(queue));
       
       return queue;
     }
   }
   ```

3. **Connection Pooling:**
   ```typescript
   // Optimize database connections
   const dynamodb = new AWS.DynamoDB.DocumentClient({
     maxRetries: 3,
     retryDelayOptions: {
       customBackoff: (retryCount) => Math.pow(2, retryCount) * 100
     },
     httpOptions: {
       connectTimeout: 1000,
       timeout: 5000
     }
   });
   ```

### Problem: Memory Leaks

**Symptoms:**
- Increasing memory usage over time
- Application becomes unresponsive
- Frequent garbage collection

**Diagnosis:**
```typescript
// Monitor memory usage
const memoryUsage = process.memoryUsage();
console.log('Memory usage:', {
  rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
  heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
  heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
});

// Check for event listener leaks
console.log('Event listeners:', process.listenerCount('uncaughtException'));
```

**Solutions:**
1. **Proper Cleanup:**
   ```typescript
   // Clean up event listeners
   useEffect(() => {
     const handleProgress = (data) => {
       // Handle progress update
     };
     
     websocket.on('TASK_PROGRESS', handleProgress);
     
     return () => {
       websocket.off('TASK_PROGRESS', handleProgress);
     };
   }, []);
   ```

2. **Object Pool Pattern:**
   ```typescript
   // Reuse objects to reduce GC pressure
   class TaskObjectPool {
     private pool: Task[] = [];
     
     acquire(): Task {
       return this.pool.pop() || this.createTask();
     }
     
     release(task: Task): void {
       this.resetTask(task);
       this.pool.push(task);
     }
   }
   ```

## Task Execution Failures

### Problem: Tasks Failing Repeatedly

**Symptoms:**
- Tasks marked as failed in queue
- Retry attempts exhausted
- Error messages in logs

**Diagnosis:**
```bash
# Check task processor logs
aws logs filter-log-events \
  --log-group-name /aws/ecs/task-processor \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000

# Check failed task metrics
aws cloudwatch get-metric-statistics \
  --namespace TaskQueue \
  --metric-name TaskFailures \
  --start-time $(date -d '1 hour ago' --iso-8601)
```

**Solutions:**
1. **Retry Logic Enhancement:**
   ```typescript
   // Implement exponential backoff
   class TaskRetryManager {
     async retryTask(task: Task, attempt: number): Promise<void> {
       const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
       
       await new Promise(resolve => setTimeout(resolve, delay));
       
       try {
         await this.executeTask(task);
       } catch (error) {
         if (attempt < task.maxRetries) {
           await this.retryTask(task, attempt + 1);
         } else {
           await this.handleTaskFailure(task, error);
         }
       }
     }
   }
   ```

2. **Error Classification:**
   ```typescript
   // Handle different error types appropriately
   function classifyError(error: Error): ErrorType {
     if (error.message.includes('INSUFFICIENT_RESOURCES')) {
       return ErrorType.RECOVERABLE;
     }
     if (error.message.includes('INVALID_TASK_DATA')) {
       return ErrorType.PERMANENT;
     }
     return ErrorType.TRANSIENT;
   }
   ```

3. **Circuit Breaker Pattern:**
   ```typescript
   // Prevent cascading failures
   class CircuitBreaker {
     private failures = 0;
     private lastFailureTime = 0;
     private state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN

     async execute<T>(operation: () => Promise<T>): Promise<T> {
       if (this.state === 'OPEN') {
         if (Date.now() - this.lastFailureTime > 60000) {
           this.state = 'HALF_OPEN';
         } else {
           throw new Error('Circuit breaker is OPEN');
         }
       }

       try {
         const result = await operation();
         this.onSuccess();
         return result;
       } catch (error) {
         this.onFailure();
         throw error;
       }
     }
   }
   ```

## Database Issues

### Problem: Connection Timeouts

**Symptoms:**
- Database operations timing out
- Connection pool exhausted
- High error rates in logs

**Diagnosis:**
```bash
# Check DynamoDB throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=TaskQueues

# Monitor connection metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits
```

**Solutions:**
1. **Connection Pool Tuning:**
   ```typescript
   // Optimize connection settings
   const dynamodb = new AWS.DynamoDB.DocumentClient({
     maxRetries: 5,
     retryDelayOptions: {
       customBackoff: (retryCount) => {
         return Math.min(1000 * Math.pow(2, retryCount), 10000);
       }
     },
     httpOptions: {
       connectTimeout: 2000,
       timeout: 10000,
       agent: new https.Agent({
         keepAlive: true,
         maxSockets: 50
       })
     }
   });
   ```

2. **Capacity Management:**
   ```bash
   # Increase table capacity
   aws dynamodb update-table \
     --table-name TaskQueues \
     --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=100
   ```

3. **Query Optimization:**
   ```typescript
   // Use efficient query patterns
   const params = {
     TableName: 'TaskQueues',
     IndexName: 'GSI1',
     KeyConditionExpression: 'GSI1PK = :pk',
     ExpressionAttributeValues: {
       ':pk': 'ACTIVE_QUEUE'
     },
     Limit: 25,
     ScanIndexForward: false
   };
   ```

## Monitoring and Alerting

### Setting Up Alerts

```bash
# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "TaskQueue-HighErrorRate" \
  --alarm-description "Task queue error rate is high" \
  --metric-name ErrorRate \
  --namespace TaskQueue \
  --statistic Average \
  --period 300 \
  --threshold 5.0 \
  --comparison-operator GreaterThanThreshold

# Set up log-based alerts
aws logs put-metric-filter \
  --log-group-name /aws/ecs/task-processor \
  --filter-name TaskFailures \
  --filter-pattern "ERROR" \
  --metric-transformations \
    metricName=TaskFailures,metricNamespace=TaskQueue,metricValue=1
```

### Health Check Endpoints

```typescript
// Implement comprehensive health checks
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      websocket: await checkWebSocketHealth(),
      taskProcessor: await checkTaskProcessorHealth()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## Emergency Procedures

### System Recovery

```bash
# Emergency queue reset
aws dynamodb scan --table-name TaskQueues \
  --filter-expression "attribute_exists(currentTask)" \
  --projection-expression "PK,SK" | \
  jq -r '.Items[] | "\(.PK.S) \(.SK.S)"' | \
  while read pk sk; do
    aws dynamodb update-item \
      --table-name TaskQueues \
      --key "{\"PK\":{\"S\":\"$pk\"},\"SK\":{\"S\":\"$sk\"}}" \
      --update-expression "REMOVE currentTask SET isRunning = :false" \
      --expression-attribute-values '{":false":{"BOOL":false}}'
  done

# Restart task processors
aws ecs update-service \
  --cluster task-queue-cluster \
  --service task-processor \
  --force-new-deployment
```

### Data Recovery

```typescript
// Restore from backup
async function restoreQueueFromBackup(playerId: string, backupTimestamp: number) {
  const backup = await backupService.getBackup(playerId, backupTimestamp);
  
  // Validate backup data
  const isValid = await validateQueueData(backup);
  if (!isValid) {
    throw new Error('Backup data is corrupted');
  }
  
  // Restore queue state
  await queueService.saveQueue(backup);
  
  // Notify player
  await notificationService.send(playerId, {
    type: 'QUEUE_RESTORED',
    message: 'Your queue has been restored from backup'
  });
}
```

This troubleshooting guide provides comprehensive solutions for common Task Queue System issues. Keep it updated as new issues are discovered and resolved.