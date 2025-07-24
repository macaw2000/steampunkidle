/**
 * Tests for Combat Task Integration
 */

import { CombatTaskIntegration } from '../combatTaskIntegration';
import { CombatRewardCalculator } from '../combatRewardCalculator';
import { TaskUtils } from '../../utils/taskUtils';
import { ENEMIES, COMBAT_ZONES } from '../../data/combatData';
import { TaskType } from '../../types/taskQueue';

// Mock dependencies
jest.mock('../../utils/taskUtils', () => ({
  TaskUtils: {
    createCombatTask: jest.fn().mockReturnValue({
      id: 'test-combat-task',
      type: 'combat',
      name: 'Fight Test Enemy',
      playerId: 'player1'
    })
  }
}));

jest.mock('../combatRewardCalculator', () => ({
  CombatRewardCalculator: {
    calculateCombatDuration: jest.fn().mockReturnValue(30000),
    calculateCombatEstimate: jest.fn().mockReturnValue({
      winProbability: 0.7,
      estimatedDuration: 30,
      expectedRewards: [],
      riskLevel: 'medium'
    }),
    simulateCombatOutcome: jest.fn().mockReturnValue({
      result: 'victory',
      playerHealthRemaining: 50,
      combatDuration: 25
    }),
    calculateCombatRewards: jest.fn().mockReturnValue([
      { type: 'experience', quantity: 100 },
      { type: 'item', itemId: 'test-item', quantity: 1 }
    ])
  }
}));

