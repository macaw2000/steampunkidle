/**
 * Tests for mandatory character creation flow in GameDashboard
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import GameDashboard from '../GameDashboard';
import authSlice from '../../store/slices/authSlice';
import gameSlice from '../../store/slices/gameSlice';
import chatSlice from '../../store/slices/chatSlice';

// Mock all the complex components
jest.mock('../auth/LoginComponent', () => {
  return function MockLoginComponent() {
    return <div data-testid="login-component">Login Component</div>;
  };
});

jest.mock('../character/CharacterCreation', () => {
  return function MockCharacterCreation() {
    return <div data-testid="character-creation">Character Creation</div>;
  };
});

jest.mock('../layout/ResponsiveLayout', () => {
  return function MockResponsiveLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="responsive-layout">{children}</div>;
  };
});

jest.mock('../taskQueue/TaskQueueContainer', () => {
  return function MockTaskQueueContainer() {
    return <div data-testid="task-queue">Task Queue</div>;
  };
});

jest.mock('../chat/ResponsiveChatInterface', () => {
  return function MockResponsiveChatInterface() {
    return <div data-testid="chat-interface">Chat Interface</div>;
  };
});

jest.mock('../common/FeatureModal', () => {
  return function MockFeatureModal({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) {
    return isOpen ? <div data-testid="feature-modal">{children}</div> : null;
  };
});

jest.mock('../harvesting/HarvestingRewards', () => {
  return function MockHarvestingRewards() {
    return <div data-testid="harvesting-rewards">Harvesting Rewards</div>;
  };
});

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
      game: gameSlice,
      chat: chatSlice,
    },
    preloadedState: {
      auth: {
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null,
      },
      game: {
        character: null,
        hasCharacter: null,
        characterLoading: false,
        loading: false,
        error: null,
        isOnline: true,
        currentActivity: null,
        inventory: [],
        currency: 0,
        notifications: [],
      },
      chat: {
        messages: [],
        activeChannel: 'general',
        isConnected: false,
        error: null,
      },
      ...initialState,
    },
  });
};

describe('GameDashboard - Character Creation Flow', () => {
  it('shows login component when user is not authenticated', () => {
    const store = createMockStore({
      auth: {
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null,
      },
    });

    render(
      <Provider store={store}>
        <GameDashboard />
      </Provider>
    );

    expect(screen.getByTestId('login-component')).toBeInTheDocument();
    expect(screen.queryByTestId('character-creation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-layout')).not.toBeInTheDocument();
  });

  it('shows loading screen while checking for character', () => {
    const store = createMockStore({
      auth: {
        isAuthenticated: true,
        user: { userId: 'test-user-id', email: 'test@example.com' },
        loading: false,
        error: null,
      },
      game: {
        character: null,
        hasCharacter: null,
        characterLoading: true,
        loading: false,
        error: null,
        isOnline: true,
        currentActivity: null,
        inventory: [],
        currency: 0,
        notifications: [],
      },
    });

    render(
      <Provider store={store}>
        <GameDashboard />
      </Provider>
    );

    expect(screen.getByText('Loading your character...')).toBeInTheDocument();
    expect(screen.queryByTestId('login-component')).not.toBeInTheDocument();
    expect(screen.queryByTestId('character-creation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-layout')).not.toBeInTheDocument();
  });

  it('shows character creation when user is authenticated but has no character', () => {
    const store = createMockStore({
      auth: {
        isAuthenticated: true,
        user: { userId: 'test-user-id', email: 'test@example.com' },
        loading: false,
        error: null,
      },
      game: {
        character: null,
        hasCharacter: false,
        characterLoading: false,
        loading: false,
        error: null,
        isOnline: true,
        currentActivity: null,
        inventory: [],
        currency: 0,
        notifications: [],
      },
    });

    render(
      <Provider store={store}>
        <GameDashboard />
      </Provider>
    );

    expect(screen.getByTestId('character-creation')).toBeInTheDocument();
    expect(screen.queryByTestId('login-component')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-layout')).not.toBeInTheDocument();
  });

  it('shows main game interface when user has a character', () => {
    const mockCharacter = {
      characterId: 'char-123',
      userId: 'test-user-id',
      name: 'TestCharacter',
      level: 5,
      experience: 1000,
      stats: {
        strength: 15,
        dexterity: 12,
        intelligence: 10,
        vitality: 13,
      },
    };

    const store = createMockStore({
      auth: {
        isAuthenticated: true,
        user: { userId: 'test-user-id', email: 'test@example.com' },
        loading: false,
        error: null,
      },
      game: {
        character: mockCharacter,
        hasCharacter: true,
        characterLoading: false,
        loading: false,
        error: null,
        isOnline: true,
        currentActivity: null,
        inventory: [],
        currency: 0,
        notifications: [],
      },
    });

    render(
      <Provider store={store}>
        <GameDashboard />
      </Provider>
    );

    expect(screen.getByTestId('responsive-layout')).toBeInTheDocument();
    expect(screen.getByTestId('task-queue')).toBeInTheDocument();
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    expect(screen.queryByTestId('login-component')).not.toBeInTheDocument();
    expect(screen.queryByTestId('character-creation')).not.toBeInTheDocument();
  });

  it('prevents access to game features until character is created', () => {
    const store = createMockStore({
      auth: {
        isAuthenticated: true,
        user: { userId: 'test-user-id', email: 'test@example.com' },
        loading: false,
        error: null,
      },
      game: {
        character: null,
        hasCharacter: false,
        characterLoading: false,
        loading: false,
        error: null,
        isOnline: true,
        currentActivity: null,
        inventory: [],
        currency: 0,
        notifications: [],
      },
    });

    render(
      <Provider store={store}>
        <GameDashboard />
      </Provider>
    );

    // Should show character creation, not game features
    expect(screen.getByTestId('character-creation')).toBeInTheDocument();
    
    // Should not show any game features
    expect(screen.queryByTestId('task-queue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-interface')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-layout')).not.toBeInTheDocument();
  });

  it('transitions from character creation to main game after character is created', async () => {
    const mockCharacter = {
      characterId: 'char-123',
      userId: 'test-user-id',
      name: 'NewCharacter',
      level: 1,
      experience: 0,
    };

    const store = createMockStore({
      auth: {
        isAuthenticated: true,
        user: { userId: 'test-user-id', email: 'test@example.com' },
        loading: false,
        error: null,
      },
      game: {
        character: null,
        hasCharacter: false,
        characterLoading: false,
        loading: false,
        error: null,
        isOnline: true,
        currentActivity: null,
        inventory: [],
        currency: 0,
        notifications: [],
      },
    });

    const { rerender } = render(
      <Provider store={store}>
        <GameDashboard />
      </Provider>
    );

    // Initially shows character creation
    expect(screen.getByTestId('character-creation')).toBeInTheDocument();

    // Simulate character creation completion by updating the store
    const updatedStore = createMockStore({
      auth: {
        isAuthenticated: true,
        user: { userId: 'test-user-id', email: 'test@example.com' },
        loading: false,
        error: null,
      },
      game: {
        character: mockCharacter,
        hasCharacter: true,
        characterLoading: false,
        loading: false,
        error: null,
        isOnline: true,
        currentActivity: null,
        inventory: [],
        currency: 0,
        notifications: [],
      },
    });

    rerender(
      <Provider store={updatedStore}>
        <GameDashboard />
      </Provider>
    );

    // Should now show main game interface
    await waitFor(() => {
      expect(screen.getByTestId('responsive-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('character-creation')).not.toBeInTheDocument();
    });
  });
});