/**
 * Character service for managing character operations and calculations
 */

import { Character, CharacterStats, CraftingSkillSet, HarvestingSkillSet, CombatSkillSet, CreateCharacterRequest, UpdateCharacterRequest } from '../types/character';
import { SpecializationService } from './specializationService';
import { NetworkClient, NetworkFallbackError } from './networkClient';
import { EnvironmentService } from './environmentService';

import { v4 as uuidv4 } from 'uuid';

export class CharacterService {
  /**
   * Calculate character level based on experience
   */
  static calculateLevel(experience: number): number {
    // Experience formula: level = floor(sqrt(experience / 100)) + 1
    // This creates a curve where higher levels require more experience
    return Math.floor(Math.sqrt(experience / 100)) + 1;
  }

  /**
   * Calculate experience required for a specific level
   */
  static calculateExperienceForLevel(level: number): number {
    // Inverse of level formula: experience = (level - 1)^2 * 100
    return Math.pow(level - 1, 2) * 100;
  }

  /**
   * Calculate skill level based on experience
   */
  static calculateSkillLevel(experience: number): number {
    // Similar to character level but with different scaling
    return Math.floor(Math.sqrt(experience / 50)) + 1;
  }

  /**
   * Update skill set with new experience
   */
  static updateSkillSet<T extends CraftingSkillSet | HarvestingSkillSet | CombatSkillSet>(
    skillSet: T, 
    skillName: keyof Omit<T, 'level' | 'experience'>, 
    experienceGain: number
  ): T {
    const updatedSkillSet = { ...skillSet };
    
    // Add experience to specific skill
    (updatedSkillSet[skillName] as number) += experienceGain;
    
    // Add to total experience
    updatedSkillSet.experience += experienceGain;
    
    // Recalculate level based on total experience
    updatedSkillSet.level = this.calculateSkillLevel(updatedSkillSet.experience);
    
    return updatedSkillSet;
  }

  /**
   * Calculate total character power/rating
   */
  static calculateCharacterPower(stats: CharacterStats): number {
    const baseStats = stats.strength + stats.dexterity + stats.intelligence + stats.vitality;
    const skillLevels = stats.craftingSkills.level + stats.harvestingSkills.level + stats.combatSkills.level;
    
    return baseStats * 10 + skillLevels * 5;
  }

  /**
   * Calculate stat bonuses based on level and specialization
   */
  static calculateStatBonuses(level: number, specialization: any): Partial<CharacterStats> {
    const bonuses: Partial<CharacterStats> = {
      strength: Math.floor(level / 5), // +1 strength every 5 levels
      dexterity: Math.floor(level / 5),
      intelligence: Math.floor(level / 5),
      vitality: Math.floor(level / 5),
    };

    // Apply specialization bonuses
    if (specialization.primaryRole) {
      switch (specialization.primaryRole) {
        case 'tank':
          bonuses.strength = (bonuses.strength || 0) + Math.floor(level / 3);
          bonuses.vitality = (bonuses.vitality || 0) + Math.floor(level / 3);
          break;
        case 'healer':
          bonuses.intelligence = (bonuses.intelligence || 0) + Math.floor(level / 3);
          bonuses.vitality = (bonuses.vitality || 0) + Math.floor(level / 4);
          break;
        case 'dps':
          bonuses.strength = (bonuses.strength || 0) + Math.floor(level / 4);
          bonuses.dexterity = (bonuses.dexterity || 0) + Math.floor(level / 3);
          break;
      }
    }

    return bonuses;
  }

  /**
   * Validate character name uniqueness
   */
  static async validateCharacterName(name: string): Promise<{ available: boolean; message: string }> {
    try {
      const response = await NetworkClient.post<{ available: boolean; message: string }>('/character/validate-name', { name });
      return response.data;
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      console.error('Error validating character name:', error);
      throw new Error(error.message || 'Failed to validate character name');
    }
  }

  /**
   * Create a new character
   */
  static async createCharacter(request: CreateCharacterRequest): Promise<Character> {
    // Always use AWS services for character creation
    try {
      const response = await NetworkClient.post<{ character: Character }>('/character', request);
      return response.data.character;
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      // For other errors, provide user-friendly messages
      if (error.statusCode === 409) {
        throw new Error('Character name is already taken. Please choose a different name.');
      }
      throw new Error(error.message || 'Failed to create character');
    }
  }

  /**
   * Get character by user ID
   */
  static async getCharacter(userId: string): Promise<Character | null> {
    // Always use AWS services for character retrieval
    try {
      const response = await NetworkClient.get<{ character: Character }>(`/character?userId=${userId}`);
      return response.data.character;
    } catch (error: any) {
      // Handle 404 as null (no character found)
      if (error.statusCode === 404) {
        return null;
      }
      
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      console.error('Error getting character:', error);
      throw new Error(error.message || 'Failed to get character');
    }
  }

  /**
   * Check if user has a character
   */
  static async hasCharacter(userId: string): Promise<boolean> {
    try {
      const character = await this.getCharacter(userId);
      return character !== null;
    } catch (error) {
      console.error('Error checking character existence:', error);
      return false;
    }
  }

  /**
   * Update character
   */
  static async updateCharacter(userId: string, updates: UpdateCharacterRequest): Promise<Character> {
    try {
      const response = await NetworkClient.put<{ character: Character }>(`/character/${userId}`, updates);
      return response.data.character;
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      throw new Error(error.message || 'Failed to update character');
    }
  }

  /**
   * Delete character
   */
  static async deleteCharacter(userId: string): Promise<void> {
    try {
      await NetworkClient.delete(`/character/${userId}`);
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      throw new Error(error.message || 'Failed to delete character');
    }
  }

