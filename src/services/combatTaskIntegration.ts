/**
 * Combat Task Integration
 * Integrates combat system with the task queue
 */

import { 
  Enemy, 
  PlayerCombatStats, 
  CombatZone 
} from '../types/combat';
import { 
  Task, 
  TaskType, 
  Equipment, 
  CombatStrategy 
} from '../types/taskQueue';
import { CharacterStats } from '../types/character';
import { TaskUtils } from '../utils/taskUtils';
import { CombatRewardCalculator } from './combatRewardCalculator';
import { CombatService } from './combatService';
import { ENEMIES, COMBAT_ZONES } from '../data/combatData';

export class CombatTaskIntegration {
  /**
   * Create a combat task
   */
  static createCombatTask(
    playerId: string,
    enemy: Enemy,
    playerStats: CharacterStats,
    playerLevel: number,
    playerCombatStats: PlayerCombatStats,
    options: {
      priority?: number;
      equipment?: Equipment[];
      strategy?: CombatStrategy;
    } = {}
  ): Task {
    return TaskUtils.createCombatTask(
      playerId,
      enemy,
      playerStats,
      playerLevel,
      playerCombatStats,
      options
    );
  }
  
  /**
   * Get available enemies for player level
   */
  static getAvailableEnemies(playerLevel: number): Enemy[] {
    return ENEMIES.filter(enemy => {
      // Player should be within reasonable level range
      return playerLevel >= (enemy.level - 3) && playerLevel <= (enemy.level + 5);
    });
  }
  
  /**
   * Get available combat zones for player level
   */
  static getAvailableCombatZones(playerLevel: number): CombatZone[] {
    return COMBAT_ZONES.filter(zone => {
      return playerLevel >= zone.requiredLevel;
    });
  }
  
  /**
   * Get recommended enemy for player level
   */
  static getRecommendedEnemy(playerLevel: number): Enemy | null {
    const availableEnemies = this.getAvailableEnemies(playerLevel);
    
    if (availableEnemies.length === 0) return null;
    
    // Find enemy closest to player level
    return availableEnemies.reduce((best, current) => {
      const bestDiff = Math.abs(best.level - playerLevel);
      const currentDiff = Math.abs(current.level - playerLevel);
      return currentDiff < bestDiff ? current : best;
    });
  }
  
  /**
   * Calculate combat task duration
   */
  static calculateCombatDuration(
    enemy: Enemy,
    playerCombatStats: PlayerCombatStats,
    equipment: Equipment[] = [],
    strategy?: CombatStrategy
  ): number {
    return CombatRewardCalculator.calculateCombatDuration(
      enemy,
      playerCombatStats,
      equipment,
      strategy
    );
  }
  
  /**
   * Check if player meets requirements for combat
   */
  static checkCombatRequirements(
    enemy: Enemy,
    playerLevel: number,
    playerCombatStats: PlayerCombatStats,
    equipment: Equipment[] = []
  ): {
    meetsRequirements: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check level requirement
    const recommendedLevel = Math.max(1, enemy.level - 2);
    if (playerLevel < recommendedLevel) {
      errors.push(`Player level ${playerLevel} is below recommended level ${recommendedLevel}`);
    } else if (playerLevel === recommendedLevel) {
      warnings.push(`Player is at minimum recommended level for this enemy`);
    }
    
    // Check equipment
    let hasWeapon = false;
    let hasArmor = false;
    
    for (const item of equipment) {
      if (item.type === 'weapon') hasWeapon = true;
      if (item.type === 'armor') hasArmor = true;
      
      // Check durability
      if (item.durability <= 0) {
        errors.push(`Equipment ${item.name} is broken and cannot be used`);
      } else if (item.durability < item.maxDurability * 0.2) {
        warnings.push(`Equipment ${item.name} has low durability`);
      }
      
      // Check requirements
      for (const req of item.requirements) {
        if (!req.isMet) {
          errors.push(`Cannot use ${item.name}: ${req.description}`);
        }
      }
    }
    
    // Warn about missing equipment
    if (!hasWeapon) {
      warnings.push('No weapon equipped for combat');
    }
    
    if (!hasArmor) {
      warnings.push('No armor equipped for combat');
    }
    
    // Check health
    if (playerCombatStats.health < playerCombatStats.maxHealth * 0.5) {
      errors.push(`Health too low for combat (${playerCombatStats.health}/${playerCombatStats.maxHealth})`);
    } else if (playerCombatStats.health < playerCombatStats.maxHealth * 0.7) {
      warnings.push(`Health is below optimal level for combat`);
    }
    
    // Check combat estimate
    const estimate = CombatRewardCalculator.calculateCombatEstimate(
      playerCombatStats,
      enemy,
      playerLevel,
      equipment
    );
    
    if (estimate.winProbability < 0.3) {
      errors.push(`Very low chance of victory (${Math.round(estimate.winProbability * 100)}%)`);
    } else if (estimate.winProbability < 0.5) {
      warnings.push(`Low chance of victory (${Math.round(estimate.winProbability * 100)}%)`);
    }
    
    return {
      meetsRequirements: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Process combat task completion
   */
  static processCombatCompletion(
    task: Task,
    playerLevel: number
  ): {
    result: 'victory' | 'defeat';
    rewards: any[];
    experienceGained: number;
    healthRemaining: number;
  } {
    const combatData = task.activityData as any;
    const enemy = combatData.enemy;
    const playerCombatStats = combatData.playerStats;
    const equipment = combatData.equipment || [];
    const strategy = combatData.combatStrategy;
    
    // Simulate combat outcome
    const outcome = CombatRewardCalculator.simulateCombatOutcome(
      playerCombatStats,
      enemy,
      equipment,
      strategy
    );
    
    // Calculate rewards based on outcome
    const rewards = CombatRewardCalculator.calculateCombatRewards(
      enemy,
      playerLevel,
      outcome.result
    );
    
    // Extract experience gained
    const experienceReward = rewards.find(r => r.type === 'experience');
    const experienceGained = experienceReward ? experienceReward.quantity : 0;
    
    return {
      result: outcome.result,
      rewards,
      experienceGained,
      healthRemaining: outcome.playerHealthRemaining
    };
  }
  
  /**
   * Get enemy by ID
   */
  static getEnemyById(enemyId: string): Enemy | null {
    return ENEMIES.find(enemy => enemy.enemyId === enemyId) || null;
  }
  
  /**
   * Get combat zone by ID
   */
  static getCombatZoneById(zoneId: string): CombatZone | null {
    return COMBAT_ZONES.find(zone => zone.zoneId === zoneId) || null;
  }
  
  /**
   * Get combat difficulty description
   */
  static getCombatDifficultyDescription(playerLevel: number, enemy: Enemy): string {
    const difficulty = CombatService.getCombatDifficulty(playerLevel, enemy);
    
    switch (difficulty) {
      case 'trivial':
        return 'Trivial - Victory is almost certain';
      case 'easy':
        return 'Easy - Should be a straightforward victory';
      case 'moderate':
        return 'Moderate - A fair challenge';
      case 'hard':
        return 'Hard - Will require skill and good equipment';
      case 'extreme':
        return 'Extreme - Very dangerous, attempt at your own risk';
      default:
        return 'Unknown difficulty';
    }
  }
}

export default CombatTaskIntegration;