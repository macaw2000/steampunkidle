/**
 * Tests for ZoneService
 */

import { ZoneService } from '../zoneService';
import { Party, ZoneInstance, ZoneMonster } from '../../types/zone';
import { Character } from '../../types/character';

// Mock fetch globally
global.fetch = jest.fn();

describe('ZoneService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableZoneTypes', () => {
    it('should return zone types for zone parties', () => {
      const party: Party = {
        partyId: 'test-party',
        leaderId: 'leader-1',
        name: 'Test Party',
        type: 'zone',
        visibility: 'public',
        members: [],
        maxMembers: 3,
        minLevel: 1,
        createdAt: new Date(),
        status: 'forming'
      };

      const zoneTypes = ZoneService.getAvailableZoneTypes(party);
      
      expect(zoneTypes).toEqual(['steam-caverns', 'clockwork-ruins', 'alchemical-gardens']);
    });

    it('should return dungeon types for dungeon parties', () => {
      const party: Party = {
        partyId: 'test-party',
        leaderId: 'leader-1',
        name: 'Test Party',
        type: 'dungeon',
        visibility: 'public',
        members: [],
        maxMembers: 8,
        minLevel: 1,
        createdAt: new Date(),
        status: 'forming'
      };

      const zoneTypes = ZoneService.getAvailableZoneTypes(party);
      
      expect(zoneTypes).toEqual(['gear-fortress', 'steam-cathedral', 'mechanized-depths']);
    });
  });

  describe('calculateDifficulty', () => {
    it('should calculate difficulty based on average level', () => {
      const party: Party = {
        partyId: 'test-party',
        leaderId: 'leader-1',
        name: 'Test Party',
        type: 'zone',
        visibility: 'public',
        members: [
          {
            userId: 'user-1',
            characterName: 'Char1',
            level: 10,
            role: 'tank',
            isReady: true,
            joinedAt: new Date()
          },
          {
            userId: 'user-2',
            characterName: 'Char2',
            level: 20,
            role: 'dps',
            isReady: true,
            joinedAt: new Date()
          }
        ],
        maxMembers: 3,
        minLevel: 1,
        createdAt: new Date(),
        status: 'forming'
      };

      const difficulty = ZoneService.calculateDifficulty(party);
      
      // Average level is 15, so base difficulty should be 2 (15/10 + 1)
      // With 2 members in a 3-max zone, should add 1 for missing member
      expect(difficulty).toBe(3);
    });

    it('should adjust difficulty for party size in zones', () => {
      const party: Party = {
        partyId: 'test-party',
        leaderId: 'leader-1',
        name: 'Test Party',
        type: 'zone',
        visibility: 'public',
        members: [
          {
            userId: 'user-1',
            characterName: 'Char1',
            level: 10,
            role: 'tank',
            isReady: true,
            joinedAt: new Date()
          }
        ],
        maxMembers: 3,
        minLevel: 1,
        createdAt: new Date(),
        status: 'forming'
      };

      const difficulty = ZoneService.calculateDifficulty(party);
      
      // Level 10 = difficulty 2, solo in 3-max zone adds 2 more
      expect(difficulty).toBe(4);
    });

    it('should cap difficulty at 10', () => {
      const party: Party = {
        partyId: 'test-party',
        leaderId: 'leader-1',
        name: 'Test Party',
        type: 'zone',
        visibility: 'public',
        members: [
          {
            userId: 'user-1',
            characterName: 'Char1',
            level: 100,
            role: 'tank',
            isReady: true,
            joinedAt: new Date()
          }
        ],
        maxMembers: 3,
        minLevel: 1,
        createdAt: new Date(),
        status: 'forming'
      };

      const difficulty = ZoneService.calculateDifficulty(party);
      
      expect(difficulty).toBe(10);
    });
  });

  describe('generateMonsters', () => {
    it('should generate appropriate number of monsters', () => {
      const monsters = ZoneService.generateMonsters('steam-caverns', 3, 2);
      
      // Should generate partySize + difficulty/2 monsters
      expect(monsters.length).toBe(3); // 2 + floor(3/2) = 3
    });

    it('should generate monsters with appropriate stats for difficulty', () => {
      const monsters = ZoneService.generateMonsters('steam-caverns', 5, 1);
      
      expect(monsters.length).toBeGreaterThan(0);
      
      const monster = monsters[0];
      expect(monster).toHaveProperty('monsterId');
      expect(monster).toHaveProperty('name');
      expect(monster).toHaveProperty('level');
      expect(monster).toHaveProperty('health');
      expect(monster).toHaveProperty('maxHealth');
      expect(monster).toHaveProperty('stats');
      expect(monster).toHaveProperty('lootTable');
      expect(monster).toHaveProperty('steampunkTheme');
      
      // Higher difficulty should mean higher level
      expect(monster.level).toBeGreaterThan(10);
    });

    it('should generate monsters with steampunk themes', () => {
      const monsters = ZoneService.generateMonsters('clockwork-ruins', 2, 1);
      
      const monster = monsters[0];
      expect(monster.steampunkTheme).toHaveProperty('type');
      expect(monster.steampunkTheme).toHaveProperty('description');
      expect(['mechanical', 'steam', 'clockwork', 'alchemical']).toContain(monster.steampunkTheme.type);
    });
  });

  describe('calculateDamage', () => {
    it('should calculate damage based on attacker stats and monster defense', () => {
      const monster: ZoneMonster = {
        monsterId: 'test-monster',
        name: 'Test Monster',
        level: 10,
        health: 100,
        maxHealth: 100,
        stats: {
          attack: 15,
          defense: 10,
          speed: 12
        },
        lootTable: [],
        steampunkTheme: {
          type: 'mechanical',
          description: 'A test monster'
        }
      };

      const attackerStats = { strength: 20 };
      const damage = ZoneService.calculateDamage(15, attackerStats, monster);
      
      // Base attack (20) + level bonus (15*2=30) = 50
      // Monster defense reduces by 5 (10/2)
      // Final damage should be around 45 with some variance
      expect(damage).toBeGreaterThan(35);
      expect(damage).toBeLessThan(55);
    });

    it('should ensure minimum damage of 1', () => {
      const monster: ZoneMonster = {
        monsterId: 'test-monster',
        name: 'Test Monster',
        level: 10,
        health: 100,
        maxHealth: 100,
        stats: {
          attack: 15,
          defense: 100, // Very high defense
          speed: 12
        },
        lootTable: [],
        steampunkTheme: {
          type: 'mechanical',
          description: 'A test monster'
        }
      };

      const attackerStats = { strength: 1 };
      const damage = ZoneService.calculateDamage(1, attackerStats, monster);
      
      expect(damage).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateCompletionRewards', () => {
    it('should generate experience and currency rewards for all members', () => {
      const rewards = ZoneService.generateCompletionRewards(
        'steam-caverns',
        3,
        ['user-1', 'user-2']
      );

      // Should have at least experience and currency for each member
      const user1Rewards = rewards.filter(r => r.recipientId === 'user-1');
      const user2Rewards = rewards.filter(r => r.recipientId === 'user-2');

      expect(user1Rewards.some(r => r.type === 'experience')).toBe(true);
      expect(user1Rewards.some(r => r.type === 'currency')).toBe(true);
      expect(user2Rewards.some(r => r.type === 'experience')).toBe(true);
      expect(user2Rewards.some(r => r.type === 'currency')).toBe(true);
    });

    it('should scale rewards with difficulty', () => {
      const lowDifficultyRewards = ZoneService.generateCompletionRewards(
        'steam-caverns',
        1,
        ['user-1']
      );
      
      const highDifficultyRewards = ZoneService.generateCompletionRewards(
        'steam-caverns',
        5,
        ['user-1']
      );

      const lowExp = lowDifficultyRewards.find(r => r.type === 'experience')?.amount || 0;
      const highExp = highDifficultyRewards.find(r => r.type === 'experience')?.amount || 0;
      
      expect(highExp).toBeGreaterThan(lowExp);
    });
  });

  describe('API methods', () => {
    it('should start zone instance', async () => {
      const mockInstance: ZoneInstance = {
        instanceId: 'test-instance',
        partyId: 'test-party',
        zoneType: 'steam-caverns',
        difficulty: 3,
        monsters: [],
        rewards: [],
        startedAt: new Date(),
        status: 'active'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ instance: mockInstance })
      });

      const result = await ZoneService.startZoneInstance('test-party');
      
      expect(fetch).toHaveBeenCalledWith('/api/zone/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId: 'test-party' })
      });
      expect(result).toEqual(mockInstance);
    });

    it('should handle API errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Test error' })
      });

      await expect(ZoneService.startZoneInstance('test-party'))
        .rejects.toThrow('Test error');
    });

    it('should get zone instance', async () => {
      const mockInstance: ZoneInstance = {
        instanceId: 'test-instance',
        partyId: 'test-party',
        zoneType: 'steam-caverns',
        difficulty: 3,
        monsters: [],
        rewards: [],
        startedAt: new Date(),
        status: 'active'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ instance: mockInstance })
      });

      const result = await ZoneService.getZoneInstance('test-instance');
      
      expect(fetch).toHaveBeenCalledWith('/api/zone/instance/test-instance');
      expect(result).toEqual(mockInstance);
    });

    it('should return null for non-existent zone instance', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        status: 404,
        ok: false
      });

      const result = await ZoneService.getZoneInstance('non-existent');
      
      expect(result).toBeNull();
    });
  });
});