/**
 * Tests for LeaderboardHub component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeaderboardHub from '../LeaderboardHub';
import * as leaderboardService from '../../../services/leaderboardService';

// Mock the leaderboard service
jest.mock('../../../services/leaderboardService');
const mockLeaderboardService = leaderboardService as jest.Mocked<typeof leaderboardService>;

// Mock child components
jest.mock('../LeaderboardTable', () => {
  return function MockLeaderboardTable({ leaderboard }: any) {
    return <div data-testid="leaderboard-table">Table with {leaderboard.entries.length} entries</div>;
  };
});

jest.mock('../StatTypeSelector', () => {
  return function MockStatTypeSelector({ selectedStatType, onStatTypeChange }: any) {
    return (
      <div data-testid="stat-type-selector">
        <span>Selected: {selectedStatType}</span>
        <button onClick={() => onStatTypeChange('currency')}>Change to Currency</button>
      </div>
    );
  };
});

jest.mock('../UserRankingCard', () => {
  return function MockUserRankingCard({ userPosition }: any) {
    return <div data-testid="user-ranking-card">Rank: {userPosition.rank}</div>;
  };
});

describe.skip('LeaderboardHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock service functions
    mockLeaderboardService.getAvailableStatTypes.mockReturnValue([
      'level', 'currency', 'craftingLevel'
    ]);
    
    mockLeaderboardService.getStatTypeDisplayName.mockImplementation((statType) => {
      const names: Record<string, string> = {
        level: 'Character Level',
        currency: 'Steam Coins',
        craftingLevel: 'Crafting Level',
      };
      return names[statType] || statType;
    });
  });

  const mockLeaderboard = {
    statType: 'level' as const,
    entries: [
      {
        rank: 1,
        userId: 'user1',
        characterName: 'TopPlayer',
        guildName: 'Elite Guild',
        statValue: 100,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      },
      {
        rank: 2,
        userId: 'user2',
        characterName: 'SecondPlace',
        statValue: 95,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      },
    ],
    totalEntries: 50,
    lastRefreshed: new Date('2024-01-01T12:00:00Z'),
  };

  it('renders leaderboard hub with header', () => {
    mockLeaderboardService.getLeaderboard.mockResolvedValue({
      leaderboard: mockLeaderboard,
    });

    render(<LeaderboardHub />);

    expect(screen.getByText('🏆 Leaderboards')).toBeInTheDocument();
    expect(screen.getByText('Compete with other players across different stats and achievements')).toBeInTheDocument();
  });

  it('loads and displays leaderboard data', async () => {
    mockLeaderboardService.getLeaderboard.mockResolvedValue({
      leaderboard: mockLeaderboard,
    });

    render(<LeaderboardHub />);

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Character Level Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('50 players ranked')).toBeInTheDocument();
  });

  it('displays user position when provided', async () => {
    const userPosition = {
      statType: 'level' as const,
      rank: 5,
      statValue: 85,
      percentile: 90,
    };

    mockLeaderboardService.getLeaderboard.mockResolvedValue({
      leaderboard: mockLeaderboard,
      userPosition,
    });

    render(<LeaderboardHub userId="test-user" />);

    await waitFor(() => {
      expect(screen.getByTestId('user-ranking-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Rank: 5')).toBeInTheDocument();
  });

  it('handles stat type changes', async () => {
    mockLeaderboardService.getLeaderboard.mockResolvedValue({
      leaderboard: mockLeaderboard,
    });

    render(<LeaderboardHub />);

    await waitFor(() => {
      expect(screen.getByTestId('stat-type-selector')).toBeInTheDocument();
    });

    // Change stat type
    fireEvent.click(screen.getByText('Change to Currency'));

    await waitFor(() => {
      expect(mockLeaderboardService.getLeaderboard).toHaveBeenCalledWith(
        'currency',
        expect.objectContaining({
          limit: 50,
          offset: 0,
        })
      );
    });
  });

  it('displays loading state', () => {
    mockLeaderboardService.getLeaderboard.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<LeaderboardHub />);

    expect(screen.getByText('Loading leaderboard...')).toBeInTheDocument();
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument(); // Loading spinner
  });

  it('displays error state', async () => {
    mockLeaderboardService.getLeaderboard.mockRejectedValue(
      new Error('Failed to load leaderboard')
    );

    render(<LeaderboardHub />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load leaderboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('handles retry on error', async () => {
    mockLeaderboardService.getLeaderboard
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ leaderboard: mockLeaderboard });

    render(<LeaderboardHub />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Click retry
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-table')).toBeInTheDocument();
    });
  });

  it('displays empty state when no entries', async () => {
    const emptyLeaderboard = {
      ...mockLeaderboard,
      entries: [],
      totalEntries: 0,
    };

    mockLeaderboardService.getLeaderboard.mockResolvedValue({
      leaderboard: emptyLeaderboard,
    });

    render(<LeaderboardHub />);

    await waitFor(() => {
      expect(screen.getByText('No Rankings Yet')).toBeInTheDocument();
    });

    expect(screen.getByText('Be the first to appear on the Character Level leaderboard!')).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    const largeLeaderboard = {
      ...mockLeaderboard,
      totalEntries: 150,
    };

    mockLeaderboardService.getLeaderboard.mockResolvedValue({
      leaderboard: largeLeaderboard,
    });

    render(<LeaderboardHub />);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    // Click next page
    fireEvent.click(screen.getByText('Next →'));

    await waitFor(() => {
      expect(mockLeaderboardService.getLeaderboard).toHaveBeenCalledWith(
        'level',
        expect.objectContaining({
          offset: 50,
        })
      );
    });
  });

  it('includes userId in requests when provided', async () => {
    mockLeaderboardService.getLeaderboard.mockResolvedValue({
      leaderboard: mockLeaderboard,
    });

    render(<LeaderboardHub userId="test-user" />);

    await waitFor(() => {
      expect(mockLeaderboardService.getLeaderboard).toHaveBeenCalledWith(
        'level',
        expect.objectContaining({
          userId: 'test-user',
        })
      );
    });
  });

  it('displays last updated time', async () => {
    mockLeaderboardService.getLeaderboard.mockResolvedValue({
      leaderboard: mockLeaderboard,
    });

    render(<LeaderboardHub />);

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });
});