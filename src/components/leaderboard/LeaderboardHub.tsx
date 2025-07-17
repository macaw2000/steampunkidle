/**
 * Main leaderboard hub component
 * Displays leaderboards with stat filtering and navigation
 */

import React, { useState, useEffect } from 'react';
import { LeaderboardStatType, Leaderboard, UserLeaderboardPosition } from '../../types/leaderboard';
import { 
  getLeaderboard, 
  getAvailableStatTypes, 
  getStatTypeDisplayName 
} from '../../services/leaderboardService';
import LeaderboardTable from './LeaderboardTable';
import StatTypeSelector from './StatTypeSelector';
import UserRankingCard from './UserRankingCard';
import './LeaderboardHub.css';

interface LeaderboardHubProps {
  userId?: string;
}

const LeaderboardHub: React.FC<LeaderboardHubProps> = ({ userId }) => {
  const [selectedStatType, setSelectedStatType] = useState<LeaderboardStatType>('level');
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [userPosition, setUserPosition] = useState<UserLeaderboardPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const pageSize = 50;

  // Load leaderboard data
  const loadLeaderboard = async (statType: LeaderboardStatType, page: number = 0) => {
    setLoading(true);
    setError(null);

    try {
      const response = await getLeaderboard(statType, {
        limit: pageSize,
        offset: page * pageSize,
        userId,
      });

      setLeaderboard(response.leaderboard);
      setUserPosition(response.userPosition || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      console.error('Error loading leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle stat type change
  const handleStatTypeChange = (statType: LeaderboardStatType) => {
    setSelectedStatType(statType);
    setCurrentPage(0);
    loadLeaderboard(statType, 0);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadLeaderboard(selectedStatType, page);
  };

  // Load initial data
  useEffect(() => {
    loadLeaderboard(selectedStatType);
  }, [selectedStatType, userId]);

  // Calculate pagination info
  const totalPages = leaderboard ? Math.ceil(leaderboard.totalEntries / pageSize) : 0;
  const hasNextPage = currentPage < totalPages - 1;
  const hasPrevPage = currentPage > 0;

  return (
    <div className="leaderboard-hub">
      <div className="leaderboard-header">
        <h2>🏆 Leaderboards</h2>
        <p className="leaderboard-subtitle">
          Compete with other players across different stats and achievements
        </p>
      </div>

      {/* User's position card */}
      {userId && userPosition && (
        <UserRankingCard
          userPosition={userPosition}
          statType={selectedStatType}
        />
      )}

      {/* Stat type selector */}
      <StatTypeSelector
        availableStatTypes={getAvailableStatTypes()}
        selectedStatType={selectedStatType}
        onStatTypeChange={handleStatTypeChange}
      />

      {/* Error display */}
      {error && (
        <div className="leaderboard-error">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button 
              className="retry-button"
              onClick={() => loadLeaderboard(selectedStatType, currentPage)}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="leaderboard-loading">
          <div className="loading-spinner"></div>
          <span>Loading leaderboard...</span>
        </div>
      )}

      {/* Leaderboard table */}
      {!loading && !error && leaderboard && (
        <>
          <div className="leaderboard-info">
            <h3>{getStatTypeDisplayName(selectedStatType)} Leaderboard</h3>
            <div className="leaderboard-meta">
              <span className="total-entries">
                {leaderboard.totalEntries.toLocaleString()} players ranked
              </span>
              <span className="last-updated">
                Last updated: {leaderboard.lastRefreshed.toLocaleString()}
              </span>
            </div>
          </div>

          <LeaderboardTable
            leaderboard={leaderboard}
            currentUserId={userId}
            pageOffset={currentPage * pageSize}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="leaderboard-pagination">
              <button
                className="page-button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!hasPrevPage}
              >
                ← Previous
              </button>
              
              <div className="page-info">
                <span className="page-numbers">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <span className="entries-info">
                  Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, leaderboard.totalEntries)} 
                  of {leaderboard.totalEntries.toLocaleString()}
                </span>
              </div>

              <button
                className="page-button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasNextPage}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !error && leaderboard && leaderboard.entries.length === 0 && (
        <div className="leaderboard-empty">
          <div className="empty-content">
            <span className="empty-icon">📊</span>
            <h3>No Rankings Yet</h3>
            <p>Be the first to appear on the {getStatTypeDisplayName(selectedStatType)} leaderboard!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardHub;