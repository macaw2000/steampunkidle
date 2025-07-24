/**
 * Crafting Task Integration Service
 * Connects the crafting system to the unified task queue
 */

import { serverTaskQueueService } from './serverTaskQueueService';
import { CraftingRecipe, CraftingWorkstation } from '../types/crafting';
import { CharacterStats } from '../types/character';
import { CraftingStation } from '../types/taskQueue';
import { CRAFTING_RECIPES, CRAFTING_WORKSTATIONS } from '../data/craftingRecipes';
import { TaskUtils } from '../utils/taskUtils';

export class CraftingTaskIntegration {
  /**
   * Start a crafting recipe immediately
   */
  static async startCraftingTask(
    playerId: string,
    recipeId: string,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: {
      quantity?: number;
      craftingStationId?: string;
    } = {}
  ): Promise<void> {
    // Find the recipe
    const recipe = CRAFTING_RECIPES.find(r => r.recipeId === recipeId);
    if (!recipe) {
      throw new Error(`Crafting recipe not found: ${recipeId}`);
    }
    
    // Check if player meets level requirement
    if (playerLevel < recipe.requiredLevel) {
      throw new Error(`Player level ${playerLevel} is below required level ${recipe.requiredLevel}`);
    }
    
    // Check if player meets skill requirement
    const skillLevel = TaskUtils.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
    if (skillLevel < recipe.requiredLevel) {
      throw new Error(`${recipe.requiredSkill} skill level ${skillLevel} is below required ${recipe.requiredLevel}`);
    }
    
    // Check material requirements
    for (const material of recipe.materials) {
      const available = playerInventory[material.materialId] || 0;
      if (available < material.quantity * (options.quantity || 1)) {
        throw new Error(`Insufficient materials: need ${material.quantity * (options.quantity || 1)} ${material.name}, have ${available}`);
      }
    }
    
    // Get crafting station if specified
    let craftingStation: CraftingStation | undefined;
    if (options.craftingStationId) {
      const station = CRAFTING_WORKSTATIONS.find(s => s.workstationId === options.craftingStationId);
      if (station) {
        craftingStation = this.convertToCraftingStation(station, playerStats);
      }
    }
    
    // Start the crafting task
    await serverTaskQueueService.startCraftingTask(
      playerId,
      recipe,
      playerStats,
      playerLevel,
      playerInventory,
      {
        craftingStation,
        quantity: options.quantity || 1
      }
    );
  }
  
  /**
   * Queue a crafting recipe
   */
  static async queueCraftingTask(
    playerId: string,
    recipeId: string,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    options: {
      quantity?: number;
      craftingStationId?: string;
      priority?: number;
    } = {}
  ): Promise<void> {
    // Find the recipe
    const recipe = CRAFTING_RECIPES.find(r => r.recipeId === recipeId);
    if (!recipe) {
      throw new Error(`Crafting recipe not found: ${recipeId}`);
    }
    
    // Check if player meets level requirement
    if (playerLevel < recipe.requiredLevel) {
      throw new Error(`Player level ${playerLevel} is below required level ${recipe.requiredLevel}`);
    }
    
    // Check if player meets skill requirement
    const skillLevel = TaskUtils.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
    if (skillLevel < recipe.requiredLevel) {
      throw new Error(`${recipe.requiredSkill} skill level ${skillLevel} is below required ${recipe.requiredLevel}`);
    }
    
    // Check material requirements
    for (const material of recipe.materials) {
      const available = playerInventory[material.materialId] || 0;
      if (available < material.quantity * (options.quantity || 1)) {
        throw new Error(`Insufficient materials: need ${material.quantity * (options.quantity || 1)} ${material.name}, have ${available}`);
      }
    }
    
    // Get crafting station if specified
    let craftingStation: CraftingStation | undefined;
    if (options.craftingStationId) {
      const station = CRAFTING_WORKSTATIONS.find(s => s.workstationId === options.craftingStationId);
      if (station) {
        craftingStation = this.convertToCraftingStation(station, playerStats);
      }
    }
    
    // Queue the crafting task
    await serverTaskQueueService.queueCraftingTask(
      playerId,
      recipe,
      playerStats,
      playerLevel,
      playerInventory,
      {
        craftingStation,
        quantity: options.quantity || 1,
        priority: options.priority
      }
    );
  }
  
  /**
   * Get available crafting recipes for player
   */
  static getAvailableRecipes(
    playerLevel: number,
    playerStats: CharacterStats
  ): CraftingRecipe[] {
    return CRAFTING_RECIPES.filter(recipe => {
      // Check level requirement
      if (playerLevel < recipe.requiredLevel) {
        return false;
      }
      
      // Check skill requirement
      const skillLevel = TaskUtils.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
      if (skillLevel < recipe.requiredLevel) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Get available crafting stations for player
   */
  static getAvailableCraftingStations(
    playerLevel: number,
    playerStats: CharacterStats
  ): CraftingStation[] {
    return CRAFTING_WORKSTATIONS
      .filter(station => {
        // Check skill requirements
        for (const req of station.requiredSkills) {
          const skillLevel = TaskUtils.getCraftingSkillLevel(playerStats, req.skill);
          if (skillLevel < req.level) {
            return false;
          }
        }
        
        return true;
      })
      .map(station => this.convertToCraftingStation(station, playerStats));
  }
  
  /**
   * Convert workstation to crafting station format
   */
  private static convertToCraftingStation(
    workstation: CraftingWorkstation,
    playerStats: CharacterStats
  ): CraftingStation {
    // Convert workstation requirements to task prerequisites
    const requirements = workstation.requiredSkills.map(req => ({
      type: 'skill' as const,
      requirement: req.skill,
      value: req.level,
      description: `${req.skill} skill level ${req.level}`,
      isMet: TaskUtils.getCraftingSkillLevel(playerStats, req.skill) >= req.level
    }));
    
    // Convert workstation bonuses
    const bonuses = workstation.bonuses.map(bonus => ({
      type: bonus.type,
      value: bonus.value,
      description: bonus.description
    }));
    
    return {
      stationId: workstation.workstationId,
      name: workstation.name,
      type: workstation.type,
      bonuses,
      requirements
    };
  }
}

// Export singleton instance
export const craftingTaskIntegration = new CraftingTaskIntegration();
