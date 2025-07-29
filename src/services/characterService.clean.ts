/**
 * Character Service - AWS Only
 * Handles character management using AWS services only
 */

import { Character, CreateCharacterRequest, UpdateCharacterRequest, CharacterStats } from '../types/character';
import { NetworkClient, NetworkFallbackError } from './networkClient';
import { v4 as uuidv4 } from 'uuid';

/**
 * Character Service
 * Manages character data using AWS backend services
 */
export class CharacterService {
  /**
   * Create a new character using AWS backend
   */
  static async createCharacter(request: CreateCharacterRequest): Promise<Character> {
    try {
      console.log('CharacterService: Creating character via AWS backend');
      const response = await NetworkClient.post<{ character: Character }>('/character', request);
      return response.data.character;
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      // For other errors, provide user-friendly messages
      throw new Error(error.message || 'Failed to create character');
    }
  }

  /**
   * Get character by user ID using AWS backend
   */
  static async getCharacter(userId: string): Promise<Character | null> {
    try {
      console.log('CharacterService: Getting character via AWS backend');
      const response = await NetworkClient.get<{ character: Character }>(`/character/${userId}`);
      return response.data.character;
    } catch (error: any) {
      if (error.status === 404) {
        return null; // Character not found
      }
      
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      throw new Error(error.message || 'Failed to get character');
    }
  }

  /**
   * Update character using AWS backend
   */
  static async updateCharacter(userId: string, updates: UpdateCharacterRequest): Promise<Character> {
    try {
      console.log('CharacterService: Updating character via AWS backend');
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
   * Delete character using AWS backend
   */
  static async deleteCharacter(userId: string): Promise<void> {
    try {
      console.log('CharacterService: Deleting character via AWS backend');
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
   * Add experience to character using AWS backend
   */
  static async addExperience(userId: string, experienceGain: number): Promise<Character> {
    try {
      console.log('CharacterService: Adding experience via AWS backend');
      const response = await NetworkClient.post<{ character: Character }>(`/character/${userId}/experience`, {
        experienceGain,
      });
      return response.data.character;
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      throw new Error(error.message || 'Failed to add experience');
    }
  }

  /**
   * Add skill experience to character using AWS backend
   */
  static async addSkillExperience(
    userId: string,
    skillSetType: 'crafting' | 'harvesting' | 'combat',
    skillName: string,
    experienceGain: number
  ): Promise<Character> {
    try {
      console.log('CharacterService: Adding skill experience via AWS backend');
      const response = await NetworkClient.post<{ character: Character }>(`/character/${userId}/skill-experience`, {
        skillSetType,
        skillName,
        experienceGain,
      });
      return response.data.character;
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      throw new Error(error.message || 'Failed to add skill experience');
    }
  }

  /**
   * Add stat points to character using AWS backend
   */
  static async addStatPoints(
    userId: string,
    statIncreases: { [statName: string]: number }
  ): Promise<Character> {
    try {
      console.log('CharacterService: Adding stat points via AWS backend');
      const response = await NetworkClient.post<{ character: Character }>(`/character/${userId}/stats`, {
        statIncreases,
      });
      return response.data.character;
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      throw new Error(error.message || 'Failed to add stat points');
    }
  }

  /**
   * Get character statistics using AWS backend
   */
  static async getCharacterStats(userId: string): Promise<CharacterStats> {
    try {
      console.log('CharacterService: Getting character stats via AWS backend');
      const response = await NetworkClient.get<{ stats: CharacterStats }>(`/character/${userId}/stats`);
      return response.data.stats;
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      throw new Error(error.message || 'Failed to get character stats');
    }
  }

  /**
   * Update character activity using AWS backend
   */
  static async updateActivity(
    userId: string,
    activity: {
      type: string;
      startedAt: Date;
      progress: number;
      rewards: any[];
    }
  ): Promise<Character> {
    try {
      console.log('CharacterService: Updating character activity via AWS backend');
      const response = await NetworkClient.put<{ character: Character }>(`/character/${userId}/activity`, {
        activity,
      });
      return response.data.character;
    } catch (error: any) {
      // If it's a network fallback error, let the AdaptiveCharacterService handle it
      if (error instanceof NetworkFallbackError) {
        throw error;
      }
      
      throw new Error(error.message || 'Failed to update character activity');
    }
  }

  /**
   * Get service health status
   */
  static getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    usingAwsBackend: boolean;
  } {
    return {
      status: 'healthy', // Assume healthy unless we implement health checks
      usingAwsBackend: true,
    };
  }
}