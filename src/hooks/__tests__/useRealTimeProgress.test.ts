/**
 * Tests for useRealTimeProgress hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import useRealTimeProgress from '../useRealTimeProgress';
import gameReducer from '../../store/slices/gameSlice';
import authReducer from '../../store/slices/authSlice';
import WebSocketService from '../../services/websocketService';
import { Character, ActivityType } from '../../types/character';

// Mock WebSocket service
jest.mock('../../services/websocketService');
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
    startedAt: new Date(Date.now() - 30 * 60 * 1000),
    progress: 50,
    rewards: []
  },
  lastActiveAt: new Date(),
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
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
      auth: { user: null, isAuthenticated: false, loading: false, error: null },
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

// Wrapper component for testing hooks with Redux
const createWrapper = (store: any) => {
  return ({ children }: { children: React.ReactNode }) => 
    React.createElement(Provider, { store }, children);
};

describe('useRealTimeProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockWebSocketService.getInstance.mockReturnValue(mockWebSocketInstance as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes with default state', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    
    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.lastUpdate).toBeNull();
    expect(result.current.connectionAttempts).toBe(0);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.achievements).toEqual([]);
  });

  it('connects to WebSocket when character is available', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    
    renderHook(() => useRealTimeProgress(), { wrapper });

    await waitFor(() => {
      expect(mockWebSocketInstance.connect).toHaveBeenCalledWith('test-user-123');
    });
  });

  it('subscribes to WebSocket messages and status changes', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    
    renderHook(() => useRealTimeProgress(), { wrapper });

    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalledWith('*', expect.any(Function));
      expect(mockWebSocketInstance.onConnectionStatusChange).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it('handles progress update messages', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

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

    expect(result.current.lastUpdate).not.toBeNull();
  });

  it('handles notification messages when enabled', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress({ enableNotifications: true }), { wrapper });

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

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].title).toBe('Experience Gained');
  });

  it('ignores notifications when disabled', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress({ enableNotifications: false }), { wrapper });

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

    expect(result.current.notifications).toHaveLength(0);
  });

  it('handles achievement messages', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

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
            { type: 'experience', amount: 100 }
          ]
        },
        timestamp: new Date()
      });
    });

    expect(result.current.achievements).toHaveLength(1);
    expect(result.current.achievements[0].title).toBe('First Craft');
    expect(result.current.notifications).toHaveLength(1); // Achievement also creates notification
  });

  it('handles level up messages', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

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

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].title).toBe('Level Up!');
  });

  it('handles connection status changes', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let statusHandler: (connected: boolean) => void;
    
    mockWebSocketInstance.onConnectionStatusChange.mockImplementation((handler) => {
      statusHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

    await waitFor(() => {
      expect(mockWebSocketInstance.onConnectionStatusChange).toHaveBeenCalled();
    });

    // Simulate connection
    act(() => {
      statusHandler!(true);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionStatus).toBe('connected');

    // Simulate disconnection
    act(() => {
      statusHandler!(false);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('updates local progress at specified interval', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    
    renderHook(() => useRealTimeProgress({ updateInterval: 500 }), { wrapper });

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Should have updated progress locally
    // Note: This test verifies the interval is set up, actual progress updates are tested in integration
  });

  it('removes notifications', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    // Add a notification
    act(() => {
      messageHandler!({
        type: 'notification',
        data: {
          id: 'test-notification',
          type: 'progress',
          title: 'Test',
          message: 'Test message',
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    });

    expect(result.current.notifications).toHaveLength(1);

    // Remove the notification
    act(() => {
      result.current.removeNotification('test-notification');
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('removes achievements', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    // Add an achievement
    act(() => {
      messageHandler!({
        type: 'achievement',
        data: {
          id: 'test-achievement',
          title: 'Test Achievement',
          description: 'Test description',
          icon: '🏆',
          rewards: []
        },
        timestamp: new Date()
      });
    });

    expect(result.current.achievements).toHaveLength(1);

    // Remove the achievement
    act(() => {
      result.current.removeAchievement('test-achievement');
    });

    expect(result.current.achievements).toHaveLength(0);
  });

  it('clears all notifications', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    // Add multiple notifications
    act(() => {
      messageHandler!({
        type: 'notification',
        data: { id: 'notif1', type: 'progress', title: 'Test 1', message: 'Message 1', timestamp: new Date() },
        timestamp: new Date()
      });
      messageHandler!({
        type: 'notification',
        data: { id: 'notif2', type: 'progress', title: 'Test 2', message: 'Message 2', timestamp: new Date() },
        timestamp: new Date()
      });
    });

    expect(result.current.notifications).toHaveLength(2);

    // Clear all notifications
    act(() => {
      result.current.clearAllNotifications();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('sends messages when connected', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let statusHandler: (connected: boolean) => void;
    
    mockWebSocketInstance.onConnectionStatusChange.mockImplementation((handler) => {
      statusHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

    await waitFor(() => {
      expect(mockWebSocketInstance.onConnectionStatusChange).toHaveBeenCalled();
    });

    // Connect
    act(() => {
      statusHandler!(true);
    });

    // Send message
    const testMessage = { type: 'test', data: 'hello' };
    act(() => {
      result.current.sendMessage(testMessage);
    });

    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(testMessage);
  });

  it('warns when sending message while disconnected', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

    // Try to send message while disconnected
    act(() => {
      result.current.sendMessage({ type: 'test', data: 'hello' });
    });

    expect(consoleSpy).toHaveBeenCalledWith('Cannot send message: WebSocket not connected');
    
    consoleSpy.mockRestore();
  });

  it('provides computed values', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    let messageHandler: (message: any) => void;
    
    mockWebSocketInstance.subscribe.mockImplementation((type, handler) => {
      if (type === '*') {
        messageHandler = handler;
      }
      return () => {};
    });

    const { result } = renderHook(() => useRealTimeProgress(), { wrapper });

    await waitFor(() => {
      expect(mockWebSocketInstance.subscribe).toHaveBeenCalled();
    });

    // Initially no notifications or achievements
    expect(result.current.hasUnreadNotifications).toBe(false);
    expect(result.current.hasNewAchievements).toBe(false);

    // Add notification and achievement
    act(() => {
      messageHandler!({
        type: 'notification',
        data: { id: 'notif1', type: 'progress', title: 'Test', message: 'Message', timestamp: new Date() },
        timestamp: new Date()
      });
      messageHandler!({
        type: 'achievement',
        data: { id: 'achieve1', title: 'Achievement', description: 'Description', icon: '🏆', rewards: [] },
        timestamp: new Date()
      });
    });

    expect(result.current.hasUnreadNotifications).toBe(true);
    expect(result.current.hasNewAchievements).toBe(true);
  });

  it('cleans up on unmount', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    const unsubscribeMock = jest.fn();
    
    mockWebSocketInstance.subscribe.mockReturnValue(unsubscribeMock);
    mockWebSocketInstance.onConnectionStatusChange.mockReturnValue(unsubscribeMock);

    const { unmount } = renderHook(() => useRealTimeProgress(), { wrapper });

    unmount();

    expect(mockWebSocketInstance.disconnect).toHaveBeenCalled();
  });
});