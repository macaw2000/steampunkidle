/**
 * Mock API Service for Local Development
 * Provides mock responses for backend API calls when running locally
 */

import { Character } from '../types/character';

export class MockApiService {
  private static instance: MockApiService;
  private mockDelay: number = 500; // Simulate network delay
  private shouldSimulateErrors: boolean = false;

  static getInstance(): MockApiService {
    if (!MockApiService.instance) {
      MockApiService.instance = new MockApiService();
    }
    return MockApiService.instance;
  }

  setMockDelay(ms: number): void {
    this.mockDelay = ms;
  }

  simulateErrors(shouldError: boolean): void {
    this.shouldSimulateErrors = shouldError;
  }

  private async delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.mockDelay));
  }

  private throwErrorIfSimulating(message: string): void {
    if (this.shouldSimulateErrors) {
      throw new Error(`Mock API Error: ${message}`);
    }
  }

  // Mock character data
  private getMockCharacter(userId: string): Character {
    return {
      userId,
      characterId: `char-${userId}`,
      name: 'macaw',
      level: 15,
      experience: 2450,
      currency: 1250,
      stats: {
        strength: 12,
        dexterity: 18,
        intelligence: 14,
        vitality: 16,
        harvestingSkills: {
          level: 8,
          experience: 1200,
          mining: 10,
          foraging: 6,
          salvaging: 4,
          crystal_extraction: 2
        },
        craftingSkills: {
          level: 5,
          experience: 800,
          clockmaking: 7,
          engineering: 3,
          alchemy: 2,
          steamcraft: 1
        },
        combatSkills: {
          level: 3,
          experience: 400,
          melee: 4,
          ranged: 2,
          defense: 5,
          tactics: 1
        }
      },
      specialization: {
        tankProgress: 0,
        healerProgress: 0,
        dpsProgress: 0,
        primaryRole: null,
        secondaryRole: null,
        bonuses: []
      },
      currentActivity: {
        type: 'crafting',
        startedAt: new Date(Date.now() - 300000), // 5 minutes ago
        progress: 0,
        rewards: []
      },
      lastActiveAt: new Date(Date.now() - 300000), // 5 minutes ago
      createdAt: new Date(Date.now() - 86400000 * 7), // 7 days ago
      updatedAt: new Date(Date.now() - 300000) // 5 minutes ago
    };
  }

  // Mock API endpoints
  async getCharacter(userId: string): Promise<Character> {
    await this.delay();
    this.throwErrorIfSimulating('Character fetch failed');
    
    console.log(`MockApiService: Fetching character for user ${userId}`);
    return this.getMockCharacter(userId);
  }

  async createCharacter(userId: string, characterData: any): Promise<Character> {
    await this.delay();
    this.throwErrorIfSimulating('Character creation failed');
    
    console.log(`MockApiService: Creating character for user ${userId}`, characterData);
    
    const character = this.getMockCharacter(userId);
    character.name = characterData.name || 'New Character';
    character.level = 1;
    character.experience = 0;
    character.currency = 100; // Starting currency
    character.createdAt = new Date();
    character.lastActiveAt = new Date();
    character.updatedAt = new Date();
    
    return character;
  }

  async updateCharacter(character: Character): Promise<Character> {
    await this.delay();
    this.throwErrorIfSimulating('Character update failed');
    
    console.log(`MockApiService: Updating character`, character);
    character.lastActiveAt = new Date();
    character.updatedAt = new Date();
    return character;
  }

  async getOnlinePlayerCount(): Promise<number> {
    await this.delay();
    this.throwErrorIfSimulating('Online player count fetch failed');
    
    // Return a random number between 50-200 for mock data
    const count = Math.floor(Math.random() * 150) + 50;
    console.log(`MockApiService: Online player count: ${count}`);
    return count;
  }

  // Health check for service availability
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'offline'; message: string }> {
    try {
      await this.delay();
      return {
        status: 'healthy',
        message: 'Mock API service is running'
      };
    } catch (error) {
      return {
        status: 'offline',
        message: `Mock API service error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export const mockApiService = MockApiService.getInstance();