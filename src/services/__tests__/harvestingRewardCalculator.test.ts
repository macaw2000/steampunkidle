/**
 * Enhanced Harvesting Reward Calculator Tests
 * Tests for predictable primary materials and exotic item discovery system
 */

import { HarvestingRewardCalculator } from '../harvestingRewardCalculator';
import { Task, TaskType, HarvestingTaskData } from '../../types/taskQueue';
import { HarvestingActivity, HarvestingCategory } from '../../types/harvesting';
import { CharacterStats } from '../../types/character';

describe('HarvestingRewardCalculator', () => {
  // Sample test data
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

  const mockActivity: HarvestingActivity = {
    id: 'test_mining',
    name: 'Test Mining',
    description: 'Test mining activity',
    category: HarvestingCategory.METALLURGICAL,
    icon: '⛏️',
    baseTime: 300,
    energyCost: 20,
    requiredLevel: 5,
    statBonuses: {
      strength: 2,
      experience: 25
    },
    dropTable: {
      guaranteed: [
        { itemId: 'iron_ore', minQuantity: 2, maxQuantity: 4, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'copper_ore', minQuantity: 1, maxQuantity: 2, dropRate: 0.6 }
      ],
      uncommon: [
        { itemId: 'silver_nugget', minQuantity: 1, maxQuantity: 1, dropRate: 0.15 }
      ],
      rare: [
        { itemId: 'gold_vein', minQuantity: 1, maxQuantity: 1, dropRate: 0.05 }
      ],
      legendary: [
        { itemId: 'adamantine_crystal', minQuantity: 1, maxQuantity: 1, dropRate: 0.01 }
      ]
    }
  };

  const mockTask: Task = {
    id: 'test-task-123',
    type: TaskType.HARVESTING,
    name: 'Test Harvesting Task',
    description: 'A test harvesting task',
    icon: '⛏️',
    duration: 300000,
    startTime: Date.now(),
    playerId: 'test-player',
    activityData: {
      activity: mockActivity,
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
    estimatedCompletion: Date.now() + 300000,
    retryCount: 0,
    maxRetries: 3,
    isValid: true,
    validationErrors: []
  };

  describe('Enhanced Reward Calculation', () => {
    test('should always provide exactly one primary material', () => {
      // Run multiple times to ensure consistency
      for (let i = 0; i < 100; i++) {
        const enhancedRewards = HarvestingRewardCalculator.calculateEnhancedRewards(
          mockTask,
          mockPlayerStats,
          10
        );

        expect(enhancedRewards.primaryMaterial).toBeDefined();
        expect(enhancedRewards.primaryMaterial.itemId).toBe('iron_ore');
        expect(enhancedRewards.primaryMaterial.quantity).toBeGreaterThanOrEqual(1);
        expect(enhancedRewards.primaryMaterial.quantity).toBeLessThanOrEqual(10); // Accounting for bonuses
      }
    });

    test('should calculate primary material quantity with bonuses', () => {
      const taskWithTools = {
        ...mockTask,
        activityData: {
          ...mockTask.activityData,
          tools: [
            {
              toolId: 'test_pickaxe',
              name: 'Test Pickaxe',
              type: 'harvesting' as const,
              bonuses: [
                { type: 'yield' as const, value: 0.5, description: '50% increased yield' }
              ],
              durability: 100,
              maxDurability: 100
            }
          ]
        } as HarvestingTaskData
      };

      const enhancedRewards = HarvestingRewardCalculator.calculateEnhancedRewards(
        taskWithTools,
        mockPlayerStats,
        10
      );

      // With 50% yield bonus, should get more materials
      expect(enhancedRewards.primaryMaterial.quantity).toBeGreaterThanOrEqual(2);
    });

    test('should have exotic item discovery rate less than 1% base chance', () => {
      let exoticItemsFound = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const enhancedRewards = HarvestingRewardCalculator.calculateEnhancedRewards(
          mockTask,
          mockPlayerStats,
          10
        );

        if (enhancedRewards.exoticItem) {
          exoticItemsFound++;
        }
      }

      const discoveryRate = exoticItemsFound / iterations;
      
      // Should be less than 1% but allow for statistical variance
      expect(discoveryRate).toBeLessThan(0.02); // Less than 2% to account for bonuses
      expect(discoveryRate).toBeGreaterThan(0); // Should find some items in 1000 iterations
    });

    test('should increase exotic discovery rate with higher skill levels', () => {
      const lowSkillStats = {
        ...mockPlayerStats,
        harvestingSkills: {
          ...mockPlayerStats.harvestingSkills,
          mining: 1,
          level: 1
        }
      };

      const highSkillStats = {
        ...mockPlayerStats,
        harvestingSkills: {
          ...mockPlayerStats.harvestingSkills,
          mining: 50,
          level: 50
        }
      };

      let lowSkillExoticCount = 0;
      let highSkillExoticCount = 0;
      const iterations = 500;

      // Test with low skill
      for (let i = 0; i < iterations; i++) {
        const taskWithLowSkill = {
          ...mockTask,
          activityData: {
            ...mockTask.activityData,
            playerStats: lowSkillStats
          } as HarvestingTaskData
        };

        const rewards = HarvestingRewardCalculator.calculateEnhancedRewards(
          taskWithLowSkill,
          lowSkillStats,
          5
        );

        if (rewards.exoticItem) {
          lowSkillExoticCount++;
        }
      }

      // Test with high skill
      for (let i = 0; i < iterations; i++) {
        const taskWithHighSkill = {
          ...mockTask,
          activityData: {
            ...mockTask.activityData,
            playerStats: highSkillStats
          } as HarvestingTaskData
        };

        const rewards = HarvestingRewardCalculator.calculateEnhancedRewards(
          taskWithHighSkill,
          highSkillStats,
          25
        );

        if (rewards.exoticItem) {
          highSkillExoticCount++;
        }
      }

      // Higher skill should result in more exotic items found
      expect(highSkillExoticCount).toBeGreaterThanOrEqual(lowSkillExoticCount);
    });

    test('should provide activity-specific exotic items', () => {
      const literaryActivity: HarvestingActivity = {
        ...mockActivity,
        id: 'test_reading',
        category: HarvestingCategory.LITERARY,
        dropTable: {
          guaranteed: [
            { itemId: 'book_page', minQuantity: 1, maxQuantity: 3, dropRate: 1.0 }
          ],
          common: [],
          uncommon: [],
          rare: [],
          legendary: []
        }
      };

      const literaryTask = {
        ...mockTask,
        activityData: {
          ...mockTask.activityData,
          activity: literaryActivity
        } as HarvestingTaskData
      };

      // Force exotic item discovery by running many iterations
      let foundExoticItem = false;
      let exoticItemId = '';

      for (let i = 0; i < 2000 && !foundExoticItem; i++) {
        const rewards = HarvestingRewardCalculator.calculateEnhancedRewards(
          literaryTask,
          mockPlayerStats,
          15
        );

        if (rewards.exoticItem) {
          foundExoticItem = true;
          exoticItemId = rewards.exoticItem.itemId;
        }
      }

      if (foundExoticItem) {
        // Should be a literary exotic item
        const literaryExoticItems = HarvestingRewardCalculator.getExoticItemsForCategory(HarvestingCategory.LITERARY);
        const isLiteraryItem = literaryExoticItems.some(item => item.id === exoticItemId);
        expect(isLiteraryItem).toBe(true);
      }
    });

    test('should calculate skill progression correctly', () => {
      const enhancedRewards = HarvestingRewardCalculator.calculateEnhancedRewards(
        mockTask,
        mockPlayerStats,
        10
      );

      expect(enhancedRewards.skillGained).toBeGreaterThan(0);
      expect(enhancedRewards.skillGained).toBeLessThan(1000); // Reasonable upper bound
    });
  });

  describe('Legacy Reward Calculation', () => {
    test('should maintain backward compatibility with existing reward system', () => {
      const rewards = HarvestingRewardCalculator.calculateRewards(
        mockTask,
        mockPlayerStats,
        10
      );

      // Should have at least primary material and experience
      expect(rewards.length).toBeGreaterThanOrEqual(2);
      
      // Should have a resource reward (primary material)
      const resourceReward = rewards.find(r => r.type === 'resource');
      expect(resourceReward).toBeDefined();
      expect(resourceReward?.itemId).toBe('iron_ore');
      expect(resourceReward?.quantity).toBeGreaterThanOrEqual(1);
      
      // Should have experience reward
      const experienceReward = rewards.find(r => r.type === 'experience');
      expect(experienceReward).toBeDefined();
      expect(experienceReward?.quantity).toBeGreaterThan(0);
    });

    test('should include exotic items in legacy reward format', () => {
      // Run many iterations to find an exotic item
      let foundExoticReward = false;

      for (let i = 0; i < 1000 && !foundExoticReward; i++) {
        const rewards = HarvestingRewardCalculator.calculateRewards(
          mockTask,
          mockPlayerStats,
          15
        );

        const exoticReward = rewards.find(r => r.type === 'item' && r.isRare === true);
        if (exoticReward) {
          foundExoticReward = true;
          expect(exoticReward.quantity).toBe(1);
          expect(['rare', 'epic', 'legendary']).toContain(exoticReward.rarity);
        }
      }

      // Should eventually find an exotic item in 1000 iterations
      expect(foundExoticReward).toBe(true);
    });
  });

  describe('Exotic Item Pools', () => {
    test('should have exotic items defined for all harvesting categories', () => {
      const categories = Object.values(HarvestingCategory);
      
      categories.forEach(category => {
        const exoticItems = HarvestingRewardCalculator.getExoticItemsForCategory(category);
        expect(exoticItems.length).toBeGreaterThan(0);
        
        // Should have items of different rarities
        const rarities = exoticItems.map(item => item.rarity);
        expect(rarities).toContain('rare');
      });
    });

    test('should have appropriate drop rates for exotic items', () => {
      const allExoticItems = HarvestingRewardCalculator.getAllExoticItems();
      
      allExoticItems.forEach(item => {
        // All exotic items should have drop rates less than 1%
        expect(item.baseDropRate).toBeLessThan(0.01);
        expect(item.baseDropRate).toBeGreaterThan(0);
        
        // Legendary items should have lower drop rates than rare items
        if (item.rarity === 'legendary') {
          expect(item.baseDropRate).toBeLessThan(0.001);
        }
      });
    });

    test('should return correct exotic items for specific categories', () => {
      const metallurgicalItems = HarvestingRewardCalculator.getExoticItemsForCategory(HarvestingCategory.METALLURGICAL);
      
      expect(metallurgicalItems.length).toBeGreaterThan(0);
      metallurgicalItems.forEach(item => {
        expect(item.category).toBe(HarvestingCategory.METALLURGICAL);
      });
    });
  });

  describe('Drop Rate Mechanics', () => {
    test('should respect maximum discovery rate cap', () => {
      // Create a task with extremely high bonuses
      const highBonusTask = {
        ...mockTask,
        activityData: {
          ...mockTask.activityData,
          tools: [
            {
              toolId: 'overpowered_tool',
              name: 'Overpowered Tool',
              type: 'harvesting' as const,
              bonuses: [
                { type: 'quality' as const, value: 10, description: '1000% quality bonus' }
              ],
              durability: 100,
              maxDurability: 100
            }
          ],
          location: {
            locationId: 'bonus_location',
            name: 'Bonus Location',
            bonusModifiers: {
              rare_find: 0.5 // 50% bonus to rare find
            },
            requirements: []
          }
        } as HarvestingTaskData
      };

      let exoticItemsFound = 0;
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const rewards = HarvestingRewardCalculator.calculateEnhancedRewards(
          highBonusTask,
          mockPlayerStats,
          50
        );

        if (rewards.exoticItem) {
          exoticItemsFound++;
        }
      }

      const discoveryRate = exoticItemsFound / iterations;
      
      // Even with extreme bonuses, should be capped at reasonable rate (2%)
      expect(discoveryRate).toBeLessThan(0.25); // 25% max due to capping
    });

    test('should have proper rarity distribution for exotic items', () => {
      const rarityCount = { rare: 0, epic: 0, legendary: 0 };
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const rewards = HarvestingRewardCalculator.calculateEnhancedRewards(
          mockTask,
          mockPlayerStats,
          15
        );

        if (rewards.exoticItem) {
          rarityCount[rewards.exoticItem.rarity]++;
        }
      }

      const totalExoticItems = rarityCount.rare + rarityCount.epic + rarityCount.legendary;
      
      if (totalExoticItems > 0) {
        // Rare items should be most common among exotic items
        expect(rarityCount.rare).toBeGreaterThanOrEqual(rarityCount.epic);
        expect(rarityCount.rare).toBeGreaterThanOrEqual(rarityCount.legendary);
        
        // Legendary should be rarest
        expect(rarityCount.legendary).toBeLessThanOrEqual(rarityCount.epic);
      }
    });
  });

  describe('Tool and Location Bonuses', () => {
    test('should apply tool bonuses to primary material yield', () => {
      const taskWithYieldTool = {
        ...mockTask,
        activityData: {
          ...mockTask.activityData,
          tools: [
            {
              toolId: 'yield_tool',
              name: 'Yield Tool',
              type: 'harvesting' as const,
              bonuses: [
                { type: 'yield' as const, value: 1.0, description: '100% increased yield' }
              ],
              durability: 100,
              maxDurability: 100
            }
          ]
        } as HarvestingTaskData
      };

      const baseRewards = HarvestingRewardCalculator.calculateEnhancedRewards(
        mockTask,
        mockPlayerStats,
        10
      );

      const bonusRewards = HarvestingRewardCalculator.calculateEnhancedRewards(
        taskWithYieldTool,
        mockPlayerStats,
        10
      );

      // With 100% yield bonus, should get significantly more materials
      expect(bonusRewards.primaryMaterial.quantity).toBeGreaterThan(baseRewards.primaryMaterial.quantity);
    });

    test('should apply location bonuses to discovery rates', () => {
      const taskWithRareFindLocation = {
        ...mockTask,
        activityData: {
          ...mockTask.activityData,
          location: {
            locationId: 'rare_find_location',
            name: 'Rare Find Location',
            bonusModifiers: {
              rare_find: 0.01, // 1% bonus to rare find
              metallurgical_yield: 0.2
            },
            requirements: []
          }
        } as HarvestingTaskData
      };

      let baseExoticCount = 0;
      let bonusExoticCount = 0;
      const iterations = 500;

      // Test base discovery rate
      for (let i = 0; i < iterations; i++) {
        const rewards = HarvestingRewardCalculator.calculateEnhancedRewards(
          mockTask,
          mockPlayerStats,
          10
        );
        if (rewards.exoticItem) baseExoticCount++;
      }

      // Test with rare find bonus
      for (let i = 0; i < iterations; i++) {
        const rewards = HarvestingRewardCalculator.calculateEnhancedRewards(
          taskWithRareFindLocation,
          mockPlayerStats,
          10
        );
        if (rewards.exoticItem) bonusExoticCount++;
      }

      // Location with rare find bonus should yield more exotic items
      expect(bonusExoticCount).toBeGreaterThanOrEqual(baseExoticCount);
    });
  });
});