/**
 * User ranking card component
 * Displays current user's position and percentile
 */

import React from 'react';
import { LeaderboardStatType, UserLeaderboardPosition } from '../../types/leaderboard';
import { 
  formatStatValue, 
  getStatTypeDisplayName, 
  getPercentileDisplayText,
  getRankDisplayClass 
} from '../../services/leaderboardService';
import './UserRankingCard.css';

interface UserRankingCardProps {
  userPosition: UserLeaderboardPosition;
  statType: LeaderboardStatType;
}

const UserRankingCard: React.FC<UserRankingCardProps> = ({ 
  userPosition, 
  statType 
}) => {
  const getRankIcon = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 10) return '🏆';
    if (rank <= 100) return '🎖️';
    return '📊';
  };

  const getRankMessage = (rank: number, percentile: number): string => {
    if (rank === 1) return "You're the champion!";
    if (rank <= 3) return "Outstanding performance!";
    if (rank <= 10) return "Excellent ranking!";
    if (percentile >= 90) return "Great job!";
    if (percentile >= 75) return "Good progress!";
    if (percentile >= 50) return "Keep climbing!";
    return "Room for improvement!";
  };

  return (
    <div className={`user-ranking-card ${getRankDisplayClass(userPosition.rank)}`}>
      <div className="ranking-header">
        <div className="rank-icon">
          {getRankIcon(userPosition.rank)}
        </div>
        <div className="ranking-title">
          <h3>Your Ranking</h3>
          <p>{getStatTypeDisplayName(statType)}</p>
        </div>
      </div>

      <div className="ranking-stats">
        <div className="stat-item rank-stat">
          <div className="stat-label">Rank</div>
          <div className="stat-value rank-value">
            #{userPosition.rank.toLocaleString()}
          </div>
        </div>

        <div className="stat-item percentile-stat">
          <div className="stat-label">Percentile</div>
          <div className="stat-value percentile-value">
            {getPercentileDisplayText(userPosition.percentile)}
          </div>
        </div>

        <div className="stat-item value-stat">
          <div className="stat-label">Your Score</div>
          <div className="stat-value score-value">
            {formatStatValue(statType, userPosition.statValue)}
          </div>
        </div>
      </div>

      <div className="ranking-message">
        <span className="message-icon">💬</span>
        <span className="message-text">
          {getRankMessage(userPosition.rank, userPosition.percentile)}
        </span>
      </div>

      <div className="progress-text-container">
        <div className="progress-label">
          Progress to Top 1%: {userPosition.percentile.toFixed(1)}%
        </div>
      </div>
    </div>
  );
};

export default UserRankingCard;