/**
 * Tests for ActivityService
 */

import { ActivityService } from '../activityService';
import { Character, ActivityType } from '../../types/character';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('ActivityService', () => {
  const mockCharacter: Character = {
    userId: 'test-user-123',
    characterId: 'char-123',
    name: 'Test Character',
    level: 5,
    experience: 2500,
    currency: 100,
    stats: {
      strength: 10,
      dexterity: 12,
      intelligence: 15,
      vitality: 8,
      craftingSkills: {
        clockmaking: 5,
        engineering: 3,
        alchemy: 2,
        steamcraft: 4,
        level: 3,
        experience: 450,
      },
      harvestingSkills: {
        clockmaking: 2,
        engineering: 1,
        alchemy: 0,
        steamcraft: 1,
        level: 2,
        experience: 200,
      },
      combatSkills: {
        clockmaking: 1,
        engineering: 0,
        alchemy: 0,
        steamcraft: 2,
        level: 1,
        experience: 100,
      },
    },
    specialization: {
      tankProgress: 25,
      healerProgress: 10,
      dpsProgress: 15,
      primaryRole: 'tank',
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('switchActivity', () => {
    it('should successfully switch activity', async () => {
      const mockResponse = {
        character: { ...mockCharacter, currentActivity: { type: 'combat', startedAt: new Date(), progress: 0, rewards: [] } },
        message: 'Successfully switched to combat',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await ActivityService.switchActivity('test-user-123', 'combat');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/activity/test-user-123/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityType: 'combat' }),
      });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Character not found' }),
      } as Response);

      await expect(ActivityService.switchActivity('invalid-user', 'combat'))
        .rejects.toThrow('Character not found');
    });
  });

  describe('getActivityProgress', () => {
    it('should fetch activity progress', async () => {
      const mockProgress = {
        activityType: 'crafting' as ActivityType,
        startedAt: new Date(),
        minutesActive: 30,
        progressPercentage: 50,
        potentialRewards: [{ type: 'experience' as const, amount: 300 }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ progress: mockProgress }),
      } as Response);

      const result = await ActivityService.getActivityProgress('test-user-123');

      expect(result).toEqual(mockProgress);
      expect(mockFetch).toHaveBeenCalledWith('/api/activity/test-user-123/progress');
    });

    it('should handle no active activity', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ progress: null }),
      } as Response);

      const result = await ActivityService.getActivityProgress('test-user-123');

      expect(result).toBeNull();
    });
  });

  describe('calculateActivityEfficiency', () => {
    it('should calculate crafting efficiency correctly', () => {
      const efficiency = ActivityService.calculateActivityEfficiency(mockCharacter, 'crafting');
      
      // Base 1 + (crafting level 3 * 0.1) + (intelligence 15 * 0.02) = 1 + 0.3 + 0.3 = 1.6
      expect(efficiency).toBeCloseTo(1.6);
    });

    it('should calculate harvesting efficiency correctly', () => {
      const efficiency = ActivityService.calculateActivityEfficiency(mockCharacter, 'harvesting');
      
      // Base 1 + (harvesting level 2 * 0.1) + (dexterity 12 * 0.02) = 1 + 0.2 + 0.24 = 1.44
      expect(efficiency).toBeCloseTo(1.44);
    });

    it('should calculate combat efficiency correctly', () => {
      const efficiency = ActivityService.calculateActivityEfficiency(mockCharacter, 'combat');
      
      // Base 1 + (combat level 1 * 0.1) + (strength 10 * 0.02) = 1 + 0.1 + 0.2 = 1.3
      expect(efficiency).toBeCloseTo(1.3);
    });

    it('should return 1 for null character', () => {
      const efficiency = ActivityService.calculateActivityEfficiency(null as any, 'crafting');
      expect(efficiency).toBe(1);
    });
  });

  describe('getActivityDisplayInfo', () => {
    it('should return correct info for crafting', () => {
      const info = ActivityService.getActivityDisplayInfo('crafting');
      
      expect(info.name).toBe('Clockwork Crafting');
      expect(info.primaryStat).toBe('Intelligence');
      expect(info.icon).toBe('⚙️');
      expect(info.rewards).toContain('Experience');
    });

    it('should return correct info for harvesting', () => {
      const info = ActivityService.getActivityDisplayInfo('harvesting');
      
      expect(info.name).toBe('Resource Gathering');
      expect(info.primaryStat).toBe('Dexterity');
      expect(info.icon).toBe('⛏️');
    });

    it('should return correct info for combat', () => {
      const info = ActivityService.getActivityDisplayInfo('combat');
      
      expect(info.name).toBe('Automaton Combat');
      expect(info.primaryStat).toBe('Strength');
      expect(info.icon).toBe('⚔️');
    });
  });

  describe('getRecommendedActivity', () => {
    it('should recommend combat for tank specialization', () => {
      const tankCharacter = { ...mockCharacter, specialization: { ...mockCharacter.specialization, primaryRole: 'tank' as const } };
      const recommended = ActivityService.getRecommendedActivity(tankCharacter);
      expect(recommended).toBe('combat');
    });

    it('should recommend crafting for healer specialization', () => {
      const healerCharacter = { ...mockCharacter, specialization: { ...mockCharacter.specialization, primaryRole: 'healer' as const } };
      const recommended = ActivityService.getRecommendedActivity(healerCharacter);
      expect(recommended).toBe('crafting');
    });

    it('should recommend combat for dps specialization', () => {
      const dpsCharacter = { ...mockCharacter, specialization: { ...mockCharacter.specialization, primaryRole: 'dps' as const } };
      const recommended = ActivityService.getRecommendedActivity(dpsCharacter);
      expect(recommended).toBe('combat');
    });

    it('should default to crafting for no specialization', () => {
      const noSpecCharacter = { ...mockCharacter, specialization: { ...mockCharacter.specialization, primaryRole: undefined } };
      const recommended = ActivityService.getRecommendedActivity(noSpecCharacter);
      expect(recommended).toBe('crafting');
    });
  });

  describe('formatActivityDuration', () => {
    it('should format minutes correctly', () => {
      expect(ActivityService.formatActivityDuration(30)).toBe('30m');
      expect(ActivityService.formatActivityDuration(59)).toBe('59m');
    });

    it('should format hours correctly', () => {
      expect(ActivityService.formatActivityDuration(60)).toBe('1h');
      expect(ActivityService.formatActivityDuration(90)).toBe('1h 30m');
      expect(ActivityService.formatActivityDuration(120)).toBe('2h');
    });

    it('should format days correctly', () => {
      expect(ActivityService.formatActivityDuration(1440)).toBe('1d');
      expect(ActivityService.formatActivityDuration(1500)).toBe('1d 1h');
      expect(ActivityService.formatActivityDuration(2880)).toBe('2d');
    });
  });

  describe('calculateNextRewardMilestone', () => {
    it('should calculate next milestone correctly', () => {
      const progress = {
        activityType: 'crafting' as ActivityType,
        startedAt: new Date(),
        minutesActive: 10,
        progressPercentage: 16.67,
        potentialRewards: [{ type: 'experience' as const, amount: 100 }],
      };

      const milestone = ActivityService.calculateNextRewardMilestone(progress);

      expect(milestone.nextMilestoneMinutes).toBe(15);
      expect(milestone.timeRemaining).toBe(5);
      expect(milestone.rewardPreview).toHaveLength(1);
    });

    it('should handle reaching final milestone', () => {
      const progress = {
        activityType: 'crafting' as ActivityType,
        startedAt: new Date(),
        minutesActive: 150,
        progressPercentage: 100,
        potentialRewards: [{ type: 'experience' as const, amount: 1500 }],
      };

      const milestone = ActivityService.calculateNextRewardMilestone(progress);

      expect(milestone.nextMilestoneMinutes).toBe(120); // Last milestone
      expect(milestone.timeRemaining).toBe(0);
    });
  });

  describe('getActivityStatusMessage', () => {
    it('should return message for no activity', () => {
      const message = ActivityService.getActivityStatusMessage(null);
      expect(message).toBe('No active activity. Select an activity to begin earning rewards!');
    });

    it('should return status message for active activity', () => {
      const progress = {
        activityType: 'crafting' as ActivityType,
        startedAt: new Date(),
        minutesActive: 30,
        progressPercentage: 50,
        potentialRewards: [],
      };

      const message = ActivityService.getActivityStatusMessage(progress);
      expect(message).toContain('Clockwork Crafting');
      expect(message).toContain('30m');
      expect(message).toContain('50%');
    });
  });
});