  /**
   * Add experience to character and recalculate level
   */
  static async addExperience(userId: string, experienceGain: number): Promise<Character> {
    const character = await this.getCharacter(userId);
    if (!character) {
      throw new Error('Character not found');
    }

    const newExperience = character.experience + experienceGain;
    const newLevel = this.calculateLevel(newExperience);
    
    // Calculate stat bonuses if level increased
    let statUpdates = {};
    if (newLevel > character.level) {
      const bonuses = this.calculateStatBonuses(newLevel, character.specialization);
      statUpdates = {
        strength: character.stats.strength + (bonuses.strength || 0),
        dexterity: character.stats.dexterity + (bonuses.dexterity || 0),
        intelligence: character.stats.intelligence + (bonuses.intelligence || 0),
        vitality: character.stats.vitality + (bonuses.vitality || 0),
        craftingSkills: character.stats.craftingSkills,
        harvestingSkills: character.stats.harvestingSkills,
        combatSkills: character.stats.combatSkills,
      };
    }

    const updates: UpdateCharacterRequest = {
      characterId: character.characterId,
      experience: newExperience,
      level: newLevel,
      ...(Object.keys(statUpdates).length > 0 && { stats: statUpdates as CharacterStats }),
    };

    return this.updateCharacter(userId, updates);
  }

  /**
   * Add skill experience to a specific skill set
   */
  static async addSkillExperience(
    userId: string, 
    skillSetType: 'crafting' | 'harvesting' | 'combat',
    skillName: string,
    experienceGain: number
  ): Promise<Character> {
    const character = await this.getCharacter(userId);
    if (!character) {
      throw new Error('Character not found');
    }

    let updatedSkillSet: CraftingSkillSet | HarvestingSkillSet | CombatSkillSet;
    let updatedStats: CharacterStats;

    if (skillSetType === 'crafting') {
      const currentSkillSet = character.stats.craftingSkills;
      if (!(skillName in currentSkillSet) || skillName === 'level' || skillName === 'experience') {
        throw new Error(`Invalid skill name: ${skillName}`);
      }
      updatedSkillSet = this.updateSkillSet(currentSkillSet, skillName as keyof Omit<CraftingSkillSet, 'level' | 'experience'>, experienceGain);
      updatedStats = { ...character.stats, craftingSkills: updatedSkillSet as CraftingSkillSet };
    } else if (skillSetType === 'harvesting') {
      const currentSkillSet = character.stats.harvestingSkills;
      if (!(skillName in currentSkillSet) || skillName === 'level' || skillName === 'experience') {
        throw new Error(`Invalid skill name: ${skillName}`);
      }
      updatedSkillSet = this.updateSkillSet(currentSkillSet, skillName as keyof Omit<HarvestingSkillSet, 'level' | 'experience'>, experienceGain);
      updatedStats = { ...character.stats, harvestingSkills: updatedSkillSet as HarvestingSkillSet };
    } else {
      const currentSkillSet = character.stats.combatSkills;
      if (!(skillName in currentSkillSet) || skillName === 'level' || skillName === 'experience') {
        throw new Error(`Invalid skill name: ${skillName}`);
      }
      updatedSkillSet = this.updateSkillSet(currentSkillSet, skillName as keyof Omit<CombatSkillSet, 'level' | 'experience'>, experienceGain);
      updatedStats = { ...character.stats, combatSkills: updatedSkillSet as CombatSkillSet };
    }

    // Recalculate specialization based on updated stats
    const updatedSpecialization = SpecializationService.updateCharacterSpecialization({
      ...character,
      stats: updatedStats,
    });

    const updates: UpdateCharacterRequest = {
      characterId: character.characterId,
      stats: updatedStats,
      specialization: updatedSpecialization,
    };

    return this.updateCharacter(userId, updates);
  }

  /**
   * Update character specialization based on current stats
   */
  static async updateSpecialization(userId: string): Promise<Character> {
    const character = await this.getCharacter(userId);
    if (!character) {
      throw new Error('Character not found');
    }

    const updatedSpecialization = SpecializationService.updateCharacterSpecialization(character);

    const updates: UpdateCharacterRequest = {
      characterId: character.characterId,
      specialization: updatedSpecialization,
    };

    return this.updateCharacter(userId, updates);
  }

  /**
   * Get specialization display information for a character
   */
  static getSpecializationDisplay(character: Character) {
    return SpecializationService.getSpecializationDisplay(character.specialization);
  }

  /**
   * Get next specialization milestone for a character
   */
  static getNextSpecializationMilestone(character: Character) {
    return SpecializationService.getNextMilestone(character.specialization);
  }

  /**
   * Apply stat increases and recalculate specialization
   */
  static async addStatPoints(
    userId: string,
    statIncreases: Partial<Pick<CharacterStats, 'strength' | 'dexterity' | 'intelligence' | 'vitality'>>
  ): Promise<Character> {
    const character = await this.getCharacter(userId);
    if (!character) {
      throw new Error('Character not found');
    }

    const updatedStats = {
      ...character.stats,
      strength: character.stats.strength + (statIncreases.strength || 0),
      dexterity: character.stats.dexterity + (statIncreases.dexterity || 0),
      intelligence: character.stats.intelligence + (statIncreases.intelligence || 0),
      vitality: character.stats.vitality + (statIncreases.vitality || 0),
    };

    // Recalculate specialization based on updated stats
    const updatedSpecialization = SpecializationService.updateCharacterSpecialization({
      ...character,
      stats: updatedStats,
    });

    const updates: UpdateCharacterRequest = {
      characterId: character.characterId,
      stats: updatedStats,
      specialization: updatedSpecialization,
    };

    return this.updateCharacter(userId, updates);
  }
}

export default CharacterService;