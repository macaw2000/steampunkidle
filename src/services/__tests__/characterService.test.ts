/**
 * Tests for CharacterService
 */

import { CharacterService } from '../characterService';
import { Character, CraftingSkillSet } from '../../types/character';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe.skip('CharacterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateLevel', () => {
    it('should calculate level 1 for 0 experience', () => {
      expect(CharacterService.calculateLevel(0)).toBe(1);
    });

    it('should calculate level 2 for 100 experience', () => {
      expect(CharacterService.calculateLevel(100)).toBe(2);
    });

    it('should calculate level 3 for 400 experience', () => {
      expect(CharacterService.calculateLevel(400)).toBe(3);
    });

    it('should calculate level 10 for 8100 experience', () => {
      expect(CharacterService.calculateLevel(8100)).toBe(10);
    });
  });

  describe('calculateExperienceForLevel', () => {
    it('should calculate 0 experience for level 1', () => {
      expect(CharacterService.calculateExperienceForLevel(1)).toBe(0);
    });

    it('should calculate 100 experience for level 2', () => {
      expect(CharacterService.calculateExperienceForLevel(2)).toBe(100);
    });

    it('should calculate 400 experience for level 3', () => {
      expect(CharacterService.calculateExperienceForLevel(3)).toBe(400);
    });

    it('should calculate 8100 experience for level 10', () => {
      expect(CharacterService.calculateExperienceForLevel(10)).toBe(8100);
    });
  });

  describe('calculateSkillLevel', () => {
    it('should calculate skill level 1 for 0 experience', () => {
      expect(CharacterService.calculateSkillLevel(0)).toBe(1);
    });

    it('should calculate skill level 2 for 50 experience', () => {
      expect(CharacterService.calculateSkillLevel(50)).toBe(2);
    });

    it('should calculate skill level 3 for 200 experience', () => {
      expect(CharacterService.calculateSkillLevel(200)).toBe(3);
    });
  });

  describe('updateSkillSet', () => {
    const mockSkillSet: CraftingSkillSet = {
      clockmaking: 5,
      engineering: 3,
      alchemy: 7,
      steamcraft: 2,
      level: 2,
      experience: 100,
    };

    it('should update specific skill and total experience', () => {
      const result = CharacterService.updateSkillSet(mockSkillSet, 'clockmaking', 50);
      
      expect(result.clockmaking).toBe(55);
      expect(result.engineering).toBe(3); // unchanged
      expect(result.experience).toBe(150);
      expect(result.level).toBe(2); // level based on total experience
    });

    it('should recalculate level when experience increases significantly', () => {
      const result = CharacterService.updateSkillSet(mockSkillSet, 'alchemy', 150);
      
      expect(result.alchemy).toBe(157);
      expect(result.experience).toBe(250);
      expect(result.level).toBe(3); // level should increase
    });

    it('should not modify original skill set', () => {
      const originalSkillSet = { ...mockSkillSet };
      CharacterService.updateSkillSet(mockSkillSet, 'engineering', 25);
      
      expect(mockSkillSet).toEqual(originalSkillSet);
    });
  });

  describe('calculateCharacterPower', () => {
    const mockStats = {
      strength: 15,
      dexterity: 12,
      intelligence: 18,
      vitality: 14,
      craftingSkills: { level: 5 } as CraftingSkillSet,
      harvestingSkills: { level: 3 } as any,
      combatSkills: { level: 4 } as any,
    };

    it('should calculate character power correctly', () => {
      const power = CharacterService.calculateCharacterPower(mockStats);
      const expectedPower = (15 + 12 + 18 + 14) * 10 + (5 + 3 + 4) * 5;
      expect(power).toBe(expectedPower); // 590 + 60 = 650
    });
  });

  describe('calculateStatBonuses', () => {
    it('should calculate base stat bonuses for level', () => {
      const bonuses = CharacterService.calculateStatBonuses(10, { primaryRole: undefined });
      
      expect(bonuses.strength).toBe(2); // floor(10/5)
      expect(bonuses.dexterity).toBe(2);
      expect(bonuses.intelligence).toBe(2);
      expect(bonuses.vitality).toBe(2);
    });

    it('should apply tank specialization bonuses', () => {
      const bonuses = CharacterService.calculateStatBonuses(15, { primaryRole: 'tank' });
      
      expect(bonuses.strength).toBe(8); // floor(15/5) + floor(15/3) = 3 + 5
      expect(bonuses.vitality).toBe(8); // floor(15/5) + floor(15/3) = 3 + 5
      expect(bonuses.dexterity).toBe(3); // base only
      expect(bonuses.intelligence).toBe(3); // base only
    });

    it('should apply healer specialization bonuses', () => {
      const bonuses = CharacterService.calculateStatBonuses(12, { primaryRole: 'healer' });
      
      expect(bonuses.intelligence).toBe(6); // floor(12/5) + floor(12/3) = 2 + 4
      expect(bonuses.vitality).toBe(5); // floor(12/5) + floor(12/4) = 2 + 3
      expect(bonuses.strength).toBe(2); // base only
      expect(bonuses.dexterity).toBe(2); // base only
    });

    it('should apply DPS specialization bonuses', () => {
      const bonuses = CharacterService.calculateStatBonuses(16, { primaryRole: 'dps' });
      
      expect(bonuses.strength).toBe(7); // floor(16/5) + floor(16/4) = 3 + 4
      expect(bonuses.dexterity).toBe(8); // floor(16/5) + floor(16/3) = 3 + 5
      expect(bonuses.intelligence).toBe(3); // base only
      expect(bonuses.vitality).toBe(3); // base only
    });
  });

  describe('createCharacter', () => {
    it('should create character successfully', async () => {
      const mockCharacter = {
        userId: 'test-user-id',
        characterId: 'test-character-id',
        name: 'TestCharacter',
        level: 1,
        experience: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ character: mockCharacter }),
      } as Response);

      const result = await CharacterService.createCharacter({
        userId: 'test-user-id',
        name: 'TestCharacter',
      });

      expect(result).toEqual(mockCharacter);
      expect(mockFetch).toHaveBeenCalledWith('/api/character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-user-id',
          name: 'TestCharacter',
        }),
      });
    });

    it('should throw error if creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Creation failed' }),
      } as Response);

      await expect(CharacterService.createCharacter({
        userId: 'test-user-id',
        name: 'TestCharacter',
      })).rejects.toThrow('Creation failed');
    });
  });

  describe('getCharacter', () => {
    it('should get character successfully', async () => {
      const mockCharacter = {
        userId: 'test-user-id',
        characterId: 'test-character-id',
        name: 'TestCharacter',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ character: mockCharacter }),
      } as Response);

      const result = await CharacterService.getCharacter('test-user-id');

      expect(result).toEqual(mockCharacter);
      expect(mockFetch).toHaveBeenCalledWith('/api/character/test-user-id');
    });

    it('should return null if character not found', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
      } as Response);

      const result = await CharacterService.getCharacter('non-existent-user-id');

      expect(result).toBeNull();
    });

    it('should throw error if request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      } as Response);

      await expect(CharacterService.getCharacter('test-user-id')).rejects.toThrow('Server error');
    });
  });

  describe('addExperience', () => {
    const mockCharacter: Character = {
      userId: 'test-user-id',
      characterId: 'test-character-id',
      name: 'TestCharacter',
      level: 2,
      experience: 150,
      currency: 100,
      stats: {
        strength: 12,
        dexterity: 11,
        intelligence: 13,
        vitality: 10,
        craftingSkills: {} as CraftingSkillSet,
        harvestingSkills: {} as any,
        combatSkills: {} as any,
      },
      specialization: {
        tankProgress: 0,
        healerProgress: 0,
        dpsProgress: 0,
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
    };

    it('should add experience and update level', async () => {
      // Mock getCharacter
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ character: mockCharacter }),
      } as Response);

      // Mock updateCharacter
      const updatedCharacter = { ...mockCharacter, experience: 400, level: 3 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ character: updatedCharacter }),
      } as Response);

      const result = await CharacterService.addExperience('test-user-id', 250);

      expect(result.experience).toBe(400);
      expect(result.level).toBe(3);
    });

    it('should throw error if character not found', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
      } as Response);

      await expect(CharacterService.addExperience('non-existent-user-id', 100))
        .rejects.toThrow('Character not found');
    });
  });

  describe('addSkillExperience', () => {
    const mockCharacter: Character = {
      userId: 'test-user-id',
      characterId: 'test-character-id',
      name: 'TestCharacter',
      level: 2,
      experience: 150,
      currency: 100,
      stats: {
        strength: 12,
        dexterity: 11,
        intelligence: 13,
        vitality: 10,
        craftingSkills: {
          clockmaking: 5,
          engineering: 3,
          alchemy: 7,
          steamcraft: 2,
          level: 2,
          experience: 100,
        },
        harvestingSkills: {} as any,
        combatSkills: {} as any,
      },
      specialization: {
        tankProgress: 0,
        healerProgress: 0,
        dpsProgress: 0,
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
    };

    it('should add skill experience successfully', async () => {
      // Mock getCharacter
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ character: mockCharacter }),
      } as Response);

      // Mock updateCharacter
      const updatedCharacter = { ...mockCharacter };
      updatedCharacter.stats.craftingSkills.clockmaking = 55;
      updatedCharacter.stats.craftingSkills.experience = 150;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ character: updatedCharacter }),
      } as Response);

      const result = await CharacterService.addSkillExperience(
        'test-user-id', 
        'crafting', 
        'clockmaking', 
        50
      );

      expect(result.stats.craftingSkills.clockmaking).toBe(55);
      expect(result.stats.craftingSkills.experience).toBe(150);
    });

    it('should throw error for invalid skill name', async () => {
      // Mock getCharacter
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ character: mockCharacter }),
      } as Response);

      await expect(CharacterService.addSkillExperience(
        'test-user-id', 
        'crafting', 
        'invalidSkill', 
        50
      )).rejects.toThrow('Invalid skill name: invalidSkill');
    });

    it('should throw error if character not found', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
      } as Response);

      await expect(CharacterService.addSkillExperience(
        'non-existent-user-id', 
        'crafting', 
        'clockmaking', 
        50
      )).rejects.toThrow('Character not found');
    });
  });
});