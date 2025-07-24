/**
 * Enhanced Server-side task queue processor
 * This Lambda function runs continuously to process player task queues
 * with multi-activity support and real-time notifications
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { 
  Task, 
  TaskQueue, 
  TaskReward, 
  TaskCompletionResult, 
  TaskType,
  HarvestingTaskData,
  CraftingTaskData,
  CombatTaskData,
  TaskProgress
} from '../../types/taskQueue';
import { CharacterStats } from '../../types/character';
import { createHash } from 'crypto';

// Helper function to generate a checksum for queue integrity
function generateChecksum(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}
import { HarvestingActivity } from '../../types/harvesting';
import { CraftingRecipe } from '../../types/crafting';
import { Enemy } from '../../types/combat';
import { WebSocketNotificationService } from './websocketNotificationService';

// Enhanced task processor with multi-activity support
interface TaskProcessorEngine {
  processTask(task: Task): Promise<TaskCompletionResult>;
  calculateRewards(task: Task, playerStats: CharacterStats, playerLevel?: number): Promise<TaskReward[]>;
  validateTaskExecution(task: Task): Promise<boolean>;
  notifyTaskCompletion(playerId: string, result: TaskCompletionResult): Promise<void>;
}

// WebSocket notification interface
interface TaskNotificationPayload {
  type: 'task_started' | 'task_progress' | 'task_completed' | 'task_failed' | 'queue_updated';
  playerId: string;
  taskId?: string;
  data: any;
  timestamp: number;
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
 * Enhanced task processor with multi-activity support
 */
class EnhancedTaskProcessor implements TaskProcessorEngine {
  
  async processTask(task: Task): Promise<TaskCompletionResult> {
    console.log(`Processing ${task.type} task ${task.id} for player ${task.playerId}`);
    
    // Validate task execution
    const isValid = await this.validateTaskExecution(task);
    if (!isValid) {
      throw new Error(`Task ${task.id} failed validation`);
    }
    
    // Get player stats for reward calculation
    const playerStats = await this.getPlayerStats(task.playerId);
    const playerLevel = await this.getPlayerLevel(task.playerId);
    
    // Execute activity-specific logic
    const executionResult = await this.executeActivityLogic(task, playerStats);
    
    // Calculate rewards based on execution result
    const rewards = await this.calculateRewards(task, playerStats, playerLevel);
    
    // Update task completion
    task.completed = true;
    task.rewards = rewards;
    task.progress = 1.0;
    
    // Apply rewards to character
    await this.applyRewardsToCharacter(task.playerId, rewards);
    
    // Get next task in queue
    const nextTask = await this.getNextQueuedTask(task.playerId);
    
    const result: TaskCompletionResult = {
      task,
      rewards,
      nextTask
    };
    
    // Send completion notification
    await this.notifyTaskCompletion(task.playerId, result);
    
    return result;
  }
  
  async validateTaskExecution(task: Task): Promise<boolean> {
    try {
      // Check if player still exists
      const character = await DatabaseService.getItem({
        TableName: TABLE_NAMES.CHARACTERS,
        Key: { userId: task.playerId }
      });
      
      if (!character) {
        console.warn(`Character not found for task ${task.id}`);
        return false;
      }
      
      // Activity-specific validation
      switch (task.type) {
        case TaskType.HARVESTING:
          return await this.validateHarvestingTask(task, character);
        case TaskType.CRAFTING:
          return await this.validateCraftingTask(task, character);
        case TaskType.COMBAT:
          return await this.validateCombatTask(task, character);
        default:
          console.warn(`Unknown task type: ${task.type}`);
          return false;
      }
    } catch (error) {
      console.error(`Error validating task ${task.id}:`, error);
      return false;
    }
  }
  
