/**
 * Integration test for Enhanced Harvesting Reward Calculator
 * Demonstrates the predictable primary materials and exotic item discovery system
 */

import { HarvestingRewardCalculator } from '../harvestingRewardCalculator';
import { HARVESTING_ACTIVITIES } from '../../data/harvestingActivities';
import { Task, TaskType, HarvestingTaskData } from '../../types/taskQueue';
import { CharacterStats } from '../../types/character';

describe('HarvestingRewardCalculator Integration', () => {
  const mockPlayerStats: CharacterStats = {
    strength: 25,
    dexterity: 20,
    intelligence: 30,
    vitality: 18,
    craftingSkills: {
      clockmaking: 5,
      engineering: 3,
      alchemy: 2,
      steamcraft: 4,
      level: 5,
      experience: 500
    },
    harvestingSkills: {
      mining: 15,
      foraging: 10,
      salvaging: 8,
      crystal_extraction: 5,
      level: 12,
      experience: 1200
    },
    combatSkills: {
      melee: 5,
      ranged: 3,
      defense: 4,
      tactics: 2,
      level: 4,
      experience: 400
    }
  };

  test('should provide predictable primary materials for all activities', () => {
    HARVESTING_ACTIVITIES.forEach(activity => {
      const mockTask: Task = {
        id: `test-task-${activity.id}`,
        type: TaskType.HARVESTING,
        name: `Test ${activity.name}`,
        description: `Test task for ${activity.name}`,
        icon: activity.icon,
        duration: activity.baseTime * 1000,
        startTime: Date.now(),
        playerId: 'test-player',
        activityData: {
          activity,
          playerStats: mockPlayerStats,
          tools: [],
          expectedYield: []
        } as HarvestingTaskData,
        prerequisites: [],
        resourceRequirements: [],
        progress: 0,
        completed: false,
        rewards: [],
        priority: 1,
        estimatedCompletion: Date.now() + activity.baseTime * 1000,
        retryCount: 0,
        maxRetries: 3,
        isValid: true,
        validationErrors: []
      };

      // Test enhanced rewards
      const enhancedRewards = HarvestingRewardCalculator.calculateEnhancedRewards(
        mockTask,
        mockPlayerStats,
        10
      );

      // Should always have a primary material
      expect(enhancedRewards.primaryMaterial).toBeDefined();
      expect(enhancedRewards.primaryMaterial.quantity).toBeGreaterThanOrEqual(1);
      expect(enhancedRewards.skillGained).toBeGreaterThan(0);

      // Test legacy rewards for backward compatibility
      const legacyRewards = HarvestingRewardCalculator.calculateRewards(
        mockTask,
        mockPlayerStats,
        10
      );

      // Should have at least primary material and experience
      expect(legacyRewards.length).toBeGreaterThanOrEqual(2);
      
      const resourceReward = legacyRewards.find(r => r.type === 'resource');
      const experienceReward = legacyRewards.find(r => r.type === 'experience');
      
      expect(resourceReward).toBeDefined();
      expect(resourceReward?.quantity).toBeGreaterThanOrEqual(1);
      expect(experienceReward).toBeDefined();
      expect(experienceReward?.quantity).toBeGreaterThan(0);
    });
  });

  test('should have exotic items defined for all categories', () => {
    HARVESTING_ACTIVITIES.forEach(activity => {
      const exoticItems = HarvestingRewardCalculator.getExoticItemsForCategory(activity.category);
      
      // Each category should have exotic items
      expect(exoticItems.length).toBeGreaterThan(0);
      
      // All exotic items should have proper structure
      exoticItems.forEach(item => {
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.baseDropRate).toBeLessThan(0.01); // Less than 1%
        expect(item.baseDropRate).toBeGreaterThan(0);
        expect(['rare', 'epic', 'legendary']).toContain(item.rarity);
        expect(item.category).toBe(activity.category);
      });
    });
  });

  test('should demonstrate exotic item discovery over multiple harvests', () => {
    const activity = HARVESTING_ACTIVITIES[0]; // Use first activity
    const mockTask: Task = {
      id: 'test-exotic-discovery',
      type: TaskType.HARVESTING,
      name: 'Test Exotic Discovery',
      description: 'Test task for exotic discovery',
      icon: activity.icon,
      duration: activity.baseTime * 1000,
      startTime: Date.now(),
      playerId: 'test-player',
      activityData: {
        activity,
        playerStats: mockPlayerStats,
        tools: [],
        expectedYield: []
      } as HarvestingTaskData,
      prerequisites: [],
      resourceRequirements: [],
      progress: 0,
      completed: false,
      rewards: [],
      priority: 1,
      estimatedCompletion: Date.now() + activity.baseTime * 1000,
      retryCount: 0,
      maxRetries: 3,
      isValid: true,
      validationErrors: []
    };

    let exoticItemsFound = 0;
    let totalHarvests = 0;
    const maxIterations = 1000;

    // Simulate multiple harvests
    for (let i = 0; i < maxIterations; i++) {
      const enhancedRewards = HarvestingRewardCalculator.calculateEnhancedRewards(
        mockTask,
        mockPlayerStats,
        10
      );

      totalHarvests++;

      // Always should have primary material
      expect(enhancedRewards.primaryMaterial).toBeDefined();
      expect(enhancedRewards.primaryMaterial.quantity).toBeGreaterThanOrEqual(1);

      // Check for exotic items
      if (enhancedRewards.exoticItem) {
        exoticItemsFound++;
        expect(['rare', 'epic', 'legendary']).toContain(enhancedRewards.exoticItem.rarity);
        expect(enhancedRewards.exoticItem.quantity).toBe(1);
      }
    }

    // Should find some exotic items but not too many (less than 2% discovery rate)
    const discoveryRate = exoticItemsFound / totalHarvests;
    expect(discoveryRate).toBeLessThan(0.02); // Less than 2%
    
    console.log(`Exotic Discovery Test Results:`);
    console.log(`Total Harvests: ${totalHarvests}`);
    console.log(`Exotic Items Found: ${exoticItemsFound}`);
    console.log(`Discovery Rate: ${(discoveryRate * 100).toFixed(2)}%`);
  });

  test('should show all exotic items across categories', () => {
    const allExoticItems = HarvestingRewardCalculator.getAllExoticItems();
    
    expect(allExoticItems.length).toBeGreaterThan(0);
    
    // Should have items from multiple categories
    const categories = new Set(allExoticItems.map(item => item.category));
    expect(categories.size).toBeGreaterThan(1);
    
    // All items should have valid drop rates
    allExoticItems.forEach(item => {
      expect(item.baseDropRate).toBeLessThan(0.01);
      expect(item.baseDropRate).toBeGreaterThan(0);
    });
    
    console.log(`Total Exotic Items Available: ${allExoticItems.length}`);
    console.log(`Categories with Exotic Items: ${categories.size}`);
  });
});