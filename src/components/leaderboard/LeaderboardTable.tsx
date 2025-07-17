/**
 * Leaderboard table component
 * Displays ranked entries with player highlighting
 */

import React from 'react';
import { Leaderboard, LeaderboardEntry } from '../../types/leaderboard';
import { 
  formatStatValue, 
  getRankDisplayClass, 
  getStatTypeDisplayName 
} from '../../services/leaderboardService';
import './LeaderboardTable.css';

interface LeaderboardTableProps {
  leaderboard: Leaderboard;
  currentUserId?: string;
  pageOffset?: number;
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ 
  leaderboard, 
  currentUserId, 
  pageOffset = 0 
}) => {
  const getRankIcon = (rank: number): string => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const isCurrentUser = (entry: LeaderboardEntry): boolean => {
    return currentUserId ? entry.userId === currentUserId : false;
  };

  return (
    <div className="leaderboard-table-container">
      <div className="leaderboard-table">
        <div className="table-header">
          <div className="header-cell rank-header">Rank</div>
          <div className="header-cell player-header">Player</div>
          <div className="header-cell guild-header">Guild</div>
          <div className="header-cell stat-header">
            {getStatTypeDisplayName(leaderboard.statType)}
          </div>
        </div>

        <div className="table-body">
          {leaderboard.entries.map((entry, index) => (
            <div
              key={`${entry.userId}-${entry.rank}`}
              className={`table-row ${getRankDisplayClass(entry.rank)} ${
                isCurrentUser(entry) ? 'current-user' : ''
              }`}
            >
              <div className="table-cell rank-cell">
                <span className="rank-display">
                  {getRankIcon(entry.rank)}
                </span>
                <span className="rank-number">
                  {entry.rank <= 3 ? '' : entry.rank}
                </span>
              </div>

              <div className="table-cell player-cell">
                <div className="player-info">
                  <span className="player-name">
                    {entry.characterName}
                    {isCurrentUser(entry) && (
                      <span className="you-indicator">👤 You</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="table-cell guild-cell">
                {entry.guildName ? (
                  <span className="guild-name">
                    🏛️ {entry.guildName}
                  </span>
                ) : (
                  <span className="no-guild">—</span>
                )}
              </div>

              <div className="table-cell stat-cell">
                <span className="stat-value">
                  {formatStatValue(leaderboard.statType, entry.statValue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {leaderboard.entries.length === 0 && (
        <div className="empty-table">
          <span className="empty-icon">📊</span>
          <span className="empty-message">No entries found</span>
        </div>
      )}
    </div>
  );
};

export default LeaderboardTable;