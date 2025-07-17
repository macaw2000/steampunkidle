/**
 * Tests for ZoneFinder component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ZoneFinder from '../ZoneFinder';
import { PartyService } from '../../../services/partyService';
import { Party, PartyRole } from '../../../types/zone';
import { Character } from '../../../types/character';

// Mock services
jest.mock('../../../services/partyService');
const mockPartyService = PartyService as jest.Mocked<typeof PartyService>;

// Mock child components
jest.mock('../PartyCard', () => {
  return function MockPartyCard({ party, onJoin, disabled }: any) {
    return (
      <div data-testid={`party-card-${party.partyId}`}>
        <span>{party.name}</span>
        <button onClick={onJoin} disabled={disabled}>
          Join {party.name}
        </button>
      </div>
    );
  };
});

jest.mock('../PartyFilters', () => {
  return function MockPartyFilters({ filters, onFiltersChange }: any) {
    return (
      <div data-testid="party-filters">
        <button onClick={() => onFiltersChange({ ...filters, minLevel: 5 })}>
          Change Filter
        </button>
      </div>
    );
  };
});

const mockCharacter: Character = {
  userId: 'user1',
  characterId: 'char1',
  name: 'TestChar',
  level: 10,
  experience: 1000,
  currency: 500,
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
      joinedAt: new Date(),
    },
  ],
  maxMembers: 3,
  minLevel: 5,
  maxLevel: 15,
  createdAt: new Date(),
  status: 'forming',
};

describe.skip('ZoneFinder', () => {
  const mockOnCreateParty = jest.fn();
  const mockOnJoinParty = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPartyService.getAvailableParties.mockResolvedValue([mockParty]);
    mockPartyService.getRecommendedRole.mockReturnValue('dps');
    mockPartyService.joinParty.mockResolvedValue(mockParty);
  });

  it('renders zone finder interface', async () => {
    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    expect(screen.getByText('Zone Explorer')).toBeInTheDocument();
    expect(screen.getByText('Explore zones with 1-3 players. Perfect for smaller groups and solo adventurers.')).toBeInTheDocument();
    expect(screen.getByText('Create Zone Party')).toBeInTheDocument();
    expect(screen.getByText('Available Zone Types')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockPartyService.getAvailableParties).toHaveBeenCalledWith('user1', 'zone');
    });
  });

  it('displays zone types', () => {
    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    expect(screen.getByText('Steam Caverns')).toBeInTheDocument();
    expect(screen.getByText('Clockwork Ruins')).toBeInTheDocument();
    expect(screen.getByText('Alchemical Gardens')).toBeInTheDocument();
  });

  it('displays available parties', async () => {
    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('party-card-party1')).toBeInTheDocument();
      expect(screen.getByText('Test Zone Party')).toBeInTheDocument();
    });
  });

  it('handles create party button click', () => {
    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    fireEvent.click(screen.getByText('Create Zone Party'));
    expect(mockOnCreateParty).toHaveBeenCalled();
  });

  it('disables create party when user has current party', () => {
    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={mockParty}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    const createButton = screen.getByText('Create Zone Party');
    expect(createButton).toBeDisabled();
  });

  it('shows current party notice', () => {
    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={mockParty}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    expect(screen.getByText('You are currently in a party. Leave your current party to join another.')).toBeInTheDocument();
  });

  it('handles joining a party', async () => {
    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('party-card-party1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Join Test Zone Party'));

    await waitFor(() => {
      expect(mockPartyService.joinParty).toHaveBeenCalledWith({
        partyId: 'party1',
        userId: 'user1',
        preferredRole: 'dps',
      });
      expect(mockOnJoinParty).toHaveBeenCalledWith(mockParty);
    });
  });

  it('handles refresh button', async () => {
    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockPartyService.getAvailableParties).toHaveBeenCalledTimes(2);
    });
  });

  it('applies filters correctly', async () => {
    const filteredParty = { ...mockParty, minLevel: 15 };
    mockPartyService.getAvailableParties.mockResolvedValue([mockParty, filteredParty]);

    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('party-card-party1')).toBeInTheDocument();
    });

    // Change filter to exclude parties above character level
    fireEvent.click(screen.getByText('Change Filter'));

    // Should still show the party that matches character level
    expect(screen.getByTestId('party-card-party1')).toBeInTheDocument();
  });

  it('shows no parties message when none available', async () => {
    mockPartyService.getAvailableParties.mockResolvedValue([]);

    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No Zone Parties Available')).toBeInTheDocument();
      expect(screen.getByText('There are currently no zone parties matching your criteria.')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockPartyService.getAvailableParties.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 100))
    );

    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    expect(screen.getByText('Loading available parties...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    mockPartyService.getAvailableParties.mockRejectedValue(new Error('Network error'));

    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load available parties')).toBeInTheDocument();
    });

    // Dismiss error
    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByText('Failed to load available parties')).not.toBeInTheDocument();
  });

  it('handles join party error', async () => {
    mockPartyService.joinParty.mockRejectedValue(new Error('Party is full'));

    render(
      <ZoneFinder
        character={mockCharacter}
        currentParty={null}
        onCreateParty={mockOnCreateParty}
        onJoinParty={mockOnJoinParty}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('party-card-party1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Join Test Zone Party'));

    await waitFor(() => {
      expect(screen.getByText('Party is full')).toBeInTheDocument();
    });
  });
});