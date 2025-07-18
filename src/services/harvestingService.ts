/**
 * Harvesting Service
 * Handles all harvesting activities, resource generation, and player progression
 */

import { 
  HarvestingActivity, 
  HarvestingSession, 
  HarvestingReward, 
  PlayerHarvestingStats,
  ResourceRarity,
  HarvestingCategory,
  DropTable,
  EnhancedHarvestingReward,
  ExoticItem
} from '../types/harvesting';
import { HARVESTING_ACTIVITIES } from '../data/harvestingActivities';
import { HARVESTING_RESOURCES } from '../data/harvestingResources';
import { getExoticItemsByCategory } from '../data/exoticItems';
import { getPrimaryMaterialForActivity } from '../data/primaryMaterials';

class HarvestingService {
  private sessions: Map<string, HarvestingSession> = new Map();
  private playerStats: Map<string, PlayerHarvestingStats> = new Map();

  /**
   * Get all available harvesting activities
   */
  getActivities(): HarvestingActivity[] {
    return HARVESTING_ACTIVITIES;
  }

  /**
   * Get activities available to a player based on their level and stats
   */
  getAvailableActivities(playerId: string, playerLevel: number, playerStats: any): HarvestingActivity[] {
    return HARVESTING_ACTIVITIES.filter(activity => {
      // Check level requirement
      if (activity.requiredLevel > playerLevel) {
        return false;
      }

      // Check stat requirements
      if (activity.requiredStats) {
        for (const [stat, required] of Object.entries(activity.requiredStats)) {
          if ((playerStats[stat] || 0) < required) {
            return false;
          }
        }
      }

      // Check unlock conditions
      if (activity.unlockConditions) {
        const stats = this.getPlayerStats(playerId);
        for (const condition of activity.unlockConditions) {
          if (!this.checkUnlockCondition(condition, playerLevel, playerStats, stats)) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Get activities by category
   */
  getActivitiesByCategory(category: HarvestingCategory): HarvestingActivity[] {
    return HARVESTING_ACTIVITIES.filter(activity => activity.category === category);
  }

  /**
   * Start a harvesting session
   */
  startHarvesting(playerId: string, activityId: string, playerStats: any): HarvestingSession {
    const activity = HARVESTING_ACTIVITIES.find(a => a.id === activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Check if player has enough energy
    // This would integrate with your character system
    
    // Calculate actual duration based on player stats
    const duration = this.calculateHarvestingTime(activity, playerStats);

    const session: HarvestingSession = {
      activityId,
      startTime: Date.now(),
      duration: duration * 1000, // Convert to milliseconds
      playerId,
      completed: false
    };

    this.sessions.set(`${playerId}-${activityId}-${Date.now()}`, session);
    
    // Update player stats
    this.updatePlayerStats(playerId, activity);

    return session;
  }

  /**
   * Complete a harvesting session and generate rewards
   */
  completeHarvesting(sessionId: string): HarvestingReward[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.completed) {
      throw new Error('Session already completed');
    }

    const currentTime = Date.now();
    if (currentTime < session.startTime + session.duration) {
      throw new Error('Session not yet complete');
    }

    const activity = HARVESTING_ACTIVITIES.find(a => a.id === session.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Generate rewards based on drop table
    const rewards = this.generateRewards(activity.dropTable);
    
    session.completed = true;
    session.rewards = rewards;

    // Update player harvesting stats
    this.updateHarvestingStats(session.playerId, activity, rewards);

    return rewards;
  }

  /**
   * Get active harvesting sessions for a player
   */
  getActiveSessions(playerId: string): HarvestingSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.playerId === playerId && !session.completed);
  }

  /**
   * Get player harvesting statistics
   */
  getPlayerStats(playerId: string): PlayerHarvestingStats {
    if (!this.playerStats.has(playerId)) {
      this.playerStats.set(playerId, {
        playerId,
        totalHarvests: 0,
        totalTimeSpent: 0,
        activitiesUnlocked: [],
        categoryLevels: {
          [HarvestingCategory.LITERARY]: 1,
          [HarvestingCategory.MECHANICAL]: 1,
          [HarvestingCategory.ALCHEMICAL]: 1,
          [HarvestingCategory.ARCHAEOLOGICAL]: 1,
          [HarvestingCategory.BOTANICAL]: 1,
          [HarvestingCategory.METALLURGICAL]: 1,
          [HarvestingCategory.ELECTRICAL]: 1,
          [HarvestingCategory.AERONAUTICAL]: 1
        },
        categoryExperience: {
          [HarvestingCategory.LITERARY]: 0,
          [HarvestingCategory.MECHANICAL]: 0,
          [HarvestingCategory.ALCHEMICAL]: 0,
          [HarvestingCategory.ARCHAEOLOGICAL]: 0,
          [HarvestingCategory.BOTANICAL]: 0,
          [HarvestingCategory.METALLURGICAL]: 0,
          [HarvestingCategory.ELECTRICAL]: 0,
          [HarvestingCategory.AERONAUTICAL]: 0
        },
        rareFindCount: 0,
        legendaryFindCount: 0
      });
    }
    return this.playerStats.get(playerId)!;
  }

  /**
   * Get resource information
   */
  getResource(resourceId: string) {
    return HARVESTING_RESOURCES.find(r => r.id === resourceId);
  }

  /**
   * Get all resources by category
   */
  getResourcesByCategory(category: string) {
    return HARVESTING_RESOURCES.filter(r => r.category === category);
  }

  /**
   * Calculate harvesting time based on player stats
   */
  private calculateHarvestingTime(activity: HarvestingActivity, playerStats: any): number {
    let timeModifier = 1.0;

    // Apply stat bonuses to reduce time
    if (activity.requiredStats) {
      for (const [stat, required] of Object.entries(activity.requiredStats)) {
        const playerStat = playerStats[stat] || 0;
        if (playerStat > required) {
          // 1% time reduction per stat point above requirement
          const bonus = (playerStat - required) * 0.01;
          timeModifier -= Math.min(bonus, 0.5); // Cap at 50% reduction
        }
      }
    }

    // Ensure minimum time
    timeModifier = Math.max(timeModifier, 0.3); // Never less than 30% of base time

    return Math.floor(activity.baseTime * timeModifier);
  }

  /**
   * Generate rewards from drop table
   */
  generateRewards(dropTable: DropTable): HarvestingReward[] {
    const rewards: HarvestingReward[] = [];

    // Process guaranteed drops
    for (const drop of dropTable.guaranteed) {
      const quantity = this.randomBetween(drop.minQuantity, drop.maxQuantity);
      rewards.push({
        itemId: drop.itemId,
        quantity,
        rarity: ResourceRarity.COMMON,
        isRare: false
      });
    }

    // Process chance-based drops
    const rarityTables = [
      { drops: dropTable.common, rarity: ResourceRarity.COMMON },
      { drops: dropTable.uncommon, rarity: ResourceRarity.UNCOMMON },
      { drops: dropTable.rare, rarity: ResourceRarity.RARE },
      { drops: dropTable.legendary, rarity: ResourceRarity.LEGENDARY }
    ];

    for (const table of rarityTables) {
      for (const drop of table.drops) {
        if (Math.random() < drop.dropRate) {
          const quantity = this.randomBetween(drop.minQuantity, drop.maxQuantity);
          rewards.push({
            itemId: drop.itemId,
            quantity,
            rarity: table.rarity,
            isRare: table.rarity === ResourceRarity.RARE || table.rarity === ResourceRarity.LEGENDARY
          });
        }
      }
    }

    return rewards;
  }

  /**
   * Update player statistics after harvesting
   */
  private updatePlayerStats(playerId: string, activity: HarvestingActivity): void {
    const stats = this.getPlayerStats(playerId);
    
    // Add activity to unlocked list if not already there
    if (!stats.activitiesUnlocked.includes(activity.id)) {
      stats.activitiesUnlocked.push(activity.id);
    }
  }

  /**
   * Update harvesting statistics after completion
   */
  private updateHarvestingStats(playerId: string, activity: HarvestingActivity, rewards: HarvestingReward[]): void {
    const stats = this.getPlayerStats(playerId);
    
    stats.totalHarvests++;
    stats.totalTimeSpent += activity.baseTime;
    
    // Add category experience
    const expGain = activity.statBonuses.experience || 10;
    stats.categoryExperience[activity.category] += expGain;
    
    // Check for level up
    const currentExp = stats.categoryExperience[activity.category];
    const currentLevel = stats.categoryLevels[activity.category];
    const expForNextLevel = this.getExpRequiredForLevel(currentLevel + 1);
    
    if (currentExp >= expForNextLevel) {
      stats.categoryLevels[activity.category]++;
    }

    // Count rare finds
    for (const reward of rewards) {
      if (reward.rarity === ResourceRarity.RARE) {
        stats.rareFindCount++;
      } else if (reward.rarity === ResourceRarity.LEGENDARY) {
        stats.legendaryFindCount++;
      }
    }

    // Update favorite activity (most used)
    // This would require tracking usage counts
  }

  /**
   * Check unlock conditions
   */
  private checkUnlockCondition(condition: any, playerLevel: number, playerStats: any, harvestingStats: PlayerHarvestingStats): boolean {
    switch (condition.type) {
      case 'level':
        return playerLevel >= condition.requirement;
      case 'stat':
        return (playerStats[condition.requirement] || 0) >= condition.value;
      case 'activity':
        return harvestingStats.activitiesUnlocked.includes(condition.requirement);
      default:
        return true;
    }
  }

  /**
   * Calculate experience required for a level
   */
  private getExpRequiredForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  /**
   * Generate random number between min and max (inclusive)
   */
  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Get session progress (0-1)
   */
  getSessionProgress(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;

    const elapsed = Date.now() - session.startTime;
    return Math.min(elapsed / session.duration, 1);
  }

  /**
   * Cancel an active session
   */
  cancelSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get time remaining for a session
   */
  getTimeRemaining(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;

    const elapsed = Date.now() - session.startTime;
    return Math.max(session.duration - elapsed, 0);
  }

  /**
   * Generate enhanced rewards using the new system (one primary material + rare exotic chance)
   */
  generateEnhancedRewards(activityId: string, playerId: string): EnhancedHarvestingReward {
    const activity = HARVESTING_ACTIVITIES.find(a => a.id === activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const primaryMaterial = getPrimaryMaterialForActivity(activityId);
    if (!primaryMaterial) {
      throw new Error('Primary material not found for activity');
    }

    const playerStats = this.getPlayerStats(playerId);
    const categoryLevel = playerStats.categoryLevels[activity.category];

    // Calculate primary material quantity (can be modified by skill)
    const skillBonus = Math.floor(categoryLevel / 10); // +1 quantity per 10 levels
    const primaryQuantity = primaryMaterial.baseQuantity + skillBonus;

    // Calculate exotic item chance
    const exoticItem = this.rollForExoticItem(activity.category, categoryLevel);

    // Calculate skill gained
    const baseSkillGain = activity.statBonuses.experience || 10;
    const skillGained = baseSkillGain + (exoticItem ? 5 : 0); // Bonus XP for exotic finds

    return {
      primaryMaterial: {
        itemId: primaryMaterial.itemId,
        quantity: primaryQuantity
      },
      exoticItem: exoticItem ? {
        itemId: exoticItem.id,
        quantity: 1,
        rarity: exoticItem.rarity
      } : undefined,
      skillGained
    };
  }

  /**
   * Roll for exotic item discovery with skill-based bonus
   */
  private rollForExoticItem(category: HarvestingCategory, skillLevel: number): ExoticItem | null {
    const categoryExotics = getExoticItemsByCategory(category);
    if (categoryExotics.length === 0) return null;

    // Calculate skill bonus: 2% improvement per skill level, capped at 100% (double chance)
    const skillBonus = Math.min(skillLevel * 0.02, 1.0);

    for (const exotic of categoryExotics) {
      // Apply skill bonus to base drop rate
      const adjustedDropRate = exotic.baseDropRate * (1 + skillBonus);
      
      if (Math.random() < adjustedDropRate) {
        return exotic;
      }
    }

    return null;
  }

  /**
   * Calculate skill level from experience
   */
  calculateSkillLevel(experience: number): number {
    return Math.floor(Math.sqrt(experience / 100));
  }

  /**
   * Calculate exotic discovery bonus based on skill level
   */
  calculateExoticBonus(skillLevel: number): number {
    return Math.min(skillLevel * 0.02, 1.0); // 2% per level, capped at 100%
  }

  /**
   * Get experience required for next level
   */
  getExperienceForNextLevel(currentLevel: number): number {
    return Math.floor(100 * Math.pow(currentLevel + 1, 2));
  }

  /**
   * Complete harvesting session with enhanced rewards
   */
  completeHarvestingEnhanced(sessionId: string): EnhancedHarvestingReward {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.completed) {
      throw new Error('Session already completed');
    }

    const currentTime = Date.now();
    if (currentTime < session.startTime + session.duration) {
      throw new Error('Session not yet complete');
    }

    // Generate enhanced rewards
    const enhancedReward = this.generateEnhancedRewards(session.activityId, session.playerId);
    
    session.completed = true;

    // Update player harvesting stats with new system
    this.updateHarvestingStatsEnhanced(session.playerId, session.activityId, enhancedReward);

    return enhancedReward;
  }

  /**
   * Update harvesting statistics with enhanced reward system
   */
  private updateHarvestingStatsEnhanced(playerId: string, activityId: string, reward: EnhancedHarvestingReward): void {
    const stats = this.getPlayerStats(playerId);
    const activity = HARVESTING_ACTIVITIES.find(a => a.id === activityId);
    if (!activity) return;

    stats.totalHarvests++;
    stats.totalTimeSpent += activity.baseTime;
    
    // Add category experience
    stats.categoryExperience[activity.category] += reward.skillGained;
    
    // Check for level up
    const currentExp = stats.categoryExperience[activity.category];
    const currentLevel = stats.categoryLevels[activity.category];
    const newLevel = this.calculateSkillLevel(currentExp);
    
    if (newLevel > currentLevel) {
      stats.categoryLevels[activity.category] = newLevel;
      console.log(`${activity.category} skill leveled up to ${newLevel}!`);
    }

    // Count exotic finds
    if (reward.exoticItem) {
      if (reward.exoticItem.rarity === 'rare') {
        stats.rareFindCount++;
      } else if (reward.exoticItem.rarity === 'epic' || reward.exoticItem.rarity === 'legendary') {
        stats.legendaryFindCount++;
      }
    }

    // Add activity to unlocked list if not already there
    if (!stats.activitiesUnlocked.includes(activityId)) {
      stats.activitiesUnlocked.push(activityId);
    }
  }

  /**
   * Get exotic items for a category
   */
  getExoticItemsForCategory(category: HarvestingCategory): ExoticItem[] {
    return getExoticItemsByCategory(category);
  }

  /**
   * Get player's current exotic discovery rates for each category
   */
  getPlayerExoticRates(playerId: string): Record<HarvestingCategory, number> {
    const stats = this.getPlayerStats(playerId);
    const rates: Record<HarvestingCategory, number> = {} as any;

    for (const category of Object.values(HarvestingCategory)) {
      const skillLevel = stats.categoryLevels[category];
      const skillBonus = this.calculateExoticBonus(skillLevel);
      
      // Get average base rate for this category
      const categoryExotics = getExoticItemsByCategory(category);
      const avgBaseRate = categoryExotics.length > 0 
        ? categoryExotics.reduce((sum, item) => sum + item.baseDropRate, 0) / categoryExotics.length
        : 0;
      
      rates[category] = avgBaseRate * (1 + skillBonus);
    }

    return rates;
  }
}

export const harvestingService = new HarvestingService();