  async executeActivityLogic(task: Task, playerStats: CharacterStats): Promise<any> {
    switch (task.type) {
      case TaskType.HARVESTING:
        return await this.executeHarvestingLogic(task as Task & { activityData: HarvestingTaskData }, playerStats);
      case TaskType.CRAFTING:
        return await this.executeCraftingLogic(task as Task & { activityData: CraftingTaskData }, playerStats);
      case TaskType.COMBAT:
        return await this.executeCombatLogic(task as Task & { activityData: CombatTaskData }, playerStats);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }
  
  async calculateRewards(task: Task, playerStats: CharacterStats, playerLevel: number = 1): Promise<TaskReward[]> {
    const rewards: TaskReward[] = [];
    const baseRewardMultiplier = 1 + (playerLevel * 0.05); // 5% bonus per level
    
    switch (task.type) {
      case TaskType.HARVESTING:
        rewards.push(...await this.calculateHarvestingRewards(task, playerStats, baseRewardMultiplier));
        break;
      case TaskType.CRAFTING:
        rewards.push(...await this.calculateCraftingRewards(task, playerStats, baseRewardMultiplier));
        break;
      case TaskType.COMBAT:
        rewards.push(...await this.calculateCombatRewards(task, playerStats, baseRewardMultiplier));
        break;
    }
    
    return rewards;
  }
  
  async notifyTaskCompletion(playerId: string, result: TaskCompletionResult): Promise<void> {
    const notification: TaskNotificationPayload = {
      type: 'task_completed',
      playerId,
      taskId: result.task.id,
      data: {
        task: result.task,
        rewards: result.rewards,
        nextTask: result.nextTask
      },
      timestamp: Date.now()
    };
    
    // Send WebSocket notification
    await this.sendWebSocketNotification(notification);
    
    // Log completion
    console.log(`Task ${result.task.id} completed for player ${playerId} with ${result.rewards.length} rewards`);
  }
  
  // Activity-specific execution methods
  private async executeHarvestingLogic(task: Task & { activityData: HarvestingTaskData }, playerStats: CharacterStats): Promise<any> {
    const { activity, tools, location } = task.activityData;
    
    // Calculate harvesting efficiency based on tools and player stats
    const toolBonus = tools.reduce((bonus, tool) => {
      return bonus + tool.bonuses.reduce((toolBonus, b) => toolBonus + (b.type === 'yield' ? b.value : 0), 0);
    }, 0);
    
    // Map harvesting category to skill
    const getSkillForCategory = (category: string): keyof CharacterStats['harvestingSkills'] => {
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
    };
    
    const relevantSkill = getSkillForCategory(activity.category);
    const skillBonus = playerStats.harvestingSkills?.[relevantSkill] || 0;
    const locationBonus = location?.bonusModifiers?.yield || 0;
    
    const totalEfficiency = 1 + (toolBonus * 0.01) + (skillBonus * 0.02) + (locationBonus * 0.01);
    
    // Calculate base yield from drop table
    const baseYield = activity.dropTable.guaranteed.length + 
                     activity.dropTable.common.length + 
                     activity.dropTable.uncommon.length;
    
    return {
      efficiency: totalEfficiency,
      baseYield: Math.max(1, baseYield), // Ensure at least 1 item
      rareChance: Math.min(0.1 + (skillBonus * 0.001), 0.3) // Max 30% rare chance
    };
  }
  
  private async executeCraftingLogic(task: Task & { activityData: CraftingTaskData }, playerStats: CharacterStats): Promise<any> {
    const { recipe, materials, craftingStation, playerSkillLevel } = task.activityData;
    
    // Calculate crafting success rate and quality
    const skillBonus = playerSkillLevel * 0.02;
    const stationBonus = craftingStation?.bonuses.reduce((bonus, b) => {
      return bonus + (b.type === 'quality' ? b.value : 0);
    }, 0) || 0;
    
    const successRate = Math.min(0.7 + skillBonus + (stationBonus * 0.01), 0.95); // Max 95% success
    const qualityBonus = skillBonus + (stationBonus * 0.01);
    
    return {
      successRate,
      qualityBonus,
      materialEfficiency: 1 + (skillBonus * 0.5), // Better skills use fewer materials
      experienceMultiplier: recipe.requiredLevel * 0.1
    };
  }
  
  private async executeCombatLogic(task: Task & { activityData: CombatTaskData }, playerStats: CharacterStats): Promise<any> {
    const { enemy, playerLevel, playerStats: combatStats, equipment } = task.activityData;
    
    // Calculate combat effectiveness
    const levelAdvantage = Math.max(0, playerLevel - enemy.level) * 0.1;
    const equipmentBonus = equipment.reduce((bonus, eq) => {
      return bonus + (eq.stats.attack || 0) + (eq.stats.defense || 0);
    }, 0) * 0.01;
    
    const winProbability = Math.min(0.5 + levelAdvantage + equipmentBonus, 0.9); // Max 90% win rate
    const experienceMultiplier = enemy.level * 0.15;
    
    return {
      winProbability,
      experienceMultiplier,
      lootMultiplier: 1 + (enemy.level > 10 ? 0.5 : enemy.level > 20 ? 1.0 : 0),
      damageDealt: combatStats.attack + (equipmentBonus * 10)
    };
  }
  
  // Reward calculation methods
  private async calculateHarvestingRewards(task: Task, playerStats: CharacterStats, multiplier: number): Promise<TaskReward[]> {
    const rewards: TaskReward[] = [];
    const harvestingData = task.activityData as HarvestingTaskData;
    const executionResult = await this.executeHarvestingLogic(task as any, playerStats);
    
    // Base experience reward
    const baseExp = 25 * multiplier * executionResult.efficiency;
    rewards.push({
      type: 'experience',
      quantity: Math.floor(baseExp),
    });
    
    // Resource rewards based on activity
    const resourceQuantity = Math.floor(executionResult.baseYield * executionResult.efficiency * (1 + Math.random() * 0.5));
    // Get primary resource from guaranteed drops or first common drop
    const primaryResource = harvestingData.activity.dropTable.guaranteed[0]?.itemId || 
                           harvestingData.activity.dropTable.common[0]?.itemId || 
                           'generic_material';
    
    rewards.push({
      type: 'resource',
      itemId: primaryResource,
      quantity: resourceQuantity,
      rarity: 'common'
    });
    
    // Rare resource chance
    if (Math.random() < executionResult.rareChance) {
      const rareResource = harvestingData.activity.dropTable.rare[0]?.itemId || 
                          harvestingData.activity.dropTable.uncommon[0]?.itemId || 
                          'steam_crystal';
      
      rewards.push({
        type: 'resource',
        itemId: rareResource,
        quantity: 1,
        rarity: 'rare',
        isRare: true
      });
    }
    
    return rewards;
  }
  
  private async calculateCraftingRewards(task: Task, playerStats: CharacterStats, multiplier: number): Promise<TaskReward[]> {
    const rewards: TaskReward[] = [];
    const craftingData = task.activityData as CraftingTaskData;
    const executionResult = await this.executeCraftingLogic(task as any, playerStats);
    
    // Experience reward based on recipe difficulty
    const baseExp = 30 * multiplier * executionResult.experienceMultiplier;
    rewards.push({
      type: 'experience',
      quantity: Math.floor(baseExp),
    });
    
    // Crafted item reward (if successful)
    if (Math.random() < executionResult.successRate) {
      craftingData.expectedOutputs.forEach(output => {
        const quality = executionResult.qualityBonus > 0.5 ? 'uncommon' : 'common';
        rewards.push({
          type: 'item',
          itemId: output.itemId,
          quantity: output.quantity,
          rarity: quality
        });
      });
    }
    
    return rewards;
  }
  
  private async calculateCombatRewards(task: Task, playerStats: CharacterStats, multiplier: number): Promise<TaskReward[]> {
    const rewards: TaskReward[] = [];
    const combatData = task.activityData as CombatTaskData;
    const executionResult = await this.executeCombatLogic(task as any, playerStats);
    
    // Experience reward
    const baseExp = 35 * multiplier * executionResult.experienceMultiplier;
    rewards.push({
      type: 'experience',
      quantity: Math.floor(baseExp),
    });
    
    // Combat success rewards
    if (Math.random() < executionResult.winProbability) {
      // Currency reward
      const currencyReward = Math.floor(15 * multiplier * executionResult.lootMultiplier);
      rewards.push({
        type: 'currency',
        quantity: currencyReward,
      });
      
      // Loot drops
      if (Math.random() < 0.3 * executionResult.lootMultiplier) {
        const loot = combatData.enemy.lootTable?.[0];
        rewards.push({
          type: 'item',
          itemId: loot?.itemId || 'combat_trophy',
          quantity: loot?.quantity || 1,
          rarity: loot?.rarity || 'common'
        });
      }
    }
    
    return rewards;
  }
  
  // Helper methods
  private async getPlayerStats(playerId: string): Promise<CharacterStats> {
    const character = await DatabaseService.getItem({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: playerId }
    });
    
    return character?.stats || {
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      vitality: 10,
      craftingSkills: {},
      harvestingSkills: {},
      combatSkills: {}
    };
  }
  
