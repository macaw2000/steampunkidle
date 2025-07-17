/**
 * Tests for leaderboard service
 */

import * as leaderboardService from '../leaderboardService';
import { LeaderboardStatType } from '../../types/leaderboard';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('leaderboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');
  });

  describe('getLeaderboard', () => {
    it('should fetch leaderboard data successfully', async () => {
      const mockResponse = {
        leaderboard: {
          statType: 'level',
          entries: [
            {
              rank: 1,
              userId: 'user1',
              characterName: 'TopPlayer',
              guildName: 'Elite Guild',
              statValue: 100,
              lastUpdated: '2024-01-01T12:00:00.000Z',
            },
          ],
          totalEntries: 1,
          lastRefreshed: '2024-01-01T12:00:00.000Z',
        },
        userPosition: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await leaderboardService.getLeaderboard('level');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/leaderboard/level?limit=100&offset=0',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          },
        }
      );

      expect(result.leaderboard.statType).toBe('level');
      expect(result.leaderboard.entries).toHaveLength(1);
      expect(result.leaderboard.lastRefreshed).toBeInstanceOf(Date);
      expect(result.leaderboard.entries[0].lastUpdated).toBeInstanceOf(Date);
    });

    it('should include userId in query when provided', async () => {
      const mockResponse = {
        leaderboard: {
          statType: 'level',
          entries: [],
          totalEntries: 0,
          lastRefreshed: '2024-01-01T12:00:00.000Z',
        },
        userPosition: {
          statType: 'level',
          rank: 5,
          statValue: 85,
          percentile: 95,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await leaderboardService.getLeaderboard('level', { userId: 'user123' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/leaderboard/level?limit=100&offset=0&userId=user123',
        expect.any(Object)
      );
    });

    it('should handle custom limit and offset', async () => {
      const mockResponse = {
        leaderboard: {
          statType: 'currency',
          entries: [],
          totalEntries: 0,
          lastRefreshed: '2024-01-01T12:00:00.000Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await leaderboardService.getLeaderboard('currency', { limit: 50, offset: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/leaderboard/currency?limit=50&offset=10',
        expect.any(Object)
      );
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid stat type' }),
      } as Response);

      await expect(leaderboardService.getLeaderboard('level')).rejects.toThrow('Invalid stat type');
    });

    it('should handle network errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Network error'); },
      } as Response);

      await expect(leaderboardService.getLeaderboard('level')).rejects.toThrow('Network error');
    });
  });

  describe('getUserRankings', () => {
    it('should fetch user rankings successfully', async () => {
      const mockResponse = {
        userId: 'user123',
        rankings: [
          {
            statType: 'level',
            rank: 5,
            statValue: 85,
            percentile: 95,
          },
          {
            statType: 'currency',
            rank: 10,
            statValue: 50000,
            percentile: 90,
          },
        ],
        summary: {
          totalCategories: 2,
          averagePercentile: 92.5,
          bestRank: 5,
          bestCategory: 'level',
        },
        lastUpdated: '2024-01-01T12:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await leaderboardService.getUserRankings('user123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/leaderboard/user/user123/rankings',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          },
        }
      );

      expect(result.userId).toBe('user123');
      expect(result.rankings).toHaveLength(2);
      expect(result.summary.bestRank).toBe(5);
    });
  });

  describe('recalculateLeaderboards', () => {
    it('should trigger recalculation successfully', async () => {
      const mockResponse = {
        message: 'Leaderboards updated successfully',
        results: {
          level: 100,
          currency: 95,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await leaderboardService.recalculateLeaderboards();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/leaderboard/calculate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          },
        }
      );

      expect(result.message).toBe('Leaderboards updated successfully');
      expect(result.results).toBeDefined();
    });
  });

  describe('utility functions', () => {
    it('should return available stat types', () => {
      const statTypes = leaderboardService.getAvailableStatTypes();
      
      expect(statTypes).toContain('level');
      expect(statTypes).toContain('currency');
      expect(statTypes).toContain('craftingLevel');
      expect(statTypes).toHaveLength(10);
    });

    it('should return display names for stat types', () => {
      expect(leaderboardService.getStatTypeDisplayName('level')).toBe('Character Level');
      expect(leaderboardService.getStatTypeDisplayName('currency')).toBe('Steam Coins');
      expect(leaderboardService.getStatTypeDisplayName('craftingLevel')).toBe('Crafting Level');
    });

    it('should format stat values correctly', () => {
      expect(leaderboardService.formatStatValue('currency', 10000)).toBe('10,000 SC');
      expect(leaderboardService.formatStatValue('totalExperience', 50000)).toBe('50,000 XP');
      expect(leaderboardService.formatStatValue('level', 50)).toBe('50');
      expect(leaderboardService.formatStatValue('itemsCreated', 1234)).toBe('1,234');
    });

    it('should return correct rank display classes', () => {
      expect(leaderboardService.getRankDisplayClass(1)).toBe('rank-gold');
      expect(leaderboardService.getRankDisplayClass(2)).toBe('rank-silver');
      expect(leaderboardService.getRankDisplayClass(3)).toBe('rank-bronze');
      expect(leaderboardService.getRankDisplayClass(5)).toBe('rank-top-10');
      expect(leaderboardService.getRankDisplayClass(50)).toBe('rank-top-100');
      expect(leaderboardService.getRankDisplayClass(150)).toBe('rank-default');
    });

    it('should return correct percentile display text', () => {
      expect(leaderboardService.getPercentileDisplayText(99.5)).toBe('Top 1%');
      expect(leaderboardService.getPercentileDisplayText(96)).toBe('Top 5%');
      expect(leaderboardService.getPercentileDisplayText(92)).toBe('Top 10%');
      expect(leaderboardService.getPercentileDisplayText(80)).toBe('Top 25%');
      expect(leaderboardService.getPercentileDisplayText(60)).toBe('Top 50%');
      expect(leaderboardService.getPercentileDisplayText(30)).toBe('30th percentile');
    });
  });
});