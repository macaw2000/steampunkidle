/**
 * Adaptive Character Service
 * Automatically switches between real and mock character services based on availability
 */

import { Character, CreateCharacterRequest, UpdateCharacterRequest, CharacterStats } from '../types/character';
import { CharacterService } from './characterService';
import { MockCharacterService } from './mockCharacterService';
import { DevServiceManager } from './devServiceManager';
import { NetworkFallbackError } from './networkClient';

export class AdaptiveCharacterService {
  /**
   * Get the appropriate service instance based on health status
   */
  private static getService(): typeof CharacterService | typeof MockCharacterService {
    return DevServiceManager.getCharacterService();
  }

  /**
   * Log service usage for debugging
   */
  private static logServiceUsage(method: string, usingMock: boolean): void {
    if (process.env.NODE_ENV === 'development') {
      const serviceType = usingMock ? 'MockCharacterService' : 'CharacterService';
      console.log(`[AdaptiveCharacterService] ${method} using ${serviceType}`);
    }
  }

  /**
   * Calculate character level based on experience
   */
  static calculateLevel(experience: number): number {
    // This is a pure calculation, use the real service method
    return CharacterService.calculateLevel(experience);
  }

  /**
   * Calculate experience required for a specific level
   */
  static calculateExperienceForLevel(level: number): number {
    // This is a pure calculation, use the real service method
    return CharacterService.calculateExperienceForLevel(level);
  }

  /**
   * Calculate skill level based on experience
   */
  static calculateSkillLevel(experience: number): number {
    // This is a pure calculation, use the real service method
    return CharacterService.calculateSkillLevel(experience);
  }

  /**
   * Calculate total character power/rating
   */
  static calculateCharacterPower(stats: CharacterStats): number {
    // This is a pure calculation, use the real service method
    return CharacterService.calculateCharacterPower(stats);
  }

  /**
   * Create a new character
   */
  static async createCharacter(request: CreateCharacterRequest): Promise<Character> {
    const service = this.getService();
    const usingMock = service === MockCharacterService;
    
    this.logServiceUsage('createCharacter', usingMock);
    
    try {
      return await service.createCharacter(request);
    } catch (error: any) {
      // If it's a network fallback error or real service fails, try mock as fallback
      if ((!usingMock && DevServiceManager.getConfig().autoFallbackEnabled) || 
          error instanceof NetworkFallbackError) {
        console.warn('[AdaptiveCharacterService] Network service failed, trying mock service:', error.message);
        
        // Force mock mode temporarily
        DevServiceManager.enableMockMode();
        
        try {
          const result = await MockCharacterService.createCharacter(request);
          console.log('[AdaptiveCharacterService] Successfully created character using mock service');
          return result;
        } catch (mockError: any) {
          // If mock also fails, throw the original error
          console.error('[AdaptiveCharacterService] Mock service also failed:', mockError.message);
          throw error;
        }
      }
      
      throw error;
    }
  }

  /**
   * Get character by user ID
   */
  static async getCharacter(userId: string): Promise<Character | null> {
    const service = this.getService();
    const usingMock = service === MockCharacterService;
    
    this.logServiceUsage('getCharacter', usingMock);
    
    try {
      return await service.getCharacter(userId);
    } catch (error: any) {
      // If it's a network fallback error or real service fails, try mock as fallback
      if ((!usingMock && DevServiceManager.getConfig().autoFallbackEnabled) || 
          error instanceof NetworkFallbackError) {
        console.warn('[AdaptiveCharacterService] Network service failed, trying mock service:', error.message);
        
        // Force mock mode temporarily
        DevServiceManager.enableMockMode();
        
        try {
          const result = await MockCharacterService.getCharacter(userId);
          if (result) {
            console.log('[AdaptiveCharacterService] Successfully retrieved character using mock service');
          }
          return result;
        } catch (mockError: any) {
          // If mock also fails, return null (no character found)
          console.error('[AdaptiveCharacterService] Mock service also failed:', mockError.message);
          return null;
        }
      }
      
      throw error;
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
      console.error('[AdaptiveCharacterService] Error checking character existence:', error);
      return false;
    }
  }

  /**
   * Update character
   */
  static async updateCharacter(userId: string, updates: UpdateCharacterRequest): Promise<Character> {
    const service = this.getService();
    const usingMock = service === MockCharacterService;
    
    this.logServiceUsage('updateCharacter', usingMock);
    
    try {
      return await service.updateCharacter(userId, updates);
    } catch (error: any) {
      // If real service fails and we haven't tried mock yet, try mock as fallback
      if (!usingMock && DevServiceManager.getConfig().autoFallbackEnabled) {
        console.warn('[AdaptiveCharacterService] Real service failed, trying mock service:', error.message);
        
        // Force mock mode temporarily
        DevServiceManager.enableMockMode();
        
        try {
          return await MockCharacterService.updateCharacter(userId, updates);
        } catch (mockError: any) {
          // If mock also fails, throw the original error
          throw error;
        }
      }
      
      throw error;
    }
  }

