/**
 * Currency service for managing in-game currency operations
 */

import {
  CurrencyTransaction,
  CurrencyBalance,
  CurrencyHistory,
  EarnCurrencyRequest,
  SpendCurrencyRequest,
  TransferCurrencyRequest,
  GetCurrencyHistoryRequest,
  CurrencyValidationResult,
  CURRENCY_CONFIG,
  CurrencySource,
} from '../types/currency';
import { Character, ActivityType } from '../types/character';

export class CurrencyService {
  /**
   * Calculate currency earned from activity based on time and character stats
   */
  static calculateActivityCurrencyReward(
    activityType: ActivityType,
    minutes: number,
    character: Character
  ): number {
    const config = CURRENCY_CONFIG.ACTIVITY_RATES[activityType];
    if (!config) return 0;

    const baseReward = config.baseRate * minutes;
    
    // Get relevant skill level for activity
    let skillLevel = 0;
    switch (activityType) {
      case 'crafting':
        skillLevel = character.stats.craftingSkills.level;
        break;
      case 'harvesting':
        skillLevel = character.stats.harvestingSkills.level;
        break;
      case 'combat':
        skillLevel = character.stats.combatSkills.level;
        break;
    }

    const skillBonus = skillLevel * config.skillMultiplier * minutes;
    const totalReward = Math.floor(baseReward + skillBonus);

    return Math.max(1, totalReward); // Minimum 1 coin
  }

  /**
   * Calculate currency reward for crafting completion
   */
  static calculateCraftingCurrencyReward(
    itemValue: number,
    qualityModifier: number,
    skillLevel: number
  ): number {
    const baseReward = Math.floor(itemValue * 0.3); // 30% of item value
    const qualityBonus = Math.floor(baseReward * (qualityModifier - 1)); // Bonus for high quality
    const skillBonus = Math.floor(skillLevel * 0.5); // Small skill bonus
    
    return Math.max(1, baseReward + qualityBonus + skillBonus);
  }

  /**
   * Calculate currency reward for harvesting
   */
  static calculateHarvestingCurrencyReward(
    resourcesValue: number,
    skillLevel: number,
    rarityMultiplier: number = 1
  ): number {
    const baseReward = Math.floor(resourcesValue * 0.4); // 40% of resources value
    const skillBonus = Math.floor(skillLevel * 0.3);
    const rarityBonus = Math.floor(baseReward * (rarityMultiplier - 1));
    
    return Math.max(1, baseReward + skillBonus + rarityBonus);
  }

  /**
   * Calculate currency reward for combat victory
   */
  static calculateCombatCurrencyReward(
    enemyLevel: number,
    playerLevel: number,
    lootValue: number = 0
  ): number {
    const levelDifference = Math.max(0, enemyLevel - playerLevel + 1);
    const baseReward = 10 + (enemyLevel * 2); // Base reward scales with enemy level
    const difficultyBonus = levelDifference * 3; // Bonus for fighting higher level enemies
    const lootBonus = Math.floor(lootValue * 0.2); // 20% of loot value
    
    return Math.max(5, baseReward + difficultyBonus + lootBonus);
  }

  /**
   * Validate currency transaction
   */
  static validateTransaction(
    currentBalance: number,
    amount: number,
    type: 'earn' | 'spend'
  ): CurrencyValidationResult {
    if (amount < CURRENCY_CONFIG.MIN_TRANSACTION) {
      return {
        isValid: false,
        error: `Minimum transaction amount is ${CURRENCY_CONFIG.MIN_TRANSACTION}`,
        currentBalance,
      };
    }

    if (type === 'spend' && currentBalance < amount) {
      return {
        isValid: false,
        error: 'Insufficient funds',
        currentBalance,
      };
    }

    if (type === 'earn' && currentBalance + amount > CURRENCY_CONFIG.MAX_BALANCE) {
      return {
        isValid: false,
        error: 'Maximum balance exceeded',
        currentBalance,
      };
    }

    return {
      isValid: true,
      currentBalance,
    };
  }

