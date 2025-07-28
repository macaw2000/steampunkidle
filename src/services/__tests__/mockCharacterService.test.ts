/**
 * Tests for MockCharacterService
 */

import { MockCharacterService } from '../mockCharacterService';
import { CreateCharacterRequest } from '../../types/character';

describe('MockCharacterService', () => {
  beforeEach(() => {
    // Clear mock data before each test
    MockCharacterService.clearMockData();
    
    // Configure for fast testing
    MockCharacterService.configure({
      simulateNetworkDelay: false,
      errorRate: 0,
      timeoutRate: 0,
      offlineMode: false,
    });
  });

  afterEach(() => {
    MockCharacterService.clearMockData();
  });

  describe('createCharacter', () => {
    it('should create a new character successfully', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      const character = await MockCharacterService.createCharacter(request);

      expect(character).toBeDefined();
      expect(character.userId).toBe(request.userId);
      expect(character.name).toBe(request.name);
      expect(character.level).toBe(1);
      expect(character.experience).toBe(0);
      expect(character.currency).toBe(100);
      expect(character.characterId).toBeDefined();
    });

    it('should throw error for duplicate character name', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      await MockCharacterService.createCharacter(request);

      const duplicateRequest: CreateCharacterRequest = {
        userId: 'test-user-2',
        name: 'TestCharacter', // Same name
      };

      await expect(MockCharacterService.createCharacter(duplicateRequest))
        .rejects.toThrow('Character name is already taken');
    });

    it('should throw error if user already has character', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      await MockCharacterService.createCharacter(request);

      const secondRequest: CreateCharacterRequest = {
        userId: 'test-user-1', // Same user
        name: 'AnotherCharacter',
      };

      await expect(MockCharacterService.createCharacter(secondRequest))
        .rejects.toThrow('User already has a character');
    });
  });

  describe('getCharacter', () => {
    it('should return character if exists', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      const createdCharacter = await MockCharacterService.createCharacter(request);
      const retrievedCharacter = await MockCharacterService.getCharacter('test-user-1');

      expect(retrievedCharacter).toBeDefined();
      expect(retrievedCharacter?.characterId).toBe(createdCharacter.characterId);
      expect(retrievedCharacter?.name).toBe(createdCharacter.name);
    });

    it('should return null if character does not exist', async () => {
      const character = await MockCharacterService.getCharacter('non-existent-user');
      expect(character).toBeNull();
    });
  });

  describe('hasCharacter', () => {
    it('should return true if user has character', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      await MockCharacterService.createCharacter(request);
      const hasCharacter = await MockCharacterService.hasCharacter('test-user-1');

      expect(hasCharacter).toBe(true);
    });

    it('should return false if user has no character', async () => {
      const hasCharacter = await MockCharacterService.hasCharacter('non-existent-user');
      expect(hasCharacter).toBe(false);
    });
  });

  describe('updateCharacter', () => {
    it('should update character successfully', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      const character = await MockCharacterService.createCharacter(request);
      
      const updates = {
        characterId: character.characterId,
        experience: 500,
        level: 3,
        currency: 200,
      };

      const updatedCharacter = await MockCharacterService.updateCharacter('test-user-1', updates);

      expect(updatedCharacter.experience).toBe(500);
      expect(updatedCharacter.level).toBe(3);
      expect(updatedCharacter.currency).toBe(200);
      expect(updatedCharacter.updatedAt).not.toBe(character.updatedAt);
    });

    it('should throw error if character not found', async () => {
      const updates = {
        characterId: 'non-existent-id',
        experience: 500,
      };

      await expect(MockCharacterService.updateCharacter('non-existent-user', updates))
        .rejects.toThrow('Character not found');
    });
  });

  describe('deleteCharacter', () => {
    it('should delete character successfully', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      await MockCharacterService.createCharacter(request);
      await MockCharacterService.deleteCharacter('test-user-1');

      const character = await MockCharacterService.getCharacter('test-user-1');
      expect(character).toBeNull();
    });

    it('should throw error if character not found', async () => {
      await expect(MockCharacterService.deleteCharacter('non-existent-user'))
        .rejects.toThrow('Character not found');
    });
  });

  describe('addExperience', () => {
    it('should add experience and update level', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      await MockCharacterService.createCharacter(request);
      const updatedCharacter = await MockCharacterService.addExperience('test-user-1', 500);

      expect(updatedCharacter.experience).toBe(500);
      expect(updatedCharacter.level).toBe(MockCharacterService.calculateLevel(500));
    });
  });

  describe('addSkillExperience', () => {
    it('should add skill experience correctly', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      await MockCharacterService.createCharacter(request);
      const updatedCharacter = await MockCharacterService.addSkillExperience(
        'test-user-1',
        'crafting',
        'clockmaking',
        100
      );

      expect(updatedCharacter.stats.craftingSkills.clockmaking).toBe(100);
      expect(updatedCharacter.stats.craftingSkills.experience).toBe(100);
      expect(updatedCharacter.stats.craftingSkills.level).toBe(
        MockCharacterService.calculateSkillLevel(100)
      );
    });

    it('should throw error for invalid skill name', async () => {
      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      await MockCharacterService.createCharacter(request);

      await expect(MockCharacterService.addSkillExperience(
        'test-user-1',
        'crafting',
        'invalid-skill',
        100
      )).rejects.toThrow('Invalid skill name: invalid-skill');
    });
  });

  describe('error simulation', () => {
    it('should simulate errors when configured', async () => {
      MockCharacterService.configure({
        errorRate: 1.0, // 100% error rate
        simulateNetworkDelay: false,
      });

      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      await expect(MockCharacterService.createCharacter(request))
        .rejects.toThrow();
    });

    it('should simulate offline mode', async () => {
      MockCharacterService.configure({
        offlineMode: true,
        simulateNetworkDelay: false,
      });

      const request: CreateCharacterRequest = {
        userId: 'test-user-1',
        name: 'TestCharacter',
      };

      await expect(MockCharacterService.createCharacter(request))
        .rejects.toThrow('Cannot create character while offline');
    });
  });

  describe('calculation methods', () => {
    it('should calculate level correctly', () => {
      expect(MockCharacterService.calculateLevel(0)).toBe(1);
      expect(MockCharacterService.calculateLevel(100)).toBe(2);
      expect(MockCharacterService.calculateLevel(400)).toBe(3);
    });

    it('should calculate experience for level correctly', () => {
      expect(MockCharacterService.calculateExperienceForLevel(1)).toBe(0);
      expect(MockCharacterService.calculateExperienceForLevel(2)).toBe(100);
      expect(MockCharacterService.calculateExperienceForLevel(3)).toBe(400);
    });

    it('should calculate skill level correctly', () => {
      expect(MockCharacterService.calculateSkillLevel(0)).toBe(1);
      expect(MockCharacterService.calculateSkillLevel(50)).toBe(2);
      expect(MockCharacterService.calculateSkillLevel(200)).toBe(3);
    });
  });

  describe('health check', () => {
    it('should return healthy status by default', async () => {
      const health = await MockCharacterService.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.message).toBe('Mock service is running normally');
    });

    it('should return unhealthy status in offline mode', async () => {
      MockCharacterService.configure({ offlineMode: true });
      
      const health = await MockCharacterService.checkHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Service is in offline mode');
    });

    it('should return degraded status with high error rate', async () => {
      MockCharacterService.configure({ errorRate: 0.6 });
      
      const health = await MockCharacterService.checkHealth();
      expect(health.status).toBe('degraded');
      expect(health.message).toBe('High error rate detected');
    });
  });
});