/**
 * Task Validation Service
 * Provides validation methods for each activity type in the task queue system
 */

import { 
  Task, 
  TaskType, 
  TaskValidationResult, 
  TaskValidationError, 
  TaskValidationWarning,
  HarvestingTaskData,
  CraftingTaskData,
  CombatTaskData,
  TaskPrerequisite,
  ResourceRequirement,
  TaskValidationOptions,
  ValidationBypassReason,
  Equipment
} from '../types/taskQueue';
import { CharacterStats } from '../types/character';
import { PlayerCombatStats } from '../types/combat';

export class TaskValidationService {
  
  /**
   * Validate a task based on its type and current player state
   */
  static validateTask(
    task: Task, 
    playerStats: CharacterStats, 
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: TaskValidationOptions = {}
  ): TaskValidationResult {
    const errors: TaskValidationError[] = [];
    const warnings: TaskValidationWarning[] = [];

    // Check for validation bypass
    if (this.shouldBypassValidation(options)) {
      this.logValidationBypass(task, options);
      return {
        isValid: true,
        errors: [],
        warnings: [{
          code: 'VALIDATION_BYPASSED',
          message: `Validation bypassed: ${options.bypassReason || 'Unknown reason'}`,
          suggestion: 'This task was allowed to proceed despite potential validation issues'
        }]
      };
    }

    // Basic task validation
    this.validateBasicTask(task, errors);

    // Type-specific validation
    switch (task.type) {
      case TaskType.HARVESTING:
        this.validateHarvestingTask(task, playerStats, playerLevel, errors, warnings, options);
        break;
      case TaskType.CRAFTING:
        this.validateCraftingTask(task, playerStats, playerLevel, playerInventory, errors, warnings, options);
        break;
      case TaskType.COMBAT:
        this.validateCombatTask(task, playerStats, playerLevel, errors, warnings, options);
        break;
    }

    // Validate prerequisites (unless bypassed)
    if (!options.skipPrerequisiteCheck) {
      this.validatePrerequisites(task.prerequisites, playerStats, playerLevel, playerInventory, errors);
    }

    // Validate resource requirements (unless bypassed)
    if (!options.skipResourceCheck) {
      this.validateResourceRequirements(task.resourceRequirements, playerInventory, errors);
    }

    // Validate equipment requirements (unless bypassed)
    if (!options.skipEquipmentCheck) {
      this.validateEquipmentRequirements(task, playerStats, errors, warnings);
    }

    // Allow invalid tasks in test mode
    const isValid = options.allowInvalidTasks ? true : errors.length === 0;

    return {
      isValid,
      errors,
      warnings
    };
  }

  /**
   * Validate basic task properties
   */
  private static validateBasicTask(task: Task, errors: TaskValidationError[]): void {
    if (!task.id || task.id.trim() === '') {
      errors.push({
        code: 'INVALID_TASK_ID',
        message: 'Task ID is required and cannot be empty',
        field: 'id',
        severity: 'error'
      });
    }

    if (!task.playerId || task.playerId.trim() === '') {
      errors.push({
        code: 'INVALID_PLAYER_ID',
        message: 'Player ID is required and cannot be empty',
        field: 'playerId',
        severity: 'error'
      });
    }

    if (task.duration <= 0) {
      errors.push({
        code: 'INVALID_DURATION',
        message: 'Task duration must be greater than 0',
        field: 'duration',
        severity: 'error'
      });
    }

    if (task.maxRetries < 0) {
      errors.push({
        code: 'INVALID_MAX_RETRIES',
        message: 'Max retries cannot be negative',
        field: 'maxRetries',
        severity: 'error'
      });
    }

    if (task.priority < 0 || task.priority > 10) {
      errors.push({
        code: 'INVALID_PRIORITY',
        message: 'Task priority must be between 0 and 10',
        field: 'priority',
        severity: 'error'
      });
    }
  }

  /**
   * Check if validation should be bypassed
   */
  private static shouldBypassValidation(options: TaskValidationOptions): boolean {
    return !!(options.bypassValidation || options.adminOverride || options.testMode);
  }

  /**
   * Log validation bypass for audit purposes
   */
  private static logValidationBypass(task: Task, options: TaskValidationOptions): void {
    const reason = options.bypassReason || ValidationBypassReason.TESTING;
    console.log(`[VALIDATION BYPASS] Task ${task.id} validation bypassed. Reason: ${reason}`);
    
    // In production, this would log to a proper audit system
    if (typeof window !== 'undefined' && (window as any).gameAuditLog) {
      (window as any).gameAuditLog.push({
        type: 'validation_bypass',
        taskId: task.id,
        playerId: task.playerId,
        reason,
        timestamp: Date.now(),
        adminOverride: options.adminOverride,
        testMode: options.testMode
      });
    }
  }

  /**
   * Validate equipment requirements for all task types
   */
  private static validateEquipmentRequirements(
    task: Task,
    playerStats: CharacterStats,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    // Check for broken or missing equipment based on task type
    switch (task.type) {
      case TaskType.HARVESTING:
        this.validateHarvestingEquipment(task, errors, warnings);
        break;
      case TaskType.CRAFTING:
        this.validateCraftingEquipment(task, errors, warnings);
        break;
      case TaskType.COMBAT:
        this.validateCombatEquipment(task, errors, warnings);
        break;
    }
  }

  /**
   * Validate harvesting equipment
   */
  private static validateHarvestingEquipment(
    task: Task,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    const harvestingData = task.activityData as HarvestingTaskData;
    
    if (harvestingData.tools && harvestingData.tools.length > 0) {
      for (const tool of harvestingData.tools) {
        if (tool.durability <= 0) {
          errors.push({
            code: 'BROKEN_HARVESTING_TOOL',
            message: `Harvesting tool ${tool.name} is broken and cannot be used`,
            field: 'equipment.tools',
            severity: 'error'
          });
        } else if (tool.durability < tool.maxDurability * 0.1) {
          warnings.push({
            code: 'LOW_TOOL_DURABILITY',
            message: `Tool ${tool.name} has very low durability (${tool.durability}/${tool.maxDurability})`,
            suggestion: 'Repair the tool before starting the task for better efficiency'
          });
        }

        // Check if tool is appropriate for the activity
        if (tool.type !== 'harvesting') {
          warnings.push({
            code: 'INAPPROPRIATE_TOOL',
            message: `Tool ${tool.name} is not designed for harvesting`,
            suggestion: 'Use appropriate harvesting tools for better results'
          });
        }
      }
    } else {
      // Warn if no tools are equipped for harvesting
      warnings.push({
        code: 'NO_HARVESTING_TOOLS',
        message: 'No harvesting tools equipped',
        suggestion: 'Equip appropriate tools to improve harvesting efficiency'
      });
    }
  }

  /**
   * Validate crafting equipment
   */
  private static validateCraftingEquipment(
    task: Task,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    const craftingData = task.activityData as CraftingTaskData;
    
    // Check crafting station requirements
    if (craftingData.craftingStation) {
      const station = craftingData.craftingStation;
      
      // Validate station requirements
      for (const requirement of station.requirements) {
        if (!requirement.isMet) {
          errors.push({
            code: 'CRAFTING_STATION_UNAVAILABLE',
            message: `Crafting station requirement not met: ${requirement.description}`,
            field: 'equipment.craftingStation',
            severity: 'error'
          });
        }
      }
    } else {
      // Check if recipe requires a crafting station
      const recipe = craftingData.recipe;
      if (recipe.requiredLevel > 5) { // Assume higher level recipes need stations
        warnings.push({
          code: 'NO_CRAFTING_STATION',
          message: 'Advanced recipes work better with a crafting station',
          suggestion: 'Use a crafting station to improve quality and reduce crafting time'
        });
      }
    }
  }

  /**
   * Validate combat equipment
   */
  private static validateCombatEquipment(
    task: Task,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    const combatData = task.activityData as CombatTaskData;
    
    if (combatData.equipment && combatData.equipment.length > 0) {
      let hasWeapon = false;
      let hasArmor = false;
      
      for (const equipment of combatData.equipment) {
        // Check equipment durability
        if (equipment.durability <= 0) {
          errors.push({
            code: 'BROKEN_EQUIPMENT',
            message: `Equipment ${equipment.name} is broken and cannot be used in combat`,
            field: 'equipment.combat',
            severity: 'error'
          });
        } else if (equipment.durability < equipment.maxDurability * 0.2) {
          warnings.push({
            code: 'LOW_EQUIPMENT_DURABILITY',
            message: `Equipment ${equipment.name} has low durability (${equipment.durability}/${equipment.maxDurability})`,
            suggestion: 'Repair equipment before combat to avoid breaking during battle'
          });
        }

        // Check equipment requirements
        for (const requirement of equipment.requirements) {
          if (!requirement.isMet) {
            errors.push({
              code: 'EQUIPMENT_REQUIREMENT_NOT_MET',
              message: `Cannot use ${equipment.name}: ${requirement.description}`,
              field: 'equipment.requirements',
              severity: 'error'
            });
          }
        }

        // Track equipment types
        if (equipment.type === 'weapon') hasWeapon = true;
        if (equipment.type === 'armor') hasArmor = true;
      }

      // Warn about missing essential equipment
      if (!hasWeapon) {
        warnings.push({
          code: 'NO_WEAPON_EQUIPPED',
          message: 'No weapon equipped for combat',
          suggestion: 'Equip a weapon to improve combat effectiveness'
        });
      }

      if (!hasArmor) {
        warnings.push({
          code: 'NO_ARMOR_EQUIPPED',
          message: 'No armor equipped for combat',
          suggestion: 'Equip armor to reduce damage taken in combat'
        });
      }
    } else {
      warnings.push({
        code: 'NO_COMBAT_EQUIPMENT',
        message: 'No combat equipment equipped',
        suggestion: 'Equip weapons and armor before engaging in combat'
      });
    }
  }

