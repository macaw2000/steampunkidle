/**
 * Steampunk Idle Game Engine
 * Runs continuously on ECS Fargate to process player task queues
 */

const express = require('express');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(client);

// Table names
const TABLE_NAMES = {
  TASK_QUEUES: process.env.TASK_QUEUES_TABLE || 'steampunk-idle-game-task-queues',
  CHARACTERS: process.env.CHARACTERS_TABLE || 'steampunk-idle-game-characters',
};

// In-memory cache for active task queues
const activeQueues = new Map();

/**
 * Game Engine - Continuous Task Processing
 */
class GameEngine {
  constructor() {
    this.isRunning = false;
    this.processingInterval = null;
  }

  async start() {
    console.log('🎮 Starting Steampunk Idle Game Engine...');
    this.isRunning = true;
    
    // Load all active task queues from database
    await this.loadActiveQueues();
    
    // Start continuous processing every 1 second
    this.processingInterval = setInterval(() => {
      this.processAllQueues();
    }, 1000);
    
    console.log('✅ Game Engine started - processing task queues every 1 second');
  }

  async stop() {
    console.log('🛑 Stopping Game Engine...');
    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Save all queues to database before stopping
    await this.saveAllQueues();
    console.log('✅ Game Engine stopped');
  }

  async loadActiveQueues() {
    try {
      console.log('📥 Loading active task queues from database...');
      
      const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAMES.TASK_QUEUES,
        FilterExpression: 'isRunning = :running',
        ExpressionAttributeValues: {
          ':running': true,
        },
      }));

      for (const queue of result.Items || []) {
        activeQueues.set(queue.playerId, queue);
        console.log(`📋 Loaded queue for player: ${queue.playerId}`);
      }

      console.log(`✅ Loaded ${activeQueues.size} active task queues`);
    } catch (error) {
      console.error('❌ Error loading active queues:', error);
    }
  }

  async saveAllQueues() {
    console.log('💾 Saving all task queues to database...');
    
    for (const [playerId, queue] of activeQueues) {
      try {
        await docClient.send(new PutCommand({
          TableName: TABLE_NAMES.TASK_QUEUES,
          Item: {
            ...queue,
            lastSaved: Date.now(),
          },
        }));
      } catch (error) {
        console.error(`❌ Error saving queue for player ${playerId}:`, error);
      }
    }
    
    console.log('✅ All queues saved to database');
  }

  async processAllQueues() {
    if (!this.isRunning) return;

    const now = Date.now();
    let processedCount = 0;

    for (const [playerId, queue] of activeQueues) {
      try {
        const wasUpdated = await this.processQueue(queue, now);
        if (wasUpdated) {
          processedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing queue for player ${playerId}:`, error);
      }
    }

    // Log processing stats every 30 seconds
    if (now % 30000 < 1000) {
      console.log(`🔄 Processed ${processedCount}/${activeQueues.size} active queues`);
    }
  }

  async processQueue(queue, now) {
    if (!queue.currentTask || !queue.isRunning) {
      return false;
    }

    const task = queue.currentTask;
    const elapsed = now - task.startTime;
    
    // Check if task is completed
    if (elapsed >= task.duration) {
      console.log(`✅ Task completed: ${task.name} for player ${queue.playerId}`);
      
      // Generate rewards
      const rewards = this.generateTaskRewards(task);
      
      // Apply rewards to character
      await this.applyRewardsToCharacter(queue.playerId, rewards);
      
      // Update queue stats
      queue.totalTasksCompleted++;
      queue.totalTimeSpent += task.duration;
      
      // Start next task or create identical task for idle gameplay
      const nextTask = queue.queuedTasks.shift();
      if (nextTask) {
        nextTask.startTime = now;
        queue.currentTask = nextTask;
      } else {
        // Create identical task for continuous idle gameplay
        const newTask = this.createIdenticalTask(task);
        newTask.startTime = now;
        queue.currentTask = newTask;
      }
      
      // Mark queue as updated
      queue.lastProcessed = new Date().toISOString();
      return true;
    }

    return false;
  }

  generateTaskRewards(task) {
    const rewards = [];

    switch (task.type) {
      case 'HARVESTING':
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

        // 10% chance for rare item
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

  async applyRewardsToCharacter(playerId, rewards) {
    try {
      // Get character
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAMES.CHARACTERS,
        Key: { userId: playerId },
      }));

      if (!result.Item) {
        console.warn(`⚠️ Character not found for player ${playerId}`);
        return;
      }

      // Calculate reward totals
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
          // TODO: Handle resource and item rewards
        }
      }

      // Update character if there are rewards to apply
      if (experienceGained > 0 || currencyGained > 0) {
        const updateExpression = [];
        const expressionAttributeValues = {};

        if (experienceGained > 0) {
          updateExpression.push('experience = experience + :exp');
          expressionAttributeValues[':exp'] = experienceGained;
        }

        if (currencyGained > 0) {
          updateExpression.push('currency = currency + :currency');
          expressionAttributeValues[':currency'] = currencyGained;
        }

        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAMES.CHARACTERS,
          Key: { userId: playerId },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeValues: expressionAttributeValues,
        }));

        console.log(`💰 Applied rewards to ${playerId}: ${experienceGained} exp, ${currencyGained} currency`);
      }

    } catch (error) {
      console.error(`❌ Error applying rewards to character ${playerId}:`, error);
    }
  }

  createIdenticalTask(originalTask) {
    return {
      ...originalTask,
      id: `${originalTask.type}-${Date.now()}`,
      startTime: 0, // Will be set when task starts
      completed: false,
      rewards: [],
    };
  }
}

// Initialize game engine
const gameEngine = new GameEngine();

/**
 * REST API Endpoints
 */

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeQueues: activeQueues.size,
    uptime: process.uptime(),
  });
});

// Get task queue status for a player
app.get('/task-queue/:playerId', (req, res) => {
  const { playerId } = req.params;
  const queue = activeQueues.get(playerId);

  if (!queue) {
    return res.status(404).json({ error: 'Task queue not found' });
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

  res.json({
    queue: {
      currentTask: queue.currentTask,
      queueLength: queue.queuedTasks.length,
      queuedTasks: queue.queuedTasks,
      isRunning: queue.isRunning,
      totalCompleted: queue.totalTasksCompleted,
    },
    currentProgress,
  });
});

// Sync task queue for a player
app.post('/task-queue/sync', async (req, res) => {
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  try {
    let queue = activeQueues.get(playerId);

    if (!queue) {
      // Try to load from database
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAMES.TASK_QUEUES,
        Key: { playerId },
      }));

      if (result.Item) {
        queue = result.Item;
        activeQueues.set(playerId, queue);
      } else {
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
        
        activeQueues.set(playerId, queue);
        
        // Save to database
        await docClient.send(new PutCommand({
          TableName: TABLE_NAMES.TASK_QUEUES,
          Item: queue,
        }));
      }
    }

    res.json({
      queue: {
        currentTask: queue.currentTask,
        queueLength: queue.queuedTasks.length,
        queuedTasks: queue.queuedTasks,
        isRunning: queue.isRunning,
        totalCompleted: queue.totalTasksCompleted,
      },
      message: 'Task queue synced successfully',
    });

  } catch (error) {
    console.error('Error syncing task queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add task to queue
app.post('/task-queue/add-task', async (req, res) => {
  const { playerId, task } = req.body;

  if (!playerId || !task) {
    return res.status(400).json({ error: 'playerId and task are required' });
  }

  try {
    let queue = activeQueues.get(playerId);

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
      activeQueues.set(playerId, queue);
    }

    // Add task to queue or start immediately
    if (!queue.currentTask) {
      task.startTime = Date.now();
      queue.currentTask = task;
      queue.isRunning = true;
    } else {
      queue.queuedTasks.push(task);
    }

    console.log(`📋 Added task ${task.name} for player ${playerId}`);

    res.json({
      message: 'Task added to queue successfully',
      taskId: task.id,
    });

  } catch (error) {
    console.error('Error adding task to queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stop all tasks for a player
app.post('/task-queue/stop-tasks', async (req, res) => {
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  const queue = activeQueues.get(playerId);

  if (!queue) {
    return res.status(404).json({ error: 'Task queue not found' });
  }

  // Clear all tasks
  queue.currentTask = null;
  queue.queuedTasks = [];
  queue.isRunning = false;

  console.log(`🛑 Stopped all tasks for player ${playerId}`);

  res.json({
    message: 'All tasks stopped successfully',
  });
});

/**
 * Server Startup and Shutdown
 */

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📡 Received SIGTERM, shutting down gracefully...');
  await gameEngine.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📡 Received SIGINT, shutting down gracefully...');
  await gameEngine.stop();
  process.exit(0);
});

// Start server
app.listen(port, async () => {
  console.log(`🚀 Steampunk Idle Game Server running on port ${port}`);
  
  // Start the game engine
  await gameEngine.start();
  
  console.log('🎮 Game Engine is now processing player queues continuously!');
});

module.exports = app;