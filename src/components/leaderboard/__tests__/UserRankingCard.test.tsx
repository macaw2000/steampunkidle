/**
 * Tests for UserRankingCard component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import UserRankingCard from '../UserRankingCard';
import { UserLeaderboardPosition } from '../../../types/leaderboard';

// Mock the leaderboard service
jest.mock('../../../services/leaderboardService', () => ({
  formatStatValue: jest.fn((statType, value) => {
    if (statType === 'currency') return `${value} SC`;
    return value.toString();
  }),
  getStatTypeDisplayName: jest.fn((statType) => {
    const names: Record<string, string> = {
      level: 'Character Level',
      currency: 'Steam Coins',
    };
    return names[statType] || statType;
  }),
  getPercentileDisplayText: jest.fn((percentile) => {
    if (percentile >= 99) return 'Top 1%';
    if (percentile >= 95) return 'Top 5%';
    return `${Math.round(percentile)}th percentile`;
  }),
  getRankDisplayClass: jest.fn((rank) => {
    if (rank === 1) return 'rank-gold';
    if (rank === 2) return 'rank-silver';
    if (rank === 3) return 'rank-bronze';
    if (rank <= 10) return 'rank-top-10';
    return 'rank-default';
  }),
}));

describe.skip('UserRankingCard', () => {
  const mockUserPosition: UserLeaderboardPosition = {
    statType: 'level',
    rank: 5,
    statValue: 85,
    percentile: 90,
  };

  it('renders user ranking card with basic info', () => {
    render(<UserRankingCard userPosition={mockUserPosition} statType="level" />);

    expect(screen.getByText('Your Ranking')).toBeInTheDocument();
    expect(screen.getByText('Character Level')).toBeInTheDocument();
  });

  it('displays rank information', () => {
    render(<UserRankingCard userPosition={mockUserPosition} statType="level" />);

    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.getByText('#5')).toBeInTheDocument();
  });

  it('displays percentile information', () => {
    render(<UserRankingCard userPosition={mockUserPosition} statType="level" />);

    expect(screen.getByText('Percentile')).toBeInTheDocument();
    expect(screen.getByText('90th percentile')).toBeInTheDocument();
  });

  it('displays stat value', () => {
    render(<UserRankingCard userPosition={mockUserPosition} statType="level" />);

    expect(screen.getByText('Your Score')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('shows appropriate rank icon for top 10', () => {
    render(<UserRankingCard userPosition={mockUserPosition} statType="level" />);

    expect(screen.getByText('🏆')).toBeInTheDocument();
  });

  it('shows gold medal for rank 1', () => {
    const firstPlacePosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      rank: 1,
      percentile: 100,
    };

    render(<UserRankingCard userPosition={firstPlacePosition} statType="level" />);

    expect(screen.getByText('🥇')).toBeInTheDocument();
  });

  it('shows silver medal for rank 2', () => {
    const secondPlacePosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      rank: 2,
      percentile: 99,
    };

    render(<UserRankingCard userPosition={secondPlacePosition} statType="level" />);

    expect(screen.getByText('🥈')).toBeInTheDocument();
  });

  it('shows bronze medal for rank 3', () => {
    const thirdPlacePosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      rank: 3,
      percentile: 98,
    };

    render(<UserRankingCard userPosition={thirdPlacePosition} statType="level" />);

    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('displays appropriate message for rank 1', () => {
    const championPosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      rank: 1,
      percentile: 100,
    };

    render(<UserRankingCard userPosition={championPosition} statType="level" />);

    expect(screen.getByText("You're the champion!")).toBeInTheDocument();
  });

  it('displays appropriate message for top 3', () => {
    const topThreePosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      rank: 3,
      percentile: 98,
    };

    render(<UserRankingCard userPosition={topThreePosition} statType="level" />);

    expect(screen.getByText('Outstanding performance!')).toBeInTheDocument();
  });

  it('displays appropriate message for top 10', () => {
    render(<UserRankingCard userPosition={mockUserPosition} statType="level" />);

    expect(screen.getByText('Excellent ranking!')).toBeInTheDocument();
  });

  it('displays appropriate message for high percentile', () => {
    const highPercentilePosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      rank: 15,
      percentile: 92,
    };

    render(<UserRankingCard userPosition={highPercentilePosition} statType="level" />);

    expect(screen.getByText('Great job!')).toBeInTheDocument();
  });

  it('formats currency values correctly', () => {
    const currencyPosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      statType: 'currency',
      statValue: 50000,
    };

    render(<UserRankingCard userPosition={currencyPosition} statType="currency" />);

    expect(screen.getByText('50000 SC')).toBeInTheDocument();
    expect(screen.getByText('Steam Coins')).toBeInTheDocument();
  });

  it('displays progress bar with correct percentage', () => {
    const { container } = render(
      <UserRankingCard userPosition={mockUserPosition} statType="level" />
    );

    const progressFill = container.querySelector('.progress-fill');
    expect(progressFill).toHaveStyle('width: 90%');
  });

  it('displays progress text', () => {
    render(<UserRankingCard userPosition={mockUserPosition} statType="level" />);

    expect(screen.getByText('Progress to Top 1%')).toBeInTheDocument();
    expect(screen.getByText('90.0%')).toBeInTheDocument();
  });

  it('applies correct CSS class for rank', () => {
    const { container } = render(
      <UserRankingCard userPosition={mockUserPosition} statType="level" />
    );

    expect(container.querySelector('.rank-top-10')).toBeInTheDocument();
  });

  it('applies gold class for rank 1', () => {
    const firstPlacePosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      rank: 1,
    };

    const { container } = render(
      <UserRankingCard userPosition={firstPlacePosition} statType="level" />
    );

    expect(container.querySelector('.rank-gold')).toBeInTheDocument();
  });

  it('handles very high percentiles correctly', () => {
    const topPercentilePosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      percentile: 99.5,
    };

    render(<UserRankingCard userPosition={topPercentilePosition} statType="level" />);

    expect(screen.getByText('Top 1%')).toBeInTheDocument();
  });

  it('handles lower percentiles correctly', () => {
    const lowerPercentilePosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      rank: 500,
      percentile: 30,
    };

    render(<UserRankingCard userPosition={lowerPercentilePosition} statType="level" />);

    expect(screen.getByText('Room for improvement!')).toBeInTheDocument();
  });

  it('displays all required sections', () => {
    const { container } = render(
      <UserRankingCard userPosition={mockUserPosition} statType="level" />
    );

    expect(container.querySelector('.ranking-header')).toBeInTheDocument();
    expect(container.querySelector('.ranking-stats')).toBeInTheDocument();
    expect(container.querySelector('.ranking-message')).toBeInTheDocument();
    expect(container.querySelector('.progress-bar-container')).toBeInTheDocument();
  });

  it('handles edge case of 100% percentile', () => {
    const perfectPosition: UserLeaderboardPosition = {
      ...mockUserPosition,
      rank: 1,
      percentile: 100,
    };

    const { container } = render(
      <UserRankingCard userPosition={perfectPosition} statType="level" />
    );

    const progressFill = container.querySelector('.progress-fill');
    expect(progressFill).toHaveStyle('width: 100%');
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });
});