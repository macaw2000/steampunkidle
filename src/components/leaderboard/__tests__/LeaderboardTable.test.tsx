/**
 * Tests for LeaderboardTable component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import LeaderboardTable from '../LeaderboardTable';
import { Leaderboard } from '../../../types/leaderboard';

// Mock the leaderboard service
jest.mock('../../../services/leaderboardService', () => ({
  formatStatValue: jest.fn((statType, value) => {
    if (statType === 'currency') return `${value} SC`;
    return value.toString();
  }),
  getRankDisplayClass: jest.fn((rank) => {
    if (rank === 1) return 'rank-gold';
    if (rank === 2) return 'rank-silver';
    if (rank === 3) return 'rank-bronze';
    return 'rank-default';
  }),
  getStatTypeDisplayName: jest.fn((statType) => {
    const names: Record<string, string> = {
      level: 'Character Level',
      currency: 'Steam Coins',
    };
    return names[statType] || statType;
  }),
}));

describe.skip('LeaderboardTable', () => {
  const mockLeaderboard: Leaderboard = {
    statType: 'level',
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
        guildName: 'Good Guild',
        statValue: 95,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      },
      {
        rank: 3,
        userId: 'user3',
        characterName: 'ThirdPlace',
        statValue: 90,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      },
      {
        rank: 10,
        userId: 'user4',
        characterName: 'NoGuildPlayer',
        statValue: 75,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      },
    ],
    totalEntries: 4,
    lastRefreshed: new Date('2024-01-01T12:00:00Z'),
  };

  it('renders table headers correctly', () => {
    render(<LeaderboardTable leaderboard={mockLeaderboard} />);

    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.getByText('Player')).toBeInTheDocument();
    expect(screen.getByText('Guild')).toBeInTheDocument();
    expect(screen.getByText('Character Level')).toBeInTheDocument();
  });

  it('displays leaderboard entries', () => {
    render(<LeaderboardTable leaderboard={mockLeaderboard} />);

    // Check player names
    expect(screen.getByText('TopPlayer')).toBeInTheDocument();
    expect(screen.getByText('SecondPlace')).toBeInTheDocument();
    expect(screen.getByText('ThirdPlace')).toBeInTheDocument();
    expect(screen.getByText('NoGuildPlayer')).toBeInTheDocument();

    // Check guild names
    expect(screen.getByText('🏛️ Elite Guild')).toBeInTheDocument();
    expect(screen.getByText('🏛️ Good Guild')).toBeInTheDocument();

    // Check stat values
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('displays rank icons for top 3', () => {
    render(<LeaderboardTable leaderboard={mockLeaderboard} />);

    // Check for medal emojis (they should be in the document)
    const goldMedal = screen.getByText('🥇');
    const silverMedal = screen.getByText('🥈');
    const bronzeMedal = screen.getByText('🥉');

    expect(goldMedal).toBeInTheDocument();
    expect(silverMedal).toBeInTheDocument();
    expect(bronzeMedal).toBeInTheDocument();

    // Check for rank number display
    expect(screen.getByText('#10')).toBeInTheDocument();
  });

  it('handles players without guilds', () => {
    render(<LeaderboardTable leaderboard={mockLeaderboard} />);

    // Should show dash for no guild
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('highlights current user', () => {
    render(<LeaderboardTable leaderboard={mockLeaderboard} currentUserId="user2" />);

    // Should show "You" indicator
    expect(screen.getByText('👤 You')).toBeInTheDocument();
  });

  it('applies correct CSS classes for ranks', () => {
    const { container } = render(<LeaderboardTable leaderboard={mockLeaderboard} />);

    // Check for rank-specific classes
    expect(container.querySelector('.rank-gold')).toBeInTheDocument();
    expect(container.querySelector('.rank-silver')).toBeInTheDocument();
    expect(container.querySelector('.rank-bronze')).toBeInTheDocument();
  });

  it('applies current user highlighting', () => {
    const { container } = render(
      <LeaderboardTable leaderboard={mockLeaderboard} currentUserId="user1" />
    );

    expect(container.querySelector('.current-user')).toBeInTheDocument();
  });

  it('formats stat values correctly', () => {
    const currencyLeaderboard: Leaderboard = {
      ...mockLeaderboard,
      statType: 'currency',
    };

    render(<LeaderboardTable leaderboard={currencyLeaderboard} />);

    // Should format currency values
    expect(screen.getByText('100 SC')).toBeInTheDocument();
    expect(screen.getByText('95 SC')).toBeInTheDocument();
  });

  it('handles empty leaderboard', () => {
    const emptyLeaderboard: Leaderboard = {
      ...mockLeaderboard,
      entries: [],
      totalEntries: 0,
    };

    render(<LeaderboardTable leaderboard={emptyLeaderboard} />);

    expect(screen.getByText('No entries found')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
  });

  it('handles page offset correctly', () => {
    render(<LeaderboardTable leaderboard={mockLeaderboard} pageOffset={50} />);

    // Ranks should still display correctly regardless of page offset
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('#10')).toBeInTheDocument();
  });

  it('displays all required table elements', () => {
    const { container } = render(<LeaderboardTable leaderboard={mockLeaderboard} />);

    expect(container.querySelector('.leaderboard-table-container')).toBeInTheDocument();
    expect(container.querySelector('.table-header')).toBeInTheDocument();
    expect(container.querySelector('.table-body')).toBeInTheDocument();
    expect(container.querySelectorAll('.table-row')).toHaveLength(4);
  });

  it('handles long guild names gracefully', () => {
    const longGuildLeaderboard: Leaderboard = {
      ...mockLeaderboard,
      entries: [
        {
          ...mockLeaderboard.entries[0],
          guildName: 'This Is A Very Long Guild Name That Should Be Handled Properly',
        },
      ],
    };

    render(<LeaderboardTable leaderboard={longGuildLeaderboard} />);

    expect(screen.getByText('🏛️ This Is A Very Long Guild Name That Should Be Handled Properly')).toBeInTheDocument();
  });
});