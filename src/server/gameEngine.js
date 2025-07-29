/**
 * Steampunk Idle Game Engine
 * Runs continuously on ECS Fargate to process player task queues
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize Express app and HTTP server
const app = express();
const port = process.env.PORT || 3001;
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket connection management
const connectedClients = new Map(); // playerId -> WebSocket connection

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

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection established');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'authenticate' && data.playerId) {
        // Associate this connection with a player
        connectedClients.set(data.playerId, ws);
        console.log(`🔐 Player ${data.playerId} authenticated via WebSocket`);
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'authenticated',
          playerId: data.playerId,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    // Remove connection from active clients
    for (const [playerId, connection] of connectedClients.entries()) {
      if (connection === ws) {
        connectedClients.delete(playerId);
        console.log(`🔌 Player ${playerId} disconnected from WebSocket`);
        break;
      }
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

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
    const progress = Math.min(elapsed / task.duration, 1);
    
    // Send progress updates every 5 seconds or when task completes
    if (progress >= 1 || elapsed % 5000 < 1000) {
      await this.sendProgressNotification(queue.playerId, task, progress, elapsed);
    }
    
    // Check if task is completed
    if (elapsed >= task.duration) {
      console.log(`✅ Task completed: ${task.name} for player ${queue.playerId}`);
      
      // Generate rewards with enhanced calculation
      const rewards = this.generateTaskRewards(task);
      
      // Apply rewards to character with detailed tracking
      await this.applyRewardsToCharacter(queue.playerId, rewards);
      
      // Update task with completion data
      task.completed = true;
      task.rewards = rewards;
      task.progress = 1.0;
      task.completedAt = now;
      
      // Update queue stats with detailed metrics
      queue.totalTasksCompleted++;
      queue.totalTimeSpent += task.duration;
      queue.totalRewardsEarned = (queue.totalRewardsEarned || []).concat(rewards);
      
      // Calculate efficiency metrics
      queue.averageTaskDuration = queue.totalTimeSpent / queue.totalTasksCompleted;
      queue.taskCompletionRate = queue.totalTasksCompleted / (queue.totalTasksCompleted + (queue.queuedTasks.length || 0));
      queue.queueEfficiencyScore = this.calculateEfficiencyScore(queue);
      
      // Send comprehensive task completion notification
      await this.sendTaskCompletionNotification(queue.playerId, {
        task,
        rewards,
        queueStats: {
          totalCompleted: queue.totalTasksCompleted,
          averageDuration: queue.averageTaskDuration,
          completionRate: queue.taskCompletionRate,
          efficiencyScore: queue.queueEfficiencyScore
        }
      });
      
      // Start next task or create identical task for idle gameplay
      const nextTask = queue.queuedTasks.shift();
      if (nextTask) {
        nextTask.startTime = now;
        queue.currentTask = nextTask;
        
        // Send task started notification
        await this.sendTaskStartedNotification(queue.playerId, nextTask);
      } else {
        // Create identical task for continuous idle gameplay
        const newTask = this.createIdenticalTask(task);
        newTask.startTime = now;
        queue.currentTask = newTask;
        
        // Send task started notification for continuous task
        await this.sendTaskStartedNotification(queue.playerId, newTask);
      }
      
      // Mark queue as updated
      queue.lastProcessed = new Date().toISOString();
      queue.lastUpdated = now;
      
      return true;
    }

    return false;
  }

  calculateEfficiencyScore(queue) {
    // Base score starts at 50%
    let score = 0.5;
    
    // Bonus for having tasks queued (shows planning)
    if (queue.queuedTasks && queue.queuedTasks.length > 0) {
      score += 0.2;
    }
    
    // Bonus for consistent task completion
    if (queue.totalTasksCompleted > 10) {
      score += 0.1;
    }
    
    // Bonus for high completion rate
    if (queue.taskCompletionRate > 0.8) {
      score += 0.1;
    }
    
    // Penalty for very long average task duration (over 10 minutes)
    if (queue.averageTaskDuration > 600000) {
      score -= 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  async sendProgressNotification(playerId, task, progress, elapsed) {
    try {
      const notification = {
        type: 'task_progress',
        playerId,
        taskId: task.id,
        data: {
          progress,
          timeRemaining: Math.max(task.duration - elapsed, 0),
          isComplete: progress >= 1,
          taskName: task.name,
          taskType: task.type
        },
        timestamp: Date.now()
      };

      // Send via WebSocket if client is connected
      const client = connectedClients.get(playerId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(notification));
      }
      
      console.log(`📊 Progress update for ${playerId}: ${task.name} ${Math.floor(progress * 100)}%`);
      
    } catch (error) {
      console.error(`❌ Error sending progress notification:`, error);
    }
  }

  async sendTaskCompletionNotification(playerId, completionData) {
    try {
      const notification = {
        type: 'task_completed',
        playerId,
        taskId: completionData.task.id,
        data: {
          task: {
            id: completionData.task.id,
            name: completionData.task.name,
            type: completionData.task.type,
            duration: completionData.task.duration,
            completed: true
          },
          rewards: completionData.rewards,
          queueStats: completionData.queueStats,
          rewardSummary: this.summarizeRewards(completionData.rewards)
        },
        timestamp: Date.now()
      };

      // Send via WebSocket if client is connected
      const client = connectedClients.get(playerId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(notification));
      }

      console.log(`🎉 Task completed for ${playerId}: ${completionData.task.name} - ${notification.data.rewardSummary}`);
      
    } catch (error) {
      console.error(`❌ Error sending task completion notification:`, error);
    }
  }

  async sendTaskStartedNotification(playerId, task) {
    try {
      const notification = {
        type: 'task_started',
        playerId,
        taskId: task.id,
        data: {
          task: {
            id: task.id,
            name: task.name,
            type: task.type,
            duration: task.duration,
            estimatedCompletion: task.startTime + task.duration
          }
        },
        timestamp: Date.now()
      };

      // Send via WebSocket if client is connected
      const client = connectedClients.get(playerId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(notification));
      }

      console.log(`🚀 Task started for ${playerId}: ${task.name} (${task.duration / 1000}s)`);
      
    } catch (error) {
      console.error(`❌ Error sending task started notification:`, error);
    }
  }

  summarizeRewards(rewards) {
    const summary = [];
    let exp = 0, currency = 0, resources = 0, items = 0;

    rewards.forEach(reward => {
      switch (reward.type) {
        case 'experience':
          exp += reward.quantity;
          break;
        case 'currency':
          currency += reward.quantity;
          break;
        case 'resource':
          resources += reward.quantity;
          break;
        case 'item':
          items += reward.quantity;
          break;
      }
    });

    if (exp > 0) summary.push(`${exp} exp`);
    if (currency > 0) summary.push(`${currency} currency`);
    if (resources > 0) summary.push(`${resources} resources`);
    if (items > 0) summary.push(`${items} items`);

    return summary.join(', ') || 'No rewards';
  }

  generateTaskRewards(task) {
    const rewards = [];
    const playerLevel = task.playerLevel || 1;
    const baseRewardMultiplier = 1 + (playerLevel * 0.05); // 5% bonus per level

    switch (task.type) {
      case 'HARVESTING':
        // Enhanced harvesting rewards with predictable primary materials
        const harvestingData = task.activityData || {};
        const activity = harvestingData.activity || {};
        const playerStats = harvestingData.playerStats || {};
        const tools = harvestingData.tools || [];
        const location = harvestingData.location || {};

        // Calculate tool bonuses
        const toolBonus = tools.reduce((bonus, tool) => {
          return bonus + tool.bonuses.reduce((toolBonus, b) => toolBonus + (b.type === 'yield' ? b.value : 0), 0);
        }, 0);

        // Calculate skill bonus
        const relevantSkill = this.getSkillForCategory(activity.category || 'metallurgical');
        const skillBonus = (playerStats.harvestingSkills && playerStats.harvestingSkills[relevantSkill]) || 0;
        const locationBonus = (location.bonusModifiers && location.bonusModifiers.yield) || 0;

        const totalEfficiency = 1 + (toolBonus * 0.01) + (skillBonus * 0.02) + (locationBonus * 0.01);

        // Guaranteed primary material (requirement 17.1)
        const primaryResource = activity.primaryResource || 'copper_ore';
        const baseYield = Math.max(1, activity.baseYield || 2);
        const primaryQuantity = Math.floor(baseYield * totalEfficiency * baseRewardMultiplier);

        rewards.push({
          type: 'resource',
          itemId: primaryResource,
          quantity: Math.max(1, primaryQuantity), // Always at least 1
          rarity: 'common',
          isRare: false,
        });

        // Experience reward
        const baseExp = 25 * baseRewardMultiplier * totalEfficiency;
        rewards.push({
          type: 'experience',
          quantity: Math.floor(baseExp),
        });

        // Exotic item discovery with <1% base chance (requirement 17.2)
        const baseExoticChance = 0.008; // 0.8% base chance
        const skillExoticBonus = skillBonus * 0.0001; // Slight increase with skill
        const exoticChance = Math.min(baseExoticChance + skillExoticBonus, 0.02); // Cap at 2%

        if (Math.random() < exoticChance) {
          const exoticResource = activity.rareResource || this.getExoticItemForCategory(activity.category);
          rewards.push({
            type: 'resource',
            itemId: exoticResource,
            quantity: 1,
            rarity: 'rare',
            isRare: true,
          });
        }
        break;

      case 'COMBAT':
        const combatData = task.activityData || {};
        const enemy = combatData.enemy || {};
        const combatStats = combatData.playerStats || {};
        const equipment = combatData.equipment || [];

        // Calculate combat effectiveness
        const levelAdvantage = Math.max(0, playerLevel - (enemy.level || 1)) * 0.1;
        const equipmentBonus = equipment.reduce((bonus, eq) => {
          return bonus + ((eq.stats && eq.stats.attack) || 0) + ((eq.stats && eq.stats.defense) || 0);
        }, 0) * 0.01;

        const winProbability = Math.min(0.5 + levelAdvantage + equipmentBonus, 0.9);
        const experienceMultiplier = (enemy.level || 1) * 0.15;

        // Experience reward
        const combatExp = 35 * baseRewardMultiplier * experienceMultiplier;
        rewards.push({
          type: 'experience',
          quantity: Math.floor(combatExp),
        });

        // Combat success rewards
        if (Math.random() < winProbability) {
          // Currency reward
          const currencyReward = Math.floor(15 * baseRewardMultiplier * (1 + levelAdvantage));
          rewards.push({
            type: 'currency',
            quantity: currencyReward,
          });

          // Loot drops
          if (Math.random() < 0.3) {
            const loot = (enemy.lootTable && enemy.lootTable[0]) || { itemId: 'combat_trophy', quantity: 1, rarity: 'common' };
            rewards.push({
              type: 'item',
              itemId: loot.itemId,
              quantity: loot.quantity,
              rarity: loot.rarity || 'common',
              isRare: loot.rarity === 'rare' || loot.rarity === 'epic' || loot.rarity === 'legendary',
            });
          }
        }
        break;

      case 'CRAFTING':
        const craftingData = task.activityData || {};
        const recipe = craftingData.recipe || {};
        const craftingStation = craftingData.craftingStation || {};
        const playerSkillLevel = craftingData.playerSkillLevel || 1;

        // Calculate crafting success rate and quality
        const craftingSkillBonus = playerSkillLevel * 0.02;
        const stationBonus = (craftingStation.bonuses && craftingStation.bonuses.reduce((bonus, b) => {
          return bonus + (b.type === 'quality' ? b.value : 0);
        }, 0)) || 0;

        const successRate = Math.min(0.7 + craftingSkillBonus + (stationBonus * 0.01), 0.95);
        const qualityBonus = craftingSkillBonus + (stationBonus * 0.01);

        // Experience reward
        const craftingExp = 30 * baseRewardMultiplier * ((recipe.requiredLevel || 1) * 0.1);
        rewards.push({
          type: 'experience',
          quantity: Math.floor(craftingExp),
        });

        // Crafted item reward (if successful)
        if (Math.random() < successRate) {
          const expectedOutputs = craftingData.expectedOutputs || [{ itemId: 'clockwork_gear', quantity: 1 }];
          expectedOutputs.forEach(output => {
            const quality = qualityBonus > 0.5 ? 'uncommon' : 'common';
            rewards.push({
              type: 'item',
              itemId: output.itemId,
              quantity: output.quantity,
              rarity: quality,
              isRare: quality !== 'common',
            });
          });
        }
        break;
    }

    return rewards;
  }

  getSkillForCategory(category) {
    switch (category) {
      case 'metallurgical':
      case 'mechanical':
        return 'mining';
      case 'botanical':
      case 'alchemical':
        return 'foraging';
      case 'archaeological':
        return 'salvaging';
      case 'electrical':
      case 'aeronautical':
        return 'crystal_extraction';
      default:
        return 'mining';
    }
  }

  getExoticItemForCategory(category) {
    const exoticItems = {
      'metallurgical': ['adamantine_shard', 'mithril_nugget', 'steam_infused_ore'],
      'botanical': ['ethereal_bloom', 'time_moss', 'crystal_fruit'],
      'archaeological': ['ancient_gear', 'temporal_artifact', 'lost_blueprint'],
      'electrical': ['lightning_crystal', 'storm_essence', 'charged_coil'],
      'aeronautical': ['sky_metal', 'wind_crystal', 'floating_stone'],
      'mechanical': ['precision_spring', 'master_gear', 'steam_core'],
      'alchemical': ['philosophers_stone', 'transmutation_catalyst', 'essence_of_steam'],
      'literary': ['forbidden_knowledge', 'ancient_formula', 'steam_cipher']
    };

    const items = exoticItems[category] || exoticItems['metallurgical'];
    return items[Math.floor(Math.random() * items.length)];
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

      const character = result.Item;

      // Calculate reward totals and organize by type
      let experienceGained = 0;
      let currencyGained = 0;
      const resourcesGained = {};
      const itemsGained = {};

      for (const reward of rewards) {
        switch (reward.type) {
          case 'experience':
            experienceGained += reward.quantity;
            break;
          case 'currency':
            currencyGained += reward.quantity;
            break;
          case 'resource':
            resourcesGained[reward.itemId] = (resourcesGained[reward.itemId] || 0) + reward.quantity;
            break;
          case 'item':
            itemsGained[reward.itemId] = (itemsGained[reward.itemId] || 0) + reward.quantity;
            break;
        }
      }

      // Prepare update expression
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      // Handle experience and level progression
      if (experienceGained > 0) {
        const currentExp = character.experience || 0;
        const currentLevel = character.level || 1;
        const newExp = currentExp + experienceGained;
        
        // Calculate new level (simple formula: level = floor(sqrt(exp/100)) + 1)
        const newLevel = Math.floor(Math.sqrt(newExp / 100)) + 1;
        const leveledUp = newLevel > currentLevel;

        updateExpression.push('experience = :exp');
        expressionAttributeValues[':exp'] = newExp;

        if (leveledUp) {
          updateExpression.push('#level = :level');
          expressionAttributeNames['#level'] = 'level';
          expressionAttributeValues[':level'] = newLevel;
          console.log(`🎉 Player ${playerId} leveled up! ${currentLevel} → ${newLevel}`);
        }
      }

      // Handle currency
      if (currencyGained > 0) {
        updateExpression.push('currency = if_not_exists(currency, :zero) + :currency');
        expressionAttributeValues[':currency'] = currencyGained;
        expressionAttributeValues[':zero'] = 0;
      }

      // Handle inventory updates for resources and items
      const inventoryUpdates = { ...resourcesGained, ...itemsGained };
      if (Object.keys(inventoryUpdates).length > 0) {
        for (const [itemId, quantity] of Object.entries(inventoryUpdates)) {
          const inventoryKey = `inventory.${itemId}`;
          updateExpression.push(`${inventoryKey} = if_not_exists(${inventoryKey}, :zero) + :${itemId}_qty`);
          expressionAttributeValues[`:${itemId}_qty`] = quantity;
        }
        
        if (!expressionAttributeValues[':zero']) {
          expressionAttributeValues[':zero'] = 0;
        }
      }

      // Update character stats based on activity type
      const lastTask = character.lastCompletedTask;
      if (lastTask) {
        switch (lastTask.type) {
          case 'HARVESTING':
            // Increase harvesting skill
            const harvestingSkill = this.getSkillForCategory(lastTask.activityData?.activity?.category);
            const skillPath = `stats.harvestingSkills.${harvestingSkill}`;
            updateExpression.push(`${skillPath} = if_not_exists(${skillPath}, :zero) + :skill_gain`);
            expressionAttributeValues[':skill_gain'] = Math.floor(experienceGained * 0.1); // 10% of exp as skill
            break;
          case 'COMBAT':
            // Increase combat skills
            updateExpression.push('stats.combatSkills.melee = if_not_exists(stats.combatSkills.melee, :zero) + :combat_skill');
            expressionAttributeValues[':combat_skill'] = Math.floor(experienceGained * 0.08);
            break;
          case 'CRAFTING':
            // Increase crafting skills
            const craftingSkill = lastTask.activityData?.recipe?.skill || 'clockmaking';
            const craftingPath = `stats.craftingSkills.${craftingSkill}`;
            updateExpression.push(`${craftingPath} = if_not_exists(${craftingPath}, :zero) + :crafting_skill`);
            expressionAttributeValues[':crafting_skill'] = Math.floor(experienceGained * 0.12);
            break;
        }
      }

      // Update last activity timestamp
      updateExpression.push('lastActiveAt = :timestamp');
      expressionAttributeValues[':timestamp'] = new Date().toISOString();

      // Execute the update if there are changes to apply
      if (updateExpression.length > 0) {
        const updateParams = {
          TableName: TABLE_NAMES.CHARACTERS,
          Key: { userId: playerId },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeValues: expressionAttributeValues,
        };

        if (Object.keys(expressionAttributeNames).length > 0) {
          updateParams.ExpressionAttributeNames = expressionAttributeNames;
        }

        await docClient.send(new UpdateCommand(updateParams));

        // Log detailed reward application
        const rewardSummary = [];
        if (experienceGained > 0) rewardSummary.push(`${experienceGained} exp`);
        if (currencyGained > 0) rewardSummary.push(`${currencyGained} currency`);
        if (Object.keys(resourcesGained).length > 0) {
          rewardSummary.push(`resources: ${JSON.stringify(resourcesGained)}`);
        }
        if (Object.keys(itemsGained).length > 0) {
          rewardSummary.push(`items: ${JSON.stringify(itemsGained)}`);
        }

        console.log(`💰 Applied rewards to ${playerId}: ${rewardSummary.join(', ')}`);
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

// Health check with enhanced metrics
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeQueues: activeQueues.size,
    connectedClients: connectedClients.size,
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    gameEngine: {
      isRunning: gameEngine.isRunning,
      totalTasksProcessed: Array.from(activeQueues.values()).reduce((total, queue) => total + (queue.totalTasksCompleted || 0), 0),
    }
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

// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    activeQueues: activeQueues.size,
    connectedClients: connectedClients.size,
    totalTasksCompleted: Array.from(activeQueues.values()).reduce((total, queue) => total + (queue.totalTasksCompleted || 0), 0),
    averageQueueLength: activeQueues.size > 0 ? 
      Array.from(activeQueues.values()).reduce((total, queue) => total + (queue.queuedTasks?.length || 0), 0) / activeQueues.size : 0,
    systemHealth: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
    gameEngineStatus: {
      isRunning: gameEngine.isRunning,
      processingInterval: gameEngine.processingInterval ? 'active' : 'inactive',
    }
  };

  res.json(metrics);
});

/**
 * Server Startup and Shutdown
 */

// Enhanced graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`📡 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Stop accepting new connections
    server.close(() => {
      console.log('🔌 HTTP server closed');
    });
    
    // Close all WebSocket connections
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutting down');
      }
    });
    console.log('🔌 All WebSocket connections closed');
    
    // Stop the game engine
    await gameEngine.stop();
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(port, async () => {
    console.log(`🚀 Steampunk Idle Game Server running on port ${port}`);
    console.log(`🔌 WebSocket server ready for real-time notifications`);
    
    // Start the game engine
    await gameEngine.start();
    
    console.log('🎮 Game Engine is now processing player queues continuously!');
  });
}

module.exports = { app, server, wss, GameEngine, gameEngine };