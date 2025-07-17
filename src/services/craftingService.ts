/**
 * Crafting service for managing crafting operations and skill progression
 */

import { 
  CraftingRecipe, 
  CraftingSession, 
  CraftingQueue, 
  CraftingSkillTree, 
  CraftingWorkstation,
  StartCraftingRequest,
  StartCraftingResponse,
  CompleteCraftingRequest,
  CompleteCraftingResponse,
  GetCraftingDataRequest,
  GetCraftingDataResponse,
  CraftingSkillType,
  CraftingSpecialization
} from '../types/crafting';
import { Character } from '../types/character';
import { CRAFTING_RECIPES, CRAFTING_WORKSTATIONS } from '../data/craftingRecipes';

export class CraftingService {
  /**
   * Calculate crafting skill level based on experience
   */
  static calculateSkillLevel(experience: number): number {
    // Similar to character level but with different scaling for crafting
    return Math.floor(Math.sqrt(experience / 75)) + 1;
  }

  /**
   * Calculate experience required for a specific skill level
   */
  static calculateExperienceForSkillLevel(level: number): number {
    return Math.pow(level - 1, 2) * 75;
  }

  /**
   * Calculate quality modifier based on skill level and recipe requirements
   */
  static calculateQualityModifier(skillLevel: number, requiredLevel: number, workstationBonus: number = 0): number {
    const skillAdvantage = Math.max(0, skillLevel - requiredLevel);
    const baseQuality = 0.8 + (skillAdvantage * 0.05); // 0.8 to 1.2+ range
    const workstationMultiplier = 1 + (workstationBonus / 100);
    
    return Math.min(1.5, Math.max(0.8, baseQuality * workstationMultiplier));
  }

  /**
   * Calculate crafting time with bonuses
   */
  static calculateCraftingTime(baseTime: number, skillLevel: number, speedBonus: number = 0): number {
    const skillSpeedBonus = Math.min(0.5, skillLevel * 0.02); // Max 50% speed bonus from skill
    const totalSpeedBonus = skillSpeedBonus + (speedBonus / 100);
    
    return Math.max(5, Math.floor(baseTime * (1 - totalSpeedBonus))); // Minimum 5 seconds
  }

  /**
   * Check if player has required materials for crafting
   */
  static checkMaterialRequirements(recipe: CraftingRecipe, playerMaterials: { [materialId: string]: number }): {
    hasAllMaterials: boolean;
    missingMaterials: string[];
  } {
    const missingMaterials: string[] = [];
    
    for (const material of recipe.materials) {
      const playerQuantity = playerMaterials[material.materialId] || 0;
      if (playerQuantity < material.quantity) {
        missingMaterials.push(`${material.name} (need ${material.quantity}, have ${playerQuantity})`);
      }
    }
    
    return {
      hasAllMaterials: missingMaterials.length === 0,
      missingMaterials
    };
  }

  /**
   * Get available recipes for a character based on their skill levels
   */
  static getAvailableRecipes(character: Character): CraftingRecipe[] {
    const availableRecipes: CraftingRecipe[] = [];
    
    for (const recipe of CRAFTING_RECIPES) {
      const skillSet = character.stats.craftingSkills;
      const skillLevel = skillSet[recipe.requiredSkill];
      
      if (skillLevel >= recipe.requiredLevel) {
        availableRecipes.push(recipe);
      }
    }
    
    return availableRecipes;
  }

  /**
   * Get unlocked workstations for a character
   */
  static getUnlockedWorkstations(character: Character): CraftingWorkstation[] {
    const unlockedWorkstations: CraftingWorkstation[] = [];
    
    for (const workstation of CRAFTING_WORKSTATIONS) {
      let canUnlock = true;
      
      for (const requirement of workstation.requiredSkills) {
        const skillLevel = character.stats.craftingSkills[requirement.skill];
        if (skillLevel < requirement.level) {
          canUnlock = false;
          break;
        }
      }
      
      if (canUnlock) {
        unlockedWorkstations.push(workstation);
      }
    }
    
    return unlockedWorkstations;
  }

