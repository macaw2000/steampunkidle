/**
 * Tests for ActivitySelector component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ActivitySelector from '../ActivitySelector';
import gameReducer from '../../../store/slices/gameSlice';
import authReducer from '../../../store/slices/authSlice';
import { ActivityService } from '../../../services/activityService';
import { Character } from '../../../types/character';

// Mock ActivityService
jest.mock('../../../services/activityService');
const mockActivityService = ActivityService as jest.Mocked<typeof ActivityService>;

const mockCharacter: Character = {
  userId: 'test-user-123',
  characterId: 'char-123',
  name: 'Test Character',
  level: 5,
  experience: 2500,
  currency: 100,
  stats: {
    strength: 10,
    dexterity: 12,
    intelligence: 15,
    vitality: 8,
    craftingSkills: {
      clockmaking: 5,
      engineering: 3,
      alchemy: 2,
      steamcraft: 4,
      level: 3,
      experience: 450,
    },
    harvestingSkills: {
      clockmaking: 2,
      engineering: 1,
      alchemy: 0,
      steamcraft: 1,
      level: 2,
      experience: 200,
    },
    combatSkills: {
      clockmaking: 1,
      engineering: 0,
      alchemy: 0,
      steamcraft: 2,
      level: 1,
      experience: 100,
    },
  },
  specialization: {
    tankProgress: 25,
    healerProgress: 10,
    dpsProgress: 15,
    primaryRole: 'tank',
    bonuses: [],
  },
  currentActivity: {
    type: 'crafting',
    startedAt: new Date(),
    progress: 0,
    rewards: [],
  },
  lastActiveAt: new Date(),
  createdAt: new Date(),
};

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      game: gameReducer,
    },
    preloadedState: {
      auth: { user: null, isAuthenticated: false, loading: false, error: null },
      game: {
        character: mockCharacter,
        activityProgress: null,
        isOnline: true,
        lastSyncTime: null,
        loading: false,
        error: null,
        activitySwitching: false,
        ...initialState,
      },
    },
  });
};

const renderWithStore = (component: React.ReactElement, store = createTestStore()) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe.skip('ActivitySelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock ActivityService methods
    mockActivityService.getActivityDisplayInfo.mockImplementation((activityType) => {
      const activityInfo = {
        crafting: {
          name: 'Clockwork Crafting',
          description: 'Create intricate clockwork devices and steam-powered trinkets',
          icon: '⚙️',
          primaryStat: 'Intelligence',
          rewards: ['Experience', 'Currency', 'Crafted Items'],
          steampunkFlavor: 'Tinker with gears and steam to create mechanical marvels',
        },
        harvesting: {
          name: 'Resource Gathering',
          description: 'Collect steam crystals, copper ore, and rare materials',
          icon: '⛏️',
          primaryStat: 'Dexterity',
          rewards: ['Experience', 'Raw Materials', 'Resources'],
          steampunkFlavor: 'Mine precious metals and harvest steam-infused crystals',
        },
        combat: {
          name: 'Automaton Combat',
          description: 'Battle rogue steam-powered machines and mechanical beasts',
          icon: '⚔️',
          primaryStat: 'Strength',
          rewards: ['Experience', 'Currency', 'Combat Loot'],
          steampunkFlavor: 'Fight against malfunctioning clockwork creatures',
        },
      };
      return activityInfo[activityType];
    });

    mockActivityService.calculateActivityEfficiency.mockImplementation((character, activityType) => {
      switch (activityType) {
        case 'crafting': return 1.6;
        case 'harvesting': return 1.44;
        case 'combat': return 1.3;
        default: return 1;
      }
    });

    mockActivityService.getRecommendedActivity.mockReturnValue('combat');
  });

  it('should render activity selector with all activities', () => {
    renderWithStore(<ActivitySelector />);

    expect(screen.getByText('Choose Your Activity')).toBeInTheDocument();
    expect(screen.getByText('Clockwork Crafting')).toBeInTheDocument();
    expect(screen.getByText('Resource Gathering')).toBeInTheDocument();
    expect(screen.getByText('Automaton Combat')).toBeInTheDocument();
  });

  it('should show current activity as active', () => {
    renderWithStore(<ActivitySelector />);

    const craftingCard = screen.getByText('Clockwork Crafting').closest('.activity-card');
    expect(craftingCard).toHaveClass('activity-card--active');
    expect(screen.getByText('Currently Active')).toBeInTheDocument();
  });

  it('should show recommended activity badge', () => {
    renderWithStore(<ActivitySelector />);

    const combatCard = screen.getByText('Automaton Combat').closest('.activity-card');
    expect(combatCard).toHaveClass('activity-card--recommended');
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('should display activity information correctly', () => {
    renderWithStore(<ActivitySelector />);

    // Check crafting activity details
    expect(screen.getByText('Create intricate clockwork devices and steam-powered trinkets')).toBeInTheDocument();
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('160%')).toBeInTheDocument(); // 1.6 * 100
    expect(screen.getAllByText('Experience')).toHaveLength(3); // Appears in all 3 activities
    expect(screen.getAllByText('Currency')).toHaveLength(2); // Appears in crafting and combat
  });

  it('should handle activity switching', async () => {
    mockActivityService.switchActivity.mockResolvedValue({
      character: { ...mockCharacter, currentActivity: { type: 'combat', startedAt: new Date(), progress: 0, rewards: [] } },
      message: 'Successfully switched to combat',
    });

    renderWithStore(<ActivitySelector />);

    const combatCard = screen.getByText('Automaton Combat').closest('.activity-card');
    fireEvent.click(combatCard!);

    await waitFor(() => {
      expect(mockActivityService.switchActivity).toHaveBeenCalledWith('test-user-123', 'combat');
    });
  });

  it('should not switch to same activity', async () => {
    renderWithStore(<ActivitySelector />);

    const craftingCard = screen.getByText('Clockwork Crafting').closest('.activity-card');
    fireEvent.click(craftingCard!);

    expect(mockActivityService.switchActivity).not.toHaveBeenCalled();
  });

  it('should show loading state during activity switching', () => {
    const store = createTestStore({ activitySwitching: true });
    renderWithStore(<ActivitySelector />, store);

    expect(screen.getAllByTestId('activity-card-spinner')).toHaveLength(3); // All 3 activities show spinner
  });

  it('should handle switching error', async () => {
    mockActivityService.switchActivity.mockRejectedValue(new Error('Network error'));

    renderWithStore(<ActivitySelector />);

    const combatCard = screen.getByText('Automaton Combat').closest('.activity-card');
    fireEvent.click(combatCard!);

    await waitFor(() => {
      expect(mockActivityService.switchActivity).toHaveBeenCalled();
    });

    // Error handling would be reflected in Redux state
  });

  it('should show loading message when no character', () => {
    const store = createTestStore({ character: null });
    renderWithStore(<ActivitySelector />, store);

    expect(screen.getByText('Loading character data...')).toBeInTheDocument();
  });

  it('should display help tip', () => {
    renderWithStore(<ActivitySelector />);

    expect(screen.getByText(/Your character will continue earning rewards/)).toBeInTheDocument();
    expect(screen.getByText(/Higher stats in the activity's primary stat increase efficiency/)).toBeInTheDocument();
  });

  it('should prevent switching when already switching', async () => {
    const store = createTestStore({ activitySwitching: true });
    renderWithStore(<ActivitySelector />, store);

    const combatCard = screen.getByText('Automaton Combat').closest('.activity-card');
    fireEvent.click(combatCard!);

    expect(mockActivityService.switchActivity).not.toHaveBeenCalled();
  });

  it('should display activity rewards correctly', () => {
    renderWithStore(<ActivitySelector />);

    // Check that all reward types are displayed
    expect(screen.getAllByText('Experience')).toHaveLength(3); // Appears in all activities
    expect(screen.getAllByText('Currency')).toHaveLength(2); // Appears in crafting and combat
    expect(screen.getByText('Crafted Items')).toBeInTheDocument();
    expect(screen.getByText('Raw Materials')).toBeInTheDocument();
    expect(screen.getByText('Combat Loot')).toBeInTheDocument();
  });
});