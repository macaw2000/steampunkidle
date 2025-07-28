/**
 * Enhanced Harvesting Reward Calculator Service
 * Implements predictable primary material collection with exotic item discovery system
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
  HarvestingCategory,
  ExoticItem,
  EnhancedHarvestingReward
} from '../types/harvesting';
import { CharacterStats } from '../types/character';

export class HarvestingRewardCalculator {
  // Exotic item pools for each harvesting category
  private static readonly EXOTIC_ITEM_POOLS: Record<HarvestingCategory, ExoticItem[]> = {
    [HarvestingCategory.LITERARY]: [
      {
        id: 'rare_manuscript',
        name: 'Rare Manuscript',
        description: 'A beautifully illuminated manuscript with mysterious annotations',
        icon: '📜',
        rarity: 'rare',
        category: HarvestingCategory.LITERARY,
        baseDropRate: 0.003,
        value: 500
      },
      {
        id: 'authors_original_notes',
        name: 'Author\'s Original Notes',
        description: 'Handwritten notes from a famous Victorian author',
        icon: '✍️',
        rarity: 'epic',
        category: HarvestingCategory.LITERARY,
        baseDropRate: 0.001,
        value: 1200
      },
      {
        id: 'lost_chapter',
        name: 'Lost Chapter',
        description: 'A missing chapter from a legendary novel, thought to be lost forever',
        icon: '📖',
        rarity: 'legendary',
        category: HarvestingCategory.LITERARY,
        baseDropRate: 0.0005,
        value: 3000
      }
    ],
    [HarvestingCategory.MECHANICAL]: [
      {
        id: 'precision_gearset',
        name: 'Precision Gearset',
        description: 'An incredibly precise set of interlocking gears',
        icon: '⚙️',
        rarity: 'rare',
        category: HarvestingCategory.MECHANICAL,
        baseDropRate: 0.004,
        value: 600
      },
      {
        id: 'prototype_mechanism',
        name: 'Prototype Mechanism',
        description: 'A unique mechanical device of unknown purpose',
        icon: '🔧',
        rarity: 'epic',
        category: HarvestingCategory.MECHANICAL,
        baseDropRate: 0.0015,
        value: 1500
      },
      {
        id: 'perpetual_motion_core',
        name: 'Perpetual Motion Core',
        description: 'A theoretical impossibility made manifest in brass and steel',
        icon: '⚡',
        rarity: 'legendary',
        category: HarvestingCategory.MECHANICAL,
        baseDropRate: 0.0003,
        value: 5000
      }
    ],
    [HarvestingCategory.ALCHEMICAL]: [
      {
        id: 'glowing_essence',
        name: 'Glowing Essence',
        description: 'A vial of luminescent liquid with unknown properties',
        icon: '🧪',
        rarity: 'rare',
        category: HarvestingCategory.ALCHEMICAL,
        baseDropRate: 0.005,
        value: 400
      },
      {
        id: 'philosophers_extract',
        name: 'Philosopher\'s Extract',
        description: 'A concentrated essence said to hold the secrets of transmutation',
        icon: '⚗️',
        rarity: 'epic',
        category: HarvestingCategory.ALCHEMICAL,
        baseDropRate: 0.002,
        value: 1000
      },
      {
        id: 'transmutation_catalyst',
        name: 'Transmutation Catalyst',
        description: 'The legendary substance that can transform any material',
        icon: '💎',
        rarity: 'legendary',
        category: HarvestingCategory.ALCHEMICAL,
        baseDropRate: 0.0008,
        value: 4000
      }
    ],
    [HarvestingCategory.ARCHAEOLOGICAL]: [
      {
        id: 'ancient_relic',
        name: 'Ancient Relic',
        description: 'A mysterious artifact from a bygone civilization',
        icon: '🏺',
        rarity: 'rare',
        category: HarvestingCategory.ARCHAEOLOGICAL,
        baseDropRate: 0.003,
        value: 800
      },
      {
        id: 'lost_civilization_artifact',
        name: 'Lost Civilization Artifact',
        description: 'A powerful relic from an advanced ancient society',
        icon: '🗿',
        rarity: 'epic',
        category: HarvestingCategory.ARCHAEOLOGICAL,
        baseDropRate: 0.001,
        value: 2000
      },
      {
        id: 'atlantean_power_source',
        name: 'Atlantean Power Source',
        description: 'A crystalline device that pulses with otherworldly energy',
        icon: '🔮',
        rarity: 'legendary',
        category: HarvestingCategory.ARCHAEOLOGICAL,
        baseDropRate: 0.0004,
        value: 6000
      }
    ],
    [HarvestingCategory.ELECTRICAL]: [
      {
        id: 'tesla_capacitor',
        name: 'Tesla Capacitor',
        description: 'A highly advanced electrical storage device',
        icon: '⚡',
        rarity: 'rare',
        category: HarvestingCategory.ELECTRICAL,
        baseDropRate: 0.004,
        value: 700
      },
      {
        id: 'lightning_in_a_bottle',
        name: 'Lightning in a Bottle',
        description: 'Captured lightning essence contained in a special vessel',
        icon: '🍶',
        rarity: 'epic',
        category: HarvestingCategory.ELECTRICAL,
        baseDropRate: 0.0012,
        value: 1800
      },
      {
        id: 'perpetual_battery',
        name: 'Perpetual Battery',
        description: 'A battery that never loses its charge',
        icon: '🔋',
        rarity: 'legendary',
        category: HarvestingCategory.ELECTRICAL,
        baseDropRate: 0.0006,
        value: 4500
      }
    ],
    [HarvestingCategory.AERONAUTICAL]: [
      {
        id: 'aether_crystal',
        name: 'Aether Crystal',
        description: 'A crystallized fragment of the upper atmosphere',
        icon: '💎',
        rarity: 'rare',
        category: HarvestingCategory.AERONAUTICAL,
        baseDropRate: 0.003,
        value: 900
      },
      {
        id: 'cloud_essence',
        name: 'Cloud Essence',
        description: 'The concentrated spirit of the sky itself',
        icon: '☁️',
        rarity: 'epic',
        category: HarvestingCategory.AERONAUTICAL,
        baseDropRate: 0.0015,
        value: 1600
      },
      {
        id: 'skyship_navigation_stone',
        name: 'Skyship Navigation Stone',
        description: 'A mystical stone that always points toward the nearest sky port',
        icon: '🧭',
        rarity: 'legendary',
        category: HarvestingCategory.AERONAUTICAL,
        baseDropRate: 0.0005,
        value: 3500
      }
    ],
    [HarvestingCategory.BOTANICAL]: [
      {
        id: 'rare_herb',
        name: 'Rare Herb',
        description: 'An exceptionally potent medicinal plant',
        icon: '🌿',
        rarity: 'rare',
        category: HarvestingCategory.BOTANICAL,
        baseDropRate: 0.006,
        value: 300
      },
      {
        id: 'mystical_flower',
        name: 'Mystical Flower',
        description: 'A flower that blooms only under specific magical conditions',
        icon: '🌸',
        rarity: 'epic',
        category: HarvestingCategory.BOTANICAL,
        baseDropRate: 0.002,
        value: 800
      },
      {
        id: 'world_tree_seed',
        name: 'World Tree Seed',
        description: 'A seed from the legendary World Tree',
        icon: '🌰',
        rarity: 'legendary',
        category: HarvestingCategory.BOTANICAL,
        baseDropRate: 0.0007,
        value: 2500
      }
    ],
    [HarvestingCategory.METALLURGICAL]: [
      {
        id: 'pure_ore_vein',
        name: 'Pure Ore Vein',
        description: 'An incredibly pure sample of rare metal ore',
        icon: '⛏️',
        rarity: 'rare',
        category: HarvestingCategory.METALLURGICAL,
        baseDropRate: 0.005,
        value: 600
      },
      {
        id: 'mythril_nugget',
        name: 'Mythril Nugget',
        description: 'A chunk of the legendary lightweight metal',
        icon: '✨',
        rarity: 'epic',
        category: HarvestingCategory.METALLURGICAL,
        baseDropRate: 0.0018,
        value: 1400
      },
      {
        id: 'adamantine_core',
        name: 'Adamantine Core',
        description: 'The hardest substance known to exist',
        icon: '💎',
        rarity: 'legendary',
        category: HarvestingCategory.METALLURGICAL,
        baseDropRate: 0.0004,
        value: 5500
      }
    ]
  };

  /**
   * Calculate enhanced harvesting rewards with guaranteed primary materials and exotic item discovery
   */
  static calculateEnhancedRewards(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number
  ): EnhancedHarvestingReward {
    const harvestingData = task.activityData as HarvestingTaskData;
    const activity = harvestingData.activity;
    const tools = harvestingData.tools || [];
    const location = harvestingData.location;
    
    // Calculate guaranteed primary material
    const primaryMaterial = this.calculatePrimaryMaterial(activity, playerStats, tools, location);
    
    // Calculate exotic item discovery
    const exoticItem = this.calculateExoticItemDiscovery(activity, playerStats, playerLevel, tools, location);
    
    // Calculate skill gained
    const skillGained = this.calculateSkillProgression(activity, playerLevel, tools, location);
    
    return {
      primaryMaterial,
      exoticItem,
      skillGained
    };
  }

  /**
   * Calculate harvesting rewards based on task data, player stats, tools, and location
   * Enhanced to use the new predictable reward system
   */
  static calculateRewards(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number
  ): TaskReward[] {
    const enhancedRewards = this.calculateEnhancedRewards(task, playerStats, playerLevel);
    const rewards: TaskReward[] = [];
    
    // Add primary material reward
    rewards.push({
      type: 'resource',
      itemId: enhancedRewards.primaryMaterial.itemId,
      quantity: enhancedRewards.primaryMaterial.quantity,
      rarity: 'common',
      isRare: false
    });
    
    // Add exotic item if discovered
    if (enhancedRewards.exoticItem) {
      rewards.push({
        type: 'item',
        itemId: enhancedRewards.exoticItem.itemId,
        quantity: enhancedRewards.exoticItem.quantity,
        rarity: enhancedRewards.exoticItem.rarity,
        isRare: true
      });
    }
    
    // Add experience reward
    const harvestingData = task.activityData as HarvestingTaskData;
    const activity = harvestingData.activity;
    const tools = harvestingData.tools || [];
    const location = harvestingData.location;
    
    const experienceReward = this.calculateExperienceReward(activity, playerLevel, tools, location);
    rewards.push({
      type: 'experience',
      quantity: experienceReward
    });
    
    return rewards;
  }

  /**
   * Calculate guaranteed primary material for each harvest
   */
  private static calculatePrimaryMaterial(
    activity: HarvestingActivity,
    playerStats: CharacterStats,
    tools: EquippedTool[],
    location?: HarvestingLocation
  ): { itemId: string; quantity: number } {
    // Get the guaranteed drop from the activity's drop table
    const guaranteedDrops = activity.dropTable.guaranteed;
    if (guaranteedDrops.length === 0) {
      throw new Error(`Activity ${activity.id} has no guaranteed drops defined`);
    }
    
    // Use the first guaranteed drop as the primary material
    const primaryDrop = guaranteedDrops[0];
    
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
      const categoryYieldKey = `${activity.category.toLowerCase()}_yield`;
      if (location.bonusModifiers[categoryYieldKey]) {
        yieldMultiplier += location.bonusModifiers[categoryYieldKey];
      }
    }
    
    // Apply stat bonuses
    const relevantStat = this.getRelevantStatForCategory(activity.category);
    const statValue = this.getPlayerStat(playerStats, relevantStat);
    const statBonus = Math.min(0.3, (statValue / 200)); // Max 30% bonus from stats
    yieldMultiplier += statBonus;
    
    // Calculate base quantity (always at least 1)
    const baseQuantity = Math.max(1, Math.floor(Math.random() * (primaryDrop.maxQuantity - primaryDrop.minQuantity + 1)) + primaryDrop.minQuantity);
    const finalQuantity = Math.max(1, Math.round(baseQuantity * yieldMultiplier));
    
    return {
      itemId: primaryDrop.itemId,
      quantity: finalQuantity
    };
  }

  /**
   * Calculate exotic item discovery with skill progression impact
   */
  private static calculateExoticItemDiscovery(
    activity: HarvestingActivity,
    playerStats: CharacterStats,
    playerLevel: number,
    tools: EquippedTool[],
    location?: HarvestingLocation
  ): { itemId: string; quantity: number; rarity: 'rare' | 'epic' | 'legendary' } | undefined {
    // Base exotic discovery chance (less than 1%)
    let discoveryChance = 0.008; // 0.8% base chance
    
    // Apply skill progression impact
    const skillLevel = this.getHarvestingSkillLevel(playerStats, activity.category);
    const skillBonus = Math.min(0.005, skillLevel * 0.0002); // Max 0.5% bonus from skill level
    discoveryChance += skillBonus;
    
    // Apply tool bonuses
    for (const tool of tools) {
      for (const bonus of tool.bonuses) {
        if (bonus.type === 'quality') {
          discoveryChance += bonus.value * 0.002; // Quality bonus affects discovery rate
        }
      }
    }
    
    // Apply location bonuses
    if (location && location.bonusModifiers.rare_find) {
      discoveryChance += location.bonusModifiers.rare_find;
    }
    
    // Apply player level bonus (higher level players have slightly better discovery rates)
    const levelBonus = Math.min(0.002, playerLevel * 0.0001); // Max 0.2% bonus from level
    discoveryChance += levelBonus;
    
    // Cap the discovery chance at a reasonable maximum
    discoveryChance = Math.min(0.02, discoveryChance); // Max 2% chance
    
    // Roll for exotic item discovery
    if (Math.random() < discoveryChance) {
      const exoticItems = this.EXOTIC_ITEM_POOLS[activity.category];
      if (exoticItems.length === 0) {
        return undefined;
      }
      
      // Determine rarity tier based on weighted probabilities
      const rarityRoll = Math.random();
      let selectedRarity: 'rare' | 'epic' | 'legendary';
      
      if (rarityRoll < 0.05) { // 5% chance for legendary
        selectedRarity = 'legendary';
      } else if (rarityRoll < 0.25) { // 20% chance for epic
        selectedRarity = 'epic';
      } else { // 75% chance for rare
        selectedRarity = 'rare';
      }
      
      // Find items of the selected rarity
      const availableItems = exoticItems.filter(item => item.rarity === selectedRarity);
      if (availableItems.length === 0) {
        // Fallback to rare if no items of selected rarity exist
        const fallbackItems = exoticItems.filter(item => item.rarity === 'rare');
        if (fallbackItems.length === 0) {
          return undefined;
        }
        const selectedItem = fallbackItems[Math.floor(Math.random() * fallbackItems.length)];
        return {
          itemId: selectedItem.id,
          quantity: 1,
          rarity: selectedItem.rarity
        };
      }
      
      // Select random item from available items of the selected rarity
      const selectedItem = availableItems[Math.floor(Math.random() * availableItems.length)];
      
      return {
        itemId: selectedItem.id,
        quantity: 1,
        rarity: selectedItem.rarity
      };
    }
    
    return undefined;
  }

  /**
   * Calculate skill progression from harvesting activity
   */
  private static calculateSkillProgression(
    activity: HarvestingActivity,
    playerLevel: number,
    tools: EquippedTool[],
    location?: HarvestingLocation
  ): number {
    // Base skill gain
    let skillGain = 10 + (activity.requiredLevel * 2);
    
    // Apply tool bonuses
    for (const tool of tools) {
      for (const bonus of tool.bonuses) {
        if (bonus.type === 'efficiency') {
          skillGain *= (1 + bonus.value * 0.5); // Efficiency affects skill gain
        }
      }
    }
    
    // Apply location bonuses
    if (location && location.bonusModifiers.experience) {
      skillGain *= (1 + location.bonusModifiers.experience);
    }
    
    // Apply level scaling (higher level activities give more skill)
    const levelMultiplier = 1 + (activity.requiredLevel * 0.1);
    skillGain *= levelMultiplier;
    
    return Math.round(skillGain);
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
   * Get rare item for category and rarity (legacy method for backward compatibility)
   */
  private static getRareItemForCategory(category: HarvestingCategory, rarity: string): { id: string; name: string } {
    const exoticItems = this.EXOTIC_ITEM_POOLS[category];
    if (!exoticItems || exoticItems.length === 0) {
      return { id: 'unknown_item', name: 'Unknown Item' };
    }
    
    // Map rarity strings to our exotic item rarities
    let targetRarity: 'rare' | 'epic' | 'legendary';
    switch (rarity) {
      case 'uncommon':
      case 'rare':
        targetRarity = 'rare';
        break;
      case 'epic':
        targetRarity = 'epic';
        break;
      case 'legendary':
        targetRarity = 'legendary';
        break;
      default:
        targetRarity = 'rare';
    }
    
    const matchingItems = exoticItems.filter(item => item.rarity === targetRarity);
    if (matchingItems.length === 0) {
      // Fallback to first available item
      return { id: exoticItems[0].id, name: exoticItems[0].name };
    }
    
    const selectedItem = matchingItems[Math.floor(Math.random() * matchingItems.length)];
    return { id: selectedItem.id, name: selectedItem.name };
  }

  /**
   * Get exotic items for a specific category
   */
  static getExoticItemsForCategory(category: HarvestingCategory): ExoticItem[] {
    return this.EXOTIC_ITEM_POOLS[category] || [];
  }

  /**
   * Get all exotic items across all categories
   */
  static getAllExoticItems(): ExoticItem[] {
    const allItems: ExoticItem[] = [];
    for (const categoryItems of Object.values(this.EXOTIC_ITEM_POOLS)) {
      allItems.push(...categoryItems);
    }
    return allItems;
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