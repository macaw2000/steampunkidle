import { configureStore } from '@reduxjs/toolkit';
import { errorLoggingMiddleware, stateValidationMiddleware } from '../errorMiddleware';
import authReducer from '../../slices/authSlice';
import gameReducer from '../../slices/gameSlice';
import chatReducer from '../../slices/chatSlice';

// Mock console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('Error Handling Middleware', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
        game: gameReducer,
        chat: chatReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware()
          .concat(errorLoggingMiddleware)
          .concat(stateValidationMiddleware),
    });
  });

  describe('errorLoggingMiddleware', () => {
    it('should handle middleware errors gracefully', () => {
      // Create an action that will cause the middleware to throw
      const malformedAction = {
        type: 'test/malformed',
        payload: null,
      };

      expect(() => {
        store.dispatch(malformedAction);
      }).not.toThrow();
    });

    it('should process actions without interfering with normal flow', () => {
      const normalAction = {
        type: 'auth/clearError',
      };

      expect(() => {
        store.dispatch(normalAction);
      }).not.toThrow();

      const state = store.getState();
      expect(state.auth.error).toBeNull();
    });
  });

  describe('stateValidationMiddleware', () => {
    it('should validate auth state and dispatch recovery on invalid state', () => {
      // Dispatch an action that creates invalid auth state
      store.dispatch({
        type: 'auth/loginSuccess',
        payload: {
          user: null, // Invalid: authenticated but no user
          tokens: { accessToken: 'token', refreshToken: 'refresh', idToken: 'id' },
        },
      });

      const state = store.getState();
      expect(state.auth.error).toContain('Invalid user data in login success');
      expect(state.auth.isAuthenticated).toBe(false);
    });

    it('should validate game state and handle invalid character data', () => {
      store.dispatch({
        type: 'game/setCharacter',
        payload: {
          characterId: 'test',
          name: 'Test',
          level: -1, // Invalid: negative level
          experience: 100,
          currency: 50,
        },
      });

      const state = store.getState();
      expect(state.game.error).toContain('level must be a positive number');
      expect(state.game.hasCharacter).toBe(false);
    });

    it('should validate chat state and handle invalid channels', () => {
      store.dispatch({
        type: 'chat/setChannels',
        payload: 'not an array', // Invalid: should be array
      });

      const state = store.getState();
      expect(state.chat.error).toContain('must be an array');
      expect(state.chat.channels).toEqual([]);
    });
  });

  describe('State Recovery', () => {
    it('should recover auth state from partial data', () => {
      const validRecoveryData = {
        user: { userId: 'test', email: 'test@example.com' },
        tokens: { accessToken: 'token', refreshToken: 'refresh', idToken: 'id' },
      };

      store.dispatch({
        type: 'auth/recoverState',
        payload: validRecoveryData,
      });

      const state = store.getState();
      expect(state.auth.user).toEqual(validRecoveryData.user);
      expect(state.auth.tokens).toEqual(validRecoveryData.tokens);
      expect(state.auth.isAuthenticated).toBe(true);
      expect(state.auth.error).toBeNull();
    });

    it('should recover game state from partial data', () => {
      const validCharacter = {
        characterId: 'test',
        name: 'Test Character',
        level: 5,
        experience: 1000,
        currency: 500,
      };

      store.dispatch({
        type: 'game/recoverGameState',
        payload: {
          character: validCharacter,
          isOnline: true,
          lastSyncTime: Date.now(),
        },
      });

      const state = store.getState();
      expect(state.game.character).toEqual(validCharacter);
      expect(state.game.hasCharacter).toBe(true);
      expect(state.game.isOnline).toBe(true);
      expect(state.game.error).toBeNull();
    });

    it('should recover chat state from partial data', () => {
      const validChannels = [
        { channelId: 'general', name: 'General' },
        { channelId: 'help', name: 'Help' },
      ];

      const validMessages = {
        general: [
          {
            messageId: '1',
            channelId: 'general',
            userId: 'user1',
            content: 'Hello',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      store.dispatch({
        type: 'chat/recoverChatState',
        payload: {
          channels: validChannels,
          messages: validMessages,
          unreadCounts: { general: 0, help: 1 },
          activeChannelId: 'general',
          isConnected: true,
        },
      });

      const state = store.getState();
      expect(state.chat.channels).toEqual(validChannels);
      expect(state.chat.messages).toEqual(validMessages);
      expect(state.chat.unreadCounts.general).toBe(0);
      expect(state.chat.unreadCounts.help).toBe(1);
      expect(state.chat.activeChannelId).toBe('general');
      expect(state.chat.isConnected).toBe(true);
      expect(state.chat.error).toBeNull();
    });
  });

  describe('Error Recovery Mechanisms', () => {
    it('should handle corrupted auth state recovery', () => {
      store.dispatch({
        type: 'auth/recoverState',
        payload: {
          user: null, // Invalid recovery data
          tokens: 'invalid', // Invalid recovery data
        },
      });

      const state = store.getState();
      // The recovery should succeed but not set invalid data
      expect(state.auth.isAuthenticated).toBe(false);
      expect(state.auth.user).toBeNull();
    });

    it('should handle corrupted game state recovery', () => {
      store.dispatch({
        type: 'game/recoverGameState',
        payload: {
          character: {
            // Missing required fields
            name: 'Test',
          },
        },
      });

      const state = store.getState();
      // The recovery should not set invalid character data
      expect(state.game.character).toBeNull();
      expect(state.game.hasCharacter).toBeNull();
    });

    it('should handle corrupted chat state recovery', () => {
      store.dispatch({
        type: 'chat/recoverChatState',
        payload: {
          channels: 'invalid', // Should be array
          messages: 'invalid', // Should be object
        },
      });

      const state = store.getState();
      // The recovery should not set invalid data
      expect(state.chat.channels).toEqual([]);
    });
  });

  describe('Input Validation', () => {
    it('should validate character updates', () => {
      // First set a valid character
      store.dispatch({
        type: 'game/setCharacter',
        payload: {
          characterId: 'test',
          name: 'Test',
          level: 1,
          experience: 0,
          currency: 0,
        },
      });

      // Then try to update with invalid data
      store.dispatch({
        type: 'game/updateCharacterStats',
        payload: {
          level: 'invalid', // Should be number
          experience: -100, // Should be non-negative
        },
      });

      const state = store.getState();
      expect(state.game.error).toContain('Invalid level update: must be a positive number');
    });

    it('should validate experience additions', () => {
      // First set a valid character
      store.dispatch({
        type: 'game/setCharacter',
        payload: {
          characterId: 'test',
          name: 'Test',
          level: 1,
          experience: 0,
          currency: 0,
        },
      });

      // Try to add invalid experience
      store.dispatch({
        type: 'game/addExperience',
        payload: -50, // Invalid: negative experience
      });

      const state = store.getState();
      expect(state.game.error).toContain('must be a non-negative number');
    });

    it('should validate currency updates', () => {
      // First set a valid character
      store.dispatch({
        type: 'game/setCharacter',
        payload: {
          characterId: 'test',
          name: 'Test',
          level: 1,
          experience: 0,
          currency: 0,
        },
      });

      // Try to update with invalid currency
      store.dispatch({
        type: 'game/updateCurrency',
        payload: -100, // Invalid: negative currency
      });

      const state = store.getState();
      expect(state.game.error).toContain('must be a non-negative number');
    });

    it('should validate activity rewards', () => {
      // First set a valid character
      store.dispatch({
        type: 'game/setCharacter',
        payload: {
          characterId: 'test',
          name: 'Test',
          level: 1,
          experience: 0,
          currency: 0,
        },
      });

      // Try to apply invalid rewards
      store.dispatch({
        type: 'game/applyActivityRewards',
        payload: [
          { type: 'experience', amount: -50 }, // Invalid: negative amount
          { type: 'currency', amount: 'invalid' }, // Invalid: non-numeric amount
        ],
      });

      const state = store.getState();
      expect(state.game.error).toContain('Invalid reward: must have positive amount');
    });
  });
});