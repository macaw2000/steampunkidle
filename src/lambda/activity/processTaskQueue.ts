/**
 * Server-side task queue processor
 * This Lambda function runs continuously to process player task queues
 * and calculate offline progress for idle gameplay
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';

interface TaskQueue {
  playerId: string;
  currentTask: Task | null;
  queuedTasks: Task[];
  isRunning: boolean;
  totalTasksCompleted: number;
  totalTimeSpent: number;
  lastProcessed: string;
  lastSaved: number;
}

interface Task {
  id: string;
  type: 'HARVESTING' | 'COMBAT' | 'CRAFTING';
  name: string;
  description: string;
  icon: string;
  duration: number;
  startTime: number;
  playerId: string;
  activityData: any;
  completed: boolean;
  rewards?: TaskReward[];
}

interface TaskReward {
  type: 'resource' | 'experience' | 'currency' | 'item';
  itemId?: string;
  quantity: number;
  rarity?: string;
  isRare?: boolean;
}

interface TaskCompletionResult {
  task: Task;
  rewards: TaskReward[];
  nextTask: Task | null;
}

/**
 * Main handler - can be called via API Gateway or EventBridge scheduler
 */
export const handler = async (
  event: APIGatewayProxyEvent | ScheduledEvent
): Promise<APIGatewayProxyResult | void> => {
  try {
    // Check if this is a scheduled event (periodic processing)
    if ('source' in event && event.source === 'aws.events') {
      console.log('Processing all task queues (scheduled)');
      await processAllTaskQueues();
      return;
    }

    // Handle API Gateway requests
    const apiEvent = event as APIGatewayProxyEvent;
    
    if (apiEvent.httpMethod === 'GET' && apiEvent.pathParameters?.playerId) {
      // Get task queue status for a specific player
      return await getTaskQueueStatus(apiEvent.pathParameters.playerId);
    }
    
    if (apiEvent.httpMethod === 'POST') {
      const body = JSON.parse(apiEvent.body || '{}');
      
      if (body.action === 'sync') {
        // Sync task queue for a specific player
        return await syncTaskQueue(body.playerId);
      }
      
      if (body.action === 'addTask') {
        // Add a new task to the queue
        return await addTaskToQueue(body.playerId, body.task);
      }
      
      if (body.action === 'stopTasks') {
        // Stop all tasks for a player
        return await stopAllTasks(body.playerId);
      }
    }

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Invalid request' }),
    };

  } catch (error) {
    console.error('Error in task queue processor:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Process all active task queues (called by scheduler)
 */
async function processAllTaskQueues(): Promise<void> {
  try {
    // Get all task queues that have active tasks
    const result = await DatabaseService.scan<TaskQueue>({
      TableName: TABLE_NAMES.TASK_QUEUES,
      FilterExpression: 'isRunning = :running',
      ExpressionAttributeValues: {
        ':running': true,
      },
    });

    console.log(`Found ${result.items.length} active task queues to process`);

    // Process each queue
    for (const queue of result.items) {
      try {
        await processTaskQueue(queue);
      } catch (error) {
        console.error(`Error processing queue for player ${queue.playerId}:`, error);
        // Continue processing other queues even if one fails
      }
    }

  } catch (error) {
    console.error('Error processing all task queues:', error);
    throw error;
  }
}

/**
 * Process a single task queue
 */
async function processTaskQueue(queue: TaskQueue): Promise<TaskQueue> {
  const now = Date.now();
  let updated = false;

  // Process current task if it exists
  if (queue.currentTask && queue.isRunning) {
    const task = queue.currentTask;
    const elapsed = now - task.startTime;
    
    // Check if task is completed
    if (elapsed >= task.duration) {
      console.log(`Task ${task.id} completed for player ${queue.playerId}`);
      
      // Calculate how many times the task completed (for idle games)
      const completions = Math.floor(elapsed / task.duration);
      
      // Complete the task multiple times if needed
      for (let i = 0; i < completions; i++) {
        const rewards = await generateTaskRewards(task);
        task.rewards = rewards;
        task.completed = true;
        
        // Update queue stats
        queue.totalTasksCompleted++;
        queue.totalTimeSpent += task.duration;
        
        // Apply rewards to character
        await applyRewardsToCharacter(queue.playerId, rewards);
      }
      
      // Start next task or create a new identical task for idle gameplay
      const nextTask = queue.queuedTasks.shift();
      if (nextTask) {
        nextTask.startTime = now;
        queue.currentTask = nextTask;
      } else {
        // Create identical task for continuous idle gameplay
        const newTask = createIdenticalTask(task);
        newTask.startTime = now;
        queue.currentTask = newTask;
      }
      
      updated = true;
    }
  }

  // Update last processed time
  queue.lastProcessed = new Date().toISOString();
  
  if (updated) {
    // Save updated queue to database
    await DatabaseService.putItem({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Item: queue,
    });
  }

  return queue;
}

/**
 * Get task queue status for a player
 */
async function getTaskQueueStatus(playerId: string): Promise<APIGatewayProxyResult> {
  try {
    const queue = await DatabaseService.getItem<TaskQueue>({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Key: { playerId },
    });

    if (!queue) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Task queue not found' }),
      };
    }

    // Calculate current progress if task is running
    let currentProgress = null;
    if (queue.currentTask && queue.isRunning) {
      const elapsed = Date.now() - queue.currentTask.startTime;
      const progress = Math.min(elapsed / queue.currentTask.duration, 1);
      const timeRemaining = Math.max(queue.currentTask.duration - elapsed, 0);
      
      currentProgress = {
        taskId: queue.currentTask.id,
        progress,
        timeRemaining,
        isComplete: progress >= 1,
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        queue: {
          currentTask: queue.currentTask,
          queueLength: queue.queuedTasks.length,
          queuedTasks: queue.queuedTasks,
          isRunning: queue.isRunning,
          totalCompleted: queue.totalTasksCompleted,
        },
        currentProgress,
      }),
    };

  } catch (error) {
    console.error('Error getting task queue status:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Sync task queue with client
 */
async function syncTaskQueue(playerId: string): Promise<APIGatewayProxyResult> {
  try {
    let queue = await DatabaseService.getItem<TaskQueue>({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Key: { playerId },
    });

    if (!queue) {
      // Create new queue if it doesn't exist
      queue = {
        playerId,
        currentTask: null,
        queuedTasks: [],
        isRunning: false,
        totalTasksCompleted: 0,
        totalTimeSpent: 0,
        lastProcessed: new Date().toISOString(),
        lastSaved: Date.now(),
      };
      
      await DatabaseService.putItem({
        TableName: TABLE_NAMES.TASK_QUEUES,
        Item: queue,
      });
    } else {
      // Process any pending tasks
      queue = await processTaskQueue(queue);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        queue: {
          currentTask: queue.currentTask,
          queueLength: queue.queuedTasks.length,
          queuedTasks: queue.queuedTasks,
          isRunning: queue.isRunning,
          totalCompleted: queue.totalTasksCompleted,
        },
        message: 'Task queue synced successfully',
      }),
    };

  } catch (error) {
    console.error('Error syncing task queue:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Add a task to the queue
 */
async function addTaskToQueue(playerId: string, task: Task): Promise<APIGatewayProxyResult> {
  try {
    let queue = await DatabaseService.getItem<TaskQueue>({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Key: { playerId },
    });

    if (!queue) {
      // Create new queue
      queue = {
        playerId,
        currentTask: null,
        queuedTasks: [],
        isRunning: false,
        totalTasksCompleted: 0,
        totalTimeSpent: 0,
        lastProcessed: new Date().toISOString(),
        lastSaved: Date.now(),
      };
    }

    // Add task to queue or start immediately
    if (!queue.currentTask) {
      task.startTime = Date.now();
      queue.currentTask = task;
      queue.isRunning = true;
    } else {
      queue.queuedTasks.push(task);
    }

    // Save updated queue
    await DatabaseService.putItem({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Item: queue,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Task added to queue successfully',
        taskId: task.id,
      }),
    };

  } catch (error) {
    console.error('Error adding task to queue:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Stop all tasks for a player
 */
async function stopAllTasks(playerId: string): Promise<APIGatewayProxyResult> {
  try {
    const queue = await DatabaseService.getItem<TaskQueue>({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Key: { playerId },
    });

    if (!queue) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Task queue not found' }),
      };
    }

    // Clear all tasks
    queue.currentTask = null;
    queue.queuedTasks = [];
    queue.isRunning = false;

    // Save updated queue
    await DatabaseService.putItem({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Item: queue,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'All tasks stopped successfully',
      }),
    };

  } catch (error) {
    console.error('Error stopping tasks:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Generate rewards for a completed task
 */
async function generateTaskRewards(task: Task): Promise<TaskReward[]> {
  const rewards: TaskReward[] = [];

  switch (task.type) {
    case 'HARVESTING':
      // Generate harvesting rewards
      rewards.push({
        type: 'resource',
        itemId: 'copper_ore',
        quantity: Math.floor(Math.random() * 3) + 1,
        rarity: 'common',
        isRare: false,
      });
      
      rewards.push({
        type: 'experience',
        quantity: 25,
      });

      // Chance for rare item
      if (Math.random() < 0.1) {
        rewards.push({
          type: 'resource',
          itemId: 'steam_crystal',
          quantity: 1,
          rarity: 'rare',
          isRare: true,
        });
      }
      break;

    case 'COMBAT':
      rewards.push({
        type: 'experience',
        quantity: 35,
      });
      
      rewards.push({
        type: 'currency',
        quantity: 15,
      });
      break;

    case 'CRAFTING':
      rewards.push({
        type: 'experience',
        quantity: 30,
      });
      
      rewards.push({
        type: 'item',
        itemId: 'clockwork_gear',
        quantity: 1,
        rarity: 'common',
        isRare: false,
      });
      break;
  }

  return rewards;
}

/**
 * Apply rewards to character
 */
async function applyRewardsToCharacter(playerId: string, rewards: TaskReward[]): Promise<void> {
  try {
    // Get character
    const character = await DatabaseService.getItem({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: playerId },
    });

    if (!character) {
      console.warn(`Character not found for player ${playerId}`);
      return;
    }

    // Apply rewards
    let experienceGained = 0;
    let currencyGained = 0;

    for (const reward of rewards) {
      switch (reward.type) {
        case 'experience':
          experienceGained += reward.quantity;
          break;
        case 'currency':
          currencyGained += reward.quantity;
          break;
        // TODO: Handle resource and item rewards by updating inventory
      }
    }

    // Update character if there are rewards to apply
    if (experienceGained > 0 || currencyGained > 0) {
      const updateExpression = [];
      const expressionAttributeValues: any = {};

      if (experienceGained > 0) {
        updateExpression.push('experience = experience + :exp');
        expressionAttributeValues[':exp'] = experienceGained;
      }

      if (currencyGained > 0) {
        updateExpression.push('currency = currency + :currency');
        expressionAttributeValues[':currency'] = currencyGained;
      }

      await DatabaseService.updateItem({
        TableName: TABLE_NAMES.CHARACTERS,
        Key: { userId: playerId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
      });

      console.log(`Applied rewards to ${playerId}: ${experienceGained} exp, ${currencyGained} currency`);
    }

  } catch (error) {
    console.error(`Error applying rewards to character ${playerId}:`, error);
  }
}

/**
 * Create an identical task for continuous idle gameplay
 */
function createIdenticalTask(originalTask: Task): Task {
  return {
    ...originalTask,
    id: `${originalTask.type}-${Date.now()}`,
    startTime: 0, // Will be set when task starts
    completed: false,
    rewards: undefined,
  };
}