describe('CombatTaskIntegration', () => {
  const mockEnemy = ENEMIES[0];
  
  const mockPlayerStats = {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    vitality: 10,
    harvestingSkills: { level: 1 },
    craftingSkills: { level: 1 },
    combatSkills: { level: 1 }
  };
  
  const mockPlayerCombatStats = {
    health: 100,
    maxHealth: 100,
    attack: 20,
    defense: 10,
    speed: 8,
    abilities: []
  };
  
  const mockEquipment = [
    {
      equipmentId: 'test-weapon',
      name: 'Test Weapon',
      type: 'weapon',
      stats: {
        attack: 5
      },
      requirements: [],
      durability: 100,
      maxDurability: 100
    }
  ];
  
  describe('createCombatTask', () => {
    it('should create a combat task using TaskUtils', () => {
      const task = CombatTaskIntegration.createCombatTask(
        'player1',
        mockEnemy,
        mockPlayerStats,
        5,
        mockPlayerCombatStats,
        {
          equipment: mockEquipment
        }
      );
      
      expect(TaskUtils.createCombatTask).toHaveBeenCalledWith(
        'player1',
        mockEnemy,
        mockPlayerStats,
        5,
        mockPlayerCombatStats,
        {
          equipment: mockEquipment
        }
      );
      
      expect(task).toHaveProperty('id', 'test-combat-task');
      expect(task).toHaveProperty('type', 'combat');
    });
  });
  
  describe('getAvailableEnemies', () => {
    it('should return enemies appropriate for player level', () => {
      const playerLevel = 5;
      const enemies = CombatTaskIntegration.getAvailableEnemies(playerLevel);
      
      expect(Array.isArray(enemies)).toBe(true);
      
      // All returned enemies should be within level range
      enemies.forEach(enemy => {
        const levelDiff = enemy.level - playerLevel;
        expect(levelDiff).toBeGreaterThanOrEqual(-3);
        expect(levelDiff).toBeLessThanOrEqual(5);
      });
    });
    
    it('should return empty array if no appropriate enemies', () => {
      // Assuming no enemies for level 100
      const enemies = CombatTaskIntegration.getAvailableEnemies(100);
      expect(enemies).toEqual([]);
    });
  });
  
  describe('getAvailableCombatZones', () => {
    it('should return zones available for player level', () => {
      const playerLevel = 8;
      const zones = CombatTaskIntegration.getAvailableCombatZones(playerLevel);
      
      expect(Array.isArray(zones)).toBe(true);
      
      // All returned zones should be available for player level
      zones.forEach(zone => {
        expect(zone.requiredLevel).toBeLessThanOrEqual(playerLevel);
      });
    });
  });
  
  describe('getRecommendedEnemy', () => {
    it('should return enemy closest to player level', () => {
      const playerLevel = 5;
      const enemy = CombatTaskIntegration.getRecommendedEnemy(playerLevel);
      
      expect(enemy).not.toBeNull();
      if (enemy) {
        // Should be within reasonable level range
        const levelDiff = Math.abs(enemy.level - playerLevel);
        expect(levelDiff).toBeLessThanOrEqual(5);
      }
    });
    
    it('should return null if no appropriate enemies', () => {
      // Assuming no enemies for level 100
      const enemy = CombatTaskIntegration.getRecommendedEnemy(100);
      expect(enemy).toBeNull();
    });
  });
  
  describe('calculateCombatDuration', () => {
    it('should use CombatRewardCalculator to calculate duration', () => {
      const duration = CombatTaskIntegration.calculateCombatDuration(
        mockEnemy,
        mockPlayerCombatStats,
        mockEquipment
      );
      
      expect(CombatRewardCalculator.calculateCombatDuration).toHaveBeenCalledWith(
        mockEnemy,
        mockPlayerCombatStats,
        mockEquipment,
        undefined
      );
      
      expect(duration).toBe(30000);
    });
  });
  
  describe('checkCombatRequirements', () => {
    it('should check if player meets requirements for combat', () => {
      const result = CombatTaskIntegration.checkCombatRequirements(
        mockEnemy,
        5,
        mockPlayerCombatStats,
        mockEquipment
      );
      
      expect(result).toHaveProperty('meetsRequirements');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
    
    it('should return errors for broken equipment', () => {
      const brokenEquipment = [
        {
          ...mockEquipment[0],
          durability: 0
        }
      ];
      
      const result = CombatTaskIntegration.checkCombatRequirements(
        mockEnemy,
        5,
        mockPlayerCombatStats,
        brokenEquipment
      );
      
      expect(result.meetsRequirements).toBe(false);
      expect(result.errors.some(e => e.includes('broken'))).toBe(true);
    });
    
    it('should return errors for low health', () => {
      const lowHealthStats = {
        ...mockPlayerCombatStats,
        health: 30, // 30% of maxHealth
      };
      
      const result = CombatTaskIntegration.checkCombatRequirements(
        mockEnemy,
        5,
        lowHealthStats,
        mockEquipment
      );
      
      expect(result.meetsRequirements).toBe(false);
      expect(result.errors.some(e => e.includes('Health too low'))).toBe(true);
    });
  });
  
  describe('processCombatCompletion', () => {
    it('should process combat completion and return results', () => {
      const mockTask = {
        id: 'test-combat-task',
        type: TaskType.COMBAT,
        name: 'Fight Test Enemy',
        playerId: 'player1',
        activityData: {
          enemy: mockEnemy,
          playerStats: mockPlayerCombatStats,
          equipment: mockEquipment,
          combatStrategy: { strategyId: 'balanced', name: 'Balanced', description: '', modifiers: [] }
        },
        duration: 30000,
        startTime: Date.now(),
        prerequisites: [],
        resourceRequirements: [],
        progress: 1,
        completed: true,
        rewards: [],
        priority: 5,
        estimatedCompletion: Date.now() + 30000,
        retryCount: 0,
        maxRetries: 1,
        isValid: true,
        validationErrors: []
      };
      
      const result = CombatTaskIntegration.processCombatCompletion(mockTask, 5);
      
      expect(result).toHaveProperty('result', 'victory');
      expect(result).toHaveProperty('rewards');
      expect(result).toHaveProperty('experienceGained', 100);
      expect(result).toHaveProperty('healthRemaining', 50);
      
      expect(CombatRewardCalculator.simulateCombatOutcome).toHaveBeenCalled();
      expect(CombatRewardCalculator.calculateCombatRewards).toHaveBeenCalled();
    });
  });
  
  describe('getEnemyById and getCombatZoneById', () => {
    it('should get enemy by ID', () => {
      const enemy = CombatTaskIntegration.getEnemyById(ENEMIES[0].enemyId);
      expect(enemy).not.toBeNull();
      expect(enemy?.enemyId).toBe(ENEMIES[0].enemyId);
      
      const nonExistentEnemy = CombatTaskIntegration.getEnemyById('non-existent');
      expect(nonExistentEnemy).toBeNull();
    });
    
    it('should get combat zone by ID', () => {
      const zone = CombatTaskIntegration.getCombatZoneById(COMBAT_ZONES[0].zoneId);
      expect(zone).not.toBeNull();
      expect(zone?.zoneId).toBe(COMBAT_ZONES[0].zoneId);
      
      const nonExistentZone = CombatTaskIntegration.getCombatZoneById('non-existent');
      expect(nonExistentZone).toBeNull();
    });
  });
  
  describe('getCombatDifficultyDescription', () => {
    it('should return appropriate difficulty description', () => {
      // Test various difficulty levels
      const trivial = CombatTaskIntegration.getCombatDifficultyDescription(10, { ...mockEnemy, level: 5 });
      expect(trivial).toContain('Trivial');
      
      const easy = CombatTaskIntegration.getCombatDifficultyDescription(10, { ...mockEnemy, level: 9 });
      expect(easy).toContain('Easy');
      
      const moderate = CombatTaskIntegration.getCombatDifficultyDescription(10, { ...mockEnemy, level: 10 });
      expect(moderate).toContain('Moderate');
      
      const hard = CombatTaskIntegration.getCombatDifficultyDescription(10, { ...mockEnemy, level: 12 });
      expect(hard).toContain('Hard');
      
      const extreme = CombatTaskIntegration.getCombatDifficultyDescription(10, { ...mockEnemy, level: 16 });
      expect(extreme).toContain('Extreme');
    });
  });
});