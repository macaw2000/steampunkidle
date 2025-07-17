/**
 * Combat service for managing battle operations
 */

import { 
  Enemy, 
  CombatSession, 
  CombatZone,
  StartCombatRequest,
  StartCombatResponse,
  CompleteCombatRequest,
  CompleteCombatResponse,
  CombatSkillType,
  PlayerCombatStats,
  PlayerAbility,
  CombatLoot
} from '../types/combat';
import { Character } from '../types/character';
import { ENEMIES, COMBAT_ZONES, PLAYER_ABILITIES } from '../data/combatData';

export class CombatService {
  /**
   * Calculate combat skill level based on experience
   */
  static calculateSkillLevel(experience: number): number {
    return Math.floor(Math.sqrt(experience / 80)) + 1;
  }

  /**
   * Calculate experience required for a specific skill level
   */
  static calculateExperienceForSkillLevel(level: number): number {
    return Math.pow(level - 1, 2) * 80;
  }

  /**
   * Calculate player combat stats based on character
   */
  static calculatePlayerCombatStats(character: Character): PlayerCombatStats {
    const baseHealth = 100 + (character.level * 10) + (character.stats.vitality * 5);
    const baseAttack = 10 + (character.level * 2) + (character.stats.strength * 2);
    const baseDefense = 5 + (character.level * 1) + (character.stats.vitality * 1);
    const baseSpeed = 8 + (character.stats.dexterity * 0.5);
    
    // Combat skill bonuses
    const combatSkills = character.stats.combatSkills;
    const combatLevel = combatSkills.level || 1;
    const meleeBonus = combatLevel;
    const rangedBonus = combatLevel;
    const defenseBonus = combatLevel;
    const tacticsBonus = combatLevel;
    
    const finalAttack = baseAttack + Math.floor((meleeBonus + rangedBonus) * 0.5);
    const finalDefense = baseDefense + defenseBonus;
    const finalHealth = baseHealth + (defenseBonus * 5);
    const finalSpeed = baseSpeed + (tacticsBonus * 0.3);
    
    // Get available abilities
    const availableAbilities = PLAYER_ABILITIES.filter(
      ability => character.level >= ability.unlockLevel
    );
    
    return {
      health: finalHealth,
      maxHealth: finalHealth,
      attack: finalAttack,
      defense: finalDefense,
      speed: finalSpeed,
      abilities: availableAbilities
    };
  }

  /**
   * Calculate combat effectiveness against specific enemy
   */
  static calculateCombatEffectiveness(playerStats: PlayerCombatStats, enemy: Enemy): {
    winChance: number;
    estimatedDuration: number;
    recommendedLevel: number;
  } {
    const playerPower = playerStats.attack + playerStats.defense + (playerStats.health / 10);
    const enemyPower = enemy.stats.attack + enemy.stats.defense + (enemy.stats.health / 10);
    
    const powerRatio = playerPower / enemyPower;
    const winChance = Math.min(0.95, Math.max(0.05, (powerRatio - 0.5) * 0.8 + 0.5));
    
    const estimatedDuration = Math.max(10, Math.floor(
      (enemy.stats.health / Math.max(1, playerStats.attack - enemy.stats.defense)) * 3
    ));
    
    const recommendedLevel = Math.max(1, enemy.level - 2);
    
    return {
      winChance,
      estimatedDuration,
      recommendedLevel
    };
  }

  /**
   * Simulate combat outcome
   */
  static simulateCombat(playerStats: PlayerCombatStats, enemy: Enemy): {
    result: 'victory' | 'defeat';
    playerHealthRemaining: number;
    combatDuration: number;
    lootGained: CombatLoot[];
    experienceGained: number;
  } {
    let playerHealth = playerStats.health;
    let enemyHealth = enemy.stats.health;
    let combatDuration = 0;
    
    // Simple combat simulation
    while (playerHealth > 0 && enemyHealth > 0 && combatDuration < 300) {
      // Player turn
      const playerDamage = Math.max(1, playerStats.attack - enemy.stats.defense);
      enemyHealth -= playerDamage;
      
      if (enemyHealth <= 0) break;
      
      // Enemy turn
      const enemyDamage = Math.max(1, enemy.stats.attack - playerStats.defense);
      playerHealth -= enemyDamage;
      
      combatDuration += 3; // 3 seconds per round
    }
    
    const result = playerHealth > 0 ? 'victory' : 'defeat';
    const lootGained = result === 'victory' ? this.calculateLootDrops(enemy.lootTable) : [];
    const experienceGained = result === 'victory' ? enemy.experienceReward : Math.floor(enemy.experienceReward * 0.1);
    
    return {
      result,
      playerHealthRemaining: Math.max(0, playerHealth),
      combatDuration,
      lootGained,
      experienceGained
    };
  }

