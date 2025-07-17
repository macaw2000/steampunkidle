/**
 * Tests for PartyManager component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PartyManager from '../PartyManager';
import { PartyService } from '../../../services/partyService';
import { ZoneService } from '../../../services/zoneService';
import { Party, PartyRole, ZoneInstance } from '../../../types/zone';
import { Character } from '../../../types/character';

// Mock services
jest.mock('../../../services/partyService');
jest.mock('../../../services/zoneService');
const mockPartyService = PartyService as jest.Mocked<typeof PartyService>;
const mockZoneService = ZoneService as jest.Mocked<typeof ZoneService>;

// Mock child components
jest.mock('../PartyComposition', () => {
  return function MockPartyComposition({ onKickMember }: any) {
    return (
      <div data-testid="party-composition">
        <button onClick={() => onKickMember('member1')}>Kick Member</button>
      </div>
    );
  };
});

jest.mock('../ZoneInterface', () => {
  return function MockZoneInterface({ onComplete, onLeave }: any) {
    return (
      <div data-testid="zone-interface">
        <button onClick={onComplete}>Complete Zone</button>
        <button onClick={onLeave}>Leave Zone</button>
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
  leaderId: 'user1',
  name: 'Test Zone Party',
  type: 'zone',
  visibility: 'public',
  members: [
    {
      userId: 'user1',
      characterName: 'TestChar',
      level: 10,
      role: 'dps' as PartyRole,
      isReady: true,
      joinedAt: new Date(),
    },
    {
      userId: 'member1',
      characterName: 'Member1',
      level: 8,
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

const mockZoneInstance: ZoneInstance = {
  instanceId: 'zone1',
  partyId: 'party1',
  zoneType: 'steam-caverns',
  difficulty: 2,
  monsters: [],
  rewards: [],
  startedAt: new Date(),
  status: 'active',
};

describe('PartyManager', () => {
  const mockOnPartyUpdate = jest.fn();
  const mockOnPartyLeft = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPartyService.getPartyComposition.mockReturnValue({
      totalMembers: 2,
      maxMembers: 3,
      readyMembers: 2,
      roleDistribution: { tank: 1, healer: 0, dps: 1 },
      allReady: true,
    });
    mockPartyService.validatePartyComposition.mockReturnValue({
      valid: true,
      issues: [],
    });
    mockPartyService.updateMemberRole.mockResolvedValue(mockParty);
    mockPartyService.updateMemberReadiness.mockResolvedValue(mockParty);
    mockPartyService.leaveParty.mockResolvedValue();
    mockPartyService.disbandParty.mockResolvedValue();
    mockPartyService.kickMember.mockResolvedValue(mockParty);
    mockZoneService.startZoneInstance.mockResolvedValue(mockZoneInstance);
  });

  it('renders party manager interface', () => {
    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    expect(screen.getByText('Test Zone Party')).toBeInTheDocument();
    expect(screen.getByText('Zone Party')).toBeInTheDocument();
    expect(screen.getByText('👑 Leader')).toBeInTheDocument();
    expect(screen.getByText('Leave Party')).toBeInTheDocument();
    expect(screen.getByText('Disband Party')).toBeInTheDocument();
  });

  it('shows start zone button when party is ready', () => {
    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    expect(screen.getByText('Start Zone')).toBeInTheDocument();
  });

  it('does not show leader actions for non-leaders', () => {
    const nonLeaderParty = { ...mockParty, leaderId: 'other-user' };

    render(
      <PartyManager
        party={nonLeaderParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    expect(screen.queryByText('👑 Leader')).not.toBeInTheDocument();
    expect(screen.queryByText('Disband Party')).not.toBeInTheDocument();
    expect(screen.queryByText('Start Zone')).not.toBeInTheDocument();
  });

  it('handles role change', async () => {
    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    // Find and click tank role option
    const tankOption = screen.getByLabelText(/tank/i);
    fireEvent.click(tankOption);

    await waitFor(() => {
      expect(mockPartyService.updateMemberRole).toHaveBeenCalledWith(
        'party1',
        'user1',
        'tank'
      );
      expect(mockOnPartyUpdate).toHaveBeenCalledWith(mockParty);
    });
  });

  it('handles readiness toggle', async () => {
    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    // Find and click readiness toggle
    const readinessToggle = screen.getByRole('checkbox');
    fireEvent.click(readinessToggle);

    await waitFor(() => {
      expect(mockPartyService.updateMemberReadiness).toHaveBeenCalledWith(
        'party1',
        'user1',
        false // Should toggle from true to false
      );
      expect(mockOnPartyUpdate).toHaveBeenCalledWith(mockParty);
    });
  });

  it('handles leaving party', async () => {
    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    fireEvent.click(screen.getByText('Leave Party'));

    await waitFor(() => {
      expect(mockPartyService.leaveParty).toHaveBeenCalledWith('party1', 'user1');
      expect(mockOnPartyLeft).toHaveBeenCalled();
    });
  });

  it('handles disbanding party with confirmation', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    fireEvent.click(screen.getByText('Disband Party'));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to disband this party? This action cannot be undone.'
      );
      expect(mockPartyService.disbandParty).toHaveBeenCalledWith('party1', 'user1');
      expect(mockOnPartyLeft).toHaveBeenCalled();
    });

    window.confirm = originalConfirm;
  });

  it('does not disband party when confirmation is cancelled', async () => {
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => false);

    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    fireEvent.click(screen.getByText('Disband Party'));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockPartyService.disbandParty).not.toHaveBeenCalled();
      expect(mockOnPartyLeft).not.toHaveBeenCalled();
    });

    window.confirm = originalConfirm;
  });

  it('handles starting zone', async () => {
    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    fireEvent.click(screen.getByText('Start Zone'));

    await waitFor(() => {
      expect(mockZoneService.startZoneInstance).toHaveBeenCalledWith('party1');
      expect(screen.getByTestId('zone-interface')).toBeInTheDocument();
    });
  });

  it('shows zone interface when zone is active', async () => {
    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    // Start zone
    fireEvent.click(screen.getByText('Start Zone'));

    await waitFor(() => {
      expect(screen.getByTestId('zone-interface')).toBeInTheDocument();
    });

    // Complete zone
    fireEvent.click(screen.getByText('Complete Zone'));
    expect(screen.queryByTestId('zone-interface')).not.toBeInTheDocument();
  });

  it('handles kicking member', async () => {
    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    fireEvent.click(screen.getByText('Kick Member'));

    await waitFor(() => {
      expect(mockPartyService.kickMember).toHaveBeenCalledWith(
        'party1',
        'user1',
        'member1'
      );
      expect(mockOnPartyUpdate).toHaveBeenCalledWith(mockParty);
    });
  });

  it('shows composition warnings when party is invalid', () => {
    mockPartyService.validatePartyComposition.mockReturnValue({
      valid: false,
      issues: ['Party needs at least 1 healer'],
    });

    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    expect(screen.getByText('Party Composition Issues')).toBeInTheDocument();
    expect(screen.getByText('⚠️ Party needs at least 1 healer')).toBeInTheDocument();
  });

  it('shows waiting message when not all members are ready', () => {
    mockPartyService.getPartyComposition.mockReturnValue({
      totalMembers: 2,
      maxMembers: 3,
      readyMembers: 1,
      roleDistribution: { tank: 1, healer: 0, dps: 1 },
      allReady: false,
    });

    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    expect(screen.getByText('Waiting for Members')).toBeInTheDocument();
    expect(screen.getByText('All party members must be ready before you can start the zone.')).toBeInTheDocument();
  });

  it('shows ready message when party is ready', () => {
    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    expect(screen.getByText('Party Ready!')).toBeInTheDocument();
    expect(screen.getByText('All members are ready. You can now start the zone.')).toBeInTheDocument();
  });

  it('handles errors gracefully', async () => {
    mockPartyService.updateMemberRole.mockRejectedValue(new Error('Network error'));

    render(
      <PartyManager
        party={mockParty}
        character={mockCharacter}
        onPartyUpdate={mockOnPartyUpdate}
        onPartyLeft={mockOnPartyLeft}
      />
    );

    const tankOption = screen.getByLabelText(/tank/i);
    fireEvent.click(tankOption);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Dismiss error
    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByText('Network error')).not.toBeInTheDocument();
  });
});