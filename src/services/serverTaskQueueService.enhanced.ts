/**
 * Enhanced Server Task Queue Service
 * Adds crafting and combat task support to the existing service
 */

import { serverTaskQueueService as baseService } from './serverTaskQueueService';
import { Task, TaskType, CraftingStation, Equipment, CombatStrategy, HarvestingLocation, EquippedTool } from '../types/taskQueue';
import { CraftingRecipe } from '../types/crafting';
import { CharacterStats } from '../types/character';
import { Enemy, PlayerCombatStats } from '../types/combat';
import { TaskUtils } from '../utils/taskUtils';
import { NetworkUtils } from '../utils/networkUtils';
import { CraftingRewardCalculator } from './craftingRewardCalculator';
import { CombatRewardCalculator } from './combatRewardCalculator';

// Extend the base service with crafting and combat methods
const serverTaskQueueService = {
  ...baseService,

  /**
   * Start a crafting task immediately (replaces current task)
   */
  async startCraftingTask(
    playerId: string,
    recipe: CraftingRecipe,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: {
      craftingStation?: CraftingStation;
      quantity?: number;
    } = {}
  ): Promise<Task> {
    // Use local fallback if server is unavailable
    if ((baseService as any).useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for startCraftingTask');
      (baseService as any).queuePendingOperation(playerId, 'startCraftingTask', { recipe, playerStats, playerLevel, playerInventory, options });
      return (baseService as any).taskQueueService.startCraftingTask(playerId, recipe.name, recipe);
    }

    // Stop current tasks first
    await baseService.stopAllTasks(playerId);
    
    // Add new task with high priority
    const taskOptions = {
      ...options,
      priority: 10 // Default to high priority for immediate tasks
    };
    
    return await this.queueCraftingTask(playerId, recipe, playerStats, playerLevel, playerInventory, taskOptions);
  },

  /**
   * Queue a crafting task (adds to queue without interrupting current task)
   */
  async queueCraftingTask(
    playerId: string,
    recipe: CraftingRecipe,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: {
      craftingStation?: CraftingStation;
      quantity?: number;
      priority?: number;
    } = {}
  ): Promise<Task> {
    // Use local fallback if server is unavailable
    if ((baseService as any).useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for queueCraftingTask');
      (baseService as any).queuePendingOperation(playerId, 'queueCraftingTask', { recipe, playerStats, playerLevel, playerInventory, options });
      return (baseService as any).taskQueueService.addCraftingTask(playerId, recipe.name, recipe);
    }

    // Create crafting task data
    const craftingTaskData = CraftingRewardCalculator.createCraftingTaskData(
      recipe,
      playerStats,
      playerInventory,
      options.craftingStation,
      options.quantity || 1
    );

    // Calculate task duration
    const duration = CraftingRewardCalculator.calculateCraftingDuration(
      recipe,
      playerStats,
      options.craftingStation,
      options.quantity || 1
    );

    // Create task with proper structure
    const task = TaskUtils.createCraftingTask(
      playerId,
      recipe,
      playerStats,
      playerLevel,
      playerInventory,
      {
        priority: options.priority,
        craftingStation: options.craftingStation,
        quantity: options.quantity || 1
      }
    );

    // Override duration with calculated value
    task.duration = duration;
    task.estimatedCompletion = Date.now() + duration;

    try {
      await NetworkUtils.postJson(`${(baseService as any).apiUrl}/task-queue/add-task`, {
        action: 'addTask',
        playerId,
        task,
      }, {
        timeout: 8000,
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('ServerTaskQueueService: Crafting task added to server queue:', task.id);
      
      // Immediately sync to get updated state
      await baseService.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to add crafting task to server:', error);
      
      // Fall back to local processing
      (baseService as any).handleServerError(error, 'addCraftingTask');
      (baseService as any).useLocalFallback = true;
      (baseService as any).queuePendingOperation(playerId, 'addCraftingTask', { recipe, playerStats, playerLevel, playerInventory, options });
      return (baseService as any).taskQueueService.addCraftingTask(playerId, recipe.name, recipe);
    }

    return task;
  },

  /**
   * Start a combat task immediately (replaces current task)
   */
  async startCombatTask(
    playerId: string,
    enemy: Enemy,
    playerStats: CharacterStats,
    playerLevel: number,
    playerCombatStats: PlayerCombatStats,
    options: {
      equipment?: Equipment[];
      strategy?: CombatStrategy;
    } = {}
  ): Promise<Task> {
    // Use local fallback if server is unavailable
    if ((baseService as any).useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for startCombatTask');
      (baseService as any).queuePendingOperation(playerId, 'startCombatTask', { enemy, playerStats, playerLevel, playerCombatStats, options });
      return (baseService as any).taskQueueService.startCombatTask(playerId, enemy.name, enemy);
    }

    // Stop current tasks first
    await baseService.stopAllTasks(playerId);
    
    // Add new task with high priority
    const taskOptions = {
      ...options,
      priority: 10 // Default to high priority for immediate tasks
    };
    
    return await this.queueCombatTask(playerId, enemy, playerStats, playerLevel, playerCombatStats, taskOptions);
  },

  /**
   * Queue a combat task (adds to queue without interrupting current task)
   */
  async queueCombatTask(
    playerId: string,
    enemy: Enemy,
    playerStats: CharacterStats,
    playerLevel: number,
    playerCombatStats: PlayerCombatStats,
    options: {
      equipment?: Equipment[];
      strategy?: CombatStrategy;
      priority?: number;
    } = {}
  ): Promise<Task> {
    // Use local fallback if server is unavailable
    if ((baseService as any).useLocalFallback) {
      console.log('ServerTaskQueueService: Using local fallback for queueCombatTask');
      (baseService as any).queuePendingOperation(playerId, 'queueCombatTask', { enemy, playerStats, playerLevel, playerCombatStats, options });
      return (baseService as any).taskQueueService.addCombatTask(playerId, enemy.name, enemy);
    }

    // Create combat task data
    const combatTaskData = CombatRewardCalculator.createCombatTaskData(
      enemy,
      playerStats,
      playerCombatStats,
      playerLevel,
      {
        equipment: options.equipment,
        strategy: options.strategy
      }
    );

    // Calculate task duration
    const duration = CombatRewardCalculator.calculateCombatDuration(
      enemy,
      playerCombatStats,
      options.equipment,
      options.strategy
    );

    // Create task with proper structure
    const task = TaskUtils.createCombatTask(
      playerId,
      enemy,
      playerStats,
      playerLevel,
      playerCombatStats,
      {
        priority: options.priority,
        equipment: options.equipment,
        strategy: options.strategy
      }
    );

    // Override duration with calculated value
    task.duration = duration;
    task.estimatedCompletion = Date.now() + duration;

    try {
      await NetworkUtils.postJson(`${(baseService as any).apiUrl}/task-queue/add-task`, {
        action: 'addTask',
        playerId,
        task,
      }, {
        timeout: 8000,
        retries: 2,
        exponentialBackoff: true,
      });

      console.log('ServerTaskQueueService: Combat task added to server queue:', task.id);
      
      // Immediately sync to get updated state
      await baseService.syncWithServer(playerId);

    } catch (error: any) {
      console.error('ServerTaskQueueService: Failed to add combat task to server:', error);
      
      // Fall back to local processing
      (baseService as any).handleServerError(error, 'addCombatTask');
      (baseService as any).useLocalFallback = true;
      (baseService as any).queuePendingOperation(playerId, 'addCombatTask', { enemy, playerStats, playerLevel, playerCombatStats, options });
      return (baseService as any).taskQueueService.addCombatTask(playerId, enemy.name, enemy);
    }

    return task;
  }
};

export { serverTaskQueueService };