/**
 * Tests for HarvestingService
 */

import { HarvestingService } from '../harvestingService';
import { Character } from '../../types';
import { HARVESTING_NODES } from '../../data/harvestingData';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('HarvestingService', () => {
  const mockCharacter: Character = {
    userId: 'test-user-123',
    characterId: 'char-123',
    name: 'Test Character',
    level: 10,
    experience: 5000,
    currency: 500,
    stats: {
      strength: 15,
      dexterity: 18,
      intelligence: 12,
      vitality: 10,
      craftingSkills: {
        clockmaking: 5,
        engineering: 3,
        alchemy: 2,
        steamcraft: 4,
        level: 4,
        experience: 800,
      },
      harvestingSkills: {
        mining: 8,
        foraging: 5,
        salvaging: 3,
        crystal_extraction: 1,
        level: 5,
        experience: 1500,
      },
      combatSkills: {
        melee: 6,
        ranged: 4,
        defense: 5,
        tactics: 3,
        level: 4,
        experience: 1000,
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
      type: 'harvesting',
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
      expect(HarvestingService.calculateSkillLevel(0)).toBe(1);
      expect(HarvestingService.calculateSkillLevel(60)).toBe(2);
      expect(HarvestingService.calculateSkillLevel(240)).toBe(3);
      expect(HarvestingService.calculateSkillLevel(540)).toBe(4);
    });
  });

  describe('calculateExperienceForSkillLevel', () => {
    it('should calculate required experience correctly', () => {
      expect(HarvestingService.calculateExperienceForSkillLevel(1)).toBe(0);
      expect(HarvestingService.calculateExperienceForSkillLevel(2)).toBe(60);
      expect(HarvestingService.calculateExperienceForSkillLevel(3)).toBe(240);
      expect(HarvestingService.calculateExperienceForSkillLevel(4)).toBe(540);
    });
  });

  describe('calculateHarvestingTime', () => {
    it('should reduce harvesting time based on skill level', () => {
      const baseTime = 100;
      
      // Skill level equals requirement
      const time1 = HarvestingService.calculateHarvestingTime(baseTime, 5, 5);
      expect(time1).toBe(baseTime);
      
      // Skill level exceeds requirement
      const time2 = HarvestingService.calculateHarvestingTime(baseTime, 8, 5);
      expect(time2).toBe(Math.floor(baseTime * 0.91)); // 9% speed bonus
    });

    it('should have minimum harvesting time of 10 seconds', () => {
      const time = HarvestingService.calculateHarvestingTime(20, 50, 1);
      expect(time).toBe(10);
    });
  });

  describe('calculateResourceYield', () => {
    it('should calculate resource yield with bonuses', () => {
      const baseResources = [
        { resourceId: 'copper-ore', name: 'Copper Ore', quantity: 3, rarity: 'common' as const, dropChance: 1.0 },
        { resourceId: 'rare-ore', name: 'Rare Ore', quantity: 1, rarity: 'rare' as const, dropChance: 0.1 },
      ];

      const yield1 = HarvestingService.calculateResourceYield(baseResources, 5, 5);
      expect(yield1.length).toBeGreaterThanOrEqual(1); // At least common resource should drop
      
      const yield2 = HarvestingService.calculateResourceYield(baseResources, 10, 5);
      expect(yield2.length).toBeGreaterThanOrEqual(1);
      
      // Higher skill level should potentially give more resources
      const commonResource = yield2.find(r => r.resourceId === 'copper-ore');
      if (commonResource) {
        expect(commonResource.quantity).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('getAvailableNodes', () => {
    it('should return nodes the character can harvest', () => {
      const availableNodes = HarvestingService.getAvailableNodes(mockCharacter);
      
      // Should include nodes the character has skill for
      const miningNodes = availableNodes.filter(n => n.requiredSkill === 'mining');
      expect(miningNodes.length).toBeGreaterThan(0);
      
      // Should not include nodes requiring higher skill levels
      availableNodes.forEach(node => {
        const characterSkillLevel = mockCharacter.stats.harvestingSkills[node.requiredSkill];
        expect(characterSkillLevel).toBeGreaterThanOrEqual(node.requiredLevel);
      });
    });
  });

  describe('getAvailableAreas', () => {
    it('should return areas the character can access', () => {
      const availableAreas = HarvestingService.getAvailableAreas(mockCharacter);
      
      expect(availableAreas.length).toBeGreaterThan(0);
      
      availableAreas.forEach(area => {
        expect(mockCharacter.level).toBeGreaterThanOrEqual(area.requiredLevel);
      });
    });
  });

  describe('startHarvesting', () => {
    it('should successfully start harvesting', async () => {
      const mockResponse = {
        session: {
          sessionId: 'session-123',
          userId: 'test-user-123',
          nodeId: 'copper-vein-basic',
          startedAt: new Date(),
          status: 'in_progress',
          resourcesGathered: [],
          experienceEarned: 0,
        },
        estimatedCompletion: new Date(),
        potentialResources: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await HarvestingService.startHarvesting({
        userId: 'test-user-123',
        nodeId: 'copper-vein-basic',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/harvesting/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          nodeId: 'copper-vein-basic',
        }),
      });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Node not available' }),
      } as Response);

      await expect(HarvestingService.startHarvesting({
        userId: 'test-user-123',
        nodeId: 'invalid-node',
      })).rejects.toThrow('Node not available');
    });
  });

  describe('getNodeById', () => {
    it('should return node by ID', () => {
      const node = HarvestingService.getNodeById('copper-vein-basic');
      expect(node).toBeTruthy();
      expect(node?.name).toBe('Copper Ore Vein');
    });

    it('should return null for invalid ID', () => {
      const node = HarvestingService.getNodeById('invalid-node');
      expect(node).toBeNull();
    });
  });

  describe('formatHarvestingTime', () => {
    it('should format seconds correctly', () => {
      expect(HarvestingService.formatHarvestingTime(30)).toBe('30s');
      expect(HarvestingService.formatHarvestingTime(59)).toBe('59s');
    });

    it('should format minutes correctly', () => {
      expect(HarvestingService.formatHarvestingTime(60)).toBe('1m');
      expect(HarvestingService.formatHarvestingTime(90)).toBe('1m 30s');
      expect(HarvestingService.formatHarvestingTime(120)).toBe('2m');
    });

    it('should format hours correctly', () => {
      expect(HarvestingService.formatHarvestingTime(3600)).toBe('1h');
      expect(HarvestingService.formatHarvestingTime(3660)).toBe('1h 1m');
      expect(HarvestingService.formatHarvestingTime(7200)).toBe('2h');
    });
  });

  describe('getSkillDisplay', () => {
    it('should return display info for all skills', () => {
      const skills = ['mining', 'foraging', 'salvaging', 'crystal_extraction'] as const;
      
      skills.forEach(skill => {
        const display = HarvestingService.getSkillDisplay(skill);
        expect(display.name).toBeTruthy();
        expect(display.description).toBeTruthy();
        expect(display.icon).toBeTruthy();
        expect(display.color).toBeTruthy();
      });
    });
  });

  describe('calculateHarvestingEfficiency', () => {
    it('should calculate efficiency based on skill and stats', () => {
      const efficiency = HarvestingService.calculateHarvestingEfficiency(mockCharacter, 'mining');
      
      // Base 1 + (harvesting level 5 * 0.05) + (dexterity 18 * 0.01) = 1 + 0.25 + 0.18 = 1.43
      expect(efficiency).toBeCloseTo(1.43);
    });

    it('should return 1 for null character', () => {
      const efficiency = HarvestingService.calculateHarvestingEfficiency(null as any, 'mining');
      expect(efficiency).toBe(1);
    });
  });

  describe('calculateExperienceGain', () => {
    it('should calculate experience based on node and resources', () => {
      const node = HARVESTING_NODES[0]; // Copper vein
      const resources = [
        { resourceId: 'copper-ore', name: 'Copper Ore', quantity: 3, rarity: 'common' as const, dropChance: 1.0 },
        { resourceId: 'rare-ore', name: 'Rare Ore', quantity: 1, rarity: 'rare' as const, dropChance: 0.1 },
      ];

      const experience = HarvestingService.calculateExperienceGain(node, resources, 5);
      expect(experience).toBeGreaterThan(0);
      
      // Higher skill level should give bonus experience
      const experienceWithBonus = HarvestingService.calculateExperienceGain(node, resources, 10);
      expect(experienceWithBonus).toBeGreaterThan(experience);
    });
  });

  describe('isNodeAvailable', () => {
    it('should return true for nodes without harvest history', () => {
      const available = HarvestingService.isNodeAvailable('copper-vein-basic');
      expect(available).toBe(true);
    });

    it('should return false for nodes on cooldown', () => {
      const recentHarvest = new Date(Date.now() - 60000); // 1 minute ago
      const available = HarvestingService.isNodeAvailable('copper-vein-basic', recentHarvest);
      expect(available).toBe(false);
    });

    it('should return true for nodes past cooldown', () => {
      const oldHarvest = new Date(Date.now() - 600000); // 10 minutes ago
      const available = HarvestingService.isNodeAvailable('copper-vein-basic', oldHarvest);
      expect(available).toBe(true);
    });
  });
});