  /**
   * Delete character
   */
  static async deleteCharacter(userId: string): Promise<void> {
    const service = this.getService();
    const usingMock = service === MockCharacterService;
    
    this.logServiceUsage('deleteCharacter', usingMock);
    
    try {
      return await service.deleteCharacter(userId);
    } catch (error: any) {
      // If real service fails and we haven't tried mock yet, try mock as fallback
      if (!usingMock && DevServiceManager.getConfig().autoFallbackEnabled) {
        console.warn('[AdaptiveCharacterService] Real service failed, trying mock service:', error.message);
        
        // Force mock mode temporarily
        DevServiceManager.enableMockMode();
        
        try {
          return await MockCharacterService.deleteCharacter(userId);
        } catch (mockError: any) {
          // If mock also fails, throw the original error
          throw error;
        }
      }
      
      throw error;
    }
  }

  /**
   * Add experience to character and recalculate level
   */
  static async addExperience(userId: string, experienceGain: number): Promise<Character> {
    const service = this.getService();
    const usingMock = service === MockCharacterService;
    
    this.logServiceUsage('addExperience', usingMock);
    
    try {
      return await service.addExperience(userId, experienceGain);
    } catch (error: any) {
      // If real service fails and we haven't tried mock yet, try mock as fallback
      if (!usingMock && DevServiceManager.getConfig().autoFallbackEnabled) {
        console.warn('[AdaptiveCharacterService] Real service failed, trying mock service:', error.message);
        
        // Force mock mode temporarily
        DevServiceManager.enableMockMode();
        
        try {
          return await MockCharacterService.addExperience(userId, experienceGain);
        } catch (mockError: any) {
          // If mock also fails, throw the original error
          throw error;
        }
      }
      
      throw error;
    }
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
    const service = this.getService();
    const usingMock = service === MockCharacterService;
    
    this.logServiceUsage('addSkillExperience', usingMock);
    
    try {
      return await service.addSkillExperience(userId, skillSetType, skillName, experienceGain);
    } catch (error: any) {
      // If real service fails and we haven't tried mock yet, try mock as fallback
      if (!usingMock && DevServiceManager.getConfig().autoFallbackEnabled) {
        console.warn('[AdaptiveCharacterService] Real service failed, trying mock service:', error.message);
        
        // Force mock mode temporarily
        DevServiceManager.enableMockMode();
        
        try {
          return await MockCharacterService.addSkillExperience(userId, skillSetType, skillName, experienceGain);
        } catch (mockError: any) {
          // If mock also fails, throw the original error
          throw error;
        }
      }
      
      throw error;
    }
  }

  /**
   * Apply stat increases
   */
  static async addStatPoints(
    userId: string,
    statIncreases: Partial<Pick<CharacterStats, 'strength' | 'dexterity' | 'intelligence' | 'vitality'>>
  ): Promise<Character> {
    const service = this.getService();
    const usingMock = service === MockCharacterService;
    
    this.logServiceUsage('addStatPoints', usingMock);
    
    try {
      return await service.addStatPoints(userId, statIncreases);
    } catch (error: any) {
      // If real service fails and we haven't tried mock yet, try mock as fallback
      if (!usingMock && DevServiceManager.getConfig().autoFallbackEnabled) {
        console.warn('[AdaptiveCharacterService] Real service failed, trying mock service:', error.message);
        
        // Force mock mode temporarily
        DevServiceManager.enableMockMode();
        
        try {
          return await MockCharacterService.addStatPoints(userId, statIncreases);
        } catch (mockError: any) {
          // If mock also fails, throw the original error
          throw error;
        }
      }
      
      throw error;
    }
  }

  /**
   * Get service status information
   */
  static getServiceStatus(): {
    usingMockService: boolean;
    serviceHealth: any;
    mockConfig?: any;
  } {
    const usingMockService = DevServiceManager.shouldUseMockServices();
    const serviceHealth = DevServiceManager.getServiceHealth('character');
    
    return {
      usingMockService,
      serviceHealth,
      ...(usingMockService && { mockConfig: MockCharacterService.getConfig() }),
    };
  }

  /**
   * Force switch to mock service (for testing)
   */
  static forceMockMode(): void {
    DevServiceManager.enableMockMode();
  }

  /**
   * Force switch to real service (for testing)
   */
  static forceRealService(): void {
    DevServiceManager.disableMockMode();
  }
}

export default AdaptiveCharacterService;