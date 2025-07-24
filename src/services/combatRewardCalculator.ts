/**
 * Combat Reward Calculator
 * Calculates rewards and outcomes for combat tasks
 */

import { 
  Enemy, 
  PlayerCombatStats, 
  CombatLoot 
} from '../types/combat';
import { 
  TaskReward, 
  CombatTaskData, 
  Equipment, 
  CombatEstimate, 
  CombatStrategy 
} from '../types/taskQueue';
import { CharacterStats } from '../types/character';
import { CombatService } from './combatService';

export class CombatRewardCalculator {
  /**
   * Create combat task data with all necessary information
   */
  static createCombatTaskData(
    enemy: Enemy,
    playerStats: CharacterStats,
    playerCombatStats: PlayerCombatStats,
    playerLevel: number,
    options: {
      equipment?: Equipment[];
      strategy?: CombatStrategy;
    } = {}
  ): CombatTaskData {
    // Use provided equipment or empty array
    const equipment = options.equipment || [];
    
    // Use provided strategy or default balanced strategy
    const strategy = options.strategy || {
      strategyId: 'balanced',
      name: 'Balanced',
      description: 'Balanced attack and defense',
      modifiers: []
    };
    
    // Calculate combat estimate
    const estimatedOutcome = this.calculateCombatEstimate(
      playerCombatStats,
      enemy,
      playerLevel,
      equipment,
      strategy
    );
    
    return {
      enemy,
      playerLevel,
      playerStats: playerCombatStats,
      equipment,
      combatStrategy: strategy,
      estimatedOutcome
    };
  }
  
  /**
   * Calculate combat duration based on player stats and enemy
   */
  static calculateCombatDuration(
    enemy: Enemy,
    playerCombatStats: PlayerCombatStats,
    equipment: Equipment[] = [],
    strategy?: CombatStrategy
  ): number {
    // Base duration calculation from combat service
    const combatEffectiveness = CombatService.calculateCombatEffectiveness(
      playerCombatStats,
      enemy
    );
    
    // Convert to milliseconds
    let duration = combatEffectiveness.estimatedDuration * 1000;
    
    // Apply equipment bonuses
    for (const item of equipment) {
      if (item.stats.speed) {
        // Speed bonus reduces combat time
        const speedBonus = item.stats.speed * 0.02; // 2% reduction per speed point
        duration *= (1 - Math.min(0.5, speedBonus)); // Cap at 50% reduction
      }
    }
    
    // Apply strategy modifiers
    if (strategy) {
      for (const modifier of strategy.modifiers) {
        if (modifier.type === 'speed') {
          duration *= (1 - Math.min(0.3, modifier.value)); // Cap at 30% reduction
        }
      }
    }
    
    // Ensure minimum duration
    return Math.max(5000, Math.floor(duration)); // Minimum 5 seconds
  }
  
  /**
   * Calculate combat estimate including win probability and rewards
   */
  static calculateCombatEstimate(
    playerCombatStats: PlayerCombatStats,
    enemy: Enemy,
    playerLevel: number,
    equipment: Equipment[] = [],
    strategy?: CombatStrategy
  ): CombatEstimate {
    // Calculate base combat effectiveness
    const baseEffectiveness = CombatService.calculateCombatEffectiveness(
      playerCombatStats,
      enemy
    );
    
    // Calculate equipment bonuses
    let attackBonus = 0;
    let defenseBonus = 0;
    let healthBonus = 0;
    
    for (const item of equipment) {
      if (item.stats.attack) attackBonus += item.stats.attack;
      if (item.stats.defense) defenseBonus += item.stats.defense;
      if (item.stats.health) healthBonus += item.stats.health;
    }
    
    // Apply equipment bonuses to win probability
    const equipmentPowerBonus = (attackBonus + defenseBonus + (healthBonus / 10)) / 100;
    let winProbability = baseEffectiveness.winChance + equipmentPowerBonus;
    
    // Apply strategy modifiers
    if (strategy) {
      for (const modifier of strategy.modifiers) {
        if (modifier.type === 'damage') {
          winProbability += modifier.value * 0.05; // 5% per damage point
        }
        if (modifier.type === 'defense') {
          winProbability += modifier.value * 0.03; // 3% per defense point
        }
      }
    }
    
    // Cap win probability
    winProbability = Math.min(0.95, Math.max(0.05, winProbability));
    
    // Calculate estimated duration
    const estimatedDuration = this.calculateCombatDuration(
      enemy,
      playerCombatStats,
      equipment,
      strategy
    ) / 1000; // Convert back to seconds for the estimate
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'extreme' = 'medium';
    if (winProbability > 0.8) riskLevel = 'low';
    else if (winProbability > 0.6) riskLevel = 'medium';
    else if (winProbability > 0.3) riskLevel = 'high';
    else riskLevel = 'extreme';
    
    // Calculate expected rewards
    const expectedRewards = this.calculateExpectedRewards(
      enemy,
      winProbability,
      playerLevel
    );
    
    return {
      winProbability,
      estimatedDuration,
      expectedRewards,
      riskLevel
    };
  }
  