  /**
   * Calculate loot drops based on drop chances
   */
  static calculateLootDrops(lootTable: CombatLoot[]): CombatLoot[] {
    return lootTable.filter(loot => Math.random() < loot.dropChance);
  }

  /**
   * Get available enemies for a character
   */
  static getAvailableEnemies(character: Character): Enemy[] {
    return ENEMIES.filter(enemy => {
      // Character should be within reasonable level range
      return character.level >= (enemy.level - 3) && character.level <= (enemy.level + 5);
    });
  }

  /**
   * Get available combat zones for a character
   */
  static getAvailableCombatZones(character: Character): CombatZone[] {
    return COMBAT_ZONES.filter(zone => {
      return character.level >= zone.requiredLevel;
    });
  }

  /**
   * Start a combat session
   */
  static async startCombat(request: StartCombatRequest): Promise<StartCombatResponse> {
    try {
      const response = await fetch('/api/combat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start combat');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error starting combat:', error);
      throw error;
    }
  }

  /**
   * Complete a combat session
   */
  static async completeCombat(request: CompleteCombatRequest): Promise<CompleteCombatResponse> {
    try {
      const response = await fetch('/api/combat/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete combat');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error completing combat:', error);
      throw error;
    }
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
   * Get skill display information
   */
  static getSkillDisplay(skillType: CombatSkillType) {
    const skillInfo = {
      melee: {
        name: 'Melee Combat',
        description: 'Close-quarters combat with steam-powered weapons',
        icon: '⚔️',
        color: '#dc143c'
      },
      ranged: {
        name: 'Ranged Combat',
        description: 'Long-distance combat with steam rifles and projectiles',
        icon: '🏹',
        color: '#4682b4'
      },
      defense: {
        name: 'Defense',
        description: 'Protective techniques and armor mastery',
        icon: '🛡️',
        color: '#2e8b57'
      },
      tactics: {
        name: 'Tactics',
        description: 'Strategic combat planning and battlefield awareness',
        icon: '🧠',
        color: '#9370db'
      }
    };
    
    return skillInfo[skillType];
  }

  /**
   * Calculate combat efficiency based on character stats
   */
  static calculateCombatEfficiency(character: Character, combatType: 'melee' | 'ranged'): number {
    if (!character) return 1;

    const combatSkills = character.stats.combatSkills;
    const skillLevel = combatSkills.level || 1;
    const statBonus = combatType === 'melee' 
      ? character.stats.strength * 0.02 
      : character.stats.dexterity * 0.02;
    
    return 1 + (skillLevel * 0.08) + statBonus;
  }

  /**
   * Get recommended enemy based on character level and skills
   */
  static getRecommendedEnemy(character: Character): Enemy | null {
    const availableEnemies = this.getAvailableEnemies(character);
    
    if (availableEnemies.length === 0) return null;
    
    // Find enemy closest to character level
    return availableEnemies.reduce((best, current) => {
      const bestDiff = Math.abs(best.level - character.level);
      const currentDiff = Math.abs(current.level - character.level);
      return currentDiff < bestDiff ? current : best;
    });
  }

  /**
   * Format combat duration for display
   */
  static formatCombatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
  }

  /**
   * Calculate experience gain from combat
   */
  static calculateExperienceGain(
    enemy: Enemy, 
    result: 'victory' | 'defeat',
    playerLevel: number
  ): number {
    const baseExperience = enemy.experienceReward;
    const levelDifference = enemy.level - playerLevel;
    
    // Bonus/penalty based on level difference
    const levelMultiplier = 1 + (levelDifference * 0.1);
    
    // Result multiplier
    const resultMultiplier = result === 'victory' ? 1 : 0.1;
    
    return Math.floor(baseExperience * levelMultiplier * resultMultiplier);
  }

  /**
   * Get combat difficulty rating
   */
  static getCombatDifficulty(playerLevel: number, enemy: Enemy): 'trivial' | 'easy' | 'moderate' | 'hard' | 'extreme' {
    const levelDiff = enemy.level - playerLevel;
    
    if (levelDiff <= -3) return 'trivial';
    if (levelDiff <= -1) return 'easy';
    if (levelDiff <= 1) return 'moderate';
    if (levelDiff <= 3) return 'hard';
    return 'extreme';
  }
}

export default CombatService;