  private async getPlayerLevel(playerId: string): Promise<number> {
    const character = await DatabaseService.getItem({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: playerId }
    });
    
    return character?.level || 1;
  }
  
  private async getNextQueuedTask(playerId: string): Promise<Task | null> {
    const queue = await DatabaseService.getItem<TaskQueue>({
      TableName: TABLE_NAMES.TASK_QUEUES,
      Key: { playerId }
    });
    
    return queue?.queuedTasks[0] || null;
  }
  
  private async applyRewardsToCharacter(playerId: string, rewards: TaskReward[]): Promise<void> {
    try {
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
  
  private async sendWebSocketNotification(notification: TaskNotificationPayload): Promise<void> {
    try {
      const wsService = new WebSocketNotificationService();
      await wsService.sendToPlayer(notification.playerId, notification);
    } catch (error) {
      console.error('Error sending WebSocket notification:', error);
    }
  }
  
  // Validation methods
  private async validateHarvestingTask(task: Task, character: any): Promise<boolean> {
    const harvestingData = task.activityData as HarvestingTaskData;
    
    // Check if player has required tools
    if (harvestingData.tools.length === 0) {
      console.warn(`No tools available for harvesting task ${task.id}`);
      return false;
    }
    
    // Check location requirements if specified
    if (harvestingData.location) {
      for (const req of harvestingData.location.requirements) {
        if (!req.isMet) {
          console.warn(`Location requirement not met for task ${task.id}: ${req.description}`);
          return false;
        }
      }
    }
    
    return true;
  }
  
  private async validateCraftingTask(task: Task, character: any): Promise<boolean> {
    const craftingData = task.activityData as CraftingTaskData;
    
    // Check if player has required materials
    for (const material of craftingData.materials) {
      // In a real implementation, check inventory
      console.log(`Checking material: ${material.name}`);
    }
    
    // Check crafting station requirements
    if (craftingData.craftingStation) {
      for (const req of craftingData.craftingStation.requirements) {
        if (!req.isMet) {
          console.warn(`Crafting station requirement not met for task ${task.id}: ${req.description}`);
          return false;
        }
      }
    }
    
    return true;
  }
  
  private async validateCombatTask(task: Task, character: any): Promise<boolean> {
    const combatData = task.activityData as CombatTaskData;
    
    // Check level requirements
    if (character.level < combatData.enemy.level - 5) { // Allow 5 level difference
      console.warn(`Player level too low for combat task ${task.id}`);
      return false;
    }
    
    // Check equipment durability
    for (const equipment of combatData.equipment) {
      if (equipment.durability <= 0) {
        console.warn(`Equipment ${equipment.name} is broken for task ${task.id}`);
        return false;
      }
    }
    
    return true;
  }
}

/**
 * Process a single task queue with enhanced multi-activity support
 */
async function processTaskQueue(queue: TaskQueue): Promise<TaskQueue> {
  const now = Date.now();
  let updated = false;
  const processor = new EnhancedTaskProcessor();

  // Process current task if it exists
  if (queue.currentTask && queue.isRunning) {
    const task = queue.currentTask;
    const elapsed = now - task.startTime;
    
    // Send progress updates
    if (elapsed > 0) {
      const progress = Math.min(elapsed / task.duration, 1);
      await sendProgressUpdate(queue.playerId, task.id, progress, task.duration - elapsed);
    }
    
    // Check if task is completed
    if (elapsed >= task.duration) {
      console.log(`Task ${task.id} completed for player ${queue.playerId}`);
      
      try {
        // Process task completion with enhanced logic
        const result = await processor.processTask(task);
        
        // Update queue stats
        queue.totalTasksCompleted++;
        queue.totalTimeSpent += task.duration;
        
        // Start next task
        const nextTask = queue.queuedTasks.shift();
        if (nextTask) {
          nextTask.startTime = now;
          queue.currentTask = nextTask;
          
          // Notify task started
          await sendTaskStartedNotification(queue.playerId, nextTask);
        } else {
          queue.currentTask = null;
          queue.isRunning = false;
        }
        
        updated = true;
        
      } catch (error) {
        console.error(`Error processing task ${task.id}:`, error);
        
        // Handle task failure
        task.retryCount = (task.retryCount || 0) + 1;
        if (task.retryCount < task.maxRetries) {
          // Retry task
          task.startTime = now;
          console.log(`Retrying task ${task.id}, attempt ${task.retryCount}`);
        } else {
          // Skip failed task and move to next
          console.log(`Task ${task.id} failed after ${task.retryCount} retries, skipping`);
          const nextTask = queue.queuedTasks.shift();
          if (nextTask) {
            nextTask.startTime = now;
            queue.currentTask = nextTask;
          } else {
            queue.currentTask = null;
            queue.isRunning = false;
          }
          updated = true;
        }
      }
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
    
    // Send queue update notification
    await sendQueueUpdateNotification(queue.playerId, queue);
  }

  return queue;
}

/**
 * Send progress update notification
 */
async function sendProgressUpdate(playerId: string, taskId: string, progress: number, timeRemaining: number): Promise<void> {
  const notification: TaskNotificationPayload = {
    type: 'task_progress',
    playerId,
    taskId,
    data: {
      progress,
      timeRemaining,
      isComplete: progress >= 1
    },
    timestamp: Date.now()
  };
  
  const wsService = new WebSocketNotificationService();
  await wsService.sendToPlayer(playerId, notification);
}

/**
 * Send task started notification
 */
async function sendTaskStartedNotification(playerId: string, task: Task): Promise<void> {
  const notification: TaskNotificationPayload = {
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
  
  const wsService = new WebSocketNotificationService();
  await wsService.sendToPlayer(playerId, notification);
}

/**
 * Send queue update notification
 */
async function sendQueueUpdateNotification(playerId: string, queue: TaskQueue): Promise<void> {
  const notification: TaskNotificationPayload = {
    type: 'queue_updated',
    playerId,
    data: {
      currentTask: queue.currentTask,
      queueLength: queue.queuedTasks.length,
      isRunning: queue.isRunning,
      totalCompleted: queue.totalTasksCompleted
    },
    timestamp: Date.now()
  };
  
  const wsService = new WebSocketNotificationService();
  await wsService.sendToPlayer(playerId, notification);
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
      const now = Date.now();
      // Create new queue if it doesn't exist
      queue = {
        playerId,
        currentTask: null,
        queuedTasks: [],
        isRunning: false,
        isPaused: false,
        pauseReason: undefined,
        canResume: true,
        totalTasksCompleted: 0,
        totalTimeSpent: 0,
        totalRewardsEarned: [],
        averageTaskDuration: 0,
        taskCompletionRate: 0,
        queueEfficiencyScore: 0,
        totalPauseTime: 0,
        config: {
          maxQueueSize: 50,
          maxTaskDuration: 86400000, // 24 hours in milliseconds
          maxTotalQueueDuration: 604800000, // 7 days in milliseconds
          autoStart: true,
          priorityHandling: true,
          retryEnabled: true,
          maxRetries: 3,
          validationEnabled: true,
          syncInterval: 5000,
          offlineProcessingEnabled: true,
          pauseOnError: true,
          resumeOnResourceAvailable: true,
          persistenceInterval: 60000, // 1 minute in milliseconds
          integrityCheckInterval: 300000, // 5 minutes in milliseconds
          maxHistorySize: 100
        },
        lastProcessed: new Date().toISOString(),
        lastSaved: now,
        lastUpdated: now,
        lastSynced: now,
        createdAt: now,
        version: 1,
        checksum: generateChecksum(playerId + now),
        lastValidated: now,
        stateHistory: [],
        maxHistorySize: 10
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
      const now = Date.now();
      // Create new queue
      queue = {
        playerId,
        currentTask: null,
        queuedTasks: [],
        isRunning: false,
        isPaused: false,
        pauseReason: undefined,
        canResume: true,
        totalTasksCompleted: 0,
        totalTimeSpent: 0,
        totalRewardsEarned: [],
        averageTaskDuration: 0,
        taskCompletionRate: 0,
        queueEfficiencyScore: 0,
        totalPauseTime: 0,
        config: {
          maxQueueSize: 50,
          maxTaskDuration: 86400000, // 24 hours in milliseconds
          maxTotalQueueDuration: 604800000, // 7 days in milliseconds
          autoStart: true,
          priorityHandling: true,
          retryEnabled: true,
          maxRetries: 3,
          validationEnabled: true,
          syncInterval: 5000,
          offlineProcessingEnabled: true,
          pauseOnError: true,
          resumeOnResourceAvailable: true,
          persistenceInterval: 60000, // 1 minute in milliseconds
          integrityCheckInterval: 300000, // 5 minutes in milliseconds
          maxHistorySize: 100
        },
        lastProcessed: new Date().toISOString(),
        lastSaved: now,
        lastUpdated: now,
        lastSynced: now,
        createdAt: now,
        version: 1,
        checksum: generateChecksum(playerId + now),
        lastValidated: now,
        stateHistory: [],
        maxHistorySize: 10
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
 * Legacy reward generation function - now uses enhanced processor
 * @deprecated Use EnhancedTaskProcessor.calculateRewards instead
 */
async function generateTaskRewards(task: Task): Promise<TaskReward[]> {
  const processor = new EnhancedTaskProcessor();
  const playerStats = await processor['getPlayerStats'](task.playerId);
  const playerLevel = await processor['getPlayerLevel'](task.playerId);
  return await processor.calculateRewards(task, playerStats, playerLevel);
}

/**
 * Legacy reward application function - now uses enhanced processor
 * @deprecated Use EnhancedTaskProcessor.applyRewardsToCharacter instead
 */
async function applyRewardsToCharacter(playerId: string, rewards: TaskReward[]): Promise<void> {
  const processor = new EnhancedTaskProcessor();
  return await processor['applyRewardsToCharacter'](playerId, rewards);
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
    rewards: [],
  };
}