  /**
   * Earn currency
   */
  static async earnCurrency(request: EarnCurrencyRequest): Promise<CurrencyTransaction> {
    try {
      const response = await fetch('/api/currency/earn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to earn currency');
      }

      const result = await response.json();
      return result.transaction;
    } catch (error) {
      console.error('Error earning currency:', error);
      throw error;
    }
  }

  /**
   * Spend currency
   */
  static async spendCurrency(request: SpendCurrencyRequest): Promise<CurrencyTransaction> {
    try {
      const response = await fetch('/api/currency/spend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to spend currency');
      }

      const result = await response.json();
      return result.transaction;
    } catch (error) {
      console.error('Error spending currency:', error);
      throw error;
    }
  }

  /**
   * Transfer currency between users
   */
  static async transferCurrency(request: TransferCurrencyRequest): Promise<{
    fromTransaction: CurrencyTransaction;
    toTransaction: CurrencyTransaction;
  }> {
    try {
      const response = await fetch('/api/currency/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to transfer currency');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error transferring currency:', error);
      throw error;
    }
  }

  /**
   * Get currency balance
   */
  static async getCurrencyBalance(userId: string): Promise<CurrencyBalance> {
    try {
      const response = await fetch(`/api/currency/${userId}/balance`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get currency balance');
      }

      const result = await response.json();
      return result.balance;
    } catch (error) {
      console.error('Error getting currency balance:', error);
      throw error;
    }
  }

  /**
   * Get currency transaction history
   */
  static async getCurrencyHistory(request: GetCurrencyHistoryRequest): Promise<CurrencyHistory> {
    try {
      const queryParams = new URLSearchParams();
      if (request.page) queryParams.append('page', request.page.toString());
      if (request.limit) queryParams.append('limit', request.limit.toString());
      if (request.source) queryParams.append('source', request.source);

      const response = await fetch(`/api/currency/${request.userId}/history?${queryParams}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get currency history');
      }

      const result = await response.json();
      return result.history;
    } catch (error) {
      console.error('Error getting currency history:', error);
      throw error;
    }
  }

  /**
   * Format currency amount for display
   */
  static formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toString();
  }

  /**
   * Get currency display name
   */
  static getCurrencyDisplayName(): string {
    return 'Steam Coins';
  }

  /**
   * Get currency icon
   */
  static getCurrencyIcon(): string {
    return '⚙️';
  }

  /**
   * Get source display name
   */
  static getSourceDisplayName(source: CurrencySource): string {
    const sourceNames = {
      activity: 'Activity Rewards',
      crafting: 'Crafting',
      harvesting: 'Harvesting',
      combat: 'Combat',
      auction: 'Marketplace',
      guild: 'Guild',
      admin: 'System',
    };
    
    return sourceNames[source] || source;
  }

  /**
   * Generate transaction description for activity rewards
   */
  static generateActivityDescription(
    activityType: ActivityType,
    minutes: number,
    amount: number
  ): string {
    const activityNames = {
      crafting: 'Clockwork Crafting',
      harvesting: 'Resource Gathering',
      combat: 'Automaton Combat',
    };
    
    const activityName = activityNames[activityType] || activityType;
    const timeStr = minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    
    return `${activityName} for ${timeStr}`;
  }

  /**
   * Check if user can afford purchase
   */
  static async canAfford(userId: string, amount: number): Promise<boolean> {
    try {
      const balance = await this.getCurrencyBalance(userId);
      return balance.balance >= amount;
    } catch (error) {
      console.error('Error checking affordability:', error);
      return false;
    }
  }

  /**
   * Get transaction type icon
   */
  static getTransactionTypeIcon(type: CurrencyTransaction['type']): string {
    const icons = {
      earned: '💰',
      spent: '💸',
      transferred: '🔄',
    };
    
    return icons[type] || '💰';
  }

  /**
   * Calculate daily currency limit based on character level
   */
  static calculateDailyCurrencyLimit(characterLevel: number): number {
    const baseLimit = 1000;
    const levelBonus = characterLevel * 50;
    return baseLimit + levelBonus;
  }

  /**
   * Get currency earning tips for players
   */
  static getCurrencyEarningTips(): string[] {
    return [
      'Higher skill levels increase currency rewards from activities',
      'Combat against stronger enemies yields more coins',
      'High-quality crafted items provide bonus currency',
      'Rare harvesting resources give extra coin rewards',
      'Sell items on the marketplace for additional income',
      'Complete guild activities for bonus rewards',
    ];
  }
}

export default CurrencyService;