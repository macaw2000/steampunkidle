/**
 * Tests for Combat Reward Calculator
 */

import { CombatRewardCalculator } from '../combatRewardCalculator';
import { CombatService } from '../combatService';
import { ENEMIES } from '../../data/combatData';

// Mock the CombatService
jest.mock('../combatService', () => ({
  CombatService: {
    calculateCombatEffectiveness: jest.fn().mockReturnValue({
      winChance: 0.7,
      estimatedDuration: 30,
      recommendedLevel: 5
    }),
    calculateExperienceGain: jest.fn().mockReturnValue(100),
    calculateLootDrops: jest.fn().mockReturnValue([
      { itemId: 'test-item', name: 'Test Item', quantity: 1, dropChance: 1, rarity: 'common' }
    ]),
    simulateCombat: jest.fn().mockReturnValue({
      result: 'victory',
      playerHealthRemaining: 50,
      combatDuration: 25,
      lootGained: [],
      experienceGained: 100
    })
  }
}));

describe('CombatRewardCalculator', () => {
  const mockEnemy = ENEMIES[0]; // Use the first enemy from the data
  
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
        attack: 5,
        criticalChance: 0.1
      },
      requirements: [],
      durability: 100,
      maxDurability: 100
    },
    {
      equipmentId: 'test-armor',
      name: 'Test Armor',
      type: 'armor',
      stats: {
        defense: 8,
        health: 20
      },
      requirements: [],
      durability: 100,
      maxDurability: 100
    }
  ];
  
  const mockStrategy = {
    strategyId: 'aggressive',
    name: 'Aggressive',
    description: 'Focus on dealing damage',
    modifiers: [
      {
        type: 'damage',
        value: 0.2,
        description: 'Increased damage'
      },
      {
        type: 'defense',
        value: -0.1,
        description: 'Reduced defense'
      }
    ]
  };
  
  describe('createCombatTaskData', () => {
    it('should create combat task data with all required fields', () => {
      const playerStats = {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        vitality: 10,
        harvestingSkills: { level: 1 },
        craftingSkills: { level: 1 },
        combatSkills: { level: 1 }
      };
      
      const result = CombatRewardCalculator.createCombatTaskData(
        mockEnemy,
        playerStats,
        mockPlayerCombatStats,
        5,
        {
          equipment: mockEquipment,
          strategy: mockStrategy
        }
      );
      
      expect(result).toHaveProperty('enemy', mockEnemy);
      expect(result).toHaveProperty('playerLevel', 5);
      expect(result).toHaveProperty('playerStats', mockPlayerCombatStats);
      expect(result).toHaveProperty('equipment', mockEquipment);
      expect(result).toHaveProperty('combatStrategy', mockStrategy);
      expect(result).toHaveProperty('estimatedOutcome');
    });
    
    it('should use default strategy if none provided', () => {
      const playerStats = {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        vitality: 10,
        harvestingSkills: { level: 1 },
        craftingSkills: { level: 1 },
        combatSkills: { level: 1 }
      };
      
      const result = CombatRewardCalculator.createCombatTaskData(
        mockEnemy,
        playerStats,
        mockPlayerCombatStats,
        5,
        {
          equipment: mockEquipment
        }
      );
      
      expect(result.combatStrategy).toHaveProperty('strategyId', 'balanced');
      expect(result.combatStrategy).toHaveProperty('name', 'Balanced');
    });
  });
  
  describe('calculateCombatDuration', () => {
    it('should calculate combat duration based on player stats and enemy', () => {
      const result = CombatRewardCalculator.calculateCombatDuration(
        mockEnemy,
        mockPlayerCombatStats,
        mockEquipment,
        mockStrategy
      );
      
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });
    
    it('should apply equipment bonuses to duration', () => {
      const withoutEquipment = CombatRewardCalculator.calculateCombatDuration(
        mockEnemy,
        mockPlayerCombatStats,
        [],
        mockStrategy
      );
      
      const withEquipment = CombatRewardCalculator.calculateCombatDuration(
        mockEnemy,
        mockPlayerCombatStats,
        mockEquipment,
        mockStrategy
      );
      
      // Equipment with speed should reduce duration
      expect(withEquipment).toBeLessThanOrEqual(withoutEquipment);
    });
    
    it('should ensure minimum duration', () => {
      // Mock the service to return a very low duration
      (CombatService.calculateCombatEffectiveness as jest.Mock).mockReturnValueOnce({
        winChance: 0.9,
        estimatedDuration: 1, // Very low duration
        recommendedLevel: 1
      });
      
      const result = CombatRewardCalculator.calculateCombatDuration(
        mockEnemy,
        mockPlayerCombatStats
      );
      
      // Should enforce minimum duration of 5000ms (5 seconds)
      expect(result).toBeGreaterThanOrEqual(5000);
    });
  });
  
  describe('calculateCombatEstimate', () => {
    it('should calculate combat estimate with win probability and rewards', () => {
      const result = CombatRewardCalculator.calculateCombatEstimate(
        mockPlayerCombatStats,
        mockEnemy,
        5,
        mockEquipment,
        mockStrategy
      );
      
      expect(result).toHaveProperty('winProbability');
      expect(result).toHaveProperty('estimatedDuration');
      expect(result).toHaveProperty('expectedRewards');
      expect(result).toHaveProperty('riskLevel');
      
      expect(result.winProbability).toBeGreaterThan(0);
      expect(result.winProbability).toBeLessThanOrEqual(1);
      expect(result.estimatedDuration).toBeGreaterThan(0);
      expect(Array.isArray(result.expectedRewards)).toBe(true);
    });
    
    it('should determine risk level based on win probability', () => {
      // Mock different win probabilities
      const mockHighWinChance = jest.fn().mockReturnValue({
        winChance: 0.9,
        estimatedDuration: 20,
        recommendedLevel: 5
      });
      
      const mockLowWinChance = jest.fn().mockReturnValue({
        winChance: 0.2,
        estimatedDuration: 40,
        recommendedLevel: 10
      });
      
      // Test high win chance (low risk)
      (CombatService.calculateCombatEffectiveness as jest.Mock) = mockHighWinChance;
      const highWinResult = CombatRewardCalculator.calculateCombatEstimate(
        mockPlayerCombatStats,
        mockEnemy,
        5,
        mockEquipment
      );
      expect(highWinResult.riskLevel).toBe('low');
      
      // Test low win chance (extreme risk)
      (CombatService.calculateCombatEffectiveness as jest.Mock) = mockLowWinChance;
      const lowWinResult = CombatRewardCalculator.calculateCombatEstimate(
        mockPlayerCombatStats,
        mockEnemy,
        5,
        mockEquipment
      );
      expect(lowWinResult.riskLevel).toBe('extreme');
      
      // Restore original mock
      (CombatService.calculateCombatEffectiveness as jest.Mock) = jest.fn().mockReturnValue({
        winChance: 0.7,
        estimatedDuration: 30,
        recommendedLevel: 5
      });
    });
  });
  
  describe('calculateExpectedRewards', () => {
    it('should calculate expected rewards based on enemy and win probability', () => {
      const rewards = CombatRewardCalculator.calculateExpectedRewards(
        mockEnemy,
        0.7,
        5
      );
      
      expect(Array.isArray(rewards)).toBe(true);
      expect(rewards.length).toBeGreaterThan(0);
      
      // Should include experience reward
      const expReward = rewards.find(r => r.type === 'experience');
      expect(expReward).toBeDefined();
      expect(expReward?.quantity).toBeGreaterThan(0);
      
      // Should include item rewards
      const itemRewards = rewards.filter(r => r.type === 'item');
      expect(itemRewards.length).toBeGreaterThan(0);
    });
    
    it('should return no rewards if win probability is 0', () => {
      const rewards = CombatRewardCalculator.calculateExpectedRewards(
        mockEnemy,
        0,
        5
      );
      
      expect(rewards.length).toBe(0);
    });
  });
  
  describe('calculateCombatRewards', () => {
    it('should calculate actual rewards for victory', () => {
      const rewards = CombatRewardCalculator.calculateCombatRewards(
        mockEnemy,
        5,
        'victory'
      );
      
      expect(Array.isArray(rewards)).toBe(true);
      expect(rewards.length).toBeGreaterThan(0);
      
      // Should include experience reward
      const expReward = rewards.find(r => r.type === 'experience');
      expect(expReward).toBeDefined();
      expect(expReward?.quantity).toBeGreaterThan(0);
      
      // Should include item rewards for victory
      const itemRewards = rewards.filter(r => r.type === 'item');
      expect(itemRewards.length).toBeGreaterThan(0);
    });
    
    it('should calculate reduced rewards for defeat', () => {
      const rewards = CombatRewardCalculator.calculateCombatRewards(
        mockEnemy,
        5,
        'defeat'
      );
      
      expect(Array.isArray(rewards)).toBe(true);
      
      // Should include reduced experience reward
      const expReward = rewards.find(r => r.type === 'experience');
      expect(expReward).toBeDefined();
      expect(expReward?.quantity).toBeGreaterThan(0);
      
      // Should not include item rewards for defeat
      const itemRewards = rewards.filter(r => r.type === 'item');
      expect(itemRewards.length).toBe(0);
    });
  });
  
  describe('simulateCombatOutcome', () => {
    it('should simulate combat and return outcome', () => {
      const result = CombatRewardCalculator.simulateCombatOutcome(
        mockPlayerCombatStats,
        mockEnemy,
        mockEquipment,
        mockStrategy
      );
      
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('playerHealthRemaining');
      expect(result).toHaveProperty('combatDuration');
      
      expect(['victory', 'defeat']).toContain(result.result);
      expect(result.playerHealthRemaining).toBeGreaterThanOrEqual(0);
      expect(result.combatDuration).toBeGreaterThan(0);
    });
    
    it('should apply equipment bonuses to combat stats', () => {
      CombatRewardCalculator.simulateCombatOutcome(
        mockPlayerCombatStats,
        mockEnemy,
        mockEquipment
      );
      
      // Check that CombatService.simulateCombat was called with enhanced stats
      const simulateCombatCall = (CombatService.simulateCombat as jest.Mock).mock.calls[0];
      const enhancedStats = simulateCombatCall[0];
      
      // Stats should be enhanced by equipment
      expect(enhancedStats.attack).toBeGreaterThan(mockPlayerCombatStats.attack);
      expect(enhancedStats.defense).toBeGreaterThan(mockPlayerCombatStats.defense);
    });
  });
});