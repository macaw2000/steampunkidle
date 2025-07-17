/**
 * Service for leaderboard operations
 * Handles API calls to leaderboard Lambda functions
 */

import { 
  LeaderboardStatType, 
  Leaderboard, 
  LeaderboardQuery, 
  UserLeaderboardPosition 
} from '../types/leaderboard';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export interface LeaderboardResponse {
  leaderboard: Leaderboard;
  userPosition?: UserLeaderboardPosition | null;
}

export interface UserRankingsResponse {
  userId: string;
  rankings: UserLeaderboardPosition[];
  summary: {
    totalCategories: number;
    averagePercentile: number;
    bestRank: number | null;
    bestCategory: LeaderboardStatType | null;
  };
  lastUpdated: string;
}

/**
 * Get leaderboard data for a specific stat type
 */
export async function getLeaderboard(
  statType: LeaderboardStatType,
  options: {
    limit?: number;
    offset?: number;
    userId?: string;
  } = {}
): Promise<LeaderboardResponse> {
  const { limit = 100, offset = 0, userId } = options;

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (userId) {
    params.append('userId', userId);
  }

  const response = await fetch(
    `${API_BASE_URL}/leaderboard/${statType}?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  
  // Transform date strings back to Date objects
  data.leaderboard.lastRefreshed = new Date(data.leaderboard.lastRefreshed);
  data.leaderboard.entries = data.leaderboard.entries.map((entry: any) => ({
    ...entry,
    lastUpdated: new Date(entry.lastUpdated),
  }));

  return data;
}

/**
 * Get user's rankings across all leaderboards
 */
export async function getUserRankings(userId: string): Promise<UserRankingsResponse> {
  const response = await fetch(`${API_BASE_URL}/leaderboard/user/${userId}/rankings`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Trigger leaderboard recalculation (admin function)
 */
export async function recalculateLeaderboards(): Promise<{ message: string; results: Record<string, number> }> {
  const response = await fetch(`${API_BASE_URL}/leaderboard/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get available leaderboard stat types
 */
export function getAvailableStatTypes(): LeaderboardStatType[] {
  return [
    'level',
    'totalExperience',
    'craftingLevel',
    'harvestingLevel',
    'combatLevel',
    'currency',
    'itemsCreated',
    'zonesCompleted',
    'dungeonsCompleted',
    'guildLevel',
  ];
}

/**
 * Get display name for a stat type
 */
export function getStatTypeDisplayName(statType: LeaderboardStatType): string {
  const displayNames: Record<LeaderboardStatType, string> = {
    level: 'Character Level',
    totalExperience: 'Total Experience',
    craftingLevel: 'Crafting Level',
    harvestingLevel: 'Harvesting Level',
    combatLevel: 'Combat Level',
    currency: 'Steam Coins',
    itemsCreated: 'Items Crafted',
    zonesCompleted: 'Zones Completed',
    dungeonsCompleted: 'Dungeons Completed',
    guildLevel: 'Guild Level',
  };

  return displayNames[statType] || statType;
}

/**
 * Format stat value for display
 */
export function formatStatValue(statType: LeaderboardStatType, value: number): string {
  switch (statType) {
    case 'currency':
      return value.toLocaleString() + ' SC'; // Steam Coins
    case 'totalExperience':
      return value.toLocaleString() + ' XP';
    case 'itemsCreated':
    case 'zonesCompleted':
    case 'dungeonsCompleted':
      return value.toLocaleString();
    default:
      return value.toString();
  }
}

/**
 * Get rank display with appropriate styling class
 */
export function getRankDisplayClass(rank: number): string {
  if (rank === 1) return 'rank-gold';
  if (rank === 2) return 'rank-silver';
  if (rank === 3) return 'rank-bronze';
  if (rank <= 10) return 'rank-top-10';
  if (rank <= 100) return 'rank-top-100';
  return 'rank-default';
}

/**
 * Get percentile display text
 */
export function getPercentileDisplayText(percentile: number): string {
  if (percentile >= 99) return 'Top 1%';
  if (percentile >= 95) return 'Top 5%';
  if (percentile >= 90) return 'Top 10%';
  if (percentile >= 75) return 'Top 25%';
  if (percentile >= 50) return 'Top 50%';
  return `${Math.round(percentile)}th percentile`;
}