  /**
   * Calculate expected rewards based on enemy loot table and win probability
   */
  static calculateExpectedRewards(
    enemy: Enemy,
    winProbability: number,
    playerLevel: number
  ): TaskReward[] {
    const rewards: TaskReward[] = [];
    
    // Only get rewards if victory is likely
    if (winProbability > 0) {
      // Experience reward
      const baseExperience = enemy.experienceReward;
      const levelDifference = enemy.level - playerLevel;
      const levelMultiplier = 1 + (levelDifference * 0.1);
      const adjustedExperience = Math.floor(baseExperience * levelMultiplier * winProbability);
      
      rewards.push({
        type: 'experience',
        quantity: adjustedExperience,
        isRare: false
      });
      
      // Item rewards from loot table
      for (const loot of enemy.lootTable) {
        // Adjust drop chance based on win probability
        const adjustedDropChance = loot.dropChance * winProbability;
        
        if (adjustedDropChance > 0) {
          rewards.push({
            type: 'item',
            itemId: loot.itemId,
            quantity: loot.quantity,
            rarity: loot.rarity,
            isRare: loot.rarity !== 'common'
          });
        }
      }
    }
    
    return rewards;
  }
  
  /**
   * Calculate actual combat rewards based on outcome
   */
  static calculateCombatRewards(
    enemy: Enemy,
    playerLevel: number,
    result: 'victory' | 'defeat'
  ): TaskReward[] {
    const rewards: TaskReward[] = [];
    
    // Experience reward
    const experienceGained = CombatService.calculateExperienceGain(
      enemy,
      result,
      playerLevel
    );
    
    rewards.push({
      type: 'experience',
      quantity: experienceGained,
      isRare: false
    });
    
    // Item rewards only if victorious
    if (result === 'victory') {
      // Calculate actual loot drops
      const lootDrops = CombatService.calculateLootDrops(enemy.lootTable);
      
      for (const loot of lootDrops) {
        rewards.push({
          type: 'item',
          itemId: loot.itemId,
          quantity: loot.quantity,
          rarity: loot.rarity,
          isRare: loot.rarity !== 'common'
        });
      }
    }
    
    return rewards;
  }
  
  /**
   * Simulate combat outcome
   */
  static simulateCombatOutcome(
    playerCombatStats: PlayerCombatStats,
    enemy: Enemy,
    equipment: Equipment[] = [],
    strategy?: CombatStrategy
  ): {
    result: 'victory' | 'defeat';
    playerHealthRemaining: number;
    combatDuration: number;
  } {
    // Apply equipment bonuses
    const enhancedStats = { ...playerCombatStats };
    
    for (const item of equipment) {
      if (item.stats.attack) enhancedStats.attack += item.stats.attack;
      if (item.stats.defense) enhancedStats.defense += item.stats.defense;
      if (item.stats.health) enhancedStats.health += item.stats.health;
      // maxHealth property doesn't exist in EquipmentStats, using health instead
    }
    
    // Apply strategy modifiers
    if (strategy) {
      for (const modifier of strategy.modifiers) {
        if (modifier.type === 'damage') {
          enhancedStats.attack += modifier.value;
        }
        if (modifier.type === 'defense') {
          enhancedStats.defense += modifier.value;
        }
      }
    }
    
    // Simulate combat with enhanced stats
    return CombatService.simulateCombat(enhancedStats, enemy);
  }
}

export default CombatRewardCalculator;