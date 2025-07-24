/**
 * Harvesting Reward Calculator Service
 * Calculates rewards for harvesting activities based on player stats, tools, and location
 */

import { 
  Task, 
  TaskReward, 
  HarvestingTaskData, 
  EquippedTool, 
  HarvestingLocation 
} from '../types/taskQueue';
import { 
  HarvestingActivity, 
  ResourceDrop, 
  ResourceRarity, 
  HarvestingCategory 
} from '../types/harvesting';
import { CharacterStats } from '../types/character';

export class HarvestingRewardCalculator {
  /**
   * Calculate harvesting rewards based on task data, player stats, tools, and location
   */
  static calculateRewards(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number
  ): TaskReward[] {
    const harvestingData = task.activityData as HarvestingTaskData;
    const activity = harvestingData.activity;
    const tools = harvestingData.tools || [];
    const location = harvestingData.location;
    
    // Base rewards
    const rewards: TaskReward[] = [];
    
    // Add experience reward
    const experienceReward = this.calculateExperienceReward(activity, playerLevel, tools, location);
    rewards.push({
      type: 'experience',
      quantity: experienceReward
    });
    
    // Calculate resource rewards from drop table
    const resourceRewards = this.calculateResourceRewards(activity, playerStats, tools, location);
    rewards.push(...resourceRewards);
    
    // Calculate rare item chance
    const rareItemReward = this.calculateRareItemReward(activity, playerStats, tools, location);
    if (rareItemReward) {
      rewards.push(rareItemReward);
    }
    
    return rewards;
  }
  
  /**
   * Calculate experience reward
   */
  private static calculateExperienceReward(
    activity: HarvestingActivity,
    playerLevel: number,
    tools: EquippedTool[],
    location?: HarvestingLocation
  ): number {
    // Base experience from activity
    let experience = activity.statBonuses.experience || 15;
    
    // Apply level scaling (higher levels get slightly less from low-level activities)
    const levelDifference = playerLevel - activity.requiredLevel;
    if (levelDifference > 0) {
      // Reduce by 2% per level difference, but never below 50%
      const levelPenalty = Math.min(0.5, levelDifference * 0.02);
      experience *= (1 - levelPenalty);
    }
    
    // Apply tool bonuses
    for (const tool of tools) {
      for (const bonus of tool.bonuses) {
        if (bonus.type === 'efficiency') {
          experience *= (1 + bonus.value);
        }
      }
    }
    
    // Apply location bonuses
    if (location && location.bonusModifiers.experience) {
      experience *= (1 + location.bonusModifiers.experience);
    }
    
    return Math.round(experience);
  }
  
  /**
   * Calculate resource rewards from drop table
   */
  private static calculateResourceRewards(
    activity: HarvestingActivity,
    playerStats: CharacterStats,
    tools: EquippedTool[],
    location?: HarvestingLocation
  ): TaskReward[] {
    const rewards: TaskReward[] = [];
    
    // Calculate yield multiplier from tools and location
    let yieldMultiplier = 1.0;
    
    // Apply tool bonuses
    for (const tool of tools) {
      for (const bonus of tool.bonuses) {
        if (bonus.type === 'yield') {
          yieldMultiplier += bonus.value;
        }
      }
    }
    
    // Apply location bonuses
    if (location) {
      // Check for category-specific yield bonus
      const categoryYieldKey = `${activity.category.toLowerCase()}_yield`;
      if (location.bonusModifiers[categoryYieldKey]) {
        yieldMultiplier += location.bonusModifiers[categoryYieldKey];
      }
    }
    
    // Apply stat bonuses
    const relevantStat = this.getRelevantStatForCategory(activity.category);
    const statValue = this.getPlayerStat(playerStats, relevantStat);
    const statBonus = Math.min(0.5, (statValue / 100)); // Max 50% bonus from stats
    yieldMultiplier += statBonus;
    
    // Process guaranteed drops
    for (const drop of activity.dropTable.guaranteed) {
      const reward = this.processResourceDrop(drop, yieldMultiplier, 'common');
      rewards.push(reward);
    }
    
    // Process common drops (40-60% chance)
    for (const drop of activity.dropTable.common) {
      if (Math.random() < drop.dropRate * yieldMultiplier) {
        const reward = this.processResourceDrop(drop, yieldMultiplier, 'common');
        rewards.push(reward);
      }
    }
    
    // Process uncommon drops (10-20% chance)
    for (const drop of activity.dropTable.uncommon) {
      if (Math.random() < drop.dropRate * yieldMultiplier) {
        const reward = this.processResourceDrop(drop, yieldMultiplier, 'uncommon');
        rewards.push(reward);
      }
    }
    
    // Process rare drops (3-6% chance)
    for (const drop of activity.dropTable.rare) {
      if (Math.random() < drop.dropRate * yieldMultiplier) {
        const reward = this.processResourceDrop(drop, yieldMultiplier, 'rare');
        rewards.push(reward);
      }
    }
    
    // Process legendary drops (0.5-1.5% chance)
    for (const drop of activity.dropTable.legendary) {
      if (Math.random() < drop.dropRate * yieldMultiplier) {
        const reward = this.processResourceDrop(drop, yieldMultiplier, 'legendary');
        rewards.push(reward);
      }
    }
    
    return rewards;
  }
  
