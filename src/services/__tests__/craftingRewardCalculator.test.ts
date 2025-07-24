/**
 * Tests for the Crafting Reward Calculator Service
 */

import { CraftingRewardCalculator } from '../craftingRewardCalculator';
import { CRAFTING_RECIPES, CRAFTING_WORKSTATIONS } from '../../data/craftingRecipes';
import { CharacterStats } from '../../types/character';
import { CraftingStation } from '../../types/taskQueue';

describe('CraftingRewardCalculator', () => {
  // Sample player data for testing
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

  describe('calculateCraftingRewards', () => {
    it('should calculate rewards for successful crafting', () => {
      // Mock Math.random to ensure success
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.9);

      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Calculate rewards
      const rewards = CraftingRewardCalculator.calculateCraftingRewards(
        recipe!,
        playerStats
      );

      // Restore Math.random
      Math.random = originalRandom;

      // Verify rewards
      expect(rewards.length).toBeGreaterThan(0);
      expect(rewards.some(r => r.type === 'item')).toBe(true);
      expect(rewards.some(r => r.type === 'experience')).toBe(true);
    });

    it('should calculate rewards for failed crafting', () => {
      // Mock Math.random to ensure failure
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.1);

      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Calculate rewards
      const rewards = CraftingRewardCalculator.calculateCraftingRewards(
        recipe!,
        playerStats
      );

      // Restore Math.random
      Math.random = originalRandom;

      // Verify rewards - should have reduced experience but no items
      expect(rewards.length).toBeGreaterThan(0);
      expect(rewards.some(r => r.type === 'experience')).toBe(true);
      expect(rewards.find(r => r.type === 'experience')?.quantity).toBeLessThan(recipe!.experienceGain);
    });

    it('should apply crafting station bonuses', () => {
      // Mock Math.random to ensure success
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.9);

      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Create a station with quality bonus
      const qualityStation: CraftingStation = {
        ...craftingStation,
        bonuses: [
          { type: 'quality', value: 20, description: '+20% quality' }
        ]
      };

      // Calculate rewards with station
      const rewards = CraftingRewardCalculator.calculateCraftingRewards(
        recipe!,
        playerStats,
        qualityStation
      );

      // Calculate rewards without station
      const baseRewards = CraftingRewardCalculator.calculateCraftingRewards(
        recipe!,
        playerStats
      );

      // Restore Math.random
      Math.random = originalRandom;

      // Experience should be higher with quality station
      const stationExp = rewards.find(r => r.type === 'experience')?.quantity || 0;
      const baseExp = baseRewards.find(r => r.type === 'experience')?.quantity || 0;
      expect(stationExp).toBeGreaterThan(baseExp);
    });

    it('should scale rewards with quantity', () => {
      // Mock Math.random to ensure success
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.9);

      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Calculate rewards for quantity 1
      const singleRewards = CraftingRewardCalculator.calculateCraftingRewards(
        recipe!,
        playerStats
      );

      // Calculate rewards for quantity 3
      const multipleRewards = CraftingRewardCalculator.calculateCraftingRewards(
        recipe!,
        playerStats,
        undefined,
        3
      );

      // Restore Math.random
      Math.random = originalRandom;

      // Experience should be scaled by quantity
      const singleExp = singleRewards.find(r => r.type === 'experience')?.quantity || 0;
      const multipleExp = multipleRewards.find(r => r.type === 'experience')?.quantity || 0;
      expect(multipleExp).toBeCloseTo(singleExp * 3, 0);

      // Item quantity should be scaled
      const singleItemQty = singleRewards.find(r => r.type === 'item')?.quantity || 0;
      const multipleItemQty = multipleRewards.find(r => r.type === 'item')?.quantity || 0;
      expect(multipleItemQty).toBe(singleItemQty * 3);
    });
  });

  describe('calculateCraftingDuration', () => {
    it('should calculate base duration from recipe', () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Calculate duration
      const duration = CraftingRewardCalculator.calculateCraftingDuration(
        recipe!,
        playerStats
      );

      // Duration should be in milliseconds
      expect(duration).toBe(recipe!.craftingTime * 1000);
    });

    it('should apply skill level bonuses', () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Create high-skill player
      const highSkillPlayer = {
        ...playerStats,
        craftingSkills: {
          ...playerStats.craftingSkills,
          clockmaking: 20 // Much higher than required
        }
      };

      // Calculate duration for high-skill player
      const highSkillDuration = CraftingRewardCalculator.calculateCraftingDuration(
        recipe!,
        highSkillPlayer
      );

      // Calculate duration for normal player
      const normalDuration = CraftingRewardCalculator.calculateCraftingDuration(
        recipe!,
        playerStats
      );

      // High skill should reduce duration
      expect(highSkillDuration).toBeLessThan(normalDuration);
    });

    it('should apply crafting station speed bonuses', () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Create a station with speed bonus
      const speedStation: CraftingStation = {
        ...craftingStation,
        bonuses: [
          { type: 'speed', value: 30, description: '+30% speed' }
        ]
      };

      // Calculate duration with station
      const stationDuration = CraftingRewardCalculator.calculateCraftingDuration(
        recipe!,
        playerStats,
        speedStation
      );

      // Calculate duration without station
      const baseDuration = CraftingRewardCalculator.calculateCraftingDuration(
        recipe!,
        playerStats
      );

      // Station should reduce duration by 30%
      expect(stationDuration).toBeCloseTo(baseDuration * 0.7, 0);
    });

    it('should scale duration with quantity', () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Calculate duration for quantity 1
      const singleDuration = CraftingRewardCalculator.calculateCraftingDuration(
        recipe!,
        playerStats
      );

      // Calculate duration for quantity 3
      const multipleDuration = CraftingRewardCalculator.calculateCraftingDuration(
        recipe!,
        playerStats,
        undefined,
        3
      );

      // Duration should be scaled by quantity
      expect(multipleDuration).toBe(singleDuration * 3);
    });
  });

  describe('createCraftingTaskData', () => {
    it('should create valid crafting task data', () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Sample inventory
      const playerInventory = {
        'brass-ingot': 10,
        'coal': 15
      };

      // Create task data
      const taskData = CraftingRewardCalculator.createCraftingTaskData(
        recipe!,
        playerStats,
        playerInventory
      );

      // Verify task data
      expect(taskData.recipe).toBe(recipe);
      expect(taskData.playerSkillLevel).toBe(playerStats.craftingSkills.clockmaking);
      expect(taskData.qualityModifier).toBeGreaterThan(0);
      expect(taskData.materials.length).toBe(recipe!.materials.length);
      expect(taskData.expectedOutputs.length).toBe(recipe!.outputs.length);
    });

    it('should apply crafting station bonuses to quality', () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Sample inventory
      const playerInventory = {
        'brass-ingot': 10,
        'coal': 15
      };

      // Create a station with quality bonus
      const qualityStation: CraftingStation = {
        ...craftingStation,
        bonuses: [
          { type: 'quality', value: 20, description: '+20% quality' }
        ]
      };

      // Create task data with station
      const stationTaskData = CraftingRewardCalculator.createCraftingTaskData(
        recipe!,
        playerStats,
        playerInventory,
        qualityStation
      );

      // Create task data without station
      const baseTaskData = CraftingRewardCalculator.createCraftingTaskData(
        recipe!,
        playerStats,
        playerInventory
      );

      // Quality should be higher with station
      expect(stationTaskData.qualityModifier).toBeGreaterThan(baseTaskData.qualityModifier);
    });

    it('should scale materials with quantity', () => {
      // Get a sample recipe
      const recipe = CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic');
      expect(recipe).toBeDefined();

      // Sample inventory
      const playerInventory = {
        'brass-ingot': 10,
        'coal': 15
      };

      // Create task data with quantity 3
      const taskData = CraftingRewardCalculator.createCraftingTaskData(
        recipe!,
        playerStats,
        playerInventory,
        undefined,
        3
      );

      // Material quantities should be scaled
      for (let i = 0; i < taskData.materials.length; i++) {
        expect(taskData.materials[i].quantity).toBe(recipe!.materials[i].quantity * 3);
      }

      // Output quantities should be scaled
      for (let i = 0; i < taskData.expectedOutputs.length; i++) {
        expect(taskData.expectedOutputs[i].quantity).toBe(recipe!.outputs[i].quantity * 3);
      }
    });
  });
});