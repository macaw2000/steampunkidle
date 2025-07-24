/**
 * Tests for the Crafting Task Integration Service
 */

import { CraftingTaskIntegration } from '../craftingTaskIntegration';
import { serverTaskQueueService } from '../serverTaskQueueService';
import { CRAFTING_RECIPES, CRAFTING_WORKSTATIONS } from '../../data/craftingRecipes';
import { CharacterStats } from '../../types/character';

// Mock dependencies
jest.mock('../serverTaskQueueService', () => ({
  serverTaskQueueService: {
    startCraftingTask: jest.fn(),
    queueCraftingTask: jest.fn()
  }
}));

describe('CraftingTaskIntegration', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
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
    'crystal-lens': 3,
    'steam-crystal': 2,
    'precision-spring': 4
  };

  describe('startCraftingTask', () => {
    it('should start a crafting task with valid recipe', async () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Call the method
      await CraftingTaskIntegration.startCraftingTask(
        playerId,
        'clockwork-gear-basic',
        playerStats,
        playerLevel,
        playerInventory
      );

      // Verify serverTaskQueueService was called correctly
      expect(serverTaskQueueService.startCraftingTask).toHaveBeenCalledWith(
        playerId,
        recipe,
        playerStats,
        playerLevel,
        playerInventory,
        {
          craftingStation: undefined,
          quantity: 1
        }
      );
    });

    it('should throw error for invalid recipe', async () => {
      await expect(
        CraftingTaskIntegration.startCraftingTask(
          playerId,
          'non-existent-recipe',
          playerStats,
          playerLevel,
          playerInventory
        )
      ).rejects.toThrow('Crafting recipe not found');
    });

    it('should throw error for insufficient level', async () => {
      // Get a high-level recipe
      const highLevelRecipe = CRAFTING_RECIPES.find(r => r.requiredLevel > playerLevel);
      expect(highLevelRecipe).toBeDefined();

      await expect(
        CraftingTaskIntegration.startCraftingTask(
          playerId,
          highLevelRecipe!.recipeId,
          playerStats,
          playerLevel,
          playerInventory
        )
      ).rejects.toThrow('Player level');
    });

    it('should throw error for insufficient materials', async () => {
      // Create inventory with insufficient materials
      const lowInventory = { ...playerInventory, 'brass-ingot': 0 };

      await expect(
        CraftingTaskIntegration.startCraftingTask(
          playerId,
          'clockwork-gear-basic',
          playerStats,
          playerLevel,
          lowInventory
        )
      ).rejects.toThrow('Insufficient materials');
    });

    it('should include crafting station when specified', async () => {
      // Get a sample recipe and station
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Call the method with station
      await CraftingTaskIntegration.startCraftingTask(
        playerId,
        'clockwork-gear-basic',
        playerStats,
        playerLevel,
        playerInventory,
        {
          craftingStationId: 'basic-forge'
        }
      );

      // Verify serverTaskQueueService was called with station
      expect(serverTaskQueueService.startCraftingTask).toHaveBeenCalled();
      const callArgs = (serverTaskQueueService.startCraftingTask as jest.Mock).mock.calls[0];
      expect(callArgs[5].craftingStation).toBeDefined();
      expect(callArgs[5].craftingStation.stationId).toBe('basic-forge');
    });
  });

  describe('queueCraftingTask', () => {
    it('should queue a crafting task with valid recipe', async () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Call the method
      await CraftingTaskIntegration.queueCraftingTask(
        playerId,
        'clockwork-gear-basic',
        playerStats,
        playerLevel,
        playerInventory
      );

      // Verify serverTaskQueueService was called correctly
      expect(serverTaskQueueService.queueCraftingTask).toHaveBeenCalledWith(
        playerId,
        recipe,
        playerStats,
        playerLevel,
        playerInventory,
        {
          craftingStation: undefined,
          quantity: 1,
          priority: undefined
        }
      );
    });

    it('should queue multiple items when quantity specified', async () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Call the method with quantity
      await CraftingTaskIntegration.queueCraftingTask(
        playerId,
        'clockwork-gear-basic',
        playerStats,
        playerLevel,
        playerInventory,
        {
          quantity: 3
        }
      );

      // Verify serverTaskQueueService was called with quantity
      expect(serverTaskQueueService.queueCraftingTask).toHaveBeenCalled();
      const callArgs = (serverTaskQueueService.queueCraftingTask as jest.Mock).mock.calls[0];
      expect(callArgs[5].quantity).toBe(3);
    });
  });

  describe('getAvailableRecipes', () => {
    it('should return recipes that meet level and skill requirements', () => {
      const availableRecipes = CraftingTaskIntegration.getAvailableRecipes(
        playerLevel,
        playerStats
      );

      // Should include recipes that meet requirements
      expect(availableRecipes.some(r => r.recipeId === 'clockwork-gear-basic')).toBe(true);
      
      // Should exclude recipes that don't meet requirements
      expect(availableRecipes.some(r => r.requiredLevel > playerLevel)).toBe(false);
      expect(availableRecipes.some(r => 
        r.requiredSkill === 'steamcraft' && r.requiredLevel > playerStats.craftingSkills.steamcraft
      )).toBe(false);
    });
  });

  describe('getAvailableCraftingStations', () => {
    it('should return stations that meet skill requirements', () => {
      const availableStations = CraftingTaskIntegration.getAvailableCraftingStations(
        playerLevel,
        playerStats
      );

      // Should include basic stations
      expect(availableStations.some(s => s.stationId === 'basic-forge')).toBe(true);
      
      // Should include stations that meet skill requirements
      expect(availableStations.some(s => s.stationId === 'precision-workbench')).toBe(true);
      
      // Should exclude stations that don't meet requirements
      expect(availableStations.some(s => s.stationId === 'master-workshop')).toBe(false);
    });
  });
});