  /**
   * Process a single resource drop into a reward
   */
  private static processResourceDrop(
    drop: ResourceDrop,
    yieldMultiplier: number,
    rarity: string
  ): TaskReward {
    // Calculate quantity
    const baseQuantity = Math.floor(Math.random() * (drop.maxQuantity - drop.minQuantity + 1)) + drop.minQuantity;
    const adjustedQuantity = Math.round(baseQuantity * yieldMultiplier);
    
    return {
      type: 'resource',
      itemId: drop.itemId,
      quantity: adjustedQuantity,
      rarity: rarity,
      isRare: rarity !== 'common'
    };
  }
  
  /**
   * Calculate chance for rare item drop
   */
  private static calculateRareItemReward(
    activity: HarvestingActivity,
    playerStats: CharacterStats,
    tools: EquippedTool[],
    location?: HarvestingLocation
  ): TaskReward | null {
    // Base chance for rare item (0.5%)
    let rareChance = 0.005;
    
    // Apply tool bonuses
    for (const tool of tools) {
      for (const bonus of tool.bonuses) {
        if (bonus.type === 'quality') {
          rareChance += bonus.value * 0.01; // Convert quality bonus to rare chance
        }
      }
    }
    
    // Apply location bonuses
    if (location && location.bonusModifiers.rare_find) {
      rareChance += location.bonusModifiers.rare_find;
    }
    
    // Apply luck from intelligence stat (perception not available in CharacterStats)
    const perception = playerStats.intelligence || 0;
    const luckBonus = perception * 0.0005; // 0.05% per point of perception
    rareChance += luckBonus;
    
    // Cap at reasonable value
    rareChance = Math.min(0.15, rareChance); // Max 15% chance
    
    // Roll for rare item
    if (Math.random() < rareChance) {
      // Determine rarity tier
      let rarityTier: string;
      const rarityRoll = Math.random();
      
      if (rarityRoll < 0.1) {
        rarityTier = 'legendary';
      } else if (rarityRoll < 0.3) {
        rarityTier = 'rare';
      } else {
        rarityTier = 'uncommon';
      }
      
      // Get appropriate rare item for activity category
      const rareItem = this.getRareItemForCategory(activity.category, rarityTier);
      
      return {
        type: 'item',
        itemId: rareItem.id,
        quantity: 1,
        rarity: rarityTier,
        isRare: true
      };
    }
    
    return null;
  }
  
  /**
   * Get relevant stat for harvesting category
   */
  private static getRelevantStatForCategory(category: HarvestingCategory): string {
    switch (category) {
      case HarvestingCategory.LITERARY:
        return 'intelligence';
      case HarvestingCategory.MECHANICAL:
        return 'dexterity';
      case HarvestingCategory.ALCHEMICAL:
        return 'intelligence';
      case HarvestingCategory.ARCHAEOLOGICAL:
        return 'perception';
      case HarvestingCategory.ELECTRICAL:
        return 'intelligence';
      case HarvestingCategory.AERONAUTICAL:
        return 'perception';
      case HarvestingCategory.METALLURGICAL:
        return 'strength';
      default:
        return 'intelligence';
    }
  }
  
  /**
   * Get player stat value
   */
  private static getPlayerStat(playerStats: CharacterStats, statName: string): number {
    switch (statName.toLowerCase()) {
      case 'strength':
        return playerStats.strength;
      case 'dexterity':
        return playerStats.dexterity;
      case 'intelligence':
        return playerStats.intelligence;
      case 'vitality':
        return playerStats.vitality;
      case 'perception':
        return playerStats.intelligence || 0; // Using intelligence as perception substitute
      default:
        return 0;
    }
  }
  
