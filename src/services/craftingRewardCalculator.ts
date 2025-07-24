/**
 * Crafting Reward Calculator Service
 * Calculates rewards for crafting tasks based on player stats and recipe
 */

import { CraftingRecipe, CraftingOutput } from '../types/crafting';
import { CharacterStats } from '../types/character';
import { TaskReward, CraftingTaskData, CraftingStation } from '../types/taskQueue';
import { TaskUtils } from '../utils/taskUtils';

export class CraftingRewardCalculator {
  /**
   * Calculate crafting rewards based on recipe, player stats, and quality
   */
  static calculateCraftingRewards(
    recipe: CraftingRecipe,
    playerStats: CharacterStats,
    craftingStation?: CraftingStation,
    quantity: number = 1
  ): TaskReward[] {
    const rewards: TaskReward[] = [];
    
    // Calculate quality modifier based on skill level
    const skillLevel = TaskUtils.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
    const baseQualityModifier = this.calculateQualityModifier(skillLevel, recipe.requiredLevel);
    
    // Apply crafting station bonuses if available
    let finalQualityModifier = baseQualityModifier;
    if (craftingStation) {
      const qualityBonus = craftingStation.bonuses
        .filter(bonus => bonus.type === 'quality')
        .reduce((total, bonus) => total + (bonus.value / 100), 0);
      
      finalQualityModifier += qualityBonus;
    }
    
    // Clamp quality modifier between 0.5 and 1.5
    finalQualityModifier = Math.max(0.5, Math.min(1.5, finalQualityModifier));
    
    // Calculate success chance based on skill level
    const successChance = this.calculateSuccessChance(skillLevel, recipe.requiredLevel);
    
    // Determine if crafting was successful
    const isSuccessful = Math.random() <= successChance;
    
    if (isSuccessful) {
      // Add crafted items to rewards
      for (const output of recipe.outputs) {
        // Apply quality modifier to quantity for some recipes
        const outputQuantity = Math.floor(output.quantity * quantity);
        
        rewards.push({
          type: 'item',
          itemId: output.itemId,
          quantity: outputQuantity,
          rarity: this.determineItemRarity(finalQualityModifier)
        });
      }
      
      // Add experience reward
      const experienceGain = Math.floor(recipe.experienceGain * quantity * finalQualityModifier);
      rewards.push({
        type: 'experience',
        quantity: experienceGain
      });
    } else {
      // Failed crafting - return some materials and reduced experience
      rewards.push({
        type: 'experience',
        quantity: Math.floor(recipe.experienceGain * 0.25) // 25% of normal experience for failed attempts
      });
      
      // Return some random materials (30-70% of materials)
      for (const material of recipe.materials) {
        if (Math.random() < 0.5) { // 50% chance to get some materials back
          const returnAmount = Math.floor(material.quantity * (0.3 + Math.random() * 0.4));
          if (returnAmount > 0) {
            rewards.push({
              type: 'resource',
              itemId: material.materialId,
              quantity: returnAmount,
              rarity: 'common'
            });
          }
        }
      }
    }
    
    return rewards;
  }
  
  /**
   * Calculate quality modifier based on skill level
   */
  static calculateQualityModifier(skillLevel: number, requiredLevel: number): number {
    // Base quality is 0.8 to 1.2 based on skill level
    const skillDifference = skillLevel - requiredLevel;
    
    // Each level above requirement adds 0.05 to quality, up to +0.3
    const skillBonus = Math.min(0.3, Math.max(0, skillDifference * 0.05));
    
    // Base quality is 0.9 + skill bonus
    return 0.9 + skillBonus;
  }
  
  /**
   * Calculate success chance based on skill level
   */
  static calculateSuccessChance(skillLevel: number, requiredLevel: number): number {
    // Base success chance is 70%
    const baseChance = 0.7;
    
    // Each level above requirement adds 5% success chance, up to 95%
    const skillDifference = skillLevel - requiredLevel;
    const skillBonus = Math.min(0.25, Math.max(0, skillDifference * 0.05));
    
    // Each level below requirement reduces success chance by 15%
    const skillPenalty = skillDifference < 0 ? skillDifference * 0.15 : 0;
    
    // Calculate final success chance, minimum 10%
    return Math.min(0.95, Math.max(0.1, baseChance + skillBonus + skillPenalty));
  }
  
  /**
   * Determine item rarity based on quality modifier
   */
  static determineItemRarity(qualityModifier: number): string {
    if (qualityModifier >= 1.4) return 'legendary';
    if (qualityModifier >= 1.2) return 'rare';
    if (qualityModifier >= 1.0) return 'uncommon';
    return 'common';
  }
  
  /**
   * Calculate crafting duration based on recipe, skill level, and station
   */
  static calculateCraftingDuration(
    recipe: CraftingRecipe,
    playerStats: CharacterStats,
    craftingStation?: CraftingStation,
    quantity: number = 1
  ): number {
    // Base duration from recipe (in seconds)
    let duration = recipe.craftingTime * quantity;
    
    // Skill level affects crafting speed
    const skillLevel = TaskUtils.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
    const skillDifference = skillLevel - recipe.requiredLevel;
    
    // Each level above requirement reduces time by 2%, up to 30%
    const skillBonus = Math.min(0.3, Math.max(0, skillDifference * 0.02));
    
    // Apply skill bonus
    duration *= (1 - skillBonus);
    
    // Apply crafting station speed bonus if available
    if (craftingStation) {
      const speedBonus = craftingStation.bonuses
        .filter(bonus => bonus.type === 'speed')
        .reduce((total, bonus) => total + (bonus.value / 100), 0);
      
      duration *= (1 - speedBonus);
    }
    
    // Convert to milliseconds and ensure minimum duration
    return Math.max(1000, duration * 1000);
  }
  
  /**
   * Create crafting task data for a recipe
   */
  static createCraftingTaskData(
    recipe: CraftingRecipe,
    playerStats: CharacterStats,
    playerInventory: { [itemId: string]: number },
    craftingStation?: CraftingStation,
    quantity: number = 1
  ): CraftingTaskData {
    // Get skill level
    const playerSkillLevel = TaskUtils.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
    
    // Calculate quality modifier
    let qualityModifier = this.calculateQualityModifier(playerSkillLevel, recipe.requiredLevel);
    
    // Apply crafting station quality bonus if available
    if (craftingStation) {
      const qualityBonus = craftingStation.bonuses
        .filter(bonus => bonus.type === 'quality')
        .reduce((total, bonus) => total + (bonus.value / 100), 0);
      
      qualityModifier += qualityBonus;
    }
    
    // Clamp quality modifier
    qualityModifier = Math.max(0.5, Math.min(1.5, qualityModifier));
    
    // Calculate expected outputs with quality modifier
    const expectedOutputs = recipe.outputs.map(output => ({
      ...output,
      quantity: output.quantity * quantity,
      qualityModifier
    }));
    
    return {
      recipe,
      materials: recipe.materials.map(material => ({
        ...material,
        quantity: material.quantity * quantity
      })),
      craftingStation,
      playerSkillLevel,
      qualityModifier,
      expectedOutputs
    };
  }
}

// Export singleton instance
export const craftingRewardCalculator = new CraftingRewardCalculator();