  /**
   * Validate harvesting-specific task requirements
   */
  private static validateHarvestingTask(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[],
    options: TaskValidationOptions = {}
  ): void {
    const harvestingData = task.activityData as HarvestingTaskData;
    
    if (!harvestingData.activity) {
      errors.push({
        code: 'MISSING_HARVESTING_ACTIVITY',
        message: 'Harvesting activity data is required',
        field: 'activityData.activity',
        severity: 'error'
      });
      return;
    }

    const activity = harvestingData.activity;

    // Check level requirement
    if (playerLevel < activity.requiredLevel) {
      errors.push({
        code: 'INSUFFICIENT_LEVEL',
        message: `Player level ${playerLevel} is below required level ${activity.requiredLevel}`,
        field: 'level',
        severity: 'error'
      });
    }

    // Check stat requirements
    if (activity.requiredStats) {
      for (const [stat, required] of Object.entries(activity.requiredStats)) {
        const playerStat = this.getPlayerStat(playerStats, stat);
        if (playerStat < required) {
          errors.push({
            code: 'INSUFFICIENT_STAT',
            message: `${stat} ${playerStat} is below required ${required}`,
            field: `stats.${stat}`,
            severity: 'error'
          });
        }
      }
    }

    // Check energy cost
    if (activity.energyCost > 100) { // Assuming max energy is 100
      warnings.push({
        code: 'HIGH_ENERGY_COST',
        message: `This activity requires ${activity.energyCost} energy`,
        suggestion: 'Consider resting before starting this task'
      });
    }

    // Validate tools
    if (harvestingData.tools && harvestingData.tools.length > 0) {
      for (const tool of harvestingData.tools) {
        if (tool.durability <= 0) {
          warnings.push({
            code: 'BROKEN_TOOL',
            message: `Tool ${tool.name} is broken and needs repair`,
            suggestion: 'Repair or replace the tool for better efficiency'
          });
        }
      }
    }
  }

  /**
   * Validate crafting-specific task requirements
   */
  private static validateCraftingTask(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[],
    options: TaskValidationOptions = {}
  ): void {
    const craftingData = task.activityData as CraftingTaskData;
    
    if (!craftingData.recipe) {
      errors.push({
        code: 'MISSING_CRAFTING_RECIPE',
        message: 'Crafting recipe data is required',
        field: 'activityData.recipe',
        severity: 'error'
      });
      return;
    }

    const recipe = craftingData.recipe;

    // Check level requirement
    if (playerLevel < recipe.requiredLevel) {
      errors.push({
        code: 'INSUFFICIENT_LEVEL',
        message: `Player level ${playerLevel} is below required level ${recipe.requiredLevel}`,
        field: 'level',
        severity: 'error'
      });
    }

    // Check skill requirement
    const skillLevel = this.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
    if (skillLevel < recipe.requiredLevel) {
      errors.push({
        code: 'INSUFFICIENT_SKILL',
        message: `${recipe.requiredSkill} skill level ${skillLevel} is below required ${recipe.requiredLevel}`,
        field: `craftingSkills.${recipe.requiredSkill}`,
        severity: 'error'
      });
    }

    // Check material requirements
    for (const material of recipe.materials) {
      const available = playerInventory[material.materialId] || 0;
      if (available < material.quantity) {
        errors.push({
          code: 'INSUFFICIENT_MATERIALS',
          message: `Need ${material.quantity} ${material.name}, have ${available}`,
          field: 'materials',
          severity: 'error'
        });
      }
    }

    // Check crafting station requirements
    if (craftingData.craftingStation) {
      const station = craftingData.craftingStation;
      for (const requirement of station.requirements) {
        if (!this.checkPrerequisite(requirement, playerStats, playerLevel, playerInventory)) {
          errors.push({
            code: 'CRAFTING_STATION_REQUIREMENT',
            message: `Crafting station requires: ${requirement.description}`,
            field: 'craftingStation',
            severity: 'error'
          });
        }
      }
    }

    // Warn about long crafting times
    if (recipe.craftingTime > 3600) { // More than 1 hour
      warnings.push({
        code: 'LONG_CRAFTING_TIME',
        message: `This recipe takes ${Math.round(recipe.craftingTime / 60)} minutes to complete`,
        suggestion: 'Consider queuing shorter tasks first'
      });
    }
  }

  /**
   * Validate combat-specific task requirements
   */
  private static validateCombatTask(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[],
    options: TaskValidationOptions = {}
  ): void {
    const combatData = task.activityData as CombatTaskData;
    
    if (!combatData.enemy) {
      errors.push({
        code: 'MISSING_ENEMY_DATA',
        message: 'Enemy data is required for combat tasks',
        field: 'activityData.enemy',
        severity: 'error'
      });
      return;
    }

    const enemy = combatData.enemy;

    // Check if player level is reasonable for enemy
    const levelDifference = enemy.level - playerLevel;
    if (levelDifference > 10) {
      errors.push({
        code: 'ENEMY_TOO_STRONG',
        message: `Enemy level ${enemy.level} is much higher than player level ${playerLevel}`,
        field: 'enemy.level',
        severity: 'error'
      });
    } else if (levelDifference > 5) {
      warnings.push({
        code: 'CHALLENGING_ENEMY',
        message: `Enemy level ${enemy.level} is significantly higher than player level ${playerLevel}`,
        suggestion: 'Consider improving equipment or gaining more levels'
      });
    }

    // Check equipment durability
    if (combatData.equipment && combatData.equipment.length > 0) {
      for (const equipment of combatData.equipment) {
        if (equipment.durability <= 0) {
          errors.push({
            code: 'BROKEN_EQUIPMENT',
            message: `Equipment ${equipment.name} is broken`,
            field: 'equipment',
            severity: 'error'
          });
        } else if (equipment.durability < equipment.maxDurability * 0.2) {
          warnings.push({
            code: 'LOW_DURABILITY_EQUIPMENT',
            message: `Equipment ${equipment.name} has low durability`,
            suggestion: 'Consider repairing equipment before combat'
          });
        }
      }
    }

    // Check combat estimate
    if (combatData.estimatedOutcome) {
      const outcome = combatData.estimatedOutcome;
      if (outcome.winProbability < 0.3) {
        warnings.push({
          code: 'LOW_WIN_CHANCE',
          message: `Low chance of victory (${Math.round(outcome.winProbability * 100)}%)`,
          suggestion: 'Consider improving stats or equipment before attempting'
        });
      }

      if (outcome.riskLevel === 'extreme') {
        warnings.push({
          code: 'EXTREME_RISK',
          message: 'This combat has extreme risk level',
          suggestion: 'Ensure you are well-prepared for potential failure'
        });
      }
    }
  }

