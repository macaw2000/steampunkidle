/**
 * Tests for RealTimeProgressTracker component
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import RealTimeProgressTracker from '../RealTimeProgressTracker';
import gameReducer from '../../../store/slices/gameSlice';
import authReducer from '../../../store/slices/authSlice';
import WebSocketService from '../../../services/websocketService';
import { Character, ActivityType } from '../../../types/character';

// Mock WebSocket service
jest.mock('../../../services/websocketService');
const mockWebSocketService = WebSocketService as jest.Mocked<typeof WebSocketService>;

// Mock character data
const mockCharacter: Character = {
  userId: 'test-user-123',
  characterId: 'char-123',
  name: 'Test Character',
  level: 5,
  experience: 1250,
  currency: 500,
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
      experience: 150
    },
    harvestingSkills: {
      clockmaking: 2,
      engineering: 1,
      alchemy: 0,
      steamcraft: 1,
      level: 1,
      experience: 50
    },
    combatSkills: {
      clockmaking: 1,
      engineering: 0,
      alchemy: 0,
      steamcraft: 2,
      level: 1,
      experience: 25
    }
  },
  specialization: {
    tankProgress: 20,
    healerProgress: 60,
    dpsProgress: 30,
    primaryRole: 'healer',
    bonuses: []
  },
  currentActivity: {
    type: 'crafting' as ActivityType,
    startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    progress: 50,
    rewards: []
  },
  lastActiveAt: new Date(),
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
};

const mockActivityProgress = {
  activityType: 'crafting' as ActivityType,
  startedAt: new Date(Date.now() - 30 * 60 * 1000),
  minutesActive: 30,
  progressPercentage: 50,
  potentialRewards: [
    { type: 'experience' as const, amount: 100 },
    { type: 'currency' as const, amount: 50 }
  ]
};

// Create test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      game: gameReducer,
    },
    preloadedState: {
      auth: { user: null, isAuthenticated: false, loading: false, error: null, tokens: null },
      game: {
        character: mockCharacter,
        activityProgress: mockActivityProgress,
        isOnline: false,
        lastSyncTime: null,
        loading: false,
        error: null,
        activitySwitching: false,
        ...initialState
      }
    }
  });
};

// Mock WebSocket instance
const mockWebSocketInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  isConnected: jest.fn().mockReturnValue(false),
  send: jest.fn(),
  subscribe: jest.fn().mockReturnValue(() => {}),
  onConnectionStatusChange: jest.fn().mockReturnValue(() => {})
};

describe.skip('RealTimeProgressTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebSocketService.getInstance.mockReturnValue(mockWebSocketInstance as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without character', () => {
    const store = createTestStore({ character: null });
    
    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    // Should not render anything when no character
    expect(screen.queryByTestId('real-time-progress-tracker')).not.toBeInTheDocument();
  });

  it('renders connection status indicator', () => {
    const store = createTestStore();
    
    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('connection-status--connecting');
  });

  it('attempts WebSocket connection on mount', async () => {
    const store = createTestStore();
    
    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    await waitFor(() => {
      expect(mockWebSocketInstance.connect).toHaveBeenCalledWith('test-user-123');
    });
  });

  it('displays activity progress information', () => {
    const store = createTestStore();
    
    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    expect(screen.getAllByText('30m')).toHaveLength(3); // Active time appears in three places (milestone too)
    expect(screen.getAllByText(/50/)).toHaveLength(2); // Progress percentage appears in two places
  });

  it('updates progress in real-time', async () => {
    jest.useFakeTimers();
    const store = createTestStore();
    
    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    // Fast-forward time by 1 minute
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(screen.getAllByText('31m')).toHaveLength(2); // Appears in two places
    }, { timeout: 3000 });
  });

  it('handles WebSocket messages', async () => {
    const store = createTestStore();
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    // Simulate progress update message
    act(() => {
      messageHandler!({
        type: 'progress_update',
        data: {
          activityProgress: {
            ...mockActivityProgress,
            minutesActive: 35,
            progressPercentage: 58
          },
          experienceGained: 25
        },
        timestamp: new Date()
      });
    });

    await waitFor(() => {
      // The progress should be updated - look for the new progress value
      expect(screen.getByText('1,275')).toBeInTheDocument(); // Updated experience
    });
  });

  it('displays notifications when received', async () => {
    const store = createTestStore();
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    // Simulate notification message
    act(() => {
      messageHandler!({
        type: 'notification',
        data: {
          id: 'test-notification',
          type: 'progress',
          title: 'Experience Gained',
          message: 'You gained 50 experience!',
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Experience Gained')).toBeInTheDocument();
      expect(screen.getByText('You gained 50 experience!')).toBeInTheDocument();
    });
  });

  it('displays achievement celebrations', async () => {
    const store = createTestStore();
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    // Simulate achievement message
    act(() => {
      messageHandler!({
        type: 'achievement',
        data: {
          id: 'first-craft',
          title: 'First Craft',
          description: 'Craft your first item',
          icon: '🔧',
          rewards: [
            { type: 'experience', amount: 100 },
            { type: 'currency', amount: 25 }
          ]
        },
        timestamp: new Date()
      });
    });

    await waitFor(() => {
      expect(screen.getAllByText('First Craft')).toHaveLength(2); // One in notification, one in achievement
      expect(screen.getByText('Craft your first item')).toBeInTheDocument();
    });
  });

  it('handles connection status changes', async () => {
    const store = createTestStore();
    let statusHandler: (connected: boolean) => void;
    
    mockWebSocketInstance.onConnectionStatusChange.mockImplementation((handler) => {
      statusHandler = handler;
      return () => {};
    });

    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    await waitFor(() => {
      expect(mockWebSocketInstance.onConnectionStatusChange).toHaveBeenCalled();
    });

    // Simulate connection
    act(() => {
      statusHandler!(true);
    });

    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    // Simulate disconnection
    act(() => {
      statusHandler!(false);
    });

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  it('cleans up WebSocket connection on unmount', async () => {
    const store = createTestStore();
    const unsubscribeMock = jest.fn();
    
    mockWebSocketInstance.subscribe.mockReturnValue(unsubscribeMock);
    mockWebSocketInstance.onConnectionStatusChange.mockReturnValue(unsubscribeMock);

    const { unmount } = render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    // Wait for the component to set up subscriptions
    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    unmount();

    // The cleanup happens asynchronously, so we need to wait
    await waitFor(() => {
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  it('displays efficiency information', () => {
    const store = createTestStore();
    
    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    // Should display efficiency percentage (calculated based on character stats)
    expect(screen.getAllByText('Efficiency')).toHaveLength(2); // One in header, one in stats
    expect(screen.getAllByText('160%')).toHaveLength(2); // One in header, one in stats
  });

  it('handles level up messages', async () => {
    const store = createTestStore();
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    // Simulate level up message
    act(() => {
      messageHandler!({
        type: 'level_up',
        data: {
          newLevel: 6,
          experienceGained: 200,
          statsIncreased: { strength: 1, intelligence: 2 }
        },
        timestamp: new Date()
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Level Up!')).toBeInTheDocument();
      expect(screen.getAllByText(/level 6/i)).toHaveLength(2); // One in message, one in details
    });
  });

  it('displays last update timestamp when connected', async () => {
    const store = createTestStore();
    let statusHandler: (connected: boolean) => void;
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.onConnectionStatusChange.mockImplementation((handler) => {
      statusHandler = handler;
      return () => {};
    });
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    render(
      <Provider store={store}>
        <RealTimeProgressTracker />
      </Provider>
    );

    // Wait for handlers to be set up
    await waitFor(() => {
      expect(mockWebSocketInstance.onConnectionStatusChange).toHaveBeenCalled();
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    // Connect
    act(() => {
      statusHandler!(true);
    });

    // Send a message to trigger last update
    act(() => {
      messageHandler!({
        type: 'progress_update',
        data: { activityProgress: mockActivityProgress },
        timestamp: new Date()
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Last update:/)).toBeInTheDocument();
    });
  });
});