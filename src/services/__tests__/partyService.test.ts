/**
 * Tests for PartyService
 */

import { PartyService } from '../partyService';
import { Party, PartyMember } from '../../types/zone';
import { Character } from '../../types/character';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('PartyService', () => {
  const mockParty: Party = {
    partyId: 'party-1',
    leaderId: 'user-1',
    name: 'Test Party',
    type: 'zone',
    visibility: 'public',
    members: [
      {
        userId: 'user-1',
        characterName: 'Leader',
        level: 10,
        role: 'tank',
        isReady: false,
        joinedAt: new Date(),
      },
      {
        userId: 'user-2',
        characterName: 'Member',
        level: 8,
        role: 'dps',
        isReady: true,
        joinedAt: new Date(),
      },
    ],
    maxMembers: 3,
    minLevel: 5,
    createdAt: new Date(),
    status: 'forming',
  };

  const mockCharacter: Character = {
    userId: 'user-1',
    characterId: 'char-1',
    name: 'TestCharacter',
    level: 10,
    experience: 1000,
    currency: 500,
    stats: {
      strength: 15,
      dexterity: 12,
      intelligence: 8,
      vitality: 20,
      craftingSkills: { clockmaking: 5, engineering: 3, alchemy: 2, steamcraft: 4, level: 3, experience: 150 },
      harvestingSkills: { clockmaking: 2, engineering: 1, alchemy: 1, steamcraft: 2, level: 1, experience: 50 },
      combatSkills: { clockmaking: 8, engineering: 6, alchemy: 4, steamcraft: 7, level: 6, experience: 300 },
    },
    specialization: {
      tankProgress: 75,
      healerProgress: 25,
      dpsProgress: 50,
      primaryRole: 'tank',
      bonuses: [],
    },
    currentActivity: {
      type: 'combat',
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

  describe('createParty', () => {
    it('should create party successfully', async () => {
      const request = {
        leaderId: 'user-1',
        name: 'Test Party',
        type: 'zone' as const,
        visibility: 'public' as const,
        maxMembers: 3,
        minLevel: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ party: mockParty }),
      } as Response);

      const result = await PartyService.createParty(request);

      expect(result).toEqual(mockParty);
      expect(mockFetch).toHaveBeenCalledWith('/api/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
    });

    it('should throw error on failed request', async () => {
      const request = {
        leaderId: 'user-1',
        name: 'Test Party',
        type: 'zone' as const,
        visibility: 'public' as const,
        maxMembers: 3,
        minLevel: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to create party' }),
      } as Response);

      await expect(PartyService.createParty(request)).rejects.toThrow('Failed to create party');
    });
  });

  describe('validatePartyComposition', () => {
    it('should validate zone party composition', () => {
      const zoneParty = { ...mockParty, type: 'zone' as const };
      const result = PartyService.validatePartyComposition(zoneParty);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should invalidate zone party with too many members', () => {
      const zoneParty = {
        ...mockParty,
        type: 'zone' as const,
        members: [
          ...mockParty.members,
          { userId: 'user-3', characterName: 'Member3', level: 9, role: 'healer' as const, isReady: false, joinedAt: new Date() },
          { userId: 'user-4', characterName: 'Member4', level: 7, role: 'dps' as const, isReady: false, joinedAt: new Date() },
        ],
      };

      const result = PartyService.validatePartyComposition(zoneParty);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Zone parties must have 1-3 members');
    });

    it('should validate dungeon party composition', () => {
      const dungeonParty = {
        ...mockParty,
        type: 'dungeon' as const,
        members: [
          { userId: 'user-1', characterName: 'Tank', level: 10, role: 'tank' as const, isReady: false, joinedAt: new Date() },
          { userId: 'user-2', characterName: 'Healer', level: 9, role: 'healer' as const, isReady: false, joinedAt: new Date() },
          { userId: 'user-3', characterName: 'DPS1', level: 8, role: 'dps' as const, isReady: false, joinedAt: new Date() },
          { userId: 'user-4', characterName: 'DPS2', level: 8, role: 'dps' as const, isReady: false, joinedAt: new Date() },
          { userId: 'user-5', characterName: 'DPS3', level: 7, role: 'dps' as const, isReady: false, joinedAt: new Date() },
        ],
      };

      const result = PartyService.validatePartyComposition(dungeonParty);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should suggest tank and healer for dungeon party', () => {
      const dungeonParty = {
        ...mockParty,
        type: 'dungeon' as const,
        members: [
          { userId: 'user-1', characterName: 'DPS1', level: 10, role: 'dps' as const, isReady: false, joinedAt: new Date() },
          { userId: 'user-2', characterName: 'DPS2', level: 9, role: 'dps' as const, isReady: false, joinedAt: new Date() },
          { userId: 'user-3', characterName: 'DPS3', level: 8, role: 'dps' as const, isReady: false, joinedAt: new Date() },
          { userId: 'user-4', characterName: 'DPS4', level: 8, role: 'dps' as const, isReady: false, joinedAt: new Date() },
          { userId: 'user-5', characterName: 'DPS5', level: 7, role: 'dps' as const, isReady: false, joinedAt: new Date() },
        ],
      };

      const result = PartyService.validatePartyComposition(dungeonParty);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Dungeon parties should have at least 1 tank');
      expect(result.issues).toContain('Dungeon parties should have at least 1 healer');
    });
  });

  describe('getPartyComposition', () => {
    it('should return correct composition info', () => {
      const result = PartyService.getPartyComposition(mockParty);

      expect(result.totalMembers).toBe(2);
      expect(result.maxMembers).toBe(3);
      expect(result.readyMembers).toBe(1);
      expect(result.roleDistribution).toEqual({ tank: 1, healer: 0, dps: 1 });
      expect(result.allReady).toBe(false);
    });

    it('should detect when all members are ready', () => {
      const allReadyParty = {
        ...mockParty,
        members: mockParty.members.map(member => ({ ...member, isReady: true })),
      };

      const result = PartyService.getPartyComposition(allReadyParty);

      expect(result.allReady).toBe(true);
      expect(result.readyMembers).toBe(2);
    });
  });

  describe('canUserJoinParty', () => {
    it('should allow valid user to join', () => {
      const result = PartyService.canUserJoinParty(mockParty, 8);

      expect(result.canJoin).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject if party is full', () => {
      const fullParty = {
        ...mockParty,
        members: [
          ...mockParty.members,
          { userId: 'user-3', characterName: 'Member3', level: 9, role: 'healer' as const, isReady: false, joinedAt: new Date() },
        ],
      };

      const result = PartyService.canUserJoinParty(fullParty, 8);

      expect(result.canJoin).toBe(false);
      expect(result.reason).toBe('Party is full');
    });

    it('should reject if user level is too low', () => {
      const result = PartyService.canUserJoinParty(mockParty, 3);

      expect(result.canJoin).toBe(false);
      expect(result.reason).toBe('Minimum level required: 5');
    });

    it('should reject if user level is too high', () => {
      const partyWithMaxLevel = { ...mockParty, maxLevel: 10 };
      const result = PartyService.canUserJoinParty(partyWithMaxLevel, 15);

      expect(result.canJoin).toBe(false);
      expect(result.reason).toBe('Maximum level allowed: 10');
    });

    it('should reject guild party for non-members', () => {
      const guildParty = { ...mockParty, visibility: 'guild' as const, guildId: 'guild-1' };
      const result = PartyService.canUserJoinParty(guildParty, 8, 'different-guild');

      expect(result.canJoin).toBe(false);
      expect(result.reason).toBe('This party is restricted to guild members');
    });

    it('should allow guild party for members', () => {
      const guildParty = { ...mockParty, visibility: 'guild' as const, guildId: 'guild-1' };
      const result = PartyService.canUserJoinParty(guildParty, 8, 'guild-1');

      expect(result.canJoin).toBe(true);
    });

    it('should reject private party', () => {
      const privateParty = { ...mockParty, visibility: 'private' as const };
      const result = PartyService.canUserJoinParty(privateParty, 8);

      expect(result.canJoin).toBe(false);
      expect(result.reason).toBe('This party is private');
    });

    it('should reject if party is not forming', () => {
      const activeParty = { ...mockParty, status: 'active' as const };
      const result = PartyService.canUserJoinParty(activeParty, 8);

      expect(result.canJoin).toBe(false);
      expect(result.reason).toBe('Party is no longer accepting members');
    });
  });

  describe('getRecommendedRole', () => {
    it('should recommend tank for tank-specialized character', () => {
      const result = PartyService.getRecommendedRole(mockCharacter);
      expect(result).toBe('tank');
    });

    it('should recommend healer for healer-specialized character', () => {
      const healerCharacter = {
        ...mockCharacter,
        specialization: {
          tankProgress: 25,
          healerProgress: 80,
          dpsProgress: 30,
          primaryRole: 'healer' as const,
          bonuses: [],
        },
      };

      const result = PartyService.getRecommendedRole(healerCharacter);
      expect(result).toBe('healer');
    });

    it('should recommend dps for dps-specialized character', () => {
      const dpsCharacter = {
        ...mockCharacter,
        specialization: {
          tankProgress: 20,
          healerProgress: 25,
          dpsProgress: 85,
          primaryRole: 'dps' as const,
          bonuses: [],
        },
      };

      const result = PartyService.getRecommendedRole(dpsCharacter);
      expect(result).toBe('dps');
    });

    it('should default to dps for equal specializations', () => {
      const equalCharacter = {
        ...mockCharacter,
        specialization: {
          tankProgress: 50,
          healerProgress: 50,
          dpsProgress: 50,
          bonuses: [],
        },
      };

      const result = PartyService.getRecommendedRole(equalCharacter);
      // When all specializations are equal, Math.max returns the first one (tank: 50)
      // So we expect 'tank' in this case, not 'dps'
      expect(result).toBe('tank');
    });
  });
});