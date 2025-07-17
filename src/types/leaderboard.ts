/**
 * Leaderboard type definitions for the Steampunk Idle Game
 */

export type LeaderboardStatType = 
  | 'level' 
  | 'totalExperience' 
  | 'craftingLevel' 
  | 'harvestingLevel' 
  | 'combatLevel'
  | 'guildLevel'
  | 'currency'
  | 'itemsCreated'
  | 'zonesCompleted'
  | 'dungeonsCompleted';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  characterName: string;
  guildName?: string;
  statValue: number;
  lastUpdated: Date;
}

export interface Leaderboard {
  statType: LeaderboardStatType;
  entries: LeaderboardEntry[];
  totalEntries: number;
  lastRefreshed: Date;
}

export interface LeaderboardQuery {
  statType: LeaderboardStatType;
  limit?: number;
  offset?: number;
  userId?: string; // to get user's position
}

export interface UserLeaderboardPosition {
  statType: LeaderboardStatType;
  rank: number;
  statValue: number;
  percentile: number;
}