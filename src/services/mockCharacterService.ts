/**
 * Mock Character Service for local development
 * Provides the same interface as CharacterService but with mock data and configurable behavior
 */

import { Character, CharacterStats, CraftingSkillSet, HarvestingSkillSet, CombatSkillSet, CreateCharacterRequest, UpdateCharacterRequest } from '../types/character';
// Using simple ID generation instead of uuid for test compatibility

export interface MockServiceConfig {
  enabled: boolean;
  simulateNetworkDelay: boolean;
  minDelay: number;
  maxDelay: number;
  errorRate: number; // 0-1, probability of throwing errors
  timeoutRate: number; // 0-1, probability of timeout errors
  offlineMode: boolean;
}

export class MockCharacterService {
  private static config: MockServiceConfig = {
    enabled: true,
    simulateNetworkDelay: true,
    minDelay: 500,
    maxDelay: 2000,
    errorRate: 0.1, // 10% error rate
    timeoutRate: 0.05, // 5% timeout rate
    offlineMode: false,
  };

  private static mockCharacters: Map<string, Character> = new Map();

  /**
   * Configure mock service behavior
   */
  static configure(config: Partial<MockServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  static getConfig(): MockServiceConfig {
    return { ...this.config };
  }

  /**
   * Simulate network delay
   */
  private static async simulateDelay(): Promise<void> {
    if (!this.config.simulateNetworkDelay) return;
    
    const delay = Math.random() * (this.config.maxDelay - this.config.minDelay) + this.config.minDelay;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simulate network errors
   */
  private static simulateError(operation: string): void {
    if (this.config.offlineMode) {
      throw new Error(`Cannot ${operation} while offline`);
    }

    if (Math.random() < this.config.timeoutRate) {
      throw new Error(`${operation} timed out - please try again`);
    }

    if (Math.random() < this.config.errorRate) {
      const errors = [
        'Server temporarily unavailable',
        'Network connection lost',
        'Service maintenance in progress',
        'Rate limit exceeded',
      ];
      throw new Error(errors[Math.floor(Math.random() * errors.length)]);
    }
  }

  /**
   * Generate mock character data
   */
  private static generateMockCharacter(userId: string, name: string): Character {
    const characterId = `char-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      characterId,
      userId,
      name,
      level: 1,
      experience: 0,
      currency: 100, // Starting currency
      stats: {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        vitality: 10,
        craftingSkills: {
          clockmaking: 0,
          engineering: 0,
          alchemy: 0,
          steamcraft: 0,
          level: 1,
          experience: 0,
        },
        harvestingSkills: {
          mining: 0,
          foraging: 0,
          salvaging: 0,
          crystal_extraction: 0,
          level: 1,
          experience: 0,
        },
        combatSkills: {
          melee: 0,
          ranged: 0,
          defense: 0,
          tactics: 0,
          level: 1,
          experience: 0,
        },
      },
      specialization: {
        tankProgress: 0,
        healerProgress: 0,
        dpsProgress: 0,
        primaryRole: null,
        secondaryRole: null,
        bonuses: [],
      },
      currentActivity: {
        type: 'crafting',
        startedAt: new Date(),
        progress: 0,
        rewards: [],
      },
      lastActiveAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Seed mock data with some pre-generated characters
   */
  static seedMockData(): void {
    const testUsers = [
      { userId: 'test-user-1', name: 'TestCharacter1' },
      { userId: 'test-user-2', name: 'ExperiencedPlayer' },
      { userId: 'test-user-3', name: 'SteamMaster' },
    ];

    testUsers.forEach(({ userId, name }) => {
      if (!this.mockCharacters.has(userId)) {
        const character = this.generateMockCharacter(userId, name);
        
        // Give some characters different levels and stats for variety
        if (name === 'ExperiencedPlayer') {
          character.level = 5;
          character.experience = 2500;
          character.currency = 500;
          character.stats.strength = 15;
          character.stats.craftingSkills.clockmaking = 150;
          character.stats.craftingSkills.experience = 300;
          character.stats.craftingSkills.level = 3;
        } else if (name === 'SteamMaster') {
          character.level = 10;
          character.experience = 8100;
          character.currency = 1200;
          character.stats.intelligence = 20;
          character.stats.craftingSkills.steamcraft = 400;
          character.stats.craftingSkills.experience = 800;
          character.stats.craftingSkills.level = 5;
          character.specialization.primaryRole = 'dps';
        }
        
        this.mockCharacters.set(userId, character);
      }
    });
  }

  /**
   * Calculate character level based on experience (same as real service)
   */
  static calculateLevel(experience: number): number {
    return Math.floor(Math.sqrt(experience / 100)) + 1;
  }

  /**
   * Calculate experience required for a specific level (same as real service)
   */
  static calculateExperienceForLevel(level: number): number {
    return Math.pow(level - 1, 2) * 100;
  }

  /**
   * Calculate skill level based on experience (same as real service)
   */
  static calculateSkillLevel(experience: number): number {
    return Math.floor(Math.sqrt(experience / 50)) + 1;
  }

  /**
   * Update skill set with new experience (same as real service)
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
   * Calculate total character power/rating (same as real service)
   */
  static calculateCharacterPower(stats: CharacterStats): number {
    const baseStats = stats.strength + stats.dexterity + stats.intelligence + stats.vitality;
    const skillLevels = stats.craftingSkills.level + stats.harvestingSkills.level + stats.combatSkills.level;
    
    return baseStats * 10 + skillLevels * 5;
  }

  /**
   * Calculate stat bonuses based on level and specialization (same as real service)
   */
  static calculateStatBonuses(level: number, specialization: any): Partial<CharacterStats> {
    const bonuses: Partial<CharacterStats> = {
      strength: Math.floor(level / 5),
      dexterity: Math.floor(level / 5),
      intelligence: Math.floor(level / 5),
      vitality: Math.floor(level / 5),
    };

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
   * Create a new character
   */
  static async createCharacter(request: CreateCharacterRequest): Promise<Character> {
    await this.simulateDelay();
    this.simulateError('create character');

    // Check if character name is already taken
    const existingCharacter = Array.from(this.mockCharacters.values())
      .find(char => char.name.toLowerCase() === request.name.toLowerCase());
    
    if (existingCharacter) {
      throw new Error('Character name is already taken');
    }

    // Check if user already has a character
    if (this.mockCharacters.has(request.userId)) {
      throw new Error('User already has a character');
    }

    const newCharacter = this.generateMockCharacter(request.userId, request.name);
    this.mockCharacters.set(request.userId, newCharacter);

    console.log(`[MockCharacterService] Created character: ${request.name} for user: ${request.userId}`);
    return newCharacter;
  }

  /**
   * Get character by user ID
   */
  static async getCharacter(userId: string): Promise<Character | null> {
    await this.simulateDelay();
    this.simulateError('get character');

    const character = this.mockCharacters.get(userId);
    
    if (character) {
      console.log(`[MockCharacterService] Retrieved character: ${character.name} for user: ${userId}`);
      return { ...character }; // Return a copy to prevent external mutations
    }

    console.log(`[MockCharacterService] No character found for user: ${userId}`);
    return null;
  }

  /**
   * Check if user has a character
   */
  static async hasCharacter(userId: string): Promise<boolean> {
    try {
      const character = await this.getCharacter(userId);
      return character !== null;
    } catch (error) {
      console.error('[MockCharacterService] Error checking character existence:', error);
      return false;
    }
  }

  /**
   * Update character
   */
  static async updateCharacter(userId: string, updates: UpdateCharacterRequest): Promise<Character> {
    await this.simulateDelay();
    this.simulateError('update character');

    const character = this.mockCharacters.get(userId);
    if (!character) {
      throw new Error('Character not found');
    }

    // Apply updates
    const updatedCharacter: Character = {
      ...character,
      ...updates,
      stats: updates.stats ? { ...character.stats, ...updates.stats } : character.stats,
      specialization: updates.specialization ? { ...character.specialization, ...updates.specialization } : character.specialization,
      updatedAt: new Date(),
    };

    this.mockCharacters.set(userId, updatedCharacter);
    
    console.log(`[MockCharacterService] Updated character: ${character.name} for user: ${userId}`);
    return { ...updatedCharacter };
  }

  /**
   * Delete character
   */
  static async deleteCharacter(userId: string): Promise<void> {
    await this.simulateDelay();
    this.simulateError('delete character');

    if (!this.mockCharacters.has(userId)) {
      throw new Error('Character not found');
    }

    const character = this.mockCharacters.get(userId);
    this.mockCharacters.delete(userId);
    
    console.log(`[MockCharacterService] Deleted character: ${character?.name} for user: ${userId}`);
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

    const updates: UpdateCharacterRequest = {
      characterId: character.characterId,
      stats: updatedStats,
    };

    return this.updateCharacter(userId, updates);
  }

  /**
   * Apply stat increases
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

    const updates: UpdateCharacterRequest = {
      characterId: character.characterId,
      stats: updatedStats,
    };

    return this.updateCharacter(userId, updates);
  }

  /**
   * Clear all mock data (useful for testing)
   */
  static clearMockData(): void {
    this.mockCharacters.clear();
    console.log('[MockCharacterService] Cleared all mock data');
  }

  /**
   * Get all mock characters (for debugging)
   */
  static getAllMockCharacters(): Character[] {
    return Array.from(this.mockCharacters.values());
  }

  /**
   * Check service health
   */
  static async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message: string }> {
    await this.simulateDelay();
    
    if (this.config.offlineMode) {
      return { status: 'unhealthy', message: 'Service is in offline mode' };
    }
    
    if (this.config.errorRate > 0.5) {
      return { status: 'degraded', message: 'High error rate detected' };
    }
    
    return { status: 'healthy', message: 'Mock service is running normally' };
  }
}

// Initialize mock data on module load
MockCharacterService.seedMockData();

export default MockCharacterService;