  /**
   * Get rare item for category and rarity
   */
  private static getRareItemForCategory(category: HarvestingCategory, rarity: string): { id: string; name: string } {
    // This would ideally come from a database or config file
    const rareItems: Record<HarvestingCategory, Record<'uncommon' | 'rare' | 'legendary', { id: string; name: string }>> = {
      [HarvestingCategory.LITERARY]: {
        uncommon: { id: 'rare_manuscript', name: 'Rare Manuscript' },
        rare: { id: 'authors_original_notes', name: 'Author\'s Original Notes' },
        legendary: { id: 'lost_chapter', name: 'Lost Chapter' }
      },
      [HarvestingCategory.MECHANICAL]: {
        uncommon: { id: 'precision_gearset', name: 'Precision Gearset' },
        rare: { id: 'prototype_mechanism', name: 'Prototype Mechanism' },
        legendary: { id: 'perpetual_motion_core', name: 'Perpetual Motion Core' }
      },
      [HarvestingCategory.ALCHEMICAL]: {
        uncommon: { id: 'glowing_essence', name: 'Glowing Essence' },
        rare: { id: 'philosophers_extract', name: 'Philosopher\'s Extract' },
        legendary: { id: 'transmutation_catalyst', name: 'Transmutation Catalyst' }
      },
      [HarvestingCategory.ARCHAEOLOGICAL]: {
        uncommon: { id: 'ancient_relic', name: 'Ancient Relic' },
        rare: { id: 'lost_civilization_artifact', name: 'Lost Civilization Artifact' },
        legendary: { id: 'atlantean_power_source', name: 'Atlantean Power Source' }
      },
      [HarvestingCategory.ELECTRICAL]: {
        uncommon: { id: 'tesla_capacitor', name: 'Tesla Capacitor' },
        rare: { id: 'lightning_in_a_bottle', name: 'Lightning in a Bottle' },
        legendary: { id: 'perpetual_battery', name: 'Perpetual Battery' }
      },
      [HarvestingCategory.AERONAUTICAL]: {
        uncommon: { id: 'aether_crystal', name: 'Aether Crystal' },
        rare: { id: 'cloud_essence', name: 'Cloud Essence' },
        legendary: { id: 'skyship_navigation_stone', name: 'Skyship Navigation Stone' }
      },
      [HarvestingCategory.BOTANICAL]: {
        uncommon: { id: 'rare_herb', name: 'Rare Herb' },
        rare: { id: 'mystical_flower', name: 'Mystical Flower' },
        legendary: { id: 'world_tree_seed', name: 'World Tree Seed' }
      },
      [HarvestingCategory.METALLURGICAL]: {
        uncommon: { id: 'pure_ore_vein', name: 'Pure Ore Vein' },
        rare: { id: 'mythril_nugget', name: 'Mythril Nugget' },
        legendary: { id: 'adamantine_core', name: 'Adamantine Core' }
      }
    };
    
    return rareItems[category][rarity as 'uncommon' | 'rare' | 'legendary'];
  }
  
  /**
   * Calculate harvesting task duration based on activity, player stats, tools, and location
   */
  static calculateHarvestingDuration(
    activity: HarvestingActivity,
    playerStats: CharacterStats,
    tools: EquippedTool[] = [],
    location?: HarvestingLocation
  ): number {
    // Base duration from activity (in milliseconds)
    let duration = activity.baseTime * 1000;
    
    // Apply stat bonuses
    if (activity.requiredStats) {
      for (const [stat, required] of Object.entries(activity.requiredStats)) {
        const playerStat = this.getPlayerStat(playerStats, stat);
        if (playerStat > required) {
          // 1% time reduction per stat point above requirement, up to 50%
          const bonus = Math.min(0.5, (playerStat - required) * 0.01);
          duration *= (1 - bonus);
        }
      }
    }
    
    // Apply tool speed bonuses
    for (const tool of tools) {
      for (const bonus of tool.bonuses) {
        if (bonus.type === 'speed') {
          duration *= (1 - bonus.value);
        }
      }
    }
    
    // Apply location bonuses
    if (location) {
      // Check for category-specific quality bonus which can affect speed
      const categoryQualityKey = `${activity.category.toLowerCase()}_quality`;
      if (location.bonusModifiers[categoryQualityKey]) {
        // Quality bonus gives a small speed boost
        const qualityBonus = location.bonusModifiers[categoryQualityKey] * 0.5;
        duration *= (1 - qualityBonus);
      }
    }
    
    // Apply relevant skill level bonus
    const skillLevel = this.getHarvestingSkillLevel(playerStats, activity.category);
    const skillBonus = Math.min(0.4, skillLevel * 0.01); // 1% per skill level, max 40%
    duration *= (1 - skillBonus);
    
    // Ensure minimum duration
    return Math.max(1000, Math.floor(duration));
  }
  
  /**
   * Get harvesting skill level for category
   */
  private static getHarvestingSkillLevel(playerStats: CharacterStats, category: HarvestingCategory): number {
    switch (category) {
      case HarvestingCategory.LITERARY:
        return playerStats.harvestingSkills?.level || 1;
      case HarvestingCategory.MECHANICAL:
        return playerStats.harvestingSkills?.salvaging || 1;
      case HarvestingCategory.ALCHEMICAL:
        return playerStats.harvestingSkills?.level || 1;
      case HarvestingCategory.ARCHAEOLOGICAL:
        return playerStats.harvestingSkills?.level || 1;
      case HarvestingCategory.ELECTRICAL:
        return playerStats.harvestingSkills?.level || 1;
      case HarvestingCategory.AERONAUTICAL:
        return playerStats.harvestingSkills?.level || 1;
      case HarvestingCategory.METALLURGICAL:
        return playerStats.harvestingSkills?.mining || 1;
      default:
        return 1;
    }
  }
}

// Export singleton instance
export const harvestingRewardCalculator = new HarvestingRewardCalculator();