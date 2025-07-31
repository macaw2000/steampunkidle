/**
 * Adaptive Character Service - AWS Only
 * Simplified character service that only uses AWS-based CharacterService
 */

import { Character, CreateCharacterRequest, UpdateCharacterRequest, CharacterStats } from '../types/character';
import { CharacterService } from './characterService';

/**
 * Adaptive Character Service
 * Provides character management with AWS-only backend
 */
export class AdaptiveCharacterService {
  /**
   * Validate character name uniqueness
   */
  static async validateCharacterName(name: string): Promise<{ available: boolean; message: string }> {
    try {
      console.log('[AdaptiveCharacterService] Validating character name using AWS CharacterService');
      return await CharacterService.validateCharacterName(name);
    } catch (error: any) {
      console.error('[AdaptiveCharacterService] Failed to validate character name:', error);
      throw error;
    }
  }

  /**
   * Create a new character
   */
  static async createCharacter(request: CreateCharacterRequest): Promise<Character> {
    try {
      console.log('[AdaptiveCharacterService] Creating character using AWS CharacterService');
      return await CharacterService.createCharacter(request);
    } catch (error: any) {
      console.error('[AdaptiveCharacterService] Failed to create character:', error);
      throw error;
    }
  }

  /**
   * Get character by user ID
   */
  static async getCharacter(userId: string): Promise<Character | null> {
    try {
      console.log('[AdaptiveCharacterService] Getting character using AWS CharacterService');
      return await CharacterService.getCharacter(userId);
    } catch (error: any) {
      console.error('[AdaptiveCharacterService] Failed to get character:', error);
      throw error;
    }
  }

  /**
   * Update character
   */
  static async updateCharacter(userId: string, updates: UpdateCharacterRequest): Promise<Character> {
    try {
      console.log('[AdaptiveCharacterService] Updating character using AWS CharacterService');
      return await CharacterService.updateCharacter(userId, updates);
    } catch (error: any) {
      console.error('[AdaptiveCharacterService] Failed to update character:', error);
      throw error;
    }
  }

  /**
   * Delete character
   */
  static async deleteCharacter(userId: string): Promise<void> {
    try {
      console.log('[AdaptiveCharacterService] Deleting character using AWS CharacterService');
      await CharacterService.deleteCharacter(userId);
    } catch (error: any) {
      console.error('[AdaptiveCharacterService] Failed to delete character:', error);
      throw error;
    }
  }

  /**
   * Add experience to character
   */
  static async addExperience(userId: string, experienceGain: number): Promise<Character> {
    try {
      console.log('[AdaptiveCharacterService] Adding experience using AWS CharacterService');
      return await CharacterService.addExperience(userId, experienceGain);
    } catch (error: any) {
      console.error('[AdaptiveCharacterService] Failed to add experience:', error);
      throw error;
    }
  }

  /**
   * Add skill experience to character
   */
  static async addSkillExperience(
    userId: string,
    skillSetType: 'crafting' | 'harvesting' | 'combat',
    skillName: string,
    experienceGain: number
  ): Promise<Character> {
    try {
      console.log('[AdaptiveCharacterService] Adding skill experience using AWS CharacterService');
      return await CharacterService.addSkillExperience(userId, skillSetType, skillName, experienceGain);
    } catch (error: any) {
      console.error('[AdaptiveCharacterService] Failed to add skill experience:', error);
      throw error;
    }
  }

  /**
   * Add stat points to character
   */
  static async addStatPoints(
    userId: string,
    statIncreases: { [statName: string]: number }
  ): Promise<Character> {
    try {
      console.log('[AdaptiveCharacterService] Adding stat points using AWS CharacterService');
      return await CharacterService.addStatPoints(userId, statIncreases);
    } catch (error: any) {
      console.error('[AdaptiveCharacterService] Failed to add stat points:', error);
      throw error;
    }
  }

  /**
   * Get service status (always returns AWS service status)
   */
  static getServiceStatus(): {
    usingAwsService: boolean;
    serviceHealth: 'healthy' | 'degraded' | 'unhealthy';
  } {
    return {
      usingAwsService: true,
      serviceHealth: 'healthy', // Assume healthy unless we implement health checks
    };
  }
}