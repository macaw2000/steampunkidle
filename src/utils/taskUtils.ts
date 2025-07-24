/**
 * Task Utility Functions
 * Helper functions for creating and managing tasks in the queue system
 */

import { 
  Task, 
  TaskType, 
  TaskPrerequisite, 
  ResourceRequirement,
  HarvestingTaskData,
  CraftingTaskData,
  CombatTaskData,
  TaskValidationResult,
  Equipment,
  EquippedTool,
  HarvestingLocation,
  ResourceYield
} from '../types/taskQueue';
import { HarvestingActivity, HarvestingCategory } from '../types/harvesting';
import { CraftingRecipe } from '../types/crafting';
import { Enemy, PlayerCombatStats } from '../types/combat';
import { CharacterStats } from '../types/character';
import { TaskValidationService } from '../services/taskValidation';

export class TaskUtils {
  
  /**
   * Create a harvesting task with proper validation and data structure
   */
  static createHarvestingTask(
    playerId: string,
    activity: HarvestingActivity,
    playerStats: CharacterStats | any,
    playerLevel: number,
    options: {
      priority?: number;
      tools?: EquippedTool[];
      location?: HarvestingLocation;
      playerInventory?: { [itemId: string]: number };
      playerEquipment?: { [slot: string]: any };
    } = {}
  ): Task {
    const taskId = `harvesting-${activity.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Build prerequisites
    const prerequisites: TaskPrerequisite[] = [];
    
    // Level prerequisite
    if (activity.requiredLevel > 0) {
      prerequisites.push({
        type: 'level',
        requirement: activity.requiredLevel,
        description: `Requires level ${activity.requiredLevel}`,
        isMet: playerLevel >= activity.requiredLevel
      });
    }

    // Stat prerequisites
    if (activity.requiredStats) {
      for (const [stat, required] of Object.entries(activity.requiredStats)) {
        prerequisites.push({
          type: 'stat',
          requirement: stat,
          value: required,
          description: `Requires ${stat} ${required}`,
          isMet: this.getPlayerStat(playerStats, stat) >= required
        });
      }
    }

    // Location prerequisites
    const location = options.location;
    if (location) {
      for (const req of location.requirements) {
        // Check if requirement is already met
        let isMet = req.isMet;
        
        // If not explicitly marked as met, check against player data
        if (!isMet) {
          if (req.type === 'level') {
            isMet = playerLevel >= (req.requirement as number);
          } else if (req.type === 'item' && options.playerInventory) {
            isMet = (options.playerInventory[req.requirement as string] || 0) > 0;
          } else if (req.type === 'equipment' && options.playerEquipment) {
            isMet = !!options.playerEquipment[req.requirement as string];
          }
        }
        
        prerequisites.push({
          ...req,
          isMet
        });
      }
    }

    // Tool prerequisites
    const tools = options.tools || [];
    for (const tool of tools) {
      if (tool.durability <= 0) {
        prerequisites.push({
          type: 'equipment',
          requirement: tool.toolId,
          description: `Tool ${tool.name} needs repair`,
          isMet: false
        });
      }
    }

    // Build resource requirements (energy cost)
    const resourceRequirements: ResourceRequirement[] = [];
    if (activity.energyCost > 0) {
      const availableEnergy = options.playerInventory?.energy || 100; // Default to 100 if not provided
      resourceRequirements.push({
        resourceId: 'energy',
        resourceName: 'Energy',
        quantityRequired: activity.energyCost,
        quantityAvailable: availableEnergy,
        isSufficient: availableEnergy >= activity.energyCost
      });
    }

    // Calculate duration with tools and location bonuses
    const duration = this.calculateEnhancedHarvestingDuration(activity, playerStats, tools, location);

    // Build harvesting task data
    const harvestingData: HarvestingTaskData = {
      activity,
      playerStats,
      location,
      tools,
      expectedYield: this.calculateEnhancedExpectedYield(activity, playerStats, tools, location)
    };

    const task: Task = {
      id: taskId,
      type: TaskType.HARVESTING,
      name: activity.name,
      description: activity.description,
      icon: activity.icon,
      duration,
      startTime: 0,
      playerId,
      activityData: harvestingData,
      prerequisites,
      resourceRequirements,
      progress: 0,
      completed: false,
      rewards: [],
      priority: options.priority || 5,
      estimatedCompletion: Date.now() + duration,
      retryCount: 0,
      maxRetries: 3,
      isValid: true,
      validationErrors: []
    };

    // Validate the task
    const playerInventory = options.playerInventory || {};
    const validation = TaskValidationService.validateTask(task, playerStats, playerLevel, playerInventory);
    task.isValid = validation.isValid;
    task.validationErrors = validation.errors.map(e => e.message);

    return task;
  }

  /**
   * Create a crafting task with proper validation and data structure
   */
  static createCraftingTask(
    playerId: string,
    recipe: CraftingRecipe,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: {
      priority?: number;
      craftingStation?: any;
      quantity?: number;
    } = {}
  ): Task {
    const taskId = `crafting-${recipe.recipeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const quantity = options.quantity || 1;
    
    // Build prerequisites
    const prerequisites: TaskPrerequisite[] = [];
    
    // Level prerequisite
    if (recipe.requiredLevel > 0) {
      prerequisites.push({
        type: 'level',
        requirement: recipe.requiredLevel,
        description: `Requires level ${recipe.requiredLevel}`,
        isMet: playerLevel >= recipe.requiredLevel
      });
    }

    // Skill prerequisite
    prerequisites.push({
      type: 'skill',
      requirement: recipe.requiredSkill,
      value: recipe.requiredLevel,
      description: `Requires ${recipe.requiredSkill} level ${recipe.requiredLevel}`,
      isMet: this.getCraftingSkillLevel(playerStats, recipe.requiredSkill) >= recipe.requiredLevel
    });

    // Build resource requirements
    const resourceRequirements: ResourceRequirement[] = [];
    for (const material of recipe.materials) {
      const required = material.quantity * quantity;
      const available = playerInventory[material.materialId] || 0;
      
      resourceRequirements.push({
        resourceId: material.materialId,
        resourceName: material.name,
        quantityRequired: required,
        quantityAvailable: available,
        isSufficient: available >= required
      });
    }

    // Build crafting task data
    const craftingData: CraftingTaskData = {
      recipe,
      materials: recipe.materials.map(m => ({
        materialId: m.materialId,
        name: m.name,
        quantity: m.quantity * quantity,
        type: m.type
      })),
      craftingStation: options.craftingStation,
      playerSkillLevel: this.getCraftingSkillLevel(playerStats, recipe.requiredSkill),
      qualityModifier: this.calculateQualityModifier(playerStats, recipe),
      expectedOutputs: recipe.outputs.map(output => ({
        itemId: output.itemId,
        name: output.name,
        quantity: output.quantity * quantity,
        baseStats: output.baseStats,
        qualityModifier: output.qualityModifier
      }))
    };

    const task: Task = {
      id: taskId,
      type: TaskType.CRAFTING,
      name: `Craft ${recipe.name}${quantity > 1 ? ` (x${quantity})` : ''}`,
      description: recipe.description,
      icon: '🔧', // Default crafting icon
      duration: recipe.craftingTime * 1000 * quantity, // Convert to milliseconds
      startTime: 0,
      playerId,
      activityData: craftingData,
      prerequisites,
      resourceRequirements,
      progress: 0,
      completed: false,
      rewards: [],
      priority: options.priority || 5,
      estimatedCompletion: Date.now() + (recipe.craftingTime * 1000 * quantity),
      retryCount: 0,
      maxRetries: 2,
      isValid: true,
      validationErrors: []
    };

    // Validate the task
    const validation = TaskValidationService.validateTask(task, playerStats, playerLevel, playerInventory);
    task.isValid = validation.isValid;
    task.validationErrors = validation.errors.map(e => e.message);

    return task;
  }

  /**
   * Create a combat task with proper validation and data structure
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
      strategy?: any;
    } = {}
  ): Task {
    const taskId = `combat-${enemy.enemyId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Build prerequisites
    const prerequisites: TaskPrerequisite[] = [];
    
    // Level prerequisite (recommended level based on enemy)
    const recommendedLevel = Math.max(1, enemy.level - 2);
    prerequisites.push({
      type: 'level',
      requirement: recommendedLevel,
      description: `Recommended level ${recommendedLevel} for ${enemy.name}`,
      isMet: playerLevel >= recommendedLevel
    });

    // Build resource requirements (health/mana)
    const resourceRequirements: ResourceRequirement[] = [];
    resourceRequirements.push({
      resourceId: 'health',
      resourceName: 'Health',
      quantityRequired: Math.floor(playerCombatStats.maxHealth * 0.5), // Need at least 50% health
      quantityAvailable: playerCombatStats.health,
      isSufficient: playerCombatStats.health >= Math.floor(playerCombatStats.maxHealth * 0.5)
    });

    // Calculate combat estimate
    const combatEstimate = this.calculateCombatEstimate(playerCombatStats, enemy, playerLevel);

    // Build combat task data
    const combatData: CombatTaskData = {
      enemy,
      playerLevel,
      playerStats: playerCombatStats,
      equipment: options.equipment || [],
      combatStrategy: options.strategy || {
        strategyId: 'balanced',
        name: 'Balanced',
        description: 'Balanced attack and defense',
        modifiers: []
      },
      estimatedOutcome: combatEstimate
    };

    const task: Task = {
      id: taskId,
      type: TaskType.COMBAT,
      name: `Fight ${enemy.name}`,
      description: `Engage in combat with ${enemy.name} (Level ${enemy.level})`,
      icon: '⚔️',
      duration: combatEstimate.estimatedDuration * 1000, // Convert to milliseconds
      startTime: 0,
      playerId,
      activityData: combatData,
      prerequisites,
      resourceRequirements,
      progress: 0,
      completed: false,
      rewards: [],
      priority: options.priority || 5,
      estimatedCompletion: Date.now() + (combatEstimate.estimatedDuration * 1000),
      retryCount: 0,
      maxRetries: 1, // Combat typically shouldn't retry automatically
      isValid: true,
      validationErrors: []
    };

    // Validate the task
    const validation = TaskValidationService.validateTask(task, playerStats, playerLevel, {});
    task.isValid = validation.isValid;
    task.validationErrors = validation.errors.map(e => e.message);

    return task;
  }

  /**
   * Calculate expected yield for harvesting activities
   */
  private static calculateExpectedYield(activity: HarvestingActivity, playerStats: CharacterStats): any[] {
    const yields = [];
    
    // Calculate yields based on drop table and player stats
    for (const [rarity, drops] of Object.entries(activity.dropTable)) {
      for (const drop of drops) {
        yields.push({
          resourceId: drop.itemId,
          minQuantity: drop.minQuantity,
          maxQuantity: drop.maxQuantity,
          probability: drop.dropRate,
          rarity
        });
      }
    }

    return yields;
  }

  /**
   * Calculate enhanced expected yield with tools and location bonuses
   */
  private static calculateEnhancedExpectedYield(
    activity: HarvestingActivity, 
    playerStats: CharacterStats,
    tools: EquippedTool[] = [],
    location?: HarvestingLocation
  ): ResourceYield[] {
    const yields: ResourceYield[] = [];
    
    // Calculate yield multiplier from tools and location
    let yieldMultiplier = 1.0;
    let qualityBonus = 0.0;
    
    // Apply tool bonuses
    for (const tool of tools) {
      for (const bonus of tool.bonuses) {
        if (bonus.type === 'yield') {
          yieldMultiplier += bonus.value;
        }
        if (bonus.type === 'quality') {
          qualityBonus += bonus.value;
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
      
      // Check for rare find bonus
      if (location.bonusModifiers.rare_find) {
        qualityBonus += location.bonusModifiers.rare_find;
      }
    }
    
    // Apply stat bonuses
    const relevantStat = this.getRelevantStatForCategory(activity.category);
    const statValue = this.getPlayerStat(playerStats, relevantStat);
    const statBonus = Math.min(0.5, (statValue / 100)); // Max 50% bonus from stats
    yieldMultiplier += statBonus;
    
    // Process all drop tables
    for (const [rarityKey, drops] of Object.entries(activity.dropTable)) {
      const rarity = rarityKey as 'common' | 'uncommon' | 'rare' | 'legendary';
      
      for (const drop of drops) {
        // Adjust probability based on quality bonus
        let adjustedProbability = drop.dropRate;
        
        // Higher quality bonus increases rare drop chances
        if (rarity === 'uncommon') {
          adjustedProbability *= (1 + qualityBonus * 0.5);
        } else if (rarity === 'rare') {
          adjustedProbability *= (1 + qualityBonus);
        } else if (rarity === 'legendary') {
          adjustedProbability *= (1 + qualityBonus * 1.5);
        }
        
        // Cap probability at reasonable values
        adjustedProbability = Math.min(
          rarity === 'common' ? 0.8 : 
          rarity === 'uncommon' ? 0.4 : 
          rarity === 'rare' ? 0.2 : 0.05, 
          adjustedProbability
        );
        
        // Calculate adjusted quantities
        const minQuantity = Math.round(drop.minQuantity * yieldMultiplier);
        const maxQuantity = Math.round(drop.maxQuantity * yieldMultiplier);
        
        yields.push({
          resourceId: drop.itemId,
          minQuantity,
          maxQuantity,
          probability: adjustedProbability,
          rarity
        });
      }
    }
    
    return yields;
  }

  /**
   * Calculate harvesting duration based on activity and player stats
   */
  private static calculateHarvestingDuration(activity: HarvestingActivity, playerStats: CharacterStats): number {
    let duration = activity.baseTime * 1000; // Convert to milliseconds
    
    // Apply stat bonuses
    if (activity.requiredStats) {
      for (const [stat, required] of Object.entries(activity.requiredStats)) {
        const playerStat = this.getPlayerStat(playerStats, stat);
        if (playerStat > required) {
          // 1% time reduction per stat point above requirement
          const bonus = (playerStat - required) * 0.01;
          duration *= (1 - Math.min(bonus, 0.5)); // Cap at 50% reduction
        }
      }
    }

    return Math.max(1000, Math.floor(duration)); // Minimum 1 second
  }
  
  /**
   * Calculate enhanced harvesting duration with tools and location bonuses
   */
  private static calculateEnhancedHarvestingDuration(
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
   * Get harvesting skill level for category
   */
  private static getHarvestingSkillLevel(playerStats: CharacterStats, category: HarvestingCategory): number {
    if (!playerStats.harvestingSkills) {
      return 1;
    }
    
    switch (category) {
      case HarvestingCategory.LITERARY:
        return playerStats.harvestingSkills.level || 1;
      case HarvestingCategory.MECHANICAL:
        return playerStats.harvestingSkills.salvaging || 1;
      case HarvestingCategory.ALCHEMICAL:
        return playerStats.harvestingSkills.level || 1;
      case HarvestingCategory.ARCHAEOLOGICAL:
        return playerStats.harvestingSkills.level || 1;
      case HarvestingCategory.ELECTRICAL:
        return playerStats.harvestingSkills.level || 1;
      case HarvestingCategory.AERONAUTICAL:
        return playerStats.harvestingSkills.level || 1;
      case HarvestingCategory.METALLURGICAL:
        return playerStats.harvestingSkills.mining || 1;
      default:
        return 1;
    }
  }

  /**
   * Calculate quality modifier for crafting
   */
  private static calculateQualityModifier(playerStats: CharacterStats, recipe: CraftingRecipe): number {
    const skillLevel = this.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
    const skillBonus = Math.max(0, skillLevel - recipe.requiredLevel) * 0.02; // 2% per level above requirement
    return Math.min(1.5, 0.8 + skillBonus); // Range from 0.8 to 1.5
  }

  /**
   * Calculate combat estimate
   */
  private static calculateCombatEstimate(
    playerStats: PlayerCombatStats, 
    enemy: Enemy, 
    playerLevel: number
  ): any {
    const playerPower = playerStats.attack + playerStats.defense + (playerStats.health / 10);
    const enemyPower = enemy.stats.attack + enemy.stats.defense + (enemy.stats.health / 10);
    
    const powerRatio = playerPower / enemyPower;
    const winProbability = Math.max(0.05, Math.min(0.95, 0.5 + (powerRatio - 1) * 0.3));
    
    const estimatedDuration = Math.max(10, Math.floor(
      (enemy.stats.health / Math.max(1, playerStats.attack - enemy.stats.defense)) * 3
    ));

    let riskLevel: 'low' | 'medium' | 'high' | 'extreme' = 'medium';
    if (winProbability > 0.8) riskLevel = 'low';
    else if (winProbability > 0.6) riskLevel = 'medium';
    else if (winProbability > 0.3) riskLevel = 'high';
    else riskLevel = 'extreme';

    return {
      winProbability,
      estimatedDuration,
      expectedRewards: enemy.lootTable.map(loot => ({
        type: 'item',
        itemId: loot.itemId,
        quantity: loot.quantity,
        rarity: loot.rarity,
        isRare: loot.rarity !== 'common'
      })),
      riskLevel
    };
  }

  /**
   * Get player stat value by name
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
      default:
        return 0;
    }
  }

  /**
   * Get crafting skill level by skill type
   */
  static getCraftingSkillLevel(playerStats: CharacterStats, skillType: string): number {
    switch (skillType) {
      case 'clockmaking':
        return playerStats.craftingSkills.clockmaking;
      case 'engineering':
        return playerStats.craftingSkills.engineering;
      case 'alchemy':
        return playerStats.craftingSkills.alchemy;
      case 'steamcraft':
        return playerStats.craftingSkills.steamcraft;
      default:
        return 0;
    }
  }

  /**
   * Update task progress
   */
  static updateTaskProgress(task: Task, progressDelta: number): Task {
    const newProgress = Math.min(1, Math.max(0, task.progress + progressDelta));
    
    return {
      ...task,
      progress: newProgress,
      completed: newProgress >= 1
    };
  }

  /**
   * Check if task can be retried
   */
  static canRetryTask(task: Task): boolean {
    return task.retryCount < task.maxRetries && !task.completed;
  }

  /**
   * Create retry task
   */
  static createRetryTask(originalTask: Task): Task {
    return {
      ...originalTask,
      id: `${originalTask.id}-retry-${originalTask.retryCount + 1}`,
      retryCount: originalTask.retryCount + 1,
      progress: 0,
      completed: false,
      startTime: 0,
      estimatedCompletion: Date.now() + originalTask.duration
    };
  }

  /**
   * Calculate total queue duration
   */
  static calculateQueueDuration(tasks: Task[]): number {
    return tasks.reduce((total, task) => total + task.duration, 0);
  }

  /**
   * Sort tasks by priority (higher priority first)
   */
  static sortTasksByPriority(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Filter valid tasks
   */
  static filterValidTasks(tasks: Task[]): Task[] {
    return tasks.filter(task => task.isValid && task.validationErrors.length === 0);
  }

  /**
   * Calculate checksum for data integrity
   */
  static calculateChecksum(data: string): string {
    let hash = 0;
    if (data.length === 0) return hash.toString();
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }
}