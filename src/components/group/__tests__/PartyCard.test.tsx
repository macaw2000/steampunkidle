/**
 * Tests for PartyCard component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PartyCard from '../PartyCard';
import { PartyService } from '../../../services/partyService';
import { Party, PartyRole } from '../../../types/zone';
import { Character } from '../../../types/character';

// Mock services
jest.mock('../../../services/partyService');
const mockPartyService = PartyService as jest.Mocked<typeof PartyService>;

const mockCharacter: Character = {
  userId: 'user1',
  characterId: 'char1',
  name: 'TestChar',
  level: 10,
  experience: 1000,
  currency: 500,
  guildId: 'guild1',
  stats: {
    strength: 15,
    dexterity: 12,
    intelligence: 10,
    vitality: 14,
    craftingSkills: {},
    harvestingSkills: {},
    combatSkills: {},
  },
  specialization: {
    tankProgress: 30,
    healerProgress: 20,
    dpsProgress: 50,
  },
  currentActivity: {
    type: 'combat',
    startedAt: new Date(),
  },
  inventory: [],
  lastActiveAt: new Date(),
  createdAt: new Date(),
};

const mockParty: Party = {
  partyId: 'party1',
  leaderId: 'leader1',
  name: 'Test Zone Party',
  type: 'zone',
  visibility: 'public',
  members: [
    {
      userId: 'leader1',
      characterName: 'Leader',
      level: 12,
      role: 'tank' as PartyRole,
      isReady: true,
      joinedAt: new Date(Date.now() - 3600000), // 1 hour ago
    },
    {
      userId: 'member1',
      characterName: 'Member1',
      level: 8,
      role: 'healer' as PartyRole,
      isReady: false,
      joinedAt: new Date(Date.now() - 1800000), // 30 minutes ago
    },
  ],
  maxMembers: 3,
  minLevel: 5,
  maxLevel: 15,
  createdAt: new Date(Date.now() - 7200000), // 2 hours ago
  status: 'forming',
};

describe.skip('PartyCard', () => {
  const mockOnJoin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPartyService.getPartyComposition.mockReturnValue({
      totalMembers: 2,
      maxMembers: 3,
      readyMembers: 1,
      roleDistribution: { tank: 1, healer: 1, dps: 0 },
      allReady: false,
    });
    mockPartyService.validatePartyComposition.mockReturnValue({
      valid: true,
      issues: [],
    });
    mockPartyService.canUserJoinParty.mockReturnValue({
      canJoin: true,
    });
  });

  it('renders party card with basic information', () => {
    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(screen.getByText('Test Zone Party')).toBeInTheDocument();
    expect(screen.getByText('Zone')).toBeInTheDocument();
    expect(screen.getByText('🌐 public')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('Level Range:') && 
             element?.textContent?.includes('5') && 
             element?.textContent?.includes('15');
    })).toBeInTheDocument();
    expect(screen.getByText('Members: 2/3')).toBeInTheDocument();
  });

  it('displays party composition correctly', () => {
    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(screen.getByText('Party Composition')).toBeInTheDocument();
    // Should show role icons for members and empty slots
    const roleIcons = screen.getAllByText('🛡️'); // Tank icon
    expect(roleIcons.length).toBeGreaterThan(0);
  });

  it('displays detailed composition when enabled', () => {
    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
        showDetailedComposition={true}
      />
    );

    expect(screen.getByText('Tanks: 1')).toBeInTheDocument();
    expect(screen.getByText('Healers: 1')).toBeInTheDocument();
    expect(screen.getByText('DPS: 0')).toBeInTheDocument();
  });

  it('shows party members with correct information', () => {
    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(screen.getByText('Leader')).toBeInTheDocument();
    expect(screen.getByText('Lv.12')).toBeInTheDocument();
    expect(screen.getByText('👑')).toBeInTheDocument(); // Leader badge
    expect(screen.getByText('✅')).toBeInTheDocument(); // Ready indicator

    expect(screen.getByText('Member1')).toBeInTheDocument();
    expect(screen.getByText('Lv.8')).toBeInTheDocument();
  });

  it('handles join button click', () => {
    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    fireEvent.click(screen.getByText('Join Party'));
    expect(mockOnJoin).toHaveBeenCalled();
  });

  it('disables join button when disabled prop is true', () => {
    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
        disabled={true}
      />
    );

    const joinButton = screen.getByText('Join Party');
    expect(joinButton).toBeDisabled();
  });

  it('shows cannot join when user cannot join party', () => {
    mockPartyService.canUserJoinParty.mockReturnValue({
      canJoin: false,
      reason: 'Party is full',
    });

    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(screen.getByText('Cannot Join')).toBeInTheDocument();
    expect(screen.getByText('Party is full')).toBeInTheDocument();
  });

  it('displays guild-only indicator', () => {
    const guildParty = { ...mockParty, visibility: 'guild' as const, guildId: 'guild1' };

    render(
      <PartyCard
        party={guildParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(screen.getByText('Guild Only')).toBeInTheDocument();
  });

  it('shows composition warnings when invalid', () => {
    mockPartyService.validatePartyComposition.mockReturnValue({
      valid: false,
      issues: ['Party needs at least 1 tank', 'Party needs at least 1 healer'],
    });

    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
        showDetailedComposition={true}
      />
    );

    expect(screen.getByText('⚠️ Party needs at least 1 tank')).toBeInTheDocument();
    expect(screen.getByText('⚠️ Party needs at least 1 healer')).toBeInTheDocument();
  });

  it('displays ready count when members are ready', () => {
    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(screen.getByText('(1 ready)')).toBeInTheDocument();
  });

  it('formats time ago correctly', () => {
    render(
      <PartyCard
        party={mockParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(screen.getByText('Created 2h ago')).toBeInTheDocument();
  });

  it('applies correct styling for dungeon parties', () => {
    const dungeonParty = { ...mockParty, type: 'dungeon' as const };

    const { container } = render(
      <PartyCard
        party={dungeonParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(container.querySelector('.party-card.dungeon')).toBeInTheDocument();
    expect(screen.getByText('Dungeon')).toBeInTheDocument();
  });

  it('shows private party indicator', () => {
    const privateParty = { ...mockParty, visibility: 'private' as const };

    render(
      <PartyCard
        party={privateParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(screen.getByText('🔒 private')).toBeInTheDocument();
  });

  it('handles level range without max level', () => {
    const noMaxParty = { ...mockParty, maxLevel: undefined };

    render(
      <PartyCard
        party={noMaxParty}
        character={mockCharacter}
        onJoin={mockOnJoin}
      />
    );

    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('Level Range:') && 
             element?.textContent?.includes('5+');
    })).toBeInTheDocument();
  });
});