  /**
   * Start a crafting session
   */
  static async startCrafting(request: StartCraftingRequest): Promise<StartCraftingResponse> {
    try {
      const response = await fetch('/api/crafting/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start crafting');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error starting crafting:', error);
      throw error;
    }
  }

  /**
   * Complete a crafting session
   */
  static async completeCrafting(request: CompleteCraftingRequest): Promise<CompleteCraftingResponse> {
    try {
      const response = await fetch('/api/crafting/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete crafting');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error completing crafting:', error);
      throw error;
    }
  }

  /**
   * Get all crafting data for a user
   */
  static async getCraftingData(request: GetCraftingDataRequest): Promise<GetCraftingDataResponse> {
    try {
      const response = await fetch(`/api/crafting/${request.userId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get crafting data');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting crafting data:', error);
      throw error;
    }
  }

  /**
   * Calculate skill progression and unlocks
   */
  static calculateSkillProgression(
    currentSkillTree: CraftingSkillTree, 
    experienceGain: number
  ): {
    newSkillTree: CraftingSkillTree;
    leveledUp: boolean;
    newRecipesUnlocked: CraftingRecipe[];
  } {
    const newExperience = currentSkillTree.experience + experienceGain;
    const newLevel = this.calculateSkillLevel(newExperience);
    const leveledUp = newLevel > currentSkillTree.level;
    
    let newRecipesUnlocked: CraftingRecipe[] = [];
    let updatedUnlockedRecipes = [...currentSkillTree.unlockedRecipes];
    
    if (leveledUp) {
      // Check for newly unlocked recipes
      const availableRecipes = CRAFTING_RECIPES.filter(
        recipe => recipe.requiredSkill === currentSkillTree.skillType &&
                  recipe.requiredLevel <= newLevel &&
                  !currentSkillTree.unlockedRecipes.includes(recipe.recipeId)
      );
      
      newRecipesUnlocked = availableRecipes;
      updatedUnlockedRecipes = [
        ...currentSkillTree.unlockedRecipes,
        ...availableRecipes.map(recipe => recipe.recipeId)
      ];
    }
    
    const newSkillTree: CraftingSkillTree = {
      ...currentSkillTree,
      level: newLevel,
      experience: newExperience,
      unlockedRecipes: updatedUnlockedRecipes
    };
    
    return {
      newSkillTree,
      leveledUp,
      newRecipesUnlocked
    };
  }

  /**
   * Get crafting specializations for a skill
   */
  static getCraftingSpecializations(skillType: CraftingSkillType, skillLevel: number): CraftingSpecialization[] {
    const specializations: { [key in CraftingSkillType]: CraftingSpecialization[] } = {
      clockmaking: [
        {
          specializationId: 'precision-clockwork',
          name: 'Precision Clockwork',
          description: 'Master of intricate mechanisms and precise timing',
          requiredLevel: 5,
          bonuses: [
            { type: 'quality', value: 15, description: '+15% quality for clockwork items' },
            { type: 'experience', value: 10, description: '+10% experience from clockmaking' }
          ],
          isUnlocked: skillLevel >= 5
        },
        {
          specializationId: 'automaton-creator',
          name: 'Automaton Creator',
          description: 'Specializes in creating mechanical servants and companions',
          requiredLevel: 12,
          bonuses: [
            { type: 'material_efficiency', value: 20, description: '20% chance to save materials on automaton recipes' },
            { type: 'speed', value: 25, description: '+25% speed for automaton crafting' }
          ],
          isUnlocked: skillLevel >= 12
        }
      ],
      engineering: [
        {
          specializationId: 'steam-engineer',
          name: 'Steam Engineer',
          description: 'Expert in steam-powered machinery and pressure systems',
          requiredLevel: 6,
          bonuses: [
            { type: 'quality', value: 12, description: '+12% quality for steam-powered items' },
            { type: 'speed', value: 20, description: '+20% speed for engineering recipes' }
          ],
          isUnlocked: skillLevel >= 6
        },
        {
          specializationId: 'weapon-smith',
          name: 'Weapon Smith',
          description: 'Master of crafting steam-powered weapons and armor',
          requiredLevel: 10,
          bonuses: [
            { type: 'quality', value: 20, description: '+20% quality for weapons and armor' },
            { type: 'material_efficiency', value: 15, description: '15% chance to save materials on weapons' }
          ],
          isUnlocked: skillLevel >= 10
        }
      ],
      alchemy: [
        {
          specializationId: 'steam-alchemist',
          name: 'Steam Alchemist',
          description: 'Combines traditional alchemy with steam-powered processes',
          requiredLevel: 4,
          bonuses: [
            { type: 'material_efficiency', value: 25, description: '25% chance to save materials in alchemy' },
            { type: 'experience', value: 15, description: '+15% experience from alchemy' }
          ],
          isUnlocked: skillLevel >= 4
        },
        {
          specializationId: 'enhancement-master',
          name: 'Enhancement Master',
          description: 'Creates powerful enhancement serums and elixirs',
          requiredLevel: 15,
          bonuses: [
            { type: 'quality', value: 30, description: '+30% quality for enhancement items' },
            { type: 'speed', value: 15, description: '+15% speed for complex alchemy' }
          ],
          isUnlocked: skillLevel >= 15
        }
      ],
      steamcraft: [
        {
          specializationId: 'engine-master',
          name: 'Engine Master',
          description: 'Specializes in creating powerful steam engines and cores',
          requiredLevel: 8,
          bonuses: [
            { type: 'quality', value: 18, description: '+18% quality for engine components' },
            { type: 'material_efficiency', value: 20, description: '20% chance to save materials on engines' }
          ],
          isUnlocked: skillLevel >= 8
        },
        {
          specializationId: 'innovation-pioneer',
          name: 'Innovation Pioneer',
          description: 'Pushes the boundaries of steam technology',
          requiredLevel: 18,
          bonuses: [
            { type: 'experience', value: 25, description: '+25% experience from steamcraft' },
            { type: 'speed', value: 30, description: '+30% speed for all steamcraft recipes' }
          ],
          isUnlocked: skillLevel >= 18
        }
      ]
    };
    
    return specializations[skillType] || [];
  }

  /**
   * Get recipe by ID
   */
  static getRecipeById(recipeId: string): CraftingRecipe | null {
    return CRAFTING_RECIPES.find(recipe => recipe.recipeId === recipeId) || null;
  }

  /**
   * Get workstation by ID
   */
  static getWorkstationById(workstationId: string): CraftingWorkstation | null {
    return CRAFTING_WORKSTATIONS.find(workstation => workstation.workstationId === workstationId) || null;
  }

  /**
   * Format crafting time for display
   */
  static formatCraftingTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  }

  /**
   * Get skill tree display information
   */
  static getSkillTreeDisplay(skillType: CraftingSkillType) {
    const skillInfo = {
      clockmaking: {
        name: 'Clockmaking',
        description: 'The art of creating intricate clockwork mechanisms and timepieces',
        icon: '⚙️',
        color: '#d4af37'
      },
      engineering: {
        name: 'Engineering',
        description: 'Mastery of steam-powered machinery and mechanical systems',
        icon: '🔧',
        color: '#8b6914'
      },
      alchemy: {
        name: 'Alchemy',
        description: 'The science of transmutation and enhancement through steam-infused processes',
        icon: '⚗️',
        color: '#9370db'
      },
      steamcraft: {
        name: 'Steamcraft',
        description: 'Advanced steam technology and engine construction',
        icon: '🚂',
        color: '#cd853f'
      }
    };
    
    return skillInfo[skillType];
  }
}

export default CraftingService;