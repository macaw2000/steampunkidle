/**
 * Tests for the Enhanced Server Task Queue Service (Crafting)
 */

import { serverTaskQueueService } from '../serverTaskQueueService.enhanced';
import { NetworkUtils } from '../../utils/networkUtils';
import { CRAFTING_RECIPES } from '../../data/craftingRecipes';
import { CharacterStats } from '../../types/character';
import { CraftingStation } from '../../types/taskQueue';

// Mock dependencies
jest.mock('../../utils/networkUtils', () => ({
  NetworkUtils: {
    postJson: jest.fn(),
    fetchJson: jest.fn()
  }
}));

describe('Enhanced ServerTaskQueueService - Crafting', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful network response
    (NetworkUtils.postJson as jest.Mock).mockResolvedValue({ success: true });
    (NetworkUtils.fetchJson as jest.Mock).mockResolvedValue({ 
      queue: {
        currentTask: null,
        queuedTasks: [],
        queueLength: 0,
        isRunning: true,
        totalCompleted: 0
      }
    });
    
    // Reset useLocalFallback flag
    (serverTaskQueueService as any).useLocalFallback = false;
  });

  // Sample player data for testing
  const playerId = 'player123';
  const playerStats: CharacterStats = {
    level: 10,
    experience: 5000,
    strength: 15,
    dexterity: 12,
    intelligence: 18,
    vitality: 14,
    perception: 10,
    craftingSkills: {
      clockmaking: 8,
      engineering: 6,
      alchemy: 10,
      steamcraft: 5
    },
    harvestingSkills: {
      mining: 5,
      foraging: 3,
      salvaging: 7,
      crystal_extraction: 4
    },
    combatSkills: {
      melee: 6,
      ranged: 4,
      defense: 5,
      tactics: 3
    }
  };
  const playerLevel = 10;
  const playerInventory = {
    'brass-ingot': 10,
    'coal': 15,
    'silver-ingot': 5,
    'crystal-lens': 3
  };

  // Sample crafting station
  const craftingStation: CraftingStation = {
    stationId: 'basic-forge',
    name: 'Basic Steam Forge',
    type: 'basic',
    bonuses: [
      { type: 'speed', value: 10, description: '+10% crafting speed for basic recipes' }
    ],
    requirements: []
  };

  describe('queueCraftingTask', () => {
    it('should create and queue a crafting task', async () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Queue the task
      const task = await serverTaskQueueService.queueCraftingTask(
        playerId,
        recipe!,
        playerStats,
        playerLevel,
        playerInventory
      );

      // Verify task properties
      expect(task.type).toBe('crafting');
      expect(task.playerId).toBe(playerId);
      expect(task.name).toContain(recipe!.name);
      
      // Verify API was called
      expect(NetworkUtils.postJson).toHaveBeenCalled();
      const apiCall = (NetworkUtils.postJson as jest.Mock).mock.calls[0];
      expect(apiCall[1].action).toBe('addTask');
      expect(apiCall[1].playerId).toBe(playerId);
      expect(apiCall[1].task.type).toBe('crafting');
    });

    it('should include crafting station when provided', async () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Queue the task with station
      const task = await serverTaskQueueService.queueCraftingTask(
        playerId,
        recipe!,
        playerStats,
        playerLevel,
        playerInventory,
        {
          craftingStation
        }
      );

      // Verify task includes station
      expect((task.activityData as any).craftingStation).toBeDefined();
      expect((task.activityData as any).craftingStation.stationId).toBe('basic-forge');
      
      // Verify API was called with station
      expect(NetworkUtils.postJson).toHaveBeenCalled();
      const apiCall = (NetworkUtils.postJson as jest.Mock).mock.calls[0];
      expect(apiCall[1].task.activityData.craftingStation).toBeDefined();
    });

    it('should handle quantity parameter', async () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Queue the task with quantity
      const task = await serverTaskQueueService.queueCraftingTask(
        playerId,
        recipe!,
        playerStats,
        playerLevel,
        playerInventory,
        {
          quantity: 3
        }
      );

      // Verify task name includes quantity
      expect(task.name).toContain('(x3)');
      
      // Verify materials are scaled
      const materials = (task.activityData as any).materials;
      expect(materials[0].quantity).toBe(recipe!.materials[0].quantity * 3);
    });

    it('should handle network errors', async () => {
      // Mock network error
      (NetworkUtils.postJson as jest.Mock).mockRejectedValue({
        isNetworkError: true,
        isOffline: true
      });

      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Queue the task (should not throw)
      const task = await serverTaskQueueService.queueCraftingTask(
        playerId,
        recipe!,
        playerStats,
        playerLevel,
        playerInventory
      );

      // Should still return a task
      expect(task).toBeDefined();
      expect(task.type).toBe('crafting');
      
      // Should set useLocalFallback flag
      expect((serverTaskQueueService as any).useLocalFallback).toBe(true);
    });
  });

  describe('startCraftingTask', () => {
    it('should stop current tasks and start a new crafting task', async () => {
      // Spy on stopAllTasks
      const stopAllTasksSpy = jest.spyOn(serverTaskQueueService, 'stopAllTasks');
      stopAllTasksSpy.mockResolvedValue();

      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Start the task
      const task = await serverTaskQueueService.startCraftingTask(
        playerId,
        recipe!,
        playerStats,
        playerLevel,
        playerInventory
      );

      // Verify stopAllTasks was called
      expect(stopAllTasksSpy).toHaveBeenCalledWith(playerId);
      
      // Verify task was created with high priority
      expect(task.priority).toBe(10);
      
      // Verify API was called
      expect(NetworkUtils.postJson).toHaveBeenCalled();
    });

    it('should handle options parameters', async () => {
      // Spy on stopAllTasks
      const stopAllTasksSpy = jest.spyOn(serverTaskQueueService, 'stopAllTasks');
      stopAllTasksSpy.mockResolvedValue();

      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Start the task with options
      const task = await serverTaskQueueService.startCraftingTask(
        playerId,
        recipe!,
        playerStats,
        playerLevel,
        playerInventory,
        {
          craftingStation,
          quantity: 2
        }
      );

      // Verify task includes options
      expect((task.activityData as any).craftingStation).toBeDefined();
      expect(task.name).toContain('(x2)');
    });
  });
});