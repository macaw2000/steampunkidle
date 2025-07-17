/**
 * Tests for CraftingService
 */

import { CraftingService } from '../craftingService';
import { Character, CraftingSkillType } from '../../types';
import { CRAFTING_RECIPES } from '../../data/craftingRecipes';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('CraftingService', () => {
  const mockCharacter: Character = {
    userId: 'test-user-123',
    characterId: 'char-123',
    name: 'Test Character',
    level: 10,
    experience: 5000,
    currency: 500,
    stats: {
      strength: 15,
      dexterity: 12,
      intelligence: 18,
      vitality: 10,
      craftingSkills: {
        clockmaking: 8,
        engineering: 5,
        alchemy: 3,
        steamcraft: 6,
        level: 6,
        experience: 2000,
      },
      harvestingSkills: {
        mining: 2,
        foraging: 1,
        salvaging: 0,
        crystal_extraction: 1,
        level: 1,
        experience: 50,
      },
      combatSkills: {
        melee: 1,
        ranged: 0,
        defense: 0,
        tactics: 2,
        level: 1,
        experience: 100,
      },
    },
    specialization: {
      tankProgress: 25,
      healerProgress: 10,
      dpsProgress: 15,
      primaryRole: 'tank',
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateSkillLevel', () => {
    it('should calculate skill level correctly', () => {
      expect(CraftingService.calculateSkillLevel(0)).toBe(1);
      expect(CraftingService.calculateSkillLevel(75)).toBe(2);
      expect(CraftingService.calculateSkillLevel(300)).toBe(3);
      expect(CraftingService.calculateSkillLevel(675)).toBe(4);
    });
  });

  describe('calculateExperienceForSkillLevel', () => {
    it('should calculate required experience correctly', () => {
      expect(CraftingService.calculateExperienceForSkillLevel(1)).toBe(0);
      expect(CraftingService.calculateExperienceForSkillLevel(2)).toBe(75);
      expect(CraftingService.calculateExperienceForSkillLevel(3)).toBe(300);
      expect(CraftingService.calculateExperienceForSkillLevel(4)).toBe(675);
    });
  });

  describe('calculateQualityModifier', () => {
    it('should calculate quality modifier based on skill advantage', () => {
      // Skill level equals requirement
      expect(CraftingService.calculateQualityModifier(5, 5)).toBeCloseTo(0.8);
      
      // Skill level exceeds requirement
      expect(CraftingService.calculateQualityModifier(8, 5)).toBeCloseTo(0.95);
      
      // With workstation bonus
      expect(CraftingService.calculateQualityModifier(8, 5, 20)).toBeCloseTo(1.14);
    });

    it('should cap quality modifier at 1.5', () => {
      expect(CraftingService.calculateQualityModifier(20, 1, 50)).toBe(1.5);
    });

    it('should have minimum quality of 0.8', () => {
      expect(CraftingService.calculateQualityModifier(1, 10)).toBe(0.8);
    });
  });

  describe('calculateCraftingTime', () => {
    it('should reduce crafting time based on skill level', () => {
      const baseTime = 100;
      
      // Low skill level
      const time1 = CraftingService.calculateCraftingTime(baseTime, 1);
      expect(time1).toBe(Math.floor(baseTime * 0.98)); // 2% speed bonus
      
      // Higher skill level
      const time2 = CraftingService.calculateCraftingTime(baseTime, 10);
      expect(time2).toBe(Math.floor(baseTime * 0.8)); // 20% speed bonus
    });

    it('should apply workstation speed bonus', () => {
      const baseTime = 100;
      const time = CraftingService.calculateCraftingTime(baseTime, 5, 30);
      expect(time).toBe(Math.floor(baseTime * 0.6)); // 40% total speed bonus
    });

    it('should have minimum crafting time of 5 seconds', () => {
      const time = CraftingService.calculateCraftingTime(10, 50, 90);
      expect(time).toBe(5);
    });
  });

  describe('checkMaterialRequirements', () => {
    it('should return true when player has all materials', () => {
      const recipe = CRAFTING_RECIPES[0]; // Basic Clockwork Gear
      const playerMaterials = {
        'brass-ingot': 5,
        'coal': 3,
      };
      
      const result = CraftingService.checkMaterialRequirements(recipe, playerMaterials);
      expect(result.hasAllMaterials).toBe(true);
      expect(result.missingMaterials).toHaveLength(0);
    });

    it('should return false when player lacks materials', () => {
      const recipe = CRAFTING_RECIPES[0]; // Basic Clockwork Gear
      const playerMaterials = {
        'brass-ingot': 1,
        'coal': 0,
      };
      
      const result = CraftingService.checkMaterialRequirements(recipe, playerMaterials);
      expect(result.hasAllMaterials).toBe(false);
      expect(result.missingMaterials.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableRecipes', () => {
    it('should return recipes the character can craft', () => {
      const availableRecipes = CraftingService.getAvailableRecipes(mockCharacter);
      
      // Should include recipes the character has skill for
      const clockmakingRecipes = availableRecipes.filter(r => r.requiredSkill === 'clockmaking');
      expect(clockmakingRecipes.length).toBeGreaterThan(0);
      
      // Should not include recipes requiring higher skill levels
      const highLevelRecipes = availableRecipes.filter(r => r.requiredLevel > 8);
      expect(highLevelRecipes.length).toBe(0);
    });

    it('should filter recipes by skill level requirements', () => {
      const availableRecipes = CraftingService.getAvailableRecipes(mockCharacter);
      
      availableRecipes.forEach(recipe => {
        const characterSkillLevel = mockCharacter.stats.craftingSkills[recipe.requiredSkill];
        expect(characterSkillLevel).toBeGreaterThanOrEqual(recipe.requiredLevel);
      });
    });
  });

  describe('getUnlockedWorkstations', () => {
    it('should return workstations the character can use', () => {
      const unlockedWorkstations = CraftingService.getUnlockedWorkstations(mockCharacter);
      
      // Should include basic workstations
      expect(unlockedWorkstations.length).toBeGreaterThan(0);
      
      // Should not include workstations requiring higher skills
      unlockedWorkstations.forEach(workstation => {
        workstation.requiredSkills.forEach(requirement => {
          const characterSkillLevel = mockCharacter.stats.craftingSkills[requirement.skill];
          expect(characterSkillLevel).toBeGreaterThanOrEqual(requirement.level);
        });
      });
    });
  });

  describe('startCrafting', () => {
    it('should successfully start crafting', async () => {
      const mockResponse = {
        session: {
          sessionId: 'session-123',
          userId: 'test-user-123',
          recipeId: 'clockwork-gear-basic',
          startedAt: new Date(),
          status: 'in_progress',
          qualityBonus: 1.0,
          experienceEarned: 0,
        },
        estimatedCompletion: new Date(),
        materialsCost: [],
        craftingTime: 30,
        qualityModifier: 1.0,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await CraftingService.startCrafting({
        userId: 'test-user-123',
        recipeId: 'clockwork-gear-basic',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/crafting/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          recipeId: 'clockwork-gear-basic',
        }),
      });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Insufficient materials' }),
      } as Response);

      await expect(CraftingService.startCrafting({
        userId: 'test-user-123',
        recipeId: 'clockwork-gear-basic',
      })).rejects.toThrow('Insufficient materials');
    });
  });

  describe('completeCrafting', () => {
    it('should successfully complete crafting', async () => {
      const mockResponse = {
        session: {
          sessionId: 'session-123',
          userId: 'test-user-123',
          recipeId: 'clockwork-gear-basic',
          startedAt: new Date(),
          completedAt: new Date(),
          status: 'completed',
          qualityBonus: 1.0,
          experienceEarned: 25,
        },
        itemsCreated: [
          {
            itemId: 'clockwork-gear-basic',
            name: 'Basic Clockwork Gear',
            quantity: 1,
            qualityModifier: 1.0,
          },
        ],
        experienceGained: 25,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await CraftingService.completeCrafting({
        userId: 'test-user-123',
        sessionId: 'session-123',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/crafting/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          sessionId: 'session-123',
        }),
      });
    });
  });

  describe('getCraftingSpecializations', () => {
    it('should return specializations for clockmaking', () => {
      const specializations = CraftingService.getCraftingSpecializations('clockmaking', 10);
      
      expect(specializations.length).toBeGreaterThan(0);
      expect(specializations[0].name).toBe('Precision Clockwork');
      expect(specializations[0].isUnlocked).toBe(true); // Level 10 > required level 5
    });

    it('should mark specializations as locked if skill level too low', () => {
      const specializations = CraftingService.getCraftingSpecializations('clockmaking', 3);
      
      const precisionClockwork = specializations.find(s => s.name === 'Precision Clockwork');
      expect(precisionClockwork?.isUnlocked).toBe(false); // Level 3 < required level 5
    });
  });

  describe('getRecipeById', () => {
    it('should return recipe by ID', () => {
      const recipe = CraftingService.getRecipeById('clockwork-gear-basic');
      expect(recipe).toBeTruthy();
      expect(recipe?.name).toBe('Basic Clockwork Gear');
    });

    it('should return null for invalid ID', () => {
      const recipe = CraftingService.getRecipeById('invalid-recipe');
      expect(recipe).toBeNull();
    });
  });

  describe('formatCraftingTime', () => {
    it('should format seconds correctly', () => {
      expect(CraftingService.formatCraftingTime(30)).toBe('30s');
      expect(CraftingService.formatCraftingTime(59)).toBe('59s');
    });

    it('should format minutes correctly', () => {
      expect(CraftingService.formatCraftingTime(60)).toBe('1m');
      expect(CraftingService.formatCraftingTime(90)).toBe('1m 30s');
      expect(CraftingService.formatCraftingTime(120)).toBe('2m');
    });

    it('should format hours correctly', () => {
      expect(CraftingService.formatCraftingTime(3600)).toBe('1h');
      expect(CraftingService.formatCraftingTime(3660)).toBe('1h 1m');
      expect(CraftingService.formatCraftingTime(7200)).toBe('2h');
    });
  });

  describe('getSkillTreeDisplay', () => {
    it('should return display info for all skills', () => {
      const skills: CraftingSkillType[] = ['clockmaking', 'engineering', 'alchemy', 'steamcraft'];
      
      skills.forEach(skill => {
        const display = CraftingService.getSkillTreeDisplay(skill);
        expect(display.name).toBeTruthy();
        expect(display.description).toBeTruthy();
        expect(display.icon).toBeTruthy();
        expect(display.color).toBeTruthy();
      });
    });
  });
});