  /**
   * Validate task prerequisites
   */
  private static validatePrerequisites(
    prerequisites: TaskPrerequisite[],
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    errors: TaskValidationError[]
  ): void {
    for (const prerequisite of prerequisites) {
      if (!this.checkPrerequisite(prerequisite, playerStats, playerLevel, playerInventory)) {
        errors.push({
          code: 'PREREQUISITE_NOT_MET',
          message: `Prerequisite not met: ${prerequisite.description}`,
          field: 'prerequisites',
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate resource requirements
   */
  private static validateResourceRequirements(
    requirements: ResourceRequirement[],
    playerInventory: { [itemId: string]: number },
    errors: TaskValidationError[]
  ): void {
    for (const requirement of requirements) {
      const available = playerInventory[requirement.resourceId] || 0;
      if (available < requirement.quantityRequired) {
        errors.push({
          code: 'INSUFFICIENT_RESOURCES',
          message: `Need ${requirement.quantityRequired} ${requirement.resourceName}, have ${available}`,
          field: 'resources',
          severity: 'error'
        });
      }
    }
  }

  /**
   * Check if a prerequisite is met
   */
  private static checkPrerequisite(
    prerequisite: TaskPrerequisite,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number }
  ): boolean {
    switch (prerequisite.type) {
      case 'level':
        return playerLevel >= (prerequisite.requirement as number);
      
      case 'stat':
        const statValue = this.getPlayerStat(playerStats, prerequisite.requirement as string);
        return statValue >= (prerequisite.value as number);
      
      case 'skill':
        const skillValue = this.getSkillLevel(playerStats, prerequisite.requirement as string);
        return skillValue >= (prerequisite.value as number);
      
      case 'item':
        const itemCount = playerInventory[prerequisite.requirement as string] || 0;
        return itemCount >= (prerequisite.value as number);
      
      case 'equipment':
        // This would require additional equipment checking logic
        return true; // Placeholder
      
      case 'activity':
        // This would require activity completion tracking
        return true; // Placeholder
      
      default:
        return false;
    }
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
  private static getCraftingSkillLevel(playerStats: CharacterStats, skillType: string): number {
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
   * Get skill level by skill name
   */
  private static getSkillLevel(playerStats: CharacterStats, skillName: string): number {
    // Check crafting skills
    const craftingLevel = this.getCraftingSkillLevel(playerStats, skillName);
    if (craftingLevel > 0) return craftingLevel;

    // Check harvesting skills
    switch (skillName) {
      case 'mining':
        return playerStats.harvestingSkills.mining;
      case 'foraging':
        return playerStats.harvestingSkills.foraging;
      case 'salvaging':
        return playerStats.harvestingSkills.salvaging;
      case 'crystal_extraction':
        return playerStats.harvestingSkills.crystal_extraction;
    }

    // Check combat skills
    switch (skillName) {
      case 'melee':
        return playerStats.combatSkills.melee;
      case 'ranged':
        return playerStats.combatSkills.ranged;
      case 'defense':
        return playerStats.combatSkills.defense;
      case 'tactics':
        return playerStats.combatSkills.tactics;
    }

    return 0;
  }

  /**
   * Enhanced resource requirement validation with detailed checking
   */
  static validateResourceAvailability(
    requirements: ResourceRequirement[],
    playerInventory: { [itemId: string]: number },
    options: TaskValidationOptions = {}
  ): TaskValidationResult {
    const errors: TaskValidationError[] = [];
    const warnings: TaskValidationWarning[] = [];

    if (options.skipResourceCheck) {
      return { isValid: true, errors: [], warnings: [] };
    }

    for (const requirement of requirements) {
      const available = playerInventory[requirement.resourceId] || 0;
      const needed = requirement.quantityRequired;
      
      if (available < needed) {
        const shortage = needed - available;
        errors.push({
          code: 'INSUFFICIENT_RESOURCES',
          message: `Need ${needed} ${requirement.resourceName}, have ${available} (short by ${shortage})`,
          field: `resources.${requirement.resourceId}`,
          severity: 'error'
        });
      } else if (available === needed) {
        warnings.push({
          code: 'EXACT_RESOURCE_MATCH',
          message: `Using all available ${requirement.resourceName} (${available})`,
          suggestion: 'Consider gathering more resources before starting this task'
        });
      } else if (available < needed * 1.5) {
        warnings.push({
          code: 'LOW_RESOURCE_BUFFER',
          message: `Low buffer for ${requirement.resourceName} (${available} available, ${needed} needed)`,
          suggestion: 'Consider gathering more resources to maintain a safety buffer'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate prerequisite requirements with detailed checking
   */
  static validatePrerequisiteRequirements(
    prerequisites: TaskPrerequisite[],
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: TaskValidationOptions = {}
  ): TaskValidationResult {
    const errors: TaskValidationError[] = [];
    const warnings: TaskValidationWarning[] = [];

    if (options.skipPrerequisiteCheck) {
      return { isValid: true, errors: [], warnings: [] };
    }

    for (const prerequisite of prerequisites) {
      const result = this.checkPrerequisiteDetailed(prerequisite, playerStats, playerLevel, playerInventory);
      
      if (!result.isMet) {
        errors.push({
          code: 'PREREQUISITE_NOT_MET',
          message: result.message,
          field: `prerequisites.${prerequisite.type}`,
          severity: 'error'
        });
      } else if (result.warning) {
        warnings.push({
          code: 'PREREQUISITE_WARNING',
          message: result.warning,
          suggestion: result.suggestion
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Detailed prerequisite checking with warnings
   */
  private static checkPrerequisiteDetailed(
    prerequisite: TaskPrerequisite,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number }
  ): { isMet: boolean; message: string; warning?: string; suggestion?: string } {
    switch (prerequisite.type) {
      case 'level':
        const requiredLevel = prerequisite.requirement as number;
        const isMet = playerLevel >= requiredLevel;
        const levelDiff = requiredLevel - playerLevel;
        
        return {
          isMet,
          message: isMet 
            ? `Level requirement met (${playerLevel}/${requiredLevel})`
            : `Level too low: need ${requiredLevel}, have ${playerLevel} (${levelDiff} levels short)`,
          warning: isMet && playerLevel === requiredLevel 
            ? `Minimum level requirement (${requiredLevel})` 
            : undefined,
          suggestion: !isMet 
            ? `Gain ${levelDiff} more levels before attempting this task`
            : undefined
        };
      
      case 'stat':
        const statName = prerequisite.requirement as string;
        const requiredValue = prerequisite.value as number;
        const currentValue = this.getPlayerStat(playerStats, statName);
        const statMet = currentValue >= requiredValue;
        const statDiff = requiredValue - currentValue;
        
        return {
          isMet: statMet,
          message: statMet
            ? `${statName} requirement met (${currentValue}/${requiredValue})`
            : `${statName} too low: need ${requiredValue}, have ${currentValue} (${statDiff} points short)`,
          warning: statMet && currentValue === requiredValue
            ? `Minimum ${statName} requirement (${requiredValue})`
            : undefined,
          suggestion: !statMet
            ? `Increase ${statName} by ${statDiff} points through training or equipment`
            : undefined
        };
      
      case 'skill':
        const skillName = prerequisite.requirement as string;
        const requiredSkill = prerequisite.value as number;
        const currentSkill = this.getSkillLevel(playerStats, skillName);
        const skillMet = currentSkill >= requiredSkill;
        const skillDiff = requiredSkill - currentSkill;
        
        return {
          isMet: skillMet,
          message: skillMet
            ? `${skillName} skill requirement met (${currentSkill}/${requiredSkill})`
            : `${skillName} skill too low: need ${requiredSkill}, have ${currentSkill} (${skillDiff} levels short)`,
          warning: skillMet && currentSkill === requiredSkill
            ? `Minimum ${skillName} skill requirement (${requiredSkill})`
            : undefined,
          suggestion: !skillMet
            ? `Practice ${skillName} to gain ${skillDiff} more levels`
            : undefined
        };
      
      case 'item':
        const itemId = prerequisite.requirement as string;
        const requiredQuantity = prerequisite.value as number;
        const availableQuantity = playerInventory[itemId] || 0;
        const itemMet = availableQuantity >= requiredQuantity;
        const itemDiff = requiredQuantity - availableQuantity;
        
        return {
          isMet: itemMet,
          message: itemMet
            ? `Item requirement met: have ${availableQuantity}/${requiredQuantity} ${itemId}`
            : `Missing items: need ${requiredQuantity} ${itemId}, have ${availableQuantity} (${itemDiff} short)`,
          suggestion: !itemMet
            ? `Obtain ${itemDiff} more ${itemId} before starting this task`
            : undefined
        };
      
      default:
        return {
          isMet: true,
          message: `Unknown prerequisite type: ${prerequisite.type}`
        };
    }
  }

  /**
   * Admin and testing utility methods
   */
  static createAdminValidationOptions(reason: string = 'Admin override'): TaskValidationOptions {
    return {
      bypassValidation: true,
      bypassReason: ValidationBypassReason.ADMIN_OVERRIDE,
      adminOverride: true,
      skipResourceCheck: true,
      skipPrerequisiteCheck: true,
      skipEquipmentCheck: true,
      allowInvalidTasks: true
    };
  }

  static createTestValidationOptions(): TaskValidationOptions {
    return {
      bypassValidation: true,
      bypassReason: ValidationBypassReason.TESTING,
      testMode: true,
      allowInvalidTasks: true
    };
  }

  static createDebugValidationOptions(): TaskValidationOptions {
    return {
      bypassValidation: false, // Don't bypass completely in debug mode
      bypassReason: ValidationBypassReason.DEBUG,
      testMode: true,
      allowInvalidTasks: true,
      skipResourceCheck: false, // Still check resources for debugging
      skipPrerequisiteCheck: false, // Still check prerequisites for debugging
      skipEquipmentCheck: false // Still check equipment for debugging
    };
  }

  /**
   * Validate task with bypass logging for audit purposes
   */
  static validateTaskWithAudit(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: TaskValidationOptions = {},
    auditContext?: { userId: string; sessionId: string; reason?: string }
  ): TaskValidationResult {
    const result = this.validateTask(task, playerStats, playerLevel, playerInventory, options);
    
    // Log validation result for audit
    if (auditContext) {
      const auditEntry = {
        timestamp: Date.now(),
        taskId: task.id,
        playerId: task.playerId,
        userId: auditContext.userId,
        sessionId: auditContext.sessionId,
        validationResult: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        bypassUsed: this.shouldBypassValidation(options),
        bypassReason: options.bypassReason,
        adminOverride: options.adminOverride,
        testMode: options.testMode,
        reason: auditContext.reason
      };

      // In production, this would be sent to an audit service
      console.log('[TASK VALIDATION AUDIT]', auditEntry);
    }

    return result;
  }

  /**
   * Enhanced validation with comprehensive error handling and descriptive messages
   */
  static validateTaskComprehensive(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: TaskValidationOptions = {}
  ): TaskValidationResult {
    const errors: TaskValidationError[] = [];
    const warnings: TaskValidationWarning[] = [];

    try {
      // Check for validation bypass first
      if (this.shouldBypassValidation(options)) {
        this.logValidationBypass(task, options);
        return {
          isValid: true,
          errors: [],
          warnings: [{
            code: 'VALIDATION_BYPASSED',
            message: `Validation bypassed: ${options.bypassReason || 'Unknown reason'}`,
            suggestion: 'This task was allowed to proceed despite potential validation issues'
          }]
        };
      }

      // Comprehensive basic validation
      this.validateBasicTaskComprehensive(task, errors, warnings);

      // Enhanced type-specific validation
      switch (task.type) {
        case TaskType.HARVESTING:
          this.validateHarvestingTaskComprehensive(task, playerStats, playerLevel, errors, warnings, options);
          break;
        case TaskType.CRAFTING:
          this.validateCraftingTaskComprehensive(task, playerStats, playerLevel, playerInventory, errors, warnings, options);
          break;
        case TaskType.COMBAT:
          this.validateCombatTaskComprehensive(task, playerStats, playerLevel, errors, warnings, options);
          break;
        default:
          errors.push({
            code: 'UNKNOWN_TASK_TYPE',
            message: `Unknown task type: ${task.type}`,
            field: 'type',
            severity: 'error'
          });
      }

      // Enhanced prerequisite validation
      if (!options.skipPrerequisiteCheck) {
        this.validatePrerequisitesComprehensive(task.prerequisites, playerStats, playerLevel, playerInventory, errors, warnings);
      }

      // Enhanced resource validation
      if (!options.skipResourceCheck) {
        this.validateResourceRequirementsComprehensive(task.resourceRequirements, playerInventory, errors, warnings);
      }

      // Enhanced equipment validation
      if (!options.skipEquipmentCheck) {
        this.validateEquipmentRequirementsComprehensive(task, playerStats, errors, warnings);
      }

      // Task duration and complexity validation
      this.validateTaskComplexity(task, errors, warnings);

      // Cross-validation checks
      this.performCrossValidation(task, playerStats, playerLevel, playerInventory, errors, warnings);

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Validation failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }

    const isValid = options.allowInvalidTasks ? true : errors.length === 0;

    return {
      isValid,
      errors,
      warnings
    };
  }

  /**
   * Enhanced basic task validation with comprehensive checks
   */
  private static validateBasicTaskComprehensive(
    task: Task,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    // ID validation
    if (!task.id || task.id.trim() === '') {
      errors.push({
        code: 'INVALID_TASK_ID',
        message: 'Task ID is required and cannot be empty',
        field: 'id',
        severity: 'error'
      });
    } else if (task.id.length > 100) {
      warnings.push({
        code: 'LONG_TASK_ID',
        message: `Task ID is unusually long (${task.id.length} characters)`,
        suggestion: 'Consider using shorter, more manageable task IDs'
      });
    }

    // Player ID validation
    if (!task.playerId || task.playerId.trim() === '') {
      errors.push({
        code: 'INVALID_PLAYER_ID',
        message: 'Player ID is required and cannot be empty',
        field: 'playerId',
        severity: 'error'
      });
    }

    // Duration validation
    if (task.duration <= 0) {
      errors.push({
        code: 'INVALID_DURATION',
        message: 'Task duration must be greater than 0',
        field: 'duration',
        severity: 'error'
      });
    } else if (task.duration > 24 * 60 * 60 * 1000) { // More than 24 hours
      errors.push({
        code: 'EXCESSIVE_DURATION',
        message: `Task duration ${Math.round(task.duration / 1000 / 60)} minutes exceeds maximum allowed (24 hours)`,
        field: 'duration',
        severity: 'error'
      });
    } else if (task.duration > 4 * 60 * 60 * 1000) { // More than 4 hours
      warnings.push({
        code: 'LONG_DURATION',
        message: `Task duration ${Math.round(task.duration / 1000 / 60)} minutes is quite long`,
        suggestion: 'Consider breaking long tasks into smaller segments'
      });
    }

    // Priority validation
    if (task.priority < 0 || task.priority > 10) {
      errors.push({
        code: 'INVALID_PRIORITY',
        message: 'Task priority must be between 0 and 10',
        field: 'priority',
        severity: 'error'
      });
    }

    // Retry validation
    if (task.maxRetries < 0) {
      errors.push({
        code: 'INVALID_MAX_RETRIES',
        message: 'Max retries cannot be negative',
        field: 'maxRetries',
        severity: 'error'
      });
    } else if (task.maxRetries > 10) {
      warnings.push({
        code: 'HIGH_MAX_RETRIES',
        message: `Max retries (${task.maxRetries}) is unusually high`,
        suggestion: 'Consider investigating why tasks might need so many retries'
      });
    }

    // Progress validation
    if (task.progress < 0 || task.progress > 1) {
      errors.push({
        code: 'INVALID_PROGRESS',
        message: `Task progress ${task.progress} must be between 0 and 1`,
        field: 'progress',
        severity: 'error'
      });
    }

    // Name and description validation
    if (!task.name || task.name.trim() === '') {
      warnings.push({
        code: 'MISSING_TASK_NAME',
        message: 'Task name is empty',
        suggestion: 'Provide a descriptive name for better user experience'
      });
    }

    if (!task.description || task.description.trim() === '') {
      warnings.push({
        code: 'MISSING_TASK_DESCRIPTION',
        message: 'Task description is empty',
        suggestion: 'Provide a description to help players understand the task'
      });
    }
  }

  /**
   * Enhanced harvesting task validation
   */
  private static validateHarvestingTaskComprehensive(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[],
    options: TaskValidationOptions = {}
  ): void {
    const harvestingData = task.activityData as HarvestingTaskData;
    
    if (!harvestingData || !harvestingData.activity) {
      errors.push({
        code: 'MISSING_HARVESTING_DATA',
        message: 'Harvesting activity data is required',
        field: 'activityData.activity',
        severity: 'error'
      });
      return;
    }

    const activity = harvestingData.activity;

    // Level requirement validation with detailed feedback
    if (playerLevel < activity.requiredLevel) {
      const levelDiff = activity.requiredLevel - playerLevel;
      errors.push({
        code: 'INSUFFICIENT_LEVEL',
        message: `Player level ${playerLevel} is ${levelDiff} levels below required level ${activity.requiredLevel}`,
        field: 'level',
        severity: 'error'
      });
    } else if (playerLevel === activity.requiredLevel) {
      warnings.push({
        code: 'MINIMUM_LEVEL_REQUIREMENT',
        message: `Player is at minimum required level (${activity.requiredLevel})`,
        suggestion: 'Consider gaining more levels for better efficiency'
      });
    }

    // Stat requirements validation
    if (activity.requiredStats) {
      for (const [stat, required] of Object.entries(activity.requiredStats)) {
        const playerStat = this.getPlayerStat(playerStats, stat);
        const statDiff = required - playerStat;
        
        if (playerStat < required) {
          errors.push({
            code: 'INSUFFICIENT_STAT',
            message: `${stat} ${playerStat} is ${statDiff} points below required ${required}`,
            field: `stats.${stat}`,
            severity: 'error'
          });
        } else if (playerStat === required) {
          warnings.push({
            code: 'MINIMUM_STAT_REQUIREMENT',
            message: `${stat} is at minimum requirement (${required})`,
            suggestion: `Increase ${stat} for better harvesting results`
          });
        }
      }
    }

    // Energy cost validation
    if (activity.energyCost > 0) {
      if (activity.energyCost > 100) {
        warnings.push({
          code: 'HIGH_ENERGY_COST',
          message: `This activity requires ${activity.energyCost} energy`,
          suggestion: 'Ensure you have sufficient energy before starting'
        });
      }
    }

    // Tool validation
    if (harvestingData.tools && harvestingData.tools.length > 0) {
      let hasBrokenTools = false;
      let hasLowDurabilityTools = false;
      
      for (const tool of harvestingData.tools) {
        if (tool.durability <= 0) {
          hasBrokenTools = true;
          errors.push({
            code: 'BROKEN_HARVESTING_TOOL',
            message: `Tool ${tool.name} is broken and cannot be used`,
            field: 'equipment.tools',
            severity: 'error'
          });
        } else if (tool.durability < tool.maxDurability * 0.2) {
          hasLowDurabilityTools = true;
          warnings.push({
            code: 'LOW_TOOL_DURABILITY',
            message: `Tool ${tool.name} has low durability (${tool.durability}/${tool.maxDurability})`,
            suggestion: 'Repair tools before starting for better efficiency'
          });
        }
      }

      if (hasBrokenTools) {
        warnings.push({
          code: 'HARVESTING_EFFICIENCY_REDUCED',
          message: 'Broken tools will reduce harvesting efficiency',
          suggestion: 'Repair or replace broken tools'
        });
      }
    } else {
      warnings.push({
        code: 'NO_HARVESTING_TOOLS',
        message: 'No harvesting tools equipped',
        suggestion: 'Equip appropriate tools to improve efficiency and yield'
      });
    }

    // Location validation
    if (harvestingData.location) {
      const location = harvestingData.location;
      if (location.requirements && location.requirements.length > 0) {
        for (const requirement of location.requirements) {
          if (!requirement.isMet) {
            errors.push({
              code: 'LOCATION_REQUIREMENT_NOT_MET',
              message: `Cannot access location: ${requirement.description}`,
              field: 'location.requirements',
              severity: 'error'
            });
          }
        }
      }
    }
  }

  /**
   * Enhanced crafting task validation
   */
  private static validateCraftingTaskComprehensive(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[],
    options: TaskValidationOptions = {}
  ): void {
    const craftingData = task.activityData as CraftingTaskData;
    
    if (!craftingData || !craftingData.recipe) {
      errors.push({
        code: 'MISSING_CRAFTING_DATA',
        message: 'Crafting recipe data is required',
        field: 'activityData.recipe',
        severity: 'error'
      });
      return;
    }

    const recipe = craftingData.recipe;

    // Level requirement validation
    if (playerLevel < recipe.requiredLevel) {
      const levelDiff = recipe.requiredLevel - playerLevel;
      errors.push({
        code: 'INSUFFICIENT_LEVEL',
        message: `Player level ${playerLevel} is ${levelDiff} levels below required level ${recipe.requiredLevel}`,
        field: 'level',
        severity: 'error'
      });
    }

    // Skill requirement validation
    const skillLevel = this.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
    if (skillLevel < recipe.requiredLevel) {
      const skillDiff = recipe.requiredLevel - skillLevel;
      errors.push({
        code: 'INSUFFICIENT_SKILL',
        message: `${recipe.requiredSkill} skill level ${skillLevel} is ${skillDiff} levels below required ${recipe.requiredLevel}`,
        field: `craftingSkills.${recipe.requiredSkill}`,
        severity: 'error'
      });
    } else if (skillLevel === recipe.requiredLevel) {
      warnings.push({
        code: 'MINIMUM_SKILL_REQUIREMENT',
        message: `${recipe.requiredSkill} skill is at minimum requirement (${recipe.requiredLevel})`,
        suggestion: 'Higher skill levels improve crafting quality and success rate'
      });
    }

    // Material requirements validation
    let totalMaterialShortage = 0;
    let criticalMaterialsMissing = 0;
    
    for (const material of recipe.materials) {
      const available = playerInventory[material.materialId] || 0;
      const shortage = material.quantity - available;
      
      if (available < material.quantity) {
        totalMaterialShortage += shortage;
        criticalMaterialsMissing++;
        
        errors.push({
          code: 'INSUFFICIENT_MATERIALS',
          message: `Need ${material.quantity} ${material.name}, have ${available} (short by ${shortage})`,
          field: 'materials',
          severity: 'error'
        });
      } else if (available === material.quantity) {
        warnings.push({
          code: 'EXACT_MATERIAL_MATCH',
          message: `Using all available ${material.name} (${available})`,
          suggestion: 'Consider gathering more materials to maintain a buffer'
        });
      }
    }

    if (criticalMaterialsMissing > 0) {
      warnings.push({
        code: 'MULTIPLE_MATERIAL_SHORTAGES',
        message: `Missing ${criticalMaterialsMissing} different materials`,
        suggestion: 'Gather all required materials before starting crafting'
      });
    }

    // Crafting station validation
    if (craftingData.craftingStation) {
      const station = craftingData.craftingStation;
      for (const requirement of station.requirements) {
        if (!requirement.isMet) {
          errors.push({
            code: 'CRAFTING_STATION_REQUIREMENT',
            message: `Crafting station requires: ${requirement.description}`,
            field: 'craftingStation',
            severity: 'error'
          });
        }
      }
    } else if (recipe.requiredLevel > 5) {
      warnings.push({
        code: 'NO_CRAFTING_STATION',
        message: 'Advanced recipes benefit from crafting stations',
        suggestion: 'Use a crafting station to improve quality and reduce time'
      });
    }

    // Crafting time validation
    if (recipe.craftingTime > 3600) { // More than 1 hour
      warnings.push({
        code: 'LONG_CRAFTING_TIME',
        message: `This recipe takes ${Math.round(recipe.craftingTime / 60)} minutes to complete`,
        suggestion: 'Consider queuing shorter tasks first or using time-reduction bonuses'
      });
    }

    // Quality prediction
    if (craftingData.qualityModifier < 1.0) {
      warnings.push({
        code: 'REDUCED_QUALITY_EXPECTED',
        message: `Expected quality modifier: ${Math.round(craftingData.qualityModifier * 100)}%`,
        suggestion: 'Improve crafting skill or use better equipment for higher quality'
      });
    }
  }

  /**
   * Enhanced combat task validation
   */
  private static validateCombatTaskComprehensive(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[],
    options: TaskValidationOptions = {}
  ): void {
    const combatData = task.activityData as CombatTaskData;
    
    if (!combatData || !combatData.enemy) {
      errors.push({
        code: 'MISSING_COMBAT_DATA',
        message: 'Enemy data is required for combat tasks',
        field: 'activityData.enemy',
        severity: 'error'
      });
      return;
    }

    const enemy = combatData.enemy;

    // Level difference analysis
    const levelDifference = enemy.level - playerLevel;
    if (levelDifference > 10) {
      errors.push({
        code: 'ENEMY_TOO_STRONG',
        message: `Enemy level ${enemy.level} is ${levelDifference} levels higher than player level ${playerLevel}`,
        field: 'enemy.level',
        severity: 'error'
      });
    } else if (levelDifference > 5) {
      warnings.push({
        code: 'CHALLENGING_ENEMY',
        message: `Enemy level ${enemy.level} is ${levelDifference} levels higher than player level ${playerLevel}`,
        suggestion: 'Consider improving equipment or gaining more levels before attempting'
      });
    } else if (levelDifference < -10) {
      warnings.push({
        code: 'ENEMY_TOO_WEAK',
        message: `Enemy level ${enemy.level} is much lower than player level ${playerLevel}`,
        suggestion: 'This combat may provide minimal experience and rewards'
      });
    }

    // Equipment validation
    if (combatData.equipment && combatData.equipment.length > 0) {
      let hasWeapon = false;
      let hasArmor = false;
      let brokenEquipmentCount = 0;
      let lowDurabilityCount = 0;
      
      for (const equipment of combatData.equipment) {
        // Track equipment types
        if (equipment.type === 'weapon') hasWeapon = true;
        if (equipment.type === 'armor') hasArmor = true;
        
        // Check durability
        if (equipment.durability <= 0) {
          brokenEquipmentCount++;
          errors.push({
            code: 'BROKEN_EQUIPMENT',
            message: `Equipment ${equipment.name} is broken and cannot be used in combat`,
            field: 'equipment.combat',
            severity: 'error'
          });
        } else if (equipment.durability < equipment.maxDurability * 0.2) {
          lowDurabilityCount++;
          warnings.push({
            code: 'LOW_EQUIPMENT_DURABILITY',
            message: `Equipment ${equipment.name} has low durability (${equipment.durability}/${equipment.maxDurability})`,
            suggestion: 'Repair equipment before combat to avoid breaking during battle'
          });
        }

        // Check equipment requirements
        for (const requirement of equipment.requirements) {
          if (!requirement.isMet) {
            errors.push({
              code: 'EQUIPMENT_REQUIREMENT_NOT_MET',
              message: `Cannot use ${equipment.name}: ${requirement.description}`,
              field: 'equipment.requirements',
              severity: 'error'
            });
          }
        }
      }

      // Equipment completeness warnings
      if (!hasWeapon) {
        warnings.push({
          code: 'NO_WEAPON_EQUIPPED',
          message: 'No weapon equipped for combat',
          suggestion: 'Equip a weapon to improve combat effectiveness and damage output'
        });
      }

      if (!hasArmor) {
        warnings.push({
          code: 'NO_ARMOR_EQUIPPED',
          message: 'No armor equipped for combat',
          suggestion: 'Equip armor to reduce damage taken and improve survivability'
        });
      }

      if (brokenEquipmentCount > 0) {
        warnings.push({
          code: 'COMBAT_EFFECTIVENESS_REDUCED',
          message: `${brokenEquipmentCount} pieces of equipment are broken`,
          suggestion: 'Repair equipment before combat for optimal performance'
        });
      }
    } else {
      warnings.push({
        code: 'NO_COMBAT_EQUIPMENT',
        message: 'No combat equipment equipped',
        suggestion: 'Equip weapons and armor before engaging in combat for better survival chances'
      });
    }

    // Combat outcome analysis
    if (combatData.estimatedOutcome) {
      const outcome = combatData.estimatedOutcome;
      
      if (outcome.winProbability < 0.1) {
        errors.push({
          code: 'EXTREMELY_LOW_WIN_CHANCE',
          message: `Extremely low chance of victory (${Math.round(outcome.winProbability * 100)}%)`,
          field: 'combat.winProbability',
          severity: 'error'
        });
      } else if (outcome.winProbability < 0.3) {
        warnings.push({
          code: 'LOW_WIN_CHANCE',
          message: `Low chance of victory (${Math.round(outcome.winProbability * 100)}%)`,
          suggestion: 'Consider improving stats, equipment, or choosing a weaker enemy'
        });
      } else if (outcome.winProbability > 0.95) {
        warnings.push({
          code: 'GUARANTEED_VICTORY',
          message: `Very high chance of victory (${Math.round(outcome.winProbability * 100)}%)`,
          suggestion: 'Consider challenging stronger enemies for better rewards'
        });
      }

      if (outcome.riskLevel === 'extreme') {
        warnings.push({
          code: 'EXTREME_RISK',
          message: 'This combat has extreme risk level',
          suggestion: 'Ensure you are well-prepared and consider the consequences of failure'
        });
      } else if (outcome.riskLevel === 'high') {
        warnings.push({
          code: 'HIGH_RISK',
          message: 'This combat has high risk level',
          suggestion: 'Prepare carefully and consider backup plans'
        });
      }

      // Duration analysis
      if (outcome.estimatedDuration > 300) { // More than 5 minutes
        warnings.push({
          code: 'LONG_COMBAT_DURATION',
          message: `Estimated combat duration: ${Math.round(outcome.estimatedDuration / 60)} minutes`,
          suggestion: 'Long combats may be risky - ensure adequate preparation'
        });
      }
    }

    // Player health validation
    if (combatData.playerStats && combatData.playerStats.health < combatData.playerStats.maxHealth * 0.5) {
      warnings.push({
        code: 'LOW_PLAYER_HEALTH',
        message: `Player health is at ${Math.round((combatData.playerStats.health / combatData.playerStats.maxHealth) * 100)}%`,
        suggestion: 'Consider healing before engaging in combat'
      });
    }
  }

  /**
   * Enhanced prerequisite validation with comprehensive feedback
   */
  private static validatePrerequisitesComprehensive(
    prerequisites: TaskPrerequisite[],
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    if (!prerequisites || prerequisites.length === 0) {
      return;
    }

    let unmetPrerequisites = 0;
    let marginalPrerequisites = 0;

    for (const prerequisite of prerequisites) {
      const result = this.checkPrerequisiteDetailed(prerequisite, playerStats, playerLevel, playerInventory);
      
      if (!result.isMet) {
        unmetPrerequisites++;
        errors.push({
          code: 'PREREQUISITE_NOT_MET',
          message: result.message,
          field: `prerequisites.${prerequisite.type}`,
          severity: 'error'
        });
      } else if (result.warning) {
        marginalPrerequisites++;
        warnings.push({
          code: 'PREREQUISITE_WARNING',
          message: result.warning,
          suggestion: result.suggestion
        });
      }
    }

    if (unmetPrerequisites > 1) {
      warnings.push({
        code: 'MULTIPLE_UNMET_PREREQUISITES',
        message: `${unmetPrerequisites} prerequisites are not met`,
        suggestion: 'Address all prerequisite requirements before attempting this task'
      });
    }

    if (marginalPrerequisites > 0) {
      warnings.push({
        code: 'MARGINAL_PREREQUISITES',
        message: `${marginalPrerequisites} prerequisites are at minimum requirements`,
        suggestion: 'Consider improving stats/skills for better task performance'
      });
    }
  }

  /**
   * Enhanced resource requirement validation
   */
  private static validateResourceRequirementsComprehensive(
    requirements: ResourceRequirement[],
    playerInventory: { [itemId: string]: number },
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    if (!requirements || requirements.length === 0) {
      return;
    }

    let totalShortages = 0;
    let resourcesAtLimit = 0;
    let totalResourceValue = 0;

    for (const requirement of requirements) {
      const available = playerInventory[requirement.resourceId] || 0;
      const needed = requirement.quantityRequired;
      
      if (available < needed) {
        const shortage = needed - available;
        totalShortages++;
        errors.push({
          code: 'INSUFFICIENT_RESOURCES',
          message: `Need ${needed} ${requirement.resourceName}, have ${available} (short by ${shortage})`,
          field: `resources.${requirement.resourceId}`,
          severity: 'error'
        });
      } else if (available === needed) {
        resourcesAtLimit++;
        warnings.push({
          code: 'EXACT_RESOURCE_MATCH',
          message: `Using all available ${requirement.resourceName} (${available})`,
          suggestion: 'Consider gathering more resources to maintain a safety buffer'
        });
      } else if (available < needed * 1.2) {
        warnings.push({
          code: 'LOW_RESOURCE_BUFFER',
          message: `Low buffer for ${requirement.resourceName} (${available} available, ${needed} needed)`,
          suggestion: 'Gather additional resources to maintain a comfortable buffer'
        });
      }

      totalResourceValue += needed;
    }

    if (totalShortages > 1) {
      warnings.push({
        code: 'MULTIPLE_RESOURCE_SHORTAGES',
        message: `${totalShortages} different resources are insufficient`,
        suggestion: 'Gather all required resources before starting the task'
      });
    }

    if (resourcesAtLimit > 0) {
      warnings.push({
        code: 'RESOURCES_AT_LIMIT',
        message: `${resourcesAtLimit} resources will be completely consumed`,
        suggestion: 'Consider the impact on future tasks that may need these resources'
      });
    }
  }

  /**
   * Enhanced equipment requirement validation
   */
  private static validateEquipmentRequirementsComprehensive(
    task: Task,
    playerStats: CharacterStats,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    // This method provides comprehensive equipment validation across all task types
    switch (task.type) {
      case TaskType.HARVESTING:
        this.validateHarvestingEquipmentComprehensive(task, errors, warnings);
        break;
      case TaskType.CRAFTING:
        this.validateCraftingEquipmentComprehensive(task, errors, warnings);
        break;
      case TaskType.COMBAT:
        this.validateCombatEquipmentComprehensive(task, errors, warnings);
        break;
    }
  }

  /**
   * Comprehensive harvesting equipment validation
   */
  private static validateHarvestingEquipmentComprehensive(
    task: Task,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    const harvestingData = task.activityData as HarvestingTaskData;
    
    if (!harvestingData.tools || harvestingData.tools.length === 0) {
      warnings.push({
        code: 'NO_HARVESTING_TOOLS',
        message: 'No harvesting tools equipped',
        suggestion: 'Equip appropriate tools to improve efficiency, yield, and speed'
      });
      return;
    }

    let brokenTools = 0;
    let lowDurabilityTools = 0;
    let inappropriateTools = 0;
    let totalEfficiencyBonus = 0;

    for (const tool of harvestingData.tools) {
      if (tool.durability <= 0) {
        brokenTools++;
        errors.push({
          code: 'BROKEN_HARVESTING_TOOL',
          message: `Tool ${tool.name} is broken and cannot be used`,
          field: 'equipment.tools',
          severity: 'error'
        });
      } else if (tool.durability < tool.maxDurability * 0.1) {
        lowDurabilityTools++;
        warnings.push({
          code: 'CRITICAL_TOOL_DURABILITY',
          message: `Tool ${tool.name} has critical durability (${tool.durability}/${tool.maxDurability})`,
          suggestion: 'Repair immediately to avoid breaking during harvesting'
        });
      } else if (tool.durability < tool.maxDurability * 0.3) {
        warnings.push({
          code: 'LOW_TOOL_DURABILITY',
          message: `Tool ${tool.name} has low durability (${tool.durability}/${tool.maxDurability})`,
          suggestion: 'Consider repairing before starting long harvesting sessions'
        });
      }

      if (tool.type !== 'harvesting') {
        inappropriateTools++;
        warnings.push({
          code: 'INAPPROPRIATE_TOOL',
          message: `Tool ${tool.name} is not designed for harvesting`,
          suggestion: 'Use specialized harvesting tools for optimal results'
        });
      }

      // Calculate efficiency bonuses
      if (tool.bonuses) {
        for (const bonus of tool.bonuses) {
          if (bonus.type === 'efficiency' || bonus.type === 'speed') {
            totalEfficiencyBonus += bonus.value;
          }
        }
      }
    }

    if (brokenTools > 0) {
      warnings.push({
        code: 'HARVESTING_EFFICIENCY_SEVERELY_REDUCED',
        message: `${brokenTools} broken tools will severely impact harvesting`,
        suggestion: 'Repair all tools before starting for optimal performance'
      });
    }

    if (inappropriateTools > 0) {
      warnings.push({
        code: 'SUBOPTIMAL_TOOL_SELECTION',
        message: `${inappropriateTools} tools are not optimal for harvesting`,
        suggestion: 'Use specialized harvesting tools for better results'
      });
    }

    if (totalEfficiencyBonus < 0) {
      warnings.push({
        code: 'NEGATIVE_EFFICIENCY_BONUS',
        message: 'Current tools provide negative efficiency bonus',
        suggestion: 'Consider upgrading or repairing tools'
      });
    }
  }

  /**
   * Comprehensive crafting equipment validation
   */
  private static validateCraftingEquipmentComprehensive(
    task: Task,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    const craftingData = task.activityData as CraftingTaskData;
    
    if (craftingData.craftingStation) {
      const station = craftingData.craftingStation;
      
      // Validate station requirements
      let unmetRequirements = 0;
      for (const requirement of station.requirements) {
        if (!requirement.isMet) {
          unmetRequirements++;
          errors.push({
            code: 'CRAFTING_STATION_UNAVAILABLE',
            message: `Crafting station requirement not met: ${requirement.description}`,
            field: 'equipment.craftingStation',
            severity: 'error'
          });
        }
      }

      if (unmetRequirements > 1) {
        warnings.push({
          code: 'MULTIPLE_STATION_REQUIREMENTS_UNMET',
          message: `${unmetRequirements} crafting station requirements are not met`,
          suggestion: 'Address all station requirements before attempting to craft'
        });
      }

      // Analyze station bonuses
      if (station.bonuses && station.bonuses.length > 0) {
        let qualityBonus = 0;
        let speedBonus = 0;
        
        for (const bonus of station.bonuses) {
          if (bonus.type === 'quality') qualityBonus += bonus.value;
          if (bonus.type === 'speed') speedBonus += bonus.value;
        }

        if (qualityBonus > 0 || speedBonus > 0) {
          warnings.push({
            code: 'CRAFTING_STATION_BENEFITS',
            message: `Station provides ${qualityBonus > 0 ? `+${qualityBonus}% quality` : ''} ${speedBonus > 0 ? `+${speedBonus}% speed` : ''}`,
            suggestion: 'Crafting station will improve your results'
          });
        }
      }
    } else {
      const recipe = craftingData.recipe;
      if (recipe.requiredLevel > 3) {
        warnings.push({
          code: 'NO_CRAFTING_STATION',
          message: 'Advanced recipes benefit significantly from crafting stations',
          suggestion: 'Consider using a crafting station to improve quality, speed, and material efficiency'
        });
      }
    }
  }

  /**
   * Comprehensive combat equipment validation
   */
  private static validateCombatEquipmentComprehensive(
    task: Task,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    const combatData = task.activityData as CombatTaskData;
    
    if (!combatData.equipment || combatData.equipment.length === 0) {
      warnings.push({
        code: 'NO_COMBAT_EQUIPMENT',
        message: 'No combat equipment equipped',
        suggestion: 'Equip weapons and armor for significantly better combat performance and survival'
      });
      return;
    }

    let hasWeapon = false;
    let hasArmor = false;
    let hasAccessory = false;
    let brokenEquipment = 0;
    let criticalDurabilityEquipment = 0;
    let totalAttackBonus = 0;
    let totalDefenseBonus = 0;
    let unmetRequirements = 0;

    for (const equipment of combatData.equipment) {
      // Track equipment types
      if (equipment.type === 'weapon') {
        hasWeapon = true;
        totalAttackBonus += equipment.stats.attack || 0;
      }
      if (equipment.type === 'armor') {
        hasArmor = true;
        totalDefenseBonus += equipment.stats.defense || 0;
      }
      if (equipment.type === 'accessory') {
        hasAccessory = true;
      }

      // Check durability
      if (equipment.durability <= 0) {
        brokenEquipment++;
        errors.push({
          code: 'BROKEN_EQUIPMENT',
          message: `Equipment ${equipment.name} is broken and provides no benefits`,
          field: 'equipment.combat',
          severity: 'error'
        });
      } else if (equipment.durability < equipment.maxDurability * 0.1) {
        criticalDurabilityEquipment++;
        warnings.push({
          code: 'CRITICAL_EQUIPMENT_DURABILITY',
          message: `Equipment ${equipment.name} has critical durability (${equipment.durability}/${equipment.maxDurability})`,
          suggestion: 'Repair immediately to avoid breaking during combat'
        });
      } else if (equipment.durability < equipment.maxDurability * 0.25) {
        warnings.push({
          code: 'LOW_EQUIPMENT_DURABILITY',
          message: `Equipment ${equipment.name} has low durability (${equipment.durability}/${equipment.maxDurability})`,
          suggestion: 'Repair before combat to ensure it lasts through the battle'
        });
      }

      // Check equipment requirements
      for (const requirement of equipment.requirements) {
        if (!requirement.isMet) {
          unmetRequirements++;
          errors.push({
            code: 'EQUIPMENT_REQUIREMENT_NOT_MET',
            message: `Cannot use ${equipment.name}: ${requirement.description}`,
            field: 'equipment.requirements',
            severity: 'error'
          });
        }
      }
    }

    // Equipment completeness analysis
    if (!hasWeapon) {
      warnings.push({
        code: 'NO_WEAPON_EQUIPPED',
        message: 'No weapon equipped for combat',
        suggestion: 'Equip a weapon to significantly improve damage output and combat effectiveness'
      });
    }

    if (!hasArmor) {
      warnings.push({
        code: 'NO_ARMOR_EQUIPPED',
        message: 'No armor equipped for combat',
        suggestion: 'Equip armor to reduce incoming damage and improve survivability'
      });
    }

    if (!hasAccessory) {
      warnings.push({
        code: 'NO_ACCESSORIES_EQUIPPED',
        message: 'No accessories equipped',
        suggestion: 'Accessories can provide valuable stat bonuses and special effects'
      });
    }

    // Equipment condition analysis
    if (brokenEquipment > 0) {
      warnings.push({
        code: 'COMBAT_EFFECTIVENESS_SEVERELY_REDUCED',
        message: `${brokenEquipment} pieces of equipment are broken`,
        suggestion: 'Repair all equipment before combat for maximum effectiveness'
      });
    }

    if (criticalDurabilityEquipment > 0) {
      warnings.push({
        code: 'EQUIPMENT_LIKELY_TO_BREAK',
        message: `${criticalDurabilityEquipment} pieces of equipment may break during combat`,
        suggestion: 'Repair equipment to avoid losing bonuses mid-combat'
      });
    }

    if (unmetRequirements > 0) {
      warnings.push({
        code: 'EQUIPMENT_REQUIREMENTS_UNMET',
        message: `${unmetRequirements} equipment requirements are not met`,
        suggestion: 'Meet equipment requirements to gain their full benefits'
      });
    }

    // Combat effectiveness analysis
    if (totalAttackBonus === 0 && hasWeapon) {
      warnings.push({
        code: 'LOW_ATTACK_BONUS',
        message: 'Equipped weapons provide minimal attack bonus',
        suggestion: 'Consider upgrading weapons for better combat performance'
      });
    }

    if (totalDefenseBonus === 0 && hasArmor) {
      warnings.push({
        code: 'LOW_DEFENSE_BONUS',
        message: 'Equipped armor provides minimal defense bonus',
        suggestion: 'Consider upgrading armor for better protection'
      });
    }
  }

  /**
   * Validate task complexity and duration
   */
  private static validateTaskComplexity(
    task: Task,
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    // Duration vs complexity analysis
    const hasPrerequisites = task.prerequisites && task.prerequisites.length > 0;
    const hasResourceRequirements = task.resourceRequirements && task.resourceRequirements.length > 0;
    const complexityScore = (hasPrerequisites ? 1 : 0) + (hasResourceRequirements ? 1 : 0) + (task.priority > 7 ? 1 : 0);

    if (task.duration < 5000 && complexityScore > 2) { // Less than 5 seconds but complex
      warnings.push({
        code: 'COMPLEX_TASK_SHORT_DURATION',
        message: 'Complex task has very short duration',
        suggestion: 'Consider if task duration is appropriate for its complexity'
      });
    }

    if (task.duration > 3600000 && complexityScore === 0) { // More than 1 hour but simple
      warnings.push({
        code: 'SIMPLE_TASK_LONG_DURATION',
        message: 'Simple task has very long duration',
        suggestion: 'Consider breaking long simple tasks into smaller segments'
      });
    }

    // Retry logic validation
    if (task.maxRetries > 0 && task.type === TaskType.COMBAT) {
      warnings.push({
        code: 'COMBAT_TASK_WITH_RETRIES',
        message: 'Combat tasks with automatic retries may be risky',
        suggestion: 'Consider manual retry for combat to assess situation between attempts'
      });
    }

    // Priority vs duration analysis
    if (task.priority > 8 && task.duration > 1800000) { // High priority but long duration (30+ minutes)
      warnings.push({
        code: 'HIGH_PRIORITY_LONG_TASK',
        message: 'High priority task has long duration',
        suggestion: 'Consider if this task should block other activities for so long'
      });
    }
  }

  /**
   * Perform cross-validation checks between different task aspects
   */
  private static performCrossValidation(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    errors: TaskValidationError[],
    warnings: TaskValidationWarning[]
  ): void {
    // Cross-validate prerequisites vs resource requirements
    const levelPrereqs = task.prerequisites.filter(p => p.type === 'level');
    const itemPrereqs = task.prerequisites.filter(p => p.type === 'item');
    
    if (levelPrereqs.length > 0 && task.resourceRequirements.length === 0 && task.type !== TaskType.COMBAT) {
      warnings.push({
        code: 'LEVEL_REQUIREMENT_WITHOUT_RESOURCES',
        message: 'Task has level requirements but no resource requirements',
        suggestion: 'Verify if this task should consume resources'
      });
    }

    // Cross-validate item prerequisites vs resource requirements
    for (const itemPrereq of itemPrereqs) {
      const matchingResource = task.resourceRequirements.find(r => r.resourceId === itemPrereq.requirement);
      if (!matchingResource) {
        warnings.push({
          code: 'ITEM_PREREQUISITE_NOT_CONSUMED',
          message: `Item prerequisite ${itemPrereq.requirement} is not consumed by task`,
          suggestion: 'Verify if prerequisite items should be consumed or just required'
        });
      }
    }

    // Cross-validate task type vs duration
    const expectedDurations = {
      [TaskType.HARVESTING]: { min: 10000, max: 300000 }, // 10 seconds to 5 minutes
      [TaskType.CRAFTING]: { min: 30000, max: 1800000 },  // 30 seconds to 30 minutes
      [TaskType.COMBAT]: { min: 5000, max: 600000 }       // 5 seconds to 10 minutes
    };

    const expected = expectedDurations[task.type];
    if (expected) {
      if (task.duration < expected.min) {
        warnings.push({
          code: 'UNUSUALLY_SHORT_DURATION',
          message: `${task.type} task duration (${Math.round(task.duration / 1000)}s) is unusually short`,
          suggestion: 'Verify if duration is appropriate for this task type'
        });
      } else if (task.duration > expected.max) {
        warnings.push({
          code: 'UNUSUALLY_LONG_DURATION',
          message: `${task.type} task duration (${Math.round(task.duration / 1000 / 60)}m) is unusually long`,
          suggestion: 'Consider breaking long tasks into smaller segments'
        });
      }
    }

    // Cross-validate player level vs task complexity
    const totalPrerequisites = task.prerequisites.length;
    const totalResources = task.resourceRequirements.length;
    const taskComplexity = totalPrerequisites + totalResources;

    if (playerLevel < 5 && taskComplexity > 3) {
      warnings.push({
        code: 'COMPLEX_TASK_FOR_LOW_LEVEL',
        message: 'Complex task for low-level player',
        suggestion: 'Consider if this task is appropriate for player level'
      });
    }

    if (playerLevel > 50 && taskComplexity === 0) {
      warnings.push({
        code: 'SIMPLE_TASK_FOR_HIGH_LEVEL',
        message: 'Very simple task for high-level player',
        suggestion: 'Consider if this task provides appropriate challenge and rewards'
      });
    }
  }

  /**
   * Validate task queue constraints
   */
  static validateTaskQueue(
    tasks: Task[],
    maxQueueSize: number,
    maxTotalDuration: number
  ): TaskValidationResult {
    const errors: TaskValidationError[] = [];
    const warnings: TaskValidationWarning[] = [];

    // Check queue size
    if (tasks.length > maxQueueSize) {
      errors.push({
        code: 'QUEUE_SIZE_EXCEEDED',
        message: `Queue size ${tasks.length} exceeds maximum ${maxQueueSize}`,
        severity: 'error'
      });
    }

    // Check total duration
    const totalDuration = tasks.reduce((sum, task) => sum + task.duration, 0);
    if (totalDuration > maxTotalDuration) {
      warnings.push({
        code: 'LONG_QUEUE_DURATION',
        message: `Total queue duration ${Math.round(totalDuration / 1000 / 60)} minutes exceeds recommended maximum`,
        suggestion: 'Consider breaking up long task sequences'
      });
    }

    // Check for duplicate tasks
    const taskIds = new Set<string>();
    for (const task of tasks) {
      if (taskIds.has(task.id)) {
        errors.push({
          code: 'DUPLICATE_TASK_ID',
          message: `Duplicate task ID found: ${task.id}`,
          severity: 'error'
        });
      }
      taskIds.add(task.id);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Batch validate multiple tasks with performance optimization
   */
  static validateTaskBatch(
    tasks: Task[],
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: TaskValidationOptions = {}
  ): { [taskId: string]: TaskValidationResult } {
    const results: { [taskId: string]: TaskValidationResult } = {};
    
    // Pre-calculate common values to avoid repeated computation
    const playerStatCache = {
      strength: playerStats.strength,
      dexterity: playerStats.dexterity,
      intelligence: playerStats.intelligence,
      vitality: playerStats.vitality
    };

    const skillCache = {
      clockmaking: playerStats.craftingSkills.clockmaking,
      engineering: playerStats.craftingSkills.engineering,
      alchemy: playerStats.craftingSkills.alchemy,
      steamcraft: playerStats.craftingSkills.steamcraft,
      mining: playerStats.harvestingSkills.mining,
      foraging: playerStats.harvestingSkills.foraging,
      salvaging: playerStats.harvestingSkills.salvaging,
      crystal_extraction: playerStats.harvestingSkills.crystal_extraction
    };

    for (const task of tasks) {
      try {
        results[task.id] = this.validateTaskComprehensive(task, playerStats, playerLevel, playerInventory, options);
      } catch (error) {
        results[task.id] = {
          isValid: false,
          errors: [{
            code: 'VALIDATION_EXCEPTION',
            message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          }],
          warnings: []
        };
      }
    }

    return results;
  }

  /**
   * Validate task with context-aware error messages
   */
  static validateTaskWithContext(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    context: {
      playerName?: string;
      sessionId?: string;
      gameMode?: 'normal' | 'hardcore' | 'creative';
      difficulty?: 'easy' | 'normal' | 'hard';
    },
    options: TaskValidationOptions = {}
  ): TaskValidationResult {
    // Adjust validation based on context
    const contextualOptions = { ...options };
    
    if (context.gameMode === 'creative') {
      contextualOptions.bypassValidation = true;
      contextualOptions.bypassReason = ValidationBypassReason.DEBUG;
    }
    
    if (context.difficulty === 'easy') {
      contextualOptions.skipResourceCheck = true;
    }

    const result = this.validateTaskComprehensive(task, playerStats, playerLevel, playerInventory, contextualOptions);

    // Add contextual information to messages
    if (context.playerName) {
      result.errors = result.errors.map(error => ({
        ...error,
        message: `[${context.playerName}] ${error.message}`
      }));
      
      result.warnings = result.warnings.map(warning => ({
        ...warning,
        message: `[${context.playerName}] ${warning.message}`
      }));
    }

    return result;
  }

  /**
   * Create validation summary for multiple tasks
   */
  static createValidationSummary(
    validationResults: { [taskId: string]: TaskValidationResult }
  ): {
    totalTasks: number;
    validTasks: number;
    invalidTasks: number;
    totalErrors: number;
    totalWarnings: number;
    commonIssues: { [code: string]: number };
    recommendations: string[];
  } {
    const taskIds = Object.keys(validationResults);
    const totalTasks = taskIds.length;
    let validTasks = 0;
    let invalidTasks = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    const commonIssues: { [code: string]: number } = {};
    const recommendations: string[] = [];

    for (const taskId of taskIds) {
      const result = validationResults[taskId];
      
      if (result.isValid) {
        validTasks++;
      } else {
        invalidTasks++;
      }

      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;

      // Track common issues
      for (const error of result.errors) {
        commonIssues[error.code] = (commonIssues[error.code] || 0) + 1;
      }
      
      for (const warning of result.warnings) {
        commonIssues[warning.code] = (commonIssues[warning.code] || 0) + 1;
      }
    }

    // Generate recommendations based on common issues
    if (commonIssues['INSUFFICIENT_LEVEL'] > 0) {
      recommendations.push('Consider gaining more levels before attempting these tasks');
    }
    
    if (commonIssues['INSUFFICIENT_MATERIALS'] > 0) {
      recommendations.push('Gather required materials before starting crafting tasks');
    }
    
    if (commonIssues['BROKEN_EQUIPMENT'] > 0) {
      recommendations.push('Repair broken equipment before starting tasks');
    }
    
    if (commonIssues['NO_COMBAT_EQUIPMENT'] > 0) {
      recommendations.push('Equip weapons and armor before engaging in combat');
    }

    if (invalidTasks > validTasks) {
      recommendations.push('Address validation issues before proceeding with task queue');
    }

    return {
      totalTasks,
      validTasks,
      invalidTasks,
      totalErrors,
      totalWarnings,
      commonIssues,
      recommendations
    };
  }

  /**
   * Enhanced validation bypass mechanisms for testing and admin functions
   */
  static createEmergencyBypassOptions(reason: string): TaskValidationOptions {
    return {
      bypassValidation: true,
      bypassReason: ValidationBypassReason.EMERGENCY,
      adminOverride: true,
      skipResourceCheck: true,
      skipPrerequisiteCheck: true,
      skipEquipmentCheck: true,
      allowInvalidTasks: true
    };
  }

  static createMaintenanceBypassOptions(): TaskValidationOptions {
    return {
      bypassValidation: true,
      bypassReason: ValidationBypassReason.MAINTENANCE,
      adminOverride: true,
      skipResourceCheck: true,
      skipPrerequisiteCheck: true,
      skipEquipmentCheck: true,
      allowInvalidTasks: true
    };
  }

  /**
   * Validate with progressive strictness levels
   */
  static validateTaskProgressive(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    strictnessLevel: 'lenient' | 'normal' | 'strict' = 'normal'
  ): TaskValidationResult {
    const options: TaskValidationOptions = {};

    switch (strictnessLevel) {
      case 'lenient':
        options.skipResourceCheck = false;
        options.skipPrerequisiteCheck = false;
        options.skipEquipmentCheck = true; // Skip equipment checks in lenient mode
        options.allowInvalidTasks = false;
        break;
      
      case 'normal':
        // Use default validation
        break;
      
      case 'strict':
        // All validations enabled, no bypasses
        options.skipResourceCheck = false;
        options.skipPrerequisiteCheck = false;
        options.skipEquipmentCheck = false;
        options.allowInvalidTasks = false;
        break;
    }

    return this.validateTaskComprehensive(task, playerStats, playerLevel, playerInventory, options);
  }

  /**
   * Performance monitoring for validation operations
   */
  static validateTaskWithPerformanceMonitoring(
    task: Task,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: TaskValidationOptions = {}
  ): TaskValidationResult & { performanceMetrics: { duration: number; memoryUsed?: number } } {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize;

    const result = this.validateTaskComprehensive(task, playerStats, playerLevel, playerInventory, options);

    const endTime = performance.now();
    const endMemory = (performance as any).memory?.usedJSHeapSize;

    const performanceMetrics = {
      duration: endTime - startTime,
      memoryUsed: startMemory && endMemory ? endMemory - startMemory : undefined
    };

    return {
      ...result,
      performanceMetrics
    };
  }

  /**
   * Export validation configuration for external systems
   */
  static exportValidationConfig(): {
    supportedTaskTypes: TaskType[];
    validationRules: { [key: string]: any };
    bypassReasons: ValidationBypassReason[];
    errorCodes: string[];
    warningCodes: string[];
  } {
    return {
      supportedTaskTypes: [TaskType.HARVESTING, TaskType.CRAFTING, TaskType.COMBAT],
      validationRules: {
        maxTaskDuration: 24 * 60 * 60 * 1000, // 24 hours
        maxQueueSize: 50,
        maxRetries: 10,
        priorityRange: [0, 10],
        progressRange: [0, 1]
      },
      bypassReasons: Object.values(ValidationBypassReason),
      errorCodes: [
        'INVALID_TASK_ID', 'INVALID_PLAYER_ID', 'INVALID_DURATION', 'EXCESSIVE_DURATION',
        'INVALID_PRIORITY', 'INVALID_MAX_RETRIES', 'INVALID_PROGRESS',
        'MISSING_HARVESTING_DATA', 'MISSING_CRAFTING_DATA', 'MISSING_COMBAT_DATA',
        'INSUFFICIENT_LEVEL', 'INSUFFICIENT_STAT', 'INSUFFICIENT_SKILL',
        'INSUFFICIENT_MATERIALS', 'INSUFFICIENT_RESOURCES',
        'BROKEN_HARVESTING_TOOL', 'BROKEN_EQUIPMENT', 'BROKEN_CRAFTING_STATION',
        'ENEMY_TOO_STRONG', 'EXTREMELY_LOW_WIN_CHANCE',
        'PREREQUISITE_NOT_MET', 'EQUIPMENT_REQUIREMENT_NOT_MET',
        'QUEUE_SIZE_EXCEEDED', 'DUPLICATE_TASK_ID',
        'VALIDATION_ERROR', 'VALIDATION_EXCEPTION'
      ],
      warningCodes: [
        'LONG_TASK_ID', 'HIGH_MAX_RETRIES', 'MISSING_TASK_NAME', 'MISSING_TASK_DESCRIPTION',
        'MINIMUM_LEVEL_REQUIREMENT', 'MINIMUM_STAT_REQUIREMENT', 'MINIMUM_SKILL_REQUIREMENT',
        'HIGH_ENERGY_COST', 'LOW_TOOL_DURABILITY', 'NO_HARVESTING_TOOLS',
        'CHALLENGING_ENEMY', 'ENEMY_TOO_WEAK', 'LOW_WIN_CHANCE', 'HIGH_RISK', 'EXTREME_RISK',
        'NO_WEAPON_EQUIPPED', 'NO_ARMOR_EQUIPPED', 'NO_COMBAT_EQUIPMENT',
        'LONG_CRAFTING_TIME', 'NO_CRAFTING_STATION', 'REDUCED_QUALITY_EXPECTED',
        'EXACT_RESOURCE_MATCH', 'LOW_RESOURCE_BUFFER', 'EXACT_MATERIAL_MATCH',
        'PREREQUISITE_WARNING', 'VALIDATION_BYPASSED',
        'LONG_QUEUE_DURATION', 'COMPLEX_TASK_SHORT_DURATION', 'SIMPLE_TASK_LONG_DURATION'
      ]
    };
  }
}