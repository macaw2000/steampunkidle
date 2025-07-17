/**
 * Tests for GroupContentHub component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { GroupContentHub } from '../GroupContentHub';
import { PartyService } from '../../../services/partyService';
import authReducer from '../../../store/slices/authSlice';
import gameReducer from '../../../store/slices/gameSlice';
import chatReducer from '../../../store/slices/chatSlice';

// Mock services
jest.mock('../../../services/partyService');
const mockPartyService = PartyService as jest.Mocked<typeof PartyService>;

// Mock child components
jest.mock('../ZoneFinder', () => {
  return function MockZoneFinder({ onCreateParty, onJoinParty }: any) {
    return (
      <div data-testid="zone-finder">
        <button onClick={onCreateParty}>Create Zone Party</button>
        <button onClick={() => onJoinParty({ partyId: 'test-party' })}>Join Party</button>
      </div>
    );
  };
});

jest.mock('../DungeonFinder', () => {
  return function MockDungeonFinder({ onCreateParty, onJoinParty }: any) {
    return (
      <div data-testid="dungeon-finder">
        <button onClick={onCreateParty}>Create Dungeon Party</button>
        <button onClick={() => onJoinParty({ partyId: 'test-party' })}>Join Party</button>
      </div>
    );
  };
});

jest.mock('../PartyManager', () => {
  return function MockPartyManager({ onPartyLeft }: any) {
    return (
      <div data-testid="party-manager">
        <button onClick={onPartyLeft}>Leave Party</button>
      </div>
    );
  };
});

jest.mock('../CreatePartyModal', () => {
  return function MockCreatePartyModal({ onClose, onPartyCreated }: any) {
    return (
      <div data-testid="create-party-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={() => onPartyCreated({ partyId: 'new-party' })}>Create</button>
      </div>
    );
  };
});

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      game: gameReducer,
      chat: chatReducer,
    },
    preloadedState: {
      auth: {
        user: { userId: 'user1', email: 'test@example.com' },
        isAuthenticated: true,
        loading: false,
        error: null,
      },
      game: {
        character: {
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
        },
        activityProgress: null,
        isOnline: true,
        lastSyncTime: Date.now(),
        loading: false,
        error: null,
        activitySwitching: false,
      },
      chat: {
        channels: {},
        activeChannel: 'general',
        privateMessages: {},
        isConnected: false,
        loading: false,
        error: null,
      },
      ...initialState,
    },
  });
};

describe.skip('GroupContentHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPartyService.getUserParty.mockResolvedValue(null);
  });

  it('renders without character', () => {
    const store = createMockStore({
      game: {
        character: null,
        activityProgress: null,
        isOnline: true,
        lastSyncTime: Date.now(),
        loading: false,
        error: null,
        activitySwitching: false,
      },
    });

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    expect(screen.getByText('Character Required')).toBeInTheDocument();
    expect(screen.getByText('You need to create a character before accessing group content.')).toBeInTheDocument();
  });

  it('renders with character and no party', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    expect(screen.getByText('Group Content')).toBeInTheDocument();
    expect(screen.getByText('Zones (1-3 Players)')).toBeInTheDocument();
    expect(screen.getByText('Dungeons (5-8 Players)')).toBeInTheDocument();
    expect(screen.getByTestId('zone-finder')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockPartyService.getUserParty).toHaveBeenCalledWith('user1');
    });
  });

  it('switches between tabs correctly', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    // Initially shows zones
    expect(screen.getByTestId('zone-finder')).toBeInTheDocument();

    // Switch to dungeons
    fireEvent.click(screen.getByText('Dungeons (5-8 Players)'));
    expect(screen.getByTestId('dungeon-finder')).toBeInTheDocument();
    expect(screen.queryByTestId('zone-finder')).not.toBeInTheDocument();
  });

  it('shows party tab when user has a party', async () => {
    const mockParty = {
      partyId: 'party1',
      leaderId: 'user1',
      name: 'Test Party',
      type: 'zone' as const,
      visibility: 'public' as const,
      members: [],
      maxMembers: 3,
      minLevel: 1,
      createdAt: new Date(),
      status: 'forming' as const,
    };

    mockPartyService.getUserParty.mockResolvedValue(mockParty);

    const store = createMockStore();

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('My Party')).toBeInTheDocument();
      expect(screen.getByTestId('party-manager')).toBeInTheDocument();
    });
  });

  it('opens create party modal', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    // Click create party button in zone finder
    fireEvent.click(screen.getByText('Create Zone Party'));

    expect(screen.getByTestId('create-party-modal')).toBeInTheDocument();
  });

  it('handles party creation', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    // Open modal
    fireEvent.click(screen.getByText('Create Zone Party'));

    // Create party
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.queryByTestId('create-party-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('party-manager')).toBeInTheDocument();
    });
  });

  it('handles joining party', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    // Join party from zone finder
    fireEvent.click(screen.getByText('Join Party'));

    await waitFor(() => {
      expect(screen.getByTestId('party-manager')).toBeInTheDocument();
    });
  });

  it('handles leaving party', async () => {
    const mockParty = {
      partyId: 'party1',
      leaderId: 'user1',
      name: 'Test Party',
      type: 'zone' as const,
      visibility: 'public' as const,
      members: [],
      maxMembers: 3,
      minLevel: 1,
      createdAt: new Date(),
      status: 'forming' as const,
    };

    mockPartyService.getUserParty.mockResolvedValue(mockParty);

    const store = createMockStore();

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('party-manager')).toBeInTheDocument();
    });

    // Leave party
    fireEvent.click(screen.getByText('Leave Party'));

    await waitFor(() => {
      expect(screen.queryByTestId('party-manager')).not.toBeInTheDocument();
      expect(screen.getByTestId('zone-finder')).toBeInTheDocument();
    });
  });

  it('displays error messages', async () => {
    mockPartyService.getUserParty.mockRejectedValue(new Error('Network error'));

    const store = createMockStore();

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load party information')).toBeInTheDocument();
    });

    // Dismiss error
    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByText('Failed to load party information')).not.toBeInTheDocument();
  });

  it('shows loading state', async () => {
    // Mock a delayed response
    mockPartyService.getUserParty.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(null), 100))
    );

    const store = createMockStore();

    render(
      <Provider store={store}>
        <GroupContentHub />
      </Provider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });
});